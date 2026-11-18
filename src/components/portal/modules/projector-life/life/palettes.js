/* ============================================================================
   PROJECTOR LIFE — palettes for projected life
   ----------------------------------------------------------------------------
   The cabinet's ramps start at #0a0a09 (a dark plate under glass). On a real
   wall that would be a grey rectangle, so every ramp here starts at PURE
   BLACK (0xff000000: the projector sends nothing) and climbs into saturated,
   bright colours that survive being multiplied by sage paint (#cfdad2).

   Each palette gives:
     ramp     scalar sims (Gray-Scott v, Physarum trail, Lenia A) → 256 LUT
     species  six caste colours for Particle Life (bright, distinct)
   Edit freely: add an entry here and its value to PALETTES in params.js.
   ========================================================================== */

import { hex, pack, ramp } from './lib/palette.js';

export const BLACK = 0xff000000;

const DEFS = {
  neon: {
    ramp: [[0, '#000000'], [0.12, '#14002e'], [0.34, '#4b10d8'], [0.56, '#1f7bff'], [0.76, '#00f0ff'], [0.92, '#9dfcff'], [1, '#ffffff']],
    species: ['#ff2bd6', '#ffe600', '#39ff14', '#00e5ff', '#a35bff', '#ff7a1a'],
  },
  ember: {
    ramp: [[0, '#000000'], [0.12, '#2a0400'], [0.32, '#8c1500'], [0.54, '#e64100'], [0.74, '#ff9a1f'], [0.9, '#ffe08a'], [1, '#fff8e6']],
    species: ['#ff3b1f', '#ff8c1a', '#ffd23f', '#fff2c4', '#ff4f8b', '#ffab7a'],
  },
  aurora: {
    ramp: [[0, '#000000'], [0.12, '#020f24'], [0.32, '#0a5a63'], [0.52, '#12d18e'], [0.72, '#8cff5a'], [0.88, '#d9a6ff'], [1, '#fbf0ff']],
    species: ['#19e39b', '#8cff4f', '#2fd3ff', '#b56bff', '#ff5ec8', '#f2fff0'],
  },
  bio: {
    ramp: [[0, '#000000'], [0.12, '#000f26'], [0.32, '#003e7a'], [0.52, '#0094d4'], [0.72, '#1effe0'], [0.88, '#b8fff4'], [1, '#ffffff']],
    species: ['#00f0ff', '#2b8cff', '#3cffb4', '#b4ff3c', '#7a5cff', '#e8ffff'],
  },
  mono: {
    ramp: [[0, '#000000'], [0.2, '#1c1c1c'], [0.5, '#7a7a7a'], [0.8, '#d6d6d6'], [1, '#ffffff']],
    species: ['#ffffff', '#cfcfcf', '#9e9e9e', '#ffffff', '#e4e4e4', '#b5b5b5'],
  },
};

export const PALETTE_IDS = Object.keys(DEFS);

const cache = new Map();

/** { lut: Uint32Array(256), species: Uint32Array(6), speciesRGB: [[r,g,b]×6] } */
export function palette(id) {
  const key = DEFS[id] ? id : 'neon';
  if (cache.has(key)) return cache.get(key);
  const d = DEFS[key];
  const speciesRGB = d.species.map(hex);
  const out = {
    id: key,
    lut: ramp(d.ramp),
    species: Uint32Array.from(speciesRGB.map(([r, g, b]) => pack(r, g, b))),
    speciesRGB,
  };
  cache.set(key, out);
  return out;
}

/** Creature glyph colours by home habitat (fixed, so lineages read at a glance). */
export const HABITAT_RGB = {
  floor: [255, 176, 0], //   amber
  wall: [0, 229, 255], //    cyan
  ceiling: [255, 61, 242], // magenta
};
export const DETRITUS_RGB = [150, 92, 40];
