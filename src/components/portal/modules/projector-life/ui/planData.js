/* ============================================================================
   PROJECTOR LIFE — the merger plan as data (Plan tab). The long-form version
   for the mate's Claude Code is Documents/projector-life/merger-plan.md —
   keep the phases, tools, risks and questions in step with it.
   ========================================================================== */

export const STANDFIRST = {
  kicker: 'the merger plan',
  lead: 'Every mapped region of the room becomes a habitat with its own gravity — and Claude becomes its naturalist.',
  sub: [
    { k: 'his side', v: 'projection mapper + MCP: regions, warps, projectors' },
    { k: 'my side', v: 'the Specimen Cabinet: Lenia, Gray-Scott, Physarum, Particle Life, PPS, ecology' },
    { k: 'the join', v: 'one region-content interface + a handful of MCP tools' },
  ],
};

export const PHASES = [
  {
    n: 0,
    short: 'Read',
    title: 'Read his repo, agree the interface',
    level: 'groundwork',
    bullets: [
      'Find his stack: browser/JS hosts the sims directly; anything else gets a browser output window or a port',
      'Learn how regions are stored (polygons? homographies? meshes?) and which MCP tools exist',
      'Agree RegionContent: init · step · render · seed · dispose, sized in metres',
    ],
    tools: [],
    accept: 'A test pattern from a JS module fills one of his mapped regions',
  },
  {
    n: 1,
    short: 'Content',
    title: 'Life as projected content',
    level: 'level 1',
    bullets: [
      'Pull the sims out of the cabinet page into a library both repos import (artifical-life stays the source of truth)',
      'One sim per region, rendering into that region’s texture',
      'Real edges instead of wrap-around; pure #000 background, projection palettes',
    ],
    tools: ['list_life_systems', 'set_region_life', 'seed_region', 'snapshot_region'],
    accept: 'Three regions run three different sims at 60 fps; an empty region measures as projector black',
  },
  {
    n: 2,
    short: 'Room',
    title: 'The room model',
    level: 'level 2',
    bullets: [
      'Per region: surface type, size in metres, up edge, seams, obstacle masks',
      'Claude enters it over MCP from a description; camera auto-detection later',
      'Gravity per region falls out of it: slide along, press in or peel off',
    ],
    tools: ['describe_region', 'link_seam', 'set_mask'],
    accept: 'The She’d described as 18 regions; every seam pairs up; gravity arrows point the right way',
  },
  {
    n: 3,
    short: 'Gravity',
    title: 'Cheap spatial wins',
    level: 'level 2',
    bullets: [
      'Gray-Scott drifts along gravity: patterns drip down walls, creep down the roof',
      'Physarum geotaxis + agents crossing seams (wall → roof → wall → floor)',
      'Particle Life with gravity and grip',
    ],
    tools: ['set_climate'],
    accept: 'Drips visibly run down a wall; agents cross the eave seam without a jump',
  },
  {
    n: 4,
    short: 'Plate VII',
    title: 'Plate VII — life that evolves its grip',
    level: 'level 2',
    bullets: [
      'Fork the ecology sim: grip cells, a timing gene (a per-organism clock), pull-off force, pendulum hang',
      'Falls between regions; bodies become floor detritus for scavengers',
      'Headless Node evolution harness: grips per body, speed, swing index per surface; pre-evolve genomes',
    ],
    tools: ['introduce_species'],
    accept: 'Ceiling lineages evolve a higher swing index than floor lineages, with no gait scripted',
  },
  {
    n: 5,
    short: 'Naturalist',
    title: 'Claude, the room’s naturalist',
    level: 'mcp',
    bullets: [
      'Census the room; name new species in the cabinet’s Latin-binomial style',
      'Set the climate; introduce species; look at a snapshot',
    ],
    tools: ['room_census', 'introduce_species', 'set_climate', 'snapshot_room', 'name_species'],
    accept: 'Claude runs a census, spots a new lineage in a snapshot and names it',
  },
  {
    n: 6,
    short: 'Sensing',
    title: 'The room looks back',
    level: 'sensing',
    bullets: [
      'Webcam shadows feed the light field: life flees (or follows) people',
      'Structured light: the projector throws patterns, a camera reads them, geometry calibrates itself',
    ],
    tools: ['calibrate_room', 'read_shadows'],
    accept: 'Auto-calibrated regions land within ~1 cm of the hand-mapped ones',
  },
];

export const RISKS = [
  {
    t: 'CPU budget across many regions',
    why: '18 regions × a sim each. Split one budget by area, cut populations hard, move grid sims to GPU ping-pong.',
    tone: 'warn',
  },
  {
    t: 'Black level and ambient light',
    why: 'A projector’s “black” is a grey glow over the whole frustum. Dark room, black content, nothing projected where nothing lives.',
    tone: 'warn',
  },
  {
    t: 'Coloured walls',
    why: 'The She’d is sage (#cfdad2): projected light is multiplied by it. Pick palettes per surface; compensate later.',
    tone: 'mild',
  },
  {
    t: 'Seams across regions with different pixel densities',
    why: 'Simulate in metres at one px/m everywhere; let the mapper resample per region, never the sim.',
    tone: 'warn',
  },
  {
    t: 'Projection shadows',
    why: 'The loft, furniture and people block light. Two projectors from opposite corners fill most shadows.',
    tone: 'mild',
  },
];

export const QUESTIONS = [
  { t: 'What is the repo and its stack?', why: 'Browser/JS runs the sims as-is; Python/TouchDesigner/Unity needs an output window or a port.' },
  { t: 'Are regions labelled floor / wall / ceiling?', why: 'And do they know their real size in metres, or only projector pixels?' },
  { t: 'Is there a camera?', why: 'Phase 6 (shadows, structured-light calibration) depends on it.' },
  { t: 'How many regions at once?', why: 'Sets the CPU budget; the She’d alone is 18.' },
  { t: 'Which projector and lens?', why: 'Throw ratio, lumens and black level decide what one projector can cover.' },
  { t: 'Which MCP tools exist already?', why: 'So the new ones extend his naming rather than fight it.' },
];

export const INTERFACE_CODE = `// The one interface both repos agree on (phase 0)
export interface RegionContent {
  // region facts from the mapper, in metres
  init(region: { id: string, type: 'floor' | 'wall' | 'ceiling',
                 size_m: [number, number], up_edge: string | null,
                 px_per_m: number }): void;
  step(dt_s: number): void;               // fixed ticks inside its own budget
  render(target: ImageData | WebGLTexture): void;   // #000 = no light
  seed(x_m: number, y_m: number): void;   // Claude or a click
  dispose(): void;
}`;
