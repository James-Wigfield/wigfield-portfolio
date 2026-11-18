Upgrade the /memories map from the hand-built SVG atlas to a real Mapbox GL JS world map.

Context
- Read first: src/memory-rooms/README.md, src/memory-rooms/CONTRACTS.md, tools/memory-rooms/README.md,
  and the vault note C:\Users\james\Documents\james-claude-brain\01-Active-Projects\memory-rooms.md.
- Current map: AtlasMap.jsx (SVG base map) + geo.js (projection) + atlas.json (built by
  tools/memory-rooms/build-atlas.mjs). It is used by two places:
    1. SpotsMap.jsx (via pages/MapPage.jsx): the /memories map, with clusters.js, SpotDot, SpotCard,
       SpotList, Filters, MapControls, zoom.js, useMapViewport.js, places.js (place labels).
    2. PickMap.jsx (via capture/StepLocation.jsx): the drop-a-pin picker in the capture flow.
- Token: import.meta.env.VITE_MAPBOX_TOKEN, already set in .env.local (default public pk. token, NO-CARD
  TRIAL = 5,000 map loads/month). Never hardcode it, never put it in .dev.vars.

Choices (my defaults, flag anything you'd change before building)
- Globe projection, opening framed on the USA + western Canada (where the trip is), able to see the world.
- Convert BOTH SpotsMap and PickMap to Mapbox.
- Keep the old SVG AtlasMap as the fallback when the token is missing or WebGL fails.
- Map style should sit with the .mr tokens in memory-rooms.css, light and dark. Propose 2 options
  (e.g. a muted custom style vs Mapbox Standard) with screenshots before committing to one.

Constraints
- Every Map init = 1 billable load: create the map once per page, never remount it on filter, cluster,
  or card changes.
- Lazy-load mapbox-gl (dynamic import) so only /memories routes pay for the bundle.
- Keep current behaviour: clusters, spot dots, spot cards, filters, the list, the place labels, zoom
  controls. Decide between Mapbox's native clustering and the existing clusters.js, and tell me why.
- Copy lives in copy.js. Design rule: no coloured rounded left-border callout boxes or filled pills.
- Stay on main (no branch). Don't touch the uncommitted dev-setup files. Don't commit or deploy
  without asking me.

Verify
- Local loop: npm run build → npx wrangler dev --port 8788 (restart after every build; 8787 is taken)
  → node tools/memory-rooms/seed-dev.mjs --examples-only → node tools/memory-rooms/page-check.mjs.
  Local password: trip-local.
- Update page-check.mjs for the new map (it needs real WebGL, so use local Edge with GPU flags).
- Screenshot both maps (desktop + phone width, light + dark) and show me.

When done: update the vault note + add a dev log per CLAUDE.md.
