import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Scene from './Scene';
import { createGame, DRILLS, speedKn, score as scoreOf } from './game.js';
import { KN, NOTCHES, notchLabel } from './physics.js';
import { PRESETS } from './world.js';
import { TASKS, CRITERIA, PASS_MARK, TOTAL } from './criteria.js';
import { TH } from './thresholds.js';
import { LOGON_FIELDS, LOGOFF_FIELDS, buildCall } from './radio.js';
import { activeHotspots, hotspotLabel } from './hotspots.js';
import { pg } from '../kit/pg';
import './sim.css';

/* /skippers/practical/drive — the RST practical simulator.
   Assessment = one continuous run in a realistic order, sheet hidden until
   the end; Drills = one task, instant retry, optional ghost path. */

const PHASE_TASK = { t2: 2, t3: 3, t4: 4, t5: 5, t6: 6, t7: 7, t8: 8, t9: 9, t10: 10, t11: 11, cruise: null };

export default function SimApp() {
  const [layout, setLayout] = useState(null);
  const [run, setRun] = useState(null); // { mode, task, preset, seed }
  const [menu, setMenu] = useState({ mode: 'assessment', task: 9, preset: 'morning', ghost: true });
  useEffect(() => {
    let off = false;
    fetch('/skippers-sim/venue-layout.json').then((r) => (r.ok ? r.json() : null)).then((j) => { if (!off) setLayout(j ?? false); }).catch(() => { if (!off) setLayout(false); });
    return () => { off = true; };
  }, []);
  if (layout === null) return <p className="sk-stage__cap">Loading the ramp…</p>;
  if (!run) return <Menu menu={menu} setMenu={setMenu} onGo={(m) => setRun({ ...m, seed: (Date.now() % 100000) + 1 })} />;
  return <Game key={`${run.mode}-${run.task}-${run.seed}`} layout={layout || undefined} run={run} onExit={() => setRun(null)} onRetry={() => setRun({ ...run, seed: run.seed + 1 })} />;
}

/* ---------------- menu ---------------- */
function Menu({ menu, setMenu, onGo }) {
  const set = (k, v) => setMenu({ ...menu, [k]: v });
  return (
    <section className="sim-menu">
      <div className="sim-menu__hero">
        <p className="sk-mono sim-kicker">Palm Beach ramp · Rockingham · game conditions</p>
        <h2 className="sim-menu__title">Drive the practical</h2>
        <p className="sim-menu__lede">A 5.5 m outboard on the centre jetty. Eleven tasks, 62 criteria, scored the way the workbook says. You can miss six.</p>
      </div>
      <div className="sim-menu__grid">
        <div>
          <p className="sim-label">Mode</p>
          <div className="sk-seg" role="group" aria-label="Mode">
            <button type="button" aria-pressed={menu.mode === 'assessment'} onClick={() => set('mode', 'assessment')}>Assessment</button>
            <button type="button" aria-pressed={menu.mode === 'drill'} onClick={() => set('mode', 'drill')}>Drills</button>
          </div>
          {menu.mode === 'drill' && (
            <ol className="sim-drills">
              {DRILLS.map((d) => (
                <li key={d.id}>
                  <button type="button" aria-pressed={menu.task === d.task} onClick={() => set('task', d.task)}>
                    <span className="sk-mono">{String(d.task).padStart(2, '0')}</span> {d.label}
                  </button>
                </li>
              ))}
            </ol>
          )}
          {menu.mode === 'assessment' && <p className="sim-note">One run: lines → briefing → pre-start → log on → depart → transit → stop → man overboard (any time) → dock → log off. Task 1 is watched the whole way. Scoresheet at the end.</p>}
        </div>
        <div>
          <p className="sim-label">Conditions <span className="sim-game">game conditions</span></p>
          <div className="sk-seg" role="group" aria-label="Conditions">
            {Object.entries(PRESETS).map(([k, p]) => <button key={k} type="button" aria-pressed={menu.preset === k} onClick={() => set('preset', k)}>{p.label}</button>)}
          </div>
          {menu.mode === 'drill' && (
            <label className="sim-check"><input type="checkbox" checked={menu.ghost} onChange={(e) => set('ghost', e.target.checked)} /> Show the textbook path (ghost line)</label>
          )}
          <Controls />
        </div>
      </div>
      <button type="button" className="sk-btn sk-btn--primary sim-go" onClick={() => onGo(menu)}>{menu.mode === 'assessment' ? 'Start the assessment' : `Start drill: ${DRILLS.find((d) => d.task === menu.task)?.label}`}</button>
    </section>
  );
}

function Controls() {
  const rows = [['W / S', 'lever one notch (R2 R1 N F1…F6) — it stays put'], ['A / D', 'turn the wheel (holds) · C centres'], ['Mouse', 'look around (click the view to lock) — that’s your head-check'], ['Space', 'shout the call for the moment'], ['E', 'use what you’re looking at · 1–4 answer'], ['Tab', 'radio · V helm/chase view · G ghost · H labels'], ['Pad', 'stick steers · D-pad/bumpers lever · A use · B shout']];
  return (
    <dl className="sim-keys">
      {rows.map(([k, v]) => <div key={k}><dt className="sk-mono">{k}</dt><dd>{v}</dd></div>)}
    </dl>
  );
}

/* ---------------- the game ---------------- */
function Game({ layout, run, onExit, onRetry }) {
  const G = useMemo(() => createGame({ layout, mode: run.mode, task: run.task, preset: run.preset, seed: run.seed }), [layout, run]);
  const Gref = useRef(G); Gref.current = G;
  const ui = useRef({ look: { yaw: 0, pitch: -0.08 }, view: 'helm', hsActive: [], aim: null });
  const [, force] = useState(0);
  const [aim, setAim] = useState(null);
  const [radioOpen, setRadioOpen] = useState(false);
  const [hints, setHints] = useState(run.mode === 'drill');
  const [ghost, setGhost] = useState(run.mode === 'drill' && run.ghost);
  const [venueOk, setVenueOk] = useState(true);
  const [ready, setReady] = useState({});
  const [fps, setFps] = useState(0);
  const wrap = useRef(null);
  const g = G.g;

  ui.current.onReady = useCallback((k) => setReady((r) => (r[k] ? r : { ...r, [k]: true })), []);
  ui.current.hsActive = activeHotspots(g.phase, g);
  ui.current.beforeTick = () => G.cmd({ t: 'look', yaw: ui.current.look.yaw });

  // HUD refresh ~12 Hz + fps sample
  useEffect(() => {
    let frames = 0; let last = performance.now(); let raf;
    const loop = () => { frames++; raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    const id = setInterval(() => {
      force((n) => n + 1);
      const now = performance.now(); if (now - last > 1000) { const f = Math.round((frames * 1000) / (now - last)); setFps(f); frames = 0; last = now; window.__simFps = (window.__simFps ?? []).concat(f).slice(-20); }
    }, 80);
    window.__sim = G;
    if (wrap.current) window.scrollTo({ top: Math.max(0, wrap.current.getBoundingClientRect().top + window.scrollY - 100), behavior: 'instant' });
    return () => { clearInterval(id); cancelAnimationFrame(raf); };
  }, [G]);
  useEffect(() => { window.__simReady = ready; }, [ready]);

  // keyboard
  useEffect(() => {
    const isField = (e) => ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target?.tagName);
    const down = (e) => {
      if (isField(e)) { if (e.key === 'Escape' || (e.key === 'Tab' && radioOpen && e.shiftKey && false)) setRadioOpen(false); return; }
      const k = e.key.toLowerCase();
      if (k === 'tab') { e.preventDefault(); setRadioOpen((o) => !o); return; }
      if (radioOpen) return;
      if ([' ', 'w', 's', 'a', 'd', 'e', 'c'].includes(k)) e.preventDefault();
      if (e.repeat && ['w', 's', ' ', 'e', 'c', 'v', 'g', 'h'].includes(k)) return;
      if (k === 'w' || k === 'arrowup') G.cmd({ t: 'lever', d: +1 });
      else if (k === 's' || k === 'arrowdown') G.cmd({ t: 'lever', d: -1 });
      else if (k === 'a' || k === 'arrowleft') G.cmd({ t: 'wheel', dir: -1 });
      else if (k === 'd' || k === 'arrowright') G.cmd({ t: 'wheel', dir: 1 });
      else if (k === 'c') G.cmd({ t: 'centre' });
      else if (k === ' ') G.cmd({ t: 'shout' });
      else if (k === 'e') interact();
      else if (k === 'v') ui.current.view = ui.current.view === 'helm' ? 'chase' : 'helm';
      else if (k === 'g') setGhost((x) => !x);
      else if (k === 'h') setHints((x) => !x);
      else if (/^[1-4]$/.test(k)) pickOption(Number(k) - 1);
    };
    const up = (e) => { const k = e.key.toLowerCase(); if (['a', 'd', 'arrowleft', 'arrowright'].includes(k)) G.cmd({ t: 'wheel', dir: 0 }); };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  });

  // gamepad (polled)
  useEffect(() => {
    let raf; const prev = {};
    const poll = () => {
      raf = requestAnimationFrame(poll);
      const pads = navigator.getGamepads?.() ?? []; const p = [...pads].find(Boolean); if (!p) return;
      const x = p.axes[0] ?? 0; G.cmd({ t: 'wheel', dir: Math.abs(x) > 0.25 ? x : 0 });
      const rx = p.axes[2] ?? 0; const ry = p.axes[3] ?? 0;
      if (Math.abs(rx) > 0.15) ui.current.look.yaw = clampYaw(ui.current.look.yaw + rx * 0.05);
      if (Math.abs(ry) > 0.15) ui.current.look.pitch = Math.max(-0.9, Math.min(0.6, ui.current.look.pitch - ry * 0.03));
      const edge = (i) => { const v = !!p.buttons[i]?.pressed; const was = prev[i]; prev[i] = v; return v && !was; };
      if (edge(12) || edge(5)) G.cmd({ t: 'lever', d: +1 });
      if (edge(13) || edge(4)) G.cmd({ t: 'lever', d: -1 });
      if (edge(0)) interact();
      if (edge(1)) G.cmd({ t: 'shout' });
      if (edge(3)) setRadioOpen((o) => !o);
    };
    raf = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(raf);
  });

  const interact = () => {
    const pr = G.g.prompt;
    if (pr?.key === 'retrieve') { G.cmd({ t: 'choose', key: 'retrieve', value: true }); return; }
    if (ui.current.aim) G.cmd({ t: 'hs', id: ui.current.aim });
  };
  const pickOption = (i) => {
    const pr = G.g.prompt; const o = pr?.options?.[i]; if (!o) return;
    G.cmd({ t: 'choose', key: pr.key, value: o.value });
  };

  // mouse look (pointer lock, or drag as a fallback)
  const drag = useRef(null);
  const onPointerDown = (e) => {
    if (e.target.closest?.('.sim-tag, .sim-hud button, .sim-radio')) return;
    const el = wrap.current?.querySelector('canvas');
    if (el && document.pointerLockElement !== el) el.requestPointerLock?.()?.catch?.(() => {});
    drag.current = { x: e.clientX, y: e.clientY };
  };
  useEffect(() => {
    const mv = (e) => {
      const locked = !!document.pointerLockElement;
      if (!locked && !drag.current) return;
      const dx = locked ? e.movementX : e.clientX - drag.current.x; const dy = locked ? e.movementY : e.clientY - drag.current.y;
      if (!locked) drag.current = { x: e.clientX, y: e.clientY };
      ui.current.look.yaw = clampYaw(ui.current.look.yaw + dx * 0.0042);
      ui.current.look.pitch = Math.max(-0.9, Math.min(0.6, ui.current.look.pitch - dy * 0.0035));
    };
    const upm = () => { drag.current = null; };
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', upm);
    return () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', upm); };
  }, []);

  const sc = g.ended ? scoreOf(g) : null;
  return (
    <section className="sim" ref={wrap}>
      <div className="sim-view" onPointerDown={onPointerDown}>
        <Scene G={Gref} ui={ui} onAim={setAim} hints={hints} ghost={ghost} venueOk={venueOk} setVenueOk={setVenueOk} layout={g.W.layout} tick={g.phase} />
        <Hud G={G} aim={aim} fps={fps} run={run} ui={ui} hints={hints} pickOption={pickOption} />
        {radioOpen && !g.ended && <Radio G={G} onClose={() => setRadioOpen(false)} />}
        {sc && <Scoresheet sc={sc} run={run} onExit={onExit} onRetry={onRetry} />}
      </div>
      <div className="sim-bar">
        <button type="button" className="sk-btn sk-btn--small" onClick={onExit}>← Menu</button>
        <button type="button" className="sk-btn sk-btn--small" onClick={onRetry}>Restart</button>
        <button type="button" className="sk-btn sk-btn--small" onClick={() => wrap.current?.requestFullscreen?.()}>Full screen</button>
        <span className="sim-bar__meta sk-mono">{g.cond.label} · wind {Math.round(g.cond.windKn)} kn from {Math.round(g.cond.windFromDeg)}° · current {g.cond.currentKn.toFixed(1)} kn · <span className="sim-game">game conditions</span>{g.W.layout.provisional ? ' · provisional layout' : ''}</span>
      </div>
    </section>
  );
}
const clampYaw = (y) => Math.max(-Math.PI, Math.min(Math.PI, y));

/* ---------------- HUD ---------------- */
function Hud({ G, aim, fps, run, ui, hints, pickOption }) {
  const g = G.g; const b = g.boat; const kn = speedKn(b);
  const task = PHASE_TASK[g.phase]; const T = TASKS.find((t) => t.task === task);
  const windTo = Math.atan2(g.cond.wind[0], g.cond.wind[1]);
  const hdgDeg = ((b.psi * 180) / Math.PI + 360) % 360;
  const xte = g.phase === 't8' && g.ph.xte !== undefined ? g.ph : null;
  return (
    <div className="sim-hud">
      <div className="sim-cap">
        <p className="sim-cap__task sk-mono">{run.mode === 'assessment' ? 'Assessment' : 'Drill'} · {T ? `Task ${task}: ${T.short}` : g.phase === 'cruise' ? 'Under way' : 'Done'}</p>
        <p className="sim-cap__say">{g.caption}</p>
        {xte && <p className="sim-cap__meta sk-mono">On transit {xte.hold.toFixed(0)} s / 30 · off line {xte.xte.toFixed(0)} m</p>}
        {g.phase === 't9' && g.ph.start === null && <p className="sim-cap__meta sk-mono">{g.ph.armed >= 2 ? 'at speed — stop when ready' : 'get to about 5 kn'}</p>}
      </div>

      <ul className="sim-log" aria-live="polite">
        {g.toasts.slice(-4).map((t) => <li key={`${t.t}-${t.text}`} className={`sim-log__${t.kind}`}><span className={`sk-dot sk-dot--${t.kind === 'ok' ? 'ok' : t.kind === 'bad' ? 'bad' : t.kind === 'warn' ? 'warn' : 'info'}`} />{t.text}</li>)}
      </ul>

      <div className="sim-instr">
        <div className="sim-instr__speed"><span className="sim-big">{kn.toFixed(1)}</span><span className="sk-mono">kn</span>{g.zone && <span className={`sim-zone sk-mono${kn > g.zone.limit ? ' sim-zone--over' : ''}`} title={g.zone.receipt}>{g.zone.limit} kn zone</span>}</div>
        <Compass hdg={hdgDeg} windTo={windTo} psi={b.psi} />
        <div className="sim-instr__rpm sk-mono">{b.running ? `${Math.round(b.rpm / 10) * 10} rpm` : 'engine off'}</div>
      </div>

      <div className="sim-binnacle" aria-label={`Lever ${notchLabel(b.gear)}`}>
        <ol className="sim-lever">
          {[...NOTCHES].reverse().map((n) => <li key={n} className={`${n === notchLabel(b.gear) ? 'on' : ''} ${n === 'N' ? 'n' : ''} ${n[0] === 'R' ? 'r' : ''}`}>{n}</li>)}
        </ol>
        <div className="sim-wheel"><svg viewBox="-50 -50 100 60" width="110" height="66" aria-hidden="true"><path d="M-40 0 A40 40 0 0 1 40 0" fill="none" stroke="currentColor" strokeOpacity="0.3" strokeWidth="6" /><line x1="0" y1="0" x2={Math.sin(b.wheel * 1.3) * 38} y2={-Math.cos(b.wheel * 1.3) * 38} stroke="currentColor" strokeWidth="4" strokeLinecap="round" /><circle r="5" fill="currentColor" /></svg><span className="sk-mono">wheel {b.wheel > 0.05 ? `${Math.round(b.wheel * 100)}% stbd` : b.wheel < -0.05 ? `${Math.round(-b.wheel * 100)}% port` : 'centred'}</span></div>
      </div>

      <div className="sim-prompt">
        {aim && <p className="sim-aim sk-mono"><kbd>E</kbd> {hotspotLabel(aim)}</p>}
        {g.prompt && (
          <div className="sim-ask">
            <p className="sim-label">{g.prompt.label}</p>
            {g.prompt.options.map((o, i) => <button key={String(o.value)} type="button" className="sk-btn sk-btn--small" onClick={() => pickOption(i)}><span className="sk-mono">{i + 1}</span> {o.text}</button>)}
          </div>
        )}
        {(g.phase === 't5' || g.phase === 't11') && !g.ended && <p className="sim-aim sk-mono"><kbd>Tab</kbd> open the radio</p>}
      </div>
      <div className="sim-fps sk-mono">{fps} fps · look {Math.round((ui.current.look.yaw * 180) / Math.PI)}°{hints ? '' : ' · H for labels'}</div>
      <div className="sim-cross" aria-hidden="true" />
    </div>
  );
}

function Compass({ hdg, windTo, psi }) {
  const rel = windTo - psi;
  return (
    <svg className="sim-compass" viewBox="-40 -40 80 80" width="86" height="86" aria-label={`Heading ${Math.round(hdg)}°`}>
      <circle r="34" fill="none" stroke="currentColor" strokeOpacity="0.35" />
      <g transform={`rotate(${-hdg})`}>
        {['N', 'E', 'S', 'W'].map((l, i) => <text key={l} x={Math.sin((i * Math.PI) / 2) * 26} y={-Math.cos((i * Math.PI) / 2) * 26 + 4} textAnchor="middle" fontSize="10" fill="currentColor" fontWeight={l === 'N' ? 700 : 400}>{l}</text>)}
      </g>
      <g transform={`rotate(${(rel * 180) / Math.PI})`}><line x1="0" y1="-18" x2="0" y2="16" stroke="var(--chart, #1f5fa8)" strokeWidth="3" /><path d="M-6 9 L0 18 L6 9" fill="var(--chart, #1f5fa8)" /></g>
      <text y="-30" textAnchor="middle" fontSize="9" fill="currentColor">{String(Math.round(hdg)).padStart(3, '0')}°</text>
      <text y="38" textAnchor="middle" fontSize="7" fill="currentColor" opacity="0.7">wind →</text>
    </svg>
  );
}

/* ---------------- radio ---------------- */
function Radio({ G, onClose }) {
  const kind = G.g.phase === 't11' ? 'logoff' : 'logon';
  const fields = kind === 'logoff' ? LOGOFF_FIELDS : LOGON_FIELDS;
  const [a, setA] = useState(() => (kind === 'logoff' ? { vessel: G.g.radio.logon?.answers?.vessel ?? '' } : {}));
  const first = useRef(null);
  useEffect(() => { first.current?.focus(); }, []);
  const send = (e) => { e.preventDefault(); G.cmd({ t: 'radio', kind, answers: a }); onClose(); };
  const lines = buildCall(kind, a);
  return (
    <form className="sim-radio" onSubmit={send} onKeyDown={(e) => { if (e.key === 'Escape') onClose(); e.stopPropagation(); }}>
      <div className="sim-radio__head"><h3>{kind === 'logoff' ? 'Log off' : 'Log on'} · Marine Rescue</h3><span className="sk-receipt">{pg(kind === 'logoff' ? 112 : [97, 98])}</span></div>
      <div className="sim-radio__grid">
        {fields.map((f, i) => (
          <label key={f.key}><span className="sim-label">{f.label}</span>
            <input ref={i === 0 ? first : undefined} value={a[f.key] ?? ''} placeholder={f.placeholder} onChange={(e) => setA({ ...a, [f.key]: e.target.value })} />
          </label>
        ))}
      </div>
      <div className="sim-radio__call">{lines.map((l) => <p key={l}>{l}</p>)}</div>
      <div className="sim-radio__foot">
        <button type="submit" className="sk-btn sk-btn--primary sk-btn--small">Send call</button>
        <button type="button" className="sk-btn sk-btn--small" onClick={onClose}>Close (Esc)</button>
        <span className="sim-note">Real clock times (0815 or 8.15 am), fuel in litres. “Soon”, “plenty” and “a couple of hours” don’t count.</span>
      </div>
    </form>
  );
}

/* ---------------- scoresheet ---------------- */
function Scoresheet({ sc, run, onExit, onRetry }) {
  const byTask = TASKS.map((t) => ({ t, rows: sc.rows.filter((r) => r.task === t.task) })).filter((x) => x.rows.length);
  const assessment = run.mode === 'assessment';
  return (
    <div className="sim-sheet" role="dialog" aria-label="Scoresheet">
      <div className="sim-sheet__inner">
        <header className="sim-sheet__head">
          <div>
            <p className="sk-mono sim-kicker">{assessment ? 'Assessment scoresheet' : 'Drill result'} · Workbook ch.10</p>
            <p className="sim-sheet__score"><span>{sc.got}</span>/{sc.total}{sc.na ? <small> incl. {sc.na} N/A</small> : null}</p>
            <p className={`sk-dot ${sc.passed ? 'sk-dot--ok' : 'sk-dot--bad'}`}>{sc.unsafe ? `Stopped — unsafe: ${sc.unsafe.why}` : assessment ? (sc.passed ? `Pass — ${sc.wrong} wrong (six or fewer allowed; pass = ${PASS_MARK}/${TOTAL}).` : `Not a pass — ${sc.wrong} wrong; you can miss six.`) : sc.wrong ? `${sc.wrong} to work on.` : 'Clean — every criterion met.'}</p>
          </div>
          <div className="sim-sheet__btns">
            <button type="button" className="sk-btn sk-btn--primary" onClick={onRetry}>Go again</button>
            <button type="button" className="sk-btn" onClick={onExit}>Menu</button>
          </div>
        </header>
        <div className="sim-sheet__body">
          {byTask.map(({ t, rows }) => (
            <section key={t.task} className="sim-sheet__task">
              <h4><span className="sk-mono">{String(t.task).padStart(2, '0')}</span> {t.title} <span className="sk-receipt">{pg(t.page)}</span></h4>
              <ul>
                {rows.map((r) => (
                  <li key={r.id} className={`sim-row sim-row--${r.s}`}>
                    <span className={`sk-dot sk-dot--${r.s === 'pass' ? 'ok' : r.s === 'na' ? 'info' : 'bad'}`}>{r.s === 'pass' ? 'met' : r.s === 'na' ? 'N/A' : 'missed'}</span>
                    <span className="sim-row__id sk-mono">{r.id}</span>
                    <span className="sim-row__text">{r.text}<em>{r.why}</em>{r.threshold && TH[r.threshold] && <small className={TH[r.threshold].source === 'game' ? 'sim-game' : ''}>{TH[r.threshold].uiLabel}</small>}</span>
                    <span className="sk-receipt">{pg(r.page)}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

