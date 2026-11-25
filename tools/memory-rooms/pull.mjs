#!/usr/bin/env node
/* pull: download a spot into memory-rooms-work/<id>/ and mark it "modelling".

     node tools/memory-rooms/pull.mjs <spotId>
     node tools/memory-rooms/pull.mjs --next            # the oldest spot still "captured"
     node tools/memory-rooms/pull.mjs --list            # what's waiting
   options: --no-status (don't change the status), --force (overwrite a local scene.json)

   Writes:
     spot.json      the row (title, note, kind, place, scale hint, capture time, people …)
     photos/<n>.jpg the 2048 px photos;  thumbs/<n>.jpg
     photos.json    [{ n, file, width, height, aspect, exif? }]  (exif: focal35 / focal / make / model / takenAt /
                    width / height of the ORIGINAL, read on the phone before it was resized; CONTRACTS.md 8)
     capture.json   how the photos were taken: { mode: guided | freeform, era?, layout?, views?, captions?,
                    photos: [{ n, caption?, view?, exif? }] } (a freeform spot's hints for placing its photos)
     contact.jpg    every photo numbered on one sheet, when there are more than 12 (a freeform spot: up to 40)
     scan.spz       if the spot has a Scaniverse scan
     scene.json     the saved scene, if the spot already has one (never overwrites local work without --force)
     layout.md      a template for the modeller's notes (only if missing)
     bespoke/       for kit: "bespoke" scripts
   MEMORIES_API / MEMORIES_PASSWORD come from the env or .dev.vars (see lib/api.mjs). */

import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { client, workDir } from './lib/api.mjs';

const args = process.argv.slice(2);
const api = client();
const flag = (f) => args.includes(f);

if (flag('--list')) {
  const spots = await api.listSpots();
  for (const s of spots) {
    const photos = s.media.filter((m) => m.type === 'photo').length;
    console.log(`${s.status.padEnd(9)} ${s.id}  ${s.kind.padEnd(8)} ${String(photos).padStart(2)} photos  ${s.title}  (${s.placeLabel || 'no place'}, ${s.createdBy})`);
  }
  process.exit(0);
}

let id = args.find((a) => !a.startsWith('--'));
if (flag('--next')) {
  const waiting = (await api.listSpots()).filter((s) => s.status === 'captured').sort((a, b) => String(a.capturedAt).localeCompare(String(b.capturedAt)));
  if (!waiting.length) {
    console.log('Nothing waiting: no spot has status "captured".');
    process.exit(0);
  }
  id = waiting[0].id;
}
if (!id) {
  console.error('usage: node tools/memory-rooms/pull.mjs <spotId> | --next | --list');
  process.exit(2);
}

const spot = await api.getSpot(id);
const dir = workDir(id);
fs.mkdirSync(path.join(dir, 'bespoke'), { recursive: true });

const photos = [];
for (const m of spot.media) {
  if (m.type === 'photo' || m.type === 'thumb') {
    const file = path.join(dir, m.type === 'photo' ? 'photos' : 'thumbs', `${m.name}.jpg`);
    await api.download(m, file);
    if (m.type === 'photo') photos.push({ n: Number(m.name), file: path.relative(dir, file).replace(/\\/g, '/'), width: m.width, height: m.height, aspect: m.width && m.height ? +(m.width / m.height).toFixed(4) : null, ...(m.exif ? { exif: m.exif } : {}) });
  } else if (m.type === 'scan') {
    await api.download(m, path.join(dir, 'scan.spz'));
  }
}
photos.sort((a, b) => a.n - b.n);

const { media: _media, ...row } = spot;
fs.writeFileSync(path.join(dir, 'spot.json'), JSON.stringify(row, null, 2));
fs.writeFileSync(path.join(dir, 'photos.json'), JSON.stringify(photos, null, 2));

// how the photos were taken, and James's hints for placing them (a freeform spot: old photos in any order)
const cap = spot.capture || { mode: 'guided' };
const captureJson = {
  mode: cap.mode || 'guided',
  ...(cap.era ? { era: cap.era } : {}),
  ...(cap.layout ? { layout: cap.layout } : {}),
  ...(cap.views?.length ? { views: cap.views } : {}),
  ...(cap.captions ? { captions: cap.captions } : {}),
  photos: photos.map((p) => ({
    n: p.n,
    ...(cap.captions?.[String(p.n)] ? { caption: cap.captions[String(p.n)] } : {}),
    ...(cap.views?.find((v) => v.photo === p.n) ? { view: cap.views.find((v) => v.photo === p.n) } : {}),
    ...(p.exif ? { exif: p.exif } : {}),
  })),
};
fs.writeFileSync(path.join(dir, 'capture.json'), JSON.stringify(captureJson, null, 2));

// more than the shot guide's 12: one numbered sheet to see them all at once
if (photos.length > 12) {
  const CELL = 300;
  const LABEL = 34;
  const cols = Math.min(8, Math.ceil(Math.sqrt(photos.length * 1.4)));
  const rows = Math.ceil(photos.length / cols);
  const tiles = await Promise.all(
    photos.map(async (p, i) => {
      const img = await sharp(path.join(dir, p.file)).resize(CELL, CELL, { fit: 'contain', background: '#f3f0ea' }).jpeg().toBuffer();
      const caption = captureJson.photos[i].caption ? ` · ${captureJson.photos[i].caption}` : '';
      const label = Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${CELL}" height="${LABEL}"><rect width="100%" height="100%" fill="#1d1c1a"/><text x="10" y="23" font-family="Consolas, monospace" font-size="18" fill="#f3f0ea">${p.n}${caption.replace(/[<&>]/g, '').slice(0, 26)}</text></svg>`,
      );
      return [
        { input: img, left: (i % cols) * CELL, top: Math.floor(i / cols) * (CELL + LABEL) + LABEL },
        { input: label, left: (i % cols) * CELL, top: Math.floor(i / cols) * (CELL + LABEL) },
      ];
    }),
  );
  await sharp({ create: { width: cols * CELL, height: rows * (CELL + LABEL), channels: 3, background: '#f3f0ea' } })
    .composite(tiles.flat())
    .jpeg({ quality: 82 })
    .toFile(path.join(dir, 'contact.jpg'));
}

const scenePath = path.join(dir, 'scene.json');
if (spot.scene && (!fs.existsSync(scenePath) || flag('--force'))) {
  fs.writeFileSync(scenePath, JSON.stringify(spot.scene, null, 2));
}

const layoutPath = path.join(dir, 'layout.md');
if (!fs.existsSync(layoutPath)) {
  fs.writeFileSync(
    layoutPath,
    `# ${spot.title}

${spot.kind} · ${spot.placeLabel || 'no place'} · captured by ${spot.createdBy} · scale hint: ${spot.scaleHint || 'none'}

> ${spot.note}

## Sources
- Photos: ${photos.map((p) => `${p.n} (${p.width}×${p.height})`).join(', ')}
- Capture: ${captureJson.mode}${captureJson.era ? ` · era "${captureJson.era}"` : ''}${captureJson.layout ? ` · outline ${captureJson.layout.outline?.length || 0} corners${captureJson.layout.sizeKnown ? ' (size known)' : ' (proportions only)'}` : ''}${captureJson.views ? ` · ${captureJson.views.length} viewpoints` : ''} (capture.json)
- Floor plan: none yet (drop it in this folder as floorplan.png/.pdf and note its scale here)
${captureJson.mode === 'freeform' ? `
## Freeform: the photos sorted (skill: "Freeform spots")
- Used:
- Reference only:
- Discarded (why: blur, people filling the frame, heavy filter, cropped):
- Frame (from the outline / chosen because):
- Photo groups by the walls and landmarks they see:
- Landmarks seen in 2+ photos:
- Walls no photo shows (generic, marked as guessed):
- Era (what changed between photos, what was kept):
- Compare cameras (6–8):
` : ''}
## Dimensions and how they were derived
- Width (x, west → east):
- Depth (z, north → south):
- Height:
- Anchors used (door 2.03 × 0.81 m, ceiling 2.4–2.7 m, single bed 0.99 × 1.91 m, …):
- Which wall is "north" (the scene's frame, not the compass):

## Openings

## Objects (id · kit · size · which photos show it)

## Cameras (photo → where it was taken from)

## Compare rounds
- Round 1:
- Round 2:
- Round 3:

## Still off after the last round
`,
  );
}

if (!flag('--no-status') && spot.status === 'captured') await api.patchSpot(id, { status: 'modelling' });

console.log(`pulled ${spot.title} (${id})
  → ${dir}
  ${photos.length} photos${fs.existsSync(path.join(dir, 'scan.spz')) ? ' + scan.spz' : ''}${spot.scene ? ` + scene v${spot.sceneVersion}` : ''} · ${captureJson.mode}${photos.length > 12 ? ' · contact.jpg' : ''}
  status: ${flag('--no-status') ? spot.status : spot.status === 'captured' ? 'captured → modelling' : spot.status}
next: node tools/memory-rooms/palette.mjs ${id}`);
