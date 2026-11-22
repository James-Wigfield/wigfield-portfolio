/* Boat hotspots. The game finds them by node name in boat.glb (empties named
   hs_*; see ASSETS.md). p3 is a fallback position in the boat's local three.js
   frame (+X starboard, +Y up from the waterline, -Z toward the bow) used if a
   node is missing. `phases` = where E on it does something. */

export const HOTSPOTS = {
  hs_line_bow: { label: 'Bow line', p3: [-0.3, 0.85, -2.2], phases: ['t2', 't6', 't10'] },
  hs_line_stern: { label: 'Stern line', p3: [-0.7, 0.85, 2.3], phases: ['t2', 't6', 't10'] },
  hs_line_spring: { label: 'Spring line', p3: [-0.95, 0.85, -0.3], phases: ['t2', 't6'] },
  hs_cleat_bow: { label: 'Bow cleat', p3: [0, 0.9, -2.55], phases: ['t2'] },
  hs_cleat_stern: { label: 'Stern cleat', p3: [-0.9, 0.9, 2.45], phases: ['t2'] },
  hs_jetty_cleat: { label: 'Jetty cleat', phases: ['t2'] },
  hs_lifejackets: { label: 'Lifejackets', p3: [-0.6, 0.55, 1.3], phases: ['t3', 't7'] },
  hs_epirb: { label: 'EPIRB', p3: [0.35, 1.3, 0.05], phases: ['t3'] },
  hs_flares: { label: 'Flares', p3: [-0.5, 0.55, -0.5], phases: ['t3'] },
  hs_extinguisher: { label: 'Fire extinguisher', p3: [0.65, 0.55, 1.1], phases: ['t3'] },
  hs_bilge: { label: 'Bilge pump', p3: [0, 0.25, 2.1], phases: ['t3'] },
  hs_bucket: { label: 'Bucket', p3: [-0.7, 0.5, 1.9], phases: ['t3'] },
  hs_anchor: { label: 'Anchor', p3: [0, 0.75, -2.35], phases: ['t3'] },
  hs_radio: { label: 'Marine radio', p3: [-0.2, 1.3, 0.1], phases: ['t3'] },
  hs_fuel_line: { label: 'Fuel line', p3: [0.4, 0.5, 2.2], phases: ['t4'] },
  hs_fuel_bulb: { label: 'Primer bulb', p3: [0.5, 0.4, 2.0], phases: ['t4'] },
  hs_fuel_gauge: { label: 'Fuel gauge', p3: [0.05, 1.12, 0.15], phases: ['t4'] },
  hs_intakes: { label: 'Cooling intakes (leg)', p3: [0, -0.3, 2.95], phases: ['t4'] },
  hs_lanyard: { label: 'Kill lanyard', p3: [0.15, 1.02, 0.25], phases: ['t4'] },
  hs_lever: { label: 'Gear lever', p3: [0.45, 1.0, 0.3], phases: ['t4'] },
  hs_prop: { label: 'Look at the prop', p3: [0, -0.2, 3.1], phases: ['t4'] },
  hs_key: { label: 'Key', p3: [0.25, 1.0, 0.25], phases: ['t4', 't6', 't7', 't8', 't9', 't10', 't11', 'cruise'] },
  hs_rego: { label: 'Rego sticker', p3: [1.12, 0.6, -1.5], phases: [] },
};

export const hotspotLabel = (id) => HOTSPOTS[id]?.label ?? id.replace(/^hs_/, '').replace(/_/g, ' ');

export function activeHotspots(phase, g) {
  const out = Object.keys(HOTSPOTS).filter((id) => HOTSPOTS[id].phases.includes(phase));
  if (g?.mob && !g.mob.retrieved && !out.includes('hs_lifejackets')) out.push('hs_lifejackets');
  if (phase === 't3') {
    const B = g?.ph?.briefing; if (B) return [...new Set([...B.required, ...(B.optional ?? [])].map((x) => x.hs))];
  }
  return out;
}
