/* Which engine draws a /memories map: Mapbox GL JS (a globe) when it can, else the
   hand-built SVG atlas (map/AtlasMap.jsx), which needs no network and no WebGL.

   Mapbox is used only when there is a token, WebGL 2 works and the browser is online
   (the capture flow must open with no signal). A map that fails later (style or token
   error, slow network, lost GPU) calls back and the page swaps to the atlas.

   Billing: every `new mapboxgl.Map()` is one map load (5,000 a month on the trial), so
   each page creates its map once; nothing here creates a map by itself.

   Overrides for checks and debugging: `?map=atlas` / `?map=mapbox` in the URL, or
   localStorage `mr:map` = 'atlas' | 'mapbox'. */

import { useCallback, useState } from 'react';

export const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || '';

function override(key, param, allowed) {
  try {
    const q = new URLSearchParams(window.location.search).get(param);
    if (allowed.includes(q)) return q;
    const s = localStorage.getItem(key);
    if (allowed.includes(s)) return s;
  } catch {
    /* storage blocked */
  }
  return null;
}

/** 'atlas' | 'mapbox' | null, from ?map= or localStorage mr:map. */
export const engineOverride = () => override('mr:map', 'map', ['atlas', 'mapbox']);

let webgl2 = null;
/** Mapbox GL JS v3 needs WebGL 2 (same test as its own: a context that compiles a shader). */
export function hasWebGL2() {
  if (webgl2 !== null) return webgl2;
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    let ok = Boolean(gl) && !gl.isContextLost();
    if (ok) {
      const sh = gl.createShader(gl.VERTEX_SHADER);
      gl.shaderSource(sh, 'void main() {}');
      gl.compileShader(sh);
      ok = gl.getShaderParameter(sh, gl.COMPILE_STATUS) === true;
      gl.deleteShader(sh);
    }
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
    webgl2 = ok;
  } catch {
    webgl2 = false;
  }
  return webgl2;
}

// A GPU failure sticks for the session; network failures don't (the next map tries again).
let gpuBroken = false;

/** { engine: 'mapbox' | 'atlas', reason } for a map about to mount. */
export function chooseEngine() {
  const forced = engineOverride();
  if (forced === 'atlas') return { engine: 'atlas', reason: 'override' };
  if (!MAPBOX_TOKEN) return { engine: 'atlas', reason: 'no-token' };
  if (gpuBroken || !hasWebGL2()) return { engine: 'atlas', reason: 'webgl' };
  if (forced !== 'mapbox' && typeof navigator !== 'undefined' && navigator.onLine === false) return { engine: 'atlas', reason: 'offline' };
  return { engine: 'mapbox', reason: null };
}

/** [choice, fail(reason)]: fail swaps this map to the atlas for the rest of its life. */
export function useMapEngine() {
  const [choice, setChoice] = useState(chooseEngine);
  const fail = useCallback((reason) => {
    if (reason === 'webgl') gpuBroken = true;
    setChoice((c) => (c.engine === 'atlas' ? c : { engine: 'atlas', reason }));
  }, []);
  return [choice, fail];
}

let loading = null;
/** The mapbox-gl module (and its CSS), fetched on first use only; /memories maps are the only callers. */
export function loadMapbox() {
  if (!loading) {
    loading = Promise.all([import('mapbox-gl'), import('mapbox-gl/dist/mapbox-gl.css')]).then(([mod]) => {
      const mapboxgl = mod.default || mod;
      mapboxgl.accessToken = MAPBOX_TOKEN;
      return mapboxgl;
    });
    // Offline now doesn't mean offline later: forget a failed fetch.
    loading.catch(() => {
      loading = null;
    });
  }
  return loading;
}
