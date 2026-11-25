/* Dream Rooms · Node client for /api/dreams (contract: src/dream-rooms/CONTRACTS.md §2).

   Reads DREAMS_API (default http://127.0.0.1:8796) and DREAMS_PASSWORD from the
   environment, falling back to the repo's .dev.vars (DREAMS_PASSWORD, then
   PORTAL_PASSWORD; never MEMORIES_PASSWORD, which can't open dreams).
   Deployed:  DREAMS_API=https://<site> DREAMS_PASSWORD=… node …

     import { api, ApiError, WORK } from './lib/api.mjs';
     const row = await api.get(id);           // the row + signed files
     await api.putFile(id, 'model/world-v2.glb', 'dream-rooms-work/<id>/out/world-v2.glb');

   Privacy (decision 14): errors carry the route, the status and the Worker's
   word-free message, never a request body. Node 24, global fetch. */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
export const WORK = path.join(REPO, 'dream-rooms-work');
export const DEFAULT_API = 'http://127.0.0.1:8796';

/** KEY=value lines of the repo's .dev.vars (empty when there is none). */
export function devVars() {
  try {
    const text = fs.readFileSync(path.join(REPO, '.dev.vars'), 'utf8');
    return Object.fromEntries(
      text
        .split(/\r?\n/)
        .filter((l) => /^[A-Z0-9_]+=/.test(l))
        .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim().replace(/^"|"$/g, '')]),
    );
  } catch {
    return {};
  }
}

export function config() {
  const vars = devVars();
  const base = (process.env.DREAMS_API || DEFAULT_API).replace(/\/+$/, '');
  const token = process.env.DREAMS_PASSWORD || vars.DREAMS_PASSWORD || vars.PORTAL_PASSWORD || '';
  if (!token) throw new Error('No password: set DREAMS_PASSWORD (env or .dev.vars).');
  return { base, token };
}

export class ApiError extends Error {
  constructor(message, status, details) {
    super(details ? `${message}\n${JSON.stringify(details, null, 2)}` : message);
    this.status = status;
    this.details = details;
  }
}

const TYPES = { glb: 'model/gltf-binary', webp: 'image/webp', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', json: 'application/json' };
export const contentTypeFor = (p) => TYPES[path.extname(String(p)).slice(1).toLowerCase()] || 'application/octet-stream';

/** A client bound to { base, token } (config() when left out). */
export function client(cfg) {
  let resolved = cfg || null;
  const conf = () => (resolved ||= config());

  async function call(p, { method = 'GET', body, headers = {} } = {}) {
    const { base, token } = conf();
    const init = { method, headers: { authorization: `Bearer ${token}`, ...headers } };
    if (body !== undefined) {
      if (Buffer.isBuffer(body) || body instanceof Uint8Array) init.body = body;
      else {
        init.body = JSON.stringify(body);
        init.headers['content-type'] = 'application/json';
      }
    }
    const res = await fetch(`${base}/api/dreams${p}`, init);
    const text = await res.text();
    let payload = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = null;
    }
    if (!res.ok) throw new ApiError(`${method} /api/dreams${p.replace(/\?.*$/, '')} → ${res.status} ${payload?.error || 'error'}`, res.status, payload?.details);
    return payload?.data;
  }

  /** An absolute url for a returned (relative) signed url. */
  const fileUrl = (signedUrl) => (/^https?:\/\//.test(signedUrl) ? signedUrl : `${conf().base}${signedUrl}`);

  return {
    get base() {
      return conf().base;
    },
    ping: () => call('/ping'),
    /** The lean list, archive order (dreamt_on, night_order), no deleted rows. */
    list: () => call(''),
    /** The whole row plus `files` (signed urls). */
    get: (id) => call(`/${id}`),
    /** Create once by client uuid: { id, dreamt_on, night_order?, raw_text, created_at? }. */
    create: (row) => call('', { method: 'POST', body: row }),
    patch: (id, patch) => call(`/${id}`, { method: 'PATCH', body: patch }),
    /** Cut a second dream off this one at the exact words that start it → { parent, child }. */
    split: (id, at) => call(`/${id}/split`, { method: 'POST', body: { at } }),
    /** PUT a file at dreams/<id>/<path> from a Buffer or a local file path. → { key, size, url } */
    putFile: (id, filePath, bufferOrPath, contentType) => {
      const buf = typeof bufferOrPath === 'string' ? fs.readFileSync(bufferOrPath) : bufferOrPath;
      const type = contentType || contentTypeFor(filePath);
      const p = filePath.split('/').map(encodeURIComponent).join('/');
      return call(`/${id}/file/${p}`, { method: 'PUT', body: buf, headers: { 'content-type': type } });
    },
    deleteDraft: (id) => call(`/${id}/file/draft`, { method: 'DELETE' }),
    /** Soft delete, or { purge: true } for good (→ { purged, work }: the caller deletes the local work folder). */
    remove: (id, { purge = false } = {}) => call(`/${id}${purge ? '?purge=1' : ''}`, { method: 'DELETE' }),
    fileUrl,
    /** Download a signed url (or any /api/dreams/file/ path) to `dest`; the bearer is sent too, so an expired link still works. */
    async download(signedUrl, dest) {
      const res = await fetch(fileUrl(signedUrl), { headers: { authorization: `Bearer ${conf().token}` } });
      if (!res.ok) throw new ApiError(`download → ${res.status}`, res.status);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
      return dest;
    },
  };
}

/** The default client (config() is read on the first call, not at import). */
export const api = client();

/** Does this Worker list `feature` in its ping? Scripts refuse to upload what it can't take. */
export async function supports(feature, c = api) {
  try {
    const f = (await c.ping())?.features;
    return Array.isArray(f) && f.includes(feature);
  } catch {
    return false;
  }
}

/** A dream's work folder, dream-rooms-work/<id>/. */
export const workDir = (id) => path.join(WORK, id);

/** True when the API host is this machine (seeding and destructive self-tests refuse anything else). */
export function isLocalApi(base) {
  try {
    return ['localhost', '127.0.0.1', '[::1]'].includes(new URL(base).hostname);
  } catch {
    return false;
  }
}
