/* Numbers the sim scores against. Two kinds, never mixed up in the UI:
   - source 'workbook' — a number the DoT RST Workbook (2026) actually states,
     with its printed page. uiLabel starts "Workbook p.NN:".
   - source 'game' — our own number for a word the workbook leaves open
     ("appropriate revs", "little or no impact", "short period" …). uiLabel
     starts "Game threshold:" and must never be shown as a DoT rule.
   Difficulty: medium — ABC isn't trying to fail anyone, so the game numbers
   are fair and forgiving at the edges. Rationale for each is in
   Documents/skippers/sim/run-notes.md. Pure data, runs in Node. */

const wb = (value, unit, page, text, note = '') => ({ value, unit, source: 'workbook', page, uiLabel: `Workbook p.${page}: ${text}`, note });
const game = (value, unit, text, note = '') => ({ value, unit, source: 'game', page: null, uiLabel: `Game threshold: ${text}`, note });

export const BOAT_LENGTH_M = 5.5;

export const TH = {
  // ── boat ────────────────────────────────────────────────────────────────
  boatLength: game(BOAT_LENGTH_M, 'm', 'the practice boat is 5.5 m long (boat lengths are measured with this).', 'Assessment boat unknown; ABC trains in a small outboard runabout. Adjust if it differs.'),

  // ── general speed rules (Task 1) ────────────────────────────────────────
  kn8: wb(8, 'kn', 12, 'no more than 8 knots in a mooring area, in water under 3 m deep, within 15 m of a vessel underway, or within 50 m of a moored vessel, a person in the water, a jetty/wharf or the shore.', 'General speed limit restrictions, p.12. MOB float counts as a person (p.103).'),
  near50: wb(50, 'm', 12, '8 knots max within 50 m of a moored vessel, a person in the water, a jetty or wharf, or the shore / low-water mark.', 'Also p.103 for the MOB.'),
  nearUnderway: wb(15, 'm', 12, '8 knots max within 15 m of a vessel underway.'),
  shallow: wb(3, 'm depth', 12, '8 knots max in water less than 3 m deep.'),
  speedGraceKn: game(0.5, 'kn', 'up to 0.5 kn over a limit is not counted (speedo/GPS wobble).'),
  speedGrace: game(3, 's', 'a speed overshoot shorter than 3 s is not counted.'),
  t1Strikes: game(2, 'strikes', 'a Task 1 criterion is marked wrong on the 2nd breach; the 1st gets a caution from the assessor.', 'The workbook gives no count; a real assessor judges overall performance (p.91 "they record your overall performance").'),
  keepStarboardGrace: game(5, 's', 'more than 5 s on the wrong (port) side of a channel counts as a breach.'),
  wildlifeClear: game(50, 'm', 'keep at least 50 m from wildlife (dolphins, sea lions, penguins).', 'Workbook p.92 says "keep a good distance" with no number.'),
  seatedSpeed: game(2, 'kn', 'passengers must be seated whenever the boat is doing more than 2 knots.'),
  minDepth: game(1.0, 'm under the hull', 'less than 1 m of water under the hull is unsafe depth.'),
  bilgeIgnore: game(30, 's', 'a bilge/water-in-boat warning must be dealt with within 30 s (only if the sim models it).'),

  // ── look-arounds and contact ────────────────────────────────────────────
  headCheckWindow: game(6, 's', 'the look-around must happen within 6 s before you move off, stop or start the approach.'),
  lookAsternYaw: game(120, 'deg', 'a head-check counts when the view turns at least 120° from the bow (looking behind).'),
  contactLight: game(0.5, 'm/s', '"little or no impact" = touching the berth at under 0.5 m/s (about 1 knot).', 'Closing speed normal to the contact surface. Workbook p.99/p.108 say "little or no impact" with no number.'),
  contactHard: game(1.5, 'm/s', 'contact at 1.5 m/s (about 3 knots) or more is damage — marks the boat as mistreated (T1.3); against another vessel it ends the run.'),
  contactUnsafe: game(2.5, 'm/s', 'hitting a jetty at 2.5 m/s (about 5 knots) or more ends the run.'),
  groundingSpeed: game(1.5, 'kn', 'touching the bottom at 1.5 knots or more ends the run (slower is a T1.4 depth error).'),
  closedWatersGrace: game(2, 's', 'more than 2 s inside Closed Waters ends the run.'),
  impedeCpa: game(10, 'm', 'passing closer than 10 m to a moving vessel near the berth, or making it give way, counts as impeding.'),

  // ── berth work (Tasks 6 and 10) ────────────────────────────────────────
  berthZone: game(25, 'm', 'the berth zone is within 25 m of the berth — low-revs rules apply inside it.'),
  manoeuvreMaxNotch: game(2, 'notch', '"appropriate revs" near the berth = lever no further than F2 / R2.', 'Workbook p.99/p.108: low revs, minimum speed, no excessive rev changes.'),
  leverJump: game(2, 'notches', 'moving the lever more than 2 notches in a single move near the berth counts as a rev surge.'),
  neutralPause: game(0.6, 's', 'pause in neutral for at least 0.6 s when changing between forward and reverse.', 'Workbook p.106: "engaging neutral for a short period allows the engine revs to drop to idle".'),
  gearDither: game(4, 'changes / 5 s', 'more than 4 gear changes inside 5 s is hunting, not smooth use of gears.'),
  departClear: game(3, 'm', 'leaving the berth = getting 3 m clear without being set back onto it.'),
  departTime: game(60, 's', 'you have 60 s from the last line off to get clear of the berth.'),
  linesStowSpeed: game(4, 'kn', 'lines must be stowed before you go faster than 4 knots.'),
  linesStowTime: game(60, 's', 'lines must be stowed within 60 s of leaving the berth.'),
  berthApproachMax: game(3, 'kn', 'approach the berth at 3 knots or less (slowest speed that still steers).', 'Workbook p.108: "slowest possible speed you can while still maintaining steerage".'),
  steerageMin: game(0.8, 'kn', 'below 0.8 knots the boat stops answering the wheel (lost steerage).'),
  berthAngle: wb([30, 45], 'deg', 109, 'approach at somewhere between 30° and 45° to the berth (45° ideal with wind/current along the berth, p.108).', 'Printed as "between 300 and 450 degrees" on p.109 — an obvious typo for 30° and 45°; p.108 says 45°.'),
  berthAngleAccept: game([20, 60], 'deg', 'any approach angle from 20° to 60° is accepted (the workbook ideal is 30–45°).'),
  berthSwingBL: wb(2.5, 'boat lengths', 109, 'start the swing alongside when two to three boat lengths from the berth (p.108: about two).', 'Approach angle is measured as the boat passes 2.5 boat lengths out.'),
  berthSideAngle: game(90, 'deg', 'the right side is alongside when the bow points within 90° of straight into the combined wind/current.', 'Workbook p.108: moored boats point into the combined wind/current; berth with the bow the same way.'),
  negligibleDrift: game(0.3, 'kn', 'combined wind/current drift under 0.3 knots is negligible — either side is fine.'),
  secureGap: game(0.6, 'm', 'a line can be made fast once the hull is within 0.6 m of the berth.'),

  // ── man overboard (Task 7) ─────────────────────────────────────────────
  mobTurnWindow: game(4, 's', 'turn towards the MOB side within 4 s of "Man overboard!".', 'Workbook p.104: "immediately turn the vessel hard towards the side that the MOB fell".'),
  mobHelmFraction: game(0.5, 'of full lock', '"turn hard" = at least half lock towards the MOB side.'),
  mobThrowWindow: game(10, 's', 'throw (or order) the flotation aid within 10 s of the shout.'),
  mobWatchWindow: game(10, 's', 'assign someone to watch and point within 10 s of the shout.'),
  mobTurnClear: game(10, 'm', '"turn well clear" = stay at least 10 m from the MOB while turning above steerage speed.'),
  mobFinalApproach: game(20, 'm', 'the final approach is the last 20 m to the MOB.'),
  mobUpwindAngle: game(45, 'deg', 'final approach heading within 45° of straight into the stronger of wind/current.', 'Workbook p.104: approach from down wind or into the current, whichever is strongest.'),
  mobApproachZone: game(30, 'm', 'the approach-speed rule applies within 30 m of the MOB.'),
  steerageMax: game(3.5, 'kn', '"minimum speed to maintain steerage" = 3.5 knots or less on the final approach (idle in gear on a ~5.5 m outboard is about 3 kn).', 'Workbook p.104: "Drop speed to the minimum needed to maintain steerage".'),
  mobNoEngineBL: wb(1, 'boat length', 104, 'there must be no use of the engine within one vessel length of the MOB.'),
  mobReach: game(2.5, 'm', 'the float can be grabbed from 2.5 m off the hull (arm + boat hook).'),
  unsafePropRadius: game(3, 'm', 'a propeller turning in gear within 3 m of a person in the water ends the run.'),
  propClearStart: game(5, 'm', 'starting the motor with a person in the water within 5 m of the propeller ends the run.'),
  fastNearPersonKn: game(12, 'kn', 'doing more than 12 knots within 20 m of a person in the water ends the run.', 'Above the 8 kn / 50 m rule (that one is a T1.2 strike, not an instant fail).'),
  fastNearPersonM: game(20, 'm', 'the distance used with the 12-knot instant-fail rule.'),

  // ── transit (Task 8) ───────────────────────────────────────────────────
  transitTime: wb(30, 's', 105, 'use the transit to steer a steady course for 30 seconds.'),
  transitAlign: game(5, 'deg', 'two objects count as "in line" when their bearings from the boat differ by 5° or less.'),
  transitXte: game(10, 'm', '"steady course" = staying within 10 m either side of the transit line.'),
  transitGrace: game(4, 's', 'a wander off the line shorter than 4 s is forgiven if you steer back on.'),

  // ── controlled stop (Task 9) ───────────────────────────────────────────
  stopSpeed: wb(5, 'kn', 106, 'perform a controlled stop at approximately 5 knots.'),
  stopSpeedBand: game(1.5, 'kn', '"approximately 5 knots" = 3.5 to 6.5 knots when the stop is called.'),
  stopDistanceBL: wb(2, 'boat lengths', 106, 'stop the forward motion within two boat lengths.', 'Game measures from where the lever first comes back from forward.'),
  stopReact: game(4, 's', 'bring the revs back to idle within 4 s of the "stop" call.'),
  stopMaxReverse: game(2, 'notch', 'astern revs no higher than R2.', 'Workbook p.106: too many revs astern makes the prop lose grip.'),
  sternwayMax: game(1, 'kn', 'once stopped, return to neutral before going backwards faster than 1 knot.'),

  // ── radio (Task 5) ─────────────────────────────────────────────────────
  fuelTolerance: game(0.25, 'fraction', 'the fuel you report must be within 25% of what the gauge showed ("reasonably accurate", p.98).', 'Only applied when the game knows the fuel on board (checked at T4.3).'),
};

export const th = (key) => TH[key]?.value;
