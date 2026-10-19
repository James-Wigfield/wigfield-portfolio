import Scene from '../../scene/Scene';
import { lin, pathOf, range, thou } from '../../scene/geom';
import { SERIES } from '../../data/series';

/* ============================================================================
   SCENE — the VAE's conv path, 84 months down to 4 numbers and back
   Real shapes and parameter counts from Out [21]. Left column = encoder (top
   to bottom), right column = decoder (bottom to top), joined at the codings.
   Each tensor is drawn time across (3 px per step) and channels down (2 px
   per channel), so stride 2 visibly halves the length while the filters add
   depth: (84, 1) → (42, 16) → (21, 32) → 672 → μ(4), γ(4) → z(4) → mirror.
   A zoom (beat 1 only) shows a kernel of 5 stepping 2 months at a time over
   the first months of the real sequence, with padding="same"'s extra zero
   (TensorFlow pads 1 on the left, 2 on the right, so output step j reads
   months 2j−2 … 2j+2). The input is a real training sequence (train_seq[0],
   max channel, shaded by value); activations inside the blocks are not data,
   so the blocks are drawn empty.
   ========================================================================== */

const W = 800;
const H = 540;
const EX = 186; // encoder column centre
const DX = 614; // decoder column centre
const ST = 3; // px per time step
const CH = 2; // px per channel
const SEQ = SERIES.trainSeqs['0'].map((r) => r[1]);
const VMIN = Math.min(...SEQ);
const VMAX = Math.max(...SEQ);
const shade = (v) => 0.1 + 0.8 * ((v - VMIN) / (VMAX - VMIN));

const S0 = EX - 42 * ST; // encoder strip left (60)
const S1 = DX - 42 * ST; // decoder strip left (488)
const SW = 84 * ST;
const yT = lin(35, 14, 36, 92);
const curve = (x0) => pathOf(SEQ.map((v, i) => [x0 + (i + 0.5) * ST, yT(v)]));

// rows
const STRIP_Y = 104;
const A1 = [118, 162];
const B42 = { y: 168, w: 42 * ST, h: 16 * CH };
const A2 = [206, 250];
const B21 = { y: 256, w: 21 * ST, h: 32 * CH };
const A3 = [326, 346];
const FLAT = { y: 352, w: 168, h: 6 };
const HEAD_Y = 396;
const MU_X = 92;
const GA_X = 232;
const BUS = 476;
const Z_X = 376;

// zoom inset (beat 1)
const ZX = 446;
const ZC = 24; // zoom cell width
const ZY = 206;
const winX = (j) => ZX - 2 + 2 * ZC * (j - 1);
const colX = (j) => ZX + 2 * j * ZC + ZC / 2; // centre of month 2j
const OUT_Y = 272;

// which beat each group appears in
const FROM = {
  'cp-e1': 1, 'cp-e2': 1,
  'cp-e3': 2, 'cp-e4': 2, 'cp-e5': 2, 'cp-e6': 2, 'cp-e7': 2, 'cp-e8': 2,
  'cp-d0': 3, 'cp-d1': 3, 'cp-d2': 3, 'cp-d3': 3, 'cp-d4': 3, 'cp-d5': 3, 'cp-d6': 3, 'cp-d7': 3, 'cp-d8': 3, 'cp-d9': 3,
  'cp-par': 4, 'cp-tot': 4,
};
const ENC = ['cp-e1', 'cp-e2'];
const ENC2 = ['cp-e3', 'cp-e4', 'cp-e5', 'cp-e6', 'cp-e7', 'cp-e8'];
const DEC = ['cp-d0', 'cp-d1', 'cp-d2', 'cp-d3', 'cp-d4', 'cp-d5', 'cp-d6', 'cp-d7', 'cp-d8', 'cp-d9'];

function VArrow({ x, y0, y1, cls, op }) {
  const d = y1 > y0 ? 1 : -1;
  return (
    <g className={cls} opacity={op}>
      <line className="sv-ink2" x1={x} x2={x} y1={y0} y2={y1} strokeWidth="1.2" />
      <path className="sv-ink2" d={`M${x - 4} ${y1 - d * 6}L${x} ${y1}L${x + 4} ${y1 - d * 6}`} strokeWidth="1.2" />
    </g>
  );
}

function LayerLab({ x, y, anchor, name, sub, cls, op }) {
  return (
    <g className={cls} opacity={op}>
      <text className="sv-lab-strong" x={x} y={y} textAnchor={anchor}>{name}</text>
      {sub && <text className="sv-lab" x={x} y={y + 13} textAnchor={anchor}>{sub}</text>}
    </g>
  );
}

function Par({ x, y, n, anchor = 'start', op }) {
  return (
    <text className="sv-lab-strong cp-par" x={x} y={y} textAnchor={anchor} style={{ fill: 'var(--ink-2)' }} opacity={op}>
      {thou(n)} params
    </text>
  );
}

function Block({ cx, b, cls, rib, label, side, op }) {
  const x = cx - b.w / 2;
  return (
    <g className={cls} opacity={op}>
      <rect className={`sv-box-strong ${cls}-r`} x={x} y={b.y} width={b.w} height={b.h} style={{ fill: `url(#${rib})` }} />
      <text className="sv-lab" x={side > 0 ? x + b.w + 8 : x - 8} y={b.y + b.h / 2 + 4} textAnchor={side > 0 ? 'start' : 'end'}>{label}</text>
    </g>
  );
}

function Cells4({ x, y }) {
  return range(4).map((k) => <rect key={k} className="sv-box-strong" x={x + k * 12} y={y} width={12} height={12} />);
}

function FlatBar({ x }) {
  return (
    <>
      <rect className="sv-box-strong" x={x} y={FLAT.y} width={FLAT.w} height={FLAT.h} />
      {range(20, 1).map((k) => (
        <line key={k} className="sv-grid" x1={x + k * 8} x2={x + k * 8} y1={FLAT.y} y2={FLAT.y + FLAT.h} />
      ))}
    </>
  );
}

function art(step, uid) {
  const on = (b) => (step >= b ? 1 : 0);
  const op = (cls) => on(FROM[cls]);
  const rib = `${uid}rib`;
  const filt = `${uid}filt`;
  const zoom = step === 1 ? 1 : 0;
  return (
    <>
      <defs>
        <pattern id={rib} width={ST} height={CH} patternUnits="userSpaceOnUse">
          <rect width={ST} height={CH} style={{ fill: 'var(--surface)' }} />
          <line x1={0.5} x2={0.5} y1={0} y2={CH} style={{ stroke: 'var(--line-2)' }} strokeWidth="1" />
        </pattern>
        <pattern id={filt} width={12} height={3} patternUnits="userSpaceOnUse">
          <rect width={12} height={3} style={{ fill: 'var(--surface)' }} />
          <line x1={0} x2={12} y1={0.5} y2={0.5} style={{ stroke: 'var(--line)' }} strokeWidth="1" />
        </pattern>
      </defs>

      {/* ── top: input = target ── */}
      <text className="sv-cap" x={24} y={24}>Encoder</text>
      <text className="sv-cap" x={W - 24} y={24} textAnchor="end">Decoder</text>
      <text className="sv-num cp-code" x={400} y={24} textAnchor="middle" opacity={on(0)}>train_model(vae, z_train, z_train, …)</text>
      <path className="sv-line sv-faint cp-x" d={curve(S0)} strokeWidth="1.6" />
      <text className="sv-lab-strong" x={S0 - 8} y={yT(25) + 4} textAnchor="end">x</text>
      <g className="cp-strip" opacity={on(0)}>
        {SEQ.map((v, i) => (
          <rect key={i} className="cp-cell" x={S0 + i * ST} y={STRIP_Y} width={ST} height={8} style={{ fill: 'var(--ink-2)' }} opacity={shade(v)} />
        ))}
        <rect className="sv-axis" x={S0} y={STRIP_Y} width={SW} height={8} />
        <text className="sv-lab" x={S0 + SW + 8} y={STRIP_Y + 8}>(84, 1)</text>
      </g>
      <path className="sv-line sv-faint cp-t" d={curve(S1)} strokeWidth="1.6" />
      <text className="sv-lab-strong cp-tl" x={S1 + SW + 8} y={yT(25) + 4} opacity={on(0)}>x</text>
      <path className="sv-faint cp-arc" d={`M${S0 + SW + 6} ${yT(28)} Q 400 ${yT(40)} ${S1 - 6} ${yT(28)}`} strokeWidth="1.2" />
      <g className="cp-arcl" opacity={on(0)}>
        <text className="sv-lab-strong" x={400} y={yT(25) + 6} textAnchor="middle">input = target</text>
        <text className="sv-lab" x={400} y={yT(25) + 20} textAnchor="middle">the same 84 z-scores</text>
      </g>

      {/* ── zoom: kernel 5, stride 2 (beat 1 only) ── */}
      <g className="cp-zoom" opacity={zoom}>
        <rect className="sv-box" x={428} y={172} width={362} height={208} />
        <text className="sv-cap" x={442} y={193}>Zoom · the first 12 months</text>
        {range(13).map((m) => (
          <g key={m}>
            {m === 0 ? (
              <rect className="sv-faint" x={ZX + 0.5} y={ZY + 0.5} width={ZC - 1} height={ZC - 1} strokeDasharray="3 2" />
            ) : (
              <rect x={ZX + m * ZC} y={ZY} width={ZC} height={ZC} style={{ fill: 'var(--ink-2)' }} opacity={shade(SEQ[m - 1])} />
            )}
            <text className="sv-lab" x={ZX + m * ZC + ZC / 2} y={ZY + ZC + 13} textAnchor="middle">{m === 0 ? 'pad' : m}</text>
          </g>
        ))}
        <text className="sv-lab" x={ZX + ZC / 2} y={ZY + ZC / 2 + 4} textAnchor="middle">0</text>
        <text className="sv-lab" x={442} y={OUT_Y + 62}>step</text>
        {range(5, 1).map((j) => (
          <g key={j} className={`cp-oc cp-oc${j}`}>
            <rect x={colX(j) - 6} y={OUT_Y} width={12} height={48} style={{ fill: `url(#${filt})`, stroke: 'var(--ink-2)' }} />
            <text className="sv-lab" x={colX(j)} y={OUT_Y + 62} textAnchor="middle">{j}</text>
          </g>
        ))}
        <line className="sv-accent cp-link" x1={colX(5)} x2={colX(5)} y1={ZY + ZC + 18} y2={OUT_Y - 2} strokeWidth="1.4" />
        <rect className="sv-accent cp-win" x={winX(5)} y={ZY - 4} width={5 * ZC + 4} height={ZC + 8} rx={3} strokeWidth="2" fill="none" />
        <text className="sv-lab" x={442} y={352}>a step reads 5 months; the next starts 2 on</text>
        <text className="sv-lab" x={442} y={366}>16 filters → 16 numbers a step · 84 → 42</text>
      </g>
      <rect className="sv-accent cp-zmark" x={S0 - 2} y={STRIP_Y - 3} width={12 * ST + 4} height={14} strokeWidth="1.4" fill="none" opacity={zoom} />

      {/* ── encoder ── */}
      <VArrow x={EX} y0={A1[0]} y1={A1[1]} cls="cp-e1" op={op('cp-e1')} />
      <LayerLab x={EX + 10} y={A1[0] + 16} anchor="start" name="Conv1D · 16 filters" sub="kernel 5 · stride 2 · ReLU" cls="cp-e1" op={op('cp-e1')} />
      <Par x={EX + 10} y={A1[0] + 42} n={96} op={on(4)} />
      <Block cx={EX} b={B42} cls="cp-e2" rib={rib} label="(42, 16)" side={1} op={op('cp-e2')} />
      <VArrow x={EX} y0={A2[0]} y1={A2[1]} cls="cp-e3" op={op('cp-e3')} />
      <LayerLab x={EX + 10} y={A2[0] + 16} anchor="start" name="Conv1D · 32 filters" sub="kernel 5 · stride 2 · ReLU" cls="cp-e3" op={op('cp-e3')} />
      <Par x={EX + 10} y={A2[0] + 42} n={2592} op={on(4)} />
      <Block cx={EX} b={B21} cls="cp-e4" rib={rib} label="(21, 32)" side={1} op={op('cp-e4')} />
      <VArrow x={EX} y0={A3[0]} y1={A3[1]} cls="cp-e5" op={op('cp-e5')} />
      <text className="sv-lab-strong cp-e5" x={EX + 10} y={A3[0] + 14} opacity={op('cp-e5')}>Flatten</text>
      <g className="cp-e6" opacity={op('cp-e6')}>
        <FlatBar x={EX - FLAT.w / 2} />
        <text className="sv-lab" x={EX + FLAT.w / 2 + 8} y={FLAT.y + 7}>672 = 21 × 32</text>
      </g>
      <g className="cp-e7" opacity={op('cp-e7')}>
        <path className="sv-ink2" d={`M${EX - 18} ${FLAT.y + 10}L${MU_X + 24} ${HEAD_Y - 4}`} strokeWidth="1.2" />
        <path className="sv-ink2" d={`M${EX + 18} ${FLAT.y + 10}L${GA_X + 24} ${HEAD_Y - 4}`} strokeWidth="1.2" />
        <text className="sv-lab-strong" x={MU_X + 30} y={HEAD_Y - 18} textAnchor="end">Dense(4)</text>
        <text className="sv-lab-strong" x={GA_X + 18} y={HEAD_Y - 18}>Dense(4)</text>
      </g>
      <g className="cp-e8" opacity={op('cp-e8')}>
        <Cells4 x={MU_X} y={HEAD_Y} />
        <Cells4 x={GA_X} y={HEAD_Y} />
        <text className="sv-lab-strong" x={MU_X + 24} y={HEAD_Y + 28} textAnchor="middle">μ · z_mean</text>
        <text className="sv-lab-strong" x={GA_X + 24} y={HEAD_Y + 28} textAnchor="middle">γ = log σ² · z_log_var</text>
      </g>
      <Par x={MU_X + 24} y={HEAD_Y + 41} n={2692} anchor="middle" op={on(4)} />
      <Par x={GA_X + 24} y={HEAD_Y + 41} n={2692} anchor="middle" op={on(4)} />

      {/* ── codings ── */}
      <g className="cp-d0" opacity={op('cp-d0')}>
        <path className="sv-ink2" d={`M${MU_X + 24} ${HEAD_Y + 48}V${BUS}H${Z_X - 4}M${GA_X + 24} ${HEAD_Y + 48}V${BUS}`} strokeWidth="1.2" />
        <path className="sv-ink2" d={`M${Z_X - 10} ${BUS - 4}L${Z_X - 4} ${BUS}L${Z_X - 10} ${BUS + 4}`} strokeWidth="1.2" />
        <text className="sv-lab" x={Z_X - 12} y={BUS - 8} textAnchor="end">sample</text>
        <Cells4 x={Z_X} y={BUS - 6} />
        <text className="sv-lab-strong" x={400} y={BUS + 26} textAnchor="middle">code z · 4 codings</text>
        <text className="sv-lab" x={400} y={BUS + 40} textAnchor="middle">Sampling layer · plate 11·2</text>
      </g>

      {/* ── decoder ── */}
      <g className="cp-d1" opacity={op('cp-d1')}>
        <path className="sv-ink2" d={`M${Z_X + 52} ${BUS}H${DX}V${FLAT.y + 12}`} strokeWidth="1.2" />
        <path className="sv-ink2" d={`M${DX - 4} ${FLAT.y + 18}L${DX} ${FLAT.y + 12}L${DX + 4} ${FLAT.y + 18}`} strokeWidth="1.2" />
        <text className="sv-lab-strong" x={DX + 10} y={412}>Dense(672) · ReLU</text>
      </g>
      <Par x={DX + 10} y={425} n={3360} op={on(4)} />
      <g className="cp-d2" opacity={op('cp-d2')}>
        <FlatBar x={DX - FLAT.w / 2} />
        <text className="sv-lab" x={DX - FLAT.w / 2 - 8} y={FLAT.y + 7} textAnchor="end">672</text>
      </g>
      <VArrow x={DX} y0={A3[1]} y1={A3[0]} cls="cp-d3" op={op('cp-d3')} />
      <text className="sv-lab-strong cp-d3" x={DX - 10} y={A3[0] + 14} textAnchor="end" opacity={op('cp-d3')}>Reshape</text>
      <Block cx={DX} b={B21} cls="cp-d4" rib={rib} label="(21, 32)" side={-1} op={op('cp-d4')} />
      <VArrow x={DX} y0={A2[1]} y1={A2[0]} cls="cp-d5" op={op('cp-d5')} />
      <LayerLab x={DX - 10} y={A2[0] + 16} anchor="end" name="Conv1DTranspose · 16 filters" sub="kernel 5 · stride 2 · ReLU" cls="cp-d5" op={op('cp-d5')} />
      <Par x={DX - 10} y={A2[0] + 42} n={2576} anchor="end" op={on(4)} />
      <Block cx={DX} b={B42} cls="cp-d6" rib={rib} label="(42, 16)" side={-1} op={op('cp-d6')} />
      <VArrow x={DX} y0={A1[1]} y1={A1[0]} cls="cp-d7" op={op('cp-d7')} />
      <LayerLab x={DX - 10} y={A1[0] + 16} anchor="end" name="Conv1DTranspose · 1 filter" sub="kernel 5 · stride 2 · linear" cls="cp-d7" op={op('cp-d7')} />
      <Par x={DX - 10} y={A1[0] + 42} n={81} anchor="end" op={on(4)} />
      <g className="cp-d8" opacity={op('cp-d8')}>
        <rect className="sv-box-strong" x={S1} y={STRIP_Y} width={SW} height={8} />
        {range(6, 1).map((k) => (
          <line key={k} className="sv-grid" x1={S1 + k * 12 * ST} x2={S1 + k * 12 * ST} y1={STRIP_Y} y2={STRIP_Y + 8} />
        ))}
        <text className="sv-lab" x={S1 - 8} y={STRIP_Y + 8} textAnchor="end">(84, 1)</text>
        <text className="sv-lab-strong" x={S1 + SW + 8} y={STRIP_Y + 8}>x̂</text>
      </g>
      <g className="cp-d9" opacity={op('cp-d9')}>
        <path className="sv-accent" d={`M${S1 + SW + 22} ${yT(25)}h6V${STRIP_Y + 4}h-6`} strokeWidth="1.4" fill="none" />
        <text className="sv-lab-strong" x={S1 + SW + 33} y={(yT(25) + STRIP_Y) / 2 + 6}>MSE</text>
      </g>

      {/* ── totals (beat 4) ── */}
      <g className="cp-tot" opacity={op('cp-tot')}>
        <text className="sv-cap" x={S0} y={H - 12}>Encoder total</text>
        <text className="sv-num" x={S0 + 108} y={H - 12} style={{ fontWeight: 700 }}>8,072 params</text>
        <text className="sv-num" x={S1 + SW} y={H - 12} textAnchor="end" style={{ fontWeight: 700 }}>6,017 params</text>
        <text className="sv-cap" x={S1 + SW - 100} y={H - 12} textAnchor="end">Decoder total</text>
      </g>
    </>
  );
}

function build(tl, { q, beat }) {
  // the dash pattern is offset 2 past the start so round caps leave no dot before a line draws
  const draw = (sel, at, dur) =>
    q(sel).forEach((p) => {
      const L = p.getTotalLength();
      tl.fromTo(p, { strokeDasharray: `${L} ${L + 4}`, strokeDashoffset: L + 2 }, { strokeDashoffset: 0, duration: dur, ease: 'power1.inOut', immediateRender: true }, at);
    });
  const fade = (sel, at, dur = 0.35, extra = {}) => tl.fromTo(q(sel), { opacity: 0 }, { opacity: 1, duration: dur, ...extra }, at);
  const reveal = (sel, w, at, dur) => tl.fromTo(q(sel), { attr: { width: 0 } }, { attr: { width: w }, duration: dur, ease: 'none' }, at);

  const hidden = ['.cp-code', '.cp-strip', '.cp-cell', '.cp-tl', '.cp-arcl', '.cp-zoom', '.cp-zmark', '.cp-oc', ...Object.keys(FROM).map((c) => `.${c}`)];
  tl.set(q(hidden.join(', ')), { opacity: 0, immediateRender: true }, 0);
  tl.set(q('.cp-win'), { attr: { x: winX(1) }, immediateRender: true }, 0);
  tl.set(q('.cp-link'), { attr: { x1: colX(1), x2: colX(1) }, immediateRender: true }, 0);

  // 0 · input = target
  beat(0, 0);
  draw('.cp-x', 'b0', 1.4);
  tl.set(q('.cp-strip'), { opacity: 1 }, 'b0+=0.3');
  tl.fromTo(q('.cp-cell'), { opacity: 0 }, { opacity: (i) => shade(SEQ[i]), duration: 0.25, stagger: 0.012 }, 'b0+=0.3');
  fade('.cp-code', 'b0+=0.6', 0.5);
  draw('.cp-arc', 'b0+=1.3', 0.7);
  fade('.cp-arcl', 'b0+=1.7', 0.4);
  draw('.cp-t', 'b0+=1.5', 1.4);
  fade('.cp-tl', 'b0+=2.6', 0.3);

  // 1 · kernel 5, stride 2
  beat(1, '+=0.6');
  fade('.cp-zoom, .cp-zmark', 'b1', 0.4);
  fade('.cp-e1', 'b1+=0.2');
  fade('.cp-e2', 'b1+=0.5', 0.2);
  reveal('.cp-e2-r', B42.w, 'b1+=0.5', 2.9);
  for (let j = 1; j <= 5; j++) {
    const at = 0.6 + (j - 1) * 0.6;
    fade(`.cp-oc${j}`, `b1+=${at}`, 0.2);
    if (j < 5) {
      // later tweens of the same attribute must not render their start state at build time
      const step = { duration: 0.32, ease: 'power2.inOut', immediateRender: false };
      tl.fromTo(q('.cp-win'), { attr: { x: winX(j) } }, { attr: { x: winX(j + 1) }, ...step }, `b1+=${at + 0.28}`);
      tl.fromTo(q('.cp-link'), { attr: { x1: colX(j), x2: colX(j) } }, { attr: { x1: colX(j + 1), x2: colX(j + 1) }, ...step }, `b1+=${at + 0.28}`);
    }
  }

  // 2 · down to 4 numbers
  beat(2, '+=1.2');
  tl.fromTo(q('.cp-zoom, .cp-zmark'), { opacity: 1 }, { opacity: 0, duration: 0.3, immediateRender: false }, 'b2');
  fade('.cp-e3', 'b2+=0.2');
  fade('.cp-e4', 'b2+=0.45', 0.2);
  reveal('.cp-e4-r', B21.w, 'b2+=0.45', 0.6);
  fade('.cp-e5', 'b2+=1.0');
  fade('.cp-e6', 'b2+=1.3');
  fade('.cp-e7', 'b2+=1.7');
  fade('.cp-e8', 'b2+=2.0');

  // 3 · sample z, back up the mirror
  beat(3, '+=0.9');
  DEC.forEach((c, k) => fade(`.${c}`, `b3+=${k * 0.32}`, 0.3));
  reveal('.cp-d4-r', B21.w, `b3+=${4 * 0.32}`, 0.4);
  reveal('.cp-d6-r', B42.w, `b3+=${6 * 0.32}`, 0.5);

  // 4 · parameter counts
  beat(4, '+=0.9');
  fade('.cp-par', 'b4', 0.3, { stagger: 0.12 });
  fade('.cp-tot', 'b4+=1.0', 0.4);
  tl.to({}, { duration: 1.2 });
}

// print: the zoom frame is cropped to what beat 1 adds (the input strip, the first
// encoder layer and the zoom), so it prints larger than the whole stage would
const FRAME_BOXES = { 1: '50 94 746 292' };

const BEATS = [
  {
    t: 'Input = target',
    c: 'A real training sequence goes in as 84 z-scores, and the same 84 numbers are what the output is scored against: train_model(vae, z_train, z_train, …).',
    fx: 0.5,
  },
  {
    t: 'Kernel 5, stride 2',
    c: 'Conv1D slides 16 filters, each 5 months wide, along the sequence and moves 2 months per step, so 84 months become 42 steps of 16 numbers.',
    fx: 1,
  },
  {
    t: 'Down to 4 numbers',
    c: 'A second stride-2 layer halves again to 21 steps of 32; Flatten lays those 672 values end to end and two Dense layers give 4 means μ and 4 log-variances γ.',
    fx: 0,
  },
  {
    t: 'Back up the mirror',
    c: 'A sampled code z of 4 numbers goes through Dense(672), Reshape and two Conv1DTranspose layers that double 21 → 42 → 84. The output x̂ is scored against x by MSE.',
    fx: 1,
  },
  {
    t: 'Parameter counts',
    c: '8,072 parameters in the encoder and 6,017 in the decoder. The three Dense layers next to the 672 values hold most of them; the outer convolutions are small (96 and 81).',
    fx: 0,
  },
];

export default function ConvPathScene({ id = 'vae-shape' }) {
  return (
    <Scene
      id={id}
      label="The VAE's layers: an 84-month sequence passes through two stride-2 Conv1D layers to 21 by 32, is flattened to 672 values and mapped to 4 means and 4 log-variances; a sampled 4-number code goes back through a Dense layer and two Conv1DTranspose layers to 84 months, scored against the input"
      viewBox={`0 0 ${W} ${H}`}
      beats={BEATS}
      art={art}
      build={build}
      keyframes={[1, 4]}
      frameBoxes={FRAME_BOXES}
    />
  );
}
