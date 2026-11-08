#!/usr/bin/env node
/* Production-build check of the offline shell (public/memories-sw.js):
     1. serve a build with `vite preview` (API proxied to the dev Worker), open /memories once online
     2. stop the server ("no signal"), open /memories/new: it must load from the service worker
     3. capture a spot with no server at all → it waits in the outbox
     4. start the server again → the outbox uploads it.

   Build first (never into dist/, other processes use it):
     npx vite build --outDir C:/Users/james/AppData/Local/Temp/mr-build-c1
   then: node tools/memory-rooms/dev/offline-shell-check.mjs [--dir <build dir>] [--port 5196] */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { API, PASSWORD, PHONE, REPO, api, check, launch, newPage, shot, sleep, watchConsole } from './lib.mjs';

const args = process.argv.slice(2);
const arg = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const DIR = arg('--dir', 'C:/Users/james/AppData/Local/Temp/mr-build-c1');
const PORT = Number(arg('--port', 5196));
const APP = `http://127.0.0.1:${PORT}`;
const PHOTOS = path.join(REPO, 'memory-rooms-work', '_dev', 'test-photos');

const results = [];
const logs = [];
let server = null;
let browser = null;

function serve() {
  return new Promise((resolve, reject) => {
    const vite = path.join(REPO, 'node_modules', 'vite', 'bin', 'vite.js');
    server = spawn(process.execPath, [vite, 'preview', '--outDir', DIR, '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], {
      cwd: REPO,
      env: { ...process.env, API_PROXY: API },
    });
    const timer = setTimeout(() => reject(new Error('vite preview did not start')), 30000);
    const onData = (d) => {
      const text = String(d).replace(/\u001b\[[0-9;]*m/g, ''); // strip colours
      if (/127\.0\.0\.1:\d+/.test(text)) {
        clearTimeout(timer);
        resolve();
      }
    };
    server.stdout.on('data', onData);
    server.stderr.on('data', onData);
  });
}

async function stop() {
  if (!server) return;
  const proc = server;
  server = null;
  if (proc.exitCode === null && proc.signalCode === null) {
    const exited = new Promise((r) => proc.once('exit', r));
    proc.kill();
    await Promise.race([exited, sleep(5000)]);
  }
  await sleep(500);
}

async function main() {
  if (!fs.existsSync(path.join(DIR, 'memories-sw.js'))) throw new Error(`no build with memories-sw.js in ${DIR}`);
  await serve();
  browser = await launch();
  const page = await newPage(browser);
  watchConsole(page, logs, 'offline', { allow: [/ERR_CONNECTION_REFUSED/, /ERR_INTERNET_DISCONNECTED/, /ERR_FAILED/, /status of 50[0-4]/] });
  await page.evaluateOnNewDocument(
    (pw) => {
      try {
        localStorage.setItem('mr:token', pw);
        localStorage.setItem('mr:who', 'justin');
      } catch {
        /* an error page has no storage */
      }
    },
    PASSWORD,
  );
  await page.setViewport(PHONE);

  // 1. one online visit
  await page.goto(`${APP}/memories`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('[data-mr="map"]', { timeout: 20000 });
  const controlled = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    await new Promise((r) => setTimeout(r, 1500)); // let the precache message finish
    const keys = await caches.keys();
    const cache = keys.length ? await caches.open(keys[0]) : null;
    const entries = cache ? (await cache.keys()).map((r) => new URL(r.url).pathname) : [];
    return { scope: reg.scope, entries };
  });
  check(results, controlled.scope.endsWith('/memories') && controlled.entries.includes('/memories') && controlled.entries.some((p) => p.startsWith('/assets/')), 'service worker installed with the shell + assets cached', `${controlled.scope} · ${controlled.entries.length} cached`);

  // 2. no server at all
  await stop();
  const sw = await page.evaluate(async () => ({
    controller: Boolean(navigator.serviceWorker.controller),
    shell: Boolean(await caches.match('/memories')),
  }));
  console.log('before offline navigation:', JSON.stringify(sw));
  await page.goto(`${APP}/memories/new`, { waitUntil: 'domcontentloaded' });
  console.log('landed on', page.url(), await page.title());
  await page.waitForSelector('[data-mr="kind-exterior"]', { timeout: 20000 });
  check(results, true, '/memories/new opens with the server gone');
  await shot(page, 'offline-390-new');

  // 3. capture with no signal
  await page.click('[data-mr="kind-exterior"]');
  const title = `No-signal test ${Date.now().toString(36)}`;
  await page.type('[data-mr="title-input"]', title);
  await page.click('[data-mr="next"]');
  const files = fs.readdirSync(PHOTOS).filter((f) => f.endsWith('.jpg')).slice(0, 4).map((f) => path.join(PHOTOS, f));
  await (await page.waitForSelector('[data-mr="library-input"]')).uploadFile(...files);
  await page.waitForFunction(() => document.querySelectorAll('[data-mr="photo-thumb"]').length === 4, { timeout: 60000 });
  await page.waitForFunction(() => !document.querySelector('.mr-processing'));
  await page.click('[data-mr="next"]');
  await page.type('[data-mr="note-input"]', 'Captured in a dead zone.');
  await page.click('[data-mr="next"]');
  await page.type('[data-mr="loc-place-input"]', '30.25, -87.70');
  await page.waitForSelector('[data-mr="place-suggestion"]');
  await page.click('[data-mr="place-suggestion"]');
  await page.click('[data-mr="save"]');
  const saved = await page.waitForSelector('[data-mr="saved"]', { timeout: 20000 });
  const id = await saved.evaluate((el) => el.dataset.id);
  await page.waitForSelector('[data-mr="outbox"][data-pending="1"]', { timeout: 10000 });
  check(results, true, 'saved into the outbox with no server', id);
  await shot(page, 'offline-390-saved');

  // 4. signal back
  await serve();
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await page.waitForSelector('[data-mr="outbox"][data-pending="0"]', { timeout: 90000 });
  const got = await api(`/spots/${id}`);
  const m = got.data?.media || [];
  check(results, got.status === 200 && m.filter((x) => x.type === 'photo').length === 4, 'uploaded once the server is back', `${got.data?.title} · ${got.data?.placeLabel}`);
  await api(`/spots/${id}`, { method: 'DELETE' });
  await browser.close();
}

try {
  await main();
} catch (err) {
  console.error(err);
  check(results, false, 'script ran to the end', err.message);
} finally {
  await browser?.close().catch(() => {});
  await stop();
  if (process.env.MR_DEBUG) console.log((logs.expectedLines || []).join('\n'));
  console.log(`\nconsole: ${logs.length ? logs.join('\n') : 'clean'} (${logs.expected || 0} expected network errors)`);
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  process.exitCode = failed || logs.length ? 1 : 0;
}
