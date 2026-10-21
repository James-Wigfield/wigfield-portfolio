// §5 · Training: backpropagation through time (slide 14)
export default {
  big: 'to train an RNN, {g|unroll it through time}, then use regular backpropagation: BPTT',
  blocks: [
    {
      id: 'passes',
      h: 'Backpropagation through time',
      at: '14',
      fig: { key: 'bptt', hl: ['grad'], cap: 'Figure 15-5 · the gradients (solid arrows) in green', place: 'above' },
      items: [
        {
          steps: [
            'forward pass (dashed →): left to right through the unrolled network, computes the outputs $\\hat{\\mathbf{Y}}_{(t)}$',
            'the loss compares those outputs with their targets',
            'gradients of the loss flow {g|backward} through the unrolled network (solid ←)',
          ],
        },
      ],
      margin: [
        { q: 'What is BPTT?', a: 'Backpropagation through time: unroll the RNN through time, then run regular backpropagation.' },
      ],
    },
    {
      id: 'count',
      h: 'Which outputs count',
      at: '14',
      items: [
        { formula: '\\mathscr{L}\\left(\\mathbf{Y}_{(2)}, \\mathbf{Y}_{(3)}, \\mathbf{Y}_{(4)};\\ \\hat{\\mathbf{Y}}_{(2)}, \\hat{\\mathbf{Y}}_{(3)}, \\hat{\\mathbf{Y}}_{(4)}\\right)', read: 'targets $\\mathbf{Y}$ vs outputs $\\hat{\\mathbf{Y}}$, only the {g|last three}: steps 2, 3 & 4' },
        '$\\hat{\\mathbf{Y}}_{(0)}$, $\\hat{\\mathbf{Y}}_{(1)}$ not in the loss → send no gradient, but gradient from later outputs still flows back through their cells',
        { arrow: ['every cell: the same $\\mathbf{W}$, $\\mathbf{b}$ (slide 40)', 'their gradient adds up a contribution from {g|every step} it reaches (this page’s reading)'] },
      ],
      margin: [
        { q: 'In Figure 15-5, does $\\hat{\\mathbf{Y}}_{(0)}$ send any gradient?', a: 'No — only $\\hat{\\mathbf{Y}}_{(2)}$, $\\hat{\\mathbf{Y}}_{(3)}$ and $\\hat{\\mathbf{Y}}_{(4)}$ are in the loss, although gradient from them still flows back through cell 0.' },
      ],
    },
  ],
};
