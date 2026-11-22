/* The game loop + criteria engine (pure JS, runs in Node for the checks).
   Physics: ./physics.js. Venue/conditions: ./world.js. The 62 criteria and
   every number: ./criteria.js + ./thresholds.js (workbook vs game thresholds).

   Usage:  const g = createGame({ layout, mode: 'assessment' | 'drill', task, preset, seed });
           g.cmd({ t: 'lever', d: -1 }); g.tick();  // 60 Hz
   Commands: lever{d} · wheel{dir} · centre · look{yaw} (rad, + = starboard,
   ±π = astern) · shout · hs{id} · choose{key,value} · radio{kind,answers} ·
   engineOff · next. */

import { makeBoat, step, DT, KN, BOAT, toWorld, fwd, wrapPi, rng, RPM_CLUNK, RPM_CHURN, notchLabel, prepCollider, velWorld, hullWorld as hullWorldPts } from './physics.js';
import { buildWorld, makeConditions, distToPoly, boatPoly } from './world.js';
import { CRITERIA, TASKS, UNSAFE, PASS_MARK, TOTAL } from './criteria.js';
import { TH } from './thresholds.js';
import * as CAP from './captions.js';
import * as RADIO from './radio.js';
import { LOCAL_RULES } from './localRules.js';

const D = Math.PI / 180;
const th = (k, def) => { const v = TH[k]?.value; return v === undefined ? def : v; };
const BL = () => th('boatLength', BOAT.L);
const cap = (key, def) => {
  const c = CAP.CAPTIONS?.[key];
  if (Array.isArray(c)) return c.join(' ');
  if (typeof c === 'string') return c;
  if (c && typeof c === 'object') return c.start ?? c.ask ?? Object.values(c)[0];
  return def;
};

export const DRILLS = [
  { task: 2, id: 't2', label: 'Check the lines and secure' },
  { task: 3, id: 't3', label: 'Safety briefing' },
  { task: 4, id: 't4', label: 'Pre-start and start' },
  { task: 5, id: 't5', label: 'Log on' },
  { task: 6, id: 't6', label: 'Depart the berth' },
  { task: 8, id: 't8', label: 'Steer a transit' },
  { task: 9, id: 't9', label: 'Controlled stop' },
  { task: 7, id: 't7', label: 'Person overboard' },
  { task: 10, id: 't10', label: 'Dock the boat' },
  { task: 11, id: 't11', label: 'Log off' },
];
const ASSESSMENT = ['t2', 't3', 't4', 't5', 't6', 't8', 't9', 'cruise', 't7', 't10', 't11'];

export const FUEL_L = 75; // the boat's tank reads about 75 L (game value)
export const LINE_IDS = ['bow', 'stern', 'spring'];

export function createGame(opts = {}) {
  const { layout, mode = 'assessment', task = 9, preset = 'morning', seed = 1 } = opts;
  const W = buildWorld(layout);
  const cond = opts.conditions ?? makeConditions(preset, seed);
  const R = rng(seed * 31 + 7);
  const g = {
    mode, task, seed, W, cond, t: 0,
    boat: makeBoat(), env: { wind: cond.wind, current: cond.current, colliders: W.colliders },
    phases: mode === 'assessment' ? [...ASSESSMENT] : [`t${task}`], pi: 0, phase: null, ph: {},
    res: {}, unsafe: null, ended: false, caption: '', prompt: null, log: [], toasts: [],
    lines: {}, inspected: new Set(), hsLog: [], cleared: new Set(),
    look: 0, lookHist: [], shoutLog: [],
    lever: { lastSign: 0, nAt: 0, changes: [] },
    passengers: { seated: true, handsIn: false },
    mob: null, traffic: [], strikes: { t11: 0, t12: 0 }, over: { t11: 0, t12: 0 },
    radio: {}, frayed: LINE_IDS[Math.floor(R() * 3)], bagOnIntake: R() < 0.4, swimmerAtProp: R() < 0.35,
    mobDelay: 4 + R() * 12, R, ghost: null,
    criteria: CRITERIA, tasks: TASKS,
  };
  if (mode === 'drill') g.frayed = task === 2 ? LINE_IDS[Math.floor(R() * 3)] : null;
  for (const c of CRITERIA) if (c.kind === 'na') g.res[c.id] = { s: 'na', why: c.how };
  // T1 starts met; strikes can take it away
  setupStart(g);
  enterPhase(g);
  return {
    g,
    cmd: (c) => command(g, c),
    tick: () => tick(g),
    run: (secs, c) => { for (let i = 0; i < Math.round(secs * 60); i++) { if (c) command(g, c); tick(g); } },
    score: () => score(g),
  };
}

/* ---------- start positions ---------- */
function berthPose(W, side = 'east') {
  const b = (W.layout.berths ?? []).find((x) => x.id === side) ?? W.berth;
  const [p0, p1] = b.edge; const ex = p1[0] - p0[0]; const ey = p1[1] - p0[1]; const l = Math.hypot(ex, ey);
  const u = [ex / l, ey / l]; const o = b.outward;
  const along = Math.min(l - 4, l * 0.62);
  const off = BOAT.B / 2 + 0.25;
  const x = p0[0] + u[0] * along + o[0] * off; const y = p0[1] + u[1] * along + o[1] * off;
  return { x, y, psi: Math.atan2(u[0], u[1]), edge: b.edge, u, o, side: b.id };
}
function tieUp(g, ids = ['bow', 'stern']) {
  const b = g.boat; const pose = g.berthPose;
  for (const id of ids) {
    const py = id === 'bow' ? 2.3 : id === 'stern' ? -2.3 : 0.4;
    const side = pose.side === 'west' ? 1 : -1; // jetty is to port when on the east side
    const bp = [side * 1.0, py];
    const w = toWorld(b, bp[0], bp[1]);
    const anchor = [w[0] - pose.o[0] * 0.6, w[1] - pose.o[1] * 0.6];
    b.lines[id] = { boatPt: bp, anchor, rest: Math.hypot(anchor[0] - w[0], anchor[1] - w[1]) + 0.25 };
    g.lines[id] = { state: 'tied' };
  }
}
function setupStart(g) {
  const { W } = g; const b = g.boat; const ph = g.phases[0];
  g.berthPose = berthPose(W, 'east');
  const at = (x, y, psi, u = 0, gear = 0, running = false) => { Object.assign(b, { x, y, psi, u, v: 0, r: 0, gear, running, rpm: running ? 700 : 0 }); g.lever.lastSign = Math.sign(gear); };
  for (const id of LINE_IDS) g.lines[id] = { state: 'stowed' };
  if (['t2', 't3', 't4', 't5', 't6', 't11'].includes(ph)) {
    at(g.berthPose.x, g.berthPose.y, g.berthPose.psi);
    tieUp(g, ph === 't2' ? [] : ['bow', 'stern']);
    if (ph === 't2') { tieUp(g, ['bow', 'stern']); for (const id of ['bow', 'stern']) { b.lines[`held_${id}`] = b.lines[id]; delete b.lines[id]; g.lines[id] = { state: 'stowed' }; } } // the assessor holds her alongside until you secure
    if (ph === 't6' || ph === 't11') { b.running = ph === 't6'; b.rpm = ph === 't6' ? 700 : 0; }
  } else {
    const P = W.P;
    if (ph === 't8') { const tr = W.transits[0]; const L = transitLine(tr); const p = [L.p[0] + L.d[0] * 170, L.p[1] + L.d[1] * 170]; at(p[0] + L.n[0] * 6, p[1] + L.n[1] * 6, Math.atan2(-L.d[0], -L.d[1]), 1.4, 1, true); }
    else if (ph === 't9') at(40, 300, 90 * D, 2.55, 2, true); // open water north of the moorings
    else if (ph === 't7') { at(-120, 320, 90 * D, 2.55, 2, true); g.mobDelay = 3 + g.R() * 4; }
    else if (ph === 't10') { const [x, y] = P(75, 18); at(x, y, (W.hdg + 180 - 12) * D, 1.4, 1, true); }
    else { const [x, y] = P(150, 0); at(x, y, W.hdg * D, 0, 0, true); }
  }
}

/* ---------- helpers ---------- */
export function transitLine(tr) {
  const f = [tr.front.x, tr.front.y]; const bk = [tr.back.x, tr.back.y];
  const dx = f[0] - bk[0]; const dy = f[1] - bk[1]; const l = Math.hypot(dx, dy);
  const d = [dx / l, dy / l]; // from back mark → front mark → out to sea
  return { p: f, d, n: [-d[1], d[0]] };
}
const speedKn = (b) => Math.hypot(b.u, b.v) * KN;
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
function say(g, text, kind = 'info') { g.log.push({ t: g.t, text, kind }); g.toasts.push({ t: g.t, text, kind }); if (g.toasts.length > 4) g.toasts.shift(); }
function mark(g, id, ok, why) {
  if (g.res[id]?.s === 'na') return;
  if (ok === null) return;
  const prev = g.res[id];
  if (prev && prev.final) return;
  g.res[id] = { s: ok ? 'pass' : 'miss', why };
}
function fail(g, id, why) { if (g.res[id]?.s === 'na') return; g.res[id] = { s: 'miss', why, final: true }; }
function unsafe(g, key, extra) {
  if (g.unsafe || g.ended) return;
  g.unsafe = { key, why: (UNSAFE[key] ?? key) + (extra ? ` ${extra}` : '') };
  g.ended = true; g.caption = 'Assessment stopped — unsafe.'; say(g, g.unsafe.why, 'bad');
}
function lookedAround(g, window) {
  const t0 = g.t - window; let port = false; let star = false; let aft = false;
  const astern = th('lookAsternYaw', 120) * D;
  for (const s of g.lookHist) {
    if (s.t < t0) continue;
    if (Math.abs(s.yaw) >= astern) aft = true;
    if (s.yaw <= -60 * D) port = true;
    if (s.yaw >= 60 * D) star = true;
  }
  return { aft, both: port && star, any: aft || (port && star) };
}
function nearHazard(g, p) {
  let best = Infinity;
  for (const c of g.W.colliders) if (['jetty', 'shore', 'moored', 'rock', 'ramp', 'closed_ramp', 'pile'].includes(c.kind)) {
    if (c.box[0] - 60 > p[0] || c.box[2] + 60 < p[0] || c.box[1] - 60 > p[1] || c.box[3] + 60 < p[1]) continue;
    best = Math.min(best, distToPoly(p, c.poly));
  }
  return best;
}

/* ---------- commands ---------- */
function command(g, c) {
  if (g.ended && c.t !== 'look') return;
  const b = g.boat;
  switch (c.t) {
    case 'lever': {
      const to = Math.max(-2, Math.min(6, b.gear + c.d));
      if (to === b.gear) return;
      // neutral detent: crossing N always stops in N first (one press = one notch anyway)
      const from = b.gear; b.gear = to;
      onGearChange(g, from, to);
      break;
    }
    case 'wheel': g.wheelDir = c.dir; break;
    case 'wheelTo': b.wheel = Math.max(-1, Math.min(1, c.v)); break;
    case 'centre': b.wheel = 0; g.wheelDir = 0; break;
    case 'look': g.look = wrapPi(c.yaw); break;
    case 'shout': shout(g); break;
    case 'hs': hotspot(g, c.id); break;
    case 'choose': choose(g, c.key, c.value); break;
    case 'radio': radio(g, c.kind, c.answers); break;
    case 'engineOff': engineOff(g); break;
    case 'next': if (g.phase === 'done') return; if (g.ph.canNext) finishPhase(g); break;
    default:
  }
}

function onGearChange(g, from, to) {
  const b = g.boat; const sFrom = Math.sign(from); const sTo = Math.sign(to);
  const L = g.lever;
  if (sTo === 0 && sFrom !== 0) L.nAt = g.t;
  let rough = false;
  if (sTo !== 0 && sFrom !== sTo) {
    // engaging a gear: from N, or straight across
    const inN = sFrom === 0 ? g.t - L.nAt : 0;
    const straight = L.lastSign !== 0 && L.lastSign !== sTo && inN < th('neutralPause', 0.6);
    const clunk = b.running && b.rpm > RPM_CLUNK;
    rough = straight || clunk;
    if (b.running) {
      L.changes.push({ t: g.t, from, to, straight, clunk, rpm: b.rpm });
      if (straight) {
        say(g, 'Clunk — straight from ahead to astern without a pause in neutral.', 'warn'); // scored under T6.6 / T9.4 / T10.6, not T1.3
      }
    }
    L.lastSign = sTo;
  }
  if (b.running && g.lines && LINE_IDS.some((id) => g.lines[id]?.state === 'loose') && sTo !== 0) {
    b.fouled = true; say(g, 'A loose line has wrapped the propeller — the motor stalls.', 'bad');
    fail(g, 'T6.7', 'A line was left trailing and fouled the propeller.');
    fail(g, 'T1.3', 'Propeller fouled by a trailing line.');
    b.running = false; b.gear = 0;
  }
  g.ph.onGear?.(g, from, to, rough);
  if (!b.running && sTo !== 0 && g.phase !== 't4') { /* lever moved with engine off: harmless */ }
}

function shout(g) {
  g.shoutLog.push({ t: g.t, phase: g.phase });
  const txt = g.ph.shout?.(g) ?? defaultShout(g);
  say(g, `You: “${txt}”`, 'you');
}
function defaultShout(g) {
  if (g.mob && !g.mob.retrieved) return `Man overboard, ${g.mob.side} side! Keep pointing at them!`;
  if (g.phase === 't9') return 'Hold on — stopping!';
  if (g.phase === 't10') { g.passengers.handsIn = true; return 'Hands and feet inside the boat — I’ll handle the lines.'; }
  if (!g.passengers.seated) { g.passengers.seated = true; return 'Sit down please — we’re moving.'; }
  return 'Everyone seated and holding on.';
}

function engineOff(g) {
  const b = g.boat;
  if (!b.running) return;
  b.running = false; b.gear = 0; g.lever.lastSign = 0;
  say(g, 'You: “Engine off.” (key off)', 'you');
  g.ph.onEngineOff?.(g);
}

function hotspot(g, id) {
  g.hsLog.push({ t: g.t, id, phase: g.phase });
  g.inspected.add(id);
  const r = g.ph.hs?.(g, id);
  if (r !== undefined) return;
  // general handling
  if (id === 'hs_key') { if (!g.boat.running) startEngine(g); else engineOff(g); return; }
  if (id === 'hs_rego') { say(g, 'Rego sticker on the hull: current.', 'ok'); return; }
  if (id === 'hs_lifejackets' && g.mob && !g.mob.aid) { choose(g, 'mobAid', true); return; }
  if (id.startsWith('hs_line_')) { lineAction(g, id.slice(8)); return; }
}

function lineAction(g, id) {
  const L = g.lines[id]; if (!L) return;
  if (L.state === 'tied') { delete g.boat.lines[id]; L.state = 'loose'; say(g, `${cap1(id)} line cast off — now coil and stow it.`, 'info'); }
  else if (L.state === 'loose') { L.state = 'stowed'; say(g, `${cap1(id)} line coiled and stowed.`, 'ok'); }
  else say(g, `${cap1(id)} line: ${g.frayed === id ? 'badly frayed near the splice — not fit to use.' : 'good condition.'}`, g.frayed === id ? 'warn' : 'ok');
}
const cap1 = (s) => s[0].toUpperCase() + s.slice(1);

function startEngine(g) {
  const b = g.boat;
  if (b.gear !== 0) { unsafe(g, 'startInGear'); return; }
  if (g.swimmerAtProp && !g.cleared.has('swimmer')) { unsafe(g, 'personNearProp'); return; }
  b.running = true; b.rpm = 700; b.fouled = false;
  say(g, 'The motor starts. Telltale is pissing water — cooling is working.', 'ok');
  if (g.bagOnIntake && !g.cleared.has('bag')) { g.overheatAt = g.t + 90; }
  g.ph.onStart?.(g);
}

function choose(g, key, value) {
  const r = g.ph.choose?.(g, key, value);
  if (r !== undefined) return;
  if (key === 'mob') { choose(g, value, true); return; }
  if (g.prompt && g.prompt.key === key && key !== 'mob') g.prompt = null;
  if (key === 'sitDown') { g.passengers.seated = true; say(g, 'You: “Sit down please — we’re under way.”', 'you'); }
  if (key === 'handsIn') { g.passengers.handsIn = true; say(g, 'You: “Hands inside the boat while we come alongside.”', 'you'); }
  if (key === 'mobAid' && g.mob && !g.mob.aid) { g.mob.aid = g.t; say(g, 'You: “Throwing a lifejacket now!”', 'you'); }
  if (key === 'mobWatch' && g.mob && !g.mob.watch) { g.mob.watch = g.t; say(g, 'You: “Keep pointing at them, don’t take your eyes off them.”', 'you'); }
  if (key === 'retrieve') retrieve(g);
}

function radio(g, kind, answers) {
  const ctx = { pob: 3, fuelLitres: FUEL_L, logonVessel: kind === 'logoff' ? g.radio.logon?.answers?.vessel : undefined };
  const out = RADIO.checkRadio ? RADIO.checkRadio(kind, answers, ctx) : {};
  for (const [id, r] of Object.entries(out)) mark(g, id, r.ok, r.why);
  g.radio[kind] = { answers, out };
  const bad = Object.values(out).filter((r) => !r.ok).length;
  say(g, bad ? `Marine Rescue: “Logged.” (${bad} item${bad > 1 ? 's' : ''} won’t count)` : 'Marine Rescue: “Received, thank you. Out.”', bad ? 'warn' : 'ok');
  g.ph.onRadio?.(g, kind);
}

/* ---------- phases ---------- */
function enterPhase(g) {
  const id = g.phases[g.pi];
  g.phase = id; g.ph = { t0: g.t, ...(PHASES[id]?.(g) ?? {}) };
  g.prompt = g.ph.prompt ?? null;
  if (g.ph.caption) g.caption = g.ph.caption;
  g.ghost = g.ph.ghost ?? null;
}
function finishPhase(g) {
  g.ph.exit?.(g);
  const ack = CAP.ACKS?.[g.phase]; if (ack && g.mode === 'assessment') say(g, `Assessor: “${ack}”`, 'info');
  g.pi += 1;
  if (g.pi >= g.phases.length) { end(g); return; }
  enterPhase(g);
}
function end(g) {
  if (g.ended && g.phase === 'done') return;
  g.ended = true; g.phase = 'done';
  g.caption = g.unsafe ? 'Assessment stopped.' : cap('end', 'That’s the assessment done. Let’s have a look at the sheet.');
}

const relevant = (g) => {
  if (g.mode === 'assessment') return CRITERIA;
  return CRITERIA.filter((c) => c.task === g.task);
};
export function score(g) {
  const rows = relevant(g).map((c) => {
    const r = g.res[c.id];
    if (c.task === 1 && !r) return { ...c, s: g.unsafe ? 'miss' : 'pass', why: g.unsafe ? 'Unsafe act — assessment stopped.' : 'Nothing went wrong here all run.' };
    return { ...c, s: r?.s ?? 'miss', why: r?.why ?? (g.unsafe ? 'Not reached — assessment stopped.' : 'Not shown.') };
  });
  const wrong = rows.filter((r) => r.s === 'miss').length;
  const na = rows.filter((r) => r.s === 'na').length;
  const got = rows.length - wrong;
  const passed = !g.unsafe && (g.mode === 'assessment' ? got >= PASS_MARK : wrong === 0);
  return { rows, wrong, na, got, total: rows.length, passed, unsafe: g.unsafe, pass: PASS_MARK, of: TOTAL };
}

const PHASES = {
  /* T2 — lines + cleats, then secure */
  t2: () => ({
    caption: cap('t2', 'When you’re ready, check your lines and fittings, then secure the boat to the jetty.'),
    hs(g, id) {
      if (id.startsWith('hs_line_')) { lineAction(g, id.slice(8)); return true; }
      if (id.startsWith('hs_cleat') || id === 'hs_jetty_cleat') { say(g, `${id === 'hs_jetty_cleat' ? 'Jetty cleat' : 'Boat cleat'}: solid, no cracks or movement.`, 'ok'); return true; }
      return undefined;
    },
    choose(g, key) {
      if (key !== 'secure') return undefined;
      const use = LINE_IDS.filter((id) => !(g.inspected.has(`hs_line_${id}`) && g.frayed === id)).slice(0, 2);
      const usedBad = g.frayed && use.includes(g.frayed) ? true : false;
      const linesChecked = use.every((id) => g.inspected.has(`hs_line_${id}`));
      mark(g, 'T2.1', linesChecked && !usedBad, usedBad ? `The ${g.frayed} line was frayed and you used it.` : linesChecked ? 'Lines inspected; the frayed one set aside.' : 'Not every line you used was inspected first.');
      const cleats = ['hs_cleat_bow', 'hs_cleat_stern', 'hs_jetty_cleat'].filter((h) => g.inspected.has(h));
      mark(g, 'T2.2', cleats.length === 3, cleats.length === 3 ? 'Boat cleats and jetty cleat checked.' : 'Not all the cleats/fittings you used were checked.');
      delete g.boat.lines.held_bow; delete g.boat.lines.held_stern;
      tieUp(g, use.map((id) => (id === 'spring' ? 'spring' : id)));
      mark(g, 'T2.3', true, `Secured with the ${use.join(' and ')} line${use.length > 1 ? 's' : ''}.`);
      say(g, 'Boat secured alongside.', 'ok');
      g.ph.canNext = true; finishPhase(g); return true;
    },
    prompt: { key: 'secure', label: 'Secure the boat (uses the lines you’ve passed as good)', options: [{ value: true, text: 'Secure the boat now' }] },
  }),

  /* T3 — safety briefing */
  t3: () => {
    const B = CAP.BRIEFING ?? { required: [{ hs: 'hs_lifejackets', name: 'Lifejackets' }], optional: [], wearing: { options: [{ id: 'carry', text: 'Carried, worn if told' }, { id: 'wear', text: 'Worn at all times' }], correct: 'carry' } };
    const shown = new Set();
    return {
      caption: cap('t3', 'Righto — give your passengers a safety briefing for where we’re going today.'),
      briefing: B, shown,
      hs(g, id) { if ((B.required ?? []).some((r) => r.hs === id) || (B.optional ?? []).some((r) => r.hs === id)) { shown.add(id); const it = [...B.required, ...(B.optional ?? [])].find((r) => r.hs === id); say(g, `You point out: ${it.name}.`, 'you'); return true; } return undefined; },
      prompt: { key: 'wearing', label: `Wearing rule for ${B.area ?? 'today’s area'}`, options: (B.wearing?.options ?? []).map((o) => ({ value: o.id, text: o.text })) },
      choose(g, key, value) {
        if (key === 'wearing') {
          g.ph.wearing = value; say(g, `You: “${(B.wearing.options.find((o) => o.id === value) ?? {}).text}”`, 'you');
          g.prompt = { key: 'understood', label: 'Close the briefing', options: [{ value: 'ask', text: '“Does everyone understand? Any questions?”' }, { value: 'skip', text: '“Righto, let’s go.”' }] };
          return true;
        }
        if (key === 'understood') {
          const req = B.required ?? [];
          const missing = req.filter((r) => !shown.has(r.hs));
          mark(g, 'T3.1', missing.length === 0, missing.length ? `Not shown: ${missing.map((m) => m.name).join(', ')}.` : 'Every required item named.');
          mark(g, 'T3.2', missing.length === 0 && g.ph.wearing === B.wearing.correct, g.ph.wearing === B.wearing.correct ? (missing.length ? 'Some locations not shown.' : 'Locations shown and the right wearing rule.') : 'Wrong wearing rule for this area.');
          mark(g, 'T3.3', value === 'ask', value === 'ask' ? 'Checked everyone understood.' : 'Never checked they understood.');
          g.ph.canNext = true; finishPhase(g); return true;
        }
        return undefined;
      },
    };
  },

  /* T4 — pre-start then start */
  t4: () => ({
    caption: cap('t4', 'Do your pre-start checks and start the motor when you’re happy.'),
    hs(g, id) {
      const b = g.boat;
      if (id === 'hs_fuel_line' || id === 'hs_fuel_bulb') { g.ph.fuel = true; say(g, 'Fuel line clicked on at both ends; primer bulb firm.', 'ok'); return true; }
      if (id === 'hs_fuel_gauge') { g.ph.gauge = true; say(g, 'Fuel gauge: three-quarters of a 100 L tank — about 75 litres.', 'ok'); return true; }
      if (id === 'hs_intakes') { g.ph.intakes = true; if (g.bagOnIntake && !g.cleared.has('bag')) { g.cleared.add('bag'); say(g, 'A plastic bag was over the intake on the leg — you pull it off. Clear now.', 'warn'); } else say(g, 'Cooling intakes on the leg: clear.', 'ok'); return true; }
      if (id === 'hs_lanyard') { g.ph.lanyard = true; say(g, 'Kill-switch lanyard clipped on and attached to you.', 'ok'); return true; }
      if (id === 'hs_lever') { g.ph.neutral = b.gear === 0; say(g, b.gear === 0 ? 'Lever in neutral.' : `Lever is in ${notchLabel(b.gear)} — not neutral!`, b.gear === 0 ? 'ok' : 'warn'); return true; }
      if (id === 'hs_prop') {
        g.ph.propAt = g.t;
        if (g.swimmerAtProp && !g.cleared.has('swimmer')) { say(g, 'There’s a kid swimming right by the leg!', 'warn'); g.prompt = { key: 'swimmer', label: 'Someone is in the water by the propeller', options: [{ value: 'move', text: '“Mate, can you swim clear of the motor? I’m about to start it.”' }, { value: 'ignore', text: 'Start anyway' }] }; }
        else say(g, 'Prop area clear — nobody in the water near the motor.', 'ok');
        return true;
      }
      if (id === 'hs_key') {
        if (b.running) { engineOff(g); return true; }
        const ok8 = g.ph.propAt !== undefined && g.t - g.ph.propAt <= Math.max(th('headCheckWindow', 6), 20);
        mark(g, 'T4.2', !!g.ph.fuel, g.ph.fuel ? 'Fuel line checked before start.' : 'Fuel line not checked before starting.');
        mark(g, 'T4.3', !!g.ph.gauge, g.ph.gauge ? 'Fuel quantity checked.' : 'Fuel quantity not checked before starting.');
        mark(g, 'T4.5', !!g.ph.intakes, g.ph.intakes ? 'Intakes checked.' : 'Cooling intakes not checked before starting.');
        mark(g, 'T4.6', !!g.ph.lanyard, g.ph.lanyard ? 'Lanyard on.' : 'Kill-switch lanyard not checked/attached before starting.');
        mark(g, 'T4.7', !!g.ph.neutral && b.gear === 0, g.ph.neutral ? 'Neutral confirmed.' : 'Didn’t confirm neutral before the key.');
        mark(g, 'T4.8', ok8 && (!g.swimmerAtProp || g.cleared.has('swimmer')), ok8 ? 'Looked at the prop area right before starting.' : 'No look around the propeller just before starting.');
        startEngine(g);
        if (b.running) { mark(g, 'T4.9', true, 'Motor started in neutral.'); g.ph.canNext = true; finishPhase(g); }
        return true;
      }
      return undefined;
    },
    choose(g, key, value) {
      if (key !== 'swimmer') return undefined;
      if (value === 'move') { g.cleared.add('swimmer'); g.ph.propAt = g.t; say(g, 'The swimmer paddles off to the beach. Prop area clear.', 'ok'); }
      g.prompt = null; return true;
    },
  }),

  /* T5 — log on */
  t5: () => ({
    caption: cap('t5', 'Log on with Marine Rescue for me — use the radio (Tab).'),
    radio: 'logon',
    onRadio(g, kind) { if (kind === 'logon') { g.ph.canNext = true; finishPhase(g); } },
  }),

  /* T6 — depart */
  t6: (g) => ({
    caption: cap('t6', 'When you’re ready, take us off the berth.'),
    ghost: departGhost(g),
    start: null, maxNotch: 0, contactMax: 0, offAt: null, clearAt: null, recontact: false, rough: false, dither: [],
    onGear(g, from, to, rough) {
      const ph = g.ph;
      if (to !== 0 && ph.start === null) {
        ph.start = g.t;
        const lk = lookedAround(g, th('headCheckWindow', 6));
        mark(g, 'T6.1', lk.any, lk.any ? 'Looked around before moving off.' : 'Moved off without looking around.');
      }
      if (rough) { ph.rough = true; }
      ph.dither.push(g.t);
    },
    tick(g) {
      const ph = g.ph; const b = g.boat;
      const allOff = LINE_IDS.every((id) => g.lines[id].state !== 'tied');
      if (allOff && ph.offAt === null) ph.offAt = g.t;
      const dJ = distToPoly([b.x, b.y], g.W.colliders.find((c) => c.kind === 'jetty')?.poly ?? [[0, 0]]);
      if (ph.start !== null) ph.maxNotch = Math.max(ph.maxNotch, Math.abs(b.gear));
      if (ph.offAt !== null && dJ > th('departClear', 3) + BOAT.B / 2 && ph.clearAt === null) ph.clearAt = g.t;
      const lin = LINE_IDS.some((id) => g.lines[id].state === 'loose');
      if (lin && speedKn(b) > th('linesStowSpeed', 4)) fail(g, 'T6.7', 'Lines still loose on deck when you got under way.');
      if (ph.start !== null && dJ > 25) {
        mark(g, 'T6.2', !ph.recontact, ph.recontact ? 'Set back onto the berth after moving off.' : 'Got clear of the berth allowing for the wind.');
        mark(g, 'T6.3', ph.contactMax < th('contactLight', 0.5), ph.contactMax < 0.05 ? 'No contact with the berth.' : ph.contactMax < th('contactLight', 0.5) ? `Light touch (${ph.contactMax.toFixed(2)} m/s).` : `Hit the berth at ${ph.contactMax.toFixed(2)} m/s.`);
        mark(g, 'T6.4', !g.ph.impeded, g.ph.impeded ? 'Cut across another boat that had to slow for you.' : 'Kept clear of other traffic.');
        mark(g, 'T6.5', ph.maxNotch <= th('manoeuvreMaxNotch', 2), ph.maxNotch <= th('manoeuvreMaxNotch', 2) ? 'Low revs off the berth.' : `Used ${ph.maxNotch} notches near the berth — too many revs.`);
        const hunting = ph.dither.some((t0) => ph.dither.filter((t) => t >= t0 && t < t0 + 5).length > th('gearDither', 4));
        mark(g, 'T6.6', !ph.rough && !hunting, ph.rough ? 'A rough shift (no pause in neutral / revs too high).' : hunting ? 'Hunting between gears.' : 'Smooth, timely gear changes.');
        mark(g, 'T6.7', !lin && LINE_IDS.every((id) => g.lines[id].state === 'stowed'), lin ? 'Lines left loose.' : 'Lines stowed.');
        say(g, 'Clear of the berth.', 'ok');
        finishPhase(g);
      }
    },
    contact(g, c) {
      if (c.kind === 'jetty' || c.kind === 'pile' || c.kind === 'rock') {
        g.ph.contactMax = Math.max(g.ph.contactMax, c.speed);
        if (g.ph.clearAt !== null && c.speed > 0.05) g.ph.recontact = true;
      }
    },
  }),

  /* T8 — transit */
  t8: (g) => {
    const opts = transitOptions(g);
    return {
      caption: cap('t8', 'Find a transit, tell me the two objects, then steer along it for 30 seconds.'),
      L: null, hold: 0, best: 0, named: null, ghost: g.W.transits[0] ? transitGhost(g.W.transits[0]) : null,
      prompt: { key: 'transit', label: 'Name your transit (front mark, then the one behind it)', options: opts },
      choose(g, key, value) {
        if (key !== 'transit') return undefined;
        const b = g.boat; const tr = g.W.transits.find((t) => t.id === value);
        let ok = false; let why = 'Those two objects don’t form a transit.';
        if (tr) {
          const L = transitLine(tr); const v = [b.x - L.p[0], b.y - L.p[1]];
          const along = v[0] * L.d[0] + v[1] * L.d[1]; const xte = Math.abs(v[0] * L.n[0] + v[1] * L.n[1]);
          const off = Math.atan2(xte, Math.max(1, along)) / D; // bearing difference front vs back, roughly
          ok = along > 0 && off <= Math.max(th('transitAlign', 5), 8);
          why = ok ? `Named: ${tr.sayAs.split(':')[0]}.` : `${tr.sayAs.split(':')[0]} — but they weren’t in line from where you were (${off.toFixed(0)}° apart).`;
          if (ok) { g.ph.L = L; g.ph.tr = tr; g.ghost = transitGhost(tr); }
        }
        g.ph.named = value; mark(g, 'T8.1', ok, why);
        say(g, `You: “I’m using ${(opts.find((o) => o.value === value)?.text ?? value).split(':')[0]}.”`, 'you');
        g.prompt = null; return true;
      },
      tick(g) {
        const ph = g.ph;
        if (ph.named === null) { if (g.t - ph.t0 > 300) { mark(g, 'T8.1', false, 'Never named a transit.'); mark(g, 'T8.2', false, 'Never steered a named transit.'); finishPhase(g); } return; } // name it first, then steer it
        if (!ph.L) { // named a wrong pair: use the nearest real transit for the hold
          let best = null; for (const tr of g.W.transits) { const L = transitLine(tr); const v = [g.boat.x - L.p[0], g.boat.y - L.p[1]]; const x = Math.abs(v[0] * L.n[0] + v[1] * L.n[1]); if ((v[0] * L.d[0] + v[1] * L.d[1]) > 0 && (!best || x < best.x)) best = { x, L }; }
          if (!best) return; ph.Ltmp = best.L;
        }
        const L = ph.L ?? ph.Ltmp;
        const b = g.boat; const v = [b.x - L.p[0], b.y - L.p[1]];
        const xte = Math.abs(v[0] * L.n[0] + v[1] * L.n[1]);
        const along = v[0] * L.d[0] + v[1] * L.d[1];
        const hd = fwd(b.psi); const align = Math.abs(hd[0] * L.d[0] + hd[1] * L.d[1]);
        ph.xte = xte;
        const on = xte <= th('transitXte', 10) && align > Math.cos(25 * D) && along > 8 && speedKn(b) > 0.8;
        if (on) { ph.hold += DT; ph.off = 0; } else if (ph.hold > 0) { ph.off = (ph.off ?? 0) + DT; if (ph.off > th('transitGrace', 4)) { ph.hold = 0; ph.off = 0; } }
        ph.best = Math.max(ph.best, ph.hold);
        if (ph.hold >= th('transitTime', 30)) {
          mark(g, 'T8.2', true, `Held the transit for ${th('transitTime', 30)} s (within ${th('transitXte', 10)} m).`);
          if (ph.named === null) mark(g, 'T8.1', false, 'Never told the assessor which two objects.');
          say(g, 'That’s 30 seconds on the transit.', 'ok'); finishPhase(g);
        }
        if (g.t - ph.t0 > 300) { mark(g, 'T8.2', false, `Best hold ${ph.best.toFixed(0)} s of 30.`); if (ph.named === null) mark(g, 'T8.1', false, 'Never named a transit.'); finishPhase(g); }
      },
    };
  },

  /* T9 — controlled stop from ~5 kn */
  t9: () => ({
    caption: cap('t9', 'Bring her up to about 5 knots. When you’re ready, show me a controlled stop.'),
    armed: 0, start: null, shoutAt: null, revsDownAt: null, nAt: null, nDur: 0, revAt: null, churn: 0, maxRev: 0, stopped: false, minRpm: 9999, x0: null,
    shout(g) { g.ph.shoutAt = g.t; return 'Hold on — stopping!'; },
    onGear(g, from, to) {
      const ph = g.ph;
      if (ph.start === null && to < from && from > 0 && ph.armed >= 2) {
        ph.start = g.t; ph.x0 = [g.boat.x, g.boat.y]; ph.v0 = speedKn(g.boat);
        const lk = lookedAround(g, th('headCheckWindow', 6));
        mark(g, 'T9.1', lk.aft, lk.aft ? 'Looked behind before stopping.' : 'Didn’t look behind before stopping.');
      }
      if (ph.start === null) return;
      if (to === 0) ph.nAt = g.t;
      if (to < 0 && ph.revAt === null) {
        ph.revAt = g.t; ph.nDur = ph.nAt ? g.t - ph.nAt : 0;
        ph.rpmAtRev = g.boat.rpm;
      }
    },
    tick(g) {
      const ph = g.ph; const b = g.boat; const kn = speedKn(b);
      if (ph.start === null) {
        const band = th('stopSpeedBand', 1.5); const target = th('stopSpeed', 5);
        if (Math.abs(kn - target) <= band && b.gear > 0) ph.armed += DT; else ph.armed = Math.max(0, ph.armed - DT);
        if (!ph.cap0) ph.cap0 = g.caption;
        g.caption = ph.armed >= 2 ? 'That’s about 5 knots — stop the boat when you’re ready.' : ph.cap0;
        return;
      }
      if (ph.revAt === null) ph.minRpm = Math.min(ph.minRpm, b.rpm);
      if (b.gear < 0) { ph.maxRev = Math.max(ph.maxRev, -b.gear); if (b.rpm > RPM_CHURN) ph.churn += DT; }
      if (!ph.stopped && b.u <= 0.05) {
        ph.stopped = true; ph.stopAt = g.t;
        const d = dist(ph.x0, [b.x, b.y]); ph.d = d;
        const reactOk = true;
        mark(g, 'T9.2', ph.shoutAt !== null && ph.shoutAt <= (ph.revAt ?? g.t) && ph.shoutAt >= ph.start - th('headCheckWindow', 6), ph.shoutAt !== null ? 'Warned the crew.' : 'No warning shouted to the crew.');
        mark(g, 'T9.3', reactOk && ph.v0 >= th('stopSpeed', 5) - th('stopSpeedBand', 1.5) && ph.minRpm <= 1000, ph.minRpm <= 1000 ? 'Revs came down first.' : 'Revs never came down before reverse.');
        mark(g, 'T9.4', ph.revAt !== null && ph.nDur >= th('neutralPause', 0.6), ph.revAt === null ? 'Never went to neutral then reverse.' : ph.nDur >= th('neutralPause', 0.6) ? `Paused in neutral ${ph.nDur.toFixed(1)} s.` : `Only ${ph.nDur.toFixed(2)} s in neutral — straight through to reverse.`);
        mark(g, 'T9.5', ph.revAt !== null, ph.revAt !== null ? 'Reverse engaged.' : 'Never engaged reverse.');
        ph.pendingRevs = true;
        mark(g, 'T9.7', d <= th('stopDistanceBL', 2) * BL(), `Stopped in ${(d / BL()).toFixed(1)} boat lengths (${d.toFixed(1)} m).`);
      }
      if (ph.stopped && ph.pendingRevs) {
        const sternway = -b.u * KN;
        const tooMuch = ph.maxRev > th('stopMaxReverse', 2) || ph.churn > 0.3 || sternway > th('sternwayMax', 1);
        if (b.gear >= 0 || sternway > th('sternwayMax', 1) || g.t - ph.stopAt > 4) {
          mark(g, 'T9.6', ph.revAt !== null && !tooMuch, ph.revAt === null ? 'No reverse used.' : tooMuch ? (ph.churn > 0.3 ? 'Too many revs astern — the prop just churned.' : 'Kept reversing — the boat gathered sternway.') : 'Controlled revs astern.');
          ph.pendingRevs = false; say(g, `Stopped in ${(ph.d / BL()).toFixed(1)} boat lengths.`, ph.d <= 2 * BL() ? 'ok' : 'warn');
          finishPhase(g);
        }
      }
    },
  }),

  /* between T9 and T10: the MOB comes at a random moment */
  cruise: () => ({
    caption: cap('cruise', 'Good. Head back towards the ramp at a sensible speed.'),
    tick(g) { if (g.t - g.ph.t0 > g.mobDelay) finishPhase(g); },
  }),

  /* T7 — person overboard */
  t7: (g) => {
    const side = g.R() < 0.5 ? 'port' : 'starboard';
    return {
      caption: g.mode === 'drill' ? 'Cruise along… the assessor will throw the float when you least expect it.' : '',
      armedAt: g.mode === 'drill' ? g.t + g.mobDelay : g.t,
      side,
      tick(g) {
        const ph = g.ph;
        if (!g.mob) { if (g.t >= ph.armedAt) dropMob(g, side); return; }
        mobTick(g);
      },
      shout(g) { return g.mob ? `Man overboard, ${g.mob.side} side!` : 'All good back there?'; },
      onEngineOff(g) { if (g.mob) g.mob.offAt = g.t; },
      onGear(g, from, to) { if (g.mob && to !== 0) { const d = dist([g.mob.x, g.mob.y], [g.boat.x, g.boat.y]); if (d < th('mobNoEngineBL', 1) * BL() + BOAT.L / 2) g.mob.gearNear = true; } },
      choose(g, key) { if (key === 'retrieve') { retrieve(g); return true; } return undefined; },
    };
  },

  /* T10 — return and dock */
  t10: (g) => ({
    caption: cap('t10', 'Take us back in and bring her alongside the jetty — your call which side.'),
    ghost: dockGhost(g),
    looked: false, maxNotch: 0, rough: false, contactMax: 0, angle: null, approachKn: 0, nBefore: null, side: null,
    onGear(g, from, to, rough) { if (rough) g.ph.rough = true; },
    tick(g) {
      const ph = g.ph; const b = g.boat;
      const jetty = g.W.colliders.find((c) => c.kind === 'jetty');
      const dJ = jetty ? distToPoly([b.x, b.y], jetty.poly) : 99;
      if (!ph.zoneAt && dJ < th('berthZone', 25)) ph.zoneAt = g.t;
      if (!ph.finalAt && dJ < 15) {
        ph.finalAt = g.t;
        const lk = lookedAround(g, Math.max(th('headCheckWindow', 6), 20));
        mark(g, 'T10.1', lk.any, lk.any ? 'Looked around before the approach.' : 'No look around before coming in.');
        if (!g.passengers.handsIn) fail(g, 'T1.4', 'Didn’t tell the passengers to keep hands inside before berthing (p.92).');
      }
      if (ph.zoneAt) {
        ph.maxNotch = Math.max(ph.maxNotch, Math.abs(b.gear));
        // approach angle: the heading held on the run-in, measured as the boat comes within
        // ~2.5 boat lengths of a berth (where p.109 Step 2 starts the swing)
        if (ph.angle === null) {
          for (const be of g.W.layout.berths ?? []) {
            const [p0, p1] = be.edge; const e = [p1[0] - p0[0], p1[1] - p0[1]]; const l = Math.hypot(...e);
            const u = [e[0] / l, e[1] / l]; const rel = [b.x - p0[0], b.y - p0[1]];
            const off = rel[0] * be.outward[0] + rel[1] * be.outward[1]; const al0 = rel[0] * u[0] + rel[1] * u[1];
            if (al0 < -2 || al0 > l + 2) continue; // only once the boat is abeam of the berth's span
            const al = Math.max(0, Math.min(l, al0));
            const near = [p0[0] + u[0] * al, p0[1] + u[1] * al]; const dseg = dist(near, [b.x, b.y]);
            const vw = velWorld(b); const closing = (near[0] - b.x) * vw[0] + (near[1] - b.y) * vw[1] > 0;
            if (off > 0 && closing && dseg < th('berthSwingBL', 2.5) * BL() + 1) {
              // course over the ground (what the assessor sees the boat doing), heading if barely moving
              const vl = Math.hypot(...vw); const hv = vl > 0.4 ? [vw[0] / vl, vw[1] / vl] : fwd(b.psi);
              const ang = Math.acos(Math.min(1, Math.abs(hv[0] * u[0] + hv[1] * u[1]))) / D;
              ph.angle = ang; ph.side = be.id; ph.approachKn = speedKn(b);
              if (globalThis.__SIMDBG) console.log('angle@', b.x.toFixed(1), b.y.toFixed(1), (b.psi / D).toFixed(0), 'off', off.toFixed(2), 'dseg', dseg.toFixed(1), be.id, ang.toFixed(0));
            }
          }
        } else ph.approachKn = Math.max(ph.approachKn, speedKn(b));
        // in neutral before the bow is within one boat length of the berth
        if (ph.nBefore === null && jetty && ph.angle !== null) {
          const hullMin = Math.min(...hullWorldPts(b).map((p) => distToPoly(p, jetty.poly)));
          if (hullMin < 1.5) ph.nBefore = b.gear <= 0;
        }
      }
      if (ph.secured) {
        const [lo, hi] = th('berthAngleAccept', [20, 60]);
        mark(g, 'T10.2', !ph.impeded, ph.impeded ? 'Another boat had to wait for you.' : 'No one impeded.');
        const drift = sideCheck(g, ph.side);
        mark(g, 'T10.3', drift.ok, drift.why);
        mark(g, 'T10.4', ph.approachKn <= th('berthApproachMax', 3), `Came in at ${ph.approachKn.toFixed(1)} kn.`);
        mark(g, 'T10.5', ph.angle !== null && ph.angle >= lo && ph.angle <= hi, ph.angle === null ? 'No measurable approach.' : `Approach angle ${ph.angle.toFixed(0)}° (aim 30–45°).`);
        mark(g, 'T10.6', !ph.rough && ph.nBefore !== false, ph.rough ? 'A rough gear change on the way in.' : ph.nBefore === false ? 'Still in forward gear as the bow’s shoulder reached the berth.' : 'Smooth, timely gears.');
        mark(g, 'T10.7', ph.maxNotch <= th('manoeuvreMaxNotch', 2), ph.maxNotch <= th('manoeuvreMaxNotch', 2) ? 'Low revs.' : `Used ${ph.maxNotch} notches near the berth.`);
        mark(g, 'T10.8', ph.contactMax < th('contactLight', 0.5), ph.contactMax < 0.05 ? 'Kissed the berth — no impact.' : `Contact at ${ph.contactMax.toFixed(2)} m/s.`);
        finishPhase(g);
      }
    },
    contact(g, c) { if (c.kind === 'jetty' || c.kind === 'pile' || c.kind === 'rock') g.ph.contactMax = Math.max(g.ph.contactMax, c.speed); },
    shout(g) { g.passengers.handsIn = true; return 'Hands and feet inside the boat — I’ll do the lines.'; },
    hs(g, id) {
      if (!id.startsWith('hs_line_') && !id.startsWith('hs_cleat')) return undefined;
      const b = g.boat; const be = (g.W.layout.berths ?? []).find((x) => x.id === g.ph.side);
      if (!be) { say(g, 'You’re not alongside yet.', 'warn'); return true; }
      const rel = [b.x - be.edge[0][0], b.y - be.edge[0][1]]; const off = rel[0] * be.outward[0] + rel[1] * be.outward[1];
      const gap = off - BOAT.B / 2;
      if (gap > th('secureGap', 0.6) + 0.35 || speedKn(b) > 1) { say(g, 'Too far off / still moving — get her alongside first.', 'warn'); return true; }
      g.berthPose = { ...berthPose(g.W, be.id) };
      g.berthPose.o = be.outward;
      tieUp(g, ['bow', 'stern']);
      mark(g, 'T10.9', true, 'Secured with bow and stern lines.');
      say(g, 'Lines on — secured alongside.', 'ok');
      g.ph.secured = true; return true;
    },
  }),

  /* T11 — log off */
  t11: () => ({
    caption: cap('t11', 'Last thing — log off with Marine Rescue.'),
    radio: 'logoff',
    onRadio(g, kind) { if (kind === 'logoff') finishPhase(g); },
  }),
};

function sideCheck(g, side) {
  const c = g.cond; const tot = [c.wind[0] * 0.05 + c.current[0], c.wind[1] * 0.05 + c.current[1]];
  const mag = Math.hypot(...tot) * KN;
  if (!side) return { ok: false, why: 'Never came alongside.' };
  const b = g.boat; const h = fwd(b.psi);
  // upstream = opposite to where wind/current would push the boat
  const up = [-tot[0], -tot[1]]; const lu = Math.hypot(...up) || 1;
  const ang = Math.acos(Math.max(-1, Math.min(1, (h[0] * up[0] + h[1] * up[1]) / lu))) / D;
  if (mag < th('negligibleDrift', 0.3)) return { ok: true, why: 'Wind/current negligible — either side is fine.' };
  const be = (g.W.layout.berths ?? []).find((x) => x.id === side);
  if (be) {
    const e = [be.edge[1][0] - be.edge[0][0], be.edge[1][1] - be.edge[0][1]]; const le = Math.hypot(...e);
    const across = Math.abs((e[0] * tot[0] + e[1] * tot[1]) / (le * Math.hypot(...tot)));
    if (across < Math.cos(50 * D)) return { ok: true, why: `Wind/current runs across the berth — ${side} side is fine (p.108).` };
  }
  return ang <= th('berthSideAngle', 90) ? { ok: true, why: `Berthed ${side} side, bow into the wind/current.` } : { ok: false, why: `Berthed ${side} side with the wind/current from astern.` };
}

function transitOptions(g) {
  const out = g.W.transits.map((t) => ({ value: t.id, text: t.sayAs.split(':')[0] }));
  out.push({ value: 'decoy1', text: 'the jetty light pole and Garden Island' });
  out.push({ value: 'decoy2', text: 'two moored yachts next to each other' });
  return out;
}

/* ---------- MOB ---------- */
function dropMob(g, side) {
  const b = g.boat; const sx = side === 'starboard' ? 1.6 : -1.6;
  const p = toWorld(b, sx, -1.5);
  g.mob = { x: p[0], y: p[1], side, t0: g.t, aid: null, watch: null, turnedAt: null, offAt: null, retrieved: false, gearNear: false, minDistTurn: Infinity };
  g.caption = `MAN OVERBOARD — ${side.toUpperCase()} SIDE!`;
  g.prompt = { key: 'mob', label: 'Person overboard', options: [{ value: 'mobAid', text: 'Throw a lifejacket (1)' }, { value: 'mobWatch', text: 'Assign a watcher (2)' }] };
  say(g, `Assessor: “Man overboard, ${side} side!”`, 'bad');
}
function mobTick(g) {
  const m = g.mob; const b = g.boat; if (m.retrieved) return;
  // the float drifts with the current (and a little wind)
  m.x += (g.cond.current[0] + g.cond.wind[0] * 0.01) * DT; m.y += (g.cond.current[1] + g.cond.wind[1] * 0.01) * DT;
  const d = dist([m.x, m.y], [b.x, b.y]);
  const dt = g.t - m.t0;
  if (m.turnedAt === null) {
    const want = m.side === 'starboard' ? 1 : -1;
    if (b.wheel * want >= th('mobHelmFraction', 0.5)) m.turnedAt = g.t;
    if (dt > th('mobTurnWindow', 4) && m.turnedAt === null) { m.turnedAt = -1; fail(g, 'T7.1', `Didn’t turn towards the ${m.side} side within ${th('mobTurnWindow', 4)} s.`); }
    else if (m.turnedAt > 0) mark(g, 'T7.1', true, `Turned hard to ${m.side} in ${(g.t - m.t0).toFixed(1)} s.`);
  }
  if (dt > th('mobThrowWindow', 10) && !m.aid) { fail(g, 'T7.2', 'No flotation aid thrown in time.'); m.aid = -1; }
  if (dt > th('mobWatchWindow', 10) && !m.watch) { fail(g, 'T7.3', 'Nobody was told to keep watching the person.'); m.watch = -1; }
  if (m.aid > 0) mark(g, 'T7.2', true, 'Lifejacket thrown.');
  if (m.watch > 0) mark(g, 'T7.3', true, 'Watcher assigned.');
  if (g.prompt?.key === 'mob' && m.aid && m.watch) g.prompt = null;
  // final approach geometry
  const kn = speedKn(b);
  if (d > th('mobTurnClear', 10) + 5) m.cleared = true; // got clear for the return loop
  const vw = velWorld(b); const closing = ((m.x - b.x) * vw[0] + (m.y - b.y) * vw[1]) > 0;
  // the FINAL approach = the last time the boat came inside mobFinalApproach heading in (passes that leave again don't count)
  if (m.cleared && closing && d < th('mobFinalApproach', 20) && d > 4 && kn > 0.5 && !m.rec) {
    const v = velWorld(b); const vl = Math.hypot(...v) || 1;
    const c = g.cond; const windDrift = [c.wind[0] * 0.05, c.wind[1] * 0.05]; // boat leeway relative to the float
    const ref = Math.hypot(...windDrift) >= Math.hypot(...c.current) ? windDrift.map((x) => -x) : c.current.map((x) => -x);
    const rl = Math.hypot(...ref) || 1;
    m.rec = { angle: Math.acos(Math.max(-1, Math.min(1, (v[0] * ref[0] + v[1] * ref[1]) / (vl * rl)))) / D, maxKn: kn, gear: false };
  }
  if (m.rec) {
    m.rec.maxKn = Math.max(m.rec.maxKn, kn);
    if (b.running && b.gear !== 0 && d < th('mobNoEngineBL', 1) * BL() + BOAT.L / 2) m.rec.gear = true;
    if (d > th('mobFinalApproach', 20) + 5) m.rec = null;
  }
  const prop = toWorld(b, 0, -2.75); const dProp = dist([m.x, m.y], prop);
  if (dt > 4 && b.running && b.gear !== 0 && dProp < th('unsafePropRadius', 3)) unsafe(g, 'engineNearPerson');
  if (dt > 4 && d < 1.6 && kn > 2) unsafe(g, 'hitPerson');
  if (kn > th('fastNearPersonKn', 12) && d < th('fastNearPersonM', 20)) unsafe(g, 'fastNearPerson');
  if (d < th('mobReach', 2.5) + BOAT.B / 2 && kn < 1.2) {
    if (g.prompt?.key !== 'retrieve' && !m.retrieved) g.prompt = { key: 'retrieve', label: 'They’re alongside', options: [{ value: 'retrieve', text: 'Get them aboard (E)' }] };
  }
}
function retrieve(g) {
  const m = g.mob; const b = g.boat; if (!m || m.retrieved) return;
  const d = dist([m.x, m.y], [b.x, b.y]);
  if (d > th('mobReach', 2.5) + BOAT.B / 2 + 0.3) { say(g, 'Out of reach.', 'warn'); return; }
  m.retrieved = true; g.prompt = null;
  const rec = m.rec;
  if (rec) {
    const okA = rec.angle <= th('mobUpwindAngle', 45);
    mark(g, 'T7.4', okA, okA ? `Came back into the wind/current (${rec.angle.toFixed(0)}° off).` : `Final approach ${rec.angle.toFixed(0)}° off into-the-wind — from upwind you drift down onto them.`);
    mark(g, 'T7.5', rec.maxKn <= th('steerageMax', 3), `Final approach at ${rec.maxKn.toFixed(1)} kn.`);
    mark(g, 'T7.6', !rec.gear, rec.gear ? 'Gear engaged within a boat length of the person.' : 'Drifted the last boat length in neutral.');
  } else { mark(g, 'T7.4', false, 'No final approach — you came alongside without a run-in.'); mark(g, 'T7.5', false, 'No final approach.'); mark(g, 'T7.6', false, 'No final approach.'); }
  mark(g, 'T7.7', !b.running, b.running ? 'Engine still running at the pick-up.' : 'Engine off before the pick-up.');
  mark(g, 'T7.8', true, 'Person retrieved.');
  say(g, 'Got them aboard.', 'ok');
  if (g.mode === 'assessment') { b.running = false; say(g, 'Assessor: “Good. Restart and take us home.”', 'info'); }
  finishPhase(g);
}

/* ---------- ghosts (textbook paths, drawn when asked) ---------- */
function departGhost(g) {
  const p = g.berthPose; if (!p) return null;
  const pts = []; for (let i = 0; i <= 12; i++) { const a = i * 3; pts.push([p.x + p.u[0] * a * 2 + p.o[0] * a * 0.5, p.y + p.u[1] * a * 2 + p.o[1] * a * 0.5]); }
  return pts;
}
function transitGhost(tr) { const L = transitLine(tr); return [[L.p[0] + L.d[0] * 15, L.p[1] + L.d[1] * 15], [L.p[0] + L.d[0] * 260, L.p[1] + L.d[1] * 260]]; }
function dockGhost(g) {
  const be = (g.W.layout.berths ?? []).find((x) => x.id === 'east'); if (!be) return null;
  const [p0, p1] = be.edge; const u = [p1[0] - p0[0], p1[1] - p0[1]]; const l = Math.hypot(...u); const uu = [u[0] / l, u[1] / l];
  const tgt = [p0[0] + uu[0] * l * 0.6 + be.outward[0] * 1.5, p0[1] + uu[1] * l * 0.6 + be.outward[1] * 1.5];
  // 35° approach line, coming in from seaward
  const a = 35 * D; const dir = [uu[0] * Math.cos(a) + be.outward[0] * Math.sin(a), uu[1] * Math.cos(a) + be.outward[1] * Math.sin(a)];
  return [[tgt[0] + dir[0] * 40, tgt[1] + dir[1] * 40], tgt];
}

/* ---------- traffic (one other boat using the ramp) ---------- */
function trafficTick(g) {
  if (!['t6', 't10'].includes(g.phase)) return;
  const P = g.W.P;
  if (!g.traffic.length || g.traffic[0].phase !== g.phase) {
    const start = P(140, -60); const end = P(40, -14); // holds off ~40 m out until the berth is free
    g.traffic = [{ phase: g.phase, x: start[0], y: start[1], to: end, kn: 4, psi: Math.atan2(end[0] - start[0], end[1] - start[1]), yielded: false, startDelay: g.t + (g.phase === 't6' ? 25 : 30) }];
  }
  const tb = g.traffic[0]; const b = g.boat;
  if (g.t < tb.startDelay) return;
  const dx = tb.to[0] - tb.x; const dy = tb.to[1] - tb.y; const dd = Math.hypot(dx, dy);
  if (dd < 1) return;
  // would the player force it to stop? (in its forward cone, close)
  const f = [Math.sin(tb.psi), Math.cos(tb.psi)]; const rel = [b.x - tb.x, b.y - tb.y]; const ahead = rel[0] * f[0] + rel[1] * f[1];
  const lat = Math.abs(rel[0] * f[1] - rel[1] * f[0]);
  const blocked = ahead > 0 && ahead < th('impedeCpa', 10) && lat < 4 && speedKn(b) > 0.3;
  if (blocked && !tb.yielded) { tb.yielded = true; g.ph.impeded = true; say(g, 'The other boat has to throttle back for you.', 'warn'); }
  const v = blocked ? 0 : tb.kn / KN;
  tb.x += dx / dd * v * DT; tb.y += dy / dd * v * DT;
  const poly = boatPoly({ x: tb.x, y: tb.y, len: 5.8, headingDeg: tb.psi / D });
  tb.col = prepCollider({ name: 'other_boat', kind: 'vessel', poly });
}

/* ---------- main tick ---------- */
function tick(g) {
  if (g.ended) return;
  const b = g.boat;
  g.t += DT;
  // look history (12 s)
  g.lookHist.push({ t: g.t, yaw: g.look });
  while (g.lookHist.length && g.lookHist[0].t < g.t - 30) g.lookHist.shift();
  trafficTick(g);
  const cols = g.traffic[0]?.col ? [...g.W.colliders, g.traffic[0].col] : g.W.colliders;
  const out = { contacts: [], touching: [] };
  step(b, { ...g.env, colliders: cols }, { wheelDir: g.wheelDir ?? 0 }, out);
  for (const c of out.contacts) contact(g, c);
  if (g.overheatAt && g.t > g.overheatAt && b.running) { g.overheatAt = null; say(g, 'Overheat alarm — no telltale! The intake was blocked.', 'bad'); fail(g, 'T1.3', 'Motor overheated: cooling intake was blocked and not checked.'); }
  t1Tick(g);
  g.ph.tick?.(g);
}

function contact(g, c) {
  if (c.speed < 0.02) return;
  if (c.kind === 'moored' || c.kind === 'vessel') {
    if (c.speed >= th('contactHard', 1.5)) unsafe(g, 'hardHitVessel', `(${(c.speed * KN).toFixed(1)} kn)`);
    else if (c.speed > 0.2) { fail(g, 'T1.3', `Bumped another vessel (${c.name}, ${c.speed.toFixed(1)} m/s).`); say(g, 'You bumped a boat.', 'warn'); }
  } else if (c.kind === 'shore' || c.kind === 'ramp') {
    if (c.speed > 0.8) unsafe(g, 'grounding');
  } else if (c.speed >= th('contactHard', 1.5) * 1.6) unsafe(g, 'hardHitStructure', `(${(c.speed * KN).toFixed(1)} kn)`);
  else if (c.speed >= th('contactHard', 1.5)) fail(g, 'T1.3', `Hit the ${c.kind} hard (${c.speed.toFixed(1)} m/s).`);
  if (c.speed > 0.15) say(g, `Contact with the ${c.kind} at ${c.speed.toFixed(2)} m/s.`, c.speed < th('contactLight', 0.5) ? 'info' : 'warn');
  g.ph.contact?.(g, c);
}

/* Task 1, all the time */
/* local speed zone (DoT South Metro guide, see localRules.js 'rock-8kn-strip'):
   8 kn along the Rockingham foreshore, about 200 m wide */
const STRIP = LOCAL_RULES.find((r) => r.id === 'rock-8kn-strip');
function inStrip(g, p) {
  for (const c of g.W.colliders) if (c.kind === 'shore' && distToPoly(p, c.poly) <= 200) return true;
  return false;
}
function t1Tick(g) {
  const b = g.boat; const kn = speedKn(b); const p = [b.x, b.y];
  if (g.t - (g.zoneAt ?? -9) > 0.5) { g.zoneAt = g.t; g.zone = inStrip(g, p) ? { limit: STRIP?.limitKn ?? 8, name: '8 kn foreshore strip', receipt: STRIP?.receipt } : null; }
  if (kn < 3) { g.over.t11 = 0; g.over.t12 = 0; return; }
  const lim = th('kn8', 8) + th('speedGraceKn', 0.5);
  const near = nearHazard(g, p) <= th('near50', 50);
  const nearMob = g.mob && !g.mob.retrieved && dist(p, [g.mob.x, g.mob.y]) <= th('near50', 50);
  const tb = g.traffic[0]; const nearUnderway = tb && dist(p, [tb.x, tb.y]) <= th('nearUnderway', 15);
  const over = kn > lim;
  if (over && near) { g.over.t11 += DT; if (g.over.t11 > th('speedGrace', 3)) { g.over.t11 = -999; g.strikes.t11++; say(g, `Over 8 knots within 50 m of moored boats / the jetty / the shore.`, 'warn'); if (g.strikes.t11 >= th('t1Strikes', 2)) fail(g, 'T1.1', 'Wash: repeatedly over 8 kn within 50 m of moored boats, the jetty or the shore (p.12, p.92).'); } } else if (g.over.t11 > 0) g.over.t11 = 0;
  if (over && (nearMob || nearUnderway || g.zone)) { g.over.t12 += DT; if (g.over.t12 > th('speedGrace', 3)) { g.over.t12 = -999; g.strikes.t12++; say(g, g.zone && !nearMob && !nearUnderway ? 'Over 8 knots in the foreshore 8-knot area.' : 'Over 8 knots near a person in the water / a vessel under way.', 'warn'); if (g.strikes.t12 >= th('t1Strikes', 2)) fail(g, 'T1.2', 'Speed limits: over 8 kn in the Rockingham foreshore 8-knot area (DoT South Metro guide) or near a person / a vessel under way (p.12).'); } } else if (g.over.t12 > 0) g.over.t12 = 0;
  if (!g.passengers.seated && kn > th('seatedSpeed', 2)) { g.passengers.standT = (g.passengers.standT ?? 0) + DT; if (g.passengers.standT > 6) fail(g, 'T1.4', 'A passenger stood up under way and you didn’t tell them to sit.'); }
  // a passenger stands up once, mid-run (assessment)
  if (g.mode === 'assessment' && g.phase === 't8' && !g.passengers.stoodOnce && g.t - g.ph.t0 > 20) {
    g.passengers.stoodOnce = true; g.passengers.seated = false; g.passengers.standT = 0;
    say(g, 'Your passenger stands up at the bow to take a photo.', 'warn');
    g.prompt = { key: 'sitDown', label: 'Passenger standing', options: [{ value: true, text: '“Sit down please — we’re under way.”' }] };
  }
}

export { speedKn, notchLabel };
