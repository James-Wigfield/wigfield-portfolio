/* ============================================================================
   PROJECTOR LIFE — projection legends (no three.js: safe for the React shell
   to import statically for the coverage / pixel-view legends)
   ========================================================================== */

/** Identity colour per projector (frustum lines, the lens, legends). */
export const PROJECTOR_COLORS = ['#ffd27a', '#7ad7ff', '#ff8ad8'];

/** Coverage view: colour = how many projectors reach a surface (occlusion-aware). */
export const COVERAGE_LEGEND = [
  { count: 0, label: 'Not reached (room, dimmed)', color: '#3b3934' },
  { count: 1, label: '1 projector', color: '#2fbf71' },
  { count: 2, label: '2 projectors', color: '#2f8fe0' },
  { count: 3, label: '3 projectors', color: '#b07cff' },
];

/** Pixel view: a grid line every GRID_PX projector pixels, coloured by local px/m (log ramp). */
export const GRID_PX = 32;
export const PIXEL_LEGEND = [
  { pxPerM: 100, label: '1 cm pixels', color: '#f2402f' },
  { pxPerM: 215, label: '4.6 mm', color: '#ffbf33' },
  { pxPerM: 465, label: '2.2 mm', color: '#4de566' },
  { pxPerM: 1000, label: '1 mm pixels', color: '#4dccff' },
];
