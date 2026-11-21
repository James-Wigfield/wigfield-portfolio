import { useState } from 'react';
import { Stage, Seg, Rich } from '../kit/kit';
import { TopBoat } from '../art/parts';

/* LABS for level 06 — safety gear (Workbook p.49–57).
   GearLab   slide from the river out past 400 m and 4 NM; the required gear
             for your boat lights up. Thresholds are the 2026 workbook's own
             (table p.49, wearing table p.52). Registrable vessels.
   FlareLab  day / night × who can see you → the signal to use (p.54–55, 84) */

const ZONES = [
  { id: 'river', label: 'River, lake, estuary or harbour', short: 'Sheltered', prot: true },
  { id: 'coast', label: 'Off the coast, within 400 m of shore', short: '< 400 m', prot: true },
  { id: 'off', label: 'Beyond 400 m from shore', short: '> 400 m', prot: false },
  { id: 'far', label: 'More than 4 nautical miles from shore', short: '> 4 NM', prot: false },
];

function gearFor(zone, boat) {
  const z = ZONES[zone];
  const pwc = boat === 'pwc';
  const small = boat === 'small';
  const out = [];
  out.push({ k: 'RST', st: 'req', t: 'Skipper holds an **RST** (motor over 6 hp)', p: 49 });
  if (pwc) out.push({ k: 'PFD', st: 'wear', t: 'Lifejacket **Level 50S or better, worn** by everyone on board', p: 52 });
  else if (z.prot) out.push({ k: 'PFD', st: 'req', t: 'Lifejacket **Level 100+ carried** for every person', p: 52 });
  else if (small) out.push({ k: 'PFD', st: 'wear', t: 'Lifejacket **Level 100+ worn** by everyone (boat under 4.8 m)', p: 52 });
  else out.push({ k: 'PFD', st: 'req', t: 'Lifejacket **Level 100+ carried** for everyone; **children 1–12 wear** theirs', p: 52 });
  if (!pwc && z.prot) out.push({ k: 'Kids', st: 'req', t: 'Children older than 1 and under 12: **Level 100 carried** in sheltered water', p: 52 });
  out.push({ k: 'Beacon', st: z.prot ? 'rec' : 'req', t: z.prot ? 'GPS **EPIRB or PLB** — recommended' : 'In-date **GPS 406 MHz EPIRB**, or a GPS **PLB worn** by at least one person', p: 49 });
  out.push({ k: 'Flares', st: z.prot ? 'rec' : 'req', t: z.prot ? '**Flares or EVDS** — recommended' : '**2 red + 2 orange** hand flares, or an **EVDS** (only with a GPS beacon)', p: 54 });
  out.push({ k: 'Radio', st: zone === 3 ? 'req' : 'rec', t: zone === 3 ? '**VHF or HF** marine radio (27 MHz is being phased out)' : 'Marine radio — recommended (required beyond 4 NM)', p: 60 });
  out.push({ k: 'Extras', st: 'rec', t: 'Anchor and line, fire extinguisher, a bailer or pump — recommended', p: 49 });
  return out;
}

const ST = { req: ['sk-dot--bad', 'required'], wear: ['sk-dot--bad', 'required · worn'], rec: ['', 'recommended'] };

export function GearLab() {
  const [zone, setZone] = useState(2);
  const [boat, setBoat] = useState('small');
  const gear = gearFor(zone, boat);
  const X = [55, 140, 245, 340]; // boat position per zone on the strip
  return (
    <Stage
      title="Gear by distance"
      receipt="Workbook p.49, 52, 60"
      tryThis="Slide the boat offshore. Two lines change everything: **400 m** and **4 NM**."
      caption="**Lake Argyle** and **Cambridge Gulf** count as unprotected water even close to shore. Required gear must be **in date**."
      challenge={{ text: 'Find where a radio becomes required.', done: zone === 3 }}
      foot={<span className="sk-dot sk-dot--chart">registrable vessels · 2026 rules</span>}
    >
      <div className="sk-ctrls" style={{ marginBottom: '0.6rem' }}>
        <Seg value={boat} onChange={setBoat} options={[{ value: 'small', label: 'Boat < 4.8 m' }, { value: 'big', label: 'Boat ≥ 4.8 m' }, { value: 'pwc', label: 'PWC' }]} label="Your craft" />
      </div>
      <svg viewBox="0 0 400 120" className="sk-svg" role="img" aria-label={`Your boat: ${ZONES[zone].label}`} style={{ maxWidth: 760 }}>
        <rect width="400" height="120" rx="10" fill="color-mix(in srgb, var(--chart) 9%, var(--floor))" />
        <path d="M0 0 H28 Q40 60 22 120 H0 Z" fill="var(--paper-3)" stroke="var(--rule-2)" />
        <rect x="0" y="0" width="190" height="120" fill="var(--stbd)" opacity="0.05" />
        <line x1="190" y1="8" x2="190" y2="112" stroke="var(--ink-2)" strokeDasharray="4 3" />
        <line x1="300" y1="8" x2="300" y2="112" stroke="var(--ink-2)" strokeDasharray="4 3" />
        <text x="194" y="18" className="sk-t sk-t--b" style={{ fontSize: 10 }}>400 m</text>
        <text x="304" y="18" className="sk-t sk-t--b" style={{ fontSize: 10 }}>4 NM</text>
        <text x="36" y="112" className="sk-t sk-t--s">protected</text>
        <text x="196" y="112" className="sk-t sk-t--s">unprotected</text>
        <text x="4" y="14" className="sk-t sk-t--s">shore</text>
        <g className="sk-anim" style={{ transform: `translate(${X[zone]}px, 62px)` }}>
          <g style={{ transform: 'rotate(90deg)' }}><TopBoat scale={boat === 'pwc' ? 0.28 : boat === 'small' ? 0.36 : 0.48} tone="you" /></g>
        </g>
      </svg>
      <label style={{ display: 'grid', gap: '0.2rem', margin: '0.6rem 0 0.8rem', maxWidth: 760 }}>
        <span className="sk-micro">{ZONES[zone].label}</span>
        <input type="range" min={0} max={3} step={1} value={zone} onChange={(e) => setZone(Number(e.target.value))} style={{ width: '100%', accentColor: 'var(--chart)' }} aria-valuetext={ZONES[zone].label} />
      </label>
      <div className="sk-list" style={{ maxWidth: 760 }}>
        {gear.map((g) => (
          <div key={g.k} className="sk-list__row" style={{ gridTemplateColumns: '4.4rem 1fr auto', alignItems: 'baseline', opacity: g.st === 'rec' ? 0.62 : 1 }}>
            <span className="sk-micro">{g.k}</span>
            <span><Rich text={g.t} /></span>
            <span className={`sk-dot ${ST[g.st][0]}`} style={{ whiteSpace: 'nowrap' }}>{ST[g.st][1]}</span>
          </div>
        ))}
      </div>
    </Stage>
  );
}

/* ── flares ─────────────────────────────────────────────────────────── */
const FLARES = {
  orange: { t: 'Orange smoke flare', s: 'Day only — no light. Especially easy to spot **from aircraft**. Burns about **60 s**, seen ~4 km (under 1 km in a fresh breeze).', p: 54 },
  red: { t: 'Red hand-held flare', s: 'Day **or** night. Burns about **45 s**; seen **10–12 km at night**, 4–6 km by day. Hold it downwind, angled out — it drips hot embers.', p: 54 },
  evds: { t: 'EVDS (white flashing light)', s: 'Runs for hours. Helps rescuers in the **final stages**, once they’re near your EPIRB/PLB signal. Only legal instead of flares **with a GPS beacon**.', p: 55 },
  radio: { t: 'Radio or EPIRB first', s: 'Flares are **short range: see a potential rescuer before you fire one**. Nobody in sight → Mayday on the radio, or set off the EPIRB.', p: 84 },
};

export function FlareLab() {
  const [time, setTime] = useState('day');
  const [who, setWho] = useState('boat');
  let pick;
  if (who === 'none') pick = 'radio';
  else if (who === 'close') pick = time === 'night' ? 'evds' : 'red';
  else if (time === 'night') pick = 'red';
  else pick = 'orange';
  let alt = null;
  if (time === 'day' && who === 'boat') alt = 'A red hand flare also works by day.';
  if (time === 'night' && who === 'close') alt = 'Carrying flares instead? A red hand flare does the same job.';
  const f = FLARES[pick];
  const night = time === 'night';
  return (
    <Stage
      title="Flare picker"
      receipt="Workbook p.54–55, 84"
      tryThis="Set the time and who might see you. The right signal lights up."
      sea={night}
    >
      <div className="sk-ctrls" style={{ marginBottom: '0.7rem' }}>
        <Seg value={time} onChange={setTime} options={[{ value: 'day', label: 'Day' }, { value: 'night', label: 'Night' }]} label="Time" />
        <Seg value={who} onChange={setWho} options={[{ value: 'none', label: 'Nobody in sight' }, { value: 'boat', label: 'A boat in sight' }, { value: 'plane', label: 'Aircraft overhead' }, { value: 'close', label: 'Rescuers closing in' }]} label="Who can see you" />
      </div>
      <div className="sk-lab2" style={{ maxWidth: 860 }}>
        <svg viewBox="0 0 300 200" className="sk-svg" role="img" aria-label={f.t}>
          <rect width="300" height="200" rx="10" fill={night ? '#060f18' : 'color-mix(in srgb, var(--chart) 12%, var(--floor))'} />
          <path d="M0 150 Q75 142 150 150 T300 150 V200 H0 Z" fill={night ? '#0e2032' : 'color-mix(in srgb, var(--chart) 22%, var(--floor))'} />
          <g transform="translate(150 150) rotate(90) scale(0.5)"><TopBoat tone="you" /></g>
          {pick === 'orange' && (
            <g className="sk-anim">
              <path d="M150 140 C120 110 170 90 140 60 C120 40 175 30 160 8" fill="none" stroke="#ff8a2a" strokeWidth="26" strokeLinecap="round" opacity="0.55" />
              <path d="M150 140 C130 112 165 92 145 64" fill="none" stroke="#ffb066" strokeWidth="12" strokeLinecap="round" opacity="0.7" />
            </g>
          )}
          {pick === 'red' && (
            <g style={{ color: '#ff4b4b' }}>
              <circle cx="168" cy="118" r="30" fill="#ff4b4b" opacity="0.22" />
              <circle cx="168" cy="118" r="7" fill="#ff6b5b" className="sk-glow" />
              <line x1="160" y1="140" x2="168" y2="122" stroke="#999" strokeWidth="3" />
            </g>
          )}
          {pick === 'evds' && (
            <g style={{ color: '#fff' }}>
              <circle cx="150" cy="128" r="24" fill="#fff" opacity="0.18" />
              <circle cx="150" cy="128" r="5" fill="#fff" className="sk-glow" />
            </g>
          )}
          {pick === 'radio' && (
            <g stroke={night ? '#9fb8cf' : 'var(--ink-2)'} fill="none" strokeWidth="2">
              <line x1="150" y1="140" x2="150" y2="100" />
              {[14, 26, 38].map((r) => <path key={r} d={`M${150 - r} ${100 - r * 0.2} A${r} ${r} 0 0 1 ${150 + r} ${100 - r * 0.2}`} opacity={1 - r / 50} />)}
            </g>
          )}
          {who === 'plane' && <path d="M40 40 l40 0 l-12 -8 h6 l18 8 h20 a4 4 0 0 1 0 6 h-20 l-18 8 h-6 l12 -8 h-40 z" fill={night ? '#9fb8cf' : 'var(--ink-3)'} />}
          {(who === 'boat' || who === 'close') && <g transform={`translate(${who === 'close' ? 230 : 262} 146) rotate(-90) scale(${who === 'close' ? 0.36 : 0.22})`}><TopBoat /></g>}
        </svg>
        <div style={{ display: 'grid', gap: '0.6rem', alignContent: 'start', color: night ? '#e8edf2' : 'var(--ink)' }}>
          <h4 style={{ fontFamily: 'var(--f-display)', fontSize: '1.25rem' }}>{f.t}</h4>
          <p style={{ fontSize: '0.92rem', color: night ? '#c9d4dd' : 'var(--ink-2)' }}><Rich text={f.s} /></p>
          {alt && <p style={{ fontSize: '0.86rem', color: night ? '#9fb8cf' : 'var(--ink-3)' }}>{alt}</p>}
          <span className="sk-receipt" style={night ? { color: '#9fb8cf' } : null}>Workbook p.{f.p}</span>
        </div>
      </div>
    </Stage>
  );
}
