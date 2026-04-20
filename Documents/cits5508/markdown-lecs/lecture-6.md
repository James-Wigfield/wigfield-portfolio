# Decision Trees

> **Course:** CITS5508 Machine Learning  
> **Lecturer:** Marcell Szikszai, 2026  
> **Reading:** Chapter 6 — *Hands-on Machine Learning with Scikit-Learn & TensorFlow*, Aurélien Géron, O'Reilly Media, 2022. Available via UWA OneSearch.  
> **Example code:** `handson-ml3/06_decision_trees.ipynb`

---

## Topics

1. Training and Visualising a Decision Tree
2. Making Predictions
3. Estimating Class Probabilities
4. The CART Training Algorithm
5. Computational Complexity
6. Gini Impurity or Entropy
7. Regularization Hyperparameters
8. Pruning
9. Regression
10. Limitations

---

## Overview

Decision Trees (DTs) are versatile ML algorithms capable of both **classification** and **regression**. They can fit complex datasets and are the fundamental components of **Random Forests**.

**Classification and Regression Trees (CARTs)** split data using predictor variables, with end (leaf) nodes holding predictions for the target value.

---

## General Idea — The Guess Who Analogy

*Guess Who*: one player picks a character card; the other guesses using only yes/no questions. To win efficiently, ask the most **informative** questions first.

**Dataset:**

| Man | Long Hair | Glasses | Name  |
|-----|-----------|---------|-------|
| Yes | No        | Yes     | Brian |
| Yes | No        | No      | John  |
| No  | Yes       | No      | Aphra |
| No  | No        | No      | Aoife |

### Strategy Comparison

**Strategy A — Ask "Does the person wear glasses?" first:**

```
Does the person wear glasses?
├── Yes → Brian                          (1 question)
└── No  → Is it a man?
          ├── Yes → John                 (2 questions)
          └── No  → Do they have long hair?
                    ├── Yes → Aphra      (3 questions)
                    └── No  → Aoife      (3 questions)
```

$$\text{Average questions} = \frac{1+2+3+3}{4} = 2.25$$

**Strategy B — Ask "Is it a man?" first:**

```
Is it a man?
├── Yes → Does the person wear glasses?
│         ├── Yes → Brian               (2 questions)
│         └── No  → John                (2 questions)
└── No  → Do they have long hair?
          ├── Yes → Aphra               (2 questions)
          └── No  → Aoife               (2 questions)
```

$$\text{Average questions} = \frac{2+2+2+2}{4} = 2.0$$

> **Key insight:** On average, an answer to Q1 ("Is it a man?") is **more informative** than an answer to Q2 ("Does the person wear glasses?"). The goal of DT training is to find the most informative questions to ask first.

---

## Regression Decision Tree — Example

**Dataset:** Hitters — Major League Baseball data from the 1986–1987 seasons.  
**Task:** Predict `log(Salary)` (1987 annual salary in thousands of dollars) from `Years` (years in the major leagues) and `Hits` (number of hits in 1986).

### Tree Structure (depth=2)

```
                    [Years < 4.5]
                   /             \
              5.11             [Hits < 117.5]
           (leaf: R1)          /             \
                            6.00            6.74
                         (leaf: R2)      (leaf: R3)
```

**Terminal (leaf) nodes** contain the mean of `log(Salary)` for instances that fall there.

### Interpretation

| Region | Condition | Description |
|--------|-----------|-------------|
| R1 | Years < 4.5 | **Inexperienced** — fewer than 4 years in major leagues |
| R2 | Years ≥ 4.5 AND Hits < 117.5 | **Experienced, not great hitters** — ≥4 years, ≤117 hits in 1986 |
| R3 | Years ≥ 4.5 AND Hits ≥ 117.5 | **Experienced, good hitters** — ≥4 years, ≥118 hits in 1986 |

### Alternative Visualisation — Feature Space Partition

```
Hits (y-axis)
238 |──────────┬─────────────────────────────
    |    R1    |           R3
    |          |
117.5|          |─────────────────────────────
    |          |           R2
  1 |──────────┴─────────────────────────────
    1         4.5                           24
                      Years (x-axis)
```

The tree's splits correspond to axis-aligned rectangular regions in feature space.

### Predictions (back-transformed from log scale)

| Region | Predicted log(Salary) | Predicted Salary |
|--------|----------------------|-----------------|
| R1 (Inexperienced) | 5.107 | $\exp(5.107) \approx \$165{,}174$ |
| R2 (Experienced, not good hitters) | 5.999 | $\exp(5.999) \approx \$402{,}834$ |
| R3 (Experienced, good hitters) | 6.740 | $\exp(6.740) \approx \$845{,}346$ |

---

## Training and Visualising a DT in sklearn

```python
from sklearn.datasets import load_iris
from sklearn.tree import DecisionTreeClassifier

iris = load_iris(as_frame=True)
X_iris = iris.data[["petal length (cm)", "petal width (cm)"]].values
y_iris = iris.target

tree_clf = DecisionTreeClassifier(max_depth=2)
tree_clf.fit(X_iris, y_iris)
```

Use `export_graphviz()` to output a `.dot` graph file, then render with the `graphviz` package.

> **Note:** Requires `conda install python-graphviz`

---

## Decision Tree Visualised — Iris (depth=2)

```
              [petal length (cm) <= 2.45]        ← Root node & split node
               gini = 0.667
               samples = 150
               value = [50, 50, 50]
               class = setosa
              /                        \
           True                       False
            /                            \
    [gini = 0.0]              [petal width (cm) <= 1.75]   ← Split node
    samples = 50               gini = 0.5
    value = [50, 0, 0]         samples = 100
    class = setosa  ←Leaf      value = [0, 50, 50]
                               class = versicolor
                              /                   \
                           True                  False
                            /                       \
                 [gini = 0.168]              [gini = 0.043]
                 samples = 54               samples = 46
                 value = [0, 49, 5]         value = [0, 1, 45]
                 class = versicolor ←Leaf   class = virginica ←Leaf
```

---

## Terminology

| Term | Definition |
|------|-----------|
| **Split / internal node** | A non-leaf node with a split condition $X_j \leq t_j$; left branch = True (≤), right branch = False (>) |
| **Branch** | Edge connecting nodes |
| **Leaf / terminal node** | End node where prediction is made |
| **Root node** | The topmost split node |

The overall idea: find which feature is **most informative** to split on, and how different answers lead toward pure predictions.

---

## Making Predictions

To predict for a new instance:
1. Start at the root node
2. At each split node, go left if condition is True, right if False
3. The class (or value) of the reached leaf node is the prediction

### Node Information

Each node records:
- **`samples`** — number of training instances reaching this node
- **`value`** — count of training instances per class at this node
- **`gini`** — impurity of this node
- **`class`** — majority class (for classification)

### Gini Impurity

Measures how "mixed" a node's class distribution is. Low gini = mostly one class.

$$G_i = 1 - \sum_{k=1}^{n} p_{i,k}^2$$

where $p_{i,k}$ is the fraction of class $k$ instances among training instances at node $i$.

**Examples:**
- Pure node (all one class): $G_i = 1 - 1^2 = 0$
- Perfectly mixed (2 classes, 50/50): $G_i = 1 - (0.5^2 + 0.5^2) = 0.5$

---

## A "White Box" Classifier

Decision trees are **white box** models — their reasoning is human-readable (follow the path from root to leaf).

| Model Type | Examples | Interpretability |
|---|---|---|
| **White box** | Decision Trees | Human-understandable logic |
| **Black box** | Random Forests, Neural Networks | Difficult to interpret |

### Decision Boundaries (Iris, depth=2)

```
Petal width (cm)
  3.0 |[setosa zone  ]|[    virginica zone         ]
      |               |                    :
  1.75|               |--------------------:--------  ← Depth=1 split
      |               |[  versicolor zone  :        ]
  0.0 |               |                    :
      +───────────────┼────────────────────:────────
      0              2.45                 5.0
                  ↑ Depth=0              ↑ (Depth=2)
              petal length (cm)
```

Each depth level adds one axis-aligned boundary line to the feature space.

---

## Estimating Class Probabilities

Leaf node `value` arrays give class counts, which can be normalised to probabilities.

**Example:** Instance with `petal length=5 cm`, `petal width=1.5 cm`
- Traverses to leaf: `value = [0, 49, 5]`, `samples = 54`
- Class probabilities: $[0/54, \ 49/54, \ 5/54] = [0.0, \ 0.907, \ 0.093]$

```python
>>> tree_clf.predict_proba([[5, 1.5]])
array([[ 0.        ,  0.90740741,  0.09259259]])

>>> tree_clf.predict([[5, 1.5]])
array([1])   # class index 1 = versicolor
```

---

## The CART Training Algorithm

**CART** = Classification And Regression Tree

**Core idea:** Recursively divide the feature space $\{X_1, X_2, \ldots, X_n\}$ into $J$ distinct non-overlapping rectangular regions $R_1, R_2, \ldots, R_J$.

- **Regression:** predict instances in $R_j$ as the **mean** response of training instances in $R_j$
- **Classification:** predict instances in $R_j$ as the **most probable class** among training instances in $R_j$

### Algorithm Properties

| Property | Description |
|---|---|
| **Top-down** | Starts at root, works downward |
| **Greedy** | Optimises each split locally; globally optimal tree is NP-hard |
| **Binary splits** | Each node splits into exactly 2 children |
| **Axis-aligned** | Splits are always of the form $X_j \leq t_j$ |

### Algorithm Steps

```
1. At current node with data subset S:
   a. For each feature Xj and each candidate threshold tj:
      - Split S into S_left = {x ∈ S | Xj ≤ tj}
                    S_right = {x ∈ S | Xj > tj}
      - Compute cost J(Xj, tj)
   b. Choose (Xj, tj) that minimises J
   c. Create left child with S_left, right child with S_right
2. Recurse on each child
3. Stop when:
   - Cannot reduce impurity further, OR
   - Stopping condition met (e.g., max_depth reached)
```

### CART Cost Function — Classification

$$J(X_j, t_j) = \frac{m_{\text{left}}}{m} G_{\text{left}} + \frac{m_{\text{right}}}{m} G_{\text{right}}$$

where $m_{\text{left}}$ and $m_{\text{right}}$ are the number of instances in the left and right subsets, and $G$ is the Gini impurity of each subset.

> The algorithm finds the pair $(X_j, t_j)$ that produces the **purest** subsets, weighted by size.

---

## Computational Complexity

| Operation | Complexity | Notes |
|---|---|---|
| **Prediction** | $O(\log_2 m)$ | Traverse root-to-leaf; each node checks one feature; independent of number of features |
| **Training** | $O(nm \log_2 m)$ | Compares all $n$ features across all $m$ samples at each node |

Predictions are **very fast** even on large datasets. Training is the expensive part.

---

## Gini Impurity vs Entropy

Two alternative impurity measures for the CART cost function:

### Gini Impurity (default)

$$G_i = 1 - \sum_{k=1}^{n} p_{i,k}^2$$

### Entropy

$$H_i = -\sum_{\substack{k=1 \\ p_{i,k} \neq 0}}^{n} p_{i,k} \log_2(p_{i,k})$$

Both equal zero when a node is pure (single class only).

**Iris example** — depth-2 left node entropy:

$$H = -\frac{49}{54}\log_2\!\left(\frac{49}{54}\right) - \frac{5}{54}\log_2\!\left(\frac{5}{54}\right) \approx 0.445$$

### Comparison

| Criterion | Speed | Tree Shape | Use Case |
|---|---|---|---|
| **Gini** | Faster | Isolates most frequent class in its own branch | Good default |
| **Entropy** | Slightly slower | Tends to produce more balanced trees | When balance matters |

> In practice, they produce **very similar** trees — the choice rarely makes a significant difference.

Set with: `DecisionTreeClassifier(criterion="entropy")`

---

## Regularization Hyperparameters

DTs are **nonparametric models** — they make few assumptions about the data and adapt very freely. This means they are prone to **overfitting**.

A smaller tree (fewer splits, fewer regions) has higher bias but lower variance, and often generalises better.

### Available Hyperparameters in sklearn

| Hyperparameter | Effect | Direction |
|---|---|---|
| `max_depth` | Maximum depth of the tree | ↓ reduces overfitting |
| `min_samples_split` | Min samples required to split a node | ↑ reduces overfitting |
| `min_samples_leaf` | Min samples required at a leaf node | ↑ reduces overfitting |
| `min_weight_fraction_leaf` | Min weighted fraction at a leaf | ↑ reduces overfitting |
| `max_leaf_nodes` | Maximum number of leaf nodes | ↓ reduces overfitting |
| `max_features` | Number of features considered per split | ↓ reduces overfitting |

**Rule of thumb:** Increasing `min_*` or decreasing `max_*` hyperparameters **regularizes** the model.

### Effect of `min_samples_leaf`

```
No restrictions (overfitting)      min_samples_leaf=5 (better generalisation)
┌──────────────────────────┐       ┌──────────────────────────┐
│  Very jagged, complex    │       │  Smoother, simpler       │
│  decision boundaries     │  vs   │  decision boundaries     │
│  ← fits training noise   │       │  ← ignores small groups  │
└──────────────────────────┘       └──────────────────────────┘
```

---

## Regression with Decision Trees

### CART Cost Function — Regression

Instead of Gini impurity, use **Mean Squared Error (MSE)**:

$$J(X_j, t_j) = \frac{m_{\text{left}}}{m} \text{MSE}_{\text{left}} + \frac{m_{\text{right}}}{m} \text{MSE}_{\text{right}}$$

where:

$$\text{MSE}_{\text{node}} = \frac{\sum_{i \in \text{node}} \left(\hat{y}_{\text{node}} - y^{(i)}\right)^2}{m_{\text{node}}}$$

and the node prediction is:

$$\hat{y}_{\text{node}} = \frac{\sum_{i \in \text{node}} y^{(i)}}{m_{\text{node}}}$$

### Example — Noisy Quadratic (depth=2)

```python
import numpy as np
from sklearn.tree import DecisionTreeRegressor

X_quad = np.random.rand(200, 1) - 0.5  # single random input feature
y_quad = X_quad ** 2 + 0.025 * np.random.randn(200, 1)

tree_reg = DecisionTreeRegressor(max_depth=2, random_state=42)
tree_reg.fit(X_quad, y_quad)
```

**Resulting tree:**

```
                [x1 <= 0.197]
                 mse=0.098, samples=200, value=0.354
               /                                    \
           True                                   False
          /                                            \
  [x1 <= 0.092]                               [x1 <= 0.772]
  mse=0.038, n=44, val=0.689                  mse=0.074, n=156, val=0.259
  /               \                           /                \
mse=0.018       mse=0.013               mse=0.015           mse=0.036
n=20            n=24                    n=110               n=46
val=0.854       val=0.552               val=0.111           val=0.615
```

### Effect of Depth on Regression

| `max_depth` | Step function resolution | Tendency |
|---|---|---|
| 2 | 3–4 coarse steps | Underfitting |
| 3 | 7–8 finer steps | Better fit |
| Unrestricted | Memorises every point | Overfitting |

> Training objective: **minimise MSE** across all leaf nodes.

---

## Pruning a Regression Decision Tree

**Motivation:** A smaller tree (fewer splits) can have lower variance and better interpretability, at the cost of a small increase in bias.

### Cost-Complexity Pruning

Grow a large tree $T_0$, then prune back to find optimal subtree. For a tuning parameter $\alpha \geq 0$, find the subtree $T \subseteq T_0$ that minimises:

$$\sum_{l=1}^{|T|} \sum_{x_i \in R_l} \left(y_i - \hat{y}_{R_l}\right)^2 + \alpha |T|$$

where:
- $|T|$ = number of terminal (leaf) nodes
- $R_l$ = the rectangle (region) for the $l$-th terminal node
- $\hat{y}_{R_l}$ = mean response of training observations in $R_l$
- $\alpha$ = complexity penalty (tuning hyperparameter)

### Effect of $\alpha$

| $\alpha$ value | Effect |
|---|---|
| $\alpha = 0$ | $T = T_0$ (no penalty; just measures training error) |
| $\alpha$ increasing | Penalises complexity → favours smaller subtrees |
| $\alpha \to \infty$ | Single-node tree (just the root) |

### Pruning Algorithm Steps

```
1. Build full regression tree T0 on training data
2. Vary α to generate a sequence of subtrees with decreasing |T|
3. Use k-fold cross-validation to estimate validation error for each α
4. Select α that minimises average cross-validation error
5. Return the corresponding subtree
```

### Baseball Example — Unpruned vs Pruned

**Unpruned tree** (12 leaf nodes):
```
Years < 4.5
├── RBI < 60.5
│   ├── Putouts < 82
│   │   ├── 5.487
│   │   └── Years < 3.5
│   │       ├── 4.622
│   │       └── 5.183
│   └── Years < 3.5
│       ├── 5.394
│       └── 6.189
└── Hits < 117.5
    ├── Walks < 43.5
    │   ├── Runs < 47.5
    │   │   ├── 6.015
    │   │   └── 5.571
    │   └── 6.407
    └── Walks < 52.5
        ├── 6.549
        └── RBI < 80.5
            ├── Years < 6.5
            │   ├── 6.459
            │   └── 7.007
            └── 7.289
```

**Pruned tree** (3 leaf nodes):
```
Years < 4.5
├── 5.11
└── Hits < 117.5
    ├── 6.00
    └── 6.74
```

### MSE vs Tree Size (Baseball)

```
MSE
1.0 |●  ← Training starts high, decreases monotonically
    |●
0.8 |
    |  ●──────  ← Cross-validation bottoms out ~3 leaves, rises slowly
0.6 |  ●
    |    ●
0.4 |    ●─────────────────────────────────  ← Test error also stabilises
    |      ●──────────────────────────────
0.2 |        ●─────────────────●─────────  ← Training keeps falling (overfitting)
    |
0.0 +──────────────────────────────────────
    2      4       6       8      10
                Tree Size (leaf nodes)

    — Training    — Cross-Validation    — Test
```

> The cross-validation error is minimised around **3 leaf nodes**, matching the pruned tree.

---

## Limitations of Decision Trees

### 1. Prone to Overfitting

Without regularization, DTs perfectly memorise training data.

```
No restrictions:              min_samples_leaf=10:
highly jagged step function   smooth, reasonable step function
← obvious overfitting         ← better generalisation
```

### 2. Sensitivity to Rotation

DTs use **axis-aligned splits only** — they cannot create diagonal decision boundaries naturally. Rotating the training data can produce a very different tree.

```
Before rotation:              After rotation:
  x2 |    |                     x2 | straight diagonal
     |    |  ← clean vertical      |─────── split needed
     |    |    split               |  (DT uses jagged steps)

```

> **Mitigation:** PCA (Principal Component Analysis) can align features with the most informative axes before fitting the tree.

### 3. High Variance

DTs are **high-variance models**:
- Small changes to hyperparameters → very different tree structure
- Re-training on the same data (with different random seed) → different tree

> **Mitigation:** **Random Forests** average many trees to dramatically reduce variance.

---

## Decision Trees vs Linear Models

| Scenario | Better Model |
|---|---|
| Relationship between features and target is **approximately linear** | Linear regression |
| Relationship is **non-linear / complex** | Decision Tree |

```
Linear boundary (top row):         Non-linear boundary (bottom row):
┌──────────┬─────────────┐         ┌──────────┬─────────────┐
│          │Linear model │         │ DT with  │ DT with     │
│ Linear   │ fits well   │         │ diagonal │ axis-aligned│
│ boundary │ (diagonal   │         │ boundary │ splits fits │
│          │ line)       │         │ (linear  │ well        │
│          │             │         │ model    │             │
│          │DT approxim- │         │ fails)   │             │
│          │ates badly   │         │          │             │
└──────────┴─────────────┘         └──────────┴─────────────┘
```

---

## Summary

```
Decision Trees
│
├── Core Algorithm: CART (Classification And Regression Trees)
│   ├── Recursive binary splitting of feature space
│   ├── Greedy top-down — locally optimal, not globally optimal
│   ├── Classification cost: weighted Gini impurity (or entropy)
│   └── Regression cost: weighted MSE
│
├── Impurity Measures
│   ├── Gini: G = 1 - Σ p²_{i,k}          (default, faster)
│   └── Entropy: H = -Σ p_{i,k} log₂(p_{i,k})  (more balanced trees)
│
├── Complexity
│   ├── Prediction: O(log₂ m) — very fast
│   └── Training:  O(nm log₂ m)
│
├── Regularization (prevent overfitting)
│   ├── max_depth, max_leaf_nodes    (restrict size)
│   ├── min_samples_split/leaf       (require minimum data per node)
│   └── Cost-complexity pruning      (grow then prune using α)
│
├── Strengths
│   ├── Interpretable — "white box"
│   ├── Handles both classification and regression
│   ├── No feature scaling needed
│   └── Fast prediction
│
└── Limitations
    ├── High variance — sensitive to data/hyperparameter changes
    ├── Axis-aligned splits — sensitive to feature rotation
    ├── Prone to overfitting without regularization
    └── Inferior to linear models when true relationship is linear
        → Solution: Random Forests (ensemble of many trees)
```