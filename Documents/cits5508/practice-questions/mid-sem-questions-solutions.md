# CITS5508 — Mid-semester Test Sample Questions

---

## Question 1. (3 marks)

Explain the difference between supervised learning and unsupervised learning. Give two examples each of supervised and unsupervised learning tasks.

- Supervised learning deals with labelled data. Unsupervised learning uses unlabelled data, and discovers patterns from just a set of features. **[1]**
- Supervised examples: classification, regression. **[1]**
- Unsupervised examples: clustering, anomaly detection. **[1]**

---

## Question 2. (3 marks)

Suppose that you have an $N$-class classification problem. You would like to use a linear model,

$$h(x) = f\left(w^\top x\right),$$

where $f$ is some output function.

What would be a suitable output function for your algorithm if $N = 2$? What would this function be if $N > 2$? Explain how these functions help you use the model for classification.

- $N = 2$ case is binary classification, so sigmoid function $f(t) = \dfrac{1}{1 + \exp(-t)}$. **[1]**
- $N > 2$ case is multiclass classification, so softmax function $f(t)_i = \dfrac{\exp(f_i)}{\sum_{j=1}^{K} \exp(f_j)}$. **[1]**
- They both provide estimates of probability that an instance belongs to a particular class. **[1]**

---

## Question 3. (3 marks)

Explain what feature scaling is, and give an example of how you would scale features for a machine learning model. What could go wrong if feature scaling is not carried out?

- Many ML algorithms do not perform well when the numerical input features have very different scales, so we do feature scaling to transform the data into numbers within ranges which are similar across the different features. **[1]**
- You could scale features with min-max scaling, $x' = \dfrac{x - \min(x)}{\max(x) - \min(x)}$. This can easily be done with `MinMaxScaler` from scikit-learn. **[1]**
- Gradient Descent can be slowed down if the direction of steepest descent is not clear because the shape of a bowl in the cost surface is elongated along one dimension. **[1]**

---

## Question 4. (3 marks)

```python
patience, curr = 10, 0
best_valid_rmse = float('inf')
sgd_reg = SGDRegressor(penalty=None, eta0=0.002, random_state=42)

for epoch in range(max_iter):
    sgd_reg.partial_fit(X_train_prep, y_train)
    y_valid_predict = sgd_reg.predict(X_valid_prep)
    val_error = root_mean_squared_error(y_valid, y_valid_predict)
    if val_error < best_valid_rmse:
        best_valid_rmse = val_error
        best_model = deepcopy(sgd_reg)
        curr = 0
    else:
        curr += 1
        if curr >= patience:
            break
```

Explain the purpose of the above code snippet. Why do we use `partial_fit` instead of `fit`? What is the purpose of the `patience` variable?

- The code implements early stopping for scikit-learn's `SGDRegressor`. **[1]**
- `partial_fit` runs a single epoch of SGD, rather than training until convergence (or `max_iter`). **[1]**
- If we have more than `patience` number of epochs without a performance improvement on the validation set, we break out of the loop and stop further training. **[1]**