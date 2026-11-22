# Practical sim — criteria & scoring run notes (2026-11-22)

Content for `/skippers/practical/drive`: the official criteria, thresholds, assessor captions, radio checker and local rules. The engine/physics/game live elsewhere and code against these files.

| File | What |
|---|---|
| `src/skippers/sim/criteria.js` | `TASKS` (11), `CRITERIA` (62), `PASS_MARK` 56, `TOTAL` 62, `MAX_WRONG` 6, `UNSAFE` + `UNSAFE_TRIGGERS`, `BRIEFING_ITEMS` mirror |
| `src/skippers/sim/thresholds.js` | `TH` — every number, tagged `workbook` (with page) or `game` |
| `src/skippers/sim/captions.js` | `ORDER`, `INTRO`, `CAPTIONS`, `ACKS`, `CAUTIONS`, `END`, `BRIEFING` (Task 3 answer key) |
| `src/skippers/sim/radio.js` | `LOGON_FIELDS`, `LOGOFF_FIELDS`, `VAGUE`, `checkRadio(kind, answers, ctx)`, `parseTime/parseCount/parseLitres`, `buildCall` |
| `src/skippers/sim/localRules.js` | `LOCAL_RULES` — only rules confirmed in the DoT South Metro guide or the workbook |
| `tools/skippers/sim-criteria-check.mjs` | `node tools/skippers/sim-criteria-check.mjs` — structure, titles, thresholds, radio cases; exit 1 on failure |

Sources (git-ignored, `Documents/skippers/source/`): `MAC_P_RST_Workbook2026.pdf` (+ `workbook-pages.txt`, printed page = PDF page − 2), `mac_g_boating_south_metro.pdf` (DoT South Metropolitan Boating Guide, May 2026, downloaded from transport.wa.gov.au) + `south-metro-guide*.txt` + crops in `guide/`.

## Scoring as built

- 11 tasks, 62 criteria, per-task 4/3/3/9/8/7/8/2/7/9/2 (ch.10 lists, p.92–112). Pass = at least 56 of 62, "six wrong or less" (p.6, p.91).
- Task 1 is assessed throughout (p.92). Unsafe skippering that puts the vessel, passengers or other water users in immediate danger = immediate fail at any stage (p.91, p.92).
- More than 6 wrong → the assessment "may be" stopped (p.91). The game can stop at the 7th wrong (`END.stopped`).
- One practical attempt per day (p.6).
- **N/A criteria count as not wrong.** p.95: "you will only need to demonstrate what applies to your vessel". The pass rule is applied as wrong ≤ 6.

## N/A decisions (Task 4, assumed ~5.5 m single-outboard runabout)

- **T4.1 fuel fumes — N/A.** The criterion itself says "(inboards only)" (p.95).
- **T4.4 coolant level — N/A.** p.95 describes a coolant header tank on *fresh water* (closed) cooling systems. An outboard is raw-water cooled through intakes on the leg, which is T4.5 ("On an outboard motor, the intakes will be located on the leg", p.95). If ABC's boat is a stern drive/inboard with a header tank, T4.4 (and T4.1) would apply. **Check tomorrow.**
- T4.2 fuel line/fuel cock: kept (fuel line connected applies to an outboard with a portable or built-in tank; the cock part is "if applicable").
- T4.6 kill-switch lanyard: kept ("if applicable"; almost every outboard runabout has one). You don't have to clip it to yourself for the assessment (p.96).

## Source discrepancies (followed the workbook every time)

1. **Pass mark wording.** The DoT "Get a RST" web page says "fewer than 6 wrong"; the workbook says at least 56 of 62, "six wrong or less" (p.6, p.91). 6 wrong passes. (Web page as reported in the brief; I didn't browse it.)
2. **Task 2 wording.** Web page: "anchors, lines and equipment"; workbook Task 2 is mooring/berthing lines and equipment + securing the boat (p.93). No anchor criterion exists in ch.10.
3. **Duration.** Web: about 1 hour; workbook: about 30 minutes, longer with several candidates (p.91). ABC says ~10–15 min formal assessment after training (existing site note).
4. **Task 3 title.** The ch.10 contents list (p.90) says "…the vessel's *mandatory* safety equipment and verbally check…"; the task heading on p.94 says "…*required* safety equipment and wearing requirements for the area of operation…". The sim uses the p.94 heading.
5. **Task 2 title** is printed "mooring/ berthing" across a line break on p.93 and "mooring/berthing" in the contents; the sim uses "mooring/berthing".
6. **Berthing angle typo.** p.109 says "an angle to the berth of somewhere between 300 and 450 degrees" — clearly 30° and 45° (p.108 says 45° ideal). Sim: workbook 30–45°, game accepts 20–60°.
7. **Swing distance.** p.108 "about two boat lengths away"; p.109 "two to three boat lengths". Sim measures the angle at 2.5 boat lengths.
8. **Time formats.** The brief said times must be 4-digit 24-h HHMM and suggested "8:15am" fails. The workbook explicitly accepts "0715 or 7.15 am" (p.97) and "1430 or 02:30 pm" (p.98), so **12-hour with am/pm passes** in `checkRadio`. Game decisions on top: bare H:MM/HHMM read as 24-hour; "815" fails (say 0815); "noon"/"midday" fail (say 1200); "8 am" passes; ETA must be after departure (catches "2:30" meaning pm).
9. **T1.2 rego sticker.** The "checking the vessel is registered and displaying a current registration sticker" bullet is printed below criterion 4 on p.92 but it belongs to criterion 2's bullet list (that list ends "; and" before the page layout breaks). Sim counts it under T1.2 (needs an `hs_rego` hotspot if the boat has one).

## Workbook numbers the sim uses (`source: 'workbook'`)

| TH key | Value | Page | Wording |
|---|---|---|---|
| kn8 | 8 kn | 12 | General speed limit restrictions: mooring area, < 3 m depth, within 15 m of a vessel underway, within 50 m of a moored vessel / person in the water / jetty or wharf / bank or low-water mark, bridge arch |
| near50 | 50 m | 12 (+103) | 8 kn within 50 m …; MOB float = a person (p.103) |
| nearUnderway | 15 m | 12 | 8 kn within 15 m of a vessel underway |
| shallow | 3 m | 12 | 8 kn in water under 3 m |
| mobNoEngineBL | 1 boat length | 104 | "no use of the engine within one vessel length of the MOB" |
| transitTime | 30 s | 105 | steer a steady course for 30 seconds |
| stopSpeed | 5 kn | 106 | controlled stop at approximately 5 knots |
| stopDistanceBL | 2 boat lengths | 106 | stop within two boat lengths |
| berthAngle | 30–45° | 109 | (typo 300/450; 45° ideal p.108) |
| berthSwingBL | 2.5 boat lengths | 109 | swing at two to three boat lengths |

## Game thresholds (`source: 'game'`, uiLabel "Game threshold: …") and why

Medium difficulty — ABC isn't trying to fail anyone, so the edges are forgiving.

- **boatLength 5.5 m** — assessment boat unknown; typical small outboard runabout.
- **speedGraceKn 0.5 kn / speedGrace 3 s** — speedo wobble; a real assessor won't fail 8.3 kn for a second.
- **t1Strikes 2** — Task 1 criteria are wrong on the second breach; first is a caution. The workbook gives no count; the assessor "records your overall performance" (p.91).
- **keepStarboardGrace 5 s**, **wildlifeClear 50 m** (p.92 "a good distance", no number), **seatedSpeed 2 kn**, **minDepth 1.0 m**, **bilgeIgnore 30 s** (only if modelled).
- **headCheckWindow 6 s**, **lookAsternYaw 120°** — the look has to be recent and actually behind you.
- **contactLight 0.5 m/s** ("little or no impact", p.99/p.108) · **contactHard 1.5 m/s** (damage → T1.3; vs another vessel → unsafe) · **contactUnsafe 2.5 m/s** (structure → unsafe). Closing speed normal to the surface.
- **impedeCpa 10 m** — near the berth; also wrong if an AI boat has to give way.
- **berthZone 25 m**, **manoeuvreMaxNotch 2** (F2/R2 = "appropriate revs"), **leverJump 2**, **berthApproachMax 3 kn**, **steerageMin 0.8 kn**, **berthAngleAccept 20–60°**, **berthSideAngle 90°**, **negligibleDrift 0.3 kn**, **secureGap 0.6 m**.
- **neutralPause 0.6 s** — p.106 "neutral for a short period"; long enough to be deliberate, short enough not to nag.
- **gearDither 4 changes / 5 s** — p.108 allows "in and out of gear a number of times", so only real hunting counts.
- **departClear 3 m / departTime 60 s**, **linesStowSpeed 4 kn / linesStowTime 60 s**.
- **MOB:** mobTurnWindow 4 s ("immediately", p.104), mobHelmFraction 0.5 ("hard"), mobThrowWindow 10 s, mobWatchWindow 10 s, mobTurnClear 10 m ("well clear"), mobFinalApproach 20 m, mobUpwindAngle 45°, mobApproachZone 30 m, steerageMax 3 kn ("minimum needed to maintain steerage"), mobReach 2.5 m (arm + boat hook).
- **Unsafe:** propClearStart 5 m, unsafePropRadius 3 m, fastNearPersonKn 12 / fastNearPersonM 20 m (well above the 8 kn/50 m rule, which is only a T1.2 strike), groundingSpeed 1.5 kn, closedWatersGrace 2 s.
- **Transit:** transitAlign 5°, transitXte 10 m, transitGrace 4 s.
- **Stop:** stopSpeedBand ±1.5 kn ("approximately"), stopReact 4 s, stopMaxReverse R2, sternwayMax 1 kn. Stop distance is measured from where the lever first comes back from forward.
- **fuelTolerance 25 %** — "reasonably accurate terms" (p.98), only when the game knows the tank level (seen at T4.3).

## UNSAFE (immediate fail) — the game's reading of "immediate danger"

The workbook states the principle (p.91–92), not a list. Built: `startInGear` (p.96), `personNearProp` (p.96), `engineNearPerson` (p.104), `hitPerson`, `hardHitVessel`, `hardHitStructure`, `grounding`, `fastNearPerson`, `passengerThrown`, `closedWaters`. Triggers + TH keys in `UNSAFE_TRIGGERS`.

## Task 3 briefing answer key

Area = Mangles Bay off the Rockingham foreshore, within 400 m of shore → **protected waters** (p.49 definition: "waters within 400 metres of the shore in unprotected waters"). The p.49 table for a registrable vessel in protected waters: **lifejackets minimum Level 100 must be CARRIED** for everyone (under 4.8 m, 4.8 m+, and children 1–12 alike). EPIRB/PLB, flares/EVDS, marine radio, anchor + line, fire extinguisher and a means of removing water are all **recommended** there. Beacon + flares become required beyond 400 m, VHF/HF beyond 4 NM. Wearing: carried, not worn, inside 400 m. Confirmed on the rendered p.49 table (`pages/p-051.png`) and on the guide's side-1 table.

## Local rules (DoT South Metropolitan Boating Guide, May 2026)

- **The guide never names Palm Beach.** On the side-1 Mangles Bay / Cape Peron inset, the Rockingham foreshore has a pair of launching ramps (GPS validation + ramp symbols) marked "Swimming Prohibited", inside the eastern "Mooring Zone". The sim treats that as the ramp. **James: confirm on the day.**
- 8 Knot Speed Restricted Area — green strip along the Rockingham foreshore of Mangles Bay, about 200 m wide where dimensioned (side 1 inset; also side 2).
- Mooring Zone = Mooring Area (8 knots) — two hatched zones on the south shore of Mangles Bay (side 1 legend; workbook p.12).
- Closed Waters – All Vessels — a large red area at the eastern end of the 8-knot strip (Rockingham town beach) and a small patch inside the eastern mooring zone (side 1).
- Swimming Prohibited at the Rockingham foreshore ramps (side 1).
- Water Ski Area over Mangles Bay, skiing anti-clockwise; take-off/landing area at its north-east corner (side 1; side 2 "Water skiing" panel: sunrise–sunset, take-off/landing only in designated areas, at least three people: driver 17+ with RST, observer 14+, skier).
- Public courtesy moorings (orange/red) — up to 72 h, not unattended over 4 h, approach from downwind, tie up with the floating rope; don't use yellow moorings (side 1 panel).
- Point Peron boat harbour: 5 Knot Speed Restricted Area + Swimming Prohibited; PWC Area beside it; 8 kn strip along Cape Peron's north shore (100 m), Closed Waters at John Point (side 1 inset). Outside the practice area.
- Shoalwater Bay 8 knots, Shoalwater Islands Marine Park (side 1).
- Lifejackets: carry Level 100 for everyone on any WA waterway; wearing beyond 400 m for kids 1–12 and everyone on boats under 4.8 m (side 2 panel; workbook p.49).
- General workbook rules also in `LOCAL_RULES`: 8 kn list (p.12), MOB = person (p.103), nuisance/damage (p.12, p.92), keep starboard / port to port (p.92), 50 m from dive signals (p.17), don't tie to a navigation aid (p.12).
- **Left out (not confirmed):** a named Palm Beach rule, any Palm Beach jetty rule, exact zone coordinates, any speed limit inside the ski area (none printed), lobster-pot rules beyond "keep well clear" (Safety Bay/Warnbro).

## Assumptions

- Boat: ~5.5 m single-outboard runabout/centre console, single lever R2 R1 N F1–F6, kill-switch lanyard, portable or built-in tank, no fume detector, no header tank.
- Area: inside 400 m of the Rockingham shore the whole time.
- Crew: an assessor + at least one passenger who can be told to sit, watch and point.
- Captions give WHAT to do, never HOW (p.91: the assessor can repeat but can't tell you how to skipper).

## Sanity-check after tomorrow

1. Was the boat an outboard? Did the assessor skip fumes and coolant (T4.1, T4.4)?
2. Which ramp — is it the twin ramps on the Rockingham foreshore in the eastern mooring zone?
3. Did the assessor want "0815"-style times, or accept "8.15 am"? Fuel in litres from the gauge?
4. How was "appropriate revs" judged, and how hard were the controlled stop and docking marked? Tune `manoeuvreMaxNotch`, `berthApproachMax`, `contactLight` accordingly.
5. Order of tasks on the day vs `ORDER` (and when the MOB was sprung).
6. Briefing: did they expect only lifejackets for inside 400 m, or the full beyond-400 m set?
7. Transit: what pairs did they accept (marks, buildings)?

## Main agent: physics, engine and scoring decisions (2026-11-22)

All of these are **game values**, not DoT rules.

- **Boat model (`physics.js`):** an ASSUMED ~5.5 m, ~100 hp outboard centre console, 1200 kg loaded. ABC's actual boat is unknown.
  - 3-DOF (surge, sway, yaw) on a fixed 60 Hz step, deterministic, runs in Node.
  - Thrust is vectored at the transom along the leg (±30° at full lock). The leg only works as a small rudder in neutral, so there is almost no steering in neutral. Drag is quadratic with high lateral resistance. Windage acts 0.8 m forward of the centre of gravity, so the bow falls off downwind.
  - Steady speeds: idle ahead (F1) ≈ 2.5 kn, F2 ≈ 5 kn, F3 ≈ 8 kn, F4 ≈ 12 kn, F6 ≈ 24 kn. Turning radius at F2 ≈ 6 m.
  - Revs follow a lag model. Engaging a gear above 1100 rpm counts as a rough "clunk". Reverse above 2000 rpm mostly churns (35% effective).
  - **Controlled stop from 5 kn:** textbook technique (revs down → ~0.8 s in neutral → R1 → R2) stops in about 1.2 boat lengths. Neutral alone coasts about 3.8 lengths.
- **Approach angle (T10.5):** measured as **course over the ground** when the boat comes abeam of the berth's span within `berthSwingBL` (2.5 lengths), the point where p.109 Step 2 starts the swing. It is measured on the track rather than the heading, so leeway in a cross-wind doesn't read as a wrong angle.
- **Neutral before alongside (T10.6):** the hull must be in N (or reverse) by the time any part of it is within 1.5 m of the berth. This follows p.109 Step 3: "with the bow's shoulder getting close". The `how` text in criteria.js was updated to match. It replaces the earlier "one boat length" draft, which would have failed the workbook's own technique, since Step 2 is done in gear.
- **MOB (T7.4–7.6):** scored only on the **final** approach, which is the last time the boat comes inside 20 m heading in. Earlier passes that leave again don't count. Prop-strike / engine-near-person checks start 4 s after the drop, measured at the propeller.
- **Berth side (T10.3):** follows p.108. Bow into the combined wind/current when it runs along the berth. Either side is fine when the drift is negligible or runs across the berth (more than 50° off the berth line). The textbook script picks the side the wind sets you onto.
- **Transit (T8):** the 30 s hold only counts after you've named a pair. Naming is checked against the real pairs in `venue-layout.json` from where the boat is (within about 8°).
- **Speed zones (T1.1/T1.2):** T1.1 counts strikes for going over 8 kn (+0.5 kn grace, 3 s) within 50 m of moored boats, the jetty or the shore. T1.2 counts strikes for the **Rockingham foreshore 8-knot strip**, about 200 m from shore (DoT South Metro guide, side 1; `rock-8kn-strip`), and for being within 50 m of the MOB or 15 m of a vessel under way. Two strikes miss the criterion.
- **Traffic:** one other ramp user motors in and holds off about 40 m out. Getting within 10 m ahead of it, inside its path, misses T6.4/T10.2.
- **Removed:** a straight forward↔reverse shift no longer also costs T1.3. B's how-text says gear abuse is scored once, under T6.6 / T9.4 / T10.6.
- **Steerage (T7.5):** `steerageMax` was raised from 3 to 3.5 kn, because idle in gear on this boat is about 2.5–3 kn ("medium difficulty").

### Checks
- `node tools/skippers/sim-criteria-check.mjs` checks the 62 criteria, the per-task counts, the page receipts and the game-threshold labels.
- `node tools/skippers/sim-check.mjs` (`--verbose`, `--only=<name>`, `--dbg`) runs 20 textbook drills (both presets), 8 bad runs with exactly the intended misses, and 2 full assessments at 62/62 including N/A. It also checks determinism.
  - The bad runs and their intended misses: straight F→R shift → T9.3, T9.4. No look behind → T9.1. No head-check on departure → T6.1. MOB approached from upwind → T7.4. A 70°+ docking → T10.5. Started in gear → unsafe (T4.7, T4.9 never reached). "Back soon" ETA → T5.8.
- `node tools/skippers/sim-page-check.mjs [base]` checks 1440 px in light and dark: zero console errors, both GLBs ready, the fps sample (≈180 fps on the d3d11 GPU path), and screenshots in `Documents/skippers/sim/shots/` (git-ignored).

### Sanity-check after tomorrow (main agent's list)
- The boat type and controls. Was it a single-lever binnacle outboard? How many notches felt like "low revs"?
- Which transit ABC actually used. The game offers the jetty light pole with the big tree behind the ramp (t1), the light pole with a Norfolk pine (t2), and the Palm Beach jetty head (t3, provisional).
- Which berth side, and whether ABC docks bow-in alongside the centre jetty or somewhere else.
- When the MOB was sprung, and whether the engine had to be **off** (key) or just **out of gear** for the pick-up. The game requires the key off (p.104 "Engine off").
