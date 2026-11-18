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
  measured: false,
  date: null, // 'YYYY-MM-DD'
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

    // ── measured (lead fills) ──
    { id: 'fps-default', source: 'measured', label: 'Frame rate, default scene', value: null, unit: 'fps', digits: 0, note: 'target ≥ 45' },
    { id: 'fps-heavy', source: 'measured', label: 'Frame rate, heaviest preset', value: null, unit: 'fps', digits: 0, note: '' },
    { id: 'cov-std', source: 'measured', label: 'One standard-throw projector covers', value: null, unit: '%', digits: 0, note: 'all surfaces, occlusion on' },
    { id: 'cov-short', source: 'measured', label: 'One short-throw projector covers', value: null, unit: '%', digits: 0, note: 'SE corner, aimed NW' },
    { id: 'cov-two', source: 'measured', label: 'Two-projector rig covers', value: null, unit: '%', digits: 0, note: 'opposite corners' },
    { id: 'cov-roof', source: 'measured', label: 'Roof reached by the two-projector rig', value: null, unit: '%', digits: 0, note: 'the ceiling habitat' },
  ],

  uncovered: [], // e.g. 'under the loft deck', 'the wall behind the armchair'
  takeaways: [], // 2–4 one-liners
};
