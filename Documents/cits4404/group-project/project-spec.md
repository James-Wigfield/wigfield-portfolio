# CITS4404 Team Project: Building AI Trading Bots

## Overview

Automated trading bots now perform an estimated **70–80% of global trading volume**. This project applies nature-inspired (metaheuristic) optimisation algorithms to build and optimise trading bots for Bitcoin (BTC/USDT), using technical analysis as the signal source.

---

## Project Structure

| Part | Focus | Deliverable |
|------|-------|-------------|
| Part 1 | Literature review of nature-inspired algorithms | Synopses + comparison (Deliverable 1) |
| Part 2 | Design, build and optimise an AI trading bot | Video + Report + Code (Deliverable 2) |

> Parts 1 and 2 can be worked on in **parallel**.

---

## Deadlines

| Deliverable | Due Date |
|-------------|----------|
| Deliverable 1 (Synopses) | Friday 24 April, 11:59pm AWST |
| Deliverable 2 (Full project) | Sunday 24 May, 11:59pm AWST |

**Late penalty:** 5% per day after 48-hour grace period (not accepted after 7 days).

---

# PART 1 — Literature Review: Nature-Inspired Algorithms

## Goal

Produce one **1–1.5 page synopsis per team member**, each covering a different nature-inspired optimisation algorithm (population-based, not neural networks/ML). Then write a **1–2 page comparative conclusion**.

### Algorithm Selection Constraints

- Must be **optimisation algorithms** (not ML/neural networks)
- Must be **population-based** (maintain a collection of candidate solutions)
- Source: Tzanetos et al. Mendeley Data repository (~300 algorithms as of Jan 2021)

## Synopsis Questions (Per Algorithm)

Answer all six of the following for each algorithm:

1. **What problem** with existing algorithms does this new algorithm solve?
2. **Why have previous approaches failed** — what deficiency motivated this work?
3. **What is the novel idea** presented in the paper?
4. **How is the approach demonstrated** — implementation, proof, user studies?
5. **What are the results**, and how are they validated/benchmarked?
6. **What is your assessment** — are the conclusions justified? Would you choose this algorithm?

## Comparative Conclusion

- Which algorithms were chosen and why?
- Are they variants on a theme (same Category) or from different Categories?
- Is there a relevant chronology or taxonomy? *(Diagrams encouraged)*

---

# PART 2 — AI Trading Bot: Design & Optimisation

## 1. Technical Analysis Background

**Technical Analysis (TA)** uses price and volume history to predict future price direction. It contrasts with fundamentals trading (macro factors, earnings reports, etc.).

### OHLCV Data

Each time-period candle contains:

| Field | Description |
|-------|-------------|
| **O** | Open price |
| **H** | High price (intra-period) |
| **L** | Low price (intra-period) |
| **C** | Close price |
| **V** | Volume of transactions |

---

## 2. Bot Building Blocks: Weighted Moving Averages (WMAs)

All bots are constructed from **WMA filter units** implemented via **convolution**.

### Core Convolution Framework

```python
import numpy as np

def pad(P, N):
    """Flip-pad the signal so the window is filled at t=0."""
    padding = -np.flip(P[1:N])
    return np.append(padding, P)

def wma(P, N, kernel):
    """Apply a convolution filter (kernel) to price series P with window N."""
    return np.convolve(pad(P, N), kernel, 'valid')
```

Usage: `wma(P, N, some_filter(N))`

---

### 2.1 Simple Moving Average (SMA)

**Definition:** Equal-weight average of the last N data points.

$$\text{SMA}_n = \frac{1}{N} \sum_{k=0}^{N-1} p_{n-k}$$

**Filter (boxcar):**

$$K_{\text{SMA}} = \frac{1}{N} \cdot \begin{cases} 1 & \text{if } 0 \le k < N \\ 0 & k \ge N \end{cases}$$

**Convolution form:** $\text{SMA} = P * K$

```python
def sma_filter(N):
    return np.ones(N) / N

# Usage:
sma = wma(P, N, sma_filter(N))
```

**Characteristics:**
- Uniform weights across the entire window
- Highest smoothing of short-term fluctuations
- Largest lag of the three filter types
- Lag increases proportionally with window size N

---

### 2.2 Linear-Weighted Moving Average (LMA)

**Definition:** Weights reduce linearly from most-recent to oldest. More intuitive than SMA for recency bias.

**Filter (triangular):**

$$K_{\text{LMA}} = \frac{2}{N+1} \cdot \begin{cases} 1 - k \cdot \frac{1}{N} & \text{if } 0 \le k < N \\ 0 & k \ge N \end{cases}$$

> The factor $\frac{2}{N+1}$ normalises so all weights sum to 1.

```python
def lma_filter(N):
    weights = np.array([1 - k / N for k in range(N)])
    weights = weights * (2 / (N + 1))
    return weights

# Usage:
lma = wma(P, N, lma_filter(N))
```

**Characteristics:**
- Linearly decaying weights (most recent = highest)
- Responds more quickly than SMA
- Less smoothing than SMA

---

### 2.3 Exponential Moving Average (EMA)

**Definition:** Exponentially decaying weights — even greater recency bias, smoother tail-off.

**Filter:**

$$K_{\text{EMA}} = \alpha \cdot \begin{cases} (1 - \alpha)^k & \text{if } 0 \le k < N \\ 0 & k \ge N \end{cases}$$

> Two tuning parameters: window size **N** and smoothing factor **α** (rate of decay).

```python
def ema_filter(N, alpha):
    weights = np.array([alpha * (1 - alpha)**k for k in range(N)])
    # Normalise so weights sum to 1
    return weights / weights.sum()

# Usage:
ema = wma(P, N, ema_filter(N, alpha=0.3))
```

**Characteristics:**
- Fastest response to price changes
- Two tunable parameters (N and α)
- Approximates true EMA over fixed window

---

### 2.4 Filter Comparison Summary

```
Filter Weight Profiles (schematic, k = lag index, left = most recent):

SMA:  [■ ■ ■ ■ ■ ■ ■ ■ ■ ■]   — uniform, flat
LMA:  [■■■■■ ■■■■ ■■■ ■■ ■]    — linearly decreasing
EMA:  [■■■■■■ ■■■ ■■ ■  ·  ]   — exponentially decreasing
```

| Filter | Recency Bias | Smoothing | Lag | Extra Params |
|--------|-------------|-----------|-----|--------------|
| SMA    | None (uniform) | Most    | Most | — |
| LMA    | Linear     | Medium    | Medium | — |
| EMA    | Exponential| Least     | Least | α (decay rate) |

**Tunable parameters for all filters:**
- Window size **N** (responsiveness vs. smoothing tradeoff)
- Timeframe (minutes / hours / days / weeks) — also optimisable
- EMA additionally: smoothing factor **α**

---

### 2.5 Custom Filters

The convolution framework makes it trivial to try custom filter profiles. The most general form lets **each weight in the window float freely**:

$$\text{WMA}_n = \frac{\sum_{k=0}^{N-1} w_k \cdot p_{n-k}}{\sum_{k=0}^{N-1} w_k}$$

> **Trade-off:** Maximum expressiveness, but N free parameters per filter — greatly enlarges the hypothesis space.

---

## 3. Buy/Sell Signal Generation

### 3.1 Crossover Strategy

The core trading strategy: use **two WMA signals** of different frequencies.

```
Short-term WMA (higher frequency, reacts faster)
Long-term  WMA (lower frequency, smoother trend)

Buy signal  ("Golden Cross"): short-term crosses ABOVE long-term
Sell signal ("Death Cross"):  short-term crosses BELOW long-term
```

**Two common approaches:**
1. Same filter type, different window sizes (e.g., SMA-10 vs SMA-20)
2. Different filter types (e.g., EMA for short-term, SMA for long-term)

### 3.2 Difference Signal and Sign-Change Filter

Subtract the long-term from short-term to get a **difference signal** that crosses zero at trade triggers:

```python
diff = short_wma - long_wma
# Positive → short above long (hold/buy)
# Negative → short below long (sell)
```

**Sign-change detection filter** — detects zero-crossings in the difference signal:

$$K_{\text{cross}} = \frac{1}{2} \cdot \begin{cases} 1 & k = 0 \\ -1 & k = 1 \\ 0 & k > 1 \end{cases}$$

```python
def crossover_filter():
    return np.array([0.5, -0.5])

sign_changes = wma(np.sign(diff), 2, crossover_filter())
buy_signals  = sign_changes > 0.5   # positive-going zero crossing
sell_signals = sign_changes < -0.5  # negative-going zero crossing
```

---

### 3.3 Simple Bot Architecture (Example)

```
         ┌─────────┐
    ┌───▶│ SMA(10) │──┐
    │    └─────────┘  │
P ──┤                 ├──▶ [subtract] ──▶ [sign] ──▶ [crossover filter] ──▶ buy/sell
    │    ┌─────────┐  │
    └───▶│ SMA(20) │──┘
         └─────────┘
```

### 3.4 MACD (More Elaborate Signal)

Standard MACD(12, 26, 9):

```
MACD line   = EMA(12) − EMA(26)          [difference of two EMAs]
Signal line = EMA(9) of MACD line        [EMA of the difference]

Trade triggers:
  Buy  → MACD line crosses above Signal line
  Sell → MACD line crosses below Signal line
  (Alternative: use MACD line zero-crossing alone)
```

```python
macd_line   = wma(P, 12, ema_filter(12, alpha)) - wma(P, 26, ema_filter(26, alpha))
signal_line = wma(macd_line, 9, ema_filter(9, alpha))
diff        = macd_line - signal_line
```

---

## 4. Optimisation: Generalised Bot Design

### 4.1 Parameterised Signal Components

Replace a single fixed WMA with a **weighted combination** of all three filter types:

$$\text{HIGH} = \frac{w_1 \cdot \text{SMA}(d_1) + w_2 \cdot \text{LMA}(d_2) + w_3 \cdot \text{EMA}(d_3, \alpha_3)}{\sum_i w_i}$$

This lets the optimiser decide how much weight to give each filter type.

### 4.2 Dimensionality of the Optimisation Problem

| Configuration | Parameters | Dimensions |
|---------------|-----------|------------|
| Single HIGH signal | $[w_1, w_2, w_3, d_1, d_2, d_3, \alpha_3]$ | **7-D** |
| HIGH + LOW signals | above × 2 | **14-D** |
| MACD (+ smoothing signal) | above × 3 | **21-D** |
| Free filter weights (N per filter) | N per WMA | **N×(num filters)-D** |

> **Key insight:** More parameters = richer hypothesis space = potentially better solutions, but also a harder search problem. This is the central tension explored in the project.

### 4.3 Design Space Options

1. **Tune WMA parameters** — window sizes N, weights w, alpha α
2. **Choose filter types** — which combination of SMA/LMA/EMA to use
3. **Free filter weights** — let each tap weight float independently (subsumes all standard filters)
4. **Structural optimisation** — which components to include and how they're connected (introduces discontinuities in the fitness landscape)

---

## 5. Bot Evaluation (Back-Testing)

### Setup

| Parameter | Value |
|-----------|-------|
| Starting capital | $1,000 USD |
| Starting Bitcoin | 0 BTC |
| Transaction fee | 3% per trade |
| Buy rule | On buy signal: spend all cash (minus fee) on BTC at current price |
| Sell rule | On sell signal: sell all BTC for cash (minus fee) at current price |
| End condition | Sell any remaining BTC at final price |
| **Fitness** | **Total cash held at end of evaluation period** |

### Evaluation Rules

- Evaluation is **deterministic** — same parameters always produce same fitness
- All bots compared on **identical data sequences**
- This is **back-testing** — past performance does not guarantee future results

### Data Split

| Split | Date Range | Purpose |
|-------|-----------|---------|
| Training | Before 2020 | Optimise bot parameters |
| Test (held-out) | 2020 onwards | Final evaluation on unseen data |

> Treat project as if it is the start of 2020 — the test set is "future" data.

### Data Source

**Kaggle: Bitcoin Historical Dataset**

| Granularity | Approx. Size |
|-------------|-------------|
| Daily | ~2,652 data points |
| Hourly | — |
| Per-minute (yearly) | ~600,000 data points per year |

Live data also available via Kraken exchange API (library: `ccxt`).

---

## 6. Algorithm Selection

### Requirements

- Use **one or more nature-inspired algorithms** from Part 1
- Algorithms must be **population-based**
- Optionally include a **single-state baseline** (e.g., stochastic hill-climbing) for comparison
  - When comparing single-state vs population: fix the **number of evaluations** (not generations) as the budget

### Comparison Approach

- More than one algorithm → enables informed comparison
- Look for meaningful differences in convergence, solution quality, robustness
- Vary meta-parameters (e.g., population size) and report findings

---

## 7. Rules of Engagement (Constraints)

| Rule | Detail |
|------|--------|
| ❌ No external bot code | All bot logic must be written by the team |
| ❌ No optimisation libraries | Implement the algorithms yourselves |
| ✅ Algorithm paper code | May adapt published code; must acknowledge the source |

---

# Deliverables Summary

## Deliverable 1 — Synopses (Part 1)

- **One synopsis per team member** (1–1.5 pages each), covering 6 structured questions
- **Comparison section** (1–2 pages) across all reviewed algorithms

## Deliverable 2 — Experiment (Part 2)

### Video Presentation (≤ 25 minutes)

Sections to cover:

1. **Algorithms investigated** — overview, categorisation, distinguishing features
2. **Bot design and parameterisation** — configuration choices, hypothesis space, dimensionality
3. **Algorithm selection** — rationale, high-level explanation, pseudocode/diagrams
4. **Experiments and evaluation** — testing regime, data, trade-offs
5. **Results** — visual representations preferred (charts, tables, animations)
6. **Conclusions** — what was learnt, not just whether the bot "won"

### Report (≤ 3,000 words excl. diagrams and references)

- Must include: word count, team number, names and student IDs on title page
- Submit as **PDF**
- IEEE referencing style
- Complements (does not repeat) the video
- May include additional results, references, pseudocode
- Must **not** include source code (refer to repo instead)
- Does not need to re-explain the project spec or standard TA/lecture concepts

### Code Repository

- Submit as `.ipynb` (Jupyter Notebook)
- Must reproduce all reported results
- Include a `README` with brief run instructions
- Code is not directly marked, but results must be reproducible

---

## Team Logistics

- Teams of **maximum 4 members**
- One member submits on behalf of the group
- Submission = declaration that all work is the team's own (except as referenced)

### Video Submission

- Format: MP4, or link to YouTube / Google Drive
- Google Drive: set permissions to "Anyone with the link can view"

---

## Key References

1. A. Tzanetos, I. Fister and G. Dounias, "A comprehensive database of Nature-Inspired Algorithms", *Data in Brief*, vol. 31, 2020. https://doi.org/10.1016/j.dib.2020.105792
2. A. Tzanetos, "Nature-Inspired Algorithm", Mendeley Data, V2, Jan 2021. doi: 10.17632/xfnzd2c8v7.2
3. H. Bayzidi et al., "Social Network Search for Solving Engineering Optimization Problems", *Computational Intelligence and Neuroscience*, Wiley, Sept 2021.
4. K. V. Price et al., "The 2019 100-Digit Challenge on Real-Parameter, Single Objective Optimization: Analysis of Results", GitHub.

---

## Quick-Reference: Key Equations

| Equation | Formula |
|----------|---------|
| SMA | $\text{SMA}_n = \frac{1}{N}\sum_{k=0}^{N-1} p_{n-k}$ |
| SMA filter | $K = \frac{1}{N}$ for $0 \le k < N$, else $0$ |
| LMA filter | $K = \frac{2}{N+1}\left(1 - \frac{k}{N}\right)$ for $0 \le k < N$, else $0$ |
| EMA filter | $K = \alpha(1-\alpha)^k$ for $0 \le k < N$, else $0$ |
| Crossover filter | $K = \frac{1}{2}[1, -1]$ |
| Generalised HIGH | $\text{HIGH} = \frac{\sum_i w_i \cdot \text{WMA}_i(d_i)}{\sum_i w_i}$ |
| Fitness | `final_cash_balance` after back-test |