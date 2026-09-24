/* ============================================================================
   RSVP PAPERS — unit checks for the pure engine (timeline.js + mdTable.js)
   ----------------------------------------------------------------------------
     node tools/rsvp/timeline-check.mjs
   No framework in this repo; PASS/FAIL lines + a non-zero exit on failure.
   ========================================================================== */
import {
  orpIndex, coreOf, isSymbolic, isNumber, wordFactor, tokenize, splitSentences,
  buildTimeline, itemDuration, prevSentence, nextSentence, sentenceStart,
  paragraphRange, headingTrail, minutesLeft, sectionOf,
} from '../../src/components/portal/modules/paper-reader/timeline.js';
import { parseMarkdownTable, isNumericCell } from '../../src/components/portal/modules/paper-reader/mdTable.js';

const fails = [];
const ok = (cond, label, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${extra !== '' ? '  — ' + extra : ''}`);
  if (!cond) fails.push(label);
};
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), label, JSON.stringify(a) === JSON.stringify(b) ? '' : `got ${JSON.stringify(a)} want ${JSON.stringify(b)}`);

console.log('--- tokens / ORP ---');
eq(coreOf('(recognition),'), 'recognition', 'coreOf strips wrapping punctuation');
eq(orpIndex('a'), 0, 'orp 1-letter');
eq(orpIndex('the'), 1, 'orp 3-letter → 1');
eq(orpIndex('model'), 1, 'orp 5-letter → 1');
eq(orpIndex('memory'), 2, 'orp 6-letter → 2');
eq(orpIndex('recognition'), 3, 'orp 11-letter → 3');
eq(orpIndex('segmentation,'), 3, 'orp ignores trailing comma');
eq(orpIndex('(Transformer)'), 1 + 3, 'orp shifts past leading paren');
eq(orpIndex('Δ'), 0, 'orp single symbol');
eq(orpIndex('—'), 0, 'orp bare dash');

console.log('--- classification ---');
ok(isSymbolic('O(BLDN)'), 'O(BLDN) symbolic');
ok(isSymbolic('Δ'), 'Greek symbolic');
ok(isSymbolic('2^20'), 'caret symbolic');
ok(isSymbolic('x∈ℝ^d'), 'unicode math symbolic');
ok(isSymbolic('T1Gd'), 'mixed letters+digits symbolic');
ok(isSymbolic('h_t'), 'subscript underscore symbolic');
ok(!isSymbolic('Transformer'), 'plain word not symbolic');
ok(!isSymbolic('3D'), '"3D" not symbolic (common unit-ish suffix)');
ok(!isSymbolic('1st'), '"1st" not symbolic');
ok(isNumber('0.8361'), 'decimal is number');
ok(isNumber('2021'), 'year is number');
ok(isNumber('12.7%'), 'percent is number');
ok(isNumber('1e-4'), 'sci notation is number');
ok(!isNumber('A100'), 'A100 not a plain number');

console.log('--- factors ---');
const plain = wordFactor('model').f;
ok(plain === 1, 'plain 5-letter word factor 1', String(plain));
ok(wordFactor('the').f < plain, 'short words faster');
ok(wordFactor('representation').f > 1.4, 'long word slower', String(wordFactor('representation').f));
ok(wordFactor('O(BLDN)').f > 1.5, 'symbolic slower', String(wordFactor('O(BLDN)').f));
ok(wordFactor('0.8361').f > 1.3, 'number slower', String(wordFactor('0.8361').f));
ok(wordFactor('model,').f === plain + 0.5, 'comma adds 0.5');
ok(wordFactor('model.', { sEnd: true }).f === plain + 1.0, 'sentence end adds 1.0');
ok(wordFactor('model.', { sEnd: true, pEnd: true }).f === plain + 1.8, 'paragraph end adds 1.8 total');
ok(Math.abs(wordFactor('model', { key: true }).f - 1.3) < 1e-9, 'key ×1.3');
ok(wordFactor('CNNs').f > plain, 'acronym slower');
ok(wordFactor('the', { liFirst: true }).f > wordFactor('the').f, 'bullet first word gets a breath');

console.log('--- tokenize / sentences ---');
eq(tokenize('  a  b\tc\n d '), ['a', 'b', 'c', 'd'], 'tokenize whitespace');
eq(tokenize('representation—the'), ['representation—', 'the'], 'long em-dash token split');
eq(tokenize('state-of-the-art'), ['state-of-the-art'], 'hyphenated stays whole');
eq(tokenize('encoder—decoder'), ['encoder—', 'decoder'], 'em-dash split >12 chars');
eq(tokenize('U-Net'), ['U-Net'], 'short hyphen stays');
const s1 = splitSentences('We train for 200 epochs. The model uses Adam. Results improve by 1.3 points.');
eq(s1.length, 3, 'three plain sentences');
const s2 = splitSentences('Fig. 2 shows the result vs. baseline, e.g. UNet. It is faster.');
eq(s2.length, 2, 'abbreviations do not end sentences', JSON.stringify(s2.map((s) => s.join(' '))));
const s3 = splitSentences('Dice reached 0.84. 5-fold cross validation was used.');
eq(s3.length, 2, 'decimal inside token + digit-start next sentence');
const s4 = splitSentences('Proposed by J. Smith and A. Gu in 2024. Then adopted widely.');
eq(s4.length, 2, 'initials do not split');
const s5 = splitSentences('Is it fast? Yes! Very ("really") fast.');
eq(s5.length, 3, '? and ! and quotes');
const s6 = splitSentences('Long-range dependencies (see Section 3.2) matter. More here.');
eq(s6.length, 2, 'section number decimal not a boundary');

console.log('--- build ---');
const sections = [
  { heading: 'Abstract', level: 1, part: 'main', blocks: [
    { type: 'text', text: 'We propose a model. It is fast and accurate.' },
    { type: 'text', text: 'Our model halves memory.', key: true },
  ] },
  { heading: '2 Method', level: 1, part: 'main', blocks: [
    { type: 'list', items: ['First bullet here.', 'Second bullet with Δ symbol.'] },
    { type: 'figure', label: 'Figure 1', caption: 'The architecture overview in one picture.' },
    { type: 'text', text: 'Then we describe the details of the block.' },
  ] },
  { heading: '2.1 Encoder', level: 2, part: 'main', blocks: [{ type: 'text', text: 'Encoder text.' }] },
  { heading: 'A Extra proofs', level: 1, part: 'appendix', blocks: [
    { type: 'equation', label: 'Eq. 7', caption: 'The recurrence.', content: 'h_t = A h_{t-1} + B x_t' },
    { type: 'text', text: 'Appendix words here now.' },
  ] },
];
const tl = buildTimeline(sections);
const kinds = tl.items.map((i) => i.t).join('');
ok(kinds.startsWith('h'), 'timeline starts with a heading card');
ok(kinds.endsWith('e'), 'timeline ends with the end marker');
ok(tl.hasAppendix && tl.mainEnd > 0 && tl.items[tl.mainEnd].t === 'm', 'end-of-main marker before the appendix');
ok(tl.items[tl.mainEnd + 1].t === 'h' && tl.items[tl.mainEnd + 1].part === 'appendix', 'appendix heading follows the marker');
eq(tl.sections.length, 4, 'four sections');
eq(tl.sections[3].part, 'appendix', 'appendix flagged');
const words = tl.items.filter((i) => i.t === 'w');
eq(words.length, 4 + 5 + 4 + 3 + 5 + 8 + 2 + 4, 'word count (text + list items, not captions)');
eq(tl.totalWords, words.length + 6 + 2, 'totalWords adds float caption words');
ok(tl.items.filter((i) => i.t === 'c').length === 2, 'two pause cards');
ok(words.filter((w) => w.key).length === 4, 'key words flagged');
const bullet = words.find((w) => w.li);
ok(bullet && bullet.li.n === 1 && bullet.li.of === 2, 'list item metadata');
ok(words.find((w) => w.text.includes('Δ')).sym, 'Δ word flagged symbolic');
ok(tl.items.every((it, k) => k === 0 || it.t !== 'w' || tl.items[k - 1].t !== 'w' || it.n === tl.items[k - 1].n + 1), 'n increments between adjacent words');
ok(tl.items.at(-1).n === tl.totalWords, 'end marker n = totalWords (captions counted)');
eq(coreOf('O(BLDN).'), 'O(BLDN)', 'balanced paren kept in core');
eq(coreOf('(Transformer)'), 'Transformer', 'wrapping parens stripped');
eq(coreOf('f(x)),'), 'f(x)', 'extra closer stripped, balanced one kept');
ok(tl.mainWords + tl.appendixWords === tl.totalWords, 'main + appendix = total');

console.log('--- durations ---');
const settings = { wpm: 300, intensity: 1, cardSeconds: 0, headingMode: 'auto' };
const w0 = words[0];
ok(Math.abs(itemDuration(w0, settings) - 200 * w0.f) < 1e-6, 'word duration = base × f');
ok(itemDuration(w0, { ...settings, intensity: 0 }) === 200, 'intensity 0 → flat base time');
ok(itemDuration(tl.items[0], settings) >= 1100, 'heading card ≥ 1.1 s');
ok(itemDuration(tl.items[0], { ...settings, headingMode: 'stop' }) === null, 'heading stop mode');
const card = tl.items.find((i) => i.t === 'c');
ok(itemDuration(card, settings) === null, 'card stops by default');
ok(itemDuration(card, { ...settings, cardSeconds: 3 }) === 3000, 'card auto-continue 3 s');
ok(itemDuration(tl.items[tl.mainEnd], settings) === null, 'end-of-main stops');
ok(itemDuration(tl.items.at(-1), settings) === null, 'end stops');
ok(minutesLeft(tl, 0, settings) > 0 && minutesLeft(tl, tl.items.length - 1, settings) === 0, 'minutesLeft decreases to 0');

console.log('--- navigation ---');
const firstW = tl.items.findIndex((i) => i.t === 'w');
eq(sentenceStart(tl.items, firstW + 2), firstW, 'sentenceStart within sentence');
eq(prevSentence(tl.items, firstW + 2), firstW, 'prev → start of this sentence');
eq(prevSentence(tl.items, firstW), 0, 'prev from first word → heading card');
eq(nextSentence(tl.items, firstW), firstW + 4, 'next → first word of next sentence');
const pr = paragraphRange(tl.items, firstW + 1);
eq(pr, [firstW, firstW + 9], 'paragraph range covers both sentences of the block');
eq(headingTrail(tl.sections, 2).map((s) => s.heading), ['2 Method', '2.1 Encoder'], 'heading trail includes parent');
eq(sectionOf(tl, tl.mainEnd), 2, 'end-of-main marker attributed to the last main section');
eq(sectionOf(tl, tl.items.length - 1), 3, 'end marker attributed to the last section');

console.log('--- markdown table ---');
const t = parseMarkdownTable('| Model | MACs | Avg Dice |\n|---|---:|:-:|\n| UNETR | 196.03G | 0.8027 |\n| **SegResMamba** | 336.45G | 0.8361 |');
ok(t && t.header.length === 3 && t.rows.length === 2, 'table parsed');
eq(t.rows[1][0], 'SegResMamba', 'bold stripped');
eq(t.align, [null, 'right', 'center'], 'alignment row parsed');
ok(parseMarkdownTable('just a line\nanother') === null, 'non-table → null');
ok(isNumericCell('0.8361') && isNumericCell('196.03G') && isNumericCell('12.7%') && !isNumericCell('UNETR'), 'numeric cell detection');
const esc = parseMarkdownTable('| a | b |\n|---|---|\n| x \\| y | z |');
eq(esc.rows[0][0], 'x | y', 'escaped pipe honoured');

console.log(fails.length ? `\n${fails.length} FAILED: ${fails.join(', ')}` : '\nall passed');
process.exit(fails.length ? 1 : 0);
