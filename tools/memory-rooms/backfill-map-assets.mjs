#!/usr/bin/env node
/* backfill-map-assets: give every rendered spot pushed before they existed what the /memories map
   shows it with:
     render/marker  the hero trimmed to its content, 240 px (lib/marker.mjs): the marker it stands as
     model/map      room.glb with 512 px textures, meshopt-compressed (lib/mapModel.mjs): the 3D
                    diorama past zoom 15
   New spots get both from bake.mjs / push.mjs. Until a spot has them, the map shrinks the hero and
   room.glb's textures in the browser (slower, heavier on a phone).

     node tools/memory-rooms/backfill-map-assets.mjs [--dry-run] [--force] [--only <spotId>] [--what marker,map] [--live]

   Reads MEMORIES_API / MEMORIES_PASSWORD like every script here (default: the local Worker).
   Any other Worker needs --live as well, so the live site is only ever written on purpose.
   Both are made from the files as stored (downloaded), not from a local work folder.
   --force remakes ones that already exist. Safe to re-run: a media row is upserted by name. */

import { client, config, supportsMapModel } from './lib/api.mjs';
import { makeMapModel } from './lib/mapModel.mjs';
import { makeMarker } from './lib/marker.mjs';

const args = process.argv.slice(2);
const opt = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const dry = args.includes('--dry-run');
const force = args.includes('--force');
const only = opt('--only', null);
const what = opt('--what', 'marker,map').split(',');
const cfg = config();
const local = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(cfg.base);
if (!local && !args.includes('--live')) {
  console.error(`Refusing to write to ${cfg.base} without --live (it isn't a local Worker).`);
  process.exit(1);
}
const api = client(cfg);
if (what.includes('map') && !(await supportsMapModel(api))) {
  console.error(`${cfg.base} predates model/map (its ping has no models: [..., 'map']): it would store map.glb OVER room.glb. Deploy the Worker first, or pass --what marker.`);
  process.exit(1);
}
const named = (spot, type, name) => spot.media.find((m) => m.type === type && m.name === name) || null;
async function download(media) {
  const res = await fetch(media.url.startsWith('http') ? media.url : `${cfg.base}${media.url}`, { headers: { authorization: `Bearer ${cfg.token}` } });
  if (!res.ok) throw new Error(`${media.type}/${media.name} download → ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}
const kb = (n) => `${(n / 1024).toFixed(0)} KB`;

/** Each asset: what it's made from, how, and where it goes. */
const ASSETS = {
  marker: {
    from: (s) => named(s, 'render', 'hero'),
    target: (s) => named(s, 'render', 'marker'),
    async make(src) {
      const m = await makeMarker(src);
      return { buffer: m.buffer, put: ['render', 'marker', { contentType: 'image/png', width: m.width, height: m.height }], note: `${m.width}×${m.height}, ${kb(m.bytes)}` };
    },
  },
  map: {
    from: (s) => named(s, 'model', 'room'),
    target: (s) => named(s, 'model', 'map'),
    async make(src) {
      const m = await makeMapModel(src);
      return { buffer: m.buffer, put: ['model', 'map', { contentType: 'model/gltf-binary' }], note: `${kb(m.sourceBytes)} → ${kb(m.bytes)}` };
    },
  },
};

const spots = (await api.listSpots()).filter((s) => s.status === 'rendered' && (!only || s.id === only));
if (only && !spots.length) {
  console.error(`No rendered spot ${only} at ${cfg.base}.`);
  process.exit(1);
}
const tally = { made: 0, skipped: 0, failed: 0 };
for (const spot of spots) {
  for (const name of what) {
    const a = ASSETS[name];
    if (!a) throw new Error(`unknown --what ${name} (marker, map)`);
    const label = `${spot.title} · ${name}`;
    const src = a.from(spot);
    if (!src) {
      console.log(`  - ${label}: nothing to make it from, skipped`);
      tally.skipped++;
      continue;
    }
    if (a.target(spot) && !force) {
      console.log(`  = ${label}: already there, skipped`);
      tally.skipped++;
      continue;
    }
    try {
      const out = await a.make(await download(src));
      if (dry) console.log(`  ~ ${label}: would upload ${out.put[0]}/${out.put[1]} (${out.note})`);
      else {
        await api.putMedia(spot.id, out.put[0], out.put[1], out.buffer, out.put[2]);
        console.log(`  ↑ ${label}: ${out.put[0]}/${out.put[1]} (${out.note})`);
      }
      tally.made++;
    } catch (e) {
      console.error(`  ✗ ${label}: ${e.message}`);
      tally.failed++;
    }
  }
}
console.log(`\n${cfg.base}: ${tally.made} ${dry ? 'to make' : 'made'}, ${tally.skipped} skipped, ${tally.failed} failed (${spots.length} rendered spots)`);
process.exit(tally.failed ? 1 : 0);
