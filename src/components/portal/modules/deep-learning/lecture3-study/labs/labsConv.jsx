import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from '../../../../icons';
import { Tex } from '../../kit';
import { Lab, Chips } from '../ui';
import { SLIDE6_FILTERS } from '../slideData';
import { convValid } from '../cnn';
import { gridStep, svgCell } from '../hooks';

/* ============================================================================
   LECTURE 3 STUDY — LABS FOR §2
     ConvStepLab   slide 6, by hand: a 3×3 filter stepped across an 8×8 image
                   you can paint, every multiply-add shown, the output map
                   filling in — plus the same input through all four filters
   (Adapted from lecture3/labs.jsx ConvolutionLab; the original is untouched.)
   ========================================================================== */

const N = 8;
const ON = N - 2;
const C = 30;
const blank = () => Array.from({ length: N }, () => Array(N).fill(0));
const mk = (fn) => Array.from({ length: N }, (_, r) => Array.from({ length: N }, (_, c) => fn(c, r)));

const PRESETS = [
  { id: 'edge', label: 'Vertical edge', grid: () => mk((x) => (x >= 4 ? 8 : 0)) },
  { id: 'bar', label: 'Horizontal bar', grid: () => mk((x, y) => (y === 3 || y === 4 ? 8 : 0)) },
  { id: 'cross', label: 'Cross', grid: () => mk((x, y) => (x === 3 || x === 4 || y === 3 || y === 4 ? 8 : 0)) },
  { id: 'square', label: 'Bright square', grid: () => mk((x, y) => (x >= 2 && x <= 5 && y >= 2 && y <= 5 ? 8 : 0)) },
  { id: 'clear', label: 'Clear', grid: blank },
];

const fmtW = (w) => (w < 0 ? `(${w})` : String(w));
const fmtOut = (v, div) => (div === 1 ? String(Math.round(v)) : (v / div).toFixed(1));

function PaintGrid({ grid, onPaint, win }) {
  const svgRef = useRef(null);
  const painting = useRef(false);
  const [cursor, setCursor] = useState({ r: 0, c: 0 });
  const [focused, setFocused] = useState(false);

  const at = (e) => svgCell(e, svgRef.current, 0, 0, C, N, N);
  const onKey = (e) => {
    const nx = gridStep(e.key, cursor, N, N);
    if (nx) { e.preventDefault(); setCursor(nx); return; }
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); onPaint(cursor.r, cursor.c); }
  };

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${N * C} ${N * C}`}
      className="dl3s-svg dl3s-grid dl3s-grid--paint"
      tabIndex={0}
      role="application"
      aria-label="Input image, 8 by 8. Click or drag to paint; with the keyboard, arrows move the cursor and Space paints."
      onKeyDown={onKey}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onPointerDown={(e) => {
        const cell = at(e);
        if (!cell) return;
        painting.current = true;
        e.currentTarget.setPointerCapture?.(e.pointerId);
        onPaint(cell.r, cell.c);
      }}
      onPointerMove={(e) => {
        if (!painting.current) return;
        const cell = at(e);
        if (cell) onPaint(cell.r, cell.c);
      }}
      onPointerUp={() => { painting.current = false; }}
      onPointerCancel={() => { painting.current = false; }}
    >
      {grid.map((row, r) =>
        row.map((v, c) => (
          <g key={`${r}-${c}`}>
            <rect x={c * C} y={r * C} width={C} height={C} className="dl3s-icell" style={{ fillOpacity: 0.05 + 0.75 * (v / 8) }} />
            <text x={c * C + C / 2} y={r * C + C / 2 + 4} textAnchor="middle" className={`dl3s-cellv${v > 4 ? ' dl3s-cellv--inv' : ''}`}>{v}</text>
          </g>
        )),
      )}
      <rect x={win.c * C + 1.5} y={win.r * C + 1.5} width={3 * C - 3} height={3 * C - 3} className="dl3s-win" />
      <circle cx={(win.c + 1.5) * C} cy={(win.r + 1.5) * C} r={3} className="dl3s-win__centre" />
      {focused && <rect x={cursor.c * C + 3} y={cursor.r * C + 3} width={C - 6} height={C - 6} className="dl3s-cursor" />}
    </svg>
  );
}

export function ConvStepLab() {
  const [grid, setGrid] = useState(() => PRESETS[0].grid());
  const [preset, setPreset] = useState('edge');
  const [kerId, setKerId] = useState('sobelx');
  const [brush, setBrush] = useState(8);
  const [pos, setPos] = useState(18); // window at row 3, col 0
  const [playing, setPlaying] = useState(false);

  const kernel = SLIDE6_FILTERS.find((k) => k.id === kerId);
  const out = useMemo(() => convValid(grid, kernel.m), [grid, kernel]);
  const all = useMemo(() => SLIDE6_FILTERS.map((f) => ({ f, out: convValid(grid, f.m) })), [grid]);
  const last = ON * ON - 1;
  const oy = Math.floor(pos / ON);
  const ox = pos % ON;

  useEffect(() => {
    if (!playing) return undefined;
    const t = setTimeout(() => {
      if (pos >= last) setPlaying(false);
      else setPos(pos + 1);
    }, 450);
    return () => clearTimeout(t);
  }, [playing, pos, last]);

  const paint = (r, c) => {
    setGrid((g) => {
      if (g[r][c] === brush) return g;
      const next = g.map((row) => row.slice());
      next[r][c] = brush;
      return next;
    });
    setPreset(null);
  };

  const terms = [];
  for (let j = -1; j <= 1; j++) {
    for (let i = -1; i <= 1; i++) {
      const I = grid[oy + 1 + j][ox + 1 + i];
      const w = kernel.m[j + 1][i + 1];
      terms.push({ i, j, I, w, p: I * w });
    }
  }
  const sum = terms.reduce((a, t) => a + t.p, 0);
  const x = ox + 1;
  const y = oy + 1;
  const maxAbs = Math.max(1e-9, ...out.flat().map((v) => Math.abs(v)));

  const onOutKey = (e) => {
    const nx = gridStep(e.key, { r: oy, c: ox }, ON, ON);
    if (nx) { e.preventDefault(); setPlaying(false); setPos(nx.r * ON + nx.c); }
  };

  return (
    <Lab
      title="Convolution stepper · 8×8 image, 3×3 filter"
      slides="slide 6"
      tryThis="with Sobel-x on the vertical edge, step along row 3 — the sum is 0 on flat areas and jumps where the window straddles the edge; then paint your own shape and compare the four filters underneath."
    >
      <div className="dl-lab__controls">
        <Chips
          label="Input image"
          value={preset}
          options={PRESETS.map((p) => ({ v: p.id, l: p.label }))}
          onChange={(id) => { setGrid(PRESETS.find((p) => p.id === id).grid()); setPreset(id); setPlaying(false); }}
        />
        <Chips label="Paint value" value={brush} options={[{ v: 8, l: 'bright 8' }, { v: 4, l: 'mid 4' }, { v: 0, l: 'erase 0' }]} onChange={setBrush} />
        <Chips label="Filter" value={kerId} options={SLIDE6_FILTERS.map((k) => ({ v: k.id, l: k.name, tag: k.role }))} onChange={(id) => { setKerId(id); setPlaying(false); }} />
      </div>

      <div className="dl3s-conv">
        <div>
          <p className="dl3s-stagehead">Input <Tex src="\mathcal{I}" /> · paint on me</p>
          <PaintGrid grid={grid} onPaint={paint} win={{ r: oy, c: ox }} />
          <p className="dl3s-cap">Window centred on (x, y) = ({x}, {y}) — x is the column, y the row, counted from 0.</p>
        </div>

        <div className="dl3s-terms">
          <p className="dl3s-stagehead">{kernel.name} {kernel.div === 9 && <span className="dl3s-badge">× 1/9</span>}</p>
          <div className="dl3s-mat" aria-label="The 3 by 3 filter weights">
            {kernel.m.flat().map((w, k) => <span key={k} className="dl3s-mat__w">{w}</span>)}
          </div>
          <p className="dl3s-stagehead">9 products <Tex src="\mathcal{I}(x{+}i,\, y{+}j)\, f(i,j)" /></p>
          <div className="dl3s-mat">
            {terms.map((t) => (
              <span key={`${t.i}${t.j}`} className="dl3s-prod" title={`i=${t.i}, j=${t.j}`}>
                <span className="dl3s-prod__ab">{t.I}×{fmtW(t.w)}</span>
                <b className={t.p > 0 ? 'dl3s-pos' : t.p < 0 ? 'dl3s-neg' : ''}>{t.p}</b>
              </span>
            ))}
          </div>
          <p className="dl3s-sum">
            {terms.map((t) => fmtW(t.p)).join(' + ')}
            <br />= <b>{sum}</b>{kernel.div === 9 && <> → × 1/9 = <b>{(sum / 9).toFixed(2)}</b></>}
          </p>
          <Tex block src={`\\mathcal{I}'(${x}, ${y}) = ${kernel.div === 9 ? `\\tfrac{1}{9}\\cdot ${sum} = ${(sum / 9).toFixed(2)}` : sum}`} />
        </div>

        <div>
          <p className="dl3s-stagehead">Output <Tex src="\mathcal{I}'" /> · 6×6 · position {pos + 1}/36</p>
          <svg
            viewBox={`0 0 ${ON * C} ${ON * C}`}
            className="dl3s-svg dl3s-grid"
            tabIndex={0}
            role="application"
            aria-label={`Output feature map. Current position x ${x}, y ${y}, value ${fmtOut(out[oy][ox], kernel.div)}. Arrow keys move the window.`}
            onKeyDown={onOutKey}
          >
            {out.map((row, r) =>
              row.map((v, c) => {
                const k = r * ON + c;
                const seen = k <= pos;
                const cur = k === pos;
                const mag = Math.abs(v) / maxAbs;
                return (
                  <g key={`${r}-${c}`} className="dl3s-ocell-g" onClick={() => { setPlaying(false); setPos(k); }}>
                    <rect
                      x={c * C}
                      y={r * C}
                      width={C}
                      height={C}
                      className={`dl3s-ocell${cur ? ' dl3s-ocell--cur' : ''}`}
                      style={seen && v !== 0 ? { fill: v > 0 ? 'var(--dlv-orange)' : 'var(--dlv-blue)', fillOpacity: 0.15 + 0.7 * mag } : undefined}
                    />
                    {seen && (
                      <text x={c * C + C / 2} y={r * C + C / 2 + 4} textAnchor="middle" className={`dl3s-cellv${mag > 0.6 ? ' dl3s-cellv--inv' : ''}`}>
                        {fmtOut(v, kernel.div)}
                      </text>
                    )}
                  </g>
                );
              }),
            )}
          </svg>
          <div className="dl3s-btnrow">
            <button type="button" className="dl-btn dl3s-ibtn" onClick={() => { setPlaying(false); setPos((p) => Math.max(0, p - 1)); }} disabled={pos === 0} aria-label="Previous position">
              <Icon name="skipBack" size={14} /> back
            </button>
            <button type="button" className="dl-btn dl3s-ibtn" onClick={() => setPlaying((p) => !p)} disabled={pos >= last && !playing}>
              <Icon name={playing ? 'pause' : 'play'} size={14} /> {playing ? 'pause' : 'play'}
            </button>
            <button type="button" className="dl-btn dl3s-ibtn" onClick={() => { setPlaying(false); setPos((p) => Math.min(last, p + 1)); }} disabled={pos >= last} aria-label="Next position">
              step <Icon name="skipForward" size={14} />
            </button>
            <button type="button" className="dl-btn" onClick={() => { setPlaying(false); setPos(0); }}>reset</button>
          </div>
          <p className="dl3s-cap">Only 6×6: the 3×3 filter must fit inside the 8×8 image (borders: see §7). Orange = positive, blue = negative; every cell shows its value.</p>
        </div>
      </div>

      <div className="dl3s-four">
        <p className="dl3s-stagehead">The same input through all four slide-6 filters</p>
        <div className="dl3s-four__row">
          {all.map(({ f, out: o }) => {
            const m = Math.max(1e-9, ...o.flat().map((v) => Math.abs(v)));
            return (
              <figure key={f.id} className={`dl3s-four__item${f.id === kerId ? ' dl3s-four__item--on' : ''}`}>
                <svg viewBox={`0 0 ${ON * 24} ${ON * 24}`} className="dl3s-svg dl3s-grid dl3s-grid--mini" role="img" aria-label={`${f.name} output`}>
                  {o.map((row, r) =>
                    row.map((v, c) => (
                      <g key={`${r}-${c}`}>
                        <rect x={c * 24} y={r * 24} width={24} height={24} className="dl3s-ocell" style={v !== 0 ? { fill: v > 0 ? 'var(--dlv-orange)' : 'var(--dlv-blue)', fillOpacity: 0.15 + 0.7 * (Math.abs(v) / m) } : undefined} />
                        <text x={c * 24 + 12} y={r * 24 + 16} textAnchor="middle" className={`dl3s-cellv dl3s-cellv--s${Math.abs(v) / m > 0.6 ? ' dl3s-cellv--inv' : ''}`}>
                          {fmtOut(v, f.div)}
                        </text>
                      </g>
                    )),
                  )}
                </svg>
                <figcaption>
                  <button type="button" className="dl3s-link" onClick={() => setKerId(f.id)}>{f.name}</button>
                  <span>{f.role}</span>
                </figcaption>
              </figure>
            );
          })}
        </div>
      </div>
    </Lab>
  );
}
