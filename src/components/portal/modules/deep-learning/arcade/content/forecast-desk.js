/* ============================================================================
   FORECAST DESK — CONTENT (pure data, slide-cited; Lecture 4 slides 15–39)
   ----------------------------------------------------------------------------
   You run a forecasting desk on the Chicago rail series. The bar to beat is
   the slides' 7-days' shift baseline (rail MAE 42,143, slide 18). Every
   model number the desk shows is a number PRINTED on the slides (resolved
   from content/lecture4.js ANCHORS by id); the desk never trains anything.
   The arithmetic (windows, diff_7, MAE, MAPE) lives in maths/forecastDesk.js,
   on top of lecture4-study/rnn.js.

     COPY       intro, controls, level names, labels
     SERIES     how the day-by-day numbers are labelled (the page's copy of
                the lecture data, lecture8-study/data/busrail.js)
     CALENDAR   level 1's numeric items (prompt / why templates)
     TOY        slide 19's windowing example and its numeric items
     WINDOW     slides 20–24: the 56-day windows, minibatch shapes, 3D input
     AHEAD      slides 35–38: ahead_model's windows and shapes
     TABLE30    slide 30's mulvar_train.head(), as printed
     BOARD      the leaderboard rows: model, code, the ANCHORS id of its
                printed validation MAE, concept, slide
     STRATEGIES slides 34, 35/38 and 39: the three multi-step strategies
     QUESTIONS  the choice items per level, in the slides' words

   Template strings use {name} placeholders that maths/forecastDesk.js fills.
   Prompts and choice labels are plain text (no $…$); the why cards may use
   $…$ KaTeX. Every item carries src: { lecture: 4, slides: [...] }.
   ========================================================================== */

const L4 = (...slides) => ({ lecture: 4, slides });

/* ── copy ──────────────────────────────────────────────────────────────── */
export const COPY = {
  intro: 'Run the forecasting desk: copy last week, score the error, then pick the models that beat the 7-day baseline.',
  controls: [
    'Choices: tap one, or press 1–4.',
    'Numbers: the keypad (0–9, . and ± where needed), Enter submits.',
    'Calendar: tap the day, or ← → ↑ ↓ to move and Enter to pick.',
    'Every model number is the one printed on the slides; the desk trains nothing.',
  ],
  levelNames: ['Naive baseline · MAE, MAPE', 'Windows · linear vs RNN', 'Multivariate · multi-step'],
  tape: 'desk tape',
  baseline: '7-day baseline',
  calendarAria: 'Three weeks of the rail series, one row per week, Monday first',
  cellFuture: 'not yet',
  unitThousand: 'thousand',
  drawer: 'Show the maths',
  drawerMae: 'Slide 18 defines both through pandas code: diff_7.abs().mean() and (diff_7 / targets).abs().mean().',
  drawerWindow: 'tf.keras.utils.timeseries_dataset_from_array, as slide 19 calls it:',
  drawerShapes: 'Shapes are [batch size, time steps, dimensionality] (slide 24).',
  boardTitle: 'validation MAE, as printed on the slides',
  boardHidden: '?',
  legend: { top: 'rail, and rail 7 days earlier (df.shift(7))', bottom: 'diff_7 = y(t) − y(t−7), bus and rail', rail: 'rail', lag: 'rail 7 days earlier', bus: 'bus (diff_7 panel)' },
  railIn: 'rail (input)',
  busIn: 'bus (input)',
  railOut: 'rail (target)',
  dayAxis: 'Day',
  toyCaption: 'my_series and its targets',
  windowCaption: 'one window of the page’s copy of rail_valid / 1e6',
  aheadCaption: 'one 70-day window of the page’s copy of mulvar_valid (bus, rail / 1e6)',
};

/* ── the series the calendar and charts draw ──────────────────────────────
   lecture8-study/data/busrail.js holds four 70-day validation windows of the
   lecture's CTA data (raw daily boardings, 2019-01-01 to 2019-05-31 when
   stitched). Stitched, its 7-day differences over 2019-03 to 2019-05
   reproduce slide 18's printed MAE and MAPE exactly (the check asserts it). */
export const SERIES = {
  label: 'rail riders per day, in thousands (rounded): the page’s copy of the lecture’s CTA data',
  short: 'rail · thousands',
  period: ['2019-03', '2019-05'], // slide 17's diff_7 period, inside which every level-1 target day falls
  src: L4(16, 17, 18),
};

/* ── level 1: the calendar (slides 16–18) ─────────────────────────────── */
export const CALENDAR = {
  copyDay: {
    concept: 'forecast.naive', src: L4(16, 17),
    prompt: 'The 7-days’ shift forecast for {day} copies which day?',
    sub: 'Tap that day on the calendar.',
    why: 'Naive forecasting copies a past value (slide 16); the baseline copies the same weekday one week earlier, y(t−7) = {lag}, because of the strong weekly seasonality (slide 17). {yday} would be yesterday.',
  },
  diff7: {
    concept: 'forecast.naive', src: L4(17),
    prompt: 'diff_7 on {day} = y(t) − y(t−7). In thousands?',
    why: 'df.diff(7) is the difference between t and t − 7 (slide 17): {yt} − {ylag} = {d} thousand. Its size is the 7-days’ shift forecast’s error on that day.',
  },
  maeHand: {
    concept: 'forecast.mae', src: L4(17, 18),
    prompt: 'MAE of the 7-days’ shift over the {n} marked days? In thousands, nearest whole number is fine.',
    why: 'MAE = mean |diff_7| (slide 18: diff_7.abs().mean()): ({abs}) / {n} = {mae} thousand.',
  },
  mapeHand: {
    concept: 'forecast.mae', src: L4(18),
    prompt: 'MAPE of the 7-days’ shift over the {n} marked days, as a fraction like slide 18? (±0.002)',
    why: 'MAPE divides the forecast errors by the target values (slide 18: (diff_7 / targets).abs().mean()): ({terms}) / {n} = {mape}. Slide 18 prints it as a fraction (rail 0.089948), not a percentage.',
  },
  // keypad tolerances: MAE in thousands to the nearest whole number; MAPE ±0.002
  tol: { mae: 0.5, mape: 0.002 },
  // the hand-worked examples use this many consecutive target days
  days: { mae: [3, 4], mape: [2, 2] },
};

/* ── level 2: slide 19's toy (and the same call with other numbers) ───── */
export const TOY = {
  slide: { n: 6, L: 3, B: 2 }, // my_series = [0, 1, 2, 3, 4, 5], targets=my_series[3:], sequence_length=3, batch_size=2
  // the variants keep slide 19's pattern: my_series = [0 … n−1], targets = my_series[L:]
  variants: { n: [6, 7, 8, 9], L: [2, 3, 4], B: [2, 3] },
  variantSub: 'Slide 19’s call with other numbers.',
  slideSub: 'Slide 19’s example.',
  target: {
    concept: 'forecast.windowing', src: L4(19),
    prompt: 'Which target does the window [{w}] get?',
    why: 'targets=my_series[{L}:] pairs the window starting at index p with my_series[p + {L}]: [{w}] → {y} (slide 19: [0, 1, 2] → 3, [1, 2, 3] → 4, [2, 3, 4] → 5).',
  },
  count: {
    concept: 'forecast.windowing', src: L4(19),
    prompt: 'How many (window, target) pairs does the dataset yield?',
    why: '{n} values allow {fit} windows of length {L}, but targets=my_series[{L}:] holds only {count} values, so {count} pairs come out. Slide 19’s [0 … 5] yields 3: the window [3, 4, 5] has no target.',
  },
  batchX: {
    concept: 'forecast.windowing', src: L4(19),
    prompt: 'Shape of batch {k}’s inputs (batch, steps)?',
    why: '{count} windows in batches of {B}: batch {k} holds {size}, each of {L} values, so ({size}, {L}). Slide 19 prints shape=(2, 3) and then shape=(1, 3): the last batch may be short.',
  },
  batchY: {
    concept: 'forecast.windowing', src: L4(19),
    prompt: 'Shape of batch {k}’s targets?',
    why: 'One target per window: batch {k} holds {size} windows, so its targets have shape ({size},). Slide 19 prints shape=(2,) and then shape=(1,).',
  },
  missing: {
    concept: 'forecast.windowing', src: L4(19),
    prompt: 'Why is [{last}] never a window?',
    choices: [
      { value: 'targets', label: 'targets=my_series[{L}:] has no value left for it', correct: true },
      { value: 'dropRemainder', label: 'batch_size={B} drops the incomplete last batch' },
      { value: 'noOverlap', label: 'windows never overlap' },
      { value: 'lastIndex', label: 'sequence_length={L} skips the last index' },
    ],
    why: 'Its target would be my_series[{n}], past the end: the targets run out after {count} windows. Windows do overlap ([0, 1, 2] then [1, 2, 3]), and slide 19’s last batch keeps its single window, shape (1, 3).',
  },
};

/* ── level 2: the 56-day windows (slides 20–24) ───────────────────────── */
export const WINDOW = {
  seqLength: 56, // slide 20
  batchSize: 32, // slide 20
  // variants of slide 20's call for the shape items (the slide prints the 32 / 56 case)
  batchVariants: [16, 64],
  rule56: {
    concept: 'forecast.windowing', src: L4(20, 22),
    prompt: 'A train_ds window holds rail data for days 0 to 55. Which day is its target?',
    why: 'seq_length = 56 and targets=rail_train[seq_length:] (slide 20): input = rail data for days 0 to 55, predict = rail data for day 56 (slide 22).',
  },
  rule55: {
    concept: 'forecast.windowing', src: L4(20, 22),
    prompt: 'The target is day 56. The input window runs from day 0 to day…?',
    why: 'Slide 22: history_timesteps = range(56), "input: rail data for days 0 to 55"; next_timestep = 56, "predict: rail data for day 56".',
  },
  shapeX: {
    concept: 'forecast.windowing', src: L4(20, 21),
    prompt: 'train_ds with seq_length = {L} and batch_size = {B}: xx.shape of a full minibatch?',
    why: 'A minibatch stacks batch_size windows of seq_length values: ({B}, {L}). Slide 21 prints xx.shape = (32, 56) for slide 20’s seq_length = 56, batch_size = 32.',
  },
  shapeY: {
    concept: 'forecast.windowing', src: L4(20, 21),
    prompt: 'train_ds with seq_length = {L} and batch_size = {B}: yy.shape of a full minibatch?',
    why: 'One target (the next day) per window: ({B},). Slide 21 prints yy.shape = (32,) for batch_size = 32.',
  },
  input3d: {
    concept: 'rnn.input3d', src: L4(21, 24),
    prompt: 'SimpleRNN wants [batch size, time steps, dimensionality]. A minibatch of 32 univariate 56-day windows is…?',
    why: 'Slide 24: all recurrent layers in Keras expect 3D inputs [batch size, time steps, dimensionality], dimensionality 1 for a univariate series: (32, 56, 1). Slide 21 prints the dataset’s xx.shape as (32, 56); the deck shows no reshape.',
  },
};

/* ── slide 20's split (the timeline picture) ──────────────────────────── */
export const SPLITS = {
  periods: [
    { name: 'rail_train', from: '2016-01', to: '2018-12' },
    { name: 'rail_valid', from: '2019-01', to: '2019-05' },
    { name: 'rail_test', from: '2019-06', to: null }, // "2019-06": onward
  ],
  diff7: { from: '2019-03', to: '2019-05', label: 'diff_7' }, // slide 17's baseline period
  axis: { from: '2016-01', to: '2019-09' },
  src: L4(17, 20),
};

/* ── level 3: ahead_model's windows (slides 35–38) ────────────────────── */
export const AHEAD = {
  ahead: 14, // slide 35: ahead=14
  targetCol: 1, // slide 35: target_col=1 (rail, the second column)
  len: {
    concept: 'forecast.aheadModel', src: L4(35, 36),
    prompt: 'ahead_train_ds uses sequence_length = seq_length + 14. How many days per window?',
    why: 'seq_length = 56 (slide 20) + 14 = 70: days 0 to 55 are the inputs and days 56 to 69 the rail targets (slide 36).',
  },
  x: {
    concept: 'forecast.aheadModel', src: L4(35, 36),
    prompt: 'One minibatch of ahead_train_ds: x.shape?',
    why: 'split_inputs_and_targets keeps mulvar_series[:, :-ahead]: the first 56 of the 70 steps with all 5 columns. Slide 36 prints (32, 56, 5).',
  },
  y: {
    concept: 'forecast.aheadModel', src: L4(35, 36),
    prompt: 'One minibatch of ahead_train_ds: y.shape?',
    why: 'split_inputs_and_targets returns mulvar_series[:, -ahead:, target_col]: the last 14 steps of column 1 (rail). Slide 36 prints (32, 14).',
  },
  predict: {
    concept: 'forecast.aheadModel', src: L4(38),
    prompt: 'X = mulvar_valid.to_numpy()[np.newaxis, :seq_length] has shape [1, 56, 5]. Y_pred = ahead_model.predict(X) has shape…?',
    why: 'SimpleRNN(32) then Dense(14): 14 forecasts for the one window, shape [1, 14] (slide 38).',
  },
  mulvar: {
    concept: 'forecast.multivariate', src: L4(24, 31),
    prompt: 'train_mulvar_ds uses all 5 columns, 56-day windows, batch_size 32. Input shape of a minibatch?',
    why: '[batch size, time steps, dimensionality] (slide 24) with all 5 columns (slide 31, the other arguments as before): (32, 56, 5), the shape slide 36 prints for ahead_train_ds’s inputs too.',
  },
  columns: {
    concept: 'forecast.multivariate', src: L4(30, 31),
    prompt: 'How many input values does mulvar_model read at each time step?',
    why: 'Slide 31: "use all 5 columns": bus, rail and the one-hot next_day_type_A, next_day_type_U, next_day_type_W (slide 30); hence InputLayer(shape=[None, 5]).',
  },
};

/* ── slide 30's mulvar_train.head(), as printed ───────────────────────── */
export const TABLE30 = {
  columns: ['bus', 'rail', 'next_day_type_A', 'next_day_type_U', 'next_day_type_W'],
  rows: [
    { date: '2016-01-01', values: [0.303321, 0.319835, 1, 0, 0] },
    { date: '2016-01-02', values: [0.448859, 0.365509, 0, 1, 0] },
    { date: '2016-01-03', values: [0.340540, 0.287661, 0, 0, 1] },
    { date: '2016-01-04', values: [0.829429, 0.703185, 0, 0, 1] },
    { date: '2016-01-05', values: [0.846789, 0.727716, 0, 0, 1] },
  ],
  caption: 'mulvar_train.head() (slide 30)',
  src: L4(30),
};

/* ── the leaderboard: printed validation MAEs (rail unless noted) ──────── */
// `anchor` is the content/lecture4.js ANCHORS id of the printed number;
// `bound: '>'` marks the one the slide gives only as a bound.
export const BOARD = {
  baseline: { id: 'baseline', name: '7-days’ shift', code: 'diff_7.abs().mean()', anchor: 'l4.baseline.maeRail', src: L4(18) },
  rows: [
    { id: 'linear', name: 'linear model', code: 'Dense(1) on 56-day windows', anchor: 'l4.mae.linear', concept: 'forecast.linear', src: L4(23), level: 2 },
    { id: 'rnn1', name: 'SimpleRNN(1)', code: 'one recurrent neuron', anchor: 'l4.mae.simpleRnn1', bound: '>', concept: 'forecast.simpleRnn1', src: L4(24), level: 2 },
    { id: 'univar', name: 'univar_model', code: 'SimpleRNN(32) + Dense(1)', anchor: 'l4.mae.univar', concept: 'forecast.univar', src: L4(26), level: 2 },
    { id: 'deep', name: 'deep_model', code: '3 × SimpleRNN(32) + Dense(1)', anchor: 'l4.mae.deep', concept: 'rnn.deep', src: L4(29), level: 2 },
    { id: 'mulvar', name: 'mulvar_model', code: 'SimpleRNN(32) on 5 columns', anchor: 'l4.mae.mulvar', concept: 'forecast.multivariate', src: L4(31), level: 3 },
    { id: 'multask', name: 'multask_model', code: 'Dense(2): bus and rail together', anchor: 'l4.mae.multask', concept: 'forecast.multiOutput', src: L4(33), level: 3 },
    { id: 'loop', name: 'univar_model looped', code: '14 days, 1 step at a time', anchor: 'l4.mae.loop14', concept: 'forecast.oneStepLoop', src: L4(34), level: 3 },
    { id: 'ahead', name: 'ahead_model', code: 'Dense(14): 14 days at once', anchor: 'l4.mae.ahead', concept: 'forecast.aheadModel', src: L4(38), level: 3 },
  ],
  // the bar scale's right edge (a bar beyond it is drawn running off the edge)
  scaleMax: 50000,
  nameOf: {
    prompt: 'Which forecaster printed a validation MAE of {value}?',
    why: '{name} ({code}): validation MAE {value} (slide {slide}). The 7-days’ shift baseline is 42,143 (slide 18).',
  },
  valueOf: {
    prompt: 'What validation MAE did {name} ({code}) print?',
    why: '{name} ({code}): validation MAE {value} (slide {slide}). The 7-days’ shift baseline is 42,143 (slide 18).',
  },
  multaskNote: ' Slide 33’s 27,855 is over bus and rail together (bus 26,812, rail 28,896).',
};

/* ── the three multi-step strategies (slides 34–39) ───────────────────── */
export const STRATEGIES = [
  { id: 'loop', label: 'one step at a time, looped 14 times (univar_model)', short: 'loop one step',
    why: 'Slide 34: the predicted value at time step t − 1 becomes the last input value for time step t, 14 times over; univar_model was trained to predict one step ahead only. Validation MAE 30,734.',
    src: L4(34) },
  { id: 'ahead', label: 'all 14 days at the last time step (ahead_model)', short: '14 at once',
    why: 'Slides 35 and 38: ahead_model forecasts the 14 days ahead at the last time step, SimpleRNN(32) then Dense(14). Validation MAE 33,887 for rail.',
    src: L4(35, 38) },
  { id: 'seq2seq', label: 'a forecast at each and every time step (sequence-to-sequence)', short: 'every step',
    why: 'Slide 39: instead of forecasting only at the very last time step, train it to forecast at each and every time step (days 0–9 → days 10–19, then days 1–10 → days 11–20, …). No code or MAE is given.',
    src: L4(39) },
];
export const STRATEGY_DISTRACTOR = { id: 'multask', label: 'two outputs per day, bus and rail (multask_model)' };
export const STRATEGY_Q = {
  concept: 'forecast.multiStep', src: L4(34, 35, 39),
  prompt: 'Which multi-step strategy is drawn?',
};

/* ── the choice questions ─────────────────────────────────────────────── */
// choices: [{ value, label, correct? }]; exactly one correct.
export const QUESTIONS = {
  // level 1 (slides 16–18)
  naiveDef: {
    concept: 'forecast.naive', src: L4(16),
    prompt: 'Simply copying a past value to make the forecast is called…',
    choices: [
      { value: 'naive', label: 'naive forecasting', correct: true },
      { value: 'seasonality', label: 'weekly seasonality' },
      { value: 'linear', label: 'a linear model' },
      { value: 'seq2seq', label: 'sequence-to-sequence forecasting' },
    ],
    why: 'Slide 16: "If we simply copy a past value to make our forecast, then it is called naive forecasting." It is often a good baseline, and can even be tricky to beat.',
  },
  whyWeekly: {
    concept: 'forecast.naive', src: L4(16, 17),
    prompt: 'Why does the baseline copy the value from 7 days earlier?',
    choices: [
      { value: 'seasonality', label: 'the strong weekly seasonality', correct: true },
      { value: 'weekly', label: 'the riders are counted once a week' },
      { value: 'seq', label: 'seq_length is 7' },
      { value: 'unknown', label: 'the last 6 days are not recorded yet' },
    ],
    why: 'A similar pattern repeats each week, a weekly seasonality (slide 16), so copying the value from the previous week works better (slide 17). The counts are daily boarding totals.',
  },
  whichBaseline: {
    concept: 'forecast.mae', src: L4(18),
    prompt: 'Which forecast do the slides use as the baseline for benchmarking the RNN methods?',
    choices: [
      { value: 'shift7', label: 'the 7-days’ shift: copy y(t−7)', correct: true },
      { value: 'shift1', label: 'copy yesterday: y(t−1)' },
      { value: 'linear', label: 'the linear model' },
      { value: 'univar', label: 'univar_model' },
    ],
    why: 'Slide 18: "This 7-days’ shift prediction serves as a baseline for benchmarking our RNN methods later on." Its rail MAE is 42,143; slide 23 recalls it when the linear model beats it.',
  },
  busVsRail: {
    concept: 'forecast.mae', src: L4(18),
    prompt: 'With the 7-days’ shift, bus has a higher MAE than rail (43,916 vs 42,143). Its MAPE is…',
    choices: [
      { value: 'lower', label: 'lower than rail’s', correct: true },
      { value: 'higher', label: 'higher than rail’s' },
      { value: 'same', label: 'the same as rail’s' },
      { value: 'undefined', label: 'not defined for bus' },
    ],
    why: 'Slide 18: bus 0.082938, rail 0.089948, "its MAPE is actually lower". MAPE divides each error by its target value, so bigger targets can turn a bigger MAE into a smaller MAPE.',
  },
  anchorMaeRail: {
    concept: 'forecast.mae', src: L4(18),
    prompt: 'Slide 18 prints diff_7.abs().mean(). Which number is rail’s?',
    choices: [
      { value: 'maeRail', label: '42143.271739', correct: true },
      { value: 'maeBus', label: '43915.608696' },
      { value: 'mapeRail', label: '0.089948' },
      { value: 'mapeBus', label: '0.082938' },
    ],
    why: 'diff_7.abs().mean() is the MAE: bus 43915.608696, rail 42143.271739 (slide 18). The 0.08… values are the MAPEs, (diff_7 / targets).abs().mean().',
  },
  anchorMaeBus: {
    concept: 'forecast.mae', src: L4(18),
    prompt: 'Slide 18 prints diff_7.abs().mean(). Which number is bus’s?',
    choices: [
      { value: 'maeBus', label: '43915.608696', correct: true },
      { value: 'maeRail', label: '42143.271739' },
      { value: 'mapeBus', label: '0.082938' },
      { value: 'mapeRail', label: '0.089948' },
    ],
    why: 'diff_7.abs().mean() is the MAE: bus 43915.608696, rail 42143.271739 (slide 18). The 0.08… values are the MAPEs.',
  },
  anchorMapeRail: {
    concept: 'forecast.mae', src: L4(18),
    prompt: 'Slide 18 prints (diff_7 / targets).abs().mean(). Which number is rail’s?',
    choices: [
      { value: 'mapeRail', label: '0.089948', correct: true },
      { value: 'mapeBus', label: '0.082938' },
      { value: 'pct', label: '8.9948' },
      { value: 'maeRail', label: '42143.271739' },
    ],
    why: 'MAPE, rail: 0.089948 (slide 18), a fraction (about 9.0 %), not a percentage. Bus: 0.082938. 42143.271739 is rail’s MAE.',
  },

  // level 2 (slides 19–29)
  split: {
    concept: 'forecast.split', src: L4(20),
    prompt: 'Which period is {name}?',
    choices: [
      { value: 'rail_train', label: '2016-01 to 2018-12' },
      { value: 'rail_valid', label: '2019-01 to 2019-05' },
      { value: 'rail_test', label: '2019-06 onward' },
      { value: 'diff7', label: '2019-03 to 2019-05' },
    ],
    // the asked name's own choice is the correct one (set by maths)
    names: ['rail_train', 'rail_valid', 'rail_test'],
    why: 'Slide 20: rail_train = df["rail"]["2016-01":"2018-12"] / 1e6, rail_valid = ["2019-01":"2019-05"], rail_test = ["2019-06":]. 2019-03 to 2019-05 is the baseline’s diff_7 period (slide 17).',
  },
  shuffle: {
    concept: 'forecast.split', src: L4(20),
    prompt: 'Which dataset does slide 20 build with shuffle=True, seed=42?',
    choices: [
      { value: 'train', label: 'train_ds', correct: true },
      { value: 'valid', label: 'valid_ds' },
      { value: 'both', label: 'both' },
      { value: 'neither', label: 'neither' },
    ],
    why: 'Slide 20: train_ds passes shuffle=True, seed=42; valid_ds passes only sequence_length and batch_size=32.',
  },
  deepWhy: {
    concept: 'rnn.deep', src: L4(29),
    prompt: 'deep_model (3 × SimpleRNN(32), 5,281 parameters) printed about 29,672, worse than univar_model. Slide 29’s verdict?',
    choices: [
      { value: 'tooLarge', label: 'this RNN is a bit too large for the task', correct: true },
      { value: 'lastSeq', label: 'the last SimpleRNN also needs return_sequences=True' },
      { value: 'tooSmall', label: 'it has too few parameters to fit the series' },
      { value: 'tanh', label: 'tanh cannot output values above 1' },
    ],
    why: 'Slide 29: about 29,672 is "worse than the previous shallower RNN. It looks like this RNN is a bit too large for our task." univar_model printed 27,703 (slide 26).',
  },
  returnSeq: {
    concept: 'rnn.deep', src: L4(29),
    prompt: 'Stacking SimpleRNN layers into deep_model: which ones get return_sequences=True?',
    choices: [
      { value: 'allButLast', label: 'every SimpleRNN except the last', correct: true },
      { value: 'all', label: 'all three SimpleRNN layers' },
      { value: 'last', label: 'only the last SimpleRNN' },
      { value: 'dense', label: 'only the Dense(1) output' },
    ],
    why: 'Slide 29: "set return_sequences=True for all the SimpleRNN layers except for the last one."',
  },
  rnn1Why: {
    concept: 'forecast.simpleRnn1', src: L4(24, 25, 26),
    prompt: 'SimpleRNN(1) printed a validation MAE greater than 100,000. One of the slides’ two reasons:',
    // one of `reasons` is the correct choice (seeded); the rest are distractors
    reasons: [
      { value: 'oneNeuron', label: 'a single recurrent neuron: the whole model has 3 parameters', src: L4(25) },
      { value: 'tanhRange', label: 'tanh outputs lie between −1 and +1, but the series reaches about 1.4', src: L4(26) },
    ],
    choices: [
      { value: 'shuffle', label: 'its training windows were shuffled' },
      { value: 'input3d', label: 'its input layer is [None, 1]' },
      { value: 'returnSeq', label: 'it is missing return_sequences=True' },
    ],
    why: 'Slides 25–26: the model has a single recurrent neuron (3 parameters in all), and the default tanh can only output values between −1 and +1 while the series runs from 0 to about 1.4. The fix: SimpleRNN(32) plus Dense(1) with no activation (univar_model).',
  },
  notBeat: {
    concept: 'forecast.leaderboard', src: L4(18, 23, 24, 26, 29),
    prompt: 'Which of these did NOT beat the 7-days’ shift baseline (rail MAE 42,143)?',
    choices: [
      { value: 'rnn1', label: 'SimpleRNN(1)', correct: true },
      { value: 'linear', label: 'the linear model' },
      { value: 'univar', label: 'univar_model' },
      { value: 'deep', label: 'deep_model' },
    ],
    why: 'SimpleRNN(1): greater than 100,000 (slide 24). The linear model 38,245 (slide 23), univar_model 27,703 (slide 26) and deep_model 29,672 (slide 29) all beat 42,143.',
  },
  bestUnivariate: {
    concept: 'forecast.leaderboard', src: L4(23, 24, 26, 29),
    prompt: 'Of the rail-only models on slides 23–29, which printed the lowest validation MAE?',
    choices: [
      { value: 'univar', label: 'univar_model', correct: true },
      { value: 'deep', label: 'deep_model' },
      { value: 'linear', label: 'the linear model' },
      { value: 'rnn1', label: 'SimpleRNN(1)' },
    ],
    why: 'univar_model about 27,703 (slide 26) beats deep_model 29,672 (slide 29), the linear model 38,245 (slide 23) and SimpleRNN(1), above 100,000 (slide 24).',
  },

  // level 3 (slides 30–39)
  nextDay: {
    concept: 'forecast.multivariate', src: L4(30),
    prompt: 'df_mulvar["next_day_type"] = df["day_type"].shift(-1). In row 2016-01-02 it holds…',
    choices: [
      { value: 'tomorrow', label: '2016-01-03’s day type (tomorrow’s)', correct: true },
      { value: 'today', label: '2016-01-02’s own day type' },
      { value: 'yesterday', label: '2016-01-01’s day type' },
      { value: 'rail', label: 'tomorrow’s rail count' },
    ],
    why: 'Slide 30: shift(-1) brings "tomorrow’s type" up one row, and pd.get_dummies one-hot encodes it into next_day_type_A, _U and _W; row 2016-01-02 has next_day_type_U = 1.',
  },
  target: {
    concept: 'forecast.multivariate', src: L4(31),
    prompt: 'mulvar_model reads all 5 columns. What does it forecast?',
    choices: [
      { value: 'rail', label: 'only the rail series', correct: true },
      { value: 'busRail', label: 'bus and rail' },
      { value: 'all', label: 'all 5 columns' },
      { value: 'dayType', label: 'tomorrow’s day type' },
    ],
    why: 'Slide 31: targets=mulvar_train["rail"][seq_length:], "forecast only the rail series", with Dense(1). It printed a validation MAE of 22,062.',
  },
  multask: {
    concept: 'forecast.multiOutput', src: L4(32),
    prompt: 'multask_model forecasts both bus and rail riders. Its output layer?',
    choices: [
      { value: 'd2', label: 'Dense(2)', correct: true },
      { value: 'd1', label: 'Dense(1)' },
      { value: 'd14', label: 'Dense(14)' },
      { value: 'd5', label: 'Dense(5)' },
    ],
    why: 'Slide 32: targets=mulvar_train[["bus", "rail"]][seq_length:] gives 2 targets per day, and the model ends in Dense(2).',
  },
  targetCol: {
    concept: 'forecast.aheadModel', src: L4(30, 35),
    prompt: 'split_inputs_and_targets(…, target_col=1) takes its targets from which column?',
    choices: [
      { value: 'rail', label: 'rail', correct: true },
      { value: 'bus', label: 'bus' },
      { value: 'A', label: 'next_day_type_A' },
      { value: 'all', label: 'all 5 columns' },
    ],
    why: 'The columns are bus, rail, next_day_type_A, _U, _W (slide 30), so index 1 is rail: mulvar_series[:, -ahead:, target_col] keeps the last 14 rail values (slide 35).',
  },
  loopSame: {
    concept: 'forecast.oneStepLoop', src: L4(34),
    prompt: 'Looping univar_model 14 times (each prediction fed back in) works only when…',
    choices: [
      { value: 'same', label: 'the input and output vectors have the same features', correct: true },
      { value: 'trained14', label: 'the model was trained to predict 14 steps' },
      { value: 'returnSeq', label: 'every layer has return_sequences=True' },
      { value: 'five', label: 'the inputs have 5 columns' },
    ],
    why: 'Slide 34: the predicted value at t − 1 becomes the last input value at t, so the method works only when the input and output vectors have the same features; univar_model was trained to predict one step ahead only.',
  },
  seq2seq: {
    concept: 'forecast.seq2seq', src: L4(39),
    prompt: 'Sequence-to-sequence: days 0 to 9 forecast days 10 to 19. Days 1 to 10 forecast…',
    choices: [
      { value: '11to20', label: 'days 11 to 20', correct: true },
      { value: '11', label: 'day 11 only' },
      { value: '10to19', label: 'days 10 to 19 again' },
      { value: '20to29', label: 'days 20 to 29' },
    ],
    why: 'Slide 39 trains the model to forecast at each and every time step: days 0–9 → days 10–19, then days 1–10 → days 11–20, and so on. (Its 10-day example does not match the 14-day horizon or seq_length = 56.)',
  },
  aheadWhere: {
    concept: 'forecast.aheadModel', src: L4(35, 39),
    prompt: 'ahead_model forecasts the next 14 values…',
    choices: [
      { value: 'last', label: 'only at the very last time step', correct: true },
      { value: 'every', label: 'at each and every time step' },
      { value: 'loop', label: 'one value per loop, 14 loops' },
      { value: 'bus', label: 'for bus and rail together' },
    ],
    why: 'Slide 35: it forecasts 14 days ahead "at the last training time step"; slide 39 contrasts this with forecasting at each and every time step (sequence-to-sequence).',
  },
  returnSeq3: {
    concept: 'rnn.deep', src: L4(29),
    prompt: 'You put a second SimpleRNN(32) before ahead_model’s SimpleRNN(32). Which needs return_sequences=True?',
    choices: [
      { value: 'first', label: 'the new first SimpleRNN', correct: true },
      { value: 'last', label: 'the last SimpleRNN, before Dense(14)' },
      { value: 'both', label: 'both SimpleRNN layers' },
      { value: 'dense', label: 'Dense(14)' },
    ],
    why: 'Slide 29’s rule for a deep RNN: set return_sequences=True for all the SimpleRNN layers except for the last one.',
  },
  beatWidest: {
    concept: 'forecast.leaderboard', src: L4(18, 23, 26, 29, 31),
    prompt: 'Beat the baseline: which forecaster beat the 7-days’ shift (42,143) by the widest margin on the slides?',
    choices: [
      { value: 'mulvar', label: 'mulvar_model', correct: true },
      { value: 'univar', label: 'univar_model' },
      { value: 'deep', label: 'deep_model' },
      { value: 'linear', label: 'the linear model' },
    ],
    why: 'mulvar_model printed 22,062 (slide 31), against univar_model 27,703 (slide 26), deep_model 29,672 (slide 29) and the linear model 38,245 (slide 23); the baseline is 42,143 (slide 18).',
  },
  beatAhead: {
    concept: 'forecast.multiStep', src: L4(34, 38),
    prompt: 'Beat the baseline over 14 days: which strategy printed the lower validation MAE?',
    choices: [
      { value: 'loop', label: 'univar_model, one step at a time (looped)', correct: true },
      { value: 'ahead', label: 'ahead_model, all 14 at once' },
      { value: 'tie', label: 'they tied' },
    ],
    why: 'Looping univar_model printed 30,734 (slide 34); ahead_model 33,887 for rail (slide 38). Slide 38: even with 5 input features, ahead_model "performed slightly worse than the univar_model".',
  },
};

/* ── the per-level plan: each slot draws one template ─────────────────── */
export const PLAN = {
  1: [['naiveDef', 'whyWeekly', 'whichBaseline'], ['copyDay'], ['diff7'], ['copyDay', 'diff7'], ['maeHand'], ['anchorMaeRail', 'anchorMaeBus', 'anchorMapeRail'], ['mapeHand'], ['busVsRail', 'whichBaseline']],
  2: [['toyTarget', 'toyCount'], ['toyBatchX', 'toyBatchY', 'toyMissing'], ['rule56', 'rule55'], ['shapeX', 'shapeY', 'input3d'], ['split', 'shuffle'], ['board'], ['deepWhy', 'returnSeq', 'rnn1Why'], ['notBeat', 'bestUnivariate']],
  3: [['columns', 'nextDay'], ['target', 'multask', 'targetCol'], ['mulvarShape', 'aheadX'], ['strategy'], ['aheadY', 'predict', 'aheadLen'], ['loopSame', 'seq2seq', 'aheadWhere', 'returnSeq3'], ['board'], ['beatWidest', 'beatAhead']],
};
