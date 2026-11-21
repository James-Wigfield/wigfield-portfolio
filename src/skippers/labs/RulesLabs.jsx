import { useState } from 'react';
import { Stage, Seg, Rich } from '../kit/kit';

/* LABS for level 01 (Workbook ch.1–2).
   AgeLab    slide an age; what that person may do lights up (table p.5,
             ski crew p.20)
   SpeedLab  a harbour map at 1 px = 1 m: tap anywhere to see whether the
             general 8-knot limit applies there and why (p.12, 17) */

const AGE_ROWS = [
  { min: 10, t: 'Skipper a boat with a motor of **6 hp or less**', p: 5 },
  { min: 10, t: 'Drive a boat over 6 hp **without an RST**, with an RST holder on board supervising', p: 5 },
  { min: 14, t: '**Hold an RST** and skipper a boat over 6 hp', p: 5 },
  { min: 14, t: 'Be the **observer** for a water skier', p: 20 },
  { min: 16, t: 'Go **faster than 8 knots**', p: 5 },
  { min: 16, t: 'Skipper **between sunset and sunrise**', p: 5 },
  { min: 17, t: '**Drive a boat towing a water skier** (any motor size)', p: 5 },
  { min: 17, t: 'Skipper a boat doing **towing operations**', p: 5 },
  { min: 18, t: '**Supervise** someone driving who doesn’t hold an RST (you need an RST)', p: 5 },
];

export function AgeLab() {
  const [age, setAge] = useState(15);
  const ok = AGE_ROWS.filter((r) => age >= r.min).length;
  return (
    <Stage
      title="Who can drive what"
      receipt="Workbook p.5, 20"
      tryThis="Slide the age. Watch the jumps at **14, 16, 17 and 18** — they’re exam favourites."
      caption={age < 16 && age >= 14 ? 'Aged 14–15 with an RST: **daylight only** and **8 knots max**.' : age < 14 ? 'Under 14 nobody holds an RST — but from 10 you can drive under supervision.' : null}
      challenge={{ text: 'Find the youngest age that can tow a skier.', done: age === 17 }}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(90px, 140px) 1fr', gap: '0.5rem 1.4rem', alignItems: 'start' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="sk-mono" style={{ fontSize: 'clamp(3.2rem, 12vw, 5rem)', lineHeight: 1, letterSpacing: '-0.05em' }}>{age}</div>
          <div className="sk-micro">years old</div>
          <div className="sk-micro" style={{ marginTop: '0.5rem' }}>{ok}/{AGE_ROWS.length} allowed</div>
        </div>
        <div className="sk-list">
          {AGE_ROWS.map((r) => {
            const yes = age >= r.min;
            return (
              <div key={r.t} className="sk-list__row" style={{ gridTemplateColumns: '2.4rem 1fr', opacity: yes ? 1 : 0.5, transition: 'opacity .25s' }}>
                <span className="sk-mono" style={{ fontSize: '0.75rem', color: yes ? 'var(--ok)' : 'var(--ink-3)' }}>{r.min}+</span>
                <span className={`sk-dot ${yes ? 'sk-dot--ok' : 'sk-dot--bad'}`} style={{ fontFamily: 'var(--f-body)', fontSize: '0.9rem' }}>
                  <span><Rich text={r.t} /></span>
                </span>
              </div>
            );
          })}
        </div>
      </div>
      <label style={{ display: 'grid', gap: '0.2rem', marginTop: '1rem' }}>
        <span className="sk-micro">Age · {age}</span>
        <input type="range" min={9} max={18} value={age} onChange={(e) => setAge(Number(e.target.value))} style={{ width: '100%', accentColor: 'var(--chart)' }} />
      </label>
    </Stage>
  );
}

/* ── the 8-knot map ─────────────────────────────────────────────────────
   viewBox 0 0 400 300, 1 unit = 1 metre. Shore on the left (x < 40). */
const JETTY = { x: 40, y: 130, w: 70, h: 10 };
const MOORED = [{ x: 280, y: 60 }, { x: 320, y: 90 }, { x: 290, y: 105 }];
const MOORING_AREA = { x: 250, y: 30, w: 110, h: 100 };
const SWIMMER = { x: 95, y: 235 };
const UNDERWAY = { x: 220, y: 200 };
const SHALLOW = { x: 300, y: 215, w: 90, h: 70 }; // < 3 m
const BRIDGE = { x: 150, y: 0, w: 60, h: 18 };

function distToRect(px, py, r) {
  const dx = Math.max(r.x - px, 0, px - (r.x + r.w));
  const dy = Math.max(r.y - py, 0, py - (r.y + r.h));
  return Math.hypot(dx, dy);
}
function zonesAt(x, y) {
  const z = [];
  if (x <= 40 + 50) z.push('within **50 m of the bank / low-water mark**');
  if (distToRect(x, y, JETTY) <= 50) z.push('within **50 m of a jetty**');
  if (MOORED.some((m) => Math.hypot(x - m.x, y - m.y) <= 50)) z.push('within **50 m of a moored vessel**');
  if (x >= MOORING_AREA.x && x <= MOORING_AREA.x + MOORING_AREA.w && y >= MOORING_AREA.y && y <= MOORING_AREA.y + MOORING_AREA.h) z.push('**in a mooring area**');
  if (Math.hypot(x - SWIMMER.x, y - SWIMMER.y) <= 50) z.push('within **50 m of a person in the water**');
  if (Math.hypot(x - UNDERWAY.x, y - UNDERWAY.y) <= 15) z.push('within **15 m of a vessel underway**');
  if (x >= SHALLOW.x && x <= SHALLOW.x + SHALLOW.w && y >= SHALLOW.y && y <= SHALLOW.y + SHALLOW.h) z.push('in water **under 3 m deep**');
  if (x >= BRIDGE.x && x <= BRIDGE.x + BRIDGE.w && y <= BRIDGE.y + 12) z.push('**through a bridge arch**');
  return z;
}

export function SpeedLab() {
  const [pt, setPt] = useState({ x: 175, y: 150 });
  const [show, setShow] = useState('on');
  const [foundOpen, setFoundOpen] = useState(false);
  const zones = zonesAt(pt.x, pt.y);
  const tap = (e) => {
    const svg = e.currentTarget;
    const p = svg.createSVGPoint();
    p.x = e.clientX;
    p.y = e.clientY;
    const q = p.matrixTransform(svg.getScreenCTM().inverse());
    const np = { x: Math.round(Math.max(0, Math.min(400, q.x))), y: Math.round(Math.max(0, Math.min(300, q.y))) };
    setPt(np);
    if (zonesAt(np.x, np.y).length === 0 && np.x > 40) setFoundOpen(true);
  };
  const zoneStyle = { fill: 'var(--port)', fillOpacity: 0.07, stroke: 'var(--port)', strokeOpacity: 0.45, strokeDasharray: '4 3' };
  const z = show === 'on';
  return (
    <Stage
      title="The 8-knot map"
      receipt="Workbook p.12, 17"
      tryThis="Tap anywhere on the water. Is the general **8-knot limit** on there — and why?"
      challenge={{ text: 'Find a spot where no 8-knot rule applies.', done: foundOpen }}
      foot={<span className="sk-dot sk-dot--chart">drawn to scale: 1 square = 20 m</span>}
    >
      <div className="sk-ctrls" style={{ marginBottom: '0.6rem' }}>
        <Seg value={show} onChange={setShow} options={[{ value: 'on', label: 'Show zones' }, { value: 'off', label: 'Hide zones' }]} label="Zones" />
      </div>
      <svg viewBox="0 0 400 300" className="sk-svg" onClick={tap} role="img" aria-label="Harbour map: tap to test a spot" style={{ maxWidth: 700, margin: '0 auto', cursor: 'crosshair', borderRadius: 10 }}>
        <defs>
          <pattern id="sk-sp-grid" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0 H0 V20" fill="none" stroke="var(--contour)" /></pattern>
          <pattern id="sk-sp-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke="var(--chart)" strokeOpacity="0.35" strokeWidth="2" /></pattern>
        </defs>
        <rect width="400" height="300" fill="color-mix(in srgb, var(--chart) 9%, var(--floor))" />
        <rect width="400" height="300" fill="url(#sk-sp-grid)" />
        {z && (
          <g>
            <rect x="0" y="0" width="90" height="300" {...zoneStyle} />
            <rect x={JETTY.x - 50} y={JETTY.y - 50} width={JETTY.w + 100} height={JETTY.h + 100} rx="50" {...zoneStyle} />
            {MOORED.map((m) => <circle key={m.x} cx={m.x} cy={m.y} r="50" {...zoneStyle} />)}
            <circle cx={SWIMMER.x} cy={SWIMMER.y} r="50" {...zoneStyle} />
            <circle cx={UNDERWAY.x} cy={UNDERWAY.y} r="15" {...zoneStyle} />
          </g>
        )}
        <rect x={SHALLOW.x} y={SHALLOW.y} width={SHALLOW.w} height={SHALLOW.h} fill="url(#sk-sp-hatch)" stroke="var(--chart)" strokeOpacity="0.5" />
        <text x={SHALLOW.x + 6} y={SHALLOW.y + 14} className="sk-t sk-t--s">depth &lt; 3 m</text>
        <rect x={MOORING_AREA.x} y={MOORING_AREA.y} width={MOORING_AREA.w} height={MOORING_AREA.h} fill="none" stroke="var(--ink-3)" strokeDasharray="2 3" />
        <text x={MOORING_AREA.x + 4} y={MOORING_AREA.y - 4} className="sk-t sk-t--s">mooring area</text>
        {/* shore + jetty + bridge */}
        <path d="M0 0 H40 Q30 80 40 150 T38 300 H0 Z" fill="var(--paper-3)" stroke="var(--rule-2)" />
        <text x="6" y="290" className="sk-t sk-t--s">shore</text>
        <rect x={JETTY.x} y={JETTY.y} width={JETTY.w} height={JETTY.h} fill="var(--paper-3)" stroke="var(--ink-2)" />
        <text x={JETTY.x + 4} y={JETTY.y - 4} className="sk-t sk-t--s">jetty</text>
        <rect x={BRIDGE.x - 30} y={BRIDGE.y - 10} width={BRIDGE.w + 60} height={12} fill="var(--paper-3)" stroke="var(--ink-2)" />
        <path d={`M${BRIDGE.x} ${BRIDGE.y + 2} Q${BRIDGE.x + BRIDGE.w / 2} ${BRIDGE.y - 16} ${BRIDGE.x + BRIDGE.w} ${BRIDGE.y + 2}`} fill="none" stroke="var(--ink-2)" />
        <text x={BRIDGE.x + BRIDGE.w + 34} y={BRIDGE.y - 1} className="sk-t sk-t--s">bridge</text>
        {MOORED.map((m) => <g key={m.x} transform={`translate(${m.x} ${m.y}) rotate(200) scale(0.22)`}><path d="M0 -30 C7 -22 10 -8 10 4 L9 30 L-9 30 L-10 4 C-10 -8 -7 -22 0 -30Z" fill="var(--hull)" stroke="var(--hull-line)" strokeWidth="5" /></g>)}
        <g transform={`translate(${UNDERWAY.x} ${UNDERWAY.y}) rotate(60) scale(0.2)`}><path d="M0 -30 C7 -22 10 -8 10 4 L9 30 L-9 30 L-10 4 C-10 -8 -7 -22 0 -30Z" fill="var(--hull)" stroke="var(--hull-line)" strokeWidth="5" /></g>
        <text x={UNDERWAY.x + 10} y={UNDERWAY.y + 24} className="sk-t sk-t--s">underway</text>
        <g transform={`translate(${SWIMMER.x} ${SWIMMER.y})`}><circle r="3.5" fill="var(--ink)" /><path d="M-8 6 Q-4 3 0 6 T8 6" fill="none" stroke="var(--ink)" /></g>
        <text x={SWIMMER.x + 8} y={SWIMMER.y - 5} className="sk-t sk-t--s">swimmer</text>
        {/* the tapped spot */}
        <g transform={`translate(${pt.x} ${pt.y})`}>
          <circle r="7" fill="none" stroke={zones.length ? 'var(--port)' : 'var(--ok)'} strokeWidth="2" />
          <circle r="2" fill={zones.length ? 'var(--port)' : 'var(--ok)'} />
        </g>
      </svg>
      <div aria-live="polite" style={{ marginTop: '0.7rem', display: 'grid', gap: '0.25rem' }}>
        {zones.length ? (
          <>
            <span className="sk-dot sk-dot--bad" style={{ fontSize: '0.8rem' }}>8 knots max here</span>
            {zones.map((t) => <span key={t} style={{ fontSize: '0.92rem' }}>— <Rich text={t} /></span>)}
          </>
        ) : (
          <span className="sk-dot sk-dot--ok" style={{ fontSize: '0.8rem' }}>No general 8-knot rule here — still a safe speed, and check local signs</span>
        )}
      </div>
    </Stage>
  );
}
