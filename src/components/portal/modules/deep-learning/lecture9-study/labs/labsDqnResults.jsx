import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from '../../../../icons';
import { Stage, MLine } from '../stage';
import { Tip } from '../svgParts';
import { useWidth } from '../useWidth';
import { useStudy } from '../context';
import { prefersReducedMotion, useReducedMotion, svgPoint } from '../hooks';
import { epsilonAt, forward, fromWeights, rng } from '../rl';
import { reset, step } from '../cartpole';
import CartScene from './CartScene';
import './labsPg.css';
import './labsDqnResults.css';

/* ============================================================================
   §17 · DQN RESULTS AND CATASTROPHIC FORGETTING  (slides 64–67)
   ----------------------------------------------------------------------------
   DqnCurveLab   this page's own offline run of slides 61–64 (TensorFlow,
                 stopped by its time box after 564 of 600 episodes): the
                 `step` it saved per episode (thin) and its 10-episode mean
                 (thick), slide 64's ε schedule as a dashed amber line, the
                 no-training stretch (episodes 0–50) shaded. Under the axis,
                 the slides' own run as slide 66 describes it (first max
                 ≈ 290, a drop after ≈ 550, the last episode at 100). Hover
                 for an episode; play the run's best weights on this page's
                 CartPole port.
   ========================================================================== */

const N = 600;
const mean10 = (c) => c.map((_, i) => {
  const w = c.slice(Math.max(0, i - 9), i + 1);
  return w.reduce((a, b) => a + b, 0) / w.length;
});

export function DqnCurveLab() {
  const wrap = useRef(null);
  const svgRef = useRef(null);
  const narrow = useWidth(wrap) < 560;
  const reduced = useReducedMotion();
  const { printing } = useStudy();
  const [run, setRun] = useState(null);
  const [failed, setFailed] = useState(false);
  const [hover, setHover] = useState(null);
  const [found, setFound] = useState(false);
  const [film, setFilm] = useState(null);
  const [frame, setFrame] = useState(0);
  const anim = useRef(0);

  useEffect(() => {
    let alive = true;
    import('../data/dqnRun.js').then((m) => { if (alive) setRun(m.DQN_RUN); }).catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; window.cancelAnimationFrame(anim.current); };
  }, []);

  const smooth = useMemo(() => (run ? mean10(run.curve) : []), [run]);
  const firstFull = run ? run.curve.indexOf(199) : -1;

  const W = narrow ? 350 : 700;
  const H = narrow ? 300 : 310;
  const L = narrow ? 34 : 44;
  const R = narrow ? 12 : 40;
  const T = 14;
  const B = 92;
  const x = (e) => L + (e / N) * (W - L - R);
  const y = (v) => T + (1 - v / 200) * (H - T - B);
  const ye = (eps) => T + (1 - eps) * (H - T - B);
  const path = (c) => c.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  const epsPath = Array.from({ length: 61 }, (_, k) => k * 10).map((e, i) => `${i ? 'L' : 'M'}${x(e).toFixed(1)} ${ye(epsilonAt(e)).toFixed(1)}`).join(' ');

  const onMove = (e) => {
    if (!run) return;
    const pt = svgPoint(e, svgRef.current);
    if (!pt) return;
    const ep = Math.round(((pt.x - L) / (W - L - R)) * N);
    if (ep < 0 || ep >= run.curve.length) { setHover(null); return; }
    setHover(ep);
    if (ep >= 520 && ep <= 560 && smooth[ep] < 150) setFound(true);
  };
  const onKey = (e) => {
    if (!run) return;
    const d = { ArrowRight: 1, ArrowLeft: -1, PageUp: 25, PageDown: -25 }[e.key];
    if (d === undefined) return;
    e.preventDefault();
    const ep = Math.max(0, Math.min(run.curve.length - 1, (hover ?? 0) + d));
    setHover(ep);
    if (ep >= 520 && ep <= 560 && smooth[ep] < 150) setFound(true);
  };

  const play = () => {
    if (!run) return;
    window.cancelAnimationFrame(anim.current);
    const layers = fromWeights(run.bestWeights, ['elu', 'elu', 'linear']);
    const Rr = rng(500 + Math.floor(Math.random() * 500));
    const states = [reset(Rr)];
    const actions = [];
    for (let t = 0; t < 200; t++) {
      const q = forward(layers, states[t]).out;
      const a = q[1] > q[0] ? 1 : 0; // epsilon = 0: the optimal action according to the DQN
      const r = step(states[t], a);
      actions.push(a);
      states.push(r.obs);
      if (r.terminated) break;
    }
    setFilm({ states, actions });
    if (prefersReducedMotion()) { setFrame(states.length - 1); return; }
    let i = 0;
    let last = 0;
    const loop = (t) => {
      if (t - last >= 40) { last = t; i += 1; setFrame(Math.min(i, states.length - 1)); }
      if (i < states.length - 1) anim.current = window.requestAnimationFrame(loop);
    };
    setFrame(0);
    anim.current = window.requestAnimationFrame(loop);
  };

  const avg = (a) => (a.reduce((p, q) => p + q, 0) / a.length).toFixed(1);
  const filmFrames = film && (reduced || printing) ? [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(f * (film.states.length - 1))) : null;
  const hv = hover !== null && run ? run.curve[hover] : null;

  return (
    <Stage
      title="A DQN learns, then forgets"
      slides="slides 64–67"
      tryThis="Predict where a run could ‘forget’ after looking stable, then hover the curve: find this run’s own dip after it sat near the max."
      caption="Blue: the `step` this page’s run of slides 61–64 saved per episode (thin) and its 10-episode mean (thick); magenta dashes: $\epsilon$ = `max(1 - episode / 500, 0.01)`. Below the axis: the slides’ own run, as slide 66 describes it."
      challenge={{ text: 'Find this run’s own catastrophic-forgetting dip (around episodes 525–550).', done: found }}
      own="this page’s own run · TensorFlow"
      maths={
        run && (
          <>
            <MLine text={`This page’s run (TensorFlow ${run.versions.tensorflow}, Keras ${run.versions.keras}; ${Math.round(run.wallSeconds / 60)} min on a CPU) stopped at its time box after **${run.episodes} of 600** episodes. Its first full episode (\`step\` = 199, i.e. 200 steps) came at episode ${firstFull + 1}; ${run.curve.filter((v) => v === 199).length} episodes reached it. The last episode scored ${run.lastScore} (\`step\`).`} />
            <MLine text={`Played greedily ($\\epsilon = 0$) on 20 new episodes, its best weights kept the pole up ${avg(run.evalBest)} steps on average and its final weights ${avg(run.evalFinal)}: good, not perfect.`} />
            <MLine text="The slides’ run (slides 65–66): “Episode: 600, Steps: 100, eps: 0.010”; first max at around episode 290, a dramatic drop after it seemed stable at around 550, and only 100 at the last episode. The slide notes it was much worse than the textbook’s." />
            <p className="dl9s-mnote">Running slide 63 as printed failed in this page’s offline run: `tf.keras.losses.mean_squared_error` raised an AttributeError in Keras {run.versions.keras}; `tf.keras.losses.mse` (the same loss) was used. The slides set no seed for the DQN; the run used 42. RL is very sensitive to seeds (slide 67): another run would look different.</p>
          </>
        )
      }
    >
      <div ref={wrap} className="dl9s-dq">
        {!run ? (
          <p className="dl9s-dq__wait">{failed ? 'This page’s run could not be loaded.' : 'Loading this page’s run…'}</p>
        ) : (
          <>
            <svg
              ref={svgRef}
              className="dl9s-svg dl9s-dq__chart"
              viewBox={`0 0 ${W} ${H}`}
              role="group"
              tabIndex={0}
              aria-label={`Episode lengths over ${run.episodes} episodes of this page's DQN run. Arrow keys move through the episodes.${hv !== null ? ` Episode ${hover + 1}: step ${hv}, 10-episode mean ${smooth[hover].toFixed(0)}, epsilon ${epsilonAt(hover).toFixed(2)}.` : ''}`}
              onPointerMove={onMove}
              onPointerLeave={() => setHover(null)}
              onKeyDown={onKey}
            >
              <rect x={x(0)} y={T} width={x(51) - x(0)} height={H - T - B} className="dl9s-dq__notrain" />
              <text x={x(0) + 4} y={T + 12} className="dl9s-t dl9s-t--xs dl9s-halo">{narrow ? 'no train' : 'no training'}</text>
              {[0, 50, 100, 150, 200].map((v) => (
                <g key={v}>
                  <line x1={L} y1={y(v)} x2={W - R} y2={y(v)} className="dl9s-grid-line" />
                  <text x={L - 6} y={y(v) + 4} textAnchor="end" className="dl9s-t dl9s-t--xs dl9s-t--m">{v}</text>
                </g>
              ))}
              {!narrow && [1, 0.5, 0].map((v) => <text key={v} x={W - R + 6} y={ye(v) + 4} className="dl9s-t dl9s-t--xs dl9s-t--m dl9s-t--pol">{v === 1 ? 'ε 1' : v}</text>)}
              {[0, 100, 200, 300, 400, 500, 600].map((e) => <text key={e} x={x(e)} y={H - B + 15} textAnchor="middle" className="dl9s-t dl9s-t--xs dl9s-t--m">{e}</text>)}
              <text x={(L + W - R) / 2} y={H - B + 29} textAnchor="middle" className="dl9s-t dl9s-t--xs">episode</text>
              <path d={epsPath} className="dl9s-dq__eps" />
              <path d={path(run.curve)} className="dl9s-line dl9s-dq__raw" />
              <path d={path(smooth)} className="dl9s-line dl9s-line--val" />
              <line x1={x(run.episodes)} y1={T} x2={x(run.episodes)} y2={H - B} className="dl9s-dq__stop" />
              {!narrow && <text x={x(run.episodes) - 4} y={H - B - 22} textAnchor="end" className="dl9s-t dl9s-t--xs dl9s-halo">time box: {run.episodes}</text>}
              {hover !== null && (
                <g>
                  <line x1={x(hover)} y1={T} x2={x(hover)} y2={H - B} className="dl9s-today" />
                  <circle cx={x(hover)} cy={y(hv)} r={4} className="dl9s-dq__dot" />
                  <Tip x={Math.min(W - 70, Math.max(70, x(hover)))} y={T + 8} text={`ep ${hover + 1} · step ${hv} · ε ${epsilonAt(hover).toFixed(2)}`} />
                </g>
              )}
              {/* the slides' run, as slide 66 tells it */}
              <g transform={`translate(0 ${H - B + 44})`}>
                <line x1={x(0)} y1={0} x2={x(N)} y2={0} className="dl9s-dq__strip" />
                <text x={x(0)} y={-6} className="dl9s-t dl9s-t--xs dl9s-slidemark">the slides’ run (slide 66)</text>
                {[{ e: 290, t: 'first max', a: 'middle', dy: 0 }, { e: 550, t: 'stable, then a drop', a: 'end', dy: 0 }, { e: 600, t: 'last episode: 100', a: 'end', dy: -26 }].map((m) => (
                  <g key={m.e}>
                    <circle cx={x(m.e)} cy={0} r={4} className="dl9s-pg__slide" />
                    {m.dy ? (
                      <text x={x(m.e)} y={-8} textAnchor="end" className="dl9s-t dl9s-t--xs">600: {m.t}</text>
                    ) : (
                      <>
                        <text x={x(m.e)} y={18} textAnchor={m.a} className="dl9s-t dl9s-t--xs">≈ {m.e}</text>
                        <text x={x(m.e)} y={31} textAnchor={m.a} className="dl9s-t dl9s-t--xs">{m.t}</text>
                      </>
                    )}
                  </g>
                ))}
              </g>
            </svg>
            <div className="dl9s-pg__ctl dl9s-noprint">
              <button type="button" className="dl9s-pg__btn" onClick={play}><Icon name="play" size={14} /> Play the best weights</button>
              <span className="dl9s-pg__read" aria-live="polite">
                {hv !== null ? <>episode <b>{hover + 1}</b> · step <b>{hv}</b> · ε {epsilonAt(hover).toFixed(2)}</> : `${run.episodes} episodes · best step ${run.bestScore}`}
              </span>
            </div>
            {film && !filmFrames && (
              <div className="dl9s-pg__film">
                <CartScene obs={film.states[frame]} action={film.actions[Math.min(frame, film.actions.length - 1)] ?? null} done={frame === film.states.length - 1 && film.states.length - 1 < 200} W={narrow ? 340 : 560} H={170} />
                <p className="dl9s-pg__filmk">step {frame} of {film.states.length - 1} · greedy (ε = 0) · this page’s CartPole port</p>
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
          </>
        )}
      </div>
    </Stage>
  );
}
