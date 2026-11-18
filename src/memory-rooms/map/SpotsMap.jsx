/* The /memories map: a Mapbox globe (mapbox/MapboxSpotsMap.jsx) when the token, WebGL 2
   and the network allow, else the SVG atlas (AtlasSpotsMap.jsx). A Mapbox map that
   fails to load swaps to the atlas in place; the selection lives in the page, so it
   survives the swap. Same props either way.

   Clustering: both engines use the screen-space clusters.js, not Mapbox's own
   (supercluster on a GeoJSON source). Clusters drawn by Mapbox are WebGL symbols: no
   status glyphs (ring / half / filled) from the CSS tokens, no focus or aria, members
   only via an async query, and they regroup per integer zoom. clusters.js on
   map.project() points keeps the markers as real buttons, the "rooms of one building
   never split" list, the card anchoring and the label avoidance, identical on both
   engines, and is plenty fast for the few hundred spots a trip makes. */

import { useMapEngine } from './mapbox/engine.js';
import MapboxSpotsMap from './mapbox/MapboxSpotsMap.jsx';
import AtlasSpotsMap from './AtlasSpotsMap.jsx';

export default function SpotsMap(props) {
  const [choice, fail] = useMapEngine();
  if (choice.engine === 'mapbox') return <MapboxSpotsMap {...props} onFail={fail} />;
  return <AtlasSpotsMap {...props} engineReason={choice.reason} />;
}
