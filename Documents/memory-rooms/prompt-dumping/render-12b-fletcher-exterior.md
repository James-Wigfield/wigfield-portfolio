# Render building: 12B Fletcher St (exterior + empty levels)

Use the `memory-render` skill, section "Whole places: render building X". Work in `C:\Users\james\Documents\personal-projects\wigfield-portfolio` against the **live** site: `MEMORIES_API=https://jameswigfield.com`, `MEMORIES_PASSWORD=memories` (the live site password; it isn't in `.dev.vars`). Example: `MEMORIES_API=https://jameswigfield.com MEMORIES_PASSWORD=memories node tools/memory-rooms/pull.mjs --list`. Read the vault note `C:\Users\james\Documents\james-claude-brain\01-Active-Projects\memory-rooms.md` first.

## The place
- Building id **`001c25b7-a2bd-4d71-a476-739b941f8f69`**, "12B Fletcher St", Rockingham WA. James's two-storey house. Captured 2026-11-22 with 4 plan photos and 12 outside photos; **no rooms captured yet**.
- Sources are in `Documents/memory-rooms/assets/`:
  - `12b-Fletcher-Plans.pdf`, the 30-page builder set. Use the PDF for every dimension, not the plan photos (the phone shrank those to 2048 px):
    - A.04 ground floor and A.05 first floor (full dimensions);
    - A.06 elevations; A.07–A.09 sections (GF ceiling 2.743, FF floor +2.657 / ceiling, the raking ceiling and hi-lites over kitchen/family);
    - A.03 site plan (lot 11.33 × 48.24, setbacks, north arrow); A.27 ceiling plans;
    - A.19/A.20 internal (floating timber) and external (concrete, to the balcony) stairs.
  - `photo-notes.md`: what each photo shows, and **each photo's lens**. 4550–4558 are 0.5× ultrawide (~104°), 4548 is ~0.75×, the rest are 1×. The uploaded outside photos lost their EXIF, so use this file.
  - `IMG_4546…4562.HEIC` (originals) and `outside-jpg/` (the 12 uploaded, numbered in upload order).

## Scope of this session
1. Trace `building.json` from the PDF:
   - two levels, `ground` and `first`;
   - wall graph, openings (stackers, sliders, windows, garage door), both stairs, the void over the entry, the balcony and the alfresco;
   - the skillion roofs at 6°51′ (`parts`: the main FF roof, the garage roof, the balcony roof);
   - the site; `geo` from the row (lat −32.27791, lng 115.71476), with `north` from the plan's north arrow.
   Check it with `plan-check.mjs` on the plan photos until the walls sit on the drawn walls.
2. Materials from the outside photos:
   - white acrylic-rendered brick; dark charcoal fascias, frames and pergola beams;
   - vertical timber-look cladding panel on the front (street) upper box;
   - black slat fence; grey large-format pavers in the courtyard and on the balcony.
   No photo shows the roof: use a dark Colorbond-style colour and say so.
3. `build-building.mjs` → read the three-quarter and top renders. Compare by eye against the outside photos, up to 3 rounds. Then `push-building.mjs` (**without** `--rooms`: no room is furnished yet).

## Room ids: keep these exactly (the phone already made them)
James added the rooms on the phone. The app only offered one level, so all are on `ground`. Map them like this, and keep the ids:

| sketch id | name | plan room | level |
|---|---|---|---|
| `james-dungeon` | James' Dungeon | Multi-Purpose (= the existing spot "The Batcave") | ground |
| `james-bedroom` | James' Bedroom | Bed 3 (back, next to Multi-Purpose) | ground |
| `spare-bedroom` | Spare Bedroom | Bed 2 (front, next to the entry) | ground |
| `downstairs-bathroom` | Downstairs Bathroom | Bath | ground |
| `downstairs-toilet` | Downstairs Toilet | PDR1 | ground |
| `laundry` | Laundry | Ldry | ground |
| `garage` | Garage | Quad garage | ground |
| `foyer` | Foyer | Entry (void over, floating stairs) | ground |
| `office` | Office | Study/Bed 4 | **first** |
| `master-bedroom` | Master Bedroom | Master Suite | **first** |
| `library-hallway` | Library Hallway | the first-floor passage with the built-in cabinetry / day bed (A.25) | **first** |
| `upstairs-living` | Upstairs Living | Kitchen + Scullery + Family/Dining (balcony separate) | **first** |

- Every other plan space (ensuite, dresser, WC, PDR2, store, passages, balcony, alfresco, porch) gets its own room id in `building.json`, with no spot.
- Also fix the place's **sketch** through the API, so the place page matches: add level `first` ("First floor") and move the four first-floor rooms to it. **Keep every id.** Don't delete or rename rooms.

## Out of scope (note it, don't do it)
- Linking "The Batcave" to `james-dungeon` and converting its scene to v2. On the plan Multi-Purpose is 7.33 × 5.01 × 2.74 m; the Batcave render is 7.97 × 5.26 (~9 % wide). Write down what that link would take; James decides later.
- Furnishing any room.

## Report back (short bullets)
- What you traced and from which sheets, with the residuals from `plan-check`.
- The compare rounds and what's still off.
- Push results and the link `https://jameswigfield.com/memories/b/001c25b7-a2bd-4d71-a476-739b941f8f69`.
- Update the vault note and the Memory Rooms memory per `CLAUDE.md`.
