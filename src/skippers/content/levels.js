/* ============================================================================
   SKIPPERS — THE LEVELS (top tabs). One entry per tab, in order.
   ----------------------------------------------------------------------------
   id        progress key + component key in ../levels/index.jsx
   slug      the URL: /skippers/<slug> ('' = /skippers)
   n         the tab's plain mono counter
   topics    question-bank topics this level's check-in quiz draws from
   steps     the level's views, in order (one concept per view). `kind`:
               lab      an interactive lab (labs/<lab>.jsx, keyed in levels/index)
               facts    "Numbers to know" (content/facts.js[level id])
               cards    rule cards (content/cards.jsx[cards])
               check    the 5-question check-in quiz (feeds the weak-spots deck)
               custom   a one-off view keyed by `view`
   A level counts as done when its check-in has been passed (≥ 4 / 5).
   ========================================================================== */

export const LEVELS = [
  {
    id: 'start', slug: '', n: 0, title: 'Start here', short: 'Start',
    steps: [],
  },
  {
    id: 'rules', slug: 'rules', n: 1, title: 'The ticket and the rules', short: 'Rules',
    receipt: 'Workbook ch.1–2 · p.5–25', topics: ['ticket', 'rules'],
    hook: 'Most marks lost here are numbers: 8 knots, 15 m, 50 m, 14, 16, 17.',
    steps: [
      { id: 'ages', label: 'Who can drive', kind: 'lab', lab: 'AgeLab' },
      { id: 'speed', label: 'The 8-knot map', kind: 'lab', lab: 'SpeedLab' },
      { id: 'cards', label: 'Rule cards', kind: 'cards', cards: 'rules' },
      { id: 'facts', label: 'Numbers', kind: 'facts' },
      { id: 'check', label: 'Check-in', kind: 'check' },
    ],
  },
  {
    id: 'giveway', slug: 'give-way', n: 2, title: 'Who gives way', short: 'Give way',
    receipt: 'Workbook ch.3 · p.27–29', topics: ['collision'],
    hook: 'Look to the right, give way to the right, turn to the right, stay to the right.',
    steps: [
      { id: 'encounters', label: 'Encounters', kind: 'lab', lab: 'GiveWayLab' },
      { id: 'sound', label: 'Horn signals', kind: 'lab', lab: 'SoundLab' },
      { id: 'cards', label: 'Lookout & speed', kind: 'cards', cards: 'collision' },
      { id: 'check', label: 'Check-in', kind: 'check' },
    ],
  },
  {
    id: 'lights', slug: 'lights', n: 3, title: 'Lights at night', short: 'Lights',
    receipt: 'Workbook ch.4 · p.31–35', topics: ['lights'],
    hook: 'At night a boat is just a few coloured dots. The dots tell you which way it’s pointing.',
    steps: [
      { id: 'arcs', label: 'The arcs', kind: 'lab', lab: 'LightsLab' },
      { id: 'spot', label: 'What is it?', kind: 'lab', lab: 'LightsChallenge' },
      { id: 'types', label: 'Which lights', kind: 'cards', cards: 'lights' },
      { id: 'facts', label: 'Numbers', kind: 'facts' },
      { id: 'check', label: 'Check-in', kind: 'check' },
    ],
  },
  {
    id: 'marks', slug: 'marks', n: 4, title: 'Reading the marks', short: 'Marks',
    receipt: 'Workbook ch.5 · p.37–40', topics: ['buoyage'],
    hook: 'Coming home, keep the red marks on your left. Cardinals point at the safe water.',
    steps: [
      { id: 'lateral', label: 'Port & starboard', kind: 'lab', lab: 'LateralLab' },
      { id: 'cardinal', label: 'Cardinals', kind: 'lab', lab: 'CardinalLab' },
      { id: 'others', label: 'The other marks', kind: 'lab', lab: 'OtherMarksLab' },
      { id: 'facts', label: 'Numbers', kind: 'facts' },
      { id: 'check', label: 'Check-in', kind: 'check' },
    ],
  },
  {
    id: 'care', slug: 'boat-care', n: 5, title: 'Boat care, fuel and fire', short: 'Boat care',
    receipt: 'Workbook ch.6 · p.43–46 (+ fire p.65–66, 86–87)', topics: ['maintenance'],
    hook: 'Most rescues are flat batteries, bad fuel and tired motors — all fixed on the trailer.',
    steps: [
      { id: 'when', label: 'When to check', kind: 'lab', lab: 'ScheduleLab' },
      { id: 'cards', label: 'Fuel & fire', kind: 'cards', cards: 'care' },
      { id: 'facts', label: 'Numbers', kind: 'facts' },
      { id: 'check', label: 'Check-in', kind: 'check' },
    ],
  },
  {
    id: 'gear', slug: 'safety-gear', n: 6, title: 'Safety gear by distance', short: 'Safety gear',
    receipt: 'Workbook ch.7 · p.49–63', topics: ['safety'],
    hook: 'Two lines on the water decide your gear: 400 metres and 4 nautical miles.',
    steps: [
      { id: 'distance', label: 'Gear by distance', kind: 'lab', lab: 'GearLab' },
      { id: 'flares', label: 'Flare picker', kind: 'lab', lab: 'FlareLab' },
      { id: 'cards', label: 'Lifejackets, EPIRB, radio', kind: 'cards', cards: 'gear' },
      { id: 'facts', label: 'Numbers', kind: 'facts' },
      { id: 'check', label: 'Check-in', kind: 'check' },
    ],
  },
  {
    id: 'ops', slug: 'safe-operations', n: 7, title: 'Safe operations', short: 'Safe ops',
    receipt: 'Workbook ch.7–8 · p.67–81', topics: ['operations'],
    hook: 'Plan the trip, load it low, carry half again in fuel, and let enough rope out.',
    steps: [
      { id: 'flotation', label: 'Flotation', kind: 'lab', lab: 'FlotationLab' },
      { id: 'scope', label: 'Anchoring scope', kind: 'lab', lab: 'ScopeLab' },
      { id: 'stability', label: 'Stability', kind: 'lab', lab: 'StabilityLab' },
      { id: 'cards', label: 'Weather & tides', kind: 'cards', cards: 'ops' },
      { id: 'facts', label: 'Numbers', kind: 'facts' },
      { id: 'check', label: 'Check-in', kind: 'check' },
    ],
  },
  {
    id: 'sos', slug: 'emergencies', n: 8, title: 'Emergencies', short: 'Emergencies',
    receipt: 'Workbook ch.7, 9 · p.61, 83–89', topics: ['emergencies'],
    hook: 'Mayday is life in danger. Pan Pan is urgent. Sécurité is a warning.',
    steps: [
      { id: 'calls', label: 'Which call?', kind: 'lab', lab: 'CallsLab' },
      { id: 'cards', label: 'Capsize, fire, cold', kind: 'cards', cards: 'sos' },
      { id: 'facts', label: 'Numbers', kind: 'facts' },
      { id: 'check', label: 'Check-in', kind: 'check' },
    ],
  },
  {
    id: 'practical', slug: 'practical', n: 9, title: 'The practical: 11 tasks', short: 'Practical',
    receipt: 'Workbook ch.10 · p.91–112',
    hook: 'On the boat they watch 62 things. You can miss six.',
    steps: [
      { id: 'tasks', label: 'The 11 tasks', kind: 'custom', view: 'Tasks' },
      { id: 'say', label: 'Say it out loud', kind: 'custom', view: 'Scripts' },
      { id: 'drive', label: 'Drive it', kind: 'custom', view: 'Drive' },
    ],
  },
  { id: 'exam', slug: 'exam', n: 10, title: 'Exam room', short: 'Exam room', steps: [] },
  { id: 'cram', slug: 'night-before', n: 11, title: 'Night-before sheet', short: 'Cram sheet', steps: [] },
];

export const levelBySlug = (slug) => LEVELS.find((l) => l.slug === (slug ?? '')) ?? null;
export const levelById = (id) => LEVELS.find((l) => l.id === id) ?? null;
export const STUDY_LEVELS = LEVELS.filter((l) => l.topics);
export const hrefFor = (lv, step) => `/skippers${lv.slug ? `/${lv.slug}` : ''}${step ? `/${step}` : ''}`;

/* ABC's private online course (videos, lessons, quizzes) — the login hadn't
   arrived when this was built. When it does, list its modules here as
   { title, mapsTo: <level id> } and the Start page will show them. */
export const abcCourse = [];
