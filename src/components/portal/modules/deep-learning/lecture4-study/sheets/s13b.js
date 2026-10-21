// §13.2 · Inside the LSTM: four FC layers and the equations (slides 46–47)
export default {
  big: '$\\mathbf{h}_{(t-1)}$ & $\\mathbf{x}_{(t)}$ feed {g|four fully connected (FC) layers}: a main layer + three gate controllers',
  blocks: [
    {
      id: 'layers',
      h: 'Four FC layers',
      at: '46',
      fig: { key: 'lstmGates', hl: ['g'], cap: 'each layer & where its output goes; the main layer $\\mathbf{g}_{(t)}$ in green', place: 'above' },
      items: [
        'main layer $\\mathbf{g}_{(t)}$ (tanh): its output is partly stored in the long-term state',
        'f, i, o = gate controllers: logistic → outputs {g|0 to 1}',
        'forget gate $\\mathbf{f}$: what to erase from the long-term state',
        'input gate $\\mathbf{i}$: which parts of $\\mathbf{g}$ to add to it',
        'output gate $\\mathbf{o}$: what to read & output, to both $\\mathbf{h}_{(t)}$ & $\\mathbf{y}_{(t)}$',
      ],
      margin: [
        { nb: '$\\otimes$ = element-wise multiplication' },
        { q: 'What range do the gate controllers output, and why?', a: '0 to 1, because they use the logistic (σ) activation function.' },
        { q: 'Which gate decides what is erased from the long-term state?', a: 'The forget gate, controlled by $\\mathbf{f}_{(t)}$.' },
      ],
    },
    {
      id: 'eqs',
      h: 'The four layers as equations',
      at: '47',
      items: [
        { formula: '\\mathbf{f}_{(t)}^{\\top} = \\sigma\\left(\\mathbf{x}_{(t)}^{\\top}\\mathbf{W}_{xf} + \\mathbf{h}_{(t-1)}^{\\top}\\mathbf{W}_{hf} + \\mathbf{b}_{f}^{\\top}\\right)', read: 'forget gate: how much old long-term state to keep' },
        { formula: '\\mathbf{i}_{(t)}^{\\top} = \\sigma\\left(\\mathbf{x}_{(t)}^{\\top}\\mathbf{W}_{xi} + \\mathbf{h}_{(t-1)}^{\\top}\\mathbf{W}_{hi} + \\mathbf{b}_{i}^{\\top}\\right)', read: 'input gate, 0 to 1: how much of $\\mathbf{g}$ to add' },
        { formula: '\\mathbf{g}_{(t)}^{\\top} = \\tanh\\left(\\mathbf{x}_{(t)}^{\\top}\\mathbf{W}_{xg} + \\mathbf{h}_{(t-1)}^{\\top}\\mathbf{W}_{hg} + \\mathbf{b}_{g}^{\\top}\\right)', read: 'main layer: candidate new memory, −1 to 1' },
        { formula: '\\mathbf{o}_{(t)}^{\\top} = \\sigma\\left(\\mathbf{x}_{(t)}^{\\top}\\mathbf{W}_{xo} + \\mathbf{h}_{(t-1)}^{\\top}\\mathbf{W}_{ho} + \\mathbf{b}_{o}^{\\top}\\right)', read: 'output gate: how much of the long-term state to read out' },
      ],
      margin: [
        { sc: 'slide 47’s order is i, f, o, g; here it follows the figure.' },
      ],
    },
    {
      id: 'memory',
      h: 'In short: store, keep, extract',
      at: '47',
      items: [
        {
          steps: [
            'learns to recognize an important input (input gate)',
            'store it in the long-term state',
            'preserve it as long as needed (forget gate)',
            'extract it whenever needed',
          ],
        },
        { formula: '\\mathbf{c}_{(t)} = \\mathbf{f}_{(t)} \\otimes \\mathbf{c}_{(t-1)} + \\mathbf{i}_{(t)} \\otimes \\mathbf{g}_{(t)}', read: 'keep what $\\mathbf{f}$ lets through + add what $\\mathbf{i}$ selects from $\\mathbf{g}$' },
        {
          title: 'one step by hand — the lab’s toy cell storing a signal',
          worked: [
            '$\\mathbf{i}_{(t)} = \\sigma(4) = 0.982$, $\\mathbf{f}_{(t)} = \\sigma(5) = 0.993$, $\\mathbf{g}_{(t)} = \\tanh(3) = 0.995$, $\\mathbf{o}_{(t)} = \\sigma(-4) = 0.018$',
            'from $\\mathbf{c}_{(t-1)} = 0$: $\\mathbf{c}_{(t)} = 0.993 \\times 0 + 0.982 \\times 0.995 =$ {g|0.977} — stored',
          ],
        },
        { formula: '\\mathbf{y}_{(t)} = \\mathbf{h}_{(t)} = \\mathbf{o}_{(t)} \\otimes \\tanh\\left(\\mathbf{c}_{(t)}\\right)', read: 'the output gate reads part of tanh of the long-term state' },
        { worked: ['$\\mathbf{h}_{(t)} = 0.018 \\times \\tanh(0.977) =$ {g|0.014} — not read out yet'] },
      ],
      margin: [
        { hook: 'i lets it in · f keeps it · o lets it out' },
        { sc: 'slide 47 drops the ⊤ on the $\\mathbf{c}_{(t)}$ & $\\mathbf{h}_{(t)}$ lines; element-wise, so the same result.' },
      ],
    },
  ],
};
