/* ============================================================================
   PSMA MOTION — ON-SCREEN WORDS
   ----------------------------------------------------------------------------
   Every word the stage shows lives here, so the wording rules can be checked in
   one place: cohorts are "autoPET-III" and "DEEP-PSMA", patients are described
   only as whole-body PSMA PET/CT, no tracer is named, no case id appears, no
   baseline is compared, Australian spelling.

   Numbers never appear in these strings. Every number on stage is rendered from
   a manifest entry (see <Num> in StageView.jsx) so it can be traced to its file.
   Lesions are the expert outlines; regions are what the model outputs.
   ========================================================================== */

// How each cohort's ground truth was made (dissertation chapter 3, dataset table).
const GT_SOURCE = {
  'autoPET-III': 'Outlines corrected slice by slice by an expert, then cross-checked.',
  'DEEP-PSMA': 'Fixed-threshold outlines, normal uptake removed by a physician.',
};

export function copyFor(cohort) {
  return {
    beat1: {
      title: 'Whole-body PSMA PET/CT',
      sub: 'A held-out test scan. The model never saw it during training.',
      layers: { ct: 'CT · bone', pet: 'PET · tracer uptake', organs: 'Labelled organs: normal uptake' },
    },
    beat2: {
      title: 'Running the model',
      sub: 'The scan is read in overlapping 3D windows.',
      windowLabel: 'window',
      windowOf: 'of',
      windowFacts: ['voxels each', 'overlap', 'centre-weighted'],
      depth: 'depth',
      net: {
        conv: 'Convolution (number: feature channels)',
        mamba: 'Mamba block (sequence model)',
        dirsA: 'each Mamba block reads in',
        dirsB: 'directions',
        input: 'CT + PET',
        output: 'Lesion probability',
      },
    },
    beat2b: {
      title: 'Five models, one answer',
      sub: 'Their probability maps are averaged, then thresholded.',
      models: 'models, each trained on a different subset of the scans',
      average: 'Average of the',
      averageTail: 'models',
      keyLow: 'low',
      keyHigh: 'high',
      keyName: 'probability',
      threshold: 'Kept where probability is above',
      filter: 'Regions smaller than',
      filterUnit: 'voxels',
      filterMl: 'mL',
      filterTail: 'removed',
      regions: 'regions',
    },
    beat3: {
      title: 'The prediction',
      sub: 'Every region the model marks as a lesion.',
      count: 'predicted regions',
    },
    beat4: {
      title: 'Against the ground truth',
      sub: GT_SOURCE[cohort] ?? 'Reference outlines.',
      gtLegend: 'Ground truth',
      foundOf: 'of',
      found: 'lesions found',
      foundOne: 'lesion found',
      missed: 'missed',
      falseAlarm: 'false alarms',
      falseAlarmOne: 'false alarm',
      rule: 'A lesion counts as found if any predicted voxel overlaps it.',
      mergedA: 'predicted regions cover',
      mergedB: 'lesions: one region can span neighbours.',
      nearMiss: 'Close is not enough: missed lesions that look covered here lie just outside the prediction in 3D.',
    },
    beat5: {
      title: 'Scoring this scan',
      found: 'found',
      metrics: [
        { key: 'case.f1', name: 'F1 score', gloss: 'low if either below is low' },
        { key: 'case.sensitivity', name: 'Sensitivity', gloss: 'found ÷ (found + missed)' },
        { key: 'case.ppv', name: 'Precision (PPV)', gloss: 'found ÷ (found + false alarms)' },
        { key: 'case.dsc', name: 'Dice (DSC)', gloss: 'outline overlap, voxel by voxel; false alarms count against it' },
      ],
      contextA: 'All',
      contextB: 'test scans, lesions pooled:',
      contextF1: 'F1',
    },
  };
}
