import { useState } from 'react';
import Icon from '../icons';

/* ============================================================================
   GIF BACKEND & MCP — how the Pixel-Art GIF Studio is wired to Supabase + a
   remote MCP server on Cloudflare  (System)
   ----------------------------------------------------------------------------
   This documents the SHIPPED system (not a plan): each GIF is a JSON row in
   Supabase; the studio loads only those rows; and a remote MCP server — a
   Cloudflare Worker in mcp-pixel-gif/ — lets Claude Code generate a sprite and
   save it straight into that table. Sibling of BackendSetup.jsx (the general
   guide); this is the pixel-studio worked example. Same .bk-* styling.

   The whole thing turns on the two-key split:
     • Browser / studio  → READS with the public anon key (RLS allows it).
     • Cloudflare Worker → WRITES with the secret key (held as a Worker secret).
   ========================================================================== */

const HEAD = {
  kicker: 'System · pixel-gif backend',
  title: 'Saving GIFs to Supabase & generating them from Claude Code',
  thesis:
    'This is now wired end-to-end: each GIF is a JSON row in Supabase, the Pixel-Art GIF Studio loads only ' +
    'those rows, and a remote MCP server (a Cloudflare Worker) lets Claude Code generate a sprite and save it ' +
    'straight into that table. The tabs below document how each piece fits.',
  statusLabel: 'Status',
  status: 'Live — deployed & connected',
};

const VIEWS = ['The Plan', 'Supabase', 'This Repo', 'Cloudflare', 'MCP + Claude'];

// ── The two-key data flow (write path / read path) ───────────────────────────
const FLOW = [
  {
    label: 'Write · from Claude Code',
    nodes: ['Claude Code', 'Cloudflare Worker (secret key)', 'Supabase · sprites table'],
    note: 'Claude Code talks over SSE to the deployed Worker, which holds the SECRET key and writes the row. Nothing secret reaches the browser.',
  },
  {
    label: 'Read · in the browser',
    nodes: ['Supabase · sprites table', 'GIF Studio (anon key)', 'Rendered .gif'],
    note: 'The studio reads with the PUBLIC anon key and renders each row — exactly the sprite shape the encoder draws.',
  },
];

// ── The JSON you store — exactly the sprite shape the studio renders ──────────
const SHAPE = `// one Supabase row = one GIF. The "sprite" column is JSON:
{
  "name": "Walking mushroom",
  "sprite": {
    "width": 16, "height": 16,        // ← dimensions
    "delayMs": 120,                    // ← speed (ms per frame)
    "palette": ["#000000", "#e0518a", "#fff3c4"],
    "transparentIndex": 0,
    "frames": [                        // ← frames.length = how many frames
      [0,0,1,1,0,0, /* …w*h values */],//   each value is a palette index =
      [0,1,1,1,1,0, /* …          */] //   the COLOUR GRID for that frame
    ]
  }
}`;

const RAIL = [
  { n: 1, label: 'Create the sprites table' },
  { n: 2, label: 'Front-end reads it (anon key)' },
  { n: 3, label: 'Add Pages env vars' },
  { n: 4, label: 'Deploy the MCP Worker' },
  { n: 5, label: 'Connect Claude Code (SSE)' },
];

// ── Supabase ──────────────────────────────────────────────────────────────────
const SUPABASE_STEPS = [
  {
    n: 1, title: 'Create a project',
    where: 'supabase.com → New project',
    body: 'Save the database password. Pick the Sydney (ap-southeast-2) region for low latency from WA. Free tier is plenty.',
  },
  {
    n: 2, title: 'Run the table SQL',
    where: 'SQL Editor → paste + run (below)',
    body: 'Creates the sprites table and its read-only lock in one go.',
  },
  {
    n: 3, title: 'Copy your keys',
    where: 'Project Settings → API',
    body: 'The browser needs the Project URL + publishable (anon) key. The Worker needs the secret key — keep that one off the internet.',
  },
];

const TABLE_SQL = `-- Run once in Supabase → SQL Editor
create table sprites (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  sprite      jsonb not null,        -- the whole GIF: size, speed, palette + frame grids
  created_at  timestamptz default now()
);

-- Lock the table, then let ANYONE read (the studio shows GIFs with the public key)
alter table sprites enable row level security;

create policy "public can read sprites"
  on sprites for select
  to anon, authenticated
  using (true);

-- No insert policy on purpose: only the Worker writes, using the
-- secret key, which bypasses RLS. The browser can never write.`;

// ── This repo ─────────────────────────────────────────────────────────────────
const REPO_CHANGES = [
  {
    file: 'package.json', tag: 'add dependency',
    body: 'The Supabase client, shared by the app and the MCP Worker.',
    code: 'npm install @supabase/supabase-js',
  },
  {
    file: 'src/lib/supabaseClient.js', tag: 'new file',
    body: 'The browser client, from the two public VITE_ vars. Null-safe: if the keys are missing it stays null instead of throwing, so the portal still loads.',
    code: `import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = url && anonKey ? createClient(url, anonKey) : null;`,
  },
  {
    file: 'src/components/portal/data/spritesApi.js', tag: 'new file',
    body: 'One thin read: list every saved GIF, newest first.',
    code: `import { supabase } from '../../../lib/supabaseClient';

export async function listSprites() {
  if (!supabase) return { data: null, error: { message: 'Supabase not configured' } };
  return supabase.from('sprites')
    .select('id, name, sprite, created_at')
    .order('created_at', { ascending: false });
}`,
  },
  {
    file: 'src/components/portal/modules/PixelGifStudio.jsx', tag: 'reads Supabase only',
    body: 'On mount it loads the rows, and the switcher shows ONLY those — no hard-coded examples. A Refresh button re-pulls after Claude saves a new one.',
    code: `import { listSprites } from '../data/spritesApi';

const { data } = await listSprites();
const sprites = (data ?? []).map((r) => ({ id: r.id, name: r.name, ...r.sprite }));
// the switcher renders exactly these rows`,
  },
  {
    file: '.env.local', tag: 'public keys (gitignored)',
    body: 'The URL + publishable (anon) key for local dev. Add the same two to the Cloudflare Pages project for production.',
    code: `VITE_SUPABASE_URL=https://<your-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-publishable-key>`,
  },
];

// ── Cloudflare ────────────────────────────────────────────────────────────────
const CF_STEPS = [
  {
    n: 1, title: 'Add the two public keys (front-end)',
    where: 'Pages project → Settings → Variables and Secrets',
    body: 'Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY for Production. Same two values from the Supabase API page. The secret key never goes here.',
  },
  {
    n: 2, title: 'Redeploy the Pages site',
    where: 'Deployments → Retry deployment (or push a commit)',
    body: 'Vite bakes VITE_ vars in at BUILD time, so the keys only take effect after a fresh build. The one easy-to-miss step.',
  },
];

// ── MCP + Claude (deployed remote Worker) ─────────────────────────────────────
const WORKER_URL = 'https://pixel-gif-mcp.jameswigfield1.workers.dev';

const MCP_SERVER = `// mcp-pixel-gif/src/index.js — a REMOTE MCP server on a Cloudflare Worker
import { McpAgent } from 'agents/mcp';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

export class PixelGifMCP extends McpAgent {
  server = new McpServer({ name: 'pixel-gif', version: '1.0.0' });
  async init() {
    this.server.tool('save_sprite', 'Save a GIF to the portal', {
      name: z.string(),
      sprite: z.object({
        width: z.number(), height: z.number(), delayMs: z.number(),
        palette: z.array(z.string()),
        transparentIndex: z.number().nullable(),
        frames: z.array(z.array(z.number())),  // frames[f][y*width+x] = palette index
      }),
    }, async ({ name, sprite }) => {
      const db = createClient(this.env.SUPABASE_URL, this.env.SUPABASE_SECRET_KEY);
      const { data, error } = await db.from('sprites')
        .insert({ name, sprite }).select('id').single();
      return { content: [{ type: 'text', text: error ? error.message : \`Saved \${data.id}\` }],
               isError: !!error };
    });
  }
}

// /sse for Claude Code, /mcp for HTTP clients. (Full version, with the optional
// MCP_AUTH_TOKEN guard + Durable Object binding, is in the repo.)
export default { fetch: (req, env, ctx) =>
  new URL(req.url).pathname === '/sse'
    ? PixelGifMCP.serveSSE('/sse').fetch(req, env, ctx)
    : PixelGifMCP.serve('/mcp').fetch(req, env, ctx) };`;

const MCP_REGISTER = `# 1. deploy the Worker (from mcp-pixel-gif/), with the secret set:
npx wrangler secret put SUPABASE_SECRET_KEY     # paste sb_secret_...
npm run deploy                                  # -> prints the workers.dev URL

# 2. register the LIVE url with Claude Code (SSE transport, one line):
claude mcp add --transport sse pixel-gif ${WORKER_URL}/sse`;

const MCP_LOOP = [
  { n: 1, label: 'Ask', sub: 'in Claude Code', detail: '“Make a walking mushroom GIF, 6 frames.”' },
  { n: 2, label: 'Generate', sub: 'Claude builds it', detail: 'It produces a sprite in the shape above and calls save_sprite.' },
  { n: 3, label: 'It appears', sub: 'in the studio', detail: 'The row lands in Supabase; hit Refresh in the studio and it’s a new tab.' },
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

export default function GifBackend() {
  const [view, setView] = useState('The Plan');

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

      {/* ── THE PLAN ────────────────────────────────────────────────────── */}
      {view === 'The Plan' && (
        <div className="bk-panel" role="tabpanel">

          {/* Two-key data flow */}
          <span className="bk-kicker">How the data flows · two keys, two directions</span>
          <div className="bk-arch">
            {FLOW.map((a) => (
              <div key={a.label} className="pt-card bk-archcol bk-archcol--good">
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

          {/* The JSON you store */}
          <div className="pt-card bk-finding">
            <span className="bk-kicker bk-kicker--accent">What you store</span>
            <p>
              Exactly the idea you had: one JSON object per GIF holding the frame count, dimensions, speed
              and the colour grid of every frame. It’s already the <code>sprite</code> shape the studio
              renders (see <code>pixelGif.js</code>) — so storing and loading it is a drop-in.
            </p>
          </div>
          <Code file="sprites · one row" label="json">{SHAPE}</Code>

          {/* The whole pipeline in 5 steps */}
          <div className="pt-card bk-railwrap">
            <span className="bk-kicker">The whole pipeline, in five steps</span>
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
            <span className="bk-kicker bk-kicker--accent">On supabase.com</span>
            <p>Supabase is the database. Three clicks, then one block of SQL — no app code yet.</p>
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

          <span className="bk-kicker">The table + its lock</span>
          <Code file="sprites table" label="sql">{TABLE_SQL}</Code>

          <div className="pt-card bk-warn">
            <span className="bk-kicker bk-kicker--accent">Why this is safe</span>
            <p>
              The anon key ships in your site’s code and that’s fine — with the policy above it can only
              <strong> read</strong>. Writes are impossible from the browser; they only happen through the
              Worker’s <strong>secret</strong> key, which lives on Cloudflare, never in the bundle.
            </p>
          </div>
        </div>
      )}

      {/* ── THIS REPO ───────────────────────────────────────────────────── */}
      {view === 'This Repo' && (
        <div className="bk-panel" role="tabpanel">
          <div className="pt-card bk-finding">
            <span className="bk-kicker bk-kicker--accent">What changed in this repo</span>
            <p>Install the client, add two small files, and point the studio at the database. The studio now shows only Supabase rows.</p>
          </div>

          {REPO_CHANGES.map((c) => (
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
            <span className="bk-kicker bk-kicker--accent">Seeded, not fallback</span>
            <p>
              The studio shows <strong>only</strong> Supabase rows now. The old built-in animations were
              seeded into the table once via <code>mcp-pixel-gif/seed-examples.mjs</code>, so nothing was
              lost — <code>pixelSprites.js</code> just stays as the source for that one-off seed.
            </p>
          </div>
        </div>
      )}

      {/* ── CLOUDFLARE ──────────────────────────────────────────────────── */}
      {view === 'Cloudflare' && (
        <div className="bk-panel" role="tabpanel">
          <div className="pt-card bk-finding">
            <span className="bk-kicker bk-kicker--accent">On the Cloudflare dashboard</span>
            <p>Cloudflare does two jobs here: it hosts the Pages site (needs the two public keys) and runs the MCP Worker (next tab). This tab is the Pages side:</p>
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
              Only the two <strong>VITE_</strong> (public) keys belong on Pages. The secret key stays out of
              the site entirely — it only ever lives as a Worker secret (next tab).
            </p>
          </div>
        </div>
      )}

      {/* ── MCP + CLAUDE ────────────────────────────────────────────────── */}
      {view === 'MCP + Claude' && (
        <div className="bk-panel" role="tabpanel">
          <div className="pt-card bk-finding">
            <span className="bk-kicker bk-kicker--accent">The MCP server (deployed)</span>
            <p>
              A <strong>remote</strong> MCP server, deployed as a Cloudflare Worker, exposing one tool —
              <code> save_sprite</code> — that inserts a sprite into Supabase with the secret key (held as a
              Worker secret). Claude Code connects to it over <strong>SSE</strong>; the studio reads those
              rows straight from Supabase (Refresh to pull new ones). Live at:
            </p>
          </div>

          <Code file="live endpoint" label="sse">{`${WORKER_URL}/sse`}</Code>

          <span className="bk-kicker">1 · the server (one tool, on a Worker)</span>
          <Code file="mcp-pixel-gif/src/index.js" label="worker">{MCP_SERVER}</Code>

          <span className="bk-kicker">2 · deploy it + register with Claude Code</span>
          <Code file="terminal" label="bash">{MCP_REGISTER}</Code>

          <div className="pt-card bk-warn">
            <span className="bk-kicker bk-kicker--accent">Keep the secret key safe</span>
            <p>
              The secret key bypasses every security rule, so it lives <strong>only</strong> as a Cloudflare
              Worker secret (<code>wrangler secret put SUPABASE_SECRET_KEY</code>) — never in a VITE_ var,
              never committed. The optional <code>MCP_AUTH_TOKEN</code> guard locks the public URL behind a
              Bearer token (re-add the server with <code>--header</code>).
            </p>
          </div>

          <span className="bk-kicker">3 · the loop, now that it’s wired</span>
          <div className="bk-moves">
            {MCP_LOOP.map((m) => (
              <div key={m.n} className="pt-card bk-move">
                <span className="bk-move__n">{m.n}</span>
                <h5 className="bk-move__label">{m.label}</h5>
                <p className="bk-move__sub">{m.sub}</p>
                <p className="bk-move__detail">{m.detail}</p>
              </div>
            ))}
          </div>

          <div className="pt-card bk-proposed">
            <span className="bk-kicker bk-kicker--accent">That’s the whole MCP wrapper</span>
            <p>
              Describe a sprite → Claude generates it in the documented shape → <code>save_sprite</code> writes
              one JSON row → the studio reads it with the anon key and renders the GIF. No new UI, no bundled
              secret, nothing tied to your laptop.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
