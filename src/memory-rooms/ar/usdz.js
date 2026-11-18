/* iPhone AR: a USDZ for AR Quick Look, made in the browser from the room the
   viewer has ALREADY loaded (no pipeline change, nothing new to upload).

     const url = await usdzUrl(viewer, spot, 'tabletop' | 'life');   // blob: url, cached

   - 'tabletop': 1:20, the ceiling (or a sloped roof, which the GLB names
     `ceiling`) left out, so you look into the room from above: the dollhouse.
   - 'life': 1:1 with everything, so you can stand inside it.
   Either way the footprint centre sits on the origin and the floor on y = 0,
   which is what Quick Look puts on the surface you point at.

   The bake is the light (CONTRACTS.md §4), but Quick Look lights every
   material it's given. So each surface goes out as a MeshStandardMaterial with
   a BLACK base colour, roughness 1, and the baked atlas as its EMISSIVE colour:
   Quick Look adds emission after its lighting, so the baked look shows through
   instead of being relit. Atlases go out as JPEG (no alpha in a bake), capped
   at 1024 px for the tabletop and 2048 px at life size.

   Cached per spot + GLB + scene version: in memory for the page, and in the
   Cache Storage API (when the page is a secure context) across visits. */

import * as THREE from 'three';
import { USDZExporter } from 'three/addons/exporters/USDZExporter.js';
import { roomModelOf } from '../lib/spots.js';

export const SCALES = { tabletop: 1 / 20, life: 1 };
const CACHE = 'mr-usdz-v1';
const memo = new Map(); // key → Promise<string blob url>

function cacheKey(spot, scale) {
  const glb = roomModelOf(spot);
  const version = [glb?.r2Key, glb?.bytes, glb?.createdAt, spot.sceneVersion ?? 0].join('|');
  return `https://memory-rooms.local/usdz/${spot.id}/${scale}?v=${encodeURIComponent(version)}`;
}

async function fromCache(key) {
  try {
    if (typeof caches === 'undefined') return null;
    const hit = await (await caches.open(CACHE)).match(key);
    return hit ? await hit.blob() : null;
  } catch {
    return null;
  }
}

async function toCache(key, blob) {
  try {
    if (typeof caches === 'undefined') return;
    const cache = await caches.open(CACHE);
    // one entry per spot + scale: drop older versions of it
    const prefix = key.split('?')[0];
    for (const req of await cache.keys()) if (req.url.split('?')[0] === prefix && req.url !== key) await cache.delete(req);
    await cache.put(key, new Response(blob, { headers: { 'content-type': 'model/vnd.usdz+zip' } }));
  } catch {
    /* private mode / quota: the in-memory copy still serves this visit */
  }
}

/** A blob: url of the USDZ for this spot at this scale. Rejects if the viewer has no room loaded. */
export function usdzUrl(viewer, spot, scale) {
  const key = cacheKey(spot, scale);
  // another spot (or a newer version of this one): free the blobs held for the last one
  for (const [k, job] of memo) {
    if (k.split('?')[0].split('/').slice(-2, -1)[0] === spot.id && k.split('?')[1] === key.split('?')[1]) continue;
    memo.delete(k);
    job.then((url) => URL.revokeObjectURL(url)).catch(() => {});
  }
  if (!memo.has(key)) {
    const job = (async () => {
      let blob = await fromCache(key);
      if (!blob) {
        blob = await buildUsdz(viewer, scale);
        await toCache(key, blob);
      }
      return URL.createObjectURL(blob);
    })();
    memo.set(key, job);
    job.catch(() => memo.delete(key));
  }
  return memo.get(key);
}

/** The USDZ bytes as a Blob (exported for the headless check). */
export async function buildUsdz(viewer, scale) {
  const room = viewer?.rooms?.[0];
  if (!room?.root || viewer.status?.main?.state !== 'ready') throw new Error('room not loaded');
  const tabletop = scale !== 'life';

  // A clone shares the viewer's geometry and textures (nothing is copied or freed).
  const clone = room.root.clone(true);
  const twins = new Map();
  const maps = new Map();
  clone.traverse((o) => {
    o.visible = !(tabletop && /^ceiling/.test(o.name || ''));
    if (!o.isMesh) return;
    const list = Array.isArray(o.material) ? o.material : [o.material];
    const next = list.map((m) => {
      if (!twins.has(m)) twins.set(m, quickLookMaterial(m, maps));
      return twins.get(m);
    });
    o.material = Array.isArray(o.material) ? next : next[0];
  });

  // Nothing below the floor: a ground plate's skirt (0.4 m on the diner) or a floor slab's
  // underside would make Quick Look, which rests the model's lowest point on the surface,
  // float the floor that far up. Those meshes get a copy of their geometry with y >= 0.
  const lifted = [];
  clone.updateMatrixWorld(true);
  const v = new THREE.Vector3();
  clone.traverse((o) => {
    if (!o.isMesh || !o.visible) return;
    const pos = o.geometry.attributes.position;
    let below = false;
    for (let k = 0; k < pos.count && !below; k++) below = v.fromBufferAttribute(pos, k).applyMatrix4(o.matrixWorld).y < -0.005;
    if (!below) return;
    const g = o.geometry.clone();
    const inv = new THREE.Matrix4().copy(o.matrixWorld).invert();
    const p = g.attributes.position;
    for (let k = 0; k < p.count; k++) {
      v.fromBufferAttribute(p, k).applyMatrix4(o.matrixWorld);
      if (v.y < 0) {
        v.y = 0;
        v.applyMatrix4(inv);
        p.setXYZ(k, v.x, v.y, v.z);
      }
    }
    p.needsUpdate = true;
    o.geometry = g;
    lifted.push(g);
  });

  // Footprint centre to the origin, floor at 0.
  const box = room.box || new THREE.Box3().setFromObject(room.root);
  const centre = box.getCenter(new THREE.Vector3());
  const inner = new THREE.Group();
  inner.position.set(-centre.x, 0, -centre.z);
  inner.add(clone);
  const outer = new THREE.Group();
  outer.name = 'room';
  outer.scale.setScalar(SCALES[tabletop ? 'tabletop' : 'life']);
  outer.add(inner);
  outer.updateMatrixWorld(true);

  try {
    const exporter = new USDZExporter();
    const bytes = await exporter.parseAsync(outer, {
      quickLookCompatible: true,
      maxTextureSize: tabletop ? 1024 : 2048,
      ar: { anchoring: { type: 'plane' }, planeAnchoring: { alignment: 'horizontal' } },
    });
    return new Blob([bytes], { type: 'model/vnd.usdz+zip' });
  } finally {
    for (const m of twins.values()) m.dispose();
    for (const t of maps.values()) t.dispose(); // never uploaded; the image stays the viewer's
    for (const g of lifted) g.dispose();
  }
}

/** The baked look as emission over a black, fully rough base (Quick Look can't relight it). */
function quickLookMaterial(m, maps) {
  const opacity = m.userData?.baseOpacity ?? m.opacity ?? 1;
  const transparent = Boolean(m.userData?.baseTransparent ?? m.transparent);
  const out = new THREE.MeshStandardMaterial({
    name: m.name,
    color: 0x000000,
    roughness: 1,
    metalness: 0,
    emissive: m.color ? m.color.clone() : new THREE.Color(1, 1, 1),
    emissiveIntensity: 1,
    side: m.side,
    transparent,
    opacity,
    alphaTest: m.alphaTest || 0,
  });
  if (m.map) {
    const keepAlpha = transparent || (m.alphaTest || 0) > 0;
    const id = `${m.map.uuid}|${keepAlpha}`;
    if (!maps.has(id)) {
      // A twin texture over the same image, so the exporter writes it once, as JPEG unless it needs alpha.
      const t = new THREE.Texture(m.map.image);
      t.flipY = m.map.flipY;
      t.colorSpace = THREE.SRGBColorSpace;
      t.channel = m.map.channel;
      t.userData.mimeType = keepAlpha ? 'image/png' : 'image/jpeg';
      maps.set(id, t);
    }
    out.emissiveMap = maps.get(id);
  }
  return out;
}
