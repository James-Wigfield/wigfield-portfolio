# Build brief — Barista Express Impress care guide (portal · Personal)

> Paste this whole file into a fresh Claude Code session started at the repo root
> (`C:\Users\james\Documents\personal-projects\wigfield-portfolio`). It is the complete brief.

---

## ⚠ Run fully autonomously — James is away from the computer

James is sending this brief and leaving. **Nobody will be there to answer you, so do not stop and
wait for input at any point.**

- **Do not use plan mode** (`EnterPlanMode` / `ExitPlanMode`), and do not ask for plan approval.
- **Do not use `AskUserQuestion`,** and don't end a turn with a question.
- When a decision comes up, take the option that best fits this brief and James's recorded
  preferences, write it down in `Documents/portal/barista-guide/decisions.md` (one line each:
  decision · why), and keep going.
- If something is genuinely blocked (a source won't load, a tool fails), work around it or degrade
  gracefully, note it in `decisions.md`, and carry on with everything else.
- Work through every phase in §11 to the end, including the verification and documentation steps,
  in one uninterrupted run. Stop only when the §14 definition of done is met or truly nothing else
  can be done without him.

---

## 0 · Mission

Build a new **Personal** tool in James's management portal (`/portal`): the most visual, most
accurate, most usable care guide for **his** espresso machine — a **Breville Barista Express
Impress, model BES876, Australian (ANZ) version**, now about **six months old**, with dried milk
already building up on the steam wand.

It replaces a single-page HTML guide that James's phone Claude wrote for him
(`Documents/portal/barista-guide/barista-guide-reference.html`). James hasn't read that page, and it
was written without the manual. Keep essentially all of its content, but restructure it, correct
it against Breville's own documentation, and fill the gaps (§4 lists what I already found).

The guide covers two things:

1. **The six-monthly deep clean.** A tutorial and explainer James follows step by step, at the
   machine, on his phone, with animated diagrams for every step and real follow-along timers.
2. **The weekly (and per-drink / daily) routine.** An explainer plus a resettable weekly checklist
   that keeps the machine healthy between deep cleans.

**The more visual, the better.** James explicitly wants animated diagrams and motion graphics.
Treat every procedure as a scene to animate, with text supporting it. Never write prose first and
add a picture later.

The bar is "the best cleaning guide for this machine that exists". It should beat Breville's own
manual and video guides by being complete (every official care procedure), correct (each step cites
a manual page), sequenced (an optimised deep-clean schedule), and fun to use.

---

## 1 · Orientation (do this before planning)

1. **Project memory.** Per `CLAUDE.md`, read the vault project notes:
   `C:\Users\james\Documents\james-claude-brain\01-Active-Projects\wigfield-portfolio.md` and
   `...\wigfield-portfolio-management-portal.md`. Your auto-memory index (`MEMORY.md`) will load on
   its own. Read these memory files in full: `project_management_portal.md`,
   `feedback_no_ai_callout_styling.md`, `feedback_engaging_learning_pages.md`,
   `reference_headless_soak_kit.md`.
2. **The reference page.** Read `Documents/portal/barista-guide/barista-guide-reference.html` in
   full, including its script (gauge needle sweep and localStorage checklist).
3. **Portal conventions.** Read these, in this order:
   - `src/components/portal/registry.js`: the header comment explains how to add a tool (one
     component plus one `MODULES` entry; `Portal.jsx` never changes).
   - `src/components/portal/portal.css`, lines 1–160: the theme token contract (`--ground`,
     `--ground-2`, `--surface`, `--surface-hi`, `--ink`, `--ink-2`, `--ink-3`, `--text-faint`,
     `--line`, `--line-2`, `--accent`, `--accent-ink`, `--accent-soft`, `--accent-pale`,
     `--signal`, `--warn`, `--error`, `--error-soft`). There are three themes: `jade` (default),
     `coral`, and `arcade` (dark).
   - `src/styles/home.css`, top: the font variables `--font-display` (Fraunces), `--font-body`
     (Hanken Grotesk) and `--font-mono` (IBM Plex Mono).
   - `src/components/portal/portalRoute.js`: `usePortalRoute()` for deep-linkable sub-routes.
   - `src/components/portal/icons.jsx`: there is **no coffee icon yet**. Add one (for example
     `cup`) in the same single-colour stroke style as its neighbours. Never use emoji.
4. **The reference implementations to copy from.** Skim these for the pattern; don't refactor them.
   - `modules/america/AmericaFirstPlan.jsx` + `america.css`: a multi-tab Personal-style tool with
     a data model, SVG maps, and localStorage-persisted checklists with a progress meter.
   - `modules/deep-learning/common.css` + `kit.jsx`: the sticky numbered tab bar with visited
     marks, `Hook` / `Fact` / `Unfold` / `Outline` / `Sub` / `Jot`, and level-select grids. You may
     import `kit.jsx` components directly if they fit, or mirror the patterns.
   - `modules/PortaraMotion.jsx` / `PortaraMotionNeon.jsx`: **the GSAP recipe for this repo**
     (stroke-twin line draws, clipPath rect wipes, IntersectionObserver-triggered paused
     timelines, the replay contract). GSAP 3.15 is already a dependency.
   - `modules/training-runs/kit.jsx` → `.trx-verdict`, `.trx-findings`, `.trx-next`: the
     sanctioned way to show tone or status (a labelled dot on a ruled layout).

---

## 2 · Source of truth — Breville's own documentation

**Primary source: the official ANZ instruction book (32 pages).**
`https://assets.breville.com/BES876/BES876_ANZ_IB_QA_C22_WEB.pdf`

Download it into your session scratchpad (not the repo) and extract it. `pdftotext` is on PATH via
Git Bash (`/mingw64/bin/pdftotext`):

```bash
curl -sSL -o BES876_ANZ_IB.pdf "https://assets.breville.com/BES876/BES876_ANZ_IB_QA_C22_WEB.pdf"
pdftotext -layout BES876_ANZ_IB.pdf ib.txt
```

The page map I confirmed (printed page numbers, used as citation receipts below):

| IB page | Content |
|---|---|
| p.6 | Features: Thermocoil heating, PID, conical burrs, Impress puck system (10 kg tamp, 7° twist), dedicated hot water spout |
| p.7–8 | Components and box contents (A–L: portafilter, jug, filter holder + filter, 4 baskets, cleaning tablets, Allen key, steam-tip cleaning tool, cleaning disc, descaling powder, cleaning brush) |
| p.9–11 | First use: water filter install, cold potable tap water, **no highly filtered / demineralised / distilled water** |
| p.15 | Grinder purge (hold DOSE; auto-mode re-insert nuance) |
| p.16 | Group head purge (1 CUP short flow before inserting the portafilter) |
| p.18–19 | Steam wand purge after every milk drink |
| p.20 | Adjusting the upper burr (the number ring — **not** a cleaning step) |
| p.21 | Alerts (hopper not locked, low beans, tamp lever not home) |
| p.22 | Replacing the water filter · **Cleaning cycle** |
| p.23 | **Descaling** |
| p.24 | Cleaning conical burrs · Advanced grinder cleaning (blockages only) |
| p.25 | Tamp system · Steam wand · Baskets & portafilter · Shower screen · Drip tray & storage tray |
| p.26–27 | Outer housing · Storing · Warnings · **Using the Allen key (shower screen + silicone seal)** |
| p.28–30 | Troubleshooting (several maintenance-related rows) |
| p.32 | Breville AU customer service: 1300 139 798 |

**Secondary source: Breville's BES876 product hub, "Cleaning Guides".** These are 12 short videos.
Try the `en-au` locale first and fall back to `en-us`, for example
`https://www.breville.com/en-us/my-products/producthub/bes876/cleaning-guides`. The 12 guides are:
cleaning cycle · clean portafilter & basket · clean shower screen · clean drip tray · clean grinder
conical burrs · group head purge · filter basket rinse · steam wand purge · replace the water filter ·
descale · **clear water backflush** · clean and unblock the steam wand.

The pages are video-only, so WebFetch returns no steps. Link to them from the matching step
("Watch Breville's 1-min video") and don't scrape them. Sage (the UK brand name) mirrors them at
`sageappliances.com/inspiration/en-gb/tutorials/the-barista-express-impress/...`.

**Accuracy rules (non-negotiable):**

- Every procedural step carries a small mono receipt citing its source, for example `IB p.23` or
  `Breville video`.
- **Never invent a button combination, hold time, duration or volume.** If neither the IB nor a
  Breville page gives it, the guide doesn't state it.
- Anything that comes from general espresso practice rather than Breville (the community
  rule-of-thumb kind) is labelled as a **tip**, visually distinct from manual steps, and kept to a
  minimum.
- Estimates (for example "the light tends to flash about monthly") are either removed or clearly
  labelled as estimates. The machine's maintenance light is the authority.
- Use Australian spelling and units (litres, °C, "colour").

---

## 3 · Where it lives in the code

- **Folder:** `src/components/portal/modules/barista/`.
- **Registry entry** (append to `MODULES` in `registry.js`):
  `{ id: 'barista-guide', label: 'Barista · Machine Care', icon: 'cup', group: 'Personal', component: BaristaGuide }`.
  The `id` becomes the deep link (`/portal/barista-guide`), so pick it once and never change it.
- **CSS namespace:** `.bxi-*` (Barista eXpress Impress). It's unused anywhere in `src/`; keep it
  that way. Use one stylesheet per concern if the file gets large (`barista.css`, `scenes.css`).
- **Suggested file layout** (adjust if you find a cleaner split):

```
modules/barista/
├── BaristaGuide.jsx        # shell: tab bar, sub-route sync, hero
├── barista.css             # .bxi-* layout, tabs, step player, chips
├── content.js              # ALL copy + step data (no data exports from .jsx — react-refresh lint)
├── schedule.js             # deep-clean task graph + scheduler (pure functions)
├── careLog.js              # localStorage care log + due-date maths (pure, try/catch-wrapped)
├── Machine.jsx             # the shared, state-driven SVG of the BES876 (see §6.1)
├── scenes/                 # one file per animated scene, each a paused GSAP timeline
│   ├── SceneDescale.jsx
│   ├── SceneCleanCycle.jsx
│   └── …
├── FollowAlong.jsx         # real-time timer runner + wake lock
└── tabs/                   # one component per tab
```

- **Sub-routes:** the active tab, and the active deep-clean step, live in the URL via
  `usePortalRoute()`, for example `/portal/barista-guide/deep-clean/4`. James will bookmark the deep
  clean on his phone.

---

## 4 · Audit of the reference page (what I already verified against the IB)

The reference's core procedures are right. Its gaps and styling are the problem.

### Keep: verified correct

- **Maintenance light:** flashing means run a **cleaning cycle**; solid means **descale** (IB p.22,
  23, 30). The IB calls it the "CLEAN / DESCALE" light.
- **Cleaning cycle** (IB p.22): 1 CUP basket, then the cleaning disc, then one tablet. Lock the
  portafilter in, put a large container under it, check the tank is full of cold water and the
  drip tray is empty. Press POWER to turn the machine off, then hold **1 CUP + 2 CUP + POWER for
  3 s**. The cycle runs **about 5 min**, flushing water into the portafilter and back into the group
  head, and **no water should come through the portafilter**. Check the tablet has dissolved and
  repeat if it hasn't. Then remove the disc and press **2 CUP** to rinse. It's a back-flush and is
  separate from descaling.
- **Descale** (IB p.23): take the filter out first. Dissolve one sachet in **1 L** of water. With the
  machine off, hold **2 CUP + POWER for 5 s**; POWER and 2 CUP flash while it heats. It's ready when
  POWER, 2 CUP, CLEAN/DESCALE and HOT WATER/STEAM are all solid. Then:
  - **2 CUP** runs the coffee path for about **25 s**.
  - The dial **right** runs steam for about **13 s**.
  - The dial **left** runs hot water for about **8 s**.
  - After one round about **0.5 L** remains, so repeat until the solution is used up.
  - Rinse the tank, refill it to **2 L**, and repeat the rounds with fresh water.
  - Press **POWER** to exit.

  It auto-offs after **5 min** idle; restart from the button hold. Don't use bottled water when
  descaling.
- **Water filter** (IB p.22): soak it **5 min** in cold water, rinse **5 s** under the tap, clip it
  into the holder, set the date dial **3 months ahead**, and push it down to lock. Change it sooner
  in hard-water areas.
- **Steam wand** (IB p.19, 25): wipe and purge after every milk drink. For blocked holes, set the dial
  to STANDBY, switch off, let it cool, then use the pin. If it stays blocked, unscrew the tip with
  the tool's spanner, soak it in hot water, pin the holes, and refit it.
- **Burrs** (IB p.24): empty the hopper, run the grinder empty, then remove the hopper and unlock
  and lift the top burr. Brush the top and lower burrs, take off the tamp cover, brush the chute,
  and put everything back.
- **Tamp system** (IB p.25): take off the tamp cover and brush the tamp face and cradle. Hold the
  lever down and brush around the tamp, then release it slowly with the brush clear.
- **Baskets and portafilter** (IB p.25): rinse them hot after every use and pin blocked holes. To
  soak, dissolve a tablet in hot water and soak them for about **20 min**, then rinse.
- **Shower screen wipe and group head purge** (IB p.16, 25): wipe with a damp cloth, then run a
  short 1 CUP flow through an empty basket.
- **Drip tray and storage tray** (IB p.25): grid, grounds separator, and the full indicator (it pulls
  up to release its side latches). Warm soapy water and a soft cloth.
- **Don'ts:** no dishwasher, no abrasives, no alkaline cleaners (IB p.25–26). No highly filtered,
  demineralised or distilled water (IB p.11). Use cold water. Never wash the burrs with water.
- **Box contents and restock:** the box came with two tablets and one sachet (from James's photo).
  The restock list stays: tablets, descaler, filters, and a silicone seal.

### Add: missing from the reference

1. **Shower screen removal and seal inspection with the Allen key** (IB p.26–27). The reference
   only mentions the Allen key for "changing the seal". The IB procedure:
   - Turn the machine off and unplug it. Remove the tank and drip tray.
   - Clean the screw's centre with a skewer.
   - Insert the **short end** of the Allen key and turn it **counter-clockwise**.
   - Keep the screw and screen, and **note which side of the screen faces down**.
   - Wash the screen in warm soapy water and dry it.
   - (Seal swap only) Pull the old seal out with fingers or long-nose pliers. Fit the new seal
     **flat side first, ribbed side facing you**.
   - Refit the screen and screw: finger-turn **2–3 revolutions**, then tighten with the Allen key
     until the screw is flush.

   Washing behind the screen is the most valuable six-monthly job missing from the reference. Seal
   replacement is a when-needed branch ("water leaks around the portafilter / it locks in loosely").
   That trigger comes from the reference, not the IB, so label it as a tip.
2. **Clear water backflush.** Breville has an official BES876 video guide for it, but **the IB
   doesn't describe the procedure**. It's a natural weekly item. Include it **only if** you can get
   the exact steps from a Breville or Sage page. Otherwise show it as "Breville has a guide for
   this", link the video, and don't invent steps.
3. **Advanced grinder clean** (IB p.24, blockages only):
   - Remove the hopper. Set GRIND SIZE to **1**.
   - Loosen the nut with a **10 mm socket**, turning it clockwise.
   - Set GRIND SIZE to **25**. Remove the top burr, then the nut, spring washer and flat washer,
     then the lower burr.
   - Remove the grind fan and washers with long-nose pliers. Unblock the chute with the brush or a
     pipe cleaner.
   - Reassemble: **felt washer → metal washer → grind fan**, then the lower burr (align the drive
     pin to its cavity), then the flat washer and spring washer. Tighten the nut by turning it
     counter-clockwise.
   - Fit the top burr, set GRIND SIZE to **16**, and replace the hopper.

   After this James has to re-dial his grind. That belongs in the Fix-it tab, not the routine.
4. **Grinder purge nuance** (IB p.15): hold DOSE to purge. In **auto mode** you then have to remove
   the portafilter, discard the grinds, and re-insert it to get back to standby.
5. **Troubleshooting** (IB p.28–30), maintenance-relevant rows only:
   - Will not grind or grinds for very long → chute blocked, or coffee build-up in the cradle.
   - Lever very hard to tamp → coffee build-up in the mechanism.
   - Puck surface not flat → grinds stuck on the tamp face.
   - No steam → wand blocked.
   - Light flashing or solid → see above.
   - Water doesn't flow → tank empty or not seated.
6. **Storing the machine** (IB p.26), for a holiday. James is away in the US over Dec–Jan, so this is
   genuinely useful: empty the hopper, clean the grinder, empty the tank and tray, and store it
   upright.
7. **The tank-emptying tension.** IB p.26 warns the tank "should never be removed or completely
   emptied during decalcifying", while p.23 says to repeat rounds "to empty the solution", and p.10
   says the machine won't operate below **MIN**. Show this honestly: run rounds down to MIN, and
   don't lift the tank out mid-cycle except at the rinse step the IB specifies. Don't hide the
   contradiction; resolve it in one clear line.

### Fix: wrong, unverified, or off-brand in the reference

- "For a coffee a day this tends to land around monthly" is unverified. Remove it or label it as an
  estimate.
- "'Empty me!' float": the IB says "drip tray full indicator". Use the IB term; the printed label on
  the part can be a secondary caption if you verify it.
- "Pull one shot and pour it away" after the deep clean is not in the IB. Keep it, but label it as a
  tip.
- **Styling it uses that James has banned:** the `.also` coloured left-border callout box, the
  `.note` / `.warn` left-border notes, filled circular `.num` pills that turn solid when done, and
  big rounded "Mark done" pill buttons. Rebuild tone as **labelled dots on ruled layouts** and
  progress as **plain mono counters** (`01 02 03`).
- **Fonts:** Archivo and Atkinson Hyperlegible aren't in the portal system. Use Fraunces, Hanken
  Grotesk and IBM Plex Mono via the `--font-*` variables.
- **Worth keeping from its design language:** the pressure-gauge hero (the BES876 has a real
  extraction pressure gauge, so it's on-theme), the brushed-steel machine-button `.key` chips for
  `1 CUP` / `POWER` etc., and the flashing-versus-solid LED demo.

**Coverage contract.** Every content item in the reference page, every IB care section on p.22–27,
the maintenance rows on p.28–30, and all 12 Breville hub guides must each map to a place in the new
tool. Write that mapping to `Documents/portal/barista-guide/coverage.md` as a table
(source item → tab / step). Nothing gets silently dropped.

---

## 5 · Information architecture

Organise it as **tabs, not a long scroll** (James's rule). Use a sticky numbered tab bar with
visited marks, and keep each tab to roughly one concept. Recommended tabs (you may merge or rename
them if a better shape emerges in planning; justify it in the plan):

| # | Tab | Purpose |
|---|---|---|
| 01 | **Overview** | Animated machine hero, maintenance-light decoder, "what's due" status gauges driven by the care log, two big doors: *Weekly* and *Deep clean* |
| 02 | **How it gets dirty** | Short motion explainer (the "why"): scale, coffee oils, baked milk, stale grinds, each mapped to the routine that prevents it |
| 03 | **The kit** | Every cleaning item in the box, animated in use; each links to the steps that use it |
| 04 | **Every day & week** | Per-drink / daily habits plus the weekly ritual checklist, and the maintenance "sequencer" (§7) |
| 05 | **Six-month deep clean** | The centrepiece: optimised schedule plus the step-by-step player with follow-along timers (§8) |
| 06 | **Fix-it** | Symptom picker → cause → animated fix (troubleshooting, blocked wand, advanced grinder clean, seal replacement) |
| 07 | **Restock & log** | Don'ts, the shopping list, the care-log history, and storing the machine for a trip |

Writing rules (James's, from the Deep Learning pages):

- **No walls of text.** Use one big `Hook` line per tab, then `Fact` cards / terse lines, with the
  "why" folded into `Unfold`s.
- **Instruction lines:** at most ~16 words each and at most 7 per step. Button names are steel
  chips. Numbers (25 s, 1 L, 3 s) are set in mono.
- **The interactive figure leads; prose supports it.**
- **Playful energy:** progress marks, an animated hero, clickable level cards, and a small reward on
  completion.

---

## 6 · Motion graphics — the heart of the build

### 6.1 One shared, state-driven machine

Draw **one original vector illustration of the BES876**: a front elevation with clean line-art and
flat fills. Look at Breville's product photos for proportions and part placement, but **draw it
yourself**; don't trace or embed Breville imagery. Make it a React component, `Machine.jsx`, whose
parts are named groups you can target and whose look is driven by props/state:

- **Parts:** bean hopper (removable, with lock), grind-size dial, control panel buttons (POWER,
  1 CUP, 2 CUP, FILTER, DOSE, MANUAL DOSE dial), the CLEAN/DESCALE and HOT WATER/STEAM indicator
  LEDs, the pressure gauge with its needle, the tamp lever, the tamp cover/shroud and cradle, the
  group head and shower screen, the portafilter (in or out, cradle or group), the steam wand and
  tip, the hot water outlet, the steam/hot-water dial (left, standby, right), the drip tray with its
  full indicator, the storage tray, and the water tank (a translucent side inset with a live level
  line and the filter visible).
- **State props:** `leds` (`off|flash|solid` per light), `dial` (`left|standby|right`), `lever`
  (0..1), `tankLevel` (litres), `portafilter` (`out|cradle|group`), `filterInTank` (bool),
  `highlight` (part id).
- Every scene reuses this machine (or zoomed cutaways of a part of it), so the guide has one
  consistent visual world.
- **SVG ids must be unique per mounted instance** (use `useId()` prefixes). Duplicate ids across two
  mounted scenes broke the Portara motion pages.

### 6.2 Scene list (each one a paused GSAP timeline)

| Scene | Where | What moves |
|---|---|---|
| **Machine boot** | Overview hero | Line-draw trace of the whole machine (the Portara stroke-twin recipe), fills wipe in, gauge needle sweeps with a small overshoot (a nod to the reference hero), LEDs blink on |
| **Light decoder** | Overview | Toggle *flashing* / *solid* → the CLEAN/DESCALE LED animates accordingly, the matching procedure card slides in, and a "Go" jumps to it |
| **Status gauges** | Overview | Three pressure-gauge dials (Clean cycle · Descale · Filter). The needle position = time since last done ÷ interval, read from the care log. The red zone means due |
| **Water path** | How it gets dirty | Schematic cutaway: tank → filter → pump → Thermocoil → group head / steam wand / hot water. Scale particles accrete in the hot sections over a sped-up "6 months"; the filter visibly catches some. Label it **schematic**, and only name components Breville documents (Thermocoil, PID, filter) |
| **Oils & milk** | How it gets dirty | The shower screen darkening with oil residue over shots; milk protein crust forming on the wand tip after a skipped purge; the purge blast clearing it |
| **Kit in use** | The kit | Hover/tap each item to see it in action: brush sweeps burrs, pin pokes a tip hole, the spanner unscrews the tip, disc + tablet stack into a basket, the sachet dissolves, the Allen key turns counter-clockwise, the Razor trims a puck |
| **Button holds** | Everywhere a combo appears | The control panel zooms in, finger dots land on each button, and a ring fills over the **real hold time** (3 s / 5 s). The LEDs then change to the documented state |
| **Steam wand rescue** | Deep clean | Hot cloth wraps the wand → crust flakes away → pin into the holes → spanner unscrews the tip → the tip drops into a cup → bubbles (the soak runs in the background lane) |
| **Shower screen** | Deep clean | Exploded group head: skewer clears the screw head → Allen key turns counter-clockwise → screw and screen drop with an orientation marker → wash → the seal shown ribbed side out → refit, 2–3 finger turns, flush |
| **Grinder & tamp** | Deep clean | Hopper unlocks (rotation) → beans pour out → grinder runs empty → top burr lifts out by its wire handle (with a warning dot on the number ring) → brush strokes spiral the lower burr → tamp cover off, lever down, brush, lever slowly up |
| **Descale** | Deep clean | Sachet dissolves in a 1 L jug → button hold (5 s) → LEDs flash then go solid → **round loop**: the group head pours (25 s), the dial turns right and steam jets (13 s), the dial turns left and water runs (8 s). The tank level drops about 0.5 L per round and a round counter ticks. Then the 2 L rinse and POWER exits |
| **New filter** | Deep clean | Filter soaks (5 min) → 5 s rinse → the date dial rotates to **today + 3 months** (computed live, showing the actual month name) → it clicks into the holder → pushes onto the post |
| **Cleaning cycle** | Deep clean | Basket → disc → tablet drop-stack into the portafilter → it locks into the group (rotation) → 3 s hold. A cutaway shows water pulsing down, the tablet fizz-dissolving, and the flow returning **into the group head** (IB wording), with no flow from the spouts. A 5-min compressed clock runs, then the "Tablet gone?" branch, then the disc comes out and the 2 CUP rinses |
| **Basket soak** | Deep clean | Tablet dissolves in a bowl → 4 baskets + the portafilter head sink in (handle out) → 20 min timer → the pin clears a hole |
| **Finish & log** | Deep clean | Drip tray exploded (grid, separator, full indicator) → wipe → a shine sweep across the housing → completion reward (a crema swirl or steam puff) → the care log writes the date and the gauges reset |
| **Advanced grinder** | Fix-it | Exploded stack in the IB order (nut, spring washer, flat washer, lower burr, felt/metal washer, grind fan) with the GRIND SIZE dial showing 1 → 25 → 16 |

### 6.3 Follow-along mode (the killer feature)

Every timed step offers **Follow along**. The animation then runs in **real time**, synced to what
the machine is doing: the 25 s / 13 s / 8 s descale legs, the 5 min cleaning cycle, the 5 min filter
soak, the 20 min basket soak, and the 2–3 min hot-cloth wrap.

- Show a big mono countdown and a "what you should see now" line.
- At the end, a clear done-state (with an optional short WebAudio beep and `navigator.vibrate`,
  both behind a sound toggle that defaults to off).
- Request a **Screen Wake Lock** (`navigator.wakeLock.request('screen')`) while a timer runs.
  Release it on finish, pause, or tab hide, and re-acquire on `visibilitychange`. Feature-detect it
  and degrade silently.
- Timers must survive the tab being backgrounded. Compute from timestamps; don't count ticks.
- Background timers (soaks) appear as a persistent mini-bar so James can run the next step while a
  soak counts down.

### 6.4 Engineering rules for motion (hard-won in this repo — follow exactly)

- **One paused timeline per scene.** Build it inside `gsap.context()` and return its cleanup.
  Play on first IntersectionObserver hit and pause when off-screen or the tab is hidden.
- **Replay = `restart()`, never `invalidate()`.** Every stateful tween is a `fromTo` with explicit
  values. Hard-reset with `tl.set()` at t=0 (including clip-rect attributes). Use `immediateRender`
  deliberately; later-positioned `fromTo`s default to false.
- **Line draws:** stroke-only twins dash-animated via `getTotalLength()`, rendered last.
- **Wipes:** `userSpaceOnUse` clipPath rect attr-tweens, not CSS `clip-path` percentages on SVG.
- **`prefers-reduced-motion`:** don't build timelines. CSS/JSX defaults must already be the
  finished, fully labelled frame, so the static version is complete and readable. Follow-along
  timers still work (they're information, not decoration).
- **Performance:** animate transforms, opacity and SVG attributes only. Use a few shared
  `feGaussianBlur` filters at most. Measure frame times in headless Edge (see §10).
- **Seek handle:** expose a dev-only `window.__bxi` handle for frame-exact seeking. In puppeteer,
  never return a timeline from `page.evaluate`; wrap the body in braces or it hangs serialising it.
- **Colour:** scene art must work on all three themes. Use theme tokens for ink, lines and accents.
  If a scene genuinely needs a fixed backdrop (like the Portara stage), use a deliberate "bench"
  surface and make sure it looks intentional in Arcade (dark). Water, steam, milk, coffee and scale
  can have fixed material colours, but check their contrast on each theme.

---

## 7 · Weekly routine spec

- **Rhythm ladder.** The cadence as a ruled list from most to least frequent: every milk drink ·
  every coffee · daily · weekly · when the light flashes · every 3 months (filter) · when the light
  is solid · six-monthly. Each row is a frequency label plus 1–3 terse actions plus an IB receipt.
- **The maintenance sequencer.** A drum-machine-style grid: 26 week columns (six months) by task
  rows, with dots where each task falls. A playhead sweeps across, and the dots light as it passes.
  Real dates come from the care log. It's the visual answer to "what do I do when", and it should
  feel like an instrument.
- **Weekly ritual checklist** (target about 10 minutes): the drip tray and storage tray wash, the
  shower screen wipe and group head purge, the basket and portafilter clean, a steam wand
  deep-wipe and pin check, a tamp area brush, the outer housing wipe, the backflush (only if
  verified, §4 Add 2), and the burr brush when the light has flashed.
  - Each item gets a micro-animation on tick.
  - The checklist **auto-resets each ISO week**. Show a streak counter of consecutive weeks
    completed.
- **Per-drink habits.** Two tiny looping animations: the wand wipe + steam purge, and the group head
  flush before inserting the portafilter. These are the habits that would have prevented the dried
  milk James has now, so make them prominent.

---

## 8 · Six-month deep clean spec

### 8.1 An optimised schedule, not a list

Model the deep clean as a **task graph** in `schedule.js`. Each task has a duration, an
active/passive flag, the resources it needs, and its predecessors. Build the order with a small,
pure scheduler. Hard-code the result only if you can show it's optimal. Constraints to encode:

- **Cold-first, hot-later.** Jobs that need the machine **off, unplugged and cool** come first while
  it's cold: shower screen removal, steam wand tip, grinder and tamp. Then come the jobs that need it
  hot: descale, cleaning cycle.
- **The filter stays out of the tank for the descale.** The new filter is fitted after the descale
  rinse and before refilling for the cleaning cycle.
- **The 1 CUP basket is a shared resource.** The cleaning cycle needs it, and the basket soak wants
  all four baskets. Sequence them so they don't collide, or note the trade-off.
- **Passive tasks overlap active ones.** The wand-tip soak runs while James does the grinder. The
  basket soak runs where it fits. The filter's 5 min soak can start early.
- **Tablets:** there were 2 in the box, one for the cycle and one for the soak. The "repeat if it
  didn't dissolve" branch costs another, and the restock tab should say so.

**Visualise it as a Gantt chart with three lanes (You · Machine · Soak bath).** Highlight the
critical path. Show the **computed** total time beside the naive sequential time; don't assert a
number you didn't compute. Clicking a bar jumps into the step player.

### 8.2 Step player

- **One step per view** (not an accordion), with a mono step rail (`01 … 10`) showing done and
  current. Use prev/next and swipe on touch.
- **Each step:** scene (top) → title → at most 7 instruction lines with steel button chips → safety
  lines as **labelled dots** (burn hazard, sharp burrs, unplug first) → an `Unfold` for the why →
  the IB receipt plus the Breville video link → Follow along (if timed) → Mark done.
- **Progress** persists (`localStorage`). Resume where James left off. "Clear ticks" stays as a
  quiet text button.
- **Branches** are first-class: "Tablet not fully dissolved? → repeat", "No spare filter? → skip,
  add to restock", "Seal hard or cracked, or leaking around the portafilter? → seal swap (tip)".
- **On completion,** write the deep-clean, cleaning-cycle, descale and filter dates to the care log.

---

## 9 · State & storage

- **`careLog.js`** holds pure functions over one versioned localStorage record (`bxi:care-log:v1`):
  purchase date, last clean cycle, last descale, filter installed date, last deep clean, and
  weekly-checklist history. Also keep `bxi:deep-clean:v1` (step ticks) and `bxi:weekly:<ISO-week>`.
- **Wrap every read and write in try/catch.** The UI must render correctly with storage empty or
  blocked.
- **Due dates:** filter = installed + 3 months. Clean cycle and descale are **driven by the light**
  (the machine decides), so the log records when James *did* them and the UI asks "is the light on?"
  rather than predicting. The six-month deep clean recurs from its last date.
- Let James set the purchase date (it defaults to about six months before the first open) and
  backfill past dates.
- Shape the data so a later Supabase swap (the portal's `portalApi.js` `{data, error}` pattern) is
  mechanical. **Don't** wire Supabase now.

---

## 10 · Design system rules (James's taste — strict)

- **Portal "Reading Room" language only:** light editorial surfaces, hairline rules, mono uppercase
  micro-labels, Fraunces display headings, the current theme's `--accent`. Not the cyberpunk
  `index.css` look, and no `index.css` edits.
- **No AI-website callouts.** No coloured rounded left-border boxes, no alert banners, no filled
  number pills. Show tone and status as a small **labelled dot beside text** on ruled layouts.
  Structural cards and stat tiles are fine.
- **Steel chips for machine buttons** (`1 CUP`, `2 CUP`, `POWER`, `DOSE`, `FILTER`). This is
  reference-to-hardware, not decoration, so it's allowed and encouraged.
- **All three themes** (jade, coral, arcade) must look deliberate. Check contrast for any fixed
  material colour on each.
- **Kitchen and phone first.** Design at **390 px wide** first, then desktop. Tap targets ≥ 44 px,
  readable at arm's length, with the primary action (Next / Follow along / Done) reachable by thumb.
  Check how the portal shell's sidebar behaves on a phone. If it's a problem, record it in
  `decisions.md` and the final report; **don't refactor the portal shell**.
- **Icons** are single-colour SVGs from `icons.jsx`. **No emoji anywhere.**
- **Accessibility:** every scene SVG has `role="img"` and a real `aria-label`/`<title>`, timers use
  `aria-live="polite"`, and nothing important is colour-only.

---

## 11 · Process

1. **Research.** Download and extract the IB (§2), and read p.6–30 in full yourself. Don't rely
   only on this brief's summary. Check the Breville hub pages. Optionally find AU part names and
   codes for tablets, descaler, filters and the shower-screen seal on `breville.com/en-au`. Only
   state codes or prices you actually verified, with the date checked; otherwise list item names
   only.
2. **Plan, written down, no approval step.** Write the plan to
   `Documents/portal/barista-guide/plan.md`, then go straight on to building. Don't present it for
   approval. It covers:
   - the final tab structure;
   - the full scene list with one line per scene;
   - the deep-clean task graph and the scheduler's resulting order (with computed times);
   - the file layout;
   - anything in §4 you resolved differently and why.

   Don't ask James anything. These two open points are already decided:
   - **Spare supplies:** assume only what came in the box (2 tablets, 1 descaler sachet) and **no
     spare water filter or seal**. Build the "no spare filter → skip and add to restock" and "seal
     swap" branches so either case works, and let James record what he has in the Restock tab
     (persisted).
   - **Timer sounds:** off by default, with a toggle (as in §6.3).
3. **Build** in vertical slices so something works end to end early: shell + tabs + Machine.jsx
   first, then the deep clean (schedule + player + descale and cleaning-cycle scenes), then weekly,
   then the remaining tabs and scenes.
4. **Verify** (§12). Fix what you find, and re-verify.
5. **Document** (§13).

Don't commit, push or deploy unless James asks; he commits himself.

---

## 12 · Verification (all of it, before you call it done)

- `npx eslint src/components/portal/modules/barista src/components/portal/registry.js src/components/portal/icons.jsx`
  must be clean. Lint only these paths; the repo has unrelated warnings elsewhere.
- `npm run build` must succeed.
- **Headless run** with `puppeteer-core` and local Edge (see the `reference_headless_soak_kit`
  memory; write scripts with the Write tool, not Bash heredocs, which strip double backslashes).
  Read `src/components/portal/auth.js` to see how to seed the portal session so the gate doesn't
  block the run. Port 8787 belongs to another project; use Vite's dev port.
- **Screenshots:** every tab × 3 themes × {390 px phone, 1440 px desktop}. Look at them yourself and
  fix anything off.
- **Every scene:** play to the end, then replay with `restart()`. The second run must match the
  first, with no dead or vanished elements. Seek to the midpoint and end via `window.__bxi`.
- **Reduced motion:** emulate `prefers-reduced-motion: reduce`. Every scene must show its finished,
  labelled frame, and timers must still work.
- **Timers:** run a 25 s leg in real time and check the drift is under 0.5 s. Background the tab
  mid-timer and confirm it's still correct on return.
- **Console:** zero errors or warnings across all tabs (including no nested `<button>` hydration
  errors and no duplicate-key or duplicate-id warnings).
- **Storage blocked:** run once with localStorage throwing. The UI must still render and work for
  the session.
- **Frame times:** sample the heaviest scene in headless Edge with real GPU (`--use-angle=d3d11`)
  and report the average and worst frame.
- **Coverage:** walk `coverage.md`. Every row resolves to a real place in the UI.

---

## 13 · Documentation (per `CLAUDE.md`)

- **Obsidian vault** (`C:\Users\james\Documents\james-claude-brain`): create
  `01-Active-Projects/wigfield-portfolio-barista-guide.md`. Cover what it is, the IA, the motion
  architecture (Machine.jsx + scene timelines), the schedule model, the storage keys, and the
  sources. Add a dated dev-log in `03-Dev-Logs/`. Link both from `wigfield-portfolio.md` and
  `wigfield-portfolio-management-portal.md` with `[[wikilinks]]`.
- **Auto-memory:** add a `project_barista_guide.md` memory, plus a pointer line in `MEMORY.md`,
  covering where it lives, how to add a scene or step, the storage keys, and any gotcha you hit.
  Update `project_management_portal.md`'s Personal-section mention.
- **Coverage:** leave `Documents/portal/barista-guide/coverage.md` in place.

---

## 14 · Definition of done

- [ ] `Barista · Machine Care` appears under **Personal** with a new `cup` icon, deep-linkable by tab and step.
- [ ] Every procedure is verified against the IB, with page receipts; nothing invented; tips and estimates labelled.
- [ ] Every reference-page item, every IB care section, and all 12 Breville guides are mapped in `coverage.md`.
- [ ] One shared `Machine.jsx`, with **every** procedure animated (§6.2 scene list), plus follow-along real-time timers with wake lock.
- [ ] An optimised deep-clean schedule computed from a task graph and shown as a 3-lane Gantt.
- [ ] A weekly checklist with ISO-week reset and streak, plus the maintenance sequencer.
- [ ] A care log driving the status gauges; resilient to blocked storage.
- [ ] James's style rules hold: tabs, no walls of text, no callout boxes or filled pills, steel button chips, all three themes, phone-first.
- [ ] Lint, build, and the full §12 verification pass, with screenshots reviewed.
- [ ] Vault + memory updated.
- [ ] `plan.md` and `decisions.md` are in `Documents/portal/barista-guide/`, so James can see what was decided while he was away.
- [ ] Everything is left uncommitted for James to review (no commit, push or deploy).
- [ ] A final report to James: what was built, what you verified and how, anything you couldn't verify (e.g. the backflush steps), and anything left open.
