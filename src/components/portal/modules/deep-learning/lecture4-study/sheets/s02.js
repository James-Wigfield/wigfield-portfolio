// §2 · Memory cells: the hidden state h(t) (slides 7–9)
export default {
  big: 'a part of a network that preserves state across time steps is a {g|memory cell} (or cell)',
  blocks: [
    {
      id: 'memory',
      h: 'Memory',
      at: '7',
      items: [
        '$\\mathbf{y}_{(t)}$ depends on $\\mathbf{x}_{(t)}$ & $\\mathbf{y}_{(t-1)}$, which depends on $\\mathbf{x}_{(t-1)}$, … back to $t = 0$',
        { arrow: ['∴ output at $t$: a function of all inputs $\\mathbf{x}_{(0)}, \\ldots, \\mathbf{x}_{(t)}$', 'a form of {g|memory}'] },
        'a recurrent neuron or layer = a very basic cell',
      ],
      margin: [
        { q: 'Which inputs does $\\mathbf{y}_{(3)}$ depend on?', a: 'All of $\\mathbf{x}_{(0)}, \\mathbf{x}_{(1)}, \\mathbf{x}_{(2)}, \\mathbf{x}_{(3)}$ — every input since $t = 0$.' },
      ],
    },
    {
      id: 'hidden',
      h: 'The hidden state',
      at: '8',
      fig: { key: 'hiddenState', hl: ['h'], place: 'side', cap: 'Figure 15-3 · the state $\\mathbf{h}$ (green) & the output $\\hat{\\mathbf{y}}$ are different arrows' },
      items: [
        '$\\mathbf{h}_{(t)}$: a cell’s state at step $t$ (“h” for hidden)',
        'in general $\\mathbf{h}_{(t)} = f(\\mathbf{x}_{(t)}, \\mathbf{h}_{(t-1)})$',
        'output $\\hat{\\mathbf{y}}_{(t)}$: also a function of the previous state & current inputs',
      ],
      margin: [
        { ne: 'the hidden state & the output {g|may differ}' },
      ],
    },
    {
      id: 'eqs',
      h: 'The equations',
      at: '9',
      items: [
        { formula: '\\mathbf{h}_{(t)}^{\\top} = \\varphi_h\\left(\\mathbf{h}_{(t-1)}^{\\top}\\mathbf{W}_h + \\mathbf{x}_{(t)}^{\\top}\\mathbf{W}_x + \\mathbf{b}_h^{\\top}\\right)', read: 'new state = $\\varphi_h$(old state × $\\mathbf{W}_h$ + input × $\\mathbf{W}_x$ + bias)' },
        {
          title: 'why the three terms can be added (row vectors × matrices)',
          worked: [
            '$\\mathbf{h}_{(t-1)}^{\\top}\\mathbf{W}_h$: ${(1 \\times n_{\\text{neurons}})(n_{\\text{neurons}} \\times n_{\\text{neurons}})}\\to{1 \\times n_{\\text{neurons}}}$',
            '$\\mathbf{x}_{(t)}^{\\top}\\mathbf{W}_x$: ${(1 \\times n_{\\text{inputs}})(n_{\\text{inputs}} \\times n_{\\text{neurons}})}\\to{1 \\times n_{\\text{neurons}}}$',
            '∴ both {g|$1 \\times n_{\\text{neurons}}$}, the same as $\\mathbf{b}_h^{\\top}$',
          ],
        },
        { formula: '\\mathbf{y}_{(t)}^{\\top} = \\varphi_y\\left(\\mathbf{h}_{(t)}^{\\top}\\mathbf{W}_y + \\mathbf{b}_y^{\\top}\\right)', read: 'output = $\\varphi_y$(state × $\\mathbf{W}_y$ + bias)' },
      ],
      margin: [
        { sc: 'slides 7 & 9’s unhatted $\\mathbf{y}$ = the output (slide 8: $\\hat{\\mathbf{y}}$).' },
      ],
    },
    {
      id: 'where',
      h: 'Weights & activations',
      at: '9',
      items: [
        {
          table: {
            head: ['weights', 'shape'],
            rows: [
              ['$\\mathbf{W}_h$', '$n_{\\text{neurons}} \\times n_{\\text{neurons}}$'],
              ['$\\mathbf{W}_x$', '$n_{\\text{inputs}} \\times n_{\\text{neurons}}$'],
              ['$\\mathbf{W}_y$', '$n_{\\text{neurons}} \\times n_{\\text{outputs}}$'],
            ],
          },
        },
        'all three {g|learned} in training',
        '$\\varphi_h$: e.g. ReLU, tanh',
        '$\\varphi_y$: e.g. sigmoid (binary), softmax with cross-entropy (multi-class)',
      ],
      margin: [
        { q: 'What shape is $\\mathbf{W}_x$?', a: '$n_{\\text{inputs}} \\times n_{\\text{neurons}}$.' },
        { sc: 'strictly, softmax is the activation & cross-entropy the loss it’s paired with in training.' },
      ],
    },
  ],
};
