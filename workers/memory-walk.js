/* ============================================================================
   MEMORY ROOMS — "Walk in together": one Durable Object per spot (key = its uuid)
   or per whole place (key = `b:<buildingId>`, its levels joined by stairs)
   ----------------------------------------------------------------------------
   Everyone walking the same spot's room at the same time shares it live: where
   each person is, which way they face, what they're doing (walk / run / sit /
   wave / jump) and short chat lines. Nothing is stored: the DO keeps only who's
   connected (the WebSockets themselves, through hibernation) and relays the rest.

   Not the arcade's ArcadeRoom: /arcade is public; memories are behind the
   password. The patterns are borrowed (hibernating sockets with a mutable
   attachment, per-socket rate limits, plausibility checks on positions), the
   code isn't.

   Auth: browsers can't put a bearer header on a WebSocket, so the password-
   checked route POST /api/memories/spots/:id/walk mints a short-lived signed
   ticket (memory-rooms.js), and GET /api/memories/walk/ws?t=<ticket> upgrades
   with it. This DO only ever sees requests the Worker already checked.

   Messages (JSON, `t` = type)
     client → room   state { p:[x,y,z], h, a, l }  position (m), heading (rad), animation, level (a place:
                                                   its building.json level id; a room: absent / null)
                     emote { e: 'wave'|'jump'|'sit' }
                     chat  { text }                ≤ 80 characters, never stored
                     ping
     room → client   hello { id, who, people:[Person] }   you + everyone already here
                     join  { person }                       someone arrived
                     leave { id, who }
                     state { id, p, h, a, l }               someone moved
                     correct { p }                          your move was clamped (a teleport)
                     emote { id, e }   chat { id, who, text }   pong { now }
     Person = { id, who, p, h, a, l, since }
   In a place, p is in the plan frame with absolute y (a level's floor at its elevation, a flight in between), so
   the speed check covers climbing a stair too; clients draw only the people on their own level.
   You're announced (join) with your FIRST state, never before: until then you're in the
   presence count (the spot page) but nobody draws you. Pings get an auto-response (the room
   isn't woken) and an alarm closes sockets quiet for 75 s, so a phone that vanished mid-walk
   doesn't haunt the room.
   ========================================================================== */

/* global WebSocketRequestResponsePair */

const MAX_SPEED = 7; // m/s: a run is ~3.6; anything faster is clamped
const SLACK_M = 1.2; // sitting down / standing up hops this far at once
const MAX_STATES_PER_S = 24; // the client sends ~12 Hz while moving
const MAX_CHATS_PER_10S = 6;
const CHAT_MAX = 80;
const ANIMS = new Set(['idle', 'walk', 'run', 'sit', 'wave', 'jump']);
const EMOTES = new Set(['wave', 'jump', 'sit']);
const PEOPLE = new Set(['james', 'justin']);
const LEVEL = /^[a-z0-9][a-z0-9-]{0,31}$/; // a building.json level id
const SAVE_EVERY_MS = 1000; // last position into the socket attachment (survives hibernation)
const SWEEP_MS = 60000; // an alarm this often closes sockets that went quiet (a phone that vanished mid-walk)
const IDLE_MS = 75000; // clients ping every 20 s (answered by the auto-response, without waking the room)
const PING = '{"t":"ping"}';
const PONG = '{"t":"pong"}';

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const round = (v) => Math.round(v * 1000) / 1000;

export class MemoryWalkRoom {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    this.live = new Map(); // socket → { id, who, p, h, a, since, placed, last, saved, rate, chats }
    // pings are answered without waking the room, and their time is kept for the idle sweep
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair(PING, PONG));
  }

  /** In-memory state for a socket, rebuilt from its attachment after hibernation. */
  info(ws) {
    let s = this.live.get(ws);
    if (!s) {
      const att = ws.deserializeAttachment();
      if (!att) return null;
      s = { ...att, last: att.t || Date.now(), saved: Date.now(), rate: [0, 0], chats: [] };
      this.live.set(ws, s);
    }
    return s;
  }

  /** Who's here. placedOnly: just those whose first position has arrived (the others aren't drawn yet). */
  people(except = null, { placedOnly = false } = {}) {
    const out = [];
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === except) continue;
      const s = this.info(ws);
      if (s && (s.placed || !placedOnly)) out.push({ id: s.id, who: s.who, p: s.p, h: s.h, a: s.a, l: s.l ?? null, since: s.since });
    }
    return out;
  }

  attach(ws, s, now = Date.now()) {
    s.saved = now;
    ws.serializeAttachment({ id: s.id, who: s.who, p: s.p, h: s.h, a: s.a, l: s.l ?? null, since: s.since, placed: s.placed, t: now });
  }

  send(ws, msg) {
    try {
      ws.send(JSON.stringify(msg));
    } catch {
      /* closing */
    }
  }

  broadcast(msg, except = null) {
    const text = JSON.stringify(msg);
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === except) continue;
      try {
        ws.send(text);
      } catch {
        /* closing */
      }
    }
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname.endsWith('/presence')) {
      const seen = new Map();
      for (const p of this.people()) if (!seen.has(p.who) || p.since < seen.get(p.who).since) seen.set(p.who, p);
      return Response.json({ data: { people: [...seen].map(([who, p]) => ({ who, since: p.since, ...(p.l ? { level: p.l } : {}) })) } });
    }
    if (request.headers.get('upgrade') !== 'websocket') return new Response('Expected a WebSocket', { status: 426 });
    const who = request.headers.get('x-walk-who');
    if (!PEOPLE.has(who)) return new Response('Bad ticket', { status: 403 });

    const { 0: client, 1: server } = new WebSocketPair();
    this.ctx.acceptWebSocket(server);
    const id = crypto.randomUUID().slice(0, 8);
    // Nobody sees you until your first position arrives: that state is announced as your 'join',
    // so a newcomer never flashes in a corner and glides through a wall to where they really are.
    const me = { id, who, p: [0, 0, 0], h: 0, a: 'idle', since: Date.now(), placed: false, t: Date.now() };
    server.serializeAttachment(me);
    this.live.set(server, { ...me, last: Date.now(), saved: Date.now(), rate: [0, 0], chats: [], fresh: true });
    this.send(server, { t: 'hello', id, who, people: this.people(server, { placedOnly: true }) });
    if (!(await this.ctx.storage.getAlarm())) await this.ctx.storage.setAlarm(Date.now() + SWEEP_MS);
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws, raw) {
    if (typeof raw !== 'string' || raw.length > 2000) return;
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    const s = this.info(ws);
    if (!s || !msg || typeof msg !== 'object') return;
    const now = Date.now();

    if (msg.t === 'ping') return this.send(ws, { t: 'pong', now });

    if (msg.t === 'state') {
      // rate limit: per socket, per second
      const sec = Math.floor(now / 1000);
      if (s.rate[0] !== sec) s.rate = [sec, 0];
      if (++s.rate[1] > MAX_STATES_PER_S) return;
      const p = Array.isArray(msg.p) ? msg.p.map(num) : [];
      if (p.length !== 3 || p.some((v) => v === null) || p.some((v) => Math.abs(v) > 500)) return;
      const h = num(msg.h) ?? s.h;
      const a = ANIMS.has(msg.a) ? msg.a : 'idle';
      const l = typeof msg.l === 'string' && LEVEL.test(msg.l) ? msg.l : null;
      // plausibility: no faster than MAX_SPEED since the last accepted state (the first one sets the start)
      let next = p;
      let clamped = false;
      if (s.placed) { // the first position is where you start (`placed` survives hibernation; `fresh` didn't)
        const dt = Math.min(1, Math.max(0.016, (now - s.last) / 1000)); // standing still earns no long jump
        const dx = p[0] - s.p[0];
        const dy = p[1] - s.p[1];
        const dz = p[2] - s.p[2];
        const d = Math.hypot(dx, dy, dz);
        const allow = MAX_SPEED * dt + SLACK_M;
        if (d > allow) {
          const k = allow / d;
          next = [s.p[0] + dx * k, s.p[1] + dy * k, s.p[2] + dz * k];
          clamped = true;
        }
      }
      const first = !s.placed;
      s.fresh = false;
      s.placed = true;
      s.p = next.map(round);
      s.h = round(h);
      s.a = a;
      s.l = l;
      s.last = now;
      if (clamped) this.send(ws, { t: 'correct', p: s.p });
      if (first) {
        this.attach(ws, s, now);
        this.broadcast({ t: 'join', person: { id: s.id, who: s.who, p: s.p, h: s.h, a: s.a, l: s.l, since: s.since } }, ws);
      } else {
        this.broadcast({ t: 'state', id: s.id, p: s.p, h: s.h, a: s.a, l: s.l }, ws);
        if (now - s.saved > SAVE_EVERY_MS) this.attach(ws, s, now);
      }
      return;
    }

    if (msg.t === 'emote' && EMOTES.has(msg.e)) {
      const sec = Math.floor(now / 1000);
      if (s.rate[0] !== sec) s.rate = [sec, 0];
      if (++s.rate[1] > MAX_STATES_PER_S) return;
      return this.broadcast({ t: 'emote', id: s.id, e: msg.e }, ws);
    }

    if (msg.t === 'chat' && typeof msg.text === 'string') {
      s.chats = s.chats.filter((t) => now - t < 10000);
      if (s.chats.length >= MAX_CHATS_PER_10S) return;
      // eslint-disable-next-line no-control-regex
      const text = msg.text.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, CHAT_MAX);
      if (!text) return;
      s.chats.push(now);
      return this.broadcast({ t: 'chat', id: s.id, who: s.who, text });
    }
  }

  async webSocketClose(ws) {
    this.gone(ws);
  }

  async webSocketError(ws) {
    this.gone(ws);
  }

  gone(ws, code = 1000, reason = 'bye') {
    const s = this.info(ws);
    this.live.delete(ws);
    try {
      ws.close(code, reason);
    } catch {
      /* already closed */
    }
    if (s?.placed) this.broadcast({ t: 'leave', id: s.id, who: s.who }, ws);
  }

  /** Every SWEEP_MS while anyone's connected: close the sockets that went quiet (no ping, no move). */
  async alarm() {
    const now = Date.now();
    let open = 0;
    for (const ws of this.ctx.getWebSockets()) {
      const s = this.info(ws);
      const pinged = this.ctx.getWebSocketAutoResponseTimestamp(ws)?.getTime() || 0;
      const last = Math.max(pinged, s?.last || 0, s?.since || 0);
      if (now - last > IDLE_MS) this.gone(ws, 1001, 'idle');
      else open += 1;
    }
    if (open) await this.ctx.storage.setAlarm(now + SWEEP_MS);
  }
}
