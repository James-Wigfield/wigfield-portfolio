import { useMemo, useState } from 'react';
import Scene from '../../scene/Scene';
import { lin, pathOf, range } from '../../scene/geom';
import { outLabel } from '../../nbutil';

/* ============================================================================
   SCENE — early stopping with restore_best_weights
   The epochs are real (passed in from the notebook's printout): the best
   epoch, the patience, and the epoch training stopped at. The counter ticks
   once per epoch without a new best; at `patience` it stops and the weights
   rewind to the best epoch.

   The curve: with `run` set, it is the validation curve TRACED from the
   notebook's own learning-curve figure (left panel, orange line, one sample
   per epoch, as pixel heights above the axis; relative shape only — the
   y axis carries no numbers except the printed best val_loss). Without
   `run` it falls back to an illustrative curve. Either way the best epoch is
   forced to be the strict minimum, as it is in the run.
   The epoch axis always runs 1 … `max` (the 100-epoch cap), so the four runs
   in the toggle share one scale. `cap` is the small-caps stage title (the
   toggle names the run and the figure its curve was traced from).
   ========================================================================== */

const W = 800;
const H = 350;
const X0 = 70;
const X1 = 740;
const Y0 = 84;
const Y1 = 244;

// traced from figures/cell18_0, cell24_0, cell32_0, cell45_0 (validation curve, left panel)
const TRACES = {
  m1: [86.5, 73.5, 68.5, 64.5, 62, 60.5, 58.5, 56.5, 53.5, 51, 50, 50, 48.5, 47, 47, 46.5, 46.5, 46.5, 45.5, 44.5, 43.5, 42.5, 40.5, 39, 36.5, 34.5, 32.5, 30, 28.5, 26, 24.5, 22.5, 21.5, 20.5, 19.5, 18.5, 18.5, 18, 17.5, 17, 16.5, 15.5, 15, 15, 14.5, 14.5, 14.5, 14.5, 14.5, 15, 15, 15.5, 15.5, 16, 16.5, 16.5, 17, 17.5, 17.5, 17.5, 18, 18, 18, 18.5, 19, 19],
  m2: [117, 51.5, 33, 28.5, 25.5, 25, 26, 25, 23.5, 22, 20.5, 19, 17, 16, 14.5, 13.5, 13, 12.5, 12.5, 12.5, 13, 14, 16, 20.5, 30, 44, 48.5, 44.5, 49.5, 49, 49, 50.5, 52.5, 55.5, 59.5, 66, 75.5, 86.5, 93, 97],
  m3: [86.5, 70, 57, 47.5, 41.5, 38.5, 35, 32, 30.5, 28.5, 26.5, 25, 23.5, 22.5, 21, 20.5, 19.5, 19, 18.5, 18.5, 18.5, 19, 19.5, 19.5, 20, 20, 19.5, 19, 17.5, 17, 17.5, 18.5, 19, 19.5, 20.5, 21, 21.5, 22.5, 23, 23.5, 24, 24, 24, 24, 24, 23.5, 23.5, 23, 22.5, 22],
  vae: [39.5, 32.5, 31.5, 30.5, 28.5, 21.5, 19.5, 17, 15.5, 14, 14, 13.5, 14.5, 15, 13.5, 13.5, 14.5, 13.5, 14.5, 14.5, 14, 14, 12.5, 14.5, 12.5, 13.5, 13.5, 13.5, 12.5, 14, 13.5, 15, 14.5, 13.5, 14, 15.5, 13.5, 17, 18, 14, 14.5, 14, 14.5],
};

// an illustrative curve with its minimum at `best` (used when no trace is given)
function synthetic(best, stop) {
  return range(stop, 1).map((e) => {
    const d = (e - best) / Math.max(best, 6);
    return d < 0 ? 0.25 + 0.7 * d * d : 0.25 + 0.1 * d + 0.02 * Math.sin(e * 1.7);
  });
}

// values per epoch 1…stop, normalised to 0…1 with the best epoch the strict minimum
function curveValues(run, best, stop) {
  const raw = (TRACES[run] || synthetic(best, stop)).slice(0, stop);
  const span = Math.max(...raw) - Math.min(...raw) || 1;
  const eps = span * 0.012;
  const vb = Math.min(...raw) - eps;
  const v = raw.map((r, i) => (i === best - 1 ? vb : Math.max(r, vb + eps)));
  const lo = Math.min(...v);
  const hi = Math.max(...v);
  return v.map((r) => (r - lo) / (hi - lo));
}

function geometry({ best, stop, max, run }) {
  const xe = lin(1, max, X0, X1);
  const yv = lin(0, 1, Y1, Y0);
  const vals = curveValues(run, best, stop);
  const pts = vals.map((v, i) => [xe(i + 1), yv(v)]);
  // share of the polyline's length that lies before the best epoch
  const seg = pts.slice(1).map(([x, y], i) => Math.hypot(x - pts[i][0], y - pts[i][1]));
  const total = seg.reduce((a, b) => a + b, 0) || 1;
  const toBest = seg.slice(0, best - 1).reduce((a, b) => a + b, 0) / total;
  return { xe, yv, vals, pts, toBest };
}

function makeArt(p) {
  const { best, stop, patience, max, bestLoss, cap } = p;
  const { xe, yv, vals, pts } = geometry(p);
  const ticks = [1, best, stop, max].filter((v, i, a) => a.indexOf(v) === i);
  const by = yv(vals[best - 1]);
  return function art(step) {
    const on = (b) => (step >= b ? 1 : 0);
    return (
      <>
        {cap && <text className="sv-cap" x={24} y={24}>{cap}</text>}
        <text className="sv-lab-strong" x={24} y={46}>EarlyStopping(monitor=&quot;val_loss&quot;, patience={patience}, restore_best_weights=True)</text>
        <rect className="es-wait" style={{ fill: 'var(--ink)', fillOpacity: 0.06 }} x={xe(best + 0.5)} y={Y0 - 10} width={Math.max(2, xe(stop + 0.5) - xe(best + 0.5))} height={Y1 - Y0 + 24} opacity={on(2)} />
        <line className="sv-axis" x1={X0} x2={X1} y1={Y1 + 14} y2={Y1 + 14} />
        <text className="sv-lab" x={X1} y={Y1 + 46} textAnchor="end">epoch</text>
        <text className="sv-lab" x={X0 - 10} y={Y0 + 4} textAnchor="end">val</text>
        <text className="sv-lab" x={X0 - 10} y={Y0 + 18} textAnchor="end">loss</text>
        <line className="sv-axis" x1={X0 - 4} x2={X0 - 4} y1={Y0 - 6} y2={Y1 + 14} />
        {ticks.map((e) => (
          <g key={e}>
            <line className="sv-axis" x1={xe(e)} x2={xe(e)} y1={Y1 + 14} y2={Y1 + 19} />
            <text className="sv-lab" x={xe(e)} y={Y1 + 32} textAnchor="middle">{e === max ? `${max} · cap` : e}</text>
          </g>
        ))}
        <path className="sv-line sv-ink2 es-curve" d={pathOf(step >= 2 ? pts : pts.slice(0, best))} />

        {/* the best epoch */}
        <g className="es-best" opacity={on(1)}>
          <circle className="sv-accent-fill" cx={xe(best)} cy={by} r={5.5} />
          <line className="sv-accent" x1={xe(best)} x2={xe(best)} y1={by + 8} y2={Y1 + 14} strokeDasharray="3 3" />
          <line className="sv-faint" x1={xe(best)} x2={xe(best)} y1={Y0 + (bestLoss ? 32 : 18)} y2={by - 9} strokeWidth="1" />
          <text className="sv-lab-strong" x={xe(best)} y={Y0 + 10} textAnchor="middle">best · epoch {best}</text>
          {/* half of this label sits on the patience band: ink-2 for contrast */}
          {bestLoss && <text className="sv-lab" x={xe(best)} y={Y0 + 24} textAnchor="middle" style={{ fill: 'var(--ink-2)' }}>val_loss {bestLoss}</text>}
        </g>

        {/* the patience window */}
        <g className="es-wait" opacity={on(2)}>
          <text className="sv-lab" x={(xe(best + 0.5) + xe(stop + 0.5)) / 2} y={Y0 - 16} textAnchor="middle">{stop - best} epochs without a new best</text>
        </g>
        {range(patience + 1).map((k) => (
          <text key={k} className={`sv-big es-count es-count-${k}`} x={X1} y={Y0 + 26} textAnchor="end" opacity={step >= 2 && k === patience ? 1 : 0}>
            {k}/{patience}
          </text>
        ))}

        {/* stop + rewind */}
        <g className="es-stop" opacity={on(3)}>
          <line className="sv-ink" x1={xe(stop)} x2={xe(stop)} y1={Y0 - 4} y2={Y1 + 14} strokeWidth="1.6" />
          <text className="sv-lab-strong" x={xe(stop) + 7} y={Y1 - 22}>stopped · epoch {stop}</text>
          <text className="sv-lab" x={xe(stop) + 7} y={Y1 - 8}>= {best} + {patience}</text>
        </g>
        <g className="es-rewind" opacity={on(4)}>
          <path className="sv-accent es-arrow" d={`M${xe(stop) - 4} ${Y1 + 58} C ${(xe(stop) + xe(best)) / 2} ${Y1 + 76}, ${(xe(stop) + xe(best)) / 2} ${Y1 + 76}, ${xe(best) + 6} ${Y1 + 58}`} strokeWidth="1.8" fill="none" />
          <path className="sv-accent" d={`M${xe(best) + 14} ${Y1 + 54} L ${xe(best) + 5} ${Y1 + 58} L ${xe(best) + 12} ${Y1 + 65}`} strokeWidth="1.8" fill="none" />
          <text className="sv-lab-strong" x={(xe(stop) + xe(best)) / 2} y={Y1 + 92} textAnchor="middle">weights rewound to epoch {best}</text>
        </g>
      </>
    );
  };
}

// a beat's focus point (viewBox x) as the stage's sideways-scroll fraction `fx`,
// centred for the narrowest stage, where about 405 of the 800 units show
const fxAt = (c) => Math.max(0, Math.min(1, (c - 202) / 395));

const makeBuild = (p) => function build(tl, { q, beat }) {
  const { patience } = p;
  const c = q('.es-curve')[0];
  const L = c.getTotalLength();
  const Lb = L * geometry(p).toBest;
  tl.set(q('.es-best, .es-wait, .es-count, .es-stop, .es-rewind'), { opacity: 0, immediateRender: true }, 0);
  beat(0, 0);
  tl.fromTo(c, { strokeDasharray: L, strokeDashoffset: L }, { strokeDashoffset: L - Lb, duration: 1.6, ease: 'none', immediateRender: true }, 'b0');
  beat(1, '+=0.2');
  tl.fromTo(q('.es-best'), { opacity: 0, scale: 0.6, transformOrigin: '50% 50%' }, { opacity: 1, scale: 1, duration: 0.4, ease: 'back.out(1.3)' }, 'b1');
  beat(2, '+=0.5');
  tl.fromTo(q('.es-wait'), { opacity: 0 }, { opacity: 1, duration: 0.3 }, 'b2');
  const dur = Math.min(3, 0.12 * patience + 0.6);
  tl.fromTo(c, { strokeDashoffset: L - Lb }, { strokeDashoffset: 0, duration: dur, ease: 'none', immediateRender: false }, 'b2');
  const per = dur / patience;
  for (let k = 1; k <= patience; k++) {
    if (k > 1) tl.fromTo(q(`.es-count-${k - 1}`), { opacity: 1 }, { opacity: 0, duration: 0.05, immediateRender: false }, `b2+=${(k - 1) * per}`);
    tl.fromTo(q(`.es-count-${k}`), { opacity: 0 }, { opacity: 1, duration: 0.05 }, `b2+=${(k - 1) * per}`);
  }
  beat(3, '+=0.3');
  tl.fromTo(q('.es-stop'), { opacity: 0 }, { opacity: 1, duration: 0.3 }, 'b3');
  beat(4, '+=0.6');
  tl.fromTo(q('.es-rewind'), { opacity: 0 }, { opacity: 1, duration: 0.2 }, 'b4');
  const a = q('.es-arrow')[0];
  const La = a.getTotalLength();
  tl.fromTo(a, { strokeDasharray: La, strokeDashoffset: -La }, { strokeDashoffset: 0, duration: 0.8, ease: 'power2.inOut', immediateRender: true }, 'b4');
  tl.to({}, { duration: 1.2 });
};

export default function EarlyStopScene({ id, best, stop, patience, max = 100, what = 'validation loss', run, bestLoss, secs, cap }) {
  const p = useMemo(() => ({ best, stop, patience, max, run, bestLoss, cap }), [best, stop, patience, max, run, bestLoss, cap]);
  const art = useMemo(() => makeArt(p), [p]);
  const build = useMemo(() => makeBuild(p), [p]);
  const beats = useMemo(() => {
    const xe = lin(1, max, X0, X1);
    return [
      { t: 'Training runs epoch by epoch', fx: fxAt((X0 + xe(best)) / 2), c: `Each epoch ends with the ${what} measured on Swanbourne, the validation set.` },
      { t: `Best at epoch ${best}`, fx: fxAt(xe(best)), c: `Early stopping remembers the epoch with the lowest validation loss so far${bestLoss ? `: ${bestLoss} here` : ''}.` },
      { t: 'Patience runs out', fx: fxAt((xe(best) + X1) / 2), c: `Every epoch without a new best adds one to the counter; at ${patience} it gives up.` },
      {
        t: `Stopped at epoch ${stop}`,
        fx: fxAt(xe(stop) + 50),
        c: stop >= max
          ? `Training ran to the ${max}-epoch cap.`
          : `Training ends at epoch ${stop} = ${best} + ${patience}${secs ? ` (${secs} s)` : ''}, ${stop < 0.8 * max ? `well short of the ${max}-epoch cap` : `close to the ${max}-epoch cap`}.`,
      },
      { t: 'Rewind to the best', fx: fxAt((xe(best) + xe(stop)) / 2), c: `restore_best_weights=True puts back the weights from epoch ${best} when training ends, so the extra epochs cost time but not validation loss.` },
    ];
  }, [best, stop, patience, max, what, bestLoss, secs]);
  return (
    <Scene
      id={id}
      label={`Early stopping: the best validation loss at epoch ${best}, patience ${patience}, training stopped at epoch ${stop} and the weights restored to epoch ${best}`}
      viewBox={`0 0 ${W} ${H}`}
      beats={beats}
      art={art}
      build={build}
      keyframes={[4]}
      schematic={run ? 'curve traced from the plot · epochs real' : 'curve shape illustrative · epochs real'}
    />
  );
}

/* A toggle of several runs (one scene each; every pane prints).
   runs: [{ key, label, best, stop, loss, secs, what, cell }] — scene id `${id}-${key}`;
   `cell` is the code cell whose learning-curve figure the curve was traced from. */
export function EarlyStopToggle({ id = 'early-stop', runs, patience = 20 }) {
  const [shown, setShown] = useState(runs[0].key);
  return (
    <div className="dlp2-toggle-scene">
      <div className="dlp2-seg dlp2-seg--big" role="group" aria-label="Which training run to show">
        {runs.map((r) => (
          <button key={r.key} type="button" aria-pressed={shown === r.key} data-shows={`${id}-${r.key}`} onClick={() => setShown(r.key)}>
            {r.label} · {r.best} → {r.stop}
          </button>
        ))}
      </div>
      {runs.map((r) => (
        <div key={r.key} className={`dlp2-toggle-scene__pane${shown === r.key ? ' dlp2-toggle-scene__pane--on' : ''}`}>
          <p className="dlp2-toggle-scene__printlab">{r.label} · best epoch {r.best}, stopped at {r.stop}</p>
          <EarlyStopScene
            id={`${id}-${r.key}`}
            best={r.best}
            stop={r.stop}
            patience={patience}
            what={r.what}
            run={r.key}
            bestLoss={r.loss}
            secs={r.secs}
            cap={r.cell != null ? `${r.label} · validation loss · ${outLabel(r.cell)}` : r.label}
          />
        </div>
      ))}
    </div>
  );
}
