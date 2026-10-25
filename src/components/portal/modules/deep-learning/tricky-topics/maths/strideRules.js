/* ============================================================================
   TRICKY TOPICS — STRIDE, PADDING AND OUTPUT SIZES (shared maths)
   ----------------------------------------------------------------------------
   The output length of one spatial axis, as Keras computes it. None of these
   formulas is printed on the slides: they are BEYOND THE SLIDES, derived
   from L3 slide 9's index rule (a neuron at position i looks at inputs
   i × s … i × s + k − 1) and checked against TensorFlow over a sweep (n ≤ 40,
   k ≤ 7, s ≤ 4, both paddings) by tools/dl-tricky-topics/verify_counts.py.

     convOut(n, k, s, padding)    Conv1D / Conv2D (one axis)
                                  valid: ⌊(n − k) / s⌋ + 1    same: ⌈n / s⌉
     poolOut(n, p, s, padding)    MaxPool / AvgPool: the same rule with k = p;
                                  `strides` defaults to the pool size
                                  (L3 slide 28)
     convTOut(n, k, s, padding)   Conv2DTranspose (Keras):
                                  valid: n·s + max(k − s, 0)  same: n·s
     samePad(n, k, s)             TensorFlow's "same" zeros: total, left, right
                                  (the extra zero goes on the right)
     windows(n, k, s, padding)    every window position, for the pictures
   ========================================================================== */

export function convOut(n, k, s = 1, padding = 'valid') {
  if (padding === 'same') return Math.ceil(n / s);
  return n < k ? 0 : Math.floor((n - k) / s) + 1;
}

export const poolOut = (n, p, s = p, padding = 'valid') => convOut(n, p, s ?? p, padding);

export function convTOut(n, k, s = 1, padding = 'valid') {
  if (padding === 'same') return n * s;
  return n * s + Math.max(k - s, 0);
}

export function samePad(n, k, s = 1) {
  const out = Math.ceil(n / s);
  const total = Math.max((out - 1) * s + k - n, 0);
  const left = Math.floor(total / 2);
  return { total, left, right: total - left };
}

/* Window positions along one axis of n inputs. Indices are in the ORIGINAL
   input (0 … n−1); a padding zero is −1 on the left, n, n+1 … on the right.
   Returns { out, padLeft, padRight, wins: [{ i, from, to, cells }], ignored }
   where `ignored` = input indices no window touches (only `valid` drops any). */
export function windows(n, k, s = 1, padding = 'valid') {
  const pad = padding === 'same' ? samePad(n, k, s) : { left: 0, right: 0 };
  const out = convOut(n, k, s, padding);
  const wins = [];
  const hit = new Set();
  for (let i = 0; i < out; i++) {
    const from = i * s - pad.left;
    const to = from + k - 1;
    const cells = [];
    for (let j = from; j <= to; j++) {
      cells.push(j);
      if (j >= 0 && j < n) hit.add(j);
    }
    wins.push({ i, from, to, cells });
  }
  const ignored = [];
  for (let j = 0; j < n; j++) if (!hit.has(j)) ignored.push(j);
  return { out, padLeft: pad.left, padRight: pad.right, wins, ignored };
}

// "70 × 120 → 64 × 114": a 2D size through one conv/pool layer
export const conv2dOut = ([h, w], [kh, kw], [sh, sw] = [1, 1], padding = 'valid') => [convOut(h, kh, sh, padding), convOut(w, kw, sw, padding)];
