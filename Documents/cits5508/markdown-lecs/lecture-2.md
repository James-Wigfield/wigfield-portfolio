# CITS5508 Machine Learning: Overview of a Machine Learning Project 
**Instructor:** Marcell Szikszai 
**Year:** 2026 
**University:** The University of Western Australia 

---

## 1. Overview and Reading Materials
This lecture covers the continuation of the simple learning model, an overview of an end-to-end machine learning project, performance measures, and multiclass classification. 

### Recommended Reading
* **Textbook:** *Hands-on Machine Learning with Scikit-Learn, Keras & TensorFlow* (2nd Edition) by Aurélien Géron, O'Reilly Media, 2022.
* **Chapters:** Chapter 2 (End-to-End Machine Learning Project) and Chapter 3 (Classification).
* **Resources:** Available online through UWA OneSearch. Example code and exercise solutions are available on the book's GitHub repository.

---

## 2. Recap: Supervised Learning and Simple Models
Machine learning algorithms automate constructing a model that identifies relationships between input features and target variables.
* A target function exists: $f:\mathcal{X}\rightarrow\mathcal{Y}$, meaning $y=f(x)$.
* The model selects a hypothesis $g\approx f$ from the hypothesis space using labelled input-examples $(x_{1},y_{1}),...,(x_{n},y_{n})$.

### The Simple Learning Model and Bias Trick
The simple model combines a weighted sum of features into a score and compares it to a threshold.
$$h(x)=\text{sgn}\left(\left(\sum_{i=1}^{m}w_{i}x_{i}\right)+b\right)$$ 

By treating the bias $b$ as an initial weight $w_{0}$ and introducing a dummy feature $x_{0}=1$, the model can be simplified. This allows the model to be rewritten as a vector dot product:
$$\text{sgn}\left(\sum_{i=0}^{m}w_{i}x_{i}\right) = \text{sgn}\left(\begin{pmatrix}w_{0}\\ w_{1}\\ \vdots\\ w_{m}\end{matrix}^{T}\begin{pmatrix}1\\ x_{1}\\ \vdots\\ x_{m}\end{matrix}\right)$$ 
$$h(x)=\text{sgn}(w^{T}x)$$ 

### NumPy Vectorisation and Training
* Using NumPy vectorisation (e.g., `np.sign(X @ w)`) eliminates the need for slow `for` loops, drastically reducing execution time.
* The algorithm updates weights when it encounters incorrect classifications. 
* The update rule is $w\leftarrow w+y_{i}x_{i}$ if $y_{i}\ne h(x_{i})$, otherwise the weight remains $w$.

---

## 3. End-to-End Machine Learning Project Steps
A complete machine learning project involves a systematic workflow:
1. Understand the problem and check assumptions (includes business and data understanding).
2. Visualise and explore the data to support problem understanding.
3. Prepare the data for a Machine Learning algorithm.
4. Select a model, train, validate, and fine-tune it.
5. Present the solution.
6. Launch, monitor, and continuously check assumptions.

---

## 4. Performance Measures for Regression
When working with real data like the California housing dataset, selecting an appropriate performance measure is critical. Common options include:

* **Mean Squared Error (MSE):** $MSE(X,h)=\frac{1}{m}\sum_{i=1}^{m}(h(x^{(i)})-y^{(i)})^{2}$ 
* **Mean Absolute Error (MAE):** $MAE(X,h)=\frac{1}{m}\sum_{i=1}^{m}|h(x^{(i)})-y^{(i)}|$ 

*(Note: $X$ is the matrix of feature values, $y^{(i)}$ is the label of the i-th instance, and $h$ is the prediction function.)*

---

## 5. Classification Performance Evaluation
To explore classification, the Modified National Institute of Standards and Technology (MNIST) dataset is used, comprising 70,000 images of handwritten digits where each image has **784** features ($28\times28$). 

A toy binary classification problem evaluates whether an image is a "5" or "not-5". Before training, data is split into a training and test set (e.g., via `train_test_split`) with a `random_state` seed to avoid data snooping bias and ensure reproducibility.

### Why Accuracy is Often Insufficient
Accuracy is the ratio of correct predictions to total predictions. However, in imbalanced datasets, accuracy is misleading. For instance, a custom classifier that strictly predicts "not-5" will still achieve over **90%** accuracy simply because most digits are not 5s.

### The Confusion Matrix, Precision, and Recall
A better evaluation method is the confusion matrix, which counts how often instances of class A are classified as class B.

* **Precision (Positive Predictive Value):** The proportion of positive predictions that are actually correct.
  $$precision=\frac{True~Positives}{True~Positives+False~Positives}$$ 
* **Recall (True Positive Rate or Sensitivity):** The proportion of actual positives that are correctly predicted.
  $$recall=\frac{True~Positives}{True~Positives+False~Negatives}$$ 
* **$F_{1}$ Score:** The harmonic mean of precision and recall, providing a single metric that balances both.
  $$F_{1}=\frac{2}{\frac{1}{precision}+\frac{1}{recall}}$$ 

### Precision/Recall Trade-off
Different applications require prioritizing either precision or recall. 
* Precision is prioritised when false positives are highly costly (e.g., predicting it is safe to change lanes while driving).
* Recall is prioritised when false negatives are highly costly (e.g., diagnosing cancer).

### Receiver Operating Characteristic (ROC) Curve
The ROC curve plots the True Positive Rate (recall) against the False Positive Rate (FPR) across different thresholds. 
* **FPR:** The proportion of negative instances incorrectly classified as positive ($1 - specificity$).
* A high-performing classifier will have a large Area Under the Curve (AUC).

---

## 6. Sampling Bias and Multiclass Classification
* **Sampling Bias:** A model's predictions can fail drastically if the training data is unrepresentative. A historical example is the 1936 US presidential election, where a poll predicted Landon would win due to sampling wealthier individuals, but Roosevelt won with **62%** of the vote.
* **Multiclass Classification:** Designed to discriminate between multiple classes ($N>2$). Algorithms like Softmax Regression, Random Forests, and Naive Bayes handle multiple classes directly, whereas Support Vector Machines are strictly binary and require specific techniques to scale.