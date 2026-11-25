/* How big a walker is, in metres: ONE place for the sprites (characters.js), the first-person camera
   (WalkGame.js) and the walk checks (2026-11-25, DECISIONS 218).

   The PixelLab travellers are chibi: the head is about a third of the body and as wide as the shoulders.
   Drawn 1.75 m from feet to the top of the head they read as giants next to a 2.04 m door (a 0.55 m head);
   at 1.55 m the body is an adult's width and the head tops out at three quarters of the door. Checked by eye
   against the example bedroom's door (memory-rooms-work/_dev/sprite-size.mjs).

   The first-person eye sits ~10 cm under the sprite's crown (where an adult's eyes are), so your camera is
   inside the head the others see; seated, ~1.0 m. */

export const HEIGHT_M = 1.55;
export const EYE_M = 1.45;
export const SIT_EYE_M = 1.0;
