# Accuracy check: Descent (`descent`)

Game: Descent (Lecture 2 optimiser golf) · checked 2026-10-23 · sources: `cits5017-lect02-Training-DNNs.pdf` slides 29, 33–59 (34, 36, 38, 41, 43, 45, 50, 52, 57, 58 rendered at 110 dpi, 38 and 43 zoomed) + `markdown-lecs/lecture-2.md` (no Quirks section).
Sample: 82 items solved blind (70 from 7 full rounds: L1 seeds 11, 12 · L2 seeds 21, 22 · L3 seeds 31, 32, 33; plus 12 extra schedule items from `makeSched`). Every optimiser hand-stepped (1–2 steps each). All 38 holes re-swung with my own optimiser loop (slide equations, central-difference gradients of `J`).

| # | claim | where (file / item id) | source (lecture · slide) | verdict | fix |
|---|---|---|---|---|---|
| 1 | GD θ ← θ − η∇θJ(θ); hand step (1,−2), g=(2θ₁,0.5θ₂), η=0.1 → (0.8,−1.9) reproduces | maths/descent.js `STEPS.sgd` | L2 · 34 | VERIFIED | — |
| 2 | Momentum m ← βm − η∇J; θ ← θ + m; 2 steps → (0.46,−1.715) reproduce | `STEPS.momentum` | L2 · 34 | VERIFIED | — |
| 3 | NAG gradient at θ + βm; step 2 → (0.496,−1.7195) reproduces | `STEPS.nag` | L2 · 36 | VERIFIED | — |
| 4 | AdaGrad s ← s + g⊗g, θ ← θ − ηg⊘√(s+ε), ε inside the root; step 2 → (0.833103,−1.831125) | `STEPS.adagrad` | L2 · 38 | VERIFIED | — |
| 5 | RMSProp s ← ρs + (1−ρ)g⊗g, ε inside root; step 1 → (0.683772,−1.683772) | `STEPS.rmsprop` | L2 · 41 | VERIFIED | — |
| 6 | Adam steps 1–5, t = 1 on first step, ε inside √ŝ; step 2 → (0.800412,−1.800166) | `STEPS.adam` | L2 · 43 | VERIFIED | — |
| 7 | Defaults β=0.9, ρ=0.9, β₁=0.9, β₂=0.999 | `DEFAULTS`, `CLUBS.*.hp`, `DEFAULTS_NOTE` | L2 · 34, 41, 44 | VERIFIED | — |
| 8 | ε = 10⁻¹⁰ for AdaGrad | `DEFAULTS`, `CLUBS.adagrad.hp` | L2 · 38 | VERIFIED | — |
| 9 | ε = 10⁻¹⁰ reused for RMSProp/Adam, disclosed ("slides 41 and 43 give none") | content `DEFAULTS_NOTE[3]` | L2 · 38, 41, 43 | VERIFIED (disclosed extension) | — |
| 10 | Intro lists ε = 10⁻¹⁰ among "the slides' defaults" for every club | `INTRO.controls[1]` | L2 · 38 vs 41, 43 | AMBIGUOUS | "…β₂ = 0.999; ε = 10⁻¹⁰ (AdaGrad's, slide 38, used for all)" |
| 11 | clipvalue=1.0 clips every component to [−1, 1]; (−12.3,2.6) → (−1,1) | `clipValue`, `CLIP.value/orient/which` | L2 · 29 | VERIFIED | — |
| 12 | clipnorm rescales the vector to norm 1.0 ("only got shorter"; bold arrow of length 1) | `clipNorm`, `CLIP.which.why.clipnorm` | L2 · 29 (says only "retain orientation") | NOT IN SLIDES | add `beyond` note or drop "only got shorter" |
| 13 | Power η(t) = η₀/(1 + rt/s)^c, c typically 1; η₀/(1+r) after s, η₀/(1+2r) after 2s | `powerSched`, `SCHED.power` | L2 · 50 | VERIFIED | — |
| 14 | Exponential η₀r^(t/s); r=0.1, s=15 → 0.1η₀, 0.01η₀ | `expSched`, `SCHED.exponential` | L2 · 52 | VERIFIED | — |
| 15 | PiecewiseConstantDecay([50_000, 80_000], [0.01, 0.005, 0.001]); 0.01 → 0.005 → 0.001 | `piecewiseSched`, `SCHED.piecewise` | L2 · 56 | VERIFIED (no boundary step sampled) | — |
| 16 | ReduceLROnPlateau(factor=0.5, patience=5): ×0.5 after 5 epochs without a new best | `performanceSched`, `SCHED.performance` | L2 · 57 | VERIFIED | — |
| 17 | Performance chart "shaped like slide 58's run": loss at epoch 12 (0.3786) beats epoch 11 (0.3826), so η is cut only at epoch 22, AFTER the loss drop at 17; slide 58 cuts at ~17 and the loss drop follows | descentItems.js `schedCurve` (performance) | L2 · 58 | WRONG | epochs 12–16: `0.3826 + 0.0016·(e − 11)` → cut lands at 16 |
| 18 | 1cycle: linear up to η₁ by halfway, linear back to η₀, last epochs drop several orders (still linearly) | `oneCycleSched`, `SCHED.shape.why.onecycle`, fact `sched.onecycle.up` | L2 · 59 | VERIFIED | — |
| 19 | Bowl axes θ₁ flatter, θ₂ steep (b ≫ a) | `HOLES.bowl.axes`, `SAMPLERS.bowl` | L2 · 39 (Fig 11-8) | VERIFIED | — |
| 20 | bowl.adagrad: GD fast down steepest slope then slow; AdaGrad scales down steep dims; good on simple quadratics | `WINS['bowl.adagrad']` | L2 · 38, 40 | VERIFIED | — |
| 21 | flats.momentum: tiny gradient → GD very slow; gradient as acceleration not speed | `WINS['flats.momentum']` | L2 · 34 | VERIFIED | — |
| 22 | flats.adam: "step 5 divides m̂ by √(ŝ+ε), so a tiny but steady gradient still moves the ball" | `WINS['flats.adam']` | L2 · 43 (no such statement) | NOT IN SLIDES | mark `beyond`, or use slide 44's "adaptive learning rate … less tuning of η" |
| 23 | dimple.momentum: GD ignores earlier gradients; momentum can help roll past local optima | `WINS['dimple.momentum']` | L2 · 34 | VERIFIED | — |
| 24 | dimple.adam: only club with momentum in bag; step 1 is momentum's idea, β₁ ↔ β | `WINS['dimple.adam']` | L2 · 34, 43, 44 | VERIFIED | — |
| 25 | narrow.nag: gradient at θ + βm; momentum vector points toward optimum, update slightly closer (Fig 11-7); NAG overshoots less (generator enforces) | `WINS['narrow.nag']` | L2 · 36, 37 | VERIFIED | — |
| 26 | valley.rmsprop: AdaGrad scaled down so much it stops too early; RMSProp keeps only recent gradients, ρ = 0.9 | `WINS['valley.rmsprop']` | L2 · 40, 41 | VERIFIED | — |
| 27 | valley.sgd: AdaGrad stops too early; GD keeps η | `WINS['valley.sgd']` | L2 · 34, 40 | VERIFIED | — |
| 28 | bowl.adagrad.vsRms: RMSProp better except on very simple problems; decaying rate | `WINS['bowl.adagrad.vsRms']` | L2 · 39, 40, 42 | VERIFIED | — |
| 29 | L3 six-club bowl: AdaGrad makes par over Adam/NAG/momentum/RMSProp; the why card is only the GD-vs-AdaGrad story | `TEMPLATES.L3` bowl `CLUB_IDS` | L2 · 38–42, 44, 47 | AMBIGUOUS | slides compare AdaGrad only with GD (38–40) and RMSProp (42); add a `beyond` line ("at this large η the other clubs keep overshooting the steep axis") or trim the bag to sgd/adagrad/rmsprop |
| 30 | Bowl scorecards show momentum-family clubs slower than plain SGD: momentum worse in 406/450 generated bowl holes, NAG 132/150, Adam 103/150 (sample #6: SGD 44 vs momentum 53) | bowl holes, all levels (`SAMPLERS.bowl`, η = 1.5–2) | L2 · 35 ("almost always goes faster than regular gradient descent"), 47 (speed * vs **) | WRONG (mechanic) | retune bowl η (e.g. ηb ≈ 0.6–1) so momentum ≤ SGD, or add that check in `makeHole` for bowls |
| 31 | RMSProp par on valley holes: ball reaches flag (~step 30–40) then the normalised near-zero θ₂ gradient (ε = 10⁻¹⁰) kicks it out; par count set by that jitter. Re-swung with ~1e-10 gradient noise, 6/7 valley RMSProp counts change (48→87, 62→95); winner never changes | valley holes, scorecard | L2 · 41 (no ε given) | AMBIGUOUS | note it, or use a larger ε floor for RMSProp/Adam, or score par with a stay rule that tolerates the jitter |
| 32 | Hole lines/srcs: flats & dimple (34), narrow (36, 37), valley (38, 40, 41), bowl (38, 39) | `HOLES` | L2 · 34–41 | VERIFIED | — |
| 33 | Dial: too high may diverge (ηk ∈ [2.08, 2.22] does diverge); too low converges but very slowly | `DIAL`, `makeDial` | L2 · 48 | VERIFIED | — |
| 34 | Par = fewest steps until the ball stays in the cup, clear 20% margin | `PAR_RULE`, `holedAt`, `parOf` | simulation | VERIFIED (38/38 par clubs reproduced) | — |
| 35 | eq.gd.rule; distractors θ+η∇J, θ−ηJ, θ−∇J/η all false | `EQ` eq.gd.rule | L2 · 34 | VERIFIED | — |
| 36 | eq.momentum.which (answer Momentum; NAG would use θ + βm) | eq.momentum.which | L2 · 34, 36 | VERIFIED | — |
| 37 | eq.momentum.beta 0.9 | eq.momentum.beta | L2 · 34, 35 | VERIFIED | — |
| 38 | eq.momentum.accel (acceleration, not speed) | eq.momentum.accel | L2 · 34 | VERIFIED | — |
| 39 | eq.gd.memoryless (SGD) | eq.gd.memoryless | L2 · 34 | VERIFIED | — |
| 40 | eq.table.speed: SGD *, momentum (± nesterov) **, rest *** | eq.table.speed | L2 · 47 | VERIFIED | — |
| 41 | eq.nag.where θ + βm; distractors θ, θ − ηm, βm false | eq.nag.where | L2 · 36 | VERIFIED | — |
| 42 | eq.nag.which | eq.nag.which | L2 · 36 | VERIFIED | — |
| 43 | eq.nag.keras: answer nesterov=True (37) ✓, but choice c and the why's "Nadam is Adam with the Nesterov trick" come from 45–46, uncited | eq.nag.keras | L2 · 37, 45, 46 | WRONG (receipt incomplete) | `src: L2(37, 45, 46)` |
| 44 | eq.adagrad.s; distractors = RMSProp (41), Adam step 2 (43), AdaMax (45) | eq.adagrad.s | L2 · 38 | VERIFIED | — |
| 45 | eq.adagrad.eps 10⁻¹⁰ | eq.adagrad.eps | L2 · 38 | VERIFIED | — |
| 46 | eq.adagrad.oslash element-wise division | eq.adagrad.oslash | L2 · 38 | VERIFIED | — |
| 47 | eq.adagrad.dnn: stops too early, not for DNNs, OK for linear regression, Table 11-2 * | eq.adagrad.dnn | L2 · 40, 47 | VERIFIED | — |
| 48 | eq.rmsprop.rho 0.9; RMSprop(learning_rate=0.001, rho=0.9) | eq.rmsprop.rho | L2 · 41, 42 | VERIFIED | — |
| 49 | eq.rmsprop.recent | eq.rmsprop.recent | L2 · 41 | VERIFIED | — |
| 50 | eq.adam.step3 m̂ ← m/(1 − β₁ᵗ); distractors false | eq.adam.step3 | L2 · 43 | VERIFIED | — |
| 51 | eq.adam.step1 (plus sign; squared gradient is step 2) | eq.adam.step1 | L2 · 34, 43 | VERIFIED | — |
| 52 | eq.adam.beta2 0.999 | eq.adam.beta2 | L2 · 44 | VERIFIED | — |
| 53 | eq.adam.corr β₁ ↔ β, β₂ ↔ ρ | eq.adam.corr | L2 · 44 | VERIFIED | — |
| 54 | eq.adam.why34 (m, s start near zero) | eq.adam.why34 | L2 · 43 | VERIFIED | — |
| 55 | eq.adam.eta 0.001 | eq.adam.eta | L2 · 44 | VERIFIED | — |
| 56 | eq.adamax.step2 s ← max(β₂s, abs(∇J)); Adam better in general | eq.adamax.step2 | L2 · 45 | VERIFIED | — |
| 57 | eq.nadam.what; no Nadam equation drilled | eq.nadam.what | L2 · 45 | VERIFIED | — |
| 58 | eq.adamw.what: decay factor such as 0.99; AdamW(weight_decay=1e-5) | eq.adamw.what | L2 · 45, 46 | VERIFIED | — |
| 59 | CLIP.orient: clipnorm retains orientation | CLIP.orient | L2 · 29 | VERIFIED | — |
| 60 | CLIP.which.why.clipvalue (component-wise, direction changes) | CLIP.which | L2 · 29 | VERIFIED | — |
| 61 | CLIP.rnn: mostly useful for RNNs, BN tricky there | CLIP.rnn | L2 · 29 | VERIFIED | — |
| 62 | Power items: r = 1, c = 1, s ∈ {10, 20}, distractors all false | `makeSched('power')` | L2 · 50 | VERIFIED | — |
| 63 | Exponential items: r ∈ {0.1, 0.2, 0.5}, s ∈ {10, 15, 20}, distractors all false | `makeSched('exponential')` | L2 · 52 | VERIFIED | — |
| 64 | Performance item: one cut from 0.010 → 0.005; slide 58 run | SCHED.performance | L2 · 57, 58 | VERIFIED | — |
| 65 | Performance scheduling: every N steps, factor λ, ReduceLROnPlateau | fact sched.performance.when | L2 · 57 | VERIFIED | — |
| 66 | Start high then reduce → good solution faster than optimal constant rate | fact sched.why.startHigh | L2 · 49 | VERIFIED | — |
| 67 | Shape whys: piecewise (55), performance (57), 1cycle (59) | SCHED.shape.why | L2 · 55, 57, 59 | VERIFIED | — |
| 68 | Schedule receipts power 50–51, exp 52–53, piecewise 55–56, perf 57–58, 1cycle 59 | SCHED.names | L2 · 50–59 | VERIFIED | — |
| 69 | The 17 manifest concepts' `slides` in lecture2.js teach them (optim.* 34–47, clip 29, sched.* 48–59) | content/lecture2.js CONCEPTS | L2 · 29, 34–59 | VERIFIED | — |
| 70 | Drawer: NAG's first gradient is at the tee while m = 0 | Descent.jsx `HoleMaths` | L2 · 36 | VERIFIED | — |
| 71 | Code comment: course range "as in the slides' contour figures (Fig 11-7, 11-8)" (they have no axis values); points to non-existent `maths/descentGame.js` | maths/descentHoles.js header | L2 · 37, 39 | NOT IN SLIDES (comment only) | reword; file is `descentItems.js` |

## Blind sample (82 items; my answer worked from the slides / my own re-swing first, then compared)

Holes: my own loop (slide equations, β=0.9, ρ=0.9, β₁=0.9, β₂=0.999, ε=10⁻¹⁰, numeric gradients, same ±50 divergence limit and stay-in-cup rule). Steps shown as mine / game; "—" = never holes.

| # | item | prompt (data) | mine | game | match |
|---|---|---|---|---|---|
| 1 | L1 s11 hole bowl sgd/adagrad | η=1.5 | AdaGrad (13; SGD 52) | adagrad 13 | yes |
| 2 | hole dimple sgd/mom | η=0.46 | Momentum (55; SGD —) | momentum 55 | yes |
| 3 | eq.momentum.accel | gradient used as… | acceleration term | accel | yes |
| 4 | hole flats sgd/mom | η=0.15 | Momentum (50; SGD 125) | momentum 50 | yes |
| 5 | dial | η=1.93, k=1.14 → ηk=2.2 > 2 | down | down | yes |
| 6 | hole bowl sgd/mom/ada | η=2 | AdaGrad (7; SGD 44, mom 53) | adagrad 7 | yes |
| 7 | eq.gd.memoryless | | SGD | sgd | yes |
| 8 | hole dimple sgd/mom/ada | η=0.42 | Momentum (50) | momentum 50 | yes |
| 9 | hole flats sgd/mom/ada | η=0.1 | Momentum (57) | momentum 57 | yes |
| 10 | eq.momentum.which | | Momentum | momentum | yes |
| 11 | L1 s12 hole flats sgd/mom | η=0.15 | Momentum (47) | momentum 47 | yes |
| 12 | hole dimple sgd/mom | η=0.45 | Momentum (59) | momentum 59 | yes |
| 13 | eq.gd.memoryless | | SGD | sgd | yes |
| 14 | hole bowl sgd/ada | η=2 | AdaGrad (9; SGD 35) | adagrad 9 | yes |
| 15 | dial | η=2.09, k=1.03 → ηk=2.15 | down | down | yes |
| 16 | hole bowl sgd/mom/ada | η=1.5 | AdaGrad (15; SGD 55, mom 57) | adagrad 15 | yes |
| 17 | eq.momentum.accel | | acceleration | accel | yes |
| 18 | hole dimple sgd/mom/ada | η=0.45 | Momentum (57) | momentum 57 | yes |
| 19 | hole flats sgd/mom/ada | η=0.1 | Momentum (49; SGD 117) | momentum 49 | yes |
| 20 | eq.momentum.which | | Momentum | momentum | yes |
| 21 | L2 s21 hole valley sgd/ada | η=0.22 | SGD (100; AdaGrad —) | sgd 100 | yes |
| 22 | hole narrow mom/nag | η=1 | NAG (33; mom 56) | nag 33 | yes |
| 23 | eq.adagrad.eps | | 10⁻¹⁰ | 1e-10 | yes |
| 24 | hole bowl ada/rms | η=1.5 | AdaGrad (18; RMSProp —) | adagrad 18 | yes |
| 25 | hole valley ada/rms | η=0.22 | RMSProp (55) | rmsprop 62 | club yes, steps differ (row 31) |
| 26 | eq.adagrad.oslash | | element-wise division | div | yes |
| 27 | hole bowl sgd/mom/ada/rms | η=1.5 | AdaGrad (19; SGD 40, mom 59) | adagrad 19 | yes |
| 28 | hole narrow sgd/mom/nag | η=1 | NAG (33; SGD 54, mom 55) | nag 33 | yes |
| 29 | eq.nag.which | | NAG | nag | yes |
| 30 | hole valley sgd/ada/rms | η=0.23 | RMSProp (49; SGD 89) | rmsprop 52 | club yes, steps differ |
| 31 | L2 s22 hole valley ada/rms | η=0.21 | RMSProp (95) | rmsprop 62 | club yes, steps differ |
| 32 | hole bowl ada/rms | η=1.5 | AdaGrad (13) | adagrad 13 | yes |
| 33 | eq.nag.which | | NAG | nag | yes |
| 34 | hole narrow mom/nag | η=1 | NAG (34; mom 48) | nag 34 | yes |
| 35 | hole valley sgd/ada | η=0.25 | SGD (109) | sgd 109 | yes |
| 36 | eq.nag.keras | | SGD(…, nesterov=True) | a | yes |
| 37 | hole valley sgd/ada/rms | η=0.2 | RMSProp (57; SGD 125) | rmsprop 63 | club yes, steps differ |
| 38 | hole bowl sgd/mom/ada/rms | η=1.5 | AdaGrad (17) | adagrad 17 | yes |
| 39 | eq.rmsprop.rho | | 0.9 | 0.9 | yes |
| 40 | hole narrow sgd/mom/nag | η=1 | NAG (38; mom 53, SGD 74) | nag 38 | yes |
| 41 | L3 s31 hole dimple sgd/ada/rms/adam | η=0.57 | Adam (59) | adam 59 | yes |
| 42 | clip rnn | | RNNs | rnn | yes |
| 43 | hole flats sgd/ada/adam | η=0.15 | Adam (50; SGD 137) | adam 50 | yes |
| 44 | fact sched.performance.when | | Performance scheduling | performance | yes |
| 45 | eq.adamax.step2 | | max(β₂s, abs(∇J)) | max | yes |
| 46 | hole valley sgd/ada/rms | η=0.29 | RMSProp (43; SGD 69) | rmsprop 43 | yes |
| 47 | clip orient | g=(−11.9,−0.7) | clipnorm | clipnorm | yes |
| 48 | sched performance | cut once from 0.010 | 0.005 | 0.005 | yes |
| 49 | eq.adam.eta | | 0.001 | 0.001 | yes |
| 50 | hole bowl, all six | η=2 | AdaGrad (8; SGD 41, Adam 51) | adagrad 8 | yes by re-swing; not decidable from slides alone (row 29) |
| 51 | L3 s32 hole valley sgd/ada/rms | η=0.28 | RMSProp (52; SGD 101) | rmsprop 57 | club yes, steps differ |
| 52 | clip value | g=(−15.3, 3.6) | (−1.0, 1.0) | (−1.0, 1.0) | yes |
| 53 | hole dimple sgd/ada/rms/adam | η=0.51 | Adam (51) | adam 51 | yes |
| 54 | sched power | η₀=0.01, s=10, t=10 → 0.01/2 | 0.005 | 0.005 | yes |
| 55 | eq.adam.step1 | | β₁m + (1 − β₁)∇J | a | yes |
| 56 | hole narrow sgd/mom/nag | η=1 | NAG (35; mom 48, SGD 60) | nag 35 | yes |
| 57 | clip which | g=(−9.7,−1.7), taken (−1,−1): direction changed | clipvalue | clipvalue | yes |
| 58 | fact sched.why.startHigh | | start high, then reduce | high | yes |
| 59 | eq.adam.eta | | 0.001 | 0.001 | yes |
| 60 | hole bowl, all six | η=1.5 | AdaGrad (19; NAG 29, Adam 48) | adagrad 19 | yes by re-swing (row 29) |
| 61 | L3 s33 hole dimple sgd/ada/rms/adam | η=0.5 | Adam (48) | adam 48 | yes |
| 62 | clip value | g=(−14.0, 3.4) | (−1.0, 1.0) | (−1.0, 1.0) | yes |
| 63 | hole flats sgd/ada/adam | η=0.15 | Adam (67; SGD 136) | adam 67 | yes |
| 64 | fact sched.onecycle.up | | 1cycle | onecycle | yes |
| 65 | eq.adamax.step2 | | max form | max | yes |
| 66 | hole valley sgd/ada/rms | η=0.24 | RMSProp (87; SGD 117) | rmsprop 48 | club yes, steps differ |
| 67 | clip which | g=(−12.7,3.9), taken (−1,1) | clipvalue | clipvalue | yes |
| 68 | sched shape (1cycle curve) | | 1cycle | onecycle | yes |
| 69 | eq.adamw.what | | AdamW | adamw | yes |
| 70 | hole bowl, all six | η=2 | AdaGrad (9; Adam 45, NAG diverges) | adagrad 9 | yes by re-swing (row 29) |
| S1 | power | η₀=0.01, s=20, t=40 → 0.01/3 | 0.00333 | 0.00333 | yes |
| S2 | power | η₀=0.1, s=20, t=60 → 0.1/4 | 0.025 | 0.025 | yes |
| S3 | exponential | η₀=0.1, r=0.2, s=10, t=20 → 0.1·0.04 | 0.004 | 0.004 | yes |
| S4 | exponential | η₀=0.01, r=0.2, s=20, t=20 | 0.002 | 0.002 | yes |
| S5 | exponential | η₀=0.1, r=0.1, s=20, t=40 → 0.1·0.01 | 0.001 | 0.001 | yes |
| S6 | exponential | η₀=0.1, r=0.5, s=10, t=30 → 0.1·0.125 | 0.0125 | 0.0125 | yes |
| S7 | piecewise | t=95,000 > 80,000 | 0.001 | 0.001 | yes |
| S8 | piecewise | t=60,000 | 0.005 | 0.005 | yes |
| S9 | piecewise | t=95,000 | 0.001 | 0.001 | yes |
| S10 | shape | piecewise curve | Piecewise constant | piecewise | yes |
| S11 | shape | 1cycle curve | 1cycle | onecycle | yes |
| S12 | shape | performance curve (cut at epoch 22, row 17) | Performance | performance | yes |

Answers: 82/82 match (all 38 par clubs reproduced; 32/38 par step counts identical; the 6 that differ are RMSProp on valley holes, row 31). The three six-club bowls match only by re-swinging: the slides alone don't decide AdaGrad over Adam (row 29).

## Summary
- VERIFIED 62 (incl. 1 disclosed extension) · WRONG 3 · NOT IN SLIDES 3 · AMBIGUOUS 3; blind sample 82/82 answers match.
- Fix 1 (WRONG, mechanic): bowl holes show momentum, NAG and Adam slower than plain SGD (90%, 88%, 69% of generated bowls), which goes against slide 35's "almost always goes faster than regular gradient descent" and Table 11-2 (slide 47); retune the bowl η or require momentum ≤ SGD on bowls.
- Fix 2 (WRONG, chart): in `schedCurve` performance, epochs 12–16 must rise from the epoch-11 loss (0.3826) so η is cut at ~16 BEFORE the loss drops, as on slide 58 (now it is cut at 22, after the drop).
- Fix 3: `eq.nag.keras` src → L2(37, 45, 46); `WINS['flats.adam']` "tiny but steady gradient still moves the ball" → mark `beyond` or use slide 44; give clipnorm's "only got shorter" a `beyond` note; INTRO ε wording; six-club bowl needs a `beyond` line or a smaller bag.
- Fix 4 (low): RMSProp's valley par counts come from jitter after it reaches the flag (ε = 10⁻¹⁰ inside the root, slide 41 gives no ε), so a ~1e-10 change in the gradient moves the step count (48↔87); the winner is stable. Also fix the descentHoles.js header comment (non-existent descentGame.js; the figures have no axis ranges).
