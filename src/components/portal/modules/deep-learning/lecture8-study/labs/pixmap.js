/* ============================================================================
   LECTURE 8 STUDY — RASTER HELPERS FOR THE LABS' DRAWN IMAGES
   ----------------------------------------------------------------------------
   imageUrl(w, h, pixel)   a PNG data URL, pixel(x, y) → [r, g, b] or
                           [r, g, b, a] (0…255). Built in the browser only,
                           when a lab first renders, then cached by callers.
   maskUrl(w, h, value)    a luminance mask: value(x, y) in 0…1 → grey. An
                           SVG <mask> made from it lets a rect filled with a
                           role colour (var(--dl8s-pos) …) show through only
                           where the values are, so heatmaps follow the
                           theme without any colour being read in JS.
   ========================================================================== */

export function imageUrl(w, h, pixel) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(w, h);
  const d = img.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = pixel(x, y);
      const k = (y * w + x) * 4;
      d[k] = c[0];
      d[k + 1] = c[1];
      d[k + 2] = c[2];
      d[k + 3] = c.length > 3 ? c[3] : 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return cv.toDataURL('image/png');
}

export function maskUrl(w, h, value) {
  return imageUrl(w, h, (x, y) => {
    const g = Math.round(255 * Math.max(0, Math.min(1, value(x, y))));
    return [g, g, g];
  });
}
