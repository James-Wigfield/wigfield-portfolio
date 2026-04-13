# CITS5508 Machine Learning: Regularised Linear Models and k-Nearest Neighbours
**Instructor:** Marcell Szikszai 
**Year:** 2026 
**University:** The University of Western Australia 

---

## 1. Overview and Reading Materials
This lecture continues exploring how Machine Learning algorithms work, focusing on model tuning, regularisation, and instance-based learning. 

### Topics Covered
* The Bias/Variance tradeoff 
* Cross-validation and Grid-search 
* Early Stopping 
* Regularised Linear Models 
* Softmax Regression 
* k-Nearest Neighbours (k-NN) algorithm 

### Recommended Reading
* **Textbook:** *Hands-on Machine Learning with Scikit-Learn, Keras & TensorFlow* (2nd Edition) by Aurélien Géron.
* **Chapter:** Chapter 4 - Training Models.
* **Resources:** Available online through UWA OneSearch. Example code can be found at `handson-m13/04_training_linear models.ipynb`.

---

## 2. The Bias/Variance Tradeoff
A model's generalisation error can be expressed as the sum of three different errors: Bias, Variance, and Irreducible error. Increasing a model's complexity will typically increase its variance and reduce its bias, whereas reducing complexity increases bias and reduces variance.

* **Bias:** The amount by which the expected model predictions differ from the true value or target over the training data. It is due to wrong assumptions, such as assuming data is linear when it is quadratic. High-bias algorithms tend to be less flexible, have stronger assumptions, and tend to underfit the data.
* **Variance:** This part of the error is due to the model's excessive sensitivity to small variations in the training data. High-variance algorithms are very flexible, have weaker assumptions, and may account for every single training example, which leads to overfitting.
* **Irreducible Error:** Typically due to the natural variability of the data itself.

### Underfitting (High Bias)
Underfitting occurs when the model is too simple to learn the underlying structure of the data.
* **Solutions:** Select a more powerful model with more parameters ; feed better features to the learning algorithm ; reduce constraints on the model (e.g., reduce the regularisation hyperparameter). ML models with higher variance may also help.

### Overfitting (High Variance)
Overfitting occurs when the model is strongly influenced by the specifics of the training data.
* **Solutions:** Get more training data if it comes from the same data-generating mechanism ; use k-fold cross-validation to assess performance on multiple subsets ; reduce the dimensionality using feature selection or dimensionality reduction ; increase the constraints on the model via regularisation.

---

## 3. Fine-Tuning and Cross-Validation
A hyperparameter is a parameter of a learning algorithm, not the model itself. It is not affected by the learning algorithm, must be set prior to training, and remains constant during the training process. 
* Examples include the value $k$ in k-NN, polynomial regression degree, regularisation hyperparameters, and logistic regression thresholds.

### k-Fold Cross-validation
Because using the test set to pick the best hyperparameter values makes the model perform poorly on new data, a validation set is required.
* The training set is split into $k$ subsets (folds). 
* Multiple models are trained with various hyperparameters on the reduced training set (the full set minus the validation fold). 
* The model is trained and validated $k$ times using different combinations of these sets.
* Scikit-Learn's `GridSearchCV` or `RandomizedSearchCV` (for large search spaces) can be used to find good hyperparameter combinations via cross-validation.
* After validation, the best model is trained on the full training set (including validation data) to produce the final model. 
* The final model is evaluated on the test set to estimate generalisation error.

### Early Stopping
For iterative learning algorithms like Gradient Descent, early stopping is used to regularise the model by stopping training as soon as the validation error reaches a minimum.

---

## 4. Regularised Linear Models
Regularisation reduces overfitting by constraining the model; fewer parameters make it harder to overfit the data. Linear models are typically regularised by constraining their weights.

### Ridge Regression
Ridge Regression is a regularised version of Linear Regression using a squared $l_{2}$ penalty. The regularisation term should only be added to the cost function during training.
$$J(\theta) = MSE(\theta) + \alpha\sum_{i=1}^{n}\theta_{i}^{2}$$
* $\alpha$ is the regularisation coefficient. It forces the algorithm to fit the data while keeping weights as small as possible.

### Lasso Regression
Lasso Regression uses an $l_{1}$ penalty instead of the squared term.
$$J(\theta) = MSE(\theta) + \alpha\sum_{i=1}^{n}|\theta_{i}|$$

### Elastic Net
Elastic Net acts as a middle ground between Ridge and Lasso by combining both regularisation terms. It uses hyperparameters $\alpha$ and $r$.
$$J(\theta) = MSE(\theta) + r\alpha\sum_{i=1}^{n}|\theta_{i}| + \frac{1-r}{2}\alpha\sum_{i=1}^{n}\theta_{i}^{2}$$

---

## 5. Softmax Regression
Softmax Regression (or Multinomial Logistic Regression) generalizes Logistic Regression to directly support multiple classes. 

* **Prediction:** Given an instance $x$, it computes a score $s_{k}(x) = (\theta^{(k)})^{T}x$ for each class $k$.
* **Probability Estimation:** It applies the normalized exponential (softmax function) to estimate the probability $\hat{p}_{k}$.
$$\hat{p}_{k} = \sigma(s(x))_{k} = \frac{exp(s_{k}(x))}{\sum_{j=1}^{K}exp(s_{j}(x))}$$
* **Class Assignment:** It predicts the class with the highest estimated probability (highest score).
$$\hat{y} = arg~max_{k}\sigma(s(x))_{k} = arg~max~s_{k}(x) = arg~max((\theta^{(k)})^{T}x)$$
* **Cost Function:** The objective is to estimate a high probability for the target class and low probabilities for others. $y_{k}^{(i)}$ is the target probability (1 if it belongs to the class, 0 otherwise).
$$J(\theta) = -\frac{1}{m}\sum_{i=1}^{m}\sum_{k=1}^{K}y_{k}^{(i)}log(\hat{p}_{k}^{(i)})$$

---

## 6. k-Nearest Neighbours (k-NN)
The k-NN algorithm is an instance-based learning method, meaning a model is not explicitly learned. It assumes similar instances will be closer to each other in the feature space, utilizing a distance metric.

* **Distance Metrics:** The Minkowski distance is used to calculate the distance between instances $x_{i}$ and $x_{j}$. 
$$D(x_{i},x_{j}) = \left(\sum_{l=1}^{n}abs(x_{i}[l] - x_{j}[l])^{p}\right)^{1/p}$$
If $p=1$ it is Manhattan distance, and if $p=2$ it is Euclidean distance.
* **Majority Vote ($k>1$):**
$$\hat{y_{q}} = arg~max_{c\in C}\sum_{i=1}^{k}\delta(c_{i},c)$$
where $\delta(a,b)=1$ if $a==b$ and $\delta(a,b)=0$ if $a\ne b$.
* **Distance-Weighted k-NN:** Weights the contribution of each neighbour by its distance.
$$\hat{y_{q}} = arg~max_{c\in C}\sum_{i=1}^{k}w_{i}\delta(c_{i},c)$$
where $w_{i} = \frac{1}{d(x_{q},x_{i})^{2}}$.

### k-NN Characteristics & Tradeoffs
* **Pros & Cons:** It is simple and intuitive but memory-intensive and expensive during testing or prediction. It requires a meaningful distance metric and is negatively affected by noise and outliers.
* **Choosing $k$:** Small values of $k$ risk overfitting, while higher values risk underfitting. High values of $k$ tend to favour the majority class, making it unsuitable for imbalanced datasets.
* **Feature Normalisation:** Essential because larger scale features will have a disproportionately large influence.

---

## 7. Advanced Classification Types
* **Multiclass Classification:** Discriminating between multiple classes ($N>2$). Softmax, Random Forests, and Naive Bayes handle this directly. Binary classifiers (like SVMs) can be adapted using One-versus-All (OvA) or One-versus-One (OvO) strategies.
* **Multilabel Classification:** Outputs multiple class labels for each instance, where each label takes binary values (e.g., classifying multiple specific faces in a photo).
* **Multioutput-Multiclass Classification:** A generalisation of multilabel classification where each label can take on more than two possible values. Example: removing noise from an image where each pixel is a label capable of taking 256 different intensity values.