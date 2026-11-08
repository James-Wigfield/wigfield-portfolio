/* The spot's photos as a strip of thumbnails; tapping one opens the lightbox. */

import { COPY } from '../../copy.js';

export default function PhotoStrip({ photos, title, active, onOpen }) {
  const copy = COPY.spot;
  return (
    <section className="mr-photos" aria-label={copy.photos}>
      <header className="mr-photos__head">
        <span className="mr-label">{copy.photos}</span>
        <span className="mr-label mr-photos__count">{photos.length ? copy.photoCount(photos.length) : ''}</span>
      </header>
      {photos.length ? (
        <div className="mr-strip" data-mr="photo-strip">
          {photos.map((p, i) => (
            <button
              key={p.photo}
              type="button"
              className="mr-strip__item"
              aria-current={active === i ? 'true' : undefined}
              aria-label={copy.openPhoto(p.photo)}
              onClick={() => onOpen(i)}
            >
              <img src={p.thumb} alt={copy.photoAlt(p.photo, title)} loading="lazy" decoding="async" draggable="false" />
            </button>
          ))}
        </div>
      ) : (
        <p className="mr-photos__empty">{copy.noPhotos}</p>
      )}
    </section>
  );
}
