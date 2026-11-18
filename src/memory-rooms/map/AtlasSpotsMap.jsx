/* The /memories map on the SVG atlas (the fallback when Mapbox can't run, see
   SpotsMap.jsx): spots as status dots, clusters that zoom in when clicked,
   zoom controls, and the preview card beside the selected spot (docked at the
   bottom of the screen on a phone). Opens framed on the spots. Layout-free: the
   page decides how big it is. */

import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import { COPY } from '../copy.js';
import AtlasMap from './AtlasMap.jsx';
import { anchorOf, cardPosition } from './cardPlace.js';
import MapControls from './MapControls.jsx';
import MapSpots from './MapSpots.jsx';
import { useMarkerImages } from './markerImages.js';
import { atlasZoom, avoidOf, markerPx, withMarkers } from './markers.js';
import { ClusterCard, SpotCard } from './SpotCard.jsx';
import { CLUSTER_PX, clusterPoints, worldBox } from './clusters.js';
import { onMap, project } from './geo.js';
import { useMapViewport } from './useMapViewport.js';
import { HOME, baseScale, fitBox, transformOf } from './zoom.js';
import FlyoverOverlay from './flyover/FlyoverOverlay.jsx';
import { NO_FLY } from './flyover/useFlyover.js';
import { atlasRoutePath, useFlyoverAtlas } from './flyover/useFlyoverAtlas.js';

const NO_LEGS = [];

/* Opening view: the spots, never closer than about a region. Padding keeps markers
   clear of the controls (a row along the bottom on a phone, a stack bottom-right). */
const AUTO_MAX_K = 5;
const PAD_COMPACT = { t: 28, r: 24, b: 76, l: 24 };
const PAD_WIDE = { t: 56, r: 104, b: 56, l: 56 };
const DOT_R = { compact: 7, wide: 5.5 };
const CLUSTER_BASE = { compact: 13, wide: 11 };

function minDistance(members, from) {
  let d = Infinity;
  for (const a of from ? [from] : members) {
    for (const b of members) if (a !== b && a.id !== b.id) d = Math.min(d, Math.hypot(a.wx - b.wx, a.wy - b.wy));
  }
  return d;
}

export default function AtlasSpotsMap({ spots, selectedId, onSelect, elsewhereCount = 0, onElsewhere, compact = false, engineReason = null, fly = NO_FLY, flyStops = NO_LEGS, flyLegs = NO_LEGS, children }) {
  const [clusterIds, setClusterIds] = useState(null);
  const [cardEl, setCardEl] = useState(null);
  const [cardH, setCardH] = useState(320);
  const pendingReveal = useRef(null);
  const dotR = compact ? DOT_R.compact : DOT_R.wide;
  const clusterBase = compact ? CLUSTER_BASE.compact : CLUSTER_BASE.wide;

  const points = useMemo(
    () =>
      spots.filter(onMap).map((spot) => {
        const [wx, wy] = project(spot.lat, spot.lng);
        return { id: spot.id, wx, wy, spot };
      }),
    [spots],
  );

  const auto = useCallback(
    (sz) => (points.length ? fitBox(worldBox(points), sz, { pad: compact ? PAD_COMPACT : PAD_WIDE, maxK: AUTO_MAX_K }) : HOME),
    [points, compact],
  );
  const vp = useMapViewport({ auto });
  const { t, size } = vp;
  const maxK = vp.maxK;
  // "Play the trip" on the atlas: pan/zoom from stop to stop, the route as an SVG path (no 3D).
  const flyOn = fly.active && fly.count > 0;
  useFlyoverAtlas(vp, flyOn ? fly : NO_FLY, flyStops, compact);
  const route = flyOn ? atlasRoutePath(flyLegs, fly.index, fly.phase, t) : '';

  // Rendered spots stand as their marker images (same sizes as on the globe at the same scale);
  // laid out on every render, so a marker image arriving (useMarkerImages) redraws them.
  useMarkerImages();
  const clustered = useMemo(
    () => (t ? clusterPoints(points.map((p) => ({ ...p, x: p.wx * t.s + t.tx, y: p.wy * t.s + t.ty })), CLUSTER_PX) : []),
    [points, t],
  );
  const items = t ? withMarkers(clustered, markerPx(atlasZoom(t.s), compact)) : clustered;

  // Where markers sit, so place labels keep clear of them.
  const avoid = avoidOf(items, dotR, clusterBase);

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
    const sz = vp.size;
    if (!sz || !sz.w || !sz.h) {
      pendingReveal.current = id;
      return;
    }
    const p = points.find((q) => q.id === id);
    if (!p) return;
    const view = vp.getView();
    const t0 = transformOf(view, sz);
    const x = p.wx * t0.s + t0.tx;
    const y = p.wy * t0.s + t0.ty;
    const m = compact ? 32 : 48;
    const off = x < m || x > sz.w - m || y < m || y > sz.h - m;
    let k = view.k;
    const clustered = items.some((it) => it.type === 'cluster' && it.members.some((mm) => mm.id === id));
    if (clustered) {
      const d = minDistance(points, p);
      if (Number.isFinite(d) && d > 1e-7) k = Math.min(maxK, Math.max(k, (CLUSTER_PX + 12) / (d * baseScale(sz))));
    }
    if (!off && k === view.k) return;
    vp.animateTo({ k, cx: p.wx, cy: p.wy });
  });

  useEffect(() => {
    if (selectedId) reveal(selectedId);
  }, [selectedId]);

  useEffect(() => {
    if (size?.w && size?.h && pendingReveal.current) {
      const id = pendingReveal.current;
      pendingReveal.current = null;
      reveal(id);
    }
  }, [size]);

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
    const sz = vp.size;
    if (!sz) return;
    const cur = vp.getView().k;
    const dmin = minDistance(item.members);
    const ids = item.members.map((m) => m.id);
    const box = worldBox(item.members);
    // Rooms of one building (or spots metres apart) never split, even fully zoomed: list them.
    const span = Math.hypot(box.x1 - box.x0, box.y1 - box.y0);
    if (!(dmin > 1e-7) || span * baseScale(sz) * maxK < CLUSTER_PX + 4) {
      setClusterIds(ids);
      onSelect(null);
      return;
    }
    const fitted = fitBox(box, sz, { pad: compact ? 56 : 96 });
    const kSep = (CLUSTER_PX + 12) / (dmin * baseScale(sz));
    const k = Math.min(maxK, Math.max(cur * 1.8, Math.min(fitted.k, kSep * 1.4)));
    if (k <= cur * 1.05) {
      setClusterIds(ids);
      onSelect(null);
      return;
    }
    setClusterIds(null);
    onSelect(null);
    vp.animateTo({ k, cx: (box.x0 + box.x1) / 2, cy: (box.y0 + box.y1) / 2 });
  };

  const cardStyle = !compact && size && (selected || clusterSpots) ? cardPosition(anchor, size, cardH) : undefined;

  return (
    <div className="mr-spotsmap" data-compact={compact ? '' : undefined} data-engine="atlas" data-engine-reason={engineReason || undefined}>
      <AtlasMap vp={vp} dataMr="map" label={COPY.map.mapLabel} onBackgroundTap={close} avoid={avoid}>
        {route && <path className="mr-fly-route" d={route} data-mr="fly-route" />}
        <MapSpots
          items={items}
          selectedId={selectedId}
          selectedCluster={anchor?.cluster}
          dotR={dotR}
          clusterBase={clusterBase}
          onPick={pick}
          onCluster={openCluster}
        />
      </AtlasMap>

      <MapControls onIn={() => vp.zoomBy(2)} onOut={() => vp.zoomBy(0.5)} onReset={() => vp.reset()} canIn={vp.view.k < maxK - 0.01} canReset={!vp.isAuto} />

      {elsewhereCount > 0 && (
        <button type="button" className="mr-map-note" onClick={onElsewhere} data-mr="elsewhere-note">
          {COPY.map.elsewhere(elsewhereCount)}
        </button>
      )}

      {children}
      {flyOn && <FlyoverOverlay fly={fly} engine="atlas" />}

      {selected && (
        <SpotCard key={selected.id} spot={selected} style={cardStyle} compact={compact} cardRef={setCardEl} onClose={close} />
      )}
      {!selected && clusterSpots && (
        <ClusterCard spots={clusterSpots} style={cardStyle} compact={compact} cardRef={setCardEl} onPick={pick} onClose={close} />
      )}
    </div>
  );
}
