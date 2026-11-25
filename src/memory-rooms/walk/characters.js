/* The walk page's two characters: THE one file to change to swap one.

   Each is a sprite sheet + layout made by tools/memory-rooms/build-characters.mjs from a
   PixelLab export (8-direction pixel characters, low top-down view; idle = the 8 rotations,
   walk in 5 directions with the other 3 mirrored, plus wave, sit and jump facing the camera).
   Generic on purpose: two friendly travellers told apart by their jackets (blue, orange),
   not likenesses. `color` is the person's token, for their name tag. Made with PixelLab
   (pixellab.ai) on 2026-11-18. */

import blueSheet from './characters/traveller-blue.png';
import blueLayout from './characters/traveller-blue.json';
import orangeSheet from './characters/traveller-orange.png';
import orangeLayout from './characters/traveller-orange.json';
import { HEIGHT_M } from './scale.js';

export const CHARACTERS = {
  // heightM: feet to the top of the head (scale.js: 1.55 m reads as an adult beside a door; 1.75 read as a giant)
  james: { sheet: blueSheet, layout: blueLayout, heightM: HEIGHT_M, color: '--mr-person-james' },
  justin: { sheet: orangeSheet, layout: orangeLayout, heightM: HEIGHT_M, color: '--mr-person-justin' },
};

/** Frames per second of each animation. */
export const FPS = { idle: 1, walk: 10, run: 15, wave: 8, sit: 8, jump: 12 };
