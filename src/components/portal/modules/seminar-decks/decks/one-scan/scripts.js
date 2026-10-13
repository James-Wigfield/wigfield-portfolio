/* ============================================================================
   ONE SCAN, START TO FINISH — TRANSCRIPTS AND PRESENTER CUES
   ----------------------------------------------------------------------------
   Read aloud by James. Numbers only as {{keys}} (shared/facts.js); cues in
   square brackets are shown, never spoken; one [[cut]] sentence per slide.
   Every claim is from chapters 1 to 6 at chapter 5's strength. `silent` is
   clip time with no narration over it. Cues (one per build step, the first
   is the state on entry) carry no digits.
   ========================================================================== */

export const SCRIPTS = {
  title: {
    seconds: 20,
    silent: 0,
    text: "Hi everyone, I'm James. My honours project asks whether a newer kind of neural network, called Mamba, can help find prostate cancer lesions in whole-body PET scans. I was supervised by Jake Kendrick and Mubashar Hassan.",
  },
  scan: {
    seconds: 74,
    silent: 3,
    text: "[CLIP PLAYS, {{clip.a1}}, keep talking] This is a whole-body PSMA PET/CT scan from my held-out test set. The model never saw it, and I picked it by a rule before looking. PSMA is a protein found on prostate cancer cells. A radioactive tracer binds to it, PET shows where the tracer collects, and CT shows the anatomy. Bright means tracer uptake. Much of that is normal: salivary glands, liver, kidneys, gut and bladder. The cancer is the scattered spots, mostly in the bones. Each spot is called a lesion, and this scan has {{a.gt}} of them. Can you find them? [PAUSE] [CLICK] To measure the disease, someone has to outline every lesion in 3D. That outlining is called segmentation, and by hand it's slow. [CLICK] Experts also disagree. In a 2022 study, two experts outlined the same {{lit.obs_scans}} scans. Their outlines overlapped by only {{lit.obs_dsc_round}}. That overlap score is called Dice. [[cut]]So a tool has to find the lesions and outline them well enough to measure.[[/cut]]",
  },
  overview: {
    seconds: 36,
    silent: 0,
    text: "Here's the whole project in one breath. I built a hybrid network that adds Mamba to its deepest stages. I used {{data.total}} public scans and locked {{data.test}} of them away until the very end. On those it found {{r5.found_round}} of the lesions, its sensitivity, and {{r5.prec_round}} of what it flagged was real, its precision. [[cut]]The gold dot in the bar at the top marks my own work.[[/cut]] From here, I'll follow this one scan through the model, then zoom out.",
  },
  windows: {
    seconds: 70,
    silent: 0,
    text: "The standard tool for this job is nnU-Net. It builds a convolutional neural network, or CNN, which looks at the image through small local filters. A whole-body scan won't fit in GPU memory, the graphics card's memory, so the network reads it one 3D window at a time. [CLICK] This box is PSMASegmentator's window, drawn to scale on our scan. PSMASegmentator is the released nnU-Net model for PSMA PET, and it's what I compare against. [[cut]]It can't use anything outside the window it's reading.[[/cut]] [CLICK] Before it came the 2022 nnU-Net cascade by Kendrick et al. On its own test set it found {{k22.sens}} of lesions, and {{k22.ppv}} of what it flagged was real. Those figures are context only, because its test set and scoring rule aren't mine. [CLICK] The gold boxes are my own windows. My models are numbered as training runs: the final one, run 5, averages five models, and run 6 tests this larger window.",
  },
  idea: {
    seconds: 78,
    silent: 3,
    text: "The idea is to let the network see more inside each window, using Mamba. Mamba is a sequence model. It reads a long line of tokens in order and carries a small memory along. Here a token is one cell of a small 3D grid of features inside the network. Its cost grows linearly with length: double the sequence and the work doubles. [POINT AT THE WEB] Attention, the usual alternative, compares every token with every other, so doubling the length quadruples the work. [CLICK] But U-Mamba, an earlier hybrid, was retested with its Mamba layers switched off. The Mamba layers made no difference. So any claim for Mamba needs a twin without it. [CLICK] Hence my research question. [PAUSE] In short: does it beat PSMASegmentator, and is Mamba the reason? [CLICK] I split it into {{hyp.n}} predictions. H1 is detection, H2 the training loss, and H3 speed and memory. H4 asks whether a bigger window helps the hybrid more than its twin. [[cut]]Each one gets a verdict near the end.[[/cut]]",
  },
  data: {
    seconds: 52,
    silent: 0,
    text: "For data, I combined two public datasets, {{data.total}} scans in all. autoPET-III has {{data.autopet}} scans from Munich. Their lesions were outlined by a threshold, then corrected by an expert. DEEP-PSMA has {{data.deeppsma}} patients with advanced disease, labelled by a threshold on tracer uptake. [CLICK] First I sealed {{data.test}} scans away. Nothing trained or was tuned on them. [CLICK] The other {{data.pool}} went into five-fold cross-validation. Each model trains on four folds and is checked on the fifth, so every pool scan is checked once. [CLICK] Before opening the seal, I wrote down the probability cut-off, the smallest blob I'd keep, and the numbers I'd report. That's what pre-registered means here. [[cut]]Then the test set was scored once.[[/cut]]",
  },
  network: {
    seconds: 64,
    silent: 0,
    text: "Here's the network, from the dissertation. It's U-shaped: the window goes down through five stages and back up to a lesion map. [POINT AT THE INPUT] Two channels go in, CT and PET. The first two stages are plain convolutions. There the sequence would be far too long, and fine texture suits a convolution anyway. [CLICK] Mamba blocks sit only in the three deepest stages, where the grid is small. At the bottom the sequence is just {{net.tok5}} tokens. [CLICK] Inside a block, the grid is flattened and read in {{net.dirs}} directions by separate Mamba layers. Their outputs are summed and added back. [CLICK] On the way up, skip connections bring back the fine detail. A second output learns anatomy, but only during training. When I added it, the spots it wrongly flagged on {{organ.neg}} validation scans with no lesions fell from {{organ.fc3}} to {{organ.fc4}}. [CLICK] [[cut]]That's the whole network.[[/cut]]",
  },
  ensemble: {
    seconds: 44,
    silent: 3,
    text: "[CLIP PLAYS, {{clip.a2a}}, keep talking] Back to our scan. It goes through the network one window at a time: {{a.windows}} windows here, each overlapping its neighbours by {{inf.overlap}}. The glow is one model's running estimate, filling in. [CLICK] [CLIP PLAYS, {{clip.a2b}}, keep talking] I trained {{inf.models}} of these models, one per fold. Each gives its own probability map. Averaging models like this is called an ensemble. [CLICK] [CLIP PLAYS, {{clip.a2c}}] Voxels, the 3D pixels, with an average above {{inf.thr}} are kept. Then specks under {{inf.minvox}} voxels are dropped. That size is about the limit of what PET can resolve, and it scored best in validation. [PAUSE] [[cut]]{{a.regions_before}} regions become {{a.regions_after}}.[[/cut]]",
  },
  verdicts: {
    seconds: 56,
    silent: 0,
    text: "[CLIP PLAYS, {{clip.a3}}, keep talking] This is the final prediction: every region the model marks as a lesion. [CLICK] [CLIP PLAYS, {{clip.a4}}, keep talking] Now the expert-corrected outlines go on. A circle is a lesion found, which means some predicted voxel touches it. A dashed square is a lesion missed. A diamond is a false alarm: a predicted region that touches no lesion at all. [[cut]]Two of the three misses are specks smaller than the size filter.[[/cut]] [CLICK] [CLIP PLAYS, {{clip.a5}}, keep talking] Now the scores. Sensitivity is the share of lesions found, and precision the share of finds that were real. F1 combines the two, so it's low if either one is low. Dice is the outline overlap from earlier. The rule picked the best F1 among autoPET scans with {{a.rule_min}} or more lesions, so this is the good end.",
  },
  sealed: {
    seconds: 50,
    silent: 0,
    text: "Now zoom out to all {{data.test}} sealed scans. This is the main result, scored once under the protocol I fixed in advance. The ensemble's F1 was {{r5.f1}}. [CLICK] Across those scans there are {{r5.lesions}} lesions. It found {{r5.tp}} and missed {{r5.fn}}, and it raised {{r5.fp}} false alarms. That's {{r5.sens}} sensitivity and {{r5.ppv}} precision. [CLICK] Two words matter here. Pooled means the lesions are added up across scans, so the busiest scans count most. The mean of the per-scan F1 is lower, about {{r5.percase_mean}}. In-domain means the test scans come from the same two datasets as training. The {{ci.level}} interval on F1 runs from {{r5.f1_lo}} to {{r5.f1_hi}}. [[cut]]Both datasets land on the same F1, by different routes.[[/cut]]",
  },
  fair: {
    seconds: 82,
    silent: 0,
    text: "Now the fair comparison with PSMASegmentator. It trained on every autoPET scan in my test set, so I can't score it there. Instead I used the {{fair.n}} DEEP-PSMA scans, which neither model trained on. My side is run 4. It isn't my final model, just an earlier single hybrid trained on autoPET alone. It's the underdog: PSMASegmentator has more training scans, {{psm.folds}} models instead of one, {{psm.tta}} mirrored passes and a bigger network. Mirrored passes, or test-time augmentation, run each window again flipped and average the results. So a win for run 4 is the safer finding. [CLICK] Even so, run 4's pooled F1 was {{fair.df1_abs}} points higher, and the interval excludes zero. It found more lesions, with sensitivity up {{fair.dsens_abs}} points. It also raised more false alarms, with precision down {{fair.dppv_abs}}. So H1 holds only as a trade. [CLICK] Scan by scan, there's no clear difference. Run 4 was better on {{fair.better}} and worse on {{fair.worse}}. [[cut]]It lost on most scans with few lesions and won on most with many.[[/cut]] Pooled F1 weights the busy scans, so that's where the gain comes from.",
  },
  twin: {
    seconds: 98,
    silent: 0,
    text: "Now the test of Mamba itself. I trained a twin: the same network and recipe with every Mamba block removed. That's called an ablation. At the small window, on the same {{fair.n}} unseen scans, the twin scored {{r6.c_small}} against the hybrid's {{r6.h_small}}. Both sit above PSMASegmentator, though only the hybrid's gap was tested with an interval. On the autoPET test scans the hybrid was {{r6.gap_small_ap}} points ahead, which passes my rule but is small. So the Mamba blocks added little, and the gain isn't credited to them. [CLICK] Then I gave both networks the larger window. [[cut]]If Mamba makes use of context, the hybrid should gain more.[[/cut]] But the larger window cost the hybrid {{r6.h_patch_abs}} points, and the twin only {{r6.c_patch_abs}}. That difference was pre-registered, and it counts as real. One possible reason is that a much longer sequence asks too much of Mamba's small memory. [CLICK] At equal passes, the hybrid was no faster in mean time and no lower in peak memory. The abstract's {{abs.home_h}} against {{abs.home_p}} seconds, and {{eff.h5}} against {{eff.p40}} in the dissertation, both come from PSMASegmentator's {{psm.tta}}-pass test-time augmentation. [CLICK] So the scoreboard. H1 holds, but only as a trade. H2, tested only partly, and H3 weren't supported. H4 came out reversed on the primary set: the bigger window hurt the hybrid more.",
  },
  close: {
    seconds: 108,
    silent: 12,
    text: "[CLIP PLAYS, {{clip.b4}}, keep talking] Here's the other end. Case B, picked by rule, has the lowest F1 among scans where any lesion was found. Both of its lesions were found, but the model raised {{b.fa}} false alarms, so its precision was only {{b.ppv}}. It isn't the worst scan: on {{r5.zero_found}} scans the model found none of the lesions. [CLICK] So, the limits. I tested on two public datasets, never on the Sir Charles Gairdner Hospital cohort my research proposal named. Each run 6 cell is a single training run. And only {{data.test_neg}} test scans have no lesions. [CLICK] What it means: on unseen scans, run 4, my single hybrid, found more lesions than PSMASegmentator, with more false alarms. There the CNN-only twin did as well, so I don't credit the gain to Mamba. The project offers a fair test on scans unseen by both, and a pre-registered test of what the Mamba blocks add. The next step is to retrain and score it on that hospital cohort. Once the code is released, the UWA Medical Physics Research Group can do that. [CLICK] [CLIP PLAYS, {{d1.len}}] Here's the model running in my app, sped up {{d1.speed}}. The app's colours: green found, cyan missed, magenta false alarm. [LET IT PLAY] [CLICK] [[cut]]That was case A and case B, from the same model.[[/cut]] Thank you, and I'm happy to take questions.",
  },
};

export const CUES = {
  title: ['On entry: the case A scan turns slowly behind the title. Introduce yourself and the supervisors.'],
  scan: [
    'On entry: the scan clip plays (fades in, one turn). Narrate over it, then ask the room to find the lesions.',
    'Click: segmentation, outlining by hand is slow.',
    'Click: the inter-observer Dice from the 2022 study.',
  ],
  overview: ['On entry: the five overview lines build in beside the scan.'],
  windows: [
    'On entry: nnU-Net reads one window at a time.',
    "Click: PSMASegmentator's window draws to scale.",
    'Click: the 2022 cascade card (context only).',
    "Click: this project's two windows in gold (small: runs 3 to 5; large: run 6).",
  ],
  idea: [
    'On entry: Mamba against attention, schematic. Point at the web.',
    'Click: the U-Mamba warning card.',
    'Click: the research question in large type. Pause and let them read.',
    'Click: H1 to H4, all pending.',
  ],
  data: [
    'On entry: every scan as a tile, autoPET-III filled, DEEP-PSMA hollow.',
    'Click: the sealed test tiles move into the vault.',
    'Click: the pool regroups into five folds.',
    'Click: the pre-registration card.',
  ],
  network: [
    'On entry: option F, input and the convolutional stages.',
    'Click: the three Mamba stages and their sequence lengths.',
    'Click: one Mamba block, six directions.',
    'Click: decoder and heads; the organ head is training only.',
    'Click: the whole figure.',
  ],
  ensemble: [
    'On entry: the windows clip. Keep talking.',
    'Click: the five-models clip; the fold maps fan out.',
    'Click: the threshold clip; average, threshold, specks removed. Pause for the specks.',
  ],
  verdicts: [
    'On entry: the prediction clip turns.',
    'Click: the ground-truth clip, with verdicts. Name the three shapes.',
    'Click: the score-card clip. Define the metrics on it.',
  ],
  sealed: [
    'On entry: the sealed scans, case A marked.',
    'Click: the pooled lesion bars (found, missed, false alarms).',
    'Click: pooled and in-domain, with the interval.',
  ],
  fair: [
    'On entry: the underdog card.',
    'Click: the pooled result and the trade.',
    'Click: one dot per scan.',
  ],
  twin: [
    'On entry: the twin; small-window scores only.',
    'Click: the larger window, both lines drop.',
    'Click: the efficiency line and the abstract timing note.',
    'Click: the scoreboard replaces the chart, H1 to H4 resolved.',
  ],
  close: [
    'On entry: case B against its ground truth.',
    'Click: the limitations.',
    'Click: what it means, the contribution and the next step.',
    'Click: the recorded run in the app. Name its colours, then let it play.',
    'Click: case A beside case B with the conclusion; thank you and questions.',
  ],
};
