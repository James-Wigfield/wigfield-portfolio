import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from '../../../../icons';
import { Stage, StoryBar, MLine } from '../stage';
import { Tip } from '../svgParts';
import { Rich } from '../Rich';
import { cellFill } from '../svgFill';
import { useWidth } from '../useWidth';
import { useStudy } from '../context';
import { useStory } from '../story';
import { svgPoint, useReducedMotion } from '../hooks';
import { runVacuum, firstGeneration, DUST, DUST_N, ROOM_W, ROOM_H, RADIUS, SPEED, STEPS_30MIN, SHORT_STEPS } from './vacuumMath';
import './labsPolicySearch.css';

/* ============================================================================
   §3 · POLICY SEARCH  (slides 12–14)
   ----------------------------------------------------------------------------
   VacuumLab    slide 12's robotic vacuum, run in this page's own room
                (./vacuumMath.js): every second it moves forward with
                probability p, otherwise rotates by a random angle in
                [−r, +r] degrees. The room shows the 30-minute trajectory and
                the dust picked up (green); the "policy space" pad (Figure
                18-3's axes: p across, r up) is the one control, with Figure
                18-3's four points a–d as presets. Every point you try is
                left on the pad, coloured by its score: policy search by
                hand. ▶ replays the 30 minutes in four seconds.
   GeneticLab   slide 14's genetic algorithm over one generation, as a
                story: 100 random policies → try them out (this page's own
                10-minute run) → "kill" the 80 worst → the 20 survivors
                produce 4 offspring each (exact copies, as the slide says) →
                the second generation, 20 + 80 = 100.
   ========================================================================== */

const R_MAX = 180;
const PRESETS = [
  { k: 'a', p: 0.2, r: 150 },
  { k: 'b', p: 0.8, r: 150 },
  { k: 'c', p: 0.2, r: 20 },
  { k: 'd', p: 0.8, r: 20 },
];
const GOAL = 0.8;
const pct = (n) => `${Math.round((100 * n) / DUST_N)}%`;
const mmss = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

/* ── the policy-space pad (Figure 18-3, left) ──────────────────────────────── */
const PAD = { W: 250, H: 232, x0: 42, x1: 232, y0: 16, y1: 194 };
const px = (p) => PAD.x0 + p * (PAD.x1 - PAD.x0);
const py = (r) => PAD.y1 - (r / R_MAX) * (PAD.y1 - PAD.y0);

function PadAxes() {
  const { x0, x1, y0, y1 } = PAD;
  return (
    <g>
      <rect x={x0} y={y0} width={x1 - x0} height={y1 - y0} className="dl9s-pad__area" />
      <line x1={x0} y1={y1} x2={x1 + 10} y2={y1} className="dl9s-pad__axis" />
      <line x1={x0} y1={y1} x2={x0} y2={y0 - 10} className="dl9s-pad__axis" />
      <polygon points={`${x1 + 14},${y1} ${x1 + 6},${y1 - 4} ${x1 + 6},${y1 + 4}`} className="dl9s-pad__arrow" />
      <polygon points={`${x0},${y0 - 14} ${x0 - 4},${y0 - 6} ${x0 + 4},${y0 - 6}`} className="dl9s-pad__arrow" />
      <text x={x1 + 4} y={y1 + 30} textAnchor="end" className="dl9s-pad__name">p</text>
      <text x={x0 + 9} y={y0 - 3} className="dl9s-pad__name">r</text>
      {[0, 0.5, 1].map((v) => (
        <text key={`p${v}`} x={px(v)} y={y1 + 15} textAnchor="middle" className="dl9s-t dl9s-t--xs dl9s-t--m">{v}</text>
      ))}
      {[0, 90, 180].map((v) => (
        <text key={`r${v}`} x={x0 - 6} y={py(v) + 4} textAnchor="end" className="dl9s-t dl9s-t--xs dl9s-t--m">{v}°</text>
      ))}
    </g>
  );
}

function PolicyPad({ p, r, onChange, onCommit, tried, label }) {
  const ref = useRef(null);
  const [drag, setDrag] = useState(false);
  const fromEvent = (e) => {
    const pt = svgPoint(e, ref.current);
    if (!pt) return null;
    const pp = Math.max(0, Math.min(1, (pt.x - PAD.x0) / (PAD.x1 - PAD.x0)));
    const rr = Math.max(0, Math.min(R_MAX, ((PAD.y1 - pt.y) / (PAD.y1 - PAD.y0)) * R_MAX));
    return { p: Math.round(pp * 100) / 100, r: Math.round(rr) };
  };
  const onKey = (e) => {
    const d = { ArrowLeft: [-0.05, 0], ArrowRight: [0.05, 0], ArrowUp: [0, 10], ArrowDown: [0, -10] }[e.key];
    if (!d) return;
    e.preventDefault();
    const next = { p: Math.round(Math.max(0, Math.min(1, p + d[0])) * 100) / 100, r: Math.max(0, Math.min(R_MAX, r + d[1])) };
    onChange(next);
    onCommit(next);
  };
  return (
    <svg ref={ref} className="dl9s-svg dl9s-pad" viewBox={`0 0 ${PAD.W} ${PAD.H}`} role="group" aria-label="Policy space: p across, r up">
      <PadAxes />
      {tried.map((t, i) => (
        <circle key={`${t.p}-${t.r}-${i}`} cx={px(t.p)} cy={py(t.r)} r={4.2} className="dl9s-pad__tried" style={{ fill: cellFill('rpos', t.frac, 1) }} />
      ))}
      {/* the draggable area + the current point */}
      <g
        className={`dl9s-pad__drag${drag ? ' dl9s-pad__drag--on' : ''}`}
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={1}
        aria-valuenow={p}
        aria-valuetext={`p = ${p.toFixed(2)}, r = ${r} degrees. Left and right arrows change p, up and down change r.`}
        onKeyDown={onKey}
        onPointerDown={(e) => { e.currentTarget.setPointerCapture?.(e.pointerId); setDrag(true); const v = fromEvent(e); if (v) onChange(v); }}
        onPointerMove={(e) => { if (!drag) return; const v = fromEvent(e); if (v) onChange(v); }}
        onPointerUp={(e) => { setDrag(false); const v = fromEvent(e); if (v) onCommit(v); }}
        onPointerCancel={() => setDrag(false)}
      >
        <rect x={PAD.x0 - 8} y={PAD.y0 - 8} width={PAD.x1 - PAD.x0 + 16} height={PAD.y1 - PAD.y0 + 16} fill="transparent" />
        <line x1={px(p)} y1={PAD.y1} x2={px(p)} y2={py(r)} className="dl9s-pad__guide" />
        <line x1={PAD.x0} y1={py(r)} x2={px(p)} y2={py(r)} className="dl9s-pad__guide" />
        <circle cx={px(p)} cy={py(r)} r={8} className="dl9s-pad__pt" />
      </g>
      {PRESETS.map((q) => {
        const go = () => { onChange(q); onCommit(q); };
        return (
          <g
            key={q.k}
            className="dl9s-pad__preset"
            role="button"
            tabIndex={0}
            aria-label={`Figure 18-3’s point ${q.k}: p = ${q.p}, r = ${q.r} degrees`}
            onClick={go}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } }}
          >
            <circle cx={px(q.p)} cy={py(q.r)} r={11} fill="transparent" />
            <circle cx={px(q.p)} cy={py(q.r)} r={4.5} className="dl9s-pad__pdot" />
            <text x={px(q.p)} y={py(q.r) - 9} textAnchor="middle" className="dl9s-pad__plabel dl9s-halo">{q.k}</text>
          </g>
        );
      })}
    </svg>
  );
}

/* ── the room ──────────────────────────────────────────────────────────── */
function Room({ run, t, narrow }) {
  const k = narrow ? 52 : 80;
  const m = 8;
  const W = ROOM_W * k + 2 * m;
  const H = ROOM_H * k + 2 * m;
  const X = (x) => m + x * k;
  const Y = (y) => m + y * k;
  const end = t ?? STEPS_30MIN;
  let d = '';
  let lx = null;
  let ly = null;
  for (let i = 0; i <= end; i++) {
    const [x, y] = run.path[i];
    if (x === lx && y === ly) continue;
    d += `${d ? 'L' : 'M'}${X(x).toFixed(1)} ${Y(y).toFixed(1)}`;
    lx = x;
    ly = y;
  }
  const [rx, ry, rh] = run.path[end];
  const rr = RADIUS * k;
  return (
    <svg className="dl9s-svg dl9s-vac__room" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`The room after ${mmss(end)}: the robot picked up ${run.order.filter((i) => run.picked[i] <= end).length} of ${DUST_N} specks of dust`}>
      <rect x={m} y={m} width={ROOM_W * k} height={ROOM_H * k} rx={4} className="dl9s-vac__walls" />
      {DUST.map(([x, y], i) => {
        const got = run.picked[i] >= 0 && run.picked[i] <= end;
        return <circle key={i} cx={X(x)} cy={Y(y)} r={got ? 2.3 : 1.9} className={got ? 'dl9s-vac__dust dl9s-vac__dust--got' : 'dl9s-vac__dust'} />;
      })}
      <path d={d} className="dl9s-vac__trail" />
      <circle cx={X(ROOM_W / 2)} cy={Y(ROOM_H / 2)} r={2.6} className="dl9s-vac__start" />
      <g className="dl9s-vac__robot">
        <circle cx={X(rx)} cy={Y(ry)} r={rr} />
        <line x1={X(rx)} y1={Y(ry)} x2={X(rx) + rr * Math.cos(rh)} y2={Y(ry) + rr * Math.sin(rh)} />
      </g>
    </svg>
  );
}

export function VacuumLab() {
  const wrap = useRef(null);
  const narrow = useWidth(wrap) < 600;
  const reduced = useReducedMotion();
  const { printing } = useStudy();
  const [polState, setPol] = useState({ p: 0.8, r: 150 });
  const pol = printing ? { p: 0.8, r: 150 } : polState;
  const [tried, setTried] = useState(() => [{ p: 0.8, r: 150, frac: runVacuum(0.8, 150).count / DUST_N }]);
  const [t, setT] = useState(null);
  const raf = useRef(0);
  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const run = useMemo(() => runVacuum(pol.p, pol.r), [pol.p, pol.r]);
  const best = Math.max(...tried.map((q) => q.frac));
  const tt = printing ? null : t;
  const shown = tt === null ? run.count : run.order.filter((i) => run.picked[i] <= tt).length;

  const change = (v) => { cancelAnimationFrame(raf.current); setT(null); setPol({ p: v.p, r: v.r }); };
  const commit = (v) => {
    const frac = runVacuum(v.p, v.r).count / DUST_N;
    setTried((ts) => [...ts.filter((q) => q.p !== v.p || q.r !== v.r).slice(-39), { p: v.p, r: v.r, frac }]);
  };
  const play = () => {
    cancelAnimationFrame(raf.current);
    if (reduced) { setT(null); return; }
    const t0 = performance.now();
    const tick = (now) => {
      const f = Math.max(0, Math.min(1, (now - t0) / 4200));
      setT(Math.round(f * STEPS_30MIN));
      if (f < 1) raf.current = requestAnimationFrame(tick);
      else setT(null);
    };
    setT(0);
    raf.current = requestAnimationFrame(tick);
  };

  return (
    <Stage
      title="Tune a robot vacuum’s policy"
      slides="slides 12–13"
      tryThis="Predict which of Figure 18-3’s points a–d cleans best, click each to check, then drag the point to beat them all."
      caption="Each $(p, r)$ is one seeded 30-minute run, 1,800 one-second steps; the green specks were picked up. The room (6 m × 4 m), the 400 specks, the robot’s speed (0.15 m/s) and its rule that a wall stops it are this page’s own."
      challenge={{ text: `Find a $(p, r)$ that picks up over ${GOAL * 100}% of the dust in 30 minutes.`, done: best > GOAL }}
      own="the room and its dust · this page’s own simulation"
      maths={
        <>
          <MLine text={`Slide 12’s policy, every second: move forward with probability $p = ${pol.p.toFixed(2)}$, or rotate by a random angle in $[-r, +r] = [-${pol.r}°, +${pol.r}°]$ with probability $1 - p = ${(1 - pol.p).toFixed(2)}$.`} />
          <MLine text={`In this run of 1,800 s: ${run.turns} rotations (expected $(1 - p) \\times 1800 = ${Math.round((1 - pol.p) * 1800)}$), ${run.forward} moves forward of ${SPEED} m, and ${run.blocked} forward seconds lost against a wall.`} />
          <MLine text={`Reward = dust picked up in 30 minutes: **${run.count} of ${DUST_N} specks** (${pct(run.count)}).`} />
          <p className="dl9s-mnote"><Rich text="With a small $r$ the robot needs many small turns to get off a wall, so a large $p$ with a small $r$ (point d) spends most of its time stuck. A large $p$ with a large $r$ (point b) runs long straight lines with big turns, like Figure 18-3’s behaviour b." /></p>
        </>
      }
    >
      <div ref={wrap} className={`dl9s-vac${narrow ? ' dl9s-vac--narrow' : ''}`}>
        <div className="dl9s-vac__left">
          <Room run={run} t={tt} narrow={narrow} />
          <div className="dl9s-vac__bar">
            {!printing && !reduced && (
              <button type="button" className="dl9s-vac__play dl9s-noprint" onClick={play} aria-label="Replay the 30 minutes in four seconds">
                <Icon name="play" size={13} />
              </button>
            )}
            <span className="dl9s-vac__clock">{mmss(tt ?? STEPS_30MIN)} <span>of 30:00</span></span>
          </div>
        </div>
        <div className="dl9s-vac__side">
          <p className="dl9s-vac__score" aria-live="polite">
            <span className="dl9s-vac__big">{pct(shown)}</span>
            <span className="dl9s-vac__sub">of the dust picked up<br />{shown} of {DUST_N} specks</span>
          </p>
          <p className="dl9s-vac__pol">
            <span className="dl9s-vac__padk">policy space</span>
            <span className="dl9s-vac__pv"><i>p</i> = {pol.p.toFixed(2)} · <i>r</i> = {pol.r}°</span>
          </p>
          <PolicyPad p={pol.p} r={pol.r} onChange={change} onCommit={commit} tried={tried} label="Policy parameters p and r" />
        </div>
      </div>
    </Stage>
  );
}

/* ── §3 · slide 14's genetic algorithm, one generation ───────────────────── */
const GEN_BEATS = [
  { label: '100 random policies', say: 'Randomly create a first generation of **100 policies**: 100 random points $(p, r)$ in the policy space.' },
  { label: 'try them out', say: '**Try them out:** each one drives the vacuum for 10 minutes (this page’s shorter run) and scores the dust it picks up.' },
  { label: 'kill the 80 worst', say: '**“Kill” the 80 worst** policies: the **20 survivors** are the top two rows.' },
  { label: '4 offspring each', say: 'The 20 survivors produce **4 offspring each**. An offspring is just a copy of its parent, so each colour repeats down its column.' },
  { label: 'second generation', say: 'The survivors plus their offspring form the **second generation**: $20 + 20 \\times 4 = 100$ policies. Then iterate, generation after generation.' },
];
const READOUT = [
  'generation 1 · 100 random policies',
  'tried out · dust picked up in 10 minutes',
  '20 survivors · 80 killed',
  '+ 80 offspring, 4 per survivor',
  'generation 2 · 20 + 80 = 100 policies, 20 of them different',
];
const CELL = 25;

export function GeneticLab() {
  const wrap = useRef(null);
  const narrow = useWidth(wrap) < 600;
  const story = useStory(GEN_BEATS.length);
  const { beat } = story;
  const [hover, setHover] = useState(null);

  // sorted best first: index 0–19 survive
  const gen = useMemo(() => firstGeneration().sort((a, b) => b.score - a.score || a.id - b.id), []);
  const max = gen[0].score;
  const survivors = gen.slice(0, 20);
  // the grid after beat 3: rows 1–2 = survivors, rows 3–10 = offspring; cell 20 + j is a copy of survivor j % 20
  const cellPolicy = (i) => (beat >= 3 && i >= 20 ? survivors[(i - 20) % 20] : gen[i]);
  // a hovered policy's family: its survivor and (from beat 3) that survivor's four copies
  const family = hover === null ? null : hover < 20 ? hover : beat >= 3 ? (hover - 20) % 20 : null;
  const inFamily = (i) => i === hover || (family !== null && (i === family || (beat >= 3 && i >= 20 && (i - 20) % 20 === family)));

  const gx = 34;
  const gy = 30;
  const GW = gx + 10 * CELL + 8;
  const GH = gy + 10 * CELL + 30;
  const hp = hover === null ? null : cellPolicy(hover);

  return (
    <Stage
      title="One generation of a genetic algorithm"
      slides="slide 14"
      tryThis="Predict how many *different* policies the second generation holds, then step through the beats and count."
      story={<StoryBar story={story} beats={GEN_BEATS} />}
      caption="Each offspring is an exact copy of its parent (slide 14), so the second generation can be no better than its best survivor. Hover a policy to see its numbers and its copies."
      own="scores: dust in a 10-minute run of the vacuum above · this page’s own"
      maths={
        <>
          <MLine text={`Generation 1 (scored on this page’s 10-minute run, ${SHORT_STEPS} steps): best $p = ${gen[0].p.toFixed(2)}$, $r = ${gen[0].r}°$, ${pct(gen[0].score)} of the dust; the 20th best (the weakest survivor) ${pct(gen[19].score)}; the worst ${pct(gen[99].score)}.`} />
          <MLine text={`Generation 2 = 20 survivors + $20 \\times 4 = 80$ copies = 100 policies, but only 20 different $(p, r)$ points. Its best is the same policy, ${pct(gen[0].score)}.`} />
        </>
      }
    >
      <div ref={wrap} className={`dl9s-gen${narrow ? ' dl9s-gen--narrow' : ''}`}>
        <div className="dl9s-gen__pad">
          <p className="dl9s-vac__padk">policy space</p>
          <svg className="dl9s-svg dl9s-pad" viewBox={`0 0 ${PAD.W} ${PAD.H}`} role="img" aria-label={`${beat >= 2 ? 20 : 100} policies shown as points in the (p, r) policy space`}>
            <PadAxes />
            {gen.map((q, i) => {
              const dead = beat >= 2 && i >= 20;
              const fill = beat >= 1 ? cellFill('rpos', q.score / max, 1) : 'var(--dl9s-floor)';
              return (
                <circle
                  key={q.id}
                  cx={px(q.p)}
                  cy={py(q.r)}
                  r={i < 20 && beat >= 3 ? 5.5 : 4}
                  className={`dl9s-gen__dot dl9s-fade${dead ? ' dl9s-gen__dot--dead' : ''}${inFamily(i) ? ' dl9s-gen__dot--hl' : ''}`}
                  style={{ fill }}
                />
              );
            })}
            {beat >= 3 && survivors.map((q) => <circle key={`ring${q.id}`} cx={px(q.p)} cy={py(q.r)} r={9} className="dl9s-gen__ring" />)}
          </svg>
        </div>
        <div className="dl9s-gen__pop">
          <p className="dl9s-gen__read" aria-live="polite">{READOUT[Math.max(0, beat)]}</p>
          <svg className="dl9s-svg dl9s-gen__grid" viewBox={`0 0 ${GW} ${GH}`} role="img" aria-label={`The population as a 10 by 10 grid: ${READOUT[Math.max(0, beat)]}`} onPointerLeave={() => setHover(null)}>
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((row) => (
              <text key={row} x={gx - 8} y={gy + row * CELL + CELL / 2 + 4} textAnchor="end" className="dl9s-t dl9s-t--xs dl9s-t--m">{row + 1}</text>
            ))}
            {gen.map((_, i) => {
              const q = cellPolicy(i);
              const row = Math.floor(i / 10);
              const col = i % 10;
              const dead = beat === 2 && i >= 20;
              const empty = beat < 0;
              const fill = beat >= 1 && !dead ? cellFill('rpos', q.score / max, 1) : 'var(--dl9s-floor)';
              const x = gx + col * CELL;
              const y = gy + row * CELL;
              return (
                <g key={i} onPointerEnter={() => setHover(i)} className={`dl9s-gen__cell dl9s-fade${empty ? ' dl9s-hide' : ''}`}>
                  <rect x={x + 1.5} y={y + 1.5} width={CELL - 3} height={CELL - 3} rx={3} className={`dl9s-cell${i < 20 && (beat === 2 || beat === 3) ? ' dl9s-gen__surv' : ''}${inFamily(i) ? ' dl9s-cell--hit' : ''}`} style={{ fill }} />
                  {dead && <path d={`M${x + 8} ${y + 8}L${x + CELL - 8} ${y + CELL - 8}M${x + CELL - 8} ${y + 8}L${x + 8} ${y + CELL - 8}`} className="dl9s-gen__x" />}
                </g>
              );
            })}
            <text x={gx} y={gy - 10} className="dl9s-t dl9s-t--xs">{beat >= 3 ? 'rows 1–2: the 20 survivors · rows 3–10: their copies' : beat >= 1 ? 'sorted, best first' : 'one cell per policy'}</text>
            {hp && hover !== null && (
              <Tip x={gx + (hover % 10) * CELL + CELL / 2} y={gy + Math.floor(hover / 10) * CELL + 2} text={beat >= 1 ? `p ${hp.p.toFixed(2)} · r ${hp.r}° · ${pct(hp.score)}` : `p ${hp.p.toFixed(2)} · r ${hp.r}°`} />
            )}
          </svg>
        </div>
      </div>
    </Stage>
  );
}
