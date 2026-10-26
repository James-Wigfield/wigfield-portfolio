# Coverage plan: lectures × parts across the three papers

Planned 2026-10-24, before the practice questions were written, from the three syllabus inventories (every slide of every deck read as an image) and `format-spec.md`; revised after the two question validators (see the end). `check-papers.mjs` parses the **Matrix** table below and fails if it disagrees with the data in `src/components/portal/modules/deep-learning/exam-practice/papers/` (a part is listed under a lecture when one of its topics cites that lecture).

## Rules this plan follows

- **Every lecture (1, 2, 3, 4, 5, 6–7, 8, 9) appears in each practice paper.**
- **Each question mixes at least three lectures** (the sample mixes four per question).
- **GANs appear** (the sample has none): Paper A Q3 (a)–(c), Paper B Q3 (b).
- **Weighting follows the decks' emphasis** (their summary slides): L9 (69 slides; RL is a learning outcome on its own) and L4 (sequences, a learning outcome) get the most parts; L5 (27 slides) the fewest.
- **Every stimulus type appears in each paper**: given code → draw/count; given equation → explain each term; given diagram → write equations or compute; scenario → reason about shapes, losses, set-up.
- **Learning outcomes** (exam note): DNNs on structured and unstructured data (L1–L3: A Q1, B Q1), sequence processing on time series (L4: A Q2, B Q2), generative models (L5, L6–7 VAEs/AEs: sample Q2(b), A Q2(d)–(e), A Q3(d), B Q3(a), (c), (d)), GANs (A Q3, B Q3(b)), deep reinforcement learning (L9: sample Q2(d)–(e), A Q4, B Q4).
- **Nothing outside the slides**, nothing marked not examined (L8 slide 47 onward; L8 slide 41 beam search; L2 slide 66 alpha dropout; L5 slide 3 diffusion models; L5 slide 27 sparse autoencoders), and nothing the slides never state (target networks, double/dueling DQN, the conv output-size formula, MultiHeadAttention parameter counts, the replay buffer's purpose).
- **No sample ask repeated**: the sample's types are reused with new content (CNN code instead of the Wide & Deep code; Adam and batch-norm equations instead of plain gradient descent; a memory-cell and an LSTM diagram instead of the gated FC module; computing value iteration instead of explaining its terms; a classification sequence scenario instead of the star regression).

## Matrix

Each cell lists the parts that draw on that lecture (S = sample paper, A, B = practice papers). Subparts are listed one by one.

| Lecture | Sample paper | Practice paper A | Practice paper B | Practice paper C |
|---|---|---|---|---|
| L1 | Q1(c), Q1(d), Q1(e) i., Q1(e) ii., Q2(a) ii. | Q1(a), Q1(c), Q3(a), Q4(e) | Q1(a) i., Q1(a) ii., Q1(d), Q1(e), Q2(d), Q4(d) i. | Q1(a) i., Q1(a) ii., Q1(a) iii., Q1(c) |
| L2 | Q1(d) | Q1(b), Q1(d), Q1(e), Q3(d) | Q1(b) i., Q1(b) ii., Q1(b) iii., Q1(d) | Q1(b) i., Q1(b) ii., Q1(d), Q2(e) |
| L3 | Q1(a), Q1(b) | Q1(c) | Q1(c) i., Q1(c) ii., Q1(c) iii., Q2(b), Q3(c) | Q1(e), Q2(c), Q3(d) |
| L4 | Q1(e) i., Q1(e) ii., Q2(a) i., Q2(a) iii. | Q2(a) i., Q2(a) ii., Q2(b), Q2(c) | Q2(a) i., Q2(a) ii., Q2(b), Q2(c), Q2(d) | Q2(a) i., Q2(a) ii., Q2(b) i., Q2(b) ii., Q2(b) iii., Q2(d), Q4(a) ii. |
| L5 | — | Q2(d), Q2(e), Q3(d) | Q3(d) i., Q3(d) ii. | Q3(a) i., Q3(a) ii. |
| L6–7 | Q2(b) | Q2(e), Q3(a), Q3(b), Q3(c) | Q3(a) i., Q3(a) ii., Q3(a) iii., Q3(b), Q3(c) | Q3(b) i., Q3(b) ii., Q3(b) iii., Q3(c) |
| L8 | Q2(c) | Q3(e) i., Q3(e) ii., Q4(a) i., Q4(a) ii., Q4(a) iii. | Q2(e), Q3(e), Q4(a) i., Q4(a) ii. | Q3(e) i., Q3(e) ii., Q4(a) i., Q4(a) ii., Q4(a) iii., Q4(b) |
| L9 | Q2(d), Q2(e) | Q4(b), Q4(c) i., Q4(c) ii., Q4(d), Q4(e) | Q4(b), Q4(c) i., Q4(c) ii., Q4(d) i., Q4(d) ii., Q4(d) iii., Q4(e) | Q4(c) i., Q4(c) ii., Q4(d) i., Q4(d) ii., Q4(e) i., Q4(e) ii. |

## The papers, question by question

| Paper · Q | Lectures | Parts (marks) and stimulus |
|---|---|---|
| A Q1 | L1, L2, L3 | (a) backprop + why the logistic function (4) · (b) batch-norm equations, explain each term (4) · (c) CNN code → shapes, parameters, GAP vs Flatten (6) · (d) vanishing gradients + two causes (3) · (e) dropout (3) |
| A Q2 | L4, L5, L6–7 | (a) unrolled memory-cell diagram → equations; shapes + count (2 + 2) · (b) the four input/output configurations (4) · (c) scenario: why SimpleRNN(1) fails, fix (4) · (d) tied weights: equation + count (4) · (e) denoising autoencoders (4) |
| A Q3 | L6–7, L5, L2, L8 (+ L1) | (a) GAN code → draw, count (4) · (b) the two training phases (5) · (c) three difficulties of training GANs (3) · (d) unsupervised pretraining (4) · (e) Bahdanau alignment-model diagram → equations; additive vs Luong (2 + 2) |
| A Q4 | L8, L9, L1 | (a) scaled dot-product attention: explain; Q, K, V shapes; output shape (2 + 2 + 1) · (b) discounted returns + credit assignment (4) · (c) Q-learning update: explain; one step (2 + 2) · (d) ε-greedy, off-policy (3) · (e) policy-network code → draw, why one sigmoid output, sampling (4) |
| B Q1 | L1, L2, L3 | (a) XOR MLP diagram → outputs; function + why one Perceptron can't (2 + 2) · (b) Adam equations: m, s; β1, β2; steps 3–4 (2 + 1 + 2) · (c) scenario: conv-layer parameters, compute and memory (1 + 2 + 2) · (d) transfer-learning code (3) · (e) why nonlinear activations; positive regression output (3) |
| B Q2 | L4, L3, L1, L8 | (a) LSTM diagram → equations; gate roles (2 + 2) · (b) Conv1D + LSTM code → draw, shapes, count (6) · (c) unstable gradients, layer norm (3) · (d) scenario: noisy-square sequences → X, y shapes, output layer, loss (3) · (e) causal vs bidirectional RNNs (4) |
| B Q3 | L6–7, L3, L5, L8 | (a) VAE Sampling-layer code → latent loss; why logvar; sampling (2 + 1 + 2) · (b) DCGAN generator code → shapes, three guidelines (5) · (c) convolutional autoencoders (3) · (d) linear autoencoder code = PCA (2 + 2) · (e) ViT patches (3) |
| B Q4 | L8, L9, L1 | (a) transformer inference; masked vs cross attention (2 + 2) · (b) MDP diagram → two value-iteration steps (5) · (c) Q-values → optimal policy (1 + 2) · (d) DQN code → count, target + `runs`, two targets (1 + 2 + 1) · (e) the REINFORCE steps (4) |
| C Q1 | L1, L2, L3 | (a) one Perceptron update by hand: output; new weights; convergence (1 + 2 + 1) · (b) Glorot σ² and r; He σ² (2 + 1) · (c) two-input, two-output Wide & Deep code → draw, count, aux output and loss weights (6) · (d) power and exponential LR schedules computed (3) · (e) one 5 × 5 vs two 3 × 3 kernels counted; the first-layer exception (4) |
| C Q2 | L4, L3, L2 | (a) GRU equations → role of z; r and two simplifications of the LSTM (2 + 2) · (b) `ahead_model` code → batch shapes; count; vs one step at a time (1 + 2 + 2) · (c) inception module → output depth, “same” padding, kernel sizes (3) · (d) deep-RNN code → layer shapes, return_sequences, why a worse MAE (4) · (e) dying ReLUs, leaky ReLU, ELU, why ELU with α = 1 (4) |
| C Q3 | L5, L6–7, L3, L8 | (a) one-autoencoder-at-a-time code → phases and shapes; shapes, counts, ReLU output (2 + 2) · (b) GAN training-loop code → shapes and labels; what y2 = 0 without freezing would train; why no fit() (2 + 2 + 1) · (c) VAE generation and semantic interpolation (3) · (d) AlexNet's regularization and ResNet skip connections (4) · (e) positional-encoding equation → shapes and why unique; compute P for p = 1 (2 + 2) |
| C Q4 | L8, L4, L9 | (a) bus/rail encoder–decoder code → state shape; count; decoder inputs in training vs testing (1 + 2 + 2) · (b) multi-head attention: why split; 512 columns, H = 8 (3) · (c) vacuum-robot policy → parameters, stochastic, brute force; genetic algorithms and policy gradients (2 + 2) · (d) TD-learning equation → terms and why; one update (2 + 2) · (e) MDP code → two Q-value-iteration steps by hand (2 + 2) |

## Parts per lecture (markable units; some parts cite two lectures)

| | L1 | L2 | L3 | L4 | L5 | L6–7 | L8 | L9 |
|---|---|---|---|---|---|---|---|---|
| Sample | 5 | 1 | 2 | 4 | 0 | 1 | 1 | 2 |
| A | 4 | 4 | 1 | 4 | 3 | 4 | 5 | 5 |
| B | 6 | 4 | 5 | 5 | 2 | 5 | 4 | 7 |
| C | 4 | 4 | 3 | 7 | 2 | 4 | 6 | 6 |

## Paper C (added 2026-10-26)

Written as the harder paper: 35 markable parts rated difficulty 1 ×1, 2 ×11, 3 ×19, 4 ×4 (A and B were mostly 2). A question validator and a blind answer checker reviewed it (validator: 12 keep, 11 revise, 1 replace; checker: 31/37 agreed, 0 wrong numbers); all their fixes were applied except one: the GRU part gives the slide-49 equations rather than the slide-48 diagram, so Paper C has no “given diagram → write the equations” part. It targets what A and B leave out (CNN architectures, initialization, learning-rate schedules, activation functions, GRU, policy search, TD learning, Q-value iteration, positional encodings, multi-head attention) and the calculation asks the slides make easy to set (a Perceptron update, Glorot/He, schedules, kernel-size counts, inception depth, RNN counts, positional-encoding values, a TD update, two Q-value-iteration steps, deep-RNN shapes). Every number is checked in `verify_counts.py` ("C Q…" lines). Still not in any paper: ℓ1/ℓ2 regularization, Huber loss, visual attention.

## What changed after validation

- **Lecture mixing:** A Q2(e) ↔ A Q3(d) and B Q2(e) ↔ B Q3(d) were swapped so that every question spans at least three lectures.
- **Replaced:** A Q1(d) (pooling arithmetic, the lowest-value part) → vanishing gradients, which no paper covered; B Q2(d) (naive forecasting MAE/MAPE, whose "why" isn't on the slide) → a Lab Sheet 4 noisy-squares scenario, the paper's missing "scenario → shapes/loss" part; B Q1(e) (exponential learning-rate schedule) → why MLPs need nonlinear activations, because L1 was light.
- **Revised:** subparts above 2 marks split (A Q4(a), B Q1(a), (b), B Q3(a)); B Q3(b) made a single 5-mark part with the three guidelines pinned; ambiguities closed (the generator's 20-number input in A Q3(a), Conv1D's default stride and padding in B Q2(b), unavailable actions in B Q4(b), "in your equations" for the memory-cell shapes, "relative to its original value" for the error-rate drop); A Q4(e) asks why one sigmoid output suffices instead of a fifth parameter count; A Q2(d) uses 256-64-256-784 layers so the count isn't the one printed on L5 slide 21; B Q4(d) tests the `runs` line instead of repeating A Q4(c)'s target explanation.
- **Not in any paper (worth revising separately):** CNN architectures (LeNet-5 → ResNet), ℓ1/ℓ2 regularization, learning-rate schedules, visual attention, policy search and genetic algorithms.
