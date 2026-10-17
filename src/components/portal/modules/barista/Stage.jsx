import { Rich } from './ui';

/* ============================================================================
   BARISTA · STAGE — the frame every scene renders in
   ----------------------------------------------------------------------------
   Accessible SVG (role="img" + <title>) on a bench background, an optional
   numbered beat legend (HTML, so it stays legible on a phone — the art
   carries matching mono numbers), and a bar with the scene name and Replay.
   The playing beat is highlighted; at rest every beat reads normally, so the
   finished frame (and the reduced-motion still) is fully labelled.
   ========================================================================== */

export default function Stage({ ref, reduced, replay, beat, label, name, viewBox = '0 0 320 220', live = false, children, className = '', aside, beats }) {
  return (
    <figure ref={ref} className={`bxi-scene${live ? ' bxi-scene--live' : ''} ${className}`}>
      <svg className="bxi-scene__svg" viewBox={viewBox} role="img" aria-label={label}>
        <title>{label}</title>
        {children}
      </svg>
      {beats && (
        <ol className="bxi-beats" aria-label="What happens">
          {beats.map((b, i) => (
            <li
              key={i}
              className={`bxi-beat${beat === i ? ' bxi-beat--on' : ''}${beat != null && beat > i ? ' bxi-beat--past' : ''}`}
            >
              <span className="bxi-beat__n">{String(i + 1).padStart(2, '0')}</span>
              <span className="bxi-beat__t"><Rich text={b} /></span>
            </li>
          ))}
        </ol>
      )}
      <figcaption className="bxi-scene__bar">
        <span className="bxi-scene__name">
          <b>{name}</b>
          {live ? ' · live' : reduced ? ' · still frame' : ''}
        </span>
        {aside}
        {!reduced && !live && (
          <button type="button" className="bxi-replay" onClick={replay}>
            Replay
          </button>
        )}
      </figcaption>
    </figure>
  );
}
