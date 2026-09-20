/* ============================================================================
   THE BUST — one weathered voice in the plaza
   ----------------------------------------------------------------------------
   Speaks a greeting the first time you come near, another line when asked
   (E), and — from the rooms — a different line when a door turns you away.
   ========================================================================== */
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGame } from './world';
import { useInteractable } from './useInteractable';
import { BUST } from './layout';
import { BUST_LINES } from '../content/scrolls';
import { pick, say } from '../rooms/roomHooks';

export function Bust() {
  const { world, hud, sum } = useGame();
  const greeted = useRef(false);
  const idx = useRef(0);

  useFrame(() => {
    if (greeted.current) return;
    const dx = world.player.pos.x - BUST.x;
    const dz = world.player.pos.z - BUST.z;
    if (dx * dx + dz * dz < 12) {
      greeted.current = true;
      say(hud, sum.allDone ? BUST_LINES.allDone : sum.found === 0 ? BUST_LINES.greet[0] : pick(BUST_LINES.greet, world.seed));
    }
  });

  useInteractable('bust', {
    pos: [BUST.x, 1.2, BUST.z],
    radius: 2.2,
    label: 'Listen to the bust',
    onUse: () => {
      if (sum.allDone) {
        say(hud, BUST_LINES.allDone);
        return;
      }
      idx.current = (idx.current + 1) % BUST_LINES.greet.length;
      say(hud, BUST_LINES.greet[idx.current]);
    },
  }, [sum.allDone]);

  return null;
}
