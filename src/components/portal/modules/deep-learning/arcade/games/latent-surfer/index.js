/* Latent Surfer — PLACEHOLDER manifest; the game builder replaces this file. */
import { Glyph } from './glyph.jsx';

export default {
  id: 'latent-surfer',
  title: 'Latent Surfer',
  lectures: [6],
  concepts: [],
  blurb: 'Steer through this page’s own trained VAE: find a sneaker, catch a sample, interpolate.',
  color: '--dlv-yellow',
  levels: 3,
  glyph: Glyph,
  load: () => import('./LatentSurfer.jsx'),
};
