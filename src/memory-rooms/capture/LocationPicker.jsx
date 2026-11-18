/* The location picker, shared by capture (step 4, StepLocation.jsx) and the edit page
   (pages/edit/EditPlace.jsx). GPS first ("Use where I am", with its accuracy), then a pin
   on the map (draggable, also after GPS) or a typed place from the offline gazetteer or a
   raw "lat, lng". The location is { lat, lng, accuracy, source, label, labelAuto }.

   onChange(fn) takes an updater, fn(prevLoc) → nextLoc, like a state setter: a GPS fix
   arrives seconds later and must label itself from the location as it is THEN.

   The label: one the user typed or picked here always stays. One that came from the
   gazetteer (labelAuto) follows the pin. The edit page also passes `anchor`, where the spot
   was saved, and its saved label (labelSaved): that label stays while the pin moves a
   little, and switches to the nearest place (saying so, relabeledFrom) once the pin is
   more than FAR_M from the anchor. Capture never sets those, so it behaves as before.

   Renders a fragment: the caller's column (.mr-location) lays it out. */

import { useState } from 'react';
import { COPY } from '../copy.js';
import { formatCoord, formatMetres } from '../lib/format.js';
import { locate } from '../lib/geolocation.js';
import { readLastLoc } from '../lib/storage.js';
import PickMap from '../map/PickMap.jsx';
import { distanceM, nearestPlace, parseLatLng, searchPlaces } from '../map/places.js';

/** Past this distance from where a spot was saved, its saved place name no longer describes it. */
export const FAR_M = 25000;

const Pin = () => (
  <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
    <path d="M10 18s-5.5-5.2-5.5-9.3a5.5 5.5 0 0 1 11 0C15.5 12.8 10 18 10 18z" fill="none" stroke="currentColor" strokeWidth="1.5" />
    <circle cx="10" cy="8.6" r="1.9" fill="currentColor" />
  </svg>
);

const hasXY = (l) => Boolean(l && Number.isFinite(l.lat) && Number.isFinite(l.lng));

/** The location without the edit page's label bookkeeping (a label the user just typed or picked). */
function own(prev) {
  if (!prev || !('labelSaved' in prev || 'relabeledFrom' in prev)) return prev;
  const { labelSaved: _saved, relabeledFrom: _from, ...rest } = prev;
  return rest;
}

/** The label for a pin / GPS fix at lat, lng. isFar(lat, lng): moved far from where the spot was saved. */
function autoLabel(prev, lat, lng, isFar) {
  if (prev?.label && !prev.labelAuto) {
    if (!prev.labelSaved) return { label: prev.label, labelAuto: false }; // typed or picked here: it stays
    if (!isFar(lat, lng)) return { label: prev.label, labelAuto: false, labelSaved: true }; // saved, still near
    return { label: nearestPlace(lat, lng)?.label || null, labelAuto: true, relabeledFrom: prev.label };
  }
  const next = { label: nearestPlace(lat, lng)?.label || null, labelAuto: true };
  if (prev?.relabeledFrom) next.relabeledFrom = prev.relabeledFrom; // keep saying so while it's automatic
  return next;
}

export default function LocationPicker({ loc, onChange, anchor = null }) {
  const c = COPY.capture;
  const [gps, setGps] = useState({ status: 'idle', code: null });
  const [focused, setFocused] = useState(false);
  const [focus, setFocus] = useState(0); // bump → the map flies to the location
  const [near] = useState(readLastLoc); // where the last spot was saved, to open the map there
  const isFar = (lat, lng) => hasXY(anchor) && distanceM(anchor, { lat, lng }) > FAR_M;

  const locateMe = async () => {
    setGps({ status: 'locating', code: null });
    try {
      const fix = await locate({ timeout: 20000 });
      onChange((prev) => ({ lat: fix.lat, lng: fix.lng, accuracy: Math.round(fix.accuracy), source: 'gps', ...autoLabel(prev, fix.lat, fix.lng, isFar) }));
      setGps({ status: 'ok', code: null });
    } catch (err) {
      setGps({ status: 'error', code: err.code || 'unavailable' });
    }
  };

  const pinAt = ({ lat, lng }) => onChange((prev) => ({ lat, lng, accuracy: null, source: 'pin', ...autoLabel(prev, lat, lng, isFar) }));

  const typeLabel = (text) => onChange((prev) => ({ ...(own(prev) || { lat: null, lng: null, accuracy: null, source: 'typed' }), label: text, labelAuto: false }));

  // A place moves the pin there, unless a GPS fix or pin is already inside that place.
  const choosePlace = (p) => {
    onChange((prev) => {
      const inside = hasXY(prev) && prev.source !== 'typed' && distanceM(prev, p) < p.r * 1.5;
      return inside ? { ...own(prev), label: p.label, labelAuto: false } : { lat: p.lat, lng: p.lng, accuracy: p.r, source: 'typed', label: p.label, labelAuto: false };
    });
    setFocused(false);
    setFocus((f) => f + 1);
  };

  const chooseCoords = ({ lat, lng }) => {
    onChange(() => ({ lat, lng, accuracy: null, source: 'typed', label: nearestPlace(lat, lng)?.label || null, labelAuto: true }));
    setFocused(false);
    setFocus((f) => f + 1);
  };

  const text = loc?.label || '';
  const coords = parseLatLng(text);
  const suggestions = focused && text.trim() && !coords ? searchPlaces(text) : [];
  const showList = focused && (suggestions.length > 0 || coords);
  const located = hasXY(loc);
  const locating = gps.status === 'locating';
  // "Locate again" while the location is a GPS fix. Editing a saved spot (anchor), its fix is from capture: only one taken here counts.
  const again = loc?.source === 'gps' && (!anchor || gps.status === 'ok');
  const relabeled = loc?.relabeledFrom && loc.relabeledFrom !== loc.label ? loc.relabeledFrom : null;

  let status;
  if (locating) status = <span className="mr-dot" data-tone="busy">{c.locating}</span>;
  else if (located)
    status = (
      <span className="mr-dot" data-tone="ok">
        {[c.source[loc.source] || loc.source, loc.source === 'gps' && Number.isFinite(loc.accuracy) ? c.accuracy(formatMetres(loc.accuracy)) : null, formatCoord(loc.lat, loc.lng)]
          .filter(Boolean)
          .join(' · ')}
      </span>
    );
  else status = <span className="mr-dot" data-tone="idle">{c.noLocation}</span>;

  return (
    <>
      <button type="button" className="mr-btn mr-btn--lg mr-btn--block" onClick={locateMe} disabled={locating} data-mr="loc-gps">
        <Pin />
        {locating ? c.locating : again ? c.gpsAgain : c.gps}
      </button>
      <p className="mr-loc-status" data-mr="loc-status" data-source={located ? loc.source : ''}>
        {status}
      </p>
      {gps.status === 'error' && (
        <p className="mr-msg" data-tone="danger" data-mr="loc-error" data-code={gps.code}>
          {c.gpsErrors[gps.code] || c.gpsErrors.unavailable}
        </p>
      )}

      <PickMap value={located ? loc : null} near={near} focusKey={focus} onPick={pinAt} />
      <p className="mr-field-hint">{COPY.map.pickHint}</p>

      <label className="mr-field">
        <span className="mr-label">{c.placeLabel}</span>
        <input
          className="mr-input"
          type="text"
          value={text}
          maxLength={120}
          placeholder={c.placePlaceholder}
          autoComplete="off"
          enterKeyHint="done"
          role="combobox"
          aria-expanded={Boolean(showList)}
          aria-controls="mr-place-list"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={(e) => {
            typeLabel(e.target.value);
            setFocused(true);
          }}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return;
            e.preventDefault();
            if (coords) chooseCoords(coords);
            else if (suggestions[0]) choosePlace(suggestions[0]);
            else e.currentTarget.blur();
          }}
          data-mr="loc-place-input"
        />
      </label>
      {showList && (
        <ul className="mr-suggest" id="mr-place-list" role="listbox">
          {coords && (
            <li>
              <button type="button" role="option" aria-selected="false" onPointerDown={(e) => e.preventDefault()} onClick={() => chooseCoords(coords)} data-mr="place-suggestion">
                <Pin />
                <span>{c.useCoords(formatCoord(coords.lat, coords.lng))}</span>
              </button>
            </li>
          )}
          {suggestions.map((p) => (
            <li key={p.label}>
              <button type="button" role="option" aria-selected="false" onPointerDown={(e) => e.preventDefault()} onClick={() => choosePlace(p)} data-mr="place-suggestion">
                <Pin />
                <span>{p.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {relabeled && (
        <p className="mr-msg" data-mr="loc-relabeled" aria-live="polite">
          {COPY.edit.relabeled(relabeled, loc.label, `${FAR_M / 1000} km`)}
        </p>
      )}
    </>
  );
}
