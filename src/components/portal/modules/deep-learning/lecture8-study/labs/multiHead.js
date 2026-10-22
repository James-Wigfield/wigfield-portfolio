import { matmul, splitHeads, concatHeads, attention, rng } from '../attn.js';

/* §12's toy multi-head self-attention over "I like soccer" (the page's own
   numbers): an 8-wide embedding per word, seeded random Linear layers
   W_Q, W_K, W_V and the final W_O (8 × 8), then Figure 16-10's pipeline
   Linear → Split into H → scaled dot-product attention per head → Concat →
   Linear, for H = 1, 2 or 4. Kept in a .js file so labsMultiHead.jsx exports
   components only. */

export const D_MODEL = 8;
export const WORDS = ['I', 'like', 'soccer'];

const R = rng(8039);
const mat = (rows, cols, s) => Array.from({ length: rows }, () => Array.from({ length: cols }, () => Math.round(R.normal() * s * 100) / 100));

export const X = mat(3, D_MODEL, 1);
export const WQ = mat(D_MODEL, D_MODEL, 0.45);
export const WK = mat(D_MODEL, D_MODEL, 0.45);
export const WV = mat(D_MODEL, D_MODEL, 0.5);
export const WO = mat(D_MODEL, D_MODEL, 0.4);

export function multiHead(H) {
  const Q = matmul(X, WQ);
  const K = matmul(X, WK);
  const V = matmul(X, WV);
  const Qh = splitHeads(Q, H);
  const Kh = splitHeads(K, H);
  const Vh = splitHeads(V, H);
  const heads = Qh.map((q, h) => attention(q, Kh[h], Vh[h]));
  const concat = concatHeads(heads.map((a) => a.out));
  const out = matmul(concat, WO);
  return { Q, K, V, heads, concat, out, dHead: D_MODEL / H };
}
