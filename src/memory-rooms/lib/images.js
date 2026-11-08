/* Photo processing on the phone: decode (EXIF orientation applied, HEIC on
   Safari), re-encode a JPEG at a 2048 px long edge (never upscaled) and a
   480 px thumbnail drawn from that. One photo at a time keeps memory low. */

export const PHOTO_LONG_EDGE = 2048;
export const THUMB_LONG_EDGE = 480;
const PHOTO_QUALITY = 0.85;
const THUMB_QUALITY = 0.8;

async function decode(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close?.() };
    } catch {
      /* fall through to <img>, which also applies EXIF orientation */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    if (!img.naturalWidth) throw new Error('empty image');
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => URL.revokeObjectURL(url) };
  } catch (err) {
    URL.revokeObjectURL(url);
    throw err;
  }
}

function canvas(w, h) {
  if (typeof OffscreenCanvas !== 'undefined') {
    try {
      const c = new OffscreenCanvas(w, h);
      const ctx = c.getContext('2d');
      if (ctx) return { c, ctx, offscreen: true };
    } catch {
      /* Safari < 16.4: no 2d OffscreenCanvas */
    }
  }
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return { c, ctx: c.getContext('2d'), offscreen: false };
}

function toJpeg({ c, offscreen }, quality) {
  if (offscreen) return c.convertToBlob({ type: 'image/jpeg', quality });
  return new Promise((resolve, reject) =>
    c.toBlob((b) => (b ? resolve(b) : reject(new Error('JPEG encode failed'))), 'image/jpeg', quality),
  );
}

function draw(source, sw, sh, longEdge) {
  const s = Math.min(1, longEdge / Math.max(sw, sh));
  const w = Math.max(1, Math.round(sw * s));
  const h = Math.max(1, Math.round(sh * s));
  const cv = canvas(w, h);
  cv.ctx.imageSmoothingEnabled = true;
  cv.ctx.imageSmoothingQuality = 'high';
  cv.ctx.drawImage(source, 0, 0, w, h);
  return { ...cv, width: w, height: h };
}

function release(cv) {
  if (!cv.offscreen) {
    cv.c.width = 0; // frees the backing store on iOS right away
    cv.c.height = 0;
  }
}

/**
 * file → { photo: Blob, width, height, thumb: Blob, thumbWidth, thumbHeight }
 * Throws if the browser can't decode the file.
 */
export async function processPhoto(file) {
  const src = await decode(file);
  try {
    const big = draw(src.source, src.width, src.height, PHOTO_LONG_EDGE);
    const photo = await toJpeg(big, PHOTO_QUALITY);
    const small = draw(big.c, big.width, big.height, THUMB_LONG_EDGE);
    const thumb = await toJpeg(small, THUMB_QUALITY);
    const out = { photo, width: big.width, height: big.height, thumb, thumbWidth: small.width, thumbHeight: small.height };
    release(big);
    release(small);
    return out;
  } finally {
    src.close();
  }
}
