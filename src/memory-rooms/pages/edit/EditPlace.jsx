/* The edit page's place: a summary of where the spot is saved, and "Change location",
   which mounts the shared picker (capture/LocationPicker.jsx). The picker's map is a
   billed Mapbox load, so it mounts only on that tap, never with the page: a title fix
   costs no map load, a location fix one. Once open it stays open (closing and reopening
   would be a second load). */

import { COPY } from '../../copy.js';
import { formatCoord, formatMetres } from '../../lib/format.js';
import LocationPicker from '../../capture/LocationPicker.jsx';
import { sameLoc } from './form.js';

export default function EditPlace({ base, loc, open, onOpen, onChange, onReset, error }) {
  const c = COPY.edit;
  const has = Boolean(loc && Number.isFinite(loc.lat) && Number.isFinite(loc.lng));
  const moved = !sameLoc(base.loc, loc);
  const meta = has
    ? [COPY.capture.source[loc.source], loc.source === 'gps' && Number.isFinite(loc.accuracy) ? COPY.capture.accuracy(formatMetres(loc.accuracy)) : null, formatCoord(loc.lat, loc.lng)]
        .filter(Boolean)
        .join(' · ')
    : null;

  return (
    <section className="mr-edit-sec" data-mr="edit-place" data-open={open ? '' : undefined} data-moved={moved ? '' : undefined}>
      <h2 className="mr-label">{c.placeLabel}</h2>
      {open ? (
        <>
          <p className="mr-field-hint">{c.placeHint}</p>
          <div className="mr-location mr-edit-picker">
            <LocationPicker loc={loc} onChange={onChange} anchor={base.loc} />
          </div>
        </>
      ) : (
        <div className="mr-edit-place">
          <p className="mr-edit-place-name" data-mr="edit-place-name">
            {loc?.label || (has ? c.noLabel : c.noPlace)}
          </p>
          {meta && (
            <p className="mr-edit-place-meta" data-mr="edit-place-meta">
              {meta}
            </p>
          )}
          <button type="button" className="mr-btn mr-btn--lg mr-btn--block" onClick={onOpen} data-mr="edit-place-open">
            {c.changePlace}
          </button>
        </div>
      )}
      {moved && (
        <button type="button" className="mr-linkbtn mr-edit-reset" onClick={onReset} data-mr="edit-place-reset">
          {c.resetPlace}
        </button>
      )}
      {error && (
        <p className="mr-msg" data-tone="danger" data-mr="edit-error-place">
          {error}
        </p>
      )}
    </section>
  );
}
