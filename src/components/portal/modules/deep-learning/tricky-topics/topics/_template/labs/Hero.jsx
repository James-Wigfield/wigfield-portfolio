import { useRef } from 'react';
import { useHeroBeats } from '../../../hero';

/* REPLACE ME — the opener's hero animation: the whole idea in about five
   seconds. useHeroBeats steps through the beats (CSS transitions do the
   moving), starts when the hero scrolls into view, replays when `run`
   changes, and sits on the last beat under reduced motion and in print. */

const BEATS = 4;

export function Hero({ run }) {
  const ref = useRef(null);
  const beat = useHeroBeats(BEATS, { run, ref });
  return (
    <svg ref={ref} className="dltt-svg dltt-hero-svg" viewBox="0 0 640 140" role="img" aria-label="REPLACE ME: what the hero shows">
      {Array.from({ length: BEATS }, (_, i) => (
        <rect key={i} x={40 + i * 140} y={40} width={110} height={60} rx={6} className={`dltt-box3__front dltt-fade${i <= beat ? '' : ' dltt-hide'}`} />
      ))}
      <text x={320} y={128} textAnchor="middle" className="dltt-t dltt-t--s">REPLACE ME: beat {beat + 1} of {BEATS}</text>
    </svg>
  );
}
