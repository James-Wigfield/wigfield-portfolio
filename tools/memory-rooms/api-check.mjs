#!/usr/bin/env node
/* Exercises every /api/memories route against a running Worker.

     npx wrangler dev --port 8788         (in another terminal; MEMORIES_ROW_STORE=local)
     node tools/memory-rooms/api-check.mjs [--base http://127.0.0.1:8788]

   Creates one throwaway spot ("api-check …"), checks create-once idempotency, edits
   (PATCH checks, ifUpdatedAt → 409, a re-POST never undoing an edit), media
   upload + signed links, scene validation + versioning, soft delete + restore,
   then soft-deletes it again. Then a whole place: a building (create once, sketch,
   409, building.json validation + version, its files, a spot as one of its rooms,
   a v2 room scene, soft delete). `--no-buildings` (or PGREST_NO_BUILDINGS=1) checks
   instead that spots still save where the building SQL hasn't run. Then collections
   (CONTRACTS.md 7): create once, rename, 409, bounds, a spot and a place in one, a
   delete that leaves them ungrouped, a share link that never shows it; with
   `--no-collections` (or PGREST_NO_COLLECTIONS=1) that spots still save before
   supabase/memory_collections.sql has run. Then freeform spots (CONTRACTS.md 8): a
   capture validated on POST and PATCH (409 on a stale edit), photos 13–40 only on a
   freeform spot (guided stays 1–12), a photo's EXIF on its media row (a garbled
   header just leaves it off); `--no-freeform` (or PGREST_NO_FREEFORM=1) that guided
   spots and their photos still save before supabase/memory_freeform.sql has run.
   Exits 1 on the first failure. */

import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { client, config, REPO } from './lib/api.mjs';

const args = process.argv.slice(2);
const baseArg = args.includes('--base') ? args[args.indexOf('--base') + 1] : null;
const cfg = config();
if (baseArg) cfg.base = baseArg.replace(/\/+$/, '');
const api = client(cfg);

let passed = 0;
function ok(cond, label, extra = '') {
  if (!cond) {
    console.error(`✗ ${label} ${extra}`);
    process.exit(1);
  }
  passed++;
  console.log(`✓ ${label}`);
}
async function expectStatus(promise, status, label) {
  try {
    await promise;
    ok(false, label, '(expected an error)');
  } catch (e) {
    ok(e.status === status, label, `(got ${e.status}: ${e.message})`);
    return e;
  }
}
const raw = (p, init = {}) => fetch(`${cfg.base}${p}`, init);

// ── auth ─────────────────────────────────────────────────────────────────────
ok((await raw('/api/memories/ping')).status === 401, 'ping without a token is 401');
ok((await raw('/api/memories/ping', { headers: { authorization: 'Bearer nope' } })).status === 401, 'ping with a wrong token is 401');
const ping = await api.ping();
ok(ping.ok === true, `ping with the password works (row store: ${ping.rowStore})`);
ok(Array.isArray(ping.models) && ping.models.includes('map'), 'ping says model/map is stored apart from room.glb');

// ── create (idempotent) ──────────────────────────────────────────────────────
const id = crypto.randomUUID();
const capture = {
  id,
  createdBy: 'james',
  kind: 'interior',
  title: `api-check ${new Date().toISOString().slice(0, 19)}`,
  note: 'Throwaway spot made by tools/memory-rooms/api-check.mjs',
  lat: 40.7128,
  lng: -74.006,
  locAccuracyM: 25,
  locSource: 'gps',
  placeLabel: 'New York, NY',
  scaleHint: 'small room',
  capturedAt: new Date().toISOString(),
};
const bad = await expectStatus(api.saveSpot({ ...capture, id: 'nope', createdBy: 'bob' }), 400, 'a bad spot is rejected with 400');
ok(Array.isArray(bad.details) && bad.details.length >= 2, 'the 400 lists every problem');
const created = await api.saveSpot(capture);
ok(created.id === id && created.status === 'captured' && created.sceneVersion === 0, 'POST creates the spot as captured');
await api.patchSpot(id, { status: 'modelling' });
const retried = await api.saveSpot(capture);
ok(retried.id === id && retried.status === 'modelling', 'a retried POST upserts and keeps the status');
const list1 = await api.listSpots();
ok(list1.filter((s) => s.id === id).length === 1, 'the list holds exactly one copy');

// ── edit (the spot page's edit form: PATCH, ifUpdatedAt) ─────────────────────
const fix = { title: `${capture.title} (edited)`, lat: -31.95, lng: 115.86, locAccuracyM: null, locSource: 'pin', placeLabel: 'Perth, WA', capturedAt: '2026-12-21T03:15:00.000Z', createdBy: 'justin' };
const edited = await api.patchSpot(id, fix);
ok(
  edited.title === fix.title && edited.lat === fix.lat && edited.lng === fix.lng && edited.locAccuracyM === null && edited.locSource === 'pin' &&
    edited.placeLabel === 'Perth, WA' && Date.parse(edited.capturedAt) === Date.parse(fix.capturedAt) && edited.createdBy === 'justin',
  'PATCH saves the place, locSource, capturedAt and createdBy',
);
const resent = await api.saveSpot(capture);
ok(resent.title === fix.title && resent.lat === fix.lat && resent.placeLabel === 'Perth, WA' && resent.createdBy === 'justin', 'a late re-POST of the capture (outbox retry) does not undo the edit');
const latOnly = await expectStatus(api.patchSpot(id, { lat: 10 }), 400, 'lat without lng is 400');
ok(latOnly.details?.some((d) => /^lat\b/.test(d)), 'the problem names its field first', latOnly.details?.join('; '));
await expectStatus(api.patchSpot(id, { lng: 10 }), 400, 'lng without lat is 400');
await expectStatus(api.patchSpot(id, { lat: 91, lng: 0 }), 400, 'lat out of range is 400');
await expectStatus(api.patchSpot(id, { lat: 0, lng: -181 }), 400, 'lng out of range is 400');
await expectStatus(api.patchSpot(id, { lat: 'north', lng: 5 }), 400, 'a lat that is not a number is 400');
await expectStatus(api.patchSpot(id, { lat: null, lng: 5 }), 400, 'a null lat with a lng is 400');
await expectStatus(api.patchSpot(id, { createdBy: 'bob' }), 400, 'a bad createdBy is 400');
await expectStatus(api.patchSpot(id, { capturedAt: 'yesterday' }), 400, 'a capturedAt that is not a date is 400');
await expectStatus(api.patchSpot(id, { capturedAt: '2026-02-30T10:00:00Z' }), 400, 'a capturedAt on a day that does not exist is 400');
await expectStatus(api.patchSpot(id, { capturedAt: '2026-12-21' }), 400, 'a capturedAt without a time and zone is 400');
await expectStatus(api.patchSpot(id, { locSource: 'satellite' }), 400, 'a bad locSource is 400');
const many = await expectStatus(api.patchSpot(id, { title: 'never saved', lat: 95, lng: 0, createdBy: 'bob' }), 400, 'a PATCH with a bad field is refused whole');
ok(many.details?.length >= 2, 'the 400 lists every problem', many.details?.join('; '));
const afterBad = await api.getSpot(id);
ok(afterBad.title === fix.title && afterBad.lat === fix.lat && afterBad.createdBy === 'justin', 'a refused PATCH changes nothing');
const flipped = await api.patchSpot(id, { kind: 'exterior' });
ok(flipped.kind === 'exterior' && (await api.patchSpot(id, { kind: 'interior' })).kind === 'interior', 'kind can change while there is no scene');

const opened = await api.getSpot(id);
const first = await api.patchSpot(id, { note: 'saved with ifUpdatedAt', ifUpdatedAt: opened.updatedAt });
ok(first.note === 'saved with ifUpdatedAt', 'a PATCH with the current ifUpdatedAt saves');
const stale = await expectStatus(api.patchSpot(id, { title: 'stale edit', ifUpdatedAt: opened.updatedAt }), 409, 'a stale ifUpdatedAt is 409');
ok(/changed/i.test(stale.message), 'the 409 says the spot changed', stale.message);
ok((await api.getSpot(id)).title === fix.title, 'the 409 saved nothing');
const chained = await api.patchSpot(id, { title: fix.title, ifUpdatedAt: first.updatedAt });
ok(chained.title === fix.title, 'the updatedAt a PATCH returns works as the next ifUpdatedAt');
const scriptStyle = await api.patchSpot(id, { status: 'modelling' });
ok(scriptStyle.status === 'modelling', 'a PATCH without ifUpdatedAt (the scripts) is never refused for staleness');
const cleared = await api.patchSpot(id, { lat: null, lng: null, locSource: null });
ok(cleared.lat === null && cleared.lng === null && cleared.locSource === null, 'lat + lng null clears the location');

// ── media ────────────────────────────────────────────────────────────────────
const jpeg = await sharp({ create: { width: 64, height: 48, channels: 3, background: '#a7774f' } }).jpeg({ quality: 85 }).toBuffer();
const m1 = await api.putMedia(id, 'photo', 1, jpeg, { contentType: 'image/jpeg', width: 64, height: 48 });
ok(m1.r2Key === `spots/${id}/photos/1.jpg` && m1.bytes === jpeg.length && m1.width === 64, 'photo 1 uploads to its R2 key');
const m1b = await api.putMedia(id, 'photo', 1, jpeg, { contentType: 'image/jpeg', width: 64, height: 48 });
ok(m1b.id === m1.id, 're-uploading photo 1 reuses the same media row id');
await api.putMedia(id, 'thumb', 1, jpeg, { contentType: 'image/jpeg', width: 64, height: 48 });
await expectStatus(api.putMedia(id, 'photo', 13, jpeg, { contentType: 'image/jpeg' }), 400, 'photo 13 is rejected');
await expectStatus(api.putMedia(id, 'photo', 2, jpeg, { contentType: 'image/png' }), 415, 'a photo must be a JPEG');
await expectStatus(api.putMedia(id, 'sticker', 1, jpeg, { contentType: 'image/jpeg' }), 400, 'unknown media types are rejected');
await expectStatus(api.putMedia(crypto.randomUUID(), 'photo', 1, jpeg, { contentType: 'image/jpeg' }), 404, 'media for a missing spot is 404');

const spot = await api.getSpot(id);
const photo = spot.media.find((m) => m.type === 'photo' && m.name === '1');
ok(photo && /\?t=\d+\.[\w-]+$/.test(photo.url), 'GET spot returns media with a signed url');
const signed = await raw(photo.url);
const signedBytes = Buffer.from(await signed.arrayBuffer());
ok(signed.status === 200 && signedBytes.equals(jpeg) && signed.headers.get('content-type') === 'image/jpeg', 'the signed url serves the exact bytes without a bearer');
const etag = signed.headers.get('etag');
ok((await raw(photo.url, { headers: { 'if-none-match': etag } })).status === 304, 'If-None-Match gives 304');
ok((await raw(photo.url.replace(/\.[\w-]+$/, '.AAAA'))).status === 403, 'a tampered signature is 403');
ok((await raw(photo.url.split('?')[0])).status === 401, 'no token and no bearer is 401');
ok((await raw(photo.url.split('?')[0], { headers: { authorization: `Bearer ${cfg.token}` } })).status === 200, 'the bearer also opens files');
ok((await raw('/api/memories/file/rows/spots/x.json', { headers: { authorization: `Bearer ${cfg.token}` } })).status === 400, 'row objects are not reachable as files');

const glbPath = path.join(REPO, 'memory-rooms-work', '_fixtures', 'bedroom', 'fixture-boxes.glb');
if (fs.existsSync(glbPath)) {
  const glb = fs.readFileSync(glbPath);
  const mm = await api.putMedia(id, 'model', 'room', glb, { contentType: 'model/gltf-binary' });
  ok(mm.r2Key === `spots/${id}/model/room.glb` && mm.bytes === glb.length, 'a GLB uploads as model/room.glb');
  const mp = await api.putMedia(id, 'model', 'map', glb.subarray(0, 1024), { contentType: 'model/gltf-binary' });
  const both = (await api.getSpot(id)).media.filter((m) => m.type === 'model');
  ok(
    mp.r2Key === `spots/${id}/model/map.glb` && mp.name === 'map' && both.length === 2 && both.some((m) => m.name === 'room' && m.bytes === glb.length),
    'the map copy uploads as model/map.glb beside room.glb',
  );
  const png = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#fff' } }).png().toBuffer();
  const r = await api.putMedia(id, 'render', 'hero', png, { contentType: 'image/png' });
  ok(r.r2Key === `spots/${id}/renders/hero.png`, 'a render uploads under renders/<name>.png');
}

// ── scene ────────────────────────────────────────────────────────────────────
const scene = JSON.parse(fs.readFileSync(path.join(REPO, 'tools/memory-rooms/examples/bedroom.scene.json'), 'utf8'));
const badScene = { ...scene, objects: [{ ...scene.objects[0], kit: 'hammock' }] };
const se = await expectStatus(api.patchSpot(id, { scene: badScene }), 400, 'an invalid scene is rejected');
ok(se.details?.some((d) => d.path === '/objects/0/kit'), 'the error points at /objects/0/kit');
const v1 = await api.patchSpot(id, { scene });
ok(v1.sceneVersion === 1 && v1.frameGroup === 'example-flat', 'a valid scene saves as version 1 and sets frameGroup');
const v2 = await api.patchSpot(id, { scene, status: 'rendered' });
ok(v2.sceneVersion === 2 && v2.status === 'rendered', 'the next scene write bumps to version 2');
await expectStatus(api.patchSpot(id, { status: 'done' }), 400, 'an unknown status is rejected');
const kindLock = await expectStatus(api.patchSpot(id, { kind: 'exterior' }), 400, 'a kind change on a spot with a scene is 400');
ok(kindLock.details?.some((d) => /^kind\b/.test(d)), 'the kind refusal names kind', kindLock.details?.join('; '));
const sameKind = await api.patchSpot(id, { kind: 'interior', scaleHint: 'big room' });
ok(sameKind.kind === 'interior' && sameKind.scaleHint === 'big room' && sameKind.sceneVersion === 2, 'the same kind (no change) still saves, and leaves the scene alone');

// ── soft delete ──────────────────────────────────────────────────────────────
await api.deleteSpot(id);
ok(!(await api.listSpots()).some((s) => s.id === id), 'a deleted spot leaves the list');
ok((await api.listSpots({ deleted: true })).some((s) => s.id === id && s.deletedAt), '?deleted=1 still shows it');
await api.restoreSpot(id);
ok((await api.listSpots()).some((s) => s.id === id), 'restore brings it back');

// ── walk in together (ticket + presence + the socket's door; the room itself: walk-mp-check.mjs) ──
const auth = { authorization: `Bearer ${cfg.token}`, 'content-type': 'application/json' };
const walkPost = (sid, body, headers = auth) => raw(`/api/memories/spots/${sid}/walk`, { method: 'POST', headers, body: JSON.stringify(body) });
ok((await walkPost(id, { who: 'james' }, { 'content-type': 'application/json' })).status === 401, 'a walk ticket without the password is 401');
ok((await walkPost(id, { who: 'bob' })).status === 400, 'a walk ticket for someone who is not James or Justin is 400');
ok((await walkPost('00000000-0000-4000-8000-000000000000', { who: 'james' })).status === 404, 'a walk ticket for a spot that does not exist is 404');
const ticketRes = await walkPost(id, { who: 'justin' });
const ticket = (await ticketRes.json()).data;
ok(ticketRes.status === 200 && /^[0-9a-f-]{36}\.justin\.\d+\.[\w-]+$/.test(ticket?.ticket || '') && ticket.socket?.startsWith('/api/memories/walk/ws?t='), 'a walk ticket: <spot>.<who>.<exp>.<sig> and its socket path', JSON.stringify(ticket));
ok(Date.parse(ticket.expiresAt) - Date.now() <= 121000 && Date.parse(ticket.expiresAt) > Date.now(), 'the ticket expires within 2 minutes');
const presence = await raw(`/api/memories/spots/${id}/walk`, { headers: auth });
const presenceBody = await presence.json();
ok(presence.status === 200 && Array.isArray(presenceBody.data?.people), 'presence answers { people: [] }', JSON.stringify(presenceBody));
ok((await raw(`/api/memories/spots/${id}/walk`)).status === 401, 'presence without the password is 401');
ok((await raw('/api/memories/walk/ws')).status === 401, 'the walk socket without a ticket is 401');
ok((await raw('/api/memories/walk/ws?t=nope')).status === 403, 'the walk socket with a bad ticket is 403');
const [tSpot, tWho, tExp, tSig] = ticket.ticket.split('.');
ok((await raw(`/api/memories/walk/ws?t=${encodeURIComponent(`${tSpot}.james.${tExp}.${tSig}`)}`)).status === 403, 'a ticket with its person swapped is 403');
ok((await raw(`/api/memories/walk/ws?t=${encodeURIComponent(`${tSpot}.${tWho}.${Number(tExp) + 600}.${tSig}`)}`)).status === 403, 'a ticket with its expiry pushed back is 403');
ok((await raw(ticket.socket)).status === 426, 'a good ticket without a WebSocket upgrade is 426');

// ── whole places: buildings (CONTRACTS.md 6.4) + a spot as one of its rooms ──
const noBuildings = process.env.PGREST_NO_BUILDINGS === '1' || args.includes('--no-buildings');
if (noBuildings) {
  // a Supabase project where memory_buildings.sql hasn't run: spots must still save, unlinked
  const lone = await api.patchSpot(id, { title: `${capture.title} (no buildings)` });
  ok(lone.title.endsWith('(no buildings)'), 'without the building tables, a plain spot still saves');
  ok(Array.isArray(ping.features) && !ping.features.includes('buildings'), 'ping does not claim the buildings feature', JSON.stringify(ping.features));
  // what the phone's outbox needs to HOLD these (not stall every upload behind them): 503 + code needs-sql
  const auth = { authorization: `Bearer ${cfg.token}`, 'content-type': 'application/json' };
  const place = { id: crypto.randomUUID(), createdBy: 'james', title: 'api-check place (no SQL)', capturedAt: '2026-12-18T09:00:00.000Z' };
  const rb = await raw('/api/memories/buildings', { method: 'POST', headers: auth, body: JSON.stringify(place) });
  const jb = await rb.json().catch(() => ({}));
  ok(rb.status === 503 && jb.code === 'needs-sql', 'a place before the SQL is 503 needs-sql (held on the phone)', `${rb.status} ${JSON.stringify(jb)}`);
  const room = { ...capture, id: crypto.randomUUID(), title: 'api-check room (no SQL)', buildingId: place.id, roomId: 'kitchen' };
  const rs = await raw('/api/memories/spots', { method: 'POST', headers: auth, body: JSON.stringify(room) });
  const js = await rs.json().catch(() => ({}));
  ok(rs.status === 503 && js.code === 'needs-sql', "a room of a place before the SQL is 503 needs-sql", `${rs.status} ${JSON.stringify(js)}`);
  const lone2 = { ...capture, id: crypto.randomUUID(), title: 'api-check plain spot after a held room' };
  const saved2 = await api.saveSpot(lone2);
  ok(saved2.id === lone2.id, 'and a plain spot right after it still saves');
  await api.deleteSpot(lone2.id).catch(() => {});
} else {
  ok(Array.isArray(ping.features) && ping.features.includes('buildings'), 'ping lists the buildings feature');
  await expectStatus(api.saveSpot({ ...capture, id: crypto.randomUUID(), title: 'api-check bad room', roomId: 'kitchen' }), 400, 'a roomId without a buildingId is refused on create');
  const bid = crypto.randomUUID();
  const place = {
    id: bid,
    createdBy: 'justin',
    title: `api-check place ${new Date().toISOString().slice(0, 19)}`,
    note: 'Throwaway building made by api-check.mjs',
    lat: 40.6782,
    lng: -73.9442,
    placeLabel: 'Brooklyn, NY',
    locSource: 'typed',
    capturedAt: '2026-12-18T09:00:00.000Z',
    sketch: { version: 1, levels: [{ id: 'ground', name: 'Ground' }], rooms: [{ id: 'kitchen', name: 'Kitchen', level: 'ground', rect: [0, 0, 4, 3] }] },
  };
  const b1 = await api.saveBuilding(place);
  ok(b1.id === bid && b1.status === 'captured' && b1.planVersion === 0 && b1.sketch?.rooms?.length === 1, 'POST /buildings creates a place with its sketch');
  const b1again = await api.saveBuilding({ ...place, title: 'changed by a retry' });
  ok(b1again.title === place.title, 'a re-POST of the same place changes nothing (create once)');
  await expectStatus(api.saveBuilding({ ...place, id: crypto.randomUUID(), sketch: { version: 1, levels: [], rooms: [] } }), 400, 'a sketch with no levels is 400');
  await expectStatus(api.saveBuilding({ ...place, id: 'nope' }), 400, 'a building id that is not a uuid is 400');
  ok((await api.listBuildings()).some((b) => b.id === bid), 'GET /buildings lists it');
  const got = await api.getBuilding(bid);
  ok(got.placeLabel === 'Brooklyn, NY' && got.lat === 40.6782, 'GET /buildings/:id returns it');
  await expectStatus(api.getBuilding('00000000-0000-4000-8000-000000000000'), 404, 'a building that does not exist is 404');

  // the sketch grows on the phone (PATCH), a stale form gets 409
  const sketch2 = { ...place.sketch, rooms: [...place.sketch.rooms, { id: 'bed-1', name: 'Bed 1', level: 'ground', rect: [4, 0, 3, 3] }] };
  const b2 = await api.patchBuilding(bid, { sketch: sketch2, ifUpdatedAt: got.updatedAt });
  ok(b2.sketch.rooms.length === 2, 'PATCH sketch adds a room');
  await expectStatus(api.patchBuilding(bid, { title: 'stale', ifUpdatedAt: got.updatedAt }), 409, 'PATCH with an old ifUpdatedAt is 409');
  const overlap = { ...sketch2, rooms: [...sketch2.rooms, { id: 'hall', name: 'Hall', level: 'ground', rect: [1, 1, 2, 2] }] };
  const bad = await expectStatus(api.patchBuilding(bid, { sketch: overlap }), 400, 'an overlapping sketch room is 400');
  ok((bad.details || []).some((d) => d.startsWith('sketch/rooms/2/rect')), 'its details name the field', JSON.stringify(bad.details));

  // the render side's building.json: validated, versioned
  const plan = JSON.parse(fs.readFileSync(path.join(REPO, 'tools/memory-rooms/examples/house.building.json'), 'utf8'));
  const b3 = await api.patchBuilding(bid, { plan, status: 'modelling' });
  ok(b3.planVersion === 1 && b3.plan?.rooms?.length === plan.rooms.length && b3.status === 'modelling', 'PATCH plan stores building.json, planVersion 1');
  const broken = JSON.parse(JSON.stringify(plan));
  broken.levels[0].walls.push({ id: 'dup', a: 'a1', b: 'a2' });
  const e2 = await expectStatus(api.patchBuilding(bid, { plan: broken }), 400, 'an invalid building.json is 400');
  ok((e2.details || []).some((d) => d.path === '/levels/0/walls/20'), 'its details carry the validator paths', JSON.stringify(e2.details?.slice(0, 2)));
  ok((await api.getBuilding(bid)).planVersion === 1, 'a refused plan leaves the version alone');

  // files: a floor-plan photo, an outside shot, a level model; bad names refused
  const jpeg = await sharp({ create: { width: 64, height: 48, channels: 3, background: '#a08060' } }).jpeg().toBuffer();
  const planPhoto = await api.putBuildingMedia(bid, 'plan', '1', jpeg, { contentType: 'image/jpeg', width: 64, height: 48 });
  ok(planPhoto.r2Key === `buildings/${bid}/plan/1.jpg` && planPhoto.buildingId === bid, 'PUT plan/1 stores the floor-plan photo', planPhoto.r2Key);
  const outside = await api.putBuildingMedia(bid, 'photo', '2', jpeg, { contentType: 'image/jpeg' });
  ok(outside.r2Key === `buildings/${bid}/photos/2.jpg`, 'PUT photo/2 stores an outside shot');
  const glb = await api.putBuildingMedia(bid, 'model', 'level-ground', Buffer.from('glTF fake'), { contentType: 'model/gltf-binary' });
  ok(glb.r2Key === `buildings/${bid}/model/level-ground.glb`, 'PUT model/level-ground stores a level GLB');
  await expectStatus(api.putBuildingMedia(bid, 'plan', '5', jpeg, { contentType: 'image/jpeg' }), 400, 'a fifth floor-plan photo is 400');
  await expectStatus(api.putBuildingMedia(bid, 'model', 'room', Buffer.from('x'), { contentType: 'model/gltf-binary' }), 400, 'a building model named "room" is 400');
  await expectStatus(api.putBuildingMedia(bid, 'plan', '1', Buffer.from('png'), { contentType: 'image/png' }), 415, 'a PNG floor plan is 415');
  const withMedia = await api.getBuilding(bid);
  ok(withMedia.media.length === 3 && withMedia.media.every((m) => m.url.includes('?t=')), 'GET returns its 3 files with signed links');
  const file = await raw(withMedia.media.find((m) => m.type === 'plan').url);
  ok(file.status === 200 && (await file.arrayBuffer()).byteLength === jpeg.length, 'a building file downloads through its signed link');

  // a spot as one of its rooms
  const room = await api.patchSpot(id, { buildingId: bid, roomId: 'kitchen' });
  ok(room.buildingId === bid && room.roomId === 'kitchen', 'PATCH a spot into a building room');
  await expectStatus(api.patchSpot(id, { roomId: 'Not An Id' }), 400, 'a room id that is not an id is 400');
  await expectStatus(api.patchSpot(id, { buildingId: null }), 400, 'a room without a building is 400');
  const roomSpotId = crypto.randomUUID();
  const roomSpot = await api.saveSpot({ ...capture, id: roomSpotId, title: 'api-check room of a place', buildingId: bid, roomId: 'bed-1' });
  ok(roomSpot.buildingId === bid && roomSpot.roomId === 'bed-1', 'POST a spot straight into a building room (capture of a whole place)');
  const v2scene = JSON.parse(fs.readFileSync(path.join(REPO, 'tools/memory-rooms/examples/house-living.v2.scene.json'), 'utf8'));
  v2scene.shell.building = bid;
  const withScene = await api.patchSpot(roomSpotId, { scene: v2scene });
  ok(withScene.roomId === 'living' && withScene.buildingId === bid && withScene.sceneVersion === 1, "a v2 room scene moves its spot to the scene's room");
  const unlinked = await api.patchSpot(id, { buildingId: null, roomId: null });
  ok(unlinked.buildingId === null && unlinked.roomId === null, 'a spot can leave its building');
  await api.deleteSpot(roomSpotId);

  // soft delete + restore
  await api.deleteBuilding(bid);
  ok(!(await api.listBuildings()).some((b) => b.id === bid), 'a deleted building leaves the list');
  ok((await api.listBuildings({ deleted: true })).some((b) => b.id === bid && b.deletedAt), '?deleted=1 still shows it');
  await api.restoreBuilding(bid);
  ok((await api.listBuildings()).some((b) => b.id === bid), 'restore brings the building back');
  await api.deleteBuilding(bid);
}

/** A fresh plain capture (a new id each time). */
function captureSpot() {
  return { ...capture, id: crypto.randomUUID(), title: `api-check ${Date.now().toString(36)}` };
}

// ── collections (CONTRACTS.md 7) ─────────────────────────────────────────────
const noCollections = noBuildings || process.env.PGREST_NO_COLLECTIONS === '1' || args.includes('--no-collections');
{
  const auth = { authorization: `Bearer ${cfg.token}`, 'content-type': 'application/json' };
  if (noCollections) {
    ok(Array.isArray(ping.features) && !ping.features.includes('collections'), 'ping does not claim collections before the SQL', JSON.stringify(ping.features));
    const rl = await raw('/api/memories/collections', { headers: auth });
    const jl = await rl.json().catch(() => ({}));
    ok(rl.status === 503 && jl.code === 'needs-sql', 'the collection list before the SQL is 503 needs-sql', `${rl.status} ${JSON.stringify(jl)}`);
    const grouped = { ...capture, id: crypto.randomUUID(), title: 'api-check grouped (no SQL)', collectionId: crypto.randomUUID() };
    const rg = await raw('/api/memories/spots', { method: 'POST', headers: auth, body: JSON.stringify(grouped) });
    const jg = await rg.json().catch(() => ({}));
    ok(rg.status === 503 && jg.code === 'needs-sql', 'a spot with a collection before the SQL is 503 needs-sql (held on the phone)', `${rg.status} ${JSON.stringify(jg)}`);
    const plain = await api.saveSpot({ ...capture, id: crypto.randomUUID(), title: 'api-check plain spot (no collections SQL)' });
    ok(plain.collectionId == null, 'and a plain spot still saves, ungrouped');
    const edited = await api.patchSpot(plain.id, { title: 'api-check plain spot, edited (no collections SQL)' });
    ok(edited.title.endsWith('edited (no collections SQL)'), 'and still edits');
    await api.deleteSpot(plain.id).catch(() => {});
  } else {
    ok(Array.isArray(ping.features) && ping.features.includes('collections'), 'ping lists the collections feature');
    const badC = await expectStatus(api.saveCollection({ id: 'nope', name: '' }), 400, 'a bad collection is 400');
    ok(Array.isArray(badC.details) && badC.details.length >= 2, 'the 400 lists every problem (id, name)');
    await expectStatus(api.saveCollection({ id: crypto.randomUUID(), name: 'x'.repeat(61) }), 400, 'a 61-character name is 400');
    const cid = crypto.randomUUID();
    const made = await api.saveCollection({ id: cid, name: '  api-check collection  ' });
    ok(made.id === cid && made.name === 'api-check collection' && made.sort === null && made.bounds === null, 'POST creates a collection (name trimmed, no sort, no bounds)');
    const again = await api.saveCollection({ id: cid, name: 'a different name' });
    ok(again.name === 'api-check collection', 'a re-POST of the same id changes nothing (create once)');
    ok((await api.listCollections()).some((c) => c.id === cid), 'the list holds it');
    const renamed = await api.patchCollection(cid, { name: 'api-check renamed', ifUpdatedAt: made.updatedAt });
    ok(renamed.name === 'api-check renamed', 'PATCH renames it');
    await expectStatus(api.patchCollection(cid, { name: 'stale', ifUpdatedAt: made.updatedAt }), 409, 'a stale rename (ifUpdatedAt) is 409');
    await expectStatus(api.patchCollection(cid, { bounds: [[120, -30], [110, -40]] }), 400, 'bounds the wrong way round are 400');
    const framed = await api.patchCollection(cid, { bounds: [[115.6, -32.4], [116.1, -31.7]], sort: 2 });
    ok(framed.sort === 2 && framed.bounds?.[1]?.[0] === 116.1, 'PATCH sets its sort and map bounds');

    // a spot and a place in it
    const sid = crypto.randomUUID();
    const inColl = await api.saveSpot({ ...capture, id: sid, title: 'api-check spot in a collection', collectionId: cid });
    ok(inColl.collectionId === cid, 'POST a spot straight into a collection (capture)');
    await expectStatus(api.patchSpot(sid, { collectionId: 'not-a-uuid' }), 400, 'a collectionId that is not a uuid is 400');
    const ahead = crypto.randomUUID();
    const early = await api.patchSpot(sid, { collectionId: ahead });
    ok(early.collectionId === ahead, 'a spot may name a collection that has not arrived yet (the outbox sends it first)');
    const back = await api.patchSpot(sid, { collectionId: cid, ifUpdatedAt: early.updatedAt });
    ok(back.collectionId === cid, 'PATCH moves it (with ifUpdatedAt)');
    await expectStatus(api.patchSpot(sid, { collectionId: null, ifUpdatedAt: early.updatedAt }), 409, 'a stale move is 409');
    let pid = null;
    if (!noBuildings) {
      pid = crypto.randomUUID();
      const place = await api.saveBuilding({ id: pid, createdBy: 'james', title: 'api-check place in a collection', collectionId: cid, capturedAt: '2026-12-18T09:00:00.000Z' });
      ok(place.collectionId === cid, 'POST a whole place straight into a collection');
      const moved = await api.patchBuilding(pid, { collectionId: null });
      ok(moved.collectionId === null, 'PATCH takes a place out of it');
      const moved2 = await api.patchBuilding(pid, { collectionId: cid });
      ok(moved2.collectionId === cid, 'and puts it back');
    }

    // a share link never shows the collection
    const tokenRes = (await (await raw('/api/memories/shares', { method: 'POST', headers: auth, body: JSON.stringify({ kind: 'spot', id: sid }) })).json()).data;
    const sharedRes = await raw(`/api/memories/shared/${tokenRes.token}`);
    const sharedText = await sharedRes.text();
    ok(sharedRes.status === 200 && !/collectionId|api-check renamed/.test(sharedText), 'a share link shows neither the collectionId nor the collection name');
    await raw(`/api/memories/shares/${tokenRes.token}`, { method: 'DELETE', headers: auth });

    // delete: the collection goes, its spot and place stay, ungrouped
    const gone = await api.deleteCollection(cid);
    ok(gone.deleted === true && gone.ungrouped?.spots >= 1 && gone.ungrouped?.buildings === (pid ? 1 : 0), 'DELETE removes it and says how many it ungrouped', JSON.stringify(gone));
    ok(!(await api.listCollections()).some((c) => c.id === cid), 'it leaves the list');
    const after = await api.getSpot(sid);
    ok(after && !after.deletedAt && after.collectionId === null, 'its spot stays, ungrouped (never deleted)');
    if (pid) {
      const afterPlace = await api.getBuilding(pid);
      ok(afterPlace && !afterPlace.deletedAt && afterPlace.collectionId === null, 'its place stays, ungrouped');
      await api.deleteBuilding(pid);
    }
    await expectStatus(api.deleteCollection(cid), 404, 'deleting it again is 404');
    await api.deleteSpot(sid);
  }
}

// ── freeform spots: old photos, the layout + viewpoints, EXIF (CONTRACTS.md 8) ────
const noFreeform = noCollections || process.env.PGREST_NO_FREEFORM === '1' || args.includes('--no-freeform');
{
  const auth = { authorization: `Bearer ${cfg.token}`, 'content-type': 'application/json' };
  const jpeg = await sharp({ create: { width: 64, height: 48, channels: 3, background: '#557' } }).jpeg().toBuffer();
  const exif = { focal35: 24, focal: 6.86, make: 'Apple', model: 'iPhone 15 Pro', takenAt: '2019-06-02T18:40:11+08:00', width: 4032, height: 3024 };
  const capture = {
    mode: 'freeform',
    era: 'lived here 2019–2021',
    captions: { 2: 'from the bed' },
    layout: { outline: [[0, 0], [4, 0], [4, 3], [0, 3]], sizeKnown: false, openings: [{ edge: 2, offset: 1.1, width: 0.8, type: 'door' }] },
    views: [{ photo: 14, x: 1.2, z: 2.0, yaw: 40, conf: 'rough' }],
  };
  if (noFreeform) {
    ok(Array.isArray(ping.features) && !ping.features.includes('freeform'), 'ping does not claim freeform before the SQL', JSON.stringify(ping.features));
    const rf = await raw('/api/memories/spots', { method: 'POST', headers: auth, body: JSON.stringify({ ...captureSpot(), capture }) });
    const jf = await rf.json().catch(() => ({}));
    ok(rf.status === 503 && jf.code === 'needs-sql', 'a freeform spot before the SQL is 503 needs-sql (held on the phone)', `${rf.status} ${JSON.stringify(jf)}`);
    const guided = await api.saveSpot(captureSpot());
    const ph = await api.putMedia(guided.id, 'photo', 1, jpeg, { contentType: 'image/jpeg', width: 64, height: 48, exif });
    ok(ph && !ph.exif, 'a guided spot and its photo still save; the EXIF is just left off');
    await api.deleteSpot(guided.id).catch(() => {});
  } else {
    ok(Array.isArray(ping.features) && ping.features.includes('freeform'), 'ping lists the freeform feature');
    const bad = await expectStatus(api.saveSpot({ ...captureSpot(), capture: { mode: 'freeform', views: [{ photo: 41, x: 0, z: 0, yaw: 0, conf: 'rough' }] } }), 400, 'a capture with a viewpoint on photo 41 is 400');
    ok((bad.details || []).some((d) => String(d).startsWith('capture/views/0/photo')), 'its details name the field (capture/views/0/photo)', JSON.stringify(bad.details));
    const ff = await api.saveSpot({ ...captureSpot(), capture });
    ok(ff.capture?.mode === 'freeform' && ff.capture.views?.[0]?.photo === 14 && ff.capture.layout?.openings?.length === 1, 'POST a freeform spot: its capture is stored');
    const p40 = await api.putMedia(ff.id, 'photo', 40, jpeg, { contentType: 'image/jpeg', width: 64, height: 48 });
    ok(p40?.name === '40' && p40.r2Key.endsWith('/photos/40.jpg'), 'a freeform spot takes photo 40');
    await expectStatus(api.putMedia(ff.id, 'photo', 41, jpeg, { contentType: 'image/jpeg' }), 400, 'but not photo 41');
    const t13 = await api.putMedia(ff.id, 'thumb', 13, jpeg, { contentType: 'image/jpeg', width: 64, height: 48 });
    ok(t13?.name === '13', 'and thumbs past 12 too');
    const guided = await api.saveSpot(captureSpot());
    await expectStatus(api.putMedia(guided.id, 'photo', 13, jpeg, { contentType: 'image/jpeg' }), 400, 'a GUIDED spot still stops at photo 12');
    const pe = await api.putMedia(ff.id, 'photo', 1, jpeg, { contentType: 'image/jpeg', width: 64, height: 48, exif });
    ok(pe?.exif?.focal35 === 24 && pe.exif.make === 'Apple' && pe.exif.takenAt === exif.takenAt && pe.exif.width === 4032, "a photo's EXIF lands on its media row", JSON.stringify(pe?.exif));
    const garbled = await raw(`/api/memories/spots/${ff.id}/media/photo/2`, { method: 'PUT', headers: { authorization: `Bearer ${cfg.token}`, 'content-type': 'image/jpeg', 'x-exif': '%7Bnot json' }, body: jpeg });
    const gj = await garbled.json().catch(() => ({}));
    ok(garbled.status === 200 && !gj.data?.exif, 'a garbled x-exif never fails the upload (it is just left off)', `${garbled.status}`);
    const listed = (await api.getSpot(ff.id)).media.find((m) => m.type === 'photo' && m.name === '1');
    ok(listed?.exif?.focal35 === 24, 'GET returns the EXIF with the photo');
    // PATCH: viewpoints added after the fact, ifUpdatedAt, a bad one, clearing it
    const before = await api.getSpot(ff.id);
    const more = { ...capture, views: [...capture.views, { photo: 3, x: 3, z: 1, yaw: 270, conf: 'exact' }] };
    const patched = await api.patchSpot(ff.id, { capture: more, ifUpdatedAt: before.updatedAt });
    ok(patched.capture?.views?.length === 2, 'PATCH a capture (a second viewpoint) with ifUpdatedAt');
    await expectStatus(api.patchSpot(ff.id, { capture: more, ifUpdatedAt: before.updatedAt }), 409, 'the same PATCH again, stale, is 409');
    await expectStatus(api.patchSpot(ff.id, { capture: { ...more, layout: { outline: [[0, 0], [2, 2], [2, 0], [0, 2]] } } }), 400, 'a crossed outline is 400');
    const g2 = await api.patchSpot(guided.id, { capture: { mode: 'freeform' } });
    ok(g2.capture?.mode === 'freeform', 'an existing spot can be made freeform');
    const g3 = await api.patchSpot(guided.id, { capture: null });
    ok(g3.capture === null, 'and back (capture: null)');
    // a shared room never shows the capture (era, captions, viewpoints)
    const sh = (await (await raw('/api/memories/shares', { method: 'POST', headers: auth, body: JSON.stringify({ kind: 'spot', id: ff.id }) })).json()).data;
    const shText = await (await raw(`/api/memories/shared/${sh.token}`)).text();
    ok(!/lived here|from the bed|"capture"|exif|focal/.test(shText), 'a share link shows neither the capture nor any EXIF');
    await raw(`/api/memories/shares/${sh.token}`, { method: 'DELETE', headers: auth });
    await api.deleteSpot(ff.id);
    await api.deleteSpot(guided.id);
  }
}

await api.deleteSpot(id);

console.log(`\n${passed} checks passed against ${cfg.base} (${ping.rowStore} row store).`);
