/* ============================================================================
   PROVENANCE: copied from public/artificial-life/src/lib/palette.js (the
   Specimen Cabinet). Never edit the original.
   Changed: nothing in pack/hex/ramp; added unpack() for the creature overlay.
   ========================================================================== */

// Colour ramps baked into 256-entry lookup tables of packed little-endian RGBA
// (0xAABBGGRR), which is what a Uint32Array view over an RGBA byte buffer wants.

export function pack(r, g, b) {
  return ((255 << 24) | ((b & 255) << 16) | ((g & 255) << 8) | (r & 255)) >>> 0;
}

export function hex(h) {
  const v = parseInt(h.replace('#', ''), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

export function unpack(c) {
  return [c & 255, (c >>> 8) & 255, (c >>> 16) & 255];
}

// stops: [[position 0..1, '#rrggbb' | [r,g,b]], ...] ascending.
// Interpolated in linear light so ramps do not go muddy in the middle.
export function ramp(stops, n = 256) {
  const pts = stops.map(([t, c]) => [t, (typeof c === 'string' ? hex(c) : c).map(toLinear)]);
  const lut = new Uint32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    let k = 0;
    while (k < pts.length - 2 && t > pts[k + 1][0]) k++;
    const [t0, c0] = pts[k], [t1, c1] = pts[k + 1];
    const f = t1 === t0 ? 0 : Math.min(1, Math.max(0, (t - t0) / (t1 - t0)));
    const e = f * f * (3 - 2 * f); // smoothstep between stops
    lut[i] = pack(
      toSrgb(c0[0] + (c1[0] - c0[0]) * e),
      toSrgb(c0[1] + (c1[1] - c0[1]) * e),
      toSrgb(c0[2] + (c1[2] - c0[2]) * e),
    );
  }
  return lut;
}

function toLinear(c) {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function toSrgb(l) {
  const c = l <= 0.0031308 ? l * 12.92 : 1.055 * Math.pow(l, 1 / 2.4) - 0.055;
  return Math.max(0, Math.min(255, Math.round(c * 255)));
}
