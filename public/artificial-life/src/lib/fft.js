// Iterative radix-2 complex FFT, power-of-two sizes only.
// Operates on strided views so 2D passes need no copying.

class FFT1D {
  constructor(n) {
    if ((n & (n - 1)) !== 0) throw new Error('FFT size must be a power of two: ' + n);
    this.n = n;
    const levels = Math.round(Math.log2(n));
    this.rev = new Uint32Array(n);
    for (let i = 0; i < n; i++) {
      let r = 0;
      for (let j = 0; j < levels; j++) r |= ((i >>> j) & 1) << (levels - 1 - j);
      this.rev[i] = r;
    }
    const half = n >> 1;
    this.cos = new Float64Array(half);
    this.sin = new Float64Array(half);
    for (let i = 0; i < half; i++) {
      this.cos[i] = Math.cos((2 * Math.PI * i) / n);
      this.sin[i] = Math.sin((2 * Math.PI * i) / n);
    }
  }

  // sign = -1 forward, +1 inverse (unscaled)
  transform(re, im, off, stride, sign) {
    const n = this.n, rev = this.rev, cos = this.cos, sin = this.sin;
    for (let i = 0; i < n; i++) {
      const j = rev[i];
      if (j > i) {
        const a = off + i * stride, b = off + j * stride;
        let t = re[a]; re[a] = re[b]; re[b] = t;
        t = im[a]; im[a] = im[b]; im[b] = t;
      }
    }
    for (let size = 2; size <= n; size <<= 1) {
      const half = size >> 1, tstep = n / size;
      for (let i = 0; i < n; i += size) {
        for (let j = i, k = 0; j < i + half; j++, k += tstep) {
          const a = off + j * stride, b = off + (j + half) * stride;
          const c = cos[k], s = sign * sin[k];
          const br = re[b], bi = im[b];
          const tre = br * c - bi * s;
          const tim = br * s + bi * c;
          re[b] = re[a] - tre; im[b] = im[a] - tim;
          re[a] += tre; im[a] += tim;
        }
      }
    }
  }
}

export class FFT2D {
  constructor(w, h) {
    this.w = w; this.h = h;
    this.fx = new FFT1D(w);
    this.fy = w === h ? this.fx : new FFT1D(h);
  }

  forward(re, im) {
    const { w, h, fx, fy } = this;
    for (let y = 0; y < h; y++) fx.transform(re, im, y * w, 1, -1);
    for (let x = 0; x < w; x++) fy.transform(re, im, x, w, -1);
  }

  inverse(re, im) {
    const { w, h, fx, fy } = this;
    for (let x = 0; x < w; x++) fy.transform(re, im, x, w, 1);
    for (let y = 0; y < h; y++) fx.transform(re, im, y * w, 1, 1);
    const s = 1 / (w * h);
    for (let i = 0, n = w * h; i < n; i++) { re[i] *= s; im[i] *= s; }
  }
}
