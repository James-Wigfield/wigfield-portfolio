/* Browser client for /api/dreams (CONTRACTS.md §2). The password typed at the gate is
   the bearer token; it lives in localStorage under `dr:token` (one device = one login).

   No password, or a wrong one, gets the same 404 on every route, ping included, so a
   404 from ping means "wrong password". A 404 from any other route is ambiguous (a
   missing dream, or the password changed): lib/auth.js re-pings to tell them apart. */

export const API_BASE = '/api/dreams';
const TOKEN_KEY = 'dr:token';

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

async function call(path, { method = 'GET', body, token = getToken(), signal } = {}) {
  const init = { method, headers: {}, signal, cache: 'no-store' };
  if (token) init.headers.authorization = `Bearer ${token}`;
  if (body !== undefined) {
    init.body = JSON.stringify(body);
    init.headers['content-type'] = 'application/json';
  }
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, init);
  } catch (err) {
    if (err?.name === 'AbortError') throw err;
    throw new ApiError(navigator.onLine === false ? 'offline' : 'network error', 0);
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

const one = (id) => `/${encodeURIComponent(id)}`;

export const api = {
  /** Checks a password (or the stored one): { ok, store, features }, or ApiError(404) when it's wrong. */
  ping: (token) => call('/ping', token === undefined ? {} : { token }),
  /** The lean list (archive order): [{ id, dreamt_on, night_order, status, title, first_words, still_key, split_from }]. */
  list: ({ signal } = {}) => call('', { signal }),
  /** The whole row plus `files: { model_url, still_url, stills, draft }`. */
  get: (id, { signal } = {}) => call(one(id), { signal }),
  /** Create once by client uuid: { id, dreamt_on, night_order?, raw_text, created_at? }. Safe to retry. */
  create: (row) => call('', { method: 'POST', body: row }),
  patch: (id, patch) => call(one(id), { method: 'PATCH', body: patch }),
};

/** A JSON file behind a signed URL (the draft's world.json). */
export async function fetchJson(url, { signal } = {}) {
  let res;
  try {
    res = await fetch(url, { signal, cache: 'no-store' });
  } catch (err) {
    if (err?.name === 'AbortError') throw err;
    throw new ApiError('network error', 0);
  }
  if (!res.ok) throw new ApiError(`HTTP ${res.status}`, res.status);
  return res.json();
}
