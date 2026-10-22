// §6 · Generating images and semantic interpolation (slides 16–18)
export default {
  blocks: [
    {
      id: 'gen',
      h: 'Generating new images',
      at: '16',
      items: [
        'Sample codings from the normal distribution and decode them with the trained decoder.',
        'Most look fairly convincing, if a bit too fuzzy, and the rest are not great: the codings are only 10-dimensional, and the VAE trained for only 25 epochs.',
      ],
    },
    {
      id: 'interp',
      h: 'Semantic interpolation',
      at: '17–18',
      items: [
        'Interpolate two images at the codings level, not the pixel level, which would look like the two images overlaid.',
        {
          steps: [
            'Run both images through the encoder to get their codings.',
            'Interpolate the two codings.',
            'Decode the interpolated codings.',
          ],
        },
        'Step 1 can be replaced by drawing the two codings from the normal distribution; slide 18 does this, and its 10 decoded codings go from a T-shirt to a Sneaker.',
      ],
      margin: [
        { q: 'Why interpolate the codings rather than the pixels?', a: 'Interpolating pixels just overlays the two images; decoding interpolated codings gives images that change gradually from one item to the other.' },
      ],
    },
  ],
  skip: 'the code on slides 16 and 18.',
};
