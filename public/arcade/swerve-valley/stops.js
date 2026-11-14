/* ============================================================================
   SWERVE VALLEY — the cellar door (stops.js)
   ----------------------------------------------------------------------------
   Everything that happens off the bus, on every phone at once:
     • `pour`  — pick your tasting (spit / sip / glass / skull), or, if you've
                 got the keys for the next leg, the designated driver's juice
     • `game`  — that winery's tasting game: The Perfect Pour, Grape Stomp,
                 Cheese Board Dash, Tasting Notes, Load the Bus

   The server owns every score. This file only draws, listens to thumbs and
   sends intent: {t:'drink'}, {t:'pour'}, {t:'stomp'}, {t:'eat'}, {t:'ans'},
   {t:'stack'}. Your own tipsiness bends the controls a little — funny, never
   unplayable.

   export function createStops(root, api) -> { update(view), destroy() }
   ========================================================================== */

import {
  WINERIES,
  GAMES,
  POUR_ROUNDS,
  POUR_ROUND_MS,
  QUIZ_Q,
  QUIZ_Q_MS,
  FOOD,
  FOOD_TTL,
  buildPlatter,
  DRINKS,
  DRINK_KEYS,
  CAST_IDS,
  TIERS,
  tier,
} from './world.js';

const REDUCE = (() => {
  try {
    return matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
})();

// ── Public ───────────────────────────────────────────────────────────────────
export function createStops(root, api) {
  injectCss();
  let key = null;
  let cur = null;

  function update(view) {
    let next = null;
    if (view && view.ph === 'pour') next = `pour:${view.stop}`;
    else if (view && view.ph === 'game' && view.sg) next = `game:${view.stop}:${view.sg.k}`;
    if (next !== key) {
      if (cur) cur.destroy();
      cur = null;
      root.innerHTML = '';
      key = next;
      if (next) {
        const mount = view.ph === 'pour' ? mountPour : GAME_MOUNTS[view.sg.k];
        if (mount) cur = mount(root, api, view);
      }
    }
    if (cur) cur.update(view);
  }

  function destroy() {
    if (cur) cur.destroy();
    cur = null;
    key = null;
    root.innerHTML = '';
  }

  return { update, destroy };
}

// ── Shared helpers ───────────────────────────────────────────────────────────
function h(tag, cls, html) {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (html != null) el.innerHTML = html;
  return el;
}

function esc(s) {
  return String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
}

function myIndex(view) {
  return view && view.me ? CAST_IDS.indexOf(view.me) : -1;
}

function myTip(view, api) {
  const i = myIndex(view);
  if (i >= 0 && view.ch && view.ch[i]) return view.ch[i][0];
  return view?.me ? api.tip(view.me) : 0;
}

function myTier(view, api) {
  return tier(myTip(view, api));
}

function humansOf(view) {
  return Object.keys(view?.hm || {});
}

function clamp(n, a, b) {
  return n < a ? a : n > b ? b : n;
}

function fmtSec(ms) {
  return Math.max(0, Math.ceil(ms / 1000));
}

/** A rAF loop that stops itself on destroy. */
function loop(fn) {
  let id = 0;
  let alive = true;
  let last = performance.now();
  const step = (t) => {
    if (!alive) return;
    const dt = Math.min(0.05, (t - last) / 1000);
    last = t;
    try {
      fn(dt, t);
    } catch (err) {
      console.error('[swerve-valley/stops]', err);
    }
    id = requestAnimationFrame(step);
  };
  id = requestAnimationFrame(step);
  return () => {
    alive = false;
    cancelAnimationFrame(id);
  };
}

/** Pixel canvas that keeps an integer CSS scale and fits its box. */
function pixelCanvas(box, w, h, maxScale = 6) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  cv.className = 'svs-px';
  box.appendChild(cv);
  const ctx = cv.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const fit = () => {
    const bw = box.clientWidth || 300;
    const bh = box.clientHeight || 300;
    const dpr = window.devicePixelRatio || 1;
    // integer DEVICE-pixel scale so the art stays crisp
    let dev = Math.floor(Math.min((bw * dpr) / w, (bh * dpr) / h));
    dev = clamp(dev, 1, maxScale * Math.ceil(dpr));
    cv.style.width = `${(w * dev) / dpr}px`;
    cv.style.height = `${(h * dev) / dpr}px`;
  };
  fit();
  let ro = null;
  if (typeof ResizeObserver !== 'undefined') {
    ro = new ResizeObserver(fit);
    ro.observe(box);
  }
  return {
    cv,
    ctx,
    fit,
    destroy() {
      ro?.disconnect();
    },
    /** client point → canvas pixel */
    toLocal(ev) {
      const r = cv.getBoundingClientRect();
      return { x: ((ev.clientX - r.left) / r.width) * w, y: ((ev.clientY - r.top) / r.height) * h };
    },
  };
}

/** Pixel-map sprite: rows of chars, palette maps char → colour ('.' = clear). */
function drawMap(ctx, rows, pal, x, y, alpha = 1, sc = 1) {
  const a0 = ctx.globalAlpha;
  ctx.globalAlpha = a0 * alpha;
  const X = Math.round(x);
  const Y = Math.round(y);
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    for (let c = 0; c < row.length; c++) {
      const col = pal[row[c]];
      if (!col) continue;
      ctx.fillStyle = col;
      ctx.fillRect(X + c * sc, Y + r * sc, sc, sc);
    }
  }
  ctx.globalAlpha = a0;
}

/** Crisp DOM text that pops over a canvas stage (canvas text blurs). */
function flasher(stage, top = '18%') {
  const el = h('div', 'svs-flash');
  el.style.top = top;
  stage.appendChild(el);
  return (txt, tone = '') => {
    el.textContent = txt;
    el.dataset.tone = tone;
    el.classList.remove('svs-flash--on');
    void el.offsetWidth; // restart the animation
    el.classList.add('svs-flash--on');
  };
}

/** Shared header for every game: winery, title, timer bar, a score slot. */
function gameHeader(root, view, title) {
  const w = WINERIES[view.winery] || WINERIES[0];
  const head = h(
    'header',
    'svs-gh',
    `<div class="svs-gh__row">
       <span class="svs-gh__where">${esc(w.name)}</span>
       <span class="svs-gh__score" data-score></span>
     </div>
     <h2 class="svs-gh__title">${esc(title)}</h2>
     <div class="svs-bar"><i data-bar></i></div>`,
  );
  root.appendChild(head);
  return {
    el: head,
    score: head.querySelector('[data-score]'),
    bar: head.querySelector('[data-bar]'),
  };
}

function setBar(bar, frac) {
  bar.style.transform = `scaleX(${clamp(frac, 0, 1)})`;
}

/** Intro card shown until sg.t0 with a 3-2-1. */
function introCard(root, view, k) {
  const w = WINERIES[view.winery] || WINERIES[0];
  const g = GAMES[k];
  const el = h(
    'div',
    'svs-intro',
    `<div class="svs-intro__card">
       <p class="svs-eyebrow">${esc(w.host)} at ${esc(w.name)}</p>
       <h2 class="svs-intro__title">${esc(g.title)}</h2>
       <p class="svs-intro__how">${esc(g.how)}</p>
       <p class="svs-intro__line">“${esc(w.line)}”</p>
       <div class="svs-intro__count" data-count></div>
     </div>`,
  );
  root.appendChild(el);
  const count = el.querySelector('[data-count]');
  let lastN = null;
  return {
    tick(now, t0, api) {
      const left = t0 - now;
      if (left <= 0) {
        if (!el.hidden) {
          el.hidden = true;
          api.sfx('ding');
        }
        return false;
      }
      el.hidden = false;
      const n = Math.ceil(left / 1000);
      const txt = n <= 3 ? String(n) : '';
      if (txt !== lastN) {
        lastN = txt;
        count.textContent = txt;
        if (txt) api.sfx('drum');
      }
      return true;
    },
  };
}

/** Top-4 humans board, rows keyed by cid so portraits aren't rebuilt. */
function makeBoard(box, api, unit = '') {
  const rows = new Map();
  const list = h('ol', 'svs-board');
  box.appendChild(list);
  return {
    update(entries, me) {
      const top = entries
        .slice()
        .sort((a, b) => b.v - a.v)
        .slice(0, 4);
      if (me && !top.some((e) => e.cid === me)) {
        const mine = entries.find((e) => e.cid === me);
        if (mine) {
          if (top.length >= 4) top[3] = mine;
          else top.push(mine);
        }
      }
      const keep = new Set(top.map((e) => e.cid));
      for (const [cid, row] of rows) {
        if (!keep.has(cid)) {
          row.el.remove();
          rows.delete(cid);
        }
      }
      top.forEach((e, i) => {
        let row = rows.get(e.cid);
        if (!row) {
          const el = h('li', 'svs-board__row');
          const pic = api.portrait(e.cid, 32);
          pic.className = 'svs-board__pic';
          el.appendChild(pic);
          const nm = h('span', 'svs-board__name', esc(api.name(e.cid)));
          const v = h('span', 'svs-board__v');
          el.append(nm, v);
          row = { el, v };
          rows.set(e.cid, row);
        }
        row.el.dataset.me = e.cid === me ? '1' : '0';
        row.v.textContent = `${e.v}${unit}`;
        if (list.children[i] !== row.el) list.insertBefore(row.el, list.children[i] || null);
      });
    },
  };
}

// ── PHASE: pour (pick your tasting) ──────────────────────────────────────────
function mountPour(root, api, view0) {
  const w = WINERIES[view0.winery] || WINERIES[0];
  const el = h('div', 'svs svs-pour');
  el.style.setProperty('--acc', w.colour);
  root.appendChild(el);

  el.innerHTML = `
    <header class="svs-ph">
      <p class="svs-eyebrow">Cellar door · stop ${(view0.stop ?? 0) + 1} of 5</p>
      <h2 class="svs-ph__title">${esc(w.name)}</h2>
      <p class="svs-ph__wine"><span class="svs-swatch"></span>${esc(w.wine)}</p>
      <div class="svs-bar"><i data-bar></i></div>
    </header>
    <div class="svs-keys" data-keys></div>
    <div class="svs-choice" data-choice></div>
    <div class="svs-me" data-me></div>
    <p class="svs-eyebrow svs-crowd__lbl">Around the tasting bench</p>
    <div class="svs-crowd" data-crowd></div>
  `;
  const bar = el.querySelector('[data-bar]');
  const keysEl = el.querySelector('[data-keys]');
  const choiceEl = el.querySelector('[data-choice]');
  const meEl = el.querySelector('[data-me]');
  const crowdEl = el.querySelector('[data-crowd]');

  let view = view0;
  let local = null; //     optimistic choice
  let mode = null; //      'juice' | 'pick' | 'spectate'
  let keysWho = undefined;
  const crowd = new Map();
  const buttons = {};
  const t0 = api.now();

  // Crowd: everybody's pick so far.
  for (const cid of CAST_IDS) {
    const cell = h('div', 'svs-crowd__cell');
    const pic = api.portrait(cid, 32);
    pic.className = 'svs-crowd__pic';
    const tag = h('span', 'svs-crowd__tag', '…');
    cell.append(pic, tag);
    cell.title = api.fullName(cid);
    crowdEl.appendChild(cell);
    crowd.set(cid, { cell, tag });
  }

  function renderChoice() {
    const i = myIndex(view);
    const mine = i >= 0 ? view.ch?.[i]?.[3] : 0;
    const next = !view.me ? 'spectate' : mine === 'juice' ? 'juice' : 'pick';
    if (next === mode) return;
    mode = next;
    choiceEl.innerHTML = '';
    for (const k of Object.keys(buttons)) delete buttons[k];
    if (mode === 'juice') {
      choiceEl.appendChild(
        h(
          'div',
          'svs-dd',
          `<div class="svs-dd__glass" aria-hidden="true"></div>
           <div>
             <p class="svs-dd__eyebrow">Designated driver</p>
             <p class="svs-dd__title">You’ve got the keys for the next leg.</p>
             <p class="svs-dd__line">Grape juice for you. ${esc(DRINKS.juice.line)}</p>
             <p class="svs-dd__stats">+${DRINKS.juice.fun} fun · sobering up</p>
           </div>`,
        ),
      );
      return;
    }
    if (mode === 'spectate') {
      choiceEl.appendChild(h('p', 'svs-note', 'Pick someone to play as to join the tasting.'));
      return;
    }
    const grid = h('div', 'svs-drinks');
    for (const k of DRINK_KEYS) {
      const d = DRINKS[k];
      const b = h(
        'button',
        'svs-drink',
        `<span class="svs-drink__label">${esc(d.label)}</span>
         <span class="svs-drink__stats">+${d.fun} fun · ${d.tip ? `+${d.tip} tipsy` : 'stone sober'}</span>
         <span class="svs-drink__line">${esc(d.line)}</span>
         <span class="svs-drink__after" data-after></span>`,
      );
      b.type = 'button';
      b.dataset.k = k;
      b.addEventListener('click', () => {
        if (api.now() > (view.ends ?? Infinity)) return;
        local = k;
        api.send({ t: 'drink', k });
        api.sfx(k === 'skull' ? 'clink' : k === 'spit' ? 'pop' : 'pour');
        api.haptic(15);
        paint();
      });
      buttons[k] = b;
      grid.appendChild(b);
    }
    choiceEl.appendChild(grid);
  }

  function paint() {
    renderChoice();
    const i = myIndex(view);
    const server = i >= 0 ? view.ch?.[i]?.[3] || null : null;
    // Once the server agrees, trust it.
    if (server && server === local) local = null;
    const chosen = local || server;
    const tip = myTip(view, api);
    for (const k of DRINK_KEYS) {
      const b = buttons[k];
      if (!b) continue;
      b.dataset.on = chosen === k ? '1' : '0';
      const after = TIERS[tier(Math.min(100, tip + DRINKS[k].tip))];
      const now = TIERS[tier(tip)];
      b.querySelector('[data-after]').textContent =
        after.name === now.name ? `stay ${now.name}` : `→ ${after.name}`;
    }

    // Keys line.
    const who = view.nextDriver || null;
    if (who !== keysWho) {
      keysWho = who;
      keysEl.innerHTML = '';
      if (who) {
        const pic = api.portrait(who, 32);
        pic.className = 'svs-keys__pic';
        keysEl.appendChild(pic);
        keysEl.appendChild(
          h(
            'p',
            'svs-keys__txt',
            who === view.me
              ? '<b>You</b> have the keys for the next leg.'
              : `<b>${esc(api.name(who))}</b> has the keys for the next leg.`,
          ),
        );
      } else {
        keysEl.appendChild(h('p', 'svs-keys__txt', 'Nobody has the keys yet. Bold.'));
      }
    }

    // Me: tier + blurb.
    const t = tier(tip);
    meEl.innerHTML = `
      <div class="svs-me__row">
        <span class="svs-me__lbl">You</span>
        <span class="svs-me__tier" data-t="${t}">${esc(TIERS[t].name)}</span>
        <span class="svs-me__blurb">${esc(TIERS[t].blurb)}</span>
      </div>
      <div class="svs-tipsy"><i style="transform:scaleX(${clamp(tip / 100, 0, 1)})"></i>
        ${TIERS.slice(1)
          .map((x) => `<b style="left:${x.min}%"></b>`)
          .join('')}
      </div>`;

    // Crowd.
    const humans = new Set(humansOf(view));
    CAST_IDS.forEach((cid, idx) => {
      const c = crowd.get(cid);
      let k = view.ch?.[idx]?.[3] || null;
      if (cid === view.me && local) k = local;
      c.cell.dataset.h = humans.has(cid) ? '1' : '0';
      c.cell.dataset.me = cid === view.me ? '1' : '0';
      c.cell.dataset.k = k || '';
      c.tag.textContent = k ? DRINK_TAG[k] : humans.has(cid) ? '…' : '?';
    });
  }

  const stop = loop(() => {
    const now = api.now();
    const end = view.ends ?? now;
    const total = Math.max(1, end - t0);
    setBar(bar, (end - now) / total);
  });

  return {
    update(v) {
      view = v;
      paint();
    },
    destroy() {
      stop();
    },
  };
}

const DRINK_TAG = { spit: 'SPIT', sip: 'SIP', glass: 'GLASS', skull: 'SKULL', juice: 'JUICE' };

// ── GAME: The Perfect Pour ───────────────────────────────────────────────────
const GW = 96;
const GH = 124;

function mountPourGame(root, api, view0) {
  const w = WINERIES[view0.winery] || WINERIES[0];
  const el = h('div', 'svs svs-game svs-game--pour');
  el.style.setProperty('--acc', w.colour);
  root.appendChild(el);
  const head = gameHeader(el, view0, GAMES.pour.title);
  const info = h('p', 'svs-sub', '');
  el.appendChild(info);
  const stage = h('div', 'svs-stage');
  el.appendChild(stage);
  const pc = pixelCanvas(stage, GW, GH);
  const flash = flasher(stage, '64%');
  const btn = h('button', 'svs-big', 'HOLD TO POUR');
  btn.type = 'button';
  el.appendChild(btn);
  const intro = introCard(el, view0, 'pour');

  let view = view0;
  const fill = new Array(POUR_ROUNDS).fill(0);
  const sent = new Array(POUR_ROUNDS).fill(null);
  let holding = false;
  let holdT = 0;
  let round = -1;
  let pourSfxAt = 0;
  const drips = [];

  const roundOf = (now) => Math.floor((now - view.sg.t0) / POUR_ROUND_MS);

  function score(r) {
    const v = sent[r];
    const tg = view.sg.targets?.[r];
    if (v == null || tg == null) return null;
    if (v > 1) return 0;
    return Math.max(0, Math.round(100 - Math.abs(v - tg) * 260));
  }

  function release() {
    if (!holding) return;
    holding = false;
    btn.dataset.on = '0';
    const r = round;
    if (r < 0 || r >= POUR_ROUNDS || sent[r] != null) return;
    if (fill[r] <= 0.001) return;
    commit(r);
  }

  function commit(r) {
    const v = Math.round(fill[r] * 1000) / 1000;
    sent[r] = v;
    api.send({ t: 'pour', r, v });
    const sc = score(r);
    if (v > 1) {
      flash('Overflow! You drank the spill.', 'bad');
      api.sfx('fail');
    } else if (sc >= 90) {
      flash(`Perfect pour! ${sc}`, 'good');
      api.sfx('cheer');
    } else {
      flash(`${sc} points`, sc >= 60 ? '' : 'bad');
      api.sfx(sc >= 60 ? 'ok' : 'buzz');
    }
  }

  const down = (e) => {
    e.preventDefault();
    const now = api.now();
    const r = roundOf(now);
    if (now < view.sg.t0 || r < 0 || r >= POUR_ROUNDS || sent[r] != null) return;
    holding = true;
    holdT = 0;
    btn.dataset.on = '1';
    api.haptic(10);
  };
  const up = (e) => {
    e.preventDefault();
    release();
  };
  for (const target of [btn, stage]) {
    target.addEventListener('pointerdown', down);
    target.addEventListener('pointerup', up);
    target.addEventListener('pointercancel', up);
    target.addEventListener('pointerleave', up);
  }

  const stopLoop = loop((dt, t) => {
    const now = api.now();
    const t0 = view.sg.t0;
    intro.tick(now, t0, api);
    const r = clamp(roundOf(now), 0, POUR_ROUNDS - 1);
    const playing = now >= t0 && now < (view.ends ?? Infinity);
    const tr = myTier(view, api);

    if (r !== round) {
      // Round rolled over: whatever's in the glass counts.
      if (round >= 0 && round < POUR_ROUNDS && sent[round] == null && fill[round] > 0.001) commit(round);
      holding = false;
      btn.dataset.on = '0';
      round = r;
    }
    // Time's up on the last glass while still pouring: that counts too.
    if (holding && now >= (view.ends ?? Infinity)) release();

    if (holding && playing && sent[r] == null) {
      holdT += dt;
      let rate = 0.32 * (1 + 0.55 * holdT);
      if (tr >= 1 && !REDUCE) rate *= 1 + 0.3 * Math.min(3, tr) * 0.33 * Math.sin(t / 90);
      if (tr >= 3 && Math.random() < dt * 1.6) {
        fill[r] += 0.035 + Math.random() * 0.03; // glug
        api.sfx('pour');
      }
      fill[r] += rate * dt;
      if (fill[r] > 1) drips.push({ x: Math.random() < 0.5 ? -1 : 1, y: 0, v: 20 + Math.random() * 30 });
      if (fill[r] > 1.5) {
        fill[r] = 1.5;
        release();
      }
      if (t - pourSfxAt > 260) {
        pourSfxAt = t;
        api.sfx('pour');
      }
    }

    // Header + info.
    const tot = sent.reduce((a, _, i) => a + (score(i) || 0), 0);
    head.score.textContent = `${tot} pts`;
    const endAt = view.ends ?? now;
    setBar(head.bar, (endAt - now) / Math.max(1, endAt - t0));
    const left = t0 + (r + 1) * POUR_ROUND_MS - now;
    if (now < t0) info.textContent = 'Get ready…';
    else if (!playing) info.textContent = 'That’s the lot.';
    else if (sent[r] != null) info.textContent = `Glass ${r + 1} of ${POUR_ROUNDS} poured. Next in ${fmtSec(left)}s`;
    else info.textContent = `Glass ${r + 1} of ${POUR_ROUNDS} · stop on the gold line · ${fmtSec(left)}s`;
    btn.disabled = !playing || sent[r] != null;

    drawGlass(pc.ctx, {
      fill: fill[r],
      target: view.sg.targets?.[r] ?? 0.5,
      wine: w.colour,
      pouring: holding,
      sway: tr >= 1 && !REDUCE ? Math.sin(t / 420) * Math.min(3, tr) : 0,
      wobble: tr >= 1 && !REDUCE ? Math.sin(t / 70) * Math.min(2, tr * 0.6) : 0,
      drips,
      dt,
      round: r,
      sent: sent.map((v, i) => (v == null ? null : score(i))),
    });
  });

  return {
    update(v) {
      view = v;
      // After a reconnect the server already holds some of my glasses.
      (v.sg?.mine || []).forEach((val, r) => {
        if (val != null && sent[r] == null) sent[r] = val;
      });
    },
    destroy() {
      stopLoop();
      pc.destroy();
    },
  };
}

function bowlHalf(u) {
  // u: 0 at the rim, 1 at the bottom of the bowl
  return 30 * Math.sqrt(Math.max(0, 1 - Math.pow(u, 3.1)));
}

function drawGlass(ctx, o) {
  const W = GW;
  const H = GH;
  ctx.clearRect(0, 0, W, H);
  // backdrop: the tasting bench
  ctx.fillStyle = '#2a1020';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#3a1a2c';
  for (let y = 0; y < H; y += 8) ctx.fillRect(0, y, W, 1);
  ctx.fillStyle = '#5a3524';
  ctx.fillRect(0, 112, W, 12);
  ctx.fillStyle = '#7a4a30';
  ctx.fillRect(0, 112, W, 2);

  const cx = Math.round(W / 2 + o.sway);
  const rim = 22;
  const bot = 76;
  const bh = bot - rim;

  // glass interior tint
  for (let y = rim; y <= bot; y++) {
    const u = (y - rim) / bh;
    const hw = Math.round(bowlHalf(u));
    ctx.fillStyle = 'rgba(220,235,255,0.10)';
    ctx.fillRect(cx - hw, y, hw * 2, 1);
  }
  // wine
  const f = Math.min(1, o.fill);
  if (f > 0) {
    const topY = Math.round(bot - f * bh);
    for (let y = topY; y <= bot; y++) {
      const u = (y - rim) / bh;
      const hw = Math.round(bowlHalf(u)) - 1;
      if (hw <= 0) continue;
      ctx.fillStyle = y === topY ? lighten(o.wine, 0.35) : o.wine;
      ctx.fillRect(cx - hw, y, hw * 2, 1);
    }
    // a highlight down the left of the wine
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    for (let y = topY + 2; y < bot - 4; y++) {
      const hw = Math.round(bowlHalf((y - rim) / bh)) - 4;
      if (hw > 4) ctx.fillRect(cx - hw, y, 1, 1);
    }
  }
  // target line (dashed gold)
  const ty = Math.round(bot - o.target * bh);
  {
    const hw = Math.round(bowlHalf((ty - rim) / bh)) + 6;
    ctx.fillStyle = '#ffcf5a';
    for (let x = cx - hw; x < cx + hw; x += 4) ctx.fillRect(x, ty, 2, 1);
    ctx.fillRect(cx + hw + 1, ty - 1, 3, 3);
  }
  // glass outline
  ctx.fillStyle = '#e8f1ff';
  for (let y = rim; y <= bot; y++) {
    const hw = Math.round(bowlHalf((y - rim) / bh));
    ctx.fillRect(cx - hw - 1, y, 1, 1);
    ctx.fillRect(cx + hw, y, 1, 1);
  }
  ctx.fillRect(cx - 30, rim - 1, 61, 1);
  ctx.fillStyle = 'rgba(232,241,255,0.5)';
  ctx.fillRect(cx - 24, rim + 4, 1, 14);
  // stem + foot
  ctx.fillStyle = '#e8f1ff';
  ctx.fillRect(cx - 1, bot, 2, 32);
  ctx.fillRect(cx - 16, 108, 32, 2);
  ctx.fillRect(cx - 12, 107, 24, 1);
  ctx.fillStyle = 'rgba(232,241,255,0.35)';
  ctx.fillRect(cx - 18, 110, 36, 1);

  // overflow drips
  if (o.fill > 1) {
    for (const d of o.drips) {
      d.y += d.v * o.dt;
      d.v += 140 * o.dt;
    }
    while (o.drips.length && o.drips[0].y > 90) o.drips.shift();
    ctx.fillStyle = o.wine;
    for (const d of o.drips) ctx.fillRect(cx + d.x * 31 + (d.x > 0 ? 0 : -1), rim + Math.round(d.y), 1, 2);
    ctx.fillRect(cx - 22, 111, 44, 1);
  }

  // bottle + stream
  if (o.pouring) {
    const bx = cx + 18 + Math.round(o.wobble);
    const by = 2;
    ctx.save();
    ctx.translate(bx, by + 10);
    ctx.rotate(-2.2);
    ctx.fillStyle = '#1f3a24';
    ctx.fillRect(-4, -2, 8, 22);
    ctx.fillRect(-2, -10, 4, 9);
    ctx.fillStyle = '#f6ecd2';
    ctx.fillRect(-4, 6, 8, 7);
    ctx.fillStyle = o.wine;
    ctx.fillRect(-3, 8, 6, 3);
    ctx.restore();
    const sx = bx - 9;
    const topWine = Math.round(bot - Math.min(1, o.fill) * bh);
    ctx.fillStyle = o.wine;
    for (let y = 14; y < topWine; y++) {
      const jitter = o.wobble ? Math.round(Math.sin(y * 0.6 + performance.now() / 60) * 0.6) : 0;
      ctx.fillRect(sx + jitter, y, 2, 1);
    }
  }

  // round pips
  for (let i = 0; i < POUR_ROUNDS; i++) {
    const x = 6 + i * 10;
    const v = o.sent[i];
    ctx.fillStyle = i === o.round ? '#ffcf5a' : '#5a3a48';
    ctx.fillRect(x, 6, 7, 7);
    ctx.fillStyle = v == null ? '#2a1020' : v >= 90 ? '#6ee7a5' : v >= 60 ? '#ffcf5a' : '#ff6b6b';
    ctx.fillRect(x + 1, 7, 5, 5);
  }
}

function lighten(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const m = (c) => Math.round(c + (255 - c) * k);
  return `rgb(${m(r)},${m(g)},${m(b)})`;
}

// ── GAME: Grape Stomp ────────────────────────────────────────────────────────
const SW = 96;
const SH = 88;
const JUG_FULL = 140; // stomps to fill the jug

function mountStomp(root, api, view0) {
  const w = WINERIES[view0.winery] || WINERIES[0];
  const el = h('div', 'svs svs-game svs-game--stomp');
  el.style.setProperty('--acc', w.colour);
  root.appendChild(el);
  const head = gameHeader(el, view0, GAMES.stomp.title);
  const body = h('div', 'svs-split');
  el.appendChild(body);
  const stage = h('div', 'svs-stage svs-stage--short');
  body.appendChild(stage);
  const side = h('div', 'svs-side');
  body.appendChild(side);
  const boardBox = h('div', 'svs-boardbox');
  side.appendChild(boardBox);
  const board = makeBoard(boardBox, api);
  const pc = pixelCanvas(stage, SW, SH);
  const flash = flasher(stage, '8%');
  const msg = h('p', 'svs-sub svs-sub--c', 'Left, right, left, right!');
  el.appendChild(msg);
  const feet = h('div', 'svs-feet');
  const L = h('button', 'svs-foot', '<span>LEFT</span>');
  const R = h('button', 'svs-foot', '<span>RIGHT</span>');
  L.type = R.type = 'button';
  L.dataset.f = 'L';
  R.dataset.f = 'R';
  feet.append(L, R);
  el.appendChild(feet);
  const intro = introCard(el, view0, 'stomp');

  let view = view0;
  let n = 0;
  let lastFoot = null;
  let sentN = 0;
  let sentAt = 0;
  let swapped = false;
  let swapAt = view0.sg.t0;
  let stompFx = 0;
  let pourFx = 0;
  const splash = [];

  function press(f) {
    const now = api.now();
    if (now < view.sg.t0 || now > (view.ends ?? Infinity)) return;
    if (f === lastFoot) {
      flash('Other foot!', 'bad');
      api.sfx('buzz');
      return;
    }
    lastFoot = f;
    n++;
    stompFx = 1;
    pourFx = 1;
    const fx = f === 'R' ? 56 : 36;
    for (let i = 0; i < 4; i++) {
      splash.push({ x: fx + (Math.random() - 0.5) * 10, y: 44, vx: (Math.random() - 0.5) * 70, vy: -50 - Math.random() * 50, life: 0.55 });
    }
    api.sfx('stomp');
    api.haptic(8);
    if (n % 25 === 0) {
      flash(`${n} stomps!`, 'good');
      api.sfx('ding');
    }
  }
  const onDown = (e) => {
    e.preventDefault();
    const f = e.currentTarget.dataset.f;
    e.currentTarget.dataset.on = '1';
    press(f);
  };
  const onUp = (e) => {
    e.currentTarget.dataset.on = '0';
  };
  for (const b of [L, R]) {
    b.addEventListener('pointerdown', onDown);
    b.addEventListener('pointerup', onUp);
    b.addEventListener('pointercancel', onUp);
    b.addEventListener('pointerleave', onUp);
  }

  const stopLoop = loop((dt, t) => {
    const now = api.now();
    intro.tick(now, view.sg.t0, api);
    const tr = myTier(view, api);
    if (n !== sentN && now - sentAt > 250) {
      sentN = n;
      sentAt = now;
      api.send({ t: 'stomp', n });
    }
    // Tipsy: the feet swap sides every few seconds.
    if (tr >= 2 && now > view.sg.t0 && now - swapAt > (REDUCE ? 4500 : 2800) - tr * 250) {
      swapAt = now;
      swapped = !swapped;
      feet.dataset.swap = swapped ? '1' : '0';
      msg.textContent = swapped ? 'Whoa — which foot is which?' : 'Left, right, left, right!';
    }
    head.score.textContent = `${n} stomps`;
    const endAt = view.ends ?? now;
    setBar(head.bar, (endAt - now) / Math.max(1, endAt - view.sg.t0));
    stompFx = Math.max(0, stompFx - dt * 6);
    pourFx = Math.max(0, pourFx - dt * 1.6);
    for (const p of splash) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 180 * dt;
      p.life -= dt;
    }
    while (splash.length && splash[0].life <= 0) splash.shift();
    drawVat(pc.ctx, { n, fx: stompFx, pour: pourFx, foot: lastFoot, splash, t, sway: tr >= 1 && !REDUCE ? tr : 0 });
  });

  return {
    update(v) {
      view = v;
      const m = v.sg?.n || {};
      // Reconnected mid-stomp: carry on from what the server counted.
      if ((m[v.me] || 0) > n) n = sentN = m[v.me];
      const humans = humansOf(v);
      const entries = humans.map((cid) => ({ cid, v: cid === v.me ? Math.max(n, m[cid] || 0) : m[cid] || 0 }));
      board.update(entries, v.me);
    },
    destroy() {
      stopLoop();
      pc.destroy();
    },
  };
}

function ellipseRows(ctx, cx, cy, rx, ry, col) {
  ctx.fillStyle = col;
  for (let dy = -ry; dy <= ry; dy++) {
    const half = Math.round(rx * Math.sqrt(Math.max(0, 1 - (dy / (ry + 0.5)) ** 2)));
    ctx.fillRect(cx - half, cy + dy, half * 2, 1);
  }
}

function drawLeg(ctx, x, footY, lifted) {
  // rolled-up jeans from the top of the frame, then a bare shin and foot
  const knee = footY - 14;
  ctx.fillStyle = '#3a5a8a';
  ctx.fillRect(x, 0, 7, Math.max(0, knee));
  ctx.fillStyle = '#5a7aaa';
  ctx.fillRect(x, Math.max(0, knee - 3), 7, 3); // the roll
  ctx.fillStyle = '#e8b896';
  ctx.fillRect(x + 1, knee, 5, 12);
  ctx.fillStyle = lifted ? '#e8b896' : '#8a2a6a';
  ctx.fillRect(x - 1, footY - 2, 9, 3); // foot (purple when it's in the mash)
  ctx.fillStyle = '#c89676';
  if (lifted) ctx.fillRect(x - 1, footY, 9, 1);
}

function drawVat(ctx, o) {
  const W = SW;
  const H = SH;
  ctx.fillStyle = '#2a1020';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#3a1a2c';
  for (let x = 0; x < W; x += 12) ctx.fillRect(x, 0, 1, H);
  ctx.fillStyle = '#4a2a1c';
  ctx.fillRect(0, H - 6, W, 6);

  const cx = 40;
  const top = 46;
  // vat body
  ctx.fillStyle = '#7a4a30';
  ctx.fillRect(cx - 30, top, 60, H - 6 - top);
  ctx.fillStyle = '#8f5a3a';
  for (let x = cx - 28; x < cx + 30; x += 8) ctx.fillRect(x, top, 4, H - 6 - top);
  ctx.fillStyle = '#3a2a2a';
  ctx.fillRect(cx - 31, top + 6, 62, 3);
  ctx.fillRect(cx - 31, H - 14, 62, 3);
  ctx.fillStyle = '#6a5a5a';
  ctx.fillRect(cx - 31, top + 6, 62, 1);
  ctx.fillRect(cx - 31, H - 14, 62, 1);
  // rim + mash
  ellipseRows(ctx, cx, top, 31, 5, '#5a3524');
  ellipseRows(ctx, cx, top, 28, 4, '#5c1446');
  const bob = Math.round(o.fx * 1);
  for (let i = 0; i < 22; i++) {
    const gx = cx - 24 + ((i * 37) % 48);
    const gy = top - 3 + ((i * 13) % 6) + bob;
    ctx.fillStyle = i % 3 ? '#7a3aa8' : '#4a1a6a';
    ctx.fillRect(gx, gy, 3, 2);
    ctx.fillStyle = '#b07ad0';
    ctx.fillRect(gx, gy, 1, 1);
  }
  // legs: the one that just stomped is down in the mash
  const sway = o.sway ? Math.round(Math.sin(o.t / 260) * o.sway) : 0;
  const lift = 18 - Math.round(o.fx * 4);
  const leftDown = o.foot !== 'R';
  drawLeg(ctx, cx - 12 + sway, leftDown ? top + 1 : top - lift, !leftDown);
  drawLeg(ctx, cx + 6 + sway, leftDown ? top - lift : top + 1, leftDown);
  // splashes
  ctx.fillStyle = '#8a2a6a';
  for (const p of o.splash) ctx.fillRect(Math.round(p.x) - 4, Math.round(p.y), 2, 2);

  // spigot + jug
  const jx = 82;
  const jTop = 58;
  const jBot = H - 7;
  const fill = Math.min(1, o.n / JUG_FULL);
  const jh = Math.round(fill * (jBot - jTop));
  ctx.fillStyle = '#c8a070';
  ctx.fillRect(cx + 30, 64, 6, 3);
  ctx.fillRect(cx + 34, 64, 2, 5);
  if (o.pour > 0.05) {
    ctx.fillStyle = '#8a2a6a';
    ctx.fillRect(cx + 35, 69, 1, Math.max(0, jBot - 69 - jh));
  }
  // glass jug
  ctx.fillStyle = 'rgba(220,235,255,0.12)';
  ctx.fillRect(jx - 7, jTop, 14, jBot - jTop);
  ctx.fillStyle = '#6a1450';
  ctx.fillRect(jx - 7, jBot - jh, 14, jh);
  ctx.fillStyle = '#9a3a7a';
  if (jh) ctx.fillRect(jx - 7, jBot - jh, 14, 1);
  ctx.fillStyle = '#e8f1ff';
  ctx.fillRect(jx - 8, jTop, 1, jBot - jTop);
  ctx.fillRect(jx + 7, jTop, 1, jBot - jTop);
  ctx.fillRect(jx - 8, jBot, 16, 1);
  ctx.fillRect(jx + 8, jTop + 4, 3, 1);
  ctx.fillRect(jx + 10, jTop + 4, 1, 8);
  ctx.fillRect(jx + 8, jTop + 11, 3, 1);
  // a tick mark each quarter
  ctx.fillStyle = 'rgba(232,241,255,0.5)';
  for (let q = 1; q < 4; q++) ctx.fillRect(jx - 7, jBot - Math.round(((jBot - jTop) * q) / 4), 3, 1);
}

// ── GAME: Cheese Board Dash ──────────────────────────────────────────────────
const CW = 120;
const CH = 168;
const FOOD_SC = 2; // food sprites are drawn at 2x (24 px on the board)

const FOOD_ART = {
  cheese: {
    pal: { Y: '#ffd84a', o: '#e0a91f', D: '#b37a10', K: '#2a1020' },
    rows: [
      '............',
      '.........KK.',
      '.......KKYK.',
      '.....KKYYYK.',
      '...KKYYoYYK.',
      '.KKYYYYYYYK.',
      'KYYoYYYYoYK.',
      'KYYYYYYYYYK.',
      'KYYYYYoYYYK.',
      'KDDDDDDDDDK.',
      '.KKKKKKKKKK.',
      '............',
    ],
  },
  cracker: {
    pal: { C: '#e8c27a', c: '#b8904a', K: '#2a1020' },
    rows: [
      '............',
      '.KKKKKKKKKK.',
      '.KCCCCCCCCK.',
      '.KCcCCcCCcK.',
      '.KCCCCCCCCK.',
      '.KCCcCCcCCK.',
      '.KCCCCCCCCK.',
      '.KCcCCcCCcK.',
      '.KCCCCCCCCK.',
      '.KKKKKKKKKK.',
      '............',
      '............',
    ],
  },
  grapes: {
    pal: { g: '#3f9a3a', P: '#7a3aa8', p: '#b07ad0', K: '#2a1020' },
    rows: [
      '.....g......',
      '....gg.gg...',
      '...KKKKgg...',
      '..KPpKPpK...',
      '..KPPKPPKK..',
      '.KPpKPpKPpK.',
      '.KPPKPPKPPK.',
      '..KKPpKPpK..',
      '...KPPKPPK..',
      '....KKPpK...',
      '.....KPPK...',
      '......KK....',
    ],
  },
  olive: {
    pal: { G: '#6a8a2a', g: '#9ab84a', R: '#d8322a', K: '#2a1020' },
    rows: [
      '............',
      '............',
      '....KKKK....',
      '...KGGGGK...',
      '..KGgGGGGK..',
      '..KGgRRGGK..',
      '..KGGRRGGK..',
      '..KGGGGGGK..',
      '...KGGGGK...',
      '....KKKK....',
      '............',
      '............',
    ],
  },
  chilli: {
    pal: { R: '#e02a2a', r: '#ff7a6a', g: '#3f9a3a', K: '#2a1020' },
    rows: [
      '.........g..',
      '........gg..',
      '.......KggK.',
      '......KRRK..',
      '.....KRrRK..',
      '....KRrRK...',
      '...KRRRK....',
      '..KRRRK.....',
      '.KRRRK......',
      '.KRRK.......',
      '..KK........',
      '............',
    ],
  },
  brie: {
    pal: { W: '#fff6e0', w: '#e8dcc0', Y: '#ffcf5a', D: '#c89a2a', K: '#2a1020', S: '#ffffff' },
    rows: [
      'S..........S',
      '.........KK.',
      '.......KKYK.',
      '.....KKYWWK.',
      '...KKYWWWWK.',
      '.KKYWWWwWWK.',
      'KYWWWWWWWWK.',
      'KYWwWWWWwWK.',
      'KYWWWWWWWWK.',
      'KDDDDDDDDDK.',
      '.KKKKKKKKKK.',
      'S.........S.',
    ],
  },
};

function mountCheese(root, api, view0) {
  const w = WINERIES[view0.winery] || WINERIES[0];
  const el = h('div', 'svs svs-game svs-game--cheese');
  el.style.setProperty('--acc', w.colour);
  root.appendChild(el);
  const head = gameHeader(el, view0, GAMES.cheese.title);
  const info = h('p', 'svs-sub', 'Tap the food. Food sobers you up. Chilli does not.');
  el.appendChild(info);
  const stage = h('div', 'svs-stage svs-stage--tall');
  el.appendChild(stage);
  const pc = pixelCanvas(stage, CW, CH);
  pc.cv.style.touchAction = 'none';
  const pops = h('div', 'svs-pops');
  stage.appendChild(pops);
  const flash = flasher(stage, '6%');
  const intro = introCard(el, view0, 'cheese');

  let view = view0;
  const items = buildPlatter(view0.seed, view0.stop);
  const mineLocal = new Set(); //   optimistic: I tapped it
  const seenEaten = new Set();
  let myCount = 0;
  const fx = []; //                 crumbs

  function visible(it, now) {
    const t = now - view.sg.t0;
    return t >= it.at && t <= it.at + FOOD_TTL && view.sg.eaten?.[it.id] == null && !mineLocal.has(it.id);
  }

  pc.cv.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const now = api.now();
    if (now < view.sg.t0 || now > (view.ends ?? Infinity)) return;
    const p = pc.toLocal(e);
    let best = null;
    let bd = Infinity;
    for (const it of items) {
      if (!visible(it, now)) continue;
      const dx = it.x * CW - p.x;
      const dy = it.y * CH - p.y;
      const d = Math.hypot(dx, dy);
      const r = Math.max(17, FOOD[it.k].r * CW * 1.35);
      if (d < r && d < bd) {
        best = it;
        bd = d;
      }
    }
    if (!best) {
      api.sfx('tap');
      return;
    }
    mineLocal.add(best.id);
    api.send({ t: 'eat', id: best.id });
    api.sfx(best.k === 'chilli' ? 'fail' : best.k === 'brie' ? 'cheer' : 'chomp');
    api.haptic(12);
    for (let i = 0; i < 6; i++) {
      fx.push({ x: best.x * CW, y: best.y * CH, vx: (Math.random() - 0.5) * 50, vy: -30 - Math.random() * 30, life: 0.5, c: FOOD_ART[best.k].pal[Object.keys(FOOD_ART[best.k].pal)[0]] });
    }
    if (best.k === 'chilli') flash('CHILLI! Not sobering.', 'bad');
    else if (best.k === 'brie') flash('THE GOLDEN BRIE!', 'good');
  });

  const stopLoop = loop((dt, t) => {
    const now = api.now();
    intro.tick(now, view.sg.t0, api);
    const tr = myTier(view, api);
    const endAt = view.ends ?? now;
    setBar(head.bar, (endAt - now) / Math.max(1, endAt - view.sg.t0));
    head.score.textContent = `${myCount} eaten`;
    for (const p of fx) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 140 * dt;
      p.life -= dt;
    }
    while (fx.length && fx[0].life <= 0) fx.shift();

    const ctx = pc.ctx;
    drawBoard(ctx);
    const tt = now - view.sg.t0;
    for (const it of items) {
      if (!visible(it, now)) continue;
      const age = tt - it.at;
      const left = it.at + FOOD_TTL - tt;
      const pop = Math.min(1, age / 140);
      const blink = left < 600 && Math.floor(left / 90) % 2 === 0;
      if (blink) continue;
      const art = FOOD_ART[it.k];
      const half = 6 * FOOD_SC;
      const x = it.x * CW - half;
      const y = it.y * CH - half + (1 - pop) * 4;
      if (tr >= 2 && !REDUCE) {
        // double vision: a ghost twin off to one side
        const gx = Math.sin(t / 380 + it.id) * (5 + tr * 2) + (it.id % 2 ? 14 : -14);
        drawMap(ctx, art.rows, art.pal, x + gx, y + 2, 0.42, FOOD_SC);
      }
      if (it.k === 'brie' && Math.floor(t / 160) % 2) {
        ctx.fillStyle = 'rgba(255,207,90,0.35)';
        ctx.fillRect(Math.round(x) - 3, Math.round(y) - 3, half * 2 + 6, half * 2 + 6);
      }
      drawMap(ctx, art.rows, art.pal, x, y, pop, FOOD_SC);
    }
    for (const p of fx) {
      ctx.fillStyle = p.c;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), 2, 2);
    }
  });

  return {
    update(v) {
      view = v;
      const eaten = v.sg?.eaten || {};
      myCount = v.sg?.cnt?.[v.me] ?? mineLocal.size;
      for (const [id, who] of Object.entries(eaten)) {
        if (seenEaten.has(id)) continue;
        seenEaten.add(id);
        const cid = CAST_IDS[who];
        if (!cid || cid === v.me) continue;
        // somebody else got it — show who
        const it = items.find((x) => String(x.id) === String(id));
        if (!it) continue;
        mineLocal.delete(it.id);
        const pic = api.portrait(cid, 32);
        pic.className = 'svs-pop';
        pic.style.left = `${it.x * 100}%`;
        pic.style.top = `${it.y * 100}%`;
        pops.appendChild(pic);
        setTimeout(() => pic.remove(), 750);
      }
    },
    destroy() {
      stopLoop();
      pc.destroy();
    },
  };
}

function drawBoard(ctx) {
  ctx.fillStyle = '#2a1020';
  ctx.fillRect(0, 0, CW, CH);
  // the board
  ctx.fillStyle = '#b07a48';
  ctx.fillRect(4, 6, CW - 8, CH - 12);
  ctx.fillStyle = '#c08a58';
  for (let y = 10; y < CH - 10; y += 7) ctx.fillRect(6, y, CW - 12, 2);
  ctx.fillStyle = '#8a5a30';
  ctx.fillRect(4, 6, CW - 8, 1);
  ctx.fillRect(4, CH - 7, CW - 8, 1);
  ctx.fillRect(4, 6, 1, CH - 12);
  ctx.fillRect(CW - 5, 6, 1, CH - 12);
  // handle hole
  ctx.fillStyle = '#2a1020';
  ctx.fillRect(CW / 2 - 6, 9, 12, 3);
  // a knife, for the look of the thing
  ctx.fillStyle = '#c8d0d8';
  ctx.fillRect(10, CH - 18, 20, 2);
  ctx.fillStyle = '#3a2a2a';
  ctx.fillRect(30, CH - 18, 8, 2);
}

// ── GAME: Tasting Notes (quiz) ───────────────────────────────────────────────
function mountQuiz(root, api, view0) {
  const w = WINERIES[view0.winery] || WINERIES[0];
  const el = h('div', 'svs svs-game svs-game--quiz');
  el.style.setProperty('--acc', w.colour);
  root.appendChild(el);
  const head = gameHeader(el, view0, GAMES.quiz.title);
  const qWrap = h('div', 'svs-quiz');
  el.appendChild(qWrap);
  qWrap.innerHTML = `
    <p class="svs-quiz__n" data-n></p>
    <p class="svs-quiz__prompt" data-prompt></p>
    <div class="svs-qbar"><i data-qbar></i></div>
    <div class="svs-quiz__opts" data-opts></div>
    <p class="svs-quiz__res" data-res></p>`;
  const nEl = qWrap.querySelector('[data-n]');
  const promptEl = qWrap.querySelector('[data-prompt]');
  const qbar = qWrap.querySelector('[data-qbar]');
  const optsEl = qWrap.querySelector('[data-opts]');
  const resEl = qWrap.querySelector('[data-res]');
  const intro = introCard(el, view0, 'quiz');

  let view = view0;
  let shownQ = -2;
  let shuffled = false;
  let revealedQ = -1;
  let holdUntil = 0;
  const answered = {}; // q → i (local)
  let btns = [];

  function curQ(now) {
    return clamp(Math.floor((now - view.sg.t0) / QUIZ_Q_MS), 0, QUIZ_Q - 1);
  }

  function build(q) {
    const qd = view.sg.qs?.[q];
    optsEl.innerHTML = '';
    btns = [];
    shuffled = false;
    if (!qd || !qd.opts) {
      promptEl.textContent = 'The sommelier is swirling…';
      return false;
    }
    nEl.textContent = `Note ${q + 1} of ${QUIZ_Q}`;
    promptEl.innerHTML =
      qd.kind === 'real'
        ? 'Which one is a <b>REAL</b> tasting note?'
        : 'Which one did we <b>MAKE UP</b>?';
    qd.opts.forEach((txt, i) => {
      const b = h('button', 'svs-opt', `<span>${esc(txt)}</span>`);
      b.type = 'button';
      b.dataset.i = String(i);
      b.style.order = String(i);
      b.addEventListener('click', () => {
        const now = api.now();
        if (curQ(now) !== q || answered[q] != null || mineAns(q)) return;
        if (now < view.sg.t0 || now > (view.ends ?? Infinity)) return;
        answered[q] = i;
        api.send({ t: 'ans', q, i });
        api.sfx('tap');
        api.haptic(10);
        paintOpts(q);
      });
      btns.push(b);
      optsEl.appendChild(b);
    });
    resEl.textContent = '';
    return true;
  }

  function mineAns(q) {
    const m = view.sg.mine?.[q];
    return m ? m[0] : null;
  }

  function paintOpts(q) {
    const qd = view.sg.qs?.[q];
    const pickI = answered[q] ?? mineAns(q);
    const a = qd?.a;
    for (const b of btns) {
      const i = Number(b.dataset.i);
      b.dataset.pick = pickI === i ? '1' : '0';
      b.dataset.res = a == null ? '' : i === a ? 'right' : pickI === i ? 'wrong' : 'dim';
      b.disabled = pickI != null || a != null;
    }
    if (a != null && revealedQ !== q) {
      revealedQ = q;
      if (pickI == null) {
        resEl.textContent = 'Too slow — the sommelier sighs.';
        api.sfx('buzz');
      } else if (pickI === a) {
        resEl.textContent = 'Correct! A nose for it.';
        api.sfx('ding');
      } else {
        resEl.textContent = 'Nope. Bold guess, though.';
        api.sfx('fail');
      }
    } else if (a == null && pickI != null) {
      resEl.textContent = 'Locked in. Swirling…';
    }
  }

  const stopLoop = loop((dt, t) => {
    const now = api.now();
    intro.tick(now, view.sg.t0, api);
    if (now < view.sg.t0) return;
    const tr = myTier(view, api);
    const endAt = view.ends ?? now;
    setBar(head.bar, (endAt - now) / Math.max(1, endAt - view.sg.t0));
    head.score.textContent = `${view.sg.score ?? 0} pts`;
    const q = curQ(now);
    if (q !== shownQ) {
      // Hold the last question's right/wrong on screen for a beat before
      // swapping in the next one (its clock is already running).
      const pnow = performance.now();
      if (shownQ >= 0 && !holdUntil) holdUntil = pnow + 1100;
      const prevDone = shownQ < 0 || view.sg.qs?.[shownQ]?.a != null || pnow >= holdUntil + 700;
      if (shownQ < 0 || (pnow >= holdUntil && prevDone)) {
        if (view.sg.qs?.[q]?.opts && build(q)) {
          shownQ = q;
          holdUntil = 0;
        }
      }
    }
    if (shownQ >= 0) {
      const qt = now - view.sg.t0 - shownQ * QUIZ_Q_MS;
      setBar(qbar, 1 - qt / QUIZ_Q_MS);
      // Sloshed: the options swap places once, mid-question.
      if (tr >= 3 && !shuffled && qt > QUIZ_Q_MS * 0.42 && answered[shownQ] == null && mineAns(shownQ) == null) {
        shuffled = true;
        const order = [0, 1, 2, 3].sort(() => Math.random() - 0.5);
        btns.forEach((b, i) => (b.style.order = String(order[i])));
        resEl.textContent = 'Hang on, did they just move?';
      }
      if (tr >= 2 && !REDUCE) {
        btns.forEach((b, i) => {
          const s = b.firstChild;
          if (s) s.style.transform = `translate(${Math.sin(t / 300 + i * 1.7) * tr}px, ${Math.cos(t / 410 + i) * (tr - 1)}px) rotate(${Math.sin(t / 520 + i) * tr * 0.6}deg)`;
        });
      }
    }
  });

  return {
    update(v) {
      view = v;
      if (shownQ < 0 && v.sg?.q >= 0 && v.sg.qs?.[v.sg.q]?.opts && build(v.sg.q)) shownQ = v.sg.q;
      if (shownQ >= 0) paintOpts(shownQ);
    },
    destroy() {
      stopLoop();
    },
  };
}

// ── GAME: Load the Bus (stack) ───────────────────────────────────────────────
const KW = 100;
const KH = 150;
const CASE_H = 9;

function mountStack(root, api, view0) {
  const w = WINERIES[view0.winery] || WINERIES[0];
  const el = h('div', 'svs svs-game svs-game--stack');
  el.style.setProperty('--acc', w.colour);
  root.appendChild(el);
  const head = gameHeader(el, view0, GAMES.stack.title);
  const body = h('div', 'svs-split');
  el.appendChild(body);
  const stage = h('div', 'svs-stage svs-stage--tall');
  body.appendChild(stage);
  const side = h('div', 'svs-side');
  body.appendChild(side);
  const boardBox = h('div', 'svs-boardbox');
  side.appendChild(boardBox);
  const board = makeBoard(boardBox, api);
  const pc = pixelCanvas(stage, KW, KH);
  pc.cv.style.touchAction = 'none';
  const flashDom = flasher(stage, '22%');
  const msg = h('p', 'svs-sub svs-sub--c', 'Tap anywhere to drop the case. Perfect drops grow the next case.');
  el.appendChild(msg);
  const intro = introCard(el, view0, 'stack');

  let view = view0;
  // The stack: bottom case is the bus floor.
  const stack = [{ x: KW / 2, w: 46 }];
  let n = 0;
  let curW = 46;
  let phase = 0;
  let dropping = null; //        {x, w, y, vy}
  let falling = []; //           shaved bits / smashed cases
  let camY = 0;
  let lastDrop = 0;

  function topY(i) {
    return KH - 14 - (i + 1) * CASE_H;
  }

  function swingX() {
    // flattened sine so the case doesn't dawdle at the ends
    const s = Math.sin(phase);
    return KW / 2 + 30 * Math.sign(s) * Math.pow(Math.abs(s), 0.8);
  }

  function tap(e) {
    e.preventDefault();
    const now = api.now();
    if (now < view.sg.t0 || now > (view.ends ?? Infinity)) return;
    if (dropping || now - lastDrop < 420) return;
    // starts where the swinging case is drawn (screen y 14) in world space
    dropping = { x: swingX(), w: curW, y: 14 - camY, vy: 0 };
    lastDrop = now;
    api.sfx('whoosh');
  }
  pc.cv.addEventListener('pointerdown', tap);
  stage.addEventListener('pointerdown', (e) => {
    if (e.target === stage) tap(e);
  });

  function land(d) {
    const top = stack[stack.length - 1];
    const dx = d.x - top.x;
    const overlap = top.w / 2 + d.w / 2 - Math.abs(dx);
    if (overlap <= 2) {
      falling.push({ x: d.x, w: d.w, y: topY(stack.length - 1), vy: 30, rot: dx > 0 ? 1 : -1, smash: true });
      flash('Smashed!', 'bad');
      api.sfx('smash');
      api.haptic(40);
      return;
    }
    let nx;
    let nw;
    let perfect = false;
    if (Math.abs(dx) <= Math.max(1.5, top.w * 0.08)) {
      nx = top.x;
      nw = Math.min(46, d.w + 3); // a perfect drop earns a little width back
      perfect = true;
    } else {
      const left = Math.max(top.x - top.w / 2, d.x - d.w / 2);
      const right = Math.min(top.x + top.w / 2, d.x + d.w / 2);
      nw = Math.max(8, right - left);
      nx = (left + right) / 2;
      // shaved bit
      const shaveW = d.w - (right - left);
      if (shaveW > 0.5) {
        const sx = dx > 0 ? right + shaveW / 2 : left - shaveW / 2;
        falling.push({ x: sx, w: shaveW, y: topY(stack.length - 1), vy: 20, rot: Math.sign(dx), smash: false });
      }
    }
    stack.push({ x: nx, w: nw });
    curW = nw;
    n++;
    api.send({ t: 'stack', n, p: perfect ? 1 : 0 });
    if (perfect) {
      flash('PERFECT!', 'good');
      api.sfx('ding');
    } else {
      flash(nw < 16 ? 'Wobbly\u2026' : 'Stacked.', nw < 16 ? 'bad' : '');
      api.sfx('stomp');
    }
    api.haptic(perfect ? 25 : 12);
  }

  function flash(t, tone) {
    flashDom(t, tone);
  }

  const stopLoop = loop((dt) => {
    const now = api.now();
    intro.tick(now, view.sg.t0, api);
    const tr = myTier(view, api);
    const endAt = view.ends ?? now;
    setBar(head.bar, (endAt - now) / Math.max(1, endAt - view.sg.t0));
    head.score.textContent = `${n} cases`;
    if (now >= view.sg.t0) phase += dt * (1.45 + n * 0.08 + tr * (REDUCE ? 0.2 : 0.45));

    if (dropping) {
      dropping.vy += 1600 * dt;
      dropping.y += dropping.vy * dt;
      const targetY = topY(stack.length - 1);
      if (dropping.y >= targetY) {
        const d = dropping;
        dropping = null;
        land(d);
      }
    }
    for (const f of falling) {
      f.vy += 400 * dt;
      f.y += f.vy * dt;
      f.x += f.rot * 18 * dt;
    }
    falling = falling.filter((f) => f.y < KH + 40 - camY);

    // Camera: keep the top of the stack in the lower-middle of the view.
    const wantCam = Math.max(0, (stack.length - 9) * CASE_H);
    camY += (wantCam - camY) * Math.min(1, dt * 4);

    const ctx = pc.ctx;
    ctx.fillStyle = '#2a1020';
    ctx.fillRect(0, 0, KW, KH);
    ctx.save();
    ctx.translate(0, Math.round(camY));
    // the bus boot
    ctx.fillStyle = '#f6ecd2';
    ctx.fillRect(10, KH - 14, KW - 20, 14);
    ctx.fillStyle = '#7a1f3d';
    ctx.fillRect(10, KH - 14, KW - 20, 3);
    ctx.fillStyle = '#2a1020';
    ctx.fillRect(18, KH - 4, 12, 4);
    ctx.fillRect(KW - 30, KH - 4, 12, 4);
    // the pallet (stack[0]) the first case has to land on
    ctx.fillStyle = '#5a3a2a';
    ctx.fillRect(Math.round(stack[0].x - stack[0].w / 2), KH - 16, stack[0].w, 2);
    // cases
    for (let i = 1; i < stack.length; i++) drawCase(ctx, stack[i].x, topY(i - 1), stack[i].w, w.colour);
    for (const f of falling) drawCase(ctx, f.x, f.y, f.w, f.smash ? '#ff6b6b' : w.colour);
    ctx.restore();
    // the swinging case (screen space)
    if (now >= view.sg.t0 && now <= endAt) {
      const sy = 14;
      if (dropping) drawCase(ctx, dropping.x, dropping.y + camY, dropping.w, w.colour);
      else {
        const x = swingX();
        ctx.fillStyle = '#c8d0d8';
        ctx.fillRect(Math.round(x), 0, 1, sy);
        drawCase(ctx, x, sy, curW, w.colour);
      }
    }
  });

  return {
    update(v) {
      view = v;
      const m = v.sg?.n || {};
      // Reconnected mid-stack: the server needs n = its count + 1 next.
      if ((m[v.me] || 0) > n) n = m[v.me];
      const entries = humansOf(v).map((cid) => ({ cid, v: cid === v.me ? Math.max(n, m[cid] || 0) : m[cid] || 0 }));
      board.update(entries, v.me);
    },
    destroy() {
      stopLoop();
      pc.destroy();
    },
  };
}

function drawCase(ctx, cx, y, w, label) {
  const x = Math.round(cx - w / 2);
  const ww = Math.max(2, Math.round(w));
  const yy = Math.round(y);
  ctx.fillStyle = '#2a1020';
  ctx.fillRect(x - 1, yy - 1, ww + 2, CASE_H + 1);
  ctx.fillStyle = '#b07a48';
  ctx.fillRect(x, yy, ww, CASE_H - 1);
  ctx.fillStyle = '#c99060';
  ctx.fillRect(x, yy, ww, 1);
  if (ww > 8) {
    ctx.fillStyle = label;
    ctx.fillRect(x + Math.floor(ww / 2) - Math.min(6, Math.floor(ww / 3)), yy + 2, Math.min(12, Math.floor((ww * 2) / 3)), 4);
  }
  ctx.fillStyle = '#8a5a30';
  if (ww > 4) {
    ctx.fillRect(x + 1, yy + CASE_H - 3, 1, 1);
    ctx.fillRect(x + ww - 2, yy + CASE_H - 3, 1, 1);
  }
}

const GAME_MOUNTS = {
  pour: mountPourGame,
  stomp: mountStomp,
  cheese: mountCheese,
  quiz: mountQuiz,
  stack: mountStack,
};

// ── CSS ──────────────────────────────────────────────────────────────────────
function injectCss() {
  if (document.getElementById('svs-css')) return;
  const st = document.createElement('style');
  st.id = 'svs-css';
  st.textContent = `
.svs {
  --svs-cream: #f6ecd2;
  --svs-paper: #fff8e7;
  --svs-ink: #2a1020;
  --svs-wine: #7a1f3d;
  --svs-gold: #ffcf5a;
  --svs-dim: #b9a0a8;
  position: absolute; inset: 0;
  display: flex; flex-direction: column; gap: 10px;
  padding: 12px 16px calc(14px + env(safe-area-inset-bottom));
  background: #1d0f1f;
  color: var(--svs-cream);
  font-family: var(--ar-mono, ui-monospace, monospace);
  overflow: hidden;
  user-select: none; -webkit-user-select: none; -webkit-touch-callout: none;
}
.svs * { box-sizing: border-box; }
.svs-px { image-rendering: pixelated; image-rendering: crisp-edges; display: block; }
.svs-eyebrow { margin: 0; font-size: 10px; letter-spacing: .14em; text-transform: uppercase; color: var(--svs-dim); }
.svs-bar { height: 6px; background: #3a1a2c; border: 2px solid var(--svs-ink); margin-top: 8px; }
.svs-bar i { display: block; height: 100%; background: var(--acc, var(--svs-gold)); transform-origin: left; }
.svs-note { margin: 0; color: var(--svs-dim); font-size: 13px; }
.svs-sub { margin: 0; font-size: 12px; color: var(--svs-dim); line-height: 1.4; min-height: 1.4em; }
.svs-sub--c { text-align: center; }

/* ── pour (drink picker) ── */
.svs-ph { background: var(--svs-cream); color: var(--svs-ink); border: 3px solid var(--svs-ink);
  box-shadow: 0 4px 0 #2a1020; padding: 10px 12px 10px; position: relative; }
.svs-ph::before { content: ''; position: absolute; left: 0; right: 0; top: 0; height: 6px; background: var(--acc); }
.svs-ph .svs-eyebrow { color: #8a6a70; margin-top: 4px; }
.svs-ph__title { margin: 6px 0 2px; font-family: var(--ar-display, monospace); font-size: 15px; line-height: 1.35; color: var(--svs-wine); }
.svs-ph__wine { margin: 0; font-size: 12px; display: flex; align-items: center; gap: 6px; }
.svs-swatch { width: 12px; height: 12px; background: var(--acc); border: 2px solid var(--svs-ink); display: inline-block; }
.svs-ph .svs-bar { background: #e4d6b4; }

.svs-keys { display: flex; align-items: center; gap: 10px; min-height: 36px; }
.svs-keys__pic { width: 32px; height: 32px; image-rendering: pixelated; background: #2a1020; border: 2px solid var(--svs-gold); }
.svs-keys__txt { margin: 0; font-size: 13px; }
.svs-keys__txt b { color: var(--svs-gold); }

.svs-choice { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; max-height: 380px; }
.svs-drinks { flex: 1 1 auto; display: grid; grid-template-columns: 1fr 1fr; grid-auto-rows: minmax(96px, 1fr); gap: 10px; }
.svs-drink { appearance: none; text-align: left; display: flex; flex-direction: column; gap: 4px;
  min-height: 96px; padding: 10px 10px 9px; background: var(--svs-cream); color: var(--svs-ink);
  border: 3px solid var(--svs-ink); box-shadow: 0 4px 0 #120810; cursor: pointer; font: inherit;
  touch-action: manipulation; transition: transform .06s; }
.svs-drink:active { transform: translateY(3px); box-shadow: 0 1px 0 #120810; }
.svs-drink[data-on="1"] { background: var(--svs-gold); box-shadow: 0 4px 0 var(--svs-wine); }
.svs-drink[data-on="1"] .svs-drink__label::after { content: ' \\2713'; }
.svs-drink__label { font-family: var(--ar-display, monospace); font-size: 10px; line-height: 1.4; color: var(--svs-wine); }
.svs-drink__stats { font-size: 11px; font-weight: 700; }
.svs-drink__line { font-size: 11px; color: #6a4a50; line-height: 1.3; }
.svs-drink__after { font-size: 10px; letter-spacing: .08em; text-transform: uppercase; color: var(--svs-wine); margin-top: auto; }

.svs-dd { display: flex; gap: 14px; align-items: center; background: var(--svs-cream); color: var(--svs-ink);
  border: 3px solid var(--svs-ink); box-shadow: 0 4px 0 var(--svs-gold); padding: 14px; }
.svs-dd__glass { flex: 0 0 auto; width: 34px; height: 54px; position: relative;
  background: linear-gradient(#0000 0 22%, #5a1446 22% 70%, #0000 70%);
  border: 3px solid var(--svs-ink); border-top: 0; }
.svs-dd__glass::after { content: ''; position: absolute; left: 50%; bottom: -14px; width: 4px; height: 12px; margin-left: -2px; background: var(--svs-ink); }
.svs-dd__eyebrow { margin: 0; font-size: 10px; letter-spacing: .14em; text-transform: uppercase; color: #8a6a70; }
.svs-dd__title { margin: 4px 0; font-family: var(--ar-display, monospace); font-size: 11px; line-height: 1.5; color: var(--svs-wine); }
.svs-dd__line { margin: 0; font-size: 12px; line-height: 1.4; }
.svs-dd__stats { margin: 6px 0 0; font-size: 11px; font-weight: 700; }

.svs-me { border-top: 2px solid #3a1a2c; padding-top: 8px; }
.svs-me__row { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; font-size: 12px; }
.svs-me__lbl { font-size: 10px; letter-spacing: .14em; text-transform: uppercase; color: var(--svs-dim); }
.svs-me__tier { font-family: var(--ar-display, monospace); font-size: 10px; color: var(--svs-gold); }
.svs-me__tier[data-t="0"] { color: #6ee7a5; }
.svs-me__tier[data-t="3"], .svs-me__tier[data-t="4"] { color: #ff8a7a; }
.svs-me__blurb { color: var(--svs-dim); }
.svs-tipsy { position: relative; height: 8px; margin-top: 6px; background: #3a1a2c; border: 2px solid var(--svs-ink); }
.svs-tipsy i { position: absolute; inset: 0; background: linear-gradient(90deg, #6ee7a5, #ffcf5a 45%, #ff8a7a 80%); transform-origin: left; }
.svs-tipsy b { position: absolute; top: -2px; bottom: -2px; width: 2px; background: #1d0f1f; }

.svs-crowd__lbl { margin-top: 2px; }
.svs-crowd { display: grid; grid-template-columns: repeat(6, 1fr); gap: 6px 4px; }
.svs-crowd__cell { display: flex; flex-direction: column; align-items: center; gap: 2px; opacity: .72; }
.svs-crowd__cell[data-h="1"] { opacity: 1; }
.svs-crowd__pic { width: 32px; height: 32px; image-rendering: pixelated; background: #2a1020; border: 2px solid #3a1a2c; }
.svs-crowd__cell[data-me="1"] .svs-crowd__pic { border-color: var(--svs-gold); }
.svs-crowd__tag { font-size: 9px; letter-spacing: .06em; color: var(--svs-dim); }
.svs-crowd__cell[data-k="skull"] .svs-crowd__tag { color: #ff8a7a; font-weight: 700; }
.svs-crowd__cell[data-k="glass"] .svs-crowd__tag { color: var(--svs-gold); }
.svs-crowd__cell[data-k="juice"] .svs-crowd__tag { color: #6ee7a5; }

/* ── games: shared ── */
.svs-gh { background: var(--svs-cream); color: var(--svs-ink); border: 3px solid var(--svs-ink);
  box-shadow: 0 4px 0 #120810; padding: 8px 10px; position: relative; }
.svs-gh::before { content: ''; position: absolute; left: 0; right: 0; top: 0; height: 5px; background: var(--acc); }
.svs-gh__row { display: flex; justify-content: space-between; align-items: baseline; margin-top: 4px; font-size: 10px; letter-spacing: .12em; text-transform: uppercase; color: #8a6a70; }
.svs-gh__score { font-family: var(--ar-display, monospace); font-size: 10px; letter-spacing: 0; color: var(--svs-wine); text-transform: none; }
.svs-gh__title { margin: 6px 0 0; font-family: var(--ar-display, monospace); font-size: 13px; color: var(--svs-wine); }
.svs-gh .svs-bar { background: #e4d6b4; margin-top: 6px; }

.svs-stage { flex: 1 1 auto; min-height: 0; display: flex; align-items: center; justify-content: center;
  position: relative; touch-action: none; }
.svs-stage--short { flex: 1 1 auto; }
.svs-split { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; gap: 8px; }
.svs-side { flex: 0 0 auto; }

.svs-big { appearance: none; font-family: var(--ar-display, monospace); font-size: 13px; letter-spacing: .04em;
  min-height: 68px; color: var(--svs-ink); background: var(--svs-gold); border: 3px solid var(--svs-ink);
  box-shadow: 0 5px 0 #120810; cursor: pointer; touch-action: none; }
.svs-big[data-on="1"] { transform: translateY(4px); box-shadow: 0 1px 0 #120810; background: var(--acc); color: var(--svs-cream); }
.svs-big:disabled { opacity: .45; }

.svs-feet { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.svs-feet[data-swap="1"] .svs-foot[data-f="L"] { order: 2; }
.svs-feet[data-swap="1"] { animation: svs-wob .5s ease-out; }
.svs-foot { appearance: none; min-height: 96px; background: var(--svs-cream); color: var(--svs-ink);
  border: 3px solid var(--svs-ink); box-shadow: 0 5px 0 #120810; font-family: var(--ar-display, monospace);
  font-size: 12px; cursor: pointer; touch-action: none; }
.svs-foot[data-on="1"] { transform: translateY(4px); box-shadow: 0 1px 0 #120810; background: var(--acc); color: var(--svs-cream); }

.svs-board { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 4px 10px; }
.svs-board__row { display: flex; align-items: center; gap: 6px; font-size: 12px; min-width: 0; }
.svs-board__pic { width: 24px; height: 24px; image-rendering: pixelated; background: #2a1020; border: 2px solid #3a1a2c; flex: 0 0 auto; }
.svs-board__row[data-me="1"] .svs-board__pic { border-color: var(--svs-gold); }
.svs-board__row[data-me="1"] .svs-board__name { color: var(--svs-gold); }
.svs-board__name { flex: 1 1 auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.svs-board__v { font-weight: 700; }

.svs-pops { position: absolute; inset: 0; pointer-events: none; }
.svs-flash { position: absolute; left: 50%; z-index: 2; transform: translate(-50%, 0); pointer-events: none; opacity: 0;
  white-space: nowrap; font-family: var(--ar-display, monospace); font-size: 13px; color: var(--svs-gold);
  text-shadow: 2px 2px 0 #2a1020, -1px -1px 0 #2a1020; }
.svs-flash[data-tone="good"] { color: #6ee7a5; }
.svs-flash[data-tone="bad"] { color: #ff8a7a; }
.svs-flash--on { animation: svs-flash 1.4s ease-out forwards; }
@keyframes svs-flash { 0% { opacity: 0; transform: translate(-50%, 8px) scale(.7); } 12% { opacity: 1; transform: translate(-50%, 0) scale(1.12); }
  22% { transform: translate(-50%, 0) scale(1); } 75% { opacity: 1; } 100% { opacity: 0; transform: translate(-50%, -10px); } }
.svs-pop { position: absolute; width: 32px; height: 32px; margin: -16px 0 0 -16px; image-rendering: pixelated;
  border: 2px solid var(--svs-gold); background: #2a1020; animation: svs-pop .75s ease-out forwards; }

/* intro */
.svs-intro { position: absolute; inset: 0; z-index: 5; display: flex; align-items: center; justify-content: center;
  padding: 16px; background: rgba(29,15,31,.94); }
.svs-intro[hidden] { display: none; }
.svs-intro__card { width: 100%; max-width: 360px; background: var(--svs-cream); color: var(--svs-ink);
  border: 3px solid var(--svs-ink); box-shadow: 0 6px 0 var(--acc, var(--svs-wine)); padding: 18px 16px 16px; text-align: center; }
.svs-intro__card .svs-eyebrow { color: #8a6a70; }
.svs-intro__title { margin: 10px 0 10px; font-family: var(--ar-display, monospace); font-size: 16px; line-height: 1.4; color: var(--svs-wine); }
.svs-intro__how { margin: 0 0 10px; font-size: 14px; line-height: 1.45; font-weight: 700; }
.svs-intro__line { margin: 0; font-size: 12px; color: #6a4a50; font-style: italic; line-height: 1.4; }
.svs-intro__count { margin-top: 12px; height: 34px; font-family: var(--ar-display, monospace); font-size: 28px; color: var(--svs-wine); }

/* quiz */
.svs-quiz { flex: 1 1 auto; display: flex; flex-direction: column; gap: 10px; min-height: 0; }
.svs-quiz__n { margin: 0; font-size: 10px; letter-spacing: .14em; text-transform: uppercase; color: var(--svs-dim); }
.svs-quiz__prompt { margin: 0; font-family: var(--ar-display, monospace); font-size: 12px; line-height: 1.6; }
.svs-quiz__prompt b { color: var(--svs-gold); font-weight: normal; }
.svs-qbar { height: 5px; background: #3a1a2c; }
.svs-qbar i { display: block; height: 100%; background: var(--svs-cream); transform-origin: left; }
.svs-quiz__opts { display: flex; flex-direction: column; gap: 10px; }
.svs-opt { appearance: none; text-align: left; min-height: 58px; padding: 10px 12px; font: inherit; font-size: 14px;
  font-weight: 700; line-height: 1.3; color: var(--svs-ink); background: var(--svs-cream); border: 3px solid var(--svs-ink);
  box-shadow: 0 4px 0 #120810; cursor: pointer; touch-action: manipulation; }
.svs-opt span { display: inline-block; }
.svs-opt:disabled { cursor: default; }
.svs-opt[data-pick="1"] { background: var(--svs-gold); }
.svs-opt[data-res="right"] { background: #6ee7a5; }
.svs-opt[data-res="wrong"] { background: #ff8a7a; }
.svs-opt[data-res="dim"] { opacity: .5; }
.svs-quiz__res { margin: 0; min-height: 1.4em; font-size: 13px; color: var(--svs-gold); }

@keyframes svs-pop { 0% { transform: scale(.4); opacity: 0; } 25% { transform: scale(1.15); opacity: 1; } 100% { transform: translateY(-14px); opacity: 0; } }
@keyframes svs-wob { 0% { transform: rotate(0); } 30% { transform: rotate(-3deg); } 60% { transform: rotate(2deg); } 100% { transform: rotate(0); } }
@media (prefers-reduced-motion: reduce) {
  .svs-feet[data-swap="1"], .svs-pop { animation: none; }
  .svs-flash--on { animation: none; opacity: 1; }
}
@media (max-height: 680px) {
  .svs { gap: 8px; padding-top: 8px; }
  .svs-drink { min-height: 84px; }
  .svs-crowd__pic { width: 28px; height: 28px; }
  .svs-foot { min-height: 80px; }
}
`;
  document.head.appendChild(st);
}
