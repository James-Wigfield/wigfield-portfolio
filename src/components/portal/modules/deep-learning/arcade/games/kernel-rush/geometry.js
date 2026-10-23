/* Kernel Rush — stage geometry (pure helpers; the components live in Stage.jsx).
   Blocks are drawn in an oblique projection: the front face is height × width,
   the depth (channels) recedes up and to the right. Sizes are relative to the
   input's larger side (linear, so a halving looks like a halving; clamped so
   tiny maps stay visible); depth is on a log scale (1 … 384 channels). The labels
   carry the exact numbers. */

export const OBL = { x: 0.8, y: 0.55 };

export const LAYOUT = {
  wide: { W: 820, H: 300, S: 124, maxK: 1.2, dScale: 1, base: 262, inX: 60 },
  narrow: { W: 360, H: 404, S: 80, maxK: 1.25, dScale: 0.62, base: 160, base2: 364, inX: 42 },
};

/** px for a height/width of n, relative to the input's larger side `ref`. */
export function hwScale(ref, S, maxK) {
  return (n) => {
    if (n == null || !Number.isFinite(n) || n <= 0) return null;
    return Math.max(9, Math.min(S * maxK, Math.round((S * n) / ref)));
  };
}

/** px of depth for c channels. */
export function depthPx(c, scale = 1) {
  if (c == null || !Number.isFinite(c) || c <= 0) return null;
  return Math.max(3, Math.min(56, Math.round(3 + 7.5 * Math.log2(c)))) * scale;
}

/** Total drawn width / height of a block (front + receding depth). */
export const extent = (w, h, d) => ({ w: w + d * OBL.x, h: h + d * OBL.y });

/** Parse the ShapePad slots into numbers (null where empty or zero). */
export const parseSlots = (vals) => vals.map((v) => (v === '' || v == null || Number(v) <= 0 ? null : Number(v)));

/** Cell size for the receptive-field grids. */
export const cellSize = (n, narrow) => Math.max(8, Math.min(narrow ? 16 : 22, Math.floor((narrow ? 196 : 212) / n)));
