// §1 · Encoder–decoder networks for NMT (slides 4–6)
export default {
  blocks: [
    {
      id: 'nmt',
      h: 'Encoder–decoders for NMT',
      at: '4–5',
      items: [
        'An encoder–decoder suits neural machine translation: the encoder reads the English sentence, and the decoder writes the Spanish one, which can have a different length.',
        'Only the {g|last encoder state} is passed to the decoder (Figure 16-3).',
      ],
      margin: [
        { q: 'In Figure 16-3, what crosses from the encoder to the decoder?', a: 'Only the last encoder cell’s state. The encoder’s own outputs are unused.' },
      ],
    },
    {
      id: 'causal',
      h: 'A causal layer can’t look ahead',
      at: '6',
      items: [
        'A regular recurrent layer is {g|causal}: at each step it only sees past and present inputs.',
        'That suits forecasting and the decoder, but to encode “right” in “the right arm / person / to criticize”, you need to look ahead.',
      ],
      margin: [
        { q: 'Why is a causal layer fine for the decoder but not for the encoder?', a: 'The decoder writes one word at a time, so it can only use what came before. The encoder already has the whole sentence, and a word like “right” needs the words after it.' },
      ],
    },
  ],
  skip: 'Figure 15-4’s four network shapes; Figure 16-3’s token IDs and embeddings; footnote 2’s embedding names.',
};
