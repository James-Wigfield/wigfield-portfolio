/* ============================================================================
   BARISTA · CONTENT — every word and every step in the guide
   ----------------------------------------------------------------------------
   Source of truth: Breville's ANZ instruction book for the BES876
   (BES876_ANZ_IB_QA_C22_WEB.pdf, 32 pp., printed page numbers as receipts).
   Rules this file keeps:
     • every procedural line traces to an IB page in its step's `src`
     • nothing invents a button combo, hold time, duration or volume
     • general espresso practice is `{ t, tip: true }` — rendered as a tip
     • estimates are labelled where they're shown (schedule totals)
   Inline markup in any line: [1 CUP] → steel button chip, {25 s} → mono value.
   ========================================================================== */

export const IB_URL = 'https://assets.breville.com/BES876/BES876_ANZ_IB_QA_C22_WEB.pdf';

// Breville's 12 BES876 cleaning videos. en-au where the guide exists there,
// en-us otherwise (both checked 2026-10-17). Video-only pages — linked, never scraped.
const AU = 'https://www.breville.com/en-au/my-products/producthub/bes876/cleaning-guides/';
const US = 'https://www.breville.com/en-us/my-products/producthub/bes876/cleaning-guides/';
export const VIDEOS = {
  cycle: { title: 'Cleaning cycle', url: `${US}how-to-perform-a-cleaning-cycle` },
  portafilter: { title: 'Clean portafilter & basket', url: `${AU}how-to-clean-portafilter-and-filter-basket` },
  screen: { title: 'Clean the shower screen', url: `${AU}how-to-clean-the-shower-screen` },
  dripTray: { title: 'Clean the drip tray', url: `${AU}how-to-clean-the-drip-tray` },
  burrs: { title: 'Clean the conical burrs', url: `${AU}how-to-clean-grinder-conical-burrs` },
  purge: { title: 'Group head purge', url: `${AU}group-head-purge` },
  basketRinse: { title: 'Filter basket rinse', url: `${AU}filter-basket-rinse` },
  wandPurge: { title: 'Steam wand purge', url: `${US}a-steam-wand-purge` },
  filter: { title: 'Replace the water filter', url: `${US}how-to-replace-the-water-filter` },
  descale: { title: 'Descale', url: `${US}how-to-perform-a-descale`, runtime: '2:57' },
  backflush: { title: 'Clear water backflush', url: `${US}how-to-perform-a-clear-water-backflush`, runtime: '0:56' },
  wandUnblock: { title: 'Clean & unblock the steam wand', url: `${AU}cleaning-and-unblocking-the-steam-wand`, runtime: '1:03' },
};

export const SERVICE = { au: '1300 139 798', nz: '0800 273 845', src: 'IB p.32' };

/* ── Tabs ─────────────────────────────────────────────────────────────── */
export const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'why', label: 'Why it gets dirty' },
  { id: 'kit', label: 'The kit' },
  { id: 'routine', label: 'Every day & week' },
  { id: 'deep-clean', label: 'Deep clean' },
  { id: 'fix-it', label: 'Fix-it' },
  { id: 'log', label: 'Restock & log' },
];

/* ── Overview ─────────────────────────────────────────────────────────── */
export const HERO = {
  eyebrow: 'Breville Barista Express Impress · BES876 · ANZ',
  title: 'Six months in. Time for a proper clean.',
  sub: 'Every care job in Breville’s manual, animated, in the order that wastes the least time.',
};

export const LIGHT = {
  off: {
    label: 'Off',
    head: 'Nothing due.',
    body: 'Keep the habits going: wipe and purge the wand, flush before every shot.',
    go: { tab: 'routine', label: 'The daily habits' },
    src: 'IB p.30',
  },
  flash: {
    label: 'Flashing',
    head: 'Flashing means run a cleaning cycle.',
    body: 'One tablet on the cleaning disc in the 1 CUP basket. About 5 minutes.',
    go: { step: 'cycle', label: 'Cleaning cycle steps' },
    src: 'IB p.22 · p.30',
  },
  solid: {
    label: 'Solid',
    head: 'Solid means descale.',
    body: 'One sachet in 1 litre of water. Take the water filter out first.',
    go: { step: 'descale-setup', label: 'Descale steps' },
    src: 'IB p.23 · p.30',
  },
};

/* ── How it gets dirty ────────────────────────────────────────────────── */
export const CAUSES = [
  {
    id: 'scale',
    name: 'Scale',
    where: 'Pipes, Thermocoil, group head',
    line: 'Minerals in tap water drop out where the water gets hot.',
    cost: 'Less flow, lower temperature, less power, worse taste.',
    costSrc: 'IB p.22',
    fixes: [
      { t: 'New water filter every 3 months', src: 'IB p.22', to: { step: 'filter' } },
      { t: 'Descale when the light is solid', src: 'IB p.23', to: { step: 'descale-setup' } },
    ],
  },
  {
    id: 'oils',
    name: 'Coffee oils',
    where: 'Shower screen, group head, baskets',
    line: 'Every shot leaves a film of oil that goes rancid.',
    cost: 'The cleaning cycle exists to keep the brew head clear of it.',
    costSrc: 'IB p.23',
    fixes: [
      { t: 'Rinse basket + portafilter straight after use', src: 'IB p.25', to: { tab: 'routine' } },
      { t: 'Cleaning cycle when the light flashes', src: 'IB p.22', to: { step: 'cycle' } },
    ],
  },
  {
    id: 'milk',
    name: 'Baked milk',
    where: 'Steam wand, tip holes',
    line: 'Milk left on or inside the wand dries into a crust and blocks the tip.',
    cost: 'Blocked holes mean weak or no steam.',
    costSrc: 'IB p.29',
    fixes: [
      { t: 'Wipe + purge after every milk drink', src: 'IB p.19 · p.25', to: { tab: 'routine' } },
      { t: 'Blocked? Pin, then soak the tip', src: 'IB p.25', to: { step: 'tip-off' } },
    ],
  },
  {
    id: 'grounds',
    name: 'Stale grounds',
    where: 'Burrs, chute, cradle, tamp',
    line: 'Old grinds sit in the burrs and chute, and build up round the tamp.',
    cost: 'Stale taste, a hard lever, a rough puck, grinding that stalls.',
    costSrc: 'IB p.15 · p.28 · p.30',
    fixes: [
      { t: 'Purge the grinder before the first coffee', src: 'IB p.15', to: { tab: 'routine' } },
      { t: 'Brush the burrs, chute and tamp', src: 'IB p.24 · p.25', to: { step: 'grinder' } },
    ],
  },
];

export const WATER_PATH = [
  { id: 'tank', label: 'Tank', note: '2 L, cold tap water' },
  { id: 'filter', label: 'Filter', note: 'reduces scale build-up' },
  { id: 'pump', label: 'Pump', note: 'schematic' },
  { id: 'coil', label: 'Thermocoil', note: 'PID-controlled heater' },
  { id: 'out', label: 'Group · wand · hot water', note: 'three outlets' },
];

/* ── The kit (IB p.8 accessory letters) ───────────────────────────────── */
export const KIT = [
  {
    id: 'brush',
    letter: 'L',
    name: 'Cleaning brush',
    job: 'Sweeps grinds off the burrs, the chute, the tamp face and the cradle.',
    src: 'IB p.24 · p.25',
    steps: ['grinder', 'tamp'],
  },
  {
    id: 'tool',
    letter: 'I',
    name: 'Steam wand tool',
    job: 'The pin clears blocked holes in the wand tip and the baskets. Its spanner unscrews the tip.',
    src: 'IB p.25',
    steps: ['tip-off', 'tip-on', 'basket-rinse'],
  },
  {
    id: 'disc',
    letter: 'J',
    name: 'Cleaning disc',
    job: 'Sits in the 1 CUP basket under the tablet, so the cleaning cycle can back-flush.',
    src: 'IB p.22',
    steps: ['cycle', 'cycle-rinse'],
  },
  {
    id: 'tablets',
    letter: 'F',
    name: 'Cleaning tablets',
    job: 'One per cleaning cycle. One dissolved in hot water soaks the baskets.',
    src: 'IB p.22 · p.25',
    steps: ['cycle', 'soak'],
  },
  {
    id: 'sachet',
    letter: 'K',
    name: 'Descaling powder',
    job: 'One sachet, fully dissolved in 1 litre of water, per descale.',
    src: 'IB p.23',
    steps: ['descale-setup'],
  },
  {
    id: 'allen',
    letter: 'H',
    name: 'Allen key',
    job: 'Its short end turns the shower-screen screw counter-clockwise to release it.',
    src: 'IB p.26',
    steps: ['screen'],
  },
  {
    id: 'razor',
    letter: 'G',
    name: 'The Razor',
    job: 'Trims an over-dosed puck level. A dosing tool, not a cleaning one.',
    src: 'IB p.15',
    steps: [],
  },
  {
    id: 'filter',
    letter: 'C',
    name: 'Filter + holder',
    job: 'Soak 5 min, rinse 5 s, set the date dial 3 months ahead, push onto the post.',
    src: 'IB p.9 · p.22',
    steps: ['filter'],
  },
];

/* ── Every day & week ─────────────────────────────────────────────────── */
export const HABITS = [
  {
    id: 'wand',
    name: 'After every milk drink',
    lines: [
      'Wipe the wand with a damp cloth.',
      'Tip over the drip tray, turn the dial to STEAM briefly.',
      'That blast clears milk from inside the wand.',
    ],
    note: 'This is the habit that stops the dried milk you have now.',
    src: 'IB p.19 · p.25',
    video: 'wandPurge',
  },
  {
    id: 'flush',
    name: 'Before every shot',
    lines: [
      'Press [1 CUP] for a short flow, portafilter out.',
      'It purges old grounds and steadies the temperature.',
      'Wipe grinds off the basket rim, then lock in.',
    ],
    note: 'Ten seconds that keep the shower screen cleaner.',
    src: 'IB p.16',
    video: 'purge',
  },
];

export const RHYTHM = [
  {
    id: 'milk',
    freq: 'Every milk drink',
    lines: ['Wipe the wand, then purge it with a brief blast of steam.'],
    src: 'IB p.19 · p.25',
    hot: true,
  },
  {
    id: 'coffee',
    freq: 'Every coffee',
    lines: [
      '[1 CUP] short flow before the portafilter goes in.',
      'Rinse the basket and portafilter under hot water straight after.',
    ],
    src: 'IB p.16 · p.25',
    video: { key: 'backflush', t: 'Breville also suggests a clear water backflush after each coffee session — the steps are in its video.' },
  },
  {
    id: 'daily',
    freq: 'Daily',
    lines: [
      'Fresh cold tap water in the tank.',
      'Before the first coffee, hold [DOSE] to purge stale grinds.',
      'Empty the drip tray when its full indicator floats.',
    ],
    src: 'IB p.11 · p.15 · p.25',
  },
  {
    id: 'weekly',
    freq: 'Weekly',
    lines: ['The weekly ritual below — about ten minutes.'],
    src: 'This guide’s rhythm · IB p.25–26',
    guide: true,
  },
  {
    id: 'flash',
    freq: 'Light flashes',
    lines: ['Cleaning cycle with a tablet.', { t: 'Brush the burrs the same day.', tip: true }],
    src: 'IB p.22 · p.24',
  },
  {
    id: 'filter',
    freq: 'Every 3 months',
    lines: ['New water filter. Sooner in a hard-water area.'],
    src: 'IB p.22',
  },
  {
    id: 'solid',
    freq: 'Light solid',
    lines: ['Descale with one sachet in 1 litre.'],
    src: 'IB p.23',
  },
  {
    id: 'deep',
    freq: 'Six-monthly',
    lines: ['The full deep clean, every job in one optimised session.'],
    src: 'This guide',
    guide: true,
  },
];

export const WEEKLY = [
  { id: 'tray', t: 'Drip tray + storage tray', d: 'Grid off, separator out, warm soapy water. Wipe the storage tray.', src: 'IB p.25', anim: 'tray' },
  { id: 'screen', t: 'Shower screen + purge', d: 'Damp cloth round the screen. Empty basket in, hold [1 CUP] briefly.', src: 'IB p.25', anim: 'screen' },
  { id: 'baskets', t: 'Baskets + portafilter', d: 'Hot rinse. Pin any blocked hole.', src: 'IB p.25', anim: 'basket' },
  { id: 'wand', t: 'Steam wand check', d: 'Wipe the whole wand. Machine off and cool, pin each tip hole.', src: 'IB p.25', anim: 'wand' },
  { id: 'tamp', t: 'Tamp area brush', d: 'Cover off, brush the face and cradle, lever down, brush, release slowly.', src: 'IB p.25', anim: 'brush' },
  { id: 'housing', t: 'Outer housing', d: 'Soft damp cloth, then polish with a dry one.', src: 'IB p.26', anim: 'shine' },
  { id: 'burrs', t: 'Burr brush', d: 'Only if the light flashed this week.', src: 'IB p.24', anim: 'brush', optional: true },
];

/* ── Six-month deep clean ─────────────────────────────────────────────────
   One object per player step. `id` matches schedule.js `step`. Their order
   in the player comes from the computed schedule, not from this array.     */
export const STEPS = [
  {
    id: 'setup',
    title: 'Cold start',
    kicker: 'Off, unplugged, cold',
    scene: 'setup',
    lines: [
      'Press [POWER] off, set the dial to STANDBY and unplug.',
      'Let it cool fully before you touch the group head or wand.',
      'Empty the drip tray and slide it back in.',
      'Lay out the brush, wand tool, Allen key, disc, tablets and sachet.',
      'Boil the kettle. The cloth and the soaks need hot water.',
      { t: 'Start before your first coffee of the day, so it’s already cold.', tip: true },
    ],
    safety: [
      { tone: 'power', label: 'Unplug first', t: 'Switch off and unplug before cleaning.', src: 'IB p.3' },
      { tone: 'hot', label: 'Burn hazard', t: 'Steam can still release after switch-off.', src: 'IB p.19' },
    ],
    why: [
      'Breville asks for the machine to be off, unplugged and cool before it’s cleaned.',
      'The first four jobs touch the group head, the wand and the burrs, so they go first while it’s cold.',
    ],
    src: ['IB p.3', 'IB p.25'],
    video: 'dripTray',
    kit: ['brush', 'tool', 'allen', 'disc', 'tablets', 'sachet'],
  },
  {
    id: 'wrap',
    title: 'Wrap the steam wand',
    kicker: 'Soften the dried milk',
    scene: 'wand-wrap',
    lines: [
      'Check the dial is on STANDBY and the wand is cool.',
      { t: 'Soak a cloth in very hot water and wrap it round the wand.', tip: true },
      { t: 'Leave it 2–3 minutes. Do the shower screen meanwhile.', tip: true },
    ],
    safety: [{ tone: 'hot', label: 'Hot water', t: 'Wring the cloth carefully — kettle water scalds.', tip: true }],
    why: [
      'Breville’s fix for a blocked tip is the pin, then a hot-water soak of the tip.',
      'The warm cloth is general practice for crust on the outside of the wand, so it’s labelled a tip.',
    ],
    timers: [
      {
        id: 'cloth',
        label: 'Hot cloth',
        sec: 180,
        tip: true,
        bg: true,
        see: [
          [0, 'Cloth wrapped right round the wand, tip included.'],
          [60, 'Heat is soaking into the crust.'],
          [120, 'From two minutes the crust should wipe off.'],
        ],
      },
    ],
    src: ['IB p.25'],
    video: 'wandUnblock',
    kit: [],
  },
  {
    id: 'screen',
    title: 'Shower screen out and washed',
    kicker: 'The Allen key job',
    scene: 'screen',
    lines: [
      'Lift out the water tank and drip tray. Careful if they’re full.',
      'Clean the centre of the screw with a skewer.',
      'Short end of the Allen key in. Turn counter-clockwise to loosen.',
      'Keep the screw and screen. Note which side faces down.',
      'Wash the screen in warm soapy water and dry it. Wipe the group head.',
      'Refit screen and screw: 2–3 finger turns clockwise, then the key until flush.',
      'Put the drip tray and tank back.',
    ],
    safety: [{ tone: 'power', label: 'Unplugged', t: 'Off and unplugged before the key goes in.', src: 'IB p.26' }],
    branches: [
      {
        id: 'seal',
        q: 'Seal hard or cracked, or water leaks round the portafilter?',
        tip: true,
        a: [
          'Pull the old seal out with fingers or long-nose pliers.',
          'Fit the new seal flat side first, ribbed side facing you.',
        ],
        none: 'No spare seal? Refit as normal and add one to the restock list.',
        src: 'IB p.26',
      },
    ],
    why: [
      'Coffee oil and fines collect behind the screen where a wipe can’t reach.',
      'Breville gives this procedure under “Using the Allen key”; doing it every six months is this guide’s schedule.',
      'Noting the down side makes the screen go back the right way.',
    ],
    src: ['IB p.25', 'IB p.26', 'IB p.27'],
    video: 'screen',
    kit: ['allen'],
  },
  {
    id: 'tip-off',
    title: 'Wand tip off, into the soak',
    kicker: 'Pin, spanner, cup',
    scene: 'tip-off',
    lines: [
      { t: 'Unwrap the cloth and wipe the softened milk off.', tip: true },
      'Push the tool’s pin into each hole in the tip.',
      'Unscrew the tip with the tool’s spanner.',
      'Drop the tip into a cup of hot water. It soaks while you do the grinder.',
    ],
    safety: [{ tone: 'hot', label: 'Cool first', t: 'Dial on STANDBY, machine off and cool.', src: 'IB p.25' }],
    why: [
      'Breville removes and soaks the tip when a hole stays blocked after the pin.',
      'With visible dried milk, the deep clean soaks it anyway. The IB gives no soak time, so the timer just counts up.',
    ],
    timers: [
      {
        id: 'tip-soak',
        label: 'Tip soak',
        kind: 'elapsed',
        bg: true,
        see: [[0, 'Tip in the cup. Carry on with the grinder.']],
      },
    ],
    src: ['IB p.25'],
    video: 'wandUnblock',
    kit: ['tool'],
  },
  {
    id: 'grinder',
    title: 'Empty and brush the grinder',
    kicker: 'Hopper, burrs',
    scene: 'grinder',
    lines: [
      'Plug in, [POWER] on. Unlock the hopper; tip the beans into a container.',
      'Lock the hopper back on.',
      'Portafilter in the cradle. Hold [DOSE] until the grinder runs empty.',
      'Tip out the grinds. [POWER] off and unplug.',
      'Unlock and lift off the hopper. Unlock the top burr; lift it by its wire handle.',
      'Brush the top burr, then the lower burr.',
    ],
    safety: [
      { tone: 'sharp', label: 'Sharp burrs', t: 'The burrs are extremely sharp.', src: 'IB p.24' },
      { tone: 'care', label: 'Leave the ring', t: 'Don’t turn the number ring on the top burr — it shifts the grind range.', src: 'IB p.20' },
    ],
    why: [
      'Brushing keeps grinding consistent.',
      'Holding DOSE purges: the grind starts after half a second and stops when you let go.',
    ],
    src: ['IB p.15', 'IB p.20', 'IB p.24'],
    video: 'burrs',
    kit: ['brush'],
  },
  {
    id: 'tamp',
    title: 'Chute and tamp',
    kicker: 'Cover off, lever down',
    scene: 'tamp',
    lines: [
      'Pull off the tamp cover. Brush the chute, the tamp face and the cradle.',
      'Push the lever down and hold it. Brush in and around the tamp.',
      'Let the lever up slowly, brush clear of the tamp.',
      'Refit the tamp cover.',
      'Top burr in and locked. Hopper on and locked. Beans back in.',
    ],
    safety: [{ tone: 'sharp', label: 'Fingers out', t: 'Keep fingers out of the tamping chute when the lever moves.', src: 'IB p.4' }],
    why: [
      'Build-up here makes the lever very hard to push and leaves the puck rough.',
      'The top burr’s wire handle goes back in from both sides before it locks.',
    ],
    src: ['IB p.20', 'IB p.24', 'IB p.25', 'IB p.30'],
    video: 'burrs',
    kit: ['brush'],
  },
  {
    id: 'soak',
    title: 'Start the basket soak',
    kicker: 'Second tablet',
    scene: 'soak-start',
    lines: [
      'Dissolve a cleaning tablet in a bowl of hot water.',
      'Sink all four baskets and the portafilter into it.',
      { t: 'Keep the portafilter handle out of the water.', tip: true },
      'Leave them about {20 min}. The timer runs in the bar below.',
    ],
    why: [
      'Breville gives this soak for basket holes the pin can’t clear.',
      'The deep clean uses it as a reset, timed to finish during the descale.',
      'It starts after the grinder because the grinder needed the portafilter.',
    ],
    timers: [
      {
        id: 'basket-soak',
        label: 'Basket soak',
        sec: 1200,
        bg: true,
        see: [
          [0, 'Tablet dissolving. Baskets and portafilter head under.'],
          [300, 'Oils lifting. Carry on with the descale.'],
          [1140, 'Nearly there. Rinse is next.'],
        ],
      },
    ],
    src: ['IB p.25'],
    video: 'portafilter',
    kit: ['tablets'],
  },
  {
    id: 'tip-on',
    title: 'Wand tip back on',
    kicker: 'Before anything gets hot',
    scene: 'tip-on',
    lines: [
      'Lift the tip out of the soak.',
      'Pin each hole again with the tool.',
      'Screw the tip back onto the wand.',
    ],
    why: [
      'The descale runs steam through the wand, so the tip has to be on first.',
      'It’s the last cold job.',
    ],
    stopsTimer: 'tip-soak',
    src: ['IB p.25'],
    video: 'wandUnblock',
    kit: ['tool'],
  },
  {
    id: 'descale-setup',
    title: 'Descale: set up',
    kicker: 'Filter out, sachet in',
    scene: 'descale-setup',
    lines: [
      'Lift out the tank and take the water filter out.',
      'Dissolve one sachet fully in {1 L} of water.',
      'Pour it into the tank and seat the tank.',
      'Plug in. With the machine off, hold [2 CUP] + [POWER] for {5 s}.',
      '[POWER] and [2 CUP] flash while it heats.',
      'Ready when POWER, 2 CUP, CLEAN/DESCALE and HOT WATER/STEAM are all solid.',
    ],
    hold: { keys: ['2 CUP', 'POWER'], sec: 5, after: 'descale' },
    safety: [{ tone: 'water', label: 'No bottled water', t: 'Bottled water can leave deposits.', src: 'IB p.23' }],
    why: [
      'The filter would soak up the descaler, so it comes out first.',
      'Dissolve the powder completely before it goes in.',
    ],
    src: ['IB p.23'],
    video: 'descale',
    kit: ['sachet'],
  },
  {
    id: 'descale-rounds',
    title: 'Descale: the rounds',
    kicker: 'Coffee · steam · hot water',
    scene: 'descale-rounds',
    lines: [
      'Jug under the group head. Press [2 CUP]: about {25 s}.',
      'Jug under the wand. Dial RIGHT to steam: about {13 s}.',
      'Jug under the hot water outlet. Dial LEFT: about {8 s}.',
      'One round leaves about {0.5 L} in the tank.',
      'Repeat rounds until the solution is down to MIN.',
      'Never lift the tank out mid-round. It only comes out for the rinse.',
      { t: 'Empty the jug and drip tray between legs as they fill.', tip: true },
    ],
    safety: [{ tone: 'hot', label: 'Hot', t: 'Steam and hot water come out near 90 °C.', src: 'IB p.18' }],
    why: [
      'The manual says to run rounds until the solution is used, but also not to empty the tank mid-descale, and the machine stops below MIN.',
      'So: run rounds down to MIN, and only lift the tank out at the rinse.',
      'Turning the dial back to STANDBY ends a steam or water leg early.',
    ],
    timers: [{ id: 'rounds', kind: 'rounds', label: 'Descale round' }],
    src: ['IB p.10', 'IB p.23', 'IB p.26'],
    video: 'descale',
    kit: [],
  },
  {
    id: 'descale-rinse',
    title: 'Descale: rinse',
    kicker: 'Fresh 2 L, same rounds',
    scene: 'descale-rinse',
    lines: [
      'Lift out the tank. Rinse it well; fill with fresh cold water to MAX, {2 L}.',
      'Move quickly: {5 min} with no action and it switches off.',
      'Run the same rounds again with the fresh water.',
      'Switched off? Re-enter with [2 CUP] + [POWER] for {5 s}.',
      'Press [POWER] to finish. The lights go off.',
      'Spare filter? Drop it into cold water now. It needs {5 min}.',
    ],
    branches: [
      {
        id: 'no-filter',
        q: 'No spare filter?',
        a: ['Skip the soak and the next step. Fill the tank and carry on.'],
        none: 'Add filters to the restock list.',
        src: 'IB p.22',
      },
    ],
    why: [
      'The rinse flushes the last of the solution out of every path.',
      'The manual doesn’t give a number of rinse rounds. The counter just tracks them.',
    ],
    timers: [
      { id: 'rinse-rounds', kind: 'rounds', label: 'Rinse round' },
      {
        id: 'filter-soak',
        label: 'Filter soak',
        sec: 300,
        bg: true,
        see: [
          [0, 'Filter under cold water.'],
          [240, 'One minute to go.'],
        ],
      },
    ],
    src: ['IB p.22', 'IB p.23'],
    video: 'descale',
    kit: ['filter'],
  },
  {
    id: 'filter',
    title: 'New water filter',
    kicker: 'Soaked, rinsed, dated',
    scene: 'filter',
    liveFrom: 'filter-soak',
    lines: [
      'Rinse the soaked filter under cold running water for {5 s}.',
      'Clip it into the filter holder.',
      'Turn the date dial {3 months} ahead, to {MONTH}.',
      'Align the holder with the post in the tank and push down to lock.',
      'Fill the tank with cold tap water and seat it.',
    ],
    safety: [{ tone: 'water', label: 'Tap water', t: 'Not highly filtered, demineralised or distilled.', src: 'IB p.11' }],
    branches: [
      {
        id: 'no-filter',
        q: 'No spare filter?',
        a: ['Skip this step. Fill the tank and carry on.'],
        none: 'Breville says a fresh filter every 3 months cuts the need to descale.',
        src: 'IB p.9',
      },
    ],
    why: [
      'A filter changed every three months reduces how often the machine needs a descale.',
      'In a hard-water area, change it more often.',
    ],
    src: ['IB p.9', 'IB p.10', 'IB p.22'],
    video: 'filter',
    kit: ['filter'],
  },
  {
    id: 'basket-rinse',
    title: 'Finish the basket soak',
    kicker: 'Rinse, pin',
    scene: 'soak-finish',
    lines: [
      'Lift the baskets and portafilter out and rinse them thoroughly.',
      'Clear any hole that’s still blocked with the pin.',
    ],
    why: ['The cleaning cycle needs the 1 CUP basket and the portafilter next.'],
    src: ['IB p.25'],
    video: 'basketRinse',
    kit: ['tool'],
  },
  {
    id: 'cycle',
    title: 'Cleaning cycle',
    kicker: 'Disc, tablet, back-flush',
    scene: 'cycle',
    lines: [
      'Tank full of cold water, drip tray empty.',
      '1 CUP basket in the portafilter, then the disc, then one tablet.',
      'Lock the portafilter in. Large container under the spouts.',
      'Press [POWER] to switch off.',
      'Hold [1 CUP] + [2 CUP] + [POWER] for {3 s}.',
      'It runs about {5 min}. No water should come through the portafilter.',
      'Meanwhile: wipe the housing with a soft damp cloth, then polish dry.',
    ],
    hold: { keys: ['1 CUP', '2 CUP', 'POWER'], sec: 3, after: 'cycle' },
    why: [
      'It’s a back-flush: water pulses into the portafilter, dissolves the tablet and flushes back into the group head.',
      'It’s separate from descaling.',
    ],
    timers: [
      {
        id: 'cycle',
        label: 'Cleaning cycle',
        sec: 300,
        see: [
          [0, 'Water pulsing into the portafilter.'],
          [60, 'Tablet fizzing and dissolving on the disc.'],
          [150, 'Flushing back into the group head. Nothing from the spouts.'],
          [270, 'Last pulses.'],
        ],
      },
    ],
    src: ['IB p.22', 'IB p.26'],
    video: 'cycle',
    kit: ['disc', 'tablets'],
  },
  {
    id: 'cycle-rinse',
    title: 'Check and rinse',
    kicker: 'Tablet gone?',
    scene: 'cycle-rinse',
    lines: [
      'Remove the portafilter. Is the tablet completely dissolved?',
      'Take the disc out and lock the portafilter back in.',
      'Container under the spouts. Press [2 CUP] to rinse the brew head.',
      'Wipe any splashes with a soft dry cloth.',
    ],
    branches: [
      {
        id: 'tablet',
        q: 'Tablet not fully dissolved?',
        a: ['Lock it back in with the same tablet and repeat from [POWER] off.'],
        none: 'It doesn’t need a new tablet.',
        src: 'IB p.22',
        to: 'cycle',
      },
    ],
    why: ['The rinse clears cleaning solution from the brew head before your next coffee.'],
    src: ['IB p.22'],
    video: 'cycle',
    kit: ['disc'],
  },
  {
    id: 'finish',
    title: 'Finish and log',
    kicker: 'Trays, purge, done',
    scene: 'finish',
    lines: [
      'Empty basket in, lock in, hold [1 CUP] for a short flow.',
      'Drip tray out: grid off, lift the grounds separator, empty it.',
      'Pull the full indicator up to release its side latches.',
      'Wash every part in warm soapy water. Rinse, dry thoroughly.',
      'Wipe the storage tray with a soft damp cloth.',
      { t: 'Pull one shot and pour it away before your first drink.', tip: true },
    ],
    safety: [{ tone: 'care', label: 'Hand-wash', t: 'No dishwasher, no abrasive pads.', src: 'IB p.25–26' }],
    why: ['Logging writes today into the care log, so the status gauges reset.'],
    src: ['IB p.25', 'IB p.26'],
    video: 'dripTray',
    kit: [],
  },
];

export const DESCALE_LEGS = [
  { id: 'coffee', label: 'Coffee path', sec: 25, chip: '2 CUP', dial: 'standby', where: 'Jug under the group head.', see: 'Solution running from the group head.' },
  { id: 'steam', label: 'Steam', sec: 13, dial: 'right', where: 'Jug under the wand. Dial RIGHT.', see: 'Steam and solution spluttering from the tip.' },
  { id: 'water', label: 'Hot water', sec: 8, dial: 'left', where: 'Jug under the hot water outlet. Dial LEFT.', see: 'Solution from the hot water outlet.' },
];

/* ── Fix-it ───────────────────────────────────────────────────────────── */
export const SYMPTOMS = [
  {
    id: 'no-steam',
    q: 'No steam, or a weak splutter',
    scene: 'wand',
    causes: [
      { c: 'Steam wand blocked', fix: 'Off and cool, pin the holes. Still blocked: tip off with the spanner, soak in hot water, pin, refit.', src: 'IB p.25 · p.29', to: { step: 'tip-off' } },
      { c: 'Water tank empty', fix: 'Fill the tank.', src: 'IB p.29' },
      { c: 'Machine still heating up', fix: 'Purge the wand before texturing.', src: 'IB p.29' },
    ],
  },
  {
    id: 'grind',
    q: 'Won’t grind, or grinds for ages',
    scene: 'advanced',
    causes: [
      { c: 'Chute blocked', fix: 'Brush the chute.', src: 'IB p.28', to: { step: 'tamp' } },
      { c: 'Grind very fine', fix: 'Clean out the grinder.', src: 'IB p.28', to: { step: 'grinder' } },
      { c: 'Hopper not locked', fix: 'FILTER lights flash single/double. Seat and lock the hopper.', src: 'IB p.21 · p.28' },
      { c: 'Lever not fully up', fix: 'The tamp blocks the chute. Raise the lever to home.', src: 'IB p.28' },
      { c: 'Build-up stops the portafilter going in', fix: 'Brush the grinding cradle.', src: 'IB p.28' },
      { c: 'Blockage between burrs and outlet', fix: 'The advanced grinder clean, below.', src: 'IB p.24', advanced: true },
    ],
  },
  {
    id: 'lever',
    q: 'Tamp lever very hard to push',
    scene: 'tamp',
    causes: [
      { c: 'Coffee build-up in the mechanism', fix: 'Tamp cover off, clean with the brush.', src: 'IB p.30', to: { step: 'tamp' } },
      { c: 'Severe overdose', fix: 'Trim with the Razor. Check the filter size.', src: 'IB p.30' },
    ],
  },
  {
    id: 'puck',
    q: 'Puck surface not flat',
    scene: 'tamp',
    causes: [
      { c: 'Grinds stuck on the tamp face', fix: 'Tamp cover off, clean with the brush.', src: 'IB p.30', to: { step: 'tamp' } },
      { c: 'Loose grounds on top', fix: 'Tamp again, or push the lever down slower.', src: 'IB p.30' },
    ],
  },
  {
    id: 'no-flow',
    q: 'No water from the group head',
    scene: 'tank',
    causes: [
      { c: 'Tank empty or below MIN', fix: 'Fill it. Below MIN the machine won’t run.', src: 'IB p.10 · p.28' },
      { c: 'Tank not pushed in and locked', fix: 'Push the tank in fully.', src: 'IB p.28' },
      { c: 'Machine too hot', fix: 'Turn it off, wait 30–60 minutes, turn it back on.', src: 'IB p.28' },
      { c: 'Not up to temperature', fix: 'Give it time to heat.', src: 'IB p.28' },
    ],
  },
  {
    id: 'leak',
    q: 'Leaks round the portafilter, or it locks in loosely',
    scene: 'seal',
    tip: true,
    causes: [
      { c: 'Worn shower-screen seal', fix: 'Replace the silicone seal with the Allen-key procedure.', src: 'IB p.26–27 · trigger is a tip', to: { step: 'screen' } },
    ],
  },
  {
    id: 'hot-water',
    q: 'Hot water stops and starts',
    scene: 'tank',
    causes: [{ c: 'Too hot after steaming', fix: 'Let it cool down.', src: 'IB p.30' }],
  },
  {
    id: 'beans',
    q: 'DOSE lights flash red, three beeps',
    scene: 'tank',
    causes: [{ c: 'Low on beans', fix: 'Add beans to the hopper.', src: 'IB p.21' }],
  },
];

export const ADVANCED = [
  {
    id: 'apart',
    title: 'Take it apart',
    lines: [
      'Remove the hopper. Set GRIND SIZE to {1}.',
      '{10 mm} socket: turn clockwise to loosen the nut only.',
      'Set GRIND SIZE to {25}. Unlock and remove the top burr.',
      'Remove the nut, spring washer and flat washer.',
      'Carefully lift out the lower burr.',
      'Long-nose pliers: grind fan, metal washer, felt washer out.',
    ],
    dial: 25,
  },
  {
    id: 'clear',
    title: 'Clear the blockage',
    lines: [
      'Unblock the exit chute with the brush or a pipe cleaner.',
      'Tamp cover off. Brush the chute. Cover back on.',
    ],
    dial: 25,
  },
  {
    id: 'rebuild',
    title: 'Rebuild',
    lines: [
      'Pliers: felt washer, then metal washer, then grind fan.',
      'Lower burr in: line up the drive pin with its cavity.',
      'Flat washer, then spring washer.',
      'Turn the nut counter-clockwise to tighten.',
    ],
    dial: 25,
  },
  {
    id: 'close',
    title: 'Close up',
    lines: [
      'Insert and lock the top burr.',
      'Set GRIND SIZE to {16}.',
      'Hopper on and locked.',
      'Re-dial your shot. {16} is Breville’s suggested starting point.',
    ],
    dial: 16,
  },
];

/* ── Restock & log ────────────────────────────────────────────────────── */
export const DONTS = [
  { t: 'Put any part in the dishwasher.', src: 'IB p.26' },
  { t: 'Use abrasive cleansers, pads or cloths.', src: 'IB p.25–26' },
  { t: 'Use alkaline cleaning agents. Soft cloth, mild detergent.', src: 'IB p.5 · p.26' },
  { t: 'Fill the tank with highly filtered, demineralised or distilled water.', src: 'IB p.11' },
  { t: 'Fill the tank with hot water.', src: 'IB p.5' },
  { t: 'Descale with bottled water, or with the filter in the tank.', src: 'IB p.23' },
  { t: 'Lift the tank out mid-descale (the rinse step aside).', src: 'IB p.26' },
  { t: 'Immerse the cord, plug or machine.', src: 'IB p.5' },
  { t: 'Turn the top burr’s number ring while cleaning.', src: 'IB p.20' },
  { t: 'Put fingers in the tamping chute.', src: 'IB p.4' },
  { t: 'Wet the burrs. Breville’s method is the brush.', src: 'IB p.24', tip: true },
];

export const RESTOCK = [
  {
    id: 'tablets',
    name: 'Cleaning tablets',
    use: 'One per cleaning cycle, one per basket soak. A repeat cycle reuses the same tablet.',
    deep: 2,
    src: 'IB p.22 · p.25',
  },
  {
    id: 'sachets',
    name: 'Descaling powder',
    use: 'One sachet per descale.',
    deep: 1,
    src: 'IB p.23',
  },
  {
    id: 'filters',
    name: 'Water filters',
    use: 'One every 3 months. Spares on hand, not counting the one fitted.',
    deep: 1,
    src: 'IB p.22',
  },
  {
    id: 'seals',
    name: 'Shower-screen seal',
    use: 'Only when it’s worn. Breville customer service supplies them.',
    deep: 0,
    src: 'IB p.27',
  },
];

export const STORING = [
  'Press [POWER] off, dial to STANDBY, switch off at the wall and unplug.',
  'Take the unused beans out of the hopper and clean the grinder.',
  'Empty the water tank and the drip tray.',
  'Make sure it’s cool, clean and dry.',
  'Accessories into position or into the storage tray.',
  'Store it upright, with nothing on top.',
];
