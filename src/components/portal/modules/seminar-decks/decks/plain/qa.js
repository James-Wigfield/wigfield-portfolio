/* ============================================================================
   PLAIN DECK — QUESTION INDEX (pure data)
   ----------------------------------------------------------------------------
   Likely questions, each with its backup slide and the facts to have to hand,
   for the presenter view (deck.qa), the phone page and the palm cards. These
   are notes, not a script: James answers in his own words. Seeded from the
   shared crib's questions, Chapter 5's limitations and the marking sheet; no
   crib answer or wording is reused. Numbers only through {{keys}}; `ref` is
   where the dissertation states them.
   ========================================================================== */

export const DEMO_ID = 'pb-demo';

export const QA = [
  {
    id: 'qa-setup',
    q: 'Is the comparison with PSMASegmentator like-for-like?',
    backup: 'pb-setup',
    facts: [
      { t: 'No: {{train.run4_cases}} against {{psm.train}} training scans; one model against {{psm.folds}} averaged, with {{psm.tta}}-pass test-time augmentation', ref: 'Ch3 tab:method-departures' },
      { t: 'Patch {{patch.small_vox}} against {{psm.patch_vox}} voxels; {{net.params}} against about {{psm.params}} parameters', ref: 'Ch3 tab:method-departures' },
      { t: 'Most factors favour PSMASegmentator, so the gain is more likely to understate than overstate the recipe; none was tested', ref: 'Ch5:364-367' },
    ],
  },
  {
    id: 'qa-paired',
    q: 'Is the gain in pooled F1 real, and what happens scan by scan?',
    backup: 'pb-paired',
    facts: [
      { t: 'Pooled F1 {{fair.df1}} ({{fair.df1_lo}} to {{fair.df1_hi}}); found {{fair.dsens}}; flagged and real {{fair.dppv}}', ref: 'Ch4:207-211' },
      { t: 'Per-scan F1 mean {{fair.pc_df1}} ({{fair.pc_lo}} to {{fair.pc_hi}}): no clear difference; better {{fair.better}}, worse {{fair.worse}}, tied {{fair.tied}}', ref: 'Ch4:215-218, 304' },
      { t: 'Under {{fair.lt20_cut}} lesions worse on {{fair.lt20_lower}} of {{fair.lt20_n}}; {{fair.ge100_cut}} or more better on {{fair.ge100_higher}} of {{fair.ge100_n}}', ref: 'Ch4:220-222' },
    ],
  },
  {
    id: 'qa-negatives',
    q: 'Does it raise false alarms on scans with no lesions?',
    backup: 'pb-negatives',
    facts: [
      { t: 'Yes: the ensemble flagged {{r5.neg_flag}} of the {{data.test_neg}}; each version alone {{r5.neg_fold_min}} to {{r5.neg_fold_max}}', ref: 'Ch4:120-122' },
      { t: 'The organ head cut false alarms on the {{organ.neg}} validation scans from {{organ.fc3}} to {{organ.fc4}}', ref: 'Ch5:189-191' },
      { t: 'Next: the organ head at every deep-supervision level, as PSMASegmentator has', ref: 'Ch5:209-213' },
    ],
  },
  {
    id: 'qa-matching',
    q: 'Why count a lesion as found if any predicted voxel touches it?',
    backup: 'pb-matching',
    facts: [
      { t: 'The same scoring script for both models (Joel Noble\'s), on the same grid', ref: 'Ch3:486-488, 691-692, 742; Ch4:198-199' },
      { t: 'Blind to over-segmentation, so Dice is reported beside it: {{fair.r4_dsc}} against {{fair.psm_dsc}} ({{fair.ddsc}} points)', ref: 'Ch5:311-316; Ch4:209, 264-265' },
    ],
  },
  {
    id: 'qa-labels',
    q: 'Why is precision so high on DEEP-PSMA, and how were the datasets labelled?',
    backup: 'pb-labels',
    facts: [
      { t: 'autoPET-III: SUV threshold in drawn volumes of interest, then expert correction; DEEP-PSMA: SUV of at least {{data.suv}}, physiological uptake removed', ref: 'Ch3 tab:method-datasets' },
      { t: 'About {{data.dp_components}} pieces per DEEP-PSMA scan; flagged and real {{r5.dp_ppv}}, found {{r5.dp_sens}}', ref: 'Ch5:329-335; Ch4:159' },
      { t: 'Possible explanation only; Dice not comparable across the two', ref: 'Ch5:329-337' },
    ],
  },
  {
    id: 'qa-stages',
    q: 'Why put Mamba only in the three deepest stages?',
    backup: 'pb-stages',
    facts: [
      { t: 'Sequence length per direction {{net.tok3}}, {{net.tok4}} and {{net.tok5}} there; {{net.tok2}} at the second stage', ref: 'Ch3:294-300' },
      { t: 'Shallow features are low-level texture, cheaper for convolution; {{net.dirs}} directions summed, never tested against an alternative', ref: 'Ch3:282-288, 298-299' },
    ],
  },
  {
    id: 'qa-size',
    q: 'Is the CNN-only version just a smaller network?',
    backup: 'pb-size',
    facts: [
      { t: '{{net.twin_params}} parameters, {{net.twin_pct}} of the hybrid\'s {{net.params}}', ref: 'Ch3:270-272' },
      { t: 'The gap is the same at both patch sizes, so it cannot alone make the difference change with patch size, if effects add', ref: 'Ch3:591-598' },
    ],
  },
  {
    id: 'qa-onerun',
    q: 'Each model was trained once, the larger patch at batch size {{r6.batch_large}}. Is the result just noise?',
    backup: 'pb-onerun',
    facts: [
      { t: 'Difference {{r6.inter}} ({{r6.inter_lo}} to {{r6.inter_hi}}), real under the rule: interval excludes zero, size at least {{r6.rule}}', ref: 'Ch4:351-357, Ch3:650-653' },
      { t: 'Spread between the final model\'s five versions about {{r6.seed_spread}}; several seeds per model, with the larger patch at batch size {{r6.batch_small}}, would settle it', ref: 'Ch5:271-272, 406-409' },
    ],
  },
  {
    id: 'qa-timing',
    q: 'The abstract says about half the time. Why do the numbers differ?',
    backup: 'pb-timing',
    facts: [
      { t: 'Abstract: home {{abs.home_gpu}}, {{abs.home_h}} against {{abs.home_p}} s; at {{eff.passes_h}} passes each {{abs.home_eq_h}} against {{abs.home_eq_p}} s', ref: 'abstract and the home timing report of 21 Sep (Mamba_PSMA benchmarks); not in the dissertation' },
      { t: 'Dissertation, {{eff.gpu}}: {{eff.h5}} against {{eff.p40}}; same passes {{eff.h5}} against {{eff.p5}}; medians {{eff.h5_med}} against {{eff.p5_med}}', ref: 'Ch4:654-680, tab:results-efficiency' },
      { t: 'The gap is test-time augmentation ({{eff.passes_p}} against {{eff.passes_h}} passes), not the architecture', ref: 'Ch4:671-673' },
    ],
  },
  {
    id: 'qa-folds',
    q: 'How was cross-validation done?',
    backup: 'pb-folds',
    facts: [
      { t: '{{data.pool}} scans, {{data.folds}} folds split by patient ({{data.fold0}}, then {{data.fold_n}} each); {{data.test}} sealed away', ref: 'Ch3:148-161; Ch4:72-76' },
      { t: 'Out-of-fold pooled F1 {{cv.f1}} (fold sd {{cv.sd}}); versions alone {{r5.single_f1}} on average on the test set, ensemble {{r5.f1}}', ref: 'Ch4:31-37, 107-108, 151' },
    ],
  },
  {
    id: 'qa-cohorts',
    q: 'What are the confidence intervals on the test results?',
    backup: 'pb-cohorts',
    facts: [
      { t: 'Pooled F1 {{r5.f1}} ({{r5.f1_lo}} to {{r5.f1_hi}}); autoPET-III {{r5.ap_f1}}, DEEP-PSMA {{r5.dp_f1}}', ref: 'Ch4:96-98, tab:results-test' },
      { t: 'Patient bootstrap, added after scoring; changed no point estimate', ref: 'Ch3:656-660' },
    ],
  },
];
