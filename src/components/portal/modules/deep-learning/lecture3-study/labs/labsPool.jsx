import { useMemo, useState } from 'react';
import { Lab, Chips, Stat } from '../ui';
import { pool2d, coveredExtent, shiftGrid, outSize, convParams, fmtInt } from '../cnn';
import { gridStep } from '../hooks';
import { mulberry32 } from '../../mathfns';

/* ============================================================================
   LECTURE 3 STUDY — LABS FOR §9 AND §10
     PoolingLab     Figure 14-9 live: max or average pooling over a 6×9 map
                    (first window 1, 5, 3, 2 → 5, last column dropped); shift
                    the input a pixel and count which outputs survive
     DepthPoolLab   depthwise max pooling (Figure 14-11's rotation trick) and
                    global average pooling (slide 31)
     HyperparamLab  slide 32 as a checklist you can turn: every Conv2D and
                    pooling hyperparameter, with its effect on a 28×28×1 input
   ========================================================================== */

/* ── §9 · max vs average pooling ─────────────────────────────────────────── */
const FIG149 = [
  [1, 5, 0, 2, 7, 1, 0, 3, 4],
  [3, 2, 1, 0, 4, 2, 6, 1, 2],
  [0, 1, 8, 2, 0, 1, 1, 0, 5],
  [2, 0, 3, 1, 2, 9, 0, 2, 1],
  [1, 4, 0, 0, 6, 1, 3, 1, 0],
  [0, 2, 1, 5, 1, 0, 2, 8, 3],
];

function noisyPeaks() {
  const rng = mulberry32(23);
  const g = Array.from({ length: 6 }, () => Array.from({ length: 8 }, () => Math.floor(rng() * 3)));
  [[0, 2], [1, 6], [2, 0], [3, 4], [4, 2], [5, 6]].forEach(([r, c]) => { g[r][c] = 9; });
  return g;
}

const fmtP = (v) => (Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/0$/, ''));

export function PoolingLab() {
  const [preset, setPreset] = useState('fig');
  const [mode, setMode] = useState('max');
  const [size, setSize] = useState(2);
  const [strideOpt, setStrideOpt] = useState('auto');
  const [shift, setShift] = useState(0);
  const [sel, setSel] = useState({ r: 0, c: 0 });

  const base = useMemo(() => (preset === 'fig' ? FIG149 : noisyPeaks()), [preset]);
  const stride = strideOpt === 'auto' ? size : strideOpt;
  const grid = useMemo(() => shiftGrid(base, shift), [base, shift]);
  const out = pool2d(grid, size, stride, mode);
  const rows = out.length;
  const cols = rows ? out[0].length : 0;
  const r = Math.min(sel.r, Math.max(0, rows - 1));
  const c = Math.min(sel.c, Math.max(0, cols - 1));
  const H = grid.length;
  const W = grid[0].length;
  const coverR = coveredExtent(H, size, stride);
  const coverC = coveredExtent(W, size, stride);

  // the shift test: how many outputs survive a shift, for both kinds
  const same = (a, b) => a.reduce((n, row, i) => n + row.filter((v, j) => Math.abs(v - b[i][j]) < 1e-9).length, 0);
  const survive = (m) => same(pool2d(grid, size, stride, m), pool2d(base, size, stride, m));
  const total = rows * cols;
  const keptMax = survive('max');
  const keptAvg = survive('avg');
  const ref = pool2d(base, size, stride, mode);

  const win = [];
  for (let u = 0; u < size; u++) for (let v = 0; v < size; v++) win.push(grid[r * stride + u][c * stride + v]);
  const C = 30;
  const OX = W * C + 60;

  const onKey = (e) => {
    const nx = gridStep(e.key, { r, c }, rows, cols);
    if (nx) { e.preventDefault(); setSel(nx); }
  };

  return (
    <Lab
      title="Figure 14-9 live · max vs average pooling"
      slides="slides 25–28"
      tryThis="point at the outputs to see each window (the first is 1, 5, 3, 2 → 5), then shift the input 1 px and compare how many outputs survive under max vs average pooling."
    >
      <div className="dl-lab__controls">
        <Chips label="Input" value={preset} options={[{ v: 'fig', l: 'Figure 14-9 grid · 6×9' }, { v: 'peaks', l: 'Strong features + noise · 6×8' }]} onChange={(v) => { setPreset(v); setShift(0); }} />
        <Chips label="Pooling" value={mode} options={[{ v: 'max', l: 'MaxPooling2D' }, { v: 'avg', l: 'AveragePooling2D' }]} onChange={setMode} />
        <Chips code label="pool_size" value={size} options={[{ v: 2, l: '2×2' }, { v: 3, l: '3×3' }]} onChange={setSize} />
        <Chips code label="strides" value={strideOpt} options={[{ v: 'auto', l: 'default = pool size' }, 1, 2, 3]} onChange={setStrideOpt} />
        <Chips label="Shift input" value={shift} options={[{ v: -2, l: '← 2 px' }, { v: -1, l: '← 1 px' }, { v: 0, l: 'none' }, { v: 1, l: '1 px →' }, { v: 2, l: '2 px →' }]} onChange={setShift} />
      </div>

      <svg
        viewBox={`0 0 ${OX + Math.max(cols, 3) * C + 20} ${H * C + 50}`}
        className="dl3s-svg dl3s-pool"
        tabIndex={0}
        role="application"
        aria-label={`Input ${H} by ${W}, ${mode} pooling ${size} by ${size}, stride ${stride}: output ${rows} by ${cols}. Selected output ${r}, ${c} = ${fmtP(out[r]?.[c] ?? 0)}. Arrow keys move.`}
        onKeyDown={onKey}
      >
        <text x={0} y={14} className="dl3s-svg__label dl3s-svg__label--ink">input {H}×{W}{shift ? ` · shifted ${Math.abs(shift)} px ${shift > 0 ? 'right' : 'left'}` : ''}</text>
        {grid.map((row, a) =>
          row.map((v, b) => {
            const inWin = a >= r * stride && a < r * stride + size && b >= c * stride && b < c * stride + size;
            const dropped = a >= coverR || b >= coverC;
            const isMax = inWin && mode === 'max' && v === out[r][c];
            return (
              <g key={`${a}-${b}`}>
                <rect x={b * C} y={24 + a * C} width={C} height={C} className={`dl3s-pcell${inWin ? ' dl3s-pcell--win' : ''}${dropped ? ' dl3s-pcell--drop' : ''}`} />
                <text x={b * C + C / 2} y={24 + a * C + C / 2 + 4} textAnchor="middle" className={`dl3s-cellv${isMax ? ' dl3s-cellv--max' : ''}`}>{v}</text>
                {isMax && <circle cx={b * C + C / 2} cy={24 + a * C + C / 2} r={10} className="dl3s-maxring" />}
                {dropped && <line x1={b * C + 4} y1={24 + a * C + 4} x2={b * C + C - 4} y2={24 + a * C + C - 4} className="dl3s-dropx" />}
              </g>
            );
          }),
        )}
        <text x={OX} y={14} className="dl3s-svg__label dl3s-svg__label--ink">output {rows}×{cols}</text>
        {out.map((row, a) =>
          row.map((v, b) => {
            const on = a === r && b === c;
            const changed = Math.abs(v - (ref[a]?.[b] ?? v)) > 1e-9;
            return (
              <g key={`o${a}-${b}`} className="dl3s-ocell-g" onPointerEnter={() => setSel({ r: a, c: b })} onClick={() => setSel({ r: a, c: b })}>
                <rect x={OX + b * C} y={24 + a * C} width={C} height={C} className={`dl3s-pcell dl3s-pcell--out${on ? ' dl3s-pcell--on' : ''}${shift && changed ? ' dl3s-pcell--changed' : ''}`} />
                <text x={OX + b * C + C / 2} y={24 + a * C + C / 2 + 4} textAnchor="middle" className="dl3s-cellv">{fmtP(v)}</text>
                {shift !== 0 && changed && <circle cx={OX + b * C + C - 6} cy={24 + a * C + 6} r={2.6} className="dl3s-changedot" />}
              </g>
            );
          }),
        )}
        {(coverR < H || coverC < W) && <text x={0} y={24 + H * C + 18} className="dl3s-svg__label">crossed cells are dropped: no window reaches them (“valid”, no padding)</text>}
        {shift !== 0 && <text x={OX} y={24 + rows * C + 18} className="dl3s-svg__label">● = changed by the shift</text>}
      </svg>

      <div className="dl3s-stats">
        <Stat k="this output" v={fmtP(out[r]?.[c] ?? 0)} tone="accent" sub={mode === 'max' ? `max(${win.join(', ')})` : `(${win.join(' + ')}) / ${win.length}`} />
        <Stat k="max pooling after the shift" v={shift ? `${keptMax}/${total} same` : '—'} sub={shift ? 'outputs unchanged by the shift' : 'pick a shift to test'} />
        <Stat k="average pooling after the shift" v={shift ? `${keptAvg}/${total} same` : '—'} sub={shift ? 'outputs unchanged by the shift' : 'pick a shift to test'} />
      </div>
      <p className="dl3s-cap">
        No weights anywhere: a pooling neuron only aggregates its window. With the “strong features + noise” input, max pooling usually keeps more outputs after a small shift —
        the stronger translation invariance of slide 27 — while every noise pixel that crosses a window edge moves an average.
      </p>
    </Lab>
  );
}

/* ── §9 · depthwise max pooling and global average pooling ───────────────── */
const GLYPH = [
  [1, 0, 0, 0, 0],
  [1, 0, 0, 0, 0],
  [1, 0, 0, 0, 0],
  [1, 1, 1, 1, 0],
  [0, 0, 0, 0, 0],
];
const rot90 = (m) => m[0].map((_, c) => m.map((row) => row[c]).reverse());
const rotN = (m, n) => { let g = m; for (let k = 0; k < n; k++) g = rot90(g); return g; };
const dot = (a, b) => a.reduce((s, row, r) => s + row.reduce((t, v, c) => t + v * b[r][c], 0), 0);
const ROTS = [0, 1, 2, 3];

function Mini({ m, size = 9, label, hi }) {
  return (
    <svg viewBox={`0 0 ${m[0].length * size} ${m.length * size}`} className={`dl3s-glyph${hi ? ' dl3s-glyph--hi' : ''}`} role="img" aria-label={label}>
      {m.map((row, r) => row.map((v, c) => <rect key={`${r}${c}`} x={c * size} y={r * size} width={size} height={size} className={v ? 'dl3s-glyph__on' : 'dl3s-glyph__off'} />))}
    </svg>
  );
}

const GAP_MAPS = (() => {
  const rng = mulberry32(41);
  return [0, 1, 2].map(() => Array.from({ length: 4 }, () => Array.from({ length: 4 }, () => Math.round(rng() * 8))));
})();

export function DepthPoolLab() {
  const [rot, setRot] = useState(0);
  const [gap, setGap] = useState(0);
  const input = rotN(GLYPH, rot);
  const filters = ROTS.map((n) => rotN(GLYPH, n));
  const maps = filters.map((f) => dot(input, f));
  const best = maps.indexOf(Math.max(...maps));
  const out = Math.max(...maps);
  const means = GAP_MAPS.map((m) => m.flat().reduce((a, b) => a + b, 0) / 16);

  return (
    <Lab
      title="Pooling across depth · depthwise max pooling and global average pooling"
      slides="slides 29–31"
      tryThis="rotate the input pattern — a different feature map lights up each time, but the depthwise max-pooled output stays the same (Figure 14-11); then point at a map in the second panel to see it averaged to one number."
    >
      <div className="dl3s-depthpool">
        <div className="dl3s-depthpool__panel">
          <p className="dl3s-stagehead">Depthwise max pooling (Figure 14-11)</p>
          <Chips label="Rotate input" value={rot} options={ROTS.map((n) => ({ v: n, l: `${n * 90}°` }))} onChange={setRot} compact />
          <div className="dl3s-dpflow">
            <figure className="dl3s-dpstep">
              <Mini m={input} size={11} label={`Input pattern rotated ${rot * 90} degrees`} />
              <figcaption>input · 5×5</figcaption>
            </figure>
            <span className="dl3s-dparrow" aria-hidden="true">→</span>
            <figure className="dl3s-dpstep">
              <div className="dl3s-dpmaps">
                {filters.map((f, n) => (
                  <div key={n} className={`dl3s-dpmap${n === best ? ' dl3s-dpmap--on' : ''}`}>
                    <Mini m={f} size={5} label={`Learned filter for ${n * 90} degrees`} />
                    <b>{maps[n]}</b>
                  </div>
                ))}
              </div>
              <figcaption>conv layer: 4 learned filters (one per rotation) → 4 feature maps (1×1 each)</figcaption>
            </figure>
            <span className="dl3s-dparrow" aria-hidden="true">→</span>
            <figure className="dl3s-dpstep">
              <div className="dl3s-dpout"><b>{out}</b></div>
              <figcaption>depthwise max pool: depth 4 → 1, same height × width</figcaption>
            </figure>
          </div>
          <p className="dl3s-cap">Each map scores how well the input matches that filter (7 = all seven strokes line up). The max across the depth is {out} for every rotation.</p>
        </div>

        <div className="dl3s-depthpool__panel">
          <p className="dl3s-stagehead">Global average pooling (slide 31)</p>
          <div className="dl3s-gap">
            {GAP_MAPS.map((m, n) => (
              <button key={n} type="button" className={`dl3s-gapmap${gap === n ? ' dl3s-gapmap--on' : ''}`} onPointerEnter={() => setGap(n)} onFocus={() => setGap(n)} onClick={() => setGap(n)} aria-pressed={gap === n}>
                <span className="dl3s-gapmap__grid">
                  {m.flat().map((v, k) => <i key={k}>{v}</i>)}
                </span>
                <span className="dl3s-gapmap__name">map {n + 1} → <b>{fmtP(means[n])}</b></span>
              </button>
            ))}
          </div>
          <p className="dl3s-readout">
            map {gap + 1}: ({GAP_MAPS[gap].flat().join(' + ')}) / 16 = <b>{fmtP(means[gap])}</b>
          </p>
          <p className="dl3s-cap">
            A 4×4×3 volume becomes 3 numbers — one per feature map, whatever the height and width. On slide 31, <code>GlobalAvgPool2D()</code> turns images of shape{' '}
            <code>[2, 70, 120, 3]</code> into shape <code>(2, 3)</code>.
          </p>
        </div>
      </div>
    </Lab>
  );
}

/* ── §10 · the hyperparameter checklist ──────────────────────────────────── */
export function HyperparamLab() {
  const [filters, setFilters] = useState(32);
  const [k, setK] = useState(3);
  const [cs, setCs] = useState(1);
  const [cpad, setCpad] = useState('same');
  const [ps, setPs] = useState(2);
  const [pstr, setPstr] = useState('None');
  const [ppad, setPpad] = useState('valid');
  const [ticked, setTicked] = useState(() => new Set());

  const n = 28;
  const ch = outSize(n, k, cs, cpad);
  const pst = pstr === 'None' ? ps : pstr;
  const ph = ch > 0 ? outSize(ch, ps, pst, ppad) : 0;
  const params = convParams(k, k, 1, filters);

  const tick = (id) => setTicked((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  const rows = [
    { id: 'f', layer: 'Conv2D', what: 'the number of filters', arg: 'filters', ctl: <Chips code label="filters" value={filters} options={[16, 32, 64, 128]} onChange={setFilters} compact />, effect: `output depth ${filters}; parameters ${fmtInt(params)}` },
    { id: 'k', layer: 'Conv2D', what: 'their height and width', arg: 'kernel_size', ctl: <Chips code label="kernel_size" value={k} options={[3, 5, 7]} onChange={setK} compact />, effect: `(${k}×${k}×1 + 1) × ${filters} = ${fmtInt(params)} parameters` },
    { id: 's', layer: 'Conv2D', what: 'the strides', arg: 'strides', ctl: <Chips code label="strides" value={cs} options={[1, 2]} onChange={setCs} compact />, effect: `output ${ch}×${ch}` },
    { id: 'p', layer: 'Conv2D', what: 'the padding type ("SAME" or "VALID")', arg: 'padding', ctl: <Chips code label="padding" value={cpad} options={[{ v: 'same', l: '"same"' }, { v: 'valid', l: '"valid"' }]} onChange={setCpad} compact />, effect: `output ${ch}×${ch}` },
    { id: 'ps', layer: 'Pooling', what: 'the pool size', arg: 'pool_size', ctl: <Chips code label="pool_size" value={ps} options={[2, 3]} onChange={setPs} compact />, effect: `output ${ph}×${ph}` },
    { id: 'pst', layer: 'Pooling', what: 'the stride (default None)', arg: 'strides', ctl: <Chips code label="strides" value={pstr} options={[{ v: 'None', l: 'None = pool size' }, 1, 2, 3]} onChange={setPstr} compact />, effect: `stride ${pst} → output ${ph}×${ph}` },
    { id: 'pp', layer: 'Pooling', what: 'the padding type (default "valid")', arg: 'padding', ctl: <Chips code label="padding" value={ppad} options={[{ v: 'valid', l: '"valid"' }, { v: 'same', l: '"same"' }]} onChange={setPpad} compact />, effect: `output ${ph}×${ph}` },
  ];

  const convArgs = [`filters=${filters}`, `kernel_size=${k}`];
  if (cs !== 1) convArgs.push(`strides=${cs}`);
  if (cpad !== 'valid') convArgs.push(`padding="${cpad}"`);
  const poolArgs = [`pool_size=${ps}`];
  if (pstr !== 'None') poolArgs.push(`strides=${pstr}`);
  if (ppad !== 'valid') poolArgs.push(`padding="${ppad}"`);

  return (
    <Lab
      title="Slide 32 as a checklist · what you choose for each layer"
      slides="slide 32"
      tryThis="turn each hyperparameter and read its effect — filters and kernel_size change the parameter count, while strides, padding and the pooling settings change the output size."
    >
      <div className="dl-tablewrap">
        <table className="dl-table dl3s-hyper">
          <thead>
            <tr><th scope="col">Got it</th><th scope="col">Layer</th><th scope="col">You choose…</th><th scope="col">Keras argument</th><th scope="col">Try</th><th scope="col">Effect on a 28×28×1 input</th></tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className={ticked.has(row.id) ? 'dl3s-hyper--done' : undefined}>
                <td>
                  <button type="button" className={`dl3s-chk${ticked.has(row.id) ? ' dl3s-chk--on' : ''}`} aria-pressed={ticked.has(row.id)} aria-label={`Mark "${row.what}" as understood`} onClick={() => tick(row.id)} />
                </td>
                <td>{row.layer}</td>
                <td>{row.what}</td>
                <td><code>{row.arg}</code></td>
                <td>{row.ctl}</td>
                <td className="dl3s-hyper__effect">{row.effect}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="dl3s-readout">
        <code>Conv2D({convArgs.join(', ')})</code> → {ch}×{ch}×{filters} · <code>MaxPool2D({poolArgs.join(', ')})</code> → {ph}×{ph}×{filters}
      </p>
      <p className="dl3s-cap">{ticked.size}/{rows.length} ticked. Cross-validation could search all of these, but it is very time-consuming — so §11–§12 look at what common architectures use.</p>
    </Lab>
  );
}
