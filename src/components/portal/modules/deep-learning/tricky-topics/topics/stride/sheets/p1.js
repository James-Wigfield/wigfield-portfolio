// Notebook page 1 · Stride. ≤ 30 rules at the 760 px reference width.
export default {
  blocks: [
    {
      id: 'what',
      h: 'Stride = how far the window jumps',
      at: 'L3 · 9, 14',
      items: ['The distance between neighbouring receptive fields:', { formula: '\\text{output } i \\text{ reads inputs } i\\,s \\text{ to } i\\,s + f - 1', read: 'window size $f$' }],
    },
    {
      id: 'rules',
      h: 'Two padding rules (beyond the slides)',
      at: 'L3 · 20–21',
      items: [
        { formula: '\\text{valid: } \\left\\lfloor (n - k)/s \\right\\rfloor + 1', read: 'no padding; the last inputs may be {g|ignored}' },
        { formula: '\\text{same: } \\left\\lceil n/s \\right\\rceil', read: 'zeros added; stride > 1 still shrinks' },
      ],
      fig: { key: 'fig148', cap: 'Figure 14-8 (L3 · 21): 10 inputs, k 7, s 2', place: 'side' },
      margin: [{ sc: 'slide 20 says “valid” means zero-padding: it means none' }],
    },
    {
      id: 'pool',
      h: 'Pooling',
      at: 'L3 · 26, 28',
      items: ['Stride defaults to the pool size: `MaxPool2D()` halves, {g|rounding down} (7 → 3).'],
    },
    {
      id: 'worked',
      h: 'Three worked sizes',
      at: 'L3 · 18, 39; L6–7 · 5',
      items: [
        { worked: [
          '70, k 7, s 1, valid → 64 (slide 18)',
          'AlexNet: 227, k 11, s 4 → {g|55}; pool 3, s 2 → 27',
          'transposed, s 2: 3 → 7 (valid) → 14 → 28 (same)',
        ] },
      ],
    },
    {
      id: 'params',
      h: 'Stride vs parameters',
      at: 'L3 · 22, 24',
      items: ['Stride changes the size and the work, {g|never} the parameter count.'],
      margin: [{ q: 'Why stride 2 in a first layer?', a: 'Smaller feature maps, less memory (L3 · 24, 34).' }],
    },
  ],
  skip: 'the 2D index rule, LeNet-5, L4 slide 50’s 56 → 54 → 26, the extra zero on the right.',
};
