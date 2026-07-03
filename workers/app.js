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
   from Wrangler secrets / .dev.vars (secret, e.g. SUPABASE_SECRET_KEY).
   ========================================================================== */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/')) {
      return handleApi(env, url);
    }

    // Everything else = the static site: env.ASSETS serves real files, and any
    // non-file route falls back to index.html for client-side routing.
    return env.ASSETS.fetch(request);
  },
};

// ── /api/* router ────────────────────────────────────────────────────────────
async function handleApi(env, url) {
  // Health check — confirms the Worker is live and whether Supabase is wired up.
  //   GET /api/health  →  { ok: true, supabaseConfigured: true|false }
  if (url.pathname === '/api/health') {
    return json({
      ok: true,
      supabaseConfigured: Boolean(env.SUPABASE_URL && env.SUPABASE_SECRET_KEY),
    });
  }

  // Example Supabase-backed route (server-side; the secret key never reaches the
  // browser). Add `request` to handleApi's signature when you need the body/method:
  //   import { createClient } from '@supabase/supabase-js';   // top of file
  //   const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY);
  //   const { data, error } = await supabase.from('tasks').select('*');
  //   return error ? json({ error: error.message }, 500) : json({ data });

  return json({ error: 'Not found' }, 404);
}

// ── helpers ──────────────────────────────────────────────────────────────────
function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
