/* Capture's photo step for OLD photos (capture.mode = 'freeform', CONTRACTS.md 8): no shot guide, any order, up to
   40, "Add from library" first (these are photos he already has), an optional caption under each ("from the bed").
   The photos keep the order they were added in; they're numbered when the spot is saved. */

import { COPY } from '../copy.js';
import { pad2 } from '../lib/format.js';
import { MAX_FREEFORM_PHOTOS, MIN_FREEFORM_PHOTOS } from './freeform.js';

const Camera = () => (
  <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
    <path d="M3 6.5h3l1.4-2h5.2L14 6.5h3v9.5H3z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    <circle cx="10" cy="11" r="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

export default function StepPhotosFreeform({ photos, queue, captions, onCaption, onRemove }) {
  const c = COPY.capture;
  const f = COPY.freeform;
  const taken = photos.length;
  const full = taken >= MAX_FREEFORM_PHOTOS;
  const locked = full || queue.busy;
  const pick = (e) => {
    queue.addFiles(e.target.files);
    e.target.value = '';
  };

  return (
    <div className="mr-stepbody mr-shoot mr-oldphotos" data-mr="freeform-photos">
      <h2 className="mr-step-title">{f.photosTitle}</h2>
      <p className="mr-oldphotos__lede">{f.photosLede}</p>

      <div className="mr-photo-actions">
        <label className="mr-btn mr-btn--primary mr-btn--lg mr-filebtn" aria-disabled={locked || undefined}>
          {c.fromLibrary}
          <input type="file" accept="image/*" multiple className="mr-visually-hidden" disabled={locked} onChange={pick} data-mr="library-input" />
        </label>
        <label className="mr-btn mr-btn--lg mr-filebtn" aria-disabled={locked || undefined}>
          <Camera />
          {c.takePhoto}
          <input type="file" accept="image/*" multiple capture="environment" className="mr-visually-hidden" disabled={locked} onChange={pick} data-mr="photo-input" />
        </label>
      </div>

      <p className="mr-photo-status" aria-live="polite" data-mr="photo-status">
        {queue.progress ? (
          <span className="mr-processing">{c.processing(queue.progress.i, queue.progress.n)}</span>
        ) : (
          <span className="mr-dot" data-tone={taken >= MIN_FREEFORM_PHOTOS ? 'ok' : 'idle'}>
            {f.count(taken)}
            {full ? ` · ${f.full}` : taken < MIN_FREEFORM_PHOTOS ? ` · ${f.need}` : ''}
          </span>
        )}
      </p>
      {queue.errors.map((name) => (
        <p key={name} className="mr-msg" data-tone="danger">
          {c.photoError(name)}
        </p>
      ))}
      {queue.trimmed > 0 && <p className="mr-msg">{f.trimmed(queue.trimmed)}</p>}

      {taken > 0 && (
        <ol className="mr-oldphotos__grid">
          {photos.map((p, i) => (
            <li key={p.id} className="mr-oldphotos__item" data-mr="photo-thumb" data-n={i + 1}>
              <div className="mr-thumb">
                <img src={p.url} alt="" />
                <span className="mr-thumb-n">{pad2(i + 1)}</span>
                <button type="button" className="mr-thumb-x" onClick={() => onRemove(p)} aria-label={c.removePhoto(i + 1)}>
                  <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
                    <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
              <input
                className="mr-input mr-oldphotos__caption"
                type="text"
                value={captions[p.id] || ''}
                maxLength={120}
                placeholder={f.captionPlaceholder}
                aria-label={f.captionLabel(i + 1)}
                autoComplete="off"
                enterKeyHint="done"
                onChange={(e) => onCaption(p.id, e.target.value)}
                data-mr="photo-caption"
              />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
