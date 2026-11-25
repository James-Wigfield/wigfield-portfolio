#!/usr/bin/env node
/* The first collection on a Worker's data (CONTRACTS.md 7): "Joe's House", holding 34 Jollytail St (the place;
   its rooms follow it). Everything else is left ungrouped and listed, to be sorted in the UI.

     node tools/memory-rooms/collections-seed.mjs [--base http://127.0.0.1:8788] [--live] [--dry-run]

   Idempotent: the collection's id is fixed, so a re-run finds it instead of making a second one, and the place
   is only PATCHed when it isn't in it yet. Live (anything not on this machine) needs --live, the Worker deployed
   with the collection routes, and supabase/memory_collections.sql run first (ping must list 'collections'). */

import { client, config } from './lib/api.mjs';

const JOES_HOUSE = { id: '0c011ec7-1e5a-4f6e-9a3b-34d011ab1a1e', name: "Joe's House" };
const JOLLYTAIL = 'fa81b29a-0308-4bf3-a9ab-d1a64f1d93de'; // 34 Jollytail St, Witchcliffe

const args = process.argv.slice(2);
const cfg = config();
if (args.includes('--base')) cfg.base = args[args.indexOf('--base') + 1].replace(/\/+$/, '');
const local = /127\.0\.0\.1|localhost/.test(cfg.base);
if (!local && !args.includes('--live')) {
  console.error(`Refusing to write to ${cfg.base} without --live.`);
  process.exit(1);
}
const dry = args.includes('--dry-run');
const api = client(cfg);
console.log(`Worker: ${cfg.base}${dry ? ' (dry run)' : ''}`);

const ping = await api.ping();
if (!(ping.features || []).includes('collections')) {
  console.error('This Worker has no collections yet (ping lists no "collections"): deploy it, and run supabase/memory_collections.sql first.');
  process.exit(1);
}

const collections = await api.listCollections();
let joes = collections.find((c) => c.id === JOES_HOUSE.id) || collections.find((c) => c.name.trim().toLowerCase() === JOES_HOUSE.name.toLowerCase());
if (joes) console.log(`✓ collection "${joes.name}" is there (${joes.id})`);
else if (dry) console.log(`· would create "${JOES_HOUSE.name}"`);
else {
  joes = await api.saveCollection(JOES_HOUSE);
  console.log(`✓ created "${joes.name}" (${joes.id})`);
}

const place = await api.getBuilding(JOLLYTAIL).catch(() => null);
if (!place) console.log(`· 34 Jollytail St (${JOLLYTAIL}) isn't on this Worker: nothing to file`);
else if (joes && place.collectionId === joes.id) console.log(`✓ "${place.title}" is already in "${joes.name}"`);
else if (dry) console.log(`· would move "${place.title}" into "${JOES_HOUSE.name}"`);
else {
  await api.patchBuilding(JOLLYTAIL, { collectionId: joes.id });
  console.log(`✓ moved "${place.title}" into "${joes.name}" (its rooms follow it)`);
}

// what's left to sort by hand
const [spots, places] = await Promise.all([api.listSpots(), api.listBuildings()]);
// (on a dry run the move above didn't happen: count it as done)
const placeColl = new Map(places.map((p) => [p.id, p.id === JOLLYTAIL ? joes?.id || JOES_HOUSE.id : p.collectionId]));
const loosePlaces = places.filter((p) => !placeColl.get(p.id));
const looseSpots = spots.filter((s) => !s.collectionId && !(s.buildingId && placeColl.get(s.buildingId)));
console.log(`\nUngrouped (sort these in the UI: the list's "Edit" / a spot's edit page / a place's page):`);
for (const p of loosePlaces) console.log(`  place  ${p.title}  ${p.placeLabel || ''}  ${p.id}`);
for (const s of looseSpots) console.log(`  spot   ${s.title}  ${s.placeLabel || ''}${s.buildingId ? '  (room of a place)' : ''}  ${s.id}`);
if (!loosePlaces.length && !looseSpots.length) console.log('  nothing');
