/* ============================================================================
   PSMA APP GUIDE — ON-SCREEN WORDS
   ----------------------------------------------------------------------------
   Every word the stage adds to the captures lives here, so the wording rules
   can be checked in one place: Australian spelling; plain words ("lesions
   found", "missed", "false alarms"); the dataset is "autoPET-III"; patients
   are only "whole-body PSMA PET/CT"; no tracer is named; no case id; no
   baseline. App names (controls, panels) are written [like this] and set in
   gold. Numbers come only from the manifest (the app's own text), never from
   these strings.
   ========================================================================== */

export const TITLE = {
  eyebrow: 'PSMA PET / CT lesion segmentation',
  title: 'Mamba PSMA',
  sub: 'How to use the app',
};

// plain names that say what each chapter covers, in title case (James, 12 Oct)
export const CHAPTERS = {
  what: { num: '01', name: 'Overview' },
  open: { num: '02', name: 'Choosing a Scan' },
  look: { num: '03', name: 'Viewer Controls' },
  run: { num: '04', name: 'Running the Model' },
  result: { num: '05', name: 'Results and Scores' },
  list: { num: '06', name: 'Lesion List' },
  nogt: { num: '07', name: 'Single Scan Input' },
  settings: { num: '08', name: 'Model Settings' },
  yours: { num: '09', name: 'Overlay Colours' },
  wrong: { num: '10', name: 'Errors and Warnings' },
};
export const N_CHAPTERS = 10;

export const CAPTIONS = {
  '1.1': 'The app runs five models on a whole-body PSMA PET/CT scan.',
  '1.2': 'It marks the lesions they find and checks them against expert outlines.',
  '2.1': 'Start with a dataset folder laid out as shown. Windows paths work.',
  '2.2': 'By default only held-out test scans are listed. No model trained on them.',
  '2.3': 'The badge says whether the models saw this scan.',
  '2.4': 'On a training scan, the scores are optimistic.',
  '3.1': 'Drag the slider through the slices. The mouse wheel and arrow keys work too.',
  '3.2': '[Plane]: axial, coronal or sagittal, each at its true proportions.',
  '3.3': '[Image]: the CT, the PET, or PET over CT. [Overlay] adds the expert outlines.',
  '3.4': '[CT window] presets: soft tissue, lung, bone, brain or your own.',
  '3.5': 'Pick a [PET colour map] and the SUV range it covers.',
  '3.6': '[3D rotation] turns the whole scan. Pause it, scrub it or change its speed.',
  '4.1': 'Press [Run model]. It needs an NVIDIA GPU.',
  '4.2': 'The status box shows each step. One run goes at a time.',
  '4.3': 'The result opens over the scan, and is saved for next time.',
  // C4: name the classes in words; the legend carries colour, shape and word together
  '5.1': 'Colours mark each lesion: found, missed or false alarm.',
  '5.2': 'A lesion counts as found if any predicted voxel overlaps it.',
  '5.3': 'The scores sum up this one scan.',
  '5.4': "Scores use the scan's own grid, so they can differ slightly from the test-set results.",
  '5.5': '[Settings used] records the run. The mask and its record download here.',
  '6.1': "The lesion list gives each lesion's status, volume, SUVmax and SUVmean.",
  '6.2': 'Tick a row and the viewer jumps to that lesion.',
  // chapter 07: a scan of your own, no ground truth (C3: the clinician's usual case, so before the settings)
  '7.1': '[Single scan] takes a CT and a PET, as NIfTI files.',
  '7.2': 'With no ground truth, [Run model] works the same.',
  '7.3': 'You get the prediction and its lesion list. Nothing is scored.',
  // chapter 08: model settings
  '8.1': '[Model settings] holds every option. [Reset to protocol] puts back the pre-registered defaults.',
  '8.2': 'Lower the threshold to find more lesions, at the cost of more false alarms.',
  '8.3': 'The new threshold and smallest lesion make a custom run, flagged and saved in its own folder.',
  '8.4': 'Tick [Save the probability map] before the run.',
  '8.5': "[Saved runs] switches between a scan's runs.",
  '8.6': "After the run, [Probability] under [Overlay] shows the models' averaged output.",
  // C2 N2: in the order the film does them; C2 N2, C3 N10: the scheme named, under a caption
  '9.1': '[Overlay colours]: outlined or filled, adjustable opacity, three schemes.',
  // viz.py: the two motion-graphics schemes use Okabe-Ito colours (C4 measured them on CT, round 2)
  '9.2': 'On CT, the two [Motion graphics] schemes are easier to tell apart with colour blindness.',
  '10.1': 'Problems are spelt out in plain English, with where to fix them.',
  '10.2': 'Swap the CT and PET by mistake, and both unit checks catch it.',
  '11.1': 'Open this guide any time with [How to use this app].',
};

// short (about six words, one line): the caption is the voice, a callout labels (C2)
export const CALLOUTS = {
  ctWindow: { text: 'Width and level, in Hounsfield units' },
  badges: { text: 'Also: New scan, No ground truth' },
  minVoxels: { text: 'Smallest lesion: also shown in mL' },
  savedTo: { text: 'Saved in outputs/gui-predictions' },
  // the app's own words (I01, I02), restated where its alert colours are too faint (C4)
  weightsFix: { text: '“Set the weights folder under Model settings”' },
  notSuv: { text: '“This does not look like SUV”' },
  // C2 S3, C3 N4: the custom run's card beside the protocol run's counts (D03's captured card)
  protocolWas: (c) => ({ text: `Protocol run: ${c.found} found, ${c.missed} missed, ${c.falseAlarm} false alarms` }),
  found: { text: '✓ Found' },
  missed: { text: '○ Missed' },
  falseAlarm: { text: '✕ False alarm' },
};

// chapter 5: the app's own comparison colours (looks.js LOOK.overlay)
export const LEGEND = { found: 'Found', missed: 'Missed', falseAlarm: 'False alarm' };

// chapter 5: each score in a few words (evaluation/metrics.py, any-overlap rule), in the card's
// order; each row also shows the card's own value (C4), passed in from the captured card text
export const DEFS = [
  { key: 'f1', name: 'Lesion F1', text: '2 × found ÷ (2 × found + missed + false alarms)' },
  { key: 'sensitivity', name: 'Sensitivity', text: 'found ÷ (found + missed)' },
  { key: 'ppv', name: 'PPV', text: 'found ÷ (found + false alarms)' },
  { key: 'dice', name: 'Voxel Dice', text: '2 × shared voxels ÷ (predicted + expert voxels)' },
];
export const COUNTS = { found: 'found', missed: 'missed', falseAlarm: 'false alarms' };

// the model run, time-compressed: "Sped up 8× · the run took 50 s on an RTX 5070 Ti"
export const TAG = { sped: 'Sped up', took: 'the run took', unit: 's', on: 'on an' };

// licence: CC BY 4.0 with the data citation the TCIA collection page requires
export const CLOSE = {
  group: 'UWA Medical Physics Research Group',
  data: 'Scans: autoPET-III PSMA data, Jeblick et al. (2026), The Cancer Imaging Archive, doi.org/10.7937/R7EP-3X37, CC BY 4.0',
  disclaimer: 'Research software, not a medical device.',
};
