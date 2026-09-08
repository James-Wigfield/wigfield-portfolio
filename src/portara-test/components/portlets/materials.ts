/**
 * The tools' materials, shared by every tool and prop: proper PBR, and each
 * one different from the next at a glance. Metals bright and smooth, wood and
 * rubber rough and matt. Built once; dispose() when the scene goes.
 */
import * as THREE from "three";

function std(color: string, roughness: number, metalness = 0, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
}

/** Decals sit a hair off the surface; this keeps them from z-fighting. */
const decal = { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 };

export function makeToolMaterials() {
  return {
    steel: std("#cfd4dc", 0.22, 0.92),
    darkSteel: std("#5d6670", 0.34, 0.86),
    chrome: std("#e8ecf2", 0.12, 1.0),
    brass: std("#c9a24d", 0.28, 0.9),
    copper: std("#b87548", 0.32, 0.9),
    wood: std("#8a5a2b", 0.78, 0),
    woodDark: std("#5e3a1a", 0.82, 0),
    rubber: std("#1b1d21", 0.95, 0),
    plasticAccent: std("#ff4e2b", 0.45, 0),
    plasticYellow: std("#e9b823", 0.5, 0),
    plasticDark: std("#2a2f38", 0.6, 0),
    plasticWhite: std("#f1efe8", 0.55, 0),
    pad: std("#efe9dc", 1.0, 0),
    bristle: std("#2b2b2b", 1.0, 0),
    cable: std("#ffcc33", 0.6, 0),
    /** A fresh coat on the near-black letter: darker, glossier. */
    paint: std("#080c12", 0.1, 0.15, decal),
    /** A weld bead left on the seam. */
    bead: std("#9aa3ad", 0.3, 0.9, decal),
    /** The shine a polish leaves: additive, faded out over a second. */
    shine: new THREE.MeshBasicMaterial({
      color: "#ffffff",
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      ...decal,
    }),
    /** The welding arc. */
    arc: new THREE.MeshBasicMaterial({
      color: "#fff3c4",
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
    sparks: new THREE.PointsMaterial({
      color: "#ffcf6a",
      size: 0.012,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
    dust: new THREE.PointsMaterial({
      color: "#9a9a90",
      size: 0.009,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
    }),
    /** Debug gizmos. */
    debugFace: new THREE.MeshBasicMaterial({ color: "#3ec9ff", depthTest: false, transparent: true, opacity: 0.9 }),
    debugWall: new THREE.MeshBasicMaterial({ color: "#ff5ed2", depthTest: false, transparent: true, opacity: 0.9 }),
    debugSpot: new THREE.MeshBasicMaterial({ color: "#ffe14a", depthTest: false }),
    debugTipOk: new THREE.MeshBasicMaterial({ color: "#39ff88", depthTest: false }),
    debugTipBad: new THREE.MeshBasicMaterial({ color: "#ff2a2a", depthTest: false }),
    debugLine: new THREE.LineBasicMaterial({ color: "#3ec9ff", depthTest: false, transparent: true, opacity: 0.7 }),
  };
}
export type ToolMaterials = ReturnType<typeof makeToolMaterials>;

export function disposeToolMaterials(m: ToolMaterials) {
  for (const mat of Object.values(m)) (mat as THREE.Material).dispose();
}
