/* The stage for a spot with no 3D yet: its photos are the hero. */

import { COPY } from '../../copy.js';
import { Chevron } from './icons.jsx';

export default function PhotoStage({ photos, index, title, onIndex, onOpen, children }) {
  const copy = COPY.spot;
  const p = photos[index];
  const n = photos.length;
  return (
    <div className="mr-photostage">
      {p ? (
        <button type="button" className="mr-photostage__photo" aria-label={copy.openPhoto(p.photo)} onClick={() => onOpen(index)}>
          <img key={p.url} src={p.url} alt={copy.photoAlt(p.photo, title)} decoding="async" draggable="false" />
        </button>
      ) : (
        <p className="mr-photostage__empty mr-label">{copy.noPhotos}</p>
      )}
      {n > 1 && (
        <div className="mr-photostage__nav">
          <button type="button" className="mr-icon-btn" aria-label={copy.stagePrev} onClick={() => onIndex((index - 1 + n) % n)}>
            <Chevron dir="left" />
          </button>
          <span className="mr-label">{COPY.spot.lightbox.counter(index + 1, n)}</span>
          <button type="button" className="mr-icon-btn" aria-label={copy.stageNext} onClick={() => onIndex((index + 1) % n)}>
            <Chevron dir="right" />
          </button>
        </div>
      )}
      {children}
    </div>
  );
}
