import { FACTS } from '../../shared/facts';

/* ============================================================================
   DECK 3 (context) — GEOMETRY
   ----------------------------------------------------------------------------
   Canvas zones, scan crops and the N1 window sizes. Every window size comes
   from the fact manifest (patch.*, psm.*) and the N1 scale (n1.mm_per_px:
   1 hold px = 1.0182 mm at the case A beat 1 hold, scale 1). Rectangles are
   drawn in hold coordinates (1920 x 1080) inside the same transformed frame
   as the hold image, so any display scaling applies to both alike.
   ========================================================================== */

const v = (k) => FACTS[k].value;

// Canvas zones (1920 x 1080).
export const M = 96;
export const TOP = { x: M, y: 262, w: 1920 - 2 * M, h: 722 }; // content under a top title
export const SIDE = { x: M, y: 40, w: 744, h: 944 }; // left visual in the side layout
export const COL = { x: 904, w: 920 }; // right column in the side layout

// The case A hold: body bounding box x 714-1207, y 120-960 (measured on
// case-a-1-scan.png); clips 2a onwards glide the body 420 px left.
export const A1_CROP = [617, 96, 686, 870]; // spot-the-lesions view (body only)
export const A4_CROP = [197, 96, 686, 870]; // same view after the glide (clips 3 to 5)
export const WIN_CROP = [607, 70, 706, 896]; // room for every window (y 210-870), above the turntable
export const B4_CROP = [190, 96, 700, 888]; // case B after the glide (body x 306-775)

// N1: window sizes in hold px. x is left-right, z is head-toe; depth is not drawn.
const MMPP = v('n1.mm_per_px');
const win = (xKey, zKey) => ({ w: v(xKey) / MMPP, h: v(zKey) / MMPP });
export const WIN = {
  small: win('patch.small_x_mm', 'patch.small_z_mm'), // runs 3 to 5: 192.0 x 282.9
  psm: win('psm.patch_x_mm', 'psm.patch_z_mm'), // PSMASegmentator deployed: 511.7 x 565.7
  large: win('patch.large_x_mm', 'patch.large_z_mm'), // run 6 large: 384.0 x 660.0
};
// One illustrative centre shared by the three windows (as in the dissertation's
// patch-geometry figure): the middle of case A's body.
export const WIN_C = { x: 960, y: 540 };
export const rectOf = (w) => ({ x: WIN_C.x - w.w / 2, y: WIN_C.y - w.h / 2, w: w.w, h: w.h });

// Where a hold-px point lands inside a ScanView of display width `dw`.
export const toView = (crop, dw, p) => {
  const k = dw / crop[2];
  return { x: (p.x - crop[0]) * k, y: (p.y - crop[1]) * k };
};

// N2: token lanes, lengths proportional to the real counts.
export const TOK = { s3: v('net.tok3'), s4: v('net.tok4'), s5: v('net.tok5') };

// N3: tile counts, computed from the manifest.
export const N3 = {
  total: v('data.total'),
  autopet: v('data.autopet'),
  deeppsma: v('data.deeppsma'),
  test: v('data.test'),
  testAutopet: v('data.test_autopet'),
  testDeep: v('data.test_deeppsma'),
  pool: v('data.pool'),
  fold0: v('data.fold0'),
  foldN: v('data.fold_n'),
  val57: v('train.val57'),
  poolDeep: v('data.pool_deeppsma'),
};

// N8: option F (figures/architecture-option-f.svg), viewBox 409.888 x 419.525.
export const OPTF = { w: 409.888, h: 419.525 };
export const OPTF_RATIO = OPTF.h / OPTF.w;

// Organ-head unit chart counts.
export const ORG = { fc3: v('organ.fc3'), fc4: v('organ.fc4') };

// N5 cells (F1 points).
export const R6 = {
  hs: v('r6.h_small'),
  hl: v('r6.h_large'),
  cs: v('r6.c_small'),
  cl: v('r6.c_large'),
  psm: v('fair.psm_f1') * 100,
};

// N4a diverging bars (points, run 4 minus PSMASegmentator).
export const FAIR = {
  df1: v('fair.df1'),
  lo: v('fair.df1_lo'),
  hi: v('fair.df1_hi'),
  dsens: v('fair.dsens'),
  dppv: v('fair.dppv'),
};

// The PET colour ramp (inferno), the deck's only accent.
export const RAMP = ['#1B0C41', '#4A0C6B', '#781C6D', '#A52C60', '#CF4446', '#ED6925', '#FB9B06', '#F7D13D', '#FCFFA4'];
