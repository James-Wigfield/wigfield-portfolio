/* Rules the sim's water obeys — ONLY ones confirmed in a DoT source.
   Local: DoT "Boating Guide — South Metropolitan" (May 2026, two A2 sides),
   downloaded to Documents/skippers/source/mac_g_boating_south_metro.pdf.
     Side 1 = the cover side (safety-equipment table, contacts, "Rockingham
     Waters" map of Cape Peron → Port Kennedy, and a larger-scale inset of
     Mangles Bay / Cape Peron at the lower left).
     Side 2 = the Cockburn Sound map (Fremantle → Rockingham) with the
     water-skiing, lifejacket, RST and PWC text panels.
   General: DoT RST Workbook 2026 (pages cited).

   NOTE: the guide does not name "Palm Beach". On the Mangles Bay inset the
   Rockingham foreshore has a pair of launching ramps (GPS validation point +
   ramp symbols) with "Swimming Prohibited" marks, set inside the eastern
   "Mooring Zone" — that's the ramp the sim models, but James should confirm
   on the day that it is the Palm Beach ramp. Zone shapes are the guide's
   (approximate); the sim must not claim survey accuracy ("Not to be used for
   navigation" is printed on the guide). Pure data. */

const G1 = 'DoT South Metropolitan Boating Guide (May 2026), side 1, Mangles Bay / Cape Peron inset (lower left)';
const G1R = 'DoT South Metropolitan Boating Guide (May 2026), side 1, "Rockingham Waters" map';
const G2 = 'DoT South Metropolitan Boating Guide (May 2026), side 2, Cockburn Sound map';

export const LOCAL_RULES = [
  // ── Rockingham foreshore / Mangles Bay (the sim's area) ──────────────────
  { id: 'rock-8kn-strip', kind: 'speedZone', limitKn: 8, rule: '8 Knot Speed Restricted Area along the Rockingham foreshore of Mangles Bay — the green strip between the beach and the water-ski area, about 200 m wide where the guide dimensions it.', appliesTo: 'Rockingham foreshore, south and south-east shore of Mangles Bay, from the mooring zones east past the Rockingham town beach to the ski take-off/landing area.', receipt: `${G1} ("8 knots", 200 m dimension); same strip on ${G2}` },
  { id: 'rock-mooring-zones', kind: 'speedZone', limitKn: 8, rule: 'Mooring Zone — Mooring Area (8 Knots): no more than 8 knots in or through it.', appliesTo: 'Two hatched mooring zones on the south shore of Mangles Bay: one east of the Point Peron PWC area, one off the Rockingham foreshore ramps.', receipt: `${G1} (legend "Mooring Area (8 Knots)"); workbook p.12 (8 kn in or through a mooring area)` },
  { id: 'rock-closed-waters', kind: 'noGo', rule: 'Closed Waters – All Vessels: no vessel may enter.', appliesTo: 'Rockingham foreshore: a large red area at the eastern end of the 8-knot strip (town beach, by the "200m" mark) and a small red patch inside the eastern mooring zone near the ramps.', receipt: `${G1} ("Closed Waters All Vessels", both arrows)` },
  { id: 'rock-ramp-no-swim', kind: 'swimming', rule: 'Swimming Prohibited at the launching ramps.', appliesTo: 'The pair of launching ramps on the Rockingham foreshore (eastern mooring zone) — the sim\'s ramp.', receipt: `${G1} ("Swimming Prohibited", arrows to both ramps)` },
  { id: 'mangles-ski-area', kind: 'skiArea', rule: 'Water Ski Area in Mangles Bay — skiing runs ANTI-CLOCKWISE; skiers take off and land only in the marked Take-off and Landing Area.', appliesTo: 'The yellow area over most of Mangles Bay; take-off/landing area on the Rockingham shore at its north-east corner. Ski boats in the sim circle anti-clockwise.', receipt: `${G1}; ${G2} ("Water skiing" panel: beach take-off and landing only in designated areas)` },
  { id: 'ski-hours', kind: 'skiArea', rule: 'Skiing only from sunrise to sunset unless otherwise indicated; it takes at least three people: a driver at least 17 with an RST, an observer at least 14, and the skier.', appliesTo: 'All ski areas — for the sim\'s AI ski boats.', receipt: `${G2} ("Water skiing" panel)` },
  { id: 'courtesy-moorings', kind: 'mooring', rule: 'Public courtesy moorings (orange/red, labelled with max length/capacity): up to 72 hours, never unattended for more than four hours; approach the buoy from downwind and tie up using the floating rope. Do not use the yellow (private) moorings.', appliesTo: 'Red-drop symbols in the Mangles Bay mooring zones and along the ski-area edge.', receipt: `${G1R} ("Public Courtesy moorings" panel) — symbols on the Mangles Bay inset` },
  { id: 'peron-5kn', kind: 'speedZone', limitKn: 5, rule: '5 Knot Speed Restricted Area — and Swimming Prohibited — in the Point Peron boat harbour.', appliesTo: 'The small boat harbour / ramp on the north side of Cape Peron (west end of Mangles Bay) — outside the sim\'s practice area.', receipt: `${G1} ("5 knots", "Swimming Prohibited")` },
  { id: 'peron-pwc', kind: 'pwc', rule: 'PWC (freestyle) Area beside the Point Peron harbour.', appliesTo: 'Orange area between the Point Peron harbour and the western mooring zone.', receipt: `${G1} ("PWC Area")` },
  { id: 'peron-north-8kn', kind: 'speedZone', limitKn: 8, rule: '8 knots along the north shore of Cape Peron (strip dimensioned 100 m); Closed Waters – All Vessels at John Point.', appliesTo: 'Cape Peron north shore, west of the Point Peron harbour.', receipt: `${G1} ("8 knots", "100m", "Closed Waters All Vessels")` },
  { id: 'shoalwater-8kn', kind: 'speedZone', limitKn: 8, rule: '8 knots in Shoalwater Bay (Shoalwater Islands Marine Park, which runs from just south of Becher Point to the Garden Island Causeway, up to 3 NM offshore).', appliesTo: 'South of Cape Peron — not on the sim\'s route.', receipt: `${G1} map + "Shoalwater Islands Marine Park" panel` },
  { id: 'lifejackets-carry', kind: 'gear', rule: 'Skippers must CARRY a lifejacket (minimum Level 100) for everyone on board on any WA waterway; wearing is compulsory beyond 400 m from shore in unprotected waters for children 1–12, and for everyone when the vessel is under 4.8 m.', appliesTo: 'Everywhere — sets the Task 3 briefing answer.', receipt: `${G2} ("Lifejackets and safety equipment" panel); workbook p.49` },

  // ── general rules the sim enforces (Workbook) ───────────────────────────
  { id: 'gen-8kn', kind: 'speedRule', limitKn: 8, rule: 'Without DoT approval, no more than 8 knots: through an arch of a bridge; in or through a mooring area; in water less than 3 m deep; within 15 m of a vessel underway; within 50 m of a moored vessel, a person in the water, a jetty or wharf, or a river bank / low-water mark.', appliesTo: 'Everywhere (TH.kn8, TH.near50, TH.nearUnderway, TH.shallow).', receipt: 'Workbook p.12 ("General speed limit restrictions")' },
  { id: 'gen-mob-8kn', kind: 'speedRule', limitKn: 8, rule: 'The MOB float is treated as a person: no more than 8 knots within 50 m of it.', appliesTo: 'Task 7 (counts under Task 1).', receipt: 'Workbook p.103' },
  { id: 'gen-nuisance', kind: 'conduct', rule: 'Don\'t travel at a speed or in a way that causes a nuisance or damage to people or other vessels, or damage/erosion to the shore or property.', appliesTo: 'Everywhere (T1.1).', receipt: 'Workbook p.12 ("Nuisance or damage"); p.92' },
  { id: 'gen-channel', kind: 'conduct', rule: 'In narrow channels keep to the starboard side as far as practicable and pass oncoming vessels port side to port side; keep a lookout and apply the collision rules.', appliesTo: 'Any marked channel in the sim (T1.2).', receipt: 'Workbook p.92' },
  { id: 'gen-dive-50m', kind: 'conduct', rule: 'Keep at least 50 m clear of vessels, buoys or areas showing diving signals; if you can\'t, go at a safe speed with due caution and a good lookout.', appliesTo: 'Any dive flag the sim spawns.', receipt: 'Workbook p.17' },
  { id: 'gen-no-tie-navaid', kind: 'conduct', rule: 'Do not secure a vessel to a beacon or other navigation aid.', appliesTo: 'Channel markers in the sim.', receipt: 'Workbook p.12' },
];

/* Explicitly NOT confirmed (left out of the sim on purpose): a named "Palm
   Beach" ramp, any Palm Beach jetty rule, exact zone coordinates, a
   speed limit inside the ski area (none is printed), lobster-pot rules beyond
   the guide's "keep well clear" caution (Safety Bay / Warnbro, side 1). */
