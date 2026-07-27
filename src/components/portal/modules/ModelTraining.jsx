import { useState, useEffect, useRef, useCallback } from 'react';
import Icon from '../icons';
import { CODE } from './modelTrainingCode';
import './ModelTraining.css';

/* ============================================================================
   MODEL & TRAINING — what the network is and how it learns  (University)
   ----------------------------------------------------------------------------
   The progress-meeting explainer for models/ + training/ in Mamba_PSMA, written
   in plain English for a supervisor conversation rather than a paper.

   The thing that makes this page different from the static write-up it grew out
   of (documentation/progress-tracking/model-and-training-overview.html): every
   substantive claim carries a <CodeRef>, which pops open the ACTUAL source that
   implements it, with real line numbers. Claim and evidence sit one click apart,
   so nothing here has to be taken on trust.

   Snippets live in ./modelTrainingCode.js and are machine-extracted from the
   repo — see that file's header before touching them.
   ========================================================================== */

/* Why each snippet is worth looking at — the framing the raw code can't give.
   Keys match CODE in ./modelTrainingCode.js. */
const NOTES = {
  dirs: 'Each entry is a (permutation, flip) pair. The permutation decides which spatial axis ends up varying fastest once the volume is unrolled — i.e. which way the scan reads — and the flip reverses it. Slicing this list is how n_directions scales from 1 to 6.',
  core: 'The single seam where the SSM version is chosen. Everything else in the block is written to be version-agnostic, so swapping Mamba-1 for Mamba-2 touches only these six lines.',
  flatten: 'The 3D-to-sequence step. permute reorders the spatial axes, flatten(2) merges them into one line of length L = D·H·W, transpose puts channels last, and the optional flip walks it backwards.',
  unflatten: 'The exact inverse. Note that inv is derived from the same permutation tuple rather than hard-coded — that is what keeps it correct for all six directions.',
  blockForward: 'Pre-norm, then the loop: for every direction, flatten, scan, un-flatten, and accumulate. The final line adds the residual, which is what makes the block safe to drop anywhere.',
  convBlock: 'Two convolutions with InstanceNorm and LeakyReLU, matching nnU-Net. The stride on conv1 is what halves the resolution, and proj is the matching strided 1x1x1 that keeps the residual add aligned.',
  encStage: 'A stage is one ConvBlock3D followed by n_mamba shape-preserving Mamba blocks. With n_mamba=0 the stage is convolution only — that is how the stem and first downsample are built.',
  encInit: 'Three parallel lists drive the whole contracting path. The zip is the entire architecture: one EncoderStage per (channels, stride, mamba-count) triple.',
  encForward: 'Every stage output is appended to skips, deepest last. Returning all of them — not just the final one — is the contract the decoder relies on.',
  decInit: 'The decoder reads the encoder\'s own features and strides, so it cannot drift out of step. Each level pairs a ConvTranspose3d that undoes exactly the stride the encoder used with a ConvBlock3D that fuses the concatenated channels back down.',
  decForward: 'Start at the bottleneck, then for each level: upsample, concatenate the matching skip, fuse. The interpolate line is a guard for when an upsampled tensor and its skip disagree on size.',
  netInit: 'The whole network. Encoder and decoder are handed the same features and strides so they stay mirrored, and forward is literally decoder(encoder(x)).',
  netConfig: 'One config dict builds the entire network. This is why an experiment is a YAML edit rather than a code change.',
  lossFlatten: 'Both region losses start here: sigmoid the logits and flatten to (B, N), so every metric below is computed per sample and then averaged.',
  lossTversky: 'The TP/FP/FN split is explicit, which is what makes the weighting possible. alpha multiplies false positives, beta false negatives — set both to 0.5 and this reduces to Dice exactly.',
  lossCombined: 'The region loss plus a weighted BCE term. The BCE is what supplies usable gradients early, when the predicted and true masks barely overlap.',
  lossBuild: 'The config-to-object switch. The default name is tversky_bce, which resolves to Tversky(0.3, 0.7) wrapped in CombinedLoss with a 0.3 BCE weight.',
  lossDice: 'Hard Dice at a 0.5 threshold, under no_grad. This one is never trained against — it exists so the reported number is comparable with everyone else\'s.',
  sched: 'Returns a multiplier on the base learning rate, stepped once per iteration. Linear ramp while step < warmup_iters, then a half-cosine down to min_lr_ratio. The min(progress, 1.0) pins it at the floor if the run overshoots.',
  trainOptim: 'AdamW by default; the SGD branch with momentum 0.99 and Nesterov is there to match nnU-Net exactly when a like-for-like comparison is wanted.',
  trainSplit: 'Two modes. The overfit branch returns the same foreground cases as both train and val. Otherwise generate_splits is keyed on case_id, which is what makes the split patient-level rather than scan-level.',
  trainSetup: 'Assembly: dataloaders, model from config, loss from config, optimizer, AMP scaler, and the scheduler wired to the total iteration budget.',
  trainStep: 'The loop counts iterations, not epochs. Each step is the standard AMP sequence — zero grads, autocast forward, scaled backward, scaler step, then scheduler.step() once per iteration.',
  trainCkpt: 'Final validation and checkpoint. Note val_dice is saved alongside the weights, which is how we know the checkpoint currently on disk is from a sanity run.',
};

/* ---------------------------------------------------------------- code modal */

function CodeModal({ id, onClose }) {
  const entry = CODE[id];
  const panelRef = useRef(null);
  const closeRef = useRef(null);

  useEffect(() => {
    const prevFocus = document.activeElement;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();

    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); return; }
      if (e.key !== 'Tab') return;
      // keep focus inside the dialog
      const items = panelRef.current?.querySelectorAll('button, [href], [tabindex]:not([tabindex="-1"])');
      if (!items?.length) return;
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = prevOverflow;
      if (prevFocus instanceof HTMLElement) prevFocus.focus();
    };
  }, [onClose]);

  if (!entry) return null;
  const range = entry.from === entry.to ? `${entry.from}` : `${entry.from}–${entry.to}`;

  return (
    <div
      className="mt-modal"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="mt-modal__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`mt-modal-title-${id}`}
        ref={panelRef}
      >
        <div className="mt-modal__head">
          <div>
            <h4 className="mt-modal__title" id={`mt-modal-title-${id}`}>The code behind it</h4>
            <span className="mt-modal__path">{entry.file} : {range}</span>
          </div>
          <button type="button" className="mt-modal__close" onClick={onClose} ref={closeRef}>
            Close · Esc
          </button>
        </div>

        {NOTES[id] && <p className="mt-modal__note">{NOTES[id]}</p>}

        <div className="mt-modal__body">
          <code className="mt-code">
            {entry.lines.map((line, i) => (
              <span className="mt-code__row" key={i}>
                <span className="mt-code__ln">{entry.from + i}</span>
                <span className="mt-code__src">{line || ' '}</span>
              </span>
            ))}
          </code>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- the ref chip */

function CodeRef({ id, onOpen }) {
  const entry = CODE[id];
  if (!entry) return null;
  const short = entry.file.split('/').pop();
  const range = entry.from === entry.to ? `${entry.from}` : `${entry.from}–${entry.to}`;
  return (
    <button
      type="button"
      className="mt-ref"
      onClick={() => onOpen(id)}
      aria-label={`Show the code: ${entry.file} lines ${range}`}
    >
      <Icon name="codebase" size={11} />
      {short}:{range}
    </button>
  );
}

/* ------------------------------------------------------------------ content */

const STAGES = [
  { stage: '0 · stem', dims: '64×128×64', L: 524288, pct: 100, runs: 'conv only', hot: true,
    tip: '524,288 voxels × 6 directions = 3.1M scanned positions per block' },
  { stage: '1', dims: '32×64×32', L: 65536, pct: 78.6, runs: 'conv only', hot: true,
    tip: '8× smaller than the stem — still too long to be worth it' },
  { stage: '2', dims: '16×32×16', L: 8192, pct: 57.1, runs: 'Mamba ×2', hot: false,
    tip: 'First stage where the scan is affordable' },
  { stage: '3', dims: '8×16×8', L: 1024, pct: 35.7, runs: 'Mamba ×2', hot: false,
    tip: 'Cheap, and the receptive field is already wide' },
  { stage: 'bottleneck', dims: '4×8×4', L: 128, pct: 14.3, runs: 'Mamba ×4', hot: false,
    tip: '4,096× shorter than the stem, so the most blocks go here' },
];

const FAQ = [
  ['Why Mamba? Why not a transformer?', [
    'Attention cost grows with the square of the sequence length. A full-resolution patch here flattens to over half a million voxels — squaring that is out of reach on any GPU.',
    'Mamba grows linearly instead, so it can read a long sequence and still fit in memory. That is the whole reason it is interesting for 3D medical imaging: the volumes are enormous.',
  ]],
  ['Why not just use nnU-Net? It already works.', [
    'nnU-Net is the baseline being compared against, not the thing being replaced. It is deliberately matched as closely as possible — same preprocessing constants, same patch size, same normalisation layers — so any difference in results can be attributed to the Mamba blocks rather than to incidental setup differences.',
    'The question the project asks is narrow: does long-range context help find scattered metastases that a purely local network misses?',
  ]],
  ['What does "selective scan" actually mean?', [
    'It reads the voxels in order, carrying a small running memory. At each voxel a learned gate decides how much of that voxel to write into the memory and how much of the old memory to keep.',
    '"Selective" is that gate. A lesion can be latched into the memory and still be there hundreds of voxels later, while background gets filtered out — so a fixed-size memory can carry information across an entire volume.',
  ]],
  ['Why six directions? Isn\'t one scan enough?', [
    'Flattening 3D into a line destroys neighbourhoods. Two voxels touching in space can end up hundreds of positions apart on the line, purely because of the order they were unrolled in.',
    'Scanning along each of the three axes, forwards and backwards, and summing the results means no single reading order\'s blind spot dominates. The idea comes from SegMamba\'s tri-orientated scan, generalised to both directions. It is configurable — two directions is a valid cheaper setting.',
  ]],
  ['Why is Mamba only in the deep stages?', [
    'Cost. The scan length is width × height × depth, so every halving of resolution divides it by eight. At full resolution that is 524,288 voxels per direction, times six directions. At the bottleneck it is 128.',
    'That is a 4,096× difference between the top and the bottom of the network. Deep stages are where the scan is affordable — and conveniently also where long-range context is most useful, since fine detail is handled by the convolutions and the skip connections.',
  ]],
  ['Why Tversky instead of plain Dice?', [
    'Dice punishes a missed lesion and a false alarm exactly equally. Clinically they are not equal: missing a metastasis can change staging and treatment, whereas a false positive gets reviewed and dismissed.',
    'Tversky is the same formula with separate weights on the two error types — 0.3 on false positives, 0.7 on false negatives. Setting both to 0.5 gives back ordinary Dice exactly.',
  ]],
  ['Doesn\'t that just make it over-predict?', [
    'Yes — that is the trade being made on purpose. It buys sensitivity and spends precision.',
    'Two things keep it honest: both sensitivity and precision get reported rather than just the headline Dice, and the weights are config values, so the ratio is something to sweep as an experiment rather than a fixed assumption.',
  ]],
  ['Why add cross-entropy on top of the region loss?', [
    'Early in training the prediction barely overlaps the target, so the Dice/Tversky term is nearly flat and gives almost no useful gradient — the model has nothing to follow.',
    'Cross-entropy gives a sensible per-voxel gradient everywhere from the first step, which gets things moving until the overlap term becomes meaningful. It is weighted at 0.3 so it supports the main objective without dominating it. nnU-Net does the same thing.',
  ]],
  ['How big is the model, and is it a fair comparison?', [
    '39.7 million parameters, the same order of magnitude as an nnU-Net 3d_fullres model, so neither side wins on raw capacity alone.',
    'Fairness was designed in: spacing, patch size and normalisation statistics come straight from the deployed PSMASegmentator plans file, and the convolution blocks use the same InstanceNorm and LeakyReLU. Where the pipeline diverges, it is deliberate and documented.',
  ]],
  ['Does it work? What\'s the Dice?', [
    'There is no honest accuracy number yet. What has been demonstrated is that the pipeline runs end-to-end on the GPU and that the training loop genuinely learns — on an overfit sanity check it successfully memorises a small fixed set of patches.',
    'A real training run on the full dataset is the immediate next step. The checkpoint currently on disk is from the sanity check and would not produce sensible masks on unseen data.',
  ]],
  ['Why split by patient rather than by scan?', [
    'The dataset has 597 studies from 378 patients, so many patients appear more than once. Splitting per scan could put the same patient\'s anatomy in both training and validation.',
    'The model would then partly be recognising the patient rather than the disease, and the validation score would be optimistically biased. Splitting on patient ID removes that leak, and the split is seeded so it is reproducible.',
  ]],
  ['Mamba-1 or Mamba-2?', [
    'Both are supported and it is a one-word config change. There is a single function where the version is chosen and everything else is version-agnostic.',
    'Mamba-1 is the current default for correctness; Mamba-2 is faster and is an easy ablation once there is a working baseline to compare against.',
  ]],
  ['What\'s the biggest risk right now?', [
    'That the first real training run reveals something the overfit test cannot — the honest candidates being that six-direction summing inflates activations at depth, or that the sensitivity weighting produces too many false positives to be useful.',
    'Both are visible early with proper tracking, which is why experiment logging is the next thing to wire in rather than something left until later.',
  ]],
];

/* --------------------------------------------------------------- the module */

export default function ModelTraining() {
  const [openCode, setOpenCode] = useState(null);
  const open = useCallback((id) => setOpenCode(id), []);
  const close = useCallback(() => setOpenCode(null), []);
  const ref = (id) => <CodeRef id={id} onOpen={open} />;

  return (
    <div className="pt-module mt">
      <div>
        <p className="mt-kicker">University · Mamba_PSMA</p>
        <h2 className="mt-title">The model, and how it learns</h2>
        <p className="mt-lede">
          Seven Python files make up a complete, working segmentation network and the loop that trains it.
          Every claim below carries a <strong>code chip</strong> — click one to see the actual source and
          line numbers that implement it.
        </p>
      </div>

      {/* ---------- at a glance ---------- */}
      <div className="mt-readouts">
        <div className="mt-readout">
          <div className="mt-readout__k">Parameters</div>
          <div className="mt-readout__v">39.7<small> M</small></div>
        </div>
        <div className="mt-readout">
          <div className="mt-readout__k">Input channels</div>
          <div className="mt-readout__v">2<small> CT + PET</small></div>
        </div>
        <div className="mt-readout">
          <div className="mt-readout__k">Scan directions</div>
          <div className="mt-readout__v">6</div>
        </div>
        <div className="mt-readout">
          <div className="mt-readout__k">Output</div>
          <div className="mt-readout__v">1<small> mask</small></div>
        </div>
        <p className="mt-readfoot">
          Takes a <b>64 × 128 × 64</b> block of a PET/CT scan with two channels stacked (CT for anatomy,
          PET for uptake) and returns a block of exactly the same size, where every voxel carries one
          number: <b>how likely it is to be tumour</b>.
        </p>
      </div>

      <div className="mt-callout">
        <p>
          <strong>Said out loud:</strong> it is a U-Net — the standard medical-imaging shape that squeezes
          an image down to understand it, then builds it back up to label it — but with{' '}
          <strong>Mamba blocks bolted into the deep half</strong>.
        </p>
        <p>
          Ordinary convolutions only ever look at a small neighbourhood at a time, so they struggle to
          relate a lesion in the pelvis to one in the neck. Mamba can read the whole volume as one long
          sequence and carry information across it. The research question is whether that extra reach
          actually finds more metastases.
        </p>
      </div>

      {/* ---------- architecture ---------- */}
      <section className="mt-section">
        <span className="mt-section__label">The shape of it</span>
        <h3>Down, then back up, with shortcuts</h3>
        <p className="mt-sub">
          Each step down halves the resolution and doubles the detail channels. Each step up reverses it.
          The dashed shortcuts hand fine detail straight across, so the final mask is sharp rather than blurry.
        </p>

        <figure className="mt-figure">
          <svg viewBox="0 0 900 372" role="img" aria-label="U-Net diagram: four encoder stages descending on the left, a bottleneck at the bottom, four decoder stages ascending on the right, with dashed skip connections joining matching levels. Mamba blocks appear at the deepest three stages.">
            <defs>
              <marker id="mt-ar" markerWidth="7" markerHeight="7" refX="5.4" refY="3" orient="auto">
                <path className="mt-fig__arrowhead" d="M0,0 L6,3 L0,6 z" />
              </marker>
              <marker id="mt-ar-skip" markerWidth="7" markerHeight="7" refX="5.4" refY="3" orient="auto">
                <path className="mt-fig__skiphead" d="M0,0 L6,3 L0,6 z" />
              </marker>
            </defs>

            <text className="mt-fig__head" x="100" y="14">ENCODER — GOING DOWN</text>
            <text className="mt-fig__head" x="700" y="14" textAnchor="middle">DECODER — COMING UP</text>

            {/* encoder */}
            <rect className="mt-fig__box" x="100" y="26" width="182" height="44" rx="6" />
            <text className="mt-fig__name" x="112" y="46">Stem — conv only</text>
            <text className="mt-fig__dim" x="112" y="61">64×128×64 · 32 ch</text>

            <rect className="mt-fig__box" x="130" y="90" width="182" height="44" rx="6" />
            <text className="mt-fig__name" x="142" y="110">Conv only</text>
            <text className="mt-fig__dim" x="142" y="125">32×64×32 · 64 ch</text>

            <rect className="mt-fig__box mt-fig__box--mamba" x="160" y="154" width="182" height="44" rx="6" />
            <text className="mt-fig__name" x="172" y="174">Conv + Mamba ×2</text>
            <text className="mt-fig__dim" x="172" y="189">16×32×16 · 128 ch</text>
            <circle className="mt-fig__dot" cx="330" cy="176" r="4" />

            <rect className="mt-fig__box mt-fig__box--mamba" x="190" y="218" width="182" height="44" rx="6" />
            <text className="mt-fig__name" x="202" y="238">Conv + Mamba ×2</text>
            <text className="mt-fig__dim" x="202" y="253">8×16×8 · 256 ch</text>
            <circle className="mt-fig__dot" cx="360" cy="240" r="4" />

            {/* bottleneck */}
            <rect className="mt-fig__bottle" x="320" y="288" width="260" height="52" rx="7" />
            <text className="mt-fig__name--inv" x="340" y="310">Bottleneck — Conv + Mamba ×4</text>
            <text className="mt-fig__dim--inv" x="340" y="326">4×8×4 · 320 ch · only 128 voxels</text>
            <circle className="mt-fig__dot" cx="562" cy="304" r="4.5" />

            {/* decoder */}
            <rect className="mt-fig__box" x="618" y="218" width="182" height="44" rx="6" />
            <text className="mt-fig__name" x="630" y="238">Up ×2 + fuse</text>
            <text className="mt-fig__dim" x="630" y="253">8×16×8 · 256 ch</text>

            <rect className="mt-fig__box" x="648" y="154" width="182" height="44" rx="6" />
            <text className="mt-fig__name" x="660" y="174">Up ×2 + fuse</text>
            <text className="mt-fig__dim" x="660" y="189">16×32×16 · 128 ch</text>

            <rect className="mt-fig__box" x="678" y="90" width="182" height="44" rx="6" />
            <text className="mt-fig__name" x="690" y="110">Up ×2 + fuse</text>
            <text className="mt-fig__dim" x="690" y="125">32×64×32 · 64 ch</text>

            <rect className="mt-fig__box mt-fig__box--out" x="708" y="26" width="182" height="44" rx="6" />
            <text className="mt-fig__name" x="720" y="46">Up ×2 + fuse → head</text>
            <text className="mt-fig__dim mt-fig__dim--out" x="720" y="61">64×128×64 · 1 mask</text>

            {/* descent */}
            <path className="mt-fig__arrow" d="M191 70 L221 88" markerEnd="url(#mt-ar)" />
            <path className="mt-fig__arrow" d="M221 134 L251 152" markerEnd="url(#mt-ar)" />
            <path className="mt-fig__arrow" d="M251 198 L281 216" markerEnd="url(#mt-ar)" />
            <path className="mt-fig__arrow" d="M281 262 L360 286" markerEnd="url(#mt-ar)" />
            {/* ascent */}
            <path className="mt-fig__arrow" d="M545 286 L676 264" markerEnd="url(#mt-ar)" />
            <path className="mt-fig__arrow" d="M709 216 L739 198" markerEnd="url(#mt-ar)" />
            <path className="mt-fig__arrow" d="M739 152 L769 134" markerEnd="url(#mt-ar)" />
            <path className="mt-fig__arrow" d="M769 88 L799 68" markerEnd="url(#mt-ar)" />
            {/* skips */}
            <path className="mt-fig__skip" d="M282 44 L706 44" strokeDasharray="5 4" markerEnd="url(#mt-ar-skip)" />
            <path className="mt-fig__skip" d="M312 108 L676 108" strokeDasharray="5 4" markerEnd="url(#mt-ar-skip)" />
            <path className="mt-fig__skip" d="M342 172 L646 172" strokeDasharray="5 4" markerEnd="url(#mt-ar-skip)" />
            <path className="mt-fig__skip" d="M372 236 L616 236" strokeDasharray="5 4" markerEnd="url(#mt-ar-skip)" />
            <text className="mt-fig__skiplabel" x="494" y="38" textAnchor="middle">skip connections — detail handed straight across</text>
          </svg>

          <div className="mt-legend">
            <span><i style={{ background: 'var(--s-cool)' }} />Mamba runs here</span>
            <span><i style={{ background: 'var(--surface-hi)', border: '1px solid var(--line)' }} />Convolution only</span>
            <span><i style={{ background: 'var(--ink)' }} />Bottleneck (deepest point)</span>
            <span><i style={{ background: 'var(--s-hot)' }} />Final mask out</span>
          </div>

          <figcaption>
            The input goes in top-left and the mask comes out top-right at exactly the same size, so the
            prediction lines up voxel-for-voxel with the scan. Mamba only appears in the bottom three
            rows — that is deliberate, and it is the section after next. {ref('netInit')}
          </figcaption>
        </figure>
      </section>

      {/* ---------- models/ ---------- */}
      <section className="mt-section">
        <span className="mt-section__label">models/ — four files</span>
        <h3>The network itself</h3>
        <p className="mt-sub">
          Built bottom-up: a reusable block, a contracting path, an expanding path, and a wrapper that
          joins them. Every file has a self-test that runs on the GPU.
        </p>

        <div className="mt-cards">
          <article className="mt-card mt-card--key">
            <div className="mt-card__top">
              <span className="mt-card__name">mamba_block_3d.py</span>
              <span className="mt-card__plain">the new idea</span>
              <span className="mt-card__loc">213 lines</span>
            </div>
            <ul className="mt-list">
              <li>
                Takes a 3D block of features and <strong>flattens it into a single long line</strong> of
                voxels, because Mamba reads sequences, not volumes. {ref('flatten')}
              </li>
              <li>
                Runs a <strong>selective scan</strong> along that line — it sweeps through carrying a small
                memory, and a learned gate decides at each voxel whether it is worth remembering.
                A lesion gets latched into that memory and survives hundreds of background voxels. {ref('core')}
              </li>
              <li>
                Does this in <strong>six directions</strong> (left–right, up–down, front–back, each way) and
                adds the results together. {ref('dirs')}
              </li>
              <li>
                Folds the line back into a 3D block — the exact inverse of the flatten, which is the single
                most bug-prone part of the file. {ref('unflatten')}
              </li>
              <li>
                Shape in equals shape out, so it can be dropped anywhere without disturbing the
                rest. {ref('blockForward')}
              </li>
            </ul>
            <p className="mt-sayit">
              <b>Say it like this</b>
              It reads the volume like a sentence, six times, in six different reading orders — so nothing
              gets missed just because of the order you happened to read in.
            </p>
          </article>

          <article className="mt-card mt-card--done">
            <div className="mt-card__top">
              <span className="mt-card__name">encoder.py</span>
              <span className="mt-card__plain">the way down</span>
              <span className="mt-card__loc">188 lines</span>
            </div>
            <ul className="mt-list">
              <li>
                Five stages. Each one <strong>halves the resolution and adds more channels</strong>, so the
                network trades "where exactly" for "what is it". {ref('encInit')}
              </li>
              <li>
                The halving is a stride-2 convolution, with the residual path projected to match so the
                skip-add still lines up. {ref('convBlock')}
              </li>
              <li>
                Stage 0 deliberately stays at <strong>full resolution</strong> — that keeps a sharp
                fine-detail shortcut for the decoder and matches how nnU-Net is built.
              </li>
              <li>
                Mamba blocks are switched on only in the deepest three stages; everything else is plain
                convolution. {ref('encStage')}
              </li>
              <li>
                Hands out <strong>every stage's output</strong>, not just the last one — those are the
                shortcuts. {ref('encForward')}
              </li>
            </ul>
            <p className="mt-sayit">
              <b>Say it like this</b>
              It zooms out step by step. Each step it sees less detail but understands more context.
            </p>
          </article>

          <article className="mt-card mt-card--done">
            <div className="mt-card__top">
              <span className="mt-card__name">decoder.py</span>
              <span className="mt-card__plain">the way up</span>
              <span className="mt-card__loc">80 lines</span>
            </div>
            <ul className="mt-list">
              <li>
                Mirrors the encoder exactly — it reads the encoder's own settings, so the two{' '}
                <strong>cannot drift out of step</strong>. {ref('decInit')}
              </li>
              <li>
                At each level it <strong>doubles the resolution back up</strong>, glues on the matching
                shortcut from the encoder, and blends them together. {ref('decForward')}
              </li>
              <li>A final one-voxel-wide layer squeezes everything down to <strong>a single number per voxel</strong>.</li>
              <li>Pure convolution — no Mamba on the way up. Keeps it simple and keeps the comparison clean.</li>
            </ul>
            <p className="mt-sayit">
              <b>Say it like this</b>
              It zooms back in, and at each step it borrows the sharp edges it saved on the way down.
            </p>
          </article>

          <article className="mt-card mt-card--done">
            <div className="mt-card__top">
              <span className="mt-card__name">psma_mamba.py</span>
              <span className="mt-card__plain">the whole net</span>
              <span className="mt-card__loc">97 lines</span>
            </div>
            <ul className="mt-list">
              <li>
                Joins encoder and decoder. The actual forward pass is{' '}
                <strong>one line of code</strong>. {ref('netInit')}
              </li>
              <li>
                Builds the entire network from a single YAML config, so an experiment is a{' '}
                <strong>config edit, not a code change</strong>. {ref('netConfig')}
              </li>
              <li><strong>39.7 million parameters</strong> — the same order of magnitude as the nnU-Net baseline.</li>
              <li>Verified on GPU: input and output spatial dimensions match, and gradients flow all the way back.</li>
            </ul>
            <p className="mt-sayit">
              <b>Say it like this</b>
              This is the model. Everything above it is a building block.
            </p>
          </article>
        </div>
      </section>

      {/* ---------- the key decision ---------- */}
      <section className="mt-section">
        <span className="mt-section__label">The one decision to be ready to defend</span>
        <h3>Why Mamba only goes in the deep half</h3>
        <p className="mt-sub">
          This is the question most likely to come up, and it has a clean numerical answer.
          Mamba's cost scales with how many voxels are in the flattened line.
        </p>

        <div className="mt-chart">
          <div className="mt-chart__title">Voxels in the flattened line, per stage</div>
          <div className="mt-chart__sub">
            For one 64 × 128 × 64 patch. Bars use a <strong>logarithmic</strong> scale — each stage is
            genuinely 8× smaller than the one above it.
          </div>

          <div className="mt-chart__legend">
            <span><i style={{ background: 'var(--s-hot)' }} />Too long to scan — convolution only</span>
            <span><i style={{ background: 'var(--s-cool)' }} />Short enough — Mamba runs here</span>
          </div>

          <table className="mt-bars">
            <caption>Sequence length per encoder stage, and whether Mamba blocks run at that stage</caption>
            <thead>
              <tr>
                <th scope="col">Stage</th>
                <th scope="col">Grid</th>
                <th scope="col" className="mt-bars__track">Voxels in the line (log scale)</th>
                <th scope="col" className="mt-bars__val">Count</th>
                <th scope="col" className="mt-bars__runs">Runs</th>
              </tr>
            </thead>
            <tbody>
              {STAGES.map((s) => (
                <tr key={s.stage} tabIndex={0}>
                  <td className="mt-bars__stage">{s.stage}</td>
                  <td className="mt-bars__dims">{s.dims}</td>
                  <td className="mt-bars__track">
                    <div className="mt-bars__rail">
                      <span
                        className="mt-bars__fill"
                        style={{ width: `${s.pct}%`, background: s.hot ? 'var(--s-hot)' : 'var(--s-cool)' }}
                      />
                      <span className="mt-bars__tip">
                        <b>{s.dims}</b> — {s.tip}
                      </span>
                    </div>
                  </td>
                  <td className="mt-bars__val">{s.L.toLocaleString()}</td>
                  <td className="mt-bars__runs">{s.runs}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <p className="mt-chart__note">
            Every halving of resolution divides the line by <strong>eight</strong>. Between the stem and
            the bottleneck that is a <strong>4,096×</strong> reduction. Running six-direction Mamba at full
            resolution would mean scanning over three million positions per block; at the bottleneck it is
            768. That is the entire justification for the <code>(0, 0, 2, 2, 4)</code> layout — and it also
            happens to be where long-range context is most useful anyway. {ref('encInit')}
          </p>
        </div>
      </section>

      {/* ---------- training/ ---------- */}
      <section className="mt-section">
        <span className="mt-section__label">training/ — three files</span>
        <h3>How it learns</h3>
        <p className="mt-sub">The scoring rule, the learning-rate schedule, and the loop that ties them together.</p>

        <div className="mt-cards">
          <article className="mt-card mt-card--key">
            <div className="mt-card__top">
              <span className="mt-card__name">loss.py</span>
              <span className="mt-card__plain">how "wrong" is measured</span>
              <span className="mt-card__loc">110 lines</span>
            </div>
            <ul className="mt-list">
              <li>
                The score the model is pushed to improve. Four options are implemented; the default is{' '}
                <strong>Tversky + a bit of cross-entropy</strong>. {ref('lossBuild')}
              </li>
              <li>
                Tversky lets you <strong>weight a miss differently from a false alarm</strong> — the section
                below explains why that matters clinically. {ref('lossTversky')}
              </li>
              <li>
                The cross-entropy term is what supplies usable gradients in the first few hundred steps,
                before the masks overlap enough for Tversky to say anything. {ref('lossCombined')}
              </li>
              <li>
                Deliberately ignores the voxels it gets right for free. Under 1% of a whole-body scan is
                tumour, so a model predicting "nothing anywhere" would score 99% on plain
                accuracy. {ref('lossFlatten')}
              </li>
              <li>
                Also provides a plain Dice score used purely for <strong>monitoring</strong>, because that
                is the number everyone else reports. {ref('lossDice')}
              </li>
            </ul>
            <p className="mt-sayit">
              <b>Say it like this</b>
              It marks the model's homework, and it is marked so that missing a lesion costs more than a
              false alarm.
            </p>
          </article>

          <article className="mt-card mt-card--done">
            <div className="mt-card__top">
              <span className="mt-card__name">scheduler.py</span>
              <span className="mt-card__plain">how fast it learns</span>
              <span className="mt-card__loc">28 lines</span>
            </div>
            <ul className="mt-list">
              <li>
                Starts the learning rate near <strong>zero and ramps it up over the first 50 steps</strong>,
                then eases it back down along a cosine curve for the rest of the run. {ref('sched')}
              </li>
              <li>
                The warm-up exists because Mamba's parameters start in a state where a full-speed first
                step can <strong>destabilise the whole run</strong>.
              </li>
              <li>Winding down at the end lets the model settle into a good solution instead of bouncing around it.</li>
              <li>
                Smallest file in the project — 28 lines — but it is the difference between a run that
                converges and one that diverges.
              </li>
            </ul>
            <p className="mt-sayit">
              <b>Say it like this</b>
              Ease off the line, get up to speed, then brake gently into the finish.
            </p>
          </article>

          <article className="mt-card mt-card--done">
            <div className="mt-card__top">
              <span className="mt-card__name">train.py</span>
              <span className="mt-card__plain">the loop</span>
              <span className="mt-card__loc">171 lines</span>
            </div>
            <ul className="mt-list">
              <li>
                Finds the scans and <strong>splits them by patient</strong> — the same patient appearing in
                both training and validation would inflate the result. {ref('trainSplit')}
              </li>
              <li>
                Builds the model, loss, optimizer and schedule from one config, then runs the
                loop. {ref('trainSetup')}
              </li>
              <li>
                Uses <strong>mixed precision</strong>, which roughly halves memory use and lets bigger
                patches fit on the GPU. {ref('trainStep')}
              </li>
              <li>
                Counts progress in <strong>iterations rather than epochs</strong>, because patches are
                sampled randomly rather than swept through in order.
              </li>
              <li>
                Has an <code>--overfit</code> mode: deliberately train and validate on the same two cases.
                If the model cannot memorise those, something is broken — the fastest sanity check
                available.
              </li>
              <li>
                Saves a checkpoint and reports validation Dice at the end. {ref('trainCkpt')}
              </li>
              <li>
                AdamW by default, with an SGD branch that matches nnU-Net exactly when a like-for-like
                comparison is wanted. {ref('trainOptim')}
              </li>
            </ul>
            <p className="mt-sayit">
              <b>Say it like this</b>
              Everything is driven by one config file, so an experiment is a config edit rather than a code change.
            </p>
          </article>
        </div>
      </section>

      {/* ---------- tversky ---------- */}
      <section className="mt-section">
        <span className="mt-section__label">The scoring choice</span>
        <h3>Why a miss costs more than a false alarm</h3>
        <p className="mt-sub">
          Standard Dice treats both errors as equally bad. Clinically they are not. Tversky is the same
          idea with a dial on it — and the dial is set deliberately.
        </p>

        <div className="mt-seesaw">
          <div className="mt-pan">
            <div className="mt-pan__top">
              <h4>False alarm</h4>
              <span className="mt-pan__w">α = 0.3</span>
            </div>
            <div className="mt-pan__bar"><i style={{ width: '30%', background: 'var(--s-cool)' }} /></div>
            <p>
              Model flags something that is not a lesion. Annoying, and it costs precision — but a
              radiologist looks at it and dismisses it.
            </p>
          </div>
          <div className="mt-pan">
            <div className="mt-pan__top">
              <h4>Missed lesion</h4>
              <span className="mt-pan__w">β = 0.7</span>
            </div>
            <div className="mt-pan__bar"><i style={{ width: '70%', background: 'var(--s-hot)' }} /></div>
            <p>
              Model fails to find real disease. This is the expensive one — it can change staging and
              treatment. Weighted <strong>more than twice as heavily</strong>.
            </p>
          </div>
        </div>

        <div className="mt-callout">
          <p>
            <strong>Be ready for the follow-up:</strong> "doesn't that just make it over-predict?" — yes,
            that is exactly the trade. It buys sensitivity by spending precision. Both numbers get
            reported, and because the weights live in the config they are a tunable experiment rather than
            a hard-coded belief. Setting both to 0.5 recovers ordinary Dice. {ref('lossTversky')}
          </p>
        </div>
      </section>

      {/* ---------- status ---------- */}
      <section className="mt-section">
        <span className="mt-section__label">Honest status</span>
        <h3>Where this actually stands</h3>
        <p className="mt-sub">
          Worth being upfront about the gap between "the code works" and "the model works" — they are
          different claims, and only the first is currently supported.
        </p>

        <div className="mt-status">
          <div className="mt-st mt-st--done">
            <div className="mt-st__k">Done</div>
            <h4>The plumbing</h4>
            <p>
              All seven files build, run on the GPU, and pass their self-tests. A patch goes in, a
              same-sized mask comes out, and gradients reach every parameter.
            </p>
          </div>
          <div className="mt-st mt-st--done">
            <div className="mt-st__k">Done</div>
            <h4>It can learn</h4>
            <p>
              The overfit sanity check works — pointed at a couple of fixed patches, the loss falls and the
              model memorises them. That proves the loop is wired up correctly.
            </p>
          </div>
          <div className="mt-st mt-st--todo">
            <div className="mt-st__k">Not yet</div>
            <h4>A real training run</h4>
            <p>
              No full run on AutoPET has happened yet, so <strong>there is no meaningful accuracy
              number</strong>. The saved checkpoint is from the sanity check and should not be quoted as a
              result.
            </p>
          </div>
        </div>

        <div className="mt-callout">
          <p>
            <strong>Next three steps:</strong> add experiment tracking to the training loop, launch the
            first real run on the AutoPET III PSMA set (597 studies, 378 patients), then build the
            inference and evaluation side so the comparison against nnU-Net can actually be scored.
          </p>
        </div>
      </section>

      {/* ---------- faq ---------- */}
      <section className="mt-section">
        <span className="mt-section__label">What you might get asked</span>
        <h3>Likely questions, short answers</h3>
        <p className="mt-sub">
          Each answer is written the way you would say it out loud, not the way a paper would write it.
        </p>

        <div className="mt-faq">
          {FAQ.map(([q, paras]) => (
            <details className="mt-q" key={q}>
              <summary>{q}</summary>
              <div className="mt-q__a">
                {paras.map((p, i) => <p key={i}>{p}</p>)}
              </div>
            </details>
          ))}
        </div>
      </section>

      {openCode && <CodeModal id={openCode} onClose={close} />}
    </div>
  );
}
