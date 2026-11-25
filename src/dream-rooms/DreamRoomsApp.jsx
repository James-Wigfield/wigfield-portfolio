/* Dream Rooms entry (lazy-loaded from src/App.jsx). `page` picks the screen:
     corridor  /dreams       the Dream Corridor (?list=1 the plain list)
     new       /dreams/new   capture, phone first
     dream     /dreams/:id   one dream

   The shell: the .dr root (tokens in dream-rooms.css), robots noindex while mounted, the
   password gate (no token, or the API stops accepting it), and the outbox, which runs on
   app load, on `online` and when the tab becomes visible. Every dream is private. */

import '@fontsource/space-mono/400.css';
import './dream-rooms.css';
import { useEffect, useState } from 'react';
import { COPY } from './copy.js';
import Boundary from './components/Boundary.jsx';
import { api, getToken, setToken } from './lib/api.js';
import { isAuthStatus, onUnauthorized, signalUnauthorized } from './lib/auth.js';
import { useHeadTags } from './lib/hooks.js';
import { resumeOutbox, startOutbox } from './lib/outbox.js';
import CapturePage from './pages/CapturePage.jsx';
import CorridorPage from './pages/CorridorPage.jsx';
import DreamPage from './pages/DreamPage.jsx';
import Gate from './pages/Gate.jsx';

const GROUND = '#0b0a09'; // = --dr-bg; the page behind the .dr root and the browser chrome

/** Dark ground on <html>/<body>, robots noindex, the chrome colour and the tab title while mounted. */
function useTakeover(page) {
  useHeadTags([
    { tag: 'meta', name: 'robots', content: 'noindex, nofollow' },
    { tag: 'meta', name: 'theme-color', content: GROUND },
  ]);
  useEffect(() => {
    const html = document.documentElement;
    const prevTitle = document.title;
    html.classList.add('dr-active');
    return () => {
      html.classList.remove('dr-active');
      document.title = prevTitle;
    };
  }, []);
  // Titles stay generic: a dream's title never goes into the tab or the browser history.
  useEffect(() => {
    document.title = page === 'new' ? `${COPY.app.newTitle} · ${COPY.app.name}` : COPY.app.name;
  }, [page]);
}

/** Production only: an offline shell so /dreams/new opens with no signal (public/dreams-sw.js). */
function useOfflineShell() {
  useEffect(() => {
    if (import.meta.env.DEV || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker
      .register('/dreams-sw.js', { scope: '/dreams' })
      .then(() => navigator.serviceWorker.ready)
      .then((reg) => {
        // Hand over the files this page loaded before the worker existed (this lazy chunk, its CSS).
        const urls = new Set([import.meta.url]);
        document.querySelectorAll('link[href], script[src]').forEach((el) => urls.add(el.href || el.src));
        performance.getEntriesByType('resource').forEach((e) => urls.add(e.name));
        const own = [...urls].filter((u) => u.startsWith(`${location.origin}/assets/`));
        reg.active?.postMessage({ type: 'dr-precache', urls: own });
      })
      .catch(() => {});
  }, []);
}

export default function DreamRoomsApp({ page }) {
  const [authed, setAuthed] = useState(() => Boolean(getToken()));
  const [expired, setExpired] = useState(false);
  useTakeover(page);
  useOfflineShell();

  // The password stopped working: forget it, show the gate. The outbox and the draft keep everything.
  useEffect(
    () =>
      onUnauthorized(() => {
        setToken('');
        setAuthed(false);
        setExpired(true);
      }),
    [],
  );

  // The outbox runs while a password is set (app load, `online`, visibility: lib/outbox.js).
  useEffect(() => (authed ? startOutbox() : undefined), [authed]);

  // A stored password is checked quietly in the background; with no signal it's trusted.
  useEffect(() => {
    if (!authed) return undefined;
    let alive = true;
    api.ping().catch((err) => {
      if (alive && isAuthStatus(err?.status)) signalUnauthorized();
    });
    return () => {
      alive = false;
    };
  }, [authed]);

  const enter = () => {
    setAuthed(true);
    setExpired(false);
    resumeOutbox();
  };

  return (
    <div className="dr" data-page={page} data-dr="root">
      {!authed ? (
        <Gate onEnter={enter} expired={expired} />
      ) : (
        <Boundary key={page}>
          {page === 'new' && <CapturePage />}
          {page === 'dream' && <DreamPage />}
          {page === 'corridor' && <CorridorPage />}
        </Boundary>
      )}
    </div>
  );
}
