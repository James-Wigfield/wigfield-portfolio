// §5 · Implementing a VAE in Keras (slides 14–15)
export default {
  blocks: [
    {
      id: 'keras',
      h: 'The VAE in Keras',
      at: '14–15',
      items: [
        'The `Sampling` layer draws each coding as Gaussian noise × exp(γ / 2) + μ.',
        'The encoder outputs [μ, γ, codings]; the decoder turns codings back into a 28 × 28 image.',
        'The model is compiled with `loss="mse"`, the reconstruction loss; `Sampling` adds the latent loss, averaged over the batch and divided by 784, with `add_loss`.',
      ],
      margin: [
        { q: 'Why does `Sampling` compute `tf.exp(logvar / 2)`?', a: '`logvar` is γ = log(σ²), so exp(γ / 2) = σ, the standard deviation that scales the noise.' },
        { sc: 'the VAE’s `codings_size` is never set; slide 16 says the codings are 10-dimensional.' },
      ],
    },
  ],
  skip: 'the full listing, the layer sizes, the parameter counts (slide 15’s exercise) and the training settings.',
};
