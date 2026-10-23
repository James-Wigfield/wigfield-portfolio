/* Quick screenshot of an arcade route (dev server on 5173, seeded through the gate):
     node tools/dl-arcade/shot.mjs <route> <out.png> [theme] [width] [--click=selector] [--wait=ms]
   e.g. node tools/dl-arcade/shot.mjs /portal/dl-arcade hub.png arcade 390 */
import puppeteer from 'puppeteer-core';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const BASE = process.env.SITE_URL || 'http://localhost:5173';
const [route = '/portal/dl-arcade', out = 'shot.png', theme = 'jade', widthArg = '1440', ...rest] = process.argv.slice(2);
const width = Number(widthArg);
const clicks = rest.filter((a) => a.startsWith('--click=')).map((a) => a.slice(8));
const wait = Number(rest.find((a) => a.startsWith('--wait='))?.slice(7) ?? 800);
const keys = rest.filter((a) => a.startsWith('--key=')).map((a) => a.slice(6));
const full = !rest.includes('--viewport');

const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--hide-scrollbars'] });
const page = await browser.newPage();
const msgs = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warn') msgs.push(`${m.type()}: ${m.text()}`); });
page.on('pageerror', (e) => msgs.push(`pageerror: ${e}`));
await page.setViewport({ width, height: 900, deviceScaleFactor: 1 });
await page.evaluateOnNewDocument((t) => {
  sessionStorage.setItem('portal_auth', JSON.stringify({ token: 'mock-session-token', key: 'wiggy1', issued_at: new Date().toISOString() }));
  try { localStorage.setItem('portal:theme', t); } catch { /* */ }
  window.print = () => {};
}, theme);
await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle0' });
const mounted = await page.waitForSelector('.dla', { timeout: 20000 }).then(() => true).catch(() => false);
if (!mounted) {
  const body = await page.evaluate(() => document.body.innerText.slice(0, 400));
  console.log(`NOT MOUNTED (.dla missing). console: ${msgs.join(' || ').slice(0, 1500)}
body: ${body}`);
}
await new Promise((r) => setTimeout(r, wait));
for (const sel of clicks) {
  await page.click(sel).catch((e) => msgs.push(`click failed ${sel}: ${e.message}`));
  await new Promise((r) => setTimeout(r, 500));
}
const keyGap = Number(rest.find((a) => a.startsWith('--gap='))?.slice(6) ?? 200);
for (const k of keys) { await page.keyboard.press(k); await new Promise((r) => setTimeout(r, keyGap)); }
await new Promise((r) => setTimeout(r, 300));
if (rest.includes('--el')) {
  const el = await page.$('.dla');
  if (el) await el.screenshot({ path: out });
  else await page.screenshot({ path: out, fullPage: full });
} else await page.screenshot({ path: out, fullPage: full });
const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const text = await page.$eval('.dla', (el) => el.innerText.slice(0, 600)).catch(() => '');
console.log(`saved ${out} · overflow ${overflow}px · ${msgs.length} console issues${msgs.length ? '\n  ' + msgs.slice(0, 8).join('\n  ') : ''}`);
console.log(text.replace(/\n+/g, ' | ').slice(0, 500));
await browser.close();
