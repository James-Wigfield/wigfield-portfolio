/* ============================================================================
   BARISTA · MACHINE GEOMETRY — shared coordinates for Machine.jsx + scenes
   ----------------------------------------------------------------------------
   One original front elevation of the BES876 in a 400 × 380 user space
   (500 wide when the tank side-inset is shown). Part placement follows the
   IB p.7 component map: hopper top-left, grinder controls + cradle on the
   left, gauge centred over the group head, 1 CUP / 2 CUP / POWER top-right
   with the two indicator lights under them, steam/hot-water dial on the
   right flank, hot water outlet beside the group, wand on the right.
   ========================================================================== */

export const M = {
  w: 400,
  h: 380,
  wInset: 500,
  gauge: { x: 226, y: 152, r: 32 },
  group: { x: 226, y: 216 },
  outlet: { x: 274, y: 220 },
  tip: { x: 331, y: 310 },
  wandPivot: { x: 312, y: 206 },
  cradle: { x: 112, y: 274 },
  pfGroup: { x: 226, y: 218 },
  trayTop: 316,
  dial: { x: 356, y: 154 },
  lever: { x: 50, y: 226 },
  hopper: { x: 110, top: 30, base: 92 },
  buttons: {
    dose: { x: 84, y: 140 },
    filter: { x: 176, y: 132 },
    one: { x: 276, y: 136 },
    two: { x: 302, y: 136 },
    power: { x: 328, y: 136 },
  },
  leds: { clean: { x: 282, y: 168 }, steam: { x: 304, y: 168 } },
  tank: { x: 392, y: 120, w: 76, bottom: 310, max: 134, min: 288 },
};

export const BUTTON_LABEL = { one: '1 CUP', two: '2 CUP', power: 'POWER', dose: 'DOSE', filter: 'FILTER' };
export const KEY_TO_BUTTON = { '1 CUP': 'one', '2 CUP': 'two', POWER: 'power', DOSE: 'dose', FILTER: 'filter' };

export const DIAL_ANGLE = { left: -55, standby: 0, right: 55 };

const clamp01 = (v) => Math.min(1, Math.max(0, v));

/** Gauge needle angle: 0 → −120°, 1 → +120°. */
export const gaugeAngle = (v) => -120 + 240 * clamp01(v);

/** Tank water surface y for a volume in litres (MAX = 2 L). */
export const tankY = (litres) => M.tank.bottom - (clamp01(litres / 2) * (M.tank.bottom - M.tank.max));

/** The portafilter's translate for each position (art is drawn at the group). */
export const PF_OFFSET = {
  group: { x: 0, y: 0 },
  cradle: { x: M.cradle.x - M.pfGroup.x, y: M.cradle.y - M.pfGroup.y },
  out: { x: 0, y: 60 },
};

/** Jug liquid rect for a 0..1 level (jug interior is y 4..40). */
export const fillAttr = (level) => {
  const h = 36 * Math.min(1, Math.max(0, level));
  return { y: 40 - h, height: h + 1 };
};
