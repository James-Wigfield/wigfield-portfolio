import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import manifest from './index.js';
import { useRound } from '../../kit/useRound';
import { RoundShell, Prompt, Feedback } from '../../kit/RoundShell';
import { Choice } from '../../kit/Choice';
import { Maths, MLine, MEq } from '../../kit/Maths';
import { Why } from '../../kit/WhyText';
import { receipt } from '../../kit/why';
import { Tex } from '../../../kit';
import { rng } from '../../core/rng';
import { makeItems, swing, schedCurve, fmtVec } from '../../maths/descentItems.js';
import { contours } from '../../maths/descentHoles.js';
import { EQUATIONS } from '../../content/lecture2.js';
import { INTRO, CLUBS, HOLES, STATUS, PAR_RULE, DEFAULTS_NOTE, DIAL, CLIP, SCHED } from '../../content/descent.js';
import {
  COURSE, toSvg, LEVELS, pathD, endStep, at, dialAngle, polar, arcD, DIAL_TICKS, fmtTick,
  swingArrow, headD, firstStep, fmtV, canonical, CHART, chartScale, chartLine, lossLine,
} from './courseView.js';
import './descent.css';

/* ============================================================================
   DESCENT (Lecture 2) — optimiser golf
   ----------------------------------------------------------------------------
   Each hole is a 2D loss surface drawn as a contour map. You call the club
   that makes par (the graded answer), then Swing: your ball rolls by the
   club's update rule from the slides (maths/descent.js), racing the par
   club's ghost. Par was computed by swinging every club in the bag
   (maths/descentItems.js). Other items on the same stage: the learning-rate
   dial (slide 48), the cliff and gradient clipping (slide 29), schedule
   power-ups (slides 50–59) and the update equations themselves.
   ========================================================================== */
const HOLD_MS = 650; // the result stays up this long before the round moves on
const STEPS_PER_S = 95;

function useReducedMotion() {
  const [reduced] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  return reduced;
}

const asciiMinus = (s) => String(s).replace(/−/g, '-'); // KaTeX wants an ASCII minus
const fmtChoice = (v, item) => item.choices?.find((c) => c.value === v)?.label ?? String(v);

export default function Descent({ seed, level, mode, durationMs, onRoundEnd, host }) {
  const items = useMemo(() => makeItems(rng(seed), level), [seed, level]);
  const round = useRound({ gameId: manifest.id, seed, level, mode, durationMs, onRoundEnd, items });
  const item = round.current;
  return (
    <RoundShell game={manifest} round={round} host={host} intro={INTRO} stageClass="dla-dc">
      {item && <Stage key={item.id} item={item} round={round} />}
    </RoundShell>
  );
}

function Stage({ item, round }) {
  switch (item.type) {
    case 'hole': return <HoleStage item={item} round={round} />;
    case 'dial': return <DialStage item={item} round={round} />;
    case 'clip': return <ClipStage item={item} round={round} />;
    case 'sched': return <SchedStage item={item} round={round} />;
    default: return <EqStage item={item} round={round} />;
  }
}

/* ── the course: contours, tee, cup and flag; children draw on top ────── */
function Course({ spec, label, children, overlay = null, holed = false, axes = null }) {
  const clip = `dc${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const iso = useMemo(() => contours(spec, LEVELS[spec.kind] ?? 10), [spec]);
  const [fx, fy] = toSvg(spec.flag);
  const [tx, ty] = toSvg(spec.start);
  const cupR = (spec.r / (COURSE.x1 - COURSE.x0)) * COURSE.W;
  return (
    <svg className="dla-svg dla-dc__course" viewBox={`0 0 ${COURSE.W} ${COURSE.H}`} role="img" aria-label={label}>
      <defs>
        <clipPath id={clip}><rect x="0" y="0" width={COURSE.W} height={COURSE.H} rx="10" /></clipPath>
      </defs>
      <g clipPath={`url(#${clip})`}>
        {iso.map((c, i) => <path key={i} d={c.d} className="dla-dc__iso" style={{ strokeOpacity: 0.9 - 0.62 * c.depth }} />)}
        <circle cx={fx} cy={fy} r={cupR} className={`dla-dc__cup${holed ? ' dla-dc__cup--holed' : ''}`} />
        <path d={`M${tx - 6} ${ty}h12M${tx} ${ty - 6}v12`} className="dla-dc__tee" />
        {children}
      </g>
      <g className="dla-dc__flag" aria-hidden="true">
        <line x1={fx} y1={fy} x2={fx} y2={fy - 34} />
        <path d={`M${fx} ${fy - 34}l16 5l-16 5z`} />
      </g>
      {axes && (
        <g aria-hidden="true">
          <text x={COURSE.W / 2} y={COURSE.H - 6} textAnchor="middle" className="dla-t--xs dla-halo">{axes[0]}</text>
          <text x={12} y={COURSE.H / 2} textAnchor="middle" transform={`rotate(-90 12 ${COURSE.H / 2})`} className="dla-t--xs dla-halo">{axes[1]}</text>
        </g>
      )}
      {overlay}
    </svg>
  );
}

/* the learning-rate dial (log scale), drawn inside the course's corner */
function Dial({ eta, cx = COURSE.W - 50, cy = 46, r = 30, big = false, turned = null }) {
  const a = turned ?? dialAngle(eta);
  return (
    <g className={`dla-dc__dial${big ? ' dla-dc__dial--big' : ''}`} aria-hidden="true">
      <circle cx={cx} cy={cy} r={r + (big ? 24 : 8)} className="dla-dc__dialbg" />
      <path d={arcD(cx, cy, r, -120, 120)} className="dla-dc__dialarc" />
      {DIAL_TICKS.map((t) => {
        const [x0, y0] = polar(cx, cy, r, dialAngle(t));
        const [x1, y1] = polar(cx, cy, r - 5, dialAngle(t));
        return <line key={t} x1={x0} y1={y0} x2={x1} y2={y1} className="dla-dc__dialtick" />;
      })}
      {big && DIAL_TICKS.map((t) => {
        const [x, y] = polar(cx, cy, r + 14, dialAngle(t));
        return <text key={`l${t}`} x={x} y={y + 3} textAnchor="middle" className="dla-t--xs dla-t--m">{fmtTick(t)}</text>;
      })}
      <g className="dla-dc__needleg" style={{ transform: `rotate(${a}deg)`, transformOrigin: `${cx}px ${cy}px` }}>
        <line x1={cx} y1={cy} x2={cx} y2={cy - (r - 6)} className="dla-dc__needle" />
      </g>
      <circle cx={cx} cy={cy} r={3} className="dla-dc__hub" />
    </g>
  );
}

/* ── a hole: call the club, swing, watch the race ─────────────────────── */
function HoleStage({ item, round }) {
  const spec = item.hole;
  const H = HOLES[spec.kind];
  const reduced = useReducedMotion();
  const bag = useMemo(() => item.choices.map((c) => c.value), [item]);
  const paths = useMemo(() => Object.fromEntries(bag.map((c) => [c, swing(spec, c).path])), [bag, spec]);
  const [pick, setPick] = useState(null);
  const [phase, setPhase] = useState('aim'); // aim → swing → done
  const [k, setK] = useState(0);
  const fb = round.feedback;
  const submit = round.submit;
  const live = round.state === 'play' && !fb && phase === 'aim';
  const mine = fb ? fb.given : pick;
  const parClub = item.par.club;
  const endK = endStep(item, mine && bag.includes(mine) ? mine : null);
  const showK = phase === 'aim' && !fb ? 0 : phase === 'swing' ? k : endK;
  const revealed = phase !== 'aim' || !!fb;

  const doSwing = useCallback(() => {
    if (!pick || phase !== 'aim' || fb) return;
    if (reduced) {
      setK(endK);
      setPhase('done');
    } else setPhase('swing');
  }, [pick, phase, fb, reduced, endK]);

  // the swing: step through the paths at a fixed pace (both balls together)
  useEffect(() => {
    if (phase !== 'swing') return undefined;
    let raf = 0;
    const t0 = performance.now();
    const dur = Math.max(500, Math.min(1700, (endK / STEPS_PER_S) * 1000));
    const tick = (now) => {
      const f = Math.min(1, (now - t0) / dur);
      setK(Math.round(f * endK));
      if (f < 1) raf = window.requestAnimationFrame(tick);
      else setPhase('done');
    };
    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [phase, endK]);

  // the call is graded once the race is over
  useEffect(() => {
    if (phase !== 'done') return undefined;
    const id = window.setTimeout(() => submit(pick), HOLD_MS);
    return () => window.clearTimeout(id);
  }, [phase, pick, submit]);

  // keys: 1–n pick a club, Enter / Space swing
  useEffect(() => {
    if (!live) return undefined;
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.target && /^(input|textarea|select)$/i.test(e.target.tagName)) return;
      const n = Number(e.key);
      if (n >= 1 && n <= bag.length) {
        e.preventDefault();
        setPick(bag[n - 1]);
      } else if ((e.key === 'Enter' || e.key === ' ') && pick) {
        e.preventDefault();
        doSwing();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [live, bag, pick, doSwing]);

  // par's ghost first, your ball on top
  const drawn = revealed ? [...new Set([parClub, mine].filter((c) => c && paths[c]))] : [];
  const holedNow = drawn.some((c) => item.results[c].steps !== null && showK >= item.results[c].steps);
  const sel = pick ?? (fb ? fb.given : null);

  return (
    <>
      <Prompt k={`hole ${round.index + 1} / ${round.total} · ${H.name}`} sub={H.line}>Which club makes par?</Prompt>
      <Feedback feedback={fb} format={fmtChoice} />
      <div className="dla-dc__grid">
        <div className="dla-floor dla-dc__floor" data-phase={phase}>
          <Course
            spec={spec}
            holed={holedNow}
            axes={H.axes ?? null}
            label={`${H.name}: ${H.line} Contour map with the tee on the left and the flag in the cup.`}
            overlay={<Dial eta={spec.eta} />}
          >
            {drawn.map((c) => {
              const p = paths[c].slice(0, showK + 1);
              const you = c === mine;
              return (
                <g key={c} className={`dla-dc__run dla-dc__run--${you ? 'you' : 'par'}`}>
                  <path d={pathD(p)} className="dla-dc__trail" />
                  {p.length < 90 && p.map((q, i) => {
                    const [x, y] = toSvg(q);
                    return i ? <circle key={i} cx={x} cy={y} r={1.8} className="dla-dc__dotstep" /> : null;
                  })}
                </g>
              );
            })}
            {(drawn.length ? drawn : [null]).map((c) => {
              const [x, y] = toSvg(c ? at(paths[c], showK) : spec.start);
              return <circle key={c ?? 'tee'} cx={x} cy={y} r={7} className={`dla-dc__ball${c && c !== mine ? ' dla-dc__ball--ghost' : ''}`} />;
            })}
          </Course>
          <p className="dla-dc__caption">
            <span><span className="dla-k">dial</span> <b>η = {spec.eta}</b> for every club</span>
            {revealed && (
              <span className="dla-dc__legend">
                <span><i className="dla-dc__key dla-dc__key--you" aria-hidden="true" />{STATUS.you}</span>
                {mine !== parClub && <span><i className="dla-dc__key dla-dc__key--par" aria-hidden="true" />{STATUS.par}</span>}
              </span>
            )}
          </p>
        </div>
        <div className="dla-dc__side">
          <div className="dla-dc__bag" role="radiogroup" aria-label="Your bag: pick the club that makes par">
            {item.choices.map((c, i) => {
              const on = sel === c.value;
              const right = revealed && c.value === parClub;
              const wrong = revealed && on && c.value !== parClub;
              return (
                <button
                  key={c.value}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  aria-label={`${i + 1}: ${c.label} (${CLUBS[c.value].name})`}
                  className={`dla-choice dla-dc__club${on ? ' dla-dc__club--on' : ''}${right ? ' dla-choice--right' : ''}${wrong ? ' dla-choice--wrong' : ''}`}
                  disabled={!live}
                  onClick={() => setPick(c.value)}
                >
                  <span className="dla-choice__n" aria-hidden="true">{i + 1}</span>
                  <span className="dla-choice__body">
                    <span className="dla-choice__label">{c.label}</span>
                    {CLUBS[c.value].hp && <span className="dla-choice__sub">{CLUBS[c.value].hp}</span>}
                  </span>
                </button>
              );
            })}
          </div>
          <button type="button" className="dla-btn dla-btn--primary dla-btn--big dla-dc__swing" disabled={!pick || !live} onClick={doSwing}>
            Swing <span className="dla-btn__key">Enter</span>
          </button>
          {revealed ? <Scorecard item={item} mine={mine} upTo={showK} final={phase === 'done' || !!fb} /> : <p className="dla-k dla-dc__par"><span className="dla-dot" aria-hidden="true" />{PAR_RULE.short}</p>}
        </div>
      </div>
      <HoleMaths item={item} club={sel} revealed={revealed} />
    </>
  );
}

function Scorecard({ item, mine, upTo, final }) {
  const bag = canonical(item.choices.map((c) => c.value));
  return (
    <ol className="dla-dc__card" aria-label="Scorecard">
      {bag.map((c) => {
        const r = item.results[c];
        const done = final || (r.steps !== null ? upTo >= r.steps : upTo >= endStep(item, c));
        const text = r.status === 'holed' ? `${STATUS.holed} ${r.steps} ${STATUS.ofSteps}` : STATUS[r.status];
        const tag = c === item.par.club ? STATUS.par : c === mine ? STATUS.you : '';
        return (
          <li key={c} className={`dla-dc__row${c === mine ? ' dla-dc__row--you' : ''}${c === item.par.club ? ' dla-dc__row--par' : ''}`}>
            <span className="dla-dc__rowdot" aria-hidden="true" />
            <b>{CLUBS[c].label}</b>
            <span className="dla-dc__rowtxt">{done ? text : '…'}</span>
            {tag && <span className="dla-k">{tag}</span>}
          </li>
        );
      })}
    </ol>
  );
}

function HoleMaths({ item, club, revealed }) {
  const spec = item.hole;
  const C = club ? CLUBS[club] : null;
  const first = useMemo(() => (club ? firstStep(spec, club) : null), [spec, club]);
  return (
    <Maths>
      {C ? (
        <>
          <MLine><b>{C.label}</b> · {C.name} · {receipt(C.src)}</MLine>
          {EQUATIONS[C.eq].tex.map((t) => <MEq key={t} tex={t} />)}
          <MLine text={`On this hole every club swings with $\\eta = ${spec.eta}$${C.hp ? `; ${C.hp}` : ''}.`} />
          <MLine text={`First step from the tee: $\\nabla_\\theta J(\\theta) = ${asciiMinus(fmtV(first.g))}$${first.ahead ? ' (NAG measures it at $\\theta + \\beta\\mathbf{m}$, which is the tee itself while $\\mathbf{m} = 0$)' : ''}, then $\\theta = ${asciiMinus(fmtV(first.theta1))}$.`} />
        </>
      ) : (
        <MLine>Pick a club to see its update rule from the slides.</MLine>
      )}
      {DEFAULTS_NOTE.map((d) => <MLine key={d.sym} text={`$${d.sym}$: ${d.text} (${receipt(d.src)}).`} />)}
      <MLine>{PAR_RULE.text}</MLine>
      {revealed && <MLine text={`Par: ${CLUBS[item.par.club].label}, ${item.par.steps} steps.`} />}
    </Maths>
  );
}

/* the kit's Choice with KaTeX labels where a choice carries `tex` */
function Pick({ item, round, columns = 1 }) {
  const fb = round.feedback;
  const live = round.state === 'play' && !fb;
  const choices = useMemo(() => item.choices.map((c) => ({ value: c.value, aria: c.label, sub: c.sub, label: c.tex ? <Tex src={c.tex} /> : c.label })), [item]);
  return <Choice choices={choices} onPick={(v) => round.submit(v)} picked={fb ? fb.given : null} answer={fb ? item.answer : null} active={live} columns={columns} label="Answers" />;
}

/* ── the learning-rate dial (slide 48) ─────────────────────────────────── */
function DialStage({ item, round }) {
  const spec = item.hole;
  const path = useMemo(() => swing(spec, 'sgd').path, [spec]);
  const fb = round.feedback;
  // after the answer the needle turns the right way (down or up a decade)
  const turned = fb ? dialAngle(item.answer === 'down' ? item.eta / 10 : item.eta * 10) : null;
  return (
    <>
      <Prompt k={`${round.index + 1} / ${round.total} · the learning-rate dial`}>{DIAL.prompt}</Prompt>
      <Feedback feedback={fb} format={fmtChoice} />
      <div className="dla-dc__grid">
        <div className="dla-floor dla-dc__floor">
          <Course
            spec={spec}
            label={`A round bowl. SGD's trail at η = ${item.eta}: ${item.answer === 'down' ? 'the ball zig-zags further out every step' : 'the ball has barely moved from the tee'}.`}
            overlay={<Dial eta={item.eta} big cx={COURSE.W - 70} cy={72} r={30} turned={turned} />}
          >
            <g className="dla-dc__run dla-dc__run--you">
              <path d={pathD(path)} className="dla-dc__trail" />
              {path.map((q, i) => {
                const [x, y] = toSvg(q);
                return i ? <circle key={i} cx={x} cy={y} r={2.2} className="dla-dc__dotstep" /> : null;
              })}
            </g>
            {(() => {
              const [x, y] = toSvg(at(path, path.length - 1));
              return <circle cx={x} cy={y} r={7} className="dla-dc__ball" />;
            })()}
          </Course>
          <p className="dla-dc__caption">
            <span><span className="dla-k">dial</span> <b>η = {item.eta}</b> · SGD</span>
            {fb && <span><span className="dla-dot" aria-hidden="true" />{DIAL.trail[item.answer]}</span>}
          </p>
        </div>
        <div className="dla-dc__side">
          <Pick item={item} round={round} />
        </div>
      </div>
      <Maths>
        <MEq tex={EQUATIONS.gd.tex[0]} />
        <MLine text={`SGD at $\\eta = ${item.eta}$ on this bowl, for ${path.length - 1} steps.`} />
        <MLine>{receipt(DIAL.src)}: too high may diverge; too low will eventually converge, but take a very long time.</MLine>
      </Maths>
    </>
  );
}

/* ── the cliff: gradient clipping (slide 29) ───────────────────────────── */
function ClipStage({ item, round }) {
  const spec = item.hole;
  const fb = round.feedback;
  const ball = spec.start;
  const raw = swingArrow(ball, item.g);
  const cv = swingArrow(ball, item.clipped.value);
  const cn = swingArrow(ball, item.clipped.norm);
  const showValue = fb || (item.variant === 'which' && item.shown === 'clipvalue');
  const showNorm = fb || (item.variant === 'which' && item.shown === 'clipnorm');
  const named = !!fb;
  const [bx, by] = toSvg(ball);
  const arrow = (a, cls) => (
    <g className={`dla-dc__arrow ${cls}`}>
      <line x1={a.x0} y1={a.y0} x2={a.x1} y2={a.y1} />
      <path d={headD(a.x0, a.y0, a.x1, a.y1)} />
    </g>
  );
  const taken = item.variant === 'which' && !fb;
  return (
    <>
      <Prompt k={`${round.index + 1} / ${round.total} · ${CLIP.hole.name}`} sub={CLIP.hole.line}>{item.variant === 'value' ? CLIP.value.prompt : item.promptText}</Prompt>
      <Feedback feedback={fb} format={fmtChoice} />
      <div className="dla-dc__grid">
        <div className="dla-floor dla-dc__floor">
          <Course spec={spec} label={`${CLIP.hole.name}: the ball sits on a steep wall. The gradient there is ${fmtVec(item.g)}; the raw swing would fly off the course.`}>
            {arrow(raw, `dla-dc__arrow--raw${taken ? ' dla-dc__arrow--faint' : ''}`)}
            {showValue && arrow(cv, taken ? 'dla-dc__arrow--taken' : 'dla-dc__arrow--value')}
            {showNorm && arrow(cn, taken ? 'dla-dc__arrow--taken' : 'dla-dc__arrow--norm')}
            <circle cx={bx} cy={by} r={7} className="dla-dc__ball" />
          </Course>
          <p className="dla-dc__caption">
            <span><span className="dla-k">gradient at the ball</span> <Tex src={`\\nabla_\\theta J(\\theta) = ${asciiMinus(fmtVec(item.g))}`} /></span>
            <span className="dla-dc__legend">
              <span><i className="dla-dc__key dla-dc__key--raw" aria-hidden="true" />{raw.cut ? CLIP.labels.rawOff : CLIP.labels.raw}</span>
              {taken && <span><i className="dla-dc__key dla-dc__key--taken" aria-hidden="true" />{CLIP.labels.taken}</span>}
              {named && <span><i className="dla-dc__key dla-dc__key--value" aria-hidden="true" />{CLIP.labels.value} → {fmtVec(item.clipped.value)}</span>}
              {named && <span><i className="dla-dc__key dla-dc__key--norm" aria-hidden="true" />{CLIP.labels.norm} → {CLIP.labels.sameDir}</span>}
            </span>
          </p>
        </div>
        <div className="dla-dc__side">
          <Pick item={item} round={round} />
        </div>
      </div>
    </>
  );
}

/* ── the schedule power-ups (slides 50–59) ─────────────────────────────── */
function SchedStage({ item, round }) {
  const fb = round.feedback;
  const curve = useMemo(() => (item.curve ? schedCurve(item) : null), [item]);
  const sc = curve ? chartScale(curve) : null;
  const tex = item.curve === 'power' ? SCHED.power.tex : item.curve === 'exponential' ? SCHED.exponential.tex : null;
  const p = item.params;
  const values = item.curve === 'power' ? `\\eta_0 = ${p.eta0},\\ r = ${p.r},\\ s = ${p.s},\\ c = ${p.c},\\ t = ${item.t}`
    : item.curve === 'exponential' && p ? `\\eta_0 = ${p.eta0},\\ r = ${p.r},\\ s = ${p.s},\\ t = ${item.t}` : null;
  const name = SCHED.names[item.concept.replace('sched.', '')]?.label ?? 'power-up';
  const showName = item.variant !== 'shape' && item.variant !== 'fact';
  const line = item.variant === 'shape' ? SCHED.shape.prompt : item.variant === 'fact' ? item.promptText : item.variant === 'performance' ? SCHED.performance.prompt : SCHED[item.variant]?.prompt;
  const hasFloor = !!(curve || tex);
  return (
    <>
      <Prompt k={`${round.index + 1} / ${round.total} · power-up${showName ? ` · ${name}` : ''}`}>{line}</Prompt>
      <Feedback feedback={fb} format={fmtChoice} />
      <div className={hasFloor ? 'dla-dc__grid' : 'dla-dc__eq'}>
        {hasFloor && <div className="dla-floor dla-dc__floor dla-dc__floor--chart">
          {tex && <div className="dla-dc__formula"><Tex src={tex} /> <Tex src={values} /></div>}
          {item.variant === 'piecewise' && <p className="dla-dc__formula"><code className="dla-code">{SCHED.piecewise.code}</code> <Tex src={`t = ${item.t.toLocaleString('en-AU').replace(/,/g, '{,}')}`} /></p>}
          {item.variant === 'performance' && <p className="dla-dc__formula"><code className="dla-code">{SCHED.performance.code}</code></p>}
          {curve && (
            <svg className="dla-svg dla-dc__chart" viewBox={`0 0 ${CHART.W} ${CHART.H}`} role="img" aria-label={item.variant === 'shape' ? 'A learning-rate curve against the step' : `${name}: the learning rate against the step`}>
              <line x1={CHART.l} y1={CHART.H - CHART.b} x2={CHART.W - CHART.r} y2={CHART.H - CHART.b} className="dla-dc__axis" />
              <line x1={CHART.l} y1={CHART.t} x2={CHART.l} y2={CHART.H - CHART.b} className="dla-dc__axis" />
              {curve.loss && <path d={lossLine(curve)} className="dla-dc__loss" />}
              <path d={chartLine(curve, sc)} className="dla-dc__eta" />
              {curve.mark !== null && (
                <g>
                  <line x1={sc.X(curve.mark)} y1={CHART.t} x2={sc.X(curve.mark)} y2={CHART.H - CHART.b} className="dla-dc__mark" />
                  <text x={sc.X(curve.mark)} y={CHART.H - CHART.b + 16} textAnchor="middle" className="dla-t--xs dla-t--m">t = {curve.mark.toLocaleString('en-AU')}</text>
                </g>
              )}
              <text x={CHART.l - 8} y={CHART.t + 10} textAnchor="end" className="dla-t--s">η</text>
              <text x={CHART.W - CHART.r} y={CHART.H - 6} textAnchor="end" className="dla-t--xs">{SCHED.shape.legend.t}</text>
              {curve.loss && <text x={CHART.W - CHART.r} y={CHART.t + 4} textAnchor="end" className="dla-t--xs dla-dc__losslabel">{SCHED.shape.legend.loss}</text>}
            </svg>
          )}
        </div>}
        <div className={hasFloor ? 'dla-dc__side' : undefined}>
          <Pick item={item} round={round} columns={hasFloor ? 1 : 2} />
        </div>
      </div>
      {tex && (
        <Maths>
          <MEq tex={tex} />
          <MLine text={SCHED[item.curve].why} />
          <MLine>{receipt(item.src)}</MLine>
        </Maths>
      )}
    </>
  );
}

/* ── the equations themselves ──────────────────────────────────────────── */
function EqStage({ item, round }) {
  const fb = round.feedback;
  const wide = item.choices.some((c) => c.tex || c.label.length > 28);
  return (
    <>
      <Prompt k={`${round.index + 1} / ${round.total} · the club card · ${receipt(item.src)}`}><Why text={item.prompt} /></Prompt>
      <Feedback feedback={fb} format={fmtChoice} />
      <div className="dla-dc__eq">
        <Pick item={item} round={round} columns={wide ? 1 : 2} />
      </div>
    </>
  );
}
