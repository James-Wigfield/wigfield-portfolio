/* The spot page's info panel: what the place is, the Model/Scan toggle, the
   meta and the photo strip. (Viewpoints + the blend slider live on the stage,
   in StageBar.) Layout only; the page passes the viewer in. */

import { Suspense, lazy, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { COPY } from '../../copy.js';
import { mediaOf } from '../../lib/api.js';
import { clearFlash, peekFlash } from '../../lib/flash.js';
import { paths } from '../../routes.js';
import { tripDayOf } from '../../lib/trip.js';
import { usePlaceTitle } from '../../lib/places.js';
import { personName } from '../../lib/spots.js';
import { useViewerState } from '../../viewer/useViewer.js';
import { ModeToggle } from '../../viewer/ViewerControls.jsx';
import PhotoStrip from './PhotoStrip.jsx';

// AR is its own chunk (and pulls the USDZ exporter / WebXR / QR code only on demand).
const ArEntry = lazy(() => import('../../ar/ArEntry.jsx'));
// "Walk in" + who's in the room now (its own small chunk; the walk page itself is another).
const WalkEntry = lazy(() => import('../../walk/WalkEntry.jsx'));

function statusLine(spot, stage) {
  const lines = COPY.spot.lines;
  if (stage === 'photos') return lines.noScene;
  if (stage === 'preview') return spot.status === 'captured' ? lines.captured : lines.modelling;
  return null;
}

export default function SpotPanel({ spot, stage, photos, viewer, activePhoto, onOpenPhoto, sheet = null, panelRef = null }) {
  const copy = COPY.spot;
  const vstate = useViewerState(viewer);
  // a room of a whole place links back to it
  const placeTitle = usePlaceTitle(spot.buildingId || null);
  const hasScan = mediaOf(spot, 'scan').length > 0;
  const line = statusLine(spot, stage);
  const has3d = stage === 'model' || stage === 'preview';
  const showControls = has3d && hasScan;
  // "Saved" once, right after the edit page saved this spot (lib/flash.js).
  const [saved] = useState(() => ({ id: spot.id, on: peekFlash(`saved:${spot.id}`) }));
  useEffect(() => () => clearFlash(`saved:${spot.id}`), [spot.id]);
  // ?ar=1 (the desktop's QR code) opens "See it in your space" straight away.
  const [params] = useSearchParams();
  const arOpen = params.get('ar') === '1';
  const day = tripDayOf(spot);

  return (
    <aside className="mr-spot__panel" data-mr="spot-panel" ref={panelRef}>
      {sheet && (
        <button type="button" className="mr-sheet-handle" aria-expanded={sheet.open} onClick={sheet.toggle} data-mr="sheet-handle">
          <span className="mr-sheet-handle__grip" aria-hidden="true" />
          <span className="mr-label">{sheet.open ? copy.sheetLess : copy.sheetMore}</span>
        </button>
      )}
      <header className="mr-spot__head">
        <div className="mr-spot__eyebrow">
          <span className="mr-label">{COPY.app.kinds[spot.kind] || spot.kind}</span>
          <span className="mr-dot mr-label" data-status={spot.status}>
            {COPY.app.status[spot.status] || spot.status}
          </span>
          <Link to={paths.edit(spot.id)} state={{ from: 'spot' }} className="mr-linkbtn mr-spot__edit" aria-label={COPY.edit.linkLabel(spot.title)} data-mr="spot-edit">
            {COPY.edit.link}
          </Link>
        </div>
        <h1 className="mr-spot__title">{spot.title}</h1>
        {spot.note && (
          <blockquote className="mr-spot__note mr-quote">
            <p>{copy.quote(spot.note)}</p>
            <cite className="mr-label">{copy.quoteBy(personName(spot.createdBy) || '')}</cite>
          </blockquote>
        )}
        {line && <p className="mr-spot__line">{line}</p>}
        {saved.on && saved.id === spot.id && (
          <p className="mr-msg mr-spot__saved" role="status" data-mr="spot-saved">
            {COPY.edit.savedFlash}
          </p>
        )}
      </header>

      {showControls && (
        <section className="mr-spot__controls">
          <ModeToggle mode={vstate.mode} disabled={!viewer} onChange={(m) => viewer?.setMode(m)} />
        </section>
      )}

      {stage === 'model' && (
        <Suspense fallback={null}>
          <WalkEntry key={`walk-${spot.id}`} spot={spot} dive={viewer ? () => viewer.diveIn() : null} />
          <ArEntry key={spot.id} spot={spot} viewer={viewer} startOpen={arOpen} />
        </Suspense>
      )}

      <dl className="mr-meta">
        <div>
          <dt className="mr-label">{copy.meta.by}</dt>
          <dd>{COPY.app.people[spot.createdBy] || spot.createdBy || '–'}</dd>
        </div>
        <div>
          <dt className="mr-label">{copy.meta.place}</dt>
          <dd>{spot.placeLabel || copy.noPlace}</dd>
        </div>
        {spot.buildingId && (
          <div data-mr="part-of">
            <dt className="mr-label">{copy.meta.partOf}</dt>
            <dd>
              <Link to={paths.place(spot.buildingId)}>{placeTitle || COPY.place.label}</Link>
            </dd>
          </div>
        )}
        <div>
          <dt className="mr-label">{copy.meta.date}</dt>
          <dd>{copy.date(spot.capturedAt) || '–'}</dd>
        </div>
        {day && (
          <div>
            <dt className="mr-label">{copy.meta.day}</dt>
            <dd data-mr="trip-day">{copy.tripDay(day)}</dd>
          </div>
        )}
      </dl>

      <PhotoStrip photos={photos} title={spot.title} active={activePhoto} onOpen={onOpenPhoto} />
    </aside>
  );
}
