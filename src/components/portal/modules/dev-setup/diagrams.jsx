/* ============================================================================
   DEV SETUP — pictures. MonitorPair (both screens + zones), MouseArt (MX Master
   4 thumb side, controls clickable), TermPreview (a Claude pane in a scheme).
   ========================================================================== */

const S = 0.125; // 2560 px → 320 units
const SCR_W = 2560 * S;
const SCR_H = 1440 * S;
const WORK_H = 1392 * S;
const GAP = 18;
const PAD = 6;

function Zone({ z, ox, oy }) {
  const x = ox + z.x * S;
  const y = oy + z.y * S;
  const w = z.w * S;
  const h = z.h * S;
  if (z.role === 'under') {
    return (
      <g className="dws-zone" data-role="under">
        <rect x={x + 1.5} y={y + 1.5} width={w - 3} height={h - 3} rx="2" />
      </g>
    );
  }
  const big = w > 70 && h > 50;
  return (
    <g className="dws-zone" data-role={z.role}>
      <rect x={x + 1.5} y={y + 1.5} width={w - 3} height={h - 3} rx="2" />
      <text className="dws-zone__label" x={x + w / 2} y={y + h / 2 - (z.sub ? 3 : -4)} data-big={big}>
        {z.role === 'claude' ? `Claude ${z.label}` : z.label}
      </text>
      {z.sub && (
        <text className="dws-zone__sub" x={x + w / 2} y={y + h / 2 + 10}>
          {z.sub}
        </text>
      )}
    </g>
  );
}

function Screen({ ox, zones, title, sub }) {
  const oy = PAD;
  const under = zones.find((z) => z.role === 'under');
  return (
    <g>
      <path
        className="dws-mon__frame"
        d={`M${ox - 4},${oy - 2} Q${ox + SCR_W / 2},${oy - 9} ${ox + SCR_W + 4},${oy - 2}
            L${ox + SCR_W + 4},${oy + SCR_H + 3} Q${ox + SCR_W / 2},${oy + SCR_H - 4} ${ox - 4},${oy + SCR_H + 3} Z`}
      />
      <rect className="dws-mon__glass" x={ox} y={oy} width={SCR_W} height={SCR_H} />
      {zones.map((z, i) => (
        <Zone key={i} z={z} ox={ox} oy={oy} />
      ))}
      {under && (
        <text className="dws-zone__under" x={ox + 6} y={oy + WORK_H - 6}>
          {under.label}
        </text>
      )}
      <rect className="dws-mon__task" x={ox} y={oy + WORK_H} width={SCR_W} height={SCR_H - WORK_H} />
      <path className="dws-mon__stand" d={`M${ox + SCR_W / 2 - 16},${oy + SCR_H + 4} h32 l8,14 h-48 Z`} />
      <text className="dws-mon__title" x={ox + SCR_W / 2} y={oy + SCR_H + 34}>
        {title}
      </text>
      <text className="dws-mon__sub" x={ox + SCR_W / 2} y={oy + SCR_H + 47}>
        {sub}
      </text>
    </g>
  );
}

export function MonitorPair({ layout }) {
  const lx = 8;
  const rx = lx + SCR_W + GAP;
  const W = rx + SCR_W + 8;
  return (
    <svg className="dws-mon" viewBox={`0 0 ${W} ${PAD + SCR_H + 54}`} role="img" aria-label={`${layout.name}: both monitors with window zones`}>
      <Screen ox={lx} zones={layout.left} title="Side monitor" sub="DISPLAY2 · left in Windows" />
      <Screen ox={rx} zones={layout.right} title="Terminal monitor" sub="DISPLAY1 · primary · right" />
      <text className="dws-mon__seam" x={lx + SCR_W + GAP / 2} y={PAD + SCR_H / 2} transform={`rotate(-90 ${lx + SCR_W + GAP / 2} ${PAD + SCR_H / 2})`}>
        seam
      </text>
    </svg>
  );
}

/* ── mouse ───────────────────────────────────────────────────────────────── */
// Simplified thumb-side view of the MX Master 4: front is on the left.
const HOTSPOTS = [
  { id: 'top', n: 5, cx: 168, cy: 15, shape: <rect x="156" y="28" width="24" height="10" rx="5" /> },
  { id: 'thumbwheel', n: 3, cx: 116, cy: 76, shape: <rect x="96" y="88" width="40" height="15" rx="7.5" /> },
  { id: 'backfwd', n: 4, cx: 168, cy: 78, shape: (
    <>
      <rect x="146" y="91" width="20" height="13" rx="6" />
      <rect x="170" y="91" width="20" height="13" rx="6" />
    </>
  ) },
  { id: 'gesture', n: 1, cx: 240, cy: 111, shape: <rect x="204" y="107" width="20" height="9" rx="4.5" /> },
  { id: 'panel', n: 2, cx: 222, cy: 141, shape: <ellipse cx="222" cy="141" rx="44" ry="17" /> },
];

export function MouseArt({ active, onPick }) {
  return (
    <svg className="dws-mouse" viewBox="0 0 360 200" role="group" aria-label="MX Master 4, thumb side. Pick a control.">
      <ellipse className="dws-mouse__shadow" cx="190" cy="182" rx="150" ry="9" />
      <path
        className="dws-mouse__body"
        d="M36,150 C34,96 84,44 170,30 C252,20 318,56 332,108 C340,140 324,166 288,170 L72,174 C50,174 37,166 36,150 Z"
      />
      <path className="dws-mouse__line" d="M60,118 C120,82 210,74 300,94" />
      <ellipse className="dws-mouse__wheel" cx="120" cy="36" rx="22" ry="7" />
      <text className="dws-mouse__front" x="30" y="194">front</text>
      {HOTSPOTS.map((h) => (
        <g
          key={h.id}
          className="dws-hot"
          data-on={active === h.id}
          tabIndex={0}
          role="button"
          aria-pressed={active === h.id}
          aria-label={`Control ${h.n}`}
          onClick={() => onPick(h.id)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onPick(h.id);
            }
          }}
        >
          <g className="dws-hot__shape">{h.shape}</g>
          <circle className="dws-hot__pin" cx={h.cx} cy={h.cy} r="8" />
          <text className="dws-hot__n" x={h.cx} y={h.cy + 3.5}>
            {h.n}
          </text>
        </g>
      ))}
    </svg>
  );
}

/* ── terminal preview ────────────────────────────────────────────────────── */
function Pane({ look, focused, project, lines }) {
  const bg = focused || !look.unfocused ? look.bg : look.unfocused;
  return (
    <div className="dws-term__pane" style={{ background: look.glass ? 'transparent' : bg, color: look.fg }} data-focused={focused}>
      <div style={{ color: look.dim }}>{project}</div>
      {lines.map((l, i) => (
        <div key={i}>
          {l.map(([txt, tone], j) => (
            <span key={j} style={{ color: tone ? look[tone] : undefined }}>
              {txt}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

const LEFT = [
  [['> ', 'accent'], ['retry invite emails on 429']],
  [['● ', 'accent'], ['Read '], ['apps/core/src/invites.ts', 'link']],
  [['  ⎿ 212 lines', 'dim']],
  [['● ', 'accent'], ['Update '], ['invites.ts', 'link'], [' +14 −3', 'ok']],
  [['✓ typecheck passed', 'ok']],
  [['>', 'accent'], [' ▏']],
  [['  ⏵⏵ bypass permissions on', 'err']],
];
const RIGHT = [
  [['> ', 'accent'], ['tighten the hero copy']],
  [['● ', 'accent'], ['Update '], ['Hero.jsx', 'link']],
  [['  ⎿ waiting for you', 'warn']],
  [[' ']],
  [[' ']],
  [['>', 'accent']],
  [['  ⏵⏵ bypass permissions on', 'err']],
];

export function TermPreview({ look }) {
  return (
    <div className="dws-term" data-glass={look.glass}>
      <div className="dws-term__bar" style={{ background: look.glass ? 'rgba(20,20,20,.55)' : look.unfocused || look.bg }}>
        <span className="dws-term__tab" style={{ color: look.fg, background: look.glass ? 'rgba(255,255,255,.08)' : look.bg }}>
          ◐ portara-repo
        </span>
        <span className="dws-term__plus" style={{ color: look.dim }}>+</span>
      </div>
      <div className="dws-term__panes" style={{ background: look.glass ? 'rgba(30,30,30,.62)' : look.bg }}>
        <Pane look={look} focused project="portara-repo · focused" lines={LEFT} />
        <Pane look={look} focused={false} project="wigfield-portfolio · unfocused" lines={RIGHT} />
      </div>
    </div>
  );
}
