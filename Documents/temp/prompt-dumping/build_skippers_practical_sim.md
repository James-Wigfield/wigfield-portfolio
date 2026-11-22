# Build: `/skippers` practical-assessment simulator ("Drive it")

You're building a desktop 3D boat-driving game that simulates the **WA Recreational Skipper's Ticket (RST) practical assessment**. It goes on the existing public study site `/skippers` in this repo (`C:\Users\james\Documents\personal-projects\wigfield-portfolio`).

James sits the real practical **tomorrow (Mon 23 Nov 2026) with ABC (Australian Boating College) at the Palm Beach boat ramp, Rockingham**. He wants to practise on this **tonight**.
- **Hard timebox: 2 hours, wall clock.** A playable, correctly scored game beats polish every time.
- His cousins will use it later too.

## Hard rules
- **Git: stay on the current branch.** Run `git branch --show-current` (it should be `main`) and do all work there. Don't create, switch or check out branches, and don't use git worktrees. This applies to every subagent too, so tell them.
- **Don't touch other sessions' work.** These files are uncommitted work from another session: `.claude/skills/memory-render/SKILL.md`, `tools/memory-rooms/DECISIONS.md` and `Documents/memory-rooms/handovers/`. Never edit, stage or commit them. Stage your own files by explicit path; never use `git add -A` or `git add .`.
- **Local only.** Commit on `main` at the end. Do **not** push, and do **not** deploy (no `wrangler deploy`). James will test locally and deploy it himself.
- **Downloads:** only official PDFs from `transport.wa.gov.au` (see Sources), saved into the git-ignored `Documents/skippers/source/`.
- Use the **Claude in Chrome** tab group for any web browsing. Make one `tabs_context_mcp` call with `createIfEmpty: true`, then open your own tabs.
- Don't add a password or auth layer. The site is public and unlisted (`noindex`), like the rest of `/skippers`.

## Read first (≈10 min, no more)
1. Memory file `C:\Users\james\.claude\projects\C--Users-james-Documents-personal-projects-wigfield-portfolio\memory\project_skippers.md`, plus the three feedback memories it links: `feedback_visual_labs.md`, `feedback_engaging_learning_pages.md` and `feedback_no_ai_callout_styling.md`.
2. Vault note `C:\Users\james\Documents\james-claude-brain\01-Active-Projects\wigfield-portfolio-skippers.md` (CLAUDE.md asks you to check the vault at session start).
3. `src/skippers/labs/Practical.jsx`, which holds the existing 11-task checklist and radio scripts. Reuse its content; don't duplicate it. Also read `src/skippers/labs/index.js` (the `VIEWS` registry), `src/skippers/content/levels.js` (the `practical` level) and `src/skippers/pages/LevelPage.jsx` (how `kind: 'custom'` views render).
4. **The official practical criteria.** These are in Workbook ch.10, printed p.91–112, in `Documents/skippers/source/workbook-pages.txt` (search for "Task 1 – The vessel is safely operated"). Printed page = PDF page − 2. The PDF itself is `MAC_P_RST_Workbook2026.pdf` in the same folder.
5. The Memory Rooms Blender pipeline, as the pattern to copy:
   - `tools/memory-rooms/build.mjs` and `bake.mjs`, which spawn headless Blender, Cycles-bake the lighting and export a meshopt GLB
   - `tools/memory-rooms/lib/api.mjs`, where `BLENDER` = `C:/Program Files/Blender Foundation/Blender 5.2/blender.exe`
   - `tools/memory-rooms/blender/common.py` and `materials.py`
   - Memory: `reference_headless_soak_kit.md`, which covers puppeteer-core with local Edge (the `d3d11` flag gives real fps)

## Sources of truth (official first)
- **DoT RST Workbook, 8th ed. (July 2026), ch.10.** This is THE spec. It has 11 tasks and 62 criteria, and you pass with **at least 56 of 62 ("six wrong or less")** (p.6, p.91). The per-task criteria counts are **4, 3, 3, 9, 8, 7, 8, 2, 7, 9, 2 = 62**.
  - Task 1 is assessed throughout the run.
  - **Unsafe skippering is an immediate fail** at any point (p.91).
  - If you miss more than 6, the assessment may be stopped.
  - Only one practical attempt is allowed per day (p.6).
  - Criteria 1–8 of Task 4 must all be done before starting the motor.
  - Only the Task 4 criteria that apply to the boat count. For an outboard, "fuel fumes" applies to inboards only, so mark it N/A and note it.
- **DoT "Get a Recreational Skipper's Ticket" page** (transport.wa.gov.au › marine › … › get-rst). It lists the same 11 tasks. Known wording differences:
  - It says "fewer than 6 wrong", but the workbook says 56/62. **Follow the workbook.**
  - Its Task 2 says "anchors, lines and equipment", but the workbook says mooring and berthing equipment.
  - It says the practical takes about 1 hour; the workbook says about 30 minutes.
  - Record all of these in the run notes.
- **DoT South Metropolitan Boating Guide** (2 pages): `https://www.transport.wa.gov.au/getmedia/A070EAA6-6B25-4AF5-8C93-4BD547CAEE03/mac_g_boating_south_metro.pdf`. James approved downloading it: save it to `Documents/skippers/source/` and extract its text. It covers the local speed-restricted areas and hazards around Rockingham / Palm Beach. **Every local rule in the game must come from this guide or the workbook, with a receipt.** If it doesn't confirm a rule, the game doesn't invent one.
- **ABC (provider):** `abcboating.com/training-centres/western-australia/perthsouthern/`.
  - The practical is "11 on water tasks".
  - ABC trains you on each task first ("practise each task until you are confident"), then assesses.
  - ABC's training videos (`abcboating.com/how-to-train-videos/`) cover docking in strong wind and the man-overboard drill.
  - Don't put staff names or phone numbers in the site.

### Official verification is a deliverable, not a vibe
Create `src/skippers/sim/criteria.js` with **exactly 62 entries**. Each entry has:
- `{ id: 'T7.4', task: 7, n: 4, text }`, where `text` is in our own words, short, and faithful to the workbook
- `page` (the printed workbook page)
- `how`: what the game measures
- `threshold`: a reference into `thresholds.js`, or `null`
- `kind`: `'measured' | 'action' | 'dialogue' | 'na'`

Then write `tools/skippers/sim-criteria-check.mjs`. It asserts:
- the per-task counts above and the total of 62
- every entry has a page in 91–112
- every task title matches the workbook's 11 titles
- every threshold the game invents is labelled in the UI as a **game threshold** and never presented as a DoT rule (for example "appropriate revs", the transit tolerance, "little or no impact")

Re-read ch.10 line by line against the file before you call it done.

## The venue: Palm Beach boat ramp, Rockingham. Get this exactly right
- **The ramp is the eastern one, with a narrow fixed jetty running down the middle between two launching lanes**, and rock revetment on both sides.
  - The Street View pano James chose is at about **-32.27569, 115.71675** (pano id `hkJyp6FInXYqglHZyQVZDA`, July 2024).
  - The ramp heads roughly **NNE (≈20° true)** into Cockburn Sound.
  - The satellite view James chose is centred at **-32.27574, 115.71655**.
- **Don't confuse it with the ramp/groyne about 120 m to the WEST** (by the Rotary Beach Front toilets and the big trailer car park). That one is **closed for renovations**: model it as a fenced-off, out-of-use structure, or leave it as background. Google's pin labelled "Palm Beach Boat Ramp (West)" sits between the two, so don't trust the label.
- **What's visible from the ramp:**
  - moored yachts and small boats a short way off the ramp to the north
  - Polo Beach sand to the west
  - beach and Norfolk pines along the Esplanade to the east
  - the long Palm Beach jetty further east
  - Garden Island low on the horizon to the NW/W
  - industrial shoreline far to the NE
  - a light pole at the jetty head
- **Measure, don't guess.** In Chrome, open the satellite view at about 1:500 with the scale bar and measure:
  - lane widths
  - jetty length and width
  - the ramp's angle
  - the extent of the rock walls
  - distances to the nearest moorings
  
  Write the numbers and the method in `Documents/skippers/sim/layout.md`, the same way Memory Rooms does layout.md. Use Street View for heights, materials and colours.
- **Conditions:** sheltered water in Cockburn Sound, mostly flat with a light chop.
  - Offer presets "Morning: light easterly" and "Afternoon: SW sea breeze".
  - Wind is 5–15 kn, plus a weak current. Randomise within the preset.
  - Label these as *game conditions*.

## What to build
Route: a new step on the Practical level, `{ id: 'drive', label: 'Drive it', kind: 'custom', view: 'Drive' }`, which gives **`/skippers/practical/drive`**.
- `Drive` **lazy-loads** the whole sim chunk (`React.lazy`), so the rest of `/skippers` doesn't grow.
- Code lives in `src/skippers/sim/`.
- GLBs go in `public/skippers-sim/`.
- Stack: three, @react-three/fiber and drei, all already installed. Keep to the `.sk` scope and `sk-` prefix styling and the site's chart-paper / night-sea identity.

### Modes
1. **Assessment:** one continuous run in a realistic order.
   1. The boat starts launched and tied at the centre jetty.
   2. T2 lines and berthing gear check.
   3. T3 briefing.
   4. T4 pre-start.
   5. T5 log on.
   6. T6 depart.
   7. T8 transit.
   8. T9 controlled stop.
   9. T7 MOB, triggered at a random moment.
   10. T10 return and dock.
   11. T11 log off.
   
   T1 is checked the whole time.
   - An assessor gives each instruction as a caption ("When you're ready, take us off the berth").
   - The scoresheet stays hidden until the end. Then show all 62 lines, each with pass, miss or N/A, why, and the workbook page.
   - Pass means at least 56. An unsafe act ends the run immediately with the reason.
2. **Drills:** pick any task, start in the right spot, retry instantly, and optionally show a ghost line of the textbook path. **Medium difficulty.** ABC isn't trying to fail people, so thresholds should be fair and forgiving at the edges, and every threshold lives in one `thresholds.js`.

### Controls (desktop first; touch is out of scope tonight)
The model is a real single-lever binnacle control plus a steering wheel.
- **W / S** move the lever one notch at a time: R2 R1 **N** F1 F2 … F6. The lever **stays where you leave it**, so nothing is hold-to-go. Neutral has a detent.
- **A / D** turn the wheel, which holds its position. **C** centres it.
- **Mouse** looks around the helm. Looking around is how head-checks are detected: you must actually look behind or to the side before moving off or stopping.
- **Space** shouts the call for the current context: "Man overboard, starboard side!", "Hold on, stopping!", "Engine off".
- **E** interacts with a hotspot. **Tab** opens the radio.
- **Gamepad** (browser Gamepad API): left stick steers, D-pad up/down or the bumpers step the lever, A interacts. Don't map "RT = go, LT = reverse", because it teaches skipping neutral.
- Show an on-screen binnacle with the lever position, a wheel angle indicator, a speed readout in knots, a wind arrow and a compass.

### Boat and physics (the bit that must feel right)
- **The boat:** a ~5.5 m outboard runabout with a centre console, wheel steering and roughly 90–115 hp. The exact ABC boat is unknown; note this as an assumption.
- **The model:** a custom planar 3-DOF model (surge, sway, yaw) on a fixed **60 Hz** step. It must be deterministic and run in Node with no DOM, so the checks can drive it.
- **Thrust** is vectored at the transom along the outboard leg's angle. That means:
  - the stern does the turning;
  - there's almost no steering in neutral;
  - steering astern behaves like the workbook's outboard docking steps (p.100, p.108–109).
- **Drag** is quadratic, with high lateral resistance. Windage pushes the bow downwind, and current is a water-velocity field.
- **Gear changes:** a straight forward-to-reverse shift with no pause in neutral is recorded as not "smooth and timely" (p.106). Reverse at high revs mostly churns.
- **Tuning:** with correct technique (revs down, neutral pause, firm reverse) the boat can stop from 5 kn **within 2 boat lengths**. Sloppy technique overshoots.
- **Collisions:** 2D hull polygon against the jetty, piles, rocks and moored boats (SAT). The contact impulse grades "little or no impact". Hitting a person or a vessel hard is unsafe, which is an instant fail.
- **Visuals:** heave, pitch and roll are cosmetic. Add a wake trail, and render the water in the engine (a three `Water`-style shader or simple Gerstner waves).

### How each task is scored (map each to criteria.js)
- **T1 (throughout):**
  - speed zones, taken only from the South Metro guide and the workbook, with receipts
  - wash and speed near moored boats and swimmers
  - keeping to the starboard side and passing port to port
  - passengers seated
  - the boat's registration sticker visible and current
- **T2:** inspect lines and cleats via hotspots, then secure. One line is sometimes frayed; using it misses T2.1.
- **T3:**
  - point at each item of required safety gear
  - choose the wearing rule for the area of operation (the workbook's 2026 rules: sheltered / within 400 m / beyond)
  - then the "Does everyone understand?" check
- **T4:** hotspots for the fuel line and bulb, the fuel gauge, the cooling intakes on the leg, the kill lanyard, the lever in neutral, and a look around the prop (sometimes a swimmer is there), then the key.
  - Order is enforced.
  - Starting in gear, or with someone near the prop, is unsafe.
- **T5 / T11:** a radio composer reusing the `Scripts` content.
  - Vague answers fail: "soon", "plenty", "a couple of hours".
  - Times must be HHMM and fuel must be in litres (p.97–98).
- **T6:** the head-check is detected, the wind side matters, impact is graded, other vessels must not be impeded, revs and gear changes are checked, and the lines must be stowed (a trailing line fouls the prop).
- **T7:**
  - steer toward the side they fell from within a few seconds
  - throw an aid and assign a watcher
  - come back from downwind / up-current, measured as approach angle against the wind/current vector
  - minimum steerage speed
  - **engine off before the pick-up**, and no engine running within one boat length of the person
  - retrieve
- **T8:** **using real objects at this venue** (for example the jetty-head light pole lined up with a Norfolk pine or building on the Esplanade, or a moored landmark), the player names the two objects, then holds the line for **30 s** within a cross-track tolerance.
- **T9:** from about **5 kn**:
  - look behind
  - shout
  - revs down
  - neutral
  - reverse
  - appropriate revs
  - stopped within 2 boat lengths (measured)
- **T10:**
  - look around and don't impede other boats
  - choose the berth side from wind and current
  - approach speed
  - an approach angle of **30–45°** (measured)
  - smooth gears and low revs
  - impact graded
  - secure with the correct lines (bow, stern, springs; p.111)

## The Blender assets (headless, the Memory Rooms way)
Put the scripts in `tools/skippers-sim/blender/`, driven by `tools/skippers-sim/build-assets.mjs`. Spawn `BLENDER -b --factory-startup --python …` the way `tools/memory-rooms/build.mjs` does.
- **`venue.glb` (≤ 6 MB):**
  - the ramp lanes and the centre jetty with piles, cleats and the light pole
  - the rock revetments and the beaches
  - the Esplanade edge, the Norfolk pines and the grass
  - the moored boats (low-poly)
  - the closed west ramp, fenced
  - the Palm Beach jetty in the distance, Garden Island as a low silhouette, and the transit objects
- **`boat.glb` (≤ 2 MB):**
  - the hull, with the outboard, wheel and lever as **separate named nodes** so they can animate
  - **named empties for every hotspot**: `hs_fuel_bulb`, `hs_fuel_gauge`, `hs_intakes`, `hs_lanyard`, `hs_key`, `hs_lifejackets`, `hs_epirb`, `hs_flares`, `hs_extinguisher`, `hs_bilge`, `hs_anchor`, `hs_radio`, `hs_rego`, `hs_cleat_bow`, `hs_cleat_stern`, and so on. The game finds them by name; document the contract in `src/skippers/sim/ASSETS.md`.
- **Bake and export:** bake lighting for the static venue, then meshopt-compress the GLBs. Keep the collision footprint polygons as simple named meshes or in a JSON sidecar.
- **If Blender slips past T+1:20,** ship the procedural three.js greybox of the same layout and keep the GLB loader behind a flag. The game being playable tonight matters more than the art.

## How to split the work (3 agents, same branch, separate folders)
Launch two subagents early, in one message, with tight briefs. Tell both: stay on `main`, no worktrees, no commits, only touch your own folder.
- **Subagent A, Blender assets.** Owns `tools/skippers-sim/`, `public/skippers-sim/` and `Documents/skippers/sim/layout.md`. It does the venue measurement (Chrome tab group) and the GLBs, and reports sizes and node names.
- **Subagent B, official criteria and scoring content.** Owns `src/skippers/sim/criteria.js`, `thresholds.js`, the assessor captions, the scoresheet data and `tools/skippers/sim-criteria-check.mjs`.
  - It downloads the South Metro guide and records the local rules with receipts.
  - It writes `Documents/skippers/sim/run-notes.md` with every source discrepancy and every game threshold.
- **You (main):** physics, controls, camera, the game loop, the criteria *engine* (event detection, using B's data), the drills, assessment mode, the UI, integration and checks.

## Checks (must pass before you commit)
- `node tools/skippers/sim-criteria-check.mjs`: 62 criteria, the correct per-task counts, page receipts.
- `node tools/skippers/sim-check.mjs`: headless and deterministic.
  - Scripted **textbook** input runs for every task, and one full assessment, must score **62/62** (with N/A counted correctly).
  - Scripted **bad** runs must miss exactly the intended criteria:
    - a straight forward-to-reverse shift
    - an approach from upwind on the MOB
    - starting in gear (unsafe → fail)
    - logging on with "back soon"
    - a 70° docking angle
    - no head-check
- **Page check** (puppeteer-core + local Edge, per `reference_headless_soak_kit.md`):
  - `/skippers/practical/drive` at 1440 px in light and dark
  - zero console errors
  - the GLBs load
  - an fps sample is logged
  - screenshots saved to `Documents/skippers/sim/shots/`
- Regressions:
  - `node tools/skippers/check-questions.mjs`
  - `node tools/skippers/site-check.mjs`, with `MSYS_NO_PATHCONV=1` in Git Bash
  - `npm run build`
  - lint the new folders only

## Timebox milestones
- **T+0:15:** read-through done, subagents launched, greybox scene driving.
- **T+1:00:** physics tuned (docking an outboard feels plausible; the 5 kn stop works), and the criteria engine scores T6, T7, T8, T9 and T10.
- **T+1:30:** hotspot and radio tasks done, assessment mode end-to-end, scoresheet done, GLBs integrated (or the greybox fallback).
- **T+1:50:** all checks pass, commit on `main` (no push, no deploy).
- **T+2:00:** stop. Write up what's left.

## Finish
1. **Commit** only your files, with a clear message and the attribution lines the session gives you.
2. **Docs:**
   - Update the memory file `project_skippers.md` and its `MEMORY.md` line: add the sim, how to add a drill or criterion, the checks and the asset pipeline.
   - Update the vault note `wigfield-portfolio-skippers.md` and add the dev log `03-Dev-Logs/2026-11-22-skippers-practical-sim.md` with [[wikilinks]] to `wigfield-portfolio-skippers` and `memory-rooms`.
3. **Report to James** in a few bullets:
   - the local URL to open (`npm run dev` → `/skippers/practical/drive`)
   - the controls cheat-sheet
   - what's verified against the workbook
   - the game thresholds he should sanity-check after tomorrow (the boat type, the transit objects ABC actually used, the berth side)
   - what's left
