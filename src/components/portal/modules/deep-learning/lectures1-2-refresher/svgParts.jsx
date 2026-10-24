import { useRef, useState } from 'react';
import { svgPoint } from './hooks';
import { cellFill, weightFill } from './svgFill';

/* ============================================================================
   LECTURES 1–2 REFRESHER — SVG PARTS (the labs' shared vocabulary; see
   stage.css; copied from the Lecture 8 kit)
   ----------------------------------------------------------------------------
     Token    a label in an outlined box; `role` (c1 / c0 / fwd / bwd / w /
              off) sets the outline; `onPick` makes it a keyboard-reachable
              button
     Grid     a matrix as a heatmap of cells (role ramp; `weights` for 0…1),
              optional row/column labels, a highlighted row, hover callback
     Beam     a ribbon whose width and opacity follow a value
     Knob     a vertical drag handle for a value (pointer + arrow keys)
     Tip      a small dark label (the hovered cell's number)
     Arrow    a plain arrow
   ========================================================================== */

export function Token({ x, y, w = 74, h = 32, word, role = 'fwd', on = false, ghost = false, onPick, label, className = '' }) {
  const btn = typeof onPick === 'function';
  const onKey = (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(); }
  };
  return (
    <g
      className={`dl12r-tok dl12r-tok--${role}${on ? ' dl12r-tok--on' : ''}${ghost ? ' dl12r-tok--ghost' : ''}${btn ? ' dl12r-tok--btn' : ''} ${className}`}
      transform={`translate(${x - w / 2} ${y - h / 2})`}
      {...(btn ? { role: 'button', tabIndex: 0, 'aria-pressed': on, 'aria-label': label ?? word, onClick: onPick, onKeyDown: onKey } : {})}
    >
      <rect width={w} height={h} rx={7} />
      <text x={w / 2} y={h / 2 + 5} textAnchor="middle">{word}</text>
    </g>
  );
}

export function Grid({ x, y, M, c = 22, role = 'fwd', weights = false, max = 1, rowLabels, colLabels, colLabelsTop = true, hlRow = null, hlCol = null, onHover, frame = true, labelRole, dim = false, className = '' }) {
  const rows = M.length;
  const cols = M[0]?.length ?? 0;
  return (
    <g className={`dl12r-grid ${dim ? 'dl12r-dim' : ''} ${className}`} transform={`translate(${x} ${y})`}>
      {hlRow !== null && hlRow >= 0 && <rect className="dl12r-rowband" x={-4} y={hlRow * c - 2} width={cols * c + 8} height={c + 4} rx={4} />}
      {hlCol !== null && hlCol >= 0 && <rect className="dl12r-rowband" x={hlCol * c - 2} y={-4} width={c + 4} height={rows * c + 8} rx={4} />}
      {M.map((r, i) =>
        r.map((v, j) => (
          <rect
            key={`${i}-${j}`}
            className="dl12r-cell"
            x={j * c + 1}
            y={i * c + 1}
            width={c - 2}
            height={c - 2}
            rx={3}
            style={{ fill: weights ? weightFill(role, v) : cellFill(role, v, max) }}
            onPointerEnter={onHover ? () => onHover({ i, j, v }) : undefined}
            onPointerLeave={onHover ? () => onHover(null) : undefined}
          />
        )),
      )}
      {frame && <rect className={`dl12r-grid-frame dl12r-grid-frame--${role}`} x={-0.5} y={-0.5} width={cols * c + 1} height={rows * c + 1} rx={4} />}
      {rowLabels?.map((l, i) => (
        <text key={l + i} x={-8} y={i * c + c / 2 + 4} textAnchor="end" className={`dl12r-t dl12r-t--s${labelRole ? ` dl12r-t--${labelRole}` : ''}`}>{l}</text>
      ))}
      {colLabels?.map((l, j) => (
        <text
          key={l + j}
          x={j * c + c / 2}
          y={colLabelsTop ? -8 : rows * c + 14}
          textAnchor="middle"
          className="dl12r-t dl12r-t--s"
        >
          {l}
        </text>
      ))}
    </g>
  );
}

// A ribbon from (x1, y1) to (x2, y2), bowed into a gentle S.
export function Beam({ x1, y1, x2, y2, w, max = 22, min = 1.5, role, className = '' }) {
  const my = (y1 + y2) / 2;
  const d = `M${x1} ${y1} C${x1} ${my} ${x2} ${my} ${x2} ${y2}`;
  return (
    <path
      className={`dl12r-beam${role ? ` dl12r-beam--${role}` : ''} ${className}`}
      d={d}
      style={{ strokeWidth: min + (max - min) * w, opacity: 0.12 + 0.88 * w }}
    />
  );
}

export function Arrow({ x1, y1, x2, y2, on = false, head = 6, className = '' }) {
  const a = Math.atan2(y2 - y1, x2 - x1);
  const p = (d) => `${x2 - head * Math.cos(a + d)},${y2 - head * Math.sin(a + d)}`;
  return (
    <g className={className}>
      <line className={`dl12r-wire${on ? ' dl12r-wire--on' : ''}`} x1={x1} y1={y1} x2={x2 - 1.5 * Math.cos(a)} y2={y2 - 1.5 * Math.sin(a)} />
      <polygon className="dl12r-arrowhead" points={`${p(0.42)} ${x2},${y2} ${p(-0.42)}`} style={on ? { fill: 'var(--ink)' } : undefined} />
    </g>
  );
}

export function Tip({ x, y, text }) {
  const w = Math.max(30, text.length * 6.9 + 12);
  return (
    <g className="dl12r-tip" transform={`translate(${x - w / 2} ${y - 24})`}>
      <rect width={w} height={19} rx={4} />
      <text x={w / 2} y={13.5} textAnchor="middle">{text}</text>
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
  const zero = toY(0);
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
      className={`dl12r-knob${drag ? ' dl12r-knob--drag' : ''} ${className}`}
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
      <line className="dl12r-knob__track" x1={x} y1={yTop} x2={x} y2={yBot} />
      <line x1={x - 9} y1={zero} x2={x + 9} y2={zero} stroke="var(--ink-3)" strokeWidth={1.2} />
      {/* bar and dot move by CSS transform, so a story beat can animate them */}
      <rect className="dl12r-knob__bar" x={x - 3} y={zero} width={6} height={1} style={{ transformOrigin: `${x}px ${zero}px`, transform: `scaleY(${shown - zero || 0.001})` }} />
      <circle className="dl12r-knob__dot" cx={x} cy={zero} r={7} style={{ transform: `translateY(${shown - zero}px)` }} />
    </g>
  );
}
