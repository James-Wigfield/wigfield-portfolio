/* ============================================================================
   CLOUDFLARE WORKER — entry point
   ----------------------------------------------------------------------------
   One deploy unit that does two jobs:
     1. Serves the built Vite SPA (./dist) via the ASSETS binding. Real files are
        served directly; any other path falls back to index.html so client-side
        routing (react-router-dom) works. (Configured in wrangler.jsonc.)
     2. Hosts a server-side /api/* layer. Code here runs ON THE SERVER, so it can
        use SECRET keys (Supabase service-role, third-party API tokens) that must
        never ship to the browser. The Worker runs first for every request
        (`run_worker_first: true`), so /api/* always hits this handler.

   Env values come from wrangler.jsonc `vars` (non-secret, e.g. SUPABASE_URL) and
   from Wrangler secrets / .dev.vars (secret, e.g. SUPABASE_SECRET_KEY,
   PORTAL_PASSWORD).
   ========================================================================== */

import { createClient } from '@supabase/supabase-js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/')) {
      return handleApi(request, env, url);
    }

    // Everything else = the static site: env.ASSETS serves real files, and any
    // non-file route falls back to index.html for client-side routing.
    return env.ASSETS.fetch(request);
  },
};

// ── /api/* router ────────────────────────────────────────────────────────────
async function handleApi(request, env, url) {
  // Health check — confirms the Worker is live and whether Supabase is wired up.
  //   GET /api/health  →  { ok: true, supabaseConfigured: true|false }
  if (url.pathname === '/api/health') {
    return json({
      ok: true,
      supabaseConfigured: Boolean(env.SUPABASE_URL && env.SUPABASE_SECRET_KEY),
    });
  }

  // Syllabite feedback — server-side read of the RLS-locked `syllabite_feedback`
  // table. RLS is ON with NO policies, so the browser's anon key can't touch it;
  // the secret key used here BYPASSES RLS. Password-gated (see requirePortalAuth)
  // so the submissions — including contact details — aren't world-readable.
  //   GET /api/syllabite-feedback  →  { data: [ …rows ] }
  if (url.pathname === '/api/syllabite-feedback') {
    if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);

    const denied = requirePortalAuth(request, env);
    if (denied) return denied;

    if (!env.SUPABASE_URL || !env.SUPABASE_SECRET_KEY) {
      return json({ error: 'Supabase isn’t configured on the Worker (SUPABASE_URL / SUPABASE_SECRET_KEY).' }, 503);
    }

    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY);
    const { data, error } = await supabase
      .from('syllabite_feedback')
      .select('id, created_at, type, message, page_path, contact, user_agent, resolved')
      .order('created_at', { ascending: false });

    return error ? json({ error: error.message }, 500) : json({ data });
  }

  return json({ error: 'Not found' }, 404);
}

// ── helpers ──────────────────────────────────────────────────────────────────

// Gate a route on the portal password. The browser sends the password it passed
// the gate with (Authorization: Bearer <password>); it must match the
// PORTAL_PASSWORD secret. Returns a Response to short-circuit on failure, or null
// when authorised. FAILS CLOSED when PORTAL_PASSWORD is unset, so a missing
// secret never accidentally exposes the data.
function requirePortalAuth(request, env) {
  if (!env.PORTAL_PASSWORD) {
    return json({ error: 'Endpoint not configured — set the PORTAL_PASSWORD Worker secret.' }, 503);
  }
  const provided = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (provided !== env.PORTAL_PASSWORD) return json({ error: 'Unauthorized' }, 401);
  return null;
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
