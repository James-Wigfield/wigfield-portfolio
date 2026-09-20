import { useEffect } from 'react';
import { useGame } from './world';

/* Register one interactable for the life of the component. `spec.label`
   may change frame to frame through the returned setter. */
export function useInteractable(id, spec, deps = []) {
  const { world, hud } = useGame();
  useEffect(() => {
    world.interactables.set(id, { enabled: true, radius: 1.7, ...spec });
    if (world.nearest === id) hud.set({ prompt: { key: spec.key ?? 'E', text: spec.label } });
    return () => {
      world.interactables.delete(id);
      if (world.nearest === id) {
        world.nearest = null;
        hud.set({ prompt: null });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world, hud, id, ...deps]);
}
