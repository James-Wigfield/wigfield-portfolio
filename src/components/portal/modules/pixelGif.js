/* ============================================================================
   PIXEL-GIF — a tiny, dependency-free animated GIF89a encoder
   ----------------------------------------------------------------------------
   Pixel art is the ideal input for GIF: small frames + a handful of indexed
   colours, so the whole encoder (GIF89a container + LZW image data) fits in a
   few dozen lines and keeps the portal dependency-free — the same self-contained
   spirit as the hand-drawn SVGs in WallArt. The studio (PixelGifStudio.jsx)
   feeds in a "sprite" and gets back real .gif bytes / a data URL it can preview
   in an <img> and download.

   A SPRITE is the unit the studio renders and the future MCP integration injects
   (see PixelGifStudio.jsx):

     {
       id, name,                  // identity
       width, height,             // native pixel grid
       palette: string[],         // index -> "#rrggbb" (index 0..n)
       transparentIndex|null,     // palette index drawn as transparent
       frames: number[][],        // frames[f][y*width + x] = palette index
       delayMs                    // suggested per-frame delay
     }

   Public API:
     encodeGif(opts)    -> Uint8Array   low-level: final-size indexed frames in
     scaleFrame(...)    -> number[]      nearest-neighbour resample (crisp px)
     spriteToGif(s,spec)-> Uint8Array   scale + trim + encode a sprite per spec
     gifDataUrl(bytes)  -> string        base64 data: URL for <img>/download
   ========================================================================== */

// ── LZW (GIF variant) ────────────────────────────────────────────────────────
// Variable-width, LSB-first codes. The code size grows one bit at a time and a
// CLEAR is emitted when the 12-bit table fills. The growth threshold is offset
// by one (`(1<<codeSize)+1`) because we write a code BEFORE assigning its table
// entry, which keeps the encoder bit-exact with a standard GIF decoder (the
// decoder always lags the encoder's table by one entry).
function lzwEncode(indices, minCodeSize) {
  const clear = 1 << minCodeSize;
  const end = clear + 1;
  const out = [];
  let cur = 0;
  let n = 0;
  const emit = (code, len) => {
    cur |= code << n;
    n += len;
    while (n >= 8) {
      out.push(cur & 0xff);
      cur >>= 8;
      n -= 8;
    }
  };

  let codeSize = minCodeSize + 1;
  let dict = new Map();
  let next = end + 1;

  emit(clear, codeSize);
  if (indices.length === 0) {
    emit(end, codeSize);
    if (n > 0) out.push(cur & 0xff);
    return out;
  }

  let prefix = indices[0];
  for (let i = 1; i < indices.length; i++) {
    const k = indices[i];
    const key = (prefix << 8) | k;
    const found = dict.get(key);
    if (found !== undefined) {
      prefix = found;
    } else {
      emit(prefix, codeSize);
      if (next === 4096) {
        // 12-bit table full — flush, reset to the initial width.
        emit(clear, codeSize);
        dict = new Map();
        next = end + 1;
        codeSize = minCodeSize + 1;
      } else {
        dict.set(key, next);
        next++;
        if (next === (1 << codeSize) + 1 && codeSize < 12) codeSize++;
      }
      prefix = k;
    }
  }
  emit(prefix, codeSize);
  emit(end, codeSize);
  if (n > 0) out.push(cur & 0xff);
  return out;
}

// "#rgb" or "#rrggbb" -> [r, g, b]
function hexToRgb(hex) {
  const h = String(hex).replace('#', '');
  const f = h.length === 3 ? h[0] + h[0] + h[1] + h[1] + h[2] + h[2] : h;
  return [parseInt(f.slice(0, 2), 16), parseInt(f.slice(2, 4), 16), parseInt(f.slice(4, 6), 16)];
}

// Append `bytes` as GIF data sub-blocks (≤255 each, terminated by a 0 block).
function pushSubBlocks(out, bytes) {
  for (let i = 0; i < bytes.length; i += 255) {
    const chunk = bytes.slice(i, i + 255);
    out.push(chunk.length, ...chunk);
  }
  out.push(0x00);
}

/**
 * Encode indexed frames (already at their final pixel size) into an animated
 * GIF89a. Every frame must be a flat array of `width*height` palette indices.
 * @returns {Uint8Array}
 */
export function encodeGif({
  width,
  height,
  palette,
  frames,
  delayMs = 120,
  transparentIndex = null,
  loop = 0,
}) {
  const tableBits = Math.max(1, Math.ceil(Math.log2(Math.max(2, palette.length))));
  const gctSize = 1 << tableBits; // colours in the (padded) global colour table
  const minCodeSize = Math.max(2, tableBits); // GIF requires LZW min code size ≥ 2
  const delayCs = Math.max(2, Math.round(delayMs / 10)); // GIF delays are in 1/100 s
  const transparent = transparentIndex == null ? null : transparentIndex;

  const out = [];
  const byte = (b) => out.push(b & 0xff);
  const short = (v) => out.push(v & 0xff, (v >> 8) & 0xff);
  const str = (s) => { for (let i = 0; i < s.length; i++) out.push(s.charCodeAt(i)); };

  // Header + Logical Screen Descriptor
  str('GIF89a');
  short(width);
  short(height);
  byte(0x80 | ((tableBits - 1) << 4) | (tableBits - 1)); // GCT present · colour res · GCT size
  byte(transparent ?? 0); // background colour index
  byte(0); // pixel aspect ratio

  // Global Colour Table (padded to gctSize entries)
  for (let i = 0; i < gctSize; i++) {
    const [r, g, b] = hexToRgb(palette[i] || '#000000');
    out.push(r, g, b);
  }

  // NETSCAPE2.0 looping extension
  byte(0x21);
  byte(0xff);
  byte(0x0b);
  str('NETSCAPE2.0');
  byte(0x03);
  byte(0x01);
  short(loop); // 0 = loop forever
  byte(0x00);

  for (const frame of frames) {
    // Graphic Control Extension — per-frame delay + transparency.
    byte(0x21);
    byte(0xf9);
    byte(0x04);
    // disposal 2 (restore to background) keeps transparency clean between frames.
    byte((2 << 2) | (transparent == null ? 0 : 1));
    short(delayCs);
    byte(transparent ?? 0);
    byte(0x00);

    // Image Descriptor — full frame, uses the global colour table.
    byte(0x2c);
    short(0);
    short(0);
    short(width);
    short(height);
    byte(0x00);

    // Image data
    byte(minCodeSize);
    pushSubBlocks(out, lzwEncode(frame, minCodeSize));
  }

  byte(0x3b); // trailer
  return Uint8Array.from(out);
}

/**
 * Nearest-neighbour resample of one indexed frame — keeps pixel-art edges crisp
 * (integer upscales are exact). Returns the same array reference when no resize.
 */
export function scaleFrame(frame, sw, sh, dw, dh) {
  if (sw === dw && sh === dh) return frame;
  const out = new Array(dw * dh);
  for (let y = 0; y < dh; y++) {
    const sy = Math.min(sh - 1, Math.floor((y * sh) / dh));
    for (let x = 0; x < dw; x++) {
      const sx = Math.min(sw - 1, Math.floor((x * sw) / dw));
      out[y * dw + x] = frame[sy * sw + sx];
    }
  }
  return out;
}

/**
 * Scale + trim a sprite to a render spec and encode it.
 * @param spec {width,height,frames,delayMs} — any field may be omitted to use
 *             the sprite's native value. `frames` is clamped to what exists.
 * @returns {Uint8Array}
 */
export function spriteToGif(sprite, spec = {}) {
  const width = spec.width ?? sprite.width;
  const height = spec.height ?? sprite.height;
  const count = Math.max(1, Math.min(spec.frames ?? sprite.frames.length, sprite.frames.length));
  const frames = sprite.frames
    .slice(0, count)
    .map((f) => scaleFrame(f, sprite.width, sprite.height, width, height));
  return encodeGif({
    width,
    height,
    palette: sprite.palette,
    frames,
    delayMs: spec.delayMs ?? sprite.delayMs,
    transparentIndex: sprite.transparentIndex ?? null,
  });
}

/** Bytes -> `data:image/gif;base64,…` URL (browser; uses btoa). */
export function gifDataUrl(bytes) {
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return `data:image/gif;base64,${btoa(bin)}`;
}
