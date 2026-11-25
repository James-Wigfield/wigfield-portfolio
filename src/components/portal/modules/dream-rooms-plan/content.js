/* Every word on the Dream Rooms plan page that isn't the build prompt. Tabs
   read from here; keep lines short (each tab should read in about a minute). */

export const TABS = [
  { id: 'verdict', label: 'Verdict' },
  { id: 'capture', label: 'Capture' },
  { id: 'scene', label: 'Dream scene' },
  { id: 'pipeline', label: 'Pipeline' },
  { id: 'experience', label: 'Experience' },
  { id: 'privacy', label: 'Privacy & archive' },
  { id: 'roadmap', label: 'Roadmap & questions' },
];

// ── the sample dream (no real dream was pasted into the brief) ───────────────
export const SAMPLE_DREAM = `ok so I was back at school but it was also the airport, like the big hall at Perth airport but with the year 9 lockers all along the walls. everyone had already gone and I was meant to be catching a flight but I didn't know where to. the carpet was that green school carpet. I went down a corridor to find the gate and it just kept going, every door had the same number, 14, and when I went through one I was back at the start of the same corridor. there was a hum the whole time like the lights. mum was there at one point I think, or someone who was mum, at the end of the corridor, but I never got any closer. it was late afternoon but also dark outside the windows somehow. then the corridor was the indoor pool from swimming lessons and the water was completely still and I knew I wasn't allowed in. not scared exactly, more like I'd forgotten something really important. when I turned around the lockers were gone. can't remember the end, I think I just stood there`;

// kinds of fragment → colour role on the page
export const KINDS = [
  { id: 'place', label: 'Place' },
  { id: 'impossible', label: 'Impossible' },
  { id: 'figure', label: 'Figure' },
  { id: 'change', label: 'Change' },
  { id: 'vague', label: 'Vague' },
  { id: 'feeling', label: 'Feeling' },
];

// spans are character offsets into SAMPLE_DREAM (checked by page-check.mjs)
export const FRAGMENTS = [
  {
    id: 'school', kind: 'impossible', span: [6, 54],
    dream: '{ "id": "p1",\n  "is": ["school", "Perth airport hall"],\n  "archetype": "hall", "certainty": 0.8 }',
    world: '{ "id": "hall", "kit": "hall",\n  "props": [\n    { "kit": "locker-bank", "for": ["o1"] },\n    { "kit": "board", "for": ["p1", "v2"] } ],\n  "for": ["p1"] }',
    how: 'Two places at once. Both are kept: one hall, built with props from each.',
  },
  {
    id: 'hall', kind: 'place', span: [56, 90],
    dream: '{ "id": "p1", "scale": 1.3 }',
    world: '{ "kit": "hall", "size": [24, 5.2, 16],\n  "scale": 1.3 }',
    how: 'A big hall, made 30 % too big, because airports are.',
  },
  {
    id: 'empty', kind: 'feeling', span: [140, 165],
    dream: '"features": ["everyone already gone"]',
    world: '"figures": []   // nobody, on purpose',
    how: 'Empty is a feature. No crowd, and no people models.',
  },
  {
    id: 'flight', kind: 'vague', span: [170, 232],
    dream: '{ "id": "v2", "what": "where the flight went" }',
    world: '{ "kit": "board", "text": "",\n  "for": ["p1", "v2"] }',
    how: 'Kept vague: the departure board is blank.',
  },
  {
    id: 'endless', kind: 'impossible', span: [319, 337],
    dream: '{ "id": "p2", "archetype": "corridor",\n  "endless": true }',
    world: '{ "kit": "corridor", "repeat": true,\n  "for": ["p2"] }',
    how: 'One baked 8 m segment, copied, and a teleport back. Each copy drifts a little while unseen. The live sketch on Experience does this.',
  },
  {
    id: 'door14', kind: 'place', span: [339, 373],
    dream: '"features": ["every door numbered 14"]',
    world: '"doors": { "count": 3, "sign": "14" },\n"words": [{ "on": "corridor/doors.sign" }]',
    how: 'His exact detail, written on the doors. While unseen, one sign drifts to 41.',
  },
  {
    id: 'loop', kind: 'impossible', span: [379, 447],
    dream: '{ "id": "l1", "from": "p2", "to": "p2",\n  "via": "door", "impossible": "loops-back" }',
    world: '{ "kind": "teleport",\n  "a": "corridor:end", "b": "corridor:start",\n  "for": ["l1"] }',
    how: 'A doorway back to the corridor’s own start, through a bent stub, so you never see the jump.',
  },
  {
    id: 'hum', kind: 'feeling', span: [459, 495],
    dream: '{ "id": "s1", "what": "a hum like the lights" }',
    world: '"sound": { "bed": "hum-100",\n  "reverb": "too-big", "for": ["s1"] }',
    how: 'A procedural 100 Hz hum. It also earns the fluorescent panels, because the dream named the lights.',
  },
  {
    id: 'mum', kind: 'figure', span: [497, 555],
    dream: '{ "id": "f1",\n  "who": "mum, or someone who was mum",\n  "certainty": 0.5, "presence": "always-far" }',
    world: '{ "as": "silhouette",\n  "keep": "fog-distance", "for": ["f1"] }',
    how: 'Uncertain, and kept uncertain. A shape at the edge of the fog that you never reach.',
  },
  {
    id: 'time', kind: 'impossible', span: [613, 676],
    dream: '{ "id": "time",\n  "said": ["late afternoon", "dark outside"],\n  "contradiction": true }',
    world: '"look": { "light": "late-afternoon",\n  "windows": "dark", "for": ["time"] }',
    how: 'A contradiction kept as both: warm light inside, black windows.',
  },
  {
    id: 'pool', kind: 'impossible', span: [678, 737],
    dream: '{ "id": "l2", "from": "p2", "to": "p3",\n  "via": "became", "impossible": "transforms" }',
    world: '{ "kind": "dissolve", "from": "corridor",\n  "to": "pool", "for": ["l2"] }',
    how: 'No door: the fog turns white while you walk, and clears at the pool.',
  },
  {
    id: 'rule', kind: 'feeling', span: [777, 803],
    dream: '{ "id": "p3", "rule": "not allowed in" }',
    world: '{ "kit": "pool", "walkable": "edge-only" }',
    how: 'The rule becomes the collision: you can only walk the edge.',
  },
  {
    id: 'forgot', kind: 'feeling', span: [825, 875],
    dream: '"mood": { "felt": ["searching", "uneasy"],\n  "intensity": 0.6, "valence": -0.2 }',
    world: '"look": { "warmth": 0.3,\n  "fog": { "density": 0.085 } }\n// intensity 0.6 → drift at 1.1 m/s',
    how: 'The feeling sets the fog, the warmth and how fast you drift.',
  },
  {
    id: 'gone', kind: 'change', span: [877, 919],
    dream: '{ "id": "c1", "target": "o1", "to": "gone",\n  "trigger": "look-away" }',
    world: '{ "target": "hall/lockers", "action": "hide",\n  "when": "unseen", "after": "visited:corridor",\n  "for": ["c1"] }',
    how: 'The lockers vanish only while you aren’t looking, after the corridor, and they leave no shadow behind.',
  },
  {
    id: 'end', kind: 'vague', span: [921, 971],
    dream: '{ "id": "v1", "what": "the ending" }',
    world: '"wake": { "after": "pool",\n  "line": "I think I just stood there.",\n  "for": ["v1"] }',
    how: 'The forgotten end becomes the wake: fade to white, and his own last line.',
  },
];

// ── 01 Verdict ──────────────────────────────────────────────────────────────
export const PITCH = 'Type a dream at 6 am. That evening Claude and Blender build it, and you walk through it on your site.';

export const DAY = [
  { t: '06:10', title: 'You type', sub: 'half awake, on your phone' },
  { t: 'any time', title: 'It waits', sub: 'private, in the outbox' },
  { t: 'evening', title: 'Claude + Blender', sub: '“render my new dreams”, about 30 min' },
  { t: 'after', title: 'You walk it', sub: 'on your site, in the fog' },
];

export const MVP = [
  'Capture on your phone: one dark textarea, keyboard dictation, an offline outbox.',
  'One skill, dream-render: Claude writes dream.json and world.json, Blender builds and bakes, and Claude checks frames from the real viewer.',
  'A first-person drift: fog, a hum, doors and dissolves that go somewhere else, changes while you look away, your words in the place, and a wake.',
  'Private, behind its own password, at jameswigfield.com/dreams. Sharing comes next.',
];

export const CALLS = [
  { tone: 'go', title: 'Headless Blender, not the MCP.', why: 'The MCP needs Blender open. The same Python runs in the background here: corridor still 11 s, bake 20 s.' },
  { tone: 'go', title: 'Two files: what you dreamt, and one way to build it.', why: 'dream.json quotes your words and is kept. world.json can be rebuilt later with a better kit.' },
  { tone: 'go', title: 'Impossible spaces are teleports and dissolves.', why: 'Each place is its own module. A door jumps to another door, or the fog whites out and clears somewhere else.' },
  { tone: 'go', title: 'No default look.', why: 'Every finish comes from your words or stays plain grey. No Backrooms unless you dreamt them.' },
  { tone: 'go', title: 'People are absences.', why: 'A voice, a far silhouette, a coat on a chair. No 3D people.' },
  { tone: 'maybe', title: 'Its own password.', why: 'Justin has the Memory Rooms one. Dreams open with DREAMS_PASSWORD or the portal password.' },
];

export const FINDINGS = [
  { title: 'The brief said the Blender MCP; Memory Rooms actually uses a headless kit.', why: 'Dream Rooms does the same. The MCP stays for optional touch-ups with the app open.' },
  { title: 'There are no photos to check against.', why: 'So the checks are that nothing strange got tidied away, and a review of frames from the real viewer.' },
  { title: 'One shader pass is enough.', why: 'Measured here: 2 full-screen draws against 16 for three’s stock effects, at about a quarter of the cost. No new dependency.' },
  { title: 'Subtitles feel like a film.', why: 'Your words go into the place instead: on door signs, a blank departure board, the water.' },
  { title: 'Dictation mostly answers itself.', why: 'iOS keyboard dictation works in any textarea with no code. The Web Speech API is unreliable on iOS.' },
];

// ── 02 Capture ──────────────────────────────────────────────────────────────
export const CAPTURE_STEPS = [
  { id: 'open', title: 'Open', line: 'From the home-screen icon. It’s dark, and the textarea is waiting.' },
  { id: 'talk', title: 'Talk or type', line: 'Use the mic on your keyboard. Every word saves to the phone as you go.' },
  { id: 'save', title: 'Save dream', line: 'One big button. It dates the night, not the morning.' },
  { id: 'feel', title: 'Later, phase 2', line: 'How it felt, in a few taps. Never required.' },
];

export const RULES_6AM = [
  { tone: 'go', label: 'Nothing to decide', text: 'No title, no category and no privacy choice before the words are down.' },
  { tone: 'go', label: 'Dark', text: 'Near-black page and warm grey text. No white flash.' },
  { tone: 'go', label: 'Can’t lose it', text: 'Autosaves on every keystroke. The phone’s copy is deleted once it has uploaded.' },
  { tone: 'go', label: 'Editable until read', text: 'Fix it until Claude reads it. After that, “remembered more” adds to it.' },
  { tone: 'go', label: 'Private', text: 'Every dream is private. Sharing comes in phase 2.' },
];

export const DICTATION = [
  { tone: 'go', name: 'Keyboard dictation', verdict: 'Use', line: 'Built into iOS and works in any textarea. Needs no code and no permission.' },
  { tone: 'later', name: 'Voice memo → Whisper', verdict: 'Later', line: 'MediaRecorder works on iOS (audio/mp4). Whisper runs on your GPU at render time, with no paid service.' },
  { tone: 'no', name: 'Web Speech API', verdict: 'Skip', line: 'Patchy on iOS, worse from the home screen, and it needs Siri on.' },
];

// ── 03 Dream scene ──────────────────────────────────────────────────────────
export const SCENE_RULES = [
  'Every entry quotes your words, and a script finds them in the text.',
  'Two things at once stay two things.',
  'Uncertain stays uncertain. A 0.5 is a 0.5.',
  'Anything added just to make it walkable is marked invented and kept plain grey.',
];

// ── 04 Pipeline ─────────────────────────────────────────────────────────────
export const ROLES = [
  { id: 'script', label: 'Script' },
  { id: 'claude', label: 'Claude' },
  { id: 'blender', label: 'Blender' },
];

export const AHEAD = [
  { id: 'pull', who: 'script', title: 'Pull', line: 'Your text into a work folder on your PC.', code: 'pull.mjs --next' },
  { id: 'read', who: 'claude', title: 'Read', line: 'reading.md, then dream.json. Every entry quotes your words.', code: 'quote-spans.mjs · check-dream.mjs' },
  { id: 'design', who: 'claude', title: 'Design', line: 'world.json: modules, doors, dissolves, swaps, words, sound and the wake.', code: 'check-world.mjs · strangeness + no-default-look' },
  { id: 'build', who: 'blender', title: 'Build', line: 'The kit builds every module, then a quick draft bake.', code: 'build_world.py --draft' },
  { id: 'review', who: 'claude', title: 'Review', line: 'The real viewer walks it on autopilot. Claude reads the frames beside your text and fixes the worst 3 things, at most twice.', code: 'RUBRIC.md · ?autopilot=1' },
  { id: 'bake', who: 'blender', title: 'Bake + push', line: 'The full bake, swap targets left out, then world-v<N>.glb (≤ 6 MB).', code: 'bake_export.py → push.mjs' },
];

export const LIVE = [
  { title: 'Fog', line: 'FogExp2 in the materials' },
  { title: 'Dream pass', line: 'one shader: soft edges, glow, grain' },
  { title: 'Doors + dissolves', line: 'to somewhere they shouldn’t go' },
  { title: 'Swaps', line: 'only while you’re not looking' },
  { title: 'Words', line: 'on signs, boards and water' },
  { title: 'Sound', line: 'hum, room tone, too much reverb' },
];

export const BLENDER_VIEWS = [
  { id: 'haze', label: 'Cycles still' },
  { id: 'clear', label: 'No haze' },
  { id: 'atlas', label: 'Baked atlas' },
];
export const BLENDER_CAPTIONS = {
  haze: 'Rendered on your PC by one headless Python script: seven corridor segments, fluorescent panels as the only light, and a volume for haze. 1280 × 800, 256 samples, 11 s on the RTX 5070 Ti.',
  clear: 'The same view without the volume (5 s). Haze can’t be baked into textures, so the browser adds it back as fog.',
  atlas: 'The middle segment’s light, baked in 20 s with its neighbours present so its ends match them. This is all the browser draws: 57 KB as a GLB.',
};
export const BLENDER_FACTS = [
  ['Blender', '5.2.2 LTS, headless'],
  ['GPU', 'RTX 5070 Ti, OptiX'],
  ['Still', '11 s (5 s without haze)'],
  ['Bake', '20 s · 2048 px · 384 samples'],
  ['GLB', '57 KB · unlit · WebP'],
];

export const SKILLS = {
  borrows: [
    'Headless Blender with the GPU on, AgX',
    'Light baked through the view transform, then an unlit GLB',
    'pull → check → build → bake → push, and a work folder',
    'One hand-written validator in the Worker, viewer and scripts',
    'The walk grid from the GLB, now one grid per module',
  ],
  leaves: [
    'Photo comparison and camera solving',
    'Scale anchors from doors and beds',
    'The furniture kit, dollhouse and plan cut',
    'Supabase rows (dream rows live in R2)',
    'AR first (it breaks the spell, so it comes last)',
  ],
};

// ── 05 Experience ───────────────────────────────────────────────────────────
export const SKETCH_FRAGMENTS = [
  'every door had the same number, 14',
  'I was back at the start of the same corridor',
  'a hum the whole time like the lights',
  'or someone who was mum',
  'I’d forgotten something really important',
];

export const FEEL_RULES = [
  { label: 'No HUD', text: 'No crosshair, prompts or map.' },
  { label: 'Sound first', text: 'Black and hum for 2 s, then a slow fade in.' },
  { label: 'Drift', text: 'Hold to drift at about 1 m/s. No running.' },
  { label: 'Words in place', text: 'On doors, boards and walls, not subtitles.' },
  { label: 'Unseen changes', text: 'Out of view for 1.5 s, or past 15 m.' },
  { label: 'It ends', text: 'Fade to white, and your last line.' },
];

export const MODES = [
  { rank: 1, tone: 'go', name: 'Walk the dream', line: 'The MVP. Drift through it: fog, sound, your words in the place.' },
  { rank: 2, tone: 'go', name: 'Dream postcard', line: 'Build it first after the MVP: Blender stills drifting in 2.5D, with grain, your words and the hum. It runs on any phone and doubles as the share card.' },
  { rank: 3, tone: 'maybe', name: 'Listen', line: 'The soundscape and your words, with no picture. Almost free once the audio exists.' },
  { rank: 4, tone: 'maybe', name: 'VHS / painterly', line: 'A switch in the same shader. Cheap, but easy to overdo.' },
  { rank: 5, tone: 'later', name: 'Archive map', line: 'Worth it from about 10 dreams: recurring places, people and symbols.' },
  { rank: 6, tone: 'later', name: 'AR in your room', line: 'Memory Rooms’ AR would port, but your real room breaks the spell. Last.' },
];

export const BENCH = {
  note: 'Measured in headless Edge on the RTX 5070 Ti, rendering the baked corridor 150 times per setting. A phone GPU is roughly 30–60× slower, so read these as ratios, not phone timings.',
  rows: [
    ['iPhone, full res (1170 × 2532)', '0.06', '0.18', '0.49'],
    ['iPhone, capped at 1.5× (585 × 1266)', '0.04', '0.04', '0.16'],
    ['Desktop (1440 × 900)', '0.04', '0.05', '0.23'],
  ],
  head: ['Frame size', 'Bake only', 'Dream pass', 'three’s stock stack'],
  draws: 'Full-screen draws: 2 for the dream pass, about 16 for the stock stack (bloom 12, bokeh 2, film 1, output 1).',
};

// ── 06 Privacy & archive ────────────────────────────────────────────────────
export const WHO = [
  { id: 'anyone', label: 'Anyone', sub: 'no password, no link' },
  { id: 'link', label: 'Has a link', sub: 'phase 2' },
  { id: 'you', label: 'You', sub: 'DREAMS_PASSWORD' },
];
export const LEVELS = [
  { id: 'private', label: 'Private', sub: 'every dream, in the MVP', reach: { anyone: false, link: false, you: true } },
  { id: 'unlisted', label: 'Unlisted', sub: 'phase 2 · share one dream', reach: { anyone: false, link: true, you: true }, later: true },
  { id: 'public', label: 'Public', sub: 'phase 2 · listed on /dreams', reach: { anyone: true, link: true, you: true }, later: true },
];
export const GATE = [
  { title: 'Browser', sub: 'the page code is public' },
  { title: 'Worker', sub: 'checks the password first' },
  { title: 'R2', sub: 'rows and files, never public' },
];
export const PRIVACY_RULES = [
  { tone: 'go', label: 'The Worker decides', text: 'The page code is public, so dreams only come out of Worker routes that check the password.' },
  { tone: 'go', label: 'One 404', text: 'A private dream, a deleted one and a made-up id all get the same answer.' },
  { tone: 'go', label: 'Out of the logs', text: 'The skill never copies your dream words into notes, memory, decisions or commits.' },
  { tone: 'go', label: 'Gone means gone', text: 'Purge deletes the row and every file. Signed file links last an hour.' },
  { tone: 'later', label: 'Sharing, later', text: 'Shared dreams will carry only the words you tick, never Claude’s reading of them.' },
];

export const ARCHIVE_DREAMS = [
  { id: 'd1', x: 80, y: 70, label: '14 Nov', title: 'The gate I couldn’t find' },
  { id: 'd2', x: 260, y: 36, label: '19 Nov', title: 'Exams in the airport' },
  { id: 'd3', x: 420, y: 96, label: '2 Dec', title: 'Mum’s kitchen, upstairs' },
  { id: 'd4', x: 110, y: 214, label: '9 Dec', title: 'The pool with no bottom' },
  { id: 'd5', x: 380, y: 218, label: '30 Dec', title: 'Corridor under the house' },
];
export const ARCHIVE_MOTIFS = [
  { id: 'school', x: 170, y: 128, links: ['d1', 'd2'] },
  { id: 'airport', x: 340, y: 70, links: ['d1', 'd2'] },
  { id: 'mum', x: 300, y: 152, links: ['d1', 'd3'] },
  { id: 'pool', x: 60, y: 148, links: ['d1', 'd4'] },
  { id: 'corridor', x: 250, y: 236, links: ['d1', 'd5', 'd4'] },
];
export const ARCHIVE_LINES = [
  'Each dream’s motifs come from dream.json, so the archive costs nothing to keep.',
  'From about 10 dreams, a map shows what keeps coming back.',
  'Later, a recurring place could reuse its module, so one dream opens into another.',
];

// ── 07 Roadmap ──────────────────────────────────────────────────────────────
export const PHASES = [
  {
    id: 'p1', n: '1', title: 'MVP', tone: 'go', when: 'one build session',
    done: [
      'The sample dream runs end to end on this PC: capture → skill → Blender → drift → wake.',
      'Every must-keep oddity survives the strangeness check, and an autopilot walk reaches the wake with zero errors.',
      'Your first real dream is walkable on your phone at /dreams/<id> after you deploy.',
      'Logged out, any dream URL gives the same 404.',
    ],
  },
  {
    id: 'p2', n: '2', title: 'Postcard + sharing', tone: 'maybe', when: 'after 3–5 real dreams',
    done: [
      'Every dream has a postcard that runs on any phone.',
      'Unlisted links and public dreams work, sending only the words you ticked.',
      'The kit adds stair, outdoor and imported models, plus “how did it feel”.',
    ],
  },
  {
    id: 'p3', n: '3', title: 'Archive', tone: 'later', when: 'from about 10 dreams',
    done: [
      'A map of motifs links dreams that share places, people and symbols.',
      'A recurring place reuses its module across dreams.',
      'Voice memos, with Whisper run on your PC at render time.',
    ],
  },
  {
    id: 'p4', n: '4', title: 'Other ways in', tone: 'later', when: 'when 1–3 feel right',
    done: ['Listen mode, VHS and painterly switches, and AR last.'],
  },
];

export const RISKS = [
  { tone: 'maybe', title: 'It comes out tidy.', why: 'Claude tends to tidy things up. The strangeness check, frame reviews and quoted words push back.' },
  { tone: 'maybe', title: 'Every dream looks like the Backrooms.', why: 'No default look: finishes come from your words or stay grey, and the rubric fails drop ceilings you didn’t dream.' },
  { tone: 'maybe', title: 'Some dreams don’t fit a walk.', why: 'A dream that’s mostly people, or flying, or two lines long falls back to stills, words and sound.' },
  { tone: 'later', title: 'iPhone memory.', why: 'iOS kills heavy WebGL tabs. Mitigations: ≤ 6 MB per dream, one context, pixel ratio ≤ 1.5, and the still fallback.' },
  { tone: 'later', title: 'Dictation at 6 am.', why: 'iOS dictation stops after a silence, so you tap the mic again. The voice memo is the backup.' },
];

export const QUESTIONS = [
  { q: 'Can you give me 3 real dreams before the build, or should it start on the sample?', d: 'Start on the sample. Add your first real dream the morning after the build.', tone: 'go' },
  { q: 'Is private-only OK for the first build?', d: 'Yes. Sharing adds most of the privacy risk, so it waits for phase 2.', tone: 'go' },
  { q: 'Should dreams have their own password, separate from Memory Rooms?', d: 'Yes: DREAMS_PASSWORD, plus the portal one. Justin’s password never opens dreams.', tone: 'go' },
  { q: 'Is a new free R2 bucket, dream-rooms, OK for both rows and files?', d: 'Yes. With no Supabase table, there’s no SQL to run, and a dream is under 6 MB.', tone: 'go' },
  { q: 'When should a dream get built?', d: 'When you ask, in a Claude session: “render my new dreams”. Nothing runs on its own.', tone: 'go' },
  { q: 'Can Claude add things that weren’t in the dream, to make it walkable?', d: 'Yes, but marked invented and kept plain: grey walls and fog, never new detail.', tone: 'maybe' },
  { q: 'Do you want voice memos as well as typing?', d: 'Not yet. Try keyboard dictation on your phone first (30 s). Add recording and Whisper if it lets you down.', tone: 'maybe' },
  { q: 'Should a dream about a real place reuse its Memory Rooms model?', d: 'Not in the MVP. Later, by importing its GLB, so Dream Rooms stays standalone.', tone: 'later' },
];
