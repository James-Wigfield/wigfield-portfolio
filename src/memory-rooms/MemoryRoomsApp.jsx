/* Memory Rooms entry (lazy-loaded from src/App.jsx). `page` picks the screen:
   map | new | spot | group.

   The shell: password gate (once per device) → who-picker (once per device, for
   the map and capture pages) → slim header + outbox line + the page. The viewer
   agent owns pages/SpotPage.jsx and pages/GroupPage.jsx; the header height is
   exposed as --mr-header-h for full-height layouts. */

import './memory-rooms.css';
import { Suspense, lazy, useEffect, useState } from 'react';
import { COPY } from './copy.js';
import { getToken, setToken } from './lib/api.js';
import { onUnauthorized } from './lib/auth.js';
import { resumeOutbox, startOutbox } from './lib/outbox.js';
import { readWho, writeWho } from './lib/storage.js';
import CapturePage from './pages/CapturePage.jsx';
import MapPage from './pages/MapPage.jsx';
import Gate from './shell/Gate.jsx';
import Header from './shell/Header.jsx';
import OutboxStatus from './shell/OutboxStatus.jsx';
import PageBoundary from './shell/PageBoundary.jsx';
import { ShellContext } from './shell/ShellContext.js';
import WhoPicker from './shell/WhoPicker.jsx';

// The 3D pages load on demand, so the map and the capture flow (often on a weak
// phone signal) never wait for three.js, and a viewer problem can't take them down.
const SpotPage = lazy(() => import('./pages/SpotPage.jsx'));
const GroupPage = lazy(() => import('./pages/GroupPage.jsx'));

/** Theme background on <body>, the tab title, and the browser chrome colour while mounted. */
function usePageTakeover(page, authed) {
  const [prevTitle] = useState(() => document.title);

  useEffect(() => {
    const html = document.documentElement;
    html.classList.add('mr-active');
    const metas = Array.from(document.querySelectorAll('meta[name="theme-color"]'));
    const prev = metas.map((m) => m.content);
    const bg = getComputedStyle(html).getPropertyValue('--mr-bg').trim();
    if (bg) metas.forEach((m) => (m.content = bg));
    return () => {
      html.classList.remove('mr-active');
      document.title = prevTitle;
      metas.forEach((m, i) => (m.content = prev[i] ?? m.content));
    };
  }, [prevTitle]);

  // Spot and group pages set their own titles.
  useEffect(() => {
    if (!authed || page === 'map') document.title = COPY.app.name;
    else if (page === 'new') document.title = `${COPY.capture.pageTitle} · ${COPY.app.name}`;
  }, [page, authed]);
}

/** Production only: an offline shell so /memories/new opens with no signal (public/memories-sw.js). */
function useOfflineShell() {
  useEffect(() => {
    if (import.meta.env.DEV || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker
      .register('/memories-sw.js', { scope: '/memories' })
      .then(() => navigator.serviceWorker.ready)
      .then((reg) => {
        // Hand over the files this page loaded before the worker existed: this lazy
        // chunk itself, its CSS/preloads (link tags) and anything resource timing saw.
        const urls = new Set([import.meta.url]);
        document.querySelectorAll('link[href], script[src]').forEach((el) => urls.add(el.href || el.src));
        performance.getEntriesByType('resource').forEach((e) => urls.add(e.name));
        const own = [...urls].filter((u) => u.startsWith(`${location.origin}/assets/`));
        reg.active?.postMessage({ type: 'mr-precache', urls: own });
      })
      .catch(() => {});
  }, []);
}

export default function MemoryRoomsApp({ page }) {
  const [authed, setAuthed] = useState(() => Boolean(getToken()));
  const [expired, setExpired] = useState(false);
  const [who, setWho] = useState(() => readWho());
  const [choosing, setChoosing] = useState(false);
  usePageTakeover(page, authed);
  useOfflineShell();

  // A 401 anywhere: forget the password, show the gate. The outbox keeps everything.
  useEffect(
    () =>
      onUnauthorized(() => {
        setToken('');
        setAuthed(false);
        setExpired(true);
      }),
    [],
  );

  useEffect(() => (authed ? startOutbox() : undefined), [authed]);

  const enter = () => {
    setAuthed(true);
    setExpired(false);
    resumeOutbox();
  };
  const pickWho = (p) => {
    writeWho(p);
    setWho(p);
    setChoosing(false);
  };
  const changeWho = () => setChoosing(true);

  const needsWho = page === 'map' || page === 'new';
  const fixed = authed && !choosing && (page === 'map' || page === 'new');

  let body;
  if (!authed) {
    body = <Gate onEnter={enter} expired={expired} />;
  } else if (choosing || (needsWho && !who)) {
    body = <WhoPicker current={who} onPick={pickWho} onCancel={choosing && who ? () => setChoosing(false) : undefined} />;
  } else {
    body = (
      <>
        <Header page={page} who={who} onChangeWho={changeWho} />
        <OutboxStatus />
        <div className="mr-main">
          <PageBoundary key={page}>
            {page === 'map' && <MapPage />}
            {page === 'new' && <CapturePage />}
            {(page === 'spot' || page === 'group') && (
              <Suspense fallback={<p className="mr-state mr-state-body">{COPY.app.loading}</p>}>
                {page === 'spot' ? <SpotPage /> : <GroupPage />}
              </Suspense>
            )}
          </PageBoundary>
        </div>
      </>
    );
  }

  return (
    <ShellContext.Provider value={{ who, changeWho }}>
      <div className="mr" data-page={page} data-layout={fixed ? 'fixed' : 'flow'}>
        {body}
      </div>
    </ShellContext.Provider>
  );
}
