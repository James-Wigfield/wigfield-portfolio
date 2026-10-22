import { useEffect, useRef, useState } from 'react';
import { Stage, MLine, MEq } from '../stage';
import { Arrow } from '../svgParts';
import { useWidth } from '../useWidth';
import { svgPoint } from '../hooks';
import { simpleBiRnnParams, rnnEdParams } from '../attn';
import { PRINTED } from '../slideData';
import { useStudy } from '../context';
import { useBusRail, dayLabel, SERIES, thousands } from './busData';
import './labsBusRail.css';

/* ============================================================================
   §3–§5 · BUS/RAIL: simple_biRNN AND rnn_ed  (slides 9–17)
   ----------------------------------------------------------------------------
   All three labs draw the page's OWN runs of the slides' code
   (../data/busrail.js, tools/dl-lecture8-study/busrail.py), never the
   slides' numbers, which are quoted separately and labelled.
     HorizonLab     §3: drag the horizon from 1 to 14 days; simple_biRNN's
                    forecast, fed back into itself (slide 11's for loop),
                    drifts away from the truth, and the error curve climbs
     StagesLab      §4: one diagram, Training / Testing. Training: every
                    decoder input is real. Testing: only Day 55 is real; the
                    rest start as zeros and fill with estimates as the
                    14-step loop runs
     EdForecastLab  §5: rnn_ed's 14-day forecast for a chosen window beside
                    simple_biRNN's, the two error curves, and the learning
                    curves; the slides' printed MAEs quoted beside the page's
   ========================================================================== */

// round y ticks (every 100k, or 50k for a narrow range) inside [lo, hi]
function niceTicks(lo, hi) {
  const step = hi - lo > 300000 ? 100000 : 50000;
  const out = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) out.push(v);
  return out;
}

const pathOf = (pts) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');

function useWindowTokens(data) {
  return (data?.BIRNN?.windows ?? []).map((w) => dayLabel(w.start, 56));
}

function WindowPicker({ labels, win, setWin, label = 'Forecast from' }) {
  return (
    <div className="dl8s-br__wins" role="group" aria-label="Validation window">
      <span className="dl8s-br__winsk">{label}</span>
      {labels.map((l, i) => (
        <button key={l} type="button" className={`dl8s-switch__opt${i === win ? ' dl8s-switch__opt--on' : ''}`} aria-pressed={i === win} onClick={() => setWin(i)}>{l}</button>
      ))}
    </div>
  );
}

function SeriesSwitch({ s, setS }) {
  return (
    <div className="dl8s-switch dl8s-br__series" role="group" aria-label="Series">
      {SERIES.map((name, i) => (
        <button key={name} type="button" className={`dl8s-switch__opt${i === s ? ' dl8s-switch__opt--on' : ''}`} aria-pressed={i === s} onClick={() => setS(i)}>{name}</button>
      ))}
    </div>
  );
}

function Loading({ failed }) {
  return <p className="dl8s-stage__cap">{failed ? 'The page’s bus/rail run could not be loaded.' : 'Loading this page’s bus/rail run…'}</p>;
}

/* a small error curve (validation MAE vs days ahead) */
function ErrInset({ x, y, w, h, curves, at, max }) {
  const sx = (d) => x + ((d - 1) / 13) * w;
  const sy = (v) => y + h - (v / max) * h;
  return (
    <g className="dl8s-br__inset">
      <line className="dl8s-ax" x1={x} y1={y + h} x2={x + w} y2={y + h} />
      <line className="dl8s-ax" x1={x} y1={y} x2={x} y2={y + h} />
      <text x={x} y={y - 8} className="dl8s-t dl8s-t--xs">error vs days ahead</text>
      <text x={x + w} y={y + h + 12} textAnchor="end" className="dl8s-t dl8s-t--xs dl8s-t--m">14</text>
      <text x={x} y={y + h + 12} textAnchor="middle" className="dl8s-t dl8s-t--xs dl8s-t--m">1</text>
      {curves.map((c) => (
        <g key={c.key}>
          <path className={`dl8s-line ${c.cls}`} d={pathOf(c.v.map((v, i) => [sx(i + 1), sy(v)]))} />
          <text x={x + w + 4} y={sy(c.v[13]) + 4} className="dl8s-t dl8s-t--xs">{c.label}</text>
          {at && <circle cx={sx(at)} cy={sy(c.v[at - 1])} r={4} className={`dl8s-br__dot ${c.cls}`} />}
        </g>
      ))}
    </g>
  );
}

/* ── §3 · the horizon ────────────────────────────────────────────────── */
export function HorizonLab() {
  const { data, failed } = useBusRail();
  const wrap = useRef(null);
  const svgRef = useRef(null);
  const narrow = useWidth(wrap) < 560;
  const [win, setWin] = useState(0);
  const [s, setS] = useState(0);
  const [h, setH] = useState(14);
  const [drag, setDrag] = useState(false);
  const labels = useWindowTokens(data);
  const p = simpleBiRnnParams();

  if (!data) {
    return (
      <Stage title="How far ahead can it see?" slides="slides 9–11">
        <div ref={wrap}><Loading failed={failed} /></div>
      </Stage>
    );
  }
  const B = data.BIRNN;
  const w = B.windows[win];
  const back = narrow ? 14 : 21;
  const hist = w.input.slice(56 - back).map((r) => r[s]);
  const truth = w.truth.map((r) => r[s]);
  const pred = w.pred.map((r) => r[s]);
  const all = [...hist, ...truth, ...pred];
  const lo = Math.min(...all) * 0.92;
  const hi = Math.max(...all) * 1.04;
  const W = narrow ? 380 : 760;
  const H = narrow ? 330 : 300;
  const X0 = narrow ? 34 : 50;
  const X1 = narrow ? W - 58 : 520;
  const Y0 = 24;
  const Y1 = narrow ? 200 : 240;
  const n = back + 14;
  const sx = (k) => X0 + (k / (n - 1)) * (X1 - X0);
  const sy = (v) => Y1 - ((v - lo) / (hi - lo)) * (Y1 - Y0);
  const today = back - 1;
  const truthPts = [...hist, ...truth].map((v, k) => [sx(k), sy(v)]);
  const predPts = [[sx(today), sy(hist[back - 1])], ...pred.slice(0, h).map((v, k) => [sx(today + 1 + k), sy(v)])];
  const gap = [...pred.slice(0, h).map((v, k) => [sx(today + 1 + k), sy(v)]), ...truth.slice(0, h).map((v, k) => [sx(today + 1 + k), sy(v)]).reverse()];
  const onPtr = (e) => {
    const pt = svgPoint(e, svgRef.current);
    if (!pt) return;
    const k = Math.round(((pt.x - X0) / (X1 - X0)) * (n - 1)) - today;
    setH(Math.max(1, Math.min(14, k)));
  };
  const onKey = (e) => {
    const d = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[e.key];
    if (d) { e.preventDefault(); setH((v) => Math.max(1, Math.min(14, v + d))); }
    else if (e.key === 'Home') { e.preventDefault(); setH(1); }
    else if (e.key === 'End') { e.preventDefault(); setH(14); }
  };
  const maxErr = Math.max(...B.horizonMAE) * 1.1;
  const hx = sx(today + h);

  return (
    <Stage
      title="How far ahead can it see?"
      slides="slides 9–11"
      tryThis="Predict where the forecast leaves the truth, then drag the handle from 1 day out to 14."
      caption={`Each day ahead is predicted from the model’s own previous predictions (slide 11’s *for* loop), so the errors pile up.`}
      own="this page’s own run of slide 9’s code"
      maths={
        <>
          <MEq tex={'\\underbrace{2 \\times (16 \\times 16 + 2 \\times 16 + 16)}_{\\texttt{Bidirectional(SimpleRNN(16))}} + \\underbrace{32 \\times 2 + 2}_{\\texttt{Dense(2)}} = ' + `${p.bi} + ${p.out} = ${p.total}`} />
          <MLine text={`One direction: 16 × 16 recurrent weights, 2 × 16 input weights and 16 biases = 304; two directions = ${p.bi}. \`Dense(2)\` reads the 32 concatenated outputs: ${p.out}. Total **${p.total}**, as slide 9’s comment says.`} />
          <MLine text={`Validation MAE ${h} day${h > 1 ? 's' : ''} ahead over all ${data.RUN.validWindows} validation windows (this page’s run, × 1e6, bus and rail): **${Math.round(B.horizonMAE[h - 1]).toLocaleString('en-AU')}**. Next-day MAE: this page ${B.valMAE.toLocaleString('en-AU')}; slide 10: ${PRINTED.biRnnMAE.text}.`} />
          <p className="dl8s-mnote">Slide 11’s chart has no data labels; on its axis it climbs from just under 50000 at 1 day to above 300000 at 14 days. This run’s curve ends far lower (132,289) and is less smooth. Trained on {data.RUN.device} with TensorFlow {data.RUN.tf}, early stopping after {B.epochsRun} epochs (best {B.bestEpoch}).</p>
        </>
      }
    >
      <div ref={wrap}>
        <div className="dl8s-floorrow">
          <WindowPicker labels={labels} win={win} setWin={setWin} />
          <SeriesSwitch s={s} setS={setS} />
        </div>
        <svg ref={svgRef} className="dl8s-svg" viewBox={`0 0 ${W} ${H}`} role="group" aria-label={`${SERIES[s]} riders: simple_biRNN forecast ${h} days ahead from ${labels[win]}`}>
          {niceTicks(lo, hi).map((v) => {
            return (
              <g key={v}>
                <line className="dl8s-grid-line" x1={X0} y1={sy(v)} x2={X1} y2={sy(v)} />
                <text x={X0 - 6} y={sy(v) + 3} textAnchor="end" className="dl8s-t dl8s-t--xs dl8s-t--m">{thousands(v)}</text>
              </g>
            );
          })}
          <line className="dl8s-today" x1={sx(today)} y1={Y0 - 6} x2={sx(today)} y2={Y1} />
          <text x={sx(today) - 4} y={Y0 - 10} textAnchor="end" className="dl8s-t dl8s-t--xs">56th day (last input)</text>
          <polygon className="dl8s-gap" points={gap.map((q) => q.join(',')).join(' ')} />
          <path className="dl8s-line dl8s-line--truth" d={pathOf(truthPts)} />
          <path className="dl8s-line dl8s-line--dec" d={pathOf(predPts)} />
          {predPts.slice(1).map(([x, y], k) => <circle key={k} cx={x} cy={y} r={2.6} className="dl8s-br__pt" />)}
          <text x={X1} y={sy(truth[13]) - 8} textAnchor="end" className="dl8s-t dl8s-t--xs">truth</text>
          <text x={predPts[predPts.length - 1][0] + 6} y={predPts[predPts.length - 1][1] + 4} className="dl8s-t dl8s-t--xs dl8s-t--dec">forecast</text>

          {/* the horizon handle, on the time axis */}
          <g
            className={`dl8s-scrub${drag ? ' dl8s-scrub--drag' : ''}`}
            role="slider"
            tabIndex={0}
            aria-label="Days ahead"
            aria-valuemin={1}
            aria-valuemax={14}
            aria-valuenow={h}
            onKeyDown={onKey}
            onPointerDown={(e) => { e.currentTarget.setPointerCapture?.(e.pointerId); setDrag(true); onPtr(e); }}
            onPointerMove={(e) => { if (drag) onPtr(e); }}
            onPointerUp={() => setDrag(false)}
            onPointerCancel={() => setDrag(false)}
          >
            <rect x={sx(today)} y={Y1 + 4} width={X1 - sx(today) + 10} height={40} fill="transparent" />
            <line className="dl8s-scrub__track" x1={sx(today + 1)} y1={Y1 + 22} x2={sx(today + 14)} y2={Y1 + 22} />
            <g className="dl8s-scrub__knob" style={{ transform: `translateX(${hx}px)` }}>
              <line x1={0} y1={Y1} x2={0} y2={Y1 + 14} stroke="var(--dl8s-dec)" strokeWidth={2} />
              <circle cx={0} cy={Y1 + 22} r={8} />
              <text x={0} y={Y1 + 44} textAnchor={narrow && h > 7 ? 'end' : 'middle'} className="dl8s-t dl8s-t--b dl8s-t--m">{h} day{h > 1 ? 's' : ''} ahead</text>
            </g>
          </g>

          {!narrow && (
            <ErrInset x={570} y={60} w={150} h={110} max={maxErr} at={h} curves={[{ key: 'b', v: B.horizonMAE, cls: 'dl8s-line--dec', label: '' }]} />
          )}
          {narrow && (
            <ErrInset x={60} y={H - 46} w={240} h={34} max={maxErr} at={h} curves={[{ key: 'b', v: B.horizonMAE, cls: 'dl8s-line--dec', label: '' }]} />
          )}
        </svg>
      </div>
    </Stage>
  );
}

/* ── §4 · training vs testing ────────────────────────────────────────── */
export function StagesLab() {
  const { printing } = useStudy();
  const wrap = useRef(null);
  const narrow = useWidth(wrap) < 560;
  const [mode, setMode] = useState('test');
  const [k, setK] = useState(14);
  const [playing, setPlaying] = useState(false);
  const timer = useRef(0);
  useEffect(() => () => window.clearInterval(timer.current), []);
  const step = printing ? 14 : k;

  const play = () => {
    window.clearInterval(timer.current);
    setMode('test');
    setK(0);
    setPlaying(true);
    let i = 0;
    timer.current = window.setInterval(() => {
      i += 1;
      setK(i);
      if (i >= 14) { window.clearInterval(timer.current); setPlaying(false); }
    }, 420);
  };

  const W = narrow ? 380 : 760;
  const H = narrow ? 300 : 230;
  const dx0 = narrow ? 24 : 250;
  const cw = narrow ? 21 : 32;
  const slotX = (j) => dx0 + j * (cw + (narrow ? 3 : 4));
  const yOut = narrow ? 150 : 70;
  const yIn = narrow ? 214 : 142;
  const enc = narrow ? { x: 24, y: 40, w: 220 } : { x: 18, y: 92, w: 190 };
  const status = (j) => {
    if (mode === 'train' || j === 0) return 'real';
    return j <= step ? 'est' : 'zero';
  };
  const outShown = (j) => mode === 'train' || j < step;

  return (
    <Stage
      title="Training stage vs testing stage"
      slides="slides 12–13"
      tryThis="Predict what the decoder gets as inputs once the true days are hidden, then press ▶ on the testing stage."
      caption={mode === 'train' ? 'Training: every decoder input is a real day (Day 55, then `y_train` shifted by one).' : 'Testing: only Day 55 is real; the other inputs start at 0 and are replaced by the estimates, one per run.'}
      own="redrawn from slides 12–13 by this page; the ▶ loop is this page’s animation"
      maths={
        <>
          <MLine text="Encoder: Day 0–54 (55 days). Decoder inputs: Day 55–68. Decoder outputs: Day 56–69, compared with `y_train` (training, minimise MSE) or `y_test` (testing, the prediction error)." />
          <MLine text="Testing (slide 13): only the first decoder input is real, Day 55 of `X_test` (`X_test[:,-1,:]`); the other 13 start as 0; `model.predict(...)` runs 14 times, and each new (bus, rail) estimate replaces the decoder’s input for the next day." />
        </>
      }
    >
      <div ref={wrap}>
        <div className="dl8s-floorrow">
          <div className="dl8s-switch" role="group" aria-label="Stage">
            <button type="button" className={`dl8s-switch__opt${mode === 'train' ? ' dl8s-switch__opt--on' : ''}`} aria-pressed={mode === 'train'} onClick={() => { window.clearInterval(timer.current); setPlaying(false); setMode('train'); }}>training stage</button>
            <button type="button" className={`dl8s-switch__opt${mode === 'test' ? ' dl8s-switch__opt--on' : ''}`} aria-pressed={mode === 'test'} onClick={() => setMode('test')}>testing stage</button>
          </div>
          {mode === 'test' && (
            <span className="dl8s-br__loop">
              <button type="button" className="dl8s-story__play" onClick={play} disabled={playing} aria-label="Run the 14-step testing loop">▶</button>
              <span className="dl8s-t--m">run {Math.min(step, 14)} / 14</span>
            </span>
          )}
        </div>
        <svg className="dl8s-svg" viewBox={`0 0 ${W} ${H}`} role="group" aria-label={mode === 'train' ? 'Training stage: all decoder inputs real' : `Testing stage, after ${step} of 14 runs`}>
          <defs>
            <pattern id="dl8s-zero-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="5" className="dl8s-br__hatch" />
            </pattern>
          </defs>
          {/* encoder: 55 real days */}
          <rect className="dl8s-br__box dl8s-br__box--enc" x={enc.x} y={enc.y} width={enc.w} height={56} rx={8} />
          <text x={enc.x + 8} y={enc.y - 6} className="dl8s-t dl8s-t--b dl8s-t--enc">Encoder · 55 days</text>
          {Array.from({ length: 55 }, (_, j) => (
            <rect key={j} className="dl8s-br__tick" x={enc.x + 8 + j * ((enc.w - 16) / 55)} y={enc.y + 14} width={(enc.w - 16) / 55 - 1} height={28} />
          ))}
          <text x={enc.x + 8} y={enc.y + 70} className="dl8s-t dl8s-t--xs">Day 0</text>
          <text x={enc.x + enc.w - 8} y={enc.y + 70} textAnchor="end" className="dl8s-t dl8s-t--xs">Day 54</text>
          {/* encoder_state → decoder */}
          {narrow ? (
            // down the left margin, then into the first decoder step between its rows
            <g>
              <path className="dl8s-br__state" d={`M${enc.x} ${enc.y + 28} H 10 V ${(yOut + yIn) / 2 + 8} H ${slotX(0) - 8}`} />
              <Arrow x1={slotX(0) - 9} y1={(yOut + yIn) / 2 + 8} x2={slotX(0) + 4} y2={(yOut + yIn) / 2 + 8} on />
            </g>
          ) : (
            <Arrow x1={enc.x + enc.w + 4} y1={enc.y + 28} x2={slotX(0) - 6} y2={(yOut + yIn) / 2 + 8} on />
          )}
          <text x={narrow ? enc.x + enc.w / 2 + 8 : slotX(0) - 6} y={narrow ? enc.y + 84 : enc.y - 4} textAnchor={narrow ? 'start' : 'end'} className="dl8s-t dl8s-t--xs dl8s-t--m">encoder_state</text>

          {/* decoder slots */}
          <text x={narrow ? W - 8 : slotX(0)} y={yOut - 26} textAnchor={narrow ? 'end' : 'start'} className="dl8s-t dl8s-t--b dl8s-t--dec">Decoder · 14 steps</text>
          {Array.from({ length: 14 }, (_, j) => {
            const st = status(j);
            const x = slotX(j);
            return (
              <g key={j}>
                {/* output (estimated day 56 + j) */}
                <rect className={`dl8s-br__out dl8s-fade${outShown(j) ? '' : ' dl8s-dim'}`} x={x} y={yOut} width={cw} height={cw * 0.8} rx={4} />
                <line className="dl8s-br__wire" x1={x + cw / 2} y1={yIn} x2={x + cw / 2} y2={yOut + cw * 0.8} />
                {/* input (day 55 + j) */}
                <rect className={`dl8s-br__in dl8s-br__in--${st}`} x={x} y={yIn} width={cw} height={cw * 0.8} rx={4} fill={st === 'zero' ? 'url(#dl8s-zero-hatch)' : undefined} />
                {st === 'zero' && <text x={x + cw / 2} y={yIn + cw * 0.55} textAnchor="middle" className="dl8s-t dl8s-t--xs dl8s-t--m">0</text>}
                {/* the estimate fed back (testing) */}
                {mode === 'test' && j > 0 && j <= step && (
                  <path className="dl8s-br__feed" d={`M${slotX(j - 1) + cw / 2} ${yOut + cw * 0.8} L${x + cw / 2} ${yIn}`} />
                )}
                {(j % (narrow ? 13 : 13) === 0) && (
                  <>
                    <text x={x + cw / 2} y={yIn + cw * 0.8 + 16} textAnchor="middle" className="dl8s-t dl8s-t--xs">Day {55 + j}</text>
                    <text x={x + cw / 2} y={yOut - 6} textAnchor="middle" className="dl8s-t dl8s-t--xs">Day {56 + j}</text>
                  </>
                )}
              </g>
            );
          })}
          <g className="dl8s-br__legend" transform={`translate(${slotX(0)} ${H - 12})`}>
            <rect x={0} y={-9} width={10} height={10} rx={2} className="dl8s-br__in--real" />
            <text x={14} y={0} className="dl8s-t dl8s-t--xs">real day</text>
            <rect x={78} y={-9} width={10} height={10} rx={2} className="dl8s-br__in--zero" fill="url(#dl8s-zero-hatch)" />
            <text x={92} y={0} className="dl8s-t dl8s-t--xs">0 (unknown)</text>
            <rect x={174} y={-9} width={10} height={10} rx={2} className="dl8s-br__in--est" />
            <text x={188} y={0} className="dl8s-t dl8s-t--xs">estimate fed back</text>
          </g>
        </svg>
      </div>
    </Stage>
  );
}

/* ── §5 · rnn_ed's forecasts ─────────────────────────────────────────── */
export function EdForecastLab() {
  const { data, failed } = useBusRail();
  const wrap = useRef(null);
  const narrow = useWidth(wrap) < 560;
  const [win, setWin] = useState(0);
  const [s, setS] = useState(0);
  const [view, setView] = useState('forecast');
  const labels = useWindowTokens(data);
  const p = rnnEdParams();

  if (!data) {
    return (
      <Stage title="Fourteen days ahead" slides="slides 14–17">
        <div ref={wrap}><Loading failed={failed} /></div>
      </Stage>
    );
  }
  const E = data.RNN_ED;
  const B = data.BIRNN;
  const W = narrow ? 380 : 760;
  const H = narrow ? 300 : 280;
  const X0 = narrow ? 34 : 50;
  const X1 = narrow ? W - 64 : 520;
  const Y0 = 22;
  const Y1 = narrow ? 190 : 236;

  let body;
  if (view === 'forecast') {
    const wB = B.windows[win];
    const wE = E.windows[win];
    const back = 14;
    const hist = wB.input.slice(56 - back).map((r) => r[s]);
    const truth = wE.truth.map((r) => r[s]);
    const pe = wE.pred.map((r) => r[s]);
    const pb = wB.pred.map((r) => r[s]);
    const all = [...hist, ...truth, ...pe, ...pb];
    const lo = Math.min(...all) * 0.92;
    const hi = Math.max(...all) * 1.04;
    const n = back + 14;
    const sx = (k) => X0 + (k / (n - 1)) * (X1 - X0);
    const sy = (v) => Y1 - ((v - lo) / (hi - lo)) * (Y1 - Y0);
    const today = back - 1;
    const line = (vals) => pathOf([[sx(today), sy(hist[back - 1])], ...vals.map((v, k) => [sx(today + 1 + k), sy(v)])]);
    const maxErr = Math.max(...B.horizonMAE, ...E.horizonMAE) * 1.1;
    body = (
      <svg className="dl8s-svg" viewBox={`0 0 ${W} ${H}`} role="group" aria-label={`${SERIES[s]}: rnn_ed and simple_biRNN 14-day forecasts from ${labels[win]}`}>
        {niceTicks(lo, hi).map((v) => {
          return (
            <g key={v}>
              <line className="dl8s-grid-line" x1={X0} y1={sy(v)} x2={X1} y2={sy(v)} />
              <text x={X0 - 6} y={sy(v) + 3} textAnchor="end" className="dl8s-t dl8s-t--xs dl8s-t--m">{thousands(v)}</text>
            </g>
          );
        })}
        <line className="dl8s-today" x1={sx(today)} y1={Y0 - 6} x2={sx(today)} y2={Y1} />
        <path className="dl8s-line dl8s-line--truth" d={pathOf([...hist, ...truth].map((v, k) => [sx(k), sy(v)]))} />
        <g className="dl8s-br__legend" transform={`translate(${X0} 10)`}>
          <line x1={0} y1={0} x2={16} y2={0} className="dl8s-line dl8s-line--truth" />
          <text x={20} y={4} className="dl8s-t dl8s-t--xs">truth</text>
          <line x1={58} y1={0} x2={74} y2={0} className="dl8s-line dl8s-line--dec" />
          <text x={78} y={4} className="dl8s-t dl8s-t--xs">rnn_ed</text>
          <line x1={124} y1={0} x2={140} y2={0} className="dl8s-line dl8s-line--ghost" />
          <text x={144} y={4} className="dl8s-t dl8s-t--xs">simple_biRNN</text>
        </g>
        <path className="dl8s-line dl8s-line--ghost" d={line(pb)} />
        <path className="dl8s-line dl8s-line--dec" d={line(pe)} />
        {(() => {
          // end labels, nudged apart when the two forecasts end close together
          let ye = sy(pe[13]);
          let yb = sy(pb[13]);
          if (Math.abs(ye - yb) < 13) { const m = (ye + yb) / 2; const up = ye <= yb ? -1 : 1; ye = m + up * 7; yb = m - up * 7; }
          return (
            <>
              <text x={X1 + 4} y={ye + 4} className="dl8s-t dl8s-t--xs dl8s-t--dec">rnn_ed</text>
              <text x={X1 + 4} y={yb + 4} className="dl8s-t dl8s-t--xs">biRNN</text>
            </>
          );
        })()}
        <text x={sx(0)} y={Y1 + 18} className="dl8s-t dl8s-t--xs">{dayLabel(wB.start, 42)}</text>
        <text x={sx(today)} y={Y1 + 18} textAnchor="middle" className="dl8s-t dl8s-t--xs">{dayLabel(wB.start, 55)}</text>
        <text x={X1} y={Y1 + 18} textAnchor="end" className="dl8s-t dl8s-t--xs">{dayLabel(wB.start, 69)}</text>
        {!narrow && (
          <ErrInset x={590} y={60} w={130} h={100} max={maxErr} curves={[
            { key: 'b', v: B.horizonMAE, cls: 'dl8s-line--ghost', label: 'biRNN' },
            { key: 'e', v: E.horizonMAE, cls: 'dl8s-line--dec', label: 'rnn_ed' },
          ]} />
        )}
        {narrow && (
          <ErrInset x={60} y={H - 54} w={220} h={38} max={maxErr} curves={[
            { key: 'b', v: B.horizonMAE, cls: 'dl8s-line--ghost', label: '' },
            { key: 'e', v: E.horizonMAE, cls: 'dl8s-line--dec', label: '' },
          ]} />
        )}
      </svg>
    );
  } else {
    const c = E.curves;
    const ep = c.epoch;
    const maxY = 0.2;
    const sx = (e) => X0 + (e / ep[ep.length - 1]) * (X1 - X0);
    const sy = (v) => Y1 - (Math.min(v, maxY) / maxY) * (Y1 - Y0);
    const lines = [
      { k: 'loss', cls: 'dl8s-br__lc--train dl8s-br__lc--dash', label: 'loss' },
      { k: 'mae', cls: 'dl8s-br__lc--train dl8s-br__lc--dashdot', label: 'mae' },
      { k: 'val_loss', cls: 'dl8s-br__lc--val dl8s-br__lc--dash', label: 'val_loss' },
      { k: 'val_mae', cls: 'dl8s-br__lc--val dl8s-br__lc--dashdot', label: 'val_mae' },
    ];
    body = (
      <svg className="dl8s-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="rnn_ed learning curves (this page's run)">
        {[0, 0.05, 0.1, 0.15, 0.2].map((v) => (
          <g key={v}>
            <line className="dl8s-grid-line" x1={X0} y1={sy(v)} x2={X1} y2={sy(v)} />
            <text x={X0 - 6} y={sy(v) + 3} textAnchor="end" className="dl8s-t dl8s-t--xs dl8s-t--m">{v.toFixed(2)}</text>
          </g>
        ))}
        {lines.map((l) => <path key={l.k} className={`dl8s-line ${l.cls}`} d={pathOf(c[l.k].map((v, i) => [sx(ep[i]), sy(v)]))} />)}
        {lines.map((l, i) => (
          <text key={l.k} x={X1 + 8} y={Y0 + 14 + i * 16} className={`dl8s-t dl8s-t--xs ${i < 2 ? '' : 'dl8s-t--dec'}`}>{l.label}</text>
        ))}
        <line className="dl8s-today" x1={sx(E.bestEpoch)} y1={Y0} x2={sx(E.bestEpoch)} y2={Y1} />
        <text x={sx(E.bestEpoch) - 4} y={Y1 - 8} textAnchor="end" className="dl8s-t dl8s-t--xs">{narrow ? `best epoch ${E.bestEpoch}` : `best epoch ${E.bestEpoch} (weights restored)`}</text>
        <text x={X1} y={Y1 + 18} textAnchor="end" className="dl8s-t dl8s-t--xs">epoch {ep[ep.length - 1]}</text>
        <text x={X0} y={Y1 + 18} className="dl8s-t dl8s-t--xs">0</text>
      </svg>
    );
  }

  return (
    <Stage
      title="Fourteen days ahead"
      slides="slides 14–17"
      tryThis="Predict which forecast stays closer to the truth by day 14, then flip through the windows."
      caption={view === 'forecast' ? 'Run 14 times with its own estimates fed back (slide 17’s loop), rnn_ed still drifts far less than simple_biRNN’s day-by-day loop.' : 'Slide 16’s check: all four curves fall fast and level off, with barely any sign of overfitting (val_loss creeps up slightly before early stopping).'}
      own="this page’s own runs of slides 9 and 14–15"
      maths={
        <>
          <MLine text={`Scoreboard. Slides: next-day \`simple_biRNN\` 27,936 (slide 10 prints ${PRINTED.biRnnMAE.text}); 14-day \`rnn_ed\` 34,863.8857 (slide 17). Both are means: slide 17’s over all 14 days. This page’s runs, the same two means: ${Math.round(B.valMAE).toLocaleString('en-AU')} and ${Math.round(E.valMAE).toLocaleString('en-AU')} (teacher-forced ${Math.round(E.valMAETeacherForced).toLocaleString('en-AU')}).`} />
          <MLine text={`\`rnn_ed\`’s parameters (this page’s working, Keras agrees: ${E.params.toLocaleString('en-AU')}): encoder ${p.enc} + decoder \`SimpleRNN(32)\` on 2 inputs ${p.dec} + \`Dense(2)\` ${p.out} = **${p.total.toLocaleString('en-AU')}**. The slides print no count for it.`} />
          <MLine text={`The error on day 14 alone (not a 14-day mean), all ${data.RUN.validWindows} windows (this page): \`rnn_ed\` ${E.horizonMAE[13].toLocaleString('en-AU')}, \`simple_biRNN\` ${B.horizonMAE[13].toLocaleString('en-AU')}: the right end of the error curves.`} />
          <MLine text="Slide 17’s `predict()` body is elided on the slide; this page wrote its own loop (14 `model.predict` calls, zeros except Day 55, each estimate fed in as the next input). Its numbers will not match the slides’." />
        </>
      }
    >
      <div ref={wrap}>
        <div className="dl8s-floorrow">
          <div className="dl8s-switch" role="group" aria-label="View">
            <button type="button" className={`dl8s-switch__opt${view === 'forecast' ? ' dl8s-switch__opt--on' : ''}`} aria-pressed={view === 'forecast'} onClick={() => setView('forecast')}>forecasts</button>
            <button type="button" className={`dl8s-switch__opt${view === 'curves' ? ' dl8s-switch__opt--on' : ''}`} aria-pressed={view === 'curves'} onClick={() => setView('curves')}>learning curves</button>
          </div>
          {view === 'forecast' && <SeriesSwitch s={s} setS={setS} />}
        </div>
        {body}
        {view === 'forecast' && <WindowPicker labels={labels} win={win} setWin={setWin} />}
      </div>
    </Stage>
  );
}

