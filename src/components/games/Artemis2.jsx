import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import './Artemis2.css';

// ─── Data ─────────────────────────────────────────────────────────────────────
const PHASES = [
  {
    id: 'launch', t: 0.00, label: 'LAUNCH', icon: '🚀', color: '#fbbf24',
    title: 'SLS Block 1 Launch',
    date: 'Day 0 · Kennedy Space Center, FL',
    desc: 'The Space Launch System generates 8.8 million lbs of thrust — more than any rocket ever flown — lifting the Orion capsule from Launch Pad 39B. The stack clears the tower in seconds, hits Max-Q at T+90 s, and the core stage burns out at T+8 min.',
    detail: 'Thrust: 8.8 Mlbf · Core stage MECO: T+8 min · Altitude at MECO: ~185 km · ICPS carries Orion to TLI',
  },
  {
    id: 'tli', t: 0.07, label: 'TLI', icon: '⚡', color: '#fbbf24',
    title: 'Trans-Lunar Injection',
    date: 'Day 0 · ~2 hours post-launch',
    desc: 'The Interim Cryogenic Propulsion Stage fires its RL-10 for ~18 minutes, accelerating Orion to ~10.4 km/s — fast enough to escape Earth orbit. Orion separates, deploys its four solar arrays, and begins the 3-day coast to the Moon.',
    detail: 'Engine: RL-10 · Burn duration: ~18 min · ΔV: ~3.15 km/s · Post-TLI velocity: ~10.4 km/s',
  },
  {
    id: 'outbound', t: 0.22, label: 'OUTBOUND', icon: '🌌', color: '#22d3ee',
    title: 'Cislunar Transit',
    date: 'Days 1–2 · Deep Space',
    desc: 'Orion coasts through cislunar space. The crew conduct systems checks, eat, sleep, and witness the slow shrinking of Earth behind them. Mid-course correction burns trim the trajectory. Communication delay remains under 1.5 seconds.',
    detail: 'Distance: 100,000–300,000 km · Comms delay: <1.5 s · Earth angular size: ~1.5° and shrinking',
  },
  {
    id: 'flyby', t: 0.42, label: 'LUNAR FLYBY', icon: '🌕', color: '#a78bfa',
    title: 'Closest Lunar Approach',
    date: 'Day 3 · ~9,264 km altitude',
    desc: 'Orion passes ~9,264 km above the lunar surface — close enough to see the entire disc. No Lunar Orbit Insertion burn is needed; the Moon\'s gravity bends the trajectory outward in a gravitational slingshot. The crew become the first humans near the Moon since Apollo 17, 1972.',
    detail: 'Approach altitude: ~9,264 km · Relative velocity: ~2.2 km/s · No LOI burn · Duration of close pass: ~20 min',
  },
  {
    id: 'maxdist', t: 0.52, label: 'MAX DISTANCE', icon: '📡', color: '#34d399',
    title: 'Record Human Distance',
    date: 'Days 4–5 · ~450,000 km from Earth',
    desc: 'On the outbound arc beyond the Moon, Orion reaches ~450,000 km from Earth — farther than any human has ever traveled. This shatters the Apollo 13 record of 400,171 km set in 1970. Earth is a faint pale disc; the entire Moon disc fits easily in a window.',
    detail: 'Record distance: ~450,000 km · Earth angular size: ~0.5° · Moon at ~86,000 km behind · Comms delay: ~1.5 s one-way',
  },
  {
    id: 'return', t: 0.77, label: 'RETURN', icon: '🔄', color: '#22d3ee',
    title: 'Return Transit',
    date: 'Days 6–9 · Homeward Bound',
    desc: 'The hybrid free-return trajectory\'s physics naturally draws Orion back toward Earth with no major engine burns. Speed increases as Earth\'s gravity pulls. The crew stow equipment, perform final health checks, and don their pressure suits for re-entry.',
    detail: 'Trajectory type: hybrid free-return · Major burns: none required · Speed at re-entry interface: ~11 km/s',
  },
  {
    id: 'reentry', t: 0.93, label: 'RE-ENTRY', icon: '🔥', color: '#fb7185',
    title: 'Atmospheric Re-entry',
    date: 'Day 10 · 122 km altitude',
    desc: 'Orion hits the atmosphere at 11 km/s — faster than any crewed spacecraft in history. The heat shield endures 2,760 °C. A skip re-entry briefly bounces off the upper atmosphere to extend deceleration, reduce peak G-loading, and improve splashdown precision.',
    detail: 'Entry interface: 122 km · Peak heat: ~2,760 °C · Peak G-load: ~4 g · Skip maneuver duration: ~10 min',
  },
  {
    id: 'splashdown', t: 1.00, label: 'SPLASHDOWN', icon: '🌊', color: '#22d3ee',
    title: 'Pacific Ocean Splashdown',
    date: 'Day 10 · Off San Diego, CA',
    desc: 'Three main parachutes slow Orion from 480 km/h to ~32 km/h for water impact off San Diego. USS San Diego recovery teams retrieve capsule and crew. Total distance traveled: ~2.1 million km. This mission\'s data directly shapes Artemis III — the first crewed lunar landing since 1972.',
    detail: 'Landing zone: ~100 km offshore San Diego · Impact speed: ~32 km/h · Recovery: USS San Diego · Duration: ~10 days',
  },
];

const CREW = [
  {
    name: 'Reid Wiseman', role: 'Commander', flag: '🇺🇸', agency: 'NASA', color: '#fbbf24',
    bio: 'US Navy test pilot. ISS veteran (Expedition 40/41, 165 days). Selected as Artemis 2 Commander for systems expertise and demonstrated leadership under pressure.',
  },
  {
    name: 'Victor Glover', role: 'Pilot', flag: '🇺🇸', agency: 'NASA', color: '#22d3ee',
    bio: 'US Navy test pilot. Crew Dragon veteran (Crew-1, 167 days on ISS). First Black astronaut and first person of color to travel to deep space.',
  },
  {
    name: 'Christina Koch', role: 'Mission Specialist 1', flag: '🇺🇸', agency: 'NASA', color: '#a78bfa',
    bio: 'Electrical engineer. Record-holder for longest single spaceflight by a woman (328 days). First woman to travel to deep space and the vicinity of the Moon.',
  },
  {
    name: 'Jeremy Hansen', role: 'Mission Specialist 2', flag: '🇨🇦', agency: 'CSA', color: '#34d399',
    bio: 'RCAF fighter pilot, CSA astronaut. Artemis 2 is his first spaceflight. First Canadian — and first non-American — to travel beyond low-Earth orbit.',
  },
];

const STATS = [
  { label: 'MISSION DURATION',   value: '~10 days',       color: 'cyan'    },
  { label: 'LAUNCH VEHICLE',     value: 'SLS Block 1',    color: 'amber'   },
  { label: 'SPACECRAFT',         value: 'Orion + ESM',    color: 'amber'   },
  { label: 'CREW SIZE',          value: '4 astronauts',   color: 'violet'  },
  { label: 'MAX DISTANCE',       value: '~450,000 km',    color: 'emerald' },
  { label: 'LUNAR APPROACH',     value: '~9,264 km',      color: 'violet'  },
  { label: 'PEAK HEAT',          value: '2,760 °C',       color: 'rose'    },
  { label: 'TOTAL DISTANCE',     value: '~2.1 million km',color: 'cyan'    },
  { label: 'TRAJECTORY TYPE',    value: 'Hybrid Free-Return', color: 'emerald' },
  { label: 'DISTANCE RECORD',    value: 'Beats Apollo 13 400,171 km', color: 'rose' },
];

// ─── Canvas helpers ───────────────────────────────────────────────────────────
function bzPt(t, p0, p1, p2, p3) {
  const u = 1 - t;
  return {
    x: u*u*u*p0.x + 3*u*u*t*p1.x + 3*u*t*t*p2.x + t*t*t*p3.x,
    y: u*u*u*p0.y + 3*u*u*t*p1.y + 3*u*t*t*p2.y + t*t*t*p3.y,
  };
}

function getPathPt(t, w, h) {
  const E  = { x: 0.11*w, y: 0.69*h };
  const CA = { x: 0.60*w, y: 0.26*h };
  const FP = { x: 0.87*w, y: 0.19*h };
  if (t <= 0.42)
    return bzPt(t/0.42, E, {x:0.27*w,y:0.30*h}, {x:0.46*w,y:0.16*h}, CA);
  if (t <= 0.55)
    return bzPt((t-0.42)/0.13, CA, {x:0.68*w,y:0.19*h}, {x:0.78*w,y:0.11*h}, FP);
  return bzPt((t-0.55)/0.45, FP, {x:0.91*w,y:0.60*h}, {x:0.52*w,y:0.84*h}, E);
}

function buildPath(w, h, n = 700) {
  return Array.from({length: n + 1}, (_, i) => getPathPt(i / n, w, h));
}

function mkStars(w, h, n = 210) {
  return Array.from({length: n}, () => ({
    x: Math.random() * w, y: Math.random() * h,
    r: Math.random() * 1.1 + 0.2,
    a: Math.random() * 0.65 + 0.18,
    ph: Math.random() * Math.PI * 2,
    sp: Math.random() * 0.014 + 0.003,
  }));
}

function drawStars(ctx, stars, tick) {
  stars.forEach(s => {
    const a = s.a * (0.65 + 0.35 * Math.sin(s.ph + tick * s.sp * 60));
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(248,250,252,${a.toFixed(3)})`;
    ctx.fill();
  });
}

function drawEarth(ctx, cx, cy, r) {
  const atm = ctx.createRadialGradient(cx, cy, r * 0.88, cx, cy, r * 1.32);
  atm.addColorStop(0, 'rgba(56,189,248,0.22)');
  atm.addColorStop(0.5, 'rgba(56,189,248,0.06)');
  atm.addColorStop(1, 'rgba(56,189,248,0)');
  ctx.beginPath(); ctx.arc(cx, cy, r * 1.32, 0, Math.PI * 2);
  ctx.fillStyle = atm; ctx.fill();

  const g = ctx.createRadialGradient(cx - r*0.30, cy - r*0.26, r*0.04, cx + r*0.1, cy + r*0.15, r);
  g.addColorStop(0, '#72ccf4'); g.addColorStop(0.25, '#3b82f6');
  g.addColorStop(0.6, '#1d4ed8'); g.addColorStop(0.85, '#1e3a8a');
  g.addColorStop(1, '#060e1c');
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = g; ctx.fill();

  [[cx - r*0.12, cy - r*0.18, r*0.16], [cx + r*0.28, cy + r*0.08, r*0.13], [cx - r*0.30, cy + r*0.30, r*0.12]].forEach(([lx,ly,lr]) => {
    const lg = ctx.createRadialGradient(lx, ly, 0, lx, ly, lr);
    lg.addColorStop(0, 'rgba(52,211,153,0.45)'); lg.addColorStop(1, 'rgba(52,211,153,0)');
    ctx.globalAlpha = 0.55;
    ctx.beginPath(); ctx.arc(lx, ly, lr, 0, Math.PI*2); ctx.fillStyle = lg; ctx.fill();
  });
  ctx.globalAlpha = 1;

  const sh = ctx.createRadialGradient(cx + r*0.28, cy + r*0.28, r*0.22, cx, cy, r);
  sh.addColorStop(0, 'rgba(2,8,23,0)'); sh.addColorStop(0.7, 'rgba(2,8,23,0.07)'); sh.addColorStop(1, 'rgba(2,8,23,0.70)');
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.fillStyle = sh; ctx.fill();
}

function drawMoon(ctx, cx, cy, r) {
  const gl = ctx.createRadialGradient(cx, cy, r, cx, cy, r * 1.48);
  gl.addColorStop(0, 'rgba(210,205,192,0.11)'); gl.addColorStop(1, 'rgba(210,205,192,0)');
  ctx.beginPath(); ctx.arc(cx, cy, r * 1.48, 0, Math.PI * 2); ctx.fillStyle = gl; ctx.fill();

  const g = ctx.createRadialGradient(cx - r*0.28, cy - r*0.24, r*0.04, cx + r*0.1, cy + r*0.14, r);
  g.addColorStop(0, '#eae6d8'); g.addColorStop(0.28, '#c6c2b6');
  g.addColorStop(0.62, '#8a8880'); g.addColorStop(0.9, '#4a4840');
  g.addColorStop(1, '#181610');
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.fillStyle = g; ctx.fill();

  [[-0.22,-0.15,0.13],[0.18,0.22,0.09],[-0.30,0.28,0.08],[0.07,-0.32,0.11],[-0.04,0.06,0.055],[0.30,-0.10,0.07],[-0.18,0.42,0.06]].forEach(([dx,dy,sr]) => {
    if (Math.hypot(dx, dy) + sr * 0.8 > 0.9) return;
    const crx = cx + dx*r, cry = cy + dy*r, crr = sr*r;
    const cg = ctx.createRadialGradient(crx - crr*0.2, cry - crr*0.2, 0, crx, cry, crr);
    cg.addColorStop(0, 'rgba(30,28,24,0.58)'); cg.addColorStop(0.7, 'rgba(30,28,24,0.14)'); cg.addColorStop(1, 'rgba(30,28,24,0)');
    ctx.beginPath(); ctx.arc(crx, cry, crr, 0, Math.PI*2); ctx.fillStyle = cg; ctx.fill();
  });

  const tm = ctx.createRadialGradient(cx + r*0.25, cy + r*0.28, r*0.2, cx, cy, r);
  tm.addColorStop(0, 'rgba(2,8,23,0)'); tm.addColorStop(0.65, 'rgba(2,8,23,0.05)'); tm.addColorStop(1, 'rgba(2,8,23,0.52)');
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.fillStyle = tm; ctx.fill();
}

function drawTraj(ctx, pts, progress) {
  const done = Math.floor(progress * (pts.length - 1));
  if (done < pts.length - 1) {
    ctx.beginPath(); ctx.moveTo(pts[done].x, pts[done].y);
    for (let i = done + 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.strokeStyle = 'rgba(34,211,238,0.13)'; ctx.lineWidth = 1;
    ctx.setLineDash([4, 7]); ctx.stroke(); ctx.setLineDash([]);
  }
  if (done > 0) {
    ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i <= done; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.strokeStyle = 'rgba(34,211,238,0.55)'; ctx.lineWidth = 1.5; ctx.stroke();
  }
}

function drawCraft(ctx, pts, idx, tick) {
  const TRAIL = 22;
  const start = Math.max(0, idx - TRAIL);
  for (let i = start; i < idx; i++) {
    const a = ((i - start) / TRAIL) * 0.42;
    ctx.beginPath(); ctx.arc(pts[i].x, pts[i].y, 1.4, 0, Math.PI*2);
    ctx.fillStyle = `rgba(34,211,238,${a.toFixed(3)})`; ctx.fill();
  }
  const {x, y} = pts[idx];
  const pulse = 0.65 + 0.35 * Math.sin(tick * 4.2);
  const glow = ctx.createRadialGradient(x, y, 0, x, y, 13);
  glow.addColorStop(0, `rgba(34,211,238,${(0.40*pulse).toFixed(3)})`); glow.addColorStop(1, 'rgba(34,211,238,0)');
  ctx.beginPath(); ctx.arc(x, y, 13, 0, Math.PI*2); ctx.fillStyle = glow; ctx.fill();
  ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI*2); ctx.fillStyle = '#22d3ee'; ctx.fill();
  ctx.beginPath(); ctx.arc(x, y, 1.8, 0, Math.PI*2); ctx.fillStyle = '#f8fafc'; ctx.fill();
}

function drawMarkers(ctx, phases, w, h, selId, hoverIdx, tick) {
  phases.forEach((ph, i) => {
    const {x, y} = getPathPt(ph.t, w, h);
    const isSel = ph.id === selId;
    const pulse = isSel ? 1 + 0.14 * Math.sin(tick * 3) : 1;
    ctx.beginPath(); ctx.arc(x, y, (isSel ? 9 : 6) * pulse, 0, Math.PI*2);
    ctx.strokeStyle = isSel ? ph.color : ph.color + '66'; ctx.lineWidth = isSel ? 2 : 1; ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y, i === hoverIdx ? 4.5 : 3, 0, Math.PI*2);
    ctx.fillStyle = ph.color; ctx.fill();
  });
}

function approxDist(t) {
  if (t < 0.42) return Math.round(400 + (t / 0.42) * 362600);
  if (t < 0.55) return Math.round(363000 + ((t - 0.42) / 0.13) * 87000);
  return Math.round(Math.max(400, 450000 - ((t - 0.55) / 0.45) * 449600));
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function Artemis2() {
  const navigate = useNavigate();
  const canvasRef = useRef(null);
  const animRef   = useRef(null);
  const starsRef  = useRef(null);
  const pathRef   = useRef(null);
  const stRef     = useRef({ prog: 0, playing: true, spd: 0.28, tick: 0 });
  const selIdRef  = useRef(PHASES[0].id);
  const hoverRef  = useRef(-1);

  const [selPhase, setSelPhaseState] = useState(PHASES[0]);
  const [playing, setPlaying]        = useState(true);
  const [spd, setSpd]                = useState(0.28);
  const [tab, setTab]                = useState('mission');

  const setSelPhase = (p) => { selIdRef.current = p.id; setSelPhaseState(p); };

  useEffect(() => {
    document.title = 'Artemis 2 — Mission Viz';
    return () => { document.title = 'Arcade Vault'; };
  }, []);

  useEffect(() => { stRef.current.playing = playing; }, [playing]);
  useEffect(() => { stRef.current.spd = spd; }, [spd]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      canvas.width  = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      starsRef.current = mkStars(w, h);
      pathRef.current  = buildPath(w, h);
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    let last = performance.now();
    const frame = (now) => {
      animRef.current = requestAnimationFrame(frame);
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      const st = stRef.current;
      st.tick += dt;
      if (st.playing) st.prog = (st.prog + dt * st.spd * 0.04) % 1;

      const dpr = window.devicePixelRatio || 1;
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;

      ctx.clearRect(0, 0, w, h);

      const bg = ctx.createLinearGradient(0, 0, w, h);
      bg.addColorStop(0, '#020817'); bg.addColorStop(1, '#030c1b');
      ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);

      if (starsRef.current) drawStars(ctx, starsRef.current, st.tick);

      const er = h * 0.23;
      drawEarth(ctx, er * 0.12, h * 0.78, er);

      const mr = h * 0.115;
      drawMoon(ctx, w * 0.56, h * 0.36, mr);

      if (pathRef.current) {
        const pts = pathRef.current;
        drawTraj(ctx, pts, st.prog);
        const idx = Math.min(Math.floor(st.prog * (pts.length - 1)), pts.length - 1);
        drawCraft(ctx, pts, idx, st.tick);

        const {x, y} = pts[idx];
        const dist = approxDist(st.prog);
        ctx.font = '400 8.5px "JetBrains Mono", monospace';
        ctx.fillStyle = 'rgba(34,211,238,0.72)';
        ctx.textAlign = 'left';
        ctx.fillText(`${dist.toLocaleString()} km`, x + 11, y - 4);
      }

      drawMarkers(ctx, PHASES, w, h, selIdRef.current, hoverRef.current, st.tick);

      ctx.font = '500 9px "JetBrains Mono", monospace';
      ctx.fillStyle = 'rgba(100,116,139,0.75)';
      ctx.textAlign = 'center';
      const er2 = h * 0.23;
      ctx.fillText('EARTH', er2 * 0.12 + er2 * 0.6, h * 0.78 - er2 - 7);
      ctx.fillText('MOON', w * 0.56, h * 0.36 - mr * 1.48 - 7);
    };

    animRef.current = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(animRef.current); ro.disconnect(); };
  }, []);

  const toXY = useCallback((e) => {
    const c = canvasRef.current;
    if (!c) return null;
    const r = c.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    return {
      x: (e.clientX - r.left) * (c.width / r.width) / dpr,
      y: (e.clientY - r.top)  * (c.height / r.height) / dpr,
    };
  }, []);

  const hitPhase = useCallback((cx, cy) => {
    const c = canvasRef.current;
    if (!c) return -1;
    const dpr = window.devicePixelRatio || 1;
    const w = c.width / dpr, h = c.height / dpr;
    for (let i = 0; i < PHASES.length; i++) {
      const {x, y} = getPathPt(PHASES[i].t, w, h);
      if ((cx - x) ** 2 + (cy - y) ** 2 <= 16 ** 2) return i;
    }
    return -1;
  }, []);

  const onCanvasClick = useCallback((e) => {
    const pt = toXY(e);
    if (!pt) return;
    const i = hitPhase(pt.x, pt.y);
    if (i >= 0) { setSelPhase(PHASES[i]); setTab('mission'); }
  }, [toXY, hitPhase]);

  const onCanvasMove = useCallback((e) => {
    const pt = toXY(e);
    if (!pt) return;
    const i = hitPhase(pt.x, pt.y);
    hoverRef.current = i;
    if (canvasRef.current) canvasRef.current.style.cursor = i >= 0 ? 'pointer' : 'default';
  }, [toXY, hitPhase]);

  return (
    <div className="a2-page">

      <div className="a2-header">
        <button className="game-back-btn" onClick={() => navigate('/games')}>← ARCADE</button>
        <div className="a2-header-mid">
          <span className="a2-sys">// NASA · ARTEMIS PROGRAM · INTERACTIVE MISSION VIZ</span>
          <h1 className="a2-title">ARTEMIS <span className="a2-ii">II</span></h1>
          <p className="a2-sub">FIRST CREWED LUNAR FLYBY · 4 CREW · ~10 DAYS</p>
        </div>
        <div className="a2-header-right">
          <span className="a2-dot" />
          <span className="a2-live">MISSION VIZ</span>
        </div>
      </div>

      <div className="a2-canvas-wrap">
        <canvas
          ref={canvasRef}
          className="a2-canvas"
          onClick={onCanvasClick}
          onMouseMove={onCanvasMove}
        />
      </div>

      <div className="a2-controls">
        <button className="a2-ctrl-btn" onClick={() => setPlaying(p => !p)}>
          {playing ? '⏸ PAUSE' : '▶ PLAY'}
        </button>
        <div className="a2-speed-row">
          <span className="a2-ctrl-label">SPEED</span>
          {[[0.28,'1×'],[0.56,'2×'],[1.12,'4×']].map(([v, l]) => (
            <button key={v} className={`a2-spd-btn${spd === v ? ' a2-spd-btn--on' : ''}`} onClick={() => setSpd(v)}>{l}</button>
          ))}
        </div>
        <span className="a2-ctrl-hint">Click waypoints on the canvas to explore phases</span>
      </div>

      <div className="a2-info">
        <div className="a2-tabs">
          {[['mission','MISSION PHASES'],['crew','CREW'],['stats','MISSION STATS']].map(([id, lbl]) => (
            <button key={id} className={`a2-tab${tab === id ? ' a2-tab--on' : ''}`} onClick={() => setTab(id)}>{lbl}</button>
          ))}
        </div>

        {tab === 'mission' && (
          <div className="a2-mission-panel">
            <div className="a2-phase-card">
              <div className="a2-phase-head">
                <span className="a2-phase-icon">{selPhase.icon}</span>
                <div>
                  <p className="a2-phase-badge" style={{color: selPhase.color}}>{selPhase.label}</p>
                  <h2 className="a2-phase-title">{selPhase.title}</h2>
                  <p className="a2-phase-date">{selPhase.date}</p>
                </div>
              </div>
              <p className="a2-phase-desc">{selPhase.desc}</p>
              <div className="a2-telemetry">
                <span className="a2-tele-label">// TELEMETRY</span>
                <p className="a2-tele-text">{selPhase.detail}</p>
              </div>
            </div>
            <div className="a2-phase-nav">
              {PHASES.map(p => (
                <button
                  key={p.id}
                  className={`a2-nav-pip${p.id === selPhase.id ? ' a2-nav-pip--on' : ''}`}
                  style={{'--c': p.color}}
                  onClick={() => setSelPhase(p)}
                  title={p.title}
                />
              ))}
            </div>
          </div>
        )}

        {tab === 'crew' && (
          <div className="a2-crew-grid">
            {CREW.map(m => (
              <div key={m.name} className="a2-crew-card" style={{'--cc': m.color}}>
                <div className="a2-crew-head">
                  <span className="a2-crew-flag">{m.flag}</span>
                  <div>
                    <p className="a2-crew-name">{m.name}</p>
                    <p className="a2-crew-role">{m.role} · <span style={{color: m.color}}>{m.agency}</span></p>
                  </div>
                </div>
                <p className="a2-crew-bio">{m.bio}</p>
              </div>
            ))}
          </div>
        )}

        {tab === 'stats' && (
          <div className="a2-stats-grid">
            {STATS.map(s => (
              <div key={s.label} className="a2-stat-card">
                <p className="a2-stat-val" style={{color: `var(--${s.color})`}}>{s.value}</p>
                <p className="a2-stat-label">{s.label}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <footer className="a2-footer">
        <p>// ARTEMIS 2 INTERACTIVE MISSION VISUALIZATION · DATA SOURCED FROM NASA MISSION DOCUMENTATION</p>
      </footer>
    </div>
  );
}
