/* The spots layer of both map engines, in screen pixels: rendered spots standing as their
   marker images, or as invisible buttons over their live 3D models (Mapbox past zoom 15, drawn
   by mapbox/models3d.js under this overlay), in painter's order so the one lower on screen is in
   front; then the plain status dots and the clusters on top, so a captured spot is never hidden
   behind a marker. The selected item is drawn last in its layer so its ring sits on top. */

import { useId } from 'react';
import { ClusterDot, SpotDot, SpotMarker, SpotModel } from './SpotDot.jsx';

const stands = (it) => it.type === 'spot' && Boolean(it.marker || it.model);

/**
 * items: clusterPoints() → withMarkers() items (+ `model` placements on the Mapbox map).
 * selectedId: the open spot; selectedCluster: the cluster id the card points at.
 * onPick(id), onCluster(item), onFocusChange(id | null) (keyboard focus on a 3D model).
 * passThrough: markers, models and cluster fans let the pointer through to the map (so a drag
 * on one still pans it); the map's own click finds them instead (MapboxSpotsMap hitAt), and
 * `hoverId` is the one under the mouse. The keyboard still uses these buttons.
 */
export default function MapSpots({ items, selectedId, selectedCluster, dotR, clusterBase, onPick, onCluster, onFocusChange, hoverId = null, passThrough = false }) {
  const shadowId = `mr-shadow-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const isSelected = (it) => (it.type === 'spot' ? it.point.id === selectedId : it.id === selectedCluster);
  const standing = items.filter(stands).sort((a, b) => isSelected(a) - isSelected(b) || a.point.y - b.point.y);
  const rest = items.filter((it) => !stands(it)).sort((a, b) => isSelected(a) - isSelected(b));

  return (
    <g className="mr-mapspots">
      <defs>
        <radialGradient id={shadowId}>
          <stop offset="0" className="mr-marker-shadow-stop" />
          <stop offset="0.55" className="mr-marker-shadow-stop" data-mid="" />
          <stop offset="1" className="mr-marker-shadow-stop" data-edge="" />
        </radialGradient>
      </defs>
      {standing.map((it) =>
        it.model ? (
          <SpotModel key={it.point.id} point={it.point} model={it.model} selected={it.point.id === selectedId} hover={hoverId === it.point.id} passThrough={passThrough} onActivate={() => onPick(it.point.id)} onFocusChange={onFocusChange} />
        ) : (
          <SpotMarker key={it.point.id} point={it.point} marker={it.marker} shadowId={shadowId} selected={it.point.id === selectedId} hover={hoverId === it.point.id} passThrough={passThrough} onActivate={() => onPick(it.point.id)} />
        ),
      )}
      {rest.map((it) =>
        it.type === 'spot' ? (
          <SpotDot key={it.point.id} point={it.point} r={dotR} selected={it.point.id === selectedId} hover={hoverId === it.point.id} onActivate={() => onPick(it.point.id)} />
        ) : (
          <ClusterDot
            key={it.id}
            item={it}
            base={clusterBase}
            selected={it.id === selectedCluster}
            hover={hoverId === it.id || (hoverId != null && it.members.some((m) => m.id === hoverId))}
            passThrough={passThrough}
            onActivate={() => onCluster(it)}
          />
        ),
      )}
    </g>
  );
}
