/* The Exchange — the manifest (frozen contract, tools/dl-arcade/PLAN.md). */
import { Glyph } from './glyph.jsx';

export default {
  id: 'the-exchange',
  title: 'The Exchange',
  lectures: [8],
  concepts: ['encdec.finalState', 'attn.motivation', 'attn.weightedSum', 'attn.keras', 'attn.alignment', 'attn.bahdanau', 'attn.luong', 'attn.luongVariants', 'attn.qkv', 'transformer.sdpa', 'transformer.scaling', 'transformer.mask', 'transformer.mha', 'transformer.selfVsCross'],
  blurb: 'A 1940s switchboard. Patch each query into the keys; the real cross-attention of a toy Transformer grades your plugs.',
  color: '--dlv-orange',
  levels: 3,
  levelNames: ['one cable · patch board', 'Bahdanau vs Luong desks', 'masks · heads · scaling'],
  glyph: Glyph,
  load: () => import('./TheExchange.jsx'),
};
