import { RunPage, Verdict, Section, Prose, StatGrid, LineChart, Figure, FigureGrid, MetricTable, Findings, NextSteps, CodeBlock } from '../kit';

import trainLoss from '../figures/run-03-parity2mm/train-loss.png';
import gradNorm from '../figures/run-03-parity2mm/grad-norm.png';
import prTrade from '../figures/run-03-parity2mm/precision-recall-tradeoff.png';
import perCase from '../figures/run-03-parity2mm/per-case-performance.png';

/* ============================================================================
   RUN 03 — RESOLUTION PARITY: 2 mm GRID + BALANCED TVERSKY
   ----------------------------------------------------------------------------
   All numbers real, from run-archives/2026-08-11_run3_parity2mm/ and
   evaluation/results/run3/. Curves parsed straight from train.log (validation
   points as logged; train Dice as a 51-point moving average sampled on the
   same 70-point grid as the run 2 page, so the series are directly
   comparable). Run 2 comparison series duplicated from Run02Clipping.jsx —
   run pages stay self-contained by convention.

   The three knobs committed in run 2's ChangePlan all landed:
     target_spacing [4.0, 4.07, 4.07] → [2.0364, 2.0364, 3.0]
     patch_size     [64, 128, 64]     → [96, 192, 96]
     Tversky        α 0.3 / β 0.7     → 0.5 / 0.5  (≡ Dice)
   ========================================================================== */

const RUN2_VAL = [[25, 0.295], [50, 0.312], [75, 0.361], [100, 0.342], [125, 0.325], [150, 0.350], [175, 0.378], [200, 0.379], [225, 0.399], [250, 0.365], [275, 0.417], [300, 0.417], [325, 0.408], [350, 0.438], [375, 0.431], [400, 0.432], [425, 0.421], [450, 0.453], [475, 0.447], [500, 0.425], [525, 0.466], [550, 0.465], [575, 0.475], [600, 0.471], [625, 0.479], [650, 0.470], [675, 0.458], [700, 0.474], [725, 0.514], [750, 0.501], [775, 0.478], [800, 0.500], [825, 0.472], [850, 0.483], [875, 0.496], [900, 0.499], [925, 0.489], [950, 0.495], [975, 0.494], [1000, 0.493]];
const RUN3_VAL = [[25, 0.375], [50, 0.306], [75, 0.328], [100, 0.384], [125, 0.357], [150, 0.232], [175, 0.405], [200, 0.410], [225, 0.404], [250, 0.476], [275, 0.454], [300, 0.470], [325, 0.532], [350, 0.507], [375, 0.472], [400, 0.461], [425, 0.514], [450, 0.505], [475, 0.544], [500, 0.494], [525, 0.516], [550, 0.490], [575, 0.516], [600, 0.529], [625, 0.511], [650, 0.532], [675, 0.542], [700, 0.512], [725, 0.513], [750, 0.539], [775, 0.528], [800, 0.543], [825, 0.532], [850, 0.523], [875, 0.545], [900, 0.533], [925, 0.535], [950, 0.536], [975, 0.532], [1000, 0.532]];

const RUN2_TRAIN_DICE = [[510, 0.174], [4120, 0.329], [7740, 0.348], [11350, 0.386], [14970, 0.460], [18580, 0.380], [22200, 0.439], [25820, 0.406], [29430, 0.362], [33050, 0.449], [36660, 0.466], [40280, 0.463], [43890, 0.489], [47510, 0.518], [51130, 0.530], [54740, 0.509], [58360, 0.515], [61970, 0.518], [65590, 0.521], [69210, 0.539], [72820, 0.554], [76440, 0.525], [80050, 0.544], [83670, 0.558], [87280, 0.571], [90900, 0.580], [94520, 0.563], [98130, 0.572], [101750, 0.557], [105360, 0.587], [108980, 0.595], [112590, 0.610], [116210, 0.601], [119830, 0.612], [123440, 0.624], [127060, 0.619], [130670, 0.583], [134290, 0.582], [137910, 0.615], [141520, 0.617], [145140, 0.628], [148750, 0.642], [152370, 0.614], [155980, 0.630], [159600, 0.619], [163220, 0.641], [166830, 0.651], [170450, 0.630], [174060, 0.635], [177680, 0.621], [181290, 0.652], [184910, 0.603], [188530, 0.635], [192140, 0.656], [195760, 0.640], [199370, 0.651], [202990, 0.641], [206610, 0.642], [210220, 0.659], [213840, 0.642], [217450, 0.658], [221070, 0.645], [224680, 0.637], [228300, 0.646], [231920, 0.646], [235530, 0.659], [239150, 0.649], [242760, 0.661], [246380, 0.666], [250000, 0.649]];
const RUN3_TRAIN_DICE = [[510, 0.167], [4126, 0.348], [7742, 0.361], [11357, 0.387], [14973, 0.391], [18589, 0.305], [22205, 0.445], [25821, 0.478], [29436, 0.465], [33052, 0.484], [36668, 0.506], [40284, 0.507], [43900, 0.531], [47515, 0.534], [51131, 0.501], [54747, 0.520], [58363, 0.497], [61979, 0.517], [65594, 0.565], [69210, 0.554], [72826, 0.543], [76442, 0.589], [80058, 0.559], [83673, 0.532], [87289, 0.538], [90905, 0.549], [94521, 0.600], [98137, 0.568], [101752, 0.557], [105368, 0.578], [108984, 0.553], [112600, 0.575], [116216, 0.619], [119831, 0.588], [123447, 0.597], [127063, 0.512], [130679, 0.585], [134294, 0.610], [137910, 0.608], [141526, 0.628], [145142, 0.595], [148758, 0.584], [152373, 0.588], [155989, 0.567], [159605, 0.576], [163221, 0.627], [166837, 0.599], [170452, 0.630], [174068, 0.589], [177684, 0.641], [181300, 0.659], [184916, 0.638], [188531, 0.636], [192147, 0.637], [195763, 0.619], [199379, 0.651], [202995, 0.672], [206610, 0.637], [210226, 0.637], [213842, 0.642], [217458, 0.641], [221074, 0.627], [224689, 0.668], [228305, 0.645], [231921, 0.640], [235537, 0.661], [239153, 0.632], [242768, 0.651], [246384, 0.647], [250000, 0.650]];

const HEADLINE = [
  { v: '0.545', k: 'best val Dice', note: 'Epoch 875, iteration 218,750. Run 2 got 0.514 — and this time the validation protocol is identical, so the comparison is clean.' },
  { v: '72.3%', k: 'lesion sensitivity', note: 'At the official protocol — up 5.6 points on run 2. Raw sensitivity 73.5% edges past the baseline’s quoted 73.0% for the first time.' },
  { v: '72.4%', k: 'lesion F1, matched filter', note: 'At 25 voxels ≈ 311 mm³, the closest physical match to run 2’s filter. Beats run 2 on F1, PPV and sensitivity simultaneously.' },
  { v: '70.4%', k: 'lesion PPV (protocol)', note: 'Looks like a 3.7-point drop from run 2 — but the protocol’s voxel-count filter got 5.3× physically weaker at 2 mm. See the ruler finding.' },
  { v: '1,714', k: 'clipped steps', note: '0.69% of 250k — calmer than run 2’s 1.27%. Training at 2 mm was the most stable this project has had.' },
  { v: '40.3 h', k: 'wall-clock', note: 'In two segments: OOM-killed at the first validation cycle, resumed from checkpoint with 50 iterations lost. Run 2 took 12.5 h.' },
];

/* Physical volumes: run 2 voxel = 4.0×4.07×4.07 ≈ 66.3 mm³, run 3 voxel =
   2.0364×2.0364×3.0 ≈ 12.4 mm³. So "10 voxels" means 663 mm³ in run 2 but
   124 mm³ in run 3 — the protocol row below compares two different filters. */
const RUN_CMP = {
  columns: ['Lesion metric · val, 57 scans', 'Run 2 @ 10 vox (663 mm³)', 'Run 3 @ 10 vox (124 mm³)', 'Run 3 @ 25 vox (311 mm³)'],
  rows: [
    { cells: ['Lesion F1', '70.2%', '71.3%', '72.4%'], accent: true },
    { cells: ['PPV (precision)', '74.0%', '70.4%', '75.6%'], accent: true },
    { cells: ['Sensitivity (recall)', '66.7%', '72.3%', '69.5%'], accent: true },
    { cells: ['Lesions found (TP)', '1,178', '1,286', '1,236'] },
    { cells: ['False lesions (FP)', '414', '542', '400'] },
    { cells: ['Lesions missed (FN)', '588', '493', '543'] },
    { cells: ['Patient-level accuracy', '86.0%', '86.0%', '86.0%'] },
  ],
};

const BASELINE_CMP = {
  columns: ['Lesion-level metric', 'Run 3 raw', 'Run 3 matched filter', 'Baseline', 'Gap'],
  rows: [
    { cells: ['F1', '66.5%', '72.4%', '79.9%', '−7.5'], accent: true },
    { cells: ['PPV (precision)', '60.8%', '75.6%', '88.2%', '−12.6'], accent: true },
    { cells: ['Sensitivity (recall)', '73.5%', '69.5%', '73.0%', '+0.5 raw'], accent: true },
    { cells: ['Patient-level accuracy', '86.0%', '86.0%', '94.5%', '−8.5'], accent: true },
    { cells: ['Training cases', '430', '430', '~1000', '2.3× fewer'] },
    { cells: ['Cross-validation', 'none', 'none', '5-fold + ensemble', 'not matched'] },
    { cells: ['Post-processing', 'none', 'min-volume only', 'TotalSegmentator organ-aware', 'not matched'] },
  ],
};

const FINDINGS = [
  {
    tone: 'ok', t: 'The resolution bet paid out where it was aimed: sensitivity',
    why: 'At the official protocol the model finds 108 more real lesions than run 2 (1,286 vs 1,178) and misses 95 fewer, lifting sensitivity 66.7% → 72.3%. Raw sensitivity is 73.5% — past the baseline’s quoted 73.0% for the first time, on 43% of its training data with no ensembling.',
  },
  {
    tone: 'ok', t: 'Over-merging roughly halved, exactly as the 2 mm hypothesis predicted',
    why: 'Run 2’s backwards signature — sensitivity rising as the threshold tightens, because diffuse blobs spanning several lesions fragment into pieces that each match — shrank from a +3.9-point rise to +1.7 across the same sweep. The finer grid genuinely separates adjacent nodal deposits the 4 mm grid fused together.',
  },
  {
    tone: 'warn', t: 'The evaluation protocol measures with a rubber ruler',
    why: 'The 10-voxel minimum-size filter was fixed on run 2’s grid, where a voxel is 66.3 mm³ — so “10 voxels” meant 663 mm³. At 2 mm a voxel is 12.4 mm³ and the same rule filters only 124 mm³: a 5.3× physically weaker cut. Run 3’s apparent PPV drop at protocol (74.0% → 70.4%) is mostly this artefact; at the nearest matched filter (25 voxels ≈ 311 mm³ — still 2× laxer than run 2’s) run 3 wins on F1, PPV and sensitivity at once. Even the ground-truth lesion count changes with the grid (1,766 → 1,779 connected components). The protocol needs restating in mm³ before run 4.',
  },
  {
    tone: 'warn', t: 'Balanced Tversky cannot be credited or blamed — the changes are confounded',
    why: 'Raw PPV is flat (60.6% → 60.8%) despite the loss now penalising false positives equally. Either the rebalance did nothing, or it offset a precision cost of the finer grid — three knobs moved at once (accepted deliberately in run 2’s plan), so this run cannot say which. Attribution would need a 2 mm run at the old 0.3/0.7 weights.',
  },
  {
    tone: 'bad', t: 'Every lesion-free patient now gets a false alarm',
    why: 'Run 2 kept 3 of 7 lesion-negative scans clean; run 3 keeps 0 of 7, scattering 25 false lesions across them, and raw patient accuracy fell 93.0% → 86.0%. Eight times more voxels means eight times more places to hallucinate physiologic uptake. This is the strongest argument yet for the baseline’s organ-aware post-processing stage.',
  },
  {
    tone: 'warn', t: 'The output probabilities are saturated — threshold is no longer a knob',
    why: 'Raw F1 moves only 66.5% → 68.7% as the threshold sweeps 0.3 → 0.95, and every metric is nearly flat across it. The sigmoid outputs sit pinned near 0 and 1, so post-processing value lives almost entirely in the physical minimum-size filter, not the operating point.',
  },
  {
    tone: 'ok', t: 'Training at 2 mm was the calmest yet — and survived its own infrastructure',
    why: 'Only 0.69% of steps clipped (run 2: 1.27%), zero instability events. The one incident was environmental: the first validation cycle spawned six persistent whole-volume dataloader workers, exhausted WSL’s 16 GB allowance, and the kernel OOM-killed the run — diagnosed from the previous boot’s journal, fixed with one line (val loader num_workers=0), resumed from checkpoint with 50 iterations lost.',
  },
  {
    tone: 'bad', t: 'The baseline comparison is still not like-for-like — and now each attempt costs 40 hours',
    why: 'Same four asymmetries as run 2 (430 vs ~1000 cases, no cross-validation, no ensembling, no organ-aware post-processing), so the remaining 7.5-point F1 gap stays a lower bound on the architecture. But 2 mm tripled the wall-clock on this card: iterating locally is no longer cheap, which strengthens the case for the hospital’s quad 4090s.',
  },
];

const NEXT = [
  {
    t: 'Restate the size filter in mm³ and re-report runs 2 and 3 on the same ruler',
    why: 'The protocol artefact contaminates every cross-resolution comparison this project will ever make. Fix the filter at ~300–600 mm³ on the validation split, regenerate both runs’ tables from the archived probability maps, and freeze it before run 4.',
  },
  {
    t: 'Organ-aware false-positive suppression',
    why: 'The 0-of-7 clean negatives point straight at physiologic uptake (bladder, kidneys, salivary glands — PSMA’s known traps). TotalSegmentator masks over the existing predictions is a post-processing change — no retraining — and it targets PPV, which is 12.6 points short at the matched filter and now the whole gap.',
  },
  {
    t: 'Attribution run: 2 mm grid with run 2’s 0.3/0.7 Tversky weights',
    why: 'One knob, one run. Settles whether balanced Tversky offset a precision cost or did nothing, and completes the story this page cannot tell.',
  },
  {
    t: 'Deep supervision',
    why: 'Still queued from run 2, still unaddressed: the baseline trains with it and we do not. Cheap to add to the existing decoder.',
  },
  {
    t: 'Scale to ~1000 cases with 5-fold cross-validation on the hospital 4090s',
    why: 'At 40 h per run the dev PC cannot carry a folds-and-ensembles protocol. One fold per GPU makes the full baseline-parity experiment roughly one weekend.',
  },
];

const OOM_LOG = `# journalctl -b -1 — the previous boot's journal, 09 Aug 14:55
kernel: Out of memory: Killed process 12967 (python)
        total-vm:61710144kB, shmem-rss:8142104kB
kernel: oom-kill: ...global_oom, task=python
systemd[1]: init.scope: A process of this unit has been
        killed by the OOM killer.
# 12 pt_data_worker processes at kill time — 6 training + 6
# validation workers, the latter prefetching WHOLE 2 mm volumes
# with persistent_workers=True. The fix, preprocessing/dataset.py:
val_loader num_workers 6 -> 0   # val is GPU-bound tiled inference
# resume — checkpoint_last was 50 iterations old:
python scripts/run_training.py --resume checkpoints/checkpoint_last.pth --wandb`;

const LOG_TAIL = `iter 250000/250000  loss 0.5763  train-Dice 0.427  lr 0.00e+00  gnorm 0.71 (max 3.8, 1714 clipped)
  epoch 1000  val-Dice 0.532  (best 0.545)
final val-Dice 0.532  ->  saved checkpoints/checkpoint_last.pth
best val-Dice  0.545  ->  checkpoints/checkpoint_best.pth`;

export default function Run03Parity2mm({ run }) {
  return (
    <RunPage run={run}>
      <Verdict tone="warn" lead="The 2 mm grid did what it promised — more lesions found, over-merging halved, sensitivity past the reference — but the headline F1 barely moved, because the evaluation protocol’s voxel-count filter quietly changed meaning under the new resolution.">
        All three of run 2&rsquo;s committed changes landed: ~2&nbsp;mm spacing, a 96&times;192&times;96
        patch, balanced Tversky. Validation Dice rose 0.514 &rarr; 0.545 on an identical protocol,
        and at a physically matched size filter run 3 beats run 2 on F1, PPV and sensitivity
        simultaneously &mdash; the official protocol row hides that win behind a filter that is
        5.3&times; weaker in mm&sup3; than it was at 4&nbsp;mm. The costs: every lesion-free patient
        now collects at least one false alarm, and wall-clock tripled to 40&nbsp;hours. Precision
        remains the gap; the evidence now points at physiologic uptake rather than lesion detection.
      </Verdict>

      <Section label="Headline numbers" note="all measured — nothing estimated">
        <StatGrid stats={HEADLINE} />
      </Section>

      <Section label="Validation Dice" note="identical tiled protocol both runs — a clean comparison, unlike run 1 vs 2">
        <LineChart
          xLabel="epoch"
          yLabel="validation Dice"
          yDomain={[0, 0.6]}
          series={[
            { name: 'run 2 — 4 mm', data: RUN2_VAL },
            { name: 'run 3 — 2 mm', data: RUN3_VAL },
          ]}
        />
      </Section>

      <Section label="Training Dice" note="51-point moving average · run 3 plateaus later and slightly higher">
        <LineChart
          xLabel="iteration"
          yLabel="Dice on training patches"
          yDomain={[0, 0.72]}
          series={[
            { name: 'run 2 — 4 mm', data: RUN2_TRAIN_DICE },
            { name: 'run 3 — 2 mm', data: RUN3_TRAIN_DICE },
          ]}
        />
      </Section>

      <Section label="The crash" note="09 Aug, 2 h in — the run’s one incident, and it was infrastructure, not the model">
        <Prose>
          At the first validation cycle the run died with a bare <code>Terminated</code>. The previous
          boot&rsquo;s systemd journal had the whole story: validation builds its dataloader with the
          same settings as training &mdash; six workers, <code>persistent_workers=True</code> &mdash;
          but validation items are whole volumes, not patches, and at 2&nbsp;mm a volume is ~8&times;
          larger than the 4&nbsp;mm runs ever saw. Six extra workers prefetching full volumes into
          shared memory exhausted WSL&rsquo;s 16&nbsp;GB, the kernel OOM-killed the process, and
          systemd tore down the whole VM. One line fixed it; the checkpoint written at that same
          validation meant only 50 iterations were lost.
        </Prose>
        <CodeBlock label="diagnosis — kernel OOM via the previous boot’s journal" text={OOM_LOG} />
      </Section>

      <Section label="Run 2 vs run 3" note="the middle column is the official protocol; the right column is the physically fair one">
        <Prose>
          The protocol fixed in run 2&rsquo;s analysis filters predictions under 10 <em>voxels</em> —
          but a voxel shrank from 66.3&nbsp;mm&sup3; to 12.4&nbsp;mm&sup3; between runs, so the official
          row compares a 663&nbsp;mm&sup3; filter against a 124&nbsp;mm&sup3; one. The 25-voxel column
          (&asymp;311&nbsp;mm&sup3;) is the closest available match &mdash; still twice as lax as
          run 2&rsquo;s &mdash; and run 3 leads on every row of it.
        </Prose>
        <MetricTable columns={RUN_CMP.columns} rows={RUN_CMP.rows} />
      </Section>

      <Section label="Against the reference" note="read the bottom three rows before the top four">
        <MetricTable columns={BASELINE_CMP.columns} rows={BASELINE_CMP.rows} />
      </Section>

      <Section label="Findings">
        <Findings items={FINDINGS} />
      </Section>

      <Section label="Training stability & evaluation figures" note="generated from train.log and the run 3 evaluation outputs">
        <FigureGrid>
          <Figure
            src={trainLoss}
            source="train.log"
            caption="Training loss on a log axis — run 3 peaks at 5.5 where run 2 reached 24.4 and run 1 hit 4,165. The α/β rebalance changes what the loss measures, so compare the texture (no spikes), not the level."
          />
          <Figure
            src={gradNorm}
            source="train.log"
            caption="Gradient norm across run 3. The tail peaks at 9,542 — roughly a third of run 2’s 25,695 — and only 0.69% of steps needed clipping. The violent-tail regime persists at 2 mm; the clipper simply absorbs it."
          />
          <Figure
            src={prTrade}
            source="eval"
            caption="The size filter, not the threshold, does the precision work — and the x-axis carries the ruler problem: each voxel count means a different physical volume than it did at 4 mm. The circled point is run 2’s ruler, beaten on all three metrics. Best F1 anywhere in the sweep: 72.9% at threshold 0.95 + 10 voxels."
          />
          <Figure
            src={perCase}
            source="eval"
            caption="Per-case F1 against lesion burden (50 lesion-positive scans). High-burden scans hold 55–85%; sparse scans remain near all-or-nothing — 7 of the 20 scans with ≤3 lesions score exactly 0% or 100%, the same failure shape run 2 showed."
          />
        </FigureGrid>
      </Section>

      <Section label="What would make the model better" note="ordered by expected value">
        <NextSteps items={NEXT} />
      </Section>

      <Section label="Log" note="the decisive tail of train.log">
        <CodeBlock label="train.log — final lines" text={LOG_TAIL} />
      </Section>
    </RunPage>
  );
}
