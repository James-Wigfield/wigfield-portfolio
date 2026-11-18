#!/usr/bin/env node
/* Exercises every /api/memories route against a running Worker.

     npx wrangler dev --port 8788         (in another terminal; MEMORIES_ROW_STORE=local)
     node tools/memory-rooms/api-check.mjs [--base http://127.0.0.1:8788]

   Creates one throwaway spot ("api-check …"), checks create-once idempotency, edits
   (PATCH checks, ifUpdatedAt → 409, a re-POST never undoing an edit), media
   upload + signed links, scene validation + versioning, soft delete + restore,
   then soft-deletes it again. Exits 1 on the first failure. */

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
await api.deleteSpot(id);

console.log(`\n${passed} checks passed against ${cfg.base} (${ping.rowStore} row store).`);
