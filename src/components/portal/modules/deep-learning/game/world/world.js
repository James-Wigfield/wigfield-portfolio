/* ============================================================================
   THE WORLD OBJECT — mutable, frame-rate state shared by every system
   ----------------------------------------------------------------------------
   React owns progress and the DOM overlay; everything that changes sixty
   times a second lives here and is read/written from useFrame without a
   single re-render. Rooms register their moving parts (colliders, ground
   overrides, interactables) into the Maps below and remove them on unmount.
   ========================================================================== */
import { createContext, useContext } from 'react';
import * as THREE from 'three';
import { SPAWN, staticColliders } from './layout';

export function createWorld() {
  return {
    player: {
      pos: new THREE.Vector3(SPAWN.x, 0, SPAWN.z),
      heading: SPAWN.yaw,      // where the philosopher faces (model forward = +Z)
      speed: 0,                // m/s, smoothed
      moving: false,
      house: null,             // id of the house he is inside, or null
      walkPhase: 0,            // radians, for the procedural walk
      scrollPulse: 0,          // 1 → 0 after a pickup; the carried scroll swells
    },
    camera: {
      yaw: SPAWN.yaw,          // the direction the camera looks along (sin, ·, cos)
      pitch: 0.36,
      dist: 6,
      mode: 'outside',         // 'outside' | 'room'
    },
    input: {
      keys: new Set(),
      yawDelta: 0,
      pitchDelta: 0,
      useQueued: false,        // E / Space pressed this frame
      choice: null,            // '1'..'4' pressed this frame
      locked: false,           // a choice panel is open: movement pauses
    },
    colliders: staticColliders(),
    dynamic: new Map(),        // id → collider[]   (rooms: shut doors, boxes, partitions)
    ground: new Map(),         // id → (x, z) => y | null   (rooms: mezzanines, ramps)
    interactables: new Map(),  // id → { pos:[x,y,z], radius, label, enabled, onUse }
    nearest: null,             // id of the interactable currently in reach
    frame: 0,
    clock: 0,
    seed: Math.random(),       // one roll per session, for the doors' questions
  };
}

export const WorldContext = createContext(null);
export const useGame = () => useContext(WorldContext);

/* Every collider the player must respect this frame. */
export function allColliders(world) {
  if (world.dynamic.size === 0) return world.colliders;
  const out = world.colliders.slice();
  for (const list of world.dynamic.values()) for (const c of list) out.push(c);
  return out;
}

/* Ground under the player: rooms first (they know about mezzanines), else
   the terrain function. */
export function groundUnder(world, x, z, fallback) {
  for (const fn of world.ground.values()) {
    const y = fn(x, z);
    if (y !== null && y !== undefined) return y;
  }
  return fallback(x, z);
}
