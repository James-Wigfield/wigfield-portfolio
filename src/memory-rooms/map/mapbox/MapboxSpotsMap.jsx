/* The /memories map on Mapbox: a globe that opens on the trip (the USA + western
   Canada, or the trip's spots once there are some), spots as status dots, clusters
   that zoom in when clicked, zoom controls, the trip's place labels, and the preview
   card beside the selected spot (docked at the bottom on a phone).

   The map is made once per mount (useMapbox). Everything that changes with filters,
   clusters or cards is an SVG overlay redrawn from map.project() on every camera
   move, so none of it ever touches the map instance (every new map is billed).
   Clusters stay screen-space (clusters.js), not Mapbox's own: see SpotsMap.jsx. */

import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import { COPY } from '../../copy.js';
import { anchorOf, cardPosition } from '../cardPlace.js';
import { CLUSTER_PX, clusterPoints, clusterRadius } from '../clusters.js';
import { hasCoords, onMap } from '../geo.js';
import MapControls from '../MapControls.jsx';
import PlaceLabels from '../PlaceLabels.jsx';
import { ClusterCard, SpotCard } from '../SpotCard.jsx';
import { ClusterDot, SpotDot } from '../SpotDot.jsx';
import { TRIP_BOUNDS, boundsOf, nearestM, pxPerMetre, spanM, toScreen, zoomForPx, zoomForSpan } from './project.js';
import { useMapbox } from './useMapbox.js';

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

const homeCamera = (map, trip, padding) =>
  trip.length ? map.cameraForBounds(boundsOf(trip), { padding, maxZoom: AUTO_MAX_ZOOM }) : map.cameraForBounds(TRIP_BOUNDS, { padding });

export default function MapboxSpotsMap({ spots, selectedId, onSelect, elsewhereCount = 0, onElsewhere, compact = false, onFail, children }) {
  const [auto, setAuto] = useState(true); // the view follows homeCamera until the user moves it
  const [clusterIds, setClusterIds] = useState(null);
  const [cardEl, setCardEl] = useState(null);
  const [cardH, setCardH] = useState(320);
  const pendingReveal = useRef(null);
  const homeFor = useRef(null);
  const dotR = compact ? DOT_R.compact : DOT_R.wide;
  const clusterBase = compact ? CLUSTER_BASE.compact : CLUSTER_BASE.wide;
  const pad = compact ? PAD_COMPACT : PAD_WIDE;

  const { setContainer, map, size, option } = useMapbox(
    { camera: { bounds: TRIP_BOUNDS, padding: compact ? 24 : 56 }, minZoom: MIN_ZOOM, maxZoom: MAX_ZOOM, placeLabelsFrom: TOWN_LABELS_FROM, timeout: 12000 },
    onFail,
  );
  const ready = Boolean(map && size?.w && size?.h);

  const points = useMemo(() => spots.filter(hasCoords).map((spot) => ({ id: spot.id, lat: spot.lat, lng: spot.lng, spot })), [spots]);
  const trip = useMemo(() => points.filter((p) => onMap(p)), [points]);
  const away = useMemo(() => (points.length === trip.length ? NO_POINTS : points.filter((p) => !onMap(p))), [points, trip]);

  /* ── the view ───────────────────────────────────────────────────────────── */

  // Follow the home view while auto: jump on the first fit and on resizes, fly otherwise.
  useEffect(() => {
    if (!ready || !auto) return;
    const cam = homeCamera(map, trip, pad);
    if (!cam) return;
    const prev = homeFor.current;
    homeFor.current = size;
    if (!prev || prev.w !== size.w || prev.h !== size.h) map.jumpTo(cam);
    else map.flyTo({ ...cam, maxDuration: 1600 });
  }, [ready, map, size, auto, trip, pad]);

  // Any drag, pinch, wheel or key the user makes ends auto.
  useEffect(() => {
    if (!map) return undefined;
    const leave = (e) => e.originalEvent && setAuto(false);
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

  /* ── markers (recomputed every frame: a few hundred spots at most) ──────── */

  const screen = [];
  if (ready) {
    for (const p of points) {
      const q = toScreen(map, p, size, 24);
      if (q) screen.push({ ...p, x: q.x, y: q.y });
    }
  }
  const items = clusterPoints(screen, CLUSTER_PX);
  const avoid = items.map((it) =>
    it.type === 'spot' ? { x: it.point.x, y: it.point.y, r: dotR + 4 } : { x: it.x, y: it.y, r: clusterRadius(it.members.length, clusterBase) + 3 },
  );
  const zoom = ready ? map.getZoom() : null;
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

  // A tap on the map itself (not a marker: those sit in the overlay) closes the card.
  const onMapClick = useEffectEvent(() => close());
  useEffect(() => {
    if (!map) return undefined;
    const h = () => onMapClick();
    map.on('click', h);
    return () => map.off('click', h);
  }, [map]);

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

  // The note under the map: spots outside the trip area. The globe turns to them.
  const showAway = () => {
    onElsewhere?.();
    if (!ready || !away.length) return;
    const cam = map.cameraForBounds(boundsOf(away), { padding: pad, maxZoom: AUTO_MAX_ZOOM });
    if (cam) moveTo(cam);
  };

  const cardStyle = !compact && size && (selected || clusterSpots) ? cardPosition(anchor, size, cardH) : undefined;

  // Selected item drawn last so its ring sits on top.
  const ordered = [...items].sort((a, b) => {
    const sa = a.type === 'spot' ? a.point.id === selectedId : a.id === anchor?.cluster;
    const sb = b.type === 'spot' ? b.point.id === selectedId : b.id === anchor?.cluster;
    return sa - sb;
  });

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
        data-auto={auto ? '' : undefined}
        aria-label={COPY.map.globeLabel}
        role="region"
      />
      {ready && (
        <svg className="mr-mapoverlay" width={size.w} height={size.h} viewBox={`0 0 ${size.w} ${size.h}`} role="group" aria-label={COPY.map.spotsLabel}>
          <PlaceLabels toScreen={placeToScreen} size={size} avoid={avoid} show={showLabels} />
          <g className="mr-mapspots">
            {ordered.map((it) =>
              it.type === 'spot' ? (
                <SpotDot key={it.point.id} point={it.point} r={dotR} selected={it.point.id === selectedId} onActivate={() => pick(it.point.id)} />
              ) : (
                <ClusterDot key={it.id} item={it} base={clusterBase} selected={it.id === anchor?.cluster} onActivate={() => openCluster(it)} />
              ),
            )}
          </g>
        </svg>
      )}

      <MapControls
        onIn={() => zoomBy(1)}
        onOut={() => zoomBy(-1)}
        onReset={() => setAuto(true)}
        canIn={!ready || zoom < MAX_ZOOM - 0.01}
        canReset={!auto}
        resetLabel={COPY.map.zoomHome}
      />

      {elsewhereCount > 0 && (
        <button type="button" className="mr-map-note" onClick={showAway} data-mr="elsewhere-note">
          {COPY.map.elsewhere(elsewhereCount)}
        </button>
      )}

      {children}

      {selected && <SpotCard key={selected.id} spot={selected} style={cardStyle} compact={compact} cardRef={setCardEl} onClose={close} />}
      {!selected && clusterSpots && (
        <ClusterCard spots={clusterSpots} style={cardStyle} compact={compact} cardRef={setCardEl} onPick={pick} onClose={close} />
      )}
    </div>
  );
}
