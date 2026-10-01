import { useState } from 'react';
import { Code, Tex } from '../../kit';
import { Lab, Chips, Range, Stat } from '../ui';
import { outSize, samePad, convParams, fmtInt, fmtBytes, fmtBig } from '../cnn';
import { gridStep } from '../hooks';

/* ============================================================================
   LECTURE 3 STUDY — LABS FOR §6, §7 AND §8
     Conv2DLab    slides 16–19 as a live snippet: change Conv2D's arguments,
                  read fmaps.shape, kernels.shape, biases.shape and the count
     PaddingLab   Figures 14-7 and 14-8 in one row: "valid" vs "same", any
                  kernel size and stride; zeros and ignored inputs labelled
     MemoryLab    slides 22–24: the 200-filter example's parameters,
                  multiplications and RAM, then training vs testing for a
                  stack of layers, with the five out-of-memory fixes
   ========================================================================== */

/* ── §6 · Conv2D, live ───────────────────────────────────────────────────── */
function Block({ x, y, w, h, depth, label, dims, maxSheets = 6 }) {
  const n = Math.min(depth, maxSheets);
  const off = 5;
  return (
    <g>
      {Array.from({ length: n }, (_, k) => {
        const kk = n - 1 - k;
        return <rect key={k} x={x + kk * off} y={y - kk * off} width={w} height={h} className="dl3s-tblock" />;
      })}
      <text x={x + w / 2} y={y + h + 18} textAnchor="middle" className="dl3s-svg__label dl3s-svg__label--ink">{label}</text>
      <text x={x + w / 2} y={y + h + 32} textAnchor="middle" className="dl3s-tick">{dims}</text>
    </g>
  );
}

export function Conv2DLab() {
  const [filters, setFilters] = useState(32);
  const [k, setK] = useState(7);
  const [strides, setStrides] = useState(1);
  const [padding, setPadding] = useState('valid');
  const [c, setC] = useState(3);
  const [batch, setBatch] = useState(2);
  const H = 70;
  const W = 120;
  const oh = outSize(H, k, strides, padding);
  const ow = outSize(W, k, strides, padding);
  const params = convParams(k, k, c, filters);

  const args = [`filters=${filters}`, `kernel_size=${k}`];
  if (strides !== 1) args.push(`strides=${strides}`);
  if (padding !== 'valid') args.push(`padding="${padding}"`);
  const code = `images.shape   # TensorShape([${batch}, ${H}, ${W}, ${c}])

conv_layer = tf.keras.layers.Conv2D(${args.join(', ')})
fmaps = conv_layer(images)
fmaps.shape    # output: TensorShape([${batch}, ${oh}, ${ow}, ${filters}])

kernels, biases = conv_layer.get_weights()
kernels.shape  # (${k}, ${k}, ${c}, ${filters})
biases.shape   # (${filters},)`;

  const scale = 1.25;
  return (
    <Lab
      title="Slides 17–19 as a live snippet · Conv2D(...)"
      slides="slides 16–19"
      tryThis={'change kernel_size from 7 to 3 — fmaps grows from 64×114 to 68×118 and the kernels become (3, 3, 3, 32); then switch padding to "same" to keep the input’s 70×120 (§7).'}
    >
      <div className="dl-lab__controls">
        <Chips code label="kernel_size" value={k} options={[1, 3, 5, 7]} onChange={setK} />
        <Chips code label="strides" value={strides} options={[1, 2]} onChange={setStrides} />
        <Chips code label="padding" value={padding} options={[{ v: 'valid', l: '"valid" (default)' }, { v: 'same', l: '"same"' }]} onChange={setPadding} />
        <Chips label="input channels" value={c} options={[{ v: 3, l: '3 · RGB (slide 17)' }, { v: 1, l: '1 · grayscale' }]} onChange={setC} />
        <div className="dl-sliders">
          <Range label="filters" value={filters} min={1} max={128} onChange={setFilters} />
          <Range label="batch size" value={batch} min={1} max={64} onChange={setBatch} />
        </div>
      </div>

      <div className="dl3s-keras">
        <Code code={code} label="conv2d.py" meta="slides 18–19" />
        <div className="dl3s-keras__side">
          <svg viewBox="0 0 330 170" className="dl3s-svg" role="img" aria-label={`Input ${H} by ${W} by ${c} becomes ${oh} by ${ow} by ${filters}`}>
            <Block x={18} y={22} w={(W * scale) / 2} h={(H * scale) / 2} depth={c} label="images" dims={`${H}×${W}×${c}`} />
            <text x={128} y={64} className="dl3s-svg__label" textAnchor="middle">Conv2D →</text>
            <Block x={176} y={22 + ((H - oh) * scale) / 4} w={Math.max(4, (ow * scale) / 2)} h={Math.max(4, (oh * scale) / 2)} depth={filters} label="fmaps" dims={`${oh}×${ow}×${filters}`} />
          </svg>
          <div className="dl3s-stats dl3s-stats--tight">
            <Stat k="fmaps.shape" v={`[${batch}, ${oh}, ${ow}, ${filters}]`} sub="[batch, height, width, channels]" />
            <Stat k="kernels.shape" v={`(${k}, ${k}, ${c}, ${filters})`} sub="[f_h, f_w, f_c, f_n]" />
            <Stat k="biases.shape" v={`(${filters},)`} sub="one bias per filter" />
            <Stat k="parameters" v={fmtInt(params)} tone="accent" sub={`(${k}×${k}×${c} + 1) × ${filters}`} />
          </div>
        </div>
      </div>
      <p className="dl3s-cap">
        Height and width: {padding === 'valid' ? <>“valid” fits the {k}×{k} kernel ⌊({H} − {k}) / {strides}⌋ + 1 = {oh} times down and ⌊({W} − {k}) / {strides}⌋ + 1 = {ow} times across.</> : <>“same” pads with zeros so the output is ⌈{H} / {strides}⌉ = {oh} by ⌈{W} / {strides}⌉ = {ow}.</>}{' '}
        The parameter count never depends on the image size.
      </p>
    </Lab>
  );
}

/* ── §7 · "valid" vs "same", Figures 14-7 and 14-8 ───────────────────────── */
export function PaddingLab() {
  const [n, setN] = useState(10);
  const [k, setK] = useState(7);
  const [s, setS] = useState(1);
  const [padding, setPadding] = useState('valid');
  const [sel, setSel] = useState(0);

  const valid = padding === 'valid';
  const sp = samePad(n, k, s);
  const left = valid ? 0 : sp.before;
  const right = valid ? 0 : sp.after;
  const out = outSize(n, k, s, padding);
  const total = left + n + right;
  const covered = out > 0 ? (out - 1) * s + k : 0; // in padded coords
  const ignored = valid ? Math.max(0, n - covered) : 0;
  const t = Math.min(sel, Math.max(0, out - 1));

  const C = 24;
  const X0 = 16;
  const ROW = 150;
  const OUTY = 26;
  const width = X0 * 2 + total * C;
  const ox = X0 + (total * C) / 2 - (out * C) / 2;

  const onKey = (e) => {
    const nx = gridStep(e.key, { r: 0, c: t }, 1, out);
    if (nx) { e.preventDefault(); setSel(nx.c); }
  };

  return (
    <Lab
      title='Figures 14-7 and 14-8 · padding="valid" vs padding="same"'
      slides="slides 20–21"
      tryThis={'toggle "valid" → "same" to add 3 zeros each side (4 outputs become 10, Figure 14-7), then set strides to 2 — "same" gives 5 outputs and "valid" ignores the last input (Figure 14-8).'}
    >
      <div className="dl-lab__controls">
        <Chips code label="padding" value={padding} options={[{ v: 'valid', l: '"valid"' }, { v: 'same', l: '"same"' }]} onChange={setPadding} />
        <Chips code label="kernel_size" value={k} options={[1, 3, 5, 7, 9]} onChange={setK} />
        <Chips code label="strides" value={s} options={[1, 2, 3]} onChange={setS} />
        <div className="dl-sliders">
          <Range label="input length n" value={n} min={6} max={16} onChange={setN} />
        </div>
      </div>

      <svg
        viewBox={`0 0 ${Math.max(width, 300)} 214`}
        className="dl3s-svg dl3s-pad"
        tabIndex={0}
        role="application"
        aria-label={`${n} inputs, kernel ${k}, stride ${s}, ${padding} padding: ${out} outputs, ${left} zeros on the left and ${right} on the right${ignored ? `, ${ignored} input ignored` : ''}. Arrow keys pick an output.`}
        onKeyDown={onKey}
        style={{ maxWidth: Math.max(width, 300) * 1.75 }}
      >
        {/* outputs */}
        {Array.from({ length: out }, (_, o) => (
          <rect key={o} x={ox + o * C} y={OUTY} width={C} height={C} className={`dl3s-padcell dl3s-padcell--out${o === t ? ' dl3s-padcell--on' : ''}`} onPointerEnter={() => setSel(o)} onClick={() => setSel(o)} />
        ))}
        <text x={ox + out * C + 8} y={OUTY + 16} className="dl3s-svg__label dl3s-svg__label--ink">{out} output{out === 1 ? '' : 's'}</text>
        {/* windows as brackets */}
        {Array.from({ length: out }, (_, o) => {
          const x1 = X0 + o * s * C + 3;
          const x2 = X0 + (o * s + k) * C - 3;
          const by = ROW - 12 - (o % 4) * 9;
          const on = o === t;
          const mid = (x1 + x2) / 2;
          return (
            <g key={`b${o}`} className={on ? 'dl3s-bracket dl3s-bracket--on' : 'dl3s-bracket'}>
              <polyline points={`${x1},${ROW - 3} ${x1},${by} ${x2},${by} ${x2},${ROW - 3}`} />
              {on && <line x1={mid} y1={by} x2={ox + o * C + C / 2} y2={OUTY + C + 2} />}
            </g>
          );
        })}
        {/* the padded input row */}
        {Array.from({ length: total }, (_, p) => {
          const zero = p < left || p >= left + n;
          const idx = p - left;
          const ign = !zero && valid && idx >= covered;
          const inWin = p >= t * s && p < t * s + k;
          return (
            <g key={`c${p}`}>
              <rect x={X0 + p * C} y={ROW} width={C} height={C} className={`dl3s-padcell${zero ? ' dl3s-padcell--zero' : ''}${ign ? ' dl3s-padcell--ign' : ''}${inWin ? ' dl3s-padcell--win' : ''}`} />
              {zero && <text x={X0 + p * C + C / 2} y={ROW + C / 2 + 4} textAnchor="middle" className="dl3s-cellv">0</text>}
              {ign && <text x={X0 + p * C + C / 2} y={ROW + C / 2 + 5} textAnchor="middle" className="dl3s-padcell__x">×</text>}
            </g>
          );
        })}
        {left > 0 && <text x={X0} y={ROW + C + 16} className="dl3s-svg__label">zero padding ({left})</text>}
        {right > 0 && <text x={X0 + total * C} y={ROW + C + 16} textAnchor="end" className="dl3s-svg__label">zero padding ({right})</text>}
        {ignored > 0 && <text x={X0 + total * C} y={ROW + C + 16} textAnchor="end" className="dl3s-svg__label dl3s-svg__label--ink">ignored ({ignored})</text>}
        <text x={X0 + (total * C) / 2} y={ROW + C + 36} textAnchor="middle" className="dl3s-tick">
          padding="{padding}", kernel_size={k}, strides={s}
        </text>
      </svg>

      <div className="dl3s-stats">
        <Stat
          k="output length"
          v={out}
          tone="accent"
          sub={valid ? <>“valid”: ⌊(n − k) / s⌋ + 1 = ⌊({n} − {k}) / {s}⌋ + 1 = {out}</> : <>“same”: ⌈n / s⌉ = ⌈{n} / {s}⌉ = {out}</>}
        />
        <Stat k="zeros added" v={valid ? 0 : `${left} + ${right}`} sub={valid ? '"valid" never pads' : `(out − 1)·s + k − n = ${sp.total}, split left/right (extra on the right)`} />
        <Stat k="inputs ignored" v={ignored} sub={ignored ? 'no window reaches them' : 'every input is read'} />
      </div>
      <p className="dl3s-cap">
        On the slide’s 70×120 images with kernel_size={k}, strides={s}: “valid” → {outSize(70, k, s, 'valid')}×{outSize(120, k, s, 'valid')}, “same” → {outSize(70, k, s, 'same')}×{outSize(120, k, s, 'same')}.
        (The floor/ceiling rule is the counting behind Figures 14-7 and 14-8; the slides show the pictures, not the formula.)
      </p>
    </Lab>
  );
}

/* ── §8 · memory requirements ────────────────────────────────────────────── */
export function MemoryLab() {
  const [F, setF] = useState(200);
  const [k, setK] = useState(5);
  const [H, setH] = useState(150);
  const [W, setW] = useState(100);
  const [C, setC] = useState(3);
  const [s, setS] = useState(1);
  const [bytes, setBytes] = useState(4);
  const [B, setB] = useState(100);
  const [L, setL] = useState(3);
  const [D, setD] = useState(1);
  const [mode, setMode] = useState('train');

  const oh = Math.ceil(H / s);
  const ow = Math.ceil(W / s);
  const params = convParams(k, k, C, F);
  const dense = H * W * (H * W * C);
  const inputs = k * k * C;
  const mults = oh * ow * inputs * F;
  const perInst = oh * ow * F * bytes;

  // a stack of L identical conv layers ("same" padding, the chosen stride)
  const layers = [{ name: 'input', h: H, w: W, d: C }];
  for (let l = 1; l <= L; l++) {
    const p = layers[l - 1];
    layers.push({ name: `conv ${l}`, h: Math.ceil(p.h / s), w: Math.ceil(p.w / s), d: F });
  }
  const mem = layers.map((l) => l.h * l.w * l.d * bytes * B);
  let peak = 0;
  for (let l = 0; l + 1 < mem.length; l++) if (mem[l] + mem[l + 1] > mem[peak] + mem[peak + 1]) peak = l;
  const testRam = mem.length > 1 ? mem[peak] + mem[peak + 1] : mem[0];
  const trainRam = mem.reduce((a, b) => a + b, 0);
  const maxMem = Math.max(...mem);

  const fixes = [
    { id: 'i', label: '(i) halve the mini-batch', act: () => setB((b) => Math.max(1, Math.floor(b / 2))), disabled: B <= 1 },
    { id: 'ii', label: '(ii) stride 2', act: () => setS(2), disabled: s >= 2 },
    { id: 'iii', label: '(iii) drop a layer', act: () => setL((l) => Math.max(1, l - 1)), disabled: L <= 1 },
    { id: 'iv', label: '(iv) 16-bit floats', act: () => setBytes(2), disabled: bytes === 2 },
    { id: 'v', label: '(v) 2× the devices', act: () => setD((d) => Math.min(8, d * 2)), disabled: D >= 8 },
  ];
  const reset = () => { setF(200); setK(5); setH(150); setW(100); setC(3); setS(1); setBytes(4); setB(100); setL(3); setD(1); };

  return (
    <Lab
      title="Slides 22–24 as a calculator · parameters, multiplications, RAM"
      slides="slides 22–24"
      tryThis="compare testing with training for the slide example (12 MB per instance, 1.2 GB for a batch of 100), then apply the slide-24 fixes one by one and watch the training RAM fall."
    >
      <div className="dl-lab__controls">
        <div className="dl-sliders">
          <Range label="filters" value={F} min={8} max={512} step={8} onChange={setF} />
          <Range label="image height" value={H} min={28} max={300} onChange={setH} />
          <Range label="image width" value={W} min={28} max={300} onChange={setW} />
          <Range label="mini-batch size" value={B} min={1} max={256} onChange={setB} />
        </div>
        <Chips label="kernel" value={k} options={[{ v: 3, l: '3×3' }, { v: 5, l: '5×5' }, { v: 7, l: '7×7' }]} onChange={setK} />
        <Chips label="input" value={C} options={[{ v: 3, l: 'RGB · 3' }, { v: 1, l: 'gray · 1' }]} onChange={setC} />
        <Chips label="stride" value={s} options={[1, 2, 3]} onChange={setS} />
        <Chips label="float size" value={bytes} options={[{ v: 4, l: '32-bit · 4 B' }, { v: 2, l: '16-bit · 2 B' }]} onChange={setBytes} />
      </div>

      <div className="dl3s-stats">
        <Stat k="parameters" v={fmtInt(params)} tone="accent" sub={`(${k}×${k}×${C} + 1) × ${F} — no H or W in it`} />
        <Stat k="dense layer instead" v={fmtBig(dense)} sub={`(${H}×${W}) × (${H}×${W}×${C}) weights (footnote 5)`} />
        <Stat k="multiplications / instance" v={fmtBig(mults)} sub={`${fmtInt(oh * ow)} neurons × ${inputs} inputs × ${F} maps`} />
        <Stat k="feature-map RAM / instance" v={fmtBytes(perInst)} sub={`${oh}×${ow}×${F}×${bytes} B`} />
        <Stat k={`… for a mini-batch of ${B}`} v={fmtBytes(perInst * B)} tone="accent" sub={`${fmtBytes(perInst)} × ${B}`} />
      </div>

      <div className="dl3s-mem">
        <div className="dl3s-mem__head">
          <Chips label="mode" value={mode} options={[{ v: 'test', l: 'testing (predicting)' }, { v: 'train', l: 'training' }]} onChange={setMode} />
          <div className="dl-sliders">
            <Range label="conv layers" value={L} min={1} max={8} onChange={setL} />
            <Range label="devices" value={D} min={1} max={8} onChange={setD} />
          </div>
        </div>
        <div className="dl3s-mem__bars" role="img" aria-label={`Memory per layer for a mini-batch of ${B}; ${mode === 'test' ? 'testing keeps two consecutive layers' : 'training keeps every layer'}`}>
          {layers.map((l, n) => {
            const kept = mode === 'train' || n === peak || n === peak + 1;
            return (
              <div key={l.name} className={`dl3s-mem__bar${kept ? ' dl3s-mem__bar--kept' : ''}`}>
                <span className="dl3s-mem__fill" style={{ height: `${Math.max(3, (mem[n] / maxMem) * 100)}%` }} />
                <span className="dl3s-mem__name">{l.name}</span>
                <span className="dl3s-mem__val">{fmtBytes(mem[n])}</span>
                <span className="dl3s-mem__dims">{l.h}×{l.w}×{l.d}</span>
                <span className="dl3s-mem__tag">{kept ? 'in RAM' : 'freed'}</span>
              </div>
            );
          })}
        </div>
        <div className="dl3s-stats">
          <Stat k="testing needs" v={fmtBytes(testRam)} sub={`two consecutive layers at the peak (${layers[peak].name} + ${layers[Math.min(peak + 1, layers.length - 1)].name})`} />
          <Stat k="training needs at least" v={fmtBytes(trainRam)} tone="accent" sub="every layer, kept for the reverse pass" />
          <Stat k={`per device (${D})`} v={fmtBytes(trainRam / D)} sub="training RAM split evenly across devices" />
        </div>
        <div className="dl3s-fixes" role="group" aria-label="Out-of-memory fixes from slide 24">
          <span className="dl-ctl__label">slide-24 fixes</span>
          {fixes.map((f) => (
            <button key={f.id} type="button" className="dl-btn" onClick={f.act} disabled={f.disabled}>{f.label}</button>
          ))}
          <button type="button" className="dl-btn" onClick={reset}>reset to the slide example</button>
        </div>
      </div>
      <p className="dl3s-cap">
        Decimal units, as on slide 23: <Tex src="150 \times 100 \times 200 \times 4 = 12{,}000{,}000\text{ B} = 12\text{ MB}" />. The bars count the feature maps only, as the
        slide does; testing keeps the two consecutive layers that need the most RAM.
      </p>
    </Lab>
  );
}
