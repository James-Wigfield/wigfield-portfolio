/* ============================================================================
   SCENE — the <Canvas>, its systems and the HUD that sits over it
   ----------------------------------------------------------------------------
   This is the lazy chunk: three.js, R3F and drei arrive with it. It builds
   the world object once, hands it to every system through context, and
   keeps React state to the things the DOM shows.
   ========================================================================== */
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { Hud } from './Hud';
import { audio } from './world/audio';
import { useInput } from './world/input';
import { Interactions } from './world/interact';
import { Philosopher } from './world/philosopher';
import { Player } from './world/player';
import { summarise } from './world/progress';
import { createStore } from './world/store';
import { Lighting, Village } from './world/village';
import { createWorld, WorldContext } from './world/world';

export default function Scene({ progress, actions, openLecture, fullscreen, onToggleFullscreen }) {
  const el = useRef(null);
  const world = useMemo(() => createWorld(), []);
  const hud = useMemo(
    () => createStore({ prompt: null, line: null, speech: null, room: null, choice: null, hint: true, lectureTab: null }),
    [],
  );
  const [muted, setMuted] = useState(audio.muted);
  const sum = useMemo(() => summarise(progress), [progress]);

  const toggleMute = useCallback(() => {
    audio.ensure();
    const m = !audio.muted;
    audio.setMuted(m);
    setMuted(m);
  }, []);

  const onKey = useCallback(
    (what) => {
      if (what === 'mute') toggleMute();
      if (what === 'escape' && fullscreen) onToggleFullscreen?.();
    },
    [toggleMute, fullscreen, onToggleFullscreen],
  );
  useInput(world, el, hud, onKey);

  // the sea starts with the first gesture (autoplay policy) and stops with the scene
  useEffect(() => {
    const start = () => {
      audio.ensure();
      audio.startSea();
    };
    const node = el.current;
    node?.addEventListener('pointerdown', start, { once: true });
    node?.addEventListener('keydown', start, { once: true });
    return () => {
      node?.removeEventListener('pointerdown', start);
      node?.removeEventListener('keydown', start);
      audio.dispose();
    };
  }, []);

  // A debug handle for the headless checks (tools/dl-game-check.mjs) and the console.
  useEffect(() => {
    window.__dlg = { world, hud };
    return () => {
      delete window.__dlg;
    };
  }, [world, hud]);

  const ctx = useMemo(
    () => ({ world, hud, progress, actions, sum, openLecture }),
    [world, hud, progress, actions, sum, openLecture],
  );

  return (
    <WorldContext.Provider value={ctx}>
      <div ref={el} className="dlg-scene" tabIndex={0} aria-label="Scrolls of the Philosopher, 3D village">
        <Canvas
          shadows="percentage"
          dpr={[1, 1.75]}
          camera={{ fov: 50, near: 0.1, far: 420, position: [0, 4, 14] }}
          gl={{ antialias: true, powerPreference: 'high-performance', toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.15 }}
        >
          <Suspense fallback={null}>
            <Lighting />
            <Village />
            <Player>
              <Suspense fallback={<PlaceholderBody />}>
                <Philosopher />
              </Suspense>
            </Player>
            <Interactions />
          </Suspense>
        </Canvas>
        <Hud muted={muted} onToggleMute={toggleMute} />
      </div>
    </WorldContext.Provider>
  );
}

/* Until the philosopher is in: a pale figure the right height. */
function PlaceholderBody() {
  return (
    <group>
      <mesh position={[0, 0.62, 0]} castShadow>
        <capsuleGeometry args={[0.26, 0.55, 4, 10]} />
        <meshStandardMaterial color="#e0d3b8" roughness={0.8} />
      </mesh>
      <mesh position={[0, 1.08, 0.1]} castShadow>
        <sphereGeometry args={[0.16, 12, 10]} />
        <meshStandardMaterial color="#c9a98c" roughness={0.8} />
      </mesh>
    </group>
  );
}
