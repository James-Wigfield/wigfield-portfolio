import { useId, useRef, useState } from 'react';
import { svgPoint } from './hooks';
import { cellFill, weightFill } from './svgFill';

/* ============================================================================
   TRICKY TOPICS — SVG PARTS (the labs' shared vocabulary; see stage.css)
   ----------------------------------------------------------------------------
     Token     a label in an outlined box; `role` sets the outline; `onPick`
               makes it a keyboard-reachable button
     Grid      a matrix as a heatmap (role-colour ramp, negatives in the
               negative colour, −∞ hatched); row/column labels, a highlighted
               row, hover callback, an optional number in each cell
     Scrub     a horizontal scrubber (pointer + arrow keys) for n, k, s …
     Knob      a vertical drag handle for a value (pointer + arrow keys)
     Tip       a small dark label (the hovered cell's number)
     Arrow     a plain arrow
     Box3      a tensor as an outlined 3D box: front face w × h, depth d going
               up-right; each axis edge drawn and labelled in its axis colour
     Neuron    an outlined circle (a unit); `bias` adds the bias bead
     Bead      a bias: a small round bead in the bias shade
     Counter   a big tabular number that rolls to its new value
   ========================================================================== */

export function Token({ x, y, w = 74, h = 32, word, role = 'data', on = false, ghost = false, onPick, label, className = '' }) {
  const btn = typeof onPick === 'function';
  const onKey = (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(); }
  };
  return (
    <g
      className={`dltt-tok dltt-tok--${role}${on ? ' dltt-tok--on' : ''}${ghost ? ' dltt-tok--ghost' : ''}${btn ? ' dltt-tok--btn' : ''} ${className}`}
      transform={`translate(${x - w / 2} ${y - h / 2})`}
      {...(btn ? { role: 'button', tabIndex: 0, 'aria-pressed': on, 'aria-label': label ?? word, onClick: onPick, onKeyDown: onKey } : {})}
    >
      <rect width={w} height={h} rx={7} />
      <text x={w / 2} y={h / 2 + 5} textAnchor="middle">{word}</text>
    </g>
  );
}

// the hatch pattern for −∞ cells; render once per SVG and pass its id to Grid
export function HatchDef({ id }) {
  return (
    <defs>
      <pattern id={id} width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2="7" className="dltt-hatch-line" />
      </pattern>
    </defs>
  );
}

export function Grid({ x, y, M, c = 22, ch, role = 'w', weights = false, max = 1, rowLabels, colLabels, colLabelsTop = true, hlRow = null, hlCol = null, hlCell = null, onHover, frame = true, labelRole, dim = false, values, hatchId, className = '' }) {
  const rows = M.length;
  const cols = M[0]?.length ?? 0;
  const h = ch ?? c;
  const autoId = useId().replace(/:/g, '');
  const hid = hatchId ?? `dltt-hatch-${autoId}`;
  const anyInf = M.some((r) => r.some((v) => v === -Infinity));
  return (
    <g className={`dltt-grid ${dim ? 'dltt-dim' : ''} ${className}`} transform={`translate(${x} ${y})`}>
      {anyInf && !hatchId && <HatchDef id={hid} />}
      {hlRow !== null && hlRow >= 0 && <rect className="dltt-rowband" x={-4} y={hlRow * h - 2} width={cols * c + 8} height={h + 4} rx={4} />}
      {hlCol !== null && hlCol >= 0 && <rect className="dltt-rowband" x={hlCol * c - 2} y={-4} width={c + 4} height={rows * h + 8} rx={4} />}
      {M.map((r, i) =>
        r.map((v, j) => {
          const inf = v === -Infinity;
          return (
            <g key={`${i}-${j}`}>
              <rect
                className={`dltt-cell${hlCell && hlCell[0] === i && hlCell[1] === j ? ' dltt-cell--hit' : ''}`}
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
                <text x={j * c + c / 2} y={i * h + h / 2 + 4} textAnchor="middle" className={`dltt-cellnum${inf ? ' dltt-cellnum--inf' : ''}`}>
                  {values(v, i, j)}
                </text>
              )}
            </g>
          );
        }),
      )}
      {frame && <rect className={`dltt-grid-frame dltt-grid-frame--${role}`} x={-0.5} y={-0.5} width={cols * c + 1} height={rows * h + 1} rx={4} />}
      {rowLabels?.map((l, i) => (
        <text key={l + i} x={-8} y={i * h + h / 2 + 4} textAnchor="end" className={`dltt-t dltt-t--s${labelRole ? ` dltt-t--${labelRole}` : ''}`}>{l}</text>
      ))}
      {colLabels?.map((l, j) => (
        <text key={l + j} x={j * c + c / 2} y={colLabelsTop ? -8 : rows * h + 14} textAnchor="middle" className="dltt-t dltt-t--s">
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
      <line className={`dltt-wire${on ? ' dltt-wire--on' : ''}${role ? ` dltt-wire--${role}` : ''}`} x1={x1} y1={y1} x2={x2 - 1.5 * Math.cos(a)} y2={y2 - 1.5 * Math.sin(a)} />
      <polygon className="dltt-arrowhead" points={`${p(0.42)} ${x2},${y2} ${p(-0.42)}`} style={role ? { fill: `var(--dltt-${role})` } : on ? { fill: 'var(--ink)' } : undefined} />
    </g>
  );
}

export function Tip({ x, y, text }) {
  const w = Math.max(30, text.length * 6.9 + 12);
  return (
    <g className="dltt-tip" transform={`translate(${x - w / 2} ${y - 24})`}>
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
      className={`dltt-scrub${drag ? ' dltt-scrub--drag' : ''} ${className}`}
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
      <line x1={x0} y1={y} x2={x1} y2={y} className="dltt-scrub__track" />
      {ticks.map((v) => (
        <g key={`t${v}`}>
          <line x1={toX(v)} y1={y - 5} x2={toX(v)} y2={y + 5} stroke="var(--ink-3)" />
          <text x={toX(v)} y={y + 20} textAnchor="middle" className="dltt-t dltt-t--xs dltt-t--m">{tickLabel(v)}</text>
        </g>
      ))}
      {marks.map((m) => (
        <g key={`m${m.v}`}>
          <line x1={toX(m.v)} y1={y - 12} x2={toX(m.v)} y2={y - 4} stroke="var(--accent)" strokeWidth={2} />
          <text x={toX(m.v)} y={y + 33} textAnchor="middle" className="dltt-t dltt-t--xs dltt-slidemark">{m.label}</text>
        </g>
      ))}
      <g style={{ transform: `translateX(${toX(value)}px)` }} className="dltt-scrub__knob">
        <circle cx={0} cy={y} r={9} />
        {/* near the left end the value would sit on the slider's own label: move it beside the knob */}
        {toX(value) - x0 < 64
          ? <text x={14} y={y - 6} textAnchor="start" className="dltt-t dltt-t--b dltt-t--m">{show(value)}</text>
          : <text x={0} y={y - 15} textAnchor="middle" className="dltt-t dltt-t--b dltt-t--m">{show(value)}</text>}
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
      className={`dltt-knob${drag ? ' dltt-knob--drag' : ''} ${className}`}
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
      <line className="dltt-knob__track" x1={x} y1={yTop} x2={x} y2={yBot} />
      <line x1={x - 9} y1={zero} x2={x + 9} y2={zero} stroke="var(--ink-3)" strokeWidth={1.2} />
      <rect className="dltt-knob__bar" x={x - 3} y={zero} width={6} height={1} style={{ transformOrigin: `${x}px ${zero}px`, transform: `scaleY(${shown - zero || 0.001})` }} />
      <circle className="dltt-knob__dot" cx={x} cy={zero} r={7} style={{ transform: `translateY(${shown - zero}px)` }} />
    </g>
  );
}

/* A tensor as an outlined box. (x, y) = top-left of the front face; w, h =
   the front face (width, height); d = depth, drawn up and to the right.
   `axes` = { w: { role, label }, h: { role, label }, d: { role, label } }:
   each named axis gets its edge stroked in the role colour and its label
   written beside it (roles: batch, h, wd, c, t, f — stage.css). `lit` =
   the axis to emphasise (thicker edge, label bold). */
export function Box3({ x, y, w, h, d = 0, axes = {}, lit = null, ghost = false, className = '', children }) {
  const dx = d * 0.62;
  const dy = -d * 0.42;
  const edge = (k) => `dltt-box3__edge${axes[k]?.role ? ` dltt-ax--${axes[k].role}` : ''}${lit === k ? ' dltt-box3__edge--lit' : ''}`;
  const lab = (k) => `dltt-t dltt-t--b dltt-t--m dltt-halo${axes[k]?.role ? ` dltt-axt--${axes[k].role}` : ''}${lit === k ? ' dltt-box3__lab--lit' : ''}`;
  return (
    <g className={`dltt-box3${ghost ? ' dltt-box3--ghost' : ''} ${className}`}>
      {d > 0 && (
        <>
          <polygon className="dltt-box3__top" points={`${x},${y} ${x + dx},${y + dy} ${x + w + dx},${y + dy} ${x + w},${y}`} />
          <polygon className="dltt-box3__side" points={`${x + w},${y} ${x + w + dx},${y + dy} ${x + w + dx},${y + h + dy} ${x + w},${y + h}`} />
        </>
      )}
      <rect className="dltt-box3__front" x={x} y={y} width={w} height={h} />
      {children}
      {/* the three labelled axis edges: width along the bottom, height up the left, depth up-right */}
      {axes.w && <line className={edge('w')} x1={x} y1={y + h} x2={x + w} y2={y + h} />}
      {axes.h && <line className={edge('h')} x1={x} y1={y} x2={x} y2={y + h} />}
      {d > 0 && axes.d && <line className={edge('d')} x1={x + w} y1={y + h} x2={x + w + dx} y2={y + h + dy} />}
      {axes.w?.label != null && <text x={x + w / 2} y={y + h + 16} textAnchor="middle" className={lab('w')}>{axes.w.label}</text>}
      {axes.h?.label != null && <text x={x - 7} y={y + h / 2 + 4} textAnchor="end" className={lab('h')}>{axes.h.label}</text>}
      {d > 0 && axes.d?.label != null && <text x={x + w + dx / 2 + 7} y={y + h + dy / 2 + 12} className={lab('d')}>{axes.d.label}</text>}
    </g>
  );
}

export function Bead({ x, y, r = 5, on = true, className = '' }) {
  return <circle cx={x} cy={y} r={r} className={`dltt-bead${on ? '' : ' dltt-bead--off'} ${className}`} />;
}

export function Neuron({ x, y, r = 11, role = 'data', bias = false, on = true, label, className = '' }) {
  return (
    <g className={`dltt-neuron dltt-neuron--${role}${on ? '' : ' dltt-neuron--off'} ${className}`}>
      <circle cx={x} cy={y} r={r} />
      {label && <text x={x} y={y + 4} textAnchor="middle" className="dltt-t dltt-t--xs">{label}</text>}
      {bias && <Bead x={x + r * 0.78} y={y - r * 0.78} r={Math.max(3, r * 0.34)} />}
    </g>
  );
}

// A big number (tabular figures); `role` colours it. Changes are announced.
export function Counter({ x, y, value, role, size = 28, anchor = 'middle', label, className = '' }) {
  return (
    <text x={x} y={y} textAnchor={anchor} className={`dltt-counter${role ? ` dltt-t--${role}` : ''} ${className}`} style={{ fontSize: size }} aria-label={label}>
      {Number(value).toLocaleString('en-US')}
    </text>
  );
}
