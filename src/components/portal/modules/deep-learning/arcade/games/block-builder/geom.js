/* Block Builder — small view helpers for the SVG figures (no facts here;
   every label comes from content/block-builder.js). */

/** An arrowhead polygon whose tip is at (x2, y2), pointing along (x1, y1) → (x2, y2). */
export function arrowHead(x1, y1, x2, y2, size = 6) {
  const a = Math.atan2(y2 - y1, x2 - x1);
  const w = size * 0.6;
  const bx = x2 - size * Math.cos(a);
  const by = y2 - size * Math.sin(a);
  const px = -Math.sin(a) * w;
  const py = Math.cos(a) * w;
  return `${x2},${y2} ${(bx + px).toFixed(2)},${(by + py).toFixed(2)} ${(bx - px).toFixed(2)},${(by - py).toFixed(2)}`;
}

// Figure 14-14's layout (viewBox 0 0 344 244): four columns, two rows of boxes
export const INC = {
  w: 344,
  h: 244,
  cols: [48, 130, 214, 296],
  boxW: 78,
  boxH: 34,
  upperY: 110,
  lowerY: 164,
  fan: [172, 210],
  inputY: 240,
  concat: { x: 128, y: 54, w: 88, h: 32 },
  frame: { x: 6, y: 44, w: 332, h: 176 },
};

// Figure 14-16's layout (viewBox 0 0 320 292)
export const RES = {
  w: 320,
  h: 292,
  cx: 150,
  boxW: 130,
  boxH: 40,
  y: { in: 242, l1: 178, l2: 114 },
  add: { y: 58, s: 34 },
  railX: 40,
  outY: 22,
};
/** The block's box in Figure 14-16's layout: { x, y, w, h }. */
export function resBox(id) {
  if (id === 'add') return { x: RES.cx - RES.add.s / 2, y: RES.add.y, w: RES.add.s, h: RES.add.s };
  return { x: RES.cx - RES.boxW / 2, y: RES.y[id], w: RES.boxW, h: RES.boxH };
}
/** A skip-connection path from one block to another, routed along the left rail. */
export function skipPath(from, to) {
  const a = resBox(from);
  const b = resBox(to);
  const ya = a.y + a.h / 2;
  const yb = b.y + b.h / 2;
  return { d: `M${a.x} ${ya} L${RES.railX} ${ya} L${RES.railX} ${yb} L${b.x} ${yb}`, tip: [b.x, yb], from: [RES.railX, yb] };
}
