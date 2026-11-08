/* The optional photoreal lane: a Scaniverse phone scan (.spz Gaussian splat)
   drawn with Spark (@sparkjsdev/spark 2.x). Spark is imported lazily, so the
   model view never downloads it.

   Orientation: Scaniverse (like most splat tools) writes OpenCV-style
   coordinates, y DOWN and z forward, so in three.js (y up) a raw scan shows
   upside down. SCAN_CORRECTION rotates it 180 degrees about x, the same fix
   Spark's own examples use (quaternion (1, 0, 0, 0)). If a future export
   arrives the right way up, change this ONE constant to the identity. */

import * as THREE from 'three';

export const SCAN_CORRECTION = new THREE.Quaternion(1, 0, 0, 0); // 180 deg about +x

/** Spark module, loaded once on first use. */
let sparkModule = null;
const loadSpark = () => (sparkModule ??= import('@sparkjsdev/spark'));

/**
 * Robust bounds of a splat (5th–95th percentile of splat centres, after the
 * correction), so a few stray floaters don't push the orbit miles away.
 */
function robustBounds(mesh) {
  const xs = [];
  const ys = [];
  const zs = [];
  const total = mesh.packedSplats?.numSplats ?? mesh.splats?.getNumSplats?.() ?? 0;
  const stride = Math.max(1, Math.floor(total / 40000));
  let i = 0;
  const v = new THREE.Vector3();
  mesh.forEachSplat((index, center) => {
    if (i++ % stride !== 0) return;
    v.copy(center).applyQuaternion(mesh.quaternion);
    xs.push(v.x);
    ys.push(v.y);
    zs.push(v.z);
  });
  if (xs.length < 8) {
    const box = mesh.getBoundingBox(true);
    return box.applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(mesh.quaternion));
  }
  const q = (arr, p) => {
    arr.sort((a, b) => a - b);
    return arr[Math.min(arr.length - 1, Math.max(0, Math.round(p * (arr.length - 1))))];
  };
  return new THREE.Box3(new THREE.Vector3(q(xs, 0.05), q(ys, 0.05), q(zs, 0.05)), new THREE.Vector3(q(xs, 0.95), q(ys, 0.95), q(zs, 0.95)));
}

/**
 * Load a scan into a new Scene. Resolves { scene, bounds, dispose }.
 *   onDirty: Spark wants another frame (sorting finished, etc.)
 *   onProgress: 0..1
 */
export async function loadScan({ url, renderer, onDirty, onProgress, isStale }) {
  const { SparkRenderer, SplatMesh } = await loadSpark();
  if (isStale()) return null;
  const scene = new THREE.Scene();
  const spark = new SparkRenderer({ renderer, onDirty });
  scene.add(spark);
  const splat = new SplatMesh({
    url,
    onProgress: (e) => {
      if (e && e.lengthComputable && e.total) onProgress?.(e.loaded / e.total);
    },
  });
  splat.quaternion.copy(SCAN_CORRECTION);
  scene.add(splat);
  const dispose = () => {
    scene.remove(splat);
    scene.remove(spark);
    splat.dispose();
    spark.dispose();
  };
  try {
    await splat.initialized;
  } catch (err) {
    dispose();
    throw err;
  }
  if (isStale()) {
    dispose();
    return null;
  }
  return { scene, bounds: robustBounds(splat), dispose };
}
