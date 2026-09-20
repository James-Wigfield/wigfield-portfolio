/* House I data: the floor image, the three filters and their feature maps.
   Pure numbers, so the room file holds only the mechanism. */
import { ROOMS } from '../world/layout';

const N = ROOMS.window.n;
const K = ROOMS.window.k;
const M = N - K + 1;

/* The picture on the floor: a small temple. Bright = 1. Rows run north → south. */
export const IMAGE = [
  [0, 0, 0, 0, 0, 0, 0, 0],
  [1, 1, 1, 1, 1, 1, 1, 1],
  [0, 1, 0, 0, 0, 0, 1, 0],
  [0, 1, 0, 1, 1, 0, 1, 0],
  [0, 1, 0, 1, 1, 0, 1, 0],
  [0, 1, 0, 0, 0, 0, 1, 0],
  [1, 1, 1, 1, 1, 1, 1, 1],
  [0, 0, 0, 0, 0, 0, 0, 0],
];

/* Filters (weights[j][i], j = row/z, i = col/x). The line filters are slide 10's
   7×7 filters at 3×3 scale; the averaging filter is slide 6's. */
export const FILTERS = {
  mean: { id: 'mean', name: 'Averaging filter', slide: '6', w: [[1, 1, 1], [1, 1, 1], [1, 1, 1]], div: 9, max: 1, show: '1/9' },
  vertical: { id: 'vertical', name: 'Vertical-line filter', slide: '10', w: [[0, 1, 0], [0, 1, 0], [0, 1, 0]], div: 1, max: 3 },
  horizontal: { id: 'horizontal', name: 'Horizontal-line filter', slide: '10', w: [[0, 0, 0], [1, 1, 1], [0, 0, 0]], div: 1, max: 3 },
};

function convolve(f) {
  const out = [];
  for (let j = 0; j < M; j++) {
    const row = [];
    for (let i = 0; i < M; i++) {
      let s = 0;
      for (let b = 0; b < K; b++) for (let a = 0; a < K; a++) s += IMAGE[j + b][i + a] * f.w[b][a];
      row.push(s / f.div);
    }
    out.push(row);
  }
  return out;
}
export const MAPS = { mean: convolve(FILTERS.mean), vertical: convolve(FILTERS.vertical), horizontal: convolve(FILTERS.horizontal) };
