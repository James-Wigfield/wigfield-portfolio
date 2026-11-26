/* ============================================================================
   SPECTA SELECTA API — the releases page's access to /api/specta-selecta/*
   ----------------------------------------------------------------------------
   Same pattern as papersApi: the portal password goes as a bearer token to the
   Worker (workers/specta-selecta.js), which holds the GitHub token. The update
   key the desktop app uses never reaches the browser; `testUpdate` asks the
   Worker to run the update route itself.

   NB: /api/* only exists when the Worker runs — `npm run cf:dev` locally or the
   deployed site. Plain `npm run dev` (vite) 404s here.

   Every function returns { data, error } (never throws).
   ========================================================================== */

import { getPortalKey } from '../auth';

const BASE = '/api/specta-selecta';

async function call(path, options = {}) {
  const key = getPortalKey();
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...options,
      headers: {
        ...(key ? { authorization: `Bearer ${key}` } : {}),
        ...(options.headers || {}),
      },
    });
  } catch (e) {
    return {
      data: null,
      error: { message: `Couldn’t reach the site’s API (${e.message}). It needs the Worker: run \`npm run cf:dev\` locally, or use the deployed site.` },
    };
  }

  let body = {};
  try { body = await res.json(); } catch { /* non-JSON error page */ }

  if (!res.ok) {
    return { data: null, error: { message: body.error || `Request failed (${res.status})`, status: res.status } };
  }
  return { data: body, error: null };
}

// → data: { configured: { updateKey, githubToken }, github: { ok, error? },
//           releases: [{ version, tag, publishedAt, notes, assets: [{ id, name, size, kind }] }] }
export function getStatus() {
  return call('/status');
}

// → data: { url }  — a fresh signed download link, valid for a few minutes.
export function getDownloadUrl(assetId) {
  return call(`/download/${encodeURIComponent(assetId)}`, { method: 'POST' });
}

// → data: { status, version, platforms, rewrittenOk, refusesNoKey, error? }
export function testUpdate() {
  return call('/test-update', { method: 'POST' });
}
