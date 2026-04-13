# CITS5508 Machine Learning: Support Vector Machines
**Instructor:** Marcell Szikszai
**Year:** 2026
**University:** The University of Western Australia 

---

## 1. Overview and Reading Materials
This lecture introduces Support Vector Machines (SVMs), explaining their core concepts, how they work under the hood, and how to use them for both classification and regression. 

### Recommended Reading
* **Textbook:** *Hands-on Machine Learning with Scikit-Learn, Keras & TensorFlow* (2nd Edition) by Aurélien Géron, O'Reilly Media, 2022. 
* **Chapter:** Chapter 5 - Support Vector Machines. 

---

## 2. Introduction to Support Vector Machines
A Support Vector Machine (SVM) is a versatile machine learning model capable of providing both linear and nonlinear decision boundaries. 
* **Applications:** They are used for binary classification and regression tasks.
* **Best Use Cases:** They are particularly well-suited for the classification of complex but small to medium-sized datasets.


---

## 3. Linear SVM Classification
### Large Margin Classification
You can conceptualize a linear SVM classifier as fitting the widest possible "street" (represented by parallel dashed lines) between two classes. This approach is called *large margin classification*. 
* Adding more training instances "off the street" does not affect the decision boundary at all.
* The boundary is fully determined (or "supported") exclusively by the instances located on the edge of the street, which are known as *support vectors*.

### Sensitivity to Scale
SVMs are highly sensitive to feature scales. Applying feature scaling (e.g., using Scikit-Learn's `StandardScaler`) significantly improves the decision boundary. 
* **Important Rule:** You should only fit the scalers using the training set and then use those estimated parameters to transform your validation and test sets.

### Hard Margin vs. Soft Margin Classification
* **Hard Margin Classification:** This strictly imposes that all instances must be off the street and on the correct side of the decision boundary. It only works if the data is linearly separable and is extremely sensitive to outliers.
* **Soft Margin Classification:** This provides a more flexible model by finding a good balance between keeping the street as large as possible and limiting margin violations (instances ending up on the street or on the wrong side).
  * The hyperparameter $C$ defines this trade-off.
  * A **small** $C$ leads to a wider street but more margin violations.
  * A **large** $C$ leads to a narrower street but fewer margin violations.

---

## 4. Nonlinear SVM Classification
Many datasets are not linearly separable. To handle nonlinear datasets, you can add more features, such as polynomial features, which can sometimes result in a linearly separable dataset.

### The Kernel Trick
Adding many polynomial features can make model training very slow. SVMs leverage a mathematical technique called the *kernel trick*, making it possible to obtain a similar result as if you had added many polynomial or similarity features without actually having to compute them.


### Adding Similarity Features
Another approach to nonlinear problems is adding features computed via a similarity function. This measures how much an instance resembles a specific landmark. 
* **Gaussian Radial Basis Function (RBF):** $\phi_{\gamma}(x,l) = \text{exp}(-\gamma||x - l||^{2})$. 
* Using the Gaussian RBF kernel via the kernel trick achieves similar results without the massive computational cost.

---

## 5. Computational Complexity

| Class | Time complexity | Out-of-core support | Scaling required | Kernel trick |
| :--- | :--- | :--- | :--- | :--- |
| **LinearSVC** | $O(m \times n)$ | No | Yes | No |
| **SVC** | $O(m^{2} \times n)$ to $O(m^{3} \times n)$ | No | Yes | Yes |
| **SGDClassifier** | $O(m \times n)$ | Yes | Yes | No |
*Information from Scikit-Learn SVM Classes* 

* `LinearSVC` implements an optimized algorithm for linear SVMs that scales almost linearly with the number of training instances ($m$) and features ($n$).
* `SVC` supports the kernel trick but gets dreadfully slow as the number of training instances gets large due to its cubic time complexity.

---

## 6. SVM Regression
Instead of fitting the largest possible street between two classes while limiting margin violations, SVM Regression reverses the objective: it tries to fit as many instances as possible *on* the street while limiting margin violations (instances *off* the street).
* For nonlinear regression, a kernelised SVM model can be used (e.g., using a 2nd-degree polynomial kernel).

---

## 7. Under the Hood: Math and Optimization
*(Note: The bias term is denoted as $b$ and the feature weights vector as $w$)* 

### Decision Function
A linear SVM classifier predicts the class of a new instance $x$ by computing the decision function:
$$\hat{y} = w^{T}x + b = w_{1}x_{1} + \dots + w_{n}x_{n} + b$$ 

The class label prediction is:
$$\hat{y} = \begin{cases} 0, & \text{if}~w^{T}x + b < 0, \\ 1, & \text{if}~w^{T}x + b \ge 0. \end{cases}$$ 

### Training Objective (Primal Problem)
To make the street wider, we need to make the weight vector $w$ smaller.
* **Hard Margin Objective:** Minimize $\frac{1}{2}w^{T}w$  subject to $t^{(i)}(w^{T}x^{(i)} + b) \ge 1$. Here, $t^{(i)} = +1$ for positive instances and $-1$ for negative instances.
* **Soft Margin Objective:** Introduces a slack variable $\zeta^{(i)} \ge 0$ that measures how much an instance is allowed to violate the margin. The objective is to minimize $\frac{1}{2}w^{T}w + C\sum_{i=1}^{m}\zeta^{(i)}$ subject to $t^{(i)}(w^{T}x^{(i)} + b) \ge 1 - \zeta^{(i)}$. 
* These are Convex Quadratic Programming (QP) problems.

### The Dual Problem
The linear SVM objective can be formulated as a related *dual problem*. 
* The dual problem is faster to solve than the primal problem when the number of training instances is smaller than the number of features.
* Most importantly, the dual formulation makes the kernel trick possible.

### Common SVM Kernels 
* **Linear:** $K(a,b) = a^{T}b$
* **Polynomial:** $K(a,b) = (\gamma a^{T}b + r)^{d}$
* **Gaussian RBF:** $K(a,b) = \text{exp}(-\gamma||a-b||^{2})$
* **Sigmoid:** $K(a,b) = \text{tanh}(\gamma a^{T}b + r)$

### SVM via Gradient Descent
For linear SVM classifiers, you can alternatively use Gradient Descent (e.g., `SGDClassifier`) to minimize the cost function derived from the primal problem:
$$J(w,b) = \frac{1}{2}w^{T}w + C\sum_{i=1}^{m}\text{max}(0, 1 - t^{(i)}(w^{T}x^{(i)} + b))$$ 
However, this converges much more slowly than methods based on QP solvers.