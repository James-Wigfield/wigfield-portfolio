/* ============================================================================
   VERDICT DECK — TRANSCRIPTS AND PRESENTER CUES (pure data; no JSX)
   ----------------------------------------------------------------------------
   One entry per main slide, keyed by slide id. James reads `text` aloud.
   Numbers only as {{keys}} (shared/facts.js); cues in [SQUARE BRACKETS];
   exactly one [[cut]] sentence per slide (none on the title), and each cut
   sentence is slack: dropping it loses nothing the slide or the talk needs.
   Every claim is as strong as chapter 5's verdict on it (tab:disc-hypotheses).
   Revised 13 Oct after the four critic reports (time trimmed; H4 "reversed on
   the primary set"; run 4 and run 6 named before use; the organ head's result
   and a possible reason for the reversal said in the main line).
   Kept apart from index.jsx so the word counts can be checked in Node.
   ========================================================================== */

export const SCRIPTS = {
  title: {
    seconds: 20,
    text: "Hi everyone, I'm James. My honours project is about Mamba, a newer kind of neural network layer. I asked whether it earns its place in a network that outlines prostate cancer in whole-body PET scans. I'm supervised by Jake Kendrick and Mubashar Hassan.",
  },
  problem: {
    seconds: 62,
    text: "Here's a PSMA PET scan of the abdomen and pelvis. PSMA is a protein on prostate cancer cells, and the scan's tracer sticks to it. PET/CT pairs a map of that tracer with a CT of the anatomy. This is the PET half, so darker means more tracer. [POINT AT THE BLUE OUTLINES] The outlined spots are lesions, separate deposits of cancer. But healthy tissue lights up too, like the kidneys and the bladder. Where the lesions are, and how much disease there is, both bear on treatment. So we want every lesion outlined, which is called segmentation. By hand it's slow, and experts don't agree. [CLICK] When a second expert outlined {{lit.obs_scans}} of the same scans, the two sets of outlines overlapped with a mean Dice of only {{lit.obs_dsc_round}}. Dice measures how much two outlines share. [[cut]]The second found just {{lit.obs_found}} of the first's lesions.[[/cut]]",
  },
  overview: {
    seconds: 30,
    text: "I built a network that's convolutional in its shallow stages, with Mamba blocks in the deepest three. A side task teaches it organs during training. Of {{data.total}} public scans, I sealed {{data.test}} away for one final test. There it found {{r5.found_round}} of lesions, which is its sensitivity. And {{r5.prec_round}} of its predictions hit a real lesion, which is its precision. [[cut]]Then come four predictions, each with a verdict.[[/cut]]",
  },
  previous: {
    seconds: 65,
    text: "The usual starting point is nnU-Net, a convolutional neural network, or CNN, that configures itself to each dataset. A CNN is built from small filters that slide over the image. In 2022, Kendrick and colleagues built a two-stage nnU-Net cascade for whole-body PSMA PET. On their own {{k22.test}} test scans it reached an F1 of {{k22.f1}}, a score that balances lesions found against false alarms. Its precision was high, but it found only {{k22.sens}} of lesions. Those figures are context only, because that test set isn't available to me. The model I compare against is PSMASegmentator, a later nnU-Net trained on {{psm.train}} scans. [CLICK] [POINT AT THE NESTED BOXES] Here's the catch. A whole-body scan doesn't fit in GPU memory, the memory on the graphics card. So a CNN reads the scan one 3D window at a time, and a bigger window leaves room for fewer windows per training step. [[cut]]Each filter sees only a small neighbourhood.[[/cut]]",
  },
  bet: {
    seconds: 75,
    text: "My project bets on Mamba, a sequence model whose cost grows linearly with sequence length. [CLICK] To use it on a scan, the network takes a 3D block of features from deep inside itself. It flattens that block into a line of tokens, and a token is one cell of the block. A sequence only runs one way, so each Mamba block reads the same tokens in six orders, forwards and backwards along each axis. [CLICK] Each order is read once, start to finish, carrying a small memory of fixed size. That's why the cost grows linearly. [CLICK] Attention, the layer inside transformers, compares every token with every other token, so its cost grows with the square of the length. [[cut]]My deepest stages hold up to {{net.tok3}} tokens per order.[[/cut]] Mamba still only sees one window, though, never the whole body. [CLICK] When Isensee and colleagues retested U-Mamba against a copy with its Mamba layers switched off, those layers had no effect. So a fair claim for Mamba needs a twin network without them.",
  },
  question: {
    seconds: 45,
    text: "My question has two halves. [PAUSE] First, does the hybrid find lesions better than PSMASegmentator on scans neither model has trained on? Second, if it does, is Mamba the reason? [CLICK] I turned that into four predictions. H1 is the head-to-head on unseen scans. H2 and H3 test two claims from my research proposal, about the loss function and about speed and memory. H4 is the heart of the bet. If Mamba really adds context, a bigger training window should help the hybrid more than its twin. [[cut]]For now all four are pending.[[/cut]] The margin column fills in as the evidence arrives.",
  },
  built: {
    seconds: 62,
    text: "Here's what I built. [POINT AT THE FIGURE] It's a five-stage encoder-decoder. The encoder shrinks the scan while it learns features, and the decoder builds the outline back up at full resolution. [CLICK] Every stage has convolutions, and the deepest three also get Mamba blocks, because that's where the flattened sequence is short. At the shallow stages it would be at least {{net.tok2}} tokens per direction. [[cut]]Convolutions handle that fine texture more cheaply anyway.[[/cut]] [CLICK] The dashed box is an organ head. During training it learns {{organ.structures}} anatomical structures from automatic labels, so the network learns where normal uptake lives. It's never used when the model predicts. My third development run raised false alarms on all {{organ.neg}} lesion-free validation scans, and adding this head cut them from {{organ.fc3}} to {{organ.fc4}}. [CLICK] Zoom in, and one Mamba block is the six-order scan from before, outputs summed.",
  },
  tested: {
    seconds: 68,
    text: "Now, how I tested it. I used two public cohorts, {{data.total}} scans in all. [POINT AT THE TILES] They label lesions differently. autoPET-III outlines were corrected slice by slice by an expert. DEEP-PSMA marks every voxel, or 3D pixel, at or above a fixed uptake threshold, with normal uptake painted out by a physician. [CLICK] First I sealed away {{data.test}} scans. Nothing trained on them, and I scored them once. [CLICK] The other {{data.pool}} went into five-fold cross-validation. That means training five models, each with a different fifth held out for checking, then averaging all five into one ensemble. [CLICK] Before scoring the test set, I fixed the lesion cut-off, the smallest blob I'd keep and the results I'd report. That's what pre-registered means here. [CLICK] Along the way I trained numbered development runs. Run 4 is an early single hybrid that trained on autoPET only, so all {{data.deeppsma}} DEEP-PSMA scans are unseen by it. [[cut]]PSMASegmentator never trained on those scans either.[[/cut]]",
  },
  works: {
    seconds: 60,
    silent: 4,
    text: "So, does it work? This is one sealed scan, case A. I picked it by a rule, as the strongest of the larger autoPET scans, before looking at any images. [CLIP PLAYS, {{clip.a4}}, pause while the rings trace on] Blue lesions were found, orange ones were missed, and yellow marks are false alarms. A lesion counts as found if any predicted voxel touches it. [CLICK] Across all {{data.test}} sealed scans, with lesions pooled, the ensemble's F1 was {{r5.f1}}. Sensitivity is the share of lesions found, and precision is the share of predictions that hit a lesion. Dice is lower, at {{r5.dsc}}, because it needs the outlines to match voxel by voxel. These scans come from the cohorts it trained on, so this result is in-domain. [[cut]]Pooled means scans with lots of disease count most.[[/cut]]",
  },
  fair: {
    seconds: 85,
    text: "H1 is the fair test. PSMASegmentator trained on every autoPET scan in my test set, so I can't score it there. Instead I used the {{fair.n}} DEEP-PSMA scans that neither model trained on, and run 4 rather than my final model. [POINT AT THE TABLE] On paper run 4 is the underdog. It had fewer training scans, one model instead of five, and fewer parameters. It also skipped test-time augmentation, where each scan is run again mirrored. [CLICK] Each dot is one scan: run 4's F1 minus PSMASegmentator's, against how many lesions the scan has. Scan by scan, there's no clear difference. Run 4 was better on {{fair.better}} and worse on {{fair.worse}}. It usually lost on scans with few lesions and usually won on scans with many. [CLICK] Pooled F1 counts lesions, so the big scans weigh the most. Pooled, run 4's F1 was {{fair.df1_abs}} points higher, and its {{ci.level}} interval, {{fair.df1_lo}} to {{fair.df1_hi}}, stays above zero. It found more lesions, with sensitivity up {{fair.dsens_abs}} points, but its precision fell {{fair.dppv_abs}} points. [CLICK] So H1 is supported, but only as a trade: more lesions found for more false alarms. [[cut]]Mamba gets no credit yet.[[/cut]]",
  },
  twin: {
    seconds: 92,
    text: "So is Mamba the reason? I trained a twin, the same network with every Mamba block removed. This is an ablation: take one part away and see what changes. [POINT AT THE WINDOWS] Each network was trained at the usual window and at a large one, with {{patch.ratio}} times the voxels. H4 has its own pre-registered test: I fixed the comparisons and the decision rule before scoring any of these new models. [CLICK] At the usual window, on the {{fair.n}} DEEP-PSMA scans, the two are level. On the autoPET test scans the hybrid was slightly ahead, so the Mamba blocks add little at this window. Both sit above PSMASegmentator, though only run 4's gap was tested with an interval. [CLICK] [PAUSE] The twin barely moves, losing {{r6.c_patch_abs}} of a point. The hybrid drops {{r6.h_patch_abs}} points. [CLICK] The gap between those drops, {{r6.inter_abs}} points, is the interaction, and under my rule it's real. [[cut]]Its interval excludes zero and it's bigger than {{r6.rule}} point.[[/cut]] So H4 is reversed on the primary set, DEEP-PSMA: the bigger window hurt the hybrid more than its twin. On autoPET the difference was not clear. One possible reason is sequence length: at the large window the third stage reads {{net.tok3_large}} tokens, against {{net.tok3}}, through the same small memory. I didn't test why.",
  },
  'loss-speed': {
    seconds: 63,
    text: "H2 and H3 came from my proposal. H2 was about the loss. Run 2 used a loss that punishes missed lesions more than false alarms. [POINT AT THE LEFT PANEL] It found {{run2.sens}} of lesions, but its precision fell to {{run2.ppv}}, and no threshold brought it back. [CLICK] So H2 is not supported, though it was a partial test: one run, on {{train.val57}} validation scans, under an older scoring rule. [CLICK] H3 was about speed and memory. In their default setups, my ensemble took {{eff.h5}} per scan against {{eff.p40}} for PSMASegmentator. But that gap comes from PSMASegmentator's eight-pass test-time augmentation. The abstract's {{abs.home_h}} against {{abs.home_p}} seconds, from my home GPU, is the same effect. At equal passes the hybrid was no faster in mean time, and its peak memory was {{eff.vram_h}} against {{eff.vram_p}}. [CLICK] So H3 is not supported either. [[cut]]The hybrid is the smaller network, though.[[/cut]]",
  },
  meaning: {
    seconds: 92,
    silent: 15,
    text: "So, does Mamba earn its place? [POINT AT THE SCOREBOARD] On the {{fair.n}} DEEP-PSMA scans neither model had seen, run 4, my single hybrid, found more lesions than PSMASegmentator, at lower precision. But on those scans the CNN-only twin did as well. The Mamba blocks added little, so I don't credit the gain to them, and a bigger window hurt the hybrid more. The part I'm most confident in is the test design: unseen scans, and a pre-registered twin comparison. [CLICK] Each cell of the twin experiment was a single training run, and the large window trained at batch size {{r6.batch_large}}. The two cohorts label lesions differently, and only {{data.test_neg}} sealed scans were lesion-free. [[cut]]The timing also covers just {{eff.n}} scans.[[/cut]] [CLICK] The next step is to retrain and score the model on the Sir Charles Gairdner Hospital cohort my proposal named, where it's untested. The code will be released, so the UWA Medical Physics Research Group can do that. Here's a real run in my app, sped up {{d1.speed}}. [CLIP PLAYS, {{d1.len}}, let it run] [CLICK] Thank you. I'm happy to take questions.",
  },
};

/* One line per build step for the presenter (no digits: gate G1 reads these). */
export const CUES = {
  title: ['Title. Say hello and credit the supervisors.'],
  problem: [
    'The exhibit, cropped to abdomen and pelvis: normal uptake labelled, lesions outlined in blue.',
    'Click: the two observer figures appear.',
  ],
  overview: ['The abstract in one breath; no clicks.'],
  previous: [
    'Previous work: nnU-Net, the cascade figures as context, PSMASegmentator.',
    'Click: the nested scan, window and filter schematic.',
  ],
  bet: [
    'Mamba defined; the deep feature block.',
    'Click: the block flattens into six token lanes.',
    'Click: each lane is read once, left to right.',
    'Click: attention web over the same tokens.',
    'Click: the U-Mamba warning, so a twin.',
  ],
  question: [
    'The research question, large; the table is hidden.',
    'Click: the four predictions, all pending; the scoreboard is born.',
  ],
  built: [
    'Option F, whole figure.',
    'Click: zoom onto the three deep stages.',
    'Click: zoom onto the training-only organ head; say the organ result.',
    'Click: zoom onto one Mamba block.',
  ],
  tested: [
    'Two cohorts as tiles.',
    'Click: the sealed test set moves into the vault.',
    'Click: the pool splits into five folds.',
    'Click: pre-registered.',
    'Click: DEEP-PSMA tiles outlined; name run four and run six.',
  ],
  works: [
    'Case A clip, cropped to the scan; pause while the rings trace on.',
    'Click: the pooled sealed-test numbers.',
  ],
  fair: [
    'The underdog table.',
    'Click: one hundred scans as dots, scattered by lesion count.',
    'Click: dots grow by lesion count; the pooled differences rise in their own panel. Do not call the bars a weighted mean.',
    'Click: H1 turns to supported, as a trade.',
  ],
  twin: [
    'The design: two windows to scale, hybrid and twin.',
    'Click: usual-window points, both level.',
    'Click: the large window; both drop, the hybrid far more.',
    'Click: the interaction; H4 turns to reversed on the primary set.',
  ],
  'loss-speed': [
    'H2 panel: run two sensitivity and precision.',
    'Click: H2 turns to not supported.',
    'Click: H3 panel: no faster in mean time; peak memory bars.',
    'Click: H3 turns to not supported.',
  ],
  meaning: [
    'The answer, with the full scoreboard.',
    'Click: limitations.',
    'Click: next step and the recorded demo; let it play.',
    'Click: thank you and questions.',
  ],
};
