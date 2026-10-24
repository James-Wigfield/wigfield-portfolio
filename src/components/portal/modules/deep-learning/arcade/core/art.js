import { useEffect, useState } from 'react';

/* ============================================================================
   GRADIENT ARCADE — PIXEL ART (optional polish, never a dependency)
   ----------------------------------------------------------------------------
   Sprites live in public/dl-arcade/ (PixelLab, 48 × 48, transparent). A
   component asks for one with useSprite(name) and gets its URL once the
   image has loaded, or null while loading or if it is missing, in which
   case it keeps drawing its procedural SVG. Results are cached per name.
   ========================================================================== */
export const ART_BASE = '/dl-arcade/';
const cache = new Map(); // name → 'ok' | 'bad' | Promise

function probe(name) {
  if (cache.has(name)) return cache.get(name);
  const p = new Promise((resolve) => {
    try {
      const img = new Image();
      img.onload = () => { cache.set(name, 'ok'); resolve('ok'); };
      img.onerror = () => { cache.set(name, 'bad'); resolve('bad'); };
      img.src = ART_BASE + name;
    } catch {
      cache.set(name, 'bad');
      resolve('bad');
    }
  });
  cache.set(name, p);
  return p;
}

export function useSprite(name) {
  // render reads the cache; the effect only re-renders once a probe settles
  const [, bump] = useState(0);
  useEffect(() => {
    if (!name || typeof cache.get(name) === 'string') return undefined;
    let live = true;
    probe(name).then(() => { if (live) bump((t) => t + 1); });
    return () => { live = false; };
  }, [name]);
  return name && cache.get(name) === 'ok' ? ART_BASE + name : null;
}
