#!/usr/bin/env node
/* Screenshots of each capture step at 390 px in dark mode (no uploads): a draft is
   written straight into IndexedDB and the page reloads on each step.
     node tools/memory-rooms/dev/capture-dark-shots.mjs */

import { APP, PHONE, check, launch, newPage, presetLogin, shot, sleep, watchConsole } from './lib.mjs';

const results = [];
const logs = [];
let browser = null;

async function setDraft(page, draft) {
  await page.evaluate(async (d) => {
    const db = await new Promise((resolve, reject) => {
      const q = indexedDB.open('memory-rooms', 1);
      q.onupgradeneeded = () => {
        for (const [n, k] of [['outbox', 'id'], ['outboxFiles', 'key'], ['draft', 'key'], ['draftPhotos', 'id']]) q.result.createObjectStore(n, { keyPath: k });
      };
      q.onsuccess = () => resolve(q.result);
      q.onerror = () => reject(q.error);
    });
    await new Promise((resolve) => {
      const t = db.transaction('draft', 'readwrite');
      t.objectStore('draft').put({ key: 'current', ...d });
      t.oncomplete = resolve;
    });
    db.close();
  }, draft);
}

try {
  browser = await launch();
  const page = await newPage(browser, { permissions: ['geolocation'] });
  watchConsole(page, logs, 'dark');
  await presetLogin(page);
  await page.setViewport(PHONE);
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);
  await page.setGeolocation({ latitude: 29.9644, longitude: -90.0577, accuracy: 9 });
  await page.goto(`${APP}/memories/new`, { waitUntil: 'networkidle0' });
  const base = { id: '00000000-0000-4000-8000-000000000001', kind: 'exterior', title: 'Frenchmen Street', note: '', scaleHint: '', scalePreset: null, loc: null, scan: null };
  for (const [step, name] of [[0, 'kind'], [1, 'photos'], [2, 'memory'], [3, 'location']]) {
    await setDraft(page, { ...base, step, note: step >= 2 ? 'Brass band on the corner.' : '', scaleHint: step >= 2 ? 'big building' : '', scalePreset: step >= 2 ? 'big building' : null });
    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForSelector('.mr-capture-body', { timeout: 10000 });
    if (step === 3) {
      await page.click('[data-mr="loc-gps"]');
      await page.waitForSelector('[data-mr="loc-status"][data-source="gps"]', { timeout: 20000 });
      await sleep(1400);
    }
    await shot(page, `cap-390-dark-0${step + 1}-${name}`);
  }
  check(results, true, 'dark capture screenshots saved');
  await page.evaluate(() => indexedDB.deleteDatabase('memory-rooms'));
} catch (err) {
  console.error(err);
  check(results, false, 'script ran to the end', err.message);
} finally {
  await browser?.close().catch(() => {});
  console.log(`\nconsole: ${logs.length ? logs.join('\n') : 'clean'}`);
  process.exitCode = results.some((r) => !r.ok) || logs.length ? 1 : 0;
}
