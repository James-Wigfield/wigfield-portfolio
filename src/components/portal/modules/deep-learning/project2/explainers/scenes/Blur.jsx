import Scene from '../../scene/Scene';
import { lin, range, seriesPath } from '../../scene/geom';
import { SERIES } from '../../data/series';

/* ============================================================================
   SCENE — why the samples come out smooth, and why some come out flat
   Top: ten real 84-month windows of Swanbourne's maximums that all start in
   the same calendar month (record offsets 0, 24, … 216, so 12-month
   multiples) and their month-by-month mean. The mean is what a squared-error
   decoder settles on for a code that cannot tell those sequences apart: the
   cycle survives, the single hot months and double peaks average away.
   Bottom: the notebook's hypothesis for the flat samples (cell 49, "I have
   not checked this"). The phase is circular, so the codes of real windows
   would lie on a ring; a code at the centre is as close to every phase as to
   any other, and the mean over four phases a quarter-year apart (windows at
   offsets 0, 3, 6, 9) is nearly flat. Both curves are arithmetic on real data, not VAE output; the
   plane of two codings is schematic. Only the notebook's numbers are quoted
   (Out [23]).
   ========================================================================== */

const W = 800;
const H = 572;
const SWAN = SERIES.swanbourne.map((r) => r[1]);
const win = (o) => SWAN.slice(o, o + 84);
const mean = (rows) => range(84).map((i) => rows.reduce((a, r) => a + r[i], 0) / rows.length);
const SAME = range(10).map((k) => win(k * 24));
const SAME_MEAN = mean(SAME);
const PH_OFF = [0, 3, 6, 9];
const PHASES = PH_OFF.map((o) => win(o));
const PHASE_MEAN = mean(PHASES);

// top chart
const T = { x0: 60, x1: 530, y0: 48, y1: 204 };
const tx = lin(1, 84, T.x0, T.x1);
const ty = lin(36, 15, T.y0, T.y1);
// bottom chart
const B = { x0: 300, x1: 780, y0: 300, y1: 450 };
const bx = lin(1, 84, B.x0, B.x1);
const by = lin(36, 15, B.y0, B.y1);
// the plane of two codings (schematic)
const LC = { x: 140, y: 400 };
const SIG = 40;
const RING = 58;
const RX = 562; // top readout column
const ringPt = (o) => {
  const a = -Math.PI / 2 + (o * 2 * Math.PI) / 12;
  return [LC.x + RING * Math.cos(a), LC.y + RING * Math.sin(a)];
};
const ringPath = `M${LC.x} ${LC.y - RING}A${RING} ${RING} 0 1 1 ${LC.x - 0.01} ${LC.y - RING}`;

function Axes({ x, y, box }) {
  return (
    <g>
      {[20, 30].map((t) => (
        <g key={t}>
          <line className="sv-grid" x1={box.x0 - 4} x2={box.x1} y1={y(t)} y2={y(t)} />
          <text className="sv-lab" x={box.x0 - 8} y={y(t) + 4} textAnchor="end">{t}°</text>
        </g>
      ))}
      <line className="sv-axis" x1={box.x0 - 4} x2={box.x1} y1={box.y1} y2={box.y1} />
      {[1, 12, 24, 36, 48, 60, 72, 84].map((m) => (
        <text key={m} className="sv-lab" x={x(m)} y={box.y1 + 14} textAnchor="middle">{m}</text>
      ))}
    </g>
  );
}

function art(step) {
  const on = (b) => (step >= b ? 1 : 0);
  return (
    <>
      {/* ── top: averaging plausible sequences ── */}
      <text className="sv-cap" x={24} y={24}>Many real sequences, one code</text>
      <Axes x={tx} y={ty} box={T} />
      {SAME.map((w, k) => (
        <path key={k} className="sv-faint bl-real" d={seriesPath(w, tx, ty)} strokeWidth="1" strokeLinejoin="round" opacity={0.75} />
      ))}
      {/* 2.6 only for the two means (here and bl-flat), the page's emphasis width; a single series is 2 */}
      <path className="sv-line sv-max bl-mean" d={seriesPath(SAME_MEAN, tx, ty)} strokeWidth="2.6" opacity={on(1)} />
      <text className="sv-lab" x={T.x1} y={T.y1 + 28} textAnchor="end">month of the window</text>

      <g className="bl-r0">
        <line className="sv-faint" x1={RX} x2={RX + 18} y1={56} y2={56} strokeWidth="1" />
        <text className="sv-lab-strong" x={RX + 24} y={60}>10 real windows</text>
        <text className="sv-lab" x={RX} y={78}>Swanbourne, each starting</text>
        <text className="sv-lab" x={RX} y={92}>in the same calendar month</text>
      </g>
      <g className="bl-r1" opacity={on(1)}>
        <line className="sv-max" x1={RX} x2={RX + 18} y1={116} y2={116} strokeWidth="2.6" />
        <text className="sv-lab-strong" x={RX + 24} y={120}>their monthly mean</text>
        <text className="sv-lab" x={RX} y={138}>what squared error picks</text>
        <text className="sv-lab" x={RX} y={152}>when a code can’t tell</text>
        <text className="sv-lab" x={RX} y={166}>them apart</text>
        <text className="sv-cap" x={RX} y={190}>500 samples vs real</text>
        <text className="sv-lab" x={RX} y={206}>range 12.6 against 17.2 °C</text>
        <text className="sv-lab" x={RX} y={220}>month to month 2.03 vs 2.48</text>
        <text className="sv-lab" x={RX} y={234}>Out [23]</text>
      </g>

      {/* ── bottom: the phase ring (the notebook's hypothesis) ── */}
      <g className="bl-b2" opacity={on(2)}>
        <line className="sv-grid" x1={24} x2={W - 20} y1={242} y2={242} />
        <text className="sv-cap" x={24} y={264}>Flat samples · the notebook’s hypothesis</text>
        <text className="sv-lab" x={W - 20} y={264} textAnchor="end">not checked in the notebook (cell 49)</text>
        <circle cx={LC.x} cy={LC.y} r={SIG} style={{ fill: 'var(--ink-3)', fillOpacity: 0.18 }} />
        <circle className="sv-faint" cx={LC.x} cy={LC.y} r={2 * SIG} strokeDasharray="3 3" />
        <text className="sv-lab" x={LC.x - 2 * SIG + 2} y={LC.y + 2 * SIG + 4} textAnchor="end">prior</text>
        <Axes x={bx} y={by} box={B} />
        <text className="sv-lab" x={LC.x} y={LC.y + 2 * SIG + 22} textAnchor="middle">2 of the codings</text>
      </g>
      <path className="sv-ink2 bl-ring" d={ringPath} strokeWidth="1.3" opacity={on(2)} />
      {range(12).map((o) => {
        const [x, y] = ringPt(o);
        const big = PH_OFF.includes(o);
        return <circle key={o} className="bl-dot" cx={x} cy={y} r={o === 0 ? 5.5 : big ? 4 : 2.5} style={{ fill: o === 0 ? 'var(--ink)' : big ? 'var(--ink-2)' : 'var(--ink-3)' }} opacity={on(2)} />;
      })}
      <g className="bl-b2" opacity={on(2)}>
        <text className="sv-lab" x={24} y={290}>codes of real windows on a ring,</text>
        <text className="sv-lab" x={24} y={304}>one point per start month</text>
      </g>
      {PHASES.map((w, o) => (
        <path key={o} className="sv-faint bl-ph" d={seriesPath(w, bx, by)} strokeWidth="0.9" opacity={on(2) * 0.6} />
      ))}
      <path className="sv-ink bl-ph0" d={seriesPath(PHASES[0], bx, by)} strokeWidth="2" strokeLinejoin="round" opacity={on(2)} />
      {/* the key stacks down the chart's left edge, so a narrow stage framing the
          ring's centre and the start of the chart holds all of it */}
      <g className="bl-b2" opacity={on(2)}>
        <line className="sv-ink" x1={B.x0} x2={B.x0 + 18} y1={B.y1 + 28} y2={B.y1 + 28} strokeWidth="2" />
        <text className="sv-lab" x={B.x0 + 24} y={B.y1 + 32}>big dot’s window</text>
        <line className="sv-faint" x1={B.x0} x2={B.x0 + 18} y1={B.y1 + 43} y2={B.y1 + 43} strokeWidth="1" />
        <text className="sv-lab" x={B.x0 + 24} y={B.y1 + 47}>4 start months, 3 apart</text>
      </g>

      <g className="bl-b3" opacity={on(3)}>
        <circle className="sv-accent-fill" cx={LC.x} cy={LC.y} r={5} />
        <text className="sv-lab-strong" x={LC.x} y={LC.y + 20} textAnchor="middle">centre</text>
        <path className="sv-accent" d={`M${LC.x + 8} ${LC.y}H${B.x0 - 12}`} strokeWidth="1.2" />
        <path className="sv-accent" d={`M${B.x0 - 18} ${LC.y - 4}L${B.x0 - 12} ${LC.y}L${B.x0 - 18} ${LC.y + 4}`} strokeWidth="1.2" />
      </g>
      <path className="sv-line sv-max bl-flat" d={seriesPath(PHASE_MEAN, bx, by)} strokeWidth="2.6" opacity={on(3)} />
      <g className="bl-b3" opacity={on(3)}>
        <line className="sv-max" x1={B.x0} x2={B.x0 + 18} y1={B.y1 + 58} y2={B.y1 + 58} strokeWidth="2.6" />
        <text className="sv-lab" x={B.x0 + 24} y={B.y1 + 62}>their mean</text>
        <text className="sv-lab-strong" x={B.x0} y={B.y1 + 84}>21% of 500 samples swing</text>
        <text className="sv-lab-strong" x={B.x0} y={B.y1 + 99}>under 10 °C; the flattest</text>
        <text className="sv-lab-strong" x={B.x0} y={B.y1 + 114}>is 1.8 · Out [23]</text>
      </g>
    </>
  );
}

function build(tl, { q, beat }) {
  // the dash pattern is offset 2 past the start so round caps leave no dot before a line draws
  // at = [label, offset]: each position carries one offset (GSAP reads only
  // the first offset of 'b2+=a+=b')
  const draw = (els, [label, off], dur, stagger = 0) =>
    els.forEach((p, k) => {
      const L = p.getTotalLength();
      tl.fromTo(p, { strokeDasharray: `${L} ${L + 4}`, strokeDashoffset: L + 2 }, { strokeDashoffset: 0, duration: dur, ease: 'power1.inOut', immediateRender: true }, `${label}+=${(off + k * stagger).toFixed(3)}`);
    });
  const fade = (sel, at, dur = 0.4, to = 1) => tl.fromTo(q(sel), { opacity: 0 }, { opacity: to, duration: dur }, at);
  tl.set(q('.bl-r0, .bl-r1, .bl-mean, .bl-b2, .bl-ring, .bl-dot, .bl-ph, .bl-ph0, .bl-b3, .bl-flat'), { opacity: 0, immediateRender: true }, 0);

  // 0 · ten real windows
  beat(0, 0);
  draw(q('.bl-real'), ['b0', 0], 1.3, 0.12);
  fade('.bl-r0', 'b0+=0.6');

  // 1 · their mean
  beat(1, '+=0.6');
  tl.set(q('.bl-mean'), { opacity: 1 }, 'b1');
  draw(q('.bl-mean'), ['b1', 0], 1.4);
  fade('.bl-r1', 'b1+=1.0', 0.5);

  // 2 · the ring
  beat(2, '+=1.4');
  fade('.bl-b2', 'b2', 0.5);
  tl.set(q('.bl-ring'), { opacity: 1 }, 'b2+=0.3');
  draw(q('.bl-ring'), ['b2', 0.3], 1.0);
  q('.bl-dot').forEach((d, o) => tl.fromTo(d, { opacity: 0 }, { opacity: 1, duration: 0.2 }, `b2+=${0.4 + o * 0.08}`));
  tl.set(q('.bl-ph'), { opacity: 0.6 }, 'b2+=1.2');
  draw(q('.bl-ph'), ['b2', 1.2], 0.9, 0.05);
  tl.set(q('.bl-ph0'), { opacity: 1 }, 'b2+=1.6');
  draw(q('.bl-ph0'), ['b2', 1.6], 1.0);

  // 3 · the centre
  beat(3, '+=1.2');
  fade('.bl-b3', 'b3', 0.5);
  tl.set(q('.bl-flat'), { opacity: 1 }, 'b3+=0.4');
  draw(q('.bl-flat'), ['b3', 0.4], 1.3);
  tl.to({}, { duration: 1.4 });
}

const BEATS = [
  {
    t: 'Many sequences, one code',
    c: 'Ten real windows that start in the same calendar month share the cycle but not the weather: a hot month or a double peak lands somewhere different in each.',
    fx: 0,
  },
  {
    t: 'Squared error takes the mean',
    c: 'If a code cannot tell such sequences apart, the output with the lowest MSE is their month-by-month mean. The cycle survives and the roughness averages away: the usual VAE blur.',
    fx: 1,
  },
  {
    t: 'Phase lives on a ring',
    c: 'The start month is circular, so the notebook supposes the encoder lays the real codes on a ring in two codings, each point a different phase.',
    fx: 0,
  },
  {
    t: 'The centre decodes flat',
    c: 'Equally close to every phase, a code at the centre decodes to the mean over all phases: nearly flat. The prior often draws codes there. Not checked in the notebook.',
    fx: 0.25,
  },
];

export default function BlurScene({ id = 'blur' }) {
  return (
    <Scene
      id={id}
      label="Why VAE samples are smooth and some are flat: ten real Swanbourne windows starting in the same month average to a smooth wave; windows at four start months a quarter-year apart, placed on a ring of codes, average to a nearly flat line, the notebook's untested explanation for flat samples"
      viewBox={`0 0 ${W} ${H}`}
      beats={BEATS}
      art={art}
      build={build}
      keyframes={[3]}
      schematic="plane of two codings illustrative · curves real Swanbourne windows"
    />
  );
}
