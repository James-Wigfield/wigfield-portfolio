/* eslint-disable react-hooks/immutability -- animates three.js nodes in place every frame; see world.js */
/* ============================================================================
   THE PHILOSOPHER — procedural animation of a rigid hierarchy
   ----------------------------------------------------------------------------
   philosopher.glb (tools/build_village.py re-exports refs/character.glb) has
   no armature: rig → lift → bodyG { armL, armR, head { eyes } } and lift →
   legL, legR, every empty sitting on its joint. So the walk is arithmetic:
   a sine on the legs, a counter-swing on the arms, a bob on `lift`, and when
   he stands still a slow breath and a head that drifts. He faces +Z.

   The scroll he already carries is gameplay: on a pickup it swells and
   glows for a moment (player.scrollPulse), the parchment line goes to the HUD.
   ========================================================================== */
import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { useGame } from './world';

export const PHILOSOPHER_URL = '/dl-game/philosopher.glb';
const WALK_REF = 2.7;

export function Philosopher() {
  const { scene } = useGLTF(PHILOSOPHER_URL);
  const { world } = useGame();

  const parts = useMemo(() => {
    const get = (n) => scene.getObjectByName(n) || null;
    const scroll = [];
    scene.traverse((o) => {
      if (o.isMesh && /_scroll_/.test(o.name)) scroll.push(o);
    });
    return {
      lift: get('lift'),
      bodyG: get('bodyG'),
      armL: get('armL'),
      armR: get('armR'),
      head: get('head'),
      legL: get('legL'),
      legR: get('legR'),
      scroll,
    };
  }, [scene]);

  const rest = useMemo(() => {
    const r = {};
    for (const k of ['lift', 'bodyG', 'armL', 'armR', 'head', 'legL', 'legR']) {
      const n = parts[k];
      r[k] = n ? { p: n.position.clone(), r: n.rotation.clone() } : null;
    }
    return r;
  }, [parts]);

  useEffect(() => {
    scene.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = false;
        o.frustumCulled = false;
        if (/_scroll_/.test(o.name) && o.material?.emissive) {
          o.material = o.material.clone();
          o.material.emissive.set('#ffb347');
          o.material.emissiveIntensity = 0;
        }
      }
    });
    scene.position.set(0, 0, 0);
  }, [scene]);

  useFrame(({ clock }, dt) => {
    const p = world.player;
    const t = clock.elapsedTime;
    const walk = Math.min(p.speed / WALK_REF, 1.4);
    const w1 = Math.min(walk, 1);
    const ph = p.walkPhase;
    const s = Math.sin(ph);
    const swing = s * 0.5 * w1;

    const { lift, bodyG, armL, armR, head, legL, legR } = parts;
    if (legL && rest.legL) {
      legL.rotation.x = rest.legL.r.x + swing;
      legL.position.z = rest.legL.p.z + s * 0.07 * w1;
      legL.position.y = rest.legL.p.y + Math.max(0, s) * 0.06 * w1;
    }
    if (legR && rest.legR) {
      legR.rotation.x = rest.legR.r.x - swing;
      legR.position.z = rest.legR.p.z - s * 0.07 * w1;
      legR.position.y = rest.legR.p.y + Math.max(0, -s) * 0.06 * w1;
    }
    if (armL && rest.armL) armL.rotation.x = rest.armL.r.x - swing * 0.9;
    if (armR && rest.armR) armR.rotation.x = rest.armR.r.x + swing * 0.45; // the scroll hand keeps steadier
    if (lift && rest.lift) {
      lift.position.y = rest.lift.p.y + Math.abs(s) * 0.04 * w1 + Math.sin(t * 1.5) * 0.006 * (1 - w1);
    }
    if (bodyG && rest.bodyG) {
      bodyG.rotation.x = rest.bodyG.r.x + 0.07 * w1;
      bodyG.rotation.z = rest.bodyG.r.z + Math.cos(ph) * 0.03 * w1;
    }
    if (head && rest.head) {
      head.rotation.y = rest.head.r.y + Math.sin(t * 0.6) * 0.16 * (1 - w1);
      head.rotation.x = rest.head.r.x + Math.sin(t * 1.1) * 0.03 - 0.05 * w1;
    }

    // the scroll swells when a new one is read
    if (p.scrollPulse > 0) {
      p.scrollPulse = Math.max(0, p.scrollPulse - dt * 0.9);
      const k = 1 + Math.sin(p.scrollPulse * Math.PI) * 0.45;
      for (const m of parts.scroll) {
        m.scale.setScalar(k);
        if (m.material?.emissive) m.material.emissiveIntensity = Math.sin(p.scrollPulse * Math.PI) * 0.6;
      }
    } else if (parts.scroll.length && parts.scroll[0].scale.x !== 1) {
      for (const m of parts.scroll) {
        m.scale.setScalar(1);
        if (m.material?.emissive) m.material.emissiveIntensity = 0;
      }
    }
  });

  return <primitive object={scene} />;
}

useGLTF.preload(PHILOSOPHER_URL);
