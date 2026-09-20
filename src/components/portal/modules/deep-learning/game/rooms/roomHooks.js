/* ============================================================================
   ROOM HOOKS — presence, registrations, the bust's voice, verdicts
   ----------------------------------------------------------------------------
     useInside(houseId)          is the philosopher in this house? (React state)
     useRoomText(houseId, room)  the accessible room description, while inside
     useDynamicColliders(id, []) walls and boxes the room adds this frame
     useGroundOverride(id, fn)   mezzanines and ramps
     say(hud, text) / pick()     the bust speaks
     useVerdict(houseId)         right: door opens, lantern, approval; wrong:
                                 the fail line and the arithmetic note
   (Components live in kit.jsx — Fast Refresh wants them apart.)
   ========================================================================== */
import { useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGame } from '../world/world';
import { audio } from '../world/audio';
import { BUST_LINES, EXIT_TESTS, houseById } from '../content/scrolls';

/* ── presence ────────────────────────────────────────────────────────────── */
export function useInside(houseId) {
  const { world } = useGame();
  const [inside, setInside] = useState(false);
  useFrame(() => {
    const now = world.player.house === houseId;
    if (now !== inside) setInside(now);
  });
  return inside;
}

export function useRoomText(houseId, room) {
  const { hud } = useGame();
  const inside = useInside(houseId);
  const lines = room.lines.join('\n');
  useEffect(() => {
    if (!inside) return undefined;
    hud.set({ room: { title: room.title, lines: room.lines }, lectureTab: room.lectureTab ?? null });
    return () => hud.set((s) => (s.room?.title === room.title ? { ...s, room: null, lectureTab: null } : s));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inside, hud, room.title, lines, room.lectureTab]);
  return inside;
}

/* ── world registrations ─────────────────────────────────────────────────── */
export function useDynamicColliders(id, colliders) {
  const { world } = useGame();
  useEffect(() => {
    world.dynamic.set(id, colliders);
    return () => {
      world.dynamic.delete(id);
    };
  }, [world, id, colliders]);
}

export function useGroundOverride(id, fn) {
  const { world } = useGame();
  useEffect(() => {
    if (!fn) return undefined;
    world.ground.set(id, fn);
    return () => {
      world.ground.delete(id);
    };
  }, [world, id, fn]);
}

/* ── the bust's voice ────────────────────────────────────────────────────── */
export function say(hud, text, who = 'The bust') {
  hud.set({ speech: { who, text, at: Date.now() } });
}
export const pick = (arr, seed) => arr[Math.floor((seed * 7919) % arr.length)];

/* Shared verdict handling: right → open, lantern, the bust approves; wrong →
   the bust's fail line and the arithmetic note stays on the panel. */
export function useVerdict(houseId) {
  const { actions, hud, world } = useGame();
  return (correct, wrongNote) => {
    if (correct) {
      actions.solveHouse(houseId);
      audio.door();
      hud.set({ choice: null });
      setTimeout(() => say(hud, pick(BUST_LINES.houseDone, world.seed + 0.31)), 900);
      return true;
    }
    audio.thud();
    hud.set((s) => ({
      ...s,
      choice: s.choice ? { ...s.choice, note: wrongNote ?? EXIT_TESTS[houseId].fail } : null,
      speech: { who: 'The bust', text: pick(BUST_LINES.fail, world.seed + world.clock * 0.001), at: Date.now() },
    }));
    return false;
  };
}

export const houseName = (id) => houseById(id)?.name ?? id;
