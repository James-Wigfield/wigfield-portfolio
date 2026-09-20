/* ============================================================================
   VILLAGE — the world outside the houses
   ----------------------------------------------------------------------------
   Lighting (a low warm sun, a dusk sky, a hemisphere fill that brightens as
   scrolls are found), the Blender village (village.glb) with the grey box
   standing in while it streams, instanced trees, and the parts that stay
   procedural: the sea's slow breathing and every light that progress turns on.
   ========================================================================== */
import { Suspense, useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sky, Stars, useGLTF } from '@react-three/drei';
import { useGame } from './world';
import { GreyBoxVillage } from './greybox';
import { Lamps, Lanterns, Windows } from './lamps';
import { Trees } from './props';
import { Colonnade } from './colonnade';
import { SEA } from './layout';

export const VILLAGE_URL = '/dl-game/village.glb';

export function Lighting() {
  const { sum } = useGame();
  const p = sum.total ? sum.found / sum.total : 0;
  const light = useRef();
  useEffect(() => {
    const l = light.current;
    if (!l) return;
    l.target.position.set(0, 0, -14);
    l.target.updateMatrixWorld();
  }, []);
  return (
    <>
      <hemisphereLight args={['#8d97c9', '#5a4a3e', 1.1 + 0.9 * p]} />
      <directionalLight
        ref={light}
        position={[-40, 24, 18]}
        intensity={2.6}
        color="#ffc39a"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={2}
        shadow-camera-far={140}
        shadow-camera-left={-46}
        shadow-camera-right={46}
        shadow-camera-top={46}
        shadow-camera-bottom={-46}
        shadow-bias={-0.0005}
        shadow-normalBias={0.04}
      />
      <Sky distance={450} sunPosition={[-40, 6, 18]} turbidity={6} rayleigh={1.6} mieCoefficient={0.012} mieDirectionalG={0.88} />
      <Stars radius={180} depth={30} count={900} factor={2.4} saturation={0} fade speed={0.25} />
      <fog attach="fog" args={['#8a7f95', 55, 190]} />
    </>
  );
}

function Sea() {
  const mesh = useRef();
  useFrame(({ clock }) => {
    if (mesh.current) mesh.current.position.y = SEA.water + Math.sin(clock.elapsedTime * 0.5) * 0.05;
  });
  return (
    <mesh ref={mesh} rotation-x={-Math.PI / 2} position={[0, SEA.water, SEA.z + 42]}>
      <planeGeometry args={[240, 84]} />
      <meshStandardMaterial color="#2b3f66" roughness={0.2} metalness={0.25} />
    </mesh>
  );
}

function GlbVillage() {
  const { scene } = useGLTF(VILLAGE_URL);
  useEffect(() => {
    scene.traverse((o) => {
      if (o.isMesh) {
        o.receiveShadow = true;
        o.castShadow = !/Terrain|Plaza/.test(o.name);
      }
    });
  }, [scene]);
  return <primitive object={scene} />;
}

export function Village() {
  return (
    <group>
      <Suspense fallback={<GreyBoxVillage />}>
        <GlbVillage />
        <Trees />
      </Suspense>
      <Sea />
      <Lamps />
      <Windows />
      <Lanterns />
      <Colonnade />
    </group>
  );
}

useGLTF.preload(VILLAGE_URL);
