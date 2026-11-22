# Memory Rooms: freeform "old photos" spots + viewpoint editor

Build this in `C:\Users\james\Documents\personal-projects\wigfield-portfolio` (Memory Rooms, route `/memories`). Work on local `main`. Commit as you go. **Do not push or deploy.**

## Read first
- The vault project note `C:\Users\james\Documents\james-claude-brain\01-Active-Projects\memory-rooms.md`, then `src/memory-rooms/CONTRACTS.md`, `src/memory-rooms/README.md` and `tools/memory-rooms/DECISIONS.md`. Add new decisions there as you make them, continuing the numbering.
- The `memory-render` skill (`.claude/skills/memory-render/SKILL.md`).
- The capture flow in `src/memory-rooms/capture/` (`StepKind`, `StepPhotos`, `ShotGuide`, `useDraft`, `usePhotoQueue`), `lib/images.js`, the edit page (`pages/EditPage.jsx` + `pages/edit/`), `pages/PlanSketchPage.jsx` and `building/sketch.js`, the viewer's photo viewpoints (`viewer/`), and `workers/memory-rooms.js`.

## The goal
James has photos of places he used to stay at or live in. He can't go back to take the guided corner shots. He wants to:
1. upload any number of photos, in any order, and have the render session work out where each was taken;
2. **optionally** draw a rough outline of the room and drop **viewpoints** on it. A viewpoint is the same triangle/wedge the viewer draws for a photo: where he stood and which way he faced. This gives the render session hints.

He must be able to skip step 2 completely ("just upload and let Claude work it out"), use it for some photos only, or add it later.

**Naming:** call these *viewpoints* everywhere (code, copy, contracts). "Pins" already means the memory-note markers in `scene.json`.

## Build

### 1. Freeform capture (app + Worker + contracts)
- Add a clear option early in capture: "These are old photos (I can't retake them)". It switches the spot to `capture.mode = "freeform"`. Guided capture stays the default and must not change.
- Freeform:
  - photos in any order, **up to 40**, minimum 1 or 2 (you decide; record it in DECISIONS);
  - "Add from library" is the main action;
  - no shot guide;
  - an optional short caption per photo ("from the bed");
  - an optional **era** text field ("lived here 2019–2021").
- Raise the photo/thumb `:n` limit to 40 for freeform spots across the Worker routes, validation and R2 keys. Guided spots stay at 12. Check that the IndexedDB outbox copes with 40 photos (size, retries, progress UI).
- **Keep EXIF before resizing.** `lib/images.js` resizes through a canvas, which drops the metadata. Read the original file first and store per photo: focal length (35 mm-equivalent if present, else focal length + make/model), date taken, and the original pixel size. Use a small, well-maintained EXIF reader, or a minimal hand-rolled one for JPEG and HEIC. Store it on the media row (new optional fields; document them in CONTRACTS).
- New optional spot field (camelCase in the API, jsonb in SQL):
  ```jsonc
  "capture": {
    "mode": "guided" | "freeform",
    "era": "2019–2021",
    "layout": { "outline": [[x, z], …], "sizeKnown": false, "openings": [{ "edge": 2, "offset": 1.1, "width": 0.8, "type": "door" | "window" }] },
    "views": [{ "photo": 7, "x": 1.2, "z": 3.0, "yaw": 40, "conf": "exact" | "rough", "caption": "from the bed" }]
  }
  ```
  Metres, in the scene frame from CONTRACTS §1 (x east, z south). `yaw` uses the same convention as `rotY`; write it down. Captions can live in `views` or per photo; choose one and document it.
- Write a JSON schema and a validator, shared by the phone and the Worker like `building/sketch.js`. Accept the field on POST and PATCH (keep the `ifUpdatedAt` / 409 behaviour). Add `supabase/memory_freeform.sql` as an additive migration: **write it, don't run it**. Tell James to run it, and make sure the local row store works without it.
- A spot that is a room of a whole place (`buildingId` + `roomId`) can also be freeform. When the place's sketch has a `rect` for that room, offer it as the starting outline.

### 2. The layout + viewpoint editor (the UX centrepiece)
James's bar: **dragging and placing viewpoints must feel smooth and seamless**. He will mostly do this on the PC, because the photos are old, but it must also work well on a phone.
- **Outline:**
  - tap/click to place corners, snapping to a grid (0.25–0.5 m), with a live length on each edge;
  - close the shape by tapping the first point;
  - drag corners to adjust; drag the middle of an edge to add a corner;
  - optionally type an overall size ("about 4 × 3") to set the scale;
  - tap an edge to mark a door or window.
  - Reuse what `PlanSketchPage` already does where it fits; any polygon is fine (the shells support polygons).
- **Viewpoints:**
  - a strip of photo thumbnails beside or under the plan;
  - **drag a thumbnail onto the plan** to drop a wedge. On touch, a tap on a thumbnail then a tap on the plan also works;
  - drag the wedge body to move it; drag a handle (or two-finger twist) to aim it; the wedge's spread shows the field of view (from EXIF when known);
  - selecting a wedge shows its photo large, next to the plan, so he can judge the aim;
  - an exact / rough toggle; remove; undo/redo; placed thumbnails are marked as placed;
  - a viewpoint can exist without an outline (just a rough position).
- **Feel:**
  - pointer events with pointer capture; no page scroll or pinch-zoom while dragging. The capture pick map had exactly this bug: a finger drag scrolled the page;
  - 60 fps (transform-only updates during the drag, state committed on release);
  - pan/zoom the plan; sensible hit targets (≥ 44 px on touch);
  - keyboard support (arrow keys nudge, R/Shift+R rotate, Delete removes);
  - autosave of the draft (sessionStorage/IndexedDB, like the existing drafts).
- Make it available in **both** places: as an optional step in freeform capture ("Help Claude place your photos: skip / sketch it"), and on `/memories/:id/edit`, where it can also turn an existing spot into a freeform one or add viewpoints after a first render. In edit, while a render exists, show the rendered room's outline as a faint guide.
- **Style:** the existing Recall look and `--mr-*` tokens, light and dark. Follow James's design memories: no coloured rounded left-border callout boxes or filled pills; status = a labelled dot on ruled editorial layouts.

### 3. Render side: a freeform branch in the `memory-render` skill + tools
- `pull.mjs`: write `capture.json` (mode, era, layout, views, captions, per-photo EXIF), and a numbered contact sheet when there are more than 12 photos.
- Add a skill section "Freeform spots" that replaces the guided corner assumption:
  1. **Sort the photos:** list them in layout.md as used / reference-only / discarded, with a reason (blur, people filling the frame, heavy filter, cropped).
  2. **Frame:** take it from James's outline when there is one; otherwise pick one and say why. The doorway rule applies only when a doorway view exists.
  3. **Group the photos** by which walls and landmarks each one sees, and list the landmarks seen in two or more photos.
  4. **Camera fit** (the existing least-squares approach): use viewpoints as starting guesses plus soft constraints weighted by `conf` (exact = tight, rough = loose), EXIF fov when present and consistent (free when the photo looks cropped), and captions to break ties.
  5. **Coverage:** list the walls no photo shows. They get plain, generic treatment, marked as guessed; nothing invented.
  6. **Era:** model the room as it was in the stated era. When photos disagree (furniture moved), follow the majority and the era, and note it.
  7. Choose **6–8 compare cameras** (the best-fitting, best-covering photos). `build.mjs` / `compare.mjs` should take a list of compare cameras, so a 40-photo spot doesn't render 40 views per round. The 3-round limit stays.
- Write a small fit helper in `tools/memory-rooms/` if it saves the session repeated work (for example one that takes `capture.json` priors plus marked correspondences and returns cameras + room size + residuals). Keep it optional, numpy only.
- Cameras in the saved scene: keep every used photo as a camera (so the viewer can fly to it) and mark fit quality per camera (for example `fit: "good" | "rough"`; record the field in CONTRACTS / `scene.schema.json`).

### 4. Viewer tweaks
- Photo viewpoints from rough fits are drawn more faintly (or with a "roughly here" label) and still fly to the photo. Discarded photos don't show as viewpoints. With up to 40 viewpoints the room must stay readable: cluster them or show them on hover/selection, your call; document it.

### 5. Known-answer test (required before calling it done)
Take an already-rendered spot with good guided photos (the synthetic self-test room in `tools/memory-rooms/README.md`, plus one real spot, for example "The Batcave"). Make a freeform copy: shuffle and renumber the photos, strip their EXIF, and give it no viewpoints. Run the freeform branch, then repeat with 2–3 rough viewpoints. Report room size, camera position/angle error and object error against the known answer for both runs, in the tools README next to the existing self-test numbers.

## Checks
- Extend the existing checks rather than writing new one-offs: `api-check` (freeform POST/PATCH, the 40-photo limit, guided still capped at 12, the validator, 409 on a stale edit), `page-check` light + dark (freeform capture, the editor on desktop and at phone width, the edit page), `check-contracts`.
- Add a headless drag test for the editor (puppeteer-core + local Edge; see the headless soak kit memory): drag a thumbnail on, move a wedge, rotate it, the undo/redo round-trip, and the page doesn't scroll during a touch drag.
- Guided capture and the existing rendered spots must pass every existing check unchanged.

## When done
- Commit to local `main` (don't push or deploy). List what James must do: run `supabase/memory_freeform.sql`, then a hands-on test with real old photos.
- Update the vault per `CLAUDE.md`: the `memory-rooms.md` project note + a dev log `03-Dev-Logs/2026-11-2x-memory-rooms-freeform.md`, with wikilinks. Update the project memory pointer for Memory Rooms.
- Report back in short bullets: what was built, the known-answer numbers, what's still rough.

Out of scope: a learned photo-position model (VGGT/MASt3R in WSL). Note in DECISIONS where it would plug in if the freeform fit proves weak.
