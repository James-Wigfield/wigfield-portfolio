import { useMemo } from 'react';
import Scene from '../../scene/Scene';
import { range } from '../../scene/geom';

/* ============================================================================
   SCENE — recursive forecasting with a one-month model (mechanism only)
   A strip of months: the 72 known input months, the model reading a window,
   each one-month prediction appended and fed back. `mode` follows the
   notebook: 'slide' keeps a 72-month window that moves right (the oldest
   month drops off), 'grow' keeps every month and the input gets longer. The
   last beat shows the other mode on a small strip for comparison.
   No values are drawn — the strip shows which months are real data and which
   are the model's own guesses, which is the whole point of the loop. Shapes
   and code follow predict_recursively (In [14]); the score beat prints that
   cell's result, 1.407 °C.
   ========================================================================== */

const W = 800;
const H = 416;
const X0 = 52;
const CW = 8.4; // one month
const cx = (m) => X0 + (m - 1) * CW; // left edge of month m
const mid = (m) => cx(m) + CW / 2;
const SY = 92;
const CH = 22;
const STEPS = 12;
const BOX = { x: 250, y: 196, w: 300, h: 46 };
const OUT_Y = BOX.y + BOX.h / 2;
const MINI = { y: 368, h: 9 };
const EARLY_BOX = { 1: `0 8 ${W} 334`, 2: `0 8 ${W} 334` }; // print crop: strip, model, concat, counter
const SCORE = '1.407'; // model 2's 12-month recursive test MAE, °C (Out [14])

function windowFor(k, mode) {
  // after k predictions have been fed back
  return mode === 'grow' ? [1, 72 + k] : [1 + k, 72 + k];
}

function makeArt(mode, n) {
  const other = mode === 'grow' ? 'slide' : 'grow';
  const [o0, o1] = windowFor(n - 1, other);
  return function art(step) {
    const preds = step >= 3 ? n : step >= 1 ? 1 : 0;
    const fed = step >= 3 ? n - 1 : step >= 2 ? 1 : 0;
    const [w0, w1] = windowFor(fed, mode);
    const outOp = step >= 1 && step < 4 ? 1 : 0;
    const tx = mid(72 + Math.max(1, preds));
    return (
      <>
        <text className="sv-cap" x={24} y={24}>Model 2 · one month at a time · {mode === 'grow' ? 'growing input' : 'sliding 72-month window'}</text>
        {/* month strip */}
        {range(84, 1).map((m) => (
          <rect
            key={m}
            x={cx(m) + 0.6}
            y={SY}
            width={CW - 1.2}
            height={CH}
            style={m > 72 ? { fill: 'none', stroke: 'var(--line)', strokeWidth: 1 } : { fill: 'var(--ink-3)', opacity: 0.3 }}
          />
        ))}
        <text className="sv-lab" x={X0} y={SY - 26}>real data · months 1–72</text>
        <text className="sv-lab" x={cx(73)} y={SY - 26}>forecast · 73–84</text>

        {/* predictions */}
        {range(STEPS, 1).map((k) => (
          <rect key={k} className={`sv-fm2 rc-pred rc-pred-${k}`} x={cx(72 + k) + 0.6} y={SY} width={CW - 1.2} height={CH} opacity={k <= preds ? 1 : 0} />
        ))}

        {/* the window the model reads */}
        <rect className="rc-win" x={cx(w0) - 2} y={SY - 8} width={cx(w1 + 1) - cx(w0) + 4} height={CH + 16} fill="none" style={{ stroke: 'var(--ink)', strokeWidth: 1.6 }} />
        <text className="sv-lab-strong rc-winlab" x={cx(w0)} y={SY - 12}>model input · (N, {mode === 'grow' ? '72+' : '72'}, 2)</text>

        {/* model box + arrows */}
        <rect className="sv-box-strong" x={BOX.x} y={BOX.y} width={BOX.w} height={BOX.h} />
        <text className="sv-lab-strong" x={BOX.x + BOX.w / 2} y={BOX.y + 19} textAnchor="middle">model 2 · 2,626 parameters</text>
        <text className="sv-lab" x={BOX.x + BOX.w / 2} y={BOX.y + 36} textAnchor="middle">GRU 16 → GRU 16 → Dense(2) → Reshape(1, 2)</text>
        <path className="sv-faint" d={`M${W / 2 - 60} ${SY + CH + 26} V ${BOX.y}`} strokeWidth="1.2" />
        <path className="sv-faint" d={`M${W / 2 - 64} ${BOX.y - 6} L${W / 2 - 60} ${BOX.y} L${W / 2 - 56} ${BOX.y - 6}`} strokeWidth="1.2" fill="none" />
        <g className="rc-out" opacity={outOp}>
          <line className="sv-m2 rc-out-h" x1={BOX.x + BOX.w} x2={tx} y1={OUT_Y} y2={OUT_Y} strokeWidth="1.6" />
          <line className="sv-m2 rc-out-v" x1={tx} x2={tx} y1={OUT_Y} y2={SY + CH + 5} strokeWidth="1.6" />
          <path
            className="sv-m2 rc-out-head"
            d={`M${mid(73) - 4} ${SY + CH + 11} L${mid(73)} ${SY + CH + 5} L${mid(73) + 4} ${SY + CH + 11}`}
            transform={`translate(${tx - mid(73)} 0)`}
            strokeWidth="1.6"
            fill="none"
          />
          <text className="sv-lab-strong" x={BOX.x + BOX.w + 8} y={OUT_Y + 16}>y_next · (N, 1, 2)</text>
        </g>

        {/* month numbers: 4 units below the window frame's bottom edge (SY + CH + 8), so the
            frame clears the "12" and "84" under its corners; drawn after the output arrow
            with a surface halo, so the arrow into month 84 passes behind the "84" */}
        {[1, 12, 24, 36, 48, 60, 72, 84].map((m) => (
          <text key={m} className="sv-lab" x={mid(m)} y={SY + CH + 20} textAnchor="middle" style={{ stroke: 'var(--surface)', strokeWidth: 3, paintOrder: 'stroke' }}>{m}</text>
        ))}

        {/* the concat that feeds it back */}
        <g className="rc-cat" opacity={step >= 2 ? 1 : 0}>
          <text className="sv-num" x={W / 2} y={268} textAnchor="middle">
            {mode === 'grow' ? 'window = tf.concat([window, y_next], axis=1)' : 'window = tf.concat([window[:, 1:], y_next], axis=1)'}
          </text>
          <text className="sv-lab" x={W / 2} y={285} textAnchor="middle">
            {mode === 'grow' ? '(N, 72+k, 2) + (N, 1, 2) → (N, 73+k, 2)' : '(N, 71, 2) + (N, 1, 2) → (N, 72, 2)'}
          </text>
          <text className="sv-lab" x={W / 2} y={300} textAnchor="middle">Reshape(1, 2) kept the time axis that lets them join</text>
        </g>

        {/* the counter, right-aligned under the forecast months so a narrow screen shows both */}
        {range(STEPS + 1).map((k) => (
          <g key={k} className={`rc-count rc-count-${k}`} opacity={k === preds ? 1 : 0}>
            <text className="sv-num" x={cx(85)} y={320} textAnchor="end">{k === 0 ? 'no predictions yet' : `${k} of 12 months predicted`}</text>
            <text className="sv-lab" x={cx(85)} y={336} textAnchor="end">
              {k <= 1
                ? 'its input was all real data'
                : mode === 'grow'
                  ? `its last input held ${k - 1} of its own guesses (${71 + k} months long)`
                  : `its last input window held ${k - 1} of its own guesses`}
            </text>
          </g>
        ))}

        {/* scored against the truth */}
        <g className="rc-score" opacity={step >= 4 ? 1 : 0}>
          <path className="sv-ink2" d={`M${cx(73)} ${SY + CH + 30} V ${SY + CH + 36} H ${cx(85)} V ${SY + CH + 30}`} fill="none" strokeWidth="1.2" />
          <text className="sv-lab-strong" x={mid(78) + CW / 2} y={SY + CH + 50} textAnchor="middle">vs y_test, months 73–84</text>
          <text className="sv-lab" x={mid(78) + CW / 2} y={SY + CH + 64} textAnchor="middle">12-month MAE in °C</text>
          {/* the printed result (model 2, sliding window): In [14]'s output */}
          <text className="sv-big" x={mid(78) + CW / 2} y={SY + CH + 92} textAnchor="middle">{SCORE}</text>
          <text className="sv-lab" x={mid(78) + CW / 2} y={SY + CH + 108} textAnchor="middle">Out [14]</text>
        </g>

        {/* the other way to handle the input, for comparison */}
        <g className="rc-alt" opacity={step >= 5 ? 1 : 0}>
          <line className="sv-grid" x1={X0} x2={cx(85)} y1={348} y2={348} />
          <text className="sv-lab-strong" x={cx(85)} y={362} textAnchor="end">
            {other === 'grow' ? 'Géron’s version: the input grows to 83 months' : 'The window version: always the last 72 months'}
          </text>
          {range(84, 1).map((m) => (
            <rect
              key={m}
              x={cx(m) + 0.6}
              y={MINI.y}
              width={CW - 1.2}
              height={MINI.h}
              className={m > 72 ? 'sv-fm2' : undefined}
              style={m > 72 ? { opacity: m < 84 ? 0.75 : 0.25 } : { fill: 'var(--ink-3)', opacity: 0.3 }}
            />
          ))}
          <rect x={cx(o0) - 2} y={MINI.y - 4} width={cx(o1 + 1) - cx(o0) + 4} height={MINI.h + 8} fill="none" style={{ stroke: 'var(--ink-2)', strokeWidth: 1.2 }} />
          <text className="sv-lab" x={cx(85)} y={396} textAnchor="end">same validation MAE for this tanh model</text>
          <text className="sv-lab" x={cx(85)} y={410} textAnchor="end">a ReLU variant: 3.4 °C grown, 1.1 °C windowed</text>
        </g>
      </>
    );
  };
}

const makeBuild = (mode, n) => function build(tl, { q, beat }) {
  const win = q('.rc-win')[0];
  const lab = q('.rc-winlab')[0];
  // a second tween on the same element must not render its from-state when
  // the timeline is built (fromTo defaults to immediateRender: true)
  const setWin = (k, at, dur) => {
    const [w0, w1] = windowFor(k, mode);
    const prev = windowFor(Math.max(0, k - 1), mode);
    const ir = k <= 1;
    tl.fromTo(
      win,
      { attr: { x: cx(prev[0]) - 2, width: cx(prev[1] + 1) - cx(prev[0]) + 4 } },
      { attr: { x: cx(w0) - 2, width: cx(w1 + 1) - cx(w0) + 4 }, duration: dur, ease: 'power2.inOut', immediateRender: ir },
      at,
    );
    tl.fromTo(lab, { attr: { x: cx(prev[0]) } }, { attr: { x: cx(w0) }, duration: dur, ease: 'power2.inOut', immediateRender: ir }, at);
  };
  // the output arrow moves to the month just predicted
  const aim = (k, at, dur) => {
    const from = mid(72 + k - 1);
    const to = mid(72 + k);
    const ir = k <= 2;
    tl.fromTo(q('.rc-out-h'), { attr: { x2: from } }, { attr: { x2: to }, duration: dur, ease: 'power2.out', immediateRender: ir }, at);
    tl.fromTo(q('.rc-out-v'), { attr: { x1: from, x2: from } }, { attr: { x1: to, x2: to }, duration: dur, ease: 'power2.out', immediateRender: ir }, at);
    tl.fromTo(q('.rc-out-head'), { x: from - mid(73) }, { x: to - mid(73), duration: dur, ease: 'power2.out', immediateRender: ir }, at);
  };
  const count = (k, at) => {
    tl.fromTo(q(`.rc-count-${k - 1}`), { opacity: 1 }, { opacity: 0, duration: 0.12, immediateRender: false }, at);
    tl.fromTo(q(`.rc-count-${k}`), { opacity: 0 }, { opacity: 1, duration: 0.12 }, at);
  };
  const [a0, a1] = windowFor(0, mode);
  tl.set(win, { attr: { x: cx(a0) - 2, width: cx(a1 + 1) - cx(a0) + 4 }, immediateRender: true }, 0);
  tl.set(lab, { attr: { x: cx(a0) }, immediateRender: true }, 0);
  tl.set(q('.rc-out-h'), { attr: { x2: mid(73) }, immediateRender: true }, 0);
  tl.set(q('.rc-out-v'), { attr: { x1: mid(73), x2: mid(73) }, immediateRender: true }, 0);
  tl.set(q('.rc-out-head'), { x: 0, immediateRender: true }, 0);
  tl.set(q('.rc-pred, .rc-out, .rc-score, .rc-count, .rc-cat, .rc-alt'), { opacity: 0, immediateRender: true }, 0);
  tl.set(q('.rc-count-0'), { opacity: 1, immediateRender: true }, 0);

  beat(0, 0);
  tl.fromTo(win, { opacity: 0 }, { opacity: 1, duration: 0.5 }, 'b0');

  beat(1, '+=0.8');
  tl.fromTo(q('.rc-out'), { opacity: 0 }, { opacity: 1, duration: 0.4 }, 'b1');
  tl.fromTo(q('.rc-pred-1'), { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.5, ease: 'back.out(1.3)' }, 'b1+=0.3');
  count(1, 'b1+=0.3');

  beat(2, '+=0.8');
  setWin(1, 'b2', 0.7);
  tl.fromTo(q('.rc-cat'), { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.5 }, 'b2+=0.2');

  beat(3, '+=1.2');
  for (let k = 2; k <= n; k++) {
    const at = `b3+=${((k - 2) * 0.55).toFixed(2)}`;
    aim(k, at, 0.25);
    tl.fromTo(q(`.rc-pred-${k}`), { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out' }, at);
    count(k, at);
    if (k < n) setWin(k, `b3+=${((k - 2) * 0.55 + 0.28).toFixed(2)}`, 0.25);
  }

  beat(4, '+=0.6');
  tl.fromTo(q('.rc-out'), { opacity: 1 }, { opacity: 0, duration: 0.3, immediateRender: false }, 'b4');
  tl.fromTo(q('.rc-score'), { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.5 }, 'b4+=0.2');

  beat(5, '+=1');
  tl.fromTo(q('.rc-alt'), { opacity: 0 }, { opacity: 1, duration: 0.6 }, 'b5');
  tl.to({}, { duration: 1.4 });
};

const beatsFor = (mode) => [
  { t: 'Seventy-two known months', fx: 0, c: 'The model reads a window of real data, shape (N, 72, 2), and only ever outputs one month.' },
  { t: 'Predict month 73', fx: 1, c: 'One forward pass gives y_next, shape (N, 1, 2): next month’s min and max, still with a time axis of length one.' },
  mode === 'grow'
    ? { t: 'Feed it back', fx: 0.45, c: 'tf.concat appends the prediction along the time axis, so the next input is 73 months long; its last month is a guess.' }
    : { t: 'Feed it back', fx: 0.45, c: 'tf.concat drops the oldest month and appends the prediction along the time axis, so the window is 72 months again; its newest month is a guess.' },
  { t: 'Repeat to month 84', fx: 1, c: 'Eleven more passes. Each leans on more of the model’s own guesses, so an error in one month becomes part of the next input.' },
  { t: 'Score the twelve', fx: 1, c: `Only now are the twelve guesses compared with the real months 73–84: a test MAE of ${SCORE} °C. The truth is never fed back in.` },
  mode === 'grow'
    ? { t: 'Or slide a window', fx: 1, c: 'The alternative drops the oldest month each time, so the input stays the length the model was trained on.' }
    : { t: 'Or let it grow', fx: 1, c: 'Géron’s version keeps every month, so the last input is 83 months. Both gave this tanh model the same validation MAE; a ReLU variant went badly wrong as its input grew.' },
];

export default function RecursionScene({ id = 'm2-recursion', mode = 'slide' }) {
  const art = useMemo(() => makeArt(mode, STEPS), [mode]);
  const build = useMemo(() => makeBuild(mode, STEPS), [mode]);
  const beats = useMemo(() => beatsFor(mode), [mode]);
  return (
    <Scene
      id={id}
      label={`Model 2 forecasting 12 months recursively with a ${mode === 'grow' ? 'growing input' : 'sliding 72-month window'}: each one-month prediction is appended and fed back, then the twelve are scored against the real months`}
      viewBox={`0 0 ${W} ${H}`}
      beats={beats}
      art={art}
      build={build}
      keyframes={[1, 2, 5]}
      // beats 1 and 2 end above the score and the comparison strip: print them cropped
      frameBoxes={EARLY_BOX}
    />
  );
}
