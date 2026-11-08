/* The map in "pick" mode (capture, step 4): tap to drop a pin, drag the pin to
   adjust it (also after GPS), and a faint accuracy ring around a GPS fix.
   Opens on the current location, else near the last saved spot, else the trip area;
   follows GPS fixes and chosen places. Zooms closer than the spots map (pins need it). */

import { useEffect, useEffectEvent, useState } from 'react';
import { COPY } from '../copy.js';
import AtlasMap from './AtlasMap.jsx';
import MapControls from './MapControls.jsx';
import { invert, onMap, project } from './geo.js';
import { useMapViewport } from './useMapViewport.js';
import { HOME } from './zoom.js';

const PICK_MAX_K = 64;
const CLOSE_K = 24; // a town and its surroundings
const NEAR_K = 8; // a region around the last spot

function viewAt(ll, k) {
  if (!ll || !onMap(ll)) return null;
  const [cx, cy] = project(ll.lat, ll.lng);
  return { k, cx, cy };
}

const local = (e) => {
  const r = e.currentTarget.ownerSVGElement.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
};

/**
 * value: { lat, lng, accuracy?, source? } | null. near: { lat, lng } to open on when there's no value.
 * focusKey: change it to fly to `value` again (e.g. after choosing a place).
 * onPick({ lat, lng }) when the user taps or drags.
 */
export default function PickMap({ value, near, focusKey = 0, onPick }) {
  const [initial] = useState(() => viewAt(value, CLOSE_K) || viewAt(near, NEAR_K) || HOME);
  const vp = useMapViewport({ auto: initial, maxK: PICK_MAX_K });
  const { t } = vp;
  const [drag, setDrag] = useState(null);

  const has = Boolean(value && Number.isFinite(value.lat) && Number.isFinite(value.lng));
  const inside = has && onMap(value);

  // Follow GPS fixes and typed places (not the user's own pin moves).
  // (A pin the user placed only moves the map when focusKey changes.)
  const followKey = inside ? `${value.source === 'pin' ? 'pin' : `${value.lat},${value.lng}`}:${focusKey}` : null;
  const follow = useEffectEvent(() => {
    const v = viewAt(value, CLOSE_K);
    if (v) vp.animateTo({ ...v, k: Math.max(vp.getView().k, v.k) });
  });
  useEffect(() => {
    if (followKey) follow();
  }, [followKey]);

  const toLatLng = (x, y) => (t ? invert((x - t.tx) / t.s, (y - t.ty) / t.s) : null);

  const tap = ({ x, y }) => {
    const ll = toLatLng(x, y);
    if (ll) onPick(ll);
  };

  let pin = null;
  let ring = 0;
  if (t && inside) {
    const [wx, wy] = project(value.lat, value.lng);
    pin = drag || { x: wx * t.s + t.tx, y: wy * t.s + t.ty };
    if (value.accuracy && value.source === 'gps' && !drag) {
      const [, wy2] = project(value.lat + value.accuracy / 111320, value.lng);
      ring = Math.abs(wy2 - wy) * t.s;
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
      setDrag(local(e));
    },
    onPointerMove: (e) => {
      if (!drag) return;
      e.stopPropagation();
      setDrag(local(e));
    },
    onPointerUp: (e) => {
      if (!drag) return;
      e.stopPropagation();
      const ll = toLatLng(drag.x, drag.y);
      setDrag(null);
      if (ll) onPick(ll);
    },
    onPointerCancel: () => setDrag(null),
    onClick: (e) => e.stopPropagation(),
  };

  return (
    <div className="mr-pickmap">
      <AtlasMap vp={vp} dataMr="loc-pick-map" label={COPY.map.pickLabel} onBackgroundTap={tap} avoid={pin ? [{ x: pin.x, y: pin.y - 12, r: 12 }] : undefined}>
        {ring > 6 && <circle className="mr-pick-acc" cx={pin.x} cy={pin.y} r={ring} />}
        {pin && (
          <g className="mr-locpin" transform={`translate(${pin.x.toFixed(1)} ${pin.y.toFixed(1)})`} data-mr="loc-pin" data-dragging={drag ? '' : undefined} {...pinHandlers}>
            <circle className="mr-locpin-hit" r={24} cy={-14} />
            <ellipse className="mr-locpin-shadow" rx={5} ry={2} />
            <path className="mr-locpin-head" d="M0 0 C-2 -6 -9 -11 -9 -18 A9 9 0 1 1 9 -18 C9 -11 2 -6 0 0 Z" />
            <circle className="mr-locpin-eye" cy={-18} r={3.2} />
          </g>
        )}
      </AtlasMap>
      <MapControls onIn={() => vp.zoomBy(2)} onOut={() => vp.zoomBy(0.5)} onReset={() => vp.reset()} canIn={vp.view.k < PICK_MAX_K - 0.01} canReset={!vp.isAuto} />
      {has && !inside && <p className="mr-pickmap-note">{COPY.map.pickOutside}</p>}
    </div>
  );
}
