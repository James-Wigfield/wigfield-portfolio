import { SECTIONS } from '../sections.js';
import { LABS } from './labs.js';
import { KERAS } from './keras.js';
import { TRAINING } from './training.js';
import { OPTIM } from './optim.js';
import { CNN } from './cnn.js';
import { RNN } from './rnn.js';
import { AE } from './ae.js';
import { GEN } from './gen.js';
import { TRANSFORMER } from './transformer.js';
import { RL } from './rl.js';

/* ============================================================================
   CODE LAB — THE CARDS
   ----------------------------------------------------------------------------
   One data file per tab; this file joins them in tab order and gives every
   card its printed label from that order ("Card 6.2" = tab 6, 2nd card), so
   no label is typed by hand. A card = code → understanding:

   {
     id: 'rnn-seq2vec',          stable slug: anchor, React key, prompt refs
     title: 'Sequence-to-vector RNN',
     rating: 'core' | 'useful',
     why: '…',                   ≤ 25 words: what the exam would ask
     sources: [{ kind: 'lecture', lec: 4, slides: '23' },
               { kind: 'lab', n: 4, task: 3 },
               { kind: 'project', n: 2, sec: '§6' },
               { kind: 'geron', ch: 10, sec: 'Exercise 10' }],
     provenance: 'verbatim' | 'trimmed' | 'reconstructed' | 'notebook' | 'geron',
     file: 'seq2vec.py',         the editor tab's filename
     code: `…`,                  ≤ 16 lines; verbatim apart from '# …' elisions
     marks: [{ n: 1, lines: [3, 4], say, quote? },
             { n: 2, token: { line: 6, text: 'return_sequences=True' }, say }],
                                 ≤ 4 marks, each `say` ≤ 20 words
     moves: { draw: specId, count: specId,
              shapes: [{ name, shape, means }],
              eq: [{ tex, plain, line, name }],
              say: '…', forWhat: '…' },   say + forWhat ≤ 60 words
     slideCheck: '…' | null,     a slide quirk or version difference
     xref: [{ to: cardId, text: 'Applied in Lab 4' }],
   }
   ========================================================================== */

const BY_SECTION = {
  labs: LABS,
  keras: KERAS,
  training: TRAINING,
  optim: OPTIM,
  cnn: CNN,
  rnn: RNN,
  ae: AE,
  gen: GEN,
  transformer: TRANSFORMER,
  rl: RL,
};

export const CARDS = SECTIONS.flatMap((sec) => (BY_SECTION[sec.id] || []).map((c, i) => ({
  ...c,
  section: sec.id,
  no: `${sec.n}.${i + 1}`,
  label: `Card ${sec.n}.${i + 1}`,
})));

export const CARD_BY_ID = Object.fromEntries(CARDS.map((c) => [c.id, c]));

export const cardsOf = (sectionId) => CARDS.filter((c) => c.section === sectionId);

// "Card 7.2 · Sequence-to-vector RNN": the exact string printed on the page,
// in the panel's title bar and in the PDF (the NotebookLM prompts name it)
export const fullLabel = (c) => `${c.label} · ${c.title}`;

const LEC_NAME = { 1: 'L1', 2: 'L2', 3: 'L3', 4: 'L4', 5: 'L5', 6: 'L6–7', 7: 'L6–7', 8: 'L8', 9: 'L9' };

export function sourceText(s) {
  if (s.kind === 'lecture') return `${LEC_NAME[s.lec]} · ${/[–,-]/.test(s.slides) ? 'slides' : 'slide'} ${s.slides}`;
  if (s.kind === 'lab') return `Lab ${s.n}${s.task ? ` · Task ${s.task}` : ''}`;
  if (s.kind === 'project') return `P${s.n} ${s.sec}`;
  if (s.kind === 'geron') return `Géron Ch ${s.ch} · ${s.sec}`;
  return '';
}

export function provenanceText(c) {
  switch (c.provenance) {
    case 'verbatim': return 'verbatim from the slide';
    case 'trimmed': return 'slide code, trimmed';
    case 'reconstructed': {
      const lab = c.sources.find((s) => s.kind === 'lab');
      return `Lab ${lab ? lab.n : ''} · reconstructed from the sheet`;
    }
    case 'notebook': return 'verbatim from my notebook, trimmed';
    case 'geron': return 'Géron’s notebook, trimmed';
    default: return '';
  }
}

export const words = (s) => (s ? String(s).replace(/`[^`]*`/g, 'x').split(/\s+/).filter(Boolean).length : 0);
