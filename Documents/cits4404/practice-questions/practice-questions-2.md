```markdown
# Practice Questions
**May 2026**

> **Note:** These questions are intended to convey the style of themed short answer questions in the tests, not to cover the content of the test.

---

## Question 1

Suppose Karri decides to build a trading bot that seeks to identify a trend from the previous 10 closing prices of an asset. In order to avoid any inherent bias on what constitutes a good trend, she decides to do this by optimising a nonlinear weighted average over a window of the previous 10 price signals to decide whether to buy.

The trend signal that the bot generates at time $t$ is defined by:

$$\text{TREND}_t = \frac{\sum_{i=0}^{9} w_i\, p_{t-i}}{\sum_{i=0}^{9} w_i}$$

where $p_t$ is the price at time $t$, and $w_i$ are weights.

Karri plans to optimise the bot using a historical data sequence. The bot will start with **$100**. Each day:
- If $\text{TREND} > 0$ the bot will **buy $10** of the asset.
- If $\text{TREND} \leq 0$ the bot will **sell $10** of the asset (assuming it has at least $10 remaining).

### (a)
What do we mean by a **candidate solution** for this problem? Is the **hypothesis space** finite or infinite? What is the **dimension** of the hypothesis space?

### (b)
Suppose Karri wishes to use an **evolutionary strategy** to optimise the bot. Briefly describe **three decisions** that must be made as part of the implementation.

### (c)
Briefly explain the difference between a $(\mu, \lambda)$ evolutionary strategy and a $(\mu + \lambda)$ strategy.

### (d)
Assuming the dimensionality of the space is $d$, briefly explain the key differences between:

- a **Hooke-Jeeves search**
- a **steepest ascent hill climb** with sample size $n = 2d$
- a **steepest ascent hill climb with replacement** where $n = 2d$
- a $(1, 2d)$ evolutionary strategy
- a $(1 + 2d)$ evolutionary strategy

---

## Question 2

### (a)
One of the goals of soft computing is **graceful degradation**. What do we mean by graceful degradation?

Give a practical example (from the course or otherwise) where graceful degradation is important. Using your example, why might you expect a network of neurons with **sigmoid activation functions** to provide better degradation properties than **perceptrons with step functions**?

### (b)
Consider a neuron that uses the sigmoid activation function given by:

$$a(z) = \frac{z}{1 + |z|}$$

Assume you wish the neuron to have an **acceptance region** for all values of $z > T$ for some threshold $T$.

- What values of $a(z)$ might you use to indicate that a particular sample $z_0$ is accepted? (That is, what values of $a(z)$ would indicate the acceptance region?)
- Draw the activation function, indicating the acceptance region.

### (c)
Suppose you wish to use a **bias input** to move the threshold to the origin, so that the acceptance region is $z > 0$.

- What activation function would you use?
- Draw a diagram depicting the neuron.

> **Diagram description (neuron with bias input):** A neuron model is required showing an input $z$ along with a bias input $b = -T$ (or equivalently, an additional input of value $1$ multiplied by a bias weight $-T$). The summation node computes $z' = z - T$, which is then passed through the activation function $a(z') = \dfrac{z'}{1 + |z'|} = \dfrac{z - T}{1 + |z - T|}$. The output of the activation function determines the acceptance region, which now corresponds to $z' > 0$ (i.e., $z > T$ shifted to the origin). Labels should include: input $z$, bias $-T$ (or weight $w_0 = -T$ on a constant input of $1$), summation $\Sigma$, activation function $a(\cdot)$, and output.

---

*Page 3 of 3*
```