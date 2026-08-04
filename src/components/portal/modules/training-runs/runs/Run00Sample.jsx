import { RunPage, Verdict, Section, StatGrid, LineChart, Figure, FigureGrid, MetricTable, Findings, NextSteps, CodeBlock } from '../kit';

/* ============================================================================
   RUN 00 — SAMPLE  ·  THIS FILE IS THE TEMPLATE
   ----------------------------------------------------------------------------
   Copy this file to Run<NN><ShortName>.jsx for each real run (see ../runs.js
   for the full workflow), then replace every constant with the run's real
   numbers. EVERY value below is fabricated — plausible-looking Mamba_PSMA
   shapes so the framework can be seen working, nothing more. The registry
   entry carries `sample: true`, which renders the amber "sample" flags.

   Page anatomy (keep this order so all runs read the same):
     Verdict   → the one-paragraph takeaway, first thing on the page
     Headline  → StatGrid of the 3–5 numbers that matter
     Curves    → LineChart per measure (loss chart ≠ Dice chart, never mixed)
     Figures   → W&B PNG exports via FigureGrid/Figure — files go in
                 ../figures/run-<nn>-<shortname>/ (see the README there)
     Comparison→ MetricTable vs baselines / previous runs (accent = this run)
     Findings  → what was observed, tone-coded ok / warn / bad
     Next      → NextSteps — what the NEXT run changes because of this one
     Log       → CodeBlock with the decisive train.log excerpt
   Sections that genuinely don't apply may be dropped; don't add new visual
   language here — extend ../kit.jsx instead so every run inherits it.

   Data conventions:
     • Curves are downsampled to ≤ ~80 points per series before pasting in
       (e.g. every 2.5k steps) — this page is analysis, not raw logs.
     • Series order is meaningful (train = s1 blue, val = s2 orange — keep
       that pairing across every run so charts stay comparable at a glance).
     • Real numbers only; anything estimated is labelled as such in prose.
   ========================================================================== */

// Fabricated curves: exp-decay loss + saturating Dice with a deterministic
// wiggle, sampled every 2.5k steps to 100k. Real runs paste real arrays.
const STEPS = Array.from({ length: 41 }, (_, i) => i * 2500);
const zip = (ys) => STEPS.map((s, i) => [s, ys[i]]);

const TRAIN_LOSS = STEPS.map((s) => +(0.27 + 0.85 * Math.exp(-s / 21000) + 0.018 * Math.sin(s / 6100)).toFixed(3));
const VAL_LOSS   = STEPS.map((s) => +(0.35 + 0.76 * Math.exp(-s / 26000) + 0.012 * Math.sin(s / 8900 + 2)).toFixed(3));
const TRAIN_DICE = STEPS.map((s) => +Math.max(0.03, 0.74 * (1 - Math.exp(-s / 30000)) + 0.02 * Math.sin(s / 7300)).toFixed(3));
const VAL_DICE   = STEPS.map((s) => +Math.max(0.02, 0.66 * (1 - Math.exp(-s / 34000)) + 0.015 * Math.sin(s / 9700 + 1)).toFixed(3));

const HEADLINE = [
  { v: '0.66', k: 'best val Dice', note: 'epoch 380 of 400 — still creeping up at the end.' },
  { v: '0.29', k: 'final train loss', note: 'Tversky+BCE, plateaued from ~60k steps.' },
  { v: '6.8 h', k: 'wall-clock', note: '100k steps · batch 2 · single 4090.' },
  { v: '0', k: 'non-finite steps', note: 'bf16 held — no skipped batches all run.' },
];

const COMPARISON = {
  columns: ['Model', 'val Dice', 'steps', 'wall-clock'],
  rows: [
    { cells: ['Mamba baseline — this run', '0.66', '100k', '6.8 h'], accent: true },
    { cells: ['nnU-Net (published full-res reference)', '0.72', '—', '—'] },
  ],
};

const FINDINGS = [
  {
    tone: 'ok', t: 'The pipeline is sound end to end',
    why: 'Clean exit, checkpoints on schedule, zero non-finite batches over 100k bf16 steps — the 28 Jul fp16 failure mode is gone for good.',
  },
  {
    tone: 'warn', t: 'Train–val gap opens after ~60k steps',
    why: 'Train Dice keeps climbing to 0.72 while val flattens near 0.66 — mild overfitting. Worth trying stronger augmentation before touching model size.',
  },
  {
    tone: 'bad', t: 'Validation was still improving when the run ended',
    why: 'Best checkpoint landed at epoch 380/400, so the schedule cut the run short of convergence — the step budget, not the model, set the ceiling here.',
  },
];

const NEXT = [
  { t: 'Extend to 250k steps', why: 'Val Dice had not flattened; the full budget from the run book is the obvious next data point.' },
  { t: 'Add elastic + gamma augmentation', why: 'Cheapest lever against the train–val gap before any architecture change.' },
  { t: 'Run the official 5-fold split', why: 'This was a random 70/10/20 — numbers become quotable only on the dataset’s folds.' },
];

const LOG_TAIL = `iter  99990/100000  loss 0.291  train-Dice 0.718  lr 1.20e-06
epoch  400  val-Dice 0.657  (best 0.663 @ epoch 380)
saved checkpoints/checkpoint_last.pth
=== EXIT CODE: 0 ===`;

export default function Run00Sample({ run }) {
  return (
    <RunPage run={run}>
      <Verdict tone="warn" lead="Sample verdict — the stack works, the step budget was the bottleneck.">
        One clean sentence on what this run proved, plus the single most important caveat.
        Everything on this page is fabricated demo data showing the framework&rsquo;s shape.
      </Verdict>

      <Section label="Headline numbers">
        <StatGrid stats={HEADLINE} />
      </Section>

      <Section label="Loss" note="Tversky + BCE · logged every 2.5k steps">
        <LineChart
          yLabel="loss"
          series={[
            { name: 'train', data: zip(TRAIN_LOSS) },
            { name: 'val', data: zip(VAL_LOSS) },
          ]}
        />
      </Section>

      <Section label="Dice" note="same steps · Dice is its own chart, never a second axis">
        <LineChart
          yLabel="Dice"
          yDomain={[0, 1]}
          series={[
            { name: 'train', data: zip(TRAIN_DICE) },
            { name: 'val', data: zip(VAL_DICE) },
          ]}
        />
      </Section>

      {/* Real usage once exports exist:
            import valDice from '../figures/run-00-sample/val-dice.png';
            <Figure src={valDice} caption="…" />
          Omitting src renders the dashed placeholder below. */}
      <Section label="W&B figures" note="PNG exports from Weights & Biases">
        <FigureGrid>
          <Figure caption="val Dice per epoch — the curve the best checkpoint was picked on" />
          <Figure caption="GPU utilisation over the run — dips mark validation passes" />
        </FigureGrid>
      </Section>

      <Section label="Against the reference" note="accent row = this run">
        <MetricTable columns={COMPARISON.columns} rows={COMPARISON.rows} />
      </Section>

      <Section label="Findings">
        <Findings items={FINDINGS} />
      </Section>

      <Section label="What the next run changes">
        <NextSteps items={NEXT} />
      </Section>

      <Section label="Log" note="the decisive tail of train.log">
        <CodeBlock label="train.log — final lines" text={LOG_TAIL} />
      </Section>
    </RunPage>
  );
}
