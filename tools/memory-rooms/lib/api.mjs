/* Node client for /api/memories (contract: src/memory-rooms/CONTRACTS.md §3).

   Reads MEMORIES_API (default http://127.0.0.1:8788) and MEMORIES_PASSWORD from
   the environment, falling back to the repo's .dev.vars (MEMORIES_PASSWORD, then
   PORTAL_PASSWORD). Deployed:  MEMORIES_API=https://<site> MEMORIES_PASSWORD=… node …
*/

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
export const WORK = path.join(REPO, 'memory-rooms-work');

function devVars() {
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
  const base = (process.env.MEMORIES_API || 'http://127.0.0.1:8788').replace(/\/+$/, '');
  const token = process.env.MEMORIES_PASSWORD || vars.MEMORIES_PASSWORD || vars.PORTAL_PASSWORD || '';
  if (!token) throw new Error('No password: set MEMORIES_PASSWORD (env or .dev.vars).');
  return { base, token };
}

export class ApiError extends Error {
  constructor(message, status, details) {
    super(details ? `${message}\n${JSON.stringify(details, null, 2)}` : message);
    this.status = status;
    this.details = details;
  }
}

export function client({ base, token } = config()) {
  async function call(p, { method = 'GET', body, headers = {} } = {}) {
    const init = { method, headers: { authorization: `Bearer ${token}`, ...headers } };
    if (body !== undefined) {
      if (Buffer.isBuffer(body) || body instanceof Uint8Array) init.body = body;
      else {
        init.body = JSON.stringify(body);
        init.headers['content-type'] = 'application/json';
      }
    }
    const res = await fetch(`${base}/api/memories${p}`, init);
    const text = await res.text();
    let payload = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = null;
    }
    if (!res.ok) throw new ApiError(`${method} ${p} → ${res.status} ${payload?.error || text.slice(0, 200)}`, res.status, payload?.details);
    return payload?.data;
  }

  return {
    base,
    ping: () => call('/ping'),
    listSpots: ({ deleted = false } = {}) => call(`/spots${deleted ? '?deleted=1' : ''}`),
    getSpot: (id) => call(`/spots/${id}`),
    saveSpot: (spot) => call('/spots', { method: 'POST', body: spot }),
    patchSpot: (id, patch) => call(`/spots/${id}`, { method: 'PATCH', body: patch }),
    deleteSpot: (id) => call(`/spots/${id}`, { method: 'DELETE' }),
    restoreSpot: (id) => call(`/spots/${id}/restore`, { method: 'POST' }),
    putMedia: (id, type, n, buf, { contentType, width, height } = {}) => {
      const headers = { 'content-type': contentType || 'application/octet-stream' };
      if (width) headers['x-width'] = String(width);
      if (height) headers['x-height'] = String(height);
      return call(`/spots/${id}/media/${type}/${encodeURIComponent(n)}`, { method: 'PUT', body: buf, headers });
    },
    /** Download a media item (its signed url, or any /api/memories/file/ path) to `dest`. */
    async download(media, dest) {
      const url = media.url.startsWith('http') ? media.url : `${base}${media.url}`;
      const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
      if (!res.ok) throw new ApiError(`download ${media.r2Key} → ${res.status}`, res.status);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
      return dest;
    },
  };
}

/** Resolve a spot's work folder, memory-rooms-work/<id>/. */
export const workDir = (id) => path.join(WORK, id);

export const BLENDER = process.env.BLENDER || 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe';
