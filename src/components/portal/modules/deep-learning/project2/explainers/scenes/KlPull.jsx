import Scene from '../../scene/Scene';
import { lin, pathOf, range } from '../../scene/geom';

/* ============================================================================
   SCENE — the KL pull and the dead coding
   Top: the four codings, each with the prior N(0, 1) and the encoder's
   distribution q(z|x) = N(μ, σ²) for three example sequences. The curve
   positions are schematic, but each row's three curves are chosen so their
   mean KL equals that row's real value; the bars are the real KL per
   coding on the validation set, [0, 2.00, 0.75, 1.88] nats (Out [22]).
   Beat 1 shows what reconstruction alone would like (narrow, far apart);
   beat 2 the pull of the latent loss −½(1 + γ − exp(γ) − μ²) towards the
   prior: coding 1 lands on the prior for every input (KL 0, dead).
   Bottom left: KL_WEIGHT = 0.5/84 and the loss-vs-metric reconciliation
   0.067 + (0.5/84) × 4.63 = 0.0946 ≈ val_loss 0.0950 (Out [22]).
   Bottom right: the weight sweep — codings in use 2 / 3 / 4 (cell 43) and the
   tuning log's flat-sample share 16 / 22 / 26 % (conv, codings 4, 3 seeds).
   ========================================================================== */

const W = 800;
const H = 572;
const AX0 = 70;
const AX1 = 430;
const gx = lin(-3.5, 3.5, AX0, AX1);
const ROW = (i) => 132 + i * 72;
const NPT = 40;
const KL = [0, 2.0, 0.75, 1.88];
const KL_TXT = ['0.00', '2.00', '0.75', '1.88'];
const BX = 480; // KL bar origin
const BS = 60; // px per nat
const KL_SUM = '4.63';

// [μ, σ] per example sequence: `pre` = reconstruction alone, `q` = after the pull.
// q rows have mean KL 0, 2.00, 0.75 and 1.88 nats (KL = ½(μ² + σ² − 1 − ln σ²)).
const DIMS = [
  { pre: [[-1.5, 0.3], [0.2, 0.26], [1.45, 0.3]], q: [[0, 1], [0, 1], [0, 1]] },
  { pre: [[-1.95, 0.15], [0.4, 0.15], [1.95, 0.15]], q: [[-1.6, 0.2], [0.35, 0.2], [1.6, 0.2]] },
  { pre: [[-1.75, 0.28], [0.2, 0.28], [1.75, 0.28]], q: [[-1.2, 0.55], [0.15, 0.55], [1.25, 0.55]] },
  { pre: [[-1.95, 0.16], [0.45, 0.16], [2.1, 0.16]], q: [[-1.55, 0.25], [0.4, 0.25], [1.8, 0.25]] },
];

// a translucent ink fill reads on light and dark grounds alike
const PRIOR_FILL = { fill: 'var(--ink-3)', fillOpacity: 0.18, stroke: 'var(--ink-3)', strokeWidth: 1 };

const peak = (s) => Math.min(48, 24 / Math.sqrt(s));
function gauss(mu, s, base) {
  const h = peak(s);
  return pathOf(range(NPT + 1).map((k) => {
    const u = -3.4 + (6.8 * k) / NPT;
    return [gx(mu + u * s), base - h * Math.exp(-0.5 * u * u)];
  }));
}
const priorFill = (base) => `${gauss(0, 1, base)}L${gx(3.4).toFixed(1)} ${base}L${gx(-3.4).toFixed(1)} ${base}Z`;

// the stacked loss bar
const LX = 40;
const LS = 3400; // px per unit of loss
const MSE = 0.067;
const WKL = (0.5 / 84) * 4.63; // 0.0276
const VAL_LOSS = 0.095;
const LY = 466;

// the sweep
const SW = [
  { k: '×1', used: 2, flat: '16%' },
  { k: '×½', used: 3, flat: '22%' },
  { k: '×¼', used: 4, flat: '26%' },
];
const SX = (j) => 628 + j * 62;

function art(step) {
  const on = (b) => (step >= b ? 1 : 0);
  return (
    <>
      <text className="sv-cap" x={24} y={24}>Four codings · three example sequences</text>
      <g>
        <rect x={24} y={44} width={18} height={9} style={PRIOR_FILL} />
        <text className="sv-lab" x={48} y={53}>prior N(0, 1)</text>
      </g>
      <g className="kl-qkey" opacity={on(1)}>
        <line className="sv-ink" x1={AX0 + 104} x2={AX0 + 124} y1={49} y2={49} strokeWidth="1.5" />
        <text className="sv-lab" x={AX0 + 130} y={53}>encoder’s distribution q(z|x) = N(μ, σ²)</text>
      </g>

      {/* ── the four rows ── */}
      <line className="sv-grid" x1={gx(0)} x2={gx(0)} y1={ROW(0) - 52} y2={ROW(3)} />
      {DIMS.map((d, i) => {
        const base = ROW(i);
        return (
          <g key={i}>
            <text className="sv-lab-strong" x={AX0 - 30} y={base - 6}>z{i + 1}</text>
            <path d={priorFill(base)} style={PRIOR_FILL} />
            <line className="sv-axis" x1={AX0} x2={AX1} y1={base} y2={base} />
            {d.pre.map(([m, s], k) => (
              <path
                key={k}
                className={`sv-ink kl-q kl-q${i}${k}`}
                d={step >= 2 ? gauss(d.q[k][0], d.q[k][1], base) : gauss(m, s, base)}
                strokeWidth="1.5"
                opacity={on(1)}
              />
            ))}
          </g>
        );
      })}
      {[-3, -2, -1, 0, 1, 2, 3].map((t) => (
        <text key={t} className="sv-lab" x={gx(t)} y={ROW(3) + 16} textAnchor="middle">{t === 0 ? '0' : t > 0 ? t : `−${-t}`}</text>
      ))}

      {/* ── KL bars ── */}
      <g className="kl-bars" opacity={on(2)}>
        <text className="sv-cap" x={BX} y={74}>KL per coding · validation · nats</text>
        <text className="sv-lab" x={BX} y={92}>−½ (1 + γ − exp(γ) − μ²), averaged</text>
        <line className="sv-axis" x1={BX} x2={BX} y1={ROW(0) - 22} y2={ROW(3) + 4} />
      </g>
      {KL.map((v, i) => (
        <g key={i}>
          <rect className="sv-accent-fill kl-bar" x={BX} y={ROW(i) - 16} width={step >= 2 ? v * BS : 0} height={14} />
          <text className="sv-num kl-val" x={BX + v * BS + 8} y={ROW(i) - 5} opacity={on(2)}>{KL_TXT[i]}</text>
        </g>
      ))}
      <g className="kl-dead" opacity={on(2)}>
        <text className="sv-lab" x={BX + 46} y={ROW(0) - 5}>dead: q = prior for every x</text>
        <path className="sv-ink2" d={`M${BX + 196} ${ROW(1) - 22}h8V${ROW(3)}h-8`} strokeWidth="1.2" />
        <text className="sv-lab" x={BX + 212} y={(ROW(1) + ROW(3)) / 2 - 4}>3 in use</text>
      </g>
      <text className="sv-lab-strong kl-sum" x={BX} y={ROW(3) + 22} opacity={on(3)}>sum 0 + 2.00 + 0.75 + 1.88 = {KL_SUM}</text>

      {/* ── weight, loss and metric ── */}
      <g className="kl-w" opacity={on(3)}>
        <line className="sv-grid" x1={LX} x2={W - LX} y1={392} y2={392} />
        <text className="sv-cap" x={LX} y={414}>Total loss · validation · epoch 23</text>
        <text className="sv-num" x={LX} y={436}>loss = MSE + (0.5 / 84) × KL</text>
        <text className="sv-lab" x={LX} y={453}>÷ 84: per month, like the MSE; × 0.5 halves it</text>
      </g>
      <g className="kl-l" opacity={on(4)}>
        <rect x={LX} y={LY} width={MSE * LS} height={16} style={PRIOR_FILL} />
        <rect className="sv-accent-fill" x={LX + MSE * LS} y={LY} width={WKL * LS} height={16} />
        <line className="sv-ink" x1={LX + VAL_LOSS * LS} x2={LX + VAL_LOSS * LS} y1={LY - 6} y2={LY + 22} strokeWidth="1.4" />
        {/* on the grey bar: full ink, as --ink-3 there fell to 3.8:1 in arcade */}
        <text className="sv-lab" x={LX + (MSE * LS) / 2} y={LY + 11} textAnchor="middle" style={{ fill: 'var(--ink)' }}>val_mse 0.067</text>
        {/* under the bar and ending at its marker, so the left half of a narrow stage holds the whole block */}
        <text className="sv-lab-strong" x={LX + VAL_LOSS * LS} y={LY + 34} textAnchor="end">val_loss 0.0950</text>
        <text className="sv-num" x={LX} y={LY + 52} style={{ fontSize: 11 }}>0.067 + (0.5/84) × {KL_SUM} = 0.067 + 0.0276 = 0.0946</text>
        <text className="sv-lab" x={LX} y={LY + 68}>≈ val_loss 0.0950, to within the printed rounding</text>
        <text className="sv-lab" x={LX} y={LY + 84}>add_loss feeds the loss, not the mse metric</text>
      </g>

      {/* ── the weight sweep ── */}
      <g className="kl-s" opacity={on(5)}>
        <text className="sv-cap" x={490} y={414}>KL weight · tuning runs</text>
        <text className="sv-lab" x={490} y={440}>per-month weight</text>
        <text className="sv-lab" x={490} y={464}>codings in use</text>
        <text className="sv-lab" x={490} y={488}>flat samples</text>
        {SW.map((s, j) => (
          <g key={s.k}>
            <text className="sv-num" x={SX(j)} y={440} textAnchor="middle" style={{ fontWeight: j === 1 ? 700 : 400 }}>{s.k}</text>
            {range(4).map((k) => (
              <circle
                key={k}
                cx={SX(j) - 18 + k * 12}
                cy={460}
                r={4}
                style={k < s.used ? { fill: 'var(--dlp2-mark)' } : { fill: 'var(--surface)', stroke: 'var(--ink-3)', strokeWidth: 1.2 }}
              />
            ))}
            <text className="sv-num" x={SX(j)} y={488} textAnchor="middle">{s.flat}</text>
          </g>
        ))}
        <path className="sv-accent" d={`M${SX(1) - 28} 498h56`} strokeWidth="2" />
        <text className="sv-lab-strong" x={SX(1)} y={514} textAnchor="middle">chosen</text>
        <text className="sv-lab" x={490} y={LY + 70}>in use: cell 43 · flat: tuning log,</text>
        <text className="sv-lab" x={490} y={LY + 87}>conv, 3 seeds × 200 draws each</text>
      </g>
    </>
  );
}

function build(tl, { q, beat }) {
  const fade = (sel, at, dur = 0.4, extra = {}) => tl.fromTo(q(sel), { opacity: 0 }, { opacity: 1, duration: dur, ...extra }, at);
  tl.set(q('.kl-qkey, .kl-q, .kl-bars, .kl-val, .kl-dead, .kl-sum, .kl-w, .kl-l, .kl-s'), { opacity: 0, immediateRender: true }, 0);
  DIMS.forEach((d, i) => d.pre.forEach(([m, s], k) => {
    tl.set(q(`.kl-q${i}${k}`), { attr: { d: gauss(m, s, ROW(i)) }, immediateRender: true }, 0);
  }));
  tl.set(q('.kl-bar'), { attr: { width: 0 }, immediateRender: true }, 0);

  // 0 · the prior (drawn from the start)
  beat(0, 0);

  // 1 · what reconstruction alone would like
  beat(1, '+=1.6');
  fade('.kl-qkey', 'b1');
  fade('.kl-q', 'b1+=0.2', 0.5, { stagger: 0.05 });

  // 2 · the pull
  beat(2, '+=1.4');
  DIMS.forEach((d, i) => d.pre.forEach(([m, s], k) => {
    tl.fromTo(
      q(`.kl-q${i}${k}`),
      { attr: { d: gauss(m, s, ROW(i)) } },
      { attr: { d: gauss(d.q[k][0], d.q[k][1], ROW(i)) }, duration: 1.4, ease: 'power2.inOut', immediateRender: false },
      `b2+=${0.2 + i * 0.12}`,
    );
  }));
  fade('.kl-bars', 'b2+=0.6');
  q('.kl-bar').forEach((el, i) => {
    tl.fromTo(el, { attr: { width: 0 } }, { attr: { width: KL[i] * BS }, duration: 0.8, ease: 'power2.out', immediateRender: false }, `b2+=${1.0 + i * 0.12}`);
  });
  fade('.kl-val', 'b2+=1.6', 0.3, { stagger: 0.1 });
  fade('.kl-dead', 'b2+=2.1');

  // 3 · weighted per month, then halved
  beat(3, '+=1.2');
  fade('.kl-sum', 'b3');
  fade('.kl-w', 'b3+=0.4');

  // 4 · loss and metric
  beat(4, '+=1.4');
  fade('.kl-l', 'b4');
  const segs = q('.kl-l rect');
  tl.fromTo(segs[0], { attr: { width: 0 } }, { attr: { width: MSE * LS }, duration: 0.7, ease: 'power2.out' }, 'b4+=0.1');
  tl.fromTo(segs[1], { attr: { x: LX, width: 0 } }, { attr: { x: LX + MSE * LS, width: WKL * LS }, duration: 0.6, ease: 'power2.out' }, 'b4+=0.8');

  // 5 · the sweep
  beat(5, '+=1.6');
  fade('.kl-s', 'b5', 0.5);
  tl.to({}, { duration: 1.4 });
}

const BEATS = [
  {
    t: 'One prior for every coding',
    c: 'The KL term pulls each sequence’s distribution towards N(0, 1). If it works, all 1522 sequences’ codes fill that bell, and section 12 can draw from N(0, I).',
    fx: 0,
  },
  {
    t: 'What reconstruction wants',
    c: 'For each sequence the encoder outputs a distribution per coding. Reconstruction alone would make them narrow and far apart, so every sequence gets its own precise code.',
    fx: 0,
  },
  {
    t: 'The KL pull',
    c: 'The latent loss charges each coding, in nats, for how far its distributions sit from the prior. Coding 1 ended at KL 0: the prior for every input, carrying nothing.',
    // the bars, their values, "dead" and "3 in use" (ends x 745) all sit right of 480
    fx: 1,
  },
  {
    t: 'Per month, then halved',
    c: 'The KL is summed over the 4 codings, then weighted by 0.5/84: divided by 84 so it is per month like the MSE, then halved.',
    fx: 0,
  },
  {
    t: 'Loss against metric',
    c: 'The validation loss is the reconstruction MSE plus the weighted KL. The two printed numbers and the KL per coding add up to within rounding.',
    fx: 0,
  },
  {
    t: 'The weight sweep',
    c: 'At the full per-month weight only two codings stayed in use; a quarter freed a fourth but gave more flat samples. A half kept three in use.',
    fx: 1,
  },
];

export default function KlPullScene({ id = 'vae-kl' }) {
  return (
    <Scene
      id={id}
      label="The KL term: four codings each with the standard normal prior and the encoder's distributions for three sequences; the latent loss pulls them toward the prior, leaving coding 1 dead; real KL per coding 0, 2.00, 0.75 and 1.88 nats; the loss is the MSE 0.067 plus 0.5/84 times 4.63, about the validation loss 0.0950; a sweep of the KL weight"
      viewBox={`0 0 ${W} ${H}`}
      beats={BEATS}
      art={art}
      build={build}
      keyframes={[5]}
      schematic="curve positions illustrative · KL values real"
    />
  );
}
