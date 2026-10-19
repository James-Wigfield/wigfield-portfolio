import Scene from '../../scene/Scene';
import { range } from '../../scene/geom';
import fig from '../../figures/cell48_0.png';

/* ============================================================================
   SCENE — six draws from the prior, decoded (the notebook's own figure)
   Six codes z ~ N(0, I) (two of the four codings drawn; positions are
   illustrative, the real draws are not printed) → the decoder → × 5.11 +
   24.70 back to °C (Out [20]) → the notebook's six-sample figure
   (figures/cell48_0.png, Out [23]) uncovered panel by panel. Then the
   notebook's own reading of the six (cell 49) and the 500-sample statistics
   against all 1522 real training sequences (Out [23]).
   Panel boxes are measured from the PNG (axes frames at x 58–519, 538–999,
   1019–1480 and y 66–282, 323–539 of 1490 × 593). Each mask covers its
   panel's whole share of the figure, title, ticks, tick labels and axis
   labels included, so a hidden panel leaves nothing behind (the suptitle
   stays). The masks over the figure
   are white because the figure is white in every theme, and the outlines
   drawn on it use a fixed dark ink for the same reason. Panel 1 is uncovered
   in the decode beat, so the figure never sits on stage as an empty card.
   ========================================================================== */

const W = 800;
const H = 592;
const FX = 20;
const FY = 214;
const FW = 760;
const K = FW / 1490;
const FH = 593 * K;
const COLS = [[54, 523], [534, 1003], [1015, 1484]];
const ROWS = [[36, 286], [294, 543]];
const PANEL = range(6).map((k) => {
  const [c0, c1] = COLS[k % 3];
  const [r0, r1] = ROWS[Math.floor(k / 3)];
  return { x: FX + c0 * K, y: FY + r0 * K, w: (c1 - c0) * K, h: (r1 - r0) * K };
});
// mask extents (PNG px): each panel's share of the figure, decorations included,
// inset 3 px from the figure's edge so its border stays drawn
const MCOLS = [[3, 527], [527, 1008], [1008, 1487]];
const MROWS = [[30, 293], [293, 590]];
const MASK = range(6).map((k) => {
  const [c0, c1] = MCOLS[k % 3];
  const [r0, r1] = MROWS[Math.floor(k / 3)];
  return { x: FX + c0 * K, y: FY + r0 * K, w: (c1 - c0) * K, h: (r1 - r0) * K };
});

// the prior cloud
const PCX = 118;
const PCY = 116;
const U = 28;
// about 4 in 10 draws from a 2-D standard normal land inside 1σ (1 − e^−½ ≈ 0.39), so two of
// the six sit inside it. Codes 3 and 6 decode to the two flattest of the six, and the notebook's
// untested phase-ring idea (12·2) must not be read into made-up positions, so the two inside
// are one flat (3) and one not (4), at about the same distance from the centre and neither
// at it; both sit left of or below their number so the label stays inside the 1σ ring
const PTS = [[0.85, -1.05], [-1.5, 0.6], [0.3, -0.6], [-0.65, 0.35], [1.5, 0.8], [-0.35, 1.25]];
const px = ([u]) => PCX + u * U;
const py = ([, v]) => PCY - v * U;

// the statistics (Out [23])
const STATS = [
  { k: 'mean level, °C', s: '24.5', r: '24.7', off: false },
  { k: 'spread of sequence means', s: '0.62', r: '0.56', off: false },
  { k: 'range per sequence, °C', s: '12.6', r: '17.2', off: true },
  { k: 'smallest range, °C', s: '1.8', r: '14.4', off: true },
  { k: 'range under 10 °C', s: '21%', r: '0%', off: true },
  { k: 'month-to-month change', s: '2.03', r: '2.48', off: true },
];
// the table sits wholly in the right half, so a narrow stage that ends there frames it
const TX = 408;
const TS = 700;
const TR = 786;
const TY = (i) => 81 + i * 19;
const RX = 410; // the notebook's reading, under the figure's right half
const FIG_INK = '#1d1d1d'; // marks on the white figure, every theme
const shown = (k, step) => step >= 2 || (k === 0 && step >= 1); // panel k uncovered

function art(step) {
  const on = (b) => (step >= b ? 1 : 0);
  return (
    <>
      {/* ── the prior ── */}
      <text className="sv-cap" x={24} y={24}>Six codes from N(0, I) · 2 of the 4 codings</text>
      <circle className="sv-faint" cx={PCX} cy={PCY} r={U} strokeDasharray="3 3" />
      <circle className="sv-faint" cx={PCX} cy={PCY} r={2 * U} strokeDasharray="3 3" />
      <line className="sv-grid" x1={PCX - 2.3 * U} x2={PCX + 2.3 * U} y1={PCY} y2={PCY} />
      <line className="sv-grid" x1={PCX} x2={PCX} y1={PCY - 2.3 * U} y2={PCY + 2.3 * U} />
      <text className="sv-lab" x={PCX - U - 3} y={PCY + 13} textAnchor="end">1σ</text>
      <text className="sv-lab" x={PCX - 2 * U - 3} y={PCY + 13} textAnchor="end">2σ</text>
      <text className="sv-lab" x={24} y={40}>in this plane about 4 in 10 draws land inside 1σ</text>
      {PTS.map((p, k) => (
        <g key={k} className={`pr-pt pr-pt${k}`} opacity={on(0)}>
          <circle className="sv-accent-fill" cx={px(p)} cy={py(p)} r={4} />
          <text className="sv-lab-strong" x={px(p) + 7} y={py(p) - 5}>{k + 1}</text>
        </g>
      ))}
      {PTS.map((p, k) => (
        <circle key={k} className={`sv-accent pr-ring pr-ring${k}`} cx={px(p)} cy={py(p)} r={9} strokeWidth="1.6" fill="none" opacity={0} />
      ))}

      {/* ── decoder ── */}
      <g className="pr-dec" opacity={on(1)}>
        <line className="sv-ink2" x1={PCX + 2.4 * U} x2={222} y1={PCY} y2={PCY} strokeWidth="1.2" />
        <path className="sv-ink2" d={`M216 ${PCY - 4}L222 ${PCY}L216 ${PCY + 4}`} strokeWidth="1.2" />
        <path className="sv-box-strong" d={`M226 ${PCY - 18}L300 ${PCY - 46}L300 ${PCY + 46}L226 ${PCY + 18}Z`} />
        <text className="sv-lab-strong" x={263} y={PCY + 4} textAnchor="middle">decoder</text>
        <text className="sv-lab" x={263} y={PCY - 54} textAnchor="middle">4 → 84</text>
        <text className="sv-lab" x={263} y={PCY + 74} textAnchor="middle">× 5.11 + 24.70 → °C</text>
        <path className="sv-ink2" d={`M304 ${PCY}H340V${FY - 8}`} strokeWidth="1.2" />
        <path className="sv-ink2" d={`M336 ${FY - 14}L340 ${FY - 8}L344 ${FY - 14}`} strokeWidth="1.2" />
      </g>

      {/* ── the notebook's figure ── */}
      <g className="pr-fig" opacity={on(1)}>
        <rect x={FX} y={FY} width={FW} height={FH} style={{ fill: '#fff', stroke: 'var(--line)' }} />
        <image href={fig} x={FX} y={FY} width={FW} height={FH} preserveAspectRatio="xMidYMid meet" />
        {MASK.map((p, k) => (
          <rect
            key={k}
            className={`pr-mask pr-mask${k}`}
            x={shown(k, step) ? p.x + p.w : p.x}
            y={p.y}
            width={shown(k, step) ? 0 : p.w}
            height={p.h}
            style={{ fill: '#fff' }}
          />
        ))}
      </g>
      <text className="sv-lab pr-fig" x={FX} y={FY + FH + 15} opacity={on(1)}>the notebook’s figure · Out [23]</text>

      {/* ── the notebook's reading (cell 49) ── */}
      <g className="pr-read" opacity={on(3)}>
        {[2, 5].map((k) => (
          <rect key={k} x={PANEL[k].x - 2} y={PANEL[k].y + 2} width={PANEL[k].w + 4} height={PANEL[k].h} stroke={FIG_INK} strokeWidth="2" fill="none" rx={2} />
        ))}
        {/* under the right half of the figure, next to the outlined panels 3 and 6 */}
        <text className="sv-lab" x={RX} y={FY + FH + 15}>1 starts near a summer peak, 5 in a winter trough</text>
        <text className="sv-lab" x={RX} y={FY + FH + 30}>2 swings 16 to 35 °C, 6 only 19 to 29</text>
        <text className="sv-lab-strong" x={RX} y={FY + FH + 47}>3 and 6 (outlined) swing about 10 to 11 °C,</text>
        <text className="sv-lab-strong" x={RX} y={FY + FH + 62}>less than any real sequence (smallest 14.4)</text>
      </g>

      {/* ── 500 samples against the real data (Out [23]) ── */}
      <g className="pr-tab" opacity={on(4)}>
        <text className="sv-cap" x={TX} y={36}>500 samples against all 1522 real</text>
        <line className="sv-max" x1={TS - 96} x2={TS - 78} y1={56} y2={56} strokeWidth="2" />
        <text className="sv-lab-strong" x={TS} y={60} textAnchor="end">samples</text>
        <line className="sv-faint" x1={TR - 66} x2={TR - 48} y1={56} y2={56} strokeWidth="2" />
        <text className="sv-lab-strong" x={TR} y={60} textAnchor="end">real</text>
        <line className="sv-axis" x1={TX} x2={TR} y1={66} y2={66} />
        {STATS.map((s, i) => (
          <g key={s.k}>
            <circle cx={TX + 4} cy={TY(i) - 4} r={3.2} style={s.off ? { fill: 'var(--dlp2-mark)' } : { fill: 'none', stroke: 'var(--ink-3)', strokeWidth: 1 }} />
            <text className="sv-lab" x={TX + 14} y={TY(i)}>{s.k}</text>
            <text className="sv-num" x={TS} y={TY(i)} textAnchor="end">{s.s}</text>
            <text className="sv-num" x={TR} y={TY(i)} textAnchor="end">{s.r}</text>
            <line className="sv-grid" x1={TX} x2={TR} y1={TY(i) + 7} y2={TY(i) + 7} />
          </g>
        ))}
        <circle cx={TX + 4} cy={TY(6) + 2} r={3.2} style={{ fill: 'var(--dlp2-mark)' }} />
        <text className="sv-lab" x={TX + 14} y={TY(6) + 6}>gives the samples away</text>
      </g>
    </>
  );
}

function build(tl, { q, beat }) {
  tl.set(q('.pr-pt, .pr-dec, .pr-fig, .pr-read, .pr-tab'), { opacity: 0, immediateRender: true }, 0);
  tl.set(q('.pr-ring'), { opacity: 0, immediateRender: true }, 0);
  MASK.forEach((p, k) => tl.set(q(`.pr-mask${k}`), { attr: { x: p.x, width: p.w }, immediateRender: true }, 0));

  // 0 · six codes
  beat(0, 0);
  PTS.forEach((_, k) => {
    tl.fromTo(q(`.pr-pt${k}`), { opacity: 0, scale: 0.4, transformOrigin: '50% 50%' }, { opacity: 1, scale: 1, duration: 0.35, ease: 'back.out(1.3)' }, `b0+=${0.4 + k * 0.28}`);
  });

  // one code lights up and its panel is uncovered; positions carry one offset
  // each (GSAP reads only the first offset of 'b2+=a+=b')
  const uncover = (k, label, off) => {
    const p = MASK[k];
    const pos = (t) => `${label}+=${t.toFixed(3)}`;
    tl.fromTo(q(`.pr-ring${k}`), { opacity: 0 }, { opacity: 1, duration: 0.2, immediateRender: false }, pos(off));
    tl.fromTo(q(`.pr-mask${k}`), { attr: { x: p.x, width: p.w } }, { attr: { x: p.x + p.w, width: 0 }, duration: 0.7, ease: 'power1.inOut', immediateRender: false }, pos(off + 0.1));
    tl.fromTo(q(`.pr-ring${k}`), { opacity: 1 }, { opacity: 0, duration: 0.25, immediateRender: false }, pos(off + 0.7));
  };

  // 1 · decode, back to °C: the figure arrives with code 1's panel
  beat(1, '+=0.6');
  tl.fromTo(q('.pr-dec'), { opacity: 0 }, { opacity: 1, duration: 0.5 }, 'b1');
  tl.fromTo(q('.pr-fig'), { opacity: 0 }, { opacity: 1, duration: 0.5 }, 'b1+=0.6');
  uncover(0, 'b1', 1.0);

  // 2 · the other five, panel by panel
  beat(2, '+=0.6');
  MASK.forEach((_, k) => {
    if (k > 0) uncover(k, 'b2', (k - 1) * 0.85);
  });

  // 3 · the notebook's reading
  beat(3, '+=0.6');
  tl.fromTo(q('.pr-read'), { opacity: 0 }, { opacity: 1, duration: 0.5 }, 'b3');

  // 4 · 500 samples against the real data
  beat(4, '+=1.6');
  tl.fromTo(q('.pr-tab'), { opacity: 0 }, { opacity: 1, duration: 0.5 }, 'b4');
  tl.to({}, { duration: 1.4 });
}

const BEATS = [
  {
    t: 'Six codes from the prior',
    c: 'keras.random.normal draws six codes of 4 numbers each from N(0, I), the distribution the KL term pulled the codings towards.',
    fx: 0,
  },
  {
    t: 'Decode, then back to °C',
    c: 'The decoder turns each code into 84 z-scores, and × 5.11 + 24.70 undoes the scaling from section 10. Code 1 becomes the first panel.',
    fx: 0.2,
  },
  {
    t: 'Panel by panel',
    c: 'Codes 2 to 6 fill the rest of the grid. “sequence k” is the panel’s place in the 2 × 3 grid, not a row of the data.',
    fx: 0.5,
  },
  {
    t: 'What the notebook saw',
    c: 'Seven cycles with peaks about 12 months apart, between about 16 and 35 °C, in different phases, levels and amplitudes. Two of the six swing less than any real sequence.',
    fx: 1,
  },
  {
    t: '500 samples against the real data',
    c: 'The level and its spread are close (0.62 against 0.56, slightly more spread). The ranges, the flat share and the month-to-month steps give the samples away.',
    fx: 1,
  },
];

export default function PriorScene({ id = 'samples' }) {
  return (
    <Scene
      id={id}
      label="Six codes drawn from the standard normal prior are decoded into six 84-month maximum temperature sequences, shown as the notebook's figure panel by panel, then a table of statistics for 500 samples against all real training sequences"
      viewBox={`0 0 ${W} ${H}`}
      beats={BEATS}
      art={art}
      build={build}
      keyframes={[4]}
      schematic="code positions illustrative · figure from Out [23]"
    />
  );
}
