/* A dev page for the v2 landscape runtime (src/memory-rooms/landscape/): no Worker, no spot, just the data maps
   from a work folder. Served by the Vite dev server:

     http://localhost:5173/tools/memory-rooms/landscape/v2/harness/index.html?data=/memory-rooms-work/_peron2/data
       &glb=/memory-rooms-work/_peron2/build/room.glb   the packed model instead of the data folder
       &cam=x,y,z,tx,ty,tz        an orbit camera (world metres)
       &eye=x,z,yawDeg,pitchDeg   stand there (1.6 m above the ground) and look
       &t=seconds                 freeze the clock (screenshots)

   window.__land = { land, renderer, camera, ready, frames, stats() } for the headless checks. */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { Landscape } from '../../../../../src/memory-rooms/landscape/Landscape.js';

const q = new URLSearchParams(location.search);
const base = q.get('data') || '/memory-rooms-work/_peron2/data';
const app = document.getElementById('app');
const hud = document.getElementById('hud');
if (q.get('hud') === '0') hud.style.display = 'none';
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(2, devicePixelRatio));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
renderer.setSize(innerWidth, innerHeight);
app.append(renderer.domElement);
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.2, 9000);
const scene = new THREE.Scene();
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
const state = { land: null, renderer, camera, scene, ready: false, frames: 0, error: null };
window.__land = state;

addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
});

function place() {
  const land = state.land;
  if (q.get('eye')) {
    const [x, z, yaw, pitch] = q.get('eye').split(',').map(Number);
    const y = land.heightAt(x, z) + 1.6;
    camera.position.set(x, y, z);
    const yr = THREE.MathUtils.degToRad(yaw);
    const pr = THREE.MathUtils.degToRad(pitch || 0);
    // yaw clockwise from north (-z)
    const d = new THREE.Vector3(Math.sin(yr) * Math.cos(pr), Math.sin(pr), -Math.cos(yr) * Math.cos(pr));
    controls.target.copy(camera.position).addScaledVector(d, 5);
  } else {
    const c = (q.get('cam') || '0,420,560,0,0,0').split(',').map(Number);
    camera.position.set(c[0], c[1], c[2]);
    controls.target.set(c[3], c[4], c[5]);
  }
  controls.update();
}

let last = performance.now();
let fps = 0;
const frozen = q.has('t') ? Number(q.get('t')) : null;
function tick(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  fps = fps * 0.95 + (dt > 0 ? 1 / dt : 0) * 0.05;
  controls.update();
  if (state.land) {
    state.land.update(camera, frozen != null ? 0 : dt);
    if (frozen != null) state.land.env.uniforms.uTime.value = frozen;
  }
  renderer.render(scene, camera);
  state.frames++;
  const info = renderer.info.render;
  hud.textContent = `fps ${fps.toFixed(0)}  calls ${info.calls}  tris ${(info.triangles / 1000).toFixed(0)}k  nodes ${state.land?.terrain.drawn ?? 0}\n` +
    `cam ${camera.position.x.toFixed(1)}, ${camera.position.y.toFixed(1)}, ${camera.position.z.toFixed(1)}`;
  requestAnimationFrame(tick);
}

state.stats = () => ({ calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, nodes: state.land?.terrain.drawn, plants: state.land?.plants?.drawn, fps });

(async () => {
  try {
    const t0 = performance.now();
    // ?glb=<url>: the packed room.glb (the spot's real model), as the walk and the spot page load it
    if (q.get('glb')) {
      const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(q.get('glb'));
      state.land = await Landscape.fromGltf(gltf, { anisotropy: renderer.capabilities.getMaxAnisotropy(), quality: q.get('quality') || 'high' });
    } else state.land = await Landscape.load({ base, anisotropy: renderer.capabilities.getMaxAnisotropy() });
    state.loadMs = Math.round(performance.now() - t0);
    scene.add(state.land.group);
    if (q.get('debug')) state.land.terrainMat.uniforms.uDebug.value = Number(q.get('debug'));
    place();
    state.ready = true;
  } catch (err) {
    state.error = String(err?.stack || err);
    hud.textContent = state.error;
    console.error(err);
  }
  requestAnimationFrame(tick);
})();
