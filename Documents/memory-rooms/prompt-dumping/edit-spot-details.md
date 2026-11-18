Let James and Justin edit a saved spot's details after capture, above all its location: where it was saved from,
and the place name.

Context
- Read first: src/memory-rooms/README.md, src/memory-rooms/CONTRACTS.md (§2 rows, §3 Worker API),
  tools/memory-rooms/README.md, tools/memory-rooms/DECISIONS.md, and the vault note
  C:\Users\james\Documents\james-claude-brain\01-Active-Projects\memory-rooms.md.
- Today nothing in the UI changes a spot once it's saved. What's already there:
  - The Worker already has `PATCH /api/memories/spots/:id` (workers/memory-rooms.js patchSpot), and the browser
    client has `api.patchSpot`. Only the Node scripts call it (pull marks a spot "modelling", push sets the scene).
    - It accepts title, note, kind, lat, lng, locAccuracyM, placeLabel, scaleHint, status, frameGroup,
      tripStopId and scene.
    - It does NOT accept locSource, capturedAt or createdBy, and it silently ignores fields it doesn't know.
    - It doesn't check lat/lng the way the POST does (captureFields: range, and lat and lng go together).
  - The spot page is pages/SpotPage.jsx + pages/spot/SpotPanel.jsx: kind, status, title, note, and the meta
    (by, place, captured date).
  - Capture's location step, capture/StepLocation.jsx, has three ways in:
    - "Use where I am" (GPS);
    - a pin on map/PickMap.jsx (Mapbox, or the SVG atlas as the fallback);
    - a typed place from the offline gazetteer map/places.js, or a raw "lat, lng".
    - It's wired to the capture draft: `update(fn)`, and `loc` = { lat, lng, accuracy, source, label, labelAuto }.
  - PickMap's Mapbox engine is a billed map load every time it mounts (no-card trial, 5,000 a month).
  - The outbox (lib/outbox.js) re-POSTs a spot only when its row 404s, and the POST is an upsert that refreshes
    the capture fields. Make sure an edit can't be undone by a late outbox retry.
  - A real case this is for: the live spot "Mazda" (b8b53457-…, the first exterior) was typed as "San Diego",
    but the photos are from WA. James fixes it himself in the new UI after deploy. Don't touch live data.
- Another session may still be finishing the map's 3D markers. It works in map/, map/mapbox/, the markers,
  page-check.mjs, DECISIONS.md, the READMEs, copy.js and memory-rooms.css.
  - In shared files, re-read just before each edit and make small, additive edits.
  - Never rewrite a whole file or revert changes you didn't make.
  - Stay out of map/mapbox/ unless you have to, and say why if you do.

Choices (my defaults, flag anything you'd change before building)
- Where:
  - An "Edit" link in the spot page's panel opens its own route, `/memories/:id/edit` (add `paths.edit` in
    routes.js).
  - It's a page rather than a sheet, so the phone's back button works and the spot page's 3D viewer isn't running
    alongside a map.
- What's editable:
  - Title and note (the capture limits: 120 / 600).
  - Place: the location (pin / GPS / typed place / coordinates) and the place label. This is the main one.
  - Captured date. Edit the day only, keep the time of day (the phone clock was wrong, or it was saved the next
    day).
  - Who saved it (James / Justin), in case the wrong person was picked.
  - Kind and scale hint, only while the spot has no scene. Once a scene exists, show them locked, with one line
    saying the 3D room was built from them. The Worker refuses a kind change on a spot with a scene too.
  - Not editable: photos, status, scene, frameGroup (they belong to the render pipeline). Delete: the API has a
    soft delete and restore but no UI; leave it out unless I ask.
- The location editor:
  - Reuse StepLocation, don't fork it. Lift it into one shared picker that takes { loc, onChange }, used by both
    capture and edit, with capture behaving exactly as it does now.
  - It opens on the spot's current location at street zoom with the pin draggable; "Use where I am" stays.
  - Label rule:
    - The label stays if the pin moves a little.
    - If the pin moves far (say more than 25 km from where it was) and the label hasn't been retyped in this edit,
      it switches to the nearest place and says so, so you notice. (Drag Mazda to WA → the label becomes the WA
      place.)
- Billing: the picker mounts only when the place section is opened (a "Change location" button), never on page
  load. So a title fix costs 0 map loads and a location fix costs 1.
- Save:
  - One PATCH carrying only the fields that changed.
  - On success, show it saved and go back to the spot page with the new values. Worker errors (`details`) show
    next to their fields.
  - Leaving with unsaved changes asks first (in-app back, and beforeunload).
- Offline:
  - Editing needs signal. Offline, Save is disabled with one line saying why.
  - What's been typed is kept (per spot id, in IndexedDB or sessionStorage) until it's saved or discarded.
  - Edits don't go through the outbox (conflicts aren't worth it). Say if you think queueing them is.
- Two phones editing one spot:
  - The form sends `ifUpdatedAt` (the spot's updatedAt when the form opened). If the spot changed since, the
    Worker answers 409.
  - The page then says "Justin changed this spot while you were editing" and offers to reload.
  - Scripts don't send `ifUpdatedAt`, so they're unaffected.
- Worker:
  - PATCH accepts locSource (gps | pin | typed), capturedAt (ISO) and createdBy (james | justin).
  - It checks lat/lng with the same code as captureFields (share it, don't copy it).
  - It refuses a kind change when a scene exists, and handles `ifUpdatedAt` → 409.
  - No new columns: loc_source, captured_at and created_by already exist in supabase/memory_rooms.sql.
  - No edit history: the old location is gone once you save. Say if you think it's worth keeping the original
    capture location (that would be a new column and a CONTRACTS change, so flag it first).
- Map: nothing new. /memories reloads its spots when it mounts, so an edited spot shows at its new place on the
  next visit. Check that a rendered spot's marker and 3D diorama move with it.

Constraints
- Change CONTRACTS.md §3 first, then the code (as the file says).
- The capture flow must not change: its page-check walk still passes untouched. One map load per page, still.
- Phones first: 390 px wide, controls within thumb reach, inputs at 16 px or more (iOS zooms below that).
- All copy goes in copy.js (a new `edit` section); all colours are the .mr tokens in memory-rooms.css
  (light + dark). Design rule: no coloured rounded left-border callout boxes or filled pills.
- Stay on main (no branch). Don't touch the uncommitted dev-setup files. Don't commit, deploy, or write to the live
  site without asking me.

Verify
- Local loop: npm run build → npx wrangler dev --port 8788 (restart after every build; 8787 is taken)
  → node tools/memory-rooms/seed-dev.mjs --examples-only → page-check. Local password: trip-local.
- api-check.mjs, against local:
  - the new PATCH fields;
  - lat without lng, out-of-range values, a bad createdBy, a bad date (all 400);
  - a kind change on a spot with a scene (400);
  - a stale `ifUpdatedAt` (409);
  - the scripts' existing PATCHes still work.
- page-check: an edit walk at 390 (touch) and 1440, each in its own browser context:
  - spot page → Edit → change the title, the date and the location (drag the pin, then a typed place) → Save;
  - the spot page shows the new values, a reload keeps them, and /memories puts the spot at its new place;
  - Mapbox loads: 0 until the place section opens, then 1;
  - offline: Save is disabled and what was typed survives a reload;
  - `?map=atlas`: the edit still works on the atlas;
  - zero console errors;
  - light and dark.
- Screenshots at 390 and 1440, light and dark: the edit page, the place section open, and the saved spot page.
  Make one contact sheet and show me.

When done:
- Update the vault note, add a dev log, and add DECISIONS.md entries (continue from the last number) per
  CLAUDE.md.
- Tell me the exact steps to fix Mazda's place on the live site once this is deployed.
