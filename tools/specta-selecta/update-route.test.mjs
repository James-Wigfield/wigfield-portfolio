// Unit tests for workers/specta-selecta.js: the latest.json rewrite, the key
// check, and the routes end to end against a fake GitHub (fetch is stubbed).
//   node --test tools/specta-selecta/
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  assetKind,
  rewriteLatestJson,
  urlsAllRewritten,
  bearerMatches,
  timingSafeEqualStrings,
  isAssetId,
  mapRelease,
  handleSpectaSelectaApi,
  ASSET_ROUTE,
} from '../../workers/specta-selecta.js';

const FIXTURE = JSON.parse(readFileSync(new URL('./fixtures/latest.json', import.meta.url), 'utf8'));
const ORIGIN = 'https://example.test';
const DL = 'https://github.com/James-Wigfield/specta-selecta/releases/download/v0.1.0/';
const ASSETS = [
  { id: 101, name: 'Specta.Selecta_aarch64.app.tar.gz', size: 9_000_000, browser_download_url: `${DL}Specta.Selecta_aarch64.app.tar.gz` },
  { id: 102, name: 'Specta.Selecta_aarch64.app.tar.gz.sig', size: 400, browser_download_url: `${DL}Specta.Selecta_aarch64.app.tar.gz.sig` },
  { id: 103, name: 'Specta.Selecta_0.1.0_aarch64.dmg', size: 10_000_000, browser_download_url: `${DL}Specta.Selecta_0.1.0_aarch64.dmg` },
  { id: 104, name: 'Specta.Selecta_0.1.0_x64-setup.exe', size: 6_000_000, browser_download_url: `${DL}Specta.Selecta_0.1.0_x64-setup.exe` },
  { id: 105, name: 'Specta.Selecta_0.1.0_x64-setup.exe.sig', size: 400, browser_download_url: `${DL}Specta.Selecta_0.1.0_x64-setup.exe.sig` },
  { id: 106, name: 'latest.json', size: 1200, browser_download_url: `${DL}latest.json` },
];

// ── pure helpers ─────────────────────────────────────────────────────────────

test('assetKind names every file type', () => {
  assert.equal(assetKind('Specta.Selecta_0.1.0_aarch64.dmg'), 'mac-dmg');
  assert.equal(assetKind('Specta.Selecta_aarch64.app.tar.gz'), 'mac-update');
  assert.equal(assetKind('Specta.Selecta_0.1.0_x64-setup.exe'), 'win-installer');
  assert.equal(assetKind('Specta.Selecta_aarch64.app.tar.gz.sig'), 'signature');
  assert.equal(assetKind('latest.json'), 'latest-json');
  assert.equal(assetKind('Specta.Selecta_0.1.0_x64_en-US.msi'), 'other');
});

test('rewrite points every platform at the asset route and leaves the rest alone', () => {
  const { manifest, unmatched } = rewriteLatestJson(FIXTURE, ORIGIN, ASSETS);
  assert.deepEqual(unmatched, []);
  assert.deepEqual(Object.keys(manifest.platforms), ['darwin-aarch64', 'darwin-aarch64-app', 'windows-x86_64', 'windows-x86_64-nsis']);
  assert.equal(manifest.platforms['darwin-aarch64'].url, `${ORIGIN}${ASSET_ROUTE}101`);
  assert.equal(manifest.platforms['darwin-aarch64-app'].url, `${ORIGIN}${ASSET_ROUTE}101`);
  assert.equal(manifest.platforms['windows-x86_64'].url, `${ORIGIN}${ASSET_ROUTE}104`);
  assert.equal(manifest.platforms['windows-x86_64-nsis'].url, `${ORIGIN}${ASSET_ROUTE}104`);
  for (const [k, v] of Object.entries(manifest.platforms)) {
    assert.equal(v.signature, FIXTURE.platforms[k].signature, `${k} signature untouched`);
  }
  assert.equal(manifest.version, FIXTURE.version);
  assert.equal(manifest.notes, FIXTURE.notes);
  assert.equal(manifest.pub_date, FIXTURE.pub_date);
  assert.ok(urlsAllRewritten(manifest, ORIGIN));
  // The fixture itself is not mutated.
  assert.ok(FIXTURE.platforms['darwin-aarch64'].url.startsWith('https://github.com/'));
});

test('rewrite falls back to the file name, and drops platforms whose file is missing', () => {
  const assets = ASSETS.map(({ browser_download_url: _drop, ...a }) => a);
  const m = structuredClone(FIXTURE);
  m.platforms['linux-x86_64'] = { signature: 'x', url: `${DL}missing.AppImage` };
  const { manifest, unmatched } = rewriteLatestJson(m, ORIGIN, assets);
  assert.equal(manifest.platforms['darwin-aarch64'].url, `${ORIGIN}${ASSET_ROUTE}101`);
  assert.deepEqual(unmatched, ['linux-x86_64']);
  assert.equal(manifest.platforms['linux-x86_64'], undefined);
});

test('urlsAllRewritten rejects a GitHub url', () => {
  assert.equal(urlsAllRewritten(FIXTURE, ORIGIN), false);
});

test('isAssetId takes numbers only', () => {
  assert.ok(isAssetId('123456'));
  assert.ok(!isAssetId('12a'));
  assert.ok(!isAssetId('../x'));
  assert.ok(!isAssetId(''));
});

test('bearer check: right key passes, wrong / missing / other scheme fail', async () => {
  const key = 'a'.repeat(64);
  const req = (h) => new Request('https://x.test/', { headers: h ? { authorization: h } : {} });
  assert.equal(await bearerMatches(req(`Bearer ${key}`), key), true);
  assert.equal(await bearerMatches(req(`bearer ${key}`), key), true);
  assert.equal(await bearerMatches(req(`Bearer ${key}x`), key), false);
  assert.equal(await bearerMatches(req('Bearer short'), key), false);
  assert.equal(await bearerMatches(req(`Basic ${key}`), key), false);
  assert.equal(await bearerMatches(req(null), key), false);
  assert.equal(await bearerMatches(req(`Bearer ${key}`), ''), false);
  assert.equal(await timingSafeEqualStrings('abc', 'abc'), true);
  assert.equal(await timingSafeEqualStrings('abc', 'abd'), false);
});

test('mapRelease shapes a release for the page', () => {
  const r = mapRelease({ tag_name: 'v0.1.0', published_at: '2026-11-26T10:00:00Z', body: 'Notes', assets: ASSETS });
  assert.equal(r.version, '0.1.0');
  assert.equal(r.tag, 'v0.1.0');
  assert.equal(r.assets.find((a) => a.id === 103).kind, 'mac-dmg');
  assert.deepEqual(Object.keys(r.assets[0]).sort(), ['id', 'kind', 'name', 'size']);
});

// ── routes against a fake GitHub ─────────────────────────────────────────────

const KEY = 'k'.repeat(64);
const TOKEN = 'ghp_fake';
const PORTAL = 'portal-pass';
const SIGNED = (id) => `https://objects.githubusercontent.com/signed/${id}?sig=abc`;
let realFetch;
let calls;
let gh; // { latest: release | null, list: [...], fail: false }

function fakeGitHub(input, init = {}) {
  const url = typeof input === 'string' ? input : input.url;
  const headers = new Headers(init.headers || {});
  calls.push({ url, headers });
  const api = 'https://api.github.com/repos/James-Wigfield/specta-selecta';
  const jsonRes = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json' } });
  if (url.startsWith(api)) {
    assert.equal(headers.get('authorization'), `Bearer ${TOKEN}`);
    assert.ok(headers.get('user-agent'), 'GitHub needs a User-Agent');
    assert.equal(headers.get('x-github-api-version'), '2022-11-28');
    if (gh.fail) return jsonRes({ message: 'Bad credentials' }, 401);
    const path = url.slice(api.length);
    if (path === '/releases/latest') return gh.latest ? jsonRes(gh.latest) : jsonRes({ message: 'Not Found' }, 404);
    if (path.startsWith('/releases?')) return jsonRes(gh.list);
    const m = /^\/releases\/assets\/(\d+)$/.exec(path);
    if (m) {
      assert.equal(headers.get('accept'), 'application/octet-stream');
      assert.equal(init.redirect, 'manual');
      if (!ASSETS.some((a) => String(a.id) === m[1])) return jsonRes({ message: 'Not Found' }, 404);
      return new Response(null, { status: 302, headers: { location: SIGNED(m[1]) } });
    }
  }
  if (url === SIGNED(106)) {
    assert.equal(headers.get('authorization'), null, 'signed URL is fetched without the token');
    return jsonRes(FIXTURE);
  }
  throw new Error(`unexpected fetch ${url}`);
}

const release = (over = {}) => ({ tag_name: 'v0.1.0', published_at: '2026-11-26T10:00:00Z', body: 'First release.', draft: false, prerelease: false, assets: ASSETS, ...over });
const env = (over = {}) => ({ SPECTA_UPDATE_KEY: KEY, SPECTA_GITHUB_TOKEN: TOKEN, PORTAL_PASSWORD: PORTAL, ...over });
const helpers = {
  requirePortalAuth(request, e) {
    if (!e.PORTAL_PASSWORD) return new Response('{}', { status: 503 });
    const p = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    return p === e.PORTAL_PASSWORD ? null : new Response('{"error":"Unauthorized"}', { status: 401 });
  },
  json: (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json' } }),
};
function call(path, { method = 'GET', auth, e = env() } = {}) {
  const url = new URL(`${ORIGIN}/api/specta-selecta/${path}`);
  const req = new Request(url, { method, headers: auth ? { authorization: `Bearer ${auth}` } : {} });
  return handleSpectaSelectaApi(req, e, url, helpers);
}

beforeEach(() => {
  realFetch = globalThis.fetch;
  globalThis.fetch = async (i, init) => fakeGitHub(i, init);
  calls = [];
  gh = { latest: release(), list: [release(), release({ tag_name: 'v0.2.0-beta', prerelease: true }), release({ tag_name: 'v0.0.9', draft: true })], fail: false };
});
afterEach(() => { globalThis.fetch = realFetch; });

test('latest.json: 401 without a key or with a wrong key, before touching GitHub', async () => {
  assert.equal((await call('update/latest.json')).status, 401);
  assert.equal((await call('update/latest.json', { auth: 'wrong' })).status, 401);
  assert.equal(calls.length, 0);
});

test('latest.json: 503 when either secret is unset', async () => {
  assert.equal((await call('update/latest.json', { auth: KEY, e: env({ SPECTA_UPDATE_KEY: undefined }) })).status, 503);
  assert.equal((await call('update/latest.json', { auth: KEY, e: env({ SPECTA_GITHUB_TOKEN: undefined }) })).status, 503);
});

test('latest.json: 200 with rewritten urls, untouched signatures, no-store', async () => {
  const res = await call('update/latest.json?target=darwin&arch=aarch64&current=0.0.1', { auth: KEY });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('cache-control'), 'no-store');
  const body = await res.json();
  assert.equal(body.version, '0.1.0');
  assert.ok(urlsAllRewritten(body, ORIGIN));
  assert.equal(body.platforms['darwin-aarch64'].signature, FIXTURE.platforms['darwin-aarch64'].signature);
});

test('latest.json: 204 with no published release, or no latest.json in it', async () => {
  gh.latest = null;
  assert.equal((await call('update/latest.json', { auth: KEY })).status, 204);
  gh.latest = release({ assets: ASSETS.filter((a) => a.name !== 'latest.json') });
  assert.equal((await call('update/latest.json', { auth: KEY })).status, 204);
});

test('latest.json: 502 with a reason when GitHub errors', async () => {
  gh.fail = true;
  const res = await call('update/latest.json', { auth: KEY });
  assert.equal(res.status, 502);
  assert.match(await res.text(), /401 Bad credentials/);
});

test('asset: 302 to the signed URL; 401 without key; 400 for a non-numeric id; 404 unknown', async () => {
  const ok = await call('update/asset/101', { auth: KEY });
  assert.equal(ok.status, 302);
  assert.equal(ok.headers.get('location'), SIGNED('101'));
  assert.equal((await call('update/asset/101')).status, 401);
  assert.equal((await call('update/asset/abc', { auth: KEY })).status, 400);
  assert.equal((await call('update/asset/999', { auth: KEY })).status, 404);
});

test('status: portal password required; lists published releases only', async () => {
  assert.equal((await call('status')).status, 401);
  assert.equal((await call('status', { auth: KEY })).status, 401, 'the update key is not the portal password');
  const body = await (await call('status', { auth: PORTAL })).json();
  assert.deepEqual(body.configured, { updateKey: true, githubToken: true });
  assert.equal(body.github.ok, true);
  assert.deepEqual(body.releases.map((r) => r.tag), ['v0.1.0']);
});

test('status: reports a missing token without calling GitHub', async () => {
  const body = await (await call('status', { auth: PORTAL, e: env({ SPECTA_GITHUB_TOKEN: undefined }) })).json();
  assert.deepEqual(body.configured, { updateKey: true, githubToken: false });
  assert.equal(body.github.ok, false);
  assert.deepEqual(body.releases, []);
  assert.equal(calls.length, 0);
});

test('download: POST + portal password → { url }', async () => {
  assert.equal((await call('download/103', { method: 'POST' })).status, 401);
  assert.equal((await call('download/103', { method: 'GET', auth: PORTAL })).status, 405);
  const body = await (await call('download/103', { method: 'POST', auth: PORTAL })).json();
  assert.equal(body.url, SIGNED('103'));
});

test('test-update: runs the route server-side and reports', async () => {
  const body = await (await call('test-update', { method: 'POST', auth: PORTAL })).json();
  assert.equal(body.status, 200);
  assert.equal(body.version, '0.1.0');
  assert.deepEqual(body.platforms, ['darwin-aarch64', 'darwin-aarch64-app', 'windows-x86_64', 'windows-x86_64-nsis']);
  assert.equal(body.rewrittenOk, true);
  assert.equal(body.refusesNoKey, true);
  assert.ok(!JSON.stringify(body).includes(KEY), 'never returns the key');
  gh.latest = null;
  const empty = await (await call('test-update', { method: 'POST', auth: PORTAL })).json();
  assert.equal(empty.status, 204);
});
