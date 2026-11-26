// Live check of the desktop app's update route.
//   node tools/specta-selecta/route-check.mjs https://jameswigfield.com
//   node tools/specta-selecta/route-check.mjs http://127.0.0.1:8788
// The key comes from $SPECTA_UPDATE_KEY, else from .dev.vars. It is never printed.
// Exit 0 = pass, 1 = fail, 2 = waiting on SPECTA_GITHUB_TOKEN (route answers 503).
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const base = (process.argv[2] || '').replace(/\/+$/, '');
if (!/^https?:\/\//.test(base)) {
  console.error('usage: node tools/specta-selecta/route-check.mjs <base url>');
  process.exit(1);
}

function readKey() {
  if (process.env.SPECTA_UPDATE_KEY) return { key: process.env.SPECTA_UPDATE_KEY.trim(), from: '$SPECTA_UPDATE_KEY' };
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const file = path.join(root, '.dev.vars');
  if (existsSync(file)) {
    const line = readFileSync(file, 'utf8').split(/\r?\n/).find((l) => /^\s*SPECTA_UPDATE_KEY\s*=/.test(l));
    if (line) return { key: line.split('=').slice(1).join('=').trim().replace(/^["']|["']$/g, ''), from: '.dev.vars' };
  }
  return { key: '', from: null };
}

const { key, from } = readKey();
if (!key) {
  console.error('No key: set SPECTA_UPDATE_KEY or add it to .dev.vars.');
  process.exit(1);
}
const redact = (s) => String(s).split(key).join('<key>');

const route = `${base}/api/specta-selecta/update/latest.json`;
const assetPrefix = `${base}/api/specta-selecta/update/asset/`;
let failed = 0;
let waiting = false;
const pass = (msg) => console.log(`  ok    ${msg}`);
const fail = (msg) => { failed++; console.log(`  FAIL  ${redact(msg)}`); };

console.log(`Update route check · ${base} · key from ${from}`);

// Reads the whole body every time: leaving bodies unread on Windows trips a
// libuv assertion when the process exits.
async function get(url, auth) {
  const res = await fetch(url, { headers: auth ? { authorization: `Bearer ${auth}` } : {}, redirect: 'manual' });
  const text = await res.text();
  return { status: res.status, headers: res.headers, text: async () => text, json: async () => JSON.parse(text) };
}

try {
  const none = await get(route);
  none.status === 401 ? pass('no key → 401') : fail(`no key → ${none.status} (want 401)`);

  const wrong = await get(route, 'not-the-key');
  wrong.status === 401 ? pass('wrong key → 401') : fail(`wrong key → ${wrong.status} (want 401)`);

  const res = await get(`${route}?target=darwin&arch=aarch64&current=0.0.0`, key);
  const cache = res.headers.get('cache-control') || '';
  if (res.status === 204) {
    pass('right key → 204 (no published release yet, or it has no latest.json)');
  } else if (res.status === 200) {
    pass('right key → 200');
    cache.includes('no-store') ? pass('Cache-Control: no-store') : fail(`Cache-Control is "${cache}"`);
    const body = await res.json();
    const platforms = Object.entries(body.platforms || {});
    platforms.length ? pass(`version ${body.version} · ${platforms.length} platforms: ${platforms.map(([k]) => k).join(', ')}`) : fail('no platforms in latest.json');
    const re = new RegExp(`^${assetPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\d+$`);
    const bad = platforms.filter(([, p]) => !re.test(p.url));
    bad.length ? fail(`not rewritten: ${bad.map(([k]) => k).join(', ')}`) : pass('every url points at the asset route');
    const unsigned = platforms.filter(([, p]) => !p.signature);
    unsigned.length ? fail(`no signature: ${unsigned.map(([k]) => k).join(', ')}`) : pass('every platform has a signature');

    if (platforms.length) {
      const [name, first] = platforms[0];
      const noKey = await get(first.url);
      noKey.status === 401 ? pass('asset without key → 401') : fail(`asset without key → ${noKey.status}`);
      const a = await get(first.url, key);
      const loc = a.headers.get('location') || '';
      let host = '';
      try { host = new URL(loc).hostname; } catch { /* no location */ }
      if (a.status === 302 && /(^|\.)github(usercontent)?\.com$/.test(host)) pass(`asset (${name}) → 302 to ${host}`);
      else fail(`asset (${name}) → ${a.status} ${host || '(no GitHub Location)'}`);
    }
  } else if (res.status === 503) {
    const text = await res.text();
    if (/SPECTA_GITHUB_TOKEN/.test(text)) {
      waiting = true;
      console.log(`  wait  right key → 503: ${redact(text)}`);
    } else {
      fail(`right key → 503: ${text}`);
    }
  } else {
    fail(`right key → ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
} catch (e) {
  fail(`request failed: ${e.message}`);
}

let code = 0;
if (failed) {
  console.log(`\n${failed} check(s) failed.`);
  code = 1;
} else {
  console.log(waiting ? '\nAuth works; waiting on SPECTA_GITHUB_TOKEN.' : '\nAll checks passed.');
  code = waiting ? 2 : 0;
}
// Exit on a short timer: letting Node 24 wind down on its own with fetch's
// keep-alive sockets open trips a libuv assertion on Windows (exit 127).
setTimeout(() => process.exit(code), 50);
