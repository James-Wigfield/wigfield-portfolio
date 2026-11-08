/* The spot page's info panel: what the place is, the Model/Scan toggle, the
   meta and the photo strip. (Viewpoints + the blend slider live on the stage,
   in StageBar.) Layout only; the page passes the viewer in. */

import { COPY } from '../../copy.js';
import { mediaOf } from '../../lib/api.js';
import { useViewerState } from '../../viewer/useViewer.js';
import { ModeToggle } from '../../viewer/ViewerControls.jsx';
import PhotoStrip from './PhotoStrip.jsx';

function statusLine(spot, stage) {
  const lines = COPY.spot.lines;
  if (stage === 'photos') return lines.noScene;
  if (stage === 'preview') return spot.status === 'captured' ? lines.captured : lines.modelling;
  return null;
}

export default function SpotPanel({ spot, stage, photos, viewer, activePhoto, onOpenPhoto }) {
  const copy = COPY.spot;
  const vstate = useViewerState(viewer);
  const hasScan = mediaOf(spot, 'scan').length > 0;
  const line = statusLine(spot, stage);
  const has3d = stage === 'model' || stage === 'preview';
  const showControls = has3d && hasScan;

  return (
    <aside className="mr-spot__panel">
      <header className="mr-spot__head">
        <div className="mr-spot__eyebrow">
          <span className="mr-label">{COPY.app.kinds[spot.kind] || spot.kind}</span>
          <span className="mr-dot mr-label" data-status={spot.status}>
            {COPY.app.status[spot.status] || spot.status}
          </span>
        </div>
        <h1 className="mr-spot__title">{spot.title}</h1>
        {spot.note && <p className="mr-spot__note">{spot.note}</p>}
        {line && <p className="mr-spot__line">{line}</p>}
      </header>

      {showControls && (
        <section className="mr-spot__controls">
          <ModeToggle mode={vstate.mode} disabled={!viewer} onChange={(m) => viewer?.setMode(m)} />
        </section>
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
        <div>
          <dt className="mr-label">{copy.meta.date}</dt>
          <dd>{copy.date(spot.capturedAt) || '–'}</dd>
        </div>
      </dl>

      <PhotoStrip photos={photos} title={spot.title} active={activePhoto} onOpen={onOpenPhoto} />
    </aside>
  );
}
