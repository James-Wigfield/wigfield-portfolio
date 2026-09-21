/* ============================================================================
   ARCADE — shared room Durable Object
   ----------------------------------------------------------------------------
   ONE DO class serves EVERY arcade game (see ADR-005). The DO id is
   `idFromName(slug + ":" + code)`, so rooms are already isolated per game and
   per code; the class itself is game-agnostic.

   This file owns everything that is NOT game-specific:
     • room creation, 5-letter codes, seat assignment
     • server-minted join tokens, so a refresh reconnects to the SAME seat
       (the ghost-player bug in game-worker/ came from minting identity per
       *connection* instead of per *player*)
     • WebSocket Hibernation accept/close/error
     • presence, host election, the alarm() tick, rematch, room expiry
     • per-seat broadcast

   A game is a RULES MODULE in ./games/ — a reducer over plain state. It never
   touches sockets, storage or timers. Adding a game = one rules module + one
   games.json entry + one HTML page. No Cloudflare config, no migration.
   ========================================================================== */

import { GAMES } from './games/index.js';

// 22 letters — I, O, L and U are dropped so a code read aloud over the noise of
// the surf can't be misheard as 1/0/1/V.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTVWXYZ';
const CODE_LENGTH = 5;

// Rooms self-destruct this long after the last activity, so DO SQLite doesn't
// accumulate a row per room forever (the other thing game-worker/ never did).
const ROOM_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

const MAX_NAME = 18;

// ── Worker-side router ───────────────────────────────────────────────────────
// Mounted at /api/arcade/* by workers/app.js.
//
//   POST /api/arcade/<slug>/create                 {name}          -> {code, token, seat}
//   POST /api/arcade/<slug>/room/<CODE>/join       {name, token?}  -> {code, token, seat}
//   GET  /api/arcade/<slug>/room/<CODE>/ws?token=…                 -> 101
//
// NOTE — deviation from ADR-005, which specified `/api/<slug>/*`. That would
// put game slugs in the same namespace as the site's own API routes, so a game
// called "health" or "presentations" would silently shadow a real endpoint.
// Namespacing under /api/arcade/ costs nothing and removes the whole class of
// collision.
export async function handleArcadeApi(request, env, url) {
  const parts = url.pathname.split('/').filter(Boolean); // ['api','arcade',…]
  const slug = parts[2];

  if (!slug) return json({ error: 'Not found' }, 404);
  if (!GAMES[slug]) return json({ error: `Unknown game "${slug}"` }, 404);

  const rest = parts.slice(3);

  // POST /api/arcade/<slug>/create
  if (rest.length === 1 && rest[0] === 'create' && request.method === 'POST') {
    const body = (await readJson(request)) || {};
    const name = cleanName(body.name);
    if (!name) return json({ error: 'A name is required' }, 400);

    // 22^5 ≈ 5.1M codes; a handful of attempts is plenty to dodge a live room.
    for (let attempt = 0; attempt < 6; attempt++) {
      const code = randomCode();
      const res = await callRoom(env, slug, code, '/create', { name });
      if (res.status === 409) continue; // code already in use — reroll
      return res;
    }
    return json({ error: 'Could not allocate a room code — try again' }, 503);
  }

  // /api/arcade/<slug>/room/<CODE>/(join|ws)
  if (rest.length === 3 && rest[0] === 'room') {
    const code = normaliseCode(rest[1]);
    if (!code) return json({ error: 'Bad room code' }, 400);

    if (rest[2] === 'join' && request.method === 'POST') {
      const body = (await readJson(request)) || {};
      const name = cleanName(body.name);
      if (!name) return json({ error: 'A name is required' }, 400);
      return callRoom(env, slug, code, '/join', { name, token: body.token || null });
    }

    if (rest[2] === 'ws' && request.method === 'GET') {
      if ((request.headers.get('Upgrade') || '').toLowerCase() !== 'websocket') {
        return new Response('Expected WebSocket', { status: 426 });
      }
      const stub = roomStub(env, slug, code);
      const doUrl = new URL(request.url);
      doUrl.pathname = '/ws';
      doUrl.searchParams.set('slug', slug);
      doUrl.searchParams.set('code', code);
      return stub.fetch(new Request(doUrl, request));
    }
  }

  return json({ error: 'Not found' }, 404);
}

function roomStub(env, slug, code) {
  return env.ARCADE_ROOM.get(env.ARCADE_ROOM.idFromName(`${slug}:${code}`));
}

function callRoom(env, slug, code, path, payload) {
  return roomStub(env, slug, code).fetch(
    new Request(`https://arcade.internal${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...payload, slug, code }),
    }),
  );
}

// ── ArcadeRoom Durable Object ────────────────────────────────────────────────
export class ArcadeRoom {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    this.ctx.storage.sql.exec(
      'CREATE TABLE IF NOT EXISTS state (key TEXT PRIMARY KEY, value TEXT)',
    );
  }

  // ── HTTP (from the Worker only) ───────────────────────────────────────────
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === '/ws') return this.handleSocket(url);

    const body = (await readJson(request)) || {};
    if (url.pathname === '/create') return this.handleCreate(body);
    if (url.pathname === '/join') return this.handleJoin(body);
    return new Response('Not found', { status: 404 });
  }

  handleCreate({ slug, code, name }) {
    if (this.get('code') && !this.isExpired()) return json({ error: 'code in use' }, 409);

    this.reset(slug, code);
    const seat = this.claimSeat(name);
    if (!seat) return json({ error: 'Room is full' }, 409);
    this.touch();
    return json({ code, token: seat.token, seat: seat.seat, name: seat.name });
  }

  handleJoin({ slug, code, name, token }) {
    if (!this.get('code') || this.isExpired()) {
      // Joining a room that never existed (or has aged out) silently creates it,
      // so a shared link still works after a room expires.
      this.reset(slug, code);
    }

    const seats = this.seats();

    // Reconnecting with a known token keeps the same seat, name and score.
    const existing = token ? seats.find((s) => s.token === token) : null;
    if (existing) {
      if (name) existing.name = name;
      this.setSeats(seats);
      this.touch();
      return json({ code, token: existing.token, seat: existing.seat, name: existing.name });
    }

    const seat = this.claimSeat(name);
    if (!seat) return json({ error: 'Room is full' }, 409);
    this.touch();
    return json({ code, token: seat.token, seat: seat.seat, name: seat.name });
  }

  async handleSocket(url) {
    const token = url.searchParams.get('token');
    const seats = this.seats();
    const seat = seats.find((s) => s.token === token);
    if (!seat) return new Response('Unknown or expired token', { status: 403 });

    const { 0: client, 1: server } = new WebSocketPair();
    this.ctx.acceptWebSocket(server);
    // serializeAttachment (not tags): survives hibernation AND stays mutable,
    // which tags are not.
    server.serializeAttachment({ seat: seat.seat, token: seat.token });

    this.touch();
    this.broadcast();
    return new Response(null, { status: 101, webSocket: client });
  }

  // ── WebSocket Hibernation handlers ────────────────────────────────────────
  async webSocketMessage(ws, raw) {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    const att = ws.deserializeAttachment();
    if (!att) return;
    const seatNo = att.seat;

    if (msg.t === 'ping') {
      ws.send(JSON.stringify({ t: 'pong', now: Date.now() }));
      return;
    }

    this.touch();

    if (msg.t === 'start') return this.dispatch('start', seatNo, msg);
    if (msg.t === 'rematch') return this.dispatch('rematch', seatNo, msg);
    return this.dispatch('action', seatNo, msg);
  }

  async webSocketClose(ws) {
    this.rehost(ws);
    this.broadcast();
  }

  async webSocketError(ws) {
    this.rehost(ws);
    this.broadcast();
  }

  // ── Alarm tick ────────────────────────────────────────────────────────────
  async alarm() {
    if (this.isExpired()) {
      this.ctx.storage.sql.exec('DELETE FROM state');
      for (const ws of this.ctx.getWebSockets()) {
        try {
          ws.close(1000, 'room expired');
        } catch {
          /* already gone */
        }
      }
      return;
    }
    this.dispatch('tick', null, null);
  }

  // ── Rules dispatch ────────────────────────────────────────────────────────
  // Every mutation funnels through here: run the rules module, persist, reschedule
  // the alarm, broadcast. The rules module is pure — state in, state out.
  dispatch(kind, seatNo, msg) {
    const rules = this.rules();
    if (!rules) return;

    const ctx = {
      seat: seatNo,
      now: Date.now(),
      players: this.presentSeats(),
      seats: this.seats(),
      msg,
    };

    let state = this.gameState();
    let next = state;

    try {
      if (kind === 'start') next = rules.start(state, ctx) ?? state;
      else if (kind === 'rematch') next = rules.rematch(state, ctx) ?? state;
      else if (kind === 'tick') next = rules.tick(state, ctx) ?? state;
      else next = rules.action(state, ctx) ?? state;
    } catch (err) {
      console.error('arcade rules error', this.get('slug'), kind, err);
      return;
    }

    if (next === state) {
      // No state change (illegal move, wrong phase, not your turn). Still
      // rebroadcast on presence-driven kinds so late joiners settle.
      if (kind !== 'action') this.broadcast();
      return;
    }

    this.setGameState(next);
    this.schedule(rules.nextTickAt ? rules.nextTickAt(next) : null);
    this.broadcast();
  }

  schedule(at) {
    const expiry = this.lastSeen() + ROOM_TTL_MS;
    const when = at && at > Date.now() ? Math.min(at, expiry) : expiry;
    this.ctx.storage.setAlarm(when);
  }

  // ── Broadcast ─────────────────────────────────────────────────────────────
  broadcast() {
    const rules = this.rules();
    if (!rules) return;

    const state = this.gameState();
    const seats = this.seats();
    const present = this.presentSeats();
    const hostSeat = this.hostSeat(present);

    const roster = seats.map((s) => ({
      seat: s.seat,
      name: s.name,
      online: present.includes(s.seat),
      host: s.seat === hostSeat,
    }));

    for (const ws of this.ctx.getWebSockets()) {
      const att = ws.deserializeAttachment();
      if (!att) continue;
      let view;
      try {
        view = rules.view(state, { seat: att.seat, players: present, seats, now: Date.now() });
      } catch (err) {
        console.error('arcade view error', err);
        continue;
      }
      try {
        ws.send(
          JSON.stringify({
            t: 'state',
            code: this.get('code'),
            slug: this.get('slug'),
            seat: att.seat,
            host: att.seat === hostSeat,
            players: roster,
            serverNow: Date.now(),
            game: view,
          }),
        );
      } catch {
        /* socket closed mid-broadcast */
      }
    }
  }

  // ── Seats & presence ──────────────────────────────────────────────────────
  reset(slug, code) {
    this.ctx.storage.sql.exec('DELETE FROM state');
    this.set('slug', slug);
    this.set('code', code);
    this.setSeats([]);
    const rules = GAMES[slug];
    this.setGameState(rules ? rules.init() : {});
    this.touch();
  }

  claimSeat(name) {
    const rules = this.rules();
    const max = rules?.seats ?? 2;
    const seats = this.seats();
    if (seats.length >= max) return null;

    const taken = new Set(seats.map((s) => s.seat));
    let n = 0;
    while (taken.has(n)) n++;

    const seat = {
      seat: n,
      name: name || `Player ${n + 1}`,
      token: crypto.randomUUID(),
    };
    seats.push(seat);
    this.setSeats(seats);
    return seat;
  }

  // Seats with a live socket right now.
  presentSeats() {
    const out = new Set();
    for (const ws of this.ctx.getWebSockets()) {
      const att = ws.deserializeAttachment();
      if (att) out.add(att.seat);
    }
    return [...out].sort((a, b) => a - b);
  }

  // Host is simply the lowest-numbered seat currently online, so it re-elects
  // itself with no extra bookkeeping when someone drops.
  hostSeat(present = this.presentSeats()) {
    return present.length ? present[0] : null;
  }

  rehost(ws) {
    try {
      ws.serializeAttachment(null);
    } catch {
      /* socket already torn down */
    }
  }

  // ── Storage helpers ───────────────────────────────────────────────────────
  rules() {
    return GAMES[this.get('slug')] ?? null;
  }

  seats() {
    return JSON.parse(this.get('seats') || '[]');
  }

  setSeats(seats) {
    this.set('seats', JSON.stringify(seats));
  }

  gameState() {
    return JSON.parse(this.get('game') || '{}');
  }

  setGameState(state) {
    this.set('game', JSON.stringify(state));
  }

  lastSeen() {
    return parseInt(this.get('last_seen') || '0', 10);
  }

  isExpired() {
    return Date.now() - this.lastSeen() > ROOM_TTL_MS;
  }

  touch() {
    this.set('last_seen', String(Date.now()));
  }

  get(key) {
    return (
      this.ctx.storage.sql.exec('SELECT value FROM state WHERE key = ?', key).toArray()[0]?.value ??
      null
    );
  }

  set(key, value) {
    this.ctx.storage.sql.exec(
      'INSERT OR REPLACE INTO state (key, value) VALUES (?, ?)',
      key,
      value,
    );
  }
}

// ── small helpers ────────────────────────────────────────────────────────────
function randomCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH));
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
}

function normaliseCode(raw) {
  const code = String(raw || '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '');
  return code.length === CODE_LENGTH ? code : null;
}

function cleanName(raw) {
  return String(raw || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_NAME);
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

async function readJson(request) {
  try {
    const text = await request.text();
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}
