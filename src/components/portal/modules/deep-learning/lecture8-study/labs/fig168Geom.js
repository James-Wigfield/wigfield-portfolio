/* ============================================================================
   FIGURE 16-8, AS GEOMETRY  (slide 30's figure description, slide 31)
   ----------------------------------------------------------------------------
   mapGeom(narrow) lays out the original transformer bottom-to-top: encoder
   on the left, decoder on the right, each layer in an outlined box (N× in
   the slides). Every block has the story beat it lights up on (0 embed +
   position, 1 encoder, 2 decoder, 3 linear + softmax); every wire too, with
   its arrowhead. The decoder's upper attention gets the routing of slide
   30: its left and middle arrows come from the encoder's output, its right
   (third) arrow from the decoder's own first Add & Norm, which also sends a
   skip branch up the inside right edge. Narrow = a compact two-column map
   with two-line labels (no positional-encoding captions).
   ========================================================================== */

export const arrowUp = (x, y, s = 7) => `${x - s * 0.58},${y + s} ${x},${y} ${x + s * 0.58},${y + s}`;
export const arrowRight = (x, y, s = 7) => `${x - s},${y - s * 0.58} ${x},${y} ${x - s},${y + s * 0.58}`;
export const arrowLeft = (x, y, s = 7) => `${x + s},${y - s * 0.58} ${x},${y} ${x + s},${y + s * 0.58}`;
export const arrowDown = (x, y, s = 7) => `${x - s * 0.58},${y - s} ${x},${y} ${x + s * 0.58},${y - s}`;

// "**Bold.** rest" → "Bold. rest" (for aria-labels)
export const plain = (s) => s.replace(/\*\*|`/g, '');

export function mapGeom(narrow) {
  const n = narrow;
  const P = n
    ? { W: 360, bw: 106, ex: 82, dx: 270, pad: 9, lane: 5, fan: 30, hA: 30, hN: 17, hF: 22, hE: 22, hL: 19, fs: 10.5, r: 7, peDx: 30, peR: 8, off: [2, 2], ah: 6 }
    : { W: 780, bw: 172, ex: 222, dx: 560, pad: 16, lane: 9, fan: 44, hA: 36, hN: 20, hF: 28, hE: 28, hL: 24, fs: 12, r: 9, peDx: 50, peR: 10, off: [5, 3], ah: 7 };
  const s = (v) => Math.round(v * (n ? 0.8 : 1));
  const { ex, dx, fan: f, ah } = P;
  const hb = P.bw / 2;

  // vertical rhythm, built upward from the "Inputs" label's baseline (y = 0)
  const Y = { label: 0, words: s(15) };
  Y.embB = -s(22); Y.embT = Y.embB - P.hE;
  Y.plus = Y.embT - s(20);
  Y.boxB = Y.plus - P.r - s(14);
  Y.split = Y.boxB - s(9);
  Y.fan = Y.split - s(9);
  Y.a1B = Y.fan - s(13); Y.a1T = Y.a1B - P.hA;
  Y.n1B = Y.a1T - 5; Y.n1T = Y.n1B - P.hN;
  // encoder
  Y.eSplit2 = Y.n1T - s(11);
  Y.eFfB = Y.eSplit2 - s(13); Y.eFfT = Y.eFfB - P.hF;
  Y.eN2B = Y.eFfT - 5; Y.eN2T = Y.eN2B - P.hN;
  Y.eBoxT = Y.eN2T - s(9);
  Y.over = Y.eBoxT - 5 * P.off[1] - s(10);
  // decoder
  Y.in = Y.n1T - s(22);
  Y.qSplit = Y.n1T - s(8);
  Y.xB = Y.in - s(16); Y.xT = Y.xB - P.hA;
  Y.dN2B = Y.xT - 5; Y.dN2T = Y.dN2B - P.hN;
  Y.dSplit3 = Y.dN2T - s(11);
  Y.dFfB = Y.dSplit3 - s(13); Y.dFfT = Y.dFfB - P.hF;
  Y.dN3B = Y.dFfT - 5; Y.dN3T = Y.dN3B - P.hN;
  Y.dBoxT = Y.dN3T - s(9);
  Y.linB = Y.dBoxT - 5 * P.off[1] - s(10); Y.linT = Y.linB - P.hL;
  Y.smB = Y.linT - s(14); Y.smT = Y.smB - P.hL;
  Y.probs = Y.smT - s(12);
  Y.probsWords = Y.probs - s(15);
  const shift = (n ? 8 : 12) - (Y.probsWords - 14);
  for (const k of Object.keys(Y)) Y[k] += shift;
  const H = Y.words + 8;

  const B = (id, cx, yT, h, side, lines, beat) => ({ id, x: cx - hb, y: yT, w: P.bw, h, side, lines, beat, cx, cy: yT + h / 2 });
  const attn = n ? ['Multi-Head', 'Attention'] : ['Multi-Head Attention'];
  const blocks = [
    B('encEmb', ex, Y.embT, P.hE, 'enc', ['Input Embedding'], 0),
    B('decEmb', dx, Y.embT, P.hE, 'dec', ['Output Embedding'], 0),
    B('encMHA', ex, Y.a1T, P.hA, 'enc', attn, 1),
    B('encAN1', ex, Y.n1T, P.hN, 'enc', ['Add & Norm'], 1),
    B('encFF', ex, Y.eFfT, P.hF, 'enc', ['Feed Forward'], 1),
    B('encAN2', ex, Y.eN2T, P.hN, 'enc', ['Add & Norm'], 1),
    B('decMMHA', dx, Y.a1T, P.hA, 'dec', n ? ['Masked Multi-Head', 'Attention'] : ['Masked', 'Multi-Head Attention'], 2),
    B('decAN1', dx, Y.n1T, P.hN, 'dec', ['Add & Norm'], 2),
    B('decCross', dx, Y.xT, P.hA, 'dec', attn, 2),
    B('decAN2', dx, Y.dN2T, P.hN, 'dec', ['Add & Norm'], 2),
    B('decFF', dx, Y.dFfT, P.hF, 'dec', ['Feed Forward'], 2),
    B('decAN3', dx, Y.dN3T, P.hN, 'dec', ['Add & Norm'], 2),
    B('linear', dx, Y.linT, P.hL, 'out', ['Linear'], 3),
    B('softmax', dx, Y.smT, P.hL, 'out', ['Softmax'], 3),
  ];
  const by = Object.fromEntries(blocks.map((b) => [b.id, b]));

  const eL = ex - hb - P.lane; // the encoder's skip lane (inside left edge)
  const dR = dx + hb + P.lane; // the decoder's skip lane (inside right edge)
  const xDrop = dx - hb - P.pad - (n ? 8 : 12); // where the encoder's output drops
  const peE = ex - P.peDx;
  const peD = dx + P.peDx;
  const up = (x, y) => arrowUp(x, y, ah);
  const W = (id, beat, d, head) => ({ id, beat, d, head });

  const fanOf = (side, cx) => [
    W(`${side}.stem`, side === 'e' ? 1 : 2, `M${cx} ${Y.split} V${Y.fan}`),
    W(`${side}.fanL`, side === 'e' ? 1 : 2, `M${cx} ${Y.fan} H${cx - f} V${Y.a1B}`, up(cx - f, Y.a1B)),
    W(`${side}.fanM`, side === 'e' ? 1 : 2, `M${cx} ${Y.fan} V${Y.a1B}`, up(cx, Y.a1B)),
    W(`${side}.fanR`, side === 'e' ? 1 : 2, `M${cx} ${Y.fan} H${cx + f} V${Y.a1B}`, up(cx + f, Y.a1B)),
  ];
  const inputs = (side, cx, pe) => [
    W(`${side}.i1`, 0, `M${cx} ${Y.label - (n ? 12 : 14)} V${Y.embB}`, up(cx, Y.embB)),
    W(`${side}.i2`, 0, `M${cx} ${Y.embT} V${Y.plus + P.r}`, up(cx, Y.plus + P.r)),
    W(`${side}.pe`, 0, pe < cx ? `M${pe + P.peR} ${Y.plus} H${cx - P.r}` : `M${pe - P.peR} ${Y.plus} H${cx + P.r}`),
    W(`${side}.in`, 0, `M${cx} ${Y.plus - P.r} V${Y.split}`),
  ];

  const wires = [
    ...inputs('e', ex, peE),
    ...inputs('d', dx, peD),
    // encoder layer
    ...fanOf('e', ex),
    W('e.skip1', 1, `M${ex} ${Y.split} H${eL} V${by.encAN1.cy} H${ex - hb}`, arrowRight(ex - hb, by.encAN1.cy, ah)),
    W('e.a2', 1, `M${ex} ${Y.n1T} V${Y.eFfB}`, up(ex, Y.eFfB)),
    W('e.skip2', 1, `M${ex} ${Y.eSplit2} H${eL} V${by.encAN2.cy} H${ex - hb}`, arrowRight(ex - hb, by.encAN2.cy, ah)),
    // the encoder's output: up, across, down the gap, into the decoder
    W('e.out', 1, `M${ex} ${Y.eN2T} V${Y.over} H${xDrop} V${Y.in} H${dx}`),
    W('x.L', 1, `M${dx - f} ${Y.in} V${Y.xB}`, up(dx - f, Y.xB)),
    W('x.M', 1, `M${dx} ${Y.in} V${Y.xB}`, up(dx, Y.xB)),
    // decoder layer
    ...fanOf('d', dx),
    W('d.skip1', 2, `M${dx} ${Y.split} H${dR} V${by.decAN1.cy} H${dx + hb}`, arrowLeft(dx + hb, by.decAN1.cy, ah)),
    W('d.q', 2, `M${dx + f} ${Y.n1T} V${Y.xB}`, up(dx + f, Y.xB)),
    W('d.skip2', 2, `M${dx + f} ${Y.qSplit} H${dR} V${by.decAN2.cy} H${dx + hb}`, arrowLeft(dx + hb, by.decAN2.cy, ah)),
    W('d.a3', 2, `M${dx} ${Y.dN2T} V${Y.dFfB}`, up(dx, Y.dFfB)),
    W('d.skip3', 2, `M${dx} ${Y.dSplit3} H${dR} V${by.decAN3.cy} H${dx + hb}`, arrowLeft(dx + hb, by.decAN3.cy, ah)),
    // output head
    W('o.1', 3, `M${dx} ${Y.dN3T} V${Y.linB}`, up(dx, Y.linB)),
    W('o.2', 3, `M${dx} ${Y.linT} V${Y.smB}`, up(dx, Y.smB)),
    W('o.3', 3, `M${dx} ${Y.smT} V${Y.probs + 4}`, up(dx, Y.probs + 4)),
  ];

  const boxes = {
    enc: { x: ex - hb - P.pad, y: Y.eBoxT, w: P.bw + 2 * P.pad, h: Y.boxB - Y.eBoxT },
    dec: { x: dx - hb - P.pad, y: Y.dBoxT, w: P.bw + 2 * P.pad, h: Y.boxB - Y.dBoxT },
  };

  // where the travelling tensor + its shape tag sits after each beat
  const tagX = ex + hb + P.pad + 10;
  const tag = n
    ? [{ x: 8, y: Y.over - 74 }, { x: 8, y: Y.over - 74 }, { x: 8, y: Y.over - 74 }]
    : [{ x: tagX, y: Y.plus - 22 }, { x: tagX, y: Y.eBoxT + 6 }, { x: tagX, y: Y.over - 64 }];

  return { narrow: n, W: P.W, H, P, Y, blocks, wires, boxes, peE, peD, xDrop, tag };
}
