import Scene from '../../scene/Scene';
import { lin, bracket } from '../../scene/geom';

/* ============================================================================
   SCENE — plate 8·3, why the curves flatter model 3  ('m3-optimism')
   Every mark sits on one MAE axis (°C), so a gap is a horizontal distance:
     row A  teacher-forced validation MAE at the restored epoch   0.962 Out [16]
     row B  free-running validation MAE                            1.178 Out [19]
     row C  free-running test MAE                                  1.321 Out [17]
   +0.216 = how far the teacher-forced curve flatters the forecast (exposure
   bias plus the gap between a one-month-ahead score and an average over
   months 1 to 12 ahead), +0.143 =
   Swanbourne → Bickley. Then the seed spread (five seeds of the same setup in
   the tuning script, 1.09–1.25, mean 1.185; log and final_m3_s42-1-7-11-23.csv;
   the log's std does not match its own five values, decisions.md, so the band
   is the range), the
   rank flip against models 1 and 2 (Out [19]; model 2 square markers, model
   3 round ones, as in 9·2, 9·3 and 13·1) and the per-epoch check behind
   cell 33's "within 0.04 degrees" (two separate 100-epoch runs in the log).
   All values are printed numbers; no curve shapes are drawn between them.
   ========================================================================== */

const W = 800;
const H = 480;
const X0 = 205;
const X1 = 775;
const x = lin(0.9, 1.45, X0, X1);
const RA = 92;
const RB = 186;
const RC = 290; // rows B and C sit far enough apart that B's number and receipt clear C's gap label
const SEP = 348;
const D1 = 398;
const D2 = 426;
const AX = 456;
const TICKS = [0.9, 1.0, 1.1, 1.2, 1.3, 1.4];
// log / final_m3_s42-1-7-11-23.csv: five seeds of the final setup in the tuning
// script, free-running val MAE; the band spans their range
const SEEDS = [1.092, 1.135, 1.247, 1.217, 1.235];
const SEED_LO = Math.min(...SEEDS);
const SEED_HI = Math.max(...SEEDS);
const SEED_MID = (SEED_LO + SEED_HI) / 2;
const M3 = { stroke: 'var(--dlp2-m3)', strokeWidth: 2 };
const dotStyle = (hollow) => (hollow ? { fill: 'var(--surface)', ...M3 } : { fill: 'var(--dlp2-m3)' });

function RowLabel({ y, cap, lab, sub, cls, op }) {
  return (
    <g className={cls} opacity={op}>
      <line className="sv-grid" x1={X0} x2={X1} y1={y} y2={y} />
      <text className="sv-cap" x={24} y={y - 3}>{cap}</text>
      <text className="sv-lab-strong" x={24} y={y + 12}>{lab}</text>
      <text className="sv-lab" x={24} y={y + 26}>{sub}</text>
    </g>
  );
}

// recStart: start the receipt at the number's left edge instead of centring it
// (row A's long receipt would otherwise begin on the 0.9 gridline)
function Mark({ v, y, hollow, num, rec, recStart = false, cls, op }) {
  return (
    <g className={cls} opacity={op}>
      <circle className="op-dot" cx={x(v)} cy={y} r={6} style={dotStyle(hollow)} />
      <text className="sv-big" x={x(v)} y={y + 30} textAnchor="middle">{num}</text>
      <text className="sv-lab" x={recStart ? x(v) - 30 : x(v)} y={y + 49} textAnchor={recStart ? 'start' : 'middle'}>{rec}</text>
    </g>
  );
}

function Gap({ from, to, y, label, cls, op }) {
  return (
    <g className={cls} opacity={op}>
      <line className="op-ghost" x1={x(from)} x2={x(from)} y1={y - 6} y2={y + 6} style={{ stroke: 'var(--dlp2-m3)', strokeWidth: 1.5, opacity: 0.55 }} />
      <path className="sv-ink2 op-br" d={bracket(x(from), x(to), y - 20, 7)} strokeWidth="1.2" />
      <text className="sv-lab-strong op-brlab" x={(x(from) + x(to)) / 2} y={y - 28} textAnchor="middle">{label}</text>
    </g>
  );
}

// model 2's marker is a square wherever model 3 (round) is on the same chart
function Marker({ m, cx, cy, r, style }) {
  if (m === 'm2') return <rect className="sv-fm2" x={cx - r} y={cy - r} width={2 * r} height={2 * r} style={style} />;
  return <circle className={`sv-f${m}`} cx={cx} cy={cy} r={r} style={style} />;
}

// a model's mark on a row, with its label (a marker of the same colour and shape, then text) set below it
function ModelDot({ v, y, m, label, lx, ly, cls, op }) {
  return (
    <g className={cls} opacity={op}>
      <Marker m={m} cx={x(v)} cy={y} r={m === 'm2' ? 4 : 4.5} style={{ stroke: 'var(--surface)', strokeWidth: 1 }} />
      <Marker m={m} cx={lx} cy={ly - 4} r={3} />
      <text className="sv-lab" x={lx + 8} y={ly}>{label}</text>
    </g>
  );
}

function art(step) {
  const on = (b) => (step >= b ? 1 : 0);
  return (
    <>
      <text className="sv-cap" x={24} y={24}>Model 3 · MAE in °C, all on one axis</text>
      <g className="op-legend12" opacity={on(4)}>
        <circle cx={580} cy={20} r={3.5} className="sv-fm1" />
        <text className="sv-lab" x={588} y={24}>model 1</text>
        <Marker m="m2" cx={646} cy={20} r={3.5} />
        <text className="sv-lab" x={654} y={24}>model 2</text>
      </g>
      <circle cx={712} cy={20} r={3.5} style={{ fill: 'var(--dlp2-m3)' }} />
      <text className="sv-lab" x={720} y={24}>model 3</text>

      {/* axis + gridlines (always) */}
      {TICKS.map((t) => (
        <g key={t}>
          <line className="sv-grid" x1={x(t)} x2={x(t)} y1={54} y2={AX} />
          <line className="sv-axis" x1={x(t)} x2={x(t)} y1={AX} y2={AX + 4} />
          <text className="sv-lab" x={x(t)} y={AX + 17} textAnchor="middle">{t.toFixed(1)}</text>
        </g>
      ))}
      <line className="sv-axis" x1={X0} x2={X1} y1={AX} y2={AX} />
      <text className="sv-cap" x={24} y={AX + 17}>MAE, °C</text>

      {/* ── beat 0: what the curve reports ── */}
      <RowLabel y={RA} cap="validation · Swanbourne" lab="teacher-forced" sub="true month fed in" cls="op-rowA" op={on(0)} />
      <Mark v={0.962} y={RA} hollow num="0.962" rec="Out [16] · epoch 30" recStart cls="op-markA" op={on(0)} />

      {/* ── beat 1: the same weights, run free ── */}
      {/* rows B and C also carry model 1 (beat 4), which feeds nothing back: the sub-label holds for all three */}
      <RowLabel y={RB} cap="validation · Swanbourne" lab="free-running" sub="12 months, no truth given" cls="op-rowB" op={on(1)} />
      <Gap from={0.962} to={1.178} y={RB} label="+0.216 · how far the curve flatters" cls="op-gapB" op={on(1)} />
      <Mark v={1.178} y={RB} num="1.178" rec="Out [19]" cls="op-markB" op={on(1)} />

      {/* ── beat 2: a different station ── */}
      <RowLabel y={RC} cap="test · Bickley" lab="free-running" sub="12 months, no truth given" cls="op-rowC" op={on(2)} />
      <Gap from={1.178} to={1.321} y={RC} label="+0.143 · Swanbourne → Bickley" cls="op-gapC" op={on(2)} />
      <Mark v={1.321} y={RC} num="1.321" rec="Out [17]" cls="op-markC" op={on(2)} />

      {/* ── beat 3: seed noise ── */}
      <g className="op-seeds" opacity={on(3)}>
        <rect
          className="op-band"
          x={x(SEED_LO)}
          y={RB - 8}
          width={x(SEED_HI) - x(SEED_LO)}
          height={16}
          style={{ fill: 'var(--dlp2-m3)', opacity: 0.16 }}
        />
        {SEEDS.map((s) => (
          <line key={s} className="op-seed" x1={x(s)} x2={x(s)} y1={RB - 10} y2={RB + 10} style={{ stroke: 'var(--dlp2-m3)', strokeWidth: 1.4 }} />
        ))}
        <text className="sv-lab-strong" x={x(1.255) + 14} y={RB + 22}>five seeds · 1.09 to 1.25</text>
        <text className="sv-lab" x={x(1.255) + 14} y={RB + 36}>mean 1.185 · same setup,</text>
        <text className="sv-lab" x={x(1.255) + 14} y={RB + 50}>tuning script · log</text>
      </g>

      {/* ── beat 4: the rank flip ── */}
      {/* the Swanbourne labels end left of x 395, where a 390 px screen's view starts in this beat (fx 1) */}
      <ModelDot v={0.988} y={RB} m="m1" label="model 1 · 0.988" lx={x(0.985) - 12} ly={RB + 24} cls="op-m op-m1v" op={on(4)} />
      <ModelDot v={0.982} y={RB} m="m2" label="model 2 · 0.982" lx={x(0.985) - 12} ly={RB + 38} cls="op-m op-m2v" op={on(4)} />
      <ModelDot v={1.25} y={RC} m="m1" label="model 1 · 1.250" lx={x(1.25) - 110} ly={RC + 24} cls="op-m op-m1t" op={on(4)} />
      <ModelDot v={1.407} y={RC} m="m2" label="model 2 · 1.407" lx={x(1.407) - 56} ly={RC - 12} cls="op-m op-m2t" op={on(4)} />

      {/* ── beat 5: did stopping on the optimistic number pick a good epoch? ── */}
      <g className="op-check" opacity={on(5)}>
        <line className="sv-axis" x1={20} x2={782} y1={SEP} y2={SEP} />
        <text className="sv-cap" x={24} y={SEP + 22}>Separate 100-epoch runs · log</text>
        {/* run labels sit against the axis and the key is short, so a narrow
            screen's half of the stage shows both runs with their labels */}
        <circle cx={X0 + 45} cy={SEP + 13} r={4.5} style={dotStyle(true)} />
        <text className="sv-lab" x={X0 + 55} y={SEP + 17}>epoch of lowest val_loss · its free-running MAE</text>
        <circle cx={X0 + 45} cy={SEP + 29} r={4.5} style={dotStyle(false)} />
        <text className="sv-lab" x={X0 + 55} y={SEP + 33}>lowest free-running MAE</text>

        <text className="sv-lab-strong" x={X0 - 4} y={D1 + 4} textAnchor="end">run 1</text>
        <line x1={x(1.042)} x2={x(1.082)} y1={D1} y2={D1} style={{ stroke: 'var(--dlp2-m3)', strokeWidth: 1.5 }} />
        <circle cx={x(1.042)} cy={D1} r={4.5} style={dotStyle(false)} />
        <circle cx={x(1.082)} cy={D1} r={4.5} style={dotStyle(true)} />
        <text className="sv-lab" x={x(1.042) - 10} y={D1 + 4} textAnchor="end">epoch 94 · 1.042</text>
        <text className="sv-lab" x={x(1.082) + 8} y={D1 + 4}>1.082 · epoch 77</text>
        <text className="sv-lab-strong" x={604} y={D1 + 4}>0.040 °C apart</text>

        <text className="sv-lab-strong" x={X0 - 4} y={D2 + 4} textAnchor="end">run 2</text>
        {/* 0.001 apart: the ring and the dot land on top of each other */}
        <circle cx={x(1.135)} cy={D2} r={5.5} style={dotStyle(true)} />
        <circle cx={x(1.134)} cy={D2} r={2.6} style={dotStyle(false)} />
        <text className="sv-lab" x={x(1.134) - 10} y={D2 + 4} textAnchor="end">epoch 80 · 1.134</text>
        <text className="sv-lab" x={x(1.135) + 8} y={D2 + 4}>1.135 · epoch 79</text>
        <text className="sv-lab-strong" x={604} y={D2 + 4}>0.001 °C apart</text>
      </g>
    </>
  );
}

function build(tl, { q, beat }) {
  const draw = (el, at, dur = 0.5) => {
    const L = el.getTotalLength();
    tl.fromTo(el, { strokeDasharray: L, strokeDashoffset: L }, { strokeDashoffset: 0, duration: dur, ease: 'power2.inOut', immediateRender: true }, at);
  };
  const pop = (sel, at) =>
    tl.fromTo(q(sel), { scale: 0, transformOrigin: '50% 50%' }, { scale: 1, duration: 0.45, ease: 'back.out(1.3)' }, at);
  tl.set(q('.op-rowB, .op-rowC, .op-markB, .op-markC, .op-gapB, .op-gapC, .op-seeds, .op-m, .op-legend12, .op-check'), { opacity: 0, immediateRender: true }, 0);
  tl.set(q('.op-gapB .op-brlab, .op-gapC .op-brlab, .op-gapB .op-ghost, .op-gapC .op-ghost'), { opacity: 0, immediateRender: true }, 0);

  // `label` must be a bare beat label ('b0'): offsets are added to it once
  const row = (r, mark, label) => {
    tl.fromTo(q(r), { opacity: 0 }, { opacity: 1, duration: 0.4 }, label);
    tl.fromTo(q(mark), { opacity: 0 }, { opacity: 1, duration: 0.01 }, `${label}+=0.3`);
    pop(`${mark} .op-dot`, `${label}+=0.3`);
    tl.fromTo(q(`${mark} text`), { opacity: 0, y: -6 }, { opacity: 1, y: 0, duration: 0.4, stagger: 0.12 }, `${label}+=0.55`);
  };
  // label + one summed offset: GSAP reads 'b1+=0.2+=0.8' as 'b1+=0.2'
  const gap = (g, label, start) => {
    const at = (d) => `${label}+=${(start + d).toFixed(2)}`;
    tl.fromTo(q(g), { opacity: 0 }, { opacity: 1, duration: 0.01 }, at(0));
    tl.fromTo(q(`${g} .op-ghost`), { opacity: 0 }, { opacity: 0.55, duration: 0.3 }, at(0));
    draw(q(`${g} .op-br`)[0], at(0.2), 0.7);
    tl.fromTo(q(`${g} .op-brlab`), { opacity: 0 }, { opacity: 1, duration: 0.4 }, at(0.8));
  };

  // 0 · the teacher-forced number the curve reports
  beat(0, 0);
  row('.op-rowA', '.op-markA', 'b0');

  // 1 · free-running on the same validation windows
  beat(1, '+=0.9');
  tl.fromTo(q('.op-rowB'), { opacity: 0 }, { opacity: 1, duration: 0.4 }, 'b1');
  gap('.op-gapB', 'b1', 0.2);
  tl.fromTo(q('.op-markB'), { opacity: 0 }, { opacity: 1, duration: 0.01 }, 'b1+=0.8');
  pop('.op-markB .op-dot', 'b1+=0.8');
  tl.fromTo(q('.op-markB text'), { opacity: 0, y: -6 }, { opacity: 1, y: 0, duration: 0.4, stagger: 0.12 }, 'b1+=1.05');

  // 2 · the test station
  beat(2, '+=1.0');
  tl.fromTo(q('.op-rowC'), { opacity: 0 }, { opacity: 1, duration: 0.4 }, 'b2');
  gap('.op-gapC', 'b2', 0.2);
  tl.fromTo(q('.op-markC'), { opacity: 0 }, { opacity: 1, duration: 0.01 }, 'b2+=0.8');
  pop('.op-markC .op-dot', 'b2+=0.8');
  tl.fromTo(q('.op-markC text'), { opacity: 0, y: -6 }, { opacity: 1, y: 0, duration: 0.4, stagger: 0.12 }, 'b2+=1.05');

  // 3 · five seeds of the final setup (tuning script)
  beat(3, '+=1.0');
  tl.fromTo(q('.op-seeds'), { opacity: 0 }, { opacity: 1, duration: 0.01 }, 'b3');
  const bw = x(SEED_HI) - x(SEED_LO);
  tl.fromTo(q('.op-band'), { attr: { x: x(SEED_MID), width: 0 } }, { attr: { x: x(SEED_LO), width: bw }, duration: 0.6, ease: 'power2.out' }, 'b3');
  tl.fromTo(q('.op-seed'), { opacity: 0, scaleY: 0, transformOrigin: '50% 50%' }, { opacity: 1, scaleY: 1, duration: 0.25, stagger: 0.12 }, 'b3+=0.3');
  tl.fromTo(q('.op-seeds text'), { opacity: 0 }, { opacity: 1, duration: 0.4, stagger: 0.15 }, 'b3+=0.9');

  // 4 · models 1 and 2 on the same rows
  beat(4, '+=1.0');
  tl.fromTo(q('.op-legend12'), { opacity: 0 }, { opacity: 1, duration: 0.4 }, 'b4');
  tl.fromTo(q('.op-m1v, .op-m2v'), { opacity: 0, y: -8 }, { opacity: 1, y: 0, duration: 0.4, stagger: 0.15 }, 'b4');
  tl.fromTo(q('.op-m1t, .op-m2t'), { opacity: 0, y: -8 }, { opacity: 1, y: 0, duration: 0.4, stagger: 0.15 }, 'b4+=0.7');

  // 5 · the per-epoch check behind "within 0.04 degrees"
  beat(5, '+=1.2');
  tl.fromTo(q('.op-check'), { opacity: 0 }, { opacity: 1, duration: 0.01 }, 'b5');
  tl.fromTo(q('.op-check > line, .op-check > text, .op-check > circle'), { opacity: 0 }, { opacity: 1, duration: 0.35, stagger: 0.06 }, 'b5');
  tl.to({}, { duration: 1.4 });
}

const BEATS = [
  {
    t: 'What the curve reports',
    fx: 0,
    c: 'Model 3’s learning curves are teacher-forced: every decoder step was given the true previous month. At the restored epoch 30 the validation MAE is 0.962 °C.',
  },
  {
    t: 'Run the decoder free',
    fx: 0.5,
    c: 'Same weights, own predictions fed back: 1.178 °C. On this explainer’s reading only part of the 0.216 gap is exposure bias: the curve scores one month ahead, this averages months 1–12.',
  },
  {
    t: 'Then change station',
    fx: 1,
    c: 'Free-running on Bickley the MAE is 1.321 °C. That further 0.143 comes from moving to the test station and has nothing to do with teacher forcing.',
  },
  {
    t: 'How much is seed noise',
    fx: 1,
    c: 'Model 3 is the noisiest across seeds. The band spans five seeds of the same setup in the tuning script, free-running on validation; the notebook’s 1.178 sits inside it.',
  },
  {
    t: 'The ranks flip',
    // a 390 px screen shows ~405 of the 800 units: frame the Bickley row (model 1's
    // label to model 2's) and the legend; Swanbourne's models 1 and 2 are left of it
    fx: 1,
    c: 'On Swanbourne model 3 is the worst of the three, 0.2 behind models 1 and 2. On Bickley it beats model 2’s 1.407, though model 1’s 1.250 is still ahead.',
  },
  {
    t: 'Checking the stopping epoch',
    fx: 0.33,
    c: 'Early stopping watches the teacher-forced val_loss. In two 100-epoch tuning runs logging the free-running MAE each epoch, its pick was within 0.04 °C of the best epoch: still a good choice.',
  },
];

export default function OptimismScene({ id = 'm3-optimism' }) {
  return (
    <Scene
      id={id}
      label="Model 3's MAEs on one axis: teacher-forced validation 0.962, free-running validation 1.178 (0.216 higher), free-running test 1.321 (0.143 higher), with the seed spread, models 1 and 2 for comparison, and the per-epoch early-stopping check"
      viewBox={`0 0 ${W} ${H}`}
      beats={BEATS}
      art={art}
      build={build}
      keyframes={[5]}
    />
  );
}
