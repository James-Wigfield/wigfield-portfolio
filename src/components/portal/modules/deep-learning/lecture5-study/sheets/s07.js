// §7 · Unsupervised pretraining (slides 16–17)
export default {
  blocks: [
    {
      id: 'why',
      h: 'Why reuse layers',
      at: '16',
      items: [
        'With little labelled data, reuse the lower layers of a network trained on a similar task: they already hold the low-level feature detectors.',
      ],
    },
    {
      id: 'how',
      h: 'Unsupervised pretraining',
      at: '16–17',
      fig: { key: 'pretrain', hl: ['copy'], cap: 'Figure 17-6: label both phases and the copied layers.' },
      items: [
        {
          steps: [
            'Train a stacked autoencoder on all the data; this needs {g|no labels}.',
            'Copy its lower (encoder) layers into a new network for the actual task.',
            'Add a new output layer with a softmax, and train the network on the labelled data.',
          ],
        },
        'Fewer layers need training, so the network copes with fewer labelled examples.',
      ],
      margin: [
        { q: 'Why does unsupervised pretraining help when labelled data is scarce?', a: 'The encoder layers are learned from all the data without labels; the new network reuses them, so fewer layers need training on the few labelled examples.' },
      ],
    },
  ],
};
