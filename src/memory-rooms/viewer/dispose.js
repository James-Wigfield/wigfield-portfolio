/* Freeing GPU (and CPU) memory for anything the viewer added to a scene.
   three.js never frees geometry, materials or textures on its own. */

const asList = (m) => (Array.isArray(m) ? m : m ? [m] : []);

/** Every texture a material references (map, alphaMap, emissiveMap, …). */
export function texturesOf(material) {
  const out = [];
  for (const value of Object.values(material)) {
    if (value && value.isTexture) out.push(value);
  }
  return out;
}

export function disposeTexture(tex) {
  if (!tex) return;
  tex.dispose();
  // GLTFLoader decodes to ImageBitmap in most browsers; close() frees the CPU copy.
  const img = tex.image;
  if (img && typeof img.close === 'function') {
    try {
      img.close();
    } catch {
      /* already closed */
    }
  }
}

export function disposeMaterial(material, keep) {
  for (const tex of texturesOf(material)) {
    if (!keep || !keep.has(tex)) disposeTexture(tex);
  }
  material.dispose();
}

/** Dispose every geometry, material and texture under `root`, then detach it. */
export function disposeTree(root) {
  if (!root) return;
  const materials = new Set();
  root.traverse((obj) => {
    if (obj.geometry) obj.geometry.dispose();
    for (const m of asList(obj.material)) materials.add(m);
  });
  for (const m of materials) disposeMaterial(m);
  root.removeFromParent();
}
