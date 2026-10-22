import { useEffect, useState } from 'react';
import { loadToyMT, translate } from '../toyMT';

/* ============================================================================
   The page's toy transformer, for the §13–§14 labs (SelfCross, Mask, Toy)
   ----------------------------------------------------------------------------
   useToyMT()            { model, error }: lazily loads ../data/toyMT.js once
                         (loadToyMT caches the promise; Export PDF imports the
                         same chunk first, so print never waits on it)
   translateCached(m, w) translate() memoised per model and sentence
   headRows(att, head)   one layer-0 attention map for head 0 / 1, or the
                         average over the heads ('avg')
   HEADS                 the head switch's options
   ========================================================================== */

export function useToyMT() {
  const [state, setState] = useState({ model: null, error: null });
  useEffect(() => {
    let live = true;
    loadToyMT().then(
      (model) => { if (live) setState({ model, error: null }); },
      (error) => { if (live) setState({ model: null, error }); },
    );
    return () => { live = false; };
  }, []);
  return state;
}

const CACHE = new WeakMap();
export function translateCached(model, words) {
  let m = CACHE.get(model);
  if (!m) { m = new Map(); CACHE.set(model, m); }
  const key = words.join(' ');
  if (!m.has(key)) m.set(key, translate(model, words));
  return m.get(key);
}

export function headRows(att, head) {
  const layer = att[0];
  if (head !== 'avg') return layer[head];
  const H = layer.length;
  return layer[0].map((row, i) => row.map((_, j) => layer.reduce((s, A) => s + A[i][j], 0) / H));
}

export const HEADS = [
  { key: 'avg', label: 'both heads', sub: 'average' },
  { key: 0, label: 'head 1' },
  { key: 1, label: 'head 2' },
];

export const headName = (h) => (h === 'avg' ? 'the average of the 2 heads' : `head ${h + 1}`);

// the special tokens in the slides' notation (slides 41–42)
export const tokName = (w) => (w === '<sos>' ? '⟨SOS⟩' : w === '<eos>' ? '⟨EOS⟩' : w);
export const tokTex = (w) => (w === '<sos>' ? '\\langle\\text{SOS}\\rangle' : w === '<eos>' ? '\\langle\\text{EOS}\\rangle' : `\\text{${w}}`);

export const argmax = (a) => a.reduce((best, x, i) => (x > a[best] ? i : best), 0);
