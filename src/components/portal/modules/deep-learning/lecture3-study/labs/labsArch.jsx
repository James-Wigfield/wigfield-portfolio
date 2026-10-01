import { useMemo, useState } from 'react';
import { Code, Tex } from '../../kit';
import { Lab, Chips, Range, Stat } from '../ui';
import { useStudy } from '../context';
import { fashionModel, outSize, convParams, fmtInt } from '../cnn';
import { FASHION_CODE, LENET, ALEXNET, INCEPTION, GOOGLENET_FLOW, ARCHS, OTHER_ARCHS } from '../slideData';
import { mulberry32 } from '../../mathfns';

/* ============================================================================
   LECTURE 3 STUDY — LABS FOR §11 AND §12
     ShapeFlowLab      slide 35's model, block by block: output shape, params
     KernelStackLab    slide 34's claim, counted: two 3×3 layers vs one 5×5
     ClassicTablesLab  the LeNet-5 and AlexNet tables, every size re-derived
     AugmentLab        slide 40: shift / rotate / resize / flip / relight
     InceptionLab      Figure 14-14 with clickable branches + Figure 14-15's
                       numbers + a 1×1-bottleneck parameter calculator
     ResidualLab       Figure 14-16 with a skip toggle: f(x) = h(x) − x
     TimelineLab       slides 36–47 side by side: who, when, top-5 error
   ========================================================================== */

/* ── §11 · the slide-35 model ────────────────────────────────────────────── */
const SHORT = {
  input: () => 'In',
  conv: (l) => `C${l.out[2]}`,
  pool: () => 'Pool',
  flat: () => 'Flat',
  dense: (l) => `D${l.out[0]}`,
  drop: () => 'Drop',
};
export function ShapeFlowLab() {
  const model = useMemo(() => fashionModel(), []);
  const [sel, setSel] = useState(1);
  const L = model.layers[sel];
  const n = model.layers.length;
  const colW = 46;
  const base = 168;
  const shapeTxt = (o) => o.join('×');

  const onKey = (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); setSel((v) => Math.min(n - 1, v + 1)); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); setSel((v) => Math.max(0, v - 1)); }
  };

  return (
    <Lab
      title="Slide 35’s Fashion-MNIST CNN, layer by layer"
      slides="slides 33–35"
      tryThis="click through the layers from left to right (or focus the strip and use ← →): the maps shrink 28 → 14 → 7 → 3 while the depth grows 64 → 128 → 256, then Flatten hands 2,304 numbers to the dense layers."
    >
      <svg
        viewBox={`0 0 ${n * colW + 20} 226`}
        className="dl3s-svg dl3s-flowsvg"
        tabIndex={0}
        role="application"
        aria-label={`${L.label}: output ${shapeTxt(L.out)}, ${fmtInt(L.params)} parameters. Arrow keys move between layers.`}
        onKeyDown={onKey}
      >
        {model.layers.map((l, k) => {
          const x = 14 + k * colW;
          const on = k === sel;
          let h;
          let w;
          if (l.out.length === 3) {
            h = Math.max(8, l.out[0] * 4.4);
            w = Math.max(5, 4 + l.out[2] / 18);
          } else {
            h = 16 + Math.log10(l.out[0]) * 34;
            w = 7;
          }
          const y = base - h;
          return (
            <g key={l.id} className={`dl3s-flowblk dl3s-flowblk--${l.kind}${on ? ' dl3s-flowblk--on' : ''}`} onClick={() => setSel(k)}>
              {l.out.length === 3 && l.out[2] > 1 && <rect x={x + 4} y={y - 4} width={w} height={h} className="dl3s-flowblk__back" />}
              <rect x={x} y={y} width={w} height={h} className="dl3s-flowblk__front" />
              <text x={x + w / 2} y={base + 14} textAnchor="middle" className="dl3s-tick">{SHORT[l.kind](l)}</text>
              <text x={x + w / 2} y={base + 27} textAnchor="middle" className="dl3s-flowblk__dims">{l.out.length === 3 ? `${l.out[0]}²×${l.out[2]}` : l.out[0]}</text>
              <rect x={x - 6} y={10} width={colW - 4} height={base + 26} fill="transparent" />
            </g>
          );
        })}
        <text x={14} y={220} className="dl3s-svg__label">block height = map size · width = depth · dense layers drawn as bars</text>
      </svg>

      <div className="dl3s-flowdetail">
        <div className="dl3s-stats dl3s-stats--col">
          <Stat k="layer" v={L.name} sub={L.kind === 'conv' ? 'DefaultConv2D: 3×3 by default, "same" padding, ReLU, He init' : L.kind === 'pool' ? 'MaxPool2D() with Keras’s defaults' : ''} />
          <Stat k="output shape (per image)" v={shapeTxt(L.out)} tone="accent" />
          <Stat k="parameters" v={fmtInt(L.params)} sub={L.calc} />
          <Stat k="whole model" v={fmtInt(model.total)} sub="sum of every layer’s parameters" />
        </div>
        <Code code={FASHION_CODE} label="fashion_mnist_cnn.py" meta="slide 35" hl={L.lines} />
      </div>
    </Lab>
  );
}

/* ── §11 · two 3×3 layers vs one 5×5 ─────────────────────────────────────── */
export function KernelStackLab() {
  const [c, setC] = useState(64);
  const one5 = convParams(5, 5, c, c);
  const two3 = 2 * convParams(3, 3, c, c);
  const saving = 1 - two3 / one5;
  const X = (i) => 30 + i * 34;
  return (
    <Lab
      title="Slide 34’s advice, counted · two 3×3 layers vs one 5×5"
      slides="slide 34"
      tryThis="drag the channel count: the two stacked 3×3 layers always need about 28% fewer parameters than one 5×5 layer, yet both reach a 5-pixel-wide patch of the input."
    >
      <Range label="channels in = channels out" value={c} min={8} max={512} step={8} onChange={setC} />
      <div className="dl3s-kstack">
        <svg viewBox="0 0 220 120" className="dl3s-svg" role="img" aria-label="One 5 by 5 layer: a single neuron connected to 5 inputs">
          <text x={10} y={14} className="dl3s-svg__label dl3s-svg__label--ink">one 5×5 layer</text>
          {[0, 1, 2, 3, 4].map((i) => <line key={i} x1={X(2)} y1={44} x2={X(i)} y2={92} className="dl3s-depth__edge dl3s-depth__edge--on" />)}
          <circle cx={X(2)} cy={40} r={7} className="dl3s-depth__node dl3s-depth__node--sel" />
          {[0, 1, 2, 3, 4].map((i) => <rect key={i} x={X(i) - 8} y={92} width={16} height={16} className="dl3s-depth__node dl3s-depth__node--cone" />)}
        </svg>
        <svg viewBox="0 0 220 120" className="dl3s-svg" role="img" aria-label="Two 3 by 3 layers: the top neuron sees 3 middle neurons, which together see 5 inputs">
          <text x={10} y={14} className="dl3s-svg__label dl3s-svg__label--ink">two stacked 3×3 layers</text>
          {[1, 2, 3].map((i) => <line key={`t${i}`} x1={X(2)} y1={34} x2={X(i)} y2={62} className="dl3s-depth__edge dl3s-depth__edge--on" />)}
          {[1, 2, 3].map((m) => [-1, 0, 1].map((d) => <line key={`b${m}${d}`} x1={X(m)} y1={70} x2={X(m + d)} y2={92} className="dl3s-depth__edge dl3s-depth__edge--on" />))}
          <circle cx={X(2)} cy={30} r={7} className="dl3s-depth__node dl3s-depth__node--sel" />
          {[1, 2, 3].map((i) => <circle key={i} cx={X(i)} cy={66} r={6} className="dl3s-depth__node dl3s-depth__node--cone" />)}
          {[0, 1, 2, 3, 4].map((i) => <rect key={i} x={X(i) - 8} y={92} width={16} height={16} className="dl3s-depth__node dl3s-depth__node--cone" />)}
        </svg>
      </div>
      <div className="dl3s-stats">
        <Stat k="one 5×5 layer" v={fmtInt(one5)} sub={`(5×5×${c} + 1) × ${c}`} />
        <Stat k="two 3×3 layers" v={fmtInt(two3)} tone="accent" sub={`2 × (3×3×${c} + 1) × ${c}`} />
        <Stat k="saving" v={`${Math.round(saving * 100)}%`} sub="fewer parameters — and fewer multiplications per output (18c² vs 25c²)" />
      </div>
    </Lab>
  );
}

/* ── §12.1 · the LeNet-5 and AlexNet tables ──────────────────────────────── */
function checkRow(rows, k) {
  const r = rows[k];
  const prev = rows[k + 1];
  if (!r.k || !prev?.n) return null;
  const got = outSize(prev.n, r.k, r.s, r.pad);
  const how = r.pad === 'same' ? `⌈${prev.n} / ${r.s}⌉ = ${got}` : r.s === 1 ? `${prev.n} − ${r.k} + 1 = ${got}` : `⌊(${prev.n} − ${r.k}) / ${r.s}⌋ + 1 = ${got}`;
  return { got, how, ok: got === r.n };
}

export function ClassicTablesLab() {
  const [net, setNet] = useState('lenet');
  const [modern, setModern] = useState(false);
  const [sel, setSel] = useState(6);
  const rows = net === 'lenet' ? LENET : ALEXNET;
  const k = Math.min(sel, rows.length - 1);
  const chk = checkRow(rows, k);
  const isAlex = net === 'alexnet';
  const act = (a) => (modern && !isAlex ? (a === 'tanh' ? 'ReLU' : a === 'RBF' ? 'softmax' : a) : a);

  return (
    <Lab
      title="The LeNet-5 and AlexNet tables, re-derived"
      slides="slides 37–39"
      tryThis="click the LeNet-5 rows from In upwards — every size follows the §7 counting rule (C1: 32 − 5 + 1 = 28) — then switch to AlexNet and spot what its table skips between C6 and S8."
    >
      <div className="dl-lab__controls">
        <Chips label="Architecture" value={net} options={[{ v: 'lenet', l: 'LeNet-5 (1998)' }, { v: 'alexnet', l: 'AlexNet (2012)' }]} onChange={(v) => { setNet(v); setSel(v === 'lenet' ? 6 : 9); }} />
        {!isAlex && (
          <label className="dl-check">
            <input type="checkbox" checked={modern} onChange={(e) => setModern(e.target.checked)} /> today’s activations (slide 37: ReLU instead of tanh, softmax instead of RBF)
          </label>
        )}
      </div>
      <div className="dl-tablewrap">
        <table className="dl-table dl3s-archtable">
          <thead>
            <tr>
              <th scope="col">Layer</th><th scope="col">Type</th><th scope="col">Maps</th><th scope="col">Size</th><th scope="col">Kernel size</th><th scope="col">Stride</th>
              {isAlex && <th scope="col">Padding</th>}
              <th scope="col">Activation</th><th scope="col">Size check</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, n) => {
              const c = checkRow(rows, n);
              const changed = modern && !isAlex && act(r.act) !== r.act;
              return (
                <tr key={r.layer} className={n === k ? 'dl-table__row--on' : undefined} onClick={() => setSel(n)}>
                  <td>
                    <button type="button" className="dl3s-rowbtn" onClick={() => setSel(n)} aria-pressed={n === k}>{r.layer}</button>
                  </td>
                  <td>{r.type}</td><td>{r.maps}</td><td>{r.size}</td><td>{r.kernel}</td><td>{r.stride}</td>
                  {isAlex && <td>{r.pad}</td>}
                  <td className={changed ? 'dl3s-modern' : undefined}>{act(r.act)}{changed && <span className="dl3s-modern__tag">today</span>}</td>
                  <td className="dl3s-archtable__chk">{c ? (c.ok ? `${c.got} · matches` : `${c.got} ≠ ${r.n}`) : ''}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="dl3s-readout">
        <b>{rows[k].layer}</b> · {rows[k].type}
        {chk ? <> — from the {rows[k + 1].size} layer below: {chk.how} ({chk.ok ? 'matches the slide' : 'does not match'}).</> : rows[k].layer === 'In' ? ' — the input.' : ' — fully connected: no spatial size to check.'}
      </p>
      {isAlex && (
        <p className="dl3s-cap">
          Depth check: pooling never changes the number of maps (slide 29) — S2 keeps C1’s 96 and S4 keeps C3’s 256 — but S8 has 256 maps while the row below it, C6, has 384.
          The slide’s table has no C7 row, so the layer that produces S8’s 256 maps isn’t listed.
        </p>
      )}
    </Lab>
  );
}

/* ── §12.1 · data augmentation ───────────────────────────────────────────── */
function Specimen({ t }) {
  const tf = `translate(${50 + t.dx} ${50 + t.dy}) rotate(${t.rot}) scale(${(t.flip ? -1 : 1) * t.scale} ${t.scale}) translate(-50 -50)`;
  return (
    <svg viewBox="0 0 100 100" className="dl3s-aug__img" style={{ filter: `brightness(${t.light})` }} role="img" aria-label="A training image of a mushroom">
      <rect x={0} y={0} width={100} height={100} className="dl3s-aug__bg" />
      <g transform={tf}>
        <path d="M22 54 Q50 6 78 54 Z" className="dl3s-aug__cap" />
        <circle cx={38} cy={40} r={4} className="dl3s-aug__spot" />
        <circle cx={56} cy={30} r={3} className="dl3s-aug__spot" />
        <rect x={43} y={54} width={14} height={30} rx={3} className="dl3s-aug__stem" />
        <rect x={28} y={84} width={44} height={4} rx={2} className="dl3s-aug__grass" />
      </g>
    </svg>
  );
}

const IDENT = { dx: 0, dy: 0, rot: 0, scale: 1, flip: false, light: 1 };
const describe = (t) => {
  const p = [];
  if (t.dx || t.dy) p.push(`shift ${t.dx > 0 ? '+' : ''}${t.dx}, ${t.dy > 0 ? '+' : ''}${t.dy}`);
  if (t.rot) p.push(`rotate ${t.rot}°`);
  if (t.scale !== 1) p.push(`resize ×${t.scale.toFixed(2)}`);
  if (t.flip) p.push('flip');
  if (t.light !== 1) p.push(`light ×${t.light.toFixed(2)}`);
  return p.length ? p.join(' · ') : 'original';
};

export function AugmentLab() {
  const [t, setT] = useState(IDENT);
  const [seed, setSeed] = useState(1);
  const variants = useMemo(() => {
    const rng = mulberry32(seed * 97);
    const r = (a, b) => a + rng() * (b - a);
    return Array.from({ length: 6 }, () => ({
      dx: Math.round(r(-14, 14)),
      dy: Math.round(r(-10, 10)),
      rot: Math.round(r(-18, 18)),
      scale: Math.round(r(0.85, 1.15) * 100) / 100,
      flip: rng() < 0.5,
      light: Math.round(r(0.7, 1.3) * 100) / 100,
    }));
  }, [seed]);
  const set = (key) => (v) => setT((p) => ({ ...p, [key]: v }));

  return (
    <Lab
      title="Slide 40 · data augmentation"
      slides="slides 39–40"
      tryThis="shift, rotate, resize, flip and relight the picture, then press “generate variants” — each is a realistic variant of the same training instance, and adding them to the training set helps reduce overfitting (slide 40)."
    >
      <div className="dl3s-aug">
        <figure className="dl3s-aug__main">
          <Specimen t={t} />
          <figcaption>{describe(t)}</figcaption>
        </figure>
        <div className="dl3s-aug__ctl">
          <div className="dl-sliders">
            <Range label="shift x" value={t.dx} min={-20} max={20} onChange={set('dx')} />
            <Range label="shift y" value={t.dy} min={-20} max={20} onChange={set('dy')} />
            <Range label="rotate" value={t.rot} min={-30} max={30} onChange={set('rot')} fmt={(v) => `${v}°`} />
            <Range label="resize" value={t.scale} min={0.7} max={1.3} step={0.05} onChange={set('scale')} fmt={(v) => `×${v.toFixed(2)}`} />
            <Range label="lighting" value={t.light} min={0.6} max={1.4} step={0.05} onChange={set('light')} fmt={(v) => `×${v.toFixed(2)}`} />
          </div>
          <div className="dl3s-btnrow">
            <button type="button" className="dl-btn" onClick={() => set('flip')(!t.flip)} aria-pressed={t.flip}>flip horizontally</button>
            <button type="button" className="dl-btn" onClick={() => setT(IDENT)}>reset</button>
            <button type="button" className="dl-btn" onClick={() => setSeed((v) => v + 1)}>generate variants</button>
          </div>
        </div>
      </div>
      <div className="dl3s-aug__grid">
        {variants.map((v, n) => (
          <figure key={`${seed}-${n}`} className="dl3s-aug__cell">
            <Specimen t={v} />
            <figcaption>{describe(v)}</figcaption>
          </figure>
        ))}
      </div>
      <p className="dl3s-cap">AlexNet’s version (slide 39): random shifts by various offsets, horizontal flips and lighting changes. Slide 40 adds rotating and resizing.</p>
    </Lab>
  );
}

/* ── §12.2 · the inception module ────────────────────────────────────────── */
const BRANCHES = [
  { id: 0, top: 'Convolution 1×1 + 1(S)', bottom: null, k: 1 },
  { id: 1, top: 'Convolution 3×3 + 1(S)', bottom: 'Convolution 1×1 + 1(S)', k: 3 },
  { id: 2, top: 'Convolution 5×5 + 1(S)', bottom: 'Convolution 1×1 + 1(S)', k: 5 },
  { id: 3, top: 'Convolution 1×1 + 1(S)', bottom: 'Max pool 3×3 + 1(S)', k: 1 },
];

function branchParams(m, b, withReduce) {
  const cin = m.cin;
  const out = m.top[b];
  if (b === 0) return { total: convParams(1, 1, cin, out), parts: [`(1×1×${cin} + 1) × ${out}`] };
  if (b === 3) return { total: convParams(1, 1, cin, out), parts: [`max pool: 0`, `(1×1×${cin} + 1) × ${out}`] };
  const k = BRANCHES[b].k;
  const r = m.bottom[b - 1];
  if (!withReduce) return { total: convParams(k, k, cin, out), parts: [`(${k}×${k}×${cin} + 1) × ${out}`] };
  return { total: convParams(1, 1, cin, r) + convParams(k, k, r, out), parts: [`(1×1×${cin} + 1) × ${r}`, `(${k}×${k}×${r} + 1) × ${out}`] };
}

export function InceptionLab() {
  const [mi, setMi] = useState(0);
  const [b, setB] = useState(2);
  const [reduce, setReduce] = useState(true);
  const m = INCEPTION[mi];
  const depth = m.top.reduce((a, v) => a + v, 0);
  const p = branchParams(m, b, reduce);
  const pWith = branchParams(m, b, true).total;
  const pWithout = branchParams(m, b, false).total;
  const moduleWith = [0, 1, 2, 3].reduce((a, k) => a + branchParams(m, k, true).total, 0);
  const moduleWithout = [0, 1, 2, 3].reduce((a, k) => a + branchParams(m, k, false).total, 0);
  const branchMaps = (k) => {
    if (k === 0) return { top: m.top[0], bottom: null };
    if (k === 3) return { top: m.top[3], bottom: m.cin };
    return { top: m.top[k], bottom: m.bottom[k - 1] };
  };

  return (
    <Lab
      title="Figure 14-14 · the inception module, with Figure 14-15’s numbers"
      slides="slides 41–43"
      tryThis="click the 5×5 branch, then untick “use the 1×1 layers” — its parameters jump from about 12 thousand to about 154 thousand, because the 1×1 layer hands the 5×5 only 12 maps instead of 192."
    >
      <div className="dl3s-incep">
        <div className="dl3s-incep__main">
          <div className="dl3s-incep__concat">
            Depth concat (axis=3) → <b>{m.hw}×{m.hw}×{depth}</b>
            <span className="dl3s-incep__sum">{m.top.join(' + ')} = {depth} maps</span>
          </div>
          <div className="dl3s-incep__branches">
            {BRANCHES.map((br) => {
              const mp = branchMaps(br.id);
              const on = br.id === b;
              const bypass = !reduce && (br.id === 1 || br.id === 2);
              return (
                <button key={br.id} type="button" className={`dl3s-incep__branch${on ? ' dl3s-incep__branch--on' : ''}`} onClick={() => setB(br.id)} aria-pressed={on}>
                  <span className="dl3s-incep__box">{br.top}<small>{mp.top} maps</small></span>
                  {br.bottom ? (
                    <span className={`dl3s-incep__box${br.id === 3 ? ' dl3s-incep__box--pool' : ''}${bypass ? ' dl3s-incep__box--off' : ''}`}>
                      {br.bottom}
                      <small>{br.id === 3 ? `${m.cin} maps (no weights)` : bypass ? 'removed' : `${mp.bottom} maps`}</small>
                    </span>
                  ) : (
                    <span className="dl3s-incep__box dl3s-incep__box--empty">straight to the 1×1</span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="dl3s-incep__input">Input {m.hw}×{m.hw}×{m.cin} — copied to all four branches</div>
        </div>

        <aside className="dl3s-incep__side">
          <p className="dl3s-stagehead">Figure 14-15 · pick a module</p>
          <ol className="dl3s-gflow">
            {GOOGLENET_FLOW.map((g, n) =>
              g.module ? (
                <li key={n}>
                  <button type="button" className={`dl3s-gflow__mod${g.module - 1 === mi ? ' dl3s-gflow__mod--on' : ''}`} onClick={() => setMi(g.module - 1)} aria-pressed={g.module - 1 === mi}>
                    inception {g.module} · {INCEPTION[g.module - 1].top.join(' ')} / {INCEPTION[g.module - 1].bottom.join(' ')}
                  </button>
                </li>
              ) : (
                <li key={n} className="dl3s-gflow__step">{g.label} <span>→ {g.out}</span></li>
              ),
            )}
          </ol>
        </aside>
      </div>

      <label className="dl-check">
        <input type="checkbox" checked={reduce} onChange={(e) => setReduce(e.target.checked)} /> use the 1×1 layers in front of the 3×3 and 5×5 convolutions
      </label>
      <div className="dl3s-stats">
        <Stat k={`branch ${b + 1} parameters`} v={fmtInt(p.total)} tone="accent" sub={p.parts.join(' + ')} />
        <Stat k="this branch: with vs without the 1×1" v={`${fmtInt(pWith)} vs ${fmtInt(pWithout)}`} sub={b === 1 || b === 2 ? `${(pWithout / pWith).toFixed(1)}× more without it` : 'no 1×1 reduction in this branch'} />
        <Stat k={`inception module ${mi + 1} in total`} v={fmtInt(reduce ? moduleWith : moduleWithout)} sub={`${fmtInt(moduleWith)} with the 1×1 layers, ${fmtInt(moduleWithout)} without`} />
      </div>
      <p className="dl3s-cap">
        Reading Figure 14-15: each module’s top row lists the maps of its four top convolutions (they add up to what comes next — 480 and 832 at the max pools, 1024
        at the global average pool); the bottom row lists the two 1×1 convolutions that feed the 3×3 and the 5×5. Parameters use slide 22’s{' '}
        <Tex src="(f_h \times f_w \times f_c + 1) \times f_n" />.
      </p>
    </Lab>
  );
}

/* ── §12.3 · residual learning ───────────────────────────────────────────── */
const NPT = 121;
const TS = Array.from({ length: NPT }, (_, k) => k / (NPT - 1));
const XSIG = TS.map((t) => 0.55 * Math.sin(2 * Math.PI * t) + 0.25 * Math.sin(6 * Math.PI * t));
const TARGETS = {
  bump: { label: 'x plus a small bump', h: (x, t) => x + 0.45 * Math.exp(-(((t - 0.62) / 0.07) ** 2)) },
  ident: { label: 'x itself (identity)', h: (x) => x },
  scale: { label: '1.2 × x', h: (x) => 1.2 * x },
};
const rms = (a) => Math.sqrt(a.reduce((s, v) => s + v * v, 0) / a.length);

export function ResidualLab() {
  const [skip, setSkip] = useState(true);
  const [tg, setTg] = useState('bump');
  const h = TS.map((t, k) => TARGETS[tg].h(XSIG[k], t));
  const f = skip ? h.map((v, k) => v - XSIG[k]) : h;
  const PW = 560;
  const PH = 180;
  const sx = (t) => 30 + t * (PW - 230);
  const sy = (v) => PH / 2 - v * 62;
  const path = (arr) => arr.map((v, k) => `${k ? 'L' : 'M'}${sx(TS[k]).toFixed(1)} ${sy(v).toFixed(1)}`).join('');
  const end = (arr) => sy(arr[NPT - 1]);
  const labels = [
    { y: end(XSIG), t: 'input x', c: 'var(--dlv-blue)' },
    { y: end(f), t: skip ? 'layers learn f(x) = h(x) − x' : 'layers learn h(x)', c: 'var(--dlv-orange)' },
    { y: end(h), t: 'block output h(x)', c: 'var(--dlv-aqua)' },
  ].sort((a, b) => a.y - b.y);
  for (let k = 1; k < labels.length; k++) if (labels[k].y - labels[k - 1].y < 13) labels[k].y = labels[k - 1].y + 13;

  return (
    <Lab
      title="Figure 14-16 · residual learning, with a skip toggle"
      slides="slides 45–46"
      tryThis="keep the target “x plus a small bump” and toggle the skip connection: without it the two layers must reproduce all of h(x); with it they only learn the bump, f(x) = h(x) − x, and adding x back gives h(x)."
    >
      <div className="dl-lab__controls">
        <Chips label="Skip connection" value={skip} options={[{ v: true, l: 'on (ResNet)' }, { v: false, l: 'off (plain)' }]} onChange={setSkip} />
        <Chips label="Target h(x)" value={tg} options={Object.entries(TARGETS).map(([v, o]) => ({ v, l: o.label }))} onChange={setTg} />
      </div>
      <div className="dl3s-res">
        <div className="dl3s-res__block" aria-hidden="true">
          <span className={`dl3s-res__node${skip ? ' dl3s-res__node--on' : ''}`}>{skip ? '+' : ''}</span>
          <span className="dl3s-res__layer">Layer 2</span>
          <span className="dl3s-res__layer">Layer 1</span>
          <span className="dl3s-res__layer dl3s-res__layer--in">Input x</span>
          {skip && <span className="dl3s-res__skip" />}
        </div>
        <svg viewBox={`0 0 ${PW} ${PH}`} className="dl3s-svg dl3s-res__plot" role="img" aria-label={`Input x, what the layers must learn, and the block output, over one sample signal; skip ${skip ? 'on' : 'off'}`}>
          <line x1={30} y1={sy(0)} x2={PW - 200} y2={sy(0)} className="dl3s-axis" />
          <text x={4} y={sy(0) + 4} className="dl3s-tick">0</text>
          <path d={path(XSIG)} className="dl3s-curve" style={{ stroke: 'var(--dlv-blue)' }} />
          <path d={path(h)} className="dl3s-curve" style={{ stroke: 'var(--dlv-aqua)', strokeDasharray: '6 4' }} />
          <path d={path(f)} className="dl3s-curve" style={{ stroke: 'var(--dlv-orange)', strokeWidth: 2.6 }} />
          {labels.map((l) => (
            <text key={l.t} x={PW - 192} y={l.y + 4} className="dl3s-svg__label" style={{ fill: l.c }}>{l.t}</text>
          ))}
        </svg>
      </div>
      <div className="dl3s-stats">
        <Stat k="what the layers must produce" v={skip ? 'f(x) = h(x) − x' : 'h(x)'} tone="accent" sub={skip ? 'the residual (slide 46)' : 'the whole target'} />
        <Stat k="its size (RMS) on this signal" v={rms(f).toFixed(2)} sub={`vs ${rms(skip ? h : h.map((v, k) => v - XSIG[k])).toFixed(2)} ${skip ? 'without' : 'with'} the skip`} />
      </div>
    </Lab>
  );
}

/* ── §12.3 · the architectures side by side ──────────────────────────────── */
export function TimelineLab() {
  const { jumpTo } = useStudy();
  const [a, setA] = useState('alexnet');
  const [b, setB] = useState('resnet');
  const A = ARCHS.find((x) => x.id === a);
  const Bx = ARCHS.find((x) => x.id === b);
  const withErr = ARCHS.filter((x) => x.err !== null);
  const PW = 520;
  const PH = 190;
  const xs = (k) => 70 + k * 92;
  const ys = (e) => PH - 30 - e * 5.2;

  return (
    <Lab
      title="Slides 36–47 side by side · the ILSVRC story"
      slides="slides 36–47"
      tryThis="pick two architectures to compare them side by side; the chart shows the top-5 error falling from 26% (the 2012 runner-up) to 2.25% (SENet, 2017)."
    >
      <svg viewBox={`0 0 ${PW} ${PH}`} className="dl3s-svg dl3s-time" role="img" aria-label="Top-5 error of the ILSVRC winners on the slides: 26 percent runner-up 2012, AlexNet 17, GoogLeNet below 7, ResNet below 3.6, SENet 2.25">
        {[0, 5, 10, 15, 20, 25].map((e) => (
          <g key={e}>
            <line x1={40} y1={ys(e)} x2={PW - 10} y2={ys(e)} className="dl3s-gridline" />
            <text x={34} y={ys(e) + 4} textAnchor="end" className="dl3s-tick">{e}%</text>
          </g>
        ))}
        <g>
          <rect x={xs(0) - 16} y={ys(26)} width={32} height={ys(0) - ys(26)} className="dl3s-timebar dl3s-timebar--ghost" />
          <text x={xs(0)} y={ys(26) - 6} textAnchor="middle" className="dl3s-svg__label">26%</text>
          <text x={xs(0)} y={PH - 14} textAnchor="middle" className="dl3s-tick">2012 runner-up</text>
        </g>
        {withErr.map((x, k) => {
          const on = x.id === a || x.id === b;
          return (
            <g key={x.id} className="dl3s-ocell-g" onClick={() => (x.id === a ? null : setB(x.id))}>
              <rect x={xs(k + 1) - 16} y={ys(x.err)} width={32} height={ys(0) - ys(x.err)} className={`dl3s-timebar${on ? ' dl3s-timebar--on' : ''}`} />
              <text x={xs(k + 1)} y={ys(x.err) - 6} textAnchor="middle" className="dl3s-svg__label dl3s-svg__label--ink">{x.bound === '<' ? '< ' : ''}{x.err}%</text>
              <text x={xs(k + 1)} y={PH - 14} textAnchor="middle" className="dl3s-tick">{x.name} {x.year}</text>
            </g>
          );
        })}
      </svg>
      <p className="dl3s-cap">Only the numbers the slides give: “&lt;” marks an upper bound (“below 7%”, “under 3.6%”). LeNet-5, VGGNet and Xception have no top-5 figure on the slides.</p>

      <div className="dl-lab__controls">
        <Chips label="Compare" value={a} options={ARCHS.map((x) => ({ v: x.id, l: x.name }))} onChange={(v) => { setA(v); if (v === b) setB(a); }} />
        <Chips label="with" value={b} options={ARCHS.map((x) => ({ v: x.id, l: x.name }))} onChange={(v) => { setB(v); if (v === a) setA(b); }} />
      </div>
      <div className="dl3s-compare">
        {[A, Bx].map((x) => (
          <article key={x.id} className="dl3s-compare__card">
            <header>
              <b>{x.name}</b> <span>{x.year}</span>
            </header>
            <dl>
              <dt>by</dt><dd>{x.who}</dd>
              <dt>result</dt><dd>{x.result}</dd>
              <dt>key idea</dt><dd>{x.idea}</dd>
            </dl>
            <button type="button" className="dl3s-link" onClick={() => jumpTo(x.sec)}>read it in §{x.sec === 's12a' ? '12.1' : x.sec === 's12b' ? '12.2' : '12.3'}</button>
          </article>
        ))}
      </div>
      <p className="dl3s-cap">Also noteworthy (slide 47): {OTHER_ARCHS.join(', ')}.</p>
    </Lab>
  );
}
