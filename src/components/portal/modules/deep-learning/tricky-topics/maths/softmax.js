/* ============================================================================
   TRICKY TOPICS — SOFTMAX AND FRIENDS (shared maths)
   ----------------------------------------------------------------------------
     softmax(z)        exp(z_k) / Σ_j exp(z_j), computed stably (subtract the
                       max first: adding the same number to every score
                       changes nothing — the shift invariance the softmax
                       topic shows live). The formula is printed on L8 slide
                       25 for attention weights; as an output layer's formula
                       it is beyond the slides. Checked against tf.nn.softmax
                       by tools/dl-tricky-topics/verify_counts.py.
     sigmoid(z)        1 / (1 + exp(−z))  (L1 slide 20's logistic function)
     crossEntropy(p, k)  −log p_k: the loss for one example whose true class
                       is k (L1 slide 29's cross-entropy, one term)
     attention(scores, scale)  the softmax of a row of scores ÷ scale (√d_keys
                       on L8 slide 38)
   ========================================================================== */

export function softmax(z) {
  const m = Math.max(...z);
  const e = z.map((v) => Math.exp(v - m));
  const s = e.reduce((a, b) => a + b, 0);
  return e.map((v) => v / s);
}

// the unscaled exponentials (what the story beat "exp" shows)
export const exps = (z) => z.map((v) => Math.exp(v));

export const sigmoid = (z) => 1 / (1 + Math.exp(-z));

export const crossEntropy = (p, k) => -Math.log(Math.max(1e-12, p[k]));

export const argmax = (xs) => xs.reduce((best, v, i) => (v > xs[best] ? i : best), 0);

export const attention = (scores, scale = 1) => softmax(scores.map((v) => v / scale));

// Round probabilities for display so they still sum to 100 (largest remainder).
export function percents(p, digits = 0) {
  const f = 10 ** digits;
  const raw = p.map((v) => v * 100 * f);
  const floor = raw.map(Math.floor);
  let left = 100 * f - floor.reduce((a, b) => a + b, 0);
  const order = raw.map((v, i) => [v - Math.floor(v), i]).sort((a, b) => b[0] - a[0]);
  const out = [...floor];
  for (let j = 0; j < order.length && left > 0; j++, left--) out[order[j][1]] += 1;
  return out.map((v) => v / f);
}
