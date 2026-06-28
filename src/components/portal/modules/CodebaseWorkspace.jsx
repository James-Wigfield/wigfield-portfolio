import { useMemo, useState } from 'react';
import Icon from '../icons';

/* ============================================================================
   CODEBASE WORKSPACE — interactive product prototype  (Business section)
   ----------------------------------------------------------------------------
   The companion to CodebaseTracker.jsx (the strategy brief): this is a working
   MOCK of the tool itself. It shows what it looks like to track a codebase as a
   live, editable dependency graph — the product's "source of truth".

   Three demo lenses, switched from the toolbar:
     Map         click a module to trace what it imports / what imports it
     Blast       click a module to simulate the blast radius of changing it (BFS
                 over reverse-dependency edges, coloured by hops)
     Lint        the architectural linter gates a proposed AI diff that would
                 wire the UI layer straight into Data — blocked before any write

   Everything here is mock data — the constants below are the source of truth.
   Styled with the portal's Reading Room tokens via the .cbw-* classes in
   portal.css; self-contained, so it never touches the .cbt-* brief styles.
   ========================================================================== */

// Layered architecture, left → right = dependency direction.
const COL = { ui: 92, api: 305, domain: 518, data: 731 };
const LAYERS = [
  { key: 'ui',     name: 'UI',      sub: 'client components', col: COL.ui },
  { key: 'api',    name: 'Service', sub: 'API & adapters',    col: COL.api },
  { key: 'domain', name: 'Domain',  sub: 'business logic',     col: COL.domain },
  { key: 'data',   name: 'Data',    sub: 'persistence',        col: COL.data },
];

// risk = how costly this module is to change (a hub vs a leaf).
const NODES = [
  { id: 'dashboard',  label: 'Dashboard.tsx',     layer: 'ui',     x: COL.ui,     y: 92,  risk: 'high', loc: 412, path: 'src/ui/Dashboard.tsx',          changed: '2 days ago' },
  { id: 'login',      label: 'LoginForm.tsx',     layer: 'ui',     x: COL.ui,     y: 196, risk: 'low',  loc: 138, path: 'src/ui/LoginForm.tsx',          changed: '3 weeks ago' },
  { id: 'report',     label: 'ReportView.tsx',    layer: 'ui',     x: COL.ui,     y: 300, risk: 'med',  loc: 264, path: 'src/ui/ReportView.tsx',         changed: '5 days ago' },
  { id: 'sidebar',    label: 'Sidebar.tsx',       layer: 'ui',     x: COL.ui,     y: 404, risk: 'low',  loc: 96,  path: 'src/ui/Sidebar.tsx',            changed: '1 month ago' },

  { id: 'apiClient',  label: 'apiClient.ts',      layer: 'api',    x: COL.api,    y: 120, risk: 'med',  loc: 203, path: 'src/services/apiClient.ts',     changed: '6 days ago' },
  { id: 'authSvc',    label: 'authService.ts',    layer: 'api',    x: COL.api,    y: 248, risk: 'med',  loc: 177, path: 'src/services/authService.ts',   changed: '4 days ago' },
  { id: 'reportSvc',  label: 'reportService.ts',  layer: 'api',    x: COL.api,    y: 376, risk: 'low',  loc: 121, path: 'src/services/reportService.ts', changed: '5 days ago' },

  { id: 'userModel',  label: 'userModel.ts',      layer: 'domain', x: COL.domain, y: 120, risk: 'low',  loc: 142, path: 'src/domain/userModel.ts',       changed: '2 weeks ago' },
  { id: 'authDomain', label: 'authDomain.ts',     layer: 'domain', x: COL.domain, y: 248, risk: 'high', loc: 318, path: 'src/domain/authDomain.ts',      changed: 'just now' },
  { id: 'reportModel',label: 'reportModel.ts',    layer: 'domain', x: COL.domain, y: 376, risk: 'low',  loc: 109, path: 'src/domain/reportModel.ts',     changed: '5 days ago' },

  { id: 'db',         label: 'db.ts',             layer: 'data',   x: COL.data,   y: 168, risk: 'high', loc: 286, path: 'src/data/db.ts',                changed: '1 week ago' },
  { id: 'cache',      label: 'redisCache.ts',     layer: 'data',   x: COL.data,   y: 312, risk: 'low',  loc: 74,  path: 'src/data/redisCache.ts',        changed: 'just now' },
];

// kind 'import' = a real edge in the graph; 'proposed' = the AI diff the linter
// is currently holding at the gate (rendered dashed + pulsing).
const EDGES = [
  { from: 'dashboard',   to: 'apiClient' },
  { from: 'dashboard',   to: 'reportSvc' },
  { from: 'login',       to: 'authSvc' },
  { from: 'report',      to: 'reportSvc' },
  { from: 'sidebar',     to: 'apiClient' },
  { from: 'apiClient',   to: 'userModel' },
  { from: 'apiClient',   to: 'authDomain' },
  { from: 'authSvc',     to: 'authDomain' },
  { from: 'reportSvc',   to: 'reportModel' },
  { from: 'userModel',   to: 'db' },
  { from: 'authDomain',  to: 'db' },
  { from: 'authDomain',  to: 'cache' },
  { from: 'reportModel', to: 'db' },
  { from: 'dashboard',   to: 'db', kind: 'proposed' }, // ← blocked by the linter
];

const PROPOSED = EDGES.find((e) => e.kind === 'proposed');
const REAL_EDGES = EDGES.filter((e) => e.kind !== 'proposed');
const NODE_BY_ID = Object.fromEntries(NODES.map((n) => [n.id, n]));

const NODE_W = 140;
const NODE_H = 34;
const VIEW_W = 824;
const VIEW_H = 472;

const MODES = [
  { key: 'map',   label: 'Map',          hint: 'Click a module to trace its imports and dependents.' },
  { key: 'blast', label: 'Blast radius', hint: 'Click a module to simulate the impact of changing it.' },
  { key: 'lint',  label: 'Linter',       hint: 'The architectural linter is gating 1 proposed diff.' },
];

const SEED_LOG = [
  { role: 'agent', tone: 'ok',    text: 'Indexed 12 modules · 38 symbols in 0.4 ms over stdio MCP. The graph is the source of truth.' },
  { role: 'you',   text: 'Add a redis-backed cache to auth.' },
  { role: 'agent', tone: 'ok',    text: 'Inserted redisCache.ts → authDomain, generated the client + config. Linter passed — 2 files written.' },
  { role: 'you',   text: 'Let Dashboard read from db directly to speed up the report.' },
  { role: 'agent', tone: 'block', text: 'Rejected — that imports the Data layer straight into UI, violating the Layered contract. Nothing written; route it through reportService instead.' },
];

// ── graph helpers ────────────────────────────────────────────────────────────
// curve from the right edge of `a` to the left edge of `b`; the path ends
// horizontally so a right-pointing arrowhead reads correctly at the target.
function edgePath(a, b) {
  const x1 = a.x + NODE_W / 2;
  const x2 = b.x - NODE_W / 2;
  const mx = (x1 + x2) / 2;
  return `M${x1},${a.y} C${mx},${a.y} ${mx},${b.y} ${x2},${b.y}`;
}
function arrowHead(b) {
  const x = b.x - NODE_W / 2;
  return `${x - 8},${b.y - 4.5} ${x},${b.y} ${x - 8},${b.y + 4.5}`;
}

// transitive dependents (who imports me, then who imports them …) by hop count.
const DEPENDENTS = REAL_EDGES.reduce((m, e) => {
  (m[e.to] ||= []).push(e.from);
  return m;
}, {});
function blastFrom(id) {
  const depth = {};
  const queue = [[id, 0]];
  const seen = new Set([id]);
  while (queue.length) {
    const [node, d] = queue.shift();
    for (const importer of DEPENDENTS[node] || []) {
      if (!seen.has(importer)) {
        seen.add(importer);
        depth[importer] = d + 1;
        queue.push([importer, d + 1]);
      }
    }
  }
  return depth; // { id: hops } — excludes the selected node itself
}

function agentReply(text) {
  const t = text.toLowerCase();
  const uiHit = /dashboard|sidebar|loginform|reportview|ui|component|client/.test(t);
  const dataHit = /\bdb\b|database|sql|data layer|redis|persistence|cache/.test(t);
  if (uiHit && dataHit) {
    return { role: 'agent', tone: 'block', text: 'Rejected — that would wire the UI layer straight into Data, violating the Layered contract. No files written.' };
  }
  return { role: 'agent', tone: 'ok', text: 'Parsed against the live graph. Proposed a diff, simulated the blast radius, and the linter passed — ready to apply.' };
}

export default function CodebaseWorkspace() {
  const [mode, setMode] = useState('map');
  const [selected, setSelected] = useState('db');
  const [query, setQuery] = useState('');
  const [log, setLog] = useState(SEED_LOG);
  const [draft, setDraft] = useState('');

  const sel = selected ? NODE_BY_ID[selected] : null;

  const blast = useMemo(() => (selected ? blastFrom(selected) : {}), [selected]);
  const neighbours = useMemo(() => {
    if (!selected) return new Set();
    const set = new Set();
    REAL_EDGES.forEach((e) => {
      if (e.from === selected) set.add(e.to);
      if (e.to === selected) set.add(e.from);
    });
    return set;
  }, [selected]);

  const stats = useMemo(() => {
    if (!sel) return null;
    const imports = REAL_EDGES.filter((e) => e.from === sel.id).length;
    const importedBy = REAL_EDGES.filter((e) => e.to === sel.id).length;
    return { imports, importedBy, blast: Object.keys(blastFrom(sel.id)).length };
  }, [sel]);

  const layerCounts = useMemo(
    () => Object.fromEntries(LAYERS.map((l) => [l.key, NODES.filter((n) => n.layer === l.key).length])),
    [],
  );

  const activeHint = MODES.find((m) => m.key === mode)?.hint;

  const pick = (id) => setSelected((cur) => (cur === id ? null : id));

  const send = (e) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setLog((l) => [...l, { role: 'you', text }, agentReply(text)]);
    setDraft('');
  };

  // ── per-element visual state ──────────────────────────────────────────────
  const nodeTone = (n) => {
    if (mode === 'lint') {
      if (n.id === selected) return 'sel';
      if (n.id === PROPOSED.from || n.id === PROPOSED.to) return 'viol';
      return 'faint';
    }
    if (!selected) return 'base';
    if (n.id === selected) return 'sel';
    if (mode === 'blast') {
      const d = blast[n.id];
      return d ? `heat${Math.min(d, 3)}` : 'dim';
    }
    return neighbours.has(n.id) ? 'rel' : 'dim';
  };

  const edgeTone = (e) => {
    if (e.kind === 'proposed') return mode === 'lint' ? 'violpulse' : 'viol';
    if (mode === 'lint') return 'faint';
    if (!selected) return 'base';
    if (mode === 'blast') {
      const inSet = (id) => id === selected || blast[id] !== undefined;
      return inSet(e.from) && inSet(e.to) ? 'heat' : 'dim';
    }
    return e.from === selected || e.to === selected ? 'active' : 'dim';
  };

  return (
    <div className="pt-module cbw">

      {/* ── Toolbar ───────────────────────────────────────────────────────── */}
      <header className="pt-card cbw-bar">
        <div className="cbw-bar__repo">
          <span className="cbw-bar__dot" aria-hidden="true" />
          <span className="cbw-bar__repo-name">acme-platform</span>
          <span className="cbw-bar__branch"><Icon name="swap" size={12} /> main</span>
          <span className="cbw-bar__index">12 modules · indexed 0.4 ms</span>
        </div>

        <div className="cbw-seg" role="tablist" aria-label="Graph lens">
          {MODES.map((m) => (
            <button key={m.key} role="tab" aria-selected={m.key === mode}
                    className={`cbw-seg__tab${m.key === mode ? ' cbw-seg__tab--active' : ''}`}
                    onClick={() => setMode(m.key)}>
              {m.label}
            </button>
          ))}
        </div>

        <label className="cbw-search">
          <Icon name="codebase" size={14} />
          <input value={query} onChange={(e) => setQuery(e.target.value)}
                 placeholder="Query the graph — who imports db.ts?" />
        </label>
      </header>

      {/* ── Stage: rail · canvas · panel ──────────────────────────────────── */}
      <div className="cbw-stage">

        {/* ── Left rail ───────────────────────────────────────────────────── */}
        <aside className="cbw-rail">
          <div className="pt-card cbw-card cbw-index">
            <div className="cbw-card__head">
              <span className="cbw-live"><span className="cbw-live__dot" /> Index live</span>
            </div>
            <ul className="cbw-index__list">
              <li><span>engine</span><code>tree-sitter → SQLite</code></li>
              <li><span>symbols</span><code>38 resolved</code></li>
              <li><span>query</span><code>0.4 ms · stdio MCP</code></li>
              <li><span>assets</span><code>bundled · offline</code></li>
            </ul>
          </div>

          <div className="pt-card cbw-card cbw-layers">
            <div className="cbw-card__head"><span className="cbw-card__title">Layers</span></div>
            {LAYERS.map((l) => (
              <div key={l.key} className={`cbw-layer cbw-layer--${l.key}`}>
                <span className="cbw-layer__swatch" />
                <span className="cbw-layer__name">{l.name}</span>
                <span className="cbw-layer__sub">{l.sub}</span>
                <span className="cbw-layer__count">{layerCounts[l.key]}</span>
              </div>
            ))}
          </div>

          <div className="pt-card cbw-card cbw-contracts">
            <div className="cbw-card__head"><span className="cbw-card__title">Contracts</span></div>
            <p className="cbw-contracts__rule">
              Layered &nbsp;<code>UI → Service → Domain → Data</code>
            </p>
            <div className="cbw-contracts__status cbw-contracts__status--bad">
              <Icon name="shield" size={14} />
              1 proposed diff blocked
            </div>
          </div>
        </aside>

        {/* ── Canvas ──────────────────────────────────────────────────────── */}
        <section className="pt-card cbw-canvas">
          <svg className="cbw-svg" viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
               role="img" aria-label="Codebase dependency graph"
               onClick={() => setSelected(null)}>
            {/* layer bands + headers */}
            {LAYERS.map((l) => (
              <g key={l.key}>
                <rect className="cbw-band" x={l.col - 85} y={46} width={170} height={406} rx={10} />
                <text className="cbw-band__label" x={l.col} y={32} textAnchor="middle">
                  {l.name.toUpperCase()}
                </text>
              </g>
            ))}

            {/* edges (drawn under nodes) */}
            <g className="cbw-edges">
              {EDGES.map((e, i) => {
                const a = NODE_BY_ID[e.from];
                const b = NODE_BY_ID[e.to];
                return (
                  <g key={i} className={`cbw-edge cbw-edge--${edgeTone(e)}`}>
                    <path className="cbw-edge__line" d={edgePath(a, b)} fill="none" />
                    <polygon className="cbw-edge__head" points={arrowHead(b)} />
                  </g>
                );
              })}
            </g>

            {/* nodes */}
            <g className="cbw-nodes">
              {NODES.map((n) => (
                <g key={n.id} className={`cbw-node cbw-node--${nodeTone(n)}`}
                   transform={`translate(${n.x},${n.y})`}
                   role="button" tabIndex={0}
                   aria-pressed={n.id === selected}
                   onClick={(ev) => { ev.stopPropagation(); pick(n.id); }}
                   onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); pick(n.id); } }}>
                  <rect className="cbw-node__box" x={-NODE_W / 2} y={-NODE_H / 2}
                        width={NODE_W} height={NODE_H} rx={5} />
                  <circle className={`cbw-node__risk cbw-node__risk--${n.risk}`}
                          cx={-NODE_W / 2 + 13} cy={0} r={3.6} />
                  <text className="cbw-node__label" x={-NODE_W / 2 + 25} y={1}
                        dominantBaseline="middle">{n.label}</text>
                </g>
              ))}
            </g>
          </svg>

          <div className="cbw-canvas__foot">
            <span className="cbw-canvas__hint">{activeHint}</span>
            <span className="cbw-canvas__meta">12 modules · 13 imports · 1 blocked</span>
          </div>
        </section>

        {/* ── Right panel: inspector + linter ─────────────────────────────── */}
        <aside className="cbw-panel">
          <div className="pt-card cbw-card cbw-inspect">
            <div className="cbw-card__head"><span className="cbw-card__title">Inspector</span></div>
            {sel ? (
              <div className="cbw-inspect__body" key={sel.id}>
                <div className="cbw-inspect__name">
                  <span className={`cbw-node__risk cbw-node__risk--${sel.risk} cbw-inspect__risk`} />
                  {sel.label}
                </div>
                <code className="cbw-inspect__path">{sel.path}</code>
                <div className="cbw-inspect__badges">
                  <span className={`cbw-badge cbw-badge--${sel.layer}`}>{LAYERS.find((l) => l.key === sel.layer)?.name}</span>
                  <span className={`cbw-badge cbw-badge--risk-${sel.risk}`}>{sel.risk}-risk</span>
                </div>
                <div className="cbw-inspect__metrics">
                  <div><b>{stats.imports}</b><span>imports</span></div>
                  <div><b>{stats.importedBy}</b><span>imported by</span></div>
                  <div className={stats.blast >= 6 ? 'cbw-metric--hot' : ''}><b>{stats.blast}</b><span>blast radius</span></div>
                  <div><b>{sel.loc}</b><span>lines</span></div>
                </div>
                <p className="cbw-inspect__foot">
                  last changed <em>{sel.changed}</em>
                  {stats.blast >= 6 && <span className="cbw-inspect__warn"> · high-impact hub</span>}
                </p>
              </div>
            ) : (
              <p className="cbw-empty">Select a module on the canvas to inspect its dependencies, blast radius and risk.</p>
            )}
          </div>

          <div className="pt-card cbw-card cbw-linter">
            <div className="cbw-card__head">
              <span className="cbw-card__title"><Icon name="shield" size={14} /> Architectural linter</span>
              <span className="cbw-chip cbw-chip--block">Blocked</span>
            </div>
            <p className="cbw-linter__lead">Diff intercepted before write:</p>
            <div className="cbw-linter__diff">
              <code>{NODE_BY_ID[PROPOSED.from].label}</code>
              <span className="cbw-linter__arrow"><Icon name="arrowRight" size={13} /></span>
              <code className="cbw-linter__bad">{NODE_BY_ID[PROPOSED.to].label}</code>
            </div>
            <p className="cbw-linter__why">
              UI layer may not import the Data layer directly — this skips Service &amp; Domain
              and violates the <strong>Layered</strong> contract.
            </p>
            <p className="cbw-linter__fix">
              <span className="cbw-linter__fix-label">Suggested</span>
              route the read through <code>reportService.ts</code>.
            </p>
          </div>
        </aside>
      </div>

      {/* ── Agent console ─────────────────────────────────────────────────── */}
      <section className="pt-card cbw-console">
        <div className="cbw-console__head">
          <span className="cbw-card__title">Agent · MCP session</span>
          <span className="cbw-console__sub">edits compile to code · code updates the graph</span>
        </div>
        <div className="cbw-log">
          {log.map((m, i) => (
            <div key={i} className={`cbw-msg cbw-msg--${m.role}`}>
              <span className="cbw-msg__who">{m.role === 'you' ? 'you' : 'agent'}</span>
              <span className="cbw-msg__text">
                {m.tone && (
                  <span className={`cbw-chip cbw-chip--${m.tone === 'block' ? 'block' : 'ok'}`}>
                    {m.tone === 'block' ? 'Rejected' : 'Linter passed'}
                  </span>
                )}
                {m.text}
              </span>
            </div>
          ))}
        </div>
        <form className="cbw-ask" onSubmit={send}>
          <input className="cbw-ask__input" value={draft} onChange={(e) => setDraft(e.target.value)}
                 placeholder="Ask the agent to evolve the architecture…" />
          <button type="submit" className="cbw-ask__send">
            Propose <Icon name="arrowRight" size={14} />
          </button>
        </form>
      </section>
    </div>
  );
}
