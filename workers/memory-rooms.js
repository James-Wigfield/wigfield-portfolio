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
     PUT    /api/memories/spots/:id/media/:type/:n     → raw bytes into R2 + media row (photo / thumb n: 1–12, or 1–40 for a
                                                         freeform spot; a photo may carry its EXIF in x-exif)
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
     GET    /api/memories/shares[?kind=&id=]           → { data: [Share…] }  private share links
     POST   /api/memories/shares                       → { kind: 'building'|'spot', id, label? } → Share
     DELETE /api/memories/shares/:token                → switch a link off (it 404s from then on)
     GET    /api/memories/collections                  → { data: [Collection…] }  (groups of spots + places)
     POST   /api/memories/collections                  → create once by client uuid { id, name, sort?, bounds? }
     PATCH  /api/memories/collections/:id              → rename / reorder / set its map bounds (+ ifUpdatedAt)
     DELETE /api/memories/collections/:id              → gone; its spots and places become ungrouped (never deleted)
     GET    /api/memories/shared/:token                → NO password: that one place / room, read-only,
                                                         trimmed (no location, note, sketch, plan photos or
                                                         compare sheets), files signed as usual

   Share links: a Share is { token, kind, id, label, createdAt } stored as R2 `shares/<token>.json` (both row
   stores, no SQL). The token is 24 random bytes, so it can't be guessed; whoever holds it sees that one thing
   and nothing else: every other route still needs the password, and a signed file url opens only its own file.

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
import { MAX_GUIDED_PHOTOS, maxPhotosOf, validateCapture } from '../src/memory-rooms/capture/freeform.js';

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
    // A private share link (/memories/s/<token>): its ONE place or room, read-only, no password.
    if (section === 'shared') return await sharedRoute(request, env, id, sub, json);
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
      // 'collections' = the collection routes + spot / place collectionId (once supabase/memory_collections.sql has run)
      const features = (await store.hasBuildings()) ? ['buildings', 'empty', 'place-walk'] : ['empty'];
      if (await store.hasCollections()) features.push('collections');
      // 'freeform' = a spot's `capture` (old photos, up to 40, the layout + viewpoints) and a photo's EXIF (CONTRACTS.md 8)
      if (await store.hasFreeform()) features.push('freeform');
      return json({ data: { ok: true, rowStore: store.kind, models: SPOT_MODELS, features } });
    }
    if (section === 'buildings') return await buildingsRoute(ctx, request, id, sub, type, n);
    if (section === 'shares') return await sharesRoute(ctx, request, url, id, sub);
    if (section === 'collections') return await collectionsRoute(ctx, request, id, sub);
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
  const grouped = collectionLink(body, problems);
  const how = captureOf(body, problems);
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
    ...grouped,
    ...how,
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

/** A spot's `capture` (capture/capture.schema.json, CONTRACTS.md 8): { capture } when sent (null clears it). Each problem
    starts with "capture" and its path, so the edit page can show it by the editor. */
function captureOf(body, problems) {
  if (!('capture' in body)) return {};
  if (body.capture === null) return { capture: null };
  const { ok, errors } = validateCapture(body.capture);
  if (!ok) {
    problems.push(...errors.map((e) => `capture${e.path} ${e.message}`));
    return {};
  }
  return { capture: body.capture };
}

/** A photo's EXIF from the phone (x-exif: JSON, URI-encoded): the few facts the render side reads, checked and
    trimmed, or null. Never fails an upload: anything odd is just left out. */
function exifOf(header) {
  if (!header) return null;
  let raw;
  try {
    raw = JSON.parse(decodeURIComponent(header));
  } catch {
    return null;
  }
  if (!raw || typeof raw !== 'object') return null;
  const out = {};
  const num = (k, lo, hi) => {
    const v = Number(raw[k]);
    if (Number.isFinite(v) && v >= lo && v <= hi) out[k] = Math.round(v * 100) / 100;
  };
  num('focal35', 1, 2000);
  num('focal', 0.5, 2000);
  num('width', 1, 100000);
  num('height', 1, 100000);
  num('orientation', 1, 8);
  for (const k of ['make', 'model']) if (typeof raw[k] === 'string' && raw[k].trim()) out[k] = raw[k].trim().slice(0, 40);
  if (typeof raw.takenAt === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}([+-]\d{2}:\d{2}|Z)?$/.test(raw.takenAt)) out.takenAt = raw.takenAt;
  return Object.keys(out).length ? out : null;
}

/** A spot's or place's collection: { collectionId } (uuid or null). The collection need not exist yet: the outbox
    sends it first, but a capture never fails on it (as a room's building). */
function collectionLink(body, problems) {
  if (!('collectionId' in body)) return {};
  if (body.collectionId === null || isUuid(body.collectionId)) return { collectionId: body.collectionId };
  problems.push('collectionId must be a uuid (or null)');
  return {};
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
  Object.assign(next, buildingLink(body, problems), collectionLink(body, problems), captureOf(body, problems));
  if (spot.capture != null) Object.defineProperty(next, 'hadCapture', { value: true, enumerable: false });
  // Supabase: clearing a link must reach the row (putSpot only sends building_id / room_id / collection_id when there is one)
  if (spot.buildingId != null || spot.roomId != null) Object.defineProperty(next, 'hadBuilding', { value: true, enumerable: false });
  if (spot.collectionId != null) Object.defineProperty(next, 'hadCollection', { value: true, enumerable: false });
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
  if (!mediaKey(spotId, type, n, maxPhotosOf({ capture: { mode: 'freeform' } }))) return ctx.json({ error: `bad media name "${n}" for ${type}` }, 400);
  const spot = await ctx.store.getSpot(spotId);
  if (!spot) return ctx.json({ error: 'Spot not found (POST the spot before its media)' }, 404);
  // photos and thumbs: 1–12 (the shot guide), or 1–40 for a freeform spot (old photos)
  const key = mediaKey(spotId, type, n, maxPhotosOf(spot));
  if (!key) return ctx.json({ error: `bad media name "${n}" for ${type}: this spot takes photos 1–${maxPhotosOf(spot)}` }, 400);

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
  const exif = type === 'photo' ? exifOf(request.headers.get('x-exif')) : null;
  if (exif) media.exif = exif;
  const put = await ctx.store.putMedia(media);
  if (put?.droppedExif) delete media.exif; // the database can't keep it yet (memory_freeform.sql): say what was stored
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
  const grouped = collectionLink(body, problems);
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
    ...grouped,
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
  Object.assign(next, collectionLink(body, problems));
  if (b.collectionId != null) Object.defineProperty(next, 'hadCollection', { value: true, enumerable: false });
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

// ── collections: groups of spots and places (CONTRACTS.md section 7) ─────────

/** A collection's map frame: [[west, south], [east, north]] in degrees, or null (frame its spots). */
function boundsProblems(v) {
  if (v === null) return [];
  const ok =
    Array.isArray(v) && v.length === 2 && v.every((p) => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite)) &&
    v[0][0] >= -180 && v[1][0] <= 180 && v[0][1] >= -90 && v[1][1] <= 90 && v[0][0] <= v[1][0] && v[0][1] <= v[1][1];
  return ok ? [] : ['bounds must be [[west, south], [east, north]] in degrees (or null)'];
}

function collectionFields(body, problems, { partial = false } = {}) {
  const out = {};
  if (!partial || 'name' in body) {
    if (str(body.name, 1, 60)) out.name = body.name.trim();
    else problems.push('name must be 1–60 characters');
  }
  if ('sort' in body) {
    if (body.sort === null || Number.isInteger(body.sort)) out.sort = body.sort;
    else problems.push('sort must be a whole number (or null)');
  }
  if ('bounds' in body) {
    const p = boundsProblems(body.bounds);
    if (p.length) problems.push(...p);
    else out.bounds = body.bounds;
  }
  return out;
}

const bySort = (a, b) =>
  (a.sort ?? Infinity) - (b.sort ?? Infinity) || String(a.createdAt).localeCompare(String(b.createdAt)) || a.id.localeCompare(b.id);

async function collectionsRoute(ctx, request, id, sub) {
  const { json, store } = ctx;
  if (sub) return json({ error: 'Not found' }, 404);
  if (!id) {
    if (request.method === 'GET') return json({ data: (await store.listCollections()).sort(bySort) });
    if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
    const body = await ctx.readJson(request);
    if (!body || typeof body !== 'object') return json({ error: 'JSON body required' }, 400);
    const problems = [];
    if (!isUuid(body.id)) problems.push('id must be a uuid (the client generates it)');
    const fields = collectionFields(body, problems);
    if (problems.length) return json({ error: 'Invalid collection', details: problems }, 400);
    // create once: the outbox may send it again (that changes nothing)
    const existing = await store.getCollection(body.id);
    if (existing) return json({ data: existing }, 200);
    const c = { id: body.id, createdAt: ctx.now, updatedAt: ctx.now, sort: null, bounds: null, ...fields };
    await store.putCollection(c);
    return json({ data: (await store.getCollection(c.id)) || c }, 201);
  }
  if (!isUuid(id)) return json({ error: 'Not a collection id' }, 400);
  const c = await store.getCollection(id);
  if (!c) return json({ error: 'Collection not found' }, 404);
  if (request.method === 'GET') return json({ data: c });
  if (request.method === 'DELETE') {
    // the collection goes; its spots and places stay, ungrouped
    const ungrouped = await store.deleteCollection(id);
    return json({ data: { id, deleted: true, ungrouped } });
  }
  if (request.method !== 'PATCH') return json({ error: 'Method not allowed' }, 405);
  const body = await ctx.readJson(request);
  if (!body || typeof body !== 'object') return json({ error: 'JSON body required' }, 400);
  if ('ifUpdatedAt' in body && !sameInstant(body.ifUpdatedAt, c.updatedAt)) {
    return json({ error: 'This collection changed since the form opened', details: [`updatedAt is now ${c.updatedAt}`] }, 409);
  }
  const problems = [];
  const fields = collectionFields(body, problems, { partial: true });
  if (problems.length) return json({ error: 'Invalid change', details: problems }, 400);
  const next = { ...c, ...fields, updatedAt: ctx.now };
  await store.putCollection(next);
  return json({ data: (await store.getCollection(id)) || next });
}

// ── private share links (/memories/s/<token>) ────────────────────────────────

const SHARE_KINDS = ['building', 'spot'];
const SHARE_TOKEN = /^[A-Za-z0-9_-]{32}$/;
const shareKey = (token) => `shares/${token}.json`;
// what a shared place / room shows: the 3D (and a room's own photos, its viewpoints); never the location, the
// note, the sketch, the floor-plan photos, the compare sheets or who captured it
const SHARED_MEDIA = { building: ['model', 'render'], spot: ['photo', 'thumb', 'model', 'scan', 'render'] };
const SHARED_FIELDS = {
  building: ['id', 'title', 'status', 'placeLabel', 'capturedAt', 'plan', 'planVersion'],
  spot: ['id', 'kind', 'title', 'status', 'placeLabel', 'capturedAt', 'scene', 'sceneVersion', 'buildingId', 'roomId'],
};

function newShareToken() {
  const b = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_');
}

async function listShareRows(bucket) {
  const rows = [];
  let cursor;
  do {
    const page = await bucket.list({ prefix: 'shares/', cursor });
    rows.push(...(await Promise.all(page.objects.map(async (o) => (await bucket.get(o.key))?.json() ?? null))));
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return rows.filter(Boolean);
}

/** The thing a share opens, or null when it has gone (deleted, or never there). */
async function shareTarget(store, kind, id) {
  const row = kind === 'building' ? await store.getBuilding(id) : await store.getSpot(id);
  return row && !row.deletedAt ? row : null;
}

/** Behind the password: list, make and switch off share links. */
async function sharesRoute(ctx, request, url, token, sub) {
  const { json, env } = ctx;
  if (sub) return json({ error: 'Not found' }, 404);
  if (token) {
    if (request.method !== 'DELETE') return json({ error: 'Method not allowed' }, 405);
    if (!SHARE_TOKEN.test(token)) return json({ error: 'Not a share link' }, 400);
    await env.MEMORIES.delete(shareKey(token));
    return json({ data: { token, deleted: true } });
  }
  if (request.method === 'GET') {
    const kind = url.searchParams.get('kind');
    const id = url.searchParams.get('id');
    const rows = (await listShareRows(env.MEMORIES)).filter((s) => (!kind || s.kind === kind) && (!id || s.id === id));
    rows.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    return json({ data: rows });
  }
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const body = await ctx.readJson(request);
  const problems = [];
  if (!SHARE_KINDS.includes(body?.kind)) problems.push(`kind must be one of ${SHARE_KINDS.join(', ')}`);
  if (!isUuid(body?.id)) problems.push('id must be a uuid');
  if (body?.label != null && body.label !== '' && !str(body.label, 1, 60)) problems.push('label must be ≤ 60 characters');
  if (problems.length) return json({ error: 'Invalid share', details: problems }, 400);
  if (!(await shareTarget(ctx.store, body.kind, body.id))) return json({ error: body.kind === 'building' ? 'Building not found' : 'Spot not found' }, 404);
  const share = { token: newShareToken(), kind: body.kind, id: body.id, label: body.label ? String(body.label).trim() : null, createdAt: ctx.now };
  await env.MEMORIES.put(shareKey(share.token), JSON.stringify(share), { httpMetadata: { contentType: 'application/json' } });
  return json({ data: share }, 201);
}

/** NO password: GET /shared/:token → { kind, item } for that one place or room, trimmed, files signed. */
async function sharedRoute(request, env, token, sub, json) {
  const send = (body, status) => {
    const res = json(body, status);
    res.headers.set('cache-control', 'no-store');
    res.headers.set('x-robots-tag', 'noindex, nofollow');
    return res;
  };
  if (request.method !== 'GET') return send({ error: 'Method not allowed' }, 405);
  // one answer for every link that doesn't open: a bad token, a switched-off one, a deleted place
  const gone = () => send({ error: 'This link is switched off or does not exist' }, 404);
  if (sub || !token || !SHARE_TOKEN.test(token)) return gone();
  if (!env.MEMORIES) return send({ error: 'R2 binding MEMORIES is missing.' }, 503);
  const share = await (await env.MEMORIES.get(shareKey(token)))?.json();
  if (!share || !SHARE_KINDS.includes(share.kind)) return gone();
  const store = makeStore(env);
  if (store.error) return send({ error: store.error }, 503);
  const row = await shareTarget(store, share.kind, share.id);
  if (!row) return gone();
  const media = share.kind === 'building' ? await store.listBuildingMedia(row.id) : await store.listMedia(row.id);
  const item = Object.fromEntries(SHARED_FIELDS[share.kind].map((k) => [k, row[k] ?? null]));
  // the plan's geo is the house's exact lat/lng: the viewer doesn't need it
  if (item.plan?.geo) {
    item.plan = { ...item.plan };
    delete item.plan.geo;
  }
  const shown = media.filter((m) => SHARED_MEDIA[share.kind].includes(m.type));
  const ctx = { env };
  const withFiles = await attachMedia(ctx, item, shown);
  // a signed file row carries only what the viewer reads
  withFiles.media = withFiles.media.map(({ type, name, url: u, width, height, sort }) => ({ type, name, url: u, width, height, sort }));
  return send({ data: { kind: share.kind, item: withFiles } }, 200);
}

// ── media helpers ────────────────────────────────────────────────────────────

/** R2 key for a media upload (CONTRACTS.md §2), or null if `n` is not valid for the type (photos: 1–max). */
export function mediaKey(spotId, type, n, max = MAX_GUIDED_PHOTOS) {
  const base = `spots/${spotId}`;
  if (type === 'photo' || type === 'thumb') {
    if (!/^\d{1,2}$/.test(n || '') || Number(n) < 1 || Number(n) > max) return null;
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
  const collectionKey = (id) => `rows/collections/${id}.json`;

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
    hasCollections: async () => true,
    hasFreeform: async () => true,
    listCollections: async () => readAll(await listKeys('rows/collections/')),
    getCollection: async (id) => (await bucket.get(collectionKey(id)))?.json() ?? null,
    putCollection: (c) => put(collectionKey(c.id), c),
    /** Deletes the collection and ungroups its spots and places: → { spots, buildings } (how many). */
    deleteCollection: async (id) => {
      const counts = { spots: 0, buildings: 0 };
      for (const [prefix, which] of [['rows/spots/', 'spots'], ['rows/buildings/', 'buildings']]) {
        for (const row of await readAll(await listKeys(prefix))) {
          if (row.collectionId !== id) continue;
          await put(`${prefix}${row.id}.json`, { ...row, collectionId: null, updatedAt: new Date().toISOString() });
          counts[which] += 1;
        }
      }
      await bucket.delete(collectionKey(id));
      return counts;
    },
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
  buildingId: 'building_id', roomId: 'room_id', collectionId: 'collection_id', capture: 'capture',
};
const COLLECTION_COLS = { id: 'id', name: 'name', createdAt: 'created_at', updatedAt: 'updated_at', sort: 'sort', bounds: 'bounds' };
const BUILDING_COLS = {
  id: 'id', createdAt: 'created_at', updatedAt: 'updated_at', deletedAt: 'deleted_at', createdBy: 'created_by',
  title: 'title', note: 'note', lat: 'lat', lng: 'lng', locAccuracyM: 'loc_accuracy_m', placeLabel: 'place_label',
  locSource: 'loc_source', capturedAt: 'captured_at', status: 'status', sketch: 'sketch', plan: 'plan',
  planVersion: 'plan_version', tripStopId: 'trip_stop_id', collectionId: 'collection_id',
};
const BMEDIA_COLS = {
  id: 'id', buildingId: 'building_id', type: 'type', name: 'name', r2Key: 'r2_key', width: 'width', height: 'height',
  bytes: 'bytes', sort: 'sort', contentType: 'content_type', createdAt: 'created_at',
};
const MEDIA_COLS = {
  id: 'id', spotId: 'spot_id', type: 'type', name: 'name', r2Key: 'r2_key', width: 'width', height: 'height',
  bytes: 'bytes', sort: 'sort', contentType: 'content_type', createdAt: 'created_at', exif: 'exif',
};
const toRow = (obj, cols, skip = []) =>
  Object.fromEntries(Object.entries(cols).filter(([k]) => k in obj && !skip.includes(k)).map(([k, col]) => [col, obj[k]]));
const fromRow = (row, cols) => Object.fromEntries(Object.entries(cols).map(([k, col]) => [k, row[col] ?? null]));

// PostgREST / Postgres codes for a table or a column that isn't there (memory_buildings.sql not run yet)
const NEEDS_SQL = new Set(['42P01', '42703', 'PGRST204', 'PGRST205']);
const NEEDS_SQL_MESSAGE = 'Whole places need the database update first (supabase/memory_buildings.sql).';
const NEEDS_COLLECTIONS_MESSAGE = 'Collections need the database update first (supabase/memory_collections.sql).';
const NEEDS_FREEFORM_MESSAGE = 'Old-photo (freeform) spots need the database update first (supabase/memory_freeform.sql).';
let freeformProbe = { at: 0, ok: false };
let buildingsProbe = { at: 0, ok: false };
let collectionsProbe = { at: 0, ok: false };

function supabaseStore(db) {
  const failWith = (message) => ({ data, error }) => {
    if (error) {
      if (NEEDS_SQL.has(error.code)) throw Object.assign(new Error(message), { status: 503, code: 'needs-sql' });
      throw Object.assign(new Error(error.message), { status: 500 });
    }
    return data;
  };
  const check = failWith(NEEDS_SQL_MESSAGE);
  // a write that names collection_id (or a collections table call) before memory_collections.sql has run
  const checkC = failWith(NEEDS_COLLECTIONS_MESSAGE);
  const wantsCollection = (row) => row.collectionId != null || row.hadCollection;
  const checkF = failWith(NEEDS_FREEFORM_MESSAGE);
  const wantsCapture = (row) => row.capture != null || row.hadCapture;
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
      // collection_id / capture are only sent once a spot has one (or had one): spots save as ever before the SQL has run
      if (!wantsCollection(spot)) skip.push('collectionId');
      if (!wantsCapture(spot)) skip.push('capture');
      const res = await db.from('memory_spots').upsert(toRow(spot, SPOT_COLS, skip), { onConflict: 'id' });
      return (wantsCapture(spot) ? checkF : wantsCollection(spot) ? checkC : check)(res);
    },
    listMedia: async (spotId) => {
      let q = db.from('memory_media').select('*');
      if (spotId) q = q.eq('spot_id', spotId);
      return check(await q).map((r) => fromRow(r, MEDIA_COLS));
    },
    putMedia: async (m) => {
      const res = await db.from('memory_media').upsert(toRow(m, MEDIA_COLS, m.exif ? ['createdAt'] : ['createdAt', 'exif']), { onConflict: 'id' });
      // a photo's EXIF before memory_freeform.sql has run: the photo still saves, without it (never block an upload)
      if (res.error && m.exif && NEEDS_SQL.has(res.error.code)) {
        check(await db.from('memory_media').upsert(toRow(m, MEDIA_COLS, ['createdAt', 'exif']), { onConflict: 'id' }));
        return { droppedExif: true };
      }
      return check(res);
    },
    hasFreeform: async () => {
      if (Date.now() - freeformProbe.at < 60_000) return freeformProbe.ok;
      const { error } = await db.from('memory_spots').select('capture').limit(1);
      freeformProbe = { at: Date.now(), ok: !error };
      return freeformProbe.ok;
    },
    listBuildings: async () => check(await db.from('memory_buildings').select('*')).map((r) => fromRow(r, BUILDING_COLS)),
    getBuilding: async (id) => {
      const data = check(await db.from('memory_buildings').select('*').eq('id', id).maybeSingle());
      return data ? fromRow(data, BUILDING_COLS) : null;
    },
    putBuilding: async (b) => {
      const skip = ['updatedAt'];
      if (!wantsCollection(b)) skip.push('collectionId');
      const res = await db.from('memory_buildings').upsert(toRow(b, BUILDING_COLS, skip), { onConflict: 'id' });
      return (wantsCollection(b) ? checkC : check)(res);
    },
    hasCollections: async () => {
      if (Date.now() - collectionsProbe.at < 60_000) return collectionsProbe.ok;
      const { error } = await db.from('memory_collections').select('id').limit(1);
      collectionsProbe = { at: Date.now(), ok: !error };
      return collectionsProbe.ok;
    },
    listCollections: async () => checkC(await db.from('memory_collections').select('*')).map((r) => fromRow(r, COLLECTION_COLS)),
    getCollection: async (id) => {
      const data = checkC(await db.from('memory_collections').select('*').eq('id', id).maybeSingle());
      return data ? fromRow(data, COLLECTION_COLS) : null;
    },
    putCollection: async (c) => checkC(await db.from('memory_collections').upsert(toRow(c, COLLECTION_COLS, ['updatedAt']), { onConflict: 'id' })),
    deleteCollection: async (id) => {
      // ungroup first, then delete: a failure half-way leaves a collection with fewer members, never a dangling id
      const spots = checkC(await db.from('memory_spots').update({ collection_id: null }).eq('collection_id', id).select('id'));
      const buildings = checkC(await db.from('memory_buildings').update({ collection_id: null }).eq('collection_id', id).select('id'));
      checkC(await db.from('memory_collections').delete().eq('id', id));
      return { spots: spots?.length || 0, buildings: buildings?.length || 0 };
    },
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
