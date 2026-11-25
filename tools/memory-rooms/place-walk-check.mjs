#!/usr/bin/env node
/* place-walk-check: walking a WHOLE PLACE together (/memories/b/:id/walk): the building's walk room (the
   Durable Object keyed `b:<id>`, workers/memory-walk.js), its ticket routes (workers/memory-rooms.js), the
   game's floors + stairs (walk/WalkGame.js loadPlace) and the place page's "Walk in" + presence line.

     npm run build && npx wrangler dev --port 8788      (restart wrangler after every build)
     node tools/memory-rooms/dev/seed-place.mjs <buildingId> --base http://127.0.0.1:8788   (a built place locally)
     node tools/memory-rooms/place-walk-check.mjs [--base http://127.0.0.1:8788] [--building <id>] [--dark]

   Checks
     routes    POST /buildings/:id/walk: 401 without the password, 400 bad who, 404 unknown place, 200 → a ticket
               keyed `b:<id>`; GET presence 200
     keys      a place ticket with its `b:` dropped (posing as a spot's) → 403; a person in the place is not in
               any spot's room (a spot of the place, joined at the same time, sees nobody)
     protocol  (raw sockets) a state's level `l` is relayed (and kept in presence), a bad level is dropped to null
     browsers  James + Justin walk in on the lowest level and see each other; James walks (tap) to the foot of a
               flight and climbs it with the keyboard: his y rises with the treads, his level flips to the upper
               one, and his own page says Justin is downstairs; Justin's page stops drawing James (sprite + tag)
               and says James is upstairs; James comes back down and they see each other again
     place     the place page shows "Walk in" (→ /memories/b/:id/walk) and "<name> is walking here" while one walks
     console   zero console errors and page errors
   Screens → memory-rooms-work/_page-check/place-walk-*.png. Exit 1 if anything fails. */

import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import WebSocket from 'ws';
import { client, config, WORK } from './lib/api.mjs';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const args = process.argv.slice(2);
const opt = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const base = opt('--base', 'http://127.0.0.1:8788').replace(/\/+$/, '');
const scheme = args.includes('--dark') ? 'dark' : 'light';
const FG = ['--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows'];
const OUT = path.join(WORK, '_page-check');
fs.mkdirSync(OUT, { recursive: true });
const cfg = config();
cfg.base = base;
const api = client(cfg);
const API = `${base}/api/memories`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const record = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? `  ${detail}` : ''}`);
  return ok;
};
const until = async (fn, timeout = 5000, every = 50) => {
  const t0 = Date.now();
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() - t0 > timeout) return null;
    await sleep(every);
  }
};

// ── the place ──
const buildings = await api.listBuildings();
const built = (b) => b.plan && (b.plan.stairs || []).length && b.media.filter((m) => m.type === 'model' && /^level-[a-z0-9-]+$/.test(m.name) && !/-empty$/.test(m.name)).length >= 2;
const place = opt('--building', null) ? buildings.find((b) => b.id === opt('--building')) : buildings.find(built);
if (!place || !built(place)) {
  console.error(`no built multi-level place with stairs at ${base}: run dev/seed-place.mjs first`);
  process.exit(2);
}
const plan = place.plan;
const spots = (await api.listSpots()).filter((s) => s.buildingId === place.id && !s.deletedAt);
console.log(`place ${place.title} (${place.id}), ${plan.levels.length} levels, ${plan.stairs.length} stairs, ${spots.length} room spots`);

// ── routes ──
const post = (id, body, auth = true) => fetch(`${API}/buildings/${id}/walk`, { method: 'POST', headers: { 'content-type': 'application/json', ...(auth ? { authorization: `Bearer ${cfg.token}` } : {}) }, body: JSON.stringify(body) });
record('routes: 401 without the password', (await post(place.id, { who: 'james' }, false)).status === 401);
record('routes: 400 bad who', (await post(place.id, { who: 'bob' })).status === 400);
record('routes: 404 unknown place', (await post('00000000-0000-4000-8000-0000000dead0', { who: 'james' })).status === 404);
const okRes = await post(place.id, { who: 'james' });
const ticket = okRes.ok ? (await okRes.json()).data : null;
record('routes: 200 → a ticket keyed b:<id>', Boolean(ticket?.ticket?.startsWith(`b:${place.id}.james.`)), ticket?.ticket?.slice(0, 50));
const pres = await fetch(`${API}/buildings/${place.id}/walk`, { headers: { authorization: `Bearer ${cfg.token}` } });
record('routes: GET presence 200', pres.status === 200);

// ── raw sockets ──
const wsUrl = (t) => `${base.replace(/^http/, 'ws')}/api/memories/walk/ws?t=${encodeURIComponent(t)}`;
function raw(url) {
  return new Promise((resolve) => {
    const msgs = [];
    const out = { msgs };
    out.wait = (pred, timeout = 3000) => until(() => msgs.find((m) => pred(m)), timeout, 5);
    out.send = (m) => out.ws?.readyState === 1 && out.ws.send(JSON.stringify(m));
    const ws = new WebSocket(url);
    ws.on('message', (d) => {
      try {
        msgs.push(JSON.parse(String(d)));
      } catch {
        /* not JSON */
      }
    });
    ws.once('open', () => resolve(Object.assign(out, { status: 101, ws })));
    ws.once('unexpected-response', (rq, res) => {
      resolve(Object.assign(out, { status: res.statusCode }));
      rq.destroy();
    });
    ws.once('error', (e) => resolve(Object.assign(out, { status: 0, error: e.message })));
  });
}
const closeRaw = (r) => new Promise((done) => (r?.ws && r.ws.readyState <= 1 ? (r.ws.once('close', done), r.ws.close(1000, 'bye'), setTimeout(done, 1500)) : done()));
const mintPlace = async (who) => (await (await post(place.id, { who })).json()).data.ticket;
const forged = (await mintPlace('justin')).replace(/^b:/, '');
record('keys: a place ticket posing as a spot\'s → 403', (await raw(wsUrl(forged))).status === 403);

const a = await raw(wsUrl(await mintPlace('justin')));
const b = await raw(wsUrl(await mintPlace('james')));
record('protocol: both raw sockets open (101)', a.status === 101 && b.status === 101);
await a.wait((m) => m.t === 'hello');
await b.wait((m) => m.t === 'hello');
const lv = plan.levels.map((l) => l.id);
a.send({ t: 'state', p: [1, 0.1, 1], h: 0, a: 'idle', l: lv[0] });
const join = await b.wait((m) => m.t === 'join');
record('protocol: the join carries the level', join?.person?.l === lv[0], JSON.stringify(join?.person?.l));
a.send({ t: 'state', p: [1.2, 0.1, 1], h: 0, a: 'walk', l: lv[1] });
const moved = await b.wait((m) => m.t === 'state' && m.l === lv[1]);
record('protocol: a state carries the level', Boolean(moved));
a.send({ t: 'state', p: [1.3, 0.1, 1], h: 0, a: 'walk', l: 'Not A Level!' });
const bad = await b.wait((m) => m.t === 'state' && m.p?.[0] === 1.3);
record('protocol: a bad level is dropped to null', bad && bad.l === null, JSON.stringify(bad?.l));
a.send({ t: 'state', p: [1.4, 0.1, 1], h: 0, a: 'idle', l: lv[1] });
await b.wait((m) => m.t === 'state' && m.p?.[0] === 1.4);
const pres2 = (await (await fetch(`${API}/buildings/${place.id}/walk`, { headers: { authorization: `Bearer ${cfg.token}` } })).json()).data;
record('protocol: presence lists who is here (and their level)', pres2.people.some((p) => p.who === 'justin' && p.level === lv[1]), JSON.stringify(pres2.people));
// a spot of the place, at the same moment: nobody from the place is in its room
if (spots[0]) {
  const t = (await (await fetch(`${API}/spots/${spots[0].id}/walk`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${cfg.token}` }, body: JSON.stringify({ who: 'james' }) })).json()).data.ticket;
  const s = await raw(wsUrl(t));
  const hello = await s.wait((m) => m.t === 'hello');
  record('keys: a spot of the place has its own room (sees nobody from the place)', hello && hello.people.length === 0, `${hello?.people?.length} people`);
  await closeRaw(s);
}
await closeRaw(a);
await closeRaw(b);
await sleep(400);

// ── two browsers ──
const browser = await puppeteer.launch({ executablePath: EDGE, headless: true, args: ['--use-gl=angle', '--use-angle=d3d11', '--ignore-gpu-blocklist', ...FG] });
async function person(who) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  page.problems = [];
  page.on('pageerror', (e) => page.problems.push(`pageerror: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && page.problems.push(`console.error: ${m.text()}`));
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: scheme }]);
  await page.setViewport({ width: 1100, height: 760 });
  await page.evaluateOnNewDocument(
    (token, w) => {
      localStorage.setItem('mr:token', token);
      localStorage.setItem('mr:who', w);
      localStorage.setItem('mr:map', 'atlas');
    },
    cfg.token,
    who,
  );
  return page;
}
const st = (page) =>
  page.evaluate(() => {
    const el = document.querySelector('[data-mr="walk"]');
    const g = el?.__walk;
    if (!g) return null;
    return {
      ...el.dataset,
      x: g.me.pos.x,
      y: g.me.pos.y,
      z: g.me.pos.z,
      peers: [...g.peers.values()].map((p) => ({ who: p.who, level: p.level, shown: Boolean(p.sprite?.mesh.visible), tag: p.tag ? !p.tag.hidden : false })),
      away: document.querySelector('[data-mr="walk-away"]')?.textContent || '',
      levelName: document.querySelector('[data-mr="walk-level"]')?.textContent || '',
    };
  });
const james = await person('james');
const justin = await person('justin');
const url = `${base}/memories/b/${place.id}/walk`;
await Promise.all([james.goto(url, { waitUntil: 'domcontentloaded' }), justin.goto(url, { waitUntil: 'domcontentloaded' })]);
const ready = async (p) => p.waitForSelector('[data-mr="walk"][data-state="ready"]', { timeout: 90000 }).then(() => true, () => false);
record('browsers: both load the place walk', (await ready(james)) && (await ready(justin)));
const sJ = await st(james);
record('browsers: one floor per level', Number(sJ?.place) === plan.levels.length, `${sJ?.place} floors, on ${sJ?.level}`);
const seen = await until(async () => {
  const [x, y] = [await st(james), await st(justin)];
  return x?.peers.some((p) => p.who === 'justin' && p.shown) && y?.peers.some((p) => p.who === 'james' && p.shown);
}, 8000);
record('browsers: they see each other on the same level', Boolean(seen));
await james.screenshot({ path: path.join(OUT, `place-walk-together-${scheme}.png`) });

// James to the foot of a flight from his level, then up it
const lowest = [...plan.levels].sort((p, q) => p.elevation - q.elevation)[0];
const flight = await james.evaluate(() => {
  const g = document.querySelector('[data-mr="walk"]').__walk;
  // the flight whose foot zone James can reach on his level
  for (const f of g.flights) {
    if (f.from !== g.level) continue;
    const x = f.start[0] - f.d[0] * 0.45;
    const z = f.start[1] - f.d[1] * 0.45;
    if (g.walkTo(x, z)) return { id: f.id, d: f.d, to: f.to, y1: f.y1 };
  }
  return null;
});
record('browsers: a path to the foot of a flight', Boolean(flight), flight?.id);
if (flight) {
  await until(async () => (await st(james))?.path === 'arrived', 30000, 100);
  // face up the flight and climb
  await james.evaluate((d) => {
    const g = document.querySelector('[data-mr="walk"]').__walk;
    // first person looks along yaw; third person's camera sits behind you, at yaw + π (walk/flags.js)
    g.yaw = Math.atan2(d[0], d[1]) + (g.view === 'first' ? 0 : Math.PI);
    g.lastLook = performance.now() + 60000;
  }, flight.d);
  await james.bringToFront();
  await james.keyboard.down('KeyW');
  const ys = [];
  const up = await until(async () => {
    const s = await st(james);
    ys.push(+s.y.toFixed(2));
    return s.level === flight.to && !s.flight && s.y >= flight.y1 - 0.01 ? s : null;
  }, 15000, 200);
  await james.keyboard.up('KeyW');
  const rising = ys.some((y, i) => i > 0 && y > ys[i - 1] + 0.05);
  record('climb: James climbs the flight (y rises with the treads) and steps off upstairs', Boolean(up) && rising, `y ${ys.slice(0, 1)}…${ys.slice(-1)}, level ${up?.level}`);
  const jView = await until(async () => {
    const s = await st(justin);
    const p = s?.peers.find((x) => x.who === 'james');
    return p && p.level === flight.to && !p.shown && !p.tag && /upstairs/i.test(s.away) ? s : null;
  }, 5000);
  record('levels: Justin no longer draws James, and reads "James is upstairs"', Boolean(jView), jView?.away);
  const mView = await until(async () => {
    const s = await st(james);
    return /downstairs/i.test(s?.away || '') && s.levelName ? s : null;
  }, 5000);
  record('levels: James reads "Justin is downstairs" and his level in the header', Boolean(mView), `${mView?.away} | ${mView?.levelName}`);
  await james.screenshot({ path: path.join(OUT, `place-walk-upstairs-${scheme}.png`) });
  await justin.screenshot({ path: path.join(OUT, `place-walk-left-behind-${scheme}.png`) });
  // and back down
  await james.evaluate((d) => {
    const g = document.querySelector('[data-mr="walk"]').__walk;
    g.yaw = Math.atan2(-d[0], -d[1]) + (g.view === 'first' ? 0 : Math.PI);
    g.lastLook = performance.now() + 60000;
  }, flight.d);
  await james.keyboard.down('KeyW');
  const down = await until(async () => {
    const s = await st(james);
    return s.level === lowest.id && !s.flight ? s : null;
  }, 15000, 200);
  await sleep(300);
  await james.keyboard.up('KeyW');
  const again = await until(async () => (await st(justin))?.peers.some((p) => p.who === 'james' && p.shown), 5000);
  record('levels: back down, they see each other again', Boolean(down) && Boolean(again));
}

// ── a room of the place walked on its own (its spot's walk): the walls come from the building ──
const roomSpot = spots.find((s) => s.scene?.shell?.building && s.media.some((m) => m.type === 'model' && m.name === 'room'));
if (roomSpot) {
  const { resolveShell } = await import('../../src/memory-rooms/scene/shell.js');
  const box = resolveShell(roomSpot.scene, plan).box;
  const solo = await person('james');
  await solo.goto(`${base}/memories/${roomSpot.id}/walk`, { waitUntil: 'domcontentloaded' });
  const ok = await ready(solo);
  const b = ok ? await solo.evaluate(() => document.querySelector('[data-mr="walk"]').__walk.bounds) : null;
  record(`room walk: ${roomSpot.title} walks inside its room's walls (from the building)`, ok && b && Math.abs(b.min.x - box.min[0]) < 1e-6 && Math.abs(b.max.z - box.max[1]) < 1e-6, b ? `bounds ${b.min.x.toFixed(2)}..${b.max.x.toFixed(2)} × ${b.min.z.toFixed(2)}..${b.max.z.toFixed(2)}` : 'not ready');
  if (ok) {
    let out = 0;
    for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      await solo.evaluate((y) => {
        const g = document.querySelector('[data-mr="walk"]').__walk;
        g.yaw = y;
        g.lastLook = performance.now() + 60000;
      }, yaw);
      await solo.keyboard.down('KeyW');
      for (let i = 0; i < 12; i++) {
        await sleep(200);
        const p = await solo.evaluate(() => document.querySelector('[data-mr="walk"]').__walk.me.pos.toArray());
        if (p[0] < box.min[0] - 0.05 || p[0] > box.max[0] + 0.05 || p[2] < box.min[1] - 0.05 || p[2] > box.max[1] + 0.05) out++;
      }
      await solo.keyboard.up('KeyW');
    }
    record(`room walk: holding W four ways never leaves the room`, out === 0, `${out} samples outside`);
  }
  await solo.screenshot({ path: path.join(OUT, `place-walk-room-${scheme}.png`) });
  james.problems.push(...solo.problems);
}

// ── the place page: Walk in + who is walking ──
const viewer = await person('james');
await viewer.goto(`${base}/memories/b/${place.id}`, { waitUntil: 'domcontentloaded' });
const link = await viewer.waitForSelector('[data-mr="place"] [data-mr="walk-link"]', { timeout: 30000 }).catch(() => null);
const href = link ? await link.evaluate((el) => el.getAttribute('href')) : null;
record('place: "Walk in" links to the place walk', href === `/memories/b/${place.id}/walk`, href);
const here = await until(async () => viewer.$eval('[data-mr="walk-here"]', (el) => el.textContent).catch(() => null), 20000, 300);
record('place: says who is walking here', Boolean(here && /Justin|James/.test(here)), here);
await viewer.screenshot({ path: path.join(OUT, `place-walk-entry-${scheme}.png`) });

const problems = [...james.problems, ...justin.problems, ...viewer.problems];
record('console: no errors', problems.length === 0, problems.slice(0, 3).join(' | '));
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed (${scheme}). Screens: ${OUT}`);
process.exit(failed.length ? 1 : 0);
