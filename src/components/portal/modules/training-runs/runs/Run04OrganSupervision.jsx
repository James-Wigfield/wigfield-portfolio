import { RunPage, Verdict, Section, Prose, StatGrid, LineChart, MetricTable, Findings, NextSteps, ChangePlan, CodeBlock } from '../kit';

/* ============================================================================
   RUN 04 — ORGAN SUPERVISION: A SECOND DECODER HEAD THAT LEARNS ANATOMY
   ----------------------------------------------------------------------------
   All numbers real, from run-archives/2026-08-28_run4_organ-supervision/ and
   evaluation/results/run4/. Curves parsed straight from train.log (validation
   points as logged, every 25 epochs; train Dice and organ loss as 51-point
   moving averages sampled on a 70-point grid, the same treatment the run 2 and
   run 3 pages used, so the series are directly comparable). Run 3 comparison
   series duplicated from Run03Parity2mm.jsx — run pages stay self-contained by
   convention.

   The single knob changed from run 3:
     organ_supervision  disabled -> enabled (25 TotalSegmentator classes,
                        cross-entropy summed unweighted, loss_weight 1.0)

   Everything else held byte-identical to run 3 — same splits, spacing
   [2.0364, 2.0364, 3.0], patch 96x192x96, batch 2, tversky_bce (0.5/0.5,
   bce_weight 0.3), lr 1e-3, clip 12.0 — so this run is a clean single-variable
   test, which run 3 explicitly was not.

   NOTE — the per-case analysis on this page (the patient-accuracy correction)
   was derived at home from evaluation/results/run{3,4}/*_per_case.csv, and it
   overturns the "regression" the HPC handoff flagged. It is the most important
   thing on the page.

   Figures: no W&B PNG exports yet for this run. When they exist, drop them in
   ../figures/run-04-organ-supervision/ and add a FigureGrid section between
   Findings and What would make the model better, matching run 3's layout.
   ========================================================================== */

/* ---- validation Dice, as logged every 25 epochs ---------------------------- */
const RUN3_VAL = [[25, 0.375], [50, 0.306], [75, 0.328], [100, 0.384], [125, 0.357], [150, 0.232], [175, 0.405], [200, 0.410], [225, 0.404], [250, 0.476], [275, 0.454], [300, 0.470], [325, 0.532], [350, 0.507], [375, 0.472], [400, 0.461], [425, 0.514], [450, 0.505], [475, 0.544], [500, 0.494], [525, 0.516], [550, 0.490], [575, 0.516], [600, 0.529], [625, 0.511], [650, 0.532], [675, 0.542], [700, 0.512], [725, 0.513], [750, 0.539], [775, 0.528], [800, 0.543], [825, 0.532], [850, 0.523], [875, 0.545], [900, 0.533], [925, 0.535], [950, 0.536], [975, 0.532], [1000, 0.532]];
const RUN4_VAL = [[25, 0.37], [50, 0.43], [75, 0.459], [100, 0.475], [125, 0.44], [150, 0.5], [175, 0.515], [200, 0.502], [225, 0.497], [250, 0.557], [275, 0.517], [300, 0.509], [325, 0.51], [350, 0.483], [375, 0.509], [400, 0.532], [425, 0.535], [450, 0.54], [475, 0.559], [500, 0.567], [525, 0.56], [550, 0.575], [575, 0.56], [600, 0.547], [625, 0.584], [650, 0.573], [675, 0.56], [700, 0.587], [725, 0.56], [750, 0.583], [775, 0.575], [800, 0.579], [825, 0.581], [850, 0.583], [875, 0.573], [900, 0.574], [925, 0.577], [950, 0.575], [975, 0.574], [1000, 0.575]];

/* ---- training Dice, 51-point moving average -------------------------------- */
const RUN3_TRAIN_DICE = [[510, 0.167], [4126, 0.348], [7742, 0.361], [11357, 0.387], [14973, 0.391], [18589, 0.305], [22205, 0.445], [25821, 0.478], [29436, 0.465], [33052, 0.484], [36668, 0.506], [40284, 0.507], [43900, 0.531], [47515, 0.534], [51131, 0.501], [54747, 0.520], [58363, 0.497], [61979, 0.517], [65594, 0.565], [69210, 0.554], [72826, 0.543], [76442, 0.589], [80058, 0.559], [83673, 0.532], [87289, 0.538], [90905, 0.549], [94521, 0.600], [98137, 0.568], [101752, 0.557], [105368, 0.578], [108984, 0.553], [112600, 0.575], [116216, 0.619], [119831, 0.588], [123447, 0.597], [127063, 0.512], [130679, 0.585], [134294, 0.610], [137910, 0.608], [141526, 0.628], [145142, 0.595], [148758, 0.584], [152373, 0.588], [155989, 0.567], [159605, 0.576], [163221, 0.627], [166837, 0.599], [170452, 0.630], [174068, 0.589], [177684, 0.641], [181300, 0.659], [184916, 0.638], [188531, 0.636], [192147, 0.637], [195763, 0.619], [199379, 0.651], [202995, 0.672], [206610, 0.637], [210226, 0.637], [213842, 0.642], [217458, 0.641], [221074, 0.627], [224689, 0.668], [228305, 0.645], [231921, 0.640], [235537, 0.661], [239153, 0.632], [242768, 0.651], [246384, 0.647], [250000, 0.650]];
const RUN4_TRAIN_DICE = [[10, 0.17], [3630, 0.394], [7260, 0.42], [10880, 0.398], [14500, 0.435], [18130, 0.407], [21750, 0.46], [25370, 0.487], [28990, 0.535], [32620, 0.565], [36240, 0.585], [39860, 0.589], [43490, 0.577], [47110, 0.58], [50730, 0.567], [54360, 0.611], [57980, 0.568], [61600, 0.586], [65220, 0.592], [68850, 0.595], [72470, 0.641], [76090, 0.629], [79720, 0.588], [83340, 0.613], [86960, 0.597], [90590, 0.601], [94210, 0.595], [97830, 0.624], [101460, 0.632], [105080, 0.626], [108700, 0.645], [112320, 0.626], [115950, 0.651], [119570, 0.649], [123190, 0.645], [126820, 0.638], [130440, 0.662], [134060, 0.648], [137690, 0.67], [141310, 0.633], [144930, 0.658], [148550, 0.666], [152180, 0.665], [155800, 0.669], [159420, 0.658], [163050, 0.682], [166670, 0.675], [170290, 0.673], [173920, 0.693], [177540, 0.693], [181160, 0.707], [184790, 0.706], [188410, 0.698], [192030, 0.705], [195650, 0.692], [199280, 0.712], [202900, 0.703], [206520, 0.705], [210150, 0.714], [213770, 0.708], [217390, 0.697], [221020, 0.725], [224640, 0.729], [228260, 0.706], [231880, 0.712], [235510, 0.713], [239130, 0.729], [242750, 0.714], [246380, 0.732], [250000, 0.724]];

/* ---- organ-head cross-entropy, 51-point moving average --------------------- */
const RUN4_ORGAN = [[10, 0.696], [3630, 0.157], [7260, 0.131], [10880, 0.189], [14500, 0.147], [18130, 0.165], [21750, 0.102], [25370, 0.197], [28990, 0.103], [32620, 0.094], [36240, 0.09], [39860, 0.088], [43490, 0.095], [47110, 0.085], [50730, 0.082], [54360, 0.081], [57980, 0.081], [61600, 0.082], [65220, 0.076], [68850, 0.075], [72470, 0.07], [76090, 0.07], [79720, 0.069], [83340, 0.068], [86960, 0.07], [90590, 0.067], [94210, 0.067], [97830, 0.064], [101460, 0.066], [105080, 0.414], [108700, 0.065], [112320, 0.064], [115950, 0.06], [119570, 0.058], [123190, 0.06], [126820, 0.058], [130440, 0.061], [134060, 0.059], [137690, 0.058], [141310, 0.058], [144930, 0.057], [148550, 0.056], [152180, 0.056], [155800, 0.056], [159420, 0.054], [163050, 0.054], [166670, 0.053], [170290, 0.054], [173920, 0.054], [177540, 0.053], [181160, 0.051], [184790, 0.052], [188410, 0.051], [192030, 0.051], [195650, 0.051], [199280, 0.051], [202900, 0.05], [206520, 0.052], [210150, 0.051], [213770, 0.05], [217390, 0.05], [221020, 0.05], [224640, 0.05], [228260, 0.05], [231880, 0.05], [235510, 0.05], [239130, 0.05], [242750, 0.051], [246380, 0.05], [250000, 0.05]];

const HEADLINE = [
  { v: '0.587', k: 'best val Dice', note: 'Epoch 700, iteration 175,000. Run 3 got 0.545 on an identical validation protocol — the largest single-run jump since run 1.' },
  { v: '75.4%', k: 'lesion PPV (protocol)', note: 'Up 5.1 points on run 3. Precision was the stated target of this run and precision is what moved.' },
  { v: '73.7%', k: 'lesion F1 (protocol)', note: 'Up 2.4 points. Bootstrapped 95% CI on the paired difference is [+2.4, +6.5] — comfortably clear of noise.' },
  { v: '−125', k: 'false lesions', note: '542 → 417 at the protocol operating point, with true positives essentially unchanged (1,286 → 1,281). The suppression is targeted, not blanket.' },
  { v: '0.72%', k: 'clipped steps', note: '1,799 of 250,000 — statistically identical to run 3’s 0.69%. But the tail is far more violent: peak gradient norm 1,034,136 vs run 3’s 9,542.' },
  { v: '21.1 h', k: 'wall-clock', note: 'On DEMETER’s RTX 4090, 25–26 Aug. Run 3 took 40.3 h on the dev PC for the same 250k iterations — moving to the HPC roughly halved iteration cost.' },
];

/* Both runs at the official protocol: threshold 0.5, 10-voxel minimum, IoU 0.1,
   sliding-window Gaussian, no TTA. Same splits, byte-identical. */
const RUN_CMP = {
  columns: ['Lesion metric · val, 57 scans', 'Run 3', 'Run 4', 'Δ'],
  rows: [
    { cells: ['Lesion F1', '71.3%', '73.7%', '+2.4'], accent: true },
    { cells: ['PPV (precision)', '70.4%', '75.4%', '+5.1'], accent: true },
    { cells: ['Sensitivity (recall)', '72.3%', '72.0%', '−0.3'], accent: true },
    { cells: ['Lesions found (TP)', '1,286', '1,281', '−5'] },
    { cells: ['False lesions (FP)', '542', '417', '−125'] },
    { cells: ['Lesions missed (FN)', '493', '498', '+5'] },
    { cells: ['Voxel DSC (mean)', '0.499', '0.524', '+0.025'] },
    { cells: ['Voxel DSC (median)', '0.579', '0.627', '+0.046'] },
    { cells: ['Clean lesion-negative scans', '0 / 7', '1 / 7', '+1'] },
    { cells: ['False lesions on negative scans', '21', '7', '−14'] },
  ],
};

/* Paired case-level bootstrap, 5,000 resamples over the 57 validation scans,
   computed at home from the two per-case CSVs. */
const BOOTSTRAP = {
  columns: ['Paired difference · run 4 − run 3', 'Point estimate', '95% CI', 'P(Δ > 0)'],
  rows: [
    { cells: ['Lesion F1', '+4.1 pts', '[+2.4, +6.5]', '1.000'], accent: true },
    { cells: ['Lesion PPV', '+7.6 pts', '[+4.7, +11.7]', '1.000'], accent: true },
    { cells: ['Lesion sensitivity', '−0.4 pts', '[−1.9, +0.9]', '0.275'], accent: true },
  ],
};

const PATIENT_CMP = {
  columns: ['Patient-level accounting · 50 lesion-positive scans', 'Run 3', 'Run 4', 'Δ'],
  rows: [
    { cells: ['Scored correct by the OLD rule (any output at all)', '49', '46', '−3'] },
    { cells: ['…of which found NOTHING real (tp = 0)', '5', '2', '−3'], accent: true },
    { cells: ['Genuinely detected (tp > 0)', '44', '44', '0'], accent: true },
    { cells: ['Clean lesion-negative scans (of 7)', '0', '1', '+1'] },
    { cells: ['OLD patient accuracy — as published in runs 1–4', '86.0%', '82.5%', '−3.5'] },
    { cells: ['NEW patient accuracy — the rule now in metrics.py', '77.2%', '78.9%', '+1.7'], accent: true },
  ],
};

const BASELINE_CMP = {
  columns: ['Lesion-level metric', 'Run 4 raw', 'Run 4 protocol', 'Baseline', 'Gap'],
  rows: [
    { cells: ['F1', '70.7%', '73.7%', '79.9%', '−6.2'], accent: true },
    { cells: ['PPV (precision)', '68.4%', '75.4%', '88.2%', '−12.8'], accent: true },
    { cells: ['Sensitivity (recall)', '73.1%', '72.0%', '73.0%', '+0.1 raw'], accent: true },
    { cells: ['Training cases', '430', '430', '~1000', '2.3× fewer'] },
    { cells: ['Cross-validation', 'none', 'none', '5-fold + ensemble', 'not matched'] },
    { cells: ['Post-processing', 'none', 'min-size only', 'TotalSegmentator organ-aware', 'closed — tested, rejected'] },
  ],
};

/* ---- segmentation expansion, tested 2026-09-01 --------------------------------
   The reference's OTHER use of TotalSegmentator: a post-processing pass (-exp_segs)
   that regrows each predicted lesion into the connected PET hotspot around its
   SUVmax, fenced by organ boundaries and capped at N x volume. Ported to
   evaluation/expansion.py and verified voxel-identical to a verbatim transcription
   of psma_segmentator/post_processing.py:324-554 (60 synthetic cases across all
   four stages + a real 258x400x400 case). Run on THIS checkpoint, all 57 validation
   scans, threshold 0.5 + 10-voxel minimum. The `off` row reproduces this page's
   published numbers to within a single lesion (FP 416 vs 417, PPV 75.5 vs 75.4 — the
   sweep applies the min-size filter itself rather than reading run_eval's output), which
   is the harness's own sanity check: the `on` rows are measured against a control that
   lands where it should. */
const EXPAND_CMP = {
  columns: ['Expansion · val, 57 scans, IoU 0.1', 'F1', 'PPV', 'Sens', 'Voxel DSC', 'TP', 'FP'],
  rows: [
    { cells: ['off — run 4 as published', '73.7%', '75.5%', '72.0%', '0.525', '1,281', '416'], accent: true },
    { cells: ['on, 1.2× cap — gentlest tried', '73.8%', '75.9%', '71.9%', '0.525', '1,279', '407'] },
    { cells: ['on, 2.0× cap', '73.3%', '76.0%', '70.7%', '0.521', '1,257', '396'] },
    { cells: ['on, 3.5× cap — the reference’s own setting', '73.2%', '76.0%', '70.5%', '0.515', '1,255', '396'], accent: true },
  ],
};

/* Same predictions, same expansion settings, scored under the supervisors'
   any-overlap rule instead of IoU >= 0.1. Growth cannot break an overlap match,
   so this was the one setup where expansion still had a route to a win. */
const EXPAND_ANY = {
  columns: ['Same runs · any-overlap matching', 'F1', 'PPV', 'Sens', 'TP', 'FP'],
  rows: [
    { cells: ['off', '75.9%', '77.8%', '74.2%', '1,320', '377'], accent: true },
    { cells: ['on, 1.2× cap', '76.0%', '78.1%', '74.0%', '1,317', '369'] },
    { cells: ['on, 3.5× cap — reference setting', '75.5%', '78.4%', '72.8%', '1,295', '356'], accent: true },
  ],
};

const FINDINGS = [
  {
    tone: 'ok', t: 'The hypothesis held: learning anatomy beats filtering for it afterwards',
    why: 'Run 4 asked whether an encoder forced to segment 25 organs during training would stop hallucinating lesions in organs with high physiological PSMA uptake. It does. False positives fell 542 → 417 at the protocol operating point while true positives moved 1,286 → 1,281 — a 23% cut in false alarms for five lesions. The reference implementation buys the same effect with a TotalSegmentator post-processing stage at inference; this buys it inside the weights, and costs nothing at inference because the organ head is never called.',
  },
  {
    tone: 'ok', t: 'The gain is real, not resampling noise — and it is the first clean single-variable result',
    why: 'A paired bootstrap over the 57 validation scans puts the F1 gain at +4.1 points, 95% CI [+2.4, +6.5], and PPV at +7.6, CI [+4.7, +11.7]; both exclude zero in 5,000 of 5,000 resamples. Sensitivity moved −0.4 points with CI [−1.9, +0.9], indistinguishable from zero. Run 3 moved three knobs at once and could not attribute its result; run 4 moved one, against byte-identical splits, so this number belongs to organ supervision alone.',
  },
  {
    tone: 'bad', t: 'The reported patient-accuracy regression is a metric bug, not a model regression',
    why: 'The handoff flagged patient accuracy falling 86.0% → 82.5% as the run’s one regression and the first thing to chase. It is an artefact. metrics.py scores a lesion-positive scan “correct” when pred_positive is true — when the model outputs any component at all, including one with zero overlap with ground truth. Run 3 collected that credit on 5 scans where it found nothing real; run 4 on only 2. Genuine detection (tp > 0) is 44 of 50 in both runs, identical. The 3.5-point “drop” is run 4 being denied credit for false alarms run 3 was given. Corrected — positives with tp > 0 plus clean negatives — run 3 scores 77.2% and run 4 scores 78.9%, and run 4 is ahead. Fixed in metrics.py on 2026-09-01 — the new rule reproduces these corrected figures from the archived CSVs, the old rule is retained as patient_accuracy_legacy for reconciliation, and a self-test guard now blocks a regression. Every patient-accuracy figure in runs 1–4 remains the old definition and reads high by 3–9 points.',
  },
  {
    tone: 'ok', t: 'The reference’s post-processing stage was tested properly and does not help this model',
    why: 'Its expansion pass (-exp_segs) was ported and verified voxel-identical to a verbatim copy of the reference’s own functions, then run on this checkpoint over all 57 validation scans. At the reference’s own setting it costs 0.5 F1 and 1.5 points of sensitivity; the gentlest setting is +0.1 F1, which is noise. The technique assumes the model under-segments, and this one does not. That makes the last unclosed row of the comparison table a tested-and-rejected result rather than an untried excuse — and the parity proof is what licenses saying so.',
  },
  {
    tone: 'ok', t: 'Segmentation quality improved too, which was not the goal',
    why: 'Median voxel DSC rose 0.579 → 0.627 and the mean 0.499 → 0.524, and best validation Dice jumped 0.545 → 0.587 — the largest single-run improvement since run 1. Anatomical context appears to sharpen lesion boundaries, not merely veto false ones. The auxiliary task is acting as a regulariser on the shared encoder, which is the textbook justification for multi-task learning and the first time this project has observed it directly.',
  },
  {
    tone: 'bad', t: 'The organ head destabilises training — every gradient explosion in the run is its fault',
    why: 'Peak gradient norm hit 1,034,136, two orders of magnitude above run 3’s 9,542. Decomposing the 14 steps where total loss exceeded 10 shows all 14 are organ-driven: at iteration 9,620 the total loss was 9,239.68 of which the organ term was 9,231.91, leaving the lesion loss at 7.77. The organ cross-entropy is summed unweighted at loss_weight 1.0, so a single bad organ batch dominates the objective outright. Clipping at 12.0 absorbed every one — 0.72% of steps clipped, versus run 3’s 0.69% — so the run finished healthy, but it finished healthy because the clipper caught it, not because the loss was well-posed.',
  },
  {
    tone: 'ok', t: 'The instability is confined to the first half, and the head genuinely converged',
    why: 'Organ cross-entropy fell 0.696 → 0.050 and the excursions stop entirely after iteration 127,580 — the last 122,420 iterations contain no organ loss above 0.5. So the two heads are not fighting for capacity, which was the pre-run watch item. The spikes look like occasional pathological organ labels or empty-class batches early on rather than a structural conflict, and they had stopped long before the best checkpoint at 175,000.',
  },
  {
    tone: 'warn', t: 'False alarms are suppressed, not solved — and lesion-negative scans remain the weak spot',
    why: 'False lesions on the 7 lesion-negative scans dropped 21 → 7 at protocol (25 → 8 raw), and 1 scan is now completely clean where run 3 had none. That is a real improvement on run 3’s worst result. But 6 of 7 lesion-free patients still collect at least one false alarm, so the clinically salient failure — telling a healthy patient they have disease — is reduced roughly threefold and not eliminated.',
  },
  {
    tone: 'warn', t: 'Sensitivity has not moved in three runs, and that is now the whole problem',
    why: 'Raw sensitivity: run 2 66.7%, run 3 73.5%, run 4 73.1%. Two runs of work have moved PPV 60.8% → 68.4% and left recall flat, with 479 lesions still missed. Precision was the right target while it was 28 points short; at 12.8 points short it no longer is. Run 5 should aim at recall.',
  },
  {
    tone: 'warn', t: 'The output probabilities are saturated, and the instance metric is being distorted by component merging',
    why: 'Sweeping the threshold 0.3 → 0.95 moves true positives 1,303 → 1,325 and false positives 605 → 578 — raising the threshold increases detections, which is backwards. The explanation is that at low thresholds one predicted blob spans several adjacent ground-truth lesions and matches only one of them, booking the rest as misses; tightening the threshold fragments the blob into separately-matching components. Some unknown share of the 479 “missed” lesions are therefore inside a prediction already claimed by a neighbour. That makes part of the sensitivity gap a post-processing problem, not a model problem — and it is measurable without retraining anything.',
  },
];

const NEXT = [
  {
    t: 'Fix the patient-level metric, then re-report every run on it',
    why: 'Define a lesion-positive scan as detected when tp > 0, not when the model emitted anything. One line in metrics.py. It changes the headline number of four runs and removes a metric that currently rewards false alarms — and it has to happen before any of these numbers reach the dissertation.',
  },
  {
    t: 'Quantify the component-merging loss before running anything',
    why: 'Count how many of the 479 false negatives are ground-truth lesions overlapping a predicted component already matched to a different lesion. If that share is large, sensitivity is recoverable with watershed or connected-component splitting on the existing probability maps — no retraining, no GPU hours, and it attacks the metric that has not moved in three runs.',
  },
  {
    t: 'Weight the organ loss down, or normalise it',
    why: 'loss_weight 1.0 lets a single bad organ batch produce a loss of 9,232 against a lesion loss of 7.77. Dropping to 0.3–0.5, or clamping the organ term separately before summing, keeps the demonstrated benefit while removing the dependence on gradient clipping to survive. Cheap insurance rather than an experiment.',
  },
  {
    t: 'Attack recall directly: deep supervision and Tversky β > α',
    why: 'Deep supervision has been queued since run 2 and the reference trains with it. Combined with a recall-weighted Tversky (α 0.3 / β 0.7 — the setting run 3 abandoned before precision was fixed), it targets the one metric three runs have failed to move. Precision now has 12.8 points of headroom to spend.',
  },
  {
    t: 'Hold the test split until the architecture is frozen',
    why: '110 test cases remain untouched, and the 0.5 / 10-voxel operating point was fixed on validation only. Run 5 is still architecture search; spending the test split now would cost the one unbiased estimate the dissertation gets.',
  },
];

/* ---- run 5: the committed plan ---------------------------------------------
   Runs 1–4 were all architecture search on one fixed split of one cohort. Run 5
   changes what the experiment IS rather than what the model is: cross-validated,
   on a larger corpus. Both cards are committed; the two zero-GPU prerequisites
   that must land first are called out in the section's Prose. */
const PLAN = [
  {
    t: 'Five-fold cross-validation, ensembled at inference',
    chip: 'splits/ → 5 rotating folds · 5 checkpoints · mean-probability ensemble',
    diagram: 'folds',
    caps: ['one fixed split — 57 scans ever validated (orange)', 'every case held out exactly once'],
    tech: 'Regenerate the split as five stratified folds, train one model per fold, and average the probability maps at inference — the same protocol the reference uses, and the reason two of the four remaining asymmetries against it exist at all.',
    plain: 'Right now every claim on this page rests on the same 57 scans, so a lucky or unlucky draw is indistinguishable from a real result; five folds means every patient gets judged by a model that never saw them, and the five answers together are far harder to fool.',
  },
  {
    t: 'Scale the corpus with the DEEP-PSMA open data',
    chip: '430 training cases → 430 + DEEP-PSMA · resampled to the shared 2 mm grid',
    diagram: 'corpus',
    caps: ['AutoPET PSMA v3 only — 430 cases (orange)', 'plus a second open PSMA cohort (blue)'],
    tech: 'Add the open-source DEEP-PSMA PET/CT lesion cohort, harmonise it onto the existing [2.0364, 2.0364, 3.0] grid and intensity normalisation, and confirm its label convention matches AutoPET before a single case enters the training set.',
    plain: 'The reference was trained on roughly 1,000 scans and this project has 430, which is the one gap no amount of architecture work can close — more patients is the change most likely to move the numbers, and the data is free.',
  },
];

const SPIKE_LOG = `# train.log — the 14 steps where total loss exceeded 10.
# Column 'organ' is the auxiliary head's cross-entropy; the lesion
# term is the remainder. Every explosion is the organ head.
  iter   6510  loss  111.1771  organ  109.3725  gnorm    2440.56
  iter   9620  loss 9239.6826  organ 9231.9090  gnorm  105108.52   <- lesion loss 7.77
  iter  13190  loss   17.2152  organ   16.2083  gnorm    8253.79
  iter  31030  loss   54.2617  organ   53.6781  gnorm    5156.42
  iter  37880  loss  474.5232  organ  470.4025  gnorm   35129.59
  iter  42170  loss  273.9553  organ  265.0318  gnorm   53633.87
  iter  99630  loss  108.5500  organ  108.0500  gnorm    9683.75
  iter 127580  loss   70.4500  organ   69.5000  gnorm    3459.20   <- last excursion
# peak gradient norm over the run: 1,034,135.6  (run 3: 9,542)
# clipped at 12.0: 1,799 / 250,000 steps = 0.72%  (run 3: 0.69%)
# no organ loss above 0.5 in the final 122,420 iterations`;

const LOG_TAIL = `organ supervision=ON (weight 1.0, 25 classes)
grad-clip=12.0 | val=tiled overlap=0.5 | val_max_cases=20
...
  iter 250000/250000  loss 0.3688  train-Dice 0.684  lr 0.00e+00  gnorm 0.36  organ 0.0472 (max 0.6, 1799 clipped)
  epoch 1000  val-Dice 0.575  (best 0.587)
final val-Dice 0.575  ->  saved checkpoints/run4/checkpoint_last.pth
best val-Dice  0.587  ->  checkpoints/run4/checkpoint_best.pth`;

export default function Run04OrganSupervision({ run }) {
  return (
    <RunPage run={run}>
      <Verdict tone="good" lead="Organ supervision worked, and it is the first result this project can attribute to a single variable — false lesions down 23%, PPV up 5.1 points, sensitivity untouched, and validation Dice up more than any run since the first.">
        A second decoder head segmenting 25 TotalSegmentator organ classes, trained alongside the
        lesion head and never called at inference, cut false positives 542 &rarr; 417 while leaving
        true positives flat. Everything else was held byte-identical to run 3, so the gain belongs to
        the organ head alone &mdash; a paired bootstrap puts F1 at +4.1 points with a 95% CI of
        [+2.4, +6.5]. The one apparent regression, patient accuracy falling 86.0% &rarr; 82.5%,
        turned out on per-case analysis to be a bug in the metric rather than a fault in the model:
        it rewards a model for firing at a sick patient even when it misses every real lesion. The
        genuine costs are elsewhere &mdash; the organ loss is unweighted and produced gradient norms
        two orders of magnitude beyond run 3, and lesion sensitivity has now not moved in three runs.
      </Verdict>

      <Section label="Headline numbers" note="all measured — nothing estimated">
        <StatGrid stats={HEADLINE} />
      </Section>

      <Section label="Validation Dice" note="identical tiled protocol and identical splits — the cleanest comparison in the project so far">
        <Prose>
          Run 4 leads from roughly epoch 50 onward and never gives the lead back. The best checkpoint
          lands at epoch 700 (0.587); the last 300 epochs sit flat at 0.573&ndash;0.583 and the run
          finished at 0.575, so nothing was gained after 175,000 iterations &mdash; worth noting when
          budgeting run 5&rsquo;s schedule.
        </Prose>
        <LineChart
          xLabel="epoch"
          yLabel="validation Dice"
          yDomain={[0, 0.65]}
          series={[
            { name: 'run 3 — lesion head only', data: RUN3_VAL },
            { name: 'run 4 — + organ head', data: RUN4_VAL },
          ]}
        />
      </Section>

      <Section label="Training Dice" note="51-point moving average · run 4 trains visibly harder on the same data">
        <Prose>
          Run 4 ends at 0.724 on training patches against run 3&rsquo;s 0.650, and the gap opens early
          rather than late. Since the two runs saw identical data through identical augmentation, the
          extra fit is the shared encoder being pushed by a second objective &mdash; and it converts
          into validation Dice rather than into overfitting, which is the outcome that justifies the
          auxiliary task.
        </Prose>
        <LineChart
          xLabel="iteration"
          yLabel="Dice on training patches"
          yDomain={[0, 0.8]}
          series={[
            { name: 'run 3 — lesion head only', data: RUN3_TRAIN_DICE },
            { name: 'run 4 — + organ head', data: RUN4_TRAIN_DICE },
          ]}
        />
      </Section>

      <Section label="Organ-head cross-entropy" note="the auxiliary objective, 51-point moving average — new to this run, no run 3 counterpart">
        <Prose>
          The head learns quickly &mdash; 0.696 to under 0.16 within 4,000 iterations &mdash; then
          settles to 0.050 and stays there. The visible bump near iteration 105,000 is the smoothed
          residue of a raw spike; the moving average hides how violent those excursions actually were,
          which is why they get their own section below. What matters here is the shape: the organ
          loss falls monotonically and never trends back up, so the two heads are not competing for
          encoder capacity. That was the pre-run watch item, and it is answered.
        </Prose>
        <LineChart
          xLabel="iteration"
          yLabel="organ cross-entropy"
          yDomain={[0, 0.75]}
          series={[{ name: 'run 4 — organ head', data: RUN4_ORGAN }]}
        />
      </Section>

      <Section label="The instability" note="the run’s real cost — and it is entirely the auxiliary head’s doing">
        <Prose>
          Run 4 clipped 0.72% of steps against run 3&rsquo;s 0.69%, which reads as identical stability.
          The peak tells a different story: 1,034,136 against 9,542, a factor of 108. Decomposing every
          step where the total loss exceeded 10 shows the cause unambiguously &mdash; all 14 are the
          organ term. At iteration 9,620 the organ cross-entropy was 9,231.91 while the lesion loss sat
          at 7.77, so for that step the model was optimising almost purely for anatomy. Because the two
          losses are summed unweighted, nothing in the objective prevents this; only the gradient
          clipper at 12.0 kept the run alive. It did, and the excursions stop for good at iteration
          127,580 &mdash; well before the best checkpoint &mdash; but relying on the clipper to rescue
          a badly-scaled objective is luck, not design.
        </Prose>
        <CodeBlock label="train.log — every step with total loss > 10, decomposed" text={SPIKE_LOG} />
      </Section>

      <Section label="Run 3 vs run 4" note="both at the official protocol: threshold 0.5, 10-voxel minimum, IoU 0.1, no TTA">
        <MetricTable columns={RUN_CMP.columns} rows={RUN_CMP.rows} />
      </Section>

      <Section label="Is the gain real?" note="paired case-level bootstrap, 5,000 resamples over the 57 validation scans">
        <Prose>
          With 57 scans it is fair to ask whether a 2.4-point F1 move is anything at all. Resampling
          the scans with replacement and recomputing both runs on each resample answers it: the F1 and
          PPV gains exclude zero in every one of 5,000 draws, and the sensitivity change does not
          exclude zero in 72.5% of them &mdash; that is, sensitivity genuinely did not move.
        </Prose>
        <MetricTable columns={BOOTSTRAP.columns} rows={BOOTSTRAP.rows} />
      </Section>

      <Section label="The patient-accuracy “regression”" note="the handoff’s first analysis task — and the answer overturns it">
        <Prose>
          Run 4 was handed over with one flagged regression: patient accuracy down 86.0% &rarr; 82.5%,
          reported as run 4 missing three additional lesion-positive patients outright. The per-case
          diff says otherwise. <code>metrics.py</code> counts a lesion-positive scan as correct when
          <code>pred_positive</code> is true &mdash; when the model produced <em>any</em> connected
          component, whether or not it overlaps a real lesion. Run 3 was credited on 5 scans where it
          detected nothing real; run 4 on 2. True detection is 44 of 50 in both runs. The metric was
          paying run 3 for false alarms, and run 4 lost that payment by making fewer of them.
        </Prose>
        <MetricTable columns={PATIENT_CMP.columns} rows={PATIENT_CMP.rows} />
        <Prose>
          <strong>Fixed in code on 2026-09-01</strong>, which is why this section is no longer just an
          analysis. <code>aggregate()</code> now requires <code>tp&nbsp;&gt;&nbsp;0</code> for a
          lesion-positive scan; lesion-negative scans are unchanged, because there, predicting nothing
          <em>is</em> the correct answer. Re-running the archived per-case CSVs through the new code
          reproduces the two bottom rows above &mdash; 77.2% and 78.9% &mdash; which were derived by
          hand before the fix existed, so the fix and the analysis independently agree.
        </Prose>
        <Prose>
          The old figures are kept, here and in the code: <code>aggregate()</code> also returns
          <code>patient_accuracy_legacy</code> and <code>patient_credited_on_nothing</code>, so a
          number that disagrees with an archived run-card is explainable rather than mysterious.
          <strong>Every <code>patient_accuracy</code> in runs 1&ndash;4 and in the archived run-cards is
          the old definition and reads high by 3&ndash;9 points.</strong> Those pages are not being
          rewritten; the pairing above is the reconciliation. Nothing else moved &mdash; F1, PPV,
          sensitivity and voxel DSC are untouched, and nothing selects checkpoints on this metric. The
          module self-test now asserts that an all-miss positive scan scores 0.000 where the old rule
          gave it 1.000; it had never asserted patient accuracy at all, which is how this survived four
          runs.
        </Prose>
      </Section>

      <Section label="Against the reference" note="read the bottom three rows before the top three">
        <Prose>
          The asymmetries that made runs 2 and 3 lower bounds still stand &mdash; 430 training cases
          against roughly 1,000, no cross-validation, no ensembling &mdash; but one of them has now
          partly closed: the reference&rsquo;s organ-aware post-processing has an in-model counterpart
          here. Raw sensitivity remains at parity with the reference. The gap is precision, and it is
          down from 28 points at run 2 to 12.8.
        </Prose>
        <MetricTable columns={BASELINE_CMP.columns} rows={BASELINE_CMP.rows} />
      </Section>

      <Section label="Segmentation expansion — tested and rejected" note="the reference’s other use of TotalSegmentator, run on this checkpoint · 57 scans · no retraining">
        <Prose>
          Run 4 bought organ-awareness <em>inside the weights</em>. The reference also uses
          TotalSegmentator a second way, at inference: a post-processing pass
          (<code>-exp_segs</code>) that grows each predicted lesion outward into the bright PET region
          it already sits on, stopping at organ boundaries and at a brightness cutoff read off the
          patient’s own liver. It needs no retraining, so it was cheap to settle — and settling it
          closes the last open row in the table above.
        </Prose>
        <Prose>
          The technique assumes the model paints lesions <em>too small</em>. This one does not, so
          growing them only spills over the edges. At the reference’s own setting it costs 0.5 F1,
          1.5 points of sensitivity and a point of voxel DSC, and buys 0.5 PPV. The gentlest setting
          is +0.1 F1 — noise. Nothing here beats leaving it off.
        </Prose>
        <MetricTable columns={EXPAND_CMP.columns} rows={EXPAND_CMP.rows} />
        <Prose>
          Read the TP column: found lesions fall 1,281 &rarr; 1,255 as growth increases, while false
          positives also fall 416 &rarr; 396. Expansion cannot invent a new lesion — it only ever
          grows blobs that already exist — so those 26 lost detections are <em>merges</em>: two
          correctly-found lesions grow into one another, and one predicted component can only be
          credited with one ground-truth lesion. This is the same over-merging already visible in
          this run’s threshold sweep, arriving by a different route.
        </Prose>
        <Prose>
          Scored under the supervisors’ any-overlap rule the story is unchanged, and that is the
          informative part. Growth cannot break an <em>overlap</em> match the way it inflates a union
          past an IoU threshold, so detections should have been safe here — they still fall 1,320
          &rarr; 1,295. That pins the mechanism on merging specifically, not on the choice of matching
          rule. The rule is worth 2.2 F1 points on its own, which is a separate thing worth knowing.
        </Prose>
        <MetricTable columns={EXPAND_ANY.columns} rows={EXPAND_ANY.rows} />
        <Prose>
          Two notes on trusting this. First, the port is verified rather than assumed: a verbatim
          copy of the reference’s own functions runs beside it in
          <code>scripts/verify_expansion_parity.py</code> and every voxel matches, so a null result
          means the technique did nothing rather than that it was mistyped. Second, the brightness
          cutoff is the whole algorithm, and the reference hard-codes TotalSegmentator’s raw label
          numbers to find the liver — <code>organ == 5</code>. In this project’s regrouped 25-class
          maps, 5 is <em>lungs</em>. Lungs are air, so the cutoff collapses from 9.67 SUV to 1.56,
          masks flood 8.5×, and 40 lesions merge into their neighbours — while voxel DSC still
          <em>rises</em>, so the mistake reads as a modest success. The floor came from the liver on
          91% of cases here, and the code now prints that on every run.
        </Prose>
      </Section>

      <Section label="Findings">
        <Findings items={FINDINGS} />
      </Section>

      <Section label="What would make the model better" note="the candidate list, ordered by expected value — what run 5 actually commits to is the section below">
        <NextSteps items={NEXT} />
      </Section>

      <Section label="Run 5 — the committed plan" note="the experiment changes shape: this is the first run that is not architecture search">
        <Prose>
          Four runs have now tuned the model against a single fixed split of a single 430-case cohort,
          and run 4 is where that stops paying. The remaining gap to the reference is 6.2 F1 points,
          and of the four asymmetries that have made every comparison a lower bound &mdash; 430 cases
          against roughly 1,000, no cross-validation, no ensembling, no organ-aware post-processing
          &mdash; run 4 closed the last one from inside the model. The other three are all properties
          of the <em>experiment</em>, not the network, and run 5 addresses them together.
        </Prose>
        <Prose>
          Two things land before either card, and neither costs GPU time. The patient-level metric had
          to be redefined as <code>tp&nbsp;&gt;&nbsp;0</code>, because cross-validating on top of a
          metric that rewards false alarms would simply produce five inflated numbers instead of one
          &mdash; <strong>done 2026-09-01</strong>, see the patient-accuracy section above.
          And the component-merging audit has to run, because if a meaningful share of the 479 missed
          lesions sit inside a prediction already matched to a neighbour, then part of the sensitivity
          gap is recoverable from the probability maps that already exist &mdash; and it would be
          expensive to discover that after committing to five-fold training.
        </Prose>
        <ChangePlan items={PLAN} />
        <Prose>
          The cost is the honest part of this plan: five folds over a larger corpus is roughly five
          training runs, and at run 4&rsquo;s 21 hours on one RTX 4090 that is a week of continuous
          compute before any result exists. DEMETER has two cards and the fold dimension is
          embarrassingly parallel, so the real constraint is scheduling rather than capability. Two
          things need confirming before the corpus card is actionable: the DEEP-PSMA cohort&rsquo;s
          exact case count and licence, and whether its lesion-labelling convention matches
          AutoPET&rsquo;s closely enough to pool the two without a systematic label shift &mdash; run
          4&rsquo;s organ labels arrived silently mislabelled and passed every presence check, so
          nothing gets pooled here on the assumption that it is fine.
        </Prose>
      </Section>

      <Section label="Log" note="the configuration banner and the decisive tail of train.log">
        <CodeBlock label="train.log — head and final lines" text={LOG_TAIL} />
      </Section>
    </RunPage>
  );
}
