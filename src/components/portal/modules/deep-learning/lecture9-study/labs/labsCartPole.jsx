import { useEffect, useRef, useState } from 'react';
import Icon from '../../../../icons';
import { Stage, MLine } from '../stage';
import { useWidth } from '../useWidth';
import { useStudy } from '../context';
import { useReducedMotion } from '../hooks';
import { step, SLIDE17_OBS, SLIDE20_OBS, X_LIMIT, THETA_LIMIT, TIME_LIMIT } from '../cartpole';
import CartScene from './CartScene';
import './labsCartPole.css';

/* ============================================================================
   §4 · OPENAI GYM AND CARTPOLE  (slides 16–20)
   ----------------------------------------------------------------------------
   CartPoleLab   this page's port of CartPole-v1, live. Push the cart left
                 (action 0) or right (action 1) with the buttons or ← →;
                 each press is one env.step(action) and the lab shows what
                 it returns: obs, reward, done, truncated, info. The four
                 observation numbers are labelled gauges (with the ±2.4 and
                 ±12° limits where the episode ends). It opens on slide 17's
                 observation (reset(seed=42)), so the first → reproduces
                 slide 20's output. "Live" runs the clock (half speed, 25
                 steps a second) and keeps pushing the way you last chose:
                 CartPole has no "do nothing" action.
   ========================================================================== */

const GAUGES = [
  { i: 0, name: 'cart position', key: 'obs[0]', range: 3, limit: X_LIMIT, hint: '0.0 = centre' },
  { i: 1, name: 'cart velocity', key: 'obs[1]', range: 2.5, limit: null, hint: '+ = right' },
  { i: 2, name: 'pole angle', key: 'obs[2]', range: 0.3, limit: THETA_LIMIT, hint: '0.0 = vertical' },
  { i: 3, name: 'angular velocity', key: 'obs[3]', range: 3, limit: null, hint: '+ = clockwise' },
];
const f4 = (v) => (v < 0 ? `−${Math.abs(v).toFixed(4)}` : ` ${v.toFixed(4)}`);

function Gauges({ obs, narrow }) {
  const cols = narrow ? 2 : 4;
  const gw = narrow ? 170 : 160;
  const gh = 58;
  const W = cols * gw;
  const H = Math.ceil(4 / cols) * gh;
  return (
    <svg className="dl9s-svg dl9s-gauges" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`The observation: ${GAUGES.map((g) => `${g.name} ${obs[g.i].toFixed(3)}`).join(', ')}`}>
      {GAUGES.map((g, k) => {
        const ox = (k % cols) * gw + 10;
        const oy = Math.floor(k / cols) * gh;
        const w = gw - 26;
        const toX = (v) => ox + w / 2 + (Math.max(-g.range, Math.min(g.range, v)) / g.range) * (w / 2);
        const v = obs[g.i];
        const out = g.limit !== null && Math.abs(v) > g.limit;
        return (
          <g key={g.key}>
            <text x={ox} y={oy + 13} className="dl9s-t dl9s-t--s"><tspan className="dl9s-t--m">{g.key}</tspan> {g.name}</text>
            <line x1={ox} y1={oy + 32} x2={ox + w} y2={oy + 32} className="dl9s-gauge__track" />
            <line x1={toX(0)} y1={oy + 26} x2={toX(0)} y2={oy + 38} className="dl9s-gauge__zero" />
            {g.limit !== null && [-1, 1].map((s) => <line key={s} x1={toX(s * g.limit)} y1={oy + 24} x2={toX(s * g.limit)} y2={oy + 40} className="dl9s-gauge__limit" />)}
            <line x1={toX(0)} y1={oy + 32} x2={toX(v)} y2={oy + 32} className="dl9s-gauge__bar" />
            <circle cx={toX(v)} cy={oy + 32} r={5.5} className={`dl9s-gauge__dot${out ? ' dl9s-gauge__dot--out' : ''}`} />
            <text x={ox} y={oy + 52} className="dl9s-t dl9s-t--xs dl9s-t--m">{f4(v)}</text>
            <text x={ox + w} y={oy + 52} textAnchor="end" className="dl9s-t dl9s-t--xs">{g.hint}</text>
          </g>
        );
      })}
    </svg>
  );
}

function Returned({ last }) {
  if (!last) {
    return (
      <div className="dl9s-ret">
        <p className="dl9s-ret__call"><code>obs, info = env.reset(seed=42)</code><span className="dl9s-ret__note">slide 17’s start</span></p>
        <p className="dl9s-ret__row"><span>obs</span><code className="dl9s-ret__obs">{SLIDE17_OBS.map(f4).join(', ')}</code></p>
        <p className="dl9s-ret__row"><span>info</span><code>{'{}'}</code></p>
      </div>
    );
  }
  return (
    <div className="dl9s-ret">
      <p className="dl9s-ret__call"><code>obs, reward, done, truncated, info = env.step({last.action})</code></p>
      <p className="dl9s-ret__row"><span>obs</span><code className="dl9s-ret__obs">{last.obs.map(f4).join(', ')}</code></p>
      <p className="dl9s-ret__row"><span>reward</span><code className="dl9s-ret__rew">1.0</code></p>
      <p className="dl9s-ret__row"><span>done</span><code className={last.done ? 'dl9s-ret__done' : ''}>{last.done ? 'True' : 'False'}</code></p>
      <p className="dl9s-ret__row"><span>truncated</span><code>{last.truncated ? 'True' : 'False'}</code></p>
      <p className="dl9s-ret__row"><span>info</span><code>{'{}'}</code></p>
    </div>
  );
}

export function CartPoleLab() {
  const wrap = useRef(null);
  const narrow = useWidth(wrap) < 560;
  const reduced = useReducedMotion();
  const { printing } = useStudy();
  const [obs, setObs] = useState(SLIDE17_OBS);
  const [steps, setSteps] = useState(0);
  const [last, setLast] = useState(null);
  const [best, setBest] = useState(0);
  const [live, setLive] = useState(false);
  const [running, setRunning] = useState(false);
  const sim = useRef({ obs: SLIDE17_OBS, steps: 0, done: false, action: 1 });
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const done = !!last?.done;
  const truncated = !!last?.truncated;
  const over = done || truncated;

  const apply = (action) => {
    const s = sim.current;
    if (s.done) return false;
    const r = step(s.obs, action);
    const n = s.steps + 1;
    const tr = !r.terminated && n >= TIME_LIMIT;
    s.obs = r.obs;
    s.steps = n;
    s.done = r.terminated || tr;
    setObs(r.obs);
    setSteps(n);
    setLast({ action, obs: r.obs, done: r.terminated, truncated: tr });
    setBest((b) => Math.max(b, n));
    return !s.done;
  };

  const tick = () => {
    const more = apply(sim.current.action);
    if (more) timer.current = window.setTimeout(tick, 40);
    else setRunning(false);
  };

  const push = (action) => {
    sim.current.action = action;
    if (sim.current.done) return;
    if (live && !reduced) {
      if (!running) {
        setRunning(true);
        tick();
      }
    } else {
      apply(action);
    }
  };

  const reset = () => {
    window.clearTimeout(timer.current);
    sim.current = { obs: SLIDE17_OBS, steps: 0, done: false, action: 1 };
    setObs(SLIDE17_OBS);
    setSteps(0);
    setLast(null);
    setRunning(false);
  };

  const setMode = (m) => {
    window.clearTimeout(timer.current);
    setRunning(false);
    setLive(m);
  };

  const onKey = (e) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); push(0); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); push(1); }
    else if (e.key === 'r' || e.key === 'R') { e.preventDefault(); reset(); }
  };

  const W = narrow ? 360 : 640;
  const firstRight = last && steps === 1 && last.action === 1;

  if (printing) {
    // a filmstrip: slide 17's start, then one push right (slide 20)
    const after = step(SLIDE17_OBS, 1).obs;
    return (
      <Stage title="Balance the pole yourself" slides="slides 17–20" own="this page’s port of CartPole">
        <div className="dl9s-film">
          {[{ o: SLIDE17_OBS, a: null, k: 'env.reset(seed=42): slide 17’s obs' }, { o: after, a: 1, k: 'env.step(1): slide 20’s obs' }].map((f) => (
            <figure key={f.k} className="dl9s-film__frame">
              <CartScene obs={f.o} action={f.a} W={300} H={150} mini />
              <figcaption><span>{f.k}</span><code>[{f.o.map((v) => v.toFixed(4)).join(', ')}]</code></figcaption>
            </figure>
          ))}
        </div>
      </Stage>
    );
  }

  return (
    <Stage
      title="Balance the pole yourself"
      slides="slides 17–20"
      tryThis="Predict which way to push when the pole leans right (obs[2] > 0), then press → once: you get exactly slide 20’s numbers."
      caption="Each push is one `env.step(action)`: 0 accelerates the cart left, 1 right, and every step earns a reward of 1.0. The episode is `done` when the pole tilts past 12° or the cart leaves ±2.4."
      challenge={{ text: 'Keep the pole up for 100 steps yourself.', done: best >= 100 }}
      own="this page’s port of CartPole"
      maths={
        <>
          <MLine text={`Slide 17 resets to $\\texttt{obs} = [0.0273956, -0.00611216, 0.03585979, 0.0197368]$; slide 20 pushes right (action 1) and prints $[0.02727336, 0.18847767, 0.03625453, -0.26141977]$. This page’s port gives $[${step(SLIDE17_OBS, 1).obs.map((v) => v.toFixed(8)).join(', ')}]$: the same to within $10^{-8}$ (the slides print float32).`} />
          <MLine text="The first and third numbers move by one time step $\tau = 0.02$ s times the velocity: $0.0273956 + 0.02 \times (-0.00611216) = 0.02727336$ and $0.03585979 + 0.02 \times 0.0197368 = 0.03625453$. The push changes the two velocities, which move the position and angle on the next step." />
          <p className="dl9s-mnote">The physics (gravity 9.8, cart 1.0, pole 0.1, half-length 0.5, force 10, τ = 0.02 s, the ±12° and ±2.4 limits, 500 steps before CartPole-v1 truncates) is ported from Gymnasium’s source, not the slides. The slides’ own loops stop each episode at 200 steps.</p>
        </>
      }
    >
      <div ref={wrap} className={`dl9s-cp${narrow ? ' dl9s-cp--narrow' : ''}`} tabIndex={0} onKeyDown={onKey} aria-label="CartPole. Left and right arrow keys push the cart; R resets.">
        <div className="dl9s-floorrow">
          <div className="dl9s-switch" role="group" aria-label="How the clock runs">
            <button type="button" className={`dl9s-switch__opt${!live ? ' dl9s-switch__opt--on' : ''}`} aria-pressed={!live} onClick={() => setMode(false)}>one step per press</button>
            <button type="button" className={`dl9s-switch__opt${live ? ' dl9s-switch__opt--on' : ''}`} aria-pressed={live} onClick={() => setMode(true)} disabled={reduced} title={reduced ? 'Live mode is off while reduced motion is on' : undefined}>live (half speed)</button>
          </div>
          <p className="dl9s-cp__count" aria-live="polite">
            step <b>{steps}</b> · total reward <b>{steps.toFixed(1)}</b>{best > 0 && <span> · best {best}</span>}
          </p>
        </div>
        <div className="dl9s-cp__scene">
          <CartScene obs={obs} action={last?.action ?? null} done={done} W={W} />
          {over && (
            <p className="dl9s-cp__over">
              {done ? <>done = <b>True</b> after {steps} steps</> : <>truncated = <b>True</b> at {TIME_LIMIT} steps</>}
              <button type="button" className="dl9s-cp__again" onClick={reset}>reset</button>
            </p>
          )}
          {firstRight && !over && <p className="dl9s-cp__match">slide 20’s output</p>}
        </div>
        <div className="dl9s-cp__pads">
          <button type="button" className="dl9s-cp__pad" onClick={() => push(0)} disabled={over} aria-label="Action 0: push the cart left">
            <Icon name="arrowLeft" size={18} /> <span>push left</span> <code>0</code>
          </button>
          <button type="button" className="dl9s-cp__reset" onClick={reset}>reset</button>
          <button type="button" className="dl9s-cp__pad" onClick={() => push(1)} disabled={over} aria-label="Action 1: push the cart right">
            <code>1</code> <span>push right</span> <Icon name="arrowRight" size={18} />
          </button>
        </div>
        <div className="dl9s-cp__read">
          <Gauges obs={obs} narrow={narrow} />
          <Returned last={last} />
        </div>
      </div>
    </Stage>
  );
}
