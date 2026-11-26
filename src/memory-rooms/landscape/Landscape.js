/* A live v2 landscape (Point Peron v2 first): the ground, the sea, the sky, the plants and what stands on the
   ground, lit in the browser. Used by the spot viewer (orbit) and the walk (first person), one class for both.

     const land = await Landscape.load({ base: url } | { gltf })   // a folder of data maps, or a room.glb
     scene.add(land.group)
     land.update(camera, dt)        // every frame: LOD, time
     land.field                     // heights / walk flags (field.js) for the walker
     land.dispose()

   Data: data.json + heights / splat / veg / water / shade PNGs + data/tex/<layer>-a/-n.png
   (tools/memory-rooms/landscape/v2/export_data.py + textures.py). A room.glb carries the same files as
   PNG byte arrays named in its root extras (`mrLandscape`, pack.mjs). */

import * as THREE from 'three';
import { decodePng, makeField } from './field.js';
import { LAYERS, makeEnv, skyMaterial, terrainMaterial, waterMaterial } from './materials.js';
import { Terrain } from './terrain.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { Plants, buildSites } from './props.js';
import { buildWays } from './paths.js';

function dataTexture(img, { srgb = false } = {}) {
  const tex = new THREE.DataTexture(new Uint8Array(img.data.buffer.slice(0)), img.width, img.height, THREE.RGBAFormat);
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.flipY = false;
  tex.needsUpdate = true;
  return tex;
}

function repeat(tex) {
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function arrayTexture(imgs, { srgb = false, anisotropy = 4 } = {}) {
  const { width, height } = imgs[0];
  const data = new Uint8Array(width * height * 4 * imgs.length);
  imgs.forEach((im, i) => data.set(im.data, i * width * height * 4));
  const tex = new THREE.DataArrayTexture(data, width, height, imgs.length);
  tex.format = THREE.RGBAFormat;
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = anisotropy;
  tex.needsUpdate = true;
  return tex;
}

export class Landscape {
  /**
   * From a packed room.glb (tools/memory-rooms/landscape/v2/pack.mjs): the props are the GLB's own scene, and
   * every data file is a byte accessor named `mrLand:<file>`, listed in the root extras `mrLandscape`.
   */
  static async fromGltf(gltf, { anisotropy = 4, quality = 'high' } = {}) {
    const info = gltf.userData?.mrLandscape;
    if (!info) throw new Error('not a live landscape GLB (no mrLandscape extras)');
    const json = gltf.parser.json;
    const files = {};
    const types = {};
    await Promise.all(
      Object.entries(info.files).map(async ([name, { accessor, bytes }]) => {
        const idx = json.accessors.findIndex((a) => a.name === accessor);
        if (idx < 0) throw new Error(`landscape GLB: no accessor ${accessor}`);
        const attr = await gltf.parser.getDependency('accessor', idx);
        const arr = attr.array;
        files[name] = new Uint8Array(arr.buffer, arr.byteOffset, bytes);
        types[name] = info.files[name].type || 'image/png';
      }),
    );
    files['props.glb'] = gltf;
    return Landscape.load({ files, types, meta: info.meta, anisotropy, quality });
  }

  /** files: name -> Uint8Array | url (props.glb may also be an already parsed gltf); meta: data.json */
  static async load({ base = null, files = null, types = {}, meta = null, anisotropy = 4, quality = 'high' } = {}) {
    const src = (name) => (files ? files[name] : `${base}/${name}`);
    if (!meta) meta = await (await fetch(src('data.json'))).json();
    const tex = meta.textures;
    const layerNames = LAYERS.filter((l) => tex.tile[l] != null);
    const names = ['heights.png', 'splat.png', 'veg.png', 'water.png', 'shade.png', 'tex/waves.png', ...layerNames.flatMap((l) => [`tex/${l}-a.png`, `tex/${l}-n.png`])];
    const bytes = async (n) => {
      const s = src(n);
      return typeof s === 'string' ? new Uint8Array(await (await fetch(s)).arrayBuffer()) : s;
    };
    const [imgs, leaves, props, plants] = await Promise.all([
      Promise.all(names.map(async (n) => [n, await decodePng(src(n), types[n])])).then(Object.fromEntries),
      // the leaf atlas keeps its alpha: straight to an ImageBitmap (a 2D canvas would premultiply it away)
      bytes('tex/leaves.png').then((b) => createImageBitmap(new Blob([b], { type: types['tex/leaves.png'] || 'image/png' }), { premultiplyAlpha: 'none', colorSpaceConversion: 'none' })),
      files?.['props.glb']?.scene
        ? files['props.glb']
        : bytes('props.glb').then((b) => new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), '')),
      meta.plants ? bytes('plants.bin') : null,
    ]);
    return new Landscape(meta, imgs, layerNames, anisotropy, { leaves, props, plants, quality });
  }

  /** quality 'low' (phones): plants drawn to ~60 % of the distance, a coarser terrain LOD */
  constructor(meta, imgs, layerNames, anisotropy, { leaves = null, props = null, plants = null, quality = 'high' } = {}) {
    this.quality = quality;
    this.meta = meta;
    this.field = makeField(meta, imgs['heights.png']);
    this.env = makeEnv({ frame: meta.frame, sun: meta.sun });
    const maps = {
      splat: dataTexture(imgs['splat.png']),
      veg: dataTexture(imgs['veg.png']),
      water: dataTexture(imgs['water.png']),
      shade: dataTexture(imgs['shade.png']),
      alb: arrayTexture(layerNames.map((l) => imgs[`tex/${l}-a.png`]), { srgb: true, anisotropy }),
      nrm: arrayTexture(layerNames.map((l) => imgs[`tex/${l}-n.png`]), { anisotropy }),
      tiles: new THREE.Vector4(...['sand', 'limestone', 'soil', 'weed'].map((l) => meta.textures.tile[l])),
      rough: new THREE.Vector4(...['sand', 'limestone', 'soil', 'weed'].map((l) => meta.textures.rough?.[l] ?? 0.9)),
      waves: repeat(dataTexture(imgs['tex/waves.png'])),
      leaves: null,
    };
    if (leaves) {
      const t = new THREE.Texture(leaves);
      t.colorSpace = THREE.SRGBColorSpace;
      t.flipY = false;
      t.premultiplyAlpha = false;
      t.anisotropy = anisotropy;
      t.minFilter = THREE.LinearMipmapLinearFilter;
      t.needsUpdate = true;
      maps.leaves = t;
    }
    this.maps = maps;
    for (const im of Object.values(imgs)) im.bitmap?.close?.();
    this.group = new THREE.Group();
    this.group.name = 'landscape';
    this.terrainMat = terrainMaterial(this.env, maps);
    this.terrain = new Terrain(this.field, this.terrainMat, { k: quality === 'low' ? 1.35 : 1.7 });
    this.group.add(this.terrain.group);

    // the sea: one big sheet at y = 0, out past the horizon
    this.waterMat = waterMaterial(this.env, maps);
    const water = new THREE.Mesh(new THREE.PlaneGeometry(24000, 24000).rotateX(-Math.PI / 2), this.waterMat);
    water.name = 'landscape__water';
    water.renderOrder = 2;
    water.frustumCulled = false;
    this.water = water;
    this.group.add(water);

    const sky = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), skyMaterial(this.env));
    sky.name = 'landscape__sky';
    sky.frustumCulled = false;
    sky.renderOrder = -10;
    this.sky = sky;
    this.group.add(sky);

    this.ways = meta.ways ? buildWays(meta.ways, this.field, this.env, maps) : null;
    if (this.ways) this.group.add(this.ways);
    this.sites = null;
    this.plants = null;
    if (props) {
      this.sites = buildSites(props.scene, this.env, maps);
      this.group.add(this.sites);
      if (plants && meta.plants) {
        this.plants = new Plants(props.scene, meta, plants, this.env, maps, { reach: quality === 'low' ? 0.6 : 1 });
        this.group.add(this.plants.group);
      }
    }
    this.time = 0;
  }

  update(camera, dt = 0) {
    this.time += dt;
    this.env.uniforms.uTime.value = this.time;
    this.terrain.update(camera);
    this.plants?.update(camera);
    // the swash: the sea rises and falls a few centimetres, so the waterline runs up and back down the sand
    this.water.position.set(camera.position.x, 0.05 * Math.sin(this.time * 0.75) + 0.02 * Math.sin(this.time * 1.9), camera.position.z);
    this.water.position.x = Math.round(this.water.position.x / 100) * 100;
    this.water.position.z = Math.round(this.water.position.z / 100) * 100;
  }

  /** what the walker needs: the ground under (x, z) and whether it can stand there */
  heightAt(x, z) {
    return this.field.heightAt(x, z);
  }

  dispose() {
    this.terrain.dispose();
    this.plants?.dispose();
    this.sites?.userData.dispose?.();
    if (this.ways) {
      this.ways.geometry.dispose();
      this.ways.material.dispose();
    }
    for (const m of [this.terrainMat, this.waterMat, this.sky.material]) m.dispose();
    this.water.geometry.dispose();
    this.sky.geometry.dispose();
    for (const t of Object.values(this.maps)) t?.dispose?.();
    this.group.removeFromParent();
  }
}
