import { useEffect, useState } from 'react';

/* Arrow-key movement for the focusable grid widgets (paint grids, neuron
   pickers). Returns the next { r, c } or null when the key isn't ours. */
export function gridStep(key, { r, c }, rows, cols) {
  switch (key) {
    case 'ArrowUp': return { r: Math.max(0, r - 1), c };
    case 'ArrowDown': return { r: Math.min(rows - 1, r + 1), c };
    case 'ArrowLeft': return { r, c: Math.max(0, c - 1) };
    case 'ArrowRight': return { r, c: Math.min(cols - 1, c + 1) };
    case 'Home': return { r, c: 0 };
    case 'End': return { r, c: cols - 1 };
    default: return null;
  }
}

// Map a pointer event to a cell of an SVG grid drawn at (x0, y0) with `cell`
// sized squares, using the SVG's own coordinate system.
export function svgCell(e, svg, x0, y0, cell, rows, cols) {
  const pt = svgPoint(e, svg);
  if (!pt) return null;
  const c = Math.floor((pt.x - x0) / cell);
  const r = Math.floor((pt.y - y0) / cell);
  return r >= 0 && r < rows && c >= 0 && c < cols ? { r, c } : null;
}

export function svgPoint(e, svg) {
  if (!svg) return null;
  const ctm = svg.getScreenCTM?.();
  if (!ctm) return null;
  const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
  return { x: p.x, y: p.y };
}

// prefers-reduced-motion, kept live.
export function useReducedMotion() {
  const [reduced, setReduced] = useState(() => {
    try {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
      return false;
    }
  });
  useEffect(() => {
    let mq;
    try {
      mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    } catch {
      return undefined;
    }
    const on = () => setReduced(mq.matches);
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);
  return reduced;
}

export function prefersReducedMotion() {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}
