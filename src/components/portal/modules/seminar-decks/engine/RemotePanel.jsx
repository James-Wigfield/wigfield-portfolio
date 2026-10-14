import { useCallback, useEffect, useState } from 'react';
import { clearSession, createLink, messageFor, readSession, remoteApi, sessionKeyFor, writeSession } from './remote';
import './remote.css';

/* ============================================================================
   SEMINAR DECKS — PHONE REMOTE PANEL (top of the deck page's Ready check tab)
   ----------------------------------------------------------------------------
   Start a remote, show its code in large letters, and a live status over a
   watch-only socket (it sees who is there, and never receives commands): the
   present mode and presenter view windows are the ones the phone moves.
   A remote already stored in this browser and still alive shows its code
   instead of making a new one. "New code" replaces it; "End remote" ends it.
   ========================================================================== */

const STATUS = {
  idle: ['idle', ''],
  connecting: ['idle', 'Connecting'],
  waiting: ['warn', 'Waiting for the phone'],
  linked: ['good', 'Phone linked'],
  offline: ['warn', "Can't reach the remote service: retrying"],
  ended: ['idle', 'Remote ended'],
};

export default function RemotePanel({ deck }) {
  const slug = deck.slug;
  const [session, setSession] = useState(() => readSession('screen', slug));
  const [live, setLive] = useState({ status: 'idle', presence: null });
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  // Another tab started, renewed or ended the remote: show what is stored now.
  useEffect(() => {
    const key = sessionKeyFor('screen', slug);
    const onStorage = (e) => {
      if (e.key !== key) return;
      const s = readSession('screen', slug);
      setSession((cur) => (cur?.code === s?.code && cur?.token === s?.token ? cur : s));
      if (s) setNote('');
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [slug]);

  useEffect(() => {
    if (!session) return undefined;
    const link = createLink({
      code: session.code,
      token: session.token,
      role: 'screen',
      watch: true,
      onSession: (s) => writeSession('screen', slug, s),
      onStatus: (status, { presence, reason }) => {
        if (status === 'ended') {
          clearSession('screen', slug, session.code);
          setSession(null);
          setLive({ status: 'idle', presence: null });
          setNote(reason === 'auth' ? messageFor({ reason }) : 'The last remote has ended. Start a new one.');
          return;
        }
        setLive({ status, presence });
      },
    });
    link.start();
    return () => link.stop();
  }, [session, slug]);

  const start = useCallback(async () => {
    setBusy(true);
    setNote('');
    const old = session; // the remote this panel shows, never one another tab made
    const r = await remoteApi.create(slug);
    setBusy(false);
    if (!r.ok) {
      setNote(messageFor(r));
      return;
    }
    const s = { code: r.data.code, token: r.data.token };
    writeSession('screen', slug, s);
    setLive({ status: 'connecting', presence: null });
    setSession(s);
    // "New code": the old room is ended so no phone stays linked to it.
    if (old && old.code !== s.code) remoteApi.end(old.code, old.token);
  }, [slug, session]);

  const end = useCallback(async () => {
    const s = session;
    if (s) clearSession('screen', slug, s.code);
    setSession(null);
    setLive({ status: 'idle', presence: null });
    setNote('Remote ended.');
    if (s) await remoteApi.end(s.code, s.token);
  }, [slug, session]);

  const [tone, text] = STATUS[live.status] ?? STATUS.idle;
  const p = live.presence;
  const phones = p?.phones ?? 0;

  return (
    <section className="sd-remote" aria-label="Phone remote" data-remote={session ? live.status : 'off'}>
      <h3 className="sd-remote__title">Phone remote</h3>
      {!session && (
        <>
          <p className="sd-remote__help">
            Links the phone script to this laptop: Next on the phone moves the slides in Present or the presenter view,
            and the phone follows the slide on screen. The laptop&apos;s keys and clicker always work as well.
          </p>
          <button type="button" className="sd-btn sd-btn--solid" onClick={start} disabled={busy}>
            {busy ? 'Starting' : 'Start phone remote'}
          </button>
        </>
      )}
      {session && (
        <div className="sd-remote__live">
          <p className="sd-remote__code" aria-label={`Code ${session.code.split('').join(' ')}`}>{session.code}</p>
          <div className="sd-remote__side">
            <p className={`sd-remote__status is-${tone}`} role="status">
              <i aria-hidden="true" />
              {live.status === 'linked' && phones > 1 ? `${phones} phones linked` : text}
            </p>
            {(live.status === 'linked' || live.status === 'waiting') && (
              <p className="sd-remote__sub">
                {p?.screens ? 'Presenting: the phone moves the slides.' : 'Not presenting yet: open Present or the presenter view.'}
              </p>
            )}
            <p className="sd-remote__help">On the phone: Seminar decks, Join presentation, type the code.</p>
            <div className="sd-remote__actions">
              <button type="button" className="sd-btn" onClick={start} disabled={busy}>New code</button>
              <button type="button" className="sd-btn sd-btn--ghost" onClick={end}>End remote</button>
            </div>
          </div>
        </div>
      )}
      {note && <p className="sd-remote__note" role="status">{note}</p>}
    </section>
  );
}
