/* ============================================================================
   PROJECTOR LIFE — the scene as MCP tool calls
   ----------------------------------------------------------------------------
   buildMcpCalls() turns the current visualiser state into the calls that
   would rebuild it on the mate's real rig. The tool names and argument shapes
   are the PROPOSAL in Documents/projector-life/merger-plan.md (phases 1–5);
   keep the two in step. Pure function, no React.
   ========================================================================== */
import { readParam } from '../params.js';

const r2 = (v) => (Number.isFinite(v) ? Math.round(v * 100) / 100 : v);
const r3 = (v) => (Number.isFinite(v) ? Math.round(v * 1000) / 1000 : v);

const EDGE_NAMES = {
  wall: ['bottom', 'right', 'top', 'left'],
  roof: ['eave', 'right_hip', 'left_hip'],
};

function edgeName(p, i) {
  return EDGE_NAMES[p.kind]?.[i] ?? `edge_${i}`;
}

function upEdge(p) {
  if (p.kind === 'wall') return 'top';
  if (p.kind === 'roof') return 'apex';
  return null; // floors: gravity presses in, no "up" along the surface
}

const SYSTEM_PRESET_KEY = { grayscott: 'life.gsPreset', physarum: 'life.physPreset', particlelife: 'life.plPreset' };
const SYSTEM_PALETTE_KEY = { grayscott: 'life.gsPalette', physarum: 'life.physPalette', particlelife: 'life.plPalette' };

/** Which surface type and system a patch runs (CONTRACTS §4 rule). */
export function regionLife(values, p) {
  const tOver = readParam(values, `region.${p.id}.type`);
  const type = tOver && tOver !== 'auto' ? tOver : p.typeAuto || p.type;
  const sOver = readParam(values, `region.${p.id}.system`);
  const system = sOver && sOver !== 'auto' ? sOver : values[`life.sys.${type}`];
  const on = readParam(values, `region.${p.id}.on`) !== false;
  return { type, system: on ? system : 'off', on };
}

/**
 * @returns {{ group: 'projectors'|'regions'|'climate'|'life'|'creatures'|'seed', tool: string, args: object }[]}
 */
export function buildMcpCalls({ values, patches = [], lastSeed = null }) {
  const calls = [];
  const push = (group, tool, args) => calls.push({ group, tool, args });

  // Projectors (the mapper already knows these on the real rig; listed so the
  // visualiser's guesses can be compared with his calibration).
  const n = values['proj.count'] || 1;
  for (let i = 0; i < n; i++) {
    push('projectors', 'set_projector', {
      index: i,
      pose: {
        position_m: [r2(values[`p${i}.x`]), r2(values[`p${i}.y`]), r2(values[`p${i}.z`])],
        yaw_deg: r2(values[`p${i}.yaw`]),
        pitch_deg: r2(values[`p${i}.pitch`]),
        roll_deg: r2(values[`p${i}.roll`]),
      },
      throw_ratio: r2(values[`p${i}.throw`]),
      aspect: values[`p${i}.aspect`],
      resolution_w: Number(values['proj.res']) || null,
      brightness: r2(values[`p${i}.brightness`]),
      black_level: r3(values[`p${i}.black`]),
    });
  }

  // Region metadata (phase 2). Masks only when their toggle is on.
  const maskOn = {
    door: !!values['map.mask.door'],
    window: !!values['map.mask.window'],
    loft: !!values['map.mask.loft'],
    furniture: !!values['map.mask.furniture'],
  };
  for (const p of patches) {
    const { type } = regionLife(values, p);
    push('regions', 'describe_region', {
      region: p.id,
      type,
      size_m: [r2(p.width), r2(p.height)],
      area_m2: r2(p.area),
      up_edge: upEdge(p),
      gravity_local: { g_t: (p.gravity?.gt || [0, 0]).map(r3), g_n: r3(p.gravity?.gn ?? 0) },
      ...(p.pitchDeg != null ? { pitch_deg: r2(p.pitchDeg) } : {}),
      seams: (p.seams || []).map((s) => ({ edge: edgeName(p, s.edge), to: s.to, to_edge: s.toEdge })),
      masks: (p.masks || []).filter((m) => maskOn[m.kind]).map((m) => m.id || m.kind),
    });
  }

  // Climate (phase 3): one call for the room.
  push('climate', 'set_climate', {
    gravity: r2(values['life.gravity']),
    drift: r2(values['life.drift']),
    geotaxis: r2((values['life.geoSign'] === 'up' ? -1 : 1) * values['life.geotaxis']),
    speed: r2(values['life.speed']),
    substeps: values['life.substeps'],
    seams: !!values['life.seams'],
    px_per_m: values['life.ppm'],
  });

  // Life per region (phase 1).
  for (const p of patches) {
    const { system } = regionLife(values, p);
    const pk = SYSTEM_PRESET_KEY[system];
    const pal = SYSTEM_PALETTE_KEY[system];
    push('life', 'set_region_life', {
      region: p.id,
      system,
      preset: pk ? values[pk] : null,
      params: system === 'off' ? {} : { palette: pal ? values[pal] : null, background: '#000000' },
    });
  }

  // Creatures (phase 4/5: Plate VII species per habitat).
  if (values['cr.on']) {
    for (const habitat of ['floor', 'wall', 'ceiling']) {
      const count = values[`cr.${habitat}`];
      if (!count) continue;
      push('creatures', 'introduce_species', {
        habitat,
        count,
        genome: {
          feet: values['cr.feet'],
          grip: r2(values['cr.grip']),
          mass: r2(values['cr.mass']),
          swing_m: r2(values['cr.swing']),
          flight_s: r2(values['cr.flight']),
        },
        gravity_scale: r2(values['cr.gscale']),
        selection: values['cr.selection'] ? { mutation: r3(values['cr.mutation']) } : null,
        detritus: !!values['cr.detritus'],
      });
    }
  }

  // The last click on a surface.
  if (lastSeed?.patchId && Array.isArray(lastSeed.local)) {
    push('seed', 'seed_region', { region: lastSeed.patchId, x_m: r2(lastSeed.local[0]), y_m: r2(lastSeed.local[1]) });
  }
  return calls;
}

/** One call per line, so 40 calls stay scannable. */
export function formatCalls(calls) {
  if (!calls.length) return '[]';
  const lines = calls.map((c, i) => `  ${JSON.stringify({ tool: c.tool, args: c.args })}${i < calls.length - 1 ? ',' : ''}`);
  return `[\n${lines.join('\n')}\n]`;
}

export const MCP_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'projectors', label: 'Projectors' },
  { id: 'regions', label: 'Regions' },
  { id: 'climate', label: 'Climate' },
  { id: 'life', label: 'Life' },
  { id: 'creatures', label: 'Creatures' },
  { id: 'seed', label: 'Seeds' },
];
