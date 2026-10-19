/* ============================================================================
   DL PROJECT 2 — FIGURE CAPTIONS
   ----------------------------------------------------------------------------
   One line per notebook figure, keyed by the extractor's file name
   (cell<index>_<k>.png). It is the image's alt text on screen and a
   print-only caption under it in the PDF, so a reader of the extracted text
   (NotebookLM) knows a plot sits there and what it shows. Written from each
   figure's own title, axes and legend and the cell's printed text; no values
   that the figure or the notebook does not show. If the notebook is
   re-extracted and the figures move, check these keys (a missing key falls
   back to "Figure · Out [n]").
   ========================================================================== */

const SEQ = 'inputs solid, the 12 target months dashed with dots, minimum in blue and maximum in red, a grey line where the input ends';
const PRED = 'inputs solid, targets dashed with dots, predictions dotted with crosses; minimum in blue, maximum in red';
const CURVE = 'training and validation per epoch, the restored epoch dotted';

export const FIG_CAPTIONS = {
  'cell12_0.png': `Training set (Perth Airport, Jandakot Aero, Perth Metro): three random training sequences, 566, 1101 and 1474; ${SEQ}.`,
  'cell12_1.png': `Validation set (Swanbourne): sequences 182, 56 and 86; ${SEQ}.`,
  'cell12_2.png': `Test set (Bickley): sequences 240, 257 and 220; ${SEQ}.`,
  'cell18_0.png': `Model 1 learning curves: MSE loss (left) and MAE in °C (right), ${CURVE} (epoch 46).`,
  'cell20_0.png': `Model 1: 12-month predictions on the test set for sequences 95, 259 and 140; ${PRED}.`,
  'cell24_0.png': `Model 2 (1 month ahead) learning curves: MSE loss (left) and MAE in °C (right), ${CURVE} (epoch 20).`,
  'cell26_0.png': `Model 2: 1-month predictions on the test set for sequences 95, 259 and 140, one target month each; ${PRED}.`,
  'cell28_0.png': `Model 2: 12 months predicted recursively on the test set for sequences 95, 259 and 140; ${PRED}.`,
  'cell32_0.png': `Model 3 (teacher forcing) learning curves: MSE loss (left) and MAE in °C (right), ${CURVE} (epoch 30); both curves are teacher-forced.`,
  'cell34_0.png': `Model 3: 12-month predictions on the test set for sequences 95, 259 and 140; ${PRED}.`,
  'cell37_0.png': 'Test MAE against prediction horizon (12, 15, 18, 21 and 24 months): model 2 (blue) and model 3 (orange) solid, seasonal naive (green) and climatology (red) dashed.',
  'cell38_0.png': 'Error by lead month at the 24-month horizon: test MAE for each month ahead, 1 to 24, for model 2 (blue), model 3 (orange), seasonal naive (green, dashed) and climatology (red, dashed); a grey line at 12.5 marks the end of part (i)’s 12-month targets.',
  'cell45_0.png': `VAE learning curves: reconstruction MSE plus the weighted KL term (left) and reconstruction MSE in z-score units (right), ${CURVE} (epoch 23).`,
  'cell48_0.png': 'Six synthesised 84-month maximum temperature sequences in °C, decoded from codings drawn from N(0, I).',
  'cell48_1.png': 'Six real training sequences of maximum temperature, chosen at random, on the same axes for comparison.',
};
