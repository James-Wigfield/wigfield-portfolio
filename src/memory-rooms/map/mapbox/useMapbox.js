/* One Mapbox map for the life of the component that owns it.

   Every `new mapboxgl.Map()` is a billable map load, so the map is created once, when
   the container first mounts, and never again: nothing the component renders later
   (filters, clusters, cards, pins) reaches this effect. React StrictMode's dev-only
   mount → unmount → mount can't double it either: the module import is async, and the
   first mount's cleanup cancels it before a map exists.

   `frame` changes on every camera move (useSyncExternalStore, so React draws the
   overlay in the same frame as the map). */

import { useCallback, useEffect, useEffectEvent, useRef, useState, useSyncExternalStore } from 'react';
import { loadMapbox } from './engine.js';
import { applyLook, onZoomEnd, styleChoice, styleOptions } from './style.js';

/**
 * opts (read once, at mount):
 *   camera            { center: [lng, lat], zoom } | { bounds: [[w, s], [e, n]], padding }
 *   minZoom, maxZoom
 *   placeLabelsFrom   zoom below which the base map's town labels stay hidden (0 = never hidden)
 *   timeout           ms to wait for the first full load before giving up
 *   antialias         MSAA on the map's canvas (the spots map: its 3D dioramas share it)
 * onFail(reason)      'import' | 'webgl' | 'token' | 'style' | 'timeout': swap to the atlas.
 * → { setContainer, map (null until loaded), size, frame, option }
 */
export function useMapbox(opts, onFail) {
  const [el, setEl] = useState(null);
  const [map, setMap] = useState(null);
  const [size, setSize] = useState(null);
  const [initial] = useState(opts);
  const [option] = useState(styleChoice);
  const version = useRef(0);
  const failed = useEffectEvent((reason, err) => onFail?.(reason, err));

  useEffect(() => {
    if (!el) return undefined;
    const ro = new ResizeObserver(([e]) => {
      const next = { w: Math.round(e.contentRect.width), h: Math.round(e.contentRect.height) };
      setSize((prev) => (prev && prev.w === next.w && prev.h === next.h ? prev : next));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);

  useEffect(() => {
    if (!el) return undefined;
    let cancelled = false;
    let loaded = false;
    let m = null;
    let timer = 0;
    let scheme = null;
    const { camera, minZoom = 0, maxZoom = 18, placeLabelsFrom = 0, timeout = 12000, antialias = false } = initial;
    // Repainting is ours, not a load failure: a property Mapbox rejects is warned about
    // and skipped (its 'error' event fires while `painting`), never fatal.
    let painting = false;
    const look = () => {
      if (!m) return;
      painting = true;
      try {
        applyLook(m, option, el, { placeLabelsFrom });
      } catch (err) {
        console.warn('[memory-rooms] map style tweak failed', err);
      } finally {
        painting = false;
      }
    };

    const stop = (reason, err) => {
      if (cancelled) return;
      cancelled = true;
      clearTimeout(timer);
      scheme?.removeEventListener('change', look);
      try {
        m?.remove();
      } catch {
        /* already gone */
      }
      m = null;
      delete el.__mrMap;
      setMap(null);
      console.warn(`[memory-rooms] Mapbox map unavailable (${reason}), using the atlas.`, err?.status ? `HTTP ${err.status}` : err?.message || '');
      failed(reason, err);
    };

    loadMapbox().then(
      (mapboxgl) => {
        if (cancelled) return;
        try {
          m = new mapboxgl.Map({
            container: el,
            ...styleOptions(option, el),
            projection: 'globe',
            ...(camera.bounds ? { bounds: camera.bounds, fitBoundsOptions: { padding: camera.padding ?? 24 } } : { center: camera.center, zoom: camera.zoom }),
            minZoom,
            maxZoom,
            antialias,
            attributionControl: false,
            logoPosition: 'bottom-left',
            // Flat and north up. The spots map unlocks rotation and tilt (right-drag does both)
            // only while 3D models are up (useModels.js useTilt); the pick map never does.
            dragRotate: false,
            pitchWithRotate: true,
            touchPitch: false,
            maxPitch: 0,
            performanceMetricsCollection: false,
          });
        } catch (err) {
          stop('webgl', err);
          return;
        }
        // For the checks (tools/memory-rooms/page-check.mjs): loads are counted (one per page,
        // ever) and the container holds its map so a check can move the camera.
        window.__mrMapLoads = (window.__mrMapLoads || 0) + 1;
        el.__mrMap = m;
        m.touchZoomRotate.disableRotation();
        m.keyboard.disableRotation();
        m.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-left');
        m.on('style.load', look);
        m.on('zoomend', () => onZoomEnd(m, option, placeLabelsFrom));
        m.once('load', () => {
          if (cancelled) return;
          loaded = true;
          clearTimeout(timer);
          setMap(m);
        });
        // Before the first load, a style or token error means no map; after it, a failed
        // tile is just a gap (and handling the event keeps Mapbox from logging it).
        m.on('error', (e) => {
          if (painting) {
            console.warn('[memory-rooms] map style tweak rejected:', e?.error?.message || e);
            return;
          }
          if (loaded || cancelled) return;
          const status = e?.error?.status;
          if (status === 401 || status === 403) stop('token', e.error);
          else if (!e?.sourceId && !e?.tile) stop('style', e?.error);
        });
        m.on('webglcontextlost', () => stop('webgl'));
        timer = setTimeout(() => stop('timeout'), timeout);
        try {
          scheme = window.matchMedia('(prefers-color-scheme: dark)');
          scheme.addEventListener('change', look);
        } catch {
          scheme = null;
        }
      },
      (err) => stop('import', err),
    );

    return () => {
      cancelled = true;
      clearTimeout(timer);
      scheme?.removeEventListener('change', look);
      delete el.__mrMap;
      if (m) m.remove();
      m = null;
      setMap(null);
    };
    // The map is made once per container; `initial` and `option` are fixed at mount.
  }, [el, initial, option]);

  useEffect(() => {
    if (map && size) map.resize();
  }, [map, size]);

  const subscribe = useCallback(
    (cb) => {
      if (!map) return () => {};
      const on = () => {
        version.current += 1;
        cb();
      };
      map.on('move', on);
      map.on('resize', on);
      return () => {
        map.off('move', on);
        map.off('resize', on);
      };
    },
    [map],
  );
  const frame = useSyncExternalStore(subscribe, () => version.current);

  return { setContainer: setEl, map, size, frame, option };
}
