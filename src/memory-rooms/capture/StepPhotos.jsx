import { COPY } from '../copy.js';
import { pad2 } from '../lib/format.js';
import ShotGuide from './ShotGuide.jsx';
import { MAX_PHOTOS, MIN_PHOTOS } from './useDraft.js';

const Camera = () => (
  <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
    <path d="M3 6.5h3l1.4-2h5.2L14 6.5h3v9.5H3z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    <circle cx="10" cy="11" r="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

export default function StepPhotos({ kind, photos, queue, onRemove }) {
  const c = COPY.capture;
  const shots = c.shots[kind] || c.shots.interior;
  const taken = photos.length;
  const guided = taken < shots.length;
  const shot = guided ? shots[taken] : c.shots.extra;
  const full = taken >= MAX_PHOTOS;
  const locked = full || queue.busy;

  const pick = (e) => {
    const files = e.target.files;
    queue.addFiles(files);
    e.target.value = '';
  };

  let status = c.photoCount(taken);
  if (full) status += ` · ${c.photoFull}`;
  else status += ` · ${taken < MIN_PHOTOS ? c.photoNeed(MIN_PHOTOS - taken) : c.photoEnough}`;

  return (
    <div className="mr-stepbody mr-shoot">
      <div className="mr-shot" data-done={guided ? undefined : ''}>
        <ShotGuide kind={kind} next={taken} />
        <div className="mr-shot-text">
          <p className="mr-label">
            {taken < MIN_PHOTOS
              ? c.shotOf(taken + 1, MIN_PHOTOS)
              : guided
                ? c.shotOptional(taken + 1)
                : c.extraOf(Math.min(taken + 1, MAX_PHOTOS), MAX_PHOTOS)}
          </p>
          <p className="mr-shot-tag">{shot.tag}</p>
          <p className="mr-shot-instr">{shot.text}</p>
        </div>
      </div>

      <div className="mr-photo-actions">
        <label className="mr-btn mr-btn--primary mr-btn--lg mr-filebtn" aria-disabled={locked || undefined}>
          <Camera />
          {c.takePhoto}
          <input
            type="file"
            accept="image/*"
            multiple
            capture="environment"
            className="mr-visually-hidden"
            disabled={locked}
            onChange={pick}
            data-mr="photo-input"
          />
        </label>
        <label className="mr-btn mr-btn--lg mr-filebtn" aria-disabled={locked || undefined}>
          {c.fromLibrary}
          <input type="file" accept="image/*" multiple className="mr-visually-hidden" disabled={locked} onChange={pick} data-mr="library-input" />
        </label>
      </div>

      <p className="mr-photo-status" aria-live="polite" data-mr="photo-status">
        {queue.progress ? (
          <span className="mr-processing">{c.processing(queue.progress.i, queue.progress.n)}</span>
        ) : (
          <span className="mr-dot" data-tone={taken >= MIN_PHOTOS ? 'ok' : 'idle'}>
            {status}
          </span>
        )}
      </p>
      {queue.errors.map((name) => (
        <p key={name} className="mr-msg" data-tone="danger">
          {c.photoError(name)}
        </p>
      ))}
      {queue.trimmed > 0 && <p className="mr-msg">{c.photoTrimmed(queue.trimmed)}</p>}

      {taken > 0 && (
        <ol className="mr-thumbs">
          {photos.map((p, i) => (
            <li key={p.id} className="mr-thumb" data-mr="photo-thumb" data-n={i + 1}>
              <img src={p.url} alt="" />
              <span className="mr-thumb-n">{pad2(i + 1)}</span>
              <button type="button" className="mr-thumb-x" onClick={() => onRemove(p)} aria-label={c.removePhoto(i + 1)}>
                <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
                  <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
            </li>
          ))}
        </ol>
      )}

      <p className="mr-tip">
        <span className="mr-label">{c.tipLabel}</span>
        <span>
          {c.tip} <span className="mr-tip-why">{c.tipWhy}</span>
        </span>
      </p>
    </div>
  );
}
