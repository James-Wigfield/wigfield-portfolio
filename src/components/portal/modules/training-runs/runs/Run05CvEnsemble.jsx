import { RunPage, Verdict, Section, Prose, StatGrid, LineChart, MetricTable, Findings, NextSteps, CodeBlock, OnePager, OpCols, OpBlock } from '../kit';

/* ============================================================================
   RUN 05 — FIVE-FOLD CROSS-VALIDATION + DEEP-PSMA CORPUS · THE SEALED TEST SET
   ----------------------------------------------------------------------------
   All numbers real. Sources, in the Mamba_PSMA repo:
     hpc-documentation/run5-cv-results-and-test-protocol.md   CV results, the
                                                              pre-registered
                                                              test protocol
     hpc-documentation/run5-test-home-results.md              test-set scoring
     evaluation/results/run5-cv/cv_summary.json               pooled OOF
     evaluation/results/run5-fold<k>/                         per-fold eval
     evaluation/results/run5-test-home/test_summary.json      test set
     run-archives/run5/*_run5_fold<k>/train.log               val-Dice curves
                                                              (every 25 epochs,
                                                              as logged)

   Run 4's recipe — the organ-supervised CNN–Mamba U-Net — is unchanged. What
   changed is the EXPERIMENT: five stratified folds instead of one fixed split,
   the DeepPSMA open data pooled with autoPET (697 cases, 130 sealed for test),
   the supervisors' verbatim any-overlap metrics script instead of the IoU
   matcher, and a five-model mean-probability ensemble at inference. Everything
   about the test set was fixed in writing before the first test inference.

   Validation Dice is measured on each fold's FIRST 20 val cases
   (training.val_max_cases = 20), as in run 4. Five folds is one series too
   many for a kit chart, so the curves are shown as the fold ENVELOPE — mean,
   best-at-that-epoch, worst-at-that-epoch — with run 4's single-split curve
   for continuity. The per-fold peaks are in the table beneath it.

   Test-set numbers on this page are from the HOME reproduction (RTX 5070 Ti)
   on the exact preprocessed tensors DEMETER built. DEMETER's own scoring was
   not in git when this page was written — see the last finding.
   ========================================================================== */

/* ---- validation Dice, every 25 epochs, first 20 val cases of each fold ----- */
const F0_VAL = [[25, 0.408], [50, 0.457], [75, 0.314], [100, 0.445], [125, 0.458], [150, 0.509], [175, 0.463], [200, 0.457], [225, 0.414], [250, 0.467], [275, 0.503], [300, 0.525], [325, 0.492], [350, 0.494], [375, 0.542], [400, 0.553], [425, 0.535], [450, 0.567], [475, 0.542], [500, 0.537], [525, 0.539], [550, 0.530], [575, 0.523], [600, 0.561], [625, 0.551], [650, 0.535], [675, 0.539], [700, 0.549], [725, 0.519], [750, 0.532], [775, 0.523], [800, 0.539], [825, 0.550], [850, 0.543], [875, 0.523], [900, 0.534], [925, 0.529], [950, 0.531], [975, 0.533], [1000, 0.532]];
const F1_VAL = [[25, 0.402], [50, 0.455], [75, 0.465], [100, 0.447], [125, 0.471], [150, 0.493], [175, 0.506], [200, 0.475], [225, 0.579], [250, 0.491], [275, 0.533], [300, 0.477], [325, 0.507], [350, 0.521], [375, 0.573], [400, 0.572], [425, 0.567], [450, 0.517], [475, 0.537], [500, 0.578], [525, 0.507], [550, 0.595], [575, 0.577], [600, 0.591], [625, 0.596], [650, 0.564], [675, 0.626], [700, 0.561], [725, 0.620], [750, 0.623], [775, 0.633], [800, 0.604], [825, 0.623], [850, 0.613], [875, 0.619], [900, 0.613], [925, 0.617], [950, 0.617], [975, 0.618], [1000, 0.618]];
const F2_VAL = [[25, 0.452], [50, 0.488], [75, 0.505], [100, 0.523], [125, 0.526], [150, 0.479], [175, 0.476], [200, 0.527], [225, 0.548], [250, 0.479], [275, 0.493], [300, 0.562], [325, 0.552], [350, 0.499], [375, 0.503], [400, 0.502], [425, 0.526], [450, 0.539], [475, 0.518], [500, 0.560], [525, 0.502], [550, 0.519], [575, 0.512], [600, 0.512], [625, 0.564], [650, 0.575], [675, 0.502], [700, 0.513], [725, 0.512], [750, 0.523], [775, 0.511], [800, 0.507], [825, 0.563], [850, 0.559], [875, 0.512], [900, 0.512], [925, 0.509], [950, 0.508], [975, 0.507], [1000, 0.507]];
const F3_VAL = [[25, 0.348], [50, 0.346], [75, 0.405], [100, 0.378], [125, 0.162], [150, 0.454], [175, 0.440], [200, 0.328], [225, 0.430], [250, 0.477], [275, 0.443], [300, 0.478], [325, 0.464], [350, 0.426], [375, 0.464], [400, 0.463], [425, 0.476], [450, 0.529], [475, 0.497], [500, 0.479], [525, 0.518], [550, 0.498], [575, 0.481], [600, 0.495], [625, 0.554], [650, 0.506], [675, 0.503], [700, 0.548], [725, 0.500], [750, 0.495], [775, 0.497], [800, 0.504], [825, 0.494], [850, 0.505], [875, 0.503], [900, 0.497], [925, 0.501], [950, 0.505], [975, 0.504], [1000, 0.504]];
const F4_VAL = [[25, 0.443], [50, 0.408], [75, 0.432], [100, 0.492], [125, 0.431], [150, 0.467], [175, 0.503], [200, 0.486], [225, 0.524], [250, 0.508], [275, 0.511], [300, 0.551], [325, 0.515], [350, 0.537], [375, 0.535], [400, 0.518], [425, 0.593], [450, 0.594], [475, 0.577], [500, 0.549], [525, 0.527], [550, 0.592], [575, 0.531], [600, 0.588], [625, 0.605], [650, 0.574], [675, 0.600], [700, 0.623], [725, 0.617], [750, 0.616], [775, 0.586], [800, 0.622], [825, 0.621], [850, 0.608], [875, 0.598], [900, 0.591], [925, 0.597], [950, 0.598], [975, 0.600], [1000, 0.602]];
/* run 4's curve, duplicated from Run04OrganSupervision.jsx — run pages stay self-contained */
const RUN4_VAL = [[25, 0.37], [50, 0.43], [75, 0.459], [100, 0.475], [125, 0.44], [150, 0.5], [175, 0.515], [200, 0.502], [225, 0.497], [250, 0.557], [275, 0.517], [300, 0.509], [325, 0.51], [350, 0.483], [375, 0.509], [400, 0.532], [425, 0.535], [450, 0.54], [475, 0.559], [500, 0.567], [525, 0.56], [550, 0.575], [575, 0.56], [600, 0.547], [625, 0.584], [650, 0.573], [675, 0.56], [700, 0.587], [725, 0.56], [750, 0.583], [775, 0.575], [800, 0.579], [825, 0.581], [850, 0.583], [875, 0.573], [900, 0.574], [925, 0.577], [950, 0.575], [975, 0.574], [1000, 0.575]];

const FOLDS = [F0_VAL, F1_VAL, F2_VAL, F3_VAL, F4_VAL];
const envelope = (pick) => F0_VAL.map(([epoch], i) => [epoch, +pick(FOLDS.map((f) => f[i][1])).toFixed(3)]);
const VAL_MEAN = envelope((v) => v.reduce((a, b) => a + b, 0) / v.length);
const VAL_MAX = envelope((v) => Math.max(...v));
const VAL_MIN = envelope((v) => Math.min(...v));

/* ---- headline ---------------------------------------------------------------- */
const HEADLINE = [
  { v: '84.3%', k: 'test lesion F1 · ensemble', note: 'Five-model mean-probability ensemble on the 130 sealed test cases, threshold 0.5, ≥10 voxels — the pre-registered headline. Single models 83.1 ± 0.6.' },
  { v: '82.4%', k: 'test sensitivity', note: 'The project’s stated bottleneck. Baseline 73.0%. PPV 86.2% against the baseline’s 88.2%.' },
  { v: '81.8%', k: 'CV lesion F1 · pooled out-of-fold', note: '567 pool cases, every one judged by a model that never saw it. Per-fold spread 1.5 points.' },
  { v: '0.633', k: 'best fold val Dice', note: 'Fold 1, epoch 775. Folds peak between 0.554 and 0.633 on their first 20 val cases — the same selection rule as run 4 (0.587).' },
  { v: '4 d 6 h', k: 'wall-clock · CV', note: 'Five × 250k iterations, ~33 h of training per fold on DEMETER’s 4090s, plus 3–7 h of CPU threshold sweeps per fold. Test scoring at home: 4 h 34 min.' },
];

/* ---- what changed from run 4 ----------------------------------------------- */
const CHANGES = {
  columns: ['what changed', 'run 4', 'run 5'],
  rows: [
    { cells: ['split', 'one fixed 430 / 57 / 110', 'five stratified folds — every pool case held out once; 130-case test set sealed and shared by all folds'] },
    { cells: ['corpus', 'autoPET 597', 'autoPET 597 + DeepPSMA 100 = 697 · 567 pool + 130 test'], accent: true },
    { cells: ['inference', 'one model', 'five-model per-voxel mean of sigmoid maps (nnU-Net’s fold-ensembling rule) · single models reported alongside'], accent: true },
    { cells: ['metrics script', 'own matcher, IoU ≥ 0.1 one-to-one', 'supervisors’ PSMA_Auto_Seg script, verbatim — any-overlap, no one-to-one constraint'] },
    { cells: ['patient accuracy', 'credited any prediction on a positive scan', 'requires tp > 0 (fixed 01 Sep, before CV was scored)'] },
    { cells: ['everything else', 'organ head on · 2 mm grid · 96×192×96 · Tversky+BCE · lr 1e-3 · clip 12 · 250k iters', 'identical'] },
  ],
};

/* ---- best checkpoints -------------------------------------------------------- */
const BEST_CKPT = {
  columns: ['fold', 'train / val / test', 'best iter', 'epoch', 'val Dice (first 20)', 'final val Dice', 'seed'],
  rows: [
    { cells: ['0', '500 / 67 / 130', '112,500', '450', '0.567', '0.532', '42'] },
    { cells: ['1', '442 / 125 / 130', '193,750', '775', '0.633', '0.618', '43'], accent: true },
    { cells: ['2', '442 / 125 / 130', '162,500', '650', '0.575', '0.507', '44'] },
    { cells: ['3', '442 / 125 / 130', '156,250', '625', '0.554', '0.504', '45'] },
    { cells: ['4', '442 / 125 / 130', '175,000', '700', '0.623', '0.602', '46'] },
  ],
};

/* ---- cross-validation, out-of-fold ----------------------------------------- */
const CV = {
  columns: ['row', 'cases', 'F1', 'PPV', 'sens', 'voxel DSC', 'patient acc', 'TP / FP / FN'],
  rows: [
    { cells: ['fold 0', '67', '83.8', '87.0', '80.8', '58.2', '85.1', '2138 / 319 / 508'] },
    { cells: ['fold 1', '125', '82.4', '79.3', '85.6', '58.4', '89.6', '4135 / 1077 / 694'] },
    { cells: ['fold 2', '125', '80.2', '78.6', '81.8', '57.5', '90.4', '3158 / 859 / 704'] },
    { cells: ['fold 3', '125', '82.9', '80.1', '85.9', '56.6', '84.8', '3840 / 952 / 631'] },
    { cells: ['fold 4', '125', '80.6', '80.7', '80.5', '60.8', '89.6', '4084 / 978 / 990'] },
    { cells: ['per-fold mean ± sd', '', '82.0 ± 1.5', '81.2 ± 3.4', '82.9 ± 2.6', '58.3 ± 1.6', '87.9 ± 2.7', ''] },
    { cells: ['pooled — all 567 out-of-fold cases', '567', '81.8', '80.6', '83.1', '58.3', '88.2', '17355 / 4185 / 3527'], accent: true },
    { cells: ['autoPET cohort', '487', '81.2', '77.1', '85.7', '54.5', '86.2', '13313 / 3958 / 2215'] },
    { cells: ['DeepPSMA cohort', '80', '84.0', '94.7', '75.5', '79.3', '100.0', '4042 / 227 / 1312'] },
    { cells: ['fold 0, autoPET only — run 4’s 57 val scans', '57', '84.5', '83.9', '85.0', '53.3', '82.5', ''] },
    { cells: ['run 4 on the same 57 scans (no DeepPSMA in training)', '57', '85.5', '85.3', '85.6', '52.4', '80.7', ''] },
    { cells: ['nnU-Net baseline · its own test set · same metrics script', '', '79.9', '88.2', '73.0', '', '94.5', ''] },
  ],
};

/* ---- operating point, pooled over the five folds --------------------------- */
const OPERATING = {
  columns: ['threshold', 'min voxels', 'F1', 'PPV', 'sens', 'per-fold F1 (0 / 1 / 2 / 3 / 4)'],
  rows: [
    { cells: ['0.3', '0', '80.3', '74.7', '86.8', '83.2 / 80.8 / 77.6 / 80.9 / 80.0'] },
    { cells: ['0.3', '10', '82.0', '80.2', '83.9', '84.3 / 82.3 / 80.2 / 83.0 / 81.0'] },
    { cells: ['0.5', '0', '80.4', '75.2', '86.2', '83.0 / 80.9 / 78.1 / 81.0 / 79.7'] },
    { cells: ['0.5', '10', '81.8', '80.6', '83.1', '83.8 / 82.4 / 80.2 / 82.9 / 80.6'], accent: true },
    { cells: ['0.5', '25', '81.5', '83.6', '79.6', ''] },
    { cells: ['0.5', '100', '67.3', '90.6', '53.5', ''] },
    { cells: ['0.7', '10', '81.7', '80.9', '82.5', ''] },
    { cells: ['0.9', '10', '81.5', '81.5', '81.5', ''] },
    { cells: ['0.95', '10', '81.4', '81.8', '80.9', ''] },
  ],
};

/* ---- the pre-registered test protocol -------------------------------------- */
const PROTOCOL = {
  columns: ['decision', 'fixed as — 07 Sep 2026, before any test inference'],
  rows: [
    { cells: ['test set', '130 cases (110 autoPET + 20 DeepPSMA), byte-identical in every fold, never trained on, never used for selection'] },
    { cells: ['models', 'the five checkpoint_best.pth — checkpoint_last is not used'] },
    { cells: ['threshold', '0.5, the baseline’s implicit rule (nnU-Net sigmoid > 0.5)'] },
    { cells: ['size filter', 'two rows from one pass: ≥10 voxels (headline, 0.124 mL ≈ one PET resolution element) and none (baseline-equivalent)'], accent: true },
    { cells: ['combination', 'each checkpoint alone → mean ± sd across models; plus the five-model per-voxel mean of sigmoid maps as the headline model'], accent: true },
    { cells: ['inference', 'tiled sliding window, overlap 0.5, no TTA — identical to validation'] },
    { cells: ['reporting', 'pooled 130, autoPET 110, DeepPSMA 20 · lesion F1 / PPV / sens from pooled TP/FP/FN · voxel DSC · patient accuracy · raw counts'] },
    { cells: ['after scoring', 'numbers recorded as they come; no threshold, filter, checkpoint or ensemble change follows from them'] },
  ],
};

/* ---- test set ---------------------------------------------------------------- */
const TEST = {
  columns: ['pooled · 130 cases · thr 0.5 · ≥10 vox', 'F1', 'PPV', 'sens', 'voxel DSC', 'patient acc', 'TP / FP / FN'],
  rows: [
    { cells: ['fold 0 checkpoint', '82.5', '83.8', '81.2', '57.3', '87.7', '3697 / 715 / 857'] },
    { cells: ['fold 1 checkpoint', '83.4', '82.8', '84.1', '57.6', '88.5', '3832 / 798 / 722'] },
    { cells: ['fold 2 checkpoint', '82.4', '83.1', '81.7', '58.2', '90.0', '3722 / 758 / 832'] },
    { cells: ['fold 3 checkpoint', '83.3', '84.0', '82.6', '57.7', '86.2', '3763 / 717 / 791'] },
    { cells: ['fold 4 checkpoint', '83.8', '85.8', '81.9', '57.1', '86.2', '3728 / 619 / 826'] },
    { cells: ['single models, mean ± sd', '83.1 ± 0.6', '83.9 ± 1.2', '82.3 ± 1.1', '57.6 ± 0.4', '87.7 ± 1.6', ''] },
    { cells: ['five-model ensemble — headline', '84.3', '86.2', '82.4', '59.6', '89.2', '3754 / 600 / 800'], accent: true },
    { cells: ['nnU-Net baseline · its own test set', '79.9', '88.2', '73.0', '', '94.5', ''] },
  ],
};

const TEST_COHORTS = {
  columns: ['thr 0.5 · ≥10 vox', 'n', 'F1', 'PPV', 'sens', 'voxel DSC', 'patient acc', 'TP / FP / FN'],
  rows: [
    { cells: ['autoPET · single models', '110', '82.5 ± 0.5', '79.8 ± 1.4', '85.5 ± 1.2', '52.5 ± 0.4', '85.5 ± 1.9', ''] },
    { cells: ['autoPET · ensemble', '110', '84.3', '82.7', '85.9', '54.6', '87.3', '2660 / 555 / 438'], accent: true },
    { cells: ['DeepPSMA · single models', '20', '84.4 ± 1.0', '95.7 ± 0.6', '75.6 ± 2.0', '83.4 ± 0.6', '100.0', ''] },
    { cells: ['DeepPSMA · ensemble', '20', '84.3', '96.0', '75.1', '85.1', '100.0', '1094 / 45 / 362'], accent: true },
  ],
};

const TEST_RAW = {
  columns: ['pooled · 130 cases · thr 0.5 · no size filter', 'F1', 'PPV', 'sens', 'voxel DSC', 'patient acc', 'TP / FP / FN'],
  rows: [
    { cells: ['single models, mean ± sd', '81.9 ± 0.7', '78.5 ± 1.3', '85.7 ± 0.8', '57.6 ± 0.4', '88.0 ± 1.3', ''] },
    { cells: ['five-model ensemble', '83.8', '82.0', '85.6', '59.6', '89.2', '3897 / 855 / 657'], accent: true },
    { cells: ['ensemble · autoPET 110', '82.6', '77.5', '88.3', '54.6', '87.3', '2737 / 793 / 361'] },
    { cells: ['ensemble · DeepPSMA 20', '86.6', '94.9', '79.7', '85.1', '100.0', '1160 / 62 / 296'] },
    { cells: ['nnU-Net baseline · no size filter · its own test set', '79.9', '88.2', '73.0', '', '94.5', ''] },
  ],
};

/* ---- findings ---------------------------------------------------------------- */
const FINDINGS = [
  {
    tone: 'ok', t: 'Test agrees with cross-validation — the CV did not over-estimate',
    why: 'Single-model pooled test mean 83.1 / 83.9 / 82.3 (F1 / PPV / sens) against the CV out-of-fold 81.8 / 80.6 / 83.1 at the same operating point. The 130 sealed cases score slightly higher, not lower, so nothing about the folds flattered the model.',
  },
  {
    tone: 'ok', t: 'The ensemble buys precision, not recall',
    why: 'Against the single-model mean the five-model average is +1.2 F1, +2.3 PPV and +2.0 voxel DSC — above every individual checkpoint on all three — while sensitivity moves 82.3 → 82.4. Averaging cancels each model’s private false positives; it cannot find a lesion none of them saw.',
  },
  {
    tone: 'ok', t: 'Sensitivity is 9.4 points above the baseline, at a 2-point PPV cost',
    why: 'Headline ensemble F1 84.3 / PPV 86.2 / sens 82.4 against the reference’s 79.9 / 88.2 / 73.0; without the size filter sens 85.6 / PPV 82.0. Indicative, not paired — the baseline was scored on its own test set at native resolution — but the sensitivity gap the project was framed around has closed and reversed.',
  },
  {
    tone: 'warn', t: 'The two cohorts fail in opposite directions',
    why: 'autoPET: PPV 82.7, sens 85.9, DSC 54.6 — the model over-calls. DeepPSMA: PPV 96.0, sens 75.1, DSC 85.1 — it under-calls. Every one of the five models shows the same split, in CV and on test. DeepPSMA labels are SUV ≥ 3 thresholds that produce ~68 tiny components per scan, tight when hit and easy to miss. This is a labelling-convention difference, and it is the direct evidence for the supervisor’s open question about how the two are reported.',
  },
  {
    tone: 'bad', t: 'Lesion-free scans still collect false alarms',
    why: 'Of the 8 lesion-negative test scans the single models false-alarm on 6–8 and the ensemble on 5; in CV, 38 of 50. Organ supervision reduced false lesions in run 4 but did not close this, and averaging only trims it. Patient-level accuracy is capped by it: 89.2% against the baseline’s 94.5%.',
  },
  {
    tone: 'warn', t: 'The threshold is irrelevant; the 10-voxel filter is worth +1.4 F1',
    why: 'Pooled over five folds, F1 moves 82.0 → 81.4 across thresholds 0.3 → 0.95 at 10 voxels. The filter trades 3 points of sensitivity for 5 of PPV and is the F1 optimum; 25 is defensible if false alarms matter more; 100 halves sensitivity because DeepPSMA lesions are tiny. 0.5 / 10 was chosen under the old matcher and survives the reference rule.',
  },
  {
    tone: 'ok', t: 'Adding DeepPSMA cost nothing on autoPET',
    why: 'Fold 0 scored on run 4’s identical 57 validation scans: F1 84.5 against run 4’s 85.5, inside fold-to-fold noise, with DSC and patient accuracy slightly up. Pooling the second cohort did not shift the first — the pre-run worry about a systematic label shift did not materialise at the aggregate level.',
  },
  {
    tone: 'warn', t: 'Every fold finished below its best checkpoint',
    why: 'Best val Dice arrives between epoch 450 (fold 0) and 775 (fold 1); the final checkpoint sits 0.02–0.07 below it in every fold, and fold 3 lost 0.05. Three of five peaks land before epoch 700. The 250k-iteration schedule buys nothing after its first 60–75%, as run 4 already suggested — the budget, or the learning-rate decay, is worth revisiting before run 6.',
  },
  {
    tone: 'ok', t: 'The scoring is deterministic and the test run is reproducible',
    why: 'Fold 0’s probability maps from DEMETER’s two RTX 4090s were bit-identical (0 flipped voxels in 318 M). The test set was then scored at home on the RTX 5070 Ti from the exact tensors DEMETER built — bundle, cache and checkpoints all SHA256-verified — with every protocol file naming the right folds, iterations and seeds. DEMETER’s own scoring is not yet in git; when it is, the per-case diff is the reproducibility statement.',
  },
];

/* ---- next ---------------------------------------------------------------------- */
const NEXT = [
  { t: 'Settle the run of record and run the per-case diff', why: 'If DEMETER’s scoring ran, commit it and diff per case against the home run — the expectation is identical or ±1 lesion on a few cases from 4090-vs-5070 Ti numerics. If it did not, decide which machine’s numbers go in the write-up. Nothing else on the test set changes either way.' },
  { t: 'Report the two label conventions separately', why: 'The DeepPSMA row is the evidence. Decide with the supervisors whether lesion count or lesion burden is the quantity of interest — evaluation/splitting.py stays opt-in until that is answered.' },
  { t: 'Go after the lesion-negative false alarms directly', why: 'Five of eight clean scans still trip the ensemble. Candidates, validated on the CV folds only: a patient-level gate on total predicted volume or peak probability, and oversampling lesion-free cases in training. The test set stays sealed for run 6.' },
  { t: 'Mirroring test-time augmentation', why: 'The last inference-side asymmetry against the reference, which uses it. Cheap to validate on the folds; the ensemble code already takes several probability maps per case.' },
  { t: 'Shorten or re-shape the schedule', why: 'No fold improved after ~75% of its iterations. Cosine-to-zero or a 175k budget would return roughly a day of GPU time per five-fold run with no expected loss.' },
  { t: 'Re-score runs 1–3 under the reference metrics script', why: 'Runs 4 and 5 are on the supervisors’ rule; the earlier pages are on the IoU matcher. One pass over the archived probability maps makes the project’s history one series.' },
];

/* ---- logs ---------------------------------------------------------------------- */
const LOG_TAIL = `# train.log — fold 1 (the best fold), configuration banner and final lines
split loaded from /data/jameswigfield/Mamba_PSMA/splits/cv/fold1/ (442/125/130 cases)
seed=43 (torch / numpy / random; loader workers and MONAI transforms are not seeded)
train cases=442 val=125 | loss=tversky_bce | amp=True/bfloat16 | lr=0.001 | total_iters=250000
organ supervision=ON (weight 1.0, 25 classes)
grad-clip=12.0 | val=tiled overlap=0.5 | val_max_cases=20
  ...
  epoch  775  val-Dice 0.633  -> new best, saved checkpoint_best.pth
  ...
  epoch 1000  val-Dice 0.618  (best 0.633)
final val-Dice 0.618  ->  saved checkpoints/run5/fold1/checkpoint_last.pth
best val-Dice  0.633  ->  checkpoints/run5/fold1/checkpoint_best.pth

# run5-test-home.log — the test-set scoring, home reproduction (RTX 5070 Ti)
[home] pre-flight OK: 130 test cases, all cached, Mon Sep  7 14:09:57 AWST 2026
[home] protocol: thresholds 0.5 | min_voxels 0 10 | headline = 0.5 / 10 | ensemble = mean of sigmoid maps
[home] 2026-09-07 14:09:57 fold 0 start
[home] 2026-09-07 14:52:28 fold 0 done
[home] 2026-09-07 15:35:28 fold 1 done
[home] 2026-09-07 16:20:37 fold 2 done
[home] 2026-09-07 17:04:41 fold 3 done
[home] 2026-09-07 18:16:00 fold 4 done
[home] 2026-09-07 18:16:00 all five checkpoints scored
[home] 2026-09-07 18:16:00 ensemble start
[home] 2026-09-07 18:44:22 ensemble done
wrote evaluation/results/run5-test-home/test_summary.json
[home] 2026-09-07 18:44:23 finished`;

/* ---- the one-page summary (print-only, second export button) ------------------ */
const OP_STATS = [
  { v: '84.3%', k: 'test lesion F1 · ensemble', note: '130 sealed cases · thr 0.5 · ≥10 vox · single models 83.1 ± 0.6' },
  { v: '82.4%', k: 'test sensitivity', note: 'baseline 73.0 — the project’s bottleneck, +9.4 points' },
  { v: '86.2%', k: 'test PPV', note: 'baseline 88.2 · ensemble +2.3 over the single-model mean' },
  { v: '81.8%', k: 'CV lesion F1 · pooled OOF', note: '567 out-of-fold cases · per-fold spread 1.5 points' },
];

const OP_CHANGES = {
  columns: ['what run 5 is', ''],
  rows: [
    { cells: ['model', 'run 4’s organ-supervised CNN–Mamba U-Net, unchanged'] },
    { cells: ['experiment', 'five stratified folds · 130-case test set sealed and shared'] },
    { cells: ['corpus', 'autoPET 597 + DeepPSMA 100 = 697 (567 pool + 130 test)'] },
    { cells: ['inference', 'five-model mean of sigmoid maps · thr 0.5 · ≥10 voxels'] },
    { cells: ['metrics', 'supervisors’ verbatim any-overlap script; patient acc requires tp > 0'] },
    { cells: ['compute', '5 × 250k iters · ~33 h/fold · DEMETER 4090s · 4 d 6 h wall-clock'] },
  ],
};

const OP_CV = {
  columns: ['cross-validation · out-of-fold', 'n', 'F1', 'PPV', 'sens', 'DSC'],
  rows: [
    { cells: ['pooled, five folds', '567', '81.8', '80.6', '83.1', '58.3'], accent: true },
    { cells: ['per-fold mean ± sd', '', '82.0 ± 1.5', '81.2 ± 3.4', '82.9 ± 2.6', '58.3 ± 1.6'] },
    { cells: ['autoPET cohort', '487', '81.2', '77.1', '85.7', '54.5'] },
    { cells: ['DeepPSMA cohort', '80', '84.0', '94.7', '75.5', '79.3'] },
    { cells: ['best fold val Dice 0.633 (fold 1, epoch 775) · folds range 0.554–0.633', '', '', '', '', ''] },
  ],
};

const OP_TEST = {
  columns: ['sealed test set · 130 cases · pre-registered protocol', 'F1', 'PPV', 'sens', 'DSC', 'pat. acc', 'TP / FP / FN'],
  rows: [
    { cells: ['single models, mean ± sd · thr 0.5 · ≥10 vox', '83.1 ± 0.6', '83.9 ± 1.2', '82.3 ± 1.1', '57.6 ± 0.4', '87.7 ± 1.6', ''] },
    { cells: ['five-model ensemble · thr 0.5 · ≥10 vox — HEADLINE', '84.3', '86.2', '82.4', '59.6', '89.2', '3754 / 600 / 800'], accent: true },
    { cells: ['ensemble · autoPET 110', '84.3', '82.7', '85.9', '54.6', '87.3', '2660 / 555 / 438'] },
    { cells: ['ensemble · DeepPSMA 20', '84.3', '96.0', '75.1', '85.1', '100.0', '1094 / 45 / 362'] },
    { cells: ['ensemble · no size filter (baseline-equivalent)', '83.8', '82.0', '85.6', '59.6', '89.2', '3897 / 855 / 657'] },
    { cells: ['nnU-Net baseline · its own test set · same script', '79.9', '88.2', '73.0', '', '94.5', ''] },
  ],
};

const OP_FINDINGS = [
  { tone: 'ok', t: 'Test agrees with CV', why: 'Single-model test mean 83.1 / 83.9 / 82.3 vs CV out-of-fold 81.8 / 80.6 / 83.1 — no over-estimate.' },
  { tone: 'ok', t: 'Ensemble buys precision, not recall', why: '+1.2 F1, +2.3 PPV, +2.0 DSC over the single-model mean; sensitivity unchanged.' },
  { tone: 'warn', t: 'Cohorts fail in opposite directions', why: 'autoPET over-calls (PPV 82.7 / sens 85.9); DeepPSMA under-calls (PPV 96.0 / sens 75.1). A label-convention difference.' },
  { tone: 'bad', t: 'Lesion-free scans still false-alarm', why: 'Ensemble trips on 5 of 8 negative test scans; single models 6–8. Caps patient accuracy at 89.2%.' },
];

const OP_NEXT = [
  { t: 'Settle the run of record', why: 'Commit DEMETER’s scoring if it ran and diff per case; expect ≤ ±1 lesion on a few cases.' },
  { t: 'Report the two label conventions separately', why: 'Decide count vs burden with the supervisors; splitting stays opt-in until then.' },
  { t: 'Target the lesion-negative false alarms', why: 'Patient-level gate or negative oversampling, validated on the folds; test stays sealed.' },
  { t: 'Mirroring TTA and a shorter schedule', why: 'The last inference asymmetry; no fold improved after ~75% of its iterations.' },
];

function Run05OnePager({ run }) {
  return (
    <OnePager
      run={run}
      lead="Run 4’s organ-supervised Mamba U-Net, re-run as a five-fold cross-validation over autoPET + DeepPSMA and ensembled at inference: lesion F1 84.3% with sensitivity 82.4% on a sealed 130-case test set under a protocol fixed before the first test inference — sensitivity 9.4 points above the nnU-Net baseline at a 2-point PPV cost."
      foot="Sources: evaluation/results/run5-cv/cv_summary.json · evaluation/results/run5-test-home/test_summary.json · hpc-documentation/run5-cv-results-and-test-protocol.md §5 (protocol, pre-registered 07 Sep 2026). Test scoring reproduced at home (RTX 5070 Ti, 4 h 34 min) on DEMETER’s preprocessed tensors, SHA256-verified; checkpoints folds 0–4 at iters 112500 / 193750 / 162500 / 156250 / 175000, seeds 42–46. Metrics: PSMA_Auto_Seg any-overlap rule, pooled TP/FP/FN; DSC over lesion-positive cases. DEMETER’s own test scoring was not in git at time of writing."
    >
      <OpBlock label="Headline" note="sealed test set, five-model ensemble, threshold 0.5, ≥10 voxels">
        <StatGrid stats={OP_STATS} />
      </OpBlock>
      <OpCols>
        <OpBlock label="What changed from run 4" note="the experiment, not the network">
          <MetricTable columns={OP_CHANGES.columns} rows={OP_CHANGES.rows} />
        </OpBlock>
        <OpBlock label="Cross-validation" note="thr 0.5 · ≥10 vox · any-overlap matching">
          <MetricTable columns={OP_CV.columns} rows={OP_CV.rows} />
        </OpBlock>
      </OpCols>
      <OpBlock label="Test set" note="130 cases = 110 autoPET + 20 DeepPSMA · protocol fixed in writing before any test inference">
        <MetricTable columns={OP_TEST.columns} rows={OP_TEST.rows} />
      </OpBlock>
      <OpCols>
        <OpBlock label="Findings">
          <Findings items={OP_FINDINGS} />
        </OpBlock>
        <OpBlock label="What happens next">
          <NextSteps items={OP_NEXT} />
        </OpBlock>
      </OpCols>
    </OnePager>
  );
}

export default function Run05CvEnsemble({ run }) {
  return (
    <RunPage run={run} onePager={<Run05OnePager run={run} />}>
      <Verdict tone="good" lead="The first quotable result: on a sealed 130-case test set, under a protocol fixed before the first test inference, the five-model ensemble reaches lesion F1 84.3% with sensitivity 82.4% — 9.4 points above the nnU-Net baseline on the metric this project set out to move.">
        Run 4&rsquo;s network was not touched. What changed was the experiment: five stratified folds
        over autoPET pooled with DeepPSMA (697 cases, 130 sealed), the supervisors&rsquo; own
        any-overlap metrics script, and a mean-probability ensemble of the five fold models at
        inference. Cross-validation put pooled out-of-fold F1 at 81.8 with a 1.5-point spread across
        folds; the test set then scored higher, not lower, so nothing about the folds flattered the
        model. The ensemble adds precision (PPV 86.2 against 83.9 for the single models) rather than
        recall. Two things remain open: the two cohorts fail in opposite directions for
        label-convention reasons, and lesion-free scans still collect false alarms &mdash; five of
        eight even after ensembling.
      </Verdict>

      <Section label="Headline numbers" note="all measured — nothing estimated">
        <StatGrid stats={HEADLINE} />
      </Section>

      <Section label="What changed from run 4" note="the network is byte-identical; four properties of the experiment moved">
        <MetricTable columns={CHANGES.columns} rows={CHANGES.rows} />
      </Section>

      <Section label="Validation Dice across the folds" note="first 20 val cases per fold, every 25 epochs · five folds is one series too many, so this is the envelope">
        <Prose>
          The mean of the five folds tracks run 4&rsquo;s single-split curve almost exactly, which is
          the first reassurance: a different split and a second cohort did not move the training
          dynamics. The envelope is wide early &mdash; fold 3 dipped to 0.162 at epoch 125 and
          recovered &mdash; and narrows to about 0.1 from epoch 500. Every fold&rsquo;s best
          checkpoint arrives between epoch 450 and 775 and every fold ends below it, by 0.014 to 0.068;
          the last quarter of the schedule bought nothing anywhere.
        </Prose>
        <LineChart
          xLabel="epoch"
          yLabel="validation Dice"
          yDomain={[0, 0.7]}
          series={[
            { name: 'run 5 — mean of the five folds', data: VAL_MEAN },
            { name: 'run 5 — best fold at that epoch', data: VAL_MAX },
            { name: 'run 5 — worst fold at that epoch', data: VAL_MIN },
            { name: 'run 4 — single split, for reference', data: RUN4_VAL },
          ]}
        />
        <MetricTable columns={BEST_CKPT.columns} rows={BEST_CKPT.rows} />
      </Section>

      <Section label="Cross-validation — out-of-fold" note="threshold 0.5 · ≥10 voxels · supervisors’ any-overlap script · pooled = TP/FP/FN summed over cases, then F1/PPV/sens">
        <Prose>
          Every one of the 567 pool cases is scored by the one model that never saw it. The pooled
          row is the headline the reference reports its own way (&ldquo;(global)&rdquo;); the per-fold
          rows show a 1.5-point F1 spread, so the result does not depend on the draw. The two cohorts
          are different animals: DeepPSMA labels are SUV&nbsp;&ge;&nbsp;3 thresholds that produce about
          68 tiny components per scan, so the model under-calls them with very few false positives
          and tight outlines; autoPET labels are clinician contours, and there the model over-calls.
          The last three rows put fold 0 on run 4&rsquo;s identical 57 validation scans: adding
          DeepPSMA to training cost 1.0 F1 there, inside noise.
        </Prose>
        <MetricTable columns={CV.columns} rows={CV.rows} />
      </Section>

      <Section label="Operating point" note="one inference pass per fold, 20 settings, TP/FP/FN pooled over the five folds">
        <Prose>
          Threshold barely matters &mdash; F1 moves 82.0 &rarr; 81.4 across 0.3 &rarr; 0.95 at ten
          voxels &mdash; and 0.5 is both the default and the baseline&rsquo;s implicit rule. The
          10-voxel filter is the F1 optimum, worth +1.4 over no filter by trading 3 points of
          sensitivity for 5 of PPV. Ten of our voxels is 0.124&nbsp;mL, about one PET resolution
          element, so the filter is defensible as &ldquo;smallest detectable lesion&rdquo; and not only
          as an F1 tweak. 100 voxels halves sensitivity because DeepPSMA lesions are tiny. This
          closes the 02 Sep action item to re-run the sweep under the reference rule: 0.5&nbsp;/&nbsp;10
          still wins.
        </Prose>
        <MetricTable columns={OPERATING.columns} rows={OPERATING.rows} />
      </Section>

      <Section label="The test protocol" note="written down on 07 Sep 2026, before any test inference — so nothing on this page was chosen after seeing test numbers">
        <Prose>
          The test set was untouched through four runs and five folds. Before the first test forward
          pass the decisions below were recorded in the protocol document, the ensemble code was built
          and validated on validation data (direct five-model pass and the from-saved-maps pass agree
          to 0.0; 134 of 134 regression rows identical to the stored single-model results), and only
          then were individuals and ensemble scored together in one session. Changing the headline
          row later is allowed only as a reporting convention &mdash; never because one row scores
          higher.
        </Prose>
        <MetricTable columns={PROTOCOL.columns} rows={PROTOCOL.rows} />
      </Section>

      <Section label="Test set — headline protocol" note="130 sealed cases · threshold 0.5 · ≥10 voxels · accent row = the pre-registered headline model">
        <Prose>
          The five single models sit within 1.4 F1 points of one another, and the ensemble clears all
          of them on F1, PPV and voxel DSC while matching them on sensitivity. Read the counts:
          averaging removed about 90 false positives against the median single model and gave up
          nothing in true positives. Patient accuracy (89.2%) is the metric fixed on 01 Sep &mdash; a
          lesion-positive scan counts only when a real lesion is hit &mdash; and the baseline&rsquo;s
          94.5% is on the old, more generous definition.
        </Prose>
        <MetricTable columns={TEST.columns} rows={TEST.rows} />
        <Prose>
          Per cohort the picture from cross-validation repeats exactly. On DeepPSMA the ensemble is
          essentially a single model &mdash; the five agree on those tight, thresholded labels &mdash;
          while on autoPET it gains 1.8 F1 and 2.9 PPV, which is where the models disagreed.
        </Prose>
        <MetricTable columns={TEST_COHORTS.columns} rows={TEST_COHORTS.rows} />
      </Section>

      <Section label="Test set — baseline-equivalent protocol" note="same inference pass, no size filter · the row that compares to the reference’s pipeline, which has no small-component removal">
        <Prose>
          Dropping the filter moves the ensemble +3.2 sensitivity and &minus;4.2 PPV; F1 gives up half
          a point. This row exists for comparability with the baseline, whose scoring counts a single
          voxel as a lesion, and it is the one the supervisors may prefer for that reason. Even here
          the comparison is indicative: the baseline was scored on its own test set at native PET
          resolution, and resampling our ground truth to the 2&nbsp;mm grid can merge or delete tiny
          native lesions before scoring.
        </Prose>
        <MetricTable columns={TEST_RAW.columns} rows={TEST_RAW.rows} />
      </Section>

      <Section label="Findings">
        <Findings items={FINDINGS} />
      </Section>

      <Section label="What happens next" note="developed and validated on the folds — the test set stays sealed for run 6">
        <NextSteps items={NEXT} />
      </Section>

      <Section label="Log" note="the best fold’s train.log and the test-scoring launcher">
        <CodeBlock label="train.log (fold 1) · run5-test-home.log" text={LOG_TAIL} />
      </Section>
    </RunPage>
  );
}
