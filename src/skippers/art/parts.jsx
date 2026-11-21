import { useId } from 'react';
import { HULL, LIGHT_COLOR, MARKS, ARC, wedge, visibleLights, litSpans, periodOf, isOn, VESSELS, dir, hullPath } from './geometry';
import { useClock } from '../kit/hooks';

/* ============================================================================
   SKIPPERS — SVG PARTS: one visual vocabulary for labs, cards and questions
   ----------------------------------------------------------------------------
     TopBoat     a vessel from above (power or sail), optional light sectors
                 (masthead 225°, sidelights 112.5°, stern 135°) as cones
     NightView   a vessel's lights as seen from one bearing on a dark sea —
                 computed from the real arcs, never hand-placed
     Mark        an IALA pillar buoy: colours, topmark, optional live light
     Rhythm      a mark's light: a blinking lamp + a one-period strip
     FlagA       International Code Flag "A" (diver below)
     Horn        horn blasts as bars (short / long)
   All parts draw in their own local units; callers translate / scale.
   ========================================================================== */

const { L, B } = HULL;


export function TopBoat({ x = 0, y = 0, heading = 0, type = 'power', scale = 1, sectors = false, sectorR = 70, label, tone = 'ink', dim = false, wake = false }) {
  const stroke = tone === 'you' ? 'var(--chart)' : 'var(--hull-line)';
  return (
    <g transform={`translate(${x} ${y}) rotate(${heading}) scale(${scale})`} opacity={dim ? 0.45 : 1}>
      {sectors && (
        <g opacity="0.85">
          <path d={wedge(sectorR * 1.08, -ARC.mast / 2, ARC.mast / 2)} fill="#fff6d6" fillOpacity="0.16" stroke="#fff6d6" strokeOpacity="0.5" strokeWidth={0.8 / scale} />
          <path d={wedge(sectorR, 0, ARC.side)} fill={LIGHT_COLOR.green} fillOpacity="0.26" stroke={LIGHT_COLOR.green} strokeWidth={1 / scale} />
          <path d={wedge(sectorR, -ARC.side, 0)} fill={LIGHT_COLOR.red} fillOpacity="0.26" stroke={LIGHT_COLOR.red} strokeWidth={1 / scale} />
          <path d={wedge(sectorR * 0.92, ARC.side, 360 - ARC.side)} fill="#fff6d6" fillOpacity="0.2" stroke="#fff6d6" strokeOpacity="0.6" strokeWidth={0.8 / scale} />
        </g>
      )}
      {wake && <path d={`M${-B * 0.35} ${L / 2 + 2} L${-B * 0.9} ${L * 1.4} M${B * 0.35} ${L / 2 + 2} L${B * 0.9} ${L * 1.4}`} stroke={stroke} strokeOpacity="0.35" strokeWidth={1.2 / scale} fill="none" strokeDasharray={`${3 / scale} ${3 / scale}`} />}
      <path d={hullPath()} fill="var(--hull)" stroke={stroke} strokeWidth={(tone === 'you' ? 2.2 : 1.5) / scale} />
      {type === 'sail' ? (
        <>
          <circle cx="0" cy={-L * 0.08} r={2.4} fill={stroke} />
          <path d={`M0 ${-L * 0.08} Q${B * 0.75} ${L * 0.12} ${B * 0.15} ${L * 0.36}`} fill="none" stroke={stroke} strokeWidth={1.6 / scale} />
        </>
      ) : (
        <rect x={-B * 0.3} y={-L * 0.05} width={B * 0.6} height={L * 0.22} rx={2} fill="none" stroke={stroke} strokeWidth={1.2 / scale} />
      )}
      {label && (
        <g transform={`rotate(${-heading})`}>
          <text x={0} y={4} textAnchor="middle" className="sk-t sk-t--b" style={{ fontSize: 13 / scale }}>{label}</text>
        </g>
      )}
    </g>
  );
}

// A heading arrow ahead of a boat (for encounters)
export function HeadingArrow({ x, y, heading, len = 46, color = 'var(--ink-3)' }) {
  const [dx, dy] = dir(heading);
  const x1 = x + dx * (L / 2 + 6);
  const y1 = y + dy * (L / 2 + 6);
  const x2 = x1 + dx * len;
  const y2 = y1 + dy * len;
  const id = useId().replace(/:/g, '');
  return (
    <g>
      <defs>
        <marker id={`ah${id}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" fill={color} />
        </marker>
      </defs>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth="1.6" strokeDasharray="4 4" markerEnd={`url(#ah${id})`} />
    </g>
  );
}

/* NightView: the lights of `vessel` as seen from bearing `theta` off its bow.
   Draws into a box of width w, height h; `hull` shows a faint silhouette. */
export function NightView({ vessel = 'power-lt12', theta = 0, w = 320, h = 180, hull = true, scale }) {
  const s = scale ?? Math.min(w / 120, h / 90);
  const cx = w / 2;
  const sea = h * 0.7;
  const lights = visibleLights(vessel, theta);
  const v = VESSELS[vessel];
  const len = v.big ? L * 1.6 : L;
  const extent = Math.abs(Math.sin((theta * Math.PI) / 180)) * len + Math.abs(Math.cos((theta * Math.PI) / 180)) * B;
  const scaleL = v.big ? 1.6 : 1;
  return (
    <g>
      <line x1={0} y1={sea} x2={w} y2={sea} stroke="#9fb8cf" strokeOpacity="0.18" />
      {hull && (
        <g opacity="0.55">
          <path d={`M${cx - (extent / 2) * s} ${sea - 4 * s} L${cx + (extent / 2) * s} ${sea - 4 * s} L${cx + (extent / 2 - 3) * s} ${sea + 2 * s} L${cx - (extent / 2 - 3) * s} ${sea + 2 * s} Z`} fill="#1c3047" stroke="#2f4a66" strokeWidth="1" />
          {v.sail && <line x1={cx} y1={sea - 4 * s} x2={cx} y2={sea - 50 * s} stroke="#2f4a66" strokeWidth="1.5" />}
          {!v.sail && <rect x={cx - 5 * s} y={sea - 10 * s} width={10 * s} height={6 * s} fill="#1c3047" stroke="#2f4a66" />}
        </g>
      )}
      {lights.map((l) => {
        const col = LIGHT_COLOR[l.color];
        const lx = cx + l.sx * s * scaleL;
        const ly = sea - l.h * s;
        return (
          <g key={l.id} style={{ color: col }}>
            <circle cx={lx} cy={ly} r={9 * s * 0.5} fill={col} opacity="0.16" />
            <circle cx={lx} cy={ly} r={3.6 * Math.max(0.8, s * 0.6)} fill={col} className="sk-glow" />
            <line x1={lx} y1={sea + 3} x2={lx} y2={sea + 3 + 14 * s} stroke={col} strokeOpacity="0.28" strokeWidth={2} strokeDasharray="2 3" />
          </g>
        );
      })}
    </g>
  );
}

/* Mark: an IALA pillar buoy. Local origin = the waterline centre; the mark
   is ~100 units tall. */
const BAND = { red: '#c8302c', green: '#1d8a4e', black: '#1b1b1b', yellow: '#f0c000', white: '#f4f1e8' };
function bandsFor(type) {
  switch (type) {
    case 'port': return ['red'];
    case 'starboard': return ['green'];
    case 'north': return ['black', 'yellow'];
    case 'south': return ['yellow', 'black'];
    case 'east': return ['black', 'yellow', 'black'];
    case 'west': return ['yellow', 'black', 'yellow'];
    case 'isolated': return ['black', 'red', 'black'];
    case 'special': return ['yellow'];
    default: return ['red'];
  }
}

function Cone({ y, up, fill }) {
  return up ? <path d={`M-9 ${y + 9} L9 ${y + 9} L0 ${y - 4} Z`} fill={fill} /> : <path d={`M-9 ${y - 4} L9 ${y - 4} L0 ${y + 9} Z`} fill={fill} />;
}

function Topmark({ type }) {
  const k = BAND.black;
  switch (type) {
    case 'port': return <rect x={-8} y={-102} width={16} height={15} fill={BAND.red} stroke="#7a1d1a" strokeWidth="0.8" />;
    case 'starboard': return <path d="M-9 -87 L9 -87 L0 -104 Z" fill={BAND.green} stroke="#0f5a31" strokeWidth="0.8" />;
    case 'north': return <g><Cone y={-112} up fill={k} /><Cone y={-97} up fill={k} /></g>;
    case 'south': return <g><Cone y={-112} up={false} fill={k} /><Cone y={-97} up={false} fill={k} /></g>;
    case 'east': return <g><Cone y={-112} up fill={k} /><Cone y={-97} up={false} fill={k} /></g>;
    case 'west': return <g><Cone y={-112} up={false} fill={k} /><Cone y={-97} up fill={k} /></g>;
    case 'isolated': return <g><circle cx="0" cy="-110" r="6.5" fill={k} /><circle cx="0" cy="-95" r="6.5" fill={k} /></g>;
    case 'safe': return <circle cx="0" cy="-96" r="8" fill={BAND.red} />;
    case 'special': return <g stroke={BAND.yellow} strokeWidth="4" strokeLinecap="round"><path d="M-8 -106 L8 -90 M8 -106 L-8 -90" /></g>;
    default: return null;
  }
}

export function Mark({ type, x = 0, y = 0, scale = 1, topmark = true, lit = false, light = false, label }) {
  const bands = bandsFor(type);
  const pillarTop = -82;
  const pillarH = 82 - 8;
  const id = useId().replace(/:/g, '');
  const lightCol = LIGHT_COLOR[MARKS[type]?.light ?? 'white'];
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <defs>
        <clipPath id={`pl${id}`}><path d={`M-11 -8 L-7 ${pillarTop} L7 ${pillarTop} L11 -8 Z`} /></clipPath>
      </defs>
      {/* float */}
      <ellipse cx="0" cy="-4" rx="26" ry="8" fill={type === 'safe' ? BAND.red : BAND[bands[bands.length - 1]]} stroke="rgba(0,0,0,.35)" strokeWidth="0.8" />
      {/* pillar */}
      <g clipPath={`url(#pl${id})`}>
        {type === 'safe'
          ? [0, 1, 2, 3, 4, 5].map((i) => <rect key={i} x={-12 + i * 4} y={pillarTop} width={4} height={pillarH} fill={i % 2 ? BAND.white : BAND.red} />)
          : bands.map((b, i) => <rect key={i} x={-12} y={pillarTop + (pillarH / bands.length) * i} width={24} height={pillarH / bands.length + 0.5} fill={BAND[b]} />)}
      </g>
      <path d={`M-11 -8 L-7 ${pillarTop} L7 ${pillarTop} L11 -8 Z`} fill="none" stroke="rgba(0,0,0,.4)" strokeWidth="0.8" />
      <line x1="0" y1={pillarTop} x2="0" y2={pillarTop - 5} stroke="#555" strokeWidth="2" />
      {topmark && <Topmark type={type} />}
      {light && (
        <g style={{ color: lightCol }} opacity={lit ? 1 : 0.18}>
          <circle cx="0" cy={pillarTop + 9} r="4" fill={lightCol} className={lit ? 'sk-glow' : ''} />
        </g>
      )}
      {label && <text x="0" y="18" textAnchor="middle" className="sk-t sk-t--s">{label}</text>}
    </g>
  );
}

// a mark with a live light (uses the clock)
export function LiveMark({ type, running = true, ...rest }) {
  const t = useClock(running, 0);
  const r = MARKS[type].rhythm;
  return <Mark type={type} light lit={isOn(r, t)} {...rest} />;
}

/* Rhythm: a lamp that blinks the real pattern + a strip of one period.
   Reduced motion shows the strip only (the lamp stays lit). */
export function Rhythm({ rhythm, color = 'white', w = 300, running = true, showLabel = true }) {
  const t = useClock(running, 0);
  const P = periodOf(rhythm);
  const spans = litSpans(rhythm);
  const lit = isOn(rhythm, t);
  const col = LIGHT_COLOR[color] ?? LIGHT_COLOR.white;
  const stripX = 56;
  const stripW = w - stripX - 6;
  const playhead = ((t % P) / P) * stripW;
  return (
    <svg viewBox={`0 0 ${w} 56`} className="sk-svg" role="img" aria-label={`Light rhythm ${rhythm}`}>
      <rect x="0" y="0" width={w} height="56" rx="8" fill="#08131e" />
      <g style={{ color: col }}>
        <circle cx="26" cy="28" r="14" fill={col} opacity={lit ? 0.18 : 0.04} />
        <circle cx="26" cy="28" r="6.5" fill={col} opacity={lit ? 1 : 0.12} className={lit ? 'sk-glow' : ''} />
      </g>
      <rect x={stripX} y="22" width={stripW} height="12" fill="#13263a" rx="2" />
      {spans.map(([a, b]) => (
        <rect key={a} x={stripX + (a / P) * stripW} y="22" width={Math.max(1.5, ((b - a) / P) * stripW)} height="12" fill={col} />
      ))}
      <line x1={stripX + playhead} y1="17" x2={stripX + playhead} y2="39" stroke="#9fb8cf" strokeWidth="1" opacity="0.7" />
      {showLabel && <text x={stripX} y="13" className="sk-t sk-t--sea" style={{ fontSize: 10 }}>{rhythm}</text>}
      <text x={stripX + stripW} y="50" textAnchor="end" className="sk-t sk-t--sea" style={{ fontSize: 9 }}>{`one period = ${P / 1000} s`}</text>
    </svg>
  );
}

export function FlagA({ x = 0, y = 0, scale = 1 }) {
  // Code flag "A": white hoist, blue swallow-tailed fly (Workbook p.17)
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <line x1="0" y1="-4" x2="0" y2="74" stroke="var(--ink-2)" strokeWidth="2.4" />
      <path d="M0 0 H34 V48 H0 Z" fill="#f7f6f1" stroke="#1e2d3d" strokeWidth="1" />
      <path d="M34 0 H70 L54 24 L70 48 H34 Z" fill="#1f4fa0" stroke="#1e2d3d" strokeWidth="1" />
    </g>
  );
}

/* Horn blasts: s = short (about 1 s), l = prolonged (4–6 s). */
export function Horn({ blasts = 's', w = 260, active = -1 }) {
  const unit = 16;
  const bars = blasts.split('').reduce((acc, b, i) => {
    const len = b === 'l' ? unit * 4 : unit;
    const x = acc.length ? acc[acc.length - 1].x + acc[acc.length - 1].w + 10 : 12;
    return [...acc, { x, w: len, i }];
  }, []);
  const end = bars.length ? bars[bars.length - 1].x + bars[bars.length - 1].w : 12;
  const vbw = Math.max(w, end + 18);
  return (
    <svg viewBox={`0 0 ${vbw} 40`} className="sk-svg" role="img" aria-label={`${blasts.length} horn blasts: ${blasts.split('').map((b) => (b === 'l' ? 'long' : 'short')).join(', ')}`}>
      {bars.map((b) => (
        <rect key={b.i} x={b.x} y={12} width={b.w} height={16} rx={8} fill={b.i === active ? 'var(--chart)' : 'var(--ink)'} opacity={active >= 0 && b.i !== active ? 0.3 : 1} />
      ))}
    </svg>
  );
}
