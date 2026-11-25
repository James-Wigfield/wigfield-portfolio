/* Dream Rooms · live text in the place (decision 8: his words live in the place,
   never as subtitles). Every piece of text is a canvas texture on a plane, fogged
   like everything else, a few millimetres proud of its surface:

     const t = new TextPlane({ w, h, style })    style: ink | ink-pale | number | sign | stencil
     t.paint(text | lines, opts)                  repaint (cheap; only ever while unseen, or at build)
     t.clear()                                    blank
     t.tint(hex | null)                           a swap's retint (null = its own ink)
     t.place(centre, normal, up)                  world placement
     t.dispose()

   The lettering is drawn as a coverage mask (white on black) used as the material's
   alphaMap, with the ink as the material colour. A canvas's transparent pixels are
   black, so a plain colour map gives every glyph a dark fringe once it's filtered;
   a mask has none at any distance. Only the grey box's enamel sign card, which has
   colour of its own, is a colour map. Nothing here logs text (decision 14). */

import * as THREE from 'three';

const SERIF = 'Georgia, "Iowan Old Style", "Palatino Linotype", "Times New Roman", serif';
const STENCIL = '"Arial Narrow", "Helvetica Neue", Arial, sans-serif';

const STYLES = {
  // his words on a wall, a board, the floor: a quiet, slightly uneven serif ink
  ink: { font: 'italic', family: SERIF, ink: '#281f18', alpha: 0.84, maxLines: 3, jitter: true },
  'ink-pale': { font: 'italic', family: SERIF, ink: '#e8e2d2', alpha: 0.72, maxLines: 3, jitter: true },
  // a dream door's number plate
  number: { font: '', family: SERIF, ink: '#1e1814', alpha: 0.9, maxLines: 1 },
};
const PLAQUE_INK = '#e0d2b4'; // worn cream lettering on the kit's dark, brass-rimmed plaque
const STENCIL_INK = '#c29a58'; // brass, set into the floor of the bay (fresh-review fix)

const grey = (a) => {
  const v = Math.round(255 * Math.max(0, Math.min(1, a)));
  return `rgb(${v}, ${v}, ${v})`;
};

let measureCtx = null;
function ctx2d() {
  if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d');
  return measureCtx;
}

/** Wrap text into at most n lines that fit maxW at the given font. */
function wrap(text, font, maxW, n) {
  const g = ctx2d();
  g.font = font;
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (g.measureText(next).width <= maxW || !cur) cur = next;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  if (lines.length > n) return null;
  return lines;
}

export class TextPlane {
  constructor({ w, h, style = 'ink', pxPerM = 260, maxPx = 1024, renderOrder = 2 }) {
    this.w = w;
    this.h = h;
    this.style = style;
    const cw = Math.max(64, Math.min(maxPx, Math.round(w * pxPerM)));
    const ch = Math.max(32, Math.round((cw * h) / w));
    this.canvas = document.createElement('canvas');
    this.canvas.width = cw;
    this.canvas.height = ch;
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.anisotropy = 4;
    this.tex.generateMipmaps = true;
    this.tex.minFilter = THREE.LinearMipmapLinearFilter;
    this.material = new THREE.MeshBasicMaterial({
      transparent: true,
      depthWrite: false,
      fog: true,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    this.geometry = new THREE.PlaneGeometry(w, h);
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.renderOrder = renderOrder;
    this.mesh.userData.noCollide = true;
    this.mode = null;
    this.ink = '#ffffff';
    this.tinted = null;
    this.painted = false;
    this.text = null;
    this.setMode('mask', STYLES[style]?.ink || '#ffffff');
    this.blank();
  }

  setMode(mode, ink) {
    this.ink = ink || this.ink;
    if (mode !== this.mode) {
      this.mode = mode;
      if (mode === 'mask') {
        this.material.map = null;
        this.material.alphaMap = this.tex;
        this.tex.colorSpace = THREE.NoColorSpace;
      } else {
        this.material.alphaMap = null;
        this.material.map = this.tex;
        this.tex.colorSpace = THREE.SRGBColorSpace;
      }
      this.material.needsUpdate = true;
    }
    this.material.color.set(this.mode === 'mask' ? this.tinted || this.ink : this.tinted || '#ffffff');
  }

  tint(hex) {
    this.tinted = hex || null;
    this.material.color.set(this.mode === 'mask' ? this.tinted || this.ink : this.tinted || '#ffffff');
  }

  place(centre, normal, up = [0, 1, 0], off = 0.004) {
    const n = new THREE.Vector3(...normal).normalize();
    const u = new THREE.Vector3(...up).normalize();
    const r = new THREE.Vector3().crossVectors(u, n).normalize();
    const uu = new THREE.Vector3().crossVectors(n, r).normalize();
    this.mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(r, uu, n));
    this.mesh.position.set(centre[0] + n.x * off, centre[1] + n.y * off, centre[2] + n.z * off);
    return this;
  }

  blank() {
    const g = this.canvas.getContext('2d');
    g.fillStyle = '#000';
    g.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.tex.needsUpdate = true;
  }

  clear() {
    this.setMode('mask');
    this.blank();
    this.painted = false;
    this.text = null;
  }

  paint(content, opts = {}) {
    const style = opts.style || this.style;
    const g = this.canvas.getContext('2d');
    const W = this.canvas.width;
    const H = this.canvas.height;
    const lines = Array.isArray(content) ? content : [String(content)];
    if (style === 'sign' && opts.plate !== false) {
      // the grey box's enamel card: real colour, so a colour map
      this.setMode('color');
      g.clearRect(0, 0, W, H);
      drawSignCard(g, W, H, lines, opts);
    } else {
      g.fillStyle = '#000';
      g.fillRect(0, 0, W, H);
      if (style === 'sign') {
        this.setMode('mask', PLAQUE_INK);
        drawPlaqueMask(g, W, H, lines, opts);
      } else if (style === 'stencil') {
        this.setMode('mask', STENCIL_INK);
        drawStencilMask(g, W, H, String(content));
      } else {
        const st = STYLES[style] || STYLES.ink;
        this.setMode('mask', st.ink);
        drawInkMask(g, W, H, String(content), st);
      }
    }
    this.tex.needsUpdate = true;
    this.painted = true;
    this.text = content;
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
    this.tex.dispose();
  }
}

/** Fit a line or a few into the box at the largest size that works, then ink them (as coverage). */
function drawInkMask(g, W, H, text, st) {
  const pad = Math.round(Math.min(W, H) * 0.08);
  let size = Math.floor(H * 0.62);
  let lines = null;
  for (; size >= 10; size -= Math.max(1, Math.round(size * 0.06))) {
    const font = `${st.font} ${size}px ${st.family}`.trim();
    lines = wrap(text, font, W - pad * 2, st.maxLines);
    if (lines && lines.length * size * 1.18 <= H - pad) break;
  }
  if (!lines) lines = [text];
  g.font = `${st.font} ${size}px ${st.family}`.trim();
  g.textBaseline = 'middle';
  g.textAlign = 'center';
  g.fillStyle = grey(st.alpha);
  const lh = size * 1.18;
  const top = H / 2 - ((lines.length - 1) * lh) / 2;
  lines.forEach((line, i) => {
    if (st.jitter) {
      // a hand that isn't quite steady: each line a hair off level and off centre
      g.save();
      g.translate(W / 2 + (i % 2 ? 1 : -1) * size * 0.06, top + i * lh);
      g.rotate((i % 2 ? 1 : -1) * 0.006);
      g.fillText(line, 0, 0, W - pad * 2);
      g.restore();
    } else g.fillText(line, W / 2, top + i * lh, W - pad * 2);
  });
}

const signLayout = (n) => ({
  sizes: n >= 3 ? [0.24, 0.19, 0.12] : n === 2 ? [0.27, 0.21] : [0.22],
  ys: n >= 3 ? [0.27, 0.56, 0.8] : n === 2 ? [0.35, 0.68] : [0.5],
});

function fitLine(g, line, size, W, pad, font) {
  let s = size;
  g.font = font(s);
  while (s > 8 && g.measureText(line).width > W - pad * 2) {
    s -= 1;
    g.font = font(s);
  }
  return s;
}

/** A door sign lettered onto the kit's own plaque: date and number, then the title / first words / "not yet". */
function drawPlaqueMask(g, W, H, arr, { dim = false } = {}) {
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const pad = W * 0.08;
  const { sizes, ys } = signLayout(arr.length);
  const a = dim ? 0.42 : 0.88;
  arr.slice(0, 3).forEach((line, i) => {
    const font = (sz) => (i === 1 ? `italic ${sz}px ${SERIF}` : `${sz}px ${SERIF}`);
    const text = i === 2 ? line.toUpperCase().split('').join(' ') : line;
    fitLine(g, text, Math.round(H * sizes[i]), W, pad, font);
    g.fillStyle = grey(i === 2 ? a * 0.62 : a);
    g.fillText(text, W / 2, H * ys[i], W - pad * 2);
  });
}

/** The grey box's sign: an old enamel card, soft at the edges, with dark lettering. */
function drawSignCard(g, W, H, arr, { dim = false, wrong = false } = {}) {
  const grd = g.createRadialGradient(W / 2, H / 2, H * 0.1, W / 2, H / 2, W * 0.62);
  grd.addColorStop(0, dim ? 'rgba(150, 140, 124, 0.6)' : 'rgb(196, 184, 162)');
  grd.addColorStop(1, dim ? 'rgba(110, 102, 90, 0.5)' : 'rgb(160, 148, 128)');
  g.fillStyle = grd;
  g.fillRect(0, 0, W, H);
  g.strokeStyle = 'rgba(60, 48, 38, 0.35)';
  g.lineWidth = Math.max(1, H * 0.012);
  g.strokeRect(H * 0.05, H * 0.05, W - H * 0.1, H - H * 0.1);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const pad = W * 0.07;
  const { sizes, ys } = signLayout(arr.length);
  arr.slice(0, 3).forEach((line, i) => {
    const font = (s) => (i === 1 ? `italic ${s}px ${SERIF}` : `${s}px ${SERIF}`);
    const text = i === 2 ? line.toUpperCase().split('').join(' ') : line;
    fitLine(g, text, Math.round(H * sizes[i]), W, pad, font);
    g.fillStyle = i === 2 ? 'rgba(34, 26, 20, 0.62)' : i === 0 && wrong ? 'rgba(52, 30, 22, 0.92)' : 'rgba(34, 26, 20, 0.9)';
    g.fillText(text, W / 2, H * ys[i], W - pad * 2);
  });
}

/** A date sprayed through a stencil on a blank wall: uppercase, spaced, with the stencil's bridges. */
function drawStencilMask(g, W, H, text) {
  const t = text.toUpperCase();
  let size = Math.round(H * 0.62);
  const spacing = () => size * 0.16;
  const widthOf = () => {
    g.font = `bold ${size}px ${STENCIL}`;
    let w = 0;
    for (const ch of t) w += g.measureText(ch).width + spacing();
    return w - spacing();
  };
  while (size > 10 && widthOf() > W * 0.9) size -= 1;
  // a little overspray mist round it
  const mist = g.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * 0.5);
  mist.addColorStop(0, grey(0.06));
  mist.addColorStop(1, grey(0));
  g.fillStyle = mist;
  g.fillRect(0, 0, W, H);
  g.font = `bold ${size}px ${STENCIL}`;
  g.textBaseline = 'middle';
  g.textAlign = 'left';
  // the paint, slightly soft like overspray
  g.save();
  g.filter = 'blur(0.8px)';
  g.fillStyle = grey(0.72);
  let x = (W - widthOf()) / 2;
  for (const ch of t) {
    g.fillText(ch, x, H / 2);
    x += g.measureText(ch).width + spacing();
  }
  g.restore();
  // the bridges: thin vertical cuts through each letter
  g.fillStyle = '#000';
  x = (W - widthOf()) / 2;
  g.font = `bold ${size}px ${STENCIL}`;
  for (const ch of t) {
    const cw = g.measureText(ch).width;
    if (ch.trim()) g.fillRect(x + cw * 0.47, H / 2 - size * 0.55, Math.max(1.5, size * 0.045), size * 1.1);
    x += cw + spacing();
  }
}

/* ── figure billboards (absences, never people) ─────────────────────────── */

/** A soft, blurred, dark human-ish shape (or a coat, on a hook or a chair). Drawn once per figure. */
export function silhouetteTexture(kind = 'silhouette') {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 512;
  const g = c.getContext('2d');
  g.filter = kind === 'silhouette' ? 'blur(15px)' : 'blur(9px)';
  g.fillStyle = 'rgba(14, 12, 11, 0.92)';
  if (kind === 'silhouette') {
    // head
    g.beginPath();
    g.ellipse(128, 92, 30, 38, 0, 0, Math.PI * 2);
    g.fill();
    // shoulders and a long coat-like body, fading at the feet
    const body = g.createLinearGradient(0, 130, 0, 500);
    body.addColorStop(0, 'rgba(14, 12, 11, 0.92)');
    body.addColorStop(0.75, 'rgba(14, 12, 11, 0.8)');
    body.addColorStop(1, 'rgba(14, 12, 11, 0)');
    g.fillStyle = body;
    g.beginPath();
    g.moveTo(112, 128);
    g.quadraticCurveTo(62, 140, 58, 200);
    g.lineTo(72, 330);
    g.lineTo(80, 500);
    g.lineTo(176, 500);
    g.lineTo(184, 330);
    g.lineTo(198, 200);
    g.quadraticCurveTo(194, 140, 144, 128);
    g.closePath();
    g.fill();
  } else {
    // a coat hanging (or draped on a chair): a hook, shoulders, folds, nothing inside
    const chair = kind === 'chair-coat';
    if (chair) {
      g.fillStyle = 'rgba(30, 24, 20, 0.85)';
      g.fillRect(70, 300, 10, 200);
      g.fillRect(176, 300, 10, 200);
      g.fillRect(64, 290, 128, 14);
      g.fillRect(70, 120, 10, 190);
      g.fillRect(176, 120, 10, 190);
      g.fillRect(64, 116, 128, 16);
    }
    const coat = g.createLinearGradient(0, chair ? 120 : 60, 0, chair ? 420 : 470);
    coat.addColorStop(0, 'rgba(18, 15, 13, 0.95)');
    coat.addColorStop(1, 'rgba(18, 15, 13, 0.6)');
    g.fillStyle = coat;
    g.beginPath();
    const top = chair ? 118 : 70;
    g.moveTo(128, top - 18);
    g.quadraticCurveTo(70, top, 58, top + 50);
    g.lineTo(50, chair ? 400 : 450);
    g.quadraticCurveTo(128, chair ? 430 : 480, 206, chair ? 400 : 450);
    g.lineTo(198, top + 50);
    g.quadraticCurveTo(186, top, 128, top - 18);
    g.fill();
    g.strokeStyle = 'rgba(6, 5, 4, 0.6)';
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(128, top + 10);
    g.lineTo(122, chair ? 410 : 460);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
