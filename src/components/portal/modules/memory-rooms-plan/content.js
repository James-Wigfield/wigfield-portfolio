/* Every word on the Memory Rooms plan page that isn't the build prompt. Tabs
   read from here; keep lines short (the page is meant to be read in a minute). */

export const TABS = [
  { id: 'verdict', label: 'Verdict' },
  { id: 'capture', label: 'Capture' },
  { id: 'framework', label: 'Framework' },
  { id: 'render', label: 'Render loop' },
  { id: 'house', label: 'Your house' },
  { id: 'roadmap', label: 'Roadmap & questions' },
];

// ── 01 Verdict ──────────────────────────────────────────────────────────────
export const LANES = [
  {
    id: 'diorama', name: 'Diorama', tone: 'go', verdict: 'Every spot',
    by: 'Claude writes a scene.json; Blender models, lights and bakes it; three.js shows it.',
    rows: [['Needs', '4–8 photos and a scale hint'], ['Looks', 'Detailed, softly lit miniature, one style for every spot'], ['On site', 'About 2 min'], ['After', 'Claude, about 3 rounds per spot']],
  },
  {
    id: 'scan', name: 'Scan', tone: 'maybe', verdict: 'When it matters',
    by: 'Scaniverse, a free phone app, builds a Gaussian splat on the phone.',
    rows: [['Needs', 'A slow 1–2 min walk-around'], ['Looks', 'Photoreal, soft edges'], ['On site', '2 extra minutes'], ['After', 'Nothing. Upload the .spz file']],
  },
  {
    id: 'generated', name: 'Generated', tone: 'later', verdict: 'Try later',
    by: 'World Labs Marble invents a 3D world from a few photos.',
    rows: [['Needs', '2–8 photos'], ['Looks', 'Photoreal, partly invented'], ['On site', 'Nothing extra'], ['After', 'Paid; not tested here']],
  },
];

export const CHANGES = [
  { title: 'Blender builds and lights the room, three.js only shows it.', why: 'Claude writes the layout as JSON, which keeps it checkable. A Blender kit adds the detail, bakes realistic lighting into the textures and exports a model file the web viewer loads.' },
  { title: 'Claude checks its own work.', why: 'It renders the model from where each photo was taken, puts each photo beside its render, and fixes the differences.' },
  { title: 'Location comes from the phone, not the photos.', why: 'iPhones strip GPS from photos picked in a web page, so the page reads your location when you press save.' },
  { title: 'A free scan for the places that matter most.', why: 'Two minutes in Scaniverse gives a photoreal version you can switch to from the diorama.' },
  { title: 'Blender runs in the background, so the MCP is optional.', why: 'The Blender MCP (blender.org Lab server) needs the app open. Headless Blender 5.2 runs the same Python on your GPU: a test room rendered in 4.4 s. The MCP stays useful for live touch-ups.' },
];

// ── 02 Capture ──────────────────────────────────────────────────────────────
export const CAPTURE_STEPS = [
  { id: 'kind', title: 'Interior or exterior', line: 'Plus a name.' },
  { id: 'photos', title: 'Six photos', line: 'Follow the shot guide.' },
  { id: 'memory', title: 'The memory', line: 'One line, a scale hint, an optional scan.' },
  { id: 'place', title: 'Place', line: 'GPS, or drop a pin.' },
];

export const SHOTS = {
  interior: 'Stand in each corner and shoot across the room (1–4). Then take the detail you’ll remember (5) and one wide shot from the door (6).',
  exterior: 'Shoot four angles around the building (1–4). Then take a detail (5) and one wide shot from across the street (6).',
};

// ── 03 Framework ────────────────────────────────────────────────────────────
export const NODES = [
  { id: 'phone', role: 'cap', x: 80, y: 150, title: 'Phone', sub: '/memories/new', sub2: 'offline outbox',
    detail: 'The capture page. It shrinks photos on the phone, holds them in an outbox, and uploads when there’s signal.', where: 'src/memory-rooms/capture/' },
  { id: 'worker', role: 'store', x: 270, y: 150, title: 'Worker API', sub: '/api/memories/*', sub2: 'password-gated',
    detail: 'New routes on the existing site Worker. They stream files to R2 and write rows to Supabase.', where: 'workers/memory-rooms.js' },
  { id: 'r2', role: 'store', x: 460, y: 66, title: 'R2 bucket', sub: 'photos · thumbs', sub2: 'scans · renders',
    detail: 'Cloudflare file storage: 10 GB free and no download fees. Supabase’s free 1 GB is already shared with the trip site.', where: 'binding MEMORIES · bucket memory-rooms' },
  { id: 'supabase', role: 'store', x: 460, y: 234, title: 'Supabase', sub: 'memory_spots', sub2: 'memory_media',
    detail: 'One row per place, holding its note, location, status and scene.json. It’s the same Supabase project as the trip site, so the rows move with the tool.', where: 'supabase/memory_rooms.sql' },
  { id: 'claude', role: 'claude', x: 650, y: 150, title: 'Claude + Blender', sub: 'memory-render skill', sub2: 'headless Cycles',
    detail: 'You say “render spot X”. Claude pulls the spot, reads the photos and writes scene.json. Blender builds and renders it, Claude compares and fixes it, then Blender bakes the lighting and exports room.glb.', where: '.claude/skills/memory-render/ + tools/memory-rooms/blender/' },
  { id: 'viewer', role: 'view', x: 880, y: 150, title: 'Map + viewer', sub: '/memories', sub2: 'model ⇄ scan',
    detail: 'A US + western Canada map. Click a spot to open its baked Blender model in three.js, or the Spark viewer for a scan.', where: 'src/memory-rooms/' },
];

export const EDGES = [
  { from: 'phone', to: 'worker', label: 'upload' },
  { from: 'worker', to: 'r2', label: 'files' },
  { from: 'worker', to: 'supabase', label: 'rows' },
  { from: 'r2', to: 'claude', label: 'pull' },
  { from: 'supabase', to: 'claude', label: 'pull' },
  { from: 'claude', to: 'viewer', label: 'room.glb', dash: true },
];

export const PORTABLE = [
  ['src/memory-rooms/', 'pages, capture, map, three.js viewer (GLB + Spark)'],
  ['workers/memory-rooms.js', 'the /api/memories/* routes'],
  ['supabase/memory_rooms.sql', 'two tables, RLS on'],
  ['tools/memory-rooms/', 'pull · check · compare · push + blender/ kit, build and bake'],
  ['.claude/skills/memory-render/', 'the render workflow Claude follows'],
];

// ── 04 Render loop ──────────────────────────────────────────────────────────
export const LOOP = [
  { id: 'pull', short: 'pull', title: 'Pull the spot', line: 'Downloads the photos and the note to a local work folder and marks the spot “modelling”.', script: 'pull.mjs <spotId | --next>' },
  { id: 'read', short: 'read', title: 'Read the photos', line: 'Claude looks at every photo and the floor plan, then writes layout.md: sizes, objects, and which photo shows what.', script: 'palette.mjs → layout.md' },
  { id: 'write', short: 'write', title: 'Write scene.json', line: 'The room as data: walls and openings, kit pieces, lights, memory pins, and one camera per photo.', script: 'scene.json (schema v1)' },
  { id: 'check', short: 'check', title: 'Check it', line: 'Valid schema, objects inside the walls, nothing floating, doors inside their wall, cameras inside the room.', script: 'check-scene.mjs' },
  { id: 'build', short: 'build', title: 'Build in Blender', line: 'The Blender kit builds the room with detailed pieces and materials, then Cycles renders it from each photo’s camera, plus a top-down and a 3/4 view.', script: 'blender/build_room.py' },
  { id: 'compare', short: 'compare', title: 'Compare', line: 'Each photo beside its render on one sheet. Claude names the 3 biggest mismatches and goes back to fix them, at most 3 times. Then Blender bakes the lighting and exports room.glb.', script: 'compare.mjs → compare.png → blender/bake_export.py' },
];

// ── 05 Your house ───────────────────────────────────────────────────────────
export const HOUSE_ROOMS = [
  { id: 'living', label: 'Living', x: 14, y: 14, w: 150, h: 110 },
  { id: 'kitchen', label: 'Kitchen', x: 164, y: 14, w: 100, h: 80 },
  { id: 'laundry', label: 'Ldry', x: 264, y: 14, w: 62, h: 80 },
  { id: 'hall', label: 'Hall', x: 164, y: 94, w: 162, h: 30 },
  { id: 'bed1', label: 'Bed 1 · test', x: 14, y: 124, w: 110, h: 90, test: true },
  { id: 'bath', label: 'Bath', x: 124, y: 124, w: 70, h: 90 },
  { id: 'bed2', label: 'Bed 2', x: 194, y: 124, w: 132, h: 90 },
];

export const GIVES = [
  { from: 'Floor plan', to: 'Wall lengths, door and window positions, ceiling height if it’s marked' },
  { from: 'Photos', to: 'Furniture, colours, finishes, where things sit' },
  { from: 'You', to: 'One line on why the room matters, which becomes a pin' },
];

export const HOUSE_TEST = [
  'Take 6 photos of one room, following the shot guide.',
  'Open /memories/new on the local server and save the spot. Drop the pin by hand, because GPS needs HTTPS.',
  'Give Claude the floor plan image and say which room it is.',
  'Run the memory-render skill. Check compare.png, then explore the diorama.',
];

// ── 06 Roadmap ──────────────────────────────────────────────────────────────
export const MILESTONES = [
  { date: '2026-11-08', when: '8 Nov', label: 'This plan', tone: 'go' },
  { date: '2026-11-09', end: '2026-11-17', when: 'started 8 Nov', label: 'Build stage 1', tone: 'claude' },
  { date: '2026-11-21', when: '~21 Nov', label: 'House test, one room', tone: 'claude' },
  { date: '2026-12-05', when: 'by ~5 Dec', label: 'Deploy + test with Justin', tone: 'maybe' },
  { date: '2027-01-24', when: 'late Jan', label: 'Render batch', tone: 'claude' },
  { date: '2027-02-02', when: 'Feb', label: 'Move to trip site?', tone: 'later' },
];

export const QUESTIONS = [
  { q: 'Is it OK to create a free Cloudflare R2 bucket for the photos and scans?', d: 'Yes, at deploy time. The alternative is Supabase Pro (US$25 a month), because the free 1 GB is shared with the trip site.', tone: 'maybe' },
  { q: 'Will you both scan the places that matter most with Scaniverse?', d: 'It’s optional; maybe about 10 spots. Check that it runs on both your phones before you fly.', tone: 'maybe' },
  { q: 'Does Justin get a password for /memories that doesn’t open the portal?', d: 'Yes: one MEMORIES_PASSWORD for you both, separate from the portal password.', tone: 'go' },
  { q: 'What format is your floor plan, and does it show dimensions?', d: 'An image or PDF with dimensions. Without them, Claude scales from a standard door (about 2.04 m).', tone: 'maybe' },
  { q: 'When should it be deployed? Phone GPS only works over HTTPS.', d: 'Right after the house test, in early December, so Justin can try it on his phone.', tone: 'go' },
  { q: 'Is a stylised map enough, or do you want street detail?', d: 'A stylised SVG map with zoom. Add MapLibre with free tiles later if spots crowd together in cities.', tone: 'go' },
  { q: 'Should spots link to trip stops now?', d: 'The trip_stop_id column is ready but stays unused until the move.', tone: 'go' },
  { q: 'Should you try World Labs Marble on a few spots after the trip?', d: 'Maybe. It’s paid, and its multi-photo features come from secondary sources only.', tone: 'later' },
];
