/* The /memories map on Mapbox: a globe that opens on the trip (the USA + western
   Canada, or the trip's spots once there are some), spots as status dots, clusters
   that zoom in when clicked, zoom controls, the trip's place labels, and the preview
   card beside the selected spot (docked at the bottom on a phone).

   The map is made once per mount (useMapbox). Everything that changes with filters,
   clusters or cards is an SVG overlay redrawn from map.project() on every camera
   move, so none of it ever touches the map instance (every new map is billed).
   Clusters stay screen-space (clusters.js), not Mapbox's own: see SpotsMap.jsx.

   Rendered spots stand as their marker images (../markers.js); past zoom 15 the ones on screen
   become live 3D dioramas drawn by one custom layer in this map's own WebGL context
   (models.js, useModels.js, models3d.js), and the map unlocks rotation and tilt. */

import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import { COPY } from '../../copy.js';
import { anchorOf, cardPosition } from '../cardPlace.js';
import { CLUSTER_PX, clusterPoints, clusterRadius } from '../clusters.js';
import { hasCoords, onMap } from '../geo.js';
import MapControls from '../MapControls.jsx';
import MapSpots from '../MapSpots.jsx';
import { useMarkerImages } from '../markerImages.js';
import { avoidOf, fanBox, markerBox, markerPx, withMarkers } from '../markers.js';
import PlaceLabels from '../PlaceLabels.jsx';
import { ClusterCard, SpotCard } from '../SpotCard.jsx';
import { wantedModels } from './models.js';
import { TRIP_BOUNDS, boundsOf, nearestM, pxPerMetre, spanM, toScreen, zoomForPx, zoomForSpan } from './project.js';
import { useMapbox } from './useMapbox.js';
import { useModels, useNear, useTilt } from './useModels.js';
import FlyoverOverlay from '../flyover/FlyoverOverlay.jsx';
import { NO_FLY } from '../flyover/useFlyover.js';
import { useFlyoverMapbox } from './useFlyoverMapbox.js';

const MIN_ZOOM = 0.6;
/** Closer than a neighbourhood the spots map has nothing more to say (the pick map goes further). */
const MAX_ZOOM = 17;
/** Opening view: the trip's spots, never closer than about a region. */
const AUTO_MAX_ZOOM = 6;
/** Padding keeps markers clear of the controls (a row along the bottom on a phone, a stack bottom-right). */
const PAD_COMPACT = { top: 28, right: 24, bottom: 76, left: 24 };
const PAD_WIDE = { top: 56, right: 104, bottom: 56, left: 56 };
const DOT_R = { compact: 7, wide: 5.5 };
const CLUSTER_BASE = { compact: 13, wide: 11 };
/** The trip's place labels show once less than this much longitude is in view... */
const LABEL_SPAN_DEG = 28;
/** ...until the base map's own town labels take over. */
const TOWN_LABELS_FROM = 7.5;
const NO_POINTS = [];
const NO_MODELS = [];
/** The flyover keeps each stop clear of its caption and bar (bottom; bottom-left when wide). */
const FLY_PAD_COMPACT = { top: 48, right: 24, bottom: 250, left: 24 };
const FLY_PAD_WIDE = { top: 64, right: 64, bottom: 96, left: 440 };

/** The opening view: the trip's spots (or the trip area), flat and north up. */
function homeCamera(map, trip, padding) {
  const cam = trip.length ? map.cameraForBounds(boundsOf(trip), { padding, maxZoom: AUTO_MAX_ZOOM, bearing: 0 }) : map.cameraForBounds(TRIP_BOUNDS, { padding, bearing: 0 });
  return cam && { ...cam, bearing: 0, pitch: 0 };
}

export default function MapboxSpotsMap({ spots, selectedId, onSelect, elsewhereCount = 0, onElsewhere, compact = false, onFail, fly = NO_FLY, flyStops = NO_POINTS, flyLegs = NO_POINTS, liftId = null, children }) {
  const [auto, setAuto] = useState(true); // the view follows homeCamera until the user moves it
  const [clusterIds, setClusterIds] = useState(null);
  const [cardEl, setCardEl] = useState(null);
  const [cardH, setCardH] = useState(320);
  const [focusedId, setFocusedId] = useState(null); // keyboard focus on a 3D model (its ring is drawn in 3D)
  const [hoverId, setHoverId] = useState(null); // the marker / model / fanned cluster under the mouse
  const pendingReveal = useRef(null);
  const homeFor = useRef(null);
  const dotR = compact ? DOT_R.compact : DOT_R.wide;
  const clusterBase = compact ? CLUSTER_BASE.compact : CLUSTER_BASE.wide;
  const pad = compact ? PAD_COMPACT : PAD_WIDE;

  const { setContainer, map, size, option } = useMapbox(
    { camera: { bounds: TRIP_BOUNDS, padding: compact ? 24 : 56 }, minZoom: MIN_ZOOM, maxZoom: MAX_ZOOM, placeLabelsFrom: TOWN_LABELS_FROM, timeout: 12000, antialias: true },
    onFail,
  );
  const ready = Boolean(map && size?.w && size?.h);
  const flyOn = fly.active && fly.count > 0;

  const points = useMemo(() => spots.filter(hasCoords).map((spot) => ({ id: spot.id, lat: spot.lat, lng: spot.lng, spot })), [spots]);
  const trip = useMemo(() => points.filter((p) => onMap(p)), [points]);
  const away = useMemo(() => (points.length === trip.length ? NO_POINTS : points.filter((p) => !onMap(p))), [points, trip]);

  /* ── the view ───────────────────────────────────────────────────────────── */

  // Follow the home view while auto: jump on the first fit and on resizes, fly otherwise.
  useEffect(() => {
    if (!ready || !auto || flyOn) return; // the flyover owns the camera (and puts it back)
    const cam = homeCamera(map, trip, pad);
    if (!cam) return;
    const prev = homeFor.current;
    homeFor.current = size;
    if (!prev || prev.w !== size.w || prev.h !== size.h) map.jumpTo(cam);
    else map.flyTo({ ...cam, maxDuration: 1600 });
  }, [ready, map, size, auto, trip, pad, flyOn]);

  // Any drag, pinch, wheel or key the user makes ends auto (not during the flyover: a drag there only
  // pauses it, and exit puts the view back exactly, auto included).
  const flyingRef = useRef(flyOn);
  useEffect(() => {
    flyingRef.current = flyOn;
  }, [flyOn]);
  useEffect(() => {
    if (!map) return undefined;
    const leave = (e) => e.originalEvent && !flyingRef.current && setAuto(false);
    map.on('movestart', leave);
    return () => map.off('movestart', leave);
  }, [map]);

  const moveTo = (camera) => {
    setAuto(false);
    map.flyTo({ ...camera, maxDuration: 1600 });
  };
  const zoomBy = (dz) => {
    if (!ready) return;
    setAuto(false);
    map.easeTo({ zoom: map.getZoom() + dz, duration: 300 });
  };
  const northUp = () => {
    if (!ready) return;
    setAuto(false);
    map.easeTo({ bearing: 0, duration: 500 });
  };

  /* ── markers (recomputed every frame: a few hundred spots at most) ──────── */

  useMarkerImages(); // redraw as rendered spots' marker images arrive
  const zoom = ready ? map.getZoom() : null;
  const screen = [];
  if (ready) {
    // a marker stands above its point: keep points up to a marker's height below the edge
    const margin = Math.max(24, markerPx(zoom, compact));
    for (const p of points) {
      const q = toScreen(map, p, size, margin);
      if (q) screen.push({ ...p, x: q.x, y: q.y });
    }
  }
  const standing = withMarkers(clusterPoints(screen, CLUSTER_PX), markerPx(zoom, compact));

  // Past zoom 15 the rendered spots on screen stand as live 3D models (markers until each is ready).
  const near = useNear(map);
  useTilt(map, near, flyOn);
  useFlyoverMapbox(map, ready, fly, flyStops, flyLegs, compact ? FLY_PAD_COMPACT : FLY_PAD_WIDE);
  const wanted = near && ready ? wantedModels(standing, size, zoom, compact) : NO_MODELS;
  const models = useModels(map, wanted, { compact, selectedId, focusedId });
  const items = models ? behindModels(standing.map((it) => withModel(it, models, wanted))) : standing;
  const avoid = avoidOf(items, dotR, clusterBase);
  const showLabels = ready && zoom >= zoomForSpan(size.w, LABEL_SPAN_DEG) && zoom < TOWN_LABELS_FROM;
  const placeToScreen = (p) => toScreen(map, p, size, 0);

  const selected = selectedId ? spots.find((s) => s.id === selectedId) || null : null;
  const clusterSpots = clusterIds ? clusterIds.map((id) => spots.find((s) => s.id === id)).filter(Boolean) : null;
  const anchor = anchorOf(items, selectedId || clusterIds?.[0]);

  /* card measuring (so the card stays inside the map) */
  useEffect(() => {
    if (!cardEl) return undefined;
    const ro = new ResizeObserver(([e]) => setCardH(Math.round(e.borderBoxSize?.[0]?.blockSize ?? e.contentRect.height)));
    ro.observe(cardEl);
    return () => ro.disconnect();
  }, [cardEl]);

  /* bring a selected spot into view (and out of its cluster) when picked from the list */
  const reveal = useEffectEvent((id) => {
    if (!ready) {
      pendingReveal.current = id;
      return;
    }
    const p = points.find((q) => q.id === id);
    if (!p) return;
    const q = toScreen(map, p, size, 0);
    const m = compact ? 32 : 48;
    const off = !q || q.x < m || q.x > size.w - m || q.y < m || q.y > size.h - m;
    const z0 = map.getZoom();
    let z = z0;
    const clustered = items.some((it) => it.type === 'cluster' && it.members.some((mm) => mm.id === id));
    if (clustered) {
      const d = nearestM(points, p);
      if (d > 0.5) z = Math.min(MAX_ZOOM, Math.max(z, zoomForPx(d, CLUSTER_PX + 12, p.lat)));
    }
    if (!off && z === z0) return;
    moveTo({ center: [p.lng, p.lat], zoom: z });
  });

  useEffect(() => {
    if (selectedId) reveal(selectedId);
  }, [selectedId]);

  useEffect(() => {
    if (ready && pendingReveal.current) {
      const id = pendingReveal.current;
      pendingReveal.current = null;
      reveal(id);
    }
  }, [ready]);

  const close = () => {
    setClusterIds(null);
    onSelect(null);
  };
  const onEscape = useEffectEvent(() => close());
  const open = Boolean(selected || clusterSpots);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onEscape();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const pick = (id) => {
    setClusterIds(null);
    onSelect(id);
  };

  const openCluster = (item) => {
    if (!ready) return;
    const ids = item.members.map((m) => m.id);
    const lat = item.members.reduce((a, m) => a + m.lat, 0) / item.members.length;
    const dmin = nearestM(item.members);
    const list = () => {
      setClusterIds(ids);
      onSelect(null);
    };
    // Rooms of one building (or spots metres apart) never split, even fully zoomed: list them.
    if (!(dmin > 0.5) || spanM(item.members) * pxPerMetre(lat, MAX_ZOOM) < CLUSTER_PX + 4) return list();
    const z0 = map.getZoom();
    const fitted = map.cameraForBounds(boundsOf(item.members), { padding: compact ? 56 : 96, maxZoom: MAX_ZOOM });
    const zSep = zoomForPx(dmin, CLUSTER_PX + 12, lat);
    const z = Math.min(MAX_ZOOM, Math.max(z0 + Math.log2(1.8), Math.min(fitted?.zoom ?? MAX_ZOOM, zSep + Math.log2(1.4))));
    if (z <= z0 + Math.log2(1.05)) return list();
    setClusterIds(null);
    onSelect(null);
    moveTo({ center: fitted?.center ?? [item.members[0].lng, lat], zoom: z });
  };

  // Markers, 3D models and fanned clusters are big, so they let the pointer through (a drag that
  // starts on one still pans the map) and a click or tap on them is found here: Mapbox only fires
  // 'click' when the pointer didn't drag. A tap anywhere else closes the card. (Small dots and
  // cluster discs catch their own clicks in the overlay, as before; the keyboard uses the overlay.)
  const onMapClick = useEffectEvent((e) => {
    const hit = hitAt(items, e.point, clusterBase);
    if (hit?.type === 'spot') pick(hit.point.id);
    else if (hit) openCluster(hit);
    else close();
  });
  const onMapHover = useEffectEvent((e) => {
    const hit = e ? hitAt(items, e.point, clusterBase) : null;
    const id = hit ? (hit.type === 'spot' ? hit.point.id : hit.id) : null;
    setHoverId((h) => (h === id ? h : id));
  });
  useEffect(() => {
    if (!map) return undefined;
    const click = (e) => onMapClick(e);
    const move = (e) => onMapHover(e);
    const out = () => onMapHover(null);
    map.on('click', click);
    map.on('mousemove', move);
    map.on('mouseout', out);
    return () => {
      map.off('click', click);
      map.off('mousemove', move);
      map.off('mouseout', out);
    };
  }, [map]);
  useEffect(() => {
    if (map) map.getCanvas().style.cursor = hoverId ? 'pointer' : '';
  }, [map, hoverId]);

  // The note under the map: spots outside the trip area. The globe turns to them.
  const showAway = () => {
    onElsewhere?.();
    if (!ready || !away.length) return;
    const cam = map.cameraForBounds(boundsOf(away), { padding: pad, maxZoom: AUTO_MAX_ZOOM });
    if (cam) moveTo(cam);
  };

  const cardStyle = !compact && size && (selected || clusterSpots) ? cardPosition(anchor, size, cardH) : undefined;

  return (
    <div className="mr-spotsmap" data-compact={compact ? '' : undefined} data-engine="mapbox">
      <div
        ref={setContainer}
        className="mr-mbx"
        data-mr="map"
        data-engine="mapbox"
        data-style={option}
        data-ready={ready ? '' : undefined}
        data-zoom={zoom == null ? undefined : zoom.toFixed(2)}
        data-pitch={ready ? map.getPitch().toFixed(0) : undefined}
        data-near={near ? '' : undefined}
        data-auto={auto ? '' : undefined}
        aria-label={COPY.map.globeLabel}
        role="region"
      />
      {ready && (
        <svg className="mr-mapoverlay" width={size.w} height={size.h} viewBox={`0 0 ${size.w} ${size.h}`} role="group" aria-label={COPY.map.spotsLabel}>
          <PlaceLabels toScreen={placeToScreen} size={size} avoid={avoid} show={showLabels} />
          <MapSpots
            items={items}
            selectedId={selectedId}
            selectedCluster={anchor?.cluster}
            dotR={dotR}
            clusterBase={clusterBase}
            onPick={pick}
            onCluster={openCluster}
            onFocusChange={setFocusedId}
            hoverId={hoverId ?? liftId}
            passThrough
          />
        </svg>
      )}

      <MapControls
        onIn={() => zoomBy(1)}
        onOut={() => zoomBy(-1)}
        onReset={() => setAuto(true)}
        canIn={!ready || zoom < MAX_ZOOM - 0.01}
        canReset={!auto}
        resetLabel={COPY.map.zoomHome}
        bearing={ready ? map.getBearing() : 0}
        onNorth={northUp}
      />

      {elsewhereCount > 0 && (
        <button type="button" className="mr-map-note" onClick={showAway} data-mr="elsewhere-note">
          {COPY.map.elsewhere(elsewhereCount)}
        </button>
      )}

      {children}
      {flyOn && <FlyoverOverlay fly={fly} engine="mapbox" />}

      {selected && <SpotCard key={selected.id} spot={selected} style={cardStyle} compact={compact} cardRef={setCardEl} onClose={close} />}
      {!selected && clusterSpots && (
        <ClusterCard spots={clusterSpots} style={cardStyle} compact={compact} cardRef={setCardEl} onPick={pick} onClose={close} />
      )}
    </div>
  );
}

/**
 * The marker, 3D model or fanned cluster under a map point (container px), topmost first: the
 * dots and clusters layer is above the standing layer, and lower on screen is in front.
 * Plain dots and cluster discs are left to their own overlay hit circles (null here).
 */
function hitAt(items, pt, clusterBase) {
  let best = null;
  for (const it of items) {
    let inside = false;
    if (it.type === 'spot' && it.model) {
      const b = it.model.box;
      inside = pt.x >= b.x0 && pt.x <= b.x1 && pt.y >= b.y0 && pt.y <= b.y1;
    } else if (it.type === 'spot' && it.marker) {
      const b = markerBox(it.marker);
      inside = pt.x >= it.point.x + b.x0 && pt.x <= it.point.x + b.x1 && pt.y >= it.point.y + b.y0 && pt.y <= it.point.y + b.y1;
    } else if (it.type === 'cluster' && it.fan) {
      const b = fanBox(it.fan, clusterRadius(it.members.length, clusterBase));
      inside = pt.x >= it.x + b.x0 && pt.x <= it.x + b.x1 && pt.y >= it.y + b.y0 && pt.y <= it.y + b.y1;
    }
    if (!inside) continue;
    const y = it.type === 'spot' ? it.point.y : it.y;
    const layer = it.type === 'cluster' ? 1 : 0;
    if (!best || layer > best.layer || (layer === best.layer && y > best.y)) best = { it, y, layer };
  }
  return best?.it || null;
}

/**
 * Markers are drawn in the overlay, above the map canvas the models are drawn in, so a marker a
 * model stands in front of (lower on screen, overlapping) would cover it: that one shows as its
 * status dot instead.
 */
function behindModels(items) {
  const fronts = items.filter((it) => it.model);
  if (!fronts.length) return items;
  return items.map((it) => {
    if (it.type !== 'spot' || !it.marker || it.model) return it;
    const { x, y } = it.point;
    const { w, h } = it.marker;
    const covered = fronts.some((f) => f.point.y > y && f.model.box.x0 < x + w / 2 && f.model.box.x1 > x - w / 2 && f.model.box.y0 < y && f.model.box.y1 > y - h);
    return covered ? { ...it, marker: null } : it;
  });
}

/** A spot item with its live 3D model's screen placement, once the model is ready. */
function withModel(it, models, wanted) {
  if (it.type !== 'spot' || !models.isReady(it.point.id)) return it;
  const p = models.placementOf(it.point.id);
  if (!p) return it;
  const w = wanted.find((x) => x.id === it.point.id);
  return { ...it, model: { box: p.box, lod: Boolean(w?.lod) } };
}
