import { useEffect, useState } from 'react';
import { useIntersectionObserver } from '../hooks/useIntersectionObserver';

/* Counts a number up from zero when it scrolls into view (ease-out cubic).
   Respects prefers-reduced-motion by starting at — and staying on — the final
   value, so the effect never has to set state synchronously. */
export default function CountUp({ to, decimals = 0, prefix = '', suffix = '', duration = 1100 }) {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const [ref, visible] = useIntersectionObserver({ threshold: 0.4 });
  const [val, setVal] = useState(reduce ? to : 0);

  useEffect(() => {
    if (!visible || reduce) return;
    let raf;
    let start;
    const tick = (ts) => {
      if (start === undefined) start = ts;
      const p = Math.min(1, (ts - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(to * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [visible, reduce, to, duration]);

  return (
    <span ref={ref}>
      {prefix}{val.toFixed(decimals)}{suffix}
    </span>
  );
}
