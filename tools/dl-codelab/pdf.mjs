/* ============================================================================
   DL CODE LAB — make and check the Export PDF headlessly
   (puppeteer-core + local Edge, seeded through the portal gate)
   ----------------------------------------------------------------------------
     node tools/dl-codelab/pdf.mjs <outDir> [--theme=arcade] [--pages=1,2,5]
          [--background]

   Copied from tools/dl-lecture9-study/pdf.mjs. Clicks Export PDF with
   window.print stubbed (a real dialog would hang this unattended run), then
   prints the page in that same print mode with page.pdf — A4, the page's
   own @page margins, and **printBackground off**, as in Chrome's print
   dialog with "Background graphics" left at its default (--background turns
   it on, for comparison). Then it checks the PDF:
     · the page count (≤ 30) and the file size
     · pdftotext: every card label and title, in order; every lab and project
       goal; every label the NotebookLM prompts name, verbatim; every code
       line; and no UI text (the search placeholder, "copy", "Core only")
     · pdfimages -list: exactly one image per code panel
   and renders the listed pages with pdftoppm (page-N.png) to look at.
   Writes <outDir>/codelab.pdf and codelab.txt. Exits 1 on any failure.
   Dev server on 5182 (SITE_URL to override).
   ========================================================================== */
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const BASE = process.env.SITE_URL || 'http://localhost:5182';
const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '../..');
const MOD = path.join(REPO, 'src/components/portal/modules/deep-learning/codelab');
const args = process.argv.slice(2);
const flags = Object.fromEntries(args.filter((a) => a.startsWith('--')).map((a) => {
  const [k, v] = a.slice(2).split('=');
  return [k, v ?? true];
}));
const OUT = path.resolve(args.find((a) => !a.startsWith('--')) || 'pdf-out');
fs.mkdirSync(OUT, { recursive: true });
const theme = flags.theme || 'jade';

const fails = [];
const ok = (cond, label, detail = '') => {
  console.log(`${cond ? 'ok  ' : 'FAIL'} ${label}${detail ? ` · ${detail}` : ''}`);
  if (!cond) fails.push(label);
};

const imp = (f) => import(pathToFileURL(path.join(MOD, f)).href);

const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--hide-scrollbars'] });
const msgs = [];
let file;
try {
  const page = await browser.newPage();
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warn') msgs.push(`${m.type()}: ${m.text()}`); });
  page.on('pageerror', (e) => msgs.push(`pageerror: ${e.stack || e}`));
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await page.evaluateOnNewDocument((t) => {
    sessionStorage.setItem('portal_auth', JSON.stringify({ token: 'mock-session-token', key: 'wiggy1', issued_at: new Date().toISOString() }));
    try { localStorage.setItem('portal:theme', t); } catch { /* ignore */ }
    window.print = () => { window.__printCalls = (window.__printCalls || 0) + 1; };
  }, theme);
  await page.goto(`${BASE}/portal/dl-code-lab`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('.dlc-sec', { timeout: 30000 });
  await page.evaluate(() => [...document.querySelectorAll('.dlc-export button')].find((b) => /Export PDF/.test(b.textContent))?.click());
  await page.waitForFunction(() => window.__printCalls === 1, { timeout: 30000 });
  const state = await page.evaluate(() => ({
    title: document.title,
    cls: document.documentElement.className,
    panels: document.querySelectorAll('.dlc-codewrap').length,
    imgs: document.querySelectorAll('.dlc-pimg__img').length,
    secs: document.querySelectorAll('.dlc-sec').length,
  }));
  console.log(`print() called · ${JSON.stringify(state)}`);
  await page.emulateMediaType('print');
  await new Promise((r) => setTimeout(r, 600));
  file = path.join(OUT, 'codelab.pdf');
  await page.pdf({ path: file, format: 'A4', printBackground: !!flags.background, preferCSSPageSize: true, displayHeaderFooter: false });
  await page.emulateMediaType('screen');
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  await new Promise((r) => setTimeout(r, 400));
  const after = await page.evaluate(() => ({ cls: document.documentElement.className, imgs: document.querySelectorAll('.dlc-pimg__img').length, secs: document.querySelectorAll('.dlc-sec').length, title: document.title }));
  ok(!/dlc-printing/.test(after.cls) && after.imgs === 0 && after.secs === 1, 'afterprint restores the page', JSON.stringify(after));
  ok(state.imgs === state.panels && state.panels > 0, 'every code panel has its print image', `${state.imgs}/${state.panels}`);
} catch (e) {
  ok(false, `export ran: ${e.message}`);
} finally {
  await browser.close();
}

if (file && fs.existsSync(file)) {
  const size = fs.statSync(file).size;
  const txtFile = path.join(OUT, 'codelab.txt');
  execFileSync('pdftotext', ['-enc', 'UTF-8', file, txtFile]);
  const raw = fs.readFileSync(txtFile, 'utf8');
  const text = raw.replace(/\s+/g, ' ');
  const info = execFileSync('pdfinfo', [file]).toString();
  const pages = Number(/Pages:\s+(\d+)/.exec(info)?.[1] ?? 0);
  console.log(`saved ${file} · ${pages} pages · ${(size / 1024).toFixed(0)} KB`);
  ok(pages > 0 && pages <= 30, 'the PDF is at most 30 A4 pages', `${pages} pages`);
  ok(size < 12 * 1024 * 1024, 'the PDF is under 12 MB', `${(size / 1024 / 1024).toFixed(2)} MB`);

  const { CARDS, fullLabel } = await imp('cards/index.js');
  const { LAB_PANELS } = await imp('labsProjects.js');
  const { NLM_PROMPT, NLM_PARTS } = await imp('exportPrompt.js');
  const norm = (s) => s.replace(/\s+/g, ' ').trim();

  // every card label + title, in order (after the cover's contents list)
  const body = text.slice(text.indexOf('Card 1.1 ·', text.indexOf('Contents') + 1 + text.indexOf('Card 1.1 ·')));
  let at = 0;
  const missing = [];
  CARDS.forEach((c) => {
    const k = body.indexOf(norm(fullLabel(c)), at);
    if (k < 0) missing.push(fullLabel(c));
    else at = k;
  });
  ok(!missing.length, 'every card label and title is in the PDF, in order', missing.slice(0, 3).join(' | '));
  const tocMissing = CARDS.filter((c) => !text.includes(norm(fullLabel(c))));
  ok(!tocMissing.length, 'the cover lists every card', tocMissing.length ? tocMissing[0].id : `${CARDS.length} cards`);
  // pdftotext joins words hyphenated at a line end ("anti-" + "clockwise")
  const squash = (s) => s.replace(/[\s­-]+/g, '');
  const flat = squash(text);
  const goals = LAB_PANELS.filter((lp) => !flat.includes(squash(lp.goal.replace(/`/g, ''))));
  ok(!goals.length, 'every lab and project goal is printed', goals.map((g) => g.id).join(', '));
  const named = [...new Set([NLM_PROMPT, ...NLM_PARTS.map((p) => p.text)].flatMap((p) => [...p.matchAll(/Card \d+\.\d+ · [^;.:]+?(?=[;.:])/g)].map((m) => m[0])))];
  const notIn = named.filter((n) => !text.includes(norm(n)));
  ok(!notIn.length, 'every card the NotebookLM prompts name is in the PDF verbatim', notIn.length ? notIn.join(' | ') : `${named.length} names`);
  // every code line (whitespace-normalised) is in the text layer
  // (whitespace ignored: pdftotext drops or adds spaces in monospace runs)
  const flatRaw = raw.replace(/\s+/g, '');
  const lost = [];
  CARDS.forEach((c) => c.code.split('\n').forEach((ln) => {
    const t = ln.replace(/\s+/g, '');
    if (t && !flatRaw.includes(t)) lost.push(`${c.id}: ${ln.trim()}`);
  }));
  ok(!lost.length, 'every code line is in the PDF text', lost.length ? `${lost.length} lost, e.g. ${lost.slice(0, 2).join(' | ')}` : `${CARDS.reduce((s, c) => s + c.code.split('\n').length, 0)} lines`);
  const ui = ['Search every tab', 'Core only', 'copy', 'NotebookLM video prompt', 'Export PDF'].filter((u) => new RegExp(`\\b${u}\\b`).test(text));
  ok(!ui.length, 'no UI text in the PDF', ui.join(', '));

  // one image per panel
  const list = execFileSync('pdfimages', ['-list', file]).toString().split('\n').slice(2).filter((l) => l.trim());
  const images = list.filter((l) => /\simage\s/.test(l));
  const smasks = list.filter((l) => /\ssmask\s/.test(l));
  ok(images.length === CARDS.length, 'pdfimages lists one image per code panel', `${images.length} images (${smasks.length} smasks) for ${CARDS.length} panels`);
  if (images[0]) console.log(`  first image: ${images[0].trim().replace(/\s+/g, ' ')}`);

  const want = String(flags.pages || '1,2,3').split(',').map(Number).filter((n) => n >= 1 && n <= pages);
  want.forEach((n) => execFileSync('pdftoppm', ['-png', '-r', '80', '-f', String(n), '-l', String(n), file, path.join(OUT, 'page')]));
  console.log(`rendered pages ${want.join(', ')}`);
}

const noise = msgs.filter((m) => !/Download the React DevTools/.test(m));
ok(noise.length === 0, 'no console errors or warnings', noise.slice(0, 4).join(' || '));
console.log(`\n${fails.length ? `${fails.length} FAILED` : 'ALL PASS'}  (${OUT})`);
process.exit(fails.length ? 1 : 0);
