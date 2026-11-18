/* The look of the Mapbox maps. Every colour comes from the --mr-map-* tokens in
   memory-rooms.css (light + dark), read off the map's container, so a restyle
   starts in that token block, never here.

   Two candidates (pick one with ?mapstyle=atlas|standard, or localStorage mr:mapstyle):
   - atlas     Mapbox Light (classic, 2D, light on the GPU) repainted layer by layer:
               the muted paper look of the old SVG atlas, mono uppercase country and
               state names, no POIs.
   - standard  Mapbox Standard (the 3D-capable default) tinted through its config:
               richer at street level, heavier on a phone. */

export const STYLES = {
  atlas: 'mapbox://styles/mapbox/light-v11',
  standard: 'mapbox://styles/mapbox/standard',
};
export const DEFAULT_STYLE = 'atlas';

/** The style in use: ?mapstyle= or localStorage mr:mapstyle, else the default. */
export function styleChoice() {
  try {
    const q = new URLSearchParams(window.location.search).get('mapstyle');
    if (q && STYLES[q]) return q;
    const s = localStorage.getItem('mr:mapstyle');
    if (s && STYLES[s]) return s;
  } catch {
    /* storage blocked */
  }
  return DEFAULT_STYLE;
}

const TOKENS = {
  water: '--mr-map-water',
  land: '--mr-map-land',
  park: '--mr-map-park',
  building: '--mr-map-building',
  road: '--mr-map-road',
  roadMajor: '--mr-map-road-major',
  border: '--mr-map-border',
  coast: '--mr-map-coast',
  label: '--mr-map-label',
  labelStrong: '--mr-map-label-strong',
  space: '--mr-map-space',
  glow: '--mr-map-glow',
};

/**
 * The map tokens as resolved under `el` (so light/dark already applied), as rgb()/rgba()
 * strings. The built CSS minifies colours (rgba(…) → #rrggbbaa, which Mapbox can't parse),
 * so each one goes through the browser's own colour parsing first.
 */
export function readTokens(el) {
  const probe = document.createElement('span');
  probe.style.display = 'none';
  el.appendChild(probe);
  const out = {};
  try {
    for (const [k, name] of Object.entries(TOKENS)) {
      probe.style.color = '';
      probe.style.color = `var(${name})`;
      const c = getComputedStyle(probe).color;
      out[k] = c && getComputedStyle(el).getPropertyValue(name).trim() ? c : null;
    }
  } finally {
    probe.remove();
  }
  return out;
}

export const darkScheme = () => {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
  }
};

const MONO = ['Roboto Mono Regular', 'Arial Unicode MS Regular'];
const SETTLEMENTS = ['settlement-major-label', 'settlement-minor-label', 'settlement-subdivision-label'];
const HIDE = ['poi-label', 'airport-label', 'admin-0-boundary-bg', 'admin-1-boundary-bg'];
const MAJOR = ['motorway', 'trunk', 'primary', 'motorway_link', 'trunk_link'];

/* ── atlas: Mapbox Light repainted ─────────────────────────────────────── */

function paintAtlas(map, t, { placeLabelsFrom }) {
  const has = (id) => Boolean(map.getLayer(id));
  const paint = (id, prop, v) => v && has(id) && map.setPaintProperty(id, prop, v);
  const layout = (id, prop, v) => has(id) && map.setLayoutProperty(id, prop, v);

  paint('land', 'background-color', t.land);
  paint('national-park', 'fill-color', t.park);
  paint('landuse', 'fill-color', t.park);
  paint('water', 'fill-color', t.water);
  paint('waterway', 'line-color', t.water);
  paint('land-structure-polygon', 'fill-color', t.land);
  paint('land-structure-line', 'line-color', t.land);
  paint('aeroway-polygon', 'fill-color', t.building);
  paint('aeroway-line', 'line-color', t.road);
  paint('building', 'fill-color', t.building);
  paint('building', 'fill-outline-color', t.road);
  paint('admin-1-boundary', 'line-color', t.border);
  paint('admin-0-boundary', 'line-color', t.coast);
  paint('admin-0-boundary-disputed', 'line-color', t.coast);
  for (const id of HIDE) layout(id, 'visibility', 'none');

  for (const l of map.getStyle().layers) {
    if (l['source-layer'] === 'road' && l.type === 'line') {
      paint(l.id, 'line-color', l.id.includes('case') ? t.land : ['match', ['get', 'class'], MAJOR, t.roadMajor, t.road]);
      // Subways and road tunnels stay faint, so the street grid reads first.
      if (l.id.startsWith('tunnel') || l.id === 'road-rail') paint(l.id, 'line-opacity', 0.45);
    } else if (l.type === 'symbol' && !HIDE.includes(l.id)) {
      const watery = /^(water|waterway)/.test(l.id);
      paint(l.id, 'text-color', t.label);
      paint(l.id, 'text-halo-color', watery ? t.water : t.land);
    }
  }

  paint('settlement-major-label', 'text-color', t.labelStrong);
  paint('country-label', 'text-color', t.labelStrong);
  for (const id of ['country-label', 'state-label', 'continent-label']) {
    layout(id, 'text-font', MONO);
    layout(id, 'text-transform', 'uppercase');
    layout(id, 'text-letter-spacing', 0.12);
  }
  paint('state-label', 'text-opacity', 0.9);

  // Below `placeLabelsFrom` the trip's own place labels (map/PlaceLabels.jsx) take over.
  for (const id of SETTLEMENTS) {
    const l = map.getLayer(id);
    if (l) map.setLayerZoomRange(id, Math.max(l.minzoom ?? 0, placeLabelsFrom), l.maxzoom ?? 24);
  }
}

/* ── standard: Mapbox Standard through its config ──────────────────────── */

const rgba = (c) => (String(c).match(/[\d.]+/g) || []).map(Number);
/** A translucent colour flattened onto `under` (Standard derives road shades by subtracting alpha). */
function opaque(c, under) {
  const [r, g, b, a = 1] = rgba(c);
  const [r0, g0, b0] = rgba(under);
  if (!(a < 1) || r0 === undefined) return c;
  const mix = (x, y) => Math.round(x * a + y * (1 - a));
  return `rgb(${mix(r, r0)}, ${mix(g, g0)}, ${mix(b, b0)})`;
}

/** Standard's basemap config for the current tokens (also passed to the Map constructor). */
export function standardConfig(t, dark) {
  const cfg = {
    // 'night' re-lights everything blue-violet; the dark tokens already make it dark.
    lightPreset: dark ? 'dusk' : 'day',
    theme: 'default',
    colorCommercial: t.park,
    colorEducation: t.park,
    colorMedical: t.park,
    colorIndustrial: t.building,
    show3dObjects: false,
    showPointOfInterestLabels: false,
    showTransitLabels: false,
    showPedestrianRoads: false,
    showLandmarkIcons: false,
    colorLand: t.land,
    colorWater: t.water,
    colorGreenspace: t.park,
    colorBuildings: t.building,
    colorRoads: opaque(t.road, t.land),
    colorTrunks: opaque(t.roadMajor, t.land),
    colorMotorways: opaque(t.roadMajor, t.land),
    colorAdminBoundaries: opaque(t.coast, t.land),
    colorPlaceLabels: t.labelStrong,
    colorRoadLabels: t.label,
  };
  for (const k of Object.keys(cfg)) if (cfg[k] == null) delete cfg[k];
  return cfg;
}

function paintStandard(map, t, { placeLabelsFrom, dark }) {
  for (const [k, v] of Object.entries(standardConfig(t, dark))) map.setConfigProperty('basemap', k, v);
  syncStandardLabels(map, placeLabelsFrom);
}

function syncStandardLabels(map, from) {
  if (!from) return;
  const on = map.getZoom() >= from;
  if (map.__mrPlaceLabels !== on) {
    map.__mrPlaceLabels = on;
    map.setConfigProperty('basemap', 'showPlaceLabels', on);
  }
}

/* ── both ──────────────────────────────────────────────────────────────── */

function fog(map, t) {
  map.setFog({
    range: [-1, 10],
    color: t.glow || t.land,
    'high-color': t.space,
    'space-color': t.space,
    'horizon-blend': 0.08,
    'star-intensity': 0,
  });
}

/**
 * Paints `map` (style already loaded) from the tokens under `el`.
 * opts.placeLabelsFrom: zoom below which the base map's town labels stay hidden (0 = always shown).
 */
export function applyLook(map, option, el, { placeLabelsFrom = 0 } = {}) {
  const t = readTokens(el);
  if (option === 'standard') paintStandard(map, t, { placeLabelsFrom, dark: darkScheme() });
  else paintAtlas(map, t, { placeLabelsFrom });
  fog(map, t);
}

/** Keeps Standard's town labels in step with `placeLabelsFrom` as the zoom changes. */
export function onZoomEnd(map, option, placeLabelsFrom) {
  if (option === 'standard') syncStandardLabels(map, placeLabelsFrom);
}

/** Map constructor options for a style (the Standard config goes in up front, so nothing flashes). */
export function styleOptions(option, el) {
  if (option === 'standard') return { style: STYLES.standard, config: { basemap: standardConfig(readTokens(el), darkScheme()) } };
  return { style: STYLES[option] || STYLES.atlas };
}
