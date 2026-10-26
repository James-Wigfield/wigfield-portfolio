LISTENER
A CITS5017 Deep Learning student is driving to their final exam and can only listen: no screen, no notes, no code. They studied everything, but early lectures have faded. Rebuild one connected mental map of all nine lectures and send them in confident.

SOURCES
The lecture slides (cits5017-lect01 to lect09) define what is examinable. Follow the slides if sources disagree; never go beyond them. The other six PDFs are study pages for Lectures 3-9: use them for explanations, analogies and worked examples, not their interactive features. Lectures 1-2 have no study page: teach them from the slides with full attention. Talk about the ideas, never the documents.

HOSTS
Host A, the reviewing student, asks quick recall questions ("pause and answer in your head", then a beat), flags exam traps and links back to earlier lectures. Host B explains the why, the mechanism and the formulas in plain words.

COVERAGE (in order, every item mentioned; CNNs, attention and RL get double airtime; never rush Lectures 8-9; if time is short, shorten 1, 2 and 5, never skip)
1 ANNs: perceptron/TLU, update rule, linear boundary and XOR; MLPs, backprop, activations; regression vs classification outputs and losses; Sequential, Functional, Subclassing APIs (subclassing hides the architecture); saving, callbacks, TensorBoard; hyperparameters, learning rate most important.
2 Training DNNs: vanishing/exploding gradients; Glorot, He, LeCun init; leaky ReLU, ELU, SELU, GELU, Swish, Mish; batch norm (train vs inference, preceding bias redundant); gradient clipping; transfer learning (freeze, train head, unfreeze, recompile); momentum, Nesterov, AdaGrad, RMSProp, Adam, AdaMax, Nadam, AdamW; LR schedules (power, exponential, piecewise, performance, 1cycle); l1/l2, dropout, MC dropout, max-norm, early stopping.
3 CNNs: receptive fields; filters (Sobel, Laplacian) and feature maps; channels; stride; valid vs same padding; output size and parameter formulas; memory cost; max, average, global pooling; LeNet-5, AlexNet, GoogLeNet, VGG, ResNet, Xception, SENet; pretrained models.
4 RNNs: recurrent neurons, memory cells, unrolling; seq-to-seq, seq-to-vector, vector-to-seq, encoder-decoder; inputs shaped [batch, time steps, features]; backprop through time; bus/rail forecasting (naive baseline, MAE, Huber, windows, multivariate, several steps ahead); return_sequences; layer norm; LSTM (long- and short-term states, forget/input/output gates) vs GRU; 1D convolutions.
5 Autoencoders: undercomplete codings; linear AE = PCA subspace; stacked AEs; tied weights; one AE at a time; unsupervised pretraining.
6-7 Convolutional and denoising AEs; VAEs (mean, log-variance gamma, z = mu + exp(gamma/2) x epsilon, reconstruction + KL loss, generation, interpolation); GANs (phase 1: discriminator on half real, half fake; phase 2: generator, discriminator frozen; Nash equilibrium, mode collapse); DCGANs.
8 Attention: the long-path problem in encoder-decoder translation; bidirectional RNNs; Bahdanau (additive) vs Luong (multiplicative: dot, general, concat) scores, softmax weights, weighted sum; queries, keys, values; Keras Attention vs AdditiveAttention; transformer: positional encodings, softmax(QK^T / sqrt(d_keys)) V and why we scale, multi-head, self- vs cross-attention, masked decoder attention, Add and Norm, feed-forward, SOS to EOS; Vision Transformers (16x16 patches).
9 RL: agent, environment, rewards, policy; policy search; CartPole; credit assignment; discounted returns (gamma 0.95: 13 steps away counts about half); action advantage; REINFORCE; Markov chains vs MDPs; Bellman equation; value vs Q-value iteration (gamma 0.9 vs 0.95 changes the best policy); TD learning, Q-learning, off- vs on-policy; epsilon-greedy; deep Q-learning (target r + gamma x max Q(s',a'), replay buffer); instability, catastrophic forgetting.

TEACHING
- Open with a 60-second story of the unit: neuron, deep nets, training them, seeing, remembering, compressing, creating, focusing, acting.
- Each topic: core idea, mechanism, exam detail, vivid analogy.
- Link lectures: vanishing gradients lead to ReLU/He/batch norm, then LSTM, attention, transformers; encoder-decoder in AEs vs seq2seq; Huber in forecasting and DQN; softmax in classifiers, attention and policies.
- Contrast every "vs" above, plus batch vs layer norm and AE vs VAE vs GAN.
- Work these checked numbers aloud: Dense 784 to 300 = 235,500 params; Conv 3x3 over 3 channels, 32 filters = 896; 28x28 with 3x3 at stride 1 = 26 valid, 28 same, stride 2 same = 14; bidirectional SimpleRNN(16) on 2 features + Dense(2) = 674; LSTM = 4x SimpleRNN weights; softmax of 2, 1, 0 = 0.67, 0.24, 0.09.
- Never read code aloud; explain key arguments (return_sequences, return_state, padding, strides).
- Audio only: no "as you can see", no slide or page numbers.

ENDING
Lightning round: one rapid question per lecture, in order, then a 30-second confident send-off.

STYLE
Energetic, warm, short sentences. No filler, no history tangents.
