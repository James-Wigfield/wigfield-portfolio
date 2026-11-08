/* Step 4: GPS first ("Use where I am", with its accuracy), then a pin on the
   map (draggable, also after GPS) or a typed place from the offline gazetteer
   or raw "lat, lng". The location is stored as { lat, lng, accuracy, source, label }. */

import { useState } from 'react';
import { COPY } from '../copy.js';
import { formatCoord, formatMetres } from '../lib/format.js';
import { locate } from '../lib/geolocation.js';
import { readLastLoc } from '../lib/storage.js';
import PickMap from '../map/PickMap.jsx';
import { distanceM, nearestPlace, parseLatLng, searchPlaces } from '../map/places.js';

const Pin = () => (
  <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
    <path d="M10 18s-5.5-5.2-5.5-9.3a5.5 5.5 0 0 1 11 0C15.5 12.8 10 18 10 18z" fill="none" stroke="currentColor" strokeWidth="1.5" />
    <circle cx="10" cy="8.6" r="1.9" fill="currentColor" />
  </svg>
);

/** Keep a label the user typed; otherwise label with the nearest known place. */
function autoLabel(prev, lat, lng) {
  if (prev?.label && !prev.labelAuto) return { label: prev.label, labelAuto: false };
  return { label: nearestPlace(lat, lng)?.label || null, labelAuto: true };
}

const hasXY = (l) => Boolean(l && Number.isFinite(l.lat) && Number.isFinite(l.lng));

export default function StepLocation({ loc, update }) {
  const c = COPY.capture;
  const [gps, setGps] = useState({ status: 'idle', code: null });
  const [focused, setFocused] = useState(false);
  const [focus, setFocus] = useState(0); // bump → the map flies to the location
  const [near] = useState(readLastLoc); // where the last spot was saved, to open the map there

  const locateMe = async () => {
    setGps({ status: 'locating', code: null });
    try {
      const fix = await locate({ timeout: 20000 });
      update((d) => ({ loc: { lat: fix.lat, lng: fix.lng, accuracy: Math.round(fix.accuracy), source: 'gps', ...autoLabel(d.loc, fix.lat, fix.lng) } }));
      setGps({ status: 'ok', code: null });
    } catch (err) {
      setGps({ status: 'error', code: err.code || 'unavailable' });
    }
  };

  const pinAt = ({ lat, lng }) =>
    update((d) => ({ loc: { lat, lng, accuracy: null, source: 'pin', ...autoLabel(d.loc, lat, lng) } }));

  const typeLabel = (text) =>
    update((d) => ({ loc: { ...(d.loc || { lat: null, lng: null, accuracy: null, source: 'typed' }), label: text, labelAuto: false } }));

  // A place moves the pin there, unless a GPS fix or pin is already inside that place.
  const choosePlace = (p) => {
    update((d) => {
      const prev = d.loc;
      const inside = hasXY(prev) && prev.source !== 'typed' && distanceM(prev, p) < p.r * 1.5;
      return inside
        ? { loc: { ...prev, label: p.label, labelAuto: false } }
        : { loc: { lat: p.lat, lng: p.lng, accuracy: p.r, source: 'typed', label: p.label, labelAuto: false } };
    });
    setFocused(false);
    setFocus((f) => f + 1);
  };

  const chooseCoords = ({ lat, lng }) => {
    update(() => ({ loc: { lat, lng, accuracy: null, source: 'typed', label: nearestPlace(lat, lng)?.label || null, labelAuto: true } }));
    setFocused(false);
    setFocus((f) => f + 1);
  };

  const text = loc?.label || '';
  const coords = parseLatLng(text);
  const suggestions = focused && text.trim() && !coords ? searchPlaces(text) : [];
  const showList = focused && (suggestions.length > 0 || coords);
  const located = hasXY(loc);
  const locating = gps.status === 'locating';

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
    <div className="mr-stepbody mr-location">
      <h2 className="mr-step-title">{c.locationTitle}</h2>

      <button type="button" className="mr-btn mr-btn--lg mr-btn--block" onClick={locateMe} disabled={locating} data-mr="loc-gps">
        <Pin />
        {locating ? c.locating : loc?.source === 'gps' ? c.gpsAgain : c.gps}
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
    </div>
  );
}
