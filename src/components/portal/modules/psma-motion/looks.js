/* ============================================================================
   PSMA MOTION — LOOKS
   ----------------------------------------------------------------------------
   Fixed stage palettes (deliberately not portal theme tokens, as PortaraMotion
   does) so the clips render identically in every portal theme. Two looks were
   drafted; `LOOKS[DEFAULT_LOOK]` is the one the clips use.

   The clips use the dark stage. The critics split: C3 preferred the light
   clinical look, C2 measured the dark one as more legible on a projector (the
   verdict colours reach 4.8-14:1 against the stage, and on a light ground all
   three classes would have to be dark, so they could not differ in lightness).
   The dark look takes C3's fixes for its weak points: the heat ramp ends on a
   mid-lightness orange, not on the PET's own white; the PET gets a highlight
   shoulder and the scan is dimmed under the masks; the ground-truth ring is
   two-tone. Round 2: the scan stays at dim 0.6 or darker whenever masks show
   (C2: uptake must not land between the fill colours), 0.7 under the heat.
   Review log, "Look".

   Colour has one job per family:
     white / ink      text, PET uptake, the ground-truth outline
     gold             process: the sliding window, the depth inset, Mamba,
                      the size filter's rings
     orange ramp      probability (beat 2 only)
     sky blue         model output only: the thresholded map, the prediction,
                      regions that touch a lesion
     vermillion       missed lesions        (Okabe-Ito; lightness 0.22)
     yellow           false alarms          (Okabe-Ito; lightness 0.74)
     warm grey        anatomy (bone, body)
   Found / missed / false alarm differ in lightness as well as hue (0.41 / 0.22 /
   0.74) and each has its own marker shape: circle / dashed square / diamond.
   ========================================================================== */

const rgb = (hex) => {
  const v = parseInt(hex.slice(1), 16);
  return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
};

export const LOOKS = {
  dark: {
    id: 'dark',
    label: 'Dark stage',
    bg: '#0B1220',
    ink: '#F4F6FA',
    ink2: '#C9D2E3',
    muted: '#93A0B8',
    rule: '#D6B12B',
    gold: '#D6B12B',
    accent: '#7FA3FF',
    panel: '#111B30',
    panelBorder: '#2A3754',
    convFill: '#111B30',
    convStroke: '#C9D2E3',
    mambaFill: '#3A3218',
    dims: { model: 0.7, masks: 0.6, card: 0.6 },
    gl: {
      bg: rgb('#0B1220'),
      body: rgb('#1C2944'),          // body envelope, shaded by thickness
      bone: rgb('#A69C8C'),          // warm grey
      petInk: rgb('#EEF1F6'),        // uptake, a touch under white so organs do not bloom
      petInvert: 0,
      prob: [rgb('#3B0F70'), rgb('#B5367A'), rgb('#F28E2B')], // heat ramp, ends at mid lightness
      pred: rgb('#56B4E9'),
      removed: rgb('#D6B12B'),       // specks the size filter removes (process gold)
      predEdge: rgb('#0B1220'),      // 2 px keyline round every fill
      gtRing: rgb('#FFFFFF'),        // two-tone: white inside, keyline outside
      gtRingOuter: rgb('#0B1220'),
      found: rgb('#56B4E9'),
      missed: rgb('#D55E00'),
      falseAlarm: rgb('#F0E442'),
      window: rgb('#D6B12B'),
    },
    verdict: { found: '#56B4E9', missed: '#D55E00', falseAlarm: '#F0E442' },
    marker: { found: '#56B4E9', missed: '#D55E00', falseAlarm: '#F0E442',
      pred: '#56B4E9', removed: '#D6B12B', gt: '#FFFFFF', halo: 'rgba(11,18,32,0.95)' },
    windowStroke: '#D6B12B',
    windowHalo: 'rgba(11,18,32,0.9)',
    windowGlow: 'rgba(214,177,43,0.22)',
  },

  /* Clinical: inverted grey PET, dark uptake on paper (the reading-room MIP).
     Kept as the drafted alternative (?look=clinical); not used for the clips. */
  clinical: {
    id: 'clinical',
    label: 'Clinical light',
    bg: '#F7F5F0',
    ink: '#0D286A',
    ink2: '#33415C',
    muted: '#5B6A83',
    rule: '#D6B12B',
    gold: '#B8941A',
    accent: '#214099',
    panel: '#FFFFFF',
    panelBorder: '#DDD8CC',
    convFill: '#FFFFFF',
    convStroke: '#33415C',
    mambaFill: '#F3E7BE',
    dims: { model: 0, masks: 0.3, card: 0.15 },
    gl: {
      bg: rgb('#F7F5F0'),
      body: rgb('#E6E1D6'),
      bone: rgb('#6E685E'),
      petInk: rgb('#0B0F18'),
      petInvert: 1,
      prob: [rgb('#FFE6A3'), rgb('#F28E2B'), rgb('#B2182B')],
      pred: rgb('#0072B2'),
      removed: rgb('#B8941A'),
      predEdge: rgb('#FFFFFF'),
      gtRing: rgb('#0D286A'),
      gtRingOuter: rgb('#FFFFFF'),
      found: rgb('#0072B2'),
      missed: rgb('#CC79A7'),
      falseAlarm: rgb('#E69F00'),
      window: rgb('#B8941A'),
    },
    verdict: { found: '#0072B2', missed: '#CC79A7', falseAlarm: '#E69F00' },
    marker: { found: '#0072B2', missed: '#CC79A7', falseAlarm: '#E69F00',
      pred: '#0072B2', removed: '#B8941A', gt: '#1B2235', halo: 'rgba(247,245,240,0.95)' },
    windowStroke: '#B8941A',
    windowHalo: 'rgba(27,34,53,0.85)',
    windowGlow: 'rgba(184,148,26,0.22)',
  },
};

export const DEFAULT_LOOK = 'dark';
