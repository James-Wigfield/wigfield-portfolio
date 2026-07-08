import { useState, Fragment } from 'react';
import Icon from '../icons';

/* ============================================================================
   CODEBASE VISUALISER · MCP PLAN — implementation plan  (Business section)
   ----------------------------------------------------------------------------
   The build plan for the standalone Codebase Visualiser product: a two-pane
   walkthrough studio (exact source code left · animated diagram explanation
   right) that Claude Code populates INCREMENTALLY through a remote MCP server.
   It lives in its own repo (Documents/business/codebase-visualiser) on the same
   stack as this portfolio: Vite SPA + Cloudflare Worker + Supabase, with the
   Deck Studio persistence pattern (one JSON blob per visualisation).

   This is a PLANNING DELIVERABLE — the companion bootstrap guide a fresh Claude
   Code instance follows is at this repo's
   Documents/portal-documents/projects/codebase-visualiser-setup.md. Reference
   implementations:
     · CodeVisualiser.jsx  — the target UX (IDE shell, chapters, animated viz)
     · DeckStudio.jsx + mcp-portal/ — the persistence + MCP wrapper pattern

   Self-contained (constants below are the source of truth). Rendered with the
   shared .pt-* / .syl-* plan-document classes, the .pdr-* table/flow widgets
   (PdReader's token-driven comparison language) and .bk-code snippets — all
   existing patterns, no new CSS.
   ========================================================================== */

const HEAD = {
  tag: 'Business · R&D',
  title: 'Codebase Visualiser — MCP-driven walkthrough studio',
  thesis:
    'A standalone product that turns real source files into side-by-side walkthroughs: the exact code, ' +
    'syntax-highlighted with real line numbers, beside animated diagrams that show what it actually does. ' +
    'Claude Code builds each walkthrough incrementally through a remote MCP server — one tool call adds a ' +
    'file or a chapter — and the doc persists as a single JSON blob in Supabase, exactly the Deck Studio pattern.',
  phase: 'Plan · pre-build',
};

const SIGNALS = [
  { value: '2 panes', label: 'code left · animated viz right', accent: true },
  { value: '9 tools', label: 'MCP surface (Deck Studio verbs)' },
  { value: '1 blob', label: 'JSON doc per visualisation' },
  { value: '10', label: 'typed viz primitives at v1' },
];

const VIEWS = ['Overview', 'Architecture', 'Data Model', 'MCP Tools', 'Right Panel', 'Roadmap', 'Decisions'];

// ── Overview ─────────────────────────────────────────────────────────────────
const PRINCIPLES = [
  'The left pane is REAL code — the exact source string with real line numbers, never a paraphrase. CodeVisualiser.jsx already proves the reader; the file text in the blob is the single source of truth.',
  'The right pane is DATA, not markup — Claude sends typed, schema-validated viz specs; hand-built React primitives do the rendering and the animation. Same philosophy as Deck Studio’s layout engine.',
  'Incremental by design — every MCP tool is a small, safe mutation (add a file, add a chapter) so Claude can grow a walkthrough as it builds the actual code, commit by commit.',
  'Server-side secrets only — the Supabase secret key lives in Workers (site /api + MCP), never in the browser. RLS on with no policies, like the presentations table.',
  'Full overhaul of the target repo — the current codebase-visualiser folder is a stock Vite scaffold; wipe it and rebuild to this plan rather than patching it.',
  'Animations respect prefers-reduced-motion, theme via tokens, zero animation libraries — CSS keyframes + rAF steppers, the CodeVisualiser way.',
];

const LINEAGE = [
  { name: 'CodeVisualiser.jsx — defines the UX', tag: 'reference', hot: true,
    body: 'VS-Code-shaped shell: Explorer rail, file tabs, walkthrough/full-file toggle, chapters pairing exact line ranges with interactive SVG/grid animations (dataflow, scan-order stepper, variant toggles, terminal output). The new product generalises exactly this — but the chapters arrive as JSON instead of hand-written JSX.' },
  { name: 'DeckStudio.jsx + mcp-portal — defines the plumbing', tag: 'precedent',
    body: 'Claude calls a remote MCP Worker → zod validates a high-level spec → a server-side engine normalises it → one JSON blob lands in a Supabase table (RLS locked) → the site Worker’s /api reads it back with the secret key → the React viewer renders it. Reuse every step, table-for-table.' },
];

// ── Architecture ─────────────────────────────────────────────────────────────
const WRITE_PATH = [
  'Claude Code',
  'MCP Worker · zod validate',
  'Supabase · doc jsonb',
  'Site Worker · /api',
  'React viewer',
];

const ARCH = [
  { name: 'Vite + React 19 SPA (the viewer)', tag: 'front-end',
    body: 'Explorer rail (projects → files), code pane with the fixed dark IDE palette, chapter walkthroughs, viz primitives. Own scoped design system (tokens on :root, cv-style class discipline) — greenfield, not a copy of the portal CSS.' },
  { name: 'Site Worker — workers/app.js', tag: 'api layer',
    body: 'One deploy unit: serves dist/ via the ASSETS binding (run_worker_first, SPA fallback) and hosts /api/visualisations read routes using SUPABASE_SECRET_KEY. Password-gated with a VIEW_PASSWORD bearer, mirroring requirePortalAuth.' },
  { name: 'MCP Worker — mcp/ subfolder', tag: 'write layer', hot: true,
    body: 'A second Worker in the same repo (the mcp-portal/ pattern): Durable Object McpAgent, /sse + /mcp endpoints, zod-validated tools, Supabase writes with the secret key. Runs AUTHLESS like the pixel-gif MCP (decided — the bearer-token setup fought the deck server); the guard function stays in the code so a token can be bolted on later.' },
  { name: 'Supabase — one `visualisations` table', tag: 'persistence',
    body: 'In the PORTAL’S existing Supabase project (decided — no new project), alongside presentations. id, title, project, doc jsonb, created_by, timestamps. RLS ON with no policies — only the Workers (secret key) can touch it. The doc column is the whole walkthrough, like presentations.deck.' },
  { name: 'Repo layout mirrors this portfolio', tag: 'conventions',
    body: 'wrangler.jsonc + workers/app.js at the root, mcp/ with its own wrangler.jsonc/package.json, src/ for the SPA, .dev.vars for local secrets, npm run cf:dev / deploy scripts. A fresh Claude instance can navigate it by analogy.' },
];

const REPO_TREE = `codebase-visualiser/
├── wrangler.jsonc            # site worker: ASSETS + /api (run_worker_first)
├── package.json              # dev / cf:dev / deploy scripts
├── workers/
│   └── app.js                # serves dist/ + /api/visualisations (secret key)
├── mcp/                      # the MCP wrapper — its own deploy unit
│   ├── wrangler.jsonc        # Durable Object McpAgent (VisualiserMCP)
│   ├── package.json
│   └── src/index.js          # 9 tools, zod specs, validation engine
└── src/                      # Vite + React 19 viewer
    ├── main.jsx / App.jsx
    ├── styles/app.css        # theme tokens + IDE code palette
    ├── model/docModel.js     # the JSON contract + sample doc fallback
    ├── data/api.js           # /api client ({ data, error }, never throws)
    └── components/
        ├── Explorer.jsx  CodePane.jsx  Chapter.jsx
        └── viz/          # one file per primitive + shared animation kit`;

// ── Data model ───────────────────────────────────────────────────────────────
const DOC_CONTRACT = `-- Supabase row (visualisations)
{ id, title, project, doc, updatedAt }

doc = {
  version: 1,
  files: [{
    id, path, lang,          // 'py' | 'js' | 'ts' | 'jsx' | 'sql' | 'bash' | …
    source,                  // the EXACT file text — single source of truth
    chapters: [{
      id, title, tag,        // tag e.g. "the crux"
      from, to,              // real 1-based line range shown on the left
      prose: [ markdown ],   // 1–3 short paragraphs beside the viz
      viz: [ VizSpec ]       // typed animated primitives (right panel)
    }]
  }]
}

// VizSpec — discriminated union on \`kind\` (schema-validated server-side)
{ kind: 'flow',     nodes: […], edges: […], pulse: true }
{ kind: 'sequence', grid: { rows, cols, planes }, orders: […], strip: true }
{ kind: 'steps',    items: [{ label, code }] }
{ kind: 'compare',  options: [{ name, call, rows: [[k, v]] }] }
{ kind: 'terminal', title, lines: [{ text, tone }] }
{ kind: 'table' | 'kv' | 'stats' | 'callout' | 'diagram' }   // + escape hatch`;

const SCHEMA_SQL = `create table visualisations (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  project    text,
  doc        jsonb not null,
  created_by text default 'claude',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table visualisations enable row level security;
-- no policies on purpose: only the Workers' secret key can read/write`;

const MODEL_NOTES = [
  'One blob per visualisation keeps every MCP mutation atomic (read doc → splice → write doc) and the viewer trivial — exactly why presentations.deck works. No joins, no partial states.',
  'Line ranges are validated server-side against the stored source at write time, so a chapter can never reference lines that don’t exist.',
  'update_file_source re-checks every chapter’s range after a re-sync and flags out-of-range chapters as stale instead of silently misaligning them.',
  'version: 1 in the blob from day one, so the renderer can migrate old docs when the contract grows (images, cross-file chapters).',
];

// ── MCP tools ────────────────────────────────────────────────────────────────
const TOOLS_HEAD = ['Tool', 'Args', 'What it does'];
const TOOLS_ROWS = [
  ['create_visualisation', 'title · project?', 'New empty doc → returns id (the Deck Studio create verb)'],
  ['list_visualisations', '—', 'ids + titles + updated timestamps'],
  ['get_visualisation', 'id', 'Full doc JSON — inspect before editing'],
  ['add_file', 'id · path · lang · source', 'Adds a file with its exact source; server computes loc'],
  ['update_file_source', 'id · fileId · source', 'Re-sync after code changes; flags now-stale chapters'],
  ['add_chapter', 'id · fileId · chapter · index?', 'Validated CHAPTER_SPEC; range checked against source'],
  ['update_chapter', 'id · fileId · chapterId · chapter', 'Replace one chapter in place'],
  ['remove_chapter', 'id · fileId · chapterId', 'Delete one chapter'],
  ['delete_visualisation', 'id', 'Remove the whole doc'],
];

const TOOL_EXAMPLE = `add_chapter({
  id: 'a1b2…', fileId: 'f1', index: 2,
  chapter: {
    title: 'Flatten a volume into a sequence', tag: 'the crux',
    from: 93, to: 113,
    prose: ['Mamba works on a 1D sequence, so the volume is unrolled…'],
    viz: [{
      kind: 'sequence',
      grid: { rows: 3, cols: 4, planes: 2 },
      orders: [{ label: '+x', order: 'row' }, { label: '−x', order: 'row-rev' }],
      strip: true, play: true
    }]
  }
})`;

const TOOL_NOTES = [
  'Same verbs as the deck tools (create / list / get / add_* / delete) so the muscle memory — and the wrapper code — carries straight over from mcp-portal/src/index.js.',
  'Claude sends HIGH-LEVEL specs; the server engine assigns ids, validates line ranges and viz specs against zod, and normalises defaults — the buildSlide() philosophy applied to chapters.',
  'Incremental flow: create once → add_file when a real file lands → add_chapter after each meaningful commit. The walkthrough grows with the codebase.',
  'Tool results return short human-readable confirmations (“Added chapter 3 to models/encoder.py”), matching the portal MCP style.',
];

// ── Right panel (the rendering decision) ────────────────────────────────────
const RENDER_HEAD = ['Approach', 'Animated?', 'Safe & editable?', 'Theme-aware?', 'Verdict'];
const RENDER_ROWS = [
  ['Raw HTML/JSX strings from Claude', 'Yes, unbounded', 'No — XSS surface, unparseable as data, uneditable', 'No', 'Rejected'],
  ['SVG string blobs', 'Barely (SMIL)', 'Risky — opaque to any future editor', 'No — baked-in colours', 'Escape hatch only'],
  ['Mermaid / Graphviz', 'No — static layouts', 'Safe but generic-looking; adds a runtime dep', 'Partial', 'Rejected as the core'],
  ['Typed viz primitives (JSON → built-in React components)', 'Yes — hand-built, play/pause/scrub', 'Fully — zod-validated data, editable later', 'Yes — token-driven', 'The call'],
  ['Sandboxed JS components in the blob', 'Unbounded', 'No — security + review burden', 'No', 'Rejected'],
];

const RENDER_TRADEOFF = {
  name: 'Generative freedom (arbitrary markup)  vs  a typed primitive library',
  lacks:
    'Letting Claude ship arbitrary HTML/SVG/JS maximises expressiveness but every render is a gamble: no theme tokens, no reduced-motion handling, no editing story, and a stored-XSS surface in your own product.',
  edge:
    'A typed primitive library makes quality deterministic: each primitive is hand-built once (animation, tokens, a11y, scrubbing) and Claude composes them as data. It is exactly how Deck Studio already ships slides — and CodeVisualiser.jsx is the existence proof that ~10 primitives cover a real walkthrough.',
};

const PRIMITIVES = [
  { name: 'flow — dataflow diagram', tag: 'animated', hot: true,
    body: 'Nodes, ops (Σ, +), wires with arrowheads and an optional travelling pulse; fan-out counts can bind to a control. Generalises DataflowViz (chapter 1 of the Mamba walkthrough).' },
  { name: 'sequence — grid/scan stepper', tag: 'animated', hot: true,
    body: 'A 2D/3D cell grid plus a 1D strip; a play/pause/scrub animation threads an ordering through the cells with hover-linking both ways. Generalises FlattenViz — the crux primitive for “how data moves”.' },
  { name: 'steps — numbered pass', tag: 'animated',
    body: 'An ordered list with a highlight that cycles (or is clicked) step by step, each step optionally echoing a code fragment. Generalises ForwardViz.' },
  { name: 'compare — variant toggle', tag: 'interactive',
    body: 'Named options (e.g. Mamba-1 ↔ Mamba-2) toggled by a segmented control, each with a call signature and key-value rows. Generalises BuildViz.' },
  { name: 'terminal — captured output', tag: 'static',
    body: 'A terminal chrome with tone-coloured lines (ok / dim / pass) for real captured output. Generalises TestViz.' },
  { name: 'table — comparison table', tag: 'static', body: 'Head + rows, token-styled — the pdr-table pattern as a primitive.' },
  { name: 'kv — spec card', tag: 'static', body: 'Definition-list rows for configs and signatures (the cv-kv pattern).' },
  { name: 'stats — result grid', tag: 'static', body: 'Big-number tiles with captions (the cv-resgrid pattern) for benchmarks and test results.' },
  { name: 'callout — note', tag: 'static', body: 'A short token-styled note paragraph (cv-note) for caveats and gotchas.' },
  { name: 'diagram — sanitised SVG escape hatch', tag: 'guarded',
    body: 'For one-offs no primitive covers: static SVG, sanitised server-side (no scripts/handlers/foreignObject), forced to currentColor so it still themes. Use sparingly; promote recurring shapes into real primitives.' },
];

const ANIMATION_RULES = [
  'Every temporal primitive ships play / pause / scrub / reset — the FlattenViz control row is the template.',
  'Viz ↔ code linking: each viz block may carry highlightLines; hovering the viz highlights that range in the left pane (and clicking a chapter’s code lines can ping the viz).',
  'prefers-reduced-motion: reduce → autoplay off, scrubbing stays — behaviour already proven in usePrefersReducedMotion.',
  'CSS keyframes + requestAnimationFrame steppers only; no framer-motion/lottie. Keeps the bundle light and every animation theme-token-driven.',
];

// ── Roadmap ──────────────────────────────────────────────────────────────────
const PHASES = [
  { label: 'Phase 0 · Overhaul & scaffold', state: 'now',
    body: 'Wipe the stock Vite scaffold. Rebuild: SPA + site Worker (ASSETS, /api/health), wrangler.jsonc, scripts, .dev.vars, first deploy. Exit: the deployed URL serves the app and /api/health answers.' },
  { label: 'Phase 1 · Supabase + read API', state: 'now',
    body: 'Create the visualisations table (RLS on, no policies), set Worker secrets, ship GET /api/visualisations(/:id) behind the VIEW_PASSWORD bearer. Exit: a hand-inserted row round-trips to the browser.' },
  { label: 'Phase 2 · Viewer shell', state: 'next',
    body: 'Explorer rail, file tabs, walkthrough/full-file toggle, code pane with the multi-language stateful highlighter and real line numbers, sample-doc fallback (the SAMPLE_DECK trick) for plain vite dev.' },
  { label: 'Phase 3 · Viz primitives v1', state: 'next',
    body: 'The ten primitives plus the shared animation kit (play/scrub, reduced motion, hover-linking, theme tokens). Exit: the hand-inserted sample doc renders every primitive.' },
  { label: 'Phase 4 · MCP server', state: 'next',
    body: 'mcp/ Worker: nine tools, zod CHAPTER_SPEC / VIZ_SPEC, server-side range + spec validation, deploy, connect Claude Code. Exit: Claude builds a real walkthrough end-to-end, chapter by chapter.' },
  { label: 'Phase 5 · Polish & product', state: 'later',
    body: 'Stale-chapter surfacing after re-syncs, share links / public read mode, an in-app editor (the DeckEditor analogue), more primitives (dependency graph, memory layout, big-O), multi-project workspaces.' },
];

// ── Decisions — resolved with James, 2026-07-08 ──────────────────────────────
const DECISIONS = [
  'Supabase — RESOLVED: reuse the portal’s existing project; the visualisations table lives alongside presentations, and the new Workers use the same SUPABASE_URL + secret key. No new project to provision.',
  'Viewer access — RESOLVED: password-gated (VIEW_PASSWORD bearer, the portal’s requirePortalAuth pattern). One Worker secret + one gate component; public per-doc share links stay a Phase 5 idea.',
  'Syntax highlighting — DEFAULTED: the left pane colours code with a hand-rolled ~50-line tokenizer (per-language keyword tables, zero dependencies — the CodeVisualiser precedent) rather than a library like Prism/Shiki. Revisit only if a language renders poorly.',
  'MCP auth — RESOLVED: authless, like the pixel-gif server (the token setup fought the deck MCP). The Worker URL is effectively the secret; the bearer-guard function stays in the code so auth can be switched on later without breaking clients.',
  'Product placement — RESOLVED: standalone product under business/, not a Portara offering.',
];

/* ── Presentational helpers (mirror PdReader / PortaraBusinessPlan) ─────────── */
function Northstar({ kicker, accent, children }) {
  return (
    <div className="pt-card syl-northstar">
      <span className={`syl-kicker${accent ? ' syl-kicker--accent' : ''}`}>{kicker}</span>
      <p>{children}</p>
    </div>
  );
}
function BulletCard({ kicker, accent, items }) {
  return (
    <div className="pt-card syl-guardrails">
      <span className={`syl-kicker${accent ? ' syl-kicker--accent' : ''}`}>{kicker}</span>
      <ul className="syl-guardrails__list">
        {items.map((t, i) => <li key={i}>{t}</li>)}
      </ul>
    </div>
  );
}
function FeatureList({ items }) {
  return (
    <div className="syl-features">
      {items.map((f, i) => (
        <div key={f.name} className={`pt-card syl-feature${f.hot ? ' syl-feature--hot' : ''}`}>
          <span className="syl-feature__n">{String(i + 1).padStart(2, '0')}</span>
          <div className="syl-feature__body">
            <div className="syl-feature__top">
              <h5 className="syl-feature__name">{f.name}</h5>
              <span className="syl-tag">{f.tag}</span>
            </div>
            <p className="syl-feature__text">{f.body}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
function Tradeoff({ t }) {
  return (
    <div className="syl-rivals">
      <div className="pt-card syl-rival">
        <h5 className="syl-rival__name">{t.name}</h5>
        <p className="syl-rival__line syl-rival__line--lacks">{t.lacks}</p>
        <p className="syl-rival__line syl-rival__line--edge">
          <Icon name="arrowRight" size={14} className="syl-rival__arrow" />
          {t.edge}
        </p>
      </div>
    </div>
  );
}
function CompareTable({ head, rows }) {
  return (
    <div className="pdr-tablewrap">
      <table className="pdr-table">
        <thead>
          <tr>{head.map((h) => <th key={h}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r[0]}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function Flow({ steps }) {
  return (
    <div className="pdr-flow">
      {steps.map((s, i) => (
        <Fragment key={s}>
          <div className="pdr-flow__step">
            <span className="pdr-flow__n">{String(i + 1).padStart(2, '0')}</span>
            <span className="pdr-flow__label">{s}</span>
          </div>
          {i < steps.length - 1 && (
            <span className="pdr-flow__arrow"><Icon name="arrowRight" size={14} /></span>
          )}
        </Fragment>
      ))}
    </div>
  );
}
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

export default function VisualiserMcpPlan() {
  const [view, setView] = useState('Overview');

  return (
    <div className="pt-module syl">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="pt-card syl-head">
        <div className="syl-head__meta">
          <p className="syl-head__tag">{HEAD.tag}</p>
          <h3 className="syl-head__title">{HEAD.title}</h3>
          <p className="syl-head__thesis">{HEAD.thesis}</p>
        </div>
        <div className="syl-head__phase">
          <span className="syl-head__phase-label">Status</span>
          <span className="syl-phasechip">{HEAD.phase}</span>
        </div>
      </header>

      {/* ── Tabs ────────────────────────────────────────────────────────── */}
      <div className="syl-seg" role="tablist" aria-label="Visualiser MCP plan sections">
        {VIEWS.map((v) => (
          <button key={v} role="tab" aria-selected={v === view}
                  className={`syl-seg__tab${v === view ? ' syl-seg__tab--active' : ''}`}
                  onClick={() => setView(v)}>
            {v}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW ────────────────────────────────────────────────────── */}
      {view === 'Overview' && (
        <div className="syl-panel" role="tabpanel">
          <div className="syl-signals">
            {SIGNALS.map((s) => (
              <div key={s.label} className={`pt-card syl-signal${s.accent ? ' syl-signal--accent' : ''}`}>
                <span className="syl-signal__v">{s.value}</span>
                <span className="syl-signal__l">{s.label}</span>
              </div>
            ))}
          </div>
          <Northstar kicker="The goal" accent>
            Point Claude Code at any repo and say <strong>“visualise this file”</strong> — a walkthrough appears
            (or grows) in the studio: the exact source on the left, an animated explanation on the right. The
            walkthrough is data in Supabase, so it accumulates across sessions: every instruction adds a file or
            a chapter, never rebuilds from scratch.
          </Northstar>
          <Northstar kicker="Why it already works on paper">
            Both halves are proven in this portal. <strong>CodeVisualiser</strong> is the target UX with the
            chapters hand-written as JSX; <strong>Deck Studio</strong> is the exact pipeline (MCP → JSON blob →
            renderer) with slides instead of chapters. The product is the fusion: CodeVisualiser’s chapters,
            delivered through Deck Studio’s plumbing.
          </Northstar>
          <div>
            <span className="syl-kicker">The two reference implementations</span>
            <FeatureList items={LINEAGE} />
          </div>
          <BulletCard kicker="Design principles" items={PRINCIPLES} />
        </div>
      )}

      {/* ── ARCHITECTURE ────────────────────────────────────────────────── */}
      {view === 'Architecture' && (
        <div className="syl-panel" role="tabpanel">
          <p className="syl-intro">
            Same stack as this portfolio, rebuilt greenfield in its own repo: one site Worker (SPA + read API),
            one MCP Worker (writes), one Supabase table. The current repo contents are a stock Vite scaffold —
            this is a full overhaul, not a migration.
          </p>
          <div className="pt-card syl-monet">
            <span className="syl-kicker syl-kicker--accent">The write path</span>
            <Flow steps={WRITE_PATH} />
          </div>
          <FeatureList items={ARCH} />
          <Code file="Documents/business/codebase-visualiser" label="repo layout">{REPO_TREE}</Code>
        </div>
      )}

      {/* ── DATA MODEL ──────────────────────────────────────────────────── */}
      {view === 'Data Model' && (
        <div className="syl-panel" role="tabpanel">
          <p className="syl-intro">
            The Deck Studio pattern verbatim: one row per visualisation, the whole walkthrough in a single
            <code> doc</code> jsonb blob, camelCase in the app ↔ snake_case in the DB, RLS locked to the Workers.
          </p>
          <Code file="doc — the JSON contract" label="shape">{DOC_CONTRACT}</Code>
          <Code file="supabase · SQL editor" label="sql">{SCHEMA_SQL}</Code>
          <BulletCard kicker="Why one blob — and how it stays honest" items={MODEL_NOTES} />
        </div>
      )}

      {/* ── MCP TOOLS ───────────────────────────────────────────────────── */}
      {view === 'MCP Tools' && (
        <div className="syl-panel" role="tabpanel">
          <p className="syl-intro">
            Nine tools on one remote MCP Worker (Durable Object McpAgent, /sse + /mcp) — the mcp-portal server
            with a chapter engine instead of a slide engine.
          </p>
          <CompareTable head={TOOLS_HEAD} rows={TOOLS_ROWS} />
          <Code file="example — the incremental unit of work" label="tool call">{TOOL_EXAMPLE}</Code>
          <BulletCard kicker="Surface conventions (kept consistent with Deck Studio)" items={TOOL_NOTES} />
        </div>
      )}

      {/* ── RIGHT PANEL ─────────────────────────────────────────────────── */}
      {view === 'Right Panel' && (
        <div className="syl-panel" role="tabpanel">
          <p className="syl-intro">
            The load-bearing decision: how does an MCP tool deliver an <em>animated, diagram-rich</em> explanation
            without shipping arbitrary markup? Options considered:
          </p>
          <CompareTable head={RENDER_HEAD} rows={RENDER_ROWS} />
          <div>
            <span className="syl-kicker">The trade-off</span>
            <Tradeoff t={RENDER_TRADEOFF} />
          </div>
          <Northstar kicker="The call" accent>
            A <strong>typed viz-primitive library</strong>: Claude composes JSON specs; hand-built React
            components render them with deterministic quality — animation, theme tokens, reduced-motion and
            (later) editability all solved once per primitive instead of once per walkthrough. The
            <strong> diagram</strong> escape hatch (sanitised, currentColor-forced SVG) covers the long tail
            without opening the arbitrary-markup door.
          </Northstar>
          <div>
            <span className="syl-kicker">Primitive catalogue · v1 (each maps to a proven CodeVisualiser chapter)</span>
            <FeatureList items={PRIMITIVES} />
          </div>
          <BulletCard kicker="Animation & interaction rules" items={ANIMATION_RULES} />
        </div>
      )}

      {/* ── ROADMAP ─────────────────────────────────────────────────────── */}
      {view === 'Roadmap' && (
        <div className="syl-panel" role="tabpanel">
          <p className="syl-intro">
            Six phases, each with a hard exit criterion. Phases 0–1 are scaffolding a fresh Claude Code instance
            can run start-to-finish from the bootstrap guide; the studio becomes real at phase 4.
          </p>
          <div className="syl-phases">
            {PHASES.map((p) => (
              <div key={p.label} className={`pt-card syl-phase syl-phase--${p.state}`}>
                <span className="syl-phase__marker" />
                <div>
                  <h5 className="syl-phase__label">{p.label}</h5>
                  <p className="syl-phase__body">{p.body}</p>
                </div>
              </div>
            ))}
          </div>
          <Northstar kicker="The bootstrap guide">
            The standalone build guide for a fresh Claude Code instance —
            <strong> Documents/portal-documents/projects/codebase-visualiser-setup.md</strong> in this repo —
            is self-contained: repo overhaul, wrangler configs, Worker code, Supabase SQL, the full MCP server,
            the viewer skeleton and the primitive specs, plus deploy + verification steps.
          </Northstar>
        </div>
      )}

      {/* ── DECISIONS ───────────────────────────────────────────────────── */}
      {view === 'Decisions' && (
        <div className="syl-panel" role="tabpanel">
          <p className="syl-intro">
            Flagged during planning, resolved with James on 2026-07-08 — recorded here so this plan and the
            bootstrap guide stay in sync.
          </p>
          <BulletCard kicker="The calls (all locked in)" accent items={DECISIONS} />
        </div>
      )}
    </div>
  );
}
