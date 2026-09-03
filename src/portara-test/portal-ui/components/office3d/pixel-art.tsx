import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPixelatedPass } from "three/examples/jsm/postprocessing/RenderPixelatedPass.js";

/* ── Pixel-art rendering ─────────────────────────────────────────────────
   The office is drawn as true pixel art, not a filter: the scene renders
   into a buffer `pixelSize` times smaller than the canvas, gets 1px dark
   outlines (depth edges) and 1px bevel highlights (normal edges) from the
   low-res depth/normal buffers, then upscales with nearest-neighbour.
   Combined with the stepped toon lighting below, every surface lands on a
   flat colour band with a crisp pixel border - the hand-drawn look.

   The look is part of core: PIXEL_SETTINGS below is the single source of
   truth, identical for every client. It is deliberately not tunable at
   runtime - no panel, no localStorage, no per-browser drift. */

export type PixelSettings = {
  /** Art pixel size (canvas px) when fully zoomed IN - detail is large, so chunky reads well. */
  pixelNear: number;
  /** Art pixel size when fully zoomed OUT - objects are small, finer pixels keep them legible. */
  pixelFar: number;
  /** Darken strength of the 1px outline where depth jumps (0 = off). */
  outline: number;
  /** Lighten strength of the 1px bevel highlight on convex edges (0 = off). */
  bevel: number;
  /** Number of flat lighting bands in the toon ramp. */
  bands: number;
  /** Brightness of the darkest band, 0..1. */
  bandFloor: number;
  /** Ambient light intensity. */
  ambient: number;
  /** Key (sun) light intensity. */
  keyLight: number;
  /** Sky backdrop colour ("#rrggbb"); "" = the stock gradient (SKY_STOPS). */
  skyColor: string;
  /** False = bypass the pixel pass entirely: full-resolution render, no
   *  art pixels, no outlines/bevels. Toon lighting stays. */
  pixelation: boolean;
};

/** The one office look, part of core - the same for every client. */
export const PIXEL_SETTINGS: PixelSettings = {
  pixelNear: 1,
  pixelFar: 1,
  outline: 0,
  bevel: 0,
  bands: 3,
  bandFloor: 0.33,
  ambient: 0.8,
  keyLight: 1.55,
  skyColor: "",
  pixelation: true,
};

export function getPixelSettings(): PixelSettings {
  return PIXEL_SETTINGS;
}

/** Kept as the component-facing accessor (scene.tsx) - now just the constant. */
export function usePixelSettings(): PixelSettings {
  return PIXEL_SETTINGS;
}

/* ── Zoom-adaptive pixel size ────────────────────────────────────────────
   The camera rig reports where the current zoom sits in its allowed range
   (0 = fully zoomed out, 1 = fully zoomed in) every frame; the renderer
   blends pixelFar → pixelNear across it. Module-level mutable rather than
   state: it changes every frame while zooming and must never re-render. */

let zoomFraction = 0.5;

export function reportZoomFraction(f: number) {
  zoomFraction = Math.min(1, Math.max(0, f));
}

/* ── Toon lighting ramp ──────────────────────────────────────────────────
   Fixed-width texture so band count/brightness can change live without
   reallocating (materials keep their reference); nearest filtering snaps
   lighting to the written steps regardless of width. */

const GRADIENT_WIDTH = 16;

let gradient: THREE.DataTexture | null = null;

function writeGradient() {
  if (!gradient) return;
  const { bands, bandFloor } = getPixelSettings();
  const data = gradient.image.data as Uint8Array;
  for (let i = 0; i < GRADIENT_WIDTH; i++) {
    const band = Math.min(bands - 1, Math.floor((i * bands) / GRADIENT_WIDTH));
    const v = bandFloor + (1 - bandFloor) * (band / (bands - 1));
    data[i] = Math.round(v * 255);
  }
  gradient.needsUpdate = true;
}

/** Lazy singleton - the gradient lives for the app's lifetime. */
export function toonGradient(): THREE.DataTexture {
  if (!gradient) {
    gradient = new THREE.DataTexture(
      new Uint8Array(GRADIENT_WIDTH),
      GRADIENT_WIDTH,
      1,
      THREE.RedFormat,
    );
    gradient.minFilter = THREE.NearestFilter;
    gradient.magFilter = THREE.NearestFilter;
    gradient.generateMipmaps = false;
    writeGradient();
  }
  return gradient;
}

/* ── See-through walls ───────────────────────────────────────────────────
   `WallFade` (scene.tsx) registers a wall's group here while the wall is
   faded to glass. The pass below leaves registered objects out of the
   normal/depth edge buffer: that buffer renders with an override material
   that ignores transparency, so a see-through wall would otherwise still
   get crisp pixel outlines drawn over the room behind it. */
export const pixelEdgeExclusions = new Set<THREE.Object3D>();

/** Stock RenderPixelatedPass, but the edge-detection buffer skips
 *  `pixelEdgeExclusions` (the beauty pass still draws them translucent). */
class SeeThroughPixelatedPass extends RenderPixelatedPass {
  render(renderer: THREE.WebGLRenderer, writeBuffer: THREE.WebGLRenderTarget) {
    // The published types lag the implementation - reach the internals by name.
    const internals = this as unknown as {
      _fsQuad: {
        material: THREE.ShaderMaterial;
        render: (r: THREE.WebGLRenderer) => void;
      };
      _beautyRenderTarget: THREE.WebGLRenderTarget;
      _normalRenderTarget: THREE.WebGLRenderTarget;
      _normalMaterial: THREE.Material;
    };
    const uniforms = internals._fsQuad.material.uniforms;
    uniforms.normalEdgeStrength.value = this.normalEdgeStrength;
    uniforms.depthEdgeStrength.value = this.depthEdgeStrength;

    renderer.setRenderTarget(internals._beautyRenderTarget);
    renderer.render(this.scene, this.camera);

    // The edge buffer costs a SECOND full render of the whole scene, and the
    // composite shader multiplies its contribution by the two edge strengths.
    // At zero strength (the current look - see PIXEL_SETTINGS) that render is
    // pure waste: skipping it leaves the stale texture bound to a term that is
    // multiplied out, so the frame is pixel-identical for half the draw calls.
    // A furnished office is several hundred draw calls; this is the single
    // biggest saving available, and it costs nothing while outlines are off.
    // (The published types make both strengths optional - a missing one is off.)
    const wantsEdges =
      (this.normalEdgeStrength ?? 0) > 0 || (this.depthEdgeStrength ?? 0) > 0;
    if (wantsEdges) {
      const hidden: THREE.Object3D[] = [];
      for (const obj of pixelEdgeExclusions) {
        if (obj.visible) {
          obj.visible = false;
          hidden.push(obj);
        }
      }

      const overrideMaterialOld = this.scene.overrideMaterial;
      renderer.setRenderTarget(internals._normalRenderTarget);
      this.scene.overrideMaterial = internals._normalMaterial;
      renderer.render(this.scene, this.camera);
      this.scene.overrideMaterial = overrideMaterialOld;

      for (const obj of hidden) obj.visible = true;
    }

    uniforms.tDiffuse.value = internals._beautyRenderTarget.texture;
    uniforms.tDepth.value = internals._beautyRenderTarget.depthTexture;
    uniforms.tNormal.value = internals._normalRenderTarget.texture;

    if (this.renderToScreen) {
      renderer.setRenderTarget(null);
    } else {
      renderer.setRenderTarget(writeBuffer);
      if (this.clear) renderer.clear();
    }

    internals._fsQuad.render(renderer);
  }
}

/** How often shadow maps are rebuilt, in seconds (see the note in the loop). */
const SHADOW_REFRESH = 0.2;

/** Mount inside the Canvas - takes over the render loop with the pixel pass. */
export function PixelArtRenderer() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const setDpr = useThree((s) => s.setDpr);

  // With the pixel pass off, render at native resolution - DPR 1 was only
  // acceptable because the art pixels were chunkier than device pixels.
  const { pixelation } = usePixelSettings();
  useEffect(() => {
    setDpr(pixelation ? 1 : Math.min(window.devicePixelRatio || 1, 2));
  }, [pixelation, setDpr]);

  const [composer, pixelPass] = useMemo(() => {
    const s = PIXEL_SETTINGS;
    const pass = new SeeThroughPixelatedPass(s.pixelFar, scene, camera, {
      normalEdgeStrength: s.bevel,
      depthEdgeStrength: s.outline,
    });
    const c = new EffectComposer(gl);
    c.addPass(pass);
    c.addPass(new OutputPass());
    return [c, pass] as const;
  }, [gl, scene, camera]);

  useEffect(() => {
    composer.setPixelRatio(gl.getPixelRatio());
    composer.setSize(size.width, size.height);
  }, [composer, gl, size.width, size.height]);

  useEffect(
    () => () => {
      pixelPass.dispose();
      composer.dispose();
    },
    [composer, pixelPass],
  );

  /**
   * Shadows on demand, not every frame.
   *
   * three.js rebuilds every shadow map on every render by default, so a
   * furnished office pays a third pass over all of its casters sixty times a
   * second to redraw shadows that never moved. The room is static; only the
   * agents walk. Rebuilding at 5Hz is a twelfth of that and looks the same at
   * a stroll's pace.
   *
   * The listener covers the other half: a frame heavy enough to trip the GPU
   * watchdog loses the WebGL context, and the shadow maps die with it - with
   * autoUpdate off nothing would ever ask for them again, leaving a restored
   * canvas permanently unshadowed.
   */
  useEffect(() => {
    gl.shadowMap.autoUpdate = false;
    gl.shadowMap.needsUpdate = true;
    const canvas = gl.domElement;
    const onRestored = () => {
      gl.shadowMap.needsUpdate = true;
    };
    canvas.addEventListener("webglcontextrestored", onRestored);
    return () => {
      canvas.removeEventListener("webglcontextrestored", onRestored);
      gl.shadowMap.autoUpdate = true;
    };
  }, [gl]);

  const sinceShadow = useRef(0);

  // Positive priority tells r3f we own rendering; its default loop stands
  // down (and runs after the camera rig, so the zoom fraction is fresh).
  useFrame((_state, dt) => {
    const s = PIXEL_SETTINGS;

    sinceShadow.current += dt;
    if (sinceShadow.current >= SHADOW_REFRESH) {
      sinceShadow.current = 0;
      gl.shadowMap.needsUpdate = true;
    }

    if (!s.pixelation) {
      gl.render(scene, camera);
      return;
    }
    // Blend the pixel size across the zoom range, switching integer sizes
    // only once the target is 0.6 past the current one - the hysteresis
    // keeps the boundary from flickering while the damped zoom settles.
    const t = s.pixelFar + (s.pixelNear - s.pixelFar) * zoomFraction;
    const rounded = Math.round(t);
    if (
      rounded !== pixelPass.pixelSize &&
      Math.abs(t - pixelPass.pixelSize) >= 0.6
    ) {
      pixelPass.setPixelSize(rounded);
    }
    pixelPass.normalEdgeStrength = s.bevel;
    pixelPass.depthEdgeStrength = s.outline;
    composer.render();
  }, 1);

  return null;
}
