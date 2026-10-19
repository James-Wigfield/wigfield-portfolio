import Scene from '../scene/Scene';
import { Plate, Row, R, P } from '../scene/Plate';
import { lin, seriesPath, bracket } from '../scene/geom';
import { SERIES } from '../data/series';
import { sectionRange, codeCell, mdCell } from '../nbutil';

/* ============================================================================
   PLATE 3·1 — cutting a sequence into input and target  (§3 Splitting)
   The reference explainer: real sequences from the data, one paused GSAP
   timeline, five beats, a static art(step) for print and reduced motion.
   ========================================================================== */

const W = 800;
const H = 488;
const X0 = 70;
const X1 = 730;
const MW = (X1 - X0) / 95; // one month
const x = lin(1, 96, X0, X1); // month centre
const xe = (m) => x(m) - MW / 2; // left edge of month m
const P1 = { top: 40, h: 100 };
const P2 = { top: 254, h: 100 };
const yOf = (p) => lin(37, 4, p.top, p.top + p.h);
const y1 = yOf(P1);
const y2 = yOf(P2);
const TRAIN = SERIES.trainSeqs['0'];
const TEST = SERIES.testSeqs['150'];
const N = SERIES.shapes;
const HORIZONS = [12, 15, 18, 21, 24];

const col = (seq, c) => seq.map((r) => r[c]);

function Panel({ p, y, months, label }) {
  const ticks = [1, 12, 24, 36, 48, 60, 72, 84, 96].filter((m) => m <= months);
  return (
    <g>
      <text className="sv-cap" x={24} y={p.top - 16}>{label}</text>
      {[10, 20, 30].map((t) => (
        <g key={t}>
          <line className="sv-grid" x1={X0 - 6} x2={xe(months + 1)} y1={y(t)} y2={y(t)} />
          <text className="sv-lab" x={X0 - 12} y={y(t) + 4} textAnchor="end">{t}°</text>
        </g>
      ))}
      <line className="sv-axis" x1={X0 - 6} x2={xe(months + 1)} y1={p.top + p.h} y2={p.top + p.h} />
      {ticks.map((m) => (
        <g key={m}>
          <line className="sv-axis" x1={x(m)} x2={x(m)} y1={p.top + p.h} y2={p.top + p.h + 4} />
          <text className="sv-lab" x={x(m)} y={p.top + p.h + 15} textAnchor="middle">{m}</text>
        </g>
      ))}
    </g>
  );
}

function Lines({ seq, y, cls, end }) {
  const mins = col(seq, 0);
  const maxs = col(seq, 1);
  return (
    <g>
      <path className={`sv-line sv-max ${cls}`} d={seriesPath(maxs, x, y)} />
      <path className={`sv-line sv-min ${cls}`} d={seriesPath(mins, x, y)} />
      <text className={`sv-lab-strong ${end}`} x={x(seq.length) + 8} y={y(maxs[maxs.length - 1]) + 4}>max</text>
      <text className={`sv-lab-strong ${end}`} x={x(seq.length) + 8} y={y(mins[mins.length - 1]) + 4}>min</text>
    </g>
  );
}

function Brace({ m0, m1, yb, label, sub, cls, strong, opacity }) {
  const a = xe(m0) + 1.5;
  const b = xe(m1 + 1) - 1.5;
  return (
    <g className={cls} opacity={opacity}>
      <path className={strong ? 'sv-ink2' : 'sv-faint'} d={bracket(a, b, yb, -6)} strokeWidth="1.2" />
      <text className="sv-lab-strong" x={(a + b) / 2} y={yb + 14} textAnchor="middle">{label}</text>
      {sub && <text className="sv-lab" x={(a + b) / 2} y={yb + 27} textAnchor="middle">{sub}</text>}
    </g>
  );
}

function art(step, uid) {
  const on = (b) => (step >= b ? 1 : 0);
  const hatch = `${uid}hatch`;
  return (
    <>
      <defs>
        <pattern id={hatch} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" className="sv-faint" strokeWidth="1" />
        </pattern>
      </defs>

      {/* ── training sequence ── */}
      <rect className="sv-fill-ground2 b1" x={xe(73)} y={P1.top - 4} width={MW * 12} height={P1.h + 4} opacity={on(1)} />
      <Panel p={P1} y={y1} months={84} label="Training sequence · 84 months" />
      <g opacity={on(0)} className="b0">
        <Lines seq={TRAIN} y={y1} cls="l-train" end="b0-end" />
      </g>
      <g className="b1" opacity={on(1)}>
        <line className="sv-ink b1-cut" x1={xe(73)} x2={xe(73)} y1={P1.top - 8} y2={P1.top + P1.h + 6} strokeWidth="1.4" strokeDasharray="3 3" />
        <text className="sv-lab" x={xe(73) - 5} y={P1.top - 12} textAnchor="end">72</text>
        <text className="sv-lab" x={xe(73) + 5} y={P1.top - 12}>73</text>
      </g>
      <Brace m0={1} m1={72} yb={P1.top + P1.h + 30} label="X · input · 72 months" cls="b1" strong opacity={on(1)} />
      <Brace m0={73} m1={84} yb={P1.top + P1.h + 30} label="y · target · 12" cls="b1" strong opacity={on(1)} />
      <g className="b2" opacity={on(2)}>
        <text className="sv-lab" x={(xe(1) + xe(73)) / 2} y={P1.top + P1.h + 58} textAnchor="middle">X_train ({N.train[0]}, 72, 2)</text>
        <text className="sv-lab" x={(xe(73) + xe(85)) / 2 + 22} y={P1.top + P1.h + 58} textAnchor="middle">y_train ({N.train[0]}, 12, 2)</text>
      </g>
      <g className="b2" opacity={on(2)}>
        <text className="sv-lab" x={X0 - 6} y={P1.top + P1.h + 74}>
          X_val ({N.val[0]}, 72, 2) · y_val ({N.val[0]}, 12, 2) · X_test ({N.test[0]}, 72, 2) · y_test ({N.test[0]}, 12, 2)
        </text>
      </g>

      {/* ── test sequence ── */}
      <g className="b3" opacity={on(3)}>
        <rect className="sv-fill-ground2" x={xe(73)} y={P2.top - 4} width={MW * 12} height={P2.h + 4} />
        <rect x={xe(85)} y={P2.top - 4} width={MW * 12} height={P2.h + 4} fill={`url(#${hatch})`} />
        <Panel p={P2} y={y2} months={96} label="Test sequence · 96 months" />
        <Lines seq={TEST} y={y2} cls="l-test" end="b3-end" />
        <line className="sv-ink" x1={xe(73)} x2={xe(73)} y1={P2.top - 8} y2={P2.top + P2.h + 6} strokeWidth="1.4" strokeDasharray="3 3" />
        <line className="sv-faint" x1={xe(85)} x2={xe(85)} y1={P2.top - 8} y2={P2.top + P2.h + 6} strokeWidth="1" />
        <Brace m0={1} m1={72} yb={P2.top + P2.h + 30} label="X_test · 72" strong />
        <Brace m0={73} m1={84} yb={P2.top + P2.h + 30} label="y_test · 12" strong />
        <Brace m0={85} m1={96} yb={P2.top + P2.h + 30} label="held back" sub="months 85–96" />
      </g>

      {/* ── part (f) horizons ── */}
      <g className="b4" opacity={on(4)}>
        <text className="sv-cap" x={X0 - 6} y={P2.top + P2.h + 76}>Section 9 targets</text>
        {HORIZONS.map((h, j) => {
          const yy = P2.top + P2.h + 74 + j * 11;
          return (
            <g key={h}>
              <path className={`hz ${h === 12 ? 'sv-ink2' : 'sv-ink'}`} d={`M${xe(73) + 1} ${yy}H${xe(73 + h) - 1}`} strokeWidth="2" strokeLinecap="round" />
              <text className="sv-lab" x={xe(73 + h) + 6} y={yy + 4}>{h}</text>
            </g>
          );
        })}
      </g>
    </>
  );
}

function build(tl, { q, beat }) {
  const draw = (sel, at, dur) =>
    q(sel).forEach((p) => {
      const L = p.getTotalLength();
      tl.fromTo(p, { strokeDasharray: L, strokeDashoffset: L }, { strokeDashoffset: 0, duration: dur, ease: 'power1.inOut', immediateRender: true }, at);
    });
  // t = 0: everything after beat 0 hidden, the training lines undrawn
  tl.set(q('.b1, .b2, .b3, .b4, .b0-end'), { opacity: 0, immediateRender: true }, 0);
  tl.set(q('.b0'), { opacity: 1, immediateRender: true }, 0);

  beat(0, 0);
  draw('.l-train', 'b0', 1.8);
  tl.fromTo(q('.b0-end'), { opacity: 0 }, { opacity: 1, duration: 0.4 }, 'b0+=1.5');

  beat(1, '+=0.5');
  tl.fromTo(q('.b1'), { opacity: 0 }, { opacity: 1, duration: 0.5, stagger: 0.15 }, 'b1');
  tl.fromTo(q('.b1-cut'), { attr: { y2: P1.top - 8 } }, { attr: { y2: P1.top + P1.h + 6 }, duration: 0.6, ease: 'power2.out' }, 'b1');

  beat(2, '+=0.8');
  tl.fromTo(q('.b2'), { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.5 }, 'b2');

  beat(3, '+=1.2');
  tl.fromTo(q('.b3'), { opacity: 0 }, { opacity: 1, duration: 0.4 }, 'b3');
  draw('.l-test', 'b3', 1.8);
  tl.fromTo(q('.b3-end'), { opacity: 0 }, { opacity: 1, duration: 0.4 }, 'b3+=1.5');

  beat(4, '+=0.8');
  tl.fromTo(q('.b4'), { opacity: 0 }, { opacity: 1, duration: 0.3 }, 'b4');
  q('.hz').forEach((p, j) => {
    const L = p.getTotalLength();
    tl.fromTo(p, { strokeDasharray: L, strokeDashoffset: L }, { strokeDashoffset: 0, duration: 0.5, ease: 'power2.out', immediateRender: true }, `b4+=${0.15 + j * 0.18}`);
  });
  tl.to({}, { duration: 1.2 }); // hold the last frame a moment
}

const BEATS = [
  { t: 'One training sequence', c: 'Eighty-four consecutive months of mean minimum (blue) and maximum (orange) temperature from one training station.' },
  { t: 'Cut after month 72', c: 'The first 72 months become the input X; the 12 months after them are the target y the model must forecast.' },
  { t: 'The same cut for every set', c: 'Validation and test go through the same function, so all three sets give 72-month inputs and 12-month targets with two channels.' },
  { t: 'Test sequences run 96 months', c: 'Bickley’s sequences are a year longer. The cut is the same, and no model sees months 85–96 until section 9.' },
  { t: 'Saved for section 9', c: 'The horizon comparison asks for targets of 15, 18, 21 and 24 months, which reach into the held-back months.' },
];

export function SplitScene() {
  return (
    <Scene
      id="split"
      label="An 84-month training sequence cut into 72 input months and 12 target months, and a 96-month test sequence with months 85 to 96 held back"
      viewBox={`0 0 ${W} ${H}`}
      beats={BEATS}
      art={art}
      build={build}
      keyframes={[4]}
    />
  );
}

export function SplitPlate({ meta }) {
  const c = codeCell('s3', 0);
  return (
    <Plate meta={meta} cells={sectionRange('s3')}>
      <Row label="Task">
        <p className="dlp2-task">Split every sequence into 72 months of input and the 12 months that follow, for all three sets, and keep the test set’s last 12 months for later.</p>
      </Row>
      <Row label="How it works" wide>
        <SplitScene />
      </Row>
      <Row label="What the notebook did">
        <P>
          <code>split_sequences</code> is two slices of the same tensor: <code>seq[:, :72]</code> becomes X and{' '}
          <code>seq[:, 72:84]</code> becomes y, so nothing is converted to NumPy and every row keeps its months in order. <R c={c} code />
        </P>
        <P>
          The two lengths are arguments rather than constants inside the function, because section 9 calls it again on the test set
          with targets of 15, 18, 21 and 24 months. <R c={mdCell('s3', 0)} /> <R c={codeCell('s9', 0)} code />
        </P>
      </Row>
      <Row label="What came out">
        <table className="dlp2-tbl">
          <thead>
            <tr>
              <th>set</th>
              <th>X</th>
              <th>y</th>
              <th>station</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>train</td><td>(1522, 72, 2)</td><td>(1522, 12, 2)</td><td>Perth Airport, Jandakot Aero, Perth Metro</td></tr>
            <tr><td>val</td><td>(313, 72, 2)</td><td>(313, 12, 2)</td><td>Swanbourne</td></tr>
            <tr><td>test</td><td>(297, 72, 2)</td><td>(297, 12, 2)</td><td>Bickley</td></tr>
          </tbody>
        </table>
        <P>
          Shapes as printed <R c={c} />. Within each test window, months 85–96 only enter the descriptive statistics in section 2 and
          the longer horizons in section 9 <R c={3}>cell 3</R>. Because the test windows overlap, the months one window holds back are
          target months of the next windows and input months of later ones (all but the record’s last 12 months, which no window’s
          months 73–84 reach), so sections 6–8 do score them; that is harmless, since
          nothing is ever trained or tuned on the test set.
        </P>
      </Row>
    </Plate>
  );
}
