/* Walk-in switches.

   THIRD_PERSON_ENABLED: third person (your own pixel character in front of a camera behind you) is HIDDEN for
   now (2026-11-25): James doesn't like the pixel character and may bring third person back later. With it off,
   walking in (a spot or a whole place) always starts in first person, there is no V key and no First / Third
   button, and leaving a photo comes back to first person. Every bit of the third-person code stays in
   WalkGame.js: flip this to true and it all comes back as it was. Other walkers still see you as your
   character. (DECISIONS 217) */

export const THIRD_PERSON_ENABLED = false;
