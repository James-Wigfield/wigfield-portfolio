/* ============================================================================
   LECTURE 8 STUDY — SECTION CONTENT (the Read beat)
   ----------------------------------------------------------------------------
   The module's prose, as data, in slide order. Layout code never holds
   prose: edit a paragraph here and the page updates. The notebook pages
   (the Write beat) live in ./sheets, one file per section.

   Inline markup (rendered by Rich.jsx):
     **bold**   *italic*   `code`   $tex$   [label](#sectionId)   [^n] footnote

   Each section:
     id, no, title, short, slides     identity, rail label, slide receipt
     notExamined                       slide 47: "not covered in the exam"
     read      blocks — a string is a paragraph; objects are
               { eq: { name, tex, read } }, { list }, { code: { src, label } },
               { note, label? }, { slideNote }, { unfold: { label, blocks } },
               { fig } ({ code: { src } } takes inline code or a NAMED_CODE
               key from slideData.js)
     play      lab keys (components in ./labs, registry ./labs/index.js)

   Every slide 1–51 lands in exactly one section (tools/dl-lecture8-study/
   page-check.mjs checks the coverage from these ranges).
   ========================================================================== */

export const SECTIONS = [
  /* ── §0 ─────────────────────────────────────────────────────────────── */
  {
    id: 's00',
    no: '0',
    title: 'Intro: roadmap & how to use this page',
    short: 'Intro & roadmap',
    slides: '1–3',
    read: [
      '**Topic 8: Attention Mechanisms, Transformers, and Vision Transformers** — CITS5017 Deep Learning, Associate Professor Du Huynh (Unit Coordinator and Lecturer), Semester 2, 2026 (slide 1). Today covers Chapter 16 of *Hands-on Machine Learning with Scikit-Learn, Keras & TensorFlow* (slide 2 writes “Chapters 16.”).',
      'Chapter Sixteen is ***Natural Language Processing with RNNs and Attention***. Slide 3 lists the main topics: encoder-decoder networks for neural machine translation; bidirectional RNNs and LSTMs; attention mechanisms, including additive attention and multiplicative attention; implementing attention mechanisms using Keras; visual attention; the original transformer; and the original vision transformer.',
      'Every section below follows the deck in order and has three beats: **Read** the short explanation, **Play** with the lab until the idea clicks, then **Write**: copy the notebook page onto paper and tick each line as it goes in. The notebook pages hold only what is worth memorising; anything a page leaves out is named in a grey line at its foot, and it is still here in Read and Play. Ticks and your place are saved in this browser.',
      'The labs share one picture language. Words are outlined boxes; **queries** are orange-red, **keys** blue, **values** green, the **encoder** teal and the **decoder** pink. Attention is drawn as light: the brighter a beam or cone, the larger the weight. Matrices are heatmaps. Numbers appear when you hover, and in each lab’s “Show the maths” drawer.',
      'Numbers printed on the slides carry their slide number. Anything this page made itself is labelled as **this page’s own**: the toy vectors in the labs, the bus/rail models it trained with the slides’ code ([§3](#s03), [§5](#s05)), and a tiny transformer it trained on a toy English → Spanish grammar ([§13](#s13), [§14](#s14)). The bus/rail story continues from the [Lecture 4 study module](/portal/dl-lecture-4-study). [§16](#s16) (slides 47–49) is **not examined** (slide 47).',
    ],
    play: ['roadmap'],
  },

  /* ── §1 ─────────────────────────────────────────────────────────────── */
  {
    id: 's01',
    no: '1',
    title: 'Encoder–decoder networks for neural machine translation',
    short: 'Encoder–decoder for NMT',
    slides: '4–6',
    read: [
      'In an earlier topic we learnt that an **encoder-decoder network**[^1] can process sequences (slide 4). Figure 15-4 shows the four shapes from Topic 4: **sequence-to-sequence** (top left), **sequence-to-vector** (top right, all outputs but the last ignored), **vector-to-sequence** (bottom left) and the **encoder-decoder** (bottom right), where an encoder reads the inputs and passes its state to a decoder that produces the outputs.',
      'Encoder-decoder networks are particularly suitable for ***Neural Machine Translation*** (**NMT**): the input is an English sentence and the output a Spanish sentence (slide 5). Both are sequences, and they need not have the same length. Figure 16-3 translates “I like soccer” (three words) into “Me gusta el fútbol” (four words).',
      '**Figure 16-3, bottom to top.** The English words become token IDs (3, 36, 854) and go through an **Embedding** layer into the encoder’s cells $\\mathbf{x}_{(0)}, \\mathbf{x}_{(1)}, \\mathbf{x}_{(2)}$. The encoder’s own outputs $\\hat{\\mathbf{y}}_{(0)}$–$\\hat{\\mathbf{y}}_{(2)}$ are greyed out: unused. Only the **last encoder cell’s state** crosses into the first decoder cell. The decoder’s inputs are “<sos> Me gusta el fútbol” (IDs 2, 14, 61, 10, 663), and its outputs go through **Dense + softmax activation** to the predictions. The figure prints the prediction “Me *encanta* el fútbol <eos>” under the target “Me gusta el fútbol <eos>”: “encanta” is marked wrong (red).',
      'In NMT, words are represented as **embedding vectors**[^2]. The encoder and decoder can each be a simple RNN, a stacked RNN, or an LSTM (slide 6).',
      'At each time step, a regular recurrent layer only looks at **past and present inputs** before generating its output. In other words it is ***causal***: it **cannot look into the future**. That makes sense when forecasting time series, or in the **decoder** of a sequence-to-sequence model. But for tasks like text classification and translation, it is often preferable to **look ahead at the next words** before encoding a given word.',
      'For example, take the phrases “*the right arm*”, “*the right person*” and “*the right to criticize*”: to properly encode the word “*right*”, you need to look ahead (slide 6).',
    ],
    play: ['longPath', 'rightWord'],
  },

  /* ── §2 ─────────────────────────────────────────────────────────────── */
  {
    id: 's02',
    no: '2',
    title: 'Bidirectional RNNs and LSTMs',
    short: 'Bidirectional RNNs',
    slides: '7–8',
    read: [
      'One solution to looking ahead: run **two recurrent layers on the same inputs**, one reading the words **from left to right** and the other **from right to left**, then **combine their outputs at each time step**, typically by **concatenating** them. This is what a ***bidirectional recurrent layer*** does (slide 7, Figure 16-5: the forward cells are chained left to right, the backward cells right to left, and the two outputs at each step are concatenated into $\\hat{\\mathbf{y}}_{(t)}$).',
      'For example, this `Bidirectional` layer could be the encoder in the translation model (slide 8):',
      { code: { src: 'BI_ENCODER', label: 'slide 8' } },
      '**There is just one problem.** The layer now returns **four states instead of two**: the final **short-term** and **long-term** states of the **forward** LSTM, and the final short-term and long-term states of the **backward** LSTM. They won’t fit the decoder’s LSTM layer, and we **cannot make the decoder bidirectional** (slide 8 gives no reason; slide 6 notes that a causal layer is what makes sense in the decoder of a sequence-to-sequence model).',
      'The fix: **concatenate the two short-term states**, and **concatenate the two long-term states**. The states come out as [forward short-term, forward long-term, backward short-term, backward long-term], so `encoder_state[::2]` picks items 0 and 2 (short-term) and `encoder_state[1::2]` picks items 1 and 3 (long-term):',
      { code: { src: 'BI_STATES', label: 'slide 8' } },
      'Each concatenated state is twice as wide as one direction’s: 256 + 256 = 512 here, so the decoder’s LSTM would need 512 units for the states to fit (this page’s working; slide 14 states the same rule for `rnn_ed` in [§5](#s05), where `SimpleRNN(16)` in each direction gives a 32-wide state).',
    ],
    play: ['biReaders'],
  },

  /* ── §3 ─────────────────────────────────────────────────────────────── */
  {
    id: 's03',
    no: '3',
    title: 'A bidirectional RNN on the bus/rail data',
    short: 'simple_biRNN on bus/rail',
    slides: '9–11',
    read: [
      'Back to the CTA bus/rail ridership data from [Lecture 4](/portal/dl-lecture-4-study). Slide 9 tries a simple bidirectional RNN with inputs $(\\text{bus}, \\text{rail})$ over **56 days**, predicting the $(\\text{bus}, \\text{rail})$ values for the following day (the **57th** day):',
      { code: { src: 'SIMPLE_BIRNN', label: 'slide 9' } },
      'The model is `Bidirectional(SimpleRNN(16))` followed by `Dense(2)`: **674 trainable parameters** (slide 9). It is trained with SGD (`learning_rate=0.02`, `momentum=0.9`), MSE loss and an MAE metric, for up to 500 epochs with **early stopping** (`patience=50`, restoring the best weights). `PrintEpochLossCallback` is a customised callback that prints the loss every so often (the slide doesn’t define it). The training set has shape (1027, 56, 2): 1,027 windows of 56 days × 2 series.',
      { eq: { name: 'Counting the 674 (this page’s working)', tex: '2 \\times \\underbrace{(16 \\times 16 + 2 \\times 16 + 16)}_{\\text{one direction: } 304} + \\underbrace{(32 \\times 2 + 2)}_{\\texttt{Dense(2)}:\\ 66} = 608 + 66 = 674', read: 'each direction’s SimpleRNN(16) has recurrent weights, input weights and biases; Dense(2) reads the 32 concatenated outputs' } },
      { unfold: { label: 'Slide 10: the training log and the validation MAE', blocks: [{ code: { src: 'BIRNN_LOG', label: 'slide 10 · training log' } }, { code: { src: 'BIRNN_EVAL', label: 'slide 10' } }] } },
      'Its validation MAE is **27,936** (slide 10), slightly worse than the **27,855** of the RNN in Topic 4 (slide 33/52), which used $(\\text{bus}, \\text{rail}, \\text{one-hot-encoding(days)})$, i.e. **5 input features**, to predict the 57th day. Adding information about the days of the week should lower the validation MAE even further.',
      '**Predicting further ahead (slide 11).** To predict more days ahead, use a *for* loop as on Topic 4’s slide 34/52[^3]: `X_valid` has 56 days, then 57 days, then 58 days, … in the loop, each prediction appended as the next input. Unfortunately the prediction errors **accumulate quickly** for `simple_biRNN` as the ***prediction horizon*** grows: slide 11’s chart of validation MAE against “# prediction days” (1–14) has no data labels, but on its axis (ticks 50000 to 300000) the curve climbs from just under the 50000 line at 1 day to above the 300000 line at 14 days, with a small peak at 7 days.',
      { note: 'This page trained `simple_biRNN` with slide 9’s code on the same CTA data (Lecture 4’s split: train 2016-01 to 2018-12, validation 2019-01 to 2019-05; 1,027 training windows): **674** parameters, early stopping after 294 epochs (best epoch 243), validation MAE **28,337** against the slides’ 27,936. Its 14-day feedback loop over all 82 validation windows rises from 28,337 at 1 day to 132,289 at 14 days: far below where slide 11’s curve ends (above the 300000 gridline), and less smoothly. The lab shows this run.', label: 'This page’s own run' },
      { slideNote: 'Slide 9 builds the input with `InputLayer(input_shape=[None, 2])`; the earlier decks and slide 14 use `shape=`. In Keras 3 (this page’s run used 3.15.1) `input_shape` still works but warns that it is deprecated. The targets’ names also wander: the comment gives `y_train_1.shape = (1027,2)`, `fit` uses `y_train` and `validation_data` uses `y_valid_1`, and slide 10 scores against `y_valid`. For a `Dense(2)` output the targets must be the one-day `(…, 2)` arrays, which is what this page used. Footnote 3 says “test set” where the slide works on `X_valid`.' },
    ],
    play: ['horizon'],
  },

  /* ── §4 ─────────────────────────────────────────────────────────────── */
  {
    id: 's04',
    no: '4',
    title: 'An encoder–decoder for bus/rail: training vs testing',
    short: 'Training vs testing stage',
    slides: '12–13',
    read: [
      'Now an encoder-decoder for the same data (slide 12). The **encoder** learns the patterns in the numbers of bus and rail riders over **55 days** (Day 0–54, rather than 56), and the **decoder** predicts the numbers **14 days ahead** (Day 56–69). The encoder’s outputs are discarded; only its final state `encoder_state` ($\\mathbf{h}$) is passed to the first decoder cell.',
      '**Training stage (slide 12).** The decoder’s inputs are the **last day from `X_train`** (Day 55) **and `y_train` shifted by one timestep** (Day 56–68); its outputs are just **`y_train`** (Day 56–69). The handwriting on the slide: “X_train has 56 days’ data” (55 for the encoder, plus Day 55 for the decoder), “y-train has 14 days’ ground truth data”, and “Compare Estimated (Bus, Rail) from Day 56 to Day 69 against ground truth y-train and minimize MSE”. Every decoder input is a real value.',
      { note: 'Feeding the decoder the true previous day during training is often called *teacher forcing*. The term is not on the slides.', label: 'A name, beyond the slides' },
      '**Testing stage (slide 13).** Now the decoder only has an input at the **1st** timestep: the last time step (Day 55) of `X_test`, i.e. `X_test[:,-1,:]`. Its inputs for the other timesteps are unknown, so they are **set to 0**. The whole network is **run 14 times** for the 14 days’ prediction: `model.predict(...)` is called 14 times through a *for* loop, and each time a new (bus,rail) value is predicted, it **replaces the decoder’s input for the next day**. The handwriting: “Compare Estimated (Bus, Rail) from Day 56 to Day 69 against ground truth y_test to get the prediction error”, “assuming ground truth y_test is not available”.',
      { slideNote: 'Slides 12–13’s handwriting says the encoder sees 55 days and `X_train` / `X_test` holds 56 days; slide 14’s code comment then says the decoder predicts “14 days after the input 56 days” while the comment above it says the encoder takes “(55 days)”. They agree once you count Day 55, which goes to the decoder, not the encoder: 55 + 1 = 56 days of input. Slide 13’s text says the unknown decoder inputs start as 0, while its diagram draws each “Estimated” output fed back as the next input. Both hold: the inputs start as zeros and are replaced one by one as the loop predicts them. Slide 13 talks about `X_test`; slide 17 runs the same procedure on `X_valid`.' },
    ],
    play: ['stages'],
  },

  /* ── §5 ─────────────────────────────────────────────────────────────── */
  {
    id: 's05',
    no: '5',
    title: 'Implementing and evaluating rnn_ed',
    short: 'rnn_ed in Keras',
    slides: '14–17',
    read: [
      'Slide 14 builds the encoder-decoder, `rnn_ed`, with the Keras functional API. The encoder is `Bidirectional(SimpleRNN(16, return_state=True))` on (bus, rail) sequences; its `encoder_state` is a list of two states, the forward and the backward one, which are **concatenated** into one tensor of shape **(None, 32)**. The decoder is a `SimpleRNN(32, return_sequences=True)` started from that state (`initial_state=encoder_state`): its number of neurons **must match** the shape of `encoder_state`. A `Dense(2)` layer turns each decoder step into a (bus, rail) prediction, and `rnn_ed` takes two inputs, `[encoder_inputs, decoder_inputs]`.',
      { unfold: { label: 'Slide 14: rnn_ed, verbatim', blocks: [{ code: { src: 'RNN_ED', label: 'slide 14' } }] } },
      'Slide 15 compiles it with MSE loss, the `"nadam"` optimizer and an MAE metric, and fits it on `(X_train, X_train_decode)` → `y_train` for up to 500 epochs with the same early stopping (`patience=50`). The log runs from Epoch 0 to Epoch 260.',
      { unfold: { label: 'Slide 15: compile, fit and the training log', blocks: [{ code: { src: 'RNN_ED_FIT', label: 'slide 15' } }] } },
      'Slide 16: **inspect the learning curves** to make sure there is no overfitting or underfitting. In the chart (“biRNN Encoder-Decoder”), all four curves (loss, mae, val_loss, val_mae) drop almost vertically in the first few epochs; the losses flatten just above 0, the MAEs level off between 0.00 and 0.05 by about epoch 50–100, and the validation curves stay below the training curves. The chart has no data labels.',
      { unfold: { label: 'Slide 16: plotting the learning curves', blocks: [{ code: { src: 'CURVES', label: 'slide 16' } }] } },
      'Slide 17 evaluates it with a `predict()` function that runs the model 14 times, as described for the testing stage in [§4](#s04): the decoder’s inputs start as zeros except the first (Day 55), and each prediction fills in the next input. The result: **“Validation set MAE = 34,863.8857”**, which the slide calls *the lowest validation MAE so far for multi-task predictions for 14 days ahead*.',
      { unfold: { label: 'Slide 17: predict() and the validation MAE', blocks: [{ code: { src: 'PREDICT', label: 'slide 17' } }] } },
      { slideNote: 'Slide 17’s `predict()` is not runnable as printed: the body of its `for` loop is only the comment “# call model.predict(...) and update decoder_ins and outseq”. The call also passes `model` (the trained model is `rnn_ed`) and `out_seq_length` (the parameter is `outseq_len`, and `out_seq_length` is never defined). `X_train_decode` and `X_valid_decode` (slide 15) are never defined either; slide 12 describes them in words. Slide 16’s code sets the title “Learning curves”, but the chart printed is titled “biRNN Encoder-Decoder”.' },
      { note: 'This page ran slides 14–15 as written (1,794 parameters by Keras’s count; early stopping after 171 epochs, best epoch 120) and wrote its own loop body for slide 17’s `predict()`. Its validation MAE with that 14-step loop is **41,035**, against the slides’ 34,863.8857; with the true previous day fed in at every step, as in training, it is 31,037. The lab shows this run.', label: 'This page’s own run' },
    ],
    play: ['edForecast'],
  },

  /* ── §6 ─────────────────────────────────────────────────────────────── */
  {
    id: 's06',
    no: '6',
    title: 'Attention: a shorter path (Bahdanau)',
    short: 'Bahdanau attention',
    slides: '18–23',
    read: [
      'Back to the encoder-decoder for NMT. Follow the word “soccer” to its translation “fútbol” in Figure 16-3: the path is **quite long**. A representation of this word has to be carried over many steps before it is actually used (slide 18). *Can’t we make this path shorter?*',
      { slideNote: 'Slide 18’s sentence is missing words: “a representation of this word (along with all needs to be carried over many steps…”, and the parenthesis never closes. Géron’s text reads “(along with all the other words)”.' },
      'In a landmark 2014 paper, Bahdanau et al.[^4] introduced a technique that lets the decoder **focus on the appropriate words** (as encoded by the encoder) at each time step. For example, at the time step where the decoder needs to output “fútbol”, it focuses its attention on “soccer”. The path from an input word to its translation is now **much shorter**, so the short-term memory limitations of RNNs have much less impact (slide 19). ***Attention mechanisms*** revolutionized neural machine translation (and deep learning in general), with a significant improvement in the state of the art, especially for **long sentences** (e.g., over 30 words).',
      '**What changes (slide 20, Figure 16-7).** Instead of just sending the **encoder’s final hidden state** to the decoder, together with the **previous target word** at each step (not shown in the figure), **all of the encoder’s outputs** are now sent to the decoder as well. The decoder cannot deal with all these outputs, so they are aggregated: at each time step, the decoder’s memory cell computes a **weighted sum of all the encoder outputs**. This determines which words it will focus on at this step.',
      'The weight $\\alpha(t, i)$ is the weight of the $i^{\\text{th}}$ encoder output at the $t^{\\text{th}}$ decoder time step (slide 21). If, at time step 3, the weight $\\alpha(3, 2)$ is much larger than $\\alpha(3, 0)$ and $\\alpha(3, 1)$, the decoder pays much more attention to the encoder’s output for word #2 (“soccer”) than to the other two outputs. In Figure 16-7 the three weighted outputs meet at a “+” box below the decoder cell, labelled $\\times\\alpha_{(3,0)}$, $\\times\\alpha_{(3,1)}$, $\\times\\alpha_{(3,2)}$, and the arrow from “soccer” is drawn heaviest.',
      '**Where the weights come from (slide 22).** All these $\\alpha(t, i)$ weights are generated by a small neural network called an ***alignment model*** (or an ***attention layer***), trained jointly with the rest of the encoder-decoder model. In Figure 16-7 its blue **Dense** layer contains **only one neuron**. It processes the four input vectors[^5] and outputs a score $\\mathbf{e}_{3,i}$ for each $\\mathbf{y}_{(i)}$ for the current time step (3). Through the **softmax** layer, the three scores are then converted into probabilities, which are used as the weights that help the decoder predict the next word.',
      { slideNote: 'Slide 22 says “the three cores are then converted into probabilities”: *cores* is a typo for **scores** (the $e$ values the Dense layer outputs). Figure 16-7 draws the encoder’s outputs with hats, $\\hat{\\mathbf{y}}_{(0)}, \\hat{\\mathbf{y}}_{(1)}, \\hat{\\mathbf{y}}_{(2)}$, while the alignment model and footnote 5 write $\\mathbf{y}_{(0)}, \\mathbf{y}_{(1)}, \\mathbf{y}_{(2)}$: the same three vectors. The notation also shifts across slides 21–25: $\\alpha(t, i)$ and $\\mathbf{e}_{3,i}$ in the text of slides 21–22, $\\alpha_{(3,2)}$ and $e_{(3,2)}$ on slide 23, $\\alpha_{(t,i)}$ and $e_{(t,i)}$ on slide 25. They all mean the same weights and scores.' },
      '**Bahdanau attention (slide 23).** In the diagram the decoder has already output “me gusta el” (meaning “I like”), so it now expects a noun. The word “soccer” is the one that best aligns with the current state, so $e_{(3,2)}$ gets a **high score** and thus a **high probability** $\\alpha_{(3,2)}$ after the softmax function.',
      'This mechanism is called ***Bahdanau attention***, after the 2014 paper’s first author. Because it **concatenates** the encoder’s output vectors $\\mathbf{y}$ with the decoder’s previous hidden state $\\mathbf{h}$, it is also called ***concatenative attention*** or ***additive attention***.',
    ],
    play: ['beams'],
  },

  /* ── §7 ─────────────────────────────────────────────────────────────── */
  {
    id: 's07',
    no: '7',
    title: 'Luong (multiplicative) attention',
    short: 'Luong attention',
    slides: '24–25',
    read: [
      '**Luong attention**, or **multiplicative attention**, was proposed shortly after, in 2015, by Luong et al.[^6] (slide 24). The authors proposed to simply compute the **dot product** of the encoder’s output vectors $\\mathbf{y}$ and the hidden state vector $\\mathbf{h}$: it is often a fairly good **similarity measure**, and modern hardware can compute it very efficiently. The only constraint is that these vectors **must be of the same length**.',
      'Slide 25 defines the Luong attention mechanism and its three variants:',
      { eq: { name: 'The weighted sum (slide 25)', tex: '\\widetilde{\\mathbf{h}}_{(t)} = \\sum_{i} \\alpha_{(t,i)} \\mathbf{y}_{(i)}', read: 'the attention output at decoder step t: every encoder output, weighted' } },
      { eq: { name: 'The weights: a softmax of the scores (slide 25)', tex: '\\alpha_{(t,i)} = \\frac{\\exp(e_{(t,i)})}{\\sum\\limits_{i\'} \\exp(e_{(t,i\')})}', read: 'each weight is between 0 and 1, and the weights at step t add up to 1' } },
      { eq: { name: 'The three score functions (slide 25)', tex: 'e_{(t,i)} = \\begin{cases} \\mathbf{h}_{(t)}^{\\top} \\mathbf{y}_{(i)} & \\text{dot product} \\\\ \\mathbf{h}_{(t)}^{\\top} \\mathbf{W} \\mathbf{y}_{(i)} & \\text{general dot product} \\\\ \\mathbf{v}^{\\top} \\text{tanh} \\big( \\mathbf{W} \\big[ \\mathbf{h}_{(t)} ; \\mathbf{y}_{(i)} \\big] \\big) & \\text{concat} \\end{cases}', read: 'dot: compare h and y directly; general: through a learned matrix W first; concat: stack them, a learned layer with tanh, then a learned vector v' } },
      'The authors compared the **concat** mechanism against the two **dot product** mechanisms and found that **concat was outperformed** by both. Because of that, the concat variant of Luong attention is **less used now** (slide 25).',
      '**Additive vs multiplicative.** Bahdanau’s alignment model *concatenates* $\\mathbf{y}$ and $\\mathbf{h}$ and scores them with a small network ([§6](#s06): concatenative or additive attention). Luong’s dot-product scores *multiply* them ($\\mathbf{h}^{\\top}\\mathbf{y}$), hence multiplicative attention. Slide 23’s figure scores step 3 with the previous decoder state $\\mathbf{h}_{(2)}$; slide 25’s formulas use $\\mathbf{h}_{(t)}$.',
      { slideNote: 'Slide 24 says the only constraint is that the vectors must be of the same length. That is needed for the plain dot product $\\mathbf{h}_{(t)}^{\\top}\\mathbf{y}_{(i)}$. The general form $\\mathbf{h}_{(t)}^{\\top}\\mathbf{W}\\mathbf{y}_{(i)}$ only needs $\\mathbf{W}$ to have the right shape (as many rows as $\\mathbf{h}$ has entries, as many columns as $\\mathbf{y}$), which the slide doesn’t say. This page’s observation; the lab’s “give y a third number” switch shows both: the dot product disappears, while a 2 × 3 $\\mathbf{W}$ still gives a general score.' },
    ],
    play: ['luong'],
  },

  /* ── §8 ─────────────────────────────────────────────────────────────── */
  {
    id: 's08',
    no: '8',
    title: 'Attention in Keras; keys, values and queries',
    short: 'Keras · keys, values, queries',
    slides: '26–28',
    read: [
      'Keras provides a `tf.keras.layers.Attention` layer for **Luong attention** and an `AdditiveAttention` layer for **Bahdanau attention** (slide 26). Because the attention layer needs **all** of the encoder’s outputs, the encoder must be created with **`return_sequences=True`**:',
      { code: { src: 'KERAS_ENCODER', label: 'slide 26' } },
      'For simplicity, we can pass the **decoder’s outputs** instead of its states to the attention layer: in practice this works well too, and it’s much easier to code:',
      { code: { src: 'KERAS_ATTENTION', label: 'slide 26' } },
      'By default the `Attention` layer uses the ***dot product*** variant (`score_mode="dot"`). For the ***concat*** variant, set `score_mode="concat"`.',
      { slideNote: 'Slide 26’s code is a fragment: `encoder_outputs`, `decoder_outputs` and `vocab_size` are not defined on slides 26–51, and an encoder built with `return_state=True` also returns its states, which the slide never unpacks.' },
      '**Keys, values and queries (slide 27).** Take “I like soccer” again. Suppose the encoder understood that “I” is the subject and “like” is the verb, and the decoder has already translated the subject and should translate the verb next. It needs to **fetch the verb** from the input sentence. This is analogous to a ***dictionary lookup***: as if the encoder had created a dictionary {"subject": "They", "verb": "played", …} and the decoder wanted to look up the **value** that corresponds to the **key** `"verb"`. The outputs from the encoder are the **keys** and, optionally, the **values**; the outputs from the decoder are the **queries**.',
      { slideNote: 'Slide 27 sets up the sentence “I like soccer” but then prints the dictionary {"subject": "They", "verb": "played", …}, which doesn’t match it. The point is the dictionary lookup itself: a query (what the decoder needs next) is matched against keys, and the matching key’s value is fetched.' },
      'In attention the lookup is **soft**: the query is compared with *every* key, and the result blends *all* the values, each weighted by how well its key matched (the weighted sum of [§6](#s06) and [§7](#s07)). This page’s gloss; the lab lets you slide from a soft lookup to a hard one.',
      '**Slide 28.** The `attention_layer` expects **2 to 3 inputs**. If the *values* input is not provided, it is treated as equal to the *keys* input. So the line `attention_outputs = attention_layer([decoder_outputs, encoder_outputs])` can be read as',
      { eq: { name: 'Slide 28', tex: '\\textit{attention\\_outputs} = \\textit{attention\\_layer([queries, keys])}', read: 'the decoder’s outputs are the queries; the encoder’s outputs are the keys (and the values)' } },
      'The output `attention_outputs` then goes through the `Dense` layer with the softmax activation into an array of probabilities (`Y_proba`, slide 26), as long as the target language’s (Spanish’s) vocabulary. These concepts are all vectors in the model, and they are used extensively in the **transformer**.',
      { slideNote: 'Keras’s own documentation orders the inputs differently: “Inputs are a list with 2 or 3 elements: 1. A `query` tensor … 2. A `value` tensor … 3. A optional `key` tensor … If none supplied, `value` will be used as a `key`.” (checked in the Keras 3.15.1 docstring). So Keras calls the second input the *value* and lets the *key* default to it, while slide 28 calls it the *keys* and lets the *values* default to them. With two inputs the effect is the same: the keys and the values are both the encoder’s outputs.' },
    ],
    play: ['softLookup'],
  },

  /* ── §9 ─────────────────────────────────────────────────────────────── */
  {
    id: 's09',
    no: '9',
    title: 'The transformer: overview',
    short: 'Transformer overview',
    slides: '29–31',
    read: [
      'In the groundbreaking 2017 paper “**Attention Is All You Need**”[^7] from Google, the authors proposed an architecture called the ***transformer***. It significantly improved the state of the art in NMT **without any recurrent or convolutional layers**: just attention mechanisms (plus embedding layers, dense layers, etc.) (slide 29).',
      'Because the model is **not recurrent**, it doesn’t suffer as much from the **vanishing or exploding gradients** problems as RNNs. It can be **trained in fewer steps**, it’s **easier to parallelize** across multiple GPUs, and it can **better capture long-range patterns** than RNNs.',
      '**Figure 16-8 (slide 30).** The left part is the ***encoder***, the right part the ***decoder***. Each embedding layer outputs a 3D tensor of shape **[batch size, sequence length, embedding size]**. The tensors are gradually transformed as they flow through the transformer, but **their shape remains the same**. In the 2017 paper the authors set **$N = 6$** (each stack repeats its layer $N$ times).',
      'There are **two embedding layers** (pink boxes). There are **skip connections followed by Addition and Normalisation layers** (“Add & Norm”). The **Feed Forward** modules (light blue boxes) are two `Dense` layers each: the first uses **ReLU**, the second has **no activation function**. All these layers treat **each word independently** of the others, so a layer is needed that captures the **context and relationships among words**: the ***multi-head attention*** layer (slide 30 writes “multi-header attention”).',
      { list: [
        'The **first two arrows** going into each multi-head attention layer represent the ***keys*** and ***values***, and the **third arrow** represents the ***queries*** (slide 31). In the decoder’s upper attention layer, the first two come from the **encoder’s output** and the third from the decoder itself.',
        'The encoder’s ***multi-head attention*** layer updates each word representation by **attending to all other words in the same sentence**.',
        'The decoder’s ***masked multi-head attention*** layer does the same, but when it processes a word, it **doesn’t attend to words located after it**: it is a **causal** layer. This is done by an additional ***masking*** operation.',
        'The ***positional encodings*** are dense vectors (much like word embeddings) that represent the **position of each word** in the sentence.',
      ] },
      'At the top, the decoder’s output goes through **Linear** and **Softmax** layers to the output probabilities. The decoder’s inputs at the bottom are the “Outputs (shifted right)”.',
      { slideNote: 'Footnote 7 cuts the paper’s title off as “Attention Is All You Nee”; the body text has it in full. Slide 31 doesn’t say which of the first two arrows is the keys and which the values, and in the encoder’s attention block and the decoder’s masked one all three arrows branch from the same line. Figure 16-10 (slides 37–39) lists its inputs as V, K, Q from left to right. This page labels the first two arrows together as “keys, values”.' },
    ],
    play: ['transformerMap'],
  },

  /* ── §10 ────────────────────────────────────────────────────────────── */
  {
    id: 's10',
    no: '10',
    title: 'Positional encodings',
    short: 'Positional encodings',
    slides: '32–36',
    read: [
      'The transformer has two key components: **(i)** ***the Positional Encoding layer*** and **(ii)** ***the Multi-Head Attention mechanism*** (slide 32). This section is the first.',
      'A ***positional encoding*** is a dense vector that **encodes the position of a word** within a sentence: the $i^{\\text{th}}$ positional encoding is **added to the word embedding** of the $i^{\\text{th}}$ word. The easiest way to implement this is an `Embedding` layer that encodes all positions from 0 to the maximum sequence length in the batch, added to the word embeddings.',
      'The authors of the transformer paper chose **fixed** positional encodings, based on the **sine and cosine functions at different frequencies**. Their positional encoding matrix $\\mathbf{P}$ is defined as (slide 32):',
      { eq: { name: 'Positional encodings (slide 32, as typeset)', tex: '\\mathbf{P}_{p,i} = \\begin{cases} \\sin\\left(p/1000^{i/d}\\right) & \\text{if } i \\text{ is even} \\\\ \\cos\\left(p/1000^{(i-1)/d}\\right) & \\text{if } i \\text{ is odd} \\end{cases}', read: 'component i of the encoding for the word at position p: sine for even i, cosine for odd i, slower waves for larger i' } },
      'where $\\mathbf{P}_{p,i}$ is the positional encoding for the $i^{\\text{th}}$ component of the embedding vector of the word at the $p^{\\text{th}}$ position, and $d$ is the dimension of the *keys*, *values* and *queries* vectors.',
      '**Figure 16-9 (slide 33)** plots the matrix (transposed: position $p$ across, component $i$ up) with two rows picked out, $i = 100$ (a sine) and $i = 101$ (a cosine) with the same period. Near $i = 0$ the values oscillate very fast along $p$; higher up the waves get slower and broader. After these encodings are added to the word embeddings, the rest of the model has access to the **absolute position** of each word, because **each position has a unique positional encoding**. The figure also marks $p = 22$ and $p = 60$ (dashed lines) and $p = 35$ (a ×) without explaining them, and doesn’t give its $d$; the lab opens on $p = 22$ and $i = 100, 101$ to echo it.',
      'TensorFlow provides a `tfm.vision.layers.PositionalEncoding` layer, but the `tfm` library needs an extra installation of `tensorflow_models`[^8]. It is not too hard to write one yourself (slide 34). For efficiency, the class **precomputes the positional encoding matrix in its constructor**; `call()` just **truncates** it to the maximum length of the input sequences and **adds** it to the inputs; `supports_masking=True` propagates the input’s automatic mask to the next layer.',
      { unfold: { label: 'Slide 35: the PositionalEncoding class, verbatim', blocks: [{ code: { src: 'POS_ENCODING', label: 'slide 35' } }] } },
      'Then adding the positional encoding is straightforward (slide 36); the code for the decoder’s embedding is similar:',
      { code: { src: 'POS_USE', label: 'slide 36' } },
      { slideNote: 'Slide 32’s formula uses the base **1000**: $\\sin(p/1000^{i/d})$ and $\\cos(p/1000^{(i-1)/d})$. Slide 35’s code uses **`10_000`**: `np.sin(p / 10_000 ** (i / embed_size))`, where `i` runs over the even components 0, 2, 4, …, so the cosine at component $i+1$ uses the same exponent as the sine at $i$, which matches the formula’s $(i-1)/d$. The two disagree only in the base. Both are kept here verbatim; the lab follows the code by default and can switch to slide 32’s 1000.' },
      { slideNote: 'Slide 36 says “adding the positional encoding to the encoder’s outputs”, but the code adds it to `encoder_embeddings`: the encoder’s *inputs*, as Figure 16-8 draws it. Slide 32 also uses the letter $i$ twice: first for a word’s position (“the $i^{\\text{th}}$ positional encoding”), then for the embedding component in the formula, where the position is $p$. And it defines $d$ as the dimension of the keys, values and queries vectors, while the code uses `embed_size` and slides 37–38 give keys and values separate sizes, $d_{\\text{keys}}$ and $d_{\\text{values}}$.' },
    ],
    play: ['waveOrgan'],
  },

  /* ── §11 ────────────────────────────────────────────────────────────── */
  {
    id: 's11',
    no: '11',
    title: 'Scaled dot-product attention',
    short: 'Scaled dot-product attention',
    slides: '37–38',
    read: [
      'Now look deeper into the ***multi-head attention*** layer, **the heart of the transformer model** (slide 37). To understand how it works, we must first understand the ***scaled dot-product attention*** layer, which outputs:',
      { eq: { name: 'Scaled dot-product attention (slides 37–38)', tex: '\\text{Attention}(\\mathbf{Q}, \\mathbf{K}, \\mathbf{V}) = \\text{softmax}\\left(\\frac{\\mathbf{Q}\\mathbf{K}^{\\top}}{\\sqrt{d_{\\text{keys}}}}\\right)\\mathbf{V}', read: 'score every query against every key, scale, softmax each row, then take the weighted sum of the values' } },
      {
        list: [
          '$\\mathbf{Q}$, the *query* matrix (shape $[n_{\\text{queries}}, d_{\\text{keys}}]$), contains **one row per query**;',
          '$\\mathbf{K}$, the *key* matrix (shape $[n_{\\text{keys}}, d_{\\text{keys}}]$), contains **one row per key**;',
          '$\\mathbf{V}$, the *value* matrix (shape $[n_{\\text{keys}}, d_{\\text{values}}]$), contains **one row per value**.',
        ],
      },
      'So (slide 38):',
      {
        list: [
          '$\\mathbf{Q}\\mathbf{K}^{\\top}$ (shape $[n_{\\text{queries}}, n_{\\text{keys}}]$) contains **one similarity score for each query/key pair**.',
          'The scaling factor scales down the similarity scores to **avoid saturating the softmax function**, which would lead to **tiny gradients**.',
          'The output from the softmax function has the **same shape**, $[n_{\\text{queries}}, n_{\\text{keys}}]$, but the numbers in **each row add up to 1**.',
          'The output shape of $\\text{Attention}(\\mathbf{Q}, \\mathbf{K}, \\mathbf{V})$ is therefore $[n_{\\text{queries}}, d_{\\text{values}}]$, where each row represents the query result: **a weighted sum of the values**.',
        ],
      },
      { slideNote: 'Slide 38’s bullet says “The factor $1/d_{\\text{keys}}$ scales down the similarity scores”, with no square root, while the equation on slides 37 and 38 divides by $\\sqrt{d_{\\text{keys}}}$. The equation is the definition, so the factor is $1/\\sqrt{d_{\\text{keys}}}$; this page writes it that way.' },
      'Two shape rules follow. $\\mathbf{Q}$ and $\\mathbf{K}$ need the **same number of columns**, $d_{\\text{keys}}$, so that a query and a key can be dotted. $\\mathbf{K}$ and $\\mathbf{V}$ need the **same number of rows**, $n_{\\text{keys}}$: each value belongs to one key. The first lab uses the running example, with the four Spanish words as the queries and the three English words as the keys and values; the second uses random vectors.',
    ],
    play: ['fourMoves', 'saturate'],
  },

  /* ── §12 ────────────────────────────────────────────────────────────── */
  {
    id: 's12',
    no: '12',
    title: 'Multi-head attention',
    short: 'Multi-head attention',
    slides: '39',
    read: [
      '**Figure 16-10** (slides 37–39) draws a multi-head attention layer bottom to top: $\\mathbf{V}$, $\\mathbf{K}$ and $\\mathbf{Q}$ each go through their own **Linear** layer, then their own **Split**; the parts go through a stack of $H$ **Scaled Dot-Product Attention** layers; the results are **Concat**enated and go through a final **Linear** layer.',
      { list: [
        'In the training stage, the data going into the network and into the multi-head attention layer are **3D tensors** (axis 0 is the minibatch), so all the matrix multiplications can be done efficiently in one go (slide 39).',
        'After $\\mathbf{V}$, $\\mathbf{K}$ and $\\mathbf{Q}$ are individually transformed by the ***Linear*** layers, they are **split** (the yellow Split boxes) and later **concatenated back** (the top yellow Concat box).',
        'The separate parts going through the ***Scaled Dot-Product Attention*** layer allow **different characters of the words** to be captured: e.g., not only is the word “like” a verb, it is also in the present tense.',
        'The number of parts that $\\mathbf{V}$, $\\mathbf{K}$ and $\\mathbf{Q}$ are split into is the value of $H$, the **number of heads**.',
      ] },
      'Each head runs exactly the scaled dot-product attention of [§11](#s11) on its own part, so each head produces its own attention map. When V, K and Q are split as Figure 16-10 draws it, concatenating the $H$ results gives back the original width before the final Linear layer (this page’s working).',
      { slideNote: 'Slide 39 says the matrix multiplications “can be done efficiently in Python”; the work is done by TensorFlow’s tensor operations on whole batches. Slide 39 also describes $\\mathbf{V}$, $\\mathbf{K}$, $\\mathbf{Q}$ being *split* into $H$ parts, while slide 43’s code creates `MultiHeadAttention(num_heads=8, key_dim=embed_size, …)`. In Keras, `key_dim` is the size of *each* head, so there each of the 8 heads gets its own `embed_size`-wide projection rather than an eighth of the embedding. The lab follows Figure 16-10’s Linear → Split → Concat picture.' },
    ],
    play: ['multiHead'],
  },

  /* ── §13 ────────────────────────────────────────────────────────────── */
  {
    id: 's13',
    no: '13',
    title: 'Self- vs cross-attention; training and inference',
    short: 'Self/cross · masking · SOS → EOS',
    slides: '40–42',
    read: [
      'The multi-head attention layer in the **encoder** is a ***self-attention*** layer: it updates each word representation by attending to all other words **in the same sentence** (slide 40). The queries, keys and values all come from that sentence.',
      'The decoder’s **upper** multi-head attention layer is where the decoder pays attention to the words in the **English** sentence. This is called **cross-attention**: the queries come from the decoder, the keys and values from the encoder. For example, the decoder will probably pay close attention to the word “soccer” when it processes the word “el” and transforms its representation into a representation of the word “fútbol” (slide 40).',
      'The decoder’s **lower**, **masked** attention layer is self-attention over the Spanish words so far, with a **causal mask**: a word doesn’t attend to the words after it (slide 31). Figure 16-8 labels the decoder’s inputs “Outputs (shifted right)”: the target sentence moved one step right behind a start token, as in Figure 16-3’s “<sos> Me gusta el fútbol”. With the mask, each position can’t see the words it has to predict (this page’s reading of Figure 16-8 and slide 31).',
      '**Generating a sentence (slides 41–42).** The decoder starts from a token such as $\\langle\\text{SOS}\\rangle$ as the prompt. After the first word is predicted, **the entire network is run again to predict the second word using the first word**. At the inference stage nothing goes into the decoder except the $\\langle\\text{SOS}\\rangle$ prompt; after the first word is predicted, it is used as the decoder’s input; after the second word is predicted, it is appended to the first, so the decoder’s input has two words. This repeats until the network outputs $\\langle\\text{EOS}\\rangle$.',
      'The green **softmax** layer has many neurons, one per word of the target language’s vocabulary (slide 41 writes “The green softmax layer have many neurons”). ***Beam search*** (not covered in the unit) is often used to help the network focus on the words with high probabilities.',
      'Slide 42 redraws Figure 16-8 with **$N = 2$**: a second encoder layer and a second decoder layer drawn by hand on top of the printed first ones.',
      { slideNote: 'Slide 41’s first bullet says that “the masking on the first target word is removed and the entire network is run again” word by word: that describes generating at inference, which slide 42 then describes in full. The mask itself (slide 31) is what stops a word attending to the words after it. On slide 42’s hand-drawn $N = 2$ figure, the second decoder layer has no masked attention sub-layer, and encoder layer 1 feeds decoder layer 1 while encoder layer 2 feeds decoder layer 2. Figure 16-8 (slides 30, 31, 41) is the full architecture: its masked attention sub-layer sits inside the N× box, so every decoder layer has one, and it draws one line from the top of the encoder stack into the decoder’s attention layer. Slide 42’s hand-drawn layer is a sketch on top of it; the slides don’t explain the difference.' },
    ],
    play: ['selfCross', 'mask'],
  },

  /* ── §14 ────────────────────────────────────────────────────────────── */
  {
    id: 's14',
    no: '14',
    title: 'Implementing the transformer in Keras',
    short: 'Transformer in Keras',
    slides: '43',
    read: [
      'Keras includes a `tf.keras.layers.MultiHeadAttention` layer, so we now have everything we need to build the rest of the transformer (slide 43). The slide sketches the encoder:',
      { code: { src: 'KERAS_TRANSFORMER', label: 'slide 43' } },
      { list: [
        '`N = 2` layers in each stack, instead of the paper’s 6; `num_heads = 8`; `dropout_rate = 0.1`; `n_units = 128` for the first Dense layer in each Feed Forward block.',
        '`encoder_pad_mask` is `True` wherever a token ID is not 0, so the padding tokens (ID 0) are masked out of the attention; `[:, tf.newaxis]` adds an axis so the mask lines up with the attention scores (this page’s note).',
        'Each layer keeps `skip = Z` for the skip connection, builds a `MultiHeadAttention(num_heads=num_heads, key_dim=embed_size, dropout=dropout_rate)`, and calls it as `attn_layer(Z, value=Z, attention_mask=encoder_pad_mask)`: the queries and the values are both `Z` (and the keys default to the values), so this is the encoder’s **self-attention**.',
        'The last comment, “# ... add in other layers as shown in Figure 16-8”, stands for the Add & Norm, Feed Forward and second Add & Norm of [§9](#s09).',
      ] },
      { slideNote: 'Slide 43 is a partial sketch: it stops after the first attention sub-layer, `skip` and `n_units` are set but not used in the code shown, and `encoder_input_ids` and `embed_size` are not defined on the slides. `key_dim=embed_size` makes each of the 8 heads `embed_size` wide, rather than splitting the embedding as slide 39 describes ([§12](#s12)).' },
      { note: 'The second lab runs a tiny transformer that this page trained itself: $N = 1$, 2 heads, $d = 32$, post-norm like Figure 16-8, Géron’s positional encoding, trained on 182 sentences of a toy English → Spanish grammar that includes “I like soccer” → “me gusta el fútbol”. It gets all 182, and 26 sentences it never saw, right. Everything it shows is that toy’s own attention, not the slides’ model.', label: 'This page’s own toy transformer' },
    ],
    play: ['codeMap', 'toyTransformer'],
  },

  /* ── §15 ────────────────────────────────────────────────────────────── */
  {
    id: 's15',
    no: '15',
    title: 'Visual attention and the vision transformer',
    short: 'Visual attention · ViT',
    slides: '44–46',
    read: [
      '**Image captioning using visual attention (slide 44).** One of the first applications of attention beyond NMT was generating ***image captions*** using ***visual attention***[^9]: a **convolutional neural network** first processes the image and outputs some **feature maps**, then a **decoder RNN equipped with an attention mechanism** generates the caption, **one word at a time**. At each decoder time step (each word), the decoder uses the attention model to **focus on just the right part of the image**.',
      'In Figure 16-12 (slide 45) the model generated the caption “**A woman is throwing a frisbee in a park**”, and you can see which part of the input image the decoder focused on when it was about to output the word “frisbee”: clearly, most of its attention was on the frisbee.',
      '**The original vision transformer (slide 46).** In October 2020 a team of Google researchers released a paper[^10] introducing a fully transformer-based vision model, the ***vision transformer*** (**ViT**). The idea is surprisingly simple:',
      { list: [
        'Chop the image into little **16 × 16 squares**, and treat the **sequence of squares** as if it were a **sequence of word representations**.',
        'Flatten each square into a **16 × 16 × 3 = 768**-dimensional vector (3 for the RGB colour channels).',
        'Send the vectors through a **linear layer** that transforms them but **retains their dimensionality**. The resulting sequence can be treated like a sequence of word embeddings: **add positional embeddings**, and pass the result to the **transformer**.',
      ] },
      'This model beat the state of the art on **ImageNet** image classification, but it **required over 300 million additional images** for training. That makes sense: transformers don’t have as many ***inductive biases*** as CNNs, so they need extra data just to learn things that CNNs implicitly assume.',
      { note: 'An inductive bias is an assumption built into a model. A CNN’s convolutions assume that nearby pixels belong together and that a pattern means the same thing wherever it appears (Lecture 3’s local receptive fields and shared weights). A ViT starts with no such assumption between its patches, so it has to learn it from data.', label: 'This page’s gloss' },
      { slideNote: 'Slide 44 sits under the heading “Vision Transformers”, but the captioning model it describes is a CNN followed by an RNN decoder with attention, not a transformer. Slide 46 gives the patch size and the 768 but no input image size, so the number of patches can’t be worked out from the slides; the lab assumes its own.' },
    ],
    play: ['patchChopper', 'visualAttention'],
  },

  /* ── §16 ────────────────────────────────────────────────────────────── */
  {
    id: 's16',
    no: '16',
    title: 'Beyond the exam: later papers and Hugging Face',
    short: 'Beyond the exam',
    slides: '47–49',
    notExamined: true,
    read: [
      '**Not examined.** Slide 47 opens with “(Materials from this slide onward are not covered in the exam)”. This section is here for completeness, briefly, and has no notebook page.',
      { list: [
        'Just two months after ViT, a paper[^11] from a team at Facebook introduced ***data-efficient image transformers*** (**DeiTs**), using a ***distillation*** technique to reduce the number of training images required (slide 47).',
        'In March 2021, DeepMind introduced the ***Perceiver*** architecture[^12]: a multimodal transformer that can handle text, images, audio, etc.',
        'A month later, Caron et al. introduced ***DINO***[^13], a vision transformer trained entirely without labels and capable of high-accuracy semantic segmentation.',
        'A 2021 paper[^14] from Google showed how to scale ViTs up or down depending on the amount of data: a huge 2 billion parameter model reached over 90.4% top-1 accuracy on ImageNet, and a scaled-down model reached over 84.8% top-1 accuracy using only 10,000 images, just 10 images per class (slide 48).',
        'In April 2022, DeepMind released the ***Flamingo paper***[^15]: a family of models pretrained across modalities including text, images and videos. In May 2022 came ***GATO***[^16], a multimodal model that can be used as a policy for a **reinforcement learning** agent.',
        '**Hugging Face** (slide 49) has built an ecosystem of open-source tools for NLP, vision and beyond. Its **Transformers** library downloads a pretrained model with its tokenizer for fine-tuning, and supports TensorFlow, PyTorch and JAX; its **Datasets** library downloads standard or custom datasets. The unit has no room to cover it.',
      ] },
      { slideNote: 'Read literally, “from this slide onward” would also cover the summary on slide 50. The flag here covers slides 47–49, the “Other related papers” and Hugging Face material. Slide 48 typesets ten thousand as “10, 000”.' },
    ],
    play: ['timeline'],
  },

  /* ── §17 ────────────────────────────────────────────────────────────── */
  {
    id: 's17',
    no: '17',
    title: 'Summary',
    short: 'Summary',
    slides: '50–51',
    read: [
      'Slide 50’s outcomes: understand the **encoder-decoder networks** for neural machine translation; understand **bidirectional RNNs and LSTMs**; understand **attention mechanisms** and the differences between **additive** attention and **multiplicative** attention; know how to **implement attention mechanisms using Keras**; understand **visual attention**; understand **transformers** and **vision transformers**.',
      'Additive attention is Bahdanau’s ([§6](#s06)) and multiplicative attention is Luong’s ([§7](#s07)). Tick each outcome below when you can explain it without the page.',
      'Next (slide 51): read up to **Chapter 18** on **Reinforcement Learning**. And that’s all for this lecture.',
    ],
    play: ['outcomes'],
  },
];
