/* ============================================================================
   THE LONG SHORT-TERM LINE — CONTENT (pure data, slide-cited; Lecture 4)
   ----------------------------------------------------------------------------
   You are a memory cell running a train along the line: each station is a
   time step t, the cargo car is the cell's state, the platform crate is the
   input x(t), and the levers are the gates. Everything the game says lives
   here; the arithmetic (the slides' equations through lecture4-study/rnn.js)
   lives in maths/longLine.js.

     TOY        this game's toy cell (one unit, one input): how a lever drives
                a gate, the weights, the crates. A game device, marked beyond.
     GATES      the levers per model (LSTM f, i, o; GRU z, r), with the words
                the slides use for what each gate does
     CARDS      the station cards per model: what must happen, the gate
                setting that does it (the answer) and the why
     QUESTIONS  the choice items per level, in the slides' words
     STEP       level 1's "one step of slide 9" item; FADE the fade run
     COPY       intro lines, level names, drawer labels

   Notation: the slides' row vectors (Lecture 4 slides 9, 47, 49), σ for the
   logistic function, ⊗ for element-wise multiplication. Where a choice label
   holds maths it is $…$ KaTeX, and `aria` carries the same in plain words.
   ========================================================================== */

/* ── the toy cell ─────────────────────────────────────────────────────── */
export const TOY = {
  // A lever drives its gate controller through the bias: open = +lever,
  // closed = −lever, with that controller's W_x· and W_h· set to 0, so the
  // gate is σ(±6) = 0.998 or 0.002 (σ outputs range from 0 to 1, slide 46).
  lever: 6,
  units: 1,
  // SimpleRNN (slide 9): h(t) = tanh(h(t−1) W_h + x(t) W_x + b_h)
  rnn: { Wh: 0.5, Wx: 1, bh: 0, phi: 'tanh' },
  // LSTM main layer (slide 47): g(t) = tanh(x(t) W_xg + h(t−1) W_hg + b_g)
  lstm: { Wxg: 1, Whg: 0, bg: 0 },
  // GRU main layer (slide 49): g(t) = tanh(x(t) W_xg + (r(t) W_hg ⊗ h(t−1)) + b_g)
  gru: { Wxg: 1, Whg: 1.5, bg: 0 },
  // the platform crates x(t) a station can hold
  crates: [0.3, 0.4, 0.6, 0.8, 1, 1.2],
  // the fade run on level 1: the first crate, then smaller ones
  fadeFirst: 1.2,
  fadeLater: [0.2, 0.3, 0.4],
  fadeSteps: 6,
  beyond: true,
  note: 'A game device, not a slide claim: a trained cell computes each gate from x(t) and h(t−1); here the player is the gate controller, so the lever pins the controller’s bias to ±6 with its weights at 0. The weights and crates are this game’s own toy numbers. Every value is then computed with the slides’ equations (slides 9, 47, 49).',
  src: { lecture: 4, slides: [9, 46, 47, 49] },
};

/* ── the levers ───────────────────────────────────────────────────────── */
export const GATES = {
  lstm: [
    { key: 'f', kbd: 'F', sym: 'f(t)', tex: '\\mathbf{f}_{(t)}', name: 'forget gate', off: 'erase', on: 'keep',
      role: 'controls which parts of the long-term state should be erased', src: { lecture: 4, slides: [46] } },
    { key: 'i', kbd: 'I', sym: 'i(t)', tex: '\\mathbf{i}_{(t)}', name: 'input gate', off: 'skip g', on: 'add g',
      role: 'controls which parts of g(t) should be added to the long-term state', src: { lecture: 4, slides: [46] } },
    { key: 'o', kbd: 'O', sym: 'o(t)', tex: '\\mathbf{o}_{(t)}', name: 'output gate', off: 'hold', on: 'read out',
      role: 'controls which parts of the long-term state should be read and output at this time step (to both h(t) and y(t))', src: { lecture: 4, slides: [46] } },
  ],
  gru: [
    { key: 'z', kbd: 'Z', sym: 'z(t)', tex: '\\mathbf{z}_{(t)}', name: 'gate controller z', off: 'take g', on: 'keep h(t−1)',
      role: 'a single gate controller that controls both the forget gate and the input gate', src: { lecture: 4, slides: [48, 49] } },
    { key: 'r', kbd: 'R', sym: 'r(t)', tex: '\\mathbf{r}_{(t)}', name: 'gate r', off: 'g ignores h(t−1)', on: 'g reads h(t−1)',
      role: 'gates only the previous-state term inside g(t)', src: { lecture: 4, slides: [48, 49] } },
  ],
};

/* ── the station cards ────────────────────────────────────────────────────
   {due} is replaced with the station the cargo is due at. `answer` is the
   gate setting (1 = open, 0 = closed) that does what the card says; the
   maths works out which gates actually matter at that station.          */
const L47 = { lecture: 4, slides: [44, 45, 46, 47] };
const G49 = { lecture: 4, slides: [48, 49] };

export const CARDS = {
  lstm: {
    load: {
      concept: 'lstm.gates', src: L47, answer: { f: 1, i: 1, o: 0 },
      line: 'Load the crate on the platform. It is due at t = {due}.',
      sub: 'Add g(t) to the long-term state; read nothing out yet.',
      why: 'Loading is the input gate: $\\mathbf{i}_{(t)} \\approx 1$ adds $\\mathbf{g}_{(t)}$ in $\\mathbf{c}_{(t)} = \\mathbf{f}_{(t)} \\otimes \\mathbf{c}_{(t-1)} + \\mathbf{i}_{(t)} \\otimes \\mathbf{g}_{(t)}$. The car was empty, so $\\mathbf{f}$ had nothing to keep; $\\mathbf{o}_{(t)} \\approx 0$ reads nothing out yet.',
    },
    keep: {
      concept: 'lstm.gates', src: L47, answer: { f: 1, i: 0, o: 0 },
      line: 'Carry the cargo on (due at t = {due}). Leave the crate.',
      sub: 'Keep c(t−1); add nothing; read nothing out.',
      why: 'Keeping means the forget gate is OPEN: $\\mathbf{f}_{(t)} \\approx 1$ keeps $\\mathbf{c}_{(t-1)}$ ($\\mathbf{f} \\approx 0$ erases it). $\\mathbf{i}_{(t)} \\approx 0$ leaves $\\mathbf{g}_{(t)}$ out and $\\mathbf{o}_{(t)} \\approx 0$ reads nothing out.',
    },
    topup: {
      concept: 'lstm.gates', src: L47, answer: { f: 1, i: 1, o: 0 },
      line: 'Load this crate too, and keep the cargo aboard (all due at t = {due}).',
      sub: 'Keep c(t−1) and add g(t); read nothing out.',
      why: '$\\mathbf{f}_{(t)} \\approx 1$ keeps the old cargo and $\\mathbf{i}_{(t)} \\approx 1$ adds $\\mathbf{g}_{(t)}$ on top: $\\mathbf{c}_{(t)} = \\mathbf{f}_{(t)} \\otimes \\mathbf{c}_{(t-1)} + \\mathbf{i}_{(t)} \\otimes \\mathbf{g}_{(t)}$. $\\mathbf{o}_{(t)} \\approx 0$ holds it.',
    },
    deliver: {
      concept: 'lstm.equations', src: L47, answer: { f: 1, i: 0, o: 1 },
      line: 'The cargo is due here: deliver it, and keep it aboard.',
      sub: 'Read c(t) out to h(t) and y(t); keep c(t−1); add nothing.',
      why: 'Delivering is the output gate: $\\mathbf{y}_{(t)} = \\mathbf{h}_{(t)} = \\mathbf{o}_{(t)} \\otimes \\tanh(\\mathbf{c}_{(t)})$ with $\\mathbf{o} \\approx 1$. Keep $\\mathbf{f} \\approx 1$: $\\mathbf{h}_{(t)}$ reads the NEW $\\mathbf{c}_{(t)}$, so erasing at this station would deliver nothing.',
    },
    loadDeliver: {
      concept: 'lstm.equations', src: L47, answer: { f: 1, i: 1, o: 1 },
      line: 'Load this crate, and deliver everything aboard right now.',
      sub: 'Keep c(t−1), add g(t), and read the new c(t) out.',
      why: '$\\mathbf{f} \\approx 1$ and $\\mathbf{i} \\approx 1$ build $\\mathbf{c}_{(t)} = \\mathbf{f} \\otimes \\mathbf{c}_{(t-1)} + \\mathbf{i} \\otimes \\mathbf{g}_{(t)}$, and $\\mathbf{o} \\approx 1$ reads that new $\\mathbf{c}_{(t)}$ out: $\\mathbf{h}_{(t)} = \\mathbf{o}_{(t)} \\otimes \\tanh(\\mathbf{c}_{(t)})$.',
    },
    swap: {
      concept: 'lstm.gates', src: L47, answer: { f: 0, i: 1, o: 0 },
      line: 'Drop the old cargo and load this crate instead (due at t = {due}).',
      sub: 'Erase c(t−1); add g(t); read nothing out.',
      why: '$\\mathbf{f}_{(t)} \\approx 0$ erases $\\mathbf{c}_{(t-1)}$ and $\\mathbf{i}_{(t)} \\approx 1$ adds the new $\\mathbf{g}_{(t)}$, so $\\mathbf{c}_{(t)} \\approx \\mathbf{g}_{(t)}$; $\\mathbf{o}_{(t)} \\approx 0$ reads nothing out.',
    },
    dump: {
      concept: 'lstm.gates', src: L47, answer: { f: 0, i: 0, o: 0 },
      line: 'End of the run: drop everything, and leave the crate.',
      sub: 'Erase c(t−1); add nothing.',
      why: '$\\mathbf{f}_{(t)} \\approx 0$ erases $\\mathbf{c}_{(t-1)}$ and $\\mathbf{i}_{(t)} \\approx 0$ adds nothing, so $\\mathbf{c}_{(t)} \\approx 0$; with nothing left in $\\mathbf{c}_{(t)}$, $\\mathbf{o}$ has nothing to read.',
    },
  },
  gru: {
    load: {
      concept: 'gru.update', src: G49, answer: { z: 0, r: 0 },
      line: 'Load the crate into the empty car. It is due at t = {due}.',
      sub: 'Replace h(t−1) with g(t).',
      why: 'Slide 49: $\\mathbf{h}_{(t)} = \\mathbf{z}_{(t)} \\otimes \\mathbf{h}_{(t-1)} + (1 - \\mathbf{z}_{(t)}) \\otimes \\mathbf{g}_{(t)}$. To take the crate, $\\mathbf{z} \\approx 0$ so $1 - \\mathbf{z} \\approx 1$ lets $\\mathbf{g}$ in. The car was empty, so $\\mathbf{r}$, which gates only $\\mathbf{h}_{(t-1)}$ inside $\\mathbf{g}$, had nothing to gate.',
    },
    keep: {
      concept: 'gru.update', src: G49, answer: { z: 1, r: 0 },
      line: 'Carry the cargo on (due at t = {due}). Leave the crate.',
      sub: 'Keep h(t−1); shut g(t) out.',
      why: 'In the slides’ convention $\\mathbf{z}$ multiplies the PREVIOUS state: $\\mathbf{z} \\approx 1$ keeps $\\mathbf{h}_{(t-1)}$ and $1 - \\mathbf{z} \\approx 0$ shuts $\\mathbf{g}_{(t)}$ out. With $\\mathbf{g}$ shut out, $\\mathbf{r}$ changes nothing.',
    },
    deliver: {
      concept: 'gru.cell', src: G49, answer: { z: 1, r: 0 },
      line: 'The cargo is due here: deliver it, and keep it aboard.',
      sub: 'A GRU has no output gate: h(t) is output at every step.',
      why: 'There is no output gate: the full state vector is output at every time step (slide 48). To deliver the cargo here it only has to still be in $\\mathbf{h}_{(t)}$, so $\\mathbf{z} \\approx 1$ keeps $\\mathbf{h}_{(t-1)}$; $\\mathbf{r}$ then changes nothing.',
    },
    replace: {
      concept: 'gru.update', src: G49, answer: { z: 0, r: 0 },
      line: 'Drop the old cargo and load this crate on its own (due at t = {due}).',
      sub: 'Replace h(t−1) with g(t), and g must not read h(t−1).',
      why: '$\\mathbf{z} \\approx 0$ replaces $\\mathbf{h}_{(t-1)}$ with $\\mathbf{g}_{(t)}$, and $\\mathbf{r} \\approx 0$ shuts $\\mathbf{h}_{(t-1)}$ out of the previous-state term inside $\\mathbf{g}$, so $\\mathbf{g}_{(t)}^{\\top} \\approx \\tanh(\\mathbf{x}_{(t)}^{\\top}\\mathbf{W}_{xg} + \\mathbf{b}_g^{\\top})$: the crate alone.',
    },
    blend: {
      concept: 'gru.update', src: G49, answer: { z: 0, r: 1 },
      line: 'Load this crate on top of the old cargo (all due at t = {due}).',
      sub: 'Replace h(t−1) with g(t), and g reads h(t−1).',
      why: '$\\mathbf{z} \\approx 0$ lets $\\mathbf{g}_{(t)}$ become the state, and $\\mathbf{r} \\approx 1$ keeps the previous-state term inside $\\mathbf{g}$: $\\mathbf{g}_{(t)}^{\\top} = \\tanh(\\mathbf{x}_{(t)}^{\\top}\\mathbf{W}_{xg} + (\\mathbf{r}_{(t)}^{\\top}\\mathbf{W}_{hg} \\otimes \\mathbf{h}_{(t-1)}^{\\top}) + \\mathbf{b}_g^{\\top})$, so the old cargo is folded into the new.',
    },
  },
};

/* ── choice questions ─────────────────────────────────────────────────────
   { id, concept, src, prompt, choices: [{ value, label, aria }], answer, why,
     picture?, drawer? } — `picture` tells the stage what to draw beside it;
   `drawer` shows level 1's maths drawer (only where it gives nothing away). */
export const QUESTIONS = {
  rnn: [
    { id: 'unrolled', concept: 'rnn.neuron', src: { lecture: 4, slides: [5] }, picture: 'pair', hard: 1,
      prompt: 'Which picture is the recurrent neuron unrolled through time?',
      choices: [
        { value: 'left', label: 'Left', aria: 'the left picture' },
        { value: 'right', label: 'Right', aria: 'the right picture' },
      ],
      answer: null, // set per round: the side the unrolled picture is drawn on
      why: 'Slide 5: the neuron drawn once per time step along a time axis, each copy receiving $\\mathbf{x}_{(t)}$ and the previous output, is the network unrolled through time; one neuron whose output loops back to itself is the rolled-up picture.' },
    { id: 'frame', drawer: true, concept: 'rnn.neuron', src: { lecture: 4, slides: [5] }, picture: 'fade', hard: 1,
      prompt: 'Each time step t (each station on this line) is also called a …',
      choices: [
        { value: 'frame', label: 'frame', aria: 'frame' },
        { value: 'epoch', label: 'epoch', aria: 'epoch' },
        { value: 'batch', label: 'batch', aria: 'batch' },
        { value: 'layer', label: 'layer', aria: 'layer' },
      ],
      answer: 'frame',
      why: 'Slide 5: “At each time step $t$ (also called a frame), this recurrent neuron may receive the inputs $\\mathbf{x}_{(t)}$ and its own output from the previous time step.”' },
    { id: 'depends', concept: 'rnn.memoryCell', src: { lecture: 4, slides: [8] }, picture: 'fade', hard: 1,
      prompt: 'A cell’s state h(t) is a function of …',
      choices: [
        { value: 'xh', label: '$\\mathbf{x}_{(t)}$ and $\\mathbf{h}_{(t-1)}$', aria: 'x(t) and h(t−1)' },
        { value: 'x', label: '$\\mathbf{x}_{(t)}$ only', aria: 'x(t) only' },
        { value: 'h', label: '$\\mathbf{h}_{(t-1)}$ only', aria: 'h(t−1) only' },
        { value: 'xnext', label: '$\\mathbf{x}_{(t)}$ and $\\mathbf{h}_{(t+1)}$', aria: 'x(t) and h(t+1)' },
      ],
      answer: 'xh',
      why: 'Slide 8: a cell’s state at time step $t$ is a function of some inputs at $t$ and its state at $t-1$: $\\mathbf{h}_{(t)} = f(\\mathbf{x}_{(t)}, \\mathbf{h}_{(t-1)})$.' },
    { id: 'allInputs', concept: 'rnn.memoryCell', src: { lecture: 4, slides: [7] }, picture: 'fade', hard: 2,
      prompt: 'The output y(t) of a recurrent neuron depends on …',
      choices: [
        { value: 'all', label: 'all the inputs since $t = 0$', aria: 'all the inputs since t = 0' },
        { value: 'now', label: 'only $\\mathbf{x}_{(t)}$', aria: 'only x(t)' },
        { value: 'two', label: 'only $\\mathbf{x}_{(t)}$ and $\\mathbf{x}_{(t-1)}$', aria: 'only x(t) and x(t−1)' },
        { value: 'first', label: 'only $\\mathbf{x}_{(0)}$', aria: 'only x(0)' },
      ],
      answer: 'all',
      why: 'Slide 7: $\\mathbf{y}_{(2)}$ depends on $\\mathbf{x}_{(2)}$ and $\\mathbf{y}_{(1)}$, which depends on $\\mathbf{x}_{(1)}$ and $\\mathbf{y}_{(0)}$, and so on, so $\\mathbf{y}_{(t)}$ is a function of all the inputs since $t = 0$: a form of memory.' },
    { id: 'h0', concept: 'rnn.discardedOutputs', src: { lecture: 4, slides: [10] }, picture: 'fade', hard: 2,
      prompt: 'The initial hidden state h(0) of each training instance is usually set to …',
      choices: [
        { value: 'zero', label: 'a zero vector', aria: 'a zero vector' },
        { value: 'random', label: 'a random vector', aria: 'a random vector' },
        { value: 'x0', label: 'the first input $\\mathbf{x}_{(0)}$', aria: 'the first input x(0)' },
        { value: 'ones', label: 'a vector of ones', aria: 'a vector of ones' },
      ],
      answer: 'zero',
      why: 'Slide 10: “The initial hidden state vector $\\mathbf{h}_{(0)}$ for each training instance is usually set to a zero vector.” The train leaves the depot empty.' },
    { id: 'carry', concept: 'rnn.equations', src: { lecture: 4, slides: [9] }, picture: 'fade', hard: 2,
      prompt: 'In slide 9’s h(t) line, which term carries the previous station’s cargo?',
      choices: [
        { value: 'hWh', label: '$\\mathbf{h}_{(t-1)}^{\\top}\\mathbf{W}_h$', aria: 'h transpose of t−1 times W_h' },
        { value: 'xWx', label: '$\\mathbf{x}_{(t)}^{\\top}\\mathbf{W}_x$', aria: 'x transpose of t times W_x' },
        { value: 'bh', label: '$\\mathbf{b}_h^{\\top}$', aria: 'the bias b_h transpose' },
        { value: 'hWy', label: '$\\mathbf{h}_{(t)}^{\\top}\\mathbf{W}_y$', aria: 'h transpose of t times W_y' },
      ],
      answer: 'hWh',
      why: 'Slide 9: $\\mathbf{h}_{(t)}^{\\top} = \\varphi_h(\\mathbf{h}_{(t-1)}^{\\top}\\mathbf{W}_h + \\mathbf{x}_{(t)}^{\\top}\\mathbf{W}_x + \\mathbf{b}_h^{\\top})$: the previous state enters through $\\mathbf{h}_{(t-1)}^{\\top}\\mathbf{W}_h$ ($\\mathbf{W}_h$ is $n_{\\text{neurons}} \\times n_{\\text{neurons}}$); $\\mathbf{h}_{(t)}^{\\top}\\mathbf{W}_y$ belongs to the output line.' },
    { id: 'fade', drawer: true, concept: 'rnn.longSeq', src: { lecture: 4, slides: [40, 42] }, picture: 'fade', hard: 2,
      prompt: 'At the end of this run, which crate leaves the weakest trace in h(t)?',
      choices: [
        { value: 'first', label: 'the first crate, loaded at t = 1', aria: 'the first crate, loaded at t = 1' },
        { value: 'last', label: 'the last crate', aria: 'the last crate' },
        { value: 'same', label: 'every crate leaves the same trace', aria: 'every crate leaves the same trace' },
        { value: 'none', label: 'none: h(t) keeps every input exactly', aria: 'none: h(t) keeps every input exactly' },
      ],
      answer: 'first',
      why: 'Slide 42: some information is lost at each time step, so after a while the RNN’s state contains virtually no trace of the first inputs; slide 40: an RNN processing a long sequence gradually forgets the first inputs.' },
    { id: 'lost', drawer: true, concept: 'rnn.longSeq', src: { lecture: 4, slides: [42, 10, 14] }, picture: 'fade', hard: 3,
      prompt: 'Why does a SimpleRNN’s state hold virtually no trace of the first inputs after a while?',
      choices: [
        { value: 'transform', label: 'some information is lost at each time step, through the transformations', aria: 'some information is lost at each time step, through the transformations the data goes through' },
        { value: 'reset', label: 'h(t) is reset to zero at every time step', aria: 'h(t) is reset to zero at every time step' },
        { value: 'weights', label: 'each time step uses different weights', aria: 'each time step uses different weights' },
        { value: 'lastOnly', label: 'only the last input is fed to the cell', aria: 'only the last input is fed to the cell' },
      ],
      answer: 'transform',
      why: 'Slide 42: “Due to the transformations that the data goes through when traversing an RNN, some information is lost at each time step.” The same $\\mathbf{W}, \\mathbf{b}$ are used at every step (slide 14), and $\\mathbf{h}_{(0)}$ is zero only at the start (slide 10).' },
    { id: 'tanh', drawer: true, concept: 'rnn.longSeq', src: { lecture: 4, slides: [40] }, picture: 'fade', hard: 3,
      prompt: 'Why is tanh the default activation of a recurrent layer?',
      choices: [
        { value: 'saturating', label: 'it saturates, which reduces the risk of exploding outputs', aria: 'it is saturating, which reduces the risk of exploding outputs' },
        { value: 'nonsat', label: 'it never saturates, so gradients cannot vanish', aria: 'it never saturates, so gradients cannot vanish' },
        { value: 'gate', label: 'its outputs range from 0 to 1, like a gate', aria: 'its outputs range from 0 to 1, like a gate' },
        { value: 'fast', label: 'it is the fastest activation to compute', aria: 'it is the fastest activation to compute' },
      ],
      answer: 'saturating',
      why: 'Slide 40: nonsaturating activations (e.g., ReLU) may not help as much, because the same weights are used in every time step and may lead to exploding outputs; you can reduce that risk with a smaller learning rate or a saturating activation like the hyperbolic tangent (“that’s why it’s the default”).' },
    { id: 'relu', drawer: true, concept: 'rnn.longSeq', src: { lecture: 4, slides: [40] }, picture: 'fade', hard: 3,
      prompt: 'Why may a nonsaturating activation such as ReLU not help as much in an RNN?',
      choices: [
        { value: 'same', label: 'the same weights are used at every time step, which may lead to exploding outputs', aria: 'the same weights are used in every time step and may lead to exploding outputs' },
        { value: 'keras', label: 'Keras recurrent layers cannot use ReLU', aria: 'Keras recurrent layers cannot use ReLU' },
        { value: 'range', label: 'ReLU outputs only range from 0 to 1', aria: 'ReLU outputs only range from 0 to 1' },
        { value: 'h0', label: 'ReLU sets h(0) to a nonzero vector', aria: 'ReLU sets h(0) to a nonzero vector' },
      ],
      answer: 'same',
      why: 'Slide 40: “nonsaturating activation functions (e.g., ReLU) may not help as much here, because the same weights are used in every time step and may lead to exploding outputs.”' },
    { id: 'bptt', drawer: true, concept: 'rnn.bptt', src: { lecture: 4, slides: [14] }, picture: 'fade', hard: 2,
      prompt: 'How is an RNN trained (BPTT)?',
      choices: [
        { value: 'unroll', label: 'unroll it through time, then use regular backpropagation', aria: 'unroll it through time, then use regular backpropagation' },
        { value: 'perStep', label: 'train a separate network for each time step', aria: 'train a separate network for each time step' },
        { value: 'lastOnly', label: 'backpropagate through the last time step only', aria: 'backpropagate through the last time step only' },
        { value: 'forward', label: 'propagate the gradients forward through time', aria: 'propagate the gradients forward through time' },
      ],
      answer: 'unroll',
      why: 'Slide 14: to train an RNN, unroll it through time and then use regular backpropagation: backpropagation through time (BPTT). The gradients flow backward through the unrolled network.' },
    { id: 'shared', concept: 'rnn.bptt', src: { lecture: 4, slides: [14, 40] }, picture: 'fade', hard: 2,
      prompt: 'In the unrolled network, the copies of the cell at different time steps use …',
      choices: [
        { value: 'same', label: 'the same $\\mathbf{W}, \\mathbf{b}$', aria: 'the same W and b' },
        { value: 'own', label: 'their own $\\mathbf{W}, \\mathbf{b}$ per step', aria: 'their own W and b for each step' },
        { value: 'grow', label: '$\\mathbf{W}$ that grows with $t$', aria: 'a W that grows with t' },
        { value: 'none', label: 'no weights at all', aria: 'no weights at all' },
      ],
      answer: 'same',
      why: 'Slide 14: every unrolled cell in Figure 15-5 is labelled $\\mathbf{W}, \\mathbf{b}$: the same parameters at every time step (which is also why slide 40 warns about exploding outputs).' },
  ],
  lstm: [
    { id: 'act.f', concept: 'lstm.equations', src: { lecture: 4, slides: [46, 47] }, hard: 2,
      prompt: 'Which activation does the forget gate f(t) use?',
      choices: 'ACT', answer: 'sigma',
      why: 'Slides 46–47: the three gate controllers $\\mathbf{f}, \\mathbf{i}, \\mathbf{o}$ use the logistic activation $\\sigma$, so their outputs range from 0 to 1; only the main layer $\\mathbf{g}$ uses $\\tanh$.' },
    { id: 'act.i', concept: 'lstm.equations', src: { lecture: 4, slides: [46, 47] }, hard: 2,
      prompt: 'Which activation does the input gate i(t) use?',
      choices: 'ACT', answer: 'sigma',
      why: 'Slides 46–47: $\\mathbf{i}_{(t)}^{\\top} = \\sigma(\\mathbf{x}_{(t)}^{\\top}\\mathbf{W}_{xi} + \\mathbf{h}_{(t-1)}^{\\top}\\mathbf{W}_{hi} + \\mathbf{b}_i^{\\top})$: a gate controller, logistic, 0 to 1.' },
    { id: 'act.o', concept: 'lstm.equations', src: { lecture: 4, slides: [46, 47] }, hard: 2,
      prompt: 'Which activation does the output gate o(t) use?',
      choices: 'ACT', answer: 'sigma',
      why: 'Slides 46–47: $\\mathbf{o}_{(t)}^{\\top} = \\sigma(\\mathbf{x}_{(t)}^{\\top}\\mathbf{W}_{xo} + \\mathbf{h}_{(t-1)}^{\\top}\\mathbf{W}_{ho} + \\mathbf{b}_o^{\\top})$; the $\\tanh$ in $\\mathbf{h}_{(t)} = \\mathbf{o}_{(t)} \\otimes \\tanh(\\mathbf{c}_{(t)})$ is applied to $\\mathbf{c}_{(t)}$, not to the gate.' },
    { id: 'act.g', concept: 'lstm.equations', src: { lecture: 4, slides: [46, 47, 44] }, hard: 2,
      prompt: 'Which activation does the main layer g(t) use?',
      choices: 'ACT', answer: 'tanh',
      why: 'Slide 47: $\\mathbf{g}_{(t)}^{\\top} = \\tanh(\\mathbf{x}_{(t)}^{\\top}\\mathbf{W}_{xg} + \\mathbf{h}_{(t-1)}^{\\top}\\mathbf{W}_{hg} + \\mathbf{b}_g^{\\top})$: $\\mathbf{g}$ is the main layer (Tanh band in Figure 15-12), not a gate controller.' },
    { id: 'cLine', concept: 'lstm.equations', src: { lecture: 4, slides: [44, 47] }, hard: 3,
      prompt: 'Which is slide 47’s c(t) line?',
      choices: [
        { value: 'right', label: '$\\mathbf{c}_{(t)} = \\mathbf{f}_{(t)} \\otimes \\mathbf{c}_{(t-1)} + \\mathbf{i}_{(t)} \\otimes \\mathbf{g}_{(t)}$', aria: 'c(t) = f(t) ⊗ c(t−1) + i(t) ⊗ g(t)' },
        { value: 'swapped', label: '$\\mathbf{c}_{(t)} = \\mathbf{f}_{(t)} \\otimes \\mathbf{g}_{(t)} + \\mathbf{i}_{(t)} \\otimes \\mathbf{c}_{(t-1)}$', aria: 'c(t) = f(t) ⊗ g(t) + i(t) ⊗ c(t−1)' },
        { value: 'oGate', label: '$\\mathbf{c}_{(t)} = \\mathbf{f}_{(t)} \\otimes \\mathbf{c}_{(t-1)} + \\mathbf{o}_{(t)} \\otimes \\mathbf{g}_{(t)}$', aria: 'c(t) = f(t) ⊗ c(t−1) + o(t) ⊗ g(t)' },
        { value: 'tanh', label: '$\\mathbf{c}_{(t)} = \\tanh(\\mathbf{f}_{(t)} \\otimes \\mathbf{c}_{(t-1)} + \\mathbf{i}_{(t)} \\otimes \\mathbf{g}_{(t)})$', aria: 'c(t) = tanh of f(t) ⊗ c(t−1) + i(t) ⊗ g(t)' },
      ],
      answer: 'right',
      why: 'Slide 47: $\\mathbf{c}_{(t)} = \\mathbf{f}_{(t)} \\otimes \\mathbf{c}_{(t-1)} + \\mathbf{i}_{(t)} \\otimes \\mathbf{g}_{(t)}$: the forget gate scales the old long-term state, the input gate scales $\\mathbf{g}$, and (slide 44) the result is sent straight out without any further transformation.' },
    { id: 'yLine', concept: 'lstm.equations', src: { lecture: 4, slides: [45, 47] }, hard: 3,
      prompt: 'Which is slide 47’s output line?',
      choices: [
        { value: 'right', label: '$\\mathbf{y}_{(t)} = \\mathbf{h}_{(t)} = \\mathbf{o}_{(t)} \\otimes \\tanh(\\mathbf{c}_{(t)})$', aria: 'y(t) = h(t) = o(t) ⊗ tanh(c(t))' },
        { value: 'noTanh', label: '$\\mathbf{y}_{(t)} = \\mathbf{h}_{(t)} = \\mathbf{o}_{(t)} \\otimes \\mathbf{c}_{(t)}$', aria: 'y(t) = h(t) = o(t) ⊗ c(t)' },
        { value: 'oldC', label: '$\\mathbf{y}_{(t)} = \\mathbf{h}_{(t)} = \\mathbf{o}_{(t)} \\otimes \\tanh(\\mathbf{c}_{(t-1)})$', aria: 'y(t) = h(t) = o(t) ⊗ tanh(c(t−1))' },
        { value: 'fGate', label: '$\\mathbf{y}_{(t)} = \\mathbf{h}_{(t)} = \\mathbf{f}_{(t)} \\otimes \\tanh(\\mathbf{c}_{(t)})$', aria: 'y(t) = h(t) = f(t) ⊗ tanh(c(t))' },
      ],
      answer: 'right',
      why: 'Slides 45 and 47: $\\mathbf{c}_{(t)}$ is passed through $\\tanh$ and filtered by the output gate, giving the short-term state $\\mathbf{h}_{(t)}$, which equals the cell’s output $\\mathbf{y}_{(t)}$: $\\mathbf{y}_{(t)} = \\mathbf{h}_{(t)} = \\mathbf{o}_{(t)} \\otimes \\tanh(\\mathbf{c}_{(t)})$, the NEW $\\mathbf{c}_{(t)}$.' },
    { id: 'states', concept: 'lstm.cell', src: { lecture: 4, slides: [43] }, hard: 1,
      prompt: 'In an LSTM cell, which state is the long-term state (the cargo car)?',
      choices: [
        { value: 'c', label: '$\\mathbf{c}_{(t)}$', aria: 'c(t)' },
        { value: 'h', label: '$\\mathbf{h}_{(t)}$', aria: 'h(t)' },
        { value: 'g', label: '$\\mathbf{g}_{(t)}$', aria: 'g(t)' },
        { value: 'o', label: '$\\mathbf{o}_{(t)}$', aria: 'o(t)' },
      ],
      answer: 'c',
      why: 'Slide 43: LSTM cells manage two state vectors, $\\mathbf{h}_{(t)}$ and $\\mathbf{c}_{(t)}$ (“c” for “cell”); think of $\\mathbf{h}_{(t)}$ as the short-term state and $\\mathbf{c}_{(t)}$ as the long-term state.' },
    { id: 'straight', concept: 'lstm.gates', src: { lecture: 4, slides: [44, 45] }, hard: 2,
      prompt: 'After the forget gate and the addition, the new c(t) is …',
      choices: [
        { value: 'straight', label: 'sent straight out, without any further transformation', aria: 'sent straight out, without any further transformation' },
        { value: 'tanh', label: 'passed through tanh before it leaves the cell', aria: 'passed through tanh before it leaves the cell' },
        { value: 'sigma', label: 'squashed by the logistic function', aria: 'squashed by the logistic function' },
        { value: 'gated', label: 'multiplied by the output gate before it leaves', aria: 'multiplied by the output gate before it leaves' },
      ],
      answer: 'straight',
      why: 'Slide 44: the long-term state first goes through the forget gate, then the addition adds the memories selected by the input gate, and “the result $\\mathbf{c}_{(t)}$ is sent straight out, without any further transformation.” Only the copy read into $\\mathbf{h}_{(t)}$ goes through $\\tanh$ and the output gate (slide 45).' },
    { id: 'roleErase', concept: 'lstm.gates', src: { lecture: 4, slides: [46] }, hard: 1,
      prompt: 'Which gate controls which parts of the long-term state should be erased?',
      choices: 'GATE', answer: 'f',
      why: 'Slide 46: the forget gate (controlled by $\\mathbf{f}_{(t)}$) controls which parts of the long-term state should be erased. Open ($\\approx 1$) keeps, closed ($\\approx 0$) erases.' },
    { id: 'roleAdd', concept: 'lstm.gates', src: { lecture: 4, slides: [46] }, hard: 1,
      prompt: 'Which gate controls which parts of g(t) are added to the long-term state?',
      choices: 'GATE', answer: 'i',
      why: 'Slide 46: the input gate (controlled by $\\mathbf{i}_{(t)}$) controls which parts of $\\mathbf{g}_{(t)}$ should be added to the long-term state.' },
    { id: 'roleRead', concept: 'lstm.gates', src: { lecture: 4, slides: [46] }, hard: 1,
      prompt: 'Which gate controls which parts of the long-term state are read and output at this step?',
      choices: 'GATE', answer: 'o',
      why: 'Slide 46: the output gate (controlled by $\\mathbf{o}_{(t)}$) controls which parts of the long-term state should be read and output at this time step, both to $\\mathbf{h}_{(t)}$ and $\\mathbf{y}_{(t)}$.' },
  ],
  gru: [
    { id: 'zMult', concept: 'gru.update', src: { lecture: 4, slides: [48, 49] }, hard: 3,
      prompt: 'In slide 49’s h(t) line, z(t) multiplies …',
      choices: [
        { value: 'hPrev', label: 'the previous state $\\mathbf{h}_{(t-1)}$', aria: 'the previous state h(t−1)' },
        { value: 'g', label: 'the new $\\mathbf{g}_{(t)}$', aria: 'the new g(t)' },
        { value: 'x', label: 'the input $\\mathbf{x}_{(t)}$', aria: 'the input x(t)' },
        { value: 'r', label: '$\\mathbf{r}_{(t)}$', aria: 'r(t)' },
      ],
      answer: 'hPrev',
      why: 'Slide 49: $\\mathbf{h}_{(t)} = \\mathbf{z}_{(t)} \\otimes \\mathbf{h}_{(t-1)} + (1 - \\mathbf{z}_{(t)}) \\otimes \\mathbf{g}_{(t)}$: $\\mathbf{z}$ multiplies the PREVIOUS state and $1 - \\mathbf{z}$ multiplies $\\mathbf{g}$ (Figure 15-13 agrees: z multiplies the $\\mathbf{h}_{(t-1)}$ line, a 1 − z box multiplies $\\mathbf{g}_{(t)}$).' },
    { id: 'zOne', concept: 'gru.update', src: { lecture: 4, slides: [49, 48] }, hard: 3,
      prompt: 'With the slides’ convention, z(t) = 1 …',
      choices: [
        { value: 'keep', label: 'keeps $\\mathbf{h}_{(t-1)}$ and shuts $\\mathbf{g}_{(t)}$ out', aria: 'keeps h(t−1) and shuts g(t) out' },
        { value: 'replace', label: 'replaces the state with $\\mathbf{g}_{(t)}$', aria: 'replaces the state with g(t)' },
        { value: 'reset', label: 'resets $\\mathbf{h}_{(t-1)}$ inside $\\mathbf{g}_{(t)}$', aria: 'resets h(t−1) inside g(t)' },
        { value: 'output', label: 'opens the output gate', aria: 'opens the output gate' },
      ],
      answer: 'keep',
      why: 'Slide 49: with $\\mathbf{z} = 1$, $\\mathbf{h}_{(t)} = 1 \\otimes \\mathbf{h}_{(t-1)} + 0 \\otimes \\mathbf{g}_{(t)} = \\mathbf{h}_{(t-1)}$; $\\mathbf{z} = 0$ replaces the state with $\\mathbf{g}$. A GRU has no output gate (slide 48).' },
    { id: 'rWhere', concept: 'gru.update', src: { lecture: 4, slides: [48, 49] }, hard: 3,
      prompt: 'Where does r(t) act?',
      choices: [
        { value: 'prevInG', label: 'only on the previous-state term inside $\\mathbf{g}_{(t)}$', aria: 'only on the previous-state term inside g(t)' },
        { value: 'xToo', label: 'on both $\\mathbf{x}_{(t)}^{\\top}\\mathbf{W}_{xg}$ and the previous-state term', aria: 'on both x(t) W_xg and the previous-state term' },
        { value: 'hLine', label: 'in the $\\mathbf{h}_{(t)}$ line, next to $\\mathbf{z}_{(t)}$', aria: 'in the h(t) line, next to z(t)' },
        { value: 'output', label: 'on the output, like an output gate', aria: 'on the output, like an output gate' },
      ],
      answer: 'prevInG',
      why: 'Slide 49: $\\mathbf{g}_{(t)}^{\\top} = \\tanh(\\mathbf{x}_{(t)}^{\\top}\\mathbf{W}_{xg} + (\\mathbf{r}_{(t)}^{\\top}\\mathbf{W}_{hg} \\otimes \\mathbf{h}_{(t-1)}^{\\top}) + \\mathbf{b}_g^{\\top})$: $\\mathbf{r}$ gates only the previous-state term; it does not touch $\\mathbf{x}_{(t)}^{\\top}\\mathbf{W}_{xg}$ and does not appear in the $\\mathbf{h}_{(t)}$ line.' },
    { id: 'noOut', concept: 'gru.cell', src: { lecture: 4, slides: [48] }, hard: 2,
      prompt: 'How does a GRU cell read its state out?',
      choices: [
        { value: 'every', label: 'the full state vector is output at every time step', aria: 'the full state vector is output at every time step' },
        { value: 'oGate', label: 'an output gate o(t) chooses what to read', aria: 'an output gate o(t) chooses what to read' },
        { value: 'last', label: 'only at the last time step', aria: 'only at the last time step' },
        { value: 'c', label: 'through a separate long-term state c(t)', aria: 'through a separate long-term state c(t)' },
      ],
      answer: 'every',
      why: 'Slide 48: there is no output gate; the full state vector is output at every time step.' },
    { id: 'merged', concept: 'gru.cell', src: { lecture: 4, slides: [48] }, hard: 2,
      prompt: 'What happens to the LSTM’s two state vectors in a GRU cell?',
      choices: [
        { value: 'merged', label: 'they are merged into a single vector $\\mathbf{h}_{(t)}$', aria: 'they are merged into a single vector h(t)' },
        { value: 'cOnly', label: 'only $\\mathbf{c}_{(t)}$ is kept', aria: 'only c(t) is kept' },
        { value: 'both', label: 'both are kept, with a third added', aria: 'both are kept, with a third added' },
        { value: 'swap', label: 'they swap roles at each step', aria: 'they swap roles at each step' },
      ],
      answer: 'merged',
      why: 'Slide 48: the GRU cell is a simplified version of the LSTM cell: both state vectors are merged into a single vector $\\mathbf{h}_{(t)}$.' },
    { id: 'oneCtrl', concept: 'gru.cell', src: { lecture: 4, slides: [48, 49] }, hard: 2,
      prompt: 'In a GRU, the single gate controller z(t) controls …',
      choices: [
        { value: 'both', label: 'both the forget gate and the input gate', aria: 'both the forget gate and the input gate' },
        { value: 'out', label: 'the output gate only', aria: 'the output gate only' },
        { value: 'forget', label: 'the forget gate only', aria: 'the forget gate only' },
        { value: 'all3', label: 'the forget, input and output gates', aria: 'the forget, input and output gates' },
      ],
      answer: 'both',
      why: 'Slide 48: a single gate controller $\\mathbf{z}_{(t)}$ controls both the forget gate and the input gate: $\\mathbf{z}$ scales $\\mathbf{h}_{(t-1)}$ and $1 - \\mathbf{z}$ scales $\\mathbf{g}_{(t)}$ (slide 49).' },
    { id: 'act.z', concept: 'gru.update', src: { lecture: 4, slides: [49] }, hard: 2,
      prompt: 'Which activation does z(t) use?',
      choices: 'ACT', answer: 'sigma',
      why: 'Slide 49: $\\mathbf{z}_{(t)}^{\\top} = \\sigma(\\mathbf{x}_{(t)}^{\\top}\\mathbf{W}_{xz} + \\mathbf{h}_{(t-1)}^{\\top}\\mathbf{W}_{hz} + \\mathbf{b}_z^{\\top})$; $\\mathbf{r}$ is logistic too, and only $\\mathbf{g}$ uses $\\tanh$.' },
    { id: 'act.r', concept: 'gru.update', src: { lecture: 4, slides: [49, 48] }, hard: 2,
      prompt: 'Which activation does r(t) use?',
      choices: 'ACT', answer: 'sigma',
      why: 'Slide 49: $\\mathbf{r}_{(t)}^{\\top} = \\sigma(\\mathbf{x}_{(t)}^{\\top}\\mathbf{W}_{xr} + \\mathbf{h}_{(t-1)}^{\\top}\\mathbf{W}_{hr} + \\mathbf{b}_r^{\\top})$; Figure 15-13 draws r and z with the Logistic band.' },
    { id: 'act.gg', concept: 'gru.update', src: { lecture: 4, slides: [48, 49] }, hard: 2,
      prompt: 'Which activation does the GRU’s g(t) use?',
      choices: 'ACT', answer: 'tanh',
      why: 'Slide 49: $\\mathbf{g}_{(t)}^{\\top} = \\tanh(\\dots)$; Figure 15-13 draws the g FC box with the Tanh band, and r, z with the Logistic band.' },
  ],
};

// shared choice sets referenced by name above
export const CHOICE_SETS = {
  ACT: [
    { value: 'sigma', label: '$\\sigma$ (logistic, 0 to 1)', aria: 'sigma, the logistic function, 0 to 1' },
    { value: 'tanh', label: '$\\tanh$', aria: 'tanh' },
    { value: 'relu', label: 'ReLU', aria: 'ReLU' },
    { value: 'softmax', label: 'softmax', aria: 'softmax' },
  ],
  GATE: [
    { value: 'f', label: 'forget gate $\\mathbf{f}_{(t)}$', aria: 'the forget gate f(t)' },
    { value: 'i', label: 'input gate $\\mathbf{i}_{(t)}$', aria: 'the input gate i(t)' },
    { value: 'o', label: 'output gate $\\mathbf{o}_{(t)}$', aria: 'the output gate o(t)' },
    { value: 'g', label: 'main layer $\\mathbf{g}_{(t)}$', aria: 'the main layer g(t)' },
  ],
};

/* ── level 1: one step of slide 9 ─────────────────────────────────────── */
export const STEP = {
  concept: 'rnn.equations',
  src: { lecture: 4, slides: [9] },
  prompt: 'One station of slide 9 (one neuron, φ_h = tanh): what is h(t)?',
  // the numbers a step item may draw
  hPrev: [0.2, 0.4, 0.6, 0.8],
  x: [0.5, 1, 1.5],
  Wh: [0.5, 0.8],
  Wx: [0.5, 1],
  bh: [0, 0.1],
  // the distractors: what each wrong choice forgot
  slips: {
    right: 'the full step',
    noPhi: 'forgot φ_h = tanh',
    noH: 'dropped the h(t−1)W_h term',
    noX: 'dropped the x(t)W_x term',
  },
  why: 'Slide 9: $\\mathbf{h}_{(t)}^{\\top} = \\varphi_h(\\mathbf{h}_{(t-1)}^{\\top}\\mathbf{W}_h + \\mathbf{x}_{(t)}^{\\top}\\mathbf{W}_x + \\mathbf{b}_h^{\\top})$, here with one neuron and $\\varphi_h = \\tanh$ (slide 9 lists tanh as an example):',
};

/* ── copy ─────────────────────────────────────────────────────────────── */
export const COPY = {
  levelNames: ['SimpleRNN · the fade', 'LSTM · f, i, o', 'GRU · z, r'],
  intro: 'You are the memory cell: set the gates so cargo loaded early is delivered stations later.',
  controls: [
    'Each station is a time step t. Read the card, flip the levers, then depart (Enter or the Depart button).',
    'LSTM levers: F forget gate, I input gate, O output gate. GRU levers: Z and R. 1 = open (σ ≈ 1), 0 = closed.',
    'Signal stops ask a question: tap an answer or press 1–4.',
  ],
  model: {
    rnn: { name: 'SimpleRNN', state: 'h(t)', src: { lecture: 4, slides: [5, 9, 14] } },
    lstm: { name: 'LSTM', state: 'c(t)', src: { lecture: 4, slides: [43, 47] } },
    gru: { name: 'GRU', state: 'h(t)', src: { lecture: 4, slides: [48, 49] } },
  },
  drawer: {
    lstmEq: 'Slide 47, the LSTM computations:',
    gruEq: 'Slide 49, the GRU computations:',
    rnnEq: 'Slide 9, a recurrent layer (row vectors):',
    toy: 'This station with your levers (toy cell: one unit; a lever sets its gate’s bias to ±6 with the gate’s weights at 0):',
    fade: 'The fade run above (toy: one neuron, W_h = 0.5, W_x = 1, b_h = 0, tanh):',
    gruOrder: 'With one unit, slide 49’s typesetting $(\\mathbf{r}_{(t)}^{\\top}\\mathbf{W}_{hg} \\otimes \\mathbf{h}_{(t-1)}^{\\top})$ and Figure 15-13’s order (form $\\mathbf{r}_{(t)} \\otimes \\mathbf{h}_{(t-1)}$ first, then the FC layer) give the same number.',
  },
  signal: 'signal stop',
};

/* ── the words drawn in the pictures (games/long-line/scene.jsx) ─────────
   Each label is a piece of the slide equation it stands for.            */
export const SCENE = {
  lstm: {
    src: { lecture: 4, slides: [44, 45, 46, 47] },
    state: 'c',                              // the cargo car is the long-term state c (slide 43)
    board: 'output y(t) = h(t)',             // y(t) = h(t) = o(t) ⊗ tanh(c(t)) (slide 47)
    boardIdle: 'reads tanh(c(t))',
    boardHeld: 'held',
    read: 'o(t)',
    crane: 'i(t) ⊗ g(t)',                    // the input gate scales g (slide 47)
    hatchKept: 'f(t) ⊗ c(t−1): kept',        // the forget gate scales c(t−1) (slide 47)
    hatchDropped: 'f(t) ⊗ c(t−1): erased',
  },
  gru: {
    src: { lecture: 4, slides: [48, 49] },
    state: 'h',                              // one merged state h (slide 48)
    board: 'output h(t) · no output gate',   // the full state is output at every step (slide 48)
    boardIdle: 'h(t), every step',
    boardHeld: 'h(t), every step',
    read: 'h(t) out',
    crane: '(1 − z) ⊗ g(t)',                 // slide 49's h(t) line
    hatchKept: 'z ⊗ h(t−1): kept',
    hatchDropped: 'z ⊗ h(t−1): dropped',
    rOn: 'r ⊗ h(t−1) → g',                   // r gates only the previous-state term inside g (slide 49)
    rOff: 'g ignores h(t−1)',
    r: 'r',
  },
  cell: 'cell',
  signal: 'signal stop',
  input: 'x(t)',
  platform: 'platform · t = {t}',
  due: 'cargo due at t = {due}',
  unrolled: {
    src: { lecture: 4, slides: [5, 14, 40, 42] },
    shared: 'W,b',                           // every unrolled cell is labelled W,b (slide 14)
    caption: 'h(t) frame by frame · faint bar: the whole state · solid bar: what is left of the t = 1 crate',
    frame: 't = {t}',
  },
  pair: {
    src: { lecture: 4, slides: [5] },
    x: 'x', y: 'ŷ', time: 'Time', left: 'left', right: 'right',
  },
  step: {
    src: { lecture: 4, slides: [9] },
    hPrev: 'h(t−1)', h: 'h(t)', Wh: '× W_h = {v}', Wx: 'x(t) × W_x = {v}', rest: '+ b_h = {v} · φ_h = tanh',
  },
};
