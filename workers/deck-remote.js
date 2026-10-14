/* global WebSocketRequestResponsePair */
/* ============================================================================
   SEMINAR DECK REMOTE — Durable Object + /api/deck-remote/* router
   ----------------------------------------------------------------------------
   Links the phone's script page to the laptop that is presenting a seminar
   deck, so Next on the phone moves the slides and the phone's script follows
   the laptop. One room per four-letter code; the room id is
   idFromName("deck-remote:" + CODE), placed in Oceania (locationHint 'oc').

   A separate class from ArcadeRoom on purpose (see ADR-007): the arcade's room
   is a public game reducer with seats and a tick; this is a portal-gated relay
   with roles and no game state, and a bug here must not be able to touch the
   arcade, or the other way round.

   Roles
     screen   a laptop window that is presenting (present mode, presenter view)
     watch    the laptop's deck page: presence only, never receives commands
     phone    the phone's script page

   Routes (create, join and end need the portal key: Authorization: Bearer)
     POST /api/deck-remote/create                {slug}          -> {code, slug, token, role}
     POST /api/deck-remote/room/<CODE>/join      {role, token?}  -> {code, slug, token, role}
     POST /api/deck-remote/room/<CODE>/end       {token}         -> {ok}   (screen token only)
     GET  /api/deck-remote/room/<CODE>/ws?token=…[&watch=1]      -> 101
   The only screen token is the one create mints: a join with a known token
   rejoins as itself, and a join without one is always a new phone. A browser
   WebSocket cannot send a Bearer header, so the socket is authorised by the
   server-minted room token instead, and its Origin must be this site's own.

   Messages (JSON, v: 1; "ping"/"pong" are plain text and answered by the
   runtime's auto-response, so a keepalive never wakes the object)
     screen -> room   {t:'state', index, step, black, label, kind, mainNo, backupNo,
                       cause:'open'|'move'|'vis', visible}
     phone  -> room   {t:'cmd', id, action:'next'|'prev', from:{index, step, black?}}
     screen -> room   {t:'ack', id, applied, state}
     room   -> phone  the lead's state and ack; {t:'nack', id, reason:'no-screen'}
     room   -> screen cmd (to the lead only); {t:'report'} (send your position)
     room   -> all    {t:'presence', screens, phones, watchers}; {t:'ended'}, then close
   With two laptop windows connected, one is the lead: the window last moved by
   a key or command, else a visible one over a hidden one, else the first.
   Commands go only to the lead and only its position reaches the phones.

   Nothing lives only in memory except the rate counters, which may reset when
   the object hibernates. Room state is in SQLite: code, slug, tokens and roles,
   the lead window, the laptop's last position, and last activity. Rooms expire
   12 hours after the last activity (alarm); while sockets are open the same
   alarm sweeps every 10 s for sockets gone silent (20 s for a phone, 90 s for a
   laptop window, whose hidden-page timers Chrome may slow to once a minute):
   an unloaded page or a phone out of signal often sends no close. Tokens are
   never logged.
   ========================================================================== */

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTVWXYZ'; // the arcade's: no I, O, L or U
const CODE_LENGTH = 4;
const ROOM_TTL_MS = 12 * 60 * 60 * 1000;
// Phone tokens per room. The only screen token is the one `create` mints: join
// never mints a screen token, so the code alone can never make a "laptop".
const MAX_PHONE_TOKENS = 4;
const MAX_SOCKETS = 16;
const MAX_MESSAGE_BYTES = 1024;
// Above anything a real client sends (the laptop sends at most ten position
// reports a second plus one ack per phone tap), so nothing legitimate is dropped.
const RATE_PER_SECOND = 30;
const JOINS_PER_MINUTE = 30;
// A socket with nothing heard (message or keepalive ping) for this long is
// treated as gone: laptop and phone ping every 5 s. A page that is unloaded, or
// a phone that loses signal, often leaves no close behind, so while sockets are
// open the alarm sweeps them every SWEEP_EVERY_MS and presence stays true.
// A laptop window gets longer: Chrome runs a hidden page's timers about once a
// minute, and the phone has its own fallback (no answer in 3 s: turn by hand).
const STALE_MS = { screen: 90000, phone: 20000, watch: 20000 };
const SWEEP_EVERY_MS = 10000;
// last_active is written at most this often (pings refresh activity anyway).
const TOUCH_EVERY_MS = 10000;

const SLUG_RE = /^[a-z0-9-]{1,40}$/;
const ID_RE = /^[A-Za-z0-9_-]{1,40}$/;
const TOKEN_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const NO_ROOM = 'No presentation has that code. Check the code on the laptop.';

// ── Worker-side router (mounted at /api/deck-remote/* by workers/app.js) ────
export async function handleDeckRemoteApi(request, env, url, { requirePortalAuth, json, readJson }) {
  if (!env.DECK_REMOTE) {
    return json({ error: 'The deck remote is not set up on this Worker.', reason: 'unconfigured' }, 503);
  }
  const rest = url.pathname.split('/').filter(Boolean).slice(2); // after ['api', 'deck-remote']

  // POST /api/deck-remote/create
  if (rest.length === 1 && rest[0] === 'create') {
    if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
    const denied = requirePortalAuth(request, env);
    if (denied) return denied;
    const body = (await readJson(request)) || {};
    const slug = typeof body.slug === 'string' && SLUG_RE.test(body.slug) ? body.slug : null;
    if (!slug) return json({ error: 'A deck is required.', reason: 'bad-request' }, 400);
    // Test hook: a short expiry, honoured only when wrangler dev is started with
    // --var DECK_REMOTE_TEST_HOOKS:1. Production never sets it.
    const ttlMs = env.DECK_REMOTE_TEST_HOOKS === '1' && Number.isInteger(body.ttlMs) && body.ttlMs >= 1000 && body.ttlMs < ROOM_TTL_MS
      ? body.ttlMs
      : null;
    // 22^4 = 234,256 codes; a few rerolls are plenty to step around a live room.
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const code = randomCode();
      const res = await callRoom(env, code, '/create', { code, slug, ttlMs });
      if (res.status === 409) continue;
      return res;
    }
    return json({ error: 'Could not find a free code. Try again.', reason: 'busy' }, 503);
  }

  // /api/deck-remote/room/<CODE>/(join|end|ws)
  if (rest.length === 3 && rest[0] === 'room') {
    const code = normaliseCode(rest[1]);
    const action = rest[2];

    if (action === 'ws') {
      if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);
      if ((request.headers.get('Upgrade') || '').toLowerCase() !== 'websocket') {
        return new Response('Expected a WebSocket', { status: 426 });
      }
      // Only pages served by this site may open the socket.
      const origin = request.headers.get('Origin');
      if (!origin || origin !== url.origin) return new Response('Forbidden origin', { status: 403 });
      const token = url.searchParams.get('token') || '';
      // Tokens are crypto.randomUUID(); anything else never wakes a room.
      if (!TOKEN_RE.test(token)) return new Response('Unknown or expired token', { status: 403 });
      if (!code) return new Response('No such room', { status: 404 });
      const doUrl = new URL('https://deck-remote.internal/ws');
      doUrl.searchParams.set('token', token);
      if (url.searchParams.get('watch') === '1') doUrl.searchParams.set('watch', '1');
      return roomStub(env, code).fetch(new Request(doUrl, request));
    }

    if (action === 'join' || action === 'end') {
      if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
      const denied = requirePortalAuth(request, env);
      if (denied) return denied;
      if (!code) return json({ error: NO_ROOM, reason: 'no-room' }, 404);
      const body = (await readJson(request)) || {};
      const token = typeof body.token === 'string' && body.token.length <= 64 ? body.token : null;
      if (action === 'end') return callRoom(env, code, '/end', { token });
      const role = body.role === 'phone' || body.role === 'screen' ? body.role : null;
      if (!role) return json({ error: 'role must be phone or screen.', reason: 'bad-request' }, 400);
      return callRoom(env, code, '/join', { code, role, token });
    }
  }

  return json({ error: 'Not found' }, 404);
}

function roomStub(env, code) {
  return env.DECK_REMOTE.get(env.DECK_REMOTE.idFromName(`deck-remote:${code}`), { locationHint: 'oc' });
}

function callRoom(env, code, path, payload) {
  return roomStub(env, code).fetch(
    new Request(`https://deck-remote.internal${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  );
}

// ── DeckRemote Durable Object ────────────────────────────────────────────────
export class DeckRemote {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    // Per-socket message counts and recent joins, for the rate limits. In
    // memory only, so they reset if the object hibernates; that only ever
    // loosens a limit, it never blocks a legitimate message.
    this.rates = new Map();
    this.joins = [];
    // The laptop and phone ping every 5 s; the runtime answers without waking
    // the object, and getWebSocketAutoResponseTimestamp() says when.
    try {
      this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
    } catch {
      /* older runtime: webSocketMessage answers "ping" itself */
    }
  }

  // ── HTTP (from the Worker only) ───────────────────────────────────────────
  async fetch(request) {
    const url = new URL(request.url);
    try {
      if (url.pathname === '/ws') return await this.handleSocket(request, url);
      const body = (await readBody(request)) || {};
      if (url.pathname === '/create') return await this.handleCreate(body);
      if (url.pathname === '/join') return await this.handleJoin(body);
      if (url.pathname === '/end') return await this.handleEnd(body);
    } catch (err) {
      console.error('deck-remote error', err?.message ?? 'unknown');
      return reply({ error: 'The remote hit an error. Try again.', reason: 'error' }, 500);
    }
    return reply({ error: 'Not found' }, 404);
  }

  async handleCreate({ code, slug, ttlMs }) {
    if (this.get('code')) {
      if (!this.isExpired()) return reply({ error: 'code in use', reason: 'in-use' }, 409);
      await this.wipe(); // leftovers of an expired room (the alarm normally clears them)
    }
    const now = Date.now();
    const ttl = Number.isInteger(ttlMs) ? ttlMs : ROOM_TTL_MS;
    const token = crypto.randomUUID();
    this.set('code', code);
    this.set('slug', slug);
    this.set('ttl', String(ttl));
    this.setTokens([{ token, role: 'screen', used: now }]);
    this.set('active', String(now));
    await this.ctx.storage.setAlarm(now + ttl);
    return reply({ code, slug, token, role: 'screen' });
  }

  async handleJoin({ code, role, token }) {
    if (!this.get('code') || this.isExpired()) {
      if (this.get('code')) {
        this.sendAll({ t: 'ended', reason: 'expired' });
        this.closeAll(1000, 'remote expired');
        await this.wipe();
      }
      return reply({ error: NO_ROOM, reason: 'no-room' }, 404);
    }
    const slug = this.get('slug');
    const now = Date.now();
    const tokens = this.tokens();

    // A known token rejoins as itself (a reload, or a reconnect after a drop).
    const known = token ? tokens.find((t) => t.token === token) : null;
    if (known) {
      known.used = now;
      this.setTokens(tokens);
      this.touch(now, true);
      return reply({ code, slug, token: known.token, role: known.role });
    }

    // A new device is always a phone: the laptop's token comes only from create.
    if (role !== 'phone') {
      return reply({ error: 'Only the laptop that started the remote can present with it.', reason: 'forbidden' }, 403);
    }
    if (!this.allowJoin(now)) return reply({ error: 'Too many joins. Wait a minute and try again.', reason: 'busy' }, 429);
    // At the cap, the least recently used phone token with no open socket is
    // dropped, so clearing a phone's storage can never lock it out, and a phone
    // that is linked right now is never cut off.
    const phones = tokens.filter((t) => t.role === 'phone');
    if (phones.length >= MAX_PHONE_TOKENS) {
      const live = new Set(this.sockets().map((ws) => ws.deserializeAttachment().token));
      const idle = phones.filter((t) => !live.has(t.token));
      if (!idle.length) return reply({ error: 'Four phones are already linked to this remote.', reason: 'full' }, 409);
      const oldest = idle.reduce((a, b) => (a.used <= b.used ? a : b));
      tokens.splice(tokens.indexOf(oldest), 1);
    }
    const fresh = { token: crypto.randomUUID(), role: 'phone', used: now };
    tokens.push(fresh);
    this.setTokens(tokens);
    this.touch(now, true);
    return reply({ code, slug, token: fresh.token, role: 'phone' });
  }

  async handleEnd({ token }) {
    if (!this.get('code')) return reply({ error: NO_ROOM, reason: 'no-room' }, 404);
    const t = token ? this.tokens().find((x) => x.token === token) : null;
    if (!t || t.role !== 'screen') return reply({ error: 'Only the laptop can end the remote.', reason: 'forbidden' }, 403);
    this.sendAll({ t: 'ended', reason: 'ended' });
    this.closeAll(1000, 'remote ended');
    await this.wipe();
    return reply({ ok: true });
  }

  async handleSocket(request, url) {
    if ((request.headers.get('Upgrade') || '').toLowerCase() !== 'websocket') {
      return new Response('Expected a WebSocket', { status: 426 });
    }
    if (!this.get('code') || this.isExpired()) return new Response('No such room', { status: 404 });
    const token = url.searchParams.get('token') || '';
    const tokens = this.tokens();
    const t = tokens.find((x) => x.token === token);
    if (!t) return new Response('Unknown or expired token', { status: 403 });
    const watch = url.searchParams.get('watch') === '1';
    if (watch && t.role !== 'screen') return new Response('Forbidden', { status: 403 });
    const role = watch ? 'watch' : t.role;
    const now = Date.now();

    // A reload or a dropped network can leave a dead socket behind for a while;
    // close this token's silent sockets of the same role before counting.
    for (const ws of this.sockets()) {
      const a = ws.deserializeAttachment();
      if (a.token === t.token && a.role === role && now - this.lastHeard(ws, a) > STALE_MS[role]) {
        this.drop(ws, 4000, 'replaced');
      }
    }
    if (this.sockets().length >= MAX_SOCKETS) return new Response('Room is busy', { status: 503 });

    const { 0: client, 1: server } = new WebSocketPair();
    this.ctx.acceptWebSocket(server);
    // serializeAttachment survives hibernation; the token is kept so a dropped
    // token's sockets can be closed. It is never sent or logged. A screen also
    // gets a short id (sid) and its page visibility, for choosing the lead.
    const sid = role === 'screen' ? crypto.randomUUID().slice(0, 8) : null;
    server.serializeAttachment({ role, token: t.token, at: now, seen: now, sid, vis: true });

    t.used = now;
    this.setTokens(tokens);
    this.touch(now, true);
    await this.sweepSoon(now);

    // The first laptop window becomes the lead; later ones take over when they
    // are visible and the lead is not, or when they move (see the messages).
    if (role === 'screen' && !this.leadSocket()) this.set('lead', sid);

    this.broadcastPresence();
    // A phone gets the laptop's last position at once (after presence, so it
    // knows whether a laptop is presenting before it decides to follow).
    if (role === 'phone') {
      const last = this.lastState();
      if (last) this.sendTo(server, { t: 'state', ...last });
    }
    return new Response(null, { status: 101, webSocket: client });
  }

  // ── WebSocket Hibernation handlers ────────────────────────────────────────
  async webSocketMessage(ws, raw) {
    if (typeof raw !== 'string') return; // binary frames are not part of the protocol
    if (raw === 'ping') {
      // Normally answered by the auto-response without waking the object.
      try {
        ws.send('pong');
      } catch {
        /* closing */
      }
      return;
    }
    if (raw.length > MAX_MESSAGE_BYTES || new TextEncoder().encode(raw).byteLength > MAX_MESSAGE_BYTES) return;
    if (!this.allow(ws)) return;

    let att;
    try {
      att = ws.deserializeAttachment();
    } catch {
      return;
    }
    if (!att) return;

    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    if (!msg || typeof msg !== 'object' || msg.v !== 1) return;

    const now = Date.now();
    att.seen = now;
    try {
      ws.serializeAttachment(att);
    } catch {
      /* closing */
    }

    // Laptop windows. Only the lead's position reaches the phones: with two
    // windows open (a forgotten Present tab beside the presenter view), the
    // phone follows and moves one of them, never both in turn.
    if (att.role === 'screen') {
      if (msg.t === 'state') {
        const st = cleanState(msg);
        if (!st) return;
        if (typeof msg.visible === 'boolean' && msg.visible !== att.vis) {
          att.vis = msg.visible;
          this.saveAttachment(ws, att);
        }
        // A window the presenter just moved (key, clicker, a jump) leads; so
        // does a visible one when the lead is hidden.
        if (msg.cause === 'move') this.set('lead', att.sid);
        else this.claimIfVisible(att);
        if (att.sid !== this.get('lead')) return;
        this.saveState(st);
        this.touch(now);
        this.sendRole('phone', { t: 'state', ...st });
        return;
      }
      if (msg.t === 'ack') {
        const st = cleanState(msg.state);
        if (!validId(msg.id) || typeof msg.applied !== 'boolean' || !st) return;
        if (att.sid !== this.get('lead')) return;
        this.saveState(st);
        this.touch(now);
        this.sendRole('phone', { t: 'ack', id: msg.id, applied: msg.applied, state: st });
      }
      return;
    }

    if (att.role === 'phone' && msg.t === 'cmd') {
      const from = cleanFrom(msg.from);
      if (!validId(msg.id) || (msg.action !== 'next' && msg.action !== 'prev') || !from) return;
      this.touch(now);
      const lead = this.leadScreen(now);
      if (!lead) {
        this.sendTo(ws, { t: 'nack', id: msg.id, reason: 'no-screen' });
        return;
      }
      this.sendTo(lead, { t: 'cmd', id: msg.id, action: msg.action, from });
    }
    // Anything else (unknown t, a watcher talking, a phone sending state) is ignored.
  }

  async webSocketClose(ws) {
    this.forget(ws);
    this.promoteLead();
    this.broadcastPresence();
  }

  async webSocketError(ws) {
    this.forget(ws);
    this.promoteLead();
    this.broadcastPresence();
  }

  // ── Expiry and the presence sweep ─────────────────────────────────────────
  async alarm() {
    if (!this.get('code')) return;
    const now = Date.now();
    if (this.isExpired(now)) {
      this.sendAll({ t: 'ended', reason: 'expired' });
      this.closeAll(1000, 'remote expired');
      await this.wipe();
      return;
    }
    let dropped = false;
    for (const ws of this.sockets()) {
      const a = ws.deserializeAttachment();
      if (now - this.lastHeard(ws, a) > STALE_MS[a.role]) {
        this.drop(ws, 4000, 'no keepalive');
        dropped = true;
      }
    }
    if (dropped) {
      this.promoteLead();
      this.broadcastPresence();
    }
    await this.schedule(now);
  }

  // Next alarm: the sweep while any socket is open, else the expiry.
  async schedule(now = Date.now()) {
    const expiry = this.lastActivity() + this.ttl();
    await this.ctx.storage.setAlarm(this.sockets().length ? Math.min(expiry, now + SWEEP_EVERY_MS) : expiry);
  }

  // A new socket starts the sweep, but only ever brings the alarm forward, so
  // frequent reconnects cannot keep postponing it.
  async sweepSoon(now) {
    const want = now + SWEEP_EVERY_MS;
    const cur = await this.ctx.storage.getAlarm();
    if (cur === null || cur > want) await this.ctx.storage.setAlarm(want);
  }

  // ── The lead laptop window ────────────────────────────────────────────────
  leadSocket() {
    const lead = this.get('lead');
    return lead ? this.sockets().find((ws) => {
      const a = ws.deserializeAttachment();
      return a.role === 'screen' && a.sid === lead;
    }) ?? null : null;
  }

  // A visible window takes the lead from a hidden (or missing) one.
  claimIfVisible(att) {
    if (!att.vis) {
      if (!this.leadSocket()) this.set('lead', att.sid);
      return;
    }
    const cur = this.leadSocket();
    if (!cur || !cur.deserializeAttachment().vis) this.set('lead', att.sid);
  }

  // The lead has gone: the newest visible window (else the newest) takes over,
  // and is asked for its position so the phones follow it.
  promoteLead() {
    if (this.leadSocket()) return;
    const screens = this.sockets().filter((ws) => ws.deserializeAttachment().role === 'screen');
    if (!screens.length) return;
    const rank = (ws) => {
      const a = ws.deserializeAttachment();
      return (a.vis ? 1e15 : 0) + a.at;
    };
    const next = screens.reduce((a, b) => (rank(a) >= rank(b) ? a : b));
    this.set('lead', next.deserializeAttachment().sid);
    this.sendTo(next, { t: 'report' });
  }

  // The window a phone command goes to: the lead, once silent screens are dropped.
  leadScreen(now) {
    if (!this.freshScreens(now).length) return null;
    this.promoteLead();
    return this.leadSocket();
  }

  saveAttachment(ws, att) {
    try {
      ws.serializeAttachment(att);
    } catch {
      /* closing */
    }
  }

  allowJoin(now) {
    this.joins = (this.joins ?? []).filter((t) => now - t < 60000);
    if (this.joins.length >= JOINS_PER_MINUTE) return false;
    this.joins.push(now);
    return true;
  }

  // ── Sockets and presence ──────────────────────────────────────────────────
  // Open sockets that still carry an attachment (a closed one is cleared in forget()).
  sockets() {
    return this.ctx.getWebSockets().filter((ws) => {
      try {
        const open = ws.readyState === undefined || ws.readyState === 1;
        return open && Boolean(ws.deserializeAttachment());
      } catch {
        return false;
      }
    });
  }

  presence() {
    const p = { t: 'presence', screens: 0, phones: 0, watchers: 0 };
    for (const ws of this.sockets()) {
      const role = ws.deserializeAttachment().role;
      if (role === 'screen') p.screens += 1;
      else if (role === 'phone') p.phones += 1;
      else if (role === 'watch') p.watchers += 1;
    }
    return p;
  }

  broadcastPresence() {
    const p = this.presence();
    for (const ws of this.sockets()) this.sendTo(ws, p);
  }

  // When something was last heard on a socket: a message, or a keepalive ping
  // answered by the runtime.
  lastHeard(ws, att) {
    let heard = att?.seen ?? att?.at ?? 0;
    try {
      const ts = this.ctx.getWebSocketAutoResponseTimestamp(ws);
      if (ts) heard = Math.max(heard, ts.getTime());
    } catch {
      /* not available */
    }
    return heard;
  }

  // Screens heard from recently. A silent one (laptop lost its network without
  // closing) is closed now, so the phone gets an answer at once.
  freshScreens(now) {
    const out = [];
    let dropped = false;
    for (const ws of this.sockets()) {
      const a = ws.deserializeAttachment();
      if (a.role !== 'screen') continue;
      if (now - this.lastHeard(ws, a) > STALE_MS.screen) {
        this.drop(ws, 4000, 'no keepalive');
        dropped = true;
      } else {
        out.push(ws);
      }
    }
    if (dropped) {
      this.promoteLead();
      this.broadcastPresence();
    }
    return out;
  }

  allow(ws) {
    const now = Date.now();
    const r = this.rates.get(ws);
    if (!r || now - r.start >= 1000) {
      this.rates.set(ws, { start: now, n: 1 });
      return true;
    }
    r.n += 1;
    return r.n <= RATE_PER_SECOND;
  }

  sendTo(ws, msg) {
    try {
      ws.send(JSON.stringify({ v: 1, ...msg }));
    } catch {
      /* socket closed mid-send */
    }
  }

  sendRole(role, msg) {
    for (const ws of this.sockets()) {
      if (ws.deserializeAttachment().role === role) this.sendTo(ws, msg);
    }
  }

  sendAll(msg) {
    for (const ws of this.sockets()) this.sendTo(ws, msg);
  }

  forget(ws) {
    this.rates.delete(ws);
    try {
      ws.serializeAttachment(null);
    } catch {
      /* already torn down */
    }
  }

  drop(ws, code, reason) {
    this.forget(ws);
    try {
      ws.close(code, reason);
    } catch {
      /* already closed */
    }
  }

  closeAll(code, reason) {
    for (const ws of this.ctx.getWebSockets()) this.drop(ws, code, reason);
  }

  // ── Storage (SQLite; the table is created on the first write only, so a
  // join with a code that was never a room leaves nothing behind) ─────────────
  tokens() {
    return parseJson(this.get('tokens'), []);
  }

  setTokens(tokens) {
    this.set('tokens', JSON.stringify(tokens));
  }

  lastState() {
    return parseJson(this.get('state'), null);
  }

  saveState(st) {
    this.set('state', JSON.stringify(st));
  }

  ttl() {
    return parseInt(this.get('ttl') || '', 10) || ROOM_TTL_MS;
  }

  // Last activity: the stored timestamp, or a socket's keepalive if later, so a
  // room whose devices are still connected does not expire under them.
  lastActivity() {
    let t = parseInt(this.get('active') || '0', 10);
    for (const ws of this.sockets()) t = Math.max(t, this.lastHeard(ws, ws.deserializeAttachment()));
    return t;
  }

  isExpired(now = Date.now()) {
    return now - this.lastActivity() >= this.ttl();
  }

  touch(now = Date.now(), force = false) {
    const last = parseInt(this.get('active') || '0', 10);
    if (force || now - last >= TOUCH_EVERY_MS) this.set('active', String(now));
  }

  async wipe() {
    try {
      await this.ctx.storage.deleteAlarm();
    } catch {
      /* no alarm */
    }
    await this.ctx.storage.deleteAll();
  }

  get(key) {
    try {
      return this.ctx.storage.sql.exec('SELECT value FROM room WHERE key = ?', key).toArray()[0]?.value ?? null;
    } catch (err) {
      if (/no such table/i.test(String(err?.message))) return null; // never been a room
      throw err;
    }
  }

  set(key, value) {
    const sql = this.ctx.storage.sql;
    sql.exec('CREATE TABLE IF NOT EXISTS room (key TEXT PRIMARY KEY, value TEXT)');
    sql.exec('INSERT OR REPLACE INTO room (key, value) VALUES (?, ?)', key, value);
  }
}

// ── Validation ───────────────────────────────────────────────────────────────
const isInt = (x, max) => Number.isInteger(x) && x >= 0 && x <= max;
const validId = (id) => typeof id === 'string' && ID_RE.test(id);

function cleanState(m) {
  if (!m || typeof m !== 'object') return null;
  if (!isInt(m.index, 999) || !isInt(m.step, 99) || typeof m.black !== 'boolean') return null;
  if (m.kind !== 'main' && m.kind !== 'backup') return null;
  if (typeof m.label !== 'string' || !m.label || m.label.length > 8) return null;
  const optNo = (x) => (x === null || x === undefined ? null : isInt(x, 999) ? x : undefined);
  const mainNo = optNo(m.mainNo);
  const backupNo = optNo(m.backupNo);
  if (mainNo === undefined || backupNo === undefined) return null;
  return { index: m.index, step: m.step, black: m.black, label: m.label, kind: m.kind, mainNo, backupNo };
}

function cleanFrom(f) {
  if (!f || typeof f !== 'object' || !isInt(f.index, 999) || !isInt(f.step, 99)) return null;
  if (f.black !== undefined && typeof f.black !== 'boolean') return null;
  return f.black === undefined ? { index: f.index, step: f.step } : { index: f.index, step: f.step, black: f.black };
}

// ── small helpers ────────────────────────────────────────────────────────────
function randomCode() {
  // Rejection sampling, so every letter is equally likely.
  const limit = 256 - (256 % CODE_ALPHABET.length);
  let out = '';
  while (out.length < CODE_LENGTH) {
    for (const b of crypto.getRandomValues(new Uint8Array(8))) {
      if (b < limit && out.length < CODE_LENGTH) out += CODE_ALPHABET[b % CODE_ALPHABET.length];
    }
  }
  return out;
}

function normaliseCode(raw) {
  let code = '';
  try {
    code = decodeURIComponent(String(raw || '')).toUpperCase().replace(/[^A-Z]/g, '');
  } catch {
    return null;
  }
  if (code.length !== CODE_LENGTH) return null;
  return [...code].every((c) => CODE_ALPHABET.includes(c)) ? code : null;
}

function parseJson(text, fallback) {
  try {
    return text ? JSON.parse(text) : fallback;
  } catch {
    return fallback;
  }
}

function reply(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

async function readBody(request) {
  try {
    const text = await request.text();
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}
