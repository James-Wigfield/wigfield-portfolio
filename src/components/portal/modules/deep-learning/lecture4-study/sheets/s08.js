// §8 · Linear model → simple RNN (slides 23–27)
export default {
  big: 'one recurrent neuron isn’t enough → {g|32 neurons + a `Dense(1)` output} beat the baseline & the linear model',
  blocks: [
    {
      id: 'linear',
      h: 'The linear model',
      at: '23',
      items: [
        '`Dense(1)` on the 56 inputs = a linear model: 56 weights + 1 bias',
        'Huber loss, SGD (lr 0.02, momentum 0.9) & early stopping',
        { formula: '\\#\\text{params}\\big(\\texttt{Dense}(k)\\big) = (\\text{inputs} + 1) \\times k', read: 'one weight per input + a bias, per unit: 56 + 1 = 57', tag: 'a Dense layer’s count — not printed on these slides' },
      ],
    },
    {
      id: 'one',
      h: 'One recurrent neuron',
      at: '24–26',
      items: [
        'Keras recurrent layers expect {g|3D inputs}: [batch size, time steps, dimensionality]; dimensionality 1 for a univariate series',
        '`InputLayer(shape=[None, 1])`: `None` time steps → sequences of any length',
        { line: '`SimpleRNN(1)`: val MAE > 100,000 — two reasons:' },
        { arrow: ['a single recurrent neuron: only the current input & its previous output', 'memory extremely limited (only 3 params)'] },
        { worked: ['`SimpleRNN(1)`: $1 + 1 + 1 = 3$ (input weight, recurrent weight, bias)'] },
        { arrow: ['default activation tanh: outputs only between −1 & +1', 'can’t reach the series (÷ 1e6) above 1.0'] },
      ],
      margin: [
        { q: 'Why can’t `SimpleRNN(1)` forecast the rail series well?', a: 'Only 3 parameters (very little memory), and its tanh output is stuck between −1 and +1 while the series (÷ 1e6) goes above 1.0.' },
        { sc: 'slide 21’s batches are (32, 56); the step to 3D is never shown.' },
        { sc: 'slide 26’s “about 1.4”: the data peaks at 1.147 (this page’s check); still above tanh’s +1.' },
      ],
    },
    {
      id: 'univar',
      h: '`univar_model`: the fix',
      at: '26–27',
      items: [
        '{g|32 recurrent neurons} + a `Dense(1)` output layer with no activation function',
        { fig: 'univar', hl: ['dense'], cap: 'the 32-wide state passed sideways; the last state → `Dense(1)` (green)' },
        { formula: '\\#\\text{params} = \\underbrace{n_{\\text{inputs}}\\,n_{\\text{neurons}}}_{\\mathbf{W}_x} + \\underbrace{n_{\\text{neurons}}^{2}}_{\\mathbf{W}_h} + \\underbrace{n_{\\text{neurons}}}_{\\mathbf{b}_h}', read: 'input weights + recurrent weights + biases', tag: 'this page’s count from slide 9’s shapes' },
        {
          title: '`univar_model`’s 1,121 params (slide 27)',
          worked: [
            'SimpleRNN(32), 1 input: $1 \\times 32 + 32 \\times 32 + 32 = 1{,}088$',
            'Dense(1), 32 inputs: $32 + 1 = 33$ → total $1{,}088 + 33 =$ {g|1,121}, as the summary prints',
          ],
        },
      ],
      margin: [
        { q: 'How many parameters does `SimpleRNN(32)` have on a univariate series?', a: '1,088: 32 input weights + 1,024 recurrent weights + 32 biases.' },
      ],
    },
    {
      id: 'board',
      h: 'Scoreboard',
      at: '23–27',
      items: [
        {
          table: {
            head: ['model', 'params', 'MAE'],
            cols: 'minmax(min-content, max-content) max-content max-content',
            rows: [
              ['baseline: 7 days’ shift (slide 18)', '—', '42,143'],
              ['linear: `Dense(1)`', '57', '≈ 38,245'],
              ['`SimpleRNN(1)`', '3', '> 100,000'],
              ['`univar_model`', '1,121', '≈ {g|27,703}'],
            ],
          },
        },
      ],
    },
  ],
};
