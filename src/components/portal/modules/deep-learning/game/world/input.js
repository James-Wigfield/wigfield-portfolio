/* ============================================================================
   INPUT — keyboard on the stage, pointer drag to look
   ----------------------------------------------------------------------------
   Listens on the focusable scene element, so the rest of the portal keeps
   its keys. WASD / arrows walk (left/right arrows also turn the camera when
   no mouse is at hand — trackpads and keyboard-only players), E / Space
   act, 1–4 answer a door, H toggles the control card, M toggles sound.
   Dragging with any pointer button turns the camera; no pointer lock needed.
   ========================================================================== */
import { useEffect } from 'react';

const MOVE_KEYS = new Set(['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'shift']);

export function useInput(world, elRef, hud, onKey) {
  useEffect(() => {
    const el = elRef.current;
    if (!el) return undefined;
    const { input } = world;

    const down = (e) => {
      if (e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key.toLowerCase();
      if (MOVE_KEYS.has(k) || k === ' ' || k === 'e') e.preventDefault();
      if (MOVE_KEYS.has(k)) input.keys.add(k);
      if (k === 'e' || k === ' ') { if (!e.repeat) input.useQueued = true; }
      if (k >= '1' && k <= '4') input.choice = k;
      if (k === 'h' && !e.repeat) hud.set((s) => ({ ...s, hint: !s.hint }));
      if (k === 'm' && !e.repeat) onKey?.('mute');
      if (k === 'escape') onKey?.('escape');
    };
    const up = (e) => {
      const k = e.key.toLowerCase();
      input.keys.delete(k);
    };
    const blur = () => input.keys.clear();

    let dragging = false;
    let lx = 0;
    let ly = 0;
    const pdown = (e) => {
      if (e.target.closest?.('button, a, [data-hud]')) return;
      dragging = true;
      lx = e.clientX;
      ly = e.clientY;
      el.focus({ preventScroll: true });
      try { el.setPointerCapture(e.pointerId); } catch { /* fine */ }
    };
    const pmove = (e) => {
      if (!dragging) return;
      input.yawDelta += (e.clientX - lx) * 0.0052;
      input.pitchDelta += (e.clientY - ly) * 0.0038;
      lx = e.clientX;
      ly = e.clientY;
    };
    const pup = (e) => {
      dragging = false;
      try { el.releasePointerCapture(e.pointerId); } catch { /* fine */ }
    };
    const wheel = (e) => {
      e.preventDefault();
      world.camera.dist = Math.min(9, Math.max(2.6, world.camera.dist + e.deltaY * 0.004));
    };

    el.addEventListener('keydown', down);
    el.addEventListener('keyup', up);
    el.addEventListener('blur', blur);
    el.addEventListener('pointerdown', pdown);
    el.addEventListener('pointermove', pmove);
    el.addEventListener('pointerup', pup);
    el.addEventListener('pointercancel', pup);
    el.addEventListener('wheel', wheel, { passive: false });
    el.focus({ preventScroll: true });
    return () => {
      el.removeEventListener('keydown', down);
      el.removeEventListener('keyup', up);
      el.removeEventListener('blur', blur);
      el.removeEventListener('pointerdown', pdown);
      el.removeEventListener('pointermove', pmove);
      el.removeEventListener('pointerup', pup);
      el.removeEventListener('pointercancel', pup);
      el.removeEventListener('wheel', wheel);
    };
  }, [world, elRef, hud, onKey]);
}
