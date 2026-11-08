/* /memories/:spotId — one place from the trip. The 3D room (or, before it
   exists, the photos) is the hero; a quiet panel frames it.

   The viewer stays mounted while moving between 3D spots (it just loads the
   next one), so one WebGL context serves the whole visit. */

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { COPY } from '../copy.js';
import RoomViewer from '../viewer/RoomViewer.jsx';
import { StageBar } from '../viewer/ViewerControls.jsx';
import { useViewpoint } from '../viewer/useViewer.js';
import Lightbox from './spot/Lightbox.jsx';
import PageMessage from './spot/PageMessage.jsx';
import PhotoStage from './spot/PhotoStage.jsx';
import SpotPanel from './spot/SpotPanel.jsx';
import StageNav from './spot/StageNav.jsx';
import { spotPhotos, stageKind, viewerSource } from './spot/photos.js';
import '../viewer/viewer.css';

export default function SpotPage() {
  const { spotId } = useParams();
  const [attempt, setAttempt] = useState(0);
  const [res, setRes] = useState(null);
  const key = `${spotId}#${attempt}`;

  useEffect(() => {
    let alive = true;
    api.getSpot(spotId).then(
      (spot) => alive && setRes({ key, kind: spot && !spot.deletedAt ? 'ok' : 'missing', spot }),
      (error) => alive && setRes({ key, kind: error?.status === 404 || error?.status === 400 ? 'missing' : 'error', error }),
    );
    return () => {
      alive = false;
    };
  }, [spotId, attempt, key]);

  const current = res?.key === key ? res : null;
  const copy = COPY.spot;

  if (current?.kind === 'missing') {
    return <PageMessage dataState="missing" label={copy.missingLabel} title={copy.missingTitle} body={copy.missingBody} />;
  }
  if (current?.kind === 'error') {
    return (
      <PageMessage
        dataState="error"
        label={copy.errorLabel}
        title={copy.errorTitle}
        body={current.error?.message === 'offline' ? copy.errorOffline : null}
        retryLabel={copy.retry}
        onRetry={() => setAttempt((a) => a + 1)}
      />
    );
  }

  const spot = current?.kind === 'ok' ? current.spot : null;
  // While the next spot loads, keep the viewer if the last one had 3D.
  const previous = res?.kind === 'ok' ? res.spot : null;
  const stage = spot ? stageKind(spot) : previous && stageKind(previous) !== 'photos' ? 'loading3d' : 'loading';
  return <SpotView spot={spot} stage={stage} />;
}

function SpotView({ spot, stage }) {
  const [viewer, setViewer] = useState(null);
  const [lightbox, setLightbox] = useState(null); // { id, index }
  const [stageIndex, setStageIndex] = useState({ id: null, index: 0 });
  const vp = useViewpoint(viewer);

  const photos = useMemo(() => (spot ? spotPhotos(spot) : []), [spot]);
  const source = useMemo(() => (spot ? viewerSource(spot) : null), [spot]);
  const cameras = useMemo(() => [...(spot?.scene?.cameras || [])].sort((a, b) => a.photo - b.photo), [spot]);
  const thumbs = useMemo(() => Object.fromEntries(photos.map((p) => [p.photo, p.thumb])), [photos]);
  const showViewer = stage === 'model' || stage === 'preview' || stage === 'loading3d';
  const lightboxIndex = spot && lightbox?.id === spot.id ? lightbox.index : null;
  const photoIndex = spot && stageIndex.id === spot.id ? stageIndex.index : 0;

  useEffect(() => {
    if (spot) document.title = `${spot.title} · ${COPY.app.name}`;
  }, [spot]);

  // Escape leaves a photo viewpoint (the lightbox handles its own Escape).
  useEffect(() => {
    if (!viewer || vp.photo == null || lightboxIndex != null) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') viewer.home();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [viewer, vp.photo, lightboxIndex]);

  const openPhoto = (index) => spot && setLightbox({ id: spot.id, index });

  return (
    <div className="mr-spot" data-stage={stage}>
      <section className="mr-spot__stage">
        {showViewer && (
          <RoomViewer
            source={source}
            onViewer={setViewer}
            label={spot ? COPY.viewer.label(spot.title) : undefined}
            bar={spot ? <StageBar viewer={viewer} cameras={cameras} thumbs={thumbs} /> : null}
          />
        )}
        {stage === 'photos' && spot && (
          <PhotoStage
            photos={photos}
            index={photoIndex}
            title={spot.title}
            onIndex={(index) => setStageIndex({ id: spot.id, index })}
            onOpen={openPhoto}
          />
        )}
        {stage === 'loading' && <div className="mr-spot__blank" role="status" aria-label={COPY.spot.loading} />}
        <StageNav group={spot?.frameGroup} groupLabel={spot?.frameGroup ? COPY.group.title(spot.frameGroup) : ''} />
      </section>

      {spot ? (
        <SpotPanel
          spot={spot}
          stage={stage}
          photos={photos}
          viewer={showViewer ? viewer : null}
          activePhoto={stage === 'photos' ? photoIndex : lightboxIndex}
          onOpenPhoto={openPhoto}
        />
      ) : (
        <aside className="mr-spot__panel mr-spot__panel--loading">
          <span className="mr-label">{COPY.spot.loading}</span>
        </aside>
      )}

      {spot && lightboxIndex != null && photos.length > 0 && (
        <Lightbox
          photos={photos}
          index={Math.min(lightboxIndex, photos.length - 1)}
          title={spot.title}
          onIndex={(index) => setLightbox({ id: spot.id, index })}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  );
}
