import { FACTS } from '../../shared/facts';

/* ============================================================================
   ONE SCAN, START TO FINISH — ON-SCREEN TEXT AND CHART CONSTANTS
   Numbers only as {{keys}}; chart values read from the manifest.
   ========================================================================== */

const v = (k) => FACTS[k].value;

/* N6, resolved: one line of evidence per hypothesis (tab:disc-hypotheses). */
export const BOARD_EVIDENCE = {
  H1: '{{fair.df1}} F1 points for run 4 on unseen scans, at lower precision',
  H2: 'Partial test. Run 2 (older matcher): {{run2.sens}} sensitivity, {{run2.ppv}} precision',
  H3: 'At equal passes, no faster in mean time and no lower in peak memory',
  H4: 'On DEEP-PSMA the larger window cost the hybrid more than its twin',
};

/* N8 callouts, one per build step, placed on blank parts of the plate
   (plate coordinates; the plate is 1728 x 730). */
export const OPTF_CALLOUTS = [
  {
    x: 640, y: 200, w: 1000,
    kicker: 'Input and the two shallow stages',
    lines: ['Two channels in: CT and PET.', 'Convolutions only. A sequence here would be at least {{net.tok2}} tokens long.'],
  },
  {
    x: 40, y: 522, w: 1300,
    kicker: 'The three deepest stages',
    lines: ['Convolution, then Mamba blocks, where the sequence is short.'],
  },
  {
    x: 44, y: 600, w: 1640,
    kicker: 'Inside one Mamba block',
    lines: ['Flattened, then read in {{net.dirs}} directions by {{net.dirs}} Mamba layers, summed and added back.'],
  },
  {
    x: 1186, y: 70, w: 510,
    kicker: 'Training only',
    lines: [
      'The organ head learns {{organ.classes}} classes: background and {{organ.structures}} anatomical structures. It never runs at inference.',
      'Adding it cut false alarms on {{organ.neg}} validation scans with no lesions from {{organ.fc3}} to {{organ.fc4}}.',
    ],
  },
];

/* N8, last build: the summary sits on the navy ground beside the narrowed plate. */
export const OPTF_SUMMARY = {
  kicker: 'The whole network',
  lines: ['{{net.params}} parameters in {{net.stages}} stages.', 'Convolution at every stage, Mamba in the deepest three, the organ head in training only.'],
};

/* N5 slope chart: DEEP-PSMA F1 (10-voxel filter) of the four run 6 cells and
   PSMASegmentator on the same 100 scans (reference line only). */
export const TWIN = {
  y0: 75,
  y1: 84,
  top: 30,
  bot: 520,
  xs: 330,
  xl: 760,
  vals: {
    hs: v('r6.h_small'),
    hl: v('r6.h_large'),
    cs: v('r6.c_small'),
    cl: v('r6.c_large'),
    psm: v('fair.psm_f1') * 100,
  },
};
