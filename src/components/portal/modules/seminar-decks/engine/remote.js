import { getPortalKey } from '../../../auth';

/* ============================================================================
   SEMINAR DECKS — PHONE REMOTE: the shared browser client
   ----------------------------------------------------------------------------
   The phone's script page and the presenting laptop meet in a room on the
   DECK_REMOTE Durable Object (workers/deck-remote.js), found by a four-letter
   code. This file is the browser side for both:
     remoteApi    create / join / end over REST, with the portal key
     createLink   the room's WebSocket: a REST join first (so a room that has
                  gone is told apart from a network that has gone), backoff
                  reconnect 0.5 s to 5 s with jitter, a "ping" every 5 s with
                  a 4 s wait for "pong", and an immediate retry when the page
                  becomes visible, comes back online or is restored.
                  Status: idle, connecting, linked, waiting, offline, ended.
     sessions     localStorage, guarded:
                    seminar-decks:remote:<slug>        the laptop's {code, token}
                    seminar-decks:remote-phone:<slug>  the phone's {code, token}
   Nothing here throws to its caller, and nothing here touches keys, focus or
   full screen: the slides and the script never wait for the remote.
   ========================================================================== */

const API = '/api/deck-remote';
const PING_MS = 5000;
const PONG_WAIT_MS = 4000;
const BACKOFF_MIN = 500;
const BACKOFF_MAX = 5000;
const FETCH_TIMEOUT_MS = 8000;

export const CODE_LENGTH = 4;

/** What the code field keeps: capital letters only, at most four. */
export const cleanCode = (raw) => String(raw ?? '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, CODE_LENGTH);

// ── Sessions ─────────────────────────────────────────────────────────────────
const sessionKey = (kind, slug) => (kind === 'phone' ? `seminar-decks:remote-phone:${slug}` : `seminar-decks:remote:${slug}`);

export function readSession(kind, slug) {
  try {
    const v = JSON.parse(window.localStorage.getItem(sessionKey(kind, slug)) ?? 'null');
    return v && typeof v.code === 'string' && typeof v.token === 'string' ? { code: v.code, token: v.token } : null;
  } catch {
    return null;
  }
}

export function writeSession(kind, slug, s) {
  try {
    window.localStorage.setItem(sessionKey(kind, slug), JSON.stringify({ code: s.code, token: s.token }));
  } catch {
    /* private mode: the remote still works until a reload */
  }
}

/** Clear a stored session; with `code`, only if it is still that room's. */
export function clearSession(kind, slug, code) {
  try {
    if (code && readSession(kind, slug)?.code !== code) return;
    window.localStorage.removeItem(sessionKey(kind, slug));
  } catch {
    /* storage blocked */
  }
}

/** The localStorage key of a stored session (to watch for changes from another tab). */
export const sessionKeyFor = sessionKey;

// ── REST ─────────────────────────────────────────────────────────────────────
// Returns { ok, status, data } or { ok: false, status, reason }. `reason` comes
// from the Worker's own JSON; anything else (Vite's HTML, a bare 404, a proxy
// page) reads as "unavailable", never as "no such room".
async function call(path, body) {
  let timer = 0;
  try {
    const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    timer = window.setTimeout(() => ctrl?.abort(), FETCH_TIMEOUT_MS);
    const key = getPortalKey();
    const res = await fetch(`${API}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(key ? { authorization: `Bearer ${key}` } : {}) },
      body: JSON.stringify(body ?? {}),
      cache: 'no-store',
      signal: ctrl?.signal,
    });
    let data = null;
    if ((res.headers.get('content-type') || '').includes('application/json')) {
      data = await res.json().catch(() => null);
    }
    if (res.ok && data && !data.error) return { ok: true, status: res.status, data };
    let reason = 'unavailable';
    if (data && typeof data.reason === 'string') reason = data.reason;
    else if (data && res.status === 401) reason = 'auth';
    return { ok: false, status: res.status, reason };
  } catch {
    return { ok: false, status: 0, reason: navigator.onLine === false ? 'offline' : 'unreachable' };
  } finally {
    window.clearTimeout(timer);
  }
}

export const remoteApi = {
  create: (slug) => call('/create', { slug }),
  join: (code, role, token) => call(`/room/${encodeURIComponent(code)}/join`, { role, ...(token ? { token } : {}) }),
  end: (code, token) => call(`/room/${encodeURIComponent(code)}/end`, { token }),
};

/** A plain sentence for a failed REST call. */
export function messageFor(res) {
  switch (res?.reason) {
    case 'no-room':
      return 'No presentation has that code. Check the code on the laptop.';
    case 'auth':
      return 'The server refused this sign-in. Sign out of the portal and sign in again.';
    case 'offline':
      return 'This device is offline.';
    case 'unreachable':
      return "Can't reach the remote service. Check the connection.";
    case 'busy':
      return 'The remote is busy. Wait a moment and try again.';
    case 'full':
      return 'Four phones are already linked to this remote.';
    case 'forbidden':
      return 'Only the laptop that started the remote can do that.';
    default:
      return "The remote service isn't available here.";
  }
}

// ── The room's WebSocket ─────────────────────────────────────────────────────
const NO_ONE = { screens: 0, phones: 0, watchers: 0 };
const count = (x) => (Number.isInteger(x) && x >= 0 ? x : 0);

/**
 * @param {object} o
 * @param {string} o.code
 * @param {string} o.token
 * @param {'screen'|'phone'} o.role
 * @param {boolean} [o.watch]   the deck page: presence only, never commands
 * @param {(status:string, info:{presence:object, reason:string|null})=>void} [o.onStatus]
 * @param {(msg:object)=>void} [o.onMessage]
 * @param {()=>void} [o.onOpen]
 * @param {(s:{code:string, token:string})=>void} [o.onSession]  the server minted a new token
 */
export function createLink({ code, token, role, watch = false, onStatus, onMessage, onOpen, onSession }) {
  let tok = token;
  let ws = null;
  let stopped = false;
  let started = false;
  let ended = false;
  let endReason = null;
  let everOpen = false;
  let failed = false;
  let running = false;
  let backoff = BACKOFF_MIN;
  let retryTimer = 0;
  let pingTimer = 0;
  let pongTimer = 0;
  let openTimer = 0;
  let presence = { ...NO_ONE };
  let status = 'idle';

  const safe = (fn, ...args) => {
    try {
      return fn?.(...args);
    } catch (e) {
      console.info('[deck-remote]', e?.message ?? e);
      return undefined;
    }
  };
  const isOpen = () => Boolean(ws) && ws.readyState === 1;

  function compute() {
    if (ended) return 'ended';
    if (stopped) return 'idle';
    if (!isOpen()) return everOpen || failed ? 'offline' : 'connecting';
    const peers = role === 'phone' ? presence.screens : presence.phones;
    return peers > 0 ? 'linked' : 'waiting';
  }

  function report() {
    if (stopped) return;
    status = compute();
    safe(onStatus, status, { presence: { ...presence }, reason: endReason });
  }

  function dropSocket() {
    const old = ws;
    ws = null;
    window.clearInterval(pingTimer);
    window.clearTimeout(pongTimer);
    window.clearTimeout(openTimer);
    pingTimer = 0;
    pongTimer = 0;
    openTimer = 0;
    presence = { ...NO_ONE };
    if (old) {
      old.onopen = null;
      old.onmessage = null;
      old.onclose = null;
      old.onerror = null;
      try {
        old.close();
      } catch {
        /* already closed */
      }
    }
  }

  function scheduleRetry() {
    if (stopped || ended) return;
    window.clearTimeout(retryTimer);
    const delay = Math.round(Math.min(BACKOFF_MAX, backoff) * (0.8 + Math.random() * 0.4));
    backoff = Math.min(BACKOFF_MAX, backoff * 1.8);
    retryTimer = window.setTimeout(attempt, delay);
  }

  // The room has gone (ended, expired, unknown) or refused us: stop for good.
  function finish(reason) {
    ended = true;
    endReason = reason;
    window.clearTimeout(retryTimer);
    dropSocket();
    removeListeners();
    report();
  }

  async function attempt() {
    if (stopped || ended || running || isOpen() || (ws && ws.readyState === 0)) return;
    running = true;
    window.clearTimeout(retryTimer);
    retryTimer = 0;
    try {
      const res = await remoteApi.join(code, role === 'phone' ? 'phone' : 'screen', tok);
      if (stopped || ended) return;
      if (!res.ok) {
        if (['no-room', 'auth', 'forbidden', 'full'].includes(res.reason)) {
          finish(res.reason);
          return;
        }
        failed = true;
        report();
        scheduleRetry();
        return;
      }
      if (res.data.token && res.data.token !== tok) {
        tok = res.data.token;
        safe(onSession, { code, token: tok });
      }
      open();
    } catch {
      failed = true;
      report();
      scheduleRetry();
    } finally {
      running = false;
    }
  }

  function open() {
    dropSocket();
    let s;
    try {
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      s = new WebSocket(`${proto}//${window.location.host}${API}/room/${encodeURIComponent(code)}/ws?token=${encodeURIComponent(tok)}${watch ? '&watch=1' : ''}`);
    } catch {
      failed = true;
      report();
      scheduleRetry();
      return;
    }
    ws = s;
    // A connection into a dead network can hang for a long time: give up after 8 s.
    openTimer = window.setTimeout(() => {
      if (ws !== s || s.readyState === 1) return;
      dropSocket();
      failed = true;
      report();
      scheduleRetry();
    }, FETCH_TIMEOUT_MS);
    s.onopen = () => {
      if (ws !== s) return;
      window.clearTimeout(openTimer);
      openTimer = 0;
      everOpen = true;
      failed = false;
      backoff = BACKOFF_MIN;
      window.clearInterval(pingTimer);
      pingTimer = window.setInterval(ping, PING_MS);
      report();
      safe(onOpen);
    };
    s.onmessage = (e) => {
      if (ws !== s) return;
      if (e.data === 'pong') {
        window.clearTimeout(pongTimer);
        pongTimer = 0;
        return;
      }
      let msg;
      try {
        msg = JSON.parse(e.data);
      } catch {
        return;
      }
      if (!msg || typeof msg !== 'object' || msg.v !== 1) return;
      if (msg.t === 'presence') {
        presence = { screens: count(msg.screens), phones: count(msg.phones), watchers: count(msg.watchers) };
        report();
      } else if (msg.t === 'ended') {
        finish(msg.reason === 'expired' ? 'expired' : 'ended');
        return;
      }
      safe(onMessage, msg);
    };
    s.onclose = () => {
      if (ws !== s) return;
      dropSocket();
      report();
      scheduleRetry();
    };
    s.onerror = () => {
      /* close follows and owns the retry */
    };
  }

  function ping() {
    if (!isOpen() || pongTimer) return;
    try {
      ws.send('ping');
    } catch {
      return;
    }
    // No pong in time: the socket is dead even if it still looks open.
    pongTimer = window.setTimeout(() => {
      pongTimer = 0;
      if (!ws) return;
      dropSocket();
      backoff = BACKOFF_MIN;
      report();
      scheduleRetry();
    }, PONG_WAIT_MS);
  }

  // Back from a pocket, a lost signal or the back-forward cache: check now.
  function wake() {
    if (stopped || ended) return;
    if (isOpen()) {
      ping();
      return;
    }
    backoff = BACKOFF_MIN;
    attempt();
  }
  const onVisible = () => {
    if (document.visibilityState === 'visible') wake();
  };
  const onOffline = () => {
    if (stopped || ended) return;
    dropSocket();
    failed = true;
    report();
    scheduleRetry();
  };
  // Leaving the page (reload, navigation, the back-forward cache): close the
  // socket ourselves so the room sees it go at once; pageshow reconnects.
  const onPageHide = () => {
    if (stopped || ended) return;
    window.clearTimeout(retryTimer);
    retryTimer = 0;
    dropSocket();
    report(); // if the page is restored, it shows "offline" until pageshow reconnects
  };
  function addListeners() {
    window.addEventListener('online', wake);
    window.addEventListener('pageshow', wake);
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('offline', onOffline);
    document.addEventListener('visibilitychange', onVisible);
  }
  function removeListeners() {
    window.removeEventListener('online', wake);
    window.removeEventListener('pageshow', wake);
    window.removeEventListener('pagehide', onPageHide);
    window.removeEventListener('offline', onOffline);
    document.removeEventListener('visibilitychange', onVisible);
  }

  return {
    start() {
      try {
        if (started || stopped) return;
        started = true;
        addListeners();
        report();
        attempt();
      } catch (e) {
        console.info('[deck-remote] could not start', e?.message ?? e);
      }
    },
    /** Silent: no status callback after stop. */
    stop() {
      stopped = true;
      try {
        window.clearTimeout(retryTimer);
        dropSocket();
        removeListeners();
      } catch {
        /* nothing left to stop */
      }
    },
    /** Send a protocol message; false when the socket is not open. */
    send(msg) {
      if (!isOpen()) return false;
      try {
        ws.send(JSON.stringify({ v: 1, ...msg }));
        return true;
      } catch {
        return false;
      }
    },
    status: () => status,
    presence: () => ({ ...presence }),
    isOpen,
  };
}
