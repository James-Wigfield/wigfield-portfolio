import { useState } from 'react';
import Icon from '../icons';

/* ============================================================================
   BACKEND SETUP — "how do I make the portal actually store data?"  (Platform)
   ----------------------------------------------------------------------------
   A visual, plain-language guide that translates the work codebase's
   Cloudflare-Workers + Supabase setup (Documents/portal-documents/general/
   cloudflare-workers-supabase-setup-guide.md) into what THIS project actually
   needs. Key difference, baked into the content below:

     • The work app  = server-rendered React Router 7 on a Cloudflare Worker,
       talks to Supabase with a SECRET service-role key via process.env /
       context.cloudflare.env.
     • This app      = a static Vite + React SPA on Cloudflare PAGES. There is
       no server, so the browser talks to Supabase directly with the PUBLIC
       anon key, and Row Level Security is the real lock. Simpler, and it's
       exactly what data/portalApi.js was already shaped for (the `// SUPABASE:`
       comments + import.meta.env.VITE_SUPABASE_*).

   Self-contained (constants below are the source of truth) and styled with the
   portal's Reading Room tokens via the .bk-* classes in portal.css.
   ========================================================================== */

const HEAD = {
  kicker: 'Platform · setup guide',
  title: 'Wiring the Portal to a Real Backend',
  thesis:
    'Right now every tool here runs on in-memory mock data — refresh the page and edits vanish. ' +
    'This is the plan to give the portal a real database so future pages (honours notes, logs, ' +
    'anything) actually save. Translated from the work setup into what THIS site needs.',
  statusLabel: 'Current state',
  status: 'Mock data — nothing is persisted yet',
};

const VIEWS = ['The Map', 'Supabase', 'Cloudflare', 'The Code', 'First Module'];

// ── The Map — two paths + the 6-step shape of the whole job ──────────────────
const PATHS = [
  {
    key: 'direct',
    rec: true,
    name: 'Browser → Supabase, directly',
    tag: 'Recommended for this site',
    body:
      'The portal is a static site with no server of its own, so the browser talks to Supabase ' +
      'itself using the public anon key. Row Level Security on the database is what actually ' +
      'protects your data.',
    points: [
      'No Cloudflare Worker to build or maintain',
      'It is exactly what data/portalApi.js already expects',
      'Anon key is public by design — safe once RLS is on',
    ],
  },
  {
    key: 'worker',
    rec: false,
    name: 'Browser → Cloudflare Worker → Supabase',
    tag: 'The work setup · only if you outgrow the above',
    body:
      'A small server (a Worker) sits in the middle and holds the secret service-role key. The ' +
      'browser calls your Worker, the Worker calls Supabase. This is exactly how the work app is ' +
      'built — heavier than this site needs today.',
    points: [
      'Needed only to hide a secret key, or run cron / queues / server logic',
      'You already run one Worker (the imposter game) — so it is within reach',
      'Adds a deploy unit, secrets, and wrangler config to maintain',
    ],
  },
];

const RAIL = [
  { n: 1, label: 'Create Supabase project' },
  { n: 2, label: 'Make a table + turn on RLS' },
  { n: 3, label: 'Install the client' },
  { n: 4, label: 'Add the 2 env keys' },
  { n: 5, label: 'Swap the mock layers' },
  { n: 6, label: 'Set keys on Cloudflare + redeploy' },
];

// ── Architecture before / after ──────────────────────────────────────────────
const ARCH = {
  now: {
    label: 'Now',
    bad: true,
    nodes: ['Browser (React SPA)', 'data/portalApi.js', 'In-memory mock'],
    note: 'Edits live in a JavaScript object. Refresh = gone.',
  },
  after: {
    label: 'After (simple path)',
    bad: false,
    nodes: ['Browser (React SPA)', 'supabase-js (anon key)', 'Supabase Postgres'],
    note: 'Edits hit a real cloud database, guarded by Row Level Security. They persist.',
  },
};

// ── Supabase interface + code ────────────────────────────────────────────────
const SUPABASE_STEPS = [
  {
    n: 1, title: 'Create a project',
    where: 'supabase.com → Dashboard → New project',
    body: 'Name it, set a database password (save it), and pick the Sydney (ap-southeast-2) region for the lowest latency from WA. Free tier is plenty.',
  },
  {
    n: 2, title: 'Grab your two public values',
    where: 'Project Settings → API',
    body: 'Copy the Project URL and the anon / publishable key. These are the only two things the browser needs. (Ignore the service-role / secret key — that is only for the Worker path.)',
  },
  {
    n: 3, title: 'Create a table',
    where: 'Table Editor → New table  (or SQL Editor)',
    body: 'Add a table with the columns your tool needs. Match the shapes already in mockData.js (id, *_id foreign keys, created_at / updated_at) so the swap is drop-in.',
  },
  {
    n: 4, title: 'Turn on Row Level Security + add a policy',
    where: 'Authentication → Policies',
    body: 'RLS is ON by default and blocks everything until you write a policy. Add one policy that lets the logged-in user read/write — until you do, even the anon key can read nothing.',
  },
  {
    n: 5, title: '(Optional) add yourself as a real user',
    where: 'Authentication → Users → Add user',
    body: 'When you want real login instead of the mock password gate, create your account here and switch auth.js to supabase.auth.signInWithPassword.',
  },
];

const SUPABASE_CODE = `# 1. install the official client (one dependency)
npm install @supabase/supabase-js`;

const SUPABASE_CLIENT = `// src/lib/supabaseClient.js   (NEW — one shared client for the whole app)
import { createClient } from '@supabase/supabase-js';

// Vite exposes any env var prefixed VITE_ to the browser at build time.
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
);`;

// ── Cloudflare interface + optional worker ───────────────────────────────────
const CF_STEPS = [
  {
    n: 1, title: 'Open the Pages project',
    where: 'Cloudflare Dashboard → Workers & Pages → (this site)',
    body: 'This portfolio is deployed as a Cloudflare Pages site (the public/_redirects file is the giveaway). Everything below lives in its settings.',
  },
  {
    n: 2, title: 'Add the two keys as environment variables',
    where: 'Settings → Variables and Secrets',
    body: 'Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY for Production (and Preview, if you use it). Same two values you copied from Supabase.',
  },
  {
    n: 3, title: 'Redeploy so the build picks them up',
    where: 'Deployments → Retry deployment (or push a commit)',
    body: 'Vite bakes VITE_ vars into the bundle at BUILD time, not at runtime — so new keys only take effect after a fresh build. This is the one easy-to-miss step.',
  },
];

const CF_WORKER_NOTE = {
  title: 'The Worker path — only if you outgrow the simple one',
  body:
    'If you ever need to hide a secret key, run scheduled jobs, or do server-side logic, you add a ' +
    'companion Worker (you already run one for the imposter game). That is when the work guide ' +
    'applies almost verbatim:',
  points: [
    'wrangler.jsonc with "main", compatibility_flags: ["nodejs_compat"], and SUPABASE_URL under "vars"',
    'Secret key in .dev.vars locally (gitignored), pushed to prod with: wrangler secret put SUPABASE_KEY',
    'Read it server-side via context.cloudflare.env.SUPABASE_KEY (never shipped to the browser)',
    'The front-end then calls your Worker endpoint instead of Supabase directly',
  ],
};

// ── The Code — file-by-file changes in THIS repo ─────────────────────────────
const CODE_CHANGES = [
  {
    file: 'package.json', tag: 'add dependency',
    body: 'Install the Supabase client. One line, no other deps.',
    code: 'npm install @supabase/supabase-js',
  },
  {
    file: 'src/lib/supabaseClient.js', tag: 'new file',
    body: 'One shared client, built from the two VITE_ env vars. Import it wherever you need data.',
    code: `import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
);`,
  },
  {
    file: 'src/components/portal/data/portalApi.js', tag: 'swap bodies',
    body: 'Every function already returns Supabase’s { data, error } shape and has a // SUPABASE: line showing its replacement. Delete the mock body, keep the comment’s call:',
    code: `export async function getProject(projectId = DEFAULT_PROJECT_ID) {
  // before: const project = db.projects.find(...)
  return supabase.from('projects')
    .select('*').eq('id', projectId).single();
}`,
  },
  {
    file: 'src/components/portal/auth.js', tag: 'real login (optional)',
    body: 'Swap the hard-coded password mock for real Supabase Auth. The function names already mirror supabase.auth, so callers don’t change.',
    code: `export async function signIn(email, password) {
  return supabase.auth.signInWithPassword({ email, password });
}
export function signOut()    { return supabase.auth.signOut(); }
export function getSession() { return supabase.auth.getSession(); }`,
  },
  {
    file: '.env.local', tag: 'local secrets (gitignored)',
    body: 'Add the two keys for local dev. Already ignored by git via the *.local rule, so they never get committed.',
    code: `VITE_SUPABASE_URL=https://<your-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>`,
  },
];

const SEAM_NOTE =
  'The whole portal was built for this: the UI components above the data layer never change. ' +
  'You only touch these files — portalApi.js / auth.js bodies — and everything keeps working.';

// ── First Module — the worked example (honours notes) ────────────────────────
const NOTES_SQL = `-- Run this once in the Supabase SQL Editor
create table notes (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  body        text,
  created_at  timestamptz default now()
);

-- Lock it down, then allow only logged-in you
alter table notes enable row level security;

create policy "logged-in user has full access"
  on notes for all
  to authenticated
  using (true) with check (true);`;

const NOTES_API = `// src/components/portal/data/notesApi.js
import { supabase } from '../../../lib/supabaseClient';

export async function listNotes() {
  return supabase.from('notes')
    .select('*').order('created_at', { ascending: false });
}
export async function addNote(title, body) {
  return supabase.from('notes')
    .insert({ title, body }).select().single();
}`;

const NOTES_REGISTRY = `// src/components/portal/registry.js  — add ONE entry
import Notes from './modules/Notes';

{ id: 'notes', label: 'Honours Notes', icon: 'edit',
  group: 'University', component: Notes }`;

const NOTES_MOVES = [
  { n: 1, label: 'Table + policy', sub: 'in Supabase', detail: 'Create the notes table and its RLS policy (left).' },
  { n: 2, label: 'An api file', sub: 'data/notesApi.js', detail: 'A few thin functions over supabase.from(‘notes’).' },
  { n: 3, label: 'A module + 1 registry line', sub: 'modules/Notes.jsx', detail: 'Build the UI, register it — the shell never changes.' },
];

// ── Small presentational helper for code/terminal blocks ─────────────────────
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

export default function BackendSetup() {
  const [view, setView] = useState('The Map');

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
      <div className="bk-seg" role="tablist" aria-label="Setup views">
        {VIEWS.map((v) => (
          <button key={v} role="tab" aria-selected={v === view}
                  className={`bk-seg__tab${v === view ? ' bk-seg__tab--active' : ''}`}
                  onClick={() => setView(v)}>
            {v}
          </button>
        ))}
      </div>

      {/* ── THE MAP ─────────────────────────────────────────────────────── */}
      {view === 'The Map' && (
        <div className="bk-panel" role="tabpanel">

          {/* Before / after architecture */}
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

          {/* Two paths */}
          <span className="bk-kicker">Two ways to get there</span>
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

          {/* Whole job in 6 steps */}
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

      {/* ── SUPABASE ────────────────────────────────────────────────────── */}
      {view === 'Supabase' && (
        <div className="bk-panel" role="tabpanel">
          <div className="pt-card bk-finding">
            <span className="bk-kicker bk-kicker--accent">On the Supabase dashboard</span>
            <p>Supabase is the database (a hosted Postgres). These clicks happen once, in the browser at supabase.com — no code yet.</p>
          </div>

          <div className="bk-steps">
            {SUPABASE_STEPS.map((s) => (
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

          <div className="pt-card bk-warn">
            <span className="bk-kicker bk-kicker--accent">Why a public key is safe</span>
            <p>
              The anon key ships inside your website’s code where anyone can read it — and that is fine.
              It can only do what your <strong>Row Level Security policies</strong> allow. With RLS on and no
              policy, the key can read and write <em>nothing</em>. RLS is the real lock, not the key.
            </p>
          </div>

          <span className="bk-kicker">Then, in the code</span>
          <Code file="terminal" label="bash">{SUPABASE_CODE}</Code>
          <Code file="src/lib/supabaseClient.js" label="new file">{SUPABASE_CLIENT}</Code>
        </div>
      )}

      {/* ── CLOUDFLARE ──────────────────────────────────────────────────── */}
      {view === 'Cloudflare' && (
        <div className="bk-panel" role="tabpanel">
          <div className="pt-card bk-finding">
            <span className="bk-kicker bk-kicker--accent">On the Cloudflare dashboard</span>
            <p>Cloudflare hosts the site. Its only job in the simple path is to hand your two Supabase keys to the build. Three clicks:</p>
          </div>

          <div className="bk-steps">
            {CF_STEPS.map((s) => (
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
              <span className="bk-note__tag">note</span>
              These are <strong>build-time</strong> variables, not runtime secrets. The anon key gets baked into
              the public bundle — expected and safe (see the Supabase tab). Only the <em>service-role</em> key
              must stay secret, and that only exists if you take the Worker path below.
            </p>
          </div>

          <div className="pt-card bk-worker">
            <span className="bk-kicker">{CF_WORKER_NOTE.title}</span>
            <p className="bk-worker__body">{CF_WORKER_NOTE.body}</p>
            <ul className="bk-worker__points">
              {CF_WORKER_NOTE.points.map((p) => <li key={p}><code>{p}</code></li>)}
            </ul>
          </div>
        </div>
      )}

      {/* ── THE CODE ────────────────────────────────────────────────────── */}
      {view === 'The Code' && (
        <div className="bk-panel" role="tabpanel">
          <div className="pt-card bk-finding">
            <span className="bk-kicker bk-kicker--accent">What changes in this repo</span>
            <p>Five touch-points. The mock layers were built as a stand-in, so swapping them for the real thing is mechanical.</p>
          </div>

          {CODE_CHANGES.map((c) => (
            <div key={c.file} className="bk-change">
              <div className="bk-change__head">
                <span className="bk-change__file">{c.file}</span>
                <span className="bk-tag">{c.tag}</span>
              </div>
              <p className="bk-change__body">{c.body}</p>
              <Code file={c.file}>{c.code}</Code>
            </div>
          ))}

          <div className="pt-card bk-proposed">
            <span className="bk-kicker bk-kicker--accent">The point of the seam</span>
            <p>{SEAM_NOTE}</p>
          </div>
        </div>
      )}

      {/* ── FIRST MODULE ────────────────────────────────────────────────── */}
      {view === 'First Module' && (
        <div className="bk-panel" role="tabpanel">
          <div className="pt-card bk-finding">
            <span className="bk-kicker bk-kicker--accent">Worked example · honours notes</span>
            <p>Once the backend is wired, here is the entire pattern for a new page that stores data — your honours notes, end to end.</p>
          </div>

          <div className="bk-moves">
            {NOTES_MOVES.map((m) => (
              <div key={m.n} className="pt-card bk-move">
                <span className="bk-move__n">{m.n}</span>
                <h5 className="bk-move__label">{m.label}</h5>
                <p className="bk-move__sub">{m.sub}</p>
                <p className="bk-move__detail">{m.detail}</p>
              </div>
            ))}
          </div>

          <span className="bk-kicker">1 · the table + its lock (Supabase SQL Editor)</span>
          <Code file="notes table" label="sql">{NOTES_SQL}</Code>

          <span className="bk-kicker">2 · a thin data file</span>
          <Code file="src/components/portal/data/notesApi.js" label="new file">{NOTES_API}</Code>

          <span className="bk-kicker">3 · register the new page</span>
          <Code file="src/components/portal/registry.js" label="one line">{NOTES_REGISTRY}</Code>

          <div className="pt-card bk-proposed">
            <span className="bk-kicker bk-kicker--accent">That’s the repeatable recipe</span>
            <p>
              Every future data-storing tool is the same three moves: <strong>table + policy → api file →
              one registry entry.</strong> The honours tracker and codebase visualizer already follow this
              shape — they just point at mock data for now.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
