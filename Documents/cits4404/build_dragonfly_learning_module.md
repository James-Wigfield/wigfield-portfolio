# Build Instructions: Dragonfly Algorithm — Interactive Learning Module Section

## Context

You are building a **self-contained section** for a personal learning module website. The learner is a university student (CITS4404 — AI/optimisation unit) who has read an academic paper on the Dragonfly Algorithm and needs both a plain-English explainer and an interactive simulation to genuinely understand what the algorithm does. All content and answers below have already been synthesised from the paper; your job is to build the UI.

The section has **two parts**:

1. **Interactive Algorithm Explainer** — teach how DA works with a live, step-by-step simulation the user can control.
2. **Literature Review Q&A** — display the six assignment synopsis questions with their answers, each anchored to the specific part of the paper it comes from.

---

## Deliverable

Produce a **single self-contained HTML file** (`dragonfly_module.html`) with all CSS and JavaScript inline (no external dependencies except one CDN import if needed for a charting/canvas library). It must work when opened directly from the filesystem (`file://` protocol) — no build step, no server required.

If you use a library, use a stable CDN link (e.g. Chart.js from cdnjs). Do not use React, Vue, or any framework that requires a bundler.

---

## Visual Design

Match a clean, academic dark-mode aesthetic:
- Background: `#0f1117`
- Card/panel: `#1a1d27`
- Accent: `#6c8ebf` (steel blue)
- Highlight/food: `#4caf50` (green)
- Enemy/danger: `#e57373` (red)
- Text: `#e0e0e0`
- Monospace for equations/code: system monospace stack

Use smooth CSS transitions. Sections should be clearly delineated with subtle borders. The page should have a fixed left sidebar navigation that jumps to each major section.

---

## Part 1: Interactive Algorithm Explainer

### 1.1 Header Section

Title: **"Dragonfly Algorithm: How It Works"**
Subtitle: *"A swarm intelligence optimiser inspired by dragonfly swarming behaviour — Mirjalili, 2016"*

Below the title, a one-paragraph plain-English summary of what DA is (use the content in the Paper Summary section below).

---

### 1.2 Biological Inspiration Panel

A two-column layout:

**Left column — Static Swarm (Exploration)**
- Icon or ASCII art of small scattered dragonflies
- Label: "Hunting swarm — small groups, back-and-forth over small area"
- Annotation: "→ Maps to EXPLORATION in optimisation"

**Right column — Dynamic Swarm (Exploitation)**
- Icon or ASCII art of dragonflies flying together in one direction
- Label: "Migratory swarm — large group, one direction over long distances"
- Annotation: "→ Maps to EXPLOITATION in optimisation"

Below, a callout box:
> "Unlike PSO which blurs these phases, DA explicitly switches between them by adjusting alignment weight (high → exploration) and cohesion weight (high → exploitation) as the neighbourhood radius grows."

---

### 1.3 The Five Behavioural Operators Panel

Display five numbered cards in a grid (2-2-1 layout). Each card has:
- A short name and coloured icon
- The mathematical formula (rendered as text, no MathJax needed — use Unicode superscripts/subscripts or pre-formatted text)
- A plain-English one-sentence description
- A "Role during optimisation" tag (e.g. "Prevents crowding", "Drives convergence")

The five operators:

| # | Name | Formula | Plain English | Role |
|---|------|---------|---------------|------|
| 1 | Separation | Sᵢ = −∑(X − Xⱼ) | Push away from neighbours to avoid crowding | Maintains diversity |
| 2 | Alignment | Aᵢ = (∑Vⱼ) / N | Match the velocity of nearby dragonflies | Coordinates movement |
| 3 | Cohesion | Cᵢ = (∑Xⱼ)/N − X | Move toward the neighbourhood centre of mass | Groups the swarm |
| 4 | Food Attraction | Fᵢ = X⁺ − X | Steer toward the best solution found so far | Exploitation pull |
| 5 | Enemy Distraction | Eᵢ = X⁻ + X | Steer away from the worst solution found so far | Avoids bad regions |

Below the cards, show the combined step update equation as a styled code/formula block:

```
ΔX(t+1) = (s·Sᵢ + a·Aᵢ + c·Cᵢ + f·Fᵢ + e·Eᵢ) + w·ΔX(t)
X(t+1)  = X(t) + ΔX(t+1)

Where w (inertia) decays from 0.9 → 0.2 over iterations
When no neighbours: X(t+1) = X(t) + Lévy(d)·X(t)   [random exploration]
```

Include a small interactive slider labelled **"Exploration ←→ Exploitation"** that, when moved, animates the weight values (a, c) changing in the formula block to show the trade-off. No simulation needed here — just the visual values updating.

---

### 1.4 Live 2D Simulation

This is the centrepiece of Part 1. Build a **canvas-based 2D simulation** of the DA on a simple 2D test landscape.

**Landscape:** Use a 2D Ackley function as the fitness landscape, rendered as a heatmap on the canvas (dark = low/good, bright = high/bad). Precompute a 200×200 grid of Ackley values and render with an imageData gradient on a background canvas layer.

The **Ackley function** (for rendering the landscape):
```
f(x,y) = -20·exp(-0.2·sqrt(0.5·(x²+y²))) - exp(0.5·(cos(2πx)+cos(2πy))) + e + 20
```
Domain: x,y ∈ [−5, 5]. Global minimum at (0,0).

**Simulation elements:**
- 20 dragonfly agents rendered as small triangular arrows (pointing in their direction of movement)
- The current **food source** (best position found): green circle with a pulsing glow
- The current **enemy** (worst position found): red circle with a pulsing glow
- Faint trails behind each agent (last 10 positions, fading opacity)
- A neighbourhood radius indicator: a faint grey circle around each agent showing its search radius

**Controls panel below the canvas:**
- `[▶ Run]` / `[⏸ Pause]` button
- `[↺ Reset]` button — re-randomises agents
- `[⏭ Step]` button — advances exactly one iteration
- Speed slider: "Slow ←→ Fast" (controls animation frame rate, 50ms to 500ms per step)
- Population size slider: 5 to 40 agents (resets simulation when changed)
- Max iterations display: "Iteration: X / 200"

**Info panel to the right of the canvas** (updates live):
- Current best fitness value
- Current worst fitness value
- Best position found (x, y)
- Neighbourhood radius (current value)
- Current weights: w, s, a, c, f, e (update each iteration to show the adaptive schedule)

**Simulation logic to implement:**

```
Initialisation:
  - Place N agents at random positions in [−5, 5]²
  - Random initial step vectors in [−0.5, 0.5]²
  - Neighbourhood radius r = 0.5 (grows linearly to 5.0 over 200 iterations)

Each iteration:
  For each agent i:
    Find neighbours: agents within radius r of agent i

    If agent i has ≥ 1 neighbour:
      Compute S, A, C, F, E using the five equations
      ΔX = s·S + a·A + c·C + f·F + e·E + w·ΔX_prev
      Clamp ΔX to [−0.5, 0.5] (step size limit)
      X_new = X + ΔX

    Else (isolated):
      Lévy step: X_new = X + levy_step() · X
      where levy_step() = 0.01 · (r1·σ / |r2|^(1/1.5))
      with r1, r2 uniform random, σ = 0.6966

    Clamp X_new to [−5, 5]²

  Update food source = agent with best (lowest) fitness
  Update enemy = agent with worst (highest) fitness

  Adaptive weights (linear schedules over 200 iterations):
    w = 0.9 − 0.7 · (iter/200)        # 0.9 → 0.2
    a = 0.1 + 0.3 · (iter/200)        # alignment: low early (exploration) → higher  
    c = 0.7 − 0.4 · (iter/200)        # cohesion: high → lower as neighbourhood grows
    s = 0.1                             # separation: constant
    f = 1.0                             # food: constant
    e = 1.0                             # enemy: constant
```

**Annotation overlays** (togglable with a "Show annotations" checkbox):
- Arrows from each agent showing each of the 5 force components (colour-coded)
- Labels: "S", "A", "C", "F", "E" next to each arrow
- When paused, clicking on an agent highlights its neighbour set

---

### 1.5 Exploration vs Exploitation Timeline

Below the simulation, a small **line chart** (use Chart.js or plain canvas) that plots over iterations:
- Blue line: average distance between all agents (proxy for diversity/exploration)
- Orange line: best fitness value (proxy for exploitation progress)

The chart updates live as the simulation runs. Label the x-axis "Iteration" and y-axis "Value (normalised)". Title: "Diversity vs Convergence Over Time".

---

### 1.6 Variants Accordion

A collapsible accordion with three panels:

**Panel 1: Binary DA (BDA)**
Content:
- Problem: positions can only be 0 or 1, so step vectors can't be added directly
- Solution: v-shaped transfer function converts step value → probability of flipping a bit
- Formula: T(Δx) = |Δx / √(Δx² + 1)|
- New update rule: flip bit with probability T(Δx), else keep
- Why v-shaped (not s-shaped): v-shaped doesn't force convergence to 0 or 1 extremes
- Use case: feature selection, binary combinatorial problems

**Panel 2: Multi-Objective DA (MODA)**
Content:
- Problem: multiple conflicting objectives → no single best solution, need a Pareto front
- Addition: a Pareto archive stores all non-dominated solutions found so far
- Archive maintenance: reject dominated solutions, remove from crowded regions when full
- Food selection: from least-populated hypersphere grid cell (improves coverage)
- Enemy selection: from most-populated hypersphere grid cell (avoids revisiting crowded regions)
- Result: a well-distributed approximation of the true Pareto optimal front

**Panel 3: Lévy Flight**
Content:
- Purpose: when a dragonfly is isolated it performs a random walk instead of following the swarm
- Lévy flights have heavy tails — occasional very large steps prevent getting stuck
- This improves global exploration when the swarm is fragmented early in optimisation
- Mathematically: step size drawn from a Lévy distribution with β=1.5

---

## Part 2: Literature Review Q&A

### 2.1 Section Header

Title: **"Synopsis: Six Key Questions"**
Subtitle: *"How this paper was reviewed for CITS4404 Part 1 — with paper references"*

Introductory sentence: "The following six questions are the standard review framework from the assignment. Each answer is drawn directly from the paper with a citation to the relevant section."

---

### 2.2 Q&A Cards

Display as six expandable cards (expanded by default). Each card has:
- A coloured number badge (1–6)
- The question in bold
- The answer in normal text
- A "📄 Paper reference" tag at the bottom linking to the section of the paper

Use the exact content below for each card.

---

**Card 1** — Colour: `#6c8ebf` (blue)

**Question:** What problem with existing algorithms is the new algorithm attempting to solve?

**Answer:**
The Dragonfly Algorithm targets continuous, binary, and multi-objective optimisation. Its motivation is twofold. First, despite an extensive body of SI research (PSO, ACO, ABC), the swarming behaviour of dragonflies had never been computationally modelled — a gap in the literature representing a potential source of novel algorithmic behaviour. Second, the No Free Lunch theorem guarantees that no single algorithm is universally optimal, so a genuinely distinct algorithm can outperform existing ones on classes of problems where they are weak. The paper positions DA not as a replacement for PSO but as a complementary tool in the optimisation toolkit.

**Paper reference:** Section 1 (Introduction) and Section 1.3 (Motivation for the Dragonfly Algorithm)

---

**Card 2** — Colour: `#8e6cbf` (purple)

**Question:** Why, or in what respect, have previous attempts failed?

**Answer:**
Existing SI algorithms each capture only a subset of the behavioural repertoire relevant to swarm survival. PSO tracks only personal and global bests (analogous to food attraction and a weak form of cohesion). Several improved PSO variants added separation, alignment, or cohesion operators individually but none unified all five survival behaviours. More critically, no prior algorithm formally distinguished between the two qualitatively different modes of dragonfly swarming: *static* hunting swarms (small, back-and-forth — mapping to exploration) and *dynamic* migratory swarms (large, unidirectional — mapping to exploitation). This distinction allows DA to adapt its exploration/exploitation balance more explicitly than PSO's single velocity update rule permits. The absence of an *enemy* mechanism in standard PSO also means agents are pulled toward good regions but never explicitly pushed away from bad ones.

**Paper reference:** Section 1.1 (Existing SI Algorithms) and Section 1.2 (Advantages of SI-based Algorithms)

---

**Card 3** — Colour: `#4caf50` (green)

**Question:** What is the new idea presented in this paper?

**Answer:**
DA introduces five behavioural operators — separation, alignment, cohesion, food attraction, and enemy distraction — combined into a single step vector update. The key novelties are: (1) the explicit *enemy* operator that steers agents away from the current worst solution, which has no direct equivalent in PSO; (2) the distinction between static and dynamic swarming modes, implemented by adaptively tuning alignment weight (high → exploration) and cohesion weight (high → exploitation) while growing the neighbourhood radius over time; and (3) Lévy flight as a fallback for isolated agents, giving heavy-tailed random steps to avoid stagnation. Two variants extend DA: the Binary DA (BDA) uses a v-shaped transfer function to handle binary search spaces, and the Multi-Objective DA (MODA) adds a Pareto archive with a hypersphere grid selection mechanism that balances convergence and coverage.

**Paper reference:** Section 2 (Inspiration), Section 3.1–3.5 (Mathematical models), Section 3.7 (BDA), Section 3.8 (MODA)

---

**Card 4** — Colour: `#ff9800` (orange)

**Question:** How is the new approach demonstrated?

**Answer:**
The paper demonstrates DA through three experiment sets. For the continuous DA, 19 benchmark functions are used: 7 unimodal (testing convergence/exploitation), 6 multimodal (testing exploration/local-optima avoidance), and 6 composite (shifted, rotated, combined functions that mimic real search spaces). Each is evaluated with 30 agents over 500 iterations, repeated 30 times, with PSO and GA as baselines. Statistical significance is assessed via the Wilcoxon rank-sum test. For BDA, the same 13 functions are encoded into 75 binary variables and compared against BPSO and BGSA. For MODA, five ZDT benchmark functions plus a real 20-variable submarine propeller design problem are solved and compared against MOPSO and NSGA-II using Inverse Generalised Distance (IGD). The paper provides full pseudocode, parameter values, and benchmark definitions in appendices, and source code is publicly available — sufficient for replication.

**Paper reference:** Section 4.1 (DA results setup), Section 4.2 (BDA setup), Section 4.3 (MODA setup), Section 4.4 (propeller case study), Appendices 1–2

---

**Card 5** — Colour: `#e57373` (red)

**Question:** What are the results or outcomes and how are they validated?

**Answer:**
DA achieves the best or joint-best result on 13 of 19 single-objective benchmark functions. Against GA, differences are statistically significant on nearly all functions. Against PSO, DA is superior on most unimodal functions but the advantage is not significant on several multimodal cases, suggesting comparable exploration ability. A notable exception is TF8 (Schwefel function) where PSO strongly outperforms DA — the only systematic weakness identified. On composite functions the advantage over PSO is inconsistent. BDA outperforms BPSO and BGSA on 11 of 13 binary functions with strong statistical significance. MODA consistently beats NSGA-II by a large margin and outperforms MOPSO on ZDT3 and the three-objective test case. The submarine propeller problem yielded 61 well-distributed Pareto optimal solutions under tight constraints. Four behavioural diagnostics (search history, trajectory, average fitness, convergence curve) provide qualitative confirmation of the algorithm's convergence properties.

**Paper reference:** Section 4.1 (Tables 1–2), Section 4.2 (Tables 3–4), Section 4.3 (Tables 5–9), Section 4.4 (propeller results)

---

**Card 6** — Colour: `#78909c` (grey-blue)

**Question:** What is your assessment of the conclusions?

**Answer:**
The core claims — that DA is a competitive single-objective optimiser and that BDA and MODA outperform their respective comparators — are largely substantiated. The methodology is sound: multiple runs, statistical testing, and diverse benchmark coverage all follow standard practice. However, three caveats limit the strength of the claims. First, the comparison set is narrow: only PSO and GA are used as single-objective baselines, omitting contemporary algorithms like Differential Evolution or Grey Wolf Optimiser. Second, DA's advantage over PSO on composite functions is modest and statistically insignificant in several cases, which matters given that composite functions best resemble real-world landscapes. Third, the propeller design case study cannot be verified against a known Pareto front. Overall the conclusions are justified within the scope of the experiments, but the paper would benefit from a wider baseline comparison. For this assignment, DA is a strong candidate for Part 2: the explicit food/enemy mechanism and five-operator framework translate naturally to continuous parameter search over trading bot weights, and the algorithm is straightforward to implement from the pseudocode.

**Paper reference:** Section 4 (Discussion throughout), Section 5 (Conclusion), Section 1.3 (NFL motivation)

---

### 2.3 Paper Structure Map

After the six cards, show a collapsible "Paper Structure" panel that maps the paper's sections to their purpose:

| Section | Title | What it contains |
|---------|-------|-----------------|
| 1 | Introduction | Motivation, existing SI algorithms, NFL theorem |
| 2 | Inspiration | Dragonfly biology, static vs dynamic swarming |
| 3.1–3.5 | DA (continuous) | Five operators, step/position equations, Lévy flight |
| 3.6 | DA Pseudocode | Full algorithm with neighbourhood logic |
| 3.7 | BDA | Binary version with v-shaped transfer function |
| 3.8 | MODA | Multi-objective version with Pareto archive |
| 4.1 | DA Results | 19 benchmark functions vs PSO and GA |
| 4.2 | BDA Results | 13 binary functions vs BPSO and BGSA |
| 4.3 | MODA Results | 5 ZDT functions vs MOPSO and NSGA-II |
| 4.4 | Case Study | Submarine propeller design (20 variables) |
| 5 | Conclusions | Summary and future research directions |
| App. 1 | Benchmark Defs | Formulas for all 19 single-objective test functions |
| App. 2 | ZDT Defs | Formulas for all 5 multi-objective test functions |

Render this as a styled HTML table.

---

## Part 3: Navigation & Layout

### Fixed Sidebar

A narrow (200px) fixed left sidebar with jump links:
- Overview
- Biological Inspiration
- Five Operators
- Live Simulation
- Diversity Chart
- Variants (BDA / MODA / Lévy)
- Synopsis Q&A
- Paper Structure Map

Active section should be highlighted as the user scrolls (use IntersectionObserver).

### Page Footer

```
Paper: Mirjalili, S. (2016). Dragonfly algorithm. Neural Computing and Applications, 27, 1053–1073.
Source code: http://www.alimirjalili.com/DA.html
Built for CITS4404 — University of Western Australia, 2026
```

---

## Implementation Notes

- All simulation logic must use `requestAnimationFrame` for smooth animation.
- The canvas should be 600×500px; scale the coordinate system internally so [−5,5]² maps to the canvas.
- Render the Ackley heatmap once on a background canvas and composite the agent layer on top each frame for performance.
- Use `<details>` / `<summary>` for the accordion panels (no JS required for expand/collapse).
- The Q&A cards should use `<details open>` so they start expanded.
- Use CSS Grid for the five-operator cards layout.
- No alert() calls; display any error states inline.
- The page must pass basic accessibility: all interactive elements labelled, colour not the only differentiator, keyboard navigable.

---

## Paper Summary (use this for prose content throughout)

The **Dragonfly Algorithm (DA)** is a swarm intelligence metaheuristic proposed by Seyedali Mirjalili in 2015 (published 2016). It mimics two swarming behaviours of dragonflies: static hunting swarms (small groups, local search — analogous to *exploration*) and dynamic migratory swarms (large groups, directional flight — analogous to *exploitation*). Each artificial dragonfly updates its position using five weighted behavioural terms: separation from neighbours, velocity alignment with neighbours, cohesion toward the neighbourhood centre, attraction to the best solution (food), and repulsion from the worst solution (enemy). Neighbourhood radius grows over time, causing the population to transition from fragmented exploration to cohesive convergence. When no neighbours are present, agents use Lévy flight for heavy-tailed random exploration. Three versions are presented: the continuous DA, a Binary DA using v-shaped transfer functions, and a Multi-Objective DA with a Pareto archive and hypersphere selection grid. Benchmarked against PSO and GA (continuous), BPSO and BGSA (binary), and MOPSO and NSGA-II (multi-objective), DA and its variants achieve competitive or superior results on the majority of test cases, validated using the Wilcoxon rank-sum test across 30 independent runs.

---

## Output

Save the file as `dragonfly_module.html` in the same directory as these instructions. When opened in a browser it should be immediately usable with no additional steps.
