import { useEffect, useRef, useState } from 'react';
import Icon from '../../../../icons';
import { Stage, MLine, MEq } from '../stage';
import { Scrub } from '../svgParts';
import { useWidth } from '../useWidth';
import { useStudy } from '../context';
import { prefersReducedMotion, useReducedMotion } from '../hooks';
import { fmt, rng, fromWeights } from '../rl';
import { reset } from '../cartpole';
import { newTrainer, trainIteration, playPolicy, PG } from './pgTrain';
import CartScene from './CartScene';
import './labsPg.css';

/* ============================================================================
   §9 · IMPLEMENTING POLICY GRADIENTS  (slides 32–37)
   ----------------------------------------------------------------------------
   YTargetLab   slide 32's line `y_target = 1 − action`, as a picture: the
                network's p(left) splits [0, 1); the random number u lands
                on one side; action = (u > p) → 1 (right) or 0 (left); the
                target is 1.0 for left and 0.0 for right, so the loss pulls
                p toward the action actually taken. Drag u and p.
   TrainPgLab   REINFORCE trained live in this browser (this page's own JS
                run of slides 32–36 on its CartPole port), drawn on top of
                this page's offline TensorFlow run of the slides' code and
                slide 36's printed 190.3; then watch the trained policy play.
   ========================================================================== */

/* ── y_target ───────────────────────────────────────────────────────────── */
export function YTargetLab() {
  const wrap = useRef(null);
  const narrow = useWidth(wrap) < 520;
  const [p, setP] = useState(0.7);
  const [u, setU] = useState(0.83);
  const action = u > p ? 1 : 0;
  const y = 1 - action;
  const pc = Math.min(1 - 1e-7, Math.max(1e-7, p));
  const loss = -(y * Math.log(pc) + (1 - y) * Math.log(1 - pc));
  const dLdp = -(y / pc) + (1 - y) / (1 - pc);
  const W = narrow ? 340 : 640;
  const x0 = narrow ? 24 : 60;
  const x1 = W - (narrow ? 24 : 60);
  const toX = (v) => x0 + v * (x1 - x0);
  const by = 70;
  const bh = 34;
  const drawU = () => setU(Number(Math.random().toFixed(2)));

  return (
    <Stage
      title="Why y_target = 1 − action"
      slides="slide 32"
      tryThis="Predict the target when the random number lands right of p(left), then drag u across the boundary and watch the target and the pull on p flip."
      caption="The network outputs $p$ = p(left); the agent goes right when `tf.random.uniform([1, 1]) > left_proba`. Acting as though the chosen action was the best one, the target probability of left is 1.0 after a left and 0.0 after a right: `1 − action`."
      own={null}
      maths={
        <>
          <MLine text={`$p = ${fmt(p, 2)}$, $u = ${fmt(u, 2)}$: action $= (u > p) = ${action}$, so $y_{\\text{target}} = 1 - ${action} = ${y}.0$.`} />
          <MEq tex={'\\text{loss} = -\\left[\\, y \\log p + (1 - y) \\log (1 - p) \\,\\right]'} />
          <MLine text={`Here loss $= ${fmt(loss, 3)}$ and $\\partial\\,\\text{loss}/\\partial p = -y/p + (1-y)/(1-p) = ${fmt(dLdp, 3)}$: ${y === 1 ? 'negative, so a descent step raises p(left)' : 'positive, so a descent step lowers p(left), i.e. raises p(right)'}. Either way the chosen action becomes more likely, before REINFORCE weights the gradient by the action’s score.`} />
          <p className="dl9s-mnote">`loss_fn` is `tf.keras.losses.binary_crossentropy` (slide 35); the formula is the usual binary cross-entropy, written out by this page.</p>
        </>
      }
    >
      <div ref={wrap}>
        <svg className="dl9s-svg" viewBox={`0 0 ${W} 214`} style={{ maxWidth: 720 }} role="group" aria-label={`p(left) ${fmt(p, 2)}, random number ${fmt(u, 2)}: action ${action}, y_target ${y}`}>
          {/* the split bar: left part p, right part 1 − p */}
          <rect x={toX(0)} y={by} width={toX(p) - toX(0)} height={bh} rx={4} className={`dl9s-yt__part dl9s-yt__part--left${action === 0 ? ' dl9s-yt__part--on' : ''}`} />
          <rect x={toX(p)} y={by} width={toX(1) - toX(p)} height={bh} rx={4} className={`dl9s-yt__part dl9s-yt__part--right${action === 1 ? ' dl9s-yt__part--on' : ''}`} />
          <text x={(toX(0) + toX(p)) / 2} y={by + bh / 2 + 5} textAnchor="middle" className="dl9s-t dl9s-t--b dl9s-halo">left · 0</text>
          {toX(1) - toX(p) > 70 && <text x={(toX(p) + toX(1)) / 2} y={by + bh / 2 + 5} textAnchor="middle" className="dl9s-t dl9s-t--b dl9s-halo">right · 1</text>}
          <text x={toX(0)} y={by + bh + 16} className="dl9s-t dl9s-t--xs dl9s-t--m">0</text>
          <text x={toX(1)} y={by + bh + 16} textAnchor="end" className="dl9s-t dl9s-t--xs dl9s-t--m">1</text>
          {/* the p boundary handle */}
          <Scrub x0={x0} x1={x1} y={by - 34} value={p} min={0.05} max={0.95} step={0.01} big={0.1} onChange={setP} label="p(left), the network's output" show={(v) => `p(left) = ${v.toFixed(2)}`} />
          <line x1={toX(p)} y1={by - 26} x2={toX(p)} y2={by + bh + 4} className="dl9s-yt__edge" />
          {/* the random number u */}
          <Scrub x0={x0} x1={x1} y={by + bh + 62} value={u} min={0} max={0.99} step={0.01} big={0.1} onChange={setU} label="u, the uniform random number" show={(v) => `u = ${v.toFixed(2)}`} className="dl9s-yt__u" />
          <line x1={toX(u)} y1={by - 4} x2={toX(u)} y2={by + bh + 4} className="dl9s-yt__needle" />
          {/* the result */}
          <g transform={`translate(${W / 2} ${by + bh + 108})`}>
            <text x={0} y={0} textAnchor="middle" className="dl9s-t dl9s-t--b">
              <tspan className="dl9s-t--act">action = {action} ({action ? 'right' : 'left'})</tspan>
              <tspan dx={14}>y_target = {y}.0</tspan>
              <tspan dx={14} className="dl9s-t--pol">{y === 1 ? 'pull p(left) up ↑' : 'pull p(left) down ↓'}</tspan>
            </text>
          </g>
        </svg>
        <div className="dl9s-yt__row dl9s-noprint">
          <button type="button" className="dl9s-yt__draw" onClick={drawU}>draw a new u</button>
        </div>
      </div>
    </Stage>
  );
}

/* ── train it ───────────────────────────────────────────────────────────── */
function Curve({ offline, live, narrow }) {
  const W = narrow ? 340 : 640;
  const H = 230;
  const L = narrow ? 34 : 46;
  const R = 14;
  const T = 16;
  const B = 34;
  const x = (i) => L + (i / PG.iterations) * (W - L - R);
  const y = (v) => T + (1 - v / 200) * (H - T - B);
  const path = (c) => c.map((v, i) => `${i ? 'L' : 'M'}${x(i + 1).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  return (
    <svg className="dl9s-svg" viewBox={`0 0 ${W} ${H}`} style={{ maxWidth: 760 }} role="img" aria-label={`Mean reward per iteration. ${offline ? `This page's offline TensorFlow run ends at ${offline[offline.length - 1]}. ` : ''}${live.length ? `This browser's run is at iteration ${live.length}, ${live[live.length - 1].toFixed(1)}. ` : ''}Slide 36 prints 190.3 at iteration 150.`}>
      {[0, 50, 100, 150, 200].map((v) => (
        <g key={v}>
          <line x1={L} y1={y(v)} x2={W - R} y2={y(v)} className="dl9s-grid-line" />
          <text x={L - 6} y={y(v) + 4} textAnchor="end" className="dl9s-t dl9s-t--xs dl9s-t--m">{v}</text>
        </g>
      ))}
      {[0, 50, 100, 150].map((i) => <text key={i} x={x(i)} y={H - B + 16} textAnchor="middle" className="dl9s-t dl9s-t--xs dl9s-t--m">{i}</text>)}
      <text x={(L + W - R) / 2} y={H - 4} textAnchor="middle" className="dl9s-t dl9s-t--xs">iteration (10 episodes each)</text>
      {offline && <path d={path(offline)} className="dl9s-line dl9s-line--ghost" />}
      {live.length > 0 && <path d={path(live)} className="dl9s-line dl9s-line--pol" />}
      {/* slide 36's printed result */}
      <circle cx={x(150)} cy={y(190.3)} r={5} className="dl9s-pg__slide" />
      <text x={x(150) - 4} y={y(190.3) + 40} textAnchor="end" className="dl9s-t dl9s-t--xs dl9s-slidemark dl9s-halo">slide 36: 190.3</text>
    </svg>
  );
}

export function TrainPgLab() {
  const wrap = useRef(null);
  const narrow = useWidth(wrap) < 520;
  const reduced = useReducedMotion();
  const { printing } = useStudy();
  const [run, setRun] = useState(null);
  const [live, setLive] = useState([]);
  const [training, setTraining] = useState(false);
  const [film, setFilm] = useState(null);
  const [frame, setFrame] = useState(0);
  const trainer = useRef(null);
  const timer = useRef(0);
  const anim = useRef(0);

  useEffect(() => {
    let alive = true;
    import('../data/pgRun.js').then((m) => { if (alive) setRun(m.PG_RUN); }).catch(() => {});
    return () => {
      alive = false;
      window.clearTimeout(timer.current);
      window.cancelAnimationFrame(anim.current);
    };
  }, []);

  const train = () => {
    window.clearTimeout(timer.current);
    setFilm(null);
    trainer.current = newTrainer(42);
    setLive([]);
    setTraining(true);
    if (prefersReducedMotion()) {
      for (let i = 0; i < PG.iterations; i++) trainIteration(trainer.current);
      setLive([...trainer.current.curve]);
      setTraining(false);
      return;
    }
    const tick = () => {
      const T = trainer.current;
      for (let k = 0; k < 2 && T.iteration < PG.iterations; k++) trainIteration(T);
      setLive([...T.curve]);
      if (T.iteration < PG.iterations) timer.current = window.setTimeout(tick, 16);
      else setTraining(false);
    };
    tick();
  };
  const stop = () => { window.clearTimeout(timer.current); setTraining(false); };

  const watch = () => {
    window.cancelAnimationFrame(anim.current);
    const layers = trainer.current?.iteration ? trainer.current.layers : run ? fromWeights(run.weights, ['relu', 'sigmoid']) : null;
    if (!layers) return;
    const R = rng(1000 + Math.floor(Math.random() * 1000));
    const ep = playPolicy(layers, reset(R), R);
    setFilm(ep);
    if (prefersReducedMotion()) { setFrame(ep.states.length - 1); return; }
    let i = 0;
    let last = 0;
    const loop = (t) => {
      if (t - last >= 40) { last = t; i += 1; setFrame(Math.min(i, ep.states.length - 1)); }
      if (i < ep.states.length - 1) anim.current = window.requestAnimationFrame(loop);
    };
    setFrame(0);
    anim.current = window.requestAnimationFrame(loop);
  };

  const offline = run?.curve ?? null;
  const shownLive = printing ? [] : live;
  const last = shownLive.length ? shownLive[shownLive.length - 1] : null;
  const filmFrames = film && (reduced || printing) ? [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(f * (film.states.length - 1))) : null;

  return (
    <Stage
      title="Train the policy network, live"
      slides="slides 33–37"
      tryThis="Predict how many iterations it takes to pass 100 steps, then press Train and watch the mean reward per iteration climb."
      caption={`Grey: this page’s offline run of the slides’ code in TensorFlow (iteration 150: ${offline ? offline[offline.length - 1] : '…'}). Magenta: the same algorithm in this browser on this page’s CartPole port. The dot is slide 36’s printed “mean rewards: 190.3”.`}
      challenge={{ text: 'Train until an iteration’s mean reward passes 190, then watch the policy play.', done: !!last && Math.max(...shownLive) > 190 && !!film }}
      own="both runs · this page’s own"
      maths={
        <>
          <MLine text={`Each iteration plays ${PG.episodesPerUpdate} episodes of at most ${PG.maxSteps} steps, normalises their discounted returns ($\\gamma = ${PG.gamma}$), and applies the mean of every step’s gradient × its advantage with Nadam (learning rate ${PG.lr}), as on slides 32–36. The curve is slide 36’s printed number: the total reward of the 10 episodes ÷ 10.`} />
          {run && <MLine text={`Offline (TensorFlow ${run.versions.tensorflow}, Keras ${run.versions.keras}, seeds as on the slides, ${Math.round(run.wallSeconds)} s on a CPU): iteration 150 = ${run.curve[run.curve.length - 1]}; its trained policy kept the pole up for ${(run.eval.reduce((a, b) => a + b, 0) / run.eval.length).toFixed(1)} steps on average over 20 new episodes (sampling actions, as the slides do). Slide 36: 190.3. RL runs depend heavily on the seed (slide 67).`} />}
          {last !== null && <MLine text={`This browser’s run: iteration ${shownLive.length} = ${last.toFixed(1)} (its own RNG and initial weights; the same algorithm in JavaScript).`} />}
          <p className="dl9s-mnote">Running slide 32 as printed failed in this page’s offline run: `env.step(int(action))` raised “only 0-dimensional arrays can be converted to Python scalars” under NumPy {run?.versions.numpy ?? '2.5'}; `int(action[0, 0])` fixed it. See the Slide check above.</p>
        </>
      }
    >
      <div ref={wrap} className="dl9s-pg">
        <div className="dl9s-pg__ctl dl9s-noprint">
          <button type="button" className="dl9s-pg__btn" onClick={training ? stop : train}>
            <Icon name={training ? 'pause' : 'play'} size={14} /> {training ? 'Pause' : live.length ? 'Train again' : 'Train in this browser'}
          </button>
          <button type="button" className="dl9s-pg__btn" onClick={watch} disabled={training || (!run && !live.length)}>
            <Icon name="eye" size={14} /> Watch the policy play
          </button>
          <span className="dl9s-pg__read" aria-live="polite">
            {last !== null ? <>iteration <b>{shownLive.length}</b> · mean reward <b>{last.toFixed(1)}</b></> : 'not trained yet'}
          </span>
        </div>
        <Curve offline={offline} live={shownLive} narrow={narrow} />
        {film && !filmFrames && (
          <div className="dl9s-pg__film">
            <CartScene obs={film.states[frame]} action={film.actions[Math.min(frame, film.actions.length - 1)] ?? null} done={frame === film.states.length - 1 && film.states.length - 1 < PG.maxSteps} W={narrow ? 340 : 560} H={170} />
            <p className="dl9s-pg__filmk">step {frame} of {film.states.length - 1}{film.states.length - 1 >= PG.maxSteps ? ' (the 200-step cap)' : ''}</p>
          </div>
        )}
        {filmFrames && (
          <div className="dl9s-film">
            {filmFrames.map((f) => (
              <figure key={f} className="dl9s-film__frame">
                <CartScene obs={film.states[f]} action={film.actions[Math.min(f, film.actions.length - 1)] ?? null} W={260} H={130} mini />
                <figcaption><span>step {f}</span></figcaption>
              </figure>
            ))}
          </div>
        )}
      </div>
    </Stage>
  );
}
