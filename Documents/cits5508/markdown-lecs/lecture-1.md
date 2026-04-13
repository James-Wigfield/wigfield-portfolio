# CITS5508 Machine Learning: Introduction to Machine Learning
**Instructor:** Marcell Szikszai 
**Year:** 2026 
**University:** The University of Western Australia 

---

## 1. Overview and Reading Materials
### The Machine Learning Landscape
This lecture introduces the foundational concepts of Machine Learning (ML). The core topics covered include:
* What ML is and why it is used.
* Types of ML systems.
* Main challenges in ML.
* Testing and validating models.

### Recommended Reading
* **Textbook:** *Hands-on Machine Learning with Scikit-Learn, Keras & TensorFlow* (2nd Edition) by Aurélien Géron, O'Reilly Media, 2022.
* **Chapter:** Chapter 1 - The Machine Learning landscape.
* **Resources:** Available online through UWA OneSearch. Example code is hosted on GitHub.

---

## 2. What is Machine Learning?
Machine Learning algorithms are tools for the automatic acquisition of knowledge. It is also known as inductive learning, which is a form of logical inference that obtains generic conclusions from a particular set of examples. 

* **Arthur Samuel (1959):** "Machine Learning is the field of study that gives computers the ability to learn without being explicitly programmed." 
* **Tom Mitchell (1997):** "A computer program is said to learn from experience E with respect to some task T and some performance measure P, if its performance on T, as measured by P, improves with experience E." 

### Example: Spam Filter
* **Experience (E):** Examples of spam emails (flagged by users) and regular/non-spam emails.
* **Task (T):** Decide if a new email is spam or not.
* **Performance Measure (P):** How good the filter is at identifying new emails correctly. In this case, accuracy (the ratio of correctly classified emails) is a common metric.
* **Data Structure:** Each example is described by a feature vector and an associated label. The goal is to construct a classifier that correctly assigns labels to new unlabelled examples.

---

## 3. Types of Machine Learning Systems
ML systems can be categorised based on their training supervision, ability to learn incrementally, and generalization approach.

### A. Supervised vs. Unsupervised Learning
**Supervised Learning:**
* The learning algorithm uses a data set with both descriptive features (attributes) and a target feature (label).
* **Classification:** The target variable is typically a nominal label set. Example: Approving or denying a credit card.
* **Regression:** The target variable is a real value.
* **Common Algorithms:** Linear Regression, Logistic Regression, k-Nearest Neighbors, Support Vector Machines (SVMs), Decision Trees, and Random Forests.

**Unsupervised Learning:**
* The training data is unlabelled.
* **Clustering:** e.g., k-means, DBSCAN, Hierarchical Cluster Analysis (HCA).
* **Visualization & Dimensionality Reduction:** e.g., PCA, LLE, t-SNE.
* **Association Rule Learning:** e.g., Apriori, Eclat.
* **Anomaly Detection:** Learning what "normal" data looks like to detect abnormal instances.

### B. Instance-based vs. Model-based Learning
* **Instance-based learning:** The system "memorises" the training examples and generalizes to new cases by using a similarity measure.
* **Model-based learning:** The system builds a mathematical model from the training examples and uses it to make predictions on new data.

---

## 4. Formal Definitions and Mathematical Notations
In supervised learning, the data and models are formally defined as follows:

* **Data Set ($D$):** Composed of $n$ examples and $m$ attributes.
* **Example:** Denoted as an $m$-dimensional tuple $D_{i} = (x_{i1}, x_{i2}, ..., x_{im}, y_{i}) = (\vec{x_{i}}, y_{i})$.
* **Target Function ($f$):** The ideal unknown function $f: \mathcal{X} \rightarrow \mathcal{Y}$, where $\mathcal{X}$ is the input space and $\mathcal{Y}$ is the output space.
* **Learning Model ($g$):** The algorithm searches a hypothesis space $\mathcal{H}$ to find a function $g: \mathcal{X} \rightarrow \mathcal{Y}$ that approximates $f$.

### Simple Classification Model (Linear Model)
Consider $\mathcal{X} = \mathbb{R}^{m}$ (m-dimensional Euclidean space) and $\mathcal{Y} = \{-1, +1\}$ (binary classification). The model applies weights $(w_{1}, w_{2}, ..., w_{m})$ to the coordinates of $\vec{x}$.

The model makes decisions based on a threshold:
$$\sum_{i=1}^{m}w_{i}x_{i} > -b$$ 

This hypothesis $h(\vec{x})$ can be rewritten using the sign function:
$$h(\vec{x}) = \text{sgn}\left(\left(\sum_{i=1}^{m}w_{i}x_{i}\right) + b\right)$$ 

Where the sign function is defined as:
$$\text{sgn}~x := \begin{cases}-1 & \text{if}~x<0,\\ +1 & \text{if}~x>0.\end{cases}$$ 

---

## 5. Main Challenges of Machine Learning
The success of an ML system is heavily dependent on data quality and model complexity. Primary challenges include:
* Insufficient quantity of training data.
* Non-representative or poor-quality data.
* Irrelevant features.
* **Overfitting or underfitting:** A model must be neither too simple (underfitting, e.g., Degree 1 polynomial) nor too complex (overfitting, e.g., Degree 15 polynomial) to generalize well.

---

## 6. Testing and Validation
To evaluate performance and ensure the model generalizes to new data:
* **Train/Test Split:** Data is typically split into a training set (e.g., 80%) and a test set (e.g., 20%).
* **Generalisation Error:** The error rate measured on the test set is called the generalisation error (or out-of-sample error).
* **Validation Set:** Because using the test set to pick hyperparameter values can cause the model to overfit the test data, a separate validation set is required.