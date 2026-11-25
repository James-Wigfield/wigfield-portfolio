/* The still fallback (?still=1, or world.fallback === 'still'): no walk. The stills one after
   another, his words placed quietly beside them, the sound after a tap, then the wake: fade
   to white and his one line. Then back to the corridor at this door.

   Sets window.__dream.state like the stage does (black → fading-in → walking → waking → woken),
   so scripts can wait on either. */

import { useEffect, useState } from 'react';
import { COPY } from '../copy.js';
import { startDreamAudio, stop, unlockAudio } from '../viewer/audio.js';

const BLACK_MS = 2000; // black and sound first, then a slow fade in (decision 8)
const PER_STILL_MS = 8000;
const WAKE_MS = 4500;

function setDebug(state) {
  window.__dream = { ...(window.__dream || {}), state, module: 'still' };
}

export default function StillView({ id, world, stills, autopilot = false, soundOn = false, onWake }) {
  const [phase, setPhase] = useState('black'); // black | showing | waking | woken
  const [index, setIndex] = useState(0);
  const [sound, setSound] = useState(soundOn);
  const count = Math.max(1, stills?.length || 0);
  const words = (world?.words || []).map((w) => w?.text).filter(Boolean);
  const line = world?.wake?.line || '';

  // The timeline.
  useEffect(() => {
    const timers = [setTimeout(() => setPhase('showing'), BLACK_MS)];
    for (let i = 1; i < count; i++) timers.push(setTimeout(() => setIndex(i), BLACK_MS + PER_STILL_MS * i));
    const end = BLACK_MS + PER_STILL_MS * count;
    timers.push(setTimeout(() => setPhase('waking'), end));
    timers.push(setTimeout(() => setPhase('woken'), end + WAKE_MS));
    return () => timers.forEach(clearTimeout);
  }, [count]);

  useEffect(() => {
    setDebug(phase === 'showing' ? 'walking' : phase === 'black' ? 'black' : phase);
  }, [phase]);

  // Sound: right away when the Enter tap already unlocked it, else after the first tap here.
  useEffect(() => {
    if (soundOn) startDreamAudio(world?.sound);
  }, [soundOn, world]);
  useEffect(() => () => stop(), []);

  // Autopilot carries on to the corridor by itself.
  useEffect(() => {
    if (!autopilot || phase !== 'woken') return undefined;
    const t = setTimeout(() => onWake?.(id), 2000);
    return () => clearTimeout(t);
  }, [autopilot, phase, onWake, id]);

  function tap() {
    if (sound) return;
    unlockAudio(); // synchronously, inside the tap
    startDreamAudio(world?.sound);
    setSound(true);
  }

  const shown = words.filter((_, k) => k % count === index % count);
  const waking = phase === 'waking' || phase === 'woken';

  return (
    <div className="dr-still" data-dr="still-view" data-phase={phase} onPointerDown={tap}>
      {(stills || []).map((s, i) => (
        <img key={s.name || s.url} className="dr-still-img" src={s.url} alt="" data-on={phase !== 'black' && i === index ? '1' : '0'} />
      ))}
      <div className="dr-still-words" data-on={phase === 'showing' ? '1' : '0'}>
        {shown.map((w, k) => (
          <p key={`${index}-${k}`} className="dr-still-word" data-slot={(index + k) % 3}>
            {w}
          </p>
        ))}
      </div>
      {!sound && phase !== 'woken' && <p className="dr-label dr-still-tap">{COPY.still.tapForSound}</p>}
      <div className="dr-wake" data-on={waking ? '1' : '0'} data-dr="wake">
        {line && <p className="dr-wake-line">{line}</p>}
        {phase === 'woken' && (
          <button type="button" className="dr-link dr-wake-back" onClick={() => onWake?.(id)} data-dr="wake-back">
            {COPY.still.back}
          </button>
        )}
      </div>
    </div>
  );
}
