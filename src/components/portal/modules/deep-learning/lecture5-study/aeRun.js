import { AE_DEFAULTS, make3D, pca, trainAE } from './ae';

/* ============================================================================
   LECTURE 5 STUDY — THIS PAGE'S OWN RUN OF SLIDES 8–9
   ----------------------------------------------------------------------------
   Computed once, at import: this page's 60-point 3D set, its PCA, and
   Figure 17-1's linear autoencoder trained on it with slides 8–9's settings
   (SGD, learning_rate=0.5, 500 epochs, MSE, mini-batches of 32). Seeded, so
   every visit, the labs in §2–§3 and the PDF all show the same run.
   ========================================================================== */

export const X3 = make3D();
export const PCA3 = pca(X3);
export const RUN = trainAE(X3, AE_DEFAULTS);
