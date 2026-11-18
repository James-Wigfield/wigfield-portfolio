/* ============================================================================
   PROJECTOR LIFE — "What the visualiser showed" (Plan tab + merger-plan.md)
   ----------------------------------------------------------------------------
   THE LEAD FILLS THIS after measuring in headless Edge (d3d11) with the Stage's
   coverage readout and fps. Until then every `measured` row renders as
   "pending" on the Plan tab.

   How to fill it:
     1. set `measured: true`, `date`, `how`
     2. put real numbers in each fact's `value` (fractions 0..1 for coverage,
        plain numbers otherwise) and keep `unit` honest
     3. list the surfaces that stay dark in `uncovered`, and 2–4 one-line
        `takeaways` (they also go into Documents/projector-life/merger-plan.md
        "What the visualiser measured")
   Facts with `source: 'geometry'` are computed from the shed's measured size
   and the typical throw ratios — true now, not measurements.
   ========================================================================== */

// Geometry (CONTRACTS §1): apothem 2.18 m, flat 1.806 m wide, eave 2.25 m.
// A projector high in the SE corner (presets.js RIGS.seShort, (3.45, 3.45))
// aimed across at the far NW flat: 1.80 m to the centre + 2.18 m ≈ 4.0 m.
const CORNER_TO_FAR_FLAT = Math.hypot(3.45 - 2.18, 3.45 - 2.18) + 2.18;

export const MEASUREMENTS = {
  measured: true,
  date: '2026-11-18', // 'YYYY-MM-DD'
  how: 'headless Edge (ANGLE d3d11) on the home PC; Stage coverage readout (occlusion on) and fps',

  facts: [
    // ── computed now (geometry + typical lenses) ──
    {
      id: 'throw-one-flat',
      source: 'geometry',
      label: 'Throw ratio that fills one wall flat from the room centre',
      value: 2.18 / 1.806,
      unit: '',
      digits: 2,
      note: '2.18 m away, 1.81 m wide — between short and standard throw',
    },
    {
      id: 'std-width',
      source: 'geometry',
      label: 'Picture width, typical standard throw (1.5) across the room',
      value: CORNER_TO_FAR_FLAT / 1.5,
      unit: 'm',
      digits: 1,
      note: 'from the SE corner: about one and a half flats',
    },
    {
      id: 'short-width',
      source: 'geometry',
      label: 'Picture width, typical short throw (0.5) across the room',
      value: CORNER_TO_FAR_FLAT / 0.5,
      unit: 'm',
      digits: 1,
      note: 'wider than the room: the whole far half, corners and all',
    },

    // ── measured 2026-11-18 (lead): coverage = share of unmasked surface area
    //    lit by ≥ 1 projector, occlusion on, apex 3.3 m; "best" = best of
    //    544 single poses (17 spots × 2 heights × 16 headings × 4 tilts) ──
    { id: 'fps-default', source: 'measured', label: 'Frame rate, default scene', value: 145, unit: 'fps', digits: 0, note: 'the headless frame cap (≈ 2,100 fps uncapped); target ≥ 45' },
    { id: 'fps-heavy', source: 'measured', label: 'Frame rate, heaviest preset (Room food web)', value: 145, unit: 'fps', digits: 0, note: 'still at the cap (≈ 885 fps uncapped: ~1.1 ms a frame)' },
    { id: 'cov-std', source: 'measured', label: 'One standard-throw projector (1.5) covers, at best', value: 0.082, unit: '%', digits: 0, note: 'floor 0 · walls 6 · roof 17 — and ~700 px/m (1.4 mm pixels) is resolution the sims never use' },
    { id: 'cov-short', source: 'measured', label: 'One short-throw projector (0.5) covers, at best', value: 0.351, unit: '%', digits: 0, note: 'over the loft’s south end aiming NE: floor 11 · walls 46 · roof 40, ~220 px/m' },
    { id: 'cov-ust', source: 'measured', label: 'One ultra-short (0.25) covers, at best', value: 0.598, unit: '%', digits: 0, note: 'floor 33 · walls 63 · roof 75 — but a centred 0.25 lens is a fisheye no real UST is' },
    { id: 'cov-two', source: 'measured', label: 'Two short-throw projectors, opposite corners at the eave', value: 0.633, unit: '%', digits: 0, note: 'floor 17 · walls 71 · roof 88; only 4 % lit twice' },
    { id: 'cov-roof', source: 'measured', label: 'Roof reached by that two-projector rig', value: 0.88, unit: '%', digits: 0, note: 'the ceiling habitat is the easy one' },
    { id: 'cov-three', source: 'measured', label: '+ a third looking straight down from under the apex', value: 0.749, unit: '%', digits: 0, note: 'floor 17 → 55 %: the floor needs its own projector' },
  ],

  uncovered: [
    'the floor under and beside the loft deck (the deck shadows the west half)',
    'the floor round the furniture (armchair, trunk, duvet, wheelchair)',
    'the loft deck itself (14 % with the corner rig)',
    'the wall-SW flat behind the loft post (44 %)',
  ],
  takeaways: [
    'Short throw (~0.5) is the right lens for a 4.4 m shed; a standard-throw lens lights under a tenth of it from anywhere.',
    'Two short-throw projectors in opposite corners at the eave reach about two-thirds of the room and almost all the roof.',
    'The floor is the hard habitat: the loft and the furniture shadow it from any wall-height projector; a straight-down third projector fixes it.',
    'At 130–220 projector px per metre, the sims (40 px/m) set the detail, not the projector.',
  ],
};
