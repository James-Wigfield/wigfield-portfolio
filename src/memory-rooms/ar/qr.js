/* The desktop's QR code (lazy: only a desktop that opens "See it in your space"
   downloads it). One SVG path, one module per unit; the page colours it from
   the --mr-qr-* tokens (always dark on light, so every phone camera reads it). */

import qrcode from 'qrcode-generator';

/** { size, d } for `text`: an n × n grid of modules as one path. */
export function qrPath(text) {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  const size = qr.getModuleCount();
  let d = '';
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!qr.isDark(r, c)) continue;
      // merge a run of dark modules on this row into one rectangle
      let run = 1;
      while (c + run < size && qr.isDark(r, c + run)) run++;
      d += `M${c} ${r}h${run}v1h-${run}z`;
      c += run - 1;
    }
  }
  return { size, d };
}
