/* ============================================================================
   DREAM ROOMS: server-side /api/dreams/* routes
   ----------------------------------------------------------------------------
   James's dreams: typed at 6 am, read by Claude, built in Blender, walked in the
   browser. Contract: src/dream-rooms/CONTRACTS.md §1 (the row) and §2 (this API).

     GET    /api/dreams/ping                  → { ok, store: 'r2', features }
     GET    /api/dreams                       → the lean list (corridor order, no deleted rows)
     POST   /api/dreams                       → create once by client uuid
     GET    /api/dreams/:id                   → the row + signed `files`
     PATCH  /api/dreams/:id                   → edit; dream / world validated + versioned
     DELETE /api/dreams/:id[?purge=1]         → soft delete, or gone for good (row + every file)
     POST   /api/dreams/:id/split             → { at } cut a second dream off this one
     PUT    /api/dreams/:id/file/<path>       → raw bytes into R2 (allow-listed paths)
     DELETE /api/dreams/:id/file/draft        → drop the draft build
     GET    /api/dreams/file/<key>?t=<exp>.<sig> → the file (signed token OR bearer)

   Private only (decision 11): every route needs DREAMS_PASSWORD or PORTAL_PASSWORD
   (never MEMORIES_PASSWORD: Justin has it). Anything without the password, on ANY
   route, real id or not, gets the same 404; a wrong password waits 600 ms first.
   Rows are JSON objects in the R2 bucket (decision 10): rows/dreams/<id>.json,
   files under dreams/<id>/. Binding DREAMS, bucket dream-rooms.

   Privacy (decision 14): nothing here logs, and no error message carries dream
   words: ids, paths, counts and field names only.
   ========================================================================== */

import { checkDream, checkWorld } from '../src/dream-rooms/contracts/validate.js';
import { ownText, ownSlice, firstWords, renumberNight, compareRows, UUID_RE, DATE_RE, STATUSES } from '../src/dream-rooms/contracts/rows.js';

const BASE = '/api/dreams';
const FEATURES = ['nights', 'split', 'draft', 'purge', 'corridor'];
const MB = 1024 * 1024;
const MAX_TEXT = 20000;
const MAX_JSON_BODY = 4 * MB; // a PATCH carrying dream.json + world.json is well under this
const WRONG_PASSWORD_DELAY_MS = 600;
const SIGN_WINDOW_S = 600; // signed urls are stable for 10 min and expire 50–60 min after issue (≤ 1 h)
const SIGN_MAX_S = 3600;
const ROWS = 'rows/dreams/';
const rowKey = (id) => `${ROWS}${id}.json`;
const filePrefix = (id) => `dreams/${id}/`;
const FILE_KEY_RE = /^dreams\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[a-z0-9/_.-]+$/;
const MOTIF_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const NAME = '[a-z0-9][a-z0-9_-]{0,63}';

/** The upload allow-list (CONTRACTS.md §2): path pattern → size limit + content type. */
const FILE_RULES = [
  { re: /^model\/world-v[1-9]\d{0,3}\.glb$/, max: 12 * MB },
  { re: new RegExp(`^stills/${NAME}\\.(webp|jpg|png)$`), max: 4 * MB },
  { re: /^draft\/world\.glb$/, max: 12 * MB },
  { re: /^draft\/world\.json$/, max: 1 * MB, world: true },
  { re: new RegExp(`^draft/stills/${NAME}\\.webp$`), max: 4 * MB },
];
const TYPES = { glb: 'model/gltf-binary', webp: 'image/webp', jpg: 'image/jpeg', png: 'image/png', json: 'application/json' };
const PATCHABLE = new Set([
  'ifUpdatedAt', 'raw_text', 'extra_text', 'dreamt_on', 'night_order', 'status', 'fail_reason', 'title',
  'dream', 'world', 'model_key', 'still_key', 'motifs', 'own',
]);

const NO_CACHE = { 'cache-control': 'private, no-store', 'x-robots-tag': 'noindex, nofollow' };
const NOT_FOUND = JSON.stringify({ error: 'Not found' });

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...NO_CACHE } });
}
/** The one 404: byte-identical for "no password", "wrong password", "no such id" and "no such file". */
const notFound = () => new Response(NOT_FOUND, { status: 404, headers: { 'content-type': 'application/json', ...NO_CACHE } });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export async function handleDreamsApi(request, env, url) {
  // Fail closed: no secret, no dreams.
  if (!env.DREAMS_PASSWORD && !env.PORTAL_PASSWORD) {
    return json({ error: 'Dream Rooms is not configured: set DREAMS_PASSWORD (or PORTAL_PASSWORD).' }, 503);
  }
  const rest = url.pathname === BASE ? '' : url.pathname.slice(BASE.length + 1);
  const parts = rest.split('/').filter(Boolean);

  try {
    // Files take a signed token (for <img>, GLTFLoader) or the bearer.
    if (parts[0] === 'file') return await serveFile(request, env, url, parts.slice(1).join('/'));

    const auth = await checkAuth(request, env);
    if (auth !== 'ok') return await deny(request, env, auth);
    if (!env.DREAMS) return json({ error: 'R2 binding DREAMS is missing (wrangler.jsonc r2_buckets, bucket dream-rooms).' }, 503);

    const ctx = { env, url, request };
    if (parts.length === 0) {
      if (request.method === 'GET') return await listRoute(ctx);
      if (request.method === 'POST') return await createRoute(ctx, await readBody(request));
      return json({ error: 'Method not allowed' }, 405);
    }
    if (parts[0] === 'ping') {
      if (parts.length !== 1) return notFound();
      if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);
      return json({ data: { ok: true, store: 'r2', features: FEATURES } });
    }
    const id = parts[0];
    if (!UUID_RE.test(id)) return notFound(); // nothing to find
    const sub = parts[1];

    if (!sub) {
      if (request.method === 'GET') return await getRoute(ctx, id);
      if (request.method === 'PATCH') return await patchRoute(ctx, id, await readBody(request));
      if (request.method === 'DELETE') return await deleteRoute(ctx, id, url.searchParams.get('purge') === '1');
      return json({ error: 'Method not allowed' }, 405);
    }
    if (sub === 'split' && parts.length === 2) {
      if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
      return await splitRoute(ctx, id, await readBody(request));
    }
    if (sub === 'file' && parts.length > 2) {
      const path = parts.slice(2).join('/');
      if (request.method === 'PUT') return await putFileRoute(ctx, id, path);
      if (request.method === 'DELETE') {
        if (path !== 'draft') return json({ error: 'Only the draft can be deleted (DELETE …/file/draft)' }, 400);
        return await deleteDraftRoute(ctx, id);
      }
      return json({ error: 'Method not allowed' }, 405);
    }
    return notFound();
  } catch (err) {
    if (err instanceof HttpError) return json({ error: err.message, ...(err.details ? { details: err.details } : {}) }, err.status);
    // Never echo request content: the message is the runtime's, not the body's.
    return json({ error: 'Server error', details: [String(err?.name || 'Error')] }, 500);
  }
}

// ── auth ─────────────────────────────────────────────────────────────────────

const enc = new TextEncoder();

/** 'ok' | 'none' (no bearer) | 'wrong' (a non-empty bearer that matches neither secret). */
async function checkAuth(request, env) {
  const provided = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!provided) return 'none';
  const secrets = [env.DREAMS_PASSWORD, env.PORTAL_PASSWORD].filter(Boolean);
  const mine = await digest(`dr:${provided}`);
  let match = false;
  // compare against every secret (no early exit), each in constant time
  for (const s of secrets) match = sameBytes(mine, await digest(`dr:${s}`)) || match;
  return match ? 'ok' : 'wrong';
}

/** The same 404 for everyone without the password; a wrong one waits first (decision 12). */
async function deny(request, env, auth) {
  if (auth === 'wrong') {
    // A Workers rate-limiting binding is used when one is configured; the wait applies either way.
    if (env.DREAMS_RATE_LIMIT?.limit) {
      try {
        await env.DREAMS_RATE_LIMIT.limit({ key: request.headers.get('cf-connecting-ip') || 'anon' });
      } catch {
        /* the wait below still applies */
      }
    }
    await sleep(WRONG_PASSWORD_DELAY_MS);
  }
  return notFound();
}

async function digest(text) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(text)));
}

function sameBytes(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

// ── signed file urls ─────────────────────────────────────────────────────────

const keyCache = new Map();
function signingKey(env) {
  const material = env.DREAMS_SIGNING_KEY || `dreams-derived|${env.DREAMS_PASSWORD || ''}|${env.PORTAL_PASSWORD || ''}`;
  if (!keyCache.has(material)) {
    keyCache.set(material, crypto.subtle.importKey('raw', enc.encode(material), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']));
  }
  return keyCache.get(material);
}

const b64url = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
function fromB64url(s) {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(s)) return null;
  try {
    const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4));
    return Uint8Array.from(bin, (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

/** `/api/dreams/file/<key>?t=<exp>.<sig>`; exp lands 50–60 min out (never more than 1 h). */
async function signedUrl(env, key) {
  if (!key) return null;
  const exp = (Math.floor(Date.now() / 1000 / SIGN_WINDOW_S) + SIGN_MAX_S / SIGN_WINDOW_S) * SIGN_WINDOW_S;
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', await signingKey(env), enc.encode(`${key}.${exp}`)));
  return `${BASE}/file/${key}?t=${exp}.${b64url(sig)}`;
}

async function verifyToken(env, key, token) {
  const m = /^(\d{1,12})\.([A-Za-z0-9_-]+)$/.exec(token || '');
  if (!m) return false;
  const exp = Number(m[1]);
  const now = Date.now() / 1000;
  if (exp < now || exp > now + SIGN_MAX_S + 60) return false; // expired, or a lifetime this Worker never issues
  const sig = fromB64url(m[2]);
  if (!sig) return false;
  return crypto.subtle.verify('HMAC', await signingKey(env), sig, enc.encode(`${key}.${exp}`)); // constant time
}

async function serveFile(request, env, url, key) {
  let ok = FILE_KEY_RE.test(key) && !key.includes('..') && !key.includes('//');
  const token = url.searchParams.get('t');
  if (ok && token) ok = await verifyToken(env, key, token);
  if (!ok || !token) {
    // no (good) token: the bearer works instead
    const auth = await checkAuth(request, env);
    if (auth !== 'ok') return deny(request, env, auth);
    if (!FILE_KEY_RE.test(key) || key.includes('..') || key.includes('//')) return notFound();
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') return json({ error: 'Method not allowed' }, 405);
  if (!env.DREAMS) return json({ error: 'R2 binding DREAMS is missing (wrangler.jsonc r2_buckets, bucket dream-rooms).' }, 503);
  const obj = await env.DREAMS.get(key);
  if (!obj) return notFound();
  const headers = new Headers({
    'content-type': obj.httpMetadata?.contentType || typeFor(key) || 'application/octet-stream',
    'content-length': String(obj.size),
    etag: obj.httpEtag,
    ...NO_CACHE,
  });
  return new Response(request.method === 'HEAD' ? null : obj.body, { headers });
}

// ── the row store (R2) ───────────────────────────────────────────────────────

async function getRow(env, id) {
  const obj = await env.DREAMS.get(rowKey(id));
  return obj ? obj.json() : null;
}

/** customMetadata lets one night's live rows be found without reading every row. */
function putRow(env, row) {
  return env.DREAMS.put(rowKey(row.id), JSON.stringify(row), {
    httpMetadata: { contentType: 'application/json' },
    customMetadata: { dreamt_on: row.dreamt_on, deleted: row.deleted_at ? '1' : '0' },
  });
}

async function listObjects(env, prefix, include) {
  const out = [];
  let cursor;
  do {
    const page = await env.DREAMS.list({ prefix, cursor, ...(include ? { include } : {}) });
    out.push(...page.objects);
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return out;
}

async function readRows(env, keys) {
  const rows = await Promise.all(keys.map(async (k) => (await env.DREAMS.get(k))?.json()));
  return rows.filter(Boolean);
}

async function allRows(env) {
  return readRows(env, (await listObjects(env, ROWS)).map((o) => o.key));
}

/** One night's live rows (customMetadata first, so only that night's objects are read). */
async function nightRows(env, night) {
  const objs = await listObjects(env, ROWS, ['customMetadata']);
  const keys = objs.filter((o) => !o.customMetadata?.dreamt_on || (o.customMetadata.dreamt_on === night && o.customMetadata.deleted !== '1')).map((o) => o.key);
  return (await readRows(env, keys)).filter((r) => r.dreamt_on === night && !r.deleted_at);
}

/**
 * Renumber one night 1..n (CONTRACTS.md §2 "Night renumbering"). `mine` = the rows the
 * caller is about to write: their in-memory versions replace the stored ones (or are left
 * out when they no longer belong to this night), they are only mutated here, and the
 * caller writes them. `moved` = { id, to } puts that row at position `to` first.
 * Other rows whose number changes are written here, with their updated_at left alone:
 * it's bookkeeping, and an open edit form on a sibling shouldn't 409 because of it.
 */
async function settleNight(env, night, { mine = [], moved = null } = {}) {
  const ids = new Set(mine.map((r) => r.id));
  const rows = [
    ...(await nightRows(env, night)).filter((r) => !ids.has(r.id)),
    ...mine.filter((r) => r.dreamt_on === night && !r.deleted_at),
  ];
  const changes = renumberNight(rows, moved);
  const byId = new Map(rows.map((r) => [r.id, r]));
  const writes = [];
  for (const c of changes) {
    const r = byId.get(c.id);
    r.night_order = c.night_order;
    if (!ids.has(r.id)) writes.push(putRow(env, r));
  }
  await Promise.all(writes);
}

/** updated_at strictly increases, so ifUpdatedAt catches two saves in the same millisecond. */
function nextStamp(prev) {
  const now = Date.now();
  const before = Date.parse(prev || '') || 0;
  return new Date(Math.max(now, before + 1)).toISOString();
}

// ── routes ───────────────────────────────────────────────────────────────────

async function readBody(request) {
  const declared = Number(request.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > MAX_JSON_BODY) throw new HttpError(413, `Body larger than ${MAX_JSON_BODY / MB} MB`);
  const text = await request.text();
  if (text.length > MAX_JSON_BODY) throw new HttpError(413, `Body larger than ${MAX_JSON_BODY / MB} MB`);
  if (!text) throw new HttpError(400, 'JSON body required');
  try {
    const body = JSON.parse(text);
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('not an object');
    return body;
  } catch {
    throw new HttpError(400, 'Body must be a JSON object');
  }
}

async function listRoute({ env }) {
  const rows = (await allRows(env)).filter((r) => !r.deleted_at).sort(compareRows);
  const data = rows.map((r) => ({
    id: r.id,
    dreamt_on: r.dreamt_on,
    night_order: r.night_order,
    status: r.status,
    title: r.title ?? null,
    first_words: firstWords(ownText(r)),
    still_key: r.still_key ?? null,
    split_from: r.split_from ?? null,
  }));
  return json({ data });
}

async function createRoute({ env }, body) {
  const problems = [];
  if (typeof body.id !== 'string' || !UUID_RE.test(body.id)) problems.push('id: must be a lower-case uuid (the client makes it)');
  if (!isDate(body.dreamt_on)) problems.push('dreamt_on: must be a real YYYY-MM-DD date');
  if (typeof body.raw_text !== 'string' || !body.raw_text.trim()) problems.push('raw_text: required (a non-empty string)');
  else if (body.raw_text.length > MAX_TEXT) problems.push(`raw_text: at most ${MAX_TEXT} characters`);
  if (body.night_order !== undefined && body.night_order !== null && !(Number.isInteger(body.night_order) && body.night_order >= 1)) problems.push('night_order: an integer ≥ 1');
  if (body.created_at !== undefined && body.created_at !== null && !isIsoDateTime(body.created_at)) problems.push('created_at: an ISO date-time with a zone');
  if (problems.length) return json({ error: 'Invalid dream', details: problems }, 400);

  // Create once: a re-send (an outbox retry) changes nothing and returns the stored row.
  const existing = await getRow(env, body.id);
  if (existing) return json({ data: existing }, 200);

  const now = new Date().toISOString();
  const created = body.created_at ? new Date(Math.min(Date.parse(body.created_at), Date.now())).toISOString() : now;
  const row = {
    id: body.id,
    created_at: created,
    updated_at: now,
    dreamt_on: body.dreamt_on,
    night_order: body.night_order || 1e6,
    raw_text: body.raw_text,
    extra_text: null,
    own: null,
    split_from: null,
    split_into: [],
    visibility: 'private',
    status: 'captured',
    status_at: now,
    fail_reason: null,
    title: null,
    dream: null,
    dream_version: 0,
    world: null,
    world_version: 0,
    model_key: null,
    still_key: null,
    motifs: [],
    deleted_at: null,
  };
  // no night_order → the end of the night; a number → that position (later rows shift along)
  await settleNight(env, row.dreamt_on, { mine: [row], moved: { id: row.id, to: body.night_order || Infinity } });
  await putRow(env, row);
  return json({ data: row }, 201);
}

async function getRoute({ env }, id) {
  const row = await getRow(env, id);
  if (!row) return notFound();
  return json({ data: { ...row, files: await filesOf(env, row) } });
}

/** Signed urls for a row's files, listed from R2 (no media table). */
async function filesOf(env, row) {
  const [stillObjs, draftObjs] = await Promise.all([
    listObjects(env, `${filePrefix(row.id)}stills/`),
    listObjects(env, `${filePrefix(row.id)}draft/`),
  ]);
  const named = async (objs) =>
    Promise.all(objs.sort((a, b) => a.key.localeCompare(b.key)).map(async (o) => ({ name: o.key.split('/').pop().replace(/\.[a-z0-9]+$/, ''), url: await signedUrl(env, o.key) })));
  let draft = null;
  if (draftObjs.length) {
    const has = (p) => draftObjs.some((o) => o.key === `${filePrefix(row.id)}draft/${p}`);
    draft = {
      world_url: has('world.json') ? await signedUrl(env, `${filePrefix(row.id)}draft/world.json`) : null,
      model_url: has('world.glb') ? await signedUrl(env, `${filePrefix(row.id)}draft/world.glb`) : null,
      stills: await named(draftObjs.filter((o) => o.key.startsWith(`${filePrefix(row.id)}draft/stills/`))),
    };
  }
  return {
    model_url: await signedUrl(env, row.model_key),
    still_url: await signedUrl(env, row.still_key),
    stills: await named(stillObjs),
    draft,
  };
}

async function patchRoute({ env }, id, body) {
  const row = await getRow(env, id);
  if (!row || row.deleted_at) return notFound();

  const unknown = Object.keys(body).filter((k) => !PATCHABLE.has(k) && !(k === 'id' && body.id === id));
  if (unknown.length) return json({ error: 'Invalid change', details: unknown.map((k) => `${k}: not a field you can change`) }, 400);
  if ('ifUpdatedAt' in body && !sameInstant(body.ifUpdatedAt, row.updated_at)) {
    return json({ error: 'This dream changed since you loaded it', details: [`updated_at is now ${row.updated_at}`] }, 409);
  }

  const next = { ...row, split_into: [...(row.split_into || [])], motifs: [...(row.motifs || [])] };
  const problems = [];

  if ('raw_text' in body && body.raw_text !== row.raw_text) {
    if (row.status !== 'captured') return json({ error: 'raw_text is frozen', details: [`status is ${row.status}; add to extra_text instead`] }, 409);
    if (row.split_from || row.split_into?.length) return json({ error: 'raw_text is frozen', details: ['this dream was split; its text is fixed'] }, 409);
    if (typeof body.raw_text !== 'string' || !body.raw_text.trim()) problems.push('raw_text: a non-empty string');
    else if (body.raw_text.length > MAX_TEXT) problems.push(`raw_text: at most ${MAX_TEXT} characters`);
    else next.raw_text = body.raw_text;
  }
  if ('extra_text' in body) {
    if (body.extra_text === null || body.extra_text === '') next.extra_text = null;
    else if (typeof body.extra_text !== 'string') problems.push('extra_text: a string or null');
    else if (body.extra_text.length > MAX_TEXT) problems.push(`extra_text: at most ${MAX_TEXT} characters`);
    else next.extra_text = body.extra_text;
  }
  if ('own' in body) {
    const o = body.own;
    if (o === null) next.own = null;
    else if (Array.isArray(o) && o.length === 2 && o.every(Number.isInteger) && o[0] >= 0 && o[0] < o[1] && o[1] <= next.raw_text.length) next.own = [o[0], o[1]];
    else problems.push('own: [start, end] inside raw_text, or null');
  }
  if ('dreamt_on' in body && !isDate(body.dreamt_on)) problems.push('dreamt_on: must be a real YYYY-MM-DD date');
  if ('night_order' in body && !(Number.isInteger(body.night_order) && body.night_order >= 1)) problems.push('night_order: an integer ≥ 1');
  if ('status' in body) {
    if (!STATUSES.includes(body.status)) problems.push(`status: one of ${STATUSES.join(', ')}`);
    else if (body.status !== row.status) {
      next.status = body.status;
      next.status_at = new Date().toISOString();
    }
  }
  if ('fail_reason' in body) {
    if (body.fail_reason === null || body.fail_reason === '') next.fail_reason = null;
    else if (typeof body.fail_reason !== 'string' || body.fail_reason.length > 300) problems.push('fail_reason: one line, at most 300 characters, or null');
    else next.fail_reason = body.fail_reason.replace(/\s*[\r\n]+\s*/g, ' ').trim();
  }
  if ('title' in body) {
    if (body.title === null || body.title === '') next.title = null;
    else if (typeof body.title !== 'string' || body.title.trim().length > 200) problems.push('title: at most 200 characters, or null');
    else next.title = body.title.trim();
  }
  if ('motifs' in body) {
    if (Array.isArray(body.motifs) && body.motifs.length <= 64 && body.motifs.every((m) => typeof m === 'string' && MOTIF_RE.test(m) && m.length <= 60)) next.motifs = [...body.motifs];
    else problems.push('motifs: lower-case-hyphenated strings (at most 64)');
  }
  for (const [field, dir] of [['model_key', 'model'], ['still_key', 'stills']]) {
    if (!(field in body)) continue;
    const k = body[field];
    if (k === null) next[field] = null;
    else if (typeof k !== 'string' || !k.startsWith(`${filePrefix(id)}${dir}/`) || !FILE_KEY_RE.test(k) || !ruleFor(k.slice(filePrefix(id).length))) problems.push(`${field}: a key under ${filePrefix(id)}${dir}/ (or null)`);
    else if (!(await env.DREAMS.head(k))) problems.push(`${field}: no such file (upload it first)`);
    else next[field] = k;
  }
  if (problems.length) return json({ error: 'Invalid change', details: problems }, 400);

  // the contracts, checked against the text as it will be after this patch
  const text = ownText(next);
  if ('dream' in body) {
    if (body.dream === null) next.dream = null;
    else {
      const r = checkDream(body.dream, text);
      if (!r.ok) return json({ error: 'dream.json is invalid', details: r.errors }, 400);
      next.dream = body.dream;
      next.motifs = Array.isArray(body.dream.motifs) ? [...body.dream.motifs] : [];
    }
    if (JSON.stringify(next.dream) !== JSON.stringify(row.dream)) next.dream_version = (row.dream_version || 0) + 1;
  }
  if ('world' in body) {
    if (body.world === null) next.world = null;
    else {
      const errors = worldErrors(body.world, next.dream, text);
      if (errors.length) return json({ error: 'world.json is invalid', details: errors }, 400);
      next.world = body.world;
    }
    if (JSON.stringify(next.world) !== JSON.stringify(row.world)) next.world_version = (row.world_version || 0) + 1;
  }

  // nights
  const movedNight = 'dreamt_on' in body && body.dreamt_on !== row.dreamt_on;
  if (movedNight) {
    next.dreamt_on = body.dreamt_on;
    // to the end of its new night (or to night_order when that's sent too); then the old night closes up
    await settleNight(env, next.dreamt_on, { mine: [next], moved: { id, to: 'night_order' in body ? body.night_order : Infinity } });
    await settleNight(env, row.dreamt_on, { mine: [next] });
  } else if ('night_order' in body && body.night_order !== row.night_order) {
    await settleNight(env, next.dreamt_on, { mine: [next], moved: { id, to: body.night_order } });
  }

  next.updated_at = nextStamp(row.updated_at);
  await putRow(env, next);
  return json({ data: next });
}

function worldErrors(world, dream, text) {
  if (!world || typeof world !== 'object' || Array.isArray(world)) return ['$: must be an object'];
  if (world.kind === 'corridor') return ['$.kind: a corridor world is made at runtime and never stored'];
  // no dream yet (fixtures, a hand-made world): schema and structure only
  const r = dream ? checkWorld(world, { dream, text }) : checkWorld(world, {});
  return r.ok ? [] : r.errors;
}

async function splitRoute({ env }, id, body) {
  const row = await getRow(env, id);
  if (!row || row.deleted_at) return notFound();
  if (row.status !== 'captured' && row.status !== 'reading') {
    return json({ error: 'Only a captured or reading dream can be split', details: [`status is ${row.status}`] }, 409);
  }
  const at = body.at;
  if (typeof at !== 'string' || !at.trim()) return json({ error: 'at: the exact words that start the second dream' }, 400);

  const slice = ownSlice(row);
  const start = Array.isArray(row.own) ? row.own[0] : 0;
  const end = Array.isArray(row.own) ? row.own[1] : row.raw_text.length;
  const i = slice.indexOf(at);
  if (i < 0) return json({ error: 'at: not found in this dream\'s own text (copy the words exactly)' }, 400);
  if (slice.indexOf(at, i + 1) >= 0) return json({ error: 'at: occurs more than once in this dream\'s own text (give more words)' }, 400);
  if (!slice.slice(0, i).trim()) return json({ error: 'at: starts this dream\'s own text, so nothing would be left before it' }, 400);

  const cut = start + i;
  const now = new Date().toISOString();
  const child = {
    id: crypto.randomUUID(),
    created_at: now,
    updated_at: now,
    dreamt_on: row.dreamt_on,
    night_order: row.night_order + 1,
    raw_text: row.raw_text.slice(cut, end),
    extra_text: null,
    own: null,
    split_from: row.id,
    split_into: [],
    visibility: 'private',
    status: 'captured',
    status_at: now,
    fail_reason: null,
    title: null,
    dream: null,
    dream_version: 0,
    world: null,
    world_version: 0,
    model_key: null,
    still_key: null,
    motifs: [],
    deleted_at: null,
  };
  const parent = { ...row, own: [start, cut], split_into: [...(row.split_into || []), child.id], updated_at: nextStamp(row.updated_at) };

  // the child goes right after its parent; later dreams that night shift along
  await settleNight(env, row.dreamt_on, { mine: [parent, child], moved: { id: child.id, to: row.night_order + 1 } });
  await putRow(env, child);
  await putRow(env, parent);
  return json({ data: { parent, child } }, 201);
}

async function deleteRoute({ env }, id, purge) {
  const row = await getRow(env, id);
  if (!purge) {
    if (!row) return notFound();
    if (!row.deleted_at) {
      const next = { ...row, deleted_at: new Date().toISOString(), updated_at: nextStamp(row.updated_at) };
      await putRow(env, next);
      await settleNight(env, row.dreamt_on, { mine: [next] }); // the night closes up without it
      return json({ data: { id, deleted_at: next.deleted_at } });
    }
    return json({ data: { id, deleted_at: row.deleted_at } });
  }

  // purge: the row and every file, for good
  const files = (await listObjects(env, filePrefix(id))).map((o) => o.key);
  if (!row && !files.length) return notFound();
  for (let i = 0; i < files.length; i += 1000) await env.DREAMS.delete(files.slice(i, i + 1000));
  if (row) {
    await env.DREAMS.delete(rowKey(id));
    if (!row.deleted_at) await settleNight(env, row.dreamt_on);
  }
  return json({ data: { purged: true, id, files: files.length, work: `dream-rooms-work/${id}/` } });
}

function ruleFor(path) {
  if (path.includes('..') || path.includes('//')) return null;
  return FILE_RULES.find((r) => r.re.test(path)) || null;
}
const typeFor = (key) => TYPES[(/\.([a-z0-9]+)$/.exec(key) || [])[1]] || null;

async function putFileRoute({ env, request }, id, path) {
  const rule = ruleFor(path);
  if (!rule) {
    return json({ error: 'File path not allowed', details: ['model/world-v<N>.glb', 'stills/<name>.webp|jpg|png', 'draft/world.glb', 'draft/world.json', 'draft/stills/<name>.webp'] }, 400);
  }
  const row = await getRow(env, id);
  if (!row || row.deleted_at) return notFound();
  const key = `${filePrefix(id)}${path}`;
  const contentType = typeFor(path);
  const tooBig = () => json({ error: `File larger than ${rule.max / MB} MB` }, 413);

  const declared = Number(request.headers.get('content-length'));
  const known = request.headers.has('content-length') && Number.isFinite(declared) && declared > 0;
  if (known && declared > rule.max) return tooBig();

  if (rule.world) {
    // draft/world.json: validated exactly as a PATCH of `world` would be
    const buf = await request.arrayBuffer();
    if (buf.byteLength > rule.max) return tooBig();
    let world;
    try {
      world = JSON.parse(new TextDecoder().decode(buf));
    } catch {
      return json({ error: 'draft/world.json is not JSON' }, 400);
    }
    const errors = worldErrors(world, row.dream, ownText(row));
    if (errors.length) return json({ error: 'world.json is invalid', details: errors }, 400);
    await env.DREAMS.put(key, buf, { httpMetadata: { contentType } });
    return json({ data: { key, size: buf.byteLength, url: await signedUrl(env, key) } });
  }

  // stream straight into R2 when the length is known; otherwise buffer (and check) first
  let body = known ? request.body : await request.arrayBuffer();
  if (!known && body.byteLength > rule.max) return tooBig();
  if (!known && body.byteLength === 0) return json({ error: 'Empty file' }, 400);
  if (!body) body = new ArrayBuffer(0);
  const obj = await env.DREAMS.put(key, body, { httpMetadata: { contentType } });
  if (obj.size > rule.max) {
    await env.DREAMS.delete(key);
    return tooBig();
  }
  return json({ data: { key, size: obj.size, url: await signedUrl(env, key) } });
}

async function deleteDraftRoute({ env }, id) {
  const row = await getRow(env, id);
  if (!row) return notFound();
  const keys = (await listObjects(env, `${filePrefix(id)}draft/`)).map((o) => o.key);
  for (let i = 0; i < keys.length; i += 1000) await env.DREAMS.delete(keys.slice(i, i + 1000));
  return json({ data: { id, deleted: keys.length } });
}

// ── helpers ──────────────────────────────────────────────────────────────────

function isDate(v) {
  if (typeof v !== 'string' || !DATE_RE.test(v)) return false;
  const [y, m, d] = v.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

function isIsoDateTime(v) {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,6})?)?(Z|[+-]\d{2}:\d{2})$/.test(v) && Number.isFinite(Date.parse(v));
}

function sameInstant(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const x = Date.parse(a);
  const y = Date.parse(b);
  return Number.isFinite(x) && x === y;
}
