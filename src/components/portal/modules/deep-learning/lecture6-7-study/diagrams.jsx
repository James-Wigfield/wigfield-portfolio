import { createContext, useContext } from 'react';

/* ============================================================================
   LECTURES 6–7 STUDY — LINE-ART DIAGRAMS
   ----------------------------------------------------------------------------
   One monochrome line-art SVG per figure worth drawing by hand: boxes,
   circles, arrows and short labels in currentColor, no fills or shading, so
   each can be copied onto paper in a couple of minutes. Layer stacks are
   drawn bottom-to-top, as the slides draw them. <Diagram fig="…" /> picks one.

     dae       Figure 17-8: two denoising autoencoders, Gaussian noise added
               to the input (left) or dropout on the input (right)
     vae       Figure 17-11 (left): Input, Hidden 1, Hidden 2, Codings μ and
               Codings σ; σ × Gaussian noise, + μ; Hidden 4, Hidden 5, Output
     gan       Figure 17-14: Noise → Generator → Fake; Fake or Real →
               Discriminator → Fake/real, with the two goals
     phases    slides 21–22 as this page draws them: what goes into each
               phase's batch, the labels, and which network learns

   Highlighting: <Diagram fig="…" hl={['noise']} sheet /> draws the named
   parts (<P k="…">) in the notebook's green pen; with `lab` instead of
   `sheet` they are drawn in the accent colour. The part keys per figure are
   listed in ./sheets/figParts.js (check-gen.mjs compares them with the
   <P k> marks below).
   ========================================================================== */

const SW = 1.4;

// null outside highlight mode; otherwise the list of parts to emphasise
const HlCtx = createContext(null);

function P({ k, children }) {
  const hl = useContext(HlCtx);
  if (!hl) return children;
  return <g className={hl.includes(k) ? 'dl67s-fig__hl' : undefined} data-part={k}>{children}</g>;
}

function Arrow({ x1, y1, x2, y2, dashed = false, head = 5 }) {
  const a = Math.atan2(y2 - y1, x2 - x1);
  const p = (d) => `${x2 - head * Math.cos(a + d)},${y2 - head * Math.sin(a + d)}`;
  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} strokeDasharray={dashed ? '4 3' : undefined} />
      <polyline points={`${p(0.45)} ${x2},${y2} ${p(-0.45)}`} />
    </g>
  );
}

function T({ x, y, children, a = 'middle', s = 11, i = false, b = false }) {
  return (
    <text x={x} y={y} textAnchor={a} fontSize={s} fontStyle={i ? 'italic' : undefined} fontWeight={b ? 700 : undefined} className="dl67s-fig__t">
      {children}
    </text>
  );
}

function Box({ x, y, w, h = 20, label, s = 10.5, r = 4 }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={r} />
      {label != null && <T x={x + w / 2} y={y + h / 2 + 3.8} s={s}>{label}</T>}
    </g>
  );
}

// a small operator circle (+ or ×)
function Op({ cx, cy, sym }) {
  return (
    <g>
      <rect x={cx - 9} y={cy - 9} width={18} height={18} rx={4} />
      <T x={cx} y={cy + 4.5} s={13} b>{sym}</T>
    </g>
  );
}

function Svg({ w, h, label, children }) {
  const hl = useContext(HlCtx);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={`dl67s-fig${hl ? ' dl67s-fig--hl' : ''}`} role="img" aria-label={label} fill="none" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

/* §2 — Figure 17-8: denoising autoencoders */
function Dae() {
  const names = ['Input', 'Hidden 1', 'Hidden 2', 'Hidden 3', 'Output'];
  const w = 78;
  const h = 19;
  // y of each layer box, bottom to top; the noise step sits between Input and Hidden 1
  const ys = [196, 132, 100, 68, 36];
  const col = (cx, noise) => (
    <g>
      {names.map((n, i) => (
        <g key={n}>
          <Box x={cx - w / 2} y={ys[i]} w={w} h={h} label={n} s={10} />
          {i >= 2 && <line x1={cx} y1={ys[i - 1]} x2={cx} y2={ys[i] + h} />}
        </g>
      ))}
      <Arrow x1={cx} y1={ys[4]} x2={cx} y2={ys[4] - 14} head={4} />
      {noise === 'gauss' ? (
        <P k="noise">
          <line x1={cx} y1={ys[0]} x2={cx} y2={173} />
          <Op cx={cx} cy={164} sym="+" />
          <line x1={cx} y1={155} x2={cx} y2={ys[1] + h} />
          <Box x={cx + 26} y={155} w={86} h={h} label="Gaussian noise" s={9.5} />
          <Arrow x1={cx + 26} y1={164} x2={cx + 10} y2={164} head={4} />
        </P>
      ) : (
        <P k="dropout">
          <line x1={cx} y1={ys[0]} x2={cx} y2={174} />
          <Box x={cx - w / 2} y={155} w={w} h={h} label="Dropout" s={10} />
          <line x1={cx} y1={155} x2={cx} y2={ys[1] + h} />
        </P>
      )}
    </g>
  );
  return (
    <Svg w={330} h={236} label="Figure 17-8: two denoising autoencoders drawn bottom to top. Left: Input, then Gaussian noise added (a plus sign), Hidden 1, Hidden 2, Hidden 3, Output. Right: Input, a Dropout layer, Hidden 1, Hidden 2, Hidden 3, Output">
      {col(56, 'gauss')}
      {col(262, 'drop')}
      <T x={56} y={230} s={9.5} i>Gaussian noise</T>
      <T x={262} y={230} s={9.5} i>dropout</T>
    </Svg>
  );
}

/* §3 — Figure 17-11 (left): a variational autoencoder */
function Vae() {
  const cx = 92;
  const w = 78;
  const h = 19;
  const mu = 74;
  const sg = 168;
  return (
    <Svg w={340} h={326} label="Figure 17-11, left, drawn bottom to top: Input, Hidden 1, Hidden 2; Hidden 2 feeds two coding layers, Codings mu and Codings sigma. Sigma is multiplied by Gaussian noise, the product is added to mu, and the sum goes to Hidden 4, Hidden 5 and the Output">
      <g transform="translate(0 24)">
      {/* encoder */}
      <P k="enc">
        <Box x={cx - w / 2} y={280} w={w} h={h} label="Input" />
        <line x1={cx} y1={280} x2={cx} y2={258} />
        <Box x={cx - w / 2} y={239} w={w} h={h} label="Hidden 1" />
        <line x1={cx} y1={239} x2={cx} y2={217} />
        <Box x={cx - w / 2} y={198} w={w} h={h} label="Hidden 2" />
      </P>
      {/* the two coding layers */}
      <P k="codings">
        <Arrow x1={cx - 6} y1={198} x2={mu} y2={168} head={4} />
        <Arrow x1={cx + 6} y1={198} x2={sg - 10} y2={168} head={4} />
        <Box x={mu - 36} y={149} w={72} h={h} label="Codings μ" s={10} />
        <Box x={sg - 36} y={149} w={72} h={h} label="Codings σ" s={10} />
      </P>
      {/* the sampling: σ × noise + μ */}
      <P k="sample">
        <Arrow x1={sg} y1={149} x2={sg} y2={121} head={4} />
        <Op cx={sg} cy={112} sym="×" />
        <Box x={232} y={102} w={78} h={h} label="Gaussian noise" s={9.5} />
        <Arrow x1={232} y1={112} x2={sg + 10} y2={112} head={4} />
        <Arrow x1={sg - 10} y1={112} x2={mu + 10} y2={112} head={4} />
        <Op cx={mu} cy={112} sym="+" />
        <Arrow x1={mu} y1={149} x2={mu} y2={121} head={4} />
      </P>
      <rect x={30} y={92} width={290} height={84} rx={6} strokeDasharray="4 3" />
      {/* decoder */}
      <P k="dec">
        <line x1={mu} y1={103} x2={mu} y2={80} />
        <Box x={mu - w / 2} y={61} w={w} h={h} label="Hidden 4" />
        <line x1={mu} y1={61} x2={mu} y2={45} />
        <Box x={mu - w / 2} y={26} w={w} h={h} label="Hidden 5" />
        <line x1={mu} y1={26} x2={mu} y2={14} />
        <Box x={mu - w / 2} y={-5} w={w} h={h} label="Output" />
        <Arrow x1={mu} y1={-5} x2={mu} y2={-19} head={4} />
      </P>
      </g>
    </Svg>
  );
}

/* §7 — Figure 17-14: a generative adversarial network */
function Gan() {
  const cx = 110;
  return (
    <Svg w={360} h={262} label="Figure 17-14, drawn bottom to top: Noise feeds the Generator (goal: trick the discriminator), which outputs a Fake image. Either the Fake image or a Real image goes into the Discriminator (goal: tell fake from real), which outputs Fake/real">
      <P k="gen">
        <Box x={cx - 46} y={232} w={92} h={20} label="Noise" />
        <Arrow x1={cx} y1={232} x2={cx} y2={213} head={4} />
        <Box x={cx - 46} y={193} w={92} h={20} label="Generator" />
        <path d={`M${cx + 54} 191 q6 0 6 6 v1 q0 4 5 4 q-5 0 -5 4 v1 q0 6 -6 6`} />
        <T x={cx + 72} y={207} a="start" s={9.5}>Goal = trick the discriminator</T>
        <Arrow x1={cx - 50} y1={193} x2={cx - 50} y2={160} head={4} />
        <rect x={cx - 74} y={118} width={48} height={42} rx={3} strokeDasharray="3 2" />
        <T x={cx - 50} y={143} s={10} i>Fake</T>
      </P>
      <P k="real">
        <rect x={cx + 26} y={118} width={48} height={42} rx={3} strokeDasharray="3 2" />
        <T x={cx + 50} y={143} s={10} i>Real</T>
      </P>
      <P k="disc">
        <line x1={cx - 50} y1={118} x2={cx} y2={92} />
        <line x1={cx + 50} y1={118} x2={cx} y2={92} />
        <circle cx={cx} cy={90} r={2.5} />
        <T x={cx} y={108} s={9.5} i>Or</T>
        <Arrow x1={cx} y1={88} x2={cx} y2={70} head={4} />
        <Box x={cx - 56} y={50} w={112} h={20} label="Discriminator" />
        <path d={`M${cx + 64} 48 q6 0 6 6 v1 q0 4 5 4 q-5 0 -5 4 v1 q0 6 -6 6`} />
        <T x={cx + 82} y={64} a="start" s={9.5}>Goal = tell fake from real</T>
        <Arrow x1={cx} y1={50} x2={cx} y2={28} head={4} />
        <T x={cx} y={20} s={10}>Fake/real</T>
      </P>
    </Svg>
  );
}

/* §8 — slides 21–22: the two training phases (this page's drawing) */
function Phases() {
  const half = (x0, title, fakeLabel, realOn, learns) => (
    <g>
      <T x={x0 + 85} y={14} s={10.5} b>{title}</T>
      <Box x={x0 + 4} y={196} w={64} h={20} label="Noise" s={9.5} />
      <Arrow x1={x0 + 36} y1={196} x2={x0 + 36} y2={178} head={4} />
      <P k={learns === 'G' ? 'learn' : 'fixed'}>
        <Box x={x0 + 4} y={158} w={64} h={20} label="Generator" s={9.5} />
      </P>
      <Arrow x1={x0 + 36} y1={158} x2={x0 + 36} y2={140} head={4} />
      <Box x={x0 + 4} y={110} w={64} h={30} />
      <T x={x0 + 36} y={123} s={9}>32 fake</T>
      <T x={x0 + 36} y={135} s={9} b>label {fakeLabel}</T>
      {realOn && (
        <g>
          <Box x={x0 + 104} y={110} w={64} h={30} />
          <T x={x0 + 136} y={123} s={9}>32 real</T>
          <T x={x0 + 136} y={135} s={9} b>label 1</T>
          <line x1={x0 + 136} y1={110} x2={x0 + 92} y2={84} />
        </g>
      )}
      <line x1={x0 + 36} y1={110} x2={x0 + 82} y2={84} />
      <Arrow x1={x0 + 86} y1={82} x2={x0 + 86} y2={70} head={4} />
      <P k={learns === 'D' ? 'learn' : 'fixed'}>
        <Box x={x0 + 36} y={50} w={100} h={20} label="Discriminator" s={9.5} />
      </P>
      <T x={x0 + 86} y={36} s={9} i>{learns === 'D' ? 'learns' : 'frozen'}</T>
      <T x={x0 + 36} y={234} s={9} i>{learns === 'G' ? 'learns' : 'not updated'}</T>
    </g>
  );
  return (
    <Svg w={380} h={244} label="The two training phases. Phase 1: the generator makes 32 fake images labelled 0, 32 real images are labelled 1, and only the discriminator learns. Phase 2: the generator makes 32 fake images labelled 1; the discriminator is frozen and only the generator learns">
      {half(4, 'Phase 1: train the discriminator', 0, true, 'D')}
      {half(200, 'Phase 2: train the generator', 1, false, 'G')}
      <line x1={192} y1={24} x2={192} y2={236} strokeDasharray="2 3" />
    </Svg>
  );
}

const FIGS = {
  dae: Dae,
  vae: Vae,
  gan: Gan,
  phases: Phases,
};

const NO_HL = [];

// sheet: the notebook page's pens (green highlights); lab: accent highlights
export function Diagram({ fig, sheet = false, lab = false, hl = NO_HL }) {
  const Fig = FIGS[fig];
  if (!Fig) return null;
  if (!sheet && !lab) return <Fig />;
  return (
    <span className={lab ? 'dl67s-figwrap dl67s-figwrap--lab' : 'dl67s-figwrap dl67s-figwrap--sheet'}>
      <HlCtx.Provider value={hl}>
        <Fig />
      </HlCtx.Provider>
    </span>
  );
}
