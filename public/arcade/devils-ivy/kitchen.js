/* ============================================================================
   DEVIL'S IVY — the kitchen, in three.js
   ----------------------------------------------------------------------------
   James and Justin's kitchen, rebuilt from a phone photo: white gloss
   cupboards with bar handles, black speckled granite tops, a grey marble
   splashback, the stainless rangehood with its glass wing, a dark fridge
   covered in magnets and polaroids, a wicker basket on top, Woolies bags on
   the island, the air fryer, the round LED on the ceiling and the hatch
   beside it.

   Every walkable surface comes from BOXES in world.js — this file only
   dresses them. Anything drawn here that is NOT in BOXES (door fronts,
   handles, the canopy glass, roses, frames, the curtain) stays within a
   centimetre or two of a real surface or is see-through, so a vine never
   visibly walks on air. Textures are drawn on canvases at load: no image
   files, nothing to download.
   ========================================================================== */

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/RoundedBoxGeometry.js';
import { BOXES, ROOM } from './world.js';

const W = ROOM.w;
const H = ROOM.h;
const D = ROOM.d;

// ── tiny seeded random, so the magnets land in the same place every load ────
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

function tex(c, { repeat = null, aniso = 4 } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
  }
  return t;
}

// ── Textures ─────────────────────────────────────────────────────────────────
// Matt paint: almost white, with a faint roller texture. Without it a vine
// crawling up a bare wall has nothing to show it is moving.
function paintTexture(seed, repeat) {
  const [c, g] = canvas(256, 256);
  const r = rng(seed);
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2600; i++) {
    const v = 236 + Math.floor(r() * 19);
    g.fillStyle = `rgba(${v},${v},${v - 2},0.5)`;
    g.fillRect(r() * 256, r() * 256, 1 + r() * 3, 1 + r() * 3);
  }
  for (let i = 0; i < 14; i++) {
    g.fillStyle = `rgba(214,212,206,${0.025 + r() * 0.03})`;
    g.beginPath();
    g.ellipse(r() * 256, r() * 256, 20 + r() * 50, 8 + r() * 20, r() * 3, 0, Math.PI * 2);
    g.fill();
  }
  return tex(c, { repeat });
}

function plankTexture() {
  const [c, g] = canvas(1024, 1024);
  const r = rng(11);
  const plankH = 128; // 8 planks per tile, each ~15 cm on a 1.2 m tile
  for (let row = 0; row < 8; row++) {
    let x = -Math.floor(r() * 600);
    while (x < 1024) {
      const len = 380 + r() * 520;
      const base = [196 + r() * 18, 166 + r() * 16, 124 + r() * 14];
      g.fillStyle = `rgb(${base.map(Math.round).join(',')})`;
      g.fillRect(x, row * plankH, len, plankH);
      // grain
      for (let k = 0; k < 26; k++) {
        const y = row * plankH + 6 + r() * (plankH - 12);
        g.strokeStyle = `rgba(${110 + r() * 30},${80 + r() * 20},${50},${0.08 + r() * 0.12})`;
        g.lineWidth = 0.8 + r() * 1.8;
        g.beginPath();
        g.moveTo(x, y);
        for (let s = 0; s <= 8; s++) g.lineTo(x + (len * s) / 8, y + Math.sin(s * 0.9 + k) * (1 + r() * 3));
        g.stroke();
      }
      // a knot now and then
      if (r() < 0.35) {
        const kx = x + r() * len;
        const ky = row * plankH + 20 + r() * (plankH - 40);
        g.fillStyle = 'rgba(110,78,44,0.35)';
        g.beginPath();
        g.ellipse(kx, ky, 10 + r() * 8, 4 + r() * 3, 0, 0, Math.PI * 2);
        g.fill();
      }
      g.fillStyle = 'rgba(70,50,30,0.55)';
      g.fillRect(x, row * plankH, 2, plankH); // butt joint
      x += len;
    }
    g.fillStyle = 'rgba(70,50,30,0.5)';
    g.fillRect(0, row * plankH, 1024, 2); // long joint
  }
  return tex(c, { repeat: [W / 1.2, D / 1.2], aniso: 8 });
}

function graniteTexture() {
  const [c, g] = canvas(512, 512);
  const r = rng(23);
  g.fillStyle = '#151618';
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 2200; i++) {
    const v = r();
    g.fillStyle =
      v < 0.5 ? `rgba(40,42,44,${0.6 + r() * 0.4})` : v < 0.8 ? `rgba(95,96,98,${0.5 + r() * 0.5})` : v < 0.94 ? `rgba(190,190,186,${0.6 + r() * 0.4})` : `rgba(170,140,90,${0.7})`;
    const s = 0.6 + r() * (v < 0.5 ? 6 : 2.4);
    g.beginPath();
    g.arc(r() * 512, r() * 512, s, 0, Math.PI * 2);
    g.fill();
  }
  return tex(c, { repeat: [1, 1] });
}

function marbleTexture() {
  const [c, g] = canvas(1024, 256);
  const r = rng(37);
  const grad = g.createLinearGradient(0, 0, 1024, 256);
  grad.addColorStop(0, '#a8a7a3');
  grad.addColorStop(0.5, '#9d9c98');
  grad.addColorStop(1, '#a5a49f');
  g.fillStyle = grad;
  g.fillRect(0, 0, 1024, 256);
  for (let i = 0; i < 18; i++) {
    g.strokeStyle = `rgba(236,236,232,${0.2 + r() * 0.35})`;
    g.lineWidth = 0.6 + r() * 2.2;
    g.beginPath();
    let x = r() * 1024;
    let y = r() * 256;
    g.moveTo(x, y);
    for (let s = 0; s < 6; s++) {
      x += (r() - 0.3) * 220;
      y += (r() - 0.5) * 120;
      g.quadraticCurveTo(x - 60 + r() * 120, y - 40 + r() * 80, x, y);
    }
    g.stroke();
  }
  for (let i = 0; i < 900; i++) {
    g.fillStyle = `rgba(${r() < 0.5 ? '70,70,68' : '230,230,226'},${0.06 + r() * 0.08})`;
    g.fillRect(r() * 1024, r() * 256, 2 + r() * 6, 2 + r() * 6);
  }
  // big-format tile grout (60 × 30 cm tiles)
  g.fillStyle = 'rgba(205,205,200,0.9)';
  for (let x = 0; x <= 1024; x += 1024 / 4.33) g.fillRect(x, 0, 2, 256);
  g.fillRect(0, 127, 1024, 2);
  return tex(c);
}

function kraftTexture(logo) {
  const [c, g] = canvas(256, 256);
  const r = rng(logo ? 51 : 52);
  g.fillStyle = '#b4936a';
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 500; i++) {
    g.strokeStyle = `rgba(${r() < 0.5 ? '120,92,60' : '210,180,140'},${0.05 + r() * 0.08})`;
    g.lineWidth = 1;
    g.beginPath();
    const x = r() * 256;
    const y = r() * 256;
    g.moveTo(x, y);
    g.lineTo(x + (r() - 0.5) * 30, y + (r() - 0.5) * 6);
    g.stroke();
  }
  // fold creases
  g.fillStyle = 'rgba(90,66,40,0.18)';
  g.fillRect(0, 200, 256, 3);
  g.fillRect(30, 0, 2, 256);
  g.fillRect(224, 0, 2, 256);
  if (logo) {
    // A green supermarket-style mark: a round fruit made of two swooshes.
    g.save();
    g.translate(128, 110);
    g.strokeStyle = '#1f8a43';
    g.lineCap = 'round';
    g.lineWidth = 26;
    g.beginPath();
    g.arc(0, 8, 54, Math.PI * 0.62, Math.PI * 2.22);
    g.stroke();
    g.lineWidth = 20;
    g.beginPath();
    g.arc(-2, 8, 22, Math.PI * 1.1, Math.PI * 2.3);
    g.stroke();
    g.fillStyle = '#1f8a43';
    g.beginPath();
    g.ellipse(26, -62, 14, 7, -0.6, 0, Math.PI * 2);
    g.fill();
    g.restore();
    g.fillStyle = 'rgba(31,138,67,0.75)';
    g.fillRect(70, 228, 116, 5);
    g.fillRect(90, 238, 76, 4);
  }
  return tex(c);
}

function magnetTexture() {
  const [c, g] = canvas(512, 768);
  const r = rng(77);
  const grad = g.createLinearGradient(0, 0, 512, 0);
  grad.addColorStop(0, '#202122');
  grad.addColorStop(0.5, '#2a2b2c');
  grad.addColorStop(1, '#1d1e1f');
  g.fillStyle = grad;
  g.fillRect(0, 0, 512, 768);
  const palette = ['#e84a3c', '#f2c53d', '#4aa3df', '#7bd389', '#f08bb7', '#b48cff', '#ff9f43', '#e8e6df', '#5fd9ff'];
  const items = [];
  // polaroids
  for (let i = 0; i < 16; i++) items.push({ k: 'polaroid', w: 52 + r() * 10, h: 62 + r() * 10 });
  for (let i = 0; i < 9; i++) items.push({ k: 'card', w: 50 + r() * 50, h: 34 + r() * 40 });
  for (let i = 0; i < 12; i++) items.push({ k: 'dot', w: 18 + r() * 16, h: 0 });
  items.push({ k: 'heart', w: 70, h: 90 }, { k: 'cat', w: 64, h: 86 }, { k: 'mask', w: 70, h: 54 });
  for (const it of items) {
    const x = 20 + r() * 440;
    const y = it.k === 'dot' ? 30 + r() * 700 : 20 + r() * 420; // most of it on the upper door
    g.save();
    g.translate(x, y);
    g.rotate((r() - 0.5) * 0.35);
    if (it.k === 'polaroid') {
      g.fillStyle = '#f1efe8';
      g.fillRect(-it.w / 2, -it.h / 2, it.w, it.h);
      const ph = g.createLinearGradient(0, -it.h / 2, 0, it.h / 2);
      ph.addColorStop(0, palette[Math.floor(r() * palette.length)]);
      ph.addColorStop(1, `rgb(${40 + r() * 60},${40 + r() * 60},${40 + r() * 60})`);
      g.fillStyle = ph;
      g.fillRect(-it.w / 2 + 5, -it.h / 2 + 5, it.w - 10, it.w - 12);
    } else if (it.k === 'card') {
      g.fillStyle = palette[Math.floor(r() * palette.length)];
      g.fillRect(-it.w / 2, -it.h / 2, it.w, it.h);
      g.fillStyle = 'rgba(255,255,255,0.6)';
      g.fillRect(-it.w / 2 + 6, -it.h / 2 + 6, it.w * 0.6, 4);
      g.fillRect(-it.w / 2 + 6, -it.h / 2 + 14, it.w * 0.4, 4);
    } else if (it.k === 'dot') {
      g.fillStyle = palette[Math.floor(r() * palette.length)];
      g.beginPath();
      g.arc(0, 0, it.w / 2, 0, Math.PI * 2);
      g.fill();
    } else if (it.k === 'heart') {
      g.fillStyle = '#f4f2ec';
      g.fillRect(-35, -45, 70, 90);
      g.fillStyle = '#d6332b';
      g.beginPath();
      g.moveTo(0, 20);
      g.bezierCurveTo(-30, -2, -20, -30, 0, -14);
      g.bezierCurveTo(20, -30, 30, -2, 0, 20);
      g.fill();
    } else if (it.k === 'cat') {
      g.fillStyle = '#f2c53d';
      g.fillRect(-32, -43, 64, 86);
      g.fillStyle = '#111';
      g.beginPath();
      g.arc(0, 8, 18, 0, Math.PI * 2);
      g.fill();
      g.fillRect(-14, -18, 8, 14);
      g.fillRect(6, -18, 8, 14);
    } else if (it.k === 'mask') {
      g.fillStyle = '#c9a24a';
      g.beginPath();
      g.ellipse(0, 0, 34, 22, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#2a2015';
      g.beginPath();
      g.ellipse(-13, -3, 8, 5, 0.2, 0, Math.PI * 2);
      g.ellipse(13, -3, 8, 5, -0.2, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  }
  return tex(c);
}

function wickerTexture() {
  const [c, g] = canvas(256, 256);
  g.fillStyle = '#8f7350';
  g.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 16) {
    for (let x = 0; x < 256; x += 16) {
      const odd = ((x + y) / 16) % 2;
      g.fillStyle = odd ? '#b8996b' : '#a5875c';
      g.fillRect(x + 1, y + 1, 14, 14);
      g.fillStyle = 'rgba(60,40,20,0.25)';
      if (odd) g.fillRect(x + 1, y + 7, 14, 2);
      else g.fillRect(x + 7, y + 1, 2, 14);
    }
  }
  return tex(c, { repeat: [2, 1] });
}

function woodTexture() {
  const [c, g] = canvas(256, 256);
  const r = rng(91);
  g.fillStyle = '#b07a48';
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 40; i++) {
    g.strokeStyle = `rgba(110,64,30,${0.15 + r() * 0.2})`;
    g.lineWidth = 1 + r() * 2;
    g.beginPath();
    const x = r() * 256;
    g.moveTo(x, 0);
    g.bezierCurveTo(x + 10, 80, x - 10, 170, x + 4, 256);
    g.stroke();
  }
  return tex(c);
}

function cooktopTexture() {
  const [c, g] = canvas(256, 192);
  g.fillStyle = '#0c0d0e';
  g.fillRect(0, 0, 256, 192);
  g.strokeStyle = 'rgba(150,150,150,0.35)';
  g.lineWidth = 2;
  for (const [x, y, rr] of [[64, 52, 34], [190, 52, 26], [64, 140, 26], [190, 140, 36]]) {
    g.beginPath();
    g.arc(x, y, rr, 0, Math.PI * 2);
    g.stroke();
  }
  return tex(c);
}

function photoFrameTexture(n, seed) {
  const [c, g] = canvas(96 * n + 16, 112);
  const r = rng(seed);
  g.fillStyle = '#f2f0ea';
  g.fillRect(0, 0, c.width, c.height);
  for (let i = 0; i < n; i++) {
    const x0 = 8 + i * 96 + 6;
    const grd = g.createLinearGradient(0, 14, 0, 98);
    const v = 60 + r() * 80;
    grd.addColorStop(0, `rgb(${v + 60},${v + 60},${v + 60})`);
    grd.addColorStop(1, `rgb(${v - 30},${v - 30},${v - 30})`);
    g.fillStyle = grd;
    g.fillRect(x0, 14, 84, 84);
    g.fillStyle = `rgba(20,20,20,${0.4 + r() * 0.3})`;
    g.fillRect(x0 + 10 + r() * 30, 40 + r() * 20, 20 + r() * 30, 40); // a building
  }
  return tex(c);
}

function stickyTexture(text) {
  const [c, g] = canvas(128, 128);
  g.fillStyle = '#f4d84a';
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = 'rgba(0,0,0,0.06)';
  g.fillRect(0, 0, 128, 20);
  g.fillStyle = '#7a2d18';
  g.font = 'italic 600 22px "Comic Sans MS", "Marker Felt", cursive';
  g.textAlign = 'center';
  g.fillText(text, 64, 74);
  g.strokeStyle = '#7a2d18';
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(64, 92);
  g.lineTo(64, 116);
  g.moveTo(56, 106);
  g.lineTo(64, 116);
  g.lineTo(72, 106);
  g.stroke();
  return tex(c);
}

function microwaveTexture() {
  const [c, g] = canvas(256, 160);
  g.fillStyle = '#0a0b0d';
  g.fillRect(0, 0, 256, 160);
  const grd = g.createLinearGradient(0, 0, 190, 160);
  grd.addColorStop(0, '#22262b');
  grd.addColorStop(1, '#08090b');
  g.fillStyle = grd;
  g.fillRect(10, 12, 176, 136);
  g.fillStyle = '#16181b';
  g.fillRect(196, 12, 50, 136);
  g.fillStyle = '#5dff9a';
  g.font = 'bold 20px monospace';
  g.fillText('8:47', 200, 40);
  g.fillStyle = '#2b2f34';
  for (let i = 0; i < 6; i++) g.fillRect(202, 56 + i * 14, 38, 8);
  return tex(c);
}

function nightTexture() {
  const [c, g] = canvas(128, 256);
  const grd = g.createLinearGradient(0, 0, 0, 256);
  grd.addColorStop(0, '#0d1626');
  grd.addColorStop(1, '#1d2a3d');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 256);
  g.fillStyle = 'rgba(255,220,150,0.5)';
  g.fillRect(20, 190, 4, 4);
  g.fillRect(80, 170, 3, 3);
  g.fillRect(100, 200, 3, 3);
  return tex(c);
}

function curtainTexture() {
  const [c, g] = canvas(256, 64);
  for (let x = 0; x < 256; x++) {
    const v = Math.sin(x * 0.18) * 0.5 + 0.5;
    g.fillStyle = `rgb(${132 + v * 30},${142 + v * 30},${108 + v * 24})`;
    g.fillRect(x, 0, 1, 64);
  }
  return tex(c);
}

function bookTexture() {
  const [c, g] = canvas(64, 128);
  const cols = ['#2f4f7a', '#e9e2cf', '#7a2f2f'];
  cols.forEach((col, i) => {
    g.fillStyle = col;
    g.fillRect(0, i * 42, 64, 42);
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.fillRect(0, i * 42 + 40, 64, 2);
  });
  return tex(c);
}

// ── Materials ────────────────────────────────────────────────────────────────
function materials() {
  return {
    paint: new THREE.MeshStandardMaterial({ color: '#e4e2dc', roughness: 0.93, map: paintTexture(3, [5, 2.6]) }),
    ceiling: new THREE.MeshStandardMaterial({ color: '#eeede8', roughness: 0.96, map: paintTexture(4, [5, 5]) }),
    floor: new THREE.MeshStandardMaterial({ map: plankTexture(), roughness: 0.55, color: '#ffffff' }),
    gloss: new THREE.MeshStandardMaterial({ color: '#f6f6f2', roughness: 0.14, metalness: 0, envMapIntensity: 1.1 }),
    carcass: new THREE.MeshStandardMaterial({ color: '#d7d7d2', roughness: 0.55 }),
    kick: new THREE.MeshStandardMaterial({ color: '#8d8d89', roughness: 0.7 }),
    steel: new THREE.MeshStandardMaterial({ color: '#8d9093', metalness: 0.85, roughness: 0.36, envMapIntensity: 0.55 }),
    brushed: new THREE.MeshStandardMaterial({ color: '#7d8083', metalness: 0.85, roughness: 0.45, envMapIntensity: 0.55 }),
    blackGloss: new THREE.MeshStandardMaterial({ color: '#111214', roughness: 0.22, metalness: 0.1 }),
    blackMatte: new THREE.MeshStandardMaterial({ color: '#17181a', roughness: 0.62 }),
    granite: new THREE.MeshStandardMaterial({ map: graniteTexture(), roughness: 0.2, metalness: 0.05 }),
    marble: new THREE.MeshStandardMaterial({ map: marbleTexture(), roughness: 0.3 }),
    glass: new THREE.MeshStandardMaterial({ color: '#d9eef2', roughness: 0.04, metalness: 0.2, transparent: true, opacity: 0.2, depthWrite: false }),
    kraftLogo: new THREE.MeshStandardMaterial({ map: kraftTexture(true), roughness: 0.88 }),
    kraft: new THREE.MeshStandardMaterial({ map: kraftTexture(false), roughness: 0.88 }),
    bagInside: new THREE.MeshStandardMaterial({ color: '#7a5f40', roughness: 0.95 }),
    fridge: new THREE.MeshStandardMaterial({ color: '#232425', metalness: 0.55, roughness: 0.38 }),
    magnets: new THREE.MeshStandardMaterial({ map: magnetTexture(), metalness: 0.25, roughness: 0.45 }),
    wicker: new THREE.MeshStandardMaterial({ map: wickerTexture(), roughness: 0.9 }),
    wood: new THREE.MeshStandardMaterial({ map: woodTexture(), roughness: 0.7 }),
    cooktop: new THREE.MeshStandardMaterial({ map: cooktopTexture(), roughness: 0.12, metalness: 0.2 }),
    microwave: new THREE.MeshStandardMaterial({ map: microwaveTexture(), roughness: 0.2 }),
    jug: new THREE.MeshStandardMaterial({ color: '#9fd0ea', roughness: 0.08, transparent: true, opacity: 0.55 }),
    white: new THREE.MeshStandardMaterial({ color: '#f3f3ef', roughness: 0.4 }),
    terracotta: new THREE.MeshStandardMaterial({ color: '#3a3936', roughness: 0.7 }),
    oil: new THREE.MeshStandardMaterial({ color: '#2f4a1f', roughness: 0.1, transparent: true, opacity: 0.9 }),
    darkGlass: new THREE.MeshStandardMaterial({ color: '#1d1a19', roughness: 0.08, transparent: true, opacity: 0.85 }),
    red: new THREE.MeshStandardMaterial({ color: '#cf2e2a', roughness: 0.4 }),
    saltLabel: new THREE.MeshStandardMaterial({ color: '#f1efe9', roughness: 0.5 }),
    rose: new THREE.MeshStandardMaterial({ color: '#f6f1ea', roughness: 0.6 }),
    roseLeaf: new THREE.MeshStandardMaterial({ color: '#2f5a2a', roughness: 0.6 }),
    frameBlack: new THREE.MeshStandardMaterial({ color: '#141414', roughness: 0.5 }),
    frameGold: new THREE.MeshStandardMaterial({ color: '#b8923f', metalness: 0.8, roughness: 0.35 }),
    night: new THREE.MeshStandardMaterial({ map: nightTexture(), roughness: 0.05, metalness: 0.3 }),
    curtain: new THREE.MeshStandardMaterial({ map: curtainTexture(), roughness: 0.95, side: THREE.DoubleSide }),
    books: new THREE.MeshStandardMaterial({ map: bookTexture(), roughness: 0.8 }),
    led: new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#fffaf0', emissiveIntensity: 2.4, roughness: 0.3 }),
    ledRim: new THREE.MeshStandardMaterial({ color: '#e6e6e2', roughness: 0.5 }),
    plate: new THREE.MeshStandardMaterial({ color: '#f4f4f0', roughness: 0.6 }),
    cord: new THREE.MeshStandardMaterial({ color: '#141414', roughness: 0.6 }),
    leafDark: new THREE.MeshStandardMaterial({ color: '#2d6a2a', roughness: 0.55, side: THREE.DoubleSide }),
  };
}

// ── Building helpers ─────────────────────────────────────────────────────────
function rbox(min, max, mat, radius = 0.006, seg = 2) {
  const w = max[0] - min[0];
  const h = max[1] - min[1];
  const d = max[2] - min[2];
  const r = Math.min(radius, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4);
  const geo = r > 0.0005 ? new RoundedBoxGeometry(w, h, d, seg, r) : new THREE.BoxGeometry(w, h, d);
  const m = new THREE.Mesh(geo, mat);
  m.position.set((min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2);
  return m;
}

function plane(w, h, mat) {
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
}

/** Cupboard doors across one face of a box. face: '+z' etc. */
function doors(group, M, min, max, face, count, { y0, y1, handle = 'v', gap = 0.004 } = {}) {
  const axis = face[1] === 'x' ? 0 : 2;
  const sign = face[0] === '+' ? 1 : -1;
  const along = axis === 0 ? 2 : 0;
  const lo = min[along];
  const hi = max[along];
  const span = (hi - lo) / count;
  const plane0 = sign > 0 ? max[axis] : min[axis];
  const ya = y0 ?? min[1];
  const yb = y1 ?? max[1];
  for (let i = 0; i < count; i++) {
    const a = lo + i * span + gap;
    const b = lo + (i + 1) * span - gap;
    const dmin = [0, ya + gap, 0];
    const dmax = [0, yb - gap, 0];
    dmin[along] = a;
    dmax[along] = b;
    dmin[axis] = sign > 0 ? plane0 - 0.018 : plane0;
    dmax[axis] = sign > 0 ? plane0 : plane0 + 0.018;
    const door = rbox(dmin, dmax, M.gloss, 0.004);
    door.castShadow = false;
    door.receiveShadow = true;
    group.add(door);
    // Bar handle on the side nearest the middle of a pair.
    const left = i % 2 === 0;
    const hx = left ? b - 0.035 : a + 0.035;
    const hmin = [0, 0, 0];
    const hmax = [0, 0, 0];
    hmin[along] = hx - 0.006;
    hmax[along] = hx + 0.006;
    hmin[axis] = sign > 0 ? plane0 : plane0 - 0.022;
    hmax[axis] = sign > 0 ? plane0 + 0.022 : plane0;
    if (handle === 'v') {
      const top = yb - gap > 1.4 ? ya + 0.06 : yb - 0.05;
      hmin[1] = top - 0.16;
      hmax[1] = top;
      if (yb > 1.4) {
        hmin[1] = ya + 0.04;
        hmax[1] = ya + 0.2;
      }
    } else {
      hmin[1] = yb - 0.06;
      hmax[1] = yb - 0.048;
      hmin[along] = (a + b) / 2 - 0.08;
      hmax[along] = (a + b) / 2 + 0.08;
    }
    const h = rbox(hmin, hmax, M.steel, 0.005);
    group.add(h);
  }
}

function carcassWithTop(group, M, b, { doorsFace, doorCount, granite = true, toe = 0.1 }) {
  const [x0, y0, z0] = b.min;
  const [x1, y1, z1] = b.max;
  const topT = granite ? 0.035 : 0;
  const body = rbox([x0, y0 + toe, z0], [x1, y1 - topT, z1 - (doorsFace === '+z' ? 0.018 : 0)], M.carcass, 0.002);
  body.receiveShadow = true;
  body.castShadow = true;
  group.add(body);
  if (toe > 0) {
    const kmin = [x0 + 0.01, 0, z0 + 0.01];
    const kmax = [x1 - 0.01, toe, z1 - 0.05];
    if (doorsFace === '-z') {
      kmin[2] = z0 + 0.05;
      kmax[2] = z1 - 0.01;
    }
    group.add(rbox(kmin, kmax, M.kick, 0.002));
  }
  if (granite) {
    const top = rbox([x0 - 0.008, y1 - topT, z0 - (z0 > 0 ? 0.008 : 0)], [x1 + 0.008, y1, z1 + 0.008], M.granite, 0.004);
    top.receiveShadow = true;
    top.castShadow = true;
    group.add(top);
  }
  if (doorsFace) doors(group, M, [x0, y0, z0], [x1, y1, z1], doorsFace, doorCount, { y0: y0 + toe, y1: y1 - topT - 0.01 });
}

function cylinderIn(min, max, mat, segs = 24) {
  const w = max[0] - min[0];
  const h = max[1] - min[1];
  const d = max[2] - min[2];
  const r = Math.min(w, d) / 2;
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, segs), mat);
  m.position.set((min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2);
  return m;
}

// ── The kitchen ──────────────────────────────────────────────────────────────
export function buildKitchen(scene) {
  const M = materials();
  const g = new THREE.Group();
  g.name = 'kitchen';
  const box = Object.fromEntries(BOXES.map((b) => [b.id, b]));

  // Room shell
  const floor = plane(W, D, M.floor);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(W / 2, 0, D / 2);
  floor.receiveShadow = true;
  g.add(floor);
  const ceil = plane(W, D, M.ceiling);
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(W / 2, H, D / 2);
  ceil.receiveShadow = true;
  g.add(ceil);
  const back = plane(W, H, M.paint);
  back.position.set(W / 2, H / 2, 0);
  back.receiveShadow = true;
  g.add(back);
  const front = plane(W, H, M.paint);
  front.rotation.y = Math.PI;
  front.position.set(W / 2, H / 2, D);
  front.receiveShadow = true;
  g.add(front);
  const left = plane(D, H, M.paint);
  left.rotation.y = Math.PI / 2;
  left.position.set(0, H / 2, D / 2);
  left.receiveShadow = true;
  g.add(left);
  const right = plane(D, H, M.paint);
  right.rotation.y = -Math.PI / 2;
  right.position.set(W, H / 2, D / 2);
  right.receiveShadow = true;
  g.add(right);

  // Cornice — a small cove at every wall/ceiling join.
  const cove = new THREE.MeshStandardMaterial({ color: '#f1f0ec', roughness: 0.9 });
  for (const [x0, z0, x1, z1] of [[0, 0, W, 0.03], [0, D - 0.03, W, D], [0, 0, 0.03, D], [W - 0.03, 0, W, D]]) {
    g.add(rbox([x0, H - 0.03, z0], [x1, H, z1], cove, 0.0));
  }
  // Skirting
  const skirt = new THREE.MeshStandardMaterial({ color: '#efeeea', roughness: 0.6 });
  for (const [x0, z0, x1, z1] of [[0, D - 0.01, W, D], [0, 0, 0.01, D], [W - 0.01, 0, W, D]]) {
    g.add(rbox([x0, 0, z0], [x1, 0.07, z1], skirt, 0));
  }

  // Splashback: grey marble tiles between the bench and the cupboards.
  const splash = plane(2.6, 0.58, M.marble);
  splash.position.set(2.6, 0.92 + 0.29, 0.002);
  splash.receiveShadow = true;
  g.add(splash);

  // ── Back run ──
  const pillar = rbox(box.pillar.min, box.pillar.max, M.paint, 0.004);
  pillar.castShadow = pillar.receiveShadow = true;
  g.add(pillar);

  carcassWithTop(g, M, box.bench, { doorsFace: '+z', doorCount: 5 });
  const cook = plane(0.58, 0.44, M.cooktop);
  cook.rotation.x = -Math.PI / 2;
  cook.position.set(1.66, 0.9215, 0.3);
  g.add(cook);
  // Oven front under the cooktop
  const oven = rbox([1.36, 0.18, 0.6], [1.95, 0.8, 0.621], M.blackGloss, 0.006);
  g.add(oven);
  g.add(rbox([1.4, 0.72, 0.62], [1.91, 0.735, 0.645], M.steel, 0.004));

  // Rangehood: stainless chimney + a glass wing.
  const hood = rbox(box.hood.min, box.hood.max, M.steel, 0.004);
  hood.castShadow = true;
  g.add(hood);
  const wing = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.012, 0.5), M.glass);
  wing.position.set(1.65, 1.6, 0.26);
  wing.rotation.x = 0.12;
  g.add(wing);
  g.add(rbox([1.2, 1.585, 0.48], [2.1, 1.6, 0.51], M.steel, 0.003));
  g.add(rbox([1.47, 1.58, 0.0], [1.83, 1.62, 0.3], M.brushed, 0.004));

  // Overhead cupboards
  const oh = box.overheads;
  g.add(rbox([oh.min[0], oh.min[1], 0], [oh.max[0], oh.max[1], oh.max[2] - 0.018], M.carcass, 0.002));
  doors(g, M, oh.min, oh.max, '+z', 4, { y0: oh.min[1], y1: oh.max[1] });

  // Fridge in its white surround, cupboard above.

  g.add(rbox([3.9, 0, 0], [3.95, 2.22, 0.68], M.gloss, 0.003));
  g.add(rbox([4.75, 0, 0], [4.8, 2.22, 0.68], M.gloss, 0.003));
  g.add(rbox([3.95, 1.86, 0], [4.75, 2.22, 0.66], M.carcass, 0.002));
  doors(g, M, [3.95, 1.86, 0], [4.75, 2.22, 0.68], '+z', 2, { y0: 1.86, y1: 2.22, handle: 'h' });
  const fridgeBody = rbox([3.96, 0.01, 0], [4.74, 1.85, 0.64], M.fridge, 0.01);
  fridgeBody.castShadow = true;
  g.add(fridgeBody);
  const upper = rbox([3.96, 1.12, 0.6], [4.74, 1.85, 0.675], M.fridge, 0.012);
  const lower = rbox([3.96, 0.03, 0.6], [4.74, 1.1, 0.675], M.fridge, 0.012);
  g.add(upper, lower);
  const magU = plane(0.74, 0.69, M.magnets);
  magU.position.set(4.35, 1.485, 0.6765);
  g.add(magU);
  const magL = plane(0.74, 1.0, M.magnets);
  magL.material = M.magnets.clone();
  magL.material.map = M.magnets.map.clone();
  magL.material.map.repeat.set(1, 0.5);
  magL.material.map.offset.set(0, 0.0);
  magL.position.set(4.35, 0.6, 0.6765);
  g.add(magL);
  g.add(rbox([4.66, 1.2, 0.676], [4.69, 1.7, 0.7], M.blackMatte, 0.008));
  g.add(rbox([4.66, 0.5, 0.676], [4.69, 1.0, 0.7], M.blackMatte, 0.008));
  const bk = box.basket;
  const basket = rbox(bk.min, bk.max, M.wicker, 0.02);
  basket.castShadow = true;
  g.add(basket);

  // Appliances on the back bench
  const jb = box.jug;
  g.add(rbox(jb.min, [jb.max[0], jb.max[1] - 0.04, jb.max[2]], M.jug, 0.02));
  g.add(rbox([jb.min[0], jb.max[1] - 0.04, jb.min[2]], jb.max, M.white, 0.02));
  const tb = box.toaster;
  g.add(rbox(tb.min, tb.max, M.blackGloss, 0.03));
  g.add(rbox([2.34, 1.119, 0.06], [2.56, 1.121, 0.09], M.blackMatte, 0));
  g.add(rbox([2.34, 1.119, 0.15], [2.56, 1.121, 0.18], M.blackMatte, 0));
  const cb = box.coffee;
  g.add(rbox(cb.min, [cb.max[0], 1.22, cb.max[2]], M.brushed, 0.02));
  g.add(rbox([2.79, 1.22, 0.02], [3.06, 1.34, 0.26], M.darkGlass, 0.02)); // bean hopper
  g.add(rbox([2.79, 0.94, 0.3], [3.06, 1.0, 0.4], M.blackMatte, 0.01)); // drip tray
  g.add(rbox([2.86, 1.05, 0.36], [2.98, 1.1, 0.4], M.blackMatte, 0.01)); // group handle
  const gb = box.grinder;
  g.add(rbox(gb.min, [gb.max[0], 1.18, gb.max[2]], M.blackGloss, 0.02));
  g.add(rbox([gb.min[0] + 0.01, 1.18, gb.min[2] + 0.02], [gb.max[0] - 0.01, gb.max[1], gb.max[2] - 0.02], M.darkGlass, 0.02));
  const mb = box.microwave;
  const micro = rbox(mb.min, mb.max, M.blackGloss, 0.012);
  micro.castShadow = true;
  g.add(micro);
  const mFace = plane(0.5, 0.29, M.microwave);
  mFace.position.set((mb.min[0] + mb.max[0]) / 2, (mb.min[1] + mb.max[1]) / 2, mb.max[2] + 0.001);
  g.add(mFace);

  // On top of the overheads
  const bd = box.board;
  const board = rbox(bd.min, bd.max, M.wood, 0.01);
  board.rotation.x = 0;
  g.add(board);
  const ob = box.oil;
  g.add(cylinderIn(ob.min, [ob.max[0], 2.38, ob.max[2]], M.oil));
  g.add(cylinderIn([ob.min[0] + 0.035, 2.38, ob.min[2] + 0.035], [ob.max[0] - 0.035, ob.max[1], ob.max[2] - 0.035], M.oil, 12));
  const vb = box.vase;
  g.add(cylinderIn(vb.min, vb.max, M.glass));
  const roseGroup = new THREE.Group();
  const rr = rng(5);
  for (let i = 0; i < 9; i++) {
    const rose = new THREE.Mesh(new THREE.IcosahedronGeometry(0.035 + rr() * 0.012, 1), M.rose);
    rose.position.set(2.72 + (rr() - 0.5) * 0.2, 2.44 + rr() * 0.1, 0.1 + (rr() - 0.5) * 0.16);
    rose.scale.y = 0.8;
    roseGroup.add(rose);
  }
  for (let i = 0; i < 10; i++) {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 4), M.roseLeaf);
    leaf.scale.set(1.6, 0.4, 0.9);
    leaf.position.set(2.72 + (rr() - 0.5) * 0.24, 2.4 + rr() * 0.08, 0.1 + (rr() - 0.5) * 0.18);
    leaf.rotation.z = rr() * 3;
    roseGroup.add(leaf);
  }
  g.add(roseGroup);
  const fb = box.figurine;
  const fig = new THREE.Group();
  const body = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.18, 16), M.blackGloss);
  body.position.set((fb.min[0] + fb.max[0]) / 2, 2.22 + 0.09, 0.07);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.035, 16, 12), M.blackGloss);
  head.position.set(body.position.x, 2.41, 0.07);
  fig.add(body, head);
  g.add(fig);
  const bb = box.books;
  g.add(rbox(bb.min, bb.max, M.books, 0.004));
  const ib = box.ivypot;
  g.add(cylinderIn(ib.min, ib.max, M.white));

  // ── Island ──
  carcassWithTop(g, M, box.island, { doorsFace: '+z', doorCount: 4 });
  // Bags: kraft walls, a darker inside with the shopping showing.
  for (const id of ['bag1', 'bag2', 'bag3', 'floorbag1', 'floorbag2']) {
    const b = box[id];
    const walls = rbox(b.min, b.max, [M.kraft, M.kraft, M.bagInside, M.kraft, M.kraftLogo, M.kraftLogo], 0.006);
    walls.castShadow = true;
    walls.receiveShadow = true;
    g.add(walls);
    // a carton and a leek poking out of the top
    const cx = b.min[0] + (b.max[0] - b.min[0]) * 0.35;
    const cz = (b.min[2] + b.max[2]) / 2;
    const carton = rbox([cx - 0.05, b.max[1] - 0.01, cz - 0.04], [cx + 0.05, b.max[1] + 0.012, cz + 0.04], M.white, 0.004);
    g.add(carton);
  }
  const sb = box.salt;
  g.add(cylinderIn(sb.min, [sb.max[0], sb.max[1] - 0.03, sb.max[2]], M.saltLabel));
  g.add(cylinderIn([sb.min[0], sb.max[1] - 0.03, sb.min[2]], sb.max, M.red));
  const gl = box.glass;
  g.add(cylinderIn(gl.min, gl.max, M.darkGlass, 18));
  // Whiteboard marker lying on the bench (too small to climb).
  const marker = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.13, 10), M.blackMatte);
  marker.rotation.z = Math.PI / 2;
  marker.rotation.y = 0.4;
  marker.position.set(1.55, 0.931, 2.62);
  g.add(marker);

  // ── End bench ──
  carcassWithTop(g, M, box.peninsula, { doorsFace: '+z', doorCount: 2 });
  const ab = box.airfryer;
  const fryer = rbox(ab.min, ab.max, M.blackMatte, 0.05, 3);
  fryer.castShadow = true;
  g.add(fryer);
  g.add(rbox([3.56, 1.0, ab.max[2] - 0.01], [3.78, 1.06, ab.max[2] + 0.015], M.blackGloss, 0.01));
  const stickyA = plane(0.075, 0.075, new THREE.MeshStandardMaterial({ map: stickyTexture('Recycling'), roughness: 0.9 }));
  stickyA.position.set(3.62, 0.36, 2.7501);
  const stickyB = plane(0.075, 0.075, new THREE.MeshStandardMaterial({ map: stickyTexture('Rubbish'), roughness: 0.9 }));
  stickyB.position.set(4.12, 0.33, 2.7501);
  g.add(stickyA, stickyB);
  // Power point with the air fryer's cord hanging out of it
  g.add(rbox([4.18, 0.74, 2.75], [4.3, 0.81, 2.758], M.plate, 0.004));
  const cordCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(4.21, 0.775, 2.76),
    new THREE.Vector3(4.2, 0.62, 2.775),
    new THREE.Vector3(4.24, 0.48, 2.77),
    new THREE.Vector3(4.3, 0.56, 2.765),
    new THREE.Vector3(4.27, 0.7, 2.758),
  ]);
  g.add(new THREE.Mesh(new THREE.TubeGeometry(cordCurve, 30, 0.005, 6), M.cord));

  // ── Plant in the corner (umbrella tree) ──
  const pb = box.plant;
  g.add(cylinderIn(pb.min, pb.max, M.terracotta, 20));
  const umbrella = new THREE.Group();
  const ur = rng(9);
  const stemMat = new THREE.MeshStandardMaterial({ color: '#5b4a30', roughness: 0.8 });
  const centre = new THREE.Vector3((pb.min[0] + pb.max[0]) / 2, pb.max[1], (pb.min[2] + pb.max[2]) / 2);
  for (let i = 0; i < 7; i++) {
    const top = centre.clone().add(new THREE.Vector3((ur() - 0.5) * 0.5, 0.45 + ur() * 0.7, (ur() - 0.2) * 0.45));
    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.008, top.distanceTo(centre), 6), stemMat);
    stalk.position.copy(centre).lerp(top, 0.5);
    stalk.lookAt(top);
    stalk.rotateX(Math.PI / 2);
    umbrella.add(stalk);
    for (let l = 0; l < 7; l++) {
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 4), M.leafDark);
      leaf.scale.set(1.5, 0.08, 0.5);
      const a = (l / 7) * Math.PI * 2;
      leaf.position.copy(top).add(new THREE.Vector3(Math.cos(a) * 0.07, (ur() - 0.5) * 0.02, Math.sin(a) * 0.07));
      leaf.rotation.y = -a;
      leaf.rotation.z = -0.25;
      umbrella.add(leaf);
    }
  }
  g.add(umbrella);

  // ── Walls: photos, window, door ──
  const bigFrame = rbox([0, 1.52, 1.25], [0.022, 1.86, 1.95], M.frameBlack, 0.003);
  g.add(bigFrame);
  const photos = plane(0.66, 0.3, new THREE.MeshStandardMaterial({ map: photoFrameTexture(3, 3), roughness: 0.4 }));
  photos.rotation.y = Math.PI / 2;
  photos.position.set(0.0235, 1.69, 1.6);
  g.add(photos);
  g.add(rbox([0, 1.02, 2.15], [0.02, 1.24, 2.33], M.frameGold, 0.003));
  const small = plane(0.14, 0.18, new THREE.MeshStandardMaterial({ map: photoFrameTexture(1, 8), roughness: 0.4 }));
  small.rotation.y = Math.PI / 2;
  small.position.set(0.0215, 1.13, 2.24);
  g.add(small);

  const win = plane(1.0, 1.2, M.night);
  win.rotation.y = -Math.PI / 2;
  win.position.set(W - 0.004, 1.6, 1.65);
  g.add(win);
  for (const [z0, z1, y0, y1] of [[1.13, 2.17, 2.19, 2.23], [1.13, 2.17, 0.97, 1.01], [1.13, 1.17, 0.97, 2.23], [2.13, 2.17, 0.97, 2.23], [1.63, 1.67, 0.97, 2.23]]) {
    g.add(rbox([W - 0.02, y0, z0], [W, y1, z1], M.white, 0.002));
  }
  const curtain = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 1.38, 12, 1), M.curtain);
  const cp = curtain.geometry.attributes.position;
  for (let i = 0; i < cp.count; i++) cp.setZ(i, Math.sin(cp.getX(i) * 40) * 0.012);
  curtain.geometry.computeVertexNormals();
  curtain.rotation.y = -Math.PI / 2;
  curtain.position.set(W - 0.03, 1.55, 2.36);
  g.add(curtain);

  const door = rbox([0.9, 0, D - 0.025], [1.76, 2.04, D], M.white, 0.004);
  g.add(door);
  g.add(rbox([1.62, 0.98, D - 0.05], [1.7, 1.0, D - 0.025], M.steel, 0.005));
  g.add(rbox([1.86, 1.25, D - 0.008], [1.94, 1.33, D], M.plate, 0.003)); // light switch

  // ── Ceiling: the round LED and the roof hatch next to it ──
  const led = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.215, 0.022, 48), M.ledRim);
  led.position.set(2.95, H - 0.011, 1.65);
  g.add(led);
  const ledFace = new THREE.Mesh(new THREE.CircleGeometry(0.19, 48), M.led);
  ledFace.rotation.x = Math.PI / 2;
  ledFace.position.set(2.95, H - 0.0225, 1.65);
  g.add(ledFace);
  const hatchMat = new THREE.MeshStandardMaterial({ color: '#e4e3df', roughness: 0.9 });
  const hatch = plane(0.56, 0.56, hatchMat);
  hatch.rotation.x = Math.PI / 2;
  hatch.position.set(2.3, H - 0.002, 1.05);
  g.add(hatch);
  for (const [x0, z0, x1, z1] of [[2.02, 0.77, 2.58, 0.785], [2.02, 1.315, 2.58, 1.33], [2.02, 0.77, 2.035, 1.33], [2.565, 0.77, 2.58, 1.33]]) {
    g.add(rbox([x0, H - 0.006, z0], [x1, H, z1], M.ledRim, 0));
  }

  g.traverse((o) => {
    if (o.isMesh && o.receiveShadow === false) o.receiveShadow = true;
  });
  scene.add(g);

  // ── Light ──
  const hemi = new THREE.HemisphereLight('#fffdf8', '#9a8a72', 0.5);
  scene.add(hemi);
  const spot = new THREE.SpotLight('#fff1dd', 26, 9, 1.32, 0.8, 1.5);
  spot.position.set(2.95, H - 0.05, 1.65);
  spot.target.position.set(2.75, 0, 1.75);
  spot.castShadow = true;
  spot.shadow.mapSize.set(1024, 1024);
  spot.shadow.bias = -0.0004;
  spot.shadow.normalBias = 0.02;
  spot.shadow.camera.near = 0.2;
  spot.shadow.camera.far = 6;
  scene.add(spot, spot.target);
  // A soft fill from the window wall so the back corners aren't black.
  const fill = new THREE.PointLight('#dfe8ff', 1.2, 7, 1.6);
  fill.position.set(4.6, 1.8, 3.4);
  scene.add(fill);

  return { group: g, spot, led: new THREE.Vector3(2.95, H - 0.03, 1.65) };
}

/** The photo: standing at the island, phone held low and tilted up at the
 *  ceiling light and the cupboards. */
export const PHOTO_VIEW = {
  pos: new THREE.Vector3(2.55, 1.12, 3.95),
  look: new THREE.Vector3(2.78, 1.86, 0.35),
};
