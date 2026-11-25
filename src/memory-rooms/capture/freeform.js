/* ============================================================================
   A spot's `capture` (capture.schema.json, CONTRACTS.md 8): how its photos were taken
   (guided corner shots, or FREEFORM old photos in any order) and the hints for placing
   them (a rough room outline, viewpoints). Shared by the phone and the Worker, like
   building/sketch.js: the schema plus the cross-checks a schema can't say.

   Also the small geometry the layout editor, the viewer and the render side agree on:
   a viewpoint's look direction from its yaw (rotY's convention), a photo's horizontal
   field of view from its EXIF (35 mm-equivalent focal length + its orientation).
   ========================================================================== */

import schema from './capture.schema.json' with { type: 'json' };
import { validateAgainst } from '../scene/validate.js';
import { area, isSimple } from '../scene/polygon.js';

export const CAPTURE_SCHEMA = schema;
/** Photos a spot may have (photo + thumb `:n`): the shot guide's 12, or 40 old photos. */
export const MAX_GUIDED_PHOTOS = 12;
export const MAX_FREEFORM_PHOTOS = 40;
/** A freeform spot can be one old photo: a guessed room from one view beats no room (DECISIONS 220). */
export const MIN_FREEFORM_PHOTOS = 1;
/** The phone's main camera when a photo has no EXIF: ≈ 26 mm equivalent → ~69° across the long edge. */
export const DEFAULT_FOCAL35 = 26;

export const isFreeform = (spot) => spot?.capture?.mode === 'freeform';
/** The most photos (and thumbs) this spot may have. */
export const maxPhotosOf = (spot) => (isFreeform(spot) ? MAX_FREEFORM_PHOTOS : MAX_GUIDED_PHOTOS);

/**
 * Schema + cross-checks: caption keys are photo numbers within the mode's limit, viewpoints name each photo at
 * most once, the outline is a simple polygon of at least 0.5 m², every opening fits its edge.
 */
export function validateCapture(capture) {
  const errors = validateAgainst(schema, capture);
  if (errors.length || !capture || typeof capture !== 'object') return { ok: errors.length === 0, errors };
  const max = capture.mode === 'freeform' ? MAX_FREEFORM_PHOTOS : MAX_GUIDED_PHOTOS;
  for (const k of Object.keys(capture.captions || {})) {
    if (!/^[1-9]\d?$/.test(k) || Number(k) > max) errors.push({ path: `/captions/${k}`, message: `is not a photo number 1–${max}` });
  }
  const seen = new Set();
  (capture.views || []).forEach((v, i) => {
    if (v.photo > max) errors.push({ path: `/views/${i}/photo`, message: `photo ${v.photo} is over this mode's ${max}` });
    if (seen.has(v.photo)) errors.push({ path: `/views/${i}/photo`, message: `photo ${v.photo} has two viewpoints` });
    seen.add(v.photo);
  });
  const L = capture.layout;
  if (L?.outline) {
    if (!isSimple(L.outline, 0.05)) errors.push({ path: '/layout/outline', message: 'crosses itself (or has an edge under 5 cm)' });
    else if (area(L.outline) < 0.5) errors.push({ path: '/layout/outline', message: 'is smaller than 0.5 m²' });
  }
  (L?.openings || []).forEach((o, i) => {
    const pts = L.outline || [];
    if (o.edge >= pts.length) {
      errors.push({ path: `/layout/openings/${i}/edge`, message: pts.length ? `there is no edge ${o.edge} (the outline has ${pts.length})` : 'needs an outline' });
      return;
    }
    const len = edgeLength(pts, o.edge);
    if (o.offset + o.width > len + 0.01) errors.push({ path: `/layout/openings/${i}`, message: `runs past the end of edge ${o.edge} (${len.toFixed(2)} m)` });
  });
  return { ok: errors.length === 0, errors };
}

export function edgeLength(pts, i) {
  const a = pts[i];
  const b = pts[(i + 1) % pts.length];
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
}

/** The plan direction a viewpoint looks along, from its yaw (rotY's convention): 0 → +z (south), 90 → +x (east). */
export const lookOf = (yawDeg) => [Math.sin((yawDeg * Math.PI) / 180), Math.cos((yawDeg * Math.PI) / 180)];
/** The yaw (0–360) of a look direction [dx, dz]. */
export function yawOf(dx, dz) {
  const y = (Math.atan2(dx, dz) * 180) / Math.PI;
  return ((y % 360) + 360) % 360;
}

/**
 * A photo's horizontal field of view in degrees (what a viewpoint's wedge spreads), from its EXIF:
 * the 35 mm-equivalent focal length gives the fov across the LONG edge (a 36 mm frame); a portrait photo's
 * horizontal fov is the narrower one. Without EXIF: the phone's main camera (DEFAULT_FOCAL35). known = from EXIF.
 */
export function photoFov(exif, { width, height } = {}) {
  const f35 = Number(exif?.focal35);
  const focal = Number.isFinite(f35) && f35 > 4 && f35 < 400 ? f35 : DEFAULT_FOCAL35;
  const long = 2 * Math.atan(18 / focal); // radians across the long edge (36 mm)
  const w = width || exif?.width;
  const h = height || exif?.height;
  const aspect = w && h ? w / h : 0.75; // phone photos default to portrait
  const horiz = aspect >= 1 ? long : 2 * Math.atan(Math.tan(long / 2) * aspect);
  return { deg: (horiz * 180) / Math.PI, longDeg: (long * 180) / Math.PI, known: focal === f35 };
}

/** An empty freeform capture. */
export const freeformCapture = () => ({ mode: 'freeform' });

/** The capture with empty parts dropped (what the phone sends). null when nothing is left but guided. */
export function tidyCapture(c) {
  if (!c) return null;
  const out = { mode: c.mode === 'freeform' ? 'freeform' : 'guided' };
  const era = typeof c.era === 'string' ? c.era.trim().slice(0, 60) : '';
  if (era) out.era = era;
  const captions = Object.fromEntries(Object.entries(c.captions || {}).map(([k, v]) => [k, String(v || '').trim().slice(0, 120)]).filter(([, v]) => v));
  if (Object.keys(captions).length) out.captions = captions;
  const L = c.layout;
  if (L && (L.outline?.length >= 3 || L.openings?.length)) {
    out.layout = { ...(L.outline?.length >= 3 ? { outline: L.outline.map(([x, z]) => [round(x), round(z)]) } : {}), sizeKnown: Boolean(L.sizeKnown) };
    if (L.outline?.length >= 3 && L.openings?.length) out.layout.openings = L.openings.map((o) => ({ edge: o.edge, offset: round(o.offset), width: round(o.width), type: o.type }));
  }
  if (c.views?.length) out.views = c.views.map((v) => ({ photo: v.photo, x: round(v.x), z: round(v.z), yaw: Math.round(((v.yaw % 360) + 360) % 360 * 10) / 10 % 360, conf: v.conf === 'exact' ? 'exact' : 'rough' }));
  if (out.mode === 'guided' && Object.keys(out).length === 1) return null;
  return out;
}

const round = (v) => Math.round(Number(v) * 1000) / 1000;
