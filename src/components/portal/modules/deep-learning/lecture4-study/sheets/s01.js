// §1 · What RNNs are for · recurrent neurons & unrolling (slides 4–6)
export default {
  big: 'a recurrent network: like a feedforward one + connections {g|pointing backward}',
  blocks: [
    {
      id: 'for',
      h: 'What RNNs are for',
      at: '4',
      items: [
        'predict the future (up to a point): time series, e.g. stock prices; anticipate car trajectories',
        'work on sequences of {g|arbitrary lengths}, not fixed-size inputs like the nets so far',
        'uses: automatic translation, speech-to-text, sentiment analysis, next notes in a melody (e.g. Google’s Magenta project)',
      ],
    },
    {
      id: 'neuron',
      h: 'A recurrent neuron',
      at: '5',
      fig: { key: 'unroll', hl: ['loop', 'feed'], place: 'side', cap: 'Figure 15-1 · neuron (left), unrolled (right), 0 into the first copy · feedback in green' },
      items: [
        'simplest RNN: one neuron sending its output back to itself',
        'each time step $t$ (a *frame*): gets inputs $\\mathbf{x}_{(t)}$ & its own previous output $\\hat{\\mathbf{y}}_{(t-1)}$',
        '{g|unrolling the network through time}: one copy of the neuron per time step',
      ],
      margin: [
        { q: 'What two things does a recurrent neuron receive at time step $t$?', a: 'The inputs $\\mathbf{x}_{(t)}$ and its own output from the previous time step, $\\hat{\\mathbf{y}}_{(t-1)}$.' },
        { q: 'What is unrolling the network through time?', a: 'Drawing the recurrent neuron once per time step along a time axis, each copy passing its output to the next.' },
      ],
    },
    {
      id: 'layer',
      h: 'A layer of recurrent neurons',
      at: '6',
      items: [
        'every neuron gets input vector $\\mathbf{x}_{(t)}$ & previous output vector $\\mathbf{y}_{(t-1)}$',
        'inputs & outputs now {g|vectors} (one neuron: output a scalar)',
      ],
      margin: [
        { nb: '$\\hat{\\mathbf{y}}_{(t-1)}$ (slide 5) & $\\mathbf{y}_{(t-1)}$ (slide 6) both mean the previous step’s output' },
        { sc: 'slide 5 sets them in bold (vectors); slide 6 & Fig. 15-1 treat them as scalars.' },
      ],
    },
  ],
};
