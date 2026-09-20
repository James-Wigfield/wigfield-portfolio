/* eslint-disable react-hooks/immutability -- the world object is frame-rate state mutated on purpose; see world.js */
/* ============================================================================
   INTERACTIONS — proximity prompts, E to act, 1–4 to answer
   ----------------------------------------------------------------------------
   Every frame: the nearest enabled interactable within reach becomes the
   prompt. E / Space fires it. When a door has put a choice panel up, the
   number keys pick an answer and movement pauses until it closes.
   Rooms register interactables with world.interactables (see useInteractable).
   ========================================================================== */
import { useFrame } from '@react-three/fiber';
import { useGame } from './world';

export function Interactions() {
  const { world, hud } = useGame();

  useFrame(() => {
    const { player: p, input } = world;
    const choice = hud.get().choice;
    input.locked = !!choice;

    if (choice) {
      if (input.choice) {
        const idx = Number(input.choice) - 1;
        input.choice = null;
        if (choice.options[idx]) choice.onPick(choice.options[idx], idx);
      }
      if (input.useQueued) {
        input.useQueued = false;
        if (choice.dismissable !== false) hud.set({ choice: null });
      }
      if (world.nearest) {
        world.nearest = null;
        hud.set({ prompt: null });
      }
      return;
    }
    input.choice = null;

    let best = null;
    let bestD = Infinity;
    for (const [id, it] of world.interactables) {
      if (!it.enabled) continue;
      const dx = it.pos[0] - p.pos.x;
      const dz = it.pos[2] - p.pos.z;
      const dy = (it.pos[1] ?? p.pos.y) - p.pos.y;
      const d = Math.hypot(dx, dz);
      if (d < (it.radius ?? 1.7) && Math.abs(dy) < 2.6 && d < bestD) {
        best = id;
        bestD = d;
      }
    }
    if (best !== world.nearest) {
      world.nearest = best;
      const it = best ? world.interactables.get(best) : null;
      hud.set({ prompt: it ? { key: it.key ?? 'E', text: it.label } : null });
    }
    if (input.useQueued) {
      input.useQueued = false;
      const it = best ? world.interactables.get(best) : null;
      if (it) it.onUse();
    }
  });
  return null;
}
