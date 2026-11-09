/* ============================================================================
   FEMUR — a proximal femur (right side, front view, head to the left) in a
   640 x 920 box, plus its trabecular systems as stroke paths. The trabeculae
   follow the classic stress-line pattern (Wolff's law): a compressive fan
   from the medial neck up into the weight-bearing head, a tensile arch from
   below the greater trochanter over the neck into the lower head, and a
   secondary fan from the lesser trochanter towards the greater trochanter.
   Schematic, not traced from an image.
   ========================================================================== */

export const HEAD = { cx: 170, cy: 195, r: 112 };

export const OUTLINE = [
  'M 271.5 147.7',
  'A 112 112 0 1 0 261.7 259.2',
  'C 300 280 340 330 356 400',
  'C 362 425 352 440 344 452',
  'C 330 470 340 496 366 498',
  'C 384 500 392 512 394 530',
  'C 398 640 402 760 404 900',
  'L 520 900',
  'C 520 760 524 560 538 420',
  'C 548 340 566 262 548 206',
  'C 536 168 500 146 470 152',
  'C 446 158 436 176 418 178',
  'C 380 182 320 152 271.5 147.7 Z',
].join(' ');

/** Marrow canal of the shaft. */
export const CANAL = 'M 434 920 C 432 760 430 650 440 572 C 450 530 478 530 488 572 C 496 650 494 760 492 920 Z';

const f = (v) => v.toFixed(1);
const lerp = (a, b, k) => a + (b - a) * k;
const onHead = (deg, k = 0.96) => {
  const r = (deg * Math.PI) / 180;
  return [HEAD.cx + HEAD.r * k * Math.cos(r), HEAD.cy + HEAD.r * k * Math.sin(r)];
};

/** Trabecular paths, grouped. Each is drawn on in order (base of the fan first). */
export function trabeculae() {
  const comp = [];
  const N = 9;
  for (let i = 0; i < N; i++) {
    const k = i / (N - 1);
    const s = [lerp(282, 384, k), lerp(272, 530, k)]; // medial neck / calcar
    const e = onHead(lerp(-158, -48, k));
    const c1 = [s[0] - 18 - 30 * k, s[1] - 110 - 70 * k];
    const c2 = [e[0] + 30 - 10 * k, e[1] + 90 + 20 * k];
    comp.push(`M ${f(s[0])} ${f(s[1])} C ${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(e[0])} ${f(e[1])}`);
  }
  const tens = [];
  const M = 7;
  for (let i = 0; i < M; i++) {
    const k = i / (M - 1);
    const s = [lerp(538, 530, k), lerp(300, 450, k)]; // lateral cortex under the greater trochanter
    const e = onHead(lerp(168, 92, k), 0.97); // lower head
    const c1 = [s[0] - 70 - 20 * k, s[1] - 170 - 40 * k];
    const c2 = [lerp(250, 300, k), lerp(110, 210, k)];
    tens.push(`M ${f(s[0])} ${f(s[1])} C ${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(e[0])} ${f(e[1])}`);
  }
  const sec = [];
  const P = 6;
  for (let i = 0; i < P; i++) {
    const k = i / (P - 1);
    const s = [lerp(370, 404, k), lerp(486, 560, k)];
    const e = [lerp(452, 548, k), lerp(176, 300, k)];
    sec.push(`M ${f(s[0])} ${f(s[1])} C ${f(s[0] + 40)} ${f(s[1] - 120)} ${f(e[0] - 30)} ${f(e[1] + 90)} ${f(e[0])} ${f(e[1])}`);
  }
  return { comp, tens, sec };
}

/** Lines the "load" pulse travels along: the compressive fan, head to calcar. */
export function loadPaths() {
  const out = [];
  [1, 3, 5, 7].forEach((i) => {
    const k = i / 8;
    const e = [lerp(282, 384, k), lerp(272, 530, k)];
    const s = onHead(lerp(-158, -48, k));
    const c1 = [s[0] + 30 - 10 * k, s[1] + 90 + 20 * k];
    const c2 = [e[0] - 18 - 30 * k, e[1] - 110 - 70 * k];
    out.push(`M ${f(s[0])} ${f(s[1])} C ${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(e[0])} ${f(e[1])} L ${f(e[0] + 8)} ${f(e[1] + 260)}`);
  });
  return out;
}
