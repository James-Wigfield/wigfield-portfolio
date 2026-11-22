/* RST practical — the official assessment criteria, as data.
   Source: DoT/DTMI Recreational Skipper's Ticket Workbook (2026), chapter 10
   "Practical Assessment", printed pages 91–112. Task titles are verbatim (body
   headings); criterion `text` is our own short wording, faithful to the list
   under each task. `how` = what the sim measures or asks. Numbers live in
   thresholds.js (TH) and say whether they are the workbook's or the game's.

   Scoring (p.6, p.91): 62 criteria, pass = at least 56 demonstrated ("six wrong
   or less"). Task 1 is assessed the whole time. Unsafe skippering that puts
   the vessel, passengers or other water users in immediate danger = immediate
   fail at any stage. Fail more than 6 → the assessment may be stopped. One
   practical attempt per day (p.6).

   Assumed boat: ~5.5 m single-outboard runabout / centre console, portable or
   built-in fuel tank, kill-switch lanyard, single lever control (R2 R1 N F1–F6).
   Criteria that don't apply to that boat are `kind: 'na'` and are never marked
   wrong (p.95: "you will only need to demonstrate what applies to your vessel").

   Pure data — no React — so it runs in Node (tools/skippers/sim-criteria-check.mjs). */

export const PASS_MARK = 56;
export const TOTAL = 62;
export const MAX_WRONG = 6;
export const SOURCE = 'DoT RST Workbook 2026, ch.10 Practical Assessment, p.91–112';

export const TASKS = [
  { task: 1, title: 'The vessel is safely operated within the rules and regulations', page: 92, count: 4, short: 'Safe operation', throughout: true },
  { task: 2, title: 'Skipper checks the suitability and condition of the vessel’s mooring/berthing equipment and secures the vessel', page: 93, count: 3, short: 'Lines & securing' },
  { task: 3, title: 'Skipper conducts a safety briefing to all on board identifying the type and location of the vessel’s required safety equipment and wearing requirements for the area of operation and verbally check that the information is understood', page: 94, count: 3, short: 'Safety briefing' },
  { task: 4, title: 'Skipper prepares and starts motor safely', page: 95, count: 9, short: 'Pre-start & start' },
  { task: 5, title: 'Skipper advises a responsible person of the voyage plan', page: 97, count: 8, short: 'Log on' },
  { task: 6, title: 'The skipper safely departs a berth', page: 99, count: 7, short: 'Depart the berth' },
  { task: 7, title: 'Safely retrieve a simulated man overboard', page: 103, count: 8, short: 'Man overboard' },
  { task: 8, title: 'Determine position by using navigational marks, transits and other landmarks', page: 105, count: 2, short: 'Transit' },
  { task: 9, title: 'Perform a controlled stop at approximately 5 knots', page: 106, count: 7, short: 'Controlled stop' },
  { task: 10, title: 'Vessel is safely navigated and secured alongside a berth', page: 107, count: 9, short: 'Return & dock' },
  { task: 11, title: 'Skipper advises a responsible person of safe return', page: 112, count: 2, short: 'Log off' },
];

const c = (task, n, page, kind, text, how, threshold = null) => ({ id: `T${task}.${n}`, task, n, text, page, how, threshold, kind });

export const CRITERIA = [
  // ── Task 1 · assessed throughout (p.92) ─────────────────────────────────
  c(1, 1, 92, 'measured', 'Minimise the boat’s impact on others and the environment — wash, noise, wildlife, shoreline.',
    'Whole run. An "impact strike" = over TH.kn8 while within TH.near50 of a moored/anchored boat, a jetty/pontoon or the shore/low-water mark (wash, nuisance, shoreline, p.92 + p.12), or closer than TH.wildlifeClear to wildlife. Overshoots under TH.speedGraceKn or shorter than TH.speedGrace s are ignored. Wrong on TH.t1Strikes strikes.', 'near50'),
  c(1, 2, 92, 'measured', 'Apply the marine safety rules: lookout and collision rules, keep to starboard in channels, pass port to port, obey speed limits.',
    'Whole run. A "rule strike" = over a zone limit (LOCAL_RULES 5 kn / 8 kn areas, mooring areas) or a general 8 kn limit — within TH.near50 of a person in the water incl. the MOB float (p.103), within TH.nearUnderway of a vessel underway, depth under TH.shallow — beyond the speed grace; on the port side of a marked channel for > TH.keepStarboardGrace s; an oncoming vessel passed starboard-to-starboard in a channel; failing to give way when the player is the give-way vessel; touching Closed Waters (up to TH.closedWatersGrace s — longer is UNSAFE.closedWaters); leaving the berth without checking the registration sticker (E on hs_rego, if the boat has that hotspot — p.92 lists "checking the vessel is registered and displaying a current registration sticker"). Wrong on TH.t1Strikes strikes.', 't1Strikes'),
  c(1, 3, 92, 'measured', 'Keep the boat and its gear in good working order — don’t damage it, keep safety gear serviceable and to hand.',
    'Whole run. Wrong if the skipper damages the boat or gear: any contact at or above TH.contactHard, or running the fuel dry; or safety gear left where it isn’t easily accessible (p.92) if the sim models stowage. (Crash gear shifts are scored once, under T6.6 / T9.4 / T10.6, not here.)', 'contactHard'),
  c(1, 4, 92, 'measured', 'Monitor the safety of the boat and everyone on board — depth, sea state, taking water, seating, hands off the gunwale.',
    'Whole run. Wrong if any of: passengers not seated while speed > TH.seatedSpeed (tell them to sit: Space/dialogue); water under the hull < TH.minDepth (shoals on the map); a water-in-boat warning ignored for > TH.bilgeIgnore s (only if modelled); no "hands inside the boat" instruction (Space shout / dialogue) before entering TH.berthZone on the way in (p.92: no hands on the gunwale when berthing).', 'seatedSpeed'),

  // ── Task 2 · mooring lines and securing (p.93) ──────────────────────────
  c(2, 1, 93, 'action', 'Check the mooring lines are in good condition (and don’t use a bad one).',
    'Hotspots: E on each mooring line to inspect it. One line may be worn/frayed (random); the player must flag it "not suitable" and not use it. Met when every line that will be used has been inspected and no unsuitable line is used.'),
  c(2, 2, 93, 'action', 'Check the cleats / bollards / fittings you’ll secure to are sound and secure.',
    'Hotspots: E on the boat cleats and the jetty cleat/bollard you intend to use. One fitting may be cracked/loose (random); flag it and don’t tie to it. Met when every fitting used was inspected first and none was unsound.'),
  c(2, 3, 93, 'action', 'Secure the boat with the lines and cleats (one good bow line can be enough).',
    'The boat starts tied by the assessor, so the player must untie and re-tie (p.93). Met when at least one inspected, sound line is made fast between an inspected boat cleat and an inspected jetty fitting while the boat is alongside.'),

  // ── Task 3 · safety briefing (p.94) ────────────────────────────────────
  c(3, 1, 94, 'dialogue', 'Name each type of required safety equipment for the area.',
    'Briefing composer: pick every item REQUIRED for the area of operation (answer key = BRIEFING in captions.js; today = protected waters within 400 m of shore, so only lifejackets are required, p.49). Met when all required items are named. Naming recommended extras is fine; naming nothing required = fail.'),
  c(3, 2, 94, 'dialogue', 'Show where each required item is and state the wearing requirements for the area.',
    'Walk to the item and press E at its stowage while briefing it (location shown), and pick the correct wearing rule (BRIEFING.wearing in captions.js) in the composer. Met when every required item’s location was shown and the wearing rule is right.'),
  c(3, 3, 94, 'dialogue', 'Check that everyone understood the briefing.',
    'Final briefing line must be a check question ("Does everyone understand? Any questions?"). Met if chosen at the end of the briefing.'),

  // ── Task 4 · pre-start and start (p.95–96) ─────────────────────────────
  c(4, 1, 95, 'na', 'Check for fuel fumes (inboards only).',
    'N/A for the sim’s outboard boat: the workbook limits this to inboards (p.95 "inboards only"). Never marked wrong. (Sniffing the bilge anyway does no harm.)'),
  c(4, 2, 95, 'action', 'Check the fuel line is connected (and any fuel cock is open).',
    'Hotspot: E on the fuel-line connector at the tank/motor before the key is turned. Must happen before T4.9.'),
  c(4, 3, 95, 'action', 'Check how much fuel there is.',
    'Hotspot: E on the tank gauge / helm fuel gauge before the key is turned. The litres seen here are what a correct log-on should report (T5.7).'),
  c(4, 4, 95, 'na', 'Check the coolant level (if fitted).',
    'N/A for the sim’s outboard: p.95 describes a coolant header tank on freshwater (closed) cooling systems; an outboard is raw-water cooled through intakes on the leg (that check is T4.5). Never marked wrong.'),
  c(4, 5, 95, 'action', 'Check the engine cooling-water intakes are open and clear.',
    'Hotspot: E on the motor leg / look over the transom before the key is turned. A plastic bag may be on the intake (random) — the player must clear it. Met when inspected (and cleared if fouled) before start.'),
  c(4, 6, 96, 'action', 'Check the kill-switch (safety) lanyard is fitted securely.',
    'Hotspot: E on the kill-switch clip before the key is turned. Clipping it to yourself isn’t required for the assessment (p.96).'),
  c(4, 7, 96, 'measured', 'Make sure the motor is in neutral.',
    'Lever must read N when the key is turned, and the player must have checked it (E on the lever, or lever moved to N) before starting. Starting in gear = UNSAFE.startInGear (immediate fail).'),
  c(4, 8, 96, 'measured', 'Immediately before starting, make sure it is safe — nobody near the propeller.',
    'Head-check over the transom (camera yaw ≥ TH.lookAsternYaw toward the stern) within TH.headCheckWindow s before the key turn. Starting with a person in the water within TH.propClearStart of the propeller = UNSAFE.personNearProp.', 'headCheckWindow'),
  c(4, 9, 96, 'action', 'Start the motor.',
    'Key turn; must start. Criteria T4.2–T4.8 only count if done BEFORE this (p.95 note). Any of them done afterwards = that criterion wrong.'),

  // ── Task 5 · log on (p.97–98) ──────────────────────────────────────────
  c(5, 1, 97, 'dialogue', 'Give the vessel’s name, registration number or call sign.',
    'Radio composer field "vessel". checkRadio("logon") in radio.js. An invented rego is fine (p.97).'),
  c(5, 2, 97, 'dialogue', 'Give the departure time as a clock time (e.g. 0715 or 7.15 am).',
    'Radio field "departTime": a real clock time; "in 15 minutes"/"shortly" fails (p.97). See radio.js TIME rule.'),
  c(5, 3, 97, 'dialogue', 'Give the departure location — a recognisable place (ramp, marina, mooring area).',
    'Radio field "departFrom": a named place (e.g. "Palm Beach boat ramp"); "here" or blank fails.'),
  c(5, 4, 97, 'dialogue', 'Give the destination.',
    'Radio field "destination": a named place; "around", "out" or blank fails.'),
  c(5, 5, 98, 'dialogue', 'Give your trip intentions (fishing, diving, cruising…).',
    'Radio field "intentions": an activity word.'),
  c(5, 6, 98, 'dialogue', 'Give the number of people on board.',
    'Radio field "pob": a number (digits or words); "a few" fails. Should match the people in the boat.'),
  c(5, 7, 98, 'dialogue', 'Give the amount of fuel carried, in litres.',
    'Radio field "fuel": a number with litres/L; "plenty", "enough", "full tank" fail (p.98).'),
  c(5, 8, 98, 'dialogue', 'Give the estimated time of return as a clock time (e.g. 1430 or 2.30 pm).',
    'Radio field "eta": a real clock time; "in a couple of hours"/"shortly" fails (p.98).'),

  // ── Task 6 · depart the berth (p.99) ───────────────────────────────────
  c(6, 1, 99, 'measured', 'Look around and check it is safe before departing.',
    'Head-check: camera looked to BOTH sides and astern (yaw ≥ TH.lookAsternYaw each way) within TH.headCheckWindow s before the lever first leaves N for the departure. No head-check = wrong.', 'headCheckWindow'),
  c(6, 2, 99, 'measured', 'Allow for the effect of wind and current.',
    'After the last line is off, the boat must get TH.departClear clear of the berth without being set back onto it (no second contact after first moving away) within TH.departTime s. Pushing off with no plan and drifting back on = wrong.', 'departClear'),
  c(6, 3, 99, 'measured', 'Depart with little or no impact on the berth.',
    'Largest contact with the berth/jetty during departure must be below TH.contactLight. At/above TH.contactHard also counts for T1.3.', 'contactLight'),
  c(6, 4, 99, 'measured', 'Don’t impede other vessels.',
    'No AI vessel is forced to slow/alter (its give-way event fires) and no closest approach with a moving vessel under TH.impedeCpa during the departure.', 'impedeCpa'),
  c(6, 5, 99, 'measured', 'Use appropriate (low) engine revs.',
    'While within TH.berthZone of the berth: lever never beyond TH.manoeuvreMaxNotch (F2/R2), no jump of more than TH.leverJump notches in one move, and speed ≤ TH.berthApproachMax (p.99: low revs, minimum speed).', 'manoeuvreMaxNotch'),
  c(6, 6, 99, 'measured', 'Use the gears smoothly and in good time.',
    'Every forward↔reverse change pauses in N for at least TH.neutralPause s; no more than TH.gearDither gear changes inside any 5 s window (hunting).', 'neutralPause'),
  c(6, 7, 99, 'action', 'Stow (or secure) the mooring lines so they can’t trail and foul the propeller.',
    'Hotspot E "stow lines" (or tell crew to) before speed first exceeds TH.linesStowSpeed or TH.linesStowTime s after leaving the berth, whichever comes first.', 'linesStowSpeed'),

  // ── Task 7 · man overboard (p.103–104) ─────────────────────────────────
  c(7, 1, 104, 'measured', 'Turn the boat towards the side the person fell from.',
    'Within TH.mobTurnWindow s of "Man overboard!", the wheel is put at least TH.mobHelmFraction of full lock TOWARDS the MOB side (swings the stern and propeller away).', 'mobTurnWindow'),
  c(7, 2, 104, 'action', 'Throw (simulate throwing) a flotation aid, or have crew do it.',
    'E on the throwable/lifejacket hotspot, or the shout "Throw the lifejacket!" (Space menu), within TH.mobThrowWindow s of the shout.', 'mobThrowWindow'),
  c(7, 3, 104, 'dialogue', 'Make sure a visual watch is kept on the person in the water.',
    'Assign a spotter ("Keep pointing at them!" — crew or assessor) within TH.mobWatchWindow s of the shout. If no spotter, the camera must keep the float in view (on screen) for ≥ 90% of the recovery.', 'mobWatchWindow'),
  c(7, 4, 104, 'measured', 'Turn well clear and come back to approach from downwind / into the current (whichever is stronger).',
    'Final approach (last TH.mobFinalApproach m) heading within TH.mobUpwindAngle of straight into the stronger of wind/current. While making the turn above TH.steerageMax, stay at least TH.mobTurnClear from the MOB.', 'mobUpwindAngle'),
  c(7, 5, 104, 'measured', 'Approach at an appropriate (minimum steerage) speed.',
    'Inside TH.mobApproachZone of the MOB, speed ≤ TH.steerageMax (and the 8 kn / 50 m rule, p.103, counts under T1.2).', 'steerageMax'),
  c(7, 6, 104, 'measured', 'Position the boat downwind/down-current and drift up to the person — no engine within one boat length.',
    'Lever in N (no gear) whenever the MOB is within TH.mobNoEngineBL boat lengths, and the boat ends downwind/down-current of the MOB (drift brings it alongside). Gear engaged inside one boat length = wrong; prop turning inside TH.unsafePropRadius = UNSAFE.engineNearPerson.', 'mobNoEngineBL'),
  c(7, 7, 104, 'action', 'Turn the engine off before the pick-up.',
    'Key off (engine stopped) before the pick-up E is pressed.'),
  c(7, 8, 104, 'action', 'Get the person aboard.',
    'E "retrieve" within TH.mobReach of the hull (bow, side or stern all OK, p.104) with the engine off. Met when the float is aboard.', 'mobReach'),

  // ── Task 8 · transit (p.105) ───────────────────────────────────────────
  c(8, 1, 105, 'dialogue', 'Tell the assessor the two objects that line up to make the transit.',
    'Transit picker: name the FRONT and REAR objects (two of the visible marks/landmarks) that are actually in line from the boat’s position (bearing difference ≤ TH.transitAlign when named).', 'transitAlign'),
  c(8, 2, 105, 'measured', 'Steer a steady course along the transit for 30 seconds.',
    'Hold cross-track error from the transit line ≤ TH.transitXte for TH.transitTime s (workbook 30 s); single excursions shorter than TH.transitGrace s are forgiven. Going off? steer towards the lower/front mark (p.105).', 'transitTime'),

  // ── Task 9 · controlled stop (p.106) ───────────────────────────────────
  c(9, 1, 106, 'measured', 'Check it is safe to stop — look behind.',
    'Camera yaw ≥ TH.lookAsternYaw (looked behind) within TH.headCheckWindow s before the lever comes back from forward after the "stop" call.', 'headCheckWindow'),
  c(9, 2, 106, 'action', 'Shout a warning to the crew ("Hold on — stopping!").',
    'Space shout "Hold on!" before reverse is engaged and no earlier than TH.headCheckWindow s before the stop call.'),
  c(9, 3, 106, 'measured', 'Reduce the engine revs.',
    'Speed was ~TH.stopSpeed ± TH.stopSpeedBand when the stop was called, then the lever comes back to idle (F1 or N) within TH.stopReact s of the call.', 'stopSpeed'),
  c(9, 4, 106, 'measured', 'Engage neutral (briefly, so the revs drop).',
    'Lever sits in N for at least TH.neutralPause s before reverse.', 'neutralPause'),
  c(9, 5, 106, 'measured', 'Engage reverse — a positive shift.',
    'After the neutral pause, R1 or R2 is selected in one move (not left in N; not ground in slowly).'),
  c(9, 6, 106, 'measured', 'Use appropriate (controlled) revs astern to stop.',
    'Astern throttle no more than needed: lever not beyond TH.stopMaxReverse, and once forward motion stops the lever returns to N before sternway exceeds TH.sternwayMax.', 'sternwayMax'),
  c(9, 7, 106, 'measured', 'Stop the forward motion within two boat lengths.',
    'Distance from where the lever first comes back from forward to where forward speed reaches zero ≤ TH.stopDistanceBL × boat length.', 'stopDistanceBL'),

  // ── Task 10 · return and dock (p.107–108) ──────────────────────────────
  c(10, 1, 108, 'measured', 'Look around and check it is safe before the approach.',
    'Head-check both sides + astern within TH.headCheckWindow s before entering TH.berthZone on the way in.', 'headCheckWindow'),
  c(10, 2, 108, 'measured', 'Don’t impede other vessels.',
    'As T6.4, during the approach and berthing.', 'impedeCpa'),
  c(10, 3, 108, 'measured', 'Choose the side to put alongside from the wind/current.',
    'When secured, the bow points into the combined wind/current (heading within TH.berthSideAngle of its upstream direction). If the combined drift is below TH.negligibleDrift, or it runs across the berth, either side passes (p.108).', 'berthSideAngle'),
  c(10, 4, 108, 'measured', 'Approach the berth at an appropriate (slowest steering) speed.',
    'Inside TH.berthZone: speed ≤ TH.berthApproachMax; the boat must not stall below TH.steerageMin for > 5 s while still more than one boat length off (wind takes over).', 'berthApproachMax'),
  c(10, 5, 108, 'measured', 'Approach at an appropriate angle (about 30–45° in ideal conditions).',
    'Angle between heading and the berth face, measured as the boat passes TH.berthSwingBL boat lengths out, within TH.berthAngleAccept (workbook ideal 30–45°, TH.berthAngle).', 'berthAngle'),
  c(10, 6, 108, 'measured', 'Use the gears smoothly and in good time — neutral just before alongside, then reverse to stop.',
    'Lever in N (or reverse) by the time the hull is within 1.5 m of the berth (“with the bow’s shoulder getting close”, p.109 Step 3), and every F↔R change pauses ≥ TH.neutralPause s.', 'neutralPause'),
  c(10, 7, 108, 'measured', 'Use appropriate (low) engine revs.',
    'As T6.5 inside TH.berthZone.', 'manoeuvreMaxNotch'),
  c(10, 8, 108, 'measured', 'Arrive with little or no impact to the boat and the structure.',
    'Largest contact with the berth below TH.contactLight. At/above TH.contactHard also counts for T1.3.', 'contactLight'),
  c(10, 9, 108, 'action', 'Secure the boat with mooring lines.',
    'E: make a line fast from a boat cleat to the jetty fitting while alongside (an amidships line or one spring is enough, p.108). Must be within TH.secureGap of the berth.', 'secureGap'),

  // ── Task 11 · log off (p.112) ──────────────────────────────────────────
  c(11, 1, 112, 'dialogue', 'Give the vessel’s name, registration number or call sign.',
    'Radio composer field "vessel" (should match the log-on). checkRadio("logoff").'),
  c(11, 2, 112, 'dialogue', 'Tell the responsible person you have returned safely.',
    'Radio field "status": a safe-return statement ("returned safely", "back at the ramp, logging off").'),
];

/* Immediate-fail reasons (p.91, p.92: "unsafe skippering … will result in
   immediate failure at any stage"). The workbook gives the principle, not a
   list — each trigger below is the game's reading of "immediate danger";
   numbers are TH game thresholds. */
export const UNSAFE = {
  startInGear: 'The motor was started in gear — the boat could have lurched and hurt someone (p.96).',
  personNearProp: 'The motor was started with someone in the water near the propeller (p.96).',
  engineNearPerson: 'The propeller was turning right next to a person in the water (p.104).',
  hitPerson: 'The boat struck a person in the water.',
  hardHitVessel: 'The boat hit another vessel hard.',
  hardHitStructure: 'The boat hit the jetty/structure hard enough to damage it or throw people off their feet.',
  grounding: 'The boat ran aground.',
  fastNearPerson: 'The boat was driven fast right past a person in the water (p.103: 8 knots max within 50 m).',
  passengerThrown: 'A passenger was standing/unseated during a hard manoeuvre at speed.',
  closedWaters: 'The boat entered Closed Waters (all vessels) where people swim.',
};

/* Which TH keys trigger each UNSAFE reason (all game thresholds). */
export const UNSAFE_TRIGGERS = {
  startInGear: 'key turned with the lever not in N',
  personNearProp: 'key turned with a person in the water within TH.propClearStart of the prop',
  engineNearPerson: 'lever in gear with a person in the water within TH.unsafePropRadius of the prop',
  hitPerson: 'any hull contact with a person in the water',
  hardHitVessel: 'contact with another vessel at ≥ TH.contactHard',
  hardHitStructure: 'contact with a jetty/structure at ≥ TH.contactUnsafe',
  grounding: 'hull touches the seabed/rocks at ≥ TH.groundingSpeed',
  fastNearPerson: 'speed > TH.fastNearPersonKn within TH.fastNearPersonM of a person in the water',
  passengerThrown: 'a passenger standing (not told to sit) while the boat decelerates hard from > TH.seatedSpeed (e.g. the controlled stop without the T9.2 shout)',
  closedWaters: 'boat inside a Closed Waters – All Vessels polygon (LOCAL_RULES rock-closed-waters) for > TH.closedWatersGrace s',
};

/* Mirror of captions.js BRIEFING (that one is the game's answer key). Safety-briefing items for the sim's area of operation: a ~5.5 m boat in
   protected waters (within 400 m of shore, Rockingham). Workbook p.48–49 table.
   `required` items must be named + shown for T3.1/T3.2. */
export const BRIEFING_AREA = { id: 'protected', label: 'Protected waters (within 400 m of shore)', page: 49 };
export const BRIEFING_ITEMS = [
  { id: 'lifejackets', label: 'Lifejackets — one per person, minimum Level 100', required: true, wearing: 'Carried, not worn (protected waters, any boat size, children 1–12 too)', page: 49 },
  { id: 'anchor', label: 'Anchor and line', required: false, page: 49 },
  { id: 'extinguisher', label: 'Fire extinguisher', required: false, page: 49 },
  { id: 'bailer', label: 'Bilge pump / bucket (means of removing water)', required: false, page: 49 },
  { id: 'beacon', label: 'GPS EPIRB or PLB', required: false, note: 'Required beyond 400 m from shore (unprotected waters)', page: 49 },
  { id: 'flares', label: 'Flares (2 red + 2 orange) or EVDS', required: false, note: 'Required beyond 400 m from shore (unprotected waters)', page: 49 },
  { id: 'radio', label: 'Marine radio (VHF)', required: false, note: 'Required beyond 4 NM in unprotected waters', page: 49 },
];

export const criteriaFor = (task) => CRITERIA.filter((x) => x.task === task);
export const byId = Object.fromEntries(CRITERIA.map((x) => [x.id, x]));
