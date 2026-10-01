import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Tex } from '../../kit';
import { Lab, Chips, Range, Stat } from '../ui';
import { outSizePad, convValidFlat, fmtInt } from '../cnn';
import { gridStep, svgCell } from '../hooks';
import { mulberry32 } from '../../mathfns';

/* ============================================================================
   LECTURE 3 STUDY — LABS FOR §3, §4 AND §5
     ReceptiveFieldLab  Figure 14-4 with every knob: f_h, f_w, s_h, s_w and
                        zero padding; hover an output neuron to light up its
                        receptive field; output size, connections and the
                        shared-filter parameter count update live
                        (adapted from lecture3/labs.jsx StrideLab)
     FilterMapLab       Figure 14-5 computed for real: two editable 7×7 filters
                        (default: slide 10's vertical and horizontal lines)
                        convolved over an image; probe a feature map to see
                        the receptive field behind each value
     ChannelSumLab      Figure 14-6 / slides 14–15: an RGB input, K filters of
                        3×3×3; click an output neuron to expand z_{i,j,k}
                        term by term over the slide-14 index ranges
   ========================================================================== */

/* ── §3 · receptive fields, strides, padding ─────────────────────────────── */
const IN_H = 5;
const IN_W = 7;
const RC = 24;
const RF_COL = 'var(--dlv-orange)';

export function ReceptiveFieldLab() {
  const hatch = useId();
  const [fh, setFh] = useState(3);
  const [fw, setFw] = useState(3);
  const [sh, setSh] = useState(2);
  const [sw, setSw] = useState(2);
  const [pad, setPad] = useState(1);
  const [sel, setSel] = useState({ i: 0, j: 1 });

  const rows = outSizePad(IN_H, fh, sh, pad);
  const cols = outSizePad(IN_W, fw, sw, pad);
  const PH = IN_H + 2 * pad;
  const PW = IN_W + 2 * pad;
  const ok = rows > 0 && cols > 0;
  const i = Math.min(sel.i, Math.max(0, rows - 1));
  const j = Math.min(sel.j, Math.max(0, cols - 1));
  const coverH = ok ? (rows - 1) * sh + fh : 0;
  const coverW = ok ? (cols - 1) * sw + fw : 0;

  const IX = 74;
  const IY = 30;
  const OX = IX + PW * RC + 70;
  const OY = IY + Math.max(0, ((PH - rows) * RC) / 2);
  const W = OX + Math.max(cols, 4) * RC + 20;
  const H = IY + Math.max(PH, rows) * RC + 44;

  const onKey = (e) => {
    const nx = gridStep(e.key, { r: i, c: j }, rows, cols);
    if (nx) { e.preventDefault(); setSel({ i: nx.r, j: nx.c }); }
  };

  const rx = IX + j * sw * RC;
  const ry = IY + i * sh * RC;
  const cx = OX + j * RC;
  const cy = OY + i * RC;

  return (
    <Lab
      title="Figure 14-4, with every knob · receptive fields, strides, zero padding"
      slides="slides 7–9"
      tryThis="hover the output neurons to see one window shifted by the stride, then set padding to 0 (3×4 becomes 2×3) and raise f_w to 5 — the field widens, but there is still only one shared filter."
    >
      <div className="dl-sliders">
        <Range label="f_h (field height)" value={fh} min={1} max={5} onChange={setFh} />
        <Range label="f_w (field width)" value={fw} min={1} max={5} onChange={setFw} />
        <Range label="s_h (vertical stride)" value={sh} min={1} max={3} onChange={setSh} />
        <Range label="s_w (horizontal stride)" value={sw} min={1} max={3} onChange={setSw} />
        <Range label="zero padding" value={pad} min={0} max={2} onChange={setPad} fmt={(v) => `${v} ring${v === 1 ? '' : 's'}`} />
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="dl3s-svg dl3s-rf"
        tabIndex={0}
        role="application"
        aria-label={ok ? `Output ${rows} by ${cols}. Neuron row ${i}, column ${j} sees rows ${i * sh} to ${i * sh + fh - 1} and columns ${j * sw} to ${j * sw + fw - 1} of the padded input. Arrow keys move between neurons.` : 'The receptive field is larger than the padded input, so there is no output.'}
        onKeyDown={onKey}
        style={{ maxWidth: W * 1.15 }}
      >
        <defs>
          <pattern id={hatch} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke="var(--ink-3)" strokeWidth="1.1" opacity="0.55" />
          </pattern>
        </defs>
        <text x={IX} y={18} className="dl3s-svg__label dl3s-svg__label--ink">
          input {IN_H}×{IN_W}{pad ? ` + ${pad} ring${pad > 1 ? 's' : ''} of zero padding` : ''}
        </text>
        {/* row / column indices on the padded grid */}
        {Array.from({ length: PH }, (_, r) => (
          <text key={`r${r}`} x={IX - 8} y={IY + r * RC + RC / 2 + 4} textAnchor="end" className="dl3s-tick">{r}</text>
        ))}
        {Array.from({ length: PW }, (_, c) => (
          <text key={`c${c}`} x={IX + c * RC + RC / 2} y={IY + PH * RC + 13} textAnchor="middle" className="dl3s-tick">{c}</text>
        ))}
        {Array.from({ length: PH }, (_, r) =>
          Array.from({ length: PW }, (_, c) => {
            const isPad = r < pad || c < pad || r >= PH - pad || c >= PW - pad;
            const unread = ok && (r >= coverH || c >= coverW);
            return (
              <g key={`${r}-${c}`}>
                <rect x={IX + c * RC} y={IY + r * RC} width={RC} height={RC} className={`dl3s-rfcell${isPad ? ' dl3s-rfcell--pad' : ''}`} style={isPad ? { fill: `url(#${hatch})` } : undefined} />
                {unread && !isPad && <text x={IX + c * RC + RC / 2} y={IY + r * RC + RC / 2 + 4} textAnchor="middle" className="dl3s-rfcell__x">×</text>}
              </g>
            );
          }),
        )}
        {ok && (
          <>
            <rect x={rx} y={ry} width={fw * RC} height={fh * RC} className="dl3s-rfbox" style={{ stroke: RF_COL, fill: RF_COL }} />
            {[[0, 0], [1, 0], [0, 1], [1, 1]].map(([a, b]) => (
              <line key={`${a}${b}`} x1={cx + a * RC} y1={cy + b * RC} x2={rx + a * fw * RC} y2={ry + b * fh * RC} className="dl3s-rfline" style={{ stroke: RF_COL }} />
            ))}
            <text x={OX} y={18} className="dl3s-svg__label dl3s-svg__label--ink">output {rows}×{cols}</text>
            {Array.from({ length: rows }, (_, a) =>
              Array.from({ length: cols }, (_, b) => {
                const on = a === i && b === j;
                return (
                  <rect
                    key={`${a}-${b}`}
                    x={OX + b * RC}
                    y={OY + a * RC}
                    width={RC}
                    height={RC}
                    className={`dl3s-rfcell dl3s-rfcell--out${on ? ' dl3s-rfcell--on' : ''}`}
                    style={on ? { stroke: RF_COL, fill: RF_COL } : undefined}
                    onPointerEnter={() => setSel({ i: a, j: b })}
                    onClick={() => setSel({ i: a, j: b })}
                  />
                );
              }),
            )}
            <text x={cx + RC / 2} y={cy + RC / 2 + 4} textAnchor="middle" className="dl3s-svg__label dl3s-svg__label--ink" pointerEvents="none">{i},{j}</text>
          </>
        )}
      </svg>
      <p className="dl3s-cap">Hatched = zero padding. × = an input cell no receptive field ever reads. Row and column numbers count the padded grid, as slide 9 does.</p>

      {ok ? (
        <>
          <p className="dl3s-readout">
            Neuron <b>(i, j) = ({i}, {j})</b> sees rows <Tex src={`i\\,s_h = ${i * sh}`} /> to <Tex src={`i\\,s_h + f_h - 1 = ${i * sh + fh - 1}`} /> and columns{' '}
            <Tex src={`j\\,s_w = ${j * sw}`} /> to <Tex src={`j\\,s_w + f_w - 1 = ${j * sw + fw - 1}`} />.
          </p>
          <div className="dl3s-stats">
            <Stat k="output size" v={`${rows} × ${cols}`} sub={<>counting positions: ⌊(5 + {2 * pad} − {fh}) / {sh}⌋ + 1 = {rows} rows, ⌊(7 + {2 * pad} − {fw}) / {sw}⌋ + 1 = {cols} columns</>} />
            <Stat k="connections" v={fmtInt(rows * cols * fh * fw)} sub={`${rows * cols} neurons × ${fh * fw} inputs each`} />
            <Stat k="parameters" v={fh * fw + 1} tone="accent" sub={`one shared ${fh}×${fw} filter W: ${fh * fw} weights + 1 bias (slide 8)`} />
          </div>
        </>
      ) : (
        <p className="dl3s-readout">The {fh}×{fw} field doesn’t fit in the {PH}×{PW} padded input, so this layer has no output — add padding or shrink the field.</p>
      )}
    </Lab>
  );
}

/* ── §4 · filters and feature maps ───────────────────────────────────────── */
const IMG = 48;
const K7 = 7;
const MAP = IMG - K7 + 1;

function buildImage(kind) {
  const img = new Float32Array(IMG * IMG);
  const rng = mulberry32(kind === 'temple' ? 7 : kind === 'grid' ? 11 : 5);
  for (let k = 0; k < img.length; k++) img[k] = rng() * 0.08;
  const px = (x, y, v = 1) => {
    if (x >= 0 && x < IMG && y >= 0 && y < IMG) img[y * IMG + x] = Math.max(img[y * IMG + x], v);
  };
  const h = (x0, x1, y, v = 1) => { for (let x = x0; x <= x1; x++) px(x, y, v); };
  const v = (y0, y1, x, val = 1) => { for (let y = y0; y <= y1; y++) px(x, y, val); };
  if (kind === 'temple') {
    h(14, 33, 6); h(14, 33, 7); // ridge
    h(6, 41, 13); h(6, 41, 14); // roof line
    for (let t = 0; t < 5; t++) { px(6 - t, 13 - t, 0.9); px(41 + t, 13 - t, 0.9); } // upturned eaves
    h(9, 38, 19, 0.85); // eave band
    [10, 16, 22, 28, 34, 39].forEach((x) => v(21, 42, x)); // columns
    [13, 19, 25, 31, 36].forEach((x) => v(27, 42, x, 0.5)); // lattice
    h(5, 43, 43); h(5, 43, 44); // base
  } else if (kind === 'grid') {
    for (let y = 4; y < IMG; y += 9) { h(3, 44, y); }
    for (let x = 4; x < IMG; x += 9) { v(3, 44, x); }
  } else {
    for (let d = -40; d < 48; d += 10) for (let x = 0; x < IMG; x++) px(x, x + d, 1);
  }
  return img;
}

const FILTER_PRESETS = {
  vertical: () => Array.from({ length: K7 * K7 }, (_, k) => (k % K7 === 3 ? 1 : 0)),
  horizontal: () => Array.from({ length: K7 * K7 }, (_, k) => (Math.floor(k / K7) === 3 ? 1 : 0)),
  diagonal: () => Array.from({ length: K7 * K7 }, (_, k) => (k % K7 === K7 - 1 - Math.floor(k / K7) ? 1 : 0)),
  clear: () => Array(K7 * K7).fill(0),
};

function GrayCanvas({ data, n, max, label }) {
  const ref = useRef(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    cv.width = n;
    cv.height = n;
    const ctx = cv.getContext('2d');
    const id = ctx.createImageData(n, n);
    const m = max > 1e-9 ? max : 1;
    for (let k = 0; k < n * n; k++) {
      const g = Math.max(0, Math.min(255, Math.round((data[k] / m) * 255)));
      id.data[k * 4] = g;
      id.data[k * 4 + 1] = g;
      id.data[k * 4 + 2] = g;
      id.data[k * 4 + 3] = 255;
    }
    ctx.putImageData(id, 0, 0);
  }, [data, n, max]);
  return <canvas ref={ref} className="dl3s-canvas" aria-label={label} role="img" />;
}

function FilterEditor({ cells, onToggle, label }) {
  const svgRef = useRef(null);
  const [cur, setCur] = useState({ r: 0, c: 3 });
  const [focused, setFocused] = useState(false);
  const S = 14;
  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${K7 * S} ${K7 * S}`}
      className="dl3s-svg dl3s-fedit"
      tabIndex={0}
      role="application"
      aria-label={`${label}: 7 by 7 weights, ${cells.filter(Boolean).length} ones. Click a cell to toggle it; arrows and Space work too.`}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onKeyDown={(e) => {
        const nx = gridStep(e.key, cur, K7, K7);
        if (nx) { e.preventDefault(); setCur(nx); return; }
        if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); onToggle(cur.r * K7 + cur.c); }
      }}
      onPointerDown={(e) => {
        const cell = svgCell(e, svgRef.current, 0, 0, S, K7, K7);
        if (cell) { setCur(cell); onToggle(cell.r * K7 + cell.c); }
      }}
    >
      {cells.map((v, k) => (
        <g key={k}>
          <rect x={(k % K7) * S} y={Math.floor(k / K7) * S} width={S} height={S} className={`dl3s-fcell${v ? ' dl3s-fcell--on' : ''}`} />
          <text x={(k % K7) * S + S / 2} y={Math.floor(k / K7) * S + S / 2 + 3} textAnchor="middle" className={`dl3s-fcell__v${v ? ' dl3s-fcell__v--on' : ''}`}>{v}</text>
        </g>
      ))}
      {focused && <rect x={cur.c * S + 1.5} y={cur.r * S + 1.5} width={S - 3} height={S - 3} className="dl3s-cursor" />}
    </svg>
  );
}

function ProbeMap({ data, max, label, sub, probe, onProbe }) {
  const wrap = useRef(null);
  const at = (e) => {
    const r = wrap.current?.getBoundingClientRect();
    if (!r) return null;
    const x = Math.floor(((e.clientX - r.left) / r.width) * MAP);
    const y = Math.floor(((e.clientY - r.top) / r.height) * MAP);
    return x >= 0 && x < MAP && y >= 0 && y < MAP ? { x, y } : null;
  };
  return (
    <figure className="dl3s-shot">
      <div
        ref={wrap}
        className="dl3s-shot__wrap"
        tabIndex={0}
        role="application"
        aria-label={`${label}. Value at x ${probe.x}, y ${probe.y}: ${data[probe.y * MAP + probe.x].toFixed(1)}. Arrow keys move the probe.`}
        onPointerMove={(e) => { const p = at(e); if (p) onProbe(p); }}
        onPointerDown={(e) => { const p = at(e); if (p) onProbe(p); }}
        onKeyDown={(e) => {
          const nx = gridStep(e.key, { r: probe.y, c: probe.x }, MAP, MAP);
          if (nx) { e.preventDefault(); onProbe({ x: nx.c, y: nx.r }); }
        }}
      >
        <GrayCanvas data={data} n={MAP} max={max} label={label} />
        <svg viewBox={`0 0 ${MAP} ${MAP}`} className="dl3s-shot__over" aria-hidden="true">
          <rect x={probe.x} y={probe.y} width={1} height={1} className="dl3s-probe" />
        </svg>
      </div>
      <figcaption className="dl3s-shot__cap">
        <b>{label}</b>
        <span>{sub}</span>
      </figcaption>
    </figure>
  );
}

export function FilterMapLab() {
  const [kind, setKind] = useState('temple');
  const [fa, setFa] = useState(FILTER_PRESETS.vertical);
  const [fb, setFb] = useState(FILTER_PRESETS.horizontal);
  const [probe, setProbe] = useState({ x: 7, y: 24 });
  const img = useMemo(() => buildImage(kind), [kind]);
  const mapA = useMemo(() => convValidFlat(img, IMG, Float32Array.from(fa), K7), [img, fa]);
  const mapB = useMemo(() => convValidFlat(img, IMG, Float32Array.from(fb), K7), [img, fb]);
  const imgMax = 1;
  const toggle = (set) => (k) => set((prev) => prev.map((v, idx) => (idx === k ? 1 - v : v)));
  const za = mapA.data[probe.y * MAP + probe.x];
  const zb = mapB.data[probe.y * MAP + probe.x];
  const onesA = fa.filter(Boolean).length;
  const onesB = fb.filter(Boolean).length;

  return (
    <Lab
      title="Figure 14-5, computed live · two 7×7 filters, two feature maps"
      slides="slides 10–11"
      tryThis="probe Feature map 1 along a temple column — it peaks only where the filter’s line of 1s sits on a bright vertical line; then switch filter 1 to the diagonal preset and watch a different feature light up."
    >
      <div className="dl-lab__controls">
        <Chips label="Input image" value={kind} options={[{ v: 'temple', l: 'Temple (Figure 14-5)' }, { v: 'grid', l: 'Window grid' }, { v: 'diag', l: 'Diagonal stripes' }]} onChange={setKind} />
      </div>
      <div className="dl3s-fmap">
        <div className="dl3s-fmap__filters">
          {[
            { name: 'Filter 1', cells: fa, set: setFa, ones: onesA },
            { name: 'Filter 2', cells: fb, set: setFb, ones: onesB },
          ].map((f) => (
            <div key={f.name} className="dl3s-fmap__filter">
              <p className="dl3s-stagehead">{f.name} · 7×7 weights ({f.ones} ones)</p>
              <FilterEditor cells={f.cells} onToggle={toggle(f.set)} label={f.name} />
              <div className="dl3s-minichips">
                {Object.keys(FILTER_PRESETS).map((p) => (
                  <button key={p} type="button" className="dl3s-minichip" onClick={() => f.set(FILTER_PRESETS[p]())}>{p}</button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="dl3s-fmap__maps">
          <figure className="dl3s-shot">
            <div className="dl3s-shot__wrap dl3s-shot__wrap--static">
              <GrayCanvas data={img} n={IMG} max={imgMax} label="Input image" />
              <svg viewBox={`0 0 ${IMG} ${IMG}`} className="dl3s-shot__over" aria-hidden="true">
                <rect x={probe.x} y={probe.y} width={K7} height={K7} className="dl3s-probe dl3s-probe--rf" />
              </svg>
            </div>
            <figcaption className="dl3s-shot__cap">
              <b>Input · {IMG}×{IMG}</b>
              <span>box = the 7×7 receptive field behind the probe</span>
            </figcaption>
          </figure>
          <ProbeMap data={mapA.data} max={mapA.max} label="Feature map 1" sub={`filter 1 · value here ${za.toFixed(1)} (max ${onesA})`} probe={probe} onProbe={setProbe} />
          <ProbeMap data={mapB.data} max={mapB.max} label="Feature map 2" sub={`filter 2 · value here ${zb.toFixed(1)} (max ${onesB})`} probe={probe} onProbe={setProbe} />
        </div>
      </div>
      <p className="dl3s-cap">
        Each map is {MAP}×{MAP}: the 7×7 filter fits {IMG} − 7 + 1 = {MAP} times across. A value is the sum of the input pixels under the filter’s 1s (inputs are 0–1), so a full
        bright line under all 7 ones gives about 7. Brighter = stronger response.
      </p>
    </Lab>
  );
}

/* ── §5 · stacking feature maps: z_{i,j,k} term by term ──────────────────── */
const XS = [
  { c: 0, name: 'R', color: 'var(--dlv-red)', m: [[1, 0, 2, 1, 0], [2, 1, 0, 1, 1], [0, 1, 3, 2, 0], [1, 2, 1, 0, 1], [0, 1, 0, 2, 1]] },
  { c: 1, name: 'G', color: 'var(--dlv-green)', m: [[0, 1, 1, 0, 2], [1, 3, 1, 2, 0], [2, 0, 1, 1, 1], [0, 1, 2, 1, 0], [1, 0, 1, 0, 2]] },
  { c: 2, name: 'B', color: 'var(--dlv-blue)', m: [[2, 1, 0, 0, 1], [0, 0, 1, 2, 1], [1, 2, 0, 1, 0], [2, 1, 1, 0, 2], [0, 2, 1, 1, 0]] },
];
const FS = [
  { b: 1, f: [[[1, 0, -1], [1, 0, -1], [1, 0, -1]], [[0, 1, 0], [0, 1, 0], [0, 1, 0]], [[0, 0, 0], [0, 1, 0], [0, 0, 0]]] },
  { b: 0, f: [[[1, 1, 1], [0, 0, 0], [-1, -1, -1]], [[0, 0, 0], [1, 1, 1], [0, 0, 0]], [[-1, 0, 0], [0, 1, 0], [0, 0, -1]]] },
  { b: -1, f: [[[0, 1, 0], [1, -1, 1], [0, 1, 0]], [[1, 0, 0], [0, 1, 0], [0, 0, 1]], [[0, 0, 1], [0, 1, 0], [1, 0, 0]]] },
];
const SN = 5;
const FK = 3;

// oblique sheet geometry: x shifts right as rows go down
const sheet = (ox, oy, n, cw, rd, sk) => ({
  pt: (r, c) => [ox + c * cw + r * sk, oy + r * rd],
  poly(r, c, h = 1, w = 1) {
    const p = [this.pt(r, c), this.pt(r, c + w), this.pt(r + h, c + w), this.pt(r + h, c)];
    return p.map((q) => q.map((v) => v.toFixed(1)).join(',')).join(' ');
  },
  n,
});

function zAt(i, j, k, s) {
  const parts = XS.map((x) => {
    const terms = [];
    for (let u = 0; u < FK; u++) for (let v = 0; v < FK; v++) terms.push({ x: x.m[i * s + u][j * s + v], w: FS[k].f[x.c][u][v] });
    return { ...x, terms, sum: terms.reduce((a, t) => a + t.x * t.w, 0) };
  });
  return { parts, z: FS[k].b + parts.reduce((a, p) => a + p.sum, 0) };
}

export function ChannelSumLab() {
  const [K, setK] = useState(2);
  const [s, setS] = useState(1);
  const [sel, setSel] = useState({ i: 1, j: 2, k: 0 });
  const on = Math.floor((SN - FK) / s) + 1;
  const i = Math.min(sel.i, on - 1);
  const j = Math.min(sel.j, on - 1);
  const k = Math.min(sel.k, K - 1);
  const { parts, z } = zAt(i, j, k, s);
  const outs = useMemo(
    () => Array.from({ length: K }, (_, kk) => Array.from({ length: on }, (_, a) => Array.from({ length: on }, (_, b) => zAt(a, b, kk, s).z))),
    [K, on, s],
  );

  const CW = 22;
  const RD = 11;
  const SK = 7;
  const inSheets = XS.map((x, n) => sheet(30, 30 + n * 74, SN, CW, RD, SK));
  const fSheets = XS.map((x, n) => sheet(258, 52 + n * 74, FK, CW, RD, SK));
  const oSheets = Array.from({ length: K }, (_, kk) => sheet(440, 40 + kk * 74, on, CW, RD, SK));
  const centre = (sh, r, c, h, w) => {
    const [x0, y0] = sh.pt(r, c);
    const [x1, y1] = sh.pt(r + h, c + w);
    return [(x0 + x1) / 2, (y0 + y1) / 2];
  };
  const target = centre(oSheets[k], i, j, 1, 1);

  return (
    <Lab
      title="Figure 14-6 in numbers · one neuron, every channel"
      slides="slides 12–15"
      tryThis="click the same (i, j) in map 1 and map 2 — the input window stays put and only the filter slices change (slide 14); then set the stride to 2 and watch the windows jump two cells."
    >
      <div className="dl-lab__controls">
        <Chips label="Filters K" value={K} options={[1, 2, 3]} onChange={setK} />
        <Chips label="Stride (both ways)" value={s} options={[1, 2]} onChange={setS} />
      </div>

      <svg viewBox="0 0 600 262" className="dl3s-svg dl3s-stack" role="img" aria-label={`Input channels R, G and B, filter ${k + 1}'s three slices, and the ${K} output feature maps; neuron ${i}, ${j} of map ${k + 1} is selected`}>
        <text x={30} y={16} className="dl3s-svg__label dl3s-svg__label--ink">input x · 5×5×3</text>
        <text x={258} y={16} className="dl3s-svg__label dl3s-svg__label--ink">filter {k + 1} · 3×3×3</text>
        <text x={440} y={16} className="dl3s-svg__label dl3s-svg__label--ink">output z · {on}×{on}×{K}</text>
        {XS.map((x, n) => {
          const sh = inSheets[n];
          const fsh = fSheets[n];
          const a = centre(sh, i * s, j * s, FK, FK);
          const b = centre(fsh, 0, 0, FK, FK);
          return (
            <g key={x.name}>
              {x.m.map((row, r) =>
                row.map((v, c) => {
                  const inWin = r >= i * s && r < i * s + FK && c >= j * s && c < j * s + FK;
                  const [tx, ty] = centre(sh, r, c, 1, 1);
                  return (
                    <g key={`${r}${c}`}>
                      <polygon points={sh.poly(r, c)} className={`dl3s-scell${inWin ? ' dl3s-scell--win' : ''}`} style={inWin ? { stroke: x.color } : undefined} />
                      <text x={tx} y={ty + 3.2} textAnchor="middle" className="dl3s-scell__v">{v}</text>
                    </g>
                  );
                }),
              )}
              <polygon points={sh.poly(i * s, j * s, FK, FK)} className="dl3s-swin" style={{ stroke: x.color }} />
              <text x={22} y={sh.pt(2.5, 0)[1] + 4} textAnchor="end" className="dl3s-svg__label" style={{ fill: x.color }}>{x.name}</text>
              <text x={22} y={sh.pt(2.5, 0)[1] + 16} textAnchor="end" className="dl3s-tick">c={x.c}</text>
              {FS[k].f[x.c].map((row, r) =>
                row.map((w, c) => {
                  const [tx, ty] = centre(fsh, r, c, 1, 1);
                  return (
                    <g key={`f${r}${c}`}>
                      <polygon points={fsh.poly(r, c)} className="dl3s-scell dl3s-scell--f" style={{ stroke: x.color }} />
                      <text x={tx} y={ty + 3.2} textAnchor="middle" className="dl3s-scell__v">{w}</text>
                    </g>
                  );
                }),
              )}
              <line x1={a[0] + 40} y1={a[1]} x2={b[0] - 40} y2={b[1]} className="dl3s-sflow" style={{ stroke: x.color }} />
              <text x={(a[0] + b[0]) / 2 + 2} y={(a[1] + b[1]) / 2 - 4} textAnchor="middle" className="dl3s-tick">∗</text>
              <line x1={b[0] + 30} y1={b[1]} x2={target[0]} y2={target[1]} className="dl3s-sflow dl3s-sflow--sum" style={{ stroke: x.color }} />
            </g>
          );
        })}
        {outs.map((m, kk) => {
          const sh = oSheets[kk];
          return (
            <g key={`o${kk}`}>
              {m.map((row, r) =>
                row.map((v, c) => {
                  const isSel = kk === k && r === i && c === j;
                  const [tx, ty] = centre(sh, r, c, 1, 1);
                  return (
                    <g key={`${r}${c}`} className="dl3s-ocell-g" onClick={() => setSel({ i: r, j: c, k: kk })}>
                      <polygon points={sh.poly(r, c)} className={`dl3s-scell dl3s-scell--out${isSel ? ' dl3s-scell--sel' : ''}`} />
                      <text x={tx} y={ty + 3.2} textAnchor="middle" className="dl3s-scell__v">{v}</text>
                    </g>
                  );
                }),
              )}
              <text x={sh.pt(0, on)[0] + 14} y={sh.pt(on / 2, on)[1] + 4} className="dl3s-svg__label">map {kk + 1}{kk === k ? ' ←' : ''}</text>
            </g>
          );
        })}
      </svg>

      <div className="dl3s-pick" role="group" aria-label="Pick an output neuron">
        {outs.map((m, kk) => (
          <div key={kk} className="dl3s-pick__map">
            <span className="dl3s-stagehead">map {kk + 1} (k = {kk + 1})</span>
            <div className="dl3s-pick__grid" style={{ gridTemplateColumns: `repeat(${on}, 1fr)` }}>
              {m.map((row, r) =>
                row.map((v, c) => {
                  const isSel = kk === k && r === i && c === j;
                  return (
                    <button
                      key={`${r}${c}`}
                      type="button"
                      className={`dl3s-pick__cell${isSel ? ' dl3s-pick__cell--on' : ''}`}
                      aria-pressed={isSel}
                      aria-label={`map ${kk + 1}, row ${r}, column ${c}: ${v}`}
                      onClick={() => setSel({ i: r, j: c, k: kk })}
                    >
                      {v}
                    </button>
                  );
                }),
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="dl3s-expand">
        <Tex
          block
          src={`z_{${i},${j},${k + 1}} = b_{${k + 1}} + \\sum_{c=0}^{2}\\;\\sum_{u=0}^{2}\\sum_{v=0}^{2} x_c(${i * s}{+}u,\\; ${j * s}{+}v)\\; f_{c,${k + 1}}(u, v)`}
        />
        <p className="dl3s-cap">
          Slide 15’s <Tex src="\boldsymbol{z}_k = b_k + \sum_c \mathbf{x}_c * f_{c,k}" /> for one neuron, using slide 14’s ranges: rows {i * s}–{i * s + 2} (<Tex src="i\,s_h" /> to <Tex src="i\,s_h + f_h - 1" />), columns {j * s}–{j * s + 2}, across all 3 channels.
        </p>
        <div className="dl3s-expand__parts">
          {parts.map((p) => (
            <div key={p.name} className="dl3s-expand__part" style={{ borderColor: p.color }}>
              <p className="dl3s-stagehead" style={{ color: p.color }}>channel {p.name} (c = {p.c})</p>
              <div className="dl3s-mat">
                {p.terms.map((t, n) => (
                  <span key={n} className="dl3s-prod">
                    <span className="dl3s-prod__ab">{t.x}×{t.w < 0 ? `(${t.w})` : t.w}</span>
                    <b className={t.x * t.w > 0 ? 'dl3s-pos' : t.x * t.w < 0 ? 'dl3s-neg' : ''}>{t.x * t.w}</b>
                  </span>
                ))}
              </div>
              <p className="dl3s-expand__sum">sum = <b>{p.sum}</b></p>
            </div>
          ))}
        </div>
        <p className="dl3s-total">
          z<sub>{i},{j},{k + 1}</sub> = b<sub>{k + 1}</sub> + R + G + B = {FS[k].b} + ({parts[0].sum}) + ({parts[1].sum}) + ({parts[2].sum}) = <b>{z}</b>
        </p>
      </div>
    </Lab>
  );
}
