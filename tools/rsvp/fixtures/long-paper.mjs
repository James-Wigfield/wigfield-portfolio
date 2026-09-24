/* ============================================================================
   FIXTURE — a SYNTHETIC 30+-page ML paper in the MCP payload shape
   ----------------------------------------------------------------------------
   Deterministic (seeded) generator for a paper the size and shape of the ones
   James reads: ~35k words / ~260 KB of JSON across ~60 sections, three
   heading levels (e.g. "3.3.1 Motivation of Prior Models"), heavy inline maths
   as Unicode, display equations (LaTeX), pseudocode algorithms, dense numeric
   tables as markdown, theorems and proofs in the appendix, bulleted lists,
   and bolded key findings. The prose is template-assembled, so it is NOT a
   real paper — it exists to exercise chunked upload, timing and the reader
   at realistic scale.
   ========================================================================== */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// mulberry32
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MODELS = ['SegResMamba', 'the selective state-space model', 'the Transformer baseline', 'a residual U-Net', 'nnU-Net', 'SwinUNETR', 'Mamba-2', 'S4', 'the hybrid CNN–SSM encoder', 'UNETR'];
const DATASETS = ['BraTS 2021', 'BTCV', 'AutoPET', 'the whole-body PSMA PET/CT cohort', 'the Spleen task', 'AMOS 2022', 'TotalSegmentator'];
const METRICS = ['Dice', 'IoU', 'the 95th-percentile Hausdorff distance', 'normalised surface distance', 'F1', 'lesion-wise sensitivity'];
const SYMS = ['O(BLDN)', 'O(L²)', 'Δ', 'h_t', 'x_t ∈ ℝ^d', '2^20', '≈ 0.93', 'β > α', '∇θ L', 'σ(z)', 'λ = 1e-4', 'N = 128³', 'A ∈ ℝ^{N×N}', 'exp(ΔA)', 'K = 3×3×3', 'τ → 0', 'Σ_i w_i', '‖x‖₂ ≤ 1'];
const NOUNS = ['selective scan', 'gating pathway', 'receptive field', 'channel mixer', 'skip connection', 'downsampling stem', 'state transition', 'input-dependent step size', 'scan ordering', 'residual bottleneck'];
const VERBS = ['reduces', 'halves', 'stabilises', 'sharpens', 'compresses', 'amortises', 'decouples'];

const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
const int = (r, a, b) => a + Math.floor(r() * (b - a + 1));
const dec = (r, a, b, d = 2) => (a + r() * (b - a)).toFixed(d);

const TEMPLATES = [
  (r) => `We train ${pick(r, MODELS)} on ${pick(r, DATASETS)} for ${int(r, 100, 1000)} epochs with a learning rate of ${pick(r, ['1e-4', '3e-4', '5e-5'])} and report ${pick(r, METRICS)} on the held-out split.`,
  (r) => `Compared with ${pick(r, MODELS)}, ${pick(r, MODELS)} ${pick(r, VERBS)} peak training memory by ${int(r, 18, 64)}% while matching ${pick(r, METRICS)} within ${dec(r, 0.1, 0.9, 1)} points.`,
  (r) => `The recurrence ${pick(r, SYMS)} is evaluated with a hardware-aware scan whose cost grows as ${pick(r, SYMS)} rather than ${pick(r, SYMS)}, which is what makes ${int(r, 96, 256)}³ volumes tractable on a single GPU.`,
  (r) => `Let ${pick(r, SYMS)} denote the hidden state at step t; the selective update then reads ${pick(r, SYMS)}, with the discretisation ${pick(r, SYMS)} applied per channel.`,
  (r) => `This effect is most visible on ${pick(r, DATASETS)}, where ${pick(r, METRICS)} improves from ${dec(r, 0.78, 0.86, 4)} to ${dec(r, 0.86, 0.93, 4)} with no change to the decoder.`,
  (r) => `We hypothesise that the ${pick(r, NOUNS)} acts as a learned ${pick(r, NOUNS)}, and Section ${int(r, 3, 5)}.${int(r, 1, 4)} tests this directly with a controlled ablation.`,
  (r) => `Because the ${pick(r, NOUNS)} is linear in the sequence length, doubling the crop size from ${int(r, 64, 96)}³ to ${int(r, 128, 192)}³ costs ${dec(r, 1.6, 2.4, 1)}× rather than ${dec(r, 3.5, 4.4, 1)}× in wall-clock time.`,
  (r) => `In practice we found ${pick(r, ['gradient clipping at 1.0', 'bf16 autocast', 'a cosine schedule with warm-up', 'deep supervision on two scales', 'foreground-biased cropping'])} necessary; without it training diverged after roughly ${int(r, 2, 40)}k steps.`,
  (r) => `The ${pick(r, NOUNS)} ${pick(r, VERBS)} the variance of ${pick(r, SYMS)} across the batch, and the effect compounds through the ${int(r, 4, 24)} stacked blocks.`,
  (r) => `Unlike attention, whose ${pick(r, SYMS)} memory rules out full-resolution 3D inputs, the ${pick(r, NOUNS)} keeps a fixed-size state and streams voxels in ${int(r, 3, 6)} scan orders.`,
  (r) => `Across ${int(r, 3, 7)} seeds the standard deviation of ${pick(r, METRICS)} stayed below ${dec(r, 0.002, 0.009, 3)}, so the gaps we report are well outside run-to-run noise.`,
  (r) => `We ablate the ${pick(r, NOUNS)} by replacing it with an identity map; ${pick(r, METRICS)} drops by ${dec(r, 0.8, 4.2, 1)} points, confirming that the gain is not an artefact of parameter count.`,
  (r) => `Throughput at inference is ${int(r, 8, 40)} volumes per second on an A100, ${dec(r, 1.4, 3.8, 1)}× faster than ${pick(r, MODELS)} at equal ${pick(r, METRICS)}.`,
  (r) => `The bound in Theorem ${int(r, 1, 4)} tightens as ${pick(r, SYMS)}, which explains why the ${pick(r, NOUNS)} matters most in the earliest, highest-resolution stage.`,
  (r) => `Where prior work fixed the step size, we let ${pick(r, SYMS)} depend on the input through a low-rank projection of width ${int(r, 8, 64)}.`,
  (r) => `Qualitatively, failure cases cluster around small lesions below ${int(r, 3, 12)} mm, where the ${pick(r, NOUNS)} has too few voxels to accumulate evidence.`,
  (r) => `All numbers are means over ${int(r, 3, 5)}-fold cross-validation; the protocol follows ${pick(r, DATASETS)} exactly so that comparisons with published results are fair.`,
  (r) => `We set ${pick(r, SYMS)} and ${pick(r, SYMS)} by a small grid on the validation split, then froze them for every dataset in Table ${int(r, 1, 9)}.`,
];

const KEY_TEMPLATES = [
  (r) => `Our main result: ${pick(r, MODELS)} matches ${pick(r, MODELS)} on ${pick(r, DATASETS)} at ${int(r, 35, 60)}% of the training memory.`,
  (r) => `The ${pick(r, NOUNS)} is the single most important component: removing it costs ${dec(r, 2.1, 5.4, 1)} ${pick(r, METRICS)} points.`,
  (r) => `Linear-time scanning, not parameter count, is what allows full-resolution ${int(r, 128, 256)}³ training on one 40 GB GPU.`,
  (r) => `Across every dataset the gap to the best Transformer is below ${dec(r, 0.2, 0.6, 1)} points, while wall-clock training time falls by ${int(r, 20, 45)}%.`,
];

const paragraph = (r, n) => Array.from({ length: n }, () => pick(r, TEMPLATES)(r)).join(' ');

function table(r, k) {
  const rows = ['UNETR', 'SwinUNETR', 'SegMamba', 'nnU-Net', 'U-Net', 'Mamba-2', 'S4', 'SegResMamba'].slice(0, int(r, 5, 8));
  const cols = ['MACs', 'Params (M)', 'Mem (GB)', 'Dice', 'HD95', 'Time (s)'].slice(0, int(r, 4, 6));
  const lines = [`| Model | ${cols.join(' | ')} |`, `|---|${cols.map(() => '---:').join('|')}|`];
  for (const m of rows) {
    lines.push(`| ${m} | ${cols.map((c) => c === 'MACs' ? `${dec(r, 30, 1600, 2)}G` : c === 'Dice' ? dec(r, 0.78, 0.93, 4) : c === 'Mem (GB)' ? dec(r, 0.9, 14.2, 2) : c === 'HD95' ? dec(r, 2.1, 12.4, 2) : c === 'Params (M)' ? dec(r, 4.8, 150, 2) : dec(r, 0.02, 0.2, 4)).join(' | ')} |`);
  }
  return {
    type: 'table',
    label: `Table ${k}`,
    caption: `${pick(r, MODELS)} reaches ${pick(r, METRICS)} ${dec(r, 0.84, 0.93, 4)} on ${pick(r, DATASETS)} with ${int(r, 2, 5)}× fewer MACs than the strongest baseline; the ranking holds for every column.`,
    content: lines.join('\n'),
  };
}

const EQS = [
  ['h_t = \\bar{A}\\, h_{t-1} + \\bar{B}\\, x_t, \\qquad y_t = C\\, h_t', 'The discretised state-space recurrence: the hidden state carries the past, the readout projects it to the output.'],
  ['\\bar{A} = \\exp(\\Delta A), \\qquad \\bar{B} = (\\Delta A)^{-1}(\\exp(\\Delta A) - I)\\, \\Delta B', 'Zero-order-hold discretisation with an input-dependent step size Δ.'],
  ['\\mathcal{L} = 1 - \\frac{2\\sum_i p_i g_i + \\epsilon}{\\sum_i p_i + \\sum_i g_i + \\epsilon}', 'Soft Dice loss over voxels; ε keeps the ratio defined on empty masks.'],
  ['\\text{ToM}(z) = \\text{Mamba}(z_f) + \\text{Mamba}(z_r) + \\text{Mamba}(z_s)', 'Tri-oriented scanning sums three passes over different flattenings of the volume.'],
  ['\\Delta_t = \\text{softplus}(W_\\Delta x_t + b_\\Delta)', 'The step size is predicted from the input, which is what makes the scan selective.'],
  ['\\|h_t\\|_2 \\le \\|h_0\\|_2 \\prod_{k=1}^{t} \\|\\bar{A}_k\\|_2 + \\sum_{k=1}^{t} \\|\\bar{B}_k x_k\\|_2', 'A bound on the state norm; stability follows when every ‖Ā_k‖ is below one.'],
  ['\\text{FLOPs} \\approx 9\\, B L D N + 2\\, B L D^2', 'Compute per layer is linear in the sequence length L.'],
];

function equation(r, k) {
  const [content, caption] = pick(r, EQS);
  return { type: 'equation', label: `Eq. ${k}`, caption, content };
}

function algorithm(r, k) {
  const lines = [
    `Input: volume X ∈ ℝ^{C×D×H×W}, scan orders S = {forward, reverse, inter-slice}`,
    `Output: features Y`,
    `1: F ← Conv_{${pick(r, ['5×5×5', '3×3×3'])}}(X)`,
    `2: for each order s in S do`,
    `3:     z_s ← flatten(F, s)`,
    `4:     Δ_s ← softplus(W_Δ z_s + b_Δ)`,
    `5:     h_s ← selective_scan(z_s, Δ_s, A, B)`,
    `6:     y_s ← C h_s`,
    `7: end for`,
    `8: Y ← unflatten(Σ_s y_s) + X`,
    `9: return Y`,
  ];
  return { type: 'algorithm', label: `Algorithm ${k}`, caption: `The ${pick(r, NOUNS)} forward pass: flatten the volume in each scan order, run the selective scan, sum the results and add the residual.`, content: lines.join('\n') };
}

function figure(r, k) {
  return { type: 'figure', label: `Figure ${k}`, caption: `${pick(r, METRICS)} against ${pick(r, ['training memory (GB)', 'MACs', 'wall-clock hours', 'crop size'])} for ${int(r, 4, 7)} models on ${pick(r, DATASETS)}; ${pick(r, MODELS)} sits in the upper-left corner, i.e. high accuracy at low cost.` };
}

function list(r) {
  const n = int(r, 3, 6);
  return { type: 'list', items: Array.from({ length: n }, () => pick(r, TEMPLATES)(r)) };
}

export function longPaper(seed = 7, scale = 1.5) {
  const r = rng(seed);
  const counters = { fig: 0, tab: 0, eq: 0, alg: 0 };
  const sections = [];

  const section = (heading, level, part, opts = {}) => {
    const blocks = [];
    const paras = Math.max(1, Math.round(int(r, opts.min ?? 2, opts.max ?? 5) * scale));
    for (let p = 0; p < paras; p++) {
      blocks.push({ type: 'text', text: paragraph(r, int(r, 4, 7)) });
      if (opts.floats && r() < 0.35) {
        const kind = pick(r, opts.floats);
        if (kind === 'figure') blocks.push(figure(r, ++counters.fig));
        if (kind === 'table') blocks.push(table(r, ++counters.tab));
        if (kind === 'equation') blocks.push(equation(r, ++counters.eq));
        if (kind === 'algorithm') blocks.push(algorithm(r, ++counters.alg));
      }
      if (r() < 0.12) blocks.push(list(r));
    }
    if (opts.key || r() < 0.4) blocks.splice(int(r, 1, blocks.length), 0, { type: 'text', text: pick(r, KEY_TEMPLATES)(r), key: true });
    sections.push({ heading, level, part, blocks });
  };

  // ── main body ────────────────────────────────────────────────────────────
  section('Abstract', 1, 'main', { min: 1, max: 2, key: true });
  section('1 Introduction', 1, 'main', { floats: ['figure'] });
  section('1.1 Why 3D segmentation is memory-bound', 2, 'main', { floats: ['equation'] });
  section('1.2 Contributions', 2, 'main', { min: 1, max: 2, key: true });
  section('2 Background', 1, 'main', { min: 1, max: 2 });
  section('2.1 Structured state-space models', 2, 'main', { floats: ['equation', 'equation'] });
  section('2.2 Selective scanning', 2, 'main', { floats: ['equation', 'algorithm'] });
  section('2.3 Hybrid convolution–SSM encoders', 2, 'main', { floats: ['figure'] });
  section('2.3.1 Where attention breaks down', 3, 'main', { min: 1, max: 3, floats: ['equation'] });
  section('2.3.2 Scan orderings in three dimensions', 3, 'main', { min: 1, max: 3, floats: ['figure'] });
  section('3 Method', 1, 'main', { min: 1, max: 2, floats: ['figure'] });
  section('3.1 Encoder', 2, 'main', { floats: ['figure', 'algorithm'] });
  section('3.1.1 Downsampling stem', 3, 'main', { min: 1, max: 3 });
  section('3.1.2 Convolution–Mamba mixed block', 3, 'main', { floats: ['algorithm', 'equation'] });
  section('3.2 Decoder', 2, 'main', { floats: ['figure'] });
  section('3.3 Training objective', 2, 'main', { floats: ['equation'] });
  section('3.3.1 Motivation of Prior Models', 3, 'main', { min: 1, max: 3, key: true });
  section('3.3.2 Deep supervision', 3, 'main', { min: 1, max: 2, floats: ['equation'] });
  section('3.4 Complexity analysis', 2, 'main', { floats: ['equation', 'table'] });
  section('4 Experiments', 1, 'main', { min: 1, max: 1 });
  section('4.1 Datasets', 2, 'main', { min: 2, max: 4 });
  section('4.2 Implementation details', 2, 'main', { min: 2, max: 3 });
  section('4.3 Main results', 2, 'main', { floats: ['table', 'table', 'figure'], key: true });
  section('4.3.1 Brain tumour segmentation', 3, 'main', { floats: ['table'] });
  section('4.3.2 Multi-organ segmentation', 3, 'main', { floats: ['table'] });
  section('4.3.3 Whole-body PET lesions', 3, 'main', { floats: ['table', 'figure'], key: true });
  section('4.4 Ablations', 2, 'main', { floats: ['table', 'table'] });
  section('4.5 Efficiency', 2, 'main', { floats: ['figure', 'table'] });
  section('5 Analysis', 1, 'main', { min: 1, max: 2 });
  section('5.1 What the selective scan learns', 2, 'main', { floats: ['figure'] });
  section('5.2 Failure modes', 2, 'main', { floats: ['figure'] });
  section('5.3 Sensitivity to crop size', 2, 'main', { floats: ['table'] });
  section('6 Related work', 1, 'main', { min: 3, max: 5 });
  section('7 Limitations', 1, 'main', { min: 1, max: 2 });
  section('8 Conclusion', 1, 'main', { min: 1, max: 2, key: true });

  // ── appendix ─────────────────────────────────────────────────────────────
  section('A Proofs', 1, 'appendix', { min: 1, max: 1 });
  section('A.1 Theorem 1 (state stability)', 2, 'appendix', { floats: ['equation', 'equation'] });
  section('A.2 Proof of Theorem 1', 2, 'appendix', { floats: ['equation', 'equation', 'equation'] });
  section('A.3 Lemma 2 and its proof', 2, 'appendix', { floats: ['equation'] });
  section('B Additional results', 1, 'appendix', { min: 1, max: 1 });
  section('B.1 Per-organ Dice on BTCV', 2, 'appendix', { floats: ['table', 'table'] });
  section('B.2 Per-region Dice on BraTS', 2, 'appendix', { floats: ['table'] });
  section('B.3 Lesion-level metrics on PSMA PET', 2, 'appendix', { floats: ['table', 'figure'] });
  section('C Hyperparameters', 1, 'appendix', { floats: ['table'] });
  section('C.1 Optimiser and schedule', 2, 'appendix', { min: 1, max: 2 });
  section('C.2 Augmentation', 2, 'appendix', { min: 1, max: 2 });
  section('D Algorithm details', 1, 'appendix', { floats: ['algorithm', 'algorithm'] });
  section('D.1 Hardware-aware scan', 2, 'appendix', { floats: ['algorithm', 'equation'] });
  section('D.2 Numerical stability of the discretisation', 2, 'appendix', { floats: ['equation'] });
  section('E Extended ablations', 1, 'appendix', { floats: ['table', 'table', 'table'] });
  section('E.1 Scan orders', 2, 'appendix', { floats: ['table'] });
  section('E.2 State dimension', 2, 'appendix', { floats: ['table', 'figure'] });
  section('E.3 Kernel size', 2, 'appendix', { floats: ['table'] });
  section('F Compute and carbon footprint', 1, 'appendix', { floats: ['table'] });
  section('F.1 Training time', 2, 'appendix', { min: 1, max: 2, floats: ['table'] });
  section('F.2 Estimated CO₂ emissions', 2, 'appendix', { min: 1, max: 2 });

  return {
    title: 'Linear-Time Selective Scanning for Full-Resolution 3D Medical Image Segmentation',
    authors: ['J. Wigfield', 'A. Researcher', 'B. Coauthor', 'C. Supervisor'],
    year: 2026,
    source: '10.0000/synthetic.fixture',
    sections,
  };
}

// Greedy batching under a JSON byte budget (what the chat Claude is told to do).
export function chunkSections(sections, maxBytes = 100_000) {
  const batches = [];
  let cur = [];
  let size = 2;
  for (const s of sections) {
    const b = Buffer.byteLength(JSON.stringify(s)) + 1;
    if (cur.length && size + b > maxBytes) { batches.push(cur); cur = []; size = 2; }
    cur.push(s);
    size += b;
  }
  if (cur.length) batches.push(cur);
  return batches;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const p = longPaper();
  const bytes = Buffer.byteLength(JSON.stringify(p));
  const kinds = {};
  let words = 0;
  for (const s of p.sections) for (const b of s.blocks) {
    kinds[b.type] = (kinds[b.type] || 0) + 1;
    if (b.type === 'text') words += b.text.split(/\s+/).length;
    if (b.type === 'list') words += b.items.join(' ').split(/\s+/).length;
    if (b.caption) words += b.caption.split(/\s+/).length;
  }
  console.log(JSON.stringify({ sections: p.sections.length, appendix: p.sections.filter((s) => s.part === 'appendix').length, kinds, words, kb: Math.round(bytes / 1000), keyBlocks: p.sections.flatMap((s) => s.blocks).filter((b) => b.key).length, batches: chunkSections(p.sections).map((b) => Math.round(Buffer.byteLength(JSON.stringify(b)) / 1000)) }, null, 2));
}
