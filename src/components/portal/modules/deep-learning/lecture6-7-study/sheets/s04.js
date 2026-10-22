// §4 · The VAE's loss: reconstruction + latent loss (slides 12–13)
export default {
  blocks: [
    {
      id: 'two',
      h: 'The loss has two parts',
      at: '12–13',
      items: [
        'The {g|reconstruction loss} pushes the autoencoder to reproduce its inputs.',
        'The {g|latent loss} pushes the codings to look sampled from a simple Gaussian. It is the Kullback-Leibler divergence between that Gaussian and the codings’ distribution.',
        'During training the codings migrate within the coding space (the {g|latent space}) until they look like a cloud of Gaussian points.',
      ],
    },
    {
      id: 'latent',
      h: 'The latent loss',
      at: '12',
      items: [
        { line: 'Slide 12 first writes it with σ: $\\mathscr{L} = -\\tfrac{1}{2}\\sum_{i=1}^{n}[1 + \\log(\\sigma_i^2) - \\sigma_i^2 - \\mu_i^2]$, where n is the codings’ dimension.' },
        'In practice the encoder outputs {g|γ = log(σ²)} instead of σ: it is more numerically stable, and training is faster.',
        { formula: '\\mathscr{L} = -\\frac{1}{2}\\sum_{i=1}^{n}\\left[1 + \\gamma_i - \\exp\\left(\\gamma_i\\right) - \\mu_i^2\\right]', read: 'the same loss, since σᵢ² = exp(γᵢ)' },
      ],
      margin: [
        { nb: 'Each term is 0 at μᵢ = 0, σᵢ = 1 (γᵢ = 0) and positive anywhere else (this page’s working).' },
        { q: 'What must μ and γ be for the latent loss to be 0?', a: 'μᵢ = 0 and γᵢ = 0 (so σᵢ = 1) in every coding dimension.' },
        { sc: 'slide 12 calls the decoder’s layers Hidden 3 and Hidden 4; Figure 17-11 labels them Hidden 4 and Hidden 5.' },
      ],
    },
  ],
  skip: 'footnote 3 (the original paper and Doersch’s tutorial).',
};
