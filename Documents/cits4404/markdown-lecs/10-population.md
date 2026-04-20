# Population-based Methods

> **Reference:** *Essentials of Metaheuristics, 2nd Ed.* — Sean Luke, Lulu, 2016  
> © Siwen Luo, UWA

---

## Optimisation Algorithms — Roadmap

```
Optimisation
├── Deterministic
│   └── (...)
└── Stochastic  ← global
    ├── Single-state
    │   ├── Hill climbing with restarts
    │   ├── Simulated Annealing
    │   ├── Tabu
    │   └── ILS
    └── Population-based  ◄── FOCUS OF THIS MODULE
            └── (...)
```

---

## The Problem

We want to deal with:

- Difficult / poorly behaved search spaces
- Black box optimisation
- High dimensionality, complexity
- **"Traditional" searches fail dismally**, e.g.:
  - **Hill climb** — fails in "highly modal" spaces (lots of local optima)
  - **Brute force** (grid search, breadth-first and variants) — infeasible in real-valued, high-dimensional spaces

> The Rastrigin function is a canonical example of a highly modal space: a 3D surface with an enormous number of local optima, making naive search strategies ineffective.

### The Problem — Expensive Evaluation

- *Evaluation (sampling) is expensive*
  - Even where a single evaluation is cheap, there may need to be *very* many of them
  - A single evaluation can be *very* expensive!
  - **Example:** tuning a weather model (e.g. with dozens of parameters like temperature, humidity, wind, precipitation, cloud cover, radiation...) to best match observed data — each evaluation requires running a full numerical weather simulation.

---

## Key Question

> Want to make **every evaluation count!**

- Every evaluation gives you **information** about the search space (black/grey box)
- Want to utilise / learn from that information as much as possible:
  - What does the space look like?
  - What heuristics are appropriate?
  - Where should we look for the best solutions?

**Key question:** *Can a collection of points tell us more together than each individual on its own?*

In common parlance: *"Can the whole tell you more than the sum of the parts"?*

> This is the **fundamental question of population-based algorithms.**

---

## Inspiration — Natural/Biological Systems

What other *system* do we know of that:
- optimises performance
- within some environment
- using many trials?

→ **Natural/biological systems!**

- Many ways of adapting to perform better within an environment
- Perhaps the most fundamental of all is… **evolution**

---

## Evolution Rocks!

| Property | Description |
|---|---|
| Works in vastly different environments | Highly general |
| Maintains lots of candidate solutions | Population-based |
| Seeks to optimise performance | Fitness-driven |
| Iteratively improves solutions | Generational |
| Collectively "learns" about environment | Meta-learning? Capabilities stored in genome |
| Information/capability sharing | Within generations (social beings) and between generations |

---

## But What Kind of Evolution?

**Questions:**
- Have the mechanisms of biological evolution been fully resolved/understood?
- Is there any reason that algorithmic "evolution" ought to follow biological evolution, even if they have?

### Lamarck vs Darwin

| Theorist | Year | Proposal |
|---|---|---|
| **Lamarck** | 1809 | Individual adaptation to the environment *could be passed on* to offspring |
| **Darwin** (and Wallace) | 1858–1859 | *Natural selection* is the main mechanism |

**Darwin's nuance:** In *On the Origin of Species*, Darwin didn't fully rule out Lamarckism — he proposed a mechanism called **pangenesis**, where cells throw off *gemmules* that:
- Carry information in response to environmental stimulation
- Accumulate in germ cells that can be passed on

**Weismann (1892)** — *germ plasm* theory of inheritance:
- Germ cells only found in gametes
- Information from germ cells creates somatic cells
- **No** information transmission from somatic cells back to germ cells → the **"Weismann barrier"**

Weismann "proved" this by cutting off the tails of mice over 19 generations — offspring still had tails → Lamarckism "refuted".

### Epigenetic Inheritance — Lamarck's Last Laugh?

- Signals from the outside world can work through the **epigenome** to change a cell's *gene expression*
- **Epigenetic tags** act as a kind of cellular memory — the sum of signals received during a cell's lifetime
- It was thought a new embryo's epigenome was completely erased and rebuilt from scratch — **but this isn't completely true**
- In mammals, *about 1% of genes escape epigenetic reprogramming* through a process called **imprinting**

```
Reproductive cells                         Embryo develops
(specialised, lots of epigenetic tags)     (many specialised cells,
          │                                 lots of epigenetic tags)
          │                                        ▲
          ▼                                        │
  Male & female reproductive cells ──────► Reprogramming erases MOST
  (can become any cell type,               epigenetic tags so fertilised
   few epigenetic tags)                    egg can develop into any cell type
```

> Reference: https://learn.genetics.utah.edu/content/epigenetics/

---

## Evolutionary Computation

- General term for an ever-growing set of techniques borrowing inspiration from **biology / evolution / genetics**
- Also known as: *nature-inspired computing*, *evolutionary algorithms*
- **No strict agreement** on algorithm names/terminology

Key sub-fields include: Genetic Algorithms, Genetic Programming, Evolution Strategies, Evolutionary Programming, Swarm Intelligence, Ant Colony Optimisation, Memetic Algorithms, Co-Evolution, and many more.

---

## Common Terms in EC (Luke, 2016)

| Term | Definition |
|---|---|
| **individual** | A candidate solution |
| **child / parent** | A *child* is the tweaked copy of a candidate solution (its *parent*) |
| **population** | Set of candidate solutions |
| **fitness** | Quality |
| **fitness landscape** | Quality function |
| **fitness assessment / evaluation** | Computing the fitness of an individual |
| **selection** | Picking individuals based on their fitness |
| **mutation** | Plain tweaking — often thought of as "asexual" breeding |
| **recombination / crossover** | A special tweak taking two parents, swapping sections, (usually) producing two children — "sexual" breeding |
| **breeding** | Producing one or more children from a population of parents through iterated selection and tweaking (typically mutation or recombination) |
| **genotype / genome** | An individual's data structure, as used during breeding |
| **chromosome** | A genotype in the form of a fixed-length vector |
| **gene** | A particular slot position in a chromosome |
| **allele** | A particular setting of a gene |
| **phenotype** | How the individual operates during fitness assessment |
| **generation** | One cycle of fitness assessment, breeding, and population re-assembly; or the population produced each such cycle |

---

## Typical Steps of an Evolutionary Algorithm

1. Create (random) **initial population**
2. Assess/evaluate **fitness** (quality)
3. "Breed" new population of **offspring**
4. "Join" parents and children to form next **generation**

### Algorithm 17 — Abstract Generational Evolutionary Algorithm (EA)

```
P ← BuildInitialPopulation()
Best ← ∅                           // ∅ means "nobody yet"
repeat
    AssessFitness(P)
    for each individual Pᵢ ∈ P do
        if Best = ∅ or Fitness(Pᵢ) > Fitness(Best) then
            Best ← Pᵢ              // Fitness is just Quality
    P ← Join(P, Breed(P))
until Best is the ideal solution or we have run out of time
return Best
```

### Notes on Each Step

- **`AssessFitness()`** — involves evaluation, can be expensive
- **`Breed()`** — typically involves **selection** and "tweaking" (**mutation** and/or **recombination**)
- **`Join()`** — completely replace parents with offspring, OR keep some fitter parents (selection)
- **`BuildInitialPopulation()`**
  - Can be completely random — but be careful:
    - *Uniform distribution* — requires bounded space
    - *Gaussian distribution* — where do you centre it? Does that bias results?
  - Can be intentionally **biased** — if you know something about the space, use it for a "head start" (but consider the risks)

---

## Evolutionary Strategies (ES)

- Intuitive algorithms dating back to **Rechenberg and Schwefel, 1960s**
- Use **truncation selection** — keep the best
- Use **mutation** as tweak (mostly)

### The $(\mu, \lambda)$ ES

- Randomly initialise with $\lambda$ individuals
- Evaluate and keep the $\mu$ fittest ones (truncation selection) → `AssessFitness()`
- Mutate each of the $\mu$ parents $\dfrac{\lambda}{\mu}$ times to get $\lambda$ children → `Breed()`
- Replace the parents with the children, and repeat → `Join()`

Where: $\mu$ = number of surviving parents, $\lambda$ = number of offspring

#### Algorithm 18 — The $(\mu, \lambda)$ Evolution Strategy

```
μ ← number of parents selected
λ ← number of children generated by the parents

P ← {}
for λ times do                                   ▷ Build Initial Population
    P ← P ∪ {new random individual}

Best ← ∅
repeat
    for each individual Pᵢ ∈ P do
        AssessFitness(Pᵢ)
        if Best = ∅ or Fitness(Pᵢ) > Fitness(Best) then
            Best ← Pᵢ
    Q ← the μ individuals in P with greatest Fitness()   ▷ Truncation Selection
    P ← {}                                               ▷ Join = replace P with children
    for each individual Qⱼ ∈ Q do
        for λ/μ times do
            P ← P ∪ {Mutate(Copy(Qⱼ))}
until Best is the ideal solution or we have run out of time
return Best
```

### Visualising ES Variants

```
(1,2) ES                    (1,8) ES                    (4,8) ES
                                                          Generation 4  ▲
  ●──►◇                      ●──►◇◇◇◇◇◇◇◇              Generation 3  △
  ●──►◇         (one          (one parent,               Generation 2  ▲
                parent,        8 children)               Generation 1  ●
                2 children)                         
                                                    Each generation: μ individuals
                                                    selected to breed, each produces
                                                    λ/μ children → λ children total.

Legend:  ● = Selected to breed   ◇ = Not selected
```

> **Q:** What information does (4,8) give you that 4 restarts with a single-state method wouldn't?  
> **A:** The 4 surviving parents carry spatial information about *different regions* of the search space simultaneously — their relative fitness reveals something about the landscape's structure, which independent restarts cannot exploit.

### Tuning Knobs of $(\mu, \lambda)$

| Parameter | Role | Effect |
|---|---|---|
| $\lambda$ | Population ("sampling") size — similar to $n$ in steepest ascent | Bigger → better (if not for cost); $\lambda = \infty$ → random search (pure exploration) |
| $\mu$ | Selectivity | Low $\mu$ → more exploitation |
| `Mutate()` | Probability and degree of mutation | Affects exploration/exploitation balance |

> **Note:** These are not independent — e.g. highly random mutation with small $\mu$ is still effectively a random walk.

---

## The $(\mu + \lambda)$ Evolutionary Strategy

The **only difference** from $(\mu, \lambda)$: in `Join()`, **offspring compete with parents** for a place in the next generation.

#### Algorithm 19 — The $(\mu + \lambda)$ Evolution Strategy

```
μ ← number of parents selected
λ ← number of children generated by the parents

P ← {}
for λ times do                         ▷ Or perhaps λ + μ — see Luke footnote 18, p.34
    P ← P ∪ {new random individual}

Best ← ∅
repeat
    for each individual Pᵢ ∈ P do
        AssessFitness(Pᵢ)
        if Best = ∅ or Fitness(Pᵢ) > Fitness(Best) then
            Best ← Pᵢ
    Q ← the μ individuals in P with greatest Fitness()
    P ← Q                             ▷ KEY DIFFERENCE: Join keeps parents in P
    for each individual Qⱼ ∈ Q do
        for λ/μ times do
            P ← P ∪ {Mutate(Copy(Qⱼ))}
until Best is the ideal solution or we have run out of time
return Best
```

### Comparison: $(\mu, \lambda)$ vs $(\mu + \lambda)$

| Property | $(\mu, \lambda)$ | $(\mu + \lambda)$ |
|---|---|---|
| Parents compete with offspring? | No | Yes |
| Exploitation tendency | Moderate | Higher |
| Risk of losing good solutions | Higher | Lower |
| Risk of premature convergence | Lower | **Higher** |

**General principles for population-based approaches** (subject to No Free Lunch):

- → Want to maintain **diversity** in population
- → Accept reduction in diversity over time to encourage **convergence** (exploitation)
- → **Premature convergence** = too much loss of diversity too soon — not enough exploration to be confident we converged on a good solution

*cf. Simulated Annealing's temperature schedule*

---

## Comparison with Single-State Methods

Population-based methods are **generalisations** of single-state methods; single-state methods are specialisations (degenerate cases):

| Single-State Method | ES Equivalent |
|---|---|
| Hill climb | $(1+1)$ |
| Steepest ascent hill climb | $(1+n)$ |
| Steepest ascent hill climb with replacement | $(1, n)$ |

---

## Adaptive Mutation

**Typical ES setup:**
- Fixed-length vector of real-valued numbers ("chromosome")
- Mutation via **Gaussian Convolution**
- Controlled by $\sigma$ (or $\sigma^2$) — called the **mutation rate** of ES

**How to choose mutation rate?**

| Strategy | Notes |
|---|---|
| Guess | Simple but unlikely to be optimal |
| Run experiments | Find good value for problem at hand |
| Meta-optimisation | Run an optimiser over the mutation rate itself |
| Decrease over time | Analogous to Simulated Annealing's cooling schedule |
| **Adaptive** | Change based on statistics of the system ← most principled |

### Rechenberg's One-Fifth Rule

Derived from experiments on simple test problems:

$$
\text{Let } p_s = \text{fraction of children fitter than their parents}
$$

$$
\sigma^2 \leftarrow \begin{cases}
\text{increase } \sigma^2 & \text{if } p_s > \dfrac{1}{5} \quad \text{(exploiting local optima too much → explore more)} \\
\text{decrease } \sigma^2 & \text{if } p_s < \dfrac{1}{5} \quad \text{(exploring too much → exploit more)} \\
\text{unchanged} & \text{if } p_s = \dfrac{1}{5}
\end{cases}
$$

> ⚠️ Derived on simple test problems — your problem may differ!

---

## Self-Adaptive Mutation

Take adaptive mutation one step further:

**Intuition:** Different parts of the search space may have different characteristics (the space is not "homogeneous") — settings optimal for one region may be suboptimal for another.

$$
\Rightarrow \text{Each individual carries its own } \sigma \text{ (or full covariance matrix)}
$$

$$
\Rightarrow \text{The mutation operator itself can mutate!}
$$

**Design principles:**
- Your imagination is the limit — but it **must be justified**
- Remember **Occam's Razor**: complexity for its own sake is poor practice
- Must **empirically demonstrate** the benefits

> Example challenge: the **Rosenbrock function** — a narrow curved valley where the optimal mutation direction and scale change dramatically across the space, making fixed $\sigma$ inefficient.

```
Rosenbrock's function: f(x,y) = (1-x)² + 100(y-x²)²
Global minimum at (1,1) with f=0
Characterised by a narrow, curved, parabolic valley — hard for fixed-step methods
```

---

## Evolutionary Programming

ES ideas generalise beyond real-valued vectors to **any** representation:

| Representation | Example Application |
|---|---|
| Real-valued vectors | Continuous optimisation (ES) |
| Finite-state automata | Fogel, 1964 — original evolutionary programming |
| Trees | Symbolic regression, rule systems |
| Graphs | Network topology optimisation |
| Programs | Genetic Programming |
| Neural network structure | Neuroevolution (e.g. NEAT) |

> ⚠️ Extra constraints are often needed to ensure individuals remain **viable solutions** after mutation/crossover (e.g. trees must remain syntactically valid programs).

**Example — tree mutation producing progressively more complex program trees:**

```
Step 1:               Step 2:               Step 3:               Step 4:
If-Then-Else          If-Then-Else          If-Then-Else          If-Then-Else
  /    \               /    \               /    \                /    \
(...)  (...)        Equal    B    Add     Equal   B    Add      Equal   B    Add
                    / \          / \      / \          / \      / \          / \
                   A   D       Mult  B   A   D       Mult  B   A   D       Mult  B
                                / \                   / \                   / \
                               D   A                 D   A                 D   A
```

---

## Summary

```
Population-based Methods
│
├── Core Idea: maintain multiple candidate solutions simultaneously
│             to extract collective information about the search space
│
├── Key Concepts
│   ├── Fitness (quality), Selection, Mutation, Recombination
│   ├── Exploration vs Exploitation trade-off
│   └── Diversity maintenance vs Convergence
│
├── Evolutionary Strategies
│   ├── (μ, λ) — offspring only compete amongst themselves
│   └── (μ+λ) — offspring compete with parents (more exploitative)
│
├── Adaptive / Self-Adaptive Mutation
│   ├── One-Fifth Rule (Rechenberg)
│   └── Per-individual σ that itself evolves
│
└── Generalisations
    ├── Single-state methods are degenerate cases: HC=(1+1), SA≈(1+1) with acceptance
    └── Representations: vectors, trees, graphs, programs, FSAs, NNs
```