# CITS5508 — Machine Learning

**Semester 1 — Sample Exam Solutions**

---

## Question 1.

**(a)**

- We're solving for $x_1$ in $0.5 = \sigma(\theta^\top x)$.
- It's easy to see that $\hat{p} = \frac{1}{2}$ when $\theta^\top x = 0$.
- This means we just need to solve for $0.05 x_1 + 3.5 - 6 = 0$.
- $x_1 = \dfrac{2.5}{0.05} = 50$.
- So the student needs to study for **50 hours**.

**(b)**

- Model has high bias.
- Reduce $\alpha$ to reduce bias (and increase variance).
- Reduce constraint on large weights, allow for a more complex model.

**(c)**

- $x_1,\ x_2$
- $x_1^2,\ x_2^2,\ x_1 x_2$
- $x_1^3,\ x_2^3,\ x_1^2 x_2,\ x_1 x_2^2$

---

## Question 2.

**(a)**

| i | Money | Free | For | Gambling | Fun | Machine | Learning | Spam |
|---|-------|------|-----|----------|-----|---------|----------|------|
| ? | 0     | 1    | 1   | 0        | 0   | 1       | 1        | ?    |

**(b)**

- You can easily eyeball this as closest to instance 5.
- $\sqrt{0^2 + 0^2 + 1^2 + 0^2 + 0^2 + 0^2 + 0^2} = 1$.
- This means we predict as **False** with $k = 1$.

**(c)**

- $i = 1$:

$$\sqrt{(3-0)^2 + (0-1)^2 + (0-1)^2 + (0-0)^2 + (0-0)^2 + (0-1)^2 + (0-1)^2} = \sqrt{13}$$

- $i = 2$:

$$\sqrt{(1-0)^2 + (2-1)^2 + (1-1)^2 + (1-0)^2 + (1-0)^2 + (0-1)^2 + (0-1)^2} = \sqrt{6}$$

- $i = 3$:

$$\sqrt{(0-0)^2 + (0-1)^2 + (1-1)^2 + (1-0)^2 + (1-0)^2 + (0-1)^2 + (0-1)^2} = \sqrt{5}$$

- $i = 4$:

$$\sqrt{(0-0)^2 + (0-1)^2 + (0-1)^2 + (0-0)^2 + (3-0)^2 + (1-1)^2 + (1-1)^2} = \sqrt{11}$$

- $i = 5$:

$$\sqrt{(0-0)^2 + (1-1)^2 + (0-1)^2 + (0-0)^2 + (0-0)^2 + (1-1)^2 + (1-1)^2} = \sqrt{1}$$

- So the closest points are $i = 5$, $i = 3$, $i = 2$ which are (False, True, True). Therefore the majority label is **True**.

---

## Question 3.

**(a)**

- The feature space is the set of all possible input values.
- The parameter space is the set of all possible values the model's parameters can take.
- Hyperparameters are external configurations set before training that govern the learning process.
- Decision Trees: Maximum tree depth
- k-NN: Number of neighbours $k$
- Lasso Regression: Regularisation strength $\alpha$

**(b)**

- **Multiclass:** These are for discriminating between multiple classes ($N > 2$).
  - Identifying handwritten digits
  - Features: greyscale images $X \in \{0, 1, \ldots, 255\}^{n \times m}$ where $n \times m$ is the size of the image.
  - Response variable: $y \in \{0, 1, \ldots, 9\}$.
- **Multilabel:** this is the situation where the classifier needs to output multiple class labels for each instance, with each class label taking on binary values (e.g., "yes"/"no", True/False).
  - Classifying whether several specific faces are present in each group photo
  - Features: images $X \in \{0, 1, \ldots, 255\}^{n \times m \times 3}$ where $n \times m$ is the size of the image.
  - Response variable: $y \in \{0, 1\}^c$.

---

## Question 4.

**(a)**

- A random forest (RF) classifier is an ensemble of decision tree classifiers, each of which involves the construction of a binary tree for multiclass classification.
- Different from the decision tree classifiers, extra randomness is introduced when growing the trees in RF classifiers: instead of searching for the best feature to split a node, the algorithm searches for the best feature among the subset of features that is randomly sampled from all the features.
- Extra-Trees stands for "Extremely Randomized Trees". It is a random forest where even the threshold used for splitting a node is randomly generated.

**(b)**

- Suppose that we have data in an $n$-dimensional space. A $d$-dimensional manifold (where $d < n$) locally looks like a $d$-dimensional hyperplane in the $n$-dimensional space. e.g., for the Swiss roll example, $n = 3$ and $d = 2$.
- Manifold Learning refers to a family of non-linear dimensionality reduction algorithms which work by modelling the manifold that the training instances lie on.
- To reduce the dimension of the Swiss roll data from 3D to 2D, the algorithm learns to unroll the data.

**(c)**

- SVM is a linear binary classification algorithm. We can incorporate a suitable kernel to augment our data to a higher dimensional space, so while SVM produces a linear decision boundary in the new space, it effectively gives a non-linear decision boundary in the original space.
- However, we don't actually need to do this augmentation. When solving for the equation of the hyperplane in SVM, we can tackle the dual problem (instead of the primal problem) which involves computing the dot product of each pair of data vectors ($x_i \cdot x_j$).
- Suppose that we use a 2nd order polynomial kernel $\phi$. We can equally compute $(x_i \cdot x_j)^2$ rather than $\phi(x_i) \cdot \phi(x_j)$. This is known as the Kernel Trick in that the SVM operates on a higher-dimensional space but we actually never need to augment our data to that space.

**(d)**

- Both Bagging and Pasting are sampling techniques. The former is sampling with replacement and the latter is sampling without replacement.
- They are commonly used in the category of ensemble methods where, rather than having a diverse set of algorithms, we train the same algorithm (typically, a decision tree algorithm) using randomly sampled data.
- These methods are popular because: 1. the predictors can be trained in parallel using different CPUs, or GPUs or even on different servers. 2. the predictors can be tested also in parallel.

**(e)**

- **Supervised Learning:** the training data that you feed to the algorithm includes the desired output solutions, called the labels.
  - Training a SPAM filter to classify emails into SPAM and non-SPAM
- **Unsupervised Learning:** the training data is unlabelled so the tasks that we can do is to learn if the data contains certain patterns or forms a number of clusters.
  - Using k-means clustering to reveal the clusters formed by the data

---

## Question 5.

**(a)**

- SVMs fit the widest possible "street" (hyperplane) between the classes (large margin classification).
- The margin is the distance between the hyperplane and the closest data point.
- The support vectors are the training instances that lie exactly on the margin.
- Only the support vectors are relevant for defining the decision boundary.
- The decision boundary is just defined by $\hat{y} = w^\top x + b$, where the weights and bias are learned during training.

**(b)**

```python
alphas = [0.001, 0.01, 0.1, 1, 10]
param_grid = {'alpha': alphas}
grid_search = GridSearchCV(Ridge(), param_grid, cv=3, refit=True)
grid_search.fit(X_train_scaled, y_train)

best_alpha = grid_search.best_params_['alpha']
print('Best alpha:', best_alpha)

y_pred = grid_search.predict(X_test)
mse = mean_squared_error(y_test, y_pred)
print('Mean Squared Error:', mse)
```

**(c)**

- This is a way of using binary classification techniques in a combined way to do multi-class classification.
- For the OvO strategy, you train a binary classifier to distinguish between each pair of classes.
- There are $n(n-1)/2$ binary classifiers for $n$ classes.
- When you want to make a prediction on a new data instance you run it through all the classifiers and see which class wins the most duels.

---

**END OF EXAMINATION PAPER**