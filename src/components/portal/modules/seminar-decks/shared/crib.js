/* ============================================================================
   SEMINAR DECKS — Q&A CRIB (presenter view; shared by all three decks)
   ----------------------------------------------------------------------------
   Twenty likely questions with a short answer in James's voice and the backup
   slide that supports it. Seeded from the motion README's "Speaker notes and
   likely questions" and chapter 5's caveats, then extended with the examiner
   critic's ten hardest questions (critic-examiner.md). Numbers only through
   {{keys}} (shared/facts.js). Each answer is as strong as chapter 5's verdict.
   `backup` is a backup slide's backupId (shared/backups.jsx).
   ========================================================================== */

export const CRIB = [
  {
    id: 'q-average',
    q: 'Is {{r5.f1}} what the model gets on a typical scan?',
    a: 'No. It is pooled over all the lesions in the {{data.test}} scans, so lesion-heavy scans count most. The mean of the per-scan F1 is {{r5.percase_mean}} over the {{r5.percase_n}} scans where F1 is defined, and the median is {{r5.percase_median}}.',
    backup: 'b-cv',
  },
  {
    id: 'q-why-not-final',
    q: 'Why not compare your final model with PSMASegmentator on your test set?',
    a: 'PSMASegmentator was trained on all {{data.test_autopet}} autoPET scans in my test set, so that would not be fair. The fair comparison uses the {{fair.n}} DEEP-PSMA scans neither model trained on, with run 4, because my final ensemble trained on {{data.pool_deeppsma}} of them. I chose run 4 as the headline after both scores existed; it changed no number, and it was the smaller gain: the ensemble was {{fair.s20_df1}} points ahead on the {{data.test_deeppsma}} sealed DEEP-PSMA scans, which are in-domain for it.',
    backup: 'b-departures',
  },
  {
    id: 'q-mamba-helps',
    q: 'So does Mamba actually help?',
    a: 'A little at most. At the small window the hybrid minus the CNN-only twin was {{r6.gap_small_dp}} points on DEEP-PSMA, no clear effect, and {{r6.gap_small_ap}} on autoPET, which passes my rule but is small, and the twin has only {{net.twin_pct}} of the parameters. The twin also scored above PSMASegmentator, so I do not credit the gain to the Mamba blocks; the likelier source is something both share, such as the finer working grid, which I did not ablate.',
    backup: 'b-run6',
  },
  {
    id: 'q-why-worse',
    q: 'Why would a bigger window make the hybrid worse?',
    a: 'I did not test the reasons. One idea is sequence length: at the third stage each scan direction covers {{net.tok3_large}} tokens instead of {{net.tok3}}, with the same small state. Others are that lesions are a smaller share of a bigger window, and that the large hybrid was selected at epoch {{r6.epoch}} with batch size {{r6.batch_large}}.',
    backup: 'b-run6',
  },
  {
    id: 'q-confound',
    q: 'The large window trained at batch size {{r6.batch_large}}, one run per cell. Why is the interaction not just noise?',
    a: 'Within each window size both networks share the batch size, and the parameter gap is the same at both sizes, so neither confound alone can make the gap between them change with the window, if the effects add. The bigger doubt is one training run per cell: my fold models spread by about {{r6.seed_spread}} F1 and the rule needed {{r6.rule}}. Several seeds per cell, with the large window at batch size {{r6.batch_small}}, would settle it.',
    backup: 'b-run6',
  },
  {
    id: 'q-abstract-timing',
    q: 'Your abstract says {{abs.home_h}} against {{abs.home_p}} seconds. Why are the numbers different here?',
    a: 'Those came from an earlier benchmark on my home {{abs.home_gpu}}, each model in its published configuration. The dissertation uses the controlled timing on an {{eff.gpu}}: {{eff.h5}} against {{eff.p40}}. Either way the gap is PSMASegmentator\'s eight-pass test-time augmentation. At five passes each the two were about level at home, {{abs.home_eq_h}} against {{abs.home_eq_p}} seconds, and on the {{eff.gpu}} the hybrid was no faster in mean time and used {{eff.vram_h}} of memory against {{eff.vram_p}}.',
    backup: 'b-timing',
  },
  {
    id: 'q-fair',
    q: 'Is the comparison with PSMASegmentator fair?',
    a: 'Fairer than any other test I had, but not like for like. PSMASegmentator trained on {{psm.train}} cases against my {{train.run4_cases}}, averages five models with eight-pass augmentation, and has {{psm.params}} parameters against {{net.params}}; its optional post-processing was off, and mine has none. Most differences favour it, so the gap is more likely to understate than overstate my recipe.',
    backup: 'b-departures',
  },
  {
    id: 'q-per-case',
    q: 'Pooled, run 4 wins; scan by scan it is level. Is it worse for patients with few lesions?',
    a: 'Pooled F1 weighs the lesion-heavy scans most. Scan by scan the mean difference was {{fair.pc_df1}} points with an interval spanning zero: run 4 lost on {{fair.lt20_lower}} of the {{fair.lt20_n}} scans with under {{fair.lt20_cut}} lesions and won on {{fair.ge100_higher}} of the {{fair.ge100_n}} with {{fair.ge100_cut}} or more. H1 named the pooled metric, so it holds on that, but calling run 4 better for a typical patient would go beyond my evidence.',
    backup: 'b-percase',
  },
  {
    id: 'q-trade',
    q: 'Is finding more lesions worth more false alarms?',
    a: 'That is a clinical judgement I cannot settle. The proposal held that a missed metastasis is generally worse than a false alarm, and the 2022 authors named sensitivity as the figure to improve. But the trade is real: precision fell by {{fair.dppv_abs}} points.',
    backup: 'b-percase',
  },
  {
    id: 'q-matching',
    q: 'Why count a lesion as found if any predicted voxel touches it?',
    a: 'It is the rule of the scoring script the UWA group already uses, and my supervisors\' position: two lesions inside one predicted blob were both found. The rule is blind to over-segmentation, so I always report voxel Dice beside it. On the fair comparison Dice rose by {{fair.ddsc_abs}} points, which is consistent with finding more lesions rather than smearing.',
    backup: 'b-dev',
  },
  {
    id: 'q-labels-fair',
    q: 'DEEP-PSMA labels are threshold masks. Why is precision so high there, and is that fair to both models?',
    a: 'DEEP-PSMA marks every voxel at SUV {{data.suv}} or above, with normal uptake painted out, which splits into about {{data.dp_components}} pieces per scan. The likely reason: nearly everything a model predicts lands on disease, but many small pieces are missed. Neither model trained on a threshold mask, so the convention is equally foreign to both. The test would be to run PSMASegmentator with its SUV-threshold option set to each case\'s threshold and apply the same threshold to run 4.',
    backup: 'b-cohorts',
  },
  {
    id: 'q-case-b',
    q: 'Is case B your worst scan, and did you pick case A because it looks good?',
    a: 'Both were picked by a rule before I looked at any image: A is the best F1 among autoPET test scans with at least {{a.rule_min}} lesions, B the lowest F1 among scans where F1 is defined. B is not the worst: in {{r5.zero_found}} other scans no lesion was found at all, so their F1 is undefined. Both of B\'s lesions were found; its {{b.fa}} false alarms were {{b.fa_bone}} in bone and {{b.fa_soft}} in soft tissue.',
    backup: 'b-caseb',
  },
  {
    id: 'q-negatives',
    q: 'Does it still raise false alarms on healthy scans?',
    a: 'Yes. The ensemble flagged {{r5.neg_flag}} of the {{data.test_neg}} lesion-negative test scans, fewer than any single fold model. The organ head helped in development, but it is single-scale with no clean-up stage, while PSMASegmentator trains its organ head at every deep-supervision level.',
    backup: 'b-cohorts',
  },
  {
    id: 'q-transformer',
    q: 'Why Mamba and not a transformer or windowed attention?',
    a: 'Attention compares every pair of positions, so its cost grows with the square of the length; in the SegMamba comparison self-attention ran out of memory at a {{lit.segmamba_tokens}}-token sequence. Transformers also need a lot of data, and I had {{data.pool}} scans to train on. I did not benchmark a transformer, so I cannot say which would do better here.',
    backup: 'b-deep',
  },
  {
    id: 'q-deep-only',
    q: 'Why put Mamba only in the deepest three stages?',
    a: 'Because the sequence is short enough there. Flattened, those stages hold {{net.tok3}}, {{net.tok4}} and {{net.tok5}} tokens per direction; the shallow stages would be at least {{net.tok2}}, and their features are fine texture that a convolution handles cheaply. I never tested the alternatives.',
    backup: 'b-deep',
  },
  {
    id: 'q-window-shape',
    q: 'Why is your window longer front to back than it is wide?',
    a: 'That was a mistake I found later: I copied its shape from a plans file whose axes are stored in a different order. It was the largest window that fitted my {{gpu.dev_mem}} development GPU at batch size {{r6.batch_small}}. It also meant my main models never trained on a bigger window than nnU-Net, so the premise was only tested in the ablation.',
    backup: 'b-deep',
  },
  {
    id: 'q-loss',
    q: 'Why did the recall-weighted loss fail?',
    a: 'Run 2 reached {{run2.sens_full}} sensitivity, but precision fell to {{run2.ppv_full}}, and a threshold sweep could not recover it, so the false alarms were confident. It was one run, scored under an older matcher, so the loss effect was never isolated.',
    backup: 'b-dev',
  },
  {
    id: 'q-prereg',
    q: 'What do you mean by pre-registered?',
    a: 'The test protocol was written in a version-controlled document before any test inference: the five checkpoints, threshold {{inf.thr}}, the {{inf.minvox}}-voxel filter and the two rows to report. The test set was scored once. It was not a public registry.',
    backup: 'b-operating',
  },
  {
    id: 'q-scgh',
    q: 'Would more data or the SCGH cohort make it better?',
    a: 'I cannot promise that. The next step is to retrain and score it on the Sir Charles Gairdner Hospital cohort, where it is untested, which the UWA Medical Physics Research Group can do once the code is released. It would not be a fair test against PSMASegmentator, because its Western Australian training patients came from there.',
    backup: null,
    note: 'The SCGH origin of PSMASegmentator\'s 438 Western Australian training patients is your own knowledge (12 Oct); no document states it.',
  },
  {
    id: 'q-live',
    q: 'Can you run it live?',
    a: 'Not on this laptop: inference needs a CUDA GPU, and the model runs on my PC at home. That is why the talk shows a recording of a real run, sped up.',
    backup: 'b-demo',
  },
];
