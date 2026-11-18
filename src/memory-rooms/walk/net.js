/* Walk in together: the room's WebSocket (server: workers/memory-walk.js).

     const net = new WalkNet({ spotId, who, on: { hello, join, leave, state, emote, chat, correct, status } });
     net.start();   net.send({ t: 'state', p, h, a });   net.stop();

   A fresh ticket for every connection (POST /spots/:id/walk with the password; the
   socket can't carry it), then the socket. A lost connection retries with backoff
   (1 s, 2 s, 4 s … 15 s), each time with a new ticket. Offline, it waits for the
   browser's `online` and meanwhile reports 'offline' (the page says you're walking
   alone). status: 'connecting' | 'live' | 'retrying' | 'offline' | 'stopped'. */

import { api } from '../lib/api.js';

const BACKOFF = [1000, 2000, 4000, 8000, 15000];
const PING_MS = 20000;

export class WalkNet {
  constructor({ spotId, who, on = {} }) {
    this.spotId = spotId;
    this.who = who;
    this.on = on;
    this.ws = null;
    this.tries = 0;
    this.timer = 0;
    this.ping = 0;
    this.stopped = true;
    this.status = 'stopped';
    this.onOnline = () => {
      if (!this.stopped && !this.ws) this.connect();
    };
    this.onOffline = () => {
      if (this.stopped) return;
      this.ws?.close();
      this.setStatus('offline');
    };
  }

  setStatus(s) {
    if (s === this.status) return;
    this.status = s;
    this.on.status?.(s);
  }

  start() {
    if (!this.stopped) return;
    this.stopped = false;
    window.addEventListener('online', this.onOnline);
    window.addEventListener('offline', this.onOffline);
    this.connect();
  }

  /** One connection at a time: an 'online' event or a retry while the ticket is on its way waits. */
  async connect() {
    if (this.connecting || (this.ws && this.ws.readyState <= 1)) return;
    this.connecting = true;
    try {
      await this.open();
    } finally {
      this.connecting = false;
    }
  }

  async open() {
    clearTimeout(this.timer);
    if (this.stopped) return;
    if (navigator.onLine === false) return this.setStatus('offline');
    this.setStatus(this.tries ? 'retrying' : 'connecting');
    let ticket;
    try {
      ticket = await api.walkTicket(this.spotId, this.who);
    } catch {
      if (this.stopped) return;
      // the browser offline → "walking alone"; online but the server unreachable → "reconnecting"
      this.setStatus(navigator.onLine === false ? 'offline' : 'retrying');
      return this.retry();
    }
    if (this.stopped) return;
    const url = new URL(ticket.socket, window.location.href);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    let ws;
    try {
      ws = new WebSocket(url);
    } catch {
      return this.retry();
    }
    this.ws = ws;
    ws.onopen = () => {
      this.tries = 0;
      this.setStatus('live');
      clearInterval(this.ping);
      this.ping = setInterval(() => this.send({ t: 'ping' }), PING_MS);
    };
    ws.onmessage = (e) => {
      let msg;
      try {
        msg = JSON.parse(e.data);
      } catch {
        return;
      }
      const fn = this.on[msg.t];
      if (fn) fn(msg);
    };
    ws.onclose = () => {
      if (this.ws === ws) this.ws = null;
      clearInterval(this.ping);
      if (this.stopped) return;
      this.on.lost?.();
      this.retry();
    };
    ws.onerror = () => {
      /* onclose follows */
    };
  }

  retry() {
    if (this.stopped) return;
    if (navigator.onLine === false) return this.setStatus('offline');
    if (this.status !== 'offline') this.setStatus('retrying');
    const wait = BACKOFF[Math.min(this.tries, BACKOFF.length - 1)];
    this.tries += 1;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.connect(), wait);
  }

  send(msg) {
    if (this.ws?.readyState === 1) {
      this.ws.send(JSON.stringify(msg));
      return true;
    }
    return false;
  }

  /** Drop the socket as if the line went (the headless check uses it; the retry follows). */
  drop() {
    this.ws?.close();
  }

  stop() {
    this.stopped = true;
    clearTimeout(this.timer);
    clearInterval(this.ping);
    window.removeEventListener('online', this.onOnline);
    window.removeEventListener('offline', this.onOffline);
    const ws = this.ws;
    this.ws = null;
    if (ws) {
      ws.onclose = null;
      ws.close(1000, 'leaving');
    }
    this.setStatus('stopped');
  }
}
