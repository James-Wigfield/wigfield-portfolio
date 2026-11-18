/* The flyover on the SVG atlas (the fallback map): the simpler version. The atlas pans and
   zooms to each stop (no 3D, no orbit), the route is an SVG path in its overlay, and a stop
   off the atlas (it only draws North America, so the Perth spots) shows its caption over the
   whole trip. Same state machine as the globe (useFlyover.js), same controls. */

import { useEffect, useEffectEvent } from 'react';
import { worldBox } from '../clusters.js';
import { onMap, project } from '../geo.js';
import { viewTween } from '../zoom.js';
import { FADE_MS } from './useFlyover.js';
import { routeCoords } from './plan.js';

const STOP_K = 6;
const PAD = { compact: { t: 40, r: 32, b: 200, l: 32 }, wide: { t: 64, r: 104, b: 140, l: 64 } };

function worldPoints(stops) {
  return stops.filter(onMap).map((s) => {
    const [wx, wy] = project(s.lat, s.lng);
    return { wx, wy };
  });
}

export function useFlyoverAtlas(vp, fly, stops, compact) {
  const { active, index, phase, playing, stepping, reduced } = fly;
  const sized = Boolean(vp.size?.w && vp.size?.h);
  const arrive = useEffectEvent((i) => fly.arrived(i));
  const ctl = useEffectEvent((what, arg) => {
    if (what === 'get') return { auto: vp.isAuto, view: vp.getView() };
    if (what === 'back') return arg.auto ? vp.reset() : vp.animateTo(arg.view);
    if (what === 'hold') return vp.animateTo(vp.getView());
    if (what === 'fit') {
      const pts = worldPoints(stops);
      return pts.length ? vp.fit(worldBox(pts), { pad: compact ? PAD.compact : PAD.wide, maxK: STOP_K }) : null;
    }
    // 'go': to stop `arg`, → how long the move takes
    const stop = stops[arg];
    let to;
    if (stop && onMap(stop)) {
      const [cx, cy] = project(stop.lat, stop.lng);
      to = { k: STOP_K, cx, cy };
    } else {
      const pts = worldPoints(stops);
      if (!pts.length) return 0;
      const b = worldBox(pts);
      to = { k: Math.min(vp.getView().k, 1.4), cx: (b.x0 + b.x1) / 2, cy: (b.y0 + b.y1) / 2 };
    }
    const ms = reduced ? 0 : viewTween(vp.getView(), to, vp.size).duration;
    vp.animateTo(to);
    return ms;
  });

  useEffect(() => {
    if (!active || !sized) return undefined;
    if (phase === 'end') {
      ctl('fit');
      return undefined;
    }
    if (phase !== 'flying' || !(playing || stepping)) return undefined;
    let later = 0;
    const timer = setTimeout(
      () => {
        const ms = ctl('go', index);
        later = setTimeout(() => arrive(index), ms + 60);
      },
      reduced ? FADE_MS : 0,
    );
    return () => {
      clearTimeout(timer);
      clearTimeout(later);
      if (!reduced) ctl('hold');
    };
  }, [active, sized, index, phase, playing, stepping, reduced]);

  // Start / exit: put the view back as it was. Declared AFTER the camera effect on purpose: React
  // runs cleanups in order, so the camera's "hold" (which halts a move) runs first, then this.
  useEffect(() => {
    if (!active) return undefined;
    const saved = ctl('get');
    return () => ctl('back', saved);
  }, [active]);
}

/** The route flown so far, as screen-space SVG path data for the atlas overlay (t = its transform). */
export function atlasRoutePath(legs, index, phase, t) {
  if (!t) return '';
  const upTo = phase === 'flying' ? index - 1 : index;
  let d = '';
  for (const line of routeCoords(legs, upTo, 1)) {
    let pen = false;
    for (const [lng, lat] of line) {
      const wrapped = ((lng + 540) % 360) - 180;
      // the atlas only draws North America: a leg leaves the map where it leaves that
      const p = onMap({ lat, lng: wrapped }) ? project(lat, wrapped) : null;
      if (!p) {
        pen = false;
        continue;
      }
      d += `${pen ? 'L' : 'M'}${(p[0] * t.s + t.tx).toFixed(1)} ${(p[1] * t.s + t.ty).toFixed(1)}`;
      pen = true;
    }
  }
  return d;
}
