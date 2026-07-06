import { useState } from 'react';
import Icon from '../icons';

/* ============================================================================
   WORKERS DEPLOY PLAYBOOK — "put any Vite SPA on Workers + Supabase"  (Platform)
   ----------------------------------------------------------------------------
   The exact, repeatable recipe used to take THIS portfolio off Cloudflare Pages
   and onto Cloudflare Workers — one deploy unit that serves the built Vite SPA
   AND hosts a server-side /api/* layer with secret keys wired to Supabase. No
   SSR rewrite; the React app is untouched. This is the "light path", proven on
   jameswigfield.com and generalised here so it can be followed on any project.

   Companion to BackendSetup.jsx: that page argues the WHY / architecture and the
   simpler Pages-direct path; this page is the step-by-step HOW for the Workers
   path, including every gotcha hit along the way.

   Self-contained (constants below are the source of truth) and styled with the
   portal's Reading Room tokens via the shared .pt-* / .bk-* classes in
   portal.css — the same design language as the Backend Setup tab.
   ========================================================================== */

const HEAD = {
  kicker: 'Platform · deploy playbook',
  title: 'Vite SPA → Cloudflare Workers + Supabase',
  thesis:
    'The repeatable steps to move any Vite React SPA off Cloudflare Pages onto Workers — one deploy ' +
    'unit that serves the built site AND runs a server-side /api/* layer where secret keys live, wired ' +
    'to Supabase. No SSR rewrite; the app stays exactly as-is. Proven on this portfolio, generalised for ' +
    'any project.',
  statusLabel: 'Proven on',
  status: 'jameswigfield.com · live',
};

const VIEWS = ['The Play', 'Config Files', 'Deploy', 'Go Live', 'Gotchas'];

// ── The Play — before/after, when to reach for it, the whole job ─────────────
const ARCH = {
  now: {
    label: 'Pages (before)',
    bad: true,
    nodes: ['Browser (Vite SPA)', 'Cloudflare Pages · static', 'no server → no secrets'],
    note: 'Static files only. A secret key would have to ship in the bundle — so server-side secrets simply can’t be used.',
  },
  after: {
    label: 'Workers (after)',
    bad: false,
    nodes: ['Browser (Vite SPA)', 'Worker · /api/* + ASSETS', 'Supabase (secret key, server-side)'],
    note: 'One deploy unit. The Worker answers /api/* with secrets held server-side and serves the SPA via ASSETS. Keys never reach the browser.',
  },
};

const PATHS = [
  {
    key: 'pages', rec: false,
    name: 'Stay on Pages · browser → Supabase',
    tag: 'Fine if you only need public data',
    body:
      'The SPA talks to Supabase directly with the public anon key, and Row Level Security is the lock. ' +
      'No server to run. This is the Backend Setup tab’s recommended path.',
    points: [
      'Zero server to build or maintain',
      'Only works for data the anon key + RLS can expose',
      'No place to hide a secret key or run cron / queues',
    ],
  },
  {
    key: 'workers', rec: true,
    name: 'Move to Workers · browser → /api/* → Supabase',
    tag: 'This playbook',
    body:
      'A Worker fronts every request: it answers /api/* itself (holding secret keys server-side) and hands ' +
      'everything else to the static site. Reach for this the moment you need secrets or server logic.',
    points: [
      'Secret keys (Supabase service key, 3rd-party tokens) stay server-side',
      'Unlocks Workers-only features — Queues, Cron, Durable Objects',
      'Keeps the Vite SPA 100% unchanged — no SSR migration',
    ],
  },
];

const RAIL = [
  { n: 1, label: 'Add the Worker files' },
  { n: 2, label: 'Verify locally' },
  { n: 3, label: 'wrangler login' },
  { n: 4, label: 'Deploy to workers.dev' },
  { n: 5, label: 'Set the prod secret' },
  { n: 6, label: 'Custom-domain cutover' },
];

// ── Config Files — the files to add to the repo ──────────────────────────────
const WRANGLER = `// wrangler.jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "<your-project>",
  "main": "workers/app.js",
  "compatibility_date": "2026-07-03",
  // Required for @supabase/supabase-js (and process.env) on Workers.
  "compatibility_flags": ["nodejs_compat"],

  // Serve the built Vite SPA. run_worker_first: true makes the Worker the
  // front door for EVERY request, so /api/* reliably hits your code and any
  // non-file route falls back to index.html for client-side routing.
  "assets": {
    "directory": "./dist",
    "binding": "ASSETS",
    "not_found_handling": "single-page-application",
    "run_worker_first": true
  },

  // Non-secret, committed. Readable as env.SUPABASE_URL in the Worker.
  "vars": {
    "SUPABASE_URL": "https://<your-ref>.supabase.co"
  },

  "observability": { "enabled": true }
}`;

const APP = `// workers/app.js  — the whole server, in one file
import { createClient } from '@supabase/supabase-js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) return handleApi(request, env, url);
    // Everything else = the static site (real files, else index.html).
    return env.ASSETS.fetch(request);
  },
};

async function handleApi(request, env, url) {
  // Health check — confirms the Worker is live and Supabase is wired.
  if (url.pathname === '/api/health') {
    return json({
      ok: true,
      supabaseConfigured: Boolean(env.SUPABASE_URL && env.SUPABASE_SECRET_KEY),
    });
  }

  // Example: the secret key stays here, never reaches the browser.
  if (url.pathname === '/api/tasks') {
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY);
    const { data, error } = await supabase.from('tasks').select('*');
    return error ? json({ error: error.message }, 500) : json({ data });
  }

  return json({ error: 'Not found' }, 404);
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}`;

const SCRIPTS = `// package.json  — add wrangler + two scripts
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "cf:dev": "npm run build && wrangler dev",   // Worker locally :8787
    "deploy": "npm run build && wrangler deploy"  // build + ship
  },
  "devDependencies": {
    "wrangler": "^4.0.0"
  }
}`;

const SECRETS_FILES = `# .dev.vars.example   (commit this template)
SUPABASE_SECRET_KEY=sb_secret_...

# .dev.vars           (real local secret — NEVER commit)
SUPABASE_SECRET_KEY=sb_secret_your_real_key

# .gitignore          (add these lines)
.wrangler/
.mf
.dev.vars*
!.dev.vars.example`;

const FILES = [
  { file: 'wrangler.jsonc', tag: 'new', code: WRANGLER,
    body: 'Worker config. Two project-specific edits: the "name" and the SUPABASE_URL. run_worker_first + single-page-application are what make the SPA and /api/* coexist.' },
  { file: 'workers/app.js', tag: 'new', code: APP,
    body: 'The entire server. Serves the SPA via ASSETS and routes /api/*. The secret key is only ever read here, on the server.' },
  { file: 'package.json', tag: 'edit', code: SCRIPTS,
    body: 'Add wrangler as a devDependency and two scripts. cf:dev runs it locally; deploy ships it. (Run: npm install -D wrangler.)' },
  { file: '.dev.vars* / .gitignore', tag: 'secrets', code: SECRETS_FILES,
    body: 'Local secret lives in .dev.vars (gitignored). Commit only the .dev.vars.example template so the shape is documented.' },
];

// ── Deploy — the CLI sequence ────────────────────────────────────────────────
const DEPLOY_STEPS = [
  { n: 1, title: 'Install wrangler', where: 'terminal',
    body: 'Add the CLI as a dev dependency: npm install -D wrangler. Adds the tool the two scripts call.' },
  { n: 2, title: 'Verify locally', where: 'npm run cf:dev → http://localhost:8787/api/health',
    body: 'Builds the site and runs the Worker locally. Hitting /api/health must return JSON — see below. If you get a black/blank page instead, /api/* is still hitting the SPA (see Gotchas).' },
  { n: 3, title: 'Log in to Cloudflare', where: 'npx wrangler login  (one-time)',
    body: 'Opens the browser for OAuth. The token persists on the machine, so you only do this once per computer.' },
  { n: 4, title: 'Deploy', where: 'npm run deploy',
    body: 'Builds and ships. Prints a https://<project>.<subdomain>.workers.dev URL. Safe — this is workers.dev only; any existing Pages site stays live and untouched. Test the site AND /api/health there.' },
  { n: 5, title: 'Set the production secret', where: 'npx wrangler secret put SUPABASE_SECRET_KEY',
    body: 'Paste the same sb_secret_... value that’s in .dev.vars. ⚠️ This must come AFTER the first deploy — the Worker has to exist before a secret can attach to it. Setting it redeploys a new version automatically.' },
  { n: 6, title: 'Re-verify in production', where: '/api/health on the workers.dev URL',
    body: 'supabaseConfigured flips from false → true. Give it a few seconds to propagate; a cache-busted retry (?cb=1) confirms it if the first read still shows false.' },
];

const HEALTH_LOCAL = `# expected — local (.dev.vars supplies the key)
GET http://localhost:8787/api/health
→ { "ok": true, "supabaseConfigured": true }`;

const HEALTH_PROD = `# after deploy, BEFORE the secret is set
→ { "ok": true, "supabaseConfigured": false }

# after  npx wrangler secret put SUPABASE_SECRET_KEY  (+ a few seconds)
→ { "ok": true, "supabaseConfigured": true }`;

// ── Go Live — custom-domain cutover from Pages ───────────────────────────────
const CUTOVER_RULE =
  'A hostname can be a Custom Domain on only ONE Cloudflare service at a time. So the domain must be ' +
  'removed from the Pages project FIRST, then added to the Worker. Do the two back-to-back — the gap ' +
  'is the only downtime, usually seconds since the zone is already on Cloudflare.';

const CUTOVER_STEPS = [
  { n: 1, title: 'Pre-flight on workers.dev', where: 'browser',
    body: 'Open the workers.dev URL and actually click through the real site — pages, images, routes. Confirm it’s complete before pointing your live domain at it.' },
  { n: 2, title: 'Remove the domain from Pages', where: 'Workers & Pages → <Pages project> → Custom domains',
    body: 'Remove the custom domain from the old Pages project. Cloudflare frees the hostname so the Worker can claim it.' },
  { n: 3, title: 'Add it to the Worker', where: '<Worker> → Settings → Domains & Routes → Add → Custom Domain',
    body: 'Enter the same hostname. Cloudflare auto-creates the DNS record and provisions the edge cert — you don’t touch DNS by hand.' },
  { n: 4, title: 'Verify live', where: 'https://<your-domain>/api/health',
    body: 'Wait for “Active” (usually under a minute), then confirm the site loads and /api/health returns supabaseConfigured:true. That /api route proves it’s the Worker serving, not Pages.' },
];

const ROLLBACK = {
  title: 'Safety net',
  body:
    'If anything looks wrong, reverse it — remove the domain from the Worker and re-add it to the Pages ' +
    'project; the old deployment still exists, so recovery is fast. Keep the Pages project as a fallback ' +
    'for a few days, then delete it — and disconnect its git auto-deploy so a future push can’t rebuild an ' +
    'orphaned project.',
};

// ── Gotchas — the hard-won lessons ───────────────────────────────────────────
const GOTCHAS = [
  { n: 1, title: 'The _redirects infinite-loop deploy error', hot: true,
    body: 'A Pages-era public/_redirects with "/* /index.html 200" makes Workers reject the deploy ("Infinite loop detected"): Workers auto-strips .html / index and that cycles with the catch-all rule. Fix: DELETE the file. not_found_handling: single-page-application already does the SPA fallback, inside the asset engine, with no loop.' },
  { n: 2, title: 'run_worker_first must be `true`, not a route array',
    body: 'The route-scoped form (run_worker_first: ["/api/*"]) silently failed to front /api/*, so the SPA’s index.html was served instead — a blank/black page for API routes. Setting run_worker_first: true (Worker fronts all requests) fixes it. Config edits need a wrangler dev restart to take effect.' },
  { n: 3, title: 'Set the secret AFTER the first deploy',
    body: 'wrangler secret put fails if the Worker doesn’t exist yet. Order is deploy → secret, not the reverse. (The handoff had them backwards.)' },
  { n: 4, title: 'Secret propagation lag reads false briefly',
    body: 'Right after wrangler secret put, /api/health can still report supabaseConfigured:false for a few seconds even though the secret is registered. Retry (cache-busted) before assuming something’s broken.' },
  { n: 5, title: 'Two resources can share one name',
    body: 'The Pages project and the Worker can both be named the same thing. In the dashboard, the Worker is the one with the .workers.dev URL — don’t edit the wrong one during cutover.' },
  { n: 6, title: 'VITE_ vars are build-time; server secrets are not',
    body: 'Anything the browser needs must be a VITE_ var baked in at build. Server secrets (the sb_secret_ key) live ONLY in .dev.vars / wrangler secrets and are read via env.* in the Worker — never prefixed VITE_, never shipped to the browser.' },
];

// ── Small presentational helper for code / terminal blocks (mirrors BackendSetup) ─
function Code({ file, label, children }) {
  return (
    <div className="bk-code">
      <div className="bk-code__bar">
        <span className="bk-code__file">{file}</span>
        {label && <span className="bk-code__lang">{label}</span>}
      </div>
      <pre className="bk-code__body">{children}</pre>
    </div>
  );
}

export default function WorkersDeployPlaybook() {
  const [view, setView] = useState('The Play');

  return (
    <div className="pt-module bk">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="pt-card bk-head">
        <div className="bk-head__meta">
          <p className="bk-head__kicker">{HEAD.kicker}</p>
          <h3 className="bk-head__title">{HEAD.title}</h3>
          <p className="bk-head__thesis">{HEAD.thesis}</p>
        </div>
        <div className="bk-head__status">
          <span className="bk-head__status-label">{HEAD.statusLabel}</span>
          <span className="bk-statuschip">{HEAD.status}</span>
        </div>
      </header>

      {/* ── Tabs ────────────────────────────────────────────────────────── */}
      <div className="bk-seg" role="tablist" aria-label="Playbook views">
        {VIEWS.map((v) => (
          <button key={v} role="tab" aria-selected={v === view}
                  className={`bk-seg__tab${v === view ? ' bk-seg__tab--active' : ''}`}
                  onClick={() => setView(v)}>
            {v}
          </button>
        ))}
      </div>

      {/* ── THE PLAY ────────────────────────────────────────────────────── */}
      {view === 'The Play' && (
        <div className="bk-panel" role="tabpanel">

          <div className="bk-arch">
            {[ARCH.now, ARCH.after].map((a) => (
              <div key={a.label} className={`pt-card bk-archcol${a.bad ? ' bk-archcol--bad' : ' bk-archcol--good'}`}>
                <span className="bk-archcol__label">{a.label}</span>
                <div className="bk-archcol__flow">
                  {a.nodes.map((n, i) => (
                    <div key={n} className="bk-archcol__step">
                      <div className={`bk-node${i === a.nodes.length - 1 ? ' bk-node--end' : ''}`}>{n}</div>
                      {i < a.nodes.length - 1 && <span className="bk-arrow"><Icon name="arrowDown" size={14} /></span>}
                    </div>
                  ))}
                </div>
                <p className="bk-archcol__note">{a.note}</p>
              </div>
            ))}
          </div>

          <span className="bk-kicker">Which path do you need?</span>
          <div className="bk-paths">
            {PATHS.map((p) => (
              <div key={p.key} className={`pt-card bk-path${p.rec ? ' bk-path--rec' : ''}`}>
                <div className="bk-path__top">
                  <h5 className="bk-path__name">{p.name}</h5>
                  <span className={`bk-path__tag${p.rec ? ' bk-path__tag--rec' : ''}`}>{p.tag}</span>
                </div>
                <p className="bk-path__body">{p.body}</p>
                <ul className="bk-path__points">
                  {p.points.map((pt) => <li key={pt}>{pt}</li>)}
                </ul>
              </div>
            ))}
          </div>

          <div className="pt-card bk-railwrap">
            <span className="bk-kicker">The whole job, in six steps</span>
            <div className="bk-rail">
              {RAIL.map((s) => (
                <div key={s.n} className="bk-rail__step">
                  <span className="bk-rail__n">{s.n}</span>
                  <span className="bk-rail__label">{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── CONFIG FILES ────────────────────────────────────────────────── */}
      {view === 'Config Files' && (
        <div className="bk-panel" role="tabpanel">
          <div className="pt-card bk-finding">
            <span className="bk-kicker bk-kicker--accent">Four files to add</span>
            <p>Drop these into the repo root. The React app itself needs zero changes — this is a wrapper around your existing build. Replace the &lt;placeholders&gt; with your project’s values.</p>
          </div>

          {FILES.map((f) => (
            <div key={f.file} className="bk-change">
              <div className="bk-change__head">
                <span className="bk-change__file">{f.file}</span>
                <span className="bk-tag">{f.tag}</span>
              </div>
              <p className="bk-change__body">{f.body}</p>
              <Code file={f.file}>{f.code}</Code>
            </div>
          ))}
        </div>
      )}

      {/* ── DEPLOY ──────────────────────────────────────────────────────── */}
      {view === 'Deploy' && (
        <div className="bk-panel" role="tabpanel">
          <div className="pt-card bk-finding">
            <span className="bk-kicker bk-kicker--accent">Six commands, in order</span>
            <p>All from the terminal. Local verify first, then ship to workers.dev, then attach the secret. Nothing here touches a live domain yet.</p>
          </div>

          <div className="bk-steps">
            {DEPLOY_STEPS.map((s) => (
              <div key={s.n} className="pt-card bk-step">
                <span className="bk-step__n">{s.n}</span>
                <div className="bk-step__body">
                  <h5 className="bk-step__title">{s.title}</h5>
                  <p className="bk-step__where">{s.where}</p>
                  <p className="bk-step__text">{s.body}</p>
                </div>
              </div>
            ))}
          </div>

          <span className="bk-kicker">What /api/health should say</span>
          <Code file="local" label="verify">{HEALTH_LOCAL}</Code>
          <Code file="production" label="verify">{HEALTH_PROD}</Code>

          <div className="pt-card bk-warn">
            <span className="bk-kicker bk-kicker--accent">The one ordering trap</span>
            <p>
              <strong>Deploy before secret.</strong> A brand-new Worker has to exist on your account before
              <code> wrangler secret put</code> can attach a secret to it. Set the secret and it redeploys itself
              — no extra <code>deploy</code> needed.
            </p>
          </div>
        </div>
      )}

      {/* ── GO LIVE ─────────────────────────────────────────────────────── */}
      {view === 'Go Live' && (
        <div className="bk-panel" role="tabpanel">
          <div className="pt-card bk-warn">
            <span className="bk-kicker bk-kicker--accent">The rule that governs the cutover</span>
            <p>{CUTOVER_RULE}</p>
          </div>

          <div className="bk-steps">
            {CUTOVER_STEPS.map((s) => (
              <div key={s.n} className="pt-card bk-step">
                <span className="bk-step__n">{s.n}</span>
                <div className="bk-step__body">
                  <h5 className="bk-step__title">{s.title}</h5>
                  <p className="bk-step__where">{s.where}</p>
                  <p className="bk-step__text">{s.body}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-card bk-note">
            <p>
              <span className="bk-note__tag">rollback</span>
              {ROLLBACK.body}
            </p>
          </div>
        </div>
      )}

      {/* ── GOTCHAS ─────────────────────────────────────────────────────── */}
      {view === 'Gotchas' && (
        <div className="bk-panel" role="tabpanel">
          <div className="pt-card bk-finding">
            <span className="bk-kicker bk-kicker--accent">Everything that bit us — so it won’t bite you</span>
            <p>These six cost the most time on the real migration. Read them before you start and the whole thing is an afternoon.</p>
          </div>

          <div className="bk-steps">
            {GOTCHAS.map((g) => (
              <div key={g.n} className={`pt-card bk-step${g.hot ? ' bk-step--hot' : ''}`}>
                <span className="bk-step__n">{g.n}</span>
                <div className="bk-step__body">
                  <h5 className="bk-step__title">{g.title}</h5>
                  <p className="bk-step__text">{g.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
