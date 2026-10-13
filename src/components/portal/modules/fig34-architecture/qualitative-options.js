/* ============================================================================
   FIG 4.7 · QUALITATIVE EXAMPLES — the three options, as words
   ----------------------------------------------------------------------------
   Figure 4.7 of the dissertation (fig:results-qualitative-examples) built three
   ways from the real Mamba PSMA app (Mamba_PSMA/gui/app.py): every image inside
   a panel is the app's own render or a screenshot of it, cropped and scaled
   only. The renders themselves show patient scans, so they are NOT imported
   here: Fig47Qualitative.jsx fetches them, and data.json (case table,
   provenance, hashes), from the dev server's local-only route. This file holds
   words only: the brief, the draft captions, each option's concept, critic
   verdicts and scores, and the recommendation. Scores are from one critic round
   (accuracy and design on Opus, a blind reader on Sonnet) on the first build;
   the renders shown are the fixed versions.
   Critic reports: honours-dissertation/documents/temp/final-week/monday/
   qualitative-figure/critic-*.md; decisions in decisions-log.md there.
   13 October: James chose A. Panel (c) changed from the lowest F1 to the best
   case and the case ids were dropped; only A was rebuilt, so B and C still
   show the 12 October line-up.
   ========================================================================== */

export const BRIEF = {
  points: [
    'Cases come from a rule fixed before any image was viewed (Chapter 4 plan, 6 October), re-derived from the run-of-record CSV by select_cases.py. On 13 October panel (c) changed from the lowest F1 to the highest F1 (most lesions among ties), still picked from the CSV before its image was opened.',
    'Every image inside a panel is the app’s own output: the viewer’s PNG pulled byte for byte, or a screenshot. Cropping and nearest-neighbour scaling only; titles, R/L, frames, ticks, legend and scale bars are drawn around them.',
    'Panel letters are fixed because Chapter 5 cites them: (b) fragmented DEEP-PSMA threshold labels, (d) false alarms on a lesion-negative scan, (e) run 4 against the large-patch hybrid.',
    'Exactly \\textwidth (144.6 mm), Latin Modern, titles 9 pt, smallest text 8 pt; figure and caption on one page.',
  ],
  rule: 'Three options in one round: A the plainest (a MIP row, Figure 2.1’s relative), B adds a slice through each error, C shows the app itself. Panel (e) is not built: run 6’s weights are only on DEMETER.',
};

// Draft captions (texcount words in the captions column; the current caption is 75).
export const CAPTIONS = {
  A: {
    words: 75,
    text: 'Anterior PET maximum-intensity projections (SUV 0 to 10) of test cases with the ensemble’s prediction (threshold 0.5, 10-voxel filter, any-overlap matcher). Blue outlines found lesions, touched by any predicted voxel, and the components touching them, pink missed lesions, and orange false alarms, components touching no lesion. Chosen by score: each cohort’s median F1 among scans with a lesion found, the highest F1 overall (most lesions among ties), and the lesion-negative scan with most false alarms.',
  },
  B: {
    words: 75,
    text: 'PET projections of test cases above PET/CT slices through the largest missed lesion, else false alarm (ticks), with the ensemble (threshold 0.5, 10-voxel filter, any-overlap matcher). Blue marks lesions the prediction touches and the components touching them, pink untouched lesions, orange components touching no lesion. Chosen before viewing: among scans where at least one lesion was found, each cohort’s median per-case F1 and the lowest overall, then the lesion-negative scan with most false alarms.',
  },
  C: {
    words: 74,
    text: 'The project’s Streamlit application on one test case (a) and its anterior PET projections of three more, with the ensemble (threshold 0.5, 10-voxel filter, any-overlap matcher). Green marks lesions the prediction touches and the components touching them, cyan untouched lesions, magenta components touching no lesion. Chosen before viewing: among scans where at least one lesion was found, each cohort’s median per-case F1 and the lowest overall, then the lesion-negative scan with most false alarms.',
  },
};

export const OPTIONS = [
  {
    id: 'A',
    name: 'MIP row',
    source: 'Mamba_PSMA/scripts/thesis_figures/qualitative_examples/option-a.tex',
    view: '3D rotation (MIP), frame 0 · PET Inverted grey, SUV 0–10 · Prediction vs ground truth, Outline · Motion graphics, light',
    concept:
      'One row of the app’s anterior PET maximum-intensity projections, one per case, on one physical scale with equal gutters, outlined in the app’s colour-blind scheme for light backgrounds. The plainest option and the closest relative of Figure 2.1.',
    strengths: [
      'Plain and legible; shares Figure 2.1’s and Figure 3.3’s language (inverted-grey PET, Okabe-Ito blue, light grey frames, Latin Modern 9 / 8 pt, glyph heights within 0.2 mm of Figure 2.1).',
      'One physical scale and one scale bar for the row; takes a fifth panel (e) without a redesign.',
      'Safe for the common colour-vision deficiencies (Okabe-Ito); every outline pixel is exactly a legend colour.',
      'The shortest: 97 mm without the case ids (98 mm with them), leaving the caption room on the page.',
    ],
    weaknesses: [
      'The error classes are the faintest marks on white: missed 3.1:1, false alarm 2.25:1 against the background.',
      'Small lesions print tiny: in (b) 10 of 29 pink groups are 0.7 mm or smaller; the best case (c) is nine small blue outlines, mostly in the pelvis, so it reads as quiet rather than striking.',
      'MIP pixels print at 100 dpi: the app renders its rotating MIP at 4 mm per pixel.',
    ],
    greyscale:
      'Found (grey 87) stands apart; missed (151) and false alarm (162) do not. Only panel (b) holds both, so in print the ambiguity is confined there, and the titles carry the counts. Colour-blind: weakest pair protan found/missed (ΔE 22.5); all others above 40 except tritan (rare).',
    verdicts: [
      { who: 'Accuracy', text: 'Pixels and numbers right (picks re-derived independently, 14 hashes, pixel identity, orientation, legend RGB). Must-fixes: the caption’s “at least one lesion found” qualifier did not cover (a) (fixed: it now covers (a) to (c)); Chapter 5 cites a panel (e) that does not exist (edit listed in the handover). Should-fixes: (d)’s title dropped “lesion-negative” (fixed); grid and projection notes (now in SOURCE; the handover lists what a section 4.9 sentence would need to say).' },
      { who: 'Design', text: 'Ranked 1st; no must-fix. Applied: four-line titles, equal gutters, 9 pt R/L, a caption that names the SUV window and uses the legend’s words, one id format. Not applied: dropping the short ids (the brief asks for them; compose.py --no-ids removes them).' },
      { who: 'Blind reader', text: '5 / 5. Pink and orange marks too small to count; the plainest; the page half empty.' },
    ],
    score: { mustFix: '0 design; 2 accuracy (1 fixed, 1 is a Ch 5 edit)', quiz: '5 / 5', rank: 1, design: [7, 7, 6], minPt: 8,
      mainPoint: 'Four whole-body scans show what the model found (blue), missed (pink) and falsely flagged (orange), from a good case to a bad case to a no-lesion case. (Blind reader’s summary of the 12 October line-up.)' },
  },
  {
    id: 'B',
    name: 'MIP plus slice',
    source: 'Mamba_PSMA/scripts/thesis_figures/qualitative_examples/option-b.tex',
    view: 'Row 1 as A · row 2: Slice scrubber, PET + CT, coronal, Soft tissue window, PET opacity 0.5, same overlay and scheme',
    concept:
      '12 October line-up, not rebuilt: panel (c) here is the lowest-F1 case. Option A’s row, plus one coronal PET + CT slice per case through the largest missed lesion in the app’s own lesion list (else the largest false alarm), as a 180 × 180 mm window centred on it. Ticks outside each projection mark that lesion’s column and height. Shows the anatomy under each error, at the cost of more ink.',
    strengths: [
      'The only option where a missed lesion or false alarm can be seen up close (the blind reader’s pick).',
      'Slice (b) shows a missed DEEP-PSMA fragment at about three times the projection’s scale: the best support for Chapter 5’s panel (b) claim.',
      'Ticks tie each slice to its place in the projection; slices carry their panel letters.',
    ],
    weaknesses: [
      'Slices print at 39 to 58 dpi (2.7 to 4.1 mm voxels): blocky. Slice (d) is at the body’s edge, half black, and cannot be read without a label naming the level.',
      'Inverted-grey PET over CT at 0.5 opacity is an unusual fusion for a clinical reader.',
      '134 mm tall, 36 mm more than A.',
    ],
    greyscale:
      'Top row as A. In the slice row the pink and orange outlines vanish on the mid-grey CT, so a greyscale print of the row shows nothing the projections do not.',
    verdicts: [
      { who: 'Accuracy', text: 'As A (both must-fixes and (d)’s title handled the same way). Nit: slice (b)’s lesion is 23 mm from any prediction, so it is not one of the five the 2 mm-grid scoring counts as found. “Its slice row gives the best visual support for (b) and (d).”' },
      { who: 'Design', text: 'Ranked 2nd. Must-fixes: tie slices to their projections (fixed: ticks outside each MIP frame) and label slice (d) (open: needs James to read the level on the CT, or choose A). Suggested capturing the slices as PET or CT alone (not done: the brief fixes PET + CT).' },
      { who: 'Blind reader', text: '5 / 5; preferred B. Slices had no letters (fixed) and slice (d) is blocky and half black.' },
    ],
    score: { mustFix: 'design 2 (1 fixed, 1 open); accuracy as A', quiz: '5 / 5', rank: 2, design: [6, 5, 7], minPt: 8,
      mainPoint: 'Same four whole-body scans, with a close-up CT slice below each one showing the largest missed lesion, or the false alarm if none was missed.' },
  },
  {
    id: 'C',
    name: 'In the app',
    source: 'Mamba_PSMA/scripts/thesis_figures/qualitative_examples/option-c.tex',
    view: 'App defaults: 3D rotation (MIP), frame 0 · PET Hot, SUV 0–8 · Green / cyan / magenta, Filled, opacity 0.6 · (a) a screenshot with the Result card',
    concept:
      '12 October line-up, not rebuilt: panel (c) here is the lowest-F1 case. The app’s default look. Panel (a) is a screenshot of the running app, viewer beside its Result card, so the reader sees the tool; (b) to (d) are the same viewer’s renders. The only option that names the app, so it depends on the dissertation introducing the GUI (revision item G-01, still a proposal).',
    strengths: [
      'Shows the tool itself; the Result card’s numbers in (a) equal the run of record for that case.',
      'Vivid at first sight.',
    ],
    weaknesses: [
      'The screenshot’s text prints at about 2.5 pt (card numbers about 5 pt), far below the 8 pt floor; no layout at 144.6 mm fixes it.',
      'Magenta false alarms nearly vanish on the Hot map in (c) and (d), the two panels about false alarms; the legend’s pure colours differ from the 60 % blends drawn.',
      'Hot on black with green, cyan and magenta appears nowhere else in the dissertation; the grid has no slot for (e) without moving the legend.',
    ],
    greyscale:
      'No class separates in greyscale (146 / 161 / 147); the greyscale render shows no overlay at all. Missed and false alarm also collapse for deuteranopes (ΔE 8.3).',
    verdicts: [
      { who: 'Accuracy', text: 'Use only if G-01 lands (the caption names an app no chapter introduces). Legend swatches are the scheme’s pure colours while the overlays are blended at 60 % (fixed: the legend now says so). Otherwise as A.' },
      { who: 'Design', text: 'Ranked 3rd; three must-fixes, all inherent (screenshot text, false alarms on Hot, clash with Figures 2.1 and 3.3). If the app is to be shown, give it its own figure in section 3.9 at a legible scale and keep Figure 4.7 as A.' },
      { who: 'Blind reader', text: '4.5 / 5: no R/L on the screenshot, so orientation in (a) was a guess; the least readable of the three.' },
    ],
    score: { mustFix: 'design 3 (inherent); accuracy 1 (G-01)', quiz: '4.5 / 5', rank: 3, design: [3, 4, 6], minPt: 8,
      mainPoint: 'A software screenshot and three coloured whole-body scans, with green lesions, cyan misses and magenta false alarms.' },
  },
];

export const RECOMMENDATION = {
  id: 'A',
  reasons: [
    'Ranked first by the design critic, 5 / 5 with the blind reader, and right on every number and pixel the accuracy critic checked.',
    'The plainest and the closest relative of Figure 2.1 (inverted-grey PET, Okabe-Ito colours, the same type and frames), safe for the common colour-vision deficiencies.',
    'The shortest (98 mm), and it takes panel (e) as a fifth column without a redesign.',
  ],
  note: 'Before placing any option: delete the panel (e) citation in Chapter 5 (or build (e) from DEMETER); see the handover. B is the alternative if you want to see the errors up close, but label slice (d) first. C only if G-01 goes in, and even then the app reads better as its own small figure in Chapter 3.',
};

// Set to the picked option's id ('A', 'B' or 'C') after James chooses; the page then marks it "chosen".
export const CHOSEN = 'A';
