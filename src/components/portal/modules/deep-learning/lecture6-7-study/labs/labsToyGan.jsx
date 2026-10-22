import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Lab, Chips, Range, Stat } from '../ui';
import { useStudy } from '../context';
import { useReducedMotion } from '../hooks';
import { ToyGan, GAN_PRESETS, TARGETS, targetDensity, modeCover, fmt, fmtS, fmtInt } from '../gen';
import './labsToyGan.css';

/* ============================================================================
   LECTURES 6–7 STUDY — THE TOY GAN (§9, §10)
     ToyGanLab     a tiny generator and discriminator trained live in the
                   browser on numbers drawn from one bump, alternating slides
                   21–22's two phases each iteration (as slide 25's loop
                   does): the real numbers, the generated numbers and the
                   discriminator's output D(x) after every 25 iterations
     CollapseLab   the same on two bumps: a balanced run covers both; a
                   weaker generator learning faster collapses onto one bump
                   for a long stretch and then becomes unstable — slide 27's
                   difficulties, in this page's own run
   The networks, seeds and learning rates are this page's own (./gen.js). A
   run is computed in the browser; with reduced motion, or in the PDF, it
   jumps straight to the end instead of animating.
   ========================================================================== */

const SNAP = 25;
const GRID = Array.from({ length: 81 }, (_, i) => -5 + i * 0.125);

function snap(gan) {
  const xs = gan.samples(300);
  const h = gan.history.slice(-SNAP);
  const avg = (k) => h.reduce((a, v) => a + v[k], 0) / Math.max(1, h.length);
  return {
    step: gan.step,
    xs,
    d: GRID.map((x) => gan.disc(x).p),
    dLoss: avg('dLoss'),
    gLoss: avg('gLoss'),
    bias: gan.G[1].b[0],
    cover: modeCover(gan.target, xs),
  };
}

// A run of a preset: snapshots every SNAP iterations, advanced a chunk per
// animation frame (or all at once). Returns the snapshots and controls.
function useToyRun(cfg, { instant }) {
  const ganRef = useRef(null);
  const rafRef = useRef(0);
  // the run's first picture comes from a fresh (identical, seeded) model;
  // the one that trains is made on the first step
  const [snaps, setSnaps] = useState(() => [snap(new ToyGan(cfg))]);
  const [running, setRunning] = useState(false);
  const total = cfg.iters;

  const getGan = useCallback(() => (ganRef.current ??= new ToyGan(cfg)), [cfg]);

  const runTo = useCallback((gan, end) => {
    const out = [];
    while (gan.step < end) {
      gan.iterate();
      if (gan.step % SNAP === 0) out.push(snap(gan));
    }
    return out;
  }, []);

  // pausing finishes the current block of 25 iterations, so the picture and
  // the counter always show where the model is
  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
    const gan = ganRef.current;
    if (gan && gan.step % SNAP) {
      const more = runTo(gan, Math.min(total, Math.ceil(gan.step / SNAP) * SNAP));
      if (more.length) setSnaps((s) => [...s, ...more]);
    }
    setRunning(false);
  }, [runTo, total]);

  const finish = useCallback(() => {
    stop();
    const more = runTo(getGan(), total);
    if (more.length) setSnaps((s) => [...s, ...more]);
  }, [getGan, runTo, stop, total]);

  const play = useCallback(() => {
    if (instant) { finish(); return; }
    setRunning(true);
    const tick = () => {
      const gan = getGan();
      // 5 iterations a frame: slow enough to watch, and to pause part-way
      const more = runTo(gan, Math.min(total, gan.step + 5));
      if (more.length) setSnaps((s) => [...s, ...more]);
      if (gan.step >= total) { rafRef.current = 0; setRunning(false); return; }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [finish, getGan, instant, runTo, total]);

  const step = useCallback(() => {
    stop();
    const gan = getGan();
    const more = runTo(gan, Math.min(total, gan.step + SNAP));
    if (more.length) setSnaps((s) => [...s, ...more]);
  }, [getGan, runTo, stop, total]);

  const reset = useCallback((next) => {
    stop();
    ganRef.current = new ToyGan(next ?? cfg);
    setSnaps([snap(ganRef.current)]);
  }, [cfg, stop]);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);
  return { snaps, running, play, stop, step, reset, finish, total, done: snaps[snaps.length - 1].step >= total };
}

/* ── the picture: real density, generated histogram, D(x) ───────────────── */
const W = 560;
const H = 230;
const M = { l: 34, r: 40, t: 26, b: 30 };
const sx = (x) => M.l + ((x + 5) / 10) * (W - M.l - M.r);
const BIN = 0.25;

function ToyPlot({ target, s, label }) {
  const bins = useMemo(() => {
    const n = Math.round(10 / BIN);
    const c = new Array(n).fill(0);
    s.xs.forEach((x) => {
      const i = Math.floor((x + 5) / BIN);
      if (i >= 0 && i < n) c[i] += 1;
    });
    return c.map((k) => k / (s.xs.length * BIN));
  }, [s]);
  const dens = GRID.map((x) => targetDensity(target, x));
  const top = Math.max(...dens, ...bins) * 1.08;
  const sy = (v) => H - M.b - (v / top) * (H - M.t - M.b);
  const sd = (p) => H - M.b - p * (H - M.t - M.b);
  const area = `M${sx(-5)} ${sy(0)} ${GRID.map((x, i) => `L${sx(x).toFixed(1)} ${sy(dens[i]).toFixed(1)}`).join(' ')} L${sx(5)} ${sy(0)} Z`;
  const dPath = GRID.map((x, i) => `${i ? 'L' : 'M'}${sx(x).toFixed(1)} ${sd(s.d[i]).toFixed(1)}`).join(' ');
  const peak = GRID[dens.indexOf(Math.max(...dens))];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="dl67s-svg dl67s-toy" role="img" aria-label={label}>
      <line x1={M.l} y1={H - M.b} x2={W - M.r} y2={H - M.b} className="dl67s-axis" />
      {[-4, -2, 0, 2, 4].map((t) => <text key={t} x={sx(t)} y={H - M.b + 14} textAnchor="middle" className="dl67s-tick">{t}</text>)}
      <text x={W - M.r} y={H - 4} textAnchor="end" className="dl67s-tick">x (one number)</text>
      <path d={area} className="dl67s-toy__real" />
      {bins.map((v, i) => (v > 0 ? <rect key={i} x={sx(-5 + i * BIN) + 0.5} y={sy(v)} width={sx(BIN) - sx(0) - 1} height={sy(0) - sy(v)} className="dl67s-toy__bar" /> : null))}
      <line x1={M.l} y1={sd(0.5)} x2={W - M.r} y2={sd(0.5)} className="dl67s-gridline" />
      <path d={dPath} className="dl67s-toy__d" />
      {[0, 0.5, 1].map((p) => <text key={p} x={W - M.r + 5} y={sd(p) + 3} className="dl67s-tick">{p}</text>)}
      <text x={W - M.r + 5} y={M.t - 12} className="dl67s-tick">D(x)</text>
      <text x={sx(peak) + 8} y={sy(Math.max(...dens)) + 12} className="dl67s-svg__label dl67s-toy__lreal">real data</text>
    </svg>
  );
}

function Legend() {
  return (
    <ul className="dl67s-toy__legend">
      <li><span className="dl67s-toy__key dl67s-toy__key--real" />real data (the target the training set is drawn from)</li>
      <li><span className="dl67s-toy__key dl67s-toy__key--bar" />generated: 300 numbers from the generator</li>
      <li><span className="dl67s-toy__key dl67s-toy__key--d" />discriminator: D(x), its probability that x is real</li>
    </ul>
  );
}

function Controls({ run, reduced }) {
  return (
    <div className="dl67s-stepper">
      {run.running ? (
        <button type="button" className="dl-btn" onClick={run.stop}>Pause</button>
      ) : (
        <button type="button" className="dl-btn" onClick={run.play} disabled={run.done}>{reduced ? 'Train to the end' : 'Train'}</button>
      )}
      <button type="button" className="dl-btn" onClick={run.step} disabled={run.done || run.running}>+{SNAP} iterations</button>
      <button type="button" className="dl-btn" onClick={() => run.reset()} disabled={run.snaps.length === 1 && !run.running}>Reset</button>
      <span className="dl67s-stepper__t">iteration <b>{fmtInt(run.snaps[run.snaps.length - 1].step)}</b> of {fmtInt(run.total)}</span>
    </div>
  );
}

const meanSd = (xs) => {
  const m = xs.reduce((a, v) => a + v, 0) / xs.length;
  return [m, Math.sqrt(xs.reduce((a, v) => a + (v - m) ** 2, 0) / xs.length)];
};

/* ── §9 · the toy GAN, live ─────────────────────────────────────────────── */
export function ToyGanLab() {
  const { printing } = useStudy();
  const reduced = useReducedMotion();
  const cfg = GAN_PRESETS.one;
  const run = useToyRun(cfg, { instant: reduced });
  const { finish, done } = run;
  // the PDF shows the trained run
  useEffect(() => {
    if (!printing || done) return undefined;
    const id = setTimeout(finish, 0);
    return () => clearTimeout(id);
  }, [printing, done, finish]);
  const s = run.snaps[run.snaps.length - 1];
  const [m, sd] = meanSd(s.xs);
  const t = TARGETS[cfg.target].modes[0];
  return (
    <Lab
      title="A toy GAN, trained here: one number at a time"
      slides="slides 21–25"
      tryThis="before pressing Train, predict where the generated numbers (bars) will end up and what the discriminator’s curve will do as they get there. Then train, pause part-way, and notice which way the generator moves next."
    >
      <div className="dl-lab__controls">
        <Controls run={run} reduced={reduced} />
      </div>
      <div className="dl67s-toy__grid">
        <figure className="dl67s-toy__fig">
          <div className="dl67s-wide"><ToyPlot target={TARGETS[cfg.target]} s={s} label={`Iteration ${s.step}: the real data's bump around ${t.m}, a histogram of 300 generated numbers, and the discriminator's output D(x)`} /></div>
          <Legend />
        </figure>
        <div className="dl67s-stats dl67s-stats--col">
          <Stat k="generated numbers" v={`mean ${fmt(m, 2)} · sd ${fmt(sd, 2)}`} sub={`real data: mean ${t.m}, sd ${t.s}`} tone={Math.abs(m - t.m) < 0.15 ? 'accent' : undefined} />
          <Stat k="phase 1 loss (discriminator)" v={s.step ? fmt(s.dLoss, 3) : '—'} sub="binary cross-entropy on 32 fake (label 0) + 32 real (label 1), mean of the last 25 iterations" />
          <Stat k="phase 2 loss (generator)" v={s.step ? fmt(s.gLoss, 3) : '—'} sub="binary cross-entropy on 32 fake labelled 1, discriminator frozen" />
        </div>
      </div>
      <p className="dl67s-cap">
        <span className="dl67s-own">this page’s own toy run</span> Not the slides’ model: a generator that turns {cfg.zDim} Gaussian noise numbers into one
        number ({cfg.zDim} → {cfg.hidden} tanh units → 1), and a discriminator that reads one number (1 → {cfg.hidden} leaky-ReLU units → 1 sigmoid). Both are
        trained with binary cross-entropy and RMSprop (as slide 24 compiles its models) at Keras’s default learning rate of 0.001, batch 32 as on slide 24,
        seed {cfg.seed}. Every iteration runs phase 1 then phase 2, like slide 25’s loop. The picture is redrawn every 25 iterations.
      </p>
    </Lab>
  );
}

/* ── §10 · two bumps: mode collapse and instability ─────────────────────── */
const SEEDS = { balanced: [1, 2, 3], weak: [4, 5, 12] };

function Timeline({ snaps, at, onPick, total }) {
  const w = 560;
  const h = 96;
  const m = { l: 34, r: 40, t: 8, b: 22 };
  const bw = (w - m.l - m.r) / Math.max(1, total / SNAP);
  const y = (v) => m.t + (1 - v) * (h - m.t - m.b);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="dl67s-svg dl67s-tl" role="img" aria-label="Share of generated numbers in the left bump, the right bump and elsewhere, every 25 iterations">
      {snaps.slice(1).map((s, i) => {
        const x = m.l + i * bw;
        const [a, b] = s.cover;
        return (
          <g key={s.step} onClick={() => onPick(i + 1)} className="dl67s-tl__col">
            <rect x={x} y={y(a)} width={Math.max(1, bw - 0.6)} height={y(0) - y(a)} className="dl67s-tl__a" />
            <rect x={x} y={y(a + b)} width={Math.max(1, bw - 0.6)} height={y(a) - y(a + b)} className="dl67s-tl__b" />
            <title>{`iteration ${s.step}: left ${Math.round(a * 100)}%, right ${Math.round(b * 100)}%`}</title>
          </g>
        );
      })}
      {at > 0 && <line x1={m.l + (at - 0.5) * bw} y1={m.t - 4} x2={m.l + (at - 0.5) * bw} y2={h - m.b + 2} className="dl67s-marker" />}
      <line x1={m.l} y1={y(0)} x2={w - m.r} y2={y(0)} className="dl67s-axis" />
      {[0, 0.5, 1].map((v) => <text key={v} x={m.l - 5} y={y(v) + 3} textAnchor="end" className="dl67s-tick">{v * 100}%</text>)}
      {[0, total / 2, total].map((v) => <text key={v} x={m.l + (v / SNAP) * bw} y={h - 6} textAnchor="middle" className="dl67s-tick">{fmtInt(v)}</text>)}
    </svg>
  );
}

// the longest stretch where one bump holds ≥ 90% and the other ≤ 5%
function longestCollapse(snaps) {
  let best = null;
  let cur = null;
  snaps.slice(1).forEach((s) => {
    const [a, b] = s.cover;
    const side = a >= 0.9 && b <= 0.05 ? 'left' : b >= 0.9 && a <= 0.05 ? 'right' : null;
    if (side && cur && cur.side === side) cur.to = s.step;
    else cur = side ? { side, from: s.step, to: s.step } : null;
    if (cur && (!best || cur.to - cur.from > best.to - best.from)) best = { ...cur };
  });
  return best;
}

export function CollapseLab() {
  const { printing } = useStudy();
  const reduced = useReducedMotion();
  const [kind, setKind] = useState('weak');
  const [seed, setSeed] = useState(GAN_PRESETS.weak.seed);
  const cfg = useMemo(() => ({ ...GAN_PRESETS[kind], seed }), [kind, seed]);
  const run = useToyRun(cfg, { instant: reduced });
  const { finish, done, reset } = run;
  const [pick, setPick] = useState(null);
  useEffect(() => {
    if (!printing || done) return undefined;
    const id = setTimeout(finish, 0);
    return () => clearTimeout(id);
  }, [printing, done, finish]);
  const choose = (k, sd) => {
    setKind(k);
    setSeed(sd);
    setPick(null);
    reset({ ...GAN_PRESETS[k], seed: sd });
  };
  const last = run.snaps.length - 1;
  const at = pick != null && pick <= last ? pick : last;
  const s = run.snaps[at];
  const col = longestCollapse(run.snaps);
  const target = TARGETS.two;
  const biases = run.snaps.map((x) => x.bias);
  return (
    <Lab
      title="Two bumps: mode collapse and an unstable game"
      slides="slide 27"
      tryThis="predict whether the weaker generator will cover both bumps. Train it, then drag along the timeline: notice how long it sits in one bump, and what happens after. Then try the balanced run."
    >
      <div className="dl-lab__controls">
        <Chips
          label="run"
          value={kind}
          options={[{ v: 'weak', l: 'weaker generator, learning faster' }, { v: 'balanced', l: 'balanced' }]}
          onChange={(k) => choose(k, GAN_PRESETS[k].seed)}
        />
        <Chips label="seed" value={seed} options={SEEDS[kind].map((v) => ({ v, l: String(v) }))} onChange={(sd) => choose(kind, sd)} />
        <Controls run={run} reduced={reduced} />
      </div>
      <div className="dl67s-toy__grid">
        <figure className="dl67s-toy__fig">
          <div className="dl67s-wide"><ToyPlot target={target} s={s} label={`Iteration ${s.step}: two real bumps at −3 and 3, a histogram of 300 generated numbers, and D(x)`} /></div>
          <Legend />
        </figure>
        <div className="dl67s-stats dl67s-stats--col">
          <Stat k={`iteration ${fmtInt(s.step)}: in the left bump`} v={`${Math.round(s.cover[0] * 100)}%`} sub="generated numbers within 3 sd of −3" />
          <Stat k="in the right bump" v={`${Math.round(s.cover[1] * 100)}%`} sub="within 3 sd of 3 (the rest are in between or outside)" />
          <Stat
            k="longest one-bump stretch so far"
            v={col ? `${fmtInt(col.from)}–${fmtInt(col.to)}` : 'none'}
            tone={col && col.to - col.from >= 200 ? 'accent' : undefined}
            sub={col ? `≥ 90% in the ${col.side} bump, ≤ 5% in the other` : 'no stretch with ≥ 90% in one bump yet'}
          />
        </div>
      </div>
      <div className="dl67s-tl__wrap">
        <p className="dl67s-stagehead">Where the generated numbers are, every 25 iterations<span className="dl67s-screenonly"> (click a column)</span></p>
        <p className="dl67s-printonly dl67s-readout">Printed: the “{kind === 'weak' ? 'weaker generator, learning faster' : 'balanced'}” run, seed {seed}, after {fmtInt(run.total)} iterations.</p>
        <div className="dl67s-wide"><Timeline snaps={run.snaps} at={at} onPick={setPick} total={run.total} /></div>
        <div className="dl-lab__controls dl67s-noprint">
          <Range label="show iteration" value={at} min={0} max={last} onChange={setPick} fmt={(v) => fmtInt(run.snaps[v]?.step ?? 0)} />
        </div>
        <p className="dl67s-readout">
          <span className="dl67s-dot dl67s-dot--a" />left bump <span className="dl67s-dot dl67s-dot--b" />right bump; the gap above the two is the share
          elsewhere.{biases.length > 1 && <> The generator’s output bias, one of its parameters, went from {fmtS(biases[0], 2)} to {fmtS(biases[biases.length - 1], 2)},
          ranging over [{fmtS(Math.min(...biases), 2)}, {fmtS(Math.max(...biases), 2)}] on the way.</>}
        </p>
      </div>
      <p className="dl67s-cap">
        <span className="dl67s-own">this page’s own toy run</span> The same networks and loop as §9, on numbers drawn half from a bump at −3 and half from a
        bump at 3. “Weaker generator, learning faster”: 1 noise number, {GAN_PRESETS.weak.hidden} hidden units, the generator’s learning rate 4× the
        discriminator’s (0.004 against 0.001). “Balanced”: 2 noise numbers, 16 units, both at 0.004. These settings and seeds are this page’s choice; other
        seeds behave differently (this page’s observation).
      </p>
    </Lab>
  );
}
