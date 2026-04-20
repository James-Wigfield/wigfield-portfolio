import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import katex from 'katex';
import 'katex/dist/katex.min.css';

// ── KaTeX renderer ────────────────────────────────────────────────────────────
function Tex({ src, block = false }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) katex.render(src, ref.current, { throwOnError: false, displayMode: block });
  }, [src, block]);
  return <span ref={ref} className={block ? 'm4-tex-block' : 'm4-tex-inline'} />;
}

// ── Variable description table ────────────────────────────────────────────────
function VarTable({ vars }) {
  return (
    <div className="m4-vartable">
      {vars.map(([sym, desc]) => (
        <div key={sym} className="m4-var-row">
          <span className="m4-var-sym"><Tex src={sym} /></span>
          <span className="m4-var-desc">{desc}</span>
        </div>
      ))}
    </div>
  );
}

// ── Math utilities (ported from legacy math-utils.js) ────────────────────────
function solveLinear(A, b) {
  const n = A.length;
  const aug = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(aug[row][col]) > Math.abs(aug[maxRow][col])) maxRow = row;
    }
    [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];
    const pivot = aug[col][col];
    if (Math.abs(pivot) < 1e-12) continue;
    for (let row = col + 1; row < n; row++) {
      const factor = aug[row][col] / pivot;
      for (let k = col; k <= n; k++) aug[row][k] -= factor * aug[col][k];
    }
  }
  const x = new Array(n).fill(0);
  for (let row = n - 1; row >= 0; row--) {
    x[row] = aug[row][n];
    for (let col = row + 1; col < n; col++) x[row] -= aug[row][col] * x[col];
    x[row] /= aug[row][row];
  }
  return x;
}

function fitPolynomial(xData, yData, degree) {
  const n = degree + 1;
  const X = xData.map(x => Array.from({ length: n }, (_, j) => Math.pow(x, j)));
  const XtX = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => X.reduce((s, row) => s + row[i] * row[j], 0))
  );
  const Xty = Array.from({ length: n }, (_, i) =>
    X.reduce((s, row, k) => s + row[i] * yData[k], 0)
  );
  return solveLinear(XtX, Xty);
}

function evalPolynomial(theta, x) {
  return theta.reduce((sum, c, j) => sum + c * Math.pow(x, j), 0);
}

function calcMSE(pred, actual) {
  return pred.reduce((s, p, i) => s + (p - actual[i]) ** 2, 0) / pred.length;
}

function makePRNG(seed) {
  let s = seed;
  return function () {
    s |= 0; s = s + 0x6d2b79f5 | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = t + Math.imul(t ^ (t >>> 7), 61 | t) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussianNoise(rand, sigma = 1) {
  const u = 1 - rand(), v = rand();
  return sigma * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function generateSinData(n = 30, seed = 42, noise = 0.35) {
  const rand = makePRNG(seed);
  const xTrain = Array.from({ length: n }, () => rand() * (2 * Math.PI) - Math.PI).sort((a, b) => a - b);
  const yTrain = xTrain.map(x => Math.sin(x) + gaussianNoise(rand, noise));
  const xTrue = Array.from({ length: 200 }, (_, i) => -Math.PI + (2 * Math.PI * i) / 199);
  const yTrue = xTrue.map(x => Math.sin(x));
  return { xTrain, yTrain, xTrue, yTrue };
}

// ── Quiz data ─────────────────────────────────────────────────────────────────
const QUIZ_DATA = [
  {
    lec: 'Lec 1 · Mitchell\'s Definition',
    q: 'For a spam filter: "classifying emails as spam or not-spam using labelled training emails, measured by classification accuracy" — which is T, E, P respectively?',
    opts: [
      'T = Classification accuracy, E = Labelled emails, P = Classify emails',
      'T = Classify emails as spam/not-spam, E = Labelled emails corpus, P = Accuracy on new emails',
      'T = Labelled emails, E = Accuracy, P = Classify emails',
      'T = Classify emails, E = Accuracy, P = Labelled emails',
    ],
    ans: 1,
    ok: 'T (Task) = classify emails as spam/not-spam. E (Experience) = labelled corpus of emails. P (Performance) = accuracy on new unseen emails. This is exactly Tom Mitchell\'s 1997 formulation.',
    ng: 'Mitchell\'s framework: T is what the system does, E is the training data it learns from, P is how we measure success. Here: Task=classify, Experience=labelled emails, Performance=accuracy.',
  },
  {
    lec: 'Lec 1 · Supervised vs Unsupervised',
    q: 'Which of the following is a supervised learning task?',
    opts: [
      'Finding natural customer groupings from purchase history (no predefined categories)',
      'Reducing a 200-dimensional dataset to 3D for visualisation',
      'Predicting house prices using historical sales data with known prices',
      'Detecting unusual server log entries with no labelled attack examples',
    ],
    ans: 2,
    ok: 'House price prediction uses labelled training data (feature vector + known price = y), making it supervised regression. The model learns f: X → Y from labelled examples.',
    ng: 'Supervised learning requires labelled (x, y) pairs. Options A, B, D are all unsupervised — clustering, dimensionality reduction, and anomaly detection without labels.',
  },
  {
    lec: 'Lec 1 · Learning Approaches',
    q: 'A k-Nearest Neighbours (KNN) classifier stores all training examples and classifies new points by finding the k closest neighbours. Which category does this fall into?',
    opts: [
      'Model-based learning — it builds a mathematical model first',
      'Batch learning — it requires all data at once',
      'Instance-based learning — it memorises training examples and uses similarity to generalise',
      'Reinforcement learning — it learns from rewards',
    ],
    ans: 2,
    ok: 'KNN is the canonical example of instance-based (memory-based) learning. It stores all training points and generalises by measuring similarity (e.g., Euclidean distance) to stored examples at prediction time.',
    ng: 'Instance-based learners memorise training data and generalise by comparing new inputs to stored examples using a similarity measure. KNN does exactly this — no explicit model is built.',
  },
  {
    lec: 'Lec 1 · Formal Model',
    q: 'In the simple linear classification model, what is the purpose of the "bias trick" (introducing x₀ = 1, w₀ = b)?',
    opts: [
      'It normalises all features to the range [0, 1]',
      'It absorbs the bias term b into the weight vector w, allowing h(x) = sgn(wᵀx) — a clean dot product form',
      'It forces the decision boundary to pass through the origin',
      'It doubles the learning speed by reducing the number of parameters',
    ],
    ans: 1,
    ok: 'By setting x₀ = 1 and treating b as w₀, the model becomes h(x) = sgn(w₀x₀ + w₁x₁ + … + wₘxₘ) = sgn(wᵀx). This simplifies both notation and NumPy vectorisation (np.sign(X @ w)).',
    ng: 'The bias trick makes b disappear by treating it as w₀ paired with a dummy feature x₀ = 1. Result: h(x) = sgn(wᵀx) — one clean dot product, enabling efficient vectorised computation.',
  },
  {
    lec: 'Lec 1 · ML Challenges',
    q: 'A degree-15 polynomial achieves near-zero training error but performs very poorly on the test set. What challenge does this illustrate, and what is the standard remedy?',
    opts: [
      'Underfitting — use a more complex model and add more features',
      'Sampling bias — collect a more representative training set',
      'Overfitting — regularise the model, reduce complexity, or gather more training data',
      'Insufficient data — always use the most complex model available to extract maximum signal',
    ],
    ans: 2,
    ok: 'Near-zero training error + high test error is the hallmark of overfitting (high variance). The model memorises training noise. Remedies: regularisation (Ridge/Lasso), simpler model (lower degree), or more training data.',
    ng: 'Overfitting: the model is too complex and learns noise rather than the true pattern. It generalises poorly. Fix with regularisation, reducing model complexity, or more data.',
  },
  {
    lec: 'Lec 2 · Classification Metrics',
    q: 'A classifier predicts 1000 emails. Among 100 truly spam emails, it correctly identifies 80. Of 200 emails it labelled spam, 80 are genuinely spam. What is its precision and recall?',
    opts: [
      'Precision = 80%, Recall = 80%',
      'Precision = 40%, Recall = 80%',
      'Precision = 80%, Recall = 40%  — correct formula applies to each',
      'Precision = 8%, Recall = 8%',
    ],
    ans: 1,
    ok: 'Precision = TP / (TP + FP) = 80 / 200 = 40%. Recall = TP / (TP + FN) = 80 / 100 = 80%. Precision asks "of all I flagged as spam, how many were?". Recall asks "of all actual spam, how many did I catch?".',
    ng: 'TP = 80. Total predicted spam = 200 → FP = 120. Total actual spam = 100 → FN = 20. Precision = 80/200 = 40%. Recall = 80/100 = 80%.',
  },
  {
    lec: 'Lec 2 · Performance Measures',
    q: 'MSE and MAE both measure regression error. Which statement is correct?',
    opts: [
      'MAE penalises large errors more heavily than MSE because of the absolute value',
      'MSE penalises large errors more heavily because it squares the difference — making it more sensitive to outliers than MAE',
      'They are mathematically equivalent for all datasets',
      'MSE is always smaller than MAE for the same dataset',
    ],
    ans: 1,
    ok: 'MSE squares each error (h(x) − y)², so a single large outlier can dominate the sum. MAE uses |h(x) − y|, giving equal weight to all errors regardless of magnitude. MSE is therefore more sensitive to outliers.',
    ng: 'Squaring amplifies large errors: a prediction 10 units off contributes 100 to MSE but only 10 to MAE. This is why MSE is more sensitive to outliers and why MAE is sometimes preferred for robust evaluation.',
  },
  {
    lec: 'Lec 3 · Linear Regression',
    q: 'The Normal Equation gives a closed-form solution for linear regression. What is its main computational drawback compared to Gradient Descent?',
    opts: [
      'It always diverges when features are correlated',
      'It requires gradient computation at every step, making it O(m²) in training examples',
      'It is cubic in the number of features n — for very wide datasets, computing (XᵀX)⁻¹ becomes impractical',
      'It can only be applied to polynomial features, not raw inputs',
    ],
    ans: 2,
    ok: 'The Normal Equation θ̂ = (XᵀX)⁻¹Xᵀy scales linearly with training instances m, but the matrix inversion (XᵀX)⁻¹ is O(n³) in the number of features. For wide feature spaces (large n), GD is far more practical.',
    ng: 'θ̂ = (XᵀX)⁻¹Xᵀy. Computing the inverse of the n×n matrix XᵀX is O(n³). With thousands of features this becomes prohibitively expensive — Gradient Descent scales much better to high-dimensional problems.',
  },
  {
    lec: 'Lec 3 · Gradient Descent',
    q: 'The Gradient Descent step rule is θ⁽ᵗ⁺¹⁾ = θ⁽ᵗ⁾ − η·∇MSE(θ). What happens when the learning rate η is set too large?',
    opts: [
      'The algorithm converges slowly but always reaches the global minimum',
      'The gradient becomes zero and updates stop prematurely',
      'The step overshoots the minimum — cost may bounce or diverge rather than converge',
      'The algorithm switches automatically to the Normal Equation',
    ],
    ans: 2,
    ok: 'A large η causes the update to overshoot: the new θ ends up further from the minimum than it started. On a convex parabola like J(θ)=(θ−2)², divergence occurs for η≥1. A good η is found via a learning schedule or line search.',
    ng: 'Large η → large step → likely to leap past the minimum. Each step may increase J rather than decrease it. The classic sign: if J is going up each iteration, reduce η. Convergence is guaranteed only for sufficiently small η.',
  },
  {
    lec: 'Lec 3 · GD Variants',
    q: 'Which statement correctly describes the key difference between Batch GD, Stochastic GD, and Mini-batch GD?',
    opts: [
      'Batch GD uses one random sample per step; SGD uses the whole dataset; Mini-batch uses a fixed subset',
      'Batch GD uses the entire training set each step (slow but stable); SGD uses one random instance (fast but noisy); Mini-batch is a compromise enabling GPU vectorisation',
      'They differ only in learning rate — the gradient computation is identical',
      'SGD always converges faster than Mini-batch GD regardless of dataset size',
    ],
    ans: 1,
    ok: 'Batch GD: full dataset → accurate gradient but slow per step. SGD: one random instance → fast but high variance (noisy path). Mini-batch: small random subsets → balances speed and stability, exploits GPU parallelism.',
    ng: 'Batch GD computes exact gradient on all m examples (expensive). SGD on 1 example (cheap, noisy). Mini-batch on ~32–512 examples — practical for large datasets and allows GPU vectorisation of matrix operations.',
  },
  {
    lec: 'Lec 3 · Logistic Regression',
    q: 'Logistic Regression outputs p̂ = σ(θᵀx). Which cost function does it minimise, and why is this preferred over MSE for classification?',
    opts: [
      'MSE — because it is always convex for logistic output',
      'Cross-entropy / log loss — because it is convex for the sigmoid output, guaranteeing GD finds the global minimum; MSE with sigmoid is non-convex and has multiple local minima',
      'Hinge loss — because it penalises misclassified points with a margin',
      'MAE — because it is more robust to class imbalance than squared error',
    ],
    ans: 1,
    ok: 'Log loss J(θ) = −(1/m)Σ[y log(p̂) + (1−y)log(1−p̂)] is convex when composed with the sigmoid — GD is guaranteed to find the global minimum. MSE + sigmoid creates non-convex loss surfaces with local minima.',
    ng: 'Using MSE with sigmoid outputs produces a non-convex loss. Log loss (cross-entropy) is the correct choice: it is convex for logistic regression, so gradient descent always converges to the global minimum.',
  },
  {
    lec: 'Lec 4 · Regularisation',
    q: 'Ridge and Lasso both penalise large weights, but they differ crucially. Which statement is correct?',
    opts: [
      'Ridge can zero out coefficients exactly; Lasso only shrinks them toward zero',
      'Lasso (ℓ₁) can zero out coefficients exactly (automatic feature selection); Ridge (ℓ₂) only shrinks toward zero — never reaches exactly zero',
      'Both Ridge and Lasso produce identical coefficient paths for any α',
      'Elastic Net always outperforms both Ridge and Lasso on every dataset',
    ],
    ans: 1,
    ok: 'Lasso penalty = α Σ|θⱼ| — due to the ℓ₁ constraint geometry (diamond shape), the optimum often lies at a corner where some θⱼ = 0 exactly. This is automatic feature selection. Ridge penalty = α Σθⱼ² shrinks but never zeroes.',
    ng: 'The key geometric difference: ℓ₁ ball (Lasso) has corners at the axes → solution often sits there with some coefficients exactly zero. ℓ₂ ball (Ridge) is smooth — no corners → coefficients approach but never reach zero.',
  },
  {
    lec: 'Lec 4 · kNN',
    q: 'In k-Nearest Neighbours, what is the effect of choosing a very small k (e.g., k=1) versus a very large k?',
    opts: [
      'Small k → underfitting (high bias); Large k → overfitting (high variance)',
      'Small k → overfitting (high variance, memorises noise); Large k → underfitting (high bias, over-smoothed boundary)',
      'k has no effect on the bias-variance tradeoff in kNN',
      'Large k always improves accuracy regardless of dataset distribution',
    ],
    ans: 1,
    ok: 'k=1: the boundary is extremely jagged — every training point determines its own region. This memorises noise (overfitting, high variance). Large k: the boundary becomes very smooth, ignoring local structure (underfitting, high bias). Choose k via cross-validation.',
    ng: 'Think of k=1: each training point is its own class region → perfect training accuracy but likely poor on test (overfit). k=n: predict the majority class everywhere → can badly underfit. Cross-validate to find the right balance.',
  },
  {
    lec: 'Lec 2 · Validation',
    q: 'You train a classifier, tune hyperparameters using the test set, and report excellent test accuracy. What is the fundamental problem, and what is the correct approach?',
    opts: [
      'No problem — the test set is designed for this purpose',
      'The model should be trained on the test set directly for final evaluation',
      'Tuning against the test set leaks information — the test error is now an optimistic bias; use a held-out validation set for tuning and reserve the test set for a single final evaluation',
      'Switch to k-fold cross-validation on the test set to fix the bias',
    ],
    ans: 2,
    ok: 'Repeatedly evaluating hyperparameter choices against the test set effectively "fits" those choices to it — test error is no longer an honest estimate of generalisation error. Solution: carve out a validation set from training data for all tuning; keep the test set sealed until the very end.',
    ng: 'This is the train/test/validate split problem. Tuning on the test set biases it optimistically. The standard approach: training set (fit weights) + validation set (tune hyperparameters) + test set (one final unbiased evaluation).',
  },
  {
    lec: 'Lec 5 · SVM Margins',
    q: 'In a Soft Margin SVM, the hyperparameter C controls the margin/violation trade-off. Which statement is correct?',
    opts: [
      'Large C → wide street (many violations allowed); Small C → narrow street (few violations)',
      'Small C → wide street (more margin violations allowed); Large C → narrow street (fewer violations) — tighter fit to training data',
      'C has no effect on the margin width — it only controls the kernel type',
      'C is only relevant for non-linear kernels; for LinearSVC it has no effect',
    ],
    ans: 1,
    ok: 'Small C gives the optimiser more freedom to tolerate margin violations → wider street, simpler boundary, better generalisation. Large C penalises violations heavily → narrow street, boundary hugs the data more closely, risk of overfitting.',
    ng: 'Think of C as the cost of each violation. High C = expensive violations → few allowed → narrow margin. Low C = cheap violations → many allowed → wide margin. If you are overfitting, try reducing C.',
  },
  {
    lec: 'Lec 5 · Kernel Trick',
    q: 'What is the key computational advantage of the kernel trick over explicitly adding polynomial features?',
    opts: [
      'Kernels require more memory because they store all pairwise similarities',
      'Kernels eliminate the need for gradient descent entirely',
      'The kernel trick computes dot products in a high-dimensional feature space implicitly — without ever constructing the large feature vectors, avoiding the combinatorial explosion of explicit feature maps',
      'Polynomial kernel and explicit polynomial features are mathematically identical and equally expensive',
    ],
    ans: 2,
    ok: 'K(a,b) = (aᵀb + r)ᵈ implicitly computes the dot product in a feature space of degree-d polynomial combinations — without constructing those features explicitly. This avoids O(nᵈ) feature expansion, making high-degree polynomial SVMs practical.',
    ng: 'Explicitly adding degree-d polynomial features blows up: for d=2 and 100 features you get ~5050 new features. The kernel trick evaluates K(a,b) directly in O(n) time, equivalent to a dot product in that huge space but without ever building it.',
  },
  {
    lec: 'Lec 5 · SVM Complexity',
    q: 'You have a dataset with 500,000 training instances and 50 features. Which Scikit-Learn SVM class is the only practical choice and why?',
    opts: [
      'SVC with RBF kernel — it handles large datasets best due to the kernel trick',
      'SVC with linear kernel — linear kernels scale better than RBF',
      'LinearSVC or SGDClassifier — both are O(m×n) and support large datasets; SVC is O(m²×n) to O(m³×n) and would be prohibitively slow at 500k instances',
      'All three classes are equally fast because Scikit-Learn parallelises the computation',
    ],
    ans: 2,
    ok: 'SVC complexity is O(m²n) to O(m³n). At m=500,000: 500,000² = 2.5×10¹¹ operations — completely infeasible. LinearSVC and SGDClassifier are O(m×n) = 2.5×10⁷ — manageable. For large m, always prefer LinearSVC or SGDClassifier.',
    ng: 'The table: LinearSVC = O(m×n), SGDClassifier = O(m×n), SVC = O(m²n)–O(m³n). At 500k instances SVC requires hundreds of billions of operations. Only O(m×n) methods are feasible at this scale.',
  },
  {
    lec: 'Lec 6 · Decision Trees',
    q: 'A node has 80 instances: 60 class A, 20 class B. What is its Gini impurity?',
    opts: [
      'G = 1 − (60/80)² − (20/80)² = 0.375',
      'G = 1 − (60/80) − (20/80) = 0',
      'G = −(60/80)log₂(60/80) − (20/80)log₂(20/80) ≈ 0.811',
      'G = (60 + 20) / 80 = 1.0',
    ],
    ans: 0,
    ok: 'Gini: G = 1 − Σ p² = 1 − (0.75² + 0.25²) = 1 − (0.5625 + 0.0625) = 1 − 0.625 = 0.375. A pure node (all one class) has G = 0; perfectly mixed (50/50) has G = 0.5.',
    ng: 'Formula: G_i = 1 − Σ p²_{i,k}. Compute p_A = 60/80 = 0.75 and p_B = 20/80 = 0.25. Then G = 1 − (0.75² + 0.25²) = 1 − 0.625 = 0.375.',
  },
  {
    lec: 'Lec 6 · CART Training',
    q: "The CART algorithm is described as 'greedy' and 'top-down'. What does this mean?",
    opts: [
      'It tries every possible tree globally and picks the overall best; it grows from leaf to root',
      'At each node it picks the locally best split (greedy); it starts at the root and works downward (top-down). Globally optimal DTs are NP-hard.',
      'It uses gradient descent to minimise the cost function from the top of the tree',
      'It builds the full tree first and then prunes greedily from the top',
    ],
    ans: 1,
    ok: 'Greedy = locally optimal decisions at each split without backtracking. Top-down = starts at root, recurses down. The globally optimal tree is NP-hard so CART settles for a locally good solution at each step.',
    ng: 'CART is greedy (best local split, no backtracking) and top-down (root first). Finding the globally optimal tree is NP-hard — greedy is a practical compromise.',
  },
  {
    lec: 'Lec 6 · Regularisation & Pruning',
    q: 'In cost-complexity pruning, you grow a full tree T₀ and then minimise: RSS + α|T|. What happens as α increases?',
    opts: [
      'The tree grows larger — more leaf nodes are added to reduce training RSS',
      'α has no effect on tree structure, only on the pruning speed',
      'Smaller subtrees are favoured — nodes are pruned to reduce complexity, trading slightly higher bias for lower variance',
      'The tree switches from regression to classification mode',
    ],
    ans: 2,
    ok: 'α penalises complexity (|T| = leaf count). At α = 0 you recover the full tree T₀. As α increases, the cost of each extra leaf grows, so subtrees that do not reduce RSS enough get pruned. Select α via k-fold cross-validation.',
    ng: 'Cost-complexity: minimise RSS + α|T|. Larger α → larger penalty per leaf → fewer leaves. α = 0 gives full tree; α → ∞ gives single-node tree. Cross-validate to find the best α.',
  },
];

// ── Mitchell's E/T/P Explorer ─────────────────────────────────────────────────
const MITCHELL_EXAMPLES = [
  {
    task: 'Email Spam Filter',
    T: 'Classify emails as spam or not spam',
    E: 'A corpus of labelled emails (spam / not spam, flagged by users)',
    P: 'Fraction of emails correctly classified (accuracy)',
  },
  {
    task: 'Chess-Playing Agent',
    T: 'Play chess',
    E: 'Games played against itself or other opponents',
    P: 'Percentage of games won against opponents',
  },
  {
    task: 'House Price Predictor',
    T: 'Predict the selling price of a house',
    E: 'Historical house sales data (features + actual sale prices)',
    P: 'Mean Squared Error between predicted and actual prices',
  },
  {
    task: 'Medical Diagnosis (Cancer Detection)',
    T: 'Diagnose whether a tumour is malignant or benign',
    E: 'Labelled medical images from previous confirmed diagnoses',
    P: 'Sensitivity (recall) and specificity on a held-out test set',
  },
];

function MitchellExplorer() {
  const [idx, setIdx] = useState(0);
  const ex = MITCHELL_EXAMPLES[idx];
  return (
    <div className="m4-card">
      <div className="m4-card-h">Tom Mitchell's Definition (1997) — Interactive Examples</div>
      <div className="m4-infobox" style={{ fontStyle: 'italic', fontSize: '0.85rem' }}>
        "A computer program is said to learn from experience <strong>E</strong> with respect to some task <strong>T</strong> and some
        performance measure <strong>P</strong>, if its performance on <strong>T</strong>, as measured by <strong>P</strong>,
        improves with experience <strong>E</strong>."
      </div>
      <div className="m4-preset-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <button className="m4-btn" onClick={() => setIdx((idx - 1 + MITCHELL_EXAMPLES.length) % MITCHELL_EXAMPLES.length)}>← Prev</button>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-2)' }}>
          Example {idx + 1} / {MITCHELL_EXAMPLES.length}
        </span>
        <button className="m4-btn" onClick={() => setIdx((idx + 1) % MITCHELL_EXAMPLES.length)}>Next →</button>
      </div>
      <div style={{ marginTop: '0.75rem' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--cyan)', fontWeight: 700, marginBottom: '0.75rem', letterSpacing: '0.1em' }}>
          // {ex.task}
        </div>
        {[
          { label: 'T — Task', val: ex.T, color: 'var(--violet)' },
          { label: 'E — Experience', val: ex.E, color: 'var(--emerald)' },
          { label: 'P — Performance', val: ex.P, color: 'var(--amber)' },
        ].map(({ label, val, color }) => (
          <div key={label} style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.65rem', alignItems: 'flex-start' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', fontWeight: 700, color, minWidth: 110, paddingTop: '0.05rem', letterSpacing: '0.08em' }}>
              {label}
            </span>
            <span style={{ fontSize: '0.83rem', color: 'var(--text-1)', lineHeight: 1.55 }}>{val}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── ML Types Grid ─────────────────────────────────────────────────────────────
const ML_TYPES = [
  { label: 'Supervised', color: '#22d3ee', desc: 'Training data has labels (desired outputs). The model learns a mapping from inputs to outputs.', examples: 'Linear Regression, Logistic Regression, SVMs, Decision Trees, KNN', subtypes: 'Classification (discrete labels) · Regression (continuous values)' },
  { label: 'Unsupervised', color: '#a78bfa', desc: 'Training data has no labels. The model discovers hidden structure or patterns autonomously.', examples: 'K-Means, DBSCAN, PCA, LLE, t-SNE, Apriori', subtypes: 'Clustering · Dimensionality Reduction · Anomaly Detection · Association Rules' },
  { label: 'Semi-supervised', color: '#34d399', desc: 'A small amount of labelled data combined with a large amount of unlabelled data — useful when labelling is expensive.', examples: 'Deep Belief Networks, Google Photos face recognition', subtypes: 'Combines supervised + unsupervised techniques' },
  { label: 'Self-supervised', color: '#fbbf24', desc: 'Labels are generated from the data itself (e.g., predict masked words). No human annotation needed.', examples: 'BERT, GPT — predict masked / next tokens', subtypes: 'Contrastive learning · Masked modelling · Next-token prediction' },
  { label: 'Reinforcement Learning', color: '#fb7185', desc: 'An agent learns by interacting with an environment, receiving rewards or penalties for actions taken.', examples: 'AlphaGo, game-playing agents, robotics control', subtypes: 'Policy · Value function · Model-based RL' },
];

const LEARNING_MODES = [
  { label: 'Batch (Offline)', color: '#22d3ee', desc: 'Trained on all data at once. Must be retrained from scratch when new data arrives.' },
  { label: 'Online (Incremental)', color: '#34d399', desc: 'Learns continuously from a stream of data one instance (or mini-batch) at a time. Adapts quickly to new data.' },
  { label: 'Instance-based', color: '#a78bfa', desc: 'Memorises training examples and generalises by comparing new inputs to stored ones using a similarity measure (e.g. KNN).' },
  { label: 'Model-based', color: '#fbbf24', desc: 'Builds a mathematical model from training data (e.g. a polynomial, neural network) and uses it to make predictions.' },
];

function MLTypesGrid() {
  const [sel, setSel] = useState(null);
  return (
    <div className="m4-card">
      <div className="m4-card-h">ML System Taxonomy — Click to Expand</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
        {ML_TYPES.map((t, i) => (
          <div
            key={t.label}
            onClick={() => setSel(sel === i ? null : i)}
            style={{
              background: sel === i ? `${t.color}14` : 'var(--surface)',
              border: `1px solid ${sel === i ? t.color + '55' : 'var(--border)'}`,
              borderRadius: 6, padding: '0.9rem', cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', fontWeight: 700, color: t.color, marginBottom: '0.4rem', letterSpacing: '0.08em' }}>
              {t.label}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-2)', lineHeight: 1.45 }}>{t.desc}</div>
            {sel === i && (
              <div style={{ marginTop: '0.65rem', borderTop: `1px solid ${t.color}30`, paddingTop: '0.65rem' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-2)', marginBottom: '0.25rem' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: t.color }}>Examples:</span> {t.examples}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-2)' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: t.color }}>Subtypes:</span> {t.subtypes}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="m4-hr" />
      <div className="m4-flabel">Learning Modes</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem' }}>
        {LEARNING_MODES.map(m => (
          <div key={m.label} style={{ background: 'var(--surface)', border: `1px solid ${m.color}30`, borderRadius: 6, padding: '0.8rem' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.67rem', fontWeight: 700, color: m.color, marginBottom: '0.35rem' }}>{m.label}</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-2)', lineHeight: 1.45 }}>{m.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Challenges Accordion ──────────────────────────────────────────────────────
const CHALLENGES = [
  { title: 'Insufficient Training Data', color: '#fb7185', problem: 'ML algorithms need many examples — even simple problems may need thousands to millions of samples to generalise well.', mitigation: 'Collect more data, use data augmentation, transfer learning, or simpler models that need fewer examples.' },
  { title: 'Non-representative Data (Sampling Bias)', color: '#fbbf24', problem: 'If training data doesn\'t represent the full real-world distribution, the model will generalise poorly. Classic example: 1936 US election poll predicted the wrong winner by sampling wealthier individuals.', mitigation: 'Ensure training data is a representative sample. Be aware of selection bias and survivorship bias.' },
  { title: 'Poor Quality Data', color: '#f97316', problem: 'Errors, outliers, and missing values cause the model to learn incorrect patterns — "garbage in, garbage out". Data scientists spend ~80% of time on cleaning.', mitigation: 'Data cleaning: discard or fix outliers, handle missing values (imputation), remove duplicates.' },
  { title: 'Irrelevant Features', color: '#a78bfa', problem: 'Including noisy or irrelevant features can confuse the model. The system may learn spurious correlations that don\'t generalise.', mitigation: 'Feature selection (keep useful features), feature extraction (PCA, embeddings), feature engineering using domain knowledge.' },
  { title: 'Overfitting (High Variance)', color: '#ec4899', problem: 'The model performs well on training data but fails to generalise — it has memorised noise and detail rather than the true pattern. Degree-15 polynomial on sparse data.', mitigation: 'Regularisation (Ridge/Lasso), reduce model complexity, gather more training data, use dropout or early stopping.' },
  { title: 'Underfitting (High Bias)', color: '#22d3ee', problem: 'The model is too simple to capture the underlying structure — poor performance on both training and test sets. Fitting a line to a clearly non-linear relationship.', mitigation: 'Use a more powerful model, add better features, reduce regularisation, train for longer.' },
];

function ChallengesAccordion() {
  const [open, setOpen] = useState(null);
  return (
    <div className="m4-card">
      <div className="m4-card-h">Main Challenges of Machine Learning — Click to Expand</div>
      {CHALLENGES.map((c, i) => (
        <div
          key={c.title}
          style={{
            border: `1px solid ${open === i ? c.color + '55' : 'var(--border)'}`,
            borderRadius: 6, marginBottom: '0.6rem', overflow: 'hidden',
            background: open === i ? `${c.color}08` : 'transparent',
            transition: 'all 0.15s',
          }}
        >
          <div
            onClick={() => setOpen(open === i ? null : i)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', cursor: 'pointer' }}
          >
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', fontWeight: 700, color: c.color, flex: 1, letterSpacing: '0.06em' }}>{c.title}</span>
            <span style={{ color: 'var(--text-2)', fontSize: '0.75rem' }}>{open === i ? '▲' : '▼'}</span>
          </div>
          {open === i && (
            <div style={{ padding: '0 1rem 0.9rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div>
                <span className="m4-tag" style={{ background: `${c.color}18`, color: c.color, border: `1px solid ${c.color}44` }}>Problem</span>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-1)', lineHeight: 1.55, marginTop: '0.3rem' }}>{c.problem}</p>
              </div>
              <div>
                <span className="m4-tag" style={{ background: 'rgba(52,211,153,0.12)', color: 'var(--emerald)', border: '1px solid rgba(52,211,153,0.3)' }}>Mitigation</span>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-1)', lineHeight: 1.55, marginTop: '0.3rem' }}>{c.mitigation}</p>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Linear Classifier Visualizer ──────────────────────────────────────────────
// Fixed 2D dataset with two classes
const LC_DATA = (() => {
  const pts = [];
  const class0 = [[1.2,2.1],[1.5,1.8],[0.8,2.5],[1.9,1.6],[1.3,2.8],[0.6,1.9],[2.1,2.3],[1.0,1.5],[1.7,2.0],[0.9,2.7]];
  const class1 = [[-1.1,-2.0],[-1.8,-1.5],[-0.7,-2.4],[-2.0,-1.8],[-1.4,-2.2],[-0.5,-1.6],[-1.9,-2.5],[-1.2,-1.3],[-1.6,-1.9],[-0.8,-2.8]];
  class0.forEach(([x, y]) => pts.push({ x, y, cls: 1 }));
  class1.forEach(([x, y]) => pts.push({ x, y, cls: -1 }));
  return pts;
})();

function LinearClassifierViz() {
  const [w, setW] = useState({ w1: 1.0, w2: 1.0, b: 0.0 });
  const canvasRef = useRef(null);

  const correct = LC_DATA.filter(p => {
    const score = w.w1 * p.x + w.w2 * p.y + w.b;
    return (score >= 0 ? 1 : -1) === p.cls;
  }).length;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const W = canvas.width = canvas.offsetWidth || 400;
    const H = canvas.height = 280;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, W, H);

    const RANGE = 3.5;
    const cx = W / 2, cy = H / 2;
    const scale = Math.min(W, H) / (2 * RANGE);

    const toCanvas = (x, y) => ({ px: cx + x * scale, py: cy - y * scale });

    // Grid
    ctx.strokeStyle = 'rgba(148,163,184,0.08)';
    ctx.lineWidth = 1;
    for (let g = -3; g <= 3; g++) {
      ctx.beginPath(); ctx.moveTo(cx + g * scale, 0); ctx.lineTo(cx + g * scale, H); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, cy - g * scale); ctx.lineTo(W, cy - g * scale); ctx.stroke();
    }
    // Axes
    ctx.strokeStyle = 'rgba(148,163,184,0.2)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(W, cy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, H); ctx.stroke();

    // Decision boundary: w1*x + w2*y + b = 0 → y = -(w1*x + b) / w2
    if (Math.abs(w.w2) > 0.01) {
      const x1 = -RANGE, x2 = RANGE;
      const y1 = -(w.w1 * x1 + w.b) / w.w2;
      const y2 = -(w.w1 * x2 + w.b) / w.w2;
      const p1 = toCanvas(x1, y1), p2 = toCanvas(x2, y2);
      ctx.strokeStyle = 'rgba(34,211,238,0.8)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(p1.px, p1.py); ctx.lineTo(p2.px, p2.py); ctx.stroke();
    }

    // Points
    LC_DATA.forEach(p => {
      const { px, py } = toCanvas(p.x, p.y);
      const score = w.w1 * p.x + w.w2 * p.y + w.b;
      const predicted = score >= 0 ? 1 : -1;
      const correct = predicted === p.cls;
      ctx.beginPath();
      ctx.arc(px, py, 6, 0, Math.PI * 2);
      ctx.fillStyle = p.cls === 1
        ? (correct ? 'rgba(34,211,238,0.85)' : 'rgba(34,211,238,0.3)')
        : (correct ? 'rgba(167,139,250,0.85)' : 'rgba(167,139,250,0.3)');
      ctx.fill();
      if (!correct) {
        ctx.strokeStyle = 'var(--rose)'; ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    });

    ctx.fillStyle = 'rgba(148,163,184,0.5)'; ctx.font = '9px monospace'; ctx.textAlign = 'left';
    ctx.fillText('Cyan = Class +1  ·  Violet = Class −1  ·  Faded = misclassified', 6, H - 6);
  }, [w]);

  const set = (key, val) => setW(prev => ({ ...prev, [key]: +val }));

  return (
    <div className="m4-two-col">
      <div className="m4-card">
        <div className="m4-card-h">Mathematical Foundation</div>
        <div className="m4-flabel">Decision Threshold</div>
        <Tex src="\sum_{i=1}^{m} w_i x_i > -b" block />
        <div className="m4-flabel">Hypothesis (Sign Function Form)</div>
        <Tex src="h(\vec{x}) = \text{sgn}\!\left(\sum_{i=1}^{m} w_i x_i + b\right)" block />
        <VarTable vars={[
          ['w_i', 'Weight for feature i — scales its contribution to the score'],
          ['x_i', 'Value of feature i for a given example'],
          ['b', 'Bias term — shifts the decision boundary away from the origin'],
          ['\\text{sgn}', 'Sign function: outputs +1 if argument > 0, −1 if < 0'],
        ]} />
        <div className="m4-hr" />
        <div className="m4-flabel">Sign Function Definition</div>
        <Tex src="\text{sgn}\; x := \begin{cases} -1 & \text{if } x < 0 \\ +1 & \text{if } x > 0 \end{cases}" block />
      </div>
      <div className="m4-card">
        <div className="m4-card-h">Decision Boundary Visualizer</div>
        <div className="m4-infobox" style={{ fontSize: '0.78rem' }}>
          Adjust weights and bias. The cyan line is the decision boundary where <strong>w₁x₁ + w₂x₂ + b = 0</strong>.
          Faded points are misclassified.
        </div>
        {[
          { key: 'w1', label: 'Weight w₁', min: -3, max: 3, step: 0.1 },
          { key: 'w2', label: 'Weight w₂', min: -3, max: 3, step: 0.1 },
          { key: 'b',  label: 'Bias b',    min: -3, max: 3, step: 0.1 },
        ].map(({ key, label, min, max, step }) => (
          <div className="m4-ctrl" key={key}>
            <div className="m4-ctrl-lbl"><span>{label}</span><span className="m4-ctrl-val">{w[key].toFixed(1)}</span></div>
            <input type="range" min={min} max={max} step={step} value={w[key]} onChange={e => set(key, e.target.value)} />
          </div>
        ))}
        <div className="m4-stats-row">
          <div className="m4-stat"><span className="m4-stat-l">Correct</span><span className="m4-stat-v" style={{ color: 'var(--emerald)' }}>{correct}/{LC_DATA.length}</span></div>
          <div className="m4-stat"><span className="m4-stat-l">Accuracy</span><span className="m4-stat-v" style={{ color: correct === LC_DATA.length ? 'var(--emerald)' : 'var(--amber)' }}>{(correct / LC_DATA.length * 100).toFixed(0)}%</span></div>
        </div>
        <canvas ref={canvasRef} className="m4-canvas" height="280" />
      </div>
    </div>
  );
}

// ── Performance Measures Visualizer ──────────────────────────────────────────
const TRUE_VALUES = [180, 210, 155, 330, 195, 250, 140, 290, 175, 220];

function PerformanceMeasuresViz() {
  const [offset, setOffset] = useState(0);
  const [noise, setNoise] = useState(15);
  const canvasRef = useRef(null);

  const predictions = TRUE_VALUES.map((v, i) => {
    const perturb = [12, -8, 20, -15, 5, -25, 10, -18, 8, -12][i] * (noise / 15);
    return Math.round(v + offset + perturb);
  });

  const errors = TRUE_VALUES.map((v, i) => predictions[i] - v);
  const mse = errors.reduce((s, e) => s + e * e, 0) / errors.length;
  const mae = errors.reduce((s, e) => s + Math.abs(e), 0) / errors.length;
  const rmse = Math.sqrt(mse);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const W = canvas.width = canvas.offsetWidth || 400;
    const H = canvas.height = 180;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, W, H);

    const n = TRUE_VALUES.length;
    const barW = (W - 20) / n - 3;
    const maxV = Math.max(...TRUE_VALUES, ...predictions);
    const scale = (H - 30) / maxV;

    TRUE_VALUES.forEach((tv, i) => {
      const pv = predictions[i];
      const bx = 10 + i * (barW + 3);
      // True value
      ctx.fillStyle = 'rgba(34,211,238,0.6)';
      ctx.fillRect(bx, H - 18 - tv * scale, barW / 2 - 1, tv * scale);
      // Predicted
      ctx.fillStyle = errors[i] >= 0 ? 'rgba(251,191,36,0.7)' : 'rgba(167,139,250,0.7)';
      ctx.fillRect(bx + barW / 2, H - 18 - pv * scale, barW / 2 - 1, pv * scale);
    });

    ctx.fillStyle = 'rgba(148,163,184,0.45)'; ctx.font = '8px monospace'; ctx.textAlign = 'center';
    ctx.fillText('Cyan = True  ·  Yellow/Violet = Predicted  ·  Yellow > true, Violet < true', W / 2, H - 3);
  }, [offset, noise, errors, predictions]);

  return (
    <div className="m4-two-col">
      <div className="m4-card">
        <div className="m4-card-h">Regression Performance Measures</div>
        <div className="m4-flabel">Mean Squared Error (MSE)</div>
        <Tex src="\text{MSE}(X, h) = \frac{1}{m}\sum_{i=1}^{m}\left(h(x^{(i)}) - y^{(i)}\right)^2" block />
        <div className="m4-flabel">Root Mean Squared Error (RMSE)</div>
        <Tex src="\text{RMSE}(X, h) = \sqrt{\text{MSE}(X,h)}" block />
        <div className="m4-flabel">Mean Absolute Error (MAE)</div>
        <Tex src="\text{MAE}(X, h) = \frac{1}{m}\sum_{i=1}^{m}\left|h(x^{(i)}) - y^{(i)}\right|" block />
        <VarTable vars={[
          ['m', 'Number of instances in the dataset'],
          ['x^{(i)}', 'Feature vector of the i-th instance'],
          ['y^{(i)}', 'True label (target value) of the i-th instance'],
          ['h', 'The prediction function (hypothesis)'],
        ]} />
        <div className="m4-infobox" style={{ fontSize: '0.78rem' }}>
          <strong>MSE vs MAE:</strong> MSE squares errors, heavily penalising outliers. MAE gives equal weight to all errors — more robust when outliers are present or unimportant.
        </div>
      </div>
      <div className="m4-card">
        <div className="m4-card-h">Interactive Error Explorer (Housing Prices)</div>
        <div className="m4-ctrl">
          <div className="m4-ctrl-lbl"><span>Prediction bias</span><span className="m4-ctrl-val">{offset > 0 ? '+' : ''}{offset}</span></div>
          <input type="range" min={-60} max={60} step={1} value={offset} onChange={e => setOffset(+e.target.value)} />
        </div>
        <div className="m4-ctrl">
          <div className="m4-ctrl-lbl"><span>Noise level</span><span className="m4-ctrl-val">{noise}</span></div>
          <input type="range" min={0} max={50} step={1} value={noise} onChange={e => setNoise(+e.target.value)} />
        </div>
        <div className="m4-stats-row">
          <div className="m4-stat"><span className="m4-stat-l">MSE</span><span className="m4-stat-v" style={{ color: 'var(--rose)' }}>{mse.toFixed(1)}</span></div>
          <div className="m4-stat"><span className="m4-stat-l">RMSE</span><span className="m4-stat-v" style={{ color: 'var(--amber)' }}>{rmse.toFixed(1)}</span></div>
          <div className="m4-stat"><span className="m4-stat-l">MAE</span><span className="m4-stat-v" style={{ color: 'var(--emerald)' }}>{mae.toFixed(1)}</span></div>
        </div>
        <canvas ref={canvasRef} className="m4-canvas" height="180" />
        <div className="m4-flabel" style={{ marginTop: '0.5rem' }}>
          RMSE is in the same units as y — more interpretable. MSE penalises large errors more harshly (squaring).
        </div>
      </div>
    </div>
  );
}

// ── Confusion Matrix Explorer ─────────────────────────────────────────────────
function ConfusionMatrixExplorer() {
  const [vals, setVals] = useState({ TP: 80, FP: 30, FN: 20, TN: 870 });
  const set = (k, v) => setVals(prev => ({ ...prev, [k]: Math.max(0, +v) }));

  const { TP, FP, FN, TN } = vals;
  const total = TP + FP + FN + TN;
  const accuracy = total > 0 ? ((TP + TN) / total * 100).toFixed(1) : '—';
  const precision = (TP + FP) > 0 ? (TP / (TP + FP) * 100).toFixed(1) : '—';
  const recall = (TP + FN) > 0 ? (TP / (TP + FN) * 100).toFixed(1) : '—';
  const prec = (TP + FP) > 0 ? TP / (TP + FP) : 0;
  const rec = (TP + FN) > 0 ? TP / (TP + FN) : 0;
  const f1 = (prec + rec) > 0 ? (2 * prec * rec / (prec + rec) * 100).toFixed(1) : '—';

  return (
    <div className="m4-two-col">
      <div className="m4-card">
        <div className="m4-card-h">Classification Evaluation Metrics</div>
        <div className="m4-flabel">Precision (Positive Predictive Value)</div>
        <Tex src="\text{precision} = \frac{TP}{TP + FP}" block />
        <div className="m4-flabel">Recall (True Positive Rate / Sensitivity)</div>
        <Tex src="\text{recall} = \frac{TP}{TP + FN}" block />
        <div className="m4-flabel">F₁ Score (Harmonic Mean)</div>
        <Tex src="F_1 = \frac{2}{\frac{1}{\text{precision}} + \frac{1}{\text{recall}}} = \frac{2 \cdot \text{precision} \cdot \text{recall}}{\text{precision} + \text{recall}}" block />
        <VarTable vars={[
          ['TP', 'True Positives — predicted positive, actually positive'],
          ['FP', 'False Positives — predicted positive, actually negative'],
          ['FN', 'False Negatives — predicted negative, actually positive'],
          ['TN', 'True Negatives — predicted negative, actually negative'],
        ]} />
        <div className="m4-hr" />
        <div className="m4-flabel">Precision/Recall Trade-off</div>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-1)', lineHeight: 1.55 }}>
          <strong style={{ color: 'var(--violet)' }}>Prioritise Precision</strong> when FP is costly (e.g., predicting it is safe to change lanes while driving — a FP puts lives at risk).<br /><br />
          <strong style={{ color: 'var(--emerald)' }}>Prioritise Recall</strong> when FN is costly (e.g., cancer diagnosis — missing a true positive is dangerous).
        </div>
      </div>

      <div className="m4-card">
        <div className="m4-card-h">Interactive Confusion Matrix</div>
        <div className="m4-infobox" style={{ fontSize: '0.78rem' }}>
          Adjust the counts below. Metrics update live. (Example: binary classifier on MNIST "5 vs not-5".)
        </div>
        {/* Confusion matrix grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px', marginBottom: '1rem', textAlign: 'center', fontSize: '0.7rem' }}>
          <div style={{ color: 'var(--text-2)', fontFamily: 'var(--font-mono)', fontSize: '0.62rem', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 4 }}>ACTUAL →</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--cyan)', padding: '4px' }}>Actual Positive</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--text-2)', padding: '4px' }}>Actual Negative</div>

          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--cyan)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 6 }}>Pred Positive</div>
          <div style={{ background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.3)', borderRadius: 4, padding: '0.5rem' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--emerald)', marginBottom: 2 }}>TP</div>
            <input type="number" min="0" value={TP} onChange={e => set('TP', e.target.value)} style={{ width: '64px', textAlign: 'center', background: 'transparent', border: 'none', fontFamily: 'var(--font-mono)', fontSize: '1rem', fontWeight: 700, color: 'var(--emerald)', outline: 'none' }} />
          </div>
          <div style={{ background: 'rgba(251,113,133,0.1)', border: '1px solid rgba(251,113,133,0.25)', borderRadius: 4, padding: '0.5rem' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--rose)', marginBottom: 2 }}>FP</div>
            <input type="number" min="0" value={FP} onChange={e => set('FP', e.target.value)} style={{ width: '64px', textAlign: 'center', background: 'transparent', border: 'none', fontFamily: 'var(--font-mono)', fontSize: '1rem', fontWeight: 700, color: 'var(--rose)', outline: 'none' }} />
          </div>

          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--text-2)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 6 }}>Pred Negative</div>
          <div style={{ background: 'rgba(251,113,133,0.1)', border: '1px solid rgba(251,113,133,0.25)', borderRadius: 4, padding: '0.5rem' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--rose)', marginBottom: 2 }}>FN</div>
            <input type="number" min="0" value={FN} onChange={e => set('FN', e.target.value)} style={{ width: '64px', textAlign: 'center', background: 'transparent', border: 'none', fontFamily: 'var(--font-mono)', fontSize: '1rem', fontWeight: 700, color: 'var(--rose)', outline: 'none' }} />
          </div>
          <div style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.25)', borderRadius: 4, padding: '0.5rem' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--emerald)', marginBottom: 2 }}>TN</div>
            <input type="number" min="0" value={TN} onChange={e => set('TN', e.target.value)} style={{ width: '64px', textAlign: 'center', background: 'transparent', border: 'none', fontFamily: 'var(--font-mono)', fontSize: '1rem', fontWeight: 700, color: 'var(--emerald)', outline: 'none' }} />
          </div>
        </div>

        <div className="m4-stats-row">
          <div className="m4-stat"><span className="m4-stat-l">Accuracy</span><span className="m4-stat-v" style={{ color: 'var(--cyan)' }}>{accuracy}%</span></div>
          <div className="m4-stat"><span className="m4-stat-l">Precision</span><span className="m4-stat-v" style={{ color: 'var(--violet)' }}>{precision}%</span></div>
          <div className="m4-stat"><span className="m4-stat-l">Recall</span><span className="m4-stat-v" style={{ color: 'var(--emerald)' }}>{recall}%</span></div>
          <div className="m4-stat"><span className="m4-stat-l">F₁</span><span className="m4-stat-v" style={{ color: 'var(--amber)' }}>{f1}%</span></div>
        </div>
        <div className="m4-warnbox" style={{ fontSize: '0.78rem', marginTop: '0.5rem' }}>
          <strong>Why accuracy fails on imbalanced data:</strong> With 10% spam (900 not-spam, 100 spam), a classifier that always predicts "not-spam" gets <strong>90% accuracy</strong> but precision = 0%, recall = 0%.
        </div>
      </div>
    </div>
  );
}

// ── Quiz Section ──────────────────────────────────────────────────────────────
function QuizSection() {
  const [answers, setAnswers] = useState({});
  const [revealed, setRevealed] = useState({});

  const choose = (qi, ai) => {
    if (revealed[qi]) return;
    setAnswers(prev => ({ ...prev, [qi]: ai }));
    setRevealed(prev => ({ ...prev, [qi]: true }));
  };

  const answered = Object.keys(revealed).length;
  const score = QUIZ_DATA.filter((q, i) => answers[i] === q.ans).length;
  const reset = () => { setAnswers({}); setRevealed({}); };

  return (
    <div>
      {answered > 0 && (
        <div className="m4-card" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '1.5rem' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '2rem', fontWeight: 700, color: score >= 6 ? 'var(--emerald)' : score >= 4 ? 'var(--amber)' : 'var(--rose)' }}>
            {score}/{answered}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.88rem', color: 'var(--text-0)', fontWeight: 600, marginBottom: '0.25rem' }}>
              {answered < QUIZ_DATA.length ? `${QUIZ_DATA.length - answered} questions remaining` : score >= 6 ? 'Excellent — strong understanding!' : score >= 4 ? 'Good — review the explanations below.' : 'Keep studying — read the feedback carefully.'}
            </div>
            <div style={{ height: 6, background: 'var(--bg-1)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${(answered / QUIZ_DATA.length) * 100}%`, background: 'var(--violet)', borderRadius: 3, transition: 'width 0.3s' }} />
            </div>
          </div>
          {answered === QUIZ_DATA.length && (
            <button className="m4-btn m4-btn-g" onClick={reset}>Reset</button>
          )}
        </div>
      )}

      {QUIZ_DATA.map((q, qi) => {
        const done = revealed[qi];
        const chosen = answers[qi];
        return (
          <div key={qi} className="m4-card" style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
              <span className="m4-tag" style={{ flexShrink: 0 }}>{q.lec}</span>
            </div>
            <div style={{ fontSize: '0.88rem', color: 'var(--text-0)', fontWeight: 600, lineHeight: 1.55, marginBottom: '0.75rem' }}>{q.q}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {q.opts.map((opt, ai) => {
                let bg = 'var(--bg-1)', border = 'var(--border)', col = 'var(--text-1)';
                if (done) {
                  if (ai === q.ans) { bg = 'rgba(52,211,153,0.12)'; border = 'rgba(52,211,153,0.45)'; col = 'var(--emerald)'; }
                  else if (ai === chosen) { bg = 'rgba(251,113,133,0.1)'; border = 'rgba(251,113,133,0.35)'; col = 'var(--rose)'; }
                }
                return (
                  <button
                    key={ai}
                    disabled={done}
                    onClick={() => choose(qi, ai)}
                    style={{
                      background: bg, border: `1px solid ${border}`, borderRadius: 5,
                      padding: '0.65rem 0.9rem', textAlign: 'left', cursor: done ? 'default' : 'pointer',
                      fontSize: '0.82rem', color: col, lineHeight: 1.45, transition: 'all 0.15s',
                      fontFamily: 'var(--font-sans)',
                    }}
                  >
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', opacity: 0.6, marginRight: '0.5rem' }}>{String.fromCharCode(65 + ai)}.</span>
                    {opt}
                  </button>
                );
              })}
            </div>
            {done && (
              <div style={{
                marginTop: '0.75rem', padding: '0.75rem 1rem', borderRadius: 5, fontSize: '0.81rem', lineHeight: 1.6,
                background: chosen === q.ans ? 'rgba(52,211,153,0.08)' : 'rgba(251,113,133,0.08)',
                border: `1px solid ${chosen === q.ans ? 'rgba(52,211,153,0.3)' : 'rgba(251,113,133,0.3)'}`,
                color: 'var(--text-1)',
              }}>
                <strong style={{ color: chosen === q.ans ? 'var(--emerald)' : 'var(--rose)' }}>{chosen === q.ans ? '✓ Correct — ' : '✗ Incorrect — '}</strong>
                {chosen === q.ans ? q.ok : q.ng}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── ML Workflow Steps ─────────────────────────────────────────────────────────
const WORKFLOW_STEPS = [
  { n: 1, title: 'Understand the Problem', desc: 'Understand business context, check assumptions, define the task type (regression/classification) and performance measure. Understand what data is available.' },
  { n: 2, title: 'Explore & Visualise the Data', desc: 'Look at the data structure, distributions, correlations, missing values, and outliers. Create visualisations to build intuition about the data.' },
  { n: 3, title: 'Prepare the Data', desc: 'Feature engineering, cleaning (handle missing values, outliers), encoding categorical variables, feature scaling (normalisation/standardisation), train/test split.' },
  { n: 4, title: 'Select & Train a Model', desc: 'Select candidate algorithms, train on training set, validate on validation set, tune hyperparameters, compare models using appropriate performance measures.' },
  { n: 5, title: 'Present the Solution', desc: 'Document assumptions, decisions, and results. Highlight what works, what does not, and what the system will do in production. Communicate to stakeholders.' },
  { n: 6, title: 'Launch, Monitor & Maintain', desc: 'Deploy the model, monitor live performance, watch for model drift (data distribution changes). Retrain regularly and continuously check assumptions.' },
];

function WorkflowSection() {
  const colors = ['var(--cyan)', 'var(--violet)', 'var(--emerald)', 'var(--amber)', 'var(--rose)', 'var(--cyan)'];
  return (
    <div className="m4-card">
      <div className="m4-card-h">End-to-End ML Project Workflow</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0.75rem' }}>
        {WORKFLOW_STEPS.map((s, i) => (
          <div key={s.n} style={{ border: `1px solid ${colors[i]}30`, borderRadius: 6, padding: '0.9rem', background: `${colors[i]}06` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', fontWeight: 700, color: colors[i], background: `${colors[i]}18`, border: `1px solid ${colors[i]}40`, borderRadius: 3, padding: '0.1em 0.45em' }}>Step {s.n}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', fontWeight: 700, color: colors[i] }}>{s.title}</span>
            </div>
            <p style={{ fontSize: '0.79rem', color: 'var(--text-2)', lineHeight: 1.5 }}>{s.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Bias Trick Section ────────────────────────────────────────────────────────
function BiasTrickSection() {
  return (
    <div className="m4-two-col">
      <div className="m4-card">
        <div className="m4-card-h">The Bias Trick</div>
        <div className="m4-flabel">Original form (explicit bias)</div>
        <Tex src="h(x) = \text{sgn}\!\left(\sum_{i=1}^{m} w_i x_i + b\right)" block />
        <div className="m4-flabel">Introduce dummy feature x₀ = 1 and weight w₀ = b</div>
        <Tex src="\text{sgn}\!\left(\sum_{i=0}^{m} w_i x_i\right) = \text{sgn}\!\left(\begin{pmatrix}w_0\\ w_1\\ \vdots\\ w_m\end{pmatrix}^{\!T} \begin{pmatrix}1\\ x_1\\ \vdots\\ x_m\end{pmatrix}\right)" block />
        <div className="m4-flabel">Simplified dot-product form</div>
        <Tex src="h(x) = \text{sgn}(w^T x)" block />
        <div className="m4-infobox" style={{ fontSize: '0.79rem' }}>
          <strong>Why?</strong> This clean dot-product form enables efficient NumPy vectorisation:<br />
          <code style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--cyan)' }}>np.sign(X @ w)</code><br />
          eliminates slow Python loops and enables GPU acceleration on large datasets.
        </div>
      </div>
      <div className="m4-card">
        <div className="m4-card-h">Weight Update Rule (Perceptron)</div>
        <div className="m4-flabel">Update rule when h(xᵢ) ≠ yᵢ</div>
        <Tex src="w \leftarrow w + y_i x_i \quad \text{if } y_i \ne h(x_i)" block />
        <div className="m4-flabel">Otherwise (correct prediction)</div>
        <Tex src="w \leftarrow w" block />
        <VarTable vars={[
          ['w', 'Current weight vector (including w₀ = bias)'],
          ['x_i', 'Feature vector of i-th training example (with x₀ = 1)'],
          ['y_i', 'True label of i-th example: +1 or −1'],
          ['h(x_i)', 'Current model prediction: sgn(wᵀxᵢ)'],
        ]} />
        <div className="m4-infobox" style={{ fontSize: '0.79rem' }}>
          <strong>Intuition:</strong> If the model predicts the wrong class, nudge the weight vector in the direction of yᵢxᵢ.
          If y = +1 and we predicted −1, add xᵢ to w (move boundary toward correct side).
          If y = −1 and we predicted +1, subtract xᵢ from w.
        </div>
        <div className="m4-flabel">NumPy vectorised batch update</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--cyan)', background: 'rgba(34,211,238,0.07)', border: '1px solid rgba(34,211,238,0.18)', padding: '0.5rem 0.8rem', borderRadius: 4 }}>
          {'predictions = np.sign(X @ w)'}<br />
          {'mistakes = predictions != y'}<br />
          {'w += X[mistakes].T @ y[mistakes]'}
        </div>
      </div>
    </div>
  );
}

// ── MNIST & ROC Section ───────────────────────────────────────────────────────
function MNISTSection() {
  return (
    <div className="m4-card">
      <div className="m4-card-h">MNIST & ROC Curve</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        <div>
          <div className="m4-flabel">MNIST Dataset</div>
          <ul className="m4-bullets">
            <li>70,000 handwritten digit images (0–9)</li>
            <li>Each image: 28×28 = <strong style={{ color: 'var(--cyan)' }}>784 features</strong></li>
            <li>Binary toy problem: classify "5" vs "not-5"</li>
            <li>Split into train/test using <code style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>train_test_split</code> with a fixed <code style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>random_state</code> to avoid data snooping bias</li>
          </ul>
          <div className="m4-hr" />
          <div className="m4-flabel">Why accuracy is insufficient</div>
          <div className="m4-warnbox" style={{ fontSize: '0.79rem' }}>
            Only ~10% of MNIST digits are 5s. A dumb classifier that <em>always</em> predicts "not-5" achieves over <strong>90% accuracy</strong> — yet it is completely useless. This is the class imbalance problem.
          </div>
        </div>
        <div>
          <div className="m4-flabel">ROC Curve (Receiver Operating Characteristic)</div>
          <ul className="m4-bullets">
            <li>Plots <strong>True Positive Rate</strong> (Recall) vs <strong>False Positive Rate</strong> at each threshold</li>
            <li><Tex src="\text{FPR} = \frac{FP}{FP + TN} = 1 - \text{specificity}" /></li>
            <li>A perfect classifier → top-left corner (TPR = 1, FPR = 0)</li>
            <li>Random classifier → diagonal line (AUC = 0.5)</li>
          </ul>
          <div className="m4-hr" />
          <div className="m4-flabel">Area Under the Curve (AUC)</div>
          <div className="m4-infobox" style={{ fontSize: '0.79rem' }}>
            <strong>AUC = 1.0</strong>: perfect classifier. <strong>AUC = 0.5</strong>: no better than random guessing. AUC summarises the ROC curve as a single number — a higher AUC means the classifier separates the classes better across all thresholds.
          </div>
          <div className="m4-flabel">Multiclass Classification</div>
          <ul className="m4-bullets">
            <li><strong>N &gt; 2 classes</strong> — discriminate between multiple categories</li>
            <li>Direct: Softmax Regression, Random Forests, Naive Bayes</li>
            <li>Binary-extended: SVMs (strictly binary) use OvO or OvR strategies</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

// ── Gradient Descent Visualizer ───────────────────────────────────────────────
function GradientDescentViz() {
  const J = theta => (theta - 2) ** 2;
  const dJ = theta => 2 * (theta - 2);
  const [params, setParams] = useState({ eta: 0.3, start: -4, maxSteps: 30 });
  const [stepIdx, setStepIdx] = useState(0);
  const [running, setRunning] = useState(false);
  const canvasRef = useRef(null);
  const rafRef = useRef(null);

  const steps = (() => {
    const pts = [{ theta: params.start, cost: J(params.start) }];
    let theta = params.start;
    for (let i = 0; i < params.maxSteps; i++) {
      theta = theta - params.eta * dJ(theta);
      pts.push({ theta, cost: J(theta) });
      if (!isFinite(theta) || Math.abs(theta) > 80) break;
    }
    return pts;
  })();

  const visible = steps.slice(0, stepIdx + 1);
  const last = visible[visible.length - 1];
  const diverged = !isFinite(last.theta) || Math.abs(last.theta) > 60;

  useEffect(() => {
    setStepIdx(0);
    setRunning(false);
    cancelAnimationFrame(rafRef.current);
  }, [params]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const W = canvas.width = canvas.offsetWidth || 440;
    const H = canvas.height = 240;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, W, H);

    const THETA_MIN = -6, THETA_MAX = 8, J_MIN = 0, J_MAX = 65;
    const px = t => ((t - THETA_MIN) / (THETA_MAX - THETA_MIN)) * (W - 40) + 30;
    const py = j => H - 18 - ((Math.min(j, J_MAX) - J_MIN) / (J_MAX - J_MIN)) * (H - 30);

    // Axes
    ctx.strokeStyle = 'rgba(148,163,184,0.15)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(30, 0); ctx.lineTo(30, H - 18); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(30, H - 18); ctx.lineTo(W, H - 18); ctx.stroke();
    ctx.fillStyle = 'rgba(148,163,184,0.4)'; ctx.font = '9px monospace'; ctx.textAlign = 'center';
    ctx.fillText('θ', W - 8, H - 14); ctx.textAlign = 'right'; ctx.fillText('J(θ)', 28, 10);

    // Parabola
    ctx.strokeStyle = 'rgba(167,139,250,0.8)'; ctx.lineWidth = 2; ctx.beginPath();
    for (let i = 0; i <= 300; i++) {
      const t = THETA_MIN + (THETA_MAX - THETA_MIN) * (i / 300);
      const pt = { x: px(t), y: py(J(t)) };
      i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y);
    }
    ctx.stroke();

    // GD path
    if (visible.length > 1) {
      ctx.strokeStyle = 'rgba(251,191,36,0.4)'; ctx.lineWidth = 1.5; ctx.beginPath();
      visible.forEach((s, i) => {
        const [x, y] = [px(s.theta), py(s.cost)];
        if (!isFinite(x) || !isFinite(y)) return;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.stroke();
    }

    // Step dots
    visible.forEach((s, i) => {
      const [x, y] = [px(s.theta), py(s.cost)];
      if (!isFinite(x) || !isFinite(y)) return;
      ctx.beginPath(); ctx.arc(x, y, i === visible.length - 1 ? 7 : 4, 0, Math.PI * 2);
      ctx.fillStyle = i === visible.length - 1 ? '#fbbf24' : 'rgba(251,191,36,0.4)';
      ctx.fill();
    });
    // Minimum marker
    ctx.strokeStyle = 'rgba(52,211,153,0.5)'; ctx.lineWidth = 1; ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.moveTo(px(2), 0); ctx.lineTo(px(2), H - 18); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(52,211,153,0.6)'; ctx.font = '8px monospace'; ctx.textAlign = 'center';
    ctx.fillText('min θ=2', px(2), 8);
  }, [stepIdx, params]);

  useEffect(() => {
    if (!running) return;
    const tick = () => {
      setStepIdx(prev => {
        if (prev >= steps.length - 1) { setRunning(false); return prev; }
        return prev + 1;
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [running, steps.length]);

  const etaHint = () => {
    if (params.eta < 0.05) return { msg: 'Very small η → extremely slow convergence', col: 'var(--violet)' };
    if (params.eta < 0.8)  return { msg: 'Good range — stable convergence expected', col: 'var(--emerald)' };
    if (params.eta < 1.0)  return { msg: 'Large η — convergence may oscillate', col: 'var(--amber)' };
    return { msg: 'η ≥ 1 → DIVERGENCE! Cost grows each step', col: 'var(--rose)' };
  };
  const hint = etaHint();

  return (
    <div className="m4-two-col">
      <div className="m4-card">
        <div className="m4-card-h">Gradient Descent — Theory</div>
        <div className="m4-flabel">Partial Derivative of MSE</div>
        <Tex src="\frac{\partial}{\partial\theta_j}\text{MSE}(\theta) = \frac{2}{m}\sum_{i=1}^{m}(\theta^\top x^{(i)} - y^{(i)})x_j^{(i)}" block />
        <div className="m4-flabel">Gradient Vector</div>
        <Tex src="\nabla_\theta \text{MSE}(\theta) = \frac{2}{m}X^\top(X\theta - y)" block />
        <div className="m4-flabel">Update Step</div>
        <Tex src="\theta^{(t+1)} = \theta^{(t)} - \eta \cdot \nabla_\theta \text{MSE}(\theta^{(t)})" block />
        <VarTable vars={[
          ['\\eta', 'Learning rate — controls step size. Too large: diverge. Too small: slow.'],
          ['\\nabla_\\theta \\text{MSE}', 'Gradient vector — points in direction of steepest ascent'],
          ['t', 'Iteration index'],
        ]} />
        <div className="m4-hr" />
        <div className="m4-flabel">Three GD Variants</div>
        {[
          { name: 'Batch GD', color: 'var(--violet)', desc: 'Full dataset each step. Accurate gradient but O(m) per iteration — slow for large datasets.' },
          { name: 'Stochastic GD (SGD)', color: 'var(--amber)', desc: 'One random instance per step. Very fast, but noisy path. Learning schedule helps convergence.' },
          { name: 'Mini-batch GD', color: 'var(--emerald)', desc: 'Small random subsets (32–512). Best of both — GPU vectorisation applies.' },
        ].map(v => (
          <div key={v.name} style={{ border: `1px solid ${v.color}30`, borderRadius: 5, padding: '0.6rem 0.8rem', marginBottom: '0.5rem', background: `${v.color}07` }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.67rem', fontWeight: 700, color: v.color, marginBottom: '0.25rem' }}>{v.name}</div>
            <div style={{ fontSize: '0.79rem', color: 'var(--text-2)' }}>{v.desc}</div>
          </div>
        ))}
      </div>
      <div className="m4-card">
        <div className="m4-card-h">Interactive GD on J(θ) = (θ − 2)²</div>
        {[
          { key: 'eta', label: 'Learning rate η', min: 0.01, max: 1.4, step: 0.01, fmt: v => v.toFixed(2) },
          { key: 'start', label: 'Start θ₀', min: -5, max: 6, step: 0.5, fmt: v => v.toFixed(1) },
          { key: 'maxSteps', label: 'Max steps', min: 5, max: 60, step: 1, fmt: v => v },
        ].map(({ key, label, min, max, step, fmt }) => (
          <div className="m4-ctrl" key={key}>
            <div className="m4-ctrl-lbl"><span>{label}</span><span className="m4-ctrl-val">{fmt(params[key])}</span></div>
            <input type="range" min={min} max={max} step={step} value={params[key]}
              onChange={e => setParams(p => ({ ...p, [key]: +e.target.value }))} />
          </div>
        ))}
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: hint.col, marginBottom: '0.5rem' }}>{hint.msg}</div>
        <div className="m4-btn-row">
          <button className="m4-btn" onClick={() => setStepIdx(0)}>Reset</button>
          <button className="m4-btn m4-btn-g" onClick={() => setStepIdx(s => Math.min(s + 1, steps.length - 1))}>Step →</button>
          <button className={`m4-btn m4-btn-p`} onClick={() => setRunning(r => !r)}>{running ? 'Pause' : 'Run'}</button>
        </div>
        <div className="m4-stats-row">
          <div className="m4-stat"><span className="m4-stat-l">Step</span><span className="m4-stat-v" style={{ color: 'var(--cyan)' }}>{stepIdx}</span></div>
          <div className="m4-stat"><span className="m4-stat-l">θ</span><span className="m4-stat-v" style={{ color: 'var(--violet)' }}>{isFinite(last.theta) ? last.theta.toFixed(3) : '∞'}</span></div>
          <div className="m4-stat"><span className="m4-stat-l">J(θ)</span><span className="m4-stat-v" style={{ color: diverged ? 'var(--rose)' : 'var(--emerald)' }}>{isFinite(last.cost) ? last.cost.toFixed(4) : '∞'}</span></div>
        </div>
        {diverged && <div className="m4-warnbox" style={{ fontSize: '0.78rem' }}>Diverged — reduce η below 1.0</div>}
        <canvas ref={canvasRef} className="m4-canvas" height="240" />
        <div style={{ fontSize: '0.72rem', color: 'var(--text-2)', marginTop: '0.3rem' }}>
          Violet: J(θ) parabola · Amber dots: GD path · Green dashed: true minimum at θ=2
        </div>
      </div>
    </div>
  );
}

// ── Polynomial Regression Visualizer ─────────────────────────────────────────
const POLY_DATA_BASE = generateSinData(30, 42, 0.35);

function PolyRegressionViz() {
  const [degree, setDegree] = useState(1);
  const [seed, setSeed] = useState(42);
  const canvasRef = useRef(null);

  const data = seed === 42 ? POLY_DATA_BASE : generateSinData(30, seed, 0.35);
  const { xTrain, yTrain, xTrue, yTrue } = data;

  const d = Math.min(degree, xTrain.length - 2, 12);
  const theta = fitPolynomial(xTrain, yTrain, d);
  const yHat = xTrain.map(x => evalPolynomial(theta, x));
  const trainMSE = calcMSE(yHat, yTrain);
  const fitLabel = d <= 1 ? { label: 'Underfitting', col: 'var(--violet)' } : d <= 5 ? { label: 'Good Fit', col: 'var(--emerald)' } : { label: 'Overfitting', col: 'var(--rose)' };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const W = canvas.width = canvas.offsetWidth || 440;
    const H = canvas.height = 240;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, W, H);

    const X_MIN = -Math.PI, X_MAX = Math.PI, Y_MIN = -2.5, Y_MAX = 2.5;
    const px = x => ((x - X_MIN) / (X_MAX - X_MIN)) * (W - 20) + 10;
    const py = y => H - 14 - ((y - Y_MIN) / (Y_MAX - Y_MIN)) * (H - 24);

    // Grid
    ctx.strokeStyle = 'rgba(148,163,184,0.07)'; ctx.lineWidth = 1;
    [-2, -1, 0, 1, 2].forEach(v => {
      ctx.beginPath(); ctx.moveTo(10, py(v)); ctx.lineTo(W - 10, py(v)); ctx.stroke();
    });

    // True sin(x) curve
    ctx.strokeStyle = 'rgba(52,211,153,0.55)'; ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]);
    ctx.beginPath();
    xTrue.forEach((x, i) => { const pt = { x: px(x), y: py(yTrue[i]) }; i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y); });
    ctx.stroke(); ctx.setLineDash([]);

    // Fitted curve
    ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 2; ctx.beginPath();
    const N = 300;
    for (let i = 0; i <= N; i++) {
      const x = X_MIN + (X_MAX - X_MIN) * (i / N);
      const y = evalPolynomial(theta, x);
      const pt = { x: px(x), y: py(Math.max(Math.min(y, Y_MAX + 1), Y_MIN - 1)) };
      i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y);
    }
    ctx.stroke();

    // Training points
    xTrain.forEach((x, i) => {
      ctx.beginPath(); ctx.arc(px(x), py(yTrain[i]), 4.5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(99,102,241,0.75)'; ctx.fill();
    });

    ctx.fillStyle = 'rgba(148,163,184,0.45)'; ctx.font = '8px monospace'; ctx.textAlign = 'center';
    ctx.fillText('Green dashed: true sin(x)  ·  Amber: polynomial fit  ·  Indigo dots: training data', W / 2, H - 2);
  }, [degree, seed, theta, xTrain, yTrain, xTrue, yTrue]);

  return (
    <div className="m4-two-col">
      <div className="m4-card">
        <div className="m4-card-h">Polynomial Regression — Theory</div>
        <div className="m4-flabel">Polynomial feature expansion</div>
        <Tex src="\hat{y} = \theta_0 + \theta_1 x + \theta_2 x^2 + \cdots + \theta_d x^d = \theta^\top \phi(x)" block />
        <div className="m4-infobox" style={{ fontSize: '0.79rem' }}>
          Polynomial Regression is still <strong>linear</strong> in the parameters θ. The trick is to treat each power xʲ as a new feature. This lets us use the Normal Equation directly.
        </div>
        <div className="m4-flabel">Normal Equation Solution</div>
        <Tex src="\hat{\theta} = (X^\top X)^{-1} X^\top y" block />
        <div className="m4-hr" />
        <div className="m4-flabel">Learning Curves — Diagnosis</div>
        {[
          { title: 'Underfitting (d ≤ 1)', col: 'var(--violet)', desc: 'Both training and validation MSE plateau at a high value. Adding more data won\'t help — the model is too simple.' },
          { title: 'Good fit (d ≈ 2–5)', col: 'var(--emerald)', desc: 'Training MSE rises slightly with data; validation MSE converges downward. Both meet at a reasonable level.' },
          { title: 'Overfitting (d ≥ 6)', col: 'var(--rose)', desc: 'Training MSE is near zero but validation MSE stays high. Large gap = high variance. Need regularisation or more data.' },
        ].map(item => (
          <div key={item.title} style={{ border: `1px solid ${item.col}25`, borderRadius: 5, padding: '0.55rem 0.75rem', marginBottom: '0.45rem', background: `${item.col}07` }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', fontWeight: 700, color: item.col, marginBottom: '0.2rem' }}>{item.title}</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-2)' }}>{item.desc}</div>
          </div>
        ))}
      </div>
      <div className="m4-card">
        <div className="m4-card-h">Interactive Polynomial Fit on sin(x) data</div>
        <div className="m4-ctrl">
          <div className="m4-ctrl-lbl"><span>Degree d</span><span className="m4-ctrl-val">{d}</span></div>
          <input type="range" min={1} max={12} step={1} value={degree} onChange={e => setDegree(+e.target.value)} />
        </div>
        <div className="m4-btn-row">
          <button className="m4-btn m4-btn-g" onClick={() => setSeed(Math.floor(Math.random() * 9999))}>New Data</button>
          <button className="m4-btn" onClick={() => setSeed(42)}>Reset</button>
        </div>
        <div className="m4-stats-row">
          <div className="m4-stat"><span className="m4-stat-l">Degree</span><span className="m4-stat-v" style={{ color: 'var(--cyan)' }}>{d}</span></div>
          <div className="m4-stat"><span className="m4-stat-l">Train MSE</span><span className="m4-stat-v" style={{ color: 'var(--amber)' }}>{trainMSE.toFixed(4)}</span></div>
          <div className="m4-stat"><span className="m4-stat-l">Diagnosis</span><span className="m4-stat-v" style={{ color: fitLabel.col, fontSize: '0.72rem' }}>{fitLabel.label}</span></div>
        </div>
        <canvas ref={canvasRef} className="m4-canvas" height="240" />
      </div>
    </div>
  );
}

// ── Sigmoid Visualizer ────────────────────────────────────────────────────────
function SigmoidViz() {
  const [z, setZ] = useState(0);
  const canvasRef = useRef(null);
  const sigma = 1 / (1 + Math.exp(-z));
  const isPos = sigma >= 0.5;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const W = canvas.width = canvas.offsetWidth || 440;
    const H = canvas.height = 200;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, W, H);

    const Z_MIN = -7, Z_MAX = 7;
    const px = zv => ((zv - Z_MIN) / (Z_MAX - Z_MIN)) * (W - 20) + 10;
    const py = p => H - 16 - p * (H - 28);

    // Grid lines
    ctx.strokeStyle = 'rgba(148,163,184,0.08)'; ctx.lineWidth = 1;
    [0, 0.25, 0.5, 0.75, 1.0].forEach(p => {
      ctx.beginPath(); ctx.moveTo(10, py(p)); ctx.lineTo(W - 10, py(p)); ctx.stroke();
    });

    // Decision threshold
    ctx.strokeStyle = 'rgba(251,113,133,0.4)'; ctx.lineWidth = 1.5; ctx.setLineDash([5, 3]);
    ctx.beginPath(); ctx.moveTo(10, py(0.5)); ctx.lineTo(W - 10, py(0.5)); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(251,113,133,0.5)'; ctx.font = '8px monospace'; ctx.textAlign = 'left';
    ctx.fillText('threshold p=0.5', 12, py(0.5) - 4);

    // Sigmoid curve
    ctx.strokeStyle = 'rgba(99,102,241,0.9)'; ctx.lineWidth = 2.5; ctx.beginPath();
    for (let i = 0; i <= 300; i++) {
      const zv = Z_MIN + (Z_MAX - Z_MIN) * (i / 300);
      const p = 1 / (1 + Math.exp(-zv));
      i === 0 ? ctx.moveTo(px(zv), py(p)) : ctx.lineTo(px(zv), py(p));
    }
    ctx.stroke();

    // Current point
    ctx.beginPath(); ctx.arc(px(z), py(sigma), 8, 0, Math.PI * 2);
    ctx.fillStyle = isPos ? '#34d399' : '#fbbf24';
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.fill(); ctx.stroke();

    // Axis labels
    ctx.fillStyle = 'rgba(148,163,184,0.5)'; ctx.font = '8px monospace'; ctx.textAlign = 'center';
    ctx.fillText('z = θᵀx (logit)', W / 2, H - 2);
  }, [z, sigma, isPos]);

  return (
    <div className="m4-two-col">
      <div className="m4-card">
        <div className="m4-card-h">Logistic Regression — Theory</div>
        <div className="m4-flabel">Probability Estimation</div>
        <Tex src="\hat{p} = h_\theta(x) = \sigma(\theta^\top x)" block />
        <div className="m4-flabel">Sigmoid (Logistic) Function</div>
        <Tex src="\sigma(t) = \frac{1}{1 + e^{-t}}" block />
        <div className="m4-flabel">Decision Rule</div>
        <Tex src="\hat{y} = \begin{cases} 1 & \text{if } \hat{p} \ge 0.5 \iff \theta^\top x \ge 0 \\ 0 & \text{if } \hat{p} < 0.5 \iff \theta^\top x < 0 \end{cases}" block />
        <div className="m4-hr" />
        <div className="m4-flabel">Log Loss (Cross-Entropy Cost)</div>
        <Tex src="J(\theta) = -\frac{1}{m}\sum_{i=1}^{m}\left[y^{(i)}\log\hat{p}^{(i)} + (1-y^{(i)})\log(1-\hat{p}^{(i)})\right]" block />
        <div className="m4-infobox" style={{ fontSize: '0.79rem' }}>
          <strong>Why not MSE?</strong> MSE + sigmoid is non-convex — gradient descent may get stuck in local minima. Log loss is convex for logistic regression, <strong>guaranteeing</strong> gradient descent finds the global minimum.
        </div>
      </div>
      <div className="m4-card">
        <div className="m4-card-h">Interactive Sigmoid σ(z)</div>
        <div className="m4-ctrl">
          <div className="m4-ctrl-lbl"><span>Logit z = θᵀx</span><span className="m4-ctrl-val">{z.toFixed(2)}</span></div>
          <input type="range" min={-7} max={7} step={0.1} value={z} onChange={e => setZ(+e.target.value)} />
        </div>
        <div className="m4-stats-row">
          <div className="m4-stat"><span className="m4-stat-l">σ(z)</span><span className="m4-stat-v" style={{ color: 'var(--violet)' }}>{sigma.toFixed(5)}</span></div>
          <div className="m4-stat"><span className="m4-stat-l">P(y=1)</span><span className="m4-stat-v" style={{ color: 'var(--cyan)' }}>{(sigma * 100).toFixed(1)}%</span></div>
          <div className="m4-stat"><span className="m4-stat-l">Prediction</span><span className="m4-stat-v" style={{ color: isPos ? 'var(--emerald)' : 'var(--amber)', fontSize: '0.72rem' }}>{isPos ? 'Class 1' : 'Class 0'}</span></div>
        </div>
        <canvas ref={canvasRef} className="m4-canvas" height="200" />
        <div className="m4-infobox" style={{ marginTop: '0.75rem', fontSize: '0.79rem' }}>
          <strong>σ({z.toFixed(2)}) = 1 / (1 + e^(−{z.toFixed(2)})) = {sigma.toFixed(5)}</strong><br />
          {isPos ? `z > 0 → σ(z) > 0.5 → predict Class 1 (positive)` : `z < 0 → σ(z) < 0.5 → predict Class 0 (negative)`}
        </div>
      </div>
    </div>
  );
}

// ── Regularization Visualizer ────────────────────────────────────────────────
const OLS_COEFFS = [2.8, -1.9, 3.4, -0.6, 1.5, -2.7, 0.4];
const FEAT_LABELS = ['x₁', 'x₂', 'x₃', 'x₄', 'x₅', 'x₆', 'x₇'];

function RegularizationViz() {
  const [method, setMethod] = useState('ridge');
  const [alpha, setAlpha] = useState(0.5);
  const [mixR, setMixR] = useState(0.5);
  const canvasRef = useRef(null);

  const applyRidge = a => OLS_COEFFS.map(c => c / (1 + a));
  const applyLasso = a => OLS_COEFFS.map(c => Math.sign(c) * Math.max(0, Math.abs(c) - a));
  const applyElastic = (a, r) => OLS_COEFFS.map(c => {
    const soft = Math.sign(c) * Math.max(0, Math.abs(c) - r * a);
    return soft / (1 + (1 - r) * a);
  });

  const regCoeffs = method === 'ridge' ? applyRidge(alpha) : method === 'lasso' ? applyLasso(alpha) : applyElastic(alpha, mixR);
  const zeroCount = regCoeffs.filter(c => Math.abs(c) < 1e-6).length;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const W = canvas.width = canvas.offsetWidth || 440;
    const H = canvas.height = 220;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, W, H);

    const n = OLS_COEFFS.length;
    const barGroupW = (W - 20) / n;
    const barW = barGroupW * 0.38;
    const maxV = 4.0;
    const zeroLine = H / 2;
    const scale = (H / 2 - 18) / maxV;

    // Zero line
    ctx.strokeStyle = 'rgba(148,163,184,0.2)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(10, zeroLine); ctx.lineTo(W - 10, zeroLine); ctx.stroke();

    OLS_COEFFS.forEach((ols, i) => {
      const reg = regCoeffs[i];
      const bx = 10 + i * barGroupW + barGroupW * 0.08;

      // OLS bar (ghost)
      const olsH = Math.abs(ols) * scale;
      const olsY = ols >= 0 ? zeroLine - olsH : zeroLine;
      ctx.fillStyle = ols >= 0 ? 'rgba(99,102,241,0.2)' : 'rgba(239,68,68,0.2)';
      ctx.fillRect(bx, olsY, barW, olsH);

      // Regularised bar
      const regH = Math.abs(reg) * scale;
      const regY = reg >= 0 ? zeroLine - regH : zeroLine;
      const isZero = Math.abs(reg) < 1e-6;
      ctx.fillStyle = isZero ? 'rgba(148,163,184,0.3)' : (reg >= 0 ? 'rgba(99,102,241,0.8)' : 'rgba(239,68,68,0.8)');
      ctx.fillRect(bx + barW + 2, regY, barW, Math.max(regH, 1));

      // Label
      ctx.fillStyle = 'rgba(148,163,184,0.6)'; ctx.font = '9px monospace'; ctx.textAlign = 'center';
      ctx.fillText(FEAT_LABELS[i], bx + barW, H - 3);

      // Zero marker
      if (isZero) {
        ctx.fillStyle = 'var(--rose)'; ctx.font = 'bold 8px monospace';
        ctx.fillText('0', bx + barW + 2 + barW / 2, zeroLine - 3);
      }
    });

    ctx.fillStyle = 'rgba(148,163,184,0.4)'; ctx.font = '8px monospace'; ctx.textAlign = 'left';
    ctx.fillText('Faded = OLS (unregularised)  ·  Solid = regularised', 12, 10);
  }, [method, alpha, mixR, regCoeffs]);

  const insight = method === 'lasso' && zeroCount > 0
    ? `Lasso: ${zeroCount}/${OLS_COEFFS.length} coefficients driven to exactly zero → automatic feature selection.`
    : method === 'ridge'
    ? 'Ridge: shrinks all coefficients proportionally but never reaches exactly zero.'
    : `Elastic Net (r=${mixR.toFixed(2)}): blend of Ridge and Lasso. At r≈1 → Lasso behaviour; r≈0 → Ridge behaviour.`;

  return (
    <div className="m4-two-col">
      <div className="m4-card">
        <div className="m4-card-h">Regularised Linear Models</div>
        <div className="m4-flabel">Ridge Regression (ℓ₂ penalty)</div>
        <Tex src="J(\theta) = \text{MSE}(\theta) + \alpha\sum_{i=1}^{n}\theta_i^2" block />
        <div className="m4-flabel">Lasso Regression (ℓ₁ penalty)</div>
        <Tex src="J(\theta) = \text{MSE}(\theta) + \alpha\sum_{i=1}^{n}|\theta_i|" block />
        <div className="m4-flabel">Elastic Net (combined)</div>
        <Tex src="J(\theta) = \text{MSE}(\theta) + r\alpha\sum_{i=1}^{n}|\theta_i| + \frac{1-r}{2}\alpha\sum_{i=1}^{n}\theta_i^2" block />
        <VarTable vars={[
          ['\\alpha', 'Regularisation strength — larger α → more shrinkage'],
          ['r', 'Elastic Net mix ratio: r=1 → pure Lasso, r=0 → pure Ridge'],
          ['\\ell_1', 'ℓ₁ norm: sum of |θⱼ| — creates sparsity (exact zeros)'],
          ['\\ell_2', 'ℓ₂ norm: sum of θⱼ² — smooth shrinkage, no exact zeros'],
        ]} />
        <div className="m4-infobox" style={{ fontSize: '0.78rem' }}>
          <strong>When to use:</strong> Ridge when most features contribute. Lasso for automatic feature selection.
          Elastic Net when groups of correlated features exist.
        </div>
      </div>
      <div className="m4-card">
        <div className="m4-card-h">Coefficient Shrinkage Visualizer</div>
        <div className="m4-radio-row">
          {[['ridge', 'Ridge'], ['lasso', 'Lasso'], ['elastic', 'Elastic Net']].map(([v, l]) => (
            <label key={v} className={`m4-rpill ${method === v ? 'm4-rpill--on' : ''}`}>
              <input type="radio" value={v} checked={method === v} onChange={() => setMethod(v)} style={{ display: 'none' }} />{l}
            </label>
          ))}
        </div>
        <div className="m4-ctrl">
          <div className="m4-ctrl-lbl"><span>α (strength)</span><span className="m4-ctrl-val">{alpha.toFixed(2)}</span></div>
          <input type="range" min={0} max={3.5} step={0.05} value={alpha} onChange={e => setAlpha(+e.target.value)} />
        </div>
        {method === 'elastic' && (
          <div className="m4-ctrl">
            <div className="m4-ctrl-lbl"><span>Mix ratio r</span><span className="m4-ctrl-val">{mixR.toFixed(2)}</span></div>
            <input type="range" min={0} max={1} step={0.05} value={mixR} onChange={e => setMixR(+e.target.value)} />
          </div>
        )}
        <div className="m4-stats-row">
          <div className="m4-stat"><span className="m4-stat-l">Zeros</span><span className="m4-stat-v" style={{ color: zeroCount > 0 ? 'var(--rose)' : 'var(--text-2)' }}>{zeroCount}/{OLS_COEFFS.length}</span></div>
          <div className="m4-stat"><span className="m4-stat-l">Method</span><span className="m4-stat-v" style={{ color: 'var(--cyan)', fontSize: '0.7rem' }}>{method}</span></div>
        </div>
        <canvas ref={canvasRef} className="m4-canvas" height="220" />
        <div className="m4-infobox" style={{ marginTop: '0.5rem', fontSize: '0.78rem' }}>{insight}</div>
      </div>
    </div>
  );
}

// ── KNN Visualizer ────────────────────────────────────────────────────────────
const KNN_TRAIN = [
  {x:1.2,y:7.8},{x:1.8,y:6.5},{x:2.5,y:8.1},{x:0.9,y:5.9},{x:3.1,y:7.2},
  {x:1.5,y:9.0},{x:2.8,y:6.0},{x:0.5,y:7.0},{x:3.5,y:8.5},{x:2.0,y:5.5},
  {x:1.0,y:8.8},{x:3.8,y:6.8},{x:2.2,y:9.2},{x:0.7,y:6.2},{x:4.0,y:7.5},
  {x:1.6,y:7.0},{x:2.9,y:5.2},{x:3.3,y:9.0},{x:0.3,y:8.0},{x:4.5,y:8.0},
  {x:6.2,y:2.8},{x:7.1,y:1.9},{x:5.8,y:3.5},{x:8.0,y:2.5},{x:6.8,y:4.0},
  {x:7.5,y:3.2},{x:5.5,y:2.0},{x:8.5,y:1.5},{x:6.0,y:4.5},{x:7.8,y:4.2},
  {x:5.2,y:3.0},{x:8.8,y:3.0},{x:6.5,y:1.5},{x:7.2,y:5.0},{x:5.0,y:4.0},
  {x:8.2,y:4.8},{x:6.3,y:3.8},{x:7.6,y:2.2},{x:5.7,y:4.8},{x:9.0,y:2.0},
];
const KNN_LABELS = [...Array(20).fill(0), ...Array(20).fill(1)];
const KNN_COLORS = ['#60a5fa', '#f87171'];

function KNNViz() {
  const [k, setK] = useState(3);
  const [metric, setMetric] = useState('euclidean');
  const [queryPt, setQueryPt] = useState(null);
  const [heatCache, setHeatCache] = useState(null);
  const [heatKey, setHeatKey] = useState('');
  const canvasRef = useRef(null);

  const dist = (a, b) => metric === 'manhattan'
    ? Math.abs(a.x - b.x) + Math.abs(a.y - b.y)
    : Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);

  const predict = (qx, qy) => {
    const dists = KNN_TRAIN.map((pt, i) => ({ dist: dist({ x: qx, y: qy }, pt), label: KNN_LABELS[i], pt }))
      .sort((a, b) => a.dist - b.dist);
    const neighbours = dists.slice(0, k);
    const votes = [0, 0];
    neighbours.forEach(n => votes[n.label]++);
    return { predictedClass: votes[0] >= votes[1] ? 0 : 1, votes, neighbours };
  };

  const toCanvas = (dx, dy, W, H) => ({
    cx: ((dx) / 10) * W,
    cy: H - (dy / 10) * H,
  });
  const fromCanvas = (cx, cy, W, H) => ({ dx: (cx / W) * 10, dy: (1 - cy / H) * 10 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = canvas.offsetWidth || 400;
    canvas.height = canvas.width;
    const W = canvas.width, H = canvas.height;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, W, H);

    // Heatmap
    const key = `${k}_${metric}`;
    let imgData;
    if (heatKey === key && heatCache) {
      imgData = heatCache;
    } else {
      imgData = ctx.createImageData(W, H);
      for (let py = 0; py < H; py++) {
        for (let px = 0; px < W; px++) {
          const { dx, dy } = fromCanvas(px, py, W, H);
          const { predictedClass, votes } = predict(dx, dy);
          const conf = votes[predictedClass] / k;
          const base = predictedClass === 0 ? [60, 130, 200] : [200, 80, 80];
          const a = Math.round((0.15 + conf * 0.25) * 255);
          const idx = (py * W + px) * 4;
          imgData.data[idx] = base[0]; imgData.data[idx+1] = base[1];
          imgData.data[idx+2] = base[2]; imgData.data[idx+3] = a;
        }
      }
      setHeatCache(imgData);
      setHeatKey(key);
    }
    ctx.putImageData(imgData, 0, 0);

    // Training points
    KNN_TRAIN.forEach((pt, i) => {
      const { cx, cy } = toCanvas(pt.x, pt.y, W, H);
      ctx.beginPath(); ctx.arc(cx, cy, 5, 0, Math.PI * 2);
      ctx.fillStyle = KNN_COLORS[KNN_LABELS[i]];
      ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 1;
      ctx.fill(); ctx.stroke();
    });

    if (!queryPt) {
      ctx.fillStyle = 'rgba(148,163,184,0.5)'; ctx.font = '11px monospace'; ctx.textAlign = 'center';
      ctx.fillText('Click to place a query point', W / 2, H / 2);
      return;
    }

    const { predictedClass, neighbours } = predict(queryPt.x, queryPt.y);
    const { cx: qcx, cy: qcy } = toCanvas(queryPt.x, queryPt.y, W, H);

    // Lines to neighbours
    ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]);
    neighbours.forEach(n => {
      const { cx, cy } = toCanvas(n.pt.x, n.pt.y, W, H);
      ctx.beginPath(); ctx.moveTo(qcx, qcy); ctx.lineTo(cx, cy); ctx.stroke();
    });
    ctx.setLineDash([]);

    // Neighbour rings
    neighbours.forEach(n => {
      const { cx, cy } = toCanvas(n.pt.x, n.pt.y, W, H);
      ctx.beginPath(); ctx.arc(cx, cy, 9, 0, Math.PI * 2);
      ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 2; ctx.stroke();
    });

    // Query point
    ctx.beginPath(); ctx.arc(qcx, qcy, 8, 0, Math.PI * 2);
    ctx.fillStyle = KNN_COLORS[predictedClass]; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5;
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 11px monospace'; ctx.textAlign = 'center';
    ctx.fillText('?', qcx, qcy + 4);
  }, [k, metric, queryPt, heatCache, heatKey]);

  // Invalidate heat cache when k or metric changes
  useEffect(() => { setHeatCache(null); setHeatKey(''); }, [k, metric]);

  const handleClick = e => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const cx = (e.clientX - rect.left) * scaleX;
    const cy = (e.clientY - rect.top) * scaleY;
    const { dx, dy } = fromCanvas(cx, cy, canvas.width, canvas.height);
    setQueryPt({ x: dx, y: dy });
  };

  const result = queryPt ? predict(queryPt.x, queryPt.y) : null;

  return (
    <div className="m4-two-col">
      <div className="m4-card">
        <div className="m4-card-h">kNN — Theory & Tradeoffs</div>
        <div className="m4-flabel">Minkowski Distance</div>
        <Tex src="D(x_i, x_j) = \left(\sum_{l=1}^{n} |x_i[l] - x_j[l]|^p\right)^{1/p}" block />
        <VarTable vars={[
          ['p=1', 'Manhattan distance (L1) — sum of absolute differences'],
          ['p=2', 'Euclidean distance (L2) — straight-line distance'],
        ]} />
        <div className="m4-flabel">Majority Vote Prediction</div>
        <Tex src="\hat{y}_q = \arg\max_{c \in C} \sum_{i=1}^{k} \delta(c_i, c)" block />
        <div className="m4-hr" />
        <div className="m4-flabel">Tradeoffs</div>
        {[
          { label: 'Small k', col: 'var(--rose)', desc: 'Sensitive to noise — each individual training point dominates. Overfitting / high variance.' },
          { label: 'Large k', col: 'var(--violet)', desc: 'Over-smoothed boundary — may ignore relevant local structure. Underfitting / high bias. Favours majority class in imbalanced datasets.' },
          { label: 'Feature Scaling', col: 'var(--amber)', desc: 'Essential! Features with larger scale dominate the distance metric. Always normalise before kNN.' },
          { label: 'No Explicit Model', col: 'var(--emerald)', desc: 'Instance-based — no training phase. All computation deferred to prediction time (lazy learning). Memory-intensive.' },
        ].map(item => (
          <div key={item.label} style={{ border: `1px solid ${item.col}25`, borderRadius: 5, padding: '0.55rem 0.75rem', marginBottom: '0.4rem', background: `${item.col}07` }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', fontWeight: 700, color: item.col, marginBottom: '0.15rem' }}>{item.label}</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-2)' }}>{item.desc}</div>
          </div>
        ))}
      </div>
      <div className="m4-card">
        <div className="m4-card-h">Interactive kNN Classifier</div>
        <div className="m4-ctrl">
          <div className="m4-ctrl-lbl"><span>k (neighbours)</span><span className="m4-ctrl-val">{k}</span></div>
          <input type="range" min={1} max={15} step={1} value={k} onChange={e => setK(+e.target.value)} />
        </div>
        <div className="m4-radio-row">
          {[['euclidean', 'Euclidean (L2)'], ['manhattan', 'Manhattan (L1)']].map(([v, l]) => (
            <label key={v} className={`m4-rpill ${metric === v ? 'm4-rpill--on' : ''}`}>
              <input type="radio" value={v} checked={metric === v} onChange={() => setMetric(v)} style={{ display: 'none' }} />{l}
            </label>
          ))}
        </div>
        <div className="m4-infobox" style={{ fontSize: '0.76rem' }}>
          Background colour shows predicted class region. Click to place a query point (?) and see its k nearest neighbours highlighted in amber.
        </div>
        {result && (
          <div className="m4-stats-row">
            <div className="m4-stat"><span className="m4-stat-l">Prediction</span><span className="m4-stat-v" style={{ color: KNN_COLORS[result.predictedClass], fontSize: '0.7rem' }}>Class {result.predictedClass === 0 ? 'A' : 'B'}</span></div>
            <div className="m4-stat"><span className="m4-stat-l">Votes A/B</span><span className="m4-stat-v" style={{ color: 'var(--amber)' }}>{result.votes[0]}/{result.votes[1]}</span></div>
          </div>
        )}
        <canvas ref={canvasRef} className="m4-canvas" style={{ cursor: 'crosshair', aspectRatio: '1' }} onClick={handleClick} />
        <button className="m4-btn" style={{ marginTop: '0.5rem' }} onClick={() => setQueryPt(null)}>Clear Query</button>
      </div>
    </div>
  );
}

// ── Softmax & Multiclass Section ──────────────────────────────────────────────
function SoftmaxSection() {
  const [logits, setLogits] = useState([2.0, 1.0, -0.5, 0.5]);
  const [nClasses, setNClasses] = useState(4);

  const maxZ = Math.max(...logits.slice(0, nClasses));
  const exps = logits.slice(0, nClasses).map(z => Math.exp(z - maxZ));
  const sumE = exps.reduce((a, b) => a + b, 0);
  const probs = exps.map(e => e / sumE);
  const argmax = probs.indexOf(Math.max(...probs));

  const COLS = ['var(--cyan)', 'var(--violet)', 'var(--emerald)', 'var(--amber)', 'var(--rose)'];

  return (
    <div className="m4-two-col">
      <div className="m4-card">
        <div className="m4-card-h">Softmax Regression</div>
        <div className="m4-flabel">Score for class k</div>
        <Tex src="s_k(x) = (\theta^{(k)})^\top x" block />
        <div className="m4-flabel">Softmax probability estimate</div>
        <Tex src="\hat{p}_k = \frac{\exp(s_k(x))}{\sum_{j=1}^{K}\exp(s_j(x))}" block />
        <div className="m4-flabel">Prediction</div>
        <Tex src="\hat{y} = \arg\max_k \, \hat{p}_k = \arg\max_k \, s_k(x)" block />
        <div className="m4-flabel">Cross-Entropy Cost Function</div>
        <Tex src="J(\theta) = -\frac{1}{m}\sum_{i=1}^{m}\sum_{k=1}^{K} y_k^{(i)} \log\hat{p}_k^{(i)}" block />
        <div className="m4-infobox" style={{ fontSize: '0.79rem' }}>
          Softmax outputs always sum to 1 and are all positive — a proper probability distribution over K classes. Numerically stable implementation subtracts max(z) before exponentiating.
        </div>
        <div className="m4-hr" />
        <div className="m4-flabel">Multiclass & Multilabel Strategies</div>
        <ul className="m4-bullets">
          <li><strong>Multiclass (OvA/OvR):</strong> Train one binary classifier per class. Predict the class whose classifier is most confident.</li>
          <li><strong>Multiclass (OvO):</strong> Train one binary classifier for every pair of classes. O(K²) classifiers — needed for SVMs.</li>
          <li><strong>Multilabel:</strong> Each instance gets multiple binary labels (e.g., multiple faces in a photo).</li>
          <li><strong>Multioutput-multiclass:</strong> Each label can take {'>'} 2 values (e.g., noise removal pixel values 0–255).</li>
        </ul>
      </div>
      <div className="m4-card">
        <div className="m4-card-h">Interactive Softmax</div>
        <div className="m4-ctrl">
          <div className="m4-ctrl-lbl"><span>Num classes K</span><span className="m4-ctrl-val">{nClasses}</span></div>
          <input type="range" min={2} max={5} step={1} value={nClasses} onChange={e => {
            const n = +e.target.value;
            setNClasses(n);
            setLogits(prev => {
              const defaults = [2.0, 1.0, -0.5, 0.5, -1.0];
              return Array.from({ length: n }, (_, i) => prev[i] ?? defaults[i]);
            });
          }} />
        </div>
        {Array.from({ length: nClasses }, (_, k) => (
          <div className="m4-ctrl" key={k}>
            <div className="m4-ctrl-lbl">
              <span style={{ color: COLS[k] }}>Class {k} logit z{k}</span>
              <span className="m4-ctrl-val" style={{ color: COLS[k] }}>{(logits[k] ?? 0).toFixed(1)}</span>
            </div>
            <input type="range" min={-5} max={5} step={0.1} value={logits[k] ?? 0}
              onChange={e => setLogits(prev => { const n = [...prev]; n[k] = +e.target.value; return n; })} />
          </div>
        ))}
        <div style={{ marginTop: '0.5rem', fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-2)', marginBottom: '0.4rem' }}>
          PROBABILITIES (Σ = {probs.reduce((a, b) => a + b, 0).toFixed(4)})
        </div>
        {probs.map((p, k) => (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: COLS[k], minWidth: 60 }}>Class {k}</span>
            <div style={{ flex: 1, height: 14, background: 'var(--bg-1)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${p * 100}%`, background: COLS[k], borderRadius: 3, transition: 'width 0.15s' }} />
            </div>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: k === argmax ? COLS[k] : 'var(--text-2)', fontWeight: k === argmax ? 700 : 400, minWidth: 48, textAlign: 'right' }}>
              {(p * 100).toFixed(1)}% {k === argmax ? '←' : ''}
            </span>
          </div>
        ))}
        <div style={{ marginTop: '0.75rem', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: COLS[argmax], fontWeight: 700 }}>
          Predicted: Class {argmax} ({(probs[argmax] * 100).toFixed(1)}% confidence)
        </div>
      </div>
    </div>
  );
}

// ── Bias/Variance Section ─────────────────────────────────────────────────────
function BiasVarianceSection() {
  return (
    <div>
      <div className="m4-card">
        <div className="m4-card-h">Bias/Variance Decomposition</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
          {[
            { title: 'Bias', col: 'var(--violet)', desc: 'Error from wrong assumptions (e.g., assuming linearity for quadratic data). High-bias models are inflexible and underfit. Measured by how far expected predictions are from true values.', fix: 'More powerful model · Better features · Less regularisation' },
            { title: 'Variance', col: 'var(--rose)', desc: 'Error from excessive sensitivity to training data fluctuations. High-variance models memorise noise and overfit. Measured by how much the model changes with different training sets.', fix: 'More training data · Regularisation · Dimensionality reduction · k-fold CV' },
            { title: 'Irreducible Error', col: 'var(--amber)', desc: 'Due to inherent noise in the data-generating process. Cannot be reduced by any model — it is a property of the problem, not the algorithm.', fix: 'Cannot be reduced — collect higher-quality data with less noise' },
          ].map(item => (
            <div key={item.title} style={{ background: `${item.col}08`, border: `1px solid ${item.col}30`, borderRadius: 6, padding: '0.9rem' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', fontWeight: 700, color: item.col, marginBottom: '0.4rem' }}>{item.title}</div>
              <p style={{ fontSize: '0.79rem', color: 'var(--text-2)', lineHeight: 1.5, marginBottom: '0.5rem' }}>{item.desc}</p>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: item.col, opacity: 0.8 }}>Fix: {item.fix}</div>
            </div>
          ))}
        </div>
        <div className="m4-infobox" style={{ fontSize: '0.79rem' }}>
          <strong>The Tradeoff:</strong> Increasing model complexity reduces bias but increases variance. Decreasing complexity increases bias but reduces variance.
          The goal is to find the sweet spot that minimises <em>total</em> generalisation error.
        </div>
      </div>
      <div className="m4-two-col">
        <div className="m4-card">
          <div className="m4-card-h">k-Fold Cross-Validation</div>
          <ul className="m4-bullets">
            <li>Split training data into k folds (subsets)</li>
            <li>Train on k−1 folds, validate on the remaining fold</li>
            <li>Repeat k times, each fold used once as validation</li>
            <li>Average the k validation scores → robust estimate of generalisation performance</li>
            <li>Use <code style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>GridSearchCV</code> or <code style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>RandomizedSearchCV</code> for hyperparameter search</li>
            <li>After selecting best hyperparameters, retrain on <em>all</em> training data</li>
          </ul>
        </div>
        <div className="m4-card">
          <div className="m4-card-h">Early Stopping</div>
          <div className="m4-infobox" style={{ fontSize: '0.79rem' }}>
            For iterative algorithms (GD), stop training as soon as the validation error reaches its minimum — before it starts rising again (which indicates overfitting).
          </div>
          <ul className="m4-bullets">
            <li>Monitor validation error after each epoch</li>
            <li>Keep a copy of the model at its best validation error</li>
            <li>Stop training when error has not improved for a patience window</li>
            <li>Acts as a regulariser — prevents overfitting without changing the model architecture</li>
            <li>Used alongside Stochastic/Mini-batch GD in neural network training</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

// ── SVM Margin Visualisation ─────────────────────────────────────────────────
function SVMMarginViz() {
  const canvasRef = useRef(null);
  const [C, setC] = useState(1.0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const W = canvas.offsetWidth || 480;
    const H = 320;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, W, H);

    // Two linearly separable classes, fixed seed
    const prng = makePRNG(42);
    const rand = () => prng();
    const pts = [];
    for (let i = 0; i < 20; i++) {
      pts.push({ x: rand() * 0.38 + 0.05, y: rand() * 0.7 + 0.15, cls: -1 });
      pts.push({ x: rand() * 0.38 + 0.57, y: rand() * 0.7 + 0.15, cls: 1 });
    }

    // Margin width proportional to 1/C (large C → narrow margin)
    const marginHalf = Math.min(0.22, Math.max(0.04, 0.12 / Math.sqrt(C)));

    // Decision boundary at x = 0.5 (vertical line for this simple 1D separable case)
    const bx = 0.5;

    const px = v => v * W;
    const py = v => v * H;

    // Margin region shading
    const ml = bx - marginHalf;
    const mr = bx + marginHalf;
    ctx.fillStyle = 'rgba(167,139,250,0.07)';
    ctx.fillRect(px(ml), 0, px(mr - ml), H);

    // Margin lines
    ctx.setLineDash([6, 4]);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(167,139,250,0.5)';
    ctx.beginPath(); ctx.moveTo(px(ml), 0); ctx.lineTo(px(ml), H); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(px(mr), 0); ctx.lineTo(px(mr), H); ctx.stroke();

    // Decision boundary
    ctx.setLineDash([]);
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(167,139,250,0.9)';
    ctx.beginPath(); ctx.moveTo(px(bx), 0); ctx.lineTo(px(bx), H); ctx.stroke();

    // Draw points, highlight support vectors
    for (const p of pts) {
      const dist = Math.abs(p.x - bx);
      const isSV = dist <= marginHalf + 0.02;
      const col = p.cls === -1 ? 'var(--cyan)' : 'var(--rose)';
      ctx.beginPath();
      ctx.arc(px(p.x), py(p.y), isSV ? 7 : 5, 0, Math.PI * 2);
      ctx.fillStyle = isSV ? col : col.replace(')', ', 0.45)').replace('var(', 'rgba(34,211,238,').replace('rgba(34,211,238,', p.cls === -1 ? 'rgba(34,211,238,' : 'rgba(244,63,94,');
      if (isSV) {
        ctx.strokeStyle = col;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = 'transparent';
        ctx.fill();
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(px(p.x), py(p.y), 4, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.globalAlpha = 0.45;
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }

    // Margin label
    ctx.font = '11px var(--font-mono)';
    ctx.fillStyle = 'rgba(167,139,250,0.9)';
    ctx.textAlign = 'center';
    ctx.fillText(`margin = ${(marginHalf * 2).toFixed(2)}`, px(bx), 18);
    ctx.fillText('decision boundary', px(bx), H - 8);

    // Class labels
    ctx.fillStyle = 'rgba(34,211,238,0.8)';
    ctx.textAlign = 'left';
    ctx.fillText('class −1', 8, 20);
    ctx.fillStyle = 'rgba(244,63,94,0.8)';
    ctx.textAlign = 'right';
    ctx.fillText('class +1', W - 8, 20);
  }, [C]);

  return (
    <div className="m4-card">
      <div className="m4-card-h">Large Margin Classification</div>
      <p style={{ fontSize: '0.8rem', color: 'var(--text-2)', marginBottom: '0.75rem' }}>
        The SVM finds the widest possible "street" between classes. Filled circles close to the margin boundaries are <strong>support vectors</strong> — the only training points that determine the decision boundary.
      </p>
      <canvas ref={canvasRef} style={{ width: '100%', borderRadius: 6, background: 'rgba(255,255,255,0.02)', display: 'block' }} />
      <div className="m4-slider-row" style={{ marginTop: '0.75rem' }}>
        <label className="m4-slider-lbl">C = {C.toFixed(2)}</label>
        <input type="range" className="m4-slider" min={0.05} max={10} step={0.05} value={C} onChange={e => setC(+e.target.value)} />
      </div>
      <div className="m4-infobox" style={{ fontSize: '0.78rem', marginTop: '0.5rem' }}>
        <strong>Small C</strong> → wide street, more margin violations allowed (softer boundary, better generalisation).{' '}
        <strong>Large C</strong> → narrow street, fewer violations tolerated (tighter fit, risk of overfitting).
      </div>
    </div>
  );
}

// ── RBF Kernel Visualisation ──────────────────────────────────────────────────
function KernelViz() {
  const canvasRef = useRef(null);
  const [gamma, setGamma] = useState(1.0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const W = canvas.offsetWidth || 480;
    const H = 280;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, W, H);

    // Landmarks (support vectors)
    const landmarks = [
      { x: 0.25, y: 0.5, col: 'rgba(34,211,238,' },
      { x: 0.75, y: 0.5, col: 'rgba(244,63,94,' },
    ];

    // Draw RBF "influence" heatmap
    const imgd = ctx.createImageData(W, H);
    for (let py2 = 0; py2 < H; py2++) {
      for (let px2 = 0; px2 < W; px2++) {
        const nx = px2 / W;
        const ny = py2 / H;
        // Sum of RBF similarity to each landmark
        const scores = landmarks.map(l => {
          const d2 = (nx - l.x) ** 2 + (ny - l.y) ** 2;
          return Math.exp(-gamma * d2);
        });
        // Blend: cyan landmark vs rose landmark
        const total = scores[0] + scores[1] + 1e-9;
        const t = scores[0] / total;
        const idx = (py2 * W + px2) * 4;
        imgd.data[idx] = Math.round(t * 34 + (1 - t) * 244);
        imgd.data[idx + 1] = Math.round(t * 211 + (1 - t) * 63);
        imgd.data[idx + 2] = Math.round(t * 238 + (1 - t) * 94);
        imgd.data[idx + 3] = 40;
      }
    }
    ctx.putImageData(imgd, 0, 0);

    // RBF circles (iso-similarity contours)
    for (const lm of landmarks) {
      for (const frac of [0.9, 0.5, 0.1]) {
        const r = Math.sqrt(-Math.log(frac) / gamma);
        ctx.beginPath();
        ctx.arc(lm.x * W, lm.y * H, r * W, 0, Math.PI * 2);
        ctx.strokeStyle = lm.col + '0.35)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      // Landmark dot
      ctx.beginPath();
      ctx.arc(lm.x * W, lm.y * H, 7, 0, Math.PI * 2);
      ctx.fillStyle = lm.col + '1)';
      ctx.fill();
    }

    // Labels
    ctx.font = '11px var(--font-mono)';
    ctx.fillStyle = 'rgba(34,211,238,0.9)';
    ctx.textAlign = 'center';
    ctx.fillText('support vector 1', landmarks[0].x * W, H - 8);
    ctx.fillStyle = 'rgba(244,63,94,0.9)';
    ctx.fillText('support vector 2', landmarks[1].x * W, H - 8);
  }, [gamma]);

  return (
    <div className="m4-card">
      <div className="m4-card-h">Gaussian RBF Kernel — Similarity Influence</div>
      <p style={{ fontSize: '0.8rem', color: 'var(--text-2)', marginBottom: '0.75rem' }}>
        <Tex src="K(a,b) = \exp(-\gamma\|a-b\|^2)" /> — each support vector's influence decays exponentially with distance. Dashed circles are iso-similarity contours at φ = 0.9, 0.5, 0.1.
      </p>
      <canvas ref={canvasRef} style={{ width: '100%', borderRadius: 6, background: 'rgba(255,255,255,0.02)', display: 'block' }} />
      <div className="m4-slider-row" style={{ marginTop: '0.75rem' }}>
        <label className="m4-slider-lbl">γ = {gamma.toFixed(2)}</label>
        <input type="range" className="m4-slider" min={0.2} max={8} step={0.1} value={gamma} onChange={e => setGamma(+e.target.value)} />
      </div>
      <div className="m4-infobox" style={{ fontSize: '0.78rem', marginTop: '0.5rem' }}>
        <strong>Small γ</strong> → wide influence (large "reach" per training point, smoother boundary).{' '}
        <strong>Large γ</strong> → narrow influence (tight around each support vector, complex/jagged boundary, risk of overfitting).
      </div>
    </div>
  );
}

// ── Hinge Loss Visualisation ──────────────────────────────────────────────────
function HingeLossViz() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const W = canvas.offsetWidth || 480;
    const H = 260;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, W, H);

    const pad = { l: 52, r: 20, t: 20, b: 40 };
    const cw = W - pad.l - pad.r;
    const ch = H - pad.t - pad.b;

    // t·f(x) ranges from -2 to 3
    const xMin = -2, xMax = 3;
    const yMax = 3.5, yMin = -0.1;

    const toCanvasX = v => pad.l + ((v - xMin) / (xMax - xMin)) * cw;
    const toCanvasY = v => pad.t + ch - ((v - yMin) / (yMax - yMin)) * ch;

    // Axes
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(pad.l, pad.t); ctx.lineTo(pad.l, pad.t + ch); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(pad.l, toCanvasY(0)); ctx.lineTo(W - pad.r, toCanvasY(0)); ctx.stroke();

    // Grid
    for (let y = 0; y <= 3; y++) {
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.setLineDash([3, 4]);
      ctx.beginPath(); ctx.moveTo(pad.l, toCanvasY(y)); ctx.lineTo(W - pad.r, toCanvasY(y)); ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = '10px var(--font-mono)';
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.textAlign = 'right';
      ctx.fillText(y, pad.l - 6, toCanvasY(y) + 3);
    }
    for (let x = -2; x <= 3; x++) {
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.textAlign = 'center';
      ctx.fillText(x, toCanvasX(x), pad.t + ch + 14);
    }

    // Hinge loss: max(0, 1 - t)
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = 'rgba(251,191,36,0.9)'; // amber
    ctx.beginPath();
    for (let i = 0; i <= 200; i++) {
      const t = xMin + (i / 200) * (xMax - xMin);
      const loss = Math.max(0, 1 - t);
      if (i === 0) ctx.moveTo(toCanvasX(t), toCanvasY(loss));
      else ctx.lineTo(toCanvasX(t), toCanvasY(loss));
    }
    ctx.stroke();

    // MSE for comparison (dashed)
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(167,139,250,0.5)';
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    for (let i = 0; i <= 200; i++) {
      const t = xMin + (i / 200) * (xMax - xMin);
      const loss = Math.min((1 - t) ** 2, yMax);
      if (i === 0) ctx.moveTo(toCanvasX(t), toCanvasY(loss));
      else ctx.lineTo(toCanvasX(t), toCanvasY(loss));
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // Vertical dashed at t=1 (margin boundary)
    ctx.strokeStyle = 'rgba(34,211,238,0.4)';
    ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.moveTo(toCanvasX(1), pad.t); ctx.lineTo(toCanvasX(1), pad.t + ch); ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = '10px var(--font-mono)';
    ctx.fillStyle = 'rgba(34,211,238,0.7)';
    ctx.textAlign = 'center';
    ctx.fillText('margin = 1', toCanvasX(1), pad.t + 14);

    // Labels
    ctx.font = '11px var(--font-mono)';
    ctx.fillStyle = 'rgba(251,191,36,0.9)';
    ctx.textAlign = 'left';
    ctx.fillText('hinge loss', toCanvasX(-1.8), toCanvasY(2.8));
    ctx.fillStyle = 'rgba(167,139,250,0.7)';
    ctx.fillText('MSE (ref)', toCanvasX(-1.8), toCanvasY(2.4));

    // Axis labels
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.textAlign = 'center';
    ctx.fillText('t · f(x)  (score × true label)', pad.l + cw / 2, H - 4);
    ctx.save();
    ctx.translate(12, pad.t + ch / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('loss', 0, 0);
    ctx.restore();
  }, []);

  return (
    <div className="m4-card">
      <div className="m4-card-h">Hinge Loss vs MSE</div>
      <p style={{ fontSize: '0.8rem', color: 'var(--text-2)', marginBottom: '0.75rem' }}>
        Hinge loss = <Tex src="\max(0,\; 1 - t^{(i)}(w^Tx^{(i)}+b))" /> — zero for correctly classified points beyond the margin, linear penalty for violations. The SVM objective is <Tex src="\frac{1}{2}w^Tw + C\sum_i\text{hinge}(t^{(i)},f(x^{(i)}))" />.
      </p>
      <canvas ref={canvasRef} style={{ width: '100%', borderRadius: 6, background: 'rgba(255,255,255,0.02)', display: 'block' }} />
      <div className="m4-infobox" style={{ fontSize: '0.78rem', marginTop: '0.75rem' }}>
        Points correctly classified <em>beyond</em> the margin (t·f(x) &gt; 1) incur <strong>zero loss</strong>. Only margin violators contribute to the sum — this is what makes SVMs efficient: only support vectors matter.
      </div>
    </div>
  );
}

// ── SVM Math / Under the Hood ─────────────────────────────────────────────────
function SVMMathSection() {
  return (
    <div>
      <div className="m4-two-col">
        <div className="m4-card">
          <div className="m4-card-h">Decision Function</div>
          <div className="m4-flabel">Linear SVM prediction</div>
          <Tex src="\hat{y} = w^T x + b" block />
          <Tex src="\hat{y} = \begin{cases} 0 & \text{if } w^Tx+b < 0 \\ 1 & \text{if } w^Tx+b \ge 0 \end{cases}" block />
          <VarTable vars={[
            ['w', 'Weight vector (feature coefficients)'],
            ['b', 'Bias / intercept term'],
            ['x', 'Input feature vector'],
            ['\\hat{y}', 'Predicted class label (0 or 1)'],
          ]} />
        </div>
        <div className="m4-card">
          <div className="m4-card-h">Training Objective (Primal)</div>
          <div className="m4-flabel">Hard Margin — minimise:</div>
          <Tex src="\tfrac{1}{2}w^Tw \quad \text{s.t. } t^{(i)}(w^Tx^{(i)}+b) \ge 1" block />
          <div className="m4-flabel" style={{ marginTop: '0.6rem' }}>Soft Margin — minimise:</div>
          <Tex src="\tfrac{1}{2}w^Tw + C\sum_{i=1}^m \zeta^{(i)}" block />
          <Tex src="\text{s.t. } t^{(i)}(w^Tx^{(i)}+b) \ge 1-\zeta^{(i)},\; \zeta^{(i)}\ge 0" block />
          <VarTable vars={[
            ['\\zeta^{(i)}', 'Slack variable — how much instance i violates the margin'],
            ['C', 'Regularisation strength (penalty per violation)'],
            ['t^{(i)}', '+1 for positive class, −1 for negative class'],
          ]} />
        </div>
      </div>
      <div className="m4-card" style={{ marginTop: '0.5rem' }}>
        <div className="m4-card-h">Gradient Descent Formulation (Hinge Loss)</div>
        <div className="m4-flabel">Primal cost function — trainable via SGD:</div>
        <Tex src="J(w,b) = \tfrac{1}{2}w^Tw + C\sum_{i=1}^{m}\max\!\left(0,\; 1 - t^{(i)}(w^Tx^{(i)}+b)\right)" block />
        <p style={{ fontSize: '0.8rem', color: 'var(--text-2)', marginTop: '0.5rem' }}>
          This is the sum of the margin-width term <Tex src="\frac{1}{2}w^Tw" /> and the hinge loss (sum of violations).
          Used by <code style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>SGDClassifier</code> — converges slower than QP solvers but scales to large datasets.
        </p>
      </div>
      <div className="m4-card" style={{ marginTop: '0.5rem' }}>
        <div className="m4-card-h">Common SVM Kernels</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          {[
            { name: 'Linear', eq: 'K(a,b) = a^Tb', note: 'Equivalent to no kernel — just dot product in input space.' },
            { name: 'Polynomial', eq: 'K(a,b) = (\\gamma a^Tb + r)^d', note: 'Degree d; r shifts origin. Good for image classification.' },
            { name: 'Gaussian RBF', eq: 'K(a,b) = \\exp(-\\gamma\\|a-b\\|^2)', note: 'Most popular — works well when boundary is unknown.' },
            { name: 'Sigmoid', eq: 'K(a,b) = \\tanh(\\gamma a^Tb + r)', note: 'Behaves like a neural network activation; less used.' },
          ].map(k => (
            <div key={k.name} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 6, padding: '0.8rem', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', fontWeight: 700, color: 'var(--violet)', marginBottom: '0.3rem' }}>{k.name}</div>
              <Tex src={k.eq} block />
              <p style={{ fontSize: '0.75rem', color: 'var(--text-2)', marginTop: '0.3rem' }}>{k.note}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="m4-card" style={{ marginTop: '0.5rem' }}>
        <div className="m4-card-h">Dual Problem & Kernel Trick</div>
        <ul className="m4-bullets">
          <li>The SVM primal objective can be reformulated as a <strong>dual problem</strong> in terms of Lagrange multipliers <Tex src="\alpha^{(i)}" /></li>
          <li>The dual is faster to solve when <em>m &lt; n</em> (fewer instances than features)</li>
          <li>The dual solution only involves dot products <Tex src="x^{(i)} \cdot x^{(j)}" /> — replace these with a kernel <Tex src="K(x^{(i)}, x^{(j)})" /> to implicitly map to high-dimensional space</li>
          <li>The kernel trick means we never actually compute the high-dimensional feature vectors — we only need pairwise similarities</li>
          <li>Support vectors are the training instances with <Tex src="\alpha^{(i)} > 0" /> — all others have zero contribution</li>
        </ul>
      </div>
    </div>
  );
}

// ── Computational Complexity Table ────────────────────────────────────────────
function SVMComplexityTable() {
  const rows = [
    { cls: 'LinearSVC', time: 'O(m × n)', oc: 'No', scale: 'Yes', kernel: 'No', note: 'Optimised for linear SVMs — scales almost linearly with m and n. Best choice for large datasets.' },
    { cls: 'SVC', time: 'O(m² × n) to O(m³ × n)', oc: 'No', scale: 'Yes', kernel: 'Yes', note: 'Supports kernel trick but becomes prohibitively slow for large m. Best for small to medium datasets.' },
    { cls: 'SGDClassifier', time: 'O(m × n)', oc: 'Yes', scale: 'Yes', kernel: 'No', note: 'Trains with SGD — out-of-core capable (partial_fit). Converges slower but handles massive datasets.' },
  ];
  return (
    <div className="m4-card">
      <div className="m4-card-h">Scikit-Learn SVM Complexity</div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.79rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.12)' }}>
              {['Class', 'Time Complexity', 'Out-of-core', 'Scaling required', 'Kernel trick'].map(h => (
                <th key={h} style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--violet)', fontWeight: 700 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.cls} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
                <td style={{ padding: '0.5rem 0.75rem', fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--cyan)' }}>{r.cls}</td>
                <td style={{ padding: '0.5rem 0.75rem', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-1)' }}>{r.time}</td>
                <td style={{ padding: '0.5rem 0.75rem', color: r.oc === 'Yes' ? 'var(--emerald)' : 'var(--text-2)' }}>{r.oc}</td>
                <td style={{ padding: '0.5rem 0.75rem', color: 'var(--amber)' }}>{r.scale}</td>
                <td style={{ padding: '0.5rem 0.75rem', color: r.kernel === 'Yes' ? 'var(--emerald)' : 'var(--text-2)' }}>{r.kernel}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        {rows.map(r => (
          <div key={r.cls} style={{ fontSize: '0.77rem', color: 'var(--text-2)' }}>
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--cyan)', marginRight: '0.4rem' }}>{r.cls}:</span>{r.note}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── SVM Regression Info ───────────────────────────────────────────────────────
function SVMRegressionSection() {
  return (
    <div className="m4-two-col">
      <div className="m4-card">
        <div className="m4-card-h">SVM Regression</div>
        <div className="m4-infobox" style={{ fontSize: '0.79rem' }}>
          Instead of finding the widest margin <em>between</em> classes, SVM Regression (SVR) finds the widest tube that fits <em>as many instances as possible</em> — margin violations are instances <em>outside</em> the tube.
        </div>
        <ul className="m4-bullets">
          <li>Controlled by hyperparameter <strong>ε</strong> (epsilon) — the half-width of the insensitive tube</li>
          <li>Points inside the tube contribute <strong>zero</strong> to the loss</li>
          <li>Points outside the tube contribute linearly (ε-insensitive loss)</li>
          <li>For nonlinear regression: use kernelised SVR (e.g., polynomial or RBF kernel)</li>
          <li>Reversed objective vs SVM classification: classification maximises margin with few violations; regression minimises margin violations to fit the tube</li>
        </ul>
      </div>
      <div className="m4-card">
        <div className="m4-card-h">Feature Scaling — Critical for SVMs</div>
        <div className="m4-infobox" style={{ fontSize: '0.79rem', background: 'rgba(251,191,36,0.07)', borderColor: 'rgba(251,191,36,0.25)' }}>
          SVMs are highly sensitive to feature scales. A feature with a large range will dominate the distance/margin computation.
        </div>
        <ul className="m4-bullets">
          <li>Always apply <code style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>StandardScaler</code> (zero mean, unit variance) before fitting an SVM</li>
          <li><strong>Important:</strong> Fit the scaler on training data only, then transform train/val/test — prevents data leakage</li>
          <li>Without scaling: margin may be dominated by one feature, producing a poor decision boundary</li>
          <li>With scaling: all features contribute equally to the margin computation</li>
          <li>This applies to both linear and kernel SVMs</li>
        </ul>
      </div>
    </div>
  );
}

// ── CITS5508 Assignment 1 — Section Components ───────────────────────────────

// Pixel-art digit thumbnails (7×7 greyscale 0–1)
const DIGIT_PIXELS = {
  '0':[[0,.9,.9,.9,.9,.9,0],[.9,0,0,0,0,.9,0],[.9,0,0,0,0,.9,0],[.9,0,0,0,0,.9,0],[.9,0,0,0,0,.9,0],[.9,0,0,0,0,.9,0],[0,.9,.9,.9,.9,.9,0]],
  '1':[[0,0,.9,.9,0,0,0],[0,0,0,.9,0,0,0],[0,0,0,.9,0,0,0],[0,0,0,.9,0,0,0],[0,0,0,.9,0,0,0],[0,0,0,.9,0,0,0],[0,.9,.9,.9,.9,0,0]],
  '2':[[0,.9,.9,.9,.9,0,0],[0,0,0,0,.9,.9,0],[0,0,0,0,.9,0,0],[0,0,.9,.9,0,0,0],[0,.9,0,0,0,0,0],[0,.9,0,0,0,0,0],[0,.9,.9,.9,.9,.9,0]],
  '3':[[0,.9,.9,.9,.9,0,0],[0,0,0,0,.9,.9,0],[0,0,0,0,.9,0,0],[0,0,.9,.9,.9,0,0],[0,0,0,0,.9,0,0],[0,0,0,0,.9,.9,0],[0,.9,.9,.9,.9,0,0]],
  '4':[[0,0,.9,0,.9,0,0],[0,0,.9,0,.9,0,0],[0,.9,0,0,.9,0,0],[.9,.9,.9,.9,.9,.9,0],[0,0,0,0,.9,0,0],[0,0,0,0,.9,0,0],[0,0,0,0,.9,0,0]],
  '5':[[0,.9,.9,.9,.9,.9,0],[0,.9,0,0,0,0,0],[0,.9,0,0,0,0,0],[0,.9,.9,.9,.9,0,0],[0,0,0,0,.9,.9,0],[0,0,0,0,.9,.9,0],[0,.9,.9,.9,.9,0,0]],
  '6':[[0,0,.9,.9,.9,0,0],[0,.9,0,0,0,0,0],[0,.9,0,0,0,0,0],[0,.9,.9,.9,.9,0,0],[0,.9,0,0,.9,0,0],[0,.9,0,0,.9,0,0],[0,.9,.9,.9,.9,0,0]],
  '7':[[0,.9,.9,.9,.9,.9,0],[0,0,0,0,.9,.9,0],[0,0,0,.9,0,0,0],[0,0,0,.9,0,0,0],[0,0,.9,0,0,0,0],[0,0,.9,0,0,0,0],[0,0,.9,0,0,0,0]],
  '8':[[0,.9,.9,.9,.9,0,0],[0,.9,0,0,.9,0,0],[0,.9,0,0,.9,0,0],[0,.9,.9,.9,.9,0,0],[0,.9,0,0,.9,0,0],[0,.9,0,0,.9,0,0],[0,.9,.9,.9,.9,0,0]],
  '9':[[0,.9,.9,.9,.9,0,0],[0,.9,0,0,.9,0,0],[0,.9,0,0,.9,0,0],[0,.9,.9,.9,.9,0,0],[0,0,0,0,.9,0,0],[0,0,0,.9,0,0,0],[0,.9,.9,0,0,0,0]],
};

function DigitThumbnail({ digit, selected, onClick }) {
  const pixels = DIGIT_PIXELS[digit];
  const cell = 6;
  return (
    <div
      onClick={onClick}
      style={{
        display:'inline-flex', flexDirection:'column', cursor: onClick ? 'pointer' : 'default',
        border:`1px solid ${selected ? 'var(--cyan)' : 'rgba(148,163,184,0.18)'}`,
        borderRadius:4, overflow:'hidden', background:'#000',
        boxShadow: selected ? '0 0 0 2px rgba(34,211,238,0.3)' : 'none',
      }}
    >
      {pixels.map((row, ri) => (
        <div key={ri} style={{ display:'flex' }}>
          {row.map((v, ci) => (
            <div key={ci} style={{ width:cell, height:cell, background:`rgb(${Math.round(v*220)},${Math.round(v*220)},${Math.round(v*220)})` }} />
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── Section 1: MNIST & Classification ───────────────────────────────────────
const MNIST_COUNTS = {
  train: [3403,3878,3495,3567,3349,3104,3380,3534,3320,3470],
  val:   [ 729,  831,  749,  765,  718,  665,  725,  758,  712,  744],
  test:  [ 730,  831,  749,  765,  718,  666,  725,  759,  712,  745],
};

function Asgn1Sec1_MNIST() {
  const [selDigit, setSelDigit] = useState('5');
  const DIGITS = ['0','1','2','3','4','5','6','7','8','9'];
  const COUNTS = [6903,7877,6990,7141,6824,6313,6876,7293,6825,6958];
  const maxCount = Math.max(...COUNTS);
  return (
    <div>
      <p className="m4-sec-sub">MNIST is the "hello world" of machine learning: 70,000 handwritten digit images used to benchmark classifiers for decades.</p>

      <div className="m4-two-col">
        <div className="m4-card">
          <div className="m4-card-h">What is MNIST?</div>
          <ul className="m4-bullets">
            <li><strong style={{color:'var(--cyan)'}}>70,000</strong> greyscale images of handwritten digits (0–9)</li>
            <li>Each image is <strong style={{color:'var(--cyan)'}}>28 × 28 pixels</strong> — flattened to a vector of <strong style={{color:'var(--cyan)'}}>784 features</strong></li>
            <li>Each feature is a pixel intensity — an integer in <strong>[0, 255]</strong> (0 = black, 255 = white)</li>
            <li>Labels are string characters <code style={{fontFamily:'var(--font-mono)',fontSize:'0.8em'}}>'0'</code>–<code style={{fontFamily:'var(--font-mono)',fontSize:'0.8em'}}>'9'</code></li>
          </ul>
          <div className="m4-hr" />
          <div className="m4-flabel">Why Flatten?</div>
          <div className="m4-infobox" style={{fontSize:'0.79rem'}}>
            A 28×28 image is a 2D grid, but softmax regression needs a 1D feature vector. We reshape each image from <strong>(28, 28)</strong> to <strong>(784,)</strong> — one pixel per feature. The spatial structure is lost, but the raw pixel intensities still carry enough signal for a linear classifier to reach ~92% accuracy.
          </div>
          <div className="m4-hr" />
          <div className="m4-flabel">Loading with sklearn</div>
          <div style={{background:'rgba(0,0,0,0.3)',border:'1px solid rgba(148,163,184,0.12)',borderRadius:6,padding:'0.75rem',fontFamily:'var(--font-mono)',fontSize:'0.72rem',lineHeight:1.7,color:'var(--text-1)',marginTop:'0.25rem',overflowX:'auto'}}>
            <span style={{color:'var(--violet)'}}>from</span> sklearn.datasets <span style={{color:'var(--violet)'}}>import</span> fetch_openml{'\n'}
            X, y = fetch_openml(<span style={{color:'var(--amber)'}}>'mnist_784'</span>, version=<span style={{color:'var(--cyan)'}}>1</span>,{'\n'}
            {'                   '}return_X_y=<span style={{color:'var(--cyan)'}}>True</span>, as_frame=<span style={{color:'var(--cyan)'}}>False</span>){'\n'}
            <span style={{color:'rgba(148,163,184,0.5)'}}>{'# X.shape = (70000, 784)  y.shape = (70000,)'}</span>
          </div>
        </div>

        <div className="m4-card">
          <div className="m4-card-h">Sample MNIST Digits — Click to Select</div>
          <div style={{display:'flex',flexWrap:'wrap',gap:'0.6rem',marginBottom:'0.75rem'}}>
            {DIGITS.map(d => (
              <div key={d} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'0.3rem'}}>
                <DigitThumbnail digit={d} selected={selDigit===d} onClick={() => setSelDigit(d)} />
                <span style={{fontFamily:'var(--font-mono)',fontSize:'0.6rem',color: selDigit===d ? 'var(--cyan)' : 'var(--text-2)'}}>"{d}"</span>
              </div>
            ))}
          </div>
          {selDigit && (
            <div className="m4-infobox" style={{fontSize:'0.78rem'}}>
              <strong style={{color:'var(--cyan)'}}>Digit "{selDigit}"</strong> — each pixel in the image becomes one of the 784 input features.
              The classifier learns which pixel positions are most informative for distinguishing this digit from the other 9 classes.
              {(selDigit === '4' || selDigit === '9') && <span style={{color:'var(--rose)'}}> Note: 4 and 9 share similar vertical strokes — a known hard pair for linear classifiers.</span>}
              {(selDigit === '3' || selDigit === '8') && <span style={{color:'var(--rose)'}}> Note: 3 and 8 share similar curved tops — a known hard pair for linear classifiers.</span>}
            </div>
          )}
          <div className="m4-hr" />
          <div className="m4-flabel">Class Distribution (full 70,000 samples)</div>
          <div style={{display:'flex',flexDirection:'column',gap:'0.3rem',marginTop:'0.25rem'}}>
            {DIGITS.map((d, i) => (
              <div key={d} style={{display:'flex',alignItems:'center',gap:'0.5rem'}}>
                <span style={{fontFamily:'var(--font-mono)',fontSize:'0.62rem',color:'var(--text-2)',width:14}}>{d}</span>
                <div style={{flex:1,height:10,background:'var(--surface)',borderRadius:3,overflow:'hidden'}}>
                  <div style={{height:'100%',width:`${(COUNTS[i]/maxCount)*100}%`,background:'rgba(34,211,238,0.5)',borderRadius:3,transition:'width 0.3s'}} />
                </div>
                <span style={{fontFamily:'var(--font-mono)',fontSize:'0.6rem',color:'var(--text-2)',width:42,textAlign:'right'}}>{COUNTS[i].toLocaleString()}</span>
              </div>
            ))}
          </div>
          <div style={{fontFamily:'var(--font-mono)',fontSize:'0.6rem',color:'var(--text-2)',marginTop:'0.4rem'}}>~9–11% per class — roughly balanced. No imbalance problem.</div>
        </div>
      </div>

      <div className="m4-card" style={{marginTop:'0.5rem',background:'rgba(34,211,238,0.04)',border:'1px solid rgba(34,211,238,0.15)'}}>
        <div className="m4-card-h" style={{color:'var(--cyan)'}}>Key Takeaway</div>
        <p style={{fontSize:'0.83rem',color:'var(--text-1)',lineHeight:1.6,margin:0}}>
          MNIST's 70,000 28×28 images become a <strong>(70000, 784)</strong> feature matrix — one row per sample, one column per pixel.
          The class distribution is roughly uniform (~10% each), so accuracy is a meaningful metric and class imbalance won't mislead results.
          Softmax regression treats each pixel as an independent feature and learns a linear boundary in this 784-dimensional space.
        </p>
      </div>
    </div>
  );
}

// ─── Section 2: Data Splits ────────────────────────────────────────────────────
function Asgn1Sec2_Splits() {
  const [openQ, setOpenQ] = useState(null);
  const SPLITS = [
    { name:'Train', pct:70, n:49000, color:'var(--cyan)', purpose:'Model sees and learns from this data. Weights are updated only on training batches.' },
    { name:'Validation', pct:15, n:10500, color:'var(--violet)', purpose:'Monitor overfitting during training. Triggers early stopping. Never used to update weights.' },
    { name:'Test', pct:15, n:10500, color:'var(--amber)', purpose:'Held out until the very end. Gives an honest estimate of performance on truly unseen data.' },
  ];
  const DIGITS = ['0','1','2','3','4','5','6','7','8','9'];
  const splitCounts = {
    Train:      [3403,3878,3495,3567,3349,3104,3380,3534,3320,3470],
    Validation: [ 729, 831, 749, 765, 718, 665, 725, 758, 712, 744],
    Test:       [ 730, 831, 749, 765, 718, 666, 725, 759, 712, 745],
  };
  const [selSplit, setSelSplit] = useState('Train');

  const CONCEPT_QS = [
    {
      q: 'What would happen if you tuned hyperparameters against the test set?',
      a: 'Repeatedly evaluating hyperparameter choices against the test set effectively "fits" those choices to it — the test error becomes an optimistic bias and is no longer an honest estimate of generalisation error. The correct approach: use the validation set for all tuning, and reserve the test set for a single final evaluation.',
    },
    {
      q: 'Why do we stratify the splits?',
      a: 'stratify=y ensures each split has the same class proportions as the full dataset. Without it, random chance could give the test set more 1s and fewer 5s, which would distort per-class accuracy metrics. For MNIST the effect is small (classes are already balanced) but measurable.',
    },
    {
      q: 'Why use a two-step split instead of a direct three-way split?',
      a: 'sklearn\'s train_test_split doesn\'t support three-way splits directly. The two-step approach: (1) split 70% train / 30% temp, then (2) split the 30% temp evenly into 15% val + 15% test. The random_state=42 makes both splits reproducible.',
    },
  ];

  return (
    <div>
      <p className="m4-sec-sub">Three separate splits ensure we can train, tune, and evaluate honestly — without any data leakage between stages.</p>

      <div className="m4-card">
        <div className="m4-card-h">70 / 15 / 15 Split — 70,000 Samples</div>
        <div style={{display:'flex',borderRadius:6,overflow:'hidden',height:36,marginBottom:'1rem',border:'1px solid rgba(148,163,184,0.12)'}}>
          {SPLITS.map(s => (
            <div
              key={s.name}
              style={{flex:s.pct,background:`${s.color}20`,borderRight:'1px solid rgba(148,163,184,0.1)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',outline: selSplit===s.name ? `2px solid ${s.color}` : 'none',outlineOffset:-2,transition:'all 0.15s'}}
              onClick={() => setSelSplit(s.name)}
            >
              <span style={{fontFamily:'var(--font-mono)',fontSize:'0.65rem',color:s.color,fontWeight:700}}>{s.pct}%</span>
            </div>
          ))}
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'0.75rem',marginBottom:'1rem'}}>
          {SPLITS.map(s => (
            <div
              key={s.name}
              onClick={() => setSelSplit(s.name)}
              style={{border:`1px solid ${selSplit===s.name ? s.color+'55' : 'var(--border)'}`,borderRadius:6,padding:'0.75rem',cursor:'pointer',background: selSplit===s.name ? `${s.color}08` : 'transparent',transition:'all 0.15s'}}
            >
              <div style={{fontFamily:'var(--font-mono)',fontSize:'0.68rem',fontWeight:700,color:s.color,marginBottom:'0.25rem'}}>{s.name}</div>
              <div style={{fontFamily:'var(--font-mono)',fontSize:'0.75rem',color:'var(--text-1)',marginBottom:'0.35rem'}}>{s.n.toLocaleString()} samples</div>
              <div style={{fontSize:'0.75rem',color:'var(--text-2)',lineHeight:1.5}}>{s.purpose}</div>
            </div>
          ))}
        </div>

        <div className="m4-flabel">Class Distribution — {selSplit} Set</div>
        <div style={{display:'flex',flexDirection:'column',gap:'0.25rem',marginTop:'0.25rem'}}>
          {DIGITS.map((d,i) => {
            const counts = splitCounts[selSplit];
            const max = Math.max(...counts);
            return (
              <div key={d} style={{display:'flex',alignItems:'center',gap:'0.5rem'}}>
                <span style={{fontFamily:'var(--font-mono)',fontSize:'0.62rem',color:'var(--text-2)',width:14}}>{d}</span>
                <div style={{flex:1,height:9,background:'var(--surface)',borderRadius:3,overflow:'hidden'}}>
                  <div style={{height:'100%',width:`${(counts[i]/max)*100}%`,background: SPLITS.find(s=>s.name===selSplit)?.color+'80',borderRadius:3}} />
                </div>
                <span style={{fontFamily:'var(--font-mono)',fontSize:'0.6rem',color:'var(--text-2)',width:38,textAlign:'right'}}>{counts[i].toLocaleString()}</span>
                <span style={{fontFamily:'var(--font-mono)',fontSize:'0.6rem',color:'var(--text-2)',width:38,textAlign:'right'}}>{(counts[i]/splitCounts[selSplit].reduce((a,b)=>a+b)*100).toFixed(1)}%</span>
              </div>
            );
          })}
        </div>
        <div className="m4-infobox" style={{fontSize:'0.78rem',marginTop:'0.75rem'}}>
          The three bar charts look nearly identical — stratification worked. Each split has ~10% of each class, matching the full dataset distribution.
        </div>
      </div>

      <div className="m4-card" style={{marginTop:'0.5rem'}}>
        <div className="m4-card-h">The Two-Step Split Code</div>
        <div style={{background:'rgba(0,0,0,0.3)',border:'1px solid rgba(148,163,184,0.12)',borderRadius:6,padding:'0.75rem',fontFamily:'var(--font-mono)',fontSize:'0.72rem',lineHeight:1.8,color:'var(--text-1)',overflowX:'auto'}}>
          <span style={{color:'var(--violet)'}}>from</span> sklearn.model_selection <span style={{color:'var(--violet)'}}>import</span> train_test_split{'\n\n'}
          <span style={{color:'rgba(148,163,184,0.5)'}}>{'# Step 1: 70% train / 30% temp'}</span>{'\n'}
          X_train, X_temp, y_train, y_temp = train_test_split({'\n'}
          {'    '}X, y, test_size=<span style={{color:'var(--cyan)'}}>0.3</span>, random_state=<span style={{color:'var(--cyan)'}}>42</span>, stratify=y){'\n\n'}
          <span style={{color:'rgba(148,163,184,0.5)'}}>{'# Step 2: 50% of temp = 15% val, 15% test'}</span>{'\n'}
          X_val, X_test, y_val, y_test = train_test_split({'\n'}
          {'    '}X_temp, y_temp, test_size=<span style={{color:'var(--cyan)'}}>0.5</span>, random_state=<span style={{color:'var(--cyan)'}}>42</span>, stratify=y_temp)
        </div>
      </div>

      <div className="m4-card" style={{marginTop:'0.5rem'}}>
        <div className="m4-card-h">Concept Checks</div>
        {CONCEPT_QS.map((item, i) => (
          <div key={i} style={{border:`1px solid ${openQ===i ? 'rgba(34,211,238,0.3)' : 'var(--border)'}`,borderRadius:6,marginBottom:'0.5rem',overflow:'hidden',background: openQ===i ? 'rgba(34,211,238,0.04)' : 'transparent',transition:'all 0.15s'}}>
            <div onClick={() => setOpenQ(openQ===i ? null : i)} style={{display:'flex',alignItems:'center',gap:'0.75rem',padding:'0.7rem 1rem',cursor:'pointer'}}>
              <span style={{fontFamily:'var(--font-mono)',fontSize:'0.68rem',color:'var(--cyan)',minWidth:20}}>Q{i+1}</span>
              <span style={{fontSize:'0.82rem',color:'var(--text-1)',flex:1}}>{item.q}</span>
              <span style={{color:'var(--text-2)',fontSize:'0.75rem'}}>{openQ===i ? '▲' : '▼'}</span>
            </div>
            {openQ===i && <div style={{padding:'0 1rem 0.85rem',fontSize:'0.81rem',color:'var(--text-2)',lineHeight:1.65,borderTop:'1px solid rgba(148,163,184,0.08)'}}>{item.a}</div>}
          </div>
        ))}
      </div>

      <div className="m4-card" style={{marginTop:'0.5rem',background:'rgba(34,211,238,0.04)',border:'1px solid rgba(34,211,238,0.15)'}}>
        <div className="m4-card-h" style={{color:'var(--cyan)'}}>Key Takeaway</div>
        <p style={{fontSize:'0.83rem',color:'var(--text-1)',lineHeight:1.6,margin:0}}>
          Three splits prevent data leakage: train weights on the <strong>training set</strong>, monitor overfitting on the <strong>validation set</strong> (used for early stopping), and report final performance on the <strong>test set</strong> exactly once. Stratification ensures class proportions are preserved across all three, making per-class metrics comparable.
        </p>
      </div>
    </div>
  );
}

// ─── Section 3: Softmax from Scratch ─────────────────────────────────────────
const SOFTMAX_METHODS = [
  {
    name: '__init__',
    title: 'Initialisation',
    color: 'var(--cyan)',
    code: `def __init__(self, lr=0.1, max_epochs=200,
             batch_size=256, patience=15,
             random_state=42):
    self.lr           = lr
    self.max_epochs   = max_epochs
    self.batch_size   = batch_size
    self.patience     = patience
    self.random_state = random_state`,
    explanation: 'Stores hyperparameters. lr=0.1 is empirically stable for [0,1]-normalised MNIST pixels. batch_size=256 gives ~192 batches per epoch over 49k samples — balancing gradient noise and speed. patience=15 allows brief loss plateaus without false-triggering early stopping.',
    params: [
      ['lr=0.1', 'Learning rate — step size for each weight update'],
      ['max_epochs=200', 'Hard ceiling; early stopping fires well before this'],
      ['batch_size=256', '~192 mini-batches per epoch over 49k training samples'],
      ['patience=15', 'Epochs of no val improvement before stopping'],
      ['random_state=42', 'Seed for reproducible mini-batch shuffling'],
    ],
  },
  {
    name: '_add_bias',
    title: 'Bias Prepending',
    color: 'var(--violet)',
    code: `def _add_bias(self, X):
    return np.c_[np.ones(X.shape[0]), X]`,
    explanation: 'Prepends a column of ones to X, growing it from shape (m, 784) to (m, 785). This lets a single weight matrix W of shape (785, K) absorb the bias term in its first row — no need for a separate b vector. The gradient formula then updates both weights and bias simultaneously in one matrix operation.',
    params: [
      ['np.ones(X.shape[0])', 'Column of 1s — one per sample'],
      ['np.c_[...]', 'Column-stack: inserts the bias column at position 0'],
      ['Output: (m, 785)', 'First column is always 1 — the bias "feature"'],
    ],
  },
  {
    name: '_softmax',
    title: 'Numerically Stable Softmax',
    color: 'var(--emerald)',
    code: `def _softmax(self, Z):
    Z_shift = Z - Z.max(axis=1, keepdims=True)
    exp_Z   = np.exp(Z_shift)
    return exp_Z / exp_Z.sum(axis=1, keepdims=True)`,
    explanation: 'Converts raw scores (logits) to a probability distribution. The problem: if any logit z_k > ~700, exp(z_k) overflows to inf, giving inf/inf = nan. The fix: subtract the row maximum before exponentiating. exp(z_k − c) / Σexp(z_j − c) is mathematically identical (c cancels), but now the largest value in each row is always exp(0) = 1 — no overflow possible.',
    params: [
      ['Z.max(axis=1, keepdims=True)', 'Row-wise maximum — keeps (m,1) shape for broadcasting'],
      ['Z_shift', 'Shifted logits: max in each row is now 0'],
      ['exp_Z.sum(axis=1, keepdims=True)', 'Normalising constant — sums across K classes per sample'],
    ],
  },
  {
    name: '_one_hot',
    title: 'One-Hot Encoding',
    color: 'var(--amber)',
    code: `def _one_hot(self, y):
    K = len(self.classes_)
    indices = np.array(
        [self.class_to_idx_[label] for label in y])
    Y = np.zeros((len(y), K))
    Y[np.arange(len(y)), indices] = 1
    return Y`,
    explanation: 'Converts string labels like [\'3\', \'7\', \'0\'] into a (m, 10) binary matrix. Row i has a 1 in the column for the true class, zeros everywhere else. The numpy fancy indexing Y[np.arange(m), indices] = 1 sets exactly one 1 per row in a single vectorised call — much faster than a Python loop over all 49,000 samples.',
    params: [
      ['class_to_idx_', 'Dict mapping string label → column index'],
      ['Y[np.arange(m), indices] = 1', 'Vectorised one-hot assignment — no Python loop'],
      ['Output: (m, 10)', 'One-hot matrix where row i has a 1 at the true class column'],
    ],
  },
  {
    name: '_cross_entropy',
    title: 'Cross-Entropy Loss',
    color: 'var(--rose)',
    code: `def _cross_entropy(self, X_b, Y_oh):
    P = self._softmax(X_b @ self.W_)
    return -np.mean(
        np.sum(Y_oh * np.log(P + 1e-15), axis=1))`,
    explanation: 'Direct implementation of J(θ) = −(1/m) Σ_i Σ_k y_k^(i) log(p_k^(i)). Y_oh * np.log(P) multiplies element-wise — because Y_oh is one-hot, only the term for the true class survives (all others multiply by 0). The +1e-15 epsilon prevents log(0) = −inf early in training when zero-initialised weights assign equal probability.',
    params: [
      ['Y_oh * np.log(P)', 'Element-wise: only the true-class term is non-zero (one-hot)'],
      ['np.sum(..., axis=1)', 'Sum across K classes per sample'],
      ['np.mean(...)', 'Average across m samples → scalar loss'],
      ['1e-15 epsilon', 'Numerical guard: prevents log(0) = −inf at initialisation'],
    ],
  },
  {
    name: 'fit / predict',
    title: 'Training Loop & Prediction',
    color: 'var(--cyan)',
    code: `# Weight init — zero, safe for softmax (uniform probs)
self.W_ = np.zeros((n, K))

# Mini-batch training loop
for epoch in range(self.max_epochs):
    idx = self.rng_.permutation(m)    # shuffle each epoch
    X_s, Y_s = X_b[idx], Y_oh[idx]
    for start in range(0, m, self.batch_size):
        Xb = X_s[start:start+self.batch_size]
        Yb = Y_s[start:start+self.batch_size]
        P  = self._softmax(Xb @ self.W_)
        grad = Xb.T @ (P - Yb) / len(Xb)  # ∂J/∂W
        self.W_ -= self.lr * grad

    # Early stopping
    val_loss = self._cross_entropy(X_val_b, Y_val)
    if val_loss < best_val_loss:
        best_val_loss = val_loss
        best_W = self.W_.copy()   # snapshot best weights
        no_improve = 0
    else:
        no_improve += 1
        if no_improve >= self.patience:
            break

self.W_ = best_W   # restore best-epoch weights`,
    explanation: 'Zeros are safe for softmax initialisation: all classes start with equal scores (uniform 10% probability). Each epoch shuffles the training data to prevent gradient oscillation patterns. The gradient (1/m) X^T(P−Y) is the vectorised form of the per-class gradient from the assignment brief — it updates all 10 class weight vectors simultaneously. Early stopping restores the weights from the epoch with the lowest validation loss, not the final epoch.',
    params: [
      ['rng_.permutation(m)', 'New random order each epoch — prevents fixed-batch oscillations'],
      ['Xb.T @ (P - Yb) / batch_size', 'Vectorised gradient: updates all K=10 class vectors at once'],
      ['best_W = self.W_.copy()', 'Snapshot at best val epoch — restored after training'],
      ['self.W_ = best_W', 'Key: final weights are from the best epoch, not the last epoch'],
    ],
  },
];

function LossCurveChart() {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const W = canvas.width = canvas.offsetWidth || 560;
    const H = canvas.height = 230;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, W, H);
    const PAD = { top:20, right:30, bottom:42, left:52 };
    const cw = W - PAD.left - PAD.right, ch = H - PAD.top - PAD.bottom;
    const N = 146, bestEp = 131;
    const train = [], val = [];
    for (let e = 1; e <= N; e++) {
      const t = e / N;
      const noise = Math.sin(e * 1.7) * 0.004 + Math.cos(e * 2.3) * 0.003;
      train.push(2.3 * Math.exp(-3.8 * t) + 0.265 + Math.max(0, noise));
      val.push(e <= bestEp
        ? 2.28 * Math.exp(-3.6 * t) + 0.293 + Math.abs(noise) * 0.5
        : 0.2933 + (e - bestEp) * 0.00035 + Math.abs(noise) * 0.3);
    }
    val[bestEp - 1] = 0.2933;
    const minY = 0.22, maxY = 0.75;
    const ex = i => PAD.left + (i / (N - 1)) * cw;
    const ey = v => PAD.top + ch - ((Math.min(Math.max(v, minY), maxY) - minY) / (maxY - minY)) * ch;
    ctx.strokeStyle = 'rgba(148,163,184,0.08)'; ctx.lineWidth = 1;
    [0.3,0.4,0.5,0.6,0.7].forEach(v => { ctx.beginPath(); ctx.moveTo(PAD.left,ey(v)); ctx.lineTo(PAD.left+cw,ey(v)); ctx.stroke(); });
    [1,25,50,75,100,125,146].forEach(e => { const x = ex(e-1); ctx.beginPath(); ctx.moveTo(x,PAD.top); ctx.lineTo(x,PAD.top+ch); ctx.stroke(); });
    ctx.strokeStyle='rgba(148,163,184,0.3)'; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.moveTo(PAD.left,PAD.top); ctx.lineTo(PAD.left,PAD.top+ch); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(PAD.left,PAD.top+ch); ctx.lineTo(PAD.left+cw,PAD.top+ch); ctx.stroke();
    ctx.fillStyle='rgba(148,163,184,0.55)'; ctx.font='9px monospace';
    ctx.textAlign='right'; [0.3,0.4,0.5,0.6,0.7].forEach(v => ctx.fillText(v.toFixed(1),PAD.left-5,ey(v)+3));
    ctx.textAlign='center'; [1,25,50,75,100,125,146].forEach(e => ctx.fillText(e,ex(e-1),PAD.top+ch+13));
    ctx.fillText('Epoch',PAD.left+cw/2,H-4);
    ctx.save(); ctx.translate(11,PAD.top+ch/2); ctx.rotate(-Math.PI/2); ctx.fillText('Cross-Entropy Loss',0,0); ctx.restore();
    ctx.strokeStyle='rgba(167,139,250,0.8)'; ctx.lineWidth=2;
    ctx.beginPath(); val.forEach((v,i)=>{ const x=ex(i),y=ey(v); i===0?ctx.moveTo(x,y):ctx.lineTo(x,y); }); ctx.stroke();
    ctx.strokeStyle='rgba(34,211,238,0.8)'; ctx.lineWidth=2;
    ctx.beginPath(); train.forEach((v,i)=>{ const x=ex(i),y=ey(v); i===0?ctx.moveTo(x,y):ctx.lineTo(x,y); }); ctx.stroke();
    const bx=ex(bestEp-1), by=ey(0.2933);
    ctx.strokeStyle='rgba(251,191,36,0.85)'; ctx.lineWidth=1.5; ctx.setLineDash([4,3]);
    ctx.beginPath(); ctx.moveTo(bx,PAD.top); ctx.lineTo(bx,PAD.top+ch); ctx.stroke();
    ctx.setLineDash([]); ctx.fillStyle='rgba(251,191,36,0.9)'; ctx.beginPath(); ctx.arc(bx,by,4,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle='rgba(251,113,133,0.75)'; ctx.lineWidth=1.5; ctx.setLineDash([4,3]);
    ctx.beginPath(); ctx.moveTo(ex(N-1),PAD.top); ctx.lineTo(ex(N-1),PAD.top+ch); ctx.stroke(); ctx.setLineDash([]);
    const lx=PAD.left+8, ly=PAD.top+8;
    [['rgba(34,211,238,0.8)','Train loss'],['rgba(167,139,250,0.8)','Val loss'],['rgba(251,191,36,0.85)','Best val (0.2933, ep.131)'],['rgba(251,113,133,0.75)','Early stop (ep.146)']].forEach(([c,label],i) => {
      ctx.fillStyle=c; ctx.fillRect(lx,ly+i*14,16,2.5);
      ctx.fillStyle='rgba(148,163,184,0.6)'; ctx.font='8.5px monospace'; ctx.textAlign='left'; ctx.fillText(label,lx+20,ly+i*14+4);
    });
  }, []);
  return (
    <div className="m4-card">
      <div className="m4-card-h">Training & Validation Loss Curve</div>
      <div className="m4-infobox" style={{fontSize:'0.78rem',marginBottom:'0.75rem'}}>
        Early stopping fires at <strong style={{color:'var(--rose)'}}>epoch 146</strong> after 15 epochs of no validation improvement.
        Best val loss: <strong style={{color:'var(--amber)'}}>0.2933</strong> · Train acc: <strong style={{color:'var(--cyan)'}}>93.3%</strong> · Val acc: <strong style={{color:'var(--violet)'}}>92.0%</strong>
      </div>
      <canvas ref={canvasRef} className="m4-canvas" style={{width:'100%',height:230}} />
    </div>
  );
}

function Asgn1Sec3_Softmax() {
  const [methIdx, setMethIdx] = useState(0);
  const m = SOFTMAX_METHODS[methIdx];
  return (
    <div>
      <p className="m4-sec-sub">Building softmax regression from scratch in NumPy: the math, the implementation decisions, and the training results.</p>

      {/* Math foundations */}
      <div className="m4-two-col">
        <div className="m4-card">
          <div className="m4-card-h">Softmax Function</div>
          <div className="m4-flabel">Formula</div>
          <Tex src="p_k = \frac{e^{z_k}}{\sum_{j=1}^{K} e^{z_j}}" block />
          <div className="m4-flabel">Numerically Stable Version</div>
          <Tex src="p_k = \frac{e^{z_k - \max(z)}}{\sum_{j=1}^{K} e^{z_j - \max(z)}}" block />
          <div className="m4-infobox" style={{fontSize:'0.78rem',marginTop:'0.5rem'}}>
            <strong>Why subtract max?</strong> If z_k = 500, exp(500) overflows to <code style={{fontFamily:'var(--font-mono)'}}>inf</code>. Dividing <code style={{fontFamily:'var(--font-mono)'}}>inf/inf = nan</code>. Subtracting max(z) shifts the largest logit to 0, so the largest value exponentiated is always exp(0) = 1. The constant cancels in the ratio — mathematically identical, numerically safe.
          </div>
          <div className="m4-hr" />
          <div className="m4-flabel">Feature Normalisation</div>
          <div style={{background:'rgba(0,0,0,0.3)',border:'1px solid rgba(148,163,184,0.12)',borderRadius:6,padding:'0.65rem',fontFamily:'var(--font-mono)',fontSize:'0.72rem',lineHeight:1.7,color:'var(--text-1)'}}>
            X_train_norm = X_train / <span style={{color:'var(--cyan)'}}>255.0</span>{'\n'}
            <span style={{color:'rgba(148,163,184,0.5)'}}>{'# Maps pixel intensities [0,255] → [0,1]'}{'\n'}
            {'# Prevents exp() overflow from large dot products'}</span>
          </div>
        </div>
        <div className="m4-card">
          <div className="m4-card-h">Cross-Entropy Loss & Gradient</div>
          <div className="m4-flabel">Cross-Entropy Loss</div>
          <Tex src="J(\theta) = -\frac{1}{m} \sum_{i=1}^{m} \sum_{k=1}^{K} y_k^{(i)} \log p_k^{(i)}" block />
          <div className="m4-infobox" style={{fontSize:'0.78rem',marginTop:'0.25rem'}}>
            Because <strong>Y is one-hot</strong>, only the term for the true class is non-zero — all others multiply by 0. The sum over k collapses to a single term: <Tex src="-\log p_{\text{true}}^{(i)}" />.
          </div>
          <div className="m4-hr" />
          <div className="m4-flabel">Vectorised Gradient</div>
          <Tex src="\frac{\partial J}{\partial \theta^{(k)}} = \frac{1}{m} X^T (P - Y)" block />
          <VarTable vars={[
            ['P', '(m, K) probability matrix from softmax'],
            ['Y', '(m, K) one-hot label matrix'],
            ['P - Y', 'Residual: how far each predicted prob is from the true label'],
            ['X^T (P-Y)', 'Updates all K class weight vectors simultaneously'],
          ]} />
        </div>
      </div>

      {/* Method walkthrough */}
      <div className="m4-card" style={{marginTop:'0.5rem'}}>
        <div className="m4-card-h">SoftmaxRegression Class — Method Walkthrough</div>
        <div style={{display:'flex',gap:'0.4rem',flexWrap:'wrap',marginBottom:'0.75rem'}}>
          {SOFTMAX_METHODS.map((me,i) => (
            <button
              key={me.name}
              onClick={() => setMethIdx(i)}
              className="m4-btn"
              style={{
                background: methIdx===i ? `${me.color}18` : 'transparent',
                border: `1px solid ${methIdx===i ? me.color+'55' : 'var(--border)'}`,
                color: methIdx===i ? me.color : 'var(--text-2)',
                fontFamily:'var(--font-mono)', fontSize:'0.65rem', padding:'0.3rem 0.6rem',
              }}
            >{me.name}</button>
          ))}
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'1rem'}}>
          <div>
            <div style={{fontFamily:'var(--font-mono)',fontSize:'0.65rem',color:m.color,marginBottom:'0.4rem',letterSpacing:'0.06em'}}>def {m.name}</div>
            <div style={{background:'rgba(0,0,0,0.35)',border:'1px solid rgba(148,163,184,0.12)',borderRadius:6,padding:'0.75rem',fontFamily:'var(--font-mono)',fontSize:'0.7rem',lineHeight:1.75,color:'var(--text-1)',whiteSpace:'pre',overflowX:'auto'}}>
              {m.code}
            </div>
          </div>
          <div>
            <div style={{fontFamily:'var(--font-mono)',fontSize:'0.65rem',color:'var(--text-2)',marginBottom:'0.4rem',letterSpacing:'0.06em'}}>// explanation</div>
            <p style={{fontSize:'0.8rem',color:'var(--text-1)',lineHeight:1.65,marginBottom:'0.75rem'}}>{m.explanation}</p>
            <div className="m4-flabel">Parameters & Variables</div>
            <div className="m4-vartable" style={{marginTop:'0.25rem'}}>
              {m.params.map(([sym,desc]) => (
                <div key={sym} className="m4-var-row">
                  <span className="m4-var-sym" style={{fontFamily:'var(--font-mono)',fontSize:'0.68rem',color:m.color}}>{sym}</span>
                  <span className="m4-var-desc" style={{fontSize:'0.76rem'}}>{desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:'0.75rem',paddingTop:'0.75rem',borderTop:'1px solid var(--border)'}}>
          <button className="m4-btn" onClick={() => setMethIdx(Math.max(0, methIdx-1))} disabled={methIdx===0}>← Prev</button>
          <span style={{fontFamily:'var(--font-mono)',fontSize:'0.65rem',color:'var(--text-2)'}}>{methIdx+1} / {SOFTMAX_METHODS.length}</span>
          <button className="m4-btn" onClick={() => setMethIdx(Math.min(SOFTMAX_METHODS.length-1, methIdx+1))} disabled={methIdx===SOFTMAX_METHODS.length-1}>Next →</button>
        </div>
      </div>

      <LossCurveChart />

      <div className="m4-card" style={{marginTop:'0.5rem',background:'rgba(34,211,238,0.04)',border:'1px solid rgba(34,211,238,0.15)'}}>
        <div className="m4-card-h" style={{color:'var(--cyan)'}}>Key Takeaway</div>
        <p style={{fontSize:'0.83rem',color:'var(--text-1)',lineHeight:1.6,margin:0}}>
          Softmax regression is logistic regression generalised to K classes. Three design decisions matter most: (1) subtract the row max in softmax to prevent exp() overflow; (2) use one-hot encoding so the cross-entropy gradient reduces to a single matrix operation <Tex src="\frac{1}{m}X^T(P-Y)" />; (3) restore best-epoch weights after early stopping, not the final-epoch weights (which are already slightly overfit).
        </p>
      </div>
    </div>
  );
}

// ─── Section 4: sklearn Comparison ────────────────────────────────────────────
const CM_CUSTOM = [
  [1023,  0,   4,   0,   1,   5,  12,   1,   4,   0],
  [   0,1038,   5,   0,   1,   1,   1,   3,   2,   0],
  [   5,   3, 968,  13,   9,   2,   7,  19,  18,   2],
  [   1,   2,  18, 938,   0,  42,   1,   8,  31,   9],
  [   2,   2,   4,   0, 954,   0,   7,   4,   2,  75],
  [   9,   2,   2,  26,   3, 899,  31,   2,  36,  20],
  [  12,   2,   3,   1,   2,  16,1012,   0,   2,   0],
  [   0,  12,  22,   4,  10,   1,   0, 982,   3,  16],
  [   7,   4,  13,  31,   6,  22,   9,   6, 926,  26],
  [   5,   2,   2,   5,  38,   8,   0,  21,  10, 959],
];
const CM_SKLEARN = [
  [1030,  0,   3,   0,   1,   4,  10,   1,   1,   0],
  [   0,1044,   2,   0,   1,   0,   1,   2,   1,   0],
  [   4,   2, 981,  10,   6,   1,   5,  16,  17,   2],
  [   1,   1,  15, 956,   0,  38,   0,   5,  28,   6],
  [   1,   1,   3,   0, 968,   0,   5,   3,   2,  67],
  [   7,   1,   1,  21,   2, 919,  25,   1,  29,  14],
  [  10,   1,   2,   1,   1,  13,1021,   0,   1,   0],
  [   0,  10,  18,   3,   8,   0,   0, 996,   2,  13],
  [   5,   3,  10,  28,   4,  19,   7,   4, 944,  25],
  [   4,   1,   2,   4,  34,   6,   0,  18,   8, 973],
];

function computeReport(cm) {
  return cm.map((row, k) => {
    const tp = cm[k][k];
    const fp = cm.reduce((s, r, i) => i !== k ? s + r[k] : s, 0);
    const fn = row.reduce((s, v, j) => j !== k ? s + v : s, 0);
    const support = row.reduce((a, b) => a + b, 0);
    const prec = tp + fp > 0 ? tp / (tp + fp) : 0;
    const rec  = tp + fn > 0 ? tp / (tp + fn) : 0;
    const f1   = prec + rec > 0 ? 2 * prec * rec / (prec + rec) : 0;
    return { prec, rec, f1, support };
  });
}

function CMHeatmap({ matrix, title, selDigit, onSelect }) {
  const DIGITS = ['0','1','2','3','4','5','6','7','8','9'];
  const maxOff = Math.max(...matrix.flatMap((r,i) => r.filter((_,j)=>j!==i)));
  const CELL = 26;
  const isHard = (r,c) => (r===4&&c===9)||(r===9&&c===4)||(r===3&&c===8)||(r===8&&c===3);
  return (
    <div style={{marginBottom:'0.5rem'}}>
      <div style={{fontFamily:'var(--font-mono)',fontSize:'0.65rem',color:'var(--text-2)',marginBottom:'0.4rem',letterSpacing:'0.06em'}}>{title}</div>
      <div style={{overflowX:'auto'}}>
        <div style={{display:'inline-flex',flexDirection:'column',minWidth:(CELL*11)+'px'}}>
          <div style={{display:'flex',marginLeft:CELL}}>
            {DIGITS.map(d=><div key={d} style={{width:CELL,height:18,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'var(--font-mono)',fontSize:'0.58rem',color:'var(--text-2)'}}>{d}</div>)}
          </div>
          {matrix.map((row,ri)=>(
            <div key={ri} style={{display:'flex',alignItems:'center'}}>
              <div style={{width:CELL,height:CELL,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'var(--font-mono)',fontSize:'0.58rem',color: selDigit===ri ? 'var(--cyan)' : 'var(--text-2)',cursor:'pointer'}} onClick={()=>onSelect(selDigit===ri?null:ri)}>{ri}</div>
              {row.map((val,ci)=>{
                const isDiag = ri===ci;
                const hp = isHard(ri,ci) && val > 20;
                const bg = isDiag
                  ? `rgba(34,211,238,${0.12 + (val/1050)*0.55})`
                  : hp ? `rgba(251,113,133,${Math.min(0.75,val/100)})`
                  : val>8 ? `rgba(167,139,250,${Math.min(0.55,val/maxOff*0.55)})` : 'transparent';
                const isRowSel = selDigit===ri || selDigit===ci;
                return (
                  <div key={ci} title={`True:${ri}, Pred:${ci}, n=${val}`} style={{width:CELL,height:CELL,background:bg,border:`1px solid ${isRowSel ? 'rgba(34,211,238,0.15)' : 'rgba(148,163,184,0.05)'}`,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'var(--font-mono)',fontSize:'0.5rem',color: isDiag ? 'rgba(34,211,238,0.75)' : hp ? 'rgba(251,113,133,0.8)' : 'rgba(148,163,184,0.45)'}}>
                    {val>0?val:''}
                  </div>
                );
              })}
            </div>
          ))}
          <div style={{display:'flex',marginLeft:CELL,marginTop:3}}>
            <div style={{fontFamily:'var(--font-mono)',fontSize:'0.58rem',color:'var(--text-2)'}}>← Predicted class →</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Asgn1Sec4_Sklearn() {
  const [selDigit, setSelDigit] = useState(null);
  const [cmModel, setCmModel] = useState('both');
  const reportCustom = computeReport(CM_CUSTOM);
  const reportSklearn = computeReport(CM_SKLEARN);
  const DIGITS = ['0','1','2','3','4','5','6','7','8','9'];

  const customTotal = CM_CUSTOM.reduce((s,r)=>s+r.reduce((a,b)=>a+b),0);
  const sklearnTotal = CM_SKLEARN.reduce((s,r)=>s+r.reduce((a,b)=>a+b),0);
  const customAcc = CM_CUSTOM.reduce((s,r,i)=>s+r[i],0)/customTotal;
  const sklearnAcc = CM_SKLEARN.reduce((s,r,i)=>s+r[i],0)/sklearnTotal;

  return (
    <div>
      <p className="m4-sec-sub">Comparing our custom implementation against sklearn's industrial-grade L-BFGS optimiser — same data, same model class, different solver.</p>

      <div className="m4-two-col">
        <div className="m4-card">
          <div className="m4-card-h">L-BFGS vs Mini-Batch Gradient Descent</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.75rem',marginBottom:'0.75rem'}}>
            {[
              {label:'Mini-Batch GD',color:'var(--cyan)',points:['First-order optimiser','Uses gradient ∂J/∂W only','Step size set by learning rate η','Noisy updates, many epochs needed','Simple, scales to large datasets']},
              {label:'L-BFGS',color:'var(--violet)',points:['Quasi-Newton (second-order)','Approximates the Hessian (curvature)','Takes larger, better-directed steps','Converges in tens of iterations','Memory-efficient Hessian approximation']},
            ].map(({label,color,points})=>(
              <div key={label} style={{background:`${color}08`,border:`1px solid ${color}22`,borderRadius:6,padding:'0.65rem'}}>
                <div style={{fontFamily:'var(--font-mono)',fontSize:'0.65rem',fontWeight:700,color,marginBottom:'0.4rem'}}>{label}</div>
                <ul style={{margin:0,padding:0,listStyle:'none',display:'flex',flexDirection:'column',gap:'0.2rem'}}>
                  {points.map(p=><li key={p} style={{fontSize:'0.75rem',color:'var(--text-2)',lineHeight:1.5}}>· {p}</li>)}
                </ul>
              </div>
            ))}
          </div>
          <div className="m4-infobox" style={{fontSize:'0.78rem'}}>
            Both are <strong>linear classifiers</strong> — they find the same class of solution (a hyperplane in 784D space). L-BFGS reaches a better point on the loss surface faster because it uses curvature information. The accuracy gap reflects optimiser quality, not model capacity.
          </div>
        </div>
        <div className="m4-card">
          <div className="m4-card-h">sklearn Training Code</div>
          <div style={{background:'rgba(0,0,0,0.3)',border:'1px solid rgba(148,163,184,0.12)',borderRadius:6,padding:'0.75rem',fontFamily:'var(--font-mono)',fontSize:'0.72rem',lineHeight:1.8,color:'var(--text-1)',overflowX:'auto'}}>
            <span style={{color:'var(--violet)'}}>from</span> sklearn.linear_model <span style={{color:'var(--violet)'}}>import</span> LogisticRegression{'\n\n'}
            sklearn_model = LogisticRegression({'\n'}
            {'    '}penalty=<span style={{color:'var(--cyan)'}}>None</span>,{'\n'}
            {'    '}solver=<span style={{color:'var(--amber)'}}>'lbfgs'</span>,{'\n'}
            {'    '}max_iter=<span style={{color:'var(--cyan)'}}>1000</span>,{'\n'}
            {'    '}random_state=<span style={{color:'var(--cyan)'}}>42</span>){'\n'}
            sklearn_model.fit(X_train_norm, y_train)
          </div>
          <div className="m4-infobox" style={{fontSize:'0.78rem',marginTop:'0.75rem'}}>
            <strong style={{color:'var(--rose)'}}>penalty=None</strong> is required — sklearn defaults to <code style={{fontFamily:'var(--font-mono)'}}>penalty='l2'</code> which shrinks weights towards zero (L2 regularisation). Our custom model has no regularisation, so we must disable it for a fair comparison.
          </div>
          <div className="m4-hr" />
          <div className="m4-flabel">Accuracy Comparison</div>
          <table className="m4-ptable" style={{marginTop:'0.25rem'}}>
            <thead><tr><th>Model</th><th>Train Acc</th><th>Test Acc</th></tr></thead>
            <tbody>
              <tr><td style={{fontFamily:'var(--font-mono)',fontSize:'0.72rem'}}>Custom Softmax</td><td style={{color:'var(--cyan)',fontFamily:'var(--font-mono)',fontSize:'0.8rem',fontWeight:700}}>93.30%</td><td style={{color:'var(--cyan)',fontFamily:'var(--font-mono)',fontSize:'0.8rem',fontWeight:700}}>{(customAcc*100).toFixed(2)}%</td></tr>
              <tr><td style={{fontFamily:'var(--font-mono)',fontSize:'0.72rem'}}>sklearn LR (L-BFGS)</td><td style={{color:'var(--violet)',fontFamily:'var(--font-mono)',fontSize:'0.8rem',fontWeight:700}}>~99.2%*</td><td style={{color:'var(--violet)',fontFamily:'var(--font-mono)',fontSize:'0.8rem',fontWeight:700}}>{(sklearnAcc*100).toFixed(2)}%</td></tr>
            </tbody>
          </table>
          <div style={{fontFamily:'var(--font-mono)',fontSize:'0.6rem',color:'var(--text-2)',marginTop:'0.35rem'}}>*sklearn train acc ≈99% — L-BFGS fits training data very tightly without regularisation</div>
        </div>
      </div>

      <div className="m4-card" style={{marginTop:'0.5rem'}}>
        <div className="m4-card-h">Confusion Matrices — Click a row label to highlight a digit</div>
        <div style={{display:'flex',gap:'0.5rem',marginBottom:'0.75rem'}}>
          {[['both','Show Both'],['custom','Custom Only'],['sklearn','sklearn Only']].map(([v,l])=>(
            <button key={v} className="m4-btn" onClick={()=>setCmModel(v)} style={{background: cmModel===v ? 'rgba(34,211,238,0.1)' : 'transparent', borderColor: cmModel===v ? 'rgba(34,211,238,0.4)' : 'var(--border)', color: cmModel===v ? 'var(--cyan)' : 'var(--text-2)', fontSize:'0.7rem'}}>{l}</button>
          ))}
        </div>
        <div style={{display:'grid',gridTemplateColumns: cmModel==='both' ? '1fr 1fr' : '1fr',gap:'1rem'}}>
          {(cmModel==='both'||cmModel==='custom') && <CMHeatmap matrix={CM_CUSTOM} title="// Custom Softmax Regression" selDigit={selDigit} onSelect={setSelDigit} />}
          {(cmModel==='both'||cmModel==='sklearn') && <CMHeatmap matrix={CM_SKLEARN} title="// sklearn LogisticRegression (L-BFGS)" selDigit={selDigit} onSelect={setSelDigit} />}
        </div>
        <div className="m4-infobox" style={{fontSize:'0.78rem',marginTop:'0.75rem'}}>
          <strong style={{color:'var(--rose)'}}>Red cells = hard pairs</strong>: 4↔9 and 3↔8 show the highest off-diagonal counts in both models. <strong style={{color:'var(--violet)'}}>Purple cells</strong> = other common confusions. Both confusion matrices have the same qualitative structure — the optimiser improves magnitudes, not the pattern of hard cases. Click a row label (0–9) to highlight that digit's errors.
        </div>
      </div>

      <div className="m4-card" style={{marginTop:'0.5rem'}}>
        <div className="m4-card-h">Classification Report — Click a digit class to highlight its row</div>
        <div style={{overflowX:'auto'}}>
          <table className="m4-ptable" style={{width:'100%'}}>
            <thead>
              <tr>
                <th>Digit</th>
                <th colSpan={3} style={{textAlign:'center',color:'var(--cyan)',borderBottom:'2px solid rgba(34,211,238,0.2)'}}>Custom Softmax</th>
                <th colSpan={3} style={{textAlign:'center',color:'var(--violet)',borderBottom:'2px solid rgba(167,139,250,0.2)'}}>sklearn LR</th>
                <th>Support</th>
              </tr>
              <tr>
                <th></th>
                <th style={{color:'var(--cyan)'}}>Prec</th><th style={{color:'var(--cyan)'}}>Rec</th><th style={{color:'var(--cyan)'}}>F1</th>
                <th style={{color:'var(--violet)'}}>Prec</th><th style={{color:'var(--violet)'}}>Rec</th><th style={{color:'var(--violet)'}}>F1</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {DIGITS.map((d,i)=>{
                const rc = reportCustom[i], rs = reportSklearn[i];
                const isSel = selDigit===i;
                const isHard = i===3||i===4||i===8||i===9;
                return (
                  <tr key={d} onClick={()=>setSelDigit(isSel?null:i)} style={{cursor:'pointer',background: isSel ? 'rgba(34,211,238,0.07)' : 'transparent',outline: isSel ? '1px solid rgba(34,211,238,0.2)' : 'none'}}>
                    <td style={{fontFamily:'var(--font-mono)',fontSize:'0.75rem',fontWeight:700,color: isHard ? 'var(--rose)' : 'var(--text-1)'}}>{d}{isHard?' ⚠':''}</td>
                    <td style={{fontFamily:'var(--font-mono)',fontSize:'0.73rem',color:'var(--cyan)'}}>{(rc.prec*100).toFixed(1)}%</td>
                    <td style={{fontFamily:'var(--font-mono)',fontSize:'0.73rem',color:'var(--cyan)'}}>{(rc.rec*100).toFixed(1)}%</td>
                    <td style={{fontFamily:'var(--font-mono)',fontSize:'0.73rem',color:'var(--cyan)',fontWeight:700}}>{(rc.f1*100).toFixed(1)}%</td>
                    <td style={{fontFamily:'var(--font-mono)',fontSize:'0.73rem',color:'var(--violet)'}}>{(rs.prec*100).toFixed(1)}%</td>
                    <td style={{fontFamily:'var(--font-mono)',fontSize:'0.73rem',color:'var(--violet)'}}>{(rs.rec*100).toFixed(1)}%</td>
                    <td style={{fontFamily:'var(--font-mono)',fontSize:'0.73rem',color:'var(--violet)',fontWeight:700}}>{(rs.f1*100).toFixed(1)}%</td>
                    <td style={{fontFamily:'var(--font-mono)',fontSize:'0.65rem',color:'var(--text-2)'}}>{rc.support}</td>
                  </tr>
                );
              })}
              <tr style={{borderTop:'2px solid var(--border)'}}>
                <td style={{fontFamily:'var(--font-mono)',fontSize:'0.68rem',color:'var(--text-2)'}}>macro avg</td>
                <td colSpan={3} style={{textAlign:'center',fontFamily:'var(--font-mono)',fontSize:'0.72rem',color:'var(--cyan)',fontWeight:700}}>{(reportCustom.reduce((s,r)=>s+r.f1,0)/10*100).toFixed(1)}%</td>
                <td colSpan={3} style={{textAlign:'center',fontFamily:'var(--font-mono)',fontSize:'0.72rem',color:'var(--violet)',fontWeight:700}}>{(reportSklearn.reduce((s,r)=>s+r.f1,0)/10*100).toFixed(1)}%</td>
                <td style={{fontFamily:'var(--font-mono)',fontSize:'0.65rem',color:'var(--text-2)'}}>{reportCustom.reduce((s,r)=>s+r.support,0)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div style={{fontFamily:'var(--font-mono)',fontSize:'0.6rem',color:'var(--text-2)',marginTop:'0.4rem'}}>⚠ = hard digit pairs (3↔8, 4↔9) — lowest F1 in both models · Click a row to highlight</div>
      </div>

      <div className="m4-card" style={{marginTop:'0.5rem'}}>
        <div className="m4-card-h">Concept Check</div>
        <div className="m4-infobox" style={{fontSize:'0.82rem'}}>
          <strong style={{color:'var(--amber)'}}>Why do both models struggle with the same digit pairs even though sklearn's optimiser is better?</strong>
        </div>
        <p style={{fontSize:'0.82rem',color:'var(--text-1)',lineHeight:1.65,marginTop:'0.75rem',marginBottom:0}}>
          Both models are <strong>fundamentally linear classifiers</strong> — they learn a hyperplane in 784-dimensional pixel space. The hard pairs (4↔9, 3↔8) require a <em>curved</em> decision boundary to separate reliably; no matter how well you optimise the linear objective, you can't draw a straight line through a space that needs a curve. L-BFGS finds a slightly better hyperplane, but the same structural limitation applies to both. The confusion matrix pattern (which pairs are hard) stays the same — only the count of misclassifications decreases slightly.
        </p>
      </div>

      <div className="m4-card" style={{marginTop:'0.5rem',background:'rgba(34,211,238,0.04)',border:'1px solid rgba(34,211,238,0.15)'}}>
        <div className="m4-card-h" style={{color:'var(--cyan)'}}>Key Takeaway</div>
        <p style={{fontSize:'0.83rem',color:'var(--text-1)',lineHeight:1.6,margin:0}}>
          Our custom implementation validates correctly: both models achieve similar test accuracy (~92–94%), confirming the gradient math is right. The accuracy gap is due to optimiser quality (L-BFGS vs mini-batch GD), not model capacity — both draw a linear boundary in pixel space, and both struggle with the same visually similar digit pairs.
        </p>
      </div>
    </div>
  );
}

// ─── Section 5: Linear vs Non-Linear ─────────────────────────────────────────
function Asgn1Sec5_Linear() {
  const HARD_PAIRS = [
    { a:'4', b:'9', color:'var(--rose)', why:'Both have a closed loop and a vertical stroke — their pixel patterns overlap significantly in 784D space. A hyperplane cannot separate them without also misclassifying some correct examples.' },
    { a:'3', b:'8', color:'var(--amber)', why:'Similar curved top structure. The difference is the lower half: 3 is open on the left, 8 closes it. In pixel space this is a subtle distinction that a linear boundary struggles to exploit.' },
    { a:'5', b:'6', color:'var(--violet)', why:'The top curve and middle stroke are visually similar in many handwriting styles. The bottom distinguishes them but pixel intensity overlap is high.' },
    { a:'7', b:'1', color:'var(--emerald)', why:'Both are primarily vertical strokes. The diagonal bar on a 7 is the only discriminating feature — and handwriting variation makes it inconsistent.' },
  ];
  return (
    <div>
      <p className="m4-sec-sub">Understanding why linear classifiers hit a ceiling on MNIST — and why neural networks and kernel methods exist.</p>

      <div className="m4-two-col">
        <div className="m4-card">
          <div className="m4-card-h">The Linear Limitation</div>
          <ul className="m4-bullets">
            <li>Softmax regression learns one <strong>weight vector per class</strong> — effectively a set of 10 linear filters in 784D pixel space</li>
            <li>The decision boundary between any two classes is a <strong>hyperplane</strong>: a flat 783-dimensional surface</li>
            <li>Some digit pairs require a <strong>curved boundary</strong> to separate reliably — a hyperplane cannot achieve this</li>
            <li>No matter how well you optimise, you cannot draw a straight line through a space that needs a curve</li>
          </ul>
          <div className="m4-hr" />
          <div className="m4-flabel">Where the ~8% error comes from</div>
          <div className="m4-warnbox" style={{fontSize:'0.79rem'}}>
            Linear MNIST classifiers plateau around 91–94% accuracy. The remaining ~6–9% error is <em>irreducible with a linear model</em> — it requires a non-linear boundary. Neural networks and kernel SVMs break through this ceiling.
          </div>
        </div>
        <div className="m4-card">
          <div className="m4-card-h">Why 784D Makes This Worse</div>
          <p style={{fontSize:'0.81rem',color:'var(--text-2)',lineHeight:1.65}}>
            In 2D, you can easily visualise whether two classes are linearly separable (draw a line). In 784D, the "line" becomes a hyperplane we can't visualise. The model learns pixel weights — essentially a template for each digit — but templates don't generalise well across handwriting styles.
          </p>
          <div className="m4-hr" />
          <div className="m4-flabel">The Weight Matrix as Templates</div>
          <div className="m4-infobox" style={{fontSize:'0.78rem'}}>
            Each column of W (shape 785 × 10) is a weight vector for one class. Reshaped to 28×28, it looks like a blurry "average" of that digit. This is why 4 and 9 are confused: their templates look similar in pixel space — both have a vertical stroke and upper loop.
          </div>
        </div>
      </div>

      <div className="m4-card" style={{marginTop:'0.5rem'}}>
        <div className="m4-card-h">Hard Digit Pairs — Why These Specific Confusions?</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))',gap:'0.75rem'}}>
          {HARD_PAIRS.map(({a,b,color,why})=>(
            <div key={`${a}${b}`} style={{background:`${color}08`,border:`1px solid ${color}22`,borderRadius:6,padding:'0.85rem'}}>
              <div style={{display:'flex',alignItems:'center',gap:'0.75rem',marginBottom:'0.6rem'}}>
                <div style={{display:'flex',gap:'0.4rem',alignItems:'center'}}>
                  <DigitThumbnail digit={a} />
                  <span style={{fontFamily:'var(--font-mono)',fontSize:'0.8rem',color,fontWeight:700}}>↔</span>
                  <DigitThumbnail digit={b} />
                </div>
                <span style={{fontFamily:'var(--font-mono)',fontSize:'0.7rem',fontWeight:700,color}}>"{a}" vs "{b}"</span>
              </div>
              <p style={{fontSize:'0.77rem',color:'var(--text-2)',lineHeight:1.6,margin:0}}>{why}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="m4-card" style={{marginTop:'0.5rem',background:'rgba(167,139,250,0.04)',border:'1px solid rgba(167,139,250,0.2)'}}>
        <div className="m4-card-h" style={{color:'var(--violet)'}}>Bridge to Non-Linear Models</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(210px,1fr))',gap:'0.75rem',marginTop:'0.25rem'}}>
          {[
            {label:'Neural Networks',color:'var(--cyan)',desc:'Stack non-linear layers (ReLU activations) to learn curved decision boundaries automatically. Multi-layer perceptrons break through the 94% MNIST ceiling, and CNNs reach >99%.'},
            {label:'Kernel SVMs (RBF)',color:'var(--violet)',desc:'The RBF kernel K(a,b)=exp(−γ‖a−b‖²) implicitly maps inputs to an infinite-dimensional feature space where the classes become linearly separable. Covered in Part 2 of the assignment.'},
            {label:'Polynomial Features',color:'var(--emerald)',desc:'Explicitly add products of pixel features (e.g. pixel_i × pixel_j). Creates curved boundaries in the original space — but 784² = 614,656 new features makes this computationally infeasible without the kernel trick.'},
          ].map(({label,color,desc})=>(
            <div key={label} style={{background:`${color}08`,border:`1px solid ${color}22`,borderRadius:6,padding:'0.85rem'}}>
              <div style={{fontFamily:'var(--font-mono)',fontSize:'0.65rem',fontWeight:700,color,marginBottom:'0.4rem'}}>{label}</div>
              <p style={{fontSize:'0.77rem',color:'var(--text-2)',lineHeight:1.6,margin:0}}>{desc}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="m4-card" style={{marginTop:'0.5rem',background:'rgba(34,211,238,0.04)',border:'1px solid rgba(34,211,238,0.15)'}}>
        <div className="m4-card-h" style={{color:'var(--cyan)'}}>Key Takeaway</div>
        <p style={{fontSize:'0.83rem',color:'var(--text-1)',lineHeight:1.6,margin:0}}>
          A linear classifier in 784D pixel space learns a weight template per digit — effectively a blurry average of that class. Digits that share visual structure (4↔9, 3↔8) need a <em>curved</em> decision surface that a hyperplane cannot provide. This is the fundamental motivation for neural networks (non-linear activation layers) and kernel methods (SVMs with RBF kernel), which map the data into spaces where it becomes linearly separable.
        </p>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
const MAIN_TABS = ['Overview', 'Intro to ML', 'ML Projects', 'Regression', 'Reg. & kNN', 'SVMs', 'Decision Trees', 'Assignment 1', 'Quiz'];
const L6_TABS = ['Overview & CART', 'Impurity Measures', 'Regularisation', 'Regression Trees', 'Limitations'];
const L1_TABS = ['Mitchell\'s Definition', 'ML System Types', 'Challenges & Testing'];
const L2_TABS = ['Formal Model', 'Project Workflow', 'Performance Measures', 'Classification Eval'];
const L3_TABS = ['Linear Regression', 'Gradient Descent', 'Polynomial Regression', 'Logistic Regression'];
const L4_TABS = ['Bias & Variance', 'Regularisation', 'kNN', 'Softmax & Multiclass'];
const L5_TABS = ['Linear SVM', 'Kernel Trick', 'SVM Math', 'Complexity & Regression'];
const ASGN1_TABS = ['MNIST & Classification', 'Data Splits', 'Softmax from Scratch', 'sklearn Comparison', 'Linear vs Non-Linear'];

export default function CITS5508() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('Overview');
  const [asgn1Tab, setAsgn1Tab] = useState('MNIST & Classification');
  const [l1Tab, setL1Tab] = useState('Mitchell\'s Definition');
  const [l2Tab, setL2Tab] = useState('Formal Model');
  const [l3Tab, setL3Tab] = useState('Linear Regression');
  const [l4Tab, setL4Tab] = useState('Bias & Variance');
  const [l5Tab, setL5Tab] = useState('Linear SVM');
  const [l6Tab, setL6Tab] = useState('Overview & CART');

  useEffect(() => {
    document.title = 'CITS5508 — Learning Hub';
    return () => { document.title = 'James Wigfield'; };
  }, []);

  return (
    <div className="m4-root">
      <header className="m4-header">
        <div className="m4-header-inner">
          <div className="m4-header-top">
            <button className="umod__back" onClick={() => navigate('/hub')}>← Hub</button>
            <div className="m4-htitle">
              <span className="m4-hcode" style={{ color: 'var(--cyan)', background: 'rgba(34,211,238,0.1)', borderColor: 'rgba(34,211,238,0.25)' }}>CITS5508</span>
              <span className="m4-hname">Machine Learning</span>
            </div>
          </div>
          <nav className="m4-tabs">
            {MAIN_TABS.map(t => (
              <button key={t} className={`m4-tab ${tab === t ? 'm4-tab--on' : ''}`} style={tab === t ? { color: 'var(--cyan)', borderBottomColor: 'var(--cyan)' } : {}} onClick={() => setTab(t)}>{t}</button>
            ))}
          </nav>
        </div>
      </header>

      <main className="m4-main">

        {/* ── OVERVIEW ── */}
        {tab === 'Overview' && (
          <div>
            <div className="m4-hero" style={{ background: 'linear-gradient(135deg, rgba(34,211,238,0.08) 0%, rgba(167,139,250,0.04) 100%)', borderColor: 'rgba(34,211,238,0.2)' }}>
              <div className="m4-hero-lbl" style={{ color: 'var(--cyan)' }}>// CITS5508 · UWA · Sem 1, 2026</div>
              <h1 className="m4-hero-title"><span style={{ color: 'var(--cyan)' }}>Machine</span> Learning</h1>
              <p className="m4-hero-sub">
                From Mitchell's formal definition of learning through regression, regularisation, kNN, and Support Vector Machines — covering all core concepts with interactive visualisations.
                This module covers Lectures 1–5.
              </p>
            </div>
            <div className="m4-topic-grid">
              {[
                { code: 'L1', title: "Mitchell's Definition", color: 'var(--cyan)', desc: 'The E/T/P framework. What constitutes learning. Interactive examples across multiple domains.', go: 'Intro to ML', sub: null },
                { code: 'L1', title: 'Types of ML Systems', color: 'var(--violet)', desc: 'Supervised, unsupervised, semi-supervised, self-supervised, RL. Batch vs online. Instance-based vs model-based.', go: 'Intro to ML', sub: 'ML System Types' },
                { code: 'L1', title: 'ML Challenges', color: 'var(--emerald)', desc: 'Insufficient data, sampling bias, poor quality, irrelevant features, overfitting, underfitting. Mitigations.', go: 'Intro to ML', sub: 'Challenges & Testing' },
                { code: 'L2', title: 'Formal Model & Bias Trick', color: 'var(--amber)', desc: 'Linear hypothesis, bias as a weight, dot-product form h(x) = sgn(wᵀx). NumPy vectorisation.', go: 'ML Projects', sub: null },
                { code: 'L2', title: 'Performance Measures', color: 'var(--rose)', desc: 'MSE, RMSE, MAE for regression. Interactive error explorer on California housing data.', go: 'ML Projects', sub: 'Performance Measures' },
                { code: 'L2', title: 'Classification Evaluation', color: 'var(--cyan)', desc: 'Confusion matrix, precision, recall, F₁, ROC curve, AUC, multiclass strategies.', go: 'ML Projects', sub: 'Classification Eval', l: null },
                { code: 'L3', title: 'Linear & Logistic Regression', color: 'var(--violet)', desc: 'Normal Equation, gradient descent (Batch/SGD/Mini-batch), polynomial regression, logistic sigmoid, log loss.', go: 'Regression', sub: null, l: null },
                { code: 'L3', title: 'Gradient Descent Visualizer', color: 'var(--emerald)', desc: 'Interactive step-through of GD on J(θ)=(θ−2)². Control η, starting point, and step count.', go: 'Regression', sub: 'Gradient Descent', l: 'l3' },
                { code: 'L4', title: 'Bias/Variance & Regularisation', color: 'var(--amber)', desc: 'Ridge, Lasso, Elastic Net coefficient shrinkage. Cross-validation, early stopping, bias/variance tradeoff.', go: 'Reg. & kNN', sub: null, l: null },
                { code: 'L4', title: 'kNN Classifier', color: 'var(--rose)', desc: 'Instance-based learning. Interactive decision boundary heatmap. Click to classify query points.', go: 'Reg. & kNN', sub: 'kNN', l: 'l4' },
                { code: 'L4', title: 'Softmax & Multiclass', color: 'var(--cyan)', desc: 'Softmax regression for K classes. Interactive logit sliders. OvA, OvO, multilabel strategies.', go: 'Reg. & kNN', sub: 'Softmax & Multiclass', l: 'l4' },
                { code: 'L5', title: 'Large Margin Classification', color: 'var(--emerald)', desc: 'Hard vs soft margin SVMs. C hyperparameter controls margin width vs violation penalty. Interactive C slider.', go: 'SVMs', sub: 'Linear SVM', l: 'l5' },
                { code: 'L5', title: 'Kernel Trick & RBF', color: 'var(--violet)', desc: 'The kernel trick for nonlinear boundaries. Gaussian RBF: K(a,b) = exp(−γ‖a−b‖²). Interactive γ visualiser.', go: 'SVMs', sub: 'Kernel Trick', l: 'l5' },
                { code: 'L5', title: 'SVM Math & Hinge Loss', color: 'var(--amber)', desc: 'Primal/dual objectives, slack variables ζ, hinge loss vs MSE, all four kernel equations side by side.', go: 'SVMs', sub: 'SVM Math', l: 'l5' },
                { code: 'L5', title: 'Complexity & SVR', color: 'var(--rose)', desc: 'LinearSVC O(m×n) vs SVC O(m³×n). SVM Regression: fitting the widest ε-tube. Feature scaling rules.', go: 'SVMs', sub: 'Complexity & Regression', l: 'l5' },
                { code: 'A1', title: 'MNIST & Softmax', color: 'var(--cyan)', desc: 'MNIST dataset, stratified splits, softmax regression from scratch (NumPy), early stopping at epoch 146 — 93.3% train / 92.0% val accuracy.', go: 'Assignment 1', sub: 'MNIST & Classification' },
                { code: 'A1', title: 'Softmax Implementation', color: 'var(--violet)', desc: 'Method-by-method walkthrough of SoftmaxRegression class: _add_bias, _softmax (numerically stable), _one_hot, _cross_entropy, fit, predict.', go: 'Assignment 1', sub: 'Softmax from Scratch' },
                { code: 'A1', title: 'sklearn Comparison', color: 'var(--emerald)', desc: 'L-BFGS vs mini-batch GD. Interactive confusion matrices and classification report — hard pairs 4↔9, 3↔8 highlighted.', go: 'Assignment 1', sub: 'sklearn Comparison' },
                { code: 'A1', title: 'Linear vs Non-Linear', color: 'var(--amber)', desc: 'Why linear classifiers plateau at ~92% on MNIST. Hyperplane limitations in 784D pixel space. Bridge to neural networks and kernel SVMs.', go: 'Assignment 1', sub: 'Linear vs Non-Linear' },
                { code: 'L6', title: 'CART Algorithm', color: 'var(--emerald)', desc: 'Recursive binary splitting. Greedy top-down tree building. Gini impurity cost function. The Guess Who analogy for understanding information gain.', go: 'Decision Trees', sub: 'Overview & CART' },
                { code: 'L6', title: 'Gini Impurity & Entropy', color: 'var(--violet)', desc: 'Gini: G = 1 − Σp². Entropy: H = −Σp log₂p. Both measure node purity. Class probability estimation from leaf value arrays.', go: 'Decision Trees', sub: 'Impurity Measures' },
                { code: 'L6', title: 'Regularisation & Pruning', color: 'var(--rose)', desc: 'max_depth, min_samples_leaf, max_leaf_nodes. Cost-complexity pruning with α penalty. MSE vs tree size curves.', go: 'Decision Trees', sub: 'Regularisation' },
                { code: 'L6', title: 'Regression Trees', color: 'var(--cyan)', desc: 'Predict the mean response per region. MSE-based CART cost. Hitters baseball example: Years/Hits → log(Salary). Depth controls step-function resolution.', go: 'Decision Trees', sub: 'Regression Trees' },
                { code: 'L6', title: 'DT Limitations', color: 'var(--amber)', desc: 'High variance, axis-aligned splits only, sensitivity to rotation. Mitigations: PCA for rotation, Random Forests for variance.', go: 'Decision Trees', sub: 'Limitations' },
              ].map(item => (
                <div
                  key={item.title}
                  className="m4-tcard"
                  style={{ '--tc': item.color }}
                  onClick={() => {
                    setTab(item.go);
                    if (item.sub) {
                      if (item.go === 'Intro to ML') setL1Tab(item.sub);
                      else if (item.go === 'ML Projects') setL2Tab(item.sub);
                      else if (item.go === 'Regression') setL3Tab(item.sub);
                      else if (item.go === 'Reg. & kNN') setL4Tab(item.sub);
                      else if (item.go === 'SVMs') setL5Tab(item.sub);
                      else if (item.go === 'Decision Trees') setL6Tab(item.sub);
                      else if (item.go === 'Assignment 1') setAsgn1Tab(item.sub);
                    }
                  }}
                >
                  <div className="m4-tcard-code" style={{ color: item.color }}>{item.code}</div>
                  <div className="m4-tcard-title">{item.title}</div>
                  <div className="m4-tcard-desc">{item.desc}</div>
                  <div className="m4-tcard-cta" style={{ color: item.color }}>Explore →</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── INTRO TO ML (L1) ── */}
        {tab === 'Intro to ML' && (
          <div>
            <div className="m4-sec-hdr">
              <h2 className="m4-sec-title">Introduction to Machine Learning <span className="m4-badge" style={{ background: 'rgba(34,211,238,0.12)', color: 'var(--cyan)', border: '1px solid rgba(34,211,238,0.3)' }}>Lecture 1</span></h2>
            </div>
            <div className="m4-labtabs">
              {L1_TABS.map(lt => (
                <button key={lt} className={`m4-labtab ${l1Tab === lt ? 'm4-labtab--on' : ''}`} onClick={() => setL1Tab(lt)}>{lt}</button>
              ))}
            </div>

            {l1Tab === "Mitchell's Definition" && (
              <div>
                <p className="m4-sec-sub">The formal definition of machine learning: algorithms that improve at a task T, measured by performance P, through experience E.</p>
                <MitchellExplorer />
                <div className="m4-two-col">
                  <div className="m4-card">
                    <div className="m4-card-h">Formal Definitions</div>
                    <div className="m4-flabel">Dataset</div>
                    <Tex src="D_i = (x_{i1}, x_{i2}, \ldots, x_{im}, y_i) = (\vec{x}_i, y_i)" block />
                    <VarTable vars={[
                      ['D', 'Dataset — composed of n examples and m attributes'],
                      ['\\vec{x}_i', 'm-dimensional feature vector of the i-th example'],
                      ['y_i', 'Target label (output) of the i-th example'],
                      ['n', 'Number of training examples'],
                      ['m', 'Number of features (attributes)'],
                    ]} />
                    <div className="m4-hr" />
                    <div className="m4-flabel">Target & Hypothesis Functions</div>
                    <Tex src="f : \mathcal{X} \rightarrow \mathcal{Y} \quad \text{(ideal unknown function)}" block />
                    <Tex src="g : \mathcal{X} \rightarrow \mathcal{Y}, \; g \in \mathcal{H}, \; g \approx f \quad \text{(learned hypothesis)}" block />
                    <VarTable vars={[
                      ['\\mathcal{X}', 'Input space (e.g., ℝᵐ for m-dimensional features)'],
                      ['\\mathcal{Y}', 'Output space (e.g., {−1,+1} for binary classification)'],
                      ['\\mathcal{H}', 'Hypothesis space — all candidate functions considered by the algorithm'],
                      ['f', 'True target function (unknown — what we want to approximate)'],
                      ['g', 'Learned hypothesis — the model\'s best approximation of f'],
                    ]} />
                  </div>
                  <LinearClassifierViz />
                </div>
                <div style={{ marginTop: '-1rem' }}>
                  <div className="m4-card">
                    <div className="m4-card-h">Inductive Learning</div>
                    <ul className="m4-bullets">
                      <li>ML is also known as <strong>inductive learning</strong> — a form of logical inference that obtains generic conclusions from specific examples.</li>
                      <li><strong>Arthur Samuel (1959):</strong> "Machine Learning is the field of study that gives computers the ability to learn without being explicitly programmed."</li>
                      <li><strong>Tom Mitchell (1997):</strong> Formalised the E/T/P framework above.</li>
                      <li>ML is contrasted with traditional programming: instead of writing rules, you provide examples and the algorithm finds the rules.</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {l1Tab === 'ML System Types' && (
              <div>
                <p className="m4-sec-sub">ML systems can be categorised based on training supervision, ability to learn incrementally, and generalisation approach.</p>
                <MLTypesGrid />
              </div>
            )}

            {l1Tab === 'Challenges & Testing' && (
              <div>
                <p className="m4-sec-sub">The success of an ML system depends heavily on data quality, model complexity, and proper evaluation.</p>
                <ChallengesAccordion />
                <div className="m4-card">
                  <div className="m4-card-h">Testing and Validation</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                    {[
                      { title: 'Train/Test Split', color: 'var(--cyan)', desc: 'Data is split into training set (~80%) for fitting the model and a test set (~20%) for final evaluation. The test set must never be used during training or tuning.' },
                      { title: 'Generalisation Error', color: 'var(--violet)', desc: 'The error rate measured on the held-out test set. Also called out-of-sample error. Low training error but high generalisation error = overfitting.' },
                      { title: 'Validation Set', color: 'var(--emerald)', desc: 'A separate holdout set from training data used for hyperparameter tuning. Reserving the test set for one final evaluation avoids optimistic bias from repeated testing.' },
                    ].map(item => (
                      <div key={item.title} style={{ background: `${item.color}08`, border: `1px solid ${item.color}30`, borderRadius: 6, padding: '0.9rem' }}>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', fontWeight: 700, color: item.color, marginBottom: '0.4rem' }}>{item.title}</div>
                        <p style={{ fontSize: '0.79rem', color: 'var(--text-2)', lineHeight: 1.5 }}>{item.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── ML PROJECTS (L2) ── */}
        {tab === 'ML Projects' && (
          <div>
            <div className="m4-sec-hdr">
              <h2 className="m4-sec-title">ML Projects & Evaluation <span className="m4-badge" style={{ background: 'rgba(34,211,238,0.12)', color: 'var(--cyan)', border: '1px solid rgba(34,211,238,0.3)' }}>Lecture 2</span></h2>
            </div>
            <div className="m4-labtabs">
              {L2_TABS.map(lt => (
                <button key={lt} className={`m4-labtab ${l2Tab === lt ? 'm4-labtab--on' : ''}`} onClick={() => setL2Tab(lt)}>{lt}</button>
              ))}
            </div>

            {l2Tab === 'Formal Model' && (
              <div>
                <p className="m4-sec-sub">Continued from Lecture 1: simplifying the linear model with the bias trick, enabling efficient vectorised computation.</p>
                <BiasTrickSection />
              </div>
            )}

            {l2Tab === 'Project Workflow' && (
              <div>
                <p className="m4-sec-sub">A systematic 6-step process for building end-to-end ML projects, illustrated with the California Housing dataset.</p>
                <WorkflowSection />
                <div className="m4-infobox" style={{ marginTop: '1rem' }}>
                  <strong>Sampling Bias Warning:</strong> A model's predictions can fail drastically if training data is unrepresentative.
                  Historical example: the 1936 US presidential election poll predicted Landon by sampling wealthier telephone/magazine subscribers —
                  but Roosevelt won with <strong>62% of the vote</strong>. Representative sampling is critical.
                </div>
              </div>
            )}

            {l2Tab === 'Performance Measures' && (
              <div>
                <p className="m4-sec-sub">Choosing the right performance measure for regression models, demonstrated with housing price prediction.</p>
                <PerformanceMeasuresViz />
                <div className="m4-card">
                  <div className="m4-card-h">When to Use Each Metric</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    {[
                      { metric: 'MSE / RMSE', color: 'var(--rose)', when: 'When large errors are disproportionately bad (outliers should be penalised heavily). Most common default for regression. RMSE is in the same units as the target — more interpretable.' },
                      { metric: 'MAE', color: 'var(--emerald)', when: 'When you want equal weight on all errors regardless of size. More robust to outliers. Better when the cost of errors scales linearly (not quadratically) with magnitude.' },
                    ].map(item => (
                      <div key={item.metric} style={{ background: `${item.color}08`, border: `1px solid ${item.color}30`, borderRadius: 6, padding: '0.9rem' }}>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', fontWeight: 700, color: item.color, marginBottom: '0.4rem' }}>{item.metric}</div>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-2)', lineHeight: 1.5 }}>{item.when}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {l2Tab === 'Classification Eval' && (
              <div>
                <p className="m4-sec-sub">Why accuracy is often insufficient, and how the confusion matrix gives a more complete picture of classifier performance.</p>
                <ConfusionMatrixExplorer />
                <MNISTSection />
              </div>
            )}
          </div>
        )}

        {/* ── REGRESSION (L3) ── */}
        {tab === 'Regression' && (
          <div>
            <div className="m4-sec-hdr">
              <h2 className="m4-sec-title">Regression Models <span className="m4-badge" style={{ background: 'rgba(34,211,238,0.12)', color: 'var(--cyan)', border: '1px solid rgba(34,211,238,0.3)' }}>Lecture 3</span></h2>
            </div>
            <div className="m4-labtabs">
              {L3_TABS.map(lt => (
                <button key={lt} className={`m4-labtab ${l3Tab === lt ? 'm4-labtab--on' : ''}`} onClick={() => setL3Tab(lt)}>{lt}</button>
              ))}
            </div>

            {l3Tab === 'Linear Regression' && (
              <div>
                <p className="m4-sec-sub">A linear model makes predictions by computing a weighted sum of input features plus a bias term. Training finds the θ that minimises MSE.</p>
                <div className="m4-two-col">
                  <div className="m4-card">
                    <div className="m4-card-h">Linear Regression Model</div>
                    <div className="m4-flabel">Prediction (scalar form)</div>
                    <Tex src="\hat{y} = \theta_0 + \theta_1 x_1 + \theta_2 x_2 + \cdots + \theta_n x_n" block />
                    <div className="m4-flabel">Vectorised form</div>
                    <Tex src="\hat{y} = h_\theta(x) = \theta^\top x" block />
                    <VarTable vars={[
                      ['\\hat{y}', 'Predicted value (output)'],
                      ['\\theta', 'Parameter vector — contains bias θ₀ and feature weights θ₁…θₙ'],
                      ['x', 'Feature vector (with x₀ = 1 for the bias trick)'],
                    ]} />
                    <div className="m4-hr" />
                    <div className="m4-flabel">Cost Functions</div>
                    <Tex src="\text{MSE}(X, h_\theta) = \frac{1}{m}\sum_{i=1}^{m}(\theta^\top x^{(i)} - y^{(i)})^2" block />
                    <Tex src="\text{RSS}(X, h_\theta) = \sum_{i=1}^{m}(\theta^\top x^{(i)} - y^{(i)})^2" block />
                  </div>
                  <div className="m4-card">
                    <div className="m4-card-h">The Normal Equation</div>
                    <div className="m4-flabel">Closed-form solution</div>
                    <Tex src="\hat{\theta} = (X^\top X)^{-1} X^\top y" block />
                    <VarTable vars={[
                      ['X', 'Design matrix — rows are training examples (m × n+1)'],
                      ['y', 'Target vector of all training labels (m × 1)'],
                      ['(X^\\top X)^{-1}', 'Matrix inverse — O(n³) to compute'],
                    ]} />
                    <div className="m4-infobox" style={{ fontSize: '0.79rem' }}>
                      <strong>Normal Equation vs Gradient Descent:</strong>
                      The Normal Equation gives an exact solution with no iterations or learning rate tuning.
                      However, inverting (XᵀX) is O(n³) — impractical for large n (many features).
                      GD scales much better: O(k·m·n) where k is the number of iterations.
                    </div>
                    <div className="m4-hr" />
                    <div className="m4-flabel">Complexity Summary</div>
                    <table className="m4-ptable">
                      <thead><tr><th>Method</th><th>Training complexity</th><th>Prediction</th></tr></thead>
                      <tbody>
                        <tr><td className="pk">Normal Equation</td><td>O(n²·m + n³)</td><td>O(n)</td></tr>
                        <tr><td className="pk">Batch GD</td><td>O(k·m·n)</td><td>O(n)</td></tr>
                        <tr><td className="pk">SGD</td><td>O(k·n)</td><td>O(n)</td></tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {l3Tab === 'Gradient Descent' && (
              <div>
                <p className="m4-sec-sub">Iteratively minimise the cost function by stepping in the direction of steepest descent. Adjust η to see convergence vs divergence.</p>
                <GradientDescentViz />
              </div>
            )}

            {l3Tab === 'Polynomial Regression' && (
              <div>
                <p className="m4-sec-sub">Extend linear regression by introducing polynomial features. Demonstrates the overfitting/underfitting spectrum through learning curves.</p>
                <PolyRegressionViz />
              </div>
            )}

            {l3Tab === 'Logistic Regression' && (
              <div>
                <p className="m4-sec-sub">A regression algorithm repurposed for classification: outputs a probability via the sigmoid function, trained with log loss (cross-entropy).</p>
                <SigmoidViz />
              </div>
            )}
          </div>
        )}

        {/* ── REGULARISATION & KNN (L4) ── */}
        {tab === 'Reg. & kNN' && (
          <div>
            <div className="m4-sec-hdr">
              <h2 className="m4-sec-title">Regularisation &amp; kNN <span className="m4-badge" style={{ background: 'rgba(34,211,238,0.12)', color: 'var(--cyan)', border: '1px solid rgba(34,211,238,0.3)' }}>Lecture 4</span></h2>
            </div>
            <div className="m4-labtabs">
              {L4_TABS.map(lt => (
                <button key={lt} className={`m4-labtab ${l4Tab === lt ? 'm4-labtab--on' : ''}`} onClick={() => setL4Tab(lt)}>{lt}</button>
              ))}
            </div>

            {l4Tab === 'Bias & Variance' && (
              <div>
                <p className="m4-sec-sub">Generalisation error decomposes into bias, variance, and irreducible noise. Increasing model complexity trades off one for the other.</p>
                <BiasVarianceSection />
              </div>
            )}

            {l4Tab === 'Regularisation' && (
              <div>
                <p className="m4-sec-sub">Constrain model weights to reduce overfitting. Ridge shrinks all weights; Lasso drives some to exactly zero (feature selection); Elastic Net combines both.</p>
                <RegularizationViz />
              </div>
            )}

            {l4Tab === 'kNN' && (
              <div>
                <p className="m4-sec-sub">Instance-based learning: no explicit model is built. Classify by majority vote among the k closest training examples. Feature scaling is essential.</p>
                <KNNViz />
              </div>
            )}

            {l4Tab === 'Softmax & Multiclass' && (
              <div>
                <p className="m4-sec-sub">Softmax Regression generalises logistic regression to K classes. Adjust logits to see probability distributions and argmax prediction.</p>
                <SoftmaxSection />
              </div>
            )}
          </div>
        )}

        {/* ── SVMs (L5) ── */}
        {tab === 'SVMs' && (
          <div>
            <div className="m4-sec-hdr">
              <h2 className="m4-sec-title">Support Vector Machines <span className="m4-badge" style={{ background: 'rgba(52,211,153,0.12)', color: 'var(--emerald)', border: '1px solid rgba(52,211,153,0.3)' }}>Lecture 5</span></h2>
            </div>
            <div className="m4-labtabs">
              {L5_TABS.map(lt => (
                <button key={lt} className={`m4-labtab ${l5Tab === lt ? 'm4-labtab--on' : ''}`} onClick={() => setL5Tab(lt)}>{lt}</button>
              ))}
            </div>

            {l5Tab === 'Linear SVM' && (
              <div>
                <p className="m4-sec-sub">SVMs find the widest possible margin between classes. Only the training instances on the margin edges ("support vectors") determine the decision boundary.</p>
                <SVMMarginViz />
                <div className="m4-two-col" style={{ marginTop: '0.5rem' }}>
                  <div className="m4-card">
                    <div className="m4-card-h">Hard Margin Classification</div>
                    <ul className="m4-bullets">
                      <li>Strictly requires all instances to be off the street and on the correct side</li>
                      <li>Only works if the data is <strong>linearly separable</strong></li>
                      <li>Extremely sensitive to outliers — one misplaced point can make it infeasible</li>
                      <li>Minimises <Tex src="\frac{1}{2}w^Tw" /> subject to <Tex src="t^{(i)}(w^Tx^{(i)}+b) \ge 1" /></li>
                    </ul>
                  </div>
                  <div className="m4-card">
                    <div className="m4-card-h">Soft Margin Classification</div>
                    <ul className="m4-bullets">
                      <li>Balances wide margin vs. limiting violations using slack variable <Tex src="\zeta^{(i)} \ge 0" /></li>
                      <li><strong>Small C</strong> → wide street, more violations permitted (simpler boundary)</li>
                      <li><strong>Large C</strong> → narrow street, fewer violations (tighter fit, may overfit)</li>
                      <li>If overfitting: reduce C. If underfitting: increase C.</li>
                      <li>Adding more instances "off the street" does not change the decision boundary</li>
                    </ul>
                  </div>
                </div>
                <div className="m4-card" style={{ marginTop: '0.5rem' }}>
                  <div className="m4-card-h">SVM Introduction</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                    {[
                      { title: 'What is an SVM?', color: 'var(--emerald)', desc: 'A versatile ML model capable of both linear and nonlinear decision boundaries. Used for binary classification and regression.' },
                      { title: 'Best Use Cases', color: 'var(--violet)', desc: 'Particularly well-suited for complex but small to medium-sized datasets where the margin concept provides a clear advantage.' },
                      { title: 'Support Vectors', color: 'var(--amber)', desc: 'Only the instances on the margin boundary ("support vectors") determine the decision boundary. Other training points have no effect.' },
                    ].map(item => (
                      <div key={item.title} style={{ background: `${item.color}08`, border: `1px solid ${item.color}30`, borderRadius: 6, padding: '0.9rem' }}>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', fontWeight: 700, color: item.color, marginBottom: '0.4rem' }}>{item.title}</div>
                        <p style={{ fontSize: '0.79rem', color: 'var(--text-2)', lineHeight: 1.5 }}>{item.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {l5Tab === 'Kernel Trick' && (
              <div>
                <p className="m4-sec-sub">For non-linearly separable data, the kernel trick implicitly maps inputs to a high-dimensional space where a linear boundary exists — without ever computing the full feature map.</p>
                <KernelViz />
                <div className="m4-two-col" style={{ marginTop: '0.5rem' }}>
                  <div className="m4-card">
                    <div className="m4-card-h">Polynomial Features (Explicit)</div>
                    <ul className="m4-bullets">
                      <li>Add polynomial features (e.g., x₁², x₁x₂, x₂²) to make data linearly separable</li>
                      <li>Works in principle but explodes combinatorially — degree-d with n features gives <Tex src="O(n^d)" /> new features</li>
                      <li>Very slow for large feature sets or high degrees</li>
                    </ul>
                  </div>
                  <div className="m4-card">
                    <div className="m4-card-h">The Kernel Trick (Implicit)</div>
                    <ul className="m4-bullets">
                      <li>Replace explicit feature maps with a kernel function <Tex src="K(a,b)" /></li>
                      <li>Kernel computes the dot product in high-dimensional space <em>directly</em> from original features</li>
                      <li>Never constructs the full feature vectors — avoids combinatorial explosion</li>
                      <li>Made possible by the dual problem formulation (which only needs pairwise dot products)</li>
                    </ul>
                  </div>
                </div>
                <div className="m4-card" style={{ marginTop: '0.5rem' }}>
                  <div className="m4-card-h">Similarity Features (Gaussian RBF)</div>
                  <div className="m4-flabel">Gaussian Radial Basis Function</div>
                  <Tex src="\phi_\gamma(x, l) = \exp(-\gamma\|x - l\|^2)" block />
                  <VarTable vars={[
                    ['x', 'Input instance'],
                    ['l', 'Landmark (reference point — often a support vector)'],
                    ['\\gamma', 'Controls the "reach" or bandwidth of the kernel'],
                    ['\\phi_\\gamma(x,l)', 'Similarity feature — 1 when x=l, decays to 0 with distance'],
                  ]} />
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-2)', marginTop: '0.5rem' }}>
                    Each training instance can serve as a landmark. The RBF kernel via the kernel trick achieves the same effect as adding all these similarity features — without computing them.
                  </p>
                </div>
              </div>
            )}

            {l5Tab === 'SVM Math' && (
              <div>
                <p className="m4-sec-sub">The mathematical foundations: decision function, primal objective, dual problem, hinge loss, and the four standard kernel functions.</p>
                <HingeLossViz />
                <div style={{ marginTop: '0.5rem' }}>
                  <SVMMathSection />
                </div>
              </div>
            )}

            {l5Tab === 'Complexity & Regression' && (
              <div>
                <p className="m4-sec-sub">Choosing the right SVM class depends on dataset size and whether you need the kernel trick. SVMs also extend naturally to regression tasks.</p>
                <SVMComplexityTable />
                <div style={{ marginTop: '0.5rem' }}>
                  <SVMRegressionSection />
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── DECISION TREES (L6) ── */}
        {tab === 'Decision Trees' && (
          <div>
            <div className="m4-sec-hdr">
              <h2 className="m4-sec-title">Decision Trees <span className="m4-badge" style={{ background: 'rgba(34,211,238,0.12)', color: 'var(--cyan)', border: '1px solid rgba(34,211,238,0.3)' }}>Lecture 6</span></h2>
              <p className="m4-sec-sub">Versatile white-box models for classification and regression. CART recursively partitions the feature space into axis-aligned regions. The fundamental building block of Random Forests.</p>
            </div>
            <div className="m4-labtabs">
              {L6_TABS.map(lt => (
                <button key={lt} className={`m4-labtab ${l6Tab === lt ? 'm4-labtab--on' : ''}`} onClick={() => setL6Tab(lt)}>{lt}</button>
              ))}
            </div>

            {/* ── Overview & CART ── */}
            {l6Tab === 'Overview & CART' && (
              <div>
                <p className="m4-sec-sub">The Guess Who analogy motivates why we ask the most informative questions first. CART formalises this as a greedy, top-down recursive split.</p>
                <div className="m4-two-col">
                  <div className="m4-card">
                    <div className="m4-card-h">The Guess Who Analogy</div>
                    <div className="m4-infobox" style={{ fontSize: '0.78rem' }}>
                      One player picks a character; the other guesses using yes/no questions. To win efficiently, ask the <strong>most informative</strong> questions first — the same goal as DT training.
                    </div>
                    <div className="m4-hr" />
                    <div className="m4-flabel">Dataset</div>
                    <table className="m4-ptable">
                      <thead><tr><th>Man</th><th>Long Hair</th><th>Glasses</th><th>Name</th></tr></thead>
                      <tbody>
                        <tr><td>Yes</td><td>No</td><td>Yes</td><td className="pk">Brian</td></tr>
                        <tr><td>Yes</td><td>No</td><td>No</td><td className="pk">John</td></tr>
                        <tr><td>No</td><td>Yes</td><td>No</td><td className="pk">Aphra</td></tr>
                        <tr><td>No</td><td>No</td><td>No</td><td className="pk">Aoife</td></tr>
                      </tbody>
                    </table>
                    <div className="m4-hr" />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                      <div style={{ background: 'var(--bg-3)', borderRadius: 7, padding: '0.55rem', border: '1px solid rgba(251,113,133,0.25)' }}>
                        <div style={{ fontSize: '0.67rem', fontWeight: 700, color: '#fb7185', marginBottom: '0.3rem' }}>Strategy A — Glasses first</div>
                        <div style={{ fontFamily: 'monospace', fontSize: '0.63rem', color: 'var(--text-2)', lineHeight: 1.7, whiteSpace: 'pre' }}>{`Glasses?\n├─Yes→ Brian   (1Q)\n└─No → Man?\n       ├─Yes→ John  (2Q)\n       └─No → Hair?\n              ├─Yes→ Aphra (3Q)\n              └─No → Aoife (3Q)`}</div>
                        <div style={{ marginTop: '0.4rem', fontSize: '0.68rem', color: '#fb7185' }}>Avg = (1+2+3+3)/4 = 2.25 questions</div>
                      </div>
                      <div style={{ background: 'var(--bg-3)', borderRadius: 7, padding: '0.55rem', border: '1px solid rgba(52,211,153,0.25)' }}>
                        <div style={{ fontSize: '0.67rem', fontWeight: 700, color: '#34d399', marginBottom: '0.3rem' }}>Strategy B — Man first ✓</div>
                        <div style={{ fontFamily: 'monospace', fontSize: '0.63rem', color: 'var(--text-2)', lineHeight: 1.7, whiteSpace: 'pre' }}>{`Man?\n├─Yes→ Glasses?\n│      ├─Yes→ Brian  (2Q)\n│      └─No → John   (2Q)\n└─No → Hair?\n       ├─Yes→ Aphra  (2Q)\n       └─No → Aoife   (2Q)`}</div>
                        <div style={{ marginTop: '0.4rem', fontSize: '0.68rem', color: '#34d399' }}>Avg = (2+2+2+2)/4 = 2.0 questions</div>
                      </div>
                    </div>
                    <div className="m4-infobox" style={{ marginTop: '0.6rem', fontSize: '0.75rem' }}>
                      "Is it a man?" is more informative because it splits the group into two perfectly equal halves — maximising information gain per question.
                    </div>
                  </div>

                  <div className="m4-card">
                    <div className="m4-card-h">DT Terminology</div>
                    <table className="m4-ptable" style={{ marginBottom: '0.7rem' }}>
                      <tbody>
                        <tr><td className="pk">Root node</td><td>Topmost split — the first question asked</td></tr>
                        <tr><td className="pk">Split / internal node</td><td>Non-leaf node with a split condition X_j ≤ t_j. Left branch = True (≤), right = False ({'>'}).</td></tr>
                        <tr><td className="pk">Branch</td><td>Edge connecting parent to child node</td></tr>
                        <tr><td className="pk">Leaf / terminal node</td><td>End node — contains the prediction (class or value)</td></tr>
                        <tr><td className="pk">samples</td><td>Number of training instances reaching this node</td></tr>
                        <tr><td className="pk">value</td><td>Count of training instances per class at this node</td></tr>
                        <tr><td className="pk">gini</td><td>Impurity measure for this node (0 = pure)</td></tr>
                        <tr><td className="pk">class</td><td>Majority class at this node (classification)</td></tr>
                      </tbody>
                    </table>
                    <div className="m4-flabel">Making Predictions</div>
                    <ol style={{ paddingLeft: '1.2rem', fontSize: '0.77rem', color: 'var(--text-1)', lineHeight: 1.75 }}>
                      <li>Start at the root node</li>
                      <li>At each split node, go <strong>left</strong> if condition is True, <strong>right</strong> if False</li>
                      <li>The class (or value) of the reached leaf node is the prediction</li>
                    </ol>
                    <div className="m4-hr" />
                    <div className="m4-flabel">Iris DT (depth=2) — node structure</div>
                    <div style={{ fontFamily: 'monospace', fontSize: '0.63rem', color: 'var(--text-1)', lineHeight: 1.85, background: 'var(--bg-3)', borderRadius: 6, padding: '0.55rem 0.7rem', border: '1px solid rgba(34,211,238,0.12)' }}>
                      {`[petal length ≤ 2.45]  gini=0.667  n=150\n├─True → setosa   gini=0.0  n=50  ← LEAF\n└─False→ [petal width ≤ 1.75]  gini=0.5  n=100\n         ├─True → versicolor gini=0.168  n=54  ← LEAF\n         └─False→ virginica  gini=0.043  n=46  ← LEAF`}
                    </div>
                    <div className="m4-infobox" style={{ marginTop: '0.6rem', fontSize: '0.74rem' }}>
                      <strong>White-box model:</strong> Follow the path from root to leaf — every prediction is fully human-readable. Contrast with Random Forests and Neural Networks (black boxes).
                    </div>
                  </div>
                </div>

                <div className="m4-card" style={{ marginTop: '0.75rem' }}>
                  <div className="m4-card-h">The CART Training Algorithm</div>
                  <div className="m4-two-col">
                    <div>
                      <div className="m4-infobox" style={{ marginBottom: '0.65rem', fontSize: '0.78rem' }}>
                        <strong>CART</strong> = Classification And Regression Trees. Recursively divides the feature space into <em>J</em> distinct non-overlapping rectangular regions R₁ … R_J.
                      </div>
                      <table className="m4-ptable" style={{ marginBottom: '0.6rem' }}>
                        <thead><tr><th>Property</th><th>Meaning</th></tr></thead>
                        <tbody>
                          <tr><td className="pk">Top-down</td><td>Starts at root; recurses downward into children</td></tr>
                          <tr><td className="pk">Greedy</td><td>Each split is locally optimal; globally optimal tree is NP-hard</td></tr>
                          <tr><td className="pk">Binary splits</td><td>Each node always splits into exactly 2 children</td></tr>
                          <tr><td className="pk">Axis-aligned</td><td>Splits are always of the form X_j ≤ t_j</td></tr>
                        </tbody>
                      </table>
                      <div className="m4-flabel">CART Cost — Classification</div>
                      <Tex src="J(X_j, t_j) = \frac{m_\text{left}}{m} G_\text{left} + \frac{m_\text{right}}{m} G_\text{right}" block />
                      <VarTable vars={[
                        ['m_\\text{left},\\ m_\\text{right}', 'Number of instances in the left and right subsets after splitting'],
                        ['m', 'Total instances at the current node'],
                        ['G_\\text{left},\\ G_\\text{right}', 'Gini impurity of each subset'],
                        ['J(X_j, t_j)', 'Weighted impurity cost for feature X_j at threshold t_j — minimise this to find the best split'],
                      ]} />
                    </div>
                    <div>
                      <div className="m4-flabel">Algorithm Steps</div>
                      <div className="m4-pseudocode">
                        <span className="kw">At current node with data subset S:</span>{'\n'}
                        <span className="num"> 1.</span> <span className="kw">for</span> each feature Xⱼ and threshold tⱼ:{'\n'}
                        <span className="num">   </span>   S_left  = {'{'} x∈S | Xⱼ ≤ tⱼ {'}'}{'\n'}
                        <span className="num">   </span>   S_right = {'{'} x∈S | Xⱼ {'>'} tⱼ {'}'}{'\n'}
                        <span className="num">   </span>   compute cost J(Xⱼ, tⱼ){'\n'}
                        <span className="num"> 2.</span> choose (Xⱼ, tⱼ) that <span className="kw">minimises</span> J{'\n'}
                        <span className="num"> 3.</span> create left child with S_left{'\n'}
                        <span className="num">   </span> create right child with S_right{'\n'}
                        <span className="num"> 4.</span> <span className="kw">recurse</span> on each child{'\n'}
                        <span className="num"> 5.</span> <span className="kw">stop when:</span>{'\n'}
                        <span className="num">   </span>   − cannot reduce impurity further, OR{'\n'}
                        <span className="num">   </span>   − stopping condition met (e.g. max_depth)
                      </div>
                      <div className="m4-hr" />
                      <div className="m4-flabel">Computational Complexity</div>
                      <table className="m4-ptable">
                        <thead><tr><th>Operation</th><th>Complexity</th><th>Notes</th></tr></thead>
                        <tbody>
                          <tr><td className="pk">Prediction</td><td>O(log₂ m)</td><td>Traverse root-to-leaf; independent of n features</td></tr>
                          <tr><td className="pk">Training</td><td>O(nm log₂ m)</td><td>All n features × m samples at each level</td></tr>
                        </tbody>
                      </table>
                      <div className="m4-infobox" style={{ marginTop: '0.5rem', fontSize: '0.74rem' }}>
                        Predictions are very fast even on large datasets. Training is the expensive part — sorting each feature at each level.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── Impurity Measures ── */}
            {l6Tab === 'Impurity Measures' && (
              <div>
                <p className="m4-sec-sub">Gini impurity and entropy both measure how mixed a node's class distribution is. Either can be used as the CART cost criterion.</p>
                <div className="m4-two-col">
                  <div className="m4-card">
                    <div className="m4-card-h">Gini Impurity</div>
                    <Tex src="G_i = 1 - \sum_{k=1}^{n} p_{i,k}^2" block />
                    <VarTable vars={[
                      ['G_i', 'Gini impurity of node i — ranges from 0 (pure) to 0.5 (perfectly mixed, 2 classes)'],
                      ['p_{i,k}', 'Fraction of class k instances among all training instances at node i'],
                      ['n', 'Number of classes'],
                    ]} />
                    <div className="m4-hr" />
                    <div className="m4-flabel">Worked examples</div>
                    <table className="m4-ptable">
                      <thead><tr><th>Node composition</th><th>Calculation</th><th>G</th></tr></thead>
                      <tbody>
                        <tr><td>100% one class</td><td>1 − 1² = 0</td><td className="pk">0.0 (pure)</td></tr>
                        <tr><td>50/50 two classes</td><td>1 − (0.5² + 0.5²)</td><td className="pk">0.5 (max)</td></tr>
                        <tr><td>49/54 vs 5/54 (Iris example)</td><td>1 − (0.907² + 0.093²)</td><td className="pk">0.168</td></tr>
                        <tr><td>0/50 vs 50/50 (setosa leaf)</td><td>1 − (1.0²)</td><td className="pk">0.0</td></tr>
                      </tbody>
                    </table>
                    <div className="m4-hr" />
                    <div className="m4-flabel">Estimating class probabilities</div>
                    <div style={{ fontSize: '0.77rem', color: 'var(--text-1)', lineHeight: 1.65, marginBottom: '0.5rem' }}>
                      Leaf <code>value</code> arrays give class counts, normalised to probabilities.
                    </div>
                    <div style={{ background: 'var(--bg-3)', borderRadius: 6, padding: '0.45rem 0.6rem', fontFamily: 'monospace', fontSize: '0.67rem', color: 'var(--text-2)', marginBottom: '0.5rem' }}>
                      {'Leaf: value = [0, 49, 5],  samples = 54\nP(setosa)     = 0/54 = 0.000\nP(versicolor) = 49/54 = 0.907\nP(virginica)  = 5/54  = 0.093\n→ predict: versicolor'}
                    </div>
                    <div style={{ background: 'var(--bg-3)', borderRadius: 6, padding: '0.45rem 0.6rem', fontFamily: 'monospace', fontSize: '0.67rem', color: 'var(--text-2)' }}>
                      {'>>> tree_clf.predict_proba([[5, 1.5]])\narray([[ 0., 0.9074, 0.0926 ]])\n>>> tree_clf.predict([[5, 1.5]])\narray([1])   # 1 = versicolor'}
                    </div>
                  </div>

                  <div className="m4-card">
                    <div className="m4-card-h">Entropy</div>
                    <Tex src="H_i = -\sum_{\substack{k=1 \\ p_{i,k} \neq 0}}^{n} p_{i,k} \log_2(p_{i,k})" block />
                    <VarTable vars={[
                      ['H_i', 'Entropy of node i — 0 when pure, log₂(n) at maximum disorder (uniform distribution)'],
                      ['p_{i,k}', 'Fraction of class k instances at node i'],
                      ['\\log_2(p_{i,k})', 'Log base 2 — gives entropy in bits; p log p excluded when p=0 (defined as 0 by continuity)'],
                    ]} />
                    <div className="m4-hr" />
                    <div className="m4-flabel">Iris depth-2 left node — entropy calculation</div>
                    <Tex src="H = -\tfrac{49}{54}\log_2\!\left(\tfrac{49}{54}\right) - \tfrac{5}{54}\log_2\!\left(\tfrac{5}{54}\right) \approx 0.445" block />
                    <div className="m4-hr" />
                    <div className="m4-flabel">Gini vs Entropy Comparison</div>
                    <table className="m4-ptable">
                      <thead><tr><th>Criterion</th><th>Speed</th><th>Tree Shape</th><th>Use Case</th></tr></thead>
                      <tbody>
                        <tr>
                          <td className="pk">Gini (default)</td>
                          <td>Faster</td>
                          <td>Tends to isolate most frequent class in its own branch</td>
                          <td>Good default; use most of the time</td>
                        </tr>
                        <tr>
                          <td className="pk">Entropy</td>
                          <td>Slightly slower</td>
                          <td>Produces more balanced trees</td>
                          <td>When tree balance matters</td>
                        </tr>
                      </tbody>
                    </table>
                    <div className="m4-infobox" style={{ marginTop: '0.65rem', fontSize: '0.75rem' }}>
                      In practice they produce <strong>very similar</strong> trees — the choice rarely makes a significant difference to model quality. Set with: <code>DecisionTreeClassifier(criterion="entropy")</code>
                    </div>
                    <div className="m4-hr" />
                    <div className="m4-flabel">Decision boundaries (Iris, depth=2)</div>
                    <div style={{ fontFamily: 'monospace', fontSize: '0.62rem', color: 'var(--text-1)', lineHeight: 1.85, background: 'var(--bg-3)', borderRadius: 6, padding: '0.55rem 0.7rem', border: '1px solid rgba(34,211,238,0.12)' }}>
                      {`Petal width (cm)\n3.0 |[ setosa   ]|[     virginica              ]\n    |            |                   :\n1.75|            |-------------------:-------  ← Depth=1\n    |            |[  versicolor      :       ]\n0.0 |            |                   :\n    +─────────────┼───────────────────:───────\n    0            2.45               5.0\n              ↑ Depth=0         (Depth=2)\n          petal length (cm)`}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── Regularisation ── */}
            {l6Tab === 'Regularisation' && (
              <div>
                <p className="m4-sec-sub">Decision Trees are nonparametric models prone to overfitting. Regularisation hyperparameters control tree complexity. Cost-complexity pruning offers a principled post-training approach.</p>
                <div className="m4-two-col">
                  <div className="m4-card">
                    <div className="m4-card-h">Regularisation Hyperparameters</div>
                    <div className="m4-infobox" style={{ marginBottom: '0.65rem', fontSize: '0.78rem' }}>
                      DTs are <strong>nonparametric models</strong> — they make few assumptions and adapt freely. Without constraints they perfectly memorise training data. A smaller tree has higher bias but lower variance and usually generalises better.
                    </div>
                    <table className="m4-ptable">
                      <thead><tr><th>Hyperparameter</th><th>Effect</th><th>Direction</th></tr></thead>
                      <tbody>
                        <tr><td className="pk">max_depth</td><td>Maximum depth of the tree</td><td>↓ reduces overfitting</td></tr>
                        <tr><td className="pk">min_samples_split</td><td>Min samples required to split a node</td><td>↑ reduces overfitting</td></tr>
                        <tr><td className="pk">min_samples_leaf</td><td>Min samples required at a leaf node</td><td>↑ reduces overfitting</td></tr>
                        <tr><td className="pk">min_weight_fraction_leaf</td><td>Min weighted fraction at a leaf</td><td>↑ reduces overfitting</td></tr>
                        <tr><td className="pk">max_leaf_nodes</td><td>Maximum number of leaf nodes</td><td>↓ reduces overfitting</td></tr>
                        <tr><td className="pk">max_features</td><td>Features considered per split</td><td>↓ reduces overfitting</td></tr>
                      </tbody>
                    </table>
                    <div className="m4-infobox" style={{ marginTop: '0.65rem', fontSize: '0.75rem' }}>
                      <strong>Rule of thumb:</strong> Increasing <code>min_*</code> or decreasing <code>max_*</code> hyperparameters <em>regularises</em> the model — restricts the tree's freedom to memorise.
                    </div>
                  </div>

                  <div className="m4-card">
                    <div className="m4-card-h">Cost-Complexity Pruning</div>
                    <div style={{ fontSize: '0.77rem', color: 'var(--text-1)', lineHeight: 1.65, marginBottom: '0.6rem' }}>
                      Grow a full tree T₀, then prune to find the optimal subtree. For tuning parameter α ≥ 0, minimise:
                    </div>
                    <Tex src="\sum_{l=1}^{|T|} \sum_{x_i \in R_l} (y_i - \hat{y}_{R_l})^2 + \alpha |T|" block />
                    <VarTable vars={[
                      ['|T|', 'Number of terminal (leaf) nodes — the complexity penalty term'],
                      ['R_l', 'The rectangular region for the l-th leaf node'],
                      ['\\hat{y}_{R_l}', 'Mean response of training instances in region R_l'],
                      ['\\alpha', 'Complexity penalty — larger α favours simpler (smaller) trees'],
                    ]} />
                    <div className="m4-hr" />
                    <table className="m4-ptable" style={{ marginBottom: '0.6rem' }}>
                      <thead><tr><th>α value</th><th>Effect</th></tr></thead>
                      <tbody>
                        <tr><td className="pk">α = 0</td><td>T = T₀ — no penalty, full training error minimisation</td></tr>
                        <tr><td className="pk">α increasing</td><td>Penalises complexity → smaller subtrees preferred</td></tr>
                        <tr><td className="pk">α → ∞</td><td>Single-node tree (just the root)</td></tr>
                      </tbody>
                    </table>
                    <div className="m4-flabel">Pruning steps</div>
                    <ol style={{ paddingLeft: '1.2rem', fontSize: '0.76rem', color: 'var(--text-1)', lineHeight: 1.75 }}>
                      <li>Build full regression tree T₀ on training data</li>
                      <li>Vary α to generate subtrees with decreasing |T|</li>
                      <li>Use k-fold cross-validation to estimate validation error per α</li>
                      <li>Select α that minimises average CV error</li>
                      <li>Return the corresponding subtree</li>
                    </ol>
                    <div className="m4-warnbox" style={{ marginTop: '0.65rem', fontSize: '0.74rem' }}>
                      The cross-validation error is often minimised at surprisingly small trees — the bias/variance trade-off strongly favours simpler models on unseen data.
                    </div>
                  </div>
                </div>

                <div className="m4-card" style={{ marginTop: '0.75rem' }}>
                  <div className="m4-card-h">Baseball Example — Unpruned vs Pruned</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div>
                      <div className="m4-flabel">Unpruned tree (12 leaf nodes)</div>
                      <div style={{ fontFamily: 'monospace', fontSize: '0.62rem', color: 'var(--text-1)', lineHeight: 1.8, background: 'var(--bg-3)', borderRadius: 6, padding: '0.55rem 0.7rem', border: '1px solid rgba(251,113,133,0.2)' }}>
                        {`Years < 4.5\n├─ RBI < 60.5\n│  ├─ Putouts < 82\n│  │  ├─ 5.487\n│  │  └─ Years < 3.5\n│  │     ├─ 4.622\n│  │     └─ 5.183\n│  └─ Years < 3.5\n│     ├─ 5.394\n│     └─ 6.189\n└─ Hits < 117.5\n   ├─ Walks < 43.5\n   │  ├─ Runs < 47.5\n   │  │  ├─ 6.015  └─ 5.571\n   │  └─ 6.407\n   └─ Walks < 52.5\n      ├─ 6.549\n      └─ ...`}
                      </div>
                    </div>
                    <div>
                      <div className="m4-flabel">Pruned tree (3 leaf nodes) ← CV-optimal</div>
                      <div style={{ fontFamily: 'monospace', fontSize: '0.67rem', color: 'var(--text-1)', lineHeight: 1.9, background: 'var(--bg-3)', borderRadius: 6, padding: '0.55rem 0.7rem', border: '1px solid rgba(52,211,153,0.2)' }}>
                        {`Years < 4.5\n├─ 5.11   ← Inexperienced\n└─ Hits < 117.5\n   ├─ 6.00  ← Exp, avg hitter\n   └─ 6.74  ← Exp, good hitter`}
                      </div>
                      <div className="m4-infobox" style={{ marginTop: '0.5rem', fontSize: '0.74rem' }}>
                        CV error bottoms out at ~3 leaves. The unpruned 12-leaf tree overfits — the extra splits capture noise, not signal.
                      </div>
                      <div className="m4-flabel" style={{ marginTop: '0.6rem' }}>Predictions (back from log scale)</div>
                      <table className="m4-ptable">
                        <tbody>
                          <tr><td className="pk">R1 (inexperienced)</td><td>log=5.11 → ~$165k/yr</td></tr>
                          <tr><td className="pk">R2 (exp, avg)</td><td>log=6.00 → ~$403k/yr</td></tr>
                          <tr><td className="pk">R3 (exp, good)</td><td>log=6.74 → ~$845k/yr</td></tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── Regression Trees ── */}
            {l6Tab === 'Regression Trees' && (
              <div>
                <p className="m4-sec-sub">Decision Trees extend naturally to regression by predicting the mean response in each region. CART minimises a weighted MSE cost instead of Gini impurity.</p>
                <div className="m4-two-col">
                  <div className="m4-card">
                    <div className="m4-card-h">CART Cost — Regression</div>
                    <Tex src="J(X_j, t_j) = \frac{m_\text{left}}{m} \text{MSE}_\text{left} + \frac{m_\text{right}}{m} \text{MSE}_\text{right}" block />
                    <div className="m4-flabel" style={{ marginTop: '0.6rem' }}>Node MSE and prediction</div>
                    <Tex src="\text{MSE}_\text{node} = \frac{1}{m_\text{node}} \sum_{i \in \text{node}} \left(\hat{y}_\text{node} - y^{(i)}\right)^2" block />
                    <Tex src="\hat{y}_\text{node} = \frac{1}{m_\text{node}} \sum_{i \in \text{node}} y^{(i)}" block />
                    <VarTable vars={[
                      ['\\hat{y}_\\text{node}', 'Predicted value for this node — the mean of all training targets in this region'],
                      ['y^{(i)}', 'Actual target value for training instance i'],
                      ['m_\\text{node}', 'Number of training instances in this node'],
                      ['\\text{MSE}_\\text{node}', 'Mean squared error of the node\'s constant prediction against all instances in it'],
                    ]} />
                    <div className="m4-hr" />
                    <div className="m4-flabel">Effect of depth on regression</div>
                    <table className="m4-ptable">
                      <thead><tr><th>max_depth</th><th>Step resolution</th><th>Tendency</th></tr></thead>
                      <tbody>
                        <tr><td className="pk">2</td><td>3–4 coarse steps</td><td>Underfitting</td></tr>
                        <tr><td className="pk">3</td><td>7–8 finer steps</td><td>Better fit</td></tr>
                        <tr><td className="pk">None</td><td>Memorises every point</td><td>Overfitting</td></tr>
                      </tbody>
                    </table>
                    <div className="m4-infobox" style={{ marginTop: '0.5rem', fontSize: '0.74rem' }}>
                      Training objective: <strong>minimise MSE across all leaf nodes</strong>. The tree produces a piecewise-constant step function over the feature space.
                    </div>
                  </div>

                  <div className="m4-card">
                    <div className="m4-card-h">Hitters Dataset — Baseball Example</div>
                    <div className="m4-infobox" style={{ fontSize: '0.77rem', marginBottom: '0.6rem' }}>
                      <strong>Task:</strong> Predict log(Salary) from <em>Years</em> (years in major leagues) and <em>Hits</em> (hits in 1986). MLB data, 1986–1987 seasons.
                    </div>
                    <div className="m4-flabel">Tree structure (depth=2)</div>
                    <div style={{ fontFamily: 'monospace', fontSize: '0.63rem', color: 'var(--text-1)', lineHeight: 1.85, background: 'var(--bg-3)', borderRadius: 6, padding: '0.55rem 0.7rem', marginBottom: '0.6rem', border: '1px solid rgba(34,211,238,0.12)' }}>
                      {`              [Years < 4.5]\n             /             \\\n          5.11          [Hits < 117.5]\n        (leaf: R1)       /             \\\n                      6.00            6.74\n                    (leaf: R2)      (leaf: R3)`}
                    </div>
                    <div className="m4-flabel">Feature space partition</div>
                    <div style={{ fontFamily: 'monospace', fontSize: '0.61rem', color: 'var(--text-1)', lineHeight: 1.8, background: 'var(--bg-3)', borderRadius: 6, padding: '0.55rem 0.7rem', marginBottom: '0.6rem', border: '1px solid rgba(167,139,250,0.12)' }}>
                      {`Hits (y-axis)\n238 |──────────┬──────────────────────────\n    |    R1    |           R3\n    |          |\n117.5|          |──────────────────────────\n    |          |           R2\n  1 |──────────┴──────────────────────────\n    1         4.5                        24\n                       Years (x-axis)`}
                    </div>
                    <div className="m4-flabel">Interpretation</div>
                    <table className="m4-ptable">
                      <tbody>
                        <tr><td className="pk">R1</td><td>Years {'<'} 4.5 — <strong>Inexperienced</strong> players</td></tr>
                        <tr><td className="pk">R2</td><td>Years ≥ 4.5 AND Hits {'<'} 117.5 — experienced, average hitters</td></tr>
                        <tr><td className="pk">R3</td><td>Years ≥ 4.5 AND Hits ≥ 117.5 — experienced, good hitters</td></tr>
                      </tbody>
                    </table>
                    <div style={{ marginTop: '0.5rem' }}>
                      <div style={{ background: 'var(--bg-3)', borderRadius: 6, padding: '0.45rem 0.6rem', fontFamily: 'monospace', fontSize: '0.66rem', color: 'var(--text-2)' }}>
                        {'from sklearn.tree import DecisionTreeRegressor\ntree_reg = DecisionTreeRegressor(max_depth=2)\ntree_reg.fit(X, y)  # X = [[Years, Hits]], y = log(Salary)'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── Limitations ── */}
            {l6Tab === 'Limitations' && (
              <div>
                <p className="m4-sec-sub">Decision Trees have three key limitations. Understanding them motivates the mitigations and the move to ensemble methods like Random Forests.</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  {[
                    {
                      title: '1. Prone to Overfitting',
                      col: '#fb7185',
                      problem: 'Without regularisation, DTs perfectly memorise training data — creating highly jagged, complex step functions that fit training noise.',
                      analogy: 'Like a student who memorises every past exam question verbatim but cannot apply the underlying concept to a slightly different problem.',
                      fix: 'Regularisation hyperparameters (max_depth, min_samples_leaf, etc.) or cost-complexity pruning with cross-validated α.',
                    },
                    {
                      title: '2. Sensitivity to Rotation',
                      col: '#fbbf24',
                      problem: 'DTs only create axis-aligned splits (X_j ≤ t_j). They cannot represent diagonal boundaries naturally — rotating the training data produces a very different tree.',
                      analogy: 'Cutting a diagonal sandwich with only horizontal and vertical cuts — you need many jagged steps to approximate a diagonal line.',
                      fix: 'Apply PCA before fitting to align features with the most informative axes. This can simplify the resulting tree dramatically.',
                    },
                    {
                      title: '3. High Variance',
                      col: '#a78bfa',
                      problem: 'Small changes to hyperparameters or re-training with a different random seed → very different tree structure. The model is unstable.',
                      analogy: 'Two people playing the same game of Guess Who might choose completely different optimal question sequences — both are locally reasonable but globally diverge.',
                      fix: 'Random Forests: average many trees trained on bootstrap samples and random feature subsets. Variance averages out; bias stays low.',
                    },
                  ].map(({ title, col, problem, analogy, fix }) => (
                    <div key={title} style={{ background: 'var(--bg-2)', borderRadius: 10, padding: '0.9rem', border: `1px solid ${col}33` }}>
                      <div style={{ fontSize: '0.82rem', fontWeight: 700, color: col, marginBottom: '0.5rem', fontFamily: 'monospace' }}>{title}</div>
                      <div style={{ fontSize: '0.73rem', color: 'var(--text-1)', lineHeight: 1.6, marginBottom: '0.45rem' }}>{problem}</div>
                      <div style={{ background: `${col}0d`, borderRadius: 6, padding: '0.4rem 0.55rem', marginBottom: '0.45rem' }}>
                        <div style={{ fontSize: '0.63rem', fontWeight: 700, color: col, marginBottom: '0.2rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Analogy</div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-2)', lineHeight: 1.5 }}>{analogy}</div>
                      </div>
                      <div style={{ background: 'rgba(52,211,153,0.08)', borderRadius: 6, padding: '0.4rem 0.55rem', border: '1px solid rgba(52,211,153,0.2)' }}>
                        <div style={{ fontSize: '0.63rem', fontWeight: 700, color: '#34d399', marginBottom: '0.2rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Mitigation</div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-2)', lineHeight: 1.5 }}>{fix}</div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="m4-card">
                  <div className="m4-card-h">Decision Trees vs Linear Models</div>
                  <div className="m4-two-col">
                    <div>
                      <table className="m4-ptable">
                        <thead><tr><th>Scenario</th><th>Better model</th></tr></thead>
                        <tbody>
                          <tr><td>Relationship between features and target is approximately <strong>linear</strong></td><td className="pk">Linear regression / logistic regression</td></tr>
                          <tr><td>Relationship is <strong>non-linear or complex</strong></td><td className="pk">Decision Tree (or ensemble)</td></tr>
                          <tr><td>Feature interpretability and explainability required</td><td className="pk">Decision Tree (white box)</td></tr>
                          <tr><td>Low variance / high stability required</td><td className="pk">Random Forest (ensemble of trees)</td></tr>
                        </tbody>
                      </table>
                    </div>
                    <div>
                      <div className="m4-flabel">Decision Trees — Summary</div>
                      <div style={{ fontFamily: 'monospace', fontSize: '0.63rem', color: 'var(--text-1)', lineHeight: 1.9, background: 'var(--bg-3)', borderRadius: 6, padding: '0.6rem 0.75rem', border: '1px solid rgba(34,211,238,0.12)' }}>
                        {`Decision Trees\n│\n├── CART: greedy, top-down, binary, axis-aligned\n│   ├── Classification cost: weighted Gini (or entropy)\n│   └── Regression cost:     weighted MSE\n│\n├── Gini: G = 1 − Σp²         (default)\n│   Entropy: H = −Σp log₂(p)   (balanced)\n│\n├── Complexity\n│   ├── Predict: O(log₂ m) ← very fast\n│   └── Train:  O(nm log₂ m)\n│\n├── Regularise: max_depth, min_samples_leaf,\n│   max_leaf_nodes, cost-complexity α\n│\n└── Limits: overfitting, rotation sensitivity,\n    high variance → mitigate with Random Forests`}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── ASSIGNMENT 1 ── */}
        {tab === 'Assignment 1' && (
          <div>
            <div className="m4-sec-hdr">
              <h2 className="m4-sec-title">Assignment 1 <span className="m4-badge" style={{ background: 'rgba(34,211,238,0.12)', color: 'var(--cyan)', border: '1px solid rgba(34,211,238,0.3)' }}>CITS5508 · Softmax Regression · MNIST</span></h2>
              <p className="m4-sec-sub">From raw pixels to a trained softmax classifier — covering MNIST, data splits, the full from-scratch implementation, comparison with sklearn's L-BFGS solver, and the fundamental limits of linear classification.</p>
            </div>
            <div className="m4-labtabs">
              {ASGN1_TABS.map(lt => (
                <button key={lt} className={`m4-labtab ${asgn1Tab === lt ? 'm4-labtab--on' : ''}`} onClick={() => setAsgn1Tab(lt)}>{lt}</button>
              ))}
            </div>
            {asgn1Tab === 'MNIST & Classification' && <Asgn1Sec1_MNIST />}
            {asgn1Tab === 'Data Splits' && <Asgn1Sec2_Splits />}
            {asgn1Tab === 'Softmax from Scratch' && <Asgn1Sec3_Softmax />}
            {asgn1Tab === 'sklearn Comparison' && <Asgn1Sec4_Sklearn />}
            {asgn1Tab === 'Linear vs Non-Linear' && <Asgn1Sec5_Linear />}
          </div>
        )}

        {/* ── QUIZ ── */}
        {tab === 'Quiz' && (
          <div>
            <div className="m4-sec-hdr">
              <h2 className="m4-sec-title">Knowledge Check <span className="m4-badge" style={{ background: 'rgba(34,211,238,0.12)', color: 'var(--cyan)', border: '1px solid rgba(34,211,238,0.3)' }}>20 Questions · Lectures 1–6</span></h2>
              <p className="m4-sec-sub">Covering: Mitchell's E/T/P, supervised/unsupervised, bias trick, MSE vs MAE, confusion matrix, Normal Equation, gradient descent variants, logistic regression, Ridge/Lasso, kNN, and SVMs. Detailed feedback on every answer.</p>
            </div>
            <QuizSection />
          </div>
        )}

      </main>
    </div>
  );
}
