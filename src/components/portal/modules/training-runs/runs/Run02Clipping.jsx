import { RunPage, Verdict, Section, Prose, StatGrid, LineChart, Figure, FigureGrid, MetricTable, Findings, NextSteps, CodeBlock } from '../kit';

import trainLoss from '../figures/run-02-clipping/train-loss.png';
import gradNorm from '../figures/run-02-clipping/grad-norm.png';
import lossSplit from '../figures/run-02-clipping/loss-decomposition.png';
import gpuUtil from '../figures/run-02-clipping/gpu-utilisation.png';
import prTrade from '../figures/run-02-clipping/precision-recall-tradeoff.png';
import perCase from '../figures/run-02-clipping/per-case-performance.png';
import lesionSizes from '../figures/run-02-clipping/lesion-size-distribution.png';

/* ============================================================================
   RUN 02 — GRADIENT CLIPPING + TILED VALIDATION
   ----------------------------------------------------------------------------
   All numbers real, from run-archives/2026-08-02_run2_clipping/. Curves are
   decoded from the offline W&B datastore (nested_key protobuf), downsampled to
   ≤70 points. Lesion metrics from evaluation/results/.

   There is no RUN 01 page: run 1 completed but its checkpoint was destroyed
   before archiving, so it survives only as the comparison series on this page.
   ========================================================================== */

const RUN1_VAL = [[25, 0.236], [50, 0.218], [75, 0.003], [100, 0.000], [125, 0.093], [150, 0.005], [175, 0.173], [200, 0.000], [225, 0.001], [250, 0.007], [275, 0.224], [300, 0.290], [325, 0.272], [350, 0.164], [375, 0.314], [400, 0.349], [425, 0.203], [450, 0.287], [475, 0.205], [500, 0.312], [525, 0.136], [550, 0.385], [575, 0.153], [600, 0.160], [625, 0.273], [650, 0.162], [675, 0.320], [700, 0.197], [725, 0.371], [750, 0.366], [775, 0.320], [800, 0.311], [825, 0.330], [850, 0.283], [875, 0.326], [900, 0.328], [925, 0.315], [950, 0.327], [975, 0.324], [1000, 0.322]];
const RUN2_VAL = [[25, 0.295], [50, 0.312], [75, 0.361], [100, 0.342], [125, 0.325], [150, 0.350], [175, 0.378], [200, 0.379], [225, 0.399], [250, 0.365], [275, 0.417], [300, 0.417], [325, 0.408], [350, 0.438], [375, 0.431], [400, 0.432], [425, 0.421], [450, 0.453], [475, 0.447], [500, 0.425], [525, 0.466], [550, 0.465], [575, 0.475], [600, 0.471], [625, 0.479], [650, 0.470], [675, 0.458], [700, 0.474], [725, 0.514], [750, 0.501], [775, 0.478], [800, 0.500], [825, 0.472], [850, 0.483], [875, 0.496], [900, 0.499], [925, 0.489], [950, 0.495], [975, 0.494], [1000, 0.493]];

const RUN1_TRAIN_DICE = [[510, 0.216], [4120, 0.307], [7740, 0.222], [11350, 0.276], [14970, 0.244], [18580, 0.052], [22200, 0.243], [25820, 0.019], [29430, 0.051], [33050, 0.007], [36660, 0.030], [40280, 0.112], [43890, 0.210], [47510, 0.052], [51130, 0.070], [54740, 0.051], [58360, 0.007], [61970, 0.010], [65590, 0.111], [69210, 0.259], [72820, 0.310], [76440, 0.335], [80050, 0.290], [83670, 0.368], [87280, 0.214], [90900, 0.314], [94520, 0.345], [98130, 0.153], [101750, 0.357], [105360, 0.244], [108980, 0.346], [112590, 0.371], [116210, 0.325], [119830, 0.324], [123440, 0.446], [127060, 0.473], [130670, 0.493], [134290, 0.476], [137910, 0.463], [141520, 0.249], [145140, 0.293], [148750, 0.341], [152370, 0.432], [155980, 0.487], [159600, 0.508], [163220, 0.512], [166830, 0.526], [170450, 0.517], [174060, 0.519], [177680, 0.542], [181290, 0.559], [184910, 0.562], [188530, 0.560], [192140, 0.555], [195760, 0.575], [199370, 0.556], [202990, 0.574], [206610, 0.563], [210220, 0.580], [213840, 0.571], [217450, 0.573], [221070, 0.599], [224680, 0.592], [228300, 0.573], [231920, 0.566], [235530, 0.591], [239150, 0.582], [242760, 0.589], [246380, 0.594], [250000, 0.572]];
const RUN2_TRAIN_DICE = [[510, 0.174], [4120, 0.329], [7740, 0.348], [11350, 0.386], [14970, 0.460], [18580, 0.380], [22200, 0.439], [25820, 0.406], [29430, 0.362], [33050, 0.449], [36660, 0.466], [40280, 0.463], [43890, 0.489], [47510, 0.518], [51130, 0.530], [54740, 0.509], [58360, 0.515], [61970, 0.518], [65590, 0.521], [69210, 0.539], [72820, 0.554], [76440, 0.525], [80050, 0.544], [83670, 0.558], [87280, 0.571], [90900, 0.580], [94520, 0.563], [98130, 0.572], [101750, 0.557], [105360, 0.587], [108980, 0.595], [112590, 0.610], [116210, 0.601], [119830, 0.612], [123440, 0.624], [127060, 0.619], [130670, 0.583], [134290, 0.582], [137910, 0.615], [141520, 0.617], [145140, 0.628], [148750, 0.642], [152370, 0.614], [155980, 0.630], [159600, 0.619], [163220, 0.641], [166830, 0.651], [170450, 0.630], [174060, 0.635], [177680, 0.621], [181290, 0.652], [184910, 0.603], [188530, 0.635], [192140, 0.656], [195760, 0.640], [199370, 0.651], [202990, 0.641], [206610, 0.642], [210220, 0.659], [213840, 0.642], [217450, 0.658], [221070, 0.645], [224680, 0.637], [228300, 0.646], [231920, 0.646], [235530, 0.659], [239150, 0.649], [242760, 0.661], [246380, 0.666], [250000, 0.649]];

const HEADLINE = [
  { v: '0.514', k: 'best val Dice', note: 'Voxel overlap on held-out scans, epoch 725. Run 1 got 0.385.' },
  { v: '71.9%', k: 'best lesion F1', note: 'With a 10-voxel filter. 65.5% raw at threshold 0.5.' },
  { v: '71.2%', k: 'lesion sensitivity', note: 'Lesions found. Baseline is 73.0% — essentially matched.' },
  { v: '60.6%', k: 'lesion PPV', note: 'Of what it flags, how much is real. Baseline 88.2% — the gap.' },
  { v: '3,183', k: 'clipped steps', note: '1.27% of 250k. Peak gradient norm was 25,695 vs a clip of 12.' },
  { v: '12 h 30', k: 'wall-clock', note: '250,000 iterations, clean exit, zero non-finite losses.' },
];

const TRAINING_CMP = {
  columns: ['Training-side measure', 'Run 1 (no clipping)', 'Run 2 (clip 12.0)', 'Change'],
  rows: [
    { cells: ['Peak logged loss', '4,165', '24.4', '170× lower'], accent: true },
    { cells: ['Logged points above 1.5', '859', '19', '45× fewer'], accent: true },
    { cells: ['Validation cycles near zero', '6 (epochs 75–250)', '0', 'eliminated'], accent: true },
    { cells: ['Final training Dice', '0.583', '0.656', '+0.073'], accent: true },
    { cells: ['Best validation Dice', '0.385', '0.514', '+0.129 (confounded)'] },
  ],
};

const LESION_CMP = {
  columns: ['Lesion-level metric', 'Run 2 raw', 'Run 2 + filter', 'Baseline', 'Gap'],
  rows: [
    { cells: ['F1', '65.5%', '71.9%', '79.9%', '−8.0'], accent: true },
    { cells: ['PPV (precision)', '60.6%', '75.2%', '88.2%', '−13.0'], accent: true },
    { cells: ['Sensitivity (recall)', '71.2%', '68.9%', '73.0%', '−1.8 raw'], accent: true },
    { cells: ['Patient-level accuracy', '93.0%', '93.0%', '94.5%', '−1.5'], accent: true },
    { cells: ['Training cases', '430', '430', '~1000', '2.3× fewer'] },
    { cells: ['Cross-validation', 'none', 'none', '5-fold + ensemble', 'not matched'] },
    { cells: ['Post-processing', 'none', 'min-volume only', 'TotalSegmentator organ-aware', 'not matched'] },
  ],
};

const FINDINGS = [
  {
    tone: 'ok', t: 'Gradient clipping fixed the instability, and the cause is now measured',
    why: 'Peak gradient norm reached 25,695 against a clip threshold of 12.0, with 1.27% of steps clipped and a mean norm of 1.88 — a benign distribution with a violent tail. That is exactly the regime norm-clipping exists for, and it means lowering the learning rate would have been the wrong fix. Run 1’s collapse did not shrink, it disappeared.',
  },
  {
    tone: 'ok', t: 'The false-positive spikes were entirely the BCE term',
    why: 'Tversky is bounded in [0,1] by construction; the 0.3×BCE term reached 3,808 in run 1 against 25.2 in run 2. The loss decomposition confirms directly what run 1’s curve could only imply.',
  },
  {
    tone: 'ok', t: 'Sensitivity is already at baseline — the Tversky bias works',
    why: 'Lesion sensitivity 71.2% against the baseline’s 73.0%, on 43% of the training data with no ensembling. The α=0.3 / β=0.7 configuration was designed to trade precision for recall, and the result shows it doing precisely that.',
  },
  {
    tone: 'ok', t: 'The BCE term is not diluting the recall bias',
    why: 'An open question since July was whether the symmetric 0.3×BCE was blunting Tversky’s sensitivity bias. It contributes a median 0.6% of total loss — effectively inert. That question is closed: BCE is a stability liability, not a recall one.',
  },
  {
    tone: 'warn', t: 'Precision is the entire remaining gap',
    why: 'PPV 60.6% against 88.2%. Sweeping the decision threshold from 0.3 to 0.95 moves it only to 63.4%, and voxel DSC stays flat at ~50.3% throughout — so this is structural, not an untuned knob. The model reports 818 false lesions across 57 scans.',
  },
  {
    tone: 'warn', t: 'The model over-merges neighbouring lesions',
    why: 'Sensitivity RISES as the threshold tightens (70.4% → 74.3%), which is backwards. A diffuse blob spanning several adjacent lesions can only claim one under one-to-one matching; tighten the threshold and it fragments so each piece matches its own. Very plausible in PSMA PET, where chains of adjacent nodal deposits are common.',
  },
  {
    tone: 'warn', t: 'The 4 mm voxel grid is probably the real ceiling',
    why: 'Median ground-truth lesion is just 19 voxels — about 3 voxels across — and 97 val lesions are a single voxel. A clinically substantial 13 mm node occupies only ~19 voxels at this spacing. The baseline plans specify 2.04 mm; our 4 mm came from a suspected axis-order misread.',
  },
  {
    tone: 'bad', t: 'Two changes landed together, so the headline gain is confounded',
    why: 'Run 2 added clipping AND corrected the validation protocol. Training-side numbers are clean, since validation cannot affect training — but 0.385 → 0.514 cannot be split between the two, because run 1’s checkpoint was destroyed by a smoke test before it could be re-scored.',
  },
  {
    tone: 'bad', t: 'The baseline comparison is not like-for-like, in four ways',
    why: 'The baseline had ~1000 cases to our 430, 5-fold cross-validation, fold ensembling, and a full organ-aware post-processing stage we do not have at all. Every delta on this page understates the architecture — treat them as a lower bound, not a verdict.',
  },
];

const NEXT = [
  {
    t: 'Halve the target spacing: 4.0 mm → 2.04 mm',
    why: 'The single highest-value change. The same physical lesion goes from a median 19 voxels to roughly 148, which should attack both the small-lesion misses and the over-merging at once. It also restores parity with the baseline plans, so it fixes a divergence rather than creating one.',
  },
  {
    t: 'Sweep Tversky α/β toward precision',
    why: 'Sensitivity is already at baseline, so trading some back is now indicated rather than speculative. Try α=0.5/β=0.5 (which is exactly Dice) and α=0.7/β=0.3. One variable, one run each.',
  },
  {
    t: 'Make the 10-voxel filter the default post-processing',
    why: 'Worth +6.4 lesion F1 for essentially no cost. It removes 404 of 818 false positives while losing 80 true positives. Fix the value from the validation split and report it once on test — never tune it on test.',
  },
  {
    t: 'Add deep supervision',
    why: 'The baseline uses it and we do not. A real convergence aid we are simply missing, and cheap to add to the existing decoder.',
  },
  {
    t: 'Scale to ~1000 cases with k-fold cross-validation',
    why: 'The only way the architectural claim becomes testable. Until the data scale and the ensembling match, every number here is provisional.',
  },
];

const INFERENCE = [
  {
    t: 'Return the source geometry from preprocessing',
    why: 'preprocess_case() currently returns only {case_id, image, label, spacing} — it discards the original PET origin, direction and array size. Without those, a prediction cannot be placed back into the patient’s own coordinate frame.',
  },
  {
    t: 'Write the inverse resample',
    why: 'The one genuinely non-trivial piece. resampling.py only goes forward, to the 4 mm grid; predictions currently exist only in that resampled space. A nearest-neighbour resample back onto the original PET grid is needed before a mask can be overlaid on a real scan or handed to a clinician.',
  },
  {
    t: 'scripts/predict.py — inference on a case with no ground truth',
    why: 'Takes CT + PET (NIfTI or a DICOM directory), runs the sliding window, applies the tuned threshold and min-volume filter, and writes a .nii.gz with the correct affine. Everything upstream exists; today the only entry point is run_eval.py, which requires labels and a split.',
  },
  {
    t: 'Wire up the GUI’s dormant "Run model" button',
    why: 'gui/app.py already has the disabled control and a placeholder for the nnU-Net / mamba toggle, so the seam is designed. Needs a checkpoint picker and the same subprocess-streaming pattern the existing smoke test uses.',
  },
  {
    t: 'Prediction overlay and live threshold controls in the viewer',
    why: 'Mask contours plus an optional probability heatmap on the existing slice viewer. Because re-thresholding a cached probability map is instant, threshold and min-volume can be live sliders rather than re-runs.',
  },
];

const LOG_TAIL = `iter 250000/250000  loss 0.4172  train-Dice 0.553  lr 0.00e+00  gnorm 0.84 (max 3.2, 3183 clipped)
  epoch 1000  val-Dice 0.493  (best 0.514)
final val-Dice 0.493  ->  saved checkpoints/checkpoint_last.pth
best val-Dice  0.514  ->  checkpoints/checkpoint_best.pth`;

export default function Run02Clipping({ run }) {
  return (
    <RunPage run={run}>
      <Verdict tone="warn" lead="Gradient clipping did what it was meant to, and the model now finds almost as many lesions as the reference — but it flags far too many things that are not there.">
        Two changes went in: clipping at 12.0, and a corrected validation protocol. The training
        instability that cost run 1 three hours disappeared outright, and validation Dice went
        0.385 &rarr; 0.514. The first lesion-level evaluation this project has ever produced puts
        sensitivity within 2 points of the baseline but precision 28 points short, so precision is
        now the whole story. Bear in mind the reference had 2.3&times; the data, 5-fold ensembling
        and a post-processing stage we do not have &mdash; every gap below is a lower bound.
      </Verdict>

      <Section label="Headline numbers" note="all measured — nothing estimated">
        <StatGrid stats={HEADLINE} />
      </Section>

      <Section label="What these metrics actually mean">
        <MetricTable
          columns={['Metric', 'What it measures', 'Why it matters here']}
          rows={[
            { cells: ['Voxel Dice', 'Overlap between predicted and true masks, per scan, averaged.', 'Easy to compute and good for tracking training, but dominated by large lesions — a perfect result on one big tumour outweighs missing ten small ones.'] },
            { cells: ['Lesion F1', 'Treats each connected lesion as one item to be found. Harmonic mean of precision and recall.', 'The primary metric: the number the reference is quoted in, and the one that counts a 10-voxel deposit equally with a 20,000-voxel one.'] },
            { cells: ['Sensitivity (recall)', 'Of the lesions that exist, what fraction did we find?', 'The clinical priority — a missed metastasis costs more than a false alarm a radiologist can dismiss. This is what the Tversky loss was tuned to raise.'] },
            { cells: ['PPV (precision)', 'Of the lesions we flagged, what fraction are real?', 'The credibility metric. Low PPV means a reader has to check and reject many suggestions, which erodes trust in the tool.'] },
            { cells: ['Patient accuracy', 'Did we correctly call each scan as having lesions or not?', 'The coarsest useful measure — nearly matched at 93.0% vs 94.5%, so the model rarely misses a patient entirely.'] },
          ]}
        />
      </Section>

      <Section label="Validation Dice" note="s1 = run 1 · s2 = run 2 · one point per validation cycle">
        <LineChart
          xLabel="epoch"
          yLabel="validation Dice"
          yDomain={[0, 0.6]}
          series={[
            { name: 'run 1 — no clipping', data: RUN1_VAL },
            { name: 'run 2 — clip 12.0', data: RUN2_VAL },
          ]}
        />
      </Section>

      <Section label="Training Dice" note="51-point moving average · run 1's collapse spans iters 25k–75k">
        <LineChart
          xLabel="iteration"
          yLabel="Dice on training patches"
          yDomain={[0, 0.72]}
          series={[
            { name: 'run 1 — no clipping', data: RUN1_TRAIN_DICE },
            { name: 'run 2 — clip 12.0', data: RUN2_TRAIN_DICE },
          ]}
        />
      </Section>

      <Section label="Training stability" note="decoded from the offline W&B datastore">
        <FigureGrid>
          <Figure
            src={trainLoss}
            caption="Training loss on a log axis — run 1 spikes to 4,165 at iteration 28,250, four orders of magnitude above the working range. Run 2 never leaves it."
          />
          <Figure
            src={gradNorm}
            caption="Gradient norm in run 2. The mean sits near 1.9 while the tail reaches 25,695 — 2,140× the clip threshold. Only 1.27% of steps are clipped, but those are the ones that wrecked run 1."
          />
          <Figure
            src={lossSplit}
            caption="Loss split into its two terms. Tversky is mathematically capped at 1.0, so every spike is BCE — which reached 3,808 in run 1 despite contributing a median 0.6% of the loss."
          />
          <Figure
            src={gpuUtil}
            caption="GPU utilisation across the run. Four dataloader workers keep the card busy; the periodic dips are validation passes, which run at lower occupancy than training."
          />
        </FigureGrid>
      </Section>

      <Section label="Where the model succeeds and fails" note="lesion-level evaluation, 57 validation scans">
        <FigureGrid>
          <Figure
            src={prTrade}
            source="eval"
            caption="Filtering out small predictions trades recall for precision. The best F1 is 71.9% at 10 voxels; reaching the baseline's 88% precision costs all but 13% of sensitivity, because false positives and real small lesions are the same size."
          />
          <Figure
            src={perCase}
            source="eval"
            caption="Per-case F1 against how many lesions the scan contains. High-burden scans score at or above the baseline; sparse scans are near all-or-nothing, which is where the average is lost."
          />
          <Figure
            src={lesionSizes}
            source="eval"
            caption="The core difficulty: median lesion is 19 voxels and 97 of them are a single voxel. At 4 mm spacing a clinically significant 13 mm node is only ~19 voxels — close to the resolution limit."
          />
        </FigureGrid>
      </Section>

      <Section label="Run 1 vs run 2" note="accent rows are clean comparisons — validation protocol cannot affect training">
        <MetricTable columns={TRAINING_CMP.columns} rows={TRAINING_CMP.rows} />
      </Section>

      <Section label="Against the reference" note="read the bottom three rows before the top four">
        <MetricTable columns={LESION_CMP.columns} rows={LESION_CMP.rows} />
      </Section>

      <Section label="Findings">
        <Findings items={FINDINGS} />
      </Section>

      <Section label="What would make the model better" note="ordered by expected value">
        <NextSteps items={NEXT} />
      </Section>

      <Section
        label="What's missing for real inference"
        note="the model works; getting a usable mask out of it does not yet"
      >
        <Prose>
          Everything on this page was produced through <code>run_eval.py</code>, which needs ground-truth
          labels and a predefined split. There is currently no way to point the trained model at a new
          scan and get a mask back in that scan&rsquo;s own coordinate space. The blocker is geometry
          bookkeeping rather than the network &mdash; roughly a day&rsquo;s work, of which only the
          inverse resample is difficult.
        </Prose>
        <NextSteps items={INFERENCE} />
        <CodeBlock
          label="the command that should exist, and does not yet"
          text={`# what works today — requires labels + a split
python scripts/run_eval.py --checkpoint checkpoints/checkpoint_best.pth --split val

# what does not exist yet — inference on an unseen scan
python scripts/predict.py \\
    --checkpoint checkpoints/checkpoint_best.pth \\
    --ct  patient_0000.nii.gz \\
    --pet patient_0001.nii.gz \\
    --threshold 0.95 --min-lesion-voxels 10 \\
    --out patient_lesions.nii.gz     # in the ORIGINAL PET grid, not the 4 mm one`}
        />
      </Section>

      <Section label="Log" note="the decisive tail of train.log">
        <CodeBlock label="train.log — final lines" text={LOG_TAIL} />
      </Section>
    </RunPage>
  );
}
