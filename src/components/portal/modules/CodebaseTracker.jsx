import { useState } from 'react';

/* ============================================================================
   CODEBASE VISUALIZER — strategy / direction brief  (Business section)
   ----------------------------------------------------------------------------
   An interactive distillation of the competitive-analysis report at
   Documents/portal-documents/projects/codebase-tracker-tool.md. The point of
   this view is decision-making: at a glance, "what direction do I build in?".
   Five tabs, each answering one question —
     Direction → what to build first      The Gap → why there's room
     Rivals    → who's already out there   Decay   → the problem being solved
     The Edge  → the defensible moat
   Self-contained (the constants below are the source of truth) and styled with
   the portal's Reading Room tokens via the .cbt-* classes in portal.css.
   ========================================================================== */

const PROJECT = {
  tag: 'Business · R&D',
  title: 'Conversational, MCP-Driven Codebase Visualizer',
  positioning: 'Bidirectional Architectural Compiler & Safeguard',
  thesis:
    'Treat the visual dependency graph as the source of truth — design edits compile to code, ' +
    'code changes update the graph, and an architectural linter blocks any AI diff that violates ' +
    'system boundaries before it is written to disk.',
  verdict: 'Market validated',
  verdictNote: 'No competitor bridges deep code analysis with conversational, bidirectional design.',
  source: 'codebase-tracker-tool.md',
};

const VIEWS = ['Direction', 'The Gap', 'Rivals', 'Decay', 'The Edge'];

// ── Direction ────────────────────────────────────────────────────────────────
const SIGNALS = [
  { value: '0 / 6', label: 'rivals close the loop', accent: true },
  { value: '2', label: 'incumbent camps to beat' },
  { value: '<1 ms', label: 'query bar to clear' },
  { value: '158', label: 'languages to match' },
];

const PRIORITIES = [
  { n: 1, tag: 'foundation', title: 'Unified visual-code parser',
    body: 'Build on tree-sitter; index multi-lingual systems into local SQLite so the visuals stay accurate and fast.' },
  { n: 2, tag: 'integration', title: 'Stdio-based MCP protocol',
    body: 'Skip remote-server bottlenecks — let Claude Code / Cursor query the local graph index over stdio with minimal latency.' },
  { n: 3, tag: 'differentiator', hot: true, title: 'Architectural safeguard layer',
    body: 'Lint every proposed diff against the visual dependency map and validate boundaries BEFORE writing to disk. This is the actual moat.' },
  { n: 4, tag: 'interface', title: 'Local-first WebGL workspace',
    body: 'Interactive canvas with all assets bundled locally — secure, responsive, and works air-gapped (where codebase-memory-mcp fails).' },
];

// ── The Gap ──────────────────────────────────────────────────────────────────
const CAMPS = [
  { key: 'analytical', name: 'Read-only AST analyzers', examples: 'codebase-memory-mcp · Repowise',
    has: 'Deep static analysis, sub-millisecond queries, extreme token efficiency.',
    lacks: 'Passive & read-only — the graph lags behind commits, the AI can’t edit the layout, and devs can’t plan refactors inside it.' },
  { key: 'visual', name: 'Drawing canvases', examples: 'Tesseract · excalidraw-mcp',
    has: 'Interactive, spatial, and the AI can update the diagram.',
    lacks: 'No deep static analysis, and the canvas isn’t bound to source — edits never compile down to verified code.' },
];
const PROPOSED = {
  name: 'Bidirectional compiler + linter',
  body: 'The unclaimed middle: deep analysis AND a live, editable graph, joined by an architectural linter that gates every AI change.',
};

// ── Rivals (deep dive) ───────────────────────────────────────────────────────
const RIVALS = [
  {
    key: 'cbm', name: 'codebase-memory-mcp', vendor: 'DeusData', approach: 'analytical', status: 'Active',
    blurb: 'Single static C binary, zero deps. tree-sitter across 158 languages → SQLite, queries in under a millisecond.',
    strengths: [
      'Indexes the Linux kernel in ~3 min; releases memory immediately after',
      '6-strategy call resolution with type inference across boundaries',
      'Impact analysis, dead-code, REST route matching, git co-change',
      'Over 99% token reduction vs sequential file reads',
    ],
    gaps: [
      'Visualization is read-only — the AI can’t edit, devs can’t plan in it',
      '3D WebGL renderer crashes on large graphs (50k+ nodes)',
      'Loads assets from a CDN — fails in air-gapped / firewalled envs',
    ],
  },
  {
    key: 'tess', name: 'Tesseract', vendor: 'Infrastellar', approach: 'visual', status: 'Active',
    blurb: 'Desktop app + MCP server built around a true interactive 3D design canvas.',
    strengths: [
      'Real 3D spatial canvas — zoom / rotate / explore',
      'Animated, color-coded request-flow paths across services',
      'Claude Code plugin with /arch-codemap diagram generation',
      'MCP APIs let the AI update components, layers & flows',
    ],
    gaps: [
      'No deep static analysis (type resolution, scoping, cross-language AST)',
      'Canvas isn’t bound to source — AI edits don’t compile to code',
      'Closed desktop app requiring sign-up — adoption friction',
    ],
  },
  {
    key: 'repo', name: 'Repowise', vendor: '', approach: 'analytical', status: 'Active',
    blurb: 'Offline 5-layer engine: AST graph + Git analytics + docs + decision logs + a 25-biomarker health score.',
    strengths: [
      'AST + Git history → PageRank, betweenness centrality, risk metrics',
      'Vector (LanceDB) + full-text (SQLite FTS5) search dashboard',
      'Generates CLAUDE.md / cursor.md straight from graph metrics',
    ],
    gaps: [
      'D3 dependency graph is ex-post and read-only',
      'Doc generation is API-heavy and slow on large codebases',
      'No visual-first, architecture-driven code generation',
    ],
  },
];

const MARKET = [
  { name: 'Repowise', kind: 'platform', status: 'active', note: 'D3 force-directed graphs + C4 models (also ships an MCP server)' },
  { name: 'dependency-cruiser', kind: 'platform', status: 'active', note: 'SVG/DOT diagrams, circular-path checks (JS/TS)' },
  { name: 'CodeSee', kind: 'platform', status: 'defunct', note: '2D node-link maps — acquired by GitKraken, 2024' },
  { name: 'Sourcetrail', kind: 'platform', status: 'defunct', note: '2D dependency graphs — archived late 2021' },
  { name: 'CodeCharta', kind: 'platform', status: 'active', note: '3D "city" metaphor (districts & buildings)' },
  { name: 'CodeVisualizer', kind: 'platform', status: 'active', note: 'Function-level flowcharts + directory dep graphs' },
  { name: 'Structurizr', kind: 'platform', status: 'active', note: 'DSL-driven C4 diagrams (language-agnostic)' },
  { name: 'GitKraken Codemaps', kind: 'platform', status: 'active', note: 'Directory maps + dependency links (in dev)' },
  { name: 'codebase-memory-mcp', kind: 'mcp', status: 'active', note: 'AST → SQLite, 14 typed tools, optional 3D layout' },
  { name: 'Tesseract', kind: 'mcp', status: 'active', note: 'Visual-first 3D editor, /arch-codemap plugin' },
  { name: 'graph-codebase-mcp', kind: 'mcp', status: 'active', note: 'Neo4j knowledge graph + Cypher queries' },
  { name: 'excalidraw-mcp', kind: 'mcp', status: 'active', note: 'Diagram-as-code whiteboard automation' },
  { name: 'mermaid-mcp', kind: 'mcp', status: 'active', note: 'Text-to-diagram generation + validation' },
];

// ── Decay ────────────────────────────────────────────────────────────────────
const DECAY = [
  { key: 'euphoria', phase: 'Euphoria', months: 'Months 1–3', traits: ['High speed', 'Clean slate', 'Single focus'],
    detail: 'The AI operates on a clean codebase — high feature velocity, minimal architectural friction.' },
  { key: 'plateau', phase: 'Plateau', months: 'Months 4–9', traits: ['Context limits hit', 'Duplicate utils', 'Silent drift'],
    detail: 'Stateless, context-limited models lose the unified mental model — redundant abstractions appear and established design patterns get ignored.' },
  { key: 'decline', phase: 'Decline', months: 'Months 10–15', hot: true, traits: ['Fix-1-break-10', 'Unknown paths', 'Heavy refactors'],
    detail: 'Agents edit local files blind to global transit paths, breaking downstream modules. Compounding technical debt sets in.' },
  { key: 'stall', phase: 'Stall', months: 'Months 16–18', traits: ['Delivery stops', 'Zero control'],
    detail: 'Feature delivery halts — teams can no longer safely modify their own systems.' },
];

const MITIGATIONS = [
  { name: 'RAG / vector indexing', who: 'Cursor · Bolt.new',
    why: 'Supplies file summaries, but offers no structural visual overview to catch complex, multi-layer dependencies.' },
  { name: 'Spec-driven development', who: 'CLAUDE.md · .cursorrules · AGENTS.md',
    why: 'Hard to maintain by hand and text-only — it can’t surface the dependency structure visually.' },
];

// ── The Edge ─────────────────────────────────────────────────────────────────
const CAPABILITIES = [
  { key: 'compile', tag: 'compiler', name: 'Bidirectional design synthesis',
    body: 'The visual graph is the source of truth — designs compile to code and back.',
    example: 'Prompt "add a redis-backed cache to auth" → the AI edits the graph first (inserts a RedisCache linked to AuthService) → the tool generates the boilerplate, config & imports and applies them.' },
  { key: 'lint', tag: 'safeguard', hot: true, name: 'Real-time architectural linting',
    body: 'Every proposed diff is checked against the dependency map; violations block the commit.',
    example: '"Compilation Rejected: import from database.ts to client-component.tsx violates the Layered Architecture contract — route this through the API Service layer."' },
  { key: 'blast', tag: 'foresight', name: 'Cascade / blast-radius simulation',
    body: 'Before multi-file edits, simulate transitive impact (BFS) and color-code affected files by risk.',
    example: 'Changing a core interface lights up every downstream file on the canvas, so the "blast radius" is visible before any write happens.' },
  { key: 'local', tag: 'enterprise', name: 'Air-gapped, local-first',
    body: 'Self-contained tree-sitter binary; visualization served locally with all assets bundled.',
    example: 'Runs fully offline where codebase-memory-mcp’s CDN-dependent viewer fails — no external DB or container setup required.' },
];

const MATRIX = [
  { feature: 'Visual core rule engine', persona: 'Senior architect', solves: 'Inconsistent abstractions across modules', edge: 'Visual borders block invalid imports' },
  { feature: 'Interactive cascade simulator', persona: 'Solopreneur / vibe coder', solves: '“Fix-one-break-ten” regressions', edge: 'Color-coded downstream-impact maps' },
  { feature: 'Split-pane visual composer', persona: 'Fast prototyper', solves: 'Slow manual boilerplate', edge: 'Drag-drop components update imports' },
  { feature: 'Offline vector search', persona: 'Enterprise dev', solves: 'IP loss + token-cost inflation', edge: 'Local Ollama indexing, bundled assets' },
  { feature: 'Self-writing spec sync', persona: 'Multi-agent coordinator', solves: 'Specs drift from source', edge: 'Auto-compiles architecture → markdown' },
];

export default function CodebaseTracker() {
  const [view, setView] = useState('Direction');
  const [loopMode, setLoopMode] = useState('bi');
  const [rivalFilter, setRivalFilter] = useState('all');
  const [openRival, setOpenRival] = useState('cbm');
  const [decayStage, setDecayStage] = useState('decline');
  const [openCap, setOpenCap] = useState('lint');
  const [showMatrix, setShowMatrix] = useState(false);

  const rivals = rivalFilter === 'all' ? RIVALS : RIVALS.filter((r) => r.approach === rivalFilter);
  const activeDecay = DECAY.find((d) => d.key === decayStage) ?? DECAY[0];

  return (
    <div className="pt-module cbt">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="pt-card cbt-head">
        <div className="cbt-head__meta">
          <p className="cbt-head__tag">{PROJECT.tag} · brief from {PROJECT.source}</p>
          <h3 className="cbt-head__title">{PROJECT.title}</h3>
          <p className="cbt-head__pos">
            <span className="cbt-head__pos-label">Position as</span>
            {PROJECT.positioning}
          </p>
          <p className="cbt-head__thesis">{PROJECT.thesis}</p>
        </div>
        <div className="cbt-head__verdict">
          <span className="cbt-verdict">{PROJECT.verdict}</span>
          <p className="cbt-head__vnote">{PROJECT.verdictNote}</p>
        </div>
      </header>

      {/* ── Tabs ────────────────────────────────────────────────────────── */}
      <div className="cbt-seg" role="tablist" aria-label="Project views">
        {VIEWS.map((v) => (
          <button key={v} role="tab" aria-selected={v === view}
                  className={`cbt-seg__tab${v === view ? ' cbt-seg__tab--active' : ''}`}
                  onClick={() => setView(v)}>
            {v}
          </button>
        ))}
      </div>

      {/* ── DIRECTION ───────────────────────────────────────────────────── */}
      {view === 'Direction' && (
        <div className="cbt-panel" role="tabpanel">
          <div className="cbt-signals">
            {SIGNALS.map((s) => (
              <div key={s.label} className={`pt-card cbt-signal${s.accent ? ' cbt-signal--accent' : ''}`}>
                <span className="cbt-signal__v">{s.value}</span>
                <span className="cbt-signal__l">{s.label}</span>
              </div>
            ))}
          </div>

          <div className="pt-card cbt-northstar">
            <span className="cbt-kicker cbt-kicker--accent">North star · build this first</span>
            <p>
              The <strong>architectural linter</strong> is the one capability no rival has. Prototype the
              diff-interception loop early — on top of a tree-sitter → SQLite index — so the graph can
              <em> gate</em> AI changes rather than just describe them.
            </p>
          </div>

          <div className="cbt-prios">
            {PRIORITIES.map((p) => (
              <div key={p.n} className={`pt-card cbt-prio${p.hot ? ' cbt-prio--hot' : ''}`}>
                <span className="cbt-prio__n">{p.n}</span>
                <div className="cbt-prio__body">
                  <div className="cbt-prio__top">
                    <h5 className="cbt-prio__title">{p.title}</h5>
                    <span className="cbt-tag">{p.tag}</span>
                  </div>
                  <p className="cbt-prio__text">{p.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── THE GAP ─────────────────────────────────────────────────────── */}
      {view === 'The Gap' && (
        <div className="cbt-panel" role="tabpanel">
          <div className="cbt-camps">
            {CAMPS.map((c) => (
              <div key={c.key} className="pt-card cbt-camp">
                <span className="cbt-kicker">Incumbent camp</span>
                <h5 className="cbt-camp__name">{c.name}</h5>
                <p className="cbt-camp__ex"><code>{c.examples}</code></p>
                <p className="cbt-camp__line"><span className="cbt-yes">Has</span>{c.has}</p>
                <p className="cbt-camp__line"><span className="cbt-no">Lacks</span>{c.lacks}</p>
              </div>
            ))}
          </div>

          <div className="pt-card cbt-proposed">
            <span className="cbt-kicker cbt-kicker--accent">The unclaimed middle</span>
            <h5 className="cbt-proposed__name">{PROPOSED.name}</h5>
            <p>{PROPOSED.body}</p>
          </div>

          <div className="pt-card cbt-loopwrap">
            <div className="cbt-loop__toggle" role="tablist" aria-label="Architecture loop">
              <button role="tab" aria-selected={loopMode === 'uni'}
                      className={`cbt-loop__btn${loopMode === 'uni' ? ' cbt-loop__btn--active' : ''}`}
                      onClick={() => setLoopMode('uni')}>
                Today · read-only loop
              </button>
              <button role="tab" aria-selected={loopMode === 'bi'}
                      className={`cbt-loop__btn${loopMode === 'bi' ? ' cbt-loop__btn--active' : ''}`}
                      onClick={() => setLoopMode('bi')}>
                Proposed · bidirectional loop
              </button>
            </div>

            {loopMode === 'uni' ? (
              <div className="cbt-loop" key="uni">
                <div className="cbt-loop__row">
                  <div className="cbt-node">Source code</div>
                  <span className="cbt-arrow">→<em>parse · watch</em></span>
                  <div className="cbt-node">Static DB</div>
                  <span className="cbt-arrow">→</span>
                  <div className="cbt-node cbt-node--muted">Read-only graph</div>
                </div>
                <p className="cbt-loop__note cbt-loop__note--bad">
                  ↩ Meanwhile the AI edits code blind to the graph — the view lags behind commits and drift accumulates.
                </p>
              </div>
            ) : (
              <div className="cbt-loop" key="bi">
                <div className="cbt-loop__row">
                  <div className="cbt-node cbt-node--accent">Visual graph<small>source of truth</small></div>
                  <span className="cbt-arrow cbt-arrow--bi">⇄</span>
                  <div className="cbt-node cbt-node--accent">AI agent<small>MCP client</small></div>
                </div>
                <span className="cbt-arrow cbt-arrow--down">compiles ↕ proposes diffs</span>
                <div className="cbt-gate">⛨ Architectural linter — validates against boundaries before any write</div>
                <span className="cbt-arrow cbt-arrow--down">↕</span>
                <div className="cbt-node cbt-node--wide">Source code files</div>
                <p className="cbt-loop__note cbt-loop__note--good">
                  Design edits compile to code, code updates the graph, and illegal diffs are blocked at the gate.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── RIVALS ──────────────────────────────────────────────────────── */}
      {view === 'Rivals' && (
        <div className="cbt-panel" role="tabpanel">
          <div className="cbt-filters">
            {[['all', 'All'], ['analytical', 'Analytical'], ['visual', 'Visual-first']].map(([k, l]) => (
              <button key={k} className={`cbt-chip${rivalFilter === k ? ' cbt-chip--active' : ''}`}
                      onClick={() => setRivalFilter(k)}>
                {l}{k !== 'all' && ` · ${RIVALS.filter((r) => r.approach === k).length}`}
              </button>
            ))}
          </div>

          <div className="cbt-rivals">
            {rivals.map((r) => {
              const open = openRival === r.key;
              return (
                <div key={r.key} className="pt-card cbt-rival">
                  <button className="cbt-rival__head" aria-expanded={open}
                          onClick={() => setOpenRival(open ? null : r.key)}>
                    <span className={`cbt-rival__caret${open ? ' cbt-rival__caret--open' : ''}`}>▸</span>
                    <span className="cbt-rival__name">{r.name}{r.vendor && <em> · {r.vendor}</em>}</span>
                    <span className={`cbt-approach cbt-approach--${r.approach}`}>
                      {r.approach === 'analytical' ? 'Analytical' : 'Visual-first'}
                    </span>
                    <span className="cbt-rival__status">{r.status}</span>
                  </button>
                  {open && (
                    <div className="cbt-rival__body">
                      <p className="cbt-rival__blurb">{r.blurb}</p>
                      <div className="cbt-cols">
                        <div className="cbt-col cbt-col--yes">
                          <span className="cbt-col__h">Strengths</span>
                          <ul>{r.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul>
                        </div>
                        <div className="cbt-col cbt-col--no">
                          <span className="cbt-col__h">Gaps to exploit</span>
                          <ul>{r.gaps.map((s, i) => <li key={i}>{s}</li>)}</ul>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {rivals.length === 0 && <p className="cbt-empty">No rivals in this category.</p>}
          </div>

          <div className="pt-card cbt-matrixwrap">
            <button className="cbt-matrix__toggle" aria-expanded={showMatrix}
                    onClick={() => setShowMatrix((s) => !s)}>
              <span className={`cbt-rival__caret${showMatrix ? ' cbt-rival__caret--open' : ''}`}>▸</span>
              Wider market — {MARKET.length} tools mapped
            </button>
            {showMatrix && (
              <div className="cbt-table-scroll">
                <table className="cbt-table">
                  <thead>
                    <tr><th>Tool</th><th>Kind</th><th>Status</th><th>Paradigm</th></tr>
                  </thead>
                  <tbody>
                    {MARKET.map((m) => (
                      <tr key={m.name}>
                        <td>{m.name}</td>
                        <td>{m.kind === 'mcp' ? 'MCP server' : 'Platform'}</td>
                        <td><span className={`cbt-status cbt-status--${m.status}`}>{m.status}</span></td>
                        <td>{m.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── DECAY ───────────────────────────────────────────────────────── */}
      {view === 'Decay' && (
        <div className="cbt-panel" role="tabpanel">
          <div className="pt-card cbt-finding">
            <span className="cbt-kicker cbt-kicker--accent">Why this matters</span>
            <p>
              “Vibe coding” (Karpathy, Feb 2025) trades manual syntax for natural-language orchestration.
              Velocity rises, but stateless, context-limited agents lose the global mental model — and the
              codebase decays on a predictable curve. Tap a phase:
            </p>
          </div>

          <div className="pt-card cbt-timeline">
            <div className="cbt-timeline__track">
              {DECAY.map((d) => (
                <button key={d.key} aria-pressed={d.key === decayStage}
                        className={`cbt-phase${d.key === decayStage ? ' cbt-phase--active' : ''}${d.hot ? ' cbt-phase--hot' : ''}`}
                        onClick={() => setDecayStage(d.key)}>
                  <span className="cbt-phase__dot" />
                  <span className="cbt-phase__name">{d.phase}</span>
                  <span className="cbt-phase__months">{d.months}</span>
                </button>
              ))}
            </div>
            <div className="cbt-phase-detail" key={activeDecay.key}>
              <div className="cbt-phase-detail__traits">
                {activeDecay.traits.map((t) => <span key={t} className="cbt-trait">{t}</span>)}
              </div>
              <p className="cbt-phase-detail__body">{activeDecay.detail}</p>
            </div>
          </div>

          <div className="cbt-mits">
            <span className="cbt-kicker">Current mitigations — and why they fall short</span>
            <div className="cbt-mits__grid">
              {MITIGATIONS.map((m) => (
                <div key={m.name} className="pt-card cbt-mit">
                  <h5 className="cbt-mit__name">{m.name}</h5>
                  <p className="cbt-mit__who"><code>{m.who}</code></p>
                  <p className="cbt-mit__why">{m.why}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── THE EDGE ────────────────────────────────────────────────────── */}
      {view === 'The Edge' && (
        <div className="cbt-panel" role="tabpanel">
          <div className="cbt-caps">
            {CAPABILITIES.map((c, i) => {
              const open = openCap === c.key;
              return (
                <button key={c.key} aria-expanded={open}
                        className={`pt-card cbt-cap${c.hot ? ' cbt-cap--hot' : ''}${open ? ' cbt-cap--open' : ''}`}
                        onClick={() => setOpenCap(open ? null : c.key)}>
                  <span className="cbt-cap__top">
                    <span className="cbt-cap__n">{String(i + 1).padStart(2, '0')}</span>
                    <span className="cbt-cap__name">{c.name}</span>
                    <span className="cbt-tag">{c.tag}</span>
                  </span>
                  <span className="cbt-cap__body">{c.body}</span>
                  {open && (
                    <span className="cbt-cap__ex">
                      <span className="cbt-cap__ex-label">e.g.</span>{c.example}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="pt-card cbt-matrixwrap cbt-matrixwrap--open">
            <span className="cbt-kicker">High-value feature matrix</span>
            <div className="cbt-table-scroll">
              <table className="cbt-table">
                <thead>
                  <tr><th>Feature</th><th>For</th><th>Solves</th><th>Edge</th></tr>
                </thead>
                <tbody>
                  {MATRIX.map((m) => (
                    <tr key={m.feature}>
                      <td>{m.feature}</td>
                      <td>{m.persona}</td>
                      <td>{m.solves}</td>
                      <td>{m.edge}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
