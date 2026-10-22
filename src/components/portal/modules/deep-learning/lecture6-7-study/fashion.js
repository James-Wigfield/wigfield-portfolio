import { useEffect, useMemo, useState } from 'react';
import { makeDecoder } from './gen';

/* ============================================================================
   LECTURES 6–7 STUDY — FASHION MNIST RUNS (lazy)
   ----------------------------------------------------------------------------
   ./data holds this page's own TensorFlow runs of the slides' models
   (tools/dl-lecture6-7-study/pipeline.py): conv_ae and dropout_ae
   reconstructions, the VAE's decoder weights (so the page can decode new
   codings live) with a few images' codings, and GAN / DCGAN samples. Each
   file loads on demand, once, the first time a lab asks for it (or Export
   PDF does).
   ========================================================================== */

let convP = null;
let denoiseP = null;
let vaeP = null;
let ganP = null;
let dcganP = null;
export const loadConv = () => (convP ??= import('./data/conv.js'));
export const loadDenoise = () => (denoiseP ??= import('./data/denoise.js'));
export const loadVae = () => (vaeP ??= import('./data/vae.js'));
export const loadGan = () => (ganP ??= import('./data/gan.js'));
export const loadDcgan = () => (dcganP ??= import('./data/dcgan.js'));
export const loadAll = () => Promise.all([loadConv(), loadDenoise(), loadVae(), loadGan(), loadDcgan()]);

// Fashion MNIST's ten class names, in label order (the dataset's, not the slides')
export const CLASS_NAMES = ['T-shirt/top', 'Trouser', 'Pullover', 'Dress', 'Coat', 'Sandal', 'Shirt', 'Sneaker', 'Bag', 'Ankle boot'];

// one data module, or null while it loads (or if it fails)
export function useData(loader) {
  const [mod, setMod] = useState(null);
  useEffect(() => {
    let live = true;
    loader()
      .then((m) => { if (live) setMod(m); })
      .catch(() => {});
    return () => { live = false; };
  }, [loader]);
  return mod;
}

// The VAE data and its decoder, built once (dequantising the weights takes a
// moment): { VAE, dec } or null while loading.
const decoders = new WeakMap();
function decoderFor(VAE) {
  if (!decoders.has(VAE)) decoders.set(VAE, makeDecoder(VAE));
  return decoders.get(VAE);
}
export function useVae() {
  const mod = useData(loadVae);
  return useMemo(() => (mod ? { VAE: mod.VAE, dec: decoderFor(mod.VAE) } : null), [mod]);
}

// base64 of 784 uint8 bytes (0 = background, 255 = full ink) → Uint8Array
export function decodeImg(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
