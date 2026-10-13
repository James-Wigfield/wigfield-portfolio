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
     req       (draft slides) per point, a gate G7 mark: 'limitations', 'future'

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
    visual: 'Built: title, name, supervisors and logo, with a brief entrance',
    seconds: 20,
    said: "Hello everyone, thank you all for coming. My name is James Wigfield, and this project has been about training a hybrid CNN-Mamba architecture to segment metastatic prostate cancer in whole-body PSMA PET scans. I'd like to thank my supervisors, Dr Jake Kendrick and Dr Mubashar Hassan, for their help throughout this project.",
    saidSecs: 30,
  },
  {
    id: 'background',
    section: 'Background',
    title: 'Metastatic Prostate Cancer and PSMA PET/CT',
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
    visual: 'Built: the survival figure; a cell with PSMA, then the tracer binding; PET, then CT beside it, then the two fused; lesion outlines; salivary glands, liver and kidney; a ring for the surrounding anatomy',
    seconds: 80,
    said: "Prostate cancer is the second most common solid tumour in men worldwide, and once it spreads, the five-year survival rate drops to {{lit.survival}} or less. Finding the lesions is important, since the number of lesions and their location influence the treatment plan. PSMA stands for prostate-specific membrane antigen. It is a protein that is overexpressed on prostate cancer cells. A radioactive tracer that binds to PSMA is injected, and the PET scan shows where it collects. That is then paired with the CT scan, which shows the anatomy of the patient. PSMA PET/CT is the standard scan for finding where the disease has gone. Lesions show up on the scan, but so do some healthy organs, such as the kidneys, salivary glands and liver, which take up the tracer normally. The challenge is to then train a model to find the lesions, but not get confused by normal uptake. That means it must be able to see the surrounding anatomy.",
    saidSecs: 95,
  },
  {
    id: 'problem',
    section: 'The problem',
    title: 'Manual Outlining and Expert Agreement',
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
    visual: 'Built: a scan from this project with over {{fair.ge100_cut}} outlined lesions; the 2022 study apart on the right: the Dice pair, the identical pair, then ten lesion markers with seven found',
    seconds: 40,
    said: "Outlining the lesions in these scans manually is an extremely labour-intensive task. Some scans can have over {{fair.ge100_cut}} lesions, and the experts also disagree. In a 2022 study led by my supervisor, Dr Jake Kendrick, two experts independently outlined the same {{lit.obs_scans}} scans. On average, their outlines overlapped with a Dice score of only {{lit.obs_dsc_round}}, where {{dice.identical}} would mean identical outlines. The second expert found about {{lit.obs_found_speech}} of the first expert's lesions. So automation reduces the manual work, but any automated method is still scored against these imperfect outlines. There's already a tool that does this, called PSMASegmentator.",
    saidSecs: 58,
  },
  {
    id: 'baselines',
    section: 'Baselines',
    title: 'PSMASegmentator and the Patch Size Limit',
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
    visual: "Built: the name and lines in step with the transcript; PSMASegmentator's patch to scale with the rest dimmed, then it steps down the body",
    seconds: 60,
    said: "PSMASegmentator is an open-source tool developed by Joel Noble, who is a PhD student at the UWA Medical Physics Research Group. It was built using the nnU-Net framework, which is a CNN framework that configures itself to any new dataset. It's been trained on {{psm.train}} cases. However, one limit of 3D CNNs is that they can't see the entire scan at once, because GPU memory limits how big their patch, or window, can be. So that's where Mamba might be able to help.",
    saidSecs: 40,
  },
  {
    id: 'mamba',
    section: 'Mamba',
    title: 'Mamba, a Selective State Space Model',
    purpose: 'Mamba in one idea, why it might help, and why that needs testing.',
    points: [
      'Mamba (2023) reads a sequence once, in order, keeping a small memory and choosing what to keep',
      'Its cost grows linearly with length; attention compares every pair, so its cost grows with the square',
      "Hoped-for benefit: more of the scan per window for the same memory. Caution: a retest found U-Mamba's Mamba layers added nothing",
    ],
    numbers: [],
    visual: 'Built: memory hops along a short sequence, keeping or ignoring each input; a 3D feature block flattens into a long sequence; the memory sweeps it; a linear cost line; a dashed bigger patch',
    seconds: 50,
    said: "Mamba reads a sequence one step at a time, carrying a fixed-size memory as it goes. It is selective, which means it chooses what to keep from each input and what to ignore. It was originally built for long sequences like text, which means for a 3D scan, the image features are flattened into a long 1D sequence. The idea is that it could help because it can view across the whole patch, while its cost grows linearly with sequence length. That could free memory for a bigger patch. That is exactly what I set out to test.",
    saidSecs: 50,
  },
  {
    id: 'question',
    section: 'My work',
    title: 'Research Question',
    purpose: 'State exactly what was tested, as the introduction words it.',
    points: [
      'Whether a hybrid CNN-Mamba network detects lesions better than PSMASegmentator on cases neither model trained on',
      'Whether its Mamba blocks improve lesion detection over a CNN-only version of the same network',
    ],
    numbers: [],
    visual: 'Built: the two questions in the transcript\'s words, each with its pair of models (the hybrid against PSMASegmentator; the hybrid against its CNN-only version)',
    seconds: 20,
    said: "So my research question has two parts. Does a hybrid CNN-Mamba network find lesions more effectively than PSMASegmentator on scans that neither of them was trained on? And do the Mamba blocks really improve lesion detection, compared with a CNN-only version of the same network?",
    saidSecs: 25,
  },
  {
    id: 'architecture',
    section: 'My model',
    title: 'Hybrid CNN-Mamba Network Architecture',
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
    visual: "Built: the dissertation's architecture figure assembled in layers (no patch or sequence sizes); flattened sequence length per stage, to scale; six reading directions, summed (schematic)",
    seconds: 70,
    said: "So what I've decided to build is a U-shaped encoder-decoder with skip connections. The encoder downsamples the scan in five stages, and the decoder upsamples the scan back to its full size. The input has two channels, the CT and the PET scan, and the output is a lesion score for every voxel, a voxel being a volumetric pixel. Convolutions run in every stage, but the Mamba blocks sit only in the three deepest stages, where the flattened sequences are shortest. Each stage makes the sequence about eight times shorter, so Mamba is cheap to run there. Each Mamba block reads the features in six directions: up, down, left, right, front and back. So every point gets information from every side.",
    saidSecs: 60,
  },
  {
    id: 'design',
    section: 'My model',
    title: 'Organ Head and Five-Model Ensemble',
    purpose: 'The choices that made the model work, each with its reason.',
    points: [
      'Organ head: a second output learns anatomy during training only, so the network learns what normal uptake looks like',
      'Final model: an ensemble of {{inf.models}} versions, each trained on a different portion of the data, averaged voxel by voxel; predicted lesions under {{inf.minvox}} voxels removed',
    ],
    numbers: [
      '{{organ.structures}} anatomical structures',
      'false alarms on {{organ.neg}} lesion-free scans: {{organ.fc3}} before the organ head, {{organ.fc4}} after',
      'threshold {{inf.thr}}; predicted lesions under {{inf.minvox}} voxels removed',
    ],
    visual: "Built: the network carries over and its organ head comes forward; the scans with no lesions, all flagged, and their false alarms as a count; normal uptake on the scan of slide two; five versions of the network",
    seconds: 60,
    said: "An earlier version flagged lesions in all {{organ.neg}} scans that had no lesions at all. The false alarms were typically in organs with normal physiological uptake, such as the kidneys and salivary glands. So, following PSMASegmentator's training recipe, which also learns organs, I added a second output to the network that learns to outline {{organ.structures}} anatomical structures. It's used during training only. With nothing else changed, false alarms on those {{organ.neg}} scans fell from {{organ.fc3}} to {{organ.fc4}}. For the final model, I trained an ensemble of {{inf.models}} versions of this network, each on a different portion of the data, and averaged their predictions voxel by voxel. Any predicted lesion smaller than {{inf.minvox}} voxels is then removed.",
    saidSecs: 70,
  },
  {
    id: 'tested',
    section: 'How I tested it',
    title: 'Datasets, Test Set and Scoring',
    purpose: 'Give the numbers that follow their meaning.',
    points: [
      'Two public cohorts, autoPET-III and DEEP-PSMA; both start from an SUV threshold, then autoPET-III is corrected by an expert and DEEP-PSMA has normal uptake removed',
      'A test set sealed away, never trained on and scored once; the rest split into folds for cross-validation',
      'My model and PSMASegmentator scored by the same script; a lesion counts as found if the prediction touches it; F1 balances lesions found against false alarms',
    ],
    numbers: [
      '{{data.total}} scans: {{data.autopet}} autoPET-III and {{data.deeppsma}} DEEP-PSMA',
      '{{data.test}} sealed test scans; {{data.pool}} in {{data.folds}} folds',
    ],
    visual: 'Built: one tile per scan; the sealed test set put aside, the rest in five folds with their real mix; one scoring script; a lesion touched by a prediction ("found") beside a stray prediction ("false alarm"), schematic',
    seconds: 60,
    said: "Two public datasets were used. The first is autoPET-III: {{data.autopet}} scans, {{data.autopet_neg}} of which have no lesions at all. Its labels came from an SUV threshold, then were corrected by an expert. The second is DEEP-PSMA: {{data.deeppsma}} scans from patients with advanced disease, so every scan has lesions. Its labels also came from an SUV threshold, with normal uptake removed by a physician. For testing, {{data.test}} scans were sealed away, never trained on and only scored once. The rest went into {{data.folds}}-fold cross-validation, which gave the {{inf.models}} versions in the ensemble. For scoring, my model and PSMASegmentator used the same script. A lesion counts as found if any predicted voxel touches it. F1 balances lesions found against false alarms, and Dice shows how well the outlines match.",
    saidSecs: 70,
  },
  {
    id: 'results-test',
    section: 'Results',
    title: 'Results on the Sealed Test Set',
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
    visual: "Built: the qualitative figure's DEEP-PSMA test scan with found, missed and false alarm in its three colours; the headline numbers; the two cohorts' bars (cohort numbers on screen only)",
    seconds: 60,
    said: "So, how did the final ensemble model do? On the sealed test set, the ensemble scored an F1 of {{r5.f1}}. It found {{r5.found_round}} of the lesions, and {{r5.prec_round}} of what it flagged were real lesions, with a Dice of {{r5.dsc}}. The F1 was the same on both datasets, but the balance was different. On autoPET, it found more of the lesions, but raised more false alarms. On DEEP-PSMA, it was the other way round: almost everything it flagged was real, but it missed more lesions. And PSMASegmentator was actually trained on the autoPET test scans, and my model was trained on most of DEEP-PSMA, so neither dataset here could give a fair comparison. For that, I needed scans that neither model had seen.",
    saidSecs: 67,
  },
  {
    id: 'results-fair',
    section: 'Results',
    title: 'On unseen scans, the autoPET-only hybrid beat PSMASegmentator by finding more lesions',
    purpose: 'The fair head-to-head: the first research question.',
    points: [
      'A single version of the model, trained only on autoPET-III, against PSMASegmentator on the DEEP-PSMA scans neither model trained on',
      'Higher pooled F1, despite most of the setup favouring PSMASegmentator; it found more lesions, at the cost of more false alarms',
      'Per scan, mixed: better on scans with many lesions, worse on scans with few',
    ],
    numbers: [
      '{{fair.n}} scans; pooled F1 {{fair.r4_f1}} against {{fair.psm_f1}}, {{fair.df1}} points ({{fair.df1_lo}} to {{fair.df1_hi}})',
      'sensitivity {{fair.dsens}} points, precision {{fair.dppv}} points',
      'per-scan F1 {{fair.pc_df1}} points ({{fair.pc_lo}} to {{fair.pc_hi}})',
    ],
    visual: 'Pooled bars, then one dot per scan',
    seconds: 60,
    said: "So I took a single version of my model, trained only on autoPET, and scored it against PSMASegmentator on all {{fair.n}} DEEP-PSMA scans, which neither model had seen. My model scored an F1 of {{fair.r4_f1}}, against {{fair.psm_f1}} for PSMASegmentator, so about three points higher. And that's despite most of the setup favouring PSMASegmentator: it was trained on more than twice as many scans, and averages five models, against my one. My model found more of the lesions, but raised more false alarms. Scan by scan, it was mixed: better on scans with many lesions, worse on scans with few. But overall, my model found lesions more effectively. So, is that down to Mamba?",
    saidSecs: 65,
  },
  {
    id: 'results-twin',
    section: 'Results',
    title: 'The CNN-only version did as well, so Mamba takes no credit',
    purpose: 'The second research question: is Mamba the reason?',
    points: [
      'The hybrid and its CNN-only version (every Mamba block removed), both trained only on autoPET-III, each at the final model\'s patch and at a patch almost five times larger',
      'At the smaller patch the Mamba blocks added little; the CNN-only version also scored above PSMASegmentator, so the gain is not credited to Mamba',
      'On DEEP-PSMA the larger patch hurt the hybrid far more than the CNN-only version, the opposite of what was expected',
    ],
    numbers: [
      'smaller patch, hybrid minus CNN-only: {{r6.gap_small_dp}} on DEEP-PSMA (no clear effect), {{r6.gap_small_ap}} on autoPET-III',
      'CNN-only F1 {{r6.c_small}} against PSMASegmentator {{fair.psm_f1}}',
      'larger patch: hybrid {{r6.h_patch}}, CNN-only {{r6.c_patch}} F1 points; difference {{r6.inter}} ({{r6.inter_lo}} to {{r6.inter_hi}})',
    ],
    visual: 'A two-by-two chart: the hybrid drops, the CNN-only version barely moves',
    seconds: 50,
    said: "To answer the second question, I trained the same network without its Mamba blocks, a CNN-only version, also trained only on autoPET. I trained both at the final model's patch size, and at a patch almost five times larger. At the smaller patch, the Mamba blocks added little: there was no clear difference on DEEP-PSMA, and a gain of under two points on autoPET. And the CNN-only version also scored above PSMASegmentator on DEEP-PSMA, {{r6.c_small}}% against {{fair.psm_f1}}, so the gain over PSMASegmentator can't be credited to Mamba specifically. The larger patch was where Mamba was meant to help. Instead, on the unseen DEEP-PSMA scans, it cost the hybrid about four and a half F1 points, and the CNN-only version only about one: the opposite of what I'd expected. So what does this really mean?",
    saidSecs: 75,
  },
  {
    id: 'discussion',
    section: 'Discussion',
    title: 'The gain over PSMASegmentator is real, but not from Mamba',
    purpose: 'What the results mean, and their limits.',
    points: [
      'The gain over PSMASegmentator most likely comes from something both networks share, not Mamba; a {{lit.umamba_year}} retest of U-Mamba found the same',
      "Mamba's linear cost did not pay off: the larger patch still forced batch size {{r6.batch_large}} for both networks, and at the same number of passes PSMASegmentator was slightly faster and lighter",
      'Limits: one training run per model in the CNN-only comparison, a smaller CNN-only version, not like-for-like with PSMASegmentator',
    ],
    req: [null, null, 'limitations'],
    numbers: [
      'default settings: {{eff.h5}} against {{eff.p40}} per scan; same passes: {{eff.h5}} against {{eff.p5}}; peak memory {{eff.vram_h}} against {{eff.vram_p}}',
    ],
    visual: "The Mamba slide's memory chip over a sequence that stretches; the U-Mamba citation; the timing pair; the three limits as short labels",
    seconds: 60,
    // DRAFT (13 Oct, night): written by Claude from the fact sheet for James to read in the
    // morning. Not yet read aloud or timed by James, so no saidSecs.
    said: "It means the gain over PSMASegmentator is real, but it most likely comes from something both of my networks share, not from Mamba. A {{lit.umamba_year}} retest of U-Mamba, another Mamba network, found the same: its Mamba layers had no effect once it was compared with a strong CNN. Mamba's linear cost also didn't pay off in practice. The larger patch still forced a batch size of one. My abstract says my model takes about half PSMASegmentator's time per scan, but that's only because PSMASegmentator runs test-time augmentation, with eight times as many passes. With the same number of passes, PSMASegmentator was slightly faster, and used slightly less memory. The main limits are that each model in the CNN-only comparison was trained only once, and the comparison with PSMASegmentator isn't like-for-like.",
  },
  {
    id: 'close',
    section: 'Conclusion',
    title: 'Take-home: the hybrid finds lesions well, but Mamba is not why',
    purpose: 'One message to leave with, the next step, then questions.',
    points: [
      'The ensemble reached F1 {{r5.f1}} on a sealed test set',
      'On unseen scans, the autoPET-only hybrid beat PSMASegmentator in pooled F1, and the CNN-only version did about as well',
      'Next step: the code released open source, so the UWA Medical Physics Research Group can retrain and score it on the Sir Charles Gairdner Hospital cohort',
    ],
    req: [null, null, 'future'],
    numbers: [],
    visual: 'Thank you and questions; optionally a short clip of the app running the model',
    seconds: 30,
    // DRAFT (13 Oct, night): written by Claude for James to read in the morning. Not yet read
    // aloud or timed by James, so no saidSecs.
    said: "To wrap up: on the sealed test set, my final model scored an F1 of {{r5.f1}}. On scans neither model had seen, my network found lesions more effectively than PSMASegmentator overall, but a CNN-only version did about as well, so the credit doesn't go to Mamba. Next, the code will be released open source, so the UWA Medical Physics Research Group can retrain and test it on Sir Charles Gairdner Hospital data. Thank you, and I'm happy to take any questions.",
  },
];
