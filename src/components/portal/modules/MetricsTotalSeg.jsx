import { useEffect, useState } from 'react';

/* ============================================================================
   METRICS & TOTALSEG — post-run-3 baseline investigation  (University)
   ----------------------------------------------------------------------------
   Two write-ups on one page, both evidence-first (every claim carries a
   file:line citation into Mamba_PSMA or the supervisors' read-only repos):

     1. Metrics feasibility — how my lesion sensitivity is computed (global /
        micro-averaged), how the supervisors' PSMA_Auto_Seg code computes
        theirs, and what it takes to score my masks with their code.
     2. TotalSegmentator — what it actually does inside PSMASegmentator:
        train-time auxiliary organ supervision (not an input channel, not a
        post-hoc mask), plus its inference-time classification role.

   Code snippets are highlighted with Shiki using the VS Code "Dark+" theme
   (dark-plus), so colours match the editor exactly. Snippets are verbatim from
   the cited files; `# ...` marks an elision, never a paraphrase.

   Prose uses the shared .mu-* toolkit from portal.css; everything new here is
   scoped under .mts-*. Diagram colour code follows the training-runs kit:
   orange = uptake/truth, blue = the model, ink dashes = anatomy.
   ========================================================================== */

/* ── Shiki code block — VS Code Dark+ ─────────────────────────────────────── */

/* Fine-grained shiki: only the python grammar + dark-plus theme are bundled
   (lazy chunks), and the JS regex engine avoids the ~600 kB oniguruma wasm.
   Importing from the top-level 'shiki' package would emit a chunk per grammar. */
let highlighterPromise = null;
function getHighlighter() {
  if (!highlighterPromise) {
    highlighterPromise = Promise.all([
      import('shiki/core'),
      import('shiki/engine/javascript'),
    ]).then(([{ createHighlighterCore }, { createJavaScriptRegexEngine }]) =>
      createHighlighterCore({
        themes: [import('@shikijs/themes/dark-plus')],
        langs: [import('@shikijs/langs/python')],
        engine: createJavaScriptRegexEngine(),
      })
    );
  }
  return highlighterPromise;
}

function Code({ file, lines, caption, code }) {
  const [html, setHtml] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    getHighlighter().then((h) => {
      if (alive) setHtml(h.codeToHtml(code, { lang: 'python', theme: 'dark-plus' }));
    });
    return () => { alive = false; };
  }, [code]);

  const copy = () => {
    navigator.clipboard?.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    });
  };

  return (
    <figure className="mts-code">
      <figcaption className="mts-code__head">
        <span className="mts-code__file">{file}</span>
        {lines && <span className="mts-code__lines">{lines}</span>}
        <button type="button" className="mts-code__copy" onClick={copy}>
          {copied ? 'copied' : 'copy'}
        </button>
      </figcaption>
      {html ? (
        <div className="mts-code__body" dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <div className="mts-code__body"><pre className="mts-code__plain">{code}</pre></div>
      )}
      {caption && <p className="mts-code__cap">{caption}</p>}
    </figure>
  );
}

/* ── Citation chip ────────────────────────────────────────────────────────── */

function Cite({ children }) {
  return <span className="mts-cite">{children}</span>;
}

/* ── Diagram 1: where TotalSegmentator sits in the baseline pipeline ──────── */

function PipelineDiagram() {
  return (
    <div className="mts-diagram" role="img"
      aria-label="Pipeline diagram. Training: CT goes through TotalSegmentator to make organ pseudo-labels; the shared nnU-Net has a lesion head and an organ head, and both losses are summed. Inference: the organ head is off; TotalSegmentator runs only in post-processing for classification, and no lesion is deleted.">

      <p className="mts-lane__label">Train time — anatomy enters through the loss</p>
      <svg viewBox="0 0 880 208" className="mts-svg">
        <defs>
          <marker id="mts-arr" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
            <path d="M0 0 L8 4 L0 8 z" className="mts-arrhead" />
          </marker>
        </defs>

        {/* row 1 — the one-off pseudo-label build */}
        <rect className="mts-box" x="10" y="16" width="92" height="36" rx="6" />
        <text className="mts-tx" x="56" y="38" textAnchor="middle">CT volume</text>

        <rect className="mts-box mts-box--ts" x="150" y="16" width="150" height="36" rx="6" />
        <text className="mts-tx" x="225" y="38" textAnchor="middle">TotalSegmentator</text>

        <rect className="mts-box" x="332" y="10" width="260" height="48" rx="6" />
        <text className="mts-tx" x="462" y="30" textAnchor="middle">organ pseudo-labels</text>
        <text className="mts-tx mts-tx--dim" x="462" y="46" textAnchor="middle">bladder, kidneys, liver… → _seg_org.npy</text>

        <line className="mts-arrow" x1="102" y1="34" x2="144" y2="34" markerEnd="url(#mts-arr)" />
        <line className="mts-arrow" x1="300" y1="34" x2="326" y2="34" markerEnd="url(#mts-arr)" />

        {/* pseudo-labels feed the organ loss (routed right of the loss boxes) */}
        <path className="mts-arrow" d="M 592 46 C 702 60 692 102 664 140" fill="none" markerEnd="url(#mts-arr)" />

        {/* row 2 — the training step */}
        <rect className="mts-box" x="10" y="120" width="92" height="36" rx="6" />
        <text className="mts-tx" x="56" y="142" textAnchor="middle">PET + CT</text>

        <rect className="mts-box mts-box--net" x="150" y="104" width="150" height="68" rx="6" />
        <text className="mts-tx" x="225" y="132" textAnchor="middle">ResEnc U-Net</text>
        <text className="mts-tx mts-tx--dim" x="225" y="150" textAnchor="middle">shared enc + dec</text>

        <rect className="mts-box mts-box--model" x="348" y="96" width="128" height="30" rx="6" />
        <text className="mts-tx" x="412" y="115" textAnchor="middle">lesion head</text>
        <rect className="mts-box mts-box--model" x="348" y="146" width="128" height="30" rx="6" />
        <text className="mts-tx" x="412" y="165" textAnchor="middle">organ head</text>

        <rect className="mts-box" x="524" y="96" width="150" height="30" rx="6" />
        <text className="mts-tx" x="599" y="115" textAnchor="middle">lesion loss ← GT</text>
        <rect className="mts-box" x="524" y="146" width="150" height="30" rx="6" />
        <text className="mts-tx" x="599" y="165" textAnchor="middle">organ loss ← pseudo</text>

        <rect className="mts-box mts-box--sum" x="722" y="120" width="140" height="38" rx="6" />
        <text className="mts-tx" x="792" y="138" textAnchor="middle">l += organ loss</text>
        <text className="mts-tx mts-tx--dim" x="792" y="152" textAnchor="middle">one backprop</text>

        <line className="mts-arrow" x1="102" y1="138" x2="144" y2="138" markerEnd="url(#mts-arr)" />
        <line className="mts-arrow" x1="300" y1="122" x2="342" y2="112" markerEnd="url(#mts-arr)" />
        <line className="mts-arrow" x1="300" y1="154" x2="342" y2="160" markerEnd="url(#mts-arr)" />
        <line className="mts-arrow" x1="476" y1="111" x2="518" y2="111" markerEnd="url(#mts-arr)" />
        <line className="mts-arrow" x1="476" y1="161" x2="518" y2="161" markerEnd="url(#mts-arr)" />
        <line className="mts-arrow" x1="674" y1="111" x2="716" y2="130" markerEnd="url(#mts-arr)" />
        <line className="mts-arrow" x1="674" y1="161" x2="716" y2="150" markerEnd="url(#mts-arr)" />
      </svg>

      <p className="mts-lane__label">Inference time — TotalSegmentator only runs after the model</p>
      <svg viewBox="0 0 880 196" className="mts-svg">
        <rect className="mts-box" x="10" y="24" width="92" height="36" rx="6" />
        <text className="mts-tx" x="56" y="46" textAnchor="middle">PET + CT</text>

        <rect className="mts-box mts-box--net" x="150" y="16" width="160" height="52" rx="6" />
        <text className="mts-tx" x="230" y="38" textAnchor="middle">ResEnc U-Net</text>
        <text className="mts-tx mts-tx--dim" x="230" y="55" textAnchor="middle">organ head OFF</text>

        <rect className="mts-box mts-box--model" x="358" y="24" width="112" height="36" rx="6" />
        <text className="mts-tx" x="414" y="46" textAnchor="middle">lesion mask</text>

        <line className="mts-arrow" x1="102" y1="42" x2="144" y2="42" markerEnd="url(#mts-arr)" />
        <line className="mts-arrow" x1="310" y1="42" x2="352" y2="42" markerEnd="url(#mts-arr)" />
        <line className="mts-arrow" x1="470" y1="42" x2="512" y2="42" markerEnd="url(#mts-arr)" />

        {/* post-processing group */}
        <rect className="mts-group" x="518" y="8" width="352" height="180" rx="8" />
        <text className="mts-tx mts-tx--grouplabel" x="534" y="30">post-processing</text>

        <rect className="mts-box mts-box--ts" x="534" y="42" width="200" height="30" rx="6" />
        <text className="mts-tx" x="634" y="61" textAnchor="middle">TotalSegmentator on CT</text>

        <rect className="mts-box" x="534" y="82" width="320" height="30" rx="6" />
        <text className="mts-tx" x="694" y="101" textAnchor="middle">classify lesions → sites &amp; biomarkers</text>

        <rect className="mts-box mts-box--opt" x="534" y="118" width="320" height="30" rx="6" />
        <text className="mts-tx" x="694" y="137" textAnchor="middle">optional: organ-aware expansion, liver clf</text>

        <line className="mts-arrow" x1="634" y1="72" x2="634" y2="78" markerEnd="url(#mts-arr)" />
        <text className="mts-tx mts-tx--verdictline" x="694" y="172" textAnchor="middle">labels &amp; metrics only — no lesion is deleted here</text>

        {/* CT feeds post-proc TotalSegmentator */}
        <path className="mts-arrow mts-arrow--dashed" d="M 56 60 C 56 152 280 170 460 152 C 500 148 516 84 526 60" fill="none" markerEnd="url(#mts-arr)" />
      </svg>
    </div>
  );
}

/* ── Diagram 2: the bladder-uptake problem, before / after ────────────────── */

function Body({ children }) {
  return (
    <svg viewBox="0 0 220 306" className="mts-svg mts-body">
      {/* anatomy — ink dashes */}
      <circle className="mts-anat" cx="110" cy="28" r="16" />
      <path className="mts-anat"
        d="M78 50 Q110 41 142 50 L146 120 Q146 150 140 172 L138 206 L138 286 Q138 294 130 294 L118 294 Q112 294 112 286 L111 226 L109 226 L108 286 Q108 294 102 294 L90 294 Q82 294 82 286 L82 206 L80 172 Q74 150 74 120 Z" />
      {/* physiological uptake — orange (all of it is real signal) */}
      <ellipse className="mts-hot" cx="101" cy="38" rx="4.5" ry="3.5" />
      <ellipse className="mts-hot" cx="119" cy="38" rx="4.5" ry="3.5" />
      <ellipse className="mts-hot" cx="88" cy="120" rx="9" ry="14" />
      <ellipse className="mts-hot" cx="132" cy="120" rx="9" ry="14" />
      <ellipse className="mts-hot mts-hot--bladder" cx="110" cy="198" rx="16" ry="12" />
      {children}
    </svg>
  );
}

function BladderDiagram() {
  return (
    <div className="mts-panels" role="img"
      aria-label="Two body diagrams of the same lesion-free patient. Left, without organ supervision: the model circles the hot bladder as a lesion, so the patient becomes a false alarm. Right, with organ supervision: the network recognises the bladder as an organ and predicts no lesions.">
      <div className="mts-panel">
        <p className="mts-panel__title">Without organ supervision</p>
        <Body>
          {/* the model's output — blue */}
          <ellipse className="mts-pred" cx="110" cy="198" rx="23" ry="19" />
          <line className="mts-lead" x1="133" y1="198" x2="163" y2="184" />
          <text className="mts-chip mts-chip--bad" x="164" y="181">“lesion”</text>
          <text className="mts-chip mts-chip--bad" x="164" y="194">= FP</text>
        </Body>
        <p className="mts-panel__score mts-panel__score--bad">
          lesion-free patient → 1 false lesion → patient-level false alarm
        </p>
      </div>

      <div className="mts-panel">
        <p className="mts-panel__title">With organ supervision (baseline)</p>
        <Body>
          {/* organ head knowledge — dashed anatomy label, no blue output */}
          <ellipse className="mts-organ" cx="110" cy="198" rx="23" ry="19" />
          <line className="mts-lead" x1="133" y1="198" x2="163" y2="184" />
          <text className="mts-chip" x="164" y="181">bladder</text>
          <text className="mts-chip" x="164" y="194">= organ</text>
        </Body>
        <p className="mts-panel__score mts-panel__score--ok">
          lesion-free patient → 0 lesions predicted → clean
        </p>
      </div>

      <div className="mts-key">
        <span><i className="mts-dot mts-dot--hot" /> PSMA-avid uptake (bladder, kidneys, salivary glands — all physiological here)</span>
        <span><i className="mts-dot mts-dot--pred" /> model output</span>
        <span><i className="mts-dot mts-dot--anat" /> anatomy / organ label</span>
      </div>
    </div>
  );
}

/* ── The page ─────────────────────────────────────────────────────────────── */

const HEAD = {
  kicker: 'University · Mamba_PSMA · after run 3',
  intro:
    'Two questions left over from the run-3 review, answered from the code: can the supervisors’ ' +
    'metrics pipeline score my model directly, and what is TotalSegmentator actually doing inside ' +
    'their nnU-Net baseline? Every claim cites the file and line it comes from.',
};

export default function MetricsTotalSeg() {
  return (
    <div className="pt-module mu mts">
      <style>{CSS}</style>

      <div>
        <p className="mu-kicker">{HEAD.kicker}</p>
        <p className="pt-module__intro">{HEAD.intro}</p>
      </div>

      <div className="mu-feed">

        {/* ══════════════ 1 · METRICS FEASIBILITY ══════════════ */}
        <article className="pt-card mu-entry">
          <header className="mu-entry__head">
            <span className="mu-entry__kicker">Feasibility</span>
            <time className="mu-entry__date">2026-08-12</time>
          </header>
          <h2 className="mu-entry__title">Reusing the baseline&rsquo;s metrics code</h2>

          <div className="mu-entry__body">
            <p className="mu-lead">
              Verdict first: <strong>their code can score my model after a thin export adapter</strong> —
              but their lesion-matching rule is more lenient than mine, so the two pipelines&rsquo; numbers
              are not interchangeable. Scoring my masks with <em>their</em> code is the honest
              apples-to-apples comparison against the published baseline figures.
            </p>

            <p className="mu-h">My sensitivity is global (micro-averaged)</p>
            <p>
              <code>aggregate()</code> pools TP/FP/FN over every case, then computes one ratio.
              Per-case sensitivities exist only as rows in the per-case CSV — they are never averaged.
              <Cite>evaluation/metrics.py:185-200</Cite> <Cite>evaluation/evaluate.py:88</Cite>
            </p>
            <Code
              file="Mamba_PSMA · evaluation/metrics.py"
              lines="126-129 · 185-200"
              caption="Arithmetic check against run 3: 1307 / (1307 + 472) = 0.7346824… — exactly the lesion_sensitivity in checkpoint_best_val_summary.json. The reported number is the pooled one."
              code={SNIP.mineAggregate}
            />

            <p className="mu-h">Their matching rule: any overlap counts, no IoU, not one-to-one</p>
            <p>
              A ground-truth lesion touched by <em>any</em> predicted voxel is a TP
              <Cite>PSMA_Auto_Seg · analysis/metrics.py:86-92</Cite>; a predicted blob is an FP only if it
              touches <em>zero</em> ground truth <Cite>metrics.py:43-47</Cite>. So one merged prediction
              spanning N lesions scores N TPs and 0 FPs. Mine matches greedily one-to-one at IoU ≥ 0.1
              <Cite>evaluation/metrics.py:113-123</Cite> — strictly harsher on both sensitivity and PPV.
            </p>
            <Code
              file="PSMA_Auto_Seg · analysis/metrics.py"
              lines="84-94 (dedented)"
              caption="overlap = contour * prediction — the GT component is compared against the whole binary prediction, so any single shared voxel makes it a TP."
              code={SNIP.theirsMatching}
            />

            <p className="mu-h">Their sensitivity: both flavours, global as the headline</p>
            <p>
              They compute a per-case mean (macro; lesion-negative cases drop out as NaN)
              <Cite>metrics.py:124, 150-152</Cite> <em>and</em> a pooled global value
              <Cite>metrics.py:156</Cite>, and report both. The <code>(percentage)</code> field —
              the headline formatting — is 100&nbsp;×&nbsp;global <Cite>metrics.py:170</Cite>.
            </p>
            <Code
              file="PSMA_Auto_Seg · analysis/metrics.py"
              lines="124 · 152-156 · 170"
              code={SNIP.theirsAggregation}
            />
            <div className="mu-callout">
              <span className="mu-callout__label">Confirmed vs inferred</span>
              <p>
                <strong>Confirmed:</strong> everything above is in the code. <strong>Inferred:</strong> that
                the published 73% sensitivity is the <em>global</em> figure — the summary emits both variants
                and no result file in the repo pins which one was quoted. The percentage field pointing at
                global makes it the likely candidate.
              </p>
            </div>

            <p className="mu-h">Same job, different rules</p>
            <div className="mts-tablewrap">
              <table className="mts-table">
                <thead>
                  <tr><th>Rule</th><th>Mine (Mamba_PSMA)</th><th>Theirs (PSMA_Auto_Seg)</th></tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Match criterion</td>
                    <td>IoU ≥ 0.1, greedy one-to-one <Cite>metrics.py:113-123</Cite></td>
                    <td>any shared voxel <Cite>metrics.py:86-92</Cite></td>
                  </tr>
                  <tr>
                    <td>1 prediction over N lesions</td>
                    <td>1 TP + (N−1) FN</td>
                    <td>N TP, 0 FP</td>
                  </tr>
                  <tr>
                    <td>Sensitivity aggregation</td>
                    <td>global only <Cite>metrics.py:185-200</Cite></td>
                    <td>per-case mean + global <Cite>metrics.py:152-156</Cite></td>
                  </tr>
                  <tr>
                    <td>Lesion-negative cases</td>
                    <td>separate false-alarm counts <Cite>metrics.py:206-208</Cite></td>
                    <td>NaN, dropped from means <Cite>metrics.py:124-150</Cite></td>
                  </tr>
                  <tr>
                    <td>Connectivity</td>
                    <td>26-conn <Cite>metrics.py:32</Cite></td>
                    <td>26-conn <Cite>metrics.py:33,75</Cite></td>
                  </tr>
                  <tr>
                    <td>Input format</td>
                    <td>in-memory arrays / .npz</td>
                    <td>paired .nii.gz dirs, same filenames <Cite>notebook cell 13:13-27</Cite></td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p className="mu-h">The adapter — what my side has to change</p>
            <ol className="mu-steps">
              <li className="mu-step">
                <span className="mu-step__n">1</span>
                <div>
                  <span className="mu-step__title">Export predictions as NIfTI</span>
                  <p className="mu-step__body">
                    <code>evaluate.py</code> currently saves masks as <code>.npz</code>
                    <Cite>evaluation/evaluate.py:79</Cite>. Write <code>.nii.gz</code> with the real
                    affine/spacing instead.
                  </p>
                </div>
              </li>
              <li className="mu-step">
                <span className="mu-step__n">2</span>
                <div>
                  <span className="mu-step__title">Mirror a GT directory on the same grid</span>
                  <p className="mu-step__body">
                    Same filenames, same grid as the predictions — so their resampler never fires (see
                    the warning below).
                  </p>
                </div>
              </li>
              <li className="mu-step">
                <span className="mu-step__n">3</span>
                <div>
                  <span className="mu-step__title">Install the totalsegmentator package</span>
                  <p className="mu-step__body">
                    Their <code>metrics.py</code> imports it at module top even though these functions
                    never use it <Cite>metrics.py:6-7</Cite> — it must be installed just to import.
                  </p>
                </div>
              </li>
            </ol>

            <div className="mu-callout mu-callout--warn">
              <span className="mu-callout__label">Careful · destructive resample</span>
              <p>
                If prediction and GT grids differ, their notebook nearest-neighbour resamples the GT{' '}
                <strong>and overwrites the GT file on disk</strong>. Never point it at the only copy of
                the labels. <Cite>segmentation_analysis.ipynb · cell 13:34-48</Cite>
              </p>
            </div>
            <Code
              file="PSMA_Auto_Seg · analysis/segmentation_analysis.ipynb · cell 13 (eval_lesions)"
              lines="37-47"
              caption="sitk.WriteImage(resampled_gt, gt_path) writes back to the ground-truth path itself."
              code={SNIP.gtResample}
            />

            <div className="mu-callout mu-callout--accent">
              <span className="mu-callout__label">Expectation to carry into the comparison</span>
              <p>
                Under their any-overlap rule my run-3 masks should score <em>higher</em> than my own
                IoU-gated metric reports — the current sensitivity 73.5% / PPV 60.8% are conservative
                readings of the same masks. That is a property of the ruler, not the model.
              </p>
            </div>

            <div className="mu-tags">
              <span className="mu-tag">verdict · adapter, then drop-in</span>
              <span className="mu-tag">mine · micro-averaged</span>
              <span className="mu-tag">theirs · any-overlap matching</span>
              <span className="mu-tag">GT resample is destructive</span>
            </div>
          </div>
        </article>

        {/* ══════════════ 2 · TOTALSEGMENTATOR ══════════════ */}
        <article className="pt-card mu-entry">
          <header className="mu-entry__head">
            <span className="mu-entry__kicker">Investigation</span>
            <time className="mu-entry__date">2026-08-12</time>
          </header>
          <h2 className="mu-entry__title">What TotalSegmentator actually does in PSMASegmentator</h2>

          <div className="mu-entry__body">
            <p className="mu-lead">
              The hypothesis — <em>TotalSegmentator gives the model anatomical context so hot normal
              anatomy (bladder, kidneys) isn&rsquo;t called lesion</em> — is <strong>right about the
              intent, wrong about the mechanism</strong>. Anatomy enters at <strong>train time as a
              second training objective</strong>, not as an input channel, a crop, or a post-hoc mask.
            </p>

            <div className="mu-callout mu-callout--ok">
              <span className="mu-callout__label">Mechanism · auxiliary organ supervision</span>
              <p>
                TotalSegmentator builds organ pseudo-labels from the CT; the nnU-Net grows a second
                segmentation head that must predict those organs during training, and its loss is simply
                added to the lesion loss. The shared network is <em>forced to learn what a bladder looks
                like</em> — so physiological uptake stops resembling lesion. This is the DKFZ autoPET-III
                recipe the README cites.
              </p>
            </div>

            <PipelineDiagram />
            <p className="mts-figcap">
              Where it sits: TotalSegmentator touches the model only through the organ-loss arrow at
              train time. At inference the organ head is off (<code>forward(self, x, organ=False)</code>
              <Cite>ResidualEncoderUNetOrgan.py:59</Cite>, plain predictor
              <Cite>inference.py:109-114</Cite>) and TotalSegmentator runs downstream of the mask.
            </p>

            <p className="mu-h">The evidence, in four hops</p>
            <ol className="mu-steps">
              <li className="mu-step">
                <span className="mu-step__n">1</span>
                <div>
                  <span className="mu-step__title">Pseudo-labels are generated from CT</span>
                  <p className="mu-step__body">
                    <code>TotalSegmentator --ml</code> plus the head-glands task, mapped down to exactly
                    the high-uptake organ set. <Cite>predict_and_extract_organs.py:48-51</Cite>
                  </p>
                </div>
              </li>
              <li className="mu-step">
                <span className="mu-step__n">2</span>
                <div>
                  <span className="mu-step__title">Merged into the preprocessed dataset</span>
                  <p className="mu-step__body">
                    Copied beside each case as <code>*_seg_org.npy</code>
                    <Cite>combine_lesion_and_organs.py:22-28</Cite>, loaded by the multitask dataset
                    <Cite>nnunet_dataset_multitask.py:105-109</Cite>.
                  </p>
                </div>
              </li>
              <li className="mu-step">
                <span className="mu-step__n">3</span>
                <div>
                  <span className="mu-step__title">A second head trains on them</span>
                  <p className="mu-step__body">
                    <code>ResidualEncoderUNetOrgan</code> adds parallel 1×1 organ heads per decoder stage
                    <Cite>ResidualEncoderUNetOrgan.py:134-166</Cite>, now 24+1 classes (grown from 10)
                    <Cite>ResidualEncoderUNetOrgan.py:16</Cite>.
                  </p>
                </div>
              </li>
              <li className="mu-step">
                <span className="mu-step__n">4</span>
                <div>
                  <span className="mu-step__title">Both losses backpropagate together</span>
                  <p className="mu-step__body">
                    The four lines below are the whole trick. <Cite>autoPET3_Trainer.py:341-344</Cite>
                  </p>
                </div>
              </li>
            </ol>

            <Code
              file="PSMASegmentator · nnunetv2/training/nnUNetTrainer/autoPET3_Trainer.py"
              lines="340-344 (dedented)"
              caption="train_step(): one forward pass returns both heads; the organ loss is added onto the lesion loss before backprop."
              code={SNIP.trainer}
            />
            <Code
              file="PSMASegmentator · nnunetv2/preprocessing/organ_extraction/predict_and_extract_organs.py"
              lines="11-27"
              caption="The training organ set is precisely the physiological-uptake troublemakers — urinary bladder is class 4."
              code={SNIP.organMap}
            />

            <p className="mu-h">The bladder problem this solves</p>
            <BladderDiagram />
            <p className="mts-figcap">
              Orange is real PSMA-avid signal in <em>both</em> panels — the bladder genuinely glows.
              The only difference is what the model (blue) does with it. My run&nbsp;3 currently behaves
              like the left panel: <strong>all 7 lesion-negative validation cases raised at least one
              false lesion</strong> (25 spurious lesions at raw threshold)
              <Cite>evaluation/results/run3/checkpoint_best_val_summary.json</Cite>.
            </p>

            <p className="mu-h">Inference: classification, never deletion</p>
            <p>
              At inference TotalSegmentator runs on the CT <em>after</em> the mask exists
              <Cite>post_processing.py:1823, 940-947</Cite> — full 117-label output — and is used to
              assign each predicted lesion to an organ/site for biomarker reporting (≥50-60% overlap,
              else nodal above/below the common iliac bifurcation via the iliac-artery labels)
              <Cite>post_processing.py:1092-1148, 1012</Cite>, to constrain the optional
              <code>-exp_segs</code> expansion <Cite>post_processing.py:496-504</Cite>, and to locate the
              liver for the liver-mets classifier. The whole <code>post_process()</code> flow
              <Cite>post_processing.py:1791-1888</Cite> contains <strong>no organ-based false-positive
              removal</strong> — the only voxel filter is the optional SUV threshold
              <Cite>post_processing.py:1792-1798</Cite>.
            </p>
            <Code
              file="PSMASegmentator · psma_segmentator/post_processing.py"
              lines="1114-1116 · 1122-1123 · 1143-1144"
              caption="classify_lesion(): overlap with an organ chooses the lesion's label for reporting — the lesion itself always survives."
              code={SNIP.classify}
            />

            <div className="mu-callout mu-callout--accent">
              <span className="mu-callout__label">What this means for my lesion-free patients</span>
              <p>
                The baseline&rsquo;s false-positive suppression is <em>learned, not filtered</em> — there
                is no stage I can bolt on that replicates it cheaply. Options, in increasing faithfulness:
                (a)&nbsp;post-hoc organ-overlap FP filter — cheap experiment, but <em>not</em> what the
                baseline does; (b)&nbsp;organ map as an extra input channel; (c)&nbsp;an auxiliary organ
                head on my Mamba U-Net decoder — the faithful replication, and TotalSegmentator
                pseudo-labels cost nothing at inference since the head is dropped.
              </p>
            </div>

            <div className="mu-tags">
              <span className="mu-tag">train-time multi-task loss</span>
              <span className="mu-tag">organ head off at inference</span>
              <span className="mu-tag">bladder = organ class 4</span>
              <span className="mu-tag">no FP deletion in post-proc</span>
              <span className="mu-tag">Misalign2 PET/CT aug too</span>
            </div>
          </div>
        </article>
      </div>
    </div>
  );
}

/* ── Verbatim snippets (`# ...` marks an elision) ────────────────── */

const SNIP = {
  mineAggregate: `def prf(tp, fp, fn):
    """F1 / PPV / sensitivity from counts. Returns None for a ratio that is 0/0."""
    ppv = tp / (tp + fp) if (tp + fp) else None
    sens = tp / (tp + fn) if (tp + fn) else None

# ... aggregate() pools counts across ALL cases, then divides once:

    tp = sum(c["tp"] for c in per_case)
    fp = sum(c["fp"] for c in per_case)
    fn = sum(c["fn"] for c in per_case)

# ...

        **{f"lesion_{k}": v for k, v in prf(tp, fp, fn).items()},`,

  theirsMatching: `#If the prediction contains no positive voxels, just return the number of connected volumes in the ground truth
if np.sum(prediction) == 0:
    return num_features_image, 0

else:
    #Iterate through all of the seperate connected volumes found.
    for contour_number in range (1, num_features_image+1):
        contour = (labeled_image == contour_number).astype(int)
        overlap = contour * prediction
        if np.sum(overlap) == 0:
            false_negatives += 1
        else:
            true_positives += 1`,

  theirsAggregation: `case_sens = true_pos / (true_pos + false_neg) if ((true_pos + false_neg) > 0) else np.nan
# ...
sens_per_case = sens_series.mean() if len(sens_series) > 0 else np.nan
# ...
sens_global = total_tps / (total_tps + total_fns) if (total_tps + total_fns) > 0 else np.nan
# ...
"Lesion Sensitivity (percentage)": float(100 * sens_global) if not np.isnan(sens_global) else np.nan,`,

  gtResample: String.raw`if pred_img.GetSize() != gt_img.GetSize():
    print(f"Size mismatch between:\n  Pred: {pred_path}\n  GT:   {gt_path}")
    print("Resampling GT to match prediction...")

    resampler = sitk.ResampleImageFilter()
    resampler.SetReferenceImage(pred_img)
    resampler.SetInterpolator(sitk.sitkNearestNeighbor)
    resampler.SetTransform(sitk.Transform())
    resampled_gt = resampler.Execute(gt_img)

    sitk.WriteImage(resampled_gt, gt_path)`,

  trainer: `with autocast(self.device.type, enabled=True) if self.device.type == 'cuda' else dummy_context():
    output, organ_output = self.network(data, organ=True)
    # del data
    l = self.loss(output, target)
    l += self.loss(organ_output, target_organs)`,

  organMap: `lbl_mapping_all = {
    0: 0,
    1: 1, # Spleen
    2: 2, # Right kidney
    3: 2, # Left kidney
    5: 3, # Liver
    21: 4, # Urinary bladder
    10: 5, # Lung
    11: 5, # Lung
    12: 5, # Lung
    13: 5, # Lung
    14: 5, # Lung
    90: 6, # Brain
    51: 7, # Heart
    6: 8, # Stomach
    22: 9, # Prostate
}`,

  classify: `max_overlap_label = max(overlap_counts, key=overlap_counts.get, default=None)
max_overlap_voxels = overlap_counts[max_overlap_label] if max_overlap_label else 0
max_overlap_ratio = max_overlap_voxels / lesion_voxel_count
# ...
# If maximum overlap ratio is below the threshold → use nodal logic
if max_overlap_voxels == 0 or max_overlap_ratio < overlap_threshold:
# ...
else:
    chosen_class = max_overlap_label`,
};

/* ── Scoped styles ────────────────────────────────────────────────────────── */

const CSS = `
/* diagram colour code (matches the training-runs kit convention):
   orange = uptake/truth · blue = the model · ink dashes = anatomy */
.mts { --mts-hot: #e0883c; --mts-model: #4a90d9; }

/* citations — tiny mono chips, never load-bearing colour */
.mts-cite { display: inline-block; font-family: var(--font-mono, ui-monospace, Menlo, monospace);
  font-size: 0.66rem; color: var(--accent-ink); background: var(--accent-soft);
  border-radius: 4px; padding: 0.05em 0.4em; margin: 0 0.15em; white-space: nowrap; }

/* ── code blocks (Shiki · VS Code Dark+) ── */
.mts-code { margin: 0.9rem 0 1.1rem; }
.mts-code__head { display: flex; align-items: baseline; gap: 0.6rem;
  background: #252526; border: 1px solid #3c3c3c; border-bottom: none;
  border-radius: 8px 8px 0 0; padding: 0.45rem 0.85rem; }
.mts-code__file { font-family: var(--font-mono, ui-monospace, Menlo, monospace);
  font-size: 0.68rem; color: #c8c8c8; min-width: 0; overflow: hidden; text-overflow: ellipsis;
  white-space: nowrap; }
.mts-code__lines { font-family: var(--font-mono, ui-monospace, Menlo, monospace);
  font-size: 0.64rem; color: #858585; white-space: nowrap; }
.mts-code__copy { margin-left: auto; border: 1px solid #3c3c3c; background: transparent;
  color: #858585; font: inherit; font-size: 0.62rem; text-transform: uppercase;
  letter-spacing: 0.05em; border-radius: 4px; padding: 0.1rem 0.5rem; cursor: pointer; }
.mts-code__copy:hover { color: #d4d4d4; border-color: #6a6a6a; }
.mts-code__body { border: 1px solid #3c3c3c; border-radius: 0 0 8px 8px; overflow: hidden; }
.mts-code__body pre { margin: 0; padding: 0.75rem 1rem; overflow-x: auto; white-space: pre;
  font-family: var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
  font-size: 0.76rem; line-height: 1.65; }
/* undo the .mu-entry__body code chip styling on shiki's inner <code> */
.mts-code__body pre code { display: block; white-space: inherit; background: transparent;
  border: none; border-radius: 0; padding: 0; color: inherit; font-size: inherit;
  font-family: inherit; }
.mts-code__plain { background: #1e1e1e; color: #d4d4d4; }
.mts-code__cap { margin: 0.45rem 0 0; font-size: 0.78rem; line-height: 1.55; color: var(--ink-3); }

/* ── comparison table ── */
.mts-tablewrap { overflow-x: auto; margin: 0.9rem 0 1.1rem; }
.mts-table { width: 100%; border-collapse: collapse; font-size: 0.82rem; line-height: 1.5; }
.mts-table th { text-align: left; font-size: 0.66rem; text-transform: uppercase;
  letter-spacing: 0.06em; color: var(--ink-3); font-weight: 700;
  border-bottom: 1px solid var(--line); padding: 0.35rem 0.7rem 0.35rem 0; }
.mts-table td { border-bottom: 1px solid var(--line-2); padding: 0.5rem 0.7rem 0.5rem 0;
  vertical-align: top; color: var(--ink-2); }
.mts-table td:first-child { color: var(--ink); font-weight: 600; white-space: nowrap; }

/* ── diagrams ── */
.mts-diagram { margin: 1rem 0 0.4rem; }
.mts-lane__label { font-size: 0.68rem; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.06em; color: var(--accent-ink); margin: 0.9rem 0 0.3rem; }
.mts-svg { display: block; width: 100%; height: auto; }
.mts-figcap { font-size: 0.8rem; line-height: 1.6; color: var(--ink-3); margin: 0.4rem 0 1rem; }

.mts-box { fill: var(--surface-hi); stroke: var(--line); stroke-width: 1; }
.mts-box--net { stroke: var(--ink-3); stroke-width: 1.4; }
.mts-box--model { stroke: var(--mts-model); stroke-width: 1.6; }
.mts-box--ts { stroke: var(--accent); stroke-width: 1.6; }
.mts-box--sum { stroke: var(--ink); stroke-width: 1.4; }
.mts-box--opt { stroke-dasharray: 4 3; }
.mts-group { fill: none; stroke: var(--line); stroke-width: 1; stroke-dasharray: 5 4; }
.mts-tx { font-family: var(--font-mono, ui-monospace, Menlo, monospace); font-size: 12px;
  fill: var(--ink); }
.mts-tx--dim { font-size: 10.5px; fill: var(--ink-3); }
.mts-tx--grouplabel { font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase;
  fill: var(--ink-3); }
.mts-tx--verdictline { font-size: 11px; font-style: italic; fill: var(--accent-ink); }
.mts-arrow { stroke: var(--ink-3); stroke-width: 1.4; fill: none; }
.mts-arrow--dashed { stroke-dasharray: 4 4; }
.mts-arrhead { fill: var(--ink-3); }

/* bladder panels */
.mts-panels { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin: 1rem 0 0.4rem; }
.mts-panel { border: 1px solid var(--line-2); border-radius: 8px; padding: 0.8rem 0.9rem 0.6rem;
  background: var(--surface-hi); }
.mts-panel__title { margin: 0 0 0.3rem; font-size: 0.78rem; font-weight: 700; color: var(--ink);
  text-align: center; }
.mts-body { max-width: 250px; margin: 0 auto; }
.mts-panel__score { margin: 0.4rem 0 0.2rem; font-size: 0.74rem; line-height: 1.45;
  text-align: center; color: var(--ink-2); }
.mts-panel__score--bad::before { content: '✗ '; color: var(--error); font-weight: 700; }
.mts-panel__score--ok::before { content: '✓ '; color: var(--accent-ink); font-weight: 700; }

.mts-anat { fill: none; stroke: var(--ink-3); stroke-width: 1.3; stroke-dasharray: 4 3; }
.mts-hot { fill: var(--mts-hot); opacity: 0.85; }
.mts-pred { fill: none; stroke: var(--mts-model); stroke-width: 2.4; }
.mts-organ { fill: none; stroke: var(--accent-ink); stroke-width: 1.6; stroke-dasharray: 5 3; }
.mts-lead { stroke: var(--ink-3); stroke-width: 1; }
.mts-chip { font-family: var(--font-mono, ui-monospace, Menlo, monospace); font-size: 11px;
  fill: var(--ink-2); }
.mts-chip--bad { fill: var(--error); font-weight: 700; }

.mts-key { grid-column: 1 / -1; display: flex; flex-wrap: wrap; gap: 0.4rem 1.2rem;
  font-size: 0.74rem; color: var(--ink-3); }
.mts-key span { display: inline-flex; align-items: center; gap: 0.4rem; }
.mts-dot { width: 10px; height: 10px; border-radius: 99px; flex: none; }
.mts-dot--hot { background: var(--mts-hot); }
.mts-dot--pred { background: transparent; border: 2.4px solid var(--mts-model); }
.mts-dot--anat { background: transparent; border: 1.4px dashed var(--ink-3); }

@media (max-width: 680px) {
  .mts-panels { grid-template-columns: 1fr; }
  .mts-table { font-size: 0.76rem; }
}
`;
