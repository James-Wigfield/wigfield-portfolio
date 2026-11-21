import { useState } from 'react';
import { Stage, Seg, Rich } from '../kit/kit';
import { Mark, Rhythm, TopBoat } from '../art/parts';
import { MARKS, isOn, LIGHT_COLOR } from '../art/geometry';
import { useClock } from '../kit/hooks';

/* LABS for level 04 — IALA buoyage (Workbook p.37–40).
   LateralLab     a channel from the sea (bottom) to the harbour (top). Marks
                  come one at a time; you say which side of YOUR boat they go.
                  Going in, red stays on your left; coming out it flips.
   CardinalLab    a reef with the four cardinals round it, lights blinking
                  their real rhythms; tap one to read it
   OtherMarksLab  isolated danger · safe water · special, day and night */

const SEQ = ['port', 'starboard', 'starboard', 'port', 'port', 'starboard'];

export function LateralLab() {
  const [dir, setDir] = useState('in');
  const [k, setK] = useState(0); // how many placed
  const [miss, setMiss] = useState(null);
  const [rounds, setRounds] = useState({ in: false, out: false });
  const going = dir === 'in';
  const type = SEQ[k];
  const ys = going ? [250, 210, 170, 130, 90, 50] : [50, 90, 130, 170, 210, 250];
  const boatY = k === 0 ? (going ? 268 : 34) : ys[Math.min(k, SEQ.length) - 1] + (going ? 16 : -16);
  // geography: red (port marks) on the screen-left of the channel, because
  // the direction of buoyage runs INTO the harbour (up the screen)
  const correct = (t) => (going ? (t === 'port' ? 'port' : 'stbd') : (t === 'port' ? 'stbd' : 'port'));
  const answer = (side) => {
    if (k >= SEQ.length) return;
    if (side === correct(type)) {
      setMiss(null);
      const nk = k + 1;
      setK(nk);
      if (nk === SEQ.length) setRounds((r) => ({ ...r, [dir]: true }));
    } else setMiss(`That ${MARKS[type].label.toLowerCase()} goes on your ${correct(type) === 'port' ? 'port' : 'starboard'} side ${going ? 'going in' : 'coming out'}.`);
  };
  const reset = (d) => { setDir(d); setK(0); setMiss(null); };
  const done = k >= SEQ.length;

  return (
    <Stage
      title="Port and starboard marks"
      receipt="Workbook p.37"
      tryThis={going ? 'You are **heading in** from the sea. Which side of your boat should this mark pass on?' : 'Now you are **heading out** to sea. Same marks — which side now?'}
      caption={going ? '“There’s some **red port** left in the bottle” — going in or upstream, keep **red on your port (left)**.' : 'Coming out, everything flips: **red marks pass on your starboard (right)**. The marks don’t move — you turned round.'}
      challenge={{ text: 'Get through the channel both ways.', done: rounds.in && rounds.out }}
    >
      <div className="sk-ctrls" style={{ marginBottom: '0.6rem' }}>
        <Seg value={dir} onChange={reset} options={[{ value: 'in', label: 'Heading in' }, { value: 'out', label: 'Heading out' }]} label="Direction" />
      </div>
      <div className="sk-lab2" style={{ maxWidth: 820, margin: '0 auto' }}>
        <svg viewBox="0 0 360 300" className="sk-svg" role="img" aria-label="A channel from the sea to the harbour">
          <rect width="360" height="300" rx="10" fill="color-mix(in srgb, var(--chart) 10%, var(--floor))" />
          <path d="M0 0 H70 Q90 150 70 300 H0 Z M360 0 H290 Q270 150 290 300 H360 Z" fill="var(--paper-3)" stroke="var(--rule-2)" />
          <text x="180" y="16" textAnchor="middle" className="sk-t sk-t--s">HARBOUR · upstream</text>
          <text x="180" y="294" textAnchor="middle" className="sk-t sk-t--s">SEA · downstream</text>
          <path d="M180 270 L180 40" stroke="var(--ink-3)" strokeDasharray="2 6" />
          <text x="186" y="160" className="sk-t sk-t--s" transform="rotate(-90 186 160)">direction of buoyage →</text>
          {SEQ.slice(0, k).map((t, i) => (
            <Mark key={i} type={t} x={t === 'port' ? 118 : 242} y={ys[i] + 18} scale={0.34} />
          ))}
          <g className="sk-anim" style={{ transform: `translate(180px, ${boatY}px)` }}>
            <g style={{ transform: `rotate(${going ? 0 : 180}deg)` }} className="sk-anim">
              <TopBoat scale={0.42} tone="you" />
            </g>
          </g>
          <text x={going ? 150 : 210} y={boatY + 4} textAnchor={going ? 'end' : 'start'} className="sk-t" style={{ fontSize: 9, fill: 'var(--port)' }}>your port</text>
          <text x={going ? 210 : 150} y={boatY + 4} textAnchor={going ? 'start' : 'end'} className="sk-t" style={{ fontSize: 9, fill: 'var(--stbd)' }}>your stbd</text>
        </svg>
        <div style={{ display: 'grid', gap: '0.8rem', justifyItems: 'start' }}>
          {!done ? (
            <>
              <span className="sk-micro">Mark {String(k + 1).padStart(2, '0')} of {String(SEQ.length).padStart(2, '0')}</span>
              <svg viewBox="0 0 120 140" style={{ width: 110 }} role="img" aria-label={MARKS[type].label}>
                <Mark type={type} x={60} y={132} scale={1} />
              </svg>
              <div className="sk-ctrls">
                <button type="button" className="sk-btn" onClick={() => answer('port')}><span className="sk-dot sk-dot--port">Pass it on my port</span></button>
                <button type="button" className="sk-btn" onClick={() => answer('stbd')}><span className="sk-dot sk-dot--stbd">Pass it on my starboard</span></button>
              </div>
              {miss && <span className="sk-dot sk-dot--bad" aria-live="polite">{miss}</span>}
            </>
          ) : (
            <>
              <span className="sk-dot sk-dot--ok">Through the channel {going ? 'inbound' : 'outbound'}.</span>
              <button type="button" className="sk-btn" onClick={() => reset(going ? 'out' : 'in')}>Now go {going ? 'out' : 'in'}</button>
            </>
          )}
          <span className="sk-stage__cap">Lit marks: <b style={{ color: 'var(--port)' }}>red</b> lights on port marks, <b style={{ color: 'var(--stbd)' }}>green</b> on starboard — any rhythm except Fl(2+1).</span>
        </div>
      </div>
    </Stage>
  );
}

const CARD_POS = { north: [180, 78], east: [312, 190], south: [180, 300], west: [48, 190] };
const CARD_SAY = {
  north: { pass: 'Pass to the **north** of it.', top: 'Both cones point **up**; black on **top**.', light: '**Continuous** quick flashes — 12 o’clock.' },
  east: { pass: 'Pass to the **east** of it.', top: 'Cones point **up and down** (base to base); black top and bottom.', light: '**3** flashes — 3 o’clock.' },
  south: { pass: 'Pass to the **south** of it.', top: 'Both cones point **down**; black at the **bottom**.', light: '**6** flashes + **1 long** — 6 o’clock.' },
  west: { pass: 'Pass to the **west** of it.', top: 'Cones point **inwards** (point to point); black in the **middle**.', light: '**9** flashes — 9 o’clock.' },
};

export function CardinalLab() {
  const [sel, setSel] = useState('south');
  const [night, setNight] = useState('day');
  const [seen, setSeen] = useState({ south: true });
  const pick = (m) => { setSel(m); setSeen((s) => ({ ...s, [m]: true })); };
  const dark = night === 'night';
  return (
    <Stage
      title="Cardinal marks"
      receipt="Workbook p.39"
      tryThis="Tap each mark. The **cones point to the black**, and the flashes follow a **clock face**."
      sea={dark}
      challenge={{ text: 'Read all four cardinals.', done: ['north', 'east', 'south', 'west'].every((k) => seen[k]) }}
    >
      <div className="sk-ctrls" style={{ marginBottom: '0.6rem' }}>
        <Seg value={night} onChange={setNight} options={[{ value: 'day', label: 'By day' }, { value: 'night', label: 'At night' }]} label="Time of day" />
      </div>
      <div className="sk-lab2" style={{ maxWidth: 900, margin: '0 auto' }}>
        <svg viewBox="0 0 360 330" className="sk-svg" role="img" aria-label="A reef with four cardinal marks around it">
          {!dark && <rect width="360" height="330" rx="10" fill="color-mix(in srgb, var(--chart) 9%, var(--floor))" />}
          <ellipse cx="180" cy="175" rx="70" ry="48" fill={dark ? '#1b2c3e' : 'var(--paper-3)'} stroke={dark ? '#2f4a66' : 'var(--rule-2)'} strokeDasharray="4 3" />
          <text x="180" y="179" textAnchor="middle" className={`sk-t ${dark ? 'sk-t--sea' : ''}`}>DANGER · reef</text>
          <g className={dark ? 'sk-t--sea' : ''}>
            {['N', 'E', 'S', 'W'].map((c, i) => <text key={c} x={[180, 352, 180, 8][i]} y={[12, 120, 326, 120][i]} textAnchor="middle" className="sk-t sk-t--s" style={dark ? { fill: '#9fb8cf' } : null}>{c}</text>)}
          </g>
          {Object.entries(CARD_POS).map(([m, [x, y]]) => (
            <g key={m} role="button" tabIndex={0} aria-label={MARKS[m].label} className="sk-hit" onClick={() => pick(m)} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && pick(m)}>
              <circle cx={x} cy={y - 30} r="44" fill={sel === m ? (dark ? 'rgba(159,184,207,.12)' : 'color-mix(in srgb, var(--chart) 12%, transparent)') : 'transparent'} stroke={sel === m ? 'var(--chart)' : 'transparent'} />
              {dark ? <g transform={`translate(${x} ${y - 40})`} pointerEvents="none"><LampDot type={m} /></g> : <Mark type={m} x={x} y={y + 6} scale={0.6} />}
            </g>
          ))}
        </svg>
        <div style={{ display: 'grid', gap: '0.7rem', alignContent: 'start' }}>
          <h4 style={{ fontFamily: 'var(--f-display)', fontSize: '1.2rem' }}>{MARKS[sel].label}</h4>
          <span className="sk-dot sk-dot--chart"><Rich text={CARD_SAY[sel].pass} /></span>
          <svg viewBox="0 0 120 150" style={{ width: 130 }} role="img" aria-label={`${MARKS[sel].label} by day`}><Mark type={sel} x={60} y={140} /></svg>
          <span style={{ fontSize: '0.9rem', color: dark ? '#c9d4dd' : 'var(--ink-2)' }}><Rich text={CARD_SAY[sel].top} /></span>
          <Rhythm rhythm={MARKS[sel].rhythm} color="white" w={320} />
          <span style={{ fontSize: '0.9rem', color: dark ? '#c9d4dd' : 'var(--ink-2)' }}><Rich text={CARD_SAY[sel].light} /> White, quick (Q) or very quick (VQ).</span>
        </div>
      </div>
    </Stage>
  );
}

// at night only the light is visible: a lamp blinking the mark's rhythm
function LampDot({ type }) {
  const t = useClock(true, 0);
  const on = isOn(MARKS[type].rhythm, t);
  const col = LIGHT_COLOR[MARKS[type].light];
  return (
    <g style={{ color: col }}>
      <circle r="12" fill={col} opacity={on ? 0.2 : 0.03} />
      <circle r="4.5" fill={col} opacity={on ? 1 : 0.12} className={on ? 'sk-glow' : ''} />
    </g>
  );
}

const OTHER = [
  { m: 'isolated', t: 'Isolated danger', s: 'A small danger with **safe water all round** it. Pass well clear. Two black balls; white light in **groups of 2**.', p: 37 },
  { m: 'safe', t: 'Safe water', s: '**Safe water all round** — often the seaward end of a channel. Red and white stripes, red ball; white light **isophase, occulting, one long flash** or Morse “A”.', p: 38 },
  { m: 'special', t: 'Special mark', s: 'A **special area** (spoil ground, aquaculture, traffic separation) — check the chart. Yellow, yellow ✕; **yellow** light.', p: 38 },
];

export function OtherMarksLab() {
  const [night, setNight] = useState('day');
  const dark = night === 'night';
  return (
    <Stage
      title="Isolated danger, safe water, special"
      receipt="Workbook p.37–38"
      tryThis="Flip to **At night** and match each light to its mark."
      sea={dark}
    >
      <div className="sk-ctrls" style={{ marginBottom: '0.8rem' }}>
        <Seg value={night} onChange={setNight} options={[{ value: 'day', label: 'By day' }, { value: 'night', label: 'At night' }]} label="Time of day" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: '1.2rem 2rem' }}>
        {OTHER.map((o) => (
          <div key={o.m} style={{ display: 'grid', gap: '0.55rem', alignContent: 'start', borderTop: `2px solid ${dark ? 'rgba(214,224,236,.3)' : 'var(--rule-strong)'}`, paddingTop: '0.6rem' }}>
            <h4 style={{ fontFamily: 'var(--f-display)', fontSize: '1.12rem' }}>{o.t}</h4>
            {dark ? <Rhythm rhythm={MARKS[o.m].rhythm} color={MARKS[o.m].light} w={260} /> : (
              <svg viewBox="0 0 120 150" style={{ width: 86 }} role="img" aria-label={o.t}><Mark type={o.m} x={60} y={140} /></svg>
            )}
            <span style={{ fontSize: '0.88rem', color: dark ? '#c9d4dd' : 'var(--ink-2)' }}><Rich text={o.s} /></span>
            <span className="sk-receipt" style={dark ? { color: '#9fb8cf' } : null}>Workbook p.{o.p}</span>
          </div>
        ))}
      </div>
      {dark && <p style={{ marginTop: '1rem', fontSize: '0.8rem', color: '#9fb8cf' }}>Periods shown are examples; the chart gives each real mark’s exact character.</p>}
    </Stage>
  );
}
