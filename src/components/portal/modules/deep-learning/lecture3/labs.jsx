import { useEffect, useId, useMemo, useState } from 'react';
import { Tex, Note } from '../kit';

/* ============================================================================
   DEEP LEARNING — LECTURE 3 LABS (part 1)
   ----------------------------------------------------------------------------
   The interactive figures for the first half of the CNN lecture:

     CortexLab       Figure 14-1 as a clickable hierarchy — pick a cortical
                     level and watch its receptive field grow over the house
     ConvolutionLab  the star: a 3×3 kernel you slide (or play) across an
                     8×8 image, every multiply-accumulate shown, the output
                     feature map filling in cell by cell
     StrideLab       Figure 14-4 live — hover an output neuron to light up
                     its receptive field; strides and zero padding steerable
     ParamShareLab   slide 8's punchline as a counter: one 3×3 filter is
                     10 parameters whatever the map size — a dense layer isn't
   ========================================================================== */

/* ── §1 · Figure 14-1, clickable ─────────────────────────────────────────── */
const CORTEX_LEVELS = [
  {
    id: 0,
    name: 'Low-level neurons',
    chip: 'edges & strokes',
    sees: 'Tiny receptive fields. Each neuron fires for one simple pattern — a stroke at one orientation, in one small spot.',
    rf: { cx: 104, cy: 74, rx: 30, ry: 14 },
  },
  {
    id: 1,
    name: 'Mid-level neurons',
    chip: 'corners & parts',
    sees: 'Larger receptive fields. Neurons here combine the strokes below them into parts — corners, crossings, junctions.',
    rf: { cx: 120, cy: 160, rx: 52, ry: 38 },
  },
  {
    id: 2,
    name: 'High-level neurons',
    chip: 'whole objects',
    sees: 'The largest receptive fields. Neurons respond to complex patterns assembled from everything below — a house, a shark.',
    rf: { cx: 160, cy: 118, rx: 122, ry: 96 },
  },
];

const GLYPHS = [
  // level 0 — the strokes column of Figure 14-1
  ['M11 2 V20', 'M2 11 H20', 'M4 3 L18 19', 'M14 3 C6 7 6 15 14 19'],
  // level 1 — the parts row
  ['M11 3 L20 19 H2 Z', 'M4 4 L18 18 M18 4 L4 18', 'M5 3 V19 M5 11 H19'],
  // level 2 — the objects row
  ['M3 11 L11 4 L19 11 V19 H3 Z M8 19 V14 H13 V19', 'M2 11 C6 5 13 5 17 11 C13 17 6 17 2 11 Z M17 11 L21 7 M17 11 L21 15'],
];

export function CortexLab() {
  const [lvl, setLvl] = useState(0);
  const cur = CORTEX_LEVELS[lvl];

  return (
    <div className="dl-lab">
      <div className="dl-lab__bar">
        <span className="dl-lab__name">Figure 14-1 · receptive fields grow with depth</span>
      </div>

      <div className="dl-chips">
        {CORTEX_LEVELS.map((l) => (
          <button
            key={l.id}
            type="button"
            className={`dl-chip${lvl === l.id ? ' dl-chip--on' : ''}`}
            onClick={() => setLvl(l.id)}
            aria-pressed={lvl === l.id}
          >
            {l.name} <span className="dl-chip__tag">{l.chip}</span>
          </button>
        ))}
      </div>

      <div className="dl3-cortex">
        <div className="dl3-cortex__panel">
          <p className="dl3-stagehead">What these neurons respond to</p>
          <div className="dl3-glyphs" key={lvl}>
            {GLYPHS[lvl].map((d, i) => (
              <svg key={i} viewBox="0 0 22 22" className="dl3-glyph" style={{ '--i': i }} aria-hidden="true">
                <path d={d} />
              </svg>
            ))}
          </div>
          <p className="dl-body">{cur.sees}</p>
        </div>

        <svg viewBox="0 0 320 230" className="dl3-house" aria-label="A house with the selected level's receptive field drawn over it">
          {/* the house of Figure 14-1 */}
          <g className="dl3-house__shape">
            <polygon points="50,110 160,38 270,110" />
            <rect x="208" y="52" width="18" height="36" />
            <rect x="62" y="110" width="196" height="92" />
            <rect x="104" y="150" width="32" height="52" />
            <rect x="168" y="138" width="42" height="32" />
            <line x1="189" y1="138" x2="189" y2="170" />
            <line x1="168" y1="154" x2="210" y2="154" />
          </g>
          {/* the receptive field — keyed so it pops in at each level */}
          <ellipse
            key={lvl}
            className="dl3-rf"
            cx={cur.rf.cx}
            cy={cur.rf.cy}
            rx={cur.rf.rx}
            ry={cur.rf.ry}
          />
          <text x={cur.rf.cx} y={Math.max(16, cur.rf.cy - cur.rf.ry - 7)} textAnchor="middle" className="dl3-rf__label" key={`t${lvl}`}>
            receptive field
          </text>
        </svg>
      </div>

      <Note label="Try this">
        <p>
          Step through the three levels and watch the dashed field grow: the signal makes its way
          through consecutive brain modules, and neurons respond to <em>more complex patterns</em> in{' '}
          <em>larger receptive fields</em>. That sentence is the whole blueprint for a CNN.
        </p>
      </Note>
    </div>
  );
}

/* ── §2 · The convolution stepper ────────────────────────────────────────── */
const IN_N = 8;
const OUT_N = 6;
const mk8 = (fn) => Array.from({ length: IN_N }, (_, y) => Array.from({ length: IN_N }, (_, x) => fn(x, y)));

const PATTERNS = [
  { id: 'edge', label: 'Vertical edge', grid: mk8((x) => (x >= 4 ? 8 : 0)) },
  { id: 'bar', label: 'Horizontal bar', grid: mk8((x, y) => (y === 3 || y === 4 ? 8 : 0)) },
  { id: 'cross', label: 'Cross', grid: mk8((x, y) => (x === 3 || x === 4 || y === 3 || y === 4 ? 8 : 0)) },
  { id: 'square', label: 'Bright square', grid: mk8((x, y) => (x >= 2 && x <= 5 && y >= 2 && y <= 5 ? 8 : 0)) },
];

const KERNELS = [
  { id: 'sobelx', name: 'Sobel-x', role: 'vertical edges', m: [[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]], div: 1 },
  { id: 'sobely', name: 'Sobel-y', role: 'horizontal edges', m: [[-1, -2, -1], [0, 0, 0], [1, 2, 1]], div: 1 },
  { id: 'mean', name: 'Averaging', role: 'smoothing', m: [[1, 1, 1], [1, 1, 1], [1, 1, 1]], div: 9 },
  { id: 'lap', name: 'Laplacian', role: '2nd derivative', m: [[0, 1, 0], [1, -4, 1], [0, 1, 0]], div: 1 },
];

function convolveValid(grid, k) {
  const out = [];
  for (let y = 0; y < OUT_N; y++) {
    const row = [];
    for (let x = 0; x < OUT_N; x++) {
      let s = 0;
      for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) s += grid[y + j][x + i] * k.m[j][i];
      row.push(s / k.div);
    }
    out.push(row);
  }
  return out;
}

const fmtW = (w) => (w < 0 ? `(${w})` : String(w));

export function ConvolutionLab() {
  const [patId, setPatId] = useState('edge');
  const [kerId, setKerId] = useState('sobelx');
  const [pos, setPos] = useState(0);
  const [playing, setPlaying] = useState(false);

  const pattern = PATTERNS.find((p) => p.id === patId);
  const kernel = KERNELS.find((k) => k.id === kerId);
  const out = useMemo(() => convolveValid(pattern.grid, kernel), [pattern, kernel]);
  const maxAbs = useMemo(() => Math.max(1e-9, ...out.flat().map((v) => Math.abs(v))), [out]);

  const last = OUT_N * OUT_N - 1;
  const oy = Math.floor(pos / OUT_N);
  const ox = pos % OUT_N;

  useEffect(() => {
    if (!playing) return undefined;
    const t = setTimeout(() => {
      setPos((p) => Math.min(last, p + 1));
      if (pos + 1 >= last) setPlaying(false);
    }, 400);
    return () => clearTimeout(t);
  }, [playing, pos, last]);

  const pick = (setter) => (id) => { setter(id); setPos(0); setPlaying(false); };

  const fmtV = (v) => (kernel.div === 1 ? String(Math.round(v)) : v.toFixed(1));

  const terms = [];
  for (let j = 0; j < 3; j++) {
    for (let i = 0; i < 3; i++) {
      const I = pattern.grid[oy + j][ox + i];
      const w = kernel.m[j][i];
      terms.push({ I, w, p: I * w });
    }
  }
  const sumRaw = terms.reduce((a, t) => a + t.p, 0);
  const val = out[oy][ox];

  return (
    <div className="dl-lab">
      <div className="dl-lab__bar">
        <span className="dl-lab__name">Convolution stepper · 8×8 image ∗ 3×3 filter → 6×6 feature map</span>
        <span className="dl3-btnrow">
          <button type="button" className="dl-btn" onClick={() => setPlaying((p) => !p)} disabled={pos >= last && !playing}>
            {playing ? '⏸ pause' : '▶ play'}
          </button>
          <button type="button" className="dl-btn" onClick={() => { setPlaying(false); setPos((p) => Math.min(last, p + 1)); }} disabled={pos >= last}>
            step
          </button>
          <button type="button" className="dl-btn" onClick={() => { setPlaying(false); setPos(0); }}>
            ↺ reset
          </button>
        </span>
      </div>

      <div className="dl-lab__controls">
        <div className="dl-ctl">
          <span className="dl-ctl__label">Input image</span>
          <div className="dl-chips">
            {PATTERNS.map((p) => (
              <button key={p.id} type="button" className={`dl-chip${patId === p.id ? ' dl-chip--on' : ''}`} onClick={() => pick(setPatId)(p.id)} aria-pressed={patId === p.id}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <div className="dl-ctl">
          <span className="dl-ctl__label">Filter</span>
          <div className="dl-chips">
            {KERNELS.map((k) => (
              <button key={k.id} type="button" className={`dl-chip${kerId === k.id ? ' dl-chip--on' : ''}`} onClick={() => pick(setKerId)(k.id)} aria-pressed={kerId === k.id}>
                {k.name} <span className="dl-chip__tag">{k.role}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="dl3-conv">
        {/* input */}
        <div>
          <p className="dl3-stagehead">Input I · 8×8 (values 0–8)</p>
          <svg viewBox="0 0 256 256" className="dl3-gridsvg" aria-label="Input image with the sliding 3×3 window">
            {pattern.grid.map((row, y) =>
              row.map((v, x) => (
                <g key={`${x}-${y}`}>
                  <rect x={x * 32} y={y * 32} width={32} height={32} className="dl3-icell" style={{ fillOpacity: 0.06 + 0.74 * (v / 8) }} />
                  <text x={x * 32 + 16} y={y * 32 + 20} textAnchor="middle" className="dl3-cellv" style={{ fill: v > 4 ? 'var(--surface)' : 'var(--ink-3)' }}>
                    {v}
                  </text>
                </g>
              )),
            )}
            <g className="dl3-win" style={{ transform: `translate(${ox * 32}px, ${oy * 32}px)` }}>
              <rect x={1} y={1} width={94} height={94} className="dl3-win__rect" />
            </g>
          </svg>
        </div>

        {/* arithmetic */}
        <div className="dl3-terms">
          <p className="dl3-stagehead">
            {kernel.name} · f {kernel.div !== 1 && <span className="dl3-divbadge">× 1/9</span>}
          </p>
          <div className="dl3-matrix" aria-label="The 3×3 filter weights">
            {kernel.m.flat().map((w, idx) => (
              <span key={idx} className="dl3-matrix__w">{w}</span>
            ))}
          </div>
          <p className="dl3-stagehead">
            products at I′(x={ox + 1}, y={oy + 1})
          </p>
          <div className="dl3-matrix">
            {terms.map((t, idx) => (
              <span key={idx} className="dl3-prod" title={`${t.I} × ${t.w}`}>
                <span className="dl3-prod__ab">{t.I}×{fmtW(t.w)}</span>
                <b className={t.p > 0 ? 'dl3-pos' : t.p < 0 ? 'dl3-neg' : ''}>{t.p}</b>
              </span>
            ))}
          </div>
          <p className="dl3-sum">
            {kernel.div === 1 ? (
              <>Σ = <b>{fmtV(val)}</b></>
            ) : (
              <>Σ = {sumRaw} → ÷9 = <b>{fmtV(val)}</b></>
            )}
          </p>
        </div>

        {/* output */}
        <div>
          <p className="dl3-stagehead">Output I′ · 6×6 ("valid" — no padding) · cell {pos + 1}/36</p>
          <svg viewBox="0 0 192 192" className="dl3-gridsvg" aria-label="Output feature map, filling in as the window slides">
            {out.map((row, y) =>
              row.map((v, x) => {
                const idx = y * OUT_N + x;
                const seen = idx <= pos;
                const cur = idx === pos;
                return (
                  <g key={`${x}-${y}`} className="dl3-outcell" onClick={() => { setPlaying(false); setPos(idx); }}>
                    <rect
                      x={x * 32}
                      y={y * 32}
                      width={32}
                      height={32}
                      className={`dl3-ocell${cur ? ' dl3-ocell--cur' : ''}`}
                      style={seen ? { fill: v > 0 ? 'var(--dlv-orange)' : v < 0 ? 'var(--dlv-blue)' : 'var(--surface-hi)', fillOpacity: v === 0 ? 1 : 0.15 + 0.75 * (Math.abs(v) / maxAbs) } : undefined}
                    />
                    {seen && (
                      <text x={x * 32 + 16} y={y * 32 + 20} textAnchor="middle" className="dl3-cellv" style={{ fill: Math.abs(v) / maxAbs > 0.55 ? 'var(--surface)' : 'var(--ink-3)' }}>
                        {fmtV(v)}
                      </text>
                    )}
                  </g>
                );
              }),
            )}
          </svg>
        </div>
      </div>

      <Note label="Try this">
        <p>
          Play <em>vertical edge ∗ Sobel-x</em>: the map lights up exactly one column — where the
          edge is. Then swap to <em>Sobel-y</em> and watch the same image produce all zeros: the
          filter only answers to the feature it was built for. Click any output cell to jump the
          window there. Note the output shrank 8→6: without padding a 3×3 filter can't centre on
          the border pixels.
        </p>
      </Note>
    </div>
  );
}

/* ── §3 · Figure 14-4, live ──────────────────────────────────────────────── */
const S_ROWS = 5;
const S_COLS = 7;
const S_CELL = 26;
const RF_COLORS = ['var(--dlv-red)', 'var(--dlv-blue)', 'var(--dlv-violet)'];

export function StrideLab() {
  const hatchId = useId();
  const [sh, setSh] = useState(2);
  const [sw, setSw] = useState(2);
  const [pad, setPad] = useState(true);
  const [sel, setSel] = useState({ i: 0, j: 1 });

  const p = pad ? 1 : 0;
  const rows = Math.floor((S_ROWS + 2 * p - 3) / sh) + 1;
  const cols = Math.floor((S_COLS + 2 * p - 3) / sw) + 1;
  const i = Math.min(sel.i, rows - 1);
  const j = Math.min(sel.j, cols - 1);
  const color = RF_COLORS[(i + j) % 3];

  const inCols = S_COLS + 2 * p;
  const inRows = S_ROWS + 2 * p;
  const IX = 4;
  const IY = 34;
  const OX = 330;
  const OY = 34;

  // receptive field in drawn (padded) grid coordinates
  const rx = IX + j * sw * S_CELL;
  const ry = IY + i * sh * S_CELL;
  const cellX = OX + j * S_CELL;
  const cellY = OY + i * S_CELL;

  return (
    <div className="dl-lab">
      <div className="dl-lab__bar">
        <span className="dl-lab__name">Figure 14-4 · hover an output neuron, see its receptive field</span>
        <label className="dl-check">
          <input type="checkbox" checked={pad} onChange={(e) => setPad(e.target.checked)} />
          zero padding (the hatched ring)
        </label>
      </div>

      <div className="dl-lab__controls">
        <div className="dl-ctl">
          <span className="dl-ctl__label">Stride s_h</span>
          <div className="dl-chips">
            {[1, 2].map((s) => (
              <button key={s} type="button" className={`dl-chip${sh === s ? ' dl-chip--on' : ''}`} onClick={() => setSh(s)} aria-pressed={sh === s}>{s}</button>
            ))}
          </div>
          <span className="dl-ctl__label">Stride s_w</span>
          <div className="dl-chips">
            {[1, 2].map((s) => (
              <button key={s} type="button" className={`dl-chip${sw === s ? ' dl-chip--on' : ''}`} onClick={() => setSw(s)} aria-pressed={sw === s}>{s}</button>
            ))}
          </div>
        </div>
      </div>

      <svg viewBox="0 0 560 232" className="dl3-stridesvg" aria-label="Input grid connected to the smaller output grid">
        <defs>
          <pattern id={hatchId} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke="var(--line)" strokeWidth="1.4" />
          </pattern>
        </defs>

        <text x={IX} y={16} className="dl3-gridtitle">
          Input 5×7{pad ? ' + zero padding' : ''} · 3×3 receptive fields
        </text>
        <text x={OX} y={16} className="dl3-gridtitle">
          Output {rows}×{cols}
        </text>

        {/* input grid */}
        {Array.from({ length: inRows }, (_, gy) =>
          Array.from({ length: inCols }, (_, gx) => {
            const isPad = p === 1 && (gy === 0 || gx === 0 || gy === inRows - 1 || gx === inCols - 1);
            return (
              <rect
                key={`${gx}-${gy}`}
                x={IX + gx * S_CELL}
                y={IY + gy * S_CELL}
                width={S_CELL}
                height={S_CELL}
                className="dl3-scell"
                fill={isPad ? `url(#${hatchId})` : undefined}
              />
            );
          }),
        )}

        {/* receptive field of the selected output neuron */}
        <rect x={rx} y={ry} width={3 * S_CELL} height={3 * S_CELL} className="dl3-rfrect" style={{ stroke: color, fill: color }} />

        {/* projection lines: output cell corners → receptive field corners */}
        {[[0, 0], [1, 0], [0, 1], [1, 1]].map(([cx, cy]) => (
          <line
            key={`${cx}${cy}`}
            x1={cellX + cx * S_CELL}
            y1={cellY + cy * S_CELL}
            x2={rx + cx * 3 * S_CELL}
            y2={ry + cy * 3 * S_CELL}
            className="dl3-flow"
            style={{ stroke: color }}
          />
        ))}

        {/* output grid */}
        {Array.from({ length: rows }, (_, gi) =>
          Array.from({ length: cols }, (_, gj) => {
            const on = gi === i && gj === j;
            return (
              <rect
                key={`${gj}-${gi}`}
                x={OX + gj * S_CELL}
                y={OY + gi * S_CELL}
                width={S_CELL}
                height={S_CELL}
                className={`dl3-scell dl3-scell--out${on ? ' dl3-scell--on' : ''}`}
                style={on ? { stroke: color, fill: color } : undefined}
                onMouseEnter={() => setSel({ i: gi, j: gj })}
                onClick={() => setSel({ i: gi, j: gj })}
              />
            );
          }),
        )}
      </svg>

      <p className="dl-verdict">
        <span className="dl-verdict__dot" style={{ background: color }} aria-hidden="true" />
        <strong>neuron (i={i}, j={j})</strong>&thinsp;: connected to rows {i * sh}–{i * sh + 2} · cols {j * sw}–{j * sw + 2}
        {pad ? ' (counting the padding ring)' : ''} — rows <Tex src="i\,s_h" /> to <Tex src="i\,s_h + f_h - 1" />, cols <Tex src="j\,s_w" /> to <Tex src="j\,s_w + f_w - 1" />.
      </p>

      <div className="dl-cardgrid dl-cardgrid--2">
        <div className="dlk-fact">
          <p className="dlk-fact__k">Output height</p>
          <p className="dlk-fact__v"><Tex src={`\\lfloor (5 + ${2 * p} - 3)/${sh} \\rfloor + 1 = ${rows}`} /></p>
        </div>
        <div className="dlk-fact">
          <p className="dlk-fact__k">Output width</p>
          <p className="dlk-fact__v"><Tex src={`\\lfloor (7 + ${2 * p} - 3)/${sw} \\rfloor + 1 = ${cols}`} /></p>
        </div>
      </div>

      <Note label="Try this">
        <p>
          Set both strides to 2 with padding on — that's the slide's exact picture: 5×7 in, 3×4
          out. Then switch padding off and watch the border neurons disappear: spacing out the
          receptive fields is how a big layer connects to a much smaller one.
        </p>
      </Note>
    </div>
  );
}

/* ── §4 · Slide 8's punchline as a counter ───────────────────────────────── */
export function ParamShareLab() {
  const [n, setN] = useState(28);
  const conv = 10;
  const dense = n * n * (n * n + 1);
  const maxLog = Math.log10(64 * 64 * (64 * 64 + 1));
  const barW = (v) => `${Math.max(2, (Math.log10(v) / maxLog) * 100)}%`;

  return (
    <div className="dl-lab">
      <div className="dl-lab__bar">
        <span className="dl-lab__name">Weight sharing · one 3×3 filter vs a dense layer, {n}×{n} → {n}×{n}</span>
      </div>

      <label className="dl-slider dl-slider--tl">
        <span>feature-map size n = {n} ({n}×{n} = {(n * n).toLocaleString()} neurons)</span>
        <input type="range" min="8" max="64" step="4" value={n} onChange={(e) => setN(Number(e.target.value))} />
      </label>

      <div className="dl-stats">
        <div className="dl-stat">
          <p className="dl-stat__k">convolution · one 3×3 filter W</p>
          <p className="dl-stat__v">10</p>
          <p className="dl-stat__sub">9 weights + 1 bias — whatever the map size</p>
        </div>
        <div className="dl-stat">
          <p className="dl-stat__k">fully connected equivalent</p>
          <p className="dl-stat__v">{dense.toLocaleString()}</p>
          <p className="dl-stat__sub">n² neurons × (n² weights + 1 bias)</p>
        </div>
        <div className="dl-stat">
          <p className="dl-stat__k">the gap</p>
          <p className="dl-stat__v">×{Math.round(dense / conv).toLocaleString()}</p>
          <p className="dl-stat__sub">parameters saved by sharing W</p>
        </div>
      </div>

      <div className="dl-errbars">
        <p className="dl-errbars__title">parameter count (log scale)</p>
        <div className="dl-errbar">
          <span className="dl-errbar__k">conv 3×3</span>
          <div className="dl-errbar__track"><span className="dl-errbar__fill" style={{ width: barW(conv), background: 'var(--dlv-blue)' }} /></div>
          <span className="dl-errbar__v">10</span>
        </div>
        <div className="dl-errbar">
          <span className="dl-errbar__k">dense</span>
          <div className="dl-errbar__track"><span className="dl-errbar__fill" style={{ width: barW(dense), background: 'var(--dlv-orange)' }} /></div>
          <span className="dl-errbar__v">{dense >= 1e6 ? `${(dense / 1e6).toFixed(1)}M` : dense.toLocaleString()}</span>
        </div>
      </div>

      <Note label="Why it works">
        <p>
          All the pixels of the layer-<Tex src="i" /> feature map connect to each layer-
          <Tex src="i{+}1" /> pixel through the <em>same</em> nine weights <Tex src="\mathbf{W}" /> —
          so a feature learned in one corner is instantly available everywhere in the image.
        </p>
      </Note>
    </div>
  );
}
