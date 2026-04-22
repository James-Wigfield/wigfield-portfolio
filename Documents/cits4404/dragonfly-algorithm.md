# Dragonfly Algorithm: A New Meta-Heuristic Optimization Technique for Solving Single-Objective, Discrete, and Multi-Objective Problems

**Author:** Seyedali Mirjalili  
**Affiliations:**  
1. School of Information and Communication Technology, Griffith University, Nathan Campus, Brisbane, QLD 4111, Australia  
2. Queensland Institute of Business and Technology, Mt Gravatt, Brisbane, QLD 4122, Australia  
**Email:** seyedali.mirjalili@griffithuni.edu.au  
**Received:** 1 October 2014 | **Accepted:** 30 April 2015 | **Published online:** 29 May 2015  
**Journal:** Neural Computing and Applications (2016) 27:1053–1073  
**DOI:** 10.1007/s00521-015-1920-1  
**Source code:** http://www.alimirjalili.com/DA.html  
**Supplementary material:** available to authorized users via DOI link above.

---

## Abstract

A novel swarm intelligence optimization technique is proposed called dragonfly algorithm (DA). The main inspiration of the DA algorithm originates from the static and dynamic swarming behaviours of dragonflies in nature. Two essential phases of optimization, exploration and exploitation, are designed by modelling the social interaction of dragonflies in navigating, searching for foods, and avoiding enemies when swarming dynamically or statistically. The paper also considers the proposal of binary and multi-objective versions of DA called binary DA (BDA) and multi-objective DA (MODA), respectively. The proposed algorithms are benchmarked by several mathematical test functions and one real case study qualitatively and quantitatively. The results of DA and BDA prove that the proposed algorithms are able to improve the initial random population for a given problem, converge towards the global optimum, and provide very competitive results compared to other well-known algorithms in the literature. The results of MODA also show that this algorithm tends to find very accurate approximations of Pareto optimal solutions with high uniform distribution for multi-objective problems. The set of designs obtained for the submarine propeller design problem demonstrate the merits of MODA in solving challenging real problems with unknown true Pareto optimal front as well.

**Keywords:** Optimization · Multi-objective optimization · Constrained optimization · Binary optimization · Benchmark · Swarm intelligence · Evolutionary algorithms · Particle swarm optimization · Genetic algorithm

---

## 1. Introduction

Nature is full of social behaviours for performing different tasks. Although the ultimate goal of all individuals and collective behaviours is survival, creatures cooperate and interact in groups, herds, schools, colonies, and flocks for several reasons: hunting, defending, navigating, and foraging.

**Wolf packs** own one of the most well-organized social interactions for hunting. Wolves tend to follow a social leadership to hunt preys in different steps: chasing preys, circling preys, harassing preys, and attacking preys [1, 2].

**Schools of fish** are an example of collective defence in oceans. Thousands of fishes create a school and avoid predators by warning each other, making the predation very difficult for predators [3]. The majority of predators have evolved to divide such schools to sub-schools by attacking them and eventually hunting the separated individuals.

**Bird flocks** demonstrate navigation swarming. It has been proven that the v-shaped configuration of flight highly saves the energy and equally distributes drag among the individuals in the flock [4].

**Ants and bees** are the best examples of collective behaviours with the purpose of foraging. It has been proven that ants and bees are able to find and mark the shortest path from the nest/hive to the source of food [5]. They intelligently search for foods and mark the path utilizing pheromone to inform and guide others.

It is very interesting that creatures find the optimal situations and perform tasks efficiently in groups, having evolved over centuries to figure out such optimal and efficient behaviours. This is the main purpose of a field of study called **swarm intelligence (SI)**, which was first proposed by Beni and Wang in 1989 [6]. SI refers to the artificial implementation/simulation of the collective and social intelligence of a group of living creatures in nature [7]. Researchers in this field try to figure out the local rules for interactions between the individuals that yield to the social intelligence. Since there is no centralized control unit to guide the individuals, finding the simple rules between some of them can simulate the social behaviour of the whole population.

### 1.1 Existing SI Algorithms

**Ant Colony Optimization (ACO)** [8, 9] is one of the first SI techniques, mimicking the social intelligence of ants when foraging. Each ant marks its own path towards food sources by pheromone. Once an ant finds a food source, it goes back to the nest and marks the path by pheromone to show the path to others. When other ants realize such pheromone marks, they also try to follow the path and leave their own pheromones. Since a longer path takes longer time to travel, the pheromone vaporizes at a higher rate before it is re-marked by other ants. Therefore, the shortest path is achieved by following the path with stronger pheromone level and abandoning paths with weaker pheromone levels. Dorigo first inspired from these simple rules and proposed the well-known ACO algorithm [10].

**Particle Swarm Optimization (PSO)** [11] mimics the foraging and navigation behaviour of bird flocks, proposed by Eberhart and Kennedy. The main inspiration originates from the simple rules of interactions between birds: birds tend to maintain their fly direction towards their current directions, the best location of food source obtained so far, and the best location of the food that the swarm found so far [12]. The PSO algorithm simply mimics these three rules and guides the particles towards the best optimal solutions by each of the individuals and the swarm simultaneously.

**Artificial Bee Colony (ABC)** [13] simulates the social behaviour of honey bees when foraging nectar, proposed by Karaboga. The difference compared to ACO and PSO is the division of the honey bees to scout, onlooker, and employed bees [14]. The employed bees are responsible for finding food sources and informing others by a special dance. Onlookers watch the dances, select one of them, and follow the path towards the selected food sources. Scouters discover abandoned food sources and substitute them by new sources.

### 1.2 Advantages of SI-based Algorithms over Evolutionary Algorithms (EA)

Since the proposal of these algorithms, a significant number of researchers attempted to improve or apply them to different problems in diverse fields [15–20]. The reasons for their success are:

1. SI-based techniques save information about the search space over the course of iteration, whereas such information is discarded by evolutionary algorithms (EA) generation by generation.
2. There are fewer controlling parameters in SI-based algorithms.
3. SI-based algorithms are equipped with fewer operators compared to EA algorithms.
4. SI-based techniques benefit from flexibility, which makes them readily applicable to problems in different fields.

### 1.3 Motivation for the Dragonfly Algorithm

Despite the significant number of recent publications in this field [21–29], there are still other swarming behaviours in nature that have not gained deserved attention. One of the fancy insects that rarely swarm are dragonflies. Since there is no study in the literature to simulate the individual and social intelligence of dragonflies, this paper aims to first find the main characteristics of dragonflies' swarms. An algorithm is then proposed based on the identified characteristics. The **No Free Lunch (NFL)** theorem [30] also supports the motivation of this work to propose this optimizer since this algorithm may outperform other algorithms on some problems that have not been solved so far.

### 1.4 Paper Organization

- Section 2: Inspiration and biological foundations
- Section 3: Mathematical models and the DA algorithm (including binary and multi-objective versions)
- Section 4: Comprehensive comparative study on benchmark functions and one real case study
- Section 5: Conclusions and future directions

---

## 2. Inspiration

Dragonflies (Odonata) are fancy insects. There are nearly 3000 different species of this insect around the world [31].

### 2.1 Lifecycle

A dragonfly's lifecycle includes two main milestones:

```
Egg  ──→  Nymph (aquatic; major portion of lifespan)  ──→  Adult (aerial)
          [predates on marine insects and small fish]       [metamorphism]
```

Dragonflies are considered as small predators that hunt almost all other small insects in nature. Nymph dragonflies also predate on other marine insects and even small fishes.

### 2.2 Swarming Behaviours

The interesting fact about dragonflies is their unique and rare swarming behaviour. **Dragonflies swarm for only two purposes:**

1. **Hunting → Static (feeding) swarm:** Dragonflies make small groups and fly back and forth over a small area to hunt other flying preys such as butterflies and mosquitoes [32]. Local movements and abrupt changes in the flying path are the main characteristics of a static swarm.

2. **Migration → Dynamic (migratory) swarm:** A massive number of dragonflies make the swarm for migrating in one direction over long distances [33].

### 2.3 Mapping to Optimization Phases

These two swarming behaviours are very similar to the two main phases of optimization using meta-heuristics:

| Swarming behaviour | Characteristics | Optimization phase |
|---|---|---|
| Static swarm | Sub-swarms flying over different areas | **Exploration** |
| Dynamic swarm | Bigger swarms flying in one direction | **Exploitation** |

---

## 3. Dragonfly Algorithm

### 3.1 Operators for Exploration and Exploitation

According to Reynolds [34], the behaviour of swarms follows three primitive principles:

- **Separation:** static collision avoidance of individuals from other individuals in the neighbourhood
- **Alignment:** velocity matching of individuals to that of other individuals in neighbourhood
- **Cohesion:** tendency of individuals towards the centre of the mass of the neighbourhood

The main objective of any swarm is survival, so all individuals should be attracted towards food sources and distracted outward enemies. Considering these two behaviours, there are **five main factors** in position updating of individuals in swarms:

```
┌──────────────────────────────────────────────────────────────────────────┐
│  1. Separation   — avoid crowding / collision with neighbours            │
│  2. Alignment    — match velocity of neighbours                          │
│  3. Cohesion     — move toward neighbourhood centre of mass              │
│  4. Attraction   — move toward food source (best solution found so far)  │
│  5. Distraction  — move away from enemy (worst solution found so far)    │
└──────────────────────────────────────────────────────────────────────────┘
```

#### Mathematical Formulations

**Separation** — avoidance of static collisions with neighbours [34]:

$$S_i = -\sum_{j=1}^{N}(X - X_j) \tag{3.1}$$

where $X$ is the position of the current individual, $X_j$ shows the position of the $j$-th neighbouring individual, and $N$ is the number of neighbouring individuals.

**Alignment** — velocity matching:

$$A_i = \frac{\sum_{j=1}^{N} V_j}{N} \tag{3.2}$$

where $V_j$ shows the velocity of the $j$-th neighbouring individual.

**Cohesion** — tendency towards neighbourhood centre of mass:

$$C_i = \frac{\sum_{j=1}^{N} X_j}{N} - X \tag{3.3}$$

where $X$ is the position of the current individual, $N$ is the number of neighbourhoods, and $X_j$ shows the position of the $j$-th neighbouring individual.

**Attraction toward a food source:**

$$F_i = X^+ - X \tag{3.4}$$

where $X$ is the position of the current individual, and $X^+$ shows the position of the food source.

**Distraction outwards an enemy:**

$$E_i = X^- + X \tag{3.5}$$

where $X$ is the position of the current individual, and $X^-$ shows the position of the enemy.

### 3.2 Step and Position Vectors

To update the position of artificial dragonflies in a search space and simulate their movements, two vectors are considered: **step** ($\Delta X$) and **position** ($X$). The step vector is analogous to the velocity vector in PSO, and the DA algorithm is developed based on the framework of the PSO algorithm.

The step vector shows the direction of the movement of the dragonflies and is defined as follows (defined in one dimension, but extendable to higher dimensions):

$$\Delta X_{t+1} = (s S_i + a A_i + c C_i + f F_i + e E_i) + w \Delta X_t \tag{3.6}$$

where:

| Symbol | Parameter | Role during optimization |
|---|---|---|
| $s$ | Separation weight | Controls collision avoidance |
| $S_i$ | Separation of $i$-th individual | — |
| $a$ | Alignment weight | High during exploration, low during exploitation |
| $A_i$ | Alignment of $i$-th individual | — |
| $c$ | Cohesion weight | Low during exploration, high during exploitation |
| $C_i$ | Cohesion of $i$-th individual | — |
| $f$ | Food attraction factor | Drives convergence toward promising regions |
| $F_i$ | Food source of $i$-th individual | — |
| $e$ | Enemy distraction factor | Drives divergence from non-promising regions |
| $E_i$ | Enemy position of $i$-th individual | — |
| $w$ | Inertia weight | Decays (e.g. 0.9 → 0.2) over iterations |
| $t$ | Iteration counter | — |

After calculating the step vector, the position vectors are calculated as follows:

$$X_{t+1} = X_t + \Delta X_{t+1} \tag{3.7}$$

where $t$ is the current iteration.

### 3.3 Neighbourhood and Exploration/Exploitation Balance

Each artificial dragonfly has a neighbourhood — a circle in 2D, sphere in 3D, or hypersphere in $n$D space — with a certain radius around it.

**Exploration vs exploitation weight assignment:**

| Swarm phase | Alignment weight $a$ | Cohesion weight $c$ | Purpose |
|---|---|---|---|
| Exploration (static swarm) | High | Low | Spread across search space, attack preys |
| Exploitation (dynamic swarm) | Low | High | Converge toward optimum |

For transition between exploration and exploitation, the **radii of neighbourhoods are increased proportional to the number of iterations**. Another way is to adaptively tune the swarming factors ($s$, $a$, $c$, $f$, $e$, and $w$) during optimization.

Example parameter setting shown in figures: $w = 0.9\text{–}0.2$, $s = 0.1$, $a = 0.1$, $c = 0.7$, $f = 1$, $e = 1$.

### 3.4 Convergence Guarantee

The dragonflies are required to change their weights adaptively for transiting from exploration to exploitation of the search space. The neighbourhood area is increased as optimization progresses, whereby the swarm becomes one group at the final stage of optimization to converge to the global optimum. **The food source and enemy are chosen from the best and worst solutions that the whole swarm has found so far.** This causes convergence towards promising areas of the search space and divergence outward non-promising regions of the search space.

### 3.5 Lévy Flight for Isolated Dragonflies

To improve the randomness, stochastic behaviour, and exploration of the artificial dragonflies, they are required to fly around the search space using a **random walk (Lévy flight)** when there are no neighbouring solutions. In this case, the position of dragonflies is updated using:

$$X_{t+1} = X_t + \text{Levy}(d) \cdot X_t \tag{3.8}$$

where $t$ is the current iteration, and $d$ is the dimension of the position vectors.

The Lévy flight is calculated as follows [35]:

$$\text{Levy}(\lambda) = 0.01 \times \frac{r_1 \times \sigma}{|r_2|^{1/\beta}} \tag{3.9}$$

where $r_1$, $r_2$ are two random numbers in $[0,1]$, $\beta$ is a constant (equal to 1.5 in this work), and $\sigma$ is calculated as follows:

$$\sigma = \left(\frac{\Gamma(1+\beta) \cdot \sin\!\left(\frac{\pi\beta}{2}\right)}{\Gamma\!\left(\frac{1+\beta}{2}\right) \cdot \beta \cdot 2^{(\beta-1)/2}}\right)^{1/\beta} \tag{3.10}$$

where $\Gamma(x) = (x-1)!$

---

## 3.6 DA Algorithm for Single-Objective Problems

The DA algorithm starts optimization by creating a set of random solutions for a given optimization problem. The position and step vectors of dragonflies are initialized by random values defined within the lower and upper bounds of the variables. In each iteration, the position and step of each dragonfly are updated using Eqs. (3.7)/(3.8) and (3.6). For updating $X$ and $\Delta X$ vectors, the neighbourhood of each dragonfly is chosen by calculating the Euclidean distance between all the dragonflies and selecting $N$ of them. The position updating process is continued iteratively until the end criterion is satisfied.

**Key differences between DA and PSO:** DA considers separation, alignment, cohesion, attraction, distraction, and random walk. Although some works in the literature attempted to integrate separation, alignment, and cohesion into PSO [36–38], this paper models the swarming behaviour of dragonflies by considering all possible factors applied to individuals in a swarm. The concepts of static and dynamic swarms are novel, and the proposed model is completely different from the current improved PSO algorithms in the literature.

### Pseudocode — DA Algorithm (Fig. 5)

```
Initialize the dragonflies population X_i  (i = 1, 2, ..., n)
Initialize step vectors ΔX_i  (i = 1, 2, ..., n)

while the end condition is not satisfied:
    Calculate the objective values of all dragonflies
    Update the food source and enemy
    Update w, s, a, c, f, and e
    Calculate S, A, C, F, and E using Eqs. (3.1) to (3.5)
    Update neighbouring radius

    if a dragonfly has at least one neighbouring dragonfly:
        Update velocity vector using Eq. (3.6)
        Update position vector using Eq. (3.7)
    else:
        Update position vector using Eq. (3.8)   [Lévy random walk]
    end if

    Check and correct the new positions based on the boundaries of variables
end while
```

---

## 3.7 DA Algorithm for Binary Problems (BDA)

Optimization in a binary search space is very different from a continuous space. In continuous search spaces, the search agents of DA are able to update their positions by adding the step vectors to the position vectors. In a binary search space, however, the position of search agents cannot be updated by adding step vectors to $X$ since the position vectors of search agents can only be assigned by 0 or 1.

According to Mirjalili and Lewis [39], the easiest and most effective method to convert a continuous SI technique to a binary algorithm without modifying the structure is to employ a **transfer function**. Transfer functions receive velocity (step) values as inputs and return a number in $[0,1]$, which defines the probability of changing positions. The output is directly proportional to the value of the velocity vector. Therefore, a large value for the velocity of a search agent makes it very likely to update its position.

There are two types of transfer functions: **s-shaped** versus **v-shaped**. According to Saremi et al. [40], the **v-shaped transfer functions are better** than the s-shaped transfer functions because they do not force particles to take values of 0 or 1. In order to solve binary problems with the BDA algorithm, the following transfer function is utilized [39]:

$$T(\Delta x) = \left|\frac{\Delta x}{\sqrt{\Delta x^2 + 1}}\right| \tag{3.11}$$

This transfer function first calculates the probability of changing position for all artificial dragonflies. The following new position updating formula is then employed:

$$X_{t+1} = \begin{cases} \overline{X_t} & \text{if } r < T(\Delta x_{t+1}) \\ X_t & \text{if } r \geq T(\Delta x_{t+1}) \end{cases} \tag{3.12}$$

where $r$ is a random number in the interval $[0,1]$, and $\overline{X_t}$ denotes the complement (bit-flip) of $X_t$.

**Note on BDA neighbourhood:** Since the distance of dragonflies cannot be determined in a binary space as clearly as in a continuous space, the BDA algorithm considers all of the dragonflies as one swarm and simulates exploration/exploitation by adaptively tuning the swarming factors ($s$, $a$, $c$, $f$, and $e$) as well as the inertia weight ($w$).

### Pseudocode — BDA Algorithm (Fig. 7)

```
Initialize the dragonflies population X_i  (i = 1, 2, ..., n)
Initialize step vectors ΔX_i  (i = 1, 2, ..., n)

while the end condition is not satisfied:
    Calculate the objective values of all dragonflies
    Update the food source and enemy
    Update w, s, a, c, f, and e
    Calculate S, A, C, F, and E using Eqs. (3.1) to (3.5)
    Update step vectors using Eq. (3.6)
    Calculate the probabilities using Eq. (3.11)
    Update position vectors using Eq. (3.12)
end while
```

---

## 3.8 DA Algorithm for Multi-Objective Problems (MODA)

### 3.8.1 Problem Formulation

Multi-objective problems have multiple objectives, which are mostly in conflict. The answer for such problems is a set of solutions called **Pareto optimal solutions set**. Without loss of generality, multi-objective optimization can be formulated as a minimization problem as follows:

$$\text{Minimize:} \quad F(\tilde{x}) = \{f_1(\tilde{x}),\, f_2(\tilde{x}),\, \ldots,\, f_o(\tilde{x})\} \tag{3.13}$$

$$\text{Subject to:} \quad g_i(\tilde{x}) \leq 0, \quad i = 1, 2, \ldots, m \tag{3.14}$$

$$h_i(\tilde{x}) = 0, \quad i = 1, 2, \ldots, p \tag{3.15}$$

$$L_i \leq x_i \leq U_i, \quad i = 1, 2, \ldots, n \tag{3.16}$$

where $o$ is the number of objectives, $m$ is the number of inequality constraints, $p$ is the number of equality constraints, and $[L_i, U_i]$ are the boundaries of the $i$-th variable.

### 3.8.2 Pareto Optimality Definitions

**Definition 1 — Pareto Dominance:**

Suppose there are two vectors $\tilde{x} = (x_1, x_2, \ldots, x_k)$ and $\tilde{y} = (y_1, y_2, \ldots, y_k)$. Vector $\tilde{x}$ dominates vector $\tilde{y}$ (denoted $\tilde{x} \prec \tilde{y}$) iff:

$$\forall i \in \{1, 2, \ldots, k\}: f_i(\tilde{x}) \leq f_i(\tilde{y}) \quad \wedge \quad \exists i \in \{1, 2, \ldots, k\}: f_i(\tilde{x}) < f_i(\tilde{y}) \tag{3.17}$$

A solution dominates the other if it shows better or equal values on all objectives and has a strictly better value in at least one objective.

**Definition 2 — Pareto Optimality:**

A solution $\tilde{x} \in X$ is called Pareto optimal iff:

$$\nexists\, \tilde{y} \in X \mid F(\tilde{y}) \prec F(\tilde{x}) \tag{3.18}$$

Two solutions are non-dominated with respect to each other if neither of them dominates the other.

**Definition 3 — Pareto Optimal Set:**

The set of all Pareto optimal solutions:

$$P_s := \{x \mid \nexists\, y \in X : F(y) \prec F(x)\} \tag{3.19}$$

**Definition 4 — Pareto Optimal Front:**

A set containing the value of objective functions for the Pareto solutions set:

$$P_f := \{F(x) \mid x \in P_s\} \tag{3.20}$$

### 3.8.3 Archive-Based MODA

For solving multi-objective problems using the DA algorithm, it is equipped with an **archive (repository)** to store and retrieve the best approximations of the true Pareto optimal solutions during optimization. The updating of position of search agents is identical to that of DA, but the food sources are selected from the archive.

**Two key goals for a multi-objective optimizer:**
- **Convergence:** accurate approximation of true Pareto optimal solutions
- **Coverage:** uniform distribution of obtained Pareto optimal solutions along the objectives

### 3.8.4 Hypersphere Grid for Food and Enemy Selection

In order to find a well-spread Pareto optimal front, a food source is chosen from the **least populated region** of the obtained Pareto optimal front, similarly to the MOPSO algorithm [46]. The search space is segmented by:
1. Finding the best and worst objectives of Pareto optimal solutions obtained
2. Defining a hyper-sphere to cover all the solutions
3. Dividing the hyper-sphere into equal sub-hyper-spheres in each iteration

After creating segments, selection is done by a roulette-wheel mechanism.

```
Hypersphere grid in 2D objective space (conceptual):

  f2 ↑
     │  [●●] [●] [ ] [●●●]   ← most crowded → selected as ENEMY (discourages revisiting)
     │  [ ]  [●] [●] [ ]
     │  [●]  [ ] [●] [●]
     │  [ ]  [ ] [ ] [●]     ← least crowded → selected as FOOD (improves coverage)
     └──────────────────→ f1

  ● = Pareto optimal solution in that segment
  Selection probabilities differ: food from sparse, enemy from dense
```

**Food source selection** (probability for each segment — favours least populated):

$$P_i = \frac{c}{N_i} \tag{3.21}$$

**Enemy selection** (probability for each segment — favours most populated):

$$P_i = \frac{N_i}{c} \tag{3.22}$$

where $c > 1$ is a constant number, and $N_i$ is the number of obtained Pareto optimal solutions in the $i$-th segment.

Equation (3.21) assigns higher probability to less populated segments for food selection, encouraging artificial dragonflies to fly around such regions and improve the distribution of the whole Pareto optimal front. Equation (3.22) assigns high probabilities to the most crowded hyper-spheres for being selected as enemies.

### 3.8.5 Archive Management Rules

The archive should be updated regularly in each iteration and may become full during optimization. Rules (from Coello Coello et al. [47]):

```
Archive update rules:
  1. If new solution is DOMINATED by at least one archive member  →  REJECT (do not add)
  2. If new solution DOMINATES some archive solutions             →  REMOVE all dominated,
                                                                      ADD new solution
  3. If new solution is NON-DOMINATED w.r.t. all archive members →  ADD to archive
  4. If archive is FULL                                           →  REMOVE solution(s)
                                                                      from most populated
                                                                      segment, then ADD new
```

The figure 8 in the paper shows the best candidate hyper-sphere (segments) to remove solutions (enemies) from in case the archive becomes full.

All the parameters of MODA are identical to those of DA except two new parameters: **maximum number of hyper-spheres** and **archive size**.

### Pseudocode — MODA Algorithm (Fig. 9)

```
Initialize the dragonflies population X_i  (i = 1, 2, ..., n)
Initialize step vectors ΔX_i  (i = 1, 2, ..., n)
Define the maximum number of hyper-spheres (segments)
Define the archive size

while the end condition is not satisfied:
    Calculate the objective values of all dragonflies
    Find the non-dominated solutions
    Update the archive with respect to the obtained non-dominated solutions

    if the archive is full:
        Run the archive maintenance mechanism to omit one of the current archive members
        Add the new solution to the archive
    end if

    if any of the new added solutions to the archive is located outside the hyper-spheres:
        Update and re-position all of the hyper-spheres to cover the new solution(s)
    end if

    Select a food source from archive:  food  = SelectFood(archive)
    Select an enemy from archive:       enemy = SelectEnemy(archive)
    Update step vectors using Eq. (3.6)   [note: paper's Fig. 9 references Eq. 3.11 — 
                                           consistent with step update being Eq. 3.6]
    Update position vectors using Eq. (3.7)
    Check and correct the new positions based on the boundaries of variables
end while
```

---

## 4. Results and Discussion

### 4.1 Results of DA Algorithm

Three groups of test functions with different characteristics are selected:

| Group | Functions | What they test | Characteristic |
|---|---|---|---|
| **Unimodal** | TF1–TF7 | Exploitation and convergence | Single global optimum |
| **Multi-modal** | TF8–TF13 | Exploration and local optima avoidance | Multiple optima (one global, many local) |
| **Composite** | TF14–TF19 | Exploration + exploitation combined | Combined, rotated, shifted, biased versions of other functions; mimic real search spaces |

**Experimental setup:** Each algorithm is run 30 times on each test function using 30 search agents over 500 iterations. Average and standard deviation of best approximated solution in the last iteration are reported. The **Wilcoxon non-parametric statistical test** [39, 56] is conducted to assess statistical significance. Initial parameters of PSO and GA are identical to the values in their original papers.

Algorithms compared: **PSO** [54] (best swarm-based technique) and **GA** [55] (best evolutionary algorithm).

**N/A in Table 2 p-values:** When an algorithm is best on a given function, its p-value column is marked N/A (it is the reference for comparison).

#### Table 1 — Statistical Results of DA, PSO, GA on Single-Objective Test Functions

| Test Function | DA Ave | DA Std | PSO Ave | PSO Std | GA Ave | GA Std |
|---|---|---|---|---|---|---|
| TF1 | 2.85E-18 | 7.16E-18 | 4.2E-18 | 1.31E-17 | 748.5972 | 324.9262 |
| TF2 | 1.49E-05 | 3.76E-05 | 0.003154 | 0.009811 | 5.971358 | 1.533102 |
| TF3 | 1.29E-06 | 2.1E-06 | 0.001891 | 0.003311 | 1949.003 | 994.2733 |
| TF4 | 0.000988 | 0.002776 | 0.001748 | 0.002515 | 21.16304 | 2.605406 |
| TF5 | 7.600558 | 6.786473 | 63.45331 | 80.12726 | 133307.1 | 85007.62 |
| TF6 | 4.17E-16 | 1.32E-15 | 4.36E-17 | 1.38E-16 | 563.8889 | 229.6997 |
| TF7 | 0.010293 | 0.004691 | 0.005973 | 0.003583 | 0.166872 | 0.072571 |
| TF8 | -2857.58 | 383.6466 | -7.1E+11 | 1.2E+12 | -3407.25 | 164.4776 |
| TF9 | 16.01883 | 9.479113 | 10.44724 | 7.879807 | 25.51886 | 6.66936 |
| TF10 | 0.23103 | 0.487053 | 0.280137 | 0.601817 | 9.498785 | 1.271393 |
| TF11 | 0.193354 | 0.073495 | 0.083463 | 0.035067 | 7.719959 | 3.62607 |
| TF12 | 0.031101 | 0.098349 | 8.57E-11 | 2.71E-10 | 1858.502 | 5820.215 |
| TF13 | 0.002197 | 0.004633 | 0.002197 | 0.004633 | 68047.23 | 87736.76 |
| TF14 | 103.742 | 91.24364 | 150 | 135.4006 | 130.0991 | 21.32037 |
| TF15 | 193.0171 | 80.6332 | 188.1951 | 157.2834 | 116.0554 | 19.19351 |
| TF16 | 458.2962 | 165.3724 | 263.0948 | 187.1352 | 383.9184 | 36.60532 |
| TF17 | 596.6629 | 171.0631 | 466.5429 | 180.9493 | 503.0485 | 35.79406 |
| TF18 | 229.9515 | 184.6095 | 136.1759 | 160.0187 | 118.438 | 51.00183 |
| TF19 | 679.588 | 199.4014 | 741.6341 | 206.7296 | 544.1018 | 13.30161 |

#### Table 2 — p-Values of the Wilcoxon Rank-Sum Test (DA vs PSO vs GA, Single-Objective)

> N/A indicates the algorithm with best performance on that function (serves as the reference).  
> p < 0.05 indicates statistically significant superiority.

| Function | DA | PSO | GA |
|---|---|---|---|
| TF1 | N/A | 0.045155 | 0.000183 |
| TF2 | N/A | 0.121225 | 0.000183 |
| TF3 | N/A | 0.003611 | 0.000183 |
| TF4 | N/A | 0.307489 | 0.000183 |
| TF5 | N/A | 0.10411 | 0.000183 |
| TF6 | 0.344704 | N/A | 0.000183 |
| TF7 | 0.021134 | N/A | 0.000183 |
| TF8 | 0.000183 | N/A | 0.000183 |
| TF9 | 0.364166 | N/A | 0.002202 |
| TF10 | N/A | 0.472676 | 0.000183 |
| TF11 | 0.001008 | N/A | 0.000183 |
| TF12 | 0.140465 | N/A | 0.000183 |
| TF13 | N/A | 0.79126 | 0.000183 |
| TF14 | N/A | 0.909654 | 0.10411 |
| TF15 | 0.025748 | 0.241322 | N/A |
| TF16 | 0.01133 | N/A | 0.053903 |
| TF17 | 0.088973 | N/A | 0.241322 |
| TF18 | 0.273036 | 0.791337 | N/A |
| TF19 | N/A | 0.472676 | N/A |

#### Analysis of DA Results

**Unimodal functions (TF1–TF7):** DA outperforms PSO and GA on the majority of cases. p-values < 0.05 confirm statistical significance. This demonstrates that DA benefits from high exploitation, which assists it to rapidly converge towards and accurately exploit the global optimum.

**Multi-modal functions (TF8–TF13):** DA provides very competitive results compared to PSO. Both DA and PSO show significantly better results than GA. DA demonstrates high exploration which assists it to discover promising regions of the search space. The local optima avoidance of this algorithm is satisfactory since it approximates the global optima on the majority of the multi-modal test functions.

**Composite functions (TF14–TF19):** DA provides very competitive results and outperforms others occasionally. However, the p-values show that the superiority is not as significant as those of unimodal and multi-modal test functions. This is due to the difficulty of composite test functions. These results prove that the operators of the DA algorithm appropriately balance exploration and exploitation to handle difficulty in a challenging search space. Since composite search spaces are highly similar to real search spaces, these results make the DA algorithm potentially able to solve challenging optimization problems.

#### Four Behavioural Metrics (TF2, TF10, TF17 — 10 search agents, 150 iterations)

| Metric | What is measured | Observed behaviour |
|---|---|---|
| **Search history** | Position of dragonflies from first to last iteration | DA searches promising regions extensively; TF17 (composite) shows high coverage of search space |
| **Trajectory** | Value of a parameter from first to last iteration | Abrupt changes in initial iterations gradually decrease over course of iterations. According to Berg et al. [57], this behaviour guarantees eventual convergence to a point and local search |
| **Average fitness** | Average fitness of dragonflies from first to last iteration | Monotonically decreasing on all test functions — proves DA improves the overall fitness of the initial random population |
| **Convergence curve** | Fitness of best food source from first to last iteration | Approximation of global optimum becomes more accurate as iteration counter increases; accelerated convergence trend in final steps due to emphasis on exploitation |

**Summary:** DA shows high exploration (static swarm) which avoids local optima stagnation, and dynamic swarm emphasizes exploitation as iterations increase, causing very accurate approximation of the global optimum.

---

### 4.2 Results of BDA Algorithm

**Experimental setup for BDA:**
- Test functions: TF1–TF13 (from Sect. 4.1 and Appendix 1)
- Binary space simulation: 15 bits to define each variable
- Dimension of test functions: reduced from 30 to 5
- Total binary variables: $5 \times 15 = 75$
- Runs: 30 per algorithm
- Comparison algorithms: **BPSO** (Binary PSO) [58] and **BGSA** (Binary Gravitational Search Algorithm) [59]
- Parameters of BPSO and BGSA are identical to values in their original papers

#### Table 3 — Statistical Results of BDA, BPSO, BGSA on Binary Test Functions

| Test Function | BDA Ave | BDA Std | BPSO Ave | BPSO Std | BGSA Ave | BGSA Std |
|---|---|---|---|---|---|---|
| TF1 | 0.281519 | 0.417723 | 5.589032 | 1.97734 | 82.95707 | 49.78105 |
| TF2 | 0.058887 | 0.069279 | 0.196191 | 0.052809 | 1.192117 | 0.228392 |
| TF3 | 14.23555 | 22.68806 | 15.51722 | 13.68939 | 455.9297 | 271.9785 |
| TF4 | 0.247656 | 0.330822 | 1.895313 | 0.483579 | 7.366406 | 2.213344 |
| TF5 | 23.55335 | 34.6822 | 86.44629 | 65.82514 | 3100.999 | 2927.557 |
| TF6 | 0.095306 | 0.129678 | 6.980524 | 3.849114 | 106.8896 | 77.54615 |
| TF7 | 0.012209 | 0.014622 | 0.011745 | 0.006925 | 0.03551 | 0.056549 |
| TF8 | -924.481 | 65.68827 | -988.565 | 16.66224 | -860.914 | 80.56628 |
| TF9 | 1.805453 | 1.053829 | 4.834208 | 1.549026 | 10.27209 | 3.725984 |
| TF10 | 0.388227 | 0.5709 | 2.154889 | 0.540556 | 2.786707 | 1.188036 |
| TF11 | 0.193437 | 0.113621 | 0.47729 | 0.129354 | 0.788799 | 0.251103 |
| TF12 | 0.149307 | 0.451741 | 0.407433 | 0.231344 | 9.526426 | 6.513454 |
| TF13 | 0.035156 | 0.056508 | 0.306925 | 0.241643 | 2216.776 | 5663.491 |

#### Table 4 — p-Values of the Wilcoxon Rank-Sum Test (BDA vs BPSO vs BGSA)

> N/A indicates the best-performing algorithm on that function.

| Function | BDA | BPSO | BGSA |
|---|---|---|---|
| TF1 | N/A | 0.000183 | 0.000183 |
| TF2 | N/A | 0.001706 | 0.000183 |
| TF3 | N/A | 0.121225 | 0.000246 |
| TF4 | N/A | 0.000211 | 0.000183 |
| TF5 | N/A | 0.009108 | 0.000183 |
| TF6 | N/A | 0.000183 | 0.000183 |
| TF7 | 0.472676 | N/A | 0.344704 |
| TF8 | 0.064022 | N/A | 0.000583 |
| TF9 | N/A | 0.000583 | 0.000183 |
| TF10 | N/A | 0.00033 | 0.00044 |
| TF11 | N/A | 0.000583 | 0.00033 |
| TF12 | N/A | 0.002827 | 0.000183 |
| TF13 | N/A | 0.000583 | 0.000183 |

**Analysis:** Table 3 shows that the proposed BDA algorithm outperforms both BPSO and BGSA on the majority of binary test cases. The discrepancy of results is very evident in the p-values of Table 4. These results prove that the BDA algorithm inherits high exploration and exploitation from the DA algorithm due to the use of the v-shaped transfer function.

---

### 4.3 Results of MODA Algorithm

**Multi-objective test functions:** 5 challenging test functions from the well-known ZDT set proposed by Deb et al. [60]. The first three are identical to ZDT1, ZDT2, and ZDT3. ZDT1 and ZDT2 are modified to have test problems with linear and tri-objective fronts as the last two case studies (details in Appendix 2).

**Performance metric — Inverse Generational Distance (IGD)** [61] over 10 runs:

$$\text{IGD} = \frac{\sqrt{\sum_{i=1}^{n} d_i^2}}{n} \tag{4.1}$$

where $n$ is the number of true Pareto optimal solutions, and $d_i$ indicates the Euclidean distance between the $i$-th true Pareto optimal solution and the closest obtained Pareto optimal solution in the reference set. **Lower IGD = better convergence and coverage.** This metric is similar to generational distance (GD) [62].

**Comparison algorithms:** MOPSO [47] and NSGA-II [63].

Qualitative results: best Pareto optimal front in ten independent runs is presented for each algorithm.

#### Table 5 — MODA vs MOPSO vs NSGA-II on ZDT1

| Algorithm | Ave | Std | Median | Best | Worst |
|---|---|---|---|---|---|
| MODA | 0.00612 | 0.002863 | 0.0072 | 0.0024 | 0.0096 |
| MOPSO | 0.00422 | 0.003103 | 0.0037 | 0.0015 | 0.0101 |
| NSGA-II | 0.05988 | 0.005436 | 0.0574 | 0.0546 | 0.0702 |

#### Table 6 — MODA vs MOPSO vs NSGA-II on ZDT2

| Algorithm | Ave | Std | Median | Best | Worst |
|---|---|---|---|---|---|
| MODA | 0.00398 | 0.001604244 | 0.0033 | 0.0023 | 0.006 |
| MOPSO | 0.00156 | 0.000174356 | 0.0017 | 0.0013 | 0.0017 |
| NSGA-II | 0.13972 | 0.026263465 | 0.1258 | 0.1148 | 0.1834 |

#### Table 7 — MODA vs MOPSO vs NSGA-II on ZDT3

| Algorithm | Ave | Std | Median | Best | Worst |
|---|---|---|---|---|---|
| MODA | **0.02794** | 0.004021 | 0.0302 | 0.02 | 0.0304 |
| MOPSO | 0.03782 | 0.006297 | 0.0362 | 0.0308 | 0.0497 |
| NSGA-II | 0.04166 | 0.008073 | 0.0403 | 0.0315 | 0.0557 |

#### Table 8 — MODA vs MOPSO vs NSGA-II on ZDT1 with Linear Pareto Front

| Algorithm | Ave | Std | Median | Best | Worst |
|---|---|---|---|---|---|
| MODA | 0.00616 | 0.005186 | 0.0038 | 0.0022 | 0.0163 |
| MOPSO | 0.00922 | 0.005531 | 0.0098 | 0.0012 | 0.0165 |
| NSGA-II | 0.08274 | 0.005422 | 0.0804 | 0.0773 | 0.0924 |

#### Table 9 — MODA vs MOPSO vs NSGA-II on ZDT2 with Three Objectives

| Algorithm | Ave | Std | Median | Best | Worst |
|---|---|---|---|---|---|
| MODA | **0.00916** | 0.005372 | 0.0063 | 0.0048 | 0.0191 |
| MOPSO | 0.02032 | 0.001278 | 0.0203 | 0.0189 | 0.0225 |
| NSGA-II | 0.0626 | 0.017888 | 0.0584 | 0.0371 | 0.0847 |

#### Analysis of MODA Results

The MODA algorithm tends to outperform NSGA-II and provides very competitive results compared to MOPSO on the majority of the test functions. Qualitative figures (Figs. 14–18 in paper) show that convergence and coverage of Pareto optimal solutions obtained by MODA are mostly better than NSGA-II.

**High convergence of MODA** originates from the accelerated convergence of search agents around the food sources selected from the archive over the course of iterations. Adaptive values for $s$, $a$, $c$, $f$, $e$, and $w$ in MODA allow its search agents to converge towards the food sources proportional to the number of iterations.

**High coverage of MODA** is due to the employed food/enemy selection mechanisms. Since the foods and enemies are selected from the less populated and most populated hyper-spheres, respectively, the search agents of MODA tend to search regions of the search space that have Pareto optimal solutions with low distribution and avoid highly distributed regions in the Pareto front. Therefore, the distribution of the Pareto optimal solutions is adjusted and increased along the obtained Pareto optimal front. The maintenance mechanism for a full archive also assists MODA to discard excess Pareto optimal solutions (enemies) in populated segments and allows adding new food sources in less populated regions. These results evidence the merits of MODA in solving multi-objective problems as a posteriori algorithm.

---

### 4.4 Real Case Study — Submarine Propeller Design

To demonstrate the applicability of MODA in practice, a submarine's propeller is optimized. This problem has two objectives that are in conflict:

$$\text{Maximize:} \quad \eta(X) \quad \text{(efficiency)} \tag{4.2}$$

$$\text{Minimize:} \quad V(X) \quad \text{(cavitation)} \tag{4.3}$$

$$\text{Subject to:} \quad T > 40{,}000 \text{ N}, \quad \text{RPM} = 200, \quad Z = 7, \quad D = 2, \quad d = 0.4, \quad S = 5 \tag{4.4}$$

where $\eta$ is efficiency, $V$ is cavitation, $T$ is thrust (N), RPM is rotation per minute of the propeller, $Z$ is the number of blades, $D$ is the diameter of the propeller (m), $d$ is the diameter of hub (m), and $S$ is the ship speed (m/s).

The full list of constraints and other physical details of the propeller design problem are not provided in the paper; interested readers are referred to Carlton's book [64].

**Propeller geometry:**
- 7-blade propeller with 2 m diameter
- Each blade is divided into **10 airfoil cross-sections**
- Each airfoil is determined by **2 structural parameters**: maximum thickness and chord length
- **Total design variables: 20 continuous parameters**

```
Airfoil parameters (per cross-section):
  ┌─────────────────────────┐
  │         ←chord length→  │
  │   ╔══════════════════╗  │
  │   ║                  ║  │ ↕ maximum thickness
  │   ╚══════════════════╝  │
  └─────────────────────────┘
  (10 such airfoils stacked along blade span)
```

**Experimental setup:** MODA with 200 artificial dragonflies over 300 iterations.

**Constraint handling:** Death penalty method — artificial dragonflies that violate any constraint are assigned very low efficiency and large cavitation, making them automatically dominated when finding non-dominated solutions in the next iteration.

**Results:** MODA found **61 Pareto optimal solutions** for this problem. The low density of searched points (grey dots in Fig. 21 of paper) is due to the highly constrained nature of this problem. However, MODA successfully improved the initial random designs and determined a very accurate approximation of the true Pareto optimal front. The solutions are highly distributed along both objectives, confirming the coverage of this algorithm in practice.

```
Schematic of obtained Pareto optimal front (efficiency vs cavitation trade-off):

  -cavitation ↑
    -25.15 │●
           │ ●●
    -25.20 │   ●●●
           │      ●●●
    -25.25 │         ●●
           │            ●●●
    -25.30 │               ●●●
           │                  ●●
    -25.35 │                    ●●
           └────────────────────────→ efficiency
            0.668  0.672  0.676  0.680

  ● = Pareto optimal design (61 solutions total)
  (Grey search history dots not shown — dense near Pareto front)
```

These results prove the convergence and coverage of MODA in solving real problems with unknown true Pareto optimal front. Since the propeller design problem is highly constrained, these results also evidence the merits of MODA in solving challenging constrained problems.

---

## 5. Conclusion

This paper proposed another SI algorithm inspired by the behaviour of dragonflies' swarms in nature. Static and dynamic swarming behaviours of dragonflies were implemented to explore and exploit the search space, respectively. The algorithm was equipped with five parameters to control cohesion, alignment, separation, attraction (towards food sources), and distraction (outwards enemies) of individuals in the swarm. Suitable operators were integrated to the proposed DA algorithm for solving binary and multi-objective problems as well. A series of continuous, binary, and multi-objective test problems were employed to benchmark the performance of the DA, BDA, and MODA algorithms from different perspectives.

**Key findings:**
- All proposed algorithms benefit from high exploration, which is due to the proposed static swarming behaviour of dragonflies.
- The convergence of the artificial dragonflies towards optimal solutions in continuous, binary, and multi-objective search spaces was observed and confirmed, which are due to the dynamic swarming pattern modelled in this paper.
- The paper also considered designing a real propeller for submarines using the proposed MODA algorithm, which is a challenging and highly constrained CFD problem. The results proved the effectiveness of the multi-objective version of DA in solving real problems with unknown search spaces.
- As per the findings of this comprehensive study, the proposed algorithms are able to outperform the current well-known and powerful algorithms in the literature. Therefore, they are recommended to researchers from different fields as open-source optimization tools.

**Source codes of DA, BDA, and MODA are publicly available at:** http://www.alimirjalili.com/DA.html

**Future research directions:**
- Hybridizing other algorithms with DA and integrating evolutionary operators to this algorithm
- For the BDA algorithm: investigating the effects of different transfer functions on performance
- Applying other multi-objective optimization approaches (non-dominated sorting for instance) to MODA
- The DA, BDA, and MODA algorithms can all be tuned and employed to solve optimization problems in different fields

---

## Acknowledgments

The author would like to thank Mehrdad Momeny for providing his outstanding dragonfly photo.

---

## Appendix 1: Single-Objective Test Problems

### Table 10 — Unimodal Benchmark Functions (dim = 10)

| Function | Formula | Dim | Range | Shift Position | $f_{\min}$ |
|---|---|---|---|---|---|
| TF1 | $\displaystyle\sum_{i=1}^{n} x_i^2$ | 10 | $[-100, 100]$ | $[-30,-30,\ldots,-30]$ | 0 |
| TF2 | $\displaystyle\sum_{i=1}^{n} \|x_i\| + \prod_{i=1}^{n} \|x_i\|$ | 10 | $[-10, 10]$ | $[-3,-3,\ldots,-3]$ | 0 |
| TF3 | $\displaystyle\sum_{i=1}^{n} \left(\sum_{j=1}^{i} x_j\right)^2$ | 10 | $[-100, 100]$ | $[-30,-30,\ldots,-30]$ | 0 |
| TF4 | $\max_i\{\|x_i\|,\, 1 \leq i \leq n\}$ | 10 | $[-100, 100]$ | $[-30,-30,\ldots,-30]$ | 0 |
| TF5 | $\displaystyle\sum_{i=1}^{n-1}\left[100\!\left(x_{i+1} - x_i^2\right)^2 + (x_i - 1)^2\right]$ | 10 | $[-30, 30]$ | $[-15,-15,\ldots,-15]$ | 0 |
| TF6 | $\displaystyle\sum_{i=1}^{n} \left(\lfloor x_i + 0.5 \rfloor\right)^2$ | 10 | $[-100, 100]$ | $[-750,\ldots,-750]$ | 0 |
| TF7 | $\displaystyle\sum_{i=1}^{n} i x_i^4 + \text{random}[0, 1)$ | 10 | $[-1.28, 1.28]$ | $[-0.25,\ldots,-0.25]$ | 0 |

### Table 11 — Multimodal Benchmark Functions (dim = 10)

| Function | Formula | Dim | Range | Shift Position | $f_{\min}$ |
|---|---|---|---|---|---|
| TF8 | $\displaystyle\sum_{i=1}^{n} -x_i \sin\!\left(\sqrt{\|x_i\|}\right)$ | 10 | $[-500, 500]$ | $[-300,\ldots,-300]$ | $-418.9829 \times 5$ |
| TF9 | $\displaystyle\sum_{i=1}^{n} \left[x_i^2 - 10\cos(2\pi x_i) + 10\right]$ | 10 | $[-5.12, 5.12]$ | $[-2,-2,\ldots,-2]$ | 0 |
| TF10 | $-20\exp\!\left(-0.2\sqrt{\frac{1}{n}\sum_{i=1}^{n} x_i^2}\right) - \exp\!\left(\frac{1}{n}\sum_{i=1}^{n}\cos(2\pi x_i)\right) + 20 + e$ | 10 | $[-32, 32]$ | — | 0 |
| TF11 | $\displaystyle\frac{1}{4000}\sum_{i=1}^{n} x_i^2 - \prod_{i=1}^{n}\cos\!\left(\frac{x_i}{\sqrt{i}}\right) + 1$ | 10 | $[-600, 600]$ | $[-400,\ldots,-400]$ | 0 |
| TF12 | $\displaystyle\frac{\pi}{n}\left\{10\sin(\pi y_1) + \sum_{i=1}^{n-1}(y_i-1)^2\left[1+10\sin^2(\pi y_{i+1})\right] + (y_n-1)^2\right\} + \sum_{i=1}^{n} u(x_i, 10, 100, 4)$ | 10 | $[-50, 50]$ | $[-30,-30,\ldots,-30]$ | 0 |
| TF13 | $\displaystyle0.1\left\{\sin^2(3\pi x_1) + \sum_{i=1}^{n}(x_i-1)^2\left[1+\sin^2(3\pi x_i+1)\right] + (x_n-1)^2\left[1+\sin^2(2\pi x_n)\right]\right\} + \sum_{i=1}^{n} u(x_i, 5, 100, 4)$ | 10 | $[-50, 50]$ | $[-100,\ldots,-100]$ | 0 |

**For TF12 and TF13**, $y_i$ and $u(x_i, a, k, m)$ are defined as:

$$y_i = 1 + \frac{x_i + 1}{4}$$

$$u(x_i, a, k, m) = \begin{cases} k(x_i - a)^m & x_i > a \\ 0 & -a < x_i < a \\ k(-x_i - a)^m & x_i < -a \end{cases}$$

### Table 12 — Composite Benchmark Functions (dim = 10, range = $[-5, 5]$, $f_{\min} = 0$)

Composite functions are combined, rotated, shifted, and biased versions of basic functions. Each composite function $CF$ is built from 10 component functions $f_1, \ldots, f_{10}$ with scaling parameters $\bar{\sigma}$ (stretch) and $\lambda$ (weight):

**TF14 (CF1):**
- $f_1, f_2, f_3, \ldots, f_{10}$ = Sphere function
- $[\bar{\sigma}_1, \bar{\sigma}_2, \bar{\sigma}_3, \ldots, \bar{\sigma}_{10}] = [1, 1, 1, \ldots, 1]$
- $[\lambda_1, \lambda_2, \lambda_3, \ldots, \lambda_{10}] = [5/100, 5/100, 5/100, \ldots, 5/100]$

**TF15 (CF2):**
- $f_1, f_2, f_3, \ldots, f_{10}$ = Griewank's function
- $[\bar{\sigma}_1, \bar{\sigma}_2, \bar{\sigma}_3, \ldots, \bar{\sigma}_{10}] = [1, 1, 1, \ldots, 1]$
- $[\lambda_1, \lambda_2, \lambda_3, \ldots, \lambda_{10}] = [5/100, 5/100, 5/100, \ldots, 5/100]$

**TF16 (CF3):**
- $f_1, f_2, f_3, \ldots, f_{10}$ = Griewank's function
- $[\bar{\sigma}_1, \bar{\sigma}_2, \bar{\sigma}_3, \ldots, \bar{\sigma}_{10}] = [1, 1, 1, \ldots, 1]$
- $[\lambda_1, \lambda_2, \lambda_3, \ldots, \lambda_{10}] = [1, 1, 1, \ldots, 1]$

**TF17 (CF4):**
- $f_1, f_2$ = Ackley's function
- $f_3, f_4$ = Rastrigin's function
- $f_5, f_6$ = Weierstrass function
- $f_7, f_8$ = Griewank's function
- $f_9, f_{10}$ = Sphere function
- $[\bar{\sigma}_1, \bar{\sigma}_2, \ldots, \bar{\sigma}_{10}] = [1, 1, 1, \ldots, 1]$
- $[\lambda_1, \lambda_2, \lambda_3, \ldots, \lambda_{10}] = [5/32, 5/32, 1, 1, 5/0.5, 5/0.5, 5/100, 5/100, 5/100, 5/100]$

**TF18 (CF5):**
- $f_1, f_2$ = Rastrigin's function
- $f_3, f_4$ = Weierstrass function
- $f_5, f_6$ = Griewank's function
- $f_7, f_8$ = Ackley's function
- $f_9, f_{10}$ = Sphere function
- $[\bar{\sigma}_1, \bar{\sigma}_2, \ldots, \bar{\sigma}_{10}] = [1, 1, 1, \ldots, 1]$
- $[\lambda_1, \lambda_2, \lambda_3, \ldots, \lambda_{10}] = [1/5, 1/5, 5/0.5, 5/0.5, 5/100, 5/100, 5/32, 5/32, 5/100, 5/100]$

**TF19 (CF6):**
- $f_1, f_2$ = Rastrigin's function
- $f_3, f_4$ = Weierstrass function
- $f_5, f_6$ = Griewank's function
- $f_7, f_8$ = Ackley's function
- $f_9, f_{10}$ = Sphere function
- $[\bar{\sigma}_1, \bar{\sigma}_2, \ldots, \bar{\sigma}_{10}] = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1]$
- $[\lambda_1, \lambda_2, \ldots, \lambda_{10}] = [0.1 \times 1/5,\; 0.2 \times 1/5,\; 0.3 \times 5/0.5,\; 0.4 \times 5/0.5,\; 0.5 \times 5/100,\; 0.6 \times 5/100,\; 0.7 \times 5/32,\; 0.8 \times 5/32,\; 0.9 \times 5/100,\; 1 \times 5/100]$

---

## Appendix 2: Multi-Objective Test Problems

All ZDT functions: $n = 30$ variables, $0 \leq x_i \leq 1$, $1 \leq i \leq 30$.

### ZDT1 (Convex Pareto front)

$$\text{Minimise:} \quad f_1(x) = x_1 \tag{7.1}$$

$$\text{Minimise:} \quad f_2(x) = g(x) \cdot h(f_1(x),\, g(x)) \tag{7.2}$$

$$\text{Where:} \quad G(x) = 1 + \frac{9}{N-1}\sum_{i=2}^{N} x_i \tag{7.3}$$

$$h(f_1(x),\, g(x)) = 1 - \sqrt{\frac{f_1(x)}{g(x)}}, \qquad 0 \leq x_i \leq 1,\; 1 \leq i \leq 30 \tag{7.4}$$

### ZDT2 (Non-convex Pareto front)

$$\text{Minimise:} \quad f_1(x) = x_1 \tag{7.5}$$

$$\text{Minimise:} \quad f_2(x) = g(x) \cdot h(f_1(x),\, g(x)) \tag{7.6}$$

$$\text{Where:} \quad G(x) = 1 + \frac{9}{N-1}\sum_{i=2}^{N} x_i \tag{7.7}$$

$$h(f_1(x),\, g(x)) = 1 - \left(\frac{f_1(x)}{g(x)}\right)^2, \qquad 0 \leq x_i \leq 1,\; 1 \leq i \leq 30 \tag{7.8}$$

### ZDT3 (Discontinuous Pareto front)

$$\text{Minimise:} \quad f_1(x) = x_1 \tag{7.9}$$

$$\text{Minimise:} \quad f_2(x) = g(x) \cdot h(f_1(x),\, g(x)) \tag{7.10}$$

$$\text{Where:} \quad G(x) = 1 + \frac{9}{29}\sum_{i=2}^{N} x_i \tag{7.11}$$

$$h(f_1(x),\, g(x)) = 1 - \sqrt{\frac{f_1(x)}{g(x)}} - \frac{f_1(x)}{g(x)}\sin(10\pi f_1(x)), \qquad 0 \leq x_i \leq 1,\; 1 \leq i \leq 30 \tag{7.12}$$

### ZDT1 with Linear Pareto Front

$$\text{Minimise:} \quad f_1(x) = x_1 \tag{7.13}$$

$$\text{Minimise:} \quad f_2(x) = g(x) \cdot h(f_1(x),\, g(x)) \tag{7.14}$$

$$\text{Where:} \quad G(x) = 1 + \frac{9}{N-1}\sum_{i=2}^{N} x_i \tag{7.15}$$

$$h(f_1(x),\, g(x)) = 1 - \frac{f_1(x)}{g(x)}, \qquad 0 \leq x_i \leq 1,\; 1 \leq i \leq 30 \tag{7.16}$$

### ZDT2 with Three Objectives

$$\text{Minimise:} \quad f_1(x) = x_1 \tag{7.17}$$

$$\text{Minimise:} \quad f_2(x) = x_2 \tag{7.18}$$

$$\text{Minimise:} \quad f_3(x) = g(x) \cdot h(f_1(x),\, g(x)) \cdot h(f_2(x),\, g(x)) \tag{7.19}$$

$$\text{Where:} \quad G(x) = 1 + \frac{9}{N-1}\sum_{i=3}^{N} x_i \tag{7.20}$$

$$h(f_k(x),\, g(x)) = 1 - \left(\frac{f_k(x)}{g(x)}\right)^2, \qquad 0 \leq x_i \leq 1,\; 1 \leq i \leq 30 \tag{7.21}$$

---

## References

1. Mirjalili S, Mirjalili SM, Lewis A (2014) Grey wolf optimizer. Adv Eng Softw 69:46–61
2. Muro C, Escobedo R, Spector L, Coppinger R (2011) Wolf-pack (Canis lupus) hunting strategies emerge from simple rules in computational simulations. Behav Process 88:192–197
3. Jakobsen PJ, Birkeland K, Johnsen GH (1994) Swarm location in zooplankton as an anti-predator defence mechanism. Anim Behav 47:175–178
4. Higdon J, Corrsin S (1978) Induced drag of a bird flock. Am Nat 112(986):727–744
5. Goss S, Aron S, Deneubourg J-L, Pasteels JM (1989) Self-organized shortcuts in the Argentine ant. Naturwissenschaften 76:579–581
6. Beni G, Wang J (1993) Swarm intelligence in cellular robotic systems. In: Dario P, Sandini G, Aebischer P (eds) Robots and biological systems: towards a new bionics? NATO ASI series, vol 102. Springer, Berlin, Heidelberg, pp 703–712
7. Bonabeau E, Dorigo M, Theraulaz G (1999) Swarm intelligence: from natural to artificial systems. Oxford University Press, Oxford
8. Dorigo M, Stützle T (2003) The ant colony optimization metaheuristic: algorithms, applications, and advances. In: Glover F, Kochenberger GA (eds) Handbook of metaheuristics. International series in operations research & management science, vol 57. Springer, USA, pp 250–285
9. Dorigo M, Maniezzo V, Colorni A (1996) Ant system: optimization by a colony of cooperating agents. Syst Man Cybern Part B Cybern IEEE Trans 26:29–41
10. Colorni A, Dorigo M, Maniezzo V (1991) Distributed optimization by ant colonies. In: Proceedings of the first European conference on artificial life, pp 134–142
11. Eberhart RC, Kennedy J (1995) A new optimizer using particle swarm theory. In: Proceedings of the sixth international symposium on micro machine and human science, pp 39–43
12. Eberhart RC, Shi Y (2001) Particle swarm optimization: developments, applications and resources. In: Proceedings of the 2001 congress on evolutionary computation, pp 81–86
13. Karaboga D (2005) An idea based on honey bee swarm for numerical optimization. In: Technical report-tr06, Erciyes university, engineering faculty, computer engineering department
14. Karaboga D, Basturk B (2007) A powerful and efficient algorithm for numerical function optimization: artificial bee colony (ABC) algorithm. J Global Optim 39:459–471
15. AlRashidi MR, El-Hawary ME (2009) A survey of particle swarm optimization applications in electric power systems. Evolut Comput IEEE Trans 13:913–918
16. Wei Y, Qiqiang L (2004) Survey on particle swarm optimization algorithm. Eng Sci 5:87–94
17. Chandra Mohan B, Baskaran R (2012) A survey: ant colony optimization based recent research and implementation on several engineering domain. Expert Syst Appl 39:4618–4627
18. Dorigo M, Stützle T (2010) Ant colony optimization: overview and recent advances. In: Gendreau M, Potvin J-Y (eds) Handbook of metaheuristics. International series in operations research & management science, vol 146. Springer, USA, pp 227–263
19. Karaboga D, Gorkemli B, Ozturk C, Karaboga N (2014) A comprehensive survey: artificial bee colony (ABC) algorithm and applications. Artif Intell Rev 42:21–57
20. Sonmez M (2011) Artificial Bee Colony algorithm for optimization of truss structures. Appl Soft Comput 11:2406–2418
21. Wang G, Guo L, Wang H, Duan H, Liu L, Li J (2014) Incorporating mutation scheme into krill herd algorithm for global numerical optimization. Neural Comput Appl 24:853–871
22. Wang G-G, Gandomi AH, Alavi AH (2014) Stud krill herd algorithm. Neurocomputing 128:363–370
23. Wang G-G, Gandomi AH, Alavi AH (2014) An effective krill herd algorithm with migration operator in biogeography-based optimization. Appl Math Model 38:2454–2462
24. Wang G-G, Gandomi AH, Alavi AH, Hao G-S (2014) Hybrid krill herd algorithm with differential evolution for global numerical optimization. Neural Comput Appl 25:297–308
25. Wang G-G, Gandomi AH, Zhao X, Chu HCE (2014) Hybridizing harmony search algorithm with cuckoo search for global numerical optimization. Soft Comput. doi:10.1007/s00500-014-1502-7
26. Wang G-G, Guo L, Gandomi AH, Hao G-S, Wang H (2014) Chaotic krill herd algorithm. Inf Sci 274:17–34
27. Wang G-G, Lu M, Dong Y-Q, Zhao X-J (2015) Self-adaptive extreme learning machine. Neural Comput Appl. doi:10.1007/s00521-015-1874-3
28. Mirjalili S (2015) The ant lion optimizer. Adv Eng Softw 83:80–98
29. Mirjalili S, Mirjalili SM, Hatamlou A (2015) Multi-Verse Optimizer: a nature-inspired algorithm for global optimization. Neural Comput Appl. doi:10.1007/s00521-015-1870-7
30. Wolpert DH, Macready WG (1997) No free lunch theorems for optimization. Evolut Comput IEEE Trans 1(1):67–82
31. Thorp JH, Rogers DC (2014) Thorp and Covich's freshwater invertebrates: ecology and general biology. Elsevier, Amsterdam
32. Wikelski M, Moskowitz D, Adelman JS, Cochran J, Wilcove DS, May ML (2006) Simple rules guide dragonfly migration. Biol Lett 2:325–329
33. Russell RW, May ML, Soltesz KL, Fitzpatrick JW (1998) Massive swarm migrations of dragonflies (Odonata) in eastern North America. Am Midl Nat 140:325–342
34. Reynolds CW (1987) Flocks, herds and schools: a distributed behavioral model. ACM SIGGRAPH Comput Gr 21:25–34
35. Yang X-S (2010) Nature-inspired metaheuristic algorithms, 2nd edn. Luniver Press
36. Cui Z, Shi Z (2009) Boid particle swarm optimisation. Int J Innov Comput Appl 2:77–85
37. Kadrovach BA, Lamont GB (2002) A particle swarm model for swarm-based networked sensor systems. In: Proceedings of the 2002 ACM symposium on applied computing, pp 918–924
38. Cui Z (2009) Alignment particle swarm optimization. In: Cognitive informatics, 2009. ICCI'09. 8th IEEE international conference on, pp 497–501
39. Mirjalili S, Lewis A (2013) S-shaped versus V-shaped transfer functions for binary particle swarm optimization. Swarm Evolut Comput 9:1–14
40. Saremi S, Mirjalili S, Lewis A (2014) How important is a transfer function in discrete heuristic algorithms. Neural Comput Appl:1–16
41. Mirjalili S, Wang G-G, Coelho LDS (2014) Binary optimization using hybrid particle swarm optimization and gravitational search algorithm. Neural Comput Appl 25:1423–1435
42. Mirjalili S, Lewis A (2015) Novel performance metrics for robust multi-objective optimization algorithms. Swarm Evolut Comput 21:1–23
43. Coello CAC (2009) Evolutionary multi-objective optimization: some current research trends and topics that remain to be explored. Front Comput Sci China 3:18–30
44. Ngatchou P, Zarei A, El-Sharkawi M (2005) Pareto multi objective optimization. In: Intelligent systems application to power systems, 2005. Proceedings of the 13th international conference on, pp 84–91
45. Branke J, Kaußler T, Schmeck H (2001) Guidance in evolutionary multi-objective optimization. Adv Eng Softw 32:499–507
46. Coello Coello CA, Lechuga MS (2002) MOPSO: A proposal for multiple objective particle swarm optimization. In: Evolutionary computation, 2002. CEC'02. Proceedings of the 2002 congress on, pp 1051–1056
47. Coello CAC, Pulido GT, Lechuga MS (2004) Handling multiple objectives with particle swarm optimization. Evolut Comput IEEE Trans 8:256–279
48. Yao X, Liu Y, Lin G (1999) Evolutionary programming made faster. Evolut Comput IEEE Trans 3:82–102
49. Digalakis J, Margaritis K (2001) On benchmarking functions for genetic algorithms. Int J Comput Mathematics 77:481–506
50. Molga M, Smutnicki C (2005) Test functions for optimization needs. http://www.robertmarks.org/Classes/ENGR5358/Papers/functions.pdf
51. Yang X-S (2010) Test problems in optimization. arXiv preprint arXiv:1008.0549
52. Liang J, Suganthan P, Deb K (2005) Novel composition test functions for numerical global optimization. In: Swarm intelligence symposium, 2005. SIS 2005. Proceedings 2005 IEEE, pp 68–75
53. Suganthan PN, Hansen N, Liang JJ, Deb K, Chen Y, Auger A et al (2005) Problem definitions and evaluation criteria for the CEC 2005 special session on real-parameter optimization. In: KanGAL Report, vol 2005005
54. Kennedy J, Eberhart R (1995) Particle swarm optimization. In: Neural networks, 1995. Proceedings, IEEE International conference on, pp 1942–1948
55. John H (1992) Holland, adaptation in natural and artificial systems. MIT Press, Cambridge
56. Derrac J, García S, Molina D, Herrera F (2011) A practical tutorial on the use of nonparametric statistical tests as a methodology for comparing evolutionary and swarm intelligence algorithms. Swarm Evolut Comput 1:3–18
57. van den Bergh F, Engelbrecht A (2006) A study of particle swarm optimization particle trajectories. Inf Sci 176:937–971
58. Kennedy J, Eberhart RC (1997) A discrete binary version of the particle swarm algorithm. In: Systems, man, and cybernetics, 1997. computational cybernetics and simulation, 1997 IEEE international conference on, pp 4104–4108
59. Rashedi E, Nezamabadi-Pour H, Saryazdi S (2010) BGSA: binary gravitational search algorithm. Nat Comput 9:727–745
60. Zitzler E, Deb K, Thiele L (2000) Comparison of multiobjective evolutionary algorithms: empirical results. Evol Comput 8:173–195
61. Sierra MR, Coello Coello CA (2005) Improving PSO-based multi-objective optimization using crowding, mutation and ε-dominance. In: Coello Coello CA, Hernández Aguirre A, Zitzler E (eds) Evolutionary multi-criterion optimization. Lecture notes in computer science, vol 3410. Springer, Berlin, Heidelberg, pp 505–519
62. Van Veldhuizen DA, Lamont GB (1998) Multiobjective evolutionary algorithm research: a history and analysis (Final Draft) TR-98-03
63. Deb K, Pratap A, Agarwal S, Meyarivan T (2002) A fast and elitist multiobjective genetic algorithm: NSGA-II. Evolut Comput IEEE Trans 6:182–197
64. Carlton J (2012) Marine propellers and propulsion. Butterworth-Heinemann, Oxford