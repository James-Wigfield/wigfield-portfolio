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

export const CAMERA_VIEWS = [
  { value: 'cutaway', label: 'Cutaway ¾' },
  { value: 'door', label: 'At the door' },
  { value: 'armchair', label: 'In the armchair' },
  { value: 'loft', label: 'On the loft, looking up' },
  { value: 'projector', label: "Projector's view" },
  { value: 'plan', label: 'Top-down plan' },
];

const R = (key, label, group, def, min, max, step, extra = {}) => ({ key, label, group, type: 'range', default: def, min, max, step, ...extra });
const I = (key, label, group, def, min, max, extra = {}) => ({ key, label, group, type: 'int', default: def, min, max, step: 1, ...extra });
const T = (key, label, group, def, extra = {}) => ({ key, label, group, type: 'toggle', default: def, ...extra });
const S = (key, label, group, def, options, extra = {}) => ({ key, label, group, type: 'select', default: def, options, ...extra });

/** Default pose of each projector (index 0..2). Inside the room, metres/degrees. */
const PROJ_DEFAULTS = [
  // On the loft rail, looking across and down at the E/SE walls and floor.
  { x: 1.35, y: 2.05, z: 2.2, yaw: 95, pitch: -18, roll: 0, throw: 0.5, on: true },
  { x: 3.6, y: 2.0, z: 3.5, yaw: -55, pitch: -15, roll: 0, throw: 0.5, on: true },
  { x: 2.18, y: 0.35, z: 2.18, yaw: 0, pitch: 80, roll: 0, throw: 0.5, on: true },
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
    p(R(`p${i}.yaw`, 'Aim — heading', g, d.yaw, -180, 180, 1, { unit: '°', hint: '0 = north, 90 = east' })),
    p(R(`p${i}.pitch`, 'Aim — tilt', g, d.pitch, -90, 90, 1, { unit: '°', hint: '+ looks up' })),
    p(R(`p${i}.roll`, 'Roll', g, d.roll, -45, 45, 1, { unit: '°' })),
    p(R(`p${i}.throw`, 'Throw ratio', g, d.throw, 0.2, 2.5, 0.01, { digits: 2, hint: 'distance ÷ image width' })),
    p(S(`p${i}.aspect`, 'Aspect', g, '16:9', ASPECTS)),
    p(R(`p${i}.brightness`, 'Brightness', g, 1, 0, 2, 0.01, { digits: 2 })),
    p(R(`p${i}.black`, 'Black level', g, 0.025, 0, 0.2, 0.001, { digits: 3, hint: 'glow a real projector throws for black' })),
  ];
}

export const PARAMS = [
  // ── Room ──────────────────────────────────────────────────────────────────
  R('room.apex', 'Roof apex height', 'room', 3.3, 2.7, 4.2, 0.01, { unit: 'm', digits: 2, hint: 'pitch shown alongside' }),
  T('room.furniture', 'Show furniture', 'room', true),
  T('room.loft', 'Show loft', 'room', true),
  T('room.cutaway', 'Fade near walls (cutaway)', 'room', true),
  R('room.ambient', 'Room lights', 'room', 0.14, 0, 1, 0.01, { digits: 2, hint: '0 = pitch dark, 1 = the baked night look' }),
  T('room.oldRoof', 'Show the old low roof', 'room', false),

  // ── Projectors ────────────────────────────────────────────────────────────
  I('proj.count', 'Projectors', 'projectors', 1, 1, 3),
  T('proj.frustum', 'Show frustum', 'projectors', true),
  T('proj.coverage', 'Coverage view', 'projectors', false, { hint: 'colour = how many projectors reach a surface' }),
  T('proj.occlusion', 'Occlusion (projection shadows)', 'projectors', true),
  T('proj.pixels', 'Pixel-size view', 'projectors', false),
  S('proj.res', 'Projector resolution', 'projectors', '1920', [
    { value: '1280', label: '1280 wide (720p)' },
    { value: '1920', label: '1920 wide (1080p)' },
    { value: '3840', label: '3840 wide (4K)' },
  ]),
  ...projectorParams(0),
  ...projectorParams(1),
  ...projectorParams(2),

  // ── Mapping ───────────────────────────────────────────────────────────────
  S('map.mode', 'Mapping', 'mapping', 'mapped', [
    { value: 'mapped', label: 'Mapped (per region)' },
    { value: 'raw', label: 'Raw (one flat rectangle)' },
  ]),
  T('map.mask.door', 'Mask the door', 'mapping', true),
  T('map.mask.window', 'Mask the window', 'mapping', true),
  T('map.mask.loft', 'Mask the loft', 'mapping', true),
  T('map.mask.furniture', 'Mask furniture', 'mapping', true),

  // ── Life ──────────────────────────────────────────────────────────────────
  S('life.sys.floor', 'Floor runs', 'life', 'physarum', SYSTEMS, { section: 'Systems' }),
  S('life.sys.wall', 'Walls run', 'life', 'grayscott', SYSTEMS, { section: 'Systems' }),
  S('life.sys.ceiling', 'Roof runs', 'life', 'particlelife', SYSTEMS, { section: 'Systems' }),
  S('life.gsPreset', 'Gray-Scott preset', 'life', 'coral', [
    { value: 'coral', label: 'Coral' },
    { value: 'worms', label: 'Worms' },
    { value: 'mitosis', label: 'Mitosis' },
    { value: 'front', label: 'Front' },
  ], { section: 'Presets' }),
  S('life.physPreset', 'Physarum preset', 'life', 'network', [
    { value: 'network', label: 'Network' },
    { value: 'veins', label: 'Veins' },
    { value: 'rings', label: 'Rings' },
  ], { section: 'Presets' }),
  S('life.plPreset', 'Particle Life preset', 'life', 'cells', [
    { value: 'cells', label: 'Cells' },
    { value: 'chasers', label: 'Chasers' },
    { value: 'swarm', label: 'Swarm' },
  ], { section: 'Presets' }),
  R('life.speed', 'Sim speed', 'life', 1, 0, 3, 0.05, { digits: 2, section: 'Time' }),
  I('life.substeps', 'Substeps', 'life', 1, 1, 4, { section: 'Time' }),
  R('life.gravity', 'Gravity strength', 'life', 1, 0, 2, 0.01, { digits: 2, section: 'Gravity' }),
  R('life.drift', 'Gray-Scott drift along g', 'life', 0.35, 0, 1, 0.01, { digits: 2, section: 'Gravity', hint: 'patterns drip down walls' }),
  S('life.geoSign', 'Physarum geotaxis', 'life', 'down', [
    { value: 'down', label: 'Sinks (positive)' },
    { value: 'up', label: 'Climbs (negative)' },
  ], { section: 'Gravity' }),
  R('life.geotaxis', 'Geotaxis strength', 'life', 0.3, 0, 1, 0.01, { digits: 2, section: 'Gravity' }),
  T('life.seams', 'Cross seams', 'life', true, { section: 'Space' }),
  R('life.ppm', 'Sim resolution', 'life', 40, 16, 64, 4, { unit: 'px/m', section: 'Space' }),
  S('life.gsPalette', 'Gray-Scott palette', 'life', 'aurora', PALETTES, { section: 'Palettes' }),
  S('life.physPalette', 'Physarum palette', 'life', 'bio', PALETTES, { section: 'Palettes' }),
  S('life.plPalette', 'Particle Life palette', 'life', 'neon', PALETTES, { section: 'Palettes' }),

  // ── Creatures (Plate VII prototype) ───────────────────────────────────────
  T('cr.on', 'Creatures', 'creatures', true),
  I('cr.floor', 'Population — floor', 'creatures', 10, 0, 60, { section: 'Population' }),
  I('cr.wall', 'Population — walls', 'creatures', 14, 0, 60, { section: 'Population' }),
  I('cr.ceiling', 'Population — roof', 'creatures', 10, 0, 60, { section: 'Population' }),
  I('cr.feet', 'Feet (starting mean)', 'creatures', 6, 2, 8, { section: 'Body' }),
  R('cr.grip', 'Grip strength', 'creatures', 1, 0, 2, 0.01, { digits: 2, section: 'Body' }),
  R('cr.mass', 'Mass', 'creatures', 1, 0.2, 3, 0.01, { digits: 2, section: 'Body' }),
  R('cr.swing', 'Swing length', 'creatures', 0.22, 0.05, 0.6, 0.01, { unit: 'm', digits: 2, section: 'Body' }),
  R('cr.flight', 'Free-flight time', 'creatures', 0.35, 0, 1.5, 0.01, { unit: 's', digits: 2, section: 'Body' }),
  R('cr.gscale', 'Gravity scale', 'creatures', 1, 0, 3, 0.01, { digits: 2, section: 'Body' }),
  T('cr.selection', 'Selection (death + mutation)', 'creatures', true, { section: 'Evolution' }),
  R('cr.mutation', 'Mutation rate', 'creatures', 0.08, 0, 0.5, 0.005, { digits: 3, section: 'Evolution' }),
  T('cr.detritus', 'Detritus food web', 'creatures', true, { section: 'Evolution' }),
  T('cr.showAir', 'Show mid-air bodies (not projectable)', 'creatures', true, { section: 'Evolution' }),

  // ── Visual aids ───────────────────────────────────────────────────────────
  T('aid.gravity', 'Gravity arrows', 'aids', false),
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
