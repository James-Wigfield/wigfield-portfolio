# CITS5508 Machine Learning: Regression Models
**Instructor:** Marcell Szikszai 
**Year:** 2026 
**University:** The University of Western Australia 

---

## 1. Overview and Reading Materials
This lecture introduces how Machine Learning algorithms work, focusing specifically on regression models. 

### Topics Covered
* Linear Regression 
* Gradient Descent 
* Polynomial Regression 
* Learning Curves 
* Regularised Linear Models 
* Logistic Regression 

### Recommended Reading
* **Textbook:** *Hands-on Machine Learning with Scikit-Learn, Keras & TensorFlow* (2nd Edition) by Aurélien Géron, O'Reilly Media, 2022.
* **Chapter:** Chapter 4 - Training Models.

---

## 2. Linear Regression
A Linear Regression model makes a prediction by computing a weighted sum of the input features, plus a bias (or intercept) term.

* **Equation:** $\hat{y} = \theta_{0} + \theta_{1}x_{1} + \theta_{2}x_{2} + ... + \theta_{n}x_{n}$ 
* **Vectorised Equation:** $\hat{y} = h_{\theta}(x) = \theta^{\top}x$ 
    * $\hat{y}$ is the predicted value.
    * $\theta$ is the parameter vector containing the bias and feature weights.
    * $x$ is the feature vector.

### Training the Model
Training involves finding the value of $\theta$ that minimizes a cost function $C(\theta)$.
* **Mean Squared Error (MSE):** $MSE(X,h_{\theta}) = \frac{1}{m}\sum_{i=1}^{m}(\theta^{\top}x^{(i)} - y^{(i)})^{2}$ 
* **Residual Sum of Squares (RSS):** $RSS(X,h_{\theta}) = \sum_{i=1}^{m}(\theta^{\top}x^{(i)} - y^{(i)})^{2}$ 

### The Normal Equation
To directly find the $\theta$ that minimizes the cost function, a closed-form mathematical solution known as the Normal Equation is used.
$$\hat{\theta} = (X^{\top}X)^{-1}X^{\top}y$$ 

* The running time of the Normal Equation is linear with respect to the number of training instances, but it can be cubic with respect to the number of features.

---

## 3. Gradient Descent
Gradient Descent is a generic optimization algorithm that iteratively tweaks parameters to minimize a cost function. It measures the local gradient of the error function and steps in the direction of the descending gradient until it reaches a minimum.

### The Gradient Vector and Steps
* **Partial Derivative of MSE:** $\frac{\partial}{\partial\theta_{j}}MSE(\theta) = \frac{2}{m}\sum_{i=1}^{m}(\theta^{\top}x^{(i)} - y^{(i)})x_{j}^{(i)}$ 
* **Gradient Vector:** $grad(\theta) = \nabla_{\theta}MSE(\theta) = \frac{2}{m}X^{\top}(X\theta - y)$ 
* **Gradient Descent Step:** $\theta^{(t+1)} = \theta^{(t)} - \eta~grad(\theta^{(t)})$ where $\eta$ is the learning rate 

### Pitfalls and Learning Rate
* The algorithm can get stuck in a local minimum or plateau instead of reaching the global minimum.
* The learning rate ($\eta$) determines the step size; if it is too high, the algorithm may diverge.

### Three Variants of Gradient Descent
* **Batch GD:** Uses the entire training set to compute gradients at every step, making it very slow for large datasets.
* **Stochastic GD (SGD):** Picks a random instance at every step and computes gradients based only on that instance. This is much faster but causes the cost to jump around. A learning schedule can gradually reduce the learning rate to help it converge.
* **Mini-batch GD:** Computes gradients on small random sets of instances, allowing for hardware optimization like GPU vectorisation.

---

## 4. Polynomial Regression and Learning Curves
If the data is more complex than a straight line, Polynomial Regression introduces new features by computing powers of existing features (e.g., $x_{1}^{2}$) and training a linear model on the extended set.

### Overfitting vs. Underfitting
* A high-degree polynomial model (e.g., 300 degrees) will severely overfit the training data, capturing noise.
* A strict linear model may underfit complex data.

### Learning Curves
* Learning Curves plot a model's performance on the training set and validation set as a function of the training set size.
* Generating these plots by training models on subsets of varying sizes helps diagnose if a model is overfitting or underfitting.

---

## 5. Logistic Regression
Logistic Regression is a regression algorithm used for classification by estimating the probability that an instance belongs to a specific class.

### The Logistic Function
It computes a weighted sum of inputs but outputs the logistic (sigmoid) of the result.
$$\hat{p} = h_{\theta}(x) = \sigma(\theta^{\top}x)$$ 
$$\sigma(t) = \frac{1}{1+exp(-t)}$$ 

* The model predicts `1` if $\hat{p} \ge 0.5$ (meaning $\theta^{\top}x$ is positive) and `0` if $\hat{p} < 0.5$ ($\theta^{\top}x$ is negative).

### Cost Function (Log Loss)
The algorithm searches for a $\theta$ that yields high probabilities for positive instances and low probabilities for negative instances.
* **Single Instance Cost:** $C(\theta) = -log(\hat{p})$ if $y=1$, and $-log(1-\hat{p})$ if $y=0$.
* **Overall Cost Function:** $J(\theta) = -\frac{1}{m}\sum_{i=1}^{m}[y^{(i)}log(\hat{p}^{(i)}) + (1-y^{(i)})log(1-\hat{p}^{(i)})]$.
* While there is no closed-form equation to compute the minimum, the cost function is convex, guaranteeing that Gradient Descent will find the global minimum.

### Example: Iris Dataset
In an example classifying whether a flower is *Iris-Virginica* or not based on petal width and length, Logistic Regression successfully creates a linear decision boundary separating the classes.