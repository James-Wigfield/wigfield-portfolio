import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from '../../../../icons';
import { Stage, MLine } from '../stage';
import { Tip } from '../svgParts';
import { useWidth } from '../useWidth';
import { useStudy } from '../context';
import { useReducedMotion } from '../hooks';
import { rng } from '../rl';
import { basicPolicy, runEpisode, reset } from '../cartpole';
import CartScene from './CartScene';
import './labsBasic.css';

/* ============================================================================
   §5 · A SIMPLE HARD-CODED POLICY  (slides 21–22)
   ----------------------------------------------------------------------------
   BasicPolicyLab  left: slide 21's basic_policy (0 if angle < 0 else 1)
                   driving this page's port of CartPole; ▶ plays a fresh
                   episode at a third of real speed, the push arrow follows
                   the policy and the code line lights the branch it took.
                   right: the 500-episode histogram of episode lengths from
                   this page's own offline run of slide 22's exact code in
                   Gymnasium 1.3.0 (../data/basicRun.js, lazy), whose stats
                   (41.698, 8.389445512070509, 24.0, 63.0) match slide 22's
                   printed output exactly; the mean and the max are marked,
                   a bar's count shows on hover, and the live episode's
                   length is dropped onto the axis. Reduced motion / print:
                   a filmstrip of the episode instead of the animation.
   ========================================================================== */

const FIRST_SEED = 7;
const MS_PER_STEP = 60; // a third of real time (CartPole's step is 0.02 s)
const X0 = 20;
const X1 = 70;
const deg = (rad) => (rad * 180) / Math.PI;
const sgn4 = (v) => `${v < 0 ? '−' : '+'}${Math.abs(v).toFixed(4)}`;

function episode(seed) {
  const ep = runEpisode(basicPolicy, reset(rng(seed)));
  return { ...ep, seed, len: ep.actions.length, done: ep.actions.length < 200 };
}

const FIRST_EP = episode(FIRST_SEED);

function Histogram({ totals, live, narrow }) {
  const [hover, setHover] = useState(null);
  const W = narrow ? 340 : 420;
  const H = 232;
  const m = { l: 34, r: 12, t: 30, b: 62 };
  const counts = useMemo(() => {
    const c = new Map();
    totals.forEach((t) => c.set(t, (c.get(t) ?? 0) + 1));
    return c;
  }, [totals]);
  const cmax = Math.max(...counts.values());
  const yMax = Math.ceil(cmax / 10) * 10;
  const bw = (W - m.l - m.r) / (X1 - X0 + 1);
  const X = (v) => m.l + (v - X0) * bw;
  const Y = (c) => H - m.b - (c / yMax) * (H - m.t - m.b);
  const mean = totals.reduce((a, b) => a + b, 0) / totals.length;
  const max = Math.max(...totals);
  const lens = [...counts.keys()].sort((a, b) => a - b);
  return (
    <svg className="dl9s-svg dl9s-bp__hist" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Histogram of 500 episode lengths under basic_policy: mean ${mean.toFixed(3)}, maximum ${max} steps${live ? `; the live episode lasted ${live} steps` : ''}`} onPointerLeave={() => setHover(null)}>
      {[0, yMax / 2, yMax].map((c) => (
        <g key={c}>
          <line x1={m.l} y1={Y(c)} x2={W - m.r} y2={Y(c)} className="dl9s-grid-line" />
          <text x={m.l - 6} y={Y(c) + 4} textAnchor="end" className="dl9s-t dl9s-t--xs dl9s-t--m">{c}</text>
        </g>
      ))}
      {lens.map((v) => (
        <rect
          key={v}
          x={X(v) - bw / 2 + 0.6}
          y={Y(counts.get(v))}
          width={Math.max(1, bw - 1.2)}
          height={H - m.b - Y(counts.get(v))}
          className={`dl9s-bar--pos dl9s-bp__bar${hover === v ? ' dl9s-bp__bar--hit' : ''}`}
          onPointerEnter={() => setHover(v)}
        />
      ))}
      <line x1={m.l} y1={H - m.b} x2={W - m.r} y2={H - m.b} className="dl9s-ax" />
      {[20, 30, 40, 50, 60, 70].map((v) => (
        <text key={v} x={X(v)} y={H - m.b + 14} textAnchor="middle" className="dl9s-t dl9s-t--xs dl9s-t--m">{v}</text>
      ))}
      <text x={W - m.r} y={H - m.b + 56} textAnchor="end" className="dl9s-t dl9s-t--xs">steps the pole stayed up (= total reward)</text>
      <text x={m.l} y={m.t - 18} className="dl9s-t dl9s-t--xs">episodes (of 500)</text>
      {/* the mean and the max, as slide 22 prints them */}
      <line x1={X(mean)} y1={m.t - 6} x2={X(mean)} y2={H - m.b} className="dl9s-bp__mean" />
      <text x={X(mean) - 4} y={m.t - 8} textAnchor="end" className="dl9s-t dl9s-t--xs dl9s-t--b dl9s-bp__lab">mean {mean.toFixed(3)}</text>
      <line x1={X(max)} y1={m.t + 18} x2={X(max)} y2={H - m.b} className="dl9s-bp__max" />
      <text x={X(max)} y={m.t + 12} textAnchor="middle" className="dl9s-t dl9s-t--xs dl9s-t--b dl9s-bp__lab">max {max}</text>
      {live !== null && (
        <g className="dl9s-bp__live">
          <polygon points={`${X(Math.min(X1, live))},${H - m.b + 19} ${X(Math.min(X1, live)) - 5},${H - m.b + 27} ${X(Math.min(X1, live)) + 5},${H - m.b + 27}`} />
          <text x={X(Math.min(X1, live))} y={H - m.b + 39} textAnchor="middle" className="dl9s-t dl9s-t--xs dl9s-t--act dl9s-t--b">the cart’s episode: {live}</text>
        </g>
      )}
      {hover !== null && <Tip x={X(hover)} y={Y(counts.get(hover)) - 2} text={`${hover} steps: ${counts.get(hover)} episode${counts.get(hover) === 1 ? '' : 's'}`} />}
    </svg>
  );
}

function Filmstrip({ ep }) {
  const n = ep.states.length - 1;
  const idx = [0, Math.round(n / 3), Math.round((2 * n) / 3), n];
  return (
    <div className="dl9s-film dl9s-bp__film">
      {idx.map((i) => (
        <figure key={i} className="dl9s-film__frame">
          <CartScene obs={ep.states[i]} action={i < n ? ep.actions[i] : null} done={i === n && ep.done} W={300} H={150} mini />
          <figcaption>
            <span>step {i}{i === n && ep.done ? ' · done' : ''}</span>
            <code>angle {sgn4(ep.states[i][2])}{i < n ? ` → ${ep.actions[i]}` : ''}</code>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

export function BasicPolicyLab() {
  const wrap = useRef(null);
  const narrow = useWidth(wrap) < 640;
  const reduced = useReducedMotion();
  const { printing } = useStudy();
  const [data, setData] = useState(null);
  const [epState, setEp] = useState(FIRST_EP);
  const [frame, setFrame] = useState(null); // null = the episode's last frame
  const [played, setPlayed] = useState([]);
  const raf = useRef(0);

  useEffect(() => {
    let live = true;
    import('../data/basicRun.js').then((m) => { if (live) setData(m.BASIC_RUN); });
    return () => { live = false; cancelAnimationFrame(raf.current); };
  }, []);

  const still = printing || reduced;
  const play = () => {
    cancelAnimationFrame(raf.current);
    const next = episode(epState.seed + 1);
    setEp(next);
    setPlayed((ps) => [...ps, next.len]);
    if (still) { setFrame(null); return; }
    const t0 = performance.now();
    setFrame(0);
    const tick = (now) => {
      const f = Math.max(0, Math.min(next.len, Math.floor((now - t0) / MS_PER_STEP)));
      setFrame(f);
      if (f < next.len) raf.current = requestAnimationFrame(tick);
      else setFrame(null);
    };
    raf.current = requestAnimationFrame(tick);
  };

  const ep = printing ? FIRST_EP : epState;
  const f = printing ? ep.len : frame ?? ep.len;
  const obs = ep.states[f];
  const running = !printing && frame !== null;
  const action = f < ep.len ? ep.actions[f] : ep.actions[ep.len - 1];
  const over = !running && ep.done;
  const angle = obs[2];
  const beat50 = played.some((l) => l > 50);

  return (
    <Stage
      title="basic_policy: lean left, push left"
      slides="slides 21–22"
      tryThis="Predict how long `basic_policy` keeps the pole up, press ▶, then see where your episode lands among slide 22’s 500."
      caption="The histogram is this page’s own offline run of slide 22’s exact code in Gymnasium 1.3.0: it prints `(41.698, 8.389445512070509, 24.0, 63.0)`, exactly slide 22’s output. The cart is this page’s port, so its episodes differ but land in the same range."
      challenge={{ text: 'Play an episode that lasts more than 50 steps.', done: beat50 }}
      own="the live cart · this page’s port of CartPole"
      maths={
        <>
          <MLine text={`Slide 21: \`angle = obs[2]\`, then \`return 0 if angle < 0 else 1\`. On the last frame shown: $\\text{angle} = ${angle.toFixed(4)}$ rad $= ${deg(angle).toFixed(2)}°$, so the policy returns ${angle < 0 ? '0 (push left)' : '1 (push right)'}.`} />
          <MLine text="Slide 22 runs 500 episodes, each from `env.reset(seed=episode)` for at most 200 steps, and adds up the rewards (1.0 per step), so each total is the number of steps the pole stayed up." />
          <MLine text={data ? `This page’s run of that code: $\\text{mean} = ${data.stats[0]}$, $\\text{std} = ${data.stats[1]}$, $\\min = ${data.stats[2].toFixed(1)}$, $\\max = ${data.stats[3].toFixed(1)}$; slide 22 prints the same four numbers.` : 'Loading this page’s run…'} />
        </>
      }
    >
      <div ref={wrap} className={`dl9s-bp${narrow ? ' dl9s-bp--narrow' : ''}`}>
        <div className="dl9s-bp__live-col">
          {still ? (
            <Filmstrip ep={ep} />
          ) : (
            <div className="dl9s-bp__scene">
              <CartScene obs={obs} action={over ? null : action} done={over} W={narrow ? 340 : 420} H={190} />
              <p className="dl9s-bp__over">
                {over ? <>done = <b className="dl9s-bp__true">True</b> after {ep.len} steps</> : <>step <b>{f}</b> · ⅓ speed</>}
              </p>
            </div>
          )}
          <div className="dl9s-bp__code" aria-live="off">
            <p><code>angle = obs[2]</code><span className="dl9s-bp__val">{sgn4(angle)} rad</span></p>
            <p>
              <code>return <b className={angle < 0 ? 'dl9s-bp__on' : ''}>0</b> if angle &lt; 0 else <b className={angle >= 0 ? 'dl9s-bp__on' : ''}>1</b></code>
              <span className="dl9s-bp__val dl9s-bp__act">{angle < 0 ? '← push left' : 'push right →'}</span>
            </p>
          </div>
          {!printing && (
            <button type="button" className="dl9s-bp__play" onClick={play} disabled={running}>
              <Icon name="play" size={13} /> play an episode
            </button>
          )}
        </div>
        <div className="dl9s-bp__hist-col">
          <p className="dl9s-bp__k">slide 22’s experiment: 500 episodes</p>
          {data ? (
            <Histogram totals={data.totals} live={running ? null : ep.len} narrow={narrow} />
          ) : (
            <p className="dl9s-bp__loading">Loading this page’s run…</p>
          )}
          <p className="dl9s-bp__stats"><span className="dl9s-slideval">slide 22</span> <code>(41.698, 8.389445512070509, 24.0, 63.0)</code>{data?.match && <span className="dl9s-bp__match"> · this page’s run: the same</span>}</p>
        </div>
      </div>
    </Stage>
  );
}
