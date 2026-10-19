import { useMemo } from 'react';
import Scene from '../../scene/Scene';
import { lin, seriesPath } from '../../scene/geom';
import { SERIES } from '../../data/series';

/* ============================================================================
   SCENE — the reparameterisation trick (schematic, course notation)
   x (a real 84-month max sequence) → encoder → μ and γ = log σ² → ε ~ N(0, I)
   → z = μ + exp(γ/2) ⊗ ε → decoder → x̂. Each coding is drawn as a dot (μ)
   with a whisker (±σ); the sample lands ε standard deviations from μ.
   The last beat shows why the trick exists: gradients flow back through z to
   μ and γ, while ε sits outside the path. Coding values and x̂ are
   illustrative. Colours follow the page: the real sequence x in --ink-3, the
   decoded x̂ in the max channel's orange. Coding 1 is drawn at the prior
   (μ 0, σ 1) and labelled unused, as the notebook's dead coding is (KL
   [0, 2.00, 0.75, 1.88], Out [22]; plate 11·3).
   ========================================================================== */

const W = 800;
const H = 436;
const SEQ = SERIES.trainSeqs['0'].map((r) => r[1]);
const MU = [0, -0.9, 0.15, 1.1, -0.3, 0.7, -1.2, 0.05];
const GAMMA = [0, -0.6, -2.0, -0.9, -0.3, -1.6, -0.8, -1.4];
const EPS = [0.8, -1.1, 0.3, -0.5, 1.4, -0.2, 0.9, -1.6];
const SIG = GAMMA.map((g) => Math.exp(g / 2));
const ZV = MU.map((m, i) => m + SIG[i] * EPS[i]);

// mini charts for x and x̂
const cx = lin(1, 84, 0, 150);
const cy = lin(37, 14, 0, 110);
// x̂: a smoothed copy, standing in for the decoder's reconstruction (schematic)
const SMOOTH = SEQ.map((_, i) => {
  const w = SEQ.slice(Math.max(0, i - 1), i + 2);
  return w.reduce((a, b) => a + b, 0) / w.length;
});

// the coding panel: n rows, a −2.5…2.5 axis
const CX0 = 330;
const CX1 = 560;
const zx = lin(-2.5, 2.5, CX0, CX1);
const rowY = (i, n) => 100 + i * (180 / Math.max(1, n - 1));

function makeArt(codings) {
  const n = Math.min(codings, 8);
  return function art(step) {
    const on = (b) => (step >= b ? 1 : 0);
    return (
      <>
        <text className="sv-cap" x={24} y={24}>Reparameterisation · one sequence through the VAE</text>

        {/* x */}
        <g transform="translate(24 120)">
          <rect className="sv-box" x={-6} y={-12} width={162} height={136} />
          <path className="sv-line sv-faint rp-x" d={seriesPath(SEQ, cx, cy)} strokeWidth="1.6" />
          <text className="sv-lab-strong" x={0} y={140}>x · 84 monthly maxima</text>
          <text className="sv-lab" x={0} y={154}>a real training sequence</text>
        </g>

        {/* encoder */}
        <g className="rp-enc" opacity={on(0)}>
          <path className="sv-box-strong" d="M196 120 L288 160 L288 260 L196 300 Z" />
          <text className="sv-lab-strong" x={242} y={214} textAnchor="middle">encoder</text>
        </g>

        {/* codings panel */}
        <g className="rp-axis" opacity={on(1)}>
          <line className="sv-grid" x1={zx(0)} x2={zx(0)} y1={92} y2={rowY(n - 1, n) + 16} />
          <text className="sv-lab" x={zx(-2.5)} y={rowY(n - 1, n) + 34}>−2.5</text>
          <text className="sv-lab" x={zx(0)} y={rowY(n - 1, n) + 34} textAnchor="middle">0</text>
          <text className="sv-lab" x={zx(2.5)} y={rowY(n - 1, n) + 34} textAnchor="end">2.5</text>
          <text className="sv-cap" x={CX0} y={78}>{codings > n ? `${n} of the ${codings} codings` : `the ${codings} codings`}</text>
        </g>
        {MU.slice(0, n).map((m, i) => {
          const y = rowY(i, n);
          return (
            <g key={i}>
              <line className="sv-ink2 rp-whisk" x1={zx(m - SIG[i])} x2={zx(m + SIG[i])} y1={y} y2={y} strokeWidth="1.5" opacity={on(1)} />
              <line className="sv-ink2 rp-whisk" x1={zx(m - SIG[i])} x2={zx(m - SIG[i])} y1={y - 4} y2={y + 4} opacity={on(1)} />
              <line className="sv-ink2 rp-whisk" x1={zx(m + SIG[i])} x2={zx(m + SIG[i])} y1={y - 4} y2={y + 4} opacity={on(1)} />
              <text className="sv-lab rp-mu" x={CX0 - 6} y={y + 4} textAnchor="end" opacity={on(0)}>
                {/* the notebook's dead coding (KL 0, Out [22]) sits at the prior */}
                {i === 0 ? 'z1: unused (11·3)' : `z${i + 1}`}
              </text>
              <circle className="rp-mu" cx={zx(m)} cy={y} r={4} style={{ fill: 'var(--surface)', stroke: 'var(--ink)', strokeWidth: 1.5 }} opacity={on(0)} />
              <circle className="sv-accent-fill rp-z" cx={zx(step >= 3 ? ZV[i] : m)} cy={y} r={4.5} opacity={on(3)} />
            </g>
          );
        })}
        <g className="rp-key" opacity={on(1)}>
          <circle cx={CX0 + 4} cy={rowY(n - 1, n) + 52} r={4} style={{ fill: 'var(--surface)', stroke: 'var(--ink)', strokeWidth: 1.5 }} />
          <text className="sv-lab" x={CX0 + 14} y={rowY(n - 1, n) + 56}>μ</text>
          <line className="sv-ink2" x1={CX0 + 40} x2={CX0 + 66} y1={rowY(n - 1, n) + 52} y2={rowY(n - 1, n) + 52} strokeWidth="1.5" />
          <text className="sv-lab" x={CX0 + 72} y={rowY(n - 1, n) + 56}>±σ, σ = exp(γ/2)</text>
          <circle className="sv-accent-fill rp-zkey" cx={CX0 + 214} cy={rowY(n - 1, n) + 52} r={4.5} opacity={on(3)} />
          <text className="sv-lab rp-zkey" x={CX0 + 224} y={rowY(n - 1, n) + 56} opacity={on(3)}>z</text>
        </g>

        {/* ε */}
        <g className="rp-eps" opacity={on(2)}>
          <path className="sv-ink2" d="M578 70 C 594 70, 598 44, 610 44 C 622 44, 626 70, 642 70" strokeWidth="1.4" fill="none" />
          <line className="sv-axis" x1={574} x2={646} y1={70} y2={70} />
          <text className="sv-num" x={654} y={62}>ε ~ N(0, I)</text>
          <text className="sv-lab" x={578} y={88}>drawn fresh on every pass</text>
        </g>

        {/* formula */}
        <g className="rp-formula" opacity={on(3)}>
          <text className="sv-num" x={578} y={116}>z = μ + exp(γ/2) ⊗ ε</text>
          <text className="sv-lab" x={578} y={134}>each z sits ε standard</text>
          <text className="sv-lab" x={578} y={148}>deviations from its μ</text>
        </g>

        {/* decoder + x̂ */}
        <g className="rp-dec" opacity={on(4)}>
          <path className="sv-box-strong" d="M590 200 L680 170 L680 290 L590 260 Z" />
          <text className="sv-lab-strong" x={635} y={234} textAnchor="middle">decoder</text>
          <g transform="translate(694 186) scale(0.6)">
            <rect className="sv-box" x={-6} y={-12} width={162} height={136} />
            <path className="sv-line sv-max rp-xh" d={seriesPath(SMOOTH, cx, cy)} strokeWidth="2.4" />
          </g>
          <text className="sv-lab-strong" x={694} y={280}>x̂</text>
          <text className="sv-lab" x={708} y={280}>illustrative</text>
        </g>

        {/* gradient path */}
        <g className="rp-grad" opacity={on(5)}>
          <path className="sv-accent" d="M672 392 H 214" strokeWidth="1.6" strokeDasharray="5 4" fill="none" />
          <path className="sv-accent" d="M224 386 L 212 392 L 224 398" strokeWidth="1.6" fill="none" />
          {/* centred on the stage (fx 0.5) and in two lines, so a 390 px screen frames all of it inside its edge fades */}
          <text className="sv-lab-strong" x={400} y={384} textAnchor="middle">backprop: loss → decoder → z → μ, γ → encoder</text>
          <text className="sv-lab" x={400} y={410} textAnchor="middle">ε is an input with nothing to learn,</text>
          <text className="sv-lab" x={400} y={424} textAnchor="middle">so the random draw sits off the path to μ and γ</text>
        </g>
      </>
    );
  };
}

const makeBuild = (codings) => function build(tl, { q, beat }) {
  const n = Math.min(codings, 8);
  tl.set(q('.rp-enc, .rp-mu, .rp-axis, .rp-whisk, .rp-key, .rp-eps, .rp-z, .rp-zkey, .rp-formula, .rp-dec, .rp-grad'), { opacity: 0, immediateRender: true }, 0);
  const x = q('.rp-x')[0];
  const L = x.getTotalLength();

  beat(0, 0);
  tl.fromTo(x, { strokeDasharray: L, strokeDashoffset: L }, { strokeDashoffset: 0, duration: 1.2, ease: 'power1.inOut', immediateRender: true }, 'b0');
  tl.fromTo(q('.rp-enc'), { opacity: 0 }, { opacity: 1, duration: 0.4 }, 'b0+=0.8');
  tl.fromTo(q('.rp-mu'), { opacity: 0, x: -40 }, { opacity: 1, x: 0, duration: 0.5, stagger: 0.06 }, 'b0+=1.1');

  beat(1, '+=0.5');
  tl.fromTo(q('.rp-axis, .rp-key'), { opacity: 0 }, { opacity: 1, duration: 0.4 }, 'b1');
  tl.fromTo(q('.rp-whisk'), { opacity: 0, scaleX: 0.1, transformOrigin: '50% 50%' }, { opacity: 1, scaleX: 1, duration: 0.5, stagger: 0.02 }, 'b1+=0.2');

  beat(2, '+=0.7');
  tl.fromTo(q('.rp-eps'), { opacity: 0, y: -8 }, { opacity: 1, y: 0, duration: 0.5 }, 'b2');

  beat(3, '+=0.7');
  tl.fromTo(q('.rp-formula, .rp-zkey'), { opacity: 0 }, { opacity: 1, duration: 0.4 }, 'b3');
  q('.rp-z').forEach((el, i) => {
    if (i >= n) return;
    tl.fromTo(el, { opacity: 0, attr: { cx: zx(MU[i]) } }, { opacity: 1, attr: { cx: zx(ZV[i]) }, duration: 0.7, ease: 'power2.out' }, `b3+=${0.3 + i * 0.07}`);
  });

  beat(4, '+=0.9');
  tl.fromTo(q('.rp-dec'), { opacity: 0 }, { opacity: 1, duration: 0.4 }, 'b4');
  const xh = q('.rp-xh')[0];
  const L2 = xh.getTotalLength();
  tl.fromTo(xh, { strokeDasharray: L2, strokeDashoffset: L2 }, { strokeDashoffset: 0, duration: 1.1, ease: 'power1.inOut', immediateRender: true }, 'b4+=0.3');

  beat(5, '+=0.7');
  tl.fromTo(q('.rp-grad'), { opacity: 0 }, { opacity: 1, duration: 0.5 }, 'b5');
  tl.to({}, { duration: 1.2 });
};

const BEATS = [
  { t: 'Encode', c: 'An 84-month maximum-temperature sequence goes into the encoder, which outputs a mean μ for every coding.', fx: 0 },
  { t: 'Two vectors, not one', c: 'It also outputs γ = log σ², a spread for every coding. Predicting log σ² keeps σ positive.', fx: 0.45 },
  { t: 'Draw ε', c: 'A standard normal vector ε is drawn, independent of the input.', fx: 1 },
  { t: 'Shift and scale', c: 'z = μ + exp(γ/2) ⊗ ε: each coding is moved from its mean by ε standard deviations of its own spread.', fx: 0.9 },
  { t: 'Decode', c: 'The decoder turns z back into an 84-month sequence x̂, compared with x by the reconstruction loss.', fx: 1 },
  { t: 'Why it is a trick', c: 'Drawn straight from N(μ, σ²), z has no gradient to μ or σ, so the reconstruction loss could never train the encoder through it. Rewritten, ε holds the randomness.', fx: 0.5 },
];

export default function ReparamScene({ id = 'vae-reparam', codings = 8 }) {
  const art = useMemo(() => makeArt(codings), [codings]);
  const build = useMemo(() => makeBuild(codings), [codings]);
  return (
    <Scene
      id={id}
      label={`Schematic of the VAE reparameterisation trick with ${codings} codings: encoder outputs mean and log-variance, a standard normal epsilon is drawn, z equals mu plus sigma times epsilon, and the decoder reconstructs the sequence`}
      viewBox={`0 0 ${W} ${H}`}
      beats={BEATS}
      art={art}
      build={build}
      keyframes={[5]}
      schematic="coding values and x̂ illustrative"
    />
  );
}
