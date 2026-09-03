// Art direction for the 3D office, matched to the home-screen banner
// (public/office/website_banner.png): a lo-fi pixel office at golden hour.
// Cream-white portlets with cyan visor eyes and red-orange headphones,
// charcoal furniture with honey-wood desktops, ember-red accents (mugs,
// beanbags, doors), warm tile floor washed in sunset light, and a calm
// late-afternoon sky behind the diorama that blends into the portal's
// own light palette.

export const BRAND = {
  ember: "#c5371c",
  accent: "#ff6a3d",
  light: "#e8edf0",
  slate: "#39424d",
  navy: "#0c131b",
};

/** Fallback flat backdrop - the sky's mid tone, near the portal's page bg. */
export const SCENE_BG = "#dde5ea";

/** A calm late-afternoon haze, horizon (0) → zenith (1): the diorama's warm
    sunset light pooling low, lifting into the portal's cool pale blue
    (--c-bg is #e8edf0) so the scene sits naturally inside the light UI. */
export const SKY_STOPS: [number, string][] = [
  [0.0, "#f2e4c8"], // warm sand at the horizon - the tiles' sunset wash
  [0.42, "#e9e3d6"], // cream haze, fading out slowly
  [0.72, "#dce4ea"], // into the portal's cool light
  [1.0, "#c3d3de"], // soft day-blue at the zenith
];

// Warm cream checker, like the banner's sunset-washed tile - light enough
// that the charcoal furniture and cream robots read against it, with a
// checker gap wide enough to survive the toon ramp's quantisation.
export const FLOOR = {
  tileA: "#e6d5ba",
  tileB: "#c4ad8d",
  plinth: "#332a35",
};

export const WALL = {
  body: "#3a3540",
  cap: "#efe4cf",
  door: "#c5371c",
  doorDark: "#992a13",
  handle: "#efe4cf",
};

export const UI3D = {
  accent: "#ff6a3d", // brand accent
  ember: "#c5371c", // deep brand red-orange
  valid: "#2fbf71",
  invalid: "#e0455a",
  ghostOpacity: 0.55,
  /** Wash over the office while one agent is on stage - the scene's own dusk,
      a shade cooler than the floor so the sunset still reads underneath. */
  stageScrim: "#0a1220",
};

export const DESK = {
  top: "#c78a4c", // honey wood, straight off the banner desks
  topEdge: "#a86e38",
  side: "#2d2a33", // charcoal frame
  monitor: "#1a1c23",
  screen: "#221f2e", // dark glass - the code lines carry the glow
  code: "#ff9a4d", // banner-orange terminal text
  codeDim: "#6f5a54",
  keyboard: "#3b3843",
  chair: "#33303a",
  chairDark: "#232028",
  mug: "#d3492c",
  book: "#c5371c",
  bookDark: "#3a3540",
};

export const PLANT = {
  pot: "#332f38", // dark ceramic, like the banner's floor planters
  potRim: "#232028",
  soil: "#4a3a2c",
  leafA: "#5da35f",
  leafB: "#478a4d",
  leafC: "#74bd74",
};

/** The banner's big squashy red beanbag. */
export const BEANBAG = {
  body: "#e04a2f",
  shade: "#b13320",
  seam: "#8f2818",
};

/** Open bookshelf - the banner's wall shelves with books and a plant. */
export const SHELF = {
  frame: "#2d2a33",
  board: "#3a3540",
  bookA: "#c5371c",
  bookB: "#ff6a3d",
  bookC: "#efe4cf",
  bookD: "#3f4a5c",
};

/** Coffee station - the banner's espresso corner. */
export const COFFEE = {
  cabinet: "#2d2a33",
  top: "#c78a4c",
  machine: "#232028",
  steel: "#b9b2a4",
  light: "#ffb054",
  mug: "#d3492c",
  cup: "#efe4cf",
};

/** Warm floor lamp for the lounge corners. */
export const LAMP = {
  pole: "#232028",
  shade: "#2d2a33",
  bulb: "#ffca7a",
};

/** Freestanding whiteboard with the banner's red sticky notes. */
export const BOARD = {
  frame: "#3a3540",
  face: "#efe9db",
  noteA: "#e04a2f",
  noteB: "#ff8a5c",
  noteC: "#c5371c",
  ink: "#4a4453",
};

/** Server rack - where the portlets' brains live. */
export const SERVER = {
  body: "#232028",
  face: "#2d2a33",
  slat: "#1a181e",
  ledAmber: "#ffb054",
  ledCyan: "#6fd9ff",
};

/* ── Portlet design system ───────────────────────────────────────────────
   Every agent IS a portlet - the little robot from the banner art: rounded
   cream shell, dark visor with two glowing CYAN eyes, red-orange headphone
   discs, an antenna with a glowing bobble, and orange accents at the chest,
   belt and knees. A persona picks the silhouette (pip short & round, otto
   taller); the worker id then picks the exact accent shade and small trims,
   so the fleet is cohesive but each unit is subtly its own. */

export const BOT = {
  shell: "#f4eee1", // warm cream, not clinical white
  shellShade: "#d6ccb8",
  visor: "#12151b",
  eye: "#6fd9ff", // the banner bots' cyan visor glow
  antenna: "#3a3540",
};

export type Archetype = {
  /** Accent shades this persona's units may wear. */
  accents: string[];
  /** Proportions: pip is short and round, otto tall and boxy. */
  scale: { height: number; width: number; head: number };
};

export const ARCHETYPES: Record<string, Archetype> = {
  pip: {
    accents: ["#ff6a3d", "#ff8a5c", "#e04a2f"],
    scale: { height: 0.94, width: 1.1, head: 1.08 },
  },
  otto: {
    accents: ["#c5371c", "#ff6a3d", "#e0512b"],
    scale: { height: 1.08, width: 0.96, head: 0.98 },
  },
};

export type CharacterConfig = {
  /** The unit's orange - chest badge, ear discs, joints, antenna bobble. */
  accent: string;
  /** Darker rim used behind the accent for depth. */
  accentDark: string;
  /** Whether the ear discs get a headphone band over the dome. */
  band: boolean;
  scale: Archetype["scale"];
  /** Stable per-agent phase for animation offsets. */
  phase: number;
};

/** FNV-1a - tiny deterministic hash for stable per-worker variation. */
export function hash32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function characterConfig(sprite: string, workerId: string): CharacterConfig {
  const arch = ARCHETYPES[sprite] ?? ARCHETYPES.pip;
  const h = hash32(workerId);
  const accent = arch.accents[(h >>> 4) % arch.accents.length];
  return {
    accent,
    accentDark: "#a52d15",
    band: ((h >>> 12) & 3) !== 0, // ~75% wear the headphone band
    scale: arch.scale,
    phase: ((h >>> 22) % 1000) / 159.15, // 0..2π-ish
  };
}
