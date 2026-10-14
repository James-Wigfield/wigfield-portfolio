import { useEffect, useState } from 'react';

/** True once `seconds` have passed since the slide went live (false whenever it is not live).
 *  A clip that starts partway through a slide waits, paused on its first frame and preloaded,
 *  and starts on this, so a late start can never pull it out of step with the slide. */
export function useAt(live, seconds) {
  const [hit, setHit] = useState(false);
  useEffect(() => {
    if (!live) return undefined;
    const id = setTimeout(() => setHit(true), Math.max(0, seconds * 1000));
    return () => {
      clearTimeout(id);
      setHit(false);
    };
  }, [live, seconds]);
  return live && hit;
}
