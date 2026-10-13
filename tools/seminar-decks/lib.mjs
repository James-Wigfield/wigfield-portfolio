// Shared helpers for the seminar-decks tools (puppeteer-core + the local Chrome).
// The portal's mock sign-in lives in sessionStorage; every page is seeded with it
// before load, as tools/psma-motion/capture.mjs does.
import puppeteer from 'puppeteer-core';

export const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
export const BASE = process.env.SD_BASE || 'http://localhost:5179';
export const SLUGS = ['one-scan', 'verdict', 'context'];

export async function openBrowser({ width = 1920, height = 1080, headless = 'new' } = {}) {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless,
    protocolTimeout: 600000,
    args: ['--force-color-profile=srgb', '--hide-scrollbars', '--mute-audio', '--autoplay-policy=no-user-gesture-required'],
    defaultViewport: { width, height, deviceScaleFactor: 1 },
  });
  return browser;
}

export async function newPage(browser, { width = 1920, height = 1080, log = [] } = {}) {
  const page = await browser.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
  page.on('console', (m) => {
    if (['error', 'warn'].includes(m.type())) log.push(`[${m.type()}] ${m.text()}`);
  });
  page.on('pageerror', (e) => log.push(`[pageerror] ${e.message}`));
  page.on('requestfailed', (r) => {
    const u = r.url();
    if (!u.includes('__missing__')) log.push(`[requestfailed] ${u} ${r.failure()?.errorText ?? ''}`);
  });
  await page.evaluateOnNewDocument(() => {
    sessionStorage.setItem('portal_auth', JSON.stringify({ token: 'tool', key: 'tool', issued_at: new Date().toISOString() }));
  });
  return page;
}

export async function gotoRender(page, slug, id, { step, fit = false, mode } = {}) {
  const q = new URLSearchParams();
  if (step !== undefined) q.set('step', String(step));
  if (fit) q.set('fit', '1');
  if (mode) q.set('mode', mode);
  const url = `${BASE}/portal/seminar-decks/${slug}/render/${id}${q.toString() ? `?${q}` : ''}`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForSelector('.sd-render[data-ready="1"]', { timeout: 120000 });
}

export async function gatesData(page) {
  await page.goto(`${BASE}/portal/seminar-decks/__gates`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(() => window.__sdGates, { timeout: 120000 });
  return page.evaluate(() => window.__sdGates);
}
