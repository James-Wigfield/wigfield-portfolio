/* ============================================================================
   MEMORY ROOMS — server-side /api/memories/* routes
   ----------------------------------------------------------------------------
   Trip "memory spots": phone captures (photos + one line + location), later
   turned into Blender-built 3D rooms. Contract: src/memory-rooms/CONTRACTS.md §2–3.

     GET    /api/memories/ping                         → gate check
     GET    /api/memories/spots[?deleted=1]            → { data: [Spot…] }
     GET    /api/memories/spots/:id                    → { data: Spot }
     POST   /api/memories/spots                        → upsert by client uuid
     PATCH  /api/memories/spots/:id                    → edit; scene is validated + versioned
     DELETE /api/memories/spots/:id                    → soft delete
     POST   /api/memories/spots/:id/restore            → undo soft delete
     PUT    /api/memories/spots/:id/media/:type/:n     → raw bytes into R2 + media row
     GET    /api/memories/file/<r2Key>[?t=<exp>.<sig>] → the file (bearer OR signed token)

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

const PREFIX = '/api/memories/';
const MEDIA_TYPES = ['photo', 'thumb', 'scan', 'model', 'render', 'compare'];
const PEOPLE = ['james', 'justin'];
const STATUSES = ['captured', 'modelling', 'rendered'];
const KINDS = ['interior', 'exterior'];
const MB = 1024 * 1024;
const LIMITS = { photo: 15 * MB, thumb: 2 * MB, scan: 100 * MB, model: 40 * MB, render: 25 * MB, compare: 25 * MB };
const SIGN_WINDOW_S = 6 * 3600; // signed urls stay identical for a 6 h window (browser cache friendly)

export async function handleMemoriesApi(request, env, url, { json, readJson }) {
  const parts = url.pathname.slice(PREFIX.length).split('/').filter(Boolean).map(decodeURIComponent);
  const [section, id, sub, type, n] = parts;

  try {
    // Files accept a signed token instead of the bearer, so <img>, GLTFLoader and Spark can load them.
    if (section === 'file') return await serveFile(request, env, url, json);

    const denied = await checkAuth(request, env, json);
    if (denied) return denied;
    if (!env.MEMORIES) return json({ error: 'R2 binding MEMORIES is missing (wrangler.jsonc r2_buckets).' }, 503);

    const store = makeStore(env);
    if (store.error) return json({ error: store.error }, 503);
    const ctx = { env, store, json, now: new Date().toISOString() };

    if (section === 'ping') {
      if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);
      return json({ data: { ok: true, rowStore: store.kind } });
    }
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
    return json({ error: err?.message || String(err) }, err?.status || 500);
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

/** POST: create, or (retry / re-send) refresh the capture fields only. Never resets status/scene. */
async function upsertSpot(ctx, body) {
  if (!body || typeof body !== 'object') return ctx.json({ error: 'JSON body required' }, 400);
  const problems = [];
  if (!isUuid(body.id)) problems.push('id must be a uuid (the client generates it)');
  if (!PEOPLE.includes(body.createdBy)) problems.push(`createdBy must be one of ${PEOPLE.join(', ')}`);
  if (!KINDS.includes(body.kind)) problems.push(`kind must be one of ${KINDS.join(', ')}`);
  if (!str(body.title, 1, 120)) problems.push('title is required (≤ 120 characters)');
  if (!str(body.note, 1, 600)) problems.push('note is required (≤ 600 characters)');
  const capture = captureFields(body, problems);
  if (problems.length) return ctx.json({ error: 'Invalid spot', details: problems }, 400);

  const existing = await ctx.store.getSpot(body.id);
  if (existing) {
    const next = { ...existing, ...capture, updatedAt: ctx.now };
    await ctx.store.putSpot(next);
    return ctx.json({ data: await withMedia(ctx, next) }, 200);
  }
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
  };
  await ctx.store.putSpot(spot);
  return ctx.json({ data: await withMedia(ctx, spot) }, 201);
}

function captureFields(body, problems) {
  const out = {
    title: String(body.title || '').trim(),
    note: String(body.note || '').trim(),
    kind: body.kind,
    lat: numOrNull(body.lat),
    lng: numOrNull(body.lng),
    locAccuracyM: numOrNull(body.locAccuracyM),
    placeLabel: body.placeLabel ? String(body.placeLabel).slice(0, 120) : null,
    locSource: ['gps', 'pin', 'typed'].includes(body.locSource) ? body.locSource : null,
    scaleHint: body.scaleHint ? String(body.scaleHint).slice(0, 80) : null,
    capturedAt: isIsoDate(body.capturedAt) ? body.capturedAt : new Date().toISOString(),
  };
  if (out.lat !== null && (out.lat < -90 || out.lat > 90)) problems.push('lat out of range');
  if (out.lng !== null && (out.lng < -180 || out.lng > 180)) problems.push('lng out of range');
  if ((out.lat === null) !== (out.lng === null)) problems.push('lat and lng go together');
  return out;
}

async function patchSpot(ctx, id, body) {
  if (!body || typeof body !== 'object') return ctx.json({ error: 'JSON body required' }, 400);
  const spot = await ctx.store.getSpot(id);
  if (!spot) return ctx.json({ error: 'Spot not found' }, 404);

  const next = { ...spot };
  const problems = [];
  if ('title' in body) str(body.title, 1, 120) ? (next.title = body.title.trim()) : problems.push('title must be 1–120 characters');
  if ('note' in body) str(body.note, 1, 600) ? (next.note = body.note.trim()) : problems.push('note must be 1–600 characters');
  if ('kind' in body) KINDS.includes(body.kind) ? (next.kind = body.kind) : problems.push('bad kind');
  if ('status' in body) STATUSES.includes(body.status) ? (next.status = body.status) : problems.push(`status must be one of ${STATUSES.join(', ')}`);
  for (const k of ['lat', 'lng', 'locAccuracyM']) if (k in body) next[k] = numOrNull(body[k]);
  for (const k of ['placeLabel', 'scaleHint', 'tripStopId']) if (k in body) next[k] = body[k] == null ? null : String(body[k]).slice(0, 120);
  if ('frameGroup' in body) {
    if (body.frameGroup === null || /^[a-z0-9][a-z0-9-]{0,47}$/.test(body.frameGroup)) next.frameGroup = body.frameGroup;
    else problems.push('frameGroup must look like "home" or "nyc-hostel"');
  }
  if ('scene' in body) {
    if (body.scene === null) {
      next.scene = null;
    } else {
      const { ok, errors } = validateScene(body.scene);
      if (!ok) return ctx.json({ error: 'scene.json is invalid', details: errors }, 400);
      next.scene = body.scene;
      if (body.scene.frame?.group) next.frameGroup = body.scene.frame.group;
    }
    next.sceneVersion = (spot.sceneVersion || 0) + 1;
  }
  if (problems.length) return ctx.json({ error: 'Invalid change', details: problems }, 400);
  next.updatedAt = ctx.now;
  await ctx.store.putSpot(next);
  return ctx.json({ data: await withMedia(ctx, next) });
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
  if (!/^spots\/[0-9a-f-]{36}\/[a-z0-9/_.-]+$/i.test(key) || key.includes('..')) return json({ error: 'Bad file key' }, 400);

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

// ── media helpers ────────────────────────────────────────────────────────────

/** R2 key for a media upload (CONTRACTS.md §2), or null if `n` is not valid for the type. */
export function mediaKey(spotId, type, n) {
  const base = `spots/${spotId}`;
  if (type === 'photo' || type === 'thumb') {
    if (!/^\d{1,2}$/.test(n || '') || Number(n) < 1 || Number(n) > 12) return null;
    return `${base}/${type === 'photo' ? 'photos' : 'thumbs'}/${Number(n)}.jpg`;
  }
  if (type === 'scan') return `${base}/scan.spz`;
  if (type === 'model') return `${base}/model/room.glb`;
  if (!/^[a-z0-9][a-z0-9-]{0,40}$/.test(n || '')) return null;
  return type === 'render' ? `${base}/renders/${n}.png` : `${base}/compare/${n}.png`;
}

function mediaName(type, n) {
  if (type === 'photo' || type === 'thumb') return String(Number(n));
  if (type === 'scan') return 'scan';
  if (type === 'model') return 'room';
  return n;
}

async function withMedia(ctx, spot) {
  return attachMedia(ctx, spot, await ctx.store.listMedia(spot.id));
}

const TYPE_ORDER = Object.fromEntries(MEDIA_TYPES.map((t, i) => [t, i]));
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
  };
}

const SPOT_COLS = {
  id: 'id', createdAt: 'created_at', updatedAt: 'updated_at', deletedAt: 'deleted_at', createdBy: 'created_by',
  title: 'title', note: 'note', kind: 'kind', lat: 'lat', lng: 'lng', locAccuracyM: 'loc_accuracy_m',
  placeLabel: 'place_label', locSource: 'loc_source', scaleHint: 'scale_hint', capturedAt: 'captured_at',
  status: 'status', frameGroup: 'frame_group', scene: 'scene', sceneVersion: 'scene_version', tripStopId: 'trip_stop_id',
};
const MEDIA_COLS = {
  id: 'id', spotId: 'spot_id', type: 'type', name: 'name', r2Key: 'r2_key', width: 'width', height: 'height',
  bytes: 'bytes', sort: 'sort', contentType: 'content_type', createdAt: 'created_at',
};
const toRow = (obj, cols, skip = []) =>
  Object.fromEntries(Object.entries(cols).filter(([k]) => k in obj && !skip.includes(k)).map(([k, col]) => [col, obj[k]]));
const fromRow = (row, cols) => Object.fromEntries(Object.entries(cols).map(([k, col]) => [k, row[col] ?? null]));

function supabaseStore(db) {
  const check = ({ data, error }) => {
    if (error) throw Object.assign(new Error(error.message), { status: 500 });
    return data;
  };
  return {
    kind: 'supabase',
    listSpots: async () => check(await db.from('memory_spots').select('*')).map((r) => fromRow(r, SPOT_COLS)),
    getSpot: async (id) => {
      const data = check(await db.from('memory_spots').select('*').eq('id', id).maybeSingle());
      return data ? fromRow(data, SPOT_COLS) : null;
    },
    // updated_at is kept by the table's trigger.
    putSpot: async (spot) => check(await db.from('memory_spots').upsert(toRow(spot, SPOT_COLS, ['updatedAt']), { onConflict: 'id' })),
    listMedia: async (spotId) => {
      let q = db.from('memory_media').select('*');
      if (spotId) q = q.eq('spot_id', spotId);
      return check(await q).map((r) => fromRow(r, MEDIA_COLS));
    },
    putMedia: async (m) => check(await db.from('memory_media').upsert(toRow(m, MEDIA_COLS, ['createdAt']), { onConflict: 'id' })),
  };
}

// ── small helpers ────────────────────────────────────────────────────────────

const isUuid = (s) => typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
const str = (v, min, max) => typeof v === 'string' && v.trim().length >= min && v.trim().length <= max;
const isIsoDate = (v) => typeof v === 'string' && !Number.isNaN(Date.parse(v));
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
