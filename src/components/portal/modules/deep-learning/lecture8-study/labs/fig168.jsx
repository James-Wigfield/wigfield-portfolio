import './labsTransformer.css';

/* ============================================================================
   Drawing parts for Figure 16-8 (the §9 map and §14's one encoder layer)
     Wire      a wire: a dim base, a lit "flow" that draws itself along the
               path when its beat comes (stroke-dashoffset), an optional
               role overlay (kv = keys/values two-tone, q = queries) and
               an arrowhead
     FigBlock  an outlined block (outline = side), optionally a button:
               click / Enter / Space / focus picks it, hover previews it
     PEGlyph   the positional-encoding circle with its sine wave
   ========================================================================== */

export function Wire({ w, on, role, dash = false }) {
  return (
    <g className={`dl8s-tmap-w${on ? ' dl8s-tmap-w--on' : ''}${dash ? ' dl8s-tmap-w--dash' : ''}`}>
      <path className="dl8s-tmap-w__base" d={w.d} />
      <path className="dl8s-tmap-w__flow" d={w.d} pathLength={1} />
      {on && role === 'kv' && (
        <>
          <path className="dl8s-tmap-w__v" d={w.d} />
          <path className="dl8s-tmap-w__k" d={w.d} />
        </>
      )}
      {on && role === 'q' && <path className="dl8s-tmap-w__q" d={w.d} />}
      {w.head && <polygon className={`dl8s-tmap-w__head${role ? ` dl8s-tmap-w__head--${role}` : ''}`} points={w.head} />}
    </g>
  );
}

function pickProps(onPick, onHover, id, sel, label) {
  if (!onPick) return {};
  return {
    role: 'button',
    tabIndex: 0,
    'aria-pressed': sel,
    'aria-label': label,
    onClick: () => onPick(id),
    onFocus: () => onPick(id),
    onKeyDown: (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(id); }
    },
    onPointerEnter: onHover ? () => onHover(id) : undefined,
    onPointerLeave: onHover ? () => onHover(null) : undefined,
  };
}

export function FigBlock({ b, fs = 12, lit = true, sel = false, dash = false, sub, onPick, onHover, label, className = '' }) {
  const lh = fs + 1.6;
  const lines = b.lines.length + (sub ? 1 : 0);
  const y0 = b.y + b.h / 2 - ((lines - 1) * lh) / 2 + fs * 0.36;
  return (
    <g
      className={`dl8s-tmap-b dl8s-tmap-b--${b.side}${lit ? '' : ' dl8s-tmap-b--off'}${sel ? ' dl8s-tmap-b--sel' : ''}${dash ? ' dl8s-tmap-b--dash' : ''}${onPick ? ' dl8s-tmap-b--btn' : ''} ${className}`}
      {...pickProps(onPick, onHover, b.id, sel, label)}
    >
      {onPick && <rect className="dl8s-tmap-b__ring" x={b.x - 3.5} y={b.y - 3.5} width={b.w + 7} height={b.h + 7} rx={8} />}
      <rect className="dl8s-tmap-b__box" x={b.x} y={b.y} width={b.w} height={b.h} rx={6} />
      {b.lines.map((t, i) => (
        <text key={t} x={b.x + b.w / 2} y={y0 + i * lh} textAnchor="middle" style={{ fontSize: fs }}>{t}</text>
      ))}
      {sub && (
        <text className="dl8s-tmap-b__sub" x={b.x + b.w / 2} y={y0 + b.lines.length * lh} textAnchor="middle" style={{ fontSize: fs - 2 }}>{sub}</text>
      )}
    </g>
  );
}

export function PEGlyph({ id, x, y, r, lit = true, sel = false, onPick, onHover, label }) {
  const a = r * 0.62;
  const d = `M${x - a} ${y} C${x - a / 2} ${y - a * 1.1} ${x - a / 4} ${y - a * 1.1} ${x} ${y} S${x + a / 2} ${y + a * 1.1} ${x + a} ${y}`;
  return (
    <g
      className={`dl8s-tmap-b dl8s-tmap-b--pos${lit ? '' : ' dl8s-tmap-b--off'}${sel ? ' dl8s-tmap-b--sel' : ''}${onPick ? ' dl8s-tmap-b--btn' : ''}`}
      {...pickProps(onPick, onHover, id, sel, label)}
    >
      {onPick && <circle className="dl8s-tmap-b__ring" cx={x} cy={y} r={r + 4} />}
      <circle className="dl8s-tmap-b__box" cx={x} cy={y} r={r} />
      <path className="dl8s-tmap-sine" d={d} />
    </g>
  );
}
