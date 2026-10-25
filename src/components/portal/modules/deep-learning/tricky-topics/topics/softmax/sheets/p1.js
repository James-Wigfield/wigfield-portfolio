// Notebook page 1 · Softmax. ≤ 30 rules at the 760 px reference width.
export default {
  blocks: [
    {
      id: 'what',
      h: 'What softmax does',
      at: 'L1 · 29',
      items: [
        'Scores → probabilities: positive, they {g|sum to 1}, order kept.',
        { formula: '\\hat{p}_k = \\dfrac{\\exp(z_k)}{\\sum_{j} \\exp(z_j)}', read: 'exponentiate, add up, divide', tag: 'beyond the slides; L8 · 25 prints it for α' },
      ],
      margin: [{ q: 'Add 5 to every score?', a: 'Nothing changes: $e^{5}$ cancels top and bottom.' }],
    },
    {
      id: 'worked',
      h: 'By hand: z = (2, 1, 0.1)',
      at: 'this page’s own',
      items: [{ worked: ['$e^{z} = (7.389,\\ 2.718,\\ 1.105)$, total $11.212$', '$\\hat{p} = $ {g|(0.659, 0.242, 0.099)}'] }],
    },
    {
      id: 'vs',
      h: 'Softmax or sigmoid (all: cross-entropy)',
      at: 'L1 · 29, 31',
      items: [
        { table: {
          head: ['problem', 'outputs', 'activation'],
          rows: [
            ['binary', '1', 'sigmoid'],
            ['multilabel', '1 per label', 'a sigmoid each'],
            ['multiclass', '1 per class', '{g|softmax} (sums to 1)'],
          ],
        } },
      ],
      margin: [{ q: 'CartPole’s two actions?', a: 'One sigmoid: P(left); right is $1 - p$ (L9 · 25).' }],
    },
    {
      id: 'loss',
      h: 'Cross-entropy and argmax',
      at: 'L1 · 29, 40',
      items: [
        { formula: 'J(\\boldsymbol{\\theta}) = -\\tfrac{1}{m}\\sum_{i}\\sum_{k} y_k^{(i)} \\log \\hat{p}_k^{(i)}' },
        'One example: $-\\log \\hat{p}$ of the true class. Predict with {g|argmax}.',
      ],
    },
    {
      id: 'where',
      h: 'Where it turns up',
      at: 'L3 · 33; L8 · 22–41',
      items: [
        'A classifier’s output layer: one probability per class.',
        'Attention: $\\alpha$ = softmax(scores); rows sum to 1.',
        'Transformer: Linear → Softmax over the vocabulary.',
      ],
    },
    {
      id: 'scale',
      h: 'Why divide by √d_keys',
      at: 'L8 · 38',
      items: ['Big scores {g|saturate} the softmax (near one-hot): tiny gradients.'],
      margin: [{ sc: 'slide 38’s bullet says $1/d_{\\text{keys}}$; the equation has the √' }],
    },
  ],
  skip: 'the Keras loss names, slide 40’s rows, ImageNet’s top 3, two-class softmax = sigmoid.',
};
