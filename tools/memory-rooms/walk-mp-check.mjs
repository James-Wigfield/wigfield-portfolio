#!/usr/bin/env node
/* walk-mp-check: "Walk in together" (/memories/:id/walk) with two people at once, through the
   spot's Durable Object (workers/memory-walk.js), the ticket routes (workers/memory-rooms.js) and
   the page's socket client (walk/net.js). Two isolated browser contexts, James and Justin, plus raw
   sockets from Node for what a browser can't do (no ticket, floods, spoofed moves).

     npm run build && npx wrangler dev --port 8788      (restart wrangler after every build)
     MEMORIES_API=http://127.0.0.1:8788 node tools/memory-rooms/seed-dev.mjs --examples-only
     node tools/memory-rooms/walk-mp-check.mjs [--base http://127.0.0.1:8788] [--spot <id>] [--other <id>] [--swiftshader]

   Checks
     ticket    POST /spots/:id/walk: 401 without / with a wrong password, 400 bad who, 404 unknown
               spot, 200 → a ticket that lasts 120 s; GET presence (401 / 200)
     socket    no ticket 401; garbage, tampered signature, swapped who, swapped spot, expired → 403
               (expired: a properly signed past ticket when the key can be derived, AND a real ticket
               minted at the start and used after it ran out); not an upgrade → 426; valid → 101 + hello
     protocol  (raw sockets) join/leave/state relay, presence, a spoofed jump is clamped (correct +
               the others get the clamped spot), bad states dropped, a flood > 24 states/s is cut to
               24/s, chat ≤ 80 chars with control characters stripped, chat rate (6 / 10 s), emotes, ping
     browsers  James + Justin in one spot see each other within 500 ms (and where they stand); keyboard
               movement mirrors (latency, ~12 Hz on the wire while moving, nothing while still, drawn
               ~100 ms behind and smooth, no walls crossed on a walk round the furniture, a legit big
               jump snaps, a spoofed teleport is clamped); emotes and chat mirror (80 chars, control
               characters, the sender sees it once); a dropped socket reconnects within its backoff;
               offline → "walking alone" + still moving, back online → the other reappears (no ghost);
               leave/join by navigation; the spot page's "Justin is in this room" comes and goes;
               two different spots don't see each other; zero console errors
   Screenshots → memory-rooms-work/_page-check/walk-mp-*.png. Exit 1 if anything fails.
   Needs two rendered spots with a model (seed-dev.mjs --examples-only gives two). */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import WebSocket from 'ws';
import { client, config, REPO, WORK } from './lib/api.mjs';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const args = process.argv.slice(2);
const opt = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const base = opt('--base', 'http://127.0.0.1:8788').replace(/\/+$/, '');
const GPU = ['--use-gl=angle', '--use-angle=d3d11', '--ignore-gpu-blocklist'];
const SOFT = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
// two people on two devices are both in the foreground: don't let Edge throttle the second page
const FG = ['--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows'];
const OUT = path.join(WORK, '_page-check');
fs.mkdirSync(OUT, { recursive: true });
const cfg = config();
cfg.base = base;
const api = client(cfg);
const API = `${base}/api/memories`;
const T_START = Date.now();

const results = [];
const record = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? `  ${detail}` : ''}`);
  return ok;
};
const info = (line) => console.log(`  · ${line}`);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const sel = (name) => `[data-mr="${name}"]`;
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const median = (xs) => {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};
const pct = (xs, p) => {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(s.length * p))];
};
const ms = (v) => (Number.isFinite(v) ? `${Math.round(v)} ms` : 'n/a');
async function until(fn, timeout = 5000, every = 10) {
  const end = Date.now() + timeout;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > end) return null;
    await wait(every);
  }
}

// ── spots ────────────────────────────────────────────────────────────────────
const spots = await api.listSpots();
const walkables = spots.filter((s) => s.status === 'rendered' && s.media.some((m) => m.type === 'model'));
const area = (s) => (s.scene?.shell ? s.scene.shell.width * s.scene.shell.depth : 0);
const A = opt('--spot') ? walkables.find((s) => s.id === opt('--spot')) : [...walkables].filter((s) => s.kind === 'interior').sort((a, b) => area(b) - area(a))[0] || walkables[0];
const B = opt('--other') ? walkables.find((s) => s.id === opt('--other')) : walkables.find((s) => s.id !== A?.id && s.kind === 'interior') || walkables.find((s) => s.id !== A?.id);
if (!A || !B) {
  console.error('Need two rendered spots with a model: run `MEMORIES_API=… node tools/memory-rooms/seed-dev.mjs --examples-only` first.');
  process.exit(1);
}
console.log(`spot A (together): ${A.title}  ${A.id}\nspot B (elsewhere): ${B.title}  ${B.id}\n`);

// ── HTTP + raw socket helpers ────────────────────────────────────────────────
async function req(p, { method = 'GET', body, auth = cfg.token, headers = {} } = {}) {
  const h = { ...headers };
  if (auth) h.authorization = `Bearer ${auth}`;
  if (body !== undefined) h['content-type'] = 'application/json';
  const res = await fetch(`${API}${p}`, { method, headers: h, body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body) });
  const text = await res.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: res.status, data };
}
const mint = async (spotId, who) => (await req(`/spots/${spotId}/walk`, { method: 'POST', body: { who } })).data?.data;
const presence = async (spotId) => (await req(`/spots/${spotId}/walk`)).data?.data?.people || null;
const wsBase = base.replace(/^http/, 'ws');
const ticketUrl = (ticket) => `${wsBase}/api/memories/walk/ws${ticket === undefined ? '' : `?t=${encodeURIComponent(ticket)}`}`;

/** Open a socket: → { status: 101 | http status | 0, ws, msgs, wait(pred, ms) }. */
function raw(url) {
  return new Promise((resolve) => {
    const msgs = [];
    const out = { status: 0, ws: null, msgs };
    out.wait = (pred, timeout = 3000) => until(() => msgs.find((x) => pred(x.m))?.m, timeout, 5);
    out.send = (m) => out.ws?.readyState === 1 && out.ws.send(typeof m === 'string' ? m : JSON.stringify(m));
    let done = false;
    const finish = (v) => {
      if (done) return;
      done = true;
      resolve(Object.assign(out, v));
    };
    const ws = new WebSocket(url);
    ws.on('message', (d) => {
      try {
        msgs.push({ t: Date.now(), m: JSON.parse(String(d)) });
      } catch {
        /* not JSON */
      }
    });
    ws.once('open', () => finish({ status: 101, ws }));
    ws.once('unexpected-response', (rq, res) => {
      finish({ status: res.statusCode });
      rq.destroy();
    });
    ws.once('error', (e) => finish({ status: 0, error: e.message }));
    ws.on('close', () => (out.closed = true));
  });
}
const rawWalk = async (spotId, who) => {
  const t = await mint(spotId, who);
  const r = await raw(ticketUrl(t.ticket));
  r.hello = await r.wait((m) => m.t === 'hello');
  return r;
};
const closeRaw = (r) =>
  new Promise((done) => {
    if (!r?.ws || r.ws.readyState > 1) return done();
    r.ws.once('close', done);
    r.ws.close(1000, 'bye');
    setTimeout(done, 2000);
  });

// signing key, as workers/memory-rooms.js derives it (used only to forge an EXPIRED ticket)
function devVars() {
  try {
    const text = fs.readFileSync(path.join(REPO, '.dev.vars'), 'utf8');
    return Object.fromEntries(
      text
        .split(/\r?\n/)
        .filter((l) => /^[A-Z0-9_]+=/.test(l))
        .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim().replace(/^"|"$/g, '')]),
    );
  } catch {
    return {};
  }
}
const vars = devVars();
const material = process.env.MEMORIES_SIGNING_KEY || vars.MEMORIES_SIGNING_KEY || `derived|${vars.MEMORIES_PASSWORD || ''}|${vars.PORTAL_PASSWORD || ''}`;
const sign = (text) => crypto.createHmac('sha256', material).update(text).digest('base64url');

// ══ 1. ticket route + socket door ═══════════════════════════════════════════
console.log('── ticket + socket door');
{
  let r = await req(`/spots/${A.id}/walk`, { method: 'POST', body: { who: 'james' }, auth: null });
  record('ticket: POST without the password → 401', r.status === 401, `got ${r.status}`);
  r = await req(`/spots/${A.id}/walk`, { method: 'POST', body: { who: 'james' }, auth: 'not-the-password' });
  record('ticket: POST with a wrong password → 401', r.status === 401, `got ${r.status}`);
  r = await req(`/spots/${A.id}/walk`, { method: 'POST', body: { who: 'bob' } });
  record('ticket: who "bob" → 400', r.status === 400, `got ${r.status}`);
  r = await req(`/spots/${A.id}/walk`, { method: 'POST', body: {} });
  record('ticket: no who → 400', r.status === 400, `got ${r.status}`);
  r = await req(`/spots/${A.id}/walk`, { method: 'POST', body: 'not json' });
  record('ticket: a body that is not JSON → 400', r.status === 400, `got ${r.status}`);
  r = await req(`/spots/${crypto.randomUUID()}/walk`, { method: 'POST', body: { who: 'james' } });
  record('ticket: an unknown spot → 404', r.status === 404, `got ${r.status}`);
  r = await req(`/spots/not-a-uuid/walk`, { method: 'POST', body: { who: 'james' } });
  record('ticket: a spot id that is not a uuid → 400', r.status === 400, `got ${r.status}`);
  r = await req(`/spots/${A.id}/walk`, { method: 'PUT', body: { who: 'james' } });
  record('ticket: PUT → 405', r.status === 405, `got ${r.status}`);

  const before = Date.now();
  r = await req(`/spots/${A.id}/walk`, { method: 'POST', body: { who: 'james' } });
  const t = r.data?.data;
  const parts = t?.ticket?.split('.') || [];
  const life = t ? (Date.parse(t.expiresAt) - before) / 1000 : NaN;
  record(
    'ticket: POST with the password → 200 { ticket, expiresAt, socket }',
    r.status === 200 && parts.length === 4 && parts[0] === A.id && parts[1] === 'james' && t.socket === `/api/memories/walk/ws?t=${encodeURIComponent(t.ticket)}`,
    `status ${r.status}, ticket ${parts.slice(0, 3).join('.')}.<sig>`,
  );
  record('ticket: valid for ~120 s', life > 115 && life <= 121, `${life.toFixed(1)} s`);

  r = await req(`/spots/${A.id}/walk`, { auth: null });
  record('presence: GET without the password → 401', r.status === 401, `got ${r.status}`);
  r = await req(`/spots/${A.id}/walk`);
  record('presence: GET → 200 { people: [] } with nobody walking', r.status === 200 && Array.isArray(r.data?.data?.people) && r.data.data.people.length === 0, JSON.stringify(r.data?.data));

  const s = async (url) => (await raw(url)).status;
  record('socket: no ticket → 401', (await s(ticketUrl(undefined))) === 401);
  record('socket: an empty ticket → 401', (await s(ticketUrl(''))) === 401);
  record('socket: a garbage ticket → 403', (await s(ticketUrl('garbage'))) === 403);
  const [id, who, exp, sig] = parts;
  const flip = (str) => str.slice(0, -2) + (str.at(-2) === 'A' ? 'B' : 'A') + str.at(-1);
  record('socket: a tampered signature → 403', (await s(ticketUrl(`${id}.${who}.${exp}.${flip(sig)}`))) === 403);
  record('socket: the signature with who swapped to justin → 403', (await s(ticketUrl(`${id}.justin.${exp}.${sig}`))) === 403);
  record("socket: A's signature on spot B → 403", (await s(ticketUrl(`${B.id}.${who}.${exp}.${sig}`))) === 403);
  record('socket: a later expiry with the old signature → 403', (await s(ticketUrl(`${id}.${who}.${Number(exp) + 3600}.${sig}`))) === 403);
  record('socket: who "bob" → 403', (await s(ticketUrl(`${id}.bob.${exp}.${sig}`))) === 403);

  // a properly signed ticket that has run out (only if this script derives the same key the Worker does)
  const keyKnown = sign(`walk|${id}|${who}|${exp}`) === sig;
  if (keyKnown) {
    const past = Math.floor(Date.now() / 1000) - 5;
    const forged = `${id}.james.${past}.${sign(`walk|${id}|james|${past}`)}`;
    record('socket: a correctly signed but EXPIRED ticket → 403', (await s(ticketUrl(forged))) === 403);
    const future = Math.floor(Date.now() / 1000) + 60;
    const fine = `${id}.james.${future}.${sign(`walk|${id}|james|${future}`)}`;
    const ok = await raw(ticketUrl(fine));
    record('socket: (control) the same key with a future expiry → 101', ok.status === 101, `got ${ok.status}`);
    await closeRaw(ok);
  } else info('signing key not derivable here: the expired ticket is tested with a real one at the end');

  const plain = await fetch(`${base}${t.socket}`);
  record('socket: a valid ticket without the upgrade → 426', plain.status === 426, `got ${plain.status}`);
  const bad = await fetch(`${base}/api/memories/walk/other`);
  record('socket: another /walk/ path → 404', bad.status === 404, `got ${bad.status}`);

  const ok = await raw(`${wsBase}${t.socket}`);
  const hello = ok.status === 101 ? await ok.wait((m) => m.t === 'hello') : null;
  record('socket: a valid ticket → 101 and hello { id, who, people: [] }', ok.status === 101 && hello?.who === 'james' && typeof hello.id === 'string' && Array.isArray(hello.people) && hello.people.length === 0, `status ${ok.status}, hello ${JSON.stringify(hello)}`);
  const ok2 = await raw(`${wsBase}${t.socket}`);
  info(`the same ticket used again within its 120 s: ${ok2.status === 101 ? 'accepted (not single-use)' : `refused ${ok2.status}`}`);
  await closeRaw(ok);
  await closeRaw(ok2);
}
// a real ticket, used after it runs out (end of the run)
const lateTicket = (await mint(A.id, 'justin')).ticket;
const lateMintedAt = Date.now();

// ══ 2. protocol, raw sockets (spot B, nobody else there) ════════════════════
console.log('\n── protocol (raw sockets, spot B)');
{
  // You're announced (join) with your FIRST state, never before (workers/memory-walk.js).
  const r1 = await rawWalk(B.id, 'james');
  r1.send({ t: 'state', p: [0.5, 0, 0.5], h: 0, a: 'idle' });
  await wait(150);
  const r2 = await rawWalk(B.id, 'justin');
  const early = await r1.wait((m) => m.t === 'join' && m.person?.who === 'justin', 400);
  record('protocol: nobody is announced before their first position (no join at connect)', !early, JSON.stringify(early?.person));
  r2.send({ t: 'state', p: [2, 0, 2], h: 0, a: 'idle' });
  const joined = await r1.wait((m) => m.t === 'join' && m.person?.who === 'justin');
  record(
    'protocol: the second person gets hello with the first; the first gets join with the second’s first position',
    r2.hello?.people?.length === 1 && r2.hello.people[0].who === 'james' && r2.hello.people[0].id === r1.hello.id && joined?.person?.p?.[0] === 2 && joined.person.p[2] === 2,
    `hello.people ${JSON.stringify(r2.hello?.people)}, join ${JSON.stringify(joined?.person)}`,
  );
  const pres = await presence(B.id);
  record('protocol: presence lists both (one entry each)', pres?.length === 2 && pres.some((p) => p.who === 'james') && pres.some((p) => p.who === 'justin'), JSON.stringify(pres));

  r1.send({ t: 'state', p: [1, 0, 1], h: 0.5, a: 'walk' });
  const st = await r2.wait((m) => m.t === 'state' && m.id === r1.hello.id);
  record('protocol: a state is relayed to the other { id, p, h, a }', st && st.p[0] === 1 && st.p[2] === 1 && st.h === 0.5 && st.a === 'walk', JSON.stringify(st));
  const echoed = r1.msgs.some((x) => x.m.t === 'state');
  record('protocol: a state is not echoed back to its sender', !echoed);

  // spoofed jump: 40 m right after the last state
  const n2 = r2.msgs.length;
  r1.send({ t: 'state', p: [41, 0, 1], h: 0.5, a: 'walk' });
  const corr = await r1.wait((m) => m.t === 'correct');
  const relayed = await until(() => r2.msgs.slice(n2).find((x) => x.m.t === 'state')?.m, 2000);
  const jump = corr ? Math.hypot(corr.p[0] - 1, corr.p[2] - 1) : NaN;
  record('protocol: a spoofed 40 m jump → correct { p } to the sender, clamped to ≤ ~1.4 m', Boolean(corr) && jump < 1.45, `correct ${JSON.stringify(corr?.p)} (moved ${jump.toFixed(2)} m)`);
  record('protocol: the others get the clamped position, never the spoofed one', relayed && Math.abs(relayed.p[0] - corr?.p[0]) < 1e-6 && relayed.p[0] < 3, JSON.stringify(relayed?.p));

  // states that must be dropped
  await wait(400);
  const n3 = r2.msgs.length;
  const cur = corr?.p || [1, 0, 1];
  r1.send({ t: 'state', p: [600, 0, 1], h: 0, a: 'walk' }); // |v| > 500
  r1.send({ t: 'state', p: [cur[0], 0], h: 0, a: 'walk' }); // 2 numbers
  r1.send({ t: 'state', p: [cur[0], null, cur[2]], h: 0, a: 'walk' }); // a hole
  r1.send({ t: 'state', p: ['1', 0, '1'], h: 0, a: 'walk' }); // strings
  r1.send('not json at all');
  r1.send(JSON.stringify({ t: 'state', p: [cur[0], 0, cur[2]], h: 0, a: 'walk', pad: 'x'.repeat(2100) })); // > 2000 chars
  await wait(500);
  const dropped = r2.msgs.slice(n3).filter((x) => x.m.t === 'state').length;
  record('protocol: bad states (|v| > 500, wrong length, null, strings, not JSON, > 2000 chars) are dropped', dropped === 0, `${dropped} relayed`);
  r1.send({ t: 'state', p: [cur[0] + 0.1, 0, cur[2]], h: 'x', a: 'fly' });
  const odd = await r2.wait((m) => m.t === 'state' && Math.abs(m.p[0] - (cur[0] + 0.1)) < 1e-6, 1500);
  record('protocol: an unknown animation is relayed as idle, a bad heading keeps the last (0.5)', odd?.a === 'idle' && odd?.h === 0.5, JSON.stringify(odd));
  record('protocol: the sender stays connected after bad input', r1.ws.readyState === 1);

  // flood: one burst inside one wall-clock second, then a sustained 50/s for 3 s
  await until(() => Date.now() % 1000 > 100 && Date.now() % 1000 < 200, 1500, 2);
  const n4 = r2.msgs.length;
  let x = cur[0] + 0.1;
  for (let i = 0; i < 60; i++) r1.send({ t: 'state', p: [(x += 0.001), 0, cur[2]], h: 0, a: 'walk' });
  await wait(700);
  const burst = r2.msgs.slice(n4).filter((m) => m.m.t === 'state').length;
  // 24 a second per socket, counting every message (also dropped bad ones), so a burst that shares its
  // second with earlier input relays a little less: 20–24, never more
  record('protocol: a burst of 60 states in one second → at most 24 relayed', burst >= 20 && burst <= 24, `${burst} relayed`);
  await wait(400);
  const n5 = r2.msgs.length;
  const fStart = Date.now();
  await new Promise((done) => {
    let i = 0;
    const timer = setInterval(() => {
      r1.send({ t: 'state', p: [(x += 0.001), 0, cur[2]], h: 0, a: 'walk' });
      if (++i >= 150) {
        clearInterval(timer);
        done();
      }
    }, 10);
  });
  const fEnd = Date.now();
  await wait(300);
  const flood = r2.msgs.slice(n5).filter((m) => m.m.t === 'state');
  const secs = Math.floor(fEnd / 1000) - Math.floor(fStart / 1000) + 1;
  const perSec = {};
  for (const m of flood) perSec[Math.floor(m.t / 1000)] = (perSec[Math.floor(m.t / 1000)] || 0) + 1;
  const sentRate = 150 / ((fEnd - fStart) / 1000);
  record(
    `protocol: a sustained flood (~${Math.round(sentRate)}/s for ${((fEnd - fStart) / 1000).toFixed(1)} s) is cut to ≤ 24/s, not to nothing`,
    flood.length <= 24 * secs && flood.length >= 18 * (secs - 1) && Object.values(perSec).every((v) => v <= 25),
    `${flood.length} relayed over ${secs} wall seconds; per second ${JSON.stringify(Object.values(perSec))}`,
  );
  record('protocol: the flooder is not disconnected', r1.ws.readyState === 1);

  // chat: control characters, 80 chars, the rate
  await wait(1100);
  const n6 = r2.msgs.length;
  const n6s = r1.msgs.length;
  const long = `ctl\u0007bell\u001b[31mesc\ttab\nnew\u007fdel ${'x'.repeat(150)}`;
  r1.send({ t: 'chat', text: long });
  const chat = await until(() => r2.msgs.slice(n6).find((x) => x.m.t === 'chat')?.m, 2000);
  record('protocol: chat is relayed { id, who, text }', chat?.who === 'james' && chat?.id === r1.hello.id);
  record('protocol: chat text ≤ 80 characters', chat?.text?.length <= 80, `${chat?.text?.length} chars`);
   
  record('protocol: control characters are stripped from chat', chat && !/[\u0000-\u001f\u007f]/.test(chat.text), JSON.stringify(chat?.text?.slice(0, 40)));
  const selfEcho = await until(() => r1.msgs.slice(n6s).find((x) => x.m.t === 'chat')?.m, 800);
  info(`the server ${selfEcho ? 'echoes chat to its sender too (the page must drop its own)' : 'does not echo chat to its sender'}`);
  r1.send({ t: 'chat', text: '   \u0007\u0008  ' });
  for (let i = 0; i < 8; i++) r1.send({ t: 'chat', text: `spam ${i}` });
  await wait(600);
  const chats = r2.msgs.slice(n6).filter((x) => x.m.t === 'chat');
  record('protocol: blank chat dropped; at most 6 chats per 10 s', chats.length === 6 && !chats.some((c) => !c.m.text.trim()), `${chats.length} relayed: ${chats.map((c) => JSON.stringify(c.m.text.slice(0, 8))).join(' ')}`);

  // emotes + ping
  const n7 = r2.msgs.length;
  r1.send({ t: 'emote', e: 'wave' });
  r1.send({ t: 'emote', e: 'dance' });
  r1.send({ t: 'ping' });
  const pong = await r1.wait((m) => m.t === 'pong', 1500);
  await wait(400);
  const emotes = r2.msgs.slice(n7).filter((x) => x.m.t === 'emote').map((x) => x.m.e);
  record('protocol: emote wave relayed, unknown emote dropped', emotes.length === 1 && emotes[0] === 'wave', JSON.stringify(emotes));
  record('protocol: ping → pong (the auto-response: the room is not woken for it)', pong?.t === 'pong');

  // a line that just dies (TCP destroyed, no close frame) still ends in leave, no ghost
  const r3 = await rawWalk(B.id, 'justin');
  r3.send({ t: 'state', p: [1.5, 0, 1.5], h: 0, a: 'idle' });
  await r1.wait((m) => m.t === 'join' && m.person?.id === r3.hello?.id, 2000);
  const tCut = Date.now();
  r3.ws._socket.destroy();
  const cut = await r1.wait((m) => m.t === 'leave' && m.id === r3.hello?.id, 10000);
  record('protocol: a socket that just dies (no close frame) → leave to the others', Boolean(cut), cut ? `${ms(Date.now() - tCut)}` : 'no leave within 10 s');

  // leave
  await closeRaw(r2);
  const left = await r1.wait((m) => m.t === 'leave' && m.id === r2.hello.id, 3000);
  record('protocol: closing a socket → leave { id, who } to the others', left?.who === 'justin' && left?.id === r2.hello.id, JSON.stringify(left));
  const pres2 = await presence(B.id);
  record('protocol: presence drops whoever left', pres2?.length === 1 && pres2[0].who === 'james', JSON.stringify(pres2));
  await closeRaw(r1);
  const pres3 = await until(async () => {
    const p = await presence(B.id);
    return p && p.length === 0 ? p : null;
  }, 3000, 200);
  record('protocol: presence is empty once everyone left', Boolean(pres3));
}

// ══ 3. two browsers ═════════════════════════════════════════════════════════
console.log('\n── two browsers (spot A)');

/** Installed before the app: socket frame log (WebSocket wrapped), and a per-frame sampler of the
    game (me, each peer AS DRAWN: its sprite's position + animation), the notes and the status line. */
function INSTRUMENT(token, who) {
  try {
    localStorage.setItem('mr:token', token);
    localStorage.setItem('mr:who', who);
  } catch {
    /* ignore */
  }
  const mp = (window.__mp = { sent: [], recv: [], opens: [], closes: [], frames: [], notes: [], statuses: [], says: [], track: true, readyAt: 0 });
  const Orig = window.WebSocket;
  class WS extends Orig {
    constructor(url, protocols) {
      super(url, protocols);
      this.addEventListener('open', () => mp.opens.push(Date.now()));
      this.addEventListener('close', (e) => mp.closes.push({ t: Date.now(), code: e.code }));
      this.addEventListener('message', (e) => {
        try {
          mp.recv.push({ t: Date.now(), m: JSON.parse(e.data) });
        } catch {
          /* ignore */
        }
      });
    }
    send(data) {
      try {
        mp.sent.push({ t: Date.now(), m: JSON.parse(data) });
      } catch {
        /* ignore */
      }
      return super.send(data);
    }
  }
  window.WebSocket = WS;
  let lastNote = null;
  let lastStatus;
  let hooked = null;
  const loop = () => {
    const now = Date.now();
    const el = document.querySelector('[data-mr="walk"]');
    const g = el?.__walk;
    const note = document.querySelector('[data-mr="walk-note"]');
    if (note && note !== lastNote) {
      lastNote = note;
      mp.notes.push({ t: now, text: note.textContent });
    }
    const st = document.querySelector('[data-mr="walk-status"]')?.textContent ?? null;
    if (st !== lastStatus) {
      lastStatus = st;
      mp.statuses.push({ t: now, text: st, net: el?.__walkNet?.status ?? null });
    }
    if (g && g !== hooked) {
      hooked = g;
      mp.readyAt = 0;
      const say = g.say.bind(g);
      g.say = (id, text) => {
        mp.says.push({ t: Date.now(), id, text });
        return say(id, text);
      };
    }
    if (g?.ready && !g.disposed) {
      if (!mp.readyAt) mp.readyAt = now;
      if (mp.track) {
        mp.frames.push({
          t: now,
          me: [g.me.pos.x, g.me.pos.z],
          a: g.animOf(g.me),
          peers: [...g.peers.values()].map((p) => ({
            id: p.id,
            who: p.who,
            drawn: Boolean(p.sprite?.mesh.parent),
            x: p.sprite ? p.sprite.mesh.position.x : p.pos.x,
            z: p.sprite ? p.sprite.mesh.position.z : p.pos.z,
            anim: p.sprite ? p.sprite.anim : null,
          })),
        });
      }
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

const browser = await puppeteer.launch({ executablePath: EDGE, headless: true, args: [...(args.includes('--swiftshader') ? SOFT : GPU), ...FG] });
async function person(who) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  page.who = who;
  await page.setViewport({ width: 1100, height: 760 });
  page.problems = [];
  page.on('pageerror', (e) => page.problems.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') page.problems.push(`console.error: ${m.text()}`);
  });
  await page.evaluateOnNewDocument(INSTRUMENT, cfg.token, who);
  return page;
}
const shot = (page, name) => page.screenshot({ path: path.join(OUT, `walk-mp-${name}.png`) });
const mpOf = (page, clearFrames = false) =>
  page.evaluate((clear) => {
    const mp = window.__mp;
    const out = JSON.parse(JSON.stringify({ ...mp }));
    if (clear) mp.frames = [];
    return out;
  }, clearFrames);
/** One log, from index `from` (cheap enough to poll). */
const peek = (page, key, from = 0) => page.evaluate((key, from) => window.__mp[key].slice(from), key, from);
const count = (page, key) => page.evaluate((key) => window.__mp[key].length, key);
const track = (page, on) =>
  page.evaluate((on) => {
    window.__mp.frames = [];
    window.__mp.track = on;
  }, on);
const state = (page) =>
  page.evaluate(() => {
    const el = document.querySelector('[data-mr="walk"]');
    const g = el?.__walk;
    return {
      status: document.querySelector('[data-mr="walk-status"]')?.textContent ?? null,
      net: el?.__walkNet?.status ?? null,
      peers: g ? [...g.peers.values()].map((p) => ({ id: p.id, who: p.who, x: p.pos.x, z: p.pos.z })) : [],
      me: g ? [g.me.pos.x, g.me.pos.z] : null,
      ready: Boolean(g?.ready),
    };
  });
async function walkIn(page, spotId) {
  const navAt = Date.now();
  await page.goto(`${base}/memories/${spotId}/walk`, { waitUntil: 'domcontentloaded' });
  const ok = await page
    .waitForFunction(() => {
      const el = document.querySelector('[data-mr="walk"]');
      return el?.dataset.state === 'ready' && el.__walkNet?.status === 'live';
    }, { timeout: 60000 })
    .then(
      () => true,
      () => false,
    );
  return { navAt, ok };
}
const peerIn = (frame, who) => frame.peers.find((p) => p.who === who && p.drawn);
const blurAll = (page) => page.evaluate(() => document.activeElement?.blur?.());

const james = await person('james');
const justin = await person('justin');

// ── join: both see each other ────────────────────────────────────────────────
let spawn = null;
{
  const j = await walkIn(james, A.id);
  record('join: James walks in (room ready, socket live)', j.ok);
  const s0 = await state(james);
  spawn = s0.me;
  record('join: alone → "Live · just you"', s0.status === 'Live · just you', JSON.stringify(s0.status));
  await track(james, true);
  const u = await walkIn(justin, A.id);
  record('join: Justin walks in (room ready, socket live)', u.ok);
  await wait(1500);
  const J = await mpOf(james, true);
  const U = await mpOf(justin, true);
  const open = U.opens[0];
  const ready = U.readyAt;
  const justinSpawn = U.frames[0]?.me;
  const seen = J.frames.find((f) => peerIn(f, 'justin'));
  const seenRight = J.frames.find((f) => peerIn(f, 'justin') && justinSpawn && dist([peerIn(f, 'justin').x, peerIn(f, 'justin').z], justinSpawn) < 0.3);
  const uSeen = U.frames.find((f) => peerIn(f, 'james'));
  const latJ = seen ? seen.t - open : NaN;
  const latJRight = seenRight ? seenRight.t - Math.max(open, ready) : NaN;
  const latU = uSeen ? uSeen.t - Math.max(open, ready) : NaN;
  info(`Justin: page load → socket open ${ms(open - u.navAt)}, → room ready ${ms(ready - u.navAt)}`);
  // (negative = James drew him before Justin's own page had handled its socket's open event)
  record('join: James draws Justin within 500 ms of Justin connecting', Number.isFinite(latJ) && latJ <= 500, `${ms(latJ)} after Justin's socket opened (in Justin's page)`);
  record('join: Justin draws James within 500 ms (of his socket + room being ready)', latU <= 500, `${ms(latU)}`);
  record(
    "join: James draws Justin where Justin stands within 500 ms (of Justin's socket + room being ready)",
    latJRight <= 500,
    `${ms(latJRight)}; Justin's spawn ${justinSpawn?.map((v) => v.toFixed(2))}`,
  );
  const wrong = J.frames.filter((f) => peerIn(f, 'justin') && justinSpawn && dist([peerIn(f, 'justin').x, peerIn(f, 'justin').z], justinSpawn) > 0.3);
  const atOrigin = wrong.filter((f) => Math.hypot(peerIn(f, 'justin').x, peerIn(f, 'justin').z) < 0.05);
  record(
    "join: Justin is never drawn away from where he stands (e.g. at the DO's [0,0,0] placeholder)",
    wrong.length === 0,
    wrong.length ? `${wrong.length} frames over ${ms(wrong.at(-1).t - wrong[0].t)}, ${atOrigin.length} of them at (0, 0) = the room's corner; first at (${peerIn(wrong[0], 'justin').x.toFixed(2)}, ${peerIn(wrong[0], 'justin').z.toFixed(2)})` : '',
  );
  const note = J.notes.find((n) => n.t >= open - 50);
  record('join: James sees the note "Justin walked in"', note?.text === 'Justin walked in', JSON.stringify(note?.text));
  const [sj, su] = [await state(james), await state(justin)];
  record('join: status lines "Live · Justin here" / "Live · James here"', sj.status === 'Live · Justin here' && su.status === 'Live · James here', `${sj.status} | ${su.status}`);
  record('join: exactly one peer each', sj.peers.length === 1 && su.peers.length === 1, `${sj.peers.length} / ${su.peers.length}`);
  const pres = await presence(A.id);
  record('presence: GET lists James and Justin while both walk', pres?.length === 2 && pres.some((p) => p.who === 'james') && pres.some((p) => p.who === 'justin'), JSON.stringify(pres));
  await shot(james, 'join-james');
  await shot(justin, 'join-justin');
  await track(james, false);
  await track(justin, false);
}

// ── movement: keyboard, the wire, the mirror ────────────────────────────────
/** Lag of `viewer`'s drawn `who` behind `mover`'s own track: for each drawn frame, the time the
    mover was at that point. → { lags[], back (rubber-band frames), maxStep, steps } */
function analyse(moverFrames, viewerFrames, who, from, to) {
  const traj = moverFrames.map((f) => ({ t: f.t, p: f.me }));
  const lags = [];
  let prevT = null;
  let back = 0;
  let maxStep = 0;
  let prev = null;
  let maxSpeed = 0;
  for (const f of viewerFrames) {
    const p = peerIn(f, who);
    if (!p) continue;
    if (prev && f.t >= from && f.t <= to + 400) {
      const step = dist([p.x, p.z], prev.p);
      maxStep = Math.max(maxStep, step);
      if (f.t > prev.t) maxSpeed = Math.max(maxSpeed, step / ((f.t - prev.t) / 1000));
    }
    prev = { t: f.t, p: [p.x, p.z] };
    if (f.t < from || f.t > to) continue;
    let best = Infinity;
    let bt = null;
    for (const s of traj) {
      if (s.t < f.t - 800 || s.t > f.t + 50) continue;
      const d = dist(s.p, [p.x, p.z]);
      if (d < best) {
        best = d;
        bt = s.t;
      }
    }
    if (best < 0.03) {
      lags.push(f.t - bt);
      if (prevT !== null && bt < prevT - 20) back++;
      prevT = bt;
    }
  }
  return { lags, back, maxStep, maxSpeed };
}
const statesIn = (sent, a, b) => sent.filter((x) => x.m.t === 'state' && x.t >= a && x.t <= b);

{
  await blurAll(james);
  await track(james, true);
  await track(justin, true);
  const tStill0 = Date.now();
  await wait(1200);
  const kd = Date.now();
  await james.keyboard.down('KeyW');
  await wait(2500);
  await james.keyboard.up('KeyW');
  const ku = Date.now();
  await wait(1800);
  const J = await mpOf(james, true);
  const U = await mpOf(justin, true);
  const me0 = J.frames[0].me;
  const meEnd = J.frames.at(-1).me;
  const moved = dist(me0, meEnd);
  const fps = J.frames.length / ((J.frames.at(-1).t - J.frames[0].t) / 1000);
  info(`James's frame rate while tracked: ${fps.toFixed(0)} fps; Justin's: ${(U.frames.length / ((U.frames.at(-1).t - U.frames[0].t) / 1000)).toFixed(0)} fps`);
  record('move: W held 2.5 s moves James (real keyboard)', moved > 1.5, `${moved.toFixed(2)} m`);
  const before = statesIn(J.sent, tStill0, kd - 5).length;
  record('wire: standing still before → no state frames', before === 0, `${before} in ${ms(kd - tStill0)}`);
  const steady = statesIn(J.sent, kd + 300, ku - 50);
  const hz = steady.length / ((ku - 50 - (kd + 300)) / 1000);
  record('wire: ~12 Hz of state frames while walking', hz >= 9.5 && hz <= 13.5, `${hz.toFixed(1)} Hz (${steady.length} frames in ${ms(ku - 50 - kd - 300)})`);
  const gaps = steady.slice(1).map((x, i) => x.t - steady[i].t);
  info(`state frame gaps while walking: median ${ms(median(gaps))}, p95 ${ms(pct(gaps, 0.95))}, max ${ms(Math.max(...gaps))}`);
  const after = statesIn(J.sent, ku + 400, ku + 1800).length;
  const stopFrame = statesIn(J.sent, ku - 50, ku + 400).at(-1);
  record('wire: standing still after → nothing more (one idle frame at the stop)', after === 0 && stopFrame?.m.a === 'idle', `${after} frames after; the stop frame's anim ${stopFrame?.m.a}`);

  const T0 = J.frames.find((f) => dist(f.me, me0) > 0.05)?.t;
  const drawn0 = peerIn(U.frames.find((f) => peerIn(f, 'james')), 'james');
  const T1 = U.frames.find((f) => peerIn(f, 'james') && dist([peerIn(f, 'james').x, peerIn(f, 'james').z], [drawn0.x, drawn0.z]) > 0.05)?.t;
  record('mirror: Justin sees James start moving within 500 ms', T1 - T0 <= 500, `movement mirror latency (5 cm on each side) ${ms(T1 - T0)}`);
  const lastMove = [...J.frames].reverse().find((f, i, arr) => i + 1 < arr.length && dist(f.me, arr[i + 1].me) > 1e-4)?.t ?? ku;
  const a = analyse(J.frames, U.frames, 'james', T0 + 300, lastMove - 20);
  record('interp: James is drawn ~100 ms behind (median 70–200 ms)', median(a.lags) >= 70 && median(a.lags) <= 200, `median ${ms(median(a.lags))}, p5 ${ms(pct(a.lags, 0.05))}, p95 ${ms(pct(a.lags, 0.95))} over ${a.lags.length} frames`);
  record('interp: smooth, no jumps (largest per-frame step < 0.2 m)', a.maxStep < 0.2, `largest step ${a.maxStep.toFixed(3)} m`);
  record('interp: no rubber-banding (drawn never steps back along the path)', a.back === 0, `${a.back} backward frames`);
  const endDrawn = peerIn(U.frames.at(-1), 'james');
  record('mirror: after the stop Justin draws James exactly where he stopped', endDrawn && dist([endDrawn.x, endDrawn.z], meEnd) < 0.02, `off by ${endDrawn ? dist([endDrawn.x, endDrawn.z], meEnd).toFixed(3) : '?'} m`);
  const walkAnims = U.frames.filter((f) => f.t > T1 + 200 && f.t < ku).map((f) => peerIn(f, 'james')?.anim);
  const endAnim = peerIn(U.frames.at(-1), 'james')?.anim;
  record('mirror: animation walk while moving, idle after', walkAnims.length > 0 && walkAnims.filter((x) => x === 'walk').length / walkAnims.length > 0.95 && endAnim === 'idle', `walk ${walkAnims.filter((x) => x === 'walk').length}/${walkAnims.length}, end ${endAnim}`);
}

// Shift + W: run mirrors
{
  await track(james, true);
  await track(justin, true);
  await james.keyboard.down('ShiftLeft');
  await james.keyboard.down('KeyW');
  await wait(900);
  await james.keyboard.up('KeyW');
  await james.keyboard.up('ShiftLeft');
  await wait(800);
  const J = await mpOf(james, true);
  const U = await mpOf(justin, true);
  const ran = J.frames.some((f) => f.a === 'run');
  const sawRun = U.frames.some((f) => peerIn(f, 'james')?.anim === 'run');
  record('mirror: Shift runs and Justin sees James run', ran && sawRun, `James ran: ${ran}, Justin saw run: ${sawRun}`);
}

// the other way: Justin walks, James sees
{
  await blurAll(justin);
  await track(james, true);
  await track(justin, true);
  await wait(300);
  await justin.keyboard.down('KeyW');
  await wait(1500);
  await justin.keyboard.up('KeyW');
  await wait(1000);
  const J = await mpOf(james, true);
  const U = await mpOf(justin, true);
  const me0 = U.frames[0].me;
  const T0 = U.frames.find((f) => dist(f.me, me0) > 0.05)?.t;
  const d0 = peerIn(J.frames.find((f) => peerIn(f, 'justin')), 'justin');
  const T1 = J.frames.find((f) => peerIn(f, 'justin') && dist([peerIn(f, 'justin').x, peerIn(f, 'justin').z], [d0.x, d0.z]) > 0.05)?.t;
  const moved = dist(me0, U.frames.at(-1).me);
  const end = peerIn(J.frames.at(-1), 'justin');
  record('mirror: Justin walks (keyboard) and James sees it within 500 ms', moved > 1 && T1 - T0 <= 500 && end && dist([end.x, end.z], U.frames.at(-1).me) < 0.02, `moved ${moved.toFixed(2)} m, latency ${ms(T1 - T0)}`);
}

// a walk round the furniture: never drawn inside a wall / furniture
{
  const target = await james.evaluate(() => {
    const g = document.querySelector('[data-mr="walk"]').__walk;
    const b = g.bounds;
    const me = g.me.pos;
    const cands = [];
    for (let x = b.min.x + 0.25; x < b.max.x; x += 0.25)
      for (let z = b.min.z + 0.25; z < b.max.z; z += 0.25) if (g.grid.walkable(x, z)) cands.push({ x, z, d: Math.hypot(x - me.x, z - me.z) });
    cands.sort((a, b) => b.d - a.d);
    for (const c of cands.slice(0, 60)) if (g.walkTo(c.x, c.z)) return { x: c.x, z: c.z, d: c.d, legs: g.path.length };
    return null;
  });
  await track(james, true);
  await track(justin, true);
  const arrived = target
    ? await james.waitForFunction(() => document.querySelector('[data-mr="walk"]').dataset.path === 'arrived', { timeout: 30000 }).then(
        () => true,
        () => false,
      )
    : false;
  await wait(600);
  const J = await mpOf(james, true);
  const U = await mpOf(justin, true);
  const drawn = U.frames.map((f) => peerIn(f, 'james')).filter(Boolean).map((p) => [p.x, p.z]);
  const walls = await justin.evaluate((pts) => {
    const g = document.querySelector('[data-mr="walk"]').__walk;
    const G = g.grid;
    const blocked = (x, z) => {
      const [i, j] = G.cellOf(x, z);
      return i < 0 || j < 0 || i >= G.nx || j >= G.nz || G.blocked[j * G.nx + i] === 1;
    };
    let bad = 0;
    let first = null;
    for (let k = 0; k < pts.length; k++) {
      const [x, z] = pts[k];
      const [px, pz] = k ? pts[k - 1] : pts[k];
      const n = Math.max(1, Math.ceil(Math.hypot(x - px, z - pz) / 0.02));
      for (let s = 0; s <= n; s++) {
        const t = s / n;
        if (blocked(px + (x - px) * t, pz + (z - pz) * t)) {
          bad++;
          first ??= [x, z];
          break;
        }
      }
    }
    return { bad, first };
  }, drawn);
  const a = analyse(J.frames, U.frames, 'james', J.frames[0].t + 300, J.frames.at(-1).t - 700);
  info(`walk round the furniture: ${target ? `${target.d.toFixed(1)} m away, ${target.legs} legs` : 'no target'}`);
  record('walk: James walks round the furniture (A*, what a tap does) and arrives', arrived);
  record('walk: Justin never draws James inside a wall or furniture (frames + the line between them)', drawn.length > 50 && walls.bad === 0, `${walls.bad} of ${drawn.length} frames cross a blocked cell${walls.first ? ` (first at ${walls.first.map((v) => v.toFixed(2))})` : ''}`);
  record('walk: smooth (largest per-frame step < 0.2 m), no rubber-banding', a.maxStep < 0.2 && a.back === 0, `largest step ${a.maxStep.toFixed(3)} m, ${a.back} backward, lag median ${ms(median(a.lags))}`);
}

// a legit big jump (accepted by the server) snaps instead of gliding through what's between
{
  await wait(1300); // still for > 1 s: the server allows 7 m/s × 1.3 s + 1.2 m
  const jump = await james.evaluate(() => {
    const g = document.querySelector('[data-mr="walk"]').__walk;
    const G = g.grid;
    const me = { x: g.me.pos.x, z: g.me.pos.z };
    const crosses = (b) => {
      for (let t = 0; t <= 1; t += 0.01) {
        const [i, j] = G.cellOf(me.x + (b.x - me.x) * t, me.z + (b.z - me.z) * t);
        if (G.blocked[j * G.nx + i] === 1) return true;
      }
      return false;
    };
    const cands = [];
    for (let x = g.bounds.min.x + 0.25; x < g.bounds.max.x; x += 0.25)
      for (let z = g.bounds.min.z + 0.25; z < g.bounds.max.z; z += 0.25) {
        const d = Math.hypot(x - me.x, z - me.z);
        if (d > 2.6 && d < 6 && G.walkable(x, z)) cands.push({ x, z, d, wall: crosses({ x, z }) });
      }
    cands.sort((a, b) => Number(b.wall) - Number(a.wall) || a.d - b.d);
    return cands[0] ? { from: [me.x, me.z], ...cands[0] } : null;
  });
  if (!jump) record('snap: a walkable point 2.6–6 m away for a legit jump', false, 'none found in this room');
  else {
    await track(justin, true);
    const n = await count(james, 'recv');
    await wait(200);
    const tj = Date.now();
    await james.evaluate((x, z) => document.querySelector('[data-mr="walk"]').__walk.teleport(x, z), jump.x, jump.z);
    await wait(1200);
    const J = await mpOf(james);
    const U = await mpOf(justin, true);
    const corrected = J.recv.slice(n).some((x) => x.m.t === 'correct');
    const to = [jump.x, jump.z];
    const after = U.frames.filter((f) => f.t >= tj && peerIn(f, 'james')).map((f) => [peerIn(f, 'james').x, peerIn(f, 'james').z]);
    const between = after.filter((p) => dist(p, jump.from) > 0.15 && dist(p, to) > 0.15);
    const reached = U.frames.find((f) => f.t >= tj && peerIn(f, 'james') && dist([peerIn(f, 'james').x, peerIn(f, 'james').z], to) < 0.05);
    info(`legit jump: ${jump.d.toFixed(2)} m${jump.wall ? ' (through furniture/wall on the straight line)' : ''}`);
    record('snap: the server accepts a legit jump (no correct)', !corrected);
    record('snap: Justin snaps James to the new spot (no frame in between)', after.length > 0 && between.length === 0 && Boolean(reached), `${between.length} frames in between; drawn there ${reached ? ms(reached.t - tj) : 'never'} after the jump`);
  }
}

// a spoofed teleport (25 m, right after a state) is clamped
{
  await wait(300);
  await track(justin, true);
  const n = await count(james, 'recv');
  const t0 = Date.now();
  const from = await james.evaluate(() => {
    const g = document.querySelector('[data-mr="walk"]').__walk;
    const from = [g.me.pos.x, g.me.pos.z];
    g.sendLocal(true); // a state now…
    g.teleport(g.bounds.max.x + 20, g.me.pos.z); // …and 20 m outside the room a moment later
    return from;
  });
  await wait(1500);
  const J = await mpOf(james);
  const U = await mpOf(justin, true);
  const corr = J.recv.slice(n).find((x) => x.m.t === 'correct');
  const s = await state(james);
  const far = Math.max(0, ...U.frames.filter((f) => f.t >= t0 && peerIn(f, 'james')).map((f) => dist([peerIn(f, 'james').x, peerIn(f, 'james').z], from)));
  record('spoof: a 20+ m teleport → the server sends correct', Boolean(corr), corr ? `correct p ${corr.m.p.map((v) => v.toFixed(2))} (${dist([corr.m.p[0], corr.m.p[2]], from).toFixed(2)} m from the start) after ${ms(corr.t - t0)}` : 'no correct');
  record('spoof: James ends up back near where he was (≤ 1.5 m, on a walkable cell)', s.me && dist(s.me, from) <= 1.5, `${s.me ? dist(s.me, from).toFixed(2) : '?'} m from the start`);
  record('spoof: Justin never draws James more than ~1.4 m from the start', far <= 1.45, `farthest drawn ${far.toFixed(2)} m`);
  await wait(1200);
  await james.evaluate((x, z) => document.querySelector('[data-mr="walk"]').__walk.teleport(x, z), from[0], from[1]); // back, legitimately
  await wait(300);
}

// ── emotes ───────────────────────────────────────────────────────────────────
{
  await blurAll(james);
  const firstAnim = async (who, anim, t0, timeout = 1500) =>
    until(async () => {
      const f = (await peek(who === 'james' ? justin : james, 'frames')).find((f) => f.t >= t0 && peerIn(f, who)?.anim === anim);
      return f ? f.t - t0 : null;
    }, timeout, 30);
  await track(justin, true);
  let t = Date.now();
  await james.keyboard.press('Digit1');
  const wave = await firstAnim('james', 'wave', t);
  record('emote: James presses 1 → Justin sees him wave', wave !== null, `${ms(wave)}`);
  await wait(1700);
  await track(justin, true);
  t = Date.now();
  await james.click(sel('walk-emote-jump'));
  const jumpL = await firstAnim('james', 'jump', t);
  record('emote: James clicks Jump → Justin sees him jump', jumpL !== null, `${ms(jumpL)}`);
  await wait(1000);
  await blurAll(james);
  await track(justin, true);
  t = Date.now();
  await james.keyboard.press('Digit3');
  const sitL = await firstAnim('james', 'sit', t);
  await wait(1200);
  const still = (await peek(justin, 'frames')).filter((f) => f.t > t + 400).every((f) => peerIn(f, 'james')?.anim === 'sit');
  record('emote: James presses 3 → Justin sees him sit (and stay sat)', sitL !== null && still, `${ms(sitL)}`);
  await track(justin, true);
  t = Date.now();
  await james.keyboard.press('Digit3');
  const standL = await firstAnim('james', 'idle', t);
  record('emote: 3 again → Justin sees him stand', standL !== null, `${ms(standL)}`);
  await track(james, true);
  t = Date.now();
  await justin.click(sel('walk-emote-wave'));
  const back = await firstAnim('justin', 'wave', t);
  record('emote: Justin clicks Wave → James sees it', back !== null, `${ms(back)}`);
  await wait(300);
  await shot(james, 'emote-james');
  await wait(1500);
}

// ── chat ─────────────────────────────────────────────────────────────────────
const bubbles = (page, text) =>
  page.evaluate((text) => {
    const tags = [...document.querySelectorAll('.mr-walk__tag')];
    return tags
      .map((t) => ({ who: t.dataset.who, self: t.dataset.self !== undefined, text: t.querySelector('.mr-walk__bubble')?.textContent ?? '', shown: !t.querySelector('.mr-walk__bubble')?.hidden }))
      .filter((b) => b.shown && (text === null || b.text === text));
  }, text);
{
  await blurAll(james);
  const line = 'hello Justin, over by the window';
  const nU = await count(justin, 'says');
  const nJ = await count(james, 'says');
  await james.keyboard.press('Enter');
  const input = await james.waitForSelector(sel('walk-chat-input'), { visible: true, timeout: 3000 }).catch(() => null);
  record('chat: Enter opens the chat line', Boolean(input));
  await james.keyboard.type(line);
  const t0 = Date.now();
  await james.keyboard.press('Enter');
  const got = await until(async () => (await peek(justin, 'says', nU)).find((s) => s.text === line), 2000);
  record('chat: Justin sees James\'s line over his head within 500 ms', got && got.t - t0 <= 500, got ? `${ms(got.t - t0)}` : 'never');
  await wait(400);
  const uB = await bubbles(justin, line);
  record('chat: the bubble is on James\'s tag in Justin\'s view', uB.length === 1 && uB[0].who === 'james', JSON.stringify(uB));
  // …and Justin can actually read it: inside the stage and the window, nothing (header, bar) over it
  const onScreen = await justin.evaluate(() => {
    const tag = [...document.querySelectorAll('.mr-walk__tag')].find((t) => t.dataset.who === 'james');
    const el = tag?.querySelector('.mr-walk__bubble');
    if (!el || el.hidden) return { ok: false, why: 'no bubble' };
    const r = el.getBoundingClientRect();
    const stage = document.querySelector('[data-mr="walk"]').getBoundingClientRect();
    const pts = [
      [r.left + 4, r.top + 4],
      [r.right - 4, r.top + 4],
      [r.left + r.width / 2, r.top + r.height / 2],
      [r.left + 4, r.bottom - 4],
      [r.right - 4, r.bottom - 4],
    ];
    // the overlay lets the pointer through (pointer-events: none), which hit-testing skips: make the
    // bubble hit-testable for the measurement only, so what covers it (the header, the bar) shows
    const pe = el.style.pointerEvents;
    el.style.pointerEvents = 'auto';
    const seen = pts.filter(([x, y]) => x >= 0 && y >= 0 && x < innerWidth && y < innerHeight && el.contains(document.elementFromPoint(x, y))).length;
    const top = document.elementFromPoint(r.left + r.width / 2, Math.max(0, r.top + r.height / 2));
    el.style.pointerEvents = pe;
    return {
      ok: seen === pts.length && r.top >= stage.top && r.bottom <= stage.bottom,
      seen,
      rect: [r.left, r.top, r.right, r.bottom].map(Math.round),
      stage: [stage.left, stage.top, stage.right, stage.bottom].map(Math.round),
      covering: top && !el.contains(top) ? `${top.tagName.toLowerCase()}.${String(top.className).split(' ')[0]}` : null,
    };
  });
  record(
    'chat: Justin can read the bubble (fully on screen, nothing over it)',
    onScreen.ok,
    `${onScreen.seen ?? 0}/5 points visible; bubble ${JSON.stringify(onScreen.rect)} in stage ${JSON.stringify(onScreen.stage)}${onScreen.covering ? `, covered by ${onScreen.covering}` : ''}`,
  );
  const J = await mpOf(james);
  const mySays = J.says.slice(nJ).filter((s) => s.text === line);
  const echo = J.recv.some((x) => x.m.t === 'chat' && x.m.text === line);
  const jB = await bubbles(james, line);
  record('chat: James sees his own line once (the server echo is ignored)', mySays.length === 1 && mySays[0].id === 'me' && jB.length === 1 && jB[0].self, `${mySays.length} say() calls (echo received: ${echo}), ${jB.length} bubble(s)`);
  record('chat: the input closes after sending', !(await james.$(sel('walk-chat-input'))));
  await shot(justin, 'chat-justin');

  // 80 characters through the real input
  await blurAll(james);
  await james.click(sel('walk-chat'));
  await james.waitForSelector(sel('walk-chat-input'), { visible: true, timeout: 3000 });
  const hundred = '0123456789'.repeat(10);
  await james.keyboard.type(hundred);
  const value = await james.$eval(sel('walk-chat-input'), (el) => el.value.length);
  await james.click(sel('walk-chat-send'));
  const got80 = await until(async () => (await peek(justin, 'says', nU)).find((s) => s.text.startsWith('0123456789')), 2000);
  record('chat: the input stops at 80 characters and Justin gets 80', value === 80 && got80?.text.length === 80, `input ${value}, received ${got80?.text.length}`);

  // past the page: a raw 150-char line with control characters, straight onto James's socket
  const nU2 = await count(justin, 'recv');
  await james.evaluate(() => document.querySelector('[data-mr="walk"]').__walkNet.send({ t: 'chat', text: `a\u0007b\u001b[2Jc\td\ne\u007ff ${'y'.repeat(150)}` }));
  const rawChat = await until(async () => (await peek(justin, 'recv', nU2)).find((x) => x.m.t === 'chat')?.m, 2000);
  await wait(200);
   
  const ctl = /[\u0000-\u001f\u007f]/;
  const bub = (await bubbles(justin, null)).find((b) => b.who === 'james');
  record('chat: a raw 150-char line arrives ≤ 80 chars, no control characters (wire + bubble)', rawChat && rawChat.text.length <= 80 && !ctl.test(rawChat.text) && bub && !ctl.test(bub.text) && bub.text.length <= 80, `wire ${JSON.stringify(rawChat?.text?.slice(0, 20))}… (${rawChat?.text?.length}), bubble ${bub?.text?.length}`);

  // Justin talks back
  await blurAll(justin);
  const nJ2 = await count(james, 'says');
  await justin.click(sel('walk-chat'));
  await justin.waitForSelector(sel('walk-chat-input'), { visible: true, timeout: 3000 });
  await justin.keyboard.type('coming!');
  const t1 = Date.now();
  await justin.keyboard.press('Enter');
  const got2 = await until(async () => (await peek(james, 'says', nJ2)).find((s) => s.text === 'coming!' && s.id !== 'me'), 2000);
  record('chat: Justin → James', Boolean(got2), got2 ? ms(got2.t - t1) : 'never');
  const stored = JSON.stringify(await api.getSpot(A.id));
  record('chat: never stored (not in the spot row)', !stored.includes(line) && !stored.includes('coming!'));
}

// ── a dropped socket reconnects ──────────────────────────────────────────────
{
  await track(james, true);
  const nJ = await count(james, 'notes');
  const nU = await count(justin, 'statuses');
  const opens = await count(justin, 'opens');
  const t0 = Date.now();
  await justin.evaluate(() => document.querySelector('[data-mr="walk"]').__walkNet.drop());
  const back = await until(async () => (await peek(justin, 'opens', opens))[0], 20000, 25);
  await wait(800);
  const U = await mpOf(justin);
  const J = await mpOf(james, true);
  const sts = U.statuses.slice(nU).map((s) => s.text);
  record('drop: Justin\'s socket reconnects within its 1 s backoff (+ ticket)', back && back - t0 <= 2000, `${back ? ms(back - t0) : 'never'}; status ${sts.join(' → ')}`);
  record('drop: "Reconnecting…" while it\'s down', sts.includes('Reconnecting…'));
  const notes = J.notes.slice(nJ).map((n) => n.text);
  record('drop: James sees Justin leave and walk back in', notes.includes('Justin left') && notes.at(-1) === 'Justin walked in', JSON.stringify(notes));
  const [sj, su] = [await state(james), await state(justin)];
  record('drop: afterwards exactly one peer each, both live', sj.peers.length === 1 && su.peers.length === 1 && sj.net === 'live' && su.net === 'live', `${sj.peers.length}/${su.peers.length}, ${sj.status} | ${su.status}`);
  const justinAt = su.me;
  const wrong = J.frames.filter((f) => f.t > back && peerIn(f, 'justin') && dist([peerIn(f, 'justin').x, peerIn(f, 'justin').z], justinAt) > 0.3);
  record('drop: on the way back in, James never draws Justin away from where he stands', wrong.length === 0, wrong.length ? `${wrong.length} frames, e.g. at (${peerIn(wrong[0], 'justin').x.toFixed(2)}, ${peerIn(wrong[0], 'justin').z.toFixed(2)}); Justin is at (${justinAt.map((v) => v.toFixed(2))})` : '');
  // twice more in a row: the backoff resets once a socket opens
  const t1 = Date.now();
  const o1 = await count(justin, 'opens');
  await justin.evaluate(() => document.querySelector('[data-mr="walk"]').__walkNet.drop());
  const b1 = await until(async () => (await peek(justin, 'opens', o1))[0], 20000, 25);
  record('drop: a second drop also comes back in ~1 s (backoff reset)', b1 && b1 - t1 <= 2000, b1 ? ms(b1 - t1) : 'never');
  // the backoff: the ticket POST fails three times → retries ~1 s, 2 s, 4 s, then 8 s apart
  {
    const ticketTimes = [];
    let fails = 3;
    const onReq = (r) => {
      if (r.isInterceptResolutionHandled?.()) return;
      if (r.method() === 'POST' && /\/api\/memories\/spots\/[^/]+\/walk$/.test(r.url())) {
        ticketTimes.push(Date.now());
        if (fails-- > 0) return r.abort('failed');
      }
      return r.continue();
    };
    await justin.setRequestInterception(true);
    justin.on('request', onReq);
    const nProblems = justin.problems.length;
    const o3 = await count(justin, 'opens');
    const tb = Date.now();
    await justin.evaluate(() => document.querySelector('[data-mr="walk"]').__walkNet.drop());
    const midStatus = await until(async () => (ticketTimes.length >= 2 ? (await state(justin)).status : null), 10000, 50);
    const b3 = await until(async () => (await peek(justin, 'opens', o3))[0], 25000, 50);
    justin.off('request', onReq);
    await justin.setRequestInterception(false);
    const gaps = [ticketTimes[0] - tb, ...ticketTimes.slice(1).map((t, i) => t - ticketTimes[i])];
    const want = [1000, 2000, 4000, 8000];
    record(
      'backoff: failed reconnects wait ~1 s, 2 s, 4 s, 8 s, then it gets back in',
      gaps.length >= 4 && want.every((w, i) => Math.abs(gaps[i] - w) < 400) && Boolean(b3),
      `attempts after ${gaps.map((g) => ms(g)).join(', ')}; back ${b3 ? ms(b3 - tb) : 'never'} after the drop`,
    );
    info(`while the ticket route is failing Justin's line says: ${JSON.stringify(midStatus)}`);
    // the aborted requests are ours: drop their "Failed to load resource" lines
    justin.problems.splice(nProblems, justin.problems.length - nProblems, ...justin.problems.slice(nProblems).filter((p) => !/ERR_FAILED|Failed to load resource/.test(p)));
    await wait(600);
    const [sj3, su3] = [await state(james), await state(justin)];
    record('backoff: afterwards one peer each again', sj3.peers.length === 1 && su3.peers.length === 1, `${sj3.peers.length}/${su3.peers.length}`);
  }
  // James's socket too
  const t2 = Date.now();
  const o2 = await count(james, 'opens');
  await james.evaluate(() => document.querySelector('[data-mr="walk"]').__walkNet.drop());
  const b2 = await until(async () => (await peek(james, 'opens', o2))[0], 20000, 25);
  await wait(600);
  const [sj2, su2] = [await state(james), await state(justin)];
  record('drop: James\'s socket dropped → back, sees Justin again', b2 && b2 - t2 <= 2000 && sj2.peers.length === 1 && su2.peers.length === 1, `${b2 ? ms(b2 - t2) : 'never'}, peers ${sj2.peers.length}/${su2.peers.length}`);
  await track(james, false);
}

// ── offline: walking alone, then back ───────────────────────────────────────
{
  const nJ = await count(james, 'notes');
  const t0 = Date.now();
  await justin.setOfflineMode(true);
  const off = await until(async () => {
    const s = await state(justin);
    return s.status === "Offline. You're walking alone; others appear when you're back online." ? s : null;
  }, 5000, 50);
  record('offline: Justin\'s line says he\'s walking alone', Boolean(off), off ? `${ms(Date.now() - t0)}: ${off.status}` : JSON.stringify((await state(justin)).status));
  const alone = await until(async () => ((await state(justin)).peers.length === 0 ? Date.now() : null), 3000, 20);
  record('offline: Justin no longer draws James (walking alone)', Boolean(alone), alone ? `peers gone ${ms(alone - t0)} after going offline` : `${(await state(justin)).peers.length} peer(s) after 3 s`);
  await blurAll(justin);
  const nSent = await count(justin, 'sent');
  await track(justin, true);
  const before = (await state(justin)).me;
  let moved = 0;
  for (const key of ['KeyW', 'KeyS', 'KeyA', 'KeyD']) {
    const p0 = (await state(justin)).me;
    await justin.keyboard.down(key);
    await wait(700);
    await justin.keyboard.up(key);
    moved += dist(p0, (await state(justin)).me);
  }
  await wait(300);
  const afterMove = (await state(justin)).me;
  const walked = (await peek(justin, 'frames')).some((f) => f.a === 'walk');
  await track(justin, false);
  record('offline: Justin can still walk (W, S, A, D)', moved > 1 && walked, `${moved.toFixed(2)} m walked, ends ${dist(before, afterMove).toFixed(2)} m from where he went offline`);
  const sentOff = (await peek(justin, 'sent', nSent)).length;
  record('offline: nothing is put on the wire while offline', sentOff === 0, `${sentOff} frames`);
  const left = await until(async () => (await peek(james, 'notes', nJ)).find((n) => n.text === 'Justin left'), 4000, 100);
  const sjOff = await state(james);
  record('offline: James sees Justin leave', Boolean(left) && sjOff.peers.length === 0, `${left ? 'note shown' : 'no note'}, James has ${sjOff.peers.length} peer(s)`);
  await shot(justin, 'offline-justin');
  await wait(1500);
  const t1 = Date.now();
  await justin.setOfflineMode(false);
  const live = await until(async () => {
    const s = await state(justin);
    return s.net === 'live' && s.peers.length ? s : null;
  }, 20000, 50);
  await wait(700);
  const [sj, su] = [await state(james), await state(justin)];
  record('online: Justin reconnects and sees James again', Boolean(live), live ? `${ms(Date.now() - t1 - 700)} (${su.status})` : JSON.stringify(su.status));
  const justinDrawn = sj.peers.find((p) => p.who === 'justin');
  record('online: James sees Justin again, exactly once (no ghost)', sj.peers.length === 1 && Boolean(justinDrawn), `James has ${sj.peers.length} peer(s): ${sj.peers.map((p) => p.who).join(', ')}`);
  record('online: James draws Justin where he walked to while offline', justinDrawn && dist([justinDrawn.x, justinDrawn.z], su.me) < 0.05, justinDrawn ? `off by ${dist([justinDrawn.x, justinDrawn.z], su.me).toFixed(3)} m` : '');
  const pres = await presence(A.id);
  record('online: presence lists each person once', pres?.length === 2, JSON.stringify(pres));
}

// ── leave + join by navigation; the spot page's "is in this room" ───────────
const hereText = (page) => page.evaluate(() => document.querySelector('[data-mr="walk-here"]')?.textContent ?? null);
{
  const nJ = await count(james, 'notes');
  await justin.click(sel('walk-back'));
  await justin.waitForSelector(sel('walk-link'), { timeout: 15000 });
  const left = await until(async () => (await peek(james, 'notes', nJ)).find((n) => n.text === 'Justin left'), 4000, 50);
  const sj = await state(james);
  record('leave: Justin goes back to the spot → James sees "Justin left", Live · just you', Boolean(left) && sj.peers.length === 0 && sj.status === 'Live · just you', `${sj.peers.length} peers, ${sj.status}`);
  const pres = await presence(A.id);
  record('leave: presence → James only', pres?.length === 1 && pres[0].who === 'james', JSON.stringify(pres));
  const jamesHere = await until(() => hereText(justin), 4000, 100);
  record('spot page: Justin\'s spot page says "James is in this room"', jamesHere === 'James is in this room', JSON.stringify(jamesHere));
  const nJ2 = await count(james, 'notes');
  await justin.click(sel('walk-link'));
  await justin.waitForFunction(() => document.querySelector('[data-mr="walk"]')?.__walkNet?.status === 'live', { timeout: 30000 });
  const joined = await until(async () => (await peek(james, 'notes', nJ2)).find((n) => n.text === 'Justin walked in'), 4000, 50);
  await wait(500);
  const [a, b] = [await state(james), await state(justin)];
  record('join: Justin walks back in → James sees "Justin walked in", one peer each', Boolean(joined) && a.peers.length === 1 && b.peers.length === 1, `${a.peers.length}/${b.peers.length}`);

  // James goes to the spot page while Justin walks it
  await james.click(sel('walk-back'));
  await james.waitForSelector(sel('walk-link'), { timeout: 15000 });
  const here = await until(() => hereText(james), 5000, 100);
  record('spot page: "Justin is in this room" while he walks it', here === 'Justin is in this room', JSON.stringify(here));
  const vis = await james.evaluate(() => document.visibilityState);
  info(`James's spot page visibilityState: ${vis} (the line is asked for every 15 s while visible)`);
  await shot(james, 'spot-here-james');
  // Justin leaves → the line goes (next poll ≤ 15 s)
  const tl = Date.now();
  await justin.click(sel('walk-back'));
  await justin.waitForSelector(sel('walk-link'), { timeout: 15000 });
  const gone = await until(async () => ((await hereText(james)) === null ? Date.now() : null), 20000, 200);
  record('spot page: the line goes after he leaves (within the 15 s poll)', Boolean(gone), gone ? `${ms(gone - tl)}` : `still ${JSON.stringify(await hereText(james))} after 20 s`);
  const pres2 = await presence(A.id);
  record('presence: [] once both left', pres2?.length === 0, JSON.stringify(pres2));
  // …and comes back when he walks in again
  const tw = Date.now();
  await justin.click(sel('walk-link'));
  await justin.waitForFunction(() => document.querySelector('[data-mr="walk"]')?.__walkNet?.status === 'live', { timeout: 30000 });
  const again = await until(async () => ((await hereText(james)) === 'Justin is in this room' ? Date.now() : null), 20000, 200);
  record('spot page: the line comes back when he walks in again (within the 15 s poll)', Boolean(again), again ? ms(again - tw) : 'not within 20 s');
}

// ── two different spots don't see each other ────────────────────────────────
{
  const j = await walkIn(james, B.id); // fresh page, spot B; Justin is still in A
  await wait(2500);
  const [sj, su] = [await state(james), await state(justin)];
  const J = await mpOf(james);
  const strangers = J.recv.filter((x) => ['join', 'state', 'emote', 'chat'].includes(x.m.t));
  record('elsewhere: James in B and Justin in A don\'t see each other', j.ok && sj.peers.length === 0 && su.peers.length === 0 && strangers.length === 0, `${sj.peers.length}/${su.peers.length} peers, ${strangers.length} frames from others`);
  record('elsewhere: both say "Live · just you"', sj.status === 'Live · just you' && su.status === 'Live · just you', `${sj.status} | ${su.status}`);
  await blurAll(justin);
  await justin.keyboard.down('KeyW');
  await wait(700);
  await justin.keyboard.up('KeyW');
  await wait(500);
  const J2 = await mpOf(james);
  record('elsewhere: Justin walking in A sends James nothing', J2.recv.filter((x) => x.m.t === 'state').length === 0);
  const [pa, pb] = [await presence(A.id), await presence(B.id)];
  record('elsewhere: presence A = Justin, B = James', pa?.length === 1 && pa[0].who === 'justin' && pb?.length === 1 && pb[0].who === 'james', `${JSON.stringify(pa)} ${JSON.stringify(pb)}`);
  await shot(james, 'elsewhere-james');
}

// ── console ──────────────────────────────────────────────────────────────────
for (const p of [james, justin]) {
  const who = p.who[0].toUpperCase() + p.who.slice(1);
  record(`console: zero console/page errors for ${who}`, p.problems.length === 0, p.problems.slice(0, 4).join(' | '));
}
await browser.close();

// ══ 4. the ticket minted at the start, now expired ══════════════════════════
{
  const age = Date.now() - lateMintedAt;
  if (age < 122000) {
    info(`waiting ${Math.ceil((122000 - age) / 1000)} s for the first ticket to run out`);
    await wait(122000 - age);
  }
  const r = await raw(ticketUrl(lateTicket));
  record('socket: a real ticket used after its 120 s → 403', r.status === 403, `got ${r.status} at ${Math.round((Date.now() - lateMintedAt) / 1000)} s`);
  await closeRaw(r);
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed in ${Math.round((Date.now() - T_START) / 1000)} s${failed.length ? `; failed:\n${failed.map((f) => `  ✗ ${f.name}  ${f.detail}`).join('\n')}` : ''}`);
process.exit(failed.length ? 1 : 0);
