/* ============================================================================
   MEMORY ROOMS — server-side /api/memories/* routes
   ----------------------------------------------------------------------------
   Trip "memory spots": phone captures (photos + one line + location), later
   turned into Blender-built 3D rooms. Contract: src/memory-rooms/CONTRACTS.md §2–3.

     GET    /api/memories/ping                         → gate check
     GET    /api/memories/spots[?deleted=1]            → { data: [Spot…] }
     GET    /api/memories/spots/:id                    → { data: Spot }
     POST   /api/memories/spots                        → create once by client uuid (a re-send changes nothing)
     PATCH  /api/memories/spots/:id                    → edit; scene is validated + versioned
     DELETE /api/memories/spots/:id                    → soft delete
     POST   /api/memories/spots/:id/restore            → undo soft delete
     PUT    /api/memories/spots/:id/media/:type/:n     → raw bytes into R2 + media row
     GET    /api/memories/file/<r2Key>[?t=<exp>.<sig>] → the file (bearer OR signed token)
     POST   /api/memories/spots/:id/walk               → { ticket } for walking the room together
     GET    /api/memories/spots/:id/walk               → who's walking it now
     GET    /api/memories/walk/ws?t=<ticket>           → WebSocket into the spot's walk room
                                                         (Durable Object MemoryWalkRoom, workers/memory-walk.js)
     POST   /api/memories/buildings/:id/walk           → { ticket } for walking a whole place (its room is
     GET    /api/memories/buildings/:id/walk             keyed `b:<id>`, so it can never be a spot's)
     GET    /api/memories/buildings[?deleted=1]        → { data: [Building…] }  (a whole place, CONTRACTS.md 6.4)
     GET    /api/memories/buildings/:id                → { data: Building }
     POST   /api/memories/buildings                    → create once by client uuid
     PATCH  /api/memories/buildings/:id                → edit; sketch + plan (building.json) validated
     DELETE /api/memories/buildings/:id                → soft delete (POST …/restore undoes it)
     PUT    /api/memories/buildings/:id/media/:type/:n → floor-plan photos, outside shots, level GLBs…

   Auth: Bearer MEMORIES_PASSWORD (shared with Justin) or PORTAL_PASSWORD. Fails
   closed when neither is set. Files live in R2 (binding MEMORIES). Rows live
   behind a two-implementation store, picked by MEMORIES_ROW_STORE:
     "supabase" → public.memory_spots / memory_media (supabase/memory_rooms.sql),
                  RLS on with no policies, reached with SUPABASE_SECRET_KEY.
     "local"    → JSON objects in the same R2 bucket (rows/spots/<id>.json,
                  rows/media/<id>.json), so `wrangler dev` runs the whole loop
                  with no Supabase and no Cloudflare setup.
   Portable on purpose: this file + src/memory-rooms/scene/ is all it imports.
   ========================================================================== */

import { createClient } from '@supabase/supabase-js';
import { validateScene } from '../src/memory-rooms/scene/validate.js';
import { validateBuilding } from '../src/memory-rooms/building/validate.js';
import { validateSketch } from '../src/memory-rooms/building/sketch.js';

const PREFIX = '/api/memories/';
const MEDIA_TYPES = ['photo', 'thumb', 'scan', 'model', 'render', 'compare'];
// a spot's model names (anything else is stored as room.glb, as before); a script uploads one only when ping lists it
const SPOT_MODELS = ['room', 'map', 'empty'];
const PEOPLE = ['james', 'justin'];
const STATUSES = ['captured', 'modelling', 'rendered'];
const KINDS = ['interior', 'exterior'];
const LOC_SOURCES = ['gps', 'pin', 'typed'];
const MB = 1024 * 1024;
const LIMITS = { photo: 15 * MB, thumb: 2 * MB, scan: 100 * MB, model: 40 * MB, render: 25 * MB, compare: 25 * MB };
const SIGN_WINDOW_S = 6 * 3600; // signed urls stay identical for a 6 h window (browser cache friendly)

export async function handleMemoriesApi(request, env, url, { json, readJson }) {
  const parts = url.pathname.slice(PREFIX.length).split('/').filter(Boolean).map(decodeURIComponent);
  const [section, id, sub, type, n] = parts;

  try {
    // Files accept a signed token instead of the bearer, so <img>, GLTFLoader and Spark can load them.
    if (section === 'file') return await serveFile(request, env, url, json);
    // The walk room's WebSocket: browsers can't send the bearer on one, so it carries a signed ticket instead.
    if (section === 'walk') return await walkSocket(request, env, url, json);

    const denied = await checkAuth(request, env, json);
    if (denied) return denied;
    if (!env.MEMORIES) return json({ error: 'R2 binding MEMORIES is missing (wrangler.jsonc r2_buckets).' }, 503);

    const store = makeStore(env);
    if (store.error) return json({ error: store.error }, 503);
    const ctx = { env, store, json, readJson, now: new Date().toISOString() };

    if (section === 'ping') {
      if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);
      // `models`: the model names this Worker stores apart. Scripts check for 'map' before uploading
      // map.glb: an older Worker stores every model as room.glb and would overwrite the real one.
      // `features`: what this Worker AND its database can do beyond spots ('buildings' = the routes below,
      // CONTRACTS.md 6.4: listed only once supabase/memory_buildings.sql has run)
      // 'empty' = the empty / furnished bake: model/empty on a spot, model/level-<id>-empty on a building
      // 'place-walk' = walking a whole place (POST /buildings/:id/walk, tickets keyed b:<id>)
      const features = (await store.hasBuildings()) ? ['buildings', 'empty', 'place-walk'] : ['empty'];
      return json({ data: { ok: true, rowStore: store.kind, models: SPOT_MODELS, features } });
    }
    if (section === 'buildings') return await buildingsRoute(ctx, request, id, sub, type, n);
    if (section !== 'spots') return json({ error: 'Not found' }, 404);

    // ── collection ─────────────────────────────────────────────────────────
    if (!id) {
      if (request.method === 'GET') return await listSpots(ctx, url.searchParams.get('deleted') === '1');
      if (request.method === 'POST') return await upsertSpot(ctx, await readJson(request));
      return json({ error: 'Method not allowed' }, 405);
    }
    if (!isUuid(id)) return json({ error: 'Not a spot id' }, 400);

    // ── item actions ───────────────────────────────────────────────────────
    if (sub === 'media') {
      if (request.method !== 'PUT') return json({ error: 'Method not allowed' }, 405);
      return await putMedia(ctx, request, id, type, n);
    }
    if (sub === 'walk') return await walkRoute(ctx, request, id, async () => Boolean(await ctx.store.getSpot(id)));
    if (sub === 'restore') {
      if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
      return await setDeleted(ctx, id, null);
    }
    if (sub) return json({ error: 'Not found' }, 404);

    if (request.method === 'GET') {
      const spot = await store.getSpot(id);
      if (!spot) return json({ error: 'Spot not found' }, 404);
      return json({ data: await withMedia(ctx, spot) });
    }
    if (request.method === 'PATCH') return await patchSpot(ctx, id, await readJson(request));
    if (request.method === 'DELETE') return await setDeleted(ctx, id, ctx.now);
    return json({ error: 'Method not allowed' }, 405);
  } catch (err) {
    // `code: 'needs-sql'` (503): the database has no building tables / columns yet; the phone's outbox
    // holds that one entry (it uploads once the SQL has run) and carries on with the rest
    return json({ error: err?.message || String(err), ...(err?.code ? { code: err.code } : {}) }, err?.status || 500);
  }
}

// ── routes ───────────────────────────────────────────────────────────────────

async function listSpots(ctx, includeDeleted) {
  const [spots, media] = await Promise.all([ctx.store.listSpots(), ctx.store.listMedia()]);
  const bySpot = groupBy(media, (m) => m.spotId);
  const live = spots.filter((s) => includeDeleted || !s.deletedAt);
  live.sort((a, b) => String(b.capturedAt || b.createdAt).localeCompare(String(a.capturedAt || a.createdAt)));
  const data = await Promise.all(live.map((s) => attachMedia(ctx, s, bySpot.get(s.id) || [])));
  return ctx.json({ data });
}

/** POST: create once. A POST for an id that exists (an outbox retry, a re-send) changes nothing and
    returns the stored row: capture fields are set here once, every later change is a PATCH, so a
    late retry can't undo an edit made on the spot page. */
async function upsertSpot(ctx, body) {
  if (!body || typeof body !== 'object') return ctx.json({ error: 'JSON body required' }, 400);
  const problems = [];
  if (!isUuid(body.id)) problems.push('id must be a uuid (the client generates it)');
  if (!PEOPLE.includes(body.createdBy)) problems.push(`createdBy must be one of ${PEOPLE.join(', ')}`);
  if (!KINDS.includes(body.kind)) problems.push(`kind must be one of ${KINDS.join(', ')}`);
  if (!str(body.title, 1, 120)) problems.push('title is required (≤ 120 characters)');
  if (!str(body.note, 1, 600)) problems.push('note is required (≤ 600 characters)');
  const capture = captureFields(body, problems);
  const place = buildingLink(body, problems);
  if (place.roomId && !place.buildingId) problems.push('roomId needs a buildingId');
  if (problems.length) return ctx.json({ error: 'Invalid spot', details: problems }, 400);

  const existing = await ctx.store.getSpot(body.id);
  if (existing) return ctx.json({ data: await withMedia(ctx, existing) }, 200);
  const spot = {
    id: body.id,
    createdAt: ctx.now,
    updatedAt: ctx.now,
    deletedAt: null,
    createdBy: body.createdBy,
    status: 'captured',
    frameGroup: null,
    scene: null,
    sceneVersion: 0,
    tripStopId: null,
    ...capture,
    ...place,
  };
  await ctx.store.putSpot(spot);
  return ctx.json({ data: await withMedia(ctx, spot) }, 201);
}

function captureFields(body, problems) {
  return {
    title: String(body.title || '').trim(),
    note: String(body.note || '').trim(),
    kind: body.kind,
    ...latLng(body.lat, body.lng, problems),
    locAccuracyM: numOrNull(body.locAccuracyM),
    placeLabel: body.placeLabel ? String(body.placeLabel).slice(0, 120) : null,
    locSource: LOC_SOURCES.includes(body.locSource) ? body.locSource : null,
    scaleHint: body.scaleHint ? String(body.scaleHint).slice(0, 80) : null,
    capturedAt: isIsoDateTime(body.capturedAt) ? new Date(body.capturedAt).toISOString() : new Date().toISOString(),
  };
}

/** A spot's place in a whole building: { buildingId, roomId } (both optional; a room needs a building). */
function buildingLink(body, problems) {
  const out = {};
  if ('buildingId' in body) {
    if (body.buildingId === null || isUuid(body.buildingId)) out.buildingId = body.buildingId;
    else problems.push('buildingId must be a uuid (or null)');
  }
  if ('roomId' in body) {
    if (body.roomId === null || ROOM_ID.test(body.roomId || '')) out.roomId = body.roomId;
    else problems.push('roomId must look like "kitchen" or "bed-2" (or null)');
  }
  return out;
}

/** A location as stored: both numbers in range, or both null (no location). POST and PATCH share it. */
function latLng(rawLat, rawLng, problems) {
  const coord = (v, name, max) => {
    if (v === null || v === undefined || v === '') return null;
    const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN;
    if (!Number.isFinite(n)) {
      problems.push(`${name} must be a number`);
      return null;
    }
    if (n < -max || n > max) problems.push(`${name} out of range`);
    return n;
  };
  const lat = coord(rawLat, 'lat', 90);
  const lng = coord(rawLng, 'lng', 180);
  if ((lat === null) !== (lng === null)) problems.push('lat and lng go together');
  return { lat, lng };
}

async function patchSpot(ctx, id, body) {
  if (!body || typeof body !== 'object') return ctx.json({ error: 'JSON body required' }, 400);
  const spot = await ctx.store.getSpot(id);
  if (!spot) return ctx.json({ error: 'Spot not found' }, 404);
  // The edit page sends the updatedAt its form opened with; someone else saving since wins, and it asks first.
  if ('ifUpdatedAt' in body && !sameInstant(body.ifUpdatedAt, spot.updatedAt)) {
    return ctx.json({ error: 'This spot changed since the form opened', details: [`updatedAt is now ${spot.updatedAt}`] }, 409);
  }

  const next = { ...spot };
  const problems = [];
  if ('title' in body) str(body.title, 1, 120) ? (next.title = body.title.trim()) : problems.push('title must be 1–120 characters');
  if ('note' in body) str(body.note, 1, 600) ? (next.note = body.note.trim()) : problems.push('note must be 1–600 characters');
  if ('kind' in body) KINDS.includes(body.kind) ? (next.kind = body.kind) : problems.push(`kind must be one of ${KINDS.join(', ')}`);
  if ('status' in body) STATUSES.includes(body.status) ? (next.status = body.status) : problems.push(`status must be one of ${STATUSES.join(', ')}`);
  if ('createdBy' in body) PEOPLE.includes(body.createdBy) ? (next.createdBy = body.createdBy) : problems.push(`createdBy must be one of ${PEOPLE.join(', ')}`);
  if ('lat' in body || 'lng' in body) {
    if ('lat' in body && 'lng' in body) Object.assign(next, latLng(body.lat, body.lng, problems));
    else problems.push(`${'lat' in body ? 'lat' : 'lng'}: lat and lng go together (send both)`);
  }
  if ('locAccuracyM' in body) next.locAccuracyM = numOrNull(body.locAccuracyM);
  if ('locSource' in body) {
    if (body.locSource === null || LOC_SOURCES.includes(body.locSource)) next.locSource = body.locSource;
    else problems.push(`locSource must be one of ${LOC_SOURCES.join(', ')} (or null)`);
  }
  if ('capturedAt' in body) {
    if (isIsoDateTime(body.capturedAt)) next.capturedAt = new Date(body.capturedAt).toISOString();
    else problems.push('capturedAt must be an ISO 8601 date-time with a zone, like 2026-12-20T19:30:00.000Z');
  }
  for (const k of ['placeLabel', 'scaleHint', 'tripStopId']) if (k in body) next[k] = body[k] == null ? null : String(body[k]).slice(0, 120);
  if ('frameGroup' in body) {
    if (body.frameGroup === null || /^[a-z0-9][a-z0-9-]{0,47}$/.test(body.frameGroup)) next.frameGroup = body.frameGroup;
    else problems.push('frameGroup must look like "home" or "nyc-hostel"');
  }
  Object.assign(next, buildingLink(body, problems));
  // Supabase: clearing a link must reach the row (putSpot only sends building_id / room_id when there is one)
  if (spot.buildingId != null || spot.roomId != null) Object.defineProperty(next, 'hadBuilding', { value: true, enumerable: false });
  if ('scene' in body) {
    if (body.scene === null) {
      next.scene = null;
    } else {
      const { ok, errors } = validateScene(body.scene);
      if (!ok) return ctx.json({ error: 'scene.json is invalid', details: errors }, 400);
      next.scene = body.scene;
      if (body.scene.frame?.group) next.frameGroup = body.scene.frame.group;
      // a room of a building (scene v2) names its building and room: the spot follows it
      if (body.scene.shell?.building) {
        next.buildingId = body.scene.shell.building;
        next.roomId = body.scene.shell.room;
      }
    }
    next.sceneVersion = (spot.sceneVersion || 0) + 1;
  }
  if (next.roomId && !next.buildingId) problems.push('roomId needs a buildingId');
  // The 3D room was built as this kind (the render pipeline owns it from here).
  if (next.kind !== spot.kind && next.scene) problems.push(`kind can't change while the spot has a 3D room (it was built as ${spot.kind})`);
  if (problems.length) return ctx.json({ error: 'Invalid change', details: problems }, 400);
  next.updatedAt = ctx.now;
  await ctx.store.putSpot(next);
  // Read it back: Supabase's trigger sets updated_at, and the edit page sends that value as its next ifUpdatedAt.
  const stored = (await ctx.store.getSpot(id)) || next;
  return ctx.json({ data: await withMedia(ctx, stored) });
}

async function setDeleted(ctx, id, when) {
  const spot = await ctx.store.getSpot(id);
  if (!spot) return ctx.json({ error: 'Spot not found' }, 404);
  const next = { ...spot, deletedAt: when, updatedAt: ctx.now };
  await ctx.store.putSpot(next);
  return ctx.json({ data: { id, deletedAt: when } });
}

async function putMedia(ctx, request, spotId, type, n) {
  if (!MEDIA_TYPES.includes(type)) return ctx.json({ error: `media type must be one of ${MEDIA_TYPES.join(', ')}` }, 400);
  const key = mediaKey(spotId, type, n);
  if (!key) return ctx.json({ error: `bad media name "${n}" for ${type}` }, 400);
  const spot = await ctx.store.getSpot(spotId);
  if (!spot) return ctx.json({ error: 'Spot not found (POST the spot before its media)' }, 404);

  const contentType = (request.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  const allowed = {
    photo: ['image/jpeg'],
    thumb: ['image/jpeg'],
    scan: ['application/octet-stream', 'model/spz', ''],
    model: ['model/gltf-binary', 'application/octet-stream'],
    render: ['image/png', 'image/jpeg', 'image/webp'],
    compare: ['image/png', 'image/jpeg', 'image/webp'],
  }[type];
  if (!allowed.includes(contentType)) return ctx.json({ error: `${type} must be ${allowed.filter(Boolean).join(' or ')}` }, 415);

  const declared = Number(request.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > LIMITS[type]) return ctx.json({ error: `${type} is larger than ${LIMITS[type] / MB} MB` }, 413);

  // Stream straight into R2 when the length is known (keeps a 100 MB scan out of memory).
  const body = Number.isFinite(declared) && declared > 0 ? request.body : await request.arrayBuffer();
  const storedType = type === 'scan' ? 'application/octet-stream' : type === 'model' ? 'model/gltf-binary' : contentType;
  const obj = await ctx.env.MEMORIES.put(key, body, { httpMetadata: { contentType: storedType } });
  if (obj.size > LIMITS[type]) {
    await ctx.env.MEMORIES.delete(key);
    return ctx.json({ error: `${type} is larger than ${LIMITS[type] / MB} MB` }, 413);
  }

  const name = mediaName(type, n);
  const media = {
    id: await uuidFromKey(`${spotId}:${type}:${name}`),
    spotId,
    type,
    name,
    r2Key: key,
    width: intOrNull(request.headers.get('x-width')),
    height: intOrNull(request.headers.get('x-height')),
    bytes: obj.size,
    sort: /^\d+$/.test(name) ? Number(name) : 0,
    contentType: storedType,
    createdAt: ctx.now,
  };
  await ctx.store.putMedia(media);
  return ctx.json({ data: await signMedia(ctx.env, media) });
}

async function serveFile(request, env, url, json) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return json({ error: 'Method not allowed' }, 405);
  const key = decodeURIComponent(url.pathname.slice(`${PREFIX}file/`.length));
  if (!/^(spots|buildings)\/[0-9a-f-]{36}\/[a-z0-9/_.-]+$/i.test(key) || key.includes('..')) return json({ error: 'Bad file key' }, 400);

  const token = url.searchParams.get('t');
  if (token) {
    if (!(await verifyToken(env, key, token))) return json({ error: 'Link expired or invalid' }, 403);
  } else {
    const denied = await checkAuth(request, env, json);
    if (denied) return denied;
  }
  if (!env.MEMORIES) return json({ error: 'R2 binding MEMORIES is missing.' }, 503);

  const etagIn = request.headers.get('if-none-match');
  const obj = await env.MEMORIES.get(key, etagIn ? { onlyIf: { etagDoesNotMatch: etagIn.replace(/"/g, '') } } : undefined);
  if (obj === null) return json({ error: 'File not found' }, 404);
  const headers = new Headers({
    'content-type': obj.httpMetadata?.contentType || 'application/octet-stream',
    etag: obj.httpEtag,
    'cache-control': 'private, max-age=3600',
  });
  if (!('body' in obj) || !obj.body) return new Response(null, { status: 304, headers });
  headers.set('content-length', String(obj.size));
  return new Response(request.method === 'HEAD' ? null : obj.body, { headers });
}

// ── walk in together (the Durable Object is workers/memory-walk.js) ──────────

const WALK_TICKET_S = 120;

/** A walk room's key: a spot's uuid, or `b:<uuid>` for a whole place. */
const isWalkKey = (k) => isUuid(k) || (k.startsWith('b:') && isUuid(k.slice(2)));

async function walkRoute(ctx, request, id, exists) {
  const { env, json } = ctx;
  if (!env.MEMORY_WALK) return json({ error: 'Durable Object binding MEMORY_WALK is missing (wrangler.jsonc).' }, 503);
  if (request.method === 'GET') {
    const res = await env.MEMORY_WALK.get(env.MEMORY_WALK.idFromName(id)).fetch('https://walk/presence');
    return json(await res.json());
  }
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  let body = {};
  try {
    body = (await request.json()) || {};
  } catch {
    body = {};
  }
  if (!PEOPLE.includes(body.who)) return json({ error: 'who must be james or justin', details: [`who must be one of ${PEOPLE.join(', ')}`] }, 400);
  if (!(await exists())) return json({ error: id.startsWith('b:') ? 'Building not found' : 'Spot not found' }, 404);
  const exp = Math.floor(Date.now() / 1000) + WALK_TICKET_S;
  const sig = await hmac(env, `walk|${id}|${body.who}|${exp}`);
  const ticket = `${id}.${body.who}.${exp}.${sig}`;
  return json({ data: { ticket, expiresAt: new Date(exp * 1000).toISOString(), socket: `${PREFIX}walk/ws?t=${encodeURIComponent(ticket)}` } });
}

async function walkSocket(request, env, url, json) {
  if (url.pathname !== `${PREFIX}walk/ws`) return json({ error: 'Not found' }, 404);
  const ticket = url.searchParams.get('t');
  if (!ticket) return json({ error: 'Unauthorized' }, 401);
  const [spotId, who, expStr, sig] = ticket.split('.');
  const exp = Number(expStr);
  const valid =
    isWalkKey(spotId || '') && PEOPLE.includes(who) && Number.isFinite(exp) && exp * 1000 > Date.now() && Boolean(sig) && (await hmac(env, `walk|${spotId}|${who}|${exp}`)) === sig;
  if (!valid) return json({ error: 'Ticket expired or invalid' }, 403);
  if (request.headers.get('upgrade')?.toLowerCase() !== 'websocket') return json({ error: 'Expected a WebSocket upgrade' }, 426);
  if (!env.MEMORY_WALK) return json({ error: 'Durable Object binding MEMORY_WALK is missing (wrangler.jsonc).' }, 503);
  const headers = new Headers(request.headers);
  headers.set('x-walk-who', who);
  return env.MEMORY_WALK.get(env.MEMORY_WALK.idFromName(spotId)).fetch(new Request('https://walk/ws', { method: 'GET', headers }));
}

// ── buildings: a whole place (CONTRACTS.md section 6.4) ─────────────────────

const BUILDING_MEDIA_TYPES = ['plan', 'photo', 'thumb', 'model', 'render', 'compare'];
const BUILDING_LIMITS = { ...LIMITS, plan: 15 * MB };
const ROOM_ID = /^[a-z0-9][a-z0-9-]{0,31}$/;

async function buildingsRoute(ctx, request, id, sub, type, n) {
  const { json } = ctx;
  if (!id) {
    if (request.method === 'GET') return await listBuildings(ctx, new URL(request.url).searchParams.get('deleted') === '1');
    if (request.method === 'POST') return await createBuilding(ctx, await ctx.readJson(request));
    return json({ error: 'Method not allowed' }, 405);
  }
  if (!isUuid(id)) return json({ error: 'Not a building id' }, 400);
  if (sub === 'media') {
    if (request.method !== 'PUT') return json({ error: 'Method not allowed' }, 405);
    return await putBuildingMedia(ctx, request, id, type, n);
  }
  if (sub === 'restore') {
    if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
    return await setBuildingDeleted(ctx, id, null);
  }
  // walking the whole place together: the same Durable Object class, keyed `b:<id>` (a spot's key is its bare uuid)
  if (sub === 'walk') return await walkRoute(ctx, request, `b:${id}`, async () => Boolean(await ctx.store.getBuilding(id)));
  if (sub) return json({ error: 'Not found' }, 404);
  if (request.method === 'GET') {
    const b = await ctx.store.getBuilding(id);
    if (!b) return json({ error: 'Building not found' }, 404);
    return json({ data: await withBuildingMedia(ctx, b) });
  }
  if (request.method === 'PATCH') return await patchBuilding(ctx, id, await ctx.readJson(request));
  if (request.method === 'DELETE') return await setBuildingDeleted(ctx, id, ctx.now);
  return json({ error: 'Method not allowed' }, 405);
}

async function listBuildings(ctx, includeDeleted) {
  const [rows, media] = await Promise.all([ctx.store.listBuildings(), ctx.store.listBuildingMedia()]);
  const byBuilding = groupBy(media, (m) => m.buildingId);
  const live = rows.filter((b) => includeDeleted || !b.deletedAt);
  live.sort((a, b) => String(b.capturedAt || b.createdAt).localeCompare(String(a.capturedAt || a.createdAt)));
  return ctx.json({ data: await Promise.all(live.map((b) => attachMedia(ctx, b, byBuilding.get(b.id) || []))) });
}

/** Problems with a sketch / plan, each line starting with its field (the form shows them by it). */
function sketchProblems(sketch) {
  if (sketch === null) return [];
  const { ok, errors } = validateSketch(sketch);
  return ok ? [] : errors.map((e) => `sketch${e.path} ${e.message}`);
}

/** POST: create once by the client's uuid (the outbox may send it again: that changes nothing). */
async function createBuilding(ctx, body) {
  if (!body || typeof body !== 'object') return ctx.json({ error: 'JSON body required' }, 400);
  const problems = [];
  if (!isUuid(body.id)) problems.push('id must be a uuid (the client generates it)');
  if (!PEOPLE.includes(body.createdBy)) problems.push(`createdBy must be one of ${PEOPLE.join(', ')}`);
  if (!str(body.title, 1, 120)) problems.push('title is required (≤ 120 characters)');
  if (body.note != null && body.note !== '' && !str(body.note, 1, 600)) problems.push('note must be ≤ 600 characters');
  if (body.sketch !== undefined) problems.push(...sketchProblems(body.sketch));
  const loc = latLng(body.lat, body.lng, problems);
  if (problems.length) return ctx.json({ error: 'Invalid building', details: problems }, 400);

  const existing = await ctx.store.getBuilding(body.id);
  if (existing) return ctx.json({ data: await withBuildingMedia(ctx, existing) }, 200);
  const b = {
    id: body.id,
    createdAt: ctx.now,
    updatedAt: ctx.now,
    deletedAt: null,
    createdBy: body.createdBy,
    title: String(body.title).trim(),
    note: body.note ? String(body.note).trim() : null,
    ...loc,
    locAccuracyM: numOrNull(body.locAccuracyM),
    placeLabel: body.placeLabel ? String(body.placeLabel).slice(0, 120) : null,
    locSource: LOC_SOURCES.includes(body.locSource) ? body.locSource : null,
    capturedAt: isIsoDateTime(body.capturedAt) ? new Date(body.capturedAt).toISOString() : ctx.now,
    status: 'captured',
    sketch: body.sketch ?? null,
    plan: null,
    planVersion: 0,
    tripStopId: null,
  };
  await ctx.store.putBuilding(b);
  return ctx.json({ data: await withBuildingMedia(ctx, b) }, 201);
}

async function patchBuilding(ctx, id, body) {
  if (!body || typeof body !== 'object') return ctx.json({ error: 'JSON body required' }, 400);
  const b = await ctx.store.getBuilding(id);
  if (!b) return ctx.json({ error: 'Building not found' }, 404);
  if ('ifUpdatedAt' in body && !sameInstant(body.ifUpdatedAt, b.updatedAt)) {
    return ctx.json({ error: 'This place changed since the form opened', details: [`updatedAt is now ${b.updatedAt}`] }, 409);
  }
  const next = { ...b };
  const problems = [];
  if ('title' in body) str(body.title, 1, 120) ? (next.title = body.title.trim()) : problems.push('title must be 1–120 characters');
  if ('note' in body) {
    if (body.note === null || body.note === '') next.note = null;
    else if (str(body.note, 1, 600)) next.note = body.note.trim();
    else problems.push('note must be ≤ 600 characters');
  }
  if ('status' in body) STATUSES.includes(body.status) ? (next.status = body.status) : problems.push(`status must be one of ${STATUSES.join(', ')}`);
  if ('createdBy' in body) PEOPLE.includes(body.createdBy) ? (next.createdBy = body.createdBy) : problems.push(`createdBy must be one of ${PEOPLE.join(', ')}`);
  if ('lat' in body || 'lng' in body) {
    if ('lat' in body && 'lng' in body) Object.assign(next, latLng(body.lat, body.lng, problems));
    else problems.push(`${'lat' in body ? 'lat' : 'lng'}: lat and lng go together (send both)`);
  }
  if ('locAccuracyM' in body) next.locAccuracyM = numOrNull(body.locAccuracyM);
  if ('locSource' in body) {
    if (body.locSource === null || LOC_SOURCES.includes(body.locSource)) next.locSource = body.locSource;
    else problems.push(`locSource must be one of ${LOC_SOURCES.join(', ')} (or null)`);
  }
  if ('capturedAt' in body) {
    if (isIsoDateTime(body.capturedAt)) next.capturedAt = new Date(body.capturedAt).toISOString();
    else problems.push('capturedAt must be an ISO 8601 date-time with a zone, like 2026-12-20T19:30:00.000Z');
  }
  for (const k of ['placeLabel', 'tripStopId']) if (k in body) next[k] = body[k] == null ? null : String(body[k]).slice(0, 120);
  if ('sketch' in body) {
    const p = sketchProblems(body.sketch);
    if (p.length) problems.push(...p);
    else next.sketch = body.sketch;
  }
  if ('plan' in body) {
    if (body.plan === null) next.plan = null;
    else {
      const { ok, errors } = validateBuilding(body.plan);
      if (!ok) return ctx.json({ error: 'building.json is invalid', details: errors }, 400);
      next.plan = body.plan;
    }
    next.planVersion = (b.planVersion || 0) + 1;
  }
  if (problems.length) return ctx.json({ error: 'Invalid change', details: problems }, 400);
  next.updatedAt = ctx.now;
  await ctx.store.putBuilding(next);
  const stored = (await ctx.store.getBuilding(id)) || next;
  return ctx.json({ data: await withBuildingMedia(ctx, stored) });
}

async function setBuildingDeleted(ctx, id, when) {
  const b = await ctx.store.getBuilding(id);
  if (!b) return ctx.json({ error: 'Building not found' }, 404);
  await ctx.store.putBuilding({ ...b, deletedAt: when, updatedAt: ctx.now });
  return ctx.json({ data: { id, deletedAt: when } });
}

/** R2 key for a building's file (CONTRACTS.md 6.4), or null when `n` doesn't fit the type. */
export function buildingMediaKey(id, type, n) {
  const base = `buildings/${id}`;
  if (type === 'plan') {
    if (!/^\d$/.test(n || '') || Number(n) < 1 || Number(n) > 4) return null;
    return `${base}/plan/${Number(n)}.jpg`;
  }
  if (type === 'photo' || type === 'thumb') {
    if (!/^\d{1,2}$/.test(n || '') || Number(n) < 1 || Number(n) > 12) return null;
    return `${base}/${type === 'photo' ? 'photos' : 'thumbs'}/${Number(n)}.jpg`;
  }
  if (type === 'model') {
    if (n === 'exterior' || n === 'map' || /^level-[a-z0-9][a-z0-9-]{0,31}$/.test(n || '')) return `${base}/model/${n}.glb`;
    return null;
  }
  if (!/^[a-z0-9][a-z0-9-]{0,40}$/.test(n || '')) return null;
  return type === 'render' ? `${base}/renders/${n}.png` : `${base}/compare/${n}.png`;
}

async function putBuildingMedia(ctx, request, buildingId, type, n) {
  if (!BUILDING_MEDIA_TYPES.includes(type)) return ctx.json({ error: `media type must be one of ${BUILDING_MEDIA_TYPES.join(', ')}` }, 400);
  const key = buildingMediaKey(buildingId, type, n);
  if (!key) return ctx.json({ error: `bad media name "${n}" for ${type}` }, 400);
  const b = await ctx.store.getBuilding(buildingId);
  if (!b) return ctx.json({ error: 'Building not found (POST the building before its media)' }, 404);

  const contentType = (request.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  const allowed = {
    plan: ['image/jpeg'],
    photo: ['image/jpeg'],
    thumb: ['image/jpeg'],
    model: ['model/gltf-binary', 'application/octet-stream'],
    render: ['image/png', 'image/jpeg', 'image/webp'],
    compare: ['image/png', 'image/jpeg', 'image/webp'],
  }[type];
  if (!allowed.includes(contentType)) return ctx.json({ error: `${type} must be ${allowed.join(' or ')}` }, 415);
  const declared = Number(request.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > BUILDING_LIMITS[type]) return ctx.json({ error: `${type} is larger than ${BUILDING_LIMITS[type] / MB} MB` }, 413);
  const body = Number.isFinite(declared) && declared > 0 ? request.body : await request.arrayBuffer();
  const storedType = type === 'model' ? 'model/gltf-binary' : contentType;
  const obj = await ctx.env.MEMORIES.put(key, body, { httpMetadata: { contentType: storedType } });
  if (obj.size > BUILDING_LIMITS[type]) {
    await ctx.env.MEMORIES.delete(key);
    return ctx.json({ error: `${type} is larger than ${BUILDING_LIMITS[type] / MB} MB` }, 413);
  }
  const name = type === 'plan' || type === 'photo' || type === 'thumb' ? String(Number(n)) : n;
  const media = {
    id: await uuidFromKey(`b:${buildingId}:${type}:${name}`),
    buildingId,
    type,
    name,
    r2Key: key,
    width: intOrNull(request.headers.get('x-width')),
    height: intOrNull(request.headers.get('x-height')),
    bytes: obj.size,
    sort: /^\d+$/.test(name) ? Number(name) : 0,
    contentType: storedType,
    createdAt: ctx.now,
  };
  await ctx.store.putBuildingMedia(media);
  return ctx.json({ data: await signMedia(ctx.env, media) });
}

async function withBuildingMedia(ctx, b) {
  return attachMedia(ctx, b, await ctx.store.listBuildingMedia(b.id));
}

// ── media helpers ────────────────────────────────────────────────────────────

/** R2 key for a media upload (CONTRACTS.md §2), or null if `n` is not valid for the type. */
export function mediaKey(spotId, type, n) {
  const base = `spots/${spotId}`;
  if (type === 'photo' || type === 'thumb') {
    if (!/^\d{1,2}$/.test(n || '') || Number(n) < 1 || Number(n) > 12) return null;
    return `${base}/${type === 'photo' ? 'photos' : 'thumbs'}/${Number(n)}.jpg`;
  }
  if (type === 'scan') return `${base}/scan.spz`;
  // model: the baked room (`room`, any other name too, as before), its small map copy (`map`) or, for a room of a
  // building, its empty bake's atlases (`empty`: a texture-only GLB, CONTRACTS.md 6.4)
  if (type === 'model') return `${base}/model/${SPOT_MODELS.includes(n) ? n : 'room'}.glb`;
  if (!/^[a-z0-9][a-z0-9-]{0,40}$/.test(n || '')) return null;
  return type === 'render' ? `${base}/renders/${n}.png` : `${base}/compare/${n}.png`;
}

function mediaName(type, n) {
  if (type === 'photo' || type === 'thumb') return String(Number(n));
  if (type === 'scan') return 'scan';
  if (type === 'model') return SPOT_MODELS.includes(n) ? n : 'room';
  return n;
}

async function withMedia(ctx, spot) {
  return attachMedia(ctx, spot, await ctx.store.listMedia(spot.id));
}

const TYPE_ORDER = Object.fromEntries([...MEDIA_TYPES, 'plan'].map((t, i) => [t, i]));
async function attachMedia(ctx, spot, media) {
  const sorted = [...media].sort((a, b) => TYPE_ORDER[a.type] - TYPE_ORDER[b.type] || a.sort - b.sort || a.name.localeCompare(b.name));
  return { ...spot, media: await Promise.all(sorted.map((m) => signMedia(ctx.env, m))) };
}

async function signMedia(env, media) {
  const exp = (Math.floor(Date.now() / 1000 / SIGN_WINDOW_S) + 3) * SIGN_WINDOW_S; // 12–18 h
  const sig = await hmac(env, `${media.r2Key}.${exp}`);
  const path = media.r2Key.split('/').map(encodeURIComponent).join('/');
  return { ...media, url: `${PREFIX}file/${path}?t=${exp}.${sig}` };
}

// ── auth + signing ───────────────────────────────────────────────────────────

async function checkAuth(request, env, json) {
  const secrets = [env.MEMORIES_PASSWORD, env.PORTAL_PASSWORD].filter(Boolean);
  if (!secrets.length) return json({ error: 'Not configured — set MEMORIES_PASSWORD (or PORTAL_PASSWORD).' }, 503);
  const provided = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!provided) return json({ error: 'Unauthorized' }, 401);
  for (const s of secrets) if (await sameSecret(provided, s)) return null;
  return json({ error: 'Unauthorized' }, 401);
}

const enc = new TextEncoder();
async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Compare via digests so the time taken doesn't leak how many leading characters matched. */
async function sameSecret(a, b) {
  return (await sha256Hex(`mr:${a}`)) === (await sha256Hex(`mr:${b}`));
}

const keyCache = new Map();
async function signingKey(env) {
  const material = env.MEMORIES_SIGNING_KEY || `derived|${env.MEMORIES_PASSWORD || ''}|${env.PORTAL_PASSWORD || ''}`;
  if (!keyCache.has(material)) {
    keyCache.set(material, crypto.subtle.importKey('raw', enc.encode(material), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']));
  }
  return keyCache.get(material);
}

async function hmac(env, text) {
  const sig = await crypto.subtle.sign('HMAC', await signingKey(env), enc.encode(text));
  return btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function verifyToken(env, key, token) {
  const [expStr, sig] = token.split('.');
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp * 1000 < Date.now() || !sig) return false;
  return (await hmac(env, `${key}.${exp}`)) === sig;
}

/** A stable uuid (v5 layout over SHA-1) for a media slot, so re-uploads overwrite the same row. */
async function uuidFromKey(text) {
  const b = new Uint8Array(await crypto.subtle.digest('SHA-1', enc.encode(`memory-rooms:${text}`))).slice(0, 16);
  b[6] = (b[6] & 0x0f) | 0x50;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

// ── row stores ───────────────────────────────────────────────────────────────

/** "local" = JSON rows in R2 (dev default); "supabase" = the deploy target. */
function makeStore(env) {
  const kind = (env.MEMORIES_ROW_STORE || 'supabase').toLowerCase();
  if (kind === 'local') return localStore(env.MEMORIES);
  if (kind === 'supabase') {
    if (!env.SUPABASE_URL || !env.SUPABASE_SECRET_KEY) {
      return { error: 'Supabase isn’t configured (SUPABASE_URL / SUPABASE_SECRET_KEY). Set MEMORIES_ROW_STORE=local for dev.' };
    }
    return supabaseStore(createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY));
  }
  return { error: `MEMORIES_ROW_STORE must be "local" or "supabase", got "${kind}"` };
}

function localStore(bucket) {
  const spotKey = (id) => `rows/spots/${id}.json`;
  const mediaRowKey = (id) => `rows/media/${id}.json`;
  const buildingKey = (id) => `rows/buildings/${id}.json`;
  const bmediaKey = (id) => `rows/bmedia/${id}.json`;

  async function listKeys(prefix, filter) {
    const keys = [];
    let cursor;
    do {
      const page = await bucket.list({ prefix, cursor, include: ['customMetadata'] });
      for (const o of page.objects) if (!filter || filter(o)) keys.push(o.key);
      cursor = page.truncated ? page.cursor : undefined;
    } while (cursor);
    return keys;
  }
  const readAll = async (keys) => (await Promise.all(keys.map(async (k) => (await bucket.get(k))?.json()))).filter(Boolean);
  const put = (key, value, customMetadata) =>
    bucket.put(key, JSON.stringify(value), { httpMetadata: { contentType: 'application/json' }, customMetadata });

  return {
    kind: 'local',
    hasBuildings: async () => true,
    listSpots: async () => readAll(await listKeys('rows/spots/')),
    getSpot: async (id) => (await bucket.get(spotKey(id)))?.json() ?? null,
    putSpot: (spot) => put(spotKey(spot.id), spot),
    listMedia: async (spotId) => {
      // customMetadata.spot_id lets one spot's media be found without reading every row.
      const rows = await readAll(await listKeys('rows/media/', spotId ? (o) => !o.customMetadata?.spot_id || o.customMetadata.spot_id === spotId : null));
      return spotId ? rows.filter((m) => m.spotId === spotId) : rows;
    },
    putMedia: async (m) => {
      const existing = await (await bucket.get(mediaRowKey(m.id)))?.json();
      return put(mediaRowKey(m.id), existing ? { ...m, createdAt: existing.createdAt } : m, { spot_id: m.spotId });
    },
    listBuildings: async () => readAll(await listKeys('rows/buildings/')),
    getBuilding: async (id) => (await bucket.get(buildingKey(id)))?.json() ?? null,
    putBuilding: (b) => put(buildingKey(b.id), b),
    listBuildingMedia: async (buildingId) => {
      const rows = await readAll(await listKeys('rows/bmedia/', buildingId ? (o) => !o.customMetadata?.building_id || o.customMetadata.building_id === buildingId : null));
      return buildingId ? rows.filter((m) => m.buildingId === buildingId) : rows;
    },
    putBuildingMedia: async (m) => {
      const existing = await (await bucket.get(bmediaKey(m.id)))?.json();
      return put(bmediaKey(m.id), existing ? { ...m, createdAt: existing.createdAt } : m, { building_id: m.buildingId });
    },
  };
}

const SPOT_COLS = {
  id: 'id', createdAt: 'created_at', updatedAt: 'updated_at', deletedAt: 'deleted_at', createdBy: 'created_by',
  title: 'title', note: 'note', kind: 'kind', lat: 'lat', lng: 'lng', locAccuracyM: 'loc_accuracy_m',
  placeLabel: 'place_label', locSource: 'loc_source', scaleHint: 'scale_hint', capturedAt: 'captured_at',
  status: 'status', frameGroup: 'frame_group', scene: 'scene', sceneVersion: 'scene_version', tripStopId: 'trip_stop_id',
  buildingId: 'building_id', roomId: 'room_id',
};
const BUILDING_COLS = {
  id: 'id', createdAt: 'created_at', updatedAt: 'updated_at', deletedAt: 'deleted_at', createdBy: 'created_by',
  title: 'title', note: 'note', lat: 'lat', lng: 'lng', locAccuracyM: 'loc_accuracy_m', placeLabel: 'place_label',
  locSource: 'loc_source', capturedAt: 'captured_at', status: 'status', sketch: 'sketch', plan: 'plan',
  planVersion: 'plan_version', tripStopId: 'trip_stop_id',
};
const BMEDIA_COLS = {
  id: 'id', buildingId: 'building_id', type: 'type', name: 'name', r2Key: 'r2_key', width: 'width', height: 'height',
  bytes: 'bytes', sort: 'sort', contentType: 'content_type', createdAt: 'created_at',
};
const MEDIA_COLS = {
  id: 'id', spotId: 'spot_id', type: 'type', name: 'name', r2Key: 'r2_key', width: 'width', height: 'height',
  bytes: 'bytes', sort: 'sort', contentType: 'content_type', createdAt: 'created_at',
};
const toRow = (obj, cols, skip = []) =>
  Object.fromEntries(Object.entries(cols).filter(([k]) => k in obj && !skip.includes(k)).map(([k, col]) => [col, obj[k]]));
const fromRow = (row, cols) => Object.fromEntries(Object.entries(cols).map(([k, col]) => [k, row[col] ?? null]));

// PostgREST / Postgres codes for a table or a column that isn't there (memory_buildings.sql not run yet)
const NEEDS_SQL = new Set(['42P01', '42703', 'PGRST204', 'PGRST205']);
const NEEDS_SQL_MESSAGE = 'Whole places need the database update first (supabase/memory_buildings.sql).';
let buildingsProbe = { at: 0, ok: false };

function supabaseStore(db) {
  const check = ({ data, error }) => {
    if (error) {
      if (NEEDS_SQL.has(error.code)) throw Object.assign(new Error(NEEDS_SQL_MESSAGE), { status: 503, code: 'needs-sql' });
      throw Object.assign(new Error(error.message), { status: 500 });
    }
    return data;
  };
  return {
    kind: 'supabase',
    /** Have the building tables been made? (asked at most once a minute per isolate) */
    hasBuildings: async () => {
      if (Date.now() - buildingsProbe.at < 60_000) return buildingsProbe.ok;
      const { error } = await db.from('memory_buildings').select('id').limit(1);
      buildingsProbe = { at: Date.now(), ok: !error };
      return buildingsProbe.ok;
    },
    listSpots: async () => check(await db.from('memory_spots').select('*')).map((r) => fromRow(r, SPOT_COLS)),
    getSpot: async (id) => {
      const data = check(await db.from('memory_spots').select('*').eq('id', id).maybeSingle());
      return data ? fromRow(data, SPOT_COLS) : null;
    },
    // updated_at is kept by the table's trigger. building_id / room_id are only sent once a spot has them
    // (or had them): a Worker deployed before supabase/memory_buildings.sql has run keeps saving spots.
    putSpot: async (spot) => {
      const skip = ['updatedAt'];
      if (spot.buildingId == null && spot.roomId == null && !spot.hadBuilding) skip.push('buildingId', 'roomId');
      return check(await db.from('memory_spots').upsert(toRow(spot, SPOT_COLS, skip), { onConflict: 'id' }));
    },
    listMedia: async (spotId) => {
      let q = db.from('memory_media').select('*');
      if (spotId) q = q.eq('spot_id', spotId);
      return check(await q).map((r) => fromRow(r, MEDIA_COLS));
    },
    putMedia: async (m) => check(await db.from('memory_media').upsert(toRow(m, MEDIA_COLS, ['createdAt']), { onConflict: 'id' })),
    listBuildings: async () => check(await db.from('memory_buildings').select('*')).map((r) => fromRow(r, BUILDING_COLS)),
    getBuilding: async (id) => {
      const data = check(await db.from('memory_buildings').select('*').eq('id', id).maybeSingle());
      return data ? fromRow(data, BUILDING_COLS) : null;
    },
    putBuilding: async (b) => check(await db.from('memory_buildings').upsert(toRow(b, BUILDING_COLS, ['updatedAt']), { onConflict: 'id' })),
    listBuildingMedia: async (buildingId) => {
      let q = db.from('memory_building_media').select('*');
      if (buildingId) q = q.eq('building_id', buildingId);
      return check(await q).map((r) => fromRow(r, BMEDIA_COLS));
    },
    putBuildingMedia: async (m) => check(await db.from('memory_building_media').upsert(toRow(m, BMEDIA_COLS, ['createdAt']), { onConflict: 'id' })),
  };
}

// ── small helpers ────────────────────────────────────────────────────────────

const isUuid = (s) => typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
const str = (v, min, max) => typeof v === 'string' && v.trim().length >= min && v.trim().length <= max;
/** "2026-12-20T19:30:00.000Z" or "…+08:00": a real calendar date, a time and a zone (Date.parse alone takes "1"). */
function isIsoDateTime(v) {
  const m = typeof v === 'string' && /^(\d{4})-(\d{2})-(\d{2})T\d{2}:\d{2}(:\d{2}(\.\d{1,9})?)?(Z|[+-]\d{2}:?\d{2})$/.exec(v);
  if (!m || !Number.isFinite(Date.parse(v))) return false;
  const day = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return day.getUTCMonth() === Number(m[2]) - 1 && day.getUTCDate() === Number(m[3]);
}
/** Two timestamps for the same instant (Supabase gives microseconds and "+00:00"; the local store "Z"). */
const sameInstant = (a, b) => typeof a === 'string' && typeof b === 'string' && (a === b || (Number.isFinite(Date.parse(a)) && Date.parse(a) === Date.parse(b)));
function numOrNull(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function intOrNull(v) {
  const n = numOrNull(v);
  return n === null ? null : Math.round(n);
}
function groupBy(list, keyFn) {
  const m = new Map();
  for (const item of list) {
    const k = keyFn(item);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(item);
  }
  return m;
}
