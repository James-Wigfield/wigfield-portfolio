/* ============================================================================
   PRESENTATIONS API — the Deck Studio's access to the `presentations` table
   ----------------------------------------------------------------------------
   Like feedbackApi (and unlike spritesApi), the `presentations` table has RLS ON
   with NO policies — the browser's anon key can't touch it. So everything goes
   through the Cloudflare Worker's /api/presentations routes, which use the SECRET
   key server-side. Each request carries the portal password (getPortalKey) as a
   bearer token; the Worker verifies it against its PORTAL_PASSWORD secret.

   NB: the /api/* layer only exists when the Worker is running — locally that's
   `npm run cf:dev` (wrangler), or the deployed site. Plain `npm run dev` (vite)
   has no Worker, so these routes 404 there and the Studio falls back to the
   built-in sample deck.

   Every function returns Supabase's { data, error } shape (never throws).
   ========================================================================== */

import { getPortalKey } from '../auth';

const BASE = '/api/presentations';

async function call(path, options = {}) {
  const key = getPortalKey();
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...options,
      headers: {
        ...(key ? { authorization: `Bearer ${key}` } : {}),
        ...(options.body ? { 'content-type': 'application/json' } : {}),
        ...(options.headers || {}),
      },
    });
  } catch (e) {
    return {
      data: null,
      error: { message: `Couldn’t reach the presentations API (${e.message}). The /api layer needs the Worker — run \`npm run cf:dev\` locally, or use the deployed site.` },
    };
  }

  let body = {};
  try { body = await res.json(); } catch { /* non-JSON error page */ }

  if (!res.ok) {
    return { data: null, error: { message: body.error || `Request failed (${res.status})` } };
  }
  return { data: body.data ?? null, error: null };
}

// List all decks (full rows — few enough that we load them in one go).
//   → data: [{ id, title, dateLabel, deck, updatedAt }]
export function listPresentations() {
  return call('');
}

// Fetch one deck by id.  → data: { id, title, dateLabel, deck, updatedAt }
export function getPresentation(id) {
  return call(`/${encodeURIComponent(id)}`);
}

// Create a deck.  payload: { title, dateLabel?, deck }   → data: { id }
export function createPresentation(payload) {
  return call('', { method: 'POST', body: JSON.stringify(payload) });
}

// Replace a deck (editor save).  payload: { title?, dateLabel?, deck }
export function updatePresentation(id, payload) {
  return call(`/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(payload) });
}

// Delete a deck.
export function deletePresentation(id) {
  return call(`/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
