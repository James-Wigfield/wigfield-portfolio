/* eslint-disable react-hooks/immutability -- writes player.scrollPulse into the mutable world object; see world.js */
/* ============================================================================
   ROOM KIT — the pieces every mechanism room is built from
   ----------------------------------------------------------------------------
     Label         a small DOM label pinned to a point in 3D
     Tiles         an instanced grid of coloured slabs
     ScrollPickup  a scroll on the floor: E to read it
     Lectern       a stone stand you operate with E
     ExitDoor      the locked exit slab + knock, opening the house's panel
   Hooks and helpers are in roomHooks.js.
   ========================================================================== */
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html, Instance, Instances } from '@react-three/drei';
import * as THREE from 'three';
import { useGame } from '../world/world';
import { useInteractable } from '../world/useInteractable';
import { audio } from '../world/audio';
import { ScrollProp } from '../world/props';
import { doorSpan, houseWalls, HOUSES, WALL_T } from '../world/layout';
import { EXIT_TESTS, scrollById } from '../content/scrolls';
import { useDynamicColliders } from './roomHooks';

/* ── DOM label in 3D ─────────────────────────────────────────────────────── */
export function Label({ position, children, className = '', tone, distanceFactor = 6 }) {
  return (
    <Html position={position} center distanceFactor={distanceFactor} zIndexRange={[2, 1]} style={{ pointerEvents: 'none' }}>
      <span className={`dlg-label ${className}`} data-tone={tone}>
        {children}
      </span>
    </Html>
  );
}

/* ── instanced tiles ─────────────────────────────────────────────────────── */
const tileGeo = new THREE.BoxGeometry(1, 1, 1);
export function Tiles({ cells, size = [0.96, 0.08, 0.96], emissive = 0, roughness = 0.85, castShadow = false }) {
  /* cells: [{ pos:[x,y,z], color:'#hex' | THREE.Color, scale?:[x,y,z] }] */
  return (
    <Instances limit={Math.max(1, cells.length)} geometry={tileGeo} castShadow={castShadow} receiveShadow>
      <meshStandardMaterial roughness={roughness} emissive="#ffffff" emissiveIntensity={emissive} />
      {cells.map((c, i) => (
        <Instance key={i} position={c.pos} color={c.color} scale={c.scale ?? size} />
      ))}
    </Instances>
  );
}

/* ── scroll pickup ───────────────────────────────────────────────────────── */
export function ScrollPickup({ id, position, onFound }) {
  const { progress, actions, hud, world } = useGame();
  const scroll = scrollById(id);
  const found = progress.found.includes(id);
  useInteractable(
    `scroll:${id}`,
    {
      pos: position,
      radius: 1.6,
      label: `Read the scroll · ${scroll.concept}`,
      enabled: !found,
      onUse: () => {
        actions.findScroll(id);
        world.player.scrollPulse = 1;
        audio.chime();
        hud.set({ line: { text: scroll.line, concept: scroll.concept, slides: scroll.slides, lectureTab: scroll.lectureTab } });
        onFound?.(scroll);
      },
    },
    [found],
  );
  return <ScrollProp position={position} found={found} />;
}

/* ── a stone stand you operate ───────────────────────────────────────────── */
export function Lectern({ id, position, label, onUse, enabled = true, children, tone = '#d9cdb4' }) {
  useInteractable(id, { pos: position, radius: 1.7, label, enabled, onUse }, [label, enabled, onUse]);
  return (
    <group position={position}>
      <mesh position={[0, 0.45, 0]} castShadow>
        <boxGeometry args={[0.5, 0.9, 0.5]} />
        <meshStandardMaterial color={tone} roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.95, 0]} rotation={[-0.35, 0, 0]} castShadow>
        <boxGeometry args={[0.7, 0.08, 0.5]} />
        <meshStandardMaterial color={tone} roughness={0.8} />
      </mesh>
      {children}
    </group>
  );
}

/* ── the exit door ───────────────────────────────────────────────────────── */
/* A slab fills the exit doorway and collides until `solved`; knocking opens
   the house's choice panel (`ask` builds it). When `solved` turns true the
   slab sinks into the floor and the collider goes. */
export function ExitDoor({ houseId, ask, children }) {
  const { progress } = useGame();
  const h = HOUSES[houseId];
  const solved = progress.solved.includes(houseId);
  const span = useMemo(() => doorSpan(h, h.exit), [h]);
  const colliders = useMemo(
    () => (solved ? [] : houseWalls(h, new Set(['exit'])).filter((w) => w.door === 'exit')),
    [h, solved],
  );
  useDynamicColliders(`door:${houseId}`, colliders);
  const slab = useRef();
  const open = useRef(solved ? 1 : 0);
  useFrame((_, dt) => {
    const target = solved ? 1 : 0;
    open.current += (target - open.current) * (1 - Math.pow(0.02, dt));
    if (slab.current) slab.current.position.y = -open.current * (span.h + 0.05) + span.h / 2;
  });
  const test = EXIT_TESTS[houseId];
  useInteractable(
    `exit:${houseId}`,
    {
      pos: [span.x - span.nx * 0.9, 0, span.z - span.nz * 0.9],
      radius: 1.9,
      label: `Knock · ${test.prompt}`,
      enabled: !solved,
      onUse: () => ask(),
    },
    [solved, ask],
  );
  const size = span.axis === 'z' ? [0.16, span.h, span.w - 0.05] : [span.w - 0.05, span.h, 0.16];
  return (
    <group position={[span.x, 0, span.z]}>
      <mesh ref={slab} position={[0, span.h / 2, 0]} castShadow>
        <boxGeometry args={size} />
        <meshStandardMaterial color="#5a4632" roughness={0.9} />
      </mesh>
      {/* the plaque beside the door, inside */}
      <group position={[-span.nx * (WALL_T + 0.1), 0, -span.nz * (WALL_T + 0.1)]}>{children}</group>
    </group>
  );
}
