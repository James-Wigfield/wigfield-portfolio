/* React side of the live 3D layer (models3d.js): load it the first time it's needed, hand it
   the wanted spots, the highlight and the colour tokens, and redraw the overlay when a model
   arrives or goes. Plus the tilt that goes with it (useTilt). */

import { useEffect, useEffectEvent, useReducer, useState } from 'react';
import { MAX_PITCH, MODEL_ZOOM, MODEL_ZOOM_OUT, REST_PITCH } from './models.js';

/** True past MODEL_ZOOM, until the map zooms back out below MODEL_ZOOM_OUT. */
export function useNear(map) {
  const [near, setNear] = useState(false);
  useEffect(() => {
    if (!map) return undefined;
    const check = () => setNear((n) => (n ? map.getZoom() >= MODEL_ZOOM_OUT : map.getZoom() >= MODEL_ZOOM));
    map.on('zoom', check);
    map.on('load', check);
    return () => {
      map.off('zoom', check);
      map.off('load', check);
    };
  }, [map]);
  return near;
}

/** Computed colours for the layer (the same probe trick as style.js: the built CSS minifies rgba()). */
function readColors(el) {
  const probe = document.createElement('span');
  probe.style.display = 'none';
  el.appendChild(probe);
  try {
    const read = (name) => {
      probe.style.color = '';
      probe.style.color = `var(${name})`;
      return getComputedStyle(probe).color;
    };
    return { shadow: read('--mr-marker-shadow'), accent: read('--mr-accent') };
  } finally {
    probe.remove();
  }
}

/**
 * map: the loaded map (or null). wanted: models.js wantedModels() (empty below the threshold).
 * → the layer once loaded ({ isReady(id), placementOf(id) }), else null. The layer outlives
 * an empty list (it's cheap: nothing is drawn), and goes with the map.
 */
export function useModels(map, wanted, { compact, selectedId, focusedId }) {
  const [layer, setLayer] = useState(null);
  const [, redraw] = useReducer((n) => n + 1, 0);
  const need = wanted.length > 0;

  useEffect(() => {
    if (!map || !need || layer) return undefined;
    let cancelled = false;
    import('./models3d.js').then(
      ({ ModelLayer }) => {
        if (cancelled) return;
        try {
          setLayer(new ModelLayer(map, { onChange: redraw }));
        } catch (err) {
          console.warn('[memory-rooms] 3D models on the map unavailable:', err?.message || err);
        }
      },
      (err) => console.warn('[memory-rooms] 3D models on the map unavailable:', err?.message || err),
    );
    return () => {
      cancelled = true;
    };
  }, [map, need, layer]);

  useEffect(() => () => layer?.destroy(), [layer]);

  const key = `${compact ? 'c' : 'w'}:${wanted.map((w) => `${w.id}@${w.key}`).join(',')}`;
  const hand = useEffectEvent(() => layer?.setWanted(wanted, { compact }));
  useEffect(() => hand(), [layer, key]);

  useEffect(() => {
    layer?.setHighlight(selectedId || null, focusedId || null);
  }, [layer, selectedId, focusedId]);

  // the tokens, now and whenever light/dark flips
  useEffect(() => {
    if (!layer || !map) return undefined;
    const paint = () => layer.setColors(readColors(map.getContainer()));
    paint();
    let mq = null;
    try {
      mq = window.matchMedia('(prefers-color-scheme: dark)');
      mq.addEventListener('change', paint);
    } catch {
      mq = null;
    }
    return () => mq?.removeEventListener('change', paint);
  }, [layer, map]);

  return layer;
}

/**
 * The map is flat (pitch 0, north up, no rotation) until models appear. Then rotation and tilt
 * unlock (up to MAX_PITCH) and, if the map is flat, it eases to REST_PITCH, the angle the
 * dioramas match their markers at. Zooming back out below the threshold eases it flat and north
 * up again and locks both. Nothing runs mid-gesture: changes wait for the move to end.
 */
export function useTilt(map, near) {
  useEffect(() => {
    if (!map) return undefined;
    let alive = true;
    let done = false;
    const apply = () => {
      if (done || !alive) return;
      done = true;
      if (near) {
        map.setMaxPitch(MAX_PITCH);
        map.dragRotate.enable();
        map.touchZoomRotate.enableRotation();
        map.touchPitch.enable();
        map.keyboard.enableRotation();
        if (map.getPitch() < 1) map.easeTo({ pitch: REST_PITCH, duration: 900 });
      } else {
        map.dragRotate.disable();
        map.touchZoomRotate.disableRotation();
        map.touchPitch.disable();
        map.keyboard.disableRotation();
        if (map.getPitch() > 0.5 || Math.abs(map.getBearing()) > 0.5) {
          map.easeTo({ pitch: 0, bearing: 0, duration: 600 });
          map.once('moveend', () => alive && map.setMaxPitch(0));
        } else map.setMaxPitch(0);
      }
    };
    if (map.isMoving()) map.once('moveend', apply);
    else apply();
    return () => {
      alive = false;
      map.off('moveend', apply);
    };
  }, [map, near]);
}
