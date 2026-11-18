/* The location picker (capture, step 4) on Mapbox: tap to drop a pin, drag the pin to
   adjust it (also after GPS), and a faint accuracy ring around a GPS fix. Opens on the
   current location, else near the last saved spot, else the trip; follows GPS fixes and
   chosen places. Goes down to street level (the atlas stopped at a town), so a tap also
   zooms in a few levels around the pin: tap, tap, tap from the whole country to the
   street. Dragging the pin never moves the map.

   The map is made once per mount; the pin and ring are an SVG overlay. */

import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { COPY } from '../../copy.js';
import { hasCoords } from '../geo.js';
import MapControls from '../MapControls.jsx';
import { TRIP_BOUNDS, toScreen, zoomForPx } from './project.js';
import { useMapbox } from './useMapbox.js';

const MIN_ZOOM = 0.6;
const MAX_ZOOM = 19;
const FIX_ZOOM = 16; // a GPS fix: the street
const NEAR_ZOOM = 9; // a region around the last spot
const TAP_STEP = 4; // zoom levels a tap adds...
const TAP_UNTIL = 15; // ...until the street is in view

const cameraAt = (ll, zoom) => (ll && hasCoords(ll) ? { center: [ll.lng, ll.lat], zoom } : null);

/** The zoom a followed location deserves: a typed place shows its whole radius, anything else the street. */
function followZoom(value, size) {
  if (value.source === 'typed' && value.accuracy && size) return Math.min(FIX_ZOOM, zoomForPx(value.accuracy * 2.4, Math.min(size.w, size.h), value.lat));
  return FIX_ZOOM;
}

const local = (e) => {
  const r = e.currentTarget.ownerSVGElement.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
};

/**
 * value: { lat, lng, accuracy?, source? } | null. near: { lat, lng } to open on when there's no value.
 * focusKey: change it to fly to `value` again (e.g. after choosing a place).
 * onPick({ lat, lng }) when the user taps or drags. onFail(reason): swap to the atlas.
 */
export default function MapboxPickMap({ value, near, focusKey = 0, onPick, onFail }) {
  const [initial] = useState(() => cameraAt(value, FIX_ZOOM) || cameraAt(near, NEAR_ZOOM) || { bounds: TRIP_BOUNDS, padding: 16 });
  const { setContainer, map, size, option } = useMapbox({ camera: initial, minZoom: MIN_ZOOM, maxZoom: MAX_ZOOM, timeout: 8000 }, onFail);
  const [auto, setAuto] = useState(true);
  const [drag, setDrag] = useState(null);
  const dragging = useRef(false);
  const ready = Boolean(map && size?.w && size?.h);
  const has = Boolean(value && hasCoords(value));

  // Any drag, pinch, wheel or key the user makes ends auto (so "reset" lights up).
  useEffect(() => {
    if (!map) return undefined;
    const leave = (e) => e.originalEvent && setAuto(false);
    map.on('movestart', leave);
    return () => map.off('movestart', leave);
  }, [map]);

  // Follow GPS fixes and typed places (not the user's own pin moves), and catch up
  // once the map has loaded. A pin the user placed only moves the map when focusKey changes.
  let followKey = null;
  if (has) followKey = value.source === 'pin' ? (focusKey ? `pin:${focusKey}` : null) : `${value.lat},${value.lng}:${focusKey}`;
  const [openedOn] = useState(followKey); // the first view already shows the value it opened with
  const follow = useEffectEvent(() => {
    if (!ready || !has || followKey === openedOn) return;
    setAuto(false);
    map.flyTo({ center: [value.lng, value.lat], zoom: Math.max(map.getZoom(), followZoom(value, size)), maxDuration: 1600 });
  });
  useEffect(() => {
    if (followKey && ready) follow();
  }, [followKey, ready]);

  // A tap on the map drops the pin there, and (until the street shows) zooms in around it.
  const tap = useEffectEvent((e) => {
    const ll = e.lngLat.wrap();
    onPick({ lat: ll.lat, lng: ll.lng });
    const z = map.getZoom();
    if (z < TAP_UNTIL - 0.5) {
      setAuto(false);
      map.easeTo({ center: e.lngLat, zoom: Math.min(TAP_UNTIL, z + TAP_STEP), duration: 600 });
    }
  });
  useEffect(() => {
    if (!map) return undefined;
    const h = (e) => tap(e);
    map.on('click', h);
    return () => map.off('click', h);
  }, [map]);

  const reset = () => {
    if (!ready) return;
    setAuto(true);
    if (initial.bounds) map.fitBounds(initial.bounds, { padding: initial.padding, maxDuration: 1600 });
    else map.flyTo({ center: initial.center, zoom: initial.zoom, maxDuration: 1600 });
  };

  let pin = null;
  let ring = 0;
  if (ready && has) {
    const at = toScreen(map, value, size, 40);
    pin = drag || at;
    if (at && value.accuracy && value.source === 'gps' && !drag) {
      const edge = map.project([value.lng, value.lat + value.accuracy / 111320]);
      ring = Math.abs(edge.y - at.y);
    }
  }

  const pinHandlers = {
    onPointerDown: (e) => {
      e.stopPropagation();
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      dragging.current = true;
      setDrag(local(e));
    },
    onPointerMove: (e) => {
      if (!dragging.current) return;
      e.stopPropagation();
      setDrag(local(e));
    },
    onPointerUp: (e) => {
      if (!dragging.current) return;
      e.stopPropagation();
      dragging.current = false;
      const at = local(e);
      setDrag(null);
      if (!ready) return;
      const ll = map.unproject([at.x, at.y]).wrap();
      onPick({ lat: ll.lat, lng: ll.lng });
    },
    onPointerCancel: () => {
      dragging.current = false;
      setDrag(null);
    },
    onClick: (e) => e.stopPropagation(),
  };

  const zoom = ready ? map.getZoom() : null;
  const zoomBy = (dz) => {
    if (!ready) return;
    setAuto(false);
    map.easeTo({ zoom: map.getZoom() + dz, duration: 300 });
  };

  return (
    <div className="mr-pickmap" data-engine="mapbox">
      <div
        ref={setContainer}
        className="mr-mbx"
        data-mr="loc-pick-map"
        data-engine="mapbox"
        data-style={option}
        data-ready={ready ? '' : undefined}
        data-zoom={zoom == null ? undefined : zoom.toFixed(2)}
        aria-label={COPY.map.pickLabel}
        role="region"
      />
      {ready && (
        <svg className="mr-mapoverlay" width={size.w} height={size.h} viewBox={`0 0 ${size.w} ${size.h}`} aria-hidden={pin ? undefined : 'true'}>
          {pin && ring > 6 && <circle className="mr-pick-acc" cx={pin.x} cy={pin.y} r={ring} />}
          {pin && (
            <g className="mr-locpin" transform={`translate(${pin.x.toFixed(1)} ${pin.y.toFixed(1)})`} data-mr="loc-pin" data-dragging={drag ? '' : undefined} {...pinHandlers}>
              <circle className="mr-locpin-hit" r={24} cy={-14} />
              <ellipse className="mr-locpin-shadow" rx={5} ry={2} />
              <path className="mr-locpin-head" d="M0 0 C-2 -6 -9 -11 -9 -18 A9 9 0 1 1 9 -18 C9 -11 2 -6 0 0 Z" />
              <circle className="mr-locpin-eye" cy={-18} r={3.2} />
            </g>
          )}
        </svg>
      )}
      <MapControls onIn={() => zoomBy(1)} onOut={() => zoomBy(-1)} onReset={reset} canIn={!ready || zoom < MAX_ZOOM - 0.01} canReset={!auto} />
    </div>
  );
}
