# Coverage plan: lectures × parts across the three papers

Planned 2026-10-24, before the practice questions were written, from the three syllabus inventories (every slide of every deck read as an image) and `format-spec.md`. `check-papers.mjs` parses the **Matrix** table below and fails if it disagrees with the data in `src/components/portal/modules/deep-learning/exam-practice/papers/` (a part is listed under a lecture when one of its topics cites that lecture).

## Rules this plan follows

- **Every lecture (1, 2, 3, 4, 5, 6–7, 8, 9) appears in each practice paper.**
- **GANs appear** (the sample has none): Paper A Q3 (a)–(c), Paper B Q3 (b).
- **Weighting follows the decks' emphasis** (their summary slides): L9 (69 slides; RL is a learning outcome on its own) and L4 (sequences, a learning outcome) get the most parts; L5 (27 slides) the fewest.
- **Every stimulus type appears in each paper**: given code → draw/count; given equation → explain each term; given diagram → write equations or compute; scenario → reason about shapes, losses, set-up.
- **Learning outcomes** (exam note): DNNs on structured and unstructured data (L1–L3: A Q1, B Q1), sequence processing on time series (L4: A Q2, B Q2), generative models (L5, L6–7 VAEs/AEs: sample Q2(b), A Q2(d)–(e), A Q3(d), B Q2(e), B Q3(a), (c)), GANs (A Q3, B Q3(b)), deep reinforcement learning (L9: sample Q2(d)–(e), A Q4, B Q4).
- **Nothing outside the slides**, nothing marked not examined (L8 slide 47 onward; L8 slide 41 beam search; L2 slide 66 alpha dropout; L5 slide 3 diffusion models; L5 slide 27 sparse autoencoders), and nothing the slides never state (target networks, double/dueling DQN, the conv output-size formula, MultiHeadAttention parameter counts, the replay buffer's purpose).
- **No sample ask repeated**: the sample's types are reused with new content (CNN code instead of the Wide & Deep code; Adam and batch-norm equations instead of plain gradient descent; a memory-cell and an LSTM diagram instead of the gated FC module; computing value iteration instead of explaining its terms).

## Matrix

Each cell lists the parts that draw on that lecture (S = sample paper, A, B = practice papers).

| Lecture | Sample paper | Practice paper A | Practice paper B |
|---|---|---|---|
| L1 | Q1(c), Q1(d), Q1(e) i., Q1(e) ii., Q2(a) ii. | Q1(a), Q4(e) | Q1(a), Q4(d) |
| L2 | Q1(d) | Q1(b), Q1(e), Q2(e) | Q1(b), Q1(d), Q1(e) |
| L3 | Q1(a), Q1(b) | Q1(c), Q1(d) | Q1(c), Q2(b), Q3(c) |
| L4 | Q1(e) i., Q1(e) ii., Q2(a) i., Q2(a) iii. | Q2(a) i., Q2(a) ii., Q2(b), Q2(c) | Q2(a) i., Q2(a) ii., Q2(b), Q2(c), Q2(d) |
| L5 | — | Q2(d), Q2(e), Q3(d) | Q2(e) |
| L6–7 | Q2(b) | Q3(a), Q3(b), Q3(c), Q3(d) | Q3(a) i., Q3(a) ii., Q3(b) i., Q3(b) ii., Q3(c) |
| L8 | Q2(c) | Q3(e) i., Q3(e) ii., Q4(a) i., Q4(a) ii. | Q3(d), Q3(e), Q4(a) i., Q4(a) ii. |
| L9 | Q2(d), Q2(e) | Q4(b), Q4(c) i., Q4(c) ii., Q4(d), Q4(e) | Q4(b), Q4(c) i., Q4(c) ii., Q4(d) i., Q4(d) ii., Q4(d) iii., Q4(e) |

## The plan, question by question

| Paper · Q | Lectures (in part order) | Parts (marks) and stimulus |
|---|---|---|
| A Q1 | L1, L2, L3, L3, L2 | (a) backprop + why the logistic function (4) · (b) batch-norm equations, explain each term (4) · (c) CNN code → shapes, parameters, GAP vs Flatten (6) · (d) max/average pooling by hand (3) · (e) dropout (3) |
| A Q2 | L4, L4, L4, L5, L5 + L2 | (a) unrolled memory-cell diagram → equations, weight shapes, count (2 + 2) · (b) the four input/output configurations (4) · (c) scenario: why SimpleRNN(1) fails, fix (4) · (d) tied weights: equation + count (4) · (e) unsupervised pretraining (4) |
| A Q3 | L6–7, L6–7, L6–7, L6–7 + L5, L8 | (a) GAN code → draw, count (4) · (b) the two training phases (5) · (c) three difficulties of training GANs (3) · (d) denoising autoencoders (4) · (e) Bahdanau alignment-model diagram → equations; additive vs Luong (2 + 2) |
| A Q4 | L8, L9, L9, L9, L9 + L1 | (a) scaled dot-product attention, explain + shapes (2 + 3) · (b) discounted returns + credit assignment (4) · (c) Q-learning update, explain + one step (2 + 2) · (d) ε-greedy, off-policy (3) · (e) policy-network code → draw, count, choose action (4) |
| B Q1 | L1, L2, L3, L2, L2 | (a) XOR MLP diagram → outputs; why one Perceptron can't (3 + 1) · (b) Adam equations, explain (3 + 2) · (c) scenario: conv-layer memory and compute (1 + 2 + 2) · (d) transfer-learning code (3) · (e) exponential learning-rate schedule (3) |
| B Q2 | L4, L4 + L3, L4, L4, L5 | (a) LSTM diagram → equations, gate roles (2 + 2) · (b) Conv1D + LSTM code → draw, shapes, count (6) · (c) unstable gradients, layer norm (3) · (d) naive forecasting, MAE vs MAPE (3) · (e) linear autoencoder code = PCA (2 + 2) |
| B Q3 | L6–7, L6–7, L6–7 + L3, L8, L8 | (a) VAE Sampling-layer code → latent-loss equation, sampling (3 + 2) · (b) DCGAN generator code → shapes, guidelines (2 + 3) · (c) convolutional autoencoders (3) · (d) causal vs bidirectional RNNs (4) · (e) ViT patches (3) |
| B Q4 | L8, L9, L9, L9 + L1, L9 | (a) transformer inference, masked vs cross attention (2 + 2) · (b) MDP diagram → two value-iteration steps (5) · (c) Q-values → optimal policy (1 + 2) · (d) DQN code → count, target, one target value (1 + 2 + 1) · (e) the REINFORCE steps (4) |

## Parts per lecture (all three papers)

| | L1 | L2 | L3 | L4 | L5 | L6–7 | L8 | L9 |
|---|---|---|---|---|---|---|---|---|
| Sample | 5 | 1 | 2 | 4 | 0 | 1 | 1 | 2 |
| A | 2 | 3 | 2 | 4 | 3 | 4 | 4 | 5 |
| B | 2 | 3 | 3 | 5 | 1 | 5 | 4 | 7 |

(Parts are counted as markable units, so a part with subparts counts once per subpart. Some parts cite two lectures.)
