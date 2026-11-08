/* The preview card that opens beside a spot (or docks at the bottom on a phone),
   and the member list for a cluster that zooming can't split. */

import { Link } from 'react-router-dom';
import { COPY } from '../copy.js';
import { paths } from '../routes.js';
import { formatDate } from '../lib/format.js';
import { heroOf, personName, placeOf, thumbOf } from '../lib/spots.js';

function CloseButton({ onClose }) {
  return (
    <button type="button" className="mr-card-close" onClick={onClose} aria-label={COPY.map.close} title={COPY.map.close}>
      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
        <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </button>
  );
}

export function SpotCard({ spot, style, compact, cardRef, onClose }) {
  const img = heroOf(spot);
  const facts = [placeOf(spot), formatDate(spot.capturedAt), personName(spot.createdBy)].filter(Boolean);
  return (
    <article
      ref={cardRef}
      className="mr-card"
      data-mr="spot-card"
      data-id={spot.id}
      data-compact={compact ? '' : undefined}
      style={style}
      aria-label={spot.title}
    >
      <div className="mr-card-media">
        {img ? <img src={img.url} alt="" width={img.width || undefined} height={img.height || undefined} /> : <span className="mr-label">{COPY.map.noPhoto}</span>}
      </div>
      <div className="mr-card-body">
        <div className="mr-card-meta">
          <span className="mr-dot" data-status={spot.status}>
            {COPY.app.status[spot.status] || spot.status}
          </span>
          <span className="mr-label">{COPY.app.kinds[spot.kind] || spot.kind}</span>
        </div>
        <h3 className="mr-card-title">{spot.title}</h3>
        {spot.note && <p className="mr-card-note">{spot.note}</p>}
        <p className="mr-card-facts">{facts.join(' · ')}</p>
        <div className="mr-card-actions">
          <Link className="mr-btn mr-btn--primary" to={paths.spot(spot.id)} data-mr="spot-open">
            {COPY.map.open}
          </Link>
          {spot.frameGroup && (
            <Link className="mr-btn mr-btn--quiet" to={paths.group(spot.frameGroup)}>
              {COPY.map.wholeGroup}
            </Link>
          )}
        </div>
      </div>
      <CloseButton onClose={onClose} />
    </article>
  );
}

export function ClusterCard({ spots, style, compact, cardRef, onPick, onClose }) {
  const group = spots[0]?.frameGroup;
  const oneBuilding = Boolean(group) && spots.every((s) => s.frameGroup === group);
  return (
    <article
      ref={cardRef}
      className="mr-card mr-card--list"
      data-mr="cluster-card"
      data-compact={compact ? '' : undefined}
      style={style}
    >
      <div className="mr-card-body">
        <p className="mr-label">{COPY.map.clusterHere(spots.length)}</p>
        <ul className="mr-card-members">
          {spots.map((s) => {
            const th = thumbOf(s);
            return (
              <li key={s.id}>
                <button type="button" className="mr-card-member" onClick={() => onPick(s.id)}>
                  <span className="mr-card-member-thumb">{th && <img src={th.url} alt="" />}</span>
                  <span className="mr-card-member-title">{s.title}</span>
                  <span className="mr-dot" data-status={s.status} aria-label={COPY.app.status[s.status]} />
                </button>
              </li>
            );
          })}
        </ul>
        {oneBuilding && (
          <div className="mr-card-actions mr-card-actions--foot">
            <Link className="mr-btn" to={paths.group(group)}>
              {COPY.map.wholeGroup}
            </Link>
          </div>
        )}
      </div>
      <CloseButton onClose={onClose} />
    </article>
  );
}
