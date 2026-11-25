/* /dreams: the Dream Corridor (framework Change C). One door per dream, in the order they
   happened; the viewer (viewer/DreamStage.jsx) draws everything, including every private
   word, live in the place. This page only fetches the lean list, hands it over, and keeps
   two quiet links in one corner: "new dream" and "list". No HUD.

   Flags: ?at=<id> start at that door · ?enter=1 (with at) walk straight through it ·
   ?autopilot=1 play the entered dream on autopilot · ?list=1 the plain list.

   With reduced motion (and no explicit walk: ?walk=1, ?at or ?enter) or without WebGL, the
   list shows instead, with a quiet "walk the corridor anyway". */

import { Suspense, lazy, useCallback, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { COPY } from '../copy.js';
import Boundary from '../components/Boundary.jsx';
import { api } from '../lib/api.js';
import { confirmAuth } from '../lib/auth.js';
import { canUseWebGL, useDreamList, useReducedMotion } from '../lib/hooks.js';
import { NEW_PATH, listUrl, readFlags } from '../routes.js';
import { unlockAudio } from '../viewer/audio.js';
import ListPage from './ListPage.jsx';

// three.js and the stage load on demand: capture (often on a weak 6 am signal) never waits for them.
const DreamStage = lazy(() => import('../viewer/DreamStage.jsx'));

export default function CorridorPage() {
  const [params] = useSearchParams();
  const flags = readFlags(params);
  const reduced = useReducedMotion();
  const [gl] = useState(canUseWebGL);

  if (flags.list) return <ListPage />;
  const intent = flags.walk || flags.enter || Boolean(flags.at);
  if (!gl && !flags.walk) return <ListPage reason="webgl" />;
  if (reduced && !intent) return <ListPage reason="motion" />;
  return <CorridorStage flags={flags} />;
}

/** A dream to walk into: the row's world, its signed model URL, its stills and the mood. */
async function loadDream(id) {
  try {
    const row = await api.get(id);
    return { world: row.world, model_url: row.files?.model_url || null, stills: row.files?.stills || [], mood: row.dream?.mood || null };
  } catch (err) {
    await confirmAuth(err);
    throw err;
  }
}

function CorridorStage({ flags }) {
  const { rows, error, reload } = useDreamList();
  const [stage, setStage] = useState('loading');
  const unlocked = useRef(false);

  // The first tap (or key) in the corridor unlocks audio for the whole session (iOS needs a gesture),
  // so a dream entered from here needs no Enter tap.
  const onGesture = useCallback(() => {
    if (unlocked.current) return;
    unlocked.current = true;
    unlockAudio();
  }, []);

  return (
    <main className="dr-corridor" data-dr="corridor" data-state={stage} onPointerDownCapture={onGesture} onKeyDownCapture={onGesture}>
      {rows && (
        <Boundary
          fallback={
            <p className="dr-corridor-msg dr-dot" data-status="failed" data-dr="corridor-error">
              <i aria-hidden="true" />
              {COPY.corridor.error}
            </p>
          }
        >
          <Suspense fallback={null}>
            <DreamStage
              mode="corridor"
              rows={rows}
              at={flags.at}
              enter={flags.enter && flags.at ? flags.at : null}
              autopilot={flags.autopilot}
              loadDream={loadDream}
              onState={setStage}
            />
          </Suspense>
        </Boundary>
      )}
      {error && (
        <p className="dr-corridor-msg dr-dot" data-status="failed" data-dr="corridor-error">
          <i aria-hidden="true" />
          {COPY.corridor.error}
          <button type="button" className="dr-link" onClick={reload}>
            {COPY.corridor.retry}
          </button>
        </p>
      )}
      <nav className="dr-corner" aria-label={COPY.app.name} data-dr="corner">
        <Link className="dr-corner-link" to={NEW_PATH} data-dr="corner-new">
          {COPY.corridor.newDream}
        </Link>
        <Link className="dr-corner-link" to={listUrl()} data-dr="corner-list">
          {COPY.corridor.list}
        </Link>
      </nav>
    </main>
  );
}
