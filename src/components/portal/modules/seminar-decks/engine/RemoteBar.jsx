import { useEffect, useMemo, useRef, useState } from 'react';
import { buildSequence } from './sequence';
import { stepsOf } from './controller';
import { cleanCode, clearSession, createLink, messageFor, readSession, remoteApi, writeSession } from './remote';
import './remote.css';

/* ============================================================================
   SEMINAR DECKS — PHONE REMOTE, PHONE SIDE (inside PhoneView)
   ----------------------------------------------------------------------------
   Three pieces, each inside its own RemoteBoundary in PhoneView:
     PhoneRemote     draws nothing; holds the link and decides what Next and
                     Previous do. PhoneView asks it first (its tap(), handed
                     over through onApi);
                     when it says no, PhoneView turns its own page as it always
                     has. It says no whenever the laptop is not there to answer:
                     no session, offline, no presenting window, or after the
                     laptop failed to answer until its next position arrives.
     RemoteStatus    one plain line under the title: a coloured dot and words.
     RemoteLinkForm  "Link to laptop": the code field, under the transcript.
   Linked, the phone shows the page of whatever the laptop shows: a main slide's
   page, the demo page, or the backup index with that backup marked. A tap
   sends "move on from here"; no answer in 1.5 s sends it once more, and no
   answer then turns the phone's own page anyway and says so. When the link
   returns, the phone jumps to the laptop's slide and says "Back in step".
   ========================================================================== */

const ACK_WAIT_MS = 1500;
// A second tap this soon after a command is an accidental double tap: ignored.
const DOUBLE_TAP_MS = 300;
const BACK_NOTE_MS = 2000;
const NO_ONE = { screens: 0, phones: 0, watchers: 0 };

const validState = (s) => Boolean(s) && typeof s === 'object' && Number.isInteger(s.index) && Number.isInteger(s.step)
  && typeof s.black === 'boolean' && (s.kind === 'main' || s.kind === 'backup') && typeof s.label === 'string';

const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

// The phone page a laptop position belongs to: a main slide's page, the demo
// page, or the backup index.
function pageOf(plan, pages, s) {
  if (s.kind === 'main') {
    const i = (Number.isInteger(s.mainNo) ? s.mainNo : s.index + 1) - 1;
    return i >= 0 && i < plan.slides.length ? i : -1;
  }
  if (plan.demo && s.label === plan.demo.label) return pages.findIndex((p) => p.kind === 'demo');
  return pages.findIndex((p) => p.kind === 'backups');
}
const isDemo = (plan, s) => Boolean(plan?.demo) && s.kind === 'backup' && s.label === plan.demo.label;
const where = (plan, s) => (s.kind === 'main' ? `slide ${s.mainNo ?? s.index + 1}` : isDemo(plan, s) ? 'the demo slide' : `backup ${s.label}`);

export function PhoneRemote({ deck, plan, pages, onApi, onView, onFollow, onLocalTurn, requestWake }) {
  const slug = deck.slug;
  const seq = useMemo(() => buildSequence(deck).seq, [deck]);
  const [session, setSession] = useState(() => readSession('phone', slug));
  const [closed, setClosed] = useState(null); // the remote ended: { text } until dismissed or relinked
  const ctrl = useRef(null);
  const cb = useRef({});

  useEffect(() => {
    cb.current = { onView, onFollow, onLocalTurn, requestWake, plan, pages, seq };
  });

  // The link and its state machine, while a session is stored.
  useEffect(() => {
    if (!session) return undefined;
    const st = {
      presence: { ...NO_ONE },
      laptop: null, // the laptop's position, while a presenting window is there
      local: false, // the laptop did not answer: this phone's pages until its next position
      apart: false, // was following and stopped: say "Back in step" when following again
      pending: null, // the command in flight { id, action, from, tries, timer }
      lastSent: 0,
      note: null,
      noteTimer: 0,
    };
    let link = null;
    let status = 'connecting';
    let stopped = false;

    const following = () => Boolean(link?.isOpen()) && st.presence.screens > 0 && !st.local && Boolean(st.laptop);

    const publish = () => {
      if (stopped) return;
      try {
        const follow = following();
        const s = st.laptop;
        let code = status;
        let tone = 'idle';
        let text = 'Linking to the laptop';
        if (status === 'offline') {
          tone = 'warn';
          text = navigator.onLine === false ? "Offline: this phone's pages only" : "Reconnecting: this phone's pages only";
        } else if (status === 'linked' || status === 'waiting') {
          if (st.presence.screens < 1) {
            code = 'waiting';
            tone = 'warn';
            text = st.presence.watchers > 0 ? 'Joined: the laptop is not presenting yet' : "Laptop not linked: this phone's pages only";
          } else if (st.local) {
            code = 'local';
            tone = 'bad';
            text = "The laptop didn't answer: check the screen";
          } else if (!s) {
            code = 'linked';
            text = "Linked: waiting for the laptop's slide";
          } else {
            code = 'linked';
            tone = 'good';
            text = st.note ?? `Linked: laptop on ${where(cb.current.plan, s)}${s.black ? ', blacked out' : ''}`;
          }
        }
        const last = cb.current.seq.length - 1;
        cb.current.onView?.({
          active: true,
          code,
          tone,
          text,
          following: follow,
          pending: st.pending?.action ?? null,
          mark: follow && s.kind === 'backup' && !isDemo(cb.current.plan, s) ? s.label : null,
          atStart: follow && s.index === 0 && s.step === 0 && !s.black,
          atEnd: follow && s.index === last && s.step >= stepsOf(cb.current.seq[last]) - 1 && !s.black,
        });
      } catch (e) {
        console.info('[deck-remote] status not shown:', e?.message ?? e);
      }
    };

    // Lost the laptop (offline, no presenting window, no answer): the page stays
    // where it is and the buttons turn this phone's pages.
    const losing = () => {
      if (st.laptop) st.apart = true;
      st.laptop = null;
    };

    // A command in flight when the link drops: turn the page now, as the tap meant.
    const settleLocally = () => {
      const p = st.pending;
      if (!p) return;
      window.clearTimeout(p.timer);
      st.pending = null;
      st.apart = true;
      cb.current.onLocalTurn?.(p.action === 'next' ? 1 : -1);
    };

    const flash = (text) => {
      st.note = text;
      window.clearTimeout(st.noteTimer);
      st.noteTimer = window.setTimeout(() => {
        st.note = null;
        publish();
      }, BACK_NOTE_MS);
    };

    const adopt = (s) => {
      if (!validState(s) || st.presence.screens < 1) return; // no presenting window: never move on a stale position
      const back = st.apart;
      st.laptop = s;
      st.local = false;
      st.apart = false;
      const page = pageOf(cb.current.plan, cb.current.pages, s);
      if (page >= 0) cb.current.onFollow?.(page);
      if (back) flash(`Back in step: ${where(cb.current.plan, s)}`);
      publish();
    };

    const noAnswer = () => {
      const p = st.pending;
      if (!p) return;
      // Once more (safe: the laptop applies a command only from the position it names).
      if (p.tries === 1 && link?.send({ t: 'cmd', id: p.id, action: p.action, from: p.from })) {
        p.tries = 2;
        p.timer = window.setTimeout(noAnswer, ACK_WAIT_MS);
        return;
      }
      st.pending = null;
      st.local = true;
      st.apart = true;
      cb.current.onLocalTurn?.(p.action === 'next' ? 1 : -1);
      publish();
    };

    const tap = (action) => {
      if (stopped || !following()) return false; // PhoneView turns its own page at once
      // One command at a time (the button shows it is pressed), and a second tap
      // within the double-tap window is taken as the same tap.
      if (st.pending || Date.now() - st.lastSent < DOUBLE_TAP_MS) return true;
      const id = newId();
      const from = { index: st.laptop.index, step: st.laptop.step, black: st.laptop.black };
      if (!link.send({ t: 'cmd', id, action, from })) return false;
      st.lastSent = Date.now();
      st.pending = { id, action, from, tries: 1, timer: window.setTimeout(noAnswer, ACK_WAIT_MS) };
      publish();
      return true;
    };

    try {
      link = createLink({
        code: session.code,
        token: session.token,
        role: 'phone',
        onSession: (s) => writeSession('phone', slug, s),
        onStatus: (next, { presence, reason }) => {
          if (stopped) return;
          status = next;
          if (next === 'ended') {
            settleLocally();
            clearSession('phone', slug, session.code);
            const text = reason === 'auth'
              ? "The server refused this sign-in: this phone's pages only"
              : reason === 'full'
                ? "Remote full (four phones linked): this phone's pages only"
                : "Remote ended: this phone's pages only";
            setClosed({ text });
            setSession(null);
            return;
          }
          st.presence = presence;
          if (next !== 'linked' && next !== 'waiting') settleLocally();
          if ((next !== 'linked' && next !== 'waiting') || presence.screens < 1) losing();
          publish();
        },
        onMessage: (msg) => {
          if (stopped) return;
          if (msg.t === 'state') {
            adopt(msg);
          } else if (msg.t === 'ack') {
            if (st.pending && msg.id === st.pending.id) {
              window.clearTimeout(st.pending.timer);
              st.pending = null;
            }
            adopt(msg.state);
            publish();
          } else if (msg.t === 'nack' && st.pending && msg.id === st.pending.id) {
            // No presenting window after all: this phone's pages only.
            st.presence = { ...st.presence, screens: 0 };
            settleLocally();
            losing();
            publish();
          }
        },
      });
      ctrl.current = { tap };
      link.start();
    } catch (e) {
      console.info('[deck-remote] phone link not started:', e?.message ?? e);
    }

    return () => {
      stopped = true;
      window.clearTimeout(st.pending?.timer);
      window.clearTimeout(st.noteTimer);
      try {
        link?.stop();
      } catch {
        /* already stopped */
      }
      if (ctrl.current?.tap === tap) ctrl.current = null;
    };
  }, [session, slug]);

  // No session: nothing to show, or the "ended" line until it is dismissed.
  useEffect(() => {
    if (session) return;
    cb.current.onView?.(closed ? { active: false, ended: true, code: 'ended', tone: 'idle', text: closed.text, following: false } : null);
  }, [session, closed]);

  // What PhoneView and the two UI pieces call (handed over through onApi). Never throws.
  useEffect(() => {
    onApi?.({
      tap: (action) => {
        try {
          return ctrl.current?.tap(action) === true;
        } catch {
          return false;
        }
      },
      link: async (raw) => {
        try {
          const code = cleanCode(raw);
          if (code.length !== 4) return { ok: false, error: 'Codes are four letters.' };
          cb.current.requestWake?.();
          const old = readSession('phone', slug);
          const r = await remoteApi.join(code, 'phone', old?.code === code ? old.token : null);
          if (!r.ok) return { ok: false, error: messageFor(r) };
          if (r.data.slug !== slug) {
            return { ok: false, error: 'That code is for another deck. Open it from Seminar decks, Join presentation.' };
          }
          writeSession('phone', slug, { code, token: r.data.token });
          setClosed(null);
          setSession({ code, token: r.data.token });
          return { ok: true };
        } catch {
          return { ok: false, error: "The remote service isn't available here." };
        }
      },
      unlink: () => {
        clearSession('phone', slug);
        setClosed(null);
        setSession(null);
      },
      dismiss: () => setClosed(null),
    });
  });
  useEffect(() => () => onApi?.(null), [onApi]);

  return null;
}

/** The one status line under the title (only while a remote is linked or just ended). */
export function RemoteStatus({ view, apiRef }) {
  if (!view || !(view.active || view.ended)) return null;
  const i = view.text.indexOf(':');
  const lead = i > 0 ? view.text.slice(0, i + 1) : view.text;
  const rest = i > 0 ? view.text.slice(i + 1) : '';
  const act = () => {
    try {
      if (view.active) apiRef.current?.unlink();
      else apiRef.current?.dismiss();
    } catch {
      /* the page turns by hand regardless */
    }
  };
  return (
    <div className={`sd-phone__remote is-${view.tone}`} data-remote={view.code}>
      <p className="sd-phone__remote-text" role="status" aria-live="polite">
        <i aria-hidden="true" /><b>{lead}</b>{rest}
      </p>
      <button type="button" className="sd-phone__remote-btn" onClick={act}>{view.active ? 'Unlink' : 'Close'}</button>
    </div>
  );
}

/** "Link to laptop" under the transcript: collapsed to one small button until tapped. */
export function RemoteLinkForm({ view, apiRef }) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (view?.active) return null;

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    let r = null;
    try {
      r = await apiRef.current?.link(code);
    } catch {
      r = null;
    }
    setBusy(false);
    if (r?.ok) {
      setOpen(false);
      setCode('');
    } else {
      setError(r?.error ?? "The remote service isn't available here.");
    }
  };

  if (!open) {
    return (
      <p className="sd-phone__linkrow">
        <button type="button" className="sd-phone__link" onClick={() => setOpen(true)}>Link to laptop</button>
      </p>
    );
  }
  return (
    <form className="sd-phone__linkform" onSubmit={submit}>
      <label className="sd-phone__linklabel" htmlFor="sd-phone-code">Code on the laptop</label>
      <div className="sd-phone__linkrow2">
        <input
          id="sd-phone-code"
          className="sd-phone__code"
          value={code}
          onChange={(e) => setCode(cleanCode(e.target.value))}
          maxLength={4}
          autoCapitalize="characters"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          inputMode="text"
          enterKeyHint="go"
          placeholder="CODE"
          aria-describedby={error ? 'sd-phone-code-err' : undefined}
        />
        <button type="submit" className="sd-phone__linkbtn" disabled={busy || code.length !== 4}>{busy ? 'Linking' : 'Link'}</button>
        <button type="button" className="sd-phone__link" onClick={() => { setOpen(false); setError(''); }}>Cancel</button>
      </div>
      {error && (
        <p className="sd-phone__linkerr" id="sd-phone-code-err" role="alert" ref={(el) => el?.scrollIntoView?.({ block: 'nearest' })}>{error}</p>
      )}
    </form>
  );
}
