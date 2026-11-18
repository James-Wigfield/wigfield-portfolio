// A fixed-resolution offscreen pixel surface. Systems paint into `u32`
// (packed little-endian RGBA) and blit it to the display canvas; the
// simulation resolution is therefore independent of the viewport.
export class Surface {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.buf = new ArrayBuffer(w * h * 4);
    this.u8 = new Uint8ClampedArray(this.buf);
    this.u32 = new Uint32Array(this.buf);
    this.canvas = null;
    this.sctx = null;
    this.image = null;
  }

  clear(colour = 0xff000000) {
    this.u32.fill(colour);
  }

  ensure() {
    if (this.canvas) return;
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.w;
    this.canvas.height = this.h;
    this.sctx = this.canvas.getContext('2d', { alpha: false, willReadFrequently: false });
    this.image = new ImageData(this.u8, this.w, this.h);
  }

  // mode: 'cover' fills the viewport and crops, 'contain' letterboxes,
  // 'stretch' distorts to fit exactly.
  blit(ctx, { smooth = false, mode = 'cover' } = {}) {
    this.ensure();
    this.sctx.putImageData(this.image, 0, 0);
    const cw = ctx.canvas.width, ch = ctx.canvas.height;
    ctx.imageSmoothingEnabled = smooth;
    if (smooth) ctx.imageSmoothingQuality = 'high';
    if (mode === 'stretch') {
      ctx.drawImage(this.canvas, 0, 0, cw, ch);
      return;
    }
    const s = mode === 'contain'
      ? Math.min(cw / this.w, ch / this.h)
      : Math.max(cw / this.w, ch / this.h);
    const dw = this.w * s, dh = this.h * s;
    ctx.drawImage(this.canvas, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
  }

  // Inverse of blit(): viewport pixel -> normalised surface coordinate.
  toLocal(px, py, cw, ch, mode = 'cover') {
    if (mode === 'stretch') return { x: px / cw, y: py / ch };
    const s = mode === 'contain'
      ? Math.min(cw / this.w, ch / this.h)
      : Math.max(cw / this.w, ch / this.h);
    const dw = this.w * s, dh = this.h * s;
    return { x: (px - (cw - dw) / 2) / dw, y: (py - (ch - dh) / 2) / dh };
  }

  dispose() {
    if (this.canvas) {
      this.canvas.width = this.canvas.height = 0;
      this.canvas = null;
      this.sctx = null;
      this.image = null;
    }
    this.buf = null;
    this.u8 = null;
    this.u32 = null;
  }
}
