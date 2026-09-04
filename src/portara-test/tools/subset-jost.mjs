/**
 * Builds public/portara-test/fonts/jost-600.typeface.json: the glyphs the 3D
 * hero's rings need, in the "typeface" JSON that three.js's FontLoader reads,
 * from a Jost SemiBold font file.
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
 * Needs the dev dependency opentype.js.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import opentype from "opentype.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const src = process.argv[2] || path.join(here, "jost-600-lab.ttf");
const out = path.resolve(here, "../../../public/portara-test/fonts/jost-600.typeface.json");

const LETTERS = "PORTALSMCEGN ";

const buf = fs.readFileSync(src);
const font = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));

/* three.js reads each glyph outline as a space-separated command string:
   m x y | l x y | q x y cpx cpy | b x y cp1x cp1y cp2x cp2y
   (end point first, then the control points), in font units, y up. */
function outline(glyph) {
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
const r = (v) => Math.round(v);

const glyphs = {};
const missing = [];
for (const ch of LETTERS) {
  const g = font.charToGlyph(ch);
  if (!g || (g.index === 0 && ch !== " ")) {
    missing.push(ch);
    continue;
  }
  const bb = g.getBoundingBox();
  glyphs[ch] = {
    ha: r(g.advanceWidth),
    x_min: r(bb.x1),
    x_max: r(bb.x2),
    o: outline(g),
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
