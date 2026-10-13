/* ============================================================================
   SEMINAR DECKS — TWO-WINDOW SYNC
   ----------------------------------------------------------------------------
   The presenter view (laptop) and the audience window (projector) share one
   talk. Messages go over a BroadcastChannel named per deck, and, as a backup
   path, by window.postMessage to the window this one opened (or its opener).
   Both paths can deliver the same message, so every message carries an id and
   repeats are dropped. Same origin only.
   ========================================================================== */

const rid = () => Math.random().toString(36).slice(2, 10);

export function createSync(slug, onMessage) {
  const name = `seminar-decks:${slug}`;
  const self = rid();
  const seen = new Set();
  const peers = new Set();
  let bc = null;
  try {
    bc = new BroadcastChannel(name);
  } catch {
    bc = null;
  }

  const handle = (data) => {
    if (!data || data.__sd !== name || data.from === self) return;
    if (seen.has(data.mid)) return;
    seen.add(data.mid);
    if (seen.size > 400) seen.delete(seen.values().next().value);
    onMessage(data);
  };

  if (bc) bc.onmessage = (e) => handle(e.data);
  const onWindowMessage = (e) => {
    if (e.origin !== window.location.origin) return;
    handle(e.data);
  };
  window.addEventListener('message', onWindowMessage);

  const post = (w, data) => {
    try {
      if (w && !w.closed) w.postMessage(data, window.location.origin);
    } catch {
      /* the other window may have navigated away */
    }
  };

  return {
    self,
    send(msg) {
      const data = { ...msg, __sd: name, from: self, mid: `${self}-${rid()}` };
      bc?.postMessage(data);
      peers.forEach((w) => post(w, data));
      if (window.opener) post(window.opener, data);
    },
    addPeer(w) {
      if (w) peers.add(w);
    },
    close() {
      if (bc) bc.close();
      window.removeEventListener('message', onWindowMessage);
    },
  };
}

/**
 * Open the audience window. The portal's sign-in lives in sessionStorage, which
 * Chrome copies into a window opened this way; it is also written into the new
 * window's about:blank document before navigating, so the audience window never
 * lands on the password gate.
 */
export function openAudienceWindow(url, name) {
  const w = window.open('', name, 'popup=yes,width=1280,height=760');
  if (!w) return null;
  try {
    const auth = window.sessionStorage.getItem('portal_auth');
    if (auth) w.sessionStorage.setItem('portal_auth', auth);
  } catch {
    /* cross-origin or storage blocked: the copied sessionStorage still applies */
  }
  try {
    if (w.location.pathname !== url) w.location.replace(url);
  } catch {
    w.location.href = url;
  }
  return w;
}
