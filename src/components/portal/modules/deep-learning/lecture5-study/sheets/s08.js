// §8 · Tying the weights (slides 18–22)
export default {
  blocks: [
    {
      id: 'rule',
      h: 'Tying the weights',
      at: '18–19',
      fig: { key: 'tied', hl: ['w2'], cap: 'Slide 19, N = 4: label W₁, W₂, W₂ᵀ and W₁ᵀ.', place: 'side' },
      items: [
        'In a symmetric autoencoder, each decoder layer can reuse the weights of the encoder layer it mirrors, transposed.',
        { formula: '\\mathbf{W}_{N-\\ell+1} = \\mathbf{W}_{\\ell}^{\\top}, \\quad \\ell = 1, 2, \\cdots, N/2', read: 'N layers, not counting the input; layer N/2 is the coding layer' },
        'With N = 4, only $\\mathbf{W}_1$, $\\mathbf{W}_2$ and the bias terms are learned.',
        'This {g|halves the number of weights}, speeding up training and limiting the risk of overfitting.',
      ],
    },
    {
      id: 'keras',
      h: 'In Keras',
      at: '20–21',
      items: [
        '`DenseTranspose(dense)` uses that Dense layer’s weights, transposed, plus its own biases.',
        { worked: ['`tied_ae` has {g|82,414} parameters (slide 21) against 163,814 (slide 12): 78,500 + 3,030 + 100 + 784, by this page’s working.'] },
        'The biases are not tied, so the parameters are only almost halved.',
      ],
      margin: [
        { q: 'Where do `tied_ae`’s 82,414 parameters come from?', a: 'The encoder’s two Dense layers (78,500 + 3,030), plus the two DenseTranspose bias vectors (100 + 784).' },
        { sc: 'slide 21’s “slightly lower reconstruction error” gives no numbers and compares 10 epochs with 20.' },
      ],
    },
  ],
  skip: '`DenseTranspose`’s code and slide 22’s reconstructions.',
};
