#!/usr/bin/env node
/* Exercises every /api/memories route against a running Worker.

     npx wrangler dev --port 8788         (in another terminal; MEMORIES_ROW_STORE=local)
     node tools/memory-rooms/api-check.mjs [--base http://127.0.0.1:8788]

   Creates one throwaway spot ("api-check …"), checks upsert idempotency, media
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

// ── soft delete ──────────────────────────────────────────────────────────────
await api.deleteSpot(id);
ok(!(await api.listSpots()).some((s) => s.id === id), 'a deleted spot leaves the list');
ok((await api.listSpots({ deleted: true })).some((s) => s.id === id && s.deletedAt), '?deleted=1 still shows it');
await api.restoreSpot(id);
ok((await api.listSpots()).some((s) => s.id === id), 'restore brings it back');
await api.deleteSpot(id);

console.log(`\n${passed} checks passed against ${cfg.base} (${ping.rowStore} row store).`);
