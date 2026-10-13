/* ============================================================================
   SEMINAR DECKS — FACT MANIFEST
   ----------------------------------------------------------------------------
   Every number, count and short fact used on any slide, transcript or crib
   answer of the three seminar decks lives here, once. Slides render numbers
   through <Num k="..."/> (shared/Num.jsx), transcripts and crib answers through
   {{key}} templates (shared/text.js). Nothing else may put a digit on screen
   (gate G1 in tools/seminar-decks/gates.mjs).

   Each entry: { value, display, source, chapter, note }
     value    the raw value (number or string) as read from the source
     display  exactly what is shown, with the dissertation's rounding
     source   the project file (+ key, column or line) that holds the value
     chapter  where the dissertation states it (file:line or label)
     note     rounding, sign flips, cautions

   Roots: "Mamba_PSMA/" is C:/Users/james/Documents/university/cits4010/Mamba_PSMA;
   "chapters/" and "figures/" are in the dissertation repo; "motion README" is
   documents/presentation/motion-graphics/README.md in the dissertation repo.
   The human-readable copy, with the check made for each entry, is
   documents/presentation/seminar-decks/facts.md in the dissertation repo.
   Verified 2026-10-12 against the files named below.
   ========================================================================== */

const T5 = 'Mamba_PSMA/evaluation/results/run5-test/test_summary.json';
const BOOT = 'Mamba_PSMA/evaluation/results/run5-test/bootstrap/results.csv';
const CMP = 'Mamba_PSMA/evaluation/results/run4-vs-baseline-deeppsma/scored/comparison.json';
const R6C = 'Mamba_PSMA/evaluation/results/run6-analysis/comparisons.csv';
const R6D = 'Mamba_PSMA/evaluation/results/run6-analysis/results_deeppsma.csv';
const R6A = 'Mamba_PSMA/evaluation/results/run6-analysis/results_autopet-test.csv';
const TIME = 'Mamba_PSMA/benchmarks/inference-timing/reports/2026-09-23-clusteradmin-System-Product-Name.md, "All configurations"';
const HOME = 'Mamba_PSMA/benchmarks/inference-timing/reports/2026-09-21-WiggyPC.md';
const CV = 'Mamba_PSMA/evaluation/results/run5-cv/cv_summary.json';
const CFG = 'Mamba_PSMA/configs/baseline.yaml';
const K22 = 'documents/research-papers/automatic-prognostic-biomarker-extraction-from-metastatic-prostate-lesion-segmentations.pdf';
const README = 'motion README (documents/presentation/motion-graphics/README.md)';
const PERCASE = 'Mamba_PSMA/evaluation/results/run5-test/ensemble/ensemble5_test_threshold_sweep_per_case.csv (threshold 0.5, min_voxels 10)';

const f = (value, display, source, chapter, note = '') => ({ value, display, source, chapter, note });

export const FACTS = {
  /* ── Motivation (literature) ─────────────────────────────────────────── */
  'lit.recurrence': f(30, '30%', `${K22}, Introduction, p. 68 ("around 30% of patients")`, 'chapters/01-introduction.tex:26-29', 'about 30% of patients treated with curative intent'),
  'lit.survival': f(35, '35%', `${K22}, Introduction, p. 68 ("35% or less")`, 'chapters/01-introduction.tex:28-29', 'five-year survival with metastatic disease, 35% or less'),
  'lit.obs_scans': f(28, '28', `${K22}, "Ground truth definition", p. 69`, 'chapters/01-introduction.tex:41'),
  'lit.obs_dsc': f(33.1, '33.1%', `${K22}, Table 3, p. 75 (DSC mean 33.1 +- 18.2)`, 'chapters/01-introduction.tex:43', 'mean voxel Dice between two observers'),
  'lit.obs_dsc_round': f(33.1, '33%', `${K22}, Table 3, p. 75`, 'chapters/01-introduction.tex:43 (33.1%)', 'rounded for speech and titles'),
  'lit.obs_dsc_sd': f(18.2, '18.2', `${K22}, Table 3, p. 75`, 'chapters/01-introduction.tex:43'),
  'lit.obs_found': f(71.7, '71.7%', `${K22}, Table 3, p. 75 (66/92)`, 'chapters/01-introduction.tex:44', 'the second observer found 71.7% of the first observer\'s lesions'),
  'lit.obs_found_speech': f(7, '7 out of 10', `${K22}, Table 3, p. 75 (66/92 = 71.7%)`, 'chapters/01-introduction.tex:44 (71.7%)', 'rounded for speech (plain deck, slide 3)'),
  'lit.umamba_year': f(2024, '2024', 'references.bib, isensee2024 (MICCAI 2024), p. 495', 'chapters/05-discussion.tex:274-276', 'year of the nnU-Net Revisited retest of U-Mamba (plain deck, slide 13)'),
  'dice.identical': f(100, '100%', 'definition of the Dice similarity coefficient (identical masks score 1)', 'chapters/02-background.tex (metrics)', 'what 100% Dice means'),

  'lit.segmamba_tokens': f(262144, '262,144', 'documents/research-papers/new-papers/segmamba.pdf, Table 5, p. 585', 'chapters/02-background.tex:229', 'tokens at a 128-cubed input\'s first feature scale, where self-attention ran out of memory'),
  'gpu.dev_mem': f(16, '16 GB', 'documents/mamba-psma-notes/design-decisions.md, 2026-08-09 item 4', 'chapters/03-methodology.tex:190', 'the development GPU (RTX 5070 Ti)'),

  /* ── The 2022 nnU-Net cascade (Kendrick et al.): CONTEXT ONLY ─────────── */
  'k22.f1': f(79.9, '79.9%', `${K22}, Table 2, p. 73`, 'chapters/02-background.tex:171; chapters/03-methodology.tex:670', 'context only: its own 128-scan recurrent-disease test set, 10% coverage rule'),
  'k22.ppv': f(88.2, '88.2%', `${K22}, Table 2, p. 73 (224/254)`, 'chapters/02-background.tex:171'),
  'k22.sens': f(73.0, '73.0%', `${K22}, Table 2, p. 73 (224/307)`, 'chapters/02-background.tex:172'),
  'k22.test': f(128, '128', `${K22}, Table 2, p. 73`, 'chapters/02-background.tex:172'),
  'k22.train': f(209, '209', `${K22}, pp. 69-70`, 'chapters/02-background.tex:167'),
  'k22.cover': f(10, '10%', `${K22}, "Evaluation", p. 72`, 'chapters/02-background.tex:170', 'lesion counted as detected at 10% volume coverage'),

  /* ── PSMASegmentator v1.1.0 ──────────────────────────────────────────── */
  'psm.params': f(102.4, '102.4M', `${TIME} (params column)`, 'chapters/03-methodology.tex:264-266', 'about 102.4 million unique parameters'),
  'psm.train': f(1035, '1,035', 'Mamba_PSMA/documentation/progress-tracking/deeppsma-only-baseline-comparison-plan.md, section 2 (PSMASegmentator README)', 'chapters/03-methodology.tex:676-678'),
  'psm.train_autopet': f(597, '597', 'deeppsma-only-baseline-comparison-plan.md, section 2', 'chapters/03-methodology.tex:678'),
  'psm.train_wa': f(438, '438', 'deeppsma-only-baseline-comparison-plan.md, section 2', 'chapters/03-methodology.tex:678', 'Western Australian patients'),
  'psm.folds': f(5, 'five', `${TIME}`, 'chapters/03-methodology.tex:690', 'five-fold average'),
  'psm.tta': f(8, 'eight', 'chapters/03-methodology.tex:457-458', 'chapters/03-methodology.tex:458; tab:method-departures', 'eight mirrored passes'),
  'psm.passes': f(40, '40', `${TIME} (tile passes / position)`, 'chapters/04-results.tex:672-673'),
  'psm.patch': f('288 x 128 x 128', '288 x 128 x 128', 'chapters/03-methodology.tex:193', 'chapters/03-methodology.tex:193; tab:method-departures'),
  'psm.patch_vox': f(4.72, '4.72M', 'chapters/03-methodology.tex:193-194', 'chapters/03-methodology.tex:194', '4.72 million voxels'),
  'psm.patch_z_mm': f(576, '576 mm', 'documents/mamba-psma-notes/findings-summary.md, section 3.5 (576 x 521 x 521 mm)', 'chapters/03-methodology.tex:194', 'head to toe'),
  'psm.patch_x_mm': f(521, '521 mm', 'findings-summary.md, section 3.5 (128 x 4.07 mm)', 'chapters/05-discussion.tex:224 (SOURCE comment)', 'left to right; 128 voxels x 4.07 mm'),

  /* ── Data ─────────────────────────────────────────────────────────────── */
  'data.total': f(697, '697', 'chapters/03-methodology.tex tab:method-datasets (597 + 100); published abstract', 'tab:method-datasets', '597 autoPET-III + 100 DEEP-PSMA'),
  'data.autopet': f(597, '597', 'chapters/03-methodology.tex:56-57 (jeblick2026, pp. 2-4)', 'chapters/03-methodology.tex:56; tab:method-datasets'),
  'data.autopet_patients': f(378, '378', 'jeblick2026, pp. 2-4', 'tab:method-datasets'),
  'data.autopet_pos': f(539, '539', 'jeblick2026, pp. 2-4', 'tab:method-datasets'),
  'data.autopet_neg': f(58, '58', 'jeblick2026, pp. 2-4', 'tab:method-datasets'),
  'data.f18': f(369, '369', 'jeblick2026, p. 2', 'tab:method-datasets'),
  'data.ga68': f(228, '228', 'jeblick2026, p. 2', 'tab:method-datasets'),
  'data.deeppsma': f(100, '100', 'jackson2025, p. 11 ("100 training")', 'chapters/03-methodology.tex:57-58; tab:method-datasets'),
  'data.test': f(130, '130', `${T5}, n_test_cases`, 'chapters/03-methodology.tex:148'),
  'data.test_autopet': f(110, '110', `${T5}, rows.thr0.5_min10.autoPET.ensemble.n_cases`, 'chapters/03-methodology.tex:149'),
  'data.test_deeppsma': f(20, '20', `${T5}, rows.thr0.5_min10.DeepPSMA.ensemble.n_cases`, 'chapters/03-methodology.tex:149'),
  'data.test_neg': f(8, '8', `${T5}, rows.thr0.5_min10.pooled.ensemble.n_cases_lesion_negative`, 'chapters/03-methodology.tex:546'),
  'data.test_pos': f(122, '122', `${T5}, voxel_dsc_n`, 'chapters/04-results.tex:100'),
  'data.pool': f(567, '567', `${CV}, pooled.n_cases`, 'chapters/03-methodology.tex:150'),
  'data.pool_autopet': f(487, '487', 'Mamba_PSMA/hpc-documentation/hpc-design-decisions.md, 2026-09-02', 'chapters/03-methodology.tex:151'),
  'data.pool_deeppsma': f(80, '80', `${CV}, by_cohort.deeppsma.n_cases`, 'chapters/03-methodology.tex:151'),
  'data.folds': f(5, 'five', 'Mamba_PSMA/hpc-documentation/hpc-design-decisions.md, 2026-09-02', 'chapters/03-methodology.tex:28-30'),
  'data.fold0': f(67, '67', `${CV}, per_fold`, 'tab:results-cv (chapters/04-results.tex:72)'),
  'data.fold_n': f(125, '125', `${CV}, per_fold`, 'tab:results-cv (chapters/04-results.tex:73-76)', 'folds 1 to 4'),
  // Each fold's validation mix: autoPET-III lesion-positive, lesion-negative, DEEP-PSMA. Checked
  // 2026-10-13 against Mamba_PSMA/splits/cv/fold<k>/val.json with n_gt from
  // evaluation/results/run5-fold<k>/checkpoint_best_val_threshold_sweep_per_case.csv. Drawn as
  // tiles on the plain deck's slide 9; never shown as digits.
  ...Object.fromEntries([[50, 7, 10], [96, 12, 17], [99, 9, 17], [95, 12, 18], [97, 10, 18]].flatMap(([pos, neg, dp], k) => [
    [`data.fold${k}_pos`, f(pos, String(pos), 'Mamba_PSMA/hpc-documentation/hpc-design-decisions.md, "Fold composition (seed 42)"', 'tab:app-fold-composition (appendices/b-configuration.tex:139-143)', `fold ${k}, autoPET-III lesion-positive`)],
    [`data.fold${k}_neg`, f(neg, String(neg), 'Mamba_PSMA/hpc-documentation/hpc-design-decisions.md, "Fold composition (seed 42)"', 'tab:app-fold-composition (appendices/b-configuration.tex:139-143)', `fold ${k}, autoPET-III lesion-negative`)],
    [`data.fold${k}_dp`, f(dp, String(dp), 'Mamba_PSMA/hpc-documentation/hpc-design-decisions.md, "Fold composition (seed 42)"', 'tab:app-fold-composition (appendices/b-configuration.tex:139-143)', `fold ${k}, DEEP-PSMA`)],
  ])),
  'data.dp_components': f(68, '68', 'Mamba_PSMA/evaluation/results/run4-vs-baseline-deeppsma/REPORT.md, section 4', 'chapters/03-methodology.tex:126', 'about 68 components per DEEP-PSMA scan'),
  'data.suv': f(3, '3', 'jackson2025, p. 11 (SUV >= 3)', 'tab:method-datasets', 'DEEP-PSMA labels: SUV >= 3 threshold'),

  /* ── Network ─────────────────────────────────────────────────────────── */
  'net.stages': f(5, 'five', `${CFG}, model.features`, 'chapters/03-methodology.tex:252'),
  'net.ch1': f(32, '32', `${CFG}, model.features`, 'chapters/03-methodology.tex:252'),
  'net.ch2': f(64, '64', `${CFG}, model.features`, 'chapters/03-methodology.tex:252'),
  'net.ch3': f(128, '128', `${CFG}, model.features`, 'chapters/03-methodology.tex:252'),
  'net.ch4': f(256, '256', `${CFG}, model.features`, 'chapters/03-methodology.tex:252'),
  'net.ch5': f(320, '320', `${CFG}, model.features`, 'chapters/03-methodology.tex:252'),
  'net.mb3': f(2, '2', `${CFG}, model.mamba_blocks [0,0,2,2,4]`, 'chapters/03-methodology.tex:258'),
  'net.mb4': f(2, '2', `${CFG}, model.mamba_blocks`, 'chapters/03-methodology.tex:258'),
  'net.mb5': f(4, '4', `${CFG}, model.mamba_blocks`, 'chapters/03-methodology.tex:258'),
  'net.mamba_stages': f(3, 'three', `${CFG}, model.mamba_blocks`, 'chapters/03-methodology.tex:233-234'),
  'net.params': f(39.7, '39.7M', `${TIME} (params column)`, 'chapters/03-methodology.tex:262'),
  'net.params_mamba': f(22.9, '22.9M', 'documents/mamba-psma-notes/findings-summary.md, section 3.5', 'chapters/03-methodology.tex:262'),
  'net.twin_params': f(16.8, '16.8M', 'Mamba_PSMA/evaluation/protocols/run6-protocol.md, "Models"', 'chapters/03-methodology.tex:271'),
  'net.twin_pct': f(42, '42%', 'run6-protocol.md, "Known limitations"', 'chapters/03-methodology.tex:272'),
  'net.dirs': f(6, 'six', `${CFG}, model.mamba.n_directions`, 'chapters/03-methodology.tex:283'),
  'net.tok3': f(27648, '27,648', `${CFG} (strides [1,2,2,2,2], patch [96,192,96]): 24 x 48 x 24`, 'chapters/03-methodology.tex:297'),
  'net.tok4': f(3456, '3,456', `${CFG}: 12 x 24 x 12`, 'chapters/03-methodology.tex:297'),
  'net.tok5': f(432, '432', `${CFG}: 6 x 12 x 6`, 'chapters/03-methodology.tex:297'),
  'net.tok1': f(1769472, '1,769,472', `${CFG}: 96 x 192 x 96`, 'chapters/03-methodology.tex:296', 'stage 1 voxels'),
  'net.tok2': f(221184, '221,184', `${CFG}: 48 x 96 x 48`, 'chapters/03-methodology.tex:296', 'stage 2 voxels; "would exceed 220,000 tokens"'),
  'net.state': f(16, '16', `${CFG}, model.mamba.d_state (null -> 16 for Mamba-1)`, 'chapters/03-methodology.tex:290'),
  'net.tok3_large': f(129024, '129,024', 'Mamba_PSMA/configs/experiments/run6b.yaml (224 x 192 x 192 / 4 per axis = 56 x 48 x 48)', 'chapters/05-discussion.tex:240'),

  /* ── Patches ─────────────────────────────────────────────────────────── */
  'patch.small': f('96 x 192 x 96', '96 x 192 x 96', `${CFG}, patch_sampling.patch_size`, 'chapters/03-methodology.tex:186'),
  'patch.small_vox': f(1.77, '1.77M', `${CFG}: 96 x 192 x 96 = 1,769,472`, 'chapters/03-methodology.tex:188'),
  'patch.small_mm': f('288 x 391 x 196', '288 x 391 x 196 mm', `${CFG}: patch x target_spacing`, 'chapters/03-methodology.tex:188-189', 'z (head-toe) x y (front-back) x x (left-right)'),
  'patch.small_z_mm': f(288, '288 mm', `${CFG}: 96 x 3.0 mm`, 'chapters/03-methodology.tex:188'),
  'patch.small_x_mm': f(195.5, '196 mm', `${CFG}: 96 x 2.0364 mm`, 'chapters/03-methodology.tex:189'),
  'patch.small_y_mm': f(391, '391 mm', `${CFG}: 192 x 2.0364 mm`, 'chapters/03-methodology.tex:189'),
  'patch.large': f('224 x 192 x 192', '224 x 192 x 192', 'Mamba_PSMA/configs/experiments/run6b.yaml, patch_size', 'chapters/03-methodology.tex:582'),
  'patch.large_vox': f(8.26, '8.26M', 'run6b.yaml header comment (8.26M voxels)', 'chapters/03-methodology.tex:599'),
  'patch.large_mm': f('672 x 391 x 391', '672 x 391 x 391 mm', 'run6b.yaml x target_spacing', 'chapters/03-methodology.tex:600'),
  'patch.large_z_mm': f(672, '672 mm', 'run6b.yaml: 224 x 3.0 mm', 'chapters/03-methodology.tex:600'),
  'patch.large_x_mm': f(391, '391 mm', 'run6b.yaml: 192 x 2.0364 mm', 'chapters/03-methodology.tex:600'),
  'patch.ratio': f(4.7, '4.7', '8.26 / 1.77', 'chapters/03-methodology.tex:599', '"4.7 times the small one"'),
  'patch.win_cm_w': f(20, '20 cm', `${README}, A2a cue`, 'chapters/03-methodology.tex:188-189 (196 mm)', 'window width, left-right'),
  'patch.win_cm_h': f(29, '29 cm', `${README}, A2a cue`, 'chapters/03-methodology.tex:188 (288 mm)', 'window height, head-toe'),
  'patch.win_cm_d': f(39, '39 cm', `${README}, A2a cue`, 'chapters/03-methodology.tex:189 (391 mm)', 'window depth, front-back'),
  'spacing.mm': f('2.0364 x 2.0364 x 3.0', '2 mm', `${CFG}, target_spacing`, 'chapters/03-methodology.tex:172', 'working grid, about 2 mm in-plane'),
  'spacing.psm': f(4.07, '4 mm', 'chapters/03-methodology.tex:175', 'chapters/03-methodology.tex:175', 'PSMASegmentator works at 4.07 x 4.07 x 2.0 mm'),

  /* ── N1 scale on the case A beat 1 hold (case-a-1-scan.png) ──────────── */
  'n1.mm_per_px': f(1.0182, '1.0182', 'wigfield-portfolio/motion-data/psma_7e25beff54698eb8_2021-06-21/manifest.json, layer.pixel_mm (scale 1 at beat 1: StageView.jsx layoutFor, BODY_MAX_H 940 > layer height 843)', 'n/a (display geometry)', 'stage px per mm; windows.json col/row extents (192 x 282.85 px) agree with 196 x 288 mm'),
  'n1.origin_x': f(660, '660', 'StageView.jsx layoutFor: round(960 - 600/2)', 'n/a'),
  'n1.origin_y': f(119, '119', 'StageView.jsx layoutFor: round((1080 - 843)/2)', 'n/a'),
  'n1.layer_w': f(600, '600', 'manifest.json layer.width', 'n/a'),
  'n1.layer_h': f(843, '843', 'manifest.json layer.height', 'n/a'),

  /* ── Organ head ──────────────────────────────────────────────────────── */
  'organ.classes': f(25, '25', `${CFG}, organ_supervision`, 'chapters/03-methodology.tex:310'),
  'organ.structures': f(24, '24', `${CFG}, organ_supervision class list`, 'chapters/03-methodology.tex:310', 'chapter says "24 organs and bones"; the list also has glands and a muscle, so slides say "anatomical structures"'),
  'organ.neg': f(7, 'seven', 'Mamba_PSMA/evaluation/results/run3/checkpoint_best_val_summary.json', 'chapters/04-results.tex:470-471; chapters/05-discussion.tex:186', 'lesion-negative validation cases'),
  'organ.fc3': f(21, '21', 'Mamba_PSMA/evaluation/results/run3/checkpoint_best_val_threshold_sweep.csv, row 0.5/10, false_lesions_on_negative_cases', 'chapters/05-discussion.tex:191'),
  'organ.fc4': f(7, '7', 'Mamba_PSMA/evaluation/results/run4/checkpoint_best_val_threshold_sweep.csv, row 0.5/10', 'chapters/05-discussion.tex:191'),
  'organ.ppv_gain': f(5, '5', 'run3 and run4 sweeps, row 0.5/10, lesion_ppv 70.35 and 75.44 (retired matcher)', 'chapters/05-discussion.tex:190', '"about 5 points"'),

  /* ── Inference and operating point ──────────────────────────────────── */
  'inf.overlap': f(0.5, 'half', `${CFG}, val_overlap`, 'chapters/03-methodology.tex:450', 'windows overlap by half'),
  'inf.thr': f(0.5, '0.5', 'Mamba_PSMA/hpc-documentation/run5-cv-results-and-test-protocol.md, section 5', 'chapters/03-methodology.tex:462'),
  'inf.minvox': f(10, '10', 'run5-cv-results-and-test-protocol.md, section 5', 'chapters/03-methodology.tex:464-465'),
  'inf.min_ml': f(0.124, '0.124 mL', 'run5-cv-results-and-test-protocol.md, section 4.2', 'chapters/03-methodology.tex:465'),
  'inf.models': f(5, 'five', `${T5}, per_model (fold0-fold4)`, 'chapters/03-methodology.tex:464'),
  'inf.passes': f(5, '5', `${TIME} (tile passes / position)`, 'chapters/04-results.tex:672'),

  /* ── Training ────────────────────────────────────────────────────────── */
  'train.fold_h': f(33, '33', 'Mamba_PSMA/hpc-documentation/run5-cv-results-and-test-protocol.md, section 1', 'chapters/03-methodology.tex:397'),
  'train.epochs': f(1000, '1,000', `${CFG}, training`, 'chapters/03-methodology.tex:363'),
  'train.run4_cases': f(430, '430', 'Mamba_PSMA/splits/archive/autopet-only_runs1-4/train.json (430 entries)', 'chapters/03-methodology.tex:145; tab:method-departures'),
  'train.val57': f(57, '57', 'splits/archive/autopet-only_runs1-4/val.json (57 entries)', 'chapters/04-results.tex:441'),

  /* ── Final model: run 5 on the sealed 130 ───────────────────────────── */
  'r5.f1': f(0.8427432932989112, '84.3%', `${T5}, rows.thr0.5_min10.pooled.ensemble.lesion_f1`, 'chapters/04-results.tex:96-97'),
  'ci.level': f(95, '95%', 'Mamba_PSMA/evaluation/results/run5-test/bootstrap/results.md (95% percentile intervals, 10,000 resamples)', 'chapters/03-methodology.tex:642-643', 'interval level for every bootstrap interval'),
  'r5.f1_lo': f(81.359, '81.4', `${BOOT}, min_voxels 10, pooled, f1_ci_lo`, 'chapters/04-results.tex:97'),
  'r5.f1_hi': f(86.476, '86.5', `${BOOT}, min_voxels 10, pooled, f1_ci_hi`, 'chapters/04-results.tex:97'),
  'r5.ppv': f(0.8619977037887485, '86.2%', `${T5}, rows.thr0.5_min10.pooled.ensemble.lesion_ppv`, 'chapters/04-results.tex:97'),
  'r5.sens': f(0.8243302591128678, '82.4%', `${T5}, ...pooled.ensemble.lesion_sensitivity`, 'chapters/04-results.tex:98'),
  'r5.dsc': f(0.5959640564105627, '59.6%', `${T5}, ...pooled.ensemble.voxel_dsc_mean`, 'chapters/04-results.tex:100'),
  'r5.patacc': f(0.8923076923076924, '89.2%', `${T5}, ...pooled.ensemble.patient_accuracy`, 'chapters/04-results.tex:101'),
  'r5.tp': f(3754, '3,754', `${T5}, ...pooled.ensemble.lesion_tp`, 'chapters/04-results.tex:98'),
  'r5.fp': f(601, '601', `${T5}, ...pooled.ensemble.lesion_fp`, 'chapters/04-results.tex:99'),
  'r5.fn': f(800, '800', `${T5}, ...pooled.ensemble.lesion_fn`, 'chapters/04-results.tex:99'),
  'r5.lesions': f(4554, '4,554', `${T5}: lesion_tp + lesion_fn = 3,754 + 800`, `${README}, "Suggestions" (C5 context line)`, 'ground-truth lesions in the 130 test scans'),
  'r5.found_round': f(82, '82%', `${T5}, lesion_sensitivity 0.824`, 'published abstract ("82% of lesions")'),
  'r5.prec_round': f(86, '86%', `${T5}, lesion_ppv 0.862`, 'published abstract ("86% precision")'),
  'r5.ap_f1': f(0.8425720620842572, '84.3%', `${T5}, rows.thr0.5_min10.autoPET.ensemble.lesion_f1`, 'chapters/04-results.tex:110; tab:results-test'),
  'r5.ap_ppv': f(0.8271144278606966, '82.7%', `${T5}, ...autoPET.ensemble.lesion_ppv`, 'tab:results-test'),
  'r5.ap_sens': f(0.8586184635248547, '85.9%', `${T5}, ...autoPET.ensemble.lesion_sensitivity`, 'tab:results-test'),
  'r5.ap_dsc': f(0.5459226380607749, '54.6%', `${T5}, ...autoPET.ensemble.voxel_dsc_mean`, 'tab:results-test'),
  'r5.dp_f1': f(0.843159922928709, '84.3%', `${T5}, ...DeepPSMA.ensemble.lesion_f1`, 'chapters/04-results.tex:110; tab:results-test'),
  'r5.dp_ppv': f(0.9604916593503073, '96.0%', `${T5}, ...DeepPSMA.ensemble.lesion_ppv`, 'tab:results-test'),
  'r5.dp_sens': f(0.7513736263736264, '75.1%', `${T5}, ...DeepPSMA.ensemble.lesion_sensitivity`, 'tab:results-test'),
  'r5.dp_dsc': f(0.8511752899944801, '85.1%', `${T5}, ...DeepPSMA.ensemble.voxel_dsc_mean`, 'tab:results-test'),
  'r5.single_f1': f(0.8307834330277839, '83.1', `${T5}, rows.thr0.5_min10.pooled.spread.lesion_f1.mean`, 'tab:results-test (chapters/04-results.tex:151)'),
  'r5.single_sd': f(0.006216539087982617, '0.6', `${T5}, ...spread.lesion_f1.std`, 'chapters/04-results.tex:108'),
  'r5.ens_f1_gain': f(1.2, '1.2', `${T5}: 84.27 - 83.08`, 'chapters/04-results.tex:107'),
  'r5.ens_ppv_gain': f(2.3, '2.3', `${T5}: 86.20 - 83.87`, 'chapters/04-results.tex:107'),
  'r5.percase_mean': f(0.7675658178821974, '76.8%', `${T5}, ...pooled.ensemble.lesion_f1_per_case_mean; ${PERCASE} (113 defined)`, `${README}, "Speaker notes"`, 'mean of per-scan F1 over the 113 scans where F1 is defined'),
  'r5.percase_n': f(113, '113', PERCASE, `${README}, "Speaker notes"`),
  'r5.percase_median': f(84.21, '84.2%', PERCASE, `${README}, "Speaker notes"`),
  'r5.neg_flag': f(5, '5', `${T5}, ...pooled.ensemble.negative_cases_false_alarm`, 'chapters/04-results.tex:120'),
  'r5.nf_f1': f(83.765, '83.8%', `${BOOT}, min_voxels 0, pooled`, 'chapters/04-results.tex:118'),
  'r5.nf_ppv': f(82.011, '82.0%', `${BOOT}, min_voxels 0, pooled`, 'chapters/04-results.tex:117'),
  'r5.nf_sens': f(85.595, '85.6%', `${BOOT}, min_voxels 0, pooled`, 'chapters/04-results.tex:117'),
  'r5.zero_found': f(9, 'nine', PERCASE, `${README}, "Speaker notes"`, 'lesion-positive scans with no lesion found (F1 undefined)'),

  /* ── Cross-validation ───────────────────────────────────────────────── */
  'cv.f1': f(0.818207533826788, '81.8%', `${CV}, pooled.lesion_f1`, 'chapters/04-results.tex:31'),
  'cv.ppv': f(0.8057103064066853, '80.6%', `${CV}, pooled.lesion_ppv`, 'chapters/04-results.tex:31'),
  'cv.sens': f(0.8310985537783737, '83.1%', `${CV}, pooled.lesion_sensitivity`, 'chapters/04-results.tex:32'),
  'cv.sd': f(0.015453684159906838, '1.5', `${CV}, spread.lesion_f1.std`, 'chapters/04-results.tex:37'),

  /* ── Fair comparison: run 4 against PSMASegmentator, 100 DEEP-PSMA ──── */
  'fair.n': f(100, '100', `${CMP}, n_cases`, 'chapters/04-results.tex:198'),
  'fair.r4_f1': f(0.8139251805566827, '81.4%', `${CMP}, headline.run4_min10.f1`, 'chapters/04-results.tex:204'),
  'fair.psm_f1': f(0.7836390766259985, '78.4%', `${CMP}, headline.baseline_min10.f1`, 'chapters/04-results.tex:204'),
  'fair.r4_sens': f(0.7364170337738619, '73.6%', `${CMP}, headline.run4_min10.sens`, 'tab:results-baseline'),
  'fair.psm_sens': f(0.6555066079295154, '65.6%', `${CMP}, headline.baseline_min10.sens`, 'tab:results-baseline'),
  'fair.r4_ppv': f(0.9096680573190641, '91.0%', `${CMP}, headline.run4_min10.ppv`, 'tab:results-baseline'),
  'fair.psm_ppv': f(0.9740344752345625, '97.4%', `${CMP}, headline.baseline_min10.ppv`, 'tab:results-baseline'),
  'fair.r4_dsc': f(0.622651068154563, '62.3%', `${CMP}, headline.run4_min10.dsc`, 'tab:results-baseline'),
  'fair.psm_dsc': f(0.5586548179347559, '55.9%', `${CMP}, headline.baseline_min10.dsc`, 'tab:results-baseline'),
  'fair.df1': f(3.0286, '+3.0', `${CMP}, paired_vs_run4.min10.pooled_diff.f1.point = -0.0303 (file prints PSMASegmentator minus run 4; sign flipped)`, 'chapters/04-results.tex:208', 'run 4 minus PSMASegmentator, F1 points'),
  'fair.df1_lo': f(1.2368, '1.2', `${CMP}, ...pooled_diff.f1.ci95[1] = -0.01237 (flipped)`, 'chapters/04-results.tex:208'),
  'fair.df1_hi': f(4.7204, '4.7', `${CMP}, ...pooled_diff.f1.ci95[0] = -0.04720 (flipped)`, 'chapters/04-results.tex:208'),
  'fair.dsens': f(8.091, '+8.1', `${CMP}, ...pooled_diff.sens.point = -0.0809 (flipped)`, 'chapters/04-results.tex:208'),
  'fair.dppv': f(-6.4366, '-6.4', `${CMP}, ...pooled_diff.ppv.point = +0.0644 (flipped)`, 'chapters/04-results.tex:209'),
  'fair.ddsc': f(6.3996, '+6.4', `${CMP}, ...pooled_diff.dsc.point = -0.0640 (flipped)`, 'chapters/04-results.tex:209'),
  'fair.df1_abs': f(3.0286, '3.0', 'as fair.df1', 'chapters/06-conclusion.tex:25-26 ("3.0 points higher")', 'magnitude for prose'),
  'fair.dsens_abs': f(8.091, '8.1', 'as fair.dsens', 'chapters/04-results.tex:208', 'magnitude for prose'),
  'fair.dppv_abs': f(6.4366, '6.4', 'as fair.dppv', 'chapters/04-results.tex:209', 'magnitude for prose'),
  'fair.ddsc_abs': f(6.3996, '6.4', 'as fair.ddsc', 'chapters/04-results.tex:209', 'magnitude for prose'),
  'fair.pc_df1': f(-0.586, '-0.6', `${CMP}, paired_vs_run4.min10.percase_diff.f1.mean = +0.00586 (flipped)`, 'chapters/04-results.tex:216'),
  'fair.pc_lo': f(-2.81, '-2.8', `${CMP}, ...percase_diff.f1.ci95 (flipped)`, 'tab:results-baseline-differences'),
  'fair.pc_hi': f(1.61, '1.6', `${CMP}, ...percase_diff.f1.ci95 (flipped)`, 'tab:results-baseline-differences'),
  'fair.better': f(48, '48', 'exact fractions of per-case TP/FP/FN (public/seminar-decks/data/fair-per-case.json, checks; Mamba_PSMA/scripts/thesis_figures/plot_baseline_per_case.py)', 'chapters/04-results.tex:217', 'NOT comparison.json\'s 49/50/1'),
  'fair.worse': f(50, '50', 'as fair.better', 'chapters/04-results.tex:217'),
  'fair.tied': f(2, '2', 'as fair.better', 'chapters/04-results.tex:217'),
  'fair.lt20_n': f(22, '22', 'fair-per-case.json checks (plot_baseline_per_case.py)', 'chapters/04-results.tex:220'),
  'fair.lt20_lower': f(18, '18', 'fair-per-case.json checks', 'chapters/04-results.tex:220'),
  'fair.ge100_n': f(28, '28', 'fair-per-case.json checks', 'chapters/04-results.tex:221'),
  'fair.ge100_higher': f(23, '23', 'fair-per-case.json checks', 'chapters/04-results.tex:221'),
  'fair.lt20_cut': f(20, '20', 'fair-per-case.json checks (n_gt < 20)', 'chapters/04-results.tex:220', 'fewer than 20 lesions'),
  'fair.ge100_cut': f(100, '100', 'fair-per-case.json checks (n_gt >= 100)', 'chapters/04-results.tex:221', '100 or more lesions'),
  'fair.nf_df1': f(2.4, '+2.4', `${CMP}, paired_vs_run4.min0.pooled_diff.f1 (flipped)`, 'tab:results-baseline-differences'),
  'fair.s20_df1': f(8.0, '+8.0', `${CMP}, secondary.sealed20 (flipped)`, 'chapters/04-results.tex:228-229', 'run 5 ensemble minus PSMASegmentator on the 20 sealed DEEP-PSMA cases, in-domain for run 5'),

  /* ── Run 6 context ablation (DEEP-PSMA primary, 10-voxel filter) ────── */
  'r6.h_small': f(81.393, '81.4', `${R6D}, min_voxels 10, run4, f1`, 'tab:results-context'),
  'r6.h_large': f(76.845, '76.8', `${R6D}, min_voxels 10, mamba-big, f1`, 'tab:results-context'),
  'r6.c_small': f(81.974, '82.0', `${R6D}, min_voxels 10, cnn-small, f1`, 'tab:results-context'),
  'r6.c_large': f(80.999, '81.0', `${R6D}, min_voxels 10, cnn-big, f1`, 'tab:results-context'),
  'r6.h_patch': f(-4.548, '-4.55', `${R6C}, deeppsma, 10, "4a. Patch effect, Mamba"`, 'chapters/05-discussion.tex:225'),
  'r6.c_patch': f(-0.975, '-0.97', `${R6C}, deeppsma, 10, "4b. Patch effect, CNN"`, 'chapters/05-discussion.tex:226', 'csv -0.975; chapter prints 0.97'),
  'r6.h_patch_abs': f(4.548, '4.55', 'as r6.h_patch', 'chapters/05-discussion.tex:225 ("by 4.55 points")', 'magnitude for prose'),
  'r6.c_patch_abs': f(0.975, '0.97', 'as r6.c_patch', 'chapters/05-discussion.tex:226 ("lost 0.97")', 'magnitude for prose'),
  'r6.inter_abs': f(3.573, '3.57', 'as r6.inter', 'chapters/01-introduction.tex:176 ("cost the hybrid 3.57 F1 points more")', 'magnitude for prose'),
  'r6.inter': f(-3.573, '-3.57', `${R6C}, deeppsma, 10, "3. Interaction"`, 'chapters/04-results.tex:351'),
  'r6.inter_lo': f(-4.716, '-4.72', `${R6C}, deeppsma, 10, ci_lo`, 'chapters/04-results.tex:351'),
  'r6.inter_hi': f(-2.482, '-2.48', `${R6C}, deeppsma, 10, ci_hi`, 'chapters/04-results.tex:352'),
  'r6.ap_inter': f(-1.619, '-1.62', `${R6C}, autopet-test, 10, "3. Interaction"`, 'chapters/04-results.tex:364'),
  'r6.ap_inter_lo': f(-4.486, '-4.49', `${R6C}, autopet-test, 10, ci_lo`, 'chapters/04-results.tex:364'),
  'r6.ap_inter_hi': f(0.564, '0.56', `${R6C}, autopet-test, 10, ci_hi`, 'chapters/04-results.tex:365'),
  'r6.gap_small_dp': f(-0.581, '-0.58', `${R6C}, deeppsma, 10, "2. Mamba vs CNN, small patch"`, 'chapters/05-discussion.tex:259', 'no clear effect'),
  'r6.gap_small_ap': f(1.795, '+1.79', `${R6C}, autopet-test, 10, "2. Mamba vs CNN, small patch"`, 'chapters/04-results.tex:366', 'real under the rule'),
  'r6.gap_large_dp': f(-4.154, '-4.15', `${R6C}, deeppsma, 10, "1. Mamba vs CNN, big patch"`, 'tab:app-supp-context-effects', 'real'),
  'r6.rule': f(1.0, '1.0', 'Mamba_PSMA/evaluation/protocols/run6-protocol.md, "Decision rule"', 'chapters/03-methodology.tex:650-653', 'real = interval excludes zero and |effect| >= 1.0 F1 point'),
  'r6.epoch': f(275, '275', 'Mamba_PSMA/evaluation/results/run6-mamba-big/run6/run-card.json, training.epochs', 'chapters/04-results.tex:375'),
  'r6.batch_large': f(1, '1', 'run6b.yaml, dataloader.batch_size', 'chapters/03-methodology.tex:582'),
  'r6.batch_small': f(2, '2', `${CFG}, dataloader.batch_size`, 'chapters/03-methodology.tex:581'),
  'r6.hl_sens': f(64.376, '64.4%', `${R6D}, min_voxels 10, mamba-big, sens`, 'chapters/04-results.tex:359'),
  'r6.hl_ppv': f(95.304, '95.3%', `${R6D}, min_voxels 10, mamba-big, ppv`, 'chapters/04-results.tex:360'),
  'r6.ap_h_small': f(84.4, '84.4', `${R6A}, min_voxels 10, run4`, 'tab:results-context'),
  'r6.ap_h_large': f(81.2, '81.2', `${R6A}, min_voxels 10, mamba-big`, 'tab:results-context'),
  'r6.ap_c_small': f(82.6, '82.6', `${R6A}, min_voxels 10, cnn-small`, 'tab:results-context'),
  'r6.ap_c_large': f(81.0, '81.0', `${R6A}, min_voxels 10, cnn-big`, 'tab:results-context'),
  'r6.seed_spread': f(0.6, '0.6', `${T5}, ...spread.lesion_f1.std 0.0062`, 'chapters/05-discussion.tex:272', 'spread between run 5\'s fold models'),

  /* ── Efficiency (DEMETER, RTX 4090, 20 sealed DEEP-PSMA cases) ──────── */
  'eff.gpu': f('RTX 4090', 'RTX 4090', TIME, 'chapters/04-results.tex:654'),
  'eff.n': f(20, '20', TIME, 'chapters/04-results.tex:655'),
  'eff.h5': f(18.1, '18.1 s', `${TIME}, "PSMAMamba, TTA off"`, 'chapters/04-results.tex:660'),
  'eff.p40': f(43.8, '43.8 s', `${TIME}, "baseline, TTA on"`, 'chapters/04-results.tex:661'),
  'eff.p5': f(17.2, '17.2 s', `${TIME}, "baseline, TTA off"`, 'chapters/04-results.tex:674'),
  'eff.h40': f(131.2, '131.2 s', `${TIME}, "PSMAMamba, TTA on"`, 'chapters/04-results.tex:675'),
  'eff.h5_med': f(11.6, '11.6 s', `${TIME}, median column`, 'tab:results-efficiency'),
  'eff.p5_med': f(17.0, '17.0 s', `${TIME}, median column`, 'tab:results-efficiency'),
  'eff.vram_h': f(5.2, '5.2 GiB', `${TIME}, peak VRAM`, 'chapters/04-results.tex:689'),
  'eff.vram_p': f(4.5, '4.5 GiB', `${TIME}, peak VRAM`, 'chapters/04-results.tex:690'),
  'eff.passes_h': f(5, '5', `${TIME}, tile passes / position`, 'chapters/04-results.tex:672'),
  'eff.passes_p': f(40, '40', `${TIME}, tile passes / position`, 'chapters/04-results.tex:673'),
  'abs.home_h': f(32.3, '32', `${HOME}, line 7 (32.3 s, rounded on line 9)`, 'published abstract (not in the dissertation)', 'home RTX 5070 Ti, published configurations'),
  'abs.home_p': f(62.6, '63', `${HOME}, line 7 (62.6 s)`, 'published abstract (not in the dissertation)'),
  'abs.home_gpu': f('RTX 5070 Ti', 'RTX 5070 Ti', `${HOME}, line 13`, 'chapters/03-methodology.tex:754 (development PC)'),
  'abs.home_eq_h': f(32, '32', `${HOME}, line 103 (5 passes each: baseline 33 s against 32 s)`, 'not in the dissertation'),
  'abs.home_eq_p': f(33, '33', `${HOME}, line 103`, 'not in the dissertation'),

  /* ── Loss (H2) ───────────────────────────────────────────────────────── */
  'loss.alpha': f(0.3, '0.3', `${CFG}, training.loss (runs 1-2)`, 'chapters/01-introduction.tex:113'),
  'loss.beta': f(0.7, '0.7', `${CFG}, training.loss (runs 1-2)`, 'chapters/01-introduction.tex:114'),
  'run2.sens': f(71.2, '71%', 'documents/mamba-psma-notes/design-decisions.md, 2026-08-03 "first lesion-level evaluation"', 'chapters/04-results.tex:463', '71.2% unfiltered, retired one-to-one matcher, 57 validation cases'),
  'run2.ppv': f(60.6, '61%', 'design-decisions.md, 2026-08-03', 'chapters/04-results.tex:462', '60.6% unfiltered'),
  'run2.sens_full': f(71.2, '71.2%', 'design-decisions.md, 2026-08-03', 'chapters/04-results.tex:463'),
  'run2.ppv_full': f(60.6, '60.6%', 'design-decisions.md, 2026-08-03', 'chapters/04-results.tex:462'),

  /* ── Development runs (backup only) ─────────────────────────────────── */
  'dev.run1_peak': f(4165, '4,165', 'plot_run1_run2_training.py (peak 4,165.16 at iteration 28,250)', 'chapters/04-results.tex:449'),
  'dev.run1_hours': f(3, 'three', 'design-decisions.md, C-3', 'chapters/04-results.tex:453', 'about three of its twelve hours'),
  'dev.run1_total': f(12, 'twelve', 'design-decisions.md, 2026-08-02', 'chapters/04-results.tex:453'),
  'dev.clip': f(12.0, '12.0', `${CFG}, training.clip_grad_norm`, 'chapters/04-results.tex:458'),
  'dev.run2_f1': f(70.2, '70.2', 'design-decisions.md, 2026-08-03', 'tab:results-runs'),
  'dev.run3_f1': f(71.3, '71.3', 'Mamba_PSMA/evaluation/results/run3/checkpoint_best_val_threshold_sweep.csv, row 0.5/10', 'tab:results-runs'),
  'dev.run4_f1_old': f(73.7, '73.7', 'Mamba_PSMA/evaluation/results/run4/checkpoint_best_val_threshold_sweep.csv, row 0.5/10', 'tab:results-runs', 'BACKUP ONLY (trap 11): retired one-to-one matcher'),
  'dev.run4_f1_new': f(85.5, '85.5', 'Mamba_PSMA/evaluation/results/run4-refrule/checkpoint_best_val_threshold_sweep.csv, row 0.5/10', 'tab:results-runs', 'BACKUP ONLY (trap 11): any-overlap rule, same predictions'),
  'dev.merged': f(202, '202', 'Mamba_PSMA/evaluation/results/run4/merging/README.md, "Stage 1"', 'chapters/03-methodology.tex:500'),
  'dev.missed': f(498, '498', 'run4/merging/README.md, "Stage 1"', 'chapters/03-methodology.tex:500'),
  'dev.merged_pct': f(41, '41%', 'run4/merging/README.md (202/498 = 40.6%)', 'chapters/03-methodology.tex:501'),
  'dev.spacing_old': f(4, '4 mm', 'design-decisions.md, 2026-08-09 item 1', 'chapters/03-methodology.tex:180'),

  /* ── Case A and case B (motion clips; DEMETER per-case CSV) ─────────── */
  'a.gt': f(52, '52', `${PERCASE}, case A n_gt`, `${README}, A4`),
  'a.found': f(49, '49', `${PERCASE}, case A tp`, `${README}, A4`),
  'a.missed': f(3, '3', `${PERCASE}, case A fn`, `${README}, A4`),
  'a.fa': f(2, '2', `${PERCASE}, case A fp`, `${README}, A4`),
  'a.f1': f(0.9514563106796116, '95.1%', `${PERCASE}, case A f1`, `${README}, A5`),
  'a.sens': f(0.9423076923076924, '94.2%', `${PERCASE}, case A sensitivity`, `${README}, A5`),
  'a.ppv': f(0.9607843137254902, '96.1%', `${PERCASE}, case A ppv`, `${README}, A5`),
  'a.dsc': f(0.8232379884090484, '82.3%', `${PERCASE}, case A dsc`, `${README}, A5`),
  'a.windows': f(160, '160', 'motion-data/psma_7e25beff54698eb8_2021-06-21/windows.json, n', `${README}, A2a`),
  'a.regions_before': f(50, '50', 'motion-data manifest.json, components.n_binary', `${README}, A2c`),
  'a.regions_after': f(45, '45', `${PERCASE}, case A n_pred`, `${README}, A2c and A3`),
  'a.bone': f(47, '47', `${README}, A1 cue (organ pseudo-labels)`, `${README}, A1`),
  'a.rule_min': f(20, '20', 'tools/psma-motion/cases.json, rule (min_gt 20)', `${README}, "How the cases were chosen"`),
  'b.gt': f(2, '2', `${PERCASE}, case B n_gt`, `${README}, B4`),
  'b.found': f(2, '2', `${PERCASE}, case B tp`, `${README}, B4`),
  'b.fa': f(14, '14', `${PERCASE}, case B fp`, `${README}, B4`),
  'b.f1': f(0.2222222222222222, '22.2%', `${PERCASE}, case B f1`, `${README}, B5`),
  'b.ppv': f(0.125, '12.5%', `${PERCASE}, case B ppv`, `${README}, B5`),
  'b.sens': f(1.0, '100%', `${PERCASE}, case B sensitivity`, `${README}, B5`),
  'b.dsc': f(0.0718987341772151, '7.2%', `${PERCASE}, case B dsc`, `${README}, B5`),
  'b.fa_bone': f(8, '8', `${README}, "B's 14 false alarms"`, `${README}, "Speaker notes"`),
  'b.fa_soft': f(6, '6', `${README}, "B's 14 false alarms"`, `${README}, "Speaker notes"`),

  /* ── Clip lengths (README "The clips"; ffprobe of the MP4s) ──────────── */
  'clip.a1': f(8.8, '8.8 s', `${README}, case A table`, 'n/a'),
  'clip.a2a': f(5.5, '5.5 s', `${README}, case A table`, 'n/a'),
  'clip.a2b': f(6.6, '6.6 s', `${README}, case A table`, 'n/a'),
  'clip.a2c': f(5.8, '5.8 s', `${README}, case A table`, 'n/a'),
  'clip.a3': f(9.6, '9.6 s', `${README}, case A table`, 'n/a'),
  'clip.a4': f(8.8, '8.8 s', `${README}, case A table`, 'n/a'),
  'clip.a5': f(5.2, '5.2 s', `${README}, case A table`, 'n/a'),
  'clip.b1': f(8.8, '8.8 s', `${README}, case B table`, 'n/a'),
  'clip.b2': f(5.0, '5.0 s', `${README}, case B table`, 'n/a'),
  'clip.b3': f(9.6, '9.6 s', `${README}, case B table`, 'n/a'),
  'clip.b4': f(6.2, '6.2 s', `${README}, case B table`, 'n/a'),
  'clip.b5': f(5.2, '5.2 s', `${README}, case B table`, 'n/a'),

  /* ── D1, the recorded demo (filled once the cut is rendered) ─────────── */
  'd1.speed': f(6, '6x', 'tools/seminar-decks/make_d1.py: frame times = t_since_click / 6 (motion-data/app-guide/manifest.json, captures C01-C25)', 'n/a', 'time-lapse factor of the run section'),
  'd1.len': f(18.23, '18 s', 'public/seminar-decks/clips/d1-model-run.mp4 (ffprobe 18.23 s; make_d1.py, 547 frames at 30 fps)', 'n/a', 'clip length, rounded'),

  /* ── Hypotheses, misc ────────────────────────────────────────────────── */
  'hyp.n': f(4, 'four', 'chapters/01-introduction.tex:101-143 (H1-H4)', 'sec:intro-hypotheses'),
  'rule.voxel': f(1, 'one', 'chapters/03-methodology.tex:489-493', 'any-overlap: one shared voxel is enough'),
};

export const fact = (k) => {
  const e = FACTS[k];
  if (!e) {
    if (import.meta.env?.DEV) console.error(`[seminar-decks] unknown fact key: ${k}`);
    return `??${k}??`;
  }
  return e.display;
};
