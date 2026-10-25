/* ============================================================================
   DL TRICKY TOPICS — each topic's Export PDF, made headlessly and checked
   (puppeteer-core + local Edge, seeded through the portal gate; adapted from
   tools/dl-lecture9-study/pdf.mjs)
   ----------------------------------------------------------------------------
     node tools/dl-tricky-topics/pdf.mjs <outDir> [topicId …] [--pages=1,3,6]

   For each topic in topics/index.js (or the ones named): clicks Export PDF
   with window.print stubbed (a real dialog would hang), prints the page in
   that same print mode with page.pdf (A4, the page's own @page margins),
   runs pdftotext, and checks
     · every step title appears, in order (and the drill)
     · every count printed with a thousands separator is one Keras computed
       (keras-truth.json) or one the topic's own source states
     · no notebook-page text (the Write beat is left out)
   then renders the listed pages with pdftoppm and reports each PDF's page
   count and size. Dev server on 5184 (SITE_URL to override).
   ========================================================================== */
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL, fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../src/components/portal/modules/deep-learning/tricky-topics');
const imp = (p) => import(pathToFileURL(path.join(ROOT, p)).href);
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const BASE = process.env.SITE_URL || 'http://localhost:5184';
const args = process.argv.slice(2);
const flags = Object.fromEntries(args.filter((a) => a.startsWith('--')).map((a) => {
  const [k, v] = a.slice(2).split('=');
  return [k, v ?? true];
}));
const pos = args.filter((a) => !a.startsWith('--'));
const OUT = path.resolve(pos[0] || path.join(HERE, 'out'));
fs.mkdirSync(OUT, { recursive: true });
const { TOPICS } = await imp('topics/index.js');
const only = pos.slice(1);
const list = only.length ? TOPICS.filter((t) => only.includes(t.id)) : TOPICS;

const truth = JSON.parse(fs.readFileSync(path.join(HERE, 'keras-truth.json'), 'utf8'));
const kerasCounts = new Set();
Object.values(truth.models).forEach((m) => {
  [m.trainable, m.nonTrainable, m.trainable + m.nonTrainable].forEach((v) => kerasCounts.add(v));
  m.rows.forEach((r) => { [r.trainable, r.nonTrainable, r.trainable + r.nonTrainable].forEach((v) => kerasCounts.add(v)); r.out.forEach((v) => kerasCounts.add(v)); });
});

// a weight tensor's size (e.g. a kernel's 4,704) is a rule-computed count too
const { MODELS } = await imp('maths/models.js');
const { countModel } = await imp('maths/paramRules.js');
Object.values(MODELS).forEach((m) => countModel(m.model).rows.forEach((r) => r.weights.forEach((w) => kerasCounts.add(w.n))));

const norm = (s) => s.replace(/[“”"‘’']/g, '').replace(/[‐–—−]/g, '-').replace(/\s+/g, ' ').toLowerCase();
const fails = [];
const ok = (cond, label, extra = '') => {
  if (!cond) fails.push(label);
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${extra !== '' ? `  — ${extra}` : ''}`);
};

const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--hide-scrollbars'] });
const msgs = [];
const report = [];
try {
  for (const t of list) {
    const topic = (await imp(`topics/${t.id}/topic.js`)).default;
    const { SHEETS } = await imp(`topics/${t.id}/sheets/index.js`);
    const srcText = fs.readdirSync(path.join(ROOT, 'topics', t.id), { recursive: true })
      .filter((f) => /\.(js|jsx)$/.test(f))
      .map((f) => fs.readFileSync(path.join(ROOT, 'topics', t.id, f), 'utf8'))
      .join('\n');
    const page = await browser.newPage();
    page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warn') msgs.push(`[${t.id}] ${m.type()}: ${m.text()}`); });
    page.on('pageerror', (e) => msgs.push(`[${t.id}] pageerror: ${e.stack || e}`));
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
    await page.evaluateOnNewDocument(() => {
      sessionStorage.setItem('portal_auth', JSON.stringify({ token: 'mock-session-token', key: 'wiggy1', issued_at: new Date().toISOString() }));
      try { localStorage.setItem('portal:theme', 'jade'); } catch { /* ignore */ }
      window.print = () => { window.__printCalls = (window.__printCalls || 0) + 1; };
    });
    await page.goto(`${BASE}/portal/dl-tricky-topics/${t.id}`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('.dltt-sec', { timeout: 30000 });
    await page.evaluate(() => document.querySelector('.dltt-export > .dltt-btn')?.click());
    await page.waitForFunction(() => window.__printCalls === 1, { timeout: 20000 });
    await page.emulateMediaType('print');
    await new Promise((r) => setTimeout(r, 800));
    const file = path.join(OUT, `${t.id}.pdf`);
    await page.pdf({ path: file, format: 'A4', printBackground: true, preferCSSPageSize: true, displayHeaderFooter: false });
    await page.emulateMediaType('screen');
    await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
    await page.close();
    const txtFile = path.join(OUT, `${t.id}.txt`);
    execFileSync('pdftotext', ['-enc', 'UTF-8', '-layout', file, txtFile]);
    const text = fs.readFileSync(txtFile, 'utf8');
    const flat = norm(text);
    const info = execFileSync('pdfinfo', [file]).toString();
    const pages = Number(/Pages:\s+(\d+)/.exec(info)?.[1] ?? 0);
    const size = fs.statSync(file).size;
    report.push(`${t.id}: ${pages} pages · ${(size / 1024 / 1024).toFixed(2)} MB`);

    // every step title, in order, then the drill
    let at = flat.indexOf(norm(topic.title));
    ok(at >= 0, `${t.id}: the PDF opens with the topic title`);
    let inOrder = true;
    const missing = [];
    for (const s of [...topic.steps.map((x) => x.title), topic.drill?.title ?? 'Exam drill']) {
      const key = norm(s).slice(0, 20);
      const i = flat.indexOf(key, Math.max(0, at));
      if (i < 0) { missing.push(s); inOrder = false; } else at = i;
    }
    ok(inOrder, `${t.id}: every step title appears, in order`, missing.join(' | '));
    // counts with thousands separators trace to Keras or to the topic's source
    const nums = [...new Set((text.match(/\b\d{1,3}(?:,\d{3})+\b/g) || []))];
    const loose = nums.filter((n) => !kerasCounts.has(Number(n.replace(/,/g, ''))) && !srcText.includes(n) && !srcText.includes(n.replace(/,/g, '')) && !srcText.includes(n.replace(/,/g, '{,}')));
    ok(loose.length === 0, `${t.id}: every printed count (${nums.length}) matches Keras or the topic’s source`, loose.slice(0, 8).join(', '));
    // no notebook text
    const leaks = ['not on this page', 'tick every line', 'copied', 'fits one page'].filter((w) => flat.includes(w));
    SHEETS.forEach(({ sheet }) => { if (sheet.skip && flat.includes(norm(sheet.skip).slice(0, 40))) leaks.push(`skip: ${sheet.skip.slice(0, 30)}`); });
    ok(leaks.length === 0, `${t.id}: no notebook-page text in the PDF`, leaks.join(', '));
    ok(!/\\(frac|text|mathbf|times|sqrt)/.test(text), `${t.id}: no raw TeX in the PDF text`);
    const want = String(flags.pages || '1,3,6').split(',').map(Number).filter((n) => n >= 1 && n <= pages);
    want.forEach((n) => execFileSync('pdftoppm', ['-png', '-r', '60', '-f', String(n), '-l', String(n), file, path.join(OUT, `${t.id}-page`)]));
  }
} catch (e) {
  ok(false, 'pdf.mjs ran to the end', e.stack);
} finally {
  await browser.close();
}
ok(msgs.length === 0, 'console clean while printing', msgs.slice(0, 4).join(' | '));
console.log(`\n${report.join('\n')}`);
console.log(`\n${fails.length ? `${fails.length} FAILED` : 'ALL PASSED'}`);
process.exit(fails.length ? 1 : 0);
