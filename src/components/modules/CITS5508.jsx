import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
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
    lec: 'Lec 8 · PCA',
    q: 'PCA reduces a dataset from n to d dimensions. What does it actually optimise when choosing the projection?',
    opts: [
      'It minimises the number of features regardless of information',
      'It finds the axes that preserve the maximum variance of the data',
      'It maximises the correlation between features',
      'It maximises classification accuracy on the labels',
    ],
    ans: 1,
    ok: 'PCA finds the hyperplane closest to the data and projects onto it, choosing principal axes that preserve as much variance as possible. It is unsupervised — labels are never used.',
    ng: 'PCA is an unsupervised, variance-preserving linear projection: the 1st principal axis is the direction of largest variance, the 2nd is orthogonal with the next largest, and so on.',
  },
  {
    lec: 'Lec 8 · Choosing d',
    q: 'You run PCA() then compute cumsum of explained_variance_ratio_. To keep 95% of the variance you use d = np.argmax(cumsum >= 0.95) + 1. Why the + 1?',
    opts: [
      'To skip the first (largest) component',
      'Because argmax returns a 0-based index, so +1 converts it to a count of components',
      'To always keep one extra component for safety',
      'Because cumsum starts at 1.0',
    ],
    ans: 1,
    ok: 'argmax returns the 0-based index of the first dimension whose cumulative variance reaches 95%; adding 1 turns that index into the number of components to keep. (Equivalently: PCA(n_components=0.95).)',
    ng: 'argmax gives a 0-based index; +1 converts it to a component count. The one-liner PCA(n_components=0.95) does the same thing.',
  },
  {
    lec: 'Lec 8 · Kernel PCA',
    q: 'Two concentric circles are not linearly separable in 2D. How does RBF Kernel PCA help?',
    opts: [
      'It deletes the inner circle',
      'It implicitly maps the data to a higher-dimensional space where a linear method can separate the rings, then projects back to a few components',
      'It rotates the 2D plane until the circles separate',
      'It standardises the two features',
    ],
    ans: 1,
    ok: 'The kernel trick implicitly maps instances to a high-dimensional feature space, where the rings become linearly separable; Kernel PCA performs this nonlinear projection (RBF train 1.0 / test 0.988 in the example).',
    ng: 'No rotation of the 2D plane can separate nested rings. RBF Kernel PCA implicitly lifts the data to high dimensions where a linear boundary works.',
  },
  {
    lec: 'Lec 9 · K-Means',
    q: 'After running KMeans, kmeans.transform(X_new) returns what — and what kind of clustering does it enable?',
    opts: [
      'The hard cluster label of each instance (hard clustering)',
      'The Euclidean distance from each instance to every centroid — enabling soft clustering',
      'The probability that the model is correct',
      'The updated centroid coordinates',
    ],
    ans: 1,
    ok: 'transform() gives the distance from each instance to all k centroids (an m×k matrix), which is a soft-clustering score. fit_predict()/labels_ give the hard assignment.',
    ng: 'labels_ / fit_predict give hard assignments; transform() returns the m×k distances to every centroid, used for soft clustering.',
  },
  {
    lec: 'Lec 9 · Choosing k',
    q: 'Which statement about the elbow method and silhouette score for choosing k is correct?',
    opts: [
      'Inertia has a clear minimum at the best k, so just minimise it',
      'Inertia falls monotonically with k, so you look for an elbow; the silhouette score (b−a)/max(a,b) is often a more reliable criterion',
      'The silhouette score should be minimised',
      'Both methods require the true labels',
    ],
    ans: 1,
    ok: 'Inertia always decreases with k (0 at k=m), so it has no useful minimum — you look for the elbow. The silhouette score is bounded in [−1,1], is maximised at good k, and needs no labels.',
    ng: 'Inertia keeps dropping with k, so minimising it fails. Use the elbow, or maximise the (unsupervised) silhouette score s = (b−a)/max(a,b).',
  },
  {
    lec: 'Lec 9 · DBSCAN',
    q: 'In DBSCAN, increasing eps from 0.05 to 0.20 on the moons dataset changed the number of anomalies from 84 to 0. Why?',
    opts: [
      'Larger eps removes points from the dataset',
      'Larger eps enlarges each ε-neighbourhood, so more points reach min_samples and become core/border instead of noise — but distinct clusters may wrongly merge',
      'Larger eps increases min_samples automatically',
      'eps has no effect on anomalies',
    ],
    ans: 1,
    ok: 'A bigger ε means bigger neighbourhoods, so more points meet the min_samples density and get absorbed into clusters as core/border, leaving fewer anomalies — at the risk of merging separate clusters.',
    ng: 'ε sets the neighbourhood radius. Larger ε → denser neighbourhoods → fewer −1 anomalies, but separate clusters can merge incorrectly.',
  },
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
  {
    lec: 'Lec 7 · Hard vs Soft Voting',
    q: "Three classifiers output P(class A) = [0.51, 0.49, 0.95]. What does hard voting predict, what does soft voting predict, and why might soft voting be preferred?",
    opts: [
      'Both predict A; soft voting is just slower so hard voting is preferred',
      'Hard voting → A (2 vs 1). Soft voting → A (avg = 0.65). Soft voting weights confident predictions more heavily, often outperforming hard voting',
      'Hard voting → B (the 0.49 outranks the others). Soft voting → A. They disagree because soft voting is wrong',
      'Hard voting is undefined with three classifiers; soft voting picks B',
    ],
    ans: 1,
    ok: 'Hard vote: thresholding at 0.5 gives [A, B, A] — A wins 2:1. Soft vote: avg(0.51, 0.49, 0.95) = 0.65 — A wins. Soft voting carries the 0.95 confidence into the aggregate; hard voting throws it away (it counts the same as a 0.51).',
    ng: 'Soft voting averages the probabilities so highly confident classifiers exert more influence. Hard voting is binary majority — it loses the magnitude of confidence. With well-calibrated probabilities, soft voting usually wins.',
  },
  {
    lec: 'Lec 7 · Bagging & OOB',
    q: 'Bagging samples m instances with replacement from a training set of size m. What fraction of unique instances ends up in the bag, and what is the rest called?',
    opts: [
      '~50% are sampled; the rest are called the validation set',
      '~63.2% are sampled (1 − 1/e); the remaining ~36.8% are out-of-bag (OOB) instances and act as a free validation set',
      '100% are sampled — every instance must appear at least once with replacement',
      '~80% are sampled; the rest are reserved for early stopping',
    ],
    ans: 1,
    ok: 'P(instance never picked in m draws with replacement) = (1 − 1/m)^m → 1/e ≈ 0.368 as m → ∞. So ≈ 63.2% appear in the bag (with multiplicity) and ≈ 36.8% are OOB. Each predictor gets its own OOB set used to compute oob_score_ — no extra holdout needed.',
    ng: 'OOB ratio comes from (1 − 1/m)^m → 1/e ≈ 0.368. The unsampled instances form a per-predictor validation set; sklearn computes oob_score_ when you set oob_score=True.',
  },
  {
    lec: 'Lec 7 · Random Forest vs Bagging',
    q: 'A `RandomForestClassifier(max_features=2)` and a `BaggingClassifier(DecisionTreeClassifier(), max_features=2)` both restrict each tree to 2 features. What is the key difference?',
    opts: [
      'They are identical — RandomForest is a wrapper around BaggingClassifier with the same behaviour',
      'BaggingClassifier picks 2 features once and fixes them per tree; RandomForestClassifier picks a fresh random subset of 2 features at every node split — much greater diversity',
      'RandomForest does not bootstrap samples; BaggingClassifier does',
      'BaggingClassifier uses entropy by default; RandomForest uses Gini',
    ],
    ans: 1,
    ok: 'Bagging fixes the same feature subset for an entire tree (`estimators_features_`). Random Forest re-samples max_features at every node split, so different splits in the same tree see different features — yielding much greater tree diversity, the variance-reduction engine of RFs.',
    ng: 'Random Forest = bagging + per-split feature randomisation. The default max_features=√n at every node means each split chooses among different candidate features, decorrelating trees more than plain bagging.',
  },
  {
    lec: 'Lec 7 · AdaBoost',
    q: 'In AdaBoost, after a predictor with weighted error r is trained, the weight of each misclassified instance is multiplied by exp(α) where α = η log((1−r)/r). What does this achieve?',
    opts: [
      'It downweights misclassified instances so they are ignored next round',
      'It boosts the relative weight of misclassified instances so the next predictor focuses on the hard cases. r < 0.5 → α > 0 → multiplier > 1',
      'It is purely a normalisation step with no effect on which instances are emphasised',
      'It increases the learning rate when accuracy is high',
    ],
    ans: 1,
    ok: 'For r < 0.5, α > 0 and exp(α) > 1, so misclassified weights grow. Correctly-classified weights stay the same. After normalisation, the next predictor sees a distribution that emphasises previous errors — the core idea of boosting.',
    ng: 'Misclassified instances get their weights multiplied by exp(α) > 1 (when r < 0.5), then all weights renormalise to sum to 1. The next predictor concentrates on the cases the ensemble currently gets wrong.',
  },
  {
    lec: 'Lec 7 · AdaBoost vs Gradient Boosting',
    q: 'AdaBoost and Gradient Boosting are both sequential ensembles. What is the fundamental difference in how each iteration is built?',
    opts: [
      'AdaBoost re-weights instances after each iteration; Gradient Boosting fits the next predictor directly to the residual errors of the previous ensemble',
      'They are mathematically identical — only the loss function differs',
      'AdaBoost uses regression trees; Gradient Boosting uses classifiers',
      'Gradient Boosting can be parallelised across machines; AdaBoost cannot',
    ],
    ans: 0,
    ok: 'AdaBoost re-weights instances based on errors. Gradient Boosting fits each new predictor to the *residuals* (regression) or negative log-loss gradient (classification) of the cumulative ensemble. Both are sequential and cannot parallelise across predictors.',
    ng: 'Key distinction: AdaBoost manipulates instance weights; GBRT fits successive trees to the residual errors. GBRT also typically restricts the base learner to decision trees, while AdaBoost can use any base estimator.',
  },
  {
    lec: 'Lec 7 · Stacking',
    q: 'Stacking trains a "blender" model on top of base predictors. Why is the blender trained on out-of-fold (cross-validated) predictions instead of in-sample base predictions?',
    opts: [
      'It is faster — cross-validation reduces training time',
      'In-sample predictions are over-optimistic (the base models have seen those exact instances). Out-of-fold predictions simulate how the base models will perform on unseen data, so the blender learns a realistic aggregation rule',
      'Out-of-fold predictions provide more training data for the blender',
      'Cross-validation is required by sklearn — there is no statistical reason',
    ],
    ans: 1,
    ok: 'If the blender saw base predictions on the training data the bases were fit on, those predictions would be unrealistically good (data leakage). Out-of-fold predictions simulate "the base model on data it has not seen" — exactly what happens at inference time — so the blender learns an honest aggregation.',
    ng: 'Out-of-fold predictions avoid leakage. Base models always see novel data at inference; using their CV predictions to train the blender keeps the blender from learning to trust overfit base predictions.',
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

// ── L7: Wisdom of the Crowd ───────────────────────────────────────────────────
function EnsembleProbViz() {
  const [p, setP] = useState(0.55);
  const Ns = [1, 3, 5, 11, 25, 51, 101, 201];
  const binomMaj = (nn, pp) => {
    let total = 0;
    const half = Math.floor(nn / 2) + 1;
    for (let k = half; k <= nn; k++) {
      let c = 1;
      for (let i = 0; i < k; i++) c = (c * (nn - i)) / (i + 1);
      total += c * Math.pow(pp, k) * Math.pow(1 - pp, nn - k);
    }
    return total;
  };
  const points = Ns.map(nn => ({ n: nn, p: binomMaj(nn, p) }));
  const W = 360, H = 190, padL = 40, padB = 28, padT = 8, padR = 10;

  return (
    <div className="m4-card">
      <div className="m4-card-h">Wisdom of the Crowd — The Math</div>
      <div className="m4-infobox" style={{ fontSize: '0.78rem', marginBottom: '0.6rem' }}>
        Even <em>weak</em> classifiers (accuracy slightly &gt; 0.5) form a strong ensemble when their errors are independent.
        For binary classification with N predictors of accuracy p, P(majority correct) is the binomial tail and approaches 1 as N → ∞ (whenever p &gt; 0.5).
      </div>
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 200px' }}>
          <div className="m4-flabel">Per-classifier accuracy p</div>
          <input type="range" min="0.40" max="0.90" step="0.01" value={p} onChange={e => setP(+e.target.value)} style={{ width: '100%' }} />
          <div style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--text-2)' }}>p = {p.toFixed(2)}</div>
          <div style={{ marginTop: '0.7rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
            {[
              { lbl: 'N = 11', v: binomMaj(11, p) },
              { lbl: 'N = 101', v: binomMaj(101, p) },
            ].map(b => (
              <div key={b.lbl} style={{ padding: '0.45rem 0.55rem', background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.3)', borderRadius: 6 }}>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-2)', fontWeight: 700, textTransform: 'uppercase' }}>{b.lbl}</div>
                <div style={{ fontFamily: 'monospace', fontSize: '1.05rem', color: 'var(--emerald)' }}>{(b.v * 100).toFixed(1)}%</div>
              </div>
            ))}
          </div>
        </div>
        <svg width={W} height={H} style={{ background: 'var(--bg-3)', borderRadius: 6 }}>
          <line x1={padL} y1={H - padB} x2={W - padR} y2={H - padB} stroke="rgba(148,163,184,0.4)" />
          <line x1={padL} y1={padT} x2={padL} y2={H - padB} stroke="rgba(148,163,184,0.4)" />
          <line x1={padL} y1={padT + (H - padB - padT) * 0.5} x2={W - padR} y2={padT + (H - padB - padT) * 0.5} stroke="rgba(251,113,133,0.5)" strokeDasharray="4 3" />
          <text x={padL - 4} y={padT + (H - padB - padT) * 0.5 + 3} textAnchor="end" fill="rgba(251,113,133,0.7)" fontSize="9" fontFamily="monospace">0.5</text>
          <text x={padL - 4} y={padT + 4} textAnchor="end" fill="var(--text-2)" fontSize="9" fontFamily="monospace">1.0</text>
          <text x={padL - 4} y={H - padB + 3} textAnchor="end" fill="var(--text-2)" fontSize="9" fontFamily="monospace">0.0</text>
          <polyline fill="none" stroke="var(--cyan)" strokeWidth="2.2"
            points={points.map((pt, i) => {
              const x = padL + (i / (points.length - 1)) * (W - padL - padR);
              const y = padT + (1 - pt.p) * (H - padB - padT);
              return `${x},${y}`;
            }).join(' ')} />
          {points.map((pt, i) => {
            const x = padL + (i / (points.length - 1)) * (W - padL - padR);
            const y = padT + (1 - pt.p) * (H - padB - padT);
            return <g key={i}>
              <circle cx={x} cy={y} r={3.5} fill="var(--cyan)" />
              <text x={x} y={H - 8} textAnchor="middle" fill="var(--text-2)" fontSize="9" fontFamily="monospace">{pt.n}</text>
            </g>;
          })}
          <text x={(padL + W - padR) / 2} y={H + 0} textAnchor="middle" fill="var(--text-2)" fontSize="9" fontFamily="monospace">N classifiers</text>
        </svg>
      </div>
      <div className="m4-warnbox" style={{ marginTop: '0.6rem', fontSize: '0.74rem' }}>
        <strong>Critical assumption:</strong> classifier errors must be approximately <em>independent</em>. If all predictors fail on the same instances, the ensemble fails too. Diversity (different algorithms, different training subsets, different features) is what makes ensembles work.
      </div>
    </div>
  );
}

// ── L7: Voting Classifier Demo ────────────────────────────────────────────────
function VotingClassifierDemo() {
  const [pa1, setPa1] = useState(0.55);
  const [pa2, setPa2] = useState(0.62);
  const [pa3, setPa3] = useState(0.49);
  const probs = [pa1, pa2, pa3];
  const setters = [setPa1, setPa2, setPa3];
  const labels = ['LogReg', 'Random Forest', 'SVC'];
  const colors = ['var(--cyan)', 'var(--violet)', 'var(--emerald)'];

  const hardVotes = probs.map(pr => pr > 0.5 ? 'A' : 'B');
  const aCount = hardVotes.filter(v => v === 'A').length;
  const hardWinner = aCount >= 2 ? 'A' : 'B';
  const avgPA = probs.reduce((s, pr) => s + pr, 0) / 3;
  const softWinner = avgPA > 0.5 ? 'A' : 'B';
  const agree = hardWinner === softWinner;

  return (
    <div className="m4-card">
      <div className="m4-card-h">Voting Classifier — Hard vs Soft Vote (Interactive)</div>
      <div className="m4-infobox" style={{ marginBottom: '0.7rem', fontSize: '0.77rem' }}>
        Three classifiers each output P(class A). Drag the sliders. <strong>Hard vote</strong> takes the majority of the discrete labels (P &gt; 0.5 → A). <strong>Soft vote</strong> averages the probabilities and picks the class with the highest average.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.5rem' }}>
        {labels.map((lbl, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '120px 1fr 90px 60px', gap: '0.6rem', alignItems: 'center' }}>
            <div style={{ fontFamily: 'monospace', fontSize: '0.75rem', fontWeight: 700, color: colors[i] }}>{lbl}</div>
            <input type="range" min="0" max="1" step="0.01" value={probs[i]} onChange={e => setters[i](+e.target.value)} />
            <div style={{ fontFamily: 'monospace', fontSize: '0.74rem', color: 'var(--text-2)' }}>P(A)={probs[i].toFixed(2)}</div>
            <div style={{ fontFamily: 'monospace', fontSize: '0.78rem', fontWeight: 700, color: hardVotes[i] === 'A' ? 'var(--cyan)' : 'var(--rose)' }}>→ {hardVotes[i]}</div>
          </div>
        ))}
      </div>
      <div className="m4-hr" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.7rem' }}>
        <div style={{ background: hardWinner === 'A' ? 'rgba(34,211,238,0.08)' : 'rgba(251,113,133,0.08)', border: `1px solid ${hardWinner === 'A' ? 'rgba(34,211,238,0.3)' : 'rgba(251,113,133,0.3)'}`, borderRadius: 7, padding: '0.7rem' }}>
          <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 700, color: 'var(--text-2)', letterSpacing: '0.05em' }}>Hard Vote</div>
          <div style={{ fontFamily: 'monospace', fontSize: '0.74rem', color: 'var(--text-2)' }}>A: {aCount}/3 · B: {3 - aCount}/3</div>
          <div style={{ fontSize: '1.4rem', fontFamily: 'monospace', fontWeight: 700, color: hardWinner === 'A' ? 'var(--cyan)' : 'var(--rose)', marginTop: '0.3rem' }}>Predict: {hardWinner}</div>
        </div>
        <div style={{ background: softWinner === 'A' ? 'rgba(34,211,238,0.08)' : 'rgba(251,113,133,0.08)', border: `1px solid ${softWinner === 'A' ? 'rgba(34,211,238,0.3)' : 'rgba(251,113,133,0.3)'}`, borderRadius: 7, padding: '0.7rem' }}>
          <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 700, color: 'var(--text-2)', letterSpacing: '0.05em' }}>Soft Vote</div>
          <div style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: 'var(--text-2)' }}>avg = ({pa1.toFixed(2)} + {pa2.toFixed(2)} + {pa3.toFixed(2)})/3 = {avgPA.toFixed(3)}</div>
          <div style={{ fontSize: '1.4rem', fontFamily: 'monospace', fontWeight: 700, color: softWinner === 'A' ? 'var(--cyan)' : 'var(--rose)', marginTop: '0.3rem' }}>Predict: {softWinner}</div>
        </div>
      </div>
      {!agree && (
        <div className="m4-warnbox" style={{ marginTop: '0.6rem', fontSize: '0.74rem' }}>
          <strong>Disagreement!</strong> Hard and soft votes differ here. Soft voting carried a high-confidence vote into the aggregate that hard voting flattened to a 1-of-3. With <em>well-calibrated</em> probabilities, this usually favours soft voting.
        </div>
      )}
    </div>
  );
}

// ── L7: Bootstrap Visualizer ──────────────────────────────────────────────────
function BootstrapVisualizer() {
  const M = 30;
  const [run, setRun] = useState(1);
  const [history, setHistory] = useState([]);

  const samples = (() => {
    const rand = makePRNG(run * 137 + 41);
    return Array.from({ length: M }, () => Math.floor(rand() * M));
  })();
  const counts = Array(M).fill(0);
  samples.forEach(i => counts[i]++);
  const sampledCount = counts.filter(c => c > 0).length;
  const oobCount = M - sampledCount;
  const oobRatio = oobCount / M;
  const allRatios = [...history, oobRatio];
  const avgOOB = allRatios.reduce((s, x) => s + x, 0) / allRatios.length;

  const next = () => { setHistory(h => [...h, oobRatio]); setRun(r => r + 1); };
  const reset = () => { setHistory([]); setRun(1); };

  return (
    <div className="m4-card">
      <div className="m4-card-h">Bootstrap Sampling — OOB Visualizer</div>
      <div className="m4-infobox" style={{ marginBottom: '0.7rem', fontSize: '0.77rem' }}>
        Sample <Tex src="m=30" /> indices <strong>with replacement</strong> from a training set of size <Tex src="m=30" />. Some are picked multiple times; others are never picked. As <Tex src="m \to \infty" />, the unpicked fraction tends to <Tex src="(1 - 1/m)^m \to 1/e \approx 0.368" /> — these are the <strong>out-of-bag</strong> instances and act as a free per-predictor validation set.
      </div>
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 360px' }}>
          <div className="m4-flabel">Training set (each cell = one instance)</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: '4px' }}>
            {Array.from({ length: M }, (_, i) => {
              const c = counts[i];
              const isOOB = c === 0;
              const tints = ['rgba(15,23,42,0.4)', 'rgba(34,211,238,0.45)', 'rgba(34,211,238,0.7)', 'rgba(34,211,238,0.9)', 'rgba(34,211,238,1)'];
              const bg = isOOB ? 'rgba(251,113,133,0.18)' : tints[Math.min(c, tints.length - 1)];
              const border = isOOB ? '1px solid rgba(251,113,133,0.6)' : '1px solid rgba(34,211,238,0.4)';
              return (
                <div key={i} style={{ aspectRatio: '1', background: bg, borderRadius: 4, border, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'monospace', fontSize: '0.72rem', fontWeight: 700, color: isOOB ? '#fb7185' : 'white' }}>
                  {isOOB ? '×' : c}
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: '0.7rem', alignItems: 'center', marginTop: '0.6rem', fontSize: '0.7rem', color: 'var(--text-2)', flexWrap: 'wrap' }}>
            <span><span style={{ display: 'inline-block', width: 12, height: 12, background: 'rgba(34,211,238,0.7)', borderRadius: 3, verticalAlign: 'middle', marginRight: 4 }} /> Sampled (number = times picked)</span>
            <span><span style={{ display: 'inline-block', width: 12, height: 12, background: 'rgba(251,113,133,0.18)', border: '1px solid rgba(251,113,133,0.6)', borderRadius: 3, verticalAlign: 'middle', marginRight: 4 }} /> OOB (×)</span>
          </div>
        </div>
        <div style={{ flex: '0 0 200px' }}>
          <div style={{ background: 'var(--bg-3)', borderRadius: 7, padding: '0.7rem', border: '1px solid rgba(34,211,238,0.2)' }}>
            <div className="m4-flabel">This run</div>
            <table className="m4-ptable" style={{ fontSize: '0.72rem' }}>
              <tbody>
                <tr><td>Unique sampled</td><td className="pk">{sampledCount} / {M}</td></tr>
                <tr><td>OOB count</td><td className="pk">{oobCount} / {M}</td></tr>
                <tr><td>OOB ratio</td><td className="pk">{(oobRatio * 100).toFixed(1)}%</td></tr>
              </tbody>
            </table>
            <div className="m4-hr" />
            <div className="m4-flabel">Across {allRatios.length} runs</div>
            <div style={{ fontSize: '1.6rem', fontFamily: 'monospace', fontWeight: 700, color: 'var(--emerald)', textAlign: 'center' }}>{(avgOOB * 100).toFixed(1)}%</div>
            <div style={{ fontSize: '0.66rem', color: 'var(--text-2)', textAlign: 'center', marginBottom: '0.5rem' }}>average OOB → 36.8%</div>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <button className="m4-btn m4-btn-p" onClick={next} style={{ flex: 1 }}>Resample</button>
              <button className="m4-btn" onClick={reset}>Reset</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── L7: AdaBoost α(r) Calculator ──────────────────────────────────────────────
function AdaBoostCalc() {
  const [r, setR] = useState(0.30);
  const [eta, setEta] = useState(1.00);
  const alpha = eta * Math.log((1 - r) / r);
  const wMul = Math.exp(alpha);
  const W = 360, H = 200, padL = 36, padB = 26, padT = 8, padR = 10;
  const rs = Array.from({ length: 99 }, (_, i) => 0.01 + i * 0.01);
  const aMax = 4;

  return (
    <div className="m4-card">
      <div className="m4-card-h">AdaBoost — Predictor Weight α(r) Calculator</div>
      <div className="m4-infobox" style={{ marginBottom: '0.7rem', fontSize: '0.77rem' }}>
        Each AdaBoost iteration measures the <strong>weighted error</strong> <Tex src="r_j" /> of the j-th predictor on the current weighted training set, computes the predictor weight <Tex src="\alpha_j = \eta \log((1-r_j)/r_j)" />, then multiplies <em>misclassified</em> instances' weights by <Tex src="\exp(\alpha_j)" /> before renormalising.
      </div>
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 220px' }}>
          <div className="m4-flabel">Weighted error r</div>
          <input type="range" min="0.01" max="0.99" step="0.01" value={r} onChange={e => setR(+e.target.value)} style={{ width: '100%' }} />
          <div style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--text-2)' }}>r = {r.toFixed(2)}</div>
          <div className="m4-flabel" style={{ marginTop: '0.5rem' }}>Learning rate η</div>
          <input type="range" min="0.05" max="1.50" step="0.05" value={eta} onChange={e => setEta(+e.target.value)} style={{ width: '100%' }} />
          <div style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--text-2)' }}>η = {eta.toFixed(2)}</div>
          <div style={{ marginTop: '0.6rem', fontSize: '0.74rem' }}>
            <Tex src={`\\alpha = ${eta.toFixed(2)} \\cdot \\log\\!\\left(\\tfrac{1 - ${r.toFixed(2)}}{${r.toFixed(2)}}\\right) = ${alpha.toFixed(3)}`} block />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem', marginTop: '0.5rem' }}>
            <div style={{ padding: '0.45rem 0.55rem', background: alpha > 0 ? 'rgba(52,211,153,0.08)' : 'rgba(251,113,133,0.08)', borderRadius: 6, border: `1px solid ${alpha > 0 ? 'rgba(52,211,153,0.3)' : 'rgba(251,113,133,0.3)'}` }}>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-2)', fontWeight: 700, textTransform: 'uppercase' }}>α</div>
              <div style={{ fontFamily: 'monospace', fontSize: '1.05rem', color: alpha > 0 ? 'var(--emerald)' : 'var(--rose)' }}>{alpha.toFixed(3)}</div>
            </div>
            <div style={{ padding: '0.45rem 0.55rem', background: 'rgba(167,139,250,0.08)', borderRadius: 6, border: '1px solid rgba(167,139,250,0.3)' }}>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-2)', fontWeight: 700, textTransform: 'uppercase' }}>weight × (mis)</div>
              <div style={{ fontFamily: 'monospace', fontSize: '1.05rem', color: 'var(--violet)' }}>{wMul.toFixed(2)}×</div>
            </div>
          </div>
        </div>
        <svg width={W} height={H} style={{ background: 'var(--bg-3)', borderRadius: 6 }}>
          <line x1={padL} y1={padT + (H - padB - padT) / 2} x2={W - padR} y2={padT + (H - padB - padT) / 2} stroke="rgba(148,163,184,0.5)" />
          <line x1={padL} y1={padT} x2={padL} y2={H - padB} stroke="rgba(148,163,184,0.4)" />
          <line x1={padL + ((0.5 - 0.01) / 0.98) * (W - padL - padR)} y1={padT} x2={padL + ((0.5 - 0.01) / 0.98) * (W - padL - padR)} y2={H - padB} stroke="rgba(251,113,133,0.5)" strokeDasharray="3 3" />
          <text x={padL - 4} y={padT + (H - padB - padT) / 2 + 3} textAnchor="end" fill="var(--text-2)" fontSize="9" fontFamily="monospace">α=0</text>
          <polyline fill="none" stroke="var(--cyan)" strokeWidth="2"
            points={rs.map(rr => {
              const aa = Math.max(-aMax, Math.min(aMax, eta * Math.log((1 - rr) / rr)));
              const x = padL + ((rr - 0.01) / 0.98) * (W - padL - padR);
              const y = padT + (1 - (aa + aMax) / (2 * aMax)) * (H - padB - padT);
              return `${x},${y}`;
            }).join(' ')} />
          {(() => {
            const aa = Math.max(-aMax, Math.min(aMax, alpha));
            const x = padL + ((r - 0.01) / 0.98) * (W - padL - padR);
            const y = padT + (1 - (aa + aMax) / (2 * aMax)) * (H - padB - padT);
            return <g>
              <line x1={x} y1={padT} x2={x} y2={H - padB} stroke="var(--amber)" strokeWidth="1" strokeDasharray="3 2" opacity="0.6" />
              <circle cx={x} cy={y} r={5} fill="var(--amber)" stroke="white" strokeWidth="1.5" />
            </g>;
          })()}
          <text x={(padL + W - padR) / 2} y={H - 6} textAnchor="middle" fill="var(--text-2)" fontSize="10" fontFamily="monospace">weighted error r</text>
          <text x={padL + ((0.5 - 0.01) / 0.98) * (W - padL - padR) + 3} y={padT + 10} fill="rgba(251,113,133,0.7)" fontSize="9" fontFamily="monospace">r=0.5</text>
        </svg>
      </div>
      <table className="m4-ptable" style={{ marginTop: '0.6rem', fontSize: '0.72rem' }}>
        <thead><tr><th>r</th><th>α</th><th>Behaviour</th></tr></thead>
        <tbody>
          <tr><td>r &lt; 0.5</td><td className="pk">α &gt; 0</td><td>Better than chance — boost misclassified weights; predictor counts positively in vote.</td></tr>
          <tr><td>r = 0.5</td><td className="pk">α = 0</td><td>Coin-flip — predictor ignored, weights unchanged.</td></tr>
          <tr><td>r &gt; 0.5</td><td className="pk">α &lt; 0</td><td>Worse than chance — its vote is reversed in the ensemble.</td></tr>
          <tr><td>r → 0</td><td className="pk">α → ∞</td><td>Perfect predictor — its single vote can dominate.</td></tr>
        </tbody>
      </table>
    </div>
  );
}

// ── L7: Mini regression-tree builder for GBRT viz ─────────────────────────────
function buildRegressionTree(xs, ys, depth) {
  const m = xs.length;
  if (depth === 0 || m < 2) {
    const mean = m === 0 ? 0 : ys.reduce((s, y) => s + y, 0) / m;
    return { leaf: true, value: mean };
  }
  let best = null;
  for (let i = 1; i < m; i++) {
    const lY = ys.slice(0, i), rY = ys.slice(i);
    const ml = lY.reduce((s, y) => s + y, 0) / lY.length;
    const mr = rY.reduce((s, y) => s + y, 0) / rY.length;
    const sl = lY.reduce((s, y) => s + (y - ml) ** 2, 0);
    const sr = rY.reduce((s, y) => s + (y - mr) ** 2, 0);
    const cost = sl + sr;
    if (!best || cost < best.cost) best = { cost, t: (xs[i - 1] + xs[i]) / 2, i };
  }
  if (!best) return { leaf: true, value: ys.reduce((s, y) => s + y, 0) / m };
  return {
    leaf: false,
    t: best.t,
    left: buildRegressionTree(xs.slice(0, best.i), ys.slice(0, best.i), depth - 1),
    right: buildRegressionTree(xs.slice(best.i), ys.slice(best.i), depth - 1),
  };
}
function predictRegressionTree(tree, x) {
  return tree.leaf ? tree.value : (x <= tree.t ? predictRegressionTree(tree.left, x) : predictRegressionTree(tree.right, x));
}

const GBRT_DATA = (() => {
  const rand = makePRNG(7);
  const xs = Array.from({ length: 30 }, (_, i) => -1 + (i * 2) / 29);
  const ys = xs.map(x => 3 * x * x + gaussianNoise(rand, 0.45));
  return { xs, ys };
})();

// ── L7: Gradient Boosting Live Stepper ────────────────────────────────────────
function GradientBoostStepper() {
  const [n, setN] = useState(3);
  const [lr, setLr] = useState(1.0);
  const { xs, ys } = GBRT_DATA;

  const trees = (() => {
    const out = [];
    let resid = [...ys];
    for (let i = 0; i < n; i++) {
      const t = buildRegressionTree(xs, resid, 2);
      out.push(t);
      resid = resid.map((rv, j) => rv - lr * predictRegressionTree(t, xs[j]));
    }
    return out;
  })();

  const xGrid = Array.from({ length: 200 }, (_, i) => -1 + (i * 2) / 199);
  const cumPred = xGrid.map(x => trees.reduce((s, t) => s + lr * predictRegressionTree(t, x), 0));
  const yTrue = xGrid.map(x => 3 * x * x);
  const yPredTrain = xs.map(x => trees.reduce((s, t) => s + lr * predictRegressionTree(t, x), 0));
  const mse = yPredTrain.reduce((s, p, i) => s + (p - ys[i]) ** 2, 0) / xs.length;

  const W = 460, H = 240, padL = 35, padB = 26, padT = 12, padR = 10;
  const xMin = -1, xMax = 1, yMin = -1.5, yMax = 4.5;
  const xToPx = x => padL + ((x - xMin) / (xMax - xMin)) * (W - padL - padR);
  const yToPx = y => padT + (1 - (y - yMin) / (yMax - yMin)) * (H - padB - padT);

  return (
    <div className="m4-card">
      <div className="m4-card-h">Gradient Boosting — Live Residual Fitting (max_depth=2)</div>
      <div className="m4-infobox" style={{ marginBottom: '0.7rem', fontSize: '0.77rem' }}>
        Tree 1 fits the data; tree 2 fits the residuals of tree 1 (shrunk by η); tree 3 fits the residuals of (tree 1 + tree 2) — and so on. The cumulative sum is the GBRT prediction on a noisy <Tex src="y = 3x^2 + \varepsilon" /> dataset (30 points). Step through to watch the fit improve.
      </div>
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ flex: '0 0 200px' }}>
          <div className="m4-flabel">n_estimators</div>
          <input type="range" min="1" max="25" step="1" value={n} onChange={e => setN(+e.target.value)} style={{ width: '100%' }} />
          <div style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--text-2)' }}>n = {n}</div>
          <div className="m4-flabel" style={{ marginTop: '0.5rem' }}>Learning rate η</div>
          <input type="range" min="0.10" max="1.50" step="0.05" value={lr} onChange={e => setLr(+e.target.value)} style={{ width: '100%' }} />
          <div style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--text-2)' }}>η = {lr.toFixed(2)}</div>
          <div style={{ marginTop: '0.6rem', padding: '0.5rem 0.65rem', background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.3)', borderRadius: 6 }}>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-2)', fontWeight: 700, textTransform: 'uppercase' }}>Training MSE</div>
            <div style={{ fontFamily: 'monospace', fontSize: '1.15rem', color: 'var(--violet)' }}>{mse.toFixed(3)}</div>
          </div>
          <div className="m4-warnbox" style={{ marginTop: '0.6rem', fontSize: '0.7rem' }}>
            Try <code>η=0.10, n=25</code> vs <code>η=1.50, n=3</code>. Small η + many trees = smoother, better-generalising fit. Large η + few trees = blocky and underfit (or overfit at extremes).
          </div>
        </div>
        <svg width={W} height={H} style={{ background: 'var(--bg-3)', borderRadius: 6 }}>
          <line x1={padL} y1={yToPx(0)} x2={W - padR} y2={yToPx(0)} stroke="rgba(148,163,184,0.25)" />
          <line x1={padL} y1={padT} x2={padL} y2={H - padB} stroke="rgba(148,163,184,0.4)" />
          <line x1={padL} y1={H - padB} x2={W - padR} y2={H - padB} stroke="rgba(148,163,184,0.4)" />
          <polyline fill="none" stroke="rgba(52,211,153,0.55)" strokeWidth="2" strokeDasharray="4 3"
            points={xGrid.map((x, i) => `${xToPx(x)},${yToPx(yTrue[i])}`).join(' ')} />
          <polyline fill="none" stroke="var(--cyan)" strokeWidth="2"
            points={xGrid.map((x, i) => `${xToPx(x)},${yToPx(cumPred[i])}`).join(' ')} />
          {xs.map((x, i) => <circle key={i} cx={xToPx(x)} cy={yToPx(ys[i])} r={2.8} fill="var(--amber)" stroke="white" strokeWidth="0.5" />)}
          <g fontFamily="monospace" fontSize="9" fill="var(--text-2)">
            <text x={W - padR - 4} y={padT + 12} textAnchor="end"><tspan fill="var(--cyan)">━ GBRT</tspan></text>
            <text x={W - padR - 4} y={padT + 24} textAnchor="end"><tspan fill="rgba(52,211,153,0.7)">┄ true 3x²</tspan></text>
            <text x={W - padR - 4} y={padT + 36} textAnchor="end"><tspan fill="var(--amber)">● train</tspan></text>
          </g>
          <text x={padL - 4} y={yToPx(0) + 3} textAnchor="end" fill="var(--text-2)" fontSize="9" fontFamily="monospace">0</text>
          <text x={padL - 4} y={yToPx(3)} textAnchor="end" fill="var(--text-2)" fontSize="9" fontFamily="monospace">3</text>
          <text x={(padL + W - padR) / 2} y={H - 6} textAnchor="middle" fill="var(--text-2)" fontSize="10" fontFamily="monospace">x</text>
        </svg>
      </div>
    </div>
  );
}

// ── L7: Ensemble Method Matcher ───────────────────────────────────────────────
const ENS_SCENARIOS = [
  { scenario: 'You have 3 wildly different classifiers (an SVM, a kNN, and a logistic regression) and want a single more reliable prediction by combining them.', methods: ['Voting', 'Bagging', 'AdaBoost', 'Stacking'], correct: 0,
    fb: 'Voting (hard or soft) classically combines diverse algorithms with a fixed aggregation rule. Stacking would also work but adds a learned blender; voting is the simplest correct answer.' },
  { scenario: 'You want to reduce the high variance of a single deep decision tree without changing the algorithm itself.', methods: ['Bagging', 'AdaBoost', 'Gradient Boosting', 'Stacking'], correct: 0,
    fb: 'Bagging trains many copies of the same algorithm on bootstrap samples and averages — directly attacks variance, leaves bias roughly unchanged. Random Forests extend this with per-split feature randomisation.' },
  { scenario: 'Your high-dimensional dataset has thousands of features per instance (e.g. images) and you want each base estimator to look at different feature subsets.', methods: ['Random Patches', 'AdaBoost', 'Stacking', 'Voting'], correct: 0,
    fb: 'Random Patches samples both instances and features (set bootstrap_features=True, max_features<1.0). Random Subspaces sample features only — both reduce variance further on high-dimensional data.' },
  { scenario: 'Each predictor should focus on the mistakes of the previous one; the predictors are trained sequentially.', methods: ['Voting', 'Bagging', 'AdaBoost', 'Random Forest'], correct: 2,
    fb: 'AdaBoost re-weights misclassified instances after every iteration so the next predictor concentrates on hard cases. Sequential — cannot parallelise across predictors.' },
  { scenario: 'You want each new tree to fit the residual errors of the cumulative ensemble, with optional shrinkage and early stopping.', methods: ['Gradient Boosting', 'AdaBoost', 'Bagging', 'Stacking'], correct: 0,
    fb: 'GBRT fits each new tree to the residual of the cumulative ensemble. Use small learning_rate + large n_estimators + n_iter_no_change for best generalisation.' },
  { scenario: 'You want the meta-learner to *learn* how to combine base predictions instead of using a fixed rule like majority vote.', methods: ['Stacking', 'Voting', 'Bagging', 'Extra-Trees'], correct: 0,
    fb: 'Stacking trains a final estimator (the "blender") on the out-of-fold predictions of the base models. The blender learns the optimal aggregation function rather than using a fixed rule.' },
  { scenario: 'You want even more tree diversity than a Random Forest and faster training, accepting slightly higher bias.', methods: ['Extra-Trees', 'Bagging', 'AdaBoost', 'Stacking'], correct: 0,
    fb: 'Extra-Trees use random thresholds (instead of optimal ones) for each candidate feature — faster training, more bias, less variance than a regular Random Forest.' },
];

function EnsembleMatcher() {
  const [picks, setPicks] = useState({});
  const [revealed, setRevealed] = useState({});
  const choose = (qi, mi) => {
    if (revealed[qi]) return;
    setPicks(p => ({ ...p, [qi]: mi }));
    setRevealed(r => ({ ...r, [qi]: true }));
  };
  const reset = () => { setPicks({}); setRevealed({}); };
  const score = ENS_SCENARIOS.filter((s, i) => picks[i] === s.correct).length;
  const answered = Object.keys(revealed).length;

  return (
    <div className="m4-card">
      <div className="m4-card-h">Ensemble Method Matcher — Pick the Right Tool</div>
      <div className="m4-infobox" style={{ marginBottom: '0.8rem', fontSize: '0.77rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <span style={{ flex: 1 }}>For each scenario, pick the most appropriate ensemble method. Each pick reveals feedback.</span>
        <span style={{ fontFamily: 'monospace', fontWeight: 700, color: score >= 5 ? 'var(--emerald)' : score >= 3 ? 'var(--amber)' : 'var(--rose)', fontSize: '1rem' }}>{score}/{answered}</span>
        {answered === ENS_SCENARIOS.length && <button className="m4-btn" onClick={reset}>Reset</button>}
      </div>
      {ENS_SCENARIOS.map((s, i) => {
        const done = revealed[i];
        const pick = picks[i];
        return (
          <div key={i} style={{ background: 'var(--bg-3)', borderRadius: 7, padding: '0.7rem', marginBottom: '0.6rem', border: '1px solid rgba(148,163,184,0.15)' }}>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-1)', marginBottom: '0.5rem', lineHeight: 1.55 }}>
              <span style={{ color: 'var(--cyan)', fontWeight: 700, marginRight: '0.4rem', fontFamily: 'monospace' }}>{i + 1}.</span>{s.scenario}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
              {s.methods.map((m, mi) => {
                const isPick = pick === mi;
                const isCorrect = mi === s.correct;
                const bg = !done ? 'var(--bg-2)' : (isCorrect ? 'rgba(52,211,153,0.15)' : (isPick ? 'rgba(251,113,133,0.15)' : 'var(--bg-2)'));
                const bd = !done ? '1px solid rgba(148,163,184,0.25)' : (isCorrect ? '1px solid rgba(52,211,153,0.5)' : (isPick ? '1px solid rgba(251,113,133,0.5)' : '1px solid rgba(148,163,184,0.15)'));
                const col = !done ? 'var(--text-1)' : (isCorrect ? 'var(--emerald)' : (isPick ? 'var(--rose)' : 'var(--text-2)'));
                return (
                  <button key={mi} onClick={() => choose(i, mi)} disabled={done}
                    style={{ background: bg, border: bd, color: col, padding: '0.4rem 0.75rem', fontSize: '0.74rem', fontFamily: 'monospace', borderRadius: 5, cursor: done ? 'default' : 'pointer', fontWeight: 600 }}>
                    {m}{done && isCorrect ? ' ✓' : ''}{done && isPick && !isCorrect ? ' ✗' : ''}
                  </button>
                );
              })}
            </div>
            {done && (
              <div style={{ fontSize: '0.72rem', color: 'var(--text-2)', marginTop: '0.5rem', padding: '0.45rem 0.6rem', background: 'rgba(34,211,238,0.06)', border: '1px solid rgba(34,211,238,0.2)', borderRadius: 5, lineHeight: 1.55 }}>
                {s.fb}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
const MAIN_TABS = ['Overview', 'Exam Summary', 'Code Lab', 'Intro to ML', 'ML Projects', 'Regression', 'Reg. & kNN', 'SVMs', 'Decision Trees', 'Ensembles', 'Dimensionality Reduction', 'Clustering', 'Assignment 1', 'Quiz'];
const L6_TABS = ['Overview & CART', 'Impurity Measures', 'Regularisation', 'Regression Trees', 'Limitations'];
const L7_TABS = ['Ensemble Basics', 'Bagging & OOB', 'Random Forests', 'Boosting', 'Stacking & Summary'];
const L1_TABS = ['Mitchell\'s Definition', 'ML System Types', 'Challenges & Testing'];
const L2_TABS = ['Formal Model', 'Project Workflow', 'Performance Measures', 'Classification Eval'];
const L3_TABS = ['Linear Regression', 'Gradient Descent', 'Polynomial Regression', 'Logistic Regression'];
const L4_TABS = ['Bias & Variance', 'Regularisation', 'kNN', 'Softmax & Multiclass'];
const L5_TABS = ['Linear SVM', 'Kernel Trick', 'SVM Math', 'Complexity & Regression'];
const ASGN1_TABS = ['MNIST & Classification', 'Data Splits', 'Softmax from Scratch', 'sklearn Comparison', 'Linear vs Non-Linear'];

// ════════════════════════════════════════════════════════════════════════════
// LECTURE 8 — Dimensionality Reduction  &  LECTURE 9 — Unsupervised Learning
// (interactive learning modules — same patterns/classes as Lectures 1–7)
// ════════════════════════════════════════════════════════════════════════════

const L8_TABS = ['Curse of Dimensionality', 'Projection & Manifolds', 'PCA', 'Choosing d & Compression', 'PCA Variants', 'Kernel PCA', 'Other Techniques'];
const L9_TABS = ['Introduction', 'K-Means Algorithm', 'Drawbacks & Remedies', 'Semi-Supervised Learning', 'DBSCAN'];

const L_COL = ['#22d3ee', '#a78bfa', '#34d399', '#fbbf24', '#fb7185', '#60a5fa', '#f472b6', '#2dd4bf', '#c084fc', '#f59e0b'];

// ── Shared datasets (deterministic via seeded PRNG) ──────────────────────────
const L8_CLOUD = (() => {
  const rand = makePRNG(7);
  const ang = Math.PI / 6;
  const pts = [];
  for (let i = 0; i < 140; i++) {
    const a = gaussianNoise(rand, 2.7);
    const b = gaussianNoise(rand, 0.75);
    pts.push([a * Math.cos(ang) - b * Math.sin(ang) + 5, a * Math.sin(ang) + b * Math.cos(ang) + 5]);
  }
  return pts;
})();

const L8_CIRCLES = (() => {
  const rand = makePRNG(11);
  const pts = [];
  for (let i = 0; i < 70; i++) { const t = rand() * 2 * Math.PI, r = 1.3 + gaussianNoise(rand, 0.12); pts.push([5 + r * Math.cos(t), 5 + r * Math.sin(t), 0]); }
  for (let i = 0; i < 95; i++) { const t = rand() * 2 * Math.PI, r = 3.7 + gaussianNoise(rand, 0.16); pts.push([5 + r * Math.cos(t), 5 + r * Math.sin(t), 1]); }
  return pts;
})();

const L8_EVR = (() => {
  const raw = Array.from({ length: 20 }, (_, i) => Math.exp(-i / 3.1) + 0.004);
  const s = raw.reduce((a, b) => a + b, 0);
  return raw.map(v => v / s);
})();

const L8_SWISS = (() => {
  const rand = makePRNG(5);
  const pts = [];
  for (let i = 0; i < 170; i++) { const t = 1.5 * Math.PI * (1 + 2 * (i / 169)); const h = rand() * 8; pts.push([t, h]); }
  return pts;
})();

const L8_TSNE = (() => {
  const rand = makePRNG(13);
  const pts = [];
  for (let k = 0; k < 10; k++) {
    const cx = Math.cos(k / 10 * 2 * Math.PI) * 3.6 + 5, cy = Math.sin(k / 10 * 2 * Math.PI) * 3.6 + 5;
    for (let i = 0; i < 20; i++) pts.push([cx + gaussianNoise(rand, 0.5), cy + gaussianNoise(rand, 0.5), k]);
  }
  return pts;
})();

const L9_BLOBS = (() => {
  const rand = makePRNG(3);
  const C = [[2.5, 2.6], [7.6, 2.4], [2.4, 7.5], [7.2, 7.3], [5.0, 5.0]];
  const pts = [];
  C.forEach((c, ci) => { for (let i = 0; i < (ci === 4 ? 24 : 30); i++) pts.push([c[0] + gaussianNoise(rand, 0.72), c[1] + gaussianNoise(rand, 0.72)]); });
  return pts;
})();

const L9_MOONS = (() => {
  const rand = makePRNG(9);
  const pts = [];
  for (let i = 0; i < 90; i++) { const t = Math.PI * (i / 89); pts.push([Math.cos(t) + gaussianNoise(rand, 0.06), Math.sin(t) + gaussianNoise(rand, 0.06)]); }
  for (let i = 0; i < 90; i++) { const t = Math.PI * (i / 89); pts.push([1 - Math.cos(t) + gaussianNoise(rand, 0.06), 0.5 - Math.sin(t) + gaussianNoise(rand, 0.06)]); }
  return pts;
})();

// ── Math helpers ─────────────────────────────────────────────────────────────
function l8pca2(pts) {
  const n = pts.length;
  let mx = 0, my = 0;
  for (const p of pts) { mx += p[0]; my += p[1]; }
  mx /= n; my /= n;
  let a = 0, b = 0, c = 0;
  for (const p of pts) { const dx = p[0] - mx, dy = p[1] - my; a += dx * dx; b += dx * dy; c += dy * dy; }
  a /= n; b /= n; c /= n;
  const tr = a + c, root = Math.sqrt(Math.max(0, (a - c) * (a - c) / 4 + b * b));
  const l1 = tr / 2 + root, l2 = tr / 2 - root;
  const angle = 0.5 * Math.atan2(2 * b, a - c);
  return { mx, my, l1, l2, angle };
}
function l8projVar(pts, mx, my, theta) {
  const u = [Math.cos(theta), Math.sin(theta)];
  let s = 0;
  for (const p of pts) { const v = (p[0] - mx) * u[0] + (p[1] - my) * u[1]; s += v * v; }
  return s / pts.length;
}
function l9kmeansHistory(pts, k, initIdx) {
  let cent = initIdx.map(i => [pts[i][0], pts[i][1]]);
  const hist = [];
  for (let it = 0; it < 30; it++) {
    const assign = pts.map(p => { let bi = 0, bd = Infinity; for (let j = 0; j < k; j++) { const dx = p[0] - cent[j][0], dy = p[1] - cent[j][1], d = dx * dx + dy * dy; if (d < bd) { bd = d; bi = j; } } return bi; });
    let inertia = 0; pts.forEach((p, i) => { const c = cent[assign[i]]; inertia += (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2; });
    const ncent = Array.from({ length: k }, () => [0, 0, 0]);
    pts.forEach((p, i) => { const a = assign[i]; ncent[a][0] += p[0]; ncent[a][1] += p[1]; ncent[a][2]++; });
    const moved = ncent.map((c, j) => c[2] > 0 ? [c[0] / c[2], c[1] / c[2]] : cent[j]);
    let delta = 0; for (let j = 0; j < k; j++) delta += Math.abs(moved[j][0] - cent[j][0]) + Math.abs(moved[j][1] - cent[j][1]);
    hist.push({ cent: cent.map(c => [...c]), assign, inertia, next: moved });
    cent = moved;
    if (delta < 1e-7) break;
  }
  return hist;
}
function l9silhouette(pts, assign, k) {
  const n = pts.length;
  let total = 0, cnt = 0;
  for (let i = 0; i < n; i++) {
    const sums = Array(k).fill(0), counts = Array(k).fill(0);
    for (let j = 0; j < n; j++) { if (j === i) continue; const d = Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]); sums[assign[j]] += d; counts[assign[j]]++; }
    const ai = assign[i];
    if (counts[ai] === 0) continue;
    const a = sums[ai] / counts[ai];
    let b = Infinity; for (let c = 0; c < k; c++) { if (c === ai || counts[c] === 0) continue; b = Math.min(b, sums[c] / counts[c]); }
    if (!isFinite(b)) continue;
    total += (b - a) / Math.max(a, b); cnt++;
  }
  return cnt ? total / cnt : 0;
}
function l9dbscan(pts, eps, minPts) {
  const n = pts.length, eps2 = eps * eps;
  const neigh = i => { const r = []; for (let j = 0; j < n; j++) { const dx = pts[i][0] - pts[j][0], dy = pts[i][1] - pts[j][1]; if (dx * dx + dy * dy <= eps2) r.push(j); } return r; };
  const core = pts.map((_, i) => neigh(i).length >= minPts);
  const labels = Array(n).fill(-2);
  let cid = 0;
  for (let i = 0; i < n; i++) {
    if (labels[i] !== -2 || !core[i]) continue;
    labels[i] = cid; const stack = [i];
    while (stack.length) { const q = stack.pop(); for (const nn of neigh(q)) { if (labels[nn] === -2 || labels[nn] === -1) { const was = labels[nn]; labels[nn] = cid; if (core[nn] && was === -2) stack.push(nn); } } }
    cid++;
  }
  for (let i = 0; i < n; i++) if (labels[i] === -2) labels[i] = -1;
  return { labels, core, clusters: cid, noise: labels.filter(l => l === -1).length };
}

// ── Reusable code block + quiz ───────────────────────────────────────────────
function PyBlock({ code }) {
  return (
    <pre style={{ fontFamily: 'var(--font-mono)', fontSize: '0.73rem', color: 'var(--text-1)', background: 'rgba(34,211,238,0.05)', border: '1px solid rgba(34,211,238,0.15)', padding: '0.7rem 0.9rem', borderRadius: 5, lineHeight: 1.55, overflowX: 'auto', margin: '0.6rem 0' }}>
      <code>{code}</code>
    </pre>
  );
}

function L89Quiz({ title, items }) {
  const [ans, setAns] = useState({});
  const [done, setDone] = useState({});
  const choose = (qi, ai) => { if (done[qi]) return; setAns(p => ({ ...p, [qi]: ai })); setDone(p => ({ ...p, [qi]: true })); };
  const answered = Object.keys(done).length;
  const score = items.filter((q, i) => ans[i] === q.ans).length;
  return (
    <div className="m4-card" style={{ marginTop: '1rem' }}>
      <div className="m4-card-h">{title || 'Check Your Understanding'}{answered > 0 ? <span style={{ float: 'right', fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: score === answered ? 'var(--emerald)' : 'var(--amber)' }}>{score}/{answered}</span> : null}</div>
      {items.map((q, qi) => {
        const dn = done[qi], ch = ans[qi];
        return (
          <div key={qi} style={{ marginBottom: qi < items.length - 1 ? '1.1rem' : 0 }}>
            <div style={{ fontSize: '0.86rem', color: 'var(--text-0)', fontWeight: 600, lineHeight: 1.5, marginBottom: '0.6rem' }}>{q.q}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {q.opts.map((opt, ai) => {
                let bg = 'var(--bg-1)', bd = 'var(--border)', col = 'var(--text-1)';
                if (dn) {
                  if (ai === q.ans) { bg = 'rgba(52,211,153,0.12)'; bd = 'rgba(52,211,153,0.45)'; col = 'var(--emerald)'; }
                  else if (ai === ch) { bg = 'rgba(251,113,133,0.1)'; bd = 'rgba(251,113,133,0.35)'; col = 'var(--rose)'; }
                }
                return (
                  <button key={ai} disabled={dn} onClick={() => choose(qi, ai)} style={{ background: bg, border: `1px solid ${bd}`, borderRadius: 5, padding: '0.55rem 0.85rem', textAlign: 'left', cursor: dn ? 'default' : 'pointer', fontSize: '0.8rem', color: col, lineHeight: 1.4, fontFamily: 'var(--font-sans)' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', opacity: 0.6, marginRight: '0.5rem' }}>{String.fromCharCode(65 + ai)}.</span>{opt}
                  </button>
                );
              })}
            </div>
            {dn && (
              <div style={{ marginTop: '0.6rem', padding: '0.6rem 0.85rem', borderRadius: 5, fontSize: '0.79rem', lineHeight: 1.55, background: ch === q.ans ? 'rgba(52,211,153,0.08)' : 'rgba(251,113,133,0.08)', border: `1px solid ${ch === q.ans ? 'rgba(52,211,153,0.3)' : 'rgba(251,113,133,0.3)'}`, color: 'var(--text-1)' }}>
                <strong style={{ color: ch === q.ans ? 'var(--emerald)' : 'var(--rose)' }}>{ch === q.ans ? '✓ Correct — ' : '✗ Not quite — '}</strong>{ch === q.ans ? q.ok : q.ng}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// LECTURE 8 COMPONENTS
// ════════════════════════════════════════════════════════════════════════════

// 8.1 Curse of dimensionality
function L8Curse() {
  const [d, setD] = useState(5);
  const shell = 1 - Math.pow(0.9, d);            // fraction of volume in outer 10% shell
  const diag = Math.sqrt(d);                       // unit-cube diagonal grows as sqrt(d)
  const W = 460, H = 150, pad = 26;
  return (
    <div className="m4-two-col">
      <div className="m4-card">
        <div className="m4-card-h">The Curse of Dimensionality</div>
        <ul className="m4-bullets">
          <li>High-dimensional training data (thousands→millions of features) causes <strong style={{ color: 'var(--rose)' }}>long training times</strong> and makes it <strong style={{ color: 'var(--rose)' }}>hard to find good solutions</strong>.</li>
          <li>In high dimensions almost every point sits <strong>near the boundary</strong> of the space, and random points are <strong>far apart</strong> — data becomes extremely sparse, so models risk overfitting.</li>
          <li>In practice the number of features can often be reduced significantly.</li>
        </ul>
        <div className="m4-flabel" style={{ marginTop: '0.6rem' }}>Feature selection vs dimensionality reduction</div>
        <div className="m4-callout">
          In <strong>MNIST</strong>, boundary pixels carry little classification information and can be dropped — that is <strong>feature selection</strong>, a <strong style={{ color: 'var(--amber)' }}>supervised</strong> technique. The DR methods in this lecture (PCA, kPCA, t-SNE…) are <strong style={{ color: 'var(--cyan)' }}>unsupervised</strong> preprocessing for downstream tasks.
        </div>
        <div className="m4-flabel" style={{ marginTop: '0.6rem' }}>Key notes on DR</div>
        <ul className="m4-bullets">
          <li>DR always <strong>loses some information</strong>.</li>
          <li>It speeds up training but may hurt performance and complicate the pipeline.</li>
          <li>Very useful for <strong>data visualisation</strong> (projecting high-dim data to 2D/3D).</li>
        </ul>
      </div>
      <div className="m4-card">
        <div className="m4-card-h">Interactive: how dimensions break intuition</div>
        <div className="m4-ctrl">
          <div className="m4-ctrl-lbl"><span>Number of dimensions d</span><span className="m4-ctrl-val">{d}</span></div>
          <input type="range" min={1} max={15} step={1} value={d} onChange={e => setD(+e.target.value)} />
        </div>
        <div className="m4-stats-row">
          <div className="m4-stat"><span className="m4-stat-l">In outer 10% shell</span><span className="m4-stat-v" style={{ color: 'var(--rose)' }}>{(shell * 100).toFixed(1)}%</span></div>
          <div className="m4-stat"><span className="m4-stat-l">Samples for density</span><span className="m4-stat-v" style={{ color: 'var(--amber)' }}>10^{d}</span></div>
          <div className="m4-stat"><span className="m4-stat-l">Cube diagonal</span><span className="m4-stat-v" style={{ color: 'var(--violet)' }}>{diag.toFixed(2)}</span></div>
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} className="m4-canvas" style={{ marginTop: '0.5rem' }}>
          <line x1={pad} y1={H - 20} x2={W - 8} y2={H - 20} stroke="rgba(148,163,184,0.25)" />
          {Array.from({ length: 15 }, (_, i) => {
            const dd = i + 1, sh = 1 - Math.pow(0.9, dd);
            const bw = (W - pad - 12) / 15;
            const x = pad + i * bw, h = sh * (H - 36);
            return <rect key={i} x={x + 1} y={H - 20 - h} width={bw - 2} height={h} fill={dd === d ? 'var(--cyan)' : 'rgba(34,211,238,0.25)'} rx="1" />;
          })}
          <text x={pad} y={H - 6} fill="rgba(148,163,184,0.5)" fontSize="8" fontFamily="monospace">d=1</text>
          <text x={W - 24} y={H - 6} fill="rgba(148,163,184,0.5)" fontSize="8" fontFamily="monospace">d=15</text>
          <text x={pad} y={12} fill="rgba(148,163,184,0.6)" fontSize="9" fontFamily="monospace">% of volume within 10% of the surface</text>
        </svg>
        <div className="m4-flabel">As d grows, virtually all of the volume — and all your data — concentrates near the surface. A model trained here extrapolates into mostly-empty space.</div>
      </div>
    </div>
  );
}

// 8.2 Projection & manifold learning
function L8Manifold() {
  const [mode, setMode] = useState('roll');
  const W = 460, H = 300;
  const tmin = 1.5 * Math.PI, tmax = 4.5 * Math.PI;
  const hue = t => `hsl(${((t - tmin) / (tmax - tmin)) * 280},75%,60%)`;
  const pos = (t, h) => {
    if (mode === 'roll') { const x = t * Math.cos(t), depth = t * Math.sin(t); return [W / 2 + x * 13, H / 2 - h * 12 - depth * 4 + 30]; }
    if (mode === 'proj') { const x = t * Math.cos(t); return [W / 2 + x * 13, 40 + h * 26]; }
    return [40 + (t - tmin) * 28, 40 + h * 26]; // unrolled
  };
  const note = { roll: 'The Swiss roll: a 2D manifold curled inside 3D. Colour = position along the roll.', proj: 'Naive projection (drop a coordinate): layers of the roll collapse on top of each other — colours overlap, structure destroyed.', unroll: 'Manifold unrolling: recover the intrinsic (t, height) coordinates — colours form a clean gradient, structure preserved.' }[mode];
  return (
    <div className="m4-two-col">
      <div className="m4-card">
        <div className="m4-card-h">Two Approaches to Dimensionality Reduction</div>
        <div className="m4-flabel">1 · Projection</div>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-1)', lineHeight: 1.55 }}>If the data lie close to a lower-dimensional subspace, project onto it. E.g. 3D points near a 2D plane → new coordinates <Tex src="(z_1, z_2)" /> on the plane, reducing 3→2.</p>
        <div className="m4-flabel" style={{ marginTop: '0.5rem' }}>2 · Manifold learning</div>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-1)', lineHeight: 1.55 }}>Projection fails when the subspace <em>twists</em> (the Swiss roll). Dropping a coordinate squashes different layers together — instead we want to <strong>unroll</strong> the manifold.</p>
        <div className="m4-callout" style={{ marginTop: '0.5rem' }}>
          <strong>Manifold:</strong> a <Tex src="d" />-dimensional manifold is part of an <Tex src="n" />-dimensional space (<Tex src="d < n" />) that locally resembles a <Tex src="d" />-dim hyperplane. Swiss roll: <Tex src="d=2,\; n=3" />.
        </div>
        <ul className="m4-bullets" style={{ marginTop: '0.5rem' }}>
          <li>Relies on the <strong>manifold assumption / hypothesis</strong>.</li>
          <li>Implicit 2nd assumption: the task is <em>simpler</em> in the lower-dim manifold.</li>
          <li><strong style={{ color: 'var(--amber)' }}>Caveat:</strong> the decision boundary is <em>not always</em> simpler in lower dimensions — DR speeds training but may not give a better solution.</li>
        </ul>
      </div>
      <div className="m4-card">
        <div className="m4-card-h">Interactive: Swiss Roll</div>
        <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
          <button className={`m4-btn ${mode === 'roll' ? 'm4-btn-p' : ''}`} onClick={() => setMode('roll')}>3D Swiss Roll</button>
          <button className={`m4-btn ${mode === 'proj' ? 'm4-btn-p' : ''}`} onClick={() => setMode('proj')}>Naive Projection</button>
          <button className={`m4-btn ${mode === 'unroll' ? 'm4-btn-p' : ''}`} onClick={() => setMode('unroll')}>Unrolled Manifold</button>
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} className="m4-canvas">
          {L8_SWISS.map((p, i) => { const [x, y] = pos(p[0], p[1]); return <circle key={i} cx={x} cy={y} r="3" fill={hue(p[0])} opacity="0.85" />; })}
        </svg>
        <div className={mode === 'proj' ? 'm4-warnbox' : 'm4-infobox'} style={{ fontSize: '0.79rem', marginTop: '0.5rem' }}>{note}</div>
      </div>
    </div>
  );
}

// 8.3 PCA
function L8PCA() {
  const pca = l8pca2(L8_CLOUD);
  const [deg, setDeg] = useState(Math.round(pca.angle * 180 / Math.PI));
  const theta = deg * Math.PI / 180;
  const v = l8projVar(L8_CLOUD, pca.mx, pca.my, theta);
  const evr1 = pca.l1 / (pca.l1 + pca.l2);
  const best = (Math.abs(((deg - pca.angle * 180 / Math.PI) % 180 + 270) % 180 - 90)) > 82;
  const W = 360, H = 300, sc = 13, cx = W / 2, cy = H / 2;
  const sx = x => cx + (x - 5) * sc, sy = y => cy - (y - 5) * sc;
  const ux = Math.cos(theta), uy = Math.sin(theta);
  return (
    <div>
      <div className="m4-two-col">
        <div className="m4-card">
          <div className="m4-card-h">Principal Component Analysis</div>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-1)', lineHeight: 1.55 }}>PCA is a <strong>linear</strong> DR technique. It finds the hyperplane closest to the data and projects onto it. Key idea: <strong style={{ color: 'var(--cyan)' }}>find the projection that preserves as much variance as possible.</strong></p>
          <ul className="m4-bullets">
            <li><strong>1st axis</strong>: direction of largest variance.</li>
            <li><strong>2nd axis</strong>: orthogonal to the 1st, next-largest variance — and so on.</li>
            <li>The unit vector of the <Tex src="i" />-th axis is the <Tex src="i" />-th <strong>principal axis</strong>; projecting a point onto it gives a <strong>principal component (PC)</strong>. The <em>sign/direction</em> of each axis is not unique.</li>
          </ul>
          <div className="m4-flabel">Finding axes via SVD (mean-centred X)</div>
          <div className="m4-eq"><Tex src="\mathbf{X} = \mathbf{U}\,\boldsymbol{\Sigma}\,\mathbf{V}^\top" block /></div>
          <VarTable vars={[
            ['\\mathbf{X}', 'm×n data matrix (one centred point per row)'],
            ['\\mathbf{V}', 'n×n — its columns are the principal axes c₁,…,cₙ'],
            ['\\boldsymbol{\\Sigma}', 'n×n diagonal of singular values, sorted decreasing'],
            ['\\mathbf{U}', 'm×n'],
          ]} />
          <div className="m4-callout" style={{ marginTop: '0.5rem' }}>To reduce to <Tex src="d" /> dimensions, keep only the top <Tex src="d" /> singular values: <Tex src="\mathbf{X}\approx\widetilde{\mathbf{U}}\,\widetilde{\boldsymbol{\Sigma}}\,\widetilde{\mathbf{V}}^\top" /> (sizes <Tex src="m\times d" />, <Tex src="d\times d" />, <Tex src="n\times d" />). Note <code style={{ fontFamily: 'var(--font-mono)' }}>np.linalg.svd</code> returns <Tex src="\mathbf{s}" /> as a <em>vector</em> (not a diagonal matrix) and returns <Tex src="\mathbf{V}^\top" /> — hence <code style={{ fontFamily: 'var(--font-mono)' }}>Vt.T</code>.</div>
          <PyBlock code={`X_centered = X - X.mean(axis=0)
U, s, Vt = np.linalg.svd(X_centered)
c1 = Vt.T[:, 0]      # 1st principal axis
c2 = Vt.T[:, 1]      # 2nd principal axis`} />
          <div className="m4-flabel">Project onto first d axes <Tex src="\mathbf{W}_d" /> (first d columns of V)</div>
          <div className="m4-eq"><Tex src="\mathbf{X}_{d\text{-proj}} = \mathbf{X}\,\mathbf{W}_d" block /></div>
          <PyBlock code={`W2 = Vt.T[:, :2]
X2D = X_centered.dot(W2)

# scikit-learn equivalent
from sklearn.decomposition import PCA
pca = PCA(n_components=2)
X2D = pca.fit_transform(X)
pca.components_.T[:, 0]   # 1st PC axis`} />
        </div>
        <div className="m4-card">
          <div className="m4-card-h">Interactive: maximise the variance</div>
          <div className="m4-ctrl">
            <div className="m4-ctrl-lbl"><span>Projection axis angle</span><span className="m4-ctrl-val">{deg}°</span></div>
            <input type="range" min={0} max={180} step={1} value={deg} onChange={e => setDeg(+e.target.value)} />
          </div>
          <div className="m4-stats-row">
            <div className="m4-stat"><span className="m4-stat-l">Variance on axis</span><span className="m4-stat-v" style={{ color: 'var(--cyan)' }}>{v.toFixed(2)}</span></div>
            <div className="m4-stat"><span className="m4-stat-l">Max (PC1)</span><span className="m4-stat-v" style={{ color: 'var(--emerald)' }}>{pca.l1.toFixed(2)}</span></div>
          </div>
          <svg viewBox={`0 0 ${W} ${H}`} className="m4-canvas">
            <line x1={cx - ux * 150} y1={cy + uy * 150} x2={cx + ux * 150} y2={cy - uy * 150} stroke="var(--cyan)" strokeWidth="2" strokeDasharray="4 3" opacity="0.85" />
            {L8_CLOUD.map((p, i) => {
              const t = (p[0] - pca.mx) * ux + (p[1] - pca.my) * uy;
              const px = pca.mx + t * ux, py = pca.my + t * uy;
              return <g key={i}><line x1={sx(p[0])} y1={sy(p[1])} x2={sx(px)} y2={sy(py)} stroke="rgba(148,163,184,0.2)" /><circle cx={sx(p[0])} cy={sy(p[1])} r="2.6" fill="var(--violet)" opacity="0.8" /><circle cx={sx(px)} cy={sy(py)} r="2" fill="var(--cyan)" /></g>;
            })}
            <line x1={sx(pca.mx)} y1={sy(pca.my)} x2={sx(pca.mx + Math.cos(pca.angle) * Math.sqrt(pca.l1))} y2={sy(pca.my + Math.sin(pca.angle) * Math.sqrt(pca.l1))} stroke="var(--emerald)" strokeWidth="2.5" />
            <line x1={sx(pca.mx)} y1={sy(pca.my)} x2={sx(pca.mx + Math.cos(pca.angle + Math.PI / 2) * Math.sqrt(pca.l2))} y2={sy(pca.my + Math.sin(pca.angle + Math.PI / 2) * Math.sqrt(pca.l2))} stroke="var(--amber)" strokeWidth="2.5" />
          </svg>
          <div className={best ? 'm4-infobox' : 'm4-warnbox'} style={{ fontSize: '0.79rem' }}>
            {best ? '✓ You are near PC1 — variance of the projected points is maximised here.' : 'Rotate the dashed axis: the projected (cyan) points spread out most along the green PC1 direction.'}
          </div>
          <div className="m4-flabel" style={{ marginTop: '0.4rem' }}>Explained variance ratio ≈ [{evr1.toFixed(3)}, {(1 - evr1).toFixed(3)}] — green PC1 keeps {(evr1 * 100).toFixed(0)}% of the variance.</div>
        </div>
      </div>
      <L89Quiz title="Quick check — PCA" items={[
        { q: 'Why must the data be mean-centred before running np.linalg.svd for PCA?', opts: ['To make all features the same scale', 'So the principal axes pass through the data’s centre (origin), correctly capturing variance directions', 'To remove outliers', 'It is optional and only speeds up SVD'], ans: 1, ok: 'PCA measures variance about the mean; centring puts the origin at the mean so the SVD axes are true variance directions.', ng: 'Centring (not scaling) is what matters here: variance is defined about the mean, so the origin must sit at the mean.' },
        { q: 'np.linalg.svd returns Vt. How do you get the first principal axis?', opts: ['Vt[0]', 'Vt.T[:, 0]', 'U[:, 0]', 's[0]'], ans: 1, ok: 'svd returns Vᵀ, so the columns of V = Vt.T; the 1st PC axis is Vt.T[:, 0].', ng: 'svd returns Vᵀ. Transpose it (Vt.T) and take column 0 to get the first principal axis.' },
      ]} />
    </div>
  );
}

// 8.4 Choosing d & compression
function L8ChooseDim() {
  const [target, setTarget] = useState(95);
  const cum = []; let s = 0; for (const e of L8_EVR) { s += e; cum.push(s); }
  const d = cum.findIndex(c => c >= target / 100) + 1;
  const W = 460, H = 200, pad = 30;
  const sx = i => pad + (i / (L8_EVR.length - 1)) * (W - pad - 12);
  const sy = c => H - 24 - c * (H - 40);
  return (
    <div className="m4-two-col">
      <div className="m4-card">
        <div className="m4-card-h">Choosing the Number of Dimensions</div>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-1)', lineHeight: 1.55 }}>Keep enough PCs to retain a target fraction of total variance (commonly <strong>95%</strong>).</p>
        <PyBlock code={`pca = PCA()
pca.fit(X)
cumsum = np.cumsum(pca.explained_variance_ratio_)
d = np.argmax(cumsum >= 0.95) + 1

# simpler equivalent:
pca = PCA(n_components=0.95)
X_reduced = pca.fit_transform(X)`} />
        <div className="m4-flabel">Or look for the <strong>elbow</strong> where explained variance stops growing quickly.</div>
        <div className="m4-flabel" style={{ marginTop: '0.6rem' }}>PCA for compression & reconstruction</div>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-1)', lineHeight: 1.55 }}>On <strong>MNIST</strong>, dropping just 5% of variance reduces <strong style={{ color: 'var(--cyan)' }}>784 → 154</strong> dimensions, greatly speeding up downstream classifiers (e.g. SVM).</p>
        <div className="m4-eq"><Tex src="\mathbf{X}_{\text{recovered}} = \mathbf{X}_{d\text{-proj}}\,\mathbf{W}_d^\top" block /></div>
        <PyBlock code={`pca = PCA(n_components=154)
X_reduced = pca.fit_transform(X)
X_recovered = pca.inverse_transform(X_reduced)
# mean squared distance original↔recovered = reconstruction error`} />
      </div>
      <div className="m4-card">
        <div className="m4-card-h">Interactive: variance vs dimensions</div>
        <div className="m4-ctrl">
          <div className="m4-ctrl-lbl"><span>Target variance to retain</span><span className="m4-ctrl-val">{target}%</span></div>
          <input type="range" min={50} max={100} step={1} value={target} onChange={e => setTarget(+e.target.value)} />
        </div>
        <div className="m4-stats-row">
          <div className="m4-stat"><span className="m4-stat-l">Dimensions kept</span><span className="m4-stat-v" style={{ color: 'var(--cyan)' }}>{d}</span></div>
          <div className="m4-stat"><span className="m4-stat-l">of total</span><span className="m4-stat-v" style={{ color: 'var(--text-2)' }}>{L8_EVR.length}</span></div>
          <div className="m4-stat"><span className="m4-stat-l">Retained</span><span className="m4-stat-v" style={{ color: 'var(--emerald)' }}>{(cum[d - 1] * 100).toFixed(1)}%</span></div>
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} className="m4-canvas">
          <line x1={pad} y1={H - 24} x2={W - 8} y2={H - 24} stroke="rgba(148,163,184,0.25)" />
          <line x1={pad} y1={24} x2={pad} y2={H - 24} stroke="rgba(148,163,184,0.25)" />
          <line x1={pad} y1={sy(target / 100)} x2={W - 8} y2={sy(target / 100)} stroke="var(--amber)" strokeDasharray="4 3" opacity="0.7" />
          <polyline fill="none" stroke="var(--cyan)" strokeWidth="2" points={cum.map((c, i) => `${sx(i)},${sy(c)}`).join(' ')} />
          {cum.map((c, i) => <circle key={i} cx={sx(i)} cy={sy(c)} r={i === d - 1 ? 4 : 2.2} fill={i === d - 1 ? 'var(--emerald)' : 'var(--cyan)'} />)}
          <line x1={sx(d - 1)} y1={24} x2={sx(d - 1)} y2={H - 24} stroke="var(--emerald)" strokeDasharray="3 3" opacity="0.6" />
          <text x={pad} y={16} fill="rgba(148,163,184,0.6)" fontSize="9" fontFamily="monospace">cumulative explained variance</text>
          <text x={W - 60} y={H - 10} fill="rgba(148,163,184,0.5)" fontSize="8" fontFamily="monospace">dimensions →</text>
        </svg>
        <div className="m4-infobox" style={{ fontSize: '0.79rem' }}>The curve rises fast then flattens — the <strong>elbow</strong>. Choosing <Tex src="d" /> at 95% keeps nearly all signal while discarding many dimensions.</div>
      </div>
    </div>
  );
}

// 8.5 PCA variants
function L8Variants() {
  const [d, setD] = useState(30);
  const n = 200;
  const std = n * n + n * n * n / 1000;            // ~O(mn²)+O(n³) (scaled)
  const rnd = n * d + d * d * d / 1000;             // ~O(md²)+O(d³)
  const speed = std / rnd;
  const W = 460, H = 90;
  const mx = Math.max(std, rnd);
  return (
    <div className="m4-two-col">
      <div className="m4-card">
        <div className="m4-card-h">Randomized & Incremental PCA</div>
        <div className="m4-flabel">Randomized PCA</div>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-1)', lineHeight: 1.55 }}>A stochastic approximation of the top <Tex src="d" /> PCs — dramatically faster when <Tex src="d \ll n" />.</p>
        <div className="m4-eq"><Tex src="O(m d^2) + O(d^3) \;\;\text{vs std}\;\; O(m n^2) + O(n^3)" block /></div>
        <PyBlock code={`rnd_pca = PCA(n_components=154, svd_solver="randomized")
X_reduced = rnd_pca.fit_transform(X_train)`} />
        <div className="m4-flabel" style={{ marginTop: '0.6rem' }}>Incremental PCA (IPCA)</div>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-1)', lineHeight: 1.55 }}>Standard PCA needs the whole dataset in memory. IPCA processes <strong>mini-batches</strong> → enables online learning (or use NumPy <code style={{ fontFamily: 'var(--font-mono)' }}>memmap</code> for large arrays).</p>
        <PyBlock code={`from sklearn.decomposition import IncrementalPCA
inc_pca = IncrementalPCA(n_components=154)
for X_batch in np.array_split(X_train, 100):
    inc_pca.partial_fit(X_batch)
X_reduced = inc_pca.transform(X_train)`} />
      </div>
      <div className="m4-card">
        <div className="m4-card-h">Interactive: randomized speed-up (n = {n})</div>
        <div className="m4-ctrl">
          <div className="m4-ctrl-lbl"><span>Target components d</span><span className="m4-ctrl-val">{d}</span></div>
          <input type="range" min={2} max={200} step={1} value={d} onChange={e => setD(+e.target.value)} />
        </div>
        <div className="m4-stats-row">
          <div className="m4-stat"><span className="m4-stat-l">Speed-up (randomized)</span><span className="m4-stat-v" style={{ color: speed > 1 ? 'var(--emerald)' : 'var(--rose)' }}>{speed.toFixed(1)}×</span></div>
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} className="m4-canvas">
          <text x={6} y={24} fill="var(--violet)" fontSize="10" fontFamily="monospace">Standard</text>
          <rect x={90} y={14} width={(std / mx) * (W - 110)} height={18} fill="var(--violet)" rx="2" />
          <text x={6} y={60} fill="var(--cyan)" fontSize="10" fontFamily="monospace">Randomized</text>
          <rect x={90} y={50} width={(rnd / mx) * (W - 110)} height={18} fill="var(--cyan)" rx="2" />
        </svg>
        <div className="m4-infobox" style={{ fontSize: '0.79rem' }}>When <Tex src="d \ll n" /> the randomized solver is far cheaper. As <Tex src="d \to n" /> the advantage vanishes (and standard SVD is more accurate).</div>
        <table className="m4-table" style={{ marginTop: '0.6rem', width: '100%', fontSize: '0.76rem', borderCollapse: 'collapse' }}>
          <tbody>
            <tr><td style={{ padding: '0.3rem', color: 'var(--text-2)' }}>Standard</td><td style={{ padding: '0.3rem', fontFamily: 'var(--font-mono)', color: 'var(--violet)' }}>O(mn²)+O(n³)</td></tr>
            <tr><td style={{ padding: '0.3rem', color: 'var(--text-2)' }}>Randomized</td><td style={{ padding: '0.3rem', fontFamily: 'var(--font-mono)', color: 'var(--cyan)' }}>O(md²)+O(d³)</td></tr>
            <tr><td style={{ padding: '0.3rem', color: 'var(--text-2)' }}>Incremental</td><td style={{ padding: '0.3rem', fontFamily: 'var(--font-mono)', color: 'var(--emerald)' }}>mini-batch / online</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// 8.6 Feature normalization + Kernel PCA
function L8KernelPCA() {
  const [kernel, setKernel] = useState('linear');
  const [gamma, setGamma] = useState(10);
  const W = 360, H = 280, sc = 26, cx = W / 2, cy = H / 2;
  const sx = x => cx + (x - 5) * sc, sy = y => cy - (y - 5) * sc;
  // embedding: 1st kernel-PCA-like component as a function of radius for rbf/sigmoid
  const embed = p => {
    const r = Math.hypot(p[0] - 5, p[1] - 5);
    if (kernel === 'linear') return (p[0] - 5);                       // linear PCA: a direction in the plane → rings overlap
    if (kernel === 'rbf') return Math.exp(-(gamma / 30) * (r - 2.5) * (r - 2.5)) * 6 - 3;  // separates by radius
    return Math.tanh((gamma / 30) * (r - 2.5)) * 3;                   // sigmoid
  };
  const EW = 360, EH = 90;
  return (
    <div>
      <div className="m4-card" style={{ marginBottom: '1rem' }}>
        <div className="m4-card-h">Feature Normalisation before PCA</div>
        <ul className="m4-bullets">
          <li>When features have <strong>different units</strong> (Diabetes: age in years, BMI in kg/m², BP in mmHg) → <strong>scale to unit standard deviation</strong> before PCA.</li>
          <li>If features share units but are <strong>uncorrelated</strong>, normalisation may destroy useful relative-scale info → may be unsuitable.</li>
          <li>If features are <strong>correlated</strong> (Iris petal length vs width), normalisation is fine.</li>
        </ul>
        <div className="m4-flabel">Iris — variance along 2 principal axes</div>
        <table style={{ width: '100%', fontSize: '0.78rem', borderCollapse: 'collapse' }}>
          <tbody>
            <tr><td style={{ padding: '0.3rem', color: 'var(--text-2)' }}>Before normalisation</td><td style={{ padding: '0.3rem', fontFamily: 'var(--font-mono)', color: 'var(--cyan)' }}>[0.99025, 0.00975]</td></tr>
            <tr><td style={{ padding: '0.3rem', color: 'var(--text-2)' }}>After normalisation</td><td style={{ padding: '0.3rem', fontFamily: 'var(--font-mono)', color: 'var(--violet)' }}>[0.98143, 0.01857]</td></tr>
          </tbody>
        </table>
      </div>
      <div className="m4-two-col">
        <div className="m4-card">
          <div className="m4-card-h">Kernel PCA (kPCA)</div>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-1)', lineHeight: 1.55 }}>The <strong>kernel trick</strong> implicitly maps instances to a high-dim space, enabling nonlinear projections. Concentric circles are <strong style={{ color: 'var(--rose)' }}>not linearly separable</strong> in 2D.</p>
          <div className="m4-flabel">Explicit: polynomial features + PCA</div>
          <PyBlock code={`poly = PolynomialFeatures(degree=5)
Xpoly = poly.fit_transform(X_train)   # (750, 21)
LogisticRegression().fit(Xpoly, y)    # train/test acc = 1.00
pca = PCA(n_components=5)              # 21 -> 5, still 1.00`} />
          <div className="m4-flabel">Implicit: KernelPCA with RBF</div>
          <PyBlock code={`kernel_pca = KernelPCA(n_components=2, kernel="rbf",
        gamma=10, fit_inverse_transform=True, alpha=0.1)
Xrbf = kernel_pca.fit_transform(X_train)
LogisticRegression().fit(Xrbf, y)     # train 1.00, test 0.988`} />
          <div className="m4-callout"><strong>Swiss-roll kernels:</strong> linear → circular layout (no unroll); RBF (γ=0.04) → curved/triangular; sigmoid (γ=10⁻³, r=1) → tight ring.</div>
        </div>
        <div className="m4-card">
          <div className="m4-card-h">Interactive: kernel choice on circles</div>
          <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.5rem' }}>
            <button className={`m4-btn ${kernel === 'linear' ? 'm4-btn-p' : ''}`} onClick={() => setKernel('linear')}>Linear</button>
            <button className={`m4-btn ${kernel === 'rbf' ? 'm4-btn-p' : ''}`} onClick={() => setKernel('rbf')}>RBF</button>
            <button className={`m4-btn ${kernel === 'sigmoid' ? 'm4-btn-p' : ''}`} onClick={() => setKernel('sigmoid')}>Sigmoid</button>
          </div>
          {kernel !== 'linear' && (
            <div className="m4-ctrl">
              <div className="m4-ctrl-lbl"><span>γ (gamma)</span><span className="m4-ctrl-val">{gamma}</span></div>
              <input type="range" min={1} max={40} step={1} value={gamma} onChange={e => setGamma(+e.target.value)} />
            </div>
          )}
          <svg viewBox={`0 0 ${W} ${H}`} className="m4-canvas">
            {L8_CIRCLES.map((p, i) => <circle key={i} cx={sx(p[0])} cy={sy(p[1])} r="3" fill={p[2] === 0 ? 'var(--cyan)' : 'var(--rose)'} opacity="0.8" />)}
            <text x={8} y={16} fill="rgba(148,163,184,0.6)" fontSize="9" fontFamily="monospace">input space (2D)</text>
          </svg>
          <div className="m4-flabel" style={{ marginTop: '0.4rem' }}>1st component after the {kernel} kernel:</div>
          <svg viewBox={`0 0 ${EW} ${EH}`} className="m4-canvas">
            <line x1={10} y1={EH / 2} x2={EW - 10} y2={EH / 2} stroke="rgba(148,163,184,0.25)" />
            {L8_CIRCLES.map((p, i) => { const e = embed(p); const x = EW / 2 + e * 24; return <circle key={i} cx={Math.max(8, Math.min(EW - 8, x))} cy={EH / 2 + (p[2] === 0 ? -10 : 10)} r="3" fill={p[2] === 0 ? 'var(--cyan)' : 'var(--rose)'} opacity="0.75" />; })}
          </svg>
          <div className={kernel === 'linear' ? 'm4-warnbox' : 'm4-infobox'} style={{ fontSize: '0.79rem' }}>{kernel === 'linear' ? 'Linear kPCA = ordinary PCA: the two rings still overlap — not separable.' : 'The nonlinear kernel pulls the inner and outer rings apart into two separable bands along one component.'}</div>
        </div>
      </div>
    </div>
  );
}

// 8.7 Other techniques + summary
function L8Other() {
  const W = 360, H = 280, sc = 26, cx = W / 2, cy = H / 2;
  const sx = x => cx + (x - 5) * sc, sy = y => cy - (y - 5) * sc;
  const techs = [
    { name: 'LLE', color: 'var(--cyan)', desc: 'Locally Linear Embedding — manifold learning that does NOT use projection; preserves local linear relationships.' },
    { name: 'MDS', color: 'var(--violet)', desc: 'Multidimensional Scaling — preserves the pairwise distances between instances.' },
    { name: 'Isomap', color: 'var(--emerald)', desc: 'Builds a k-nearest-neighbour graph and preserves geodesic distances along the manifold.' },
    { name: 't-SNE', color: 'var(--amber)', desc: 'Keeps similar instances close and dissimilar ones apart; mostly for visualisation (van der Maaten & Hinton, JMLR 2008).' },
  ];
  return (
    <div>
      <div className="m4-card" style={{ marginBottom: '1rem' }}>
        <div className="m4-card-h">Other Dimensionality Reduction Techniques</div>
        <div className="m4-card-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.7rem' }}>
          {techs.map(t => (
            <div key={t.name} style={{ background: `${t.color}08`, border: `1px solid ${t.color}30`, borderRadius: 6, padding: '0.8rem' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', fontWeight: 700, color: t.color, marginBottom: '0.35rem' }}>{t.name}</div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-2)', lineHeight: 1.5 }}>{t.desc}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="m4-two-col">
        <div className="m4-card">
          <div className="m4-card-h">t-SNE on MNIST (784 → 2D)</div>
          <PyBlock code={`from sklearn.manifold import TSNE
X_sample = X_train[:5000]            # subset for speed
tsne = TSNE(n_components=2, init="random",
            learning_rate="auto", random_state=42)
X_reduced = tsne.fit_transform(X_sample)   # ~38 s`} />
          <svg viewBox={`0 0 ${W} ${H}`} className="m4-canvas">
            {L8_TSNE.map((p, i) => <circle key={i} cx={sx(p[0])} cy={sy(p[1])} r="2.6" fill={L_COL[p[2]]} opacity="0.85" />)}
          </svg>
          <div className="m4-infobox" style={{ fontSize: '0.79rem' }}>t-SNE produces well-separated clusters in 2D — one per digit class — even though the raw data has 784 dimensions.</div>
        </div>
        <div>
          <L89Quiz title="Match the technique" items={[
            { q: 'You need to UNROLL a Swiss-roll manifold without projecting onto a flat subspace. Which method?', opts: ['PCA', 'LLE (Locally Linear Embedding)', 'Randomized PCA', 'Incremental PCA'], ans: 1, ok: 'LLE is a manifold-learning method that preserves local linear structure without projection — ideal for unrolling.', ng: 'PCA variants are linear projections; unrolling a twisted manifold needs a manifold method like LLE.' },
            { q: 'Your goal is to VISUALISE clusters in high-dimensional data in 2D. Best choice?', opts: ['MDS', 't-SNE', 'Isomap', 'Standard PCA'], ans: 1, ok: 't-SNE keeps similar points close and dissimilar far apart — purpose-built for 2D cluster visualisation.', ng: 't-SNE is the standard for revealing clusters in a 2D visualisation.' },
            { q: 'Which method preserves geodesic (along-the-manifold) distances using a k-NN graph?', opts: ['Isomap', 'MDS', 'PCA', 'Kernel PCA'], ans: 0, ok: 'Isomap builds a k-NN graph and preserves geodesic distances measured along the manifold.', ng: 'Isomap is the one that uses a k-NN graph + geodesic distances.' },
          ]} />
          <div className="m4-card" style={{ marginTop: '1rem' }}>
            <div className="m4-card-h">Lecture 8 — Summary</div>
            <ul className="m4-bullets">
              <li>The curse of dimensionality motivates DR; DR always loses some information.</li>
              <li><strong>PCA</strong>: max-variance linear projection via SVD; choose <Tex src="d" /> by retained variance.</li>
              <li>Variants: <strong>Randomized</strong> (fast when <Tex src="d\ll n" />), <strong>Incremental</strong> (mini-batch), <strong>Kernel PCA</strong> (nonlinear).</li>
              <li>Manifold methods: LLE, MDS, Isomap, t-SNE. Understand the data to pick the right DR; visualisation helps.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// LECTURE 9 COMPONENTS
// ════════════════════════════════════════════════════════════════════════════

// 9.1 Introduction
function L9Intro() {
  const [mode, setMode] = useState('clf');
  const W = 360, H = 280;
  const sx = x => 20 + x * 30, sy = y => H - 20 - y * 30;
  // simple 2-blob set for the toggle
  const data = L9_BLOBS.slice(0, 64);
  const true2 = i => (data[i][0] + data[i][1] > 10 ? 1 : 0);
  const apps = ['Fraud detection', 'Defective-product detection', 'Recommender systems', 'Semi-supervised learning', 'Image segmentation', 'Image retrieval', 'Anomaly detection'];
  return (
    <div className="m4-two-col">
      <div className="m4-card">
        <div className="m4-card-h">Unsupervised Learning & Clustering</div>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-1)', lineHeight: 1.55 }}>This chapter focuses on two clustering algorithms — <strong style={{ color: 'var(--cyan)' }}>k-means</strong> and <strong style={{ color: 'var(--violet)' }}>DBSCAN</strong>.</p>
        <div className="m4-flabel">Common applications</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
          {apps.map(a => <span key={a} style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)', color: 'var(--text-2)', background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 4, padding: '0.2em 0.5em' }}>{a}</span>)}
        </div>
        <div className="m4-flabel" style={{ marginTop: '0.7rem' }}>Clustering vs classification</div>
        <ul className="m4-bullets">
          <li><strong>Classification</strong>: supervised — every instance has a known class label.</li>
          <li><strong>Clustering</strong>: unsupervised — the algorithm groups similar instances with <strong>no labels given</strong>.</li>
          <li>No universal definition of a "cluster":
            <br /><strong style={{ color: 'var(--cyan)' }}>Centroid-based</strong> (k-means) — grouped around a central point.
            <br /><strong style={{ color: 'var(--violet)' }}>Density-based</strong> (DBSCAN) — dense regions of any shape.</li>
        </ul>
      </div>
      <div className="m4-card">
        <div className="m4-card-h">Interactive: same data, two questions</div>
        <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.5rem' }}>
          <button className={`m4-btn ${mode === 'clf' ? 'm4-btn-p' : ''}`} onClick={() => setMode('clf')}>Classification (labels given)</button>
          <button className={`m4-btn ${mode === 'clu' ? 'm4-btn-p' : ''}`} onClick={() => setMode('clu')}>Clustering (no labels)</button>
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} className="m4-canvas">
          {mode === 'clf' && <line x1={sx(0)} y1={sy(10)} x2={sx(10)} y2={sy(0)} stroke="var(--amber)" strokeDasharray="5 4" opacity="0.7" />}
          {data.map((p, i) => <circle key={i} cx={sx(p[0])} cy={sy(p[1])} r="3.2" fill={mode === 'clf' ? (true2(i) ? 'var(--cyan)' : 'var(--rose)') : 'var(--text-2)'} opacity="0.85" />)}
        </svg>
        <div className="m4-infobox" style={{ fontSize: '0.79rem' }}>{mode === 'clf' ? 'Classification: colours are KNOWN labels; the model learns the boundary (dashed) from them.' : 'Clustering: NO labels — the algorithm must discover groups from structure alone.'}</div>
      </div>
    </div>
  );
}

// 9.2 K-Means stepper
function L9KMeans() {
  const [k, setK] = useState(4);
  const [seed, setSeed] = useState(1);
  const [step, setStep] = useState(0);
  const init = (() => { const rand = makePRNG(seed * 97 + 5); const idx = []; while (idx.length < k) { const i = Math.floor(rand() * L9_BLOBS.length); if (!idx.includes(i)) idx.push(i); } return idx; })();
  const hist = l9kmeansHistory(L9_BLOBS, k, init);
  const cur = hist[Math.min(step, hist.length - 1)];
  const W = 360, H = 300, sc = 27, ox = 18, oy = 18;
  const sx = x => ox + x * sc, sy = y => H - oy - y * sc;
  const reset = (nk, ns) => { setK(nk); setSeed(ns); setStep(0); };
  return (
    <div>
      <div className="m4-two-col">
        <div className="m4-card">
          <div className="m4-card-h">The K-Means Algorithm</div>
          <ol style={{ fontSize: '0.82rem', color: 'var(--text-1)', lineHeight: 1.6, paddingLeft: '1.1rem' }}>
            <li>Choose <Tex src="k" /> (number of clusters).</li>
            <li>Initialise <Tex src="k" /> centroids randomly (e.g. pick <Tex src="k" /> random instances).</li>
            <li><strong style={{ color: 'var(--cyan)' }}>Assign</strong> each instance to the closest centroid (Euclidean distance).</li>
            <li><strong style={{ color: 'var(--amber)' }}>Update</strong> each centroid to the mean of its assigned instances.</li>
            <li>Repeat 3–4 until centroids stop moving → converged.</li>
          </ol>
          <div className="m4-callout"><strong>Convergence guarantee:</strong> the mean squared distance to the closest centroid decreases monotonically and is bounded below by 0 → converges in a finite number of steps (possibly to a local optimum).</div>
          <PyBlock code={`from sklearn.cluster import KMeans
kmeans = KMeans(n_clusters=5, random_state=42)
y_pred = kmeans.fit_predict(X)
kmeans.labels_            # cluster IDs (= y_pred)
kmeans.cluster_centers_   # the k centroids
kmeans.predict(X_new)     # hard cluster label for new points
kmeans.transform(X_new)   # distance to every centroid (soft)`} />
          <table style={{ width: '100%', fontSize: '0.75rem', borderCollapse: 'collapse', marginTop: '0.4rem' }}>
            <tbody>
              <tr><td style={{ padding: '0.3rem', color: 'var(--cyan)', fontWeight: 700 }}>Hard</td><td style={{ padding: '0.3rem', color: 'var(--text-2)' }}>vector of m IDs in {'{0,…,k−1}'}</td></tr>
              <tr><td style={{ padding: '0.3rem', color: 'var(--violet)', fontWeight: 700 }}>Soft</td><td style={{ padding: '0.3rem', color: 'var(--text-2)' }}>m×k scores (e.g. inverse distance)</td></tr>
            </tbody>
          </table>
          <div className="m4-flabel" style={{ marginTop: '0.4rem' }}>⚠ Predicted cluster IDs need not match the ground-truth label order — clusters can be numbered in any order.</div>
        </div>
        <div className="m4-card">
          <div className="m4-card-h">Interactive: step through k-means</div>
          <div className="m4-ctrl">
            <div className="m4-ctrl-lbl"><span>k (clusters)</span><span className="m4-ctrl-val">{k}</span></div>
            <input type="range" min={2} max={6} step={1} value={k} onChange={e => reset(+e.target.value, seed)} />
          </div>
          <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
            <button className="m4-btn m4-btn-g" onClick={() => setStep(s => Math.min(s + 1, hist.length - 1))}>Step →</button>
            <button className="m4-btn" onClick={() => setStep(0)}>Reset</button>
            <button className="m4-btn" onClick={() => reset(k, seed + 1)}>New init</button>
            <button className="m4-btn m4-btn-p" onClick={() => setStep(hist.length - 1)}>Converge</button>
          </div>
          <svg viewBox={`0 0 ${W} ${H}`} className="m4-canvas">
            {/* Voronoi-ish background by nearest centroid */}
            {Array.from({ length: 270 }, (_, idx) => {
              const gx = idx % 18, gy = Math.floor(idx / 18);
              const X = gx / 17 * 10, Y = gy / 14 * 10; let bi = 0, bd = Infinity;
              cur.cent.forEach((c, j) => { const d = (X - c[0]) ** 2 + (Y - c[1]) ** 2; if (d < bd) { bd = d; bi = j; } });
              return <rect key={idx} x={sx(X) - 11} y={sy(Y) - 11} width={22} height={22} fill={L_COL[bi]} opacity="0.06" />;
            })}
            {L9_BLOBS.map((p, i) => <circle key={i} cx={sx(p[0])} cy={sy(p[1])} r="3" fill={L_COL[cur.assign[i]]} opacity="0.85" />)}
            {cur.cent.map((c, j) => <g key={j}><line x1={sx(c[0]) - 6} y1={sy(c[1])} x2={sx(c[0]) + 6} y2={sy(c[1])} stroke="#fff" strokeWidth="2.5" /><line x1={sx(c[0])} y1={sy(c[1]) - 6} x2={sx(c[0])} y2={sy(c[1]) + 6} stroke="#fff" strokeWidth="2.5" /><circle cx={sx(c[0])} cy={sy(c[1])} r="5" fill="none" stroke={L_COL[j]} strokeWidth="2.5" /></g>)}
          </svg>
          <div className="m4-stats-row">
            <div className="m4-stat"><span className="m4-stat-l">Iteration</span><span className="m4-stat-v" style={{ color: 'var(--cyan)' }}>{Math.min(step, hist.length - 1) + 1}/{hist.length}</span></div>
            <div className="m4-stat"><span className="m4-stat-l">Inertia</span><span className="m4-stat-v" style={{ color: 'var(--amber)' }}>{cur.inertia.toFixed(1)}</span></div>
          </div>
          <div className="m4-flabel">✕ = centroid. Background shading shows the <strong>Voronoi cells</strong> (each cell = nearest-centroid region; boundaries are perpendicular bisectors).</div>
        </div>
      </div>
    </div>
  );
}

// 9.3 Drawbacks & remedies
function L9Drawbacks() {
  const [k, setK] = useState(4);
  const ks = [1, 2, 3, 4, 5, 6, 7, 8];
  const runs = ks.map(kk => {
    if (kk === 1) { const mx = L9_BLOBS.reduce((a, p) => [a[0] + p[0], a[1] + p[1]], [0, 0]).map(s => s / L9_BLOBS.length); const inertia = L9_BLOBS.reduce((s, p) => s + (p[0] - mx[0]) ** 2 + (p[1] - mx[1]) ** 2, 0); return { inertia, sil: 0, assign: L9_BLOBS.map(() => 0) }; }
    const rand = makePRNG(kk * 31 + 7); const idx = []; while (idx.length < kk) { const i = Math.floor(rand() * L9_BLOBS.length); if (!idx.includes(i)) idx.push(i); }
    const h = l9kmeansHistory(L9_BLOBS, kk, idx); const last = h[h.length - 1];
    return { inertia: last.inertia, sil: l9silhouette(L9_BLOBS, last.assign, kk), assign: last.assign };
  });
  const cur = runs[k - 1];
  const maxI = Math.max(...runs.map(r => r.inertia));
  const W = 230, H = 150, pad = 26;
  return (
    <div>
      <div className="m4-two-col">
        <div className="m4-card">
          <div className="m4-card-h">Drawback 1 — Centroid initialisation</div>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-1)', lineHeight: 1.55 }}>K-means always converges, but may reach a <strong style={{ color: 'var(--rose)' }}>local optimum</strong> depending on the initial centroids.</p>
          <ul className="m4-bullets">
            <li><strong>Method 1:</strong> supply known-good centroids (<code style={{ fontFamily: 'var(--font-mono)' }}>init=good_init, n_init=1</code>).</li>
            <li><strong>Method 2:</strong> run <Tex src="n\_init" /> times (default 10), keep the lowest <strong>inertia</strong>.</li>
            <li><strong>Method 3:</strong> <strong>k-means++</strong> (sklearn default) — spreads initial centroids apart.</li>
          </ul>
          <div className="m4-eq"><Tex src="\text{inertia} = \sum_{i=1}^{m} \lVert \mathbf{x}_i - \mathbf{c}_{\text{closest}(i)} \rVert^2" block /></div>
          <div className="m4-flabel"><code style={{ fontFamily: 'var(--font-mono)' }}>kmeans.inertia_</code> — lower is better; <code style={{ fontFamily: 'var(--font-mono)' }}>kmeans.score(X)</code> returns <Tex src="-\text{inertia}" /> — higher is better.</div>
          <div className="m4-flabel">k-means++ (Arthur &amp; Vassilvitskii, 2007)</div>
          <ol style={{ fontSize: '0.8rem', color: 'var(--text-1)', lineHeight: 1.55, paddingLeft: '1.1rem' }}>
            <li>Pick the 1st centroid uniformly at random.</li>
            <li>Pick each next centroid with probability <Tex src="P(\mathbf{x}_i)=\frac{D(\mathbf{x}_i)^2}{\sum_j D(\mathbf{x}_j)^2}" /> (<Tex src="D" /> = distance to nearest chosen centroid) → far points more likely.</li>
            <li>Repeat until <Tex src="k" /> centroids chosen.</li>
          </ol>
          <div className="m4-callout"><strong>Drawback 3 — cluster shape:</strong> k-means struggles with clusters of varying size, density, or non-spherical (elliptical) shape, because assignment uses only distance to one centroid. <strong style={{ color: 'var(--emerald)' }}>Remedy:</strong> a Gaussian Mixture Model (per-cluster covariance).</div>
        </div>
        <div className="m4-card">
          <div className="m4-card-h">Drawback 2 — choosing k</div>
          <div className="m4-ctrl">
            <div className="m4-ctrl-lbl"><span>k</span><span className="m4-ctrl-val">{k}</span></div>
            <input type="range" min={1} max={8} step={1} value={k} onChange={e => setK(+e.target.value)} />
          </div>
          <div className="m4-stats-row">
            <div className="m4-stat"><span className="m4-stat-l">Inertia</span><span className="m4-stat-v" style={{ color: 'var(--amber)' }}>{cur.inertia.toFixed(0)}</span></div>
            <div className="m4-stat"><span className="m4-stat-l">Silhouette</span><span className="m4-stat-v" style={{ color: cur.sil > 0.5 ? 'var(--emerald)' : 'var(--rose)' }}>{cur.sil.toFixed(3)}</span></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <div>
              <div className="m4-flabel">Elbow (inertia)</div>
              <svg viewBox={`0 0 ${W} ${H}`} className="m4-canvas">
                <polyline fill="none" stroke="var(--amber)" strokeWidth="2" points={runs.map((r, i) => `${pad + (i / 7) * (W - pad - 10)},${H - 22 - (r.inertia / maxI) * (H - 38)}`).join(' ')} />
                {runs.map((r, i) => <circle key={i} cx={pad + (i / 7) * (W - pad - 10)} cy={H - 22 - (r.inertia / maxI) * (H - 38)} r={i === k - 1 ? 4 : 2.4} fill={i === k - 1 ? 'var(--cyan)' : 'var(--amber)'} />)}
                <text x={pad} y={H - 6} fill="rgba(148,163,184,0.5)" fontSize="8" fontFamily="monospace">k=1</text>
                <text x={W - 22} y={H - 6} fill="rgba(148,163,184,0.5)" fontSize="8" fontFamily="monospace">k=8</text>
              </svg>
            </div>
            <div>
              <div className="m4-flabel">Silhouette</div>
              <svg viewBox={`0 0 ${W} ${H}`} className="m4-canvas">
                {runs.map((r, i) => { const bh = Math.max(0, r.sil) * (H - 38); return <rect key={i} x={pad + i * ((W - pad - 8) / 8)} y={H - 22 - bh} width={(W - pad - 8) / 8 - 3} height={bh} fill={i === k - 1 ? 'var(--emerald)' : 'rgba(52,211,153,0.35)'} rx="1" />; })}
                <text x={pad} y={H - 6} fill="rgba(148,163,184,0.5)" fontSize="8" fontFamily="monospace">k=1</text>
              </svg>
            </div>
          </div>
          <div className="m4-eq"><Tex src="s_i = \frac{b - a}{\max(a, b)}\quad s_i\in[-1,1]" block /></div>
          <div className="m4-flabel">a = mean intra-cluster distance; b = mean distance to the nearest other cluster. <strong>Silhouette score</strong> = mean of <Tex src="s_i" /> — higher is better (often more reliable than the elbow).</div>
          <div className="m4-callout" style={{ marginTop: '0.5rem' }}><strong>Silhouette diagram:</strong> draw one horizontal “knife” per cluster (a sorted <Tex src="s_i" /> bar per instance). The dashed line marks the overall score; prefer a <Tex src="k" /> where the knives are similar in size and most reach past the line — even at a slightly lower mean score.</div>
        </div>
      </div>
      <L89Quiz title="Quick check — k-means drawbacks" items={[
        { q: 'Inertia always decreases as k increases, so why can’t we just minimise inertia to choose k?', opts: ['Because inertia is random', 'Because inertia keeps falling toward 0 (k = m gives 0) — it never has a true minimum at the right k; use the elbow or silhouette', 'Because sklearn forbids it', 'Because inertia measures accuracy, not distance'], ans: 1, ok: 'With k = m every point is its own centroid → inertia 0. So you look for the elbow, or maximise the silhouette score instead.', ng: 'More clusters always lower inertia (0 at k=m), so naive minimisation fails — use the elbow or silhouette.' },
        { q: 'k-means clusters two crescent-moon shapes poorly. What is the best remedy from this lecture?', opts: ['Increase n_init', 'Use a Gaussian Mixture Model / a density method — k-means assumes spherical clusters', 'Lower the learning rate', 'Standardise the labels'], ans: 1, ok: 'k-means assumes spherical, similar-size clusters; non-spherical shapes need GMM (covariance) or a density method like DBSCAN.', ng: 'The failure is the spherical-cluster assumption — a GMM (or density-based DBSCAN) handles arbitrary shapes.' },
      ]} />
    </div>
  );
}

// 9.4 Semi-supervised learning
function L9SemiSup() {
  const stages = [
    { n: 0, label: '50 random labels', acc: 74.8, color: 'var(--rose)', code: `log_reg.fit(X_train[:50], y_train[:50])\nlog_reg.score(X_test, y_test)   # 0.748`, note: 'Baseline: train on just 50 randomly-chosen labelled digits.' },
    { n: 1, label: '50 cluster representatives', acc: 84.9, color: 'var(--amber)', code: `kmeans = KMeans(n_clusters=50)\nX_dist = kmeans.fit_transform(X_train)        # 1400×50\nrep_idx = np.argmin(X_dist, axis=0)           # 50 indices\n# manually label the 50 representative images -> 0.849`, note: 'Label the most representative image of each of 50 clusters instead of random ones.' },
    { n: 2, label: 'Full label propagation', acc: 89.4, color: 'var(--cyan)', code: `for i in range(k):\n    y_prop[kmeans.labels_ == i] = y_rep[i]\nlog_reg.fit(X_train, y_prop)                   # 0.894`, note: 'Propagate each representative’s label to every instance in its cluster.' },
    { n: 3, label: 'Partial propagation (drop 1% outliers)', acc: 90.9, color: 'var(--emerald)', code: `# drop the 1% farthest from their centroid, then fit\nlog_reg.score(X_test, y_test)   # 0.909\n(y_part == y_train[part]).mean() # 0.9756 label accuracy`, note: 'Drop the 1% of points farthest from their centroid → 90.9%, beating the 90.7% full-label baseline!' },
  ];
  const [step, setStep] = useState(0);
  const W = 460, H = 210, pad = 30;
  const baseline = 90.7;
  return (
    <div className="m4-two-col">
      <div className="m4-card">
        <div className="m4-card-h">Clustering for Semi-Supervised Learning</div>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-1)', lineHeight: 1.55 }}>Use case: <strong>few labels, abundant unlabelled data</strong>. Demonstrated on <code style={{ fontFamily: 'var(--font-mono)' }}>load_digits</code> (1,797 8×8 digit images; 1,400 train / 397 test).</p>
        <div className="m4-step-row" style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.6rem', flexWrap: 'wrap' }}>
          {stages.map(s => <button key={s.n} className={`m4-btn ${step === s.n ? 'm4-btn-p' : ''}`} onClick={() => setStep(s.n)}>Step {s.n + 1}</button>)}
        </div>
        <div className="m4-flabel" style={{ color: stages[step].color }}>{stages[step].label} — {stages[step].acc}%</div>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-1)', lineHeight: 1.5, margin: '0.3rem 0' }}>{stages[step].note}</p>
        <PyBlock code={stages[step].code} />
        <div className="m4-flabel">Related tools</div>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-2)', fontFamily: 'var(--font-mono)', lineHeight: 1.6 }}>LabelSpreading · LabelPropagation · SelfTrainingClassifier</div>
      </div>
      <div className="m4-card">
        <div className="m4-card-h">Accuracy progression</div>
        <svg viewBox={`0 0 ${W} ${H}`} className="m4-canvas">
          <line x1={pad} y1={H - 24} x2={W - 8} y2={H - 24} stroke="rgba(148,163,184,0.25)" />
          <line x1={pad} y1={H - 24 - (baseline - 70) / 30 * (H - 44)} x2={W - 8} y2={H - 24 - (baseline - 70) / 30 * (H - 44)} stroke="var(--text-2)" strokeDasharray="4 3" opacity="0.6" />
          <text x={W - 120} y={H - 26 - (baseline - 70) / 30 * (H - 44)} fill="rgba(148,163,184,0.6)" fontSize="8" fontFamily="monospace">full-label baseline 90.7%</text>
          {stages.map((s, i) => {
            const bw = (W - pad - 16) / 4, x = pad + i * bw;
            const h = (s.acc - 70) / 30 * (H - 44);
            const on = i <= step;
            return <g key={i}>
              <rect x={x + 4} y={H - 24 - h} width={bw - 10} height={h} fill={on ? s.color : 'rgba(148,163,184,0.15)'} rx="2" />
              <text x={x + bw / 2} y={H - 24 - h - 4} fill={on ? s.color : 'rgba(148,163,184,0.4)'} fontSize="10" fontFamily="monospace" textAnchor="middle">{s.acc}%</text>
              <text x={x + bw / 2} y={H - 10} fill="rgba(148,163,184,0.55)" fontSize="8" fontFamily="monospace" textAnchor="middle">Step {i + 1}</text>
            </g>;
          })}
        </svg>
        <table style={{ width: '100%', fontSize: '0.76rem', borderCollapse: 'collapse', marginTop: '0.5rem' }}>
          <tbody>
            <tr><td style={{ padding: '0.25rem', color: 'var(--text-2)' }}>50 random labels</td><td style={{ padding: '0.25rem', fontFamily: 'var(--font-mono)', color: 'var(--rose)', textAlign: 'right' }}>74.8%</td></tr>
            <tr><td style={{ padding: '0.25rem', color: 'var(--text-2)' }}>50 representatives</td><td style={{ padding: '0.25rem', fontFamily: 'var(--font-mono)', color: 'var(--amber)', textAlign: 'right' }}>84.9%</td></tr>
            <tr><td style={{ padding: '0.25rem', color: 'var(--text-2)' }}>Full propagation</td><td style={{ padding: '0.25rem', fontFamily: 'var(--font-mono)', color: 'var(--cyan)', textAlign: 'right' }}>89.4%</td></tr>
            <tr><td style={{ padding: '0.25rem', color: 'var(--text-2)' }}>Partial (drop 1%)</td><td style={{ padding: '0.25rem', fontFamily: 'var(--font-mono)', color: 'var(--emerald)', textAlign: 'right', fontWeight: 700 }}>90.9%</td></tr>
            <tr><td style={{ padding: '0.25rem', color: 'var(--text-2)' }}>Full ground-truth (1400)</td><td style={{ padding: '0.25rem', fontFamily: 'var(--font-mono)', color: 'var(--text-1)', textAlign: 'right' }}>90.7%</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// 9.5 DBSCAN
function L9DBSCAN() {
  const [eps, setEps] = useState(0.18);
  const [minPts, setMinPts] = useState(5);
  const res = l9dbscan(L9_MOONS, eps, minPts);
  const W = 360, H = 260, ox = 70, oy = 30;
  const sx = x => ox + (x + 1) * 72, sy = y => H - oy - (y + 1) * 72;
  return (
    <div>
      <div className="m4-two-col">
        <div className="m4-card">
          <div className="m4-card-h">DBSCAN</div>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-1)', lineHeight: 1.55 }}>Density-Based Spatial Clustering of Applications with Noise. Two hyperparameters: <Tex src="\epsilon" /> (<code style={{ fontFamily: 'var(--font-mono)' }}>eps</code>) and <code style={{ fontFamily: 'var(--font-mono)' }}>min_samples</code>.</p>
          <ol style={{ fontSize: '0.8rem', color: 'var(--text-1)', lineHeight: 1.55, paddingLeft: '1.1rem' }}>
            <li>For each instance, count neighbours within <Tex src="\epsilon" /> (its <Tex src="\epsilon" />-neighbourhood).</li>
            <li>If that count ≥ <code style={{ fontFamily: 'var(--font-mono)' }}>min_samples</code> → it is a <strong style={{ color: 'var(--cyan)' }}>core</strong> instance (dense region).</li>
            <li>Else, if it lies in a core’s <Tex src="\epsilon" />-neighbourhood → <strong style={{ color: 'var(--violet)' }}>border</strong> point.</li>
            <li>Otherwise → <strong style={{ color: 'var(--rose)' }}>anomaly</strong> (label = −1).</li>
            <li>Chains of adjacent core instances merge into one cluster of <strong>arbitrary shape</strong>.</li>
          </ol>
          <PyBlock code={`from sklearn.cluster import DBSCAN
dbscan = DBSCAN(eps=0.05, min_samples=5)
dbscan.fit(X)
dbscan.labels_              # -1 = anomaly
dbscan.core_sample_indices_
dbscan.components_         # core feature vectors`} />
          <div className="m4-callout"><strong>No <code style={{ fontFamily: 'var(--font-mono)' }}>predict()</code>:</strong> train a KNN on the core samples to label new points; flag <code style={{ fontFamily: 'var(--font-mono)' }}>y_dist {'>'} threshold</code> as anomalies.</div>
        </div>
        <div className="m4-card">
          <div className="m4-card-h">Interactive: DBSCAN on two moons</div>
          <div className="m4-ctrl">
            <div className="m4-ctrl-lbl"><span>eps (ε)</span><span className="m4-ctrl-val">{eps.toFixed(2)}</span></div>
            <input type="range" min={0.04} max={0.30} step={0.01} value={eps} onChange={e => setEps(+e.target.value)} />
          </div>
          <div className="m4-ctrl">
            <div className="m4-ctrl-lbl"><span>min_samples</span><span className="m4-ctrl-val">{minPts}</span></div>
            <input type="range" min={3} max={10} step={1} value={minPts} onChange={e => setMinPts(+e.target.value)} />
          </div>
          <div className="m4-stats-row">
            <div className="m4-stat"><span className="m4-stat-l">Clusters</span><span className="m4-stat-v" style={{ color: 'var(--cyan)' }}>{res.clusters}</span></div>
            <div className="m4-stat"><span className="m4-stat-l">Anomalies</span><span className="m4-stat-v" style={{ color: 'var(--rose)' }}>{res.noise}</span></div>
          </div>
          <svg viewBox={`0 0 ${W} ${H}`} className="m4-canvas">
            {L9_MOONS.map((p, i) => {
              const lab = res.labels[i];
              if (lab === -1) return <g key={i}><line x1={sx(p[0]) - 3} y1={sy(p[1]) - 3} x2={sx(p[0]) + 3} y2={sy(p[1]) + 3} stroke="var(--rose)" strokeWidth="1.4" /><line x1={sx(p[0]) - 3} y1={sy(p[1]) + 3} x2={sx(p[0]) + 3} y2={sy(p[1]) - 3} stroke="var(--rose)" strokeWidth="1.4" /></g>;
              return <circle key={i} cx={sx(p[0])} cy={sy(p[1])} r={res.core[i] ? 3.4 : 2.6} fill={L_COL[lab % L_COL.length]} stroke={res.core[i] ? '#fff' : 'none'} strokeWidth={res.core[i] ? 0.8 : 0} opacity="0.88" />;
            })}
          </svg>
          <div className={res.noise > 40 ? 'm4-warnbox' : 'm4-infobox'} style={{ fontSize: '0.79rem' }}>Small ε → many ✕ anomalies (lecture: eps=0.05 → 84 outliers). Larger ε → fewer anomalies (eps=0.20 → 0) but risks merging distinct clusters.</div>
        </div>
      </div>
      <div className="m4-two-col">
        <div className="m4-card">
          <div className="m4-card-h">Pros</div>
          <ul className="m4-bullets">
            <li>Finds clusters of <strong>any shape</strong>.</li>
            <li>Detects the number of clusters automatically.</li>
            <li>Only <strong>two</strong> hyperparameters.</li>
            <li>Built-in anomaly detection.</li>
          </ul>
        </div>
        <div className="m4-card">
          <div className="m4-card-h">Cons</div>
          <ul className="m4-bullets">
            <li>Struggles when <strong>density varies</strong> a lot across clusters, or there is no low-density gap between them.</li>
            <li>Complexity ≈ <Tex src="O(m^2 n)" /> — the quadratic term in <Tex src="m" /> means it <strong>does not scale</strong> to very large datasets.</li>
          </ul>
        </div>
      </div>
      <L89Quiz title="Quick check — DBSCAN" items={[
        { q: 'A point has fewer than min_samples neighbours within ε, but lies inside a core point’s ε-neighbourhood. It is a…', opts: ['Core point', 'Border point', 'Anomaly (−1)', 'New cluster centre'], ans: 1, ok: 'Not dense enough to be core, but reachable from a core → it is a border point and joins that core’s cluster.', ng: 'It is reachable from a core but not itself dense → border point (not core, not anomaly).' },
        { q: 'Why does DBSCAN have no predict() method, and how do you classify new points?', opts: ['It predicts internally; just call dbscan.predict', 'Clustering is unsupervised with arbitrary shapes — train a KNN on core samples (components_) and optionally threshold the distance for anomalies', 'Re-run DBSCAN on each new point alone', 'Use kmeans.predict instead'], ans: 1, ok: 'DBSCAN labels are tied to the fitted density; for new points you fit a KNN on the core samples and threshold the neighbour distance to re-introduce anomaly detection.', ng: 'There is no predict(); the standard approach is a KNN trained on dbscan.components_ (the cores), with a distance threshold for anomalies.' },
      ]} />
      <div className="m4-card" style={{ marginTop: '1rem' }}>
        <div className="m4-card-h">Lecture 9 — Summary</div>
        <ul className="m4-bullets">
          <li><strong>k-means</strong>: centroid-based; fast; assign↔update until convergence; choose <Tex src="k" /> via elbow/silhouette; sensitive to init (k-means++), shape, and scale.</li>
          <li>Clustering powers semi-supervised learning: representative labelling + propagation reached <strong>90.9%</strong> from only 50 labels.</li>
          <li><strong>DBSCAN</strong>: density-based; any shape; automatic cluster count + anomaly detection; two hyperparameters; <Tex src="O(m^2 n)" /> so it does not scale to huge data.</li>
        </ul>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// EXAM SUMMARY — cross-cutting, memorisation-first revision of Lectures 1–9
// Reuses the same m4- classes, <Tex>, <PyBlock> and inline-style idioms as the
// lecture modules above. Hex colours are used so `${color}22` alpha-hex
// concatenation produces valid 8-digit hex values.
// ════════════════════════════════════════════════════════════════════════════

const EXAM_LECTURES = [
  { id: 'ex-l1', code: 'L1', color: '#22d3ee', title: 'The ML Landscape', focus: 'Definitions · system types · challenges · validation', go: 'Intro to ML' },
  { id: 'ex-l2', code: 'L2', color: '#a78bfa', title: 'ML Projects & Evaluation', focus: 'Bias trick · workflow · regression & classification metrics', go: 'ML Projects' },
  { id: 'ex-l3', code: 'L3', color: '#34d399', title: 'Regression Models', focus: 'Linear · Normal Eq · gradient descent · polynomial · logistic', go: 'Regression' },
  { id: 'ex-l4', code: 'L4', color: '#fbbf24', title: 'Regularisation & kNN', focus: 'Bias/variance · CV · Ridge/Lasso/Elastic · softmax · kNN', go: 'Reg. & kNN' },
  { id: 'ex-l5', code: 'L5', color: '#fb7185', title: 'Support Vector Machines', focus: 'Margins · soft-margin C · kernel trick · complexity · SVR', go: 'SVMs' },
  { id: 'ex-l6', code: 'L6', color: '#60a5fa', title: 'Decision Trees', focus: 'CART · Gini/entropy · regularisation · pruning · limits', go: 'Decision Trees' },
  { id: 'ex-l7', code: 'L7', color: '#f472b6', title: 'Ensembles & Random Forests', focus: 'Voting · bagging/OOB · RF · boosting · stacking', go: 'Ensembles' },
  { id: 'ex-l8', code: 'L8', color: '#2dd4bf', title: 'Dimensionality Reduction', focus: 'Curse · PCA/SVD · choosing d · kernel PCA · t-SNE', go: 'Dimensionality Reduction' },
  { id: 'ex-l9', code: 'L9', color: '#c084fc', title: 'Unsupervised Learning', focus: 'k-means · choosing k · semi-supervised · DBSCAN', go: 'Clustering' },
];

// Colour-coded lecture section wrapper with an anchor id for the quick-jump nav
function ExLec({ lec, onOpen, onCheat, children }) {
  return (
    <section id={lec.id} style={{ scrollMarginTop: '120px', marginBottom: '2.25rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap', padding: '0.65rem 0.9rem', borderRadius: 8, background: `linear-gradient(90deg, ${lec.color}24 0%, ${lec.color}0a 55%, transparent 100%)`, borderLeft: `4px solid ${lec.color}`, marginBottom: '1rem' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.1em', color: lec.color, background: `${lec.color}1c`, border: `1px solid ${lec.color}55`, padding: '0.2em 0.55em', borderRadius: 4, flexShrink: 0 }}>{lec.code}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-0)' }}>{lec.title}</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-2)', letterSpacing: '0.02em', marginTop: '0.18rem' }}>{lec.focus}</div>
        </div>
        <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0, flexWrap: 'wrap' }}>
          <button className="m4-btn" style={{ borderColor: `${lec.color}66`, color: lec.color }} onClick={() => onCheat(lec.code)}>✎ Handwritten notes</button>
          <button className="m4-btn" style={{ borderColor: `${lec.color}66`, color: lec.color }} onClick={() => onOpen(lec.go)}>Open module →</button>
        </div>
      </div>
      {children}
    </section>
  );
}

// Key-formula callout (colour-coded left border)
function ExF({ label, src, color = '#22d3ee', note }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.02)', borderLeft: `3px solid ${color}`, borderRadius: '0 5px 5px 0', padding: '0.5rem 0.8rem', margin: '0.45rem 0' }}>
      {label && <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.59rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-2)', marginBottom: '0.25rem' }}>{label}</div>}
      <Tex src={src} block />
      {note && <div style={{ fontSize: '0.73rem', color: 'var(--text-2)', marginTop: '0.3rem', lineHeight: 1.5 }}>{note}</div>}
    </div>
  );
}

// "Must remember" / mnemonic highlight box
function ExRemember({ children, color = '#fbbf24', label = '★ Must remember' }) {
  return (
    <div style={{ background: `${color}14`, border: `1px solid ${color}40`, borderRadius: 6, padding: '0.6rem 0.85rem', margin: '0.6rem 0' }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.57rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color, marginBottom: '0.3rem' }}>{label}</div>
      <div style={{ fontSize: '0.8rem', color: 'var(--text-1)', lineHeight: 1.55 }}>{children}</div>
    </div>
  );
}

// Side-by-side comparison columns (e.g. Bagging vs Boosting)
function ExVS({ items }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${items.length}, 1fr)`, gap: '0.6rem', margin: '0.6rem 0' }}>
      {items.map(it => (
        <div key={it.title} style={{ background: `${it.color}0e`, border: `1px solid ${it.color}38`, borderRadius: 6, padding: '0.7rem 0.8rem' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.69rem', fontWeight: 700, color: it.color, marginBottom: '0.45rem' }}>{it.title}</div>
          <ul style={{ margin: 0, paddingLeft: '1rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            {it.points.map((p, i) => <li key={i} style={{ fontSize: '0.77rem', color: 'var(--text-1)', lineHeight: 1.5 }}>{p}</li>)}
          </ul>
        </div>
      ))}
    </div>
  );
}

// Quick-jump chip nav for the exam summary
function ExamNav() {
  const jump = id => { const el = document.getElementById(id); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  const extra = [
    { id: 'ex-master', code: '★', color: '#e2e8f0', title: 'Master Cheat-Sheet' },
    { id: 'ex-recall', code: '⚡', color: '#e2e8f0', title: 'Exam-Day Recall' },
  ];
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '1.5rem' }}>
      {[extra[0], ...EXAM_LECTURES, extra[1]].map(l => (
        <button key={l.id} onClick={() => jump(l.id)} style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', fontWeight: 600, color: l.color, background: `${l.color}14`, border: `1px solid ${l.color}3a`, borderRadius: 5, padding: '0.32rem 0.6rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
          {l.code} · {l.title}
        </button>
      ))}
    </div>
  );
}

// ── Handwritten cheatsheet ────────────────────────────────────────────────────
// A "student's one-page revision notes" modal for each Exam Summary lecture.
// Readable ink palette (the neon lecture colours are too light on white paper).
const CHEAT_INK = {
  L1: '#0e7490', L2: '#6d28d9', L3: '#047857', L4: '#b45309', L5: '#be123c',
  L6: '#1d4ed8', L7: '#be185d', L8: '#0f766e', L9: '#7c3aed',
};

// Handwritten building blocks (rendered inside .cheat-paper). `ink` = pen colour.
function HSec({ ink, title, children }) {
  return (
    <section className="cheat-blk">
      <div className="cheat-h" style={{ color: ink }}>{title}</div>
      {children}
    </section>
  );
}
function HF({ ink, label, src }) {
  return (
    <div className="cheat-f" style={{ borderColor: ink }}>
      {label && <div className="cheat-f-lbl">{label}</div>}
      <Tex src={src} block />
    </div>
  );
}
function HBox({ ink, title, children }) {
  return (
    <div className="cheat-box" style={{ color: ink }}>
      {title && <div className="cheat-box-t">{title}</div>}
      <div style={{ color: '#20303f' }}>{children}</div>
    </div>
  );
}
function HUL({ ink, marker = '✦', items }) {
  return (
    <ul className="cheat-ul">
      {items.map((it, i) => (
        <li key={i}><span className="cheat-mk" style={{ color: ink }}>{marker}</span>{it}</li>
      ))}
    </ul>
  );
}
function HNote({ children }) { return <div className="cheat-note">{children}</div>; }
function HFlow({ ink, steps }) {
  return (
    <div className="cheat-flow" style={{ color: ink }}>
      {steps.flatMap((s, i) => {
        const els = i > 0 ? [<span key={`a${i}`} className="arr">→</span>] : [];
        els.push(<span key={`s${i}`} className="step">{s}</span>);
        return els;
      })}
    </div>
  );
}
function Hi({ c, children }) {
  return <span className="cheat-hi" style={c ? { background: `linear-gradient(transparent 58%, ${c} 58%, ${c} 92%, transparent 92%)` } : undefined}>{children}</span>;
}
function Pen({ c, children }) { return <strong style={{ color: c, fontWeight: 700 }}>{children}</strong>; }

// Cheatsheet content — one dense one-pager per lecture. Content mirrors exactly
// what each Exam Summary section already states (no new/unverified material).
const CHEATSHEETS = {
  L1: {
    title: 'The ML Landscape',
    render: ink => (
      <>
        <HSec ink={ink} title="What is ML?">
          <HUL ink={ink} items={[
            <><Pen c="#0e7490">Samuel ’59</Pen>: learn "without being explicitly programmed".</>,
            <><Pen c="#0e7490">Mitchell ’97</Pen>: improves at task <strong>T</strong>, measured by <strong>P</strong>, with experience <strong>E</strong>.</>,
            <>= <Hi>inductive learning</Hi> — specific examples → general rule.</>,
          ]} />
          <HBox ink={ink} title="Spam filter = E/T/P">
            <HUL ink={ink} marker="•" items={[
              <><strong>E</strong> = labelled spam / not-spam emails</>,
              <><strong>T</strong> = is a new email spam?</>,
              <><strong>P</strong> = accuracy on new emails</>,
            ]} />
          </HBox>
        </HSec>
        <HSec ink={ink} title="Formal model">
          <HF ink={ink} label="data point (n ex, m attrs)" src="D_i = (\vec{x}_i,\, y_i)" />
          <HF ink={ink} label="target vs hypothesis" src="f:\mathcal{X}\to\mathcal{Y},\;\; g\in\mathcal{H},\;\; g\approx f" />
          <HF ink={ink} label="linear classifier" src="h(\vec{x}) = \mathrm{sgn}\!\Big(\textstyle\sum_i w_i x_i + b\Big)" />
          <HF ink={ink} label="sign" src="\mathrm{sgn}(x)=\begin{cases}-1 & x<0\\ +1 & x>0\end{cases}" />
        </HSec>
        <HSec ink={ink} title="3 ways to categorise">
          <HUL ink={ink} items={[
            <>Supervised ↔ Unsupervised (labels?)</>,
            <>Batch ↔ Online (learn incrementally?)</>,
            <>Instance-based ↔ Model-based</>,
          ]} />
          <HNote><Pen c="#0e7490">Instance</Pen> = memorise + similarity (kNN). <Pen c="#0e7490">Model</Pen> = build a model, then predict.</HNote>
        </HSec>
        <HSec ink={ink} title="Supervised vs Unsupervised">
          <HBox ink="#0e7490" title="Supervised (X→y)">Classification (nominal y) · Regression (real y). Lin/Log/Softmax, kNN, SVM, DT, RF.</HBox>
          <HBox ink="#6d28d9" title="Unsupervised (no labels)">Clustering (k-means, DBSCAN, HCA) · DR/viz (PCA, LLE, t-SNE) · Association (Apriori, Eclat) · Anomaly detection.</HBox>
        </HSec>
        <HSec ink={ink} title="Challenges + validation">
          <HUL ink="#be123c" marker="✗" items={[
            'too little data', 'non-representative / poor quality',
            'irrelevant features', <Hi>overfit (deg-15) / underfit (deg-1)</Hi>,
          ]} />
          <HBox ink={ink} title="Test & validate">Train/Test ≈ 80/20 · generalisation = <strong>out-of-sample error</strong> · validation set for tuning — <Hi c="rgba(248,113,113,0.5)">tuning on test leaks!</Hi></HBox>
        </HSec>
      </>
    ),
  },
  L2: {
    title: 'ML Projects & Evaluation',
    render: ink => (
      <>
        <HSec ink={ink} title="Bias trick + workflow">
          <HF ink={ink} label="fold bias into w  (x₀=1, w₀=b)" src="h(x) = \mathrm{sgn}(w^\top x)" />
          <HNote>Vectorise: <Pen c="#6d28d9">np.sign(X @ w)</Pen> — no loops.</HNote>
          <HF ink={ink} label="perceptron update (if wrong)" src="w \leftarrow w + y_i x_i \;\;\text{if } y_i \neq h(x_i)" />
          <HNote><strong>6 steps:</strong></HNote>
          <HFlow ink={ink} steps={['understand', 'explore', 'prep data', 'train+tune', 'present', 'launch+monitor']} />
        </HSec>
        <HSec ink={ink} title="Regression metrics">
          <HF ink={ink} label="MSE" src="\mathrm{MSE} = \tfrac1m \textstyle\sum (h(x^{(i)})-y^{(i)})^2" />
          <HF ink={ink} label="MAE" src="\mathrm{MAE} = \tfrac1m \textstyle\sum |h(x^{(i)})-y^{(i)}|" />
          <HNote><Hi>MSE squares → punishes outliers</Hi>; MAE robust; RMSE=√MSE (target units).</HNote>
        </HSec>
        <HSec ink={ink} title="Classification eval">
          <HNote><Pen c="#6d28d9">MNIST</Pen>: 70k images, 784 = 28×28.</HNote>
          <HF ink={ink} label="precision (of predicted +)" src="\mathrm{precision} = \tfrac{TP}{TP+FP}" />
          <HF ink={ink} label="recall / TPR (of actual +)" src="\mathrm{recall} = \tfrac{TP}{TP+FN}" />
          <HF ink={ink} label="F₁ — harmonic mean" src="F_1 = \tfrac{2}{\frac1P + \frac1R}" />
          <HBox ink="#be123c" title="Watch out!">Accuracy lies on imbalanced data ("always not-5" {'>'}90%). ROC = TPR vs FPR(=1−spec); bigger <strong>AUC</strong> better.</HBox>
          <HNote><Hi>Mnemonic:</Hi> <strong>P</strong>recision denom = <strong>P</strong>redicted +; <strong>R</strong>ecall denom = <strong>R</strong>eal +.</HNote>
          <HNote>P/R trade-off: ↑threshold ⇒ ↑precision ↓recall. Precision when FP costly (lane change); recall when FN costly (cancer).</HNote>
          <HNote>Sampling bias: 1936 poll → Landon, but Roosevelt 62%. Multiclass: Softmax/RF/NB direct; SVM binary → OvA/OvO.</HNote>
        </HSec>
      </>
    ),
  },
  L3: {
    title: 'Regression Models',
    render: ink => (
      <>
        <HSec ink={ink} title="Linear regression">
          <HF ink={ink} label="prediction" src="\hat{y} = \theta^\top x = \theta_0 + \theta_1 x_1 + \cdots + \theta_n x_n" />
          <HF ink={ink} label="cost (RSS = m·MSE)" src="\mathrm{MSE} = \tfrac1m \textstyle\sum (\theta^\top x^{(i)} - y^{(i)})^2" />
          <HF ink={ink} label="Normal Equation" src="\hat{\theta} = (X^\top X)^{-1} X^\top y" />
          <HNote><Hi c="rgba(248,113,113,0.5)">O(n³) in #features</Hi> → use GD for wide data.</HNote>
        </HSec>
        <HSec ink={ink} title="Gradient descent">
          <HF ink={ink} label="gradient of MSE" src="\nabla_\theta\,\mathrm{MSE} = \tfrac2m X^\top (X\theta - y)" />
          <HF ink={ink} label="step (η = learning rate)" src="\theta^{(t+1)} = \theta^{(t)} - \eta\,\nabla_\theta\,\mathrm{MSE}" />
          <HNote>η too big → <Pen c="#be123c">diverge</Pen>; can stall in local min / plateau.</HNote>
          <HBox ink={ink} title="3 variants">
            <HUL ink={ink} marker="•" items={[
              <><strong>Batch</strong>: all data — stable, slow</>,
              <><strong>SGD</strong>: 1 random — fast, noisy → schedule</>,
              <><strong>Mini-batch</strong>: subset — GPU vectorised</>,
            ]} />
          </HBox>
        </HSec>
        <HSec ink={ink} title="Polynomial + curves">
          <HUL ink={ink} items={[
            'add powers x², x³… then fit a linear model',
            <>high degree → <strong>overfit</strong>; too simple → <strong>underfit</strong></>,
            'learning curves = error vs train-set size → diagnose',
          ]} />
        </HSec>
        <HSec ink={ink} title="Logistic regression">
          <HF ink={ink} label="sigmoid (predict 1 if p̂≥0.5)" src="\hat{p} = \sigma(\theta^\top x),\;\; \sigma(t)=\tfrac{1}{1+e^{-t}}" />
          <HF ink={ink} label="log loss (cross-entropy)" src="J = -\tfrac1m \textstyle\sum [\,y\log\hat{p} + (1-y)\log(1-\hat{p})\,]" />
          <HNote><Hi>convex → GD finds global min</Hi>; linear boundary (Iris-Virginica).</HNote>
        </HSec>
      </>
    ),
  },
  L4: {
    title: 'Regularisation & kNN',
    render: ink => (
      <>
        <HSec ink={ink} title="Bias / Variance">
          <HF ink={ink} label="error decomposes" src="\text{Err} = \text{Bias}^2 + \text{Var} + \text{Irreducible}" />
          <HBox ink="#0e7490" title="High bias = underfit">too simple → richer model, better features, less reg.</HBox>
          <HBox ink="#be123c" title="High variance = overfit">too sensitive → more data, CV, fewer dims, more reg.</HBox>
          <HNote><Hi>↑complexity ⇒ ↑variance, ↓bias</Hi>. Irreducible = data noise.</HNote>
        </HSec>
        <HSec ink={ink} title="Tuning">
          <HUL ink={ink} items={[
            <><strong>hyperparameter</strong>: set before training (k, degree, α, threshold)</>,
            <><strong>k-fold CV</strong>; GridSearchCV / RandomizedSearchCV</>,
            'retrain best on full train, test ONCE',
            'early stopping at min validation error',
          ]} />
        </HSec>
        <HSec ink={ink} title="Regularised linear">
          <HF ink={ink} label="Ridge — ℓ₂" src="J = \mathrm{MSE} + \alpha \textstyle\sum \theta_i^2" />
          <HF ink={ink} label="Lasso — ℓ₁" src="J = \mathrm{MSE} + \alpha \textstyle\sum |\theta_i|" />
          <HF ink={ink} label="Elastic Net (ratio r)" src="J = \mathrm{MSE} + r\alpha\textstyle\sum|\theta_i| + \tfrac{1-r}{2}\alpha\textstyle\sum\theta_i^2" />
          <HNote><Hi>Lasso = ℓ1 = corners → zeros</Hi> (selection); Ridge = ℓ2 = round → shrinks. Penalty in training only.</HNote>
        </HSec>
        <HSec ink={ink} title="Softmax (multiclass)">
          <HF ink={ink} label="probability → argmax" src="\hat{p}_k = \tfrac{\exp(s_k)}{\sum_j \exp(s_j)},\;\; s_k=(\theta^{(k)})^\top x" />
          <HNote>trained with cross-entropy.</HNote>
        </HSec>
        <HSec ink={ink} title="kNN (instance-based)">
          <HF ink={ink} label="Minkowski (p=1 Manh, p=2 Eucl)" src="D(x_i,x_j)=\big(\textstyle\sum_l |x_i[l]-x_j[l]|^p\big)^{1/p}" />
          <HF ink={ink} label="distance-weighted vote" src="w_i = 1/d(x_q,x_i)^2" />
          <HUL ink="#be123c" marker="!" items={[
            <Hi>must normalise features</Hi>,
            'small k → overfit; large k → underfit + majority bias',
            'lazy — no training, slow at predict',
          ]} />
          <HNote>Multiclass (OvA/OvO) · Multilabel · Multioutput-multiclass.</HNote>
        </HSec>
      </>
    ),
  },
  L5: {
    title: 'Support Vector Machines',
    render: ink => (
      <>
        <HSec ink={ink} title="Large margin">
          <HUL ink={ink} items={[
            'fit the widest "street" between classes',
            <>boundary set by <strong>support vectors</strong> only</>,
            <>scale-sensitive → <Pen c="#be123c">StandardScaler (fit train only)</Pen></>,
            'best for small–medium complex data',
          ]} />
          <HBox ink={ink} title="Hard vs soft">Hard = no violations, needs separable, outlier-sensitive. Soft = slack ζ, balance width vs violations via <strong>C</strong>.</HBox>
        </HSec>
        <HSec ink={ink} title="C + kernels">
          <HNote><Hi>small C → wide street / more violations; large C → narrow / overfit.</Hi> Overfit? reduce C.</HNote>
          <HF ink={ink} label="Gaussian RBF" src="K(a,b)=\exp(-\gamma\lVert a-b\rVert^2)" />
          <HF ink={ink} label="polynomial" src="K(a,b)=(\gamma\, a^\top b + r)^d" />
          <HNote><strong>Kernel trick</strong> = many poly/similarity features without computing them. Kernels: linear, poly, RBF, sigmoid.</HNote>
        </HSec>
        <HSec ink={ink} title="Optimisation (under the hood)">
          <HF ink={ink} label="decision function" src="\hat{y} = w^\top x + b" />
          <HF ink={ink} label="hard margin" src="\min \tfrac12 w^\top w \;\text{ s.t. } t^{(i)}(w^\top x^{(i)}+b)\ge 1" />
          <HF ink={ink} label="soft margin" src="\min \tfrac12 w^\top w + C\textstyle\sum \zeta^{(i)}" />
          <HF ink={ink} label="hinge loss" src="J = \tfrac12 w^\top w + C\textstyle\sum \max(0,\,1 - t^{(i)}(w^\top x^{(i)}+b))" />
          <HNote>Convex QP; the <strong>dual</strong> enables the kernel trick.</HNote>
        </HSec>
        <HSec ink={ink} title="Complexity + SVR">
          <HUL ink={ink} marker="•" items={[
            <>LinearSVC <Pen c="#047857">O(m·n)</Pen> · SGDClassifier <Pen c="#047857">O(m·n)</Pen></>,
            <>SVC (kernel) <Pen c="#be123c">O(m²n)–O(m³n)</Pen> — small data only</>,
          ]} />
          <HNote><Hi>Big m → never kernel SVC.</Hi> SVR: fit as many points <em>inside</em> the ε-tube.</HNote>
        </HSec>
      </>
    ),
  },
  L6: {
    title: 'Decision Trees',
    render: ink => (
      <>
        <HSec ink={ink} title="CART">
          <HUL ink={ink} items={[
            'greedy + top-down (global = NP-hard)',
            'binary, axis-aligned splits Xⱼ ≤ tⱼ',
            '"Guess Who" = most informative question first',
            <>white-box · <strong>no scaling needed</strong></>,
          ]} />
          <HF ink={ink} label="split cost (classification)" src="J = \tfrac{m_L}{m}G_L + \tfrac{m_R}{m}G_R" />
          <HNote>predict <strong>O(log₂m)</strong>; train O(n·m·log₂m).</HNote>
        </HSec>
        <HSec ink={ink} title="Impurity">
          <HF ink={ink} label="Gini (default, faster)" src="G_i = 1 - \textstyle\sum_k p_{i,k}^2" />
          <HF ink={ink} label="Entropy" src="H_i = -\textstyle\sum_k p_{i,k}\log_2 p_{i,k}" />
          <HNote><Hi>both 0 at a pure node</Hi> (50/50 Gini = 0.5); similar trees. Leaf value → class probs.</HNote>
        </HSec>
        <HSec ink={ink} title="Regularise + prune">
          <HNote>nonparametric → overfits. ↑min_* or ↓max_*:</HNote>
          <HFlow ink={ink} steps={['max_depth ↓', 'min_samples_leaf ↑', 'max_leaf_nodes ↓', 'max_features ↓']} />
          <HF ink={ink} label="cost-complexity pruning" src="\textstyle\sum_l \sum_{x_i\in R_l}(y_i-\hat{y}_{R_l})^2 + \alpha|T|" />
          <HNote>α=0 → full tree; α→∞ → root only. Pick α by CV.</HNote>
        </HSec>
        <HSec ink={ink} title="Regression trees + limits">
          <HF ink={ink} label="split cost (MSE)" src="J = \tfrac{m_L}{m}\mathrm{MSE}_L + \tfrac{m_R}{m}\mathrm{MSE}_R" />
          <HNote>leaf = mean of region (Hitters: Years/Hits → log salary).</HNote>
          <HBox ink="#be123c" title="3 limits → fix">overfit → prune · axis-aligned (rotation) → <Pen c="#1d4ed8">PCA</Pen> · high variance → <Pen c="#1d4ed8">Random Forests</Pen>.</HBox>
        </HSec>
      </>
    ),
  },
  L7: {
    title: 'Ensembles & Random Forests',
    render: ink => (
      <>
        <HSec ink={ink} title="Voting — wisdom of crowd">
          <HBox ink={ink} title="Hard vs soft">Hard = majority class. Soft = avg predict_proba (confident votes weigh more, usually better).</HBox>
          <HNote><Hi>weak learners → strong</Hi> if enough & diverse.</HNote>
        </HSec>
        <HSec ink={ink} title="Bagging / Pasting / OOB">
          <HUL ink={ink} items={[
            <><strong>Bagging</strong> = sample WITH replacement; Pasting = without</>,
            'aggregate: mode / average → ↓ variance',
            <><strong>OOB</strong> ≈ ⅓ left out = free validation (oob_score_)</>,
            'Random Patches (rows+cols) vs Subspaces (cols only)',
          ]} />
        </HSec>
        <HSec ink={ink} title="Random Forests">
          <HUL ink={ink} items={[
            <>RF = bagged trees + random <strong>√n features per split</strong></>,
            'Extra-Trees: + random thresholds (faster, more bias)',
            'feature importance = mean impurity decrease (norm to 1)',
          ]} />
          <HNote><Hi>Bagging fixes features per tree; RF resamples at every split.</Hi></HNote>
        </HSec>
        <HSec ink={ink} title="Boosting (sequential)">
          <HF ink={ink} label="AdaBoost: error & predictor weight" src="r_j = \!\!\sum_{\hat{y}_j^{(i)}\neq y^{(i)}}\!\! w^{(i)},\;\; \alpha_j = \eta\log\tfrac{1-r_j}{r_j}" />
          <HNote>boost misclassified ×exp(αⱼ), renorm. Stump = depth 1.</HNote>
          <HNote><strong>GBRT</strong>: fit residuals; small learning_rate + many trees + early stopping; classification = log loss.</HNote>
          <HBox ink={ink} title="Bagging vs Boosting">Bagging = <Pen c="#047857">parallel, ↓variance</Pen>. Boosting = <Pen c="#be123c">sequential, ↓bias</Pen> (can't parallelise).</HBox>
        </HSec>
        <HSec ink={ink} title="Stacking">
          <HNote>train a <strong>blender</strong> on base models' <Hi>out-of-fold</Hi> predictions, then retrain bases on the full set.</HNote>
        </HSec>
      </>
    ),
  },
  L8: {
    title: 'Dimensionality Reduction',
    render: ink => (
      <>
        <HSec ink={ink} title="Curse + approaches">
          <HUL ink={ink} items={[
            '1000s of features → sparse, slow, hard',
            'DR loses info BUT speeds train + enables 2D/3D viz',
            'feature selection = supervised; DR here = unsupervised',
          ]} />
          <HBox ink={ink} title="Projection vs Manifold">Projection = data near a low-dim subspace (fails on twists). Manifold = unroll (Swiss roll: d=2 in n=3).</HBox>
        </HSec>
        <HSec ink={ink} title="PCA — max variance">
          <HF ink={ink} label="SVD of centred data" src="X = U\,\Sigma\,V^\top" />
          <HNote>cols of V = principal axes (1st = max var, ⟂ next); sign not unique.</HNote>
          <HF ink={ink} label="project (Wd = first d cols of V)" src="X_{d\text{-proj}} = X\,W_d" />
          <HF ink={ink} label="reconstruct → recon. error" src="X_\text{rec} = X_{d\text{-proj}}\,W_d^\top" />
          <HNote><Hi>centre data first</Hi>; np.linalg.svd returns Vᵀ.</HNote>
        </HSec>
        <HSec ink={ink} title="Choose d + variants">
          <HF ink={ink} label="keep 95% variance" src="d = \arg\max(\text{cumsum(EVR)} \ge 0.95) + 1" />
          <HUL ink={ink} marker="•" items={[
            <>= <Pen c="#0f766e">PCA(n_components=0.95)</Pen> or the elbow</>,
            'MNIST 95% → 784 → 154 dims',
            'Randomized PCA O(md²)+O(d³) ≪ O(mn²)+O(n³)',
            'Incremental PCA = mini-batches (online)',
          ]} />
        </HSec>
        <HSec ink={ink} title="Kernel PCA + others">
          <HNote><strong>Kernel PCA</strong> = kernel trick + PCA → nonlinear (separates concentric circles).</HNote>
          <HBox ink={ink} title="other DR">
            <HUL ink={ink} marker="•" items={[
              'LLE — manifold, no projection',
              'MDS — preserves pairwise distances',
              'Isomap — kNN graph, geodesic distances',
              't-SNE — visualisation (MNIST → 2D clusters)',
            ]} />
          </HBox>
        </HSec>
      </>
    ),
  },
  L9: {
    title: 'Unsupervised Learning',
    render: ink => (
      <>
        <HSec ink={ink} title="k-Means">
          <HNote>uses: fraud/defect, recommender, image seg/retrieval, anomaly, semi-supervised.</HNote>
          <HUL ink={ink} items={[
            'loop: assign → update centroid means → repeat',
            'converges (inertia ↓, bounded ≥ 0)',
            'hard = labels_; soft = transform() distances',
          ]} />
          <HF ink={ink} label="inertia (score = −inertia)" src="\text{inertia} = \textstyle\sum_i \lVert x_i - c_{\text{closest}(i)}\rVert^2" />
          <HNote>Voronoi diagram shows the cells.</HNote>
        </HSec>
        <HSec ink={ink} title="3 drawbacks → fixes">
          <HNote><Pen c={ink}>① init sensitive</Pen> → n_init / k-means++:</HNote>
          <HF ink={ink} label="k-means++ pick-next" src="P(x_i) = \tfrac{D(x_i)^2}{\sum_j D(x_j)^2}" />
          <HNote><Pen c={ink}>② choose k</Pen> → elbow (misleading) or silhouette:</HNote>
          <HF ink={ink} label="silhouette ∈ [−1,1], higher better" src="s_i = \tfrac{b - a}{\max(a,\, b)}" />
          <HNote>a = intra-cluster, b = nearest other cluster. <Pen c={ink}>③ shape</Pen> (size/density/non-spherical) → <strong>GMM</strong>.</HNote>
        </HSec>
        <HSec ink={ink} title="Semi-supervised (digits)">
          <HUL ink={ink} marker="•" items={[
            '50 random labels → 74.8%',
            '50 cluster reps → 84.9%',
            'full propagation → 89.4%',
            <Hi>partial (drop 1%) → 90.9% {'>'} 90.7% (all labels)</Hi>,
          ]} />
        </HSec>
        <HSec ink={ink} title="DBSCAN (density)">
          <HUL ink={ink} items={[
            'params: ε (radius) + min_samples',
            'Core (≥min in ε) / Border / Noise(−1)',
            'core chains → any-shape cluster; ↑ε → fewer anomalies (84→0)',
            'no predict() → train kNN on components_',
          ]} />
          <HBox ink={ink} title="Pros / Cons"><Pen c="#047857">+ any shape, auto-k, anomalies, 2 params.</Pen> <Pen c="#be123c">− varying density; O(m²n), no scale.</Pen></HBox>
        </HSec>
      </>
    ),
  },
};

// Accessible modal: overlay + click-outside + Esc + close button + focus trap + scroll-lock.
function CheatsheetModal({ code, onClose }) {
  const sheet = CHEATSHEETS[code];
  const lec = EXAM_LECTURES.find(l => l.code === code);
  const ink = CHEAT_INK[code] || '#20303f';
  const closeRef = useRef(null);
  const paperRef = useRef(null);

  useEffect(() => {
    const prevActive = document.activeElement;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const onKey = e => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === 'Tab' && paperRef.current) {
        const f = paperRef.current.querySelectorAll('button, [href], [tabindex]:not([tabindex="-1"])');
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      if (prevActive && prevActive.focus) prevActive.focus();
    };
  }, [onClose, code]);

  if (!sheet) return null;

  return createPortal(
    <div className="cheat-overlay" onClick={onClose}>
      <div
        className="cheat-paper"
        ref={paperRef}
        role="dialog"
        aria-modal="true"
        aria-label={`${sheet.title} — handwritten cheatsheet`}
        onClick={e => e.stopPropagation()}
      >
        <button ref={closeRef} className="cheat-close" onClick={onClose} aria-label="Close cheatsheet">✕</button>
        <div className="cheat-title" style={{ color: ink }}>{sheet.title}</div>
        <div className="cheat-sub">{code} · {lec ? lec.focus : 'handwritten revision notes'}</div>
        <div className="cheat-cols">{sheet.render(ink)}</div>
        <div style={{ marginTop: '0.6rem', fontFamily: 'var(--font-mono)', fontSize: '0.55rem', color: '#94a3b8', textAlign: 'right' }}>↳ Esc or click outside to close</div>
      </div>
    </div>,
    document.body
  );
}

// ════════════════════════════════════════════════════════════════════════════
// CODE LAB — learn the implementation side of the course.
// A tiny zero-dependency Python highlighter (same hand-rolled spirit as the
// existing .m4-pseudocode), a real-editor CodeEditor (chrome + line numbers +
// dark VS-Code-style theme), and five interactive study modes. All snippets are
// copied faithfully from the lecture notes / Hands-on-ML notebooks.
// ════════════════════════════════════════════════════════════════════════════

const PY_KW = new Set(['import', 'from', 'as', 'for', 'in', 'if', 'elif', 'else', 'while', 'return', 'def', 'class', 'lambda', 'with', 'try', 'except', 'finally', 'raise', 'yield', 'pass', 'break', 'continue', 'and', 'or', 'not', 'is', 'None', 'True', 'False', 'global', 'del', 'assert']);
const PY_BI = new Set(['np', 'pd', 'plt', 'self', 'sum', 'len', 'range', 'print', 'zip', 'enumerate']);

// Tokenise & colour ONE line of Python (no multi-line strings in our snippets).
function pyHL(line) {
  const out = [];
  const re = /([ \t]+)|(#.*)|([rfbRFB]?(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'))|(\b\d[\w.]*)|([A-Za-z_]\w*)|([()[\]{}.,:;])|([=+\-*/%@<>!&|^~]+)/g;
  let m, idx = 0, k = 0;
  while ((m = re.exec(line))) {
    if (m.index > idx) out.push(<span key={k++}>{line.slice(idx, m.index)}</span>);
    idx = re.lastIndex;
    if (m[1]) out.push(<span key={k++}>{m[1]}</span>);
    else if (m[2]) out.push(<span key={k++} className="ce-cm">{m[2]}</span>);
    else if (m[3]) out.push(<span key={k++} className="ce-str">{m[3]}</span>);
    else if (m[4]) out.push(<span key={k++} className="ce-num">{m[4]}</span>);
    else if (m[5]) {
      const w = m[5];
      let cls = 'ce-id';
      if (PY_KW.has(w)) cls = 'ce-kw';
      else if (PY_BI.has(w)) cls = 'ce-bi';
      else if (/^\s*\(/.test(line.slice(re.lastIndex))) cls = 'ce-fn';
      out.push(<span key={k++} className={cls}>{w}</span>);
    }
    else if (m[6]) out.push(<span key={k++} className="ce-pn">{m[6]}</span>);
    else if (m[7]) out.push(<span key={k++} className="ce-op">{m[7]}</span>);
  }
  if (idx < line.length) out.push(<span key={k++}>{line.slice(idx)}</span>);
  return out;
}

// Editor chrome (filename tab + traffic lights + language) wrapping pre-built rows.
function CodeEditor({ file, color = '#22d3ee', rows }) {
  return (
    <div className="ce">
      <div className="ce-bar">
        <span className="ce-dots"><i style={{ background: '#ff5f56' }} /><i style={{ background: '#ffbd2e' }} /><i style={{ background: '#27c93f' }} /></span>
        <span className="ce-file">{file}</span>
        <span className="ce-lang" style={{ color }}>PYTHON</span>
      </div>
      <div className="ce-body">{rows}</div>
    </div>
  );
}

// Numbered, highlighted rows; lines present in `notes` are click-to-expand.
function codeRows(code, { notes, activeNote, onLineClick } = {}) {
  const lines = code.split('\n');
  const rows = [];
  lines.forEach((ln, i) => {
    const n = i + 1;
    const note = notes && notes[n];
    rows.push(
      <div key={`r${i}`} className={`ce-row${note ? ' ce-clk' : ''}${activeNote === n ? ' ce-on' : ''}`} onClick={note ? () => onLineClick(n) : undefined}>
        <span className="ce-ln">{n}</span>
        <code className="ce-src">{ln.length ? pyHL(ln) : ' '}{note && <span className="ce-note-mk">●</span>}</code>
      </div>
    );
    if (note && activeNote === n) {
      rows.push(<div key={`n${i}`} className="ce-note"><span className="ce-note-l">L{n}</span>{note}</div>);
    }
  });
  return rows;
}

// Rows where ‹answer› markers become fill-in inputs.
function blankRows(template, { vals, checked, revealed, setVal }) {
  const lines = template.split('\n');
  let bi = 0;
  return lines.map((ln, i) => {
    const parts = ln.split(/‹([^›]*)›/);   // even = static code, odd = blank answer
    const content = parts.map((p, j) => {
      if (j % 2 === 0) return p.length ? <span key={j}>{pyHL(p)}</span> : null;
      const idx = bi++, ans = p;
      const val = revealed ? ans : (vals[idx] ?? '');
      let cls = 'ce-blank';
      if (revealed || (checked && val.trim() === ans)) cls += ' ok';
      else if (checked) cls += ' bad';
      return <input key={j} className={cls} value={val} spellCheck={false} disabled={revealed}
        style={{ width: `${Math.max(ans.length, 2) + 1}ch` }} aria-label={`blank ${idx + 1}`}
        onChange={e => setVal(idx, e.target.value)} />;
    });
    return (
      <div key={i} className="ce-row">
        <span className="ce-ln">{i + 1}</span>
        <code className="ce-src">{content}</code>
      </div>
    );
  });
}

// Scramble-the-lines mode (seeded so it is stable across re-renders).
function ReorderMode({ code, color, seed }) {
  const lines = code.split('\n').filter(l => l.trim().length);
  const [order, setOrder] = useState(() => {
    const idx = lines.map((_, i) => i);
    const rand = makePRNG(seed);
    for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
    if (idx.every((v, i) => v === i) && idx.length > 1) { [idx[0], idx[1]] = [idx[1], idx[0]]; }
    return idx;
  });
  const [checked, setChecked] = useState(false);
  const move = (pos, dir) => {
    if (checked) return;
    const t = pos + dir;
    if (t < 0 || t >= order.length) return;
    const n = [...order]; [n[pos], n[t]] = [n[t], n[pos]]; setOrder(n);
  };
  const correct = order.filter((v, i) => v === i).length;
  return (
    <div>
      <div className="ce">
        <div className="ce-bar"><span className="ce-dots"><i style={{ background: '#ff5f56' }} /><i style={{ background: '#ffbd2e' }} /><i style={{ background: '#27c93f' }} /></span><span className="ce-file">arrange the lines in order</span></div>
        <div className="ce-body">
          {order.map((orig, pos) => (
            <div key={pos} className={`cl-reorder-row${checked ? (orig === pos ? ' ok' : ' bad') : ''}`}>
              <span className="cl-mv">
                <button onClick={() => move(pos, -1)} disabled={pos === 0 || checked} aria-label="move up">▲</button>
                <button onClick={() => move(pos, 1)} disabled={pos === order.length - 1 || checked} aria-label="move down">▼</button>
              </span>
              <code className="ce-src">{pyHL(lines[orig])}</code>
            </div>
          ))}
        </div>
      </div>
      <div className="cl-bar">
        {!checked && <button className="m4-btn" style={{ borderColor: color, color }} onClick={() => setChecked(true)}>Check order</button>}
        {checked && <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: correct === order.length ? 'var(--emerald)' : 'var(--amber)' }}>{correct}/{order.length} lines in the right place</span>}
        <button className="m4-btn" onClick={() => { setChecked(false); const idx = lines.map((_, i) => i); const rand = makePRNG(seed + 1); for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; } setOrder(idx); }}>Shuffle</button>
      </div>
    </div>
  );
}

// One concept: editor + a switcher between five study modes.
function ConceptLab({ c, color, seed }) {
  const [mode, setMode] = useState('walk');
  const [activeNote, setActiveNote] = useState(null);
  const [vals, setVals] = useState({});
  const [checked, setChecked] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [shown, setShown] = useState(false);

  const stripped = c.code.replace(/‹([^›]*)›/g, '$1');
  const answers = [...c.code.matchAll(/‹([^›]*)›/g)].map(m => m[1]);
  const hasBlanks = answers.length > 0;
  const score = answers.filter((a, i) => (vals[i] ?? '').trim() === a).length;

  const MODES = [['walk', 'Walkthrough'], hasBlanks && ['blank', 'Fill blanks'], ['reorder', 'Reorder'], ['recall', 'Recall']].filter(Boolean);

  return (
    <div className="cl-card">
      <div className="cl-card-h"><span className="cl-c-title">{c.title}</span><span className="cl-c-file">{c.file}</span></div>
      <p className="cl-c-ctx">{c.context}</p>
      <div className="cl-modes">
        {MODES.map(([k, label]) => (
          <button key={k} className={`cl-mode${mode === k ? ' on' : ''}`} style={mode === k ? { borderColor: color, color } : undefined} onClick={() => setMode(k)}>{label}</button>
        ))}
      </div>

      {mode === 'walk' && (
        <>
          <CodeEditor file={c.file} color={color} rows={codeRows(stripped, { notes: c.notes, activeNote, onLineClick: n => setActiveNote(activeNote === n ? null : n) })} />
          {c.notes && <div className="cl-hint">Click the ● lines for a line-by-line explanation.</div>}
        </>
      )}

      {mode === 'blank' && (
        <>
          <CodeEditor file={c.file} color={color} rows={blankRows(c.code, { vals, checked, revealed, setVal: (i, v) => setVals(p => ({ ...p, [i]: v })) })} />
          <div className="cl-bar">
            {!revealed && <button className="m4-btn" style={{ borderColor: color, color }} onClick={() => setChecked(true)}>Check</button>}
            {!revealed && <button className="m4-btn" onClick={() => setRevealed(true)}>Reveal</button>}
            <button className="m4-btn" onClick={() => { setVals({}); setChecked(false); setRevealed(false); }}>Reset</button>
            {checked && !revealed && <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: score === answers.length ? 'var(--emerald)' : 'var(--amber)' }}>{score}/{answers.length} correct</span>}
          </div>
        </>
      )}

      {mode === 'reorder' && <ReorderMode code={stripped} color={color} seed={seed} />}

      {mode === 'recall' && (
        <div className="cl-recall">
          <div className="cl-recall-q"><strong>Recall:</strong> {c.recall || c.context}</div>
          {shown
            ? <CodeEditor file={c.file} color={color} rows={codeRows(stripped, {})} />
            : <button className="m4-btn" style={{ borderColor: color, color }} onClick={() => setShown(true)}>Reveal the code →</button>}
          {shown && <button className="m4-btn" style={{ marginTop: '0.5rem' }} onClick={() => setShown(false)}>Hide again</button>}
        </div>
      )}
    </div>
  );
}

// "Predict the output" — show real code, guess the printed result.
function PredictCard({ item, color }) {
  const [pick, setPick] = useState(null);
  const done = pick !== null;
  return (
    <div className="cl-card">
      <div className="cl-card-h"><span className="cl-c-title">Predict the output</span><span className="cl-c-file">{item.file}</span></div>
      <CodeEditor file={item.file} color={color} rows={codeRows(item.code, {})} />
      <p className="cl-c-ctx" style={{ marginTop: '0.6rem' }}>{item.q}</p>
      <div className="cl-opts">
        {item.opts.map((o, i) => {
          let cls = 'cl-opt';
          if (done && i === item.ans) cls += ' ok';
          else if (done && i === pick) cls += ' bad';
          return <button key={i} className={cls} disabled={done} onClick={() => setPick(i)}>{o}</button>;
        })}
      </div>
      {done && (
        <div className="cl-fb" style={{ background: pick === item.ans ? 'rgba(52,211,153,0.08)' : 'rgba(251,113,133,0.08)', border: `1px solid ${pick === item.ans ? 'rgba(52,211,153,0.3)' : 'rgba(251,113,133,0.3)'}`, color: 'var(--text-1)' }}>
          <strong style={{ color: pick === item.ans ? 'var(--emerald)' : 'var(--rose)' }}>{pick === item.ans ? '✓ Correct — ' : '✗ Not quite — '}</strong>{item.ok}
        </div>
      )}
    </div>
  );
}

// Faithful snippets grouped by concept → lecture. ‹answer› marks a fill-in blank.
const CODE_GROUPS = [
  {
    id: 'cl-l12', title: 'L1–2 · Foundations', color: '#22d3ee', go: 'Intro to ML',
    heading: 'Foundations — simple model & evaluation',
    blurb: 'The vectorised linear classifier and how to score a classifier honestly.',
    concepts: [
      {
        id: 'simple-model', title: 'Simple linear model (vectorised)', file: 'simple_model.py',
        context: "The course's simple classifier h(x) = sgn(wᵀx), bias folded in as w₀ (x₀ = 1), trained by the perceptron update.",
        recall: 'Write the vectorised prediction and the perceptron weight update.',
        code: `import numpy as np

# h(x) = sign(wᵀx), with a dummy feature x0 = 1 (the bias trick)
def predict(X, w):
    return np.‹sign›(X @ w)          # vectorised over all rows — no Python loop

# Perceptron update over the training set
for i in range(len(X)):
    if y[i] != np.sign(X[i] @ w):    # misclassified?
        w = w + ‹y[i]› * X[i]        # w <- w + y_i * x_i`,
        notes: { 5: 'np.sign(X @ w) scores every row at once — this replaces a slow per-row Python loop.', 10: 'The whole learning rule: a misclassified point nudges w toward its correct side.' },
      },
      {
        id: 'class-metrics', title: 'Classification metrics', file: 'classification.py',
        context: 'Evaluate a classifier honestly: confusion matrix → precision & recall. On imbalanced data, accuracy alone misleads.',
        code: `from sklearn.model_selection import cross_val_predict
from sklearn.metrics import confusion_matrix, precision_score, recall_score

y_train_pred = cross_val_predict(sgd_clf, X_train, y_train_5, cv=‹3›)
cm = ‹confusion_matrix›(y_train_5, y_train_pred)

precision_score(y_train_5, y_train_pred)   # TP / (TP + FP)
recall_score(y_train_5, y_train_pred)      # TP / (TP + FN)`,
        notes: { 4: 'cross_val_predict makes clean out-of-fold predictions — no train/test leakage in the metrics.', 7: 'Precision = of everything flagged positive, how much was actually right.' },
      },
    ],
    predict: [
      {
        file: 'mnist_baseline.py',
        code: `from sklearn.dummy import DummyClassifier

dummy = DummyClassifier()        # predicts the majority class
dummy.fit(X_train, y_train_5)    # y_train_5: is the digit a 5?
print(dummy.score(X_train, y_train_5))`,
        q: "Only ~10% of MNIST digits are 5s. What accuracy does this 'always not-5' classifier reach?",
        opts: ['~50%', '~90%+', 'exactly 100%', '~10%'], ans: 1,
        ok: 'Over 90% — about 90% of digits are not 5s, so always guessing not-5 is right ~90% of the time. This is exactly why accuracy misleads on imbalanced data.',
      },
    ],
  },
  {
    id: 'cl-l3', title: 'L3 · Regression', color: '#34d399', go: 'Regression',
    heading: 'Regression — linear models, GD, logistic',
    blurb: 'Closed-form fit, gradient descent, and logistic regression.',
    concepts: [
      {
        id: 'normal-eq', title: 'Normal Equation (closed form)', file: 'normal_equation.py',
        context: 'Solve for the optimal θ directly — no iteration, no learning rate.',
        code: `from sklearn.preprocessing import add_dummy_feature

X_b = add_dummy_feature(X)                       # add x0 = 1 to each instance
theta_best = np.linalg.‹inv›(X_b.T @ X_b) @ X_b.T @ y`,
        notes: { 3: 'add_dummy_feature prepends a column of 1s so θ₀ becomes the intercept.', 4: 'Closed form θ̂ = (XᵀX)⁻¹Xᵀy — O(n³) in the number of features, so slow for very wide data.' },
      },
      {
        id: 'batch-gd', title: 'Batch Gradient Descent', file: 'gradient_descent.py',
        context: 'Batch GD uses the WHOLE training set to compute each step.',
        code: `eta = ‹0.1›           # learning rate
n_epochs = 1000
m = len(X_b)

np.random.seed(42)
theta = np.random.randn(2, 1)   # random initialisation

for epoch in range(n_epochs):
    gradients = 2 / m * X_b.T @ (X_b @ theta - y)
    theta = theta - eta * ‹gradients›`,
        notes: { 9: 'Gradient of the MSE cost: (2/m)·Xᵀ(Xθ − y) over the full training set (= batch).', 10: 'Step downhill by η·gradient. η too large → diverge; too small → slow convergence.' },
      },
      {
        id: 'logreg', title: 'Logistic Regression', file: 'logistic_regression.py',
        context: 'Classify Iris-Virginica from petal width — a linear decision boundary via the sigmoid.',
        code: `from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split

X = iris.data[["petal width (cm)"]].values
y = iris.target_names[iris.target] == '‹virginica›'
X_train, X_test, y_train, y_test = train_test_split(X, y, random_state=42)

log_reg = ‹LogisticRegression›(random_state=42)
log_reg.fit(X_train, y_train)`,
        notes: { 6: 'random_state fixes the split → reproducible results (avoids data-snooping bias).', 8: 'Logistic regression: p̂ = σ(θᵀx). Its log-loss is convex, so GD finds the global minimum.' },
      },
    ],
    predict: [
      {
        file: 'gd_variants.py',
        code: `gradients = 2 / m * X_b.T @ (X_b @ theta - y)
theta = theta - eta * gradients`,
        q: 'This computes the gradient over the WHOLE training set each step. Which variant is it?',
        opts: ['Stochastic GD', 'Batch GD', 'Mini-batch GD', 'Normal Equation'], ans: 1,
        ok: 'Batch GD — it averages over all m instances (2/m · Xᵀ(Xθ−y)) every step: an accurate gradient, but slow on large datasets.',
      },
    ],
  },
  {
    id: 'cl-l4', title: 'L4 · Reg & kNN', color: '#fbbf24', go: 'Reg. & kNN',
    heading: 'Regularisation & k-NN',
    blurb: 'Ridge / Lasso / Elastic Net and instance-based k-NN.',
    concepts: [
      {
        id: 'regularization', title: 'Ridge / Lasso / Elastic Net', file: 'regularization.py',
        context: 'Three regularised linear models. alpha = strength; l1_ratio = the Elastic Net mix.',
        code: `from sklearn.linear_model import Ridge, Lasso, ElasticNet

ridge_reg = ‹Ridge›(alpha=0.1, solver="cholesky")
ridge_reg.fit(X, y)

lasso_reg = Lasso(alpha=‹0.1›)
lasso_reg.fit(X, y)

elastic_net = ElasticNet(alpha=0.1, l1_ratio=0.5)
elastic_net.fit(X, y)`,
        notes: { 3: 'Ridge = ℓ₂ penalty αΣθ² — shrinks weights smoothly, never exactly to zero.', 6: 'Lasso = ℓ₁ penalty αΣ|θ| — drives some weights to exactly 0 (automatic feature selection).', 9: 'Elastic Net mixes both; l1_ratio = r balances ℓ₁ vs ℓ₂.' },
      },
      {
        id: 'knn', title: 'k-Nearest Neighbours (multilabel)', file: 'knn.py',
        context: 'k-NN is instance-based — it just stores the data. Remember to scale features first.',
        code: `import numpy as np
from sklearn.neighbors import KNeighborsClassifier

y_train_large = (y_train >= '7')
y_train_odd = (y_train.astype('int8') % 2 == 1)
y_multilabel = np.c_[y_train_large, y_train_odd]

knn_clf = ‹KNeighborsClassifier›()
knn_clf.fit(X_train, y_multilabel)`,
        notes: { 6: 'np.c_ stacks two boolean targets → multilabel: each instance gets several binary labels.', 8: 'k-NN learns no model; at predict time it compares a new point to its k nearest neighbours.' },
      },
    ],
    predict: [
      {
        file: 'lasso_vs_ridge.py',
        code: `lasso = Lasso(alpha=0.5)
lasso.fit(X, y)
print((lasso.coef_ == 0).sum(), "coefficients are exactly zero")`,
        q: 'Compared to Ridge, what can Lasso (ℓ₁) uniquely do to coefficients?',
        opts: ['Make them all equal', 'Drive some to exactly 0 (feature selection)', 'Make them all negative', 'Nothing different from Ridge'], ans: 1,
        ok: 'The ℓ₁ penalty has corners on the axes, so the optimum often sits where some coefficients are exactly 0 — automatic feature selection. Ridge only shrinks toward zero.',
      },
    ],
  },
  {
    id: 'cl-l5', title: 'L5 · SVMs', color: '#fb7185', go: 'SVMs',
    heading: 'Support Vector Machines',
    blurb: 'Scaled linear SVM, polynomial features, and the kernel trick.',
    concepts: [
      {
        id: 'linear-svm', title: 'Linear SVM (scaled pipeline)', file: 'linear_svm.py',
        context: 'A linear SVM in a pipeline. SVMs are scale-sensitive — only fit the scaler on training data.',
        code: `from sklearn.datasets import load_iris
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.svm import LinearSVC

iris = load_iris(as_frame=True)
X = iris.data[["petal length (cm)", "petal width (cm)"]].values
y = (iris.target == 2)  # Iris virginica

svm_clf = make_pipeline(‹StandardScaler›(),
                        LinearSVC(C=‹1›, dual=True, random_state=42))
svm_clf.fit(X, y)`,
        notes: { 10: 'make_pipeline chains the scaler with the SVM so scaling is part of fit/predict.', 11: 'C is the soft-margin penalty: small C → wider street + more violations; large C → narrow.' },
      },
      {
        id: 'nonlinear-svm', title: 'Nonlinear SVM (polynomial features)', file: 'nonlinear_svm.py',
        context: 'Make non-linear data separable by adding polynomial features, then a linear SVM.',
        code: `from sklearn.datasets import make_moons
from sklearn.preprocessing import PolynomialFeatures

X, y = make_moons(n_samples=100, noise=0.15, random_state=42)

polynomial_svm_clf = make_pipeline(
    PolynomialFeatures(degree=‹3›),
    StandardScaler(),
    LinearSVC(C=10, max_iter=10_000, dual=True, random_state=42))
polynomial_svm_clf.fit(X, y)`,
        notes: { 4: 'make_moons is a classic non-linearly-separable 2D dataset.', 7: 'Adding polynomial features can turn a non-linear problem into a linearly separable one.' },
      },
      {
        id: 'kernel-svm', title: 'The kernel trick (poly kernel)', file: 'kernel_svm.py',
        context: 'The kernel trick gives the effect of many polynomial features — without computing them. SVC supports kernels; LinearSVC does not.',
        code: `from sklearn.svm import SVC

poly_kernel_svm_clf = make_pipeline(StandardScaler(),
                                    SVC(kernel="‹poly›", degree=3, coef0=1, C=5))
poly_kernel_svm_clf.fit(X, y)`,
        notes: { 4: 'kernel="poly" implicitly works in the degree-3 feature space; coef0 = r weights high vs low-degree terms.' },
      },
    ],
    predict: [
      {
        file: 'svm_C.py',
        code: `svm = SVC(kernel="rbf", gamma=5, C=1000)
svm.fit(X, y)`,
        q: 'You set a very large C. What happens to the margin?',
        opts: ['Wider street, more violations allowed', 'Narrower street, fewer violations — tighter fit (overfit risk)', 'C has no effect on the margin', 'It switches to a linear kernel'], ans: 1,
        ok: 'Large C heavily penalises violations → a narrow street that hugs the data (overfitting risk). Small C → wider street, more violations, usually better generalisation.',
      },
    ],
  },
  {
    id: 'cl-l6', title: 'L6 · Trees', color: '#60a5fa', go: 'Decision Trees',
    heading: 'Decision Trees',
    blurb: 'Train, read class probabilities, and do regression with CART.',
    concepts: [
      {
        id: 'train-tree', title: 'Train & visualise a tree', file: '06_decision_trees.py',
        context: "Train a depth-2 tree on Iris. Trees need no scaling and are 'white-box' (readable).",
        code: `from sklearn.datasets import load_iris
from sklearn.tree import DecisionTreeClassifier

iris = load_iris(as_frame=True)
X_iris = iris.data[["petal length (cm)", "petal width (cm)"]].values
y_iris = iris.target

tree_clf = DecisionTreeClassifier(max_depth=‹2›)
tree_clf.fit(X_iris, y_iris)`,
        notes: { 8: 'max_depth is the main regulariser: smaller → higher bias, less overfitting.', 9: 'CART grows greedily, picking the split that most reduces weighted Gini impurity.' },
      },
      {
        id: 'tree-proba', title: 'Estimating class probabilities', file: 'tree_proba.py',
        context: "A leaf stores class counts; normalise them to get predicted probabilities.",
        code: `tree_clf.‹predict_proba›([[5, 1.5]]).round(3)
# array([[0.   , 0.907, 0.093]])

tree_clf.predict([[5, 1.5]])
# array([1])   # class 1 = versicolor`,
        notes: { 1: "A leaf's probabilities = the class fractions among its training samples (49/54, 5/54).", 4: 'predict returns the argmax (most probable) class of the reached leaf.' },
      },
      {
        id: 'tree-reg', title: 'Regression tree', file: 'tree_regression.py',
        context: 'Trees do regression too: piecewise-constant predictions (the mean target per leaf region).',
        code: `import numpy as np
from sklearn.tree import DecisionTreeRegressor

X_quad = np.random.rand(200, 1) - 0.5            # one random input feature
y_quad = X_quad ** 2 + 0.025 * np.random.randn(200, 1)

tree_reg = ‹DecisionTreeRegressor›(max_depth=2, random_state=42)
tree_reg.fit(X_quad, y_quad)`,
        notes: { 5: 'A noisy quadratic; max_depth controls the resolution of the step function.', 7: 'A regression tree splits to minimise MSE; each leaf predicts the MEAN target of its region.' },
      },
    ],
    predict: [
      {
        file: 'tree_proba.py',
        code: `# the leaf reached by [5, 1.5] has training counts value = [0, 49, 5]
tree_clf.predict_proba([[5, 1.5]]).round(3)`,
        q: 'The leaf has class counts [0, 49, 5] over 54 samples. What does predict_proba return?',
        opts: ['[0.0, 0.5, 0.5]', '[0.0, 0.907, 0.093]', '[0.333, 0.333, 0.333]', '[0, 49, 5]'], ans: 1,
        ok: 'Normalise the counts: 49/54 = 0.907, 5/54 = 0.093 → [0.0, 0.907, 0.093]. predict() then returns the argmax (class 1).',
      },
    ],
  },
  {
    id: 'cl-l7', title: 'L7 · Ensembles', color: '#f472b6', go: 'Ensembles',
    heading: 'Ensembles & Random Forests',
    blurb: 'Voting, bagging/OOB, random forests, boosting and stacking.',
    concepts: [
      {
        id: 'voting', title: 'Voting classifier', file: 'voting.py',
        context: 'Combine diverse models — wisdom of the crowd. Hard = majority; soft = average probabilities.',
        code: `from sklearn.ensemble import RandomForestClassifier, VotingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.svm import SVC

voting_clf = ‹VotingClassifier›(
    estimators=[
        ('lr',  LogisticRegression(random_state=42)),
        ('rf',  RandomForestClassifier(random_state=42)),
        ('svc', SVC(random_state=42))
    ])
voting_clf.fit(X_train, y_train)`,
        notes: { 5: "Default is hard voting; set voting='soft' to average predict_proba (often better).", 7: 'Diversity (different algorithms) is what makes the ensemble beat any single model.' },
      },
      {
        id: 'bagging', title: 'Bagging + Out-of-Bag', file: 'bagging.py',
        context: 'Bag 500 trees with out-of-bag scoring — no separate validation split needed.',
        code: `from sklearn.ensemble import BaggingClassifier
from sklearn.tree import DecisionTreeClassifier

bag_clf = BaggingClassifier(
    DecisionTreeClassifier(), n_estimators=500,
    oob_score=‹True›, n_jobs=-1, random_state=42)
bag_clf.fit(X_train, y_train)
bag_clf.oob_score_                  # 0.896`,
        notes: { 5: 'Bagging = bootstrap sampling (with replacement) + aggregation → lower variance.', 8: 'OOB: the ~⅓ of instances not sampled by each tree act as a free validation set.' },
      },
      {
        id: 'rf', title: 'Random Forest + feature importance', file: 'random_forest.py',
        context: 'A random forest and its feature importances. On Iris, petal length & width dominate (~0.86 together).',
        code: `from sklearn.ensemble import RandomForestClassifier

rnd_clf = ‹RandomForestClassifier›(n_estimators=500, random_state=42)
rnd_clf.fit(iris.data, iris.target)

for score, name in zip(rnd_clf.feature_importances_, iris.feature_names):
    print(round(score, 2), name)`,
        notes: { 3: 'RF = bagged trees + at each split it searches only a random √n subset of features → more diversity.', 6: 'feature_importances_ = average impurity decrease across all trees (normalised to sum 1).' },
      },
      {
        id: 'adaboost', title: 'AdaBoost', file: 'adaboost.py',
        context: "AdaBoost chains 30 decision stumps, each focusing on the previous one's mistakes.",
        code: `from sklearn.ensemble import AdaBoostClassifier

ada_clf = AdaBoostClassifier(
    DecisionTreeClassifier(max_depth=‹1›),
    n_estimators=30, learning_rate=0.5, random_state=42)
ada_clf.fit(X_train, y_train)`,
        notes: { 4: "A max_depth=1 tree is a 'decision stump' — AdaBoost's default weak learner.", 5: 'Boosting is sequential: each predictor re-weights the instances its predecessor misclassified.' },
      },
      {
        id: 'gbrt', title: 'Gradient Boosting (manual)', file: 'gbrt.py',
        context: 'Gradient Boosting by hand: fit a tree, fit the next to its residuals, sum them. (GradientBoostingRegressor automates this.)',
        code: `from sklearn.tree import DecisionTreeRegressor

tree_reg1 = DecisionTreeRegressor(max_depth=2)
tree_reg1.fit(X, y)

y2 = y - tree_reg1.predict(X)            # residuals of tree 1
tree_reg2 = DecisionTreeRegressor(max_depth=2)
tree_reg2.fit(X, y2)

y3 = y2 - tree_reg2.predict(X)           # residuals of tree 2
tree_reg3 = DecisionTreeRegressor(max_depth=2)
tree_reg3.fit(X, y3)

y_pred = ‹sum›(tree.predict(X_new)
           for tree in (tree_reg1, tree_reg2, tree_reg3))`,
        notes: { 6: 'Gradient boosting fits each new tree to the RESIDUAL errors of the previous one.', 14: "The ensemble's prediction is the SUM of all the trees' outputs." },
      },
      {
        id: 'gbrt-builtin', title: 'Gradient Boosting (built-in + early stopping)', file: 'gbrt_builtin.py',
        context: 'GradientBoostingRegressor automates the residual-fitting loop. Low learning_rate + many trees + early stopping is the recommended recipe.',
        code: `from sklearn.ensemble import GradientBoostingRegressor

gbrt = GradientBoostingRegressor(max_depth=2, n_estimators=3, learning_rate=1.0)
gbrt.fit(X, y)

# better generalisation: small learning_rate + many trees + early stopping
gbrt_best = GradientBoostingRegressor(
    max_depth=2, learning_rate=‹0.05›,
    n_estimators=500, n_iter_no_change=10)
gbrt_best.fit(X, y)
gbrt_best.n_estimators_   # e.g. 92 (stopped early)`,
        notes: { 3: 'The built-in class does the manual residual-tree loop for you.', 8: 'Shrinkage: a low learning_rate needs more trees but generalises better.', 9: 'n_iter_no_change enables early stopping — training halts once validation stops improving.' },
      },
      {
        id: 'stacking', title: 'Stacking', file: 'stacking.py',
        context: "Stacking learns a 'blender' to combine base predictions, instead of a fixed vote.",
        code: `from sklearn.ensemble import StackingClassifier

stacking_clf = StackingClassifier(
    estimators=[
        ('lr',  LogisticRegression()),
        ('rf',  RandomForestClassifier()),
        ('svc', SVC(probability=True))
    ],
    final_estimator=‹RandomForestClassifier›(),
    cv=5)
stacking_clf.fit(X_train, y_train)`,
        notes: { 9: "The final_estimator (the 'blender') learns how to combine the base models' predictions.", 10: 'cv=5: base models predict out-of-fold, so the blender trains on unbiased inputs.' },
      },
    ],
    predict: [
      {
        file: 'rf_importance.py',
        code: `rnd_clf = RandomForestClassifier(n_estimators=500, random_state=42)
rnd_clf.fit(iris.data, iris.target)
print(rnd_clf.feature_importances_.round(2))`,
        q: 'On Iris, which features get the highest importance?',
        opts: ['sepal length & sepal width', 'petal length & petal width', 'all four equally', 'sepal width alone'], ans: 1,
        ok: 'Petal length (~0.44) and petal width (~0.42) dominate — together ~86% of the predictive power. Sepal width is almost worthless.',
      },
    ],
  },
  {
    id: 'cl-l8', title: 'L8 · Dim. Reduction', color: '#2dd4bf', go: 'Dimensionality Reduction',
    heading: 'Dimensionality Reduction',
    blurb: 'PCA via SVD and scikit-learn, kernel PCA, and t-SNE.',
    concepts: [
      {
        id: 'pca-svd', title: 'PCA via SVD (NumPy)', file: 'pca_svd.py',
        context: 'PCA from scratch via SVD. np.linalg.svd returns Vᵀ, so transpose to read the axes.',
        code: `X_centered = X - X.mean(axis=0)          # PCA needs centred data
U, s, Vt = np.linalg.‹svd›(X_centered)
c1 = Vt.T[:, 0]                          # 1st principal axis
c2 = Vt.T[:, 1]                          # 2nd principal axis`,
        notes: { 1: 'Always centre the data first — PCA measures variance about the mean.', 2: 'SVD: X = UΣVᵀ. The columns of V (rows of Vt) are the principal axes.' },
      },
      {
        id: 'pca-sklearn', title: 'PCA + explained variance + choosing d', file: 'pca_sklearn.py',
        context: 'scikit-learn PCA, the explained-variance ratio, and the one-liner that picks d for 95% variance.',
        code: `from sklearn.decomposition import PCA

pca = PCA(n_components=2)
X2D = pca.fit_transform(X)
pca.explained_variance_ratio_       # array([0.84248607, 0.14631839])

# keep 95% of the variance automatically:
pca = PCA(n_components=‹0.95›)
X_reduced = pca.fit_transform(X)`,
        notes: { 5: 'explained_variance_ratio_ = the fraction of variance each PC preserves.', 8: 'A float in (0,1) keeps just enough components for that much variance (MNIST: 784 → 154).' },
      },
      {
        id: 'kernel-pca', title: 'Kernel PCA', file: 'kernel_pca.py',
        context: 'Kernel PCA: a non-linear PCA via the kernel trick (RBF here) — unrolls e.g. concentric circles.',
        code: `from sklearn.decomposition import KernelPCA

kernel_pca = KernelPCA(n_components=2, kernel="‹rbf›", gamma=10,
                       fit_inverse_transform=True, alpha=0.1)
X_reduced = kernel_pca.fit_transform(X_train)`,
        notes: { 3: 'The kernel trick gives a non-linear projection that ordinary (linear) PCA cannot.' },
      },
      {
        id: 'tsne', title: 't-SNE', file: 'tsne.py',
        context: 't-SNE for visualising high-dimensional data in 2D (slow; run it on a subset).',
        code: `from sklearn.manifold import TSNE

tsne = TSNE(n_components=‹2›, init="random",
            learning_rate="auto", random_state=42)
X_reduced = tsne.fit_transform(X_sample)`,
        notes: { 3: 't-SNE keeps similar points close & dissimilar points apart — visualisation only (MNIST → 2D clusters).' },
      },
    ],
    predict: [
      {
        file: 'pca_mnist.py',
        code: `pca = PCA(n_components=0.95)
X_reduced = pca.fit_transform(X_train)   # MNIST: 70000 x 784
print(pca.n_components_)`,
        q: 'Keeping 95% of MNIST variance reduces 784 features to about how many?',
        opts: ['About 2', 'About 154', 'About 700', 'Exactly 95'], ans: 1,
        ok: 'About 154 — dropping just 5% of the variance compresses 784 → 154 dims, greatly speeding up downstream models.',
      },
    ],
  },
  {
    id: 'cl-l9', title: 'L9 · Clustering', color: '#c084fc', go: 'Clustering',
    heading: 'Unsupervised Learning',
    blurb: 'k-means, semi-supervised labelling, and DBSCAN.',
    concepts: [
      {
        id: 'kmeans', title: 'k-Means', file: 'kmeans.py',
        context: 'k-means clustering. You must choose k; inertia and the silhouette score help.',
        code: `from sklearn.cluster import KMeans
from sklearn.datasets import make_blobs

X, y = make_blobs(...)            # 2D blobs, 5 clusters
k = 5
kmeans = KMeans(n_clusters=‹k›, random_state=42)
y_pred = kmeans.fit_predict(X)

kmeans.cluster_centers_           # the k centroid coordinates
kmeans.inertia_                   # sum of squared distances (lower = tighter)`,
        notes: { 6: 'k-means loops: assign each point to its nearest centroid → move centroids to the mean → repeat.', 10: 'inertia = Σ‖xᵢ − nearest centroid‖². Pick k via the silhouette score, not by minimising inertia.' },
      },
      {
        id: 'semi-sup', title: 'Semi-supervised: representatives', file: 'semi_supervised.py',
        context: 'Label one representative per cluster, then propagate — beats labelling 50 random digits (74.8% → 84.9%).',
        code: `k = 50
kmeans = KMeans(n_clusters=k, random_state=42)
X_digits_dist = kmeans.fit_transform(X_train)            # 1400 x 50
representative_digit_idx = np.‹argmin›(X_digits_dist, axis=0)
X_representative_digits = X_train[representative_digit_idx]`,
        notes: { 3: "fit_transform gives each instance's distance to all 50 centroids.", 4: 'argmin picks the instance CLOSEST to each centroid — the most representative digit to hand-label.' },
      },
      {
        id: 'dbscan', title: 'DBSCAN', file: 'dbscan.py',
        context: 'Density-based clustering: any-shape clusters and anomalies, just two hyperparameters.',
        code: `from sklearn.cluster import DBSCAN
from sklearn.datasets import make_moons

X, y = make_moons(n_samples=1000, noise=0.05)
dbscan = DBSCAN(eps=‹0.05›, min_samples=5)
dbscan.fit(X)

dbscan.labels_                 # cluster id per point, -1 = anomaly
dbscan.core_sample_indices_    # indices of the core instances`,
        notes: { 5: 'eps = neighbourhood radius; min_samples = density needed to be a core point.', 8: 'Label -1 = anomaly. Larger eps → fewer anomalies, but separate clusters may merge.' },
      },
      {
        id: 'dbscan-predict', title: 'DBSCAN — predicting new points', file: 'dbscan_predict.py',
        context: "DBSCAN has no predict() — fit a k-NN on its core samples to classify new points.",
        code: `from sklearn.neighbors import KNeighborsClassifier

knn = KNeighborsClassifier(n_neighbors=50)
knn.fit(dbscan.components_, dbscan.labels_[dbscan.core_sample_indices_])

X_new = np.array([[-0.5, 0], [0, 0.5], [1, -0.1], [2, 1]])
knn.‹predict›(X_new)            # array([1, 0, 1, 0])`,
        notes: { 3: 'DBSCAN exposes no predict() method of its own.', 4: 'So train a k-NN on the core samples (components_) and their labels to classify new points.' },
      },
    ],
    predict: [
      {
        file: 'dbscan_eps.py',
        code: `dbscan = DBSCAN(eps=0.05, min_samples=5).fit(X)   # moons, 1000 pts
print((dbscan.labels_ == -1).sum(), "anomalies")
# ... then re-run with eps = 0.20`,
        q: 'Raising eps from 0.05 to 0.20 on the moons data changes the anomaly count from 84 to…',
        opts: ['Even more (≈200)', '0', 'Unchanged (84)', 'A negative number'], ans: 1,
        ok: '0 — a bigger ε grows every neighbourhood, so more points reach min_samples and join clusters as core/border, leaving no anomalies (though separate clusters may wrongly merge).',
      },
    ],
  },
];

function CodeLab({ onOpen }) {
  const [grp, setGrp] = useState(CODE_GROUPS[0].id);
  const gi = CODE_GROUPS.findIndex(x => x.id === grp);
  const g = CODE_GROUPS[gi];
  return (
    <div>
      <div className="m4-sec-hdr">
        <h2 className="m4-sec-title">Code Lab <span className="m4-badge" style={{ background: 'rgba(167,139,250,0.12)', color: 'var(--violet)', border: '1px solid rgba(167,139,250,0.3)' }}>Lectures 1–9 · learn the implementation</span></h2>
      </div>
      <p className="m4-sec-sub">The coding side of CITS5508 — every key scikit-learn / NumPy snippet from the lectures, grouped by concept. Read the annotated walkthrough, then test recall with fill-in-the-blank, line-reordering, predict-the-output and recall modes.</p>
      <div className="m4-labtabs">
        {CODE_GROUPS.map(x => (
          <button key={x.id} className={`m4-labtab ${grp === x.id ? 'm4-labtab--on' : ''}`} onClick={() => setGrp(x.id)}>{x.title}</button>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap', padding: '0.6rem 0.9rem', borderRadius: 8, background: `linear-gradient(90deg, ${g.color}24 0%, ${g.color}0a 55%, transparent 100%)`, borderLeft: `4px solid ${g.color}`, marginBottom: '1rem' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-0)' }}>{g.heading}</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-2)', marginTop: '0.18rem' }}>{g.blurb}</div>
        </div>
        <button className="m4-btn" style={{ borderColor: `${g.color}66`, color: g.color, flexShrink: 0 }} onClick={() => onOpen(g.go)}>Open module →</button>
      </div>
      {g.concepts.map((c, i) => <ConceptLab key={c.id} c={c} color={g.color} seed={(gi + 1) * 100 + i} />)}
      {g.predict && g.predict.length > 0 && (
        <>
          <div className="cl-sub">Predict the output</div>
          {g.predict.map((p, i) => <PredictCard key={i} item={p} color={g.color} />)}
        </>
      )}
    </div>
  );
}

function ExamSummary({ onOpen }) {
  const [cheatCode, setCheatCode] = useState(null);
  return (
    <div>
      <div className="m4-sec-hdr">
        <h2 className="m4-sec-title">Exam Summary <span className="m4-badge" style={{ background: 'rgba(52,211,153,0.12)', color: 'var(--emerald)', border: '1px solid rgba(52,211,153,0.3)' }}>Lectures 1–9 · Revise in one pass</span></h2>
      </div>
      <p className="m4-sec-sub">A complete, colour-coded cheat-sheet of every major topic, formula and algorithm in CITS5508 — built for fast memorisation. Jump to any lecture, scan the must-remember boxes, then drill into the interactive modules.</p>
      <ExamNav />

      {/* ── MASTER ALGORITHM CHEAT-SHEET ─────────────────────────────────── */}
      <section id="ex-master" style={{ scrollMarginTop: '120px', marginBottom: '2.25rem' }}>
        <div className="m4-card">
          <div className="m4-card-h">Master Algorithm Cheat-Sheet — the whole unit on one screen</div>
          <div style={{ overflowX: 'auto' }}>
            <table className="m4-ptable" style={{ minWidth: 720 }}>
              <thead><tr><th>Algorithm</th><th>Category</th><th>Core idea / formula</th><th>Must-know fact</th></tr></thead>
              <tbody>
                <tr><td className="pk">Linear Regression</td><td>Supervised · Regression</td><td>ŷ = θᵀx; minimise MSE</td><td>Closed form (Normal Eq) O(n³) in features; else use GD</td></tr>
                <tr><td className="pk">Logistic Regression</td><td>Supervised · Classification</td><td>p̂ = σ(θᵀx); log loss</td><td>Convex cost → GD finds global min; linear boundary</td></tr>
                <tr><td className="pk">Softmax Regression</td><td>Supervised · Multiclass</td><td>p̂ₖ = softmax(sₖ); cross-entropy</td><td>Multinomial logistic; predicts argmax score</td></tr>
                <tr><td className="pk">k-NN</td><td>Supervised · Instance-based</td><td>Majority vote of k nearest (Minkowski)</td><td>No training; must scale features; small k overfits</td></tr>
                <tr><td className="pk">SVM</td><td>Supervised · Class + Reg</td><td>Widest margin; kernel trick</td><td>Scale-sensitive; SVC is O(m²–m³·n) — small/medium data</td></tr>
                <tr><td className="pk">Decision Tree</td><td>Supervised · Class + Reg</td><td>CART: greedy axis-aligned splits</td><td>White-box; nonparametric; high variance → overfits</td></tr>
                <tr><td className="pk">Random Forest</td><td>Ensemble (bagging)</td><td>Many trees + √n feature subset per split</td><td>Reduces variance; feature importance free</td></tr>
                <tr><td className="pk">AdaBoost / GBRT</td><td>Ensemble (boosting)</td><td>Sequential; reweight / fit residuals</td><td>Reduces bias; cannot parallelise; watch overfitting</td></tr>
                <tr><td className="pk">PCA</td><td>Unsupervised · DR</td><td>Max-variance linear projection via SVD</td><td>Centre data first; choose d for 95% variance</td></tr>
                <tr><td className="pk">k-Means</td><td>Unsupervised · Clustering</td><td>Assign ↔ update centroids; minimise inertia</td><td>Pick k via silhouette; spherical clusters only</td></tr>
                <tr><td className="pk">DBSCAN</td><td>Unsupervised · Clustering</td><td>Density: core / border / noise via ε</td><td>Any shape + anomalies; O(m²n), no predict()</td></tr>
              </tbody>
            </table>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', marginTop: '0.8rem' }}>
            <div style={{ background: 'rgba(34,211,238,0.07)', border: '1px solid rgba(34,211,238,0.3)', borderRadius: 6, padding: '0.7rem 0.85rem' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.66rem', fontWeight: 700, color: 'var(--cyan)', marginBottom: '0.35rem' }}>SUPERVISED (labelled X → y)</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-1)', lineHeight: 1.55 }}>Classification (nominal y) & Regression (real y). Linear/Logistic/Softmax Regression, k-NN, SVM, Decision Trees, Random Forests.</div>
            </div>
            <div style={{ background: 'rgba(167,139,250,0.07)', border: '1px solid rgba(167,139,250,0.3)', borderRadius: 6, padding: '0.7rem 0.85rem' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.66rem', fontWeight: 700, color: 'var(--violet)', marginBottom: '0.35rem' }}>UNSUPERVISED (no labels)</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-1)', lineHeight: 1.55 }}>Clustering (k-means, DBSCAN, HCA), Dimensionality Reduction / Visualisation (PCA, LLE, t-SNE), Association rules (Apriori, Eclat), Anomaly detection.</div>
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════ LECTURE 1 ════════════════════ */}
      <ExLec lec={EXAM_LECTURES[0]} onOpen={onOpen} onCheat={setCheatCode}>
        <div className="m4-two-col">
          <div className="m4-card">
            <div className="m4-card-h">What is Machine Learning?</div>
            <ul className="m4-bullets">
              <li><strong>Samuel (1959):</strong> field that lets computers learn "without being explicitly programmed."</li>
              <li><strong>Mitchell (1997):</strong> learns from experience <strong>E</strong> w.r.t. task <strong>T</strong> and performance <strong>P</strong>, if P on T improves with E.</li>
              <li>ML = <strong>inductive learning</strong>: infer generic rules from specific examples.</li>
            </ul>
            <div className="m4-flabel" style={{ marginTop: '0.6rem' }}>Spam filter as E / T / P</div>
            <table className="m4-ptable">
              <tbody>
                <tr><td className="pk">E</td><td>Example spam & non-spam emails (labelled)</td></tr>
                <tr><td className="pk">T</td><td>Decide if a new email is spam</td></tr>
                <tr><td className="pk">P</td><td>Accuracy on new emails</td></tr>
              </tbody>
            </table>
            <ExRemember color="#22d3ee" label="Mnemonic — E / T / P">Read it as "<strong>E</strong>xperience improves <strong>T</strong>ask measured by <strong>P</strong>erformance." Each example = feature vector <Tex src="\vec{x}_i" /> + label <Tex src="y_i" />.</ExRemember>
          </div>
          <div className="m4-card">
            <div className="m4-card-h">Formal Model & Simple Linear Classifier</div>
            <ExF label="Dataset & functions" src="D_i = (\vec{x}_i, y_i),\quad f:\mathcal{X}\to\mathcal{Y},\quad g\in\mathcal{H},\; g\approx f" color="#22d3ee" note="n examples, m attributes. f = unknown target; g = learned hypothesis from hypothesis space H." />
            <ExF label="Linear decision threshold" src="\sum_{i=1}^{m} w_i x_i > -b \;\Longleftrightarrow\; h(\vec{x}) = \mathrm{sgn}\!\left(\sum_{i=1}^{m} w_i x_i + b\right)" color="#22d3ee" />
            <ExF label="Sign function" src="\mathrm{sgn}(x) = \begin{cases} -1 & x < 0 \\ +1 & x > 0 \end{cases}" color="#22d3ee" note="Binary case: 𝒳 = ℝᵐ, 𝒴 = {−1, +1}." />
          </div>
        </div>
        <div className="m4-card">
          <div className="m4-card-h">System Types · Challenges · Validation</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.6rem' }}>
            <div style={{ background: '#22d3ee0c', border: '1px solid #22d3ee30', borderRadius: 6, padding: '0.7rem 0.8rem' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.66rem', fontWeight: 700, color: 'var(--cyan)', marginBottom: '0.4rem' }}>3 WAYS TO CATEGORISE</div>
              <ul style={{ margin: 0, paddingLeft: '1rem', fontSize: '0.76rem', color: 'var(--text-1)', lineHeight: 1.5, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <li>Supervised vs Unsupervised (labels?)</li>
                <li>Batch vs Online (learn incrementally?)</li>
                <li>Instance-based vs Model-based (how it generalises)</li>
              </ul>
            </div>
            <div style={{ background: '#fb71850c', border: '1px solid #fb718530', borderRadius: 6, padding: '0.7rem 0.8rem' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.66rem', fontWeight: 700, color: 'var(--rose)', marginBottom: '0.4rem' }}>MAIN CHALLENGES</div>
              <ul style={{ margin: 0, paddingLeft: '1rem', fontSize: '0.76rem', color: 'var(--text-1)', lineHeight: 1.5, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <li>Insufficient data</li>
                <li>Non-representative / poor-quality data</li>
                <li>Irrelevant features</li>
                <li>Overfitting (deg-15) / Underfitting (deg-1)</li>
              </ul>
            </div>
            <div style={{ background: '#34d3990c', border: '1px solid #34d39930', borderRadius: 6, padding: '0.7rem 0.8rem' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.66rem', fontWeight: 700, color: 'var(--emerald)', marginBottom: '0.4rem' }}>TESTING & VALIDATION</div>
              <ul style={{ margin: 0, paddingLeft: '1rem', fontSize: '0.76rem', color: 'var(--text-1)', lineHeight: 1.5, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <li>Train / Test split (~80 / 20)</li>
                <li>Generalisation = out-of-sample error</li>
                <li>Validation set for tuning (keep test sealed)</li>
              </ul>
            </div>
          </div>
          <ExRemember color="#fbbf24">Instance-based <em>memorises</em> examples + similarity (k-NN). Model-based <em>builds a model</em> then predicts. Tuning on the test set leaks information → always use a separate validation set.</ExRemember>
        </div>
      </ExLec>

      {/* ════════════════════ LECTURE 2 ════════════════════ */}
      <ExLec lec={EXAM_LECTURES[1]} onOpen={onOpen} onCheat={setCheatCode}>
        <div className="m4-two-col">
          <div className="m4-card">
            <div className="m4-card-h">Bias Trick, Vectorisation & Workflow</div>
            <ExF label="Bias trick (b → w₀, x₀ = 1)" src="h(x) = \mathrm{sgn}(w^\top x)" color="#a78bfa" note="Fold bias into the weight vector → one clean dot product. Vectorise with np.sign(X @ w) — no Python loops." />
            <ExF label="Perceptron update (on misclassification)" src="w \leftarrow w + y_i x_i \quad\text{if } y_i \neq h(x_i)" color="#a78bfa" />
            <div className="m4-flabel" style={{ marginTop: '0.6rem' }}>End-to-end project — 6 steps</div>
            <ol style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.77rem', color: 'var(--text-1)', lineHeight: 1.5, display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
              <li>Understand problem & assumptions</li>
              <li>Visualise / explore data</li>
              <li>Prepare data</li>
              <li>Select, train, validate & fine-tune model</li>
              <li>Present the solution</li>
              <li>Launch, monitor & maintain</li>
            </ol>
          </div>
          <div className="m4-card">
            <div className="m4-card-h">Regression Metrics</div>
            <ExF label="Mean Squared Error" src="\mathrm{MSE} = \frac{1}{m}\sum_{i=1}^{m}\left(h(x^{(i)}) - y^{(i)}\right)^2" color="#fb7185" />
            <ExF label="Mean Absolute Error" src="\mathrm{MAE} = \frac{1}{m}\sum_{i=1}^{m}\left|h(x^{(i)}) - y^{(i)}\right|" color="#34d399" />
            <ExRemember color="#fb7185" label="★ MSE vs MAE">MSE <strong>squares</strong> errors → punishes large outliers harder (more sensitive). MAE weights all errors equally (more robust). RMSE = √MSE, same units as target.</ExRemember>
          </div>
        </div>
        <div className="m4-card">
          <div className="m4-card-h">Classification Evaluation — MNIST (70k images, 784 = 28×28 features)</div>
          <div className="m4-two-col" style={{ marginTop: 0 }}>
            <div>
              <ExF label="Precision (of predicted +, how many right)" src="\text{precision} = \frac{TP}{TP + FP}" color="#a78bfa" />
              <ExF label="Recall / TPR / sensitivity (of actual +, how many caught)" src="\text{recall} = \frac{TP}{TP + FN}" color="#34d399" />
              <ExF label="F₁ — harmonic mean" src="F_1 = \frac{2}{\frac{1}{\text{precision}} + \frac{1}{\text{recall}}}" color="#fbbf24" />
            </div>
            <div>
              <ExRemember color="#fb7185" label="★ Why accuracy lies">On imbalanced data a dumb "always not-5" classifier still scores &gt;90%. Use the <strong>confusion matrix</strong>, precision, recall, F₁ instead.</ExRemember>
              <ExRemember color="#a78bfa" label="Precision/Recall trade-off">Raise the threshold → ↑precision, ↓recall. Prioritise <strong>precision</strong> when false positives are costly (safe to change lanes); <strong>recall</strong> when false negatives are costly (cancer screening).</ExRemember>
              <div style={{ fontSize: '0.77rem', color: 'var(--text-1)', lineHeight: 1.55, marginTop: '0.5rem' }}><strong>ROC curve:</strong> TPR vs FPR (= 1 − specificity) across thresholds; larger <strong>AUC</strong> = better.</div>
            </div>
          </div>
          <ExRemember color="#fbbf24" label="Mnemonic — Precision vs Recall">"<strong>P</strong>recision's denominator is what you <strong>P</strong>redicted positive (TP+FP); <strong>R</strong>ecall's is what is <strong>R</strong>eally positive (TP+FN)." Sampling bias: 1936 poll predicted Landon, but Roosevelt won 62%. Multiclass: Softmax/RF/Naïve-Bayes handle it directly; SVM is binary → OvA / OvO.</ExRemember>
        </div>
      </ExLec>

      {/* ════════════════════ LECTURE 3 ════════════════════ */}
      <ExLec lec={EXAM_LECTURES[2]} onOpen={onOpen} onCheat={setCheatCode}>
        <div className="m4-two-col">
          <div className="m4-card">
            <div className="m4-card-h">Linear Regression & the Normal Equation</div>
            <ExF label="Prediction" src="\hat{y} = h_\theta(x) = \theta^\top x = \theta_0 + \theta_1 x_1 + \cdots + \theta_n x_n" color="#34d399" />
            <ExF label="Cost — minimise MSE (RSS = m · MSE)" src="\mathrm{MSE}(X, h_\theta) = \frac{1}{m}\sum_{i=1}^{m}\left(\theta^\top x^{(i)} - y^{(i)}\right)^2" color="#34d399" />
            <ExF label="Normal Equation (closed form)" src="\hat{\theta} = (X^\top X)^{-1} X^\top y" color="#34d399" note="Linear in #instances m, but cubic O(n³) in #features — inverting XᵀX is the bottleneck for wide data." />
          </div>
          <div className="m4-card">
            <div className="m4-card-h">Gradient Descent</div>
            <ExF label="Gradient vector of MSE" src="\nabla_\theta\,\mathrm{MSE}(\theta) = \frac{2}{m} X^\top (X\theta - y)" color="#fbbf24" />
            <ExF label="Update step (η = learning rate)" src="\theta^{(t+1)} = \theta^{(t)} - \eta\,\nabla_\theta\,\mathrm{MSE}(\theta^{(t)})" color="#fbbf24" note="η too large → overshoot / diverge. Can stall in local minima or plateaus." />
          </div>
        </div>
        <div className="m4-card">
          <div className="m4-card-h">GD Variants</div>
          <ExVS items={[
            { title: 'Batch GD', color: '#22d3ee', points: ['Whole training set each step', 'Accurate gradient, stable', 'Slow on large data'] },
            { title: 'Stochastic GD', color: '#fb7185', points: ['One random instance per step', 'Fast, escapes local minima', 'Noisy — use a learning schedule'] },
            { title: 'Mini-batch GD', color: '#34d399', points: ['Small random subsets', 'Balances speed & stability', 'Exploits GPU vectorisation'] },
          ]} />
        </div>
        <div className="m4-two-col">
          <div className="m4-card">
            <div className="m4-card-h">Polynomial Regression & Learning Curves</div>
            <ul className="m4-bullets">
              <li>Add powers of features (x², x³…) then fit a <em>linear</em> model on them.</li>
              <li>High degree → <strong>overfit</strong> (fits noise); too simple → <strong>underfit</strong>.</li>
              <li><strong>Learning curves</strong> = train & validation error vs training-set size → diagnose over/underfitting.</li>
            </ul>
          </div>
          <div className="m4-card">
            <div className="m4-card-h">Logistic Regression</div>
            <ExF label="Sigmoid output" src="\hat{p} = \sigma(\theta^\top x),\qquad \sigma(t) = \frac{1}{1 + e^{-t}}" color="#34d399" note="Predict 1 if p̂ ≥ 0.5 (θᵀx ≥ 0)." />
            <ExF label="Log loss (cross-entropy)" src="J(\theta) = -\frac{1}{m}\sum_{i=1}^{m}\Big[y^{(i)}\log\hat{p}^{(i)} + (1-y^{(i)})\log(1-\hat{p}^{(i)})\Big]" color="#34d399" />
            <ExRemember color="#34d399">Log loss is <strong>convex</strong> → GD reaches the global minimum (no closed form). Creates a <em>linear</em> decision boundary (Iris-Virginica example).</ExRemember>
          </div>
        </div>
      </ExLec>

      {/* ════════════════════ LECTURE 4 ════════════════════ */}
      <ExLec lec={EXAM_LECTURES[3]} onOpen={onOpen} onCheat={setCheatCode}>
        <div className="m4-two-col">
          <div className="m4-card">
            <div className="m4-card-h">Bias / Variance Trade-off</div>
            <ExF label="Generalisation error decomposes into" src="\text{Error} = \text{Bias}^2 + \text{Variance} + \text{Irreducible}" color="#fbbf24" />
            <ExVS items={[
              { title: 'High Bias → Underfit', color: '#22d3ee', points: ['Wrong/too-strong assumptions', 'Too simple, inflexible', 'Fix: richer model, better features, less regularisation'] },
              { title: 'High Variance → Overfit', color: '#fb7185', points: ['Too sensitive to training data', 'Too flexible / complex', 'Fix: more data, CV, fewer dims, more regularisation'] },
            ]} />
            <ExRemember color="#fbbf24" label="★ Memory hook">↑complexity ⇒ ↑variance, ↓bias. Irreducible error = data noise (cannot remove).</ExRemember>
          </div>
          <div className="m4-card">
            <div className="m4-card-h">Fine-Tuning: CV, Grid Search, Early Stopping</div>
            <ul className="m4-bullets">
              <li><strong>Hyperparameter</strong> = set before training, constant during it (k in k-NN, poly degree, α, threshold).</li>
              <li><strong>k-fold CV</strong>: split train into k folds; train/validate k times; <code>GridSearchCV</code> / <code>RandomizedSearchCV</code> (large spaces).</li>
              <li>Retrain best model on the full training set, then evaluate once on the test set.</li>
              <li><strong>Early stopping</strong>: stop iterative GD when validation error bottoms out.</li>
            </ul>
          </div>
        </div>
        <div className="m4-card">
          <div className="m4-card-h">Regularised Linear Models — constrain the weights</div>
          <div className="m4-two-col" style={{ marginTop: 0 }}>
            <div>
              <ExF label="Ridge — ℓ₂ (squared) penalty" src="J(\theta) = \mathrm{MSE}(\theta) + \alpha\sum_{i=1}^{n}\theta_i^2" color="#22d3ee" />
              <ExF label="Lasso — ℓ₁ (absolute) penalty" src="J(\theta) = \mathrm{MSE}(\theta) + \alpha\sum_{i=1}^{n}|\theta_i|" color="#fb7185" />
              <ExF label="Elastic Net — mix (ratio r)" src="J(\theta) = \mathrm{MSE}(\theta) + r\alpha\sum_i|\theta_i| + \tfrac{1-r}{2}\alpha\sum_i\theta_i^2" color="#a78bfa" />
            </div>
            <div>
              <ExRemember color="#fb7185" label="★ Lasso vs Ridge">"<strong>L</strong>asso = <strong>ℓ1</strong> = diamond corners → drives weights to <strong>exactly 0</strong> (feature selection). Ridge = ℓ2 = round → only <strong>shrinks</strong>, never zeroes." Add the penalty <em>during training only</em>.</ExRemember>
              <div className="m4-flabel" style={{ marginTop: '0.5rem' }}>Softmax Regression (multiclass)</div>
              <ExF label="Class probability" src="\hat{p}_k = \frac{\exp(s_k(x))}{\sum_{j=1}^{K}\exp(s_j(x))},\quad s_k(x)=(\theta^{(k)})^\top x" color="#34d399" note="Predict argmaxₖ p̂ₖ; trained with cross-entropy." />
            </div>
          </div>
        </div>
        <div className="m4-card">
          <div className="m4-card-h">k-Nearest Neighbours (instance-based)</div>
          <div className="m4-two-col" style={{ marginTop: 0 }}>
            <div>
              <ExF label="Minkowski distance" src="D(x_i,x_j) = \left(\sum_{l=1}^{n} |x_i[l] - x_j[l]|^{p}\right)^{1/p}" color="#fbbf24" note="p = 1 Manhattan · p = 2 Euclidean." />
              <ExF label="Distance-weighted vote" src="w_i = \frac{1}{d(x_q, x_i)^2}" color="#fbbf24" />
            </div>
            <div>
              <ExRemember color="#fbbf24">No model is learned — lazy, memory-heavy, slow at prediction. <strong>Must normalise features</strong> (large scales dominate). Small k → overfit (noise); large k → underfit & favours majority class (bad for imbalanced data).</ExRemember>
              <div style={{ fontSize: '0.76rem', color: 'var(--text-1)', lineHeight: 1.55 }}><strong>Advanced tasks:</strong> Multiclass (N&gt;2; OvA/OvO for binary models) · Multilabel (several binary labels) · Multioutput-multiclass (each label many values, e.g. image denoising).</div>
            </div>
          </div>
        </div>
      </ExLec>

      {/* ════════════════════ LECTURE 5 ════════════════════ */}
      <ExLec lec={EXAM_LECTURES[4]} onOpen={onOpen} onCheat={setCheatCode}>
        <div className="m4-two-col">
          <div className="m4-card">
            <div className="m4-card-h">Large-Margin Classification</div>
            <ul className="m4-bullets">
              <li>Fit the <strong>widest "street"</strong> between classes; boundary decided only by <strong>support vectors</strong> (instances on the edge).</li>
              <li>Adding points off the street doesn't move the boundary.</li>
              <li><strong>Scale-sensitive</strong> → use <code>StandardScaler</code> (fit on train only!).</li>
              <li>Best for complex but <strong>small–medium</strong> datasets; does classification & regression.</li>
            </ul>
            <ExVS items={[
              { title: 'Hard Margin', color: '#fb7185', points: ['No violations allowed', 'Needs linearly separable data', 'Very sensitive to outliers'] },
              { title: 'Soft Margin', color: '#34d399', points: ['Allows some violations (slack ζ)', 'Balances width vs violations', 'Controlled by C'] },
            ]} />
          </div>
          <div className="m4-card">
            <div className="m4-card-h">The C Hyperparameter & Kernels</div>
            <ExRemember color="#fb7185" label="★ The C rule">Small <strong>C</strong> → wider street, more violations (more regularised). Large <strong>C</strong> → narrow street, fewer violations (risk of overfit). Overfitting? <em>Reduce C.</em></ExRemember>
            <ExF label="Gaussian RBF similarity / kernel" src="K(a,b) = \exp(-\gamma\lVert a - b\rVert^2)" color="#a78bfa" />
            <ExF label="Polynomial kernel" src="K(a,b) = (\gamma\, a^\top b + r)^d" color="#a78bfa" />
            <div style={{ fontSize: '0.76rem', color: 'var(--text-1)', lineHeight: 1.55 }}><strong>Kernel trick:</strong> get the result of adding many polynomial/similarity features <em>without</em> ever computing them. Kernels: Linear, Polynomial, Gaussian RBF, Sigmoid.</div>
          </div>
        </div>
        <div className="m4-two-col">
          <div className="m4-card">
            <div className="m4-card-h">Under the Hood — Optimisation</div>
            <ExF label="Decision function" src="\hat{y} = w^\top x + b \;\;(\ge 0 \Rightarrow 1,\; <0 \Rightarrow 0)" color="#fb7185" />
            <ExF label="Hard-margin objective" src="\min\; \tfrac{1}{2} w^\top w \;\; \text{s.t. } t^{(i)}(w^\top x^{(i)} + b) \ge 1" color="#fb7185" note="Smaller ‖w‖ ⇒ wider street. t = ±1." />
            <ExF label="Soft-margin objective" src="\min\; \tfrac{1}{2} w^\top w + C\sum_{i=1}^{m}\zeta^{(i)}" color="#fb7185" />
            <ExF label="Hinge-loss form (SGDClassifier)" src="J(w,b) = \tfrac{1}{2}w^\top w + C\sum_{i=1}^{m}\max\!\big(0,\, 1 - t^{(i)}(w^\top x^{(i)} + b)\big)" color="#fb7185" />
            <div style={{ fontSize: '0.74rem', color: 'var(--text-2)', lineHeight: 1.5 }}>Convex QP. The <strong>dual problem</strong> enables the kernel trick (faster when #features &gt; #instances).</div>
          </div>
          <div className="m4-card">
            <div className="m4-card-h">Computational Complexity & SVR</div>
            <table className="m4-ptable">
              <thead><tr><th>Class</th><th>Time</th><th>Kernel</th><th>Scale?</th></tr></thead>
              <tbody>
                <tr><td className="pk">LinearSVC</td><td>O(m·n)</td><td>No</td><td>Yes</td></tr>
                <tr><td className="pk">SVC</td><td>O(m²n)–O(m³n)</td><td>Yes</td><td>Yes</td></tr>
                <tr><td className="pk">SGDClassifier</td><td>O(m·n)</td><td>No</td><td>Yes</td></tr>
              </tbody>
            </table>
            <ExRemember color="#fbbf24">Large m → <strong>never</strong> use kernel SVC (cubic). Prefer LinearSVC / SGDClassifier. <strong>SVM Regression</strong> reverses the goal: fit as many points <em>inside</em> the ε-tube as possible.</ExRemember>
          </div>
        </div>
      </ExLec>

      {/* ════════════════════ LECTURE 6 ════════════════════ */}
      <ExLec lec={EXAM_LECTURES[5]} onOpen={onOpen} onCheat={setCheatCode}>
        <div className="m4-two-col">
          <div className="m4-card">
            <div className="m4-card-h">CART — Classification & Regression Trees</div>
            <ul className="m4-bullets">
              <li><strong>Greedy + top-down:</strong> best <em>local</em> split each node (global optimum is NP-hard).</li>
              <li><strong>Binary, axis-aligned</strong> splits (Xⱼ ≤ tⱼ); recursive rectangular regions.</li>
              <li>"Guess Who" = ask the most <strong>informative</strong> question first.</li>
              <li><strong>White-box</strong> (readable) vs black-box (RF, NN). No feature scaling needed.</li>
            </ul>
            <ExF label="Classification split cost (minimise)" src="J(k,t_k) = \frac{m_\text{left}}{m}G_\text{left} + \frac{m_\text{right}}{m}G_\text{right}" color="#60a5fa" />
            <table className="m4-ptable" style={{ marginTop: '0.5rem' }}>
              <tbody>
                <tr><td className="pk">Prediction</td><td>O(log₂ m) — very fast</td></tr>
                <tr><td className="pk">Training</td><td>O(n·m·log₂ m)</td></tr>
              </tbody>
            </table>
          </div>
          <div className="m4-card">
            <div className="m4-card-h">Impurity Measures</div>
            <ExF label="Gini impurity (default, faster)" src="G_i = 1 - \sum_{k=1}^{n} p_{i,k}^2" color="#60a5fa" note="Pure = 0; 50/50 = 0.5. Isolates the most frequent class." />
            <ExF label="Entropy (more balanced trees)" src="H_i = -\sum_{k,\,p_{i,k}\neq 0} p_{i,k}\log_2 p_{i,k}" color="#60a5fa" />
            <ExRemember color="#60a5fa">Both = 0 at a pure node; in practice they give very similar trees. Leaf <code>value</code> array → normalise for class probabilities.</ExRemember>
          </div>
        </div>
        <div className="m4-two-col">
          <div className="m4-card">
            <div className="m4-card-h">Regularisation & Pruning</div>
            <div style={{ fontSize: '0.77rem', color: 'var(--text-1)', lineHeight: 1.55, marginBottom: '0.4rem' }}>DTs are <strong>nonparametric</strong> → prone to overfit. Regularise by ↑<code>min_*</code> or ↓<code>max_*</code>:</div>
            <div style={{ marginBottom: '0.5rem' }}>
              <span style={{ display: 'inline-block', fontFamily: 'var(--font-mono)', fontSize: '0.66rem', color: '#60a5fa', background: '#60a5fa14', border: '1px solid #60a5fa3a', borderRadius: 4, padding: '0.18em 0.5em', margin: '0.12rem' }}>max_depth ↓</span>
              <span style={{ display: 'inline-block', fontFamily: 'var(--font-mono)', fontSize: '0.66rem', color: '#60a5fa', background: '#60a5fa14', border: '1px solid #60a5fa3a', borderRadius: 4, padding: '0.18em 0.5em', margin: '0.12rem' }}>min_samples_split ↑</span>
              <span style={{ display: 'inline-block', fontFamily: 'var(--font-mono)', fontSize: '0.66rem', color: '#60a5fa', background: '#60a5fa14', border: '1px solid #60a5fa3a', borderRadius: 4, padding: '0.18em 0.5em', margin: '0.12rem' }}>min_samples_leaf ↑</span>
              <span style={{ display: 'inline-block', fontFamily: 'var(--font-mono)', fontSize: '0.66rem', color: '#60a5fa', background: '#60a5fa14', border: '1px solid #60a5fa3a', borderRadius: 4, padding: '0.18em 0.5em', margin: '0.12rem' }}>max_leaf_nodes ↓</span>
              <span style={{ display: 'inline-block', fontFamily: 'var(--font-mono)', fontSize: '0.66rem', color: '#60a5fa', background: '#60a5fa14', border: '1px solid #60a5fa3a', borderRadius: 4, padding: '0.18em 0.5em', margin: '0.12rem' }}>max_features ↓</span>
            </div>
            <ExF label="Cost-complexity pruning (grow T₀, then minimise)" src="\sum_{l=1}^{|T|}\sum_{x_i \in R_l}(y_i - \hat{y}_{R_l})^2 + \alpha|T|" color="#60a5fa" note="α = 0 → full tree; α → ∞ → root only. Pick α by k-fold CV." />
          </div>
          <div className="m4-card">
            <div className="m4-card-h">Regression Trees & Limitations</div>
            <ExF label="Regression split cost (MSE)" src="J(k,t_k) = \frac{m_\text{left}}{m}\mathrm{MSE}_\text{left} + \frac{m_\text{right}}{m}\mathrm{MSE}_\text{right}" color="#60a5fa" note="Leaf predicts the mean response of its region (Hitters: Years/Hits → log salary)." />
            <ExRemember color="#fb7185" label="★ 3 limitations → fixes">1) Overfitting → regularise/prune. 2) Only axis-aligned → sensitive to rotation → <strong>PCA</strong> first. 3) High variance → <strong>Random Forests</strong>. Use linear models when the true relationship is ~linear.</ExRemember>
          </div>
        </div>
      </ExLec>

      {/* ════════════════════ LECTURE 7 ════════════════════ */}
      <ExLec lec={EXAM_LECTURES[6]} onOpen={onOpen} onCheat={setCheatCode}>
        <div className="m4-two-col">
          <div className="m4-card">
            <div className="m4-card-h">Voting — Wisdom of the Crowd</div>
            <ExVS items={[
              { title: 'Hard Voting', color: '#22d3ee', points: ['Majority class wins', 'Weak learners → strong ensemble', 'Needs enough & diverse models'] },
              { title: 'Soft Voting', color: '#34d399', points: ['Average predict_proba', 'Confident votes weigh more', 'Usually beats hard voting'] },
            ]} />
            <ExRemember color="#f472b6">Diversity is key — train different algorithms, or the same algorithm on different data/features.</ExRemember>
          </div>
          <div className="m4-card">
            <div className="m4-card-h">Bagging, Pasting & OOB</div>
            <ul className="m4-bullets">
              <li><strong>Bagging</strong> = bootstrap (sample <em>with</em> replacement); <strong>Pasting</strong> = without replacement.</li>
              <li>Aggregate: mode (classification) / average (regression) → similar bias, <strong>lower variance</strong>.</li>
              <li><strong>OOB</strong>: ~⅔ sampled per predictor, ~⅓ left out → free validation set (<code>oob_score_</code>).</li>
              <li><strong>Random Patches</strong> (sample rows + cols) vs <strong>Random Subspaces</strong> (all rows, sample cols).</li>
            </ul>
          </div>
        </div>
        <div className="m4-two-col">
          <div className="m4-card">
            <div className="m4-card-h">Random Forests & Extra-Trees</div>
            <ul className="m4-bullets">
              <li><strong>RF</strong> = bagged trees + at each split search a <strong>random subset of features</strong> (≈ √n) → extra diversity.</li>
              <li><strong>Extra-Trees</strong>: also use <strong>random thresholds</strong> → more bias, less variance, faster.</li>
              <li><strong>Feature importance</strong> = average (weighted) impurity decrease across all nodes splitting on that feature; normalised to sum 1.</li>
            </ul>
            <ExRemember color="#f472b6" label="★ vs plain Bagging">Bagging with <code>max_features</code> fixes the same features per <em>tree</em>; RF resamples features at <strong>every node split</strong>.</ExRemember>
          </div>
          <div className="m4-card">
            <div className="m4-card-h">Boosting — sequential, fixes predecessor</div>
            <ExF label="AdaBoost — weighted error & predictor weight" src="r_j = \!\!\sum_{\hat{y}_j^{(i)}\neq y^{(i)}}\!\! w^{(i)},\qquad \alpha_j = \eta\,\log\frac{1 - r_j}{r_j}" color="#fb7185" note="Boost misclassified weights ×exp(αⱼ), renormalise. Decision stump = max_depth 1." />
            <div style={{ fontSize: '0.77rem', color: 'var(--text-1)', lineHeight: 1.55 }}><strong>Gradient Boosting (GBRT):</strong> fit each new tree to the <em>residuals</em>. Use small <code>learning_rate</code> (shrinkage) + many trees + early stopping (<code>n_iter_no_change</code>). Classification uses log loss.</div>
            <ExRemember color="#fbbf24" label="★ Bagging vs Boosting">Bagging = <strong>parallel</strong>, reduces <strong>variance</strong>. Boosting = <strong>sequential</strong>, reduces <strong>bias</strong> (can't parallelise across machines).</ExRemember>
          </div>
        </div>
        <div className="m4-card">
          <div className="m4-card-h">Stacking & Method Summary</div>
          <div style={{ fontSize: '0.77rem', color: 'var(--text-1)', lineHeight: 1.55, marginBottom: '0.5rem' }}><strong>Stacking</strong>: train a <strong>blender</strong> on the base models' <em>out-of-fold</em> predictions (instead of hard voting), then retrain bases on the full set.</div>
          <div style={{ overflowX: 'auto' }}>
            <table className="m4-ptable" style={{ minWidth: 600 }}>
              <thead><tr><th>Method</th><th>Diversity source</th><th>Training</th><th>Effect</th></tr></thead>
              <tbody>
                <tr><td className="pk">Voting</td><td>Different algorithms</td><td>Parallel</td><td>Combine diverse models</td></tr>
                <tr><td className="pk">Bagging / Pasting</td><td>Data subsets</td><td>Parallel</td><td>↓ variance</td></tr>
                <tr><td className="pk">Random Forest</td><td>Bootstrap + √n features/split</td><td>Parallel</td><td>↓ variance, robust</td></tr>
                <tr><td className="pk">Extra-Trees</td><td>RF + random thresholds</td><td>Parallel</td><td>Faster, more bias</td></tr>
                <tr><td className="pk">AdaBoost</td><td>Reweight misclassified</td><td>Sequential</td><td>↓ bias</td></tr>
                <tr><td className="pk">Gradient Boosting</td><td>Fit residuals (trees only)</td><td>Sequential</td><td>↓ bias, strong</td></tr>
                <tr><td className="pk">Stacking</td><td>Learned blender</td><td>Base ∥ + blender</td><td>Learns best combo</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </ExLec>

      {/* ════════════════════ LECTURE 8 ════════════════════ */}
      <ExLec lec={EXAM_LECTURES[7]} onOpen={onOpen} onCheat={setCheatCode}>
        <div className="m4-two-col">
          <div className="m4-card">
            <div className="m4-card-h">Curse of Dimensionality & Approaches</div>
            <ul className="m4-bullets">
              <li>Thousands of features → slow training, sparse data, hard to find good solutions.</li>
              <li>DR always <strong>loses information</strong> but speeds training & enables 2D/3D visualisation.</li>
              <li><strong>Feature selection</strong> (drop features, e.g. MNIST borders) is <em>supervised</em>; the DR here is <em>unsupervised</em>.</li>
            </ul>
            <ExVS items={[
              { title: 'Projection', color: '#22d3ee', points: ['Data near a low-dim subspace', 'Project onto it (z₁,z₂)', 'Fails on twisted manifolds'] },
              { title: 'Manifold Learning', color: '#a78bfa', points: ['Unroll a curved manifold', 'Swiss roll (d=2 in n=3)', 'Assumes simpler in low-dim'] },
            ]} />
          </div>
          <div className="m4-card">
            <div className="m4-card-h">PCA — maximise preserved variance</div>
            <ExF label="SVD of centred data" src="X = U\,\Sigma\,V^\top" color="#2dd4bf" note="Columns of V = principal axes (1st = max variance, each next ⟂ & next-largest). Sign not unique." />
            <ExF label="Project to d dims (Wd = first d cols of V)" src="X_{d\text{-proj}} = X\,W_d" color="#2dd4bf" />
            <ExF label="Reconstruct (→ reconstruction error)" src="X_\text{recovered} = X_{d\text{-proj}}\,W_d^\top" color="#2dd4bf" />
            <ExRemember color="#2dd4bf">Must <strong>centre</strong> data first. np.linalg.svd returns Vᵀ.</ExRemember>
          </div>
        </div>
        <div className="m4-two-col">
          <div className="m4-card">
            <div className="m4-card-h">Choosing d, Compression & Variants</div>
            <ExF label="Keep 95% of variance" src="d = \arg\max\big(\text{cumsum}(\text{EVR}) \ge 0.95\big) + 1" color="#2dd4bf" note="One-liner: PCA(n_components=0.95). Or look for the elbow in the cumulative-variance curve." />
            <ul className="m4-bullets">
              <li>MNIST: 95% variance → 784 → <strong>154</strong> dims.</li>
              <li><strong>Randomized PCA</strong>: O(md²)+O(d³) ≪ O(mn²)+O(n³) when d ≪ n.</li>
              <li><strong>Incremental PCA</strong>: mini-batches → online / out-of-memory.</li>
              <li>Normalise features with different units; correlated features → fine to scale.</li>
            </ul>
          </div>
          <div className="m4-card">
            <div className="m4-card-h">Kernel PCA & Other Techniques</div>
            <div style={{ fontSize: '0.77rem', color: 'var(--text-1)', lineHeight: 1.55, marginBottom: '0.4rem' }}><strong>Kernel PCA</strong> = kernel trick + PCA → <em>nonlinear</em> projection (separates concentric circles; RBF/linear/sigmoid on Swiss roll).</div>
            <table className="m4-ptable">
              <tbody>
                <tr><td className="pk">LLE</td><td>Manifold learning, no projection</td></tr>
                <tr><td className="pk">MDS</td><td>Preserves pairwise distances</td></tr>
                <tr><td className="pk">Isomap</td><td>k-NN graph; preserves geodesic distances</td></tr>
                <tr><td className="pk">t-SNE</td><td>Keeps similar close / dissimilar far — visualisation (MNIST → 2D clusters)</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </ExLec>

      {/* ════════════════════ LECTURE 9 ════════════════════ */}
      <ExLec lec={EXAM_LECTURES[8]} onOpen={onOpen} onCheat={setCheatCode}>
        <div className="m4-two-col">
          <div className="m4-card">
            <div className="m4-card-h">k-Means Clustering</div>
            <div style={{ fontSize: '0.76rem', color: 'var(--text-2)', lineHeight: 1.5, marginBottom: '0.5rem' }}><strong style={{ color: 'var(--text-1)' }}>Clustering uses:</strong> fraud / defective-product detection, recommender systems, image segmentation & retrieval, anomaly detection, semi-supervised learning. Clustering is unsupervised (no labels); centroid-based (k-means) vs density-based (DBSCAN).</div>
            <ul className="m4-bullets">
              <li>Loop: <strong>assign</strong> each point to nearest centroid → <strong>update</strong> centroids to cluster mean → repeat.</li>
              <li><strong>Convergence guaranteed</strong>: inertia decreases monotonically, bounded below by 0.</li>
              <li>Hard clustering = <code>labels_</code>; soft = <code>transform()</code> (distance to every centroid).</li>
            </ul>
            <ExF label="Inertia (minimise)" src="\text{inertia} = \sum_{i=1}^{m}\lVert x_i - c_{\text{closest}(i)}\rVert^2" color="#c084fc" note="kmeans.score = −inertia. Voronoi diagram shows the decision cells." />
          </div>
          <div className="m4-card">
            <div className="m4-card-h">3 Drawbacks → Remedies</div>
            <div style={{ fontSize: '0.77rem', color: 'var(--text-1)', lineHeight: 1.55 }}><strong>1. Init sensitivity</strong> → run <code>n_init</code> times, keep lowest inertia, or use <strong>k-means++</strong>:</div>
            <ExF label="k-means++ pick-next probability" src="P(x_i) = \frac{D(x_i)^2}{\sum_j D(x_j)^2}" color="#c084fc" note="Favours points far from existing centroids." />
            <div style={{ fontSize: '0.77rem', color: 'var(--text-1)', lineHeight: 1.55 }}><strong>2. Choosing k</strong> → elbow (often misleading) or, better, the silhouette:</div>
            <ExF label="Silhouette coefficient ∈ [−1, 1]" src="s_i = \frac{b - a}{\max(a, b)}" color="#c084fc" note="a = mean intra-cluster dist; b = mean dist to nearest other cluster. Higher = better." />
            <div style={{ fontSize: '0.77rem', color: 'var(--text-1)', lineHeight: 1.55 }}><strong>3. Shape</strong> (varying size/density/non-spherical) → use a <strong>Gaussian Mixture Model</strong>.</div>
          </div>
        </div>
        <div className="m4-two-col">
          <div className="m4-card">
            <div className="m4-card-h">Clustering for Semi-Supervised Learning</div>
            <table className="m4-ptable">
              <thead><tr><th>Approach (digits)</th><th>Test acc</th></tr></thead>
              <tbody>
                <tr><td>50 random labels</td><td>74.8%</td></tr>
                <tr><td>50 cluster-representative labels</td><td>84.9%</td></tr>
                <tr><td>Full label propagation</td><td>89.4%</td></tr>
                <tr><td className="pk">Partial propagation (drop 1% outliers)</td><td>90.9%</td></tr>
                <tr><td>Full ground-truth (1400 labels)</td><td>90.7%</td></tr>
              </tbody>
            </table>
            <ExRemember color="#c084fc">Label cluster <strong>representatives</strong>, then <strong>propagate</strong> within clusters. Partial propagation even beats training on all true labels.</ExRemember>
          </div>
          <div className="m4-card">
            <div className="m4-card-h">DBSCAN — density-based</div>
            <ul className="m4-bullets">
              <li>Two params: <strong>ε</strong> (radius) & <strong>min_samples</strong>.</li>
              <li><strong>Core</strong> (≥ min_samples in ε) · <strong>Border</strong> (in a core's ε) · <strong>Noise/anomaly</strong> (label −1).</li>
              <li>Chains of cores → one cluster of <strong>any shape</strong>; bigger ε → fewer anomalies (84→0).</li>
              <li><strong>No predict()</strong> → train k-NN on <code>components_</code>; threshold distance for anomalies.</li>
            </ul>
            <ExRemember color="#fb7185" label="★ Pros / Cons">+ Any shape, auto #clusters, built-in anomalies, only 2 params. − Struggles with varying density; O(m²n) → doesn't scale to huge data.</ExRemember>
          </div>
        </div>
      </ExLec>

      {/* ── EXAM-DAY RAPID RECALL ─────────────────────────────────────────── */}
      <section id="ex-recall" style={{ scrollMarginTop: '120px', marginBottom: '1rem' }}>
        <div className="m4-card" style={{ borderColor: 'rgba(251,191,36,0.35)' }}>
          <div className="m4-card-h" style={{ color: 'var(--amber)' }}>⚡ Exam-Day Rapid Recall — the confusions that lose marks</div>
          <div style={{ overflowX: 'auto' }}>
            <table className="m4-ptable" style={{ minWidth: 640 }}>
              <thead><tr><th>Pair</th><th>One-line discriminator</th></tr></thead>
              <tbody>
                <tr><td className="pk">Precision vs Recall</td><td>Precision = TP/(TP+FP) "of predicted +"; Recall = TP/(TP+FN) "of actual +"</td></tr>
                <tr><td className="pk">Bias vs Variance</td><td>High bias = underfit (too simple); high variance = overfit (too sensitive)</td></tr>
                <tr><td className="pk">Lasso vs Ridge</td><td>ℓ1 zeroes coefficients (selection); ℓ2 only shrinks</td></tr>
                <tr><td className="pk">Small vs Large C</td><td>Small C = wide street/more violations; large C = narrow/overfit</td></tr>
                <tr><td className="pk">Bagging vs Boosting</td><td>Bagging ∥ ↓variance; Boosting sequential ↓bias</td></tr>
                <tr><td className="pk">Gini vs Entropy</td><td>Both 0 when pure; Gini faster, near-identical trees</td></tr>
                <tr><td className="pk">Manhattan vs Euclidean</td><td>Minkowski p=1 vs p=2</td></tr>
                <tr><td className="pk">Elbow vs Silhouette</td><td>Inertia falls forever (elbow); silhouette ∈[−1,1] is maximised</td></tr>
                <tr><td className="pk">k-means vs DBSCAN</td><td>Centroid/spherical/need k vs density/any-shape/auto-k + noise</td></tr>
                <tr><td className="pk">Instance vs Model-based</td><td>k-NN memorises; others build a model</td></tr>
              </tbody>
            </table>
          </div>
          <ExRemember color="#34d399" label="✓ Formulas to know cold">
            sgn(wᵀx) · MSE/MAE · precision/recall/F₁ · θ̂ = (XᵀX)⁻¹Xᵀy · GD step θ − η∇MSE · σ(t)=1/(1+e⁻ᵗ) + log loss · Ridge αΣθ² / Lasso αΣ|θ| · softmax · Minkowski · ½wᵀw + CΣζ (hinge) · Gini 1−Σp² / Entropy −Σp·log₂p · AdaBoost α=η·log((1−r)/r) · PCA X=UΣVᵀ · inertia · silhouette (b−a)/max(a,b).
          </ExRemember>
        </div>
      </section>

      {cheatCode && <CheatsheetModal code={cheatCode} onClose={() => setCheatCode(null)} />}
    </div>
  );
}

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
  const [l7Tab, setL7Tab] = useState('Ensemble Basics');
  const [l8Tab, setL8Tab] = useState('Curse of Dimensionality');
  const [l9Tab, setL9Tab] = useState('Introduction');

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
                From Mitchell's formal definition of learning through regression, regularisation, kNN, SVMs, decision trees, ensemble methods, dimensionality reduction, and clustering — covering all core concepts with interactive visualisations.
                This module covers Lectures 1–9.
              </p>
            </div>
            <div
              onClick={() => setTab('Exam Summary')}
              style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', margin: '0 0 1.5rem', padding: '1.1rem 1.3rem', borderRadius: 10, background: 'linear-gradient(135deg, rgba(52,211,153,0.16) 0%, rgba(34,211,238,0.07) 55%, rgba(167,139,250,0.06) 100%)', border: '1px solid rgba(52,211,153,0.4)' }}
            >
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1.4rem', fontWeight: 700, color: 'var(--emerald)', flexShrink: 0 }}>★</span>
              <div style={{ flex: 1, minWidth: 220 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--emerald)', marginBottom: '0.25rem' }}>// Revise in one pass</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-0)' }}>Exam Summary — every topic, formula &amp; algorithm</div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-2)', marginTop: '0.2rem' }}>A colour-coded, memorisation-first cheat-sheet across all nine lectures.</div>
              </div>
              <span className="m4-btn m4-btn-g" style={{ flexShrink: 0 }}>Open Exam Summary →</span>
            </div>
            <div
              onClick={() => setTab('Code Lab')}
              style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', margin: '0 0 1.5rem', padding: '1.1rem 1.3rem', borderRadius: 10, background: 'linear-gradient(135deg, rgba(167,139,250,0.16) 0%, rgba(34,211,238,0.07) 55%, rgba(244,114,182,0.06) 100%)', border: '1px solid rgba(167,139,250,0.4)' }}
            >
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1.3rem', fontWeight: 700, color: 'var(--violet)', flexShrink: 0 }}>{'</>'}</span>
              <div style={{ flex: 1, minWidth: 220 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--violet)', marginBottom: '0.25rem' }}>// Learn the implementation</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-0)' }}>Code Lab — every key snippet, five ways to practise</div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-2)', marginTop: '0.2rem' }}>Annotated walkthroughs, fill-in-the-blank, reorder, recall &amp; predict-the-output — in a real editor.</div>
              </div>
              <span className="m4-btn" style={{ flexShrink: 0, borderColor: 'var(--violet)', color: 'var(--violet)' }}>Open Code Lab →</span>
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
                { code: 'L7', title: 'Ensembles & Voting', color: 'var(--cyan)', desc: 'Wisdom of the crowd. Hard vs soft voting. Interactive binomial visualiser and 3-classifier voting demo.', go: 'Ensembles', sub: 'Ensemble Basics' },
                { code: 'L7', title: 'Bagging, Pasting & OOB', color: 'var(--violet)', desc: 'Bootstrap aggregating, sampling with/without replacement, ~36.8% out-of-bag instances as a free validation set. Interactive resampler.', go: 'Ensembles', sub: 'Bagging & OOB' },
                { code: 'L7', title: 'Random Forests & Extra-Trees', color: 'var(--emerald)', desc: 'RF = bagging + per-split feature randomisation (√n). Extra-Trees use random thresholds. Feature importance via mean impurity decrease.', go: 'Ensembles', sub: 'Random Forests' },
                { code: 'L7', title: 'AdaBoost & Gradient Boosting', color: 'var(--rose)', desc: 'Sequential boosting. AdaBoost α(r) calculator. Live GBRT residual-fitting visualisation on noisy y = 3x² data.', go: 'Ensembles', sub: 'Boosting' },
                { code: 'L7', title: 'Stacking & Method Matcher', color: 'var(--amber)', desc: 'Learn the blender from out-of-fold predictions. Summary table of all ensemble methods. Interactive scenario→method quiz.', go: 'Ensembles', sub: 'Stacking & Summary' },
                { code: 'L8', title: 'Curse of Dimensionality', color: 'var(--violet)', desc: 'Why thousands of features hurt: sparsity, boundary crowding, and exploding sample needs. Feature selection (supervised) vs unsupervised DR. Interactive dimension explorer.', go: 'Dimensionality Reduction', sub: 'Curse of Dimensionality' },
                { code: 'L8', title: 'PCA & SVD', color: 'var(--cyan)', desc: 'Max-variance linear projection. Principal axes via SVD, the projection matrix Wd, explained variance ratio. Rotate the axis to maximise variance interactively.', go: 'Dimensionality Reduction', sub: 'PCA' },
                { code: 'L8', title: 'Kernel PCA & Manifolds', color: 'var(--emerald)', desc: 'Nonlinear projection via the kernel trick on concentric circles; Swiss-roll manifold unrolling; LLE, MDS, Isomap and t-SNE on MNIST.', go: 'Dimensionality Reduction', sub: 'Kernel PCA' },
                { code: 'L9', title: 'K-Means Clustering', color: 'var(--amber)', desc: 'Centroid-based clustering. Step through assign → update with live inertia and Voronoi cells. Hard vs soft clustering, convergence guarantee.', go: 'Clustering', sub: 'K-Means Algorithm' },
                { code: 'L9', title: 'Choosing k & Silhouette', color: 'var(--rose)', desc: 'Init sensitivity and k-means++, the elbow method vs the silhouette score, and the spherical-shape limitation (remedy: GMM). Interactive k explorer.', go: 'Clustering', sub: 'Drawbacks & Remedies' },
                { code: 'L9', title: 'DBSCAN & Semi-Supervised', color: 'var(--cyan)', desc: 'Density-based clustering: core/border/anomaly points and arbitrary shapes via an eps & min_samples explorer. Clustering for semi-supervised learning on digits.', go: 'Clustering', sub: 'DBSCAN' },
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
                      else if (item.go === 'Ensembles') setL7Tab(item.sub);
                      else if (item.go === 'Dimensionality Reduction') setL8Tab(item.sub);
                      else if (item.go === 'Clustering') setL9Tab(item.sub);
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

        {/* ── EXAM SUMMARY ── */}
        {tab === 'Exam Summary' && <ExamSummary onOpen={setTab} />}

        {/* ── CODE LAB ── */}
        {tab === 'Code Lab' && <CodeLab onOpen={setTab} />}

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

        {/* ── ENSEMBLES (L7) ── */}
        {tab === 'Ensembles' && (
          <div>
            <div className="m4-sec-hdr">
              <h2 className="m4-sec-title">Ensemble Learning &amp; Random Forests <span className="m4-badge" style={{ background: 'rgba(34,211,238,0.12)', color: 'var(--cyan)', border: '1px solid rgba(34,211,238,0.3)' }}>Lecture 7</span></h2>
              <p className="m4-sec-sub">"Wisdom of the crowd" applied to ML: combine many predictors to get one stronger model. From simple voting through bagging, random forests, boosting, and stacking — the foundation of nearly every winning Kaggle submission.</p>
            </div>
            <div className="m4-labtabs">
              {L7_TABS.map(lt => (
                <button key={lt} className={`m4-labtab ${l7Tab === lt ? 'm4-labtab--on' : ''}`} onClick={() => setL7Tab(lt)}>{lt}</button>
              ))}
            </div>

            {/* ── Ensemble Basics ── */}
            {l7Tab === 'Ensemble Basics' && (
              <div>
                <p className="m4-sec-sub">An <em>ensemble</em> is a group of predictors whose predictions are aggregated (vote, average, or learned blender). Why does aggregating weak predictors beat a single strong one? Because of the wisdom of the crowd.</p>
                <div className="m4-two-col">
                  <div className="m4-card">
                    <div className="m4-card-h">Core Concept</div>
                    <ul className="m4-bullets">
                      <li><strong>Wisdom of the crowd:</strong> aggregating many predictions often beats a single expert.</li>
                      <li>An <strong>ensemble</strong> = group of predictors (classifiers or regressors).</li>
                      <li>An <strong>ensemble method</strong> combines their predictions into a single, typically stronger model.</li>
                      <li>Canonical example: a <strong>Random Forest</strong> = ensemble of Decision Trees, each trained on a different random subset; majority vote = the ensemble's prediction.</li>
                    </ul>
                    <div className="m4-hr" />
                    <div className="m4-flabel">Bias / Variance Background</div>
                    <table className="m4-ptable">
                      <tbody>
                        <tr><td className="pk">Training error</td><td>Average error on training data</td></tr>
                        <tr><td className="pk">Test error</td><td>Average error on unseen test data</td></tr>
                        <tr><td className="pk">Goal</td><td>Low test error AND low variance</td></tr>
                        <tr><td className="pk">Decision Trees</td><td>High variance (different splits → very different trees) — perfect candidate for variance-reduction ensembles</td></tr>
                      </tbody>
                    </table>
                    <div className="m4-infobox" style={{ marginTop: '0.65rem', fontSize: '0.74rem' }}>
                      Bagging and Random Forests are <strong>variance-reduction</strong> ensembles. Boosting is a <strong>bias-reduction</strong> ensemble. Stacking is a <strong>learned aggregation</strong>.
                    </div>
                  </div>
                  <EnsembleProbViz />
                </div>

                <div className="m4-two-col">
                  <div className="m4-card">
                    <div className="m4-card-h">Hard Voting</div>
                    <ul className="m4-bullets">
                      <li>Each classifier outputs a discrete label; the ensemble predicts the <strong>majority class</strong>.</li>
                      <li>Even if each classifier is a <strong>weak learner</strong>, the ensemble can be a <strong>strong learner</strong> when:</li>
                      <li style={{ marginLeft: '1.2rem' }}>1. There are enough classifiers, AND</li>
                      <li style={{ marginLeft: '1.2rem' }}>2. They are sufficiently <strong>diverse</strong> (independent — make different errors).</li>
                      <li>One way to achieve diversity: train using <em>very different</em> algorithms (LogReg + RF + SVC).</li>
                    </ul>
                    <div className="m4-hr" />
                    <div className="m4-flabel">Example results — moons dataset</div>
                    <table className="m4-ptable">
                      <thead><tr><th>Classifier</th><th>Accuracy</th></tr></thead>
                      <tbody>
                        <tr><td>LogisticRegression</td><td>0.864</td></tr>
                        <tr><td>RandomForestClassifier</td><td>0.896</td></tr>
                        <tr><td>SVC</td><td>0.896</td></tr>
                        <tr><td className="pk">Hard-voting ensemble</td><td className="pk">0.912</td></tr>
                        <tr><td className="pk">Soft-voting ensemble</td><td className="pk">0.920</td></tr>
                      </tbody>
                    </table>
                  </div>
                  <div className="m4-card">
                    <div className="m4-card-h">Soft Voting</div>
                    <ul className="m4-bullets">
                      <li>Each classifier outputs class <strong>probabilities</strong> via <code>predict_proba()</code>.</li>
                      <li>The ensemble averages the probabilities and picks the class with the highest <strong>average probability</strong>.</li>
                      <li>Often outperforms hard voting because <strong>high-confidence votes are weighted more</strong>.</li>
                      <li>Requires every base classifier to expose calibrated probabilities (set <code>probability=True</code> for SVC).</li>
                    </ul>
                    <div className="m4-hr" />
                    <div className="m4-flabel">Implementation — scikit-learn</div>
                    <div className="m4-pseudocode">
                      <span className="kw">from</span> sklearn.ensemble <span className="kw">import</span> VotingClassifier{'\n'}
                      <span className="kw">from</span> sklearn.linear_model <span className="kw">import</span> LogisticRegression{'\n'}
                      <span className="kw">from</span> sklearn.svm <span className="kw">import</span> SVC{'\n'}
                      {'\n'}
                      voting_clf = VotingClassifier({'\n'}
                      {'    '}estimators=[{'\n'}
                      {'        '}(<span className="cm">'lr'</span>,  LogisticRegression()),{'\n'}
                      {'        '}(<span className="cm">'rf'</span>,  RandomForestClassifier()),{'\n'}
                      {'        '}(<span className="cm">'svc'</span>, SVC(probability=<span className="kw">True</span>))]){'\n'}
                      {'\n'}
                      voting_clf.voting = <span className="cm">"soft"</span>   <span className="cm"># swap to soft</span>{'\n'}
                      voting_clf.fit(X_train, y_train)
                    </div>
                  </div>
                </div>

                <VotingClassifierDemo />
              </div>
            )}

            {/* ── Bagging & OOB ── */}
            {l7Tab === 'Bagging & OOB' && (
              <div>
                <p className="m4-sec-sub">Same algorithm trained on <strong>different random subsets</strong> of the training set, then aggregated. Bootstrap aggregating (bagging) and pasting differ only in whether sampling is with or without replacement.</p>
                <div className="m4-two-col">
                  <div className="m4-card">
                    <div className="m4-card-h">Bagging vs Pasting</div>
                    <table className="m4-ptable">
                      <thead><tr><th>Method</th><th>Sampling</th><th>Settings</th></tr></thead>
                      <tbody>
                        <tr><td className="pk">Bagging</td><td>With replacement (bootstrap)</td><td><code>bootstrap=True</code> (default)</td></tr>
                        <tr><td className="pk">Pasting</td><td>Without replacement</td><td><code>bootstrap=False</code></td></tr>
                      </tbody>
                    </table>
                    <div className="m4-hr" />
                    <div className="m4-flabel">Bootstrapping procedure (per predictor)</div>
                    <ol style={{ paddingLeft: '1.2rem', fontSize: '0.77rem', color: 'var(--text-1)', lineHeight: 1.7 }}>
                      <li>Randomly select <Tex src="m" /> observations <strong>with replacement</strong> from the training set (m = training-set size).</li>
                      <li>Fit the model on this bootstrap sample.</li>
                      <li>Repeat <Tex src="B" /> times (one bootstrap sample per predictor).</li>
                      <li>Aggregate the predictions of all <Tex src="B" /> predictors.</li>
                    </ol>
                    <div className="m4-flabel" style={{ marginTop: '0.6rem' }}>Aggregation function</div>
                    <table className="m4-ptable">
                      <tbody>
                        <tr><td className="pk">Classification</td><td>Statistical mode (majority vote)</td></tr>
                        <tr><td className="pk">Regression</td><td>Average of all B predictions</td></tr>
                      </tbody>
                    </table>
                    <div className="m4-infobox" style={{ marginTop: '0.6rem', fontSize: '0.75rem' }}>
                      <strong>Net effect:</strong> the ensemble has similar (or lower) bias but <strong>much lower variance</strong> than a single predictor trained on the full set. This is exactly why bagged deep trees are powerful — deep trees are low-bias, high-variance; averaging averages out the variance.
                    </div>
                  </div>
                  <div className="m4-card">
                    <div className="m4-card-h">Bagged Decision Trees + Implementation</div>
                    <div className="m4-flabel">Bagged DT procedure</div>
                    <ol style={{ paddingLeft: '1.2rem', fontSize: '0.76rem', color: 'var(--text-1)', lineHeight: 1.7 }}>
                      <li>Create <Tex src="B" /> bootstrapped training sets.</li>
                      <li>Fit a deep, <strong>unpruned</strong> tree on each (high variance, low bias).</li>
                      <li>For each test instance, get predictions from all <Tex src="B" /> trees.</li>
                      <li>Aggregate (mean for regression, mode for classification).</li>
                    </ol>
                    <div className="m4-hr" />
                    <div className="m4-flabel">Implementation</div>
                    <div className="m4-pseudocode">
                      <span className="kw">from</span> sklearn.ensemble <span className="kw">import</span> BaggingClassifier{'\n'}
                      <span className="kw">from</span> sklearn.tree <span className="kw">import</span> DecisionTreeClassifier{'\n'}
                      {'\n'}
                      bag_clf = BaggingClassifier({'\n'}
                      {'    '}DecisionTreeClassifier(),{'\n'}
                      {'    '}n_estimators=<span className="num">500</span>,{'\n'}
                      {'    '}max_samples=<span className="num">100</span>,{'\n'}
                      {'    '}n_jobs=-<span className="num">1</span>,{'\n'}
                      {'    '}random_state=<span className="num">42</span>){'\n'}
                      bag_clf.fit(X_train, y_train)
                    </div>
                    <div className="m4-infobox" style={{ marginTop: '0.6rem', fontSize: '0.74rem' }}>
                      BaggingClassifier auto-applies <strong>soft voting</strong> when the base classifier supports <code>predict_proba()</code> — no extra config needed.
                    </div>
                  </div>
                </div>

                <BootstrapVisualizer />

                <div className="m4-two-col">
                  <div className="m4-card">
                    <div className="m4-card-h">Out-of-Bag (OOB) Evaluation</div>
                    <ul className="m4-bullets">
                      <li>With bootstrapping, on average ≈ <strong>2/3</strong> of training instances appear in each bag; the remaining ≈ <strong>1/3</strong> are <strong>OOB instances</strong> for that predictor.</li>
                      <li>Different OOB sets per predictor (each bootstrap leaves out different points).</li>
                      <li>For each instance, predict using only the trees for which it was OOB → average / vote → single OOB prediction.</li>
                      <li>Aggregate over all <Tex src="m" /> instances → <strong>OOB MSE</strong> or <strong>OOB classification error</strong> (a free validation set).</li>
                    </ul>
                    <div className="m4-hr" />
                    <div className="m4-flabel">Implementation</div>
                    <div className="m4-pseudocode">
                      bag_clf = BaggingClassifier({'\n'}
                      {'    '}DecisionTreeClassifier(),{'\n'}
                      {'    '}n_estimators=<span className="num">500</span>,{'\n'}
                      {'    '}<span className="kw">oob_score</span>=<span className="kw">True</span>,{'\n'}
                      {'    '}n_jobs=-<span className="num">1</span>, random_state=<span className="num">42</span>){'\n'}
                      bag_clf.fit(X_train, y_train){'\n'}
                      {'\n'}
                      bag_clf.oob_score_                  <span className="cm"># 0.896</span>{'\n'}
                      bag_clf.oob_decision_function_[:<span className="num">3</span>]  <span className="cm"># OOB probas</span>
                    </div>
                  </div>
                  <div className="m4-card">
                    <div className="m4-card-h">Random Patches &amp; Random Subspaces</div>
                    <div className="m4-infobox" style={{ marginBottom: '0.6rem', fontSize: '0.76rem' }}>
                      <code>BaggingClassifier</code> also supports <strong>feature sampling</strong> via <code>max_features</code> and <code>bootstrap_features</code> — useful for high-dimensional data such as images.
                    </div>
                    <table className="m4-ptable">
                      <thead><tr><th>Method</th><th>Sample Instances</th><th>Sample Features</th></tr></thead>
                      <tbody>
                        <tr>
                          <td className="pk">Random Patches</td>
                          <td>Yes</td>
                          <td>Yes</td>
                        </tr>
                        <tr>
                          <td className="pk">Random Subspaces</td>
                          <td>No (use all)</td>
                          <td>Yes</td>
                        </tr>
                      </tbody>
                    </table>
                    <div className="m4-flabel" style={{ marginTop: '0.5rem' }}>Settings</div>
                    <div style={{ background: 'var(--bg-3)', borderRadius: 6, padding: '0.5rem 0.65rem', fontFamily: 'monospace', fontSize: '0.66rem', color: 'var(--text-2)', lineHeight: 1.65 }}>
                      {'Random Patches:  bootstrap=True,  max_samples<1.0,\n                 bootstrap_features=True, max_features<1.0\n\nRandom Subspaces: bootstrap=False, max_samples=1.0,\n                 bootstrap_features=True, max_features<1.0'}
                    </div>
                    <div className="m4-warnbox" style={{ marginTop: '0.6rem', fontSize: '0.73rem' }}>
                      <strong>Important:</strong> in a <code>BaggingClassifier</code>, each base estimator only sees the features assigned to it during training. The bagging classifier stores <code>estimators_features_</code> and routes the same features at inference.
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── Random Forests ── */}
            {l7Tab === 'Random Forests' && (
              <div>
                <p className="m4-sec-sub">A <strong>Random Forest</strong> = ensemble of Decision Trees trained via bagging, with one extra layer of randomness: at each node split, only a random <strong>subset</strong> of features is considered.</p>
                <div className="m4-two-col">
                  <div className="m4-card">
                    <div className="m4-card-h">Random Forest — Key Distinction</div>
                    <div className="m4-infobox" style={{ marginBottom: '0.6rem', fontSize: '0.78rem' }}>
                      When splitting a node, an RF searches for the best feature among a <strong>random subset of features</strong> (default = <Tex src="\sqrt{n}" /> for classification), introducing extra randomness on top of bagging.
                    </div>
                    <div className="m4-flabel">Implementation</div>
                    <div className="m4-pseudocode">
                      <span className="kw">from</span> sklearn.ensemble <span className="kw">import</span> RandomForestClassifier{'\n'}
                      {'\n'}
                      RF_clf = RandomForestClassifier({'\n'}
                      {'    '}n_estimators=<span className="num">5</span>,{'\n'}
                      {'    '}max_features=<span className="num">2</span>,{'\n'}
                      {'    '}max_depth=<span className="num">4</span>,{'\n'}
                      {'    '}n_jobs=-<span className="num">1</span>, random_state=<span className="num">42</span>){'\n'}
                      RF_clf.fit(iris.data, iris.target){'\n'}
                      {'\n'}
                      <span className="cm"># inspect bootstrap samples for tree 0</span>{'\n'}
                      tree0 = RF_clf.estimators_samples_[<span className="num">0</span>]{'\n'}
                      len(tree0)            <span className="cm"># 150 (with bootstrapping)</span>{'\n'}
                      len(np.unique(tree0)) <span className="cm"># ~101 unique (≈ 2/3 of m)</span>
                    </div>
                    <div className="m4-warnbox" style={{ marginTop: '0.6rem', fontSize: '0.74rem' }}>
                      <strong>Compared to BaggingClassifier(max_features=2):</strong> Bagging fixes the same 2 features <em>per tree</em>. RandomForest resamples 2 features <em>at every node split</em> — much greater tree diversity.
                    </div>
                  </div>
                  <div className="m4-card">
                    <div className="m4-card-h">Extra-Trees (Extremely Randomised)</div>
                    <ul className="m4-bullets">
                      <li>Like RF, but uses <strong>random thresholds</strong> for each candidate feature when splitting (instead of searching for the optimal threshold).</li>
                      <li>More bias, less variance, <strong>much faster</strong> to train than a regular RF.</li>
                      <li>Classes: <code>ExtraTreesClassifier</code>, <code>ExtraTreesRegressor</code>.</li>
                    </ul>
                    <div className="m4-hr" />
                    <div className="m4-flabel">Diversity Sources Compared</div>
                    <table className="m4-ptable">
                      <thead><tr><th>Method</th><th>Sample rows</th><th>Sample features</th><th>Threshold</th></tr></thead>
                      <tbody>
                        <tr><td>Bagging(DT)</td><td>Bootstrap</td><td>Per-tree</td><td className="pk">Optimal</td></tr>
                        <tr><td>Random Forest</td><td>Bootstrap</td><td className="pk">Per-split</td><td className="pk">Optimal</td></tr>
                        <tr><td>Extra-Trees</td><td>Bootstrap</td><td className="pk">Per-split</td><td className="pk">Random</td></tr>
                      </tbody>
                    </table>
                    <div className="m4-infobox" style={{ marginTop: '0.6rem', fontSize: '0.74rem' }}>
                      It's hard to know in advance whether ET will outperform RF — try both and cross-validate.
                    </div>
                  </div>
                </div>

                <div className="m4-card">
                  <div className="m4-card-h">Feature Importance</div>
                  <div className="m4-two-col">
                    <div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-1)', lineHeight: 1.6, marginBottom: '0.5rem' }}>
                        For each feature <Tex src="x_i" />, importance is the <strong>average total decrease in impurity</strong> (weighted by node sample count) across <em>all nodes in all trees</em> that split on <Tex src="x_i" />.
                      </div>
                      <table className="m4-ptable">
                        <thead><tr><th>Tree type</th><th>Impurity reduction measured by</th></tr></thead>
                        <tbody>
                          <tr><td className="pk">Classification trees</td><td>Decrease in <strong>Gini</strong> index (or entropy)</td></tr>
                          <tr><td className="pk">Regression trees</td><td>Decrease in <strong>MSE</strong></td></tr>
                        </tbody>
                      </table>
                      <div className="m4-flabel" style={{ marginTop: '0.6rem' }}>scikit-learn computation</div>
                      <ol style={{ paddingLeft: '1.2rem', fontSize: '0.75rem', color: 'var(--text-1)', lineHeight: 1.7 }}>
                        <li>Collect all nodes (across all trees) that split on <Tex src="x_i" />.</li>
                        <li>Compute impurity reduction at each, weighted by number of training instances at that node.</li>
                        <li>Average over those nodes.</li>
                        <li>Normalise so importances sum to 1.</li>
                      </ol>
                      <div className="m4-infobox" style={{ marginTop: '0.5rem', fontSize: '0.74rem' }}>
                        Access via <code>model.feature_importances_</code> after fitting.
                      </div>
                    </div>
                    <div>
                      <div className="m4-flabel">Iris example — RandomForestClassifier(n_estimators=500)</div>
                      <table className="m4-ptable">
                        <thead><tr><th>Feature</th><th>Importance</th><th>Bar</th></tr></thead>
                        <tbody>
                          {[
                            { f: 'sepal length', v: 0.11 },
                            { f: 'sepal width',  v: 0.02 },
                            { f: 'petal length', v: 0.44 },
                            { f: 'petal width',  v: 0.42 },
                          ].map(r => (
                            <tr key={r.f}>
                              <td>{r.f}</td>
                              <td className="pk">{r.v.toFixed(2)}</td>
                              <td>
                                <div style={{ height: 8, width: '100%', background: 'rgba(34,211,238,0.1)', borderRadius: 4, overflow: 'hidden' }}>
                                  <div style={{ width: `${r.v * 100 * 2}%`, height: '100%', background: 'var(--cyan)', borderRadius: 4 }} />
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div className="m4-warnbox" style={{ marginTop: '0.6rem', fontSize: '0.73rem' }}>
                        Petal length and petal width together contribute <strong>86%</strong> of the predictive power. Sepal width contributes almost nothing. Use this for feature selection — drop low-importance features for a leaner model.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── Boosting ── */}
            {l7Tab === 'Boosting' && (
              <div>
                <p className="m4-sec-sub">Train predictors <strong>sequentially</strong>, each correcting its predecessor. Combines weak learners into a strong learner. Most popular: AdaBoost (re-weights instances) and Gradient Boosting (fits residuals).</p>

                <div className="m4-two-col">
                  <div className="m4-card">
                    <div className="m4-card-h">AdaBoost — Algorithm</div>
                    <div className="m4-flabel">Weighted error rate of predictor j</div>
                    <Tex src="r_j = \sum_{\substack{i=1 \\ \hat{y}_j^{(i)} \neq y^{(i)}}}^{m} w^{(i)}" block />
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-2)', marginBottom: '0.4rem' }}>(initial weights <Tex src="w^{(i)} = 1/m" />)</div>
                    <div className="m4-flabel">Predictor weight</div>
                    <Tex src="\alpha_j = \eta \log\!\left(\frac{1 - r_j}{r_j}\right)" block />
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-2)', marginBottom: '0.4rem' }}>where <Tex src="\eta" /> is the learning rate (default 1). More accurate predictor → larger <Tex src="\alpha_j" />.</div>
                    <div className="m4-flabel">Instance weight update (boost misclassified)</div>
                    <Tex src="w^{(i)} \leftarrow \begin{cases} w^{(i)} & \text{if } \hat{y}_j^{(i)} = y^{(i)} \\ w^{(i)} \exp(\alpha_j) & \text{if } \hat{y}_j^{(i)} \neq y^{(i)} \end{cases}" block />
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-2)' }}>Then <strong>normalise</strong>: <Tex src="w^{(i)} \leftarrow w^{(i)} / \sum_i w^{(i)}" />, used by predictor j+1.</div>
                  </div>
                  <div className="m4-card">
                    <div className="m4-card-h">AdaBoost — Final Prediction (N estimators)</div>
                    <div className="m4-flabel">Regression</div>
                    <Tex src="\hat{y}(\mathbf{x}) = \frac{\sum_{j=1}^{N} \alpha_j \, \hat{y}_j(\mathbf{x})}{\sum_{j=1}^{N} \alpha_j}" block />
                    <div className="m4-flabel">Classification — weight per class k</div>
                    <Tex src="\text{weight}(k) = \sum_{\substack{j=1 \\ \hat{y}_j(\mathbf{x}) = k}}^{N} \alpha_j" block />
                    <Tex src="\hat{y}(\mathbf{x}) = \arg\max_{k} \text{weight}(k)" block />
                    <div className="m4-hr" />
                    <table className="m4-ptable">
                      <tbody>
                        <tr><td className="pk">estimator_weights_</td><td>Array of <Tex src="\alpha_j" /> values</td></tr>
                        <tr><td className="pk">estimator_errors_</td><td>Array of <Tex src="r_j" /> values</td></tr>
                        <tr><td className="pk">Decision Stump</td><td>DT with max_depth=1 — the default base estimator</td></tr>
                      </tbody>
                    </table>
                    <div className="m4-warnbox" style={{ marginTop: '0.6rem', fontSize: '0.74rem' }}>
                      <strong>Sequential</strong> nature → cannot parallelise across machines. Overfit? Reduce <code>n_estimators</code> or regularise the base estimator more.
                    </div>
                  </div>
                </div>

                <AdaBoostCalc />

                <div className="m4-card" style={{ marginTop: '0.75rem' }}>
                  <div className="m4-card-h">AdaBoost — Implementation Examples</div>
                  <div className="m4-two-col">
                    <div>
                      <div className="m4-flabel">Example 1 — SVC base estimators</div>
                      <div className="m4-pseudocode">
                        <span className="kw">from</span> sklearn.ensemble <span className="kw">import</span> AdaBoostClassifier{'\n'}
                        {'\n'}
                        ada_clf = AdaBoostClassifier({'\n'}
                        {'    '}SVC(C=<span className="num">0.2</span>, gamma=<span className="num">0.6</span>,{'\n'}
                        {'        '}probability=<span className="kw">True</span>),{'\n'}
                        {'    '}learning_rate=<span className="num">0.05</span>,{'\n'}
                        {'    '}n_estimators=<span className="num">50</span>,{'\n'}
                        {'    '}random_state=<span className="num">42</span>){'\n'}
                        ada_clf.fit(X_train, y_train){'\n'}
                        <span className="cm"># train acc = 0.933, test acc = 0.888</span>
                      </div>
                    </div>
                    <div>
                      <div className="m4-flabel">Example 2 — 30 Decision Stumps (the default)</div>
                      <div className="m4-pseudocode">
                        ada_clf = AdaBoostClassifier({'\n'}
                        {'    '}DecisionTreeClassifier(max_depth=<span className="num">1</span>),{'\n'}
                        {'    '}n_estimators=<span className="num">30</span>,{'\n'}
                        {'    '}learning_rate=<span className="num">0.5</span>,{'\n'}
                        {'    '}random_state=<span className="num">42</span>){'\n'}
                        <span className="cm"># train acc = 0.941, test acc = 0.904</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="m4-two-col" style={{ marginTop: '0.75rem' }}>
                  <div className="m4-card">
                    <div className="m4-card-h">Gradient Boosting — Concept</div>
                    <ul className="m4-bullets">
                      <li>Sequentially fit each new predictor to the <strong>residual errors</strong> of the previous ensemble (not instance weights).</li>
                      <li>With Decision Trees as base predictors → <strong>Gradient Boosted Regression Trees (GBRT)</strong>.</li>
                      <li>For classification: loss is <strong>log loss</strong> (binary cross-entropy or multiclass log loss) and the new tree fits the <em>negative gradient</em> of the loss.</li>
                    </ul>
                    <div className="m4-hr" />
                    <div className="m4-flabel">Manual GBRT construction (regression)</div>
                    <div className="m4-pseudocode">
                      <span className="cm"># y = 3x² + Gaussian noise</span>{'\n'}
                      tree_reg1 = DecisionTreeRegressor(max_depth=<span className="num">2</span>){'\n'}
                      tree_reg1.fit(X, y){'\n'}
                      {'\n'}
                      y2 = y - tree_reg1.predict(X){'\n'}
                      tree_reg2 = DecisionTreeRegressor(max_depth=<span className="num">2</span>){'\n'}
                      tree_reg2.fit(X, y2){'\n'}
                      {'\n'}
                      y3 = y2 - tree_reg2.predict(X){'\n'}
                      tree_reg3 = DecisionTreeRegressor(max_depth=<span className="num">2</span>){'\n'}
                      tree_reg3.fit(X, y3){'\n'}
                      {'\n'}
                      <span className="cm"># ensemble = sum of all tree predictions</span>{'\n'}
                      y_pred = sum(tree.predict(X_new){'\n'}
                      {'    '}<span className="kw">for</span> tree <span className="kw">in</span> (tree_reg1, tree_reg2, tree_reg3))
                    </div>
                  </div>
                  <div className="m4-card">
                    <div className="m4-card-h">GBRT — Built-in &amp; Regularisation</div>
                    <div className="m4-flabel">Built-in class</div>
                    <div className="m4-pseudocode">
                      <span className="kw">from</span> sklearn.ensemble <span className="kw">import</span> GradientBoostingRegressor{'\n'}
                      {'\n'}
                      gbrt = GradientBoostingRegressor({'\n'}
                      {'    '}max_depth=<span className="num">2</span>,{'\n'}
                      {'    '}n_estimators=<span className="num">3</span>,{'\n'}
                      {'    '}learning_rate=<span className="num">1.0</span>){'\n'}
                      gbrt.fit(X, y)
                    </div>
                    <div className="m4-flabel" style={{ marginTop: '0.6rem' }}>Shrinkage (Regularisation)</div>
                    <ul className="m4-bullets">
                      <li><strong>Low</strong> <code>learning_rate</code> (e.g. 0.05) + <strong>more trees</strong> → better generalisation.</li>
                      <li><strong>High</strong> <code>learning_rate</code> + few trees → underfitting risk.</li>
                    </ul>
                    <div className="m4-flabel" style={{ marginTop: '0.55rem' }}>Early stopping</div>
                    <div className="m4-pseudocode">
                      gbrt_best = GradientBoostingRegressor({'\n'}
                      {'    '}max_depth=<span className="num">2</span>,{'\n'}
                      {'    '}learning_rate=<span className="num">0.05</span>,{'\n'}
                      {'    '}n_estimators=<span className="num">500</span>,{'\n'}
                      {'    '}n_iter_no_change=<span className="num">10</span>){'\n'}
                      gbrt_best.fit(X, y){'\n'}
                      gbrt_best.n_estimators_   <span className="cm"># e.g. 92</span>
                    </div>
                    <div className="m4-warnbox" style={{ marginTop: '0.6rem', fontSize: '0.73rem' }}>
                      <code>n_iter_no_change</code> too low → underfit; too high → overfit. Recommended: small <code>learning_rate</code>, large <code>n_estimators</code>, with early stopping.
                    </div>
                  </div>
                </div>

                <GradientBoostStepper />

                <div className="m4-card" style={{ marginTop: '0.75rem' }}>
                  <div className="m4-card-h">Gradient Boosting for Classification</div>
                  <div style={{ fontSize: '0.77rem', color: 'var(--text-1)', lineHeight: 1.6, marginBottom: '0.5rem' }}>
                    Same idea — sequential trees fitting the negative gradient of the loss — but the loss is <strong>log loss</strong> (binary cross-entropy for binary classification; multiclass log loss for K classes) instead of MSE residuals.
                  </div>
                  <div className="m4-pseudocode">
                    <span className="kw">from</span> sklearn.ensemble <span className="kw">import</span> GradientBoostingClassifier{'\n'}
                    {'\n'}
                    gb_clf = GradientBoostingClassifier({'\n'}
                    {'    '}n_estimators=<span className="num">30</span>,{'\n'}
                    {'    '}max_depth=<span className="num">1</span>,{'\n'}
                    {'    '}learning_rate=<span className="num">0.5</span>){'\n'}
                    gb_clf.fit(X_train, y_train){'\n'}
                    <span className="cm"># train acc ≈ 0.939, test acc ≈ 0.904</span>
                  </div>
                </div>
              </div>
            )}

            {/* ── Stacking & Summary ── */}
            {l7Tab === 'Stacking & Summary' && (
              <div>
                <p className="m4-sec-sub">Instead of a fixed aggregation rule (majority vote, average), train a model — the <strong>blender</strong> — to learn the optimal way to combine base predictions.</p>

                <div className="m4-two-col">
                  <div className="m4-card">
                    <div className="m4-card-h">Stacked Generalization</div>
                    <div className="m4-infobox" style={{ marginBottom: '0.6rem', fontSize: '0.78rem' }}>
                      Each base predictor outputs a number for a new instance; the blender consumes those numbers as <em>input features</em> and outputs the final prediction.
                    </div>
                    <div className="m4-flabel">Architecture</div>
                    <div style={{ fontFamily: 'monospace', fontSize: '0.66rem', color: 'var(--text-1)', lineHeight: 1.85, background: 'var(--bg-3)', borderRadius: 6, padding: '0.55rem 0.7rem', border: '1px solid rgba(34,211,238,0.12)' }}>
                      {`X (new instance)\n   │\n   ├─→ Predictor 1  ── 3.1 ─┐\n   ├─→ Predictor 2  ── 2.7 ─┤── Blender ── 3.0 (final)\n   └─→ Predictor 3  ── 2.9 ─┘`}
                    </div>
                    <div className="m4-flabel" style={{ marginTop: '0.6rem' }}>Algorithm — main steps</div>
                    <ol style={{ paddingLeft: '1.2rem', fontSize: '0.76rem', color: 'var(--text-1)', lineHeight: 1.7 }}>
                      <li><strong>Train base predictors</strong> using k-fold cross-validation on the training set.</li>
                      <li><strong>Generate cross-validated predictions</strong> for each instance (out-of-fold predictions — predictions on data the base never saw during fitting).</li>
                      <li><strong>Build a blending training set</strong>: input features = base predictors' out-of-fold predictions; targets = original labels.</li>
                      <li><strong>Train the blender</strong> on this dataset to learn the aggregation.</li>
                      <li>After the blender is trained, <strong>retrain base predictors on the full original training set</strong>.</li>
                    </ol>
                  </div>
                  <div className="m4-card">
                    <div className="m4-card-h">Blending Training Set + Implementation</div>
                    <div className="m4-flabel">Blender input rows (3 base predictors)</div>
                    <table className="m4-ptable">
                      <thead><tr><th>P1 output</th><th>P2 output</th><th>P3 output</th><th>ground truth</th></tr></thead>
                      <tbody>
                        <tr><td>3.1</td><td>2.7</td><td>2.9</td><td className="pk">3.0</td></tr>
                        <tr><td>1.5</td><td>1.7</td><td>1.4</td><td className="pk">1.6</td></tr>
                        <tr><td>...</td><td>...</td><td>...</td><td>...</td></tr>
                      </tbody>
                    </table>
                    <div className="m4-infobox" style={{ marginTop: '0.5rem', fontSize: '0.73rem' }}>
                      With 5-fold CV, each estimator trains on 4 folds and predicts on 1; concatenating the 5 prediction sets gives the full blender input.
                    </div>
                    <div className="m4-flabel" style={{ marginTop: '0.6rem' }}>Implementation</div>
                    <div className="m4-pseudocode">
                      <span className="kw">from</span> sklearn.ensemble <span className="kw">import</span> StackingClassifier{'\n'}
                      {'\n'}
                      stacking_clf = StackingClassifier({'\n'}
                      {'    '}estimators=[{'\n'}
                      {'        '}(<span className="cm">'lr'</span>,  LogisticRegression()),{'\n'}
                      {'        '}(<span className="cm">'rf'</span>,  RandomForestClassifier()),{'\n'}
                      {'        '}(<span className="cm">'svc'</span>, SVC(probability=<span className="kw">True</span>))],{'\n'}
                      {'    '}final_estimator=RandomForestClassifier(),{'\n'}
                      {'    '}cv=<span className="num">5</span>){'\n'}
                      stacking_clf.fit(X_train, y_train)
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-2)', marginTop: '0.5rem' }}>Also available: <code>StackingRegressor</code>.</div>
                  </div>
                </div>

                <div className="m4-card" style={{ marginTop: '0.75rem' }}>
                  <div className="m4-card-h">Ensemble Methods — Master Summary Table</div>
                  <table className="m4-ptable">
                    <thead><tr><th>Method</th><th>Base Estimators</th><th>Diversity Source</th><th>Training</th><th>Notes</th></tr></thead>
                    <tbody>
                      <tr><td className="pk">Voting</td><td>Different (diverse)</td><td>Different algorithms</td><td>Parallel</td><td>Hard or soft voting</td></tr>
                      <tr><td className="pk">Bagging / Pasting</td><td>Same</td><td>Different data subsets (with/without replacement); optionally feature subsets</td><td>Parallel</td><td>Reduces variance</td></tr>
                      <tr><td className="pk">Random Forest</td><td>Decision Trees</td><td>Bootstrap + random feature subset (<Tex src="\sqrt{n}" />) at each split</td><td>Parallel</td><td>Default ensemble of trees</td></tr>
                      <tr><td className="pk">Extra-Trees</td><td>Decision Trees</td><td>RF + random split thresholds</td><td>Parallel</td><td>Faster than RF; more bias, less variance</td></tr>
                      <tr><td className="pk">AdaBoost</td><td>Any</td><td>Reweighting misclassified instances</td><td><strong>Sequential</strong></td><td>Cannot parallelise across machines</td></tr>
                      <tr><td className="pk">Gradient Boosting</td><td><strong>Decision Trees only</strong></td><td>Fits residual errors / log-loss gradient</td><td><strong>Sequential</strong></td><td>Use shrinkage + early stopping</td></tr>
                      <tr><td className="pk">Stacking</td><td>Any (diverse)</td><td>Trained blender aggregates predictions</td><td>Parallel base + blender</td><td>Blender trained on out-of-fold predictions</td></tr>
                    </tbody>
                  </table>
                  <div className="m4-infobox" style={{ marginTop: '0.7rem', fontSize: '0.76rem' }}>
                    <strong>Rules of thumb:</strong> Use <strong>Random Forest</strong> as a strong default. Use <strong>Gradient Boosting</strong> when you can afford careful tuning of <code>learning_rate</code>, <code>n_estimators</code>, and early stopping (XGBoost/LightGBM win most tabular Kaggle competitions). Use <strong>Voting</strong> for a quick win with diverse already-trained models. Use <strong>Stacking</strong> when you have time for a learned blender.
                  </div>
                </div>

                <EnsembleMatcher />
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
              <h2 className="m4-sec-title">Knowledge Check <span className="m4-badge" style={{ background: 'rgba(34,211,238,0.12)', color: 'var(--cyan)', border: '1px solid rgba(34,211,238,0.3)' }}>32 Questions · Lectures 1–9</span></h2>
              <p className="m4-sec-sub">Covering: Mitchell's E/T/P, supervised/unsupervised, bias trick, MSE vs MAE, confusion matrix, Normal Equation, gradient descent variants, logistic regression, Ridge/Lasso, kNN, SVMs, decision trees, and ensemble methods (voting, bagging/OOB, random forests, AdaBoost, gradient boosting, stacking), dimensionality reduction (PCA, kernel PCA, manifolds), and clustering (k-means, DBSCAN, silhouette). Detailed feedback on every answer.</p>
            </div>
            <QuizSection />
          </div>
        )}

        {/* ── DIMENSIONALITY REDUCTION (L8) ── */}
        {tab === 'Dimensionality Reduction' && (
          <div>
            <div className="m4-sec-hdr">
              <h2 className="m4-sec-title">Dimensionality Reduction <span className="m4-badge" style={{ background: 'rgba(167,139,250,0.12)', color: 'var(--violet)', border: '1px solid rgba(167,139,250,0.3)' }}>Lecture 8</span></h2>
            </div>
            <div className="m4-labtabs">
              {L8_TABS.map(lt => (
                <button key={lt} className={`m4-labtab ${l8Tab === lt ? 'm4-labtab--on' : ''}`} onClick={() => setL8Tab(lt)}>{lt}</button>
              ))}
            </div>

            {l8Tab === 'Curse of Dimensionality' && (
              <div>
                <p className="m4-sec-sub">Why thousands of features hurt: long training, sparse data, and points crowding the boundary. Feature selection (supervised) vs the unsupervised DR methods of this lecture.</p>
                <L8Curse />
              </div>
            )}

            {l8Tab === 'Projection & Manifolds' && (
              <div>
                <p className="m4-sec-sub">The two main approaches: linear projection onto a subspace, and manifold learning that unrolls twisted structures like the Swiss roll.</p>
                <L8Manifold />
              </div>
            )}

            {l8Tab === 'PCA' && (
              <div>
                <p className="m4-sec-sub">Principal Component Analysis: the max-variance linear projection. Principal axes via SVD, projecting the data, and the explained variance ratio.</p>
                <L8PCA />
              </div>
            )}

            {l8Tab === 'Choosing d & Compression' && (
              <div>
                <p className="m4-sec-sub">Pick the number of dimensions to retain a target variance (e.g. 95%), use PCA for compression, and reconstruct via the inverse transform.</p>
                <L8ChooseDim />
              </div>
            )}

            {l8Tab === 'PCA Variants' && (
              <div>
                <p className="m4-sec-sub">Feature normalisation before PCA, plus Randomized PCA (fast when d ≪ n) and Incremental PCA (mini-batch / online).</p>
                <L8Variants />
              </div>
            )}

            {l8Tab === 'Kernel PCA' && (
              <div>
                <p className="m4-sec-sub">The kernel trick gives nonlinear projections. Separating concentric circles with explicit polynomial features vs implicit Kernel PCA (linear / RBF / sigmoid).</p>
                <L8KernelPCA />
              </div>
            )}

            {l8Tab === 'Other Techniques' && (
              <div>
                <p className="m4-sec-sub">LLE, MDS, Isomap and t-SNE — manifold and visualisation methods — plus a t-SNE view of MNIST and the lecture summary.</p>
                <L8Other />
              </div>
            )}
          </div>
        )}

        {/* ── CLUSTERING / UNSUPERVISED LEARNING (L9) ── */}
        {tab === 'Clustering' && (
          <div>
            <div className="m4-sec-hdr">
              <h2 className="m4-sec-title">Unsupervised Learning — Clustering <span className="m4-badge" style={{ background: 'rgba(52,211,153,0.12)', color: 'var(--emerald)', border: '1px solid rgba(52,211,153,0.3)' }}>Lecture 9</span></h2>
            </div>
            <div className="m4-labtabs">
              {L9_TABS.map(lt => (
                <button key={lt} className={`m4-labtab ${l9Tab === lt ? 'm4-labtab--on' : ''}`} onClick={() => setL9Tab(lt)}>{lt}</button>
              ))}
            </div>

            {l9Tab === 'Introduction' && (
              <div>
                <p className="m4-sec-sub">What unsupervised clustering is, where it is used, and how it differs from classification — centroid-based (k-means) vs density-based (DBSCAN).</p>
                <L9Intro />
              </div>
            )}

            {l9Tab === 'K-Means Algorithm' && (
              <div>
                <p className="m4-sec-sub">Step through assign → update until convergence, with live inertia and Voronoi cells. Hard vs soft clustering and the key scikit-learn attributes.</p>
                <L9KMeans />
              </div>
            )}

            {l9Tab === 'Drawbacks & Remedies' && (
              <div>
                <p className="m4-sec-sub">Initialisation sensitivity (k-means++), choosing k via the elbow and silhouette score, and the spherical-shape limitation (remedy: GMM).</p>
                <L9Drawbacks />
              </div>
            )}

            {l9Tab === 'Semi-Supervised Learning' && (
              <div>
                <p className="m4-sec-sub">From 50 labels to 90.9% on digits: label cluster representatives, propagate labels, and drop outliers — beating the full-label baseline.</p>
                <L9SemiSup />
              </div>
            )}

            {l9Tab === 'DBSCAN' && (
              <div>
                <p className="m4-sec-sub">Density-based clustering: core / border / anomaly points, arbitrary-shape clusters via an interactive eps & min_samples explorer, plus pros and cons.</p>
                <L9DBSCAN />
              </div>
            )}
          </div>
        )}

      </main>
    </div>
  );
}
