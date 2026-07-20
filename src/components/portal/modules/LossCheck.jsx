import Icon from '../icons';

/* ============================================================================
   LOSS CHECK - Tversky loss verification  (University)
   ----------------------------------------------------------------------------
   A short, visual write-up of the finding: the implemented Tversky loss in the
   Mamba_PSMA repo was checked term-by-term against Salehi et al. (2017), the
   literature review, and baseline.yaml. Verdict: mathematically correct.

   Styled with the shared .pt-* / .mu-* classes (same toolkit as Mamba Updates),
   so it re-skins automatically with the active portal theme.
   ========================================================================== */

const HEAD = {
  kicker: 'University · Mamba_PSMA',
  intro:
    'A quick verification pass: does the implemented Tversky loss actually match the paper it is based on? ' +
    'Checked term-by-term against Salehi et al. (2017), the literature review, and baseline.yaml.',
};

export default function LossCheck() {
  return (
    <div className="pt-module mu">
      <div>
        <p className="mu-kicker">{HEAD.kicker}</p>
        <p className="pt-module__intro">{HEAD.intro}</p>
      </div>

      <div className="mu-feed">
        <article className="pt-card mu-entry">
          <header className="mu-entry__head">
            <span className="mu-entry__kicker">Verification</span>
            <time className="mu-entry__date">2026-07-20</time>
          </header>
          <h2 className="mu-entry__title">Tversky loss: does it match the paper?</h2>

          <div className="mu-entry__body">
            <p className="mu-lead">
              Checked <code>training/loss.py</code> against Salehi et al. Equation&nbsp;3. Short version:
              the maths is right, and the weighting points the way the project needs.
            </p>

            <div className="mu-callout mu-callout--ok">
              <span className="mu-callout__label">Verdict · correct</span>
              <p>
                <code>TverskyLoss</code> reproduces <strong>Equation 3</strong> term-for-term, with the
                false-negative and false-positive weights the right way round. Cleared to train.
              </p>
            </div>

            <p className="mu-h">Paper to code, line by line</p>
            <div className="mu-grid">
              <div className="mu-cell">
                <span className="mu-cell__k">Σ p·g  (numerator)</span>
                <p><code>tp = (p*g).sum</code> · true positives</p>
              </div>
              <div className="mu-cell">
                <span className="mu-cell__k">α · Σ p·(1-g)</span>
                <p><code>fp = (p*(1-g)).sum</code> · false positives</p>
              </div>
              <div className="mu-cell">
                <span className="mu-cell__k">β · Σ (1-p)·g</span>
                <p><code>fn = ((1-p)*g).sum</code> · false negatives</p>
              </div>
              <div className="mu-cell mu-cell--accent">
                <span className="mu-cell__k">loss = 1 - T</span>
                <p><code>1 - tp / (tp + α·fp + β·fn)</code></p>
              </div>
            </div>

            <p className="mu-h">What the weighting buys you</p>
            <div className="mu-flow" aria-label="effect of beta larger than alpha">
              <span className="mu-flow__node">Missed lesion</span>
              <span className="mu-flow__arrow">→</span>
              <span className="mu-flow__node mu-flow__node--next">β = 0.7 penalty</span>
              <span className="mu-flow__arrow">→</span>
              <span className="mu-flow__node">higher loss</span>
              <span className="mu-flow__arrow">→</span>
              <span className="mu-flow__node mu-flow__node--done">more recall</span>
            </div>
            <p>
              With <strong>β = 0.7 against α = 0.3</strong>, a missed metastasis costs more than a false
              alarm - the exact lever aimed at the baseline&rsquo;s 73% lesion sensitivity.
            </p>

            <div className="mu-callout mu-callout--accent">
              <span className="mu-callout__label">One call to make</span>
              <p>
                The default is <code>tversky_bce</code> (Tversky + 0.3&nbsp;BCE), not pure Tversky. The BCE
                term steadies early gradients but is symmetric, so it mildly dilutes the recall bias. Keep it
                for stability, but sweep <strong>pure Tversky</strong> and the <strong>β value</strong>: 0.7
                is optimal for MS-lesion MRI, not yet proven for PSMA.
              </p>
            </div>

            <div className="mu-tags">
              <span className="mu-tag">Salehi et al. 2017 · Eq 3</span>
              <span className="mu-tag">α = 0.3 · β = 0.7</span>
              <span className="mu-tag">FN/FP direction correct</span>
              <span className="mu-tag">soft sigmoid</span>
              <span className="mu-tag">tunable in baseline.yaml</span>
            </div>
          </div>
        </article>
      </div>
    </div>
  );
}
