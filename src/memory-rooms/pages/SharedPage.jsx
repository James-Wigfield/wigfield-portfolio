/* /memories/s/:token — a private share link's page. The token is the key (no password gate): it opens ONE
   place (the 3D building) or ONE room (its 3D room + photo viewpoints), read-only, from
   GET /api/memories/shared/:token. Nothing on this page links anywhere else in Memory Rooms: no header, no map,
   no "part of", no walk, rooms of a shared place don't open. Search engines are told to stay out. */

import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { COPY } from '../copy.js';
import { api, mediaOf } from '../lib/api.js';
import { formatDate } from '../lib/format.js';
import { useMedia } from '../lib/useMedia.js';
import ThemeToggle from '../shell/ThemeToggle.jsx';
import RoomViewer from '../viewer/RoomViewer.jsx';
import { useViewerState } from '../viewer/useViewer.js';
import { FurnishedToggle, PlanToggle, StageBar } from '../viewer/ViewerControls.jsx';
import TitleBlock from './spot/TitleBlock.jsx';
import { moodOf, spotPhotos, stageKind, viewerSource } from './spot/photos.js';
import '../viewer/viewer.css';

const BuildingView = lazy(() => import('./place/BuildingView.jsx'));

/** <meta name="robots" content="noindex"> while the page is open. */
function useNoIndex() {
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);
}

export default function SharedPage() {
  const { token } = useParams();
  const [attempt, setAttempt] = useState(0);
  const [res, setRes] = useState({ key: null });
  const key = `${token}#${attempt}`;
  const copy = COPY.share;
  useNoIndex();

  useEffect(() => {
    let alive = true;
    api.getShared(token).then(
      (data) => alive && setRes({ key, kind: 'ok', data }),
      (error) => alive && setRes({ key, kind: error?.status === 404 || error?.status === 400 ? 'gone' : 'error', error }),
    );
    return () => {
      alive = false;
    };
  }, [token, key]);

  const current = res.key === key ? res : null;
  const item = current?.kind === 'ok' ? current.data?.item : null;
  useEffect(() => {
    document.title = item?.title ? `${item.title} · ${COPY.app.name}` : COPY.app.name;
  }, [item?.title]);

  if (!current) {
    return (
      <main className="mr-shared" data-state="loading" data-mr="shared">
        <p className="mr-label mr-shared__loading">{copy.loading}</p>
      </main>
    );
  }
  if (current.kind !== 'ok') {
    const gone = current.kind === 'gone';
    return (
      <main className="mr-message" data-mr-page={gone ? 'missing' : 'error'} data-mr="shared">
        <div className="mr-message__inner">
          <span className="mr-label">{copy.eyebrow}</span>
          <h1 className="mr-message__title">{gone ? copy.goneTitle : copy.errorTitle}</h1>
          <p className="mr-message__body">{gone ? copy.goneBody : current.error?.message === 'offline' ? copy.offline : null}</p>
          {!gone && (
            <div className="mr-message__actions">
              <button type="button" className="mr-btn" onClick={() => setAttempt((a) => a + 1)}>
                {copy.retry}
              </button>
            </div>
          )}
        </div>
      </main>
    );
  }

  const { kind } = current.data;
  return (
    <main className="mr-shared" data-state="ok" data-kind={kind} data-mr="shared">
      <header className="mr-shared__head">
        <div className="mr-shared__eyebrow">
          <span className="mr-label">{copy.eyebrow}</span>
          <ThemeToggle />
        </div>
        <h1 className="mr-place__title">{item.title}</h1>
        <p className="mr-place__meta">{[item.placeLabel, formatDate(item.capturedAt)].filter(Boolean).join(' · ')}</p>
      </header>
      {kind === 'building' ? <SharedBuilding place={item} /> : <SharedRoom spot={item} />}
    </main>
  );
}

function SharedBuilding({ place }) {
  const narrow = useMedia('(max-width: 860px)');
  const built = Boolean(place.plan && mediaOf(place, 'model').some((m) => /^level-/.test(m.name || '')));
  if (!built) return <p className="mr-shared__note">{COPY.share.noModel}</p>;
  return (
    <Suspense fallback={<div className="mr-building mr-building--loading" />}>
      <BuildingView place={place} plan={place.plan} spots={[]} narrow={narrow} hint={COPY.share.buildingHint} />
    </Suspense>
  );
}

function SharedRoom({ spot }) {
  const [viewer, setViewer] = useState(null);
  const vstate = useViewerState(viewer);
  const narrow = useMedia('(max-width: 860px)');
  const stage = stageKind(spot);
  const source = useMemo(() => viewerSource(spot), [spot]);
  const photos = useMemo(() => spotPhotos(spot), [spot]);
  const cameras = useMemo(() => [...(spot.scene?.cameras || [])].sort((a, b) => a.photo - b.photo), [spot]);
  const thumbs = useMemo(() => Object.fromEntries(photos.map((p) => [p.photo, p.thumb])), [photos]);

  if (stage === 'photos') {
    return (
      <section className="mr-shared__photos">
        <p className="mr-shared__note">{COPY.share.noModel}</p>
        {photos.map((p) => (
          <img key={p.photo} src={p.url} alt="" loading="lazy" />
        ))}
      </section>
    );
  }
  const canPlan = vstate.state === 'ready' && vstate.canPlan;
  return (
    <section className="mr-building" data-mr="shared-room">
      <div className="mr-building__stage mr-shared__stage" data-mood={moodOf(spot)}>
        <RoomViewer
          source={source}
          onViewer={setViewer}
          label={COPY.viewer.label(spot.title)}
          bar={<StageBar viewer={viewer} cameras={cameras} thumbs={thumbs} />}
          stamp={<TitleBlock viewer={viewer} name={narrow ? null : spot.title} place={spot.placeLabel} date={formatDate(spot.capturedAt)} compact={narrow} />}
        />
      </div>
      <div className="mr-building__bar">
        {(canPlan || vstate.plan) && <PlanToggle on={Boolean(vstate.plan)} disabled={!viewer} onChange={(on) => viewer?.setPlan(on)} />}
        <div className="mr-building__toggles">
          <FurnishedToggle viewer={viewer} />
        </div>
      </div>
      <p className="mr-building__hint mr-label">{COPY.share.roomHint}</p>
    </section>
  );
}
