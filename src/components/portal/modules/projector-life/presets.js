/* ============================================================================
   PROJECTOR LIFE — presets (one click = one hero shot)
   ----------------------------------------------------------------------------
   PRESETS = [{ id, name, blurb, camera, values, open?, compare? }]
     values   partial overrides of params.js defaults() (Stage.replace adds the
              defaults back, so anything a preset doesn't mention is default)
     camera   a CAMERA_VIEWS value the stage moves to
     open     panel groups to open when applied (e.g. ['creatures'] shows the
              trait histograms)
     compare  show the on-stage "Coverage · Raw · Mapped" switch
   The FIRST preset is the default scene the tab opens on, and "Reset" goes
   back to it.

   Projector poses live in RIGS so they are one edit away. They were chosen
   by probing the live Stage's coverage readout (occlusion on, apex 3.3 m
   unless noted; % of surface area: floor / walls / roof → total) on
   2026-11-18 — re-probe if the room or projection model changes.
   Frame: metres, x east, z south, y up, centre (2.18, ·, 2.18); yaw 0 = north,
   90 = east; pitch + looks up (params.js).
   ========================================================================== */

/** { x, y, z, yaw, pitch, roll, throw } → { 'p<i>.x': …, … } */
function pose(i, p) {
  const out = {};
  for (const [k, v] of Object.entries(p)) out[`p${i}.${k}`] = v;
  return out;
}

export const RIGS = {
  // The hero rig (lead, 2026-11-18): SE corner at 2.1 m, heading NNW, tilted
  // 22° down, throw 0.35. Searched for the share of what the CUTAWAY camera
  // shows (walls SW–NE, their roof facets, floor, loft) with every habitat in
  // play: 50 % of the visible half (floor 39 · walls 55 · roof 60); room-wide
  //                                                     31 / 41 / 41 → 39 %
  seHero: { x: 3.3, y: 2.1, z: 3.7, yaw: -22.5, pitch: -22, roll: 0, throw: 0.35 },
  // High in the SE corner, looking NW across the room at the half the cutaway
  // camera sees.                                        5 / 27 / 39 → 26 %
  seShort: { x: 3.45, y: 2.15, z: 3.45, yaw: -45, pitch: -12, roll: 0, throw: 0.5 },
  // Above the door, a typical STANDARD-throw lens aimed at the N wall: a
  // small picture that folds across the N / NE / NW corners when raw.
  //                                                      0 / 11 / 6 → 7 %
  sStandard: { x: 2.18, y: 2.1, z: 3.9, yaw: 0, pitch: -5, roll: 0, throw: 1.5 },
  // Ultra-short throw on the floor, east of centre (clear of the loft's
  // shadow), looking straight up: the roof.   apex 4.0: 0 / 18 / 85 → 39 %
  floorUp: { x: 2.9, y: 0.4, z: 2.18, yaw: 0, pitch: 89, roll: 0, throw: 0.25 },
  // Ultra-short throw under the apex, looking straight down: the floor.
  //                                                     49 / 19 / 0 → 20 %
  centreDown: { x: 2.18, y: 2.2, z: 2.18, yaw: 0, pitch: -89, roll: 0, throw: 0.25 },
  // Ultra-short throw (4:3) on a 1 m stand under the apex, looking straight
  // up: the whole roof lit, and closer than floorUp so it's bright enough.
  roofStand: { x: 2.18, y: 1.0, z: 2.18, yaw: 0, pitch: 89, roll: 0, throw: 0.25 },
  // Opposite corners at the eave, short throw, tilted down 10°: the best
  // two-projector placement found.                     17 / 71 / 88 → 63 %
  // (+ centreDown as a third projector:                 53 / 73 / 95 → 76 %)
  neCorner: { x: 3.65, y: 2.2, z: 0.75, yaw: -135, pitch: -10, roll: 0, throw: 0.5 },
  swCorner: { x: 0.75, y: 2.2, z: 3.65, yaw: 45, pitch: -10, roll: 0, throw: 0.5 },
  // SE corner aimed level, paired with centreDown: floor and roof both lit
  // for the food web.                                   52 / 45 / 53 → 50 %
  seLevel: { x: 3.5, y: 2.1, z: 3.5, yaw: -45, pitch: 0, roll: 0, throw: 0.5 },
};

export const PRESETS = [
  {
    id: 'living-shed',
    name: 'The living shed',
    blurb: 'Slime on the floor, coral on the walls, particles on the roof — one projector, creatures on.',
    camera: 'cutaway',
    values: {
      'room.apex': 3.3,
      'room.ambient': 0.05,
      'proj.count': 1,
      ...pose(0, RIGS.seHero),
      'p0.brightness': 1.8,
      // frustum rays slashed across the hero (visual critic): the mounted
      // body says where the projector is; the Projectors group turns rays on
      'proj.frustum': false,
      'map.mode': 'mapped',
      'life.gsPalette': 'ember', // warm walls between the cyan floor and the neon roof
      'life.sys.floor': 'physarum',
      'life.sys.wall': 'grayscott',
      'life.sys.ceiling': 'particlelife',
      'life.drift': 0.35,
      'cr.on': true,
    },
  },
  {
    id: 'slime-mould',
    name: 'Slime-mould shed',
    blurb: 'Physarum on every surface, crossing the seams from wall to roof to floor.',
    camera: 'armchair',
    values: {
      'proj.count': 3,
      ...pose(0, RIGS.neCorner),
      ...pose(1, RIGS.swCorner),
      ...pose(2, RIGS.centreDown),
      'proj.frustum': false,
      'room.ambient': 0.03,
      'life.sys.floor': 'physarum',
      'life.sys.wall': 'physarum',
      'life.sys.ceiling': 'physarum',
      'life.physPreset': 'network',
      'life.physPalette': 'bio',
      'life.geoSign': 'down',
      'life.geotaxis': 0.25,
      'life.seams': true,
      'aid.seams': true,
      'cr.on': false,
    },
  },
  {
    id: 'coral-drip',
    name: 'Coral walls, dripping',
    blurb: 'Gray-Scott with drift along gravity: patterns run down the walls like rain on glass.',
    camera: 'door',
    values: {
      'proj.count': 1,
      ...pose(0, RIGS.seHero),
      'proj.frustum': false,
      'life.sys.floor': 'grayscott',
      'life.sys.wall': 'grayscott',
      'life.sys.ceiling': 'grayscott',
      // "Rain" (worms) seeds nuclei along each wall's top edge while drift is
      // on, and 2.2× speed × 2 substeps has it dripping within ~7 s of the
      // click (coral proper took 30–45 s to fill — QA, 2026-11-18).
      'life.gsPreset': 'worms',
      'life.gsPalette': 'ember', // warm coral (aurora's pink + green read as colour fringing)
      'life.drift': 0.8,
      'life.speed': 2.2,
      'life.substeps': 2,
      'room.ambient': 0.05,
      'p0.brightness': 1.8,
      'cr.on': false,
    },
  },
  {
    id: 'ceiling-swingers',
    name: 'Ceiling swingers',
    blurb: 'A steep roof, weak grip: creatures hang, swing, let go — and some of them fall.',
    camera: 'loft', // lying on the loft looking up: the hanging bodies on their arms read best here (visual critic)
    values: {
      'room.apex': 4.0,
      'room.ambient': 0.05,
      'proj.count': 1,
      ...pose(0, RIGS.roofStand),
      'p0.aspect': '4:3',
      'p0.brightness': 2.5,
      'proj.frustum': false,
      'life.sys.floor': 'physarum',
      'life.sys.wall': 'grayscott',
      // roof background off: the creatures are the only thing up there (the
      // grey droplets read as smudges — visual critic); creatures still draw
      // on an 'off' patch
      'life.sys.ceiling': 'off',
      'life.physPalette': 'ember',
      'cr.on': true,
      'cr.ceiling': 40,
      'cr.wall': 8,
      'cr.floor': 6,
      // Selection OFF: immigrants keep the roof topped up, so the falls are a
      // steady show. With selection on, falls outran births and the roof
      // emptied to 1–2 swingers within a minute (QA, 2026-11-18).
      'cr.selection': false,
      'cr.grip': 0.7,
      'cr.swing': 0.32,
      'cr.flight': 0.25,
      'cr.showAir': true,
    },
  },
  {
    id: 'food-web',
    name: 'Room food web',
    blurb: 'Selection on: the roof drops bodies, the floor eats them, lineages split by surface.',
    camera: 'cutaway',
    open: ['creatures'],
    values: {
      'proj.count': 2,
      ...pose(0, RIGS.seLevel),
      ...pose(1, RIGS.centreDown),
      'proj.frustum': false,
      'room.ambient': 0.05,
      'life.sys.floor': 'physarum',
      'life.sys.wall': 'grayscott',
      'life.sys.ceiling': 'off',
      'life.physPalette': 'ember',
      'cr.on': true,
      'cr.floor': 24,
      'cr.wall': 24,
      'cr.ceiling': 24,
      'cr.selection': true,
      'cr.mutation': 0.12,
      'cr.detritus': true,
      'cr.showAir': true,
    },
  },
  {
    id: 'reality-check',
    name: 'Projector reality check',
    blurb: 'One typical standard-throw projector: how little it covers, and why mapping matters.',
    camera: 'cutaway',
    compare: true,
    open: ['projectors'],
    values: {
      'proj.count': 1,
      ...pose(0, RIGS.sStandard),
      'proj.frustum': true,
      'proj.coverage': true,
      'proj.occlusion': true,
      'map.mode': 'raw',
      'cr.on': true,
      'aid.projInset': true,
    },
  },
  {
    id: 'two-projector',
    name: 'Two-projector rig',
    blurb: 'Two short-throw projectors in opposite corners at the eave: the best placement found, about two-thirds of the room lit.',
    camera: 'cutaway',
    open: ['projectors'],
    values: {
      'proj.count': 2,
      ...pose(0, RIGS.neCorner),
      ...pose(1, RIGS.swCorner),
      'proj.frustum': true,
      'life.sys.floor': 'physarum',
      'life.sys.wall': 'grayscott',
      'life.sys.ceiling': 'particlelife',
      'cr.on': true,
    },
  },
];

export const DEFAULT_PRESET = PRESETS[0];
export const PRESET_BY_ID = Object.fromEntries(PRESETS.map((p) => [p.id, p]));
