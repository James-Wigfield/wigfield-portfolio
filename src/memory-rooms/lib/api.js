/* Browser client for /api/memories (contract: src/memory-rooms/CONTRACTS.md §3).
   The password typed at the gate is the bearer token; it lives in localStorage
   under `mr:token` (one device = one login). */

export const API_BASE = '/api/memories';
const TOKEN_KEY = 'mr:token';

export class ApiError extends Error {
  constructor(message, status, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

function storage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function getToken() {
  try {
    return storage()?.getItem(TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

export function setToken(token) {
  try {
    if (token) storage()?.setItem(TOKEN_KEY, token);
    else storage()?.removeItem(TOKEN_KEY);
  } catch {
    /* private mode: the session still works until reload */
  }
}

async function call(path, { method = 'GET', body, headers = {}, token = getToken(), signal } = {}) {
  const init = { method, headers: { ...headers }, signal };
  if (token) init.headers.authorization = `Bearer ${token}`;
  if (body !== undefined) {
    if (body instanceof Blob || body instanceof ArrayBuffer) {
      init.body = body;
    } else {
      init.body = JSON.stringify(body);
      init.headers['content-type'] = 'application/json';
    }
  }
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, init);
  } catch (err) {
    throw new ApiError(navigator.onLine === false ? 'offline' : err.message || 'network error', 0);
  }
  const text = await res.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }
  if (!res.ok) throw new ApiError(payload?.error || `HTTP ${res.status}`, res.status, payload?.details);
  return payload?.data;
}

export const api = {
  /** Checks a password; resolves { ok, rowStore } or throws ApiError(401). */
  ping: (token) => call('/ping', { token }),
  listSpots: ({ deleted = false } = {}) => call(`/spots${deleted ? '?deleted=1' : ''}`),
  getSpot: (id) => call(`/spots/${encodeURIComponent(id)}`),
  /** Upsert by client uuid: safe to retry. */
  saveSpot: (spot) => call('/spots', { method: 'POST', body: spot }),
  patchSpot: (id, patch) => call(`/spots/${encodeURIComponent(id)}`, { method: 'PATCH', body: patch }),
  deleteSpot: (id) => call(`/spots/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  restoreSpot: (id) => call(`/spots/${encodeURIComponent(id)}/restore`, { method: 'POST' }),
  /** Raw upload of one file. type: photo|thumb|scan|model|render|compare; n: 1…12 or a name. */
  putMedia: (id, type, n, blob, { width, height, contentType, signal } = {}) => {
    const headers = { 'content-type': contentType || blob.type || 'application/octet-stream' };
    if (width) headers['x-width'] = String(Math.round(width));
    if (height) headers['x-height'] = String(Math.round(height));
    return call(`/spots/${encodeURIComponent(id)}/media/${type}/${encodeURIComponent(n)}`, { method: 'PUT', body: blob, headers, signal });
  },
};

/** Media helpers over a Spot's `media` array. */
export const mediaOf = (spot, type) => (spot?.media || []).filter((m) => m.type === type);
export const mediaNamed = (spot, type, name) => (spot?.media || []).find((m) => m.type === type && m.name === String(name)) || null;
