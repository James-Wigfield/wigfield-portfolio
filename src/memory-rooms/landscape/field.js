/* A v2 landscape's grids in the browser (tools/memory-rooms/landscape/v2/export_data.py writes them).

     const img = await decodePng(bytesOrUrl)          // { width, height, data: Uint8ClampedArray RGBA }
     const field = makeField(meta, heightsImg)          // meta = data.json
     field.heightAt(x, z)  field.flagsAt(x, z)  field.normalAt(x, z, out)  field.inside(x, z)

   World frame (every scene's): x east, y up, z south, metres from the spot's centre. The grids' row 0 is the
   frame's NORTH edge (the most negative z), column 0 its west edge, cell centres at +0.5. Heights: R,G = a
   uint16 of (h + offset) * scale; B = walk flags (meta.heights.flags). */

export async function decodePng(src, type = 'image/png') {
  let blob;
  if (typeof src === 'string') blob = await (await fetch(src)).blob();
  else blob = new Blob([src], { type });
  const bmp = await createImageBitmap(blob, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
  const canvas = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(bmp.width, bmp.height) : Object.assign(document.createElement('canvas'), { width: bmp.width, height: bmp.height });
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bmp, 0, 0);
  const { data } = ctx.getImageData(0, 0, bmp.width, bmp.height);
  return { width: bmp.width, height: bmp.height, data, bitmap: bmp };
}

export function makeField(meta, img) {
  const f = meta.frame;
  const cols = img.width;
  const rows = img.height;
  const cell = f.cell;
  const x0 = f.x0; // west edge
  const z0 = -f.y1; // north edge (world z)
  const { offset, scale } = meta.heights;
  const h = new Float32Array(cols * rows);
  const flags = new Uint8Array(cols * rows);
  const d = img.data;
  for (let i = 0, n = cols * rows; i < n; i++) {
    h[i] = ((d[i * 4] << 8) | d[i * 4 + 1]) / scale - offset;
    flags[i] = d[i * 4 + 2];
  }
  const clampi = (v, n) => (v < 0 ? 0 : v > n - 1 ? n - 1 : v);
  // bilinear between cell centres
  const heightAt = (x, z) => {
    const fx = (x - x0) / cell - 0.5;
    const fz = (z - z0) / cell - 0.5;
    const i = Math.floor(fx);
    const j = Math.floor(fz);
    const tx = fx - i;
    const tz = fz - j;
    const i0 = clampi(i, cols);
    const i1 = clampi(i + 1, cols);
    const j0 = clampi(j, rows) * cols;
    const j1 = clampi(j + 1, rows) * cols;
    const a = h[j0 + i0] + (h[j0 + i1] - h[j0 + i0]) * tx;
    const b = h[j1 + i0] + (h[j1 + i1] - h[j1 + i0]) * tx;
    return a + (b - a) * tz;
  };
  const flagsAt = (x, z) => {
    const i = Math.floor((x - x0) / cell);
    const j = Math.floor((z - z0) / cell);
    if (i < 0 || j < 0 || i >= cols || j >= rows) return 0;
    return flags[j * cols + i];
  };
  // the normal of the surface over a span of `s` metres (wider spans for coarser LODs)
  const normalAt = (x, z, out, s = cell) => {
    const hx = heightAt(x + s, z) - heightAt(x - s, z);
    const hz = heightAt(x, z + s) - heightAt(x, z - s);
    const nx = -hx;
    const ny = 2 * s;
    const nz = -hz;
    const l = Math.hypot(nx, ny, nz);
    out[0] = nx / l;
    out[1] = ny / l;
    out[2] = nz / l;
    return out;
  };
  const inside = (x, z) => x >= x0 && x <= x0 + cols * cell && z >= z0 && z <= z0 + rows * cell;
  return {
    meta,
    cols,
    rows,
    cell,
    x0,
    z0,
    width: cols * cell,
    depth: rows * cell,
    box: { min: [-f.half[0], -f.half[1]], max: [f.half[0], f.half[1]] }, // the detailed box (x, z)
    h,
    flags,
    heightAt,
    flagsAt,
    normalAt,
    inside,
  };
}
