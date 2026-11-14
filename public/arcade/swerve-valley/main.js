/* ============================================================================
   SWERVE VALLEY — the page
   ----------------------------------------------------------------------------
   Never writes networking code: mountArcade() (shared/room.js) owns the room,
   the socket and reconnects; this file renders whatever the server says and
   sends intent back.

   One phone may be THE DRIVER for a leg — that phone runs the bus physics
   locally (steering lag is unforgivable) and reports the bus ~10×/s. Every
   other phone draws the same road from those reports, plus the party on the
   top deck and whatever job has just landed on them (jobs.js). Winery stops
   are stops.js.

   URL flags (testing): ?bot=1  plays itself (robot driver, auto jobs, auto stops)
                        ?drive=1 timer-driven loop (unfocused/headless windows)
                        ?autostart=N  as host, start once N players have picked
   ========================================================================== */

import { mountArcade, shareRoom, escapeHtml } from '/arcade/shared/room.js';
import {
  CAST,
  CAST_IDS,
  CAST_BY_ID,
  WINERIES,
  HOME,
  LEGS,
  STOPS,
  TOD,
  DRINKS,
  TIERS,
  tier,
  PHYS,
  HAZARDS,
  SETPIECES,
  GAMES,
  QUIZ_Q_MS,
  POUR_ROUND_MS,
  buildLeg,
  buildPlatter,
  crossings,
  stepBus,
  partySway,
  impulseDrift,
  safeLine,
  clamp,
} from './world.js';
import { createRoad } from './road.js';
import { createBusView, renderPhoto, BUS_W, BUS_H } from './bus.js';
import { createJobs } from './jobs.js';
import { createStops } from './stops.js';
import * as AU from './audio.js';

const SLUG = 'swerve-valley';
const params = new URLSearchParams(location.search);
const BOT = params.get('bot') === '1';
const TIMER_LOOP = params.get('drive') === '1' || BOT;
const AUTOSTART = parseInt(params.get('autostart') || '0', 10);
const REDUCED = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const $ = (id) => document.getElementById(id);
const nm = (cid) => CAST_BY_ID[cid]?.short || 'Someone';
const full = (cid) => CAST_BY_ID[cid]?.name || 'Someone';

// ── Art ──────────────────────────────────────────────────────────────────────
const ART = { faces: {}, skin: {} };
const ART_BASE = '/arcade/swerve-valley/art/';

function loadImg(src) {
  return new Promise((res) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => res(null);
    im.src = src;
  });
}

async function loadArt() {
  const names = ['cast', 'cast32', 'bus-rear', 'bus-side', 'roo', 'sheep', 'gum', 'cellar'];
  const imgs = await Promise.all(names.map((n) => loadImg(`${ART_BASE}${n}.png`)));
  names.forEach((n, i) => (ART[n] = imgs[i]));
  try {
    const j = await (await fetch(`${ART_BASE}art.json`)).json();
    ART.faces = j.faces || {};
  } catch {
    ART.faces = {};
  }
  // Sample each portrait's cheek so photos can "close their eyes" in skin tone.
  if (ART.cast32) {
    const c = document.createElement('canvas');
    c.width = ART.cast32.width;
    c.height = 32;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(ART.cast32, 0, 0);
    CAST_IDS.forEach((id, i) => {
      const f = ART.faces[id];
      if (!f) return;
      const x = i * 32 + Math.round(f.x / 2 + 1);
      const y = Math.round(f.y / 2 + f.h / 2 - 1);
      const d = g.getImageData(x, y, 1, 1).data;
      if (d[3] > 200) ART.skin[id] = `rgb(${d[0]},${d[1]},${d[2]})`;
    });
  }
}

function portrait(cid, px = 64) {
  const c = document.createElement('canvas');
  c.width = px;
  c.height = px;
  c.className = 'sv-portrait';
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  const i = CAST_IDS.indexOf(cid);
  if (i < 0) return c;
  if (px <= 32 && ART.cast32) g.drawImage(ART.cast32, i * 32, 0, 32, 32, 0, 0, px, px);
  else if (ART.cast) g.drawImage(ART.cast, i * 64, 0, 64, 64, 0, 0, px, px);
  else {
    g.fillStyle = CAST[i].color;
    g.fillRect(0, 0, px, px);
  }
  return c;
}

// ── Clock + state ────────────────────────────────────────────────────────────
let offset = 0;
let clockInit = false;
const now = () => Date.now() + offset;
function syncClock(serverNow) {
  if (!serverNow) return;
  const o = serverNow - Date.now();
  if (!clockInit || Math.abs(o - offset) > 2000) {
    offset = o;
    clockInit = true;
  } else offset += (o - offset) * 0.08;
}

let G = null; //    latest game view
let META = null; // latest room message (seat, host, players, code)
let myCid = null;
let lastPh = null;
let lastStateAt = 0;
let lastHi = 0;
let tourSeed = null;
const seenEv = new Set();
const trackCache = new Map();
function trackFor(seed, leg) {
  const k = `${seed}:${leg}`;
  let t = trackCache.get(k);
  if (!t) {
    t = buildLeg(seed, leg);
    trackCache.set(k, t);
    if (trackCache.size > 4) trackCache.delete(trackCache.keys().next().value);
  }
  return t;
}

const tipOf = (cid) => (G?.ch ? G.ch[CAST_IDS.indexOf(cid)]?.[0] || 0 : 0);
const tierOf = (cid) => tier(tipOf(cid));
const isHuman = (cid) => !!(G?.hm && G.hm[cid]);
const amDriver = () => !!(myCid && G?.driver === myCid);

// The api handed to jobs.js and stops.js.
const api = {
  send: (m) => room.send(m),
  now,
  me: () => myCid,
  view: () => G,
  tip: tipOf,
  tier: tierOf,
  name: nm,
  fullName: full,
  wear: (cid) => CAST_BY_ID[cid]?.wear || 'hat',
  isHuman,
  portrait,
  sfx: (n) => AU.sfx(n),
  haptic: (ms) => AU.haptic(ms),
  seed: () => G?.seed,
  stop: () => G?.stop,
};

// ── Room ─────────────────────────────────────────────────────────────────────
const gateEl = $('gate');
const gameEl = $('game');
let room = null;
let jobs = null;
let stops = null;
let road = null;
let busView = null;
let storyBus = null;

await loadArt();

room = mountArcade({
  slug: SLUG,
  title: 'Swerve Valley',
  tagline: 'Five cellar doors. One bus. Nobody is sitting down.',
  soloNote:
    'Up to eleven phones, one per person on the tour. Alone? You drive every leg and the rest of the party comes along anyway.',
  createLabel: 'Book the bus',
  namePlaceholder: 'Your name',
  gateEl,
  onState,
  onJoined: () => {
    gateEl.hidden = true;
    gameEl.hidden = false;
    $('code').textContent = room.code() || '';
  },
});

window.__sv = {
  state: () => G,
  meta: () => META,
  room,
  me: () => myCid,
  drv: () => drv,
  now,
};

function onState(msg) {
  syncClock(msg.serverNow);
  META = msg;
  const gap = Date.now() - lastStateAt;
  lastStateAt = Date.now();
  G = msg.game || {};
  myCid = G.me || null;
  // Wake the room if it paused while everybody was away (and say hello after
  // any long silence — a reconnect).
  if ((G.idle && Date.now() - lastHi > 800) || gap > 2500) {
    lastHi = Date.now();
    room.send({ t: 'hi' });
  }
  if (G.seed && G.seed !== tourSeed) {
    tourSeed = G.seed;
    seenEv.clear();
    resetLeg();
  }
  $('code').textContent = msg.code || '';
  header();
  route();
  processEvents();
  if (BOT) botState();
}

// ── Header ───────────────────────────────────────────────────────────────────
let headSig = '';
function header() {
  const chip = $('me-chip');
  if (!myCid) {
    chip.hidden = true;
    return;
  }
  chip.hidden = false;
  const tr = tierOf(myCid);
  const sig = `${myCid}:${tr}:${G.ph}`;
  if (sig !== headSig) {
    headSig = sig;
    const c = chip.querySelector('canvas');
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.clearRect(0, 0, 32, 32);
    if (ART.cast32) g.drawImage(ART.cast32, CAST_IDS.indexOf(myCid) * 32, 0, 32, 32, 0, 0, 32, 32);
    $('me-name').textContent = nm(myCid);
    $('me-tier').textContent = G.ph === 'lobby' ? '' : amDriver() && G.ph === 'drive' ? 'Driving' : TIERS[tr].name;
  }
  // tipsy sway on the whole stage (never for the driver while driving)
  const stage = $('stage');
  const sway = G.ph !== 'lobby' && G.ph !== 'ending' && !(G.ph === 'drive' && amDriver()) ? tr : 0;
  if (sway > 0 && !REDUCED) {
    stage.classList.add('sv-sway');
    stage.style.setProperty('--sway', `${[0, 0.5, 1.1, 1.8, 2.4][sway]}deg`);
    stage.style.setProperty('--swayx', `${[0, 2, 4, 7, 9][sway]}px`);
    stage.style.setProperty('--sway-s', `${[4, 4.2, 3.4, 2.8, 2.4][sway]}s`);
  } else stage.classList.remove('sv-sway');
  AU.setWobble(G.ph === 'drive' && amDriver() ? 0 : tr / 4);
}

// ── Screen routing ───────────────────────────────────────────────────────────
const SCREENS = ['sc-lobby', 'sc-story', 'sc-drive', 'sc-stops'];
function show(id) {
  for (const s of SCREENS) $(s).hidden = s !== id;
}

function route() {
  const ph = G.ph;
  if (ph !== lastPh) {
    onPhaseChange(lastPh, ph);
    lastPh = ph;
  }
  if (ph === 'lobby') {
    show('sc-lobby');
    renderLobby();
  } else if (ph === 'brief' || ph === 'arrive' || ph === 'tally' || ph === 'ending') {
    show('sc-story');
    renderStory();
  } else if (ph === 'drive') {
    show('sc-drive');
    driveState();
  } else if (ph === 'pour' || ph === 'game') {
    show('sc-stops');
  }
  if (stops) stops.update(G);
  else if (ph === 'pour' || ph === 'game') {
    stops = createStops($('stops'), api);
    stops.update(G);
  }
  renderPick();
}

function onPhaseChange(from, to) {
  storySig = '';
  AU.setMusic(to === 'lobby' ? 'lobby' : to === 'drive' ? 'drive' : to === 'ending' ? 'end' : 'stop');
  if (to === 'drive') resetLeg();
  if (to !== 'drive') AU.setEngine(false);
  if (to === 'ending') AU.sfx('fanfare');
  if (to === 'pour') AU.sfx('clink');
  $('stage').scrollTop = 0;
}

// ── Lobby ────────────────────────────────────────────────────────────────────
let lobbySig = '';
function renderLobby() {
  const el = $('sc-lobby');
  const players = META?.players || [];
  const sig = JSON.stringify([G.hm, players, META?.host, myCid]);
  if (sig === lobbySig) return;
  lobbySig = sig;
  const nameOfSeat = (seat) => players.find((p) => p.seat === seat)?.name || 'Someone';
  const host = players.find((p) => p.host);
  const ready = Object.values(G.hm || {}).filter(([, on]) => on).length;

  el.innerHTML = `
    <div class="sv-room">
      <div><small>Room code</small><b>${escapeHtml(META?.code || '')}</b></div>
      <button class="sv-btn sv-btn--ghost" id="lb-share" type="button">Share link</button>
    </div>
    <h1 class="sv-h1">Who are you?</h1>
    <p class="sv-p sv-dim">Everybody on the tour is somebody on this list. Tap yourself. Whoever nobody picks still comes along — and causes trouble on their own.</p>
    <div class="sv-cast" id="lb-cast"></div>
    <hr class="sv-rule" />
    ${
      META?.host
        ? `<button class="sv-btn" id="lb-go" type="button" ${myCid ? '' : 'disabled'}>Start the tour${ready > 1 ? ` (${ready} aboard)` : ''}</button>
           <p class="sv-p sv-dim">${myCid ? 'Start whenever everyone has picked. People can still jump on later.' : 'Pick who you are first.'}</p>`
        : `<p class="sv-p">Waiting for <b>${escapeHtml(host?.name || 'the host')}</b> to start the tour…</p>`
    }
    <h2 class="sv-h2">How the day works</h2>
    <ul class="sv-how">
      <li><b>One phone drives each leg.</b> Steer the bus round the bends and past the roos, take the right turn at the fork and park on the line. The driver is always on grape juice.</li>
      <li><b>Everyone else is in the back.</b> Catch bottles, pull people down from their toasts, lean into the bends and smile for photos. Every job you fumble shoves the bus sideways under the driver.</li>
      <li><b>At each cellar door</b> pick your pour — spit, sip, glass or skull it — then play that winery's game. More wine, more points… and a wobblier phone.</li>
      <li><b>The keys</b> go to the soberest person who hasn't driven yet. Drink accordingly.</li>
    </ul>
  `;
  const grid = el.querySelector('#lb-cast');
  for (const c of CAST) {
    const owner = G.hm?.[c.id];
    const mine = c.id === myCid;
    const state = mine ? 'mine' : owner ? (owner[1] ? 'taken' : 'away') : 'free';
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'sv-card';
    b.dataset.state = state;
    b.dataset.cid = c.id;
    b.appendChild(portrait(c.id, 64));
    const label = mine ? 'You' : owner ? (owner[1] ? escapeHtml(nameOfSeat(owner[0])) : `${escapeHtml(nameOfSeat(owner[0]))} (away)`) : 'Free';
    b.insertAdjacentHTML('beforeend', `<b>${escapeHtml(c.name)}</b><small>${label}</small>`);
    b.addEventListener('click', () => {
      if (state === 'taken') return;
      AU.initAudio();
      AU.sfx('tap');
      room.send({ t: 'pick', cid: c.id });
    });
    grid.appendChild(b);
  }
  el.querySelector('#lb-share')?.addEventListener('click', share);
  el.querySelector('#lb-go')?.addEventListener('click', () => {
    AU.initAudio();
    room.send({ t: 'start' });
  });
}

async function share() {
  toastKind = null;
  const r = await shareRoom(SLUG, room.code(), 'Swerve Valley');
  if (r === 'copied') toast('Link copied — send it to the group chat.', { tone: 'good' });
}
$('share').addEventListener('click', share);

// Late joiners (mid-tour, no character yet) pick from whoever is free.
let pickSig = '';
function renderPick() {
  const el = $('pick');
  const need = G.ph && G.ph !== 'lobby' && !myCid;
  if (!need) {
    el.hidden = true;
    pickSig = '';
    return;
  }
  el.hidden = false;
  const free = CAST.filter((c) => !(G.hm?.[c.id] && G.hm[c.id][1]));
  const sig = free.map((c) => c.id).join();
  if (sig === pickSig) return;
  pickSig = sig;
  el.innerHTML = `<div class="sv-scroll"><h1 class="sv-h1">You're jumping on mid-tour</h1>
    <p class="sv-p">The bus is already rolling. Pick who you are — you'll take over from wherever they're up to.</p>
    <div class="sv-cast" id="pk-cast"></div></div>`;
  const grid = el.querySelector('#pk-cast');
  for (const c of free) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'sv-card';
    b.appendChild(portrait(c.id, 64));
    b.insertAdjacentHTML('beforeend', `<b>${escapeHtml(c.name)}</b><small>${TIERS[tierOf(c.id)].name}</small>`);
    b.addEventListener('click', () => room.send({ t: 'pick', cid: c.id }));
    grid.appendChild(b);
  }
}

// ── Story screens: brief, arrive, tally, ending ──────────────────────────────
let storySig = '';
function renderStory() {
  const el = $('sc-story');
  const ph = G.ph;
  const sig = ph === 'ending' ? `end:${G.seed}:${myCid}:${META?.host}` : `${ph}:${G.leg}:${G.stop}:${G.nextDriver}:${myCid}:${!!G.tally}`;
  if (sig === storySig) return;
  storySig = sig;
  storyBus = null;
  if (ph === 'brief') el.innerHTML = briefHtml();
  else if (ph === 'arrive') el.innerHTML = arriveHtml();
  else if (ph === 'tally') el.innerHTML = tallyHtml();
  else el.innerHTML = endingHtml();
  // portraits are canvases: fill their slots
  el.querySelectorAll('[data-portrait]').forEach((slot) => {
    const c = portrait(slot.dataset.portrait, Number(slot.dataset.px || 64));
    slot.replaceWith(c);
  });
  const sb = el.querySelector('#story-bus');
  if (sb) storyBus = createBusView(sb, ART);
  if (ph === 'ending') fillEnding(el);
}

function keysHtml(cid, why) {
  if (!cid) return '';
  return `<div class="sv-keys"><i data-portrait="${cid}" data-px="64"></i><div><b>Keys &rarr; ${escapeHtml(full(cid))}${cid === myCid ? ' (you!)' : ''}</b><span>${why}</span></div></div>`;
}

function briefHtml() {
  const me = myCid;
  const driving = me && me === G.driver;
  const role = !me
    ? ''
    : driving
      ? `<b>You're driving first.</b> Drag the wheel to steer, hold BRAKE to stop on the line at each car park. ${G.nav ? '' : 'Signs at the fork tell you where to go.'}`
      : `<b>You're in the back.</b> Jobs will pop up on your phone — do them fast, lean when told to, and keep the bus steady for ${escapeHtml(nm(G.driver))}.`;
  return `
    <p class="sv-p sv-dim" style="margin-top:6px">Swerve Valley Tours &middot; 9:45 am</p>
    <h1 class="sv-h1">All aboard!</h1>
    <div class="sv-busrow"><canvas id="story-bus" width="${BUS_W}" height="${BUS_H}"></canvas></div>
    ${keysHtml(G.driver, 'First driver. On the grape juice, as all good designated drivers are.')}
    <p class="sv-p">${role}</p>
    <h2 class="sv-h2">Today's cellar doors</h2>
    <p class="sv-p sv-dim">In an order only the navigators know.</p>
    <ul class="sv-itin">
      ${WINERIES.map(
        (w) =>
          `<li><i>${escapeHtml(w.wine.split(' ')[0])}</i><span class="sv-dot" style="background:${w.colour}"></span><span><b>${escapeHtml(w.name)}</b> <span class="sv-dim">&middot; ${escapeHtml(GAMES[w.game].title)}</span></span></li>`,
      ).join('')}
      <li><i>Then</i><span class="sv-dot" style="background:#fff"></span><span><b>Home</b> <span class="sv-dim">&middot; at dusk. Kangaroo o'clock.</span></span></li>
    </ul>
    <div class="sv-countdown" data-ends="Departing in"></div>`;
}

const PARK_COPY = {
  perfect: ['PERFECT PARK!', 'Right on the line. The cellar door staff applauded.', 'var(--sv-green)'],
  ok: ['PARKED.', 'Close enough for a bus.', 'var(--sv-gold)'],
  miss: ['PARKED… ISH', 'Across three spaces and a garden bed.', '#ff9b6b'],
  hedge: ['INTO THE HEDGE', 'The hedge will recover. Probably.', 'var(--sv-red)'],
  tow: ['TOWED IN', 'The tour company sent a tow truck. They were not happy.', 'var(--sv-red)'],
  auto: ['AUTOPILOT PARKED IT', 'Nobody had their hands on the wheel. Worrying.', 'var(--sv-sky)'],
};

function arriveHtml() {
  const wi = G.winery ?? G.order?.[G.stop];
  const w = WINERIES[wi] || WINERIES[0];
  const p = G.parked || {};
  const pc = PARK_COPY[p.q] || PARK_COPY.ok;
  const log = G.legLog || {};
  const hits = {};
  for (const h of log.hits || []) hits[h.k] = (hits[h.k] || 0) + 1;
  const chips = Object.entries(hits).map(
    ([k, n]) => `<span style="--c:var(--sv-red)">${escapeHtml(HAZARDS[k]?.label.replace('!', '') || k)}${n > 1 ? ` &times;${n}` : ''}</span>`,
  );
  if (!chips.length) chips.push('<span style="--c:var(--sv-green)">Not a scratch</span>');
  if (log.wrong) chips.push('<span style="--c:#ff9b6b">Wrong turn</span>');
  if (log.offroad > 1) chips.push(`<span style="--c:#c8a06a">${Math.round(log.offroad)} s on the gravel</span>`);
  const next = G.nextDriver;
  return `
    <div class="sv-scene">
      <img class="sv-cellar" src="${ART_BASE}cellar.png" alt="" />
      <img class="sv-busside" src="${ART_BASE}bus-side.png" alt="" />
      <div class="sv-road"></div>
    </div>
    <p class="sv-p sv-dim">${TOD[(G.stop ?? 0) + 1]?.clock || ''} &middot; Stop ${(G.stop ?? 0) + 1} of ${STOPS}</p>
    <h1 class="sv-h1" style="color:${w.colour === '#e6e08a' || w.colour === '#e9d27a' ? 'var(--sv-gold)' : '#ffd0dc'}">${escapeHtml(w.name)}</h1>
    <div class="sv-result" style="color:${pc[2]}">${pc[0]}</div>
    <p class="sv-p">${pc[1]}</p>
    <div class="sv-chips">${chips.join('')}</div>
    <p class="sv-p sv-dim">${escapeHtml(full(log.driver))} drove: +${log.score || 0} fun.</p>
    ${keysHtml(
      next,
      next === myCid && Object.keys(G.hm || {}).length > 1
        ? 'You have the next leg — grape juice for you at this one.'
        : (G.drives?.[next] || 0) > 0
          ? 'Soberest on the bus — back behind the wheel. Grape juice at this stop.'
          : 'Soberest person on the bus who hasn’t driven yet. Grape juice at this stop.',
    )}
    <div class="sv-countdown" data-ends="Tasting in"></div>`;
}

const DRINK_SHORT = { spit: 'Spit', sip: 'Sip', glass: 'Glass', skull: 'Skull', juice: 'Juice' };

function tallyHtml() {
  const t = G.tally;
  if (!t) return '<p class="sv-p">Counting…</p>';
  const w = WINERIES[t.winery];
  const game = GAMES[t.game];
  const top = t.rank.slice(0, 3);
  const podium = [top[1], top[0], top[2]].filter(Boolean);
  const myRank = t.rank.findIndex((r) => r.id === myCid);
  const party = CAST_IDS.map((id, i) => {
    const tip = G.ch[i][0];
    // Only the people actually playing get their pour printed.
    const drink = isHuman(id) ? DRINK_SHORT[t.drinks[id]] || '' : '·';
    return `<div><i data-portrait="${id}" data-px="32"></i><span class="sv-bar"><i style="height:${tip}%"></i></span><small>${drink}</small></div>`;
  }).join('');
  return `
    <p class="sv-p sv-dim" style="margin-top:6px">${escapeHtml(w.name)} &middot; ${escapeHtml(game.title)}</p>
    <h1 class="sv-h1">Results</h1>
    <div class="sv-podium">${podium
      .map((r) => `<div><i data-portrait="${r.id}" data-px="64"></i><b>${escapeHtml(nm(r.id))}</b><em>${r.sc}</em></div>`)
      .join('')}</div>
    ${myRank >= 0 ? `<p class="sv-p">You came <b>${ordinal(myRank + 1)}</b> — +${t.rank[myRank].pts} fun.</p>` : ''}
    <h2 class="sv-h2">Who drank what</h2>
    <div class="sv-party">${party}</div>
    <p class="sv-p sv-dim">Bars are how tipsy everyone is. The fuller the bar, the wobblier the phone.</p>
    <p class="sv-p">Tour rating <span class="sv-stars">${stars(G.rating)}</span></p>
    ${keysHtml(t.nextDriver, 'Back on the bus. Keys, juice, seatbelts.')}
    <div class="sv-countdown" data-ends="Back on the bus in"></div>`;
}

function endingHtml() {
  const f = G.final;
  if (!f) return '';
  const myAward = myCid ? f.awards[myCid] : null;
  const humans = new Set(Object.keys(G.hm || {}));
  const awardOrder = CAST_IDS.slice().sort((a, b) => (humans.has(b) ? 1 : 0) - (humans.has(a) ? 1 : 0));
  return `
    <div class="sv-ending" style="text-align:left">
      <p class="sv-p sv-dim" style="margin-top:6px">Swerve Valley Tours &middot; 6:40 pm &middot; back at the pickup</p>
      <h1 class="sv-h1">${escapeHtml(f.ending.title)}</h1>
      <p class="sv-stars" style="font-size:18px;margin:4px 0 10px">${stars(f.rating)}</p>
      <div class="sv-paper"><p class="sv-p"><b>${escapeHtml(f.ending.line)}</b></p><p class="sv-p" style="margin:0">${escapeHtml(f.ending.body)}</p></div>
      ${
        myAward
          ? `<h2 class="sv-h2">Your award</h2>
             <div class="sv-award" data-me="1"><i data-portrait="${myCid}" data-px="64"></i><div><small>${escapeHtml(full(myCid))}</small><b>${escapeHtml(myAward.title)}</b><span>${escapeHtml(myAward.line)}</span></div></div>`
          : ''
      }
      <h2 class="sv-h2">The day in photos</h2>
      <div class="sv-album" id="album"></div>
      <h2 class="sv-h2">Everyone's awards</h2>
      <div class="sv-awards">${awardOrder
        .filter((id) => id !== myCid)
        .map((id) => {
          const a = f.awards[id];
          return `<div class="sv-award"><i data-portrait="${id}" data-px="64"></i><div><small>${escapeHtml(full(id))}${humans.has(id) ? '' : ' &middot; came along anyway'}</small><b>${escapeHtml(a.title)}</b><span>${escapeHtml(a.line)}</span></div></div>`;
        })
        .join('')}</div>
      <h2 class="sv-h2">Most fun had</h2>
      <ol class="sv-rank">${f.ranking
        .map((r) => `<li data-h="${humans.has(r.id) ? 1 : 0}"><i data-portrait="${r.id}" data-px="32"></i>${escapeHtml(full(r.id))}<em>${r.fun}</em></li>`)
        .join('')}</ol>
      ${
        META?.host
          ? '<button class="sv-btn" id="again" type="button">Book another tour</button>'
          : '<p class="sv-p sv-dim" style="margin-top:16px">The host can book another tour.</p>'
      }
    </div>`;
}

function fillEnding(el) {
  const album = el.querySelector('#album');
  if (album) {
    const photos = G.photos || [];
    if (!photos.length) album.innerHTML = '<p class="sv-p sv-dim">Nobody took any. Classic.</p>';
    photos.forEach((p, i) => {
      const d = document.createElement('div');
      d.className = 'sv-polaroid';
      d.style.setProperty('--r', `${(i % 2 ? 1 : -1) * (0.6 + (i % 3) * 0.5)}deg`);
      const c = document.createElement('canvas');
      c.width = BUS_W;
      c.height = BUS_H;
      const wine = p.leg > 0 ? WINERIES[G.order[p.leg - 1]]?.colour : null;
      renderPhoto(c, ART, p, TOD[p.leg], wine);
      d.appendChild(c);
      const where = p.leg < STOPS ? `on the way to ${WINERIES[G.order[p.leg]]?.name}` : 'on the way home';
      const smiles = Object.values(p.who).filter((x) => x === 's').length;
      const blinks = Object.entries(p.who).filter(([, x]) => x === 'b').map(([id]) => nm(id));
      const sleepers = Object.entries(p.who).filter(([, x]) => x === 'z').map(([id]) => nm(id));
      let cap = `${TOD[p.leg].clock}, ${where}. ${smiles} smiling.`;
      if (blinks.length) cap += ` ${listNames(blinks)} blinked.`;
      if (sleepers.length) cap += ` ${listNames(sleepers)} ${sleepers.length > 1 ? 'were' : 'was'} asleep.`;
      d.insertAdjacentHTML('beforeend', `<p>${escapeHtml(cap)}</p>`);
      album.appendChild(d);
    });
  }
  el.querySelector('#again')?.addEventListener('click', () => room.send({ t: 'rematch' }));
}

function listNames(a) {
  if (a.length <= 1) return a.join('');
  return `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`;
}
function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
function stars(rating) {
  const r = Math.round(((rating ?? 100) / 20) * 2) / 2;
  let out = '';
  for (let i = 1; i <= 5; i++) out += r >= i ? '★' : r >= i - 0.5 ? '<i style="color:rgba(255,207,90,0.62)">★</i>' : '<i>★</i>';
  return out;
}

// ── The drive ────────────────────────────────────────────────────────────────
const drv = {
  bus: null,
  tp: -1,
  leg: -1,
  steer: 0,
  steerTarget: 0,
  keySteer: 0,
  brake: false,
  keyBrake: false,
  lastSend: 0,
  judged: new Set(),
  side: null,
};
const spec = { z: 0, x: 0, v: 0, init: false, leg: -1, side: null };
const fx = { knock: new Map(), spotted: new Set(), nearFork: false, shake: 0, flash: 0, jolt: 0, legWrong: false, splatKey: null, splatWiped: 0, splatN: 0, splatSeed: 1 };

function resetLeg() {
  drv.bus = null;
  drv.tp = -1;
  drv.judged = new Set();
  drv.side = null;
  spec.init = false;
  spec.side = null;
  fx.knock = new Map();
  fx.spotted = new Set();
  fx.legWrong = false;
  fx.splatKey = null;
  fx.splatN = 0;
}

function driveState() {
  const el = $('sc-drive');
  const driver = amDriver();
  el.classList.toggle('is-driver', driver);
  el.classList.toggle('is-passenger', !driver);
  if (!road) {
    road = createRoad($('road'), ART);
    busView = createBusView($('bus'), ART);
    new ResizeObserver(() => road.resize()).observe($('roadwrap'));
    // Passengers: tap a hazard on the road to warn the driver.
    $('road').addEventListener('pointerdown', (e) => {
      if (G?.ph !== 'drive' || !myCid || amDriver()) return;
      const r = $('road').getBoundingClientRect();
      const id = road.pick((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
      if (!id || fx.spotted.has(id)) return;
      fx.spotted.add(id);
      AU.initAudio();
      AU.sfx('tap');
      room.send({ t: 'spot', id });
    });
  }
  if (!driver && myCid) {
    if (!jobs) jobs = createJobs($('jobs'), api);
    jobs.update(G);
  }
  // splat: a new one resets the wipe count
  const sp = G.splat;
  const key = sp ? `${sp.at}` : null;
  if (key && key !== fx.splatKey) {
    fx.splatKey = key;
    fx.splatN = sp.n;
    fx.splatWiped = 0;
    fx.splatSeed = (sp.at % 9973) + 1;
  }
}

function driveFrame(t, dt) {
  if (!road || !G.bus) return;
  const track = trackFor(G.seed, G.leg);
  const driver = amDriver();
  let z;
  let x;
  let v;
  let side;
  if (driver) {
    if (!drv.bus || drv.tp !== G.bus.tp || drv.leg !== G.leg) {
      drv.bus = { z: G.bus.z, x: G.bus.x, v: G.bus.v };
      drv.tp = G.bus.tp;
      drv.leg = G.leg;
      drv.judged = new Set(track.haz.filter((h) => h.cz <= G.bus.z).map((h) => h.id));
      if (G.bus.z > track.forkZ) drv.side = track.forkSide;
    }
    const steerIn = drv.keySteer || drv.steerTarget;
    drv.steer += (steerIn - drv.steer) * Math.min(1, dt * 14);
    const brake = drv.brake || drv.keyBrake;
    const pen = G.bus.pen && G.bus.pen > t;
    const env = { drift: partySway(G.party || 0, t) + impulseDrift(G.imps, t), grip: G.grip ? G.grip.g : 1 };
    // substep so a slow frame can't tunnel through a sheep
    let left = dt;
    while (left > 0) {
      const h = Math.min(left, 1 / 60);
      left -= h;
      const prev = drv.bus;
      drv.bus = stepBus(track, prev, { steer: drv.steer, brake, hold: pen }, h, env);
      for (const c of crossings(track, prev.z, prev.x, drv.bus.z, drv.bus.x, drv.judged)) {
        drv.judged.add(c.h.id);
        if (c.hit) {
          drv.bus = { ...drv.bus, v: drv.bus.v * PHYS.HIT_SLOW };
          localHit(c.h, t);
        }
      }
      if (prev.z < track.forkZ && drv.bus.z >= track.forkZ) {
        const tt = (track.forkZ - prev.z) / Math.max(1, drv.bus.z - prev.z);
        drv.side = prev.x + (drv.bus.x - prev.x) * tt < 0 ? -1 : 1;
      }
    }
    if (t - drv.lastSend >= 100) {
      room.send({ t: 'pos', z: Math.round(drv.bus.z), x: Math.round(drv.bus.x * 1000) / 1000, v: Math.round(drv.bus.v), tp: drv.tp });
      drv.lastSend = t;
    }
    ({ z, x, v } = drv.bus);
    side = drv.side;
    AU.setEngine(true, v / PHYS.MAX_V);
    $('brake').dataset.on = brake ? '1' : '0';
  } else {
    const b = G.bus;
    const age = clamp(t - b.at, 0, 450);
    const tz = b.pen > t ? b.z : b.z + (b.v * age) / 1000;
    if (!spec.init || spec.leg !== G.leg || Math.abs(tz - spec.z) > 4000) {
      spec.z = tz;
      spec.x = b.x;
      spec.leg = G.leg;
      spec.init = true;
    }
    const pz = spec.z;
    spec.z += (b.pen > t ? 0 : b.v * dt) + (tz - spec.z) * Math.min(1, dt * 3);
    spec.x += (b.x - spec.x) * Math.min(1, dt * 7);
    spec.v = b.v;
    if (pz < track.forkZ && spec.z >= track.forkZ && spec.side == null) spec.side = spec.x < 0 ? -1 : 1;
    ({ z, x, v } = spec);
    side = spec.side;
    AU.setEngine(false);
  }
  if (z > track.forkZ && G.bus.side) side = G.bus.side; // the server's verdict wins
  if (z > track.forkZ && (fx.legWrong || (G.bus.pen && G.bus.pen > t))) side = track.forkSide;
  if (z <= track.forkZ) side = null;
  else if (side == null) side = x < 0 ? -1 : 1;

  fx.shake = Math.max(0, fx.shake - dt * 18);
  fx.jolt = Math.max(0, fx.jolt - dt * 1.6);
  const drift = impulseDrift(G.imps, t);
  road.render(track, {
    z,
    x,
    v,
    side,
    t,
    leg: G.leg,
    seed: G.seed,
    knock: fx.knock,
    steer: driver ? drv.steer : 0,
    brake: driver ? drv.brake || drv.keyBrake : false,
    tilt: (driver ? drv.steer * 0.03 : 0) + drift * 0.1 + fx.jolt * Math.sin(t / 45) * 0.05,
    shake: fx.shake,
    flash: fx.flash,
    spotted: driver ? new Set(G.spotted || []) : fx.spotted,
    splat: driver && fx.splatN - fx.splatWiped * 2 > 0 ? { n: fx.splatN - fx.splatWiped * 2, seed: fx.splatSeed } : null,
  });

  if (!driver && busView) {
    const st = {};
    CAST_IDS.forEach((id, i) => {
      const c = G.ch[i];
      st[id] = { tip: c[0], asleep: !!(c[2] & 1), lost: !!(c[2] & 2) };
    });
    const standing = new Set();
    let lean = 0;
    for (const j of G.jobs || []) {
      if (t < j.at) continue;
      if (j.k === 'sitdown') standing.add(j.open ? j.cid : j.sub);
      if (j.k === 'lean' && t < j.end) lean = j.dir || 0;
    }
    const tod = TOD[G.leg] || TOD[0];
    const lastWinery = G.leg > 0 ? WINERIES[G.order[G.leg - 1]] : null;
    busView.render({
      t,
      v: v / PHYS.MAX_V,
      leg: G.leg,
      dusk: tod.dusk,
      driver: G.driver,
      me: myCid,
      st,
      standing,
      lean,
      jolt: fx.jolt,
      glasses: G.leg > 0,
      wine: lastWinery?.colour,
      sky: tod.sky,
      ground: tod.ground[0],
      party: G.party || 0,
    });
  }

  hud(track, z, v, t, driver);
}

function localHit(h, t) {
  fx.knock.set(h.id, t);
  fx.shake = 7;
  fx.flash = t;
  fx.jolt = 1;
  AU.sfx(h.k === 'roo' ? 'boing' : h.k === 'sheep' ? 'baa' : 'bonk');
  AU.haptic(90);
}

let hudSig = '';
function hud(track, z, v, t, driver) {
  const tod = TOD[G.leg] || TOD[0];
  const destName = G.dest == null ? null : G.dest === 'home' ? HOME.name : WINERIES[G.dest]?.name;
  const dest = destName ? escapeHtml(destName) : G.nav ? `??? ask ${escapeHtml(nm(G.nav))}` : '???';
  const who = driver ? (G.nav ? `Navigator: ${escapeHtml(nm(G.nav))}` : 'You drive') : `Driver: ${escapeHtml(nm(G.driver))}`;
  const sig = `${G.leg}:${dest}:${who}:${G.rating}`;
  if (sig !== hudSig) {
    hudSig = sig;
    $('hud').innerHTML = `<div><b>${tod.clock}</b> &middot; Leg ${G.leg + 1}/${LEGS}<br />&rarr; ${dest}</div><div style="text-align:right"><span class="sv-stars">${stars(G.rating)}</span><br />${who}</div>`;
  }

  // fork signs
  const fork = $('fork');
  const nearFork = z > track.forkZ - 30000 && z < track.forkZ + 300;
  fx.nearFork = nearFork && z < track.forkZ;
  if (nearFork && G.signs) {
    if (fork.hidden || fork.dataset.leg !== String(G.leg)) {
      fork.dataset.leg = String(G.leg);
      fork.innerHTML = `<span>&larr; ${escapeHtml(G.signs[0])}</span><span>${escapeHtml(G.signs[1])} &rarr;</span>`;
    }
    fork.hidden = false;
  } else fork.hidden = true;

  // prompts
  const prompt = $('prompt');
  let p = null;
  const inPark = z > track.parkZ - PHYS.PARK_LEAD;
  if (G.bus.pen && G.bus.pen > t) p = null;
  else if (driver && t - (G.legStart || 0) < 3200 && z < track.startZ + 6000) p = 'GO! <small>drag to steer &middot; hold BRAKE to stop</small>';
  else if (driver && nearFork && z < track.forkZ) p = G.nav ? `WHICH WAY? <small>ask ${escapeHtml(nm(G.nav))}!</small>` : `KEEP ${track.forkSide < 0 ? 'LEFT' : 'RIGHT'} <small>for ${escapeHtml(destName || '')}</small>`;
  else if (!driver && inPark) p = 'PARKING… <small>everybody hold on</small>';
  let top = false;
  if (driver && inPark && !(G.bus.pen && G.bus.pen > t)) {
    // A live distance to the line, up top where the bus can't cover it.
    const d = track.parkZ - z;
    const m = Math.round(d / 100);
    top = true;
    if (Math.abs(d) <= PHYS.PARK_PERFECT) p = v > 30 ? 'STOP! <small>you are on the line</small>' : 'ON THE LINE';
    else if (d > 0) p = `BRAKE <small>white line in ${m} m</small>`;
    else p = `TOO FAR! <small>${-m} m past the line</small>`;
  }
  if (p) {
    if (prompt.innerHTML !== p) prompt.innerHTML = p;
    prompt.dataset.top = top ? '1' : '0';
    prompt.hidden = false;
  } else prompt.hidden = true;
  $('brake').dataset.hot = driver && inPark && v > 30 ? '1' : '0';

  // navigator card (passenger who knows the way)
  const nav = $('nav');
  if (!driver && myCid && myCid === G.nav && destName) {
    const hot = nearFork && z < track.forkZ ? '1' : '0';
    const html = `<b>NAVIGATOR</b><span>Next stop: <b>${escapeHtml(destName)}</b>. ${hot === '1' ? `Tell ${escapeHtml(nm(G.driver))} which way — NOW!` : `Only you know. Tell ${escapeHtml(nm(G.driver))} at the fork.`}</span>`;
    if (nav.dataset.sig !== html + hot) {
      nav.dataset.sig = html + hot;
      nav.innerHTML = html;
      nav.dataset.hot = hot;
    }
    nav.hidden = false;
  } else nav.hidden = true;

  // wrong-turn overlay
  const wrong = $('wrong');
  if (G.bus.pen && G.bus.pen > t) {
    wrong.hidden = false;
    wrong.innerHTML = `WRONG TURN!<small>Chucking a U-ey&hellip; ${Math.ceil((G.bus.pen - t) / 1000)}</small>`;
  } else wrong.hidden = true;

  // wipers
  const wipe = $('wipe');
  wipe.hidden = !(driver && fx.splatN - fx.splatWiped * 2 > 0);
}

// ── Driver controls ──────────────────────────────────────────────────────────
(function controls() {
  const pad = $('pad');
  let startX = null;
  let pid = null;
  pad.addEventListener('pointerdown', (e) => {
    AU.initAudio();
    pid = e.pointerId;
    startX = e.clientX;
    pad.setPointerCapture(e.pointerId);
    drv.steerTarget = 0;
  });
  pad.addEventListener('pointermove', (e) => {
    if (e.pointerId !== pid || startX == null) return;
    const span = Math.min(70, pad.clientWidth * 0.28);
    drv.steerTarget = clamp((e.clientX - startX) / span, -1, 1);
  });
  const up = (e) => {
    if (e.pointerId !== pid) return;
    startX = null;
    pid = null;
    drv.steerTarget = 0;
  };
  pad.addEventListener('pointerup', up);
  pad.addEventListener('pointercancel', up);

  const brake = $('brake');
  brake.addEventListener('pointerdown', (e) => {
    AU.initAudio();
    drv.brake = true;
    brake.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) brake.addEventListener(ev, () => (drv.brake = false));
  $('horn').addEventListener('click', () => room.send({ t: 'horn' }));
  $('wipe').addEventListener('click', () => {
    fx.splatWiped++;
    AU.sfx('swoosh');
  });

  const keys = new Set();
  const sync = () => {
    drv.keySteer = (keys.has('right') ? 1 : 0) - (keys.has('left') ? 1 : 0);
    drv.keyBrake = keys.has('brake');
  };
  const map = { ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right', ArrowDown: 'brake', s: 'brake', S: 'brake', ' ': 'brake' };
  addEventListener('keydown', (e) => {
    if (e.target?.tagName === 'INPUT') return;
    const k = map[e.key];
    if (k) {
      keys.add(k);
      sync();
      if (G?.ph === 'drive') e.preventDefault();
    }
    if ((e.key === 'h' || e.key === 'H') && G?.ph === 'drive') room.send({ t: 'horn' });
    if ((e.key === 'w' || e.key === 'W') && G?.ph === 'drive') $('wipe').click();
  });
  addEventListener('keyup', (e) => {
    const k = map[e.key];
    if (k) {
      keys.delete(k);
      sync();
    }
  });
  addEventListener('blur', () => {
    keys.clear();
    sync();
    drv.brake = false;
  });
  // Snap back to the server's bus after being backgrounded.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') drv.tp = -1;
  });
  addEventListener('pointerdown', () => AU.initAudio(), { once: true });
})();

function drawWheel() {
  const c = $('wheel');
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.clearRect(0, 0, 52, 52);
  g.save();
  g.translate(26, 26);
  g.rotate(drv.steer * 1.6);
  g.fillStyle = '#111';
  g.beginPath();
  g.arc(0, 0, 23, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#3a2340';
  g.beginPath();
  g.arc(0, 0, 18, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#111';
  g.fillRect(-18, -3, 36, 6);
  g.fillRect(-3, 0, 6, 18);
  g.fillStyle = '#ffcf5a';
  g.fillRect(-5, -5, 10, 10);
  g.fillStyle = '#c8322f';
  g.fillRect(-2, -23, 4, 5);
  g.restore();
}

// ── Events → toasts + sound ──────────────────────────────────────────────────
function processEvents() {
  const t = now();
  for (const e of G.ev || []) {
    if (seenEv.has(e.id)) continue;
    seenEv.add(e.id);
    if (t - e.at > 4500) continue; // joined late — old news
    onEvent(e, t);
  }
}

const JOB_FAIL = {
  bottle: (w) => `Smash! ${w} lost a bottle to the floor.`,
  sitdown: (w) => `${w}'s toast sent the bus sideways.`,
  hiccup: (w) => `${w} hiccupped so hard the bus swerved.`,
  hat: (w, s) => `${s ? nm(s) : w}'s ${api.wear(s) || 'hat'} is gone. Somewhere in a vineyard now.`,
  platter: (w) => `The cheese platter hit the floor. ${w} is devastated.`,
  sing: (w) => `${w} sang the wrong words to the wrong song. Loudly.`,
};
const JOB_SAVED = {
  bottle: 'caught the bottle',
  sitdown: 'sat them back down',
  hiccup: 'cured the hiccups',
  hat: 'saved the hat',
  platter: 'rescued the cheese',
  sing: 'kept the harmony going',
};

function onEvent(e) {
  toastKind = e.k;
  switch (e.k) {
    case 'keys':
      if (G.ph !== 'drive') AU.sfx('keys');
      break;
    case 'depart': {
      if (e.who === myCid) toast(`You're driving. ${e.nav ? `${nm(e.nav)} knows the way.` : 'Follow the signs.'}`, { tone: 'big', cid: e.who });
      else if (myCid && e.nav === myCid) toast(`You're the navigator! Only you know where we're going.`, { tone: 'big', cid: myCid });
      else toast(`${nm(e.who)} has the wheel.${e.nav ? ` ${nm(e.nav)} is navigating.` : ''}`, { cid: e.who });
      AU.sfx('horn');
      break;
    }
    case 'hit':
      if (!fx.knock.has(e.id)) {
        fx.knock.set(e.id, now());
        fx.shake = 6;
        fx.jolt = 1;
        AU.sfx(e.h === 'roo' ? 'boing' : e.h === 'sheep' ? 'baa' : 'bonk');
        if (!amDriver()) AU.haptic(60);
      }
      toast(`${HAZARDS[e.h]?.bonk || 'BONK'}! ${hitLine(e.h)}`, { tone: 'bad' });
      break;
    case 'gravel':
      AU.sfx('gravel');
      toast('On the gravel! The bottles are rattling.', { tone: 'bad', ms: 1600 });
      break;
    case 'wrong':
      fx.legWrong = true;
      AU.sfx('skid');
      toast('Wrong turn! Chucking a U-ey.', { tone: 'bad' });
      break;
    case 'right':
      AU.sfx('ding');
      toast(e.nav ? `Right way! ${nm(e.nav)} knew it.` : 'Right way!', { tone: 'good' });
      break;
    case 'saved':
      if (e.who === myCid) AU.sfx('cheer');
      toast(`${nm(e.who)} ${JOB_SAVED[e.job] || 'saved the day'}!`, { tone: 'good', cid: e.who, ms: 1800 });
      break;
    case 'fail':
      if (e.job === 'bottle') AU.sfx('smash');
      toast((JOB_FAIL[e.job] || ((w) => `${w} caused chaos.`))(nm(e.who), e.sub), { tone: 'bad', cid: e.who, ms: 2200 });
      if (e.job !== 'hat') fx.jolt = Math.max(fx.jolt, 0.6);
      break;
    case 'snooze':
      AU.sfx('snore');
      toast(e.who === myCid ? 'You nodded off…' : `${nm(e.who)} has nodded off on the top deck.`, { cid: e.who });
      break;
    case 'woke':
      toast(e.who === myCid ? 'You’re awake! Mostly.' : `${nm(e.who)} is back in the room.`, { cid: e.who, ms: 1600 });
      break;
    case 'lean-ok':
      AU.sfx('cheer');
      toast(`${e.conga ? 'Conga contained' : 'Perfect lean'}! ${e.q}% of the bus leaned. The bus grips the bend.`, { tone: 'good' });
      break;
    case 'lean-meh':
      toast(`Wobbly lean — ${e.q}% got it.`, { ms: 1800 });
      break;
    case 'lean-fail':
      AU.sfx('skid');
      fx.jolt = 1;
      toast(`TWO WHEELS! Only ${e.q}% leaned ${e.conga ? 'against the conga' : 'into the bend'}.`, { tone: 'bad' });
      break;
    case 'photo':
      AU.sfx('camera');
      toast('Snap! That one is going in the album.', { ms: 1800 });
      break;
    case 'set': {
      const sp = SETPIECES[G.leg];
      if (sp) toast(`<b>${escapeHtml(sp.title)}</b> ${escapeHtml(sp.line)}`, { tone: 'big', html: true, ms: 3200 });
      if (e.set === 'cork') AU.sfx('pop');
      break;
    }
    case 'tow':
      toast('Took too long — the tour company sent a tow truck.', { tone: 'bad' });
      break;
    case 'horn':
      AU.sfx('horn');
      break;
    case 'spot':
      if (amDriver()) AU.sfx('ding');
      toast(`${nm(e.who)} spotted ${spotName(e.h)} — watch out!`, { cid: e.who, ms: 1800 });
      break;
    case 'spill':
      toast(e.who === myCid ? 'Overflow! You drank the spill.' : `${nm(e.who)} overpoured — and drank the evidence.`, { cid: e.who, ms: 1800 });
      break;
    case 'brie':
      AU.sfx('cheer');
      toast(`${nm(e.who)} got the golden brie!`, { tone: 'good', cid: e.who });
      break;
    case 'chilli':
      toast(`${nm(e.who)} ate the chilli. Eyes watering.`, { cid: e.who, ms: 1800 });
      break;
    default:
  }
}

function spotName(k) {
  return { roo: 'a roo', sheep: 'a sheep', cyclist: 'a cyclist', tractor: 'a tractor', barrel: 'a barrel', pothole: 'a pothole' }[k] || 'something';
}

function hitLine(k) {
  return (
    {
      roo: 'A kangaroo bounced off the bumper. It looked unimpressed.',
      sheep: 'Sheep! It is fine. It is mostly wool.',
      cyclist: 'A cyclist in lycra has some notes on your driving.',
      tractor: 'Rear-ended a tractor at walking pace. Embarrassing.',
      barrel: 'Hit a wine barrel. What a waste.',
      pothole: 'Pothole! Everybody on the top deck left their seat.',
      sign: 'Straight into the signpost. Neither way, then.',
    }[k] || 'Bonk.'
  );
}

// ── Toasts ───────────────────────────────────────────────────────────────────
// While you're driving only the road matters: no gossip from the back.
const DRIVER_TOASTS = new Set(['hit', 'wrong', 'right', 'set', 'lean-fail', 'lean-ok', 'depart', 'tow', 'spot']);
let toastKind = null;

function toast(text, { tone, cid, ms = 2600, html = false } = {}) {
  const quiet = G?.ph === 'drive' && (amDriver() || fx.nearFork);
  if (quiet && toastKind && !DRIVER_TOASTS.has(toastKind)) return;
  const box = $('toasts');
  box.classList.toggle('is-driving', G?.ph === 'drive' && amDriver());
  const d = document.createElement('div');
  d.className = 'sv-toast';
  if (tone) d.dataset.tone = tone;
  if (cid) d.appendChild(portrait(cid, 32));
  const span = document.createElement('span');
  if (html) span.innerHTML = text;
  else span.textContent = text;
  d.appendChild(span);
  box.appendChild(d);
  while (box.children.length > 2) box.firstChild.remove();
  setTimeout(() => d.remove(), ms);
}

// ── Frame loop ───────────────────────────────────────────────────────────────
let lastFrame = performance.now();
function frame() {
  const pnow = performance.now();
  const dt = Math.min(0.25, (pnow - lastFrame) / 1000);
  lastFrame = pnow;
  const t = now();
  if (G?.ph === 'drive' && !$('sc-drive').hidden) {
    driveFrame(t, dt);
    if (amDriver()) drawWheel();
    if (BOT) botFrame(t);
  }
  if (storyBus && G) {
    const st = {};
    if (G.ch) CAST_IDS.forEach((id, i) => (st[id] = { tip: G.ch[i][0], asleep: false }));
    const tod = TOD[G.leg ?? 0] || TOD[0];
    storyBus.render({ t, v: 0, driver: G.driver, me: myCid, st, sky: tod.sky, ground: tod.ground[0], party: 0, glasses: false });
  }
  // countdowns
  for (const el of document.querySelectorAll('[data-ends]')) {
    const left = Math.max(0, Math.ceil(((G?.ends || 0) - t) / 1000));
    const txt = `${el.dataset.ends} ${left}`;
    if (el.textContent !== txt) el.textContent = txt;
  }
  if (BOT && G?.ph === 'game') botGame(t);
  if (TIMER_LOOP) setTimeout(frame, 33);
  else requestAnimationFrame(frame);
}
frame();

// ── Bot mode (tests + solo demo) ─────────────────────────────────────────────
// Plays like a decent, slightly sloppy human. Everything goes through the same
// messages a person's taps would send.
const bot = { jobAt: new Map(), drinkSent: -1, stomp: 0, stack: 0, stackAt: 0, ans: new Set(), pour: new Set(), eat: new Set() };
function botState() {
  if (!G) return;
  if (G.ph === 'lobby') {
    if (!myCid) {
      const free = CAST.filter((c) => !G.hm?.[c.id]);
      if (free.length) room.send({ t: 'pick', cid: free[Math.floor(Math.random() * free.length)].id });
    } else if (META?.host && AUTOSTART && Object.keys(G.hm || {}).length >= AUTOSTART) {
      if (!bot.started) {
        bot.started = true;
        setTimeout(() => room.send({ t: 'start' }), 800);
      }
    }
  }
  if (G.ph === 'ending' && META?.host && AUTOSTART < 0) room.send({ t: 'rematch' });
  if (G.ph === 'pour' && bot.drinkSent !== G.stop) {
    bot.drinkSent = G.stop;
    const ks = ['spit', 'sip', 'glass', 'skull'];
    setTimeout(() => room.send({ t: 'drink', k: ks[Math.floor(Math.random() * 4)] }), 600 + Math.random() * 2000);
  }
  if (G.ph === 'drive' && !amDriver()) {
    const t = now();
    for (const j of G.jobs || []) {
      if (t < j.at || bot.jobAt.has(j.id)) continue;
      const group = j.k === 'lean' || j.k === 'photo';
      const mine = (!j.open && j.cid === myCid) || j.by === myCid;
      if (j.open && !j.by && Math.random() < 0.4) {
        bot.jobAt.set(j.id, t);
        setTimeout(() => room.send({ t: 'claim', id: j.id }), 400 + Math.random() * 900);
        continue;
      }
      if (group || mine) {
        bot.jobAt.set(j.id, t);
        const ok = Math.random() < 0.75;
        setTimeout(() => room.send({ t: 'job', id: j.id, ok, q: ok ? 0.85 : 0.3 }), 700 + Math.random() * 1400);
      }
    }
    // claimed jobs come back as mine
    for (const j of G.jobs || []) {
      if (j.by === myCid && bot.jobAt.has(j.id) && !bot.jobAt.has(`c${j.id}`)) {
        bot.jobAt.set(`c${j.id}`, t);
        const ok = Math.random() < 0.75;
        setTimeout(() => room.send({ t: 'job', id: j.id, ok, q: 0.8 }), 900 + Math.random() * 1200);
      }
    }
  }
}

function botFrame() {
  if (!amDriver() || !drv.bus) return;
  const track = trackFor(G.seed, G.leg);
  const target = safeLine(track, drv.bus.z + 500, drv.bus.x, 7500);
  drv.steerTarget = clamp((target - drv.bus.x) * 3.2, -1, 1);
  drv.brake = drv.bus.z > track.parkZ - (drv.bus.v * drv.bus.v) / (2 * PHYS.BRAKE) - 150;
}

function botGame(t) {
  const sg = G.sg;
  if (!sg || t < sg.t0) return;
  const el = t - sg.t0;
  if (sg.k === 'stomp') {
    const n = Math.floor(el / 135);
    if (n > bot.stomp) {
      bot.stomp = n;
      if (n % 3 === 0) room.send({ t: 'stomp', n });
    }
  } else if (sg.k === 'pour') {
    const r = Math.floor(el / POUR_ROUND_MS);
    const key = `${G.stop}:${r}`;
    if (r < 3 && el - r * POUR_ROUND_MS > 2500 && !bot.pour.has(key)) {
      bot.pour.add(key);
      room.send({ t: 'pour', r, v: sg.targets[r] + (Math.random() - 0.5) * 0.12 });
    }
  } else if (sg.k === 'quiz') {
    const q = Math.floor(el / QUIZ_Q_MS);
    const key = `${G.stop}:${q}`;
    if (q < 5 && el - q * QUIZ_Q_MS > 1500 && !bot.ans.has(key)) {
      bot.ans.add(key);
      room.send({ t: 'ans', q, i: Math.floor(Math.random() * 4) });
    }
  } else if (sg.k === 'stack') {
    if (t - bot.stackAt > 750) {
      bot.stackAt = t;
      bot.stack = (sg.n?.[myCid] || 0) + 1;
      room.send({ t: 'stack', n: bot.stack, p: Math.random() < 0.3 ? 1 : 0 });
    }
  } else if (sg.k === 'cheese') {
    for (const it of buildPlatter(G.seed, G.stop)) {
      const key = `${G.stop}:${it.id}`;
      if (bot.eat.has(key) || sg.eaten?.[it.id] != null) continue;
      if (el > it.at + 500 && el < it.at + 1800 && Math.random() < 0.08) {
        bot.eat.add(key);
        room.send({ t: 'eat', id: it.id });
      }
    }
  }
  if (sg.k !== 'stomp') bot.stomp = 0;
}

// Unused imports kept for the page's own debugging helpers.
void DRINKS;
