/* ============================================================================
   FEEDBACK API — the portal's read access to Syllabite feedback submissions
   ----------------------------------------------------------------------------
   Unlike spritesApi (which reads Supabase directly with the anon key), the
   `syllabite_feedback` table has RLS ON with NO policies — the anon key can't
   read it. So this goes through the Cloudflare Worker's /api/syllabite-feedback
   route, which reads with the SECRET key server-side. The request carries the
   portal password (getPortalKey) as a bearer token; the Worker verifies it
   against its PORTAL_PASSWORD secret.

   NB: the /api/* layer only exists when the Worker is running — locally that's
   `npm run cf:dev` (wrangler), or the deployed site. Plain `npm run dev` (vite)
   has no Worker, so this route 404s there.

   Returns Supabase's { data, error } shape (never throws).
   ========================================================================== */

import { getPortalKey } from '../auth';

export async function listSyllabiteFeedback() {
  const key = getPortalKey();

  let res;
  try {
    res = await fetch('/api/syllabite-feedback', {
      headers: key ? { authorization: `Bearer ${key}` } : {},
    });
  } catch (e) {
    return {
      data: null,
      error: { message: `Couldn’t reach the feedback API (${e.message}). The /api layer needs the Worker — run \`npm run cf:dev\` locally, or use the deployed site.` },
    };
  }

  let body = {};
  try { body = await res.json(); } catch { /* non-JSON error page */ }

  if (!res.ok) {
    return { data: null, error: { message: body.error || `Request failed (${res.status})` } };
  }
  return { data: body.data ?? [], error: null };
}
