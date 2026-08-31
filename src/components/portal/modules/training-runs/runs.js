/* ============================================================================
   TRAINING RUNS — RUN REGISTRY
   ----------------------------------------------------------------------------
   One entry per Mamba_PSMA training run (aborted runs count — those are
   results too). The Training Runs tab builds its index from this array and
   renders the selected entry's `component` as that run's analysis page.

   ADDING A NEW RUN ANALYSIS (the whole workflow — two steps, nothing else):

     1. Copy ./runs/Run00Sample.jsx → ./runs/Run<NN><ShortName>.jsx
        (NN = this entry's `n`, zero-padded: Run01Baseline.jsx, Run02Aug.jsx…)
        and replace the sample constants with the run's REAL numbers. Build
        the page only from the kit components (see ../kit.jsx header) and
        keep the template's section order so every run reads the same.

     2. Add ONE entry to RUNS below. The index sorts by `n` descending, so
        just append — the newest run surfaces on top automatically.

     (+) W&B PNG exports go in ./figures/run-<nn>-<shortname>/ — folder named
         exactly after the entry's `id`, kebab-case metric filenames — and are
         imported by the run page into <Figure> components. Conventions in
         ./figures/README.md.

   Do NOT touch registry.js, Portal.jsx or portal.css for a new run.

   Entry contract:
     id        unique slug: 'run-<nn>-<shortname>'
     n         run number (1, 2, 3… — the sort key; sample stays 0)
     title     short name for the run, e.g. 'Baseline · first full run'
     date      when it ran, 'DD Mon YYYY'
     machine   where, e.g. 'hospital 4090' | 'dev PC · RTX 5070 Ti'
     config    the config file (+ key overrides), e.g. 'baseline.yaml'
     status    'complete' | 'in-progress' | 'aborted'
     verdict   'good' | 'mixed' | 'bad' | 'na'  — the index card's accent;
               'na' while a run is still going
     summary   ONE sentence — the takeaway shown on the index card
     headline  ≤3 chips for the index card: [{ v: '0.66', k: 'val Dice' }]
     meta      OPTIONAL extra header chips: [{ k: 'data', v: 'PSMA v3' }]
     sample    OPTIONAL — true only on the demo entry below
     component the page, default-exported from ./runs/<file>.jsx

   Keeping it clean as runs accumulate:
     • One file per run, never edit an old run's page to talk about a new
       one — cross-run comparisons live in the NEW run's MetricTable.
     • The sample entry (n: 0) always sorts last; delete its entry + file
       once a few real runs exist, or keep it as the living template.
     • If a run is re-analysed later, update its own file — the registry
       entry only changes if the verdict/summary changed.
   ========================================================================== */

import Run00Sample from './runs/Run00Sample';
import Run02Clipping from './runs/Run02Clipping';
import Run03Parity2mm from './runs/Run03Parity2mm';
import Run04OrganSupervision from './runs/Run04OrganSupervision';

export const RUNS = [
  {
    id: 'run-04-organ-supervision',
    n: 4,
    title: 'Organ supervision · a second head that learns anatomy',
    date: '25–26 Aug 2026',
    machine: 'DEMETER · RTX 4090 24 GB',
    config: 'baseline.yaml · organ_supervision on · 25 classes · loss_weight 1.0',
    status: 'complete',
    verdict: 'good',
    summary:
      'A 25-class organ head trained alongside the lesion head — never called at inference — cut false lesions 23% and lifted PPV 5.1 points with sensitivity untouched; the one reported regression turned out to be a bug in the patient-accuracy metric, not the model.',
    headline: [
      { v: '0.587', k: 'val Dice' },
      { v: '73.7%', k: 'lesion F1 · protocol' },
      { v: '21.1 h', k: 'wall-clock' },
    ],
    meta: [
      { k: 'data', v: 'AutoPET PSMA v3 · 430/57/110' },
      { k: 'archive', v: '2026-08-28_run4_organ-supervision' },
    ],
    component: Run04OrganSupervision,
  },
  {
    id: 'run-03-parity2mm',
    n: 3,
    title: 'Resolution parity · 2 mm grid + balanced Tversky',
    date: '09–11 Aug 2026',
    machine: 'dev PC · RTX 5070 Ti 16 GB',
    config: 'baseline.yaml · spacing [2.04, 2.04, 3.0] · patch 96×192×96 · Tversky 0.5/0.5',
    status: 'complete',
    verdict: 'mixed',
    summary:
      'The 2 mm grid found 108 more real lesions and pushed sensitivity past the reference, and at a physically matched size filter run 3 beats run 2 on every lesion metric — but the official voxel-count protocol hides that win, and every lesion-free patient now collects a false alarm.',
    headline: [
      { v: '0.545', k: 'val Dice' },
      { v: '72.4%', k: 'lesion F1 · matched filter' },
      { v: '40.3 h', k: 'wall-clock' },
    ],
    meta: [
      { k: 'data', v: 'AutoPET PSMA v3 · 430/57/110' },
      { k: 'archive', v: '2026-08-11_run3_parity2mm' },
    ],
    component: Run03Parity2mm,
  },
  {
    id: 'run-02-clipping',
    n: 2,
    title: 'Gradient clipping + tiled validation',
    date: '02–03 Aug 2026',
    machine: 'dev PC · RTX 5070 Ti 16 GB',
    config: 'baseline.yaml · clip_grad_norm 12.0 · val_tiled true',
    status: 'complete',
    verdict: 'mixed',
    summary:
      'Clipping removed run 1’s instability outright and lifted val Dice to 0.514; the first lesion-level evaluation shows sensitivity essentially at the reference but precision 28 points short.',
    headline: [
      { v: '0.514', k: 'val Dice' },
      { v: '71.9%', k: 'best lesion F1' },
      { v: '12 h 30', k: 'wall-clock' },
    ],
    meta: [
      { k: 'data', v: 'AutoPET PSMA v3 · 430/57/110' },
      { k: 'commit', v: '6eaf709' },
    ],
    component: Run02Clipping,
  },
  {
    id: 'run-00-sample',
    n: 0,
    title: 'Sample run · the template',
    date: '04 Aug 2026',
    machine: 'nowhere — fabricated',
    config: 'baseline.yaml',
    status: 'complete',
    verdict: 'mixed',
    summary:
      'Every kit component with plausible fake numbers — copy this run’s file as the starting point for each real analysis.',
    headline: [
      { v: '0.66', k: 'val Dice' },
      { v: '6.8 h', k: 'wall-clock' },
    ],
    sample: true,
    component: Run00Sample,
  },
];
