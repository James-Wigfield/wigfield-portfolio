# UI + Plan agent — decisions (one line each + why)

## Shell and layout
- Tab is NOT remembered across visits; the page always opens on Visualiser. — the brief's "first thing I see is the render" beats a convenience.
- Scene state (values, camera view, preset, edited) lives in the shell; the Stage is disposed when the Visualiser tab unmounts and rebuilt from that state on return. — no hidden render loop while reading the Plan; round-trip tested (6 × Vis→Plan→Apps→Vis: values + view restored, old stage `disposed`, one canvas).
- Plan and Applications tabs are `React.lazy` chunks. — the registry imports the shell eagerly; reading tabs shouldn't weigh on the portal's main chunk.
- Stage + panel are one grid; the fullscreen target is that wrapper, so controls come along into fullscreen (phone-width fullscreen hides the panel). — tweaking in fullscreen is the point of fullscreen here.
- Drawer layout switches on the module's own width (< 860 px), not the viewport. — a 1024 px window with the portal sidebar leaves ~680 px, too narrow for a side panel.
- Stage overlay arrangement uses a container query on the stage frame (`pjlstage`, < 560 px). — the stage's width, not the window's, decides whether the transport and title fit side by side.
- Panel scrolls inside itself (height = stage height) on desktop. — the page never becomes a long scroll; on phones it's a normal drawer below the stage.
- Values are mirrored into React at once and flushed to `stage.set` once per animation frame. — an apex drag rebuilds patches at most once a frame.

## Controls
- Every control comes from `params.js`: group → `section` sub-heads → defs with `projector` pulled into per-projector sub-groups up to `proj.count`. Widget by def: range → slider; int with ≤ 5 values → segmented; select with ≤ 4 short labels → segmented; else native select; toggle → switch. — adding a control = adding a def.
- Shortened some option labels in params.js (`map.mode` Mapped/Raw, `proj.res` 720p/1080p/4K, `life.geoSign` Sinks/Climbs) and added `CAMERA_VIEWS[].short`. — lets them render as segmented buttons / fit on the stage; no keys changed.
- Added `digits: 0` to projector yaw/pitch/roll and a few hints. — "-45.00°" read as false precision.
- Group headers carry a live one-line summary (e.g. "3.30 m · 26°", "Phys · GS · PL", "78 alive"). — the panel is informative while collapsed.
- Open groups, panel fold and drawer state are remembered in localStorage (`pjl:open`, `pjl:folded`, `pjl:drawerShut`, `pjl:planSec`), every access in try/catch. — per-viewer conveniences only.
- Stats widgets each subscribe to the Stage themselves (`useStats`). — only the read-outs re-render at 4 Hz, not ~90 controls.
- Special widgets: apex readout "3.30 m · 25.7°" + a roof-section sketch with the slide (sin θ) / peel (cos θ) split; throw "typical" buttons + "picture ≈ N m wide from 3 m"; a draggable plan view of projectors and their aim (keyboard: arrows); a region map (walls ring + floor + loft in plan, roof from above) coloured by habitat, click to edit on/type/system. — visual first, numbers second (feedback: visual labs).
- Creature census + trait histograms sit directly under the Creatures switch. — a preset that opens the group (food web) shows the populations without scrolling.
- Habitat colours: a validated categorical trio (dataviz validator, light + dark steps): floor amber `#a86e14`/`#b88a2e`, wall teal `#1f8a70`/`#2f9e7a`, roof violet `#7a5cc8`/`#8f6fd8`. — same identity in the panel, histograms, coverage and region map.
- Stage overlay has its own fixed palette (warm-white "lamp" accent on black) in every theme. — the stage is always a dark room.
- Label paragraphs are `div`s, not `p`. — `home.css` sets `.hp p { color: var(--ink-2) }` (0,1,1), which overrode single-class colours (the stage text turned teal in jade).

## Presets (presets.js)
- Projector rigs chosen by probing the live coverage readout (occlusion on), numbers in the RIGS comments: SE short throw 26 %; standard throw above the door 7 %; NE+SW corners at the eave tilted −10° = best two-projector rig found, 63 % (floor 17 / walls 71 / roof 88); + ultra-short centre-down third projector 76 %; ultra-short floor projector east of centre reaches 85 % of a 4.0 m roof. — first guesses grounded in the model; re-probe if room/projection change.
- Floor coverage stays low for any wall-height rig (the loft deck shadows the west half; furniture the rest). — only a projector looking straight down lights the floor (centre-down ultra-short: floor 49 %).
- Ceiling swingers keeps the roof system `off`. — creatures still draw on an `off` patch (life/host.js), so bright bodies on a black roof.
- "Reset" re-applies the first preset (The living shed), not bare `defaults()`. — reset should return to what the page opened on.
- Presets may set `open: [groupIds]` (opens + scrolls the panel to the first) and `compare: true` (shows the on-stage Coverage · Raw · Mapped switch). — the food web shows histograms; the reality check flips raw/mapped in one click.
- The compare switch doesn't mark the scene "edited". — it's the preset's own control.

## MCP preview
- One call per line by default, with a pretty-print toggle and group filters; copy copies exactly what's shown. — 41 calls stay scannable; a real spec stays copyable.
- Tool names/shapes are a proposal, kept in step with `Documents/projector-life/merger-plan.md` §3; `set_projector` is included for comparison with his calibration. — labelled "proposed tool names" with a half-dot.

## Plan + Applications
- Plan = standfirst + sub-nav (Phases · Architecture · Risks · What it showed · Ask him); each section fits a screen; a "walk the plan" auto-advance (off under reduced motion). — no long scroll, no text walls.
- "Copy the brief for his Claude Code" dynamically imports `Documents/projector-life/merger-plan.md?raw`. — the page and the brief can't drift; the markdown isn't in any bundle until clicked.
- `ui/measurements.js`: geometry rows are computed now (labelled "computed"); measured rows render "pending" until the lead sets `measured: true`. — honest about what's known.
- Applications: 8 cards with CSS/SVG animated vignettes + which phase unlocks each; a swipeable row on phones. — visual, short, no long scroll.
