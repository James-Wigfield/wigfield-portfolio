/* The capture flow's location picker (step 4): Mapbox (mapbox/MapboxPickMap.jsx) when
   the token, WebGL 2 and the network allow, else the SVG atlas (AtlasPickMap.jsx).
   Captures happen with no signal too: offline, or when the map can't load in a few
   seconds, the atlas draws instead (it needs no network). Same props either way. */

import { useEffect } from 'react';
import { useMapEngine } from './mapbox/engine.js';
import MapboxPickMap from './mapbox/MapboxPickMap.jsx';
import AtlasPickMap from './AtlasPickMap.jsx';

export default function PickMap(props) {
  const [choice, fail] = useMapEngine();
  const mapbox = choice.engine === 'mapbox';

  // Losing signal mid-capture: new tiles won't come, so hand over to the atlas now.
  useEffect(() => {
    if (!mapbox) return undefined;
    const off = () => fail('offline');
    window.addEventListener('offline', off);
    return () => window.removeEventListener('offline', off);
  }, [mapbox, fail]);

  if (mapbox) return <MapboxPickMap {...props} onFail={fail} />;
  return <AtlasPickMap {...props} engineReason={choice.reason} />;
}
