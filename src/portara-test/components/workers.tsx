/**
 * The workers: portlets who step out of the portal to look after the word.
 * That is the whole point of a portlet, so it is the whole point of this:
 * quiet, autonomous upkeep, going on in the background.
 *
 * Up to three are out at once (never appearing together), each with a letter
 * reserved to it and a job of its own: hammering a nail home, polishing,
 * painting, welding a seam, tightening a bolt, vacuuming. Each one
 * materialises in the middle of the opening, drops onto the plinth, hops
 * down the steps, walks round the nearer END of the word to its letter,
 * draws its tool, works, steps back to look, and walks home to dissolve
 * back into the portal. If the word starts its scroll flight, whoever is out
 * dissolves where they stand.
 *
 * Everything lives in ./portlets: PORTLET_CONFIG holds every tuning value,
 * manager.ts owns the pool and the reservations, steering.ts the walking,
 * contact.ts finds where a tool may touch a letter, actions.ts the jobs,
 * tools/ the procedural tools. This file is the React seam: it mounts the
 * manager's group in the scene, drives it every frame, and writes the
 * stats the layout panel shows.
 */
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { PORTLET_CONFIG } from "./portlets/config";
import { PortletManager, type PortletStats } from "./portlets/manager";

export { PORTLET_CONFIG } from "./portlets/config";

export const PORTLET_MODEL = "/portara-test/portlet.glb";
/** Their height, world units: under the lowest ring's letters (0.67 up). */
export const WORKER_H = PORTLET_CONFIG.height;

export type StageStats = PortletStats;

/** What the scene shares with the gate's glow and with the wordmark. */
export type Stage = {
  /** 0 .. 1 how hard the portal is glowing (someone is stepping through). */
  flash: number;
  /** 0 .. 1 the word's scroll flight; while it is up nobody comes out. */
  flight: number;
  stats: StageStats;
};
export function makeStage(): Stage {
  return {
    flash: 0,
    flight: 0,
    stats: {
      active: 0,
      reserved: [],
      jobs: 0,
      checks: 0,
      penetrations: 0,
      wallJobs: 0,
      drawsPerPortlet: 0,
      activeSeconds: [0, 0, 0, 0],
      outings: [0, 0, 0],
      quiet: [],
      calls: 0,
      triangles: 0,
      geometries: 0,
      textures: 0,
      fps: 0,
    },
  };
}

export function Workers({
  wordRef,
  gateRef,
  stage,
  animate,
  visible,
  debug = false,
}: {
  wordRef: React.RefObject<THREE.Group | null>;
  gateRef: React.RefObject<THREE.Group | null>;
  stage: React.MutableRefObject<Stage>;
  animate: boolean;
  visible: boolean;
  /** Draw the contact points and tool tips (the layout panel's "Contacts" box). */
  debug?: boolean;
}) {
  const { scene } = useGLTF(PORTLET_MODEL);
  const gl = useThree((s) => s.gl);
  const threeScene = useThree((s) => s.scene);
  const manager = useMemo(() => new PortletManager(scene), [scene]);
  useEffect(() => {
    // For poking at from the console / a headless soak: `__portletManager.snapshot()`,
    // and `__portletView.shotBeside(slot, distance)` for a side-on photograph
    // of one portlet (a PNG data URL), rendered once through a camera placed
    // beside it.
    type Hooks = {
      __portletManager?: PortletManager;
      __portletView?: { shotBeside: (slot: number, side?: number, back?: number, height?: number, lookHeight?: number) => string | null };
    };
    const w = window as unknown as Hooks;
    w.__portletManager = manager;
    w.__portletView = {
      // `side` to the portlet's right, `back` along its facing (negative =
      // behind it), `height` up; looking at a point `lookHeight` up its body.
      shotBeside: (slot, side = 0.8, back = 0.12, height = 0.34, lookHeight = 0.24) => {
        const v = manager.viewOf(slot);
        if (!v) return null;
        const cam = new THREE.PerspectiveCamera(32, gl.domElement.width / gl.domElement.height, 0.05, 100);
        const fx = Math.sin(v.heading);
        const fz = Math.cos(v.heading);
        const rx = Math.cos(v.heading);
        const rz = -Math.sin(v.heading);
        cam.position.set(v.pos.x + rx * side + fx * back, v.pos.y + height, v.pos.z + rz * side + fz * back);
        cam.lookAt(v.pos.x + fx * 0.05, v.pos.y + lookHeight, v.pos.z + fz * 0.05);
        cam.updateProjectionMatrix();
        gl.render(threeScene, cam);
        return gl.domElement.toDataURL("image/png");
      },
    };
    return () => {
      manager.dispose();
      delete w.__portletManager;
      delete w.__portletView;
    };
  }, [manager, gl, threeScene]);
  const fps = useRef({ acc: 0, n: 0 });

  useFrame((_, dt) => {
    const step = Math.min(dt, 0.1);
    const word = wordRef.current;
    const gate = gateRef.current;
    if (!word || !gate) return;
    const st = stage.current;
    manager.update(step, {
      word,
      gate,
      visible,
      animate,
      flight: st.flight,
      debugContacts: debug || PORTLET_CONFIG.debug.contacts,
      debugPenetration: PORTLET_CONFIG.debug.penetration,
    });
    st.flash = manager.flash;

    // info is reset at the start of each render, so this is the frame just drawn.
    const s = manager.stats;
    s.calls = gl.info.render.calls;
    s.triangles = gl.info.render.triangles;
    s.geometries = gl.info.memory.geometries;
    s.textures = gl.info.memory.textures;
    const f = fps.current;
    f.acc += dt;
    f.n += 1;
    if (f.acc >= 0.5) {
      s.fps = f.n / f.acc;
      f.acc = 0;
      f.n = 0;
    }
    Object.assign(st.stats, s);
  });

  return <primitive object={manager.group} />;
}

useGLTF.preload(PORTLET_MODEL);
