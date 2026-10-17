# Plan — Barista · Machine Care (portal · Personal)

Written 2026-10-17 before the build, and not held for approval (per the brief). Decisions made along the way are in `decisions.md`.

## Sources

- **The ANZ instruction book** (`BES876_ANZ_IB_QA_C22_WEB.pdf`, 32 pp.). I extracted pp. 2–32 and read them in full, and rendered the diagram pages (7, 8, 9–10, 20–27) to check part placement and the filter's date dial.
- **Breville's BES876 hub.** It has 12 video guides. I checked every URL: 6 resolve on en-au, and all 12 resolve on en-us (the steam-wand guide uses a different slug on each locale). The pages are video-only. The backflush page has no steps in its text, only "slot the included silicon cleaning disc in your portafilter, lock it in, and press a few buttons" and "after every coffee creation session".
- **AU part codes** couldn't be verified on breville.com/en-au; only third-party sellers came up. The restock list therefore gives item names only.

## Tabs (7, sticky numbered bar with visited marks)

| # | Tab | Holds |
|---|---|---|
| 01 | Overview | Machine boot hero · light decoder (Off / Flashing / Solid → card + Go) · 4 status gauges (Deep clean, Filter, Clean cycle, Descale) · two doors (Weekly ritual, Deep clean) |
| 02 | Why it gets dirty | Four causes as level-select cards (scale, oils, milk, stale grounds) → each one's scene + the routine that prevents it |
| 03 | The kit | 8 IB p.8 accessories → tap for the kit-in-use scene + links to the steps that use it |
| 04 | Every day & week | Inner switch: Habits (2 looping scenes) · Rhythm ladder · Weekly ritual (ISO-week reset + streak) · Sequencer (26-week drum grid) |
| 05 | Deep clean | Inner switch: Schedule (computed Gantt, 3 lanes, totals) · Steps (one step per view, rail, follow-along) |
| 06 | Fix-it | Symptom picker → causes with IB receipts → animated fix; the advanced grinder clean as a 4-chunk stepper; seal swap |
| 07 | Restock & log | Don'ts · stock on hand (persisted) vs what the next deep clean needs · care log with backfill · storing for the US trip · Breville AU service number |

Deep links: `/portal/barista-guide/<tab>`, `/portal/barista-guide/deep-clean/<n>` (step n in schedule order), `/portal/barista-guide/routine/<sub>`.

## Scenes (each a paused GSAP timeline on the shared `Machine.jsx` or a cutaway of it)

| Scene | Tab | One line |
|---|---|---|
| Boot | Overview | stroke-twin trace of the machine → fills wipe in → gauge needle sweeps with overshoot → LEDs blink on |
| Light decoder | Overview | panel zoom; the CLEAN/DESCALE LED flashes or holds solid; the procedure card slides in |
| Status gauges | Overview | 4 pressure-gauge dials; needle = elapsed ÷ interval (filter, deep clean) or the light's state (cycle, descale) |
| Water path | Why | schematic tank → filter → pump → Thermocoil → 3 outlets; scale accretes in the hot sections over a "6 month" sweep; the filter catches some |
| Oils | Why | shower screen darkens shot by shot; the cleaning cycle clears it |
| Milk | Why | crust forms on the wand tip after skipped purges; a purge blast clears it |
| Stale grounds | Why | grinds sit in the chute and go dark; a DOSE purge pushes them out |
| Kit in use | Kit | per item: brush sweeps a burr, pin pokes a hole, spanner unscrews the tip, disc + tablet stack, sachet dissolves, Allen key turns counter-clockwise, Razor trims a puck, filter dial turns |
| Button hold | everywhere a combo appears | panel zoom, finger dots land, a ring fills over the real 3 s / 5 s, then the LEDs change to the documented state |
| Wand wrap · tip off · tip on | Deep clean | hot cloth wraps the wand → crust flakes → pin into holes → spanner unscrews tip → tip drops into a cup → bubbles; reverse for refit |
| Shower screen | Deep clean | exploded group head: skewer → Allen key counter-clockwise → screw + screen drop with a "down side" marker → wash → seal ribbed side out → refit, 2–3 turns, flush |
| Grinder · tamp | Deep clean | hopper unlock rotation → beans pour out → grinder runs empty → top burr lifts by its handle (warning dot on the ring) → brush spirals → tamp cover off, lever down, brush, lever slowly up |
| Descale (setup · rounds · rinse) | Deep clean | sachet dissolves in a 1 L jug → 5 s hold → LEDs flash then go solid → round loop (group 25 s, dial right steam 13 s, dial left water 8 s), tank drops ~0.5 L, round counter → 2 L rinse → POWER exits |
| New filter | Deep clean | soak (5 min) → 5 s rinse → date dial rotates to today + 3 months (live month name) → clicks into the holder → onto the post |
| Cleaning cycle (cycle · rinse) | Deep clean | basket → disc → tablet stack → locks in → 3 s hold → cutaway: pulses down, tablet fizzes, flow returns into the group head, nothing from the spouts; compressed 5-min clock → "tablet gone?" → disc out → 2 CUP rinse |
| Basket soak (start · finish) | Deep clean | tablet dissolves in a bowl → 4 baskets + portafilter head sink (handle out) → 20-min clock → pin clears a hole |
| Finish | Deep clean | drip tray exploded (grid, separator, full indicator) → wipe → shine sweep → crema-swirl reward |
| Advanced grinder | Fix-it | exploded stack in IB order (nut, spring washer, flat washer, lower burr, grind fan, metal washer, felt washer), GRIND SIZE reading 1 → 25 → 16 |
| Habits (2 loops) | Routine | wand wipe + purge blast; 1 CUP flush with the portafilter out |
| Sequencer | Routine | playhead sweeps 26 week columns; dots light as it passes |

Follow-along mode (`FollowAlong.jsx`): real-time countdowns computed from timestamps; the step's scene is scrubbed through its timed segment over the real duration, while CSS loops (flow, fizz, steam) keep moving. Screen Wake Lock while a timer runs. Optional beep and vibrate behind a sound toggle that defaults to off. Background timers persist to storage and show in a mini-bar.

## Deep-clean task graph (`schedule.js`)

Resources: you (1) · machine (1) · soak bath (2 vessels). Rules: cold-first (every hot task waits for every cold one); the filter stays out until the descale rinse is done; the portafilter is busy until the grinder finishes; the wand tip goes back on before anything flows. Durations: IB where the IB gives one (5 min cycle, 20 min soak, 5 min filter soak). Everything else is my estimate of hands-on time, and the UI labels the totals as estimates.

Computed by the list scheduler (critical-path priority), from `node` on the real module:

```
start end  lane         task
  0    3   you          setup          (cold start)
  3    4   you          wrap           (hot cloth on — tip)
  4    7   bath         soften         (cloth softens the crust)
  4   16   you          screen         (Allen key, wash, refit)
 16   19   you          tipOff         (pin, spanner, tip into cup)
 19   34   bath         tipSoak        (open-ended: IB gives no time)
 19   26   you          grinder
 26   31   you          tamp
 31   34   you          soakStart      (tablet #2, baskets + portafilter)
 34   54   bath         basketSoak     (20 min, IB p.25)
 34   36   you          tipOn
 36   40   you+machine  descaleSetup   (filter out, 1 L, 5 s hold)
 40   41   machine      descaleHeat
 41   45   you+machine  rounds         (25 s / 13 s / 8 s legs)
 45   53   you+machine  rinse          (2 L)
 45   50   bath         filterSoak     (5 min, IB p.22)
 53   55   you          filter
 55   58   you          basketRinse
 58   61   you+machine  cycleSetup     (tablet #1, 3 s hold)
 61   66   machine      cycle          (5 min, IB p.22)
 61   64   you          housing        (during the cycle)
 66   68   you+machine  cycleRinse
 68   76   you          finish
```

- **Computed total: 76 min.** The naive version, one task after another and waiting out every soak, is 107 min.
- **Lower bound 73 min.** That's the hands-on minutes, which is longer than the longest chain. The 3-minute gap is the heat-up minute plus 2 minutes of the cleaning cycle with nothing left to do. Every remaining hands-on task depends on either the soak or the cycle, so this schedule is optimal for this graph.
- **Critical chain:** setup › wrap › screen › tipOff › grinder › tamp › soakStart › tipOn › descaleSetup › heat › rounds › rinse › filter › basketRinse › cycleSetup › cycle › cycleRinse › finish.
- **Player order (16 steps, derived from the schedule):** cold start · wrap the wand · shower screen · tip off · grinder · chute & tamp · basket soak start · tip on · descale setup · descale rounds · descale rinse · new filter · finish the soak · cleaning cycle · check & rinse · finish & log.

## Files

```
src/components/portal/modules/barista/
  BaristaGuide.jsx     shell: sticky tab bar, sub-route sync, timer provider, mini-bar
  barista.css          .bxi-* layout, tabs, chips, player, lists, gantt, sequencer
  scenes.css           stage + material colour tokens (per theme) + live CSS loops
  content.js           all copy + step data
  schedule.js          task graph + scheduler (pure)
  careLog.js           storage stores + date maths (pure, try/catch, memory fallback)
  sceneKit.js          useScene (paused timeline, IO play/pause, replay=restart, reduced motion), window.__bxi
  timers.js            timer maths, context, wake lock, beep
  ui.jsx               Hook, Fact, Unfold, Rich (chip/mono markup), Receipt, Dot, Seg, Tip lines
  Machine.jsx          the shared BES876 front elevation (MachineArt <g> + Machine <svg>)
  parts.jsx            SVG props: portafilter, basket, jug, bowl, cup, tools, tablet, clock, finger…
  Gauge.jsx            pressure-gauge dial
  ButtonHold.jsx       combo-hold scene
  FollowAlong.jsx      timer UI + rounds runner + mini-bar
  scenes/*.jsx         one file per scene family
  tabs/*.jsx           Overview, Why, Kit, Routine (+ Sequencer, Weekly), DeepClean (+ Gantt, StepPlayer), FixIt, Log
```

## Where this differs from the brief's §4 audit (and why)

1. **"Repeat if the tablet didn't dissolve" doesn't cost another tablet.** IB p.22 step 7 says to repeat from step 4 until the tablet has dissolved, so the same tablet stays on the disc. The restock maths uses one tablet per cycle plus one per basket soak.
2. **The reference's "steam 2 seconds" purge** isn't in the IB, which says "briefly" (p.19, p.25). Changed to "briefly".
3. **The reference's "soak the tip 10 minutes"** isn't in the IB either. The tip soak is open-ended, an elapsed stopwatch that runs while James does the grinder.
4. **The hot-cloth wrap (2–3 min)** isn't Breville's. It stays because it targets the dried milk, but it's labelled a tip, and so is its timer.
5. **"Give it 20 minutes to cool"** is removed. IB p.3 just says "allowed to cool". A tip suggests starting before the first coffee.
6. **The basket soak** is the IB's remedy for blocked holes (p.25). It's still in the deep clean, but the step's "why" says that including it is this guide's choice. Its 20 min and procedure are cited.
7. **Shower-screen removal** is the IB's "Using the Allen key" procedure (p.26–27). The deep clean runs steps 1–5 and 7–8, with step 6 (the seal) as a branch. The six-monthly cadence is labelled as this guide's schedule. The seal trigger (leak round the portafilter / loose lock-in) is a tip.
8. **Descale rinse rounds:** the IB gives no count, so the counter tracks rounds without a target.
9. **Backflush:** Breville gives no text steps, so it isn't in the weekly checklist. It appears in the rhythm ladder as "Breville suggests it after every coffee session — steps in its video", with the link.
10. **"Never wash the burrs with water"** isn't stated in the IB, which only brushes them (p.24). It's kept, labelled a tip.
11. **"Descale with vinegar"** (a reference don't) isn't in the IB, so it's dropped. The descale step uses "one sachet of Breville descaling powder" (p.23).
12. **"Empty me!"** becomes the IB's term, "drip tray full indicator". I couldn't verify the printed label on the part, so it isn't used.
13. **The filter is removed at the descale step, not at setup.** The tank stays seated through the cold jobs and the grinder run, because IB p.10 says the machine won't operate below MIN.
14. **Four gauges, not three:** the deep clean gets its own, since it is the thing that recurs from its last date.
