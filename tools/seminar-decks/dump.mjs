// Dump each deck as text for the critics: per slide, the title, the visible text at every build step,
// the cues and the transcript with numbers filled in; then the crib.
//   node tools/seminar-decks/dump.mjs <outdir> [--deck one-scan]
import fs from 'node:fs';
import path from 'node:path';
import { gatesData, gotoRender, newPage, openBrowser, SLUGS } from './lib.mjs';

const [, , outDir, flag, val] = process.argv;
const decks = flag === '--deck' ? val.split(',') : SLUGS;
fs.mkdirSync(outDir, { recursive: true });
const browser = await openBrowser();
const page = await newPage(browser);
const G = await gatesData(page);
const fill = (s) => String(s ?? '').replace(/\{\{([\w.]+)\}\}/g, (_, k) => G.facts[k]?.display ?? `??${k}??`);

for (const slug of decks) {
  const d = G.decks.find((x) => x.slug === slug);
  const lines = [`# ${d.name} (${slug})`, '', `Main slides ${d.totals.mainCount}, backups ${d.totals.backupCount}; ${d.totals.words} words; spoken ${(d.totals.spokenSeconds / 60).toFixed(2)} min incl. ${Math.round(d.totals.silentSeconds)} s unnarrated clip; target ${(d.totals.targetSeconds / 60).toFixed(2)} min`, ''];
  for (const s of d.slides) {
    lines.push(`## ${s.kind === 'backup' ? 'Backup' : 'Slide'} ${s.label} (${s.id})${s.part ? ` [${s.part}]` : ''}`);
    lines.push(`Title: ${s.titleFilled}`);
    if (s.kind === 'main') lines.push(`Target ${s.target} s; ${s.words} words; spoken ${((s.words / 135) * 60 + s.silent).toFixed(0)} s (silent ${s.silent}); cites: ${s.cites.join(', ') || 'none'}; scans: ${s.scans}`);
    for (let step = 0; step < s.steps; step += 1) {
      await gotoRender(page, slug, s.id, { step });
      const text = await page.evaluate(() => {
        const c = document.querySelector('.sd-render__canvas');
        const out = [];
        const w = document.createTreeWalker(c, NodeFilter.SHOW_TEXT);
        let n;
        while ((n = w.nextNode())) {
          const t = n.textContent.replace(/\s+/g, ' ').trim();
          if (!t) continue;
          let e = n.parentElement;
          let hidden = false;
          for (; e && e !== c; e = e.parentElement) {
            const st = getComputedStyle(e);
            if (st.display === 'none' || st.visibility === 'hidden' || parseFloat(st.opacity) < 0.05) { hidden = true; break; }
          }
          if (!hidden) out.push(t);
        }
        return out.join(' | ');
      });
      lines.push(`On screen, build ${step + 1}/${s.steps}: ${text}`);
    }
    if (s.cues?.length) lines.push(`Cues: ${s.cues.map(fill).join(' / ')}`);
    lines.push('', `Transcript: ${fill(s.scriptRaw)}`, '');
  }
  fs.writeFileSync(path.join(outDir, `dump-${slug}.md`), lines.join('\n'));
  console.log(`${slug}: ${d.slides.length} slides`);
}
const crib = ['# Q&A crib (shared)', ''];
G.crib.forEach((c) => crib.push(`- **${c.qFilled}** ${c.aFilled}${c.backup ? ` (backup ${c.backup})` : ''}${c.note ? ` NOTE: ${c.note}` : ''}`));
crib.push('', '# Hypothesis lines', '');
G.hypotheses.forEach((h) => crib.push(`- ${h.id} ${h.name}: ${h.lineFilled} (verdict ${h.verdict})`));
fs.writeFileSync(path.join(outDir, 'dump-crib.md'), crib.join('\n'));
await browser.close();
