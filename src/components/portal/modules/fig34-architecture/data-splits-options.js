/* ============================================================================
   FIG 3.2 · DATA SPLITS — the three options, as words and assets
   ----------------------------------------------------------------------------
   Figure 3.2 of the dissertation (fig:method-data-splits), built three ways by
   Mamba_PSMA/scripts/thesis_figures/data_splits/make_data_splits.py from the
   split files. Counts only (no case ids, no images), so the renders are
   bundled: an SVG from `pdftocairo -svg` (shown on the page), the PDF itself, a
   200 dpi greyscale PNG from `pdftoppm -gray`, and the scratch build's figure
   page and page spread at 110 dpi in colour and grey. The numbers, cuts and
   build record are in ./data-splits/data.json (generated). This file holds the
   words: the brief, each option's concept, critic verdicts and scores, and the
   recommendation. Scores are from one critic round (accuracy and design on
   Opus, a cold reader on Sonnet) on the first build, then a Sonnet re-check of
   the must-fixes; the renders here are the fixed versions. Critic reports and
   the decisions log are in the dissertation repo under
   documents/temp/final-week/oct16/data-splits-figure/.
   ========================================================================== */

import svgA from './data-splits/option-a.svg?url';
import svgB from './data-splits/option-b.svg?url';
import svgC from './data-splits/option-c.svg?url';
import pdfA from './data-splits/option-a.pdf?url';
import pdfB from './data-splits/option-b.pdf?url';
import pdfC from './data-splits/option-c.pdf?url';
import greyA from './data-splits/option-a-grey.png?url';
import greyB from './data-splits/option-b-grey.png?url';
import greyC from './data-splits/option-c-grey.png?url';
import pageA from './data-splits/page-a.png?url';
import pageB from './data-splits/page-b.png?url';
import pageC from './data-splits/page-c.png?url';
import spreadA from './data-splits/spread-a.png?url';
import spreadB from './data-splits/spread-b.png?url';
import spreadC from './data-splits/spread-c.png?url';
import spreadGreyA from './data-splits/spread-a-grey.png?url';
import spreadGreyB from './data-splits/spread-b-grey.png?url';
import spreadGreyC from './data-splits/spread-c-grey.png?url';

// James chose C on 16 October and it was placed in the dissertation without the
// cuts (data.json "placed"); option C's assets are the placed figure.
export const CHOSEN = 'C';

export const ASSETS = {
  A: { svg: svgA, pdf: pdfA, grey: greyA, page: pageA, spread: spreadA, spreadGrey: spreadGreyA },
  B: { svg: svgB, pdf: pdfB, grey: greyB, page: pageB, spread: spreadB, spreadGrey: spreadGreyB },
  C: { svg: svgC, pdf: pdfC, grey: greyC, page: pageC, spread: spreadC, spreadGrey: spreadGreyC },
};

export const BRIEF = {
  points: [
    'Show the structure: what is nested in what, and which runs used which split. At a glance: the sealed test set is shared, fold 0 is run 4’s split plus DEEP-PSMA, and no study crosses from test into training.',
    'Every number comes from the split files through the script; a second script checks every number in each compiled PDF against them. Counts only: no case ids, patient ids or images.',
    'Boxes, bars and labels only; at most three fills plus greys, consistent with Figure 3.1; training, validation and test told apart in greyscale by tone; Latin Modern, labels 9 pt, smallest text 8 pt; exactly \\textwidth (144.6 mm) wide and at most about 80 mm tall.',
    'Caption at most 45 words, keeping “How the 697 studies were split” as the List of Figures title. The label stays fig:method-data-splits and the file method-data-splits.pdf.',
  ],
  rule: 'Three options in one round: A a partition tree, B proportional bars on one axis, C the usual cross-validation grid. Per-fold strata counts are left out, and the scoring of all 100 DEEP-PSMA cases by run 4 and the released baseline is not annotated (decisions log).',
};

// Short names for the facts.json keys in the Numbers card.
export const LABELS = {
  n_all: 'studies in all',
  n_autopet: 'autoPET-III studies',
  n_deeppsma: 'DEEP-PSMA studies',
  n_test: 'sealed test set',
  n_test_autopet: 'sealed test set, autoPET',
  n_test_deeppsma: 'sealed test set, DEEP-PSMA',
  n_pool: 'run 5 pool',
  n_pool_autopet: 'pool, autoPET',
  n_pool_deeppsma: 'pool, DEEP-PSMA',
  n_pool_patients: 'pool patients',
  n_pool_multi_patients: 'pool patients with more than one study',
  pool_multi_min: 'fewest studies of such a patient',
  pool_multi_max: 'most studies of one patient',
  f0_train: 'fold 0 training',
  f0_val: 'fold 0 validation',
  fk_train: 'folds 1 to 4 training, each',
  fk_val: 'folds 1 to 4 validation, each',
  f0_train_deeppsma: 'DEEP-PSMA added to run 4’s training set in fold 0',
  f0_val_deeppsma: 'DEEP-PSMA added to run 4’s validation set in fold 0',
  ap_train: 'autoPET-only split, training (runs 1 to 4 and 6)',
  ap_val: 'autoPET-only split, validation',
  ap_test: 'autoPET-only split, test',
};

export const OPTIONS = [
  {
    id: 'A',
    name: 'Partition tree',
    source: 'Mamba_PSMA/scripts/thesis_figures/data_splits/option-a.tex',
    concept:
      'The 697 studies at the top split into the pool and the sealed test set, and the pool, on a comb, into five fold columns (training over validation). The autoPET-only split of runs 1 to 4 and 6 sits on the left in the same rows, with arrows into fold 0 (+70 and +10 DEEP-PSMA) and into the test set (the same 110, plus 20 DEEP-PSMA).',
    strengths: [
      'States every message in words: the arrows say what fold 0 adds to run 4’s split, and the test box says “never trained on or used for selection”. The cold reader answered all five quiz questions from the figure alone.',
      'The closest match to Figure 3.1: white rounded boxes with its grey borders, the same weights and Latin Modern sizes.',
      'Prints every number the six cuts remove, including the 136 patients with 2 to 7 studies, so every cut can apply.',
      'The best caption of the three (design critic): it states the takeaway rather than a colour key, in 39 words.',
    ],
    weaknesses: [
      'Not to scale: 500 and 442, 67 and 125 sit in boxes of one size.',
      'Reads in three directions: down the tree, across from run 4 into fold 0, and round the elbow to the test set.',
      'Runs 1 to 4 and 6 float beside the tree with no line from the 697, and the top-left corner is empty.',
      'The tallest but one (61.9 mm) and the most text.',
    ],
    missing: 'None: A prints every number the six cuts remove.',
    greyscale:
      'One hue only (validation, Okabe-Ito sky blue); training D9D9D9 and the test set 4D4D4D differ in tone (about 85, 62 and 30 percent grey in the pdftoppm -gray render). Colour-blind simulation keeps the blue distinct from the greys for all three deficiencies (design critic). The cells also carry their role in words.',
    verdicts: [
      { who: 'Accuracy (Opus)', text: 'Pass: every number correct and in the right cell. One nit on the caption (“stayed in” assumed the sealed set already existed; now “became part of”).' },
      { who: 'Design (Opus)', text: 'Rank 2: the most explicit and the closest to Figure 3.1’s box style, but it reads in three directions. Should-fixes applied: a comb instead of 0.8 mm ticks, narrower left boxes so the arrow labels clear, two lines out of the dense test box, “the same 110, plus 20”, rounded cells throughout.' },
      { who: 'Cold reader (Sonnet)', text: '5 of 5 from the figure. The +70 / +10 arrows needed a second look; the long test arrow is easy to miss.' },
    ],
    score: {
      mustFix: '0',
      quiz: '5 / 5',
      rank: 2,
      design: [8, 6.5, 6.5],
      mainPoint: '697 studies are divided into a 567-study pool cut into five folds and a sealed 130-study test set, and the autoPET-only split is the same as fold 0 minus the DEEP-PSMA cases.',
    },
  },
  {
    id: 'B',
    name: 'Proportional bars',
    source: 'Mamba_PSMA/scripts/thesis_figures/data_splits/option-b.tex',
    concept:
      'One bar per split scheme on one shared axis of studies: runs 1 to 4 and 6, run 5’s fold 0, and run 5’s folds 1 to 4. Fold 0’s segments sit exactly over the autoPET-only split’s, its hatched DEEP-PSMA tails under the dashed places outside that split (+70, +10, +20 between the bars), and a dashed line through every bar seals off the test set.',
    strengths: [
      'The fastest read (design critic and cold reader): one scale, one boundary line, and the dark test block unchanged at the right of every bar.',
      'Drawn to scale, so the small DEEP-PSMA share and the test set’s fifth of the studies show without extra numbers.',
      'Fold 0 = run 4 + DEEP-PSMA is visual (aligned segments, empty places filled with hatching) and verbal (the row label and the +70 / +10 / +20).',
      'The least ink and the shortest (56.8 mm).',
    ],
    weaknesses: [
      'Folds 1 to 4 share one bar, so the five validation sets covering the pool once is left to the paragraph.',
      'Does not print the 136 patients with 2 to 7 studies: DS-06 then takes that number out of the dissertation (keep its sentence if B is chosen).',
      'Folds 1 to 4’s DEEP-PSMA tails are drawn at the mean (62.5 and 17.5; really 62 or 63 and 17 or 18), a difference under 0.1 mm.',
      'The +10 and +20 labels are 8 pt beside 1.6 and 3.2 mm slivers.',
    ],
    missing: 'The 136 patients with 2 to 7 studies (DS-06 requires A). 487 / 80 are not printed either, but no cut removes them and Table 3.2 has them.',
    greyscale:
      'Same three tones as A (85, 62, 30 percent grey) with DEEP-PSMA hatched in a darker tone of each fill, so every segment reads in greyscale; the “not in the split” places are white with a dashed outline and no hatch. Text contrast at least 6.9:1 (design critic).',
    verdicts: [
      { who: 'Accuracy (Opus)', text: 'Numbers pass; widths on one scale (0.1598 mm per study), every segment within 0.05 studies. Must-fix: “not used” and “a run did not use” were false, because runs 4 and 6 were scored on all 100 DEEP-PSMA cases. Fixed: the legend now says “not in the split” and the caption no longer mentions it.' },
      { who: 'Design (Opus)', text: 'Rank 1: “the cleanest of the three and shows all three messages at a glance”. Must-fix: the caption said “Each bar is one split” (the last bar is four folds) and spent half its words on a colour key; rewritten to state the message. Should-fixes applied: the deltas moved between the bars, +10 clear of the dashed line, “each of the four”, the dashed line starts at the first bar, label baselines raised.' },
      { who: 'Cold reader (Sonnet)', text: 'The quickest to understand. 5 of 5, but “was any test study trained on?” came from the paragraph, not the figure; the dashed outlines looked faint (now darker and unhatched).' },
    ],
    score: {
      mustFix: '2, fixed',
      quiz: '5 / 5 (Q4 from the paragraph)',
      rank: 1,
      design: [8.5, 7.5, 7.5],
      mainPoint: 'Drawn to scale, the same 697 studies are split three ways, and the test block (110 plus 20 DEEP-PSMA) stays the same on the right in every row.',
    },
  },
  {
    id: 'C',
    name: 'Fold grid',
    source: 'Mamba_PSMA/scripts/thesis_figures/data_splits/option-c.tex',
    concept:
      'The cross-validation matrix: the pool laid out as the five validation blocks, each block’s DEEP-PSMA studies hatched at its end, then the sealed test set. Each fold row shades its own block as validation; the first row is the autoPET-only split and is exact, not schematic: run 4’s 430 training studies are the autoPET part of blocks 1 to 4 (asserted).',
    strengths: [
      'The only option that draws the cross-validation design itself: the validation diagonal covers the pool once.',
      'The dark test column runs unbroken down all six rows, the strongest picture of a shared, sealed test set.',
      'Exact to the study, including the first row, which an examiner who notices will credit.',
      'The most familiar layout to a machine-learning examiner (design critic’s highest “examiner stop” score).',
    ],
    weaknesses: [
      'The busiest: 30 hatched slivers of 1.4 to 2.6 mm give a barcode texture.',
      'Fold 0 = run 4 + DEEP-PSMA is never stated in the figure, only shown by alignment (the caption now says it).',
      'Does not print 70, 10 or 20, or the 136: with C, keep DS-04 and DS-06 unapplied.',
      'The tallest (64.6 mm).',
    ],
    missing: '70 and 10 (DS-04 requires A or B), 20 (DS-02; Table 3.2 has it) and the 136 patients (DS-06 requires A). C draws those studies but does not print their counts.',
    greyscale:
      'Same tones as A and B; hatching in a darker tone of each fill. The white separator between pool and test survives greyscale. The “not in the split” places in the first row are white and unhatched, so they no longer look like the hatched DEEP-PSMA blocks below (cold reader).',
    verdicts: [
      { who: 'Accuracy (Opus)', text: 'Numbers pass; widths exact (0.1436 mm per study; blocks 67 / 125 x 4 / 130; DEEP-PSMA tails 10 / 17 / 17 / 18 / 18 / 20). Same must-fix as B (“not used”), fixed the same way.' },
      { who: 'Design (Opus)', text: 'Rank 3: carries the most information but is the busiest. Must-fix: “Sealed test set: 130” and the “Training” header ran together as one phrase; the header now sits below the bracket row with no rule. Should-fixes applied: the grid shifted right so “Runs 1 to 4 and 6” fits on one line, fold 0’s test block labelled 130, and the caption states the message.' },
      { who: 'Cold reader (Sonnet)', text: 'Shows the cross-validation structure best but is the busiest. Fold 0 against run 4 only by inference; the first row’s slivers looked like the fold rows’ (now unhatched).' },
    ],
    score: {
      mustFix: '2, fixed',
      quiz: '4.5 / 5 (Q3 inferred, Q4 from the paragraph)',
      rank: 3,
      design: [6.5, 6, 8],
      mainPoint: 'Every split is a row; the blue validation block moves across the pool, one position per fold, and the dark test block never changes.',
    },
  },
];

export const RECOMMENDATION = {
  id: 'B',
  reasons: [
    'Ranked first by the design critic and quickest for the cold reader: one shared scale, one dashed boundary, and the test block unchanged at the end of every bar. It meets “less is more” best.',
    'It shows the three messages without words to decode: the sealed test set is shared, fold 0 is run 4’s split with the DEEP-PSMA places filled (+70, +10, +20), and nothing crosses the dashed line.',
    'Both critics’ must-fixes for B were in its wording (legend and caption), not its drawing, and are fixed.',
    'Apply DS-01 to DS-05 and CE-01 with it. Keep the 136 sentence (skip DS-06), because B does not print that number. The paragraph goes from 200 to 179 words and, with B’s 33-word caption (now 23), the all-in from 14,098 to 14,087 (-11, measured with wordcount.py).',
  ],
  note: 'A is the safe alternative if explicit wording and Figure 3.1’s box style matter more than proportion: it answered the whole quiz from the figure alone and supports all six cuts. Choose C only if drawing the cross-validation design itself matters more than a quick read, and then skip DS-04 and DS-06.',
};
