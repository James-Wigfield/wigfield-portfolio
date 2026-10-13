// Seminar decks gates. Needs the dev server (npx vite --port 5179) or set SD_BASE
// (for example SD_BASE=http://localhost:8787 for `npm run cf:dev`).
//   node tools/seminar-decks/gates.mjs [--deck one-scan] [--gates G1,G2,G3,G4,G5,G7] [--out file.json] [--shots dir]
// G1 numbers   every digit on a slide (each build step), transcript or crib traces to a manifest key
//              ([data-k] / {{key}}) or an allow-listed name (H1-H4, 2x2, 3D, run N, Case A/B, years, data-tick)
// G2 budgets   12-13 main slides; titles <= 12 words; <= 5 bullets and ~35 body words per slide;
//              transcripts 1,750-1,950 words, 13:30-14:30 with unnarrated clip time; backups 40-90 words
// G3 render    every slide at 1920x1080 and 1280x720 (fitted): nothing outside the canvas, no clipped
//              text boxes, no console errors
// G4 legible   title >= 64 px, body >= 36, chart >= 28, foot >= 20 (canvas px); contrast >= 4.5:1,
//              >= 3:1 for text >= 24 px, against the nearest opaque background (text over images: manual)
// G5 media     every media file answers 200/206; a missing clip falls back to its hold frame
// G7 required  logo on every main slide, exact title, supervisors, rail, attribution on scan slides,
//              citations where cited, research question, limitations, future work, references backup
import fs from 'node:fs';
import path from 'node:path';
import { BASE, gatesData, gotoRender, newPage, openBrowser, SLUGS } from './lib.mjs';

const args = process.argv.slice(2);
const opt = (k, d) => {
  const i = args.indexOf(k);
  return i >= 0 ? args[i + 1] : d;
};
const decksWanted = (opt('--deck', SLUGS.join(','))).split(',');
const gatesWanted = new Set((opt('--gates', 'G1,G2,G3,G4,G5,G7')).split(','));
const outFile = opt('--out', null);
const shotsDir = opt('--shots', null);

const TITLE = 'Segmenting Metastatic Prostate Cancer in Whole-Body PET Scans with a Hybrid CNN-Mamba Network';
const ALLOW = [/\bF1\b/g, /CC BY 4\.0/g, /\b(?:18F|68Ga|177Lu)\b/g, /\bMamba-[12]\b/g, /\bH[1-4]\b/g, /\b2x2\b/g, /\b3D\b/g, /\b[Rr]uns? [1-6](?:(?:,| to| and) [1-6])*\b/g, /\b(?:19|20)\d\d\b/g, /\bB\d{1,2}\b/g, /\b[1-6]\b(?= to [1-6]\b)/g, /\bfold [0-4]\b/gi, /\bT[1-9]\b/g];
const stripAllowed = (s) => ALLOW.reduce((a, re) => a.replace(re, ' '), s);
const report = { base: BASE, when: new Date().toISOString(), decks: {}, crib: null, summary: [] };
const fail = (deck, gate, msg) => {
  report.decks[deck] ??= {};
  (report.decks[deck][gate] ??= { fail: [], warn: [] }).fail.push(msg);
};
const warn = (deck, gate, msg) => {
  report.decks[deck] ??= {};
  (report.decks[deck][gate] ??= { fail: [], warn: [] }).warn.push(msg);
};
const ok = (deck, gate) => {
  report.decks[deck] ??= {};
  report.decks[deck][gate] ??= { fail: [], warn: [] };
};

const words = (s) => String(s).split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w)).length;

// DOM probe run inside the page for one rendered slide.
function probe() {
  const canvas = document.querySelector('.sd-render__canvas');
  const slideEl = canvas.querySelector('.sd-slide');
  const cr = canvas.getBoundingClientRect();
  const scale = cr.width / 1920;
  const out = { digits: [], keys: [], sizes: [], overflow: [], contrast: [], bullets: 0, bodyWords: 0, req: [], images: 0, clips: 0, title: '' };
  const parse = (c) => {
    const m = c.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(',').map((x) => parseFloat(x));
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  const lum = ({ r, g, b }) => {
    const f = (v) => {
      const x = v / 255;
      return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const ratio = (a, b) => {
    const l1 = lum(a);
    const l2 = lum(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  };
  const groundCol = parse(getComputedStyle(slideEl).backgroundColor) || { r: 0, g: 0, b: 0, a: 1 };
  const bgOf = (el) => {
    let e = el;
    let overImage = false;
    while (e && e !== canvas) {
      const st = getComputedStyle(e);
      const c = parse(st.backgroundColor);
      if (c && c.a > 0.85) return { col: c, overImage };
      if (st.backgroundImage && st.backgroundImage !== 'none') overImage = true;
      // a sibling image or video drawn beneath this element's box
      if (e.parentElement && [...e.parentElement.children].some((s) => s !== e && (s.matches('img,video,.sd-clip,canvas,.sd-exhibit') || s.querySelector?.('img,video')))) {
        const er = e.getBoundingClientRect();
        overImage = overImage || [...e.parentElement.querySelectorAll(':scope > img, :scope > video, :scope > .sd-clip, :scope > .sd-exhibit')].some((s) => {
          const r = s.getBoundingClientRect();
          return r.left < er.right && r.right > er.left && r.top < er.bottom && r.bottom > er.top;
        });
      }
      e = e.parentElement;
    }
    return { col: groundCol, overImage };
  };
  out.title = canvas.querySelector('[data-role="title"]')?.textContent?.trim() ?? '';
  canvas.querySelectorAll('[data-req]').forEach((e) => out.req.push(e.getAttribute('data-req')));
  out.images = canvas.querySelectorAll('img').length;
  out.clips = canvas.querySelectorAll('.sd-clip').length;
  canvas.querySelectorAll('[data-k]').forEach((e) => out.keys.push({ k: e.getAttribute('data-k'), text: e.textContent }));
  canvas.querySelectorAll('li[data-role="body"]').forEach(() => { out.bullets += 1; });
  const seenBody = new Set();
  canvas.querySelectorAll('[data-role="body"]').forEach((e) => {
    if ([...seenBody].some((p) => p.contains(e))) return;
    seenBody.add(e);
    if (e.closest('[data-role="title"]')) return;
    out.bodyWords += (e.textContent || '').split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w)).length;
  });
  // Text nodes: digits and sizes.
  const walker = document.createTreeWalker(canvas, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = walker.nextNode())) {
    const t = n.textContent;
    if (!t || !t.trim()) continue;
    const el = n.parentElement;
    if (!el) continue;
    const st = getComputedStyle(el);
    if (st.visibility === 'hidden' || st.display === 'none' || parseFloat(st.opacity) === 0) continue;
    let hidden = false;
    for (let e = el; e && e !== canvas; e = e.parentElement) {
      const s2 = getComputedStyle(e);
      if (s2.display === 'none' || s2.visibility === 'hidden' || parseFloat(s2.opacity) < 0.05) { hidden = true; break; }
    }
    if (hidden) continue;
    const bound = el.closest('[data-k],[data-tick]');
    if (/\d/.test(t) && !bound) out.digits.push(t.trim());
    const roleEl = el.closest('[data-role]');
    const role = roleEl ? roleEl.getAttribute('data-role') : 'none';
    // Effective size on the canvas: computed size times any transform scale between the
    // element and the canvas (camera zooms), measured from rendered against layout height.
    let local = 1;
    if (el instanceof HTMLElement && el.offsetHeight > 0) local = el.getBoundingClientRect().height / el.offsetHeight / scale;
    if (Math.abs(local - 1) < 0.03) local = 1; // offsetHeight is rounded to whole pixels
    const size = parseFloat(st.fontSize) * (local > 0.05 && local < 20 ? local : 1);
    out.sizes.push({ role, size: Number(size.toFixed(1)), text: t.trim().slice(0, 50) });
    const fg = parse(el instanceof SVGElement ? st.fill : st.color) || parse(st.color);
    const { col, overImage } = bgOf(el);
    if (fg) {
      const r = ratio(fg, col);
      const large = size >= 24;
      if (overImage) out.contrast.push({ manual: true, text: t.trim().slice(0, 50), r: Number(r.toFixed(2)) });
      else if (r < (large ? 3 : 4.5)) out.contrast.push({ text: t.trim().slice(0, 50), r: Number(r.toFixed(2)), size, fg: st.color, bg: `rgb(${col.r},${col.g},${col.b})` });
    }
  }
  // Overflow: boxes outside the canvas, clipped text boxes.
  canvas.querySelectorAll('.sd-slide *').forEach((e) => {
    if (e.closest('[data-bleed]') || e.closest('.sd-clip') || e.closest('.sd-thumb')) return;
    const r = e.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const st = getComputedStyle(e);
    if (st.visibility === 'hidden' || st.display === 'none') return;
    const tol = 2 * scale;
    if (r.left < cr.left - tol || r.top < cr.top - tol || r.right > cr.right + tol || r.bottom > cr.bottom + tol) {
      if (e.textContent && e.textContent.trim() && !(e instanceof SVGElement && !(e instanceof SVGTextElement))) {
        out.overflow.push(`outside canvas: <${e.tagName.toLowerCase()} class="${e.className?.baseVal ?? e.className}"> "${e.textContent.trim().slice(0, 40)}"`);
      }
    }
    if (['hidden', 'clip'].includes(st.overflow) || ['hidden', 'clip'].includes(st.overflowX) || ['hidden', 'clip'].includes(st.overflowY)) {
      if (e.scrollWidth > e.clientWidth + 2 || e.scrollHeight > e.clientHeight + 2) {
        if (e.textContent && e.textContent.trim() && !e.matches('.sd-slide, .sd-frame, .sd-exhibit__crop, .sd-thumb')) {
          out.overflow.push(`clipped: <${e.tagName.toLowerCase()} class="${e.className?.baseVal ?? e.className}"> ${e.scrollWidth}x${e.scrollHeight} > ${e.clientWidth}x${e.clientHeight}`);
        }
      }
    }
  });
  return out;
}

const browser = await openBrowser();
const log = [];
const page = await newPage(browser, { log });
const G = await gatesData(page);
const facts = G.facts;

for (const slug of decksWanted) {
  const deck = G.decks.find((d) => d.slug === slug);
  if (!deck) {
    fail(slug, 'load', 'deck not found');
    continue;
  }
  report.decks[slug] = report.decks[slug] ?? {};
  report.decks[slug].totals = deck.totals;

  // ── G2 from the summary ─────────────────────────────────────────────────
  if (gatesWanted.has('G2')) {
    ok(slug, 'G2');
    const main = deck.slides.filter((s) => s.kind === 'main');
    if (main.length < 12 || main.length > 13) fail(slug, 'G2', `main slides ${main.length} (want 12-13)`);
    main.forEach((s) => {
      if (s.titleWords > 12) fail(slug, 'G2', `slide ${s.label} title has ${s.titleWords} words: "${s.titleFilled}"`);
      if (!s.scriptRaw) fail(slug, 'G2', `slide ${s.label} has no transcript`);
      const spoken = (s.words / 135) * 60 + s.silent;
      if (s.target && Math.abs(spoken - s.target) > Math.max(12, s.target * 0.25)) warn(slug, 'G2', `slide ${s.label}: transcript ${spoken.toFixed(0)} s against target ${s.target} s`);
      if (!/\[\[cut\]\]/.test(s.scriptRaw) && s.label !== '1') warn(slug, 'G2', `slide ${s.label}: no (cut if behind) sentence`);
      const long = s.spoken.split(/(?<=[.!?])\s+/).filter((x) => words(x) > 25);
      long.forEach((x) => fail(slug, 'G2', `slide ${s.label}: sentence over 25 words: "${x.slice(0, 90)}..."`));
    });
    const W = deck.totals.words;
    const T = deck.totals.spokenSeconds;
    if (W < 1750 || W > 1950) fail(slug, 'G2', `transcript words ${W} (want 1,750-1,950)`);
    if (T < 810 || T > 870) fail(slug, 'G2', `talk time ${(T / 60).toFixed(2)} min = ${Math.round(T)} s (want 810-870 s)`);
    if (deck.totals.targetSeconds < 810 || deck.totals.targetSeconds > 870) fail(slug, 'G2', `target total ${deck.totals.targetSeconds} s (want 810-870)`);
    deck.slides.filter((s) => s.kind === 'backup' && s.id !== 'b-refs').forEach((s) => {
      if (s.words < 40 || s.words > 90) fail(slug, 'G2', `backup ${s.label} transcript ${s.words} words (want 40-90)`);
    });
    const banned = /\b(let'?s dive in|journey|without further ado|in today'?s world|moreover|furthermore|additionally|in conclusion|in summary|it'?s important to note|it'?s worth noting|notably|delve|landscape|realm|game-changer|cutting-edge|groundbreaking|revolutioni[sz]e|unlock|harness|leverage|seamless|robust|crucial|pivotal|showcase|paves the way|promising|state-of-the-art|state of the art)\b/i;
    deck.slides.forEach((s) => {
      const m = (s.spoken + ' ' + s.titleFilled).match(banned);
      if (m) fail(slug, 'G2', `slide ${s.label}: banned word "${m[0]}"`);
      if (/[^\x00-\x7F]/.test(s.scriptRaw.replace(/·/g, '') + s.title.replace(/·/g, ''))) fail(slug, 'G2', `slide ${s.label}: non-ASCII character in title or transcript`);
      if (/\bnot just\b[^.]*\bbut\b/i.test(s.spoken)) warn(slug, 'G2', `slide ${s.label}: "not just X but Y" pattern`);
    });
  }

  // ── G1 transcripts ──────────────────────────────────────────────────────
  if (gatesWanted.has('G1')) {
    ok(slug, 'G1');
    deck.slides.forEach((s) => {
      const raw = (s.scriptRaw + ' ' + s.title + ' ' + (s.cues || []).join(' ')).replace(/\{\{[\w.]+\}\}/g, ' ');
      const left = stripAllowed(raw);
      const m = left.match(/\d[\d.,]*/g);
      if (m) fail(slug, 'G1', `slide ${s.label} transcript/title/cues: unbound digits ${JSON.stringify(m)}`);
      const keys = [...(s.scriptRaw + s.title).matchAll(/\{\{([\w.]+)\}\}/g)].map((x) => x[1]);
      keys.forEach((k) => {
        if (!facts[k]) fail(slug, 'G1', `slide ${s.label}: unknown key {{${k}}}`);
      });
    });
  }

  // ── DOM gates per slide and step ────────────────────────────────────────
  if (['G1', 'G2', 'G3', 'G4', 'G7'].some((g) => gatesWanted.has(g))) {
    ['G1', 'G2', 'G3', 'G4', 'G7'].forEach((g) => { if (gatesWanted.has(g)) ok(slug, g); });
    const viewports = gatesWanted.has('G3') ? [[1920, 1080], [1280, 720]] : [[1920, 1080]];
    for (const [vw, vh] of viewports) {
      const p = await newPage(browser, { width: vw, height: vh, log });
      for (const s of deck.slides) {
        const stepsToCheck = vw === 1920 ? [...Array(s.steps).keys()] : [s.steps - 1];
        for (const step of stepsToCheck) {
          log.length = 0;
          await gotoRender(p, slug, s.id, { step, fit: true });
          const r = await p.evaluate(probe);
          const where = `slide ${s.label} step ${step + 1}/${s.steps} @${vw}`;
          if (vw === 1920) {
            if (gatesWanted.has('G1')) {
              stripAllowed(r.digits.join(' | ')).match(/\d[\d.,]*/g)?.length && fail(slug, 'G1', `${where}: unbound digits on screen: ${JSON.stringify(r.digits.filter((d) => /\d/.test(stripAllowed(d))))}`);
              r.keys.forEach(({ k, text }) => {
                if (!facts[k]) fail(slug, 'G1', `${where}: unknown data-k ${k}`);
                else if (text.trim() !== facts[k].display && !text.includes(facts[k].display)) warn(slug, 'G1', `${where}: ${k} shows "${text}" (manifest "${facts[k].display}")`);
              });
            }
            if (gatesWanted.has('G2') && step === s.steps - 1 && s.kind === 'main') {
              if (r.bullets > 5) fail(slug, 'G2', `${where}: ${r.bullets} bullets`);
              if (r.bodyWords > 45) fail(slug, 'G2', `${where}: ${r.bodyWords} words of body text (want about 35)`);
              else if (r.bodyWords > 35) warn(slug, 'G2', `${where}: ${r.bodyWords} words of body text`);
            }
            if (gatesWanted.has('G4')) {
              const min = { title: 64, body: 36, chart: 28, foot: 20, none: 20 };
              r.sizes.forEach((z) => {
                if (z.size + 0.01 < (min[z.role] ?? 20)) fail(slug, 'G4', `${where}: ${z.role} text ${z.size}px "${z.text}"`);
              });
              r.contrast.forEach((c) => {
                if (c.manual) warn(slug, 'G4', `${where}: text over an image, check by eye: "${c.text}"`);
                else fail(slug, 'G4', `${where}: contrast ${c.r}:1 at ${c.size}px "${c.text}" (${c.fg} on ${c.bg})`);
              });
            }
            if (gatesWanted.has('G7') && step === s.steps - 1) {
              const req = new Set(r.req);
              if (s.kind === 'main' && !req.has('logo')) fail(slug, 'G7', `${where}: no logo`);
              if (s.kind === 'main' && s.part && !req.has('rail')) fail(slug, 'G7', `${where}: no progress rail`);
              if (s.scans && !req.has('attribution')) fail(slug, 'G7', `${where}: shows scans but no data attribution`);
              if ((r.clips > 0) && !s.scans) warn(slug, 'G7', `${where}: has a clip but slide.scans is not set`);
              if (s.cites.length && !req.has('cites') && s.id !== 'b-refs') fail(slug, 'G7', `${where}: cites ${s.cites.join(', ')} but shows no citation line`);
              report.decks[slug].reqSeen = report.decks[slug].reqSeen ?? {};
              r.req.forEach((x) => { report.decks[slug].reqSeen[x] = (report.decks[slug].reqSeen[x] ?? 0) + 1; });
              if (s.label === '1') {
                const titleOk = (await p.evaluate(() => document.querySelector('.sd-render__canvas [data-req="title"]')?.textContent?.replace(/\s+/g, ' ').trim())) === TITLE;
                if (!titleOk) fail(slug, 'G7', 'title slide: the exact published title is not found in [data-req="title"]');
                if (!req.has('supervisors')) fail(slug, 'G7', 'title slide: no supervisors line');
              }
            }
            if (shotsDir && step === s.steps - 1) {
              fs.mkdirSync(shotsDir, { recursive: true });
              await p.screenshot({ path: path.join(shotsDir, `${slug}-${String(s.label).padStart(2, '0')}.png`) });
            }
          }
          if (gatesWanted.has('G3')) {
            r.overflow.forEach((o) => fail(slug, 'G3', `${where}: ${o}`));
            log.filter((l) => !/favicon|DevTools|Download the React/.test(l)).forEach((l) => fail(slug, 'G3', `${where}: console ${l.slice(0, 200)}`));
          }
        }
      }
      await p.close();
    }
    if (gatesWanted.has('G7')) {
      const seen = report.decks[slug].reqSeen ?? {};
      ['rq', 'limitations', 'future', 'references'].forEach((x) => {
        if (!seen[x]) fail(slug, 'G7', `no element marked data-req="${x}" anywhere in the deck`);
      });
      if (!deck.slides.some((s) => s.id === 'b-refs')) fail(slug, 'G7', 'no references backup slide');
    }
  }

  // ── G5 media ────────────────────────────────────────────────────────────
  if (gatesWanted.has('G5')) {
    ok(slug, 'G5');
    const paths = new Set(deck.media);
    [...paths].forEach((m) => { if (m.endsWith('.mp4')) paths.add(m.replace(/\.mp4$/, '.png')); });
    for (const m of paths) {
      const st = await page.evaluate(async (u) => {
        const r = await fetch(u, { headers: { Range: 'bytes=0-99' } });
        return { status: r.status, type: r.headers.get('content-type') };
      }, `${BASE}/seminar-decks/${m}`);
      if (![200, 206].includes(st.status)) fail(slug, 'G5', `${m}: HTTP ${st.status}`);
      if (/text\/html/.test(st.type ?? '')) fail(slug, 'G5', `${m}: served as HTML (missing file falls back to index.html)`);
    }
    // Forced failure: the first clip slide in present mode must show its hold frame.
    const clipSlide = deck.slides.find((s) => s.media.some((m) => m.endsWith('.mp4')) && s.kind === 'main');
    if (clipSlide) {
      const p = await newPage(browser, { log });
      await p.goto(`${BASE}/portal/seminar-decks/${slug}/${clipSlide.label}?failclips=1`, { waitUntil: 'domcontentloaded' });
      await new Promise((r) => setTimeout(r, 4000));
      const holds = await p.evaluate(() => [...document.querySelectorAll('.sd-present__slot.is-current .sd-clip')].map((c) => c.getAttribute('data-clip-state')));
      if (!holds.length) warn(slug, 'G5', `forced failure: no clip found on slide ${clipSlide.label}`);
      else if (holds.some((h) => h !== 'hold')) fail(slug, 'G5', `forced failure on slide ${clipSlide.label}: clip states ${holds.join(',')} (want hold)`);
      await p.close();
    }
  }
}

// ── Crib (G1) ───────────────────────────────────────────────────────────────
if (gatesWanted.has('G1')) {
  const bad = [];
  G.crib.forEach((c) => {
    const left = stripAllowed(`${c.q} ${c.a}`.replace(/\{\{[\w.]+\}\}/g, ' '));
    const m = left.match(/\d[\d.,]*/g);
    if (m) bad.push(`${c.id}: unbound digits ${JSON.stringify(m)}`);
    [...`${c.q} ${c.a}`.matchAll(/\{\{([\w.]+)\}\}/g)].forEach((x) => { if (!facts[x[1]]) bad.push(`${c.id}: unknown key ${x[1]}`); });
  });
  G.hypotheses.forEach((h) => {
    const m = stripAllowed(h.line.replace(/\{\{[\w.]+\}\}/g, ' ')).match(/\d[\d.,]*/g);
    if (m) bad.push(`hypothesis ${h.id}: unbound digits ${JSON.stringify(m)}`);
  });
  report.crib = { count: G.crib.length, fail: bad };
}

await browser.close();

let failures = 0;
for (const [slug, d] of Object.entries(report.decks)) {
  for (const [g, r] of Object.entries(d)) {
    if (!r || !Array.isArray(r.fail)) continue;
    failures += r.fail.length;
    report.summary.push(`${slug} ${g}: ${r.fail.length ? `FAIL ${r.fail.length}` : 'PASS'}${r.warn.length ? ` (warn ${r.warn.length})` : ''}`);
  }
}
if (report.crib) {
  failures += report.crib.fail.length;
  report.summary.push(`crib G1: ${report.crib.fail.length ? `FAIL ${report.crib.fail.length}` : 'PASS'} (${report.crib.count} entries)`);
}
if (outFile) fs.writeFileSync(outFile, JSON.stringify(report, null, 2));
console.log(report.summary.join('\n'));
for (const [slug, d] of Object.entries(report.decks)) {
  for (const [g, r] of Object.entries(d)) {
    if (!r || !Array.isArray(r.fail)) continue;
    r.fail.slice(0, 40).forEach((m) => console.log(`  FAIL ${slug} ${g} ${m}`));
    r.warn.slice(0, 25).forEach((m) => console.log(`  warn ${slug} ${g} ${m}`));
  }
}
if (report.crib) report.crib.fail.forEach((m) => console.log(`  FAIL crib ${m}`));
process.exitCode = failures ? 1 : 0;
