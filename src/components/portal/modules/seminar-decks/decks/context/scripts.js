/* ============================================================================
   DECK 3 (context) — TRANSCRIPTS AND PRESENTER CUES
   ----------------------------------------------------------------------------
   One entry per main slide, read aloud by James. Numbers only as {{keys}}
   (shared/facts.js); cues in [SQUARE BRACKETS] are never spoken; exactly one
   [[cut]] ... [[/cut]] sentence per slide, and every cut is slack (nothing a
   claim depends on). `seconds` is the slide's target, `silent` the clip or
   countdown time that plays without narration. Cue lines carry no digits
   (gate G1 reads them). Every claim is from chapters 1 to 6 at Chapter 5's
   strength. Revised 13 Oct after the four critic reports.
   ========================================================================== */

export const SCRIPTS = {
  title: {
    seconds: 22,
    text: "Hi everyone, I'm James. My project uses a hybrid network, made of convolutions and a newer layer called Mamba, to find prostate cancer in whole-body PET scans. My supervisors are Jake Kendrick and Mubashar Hassan. My talk asks one question: how much of the body does a model need to see?",
  },
  spot: {
    seconds: 98,
    silent: 9,
    text: "Here's a whole-body PSMA PET/CT scan. PSMA is a protein that prostate cancer cells carry in large amounts. The PET shows where a radioactive tracer that binds to it has collected, and the CT shows the anatomy. When the cancer spreads, it forms lesions: small spots of disease scattered through the body. [CLICK] You've got five seconds. See how many you can spot. [PAUSE WHILE THE COUNTDOWN RUNS] [CLICK] [CLIP PLAYS, {{clip.a4}}, keep talking] There are {{a.gt}}, each marked in the reference labels, which were drawn from a threshold and corrected by an expert. The blue is my model's output; more on that later. [CLICK] Outlining every lesion like this is called segmentation, and by hand it's slow. Experts also disagree. When a second observer re-outlined {{lit.obs_scans}} scans, the two sets of outlines overlapped by only {{lit.obs_dsc_round}} on average. That overlap score is called Dice. [CLICK] Here's the talk in one breath. Healthy organs glow too, so context matters. Mamba might let a network see more of it. My network adds Mamba to its three deepest stages, with an organ task beside it. On {{data.total}} scans, with {{data.test}} held out, it found {{r5.found_round}} of lesions, which is its sensitivity. And {{r5.prec_round}} of what it flagged was real, which is its precision. [[cut]]Then comes a twist.[[/cut]]",
  },
  context: {
    seconds: 46,
    text: "Up close, this is just a hot spot. Is it cancer? [CLICK] Pull back, and it's the bladder, with lesions sitting right next to it. PSMA tracers also collect in healthy organs: the salivary glands, liver, spleen and kidneys, and the bladder, where the tracer drains out. [[cut]]Urine in the bladder can even hide small lesions near the prostate.[[/cut]] So brightness alone doesn't make a lesion. You need to know where you are in the body. [CLICK] A winning autoPET-III team made the same argument: telling disease from normal uptake needs the surrounding anatomy. That's the problem my organ task tackles later.",
  },
  window: {
    seconds: 76,
    text: "The standard tool is nnU-Net. It's a convolutional neural network, or CNN, that configures itself to each new dataset. A convolution looks at a small patch of nearby voxels, which are 3D pixels, and its view widens layer by layer. A whole-body scan is too big to process at once, so the network reads it one 3D window at a time. The dashed box is the window of PSMASegmentator, a later nnU-Net model, drawn to scale on this patient. [CLICK] A bigger window gives more context, but GPU memory, the memory on the graphics card, caps it. A bigger window means a smaller batch, which is how many windows it trains on at once, or a shallower network. [CLICK] The 2022 nnU-Net cascade from Kendrick and colleagues is where this project started. On its own {{k22.test}} test scans, its precision was {{k22.ppv}} and it found {{k22.sens}} of lesions. That's a different test set, so I only use those figures as context. [[cut]]Its authors named sensitivity as the thing to improve.[[/cut]]",
  },
  bet: {
    seconds: 68,
    text: "Mamba is a newer kind of sequence model. Attention, the core of a transformer, compares every position in a sequence with every other one. So its cost grows with the square of the length. Mamba makes one pass with a small running memory, so its cost grows linearly. My proposal's bet was that this would let a hybrid train on bigger windows than nnU-Net, and so see more context. [CLICK] When another group switched off the Mamba layers in U-Mamba, the results didn't change. So any claim for Mamba needs a twin: the same network with the Mamba blocks taken out. [CLICK] That gives my research question. [PAUSE] It has two parts. Is the hybrid better than PSMASegmentator on scans neither has seen? And if it is, is the reason Mamba, or would the twin do just as well? [CLICK] I tested four hypotheses, on detection, the loss, speed and context. [[cut]]I'll give the verdicts at the end.[[/cut]]",
  },
  inside: {
    seconds: 62,
    text: "Here's my window on the same patient. It's {{patch.win_cm_w}} wide and {{patch.win_cm_h}} tall, smaller than PSMASegmentator's, because it was the largest that fitted my development GPU. [CLICK] Inside the window is the network. It's a U-shaped encoder and decoder with {{net.stages}} stages, and every stage has convolutions. [CLICK] The three deepest stages, in blue, also have Mamba blocks. Each stage halves the grid, so down here the feature map is small. [CLICK] A Mamba block flattens the feature map into a line of tokens, one per voxel. It scans that line in {{net.dirs}} directions, forwards and backwards along each axis. That's {{net.tok3}} tokens at the third stage, down to {{net.tok5}} at the fifth. [[cut]]At the second stage it would be {{net.tok2}}, too costly to scan.[[/cut]] So Mamba adds context inside the window. It never sees the whole body at once.",
  },
  anatomy: {
    seconds: 46,
    text: "There's one more piece. Beside the lesion output, a second head labels {{organ.classes}} classes: background and {{organ.structures}} anatomical structures, taken from automatic CT segmentations. A network that knows where the kidneys and bladder are should raise fewer false alarms there. PSMASegmentator's recipe uses the same idea. Mine is only used in training and is switched off at inference. [CLICK] I added it after my third training run, run 3, flagged lesions on all {{organ.neg}} lesion-free scans in my validation set. With the organ head, the false lesions on those scans fell from {{organ.fc3}} to {{organ.fc4}}. [[cut]]Everything else in that run stayed the same.[[/cut]]",
  },
  scans: {
    seconds: 60,
    text: "Each tile is one scan, {{data.total}} in all, from two public datasets. autoPET-III's outlines were corrected by an expert. DEEP-PSMA's mark every voxel at or above a fixed uptake threshold. [[cut]]Neither dataset is limited to one tracer or to recurrent disease.[[/cut]] [CLICK] I sealed {{data.test}} scans away as the test set. Nothing trained on them, and they were scored once. [CLICK] The other {{data.pool}} went into five-fold cross-validation. Each of five models trains with a different fifth held out for checking. Averaged together, the five form an ensemble, which I call run 5. Before the test, I wrote down the cut-off for calling a voxel a lesion, the smallest blob I'd keep, and what I'd report. That's what pre-registered means here. Run 4, which comes up later, is one earlier hybrid trained on autoPET-III alone.",
  },
  sealed: {
    seconds: 56,
    text: "[[cut]]Back to the patient from the start, one of those sealed scans.[[/cut]] The model found {{a.found}} of its {{a.gt}} lesions, missed {{a.missed}}, and raised {{a.fa}} false alarms. [CLICK] Over all {{data.test}} sealed scans, the ensemble's F1 was {{r5.f1}}. Sensitivity, the share of lesions found, was {{r5.sens}}. Precision, the share of what it flagged that was real, was {{r5.ppv}}. F1 balances the two. A lesion counts as found if any predicted voxel touches it. That rule is generous, so I report Dice beside it, here {{r5.dsc}}. Two cautions. Lesions are pooled, so scans with lots of disease count the most. And it's in-domain, because both datasets were in training. PSMASegmentator trained on all {{data.test_autopet}} autoPET-III test scans, so I can't fairly score it here.",
  },
  fair: {
    seconds: 76,
    text: "For a fair test I needed scans neither model had seen. These are the {{fair.n}} DEEP-PSMA scans. PSMASegmentator never trained on them, and neither did run 4. Run 4 is one model trained on {{train.run4_cases}} scans. PSMASegmentator averages five models trained on {{psm.train}}. Each runs {{psm.tta}} mirrored passes, predicting the scan again flipped and averaging. [CLICK] Run 4 still scored {{fair.df1_abs}} F1 points higher, and the interval, {{fair.df1_lo}} to {{fair.df1_hi}}, stays above zero. Its sensitivity was {{fair.dsens_abs}} points higher, but its precision was {{fair.dppv_abs}} points lower. So it's a trade: more lesions found, for more false alarms. [CLICK] Scan by scan, there was no clear difference. Run 4 was better on {{fair.better}} scans and worse on {{fair.worse}}. [[cut]]It lost on {{fair.lt20_lower}} of the {{fair.lt20_n}} scans with under {{fair.lt20_cut}} lesions, and won on {{fair.ge100_higher}} of the {{fair.ge100_n}} with {{fair.ge100_cut}} or more.[[/cut]] The pooled gain comes from the scans with the most disease. [PAUSE] This was a fair test of two recipes, and most of the differences between them favour PSMASegmentator.",
  },
  twin: {
    seconds: 98,
    text: "My main models used the small window, so they never tested the bet. Run 6 did, with an ablation: take one part out, here the Mamba blocks, and see what changes. That leaves a CNN-only twin. [[cut]]It has {{net.twin_pct}} of the hybrid's parameters, but that gap is the same at both window sizes.[[/cut]] At the small window, on the same {{fair.n}} unseen scans, the hybrid scored {{r6.h_small}} and the twin {{r6.c_small}}. [CLICK] Then I grew the window to {{patch.ratio}} times the volume, longer head to toe than PSMASegmentator's. The hybrid was predicted to gain more. Instead, it fell to {{r6.h_large}}, while the twin barely moved, to {{r6.c_large}}. The hybrid lost {{r6.inter_abs}} points more than the twin. Under the rule I fixed before scoring, that's a real effect. One possible reason is length: at the big window the third stage scans {{net.tok3_large}} tokens through the same small memory. I didn't test why. [CLICK] The twin also scored above PSMASegmentator's {{fair.psm_f1}}, so I can't credit run 4's gain to Mamba. Only run 4's gap was tested with a confidence interval, though. On speed, the abstract's {{abs.home_h}} against {{abs.home_p}} seconds, and the {{eff.h5}} against {{eff.p40}} in my dissertation, both come from PSMASegmentator's eight-pass test-time augmentation. In my dissertation's timing, at equal passes, the hybrid was no faster in mean time and no lower in peak memory.",
  },
  answer: {
    seconds: 122,
    silent: 18,
    text: "So how much of the body does a model need to see? On my evidence, a bigger window, as trained, helped neither model, and it hurt the hybrid most. Adding context this way didn't pay off. And run 4's gain over PSMASegmentator isn't credited to Mamba, because the CNN-only twin also scored above it. On the hypotheses, detection held, but only as a trade. The loss didn't hold: weighting misses found {{run2.sens}} of lesions on validation but cut precision to {{run2.ppv}}. Speed wasn't supported either. And context came out reversed on DEEP-PSMA, my primary set. The project offers a fair test on unseen scans, and a pre-registered test of Mamba. [CLICK] This is case B, the lowest F1 by a fixed rule. Both of its lesions were found, but it also raised {{b.fa}} false alarms. [[cut]]Of those, {{b.fa_bone}} were in bone.[[/cut]] Each run 6 cell is a single training run, and the big window trained at batch size {{r6.batch_large}}. The two datasets label lesions differently, and only {{data.test_neg}} test scans were lesion-free. None of this is clinical validation. [CLICK] The next step is the Sir Charles Gairdner Hospital cohort my proposal named. The code will be released, so the UWA Medical Physics Research Group can retrain the model and score it there. Here's a real run of the five models in the app I built, sped up. [CLIP PLAYS, {{d1.len}}, let it run] [CLICK] Thank you. I'm happy to take questions.",
  },
};

export const CUES = {
  title: ['Opens on the title. Nothing to click.'],
  spot: [
    'Opens on case A, facing front. Ask the room to look.',
    'Click: the five-second countdown runs round the scan. Stay quiet.',
    'Click: the ground-truth clip of case A plays (the reveal). Keep talking over it.',
    'Click: the cost of outlining by hand and the two-observer Dice.',
    'Click: the talk in one breath, beside the plain scan.',
  ],
  context: [
    'Opens zoomed in on the bladder region of panel (a). Ask: cancer?',
    'Click: the camera pulls back to the whole body and its organ labels.',
    'Click: the context line and the autoPET-III citation.',
  ],
  window: [
    'Opens zoomed in on the window, then pulls back to the body.',
    'Click: GPU memory caps the window.',
    'Click: the 2022 cascade figures, as context only.',
  ],
  bet: [
    'Opens on the attention-against-Mamba schematic.',
    'Click: the U-Mamba warning and the CNN-only twin.',
    'Click: the research question, large. Pause on it.',
    'Click: the four hypotheses, verdicts pending.',
  ],
  inside: [
    'Opens on case A with my window and the dashed PSMASegmentator window.',
    'Click: the camera moves into the window and onto the network.',
    'Click: zoom to the three deepest stages (blue).',
    'Click: the six token lanes with their real lengths.',
  ],
  anatomy: [
    'Opens on the organ head of the network (training only).',
    'Click: false lesions on the lesion-free validation scans, run 3 against run 4.',
  ],
  scans: [
    'Opens on one tile, then pulls back to every scan.',
    'Click: the sealed test scans slide into the vault.',
    'Click: the pool splits into five folds, cohorts kept.',
  ],
  sealed: [
    'Opens on case A with its verdict counts.',
    'Click: the pooled score over every sealed scan.',
  ],
  fair: [
    'Opens on the DEEP-PSMA scans and the underdog card.',
    'Click: run 4 minus PSMASegmentator, pooled.',
    'Click: the tiles become one dot per scan.',
  ],
  twin: [
    'Opens on the small window and the two small-window scores.',
    'Click: the window grows to the large patch while the lines fall.',
    'Click: the PSMASegmentator line and the speed lines.',
  ],
  answer: [
    'Opens on the answer and the four verdicts with their evidence.',
    'Click: limitations, with case B.',
    'Click: the next step; say the demo line, then let the recording run.',
    'Click: thank you and questions; leave this up for questions.',
  ],
};
