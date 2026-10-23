import { Why } from '../../kit/WhyText';
import { SCENE } from '../../content/long-line.js';

/* ============================================================================
   THE LONG SHORT-TERM LINE — THE PICTURES (procedural SVG, no assets)
   ----------------------------------------------------------------------------
   Roles (L8 tokens): the state / cargo = --dl8s-v, the crate x(t) and g(t) =
   --dl8s-k, what is read out (h(t) = y(t)) = --dl8s-q, gates = --dl8s-pos.
     TrainScene     one station: the cargo car (c(t−1) for an LSTM, h(t−1)
                    for a GRU), the platform crate, the readout board, and
                    the gates drawn on the train (hatch, crane, read-out)
     RouteStrip     the line: one dot per station (time step), due stops
     UnrolledScene  level 1: the SimpleRNN unrolled, one car per frame, the
                    first crate's trace fading
     PairScene      level 1: the rolled-up neuron next to the unrolled one
     StepScene      level 1: one step of slide 9 with the numbers
     SignalScene    the train held at a signal (a question between stations)
   Numbers come from maths/longLine.js; words from content/long-line.js.
   ========================================================================== */

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const fill = (text, k, v) => text.replace(`{${k}}`, String(v));
const n2 = (v) => `${v < 0 ? '−' : ''}${Math.abs(v).toFixed(2)}`;

function Arrowhead({ id, cls }) {
  return (
    <marker id={id} viewBox="0 0 10 10" refX="8" refY="5" markerUnits="userSpaceOnUse" markerWidth="11" markerHeight="11" orient="auto-start-reverse">
      <path d="M0 0 L10 5 L0 10 z" className={cls} />
    </marker>
  );
}

/* ── one station ─────────────────────────────────────────────────────── */
// two layouts of the same picture: WIDE (desktop) and NARROW (phones: no
// locomotive, no words on the r pipe); CSS shows one per container width
const WIDE = {
  w: 420, board: [18, 150], readX: 88, car: [16, 190], hatch: [80, 142], wheels: [40, 182],
  loco: true, crane: 'M344 84 C 330 22, 214 18, 176 56', craneLabel: [244, 22], xMark: [252, 30],
  rpipe: 'M200 70 C 226 56, 262 50, 300 52', valve: [262, 51], rLabel: [262, 72],
  platform: [292, 124], crate: 318, input: [377, 100, 'start'], platLabel: 354,
};
const NARROW = {
  w: 300, board: [8, 140], readX: 70, car: [8, 150], hatch: [56, 102], wheels: [30, 136],
  loco: false, crane: 'M249 84 C 240 24, 172 20, 140 56', craneLabel: [200, 20], xMark: [196, 28],
  rpipe: 'M150 70 C 166 58, 180 52, 196 50', valve: [196, 50], rLabel: null,
  platform: [206, 92], crate: 222, input: [216, 100, 'end'], platLabel: 252,
};

export function TrainScene({ model, prev, x, levers, result, target, scale, t, due, uid, narrow = false }) {
  const G = narrow ? NARROW : WIDE;
  const isGru = model === 'gru';
  const W = isGru ? SCENE.gru : SCENE.lstm;
  const keepOn = isGru ? !!levers.z : !!levers.f; // the hatch stays shut (keep)
  const addOn = isGru ? !levers.z : !!levers.i; // the crane loads g
  const readOn = isGru ? true : !!levers.o; // the GRU has no output gate
  const rOn = isGru ? !!levers.r : false;
  const before = isGru ? prev.h : prev.c;
  const shownC = result ? result.c : before;
  const level = clamp01(Math.abs(shownC) / scale);
  const ghost = target ? clamp01(Math.abs(target.c) / scale) : null;
  const stateSym = W.state;
  const carTop = 60;
  const floor = 130;
  const inner = floor - carTop - 6;
  const [cx0, cw] = G.car;
  const cx1 = cx0 + cw;
  const aid = `dla-ll-ah-${uid}${narrow ? '-n' : ''}`;
  const label = `Station t = ${t}. The cargo car holds ${stateSym}(t−1) = ${n2(before)}; the platform crate is x(t) = ${n2(x)}.${result ? ` After departing, ${stateSym}(t) = ${n2(result.c)} and the readout h(t) = ${n2(result.h)}.` : ''}`;
  return (
    <svg className={`dla-svg dla-ll-scene dla-ll-scene--${narrow ? 'narrow' : 'wide'}`} viewBox={`0 0 ${G.w} 186`} role="img" aria-label={label}>
      <defs>
        <Arrowhead id={`${aid}-k`} cls="dla-ll-fill-k" />
        <Arrowhead id={`${aid}-q`} cls="dla-ll-fill-q" />
      </defs>
      {/* readout board: y(t) = h(t) */}
      <g className={`dla-ll-board${readOn ? ' dla-ll-on' : ''}`}>
        <rect x={G.board[0]} y="4" width={G.board[1]} height="34" rx="5" className="dla-ll-board__frame" />
        <text x={G.board[0] + 9} y="18" className="dla-t dla-t--xs">{W.board}</text>
        <text x={G.board[0] + 9} y="32" className="dla-t dla-t--m dla-t--b dla-ll-ink-q">{result ? n2(result.h) : readOn ? W.boardIdle : W.boardHeld}</text>
      </g>
      <path d={`M${G.readX} ${carTop - 2} L${G.readX} 40`} className={`dla-ll-read${readOn ? ' dla-ll-on' : ''}`} markerEnd={readOn ? `url(#${aid}-q)` : undefined} />
      <text x={G.readX + 8} y="54" className="dla-t dla-t--xs">{W.read}</text>

      {/* the crane: i(t) ⊗ g(t) (LSTM) or (1 − z(t)) ⊗ g(t) (GRU) */}
      <path d={G.crane} className={`dla-ll-crane${addOn ? ' dla-ll-on' : ''}`} markerEnd={addOn ? `url(#${aid}-k)` : undefined} />
      <text x={G.craneLabel[0]} y={G.craneLabel[1]} textAnchor="middle" className="dla-t dla-t--xs">{W.crane}</text>
      {!addOn && <path d={`M${G.xMark[0]} ${G.xMark[1]} l8 8 m0 -8 l-8 8`} className="dla-ll-x" />}

      {/* GRU: r(t) lets h(t−1) into g(t) */}
      {isGru && (
        <g className={`dla-ll-rpipe${rOn ? ' dla-ll-on' : ''}`}>
          <path d={G.rpipe} />
          <circle cx={G.valve[0]} cy={G.valve[1]} r="7" className="dla-ll-valve" />
          <text x={G.valve[0]} y={G.valve[1] + 4} textAnchor="middle" className="dla-t dla-t--xs dla-t--b">{W.r}</text>
          {G.rLabel && <text x={G.rLabel[0]} y={G.rLabel[1]} textAnchor="middle" className="dla-t dla-t--xs">{rOn ? W.rOn : W.rOff}</text>}
        </g>
      )}

      {/* the train */}
      <g className="dla-ll-train">
        <rect x={cx0} y={carTop} width={cw} height={floor - carTop} rx="6" className="dla-ll-car" />
        {ghost !== null && <line x1={cx0 + 6} x2={cx1 - 6} y1={floor - 3 - ghost * inner} y2={floor - 3 - ghost * inner} className="dla-ll-ghost" />}
        <rect x={cx0 + 6} y={floor - 3 - inner} width={cw - 12} height={inner} rx="3" className="dla-ll-cargo" style={{ transform: `scaleY(${level})` }} />
        <text x={cx0 + 10} y={carTop + 16} className="dla-t dla-t--s dla-halo">{result ? `${stateSym}(t)` : `${stateSym}(t−1)`}</text>
        <text x={cx1 - 10} y={carTop + 16} textAnchor="end" className="dla-t dla-t--m dla-t--b dla-halo">{n2(shownC)}</text>
        {/* the hatch in the floor: the forget gate (LSTM) or z (GRU) */}
        {keepOn
          ? <line x1={cx0} x2={cx1} y1={floor} y2={floor} className="dla-ll-hatch dla-ll-on" />
          : <g className="dla-ll-hatch">
              <line x1={cx0} x2={G.hatch[0]} y1={floor} y2={floor} />
              <line x1={G.hatch[1]} x2={cx1} y1={floor} y2={floor} />
              <line x1={G.hatch[0]} x2={G.hatch[0] + 16} y1={floor} y2={floor + 14} />
              <line x1={G.hatch[1]} x2={G.hatch[1] - 16} y1={floor} y2={floor + 14} />
            </g>}
        <text x={cx0 + cw / 2} y={floor + 34} textAnchor="middle" className="dla-t dla-t--xs">
          {keepOn ? W.hatchKept : W.hatchDropped}
        </text>
        <circle cx={G.wheels[0]} cy="138" r="6" className="dla-ll-wheel" />
        <circle cx={G.wheels[1]} cy="138" r="6" className="dla-ll-wheel" />
        {G.loco && (
          <>
            <path d="M212 130 L212 92 L246 92 L246 78 L280 78 L280 130 Z" className="dla-ll-loco" />
            <rect x="254" y="84" width="18" height="14" rx="2" className="dla-ll-loco__win" />
            <circle cx="228" cy="138" r="6" className="dla-ll-wheel" />
            <circle cx="264" cy="138" r="6" className="dla-ll-wheel" />
            <text x="246" y="118" textAnchor="middle" className="dla-t dla-t--xs">{SCENE.cell}</text>
          </>
        )}
      </g>

      {/* track + platform + crate */}
      <line x1="0" x2={G.w} y1="145" y2="145" className="dla-ll-rail" />
      <rect x={G.platform[0]} y="132" width={G.platform[1]} height="13" className="dla-ll-platform" />
      <g className={`dla-ll-crate${addOn ? ' dla-ll-on' : ''}`}>
        <rect x={G.crate} y="86" width="54" height="46" rx="4" />
        <path d={`M${G.crate} 86 L${G.crate + 54} 132 M${G.crate + 54} 86 L${G.crate} 132`} className="dla-ll-crate__x" />
        <text x={G.input[0]} y={G.input[1]} textAnchor={G.input[2]} className="dla-t dla-t--xs">{SCENE.input}</text>
        <text x={G.crate + 27} y="114" textAnchor="middle" className="dla-t dla-t--m dla-t--b dla-halo">{n2(x)}</text>
      </g>
      <text x={G.platLabel} y="164" textAnchor="middle" className="dla-t dla-t--xs">{fill(SCENE.platform, 't', t)}</text>
      {due !== null && due !== undefined && <text x={cx0} y="180" className="dla-t dla-t--xs dla-t--b">{fill(SCENE.due, 'due', due)}</text>}
    </svg>
  );
}

/* ── the line ────────────────────────────────────────────────────────── */
export function RouteStrip({ route, current, results, scale }) {
  return (
    <ol className="dla-ll-route" aria-label="The line: one station per time step">
      {route.map((s) => {
        const passed = s.t < current;
        const res = results[s.id];
        const cls = `dla-ll-route__st${s.t === current ? ' dla-ll-route__st--now' : ''}${passed ? ' dla-ll-route__st--past' : ''}${res === false ? ' dla-ll-route__st--miss' : ''}`;
        const deliver = s.card === 'deliver' || s.card === 'loadDeliver';
        return (
          <li key={s.id} className={cls} aria-current={s.t === current ? 'step' : undefined} aria-label={`t = ${s.t}${deliver ? ', a delivery stop' : ''}${passed ? `, passed${res === false ? ' (missed)' : ''}` : ''}`}>
            <span className="dla-ll-route__bar" aria-hidden="true" style={{ transform: `scaleY(${passed ? clamp01(Math.abs(s.c) / scale) : 0})` }} />
            <span className={`dla-ll-route__dot${deliver ? ' dla-ll-route__dot--due' : ''}`} aria-hidden="true" />
            <span className="dla-ll-route__t" aria-hidden="true">{s.t}</span>
          </li>
        );
      })}
    </ol>
  );
}

/* ── level 1: the SimpleRNN unrolled through time ─────────────────────── */
export function UnrolledScene({ run }) {
  const n = run.xs.length;
  const gap = 400 / n;
  const w = Math.min(52, gap - 14);
  const top = 30;
  const h = 56;
  const label = `A SimpleRNN unrolled through time over ${n} frames. h(t): ${run.h.map((v) => n2(v)).join(', ')}. Trace of the first crate: ${run.trace.map((v) => n2(v)).join(', ')}.`;
  return (
    <svg className="dla-svg dla-ll-scene" viewBox="0 0 420 150" role="img" aria-label={label}>
      {run.xs.map((x, k) => {
        const cx = 14 + gap * k + gap / 2;
        const x0 = cx - w / 2;
        const hv = clamp01(Math.abs(run.h[k]));
        const tv = clamp01(Math.abs(run.trace[k]));
        return (
          <g key={k}>
            {k > 0 && <path d={`M${x0 - (gap - w) + 2} ${top + h / 2} L${x0 - 3} ${top + h / 2}`} className="dla-ll-link" />}
            <rect x={x0} y={top} width={w} height={h} rx="5" className="dla-ll-car" />
            <rect x={x0 + 4} y={top + 4} width={w / 2 - 6} height={h - 8} className="dla-ll-cargo dla-ll-cargo--soft" style={{ transform: `scaleY(${hv})` }} />
            <rect x={cx + 2} y={top + 4} width={w / 2 - 6} height={h - 8} className="dla-ll-cargo" style={{ transform: `scaleY(${tv})` }} />
            <text x={cx} y={top - 8} textAnchor="middle" className="dla-t dla-t--xs">{n2(run.h[k])}</text>
            <text x={cx} y={top + h + 14} textAnchor="middle" className="dla-t dla-t--xs">{SCENE.unrolled.shared}</text>
            <rect x={cx - Math.min(22, gap / 2 - 4)} y={top + h + 22} width={Math.min(44, gap - 8)} height="20" rx="3" className="dla-ll-crate-s" />
            <text x={cx} y={top + h + 36} textAnchor="middle" className="dla-t dla-t--xs dla-t--m">{n2(x)}</text>
            <text x={cx} y={top + h + 56} textAnchor="middle" className="dla-t dla-t--xs">{fill(SCENE.unrolled.frame, 't', k + 1)}</text>
          </g>
        );
      })}
    </svg>
  );
}

/* ── level 1: rolled-up vs unrolled ───────────────────────────────────── */
function Neuron({ cx, cy, r = 13 }) {
  return <circle cx={cx} cy={cy} r={r} className="dla-ll-neuron" />;
}

function Rolled({ ox }) {
  return (
    <g transform={`translate(${ox} 18)`}>
      <Neuron cx={90} cy={70} />
      <path d="M103 70 C 140 70, 140 30, 90 30 C 70 30, 60 42, 66 56" className="dla-ll-link" />
      <path d="M90 108 L90 84" className="dla-ll-link" />
      <path d="M90 56 L90 22" className="dla-ll-link dla-ll-link--out" />
      <text x="90" y="122" textAnchor="middle" className="dla-t dla-t--xs">{SCENE.pair.x}</text>
      <text x="90" y="14" textAnchor="middle" className="dla-t dla-t--xs">{SCENE.pair.y}</text>
    </g>
  );
}

function Unrolled({ ox }) {
  const xs = [30, 74, 118, 162];
  return (
    <g transform={`translate(${ox} 18)`}>
      {xs.map((cx, k) => (
        <g key={k}>
          <Neuron cx={cx} cy={70} r={12} />
          {k > 0 && <path d={`M${xs[k - 1] + 12} 70 L${cx - 12} 70`} className="dla-ll-link" />}
          <path d={`M${cx} 106 L${cx} 82`} className="dla-ll-link" />
          <path d={`M${cx} 58 L${cx} 30`} className="dla-ll-link dla-ll-link--out" />
          <text x={cx} y="120" textAnchor="middle" className="dla-t dla-t--xs">{`${SCENE.pair.x}(${k})`}</text>
          <text x={cx} y="22" textAnchor="middle" className="dla-t dla-t--xs">{`${SCENE.pair.y}(${k})`}</text>
        </g>
      ))}
      <path d="M14 132 L186 132" className="dla-ll-link" />
      <text x="186" y="148" textAnchor="end" className="dla-t dla-t--xs">{SCENE.pair.time}</text>
    </g>
  );
}

export function PairScene({ side }) {
  const unrolledLeft = side === 'left';
  return (
    <svg className="dla-svg dla-ll-scene" viewBox="0 0 420 172" role="img" aria-label="Two pictures of a recurrent neuron, left and right: one is a single neuron whose output loops back to itself, the other is the neuron drawn once per time step along a time axis.">
      {unrolledLeft ? <Unrolled ox={6} /> : <Rolled ox={14} />}
      {unrolledLeft ? <Rolled ox={226} /> : <Unrolled ox={214} />}
      <line x1="210" x2="210" y1="4" y2="168" className="dla-ll-rule" />
      <text x="10" y="13" className="dla-t dla-t--xs dla-t--b">{SCENE.pair.left}</text>
      <text x="410" y="13" textAnchor="end" className="dla-t dla-t--xs dla-t--b">{SCENE.pair.right}</text>
    </svg>
  );
}

/* ── level 1: one step of slide 9 ─────────────────────────────────────── */
export function StepScene({ step, reveal }) {
  const label = `One step: h(t−1) = ${n2(step.hPrev)} times W_h = ${step.Wh}, plus x(t) = ${n2(step.x)} times W_x = ${step.Wx}, plus b_h = ${step.bh}, through tanh.${reveal ? ` h(t) = ${n2(step.h)}.` : ''}`;
  return (
    <svg className="dla-svg dla-ll-scene" viewBox="0 0 420 150" role="img" aria-label={label}>
      <rect x="20" y="40" width="110" height="56" rx="6" className="dla-ll-car" />
      <rect x="26" y="46" width="98" height="44" className="dla-ll-cargo" style={{ transform: `scaleY(${clamp01(step.hPrev)})` }} />
      <text x="30" y="34" className="dla-t dla-t--xs">{SCENE.step.hPrev}</text>
      <text x="75" y="74" textAnchor="middle" className="dla-t dla-t--m dla-t--b dla-halo">{n2(step.hPrev)}</text>

      <path d="M134 68 L272 68" className="dla-ll-link" />
      <text x="200" y="60" textAnchor="middle" className="dla-t dla-t--xs">{fill(SCENE.step.Wh, 'v', step.Wh)}</text>

      <rect x="176" y="104" width="50" height="30" rx="4" className="dla-ll-crate-s" />
      <text x="201" y="124" textAnchor="middle" className="dla-t dla-t--m dla-t--xs">{n2(step.x)}</text>
      <text x="232" y="122" className="dla-t dla-t--xs">{fill(SCENE.step.Wx, 'v', step.Wx)}</text>
      <path d="M226 104 C 250 92, 262 82, 276 74" className="dla-ll-link dla-ll-link--k" />
      <text x="236" y="146" className="dla-t dla-t--xs">{fill(SCENE.step.rest, 'v', step.bh)}</text>

      <rect x="280" y="40" width="120" height="56" rx="6" className="dla-ll-car" />
      {reveal && <rect x="286" y="46" width="108" height="44" className="dla-ll-cargo" style={{ transform: `scaleY(${clamp01(Math.abs(step.h))})` }} />}
      <text x="290" y="34" className="dla-t dla-t--xs">{SCENE.step.h}</text>
      <text x="340" y="74" textAnchor="middle" className="dla-t dla-t--m dla-t--b dla-halo">{reveal ? n2(step.h) : '?'}</text>
    </svg>
  );
}

/* ── a question between stations ──────────────────────────────────────── */
export function SignalScene({ state, model }) {
  const lamp = state === 'right' ? 'go' : state === 'wrong' ? 'stop' : 'wait';
  return (
    <svg className="dla-svg dla-ll-scene dla-ll-scene--signal" viewBox="0 0 420 90" role="img" aria-label={`The ${model === 'gru' ? 'GRU' : 'LSTM'} train is held at a signal: answer to proceed.`}>
      <line x1="0" x2="420" y1="74" y2="74" className="dla-ll-rail" />
      <rect x="22" y="40" width="120" height="30" rx="5" className="dla-ll-car" />
      <path d="M148 70 L148 46 L176 46 L176 38 L196 38 L196 70 Z" className="dla-ll-loco" />
      <line x1="300" x2="300" y1="74" y2="20" className="dla-ll-rule" />
      <rect x="290" y="6" width="20" height="40" rx="4" className="dla-ll-signal" />
      <circle cx="300" cy="18" r="5" className={`dla-ll-lamp${lamp === 'stop' || lamp === 'wait' ? ' dla-ll-lamp--stop' : ''}`} />
      <circle cx="300" cy="34" r="5" className={`dla-ll-lamp${lamp === 'go' ? ' dla-ll-lamp--go' : ''}`} />
      <text x="320" y="30" className="dla-t dla-t--xs">{SCENE.signal}</text>
    </svg>
  );
}

/* a lever (a gate): ≥ 44 px, aria-pressed, its key on the right */
export function Lever({ gate, on, onFlip, disabled }) {
  return (
    <button
      type="button"
      className={`dla-ll-lever${on ? ' dla-ll-lever--on' : ''}`}
      aria-pressed={on}
      onClick={onFlip}
      disabled={disabled}
      aria-label={`${gate.name} ${gate.sym}: ${on ? '1' : '0'}, ${on ? gate.on : gate.off}. Key ${gate.kbd}.`}
    >
      <svg className="dla-ll-lever__svg" viewBox="0 0 22 44" aria-hidden="true">
        <rect x="8" y="4" width="6" height="36" rx="3" className="dla-ll-lever__slot" />
        <circle cx="11" cy={on ? 11 : 33} r="7" className="dla-ll-lever__knob" />
      </svg>
      <span className="dla-ll-lever__body">
        <span className="dla-ll-lever__sym"><Why text={`$${gate.tex}$`} /> <b>{on ? '1' : '0'}</b></span>
        <span className="dla-ll-lever__word">{on ? gate.on : gate.off}</span>
      </span>
      <span className="dla-ll-lever__kbd" aria-hidden="true">{gate.kbd}</span>
    </button>
  );
}
