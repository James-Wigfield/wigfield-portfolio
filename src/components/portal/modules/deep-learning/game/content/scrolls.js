/* ============================================================================
   SCROLLS OF THE PHILOSOPHER — LESSON CONTENT (pure data)
   ----------------------------------------------------------------------------
   Everything the game says about the lecture lives here, so a later lecture
   is a new file of the same shape and no new JSX. Slide numbers cite
   cits5017-lect03-CNNs.pdf (53 slides). `line` is the in-world text shown on
   the philosopher's own scroll: one or two sentences, in character, never a
   paragraph — the words live on the 2D lecture tab, reached via `lectureTab`.
   ========================================================================== */

export const LECTURE = {
  id: 'lecture3',
  code: 'CITS5017',
  title: 'Lecture 3 · Convolutional Neural Networks',
  moduleId: 'dl-lecture-3',
};

export const HOUSES = [
  {
    id: 'window',
    numeral: 'I',
    name: 'House of the Window',
    slides: '6–11',
    teaches: 'A kernel slid over an image; two filters, two feature maps',
    lectureTab: 'conv',
  },
  {
    id: 'eyes',
    numeral: 'II',
    name: 'House of Many Eyes',
    slides: '12–15',
    teaches: 'Channels in, feature maps out; the convolution equation',
    lectureTab: 'stack',
  },
  {
    id: 'door',
    numeral: 'III',
    name: 'House of the Narrow Door',
    slides: '20–31',
    teaches: 'Padding, stride and pooling change the size of the next layer',
    lectureTab: 'layers',
  },
];

export const SCROLLS = [
  /* ── House I · the window ─────────────────────────────────────────────── */
  {
    id: 'window-kernel',
    house: 'window',
    slides: '6–8',
    concept: 'Convolution and the receptive field',
    line: 'Nine tiles beneath your feet, nine weights in your hand. Their sum is one tile on the wall.',
    unlocks: 'kernel',
    lectureTab: 'conv',
  },
  {
    id: 'window-vertical',
    house: 'window',
    slides: '10',
    concept: 'The vertical-line filter',
    line: 'A column of ones and nothing else. Carry it, and only the standing lines will answer.',
    unlocks: 'filter:vertical',
    lectureTab: 'filters',
  },
  {
    id: 'window-horizontal',
    house: 'window',
    slides: '10–11',
    concept: 'The horizontal-line filter',
    line: 'Turn the window on its side. The same wall now remembers what lies flat.',
    unlocks: 'filter:horizontal',
    lectureTab: 'filters',
  },

  /* ── House II · many eyes ─────────────────────────────────────────────── */
  {
    id: 'eyes-channels',
    house: 'eyes',
    slides: '12–13',
    concept: 'One filter reaches through every input channel',
    line: 'Red, green, blue: three floors of one picture. A true filter reaches through all three at once.',
    unlocks: 'filter1',
    lectureTab: 'stack',
  },
  {
    id: 'eyes-many',
    house: 'eyes',
    slides: '13–14',
    concept: 'Many filters, many feature maps',
    line: 'Every filter you add raises one more sheet above you. Count the sheets and you have counted the channels.',
    unlocks: 'filter2',
    lectureTab: 'stack',
  },
  {
    id: 'eyes-equation',
    house: 'eyes',
    slides: '15',
    concept: 'The convolution equation',
    line: 'Sum over the channels, add the bias, and the k-th sheet is written. The wall keeps the words for it.',
    unlocks: 'equation',
    lectureTab: 'stack',
  },

  /* ── House III · the narrow door ─────────────────────────────────────── */
  {
    id: 'door-padding',
    house: 'door',
    slides: '20',
    concept: 'Valid and same padding',
    line: 'Pad the edge with nothing and the next room keeps its size. Refuse, and it shrinks.',
    unlocks: 'padding',
    lectureTab: 'layers',
  },
  {
    id: 'door-stride',
    house: 'door',
    slides: '9, 21',
    concept: 'Stride',
    line: 'Take two steps where you took one, and half the doorways fall away behind you.',
    unlocks: 'stride',
    lectureTab: 'layers',
  },
  {
    id: 'door-pooling',
    house: 'door',
    slides: '25–27',
    concept: 'Max and average pooling',
    line: 'Of every four tiles keep the brightest, or blend them. Either way the room is a quarter of what it was.',
    unlocks: 'pooling',
    lectureTab: 'layers',
  },
];

/* The one small action each house asks for before its door opens. */
export const EXIT_TESTS = {
  window: {
    kind: 'pick-filter',
    slides: '10–11',
    prompt: 'The door remembers one feature map. Carry the filter that made it, then knock.',
    fail: 'Not that window. Look at which lines glow on the door: standing, or lying flat?',
  },
  eyes: {
    kind: 'count-channels',
    slides: '13, 15',
    prompt: 'This layer holds a number of filters. How many channels leave it?',
    fail: 'Count the sheets above you, not the floors below. One filter, one map.',
  },
  door: {
    kind: 'predict-size',
    slides: '20–21, 26',
    prompt: 'Say how wide the next room will be before you step through.',
    fail: 'The door shows you the arithmetic. Valid: floor((n − k) / s) + 1. Same: ceil(n / s). Pool 2×2: halve it.',
  },
};

/* The bust in the plaza: one weathered voice for the whole village. */
export const BUST_LINES = {
  greet: [
    'Three houses, nine scrolls. Each one lights a lamp. Go and see what the wall remembers.',
    'The first house has a window you can carry. Stand on the picture and look up.',
    'Nothing here needs reading. Walk it, push it, place it. The words are on the lecture page.',
  ],
  fail: [
    'The door disagrees with you. Doors usually do, the first time.',
    'Wrong, but not far wrong. Go back to the mechanism and watch it once more.',
    'A philosopher is only someone who was wrong more carefully than the others.',
  ],
  houseDone: [
    'A roof lantern lit. The village is a little less dusk than it was.',
    'One house understood. The others are shorter than they look.',
  ],
  allDone: 'Every lamp is lit. Lecture 3 stands in stone now. Go and write it in your own hand.',
};

export const scrollsForHouse = (houseId) => SCROLLS.filter((s) => s.house === houseId);
export const scrollById = (id) => SCROLLS.find((s) => s.id === id);
export const houseById = (id) => HOUSES.find((h) => h.id === id);
