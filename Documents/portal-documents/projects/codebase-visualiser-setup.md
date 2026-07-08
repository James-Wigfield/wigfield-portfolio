# Codebase Visualiser — bootstrap guide

> **Audience:** a fresh Claude Code instance with **no prior context**, opened in
> `C:\Users\james\Documents\business\codebase-visualiser`.
> **Mission:** overhaul that repo into the Codebase Visualiser product described below —
> a Cloudflare-Worker-hosted React app with Supabase persistence and a remote MCP server
> that lets Claude Code build code walkthroughs incrementally.
>
> This guide is self-contained, but two working reference implementations exist on this
> machine and are worth reading before you write code:
>
> | Reference | Path | What it proves |
> |---|---|---|
> | Target UX | `C:\Users\james\Documents\personal-projects\wigfield-portfolio\src\components\portal\modules\CodeVisualiser.jsx` | The two-pane walkthrough: exact code + real line numbers on the left, animated interactive diagrams on the right, chapter by chapter |
> | Persistence + MCP pattern | `C:\Users\james\Documents\personal-projects\wigfield-portfolio\src\components\portal\modules\DeckStudio.jsx`, `...\src\components\portal\data\presentationsApi.js`, `...\workers\app.js`, `...\mcp-portal\src\index.js` | MCP Worker → zod-validated spec → JSON blob in Supabase → site Worker `/api` → React renderer |

---

## 1. What you are building

**Codebase Visualiser** turns real source files into side-by-side walkthroughs:

- **Left panel** — the *exact* source code (the literal file text, stored verbatim),
  syntax-highlighted with **real line numbers**, in a fixed dark "IDE" palette.
  A VS-Code-shaped shell: Explorer rail listing files, tabs, a *Walkthrough / Full file* toggle.
- **Right panel** — per chapter (a line range of the file), short markdown prose plus
  **animated, interactive diagrams**: dataflow graphs with travelling pulses, scan-order
  steppers with play/pause/scrub, variant toggles, terminals, tables.

The whole walkthrough is **data**: one JSON blob per visualisation in a Supabase table.
Claude Code (connected to the MCP server you'll deploy) grows it incrementally —
`create_visualisation` once, then `add_file` / `add_chapter` as the underlying codebase evolves.

```
Claude Code ──(MCP tool call)──▶ MCP Worker ──(zod validate + secret key)──▶ Supabase (doc jsonb)
                                                                                   │
Browser ◀──(React viewer)── Site Worker /api ◀──────(secret key, RLS bypass)──────┘
```

### Non-negotiable design principles

1. **The left pane is real code.** The blob stores the exact file text; line numbers shown
   are the file's real line numbers. Never paraphrase or reformat the source.
2. **The right pane is data, not markup.** Claude sends typed viz specs (JSON); hand-built
   React primitives do all rendering and animation. No HTML/JSX/script strings in the blob.
3. **Every MCP tool is a small, safe mutation** validated server-side (line ranges checked
   against the stored source; viz specs checked against zod schemas).
4. **Secrets stay in Workers.** The browser never sees the Supabase secret key. The table
   has RLS **on with no policies** — only the Workers can touch it.
5. **Animations**: CSS keyframes + `requestAnimationFrame` steppers only (no animation
   libraries). Every temporal primitive gets play/pause/scrub/reset. Respect
   `prefers-reduced-motion` (autoplay off, scrubbing stays). All colours via CSS tokens.

### Decisions — RESOLVED with James (2026-07-08). Build to these, do not re-litigate.

| Decision | The call |
|---|---|
| Supabase project | **Reuse the portal's existing project** (`https://trcnbmxtudhbuswqmqxy.supabase.co`) — the `visualisations` table lives alongside `presentations`; the new Workers use the same URL + secret key |
| Viewer access | Password-gated (`VIEW_PASSWORD` bearer, portal pattern); public share links are a later phase |
| Syntax highlighting | Hand-rolled stateful tokenizer with per-language keyword tables (zero deps); no Prism/Shiki |
| MCP auth | **Authless** (like the pixel-gif MCP) — do **not** set `MCP_AUTH_TOKEN`; keep the guard function in the code so auth can be enabled later |
| Branding | Standalone product ("Codebase Visualiser"), not under Portara |

---

## 2. Phase 0 — overhaul & scaffold

The existing folder is a **stock Vite React scaffold — wipe it**. Keep `.git` if present.

```powershell
# from C:\Users\james\Documents\business\codebase-visualiser
Remove-Item -Recurse -Force src, public, dist, node_modules -ErrorAction SilentlyContinue
Remove-Item -Force index.html, vite.config.js, .oxlintrc.json, README.md, package.json, package-lock.json -ErrorAction SilentlyContinue
```

### Target repo layout

```
codebase-visualiser/
├── wrangler.jsonc            # site worker: ASSETS + /api  (run_worker_first)
├── package.json
├── vite.config.js
├── index.html
├── .dev.vars                 # local secrets (gitignored)
├── .gitignore
├── workers/
│   └── app.js                # serves dist/ + /api/visualisations (secret key)
├── mcp/                      # the MCP wrapper — its own deploy unit
│   ├── wrangler.jsonc
│   ├── package.json
│   ├── .dev.vars
│   └── src/index.js          # 9 tools, zod specs, validation engine
└── src/                      # Vite + React 19 viewer
    ├── main.jsx
    ├── App.jsx
    ├── styles/app.css        # theme tokens + fixed IDE code palette
    ├── model/docModel.js     # the JSON contract + SAMPLE_DOC fallback
    ├── data/api.js           # /api client — { data, error }, never throws
    └── components/
        ├── Explorer.jsx      # file tree rail
        ├── CodePane.jsx      # highlighter + line numbers
        ├── Chapter.jsx       # chapter shell (code col · viz col)
        └── viz/
            ├── index.jsx     # VizSpec → component dispatcher
            ├── animKit.js    # usePlayer (play/pause/scrub), useReducedMotion
            ├── Flow.jsx  Sequence.jsx  Steps.jsx  Compare.jsx
            ├── Terminal.jsx  Table.jsx  Kv.jsx  Stats.jsx
            ├── Callout.jsx   Diagram.jsx
            └── …
```

### Root `package.json`

```json
{
  "name": "codebase-visualiser",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "cf:dev": "npm run build && wrangler dev",
    "deploy": "npm run build && wrangler deploy",
    "lint": "eslint src workers"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.50.0",
    "react": "^19.2.0",
    "react-dom": "^19.2.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^6.0.0",
    "eslint": "^9.0.0",
    "vite": "^8.0.0",
    "wrangler": "^4.0.0"
  }
}
```

(Adjust minor versions to whatever `npm install` resolves; pin only if CF deploy complains.
Known trap from the portfolio repo: Vite 8 / rolldown may need `@emnapi/core` +
`@emnapi/runtime` as explicit `optionalDependencies` for Linux CI installs — only add
if a Cloudflare build ever fails with "Missing: @emnapi/... from lock file".)

### Root `wrangler.jsonc`

```jsonc
{
  // Site worker: serves the built SPA + hosts the /api layer (server-side secrets).
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "codebase-visualiser",
  "main": "workers/app.js",
  "compatibility_date": "2026-07-01",
  "compatibility_flags": ["nodejs_compat"],
  "assets": {
    "directory": "./dist",
    "binding": "ASSETS",
    "not_found_handling": "single-page-application",
    "run_worker_first": true
  },
  "vars": {
    // The portal's existing Supabase project (shared — decided 2026-07-08)
    "SUPABASE_URL": "https://trcnbmxtudhbuswqmqxy.supabase.co"
  },
  "observability": { "enabled": true }
}
```

### `vite.config.js`, `index.html`, `.gitignore`

Standard Vite React setup. `.gitignore` must include `node_modules`, `dist`, `.dev.vars`,
`.wrangler`. In `index.html` set the title to *Codebase Visualiser*.

### Minimal `src/` to prove the deploy loop

`src/main.jsx` mounts `<App />`; `App.jsx` renders a placeholder shell. Then:

```powershell
npm install
npm run deploy       # first deploy — may prompt wrangler login
curl https://codebase-visualiser.<account>.workers.dev/api/health
```

**Exit criterion:** the deployed URL serves the app; `/api/health` returns
`{ ok: true, supabaseConfigured: false }`.

---

## 3. Phase 1 — Supabase + read API

### 3.1 Create the table (in the portal's EXISTING Supabase project)

Do **not** create a new Supabase project — the decision is to reuse the portal's
(`https://trcnbmxtudhbuswqmqxy.supabase.co`, the same project that holds `presentations`).
The `visualisations` table name doesn't collide with anything there. In that project's
SQL editor run:

```sql
create table visualisations (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  project    text,
  doc        jsonb not null,
  created_by text default 'claude',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table visualisations enable row level security;
-- No policies on purpose: the anon key can do NOTHING. Only the Workers'
-- secret key (which bypasses RLS) can read/write.

create or replace function touch_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

create trigger visualisations_touch before update on visualisations
for each row execute function touch_updated_at();
```

### 3.2 Secrets

- `vars.SUPABASE_URL` is already set to the shared project in **both** `wrangler.jsonc` files.
- Site worker: `wrangler secret put SUPABASE_SECRET_KEY` and `wrangler secret put VIEW_PASSWORD`
  (from repo root). `SUPABASE_SECRET_KEY` is the **same secret/service_role API key** the
  portfolio Workers already use — get it from the Supabase dashboard (API keys), or ask James.
  `VIEW_PASSWORD` can be anything (the portal password is fine).
- Local dev: `.dev.vars` with the same two keys.

### 3.3 `workers/app.js` — complete

```js
/* Site worker: serves the SPA (ASSETS) + /api/visualisations read routes.
   Runs first for every request (run_worker_first) so /api/* always lands here.
   Pattern copied from wigfield-portfolio/workers/app.js. */
import { createClient } from '@supabase/supabase-js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) return handleApi(request, env, url);
    return env.ASSETS.fetch(request);
  },
};

async function handleApi(request, env, url) {
  if (url.pathname === '/api/health') {
    return json({ ok: true, supabaseConfigured: Boolean(env.SUPABASE_URL && env.SUPABASE_SECRET_KEY) });
  }

  //   GET /api/visualisations       → list [{ id, title, project, updatedAt }]  (NO doc — keep it light)
  //   GET /api/visualisations/:id   → one row incl. doc
  if (url.pathname === '/api/visualisations' || url.pathname.startsWith('/api/visualisations/')) {
    const denied = requireViewAuth(request, env);
    if (denied) return denied;
    if (!env.SUPABASE_URL || !env.SUPABASE_SECRET_KEY) {
      return json({ error: 'Supabase not configured (SUPABASE_URL / SUPABASE_SECRET_KEY).' }, 503);
    }
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY);
    const id = url.pathname.startsWith('/api/visualisations/')
      ? decodeURIComponent(url.pathname.slice('/api/visualisations/'.length))
      : null;

    if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);

    if (!id) {
      const { data, error } = await supabase
        .from('visualisations')
        .select('id, title, project, updated_at')
        .order('updated_at', { ascending: false });
      return error ? json({ error: error.message }, 500)
                   : json({ data: data.map((r) => ({ id: r.id, title: r.title, project: r.project, updatedAt: r.updated_at })) });
    }

    const { data, error } = await supabase
      .from('visualisations')
      .select('id, title, project, doc, updated_at')
      .eq('id', id)
      .single();
    if (error) return json({ error: error.message }, error.code === 'PGRST116' ? 404 : 500);
    return json({ data: { id: data.id, title: data.title, project: data.project, doc: data.doc, updatedAt: data.updated_at } });
  }

  return json({ error: 'Not found' }, 404);
}

// Fails CLOSED when VIEW_PASSWORD is unset.
function requireViewAuth(request, env) {
  if (!env.VIEW_PASSWORD) return json({ error: 'Set the VIEW_PASSWORD Worker secret.' }, 503);
  const provided = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (provided !== env.VIEW_PASSWORD) return json({ error: 'Unauthorized' }, 401);
  return null;
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}
```

### 3.4 `src/data/api.js`

Mirror `presentationsApi.js`: every function returns `{ data, error }`, never throws;
the password entered at the app's gate is kept in `sessionStorage` and sent as
`Authorization: Bearer <password>`. Under plain `npm run dev` (no Worker) requests fail →
the viewer falls back to `SAMPLE_DOC`.

**Exit criterion:** insert a row by hand in Supabase (any `{ "version": 1, "files": [] }`
doc), and `GET /api/visualisations` returns it in the browser via the deployed Worker.

---

## 4. The JSON contract (`src/model/docModel.js`)

This is the shape produced by the MCP server, stored in `visualisations.doc`, and rendered
by the viewer. Keep one module as the browser-side source of truth (the `deckModel.js` role).

```js
// Doc = {
//   version: 1,
//   files: [ File ]
// }
// File = {
//   id: string,             // server-assigned (crypto.randomUUID())
//   path: string,           // e.g. 'models/mamba_block_3d.py' — shown in Explorer/tabs
//   lang: string,           // 'py' | 'js' | 'ts' | 'jsx' | 'json' | 'sql' | 'bash' | 'css' | 'text'
//   source: string,         // the EXACT file text — single source of truth
//   chapters: [ Chapter ]
// }
// Chapter = {
//   id: string,
//   title: string,          // 'Flatten a volume into a sequence'
//   tag?: string,           // 'the crux'
//   from: number, to: number, // REAL 1-based inclusive line range into source
//   stale?: boolean,        // set by update_file_source when the range no longer fits
//   prose: string[],        // 1–3 short markdown paragraphs
//   viz: VizSpec[]          // rendered top-to-bottom in the right column
// }
```

### VizSpec — the ten v1 primitives (discriminated on `kind`)

Every primitive: token-driven colours, `aria-label`, reduced-motion fallback. Optional on
all: `highlightLines: [from, to]` — hovering the viz highlights those lines in the code pane.

| `kind` | Spec fields | Renders as | Reference in CodeVisualiser.jsx |
|---|---|---|---|
| `flow` | `nodes: [{ id, label, sub?, kind?: 'io'\|'op'\|'box' }]`, `edges: [{ from, to, label? }]`, `pulse?: bool` | SVG dataflow graph, arrowhead wires, optional travelling pulse animation | `DataflowViz` |
| `sequence` | `grid: { rows, cols, planes? }`, `orders: [{ label, order: 'row'\|'row-rev'\|'col'\|'col-rev'\|number[] }]`, `strip?: bool`, `play?: bool` | Cell grid (+ depth slices) with a numbered scan order, a 1D strip, play/pause/scrub, hover-links grid↔strip | `FlattenViz` (the crown jewel — copy its interaction design) |
| `steps` | `items: [{ label, code? }]` | Numbered pass with cycling highlight | `ForwardViz` |
| `compare` | `options: [{ name, call?, rows: [[k, v]] }]` | Segmented toggle → call signature + kv rows | `BuildViz` |
| `terminal` | `title`, `lines: [{ text, tone?: 'ok'\|'dim'\|'pass'\|'err' }]` | Terminal chrome, tone-coloured lines | `TestViz` |
| `table` | `head: string[]`, `rows: string[][]` | Token-styled comparison table | — |
| `kv` | `rows: [[k, v]]`, `caption?` | Definition-list spec card | `cv-kv` |
| `stats` | `items: [{ value, label, accent? }]` | Big-number tile grid | `cv-resgrid` |
| `callout` | `text` (markdown), `tone?: 'note'\|'warn'` | Short note paragraph | `cv-note` |
| `diagram` | `svg` (string), `caption?` | **Escape hatch**: sanitised static SVG (server strips `script`/event handlers/`foreignObject`; force `currentColor`) | — |

Also export `SAMPLE_DOC`: a small hand-written doc that exercises **every** primitive
(this is the dev fallback and the Phase 3 acceptance test).

---

## 5. Phase 2 — viewer shell

Rebuild the CodeVisualiser shell, generalised to N files from data:

- **Explorer rail** (`Explorer.jsx`): tree built from `doc.files[].path` (split on `/`),
  file rows show `loc`; selecting a file drives the editor pane. Dark fixed palette.
- **Tabs + breadcrumb + view toggle**: *Walkthrough* (chapters) / *Full file* (one scroll).
- **CodePane** (`CodePane.jsx`): renders `source.split('\n')` slices with **real line
  numbers** (`fromLine + idx`) and a lightweight **stateful highlighter** — port the one in
  `CodeVisualiser.jsx` (`highlight()`), refactored to take a language pack
  `{ keywords, builtins, lineComment, tripleQuotes? }` per `lang`. Ship packs for
  `py`, `js/jsx/ts`, `json`, `sql`, `bash`, `css`; unknown langs render plain.
  Token classes: `kw`, `bi`, `str`, `com`, `num`, `dec`, `fn`, `self`, `op` — fixed IDE
  palette (code must read as code under any app theme).
- **Chapter shell** (`Chapter.jsx`): header (number, title, tag, `lines from–to`) + a
  two-column grid — code slice left, prose + viz stack right. A `stale` chapter renders
  a warning strip ("source changed — range may be off").
- **Line-highlight linking**: CodePane accepts `highlightRange`; hovering a viz block with
  `highlightLines` sets it.

**Exit criterion:** `SAMPLE_DOC` (and any real row from the API) renders with working
Explorer, toggle, highlighting and line numbers under `npm run cf:dev`.

## 6. Phase 3 — viz primitives

Build `src/components/viz/` per the table above, plus:

- `animKit.js`: `useReducedMotion()` (matchMedia) and `usePlayer(length, ms)` returning
  `{ step, playing, play, pause, scrub, reset }` — one interval-driven stepper shared by
  `sequence`/`steps`/`flow` pulses.
- `index.jsx`: `<Viz spec onHoverLines />` dispatcher; unknown `kind` renders a "primitive
  not supported (upgrade the app)" callout rather than crashing — old clients must not
  break when the MCP grows new kinds.

**Exit criterion:** every primitive in `SAMPLE_DOC` renders and animates; keyboard +
reduced-motion paths work.

---

## 7. Phase 4 — the MCP server (`mcp/`)

### 7.1 `mcp/wrangler.jsonc`

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "codebase-visualiser-mcp",
  "main": "src/index.js",
  "compatibility_date": "2026-07-01",
  "compatibility_flags": ["nodejs_compat"],
  "durable_objects": {
    "bindings": [{ "name": "MCP_OBJECT", "class_name": "VisualiserMCP" }]
  },
  "migrations": [{ "tag": "v1", "new_sqlite_classes": ["VisualiserMCP"] }],
  "vars": { "SUPABASE_URL": "https://trcnbmxtudhbuswqmqxy.supabase.co" },
  "observability": { "enabled": true }
}
```

### 7.2 `mcp/package.json`

```json
{
  "name": "codebase-visualiser-mcp",
  "private": true,
  "type": "module",
  "scripts": { "dev": "wrangler dev", "deploy": "wrangler deploy" },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "@supabase/supabase-js": "^2.50.0",
    "agents": "^0.0.100",
    "zod": "^3.24.0"
  },
  "devDependencies": { "wrangler": "^4.0.0" }
}
```

(Match the versions used by `wigfield-portfolio/mcp-portal/package.json` if resolution fails.)

### 7.3 `mcp/src/index.js` — complete

```js
/* CODEBASE VISUALISER — remote MCP server (Cloudflare Worker).
   Claude Code ──SSE──▶ this Worker ──secret key──▶ Supabase `visualisations`.
   Same skeleton as wigfield-portfolio/mcp-portal: McpAgent Durable Object,
   /sse + /mcp endpoints, zod-validated tools, short human-readable results. */

import { McpAgent } from 'agents/mcp';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

// ── Viz specs (keep in lockstep with src/model/docModel.js in the viewer) ────
const LINES = z.tuple([z.number().int().min(1), z.number().int().min(1)]).optional()
  .describe('Optional [from,to] line range this viz explains — hovering it highlights those lines');

const VIZ_SPEC = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('flow'), highlightLines: LINES,
    nodes: z.array(z.object({ id: z.string(), label: z.string(), sub: z.string().optional(),
      kind: z.enum(['io', 'op', 'box']).optional() })).min(2),
    edges: z.array(z.object({ from: z.string(), to: z.string(), label: z.string().optional() })).min(1),
    pulse: z.boolean().optional().describe('Animate a travelling pulse along the wires') }),
  z.object({ kind: z.literal('sequence'), highlightLines: LINES,
    grid: z.object({ rows: z.number().int().min(1).max(8), cols: z.number().int().min(1).max(12),
      planes: z.number().int().min(1).max(4).optional() }),
    orders: z.array(z.object({ label: z.string(),
      order: z.union([z.enum(['row', 'row-rev', 'col', 'col-rev']), z.array(z.number().int())]) })).min(1),
    strip: z.boolean().optional(), play: z.boolean().optional() }),
  z.object({ kind: z.literal('steps'), highlightLines: LINES,
    items: z.array(z.object({ label: z.string(), code: z.string().optional() })).min(2) }),
  z.object({ kind: z.literal('compare'), highlightLines: LINES,
    options: z.array(z.object({ name: z.string(), call: z.string().optional(),
      rows: z.array(z.tuple([z.string(), z.string()])) })).min(2) }),
  z.object({ kind: z.literal('terminal'), highlightLines: LINES,
    title: z.string(), lines: z.array(z.object({ text: z.string(),
      tone: z.enum(['ok', 'dim', 'pass', 'err']).optional() })).min(1) }),
  z.object({ kind: z.literal('table'), highlightLines: LINES,
    head: z.array(z.string()).min(2), rows: z.array(z.array(z.string())).min(1) }),
  z.object({ kind: z.literal('kv'), highlightLines: LINES,
    rows: z.array(z.tuple([z.string(), z.string()])).min(1), caption: z.string().optional() }),
  z.object({ kind: z.literal('stats'), highlightLines: LINES,
    items: z.array(z.object({ value: z.string(), label: z.string(), accent: z.boolean().optional() })).min(1) }),
  z.object({ kind: z.literal('callout'), highlightLines: LINES,
    text: z.string(), tone: z.enum(['note', 'warn']).optional() }),
  z.object({ kind: z.literal('diagram'), highlightLines: LINES,
    svg: z.string().describe('Static SVG. ESCAPE HATCH — prefer a typed primitive.'),
    caption: z.string().optional() }),
]);

const CHAPTER_SPEC = z.object({
  title: z.string().describe('Chapter heading, e.g. "Flatten a volume into a sequence"'),
  tag: z.string().optional().describe('Short badge, e.g. "the crux"'),
  from: z.number().int().min(1).describe('First source line of the chapter (1-based, inclusive)'),
  to: z.number().int().min(1).describe('Last source line (inclusive)'),
  prose: z.array(z.string()).min(1).max(3)
    .describe('1–3 SHORT markdown paragraphs. **Bold** key terms; wrap identifiers in `code`.'),
  viz: z.array(VIZ_SPEC).min(1)
    .describe('Diagrams rendered beside the code. PREFER animated kinds (flow / sequence / steps) for behaviour, static kinds (table / kv / stats) for facts. diagram is a last resort.'),
});

// Strip anything executable from escape-hatch SVG and force theme colouring.
function sanitizeSvg(svg) {
  return svg
    .replace(/<\s*(script|foreignObject)[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*')/gi, '')
    .replace(/(xlink:href|href)\s*=\s*("(?!#)[^"]*"|'(?!#)[^']*')/gi, '')
    .replace(/(fill|stroke)\s*=\s*"(?!none)[^"]*"/gi, '$1="currentColor"');
}

function checkRange(chapter, source) {
  const lines = source.split('\n').length;
  if (chapter.to > lines) return `range ${chapter.from}–${chapter.to} exceeds the file (${lines} lines)`;
  if (chapter.from > chapter.to) return `range is inverted (${chapter.from} > ${chapter.to})`;
  return null;
}

function buildChapter(spec) {
  return {
    id: crypto.randomUUID(),
    title: spec.title, tag: spec.tag,
    from: spec.from, to: spec.to,
    prose: spec.prose,
    viz: spec.viz.map((v) => (v.kind === 'diagram' ? { ...v, svg: sanitizeSvg(v.svg) } : v)),
  };
}

const ok = (text) => ({ content: [{ type: 'text', text }] });
const fail = (text) => ({ content: [{ type: 'text', text }], isError: true });

export class VisualiserMCP extends McpAgent {
  server = new McpServer({ name: 'codebase-visualiser', version: '1.0.0' });

  db() { return createClient(this.env.SUPABASE_URL, this.env.SUPABASE_SECRET_KEY); }

  async getDoc(id) {
    const { data, error } = await this.db().from('visualisations').select('doc').eq('id', id).single();
    return error ? { error } : { doc: data.doc };
  }
  async putDoc(id, doc) {
    const { error } = await this.db().from('visualisations').update({ doc }).eq('id', id).select('id').single();
    return error || null;
  }

  async init() {
    this.server.tool(
      'create_visualisation',
      'Create a new (empty) codebase visualisation in the studio. Add files with add_file, then chapters with add_chapter.',
      {
        title: z.string().describe('Visualisation title, e.g. "Mamba_PSMA — model build"'),
        project: z.string().optional().describe('The codebase/repo name shown in the Explorer root'),
      },
      async ({ title, project }) => {
        const doc = { version: 1, files: [] };
        const { data, error } = await this.db().from('visualisations')
          .insert({ title, project: project ?? null, doc, created_by: 'claude' })
          .select('id').single();
        return error ? fail(`Error: ${error.message}`)
                     : ok(`Created "${title}" — id ${data.id}. Now add_file with the exact source text.`);
      },
    );

    this.server.tool('list_visualisations', 'List the visualisations in the studio.', {}, async () => {
      const { data, error } = await this.db().from('visualisations')
        .select('id, title, project, updated_at').order('updated_at', { ascending: false });
      if (error) return fail(`Error: ${error.message}`);
      if (!data.length) return ok('No visualisations yet.');
      return ok(data.map((r) => `• ${r.title}${r.project ? ` [${r.project}]` : ''} — id ${r.id} — updated ${r.updated_at}`).join('\n'));
    });

    this.server.tool(
      'get_visualisation',
      'Fetch one visualisation\'s full doc JSON (inspect file ids / chapter ids before editing).',
      { id: z.string().describe('The visualisation id') },
      async ({ id }) => {
        const { data, error } = await this.db().from('visualisations')
          .select('title, project, doc').eq('id', id).single();
        return error ? fail(`Error: ${error.message}`) : ok(JSON.stringify(data, null, 2));
      },
    );

    this.server.tool(
      'add_file',
      'Add a source file to a visualisation. source must be the EXACT file text (verbatim) — line numbers in the viewer are real line numbers into this string.',
      {
        id: z.string().describe('The visualisation id'),
        path: z.string().describe('Repo-relative path, e.g. models/mamba_block_3d.py'),
        lang: z.enum(['py', 'js', 'jsx', 'ts', 'tsx', 'json', 'sql', 'bash', 'css', 'text']),
        source: z.string().min(1).describe('The exact, complete file contents'),
      },
      async ({ id, path, lang, source }) => {
        const got = await this.getDoc(id);
        if (got.error) return fail(`Error: ${got.error.message}`);
        const doc = got.doc;
        if (doc.files.some((f) => f.path === path)) {
          return fail(`Error: ${path} already exists in this visualisation — use update_file_source to change its code.`);
        }
        const file = { id: crypto.randomUUID(), path, lang, source, chapters: [] };
        doc.files.push(file);
        const err = await this.putDoc(id, doc);
        return err ? fail(`Error: ${err.message}`)
                   : ok(`Added ${path} (${source.split('\n').length} lines) — fileId ${file.id}. Now add_chapter for each region worth explaining.`);
      },
    );

    this.server.tool(
      'update_file_source',
      'Replace a file\'s source after the real code changed. Chapters whose line ranges no longer fit are flagged stale (not deleted) — re-issue them with update_chapter.',
      {
        id: z.string(), fileId: z.string(),
        source: z.string().min(1).describe('The new exact, complete file contents'),
      },
      async ({ id, fileId, source }) => {
        const got = await this.getDoc(id);
        if (got.error) return fail(`Error: ${got.error.message}`);
        const doc = got.doc;
        const file = doc.files.find((f) => f.id === fileId);
        if (!file) return fail(`Error: no file ${fileId} in visualisation ${id}.`);
        file.source = source;
        const stale = [];
        for (const ch of file.chapters) {
          ch.stale = Boolean(checkRange(ch, source));
          if (ch.stale) stale.push(ch.title);
        }
        const err = await this.putDoc(id, doc);
        if (err) return fail(`Error: ${err.message}`);
        return ok(stale.length
          ? `Updated ${file.path}. STALE chapters (range no longer fits): ${stale.join(' · ')} — fix with update_chapter.`
          : `Updated ${file.path}. All ${file.chapters.length} chapter ranges still valid.`);
      },
    );

    this.server.tool(
      'add_chapter',
      'Add one walkthrough chapter to a file: a real line range, 1–3 short markdown paragraphs, and one or more typed viz specs (animated diagrams). This is the incremental unit of work.',
      {
        id: z.string(), fileId: z.string(),
        chapter: CHAPTER_SPEC,
        index: z.number().int().optional().describe('0-based insert position; omit to append'),
      },
      async ({ id, fileId, chapter, index }) => {
        const got = await this.getDoc(id);
        if (got.error) return fail(`Error: ${got.error.message}`);
        const doc = got.doc;
        const file = doc.files.find((f) => f.id === fileId);
        if (!file) return fail(`Error: no file ${fileId} in visualisation ${id}.`);
        const bad = checkRange(chapter, file.source);
        if (bad) return fail(`Error: ${bad}.`);
        const built = buildChapter(chapter);
        const at = Number.isInteger(index) ? Math.max(0, Math.min(index, file.chapters.length)) : file.chapters.length;
        file.chapters.splice(at, 0, built);
        const err = await this.putDoc(id, doc);
        return err ? fail(`Error: ${err.message}`)
                   : ok(`Added chapter "${chapter.title}" (lines ${chapter.from}–${chapter.to}) to ${file.path} at position ${at + 1} (${file.chapters.length} total).`);
      },
    );

    this.server.tool(
      'update_chapter',
      'Replace one chapter in place (same validation as add_chapter). Clears any stale flag.',
      { id: z.string(), fileId: z.string(), chapterId: z.string(), chapter: CHAPTER_SPEC },
      async ({ id, fileId, chapterId, chapter }) => {
        const got = await this.getDoc(id);
        if (got.error) return fail(`Error: ${got.error.message}`);
        const doc = got.doc;
        const file = doc.files.find((f) => f.id === fileId);
        if (!file) return fail(`Error: no file ${fileId}.`);
        const i = file.chapters.findIndex((c) => c.id === chapterId);
        if (i === -1) return fail(`Error: no chapter ${chapterId} in ${file.path}.`);
        const bad = checkRange(chapter, file.source);
        if (bad) return fail(`Error: ${bad}.`);
        file.chapters[i] = { ...buildChapter(chapter), id: chapterId };
        const err = await this.putDoc(id, doc);
        return err ? fail(`Error: ${err.message}`) : ok(`Updated chapter "${chapter.title}" in ${file.path}.`);
      },
    );

    this.server.tool(
      'remove_chapter',
      'Delete one chapter from a file.',
      { id: z.string(), fileId: z.string(), chapterId: z.string() },
      async ({ id, fileId, chapterId }) => {
        const got = await this.getDoc(id);
        if (got.error) return fail(`Error: ${got.error.message}`);
        const doc = got.doc;
        const file = doc.files.find((f) => f.id === fileId);
        if (!file) return fail(`Error: no file ${fileId}.`);
        const before = file.chapters.length;
        file.chapters = file.chapters.filter((c) => c.id !== chapterId);
        if (file.chapters.length === before) return fail(`Error: no chapter ${chapterId} in ${file.path}.`);
        const err = await this.putDoc(id, doc);
        return err ? fail(`Error: ${err.message}`) : ok(`Removed chapter ${chapterId} from ${file.path}.`);
      },
    );

    this.server.tool(
      'delete_visualisation',
      'Delete a whole visualisation from the studio.',
      { id: z.string() },
      async ({ id }) => {
        const { error } = await this.db().from('visualisations').delete().eq('id', id);
        return error ? fail(`Error: ${error.message}`) : ok(`Deleted visualisation ${id}.`);
      },
    );
  }
}

// Shared-secret guard. DECIDED: runs AUTHLESS (leave MCP_AUTH_TOKEN unset, like the
// pixel-gif MCP — the bearer setup fought the deck server). Keep the function so
// auth can be switched on later by just setting the secret.
function authorized(request, env) {
  if (!env.MCP_AUTH_TOKEN) return true;
  return request.headers.get('Authorization') === `Bearer ${env.MCP_AUTH_TOKEN}`;
}

export default {
  fetch(request, env, ctx) {
    if (!authorized(request, env)) return new Response('Unauthorized', { status: 401 });
    const { pathname } = new URL(request.url);
    if (pathname === '/sse' || pathname === '/sse/message') {
      return VisualiserMCP.serveSSE('/sse').fetch(request, env, ctx);
    }
    if (pathname === '/mcp') {
      return VisualiserMCP.serve('/mcp').fetch(request, env, ctx);
    }
    return new Response('codebase-visualiser MCP — connect a client to /sse', { status: 404 });
  },
};
```

### 7.4 Deploy + connect

```powershell
cd mcp
npm install
npx wrangler secret put SUPABASE_SECRET_KEY   # same key as the site worker
npm run deploy
# NOTE: authless by decision — do NOT set MCP_AUTH_TOKEN
```

Connect Claude Code (user scope so it's available everywhere):

```powershell
claude mcp add --transport sse --scope user codebase-visualiser `
  https://codebase-visualiser-mcp.<account>.workers.dev/sse
```

(If SSE gives trouble, use `--transport http` against `/mcp` instead.)

**Exit criterion (end-to-end):** in a Claude Code session on any repo —
`create_visualisation` → `add_file` (paste the exact file) → two `add_chapter` calls
(one `flow`, one `sequence`) → open the deployed viewer → walkthrough renders, animated,
with correct line numbers.

---

## 8. Phase 5 — later (do not build now)

Stale-chapter UX polish, public per-doc share links, an in-app chapter editor (the
DeckEditor analogue), more primitives (dependency `graph`, `memory` layout, `bigO`),
multi-visualisation workspaces per project.

## 9. Verification checklist

- [ ] `/api/health` → `{ ok: true, supabaseConfigured: true }` on the deployed site worker
- [ ] Table has RLS **enabled** and **zero policies**; anon key returns nothing
- [ ] Viewer gate: wrong password → 401; correct → list loads
- [ ] `SAMPLE_DOC` renders every primitive; `prefers-reduced-motion` disables autoplay
- [ ] Line numbers in a chapter match the real file opened in an editor
- [ ] `add_chapter` with `to` beyond EOF → clean tool error (nothing written)
- [ ] `update_file_source` with a shrunken file → affected chapters flagged stale, others intact
- [ ] `diagram` primitive: `<script>`/`onclick` stripped server-side
- [ ] End-to-end MCP flow from a different repo's Claude Code session

## 10. Conventions & style

- Header comment blocks on every substantial file (the `====` banner style used across
  the portfolio repo), explaining what/why, not how.
- CSS: vanilla, token-driven (`:root` custom properties), BEM-ish prefixes per component
  (`.cvz-*` suggested), no CSS frameworks, no animation libraries.
- API modules return `{ data, error }` and never throw. camelCase in app, snake_case in DB.
- Keep the MCP viz schemas and `docModel.js` **in lockstep** — they are two copies of one
  contract; note it in both file headers.
