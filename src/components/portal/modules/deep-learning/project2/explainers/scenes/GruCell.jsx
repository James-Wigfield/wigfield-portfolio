import { useMemo } from 'react';
import Scene from '../../scene/Scene';
import { lin, thou } from '../../scene/geom';

/* ============================================================================
   SCENE — inside a GRU cell, one month (schematic) + where its weights sit
   Left: the four GRU equations in the course slides' notation, written in
   the form Keras computes by default (reset_after=True: r scales the whole
   recurrent term, two bias vectors per block; slide 49 applies r(t) to
   h(t−1) first and has one bias per block), the active one lit. Right:
   eight of the layer's units, each on its own −1…+1 number line, so the
   blend h(t) = z ⊗ h(t−1) + (1 − z) ⊗ g(t) is visible unit by unit: the new
   state (filled circle) lands between the old state (hollow circle) and the
   candidate (filled square), z of the way back toward the old one. All three
   are ink, so they are told apart by shape. Gate values are illustrative;
   while the month marker steps through the six years they change from year
   to year and land back on the same picture at month 72. The last beat counts the parameters exactly: each of the 3 blocks (z, r, g)
   holds one row per unit of [input weights | recurrent weights | 2 biases],
   drawn one square per parameter, so 3 × 16 × (2 + 16 + 2) = 960 for the
   first layer and 3 × 16 × (16 + 16 + 2) = 1,632 for the second.
   ========================================================================== */

const W = 800;
const H = 574;
const HP = [0.62, -0.35, 0.1, 0.81, -0.7, 0.28, -0.12, 0.47];
const R = [0.85, 0.2, 0.55, 0.92, 0.4, 0.7, 0.15, 0.6];
const G_TANH = [-0.3, 0.65, 0.48, 0.2, 0.1, -0.55, 0.72, 0.05];
const Z = [0.9, 0.25, 0.6, 0.8, 0.1, 0.5, 0.35, 0.95];
const blend = (g) => HP.map((h, k) => Z[k] * h + (1 - Z[k]) * g[k]);
const UX = (k) => 404 + k * 50;
const vy = lin(1, -1, 150, 330);
const BAR = 34;
const GS = 9; // the candidate's square
// g(t) and h(t) are both ink: shape tells them apart, and the new state's
// circle wears a ring of the surface so it stays visible on top of a square
const H_STYLE = { fill: 'var(--ink)', stroke: 'var(--surface)', strokeWidth: 1.5 };
const REC_OP = 0.6; // recurrent weights lighter; biases are drawn as outlines, so no accent hue is needed
const STRIP0 = 404;
const STRIP1 = UX(7) + 14;
const sx = lin(1, 72, STRIP0, STRIP1);
const EQ_INDENT = 105; // the candidate's second line starts inside its bracket, under x(t)
// print crop for the gate beats: the eight number lines and their key only, so
// the equation column prints once (final frame) and each frame's caption names
// the step. A print frame is full width and at most 104 mm tall (≈ 1.77 : 1); a
// narrower crop would show the equations beside it, so this one is 1.79 : 1 and
// starts right of the longest equation line (x ≈ 314) and above the notes (y 352).
const GATE_BOX = { 2: '352 44 427 307', 4: '352 44 427 307' };

// parameter band: one 4-unit square per parameter, 16 rows (units) per block
const PX = 4;
const BAND_Y = 472; // multiple of PX so the pattern tiles line up with the blocks
const ROWS = 16;

// the candidate's equation is the long one: it wraps, so it keeps clear of the unit chart
const eqs = (act) => [
  { key: 'r', label: 'reset gate', text: 'r(t) = σ(x(t)·Wxr + bxr + h(t−1)·Whr + bhr)' },
  { key: 'g', label: 'candidate', text: `g(t) = ${act}(x(t)·Wxg + bxg`, text2: '+ r(t) ⊗ (h(t−1)·Whg + bhg))' },
  { key: 'z', label: 'update gate', text: 'z(t) = σ(x(t)·Wxz + bxz + h(t−1)·Whz + bhz)' },
  { key: 'h', label: 'new state', text: 'h(t) = z(t) ⊗ h(t−1) + (1 − z(t)) ⊗ g(t)' },
];
// the candidate's values for each activation (ReLU cannot go below zero)
const candidate = (act) => (act === 'relu' ? G_TANH.map((g) => Math.max(0, g)) : G_TANH);
const ACTIVE = { 1: 'r', 2: 'g', 3: 'z', 4: 'h' };
// the equations not being read dim, but stay readable: ink text to 0.62, the
// --ink-3 caps (already light) only to 0.85
const DIM_T = 0.62;
const DIM_C = 0.85;

// beat 5, "Seventy-two times": the month marker steps a year at a time and at
// each year mark the eight units show another month's (illustrative) values,
// each set a consistent blend h = z·h(t−1) + (1 − z)·g; the last mark, month
// 72, is the picture of beats 1–4, so the animation ends on art(last).
const YEARS = 6;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
function yearSets(act) {
  const G = candidate(act);
  const base = { hp: HP, g: G, z: Z, r: R, h: blend(G) };
  const sets = [base];
  for (let j = 1; j < YEARS; j++) {
    const hp = HP.map((v, k) => clamp(v + 0.24 * Math.sin(1.9 * k + 2.7 * j), -0.92, 0.92));
    const g = G.map((v, k) => clamp(v + 0.3 * Math.sin(2.3 * k + 1.6 * j + 1), act === 'relu' ? 0 : -0.92, 0.92));
    const z = Z.map((v, k) => clamp(v + 0.2 * Math.sin(1.3 * k + 2.1 * j + 2), 0.05, 0.97));
    const r = R.map((v, k) => clamp(v + 0.2 * Math.sin(1.7 * k + 2.9 * j + 3), 0.05, 0.97));
    sets.push({ hp, g, z, r, h: hp.map((p, k) => z[k] * p + (1 - z[k]) * g[k]) });
  }
  sets.push(base);
  return sets; // [start (= base), year 1 … year 5, month 72 (= base)]
}

// one block: [input weights | recurrent weights | 2 biases] × 16 rows
function blockSegs(x0, nIn, units) {
  return [
    { k: 'x', x: x0, w: nIn * PX },
    { k: 'h', x: x0 + nIn * PX, w: units * PX },
    { k: 'b', x: x0 + (nIn + units) * PX, w: 2 * PX },
  ];
}

function makeArt(units, act, nIn) {
  const G = candidate(act);
  const HN = blend(G);
  const EQS = eqs(act);
  const perBlock1 = units * (nIn + units + 2);
  const perBlock2 = units * (units + units + 2);
  const L1 = [0, 1, 2].map((b) => ({ name: ['z', 'r', 'g'][b], segs: blockSegs(24 + b * (nIn + units + 2 + 5) * PX, nIn, units) }));
  const L2x = 24 + 3 * (nIn + units + 2 + 5) * PX + 4 * PX;
  const L2 = blockSegs(L2x, units, units);
  const SUMX = L2x + (2 * units + 2) * PX + 7 * PX;
  return function art(step, uid) {
    const lit = (key) => step >= 5 || ACTIVE[step] === key;
    const pat = (k) => `url(#${uid}p${k})`;
    const band = step >= 6;
    return (
      <>
        <defs>
          <pattern id={`${uid}px`} width={PX} height={PX} patternUnits="userSpaceOnUse">
            <rect width={PX - 0.9} height={PX - 0.9} style={{ fill: 'var(--ink)' }} />
          </pattern>
          <pattern id={`${uid}ph`} width={PX} height={PX} patternUnits="userSpaceOnUse">
            <rect width={PX - 0.9} height={PX - 0.9} style={{ fill: 'var(--ink-3)', opacity: REC_OP }} />
          </pattern>
          <pattern id={`${uid}pb`} width={PX} height={PX} patternUnits="userSpaceOnUse">
            <rect x={0.5} y={0.5} width={PX - 1.9} height={PX - 1.9} style={{ fill: 'none', stroke: 'var(--ink)', strokeWidth: 0.9 }} />
          </pattern>
        </defs>

        {/* ── equations ── */}
        <text className="sv-cap" x={24} y={24}>GRU cell · one month</text>
        <g className="gc-in" opacity={step >= 0 ? 1 : 0}>
          <text className="sv-lab" x={24} y={62}>x(t)  this month’s [min, max] as z-scores</text>
          <text className="sv-lab" x={24} y={78}>h(t−1)  the state left by last month</text>
        </g>
        {EQS.map((e, j) => (
          <g key={e.key} className={`gc-eq gc-eq-${e.key}`}>
            <circle className="sv-accent-fill gc-eqdot" cx={30} cy={120 + j * 62 - 4} r={3.5} opacity={step < 5 && ACTIVE[step] === e.key ? 1 : 0} />
            <text className="sv-cap gc-eqc" x={42} y={120 + j * 62 - 1} opacity={lit(e.key) ? 1 : DIM_C}>{e.label}</text>
            <text className="sv-num gc-eqt" x={24} y={120 + j * 62 + 19} style={{ fontSize: 11 }} opacity={lit(e.key) ? 1 : DIM_T}>{e.text}</text>
            {e.text2 && (
              <text className="sv-num gc-eqt" x={EQ_INDENT} y={120 + j * 62 + 34} style={{ fontSize: 11 }} opacity={lit(e.key) ? 1 : DIM_T}>{e.text2}</text>
            )}
          </g>
        ))}
        <text className="sv-lab" x={24} y={360}>Keras default reset_after=True: r(t) scales the</text>
        <text className="sv-lab" x={24} y={374}>whole recurrent term, so each block has two biases;</text>
        <text className="sv-lab" x={24} y={388}>slide 49 applies r(t) first, one bias per block</text>
        <text className="sv-lab" x={24} y={404}>⊗ element-wise product · σ squashes to 0…1</text>
        <text className="sv-lab" x={24} y={418}>{act === 'relu' ? 'relu keeps positives, zeroes negatives' : 'tanh squashes to −1…+1'}</text>

        {/* ── units ── */}
        {/* set under the units like an axis title: the top-right corner is the schematic badge's */}
        <text className="sv-cap" x={(UX(0) + UX(7)) / 2} y={368} textAnchor="middle">8 of the {units} units</text>
        <text className="sv-lab" x={STRIP0 - 22} y={66} textAnchor="end">r</text>
        <text className="sv-lab" x={STRIP0 - 22} y={92} textAnchor="end">z</text>
        <text className="sv-lab" x={STRIP0 - 22} y={vy(1) + 4} textAnchor="end">+1</text>
        <text className="sv-lab" x={STRIP0 - 22} y={vy(0) + 4} textAnchor="end">0</text>
        <text className="sv-lab" x={STRIP0 - 22} y={vy(-1) + 4} textAnchor="end">−1</text>
        <line className="sv-grid" x1={STRIP0 - 16} x2={STRIP1} y1={vy(0)} y2={vy(0)} />
        {HP.map((hp, k) => {
          const cx = UX(k);
          return (
            <g key={k}>
              <rect className="sv-fill-ground2" x={cx - BAR / 2} y={58} width={BAR} height={9} />
              <rect className="sv-accent-fill gc-r" x={cx - BAR / 2} y={58} width={step >= 1 ? BAR * R[k] : 0} height={9} />
              <rect className="sv-fill-ground2" x={cx - BAR / 2} y={84} width={BAR} height={9} />
              <rect className="gc-z" style={{ fill: 'var(--ink-2)' }} x={cx - BAR / 2} y={84} width={step >= 3 ? BAR * Z[k] : 0} height={9} />
              <line className="sv-axis" x1={cx} x2={cx} y1={vy(1)} y2={vy(-1)} />
              <line className="sv-axis" x1={cx - 4} x2={cx + 4} y1={vy(1)} y2={vy(1)} />
              <line className="sv-axis" x1={cx - 4} x2={cx + 4} y1={vy(-1)} y2={vy(-1)} />
              <line className="sv-ink gc-link" x1={cx} x2={cx} y1={vy(hp)} y2={vy(HN[k])} strokeWidth="2" opacity={step >= 4 ? 0.55 : 0} />
              <circle className="gc-hp" cx={cx} cy={vy(hp)} r={6} style={{ fill: 'var(--surface)', stroke: 'var(--ink-2)', strokeWidth: 1.6 }} opacity={step >= 0 ? 1 : 0} />
              <rect className="sv-accent-fill gc-g" x={cx - GS / 2} y={vy(G[k]) - GS / 2} width={GS} height={GS} opacity={step >= 2 ? 1 : 0} />
              <circle className="gc-h" cx={cx} cy={vy(HN[k])} r={4.8} style={H_STYLE} opacity={step >= 4 ? 1 : 0} />
              <text className="sv-lab" x={cx} y={vy(-1) + 18} textAnchor="middle">u{k + 1}</text>
            </g>
          );
        })}
        <g className="gc-key">
          <circle cx={STRIP0 - 6} cy={128} r={4.5} style={{ fill: 'var(--surface)', stroke: 'var(--ink-2)', strokeWidth: 1.4 }} />
          <text className="sv-lab" x={STRIP0 + 4} y={132}>h(t−1)</text>
          <rect className="sv-accent-fill" x={STRIP0 + 62} y={124} width={8} height={8} />
          <text className="sv-lab" x={STRIP0 + 76} y={132}>g(t) candidate</text>
          <circle cx={STRIP0 + 186} cy={128} r={4.2} style={H_STYLE} />
          <text className="sv-lab" x={STRIP0 + 196} y={132}>h(t) new state</text>
        </g>

        {/* ── the same cell, 72 times ── */}
        <g className="gc-strip" opacity={step >= 5 ? 1 : 0}>
          <line className="sv-axis" x1={STRIP0} x2={STRIP1} y1={392} y2={392} />
          {Array.from({ length: 72 }, (_, i) => (
            <line key={i} className="sv-axis" x1={sx(i + 1)} x2={sx(i + 1)} y1={388} y2={(i + 1) % 12 === 0 ? 398 : 392} />
          ))}
          <rect className="sv-accent-fill gc-strip-mark" x={sx(72) - 3} y={383} width={6} height={18} />
          <text className="sv-lab" x={STRIP0} y={416}>month 1</text>
          <text className="sv-lab" x={STRIP1} y={416} textAnchor="end">month 72 → final state</text>
        </g>

        {/* ── where the weights sit ── */}
        <g className="gc-band" opacity={band ? 1 : 0}>
          <line className="sv-grid" x1={24} x2={W - 24} y1={430} y2={430} />
          <text className="sv-cap" x={24} y={447}>Where the weights sit · exact count · one square per parameter, one row per unit</text>
          {L1.map((b) => (
            <text key={b.name} className="sv-lab-strong" x={b.segs[0].x} y={BAND_Y - 7}>{b.name} block</text>
          ))}
          <text className="sv-lab-strong" x={L2x} y={BAND_Y - 7}>gru_1 · one of its 3 blocks</text>
          {[
            { x: 24, st: { fill: 'var(--ink)' }, t: `${nIn} input weights` },
            { x: 150, st: { fill: 'var(--ink-3)', opacity: REC_OP }, t: `${units} recurrent` },
            { x: 256, st: { fill: 'none', stroke: 'var(--ink)', strokeWidth: 1.2 }, t: '2 biases', inset: 0.6 },
          ].map((k) => (
            <g key={k.x}>
              <rect x={k.x + (k.inset || 0)} y={BAND_Y + ROWS * PX + 10 + (k.inset || 0)} width={8 - 2 * (k.inset || 0)} height={8 - 2 * (k.inset || 0)} style={k.st} />
              <text className="sv-lab" x={k.x + 13} y={BAND_Y + ROWS * PX + 18}>{k.t}</text>
            </g>
          ))}
        </g>
        {[...L1.flatMap((b) => b.segs), ...L2].map((s, i) => (
          <rect key={i} className="gc-seg" data-w={s.w} x={s.x} y={BAND_Y} width={band ? s.w : 0} height={ROWS * PX} fill={pat(s.k)} />
        ))}
        <g className="gc-sum" opacity={band ? 1 : 0}>
          <text className="sv-num" x={SUMX} y={BAND_Y + 12}>gru</text>
          <text className="sv-num" x={SUMX + 48} y={BAND_Y + 12}>3 × {units} × ({nIn} + {units} + 2) = {thou(3 * perBlock1)}</text>
          <text className="sv-num" x={SUMX} y={BAND_Y + 32}>gru_1</text>
          <text className="sv-num" x={SUMX + 48} y={BAND_Y + 32}>3 × {units} × ({units} + {units} + 2) = {thou(3 * perBlock2)}</text>
          <text className="sv-lab" x={SUMX} y={BAND_Y + 54}>3 × (units·input + units² + 2·units)</text>
          <text className="sv-lab" x={SUMX} y={BAND_Y + 70}>gru_1 reads {units} numbers a month, not {nIn}</text>
        </g>
      </>
    );
  };
}

// a second tween on the same element must not render its from-state when the
// timeline is built (fromTo defaults to immediateRender: true), or the later
// state leaks into beat 0
const LATER = { immediateRender: false };

const makeBuild = (act) => function build(tl, { q, beat }) {
  const G = candidate(act);
  const HN = blend(G);
  const dot = (k) => q(`.gc-eq-${k} .gc-eqdot`);
  // light (on) or dim one equation: its ink lines and its cap; `later` for every
  // tween after an element's first
  const light = (k, on, at, later = false, duration = 0.3) => {
    [['.gc-eqt', DIM_T], ['.gc-eqc', DIM_C]].forEach(([sel, dim]) =>
      tl.fromTo(q(`.gc-eq-${k} ${sel}`), { opacity: on ? dim : 1 }, { opacity: on ? 1 : dim, duration, ...(later ? LATER : {}) }, at),
    );
  };
  tl.set(q('.gc-eqt'), { opacity: DIM_T, immediateRender: true }, 0);
  tl.set(q('.gc-eqc'), { opacity: DIM_C, immediateRender: true }, 0);
  tl.set(q('.gc-eqdot, .gc-g, .gc-h, .gc-link, .gc-strip, .gc-hp, .gc-in, .gc-band, .gc-sum'), { opacity: 0, immediateRender: true }, 0);
  tl.set(q('.gc-r, .gc-z, .gc-seg'), { attr: { width: 0 }, immediateRender: true }, 0);

  beat(0, 0);
  tl.fromTo(q('.gc-in'), { opacity: 0 }, { opacity: 1, duration: 0.5 }, 'b0');
  tl.fromTo(q('.gc-hp'), { opacity: 0, scale: 0.4, transformOrigin: '50% 50%' }, { opacity: 1, scale: 1, duration: 0.45, stagger: 0.07, ease: 'back.out(1.3)' }, 'b0+=0.2');

  beat(1, '+=0.5');
  light('r', true, 'b1');
  tl.fromTo(dot('r'), { opacity: 0 }, { opacity: 1, duration: 0.3 }, 'b1');
  q('.gc-r').forEach((el, k) => tl.fromTo(el, { attr: { width: 0 } }, { attr: { width: BAR * R[k] }, duration: 0.6, ease: 'power2.out' }, `b1+=${0.15 + k * 0.05}`));

  beat(2, '+=0.8');
  light('r', false, 'b2', true);
  tl.fromTo(dot('r'), { opacity: 1 }, { opacity: 0, duration: 0.3, ...LATER }, 'b2');
  light('g', true, 'b2');
  tl.fromTo(dot('g'), { opacity: 0 }, { opacity: 1, duration: 0.3 }, 'b2');
  q('.gc-g').forEach((el, k) =>
    tl.fromTo(el, { opacity: 0, attr: { y: vy(0) - GS / 2 } }, { opacity: 1, attr: { y: vy(G[k]) - GS / 2 }, duration: 0.6, ease: 'power3.out' }, `b2+=${0.15 + k * 0.05}`),
  );

  beat(3, '+=0.8');
  light('g', false, 'b3', true);
  tl.fromTo(dot('g'), { opacity: 1 }, { opacity: 0, duration: 0.3, ...LATER }, 'b3');
  light('z', true, 'b3');
  tl.fromTo(dot('z'), { opacity: 0 }, { opacity: 1, duration: 0.3 }, 'b3');
  q('.gc-z').forEach((el, k) => tl.fromTo(el, { attr: { width: 0 } }, { attr: { width: BAR * Z[k] }, duration: 0.6, ease: 'power2.out' }, `b3+=${0.15 + k * 0.05}`));

  beat(4, '+=0.8');
  light('z', false, 'b4', true);
  tl.fromTo(dot('z'), { opacity: 1 }, { opacity: 0, duration: 0.3, ...LATER }, 'b4');
  light('h', true, 'b4');
  tl.fromTo(dot('h'), { opacity: 0 }, { opacity: 1, duration: 0.3 }, 'b4');
  q('.gc-h').forEach((el, k) =>
    tl.fromTo(el, { opacity: 0, attr: { cy: vy(HP[k]) } }, { opacity: 1, attr: { cy: vy(HN[k]) }, duration: 0.9, ease: 'power2.inOut' }, `b4+=${0.2 + k * 0.06}`),
  );
  q('.gc-link').forEach((el, k) =>
    tl.fromTo(el, { opacity: 0, attr: { y2: vy(HP[k]) } }, { opacity: 0.55, attr: { y2: vy(HN[k]) }, duration: 0.9, ease: 'power2.inOut' }, `b4+=${0.2 + k * 0.06}`),
  );

  beat(5, '+=1');
  tl.fromTo(dot('h'), { opacity: 1 }, { opacity: 0, duration: 0.3, ...LATER }, 'b5');
  ['r', 'g', 'z'].forEach((k) => light(k, true, 'b5', true, 0.4));
  tl.fromTo(q('.gc-strip'), { opacity: 0 }, { opacity: 1, duration: 0.4 }, 'b5');
  // a year per step: the marker moves on and every unit shows that month's values
  const sets = yearSets(act);
  const els = {
    r: q('.gc-r'),
    z: q('.gc-z'),
    g: q('.gc-g'),
    hp: q('.gc-hp'),
    h: q('.gc-h'),
    link: q('.gc-link'),
  };
  for (let j = 1; j <= YEARS; j++) {
    const a = sets[j - 1];
    const b = sets[j];
    const at = `b5+=${(0.35 + (j - 1) * 0.45).toFixed(2)}`;
    const step = { duration: 0.32, ease: 'power2.inOut', ...LATER };
    tl.fromTo(
      q('.gc-strip-mark'),
      { attr: { x: sx(Math.max(1, 12 * (j - 1))) - 3 } },
      { attr: { x: sx(12 * j) - 3 }, ...step, immediateRender: j === 1 },
      at,
    );
    for (let k = 0; k < HP.length; k++) {
      tl.fromTo(els.r[k], { attr: { width: BAR * a.r[k] } }, { attr: { width: BAR * b.r[k] }, ...step }, at);
      tl.fromTo(els.z[k], { attr: { width: BAR * a.z[k] } }, { attr: { width: BAR * b.z[k] }, ...step }, at);
      tl.fromTo(els.g[k], { attr: { y: vy(a.g[k]) - GS / 2 } }, { attr: { y: vy(b.g[k]) - GS / 2 }, ...step }, at);
      tl.fromTo(els.hp[k], { attr: { cy: vy(a.hp[k]) } }, { attr: { cy: vy(b.hp[k]) }, ...step }, at);
      tl.fromTo(els.h[k], { attr: { cy: vy(a.h[k]) } }, { attr: { cy: vy(b.h[k]) }, ...step }, at);
      tl.fromTo(els.link[k], { attr: { y1: vy(a.hp[k]), y2: vy(a.h[k]) } }, { attr: { y1: vy(b.hp[k]), y2: vy(b.h[k]) }, ...step }, at);
    }
  }

  beat(6, '+=0.6');
  tl.fromTo(q('.gc-band'), { opacity: 0 }, { opacity: 1, duration: 0.4 }, 'b6');
  q('.gc-seg').forEach((el, i) => {
    const w = Number(el.getAttribute('data-w'));
    tl.fromTo(el, { attr: { width: 0 } }, { attr: { width: w }, duration: 0.45, ease: 'power1.out' }, `b6+=${(0.3 + i * 0.16).toFixed(2)}`);
  });
  tl.fromTo(q('.gc-sum text'), { opacity: 0 }, { opacity: 1, duration: 0.4, stagger: 0.35 }, 'b6+=1.6');
  tl.fromTo(q('.gc-sum'), { opacity: 0 }, { opacity: 1, duration: 0.01 }, 'b6+=1.6');
  tl.to({}, { duration: 1.2 });
};

// narrow screens show about half the stage: beats 1–5 frame the unit chart with
// its r / z / ±1 labels; the last beat goes to the right edge for the sums
const FX_UNITS = 0.93;
const beats = (act, units, nIn) => [
  { t: 'Two inputs', fx: 0, c: 'Each month the cell gets this month’s min and max as z-scores, x(t), and its own state from last month, h(t−1): one number per unit.' },
  { t: 'Reset gate r', fx: FX_UNITS, c: 'A sigmoid turns x(t) and h(t−1) into a 0–1 value per unit: how much of the old state’s contribution the candidate gets to use.' },
  act === 'relu'
    ? { t: 'Candidate g', fx: FX_UNITS, c: 'A ReLU layer proposes a new value per unit (the squares), zero or positive, built from x(t) and the old state’s contribution, scaled by r.' }
    : { t: 'Candidate g', fx: FX_UNITS, c: 'A tanh layer proposes a new value per unit (the squares) in −1…+1, built from x(t) and the old state’s contribution, scaled by r.' },
  { t: 'Update gate z', fx: FX_UNITS, c: 'Computed alongside r from the same inputs (the slides list it first), the update gate gives each unit a keep fraction z between 0 and 1.' },
  { t: 'Blend', fx: FX_UNITS, c: 'Each unit keeps z of its old value (hollow circle) and 1 − z of the candidate (square), giving the new state (filled circle). High z holds memory; low z jumps to the candidate.' },
  {
    t: 'Seventy-two times',
    fx: FX_UNITS,
    c: 'The same weights run once per month, so the gates and the state move as the months go by. The state left after month 72 summarises the whole input window.',
  },
  {
    t: 'Count the weights',
    fx: 1, // the parameter sums sit at the right edge
    c: `Each block gives a unit a weight per input and state value, plus two biases: 3 × ${units} × (${nIn} + ${units} + 2) = ${thou(3 * units * (nIn + units + 2))}. Layer 2 reads ${units} inputs: ${thou(3 * units * (2 * units + 2))}.`,
  },
];

export default function GruCellScene({ id = 'gru-cell', units = 16, act = 'tanh', inputs = 2, note }) {
  const art = useMemo(() => makeArt(units, act, inputs), [units, act, inputs]);
  const build = useMemo(() => makeBuild(act), [act]);
  const BEATS = useMemo(() => beats(act, units, inputs), [act, units, inputs]);
  return (
    <Scene
      id={id}
      label={`Schematic of a GRU cell: the reset gate, candidate, update gate and blend for eight of the ${units} units, repeated over 72 months, then the layer's parameters counted block by block`}
      viewBox={`0 0 ${W} ${H}`}
      beats={BEATS}
      art={art}
      build={build}
      keyframes={[2, 4, 6]}
      // beats 2 and 4 print cropped to the unit number lines; the equations print once, in frame 7
      frameBoxes={GATE_BOX}
      schematic="gate and state values illustrative"
      note={note}
    />
  );
}
