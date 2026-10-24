import { useId, useRef, useState } from 'react';
import { svgPoint } from './hooks';
import { cellFill, weightFill } from './svgFill';
import { sub } from './rl';

/* ============================================================================
   LECTURE 9 STUDY — SVG PARTS (the labs' shared vocabulary; see stage.css)
   ----------------------------------------------------------------------------
     Token     a label in an outlined box; `role` sets the outline; `onPick`
               makes it a keyboard-reachable button
     State     an MDP state: an outlined circle (s0, s1 …); `onPick` = button
     ActNode   an MDP action: a small outlined diamond (a0, a1 …)
     Trans     a transition arrow from (x1, y1) to (x2, y2), optionally bowed
               (`bend`), its thickness = the probability, with the
               probability written beside it and an optional signed reward
     Grid      a matrix as a heatmap (value ramp, negative = the negative-
               reward colour, −∞ hatched); row/column labels, a highlighted
               row, hover callback, an optional number in each cell
     Scrub     a horizontal scrubber (pointer + arrow keys) for k, γ, ε, α …
     Knob      a vertical drag handle for a value (pointer + arrow keys)
     Tip       a small dark label (the hovered cell's number)
     Arrow     a plain arrow
   ========================================================================== */

export function Token({ x, y, w = 74, h = 32, word, role = 'agent', on = false, ghost = false, onPick, label, className = '' }) {
  const btn = typeof onPick === 'function';
  const onKey = (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(); }
  };
  return (
    <g
      className={`dl9s-tok dl9s-tok--${role}${on ? ' dl9s-tok--on' : ''}${ghost ? ' dl9s-tok--ghost' : ''}${btn ? ' dl9s-tok--btn' : ''} ${className}`}
      transform={`translate(${x - w / 2} ${y - h / 2})`}
      {...(btn ? { role: 'button', tabIndex: 0, 'aria-pressed': on, 'aria-label': label ?? word, onClick: onPick, onKeyDown: onKey } : {})}
    >
      <rect width={w} height={h} rx={7} />
      <text x={w / 2} y={h / 2 + 5} textAnchor="middle">{word}</text>
    </g>
  );
}

export function State({ x, y, r = 20, name, on = false, absorbing = false, onPick, label, className = '' }) {
  const btn = typeof onPick === 'function';
  const onKey = (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(); }
  };
  return (
    <g
      className={`dl9s-state${on ? ' dl9s-state--on' : ''}${absorbing ? ' dl9s-state--abs' : ''}${btn ? ' dl9s-state--btn' : ''} ${className}`}
      {...(btn ? { role: 'button', tabIndex: 0, 'aria-pressed': on, 'aria-label': label ?? name, onClick: onPick, onKeyDown: onKey } : {})}
    >
      <circle cx={x} cy={y} r={r} />
      <text x={x} y={y + 5} textAnchor="middle">{sub(name)}</text>
    </g>
  );
}

export function ActNode({ x, y, s = 15, name, best = false, dim = false, className = '' }) {
  return (
    <g className={`dl9s-act${best ? ' dl9s-act--best' : ''}${dim ? ' dl9s-act--dim' : ''} ${className}`}>
      <rect x={x - s} y={y - s} width={2 * s} height={2 * s} rx={3} transform={`rotate(45 ${x} ${y})`} />
      <text x={x} y={y + 4.5} textAnchor="middle">{sub(name)}</text>
    </g>
  );
}

/* A transition: a quadratic curve from (x1, y1) to (x2, y2), bowed sideways
   by `bend` px (0 = straight), stroke width from the probability p, an
   arrowhead at the end, and its p (and reward) written at the curve's middle
   (offset by `lab` = [dx, dy]). `state`: 'on' | 'best' | 'dim' | ''. */
export function Trans({ x1, y1, x2, y2, bend = 0, p = 1, reward, showP = true, state = '', lab = [0, -8], head = 7, className = '' }) {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const len = Math.hypot(x2 - x1, y2 - y1) || 1;
  const nx = -(y2 - y1) / len;
  const ny = (x2 - x1) / len;
  const cx = mx + nx * bend * 2;
  const cy = my + ny * bend * 2;
  // arrive direction = from the control point to the end
  const a = Math.atan2(y2 - cy, x2 - cx);
  const w = 1.1 + 3.4 * p;
  const tipBack = head * 0.9;
  const ex = x2 - tipBack * Math.cos(a);
  const ey = y2 - tipBack * Math.sin(a);
  const hp = (d) => `${x2 - head * Math.cos(a + d)},${y2 - head * Math.sin(a + d)}`;
  const midX = 0.25 * x1 + 0.5 * cx + 0.25 * x2;
  const midY = 0.25 * y1 + 0.5 * cy + 0.25 * y2;
  const st = state ? ` dl9s-tr--${state}` : '';
  const sh = state ? ` dl9s-trhead--${state}` : '';
  return (
    <g className={className}>
      <path className={`dl9s-tr${st}`} d={`M${x1} ${y1} Q${cx} ${cy} ${ex} ${ey}`} style={{ strokeWidth: w }} />
      <polygon className={`dl9s-trhead${sh}`} points={`${hp(0.42)} ${x2},${y2} ${hp(-0.42)}`} />
      {showP && (
        <text x={midX + lab[0]} y={midY + lab[1]} textAnchor="middle" className="dl9s-prob dl9s-halo">{p.toFixed(1)}</text>
      )}
      {reward !== undefined && reward !== 0 && (
        <text x={midX + lab[0]} y={midY + lab[1] - 14} textAnchor="middle" className={`dl9s-rew dl9s-halo ${reward > 0 ? 'dl9s-rew--pos' : 'dl9s-rew--neg'}`}>
          {reward > 0 ? `+${reward}` : `−${Math.abs(reward)}`}
        </text>
      )}
    </g>
  );
}

// the hatch pattern for −∞ cells; render once per SVG and pass its id to Grid
export function HatchDef({ id }) {
  return (
    <defs>
      <pattern id={id} width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2="7" className="dl9s-hatch-line" />
      </pattern>
    </defs>
  );
}

export function Grid({ x, y, M, c = 22, ch, role = 'val', weights = false, max = 1, rowLabels, colLabels, colLabelsTop = true, hlRow = null, hlCol = null, hlCell = null, onHover, frame = true, labelRole, dim = false, values, hatchId, className = '' }) {
  const rows = M.length;
  const cols = M[0]?.length ?? 0;
  const h = ch ?? c;
  const autoId = useId().replace(/:/g, '');
  const hid = hatchId ?? `dl9s-hatch-${autoId}`;
  const anyInf = M.some((r) => r.some((v) => v === -Infinity));
  return (
    <g className={`dl9s-grid ${dim ? 'dl9s-dim' : ''} ${className}`} transform={`translate(${x} ${y})`}>
      {anyInf && !hatchId && <HatchDef id={hid} />}
      {hlRow !== null && hlRow >= 0 && <rect className="dl9s-rowband" x={-4} y={hlRow * h - 2} width={cols * c + 8} height={h + 4} rx={4} />}
      {hlCol !== null && hlCol >= 0 && <rect className="dl9s-rowband" x={hlCol * c - 2} y={-4} width={c + 4} height={rows * h + 8} rx={4} />}
      {M.map((r, i) =>
        r.map((v, j) => {
          const inf = v === -Infinity;
          return (
            <g key={`${i}-${j}`}>
              <rect
                className={`dl9s-cell${hlCell && hlCell[0] === i && hlCell[1] === j ? ' dl9s-cell--hit' : ''}`}
                x={j * c + 1}
                y={i * h + 1}
                width={c - 2}
                height={h - 2}
                rx={3}
                style={{ fill: inf ? `url(#${hid})` : weights ? weightFill(role, v) : cellFill(role, v, max) }}
                onPointerEnter={onHover ? () => onHover({ i, j, v }) : undefined}
                onPointerLeave={onHover ? () => onHover(null) : undefined}
              />
              {values && (
                <text x={j * c + c / 2} y={i * h + h / 2 + 4} textAnchor="middle" className={`dl9s-cellnum${inf ? ' dl9s-cellnum--inf' : ''}`}>
                  {values(v, i, j)}
                </text>
              )}
            </g>
          );
        }),
      )}
      {frame && <rect className={`dl9s-grid-frame dl9s-grid-frame--${role}`} x={-0.5} y={-0.5} width={cols * c + 1} height={rows * h + 1} rx={4} />}
      {rowLabels?.map((l, i) => (
        <text key={l + i} x={-8} y={i * h + h / 2 + 4} textAnchor="end" className={`dl9s-t dl9s-t--s${labelRole ? ` dl9s-t--${labelRole}` : ''}`}>{l}</text>
      ))}
      {colLabels?.map((l, j) => (
        <text key={l + j} x={j * c + c / 2} y={colLabelsTop ? -8 : rows * h + 14} textAnchor="middle" className="dl9s-t dl9s-t--s">
          {l}
        </text>
      ))}
    </g>
  );
}

export function Arrow({ x1, y1, x2, y2, on = false, head = 6, role, className = '' }) {
  const a = Math.atan2(y2 - y1, x2 - x1);
  const p = (d) => `${x2 - head * Math.cos(a + d)},${y2 - head * Math.sin(a + d)}`;
  return (
    <g className={className}>
      <line className={`dl9s-wire${on ? ' dl9s-wire--on' : ''}${role ? ` dl9s-wire--${role}` : ''}`} x1={x1} y1={y1} x2={x2 - 1.5 * Math.cos(a)} y2={y2 - 1.5 * Math.sin(a)} />
      <polygon className="dl9s-arrowhead" points={`${p(0.42)} ${x2},${y2} ${p(-0.42)}`} style={role ? { fill: `var(--dl9s-${role})` } : on ? { fill: 'var(--ink)' } : undefined} />
    </g>
  );
}

export function Tip({ x, y, text }) {
  const w = Math.max(30, text.length * 6.9 + 12);
  return (
    <g className="dl9s-tip" transform={`translate(${x - w / 2} ${y - 24})`}>
      <rect width={w} height={19} rx={4} />
      <text x={w / 2} y={13.5} textAnchor="middle">{text}</text>
    </g>
  );
}

/* A horizontal scrubber on [min, max] drawn from x0 to x1 at height y.
   `ticks` = values to mark (with `tickLabel`), `marks` = [{ v, label }]
   drawn above the track (e.g. the slides' γ values). Arrow keys step by
   `step`, PageUp/PageDown by `big`, Home/End jump to the ends. */
export function Scrub({ x0, x1, y, value, min, max, step, big, onChange, label, valueText, ticks = [], tickLabel = (v) => String(v), marks = [], show = (v) => String(v), className = '' }) {
  const [drag, setDrag] = useState(false);
  const ref = useRef(null);
  const toX = (v) => x0 + ((v - min) / (max - min)) * (x1 - x0);
  const snap = (v) => {
    const k = Math.round((v - min) / step);
    return Math.max(min, Math.min(max, Number((min + k * step).toFixed(6))));
  };
  const fromEvent = (e) => {
    const pt = svgPoint(e, ref.current?.ownerSVGElement);
    if (!pt) return;
    onChange(snap(min + ((Math.max(x0, Math.min(x1, pt.x)) - x0) / (x1 - x0)) * (max - min)));
  };
  const onKey = (e) => {
    const d = { ArrowRight: step, ArrowUp: step, ArrowLeft: -step, ArrowDown: -step, PageUp: big ?? step * 10, PageDown: -(big ?? step * 10) }[e.key];
    if (d !== undefined) { e.preventDefault(); onChange(snap(value + d)); }
    else if (e.key === 'Home') { e.preventDefault(); onChange(min); }
    else if (e.key === 'End') { e.preventDefault(); onChange(max); }
  };
  return (
    <g
      ref={ref}
      className={`dl9s-scrub${drag ? ' dl9s-scrub--drag' : ''} ${className}`}
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={valueText ?? show(value)}
      onKeyDown={onKey}
      onPointerDown={(e) => { e.currentTarget.setPointerCapture?.(e.pointerId); setDrag(true); fromEvent(e); }}
      onPointerMove={(e) => { if (drag) fromEvent(e); }}
      onPointerUp={() => setDrag(false)}
      onPointerCancel={() => setDrag(false)}
    >
      <rect x={x0 - 12} y={y - 22} width={x1 - x0 + 24} height={44} fill="transparent" />
      <line x1={x0} y1={y} x2={x1} y2={y} className="dl9s-scrub__track" />
      {ticks.map((v) => (
        <g key={`t${v}`}>
          <line x1={toX(v)} y1={y - 5} x2={toX(v)} y2={y + 5} stroke="var(--ink-3)" />
          <text x={toX(v)} y={y + 20} textAnchor="middle" className="dl9s-t dl9s-t--xs dl9s-t--m">{tickLabel(v)}</text>
        </g>
      ))}
      {marks.map((m) => (
        <g key={`m${m.v}`}>
          <line x1={toX(m.v)} y1={y - 12} x2={toX(m.v)} y2={y - 4} stroke="var(--accent)" strokeWidth={2} />
          <text x={toX(m.v)} y={y + 33} textAnchor="middle" className="dl9s-t dl9s-t--xs dl9s-slidemark">{m.label}</text>
        </g>
      ))}
      <g style={{ transform: `translateX(${toX(value)}px)` }} className="dl9s-scrub__knob">
        <circle cx={0} cy={y} r={9} />
        <text x={0} y={y - 15} textAnchor="middle" className="dl9s-t dl9s-t--b dl9s-t--m">{show(value)}</text>
      </g>
    </g>
  );
}

/* A value handle: a vertical track from yTop to yBot for values min…max,
   a bar from the zero line to the value, and a draggable dot. Arrow keys
   step by `step`, PageUp/PageDown by 1. */
export function Knob({ x, yTop, yBot, value, min = -3, max = 3, step = 0.25, onChange, label, grow = 1, className = '' }) {
  const [drag, setDrag] = useState(false);
  const ref = useRef(null);
  const toY = (v) => yBot - ((v - min) / (max - min)) * (yBot - yTop);
  const zero = toY(Math.max(min, Math.min(max, 0)));
  const vy = toY(value);
  const shown = zero + (vy - zero) * grow;
  const clamp = (v) => Math.max(min, Math.min(max, Math.round(v / 0.05) * 0.05));
  const fromEvent = (e) => {
    const svg = ref.current?.ownerSVGElement;
    const pt = svgPoint(e, svg);
    if (!pt) return;
    onChange(clamp(min + ((yBot - pt.y) / (yBot - yTop)) * (max - min)));
  };
  const onKey = (e) => {
    const d = { ArrowUp: step, ArrowRight: step, ArrowDown: -step, ArrowLeft: -step, PageUp: 1, PageDown: -1 }[e.key];
    if (d !== undefined) { e.preventDefault(); onChange(clamp(value + d)); }
    else if (e.key === 'Home') { e.preventDefault(); onChange(min); }
    else if (e.key === 'End') { e.preventDefault(); onChange(max); }
  };
  return (
    <g
      ref={ref}
      className={`dl9s-knob${drag ? ' dl9s-knob--drag' : ''} ${className}`}
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={Number(value.toFixed(2))}
      aria-valuetext={value.toFixed(2)}
      onKeyDown={onKey}
      onPointerDown={(e) => { e.currentTarget.setPointerCapture?.(e.pointerId); setDrag(true); fromEvent(e); }}
      onPointerMove={(e) => { if (drag) fromEvent(e); }}
      onPointerUp={() => setDrag(false)}
      onPointerCancel={() => setDrag(false)}
    >
      <rect x={x - 14} y={yTop - 10} width={28} height={yBot - yTop + 20} fill="transparent" />
      <line className="dl9s-knob__track" x1={x} y1={yTop} x2={x} y2={yBot} />
      <line x1={x - 9} y1={zero} x2={x + 9} y2={zero} stroke="var(--ink-3)" strokeWidth={1.2} />
      <rect className="dl9s-knob__bar" x={x - 3} y={zero} width={6} height={1} style={{ transformOrigin: `${x}px ${zero}px`, transform: `scaleY(${shown - zero || 0.001})` }} />
      <circle className="dl9s-knob__dot" cx={x} cy={zero} r={7} style={{ transform: `translateY(${shown - zero}px)` }} />
    </g>
  );
}
