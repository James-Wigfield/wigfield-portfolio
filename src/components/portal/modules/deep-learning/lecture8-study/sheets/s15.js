// §15 · Visual attention and the vision transformer (slides 44–46)
export default {
  blocks: [
    {
      id: 'vis',
      h: 'Visual attention',
      at: '44–45',
      items: [
        'A CNN turns the image into feature maps; an RNN decoder with attention writes the caption one word at a time, focusing on the right part of the image for each word (the frisbee for “frisbee”).',
      ],
    },
    {
      id: 'vit',
      h: 'Vision transformer (ViT, 2020)',
      at: '46',
      fig: { key: 'vit', hl: ['flat'], cap: 'Slide 46’s recipe, left to right.' },
      items: [
        { worked: ['16 × 16 pixels × 3 colour channels = {g|768} numbers'], title: 'One patch' },
        'Chop the image into 16 × 16 squares and treat them like words: flatten, a linear layer that keeps 768 dimensions, add positional embeddings, then the transformer.',
        'It needed over 300 million extra training images: transformers lack CNNs’ {g|inductive biases}, so they must learn those assumptions from data.',
      ],
      margin: [
        { q: 'Why does ViT need so much more data than a CNN?', a: 'Transformers don’t have as many inductive biases as CNNs, so they need extra data to learn what CNNs implicitly assume.' },
      ],
    },
  ],
  skip: 'Figure 16-12’s photos and the later papers (§16, not examined).',
};
