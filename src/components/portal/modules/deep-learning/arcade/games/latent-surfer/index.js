/* Latent Surfer — the manifest (frozen contract, tools/dl-arcade/PLAN.md). */
import { Glyph } from './glyph.jsx';
import { LEVEL_NAMES } from '../../content/latent-surfer.js';

export default {
  id: 'latent-surfer',
  title: 'Latent Surfer',
  lectures: [6],
  concepts: ['vae.latentSpace', 'vae.sampling', 'vae.gamma', 'vae.latentLoss', 'vae.interpolation', 'vae.totalLoss', 'vae.encoderOutputs'],
  blurb: 'Steer through this page’s own trained VAE: find a sneaker, catch a sample, interpolate, read the latent-loss heat.',
  color: '--dlv-yellow',
  levels: 3,
  levelNames: LEVEL_NAMES,
  glyph: Glyph,
  load: () => import('./LatentSurfer.jsx'),
};
