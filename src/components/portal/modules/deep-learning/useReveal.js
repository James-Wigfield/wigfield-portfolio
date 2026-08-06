import { useEffect, useRef, useState } from 'react';

// IntersectionObserver entrance hook: returns [ref, seen]. Elements start
// hidden (kit.css) and get their entrance class once scrolled into view.
// Environments without IntersectionObserver just render visible immediately.
export function useReveal(margin = '-40px') {
  const ref = useRef(null);
  const [seen, setSeen] = useState(() => typeof IntersectionObserver === 'undefined');
  useEffect(() => {
    const el = ref.current;
    if (!el || seen || typeof IntersectionObserver === 'undefined') return undefined;
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setSeen(true)),
      { rootMargin: `0px 0px ${margin} 0px`, threshold: 0.05 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [seen, margin]);
  return [ref, seen];
}
