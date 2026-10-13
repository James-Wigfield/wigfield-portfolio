/* ============================================================================
   FIG 3.4 · ARCHITECTURE — the eight options, as data
   ----------------------------------------------------------------------------
   One entry per candidate design. Assets are the TikZ builds: an SVG from
   `pdftocairo -svg` (shown on the page), the PDF itself, and a 150 dpi
   greyscale PNG from `pdftoppm -gray`. Imported with ?url so `npm run build`
   bundles them. A to E scores come from the round-1 critic panel (one accuracy
   critic, one blind reader per option, one design and marker critic). F to H
   are round 2 (James: keep D's look, aim for wow): a blind reader and an
   examiner per option on the drafts, then two passes of accuracy, design and
   art-director critics. Scores are from those passes; the renders here are
   the fixed versions. The
   full reports are in the dissertation repo under
   documents/temp/final-week/friday/fig34-critics/, and every finding with
   what was done about it is in
   documents/temp/final-week/friday/2026-10-09-fig34-review.md.
   ========================================================================== */

import svgA from './option-a.svg?url';
import svgB from './option-b.svg?url';
import svgC from './option-c.svg?url';
import svgD from './option-d.svg?url';
import svgE from './option-e.svg?url';
import pdfA from './option-a.pdf?url';
import pdfB from './option-b.pdf?url';
import pdfC from './option-c.pdf?url';
import pdfD from './option-d.pdf?url';
import pdfE from './option-e.pdf?url';
import greyA from './option-a-grey.png?url';
import greyB from './option-b-grey.png?url';
import greyC from './option-c-grey.png?url';
import greyD from './option-d-grey.png?url';
import greyE from './option-e-grey.png?url';
import svgF from './option-f.svg?url';
import svgG from './option-g.svg?url';
import svgH from './option-h.svg?url';
import pdfF from './option-f.pdf?url';
import pdfG from './option-g.pdf?url';
import pdfH from './option-h.pdf?url';
import greyF from './option-f-grey.png?url';
import greyG from './option-g-grey.png?url';
import greyH from './option-h-grey.png?url';

export const BRIEF = {
  caption:
    'The hybrid CNN-Mamba network. Mamba blocks sit only in the three deepest stages, where the flattened sequence is short, and the organ head is used in training only. Sequence lengths are per scan direction.',
  points: [
    'Mamba blocks only in the three deepest stages (2, 2 and 4 blocks), where the flattened sequence is short.',
    'The organ head is used in training only.',
    'Sequence lengths are per scan direction.',
  ],
  rule: 'Round 1 (A to E). Best means, in order: accurate to the code; understood in about ten seconds at print size; plain (one message, no decoration); consistent with Figures 3.1, 3.3 and 3.5. Same required content in all five; the optional extras vary on purpose so you can see what each costs.',
  round2: 'Round 2 (F to H). James preferred D and asked for designs that go further: a figure the examiner stops at. Same accuracy bar and the same three caption points, now with real data (one test patch in, the five-fold ensemble’s lesions out), the Mamba blocks as the visual hero, and the Mamba block drawn rather than described.',
};

const optional = (run6, mamba1, params, twin, scale, data = false) => [
  { on: run6, label: '224 × 192 × 192 column (run 6)' },
  { on: mamba1, label: 'Mamba-1 settings' },
  { on: !!params, label: params || 'Parameter counts' },
  { on: twin, label: 'CNN-only twin note' },
  { on: scale, label: 'Feature maps drawn to scale (log)' },
  { on: data, label: 'Real scan data (one test patch)' },
];

export const OPTIONS = [
  {
    id: 'A',
    name: 'Classic U',
    source: 'fig34-work/option-a.tex',
    assets: { svg: svgA, pdf: pdfA, grey: greyA },
    concept:
      'The field’s convention (U-Net, nnU-Net, U-Mamba): encoder down the left, bottleneck at the bottom, decoder up the right, horizontal skips. A table on the left gives each stage’s grid and sequence length, row for row, with the Mamba rows banded. Beneath: one Mamba block as six explicit flatten, Mamba layer, unflatten rows.',
    optional: optional(true, true, 'Parameter count (total)', false, false),
    strengths: [
      'Recognised at once by an examiner in medical imaging.',
      'Sequence lengths sit beside their own stage; the band ties the short ones to the Mamba stages.',
      'The most explicit and accurate Mamba-block panel: a direction label and “own weights” on every path.',
    ],
    weaknesses: [
      'Second-densest: the run 6 column, Mamba-1 settings and parameter line are extra messages the caption does not carry.',
      'The bottleneck sits off the encoder column, which one reader found odd.',
    ],
    verdicts: [
      { who: 'Accuracy', text: 'No must-fix. Should-fix: name the 224 column (done: “runs 3 to 5” / “run 6” under the headers).' },
      { who: 'Blind reader', text: '8 / 9. Misread stage 4 as one Mamba block because the white separators fused (fixed: “Mamba ×2” written in the compartment); unsure why the shallow stages have none (fixed: “too long to scan”).' },
      { who: 'Design and marker', text: 'Ranked 1st. Cut the 224 column and the repeated Mamba-1 and parameter detail for the final; borrow D’s inline “voxels” and E’s “Mamba ×n” (the second done).' },
    ],
    score: { mustFix: '0 (accuracy and design)', quiz: 8, rank: 1, heightMm: 136.0, minPt: 9,
      mainPoint: 'A U-Net style CNN encoder-decoder in which Mamba blocks (each scanning six flattened directions) appear only in the three deepest stages, where sequences are short, with a lesion head at the output and a training-only organ head.' },
  },
  {
    id: 'B',
    name: 'Flattened U with a stage table',
    source: 'fig34-work/option-b.tex',
    assets: { svg: svgB, pdf: pdfB, grey: greyB },
    concept:
      'Stages as columns, left to right: the encoder runs along the top row, the decoder returns beneath it, skips are short vertical arrows. A ruled table under the columns carries every number, so the diagram itself is almost text-free. Beneath: the Mamba block with flatten and unflatten as bars across six labelled direction paths.',
    optional: optional(false, false, 'Mamba parameters per stage', false, false),
    strengths: [
      'Quickest read of point 1: the blue slats sit visibly only at the deep end of the top row.',
      'Numbers read as a table, so the diagram stays light.',
      'Shortest of the full diagrams after E.',
    ],
    weaknesses: [
      'The folded U is less familiar than the classic U.',
      'Boxes just say “conv”, so the stages are told apart by the table.',
      'The per-stage Mamba parameters back nothing in the chapter.',
    ],
    verdicts: [
      { who: 'Accuracy', text: 'No must-fix. Should-fix: the shared flatten bar hid that each direction has its own axis order (done: direction labels on the six paths, “flatten, each in its own order”).' },
      { who: 'Blind reader', text: '8.5 / 9. All counts right; unsure whether Σ sums or averages (fixed: “sum” under Σ).' },
      { who: 'Design and marker', text: 'Ranked 2nd: cleanest diagram; lost on the flatten bar and label collisions (both fixed) and the extra parameter row (kept as B’s optional content).' },
    ],
    score: { mustFix: '0 (accuracy and design)', quiz: 8.5, rank: 2, heightMm: 134.5, minPt: 9,
      mainPoint: 'A five-stage encoder-decoder where only the three deepest stages add Mamba blocks, each scanning the flattened feature map in six directions, with a training-only organ head.' },
  },
  {
    id: 'C',
    name: 'Sequence-length ladder',
    source: 'fig34-work/option-c.tex',
    assets: { svg: svgC, pdf: pdfC, grey: greyC },
    concept:
      'The caption’s “why” as a chart: each stage’s sequence length is a point on a log axis, both patches, with the Mamba stages banded so “Mamba only where the sequence is short” is seen rather than read. A compact U sits beside it, rows aligned. Beneath: one Mamba path in full with five stacked behind.',
    optional: optional(true, false, null, true, false),
    strengths: [
      'Shows the reason for the design, not just the design.',
      'The only option where the size of the drop (four orders of magnitude) is visible.',
    ],
    weaknesses: [
      'Tallest (142.5 mm) and busiest: chart, network, two run 6 messages.',
      'The stacked-path panel says “×6” rather than showing six.',
      'Its first draft had two design must-fixes (bars on a log axis; blue meaning two things), now fixed with points and outlines.',
    ],
    verdicts: [
      { who: 'Accuracy', text: 'No must-fix. Should-fix: refers to stage numbers it never shows, and greyed the scanned run 6 values (both done).' },
      { who: 'Blind reader', text: '8 / 9. Counted stage 4’s Mamba blocks as 3 (fixed: “Mamba ×2”); unsure what “run 6” and the “CNN-only twin” are.' },
      { who: 'Design and marker', text: 'Ranked 5th. Must-fix: log bars mislead and blue meant two things (both fixed by points with blue and purple outlines); cut the run 6 messages (kept as C’s optional content).' },
    ],
    score: { mustFix: '0 accuracy; 2 design, both fixed', quiz: 8, rank: 5, heightMm: 142.5, minPt: 9,
      mainPoint: 'A CNN encoder-decoder with Mamba blocks in the three deepest stages (stages 3 to 5), with sequence lengths per stage shown on the left, and a lesion head on top and an organ head that is used only in training.' },
  },
  {
    id: 'D',
    name: 'Feature-map volumes',
    source: 'fig34-work/option-d.tex',
    assets: { svg: svgD, pdf: pdfD, grey: greyD },
    concept:
      'The PlotNeuralNet look: feature maps as cuboids, edges on a log scale (halving the grid shortens a block, doubling the channels thickens it), Mamba blocks as thin blue slabs after their stage’s convolution. Labels on the left give channels, grid and sequence length. Beneath: the six scans as arrowheads along the axes of a cube.',
    optional: optional(false, false, 'Parameter count (total)', false, true),
    strengths: [
      'The most pictorial; the shrinking maps make depth and resolution obvious.',
      'Cleanest handling of the shallow stages: grey “1,769,472 voxels” against bold “L = 27,648”.',
      'Survives greyscale (the slabs stay dark).',
    ],
    weaknesses: [
      'The only 3D drawing in Chapter 3; Figures 3.1, 3.3 and 3.5 are flat line art.',
      'Needs a legend sentence to decode block sizes the text never uses.',
      'The bottleneck, which holds 71% of the Mamba parameters, is the smallest object.',
    ],
    verdicts: [
      { who: 'Accuracy', text: 'No must-fix. Should-fix: “one per arrow” with three double-headed arrows, and slabs that broke the legend’s thickness rule (both done).' },
      { who: 'Blind reader', text: '8 / 9. Could not tell whether the decoder has Mamba (fixed: “decoder: no Mamba”); slab counts small (fixed: ×2, ×2, ×4 labels).' },
      { who: 'Design and marker', text: 'Ranked 3rd: passes the ten-second test, but the 3D style breaks with the chapter (kept: it is D’s concept).' },
      { who: 'Round 2 benchmark', text: 'Art director: wow 5, polish 7, clarity 8; the Mamba slabs are the least visible thing and a paragraph legend does the caption’s job. Examiners put its wow at 5 to 6. Design critic: 4th of F, G, H and D, “the safe fallback”.' },
    ],
    score: { mustFix: '0 (accuracy and design)', quiz: 8, rank: 3, heightMm: 141.0, minPt: 9,
      mainPoint: 'A U-shaped CNN-Mamba network in which Mamba blocks are added only at the three deepest stages, where the sequence length per scan direction is short (27,648, 3,456 and 432). The organ head is a training-only extra.' },
  },
  {
    id: 'E',
    name: 'Minimal',
    source: 'fig34-work/option-e.tex',
    assets: { svg: svgE, pdf: pdfE, grey: greyE },
    concept:
      'The “less is more” benchmark: one column of plain boxes for the encoder, a single box saying what the four decoder levels do, skips down a bus, and the Mamba block as an equation with its terms defined. One accent colour.',
    optional: optional(false, false, null, true, false),
    strengths: [
      'Shortest by far (110 mm) and the least ink.',
      'Every count is written, not drawn (“Mamba ×2”).',
      'Tied best blind quiz score.',
    ],
    weaknesses: [
      'Half the figure is prose or an equation: read, not seen.',
      'The decoder is collapsed, so you cannot see which level each skip feeds.',
      'The equation uses notation the chapter does not.',
    ],
    verdicts: [
      { who: 'Accuracy', text: 'Nits only (stride wording; x used for the input and an axis: both fixed). James to decide whether the equation form is acceptable.' },
      { who: 'Blind reader', text: '8.5 / 9. Unsure which skip feeds which decoder level, and what “run 6’s CNN-only twin” means.' },
      { who: 'Design and marker', text: 'Ranked 4th: least decorated but fails “slow to read loses”; draw the decoder and the six paths (kept: that would make it another option).' },
    ],
    score: { mustFix: '0 (accuracy and design)', quiz: 8.5, rank: 4, heightMm: 110.0, minPt: 9,
      mainPoint: 'A CNN encoder-decoder for PET/CT in which only the three deepest stages add Mamba blocks, each scanning a flattened sequence, and the output is a per-voxel lesion logit at full resolution.' },
  },
  {
    id: 'F',
    round: 2,
    name: 'Real scan in, real lesions out',
    source: 'fig34-work/option-f.tex',
    assets: { svg: svgF, pdf: pdfF, grey: greyF },
    concept:
      'D’s cuboids rebuilt as a page-filling U. The actual input patch (CT behind PET, one test scan) enters an encoder whose blocks shrink and thicken on log scales; full-size blue Mamba blocks appear only in the three deep stages; the decoder climbs back to the five-fold ensemble’s predicted lesions on the same patch. A bracket under the bottleneck opens a panel: one Mamba block, its 6 × 12 × 6 grid read six ways into six lanes of 432 tokens, each with its own Mamba layer, then unflattened, summed and added back.',
    optional: optional(false, false, null, false, true, true),
    strengths: [
      'Ranked first by both round-2 critics (design, art director) and the only new option with no accuracy must-fix in any pass.',
      'All three caption points, the real data and the six lanes read in ten seconds at page-filling scale.',
      'Keeps the U shape examiners already know, so the novelty costs no reading time.',
    ],
    weaknesses: [
      'Tallest of all eight (148 mm); the caption still fits under it on the page.',
      'Shows one test scan, so the caption or text should say which and how it was chosen.',
      'Needs its texture images beside the TikZ file (open question for James).',
    ],
    verdicts: [
      { who: 'Accuracy', text: 'No must-fix in either pass. Added since: “faces show projections”, “five-fold ensemble”, “+x order” and “own weights”.' },
      { who: 'Blind reader', text: '8.5 / 9 on the draft. Had to infer why the shallow stages have no Mamba (fixed: “too long to scan”).' },
      { who: 'Examiner', text: 'Wow 8 / 10 (D about 6).' },
      { who: 'Art director', text: 'Wow 8, polish 7, clarity 8.5; ranked 1st of F, G, H and D. All six refinements done (label collisions, the six Mamba boxes, the grid-to-lanes link, label spacing, the input note).' },
      { who: 'Design', text: 'Ranked 1st in both passes. Last must-fix (“unflatten, sum” on the bus) fixed.' },
    ],
    score: { mustFix: '0 accuracy; 1 design, fixed', quiz: 8.5, rank: 1, rankOf: 4, wow: 8, ad: [8, 7, 8.5], heightMm: 148.0, minPt: 9,
      mainPoint: 'A U-Net-style encoder-decoder for CT+PET where only the three deepest stages add Mamba blocks, with a lesion head for prediction and a training-only organ head.' },
  },
  {
    id: 'G',
    round: 2,
    name: 'The grid, read six ways',
    source: 'fig34-work/option-g.tex',
    assets: { svg: svgG, pdf: pdfG, grey: greyG },
    concept:
      'An hourglass on one line, real input to real prediction, skips arching overhead and a small table of channels, resolution and sequence length beneath. The bottleneck zooms into the centrepiece: the 6 × 12 × 6 grid drawn six times, each striped in the order its scan reads it, each into its own Mamba layer, then summed and added back.',
    optional: optional(false, false, null, false, true, true),
    strengths: [
      'The six striped grids are the clearest drawing of what a scan direction is; the design critic called the panel the most striking element of any option.',
      'Shortest of the new three (128.8 mm).',
      'Blind quiz 9 / 9.',
    ],
    weaknesses: [
      'The network is no bigger than the panel it zooms into (the art director wanted it to dominate; enlarged 1.3×, still close).',
      'Small data cubes, so the lesions read as specks.',
      'Needed a structural fix in round 2: the decoder arrows had bypassed the decoder blocks.',
    ],
    verdicts: [
      { who: 'Accuracy', text: 'Round-2 must-fix: the transposed-conv arrows left the merge nodes, so the decoder blocks dropped out of the path. Fixed: each now rises from the block below into the next node.' },
      { who: 'Blind reader', text: '9 / 9 on the draft. Block counts hard to read at icon size (blocks since enlarged 1.3×).' },
      { who: 'Examiner', text: 'Wow 7.5 / 10 (D about 5).' },
      { who: 'Art director', text: 'Wow 7.5, polish 7, clarity 6.5; ranked 2nd. Decoder flow, inset exit, input note and right column done.' },
      { who: 'Design', text: 'Ranked 2nd. Both must-fixes (decoder chain, residual through the axis glyph) fixed.' },
    ],
    score: { mustFix: '1 accuracy, fixed; 2 design, fixed', quiz: 9, rank: 2, rankOf: 4, wow: 7.5, ad: [7.5, 7, 6.5], heightMm: 128.8, minPt: 9,
      mainPoint: 'A five-stage CNN-Mamba U-Net where only the three deepest encoder stages use Mamba blocks, each of which scans a flattened feature map in six directions, with a training-only organ head.' },
  },
  {
    id: 'H',
    round: 2,
    name: 'Feature pyramid',
    source: 'fig34-work/option-h.tex',
    assets: { svg: svgH, pdf: pdfH, grey: greyH },
    concept:
      'An isometric view from above. Each block is a plate whose footprint is its grid and whose thickness is its channels, so the encoder is a tower narrowing downward and the decoder one widening upward, and the blue Mamba plates stack where the plates are small. Skips cross between the towers; the input cube sits on the encoder, the prediction on the decoder; one Mamba block is exploded in a side panel.',
    optional: optional(false, false, null, false, true, true),
    strengths: [
      'The most original silhouette: the blue visibly gathers where the maps are small.',
      'Examiner wow 8 / 10.',
    ],
    weaknesses: [
      'A new visual grammar (footprint = grid, thickness = channels) that needs a legend line to decode.',
      'Lowest art-director scores of the new three; the black CT face is the heaviest mark on the page.',
      'Plates and data cubes are drawn at different scales.',
    ],
    verdicts: [
      { who: 'Accuracy', text: 'No must-fix. Skips now branch off the flow after each stage’s last block; projections line added.' },
      { who: 'Blind reader', text: '8 / 9 on the draft. Stacked plates hard to count (helped by the “2 blocks” labels).' },
      { who: 'Examiner', text: 'Wow 8 / 10 (D about 6).' },
      { who: 'Art director', text: 'Wow 6, polish 5.5, clarity 6; ranked 4th, behind D: a visual language the reader has to learn first.' },
      { who: 'Design', text: 'Ranked 3rd. Both must-fixes (lesion-head label collision, panel note overflow) fixed.' },
    ],
    score: { mustFix: '0 accuracy; 2 design, fixed', quiz: 8, rank: 3, rankOf: 4, wow: 8, ad: [6, 5.5, 6], heightMm: 139.6, minPt: 9,
      mainPoint: 'A U-Net style encoder-decoder over a CT/PET patch in which only the three deepest encoder stages use Mamba blocks, with a lesion output and a training-only organ head.' },
  },
];

export const RECOMMENDATION = {
  id: 'F',
  reasons: [
    'Ranked first by both round-2 critics and accurate with no must-fix in any pass.',
    'It is D, improved: the same three-tone cuboids, but the Mamba blocks are full-size and blue, the data are real (one test patch in, the ensemble’s lesions out), and the Mamba block is drawn as six lanes of 432 tokens instead of explained in a legend.',
    'It fills the page (148 mm) and still leaves room for the caption beneath it.',
  ],
  note: 'Runner-up: G, whose six striped grids are the best drawing of a scan direction; pick it if the Mamba block matters more to you than the network. D stays the safe fallback, and A was round 1’s pick. Before finalising F, G or H: they need texture images beside the TikZ file (open question).',
};

// Set to the picked option's id after James chooses; the page then marks it "chosen".
export const CHOSEN = 'F';
