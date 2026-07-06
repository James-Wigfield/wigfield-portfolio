import Icon from '../icons';

/* ============================================================================
   MAMBA UPDATES — honours project explainer feed  (University)
   ----------------------------------------------------------------------------
   A living feed of "explainer pages" for the Mamba_PSMA honours project. The
   idea: whenever James wants to understand a part of the project being built,
   the assisting Claude instance writes a new entry here — a self-contained
   page explaining that slice (the what / why / how).

   Each update is one object appended to UPDATES below (newest first); the
   render path is already wired, so adding an explainer is a single array entry:

     {
       id:      'ssm-basics',                 // unique slug
       date:    '2026-07-05',                 // ISO date
       kicker:  'Architecture',               // short mono tag
       title:   'Why a state-space backbone?',
       body: (                                // any JSX
         <>
           <p>…</p>
         </>
       ),
     }

   Styled with the portal's Reading Room tokens via the shared .pt-* classes and
   the .mu-* block in portal.css — re-skins automatically with the active theme.
   ========================================================================== */

const HEAD = {
  kicker: 'University · Mamba_PSMA',
  title: 'Mamba Updates',
  intro:
    'A running feed of explainer pages for the honours project. Whenever a part of the build needs ' +
    'unpacking, a new entry lands here — a focused write-up of that slice: what it is, why it exists, ' +
    'and how it fits the whole.',
};

// Explainer entries — newest first.
const UPDATES = [
  /* ────────────────────────────────────────────────────────────────────────
     1 · THE FORWARD PLAN
     ──────────────────────────────────────────────────────────────────────── */
  {
    id: 'mamba-dev-plan',
    date: '2026-07-05',
    kicker: 'Plan · Roadmap',
    title: 'Starting the Mamba model: the build plan',
    body: (
      <>
        <p className="mu-lead">
          The data pipeline is finished and verified. The next milestone on the proposal timeline is a{' '}
          <strong>working Mamba model</strong> (Jul–Sep 2026). This page lays out where the repo stands
          today and the exact order we&rsquo;ll build the model in.
        </p>

        <p className="mu-h">Where we are today</p>
        <p>
          The whole <strong>data-preparation pipeline is built and tested end-to-end</strong> on real
          autoPET scans: discover CT/PET pairs, register the CT onto the PET grid, resample to a fixed
          ~4&nbsp;mm spacing, apply CTNormalization, crop lesion-biased patches, and batch into
          <code>(B, 2, 64, 128, 64)</code> tensors. It is config-driven — <code>baseline.yaml</code> carries
          the exact spacing / normalisation / patch recipe lifted from the deployed nnU-Net{' '}
          <code>plans.json</code>, so the comparison against the baseline stays fair.
        </p>
        <div className="mu-flow" aria-label="Preprocessing pipeline status">
          <span className="mu-flow__node mu-flow__node--done">Load</span>
          <span className="mu-flow__arrow">→</span>
          <span className="mu-flow__node mu-flow__node--done">Register</span>
          <span className="mu-flow__arrow">→</span>
          <span className="mu-flow__node mu-flow__node--done">Resample</span>
          <span className="mu-flow__arrow">→</span>
          <span className="mu-flow__node mu-flow__node--done">Normalise</span>
          <span className="mu-flow__arrow">→</span>
          <span className="mu-flow__node mu-flow__node--done">Patch</span>
          <span className="mu-flow__arrow">→</span>
          <span className="mu-flow__node mu-flow__node--done">Batch</span>
          <span className="mu-flow__arrow">→</span>
          <span className="mu-flow__node mu-flow__node--next">Model</span>
        </div>
        <p>
          Everything downstream of the pipeline is still <strong>scaffolding</strong> — the four model
          files, the three training files, the three evaluation files, the three entry-point scripts and the
          two experiment configs are all comment-only stubs describing intent. That is the deliberate starting
          line for this phase.
        </p>
        <div className="mu-callout mu-callout--warn">
          <span className="mu-callout__label">One real blocker</span>
          <p>
            There are <strong>no labelled training cases on the dev machine yet</strong> — the local autoPET
            volumes are inference-only. Training needs the labelled autoPET-PSMA set (which ships masks) or the
            SCGH data with RTSTRUCT → ground-truth mask conversion. Model code can be written and shape-tested
            without it, but no real training run starts until labels are in place.
          </p>
        </div>

        <p className="mu-h">The build order</p>
        <ol className="mu-steps">
          <li className="mu-step">
            <span className="mu-step__n">1</span>
            <span className="mu-step__title">Stand up the training environment<span className="mu-step__meta">HPC</span></span>
            <p className="mu-step__body">
              Install <code>torch</code>, <code>monai</code>, <code>mamba-ssm</code> and{' '}
              <code>causal-conv1d</code> on the SCGH HPC (they need CUDA and aren&rsquo;t on the dev laptop).
              First job: prove the existing MONAI DataLoader stage actually runs on a GPU — right now it is
              only syntax-checked.
            </p>
          </li>
          <li className="mu-step">
            <span className="mu-step__n">2</span>
            <span className="mu-step__title">Build the Mamba block<span className="mu-step__meta">the atom</span></span>
            <p className="mu-step__body">
              Implement <code>mamba_block_3d.py</code> first — flatten a 3D feature map to a 1D sequence, run
              the selective scan, reshape back. Validate on a single patch: correct output shape, sane memory,
              runs on GPU. Nothing else can be tested until this works.
            </p>
          </li>
          <li className="mu-step">
            <span className="mu-step__n">3</span>
            <span className="mu-step__title">Assemble the network<span className="mu-step__meta">encoder · decoder · head</span></span>
            <p className="mu-step__body">
              Wire <code>encoder.py</code> → bottleneck → <code>decoder.py</code> → segmentation head in{' '}
              <code>psma_mamba.py</code>. Prove it can learn by <strong>overfitting a single case</strong> —
              the classic sanity check that the forward/backward path and skip connections are correct.
            </p>
          </li>
          <li className="mu-step">
            <span className="mu-step__n">4</span>
            <span className="mu-step__title">Loss + training loop<span className="mu-step__meta">Tversky</span></span>
            <p className="mu-step__body">
              <code>loss.py</code> (asymmetric Tversky + BCE), <code>train.py</code> (mixed-precision loop,
              checkpointing on best lesion-F1, logging) and <code>scheduler.py</code> (warmup + cosine to steady
              the large Mamba init). Train on a handful of labelled cases to confirm the loss goes down.
            </p>
          </li>
          <li className="mu-step">
            <span className="mu-step__n">5</span>
            <span className="mu-step__title">Evaluation<span className="mu-step__meta">lesion-F1</span></span>
            <p className="mu-step__body">
              <code>metrics.py</code> (connected-component lesion detection — 25&nbsp;mm³ filter, 10% overlap),{' '}
              <code>inference.py</code> (overlap-tile sliding window with Gaussian stitching), and{' '}
              <code>evaluate.py</code> to score against the baseline&rsquo;s F1 = 79.9%, PPV = 88.2%,
              sensitivity = 73%.
            </p>
          </li>
          <li className="mu-step">
            <span className="mu-step__n">6</span>
            <span className="mu-step__title">Experiments<span className="mu-step__meta">fill the configs</span></span>
            <p className="mu-step__body">
              Populate <code>mamba1_tversky.yaml</code> / <code>mamba2_tversky.yaml</code> and sweep the
              questions the proposal poses: Mamba-1 vs Mamba-2, the Tversky β, hybrid CNN-Mamba vs pure Mamba,
              and larger patch sizes that Mamba&rsquo;s linear scaling makes affordable.
            </p>
          </li>
        </ol>

        <div className="mu-callout mu-callout--accent">
          <span className="mu-callout__label">Immediate next actions</span>
          <p>
            (1)&nbsp;Get the HPC environment installed and the DataLoader running on GPU.
            (2)&nbsp;Implement <code>mamba_block_3d.py</code> and shape-test it.
            (3)&nbsp;Secure labelled data (autoPET-PSMA masks or SCGH + RTSTRUCT→GT) so a real training run can begin.
          </p>
        </div>

        <div className="mu-callout">
          <span className="mu-callout__label">Guiding principle</span>
          <p>
            Keep <strong>baseline parity</strong> everywhere it doesn&rsquo;t matter, and only diverge where
            Mamba&rsquo;s advantage is the whole point (bigger patches / global context). Same recipe — just swap
            the model. That is what makes the head-to-head against nnU-Net honest.
          </p>
        </div>

        <div className="mu-tags">
          <span className="mu-tag">✓ Model design</span>
          <span className="mu-tag">→ Working Mamba model · Jul–Sep</span>
          <span className="mu-tag">Evaluation · Sep–Oct</span>
          <span className="mu-tag">Dissertation</span>
        </div>
      </>
    ),
  },

  /* ────────────────────────────────────────────────────────────────────────
     2 · THE ARCHITECTURE
     ──────────────────────────────────────────────────────────────────────── */
  {
    id: 'mamba-architecture',
    date: '2026-07-05',
    kicker: 'Architecture',
    title: 'The model we’re building: a 3D hybrid CNN–Mamba U-Net',
    body: (
      <>
        <p className="mu-lead">
          A familiar U-Net shell — encoder, decoder, skip connections — but with{' '}
          <strong>Mamba blocks</strong> woven in. The CNN layers extract local detail; the Mamba layers add
          global, whole-body context in <em>linear</em> time. The design follows U-Mamba, SegMamba and
          SegResMamba from the literature review.
        </p>
        <p>
          Input is a 2-channel volume <code>(B, 2, D, H, W)</code> — channel&nbsp;0 CT, channel&nbsp;1 PET —
          and the output is a single-channel binary lesion logit map at full patch resolution.
        </p>

        <div className="mu-flow" aria-label="Network dataflow">
          <span className="mu-flow__node">Input · 2ch</span>
          <span className="mu-flow__arrow">→</span>
          <span className="mu-flow__node">Conv</span>
          <span className="mu-flow__arrow">→</span>
          <span className="mu-flow__node">Conv + Mamba×2</span>
          <span className="mu-flow__arrow">→</span>
          <span className="mu-flow__node">Conv + Mamba×2</span>
          <span className="mu-flow__arrow">→</span>
          <span className="mu-flow__node mu-flow__node--next">Bottleneck · Mamba×4</span>
          <span className="mu-flow__arrow">→</span>
          <span className="mu-flow__node">Upsample + skips</span>
          <span className="mu-flow__arrow">→</span>
          <span className="mu-flow__node">1×1×1 head</span>
        </div>

        <p className="mu-h">The four model files</p>
        <ol className="mu-steps">
          <li className="mu-step">
            <span className="mu-step__n">1</span>
            <span className="mu-step__title">The atom<code>mamba_block_3d.py</code></span>
            <p className="mu-step__body">
              Turns a 3D feature map into a 1D sequence, runs a <strong>multi-directional selective scan</strong>{' '}
              (forward/reverse along each axis, so the model isn&rsquo;t biased by one flattening order — the
              SegMamba &ldquo;tri-orientated&rdquo; idea), then reshapes back to 3D. Built to swap Mamba-1 ↔
              Mamba-2 (SSD) with a config flag.
            </p>
          </li>
          <li className="mu-step">
            <span className="mu-step__n">2</span>
            <span className="mu-step__title">Encoder<code>encoder.py</code></span>
            <p className="mu-step__body">
              Convolutional residual stages capture local texture; Mamba blocks are added at the deeper, lower-
              resolution stages where long-range context matters and the sequence is short enough to be cheap.
              Downsamples ×2 per stage.
            </p>
          </li>
          <li className="mu-step">
            <span className="mu-step__n">3</span>
            <span className="mu-step__title">Decoder + head<code>decoder.py</code></span>
            <p className="mu-step__body">
              Transposed-convolution upsampling, <strong>skip connections</strong> concatenated from the matching
              encoder stage to restore fine spatial detail, and a <code>1×1×1</code> convolution producing the
              lesion logit.
            </p>
          </li>
          <li className="mu-step">
            <span className="mu-step__n">4</span>
            <span className="mu-step__title">Top-level wiring<code>psma_mamba.py</code></span>
            <p className="mu-step__body">
              Assembles encoder → bottleneck → decoder → head into one module. Housekeeping note: the current
              header comment says &ldquo;channel&nbsp;0: PET&rdquo; — that is <strong>wrong</strong>. The config
              sets CT&nbsp;=&nbsp;0, PET&nbsp;=&nbsp;1; fix the comment when the file is implemented.
            </p>
          </li>
        </ol>

        <div className="mu-callout">
          <span className="mu-callout__label">Why Mamba, not a Transformer</span>
          <p>
            Self-attention costs <code>O(L²)</code>. A single <code>128³</code> patch is a sequence of{' '}
            <strong>262,144</strong> tokens — enough to run vanilla attention out of memory on an A100. Mamba&rsquo;s
            selective state-space scan is <code>O(L)</code> and its input-dependent gating lets it ignore vast
            tracts of healthy tissue while keeping the tokens for tiny lesions.
          </p>
        </div>

        <div className="mu-callout mu-callout--accent">
          <span className="mu-callout__label">The loss — the sensitivity lever</span>
          <p>
            Asymmetric <strong>Tversky loss (α = 0.3, β = 0.7)</strong> combined with a light BCE term. The higher
            β penalises <strong>false negatives</strong> — missed metastases — harder than false positives, aimed
            squarely at lifting the baseline&rsquo;s 73% lesion sensitivity without giving up its 88.2% PPV. β is a
            dataset-specific knob and will be tuned empirically on the PSMA data, not assumed.
          </p>
        </div>

        <p className="mu-h">Questions the experiments will settle</p>
        <ul className="mu-list">
          <li><strong>Hybrid vs pure</strong> — CNN-Mamba hybrid against pure Mamba blocks (efficiency vs accuracy).</li>
          <li><strong>Mamba-1 vs Mamba-2</strong> — the SSD variant, swapped via the block&rsquo;s config flag.</li>
          <li><strong>Patch size</strong> — push beyond nnU-Net&rsquo;s 64×128×64; linear scaling makes far more whole-body context affordable, which is the core thesis.</li>
        </ul>
        <div className="mu-tags">
          <span className="mu-tag">ref VRAM · SegMamba-V2 ≈ 13 GB @ 128³</span>
          <span className="mu-tag">SegResMamba 2.2–4.8 GB</span>
        </div>
      </>
    ),
  },

  /* ────────────────────────────────────────────────────────────────────────
     3 · INFERENCE ALIGNMENT — SWAP THE MODEL WITH ONE FLAG
     ──────────────────────────────────────────────────────────────────────── */
  {
    id: 'model-swap-inference',
    date: '2026-07-05',
    kicker: 'Inference · Alignment',
    title: 'One command, either model: aligning inference with PSMASegmentator',
    body: (
      <>
        <p className="mu-lead">
          The end goal is simple to state: at inference time you pick the segmentation model with a{' '}
          <strong>single command-line flag</strong>, and everything else — how scans go in, how masks come
          out — stays identical. This page explains how the reference tool selects its model, and how we mirror
          that so the Mamba model drops in as just another choice.
        </p>

        <p className="mu-h">How the reference tool runs today</p>
        <p>
          <code>PSMASegmentator</code> is a fork of nnU-Net v2 wrapped in a thin CLI. A user runs one command;
          the model itself is fixed by the weights bundle it downloads:
        </p>
        <div className="mu-cmd">{`# reference tool — the network is fixed by the downloaded weights
python -m psma_segmentator.cli -i INPUT_DIR -pat TOKEN
#   input : 2-channel NIfTI  ->  _0000 = CT,  _0001 = PET (SUV)
#   model : checkpoint_final.pth + plans.json   (--fast = lighter variant)
#   output: lesion mask via nnU-Net sliding-window predictor`}</div>

        <div className="mu-callout mu-callout--accent">
          <span className="mu-callout__label">The seam we&rsquo;re copying</span>
          <p>
            nnU-Net doesn&rsquo;t hard-wire its network — it builds it from a <strong>plain text string</strong>.
            The factory <code>get_network_from_plans</code> calls <code>pydoc.locate(network_class_name)</code>,
            so any module accepting <code>input_channels</code> / <code>num_classes</code> plus the plans&rsquo;{' '}
            <code>arch_kwargs</code> is a valid network. The PSMA fork already uses this: its custom
            <code>autoPET3_Trainer</code> simply overrides that string to swap in{' '}
            <code>ResidualEncoderUNetOrgan</code>. In other words, &ldquo;which network&rdquo; is <em>already</em>{' '}
            a swappable, string-selected decision — we plug into the exact same seam.
          </p>
        </div>

        <p className="mu-h">Why alignment is already most of the way there</p>
        <p>
          Our standalone pipeline was built to the same data contract: <code>_0000</code> = CT,{' '}
          <code>_0001</code> = PET, CTNormalization on <em>both</em> channels, resample to a fixed spacing,
          sliding-window inference. Because the input and output are identical, the <strong>only thing that
          changes between models is the network object and its checkpoint</strong> — which is precisely what a
          CLI flag should select.
        </p>

        <p className="mu-h">Two ways to wire the switch</p>
        <div className="mu-grid">
          <div className="mu-cell mu-cell--accent">
            <span className="mu-cell__k">Route A · recommended</span>
            <p>
              A <code>--model</code> flag in our repo. <code>evaluation/inference.py</code> and{' '}
              <code>scripts/run_eval.py</code> take <code>--model {'{'}nnunet | mamba1 | mamba2{'}'}</code>; a
              tiny registry maps each name to a (network builder, checkpoint) pair. Same data in, same mask out.
            </p>
          </div>
          <div className="mu-cell">
            <span className="mu-cell__k">Route B · full drop-in</span>
            <p>
              A Mamba trainer inside a PSMASegmentator-style tree: add <code>MambaUNet</code> to{' '}
              <code>architecture/</code> and a <code>MambaTrainer</code> that hardcodes it (mirroring{' '}
              <code>autoPET3_Trainer</code>), so <code>nnUNetv2_predict -tr MambaTrainer</code> picks it. Heavier,
              but true parity with the reference command surface.
            </p>
          </div>
        </div>

        <p>
          Route A is the near-term target — it keeps this repo self-contained (PyTorch + MONAI, no nnU-Net
          dependency) while giving exactly the one-flag switch we want:
        </p>
        <div className="mu-cmd">{`python scripts/run_eval.py --model mamba1 -i INPUT_DIR -o OUT_DIR
# swap the network only — nothing else changes:
python scripts/run_eval.py --model nnunet -i INPUT_DIR -o OUT_DIR`}</div>

        <div className="mu-callout">
          <span className="mu-callout__label">Keep the contract fixed</span>
          <p>
            Whichever route, the rule is the same: hold the pre/post-processing constant across models — channel
            order, CTNormalization, sliding-window with Gaussian stitching and mirror TTA, and the connected-
            component lesion post-processing (25&nbsp;mm³ filter, 10% overlap). Only then is the head-to-head a
            fair benchmark <em>and</em> a genuine drop-in switch.
          </p>
        </div>
      </>
    ),
  },
];

export default function MambaUpdates() {
  return (
    <div className="pt-module mu">
      <div>
        <p className="mu-kicker">{HEAD.kicker}</p>
        <p className="pt-module__intro">{HEAD.intro}</p>
      </div>

      {UPDATES.length === 0 ? (
        <div className="pt-card mu-empty">
          <span className="mu-empty__icon" aria-hidden="true"><Icon name="mamba" size={30} /></span>
          <p className="mu-empty__label">// AWAITING FIRST UPDATE</p>
          <p className="mu-empty__title">No explainer pages yet</p>
          <p className="mu-empty__hint">
            When you ask the honours-project assistant to explain a part of the build, its write-up will
            appear here as a dated entry.
          </p>
        </div>
      ) : (
        <div className="mu-feed">
          {UPDATES.map((u) => (
            <article className="pt-card mu-entry" key={u.id}>
              <header className="mu-entry__head">
                {u.kicker && <span className="mu-entry__kicker">{u.kicker}</span>}
                {u.date && <time className="mu-entry__date">{u.date}</time>}
              </header>
              <h2 className="mu-entry__title">{u.title}</h2>
              <div className="mu-entry__body">{u.body}</div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
