import { useState } from 'react';
import { DECK_LIST } from './decks';
import { cleanCode, messageFor, readSession, remoteApi, writeSession } from './remote';
import './remote.css';

/* ============================================================================
   SEMINAR DECKS — "JOIN PRESENTATION" (landing page, for the phone)
   ----------------------------------------------------------------------------
   Type the code shown on the laptop's Ready check tab; the phone joins the
   room, keeps its session for that deck, and opens the deck's phone script,
   linked. A failure is one plain line under the field.
   ========================================================================== */

export default function RemoteJoin({ go }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    const c = cleanCode(code);
    if (c.length !== 4) {
      setError('Codes are four letters.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      // Rejoin with this phone's token if it has been in this room before.
      const known = DECK_LIST.map((d) => readSession('phone', d.slug)).find((s) => s?.code === c);
      const r = await remoteApi.join(c, 'phone', known?.token ?? null);
      if (!r.ok) {
        setError(messageFor(r));
        setBusy(false);
        return;
      }
      if (!DECK_LIST.some((d) => d.slug === r.data.slug)) {
        setError('That code belongs to a deck this page does not have.');
        setBusy(false);
        return;
      }
      writeSession('phone', r.data.slug, { code: c, token: r.data.token });
      go(`${r.data.slug}/phone`);
    } catch {
      setError("The remote service isn't available here.");
      setBusy(false);
    }
  };

  return (
    <section className="sd-join" aria-label="Join presentation">
      <h3>Join presentation</h3>
      <p className="sd-join__help">On the phone: type the code shown on the laptop (the deck&apos;s Ready check tab).</p>
      <form className="sd-join__form" onSubmit={submit}>
        <input
          className="sd-join__code"
          aria-label="Presentation code"
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
        />
        <button type="submit" className="sd-btn sd-btn--solid" disabled={busy || code.length !== 4}>{busy ? 'Joining' : 'Join'}</button>
      </form>
      {error && <p className="sd-join__err" role="alert">{error}</p>}
    </section>
  );
}
