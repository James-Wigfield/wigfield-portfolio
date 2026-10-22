// §3 · Variational autoencoders: what's different (slides 10–11)
export default {
  blocks: [
    {
      id: 'diff',
      h: 'What makes a VAE different',
      at: '10',
      items: [
        'A VAE is {g|probabilistic}: its outputs are partly determined by chance, even after training.',
        'It is {g|generative}: it can generate new instances that look like they were sampled from the training set.',
      ],
      margin: [
        { q: 'How is a VAE’s randomness different from a denoising autoencoder’s?', a: 'A VAE’s outputs are partly random even after training; a denoising autoencoder uses randomness only during training.' },
      ],
    },
    {
      id: 'how',
      h: 'Mean and standard deviation codings',
      at: '11',
      fig: { key: 'vae', hl: ['codings', 'sample'], cap: 'Figure 17-11 (left): label μ, σ, the Gaussian noise, × and +.', place: 'side' },
      items: [
        'The encoder learns a {g|mean coding μ} and a {g|standard deviation coding σ}.',
        'A coding is sampled from that Gaussian, noise × σ + μ, and the decoder reconstructs the input from it.',
      ],
    },
  ],
  skip: 'the right half of Figure 17-11 (an instance going through it).',
};
