/* The few EXIF facts the render side uses to place an old photo (CONTRACTS.md 8), read from the ORIGINAL file
   before lib/images.js re-draws it through a canvas (which drops every bit of metadata). Hand-rolled and small:
   JPEG (APP1 "Exif") and HEIC / HEIF (the ISO-BMFF `meta` box's Exif item), nothing else.

     await readExif(file) → { focal35?, focal?, make?, model?, takenAt?, orientation? } | null

   focal35 = FocalLengthIn35mmFilm (mm, the field of view as a 35 mm camera's), focal = FocalLength (mm, the
   real lens: with make + model the render side can look the sensor up when focal35 is missing), takenAt =
   DateTimeOriginal as ISO (+ OffsetTimeOriginal when the phone wrote one; else a local time with no zone).
   Never throws: anything it can't read is just missing. */

const HEAD_BYTES = 512 * 1024; // EXIF sits near the start of a JPEG; a HEIC's meta box too

export async function readExif(file) {
  try {
    const head = new DataView(await file.slice(0, Math.min(file.size, HEAD_BYTES)).arrayBuffer());
    if (head.byteLength < 12) return null;
    if (head.getUint16(0) === 0xffd8) return tidy(jpegExif(head));
    if (fourcc(head, 4) === 'ftyp') return tidy(await heicExif(file, head));
    return null;
  } catch {
    return null;
  }
}

function tidy(x) {
  if (!x) return null;
  const out = {};
  for (const [k, v] of Object.entries(x)) if (v !== undefined && v !== null && v !== '' && !(typeof v === 'number' && !Number.isFinite(v))) out[k] = v;
  return Object.keys(out).length ? out : null;
}

const fourcc = (dv, at) => String.fromCharCode(dv.getUint8(at), dv.getUint8(at + 1), dv.getUint8(at + 2), dv.getUint8(at + 3));

/* ── JPEG: walk the markers to APP1 "Exif\0\0", the TIFF header follows ─────── */

function jpegExif(dv) {
  let p = 2;
  while (p + 4 <= dv.byteLength) {
    if (dv.getUint8(p) !== 0xff) return null;
    const marker = dv.getUint8(p + 1);
    if (marker === 0xd9 || marker === 0xda) return null; // end of image / start of scan: no EXIF before the data
    const len = dv.getUint16(p + 2);
    if (marker === 0xe1 && p + 10 <= dv.byteLength && fourcc(dv, p + 4) === 'Exif') return tiff(dv, p + 10, Math.min(dv.byteLength, p + 2 + len));
    p += 2 + len;
  }
  return null;
}

/* ── HEIC: meta → iinf (which item is 'Exif') → iloc (where its bytes are) ──── */

function boxes(dv, start, end) {
  const out = [];
  let p = start;
  while (p + 8 <= end) {
    let size = dv.getUint32(p);
    const type = fourcc(dv, p + 4);
    let head = 8;
    if (size === 1 && p + 16 <= end) {
      size = Number(dv.getBigUint64(p + 8));
      head = 16;
    } else if (size === 0) size = end - p;
    if (size < head || p + size > end + 1e9) break;
    out.push({ type, start: p, body: p + head, end: Math.min(end, p + size) });
    p += size;
  }
  return out;
}

async function heicExif(file, dv) {
  const meta = boxes(dv, 0, dv.byteLength).find((b) => b.type === 'meta');
  if (!meta) return null;
  const inner = boxes(dv, meta.body + 4, meta.end); // meta is a full box: version + flags first
  const iinf = inner.find((b) => b.type === 'iinf');
  const iloc = inner.find((b) => b.type === 'iloc');
  if (!iinf || !iloc) return null;
  // iinf: version, flags, entry count (16 or 32 bit), then infe boxes
  const iv = dv.getUint8(iinf.body);
  let exifId = null;
  for (const infe of boxes(dv, iinf.body + 4 + (iv === 0 ? 2 : 4), iinf.end)) {
    if (infe.type !== 'infe') continue;
    const v = dv.getUint8(infe.body);
    if (v < 2) continue;
    const id = v === 2 ? dv.getUint16(infe.body + 4) : dv.getUint32(infe.body + 4);
    const typeAt = infe.body + 4 + (v === 2 ? 2 : 4) + 2;
    if (fourcc(dv, typeAt) === 'Exif') {
      exifId = id;
      break;
    }
  }
  if (exifId === null) return null;
  // iloc: where that item's bytes are in the file
  let p = iloc.body;
  const v = dv.getUint8(p);
  p += 4;
  const sizes = dv.getUint16(p);
  p += 2;
  const offSize = (sizes >> 12) & 15;
  const lenSize = (sizes >> 8) & 15;
  const baseSize = (sizes >> 4) & 15;
  const idxSize = v === 1 || v === 2 ? sizes & 15 : 0;
  const read = (n) => {
    let x = 0;
    if (n === 4) x = dv.getUint32(p);
    else if (n === 8) x = Number(dv.getBigUint64(p));
    else if (n === 2) x = dv.getUint16(p);
    p += n;
    return x;
  };
  const count = v < 2 ? read(2) : read(4);
  for (let i = 0; i < count; i++) {
    const id = v < 2 ? read(2) : read(4);
    if (v === 1 || v === 2) read(2); // construction method
    read(2); // data reference index
    const base = read(baseSize);
    const extents = read(2);
    let first = null;
    for (let e = 0; e < extents; e++) {
      if (idxSize) read(idxSize);
      const off = read(offSize);
      const len = read(lenSize);
      if (!first) first = { off: base + off, len };
    }
    if (id === exifId && first) {
      const bytes = new DataView(await file.slice(first.off, first.off + Math.min(first.len, 256 * 1024)).arrayBuffer());
      if (bytes.byteLength < 8) return null;
      const tiffAt = 4 + bytes.getUint32(0); // exif_tiff_header_offset
      return tiff(bytes, tiffAt, bytes.byteLength);
    }
  }
  return null;
}

/* ── TIFF: IFD0 (make, model, orientation, → Exif IFD) and the Exif IFD ───── */

function tiff(dv, t, end) {
  if (t + 8 > end) return null;
  const order = dv.getUint16(t);
  const le = order === 0x4949;
  if (!le && order !== 0x4d4d) return null;
  const u16 = (o) => dv.getUint16(t + o, le);
  const u32 = (o) => dv.getUint32(t + o, le);
  if (u16(2) !== 42) return null;
  const SIZE = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 };
  const value = (entry) => {
    const type = u16(entry + 2);
    const count = u32(entry + 4);
    const bytes = (SIZE[type] || 1) * count;
    const at = bytes <= 4 ? entry + 8 : u32(entry + 8);
    if (t + at + bytes > end) return undefined;
    if (type === 2) {
      let s = '';
      for (let i = 0; i < count; i++) {
        const c = dv.getUint8(t + at + i);
        if (!c) break;
        s += String.fromCharCode(c);
      }
      return s.trim();
    }
    if (type === 3) return u16(at);
    if (type === 4) return u32(at);
    if (type === 5) return u32(at + 4) ? u32(at) / u32(at + 4) : undefined;
    if (type === 10) return dv.getInt32(t + at + 4, le) ? dv.getInt32(t + at, le) / dv.getInt32(t + at + 4, le) : undefined;
    return undefined;
  };
  const ifd = (o) => {
    const tags = new Map();
    if (!o || t + o + 2 > end) return tags;
    const n = u16(o);
    for (let i = 0; i < n && t + o + 2 + i * 12 + 12 <= end; i++) {
      const entry = o + 2 + i * 12;
      tags.set(u16(entry), entry);
    }
    return tags;
  };
  const get = (tags, tag) => (tags.has(tag) ? value(tags.get(tag)) : undefined);
  const zero = ifd(u32(4));
  const exifAt = get(zero, 0x8769);
  const exif = exifAt ? ifd(exifAt) : new Map();
  const when = get(exif, 0x9003);
  const zone = get(exif, 0x9011);
  const m = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/.exec(when || '');
  const focal = get(exif, 0x920a);
  const focal35 = get(exif, 0xa405);
  return {
    make: get(zero, 0x010f),
    model: get(zero, 0x0110),
    orientation: get(zero, 0x0112),
    focal: Number.isFinite(focal) ? Math.round(focal * 100) / 100 : undefined,
    focal35: Number.isFinite(focal35) && focal35 > 0 ? focal35 : undefined,
    takenAt: m ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}${/^[+-]\d{2}:\d{2}$/.test(zone || '') ? zone : ''}` : undefined,
  };
}
