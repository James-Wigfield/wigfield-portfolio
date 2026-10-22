// §5 · Implementing a VAE in Keras (slides 14–15)
export default {
  blocks: [
    {
      id: 'keras',
      h: 'The VAE in Keras',
      at: '14–15',
      items: [
        'The `Sampling` layer draws each coding as ε × exp(γ / 2) + μ, and adds the latent loss (averaged over the batch, ÷ 784) with `add_loss`.',
        'The encoder outputs [μ, γ, codings]; the decoder turns codings back into a 28 × 28 image.',
        'It is compiled with `loss="mse"`, the reconstruction loss, and trained for 25 epochs with batch size 128.',
      ],
      margin: [
        { q: 'Why does `Sampling` compute `tf.exp(logvar / 2)`?', a: '`logvar` is γ = log(σ²), so exp(γ / 2) = σ, the standard deviation that scales the noise.' },
        { sc: 'the VAE’s `codings_size` is never set; slide 16 says the codings are 10-dimensional.' },
      ],
    },
  ],
  skip: 'the full listing, the layer sizes and the parameter counts (slide 15’s exercise).',
};
