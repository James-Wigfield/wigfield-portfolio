/* ============================================================================
   PROJECTOR LIFE — params: the one source of truth for every control
   ----------------------------------------------------------------------------
   Every control on the Visualiser is generated from PARAMS. A def is
     { key, label, group, type, default, min?, max?, step?, unit?, digits?,
       options?, hint?, projector?, section? }
   type: 'range' | 'int' | 'toggle' | 'select'
   Keys are flat dotted strings ('room.apex', 'p0.throw') so a preset is just
   a partial { key: value } object and the MCP preview can diff against the
   defaults. Keys are a CONTRACT (CONTRACTS.md §6): the engine reads them by
   name. Labels, ranges and ordering may change; renaming a key needs the lead.

   Per-patch region params ('region.<patchId>.on|type|system') are generated
   from the room's patch list by regionParams().
   ========================================================================== */

export const GROUPS = [
  { id: 'room', label: 'Room' },
  { id: 'projectors', label: 'Projectors' },
  { id: 'mapping', label: 'Mapping' },
  { id: 'life', label: 'Life' },
  { id: 'creatures', label: 'Creatures' },
  { id: 'aids', label: 'Visual aids' },
];

export const SYSTEMS = [
  { value: 'off', label: 'Off (black)' },
  { value: 'grayscott', label: 'Gray-Scott (coral)' },
  { value: 'physarum', label: 'Physarum (slime)' },
  { value: 'particlelife', label: 'Particle Life' },
  { value: 'lenia', label: 'Lenia' },
];

export const PALETTES = [
  { value: 'neon', label: 'Neon' },
  { value: 'ember', label: 'Ember' },
  { value: 'aurora', label: 'Aurora' },
  { value: 'bio', label: 'Bioluminescent' },
  { value: 'mono', label: 'White light' },
];

export const ASPECTS = [
  { value: '16:9', label: '16:9' },
  { value: '16:10', label: '16:10' },
  { value: '4:3', label: '4:3' },
];

/** Typical throw ratios (distance ÷ image width). Not the mate's model. */
export const THROW_PRESETS = [
  { label: 'Standard', value: 1.5, note: 'typical standard throw' },
  { label: 'Short', value: 0.5, note: 'typical short throw' },
  { label: 'Ultra-short', value: 0.25, note: 'typical ultra-short throw' },
];

/* `short` is the stage-overlay button text; `label` is its tooltip / aria. */
export const CAMERA_VIEWS = [
  { value: 'cutaway', label: 'Cutaway ¾', short: 'Cutaway' },
  { value: 'door', label: 'At the door', short: 'Door' },
  { value: 'armchair', label: 'In the armchair', short: 'Armchair' },
  { value: 'loft', label: 'On the loft, looking up', short: 'Loft' },
  { value: 'projector', label: "Projector's view", short: 'Projector' },
  { value: 'plan', label: 'Top-down plan', short: 'Plan' },
];

const R = (key, label, group, def, min, max, step, extra = {}) => ({ key, label, group, type: 'range', default: def, min, max, step, ...extra });
const I = (key, label, group, def, min, max, extra = {}) => ({ key, label, group, type: 'int', default: def, min, max, step: 1, ...extra });
const T = (key, label, group, def, extra = {}) => ({ key, label, group, type: 'toggle', default: def, ...extra });
const S = (key, label, group, def, options, extra = {}) => ({ key, label, group, type: 'select', default: def, options, ...extra });

/** Default pose of each projector (index 0..2). Inside the room, metres/degrees. */
// Found with the occlusion-aware coverage readout (projection/NOTES.md, "Placement
// search"); all three sit ≥ 15 cm under the 3.3 m roof. Coverage, masks on:
//   p0 alone 34.5 % (floor 19 · walls 42 · roof 37; 43 % of what the cutaway shows)
//   p0 + p1  61.3 % (28 · 71 · 73)      p0 + p1 + p2  72.2 % (58 · 80 · 73)
const PROJ_DEFAULTS = [
  // Over the loft's south end, aiming NNE across the room into the half the cutaway camera sees.
  { x: 1.35, y: 2.05, z: 3.9, yaw: 22.5, pitch: -12, roll: 0, throw: 0.5, on: true },
  // High on the north wall above the armchair, aiming SSW: the loft walls and most of the roof.
  { x: 2.2, y: 2.3, z: 0.5, yaw: -157.5, pitch: -12, roll: 0, throw: 0.5, on: true },
  // High in the NE, steeply down: mostly buys floor.
  { x: 3.9, y: 2.3, z: 1.78, yaw: -135, pitch: -60, roll: 0, throw: 0.5, on: true },
];

function projectorParams(i) {
  const d = PROJ_DEFAULTS[i];
  const g = 'projectors';
  const section = `Projector ${i + 1}`;
  const p = (def) => ({ ...def, projector: i, section });
  return [
    p(R(`p${i}.x`, 'Position x (east)', g, d.x, 0.25, 4.11, 0.01, { unit: 'm', digits: 2 })),
    p(R(`p${i}.y`, 'Height', g, d.y, 0.1, 4.0, 0.01, { unit: 'm', digits: 2 })),
    p(R(`p${i}.z`, 'Position z (south)', g, d.z, 0.25, 4.11, 0.01, { unit: 'm', digits: 2 })),
    p(R(`p${i}.yaw`, 'Aim — heading', g, d.yaw, -180, 180, 1, { unit: '°', digits: 0, hint: '0 = north, 90 = east · or drag the aim dot' })),
    p(R(`p${i}.pitch`, 'Aim — tilt', g, d.pitch, -90, 90, 1, { unit: '°', digits: 0, hint: '+ looks up' })),
    p(R(`p${i}.roll`, 'Roll', g, d.roll, -45, 45, 1, { unit: '°', digits: 0 })),
    p(R(`p${i}.throw`, 'Throw ratio', g, d.throw, 0.2, 2.5, 0.01, { digits: 2, hint: 'distance ÷ image width' })),
    p(S(`p${i}.aspect`, 'Aspect', g, '16:9', ASPECTS)),
    p(R(`p${i}.brightness`, 'Brightness', g, 1, 0, 2, 0.01, { digits: 2 })),
    p(R(`p${i}.black`, 'Black level', g, 0.025, 0, 0.2, 0.001, { digits: 3, hint: 'glow a real projector throws for black' })),
  ];
}

export const PARAMS = [
  // ── Room ──────────────────────────────────────────────────────────────────
  R('room.apex', 'Roof apex height', 'room', 3.3, 2.7, 4.2, 0.01, { unit: 'm', digits: 2, hint: 'steeper roof = more slide, less peel' }),
  T('room.furniture', 'Show furniture', 'room', true),
  T('room.loft', 'Show loft', 'room', true),
  T('room.cutaway', 'Fade near walls (cutaway)', 'room', true),
  R('room.ambient', 'Room lights', 'room', 0.14, 0, 1, 0.01, { digits: 2, hint: '0 = pitch dark, 1 = the baked night look' }),
  T('room.oldRoof', 'Show the old low roof', 'room', false),

  // ── Projectors ────────────────────────────────────────────────────────────
  I('proj.count', 'Projectors', 'projectors', 1, 1, 3),
  T('proj.frustum', 'Show frustum', 'projectors', true),
  T('proj.coverage', 'Coverage view', 'projectors', false, { hint: 'colour = how many projectors reach a surface' }),
  T('proj.occlusion', 'Occlusion (projection shadows)', 'projectors', true, { hint: 'loft and furniture cast shadows' }),
  T('proj.pixels', 'Pixel-size view', 'projectors', false, { hint: 'projector pixels per metre where they land' }),
  S('proj.res', 'Resolution', 'projectors', '1920', [
    { value: '1280', label: '720p' },
    { value: '1920', label: '1080p' },
    { value: '3840', label: '4K' },
  ], { hint: '1280 / 1920 / 3840 px wide' }),
  ...projectorParams(0),
  ...projectorParams(1),
  ...projectorParams(2),

  // ── Mapping ───────────────────────────────────────────────────────────────
  S('map.mode', 'Mapping', 'mapping', 'mapped', [
    { value: 'mapped', label: 'Mapped' },
    { value: 'raw', label: 'Raw' },
  ], { hint: 'raw = one flat rectangle, warped by the corners' }),
  T('map.mask.door', 'Mask the door', 'mapping', true),
  T('map.mask.window', 'Mask the window', 'mapping', true),
  T('map.mask.loft', 'Mask the loft', 'mapping', true),
  T('map.mask.furniture', 'Mask furniture', 'mapping', true),

  // ── Life ──────────────────────────────────────────────────────────────────
  S('life.sys.floor', 'Floor runs', 'life', 'physarum', SYSTEMS, { section: 'Systems' }),
  S('life.sys.wall', 'Walls run', 'life', 'grayscott', SYSTEMS, { section: 'Systems' }),
  S('life.sys.ceiling', 'Roof runs', 'life', 'particlelife', SYSTEMS, { section: 'Systems' }),
  S('life.gsPreset', 'Gray-Scott preset', 'life', 'worms', [
    { value: 'worms', label: 'Rain (worms)' },
    { value: 'mitosis', label: 'Droplets (mitosis)' },
    { value: 'coral', label: 'Coral (fills, then streaks)' },
    { value: 'front', label: 'Front (one line)' },
  ], { section: 'Presets', hint: 'with drift on, rain and droplets run down the walls' }),
  S('life.physPreset', 'Physarum preset', 'life', 'network', [
    { value: 'network', label: 'Network' },
    { value: 'veins', label: 'Long veins' },
    { value: 'rings', label: 'Rings (one per surface)' },
  ], { section: 'Presets' }),
  S('life.plPreset', 'Particle Life preset', 'life', 'cells', [
    { value: 'cells', label: 'Cells (shelled)' },
    { value: 'chasers', label: 'Chasers (chase cycle)' },
    { value: 'swarm', label: 'Diatoms (rings)' },
  ], { section: 'Presets' }),
  S('life.leniaPreset', 'Lenia preset', 'life', 'labyrinth', [
    { value: 'labyrinth', label: 'Labyrinth' },
    { value: 'soup', label: 'Soup' },
    { value: 'bubbles', label: 'Bubbles' },
  ], { section: 'Presets' }),
  R('life.speed', 'Sim speed', 'life', 1, 0, 3, 0.05, { digits: 2, section: 'Time', hint: 'heavy settings slow down rather than stall' }),
  I('life.substeps', 'Substeps', 'life', 1, 1, 4, { section: 'Time', hint: 'more sim work per 30 Hz tick' }),
  R('life.gravity', 'Gravity strength', 'life', 1, 0, 2, 0.01, { digits: 2, section: 'Gravity', hint: 'scales drift, geotaxis and the Particle Life slide and peel' }),
  R('life.drift', 'Gray-Scott drift along g', 'life', 0.35, 0, 1, 0.01, { digits: 2, section: 'Gravity', hint: 'drips down walls, creeps down the roof with its pitch, none on the floor' }),
  S('life.geoSign', 'Physarum geotaxis', 'life', 'down', [
    { value: 'down', label: 'Sinks' },
    { value: 'up', label: 'Climbs' },
  ], { section: 'Gravity' }),
  R('life.geotaxis', 'Geotaxis strength', 'life', 0.3, 0, 1, 0.01, { digits: 2, section: 'Gravity', hint: 'how hard slime turns down (or up) a wall' }),
  T('life.seams', 'Cross seams', 'life', true, { section: 'Space', hint: 'wall → roof at the eave, wall → wall at corners' }),
  R('life.ppm', 'Sim resolution', 'life', 40, 16, 64, 4, { unit: 'px/m', section: 'Space', hint: 'one scale everywhere, so life keeps its size' }),
  S('life.gsPalette', 'Gray-Scott palette', 'life', 'aurora', PALETTES, { section: 'Palettes' }),
  S('life.physPalette', 'Physarum palette', 'life', 'bio', PALETTES, { section: 'Palettes' }),
  S('life.plPalette', 'Particle Life palette', 'life', 'neon', PALETTES, { section: 'Palettes' }),
  S('life.leniaPalette', 'Lenia palette', 'life', 'ember', PALETTES, { section: 'Palettes' }),

  // ── Creatures (Plate VII prototype) ───────────────────────────────────────
  T('cr.on', 'Creatures', 'creatures', true),
  I('cr.floor', 'Population — floor', 'creatures', 10, 0, 60, { section: 'Population' }),
  I('cr.wall', 'Population — walls', 'creatures', 14, 0, 60, { section: 'Population' }),
  I('cr.ceiling', 'Population — roof', 'creatures', 10, 0, 60, { section: 'Population' }),
  I('cr.feet', 'Feet (starting mean)', 'creatures', 6, 2, 8, { section: 'Body', hint: "each creature's gene adds or drops a foot or two" }),
  R('cr.grip', 'Grip strength', 'creatures', 1, 0, 2, 0.01, { digits: 2, section: 'Body', hint: "× each creature's gene; live, so evolution keeps its gains" }),
  R('cr.mass', 'Mass', 'creatures', 1, 0.2, 3, 0.01, { digits: 2, section: 'Body', hint: "× each creature's gene" }),
  R('cr.swing', 'Swing length', 'creatures', 0.22, 0.05, 0.6, 0.01, { unit: 'm', digits: 2, section: 'Body', hint: 'arm of the pendulum hang on the roof' }),
  R('cr.flight', 'Free-flight time', 'creatures', 0.2, 0, 0.8, 0.01, { unit: 's', digits: 2, section: 'Body', hint: 'longer flights travel further but drop out of reach of the next grip' }),
  R('cr.gscale', 'Gravity scale', 'creatures', 1, 0, 3, 0.01, { digits: 2, section: 'Body', hint: 'creature world runs at 0.3 g × this, so swings read on a wall' }),
  T('cr.selection', 'Selection (death + mutation)', 'creatures', true, { section: 'Evolution', hint: 'falls, hunger and age kill; off = everyone lives' }),
  R('cr.mutation', 'Mutation rate', 'creatures', 0.08, 0, 0.5, 0.005, { digits: 3, section: 'Evolution', hint: 'spread of the genes a parent passes on' }),
  T('cr.detritus', 'Detritus food web', 'creatures', true, { section: 'Evolution', hint: 'the dead and the roof’s waste fall and feed floor scavengers' }),
  T('cr.showAir', 'Show mid-air bodies', 'creatures', true, { section: 'Evolution', hint: 'off = what the real projection shows' }),

  // ── Visual aids ───────────────────────────────────────────────────────────
  T('aid.gravity', 'Gravity arrows', 'aids', false, { hint: 'g_t arrow, g_n ring' }),
  T('aid.seams', 'Seam lines', 'aids', false),
  T('aid.labels', 'Patch labels', 'aids', false),
  T('aid.projInset', 'Projector-output inset', 'aids', true),
  T('aid.netInset', 'Unfolded-room inset', 'aids', true),
  T('aid.fps', 'FPS readout', 'aids', true),
];

export const PARAM_BY_KEY = Object.fromEntries(PARAMS.map((p) => [p.key, p]));

/** Region params for one patch (generated from the room's patch list). */
export function regionParams(patchId) {
  return [
    { key: `region.${patchId}.on`, label: 'On', group: 'mapping', type: 'toggle', default: true, region: patchId },
    {
      key: `region.${patchId}.type`, label: 'Surface type', group: 'mapping', type: 'select', default: 'auto', region: patchId,
      options: [{ value: 'auto', label: 'Auto (from normal)' }, { value: 'floor', label: 'Floor' }, { value: 'wall', label: 'Wall' }, { value: 'ceiling', label: 'Ceiling' }],
    },
    {
      key: `region.${patchId}.system`, label: 'System', group: 'mapping', type: 'select', default: 'auto', region: patchId,
      options: [{ value: 'auto', label: 'By surface type' }, ...SYSTEMS],
    },
  ];
}

/** Defaults for every static key (region keys default lazily to their def). */
export function defaults() {
  const out = {};
  for (const p of PARAMS) out[p.key] = p.default;
  return out;
}

/** Read a value with the right fallback for region keys. */
export function readParam(values, key) {
  if (key in values) return values[key];
  const m = /^region\.([^.]+)\.(on|type|system)$/.exec(key);
  if (m) return m[2] === 'on' ? true : 'auto';
  return PARAM_BY_KEY[key]?.default;
}

/** Clamp/validate a single value against its def (unknown keys pass through). */
export function coerce(key, value) {
  const d = PARAM_BY_KEY[key];
  if (!d) return value;
  if (d.type === 'toggle') return !!value;
  if (d.type === 'select') return d.options.some((o) => o.value === value) ? value : d.default;
  const n = Number(value);
  if (!Number.isFinite(n)) return d.default;
  const c = Math.min(d.max, Math.max(d.min, n));
  return d.type === 'int' ? Math.round(c) : c;
}
