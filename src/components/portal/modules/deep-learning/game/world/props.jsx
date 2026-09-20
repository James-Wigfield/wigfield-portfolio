/* ============================================================================
   PROPS — instanced trees and the scroll pickup, from props.glb
   ----------------------------------------------------------------------------
   props.glb holds SM_Cypress, SM_Olive and SM_Scroll (tools/build_village.py).
   A prop with two materials arrives as a Group of two meshes, so each mesh
   becomes one <Instances> batch: 11 cypresses + 7 olives in four draw calls.
   ========================================================================== */
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Instance, Instances, useGLTF } from '@react-three/drei';
import { CYPRESSES, groundY, OLIVES } from './layout';

export const PROPS_URL = '/dl-game/props.glb';

function meshesOf(node) {
  const out = [];
  node?.traverse((o) => {
    if (o.isMesh) out.push(o);
  });
  return out;
}

function TreeInstances({ node, spots, scaleOf }) {
  const meshes = useMemo(() => meshesOf(node), [node]);
  return meshes.map((m, i) => (
    <Instances key={i} geometry={m.geometry} material={m.material} castShadow limit={spots.length}>
      {spots.map(([x, z], j) => (
        <Instance
          key={j}
          position={[x, groundY(x, z) - 0.05, z]}
          rotation={[0, (j * 2.399) % (Math.PI * 2), 0]}
          scale={scaleOf(j)}
        />
      ))}
    </Instances>
  ));
}

export function Trees() {
  const { nodes } = useGLTF(PROPS_URL);
  return (
    <group>
      <TreeInstances node={nodes.SM_Cypress} spots={CYPRESSES} scaleOf={(j) => 0.85 + ((j * 7) % 5) * 0.07} />
      <TreeInstances node={nodes.SM_Olive} spots={OLIVES} scaleOf={(j) => 0.9 + ((j * 5) % 4) * 0.06} />
    </group>
  );
}

/* A scroll waiting to be found: hovers, turns slowly, and a small warm light
   marks it in the dusk. `found` scrolls render nothing. */
export function ScrollProp({ position, found = false, glow = true }) {
  const { nodes } = useGLTF(PROPS_URL);
  const clone = useMemo(() => nodes.SM_Scroll.clone(true), [nodes]);
  const group = useRef();
  useFrame(({ clock }) => {
    if (!group.current) return;
    const t = clock.elapsedTime;
    group.current.position.y = position[1] + Math.sin(t * 1.7 + position[0]) * 0.05;
    group.current.rotation.y = t * 0.6;
    group.current.rotation.z = Math.sin(t * 0.9) * 0.15;
  });
  if (found) return null;
  return (
    <group ref={group} position={position}>
      <primitive object={clone} />
      {glow && <pointLight color="#ffc078" intensity={3} distance={3.5} decay={2} />}
    </group>
  );
}

useGLTF.preload(PROPS_URL);
