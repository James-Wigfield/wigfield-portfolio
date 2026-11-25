/* ============================================================================
   DREAM ROOMS · api-check: the Worker API against CONTRACTS.md §2.
     DREAMS_API=http://127.0.0.1:8796 node tools/dream-rooms/api-check.mjs [--remote-ok]

   Runs against a wrangler dev by default (it refuses any other host unless
   --remote-ok: it writes test rows, then purges every one it made). Its rows
   live on nights in a random year of the 1900s, so they never meet the fixtures.
   PASS / FAIL lines, exit 1 on any fail. Prints ids, statuses and counts only
   (decision 14); the texts it writes are its own invented test strings.
   ========================================================================== */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { config, devVars, isLocalApi, REPO } from './lib/api.mjs';
import { ownSlice, firstWords } from '../../src/dream-rooms/contracts/rows.js';

const { base, token } = config();
if (!isLocalApi(base) && !process.argv.includes('--remote-ok')) {
  console.error(`api-check: ${new URL(base).host} isn't local; it writes (and purges) test rows, so pass --remote-ok to run it there.`);
  process.exit(1);
}
const vars = devVars();
const MEMORIES = process.env.MEMORIES_PASSWORD || vars.MEMORIES_PASSWORD || '';
const SAMPLE_TEXT = fs.readFileSync(path.join(REPO, 'tools/dream-rooms/samples/sample-dream.txt'), 'utf8');
const SAMPLE_DREAM = JSON.parse(fs.readFileSync(path.join(REPO, 'src/dream-rooms/contracts/fixtures/sample.dream.json'), 'utf8'));
const SAMPLE_WORLD = JSON.parse(fs.readFileSync(path.join(REPO, 'src/dream-rooms/contracts/fixtures/sample.world.json'), 'utf8'));
const NOT_FOUND_BODY = '{"error":"Not found"}';
const FEATURES = ['nights', 'split', 'draft', 'purge', 'corridor'];
const LEAN_FIELDS = ['dreamt_on', 'first_words', 'id', 'night_order', 'split_from', 'status', 'still_key', 'title'];

// ── harness ─────────────────────────────────────────────────────────────────
let passed = 0;
const failed = [];
function ok(cond, label, extra = '') {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${extra && !cond ? `  — ${extra}` : ''}`);
  if (cond) passed += 1;
  else failed.push(label);
  return cond;
}
const section = (name) => console.log(`\n── ${name}`);

async function req(method, p, { auth = token, body, headers = {} } = {}) {
  const h = { ...headers };
  if (auth) h.authorization = `Bearer ${auth}`;
  let b;
  if (body !== undefined) {
    if (Buffer.isBuffer(body) || typeof body === 'string') b = body;
    else {
      b = JSON.stringify(body);
      h['content-type'] = 'application/json';
    }
  }
  const t0 = performance.now();
  const res = await fetch(/^https?:/.test(p) ? p : `${base}${p}`, { method, headers: h, body: b });
  const buf = Buffer.from(await res.arrayBuffer());
  const ms = performance.now() - t0;
  let json = null;
  try {
    json = JSON.parse(buf.toString('utf8'));
  } catch {
    json = null;
  }
  return { status: res.status, headers: res.headers, buf, text: buf.toString('utf8'), json, ms, data: json?.data };
}

const created = new Set();
const uuid = () => crypto.randomUUID();
const Y = String(1900 + Math.floor(Math.random() * 90));
const night = (md) => `${Y}-${md}`;
const D = '/api/dreams';
const headersOk = (r) => r.headers.get('cache-control') === 'private, no-store' && r.headers.get('x-robots-tag') === 'noindex, nofollow';
const bytes = (n, seed) => Buffer.from(Array.from({ length: n }, (_, i) => (i * 31 + seed) & 255));

async function create(fields) {
  const id = fields.id || uuid();
  created.add(id);
  const r = await req('POST', D, { body: { id, ...fields } });
  if (r.status !== 201 && r.status !== 200) throw new Error(`setup: create ${id} → ${r.status}`);
  return r.data;
}
const get = async (id) => (await req('GET', `${D}/${id}`)).data;
const patch = (id, body) => req('PATCH', `${D}/${id}`, { body });
const put = (id, p, buf, type = 'application/octet-stream') => req('PUT', `${D}/${id}/file/${p}`, { body: buf, headers: { 'content-type': type } });
const list = async () => (await req('GET', D)).data;
const orders = async (n) => Object.fromEntries((await list()).filter((r) => r.dreamt_on === n).map((r) => [r.id, r.night_order]));
const tokenOf = (u) => new URL(u, base).searchParams.get('t');
const keyOf = (u) => new URL(u, base).pathname.slice(`${D}/file/`.length);

async function main() {
  console.log(`api-check → ${base} (test nights in ${Y})`);

  // ── ping ──────────────────────────────────────────────────────────────────
  section('ping');
  const ping = await req('GET', `${D}/ping`);
  ok(ping.status === 200 && ping.data?.ok === true && ping.data?.store === 'r2', 'ping answers with the password', `status ${ping.status}`);
  ok(FEATURES.every((f) => ping.data?.features?.includes(f)), 'ping lists nights, split, draft, purge, corridor');
  ok(headersOk(ping), 'ping (200) carries cache-control private, no-store + x-robots-tag');

  // a real row with a real file, for the locked-door checks
  const R1 = (await create({ dreamt_on: night('01-01'), raw_text: 'A test capture: a grey room with one window and a chair.' })).id;
  await put(R1, 'stills/probe.webp', bytes(64, 1), 'image/webp');
  const r1Before = await get(R1);
  const realKey = `dreams/${R1}/stills/probe.webp`;

  // ── locked: no password, a wrong one, the memories one ───────────────────
  section('no password / wrong password / MEMORIES_PASSWORD → the same 404');
  const fake = uuid();
  const strayPost = uuid();
  created.add(strayPost);
  const routes = [
    ['GET', `${D}/ping`],
    ['GET', D],
    ['GET', `${D}/${R1}`],
    ['GET', `${D}/${fake}`],
    ['GET', `${D}/not-a-uuid`],
    ['POST', D, { id: strayPost, dreamt_on: night('01-01'), raw_text: 'should never be stored' }],
    ['PATCH', `${D}/${R1}`, { title: 'should never be stored' }],
    ['PATCH', `${D}/${fake}`, { title: 'x' }],
    ['PUT', `${D}/${R1}/file/stills/x.webp`, bytes(32, 2)],
    ['DELETE', `${D}/${R1}`],
    ['DELETE', `${D}/${R1}?purge=1`],
    ['DELETE', `${D}/${R1}/file/draft`],
    ['POST', `${D}/${R1}/split`, { at: 'one window' }],
    ['GET', `${D}/file/${realKey}`],
    ['GET', `${D}/file/${realKey}?t=123.garbage`],
    ['GET', `${D}/file/dreams/${fake}/stills/probe.webp`],
  ];
  const modes = [
    ['no password', null, false],
    ['wrong password', 'definitely-not-the-password', true],
  ];
  if (MEMORIES && MEMORIES !== token && MEMORIES !== vars.DREAMS_PASSWORD && MEMORIES !== vars.PORTAL_PASSWORD) modes.push(['MEMORIES_PASSWORD', MEMORIES, true]);
  else ok(false, 'MEMORIES_PASSWORD is set in .dev.vars (needed to prove it never opens dreams)');
  for (const [label, auth, slow] of modes) {
    const results = await Promise.all(routes.map(([m, p, b]) => req(m, p, { auth: auth || '', body: b, headers: Buffer.isBuffer(b) ? { 'content-type': 'image/webp' } : {} })));
    const bad = results.map((r, i) => (r.status === 404 && r.text === NOT_FOUND_BODY ? null : `${routes[i][0]} ${routes[i][1].replace(/[0-9a-f-]{36}/g, '<id>')} → ${r.status}`)).filter(Boolean);
    ok(bad.length === 0, `${label}: all ${routes.length} routes → 404 {"error":"Not found"}, byte-identical`, bad.join('; '));
    ok(results.every(headersOk), `${label}: every 404 carries cache-control + x-robots-tag`);
    if (slow) {
      const fastest = Math.min(...results.map((r) => r.ms));
      ok(fastest >= 550, `${label}: every answer waited ≥ 550 ms`, `fastest ${Math.round(fastest)} ms`);
    }
  }
  const lone = await req('GET', `${D}/ping`, { auth: 'another-wrong-one' });
  ok(lone.status === 404 && lone.ms >= 550, 'a wrong password on its own takes ≥ 550 ms', `${Math.round(lone.ms)} ms`);
  const r1After = await get(R1);
  ok(r1After.updated_at === r1Before.updated_at && !r1After.deleted_at && r1After.title === null, 'the locked PATCH / DELETE / split changed nothing');
  ok(r1After.files.stills.length === 1 && r1After.files.stills[0].name === 'probe', 'the locked PUT stored nothing');
  ok((await req('GET', `${D}/${strayPost}`)).status === 404, 'the locked POST created nothing');

  // ── authenticated basics ──────────────────────────────────────────────────
  section('authenticated basics');
  const listRes = await req('GET', D);
  ok(listRes.status === 200 && Array.isArray(listRes.data) && headersOk(listRes), 'the list (200) carries the headers');
  ok((await req('GET', `${D}/not-a-uuid`)).text === NOT_FOUND_BODY, 'a bad uuid with the password → 404');
  ok((await req('GET', `${D}/${fake}`)).status === 404, 'an unknown id with the password → 404');
  ok((await req('GET', `${D}/${R1}/nope`)).status === 404, 'an unknown sub-route → 404');
  const getR1 = await req('GET', `${D}/${R1}`);
  ok(headersOk(getR1), 'GET /:id (200) carries the headers');
  ok((await req('POST', D, { body: { id: uuid(), dreamt_on: night('01-01') } })).status === 400, 'POST without raw_text → 400');
  ok((await req('POST', D, { body: { id: 'nope', dreamt_on: night('01-01'), raw_text: 'x' } })).status === 400, 'POST with a non-uuid id → 400');
  ok((await req('POST', D, { body: { id: uuid(), dreamt_on: `${Y}-02-30`, raw_text: 'x' } })).status === 400, 'POST with an impossible date → 400');
  ok((await patch(R1, { nonsense: 1 })).status === 400, 'PATCH with an unknown field → 400');

  // ── create once ──────────────────────────────────────────────────────────
  section('create once');
  const C1 = uuid();
  created.add(C1);
  const first = await req('POST', D, { body: { id: C1, dreamt_on: night('02-01'), raw_text: 'First words of a test capture.' } });
  const again = await req('POST', D, { body: { id: C1, dreamt_on: night('02-02'), raw_text: 'Different words entirely.' } });
  ok(first.status === 201 && first.data?.status === 'captured' && first.data?.night_order === 1, 'POST creates (201, captured, night_order 1)');
  ok(again.status === 200 && JSON.stringify(again.data) === JSON.stringify(first.data), 'the same POST again returns the stored row unchanged (200)');
  ok(first.data?.visibility === 'private' && first.data?.dream_version === 0 && Array.isArray(first.data?.split_into), 'a new row is private, dream_version 0, split_into []');

  // ── frozen text ──────────────────────────────────────────────────────────
  section('frozen text');
  const e1 = await patch(C1, { raw_text: 'Edited words while still captured.' });
  ok(e1.status === 200 && e1.data?.raw_text === 'Edited words while still captured.', 'raw_text is editable while captured');
  const s1 = await patch(C1, { status: 'reading' });
  ok(s1.status === 200 && s1.data?.status === 'reading' && s1.data?.status_at >= e1.data?.status_at, 'status → reading (status_at set)');
  const frozen = await patch(C1, { raw_text: 'Trying to change it after the read.' });
  ok(frozen.status === 409, 'raw_text after status reading → 409', `got ${frozen.status}`);
  const extra = await patch(C1, { extra_text: 'Remembered a little more.' });
  ok(extra.status === 200 && extra.data?.extra_text === 'Remembered a little more.', 'extra_text still takes additions');

  // ── ifUpdatedAt ──────────────────────────────────────────────────────────
  section('ifUpdatedAt');
  const stale = await patch(C1, { ifUpdatedAt: '2001-01-01T00:00:00.000Z', title: 'A test title' });
  ok(stale.status === 409, 'a stale ifUpdatedAt → 409', `got ${stale.status}`);
  const fresh = await patch(C1, { ifUpdatedAt: extra.data.updated_at, title: 'A test title' });
  ok(fresh.status === 200 && fresh.data?.title === 'A test title' && fresh.data.updated_at > extra.data.updated_at, 'the current ifUpdatedAt → 200, updated_at moves on');

  // ── validation ───────────────────────────────────────────────────────────
  section('validation');
  const S = (await create({ dreamt_on: night('03-01'), raw_text: SAMPLE_TEXT })).id;
  const badDream = await patch(S, { dream: { version: 1, title: 'x' } });
  ok(badDream.status === 400 && Array.isArray(badDream.json?.details) && badDream.json.details.length > 0, 'a bad dream → 400 with details');
  const W = (await create({ dreamt_on: night('03-02'), raw_text: 'A row that will carry the sample world without a dream.' })).id;
  const w0 = await get(W);
  const wOk = await patch(W, { world: SAMPLE_WORLD });
  ok(wOk.status === 200 && wOk.data?.world_version === w0.world_version + 1, 'the sample world on a row with no dream → 200, world_version bumped', `status ${wOk.status}`);
  const wSame = await patch(W, { world: SAMPLE_WORLD });
  ok(wSame.status === 200 && wSame.data?.world_version === wOk.data?.world_version, 'the same world again doesn\'t bump world_version');
  const badWorld = await patch(W, { world: { version: 1 } });
  ok(badWorld.status === 400 && badWorld.json?.details?.length > 0, 'a bad world → 400 with details');
  const corridor = await patch(W, { world: { ...SAMPLE_WORLD, kind: 'corridor' } });
  ok(corridor.status === 400, 'a corridor world is never stored → 400');
  const dOk = await patch(S, { dream: SAMPLE_DREAM });
  ok(dOk.status === 200 && dOk.data?.dream_version === 1, 'the sample dream on the sample text → 200, dream_version 1', `status ${dOk.status}`);
  ok(JSON.stringify(dOk.data?.motifs) === JSON.stringify(SAMPLE_DREAM.motifs || []), 'motifs are copied from dream.motifs');
  const wDream = await patch(S, { world: SAMPLE_WORLD });
  ok(wDream.status === 200 && wDream.data?.world_version === 1, 'the sample world checked against its dream → 200');
  const uncited = JSON.parse(JSON.stringify(SAMPLE_WORLD));
  delete uncited.modules[0].props[0].for;
  ok((await patch(S, { world: uncited })).status === 400, 'a world with an uncited prop → 400 (checked against the dream)');
  const wrongQuote = JSON.parse(JSON.stringify(SAMPLE_DREAM));
  wrongQuote.places[0].quote[0] = 'words nobody wrote';
  ok((await patch(S, { dream: wrongQuote })).status === 400, 'a dream quoting words not in the text → 400');

  // ── nights ───────────────────────────────────────────────────────────────
  section('night renumbering');
  const N = night('04-10');
  const N2 = night('04-12');
  const A = (await create({ dreamt_on: N, raw_text: 'Night test one.' })).id;
  const B = (await create({ dreamt_on: N, raw_text: 'Night test two.' })).id;
  const C = (await create({ dreamt_on: N, raw_text: 'Night test three.' })).id;
  let o = await orders(N);
  ok(o[A] === 1 && o[B] === 2 && o[C] === 3, 'three in a night without night_order → 1, 2, 3');
  await patch(C, { night_order: 1 });
  o = await orders(N);
  ok(o[C] === 1 && o[A] === 2 && o[B] === 3, 'move #3 to 1 → C 1, A 2, B 3', JSON.stringify(Object.values(o)));
  await req('DELETE', `${D}/${A}`);
  o = await orders(N);
  ok(o[C] === 1 && o[B] === 2 && !(A in o), 'soft-delete the middle → 1..n with no gaps, the deleted row gone');
  const Dd = (await create({ dreamt_on: N, raw_text: 'Night test four.' })).id;
  const E = (await create({ dreamt_on: N2, raw_text: 'Another night, test one.' })).id;
  o = await orders(N);
  ok(o[Dd] === 3, 'a new capture goes to the end of its night');
  await patch(B, { dreamt_on: N2 });
  o = await orders(N);
  const o2 = await orders(N2);
  ok(o2[E] === 1 && o2[B] === 2, 'PATCH dreamt_on → the row is at the end of its new night');
  ok(o[C] === 1 && o[Dd] === 2 && !(B in o), 'and the old night is renumbered 1..n');
  const ins = (await create({ dreamt_on: N2, night_order: 1, raw_text: 'Inserted first.' })).id;
  const o3 = await orders(N2);
  ok(o3[ins] === 1 && o3[E] === 2 && o3[B] === 3, 'POST with night_order 1 slots in first; the rest shift along');
  await patch(ins, { night_order: 99 });
  const o4 = await orders(N2);
  ok(o4[ins] === 3 && o4[E] === 1 && o4[B] === 2, 'night_order past the end clamps to the last place');

  // ── split ────────────────────────────────────────────────────────────────
  section('split');
  const SN = night('05-01');
  const text = 'I was in a long hall with a red door. Later the red door was gone and the floor was wet. And then I had another one where I was on a bus that never stopped at any stop.';
  const P = (await create({ dreamt_on: SN, raw_text: text })).id;
  const Q = (await create({ dreamt_on: SN, raw_text: 'A later dream the same night.' })).id;
  const notFound = await req('POST', `${D}/${P}/split`, { body: { at: 'words that are not there' } });
  ok(notFound.status === 400, 'a phrase that isn\'t in the text → 400', `got ${notFound.status}`);
  const twice = await req('POST', `${D}/${P}/split`, { body: { at: 'red door' } });
  ok(twice.status === 400, 'a phrase that occurs twice → 400', `got ${twice.status}`);
  const atStart = await req('POST', `${D}/${P}/split`, { body: { at: 'I was in a long hall' } });
  ok(atStart.status === 400, 'a phrase at the very start (nothing left before it) → 400', `got ${atStart.status}`);
  const sp = await req('POST', `${D}/${P}/split`, { body: { at: 'And then I had another one' } });
  const parent = sp.data?.parent;
  const child = sp.data?.child;
  if (child?.id) created.add(child.id);
  ok(sp.status === 200 || sp.status === 201, 'split → { parent, child }', `got ${sp.status}`);
  if (parent && child) {
    ok(parent.raw_text === text, 'the parent\'s raw_text is untouched');
    ok(ownSlice(parent) + child.raw_text === text, 'parent.own slice + child.raw_text = the parent\'s raw_text');
    ok(child.split_from === P && child.dreamt_on === SN && child.status === 'captured', 'the child: split_from, the same night, captured');
    ok(child.night_order === parent.night_order + 1, 'the child\'s night_order = the parent\'s + 1');
    ok(parent.split_into?.includes(child.id), 'the parent\'s split_into includes the child');
    ok((await orders(SN))[Q] === 3, 'a later dream that night shifted to +1');
    ok((await patch(P, { raw_text: 'changed after a split' })).status === 409, 'a split parent\'s raw_text is frozen (409)');
    const sp2 = await req('POST', `${D}/${child.id}/split`, { body: { at: 'never stopped' } });
    if (sp2.data?.child?.id) created.add(sp2.data.child.id);
    ok(sp2.status === 201 && ownSlice(sp2.data.parent) + sp2.data.child.raw_text === child.raw_text && (await orders(SN))[Q] === 4, 'a child splits again: slices still join, the night shifts again');
    const parentRow = await get(P);
    const lean = (await list()).find((r) => r.id === P);
    ok(lean?.first_words === firstWords(ownSlice(parentRow)) && lean.first_words.endsWith('…'), 'first_words comes from the parent\'s own slice (+ …)');
    ok((await list()).find((r) => r.id === child.id)?.split_from === P, 'the list carries split_from');
  }
  await patch(Q, { status: 'rendered' });
  const lateSplit = await req('POST', `${D}/${Q}/split`, { body: { at: 'same night' } });
  ok(lateSplit.status === 409, 'a rendered dream can\'t be split (409)', `got ${lateSplit.status}`);

  // ── the lean list ────────────────────────────────────────────────────────
  section('the lean list');
  const rows = await list();
  const sorted = rows.every((r, i) => i === 0 || rows[i - 1].dreamt_on < r.dreamt_on || (rows[i - 1].dreamt_on === r.dreamt_on && rows[i - 1].night_order < r.night_order));
  ok(sorted, `sorted by (dreamt_on, night_order) across all ${rows.length} rows`);
  ok(rows.every((r) => JSON.stringify(Object.keys(r).sort()) === JSON.stringify(LEAN_FIELDS)), 'every item has exactly the lean fields');
  ok(rows.every((r) => r.first_words.replace(/…$/, '').split(/\s+/).filter(Boolean).length <= 6), 'first_words ≤ 6 words (+ … when longer)');
  ok(!rows.some((r) => r.id === A), 'deleted rows are left out');

  // ── files + signed urls ──────────────────────────────────────────────────
  section('files and signed urls');
  const X = (await create({ dreamt_on: night('06-01'), raw_text: 'A row for the file checks.' })).id;
  const glb = bytes(2048, 3);
  const hall = bytes(300, 4);
  const pool = bytes(200, 5);
  ok((await put(X, 'model/world-v1.glb', glb, 'model/gltf-binary')).status === 200, 'PUT model/world-v1.glb');
  ok((await put(X, 'stills/hall.webp', hall, 'image/webp')).status === 200, 'PUT stills/hall.webp');
  ok((await put(X, 'stills/pool.webp', pool, 'image/webp')).status === 200, 'PUT stills/pool.webp');
  for (const bad of ['other/x.bin', 'model/world.glb', 'stills/a.gif', 'stills/../x.webp', 'draft/other.json']) {
    ok((await put(X, bad, bytes(10, 6))).status === 400, `PUT ${bad} → 400 (not on the allow-list)`);
  }
  const big = await put(X, 'stills/big.webp', Buffer.alloc(4 * 1024 * 1024 + 1, 7), 'image/webp');
  ok(big.status === 413, 'a still over 4 MB → 413', `got ${big.status}`);
  ok((await patch(X, { model_key: `dreams/${X}/model/world-v9.glb` })).status === 400, 'model_key of a file that isn\'t there → 400');
  ok((await patch(X, { model_key: `dreams/${R1}/stills/probe.webp` })).status === 400, 'model_key of another dream\'s file → 400');
  const keys = await patch(X, { model_key: `dreams/${X}/model/world-v1.glb`, still_key: `dreams/${X}/stills/hall.webp` });
  ok(keys.status === 200, 'PATCH model_key + still_key');
  const gx = await get(X);
  const f = gx.files;
  ok(Boolean(f?.model_url && f?.still_url) && f.stills.map((s) => s.name).join() === 'hall,pool', 'GET /:id → files: model_url, still_url, stills [hall, pool]');
  ok(f?.draft === null, 'no draft → files.draft is null');
  const modelRes = await req('GET', f.model_url, { auth: '' });
  ok(modelRes.status === 200 && modelRes.buf.equals(glb), 'a signed url opens its file without the password');
  ok(headersOk(modelRes) && modelRes.headers.get('content-type') === 'model/gltf-binary', 'a file (200) carries the headers + its content-type');
  const exp = Number(tokenOf(f.model_url).split('.')[0]);
  const nowS = Date.now() / 1000;
  ok(exp > nowS && exp <= nowS + 3600 + 2, 'its exp ≤ now + 3600', `exp − now = ${Math.round(exp - nowS)} s`);
  const t = tokenOf(f.model_url);
  // flip the sig's FIRST character (its last one can sit in base64's unused padding bits)
  const [tExp, tSig] = t.split('.');
  const flipped = `${tExp}.${tSig[0] === 'A' ? 'B' : 'A'}${tSig.slice(1)}`;
  const tampered = await req('GET', `${D}/file/${keyOf(f.model_url)}?t=${flipped}`, { auth: '' });
  ok(tampered.status === 404 && tampered.text === NOT_FOUND_BODY, 'a tampered sig → 404');
  const hallUrl = f.stills.find((s) => s.name === 'hall').url;
  const cross = await req('GET', `${D}/file/dreams/${X}/stills/pool.webp?t=${tokenOf(hallUrl)}`, { auth: '' });
  ok(cross.status === 404, 'a valid token for key A can\'t open key B (same dream)');
  const crossRow = await req('GET', `${D}/file/${realKey}?t=${tokenOf(hallUrl)}`, { auth: '' });
  ok(crossRow.status === 404, 'nor another dream\'s file');
  const bearer = await req('GET', `${D}/file/dreams/${X}/stills/pool.webp`);
  ok(bearer.status === 200 && bearer.buf.equals(pool), 'the bearer works instead of a token');

  // an expired token, signed with the same key the Worker uses locally
  const material = vars.DREAMS_SIGNING_KEY || `dreams-derived|${vars.DREAMS_PASSWORD || ''}|${vars.PORTAL_PASSWORD || ''}`;
  const sign = (key, e) => crypto.createHmac('sha256', material).update(`${key}.${e}`).digest('base64url');
  const modelKey = keyOf(f.model_url);
  if (sign(modelKey, exp) === t.split('.')[1]) {
    const past = Math.floor(nowS) - 60;
    const expired = await req('GET', `${D}/file/${modelKey}?t=${past}.${sign(modelKey, past)}`, { auth: '' });
    ok(expired.status === 404 && expired.text === NOT_FOUND_BODY, 'a correctly signed token with an exp in the past → 404');
    const far = Math.floor(nowS) + 7200;
    ok((await req('GET', `${D}/file/${modelKey}?t=${far}.${sign(modelKey, far)}`, { auth: '' })).status === 404, 'a correctly signed token living > 1 h → 404');
    const good = Math.floor(nowS) + 600;
    ok((await req('GET', `${D}/file/${modelKey}?t=${good}.${sign(modelKey, good)}`, { auth: '' })).status === 200, 'and the same key signing a 10-min token opens it (control)');
  } else if (isLocalApi(base)) {
    ok(false, 'derive the local signing key (to forge an expired token)', 'the Worker\'s key differs from .dev.vars');
  } else {
    console.log('SKIP  expired-token checks (the signing key is a secret here)');
  }

  // ── drafts ───────────────────────────────────────────────────────────────
  section('drafts');
  ok((await put(X, 'draft/world.glb', bytes(512, 8), 'model/gltf-binary')).status === 200, 'PUT draft/world.glb');
  ok((await put(X, 'draft/world.json', JSON.stringify(SAMPLE_WORLD), 'application/json')).status === 200, 'PUT draft/world.json (the sample world, validated)');
  ok((await put(X, 'draft/world.json', '{ not json', 'application/json')).status === 400, 'a draft world.json that isn\'t JSON → 400');
  ok((await put(X, 'draft/world.json', JSON.stringify({ version: 1 }), 'application/json')).status === 400, 'an invalid draft world.json → 400');
  ok((await put(X, 'draft/stills/hall.webp', bytes(100, 9), 'image/webp')).status === 200, 'PUT draft/stills/hall.webp');
  const dr = (await get(X)).files.draft;
  ok(Boolean(dr?.world_url && dr?.model_url), 'files.draft has world_url + model_url');
  const wj = await req('GET', dr.world_url, { auth: '' });
  ok(wj.status === 200 && wj.json?.version === SAMPLE_WORLD.version && wj.headers.get('content-type') === 'application/json', 'the draft world.json opens (application/json)');
  const del = await req('DELETE', `${D}/${X}/file/draft`);
  ok(del.status === 200 && del.data?.deleted === 3, 'DELETE /:id/file/draft removes the 3 draft files', `deleted ${del.data?.deleted}`);
  ok((await get(X)).files.draft === null, 'files.draft is null again');
  ok((await req('GET', dr.model_url, { auth: '' })).status === 404, 'the old draft url → 404');

  // ── delete + purge ───────────────────────────────────────────────────────
  section('soft delete and purge');
  const before = (await get(X)).files;
  const urls = [before.model_url, before.still_url, ...before.stills.map((s) => s.url)];
  ok((await Promise.all(urls.map((u) => req('GET', u, { auth: '' })))).every((r) => r.status === 200), `the ${urls.length} signed urls open before the purge`);
  await req('DELETE', `${D}/${X}`);
  ok(!(await list()).some((r) => r.id === X), 'a soft delete hides it from the list');
  const purge = await req('DELETE', `${D}/${X}?purge=1`);
  ok(purge.status === 200 && purge.data?.purged === true && purge.data?.work === `dream-rooms-work/${X}/`, '?purge=1 → { purged: true, work: dream-rooms-work/<id>/ }');
  ok((await req('GET', `${D}/${X}`)).status === 404, 'after the purge GET /:id → 404');
  const after = await Promise.all(urls.map((u) => req('GET', u, { auth: '' })));
  ok(after.every((r) => r.status === 404 && r.text === NOT_FOUND_BODY), 'the signed urls from before the purge now 404 (nothing left in R2)');
  ok((await req('DELETE', `${D}/${X}?purge=1`)).status === 404, 'purging it again → 404');
}

async function cleanup() {
  section('cleanup');
  let purged = 0;
  for (const id of created) {
    const r = await req('DELETE', `${D}/${id}?purge=1`);
    if (r.status === 200) purged += 1;
  }
  const left = (await list()).filter((r) => created.has(r.id)).length;
  ok(left === 0, `purged every row this check made (${purged} purged)`, `${left} left`);
}

try {
  await main();
} catch (err) {
  ok(false, 'the check ran to the end', err.message.split('\n')[0]);
} finally {
  await cleanup().catch((err) => ok(false, 'cleanup', err.message.split('\n')[0]));
  console.log(`\n${passed} passed, ${failed.length} failed`);
  process.exit(failed.length ? 1 : 0);
}
