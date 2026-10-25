// Notebook page 1 · Shapes. ≤ 30 rules at the 760 px reference width.
export default {
  blocks: [
    {
      id: 'what',
      h: 'A shape counts each axis; the batch comes first',
      at: 'L3 · 16–17; L1 · 36',
      items: [
        '(2, 70, 120, 3) = 2 images × 70 rows × 120 columns × 3 colours.',
        '`summary()` writes the batch as {g|None}; `InputLayer(shape=…)` leaves it out.',
      ],
      margin: [{ q: 'In `shape=[None, 1]`, what is the None?', a: 'The time axis: any sequence length (L4 · 24).' }],
    },
    {
      id: 'conv',
      h: 'The conventions',
      at: 'L3 · 16; L4 · 24; L8 · 37',
      items: [
        { table: {
          head: ['data', 'shape'],
          rows: [
            ['tabular', '[batch, features]'],
            ['images', '[batch, height, width, channels]'],
            ['sequences', '[batch, {g|time steps}, dimensionality]'],
            ['attention', 'Q $[n_q, d_k]$, K $[n_k, d_k]$, V $[n_k, d_v]$ → $[n_q, d_v]$'],
          ],
        } },
      ],
    },
    {
      id: 'layers',
      h: 'What each layer does to a shape',
      at: 'L3 · 18–31; L4 · 29',
      items: [
        { table: {
          head: ['layer', 'in → out'],
          rows: [
            ['Flatten', 'multiply everything out'],
            ['Dense(n)', 'last axis → n'],
            ['Conv2D(f, k)', 'h, w by k / stride / padding; channels → f'],
            ['MaxPool2D(2)', 'h, w halve (round down); channels kept'],
            ['GlobalAvgPool2D', '(h, w, c) → (c,)'],
            ['RNN(n)', '→ (n,); `return_sequences=True` → (time, n)'],
          ],
        } },
      ],
      margin: [{ sc: 'slide 19 writes [2, 64, 114, 3]: the 3 should be 32' }],
    },
    {
      id: 'weights',
      h: 'Weights have no batch axis',
      at: 'L1 · 36; L3 · 19',
      items: ['Dense kernel $(n_{\\text{in}}, n)$ + bias $(n,)$; Conv2D kernels $(k, k, c_{\\text{in}}, f)$ + biases $(f,)$.'],
    },
    {
      id: 'traced',
      h: 'Two traced examples',
      at: 'L3 · 35; sample Q2(a)',
      items: [
        { worked: [
          'slide 35: 28×28×1 → 28×28×64 → 14 → 7 → {g|3}×3×256 → 2,304 → 128 → 64 → 10',
          'star: X $(N, 4, 2)$, y $(N, 2)$: N stars, 4 corners, $(x, y)$',
        ] },
      ],
    },
  ],
  skip: 'reading single tuples, Reshape and Concatenate, Conv2DTranspose, the L4 slide 21 reshape gap.',
};
