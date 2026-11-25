/* Capture's optional layout step for old photos: "Help Claude place your photos". Skip (the render works it out from
   the photos alone) or sketch it: the layout + viewpoint editor (capture/layout/LayoutEditor.jsx, its own chunk).
   A room of a whole place whose sketch has a rectangle for it is offered that as the starting outline. */

import { Suspense, lazy } from 'react';
import { COPY } from '../copy.js';
import { useMedia } from '../lib/useMedia.js';

const LayoutEditor = lazy(() => import('./layout/LayoutEditor.jsx'));

export default function StepLayout({ choice, value, photos, start, onChoice, onChange }) {
  const f = COPY.freeform;
  const narrow = useMedia('(max-width: 819px)');
  const views = value?.views?.length || 0;
  return (
    <div className="mr-stepbody mr-steplayout" data-mr="layout-step">
      <h2 className="mr-step-title">{f.layoutTitle}</h2>
      <p className="mr-oldphotos__lede">{f.layoutLede}</p>
      <div className="mr-seg mr-steplayout__choice" role="group" aria-label={f.layoutTitle}>
        <button type="button" aria-pressed={choice !== 'sketch'} onClick={() => onChoice('skip')} data-mr="layout-skip">
          {f.skip}
        </button>
        <button type="button" aria-pressed={choice === 'sketch'} onClick={() => onChoice('sketch')} data-mr="layout-sketch">
          {f.sketch}
        </button>
      </div>
      {choice === 'sketch' ? (
        <>
          {start && !value?.layout && <p className="mr-field-hint">{f.startFromPlace}</p>}
          <Suspense fallback={<p className="mr-state-body">{COPY.app.loading}</p>}>
            <LayoutEditor value={value} photos={photos} start={start} onChange={onChange} compact={narrow} />
          </Suspense>
        </>
      ) : (
        (views > 0 || value?.layout) && (
          <p className="mr-dot" data-tone="ok">
            {f.sketched(views, Boolean(value?.layout))}
          </p>
        )
      )}
    </div>
  );
}
