import { useEffect, useState } from 'react';

/* The width of an element, kept live (labs pick a simpler picture when
   their stage is narrow, rather than shrinking the wide one). */
export function useWidth(ref, fallback = 800) {
  const [w, setW] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver((entries) => setW(entries[0].contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return w;
}
