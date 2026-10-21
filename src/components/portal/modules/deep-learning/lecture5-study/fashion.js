import { useEffect, useState } from 'react';

/* ============================================================================
   LECTURE 5 STUDY — FASHION MNIST SAMPLES (lazy)
   ----------------------------------------------------------------------------
   ./data holds this page's own Fashion MNIST run (reconstructions by
   stacked_ae, tied_ae and stacked_ae_1_by_1, their training curves, and a
   t-SNE map of 5,000 validation codings) — about 117 KB, so it loads on
   demand, once, the first time a lab asks for it (or Export PDF does).
   ========================================================================== */

let reconP = null;
let tsneP = null;
export const loadRecon = () => (reconP ??= import('./data/recon.js'));
export const loadTsne = () => (tsneP ??= import('./data/tsne.js'));
export const loadAll = () => Promise.all([loadRecon(), loadTsne()]);

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

// base64 of 784 uint8 bytes (0 = background, 255 = full ink) → Uint8Array
export function decodeImg(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
