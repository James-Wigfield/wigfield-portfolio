/* ============================================================================
   PSMA APP GUIDE — LOOK
   ----------------------------------------------------------------------------
   Fixed stage colours and sizes (not portal theme tokens), so the film renders
   the same in every portal theme. Stage chrome follows psma-motion's dark look:
   ground #0B1220, ink #F4F6FA, gold #D6B12B (the app's own accent).

   Everything inside the app window is a capture of the app in its own colours.
   The only app colours redrawn here are the overlay legend swatches, taken
   exactly from Mamba_PSMA gui/viz.py OVERLAY_PALETTES["Green / cyan / magenta"].

   Sizes are stage pixels at 1080p. The help dialog shows the video about 0.6x
   (1200 px wide at a 1920 x 1080 window), so: captions 48 px, callout labels
   40 px (second lines 36 px), the chapter label 36 px. Nothing smaller is text.

   The bottom band is the player's: the dialog's native video controls cover
   the frame from about y 930 whenever the film is paused or hovered (critic
   C4, measured), so every caption and label ends by y 930, and the camera
   frames its subject in y 64-770, above the caption band and its scrim.
   ========================================================================== */

export const STAGE_W = 1920;
export const STAGE_H = 1080;
export const SAFE = 80;
// where the camera frames the subject; the caption band (y 770-930) sits below it
export const SUBJECT = { x: 80, y: 64, w: 1760, h: 706 };
export const TEXT_BOTTOM = 930;
// the app's own window: 1920 x 1080 CSS px, captured at device scale 2
export const APP_W = 1920;
export const APP_H = 1080;
export const CAP_SCALE = 2;
// the app's sidebar column (its own scroller; the main column scrolls separately)
export const SIDEBAR_W = 360;
// the widest shot: the whole app window inside the subject area
export const WIDE_Z = Math.min(SUBJECT.w / APP_W, SUBJECT.h / APP_H);
export const MAX_Z = 2; // never past the capture's own resolution
// the title card's logo (the app's own, cropped from a capture): 1.3x its CSS size, centred
export const LOGO_SCALE = 1.3;
export const LOGO_TOP = 236;

export const LOOK = {
  bg: '#0B1220',
  bgLift: '#13203A',
  ink: '#F4F6FA',
  ink2: '#C9D2E3',
  muted: '#93A0B8',
  gold: '#D6B12B',
  panel: '#111B30',
  panelBorder: '#2A3754',
  halo: 'rgba(11, 18, 32, 0.92)',
  // gui/viz.py OVERLAY_PALETTES["Green / cyan / magenta"], the app's default scheme
  overlay: {
    found: [46, 204, 113],
    missed: [34, 211, 238],
    falseAlarm: [255, 79, 216],
  },
  // the same colours as the app draws them: 0.6 over CT soft-tissue grey 128 (viz._blend)
  overlayOnCt: {
    found: [78, 173, 119],
    missed: [71, 177, 194],
    falseAlarm: [204, 98, 180],
  },
  // shape + word for each class: colour alone does not separate them for every viewer (C4)
  glyph: { found: '✓', missed: '○', falseAlarm: '✕' },
  dim: 0.55, // the spotlight's dimming, one value everywhere
  fonts: {
    display: "'Fraunces', Georgia, serif",
    body: "'Hanken Grotesk', system-ui, sans-serif",
    mono: "'IBM Plex Mono', ui-monospace, monospace",
  },
};

export const rgb = (c) => `rgb(${c.join(', ')})`;
