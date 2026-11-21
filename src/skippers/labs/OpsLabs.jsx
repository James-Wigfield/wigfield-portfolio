import { useEffect, useRef, useState } from 'react';
import { Stage, Seg, Rich, Icon } from '../kit/kit';
import { prefersReducedMotion } from '../kit/hooks';

/* LABS for level 07 — safe operations.
   FlotationLab  a swamped hull with none / basic / level flotation (p.75, 85)
   ScopeLab      depth × weather → how much line, and why the chain (p.68)
   StabilityLab  send a wave: low G (stiff) vs high G (tender) (p.74) */

const FLOT = {
  none: { t: 'No built-in flotation', s: 'Nothing holds it up once swamped. Larger boats without flotation **usually take some time to sink** — have the lifejackets and grab-bag ready.', p: 85, y: 70, rot: 8 },
  basic: { t: 'Basic flotation', s: 'Enough to stop the boat and its maximum load **sinking** when swamped — but it may float **at any angle**: something to cling to.', p: 75, y: 26, rot: -24 },
  level: { t: 'Level flotation', s: 'Floats **upright and level** when swamped, supporting its load and its people — so it can be **bailed or pumped dry**.', p: 75, y: 8, rot: 0 },
};

export function FlotationLab() {
  const [k, setK] = useState('basic');
  const f = FLOT[k];
  return (
    <Stage
      title="Swamped: what keeps it up?"
      receipt="Workbook p.75, 85"
      tryThis="Switch the flotation and watch where the swamped boat ends up."
      caption="Capsized or swamped? **Stay with the boat** — it’s far easier to spot than a swimmer (p.84)."
    >
      <div className="sk-ctrls" style={{ marginBottom: '0.6rem' }}>
        <Seg value={k} onChange={setK} options={[{ value: 'none', label: 'None' }, { value: 'basic', label: 'Basic' }, { value: 'level', label: 'Level' }]} label="Flotation" />
      </div>
      <div className="sk-lab2" style={{ maxWidth: 860 }}>
        <svg viewBox="0 0 300 190" className="sk-svg" role="img" aria-label={f.t}>
          <rect width="300" height="190" rx="10" fill="var(--floor)" />
          <rect x="0" y="70" width="300" height="120" fill="var(--chart)" opacity="0.16" />
          <path d="M0 70 Q37 64 75 70 T150 70 T225 70 T300 70" fill="none" stroke="var(--chart)" strokeOpacity="0.6" />
          <g className="sk-anim" style={{ transform: `translate(150px, ${48 + f.y}px) rotate(${f.rot}deg)` }}>
            <path d="M-70 0 L70 0 L58 26 L-62 26 Z" fill="var(--hull)" stroke="var(--hull-line)" strokeWidth="1.6" />
            <rect x="-64" y="4" width="128" height="16" fill="var(--chart)" opacity="0.35" />
            {k !== 'none' && <g>{[-50, -38, 38, 50].map((x) => <rect key={x} x={x - 5} y={8} width={10} height={14} fill="var(--spec)" opacity="0.8" />)}</g>}
            {k === 'level' && <g fill="var(--ink)">{[-20, 0, 20].map((x) => <circle key={x} cx={x} cy={-6} r="5" />)}</g>}
          </g>
          {k === 'basic' && <g fill="var(--ink)">{[96, 214].map((x) => <circle key={x} cx={x} cy={68} r="5" />)}</g>}
          {k !== 'none' && <text x="8" y="182" className="sk-t sk-t--s">yellow = sealed buoyancy</text>}
        </svg>
        <div style={{ display: 'grid', gap: '0.55rem', alignContent: 'start' }}>
          <h4 style={{ fontFamily: 'var(--f-display)', fontSize: '1.2rem' }}>{f.t}</h4>
          <p style={{ fontSize: '0.92rem', color: 'var(--ink-2)' }}><Rich text={f.s} /></p>
          <span className="sk-receipt">Workbook p.{f.p}</span>
        </div>
      </div>
    </Stage>
  );
}

const SCOPE = { calm: 5, fair: 7, moderate: 9 };

export function ScopeLab() {
  const [depth, setDepth] = useState(6);
  const [wx, setWx] = useState('calm');
  const ratio = SCOPE[wx];
  const line = depth * ratio;
  // drawing: 1 m depth = 9 px; horizontal run from Pythagoras (straight-line simplification)
  const scale = 9;
  const H = depth * scale;
  const run = Math.sqrt(Math.max(0, line * line - depth * depth)) * scale * 0.42; // compressed horizontally to fit
  const bx = 360;
  const ax = Math.max(30, bx - run);
  const angle = Math.round((Math.atan2(depth, Math.sqrt(line * line - depth * depth)) * 180) / Math.PI);
  return (
    <Stage
      title="How much anchor line?"
      receipt="Workbook p.68–69"
      tryThis="Change the depth and the weather. Line out = **depth × scope**."
      caption="The **chain** (at least 3 m) adds weight so the pull on the anchor stays **near horizontal**, absorbs shocks and saves the rope from chafe. Danforth: the trailer-boat favourite, best in **sand**."
      challenge={{ text: 'Work out the line for 8 m of water in moderate weather.', done: depth === 8 && wx === 'moderate' }}
      foot={<span className="sk-dot sk-dot--chart">horizontal distance squashed to fit</span>}
    >
      <div className="sk-ctrls" style={{ marginBottom: '0.6rem' }}>
        <Seg value={wx} onChange={setWx} options={[{ value: 'calm', label: 'Calm 5:1' }, { value: 'fair', label: 'Fair 7:1' }, { value: 'moderate', label: 'Moderate 9:1' }]} label="Weather" />
      </div>
      <svg viewBox="0 0 400 230" className="sk-svg" role="img" aria-label={`${depth} m deep, ${line} m of line out`} style={{ maxWidth: 760 }}>
        <rect width="400" height="230" rx="10" fill="var(--floor)" />
        <rect x="0" y="30" width="400" height={H} fill="var(--chart)" opacity="0.14" />
        <path d={`M0 ${30 + H} H400 V230 H0 Z`} fill="var(--paper-3)" />
        <text x="8" y={30 + H + 16} className="sk-t sk-t--s">sandy seabed</text>
        <line x1="20" y1="30" x2="20" y2={30 + H} stroke="var(--ink-3)" />
        <text x="26" y={30 + H / 2} className="sk-t sk-t--b">{depth} m</text>
        <path d={`M${bx - 28} 22 L${bx + 22} 22 L${bx + 14} 34 L${bx - 22} 34 Z`} fill="var(--hull)" stroke="var(--hull-line)" />
        <text x={bx - 4} y="14" textAnchor="middle" className="sk-t sk-t--s">wind →</text>
        {/* rope then chain: the last 3 m of chain lies along the bottom */}
        <line x1={bx - 26} y1="30" x2={ax + 3 * scale * 0.9} y2={30 + H} stroke="var(--ink-2)" strokeWidth="1.6" className="sk-anim" />
        <line x1={ax + 3 * scale * 0.9} y1={30 + H} x2={ax} y2={30 + H} stroke="var(--ink)" strokeWidth="3.4" strokeDasharray="3 1.5" />
        <path d={`M${ax} ${30 + H} l-8 -6 m8 6 l-8 6 m8 -6 l-10 0`} stroke="var(--ink)" strokeWidth="2" fill="none" />
        <text x={(ax + bx) / 2} y={Math.min(30 + H / 2 - 8, 200)} textAnchor="middle" className="sk-t sk-t--b">{line} m of line</text>
        <text x={ax} y={30 + H - 8} className="sk-t sk-t--s">chain</text>
        <text x="392" y="222" textAnchor="end" className="sk-t sk-t--s">line angle ≈ {angle}°</text>
      </svg>
      <label style={{ display: 'grid', gap: '0.2rem', marginTop: '0.6rem', maxWidth: 760 }}>
        <span className="sk-micro">Depth · {depth} m</span>
        <input type="range" min={2} max={18} value={depth} onChange={(e) => setDepth(Number(e.target.value))} style={{ width: '100%', accentColor: 'var(--chart)' }} />
      </label>
    </Stage>
  );
}

export function StabilityLab() {
  const [load, setLoad] = useState('low');
  const [ang, setAng] = useState(0);
  const raf = useRef(0);
  useEffect(() => () => cancelAnimationFrame(raf.current), []);
  const stiff = load === 'low';
  const wave = () => {
    cancelAnimationFrame(raf.current);
    if (prefersReducedMotion()) { setAng(0); return; }
    const period = stiff ? 1.1 : 3.2; // seconds per roll
    const damp = stiff ? 1.6 : 0.45;
    const amp = stiff ? 16 : 26;
    const t0 = performance.now();
    const loop = (now) => {
      const t = (now - t0) / 1000;
      const a = amp * Math.exp(-damp * t) * Math.cos((2 * Math.PI * t) / period);
      setAng(a);
      if (t < 8) raf.current = requestAnimationFrame(loop);
      else setAng(0);
    };
    raf.current = requestAnimationFrame(loop);
  };
  const gy = stiff ? 22 : -22;
  return (
    <Stage
      title="Stiff or tender?"
      receipt="Workbook p.74–75"
      tryThis="Move the weight, then **send a wave**. Watch how fast it comes back upright."
      caption={stiff ? '**Low G = stiff**: snaps back upright quickly (stable, but a jerky ride).' : '**High G = tender**: slow, lazy roll — it may fail to come back. Fix it by moving weight **down**.'}
    >
      <div className="sk-ctrls" style={{ marginBottom: '0.6rem' }}>
        <Seg value={load} onChange={setLoad} options={[{ value: 'low', label: 'Weight low' }, { value: 'high', label: 'Weight high' }]} label="Load" />
        <button type="button" className="sk-btn" onClick={wave}><Icon name="play" size={12} /> Send a wave</button>
      </div>
      <svg viewBox="0 0 300 200" className="sk-svg" role="img" aria-label={stiff ? 'Stiff boat' : 'Tender boat'} style={{ maxWidth: 520 }}>
        <rect width="300" height="200" rx="10" fill="var(--floor)" />
        <rect x="0" y="120" width="300" height="80" fill="var(--chart)" opacity="0.14" />
        <g style={{ transform: `translate(150px, 118px) rotate(${ang}deg)` }}>
          <path d="M-60 -14 L60 -14 L44 22 Q0 34 -44 22 Z" fill="var(--hull)" stroke="var(--hull-line)" strokeWidth="1.6" />
          {!stiff && <path d="M-26 -14 V-50 H26 V-14" fill="none" stroke="var(--hull-line)" strokeWidth="1.4" />}
          {[-14, 0, 14].map((x) => <circle key={x} cx={x} cy={stiff ? 4 : -60} r="6" fill="var(--ink)" />)}
          <g transform={`translate(0 ${gy})`}>
            <circle r="7" fill="none" stroke="var(--port)" strokeWidth="2" />
            <path d="M-7 0 H7 M0 -7 V7" stroke="var(--port)" strokeWidth="1.4" />
            <text x="11" y="4" className="sk-t" style={{ fill: 'var(--port)', fontSize: 10 }}>G</text>
          </g>
        </g>
      </svg>
    </Stage>
  );
}

/* ── level 08: which radio call? ─────────────────────────────────────── */
const CALLS = {
  mayday: { t: 'Mayday', s: '**Grave and imminent danger**, immediate help needed. Absolute priority.' },
  panpan: { t: 'Pan Pan', s: '**Urgent** — about the safety of the boat or a person — but not grave and imminent.' },
  securite: { t: 'Sécurité', s: 'An important **navigational or weather warning** for everyone.' },
  rescue: { t: 'Call marine rescue', s: 'Not an emergency call — ask your **marine rescue group** for help.' },
};
const CASES = [
  { s: 'Your boat is taking on water fast and you can’t stop it.', a: 'mayday', p: 61 },
  { s: 'Fire in the engine bay that you can’t control.', a: 'mayday', p: 61 },
  { s: 'Capsized offshore, everyone in the water.', a: 'mayday', p: 61 },
  { s: 'A passenger falls overboard and you’ve lost sight of them.', a: 'panpan', p: 61 },
  { s: 'A passenger has a serious medical problem.', a: 'panpan', p: 61 },
  { s: 'Mechanical breakdown well offshore, weather getting up.', a: 'panpan', p: 61 },
  { s: 'You see a large drifting log in the main channel.', a: 'securite', p: 61 },
  { s: 'Motor won’t restart, calm day, you’re anchored and not drifting into danger.', a: 'rescue', p: 85 },
];
const SCRIPT = {
  mayday: ['Mayday, Mayday, Mayday', 'This is [rego] [rego] [rego]', 'My position is …', 'My problem is …', 'I have [number] people on board'],
  panpan: ['Pan Pan, Pan Pan, Pan Pan', 'Hello all stations ×3', 'This is [rego] ×3', 'My position is …', 'I require …'],
  securite: ['Saycure-e-tay ×3', 'Hello all stations ×3', 'This is [rego] ×3', 'A hazard exists …'],
  rescue: ['Call your marine rescue group on its channel and explain — a breakdown on its own is not a Pan Pan or Mayday.'],
};

export function CallsLab() {
  const [i, setI] = useState(0);
  const [pick, setPick] = useState(null);
  const [right, setRight] = useState(0);
  const c = CASES[i];
  const next = () => { setI((i + 1) % CASES.length); setPick(null); };
  return (
    <Stage
      title="Which call?"
      receipt="Workbook p.60–61, 85"
      tryThis="Read the situation. Pick the call you’d make on **VHF 16** (or 27 MHz 88)."
      caption="A Mayday gives the **3 Ps: position, problem, people**. Stay on the distress channel unless told to change."
      challenge={{ text: `Get all 8 situations right (${right}/8).`, done: right >= 8 }}
    >
      <div className="sk-lab2" style={{ maxWidth: 900, alignItems: 'start' }}>
        <div style={{ display: 'grid', gap: '0.8rem' }}>
          <span className="sk-micro">Situation {String(i + 1).padStart(2, '0')} / {String(CASES.length).padStart(2, '0')}</span>
          <p style={{ fontFamily: 'var(--f-display)', fontSize: '1.3rem', lineHeight: 1.3 }}>{c.s}</p>
          <div className="sk-opts">
            {Object.entries(CALLS).map(([k, v], j) => {
              const ok = pick && k === c.a;
              const bad = pick === k && k !== c.a;
              return (
                <button key={k} type="button" disabled={!!pick} className={`sk-opt${ok ? ' sk-opt--right' : ''}${bad ? ' sk-opt--wrong' : ''}`}
                  onClick={() => { setPick(k); if (k === c.a) setRight((r) => r + 1); }}>
                  <span className="sk-opt__k">{'ABCD'[j]}</span><span><b>{v.t}</b></span><span />
                </button>
              );
            })}
          </div>
          {pick && <button type="button" className="sk-btn sk-btn--small" style={{ justifySelf: 'start' }} onClick={next}>Next situation <Icon name="arrow" size={12} /></button>}
        </div>
        <div style={{ display: 'grid', gap: '0.5rem', alignContent: 'start' }}>
          {pick ? (
            <>
              <span className={`sk-dot ${pick === c.a ? 'sk-dot--ok' : 'sk-dot--bad'}`}>{CALLS[c.a].t} · Workbook p.{c.p}</span>
              <p style={{ fontSize: '0.92rem', color: 'var(--ink-2)' }}><Rich text={CALLS[c.a].s} /></p>
              <div className="sk-script">
                {SCRIPT[c.a].map((l) => <p key={l}>{l}</p>)}
              </div>
            </>
          ) : (
            <p className="sk-stage__cap">The call, its meaning and the words to say appear here.</p>
          )}
        </div>
      </div>
    </Stage>
  );
}
