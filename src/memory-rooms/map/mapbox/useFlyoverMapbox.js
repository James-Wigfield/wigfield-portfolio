/* The flyover on the Mapbox globe (state: ../flyover/useFlyover.js). Everything happens on the
   page's ONE map: the route is a GeoJSON line source + layer (layers are free, a new Map is a
   billed load), the camera moves with flyTo / easeTo.

   - Flying: flyTo the next stop, drawing the leg as the camera goes. A long hop (WA → the
     USA) pulls out to the globe on the way (minZoom). Rendered stops dive past MODEL_ZOOM
     (pitch 55°), so the existing 3D layer stands the diorama up, within its cap, and the
     camera slowly orbits it while the caption shows. Other stops stop at town level, flat.
   - Reduced motion: no flight. The page fades (the overlay's fade layer), the camera jumps.
   - Pause holds the camera (map.stop()); a drag or pinch by the user pauses too.
   - Exit removes the route and puts the camera, its padding and the tilt limit back exactly
     as they were; zooming back out drops the flight's 3D models (models3d.js disposes them).

   The page's tilt rule (useTilt) is held while this runs and re-applies afterwards. */

import { useEffect, useEffectEvent, useRef } from 'react';
import { onThemeChange } from '../../lib/theme.js';
import { distanceKm, LONG_HOP_KM, routeCoords, routeGeoJSON } from '../flyover/plan.js';
import { FADE_MS, FLY_MS, LINGER_MS, LONG_FLY_MS } from '../flyover/useFlyover.js';
import { MAX_PITCH } from './models.js';

const SRC = 'mr-route';
const LINE = 'mr-route-line';
const BEFORE = 'mr-models'; // models3d.js LAYER_ID: the dioramas stand on top of the line
const DIVE_ZOOM = 16.2;
const DIVE_PITCH = 55;
const PLAIN_ZOOM = 12.5;
const ORBIT_DEG = 36; // per linger at 1×
const END_MAX_ZOOM = 6;

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/** The map can be gone before our cleanup runs (leaving the page: useMapbox removed it first). */
const alive = (map) => map && !map._removed;
function safely(map, fn) {
  if (!alive(map)) return;
  try {
    fn();
  } catch {
    /* the map went mid-call */
  }
}

/**
 * The end view: the whole route when it fits. Longitudes are taken the short way round (the widest
 * gap between stops is where the box opens), so the route can cross the antimeridian. When even that
 * box is wider than ~150°, no view of a globe can hold it (Perth and New York are nearly antipodal:
 * one is always past the horizon), so the view fits the main region, the largest group of stops
 * (split where the stops are more than 60° of longitude apart), and the route runs over the horizon
 * to the others.
 */
function endCamera(map, stops, padding) {
  const box = (list) => {
    const lngs = list.map((s) => s.lng).sort((a, b) => a - b);
    let gap = -1;
    let at = 0;
    for (let i = 0; i < lngs.length; i++) {
      const next = i + 1 < lngs.length ? lngs[i + 1] : lngs[0] + 360;
      if (next - lngs[i] > gap) {
        gap = next - lngs[i];
        at = i;
      }
    }
    const west = lngs[(at + 1) % lngs.length];
    const lats = list.map((s) => s.lat);
    return { west, east: west + (360 - gap), south: Math.min(...lats), north: Math.max(...lats), span: 360 - gap };
  };
  let b = box(stops);
  if (b.span > 150) {
    const sorted = [...stops].sort((p, q) => p.lng - q.lng);
    const groups = [[sorted[0]]];
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].lng - sorted[i - 1].lng > 60) groups.push([]);
      groups[groups.length - 1].push(sorted[i]);
    }
    if (groups.length > 1 && sorted[0].lng + 360 - sorted[sorted.length - 1].lng <= 60) groups[0].push(...groups.pop()); // across ±180
    b = box(groups.reduce((m, g) => (g.length > m.length ? g : m)));
  }
  const cam = map.cameraForBounds([[b.west, b.south], [b.east, b.north]], { padding, maxZoom: END_MAX_ZOOM, bearing: 0, pitch: 0 });
  return cam ? { ...cam, bearing: 0, pitch: 0, padding } : { center: map.getCenter(), zoom: 1.5, bearing: 0, pitch: 0, padding };
}

function routeColor(el) {
  const probe = document.createElement('span');
  probe.style.display = 'none';
  probe.style.color = 'var(--mr-map-route)';
  el.appendChild(probe);
  try {
    return getComputedStyle(probe).color || '#b5532f';
  } finally {
    probe.remove();
  }
}

function addRoute(map) {
  if (!map.getSource(SRC)) map.addSource(SRC, { type: 'geojson', data: routeGeoJSON([]) });
  if (!map.getLayer(LINE)) {
    map.addLayer(
      {
        id: LINE,
        type: 'line',
        source: SRC,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': routeColor(map.getContainer()), 'line-width': ['interpolate', ['linear'], ['zoom'], 1, 2, 8, 3, 15, 4], 'line-opacity': 0.92 },
      },
      map.getLayer(BEFORE) ? BEFORE : undefined,
    );
  }
}

function removeRoute(map) {
  if (map.getLayer(LINE)) map.removeLayer(LINE);
  if (map.getSource(SRC)) map.removeSource(SRC);
}

/**
 * map / ready: the page's map. fly: useFlyover(). stops / legs: ../flyover/plan.js.
 * padding: keeps each stop clear of the caption and the bar.
 */
export function useFlyoverMapbox(map, ready, fly, stops, legs, padding) {
  const { active, index, phase, playing, stepping, speed, reduced } = fly;
  const drawn = useRef({ index: -1, t: 0 }); // how much of the current leg is on the map
  const live = active && fly.count > 0 && ready && Boolean(map);
  const pad = useRef(padding);
  useEffect(() => {
    pad.current = padding;
  }, [padding]);

  const setRoute = (i, t) => {
    const src = map?.getSource(SRC);
    if (!src) return;
    if (drawn.current.index !== i) drawn.current = { index: i, t: 0 };
    drawn.current.t = Math.max(drawn.current.t, t);
    src.setData(routeGeoJSON(routeCoords(legs, i, drawn.current.t)));
  };
  const draw = useEffectEvent(setRoute);
  const pause = useEffectEvent(() => fly.pause());
  const arrive = useEffectEvent((i) => fly.arrived(i));

  // Start / exit: the route layer, the saved camera, the tilt limit.
  useEffect(() => {
    if (!live) return undefined;
    const saved = {
      center: map.getCenter(),
      zoom: map.getZoom(),
      bearing: map.getBearing(),
      pitch: map.getPitch(),
      padding: map.getPadding(),
      maxPitch: map.getMaxPitch(),
    };
    drawn.current = { index: -1, t: 0 };
    addRoute(map);
    map.setMaxPitch(MAX_PITCH);
    const readd = () => addRoute(map);
    map.on('style.load', readd);
    // the theme switch: the route takes the new accent
    const offTheme = onThemeChange(() => safely(map, () => map.getLayer(LINE) && map.setPaintProperty(LINE, 'line-color', routeColor(map.getContainer()))));
    // A drag, pinch or wheel from the user pauses the flight where it is.
    const user = (e) => e.originalEvent && pause();
    map.on('movestart', user);
    return () => {
      offTheme();
      safely(map, () => {
        map.off('style.load', readd);
        map.off('movestart', user);
        map.stop();
        removeRoute(map);
        map.setMaxPitch(Math.max(saved.maxPitch, saved.pitch));
        map.jumpTo({ center: saved.center, zoom: saved.zoom, bearing: saved.bearing, pitch: saved.pitch, padding: saved.padding });
        map.setMaxPitch(saved.maxPitch);
      });
    };
  }, [live, map]);

  // The camera, per phase.
  useEffect(() => {
    if (!live) return undefined;
    const stop = stops[index];
    if (!stop) return undefined;
    const padding = pad.current;

    if (phase === 'end') {
      draw(stops.length - 1, 1);
      const to = endCamera(map, stops, padding);
      if (reduced) map.jumpTo(to);
      else map.flyTo({ ...to, duration: FLY_MS / speed, essential: true });
      return () => safely(map, () => map.stop());
    }

    if (phase === 'linger') {
      draw(index, 1);
      if (!playing || reduced || !stop.rendered) return undefined;
      // a slow orbit round the standing diorama while the caption shows
      map.easeTo({ bearing: map.getBearing() + ORBIT_DEG, duration: LINGER_MS / speed, easing: (t) => t, essential: true });
      return () => safely(map, () => map.stop());
    }

    // flying (playing, or one step by next / prev while paused)
    if (!playing && !stepping) return undefined;
    const target = stop.rendered
      ? { center: [stop.lng, stop.lat], zoom: DIVE_ZOOM, pitch: DIVE_PITCH, bearing: map.getBearing(), padding }
      : { center: [stop.lng, stop.lat], zoom: PLAIN_ZOOM, pitch: 0, bearing: 0, padding };
    const here = map.getCenter();
    const long = Boolean(legs[index]?.long) || distanceKm({ lat: here.lat, lng: here.lng }, stop) > LONG_HOP_KM;
    const token = {};
    let timer = 0;

    if (reduced) {
      // the overlay fades the map out while phase is 'flying'; jump once it's covered
      timer = setTimeout(() => {
        map.jumpTo(target);
        draw(index, 1);
        arrive(index);
      }, FADE_MS);
      return () => clearTimeout(timer);
    }

    const duration = (long ? LONG_FLY_MS : FLY_MS) / speed;
    const t0 = performance.now();
    const t0Drawn = drawn.current.index === index ? drawn.current.t : 0;
    const onMove = () => draw(index, t0Drawn + (1 - t0Drawn) * ease(Math.min(1, (performance.now() - t0) / duration)));
    const onEnd = (e) => {
      if (e.mrFly !== token) return;
      const c = map.getCenter();
      const there = distanceKm({ lat: c.lat, lng: c.lng }, stop) < 0.05 && Math.abs(map.getZoom() - target.zoom) < 0.05;
      if (!there) return; // stopped on the way (pause, the user): it carries on when played again
      draw(index, 1);
      arrive(index);
    };
    map.on('move', onMove);
    map.on('moveend', onEnd);
    map.flyTo({ ...target, duration, essential: true, ...(long ? { minZoom: 1.6 } : {}) }, { mrFly: token });
    return () =>
      safely(map, () => {
        map.off('move', onMove);
        map.off('moveend', onEnd);
        map.stop();
      });
  }, [live, map, index, phase, playing, stepping, speed, reduced, stops, legs]);
}
