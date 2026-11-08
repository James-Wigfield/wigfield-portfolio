/* Shared helpers for the capture/map dev checks (puppeteer-core + local Edge). */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

export const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
export const APP = process.env.MR_APP || 'http://127.0.0.1:5191';
export const API = process.env.MR_API || 'http://127.0.0.1:8794';
export const PASSWORD = process.env.MR_PASSWORD || 'trip-local';
export const SCREENS = path.join(REPO, 'memory-rooms-work', '_dev', 'screens');
export const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';

fs.mkdirSync(SCREENS, { recursive: true });

export async function launch() {
  return puppeteer.launch({
    executablePath: EDGE,
    headless: true,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-first-run', '--no-default-browser-check'],
  });
}

export const PHONE = { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
export const DESKTOP = { width: 1440, height: 900, deviceScaleFactor: 1 };

/* Console lines that aren't this app's fault: Vite HMR chatter (other agents edit
   files under the same dev server) and failed module fetches during their edits. */
const NOISE = [/\[vite\]/, /Download the React DevTools/, /Outdated Optimize Dep/];

/**
 * Collects console errors/warnings and page errors. `allow` = regexes for lines a
 * test causes on purpose (e.g. a 401 from a wrong password); they're counted apart.
 */
export function watchConsole(page, bucket, label, { allow = [] } = {}) {
  page.on('console', (m) => {
    const t = m.type();
    if (t !== 'error' && t !== 'warn') return;
    const url = m.location()?.url || '';
    const line = `[${label}] ${t}: ${m.text()}${url ? ` <${url.replace(/^https?:\/\/[^/]+/, '')}>` : ''}`;
    if (NOISE.some((r) => r.test(line))) return;
    if (/Failed to load resource/.test(line) && /<\/src\//.test(line)) return; // a module mid-edit
    if (allow.some((r) => r.test(line))) {
      bucket.expected = (bucket.expected || 0) + 1;
      (bucket.expectedLines ||= []).push(line);
      return;
    }
    bucket.push(line);
  });
  page.on('pageerror', (e) => bucket.push(`[${label}] pageerror: ${e.message}`));
}

/** A fresh, isolated, focused tab (background tabs get no animation frames). */
export async function newPage(browser, { permissions } = {}) {
  const ctx = await browser.createBrowserContext();
  if (permissions) await ctx.overridePermissions(APP, permissions);
  const page = await ctx.newPage();
  await page.bringToFront();
  return page;
}

export async function shot(page, name) {
  await page.evaluate(() => document.fonts.ready).catch(() => {}); // never shoot fallback fonts
  const file = path.join(SCREENS, `${name}.png`);
  await page.screenshot({ path: file });
  return file;
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function api(pathname, { method = 'GET', body } = {}) {
  const res = await fetch(`${API}/api/memories${pathname}`, {
    method,
    headers: { authorization: `Bearer ${PASSWORD}`, ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, data: json?.data, error: json?.error };
}

/** Pre-seeds the gate + who-picker so a page opens straight on the app. */
export async function presetLogin(page, who = 'james') {
  await page.evaluateOnNewDocument(
    (pw, w) => {
      try {
        localStorage.setItem('mr:token', pw);
        localStorage.setItem('mr:who', w);
      } catch {
        /* ignore */
      }
    },
    PASSWORD,
    who,
  );
}

export function check(results, ok, label, detail = '') {
  results.push({ ok: Boolean(ok), label, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  (${detail})` : ''}`);
}
