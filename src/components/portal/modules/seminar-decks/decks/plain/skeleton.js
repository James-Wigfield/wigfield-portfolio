/* ============================================================================
   PLAIN DECK — SKELETON (pure data; draft 1, 13 Oct 2026)
   ----------------------------------------------------------------------------
   One entry per main slide, in the dissertation's order. Each slide has:
     section   the part of the talk it belongs to
     title     what the slide says (at most 12 words)
     purpose   why the slide exists, in one line
     points    two or three talking points: James speaks to them in his own
               words (the unit allows AI for design, not content)
     numbers   the values the slide uses, each through a {{key}} in
               shared/facts.js, so every digit traces to a source
     visual    the planned visual, as a placeholder (visuals come last)
     seconds   target time; the whole talk aims at 12:00, hard cap 15:00
     said      (once approved) the transcript James reads, from his own
               dictation, tidied only for fillers, grammar and facts
     saidSecs  how long that took him when he timed it

   Steer-clear list (agreed 13 Oct; from Jake's notes S9 and S10 in
   documents/drafting/revision-guide.html and the final-week handovers):
   - Never mention what the proposal planned and the project did not do: SCGH
     data as this project's data, pure 3D Mamba against the hybrid, a loss
     comparison, biomarkers, Mamba-2, linking the primary tumour to its
     metastases, "a clinically actionable tool", the proposal's three aims.
   - Never say "the proposal", "planned", "targets", "premise", "not enough
     time", or H1 to H4. State only the two research questions of chapter 1.
   - Mamba's selection is explained in general, never claimed as what it does
     on these scans.
   - The 2022 cascade's figures are background only, never beside this
     project's numbers.
   - PSMASegmentator: open-source, UWA Medical Physics Research Group, nnU-Net,
     trained on 1,035 cases including every autoPET-III study. Labels start
     from an SUV threshold, then expert correction; never "hand-drawn".
     Run 4 is "the autoPET-only hybrid". SCGH only as the next step, and never
     as unseen by PSMASegmentator.
   ========================================================================== */

export const SKELETON = [
  {
    id: 'title',
    section: 'Title',
    title: 'Title',
    purpose: 'Who is speaking and what the talk is about.',
    points: [
      'Name, supervisors, UWA Medical Physics Research Group',
      'One line: teaching a network to find prostate cancer that has spread, in whole-body PET scans',
    ],
    numbers: [],
    visual: 'Title, name, supervisors, logo',
    seconds: 20,
    said: "Hello everyone, thank you all for coming. My name is James Wigfield, and this project has been about training a hybrid CNN-Mamba architecture to segment metastatic prostate cancer in whole-body PSMA PET scans. I'd like to thank my supervisors, Dr Jake Kendrick and Dr Mubashar Hassan, for their help throughout this project.",
    saidSecs: 30,
  },
  {
    id: 'background',
    section: 'Background',
    title: 'Prostate cancer can spread, and PSMA PET/CT shows where',
    purpose: 'Just enough medicine for a computing audience to follow the rest.',
    points: [
      'Prostate cancer is common; when it relapses it can spread, and survival falls',
      'PSMA is a protein on prostate cancer cells, and a radioactive tracer sticks to it',
      'PET shows where the tracer gathers and CT shows the anatomy; lesions light up, but so do healthy organs',
    ],
    numbers: [
      '{{lit.recurrence}} of patients relapse after treatment',
      'five-year survival {{lit.survival}} or less once it has spread',
    ],
    visual: 'One whole-body PSMA PET scan: lesions outlined, kidneys and salivary glands labelled',
    seconds: 80,
    said: "Prostate cancer is the second most common solid tumour in men worldwide, and once it spreads, the five-year survival rate drops to {{lit.survival}} or less. Finding the lesions is important, since the number of lesions and their location influence the treatment plan. PSMA stands for prostate-specific membrane antigen. It is a protein that is overexpressed on prostate cancer cells. A radioactive tracer that binds to PSMA is injected, and the PET scan shows where it collects. That is then paired with the CT scan, which shows the anatomy of the patient. PSMA PET/CT is the standard scan for finding where the disease has gone. Lesions show up on the scan, but so do some healthy organs, such as the kidneys, salivary glands and liver, which take up the tracer normally. The challenge is to then train a model to find the lesions, but not get confused by normal uptake. That means it must be able to see the surrounding anatomy.",
    saidSecs: 95,
  },
  {
    id: 'problem',
    section: 'The problem',
    title: 'Outlining every lesion by hand is slow, and experts disagree',
    purpose: 'State the problem early and simply.',
    points: [
      'Treatment depends on where the lesions are and how many there are',
      'Outlining each one by hand is labour-intensive, worst in patients with the most disease',
      'Experts disagree, so any automatic method is scored against an imperfect reference',
    ],
    numbers: [
      'a second expert on {{lit.obs_scans}} scans: outlines overlapped at Dice {{lit.obs_dsc_round}}',
      "the second expert found {{lit.obs_found}} of the first expert's lesions",
    ],
    visual: 'The same scan with its many small lesions marked; two overlapping outlines shaded, "Dice 33%" beside an identical pair, "100%"',
    seconds: 40,
    said: "Outlining the lesions in these scans manually is an extremely labour-intensive task. Some scans can have over {{fair.ge100_cut}} lesions, and the experts also disagree. In a 2022 study led by my supervisor, Dr Jake Kendrick, two experts independently outlined the same {{lit.obs_scans}} scans. On average, their outlines overlapped with a Dice score of only {{lit.obs_dsc_round}}, where {{dice.identical}} would mean identical outlines. The second expert found about {{lit.obs_found_speech}} of the first expert's lesions. So automation reduces the manual work, but any automated method is still scored against these imperfect outlines. There's already a tool that does this, called PSMASegmentator.",
    saidSecs: 58,
  },
  {
    id: 'baselines',
    section: 'Baselines',
    title: 'PSMASegmentator is the tool to beat',
    purpose: 'Show what already exists and the gap it leaves.',
    points: [
      'PSMASegmentator: an open-source tool from the UWA Medical Physics Research Group, built on nnU-Net, a self-configuring CNN',
      "Before it, the group's 2022 two-stage nnU-Net cascade (Kendrick et al.), as context only",
      'The gap: a 3D CNN reads the body one window at a time, and GPU memory caps the window size',
    ],
    numbers: [
      'PSMASegmentator trained on {{psm.train}} scans, including every autoPET-III scan',
      'the 2022 cascade found {{k22.sens}} of lesions on its own test set',
    ],
    visual: 'Whole-body scan with one PSMASegmentator window drawn to scale',
    seconds: 60,
    said: "PSMASegmentator is an open-source tool developed by Joel Noble, who is a PhD student at the UWA Medical Physics Research Group. It was built using the nnU-Net framework, which is a CNN framework that configures itself to any new dataset. It's been trained on {{psm.train}} cases. However, one limit of 3D CNNs is that they can't see the entire scan at once, because GPU memory limits how big their patch, or window, can be. So that's where Mamba might be able to help.",
    saidSecs: 40,
  },
  {
    id: 'mamba',
    section: 'Mamba',
    title: 'Mamba reads long sequences at linear cost',
    purpose: 'Mamba in one idea, why it might help, and why that needs testing.',
    points: [
      'Mamba (2023) reads a sequence once, in order, keeping a small memory and choosing what to keep',
      'Its cost grows linearly with length; attention compares every pair, so its cost grows with the square',
      "Hoped-for benefit: more of the scan per window for the same memory. Caution: a retest found U-Mamba's Mamba layers added nothing",
    ],
    numbers: [],
    visual: "Tokens read once in a line, against attention's every-pair web",
    seconds: 50,
    said: "Mamba reads a sequence one step at a time, carrying a fixed-size memory as it goes. It is selective, which means it chooses what to keep from each input and what to ignore. It was originally built for long sequences like text, which means for a 3D scan, the image features are flattened into a long 1D sequence. The idea is that it could help because it can view across the whole patch, while its cost grows linearly with sequence length. That could free memory for a bigger patch. That is exactly what I set out to test.",
    saidSecs: 50,
  },
  {
    id: 'question',
    section: 'My work',
    title: 'The research question has two parts',
    purpose: 'State exactly what was tested, as the introduction words it.',
    points: [
      'Does a hybrid CNN-Mamba network find lesions better than PSMASegmentator on scans neither model trained on?',
      'Do its Mamba blocks add anything over a CNN-only twin without them?',
    ],
    numbers: [],
    visual: 'Text only',
    seconds: 20,
  },
  {
    id: 'architecture',
    section: 'My model',
    title: 'Convolutions near the pixels, Mamba only in the deepest stages',
    purpose: 'Show the network and why Mamba sits where it does.',
    points: [
      'A U-shaped encoder-decoder: PET and CT in, a lesion mask out',
      'Convolutions in the shallow stages, where detail is fine; Mamba blocks only in the deepest {{net.mamba_stages}}, where sequences are short enough',
      'Each Mamba block reads its tokens in {{net.dirs}} directions, forwards and backwards along each axis',
    ],
    numbers: [
      '{{net.stages}} stages, {{net.params}} parameters',
      'up to {{net.tok3}} tokens per Mamba block',
    ],
    visual: 'The architecture figure from the dissertation, revealed stage by stage',
    seconds: 70,
  },
  {
    id: 'design',
    section: 'My model',
    title: 'Three design decisions shaped the final model',
    purpose: 'The choices that made the model work, each with its reason.',
    points: [
      'Organ head: a second output learns anatomy during training only, so the network learns what normal uptake looks like',
      'Loss: a recall-weighted loss found lesions but raised too many false alarms, so later runs used Dice',
      'Final model: the {{inf.models}} cross-validation models average their predictions, and tiny specks are removed',
    ],
    numbers: [
      '{{organ.structures}} anatomical structures',
      'false alarms on {{organ.neg}} lesion-free validation scans: {{organ.fc3}} before the organ head, {{organ.fc4}} after',
      'early runs: only {{run2.ppv}} of predictions were real lesions (old scoring rule)',
      'threshold {{inf.thr}}; specks under {{inf.minvox}} voxels removed',
    ],
    visual: 'The architecture figure with the organ head highlighted',
    seconds: 60,
  },
  {
    id: 'tested',
    section: 'How I tested it',
    title: 'Public scans, a sealed test set and a CNN-only twin',
    purpose: 'Give the numbers that follow their meaning.',
    points: [
      'Two public cohorts, autoPET-III and DEEP-PSMA; labels start from an SUV threshold, then an expert corrects them',
      'A test set sealed away and scored once, under rules written in advance; the rest split into folds for cross-validation',
      'A lesion counts as found if the prediction touches it; F1 balances lesions found against false alarms',
    ],
    numbers: [
      '{{data.total}} scans: {{data.autopet}} autoPET-III and {{data.deeppsma}} DEEP-PSMA',
      '{{data.test}} sealed test scans; {{data.pool}} in {{data.folds}} folds',
    ],
    visual: 'Scan tiles: the sealed test set put aside, the rest in folds',
    seconds: 60,
  },
  {
    id: 'results-test',
    section: 'Results',
    title: 'On the sealed test set, the ensemble scored F1 {{r5.f1}}',
    purpose: 'The headline result, on scans held back to the end.',
    points: [
      'Scored once, on scans no model had trained on',
      'Same F1 on both cohorts, but a different trade: autoPET-III found more, DEEP-PSMA was more precise',
      'It trained on both cohorts, so it is not compared with PSMASegmentator here',
    ],
    numbers: [
      'F1 {{r5.f1}}, precision {{r5.ppv}}, sensitivity {{r5.sens}}, Dice {{r5.dsc}} over {{data.test}} scans',
      'autoPET-III sensitivity {{r5.ap_sens}}; DEEP-PSMA precision {{r5.dp_ppv}}',
    ],
    visual: 'One test scan: found, missed and false alarm in three colours',
    seconds: 60,
  },
  {
    id: 'results-fair',
    section: 'Results',
    title: 'On unseen scans, run 4 beat PSMASegmentator by finding more lesions',
    purpose: 'The fair head-to-head: the first research question.',
    points: [
      'Run 4, the autoPET-only hybrid, against PSMASegmentator on DEEP-PSMA scans neither model trained on',
      'Higher pooled F1: it found more lesions, at the cost of more false alarms',
      'Per scan, no clear difference: run 4 did better on scans with many lesions, worse on scans with few',
    ],
    numbers: [
      '{{fair.n}} scans; pooled F1 {{fair.r4_f1}} against {{fair.psm_f1}}, {{fair.df1}} points ({{fair.df1_lo}} to {{fair.df1_hi}})',
      'sensitivity {{fair.dsens}} points, precision {{fair.dppv}} points',
      'per-scan F1 {{fair.pc_df1}} points ({{fair.pc_lo}} to {{fair.pc_hi}})',
    ],
    visual: 'Pooled bars, then one dot per scan',
    seconds: 60,
  },
  {
    id: 'results-twin',
    section: 'Results',
    title: 'The CNN-only twin did as well, so Mamba takes no credit',
    purpose: 'The second research question: is Mamba the reason?',
    points: [
      'Run 6: the hybrid and its twin, each trained with a small and a large window',
      'The larger window hurt the hybrid far more than the twin, the opposite of the hoped-for benefit',
      'The twin also beat PSMASegmentator, and at equal passes the hybrid was no faster on average and no lighter',
    ],
    numbers: [
      'larger window: hybrid {{r6.h_patch}}, twin {{r6.c_patch}} F1 points; difference {{r6.inter}} ({{r6.inter_lo}} to {{r6.inter_hi}})',
      'twin F1 {{r6.c_small}} against PSMASegmentator {{fair.psm_f1}}',
      'time {{eff.h5}} against {{eff.p5}} per scan; memory {{eff.vram_h}} against {{eff.vram_p}}',
    ],
    visual: 'A two-by-two chart: the hybrid drops, the twin barely moves',
    seconds: 50,
  },
  {
    id: 'discussion',
    section: 'Discussion',
    title: 'The gain over PSMASegmentator is real, but not from Mamba',
    purpose: 'What the results mean, and their limits.',
    points: [
      'The hybrid traded false alarms for found lesions, and its CNN-only twin did as well',
      "Mamba's linear cost did not free memory: the large window still forced batch size {{r6.batch_large}} for both networks",
      'Limits: not like-for-like with PSMASegmentator, two label styles, one training run per cell, few lesion-free test scans',
    ],
    numbers: [
      '{{data.test_neg}} lesion-free scans in the test set',
    ],
    visual: 'Text only, or the two-by-two again',
    seconds: 60,
  },
  {
    id: 'close',
    section: 'Conclusion',
    title: 'Take-home: the hybrid finds lesions well, but Mamba is not why',
    purpose: 'One message to leave with, the next step, then questions.',
    points: [
      'The ensemble reached F1 {{r5.f1}} on a sealed test set',
      'On unseen scans, run 4 beat PSMASegmentator in pooled F1, and the CNN-only twin did as well',
      'Next step: retrain and score it on the Sir Charles Gairdner Hospital cohort',
    ],
    numbers: [],
    visual: 'Thank you and questions; optionally a short clip of the app running the model',
    seconds: 30,
  },
];
