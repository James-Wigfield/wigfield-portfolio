// §13 · Self- vs cross-attention; training and inference (slides 40–42)
export default {
  blocks: [
    {
      id: 'kinds',
      h: 'Self- vs cross-attention',
      at: '40',
      items: [
        {
          table: {
            head: ['layer', 'Q from', 'K, V from'],
            rows: [
              ['encoder self-attention', 'English', 'English'],
              ['decoder masked self-attention', 'Spanish', 'Spanish'],
              ['decoder {g|cross-attention}', 'Spanish', 'English'],
            ],
          },
        },
        'E.g. processing “el”, the decoder attends to “soccer” to produce “fútbol”.',
      ],
    },
    {
      id: 'mask',
      h: 'Masking',
      at: '31',
      fig: { key: 'mask', hl: ['mask'], cap: 'The causal mask: cross out the words after each word.', place: 'side' },
      items: [
        'The decoder’s masked attention is {g|causal}: a word can’t attend to the words after it.',
      ],
    },
    {
      id: 'gen',
      h: 'Generating a translation',
      at: '41–42',
      items: [
        {
          steps: [
            'Start the decoder with $\\langle\\text{SOS}\\rangle$.',
            'Predict the next word and append it to the decoder’s input.',
            'Run the whole network again; repeat until $\\langle\\text{EOS}\\rangle$.',
          ],
        },
        'The softmax has one neuron per target-language word.',
      ],
      margin: [
        { q: 'At inference, what goes into the decoder before the first word?', a: 'Only the $\\langle\\text{SOS}\\rangle$ prompt.' },
      ],
    },
  ],
  skip: 'beam search (not covered in the unit) and slide 42’s N = 2 drawing.',
};
