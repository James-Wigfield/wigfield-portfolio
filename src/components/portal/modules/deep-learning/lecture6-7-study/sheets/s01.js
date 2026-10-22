// §1 · Convolutional autoencoders (slides 4–6)
export default {
  blocks: [
    {
      id: 'conv',
      h: 'Convolutional autoencoders',
      at: '4–5',
      items: [
        'The dense autoencoders seen so far don’t work well on images: for images, build a {g|convolutional autoencoder}.',
        'The encoder is a regular CNN of convolutional and pooling layers: it typically shrinks the height and width and increases the depth (the channels).',
        'The decoder does the reverse with {g|transpose convolutional layers}: it upscales the image and reduces its depth back.',
        { line: 'Encoder: 28 × 28 × 1 → 14 × 14 × 16 → 7 × 7 × 32 → 3 × 3 × 64 → 3 × 3 × 30 → {g|30 codings}' },
        { line: 'Decoder: 30 → 144 → 3 × 3 × 16 → 7 × 7 × 32 → 14 × 14 × 16 → 28 × 28 × 1' },
      ],
      margin: [
        { q: 'Why does the third `MaxPool2D` give 3 × 3?', a: 'Pooling with pool_size=2 halves 7 and rounds down, so 7 → 3.' },
        { q: 'How does `conv_decoder` get from 3 × 3 back to 28 × 28?', a: 'Three `Conv2DTranspose` layers with strides=2: 3 → 7 (no padding), then 7 → 14 and 14 → 28 (padding="same").' },
      ],
    },
    {
      id: 'count',
      h: 'One layer’s parameters',
      at: '6',
      items: [
        { title: 'the first `Conv2DTranspose(32, 3, strides=2)`', worked: ['3 × 3 × 16 × 32 + 32 = {g|4,640}: a 3 × 3 kernel per input channel (16) per filter (32), plus a bias per filter, as slide 6 prints'] },
      ],
    },
  ],
  skip: 'the full listing, the `summary()` table and the totals (13,873 for `conv_decoder`, 54,479 for `conv_ae`).',
};
