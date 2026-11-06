Generate a high-yield exam revision podcast covering all nine topics of CITS5017 Deep Learning.

CONTEXT & AUDIENCE
The listener is driving to their final CITS5017 exam and can only listen (no screen or code). They need a complete, connected mental map of all 9 topics to walk in with total confidence.

SOURCE HIERARCHY & BALANCING
1. The lecture slides (cits5017-lect01 to lect09) define the examinable scope. Do not introduce topics that are not in the sources.
2. The study pages (CNN's, RNN's, Autoencoders, AEs_and_GANs, Transformers, Reinforcement) provide analogies, intuitions and worked examples for Topics 3-9.
3. Topics 1-2 have no study page: explain them from the slides with equal depth; they are the foundation.

HOST ROLES
- Host A (The Reviewing Student): Driving to uni. Asks active-recall questions, flags exam traps, bridges topics.
- Host B (The Deep Learning Architect): Explains the "whys", trade-offs, tensor shapes and formulas in audio-friendly words.

9-TOPIC REVISION ROADMAP

Topic 1: ANNs & Foundations (lect01)
- Perceptron/TLU (z = w^T x + b), update rule, linear boundary and XOR.
- MLPs, backprop via the chain rule, why non-linear activations (Sigmoid, Tanh, ReLU) are needed.
- Regression vs classification outputs and losses.
- Keras Sequential, Functional (Wide & Deep), Subclassing (architecture hidden: no cloning, summary() can't show connections).
- Saving models, callbacks, TensorBoard, hyperparameters (learning rate most important).

Topic 2: Training DNNs (lect02)
- Vanishing/exploding gradients; Glorot (Tanh/Sigmoid), He (ReLU), LeCun (SELU) init.
- Dying ReLU vs Leaky ReLU, ELU, SELU, GELU, Swish, Mish.
- Batch Norm: mechanics, training vs inference, use_bias=False in the preceding layer. Gradient clipping.
- Momentum, Nesterov, AdaGrad, RMSProp, Adam, AdaMax, Nadam, AdamW; LR schedules (power, exponential, piecewise, performance, 1cycle).
- l1/l2, Dropout, EarlyStopping; Transfer Learning (freeze → train head → unfreeze → recompile).

Topic 3: CNNs (lect03)
- Receptive fields, filters (Sobel, Laplacian), Valid vs Same padding, strides.
- Output size O = floor((W - K + 2P)/S) + 1; params (K_h * K_w * C_in + 1) * C_out; weight sharing; memory cost.
- Max vs Average vs Global Average Pooling.
- LeNet-5, AlexNet, GoogLeNet (Inception), VGGNet, ResNet (skip connections, 152 layers), Xception (depthwise separable), SENet; pretrained models.

Topic 4: RNNs (lect04)
- Recurrent neurons, h_t, unrolling; Seq2Seq, Seq2Vec, Vec2Seq, Encoder-Decoder; inputs [Batch, Time Steps, Features].
- Bus/rail forecasting: naive baseline, MAE, windows, Huber loss, multivariate, several steps ahead, seq2seq.
- BPTT, vanishing gradients, Layer Norm vs Batch Norm.
- LSTM (long-term c_t conveyor belt, short-term h_t; forget, input, output gates) vs GRU (r_t, z_t).
- 1D Conv layers in front of a GRU.

Topic 5: Autoencoders (lect05)
- Encoder, decoder, undercomplete codings bottleneck.
- Linear AE with MSE = PCA subspace (the PCA plane, not necessarily the principal axes).
- Stacked AEs, tied weights halving the weights (163,814 to 82,414 params), greedy layer-wise pretraining.

Topics 6-7: AEs & GANs (lect06-07)
- Conv AEs (Conv2DTranspose), Denoising AEs.
- VAEs: mu and gamma = log(sigma^2), z = mu + exp(gamma/2) * epsilon, loss = Reconstruction + KL; semantic interpolation.
- GANs: Phase 1 trains the Discriminator on 50/50 real/fake; Phase 2 trains the Generator, Discriminator FROZEN; mode collapse, Nash equilibrium, DCGANs.

Topic 8: Attention & Transformers (lect08)
- Seq2Seq bottleneck and long paths; Bidirectional RNNs (concatenated states).
- Bahdanau (additive) vs Luong (dot, general, concat); Keras AdditiveAttention vs Attention.
- Queries, Keys, Values; softmax(Q K^T / sqrt(d_k)) V and why we scale.
- Multi-Head Attention, sinusoidal positional encodings, Add & Norm, causal masking (SOS → EOS), self- vs cross-attention, ViT (16x16 patches), Hugging Face.

Topic 9: Reinforcement Learning (lect09)
- Agent, environment, rewards; CartPole; neural network policies; policy search vs value-based.
- Credit assignment, discounted returns (gamma), action advantages, REINFORCE's 4 steps.
- Markov chains vs MDPs, Bellman equation, Value vs Q-Value Iteration (gamma shifts the best policy).
- TD learning, Q-Learning, off-policy (Q-Learning) vs on-policy (policy gradients), epsilon-greedy, approximate Q-Learning.
- DQN: replay buffer, target y = r + gamma * max Q(s',a') from the same network, decaying epsilon, instability and catastrophic forgetting.

AUDIO FORMATTING & ACTIVE RECALL
- Include 4 short "Exam Memory Checkpoints" (e.g., "Quick pause: why does return_sequences=True matter when stacking GRU layers?"): Host A asks, pauses 2 seconds, Host B answers.
- Tone: energetic, encouraging, rigorous, built for memory consolidation during a drive.
- End with a rapid-fire 60-second "Exam Room Confidence Checklist".
