import { useEffect, useRef, useState } from 'react';
import { labelOf } from './controller';
import { clearSession, createLink, readSession, sessionKeyFor, writeSession } from './remote';

/* ============================================================================
   SEMINAR DECKS — PHONE REMOTE, LAPTOP SIDE (present mode and presenter view)
   ----------------------------------------------------------------------------
   With no laptop session stored (seminar-decks:remote:<slug>), it does nothing
   at all: no network. With one, it joins the room as a screen, reports the
   position on connect and on every change, and applies the phone's commands:
   a command says "move on FROM this position", and it is applied only if this
   window is still exactly there, by calling the same next() or prev() that
   Space and the arrow keys call. Either way it acks with the position now.
   So a double tap moves one slide, a retried command cannot move twice, a
   stale one after Space does nothing, and a second synced window is a no-op.
   It adds no DOM, no key listener and no preventDefault, and never touches
   focus or full screen. A failure is a console line, never an exception.
   Runs inside RemoteScreen, inside an error boundary.
   ========================================================================== */

/** The laptop's position as the phone needs it. */
export function stateOf(seq, p) {
  const s = seq[p.index];
  return {
    index: p.index,
    step: p.step,
    black: Boolean(p.black),
    label: labelOf(seq, p.index) || String(p.index + 1),
    kind: s?.kind === 'backup' ? 'backup' : 'main',
    mainNo: s?.kind === 'backup' ? null : (s?.mainNo ?? null),
    backupNo: s?.kind === 'backup' ? (s.backupNo ?? null) : null,
  };
}

// Position reports are coalesced to one per this many ms, always ending on the
// latest, so a held arrow key cannot outrun the server's rate limit.
const REPORT_EVERY_MS = 100;

export function useRemoteScreen({ slug, seq, ctl }) {
  const [info, setInfo] = useState(null); // null: no remote session in this browser
  const [sessionVer, setSessionVer] = useState(0);
  const live = useRef({ seq, ctl });
  const linkRef = useRef(null);
  const report = useRef({ last: 0, timer: 0 });

  useEffect(() => {
    live.current = { seq, ctl };
  });

  // The deck page in another tab started, renewed or ended the remote.
  useEffect(() => {
    const key = sessionKeyFor('screen', slug);
    const onStorage = (e) => {
      if (e.key !== key) return;
      setInfo(null);
      setSessionVer((v) => v + 1);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [slug]);

  useEffect(() => {
    const session = readSession('screen', slug);
    if (!session) return undefined;
    let link = null;
    let logged = null;
    // Commands this window has already acted on: a copy that arrives late (the
    // phone resends after 1.5 s) is acknowledged but never applied again.
    const done = new Set();

    // cause: 'open' (connected, or asked), 'move' (the position changed here),
    // 'vis' (shown or hidden). The room makes a moved or visible window the lead.
    const sendState = (cause = 'open') => {
      try {
        const { seq: sq, ctl: c } = live.current;
        link?.send({ t: 'state', ...stateOf(sq, c.posRef?.current ?? c.pos), cause, visible: document.visibilityState !== 'hidden' });
      } catch {
        /* the slides never wait for the remote */
      }
    };

    const apply = (msg) => {
      try {
        const { seq: sq, ctl: c } = live.current;
        const cur = c.posRef?.current ?? c.pos;
        const f = msg.from ?? {};
        const here = !done.has(msg.id) && f.index === cur.index && f.step === cur.step
          && (typeof f.black !== 'boolean' || f.black === Boolean(cur.black));
        if (here) {
          if (msg.action === 'next') c.next();
          else if (msg.action === 'prev') c.prev();
        }
        const after = c.posRef?.current ?? cur;
        const moved = after.index !== cur.index || after.step !== cur.step || Boolean(after.black) !== Boolean(cur.black);
        if (here && moved) {
          done.add(msg.id);
          if (done.size > 32) done.delete(done.values().next().value);
        }
        link?.send({ t: 'ack', id: msg.id, applied: here && moved, state: stateOf(sq, after) });
      } catch (e) {
        console.info('[deck-remote] command skipped:', e?.message ?? e);
      }
    };

    const onVisibility = () => sendState('vis');
    document.addEventListener('visibilitychange', onVisibility);

    try {
      link = createLink({
        code: session.code,
        token: session.token,
        role: 'screen',
        onSession: (s) => writeSession('screen', slug, s),
        onOpen: () => sendState('open'),
        onMessage: (msg) => {
          if (msg.t === 'cmd') apply(msg);
          else if (msg.t === 'report') sendState('open');
        },
        onStatus: (status, { presence, reason }) => {
          setInfo({ status, phones: presence.phones });
          if ((status === 'offline' || status === 'ended') && logged !== status) {
            console.info(`[deck-remote] remote ${status}${reason ? ` (${reason})` : ''}; the keys still work`);
          }
          logged = status;
          if (status === 'ended') clearSession('screen', slug, session.code);
        },
      });
      linkRef.current = link;
      link.start();
    } catch (e) {
      console.info('[deck-remote] not started:', e?.message ?? e);
    }
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      try {
        link?.stop();
      } catch {
        /* already stopped */
      }
      if (linkRef.current === link) linkRef.current = null;
    };
  }, [slug, sessionVer]);

  // Report every position change (keys, clicker, the audience window's sync, a
  // jump), at most one per REPORT_EVERY_MS and always the latest position.
  const { index, step, black } = ctl.pos;
  useEffect(() => {
    const r = report.current;
    const send = () => {
      r.timer = 0;
      r.last = Date.now();
      try {
        const { seq: sq, ctl: c } = live.current;
        linkRef.current?.send({ t: 'state', ...stateOf(sq, c.posRef?.current ?? c.pos), cause: 'move', visible: document.visibilityState !== 'hidden' });
      } catch {
        /* never in the way of the slides */
      }
    };
    if (r.timer) return;
    const wait = r.last + REPORT_EVERY_MS - Date.now();
    if (wait <= 0) send();
    else r.timer = window.setTimeout(send, wait);
  }, [index, step, black]);
  useEffect(() => {
    const r = report.current;
    return () => window.clearTimeout(r.timer);
  }, []);

  return info;
}
