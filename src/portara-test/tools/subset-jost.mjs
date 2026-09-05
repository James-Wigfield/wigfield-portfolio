/**
 * Builds public/portara-test/fonts/jost-600.typeface.json: the glyphs the 3D
 * hero's rings and wordmark need, in the "typeface" JSON that three.js's
 * FontLoader reads, from a Jost SemiBold font file.
 *
 *   node src/portara-test/tools/subset-jost.mjs [path/to/Jost-600.ttf]
 *
 * The default source is ./jost-600-lab.ttf beside this script: the Jost
 * SemiBold subset embedded in portara-repo's Logo Lab
 * (apps/control-plane/public/marketing/logo-lab-fonts.json, entry jost-600),
 * decoded from base64. Jost is SIL Open Font Licence. Any Jost 600 TTF, OTF
 * or WOFF works; the full family is on Google Fonts.
 *
 * Only the letters in LETTERS are emitted, so the file stays a few KB. Add to
 * LETTERS and re-run if the words on the rings ever change.
 *
 * OVERLAPS ARE REMOVED. Jost draws a P as two contours laid over each other,
 * a stem and a bowl (R is three, E is four). Extruded as they are, the
 * overlap puts walls INSIDE the letter and a seam across its face, and any
 * outline drawn from the contours shows a line where the bowl meets the
 * stem. So every glyph whose contours share area is rebuilt as one outline:
 * its curves are flattened to CURVE_STEPS chords each (finer than three.js
 * would draw them anyway), the overlapping contours are unioned, and true
 * counters are cut back out. Glyphs without overlaps keep their real curves.
 *
 * Needs the dev dependencies opentype.js and polygon-clipping.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import opentype from "opentype.js";
import polygonClipping from "polygon-clipping";

const here = path.dirname(fileURLToPath(import.meta.url));
const src = process.argv[2] || path.join(here, "jost-600-lab.ttf");
const out = path.resolve(here, "../../../public/portara-test/fonts/jost-600.typeface.json");

const LETTERS = "PORTALSMCEGN ";
const CURVE_STEPS = 16;

const buf = fs.readFileSync(src);
const font = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));

const r = (v) => Math.round(v);
const r1 = (v) => Math.round(v * 10) / 10;

/* three.js reads each glyph outline as a space-separated command string:
   m x y | l x y | q x y cpx cpy | b x y cp1x cp1y cp2x cp2y
   (end point first, then the control points), in font units, y up. */
function curvedOutline(glyph) {
  const parts = [];
  for (const c of glyph.path.commands) {
    if (c.type === "M") parts.push("m", r(c.x), r(c.y));
    else if (c.type === "L") parts.push("l", r(c.x), r(c.y));
    else if (c.type === "Q") parts.push("q", r(c.x), r(c.y), r(c.x1), r(c.y1));
    else if (c.type === "C") parts.push("b", r(c.x), r(c.y), r(c.x1), r(c.y1), r(c.x2), r(c.y2));
    // "Z": three closes each contour itself.
  }
  return parts.join(" ");
}

/* The glyph's contours as flat polygons (arrays of [x, y]). */
function contours(glyph) {
  const rings = [];
  let ring = null;
  let cx = 0;
  let cy = 0;
  for (const c of glyph.path.commands) {
    if (c.type === "M") {
      ring = [[c.x, c.y]];
      rings.push(ring);
    } else if (c.type === "L") {
      ring.push([c.x, c.y]);
    } else if (c.type === "Q") {
      for (let i = 1; i <= CURVE_STEPS; i++) {
        const t = i / CURVE_STEPS;
        const u = 1 - t;
        ring.push([u * u * cx + 2 * u * t * c.x1 + t * t * c.x, u * u * cy + 2 * u * t * c.y1 + t * t * c.y]);
      }
    } else if (c.type === "C") {
      for (let i = 1; i <= CURVE_STEPS; i++) {
        const t = i / CURVE_STEPS;
        const u = 1 - t;
        ring.push([
          u * u * u * cx + 3 * u * u * t * c.x1 + 3 * u * t * t * c.x2 + t * t * t * c.x,
          u * u * u * cy + 3 * u * u * t * c.y1 + 3 * u * t * t * c.y2 + t * t * t * c.y,
        ]);
      }
    }
    if (c.type !== "Z") {
      cx = c.x;
      cy = c.y;
    }
  }
  return rings
    .map((pts) => {
      const a = pts[0];
      const b = pts[pts.length - 1];
      return a[0] === b[0] && a[1] === b[1] ? pts.slice(0, -1) : pts;
    })
    .filter((pts) => pts.length >= 3);
}

function area(ring) {
  let s = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % ring.length];
    s += x1 * y2 - x2 * y1;
  }
  return s / 2;
}

const closed = (ring) => {
  const a = ring[0];
  const b = ring[ring.length - 1];
  return a[0] === b[0] && a[1] === b[1] ? ring.slice(0, -1) : ring;
};

/* Overlap-free outline, or null when the glyph has no overlapping contours.
   Contours wound the same way as the biggest one are solid, the others are
   counters (that is how TrueType tells them apart). Solids that share area
   are the overlaps. */
function unionedOutline(glyph) {
  const rings = contours(glyph);
  if (rings.length < 2) return null;
  const biggest = rings.reduce((a, b) => (Math.abs(area(b)) > Math.abs(area(a)) ? b : a));
  const sign = Math.sign(area(biggest));
  const solids = rings.filter((ring) => Math.sign(area(ring)) === sign);
  const holes = rings.filter((ring) => Math.sign(area(ring)) !== sign);

  let overlap = false;
  for (let i = 0; i < solids.length && !overlap; i++) {
    for (let j = i + 1; j < solids.length && !overlap; j++) {
      const hit = polygonClipping.intersection([solids[i]], [solids[j]]);
      if (hit.some((poly) => Math.abs(area(closed(poly[0]))) > 1)) overlap = true;
    }
  }
  if (!overlap) return null;

  let shape = polygonClipping.union(...solids.map((ring) => [ring]));
  if (holes.length) shape = polygonClipping.difference(shape, ...holes.map((ring) => [ring]));

  const parts = [];
  for (const poly of shape) {
    poly.forEach((raw, k) => {
      let ring = closed(raw);
      // Exterior rings keep the font's own winding, counters the opposite,
      // which is what three.js's shape builder expects of a font.
      const want = k === 0 ? sign : -sign;
      if (Math.sign(area(ring)) !== want) ring = [...ring].reverse();
      ring.forEach(([x, y], i) => parts.push(i === 0 ? "m" : "l", r1(x), r1(y)));
    });
  }
  return { o: parts.join(" "), contours: rings.length, result: shape.length };
}

const glyphs = {};
const missing = [];
const rebuilt = [];
for (const ch of LETTERS) {
  const g = font.charToGlyph(ch);
  if (!g || (g.index === 0 && ch !== " ")) {
    missing.push(ch);
    continue;
  }
  const bb = g.getBoundingBox();
  const flat = ch === " " ? null : unionedOutline(g);
  if (flat) rebuilt.push(`${ch} (${flat.contours} contours -> ${flat.result} shape${flat.result === 1 ? "" : "s"})`);
  glyphs[ch] = {
    ha: r(g.advanceWidth),
    x_min: r(bb.x1),
    x_max: r(bb.x2),
    o: flat ? flat.o : curvedOutline(g),
  };
}
if (missing.length) {
  console.error(`Missing glyphs in ${src}: ${JSON.stringify(missing)}`);
  process.exit(1);
}

const capHeight = font.charToGlyph("P").getBoundingBox().y2;
const json = {
  glyphs,
  familyName: "Jost",
  ascender: r(font.ascender),
  descender: r(font.descender),
  underlinePosition: r(font.tables.post?.underlinePosition ?? -100),
  underlineThickness: r(font.tables.post?.underlineThickness ?? 50),
  boundingBox: {
    xMin: r(font.tables.head.xMin),
    xMax: r(font.tables.head.xMax),
    yMin: r(font.tables.head.yMin),
    yMax: r(font.tables.head.yMax),
  },
  resolution: font.unitsPerEm,
  // Not part of three's format; the hero reads it to size letters by cap height.
  capHeight: r(capHeight),
  original_font_information: { full_font_name: font.names.fullName?.en ?? "Jost SemiBold" },
  cssFontWeight: "600",
  cssFontStyle: "normal",
};

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(json));
console.log(`wrote ${path.relative(process.cwd(), out)} (${fs.statSync(out).size} bytes, ${Object.keys(glyphs).length} glyphs, capHeight ${json.capHeight}/${json.resolution})`);
console.log(rebuilt.length ? `overlaps removed: ${rebuilt.join(", ")}` : "no overlapping contours");
