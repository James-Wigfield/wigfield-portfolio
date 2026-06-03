# CITS5508 Machine Learning — The Code Behind the Course

*A narrated walkthrough of every key scikit-learn and NumPy snippet from Lectures 1 to 9, built to be read aloud as a single, continuous explanation.*

---

## How to read this video

This walkthrough tells one story: how a machine learning model goes from a single line that draws a straight boundary, all the way to ensembles of hundreds of models and to algorithms that find structure in data with no labels at all. We follow the exact order of the CITS5508 lectures, because that order is itself a teaching arc — each idea is the foundation for the next.

Every piece of code here appears in the course lectures, and every explanation is written to match how the lectures frame these ideas. We will move through eight chapters: the foundations of a simple classifier and honest evaluation; regression and the optimisation machinery that trains it; regularisation and instance-based learning; support vector machines; decision trees; ensembles and boosting; dimensionality reduction; and finally unsupervised clustering. Watch how each chapter answers a limitation exposed in the one before it.

---

# Chapter 1 — Foundations: a simple model, and learning to trust it

Before any sophisticated model, the course starts with the simplest possible classifier and then asks a sharper question than "is it accurate?" — it asks "how do we even know an accuracy number is meaningful?"

## 1.1 The simple linear model, vectorised

*This is the seed of the entire course: a model that scores an input with a weighted sum and reads off its sign.*

The course's first model takes an input vector, multiplies each feature by a weight, adds everything up, and looks at whether the result is positive or negative. That sign is the predicted class. The clever trick that makes this compact is the *bias trick*: instead of carrying a separate bias term, we fold it in as weight `w₀` and attach a constant dummy feature `x₀ = 1` to every instance. The whole model then collapses into a single dot product, written `h(x) = sgn(wᵀx)`.

```python
import numpy as np

# h(x) = sign(wᵀx), with a dummy feature x0 = 1 (the bias trick)
def predict(X, w):
    return np.sign(X @ w)          # vectorised over all rows — no Python loop

# Perceptron update over the training set
for i in range(len(X)):
    if y[i] != np.sign(X[i] @ w):    # misclassified?
        w = w + y[i] * X[i]          # w <- w + y_i * x_i
```

The first thing to notice is `np.sign(X @ w)`. The matrix `X` holds every training instance as a row, so this one expression scores *all* of them at once. This is NumPy vectorisation, and the lectures stress it for a concrete reason: it replaces a slow Python `for` loop with a single optimised matrix operation, drastically cutting execution time. Whenever you see the `@` symbol in this course, think "the whole dataset, in one step."

The second half is the entire learning rule. We walk through the training set, and whenever the model's prediction disagrees with the true label, we nudge the weight vector: `w ← w + yᵢ·xᵢ`. Correctly classified points leave the weights untouched — this is exactly the update rule the lectures give, adjusting the weights only when an instance is misclassified. The intuition is geometric: a misclassified point pulls the decision boundary toward putting it on the correct side. The "parameter" that matters here is conceptual rather than numeric — the decision to update *only on mistakes* is what drives the model toward a boundary that separates the classes.

## 1.2 Honest evaluation: confusion matrix, precision, and recall

*Having a model is half the job; the other half is measuring it in a way that cannot fool you.*

The course introduces evaluation on the MNIST dataset — seventy thousand handwritten digits, each a twenty-eight by twenty-eight image, which flattens to seven hundred and eighty-four features. A simple binary task drives the point home: is this digit a five, or not? To score it honestly, we use cross-validated predictions and a confusion matrix, then derive precision and recall.

```python
from sklearn.model_selection import cross_val_predict
from sklearn.metrics import confusion_matrix, precision_score, recall_score

y_train_pred = cross_val_predict(sgd_clf, X_train, y_train_5, cv=3)
cm = confusion_matrix(y_train_5, y_train_pred)

precision_score(y_train_5, y_train_pred)   # TP / (TP + FP)
recall_score(y_train_5, y_train_pred)      # TP / (TP + FN)
```

The function `cross_val_predict` is doing something subtle and important. Rather than predicting on data the model was trained on — which would flatter it — it produces *out-of-fold* predictions: each instance is predicted by a model that never saw it during training. The `cv=3` argument splits the data into three folds for this purpose. The result is a set of predictions you can score without the train-on-test leakage that would make every metric look better than reality.

From those predictions, `confusion_matrix` counts how often class A is mistaken for class B. Precision and recall then read straight off that matrix. Precision is true positives divided by all predicted positives — of everything the model flagged as a five, what fraction really were fives. Recall is true positives divided by all actual positives — of all the real fives, what fraction did the model catch. The lectures pair these with the precision/recall trade-off: you prioritise precision when a false positive is costly, such as deciding it is safe to change lanes, and you prioritise recall when a false negative is costly, such as screening for cancer. The single number that balances both is the F₁ score, the harmonic mean of precision and recall.

## 1.3 Why accuracy alone lies: the dummy baseline

*This tiny snippet is the punchline of the whole evaluation discussion — and it is why we never trust accuracy on its own.*

```python
from sklearn.dummy import DummyClassifier

dummy = DummyClassifier()        # predicts the majority class
dummy.fit(X_train, y_train_5)    # y_train_5: is the digit a 5?
print(dummy.score(X_train, y_train_5))
```

This classifier learns nothing useful — it simply predicts the majority class, which on the five-versus-not-five task means always answering "not a five." And yet it scores over ninety percent accuracy. The reason is that only about ten percent of MNIST digits are fives, so "always not-a-five" is right roughly ninety percent of the time. The lecture's lesson is blunt: on imbalanced data, accuracy is misleading, and a high accuracy number can hide a model that has learned nothing. This is exactly why the confusion matrix, precision, and recall from the previous section exist. Keep this baseline in mind for the rest of the course — it is the reason we reach for richer metrics.

---

# Chapter 2 — Regression and the engine that trains models

The simple classifier could only say "this class or that class." Regression predicts a real number, and in learning to fit it we meet gradient descent — the optimisation engine that will reappear in almost every model afterwards.

## 2.1 The Normal Equation: a closed-form answer

*Sometimes you can skip iteration entirely and solve for the best parameters in one shot.*

Linear regression predicts a weighted sum of the features plus an intercept. Training means finding the parameter vector θ that minimises the mean squared error. Remarkably, there is a direct mathematical solution — the Normal Equation — that gives the optimal θ with no iteration and no learning rate at all.

```python
from sklearn.preprocessing import add_dummy_feature

X_b = add_dummy_feature(X)                       # add x0 = 1 to each instance
theta_best = np.linalg.inv(X_b.T @ X_b) @ X_b.T @ y
```

The first line uses the same bias trick from Chapter 1: `add_dummy_feature` prepends a column of ones so that θ₀ becomes the intercept term automatically. The second line is the Normal Equation itself, `θ̂ = (XᵀX)⁻¹ Xᵀy`, translated directly into NumPy. It computes the best-fitting parameters in closed form.

The crucial trade-off the lectures highlight is computational. The Normal Equation's running time is linear in the number of training instances, which is fine, but it is roughly *cubic* in the number of features, because inverting that feature-by-feature matrix gets expensive fast. So the closed form is elegant and exact, but it becomes impractical when your data has very many features. That limitation is exactly what motivates the next idea.

## 2.2 Batch Gradient Descent

*When a closed-form solution is too expensive, we descend toward the answer step by step — this is the optimiser at the heart of the course.*

Gradient descent is a generic optimisation algorithm: it measures the local slope of the cost function and takes a step downhill, repeating until it reaches a minimum. The "batch" variant computes that slope using the entire training set at every single step.

```python
eta = 0.1           # learning rate
n_epochs = 1000
m = len(X_b)

np.random.seed(42)
theta = np.random.randn(2, 1)   # random initialisation

for epoch in range(n_epochs):
    gradients = 2 / m * X_b.T @ (X_b @ theta - y)
    theta = theta - eta * gradients
```

The line that computes `gradients` is the gradient of the mean squared error cost, written exactly as the lecture's formula `(2/m)·Xᵀ(Xθ − y)`. Because it sums over all `m` instances, this is the *batch* gradient — an accurate estimate of the true slope, but slow on large datasets since every step touches every row. In fact, this is precisely how the course teaches you to tell the variants apart: if the gradient averages over the whole training set, it is Batch GD; if it uses a single random instance it is Stochastic GD; and if it uses small random subsets it is Mini-batch GD.

The most important hyperparameter is `eta`, the learning rate, set here to 0.1. It controls the size of each downhill step. If the learning rate is too large, the steps overshoot and the algorithm can diverge, with the cost growing instead of shrinking. If it is too small, the algorithm still converges but takes far too many steps to get there. Choosing it well is the central tuning decision for any gradient-based method. The other detail worth narrating is the random initialisation with a fixed seed — starting from a random θ and fixing the seed makes the run reproducible.

## 2.3 Logistic Regression: regression repurposed for classification

*The same weighted-sum machinery, passed through one squashing function, becomes a probabilistic classifier.*

Logistic regression is, despite its name, a classifier. It computes the same weighted sum of inputs as linear regression, but then passes the result through the logistic — or sigmoid — function, turning it into an estimated probability that the instance belongs to the positive class. If that probability is at least one half, it predicts the positive class; otherwise the negative one.

```python
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split

X = iris.data[["petal width (cm)"]].values
y = iris.target_names[iris.target] == 'virginica'
X_train, X_test, y_train, y_test = train_test_split(X, y, random_state=42)

log_reg = LogisticRegression(random_state=42)
log_reg.fit(X_train, y_train)
```

This is the lecture's Iris example: classifying whether a flower is Iris-Virginica, here using petal width as the feature. The model learns a linear decision boundary that separates the classes. Two things deserve narration. First, `train_test_split` with a fixed `random_state` makes the split reproducible and guards against data-snooping bias — a recurring discipline in this course, that you decide how to split before you look at results. Second, and this is the deep point the lecture makes, logistic regression's cost function — the log loss — is *convex*. There is no closed-form solution to minimise it, but convexity guarantees that gradient descent will find the global minimum rather than getting trapped in a local one. So the optimiser from the previous section is exactly what trains this model, and convexity is what makes that safe.

---

# Chapter 3 — Controlling complexity: regularisation and k-NN

A model flexible enough to fit anything will fit the noise too. This chapter is about reining that in — first by penalising large weights, then by meeting a model that stores the data instead of summarising it.

## 3.1 Ridge, Lasso, and Elastic Net

*Three ways to discourage a model from over-committing to the training data, each with a different geometric flavour.*

Regularisation reduces overfitting by constraining the model — the lectures put it simply, that fewer or smaller parameters make it harder to memorise the training data. For linear models, we constrain the weights by adding a penalty term to the cost function during training. The three classic forms are Ridge, Lasso, and Elastic Net.

```python
from sklearn.linear_model import Ridge, Lasso, ElasticNet

ridge_reg = Ridge(alpha=0.1, solver="cholesky")
ridge_reg.fit(X, y)

lasso_reg = Lasso(alpha=0.1)
lasso_reg.fit(X, y)

elastic_net = ElasticNet(alpha=0.1, l1_ratio=0.5)
elastic_net.fit(X, y)
```

Ridge regression adds a squared, or ℓ₂, penalty — it adds α times the sum of the squared weights to the cost. This shrinks the weights smoothly toward zero, keeping them all small without forcing any to vanish. Lasso uses an ℓ₁ penalty instead — α times the sum of the absolute values of the weights. The course frames regularisation as making the model simpler by constraining its weights, and the ℓ₁ penalty realises this in a stronger way than Ridge: its geometry tends to drive some weights to *exactly* zero, effectively selecting a subset of features and switching the rest off. Elastic Net is the middle ground, combining both penalties.

The hyperparameters carry the whole story. `alpha` is the regularisation strength: as α increases, the penalty dominates, weights are pushed smaller, and the model becomes simpler and higher-bias — guarding against overfitting but risking underfitting if pushed too far; as α decreases toward zero, you recover ordinary unregularised linear regression. In Elastic Net, `l1_ratio` — the lecture's mixing parameter r — balances the two penalties: at one it is pure Lasso, at zero pure Ridge, and at 0.5 an even blend. The practical intuition to carry forward: reach for Lasso or Elastic Net when you suspect many features are irrelevant and you want the model to ignore them, and for Ridge when you simply want to temper all the weights.

## 3.2 k-Nearest Neighbours

*Not every model builds an equation — some just remember everything and compare.*

The k-Nearest Neighbours algorithm is the course's example of *instance-based* learning, and it is the philosophical opposite of everything so far. It builds no model and learns no weights; it simply stores the training data. When a new instance arrives, it finds the k closest stored instances by a distance metric and lets them vote on the label.

```python
import numpy as np
from sklearn.neighbors import KNeighborsClassifier

y_train_large = (y_train >= '7')
y_train_odd = (y_train.astype('int8') % 2 == 1)
y_multilabel = np.c_[y_train_large, y_train_odd]

knn_clf = KNeighborsClassifier()
knn_clf.fit(X_train, y_multilabel)
```

This snippet also demonstrates *multilabel classification*, another idea from the same lecture: instead of one label per instance, each instance gets several binary labels. Here `np.c_` stacks two boolean targets side by side — is the digit large (seven or above), and is it odd — so every instance carries both labels at once, and k-NN naturally handles them together.

The hyperparameter that matters most is k itself, the number of neighbours consulted. The lecture's guidance is precise: a small k risks overfitting, because the prediction is swayed by a single nearby point and any noise around it; a large k risks underfitting and, crucially, tends to favour the majority class, which makes it a poor choice on imbalanced data. The other essential point — easy to forget and costly to ignore — is feature scaling. Because k-NN relies on distances, a feature measured on a larger numeric scale will dominate the distance calculation and drown out the others, so you normalise features before using it. And because it stores everything and compares at prediction time, k-NN is simple and intuitive but memory-hungry and slow to predict on large datasets.

---

# Chapter 4 — Support Vector Machines

We now meet a model with a distinctive goal: not just to separate the classes, but to separate them with the widest possible buffer. That single idea — the margin — leads naturally to the kernel trick, one of the most elegant ideas in the course.

## 4.1 The linear SVM, and why scaling is non-negotiable

*An SVM does not just draw a line — it fits the widest possible street between the classes.*

The lectures ask you to picture a linear SVM as fitting the widest possible "street" between two classes, with the decision boundary running down the middle. This is *large margin classification*. Only the instances sitting on the edges of the street — the *support vectors* — determine the boundary; adding points far off the street changes nothing.

```python
from sklearn.datasets import load_iris
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.svm import LinearSVC

iris = load_iris(as_frame=True)
X = iris.data[["petal length (cm)", "petal width (cm)"]].values
y = (iris.target == 2)  # Iris virginica

svm_clf = make_pipeline(StandardScaler(),
                        LinearSVC(C=1, dual=True, random_state=42))
svm_clf.fit(X, y)
```

The `make_pipeline` wrapper chains a `StandardScaler` with the `LinearSVC` so that scaling becomes an inseparable part of fitting and predicting. This matters because, as the lectures emphasise, SVMs are highly sensitive to feature scale — without scaling, the widest street can be badly distorted. There is also a discipline the course is firm about: the scaler must be fitted on the training data only, and those parameters then used to transform the validation and test sets, so that no information leaks from the test set into training. The pipeline enforces exactly this.

The decisive hyperparameter is `C`, which controls *soft margin* classification — the balance between keeping the street wide and limiting margin violations, where instances stray onto the street or the wrong side. As C *decreases*, the model tolerates more violations in exchange for a wider street, which usually generalises better. As C *increases*, the model permits fewer violations and the street narrows to hug the data tightly — a tight fit that risks overfitting. So a very large C produces a narrow margin that clings to the training points, while a small C produces a generous, more forgiving margin. Holding the margin wide is, counter-intuitively, often the safer choice.

## 4.2 Going nonlinear by adding polynomial features

*When a straight street cannot separate the data, change the shape of the space until it can.*

Many datasets cannot be split by any straight line. The first remedy the lectures offer is to add features — in particular polynomial features — because lifting the data into a richer feature space can make it linearly separable there even when it was not in the original space.

```python
from sklearn.datasets import make_moons
from sklearn.preprocessing import PolynomialFeatures

X, y = make_moons(n_samples=100, noise=0.15, random_state=42)

polynomial_svm_clf = make_pipeline(
    PolynomialFeatures(degree=3),
    StandardScaler(),
    LinearSVC(C=10, max_iter=10_000, dual=True, random_state=42))
polynomial_svm_clf.fit(X, y)
```

The `make_moons` dataset is the classic two-interleaving-crescents problem — impossible to separate with a straight line in its raw form. The pipeline first expands the features with `PolynomialFeatures`, then scales, then applies the linear SVM. The hyperparameter to watch is `degree`, set to three here: it sets how high the polynomial terms go. A higher degree can carve out more intricate boundaries and capture more complex shapes, but it also multiplies the number of features and raises the risk of overfitting and slow training. This snippet sets up the tension that the next idea resolves: adding many polynomial features is powerful, but it can become very expensive.

## 4.3 The kernel trick

*The kernel trick gives you the power of an enormous feature space without ever paying to build it.*

Here is the elegant resolution. Adding many polynomial features makes training slow because you actually compute all of them. The *kernel trick* lets an SVM obtain the same result as if you had added a huge number of polynomial features — without ever computing them explicitly. It is, in the lecture's words, a mathematical shortcut that delivers the effect of the high-dimensional feature space at a fraction of the cost.

```python
from sklearn.svm import SVC

poly_kernel_svm_clf = make_pipeline(StandardScaler(),
                                    SVC(kernel="poly", degree=3, coef0=1, C=5))
poly_kernel_svm_clf.fit(X, y)
```

Notice the switch from `LinearSVC` to `SVC`. This is a point the lectures make explicitly through the complexity table: `SVC` supports the kernel trick, while `LinearSVC` does not. The setting `kernel="poly"` selects the polynomial kernel, whose formula the course gives as `(γ·aᵀb + r)ᵈ`. The `degree` parameter, again three, sets the implicit polynomial order. The `coef0` parameter is the `r` term in that kernel formula; it controls how much the model is influenced by high-degree terms versus low-degree ones. And `C` plays the same soft-margin role as before. The trade-off worth remembering from the lecture is that `SVC` with a kernel is wonderfully expressive but its training time grows steeply — between quadratic and cubic in the number of instances — so it is best suited to small and medium datasets, exactly where the course recommends SVMs.

---

# Chapter 5 — Decision Trees

Decision trees take a completely different stance: instead of weights and distances, they ask a sequence of yes-or-no questions. They are readable, they need no scaling, and — importantly — they are the building blocks of the ensembles in the next chapter.

## 5.1 Training and visualising a tree

*A decision tree learns the most informative questions to ask, in the best order.*

The lecture's intuition is the game *Guess Who*: to identify a character with the fewest yes-or-no questions, you ask the most informative question first. A decision tree learns to do exactly that with the data. The CART algorithm grows the tree greedily, at each node choosing the feature and threshold whose split most reduces impurity.

```python
from sklearn.datasets import load_iris
from sklearn.tree import DecisionTreeClassifier

iris = load_iris(as_frame=True)
X_iris = iris.data[["petal length (cm)", "petal width (cm)"]].values
y_iris = iris.target

tree_clf = DecisionTreeClassifier(max_depth=2)
tree_clf.fit(X_iris, y_iris)
```

Two strengths the lectures emphasise are on display before we even tune anything. Decision trees need no feature scaling — distances and magnitudes do not matter, only the ordering of values at each split — which is a refreshing contrast to SVMs and k-NN. And they are *white box* models: you can follow the path from root to leaf and read off, in plain terms, why a prediction was made, unlike the black-box character of random forests or neural networks.

The hyperparameter shown is `max_depth`, set to two, and it is the main regulariser for trees. Decision trees are nonparametric — they adapt very freely to the data and, left unconstrained, will happily grow until they memorise the training set, which is overfitting. Reducing `max_depth` forces a smaller, simpler tree with higher bias but lower variance, which usually generalises better; increasing it lets the tree carve ever finer regions and risks fitting noise. Under the hood, each split is chosen to minimise the weighted Gini impurity of the two resulting subsets — Gini impurity being a measure of how mixed a node's classes are, equal to zero when a node holds a single class.

## 5.2 Reading class probabilities from a leaf

*A tree's prediction is not a black box — it is literally the makeup of the training samples in a leaf.*

```python
tree_clf.predict_proba([[5, 1.5]]).round(3)
# array([[0.   , 0.907, 0.093]])

tree_clf.predict([[5, 1.5]])
# array([1])   # class 1 = versicolor
```

This small snippet reveals exactly how a tree estimates probabilities, and it is beautifully transparent. The instance with petal length five and petal width one-and-a-half travels down the tree until it lands in a particular leaf. That leaf recorded the class counts of the training samples that reached it — in the lecture's worked example, zero of one class, forty-nine of another, and five of a third, out of fifty-four samples. The predicted probabilities are simply those counts normalised: forty-nine over fifty-four is 0.907, and five over fifty-four is 0.093. The `predict` method then returns the most probable class — the argmax — which here is class one, versicolor. The lesson to narrate: a decision tree's confidence is nothing mysterious, just the class proportions of the training data sitting in the leaf you landed in.

## 5.3 Regression with trees

*The same question-asking machine can predict numbers, not just classes.*

Trees are not limited to classification. A regression tree splits the feature space into regions and predicts, for any instance, the mean target value of the training instances in its region — producing a piecewise-constant, staircase-shaped prediction.

```python
import numpy as np
from sklearn.tree import DecisionTreeRegressor

X_quad = np.random.rand(200, 1) - 0.5            # one random input feature
y_quad = X_quad ** 2 + 0.025 * np.random.randn(200, 1)

tree_reg = DecisionTreeRegressor(max_depth=2, random_state=42)
tree_reg.fit(X_quad, y_quad)
```

The data here is a noisy quadratic — a parabola with a little Gaussian noise added. The regression tree chooses its splits to minimise mean squared error rather than Gini impurity, and each leaf predicts the average target of the points that fall in it. The hyperparameter `max_depth`, again two, now controls the *resolution* of the staircase: a shallow tree produces a few coarse steps that may underfit the curve, a deeper tree produces finer steps that track the data more closely, and an unrestricted tree will create a step for nearly every point and overfit the noise. This is the same bias-variance dial as in classification, just measured against MSE — and it foreshadows why trees, on their own, are described as high-variance models that benefit enormously from being combined.

---

# Chapter 6 — Ensembles: the wisdom of the crowd

A single decision tree is high-variance — retrain it on slightly different data and you can get a very different tree. The fix is to combine many models. This chapter is the course's answer to the limitations of every single model so far, and it builds from simple voting up to gradient boosting and stacking.

## 6.1 Voting classifiers

*Aggregate the opinions of several different models and the crowd often beats any individual.*

The founding idea of ensembles is the wisdom of the crowd: aggregating the predictions of many models often produces a stronger model than any one of them alone. Even *weak learners* — models only slightly better than guessing — can combine into a *strong learner*, provided there are enough of them and they are diverse enough to make different errors.

```python
from sklearn.ensemble import RandomForestClassifier, VotingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.svm import SVC

voting_clf = VotingClassifier(
    estimators=[
        ('lr',  LogisticRegression(random_state=42)),
        ('rf',  RandomForestClassifier(random_state=42)),
        ('svc', SVC(random_state=42))
    ])
voting_clf.fit(X_train, y_train)
```

The `estimators` list deliberately mixes three very different algorithms — logistic regression, a random forest, and an SVM. That diversity is the engine of the ensemble: because the models fail in different ways, their mistakes tend to cancel when combined, and the lecture's moons-dataset results bear this out, with the ensemble beating each individual member. The key hyperparameter is the `voting` mode. The default is *hard* voting, where the ensemble predicts the majority class across its members. Switching to *soft* voting averages the predicted probabilities instead, which weights confident votes more heavily and often performs better — though it requires every member to be able to output probabilities.

## 6.2 Bagging with out-of-bag evaluation

*Train the same model many times on different random samples of the data, and get a free validation score in the bargain.*

Bagging — short for bootstrap aggregating — takes one algorithm and trains many copies of it, each on a different random sample of the training set drawn *with replacement*. Averaging or majority-voting those copies reduces variance, which is exactly the weakness of a single decision tree.

```python
from sklearn.ensemble import BaggingClassifier
from sklearn.tree import DecisionTreeClassifier

bag_clf = BaggingClassifier(
    DecisionTreeClassifier(), n_estimators=500,
    oob_score=True, n_jobs=-1, random_state=42)
bag_clf.fit(X_train, y_train)
bag_clf.oob_score_                  # 0.896
```

Here `n_estimators=500` trains five hundred trees, each on its own bootstrap sample. Because sampling is done with replacement, each tree ends up using about two-thirds of the instances, and the remaining one-third — the *out-of-bag* instances — were never seen by that tree. This is the clever part the lecture highlights: those left-out instances act as a free validation set. Setting `oob_score=True` tells scikit-learn to evaluate each instance using only the trees that did not train on it, yielding the out-of-bag score — here about 0.896 — with no need to carve off a separate validation split. The `n_jobs=-1` argument simply parallelises the work across all CPU cores, which bagging permits because the trees are independent.

## 6.3 Random forests and feature importance

*Add one more dose of randomness to bagged trees and you get one of the most reliable models in the toolbox — one that also tells you which features matter.*

A random forest is an ensemble of decision trees, generally trained by bagging, with one extra twist that sets it apart.

```python
from sklearn.ensemble import RandomForestClassifier

rnd_clf = RandomForestClassifier(n_estimators=500, random_state=42)
rnd_clf.fit(iris.data, iris.target)

for score, name in zip(rnd_clf.feature_importances_, iris.feature_names):
    print(round(score, 2), name)
```

The distinguishing twist, as the lecture states, is that when a random forest splits a node, it does not search all features for the best split — it searches only a random subset, by default the square root of the number of features for classification. This extra randomness makes the individual trees more different from one another, and that diversity is precisely what lowers the ensemble's variance further than plain bagging. The main hyperparameter, `n_estimators`, sets the number of trees: more trees generally give a more stable ensemble with diminishing returns, at the cost of more computation.

This snippet also surfaces one of the random forest's most useful by-products: `feature_importances_`. The importance of a feature is the average decrease in impurity it produces across all the nodes that split on it, across all trees, normalised to sum to one. On the Iris data the result is striking and matches the lecture exactly — petal length and petal width score around 0.44 and 0.42 respectively, together accounting for roughly eighty-six percent of the predictive power, while the sepal measurements are nearly worthless. This is feature importance for free, and it is one reason random forests are so often the first model people try.

## 6.4 AdaBoost

*Boosting takes a different route to a strong learner: train models in sequence, each one fixing the last one's mistakes.*

Boosting is the second great family of ensembles, and its philosophy is sequential rather than parallel. Each predictor is trained to correct the errors of the one before it. AdaBoost does this by re-weighting the training instances.

```python
from sklearn.ensemble import AdaBoostClassifier

ada_clf = AdaBoostClassifier(
    DecisionTreeClassifier(max_depth=1),
    n_estimators=30, learning_rate=0.5, random_state=42)
ada_clf.fit(X_train, y_train)
```

The base estimator is a `DecisionTreeClassifier(max_depth=1)` — a *decision stump*, a tree with a single decision and two leaves, and AdaBoost's default weak learner. The mechanism the lecture describes is this: after each stump is trained, the instances it misclassified have their weights boosted, so the next stump pays more attention to them; the process repeats, each predictor focusing on the residual hard cases. The hyperparameters are `n_estimators`, the number of stumps chained together — thirty here — and `learning_rate`, which scales each predictor's contribution. A lower learning rate shrinks each stump's influence, typically requiring more estimators but generalising more gently; if the ensemble overfits, the lecture's advice is to reduce the number of estimators or regularise the base learner more strongly. One structural consequence to note: because boosting is sequential, it cannot be parallelised across machines the way bagging can.

## 6.5 Gradient boosting, built by hand

*Instead of re-weighting instances, gradient boosting fits each new model to the leftover errors of the last.*

Gradient boosting is the other major boosting method, and the clearest way to understand it is to build it manually, as the lecture does. Rather than re-weighting instances, each new tree is trained on the *residual errors* — the part of the target the previous trees got wrong.

```python
from sklearn.tree import DecisionTreeRegressor

tree_reg1 = DecisionTreeRegressor(max_depth=2)
tree_reg1.fit(X, y)

y2 = y - tree_reg1.predict(X)            # residuals of tree 1
tree_reg2 = DecisionTreeRegressor(max_depth=2)
tree_reg2.fit(X, y2)

y3 = y2 - tree_reg2.predict(X)           # residuals of tree 2
tree_reg3 = DecisionTreeRegressor(max_depth=2)
tree_reg3.fit(X, y3)

y_pred = sum(tree.predict(X_new)
           for tree in (tree_reg1, tree_reg2, tree_reg3))
```

Follow the logic line by line. The first tree fits the data and makes errors. We compute those errors as residuals, `y2 = y - tree_reg1.predict(X)`, and train a second tree to predict *them*. Its leftover errors become `y3`, and a third tree fits those. The final prediction is the *sum* of all three trees' outputs — each tree adds a correction on top of the previous ones. This is the essence of gradient boosting laid bare: a sequence of models, each patching the residual of the ensemble so far.

## 6.6 Gradient boosting, automated, with early stopping

*The built-in class does the residual loop for you — and adds the controls that make it generalise well.*

```python
from sklearn.ensemble import GradientBoostingRegressor

gbrt = GradientBoostingRegressor(max_depth=2, n_estimators=3, learning_rate=1.0)
gbrt.fit(X, y)

# better generalisation: small learning_rate + many trees + early stopping
gbrt_best = GradientBoostingRegressor(
    max_depth=2, learning_rate=0.05,
    n_estimators=500, n_iter_no_change=10)
gbrt_best.fit(X, y)
gbrt_best.n_estimators_   # e.g. 92 (stopped early)
```

`GradientBoostingRegressor` automates the manual residual-fitting loop from the previous section. The hyperparameters are where the real lesson lives. `learning_rate` is a *shrinkage* factor that scales the contribution of each tree: a low learning rate, such as 0.05, means each tree corrects only a little, so you need many trees — but the result generalises better. This is the recommended recipe the lecture states outright: a small learning rate, a large number of estimators, and early stopping. A high learning rate with too few trees, by contrast, risks underfitting. The `n_iter_no_change` parameter enables *early stopping*: training halts automatically once the validation score stops improving for that many rounds. That is why the second model, despite being allowed up to five hundred trees, stops itself at around ninety-two — it found the sweet spot and quit before overfitting. Set `n_iter_no_change` too low and you stop prematurely and underfit; too high and you waste effort and risk overfitting.

## 6.7 Stacking

*Why settle for a fixed voting rule when you can train a model to learn the best way to combine the others?*

Stacking is the most sophisticated ensemble in the course. Instead of combining base predictions with a fixed rule like majority vote, it trains an additional model — the *blender* — to learn how best to combine them.

```python
from sklearn.ensemble import StackingClassifier

stacking_clf = StackingClassifier(
    estimators=[
        ('lr',  LogisticRegression()),
        ('rf',  RandomForestClassifier()),
        ('svc', SVC(probability=True))
    ],
    final_estimator=RandomForestClassifier(),
    cv=5)
stacking_clf.fit(X_train, y_train)
```

The `estimators` are the base models, and the `final_estimator` is the blender that takes their predictions as its inputs and learns the aggregation. The critical hyperparameter is `cv=5`, and the lecture is careful about why it is there. The base models generate their predictions for the blender using five-fold cross-validation, so that the blender is trained on *out-of-fold* predictions — predictions made on data the base models did not see during training. This prevents the blender from being fed over-optimistic inputs and learning to trust models that were merely memorising. Once the blender is trained, the base models are refit on the full training set. Stacking is the natural culmination of the ensemble chapter: from a fixed vote, to a learned combination.

---

# Chapter 7 — Dimensionality reduction

High-dimensional data is slow to train on and hard to reason about — the course calls this the curse of dimensionality. This chapter is about compressing data down to its most informative directions, both to speed up learning and to make it visualisable.

## 7.1 PCA from scratch, via SVD

*Principal Component Analysis finds the directions along which the data varies most, and keeps those.*

Principal Component Analysis is a linear technique that finds the hyperplane closest to the data and projects onto it. Its guiding principle, as the lecture states, is to find the projection that preserves as much of the data's variance as possible. The first principal axis points along the direction of largest variance, the second is orthogonal to it with the next largest variance, and so on. The mathematical tool that finds these axes is the Singular Value Decomposition.

```python
X_centered = X - X.mean(axis=0)          # PCA needs centred data
U, s, Vt = np.linalg.svd(X_centered)
c1 = Vt.T[:, 0]                          # 1st principal axis
c2 = Vt.T[:, 1]                          # 2nd principal axis
```

The first line embodies a rule you must never skip: PCA requires *centred* data, because it measures variance about the mean, so we subtract the mean of each feature first. SVD then factorises the centred matrix as `X = U·Σ·Vᵀ`, and the principal axes are the columns of V. There is a practical gotcha the lecture flags explicitly: `np.linalg.svd` returns Vᵀ — already transposed — so to recover the columns of V you transpose it back with `Vt.T`, and then the first column is the first principal axis, the second column the second, and so on. This is PCA stripped to its mathematical core, before any library convenience.

## 7.2 PCA the easy way, and choosing how many dimensions to keep

*Scikit-learn wraps all of that into two lines — and can even choose the number of dimensions for you.*

```python
from sklearn.decomposition import PCA

pca = PCA(n_components=2)
X2D = pca.fit_transform(X)
pca.explained_variance_ratio_       # array([0.84248607, 0.14631839])

# keep 95% of the variance automatically:
pca = PCA(n_components=0.95)
X_reduced = pca.fit_transform(X)
```

The first use sets `n_components=2` to project the data onto its two leading principal components. The attribute `explained_variance_ratio_` then tells you the fraction of the data's total variance each component preserves — in this example about eighty-four percent and fifteen percent, so the two together capture almost everything and the discarded third dimension held barely over one percent. The second use shows the trick the lecture singles out as especially convenient: passing a float between zero and one, such as `0.95`, tells PCA to keep *just enough* components to preserve that fraction of the variance, rather than a fixed count. On MNIST this is dramatic — preserving ninety-five percent of the variance compresses seven hundred and eighty-four features down to about one hundred and fifty-four, discarding only five percent of the variance while making downstream models far faster to train. So `n_components` is the key control: an integer fixes the number of dimensions, while a fraction fixes the amount of information retained and lets the algorithm choose the count.

## 7.3 Kernel PCA

*The kernel trick returns — this time to unroll data that ordinary PCA cannot.*

Ordinary PCA is linear, so it cannot unfold data that is curved or twisted in its feature space. Kernel PCA brings back the kernel trick from the SVM chapter, using it to perform a *nonlinear* projection.

```python
from sklearn.decomposition import KernelPCA

kernel_pca = KernelPCA(n_components=2, kernel="rbf", gamma=10,
                       fit_inverse_transform=True, alpha=0.1)
X_reduced = kernel_pca.fit_transform(X_train)
```

The lecture motivates this with concentric circles — an inner ring and an outer ring that no straight projection can separate, but which kernel PCA can unroll into a separable arrangement. The `kernel="rbf"` setting selects the Gaussian radial basis function kernel, which implicitly maps the data into a high-dimensional space where a linear projection becomes meaningful. The `gamma` hyperparameter controls the reach of that RBF kernel — how far the influence of each point extends — and tuning it changes the shape of the resulting embedding. The takeaway the lecture wants you to hold: the kernel trick is not just an SVM idea; it is a general device for turning a linear method into a nonlinear one, and PCA is the second place we see it work.

## 7.4 t-SNE

*When the goal is simply to see your data, t-SNE lays out high-dimensional points in two dimensions so that similar things sit together.*

```python
from sklearn.manifold import TSNE

tsne = TSNE(n_components=2, init="random",
            learning_rate="auto", random_state=42)
X_reduced = tsne.fit_transform(X_sample)
```

t-SNE is a visualisation technique. Its objective, as the lecture frames it, is to keep similar instances close together and dissimilar instances far apart in the low-dimensional map — and it is used almost exclusively for visualisation, such as projecting MNIST's seven hundred and eighty-four dimensions down to a two-dimensional scatter where each digit class forms its own visible cluster. The `n_components` is set to two precisely because the point is to plot it. The most important practical caveat the lecture gives is that t-SNE is *slow*, so you run it on a subset of the data rather than the full set — note the snippet operates on `X_sample`, not the whole training set. Unlike PCA, t-SNE is not meant as a preprocessing step for a downstream model; it is a lens for the human eye.

---

# Chapter 8 — Unsupervised learning: clustering

Finally we drop labels entirely. Clustering algorithms find structure in data on their own — grouping similar instances, helping us label data cheaply, and even detecting anomalies. The chapter contrasts two very different notions of what a cluster is.

## 8.1 k-Means

*k-Means groups data around a chosen number of centres, refining them until they settle.*

k-Means is the course's centroid-based clustering algorithm. You tell it how many clusters to find, and it iterates a simple loop: assign each point to its nearest centroid, then move each centroid to the mean of the points assigned to it, and repeat until the centroids stop moving.

```python
from sklearn.cluster import KMeans
from sklearn.datasets import make_blobs

X, y = make_blobs(...)            # 2D blobs, 5 clusters
k = 5
kmeans = KMeans(n_clusters=k, random_state=42)
y_pred = kmeans.fit_predict(X)

kmeans.cluster_centers_           # the k centroid coordinates
kmeans.inertia_                   # sum of squared distances (lower = tighter)
```

The lecture guarantees this loop converges, because the mean squared distance between points and their centroids decreases at every step and cannot go below zero. After fitting, `cluster_centers_` gives the centroid coordinates and `inertia_` gives the sum of squared distances from each point to its assigned centroid — a measure of how tight the clusters are, where lower is better.

The defining hyperparameter is `n_clusters`, the value k that you must choose in advance, and the lecture is emphatic about how to choose it well. You might think to just minimise inertia, but inertia always falls as k rises — more clusters always fit tighter — so minimising it naively just drives k upward without bound. The recommended tool is instead the *silhouette score*, which measures how well each point sits inside its own cluster compared to the nearest other cluster, ranging from minus one to plus one, with higher being better. The lecture's guidance to carry forward: pick k using the silhouette score, not by minimising inertia, because the inertia "elbow" can be misleading.

## 8.2 Semi-supervised learning with cluster representatives

*Clustering can make a tiny labelling budget go a remarkably long way.*

One of the most practical uses of clustering is stretching a small labelling budget. Suppose you can only afford to hand-label fifty digits. Labelling fifty *random* digits is wasteful; labelling fifty well-chosen *representatives* is far better.

```python
k = 50
kmeans = KMeans(n_clusters=k, random_state=42)
X_digits_dist = kmeans.fit_transform(X_train)            # 1400 x 50
representative_digit_idx = np.argmin(X_digits_dist, axis=0)
X_representative_digits = X_train[representative_digit_idx]
```

The idea is elegant. We cluster the training data into fifty groups, and `fit_transform` returns, for every instance, its distance to each of the fifty centroids. Then `np.argmin` along the instance axis finds, for each cluster, the single instance *closest* to its centroid — the most typical, most representative example of that group. We hand-label just those fifty representatives. The lecture's results make the case dramatically: a model trained on fifty random labels reaches about seventy-five percent accuracy, but the same budget spent on these fifty cluster representatives jumps to roughly eighty-five percent — and propagating those labels through the clusters pushes it higher still. The lesson is that *which* examples you label matters as much as how many, and clustering tells you which ones are worth your attention.

## 8.3 DBSCAN

*A completely different idea of a cluster: not a centre, but a dense, connected region of any shape.*

DBSCAN is the course's density-based clustering algorithm, and it stands in sharp contrast to k-Means. It does not assume round clusters or even ask you for their number; it finds dense regions of any shape and labels sparse points as anomalies.

```python
from sklearn.cluster import DBSCAN
from sklearn.datasets import make_moons

X, y = make_moons(n_samples=1000, noise=0.05)
dbscan = DBSCAN(eps=0.05, min_samples=5)
dbscan.fit(X)

dbscan.labels_                 # cluster id per point, -1 = anomaly
dbscan.core_sample_indices_    # indices of the core instances
```

DBSCAN works by counting neighbours. For each point it looks within a radius and asks how many other points fall inside; if there are enough, the point is a *core instance* sitting in a dense region, and chains of neighbouring core instances link up into a single cluster of arbitrary shape. The two hyperparameters carry the whole behaviour. `eps` is the neighbourhood radius, and `min_samples` is how many neighbours a point needs to qualify as a core instance. Points that belong to no dense region are labelled `-1`, which DBSCAN treats as an anomaly — anomaly detection comes built in.

The effect of `eps` is worth dwelling on, because the lecture quantifies it precisely. On the thousand-point moons dataset, an `eps` of 0.05 leaves eighty-four points stranded as anomalies, but raising `eps` to 0.20 brings that count to zero — a larger radius grows every neighbourhood, so more points reach the density threshold and join clusters. The trade-off, as the lecture warns, is that too large an `eps` can wrongly merge clusters that should stay separate. So `eps` is the dial between "many anomalies, fragmented clusters" and "no anomalies, possibly over-merged clusters."

## 8.4 Predicting new points with DBSCAN

*DBSCAN has a surprising gap — and the fix reuses a model from much earlier in the course.*

```python
from sklearn.neighbors import KNeighborsClassifier

knn = KNeighborsClassifier(n_neighbors=50)
knn.fit(dbscan.components_, dbscan.labels_[dbscan.core_sample_indices_])

X_new = np.array([[-0.5, 0], [0, 0.5], [1, -0.1], [2, 1]])
knn.predict(X_new)            # array([1, 0, 1, 0])
```

This snippet addresses a quirk the lecture points out: DBSCAN has no `predict` method of its own, so it cannot directly assign a brand-new point to a cluster. The workaround is a neat piece of model composition that ties the course together. We take DBSCAN's *core samples* — exposed as `components_` — and their cluster labels, and we train a k-Nearest Neighbours classifier on them. That k-NN, the very instance-based model from Chapter 3, can then classify new points into DBSCAN's clusters. It is a fitting place to end the walkthrough: the unsupervised algorithm finds the structure, and a supervised model learned earlier in the course is borrowed to extend it to new data. The whole syllabus, in a sense, cooperating in four lines.

---

## Closing the loop

Trace the arc one more time. We began with a single weighted sum and its sign, and learned to distrust raw accuracy. We added the optimisation engine — gradient descent — and used it to fit regression and logistic regression. We tamed overfitting with regularisation and met the model that simply remembers. We widened margins with SVMs and bent space with kernels. We asked informative questions with decision trees, then discovered that a *crowd* of trees, whether bagged, randomised, or boosted, beats any single one. We compressed high-dimensional data down to its most meaningful directions, and finally found structure with no labels at all. Each model in CITS5508 answers a limitation of the last — and that, more than any single algorithm, is the story this code tells.
