import { useEffect, useState } from 'react';
import Icon from '../../icons';
import './america.css';

/* ============================================================================
   AMERICA — FIRST PLAN  (America section)
   ----------------------------------------------------------------------------
   TWO draft itineraries for James + Justin's Dec 2026 – Jan 2027 North America
   trip, both anchored to the parents' booked Calgary window (22 Dec – 2 Jan,
   see Documents/travel/parent-itinerary.md) — the lads share the Banff lodge
   leg 22–28 Dec, then the plans diverge:

     PLAN A · Snow → Neon → Canyons → City
       Vegas NYE (America's Party) → southwest canyon loop → January NYC.
     PLAN B · Snow → Bass → Texas → PCH
       Lights All Night in Dallas (2-day EDM festival, NYE countdown) → Texas
       road trip (Austin · San Antonio · South Padre + Starbase · Big Bend) →
       fly El Paso → LA → Pacific Coast Highway → San Francisco. Miami was
       weighed and parked (see the Overview call card).

   Everything is data-driven off the PLANS object below; a top switcher picks
   the active plan and the six tabs re-render from it. The route maps are
   hand-projected SVG (equirectangular, x=(lon+126)·8.3, y=(53−lat)·10.5);
   phase colours are validated per theme with the dataviz six-checks script
   and every phase mark carries a text label, so nothing is colour-alone.
   ========================================================================== */

const PROJECT = {
  tag: 'America · First Plan',
  title: 'One window, two ways to run it',
  phase: 'Draft v2 · Plan A + Plan B',
};

const VIEWS = ['Overview', 'Route Map', 'Day by Day', 'NYE Showdown', 'Budget', 'Playbook'];

/* ── Shared geography ────────────────────────────────────────────────────── */
const US_OUTLINE =
  'M10.8 48.3 L15.8 64.1 L16.2 88.2 L13.7 115.5 L13.3 132.3 L18.3 142.8 L29.1 159.6 ' +
  'L34 172.2 L44.8 193.2 L63.1 201.6 L73.9 215.3 L93.8 213.2 L123.7 227.9 L147.7 223.1 ' +
  'L161.9 222.6 L175.1 235.2 L190.1 252 L204.2 243.6 L220 267.8 L239.9 284.6 L239 266.7 ' +
  'L244.9 258.3 L258.2 248.9 L282.2 246.8 L298 251 L307.1 249.9 L315.4 238.4 L337 242.6 ' +
  'L348.6 240.5 L359.4 252 L359.4 265.7 L366.9 281.4 L372.7 291.9 L381 285.6 L381 270.9 ' +
  'L377.7 256.2 L371 237.3 L375.2 219.5 L391 202.7 L400.1 197.4 L419.2 186.9 L415 173.3 ' +
  'L415.8 167 L423.3 153.3 L424.1 144.9 L431.6 131.3 L445.7 126 L456.5 120.8 L460.7 117.6 ' +
  'L457.3 111.3 L459 104 L465.6 96.6 L477.3 90.3 L489.7 86.1 L483.1 62 L471.4 58.3 ' +
  'L462.4 74.6 L452.4 84 L425 84 L411.7 93.5 L390.9 101.9 L389.7 106.1 L377.7 112.4 ' +
  'L356.1 115.5 L361.1 105 L352.8 80.9 L342.8 68.3 L319.6 53.6 L303 52.5 L286.4 51.5 ' +
  'L269.8 46.2 L256.1 42 L23.2 42 Z';

// The Calgary chapter is identical in both plans.
const SNOW_STOPS = [
  {
    id: 'calgary', name: 'Calgary', phase: 'snow', x: 99, y: 20.5,
    stay: 'D1–D3 · 2 hostel nights', lab: { x: 106.5, y: 24, a: 'start' },
    hits: [
      'Land 20 Dec, cheap hostel downtown, sleep off the flight',
      'Meet the parents at YYC on the 22nd — Costco run, then out to the lodge',
      'Back through on the 28th for the flight south',
    ],
  },
  {
    id: 'banff', name: 'Banff', phase: 'snow', x: 86.6, y: 19.1,
    stay: 'D3–D9 · 6 lodge nights', lab: { x: 79, y: 17, a: 'end' },
    hits: [
      'Four ski days — Sunshine Village + Lake Louise combo ticket',
      'Christmas Day at the lodge, skate on frozen Lake Louise',
      'Banff Upper Hot Springs après, Banff Ave pubs after dark',
    ],
  },
];

const SNOW_DAYS = [
  { d: 1, date: 'Sun 20 Dec', phase: 'snow', title: 'Wheels up', bed: 'Hostel · Calgary',
    plan: ['PER → Calgary via LAX or Vancouver', 'Two movies deep, zero sleep, land late'] },
  { d: 2, date: 'Mon 21 Dec', phase: 'snow', title: 'Calgary warm-up', bed: 'Hostel · Calgary',
    plan: ['Sleep off the flight, big diner breakfast', 'Gear shops: gloves, thermals, goggles'] },
  { d: 3, date: 'Tue 22 Dec', phase: 'snow', title: 'The fam lands', bed: 'Lodge · Banff',
    plan: ['Meet the parents at YYC', 'Costco run for the lodge, drive out to Banff'] },
  { d: 4, date: 'Wed 23 Dec', phase: 'snow', title: 'Ski day one', bed: 'Lodge · Banff',
    plan: ['First lifts at Sunshine Village', 'Après on Banff Ave'] },
  { d: 5, date: 'Thu 24 Dec', phase: 'snow', title: 'Lake Louise', bed: 'Lodge · Banff',
    plan: ['Front bowls all day', 'Christmas Eve dinner at the lodge'] },
  { d: 6, date: 'Fri 25 Dec', phase: 'snow', title: 'Christmas', bed: 'Lodge · Banff',
    plan: ['Lazy lodge morning, presents', 'Skate on frozen Lake Louise', 'Banff Upper Hot Springs at dusk'] },
  { d: 7, date: 'Sat 26 Dec', phase: 'snow', title: 'Ski day three', bed: 'Lodge · Banff',
    plan: ['Boxing Day back at Sunshine', 'Delirium Dive if it’s open and the legs allow'] },
  { d: 8, date: 'Sun 27 Dec', phase: 'snow', title: 'Last lifts', bed: 'Lodge · Banff',
    plan: ['Lake Louise back bowls', 'Farewell dinner with the family'] },
];

const LOOP_PATH_INSET = 'M55 88 L73 79 L117 50 L140 36 L161 61 L141 92 L120 119 L66 94 Z';

/* ══════════════════════════════════════════════════════════════════════════
   PLAN A — Snow → Neon → Canyons → City
   ══════════════════════════════════════════════════════════════════════════ */
const PLAN_A = {
  id: 'a',
  name: 'Plan A',
  tagline: 'Snow → Neon → Canyons → City',
  sub: 'Vegas NYE · canyon loop · January NYC',
  thesis:
    '26 days, four chapters. Christmas powder in Banff with the family, peel off on the 28th for ' +
    'New Year’s Eve on the Las Vegas Strip, a 1,500 km canyon loop through Zion – Bryce – Antelope – ' +
    'Grand Canyon in a hire car, and a January week of Knicks, comedy and dive bars in New York.',
  defaultStop: 'vegas',
  defaultNye: 'vegas',
  lsKey: 'amx-first-plan-checks',
  signals: [
    { value: '26', label: 'days door to door', accent: true },
    { value: '4', label: 'chapters · snow → neon → desert → city' },
    { value: '5', label: 'parks & canyons on the loop' },
    { value: '$7.5k+', label: 'lean budget · AUD per person' },
  ],
  phases: [
    { id: 'snow', n: 1, name: 'Calgary & Banff', dates: 'Sun 20 – Mon 28 Dec', span: 'D1–D9',
      meta: '8 nights · lodge with the fam', days: 8,
      hook: 'Powder days at Sunshine + Lake Louise, Christmas at the lodge.' },
    { id: 'neon', n: 2, name: 'Las Vegas', dates: 'Mon 28 Dec – Sat 2 Jan', span: 'D9–D13',
      meta: '5 nights · the Strip', days: 5,
      hook: 'NYE on a closed-down Strip — fireworks off eight casino rooftops.' },
    { id: 'desert', n: 3, name: 'The Canyon Loop', dates: 'Sat 2 – Fri 8 Jan', span: 'D14–D20',
      meta: '6 nights · motels + one red-eye', days: 7,
      hook: '1,500 km: Zion, Bryce, Antelope, Horseshoe Bend, the Grand Canyon.' },
    { id: 'city', n: 4, name: 'New York', dates: 'Sat 9 – Thu 14 Jan', span: 'D21–D26',
      meta: '5 nights · hostel', days: 6,
      hook: 'January NYC: Knicks at MSG, Comedy Cellar, dive bars, dollar slices.' },
  ],
  ticks: [
    { left: '0%', t: '20 Dec' }, { left: '30.8%', t: '28 Dec' }, { left: '50%', t: '2 Jan' },
    { left: '76.9%', t: '9 Jan' }, { left: '100%', t: '14 Jan', end: true },
  ],
  rules: [
    'The Calgary leg rides with the family — the lodge is covered, we bring the ski legs and the beers.',
    'Everywhere else we fund ourselves: party hostels, cheap motels, shared rooms, diner breakfasts.',
    'Leave the parents on the 28th — they hold Calgary until 2 Jan, we chase the fireworks south.',
    'One rule for the loop: sunrise starts. The parks are empty and golden before 9 am.',
    'Book the four big things early — YYC→LAS flight, NYE beds, Antelope tour, the hire car.',
  ],
  callout: null,
  stops: [
    ...SNOW_STOPS,
    {
      id: 'vegas', name: 'Las Vegas', phase: 'neon', x: 90.1, y: 176.7,
      stay: 'D9–D14 · 5 nights', lab: { x: 82, y: 175, a: 'end' },
      hits: [
        'NYE — America’s Party: the Strip closes to cars, fireworks off eight rooftops',
        'Fremont Street + downtown dives, The Sphere, In-N-Out',
        'Loop starts and ends here — car hire desk is a taxi ride from the hangover',
      ],
    },
    {
      id: 'valleyoffire', name: 'Valley of Fire', phase: 'desert', x: 95.5, y: 173.3, loopOnly: true,
      ix: 73, iy: 79, nx: 73, ny: 70, inum: '1', stay: 'D14 · drive-through',
      hits: ['First stop of the loop — an hour off the Strip', 'Fire Wave + Elephant Rock, Nevada’s oldest state park'],
    },
    {
      id: 'zion', name: 'Zion NP', phase: 'desert', x: 108, y: 165.9, loopOnly: true,
      ix: 117, iy: 50, nx: 117, ny: 42, inum: '2', stay: 'D14–D16 · 2 nights, Springdale',
      hits: ['Watchman at sunrise, Canyon Overlook on the way out', 'Angels Landing if we win the permit draw', 'Riverside Walk to the mouth of the Narrows'],
    },
    {
      id: 'bryce', name: 'Bryce Canyon', phase: 'desert', x: 114.6, y: 161.8, loopOnly: true,
      ix: 140, iy: 36, nx: 140, ny: 28, inum: '3', stay: 'D16–D17 · 1 night',
      hits: ['Hoodoos under snow — the loop’s coldest night (−15 °C)', 'Sunset Point in, sunrise on the rim before the drive out'],
    },
    {
      id: 'page', name: 'Page, AZ', phase: 'desert', x: 120.7, y: 168.9, loopOnly: true,
      ix: 161, iy: 61, nx: 170, ny: 64, inum: '4', stay: 'D17–D18 · 1 night',
      hits: ['Horseshoe Bend at sunset', 'Lower Antelope Canyon — Navajo-guided tour, pre-booked'],
    },
    {
      id: 'grandcanyon', name: 'Grand Canyon', phase: 'desert', x: 115, y: 178, loopOnly: true,
      ix: 141, iy: 92, nx: 150, ny: 97, inum: '5', stay: 'D18–D20 · 2 nights, Tusayan',
      hits: ['South Rim — open all winter, quietest week of the year', 'Bright Angel a mile down and back, sunset at Hopi Point'],
    },
    {
      id: 'route66', name: 'Route 66 · Seligman', phase: 'desert', x: 109, y: 185.5, loopOnly: true,
      ix: 120, iy: 119, nx: 120, ny: 131, inum: '6', stay: 'D20 · diner lunch',
      hits: ['Williams + Seligman — the town that inspired Cars', 'Last leg west, radio up'],
    },
    {
      id: 'hoover', name: 'Hoover Dam', phase: 'desert', x: 93.5, y: 178.3, loopOnly: true,
      ix: 66, iy: 94, nx: 58, ny: 102, inum: '7', stay: 'D20 · pit stop',
      hits: ['Quick dam walk, drop the car in Vegas', 'Red-eye LAS → JFK — a bed night we don’t pay for'],
    },
    {
      id: 'nyc', name: 'New York', phase: 'city', x: 431.5, y: 129,
      stay: 'D21–D26 · 5 nights', lab: { x: 437, y: 127, a: 'start' },
      hits: [
        'Land at dawn off the red-eye, hostel in Manhattan or Williamsburg',
        'Staten Island Ferry (free Statue views), Brooklyn Bridge at dusk',
        'Knicks at MSG, Comedy Cellar, East Village dive-bar crawl',
      ],
    },
  ],
  legs: [
    { d: 'M86.6 19.1 L99 20.5', mode: 'drive', phase: 'snow' },
    { d: 'M99 20.5 Q55 98 90.1 176.7', mode: 'fly', phase: 'neon' },
    { d: 'M90.1 176.7 L95.5 173.3 L108 165.9 L114.6 161.8 L120.7 168.9 L115 178 L109 185.5 L93.5 178.3 Z', mode: 'drive', phase: 'desert' },
    { d: 'M90.1 176.7 Q270 30 431.5 129', mode: 'fly', phase: 'city' },
  ],
  ghosts: [
    { id: 'nashville', name: 'Nashville', x: 325.5, y: 176.8, ly: 188 },
    { id: 'neworleans', name: 'New Orleans', x: 298, y: 242, ly: 253 },
    { id: 'la', name: 'LA', x: 64.4, y: 199, ly: 210 },
  ],
  mapNote: { x: 128, y: 163, text: 'Canyon loop ↓', phase: 'desert' },
  caption:
    'Dashed = flights · solid = the hire car · grey = NYE contenders we passed on (see Showdown). ' +
    'The tight cluster of canyon stops is zoomed below.',
  legsTable: [
    ['Perth → Calgary', 'fly · via LAX or Vancouver', '~24 h door to door'],
    ['Calgary ↔ Banff', 'with the parents’ car', '1 h 45'],
    ['Calgary → Las Vegas', 'fly · WestJet direct', '3 h'],
    ['Vegas → Zion via Valley of Fire', 'drive', '3 h 30'],
    ['Zion → Bryce Canyon', 'drive', '2 h'],
    ['Bryce → Page', 'drive', '2 h 30'],
    ['Page → Grand Canyon', 'drive', '2 h 30'],
    ['Grand Canyon → Vegas', 'drive · Route 66 + Hoover Dam', '4 h 30'],
    ['Vegas → New York JFK', 'fly · red-eye', '5 h'],
    ['JFK → Perth', 'fly · via LAX', '~26 h'],
  ],
  days: [
    { d: 9, date: 'Mon 28 Dec', phase: 'neon', title: 'Snow → neon', bed: 'Strip hotel',
      plan: ['Morning run to YYC with the parents', 'WestJet direct to Las Vegas, 3 h', 'First walk down the Strip after dark'] },
    { d: 10, date: 'Tue 29 Dec', phase: 'neon', title: 'The Strip, end to end', bed: 'Strip hotel',
      plan: ['Casino crawl — Bellagio fountains to the Venetian', 'In-N-Out, then Fremont Street after dark'] },
    { d: 11, date: 'Wed 30 Dec', phase: 'neon', title: 'Downtown', bed: 'Strip hotel',
      plan: ['The Sphere (book a show)', 'Container Park + downtown dives', 'Earlyish night — save the legs'] },
    { d: 12, date: 'Thu 31 Dec', phase: 'neon', title: 'New Year’s Eve', bed: 'Strip hotel',
      plan: ['America’s Party — the Strip shuts to cars, 400k people', 'Midnight: fireworks off eight casino rooftops', 'Club or street — decide on the night'] },
    { d: 13, date: 'Fri 1 Jan', phase: 'neon', title: 'Recovery', bed: 'Strip hotel',
      plan: ['Buffet brunch', 'NFL on the sportsbook screens', 'Pack for the loop'] },
    { d: 14, date: 'Sat 2 Jan', phase: 'desert', title: 'Loop day — go', bed: 'Motel · Springdale',
      plan: ['Pick up the car (young-driver fee is budgeted)', 'Valley of Fire — Fire Wave walk', 'Into Utah: Springdale, Zion’s doorstep'] },
    { d: 15, date: 'Sun 3 Jan', phase: 'desert', title: 'Zion', bed: 'Motel · Springdale',
      plan: ['Watchman at sunrise', 'Angels Landing if the permit lands', 'Riverside Walk to the Narrows mouth'] },
    { d: 16, date: 'Mon 4 Jan', phase: 'desert', title: 'Zion → Bryce', bed: 'Motel · Bryce',
      plan: ['Canyon Overlook on the way out', 'Two hours north — hoodoos under snow', 'Sunset Point, then the coldest night of the trip'] },
    { d: 17, date: 'Tue 5 Jan', phase: 'desert', title: 'Bryce → Page', bed: 'Motel · Page',
      plan: ['Sunrise on the Bryce rim', 'Drive to Page (2 h 30)', 'Horseshoe Bend for sunset'] },
    { d: 18, date: 'Wed 6 Jan', phase: 'desert', title: 'Antelope → the Canyon', bed: 'Motel · Tusayan',
      plan: ['Lower Antelope Canyon tour (pre-booked)', 'Drive to the Grand Canyon via Cameron', 'First look over the rim before dark'] },
    { d: 19, date: 'Thu 7 Jan', phase: 'desert', title: 'Grand Canyon', bed: 'Motel · Tusayan',
      plan: ['Bright Angel — a mile down and back up', 'Rim Trail between the viewpoints', 'Sunset at Hopi Point'] },
    { d: 20, date: 'Fri 8 Jan', phase: 'desert', title: 'Route 66 home', bed: 'Red-eye LAS→JFK',
      plan: ['Williams + Seligman diner lunch', 'Hoover Dam pit stop, drop the car', 'Red-eye east — sleep over the plains'] },
    { d: 21, date: 'Sat 9 Jan', phase: 'city', title: 'Land in New York', bed: 'Hostel · NYC',
      plan: ['Dawn arrival, drop bags at the hostel', 'Bagels + Central Park in the snow', 'Times Square at night — no pens, no queues'] },
    { d: 22, date: 'Sun 10 Jan', phase: 'city', title: 'Downtown', bed: 'Hostel · NYC',
      plan: ['Staten Island Ferry — free Statue views', 'Wall St + 9/11 Memorial', 'Brooklyn Bridge at dusk, Dumbo after'] },
    { d: 23, date: 'Mon 11 Jan', phase: 'city', title: 'Garden night', bed: 'Hostel · NYC',
      plan: ['The Met or Natural History — pick one', 'Knicks at MSG (check the schedule)', 'K-town karaoke after'] },
    { d: 24, date: 'Tue 12 Jan', phase: 'city', title: 'Brooklyn + the Village', bed: 'Hostel · NYC',
      plan: ['Williamsburg thrift + record shops', 'East Village dive-bar crawl', 'Comedy Cellar late show (book)'] },
    { d: 25, date: 'Wed 13 Jan', phase: 'city', title: 'Last full day', bed: 'Hostel · NYC',
      plan: ['Top of the Rock', 'Pizza crawl — Joe’s vs L&B Spumoni', 'Pack, one last (gentle) night out'] },
    { d: 26, date: 'Thu 14 Jan', phase: 'city', title: 'Homeward', bed: 'The plane',
      plan: ['JFK → home via LAX', 'Lose a day to the dateline', 'Start planning the next one'] },
  ],
  nyeIntro:
    'One night decides the middle of the trip. Four contenders for 31 December — scored on the party ' +
    'itself, the damage to the wallet, how cleanly it chains into the canyon loop, and whether we’ll ' +
    'freeze. Click one for the verdict.',
  nye: [
    {
      id: 'vegas', city: 'Las Vegas', event: 'America’s Party', pick: true,
      fact: '400k+ on a closed Strip · fireworks off 8 casino rooftops',
      scores: { Party: 5, Damage: 3, 'Route fit': 5, Warmth: 3 },
      verdict:
        'The pick for this plan. We’re already flying out of Calgary on the 28th — WestJet drops us on ' +
        'the Strip with four nights to warm up. Midnight is a closed-off Strip with fireworks off eight ' +
        'rooftops, and the road trip starts hangover-distance from the car-hire desk on the 2nd.',
    },
    {
      id: 'nashville', city: 'Nashville', event: 'Big Bash', pick: false,
      fact: '~200k downtown · free live music · the music-note drop',
      scores: { Party: 4, Damage: 4, 'Route fit': 2, Warmth: 3 },
      verdict:
        'The wildcard. Big Bash is free, the honky-tonks are heaving and the line-up is real. But it ' +
        'needs an extra flight east and strands us 2,500 km from the canyons — only makes sense if the ' +
        'road trip flips to the Smokies instead.',
    },
    {
      id: 'neworleans', city: 'New Orleans', event: 'Jackson Square', pick: false,
      fact: 'Fleur-de-lis drop · fireworks over the Mississippi · Sugar Bowl 1 Jan',
      scores: { Party: 5, Damage: 4, 'Route fit': 2, Warmth: 4 },
      verdict:
        'The party heavyweight — Bourbon Street doesn’t close, the fireworks run over the river, and ' +
        'the Sugar Bowl kicks off on the 1st. Same problem as Nashville: wrong corner of the map, and ' +
        'January swamps lose to January canyons.',
    },
    {
      id: 'nyc', city: 'New York', event: 'Times Square ball drop', pick: false,
      fact: 'The icon · pens close from ~3 pm · no toilets, no drinks',
      scores: { Party: 2, Damage: 2, 'Route fit': 3, Warmth: 2 },
      verdict:
        'The trap. The ball drop means ten hours penned in at −3 °C with no toilets and no drinks. ' +
        'We do NYC properly in the second week of January instead — same city, zero queues, ' +
        'half-price beds.',
    },
  ],
  nyeHot: 'Las Vegas',
  nyeTable: [
    ['Las Vegas', 'America’s Party', '400k+', 'Our pick — zero detour, maximum send'],
    ['Nashville', 'Big Bash', '~200k', 'Free + great music, wrong side of the map'],
    ['New Orleans', 'Jackson Square', '~1M across the quarter', 'Huge, warm, but strands the road trip'],
    ['New York', 'Ball drop', '~1M penned', 'Do NYC in January, skip the pens'],
  ],
  budget: [
    { cat: 'Long-haul flights', note: 'PER → Calgary in · JFK → PER out', lean: 2400, send: 2900 },
    { cat: 'Domestic hops', note: 'YYC → LAS · LAS → JFK red-eye', lean: 380, send: 520 },
    { cat: 'Snow', note: '4 lift days + full gear hire', lean: 750, send: 950 },
    { cat: 'Beds', note: '17 paid nights — the lodge is free', lean: 950, send: 1450 },
    { cat: 'Wheels', note: 'car ÷ 2 · young-driver fee · fuel', lean: 620, send: 800 },
    { cat: 'Parks & tours', note: 'parks pass ÷ 2 · Antelope · Sphere', lean: 220, send: 320 },
    { cat: 'Food & drink', note: '26 days · diners over restaurants', lean: 1600, send: 2200 },
    { cat: 'Big nights', note: 'NYE · clubs · Knicks · comedy', lean: 600, send: 1200 },
  ],
  budgetMax: 2900,
  heroSub: {
    lean: 'the lean version — hostel bunks, diner food, picked nights out',
    send: 'the send-it version — better beds, more shows, no maths at the bar',
  },
  budgetNote:
    'Both columns assume shared rooms and a shared car. The Banff lodge and the lifts to it are the ' +
    'family’s Christmas — that’s roughly $1,200 of beds we never pay. FX pinned at 0.65 USD; ' +
    'everything rounds up, not down.',
  checklist: [
    { id: 'esta', label: 'US ESTA — one each', when: 'now', why: 'USD 21, apply at least 72 h before flying' },
    { id: 'eta', label: 'Canada eTA — one each', when: 'now', why: 'CAD 7, usually approved in minutes' },
    { id: 'longhaul', label: 'Long-haul: PER → YYC in, JFK → PER out', when: 'by Sep', why: 'one multi-city fare beats two returns' },
    { id: 'yyclas', label: 'YYC → LAS flight · 28 Dec', when: 'by Sep', why: 'WestJet direct — NYE week sells out first' },
    { id: 'nyebeds', label: 'Vegas beds · 28 Dec – 2 Jan', when: 'by Oct', why: 'NYE rates triple; watch the resort fees' },
    { id: 'lasjfk', label: 'LAS → JFK red-eye · 8 Jan', when: 'by Oct', why: 'the overnight flight is a free bed night' },
    { id: 'car', label: 'Hire car from LAS · 2–8 Jan', when: 'by Oct', why: 'looping back to Vegas kills the one-way fee' },
    { id: 'antelope', label: 'Lower Antelope Canyon tour · 6 Jan', when: 'by Nov', why: 'Navajo-guided only — no walk-ups in peak week' },
    { id: 'ski', label: 'Lift passes + gear hire · Banff', when: 'by Nov', why: 'multi-day Sunshine + Louise combo ticket' },
    { id: 'insurance', label: 'Travel insurance with snow-sports cover', when: 'by Nov', why: 'standard policies exclude the fun part' },
    { id: 'nychostel', label: 'NYC hostel · 9–14 Jan', when: 'by Nov', why: 'January is the cheapest week of the NYC year' },
    { id: 'angels', label: 'Angels Landing permit lottery', when: 'Dec draw', why: 'seasonal lottery, day-before draw as backup' },
    { id: 'esim', label: 'US + Canada eSIM', when: 'week before', why: 'one plan that covers both sides of the border' },
    { id: 'tix', label: 'Knicks + Comedy Cellar tickets', when: 'week before', why: 'MSG schedule drops late; Cellar books out fast' },
  ],
  smarts: [
    'Drinking age is 21 and they card hard — carry your passport on nights out.',
    'Vegas rooms advertise cheap, then add USD 35–50/night “resort fees” at the desk. Budget for it.',
    'Under-25 car hire adds roughly USD 25–35/day — it’s in the Wheels budget, not a surprise.',
    'Bryce sits at 2,400 m: black ice and −15 °C nights. Take the winter-tyre option on the car.',
    'Tipping is real: 18–20 % sit-down, a dollar a drink at the bar.',
    'Zion’s shuttle doesn’t run in early January — we can drive the scenic canyon road ourselves.',
    'One America the Beautiful pass (USD 80 per car) covers Zion, Bryce and the Grand Canyon. Split it.',
    'Fly east overnight: land at dawn, save a night’s rent, sleep on the plane.',
  ],
};

/* ══════════════════════════════════════════════════════════════════════════
   PLAN B — Snow → Bass → Texas → PCH
   ══════════════════════════════════════════════════════════════════════════ */
const PLAN_B = {
  id: 'b',
  name: 'Plan B',
  tagline: 'Snow → Bass → Texas → PCH',
  sub: 'Lights All Night NYE · Texas + Starbase · California coast',
  thesis:
    '26 days, four chapters. Same Banff Christmas with the family, then Dallas for Lights All Night — ' +
    'a two-day EDM festival with the NYE countdown — a Texas road trip through Austin, San Antonio, ' +
    'South Padre + Starbase and Big Bend, and a flight over to LA to drive the Pacific Coast Highway ' +
    'up to San Francisco.',
  defaultStop: 'dallas',
  defaultNye: 'lan',
  lsKey: 'amx-plan-b-checks',
  signals: [
    { value: '26', label: 'days door to door', accent: true },
    { value: '2', label: 'festival nights · NYE countdown at Lights All Night' },
    { value: '~2,900', label: 'km of Texas + Pacific Coast Highway' },
    { value: '$8.2k+', label: 'lean budget · AUD per person' },
  ],
  phases: [
    { id: 'snow', n: 1, name: 'Calgary & Banff', dates: 'Sun 20 – Mon 28 Dec', span: 'D1–D9',
      meta: '8 nights · lodge with the fam', days: 8,
      hook: 'Powder days at Sunshine + Lake Louise, Christmas at the lodge.' },
    { id: 'neon', n: 2, name: 'Dallas · Lights All Night', dates: 'Mon 28 Dec – Fri 1 Jan', span: 'D9–D13',
      meta: '4 nights · Deep Ellum digs', days: 4,
      hook: 'Two-day EDM festival — arena-scale headliners and the NYE countdown.' },
    { id: 'desert', n: 3, name: 'Texas', dates: 'Fri 1 – Fri 8 Jan', span: 'D13–D20',
      meta: '7 nights · Austin → Big Bend', days: 8,
      hook: 'BBQ, the Alamo, a warm gulf beach, Starbase, and desert canyons.' },
    { id: 'city', n: 4, name: 'California', dates: 'Fri 8 – Thu 14 Jan', span: 'D20–D26',
      meta: '6 nights · LA → PCH → SF', days: 6,
      hook: 'LA nights, then the Pacific Coast Highway up to San Francisco.' },
  ],
  ticks: [
    { left: '0%', t: '20 Dec' }, { left: '30.8%', t: '28 Dec' }, { left: '46.2%', t: '1 Jan' },
    { left: '76.9%', t: '9 Jan' }, { left: '100%', t: '14 Jan', end: true },
  ],
  rules: [
    'The Calgary leg rides with the family — the lodge is covered, we bring the ski legs and the beers.',
    'Everywhere else we fund ourselves: party hostels, cheap motels, shared rooms, taco trucks.',
    'Festival first, then the road — Lights All Night tickets tier up from September, buy the day presale opens.',
    'One Starbase rule: we never anchor a day to a launch. If Starship flies while we’re on South Padre, we won the lottery.',
    'Two one-way hires beat one mega-loop — Texas and California each get their own car.',
  ],
  callout: {
    kicker: 'The Miami call',
    body:
      'Miami in late December is 26 °C and a genuine party — but it’s 2,000 km the wrong way, two ' +
      'extra flights, and every day there comes out of California. South Padre already puts us on a ' +
      'warm beach mid-trip (~22 °C in January), so Texas + the PCH is the better trade. Parked, not ' +
      'dead: if California ever falls out of this plan, Miami is the first thing back in — fly ' +
      'DFW → MIA on 1 Jan instead of driving west, and finish the trip out of Florida.',
  },
  stops: [
    ...SNOW_STOPS,
    {
      id: 'dallas', name: 'Dallas', phase: 'neon', x: 242.4, y: 212.3,
      stay: 'D9–D13 · 4 nights', lab: { x: 248, y: 210, a: 'start' },
      hits: [
        'Lights All Night, 30–31 Dec — Texas’s biggest NYE, arena-scale EDM headliners',
        'Midnight countdown inside the festival on the 31st',
        'Deep Ellum tacos + Fort Worth Stockyards on the warm-up day',
      ],
    },
    {
      id: 'austin', name: 'Austin', phase: 'desert', x: 234.6, y: 238.7,
      stay: 'D13–D15 · 2 nights', lab: { x: 241, y: 241, a: 'start' },
      hits: [
        'BBQ pilgrimage — Terry Black’s or the Franklin queue',
        'South Congress, Barton Springs (yes, in January — it holds 20 °C)',
        'Rainey Street easy night, 6th Street big night',
      ],
    },
    {
      id: 'sanantonio', name: 'San Antonio', phase: 'desert', x: 228.3, y: 247.6,
      stay: 'D15–D16 · 1 night', lab: { x: 236, y: 256, a: 'start' },
      hits: ['The Alamo + the River Walk at night', 'Best Tex-Mex of the trip', 'Launchpad for the gulf run south'],
    },
    {
      id: 'southpadre', name: 'South Padre · Starbase', phase: 'desert', x: 239.3, y: 282.5,
      stay: 'D16–D18 · 2 nights', lab: { x: 239, y: 295, a: 'middle' },
      hits: [
        'Warm gulf beach — ~22 °C, palm trees, fish tacos (the Miami itch, scratched)',
        'Starbase: Highway 4 drive-by — Mechazilla and stacked Starships either way',
        'Launch watch from Isla Blanca Park (8 km from the pad) IF the schedule lands',
      ],
    },
    {
      id: 'bigbend', name: 'Big Bend · Terlingua', phase: 'desert', x: 185.9, y: 248.6,
      stay: 'D18–D20 · 2 nights', lab: { x: 181, y: 243, a: 'end' },
      hits: [
        'Santa Elena Canyon at first light, Ross Maxwell scenic drive',
        'Rio Grande hot springs + the darkest night skies in the lower 48',
        'Terlingua ghost town porch beers; Marfa + Prada Marfa on the way out',
      ],
    },
    {
      id: 'elpaso', name: 'El Paso', phase: 'desert', x: 162.3, y: 223,
      stay: 'D20 · drop the car', lab: { x: 156, y: 220, a: 'end' },
      hits: ['End of the Texas leg — 1,900 km behind us', 'Drop car one, evening hop to LA (2 h)'],
    },
    {
      id: 'la', name: 'Los Angeles', phase: 'city', x: 64.4, y: 199,
      stay: 'D20–D23 · 3 nights', lab: { x: 70, y: 196, a: 'start' },
      hits: [
        'Venice + Santa Monica, Griffith at sunset, In-N-Out on arrival',
        'Melrose thrift, WeHo or DTLA after dark',
        'Lakers / Clippers game if the schedule lands',
      ],
    },
    {
      id: 'bigsur', name: 'Big Sur', phase: 'city', x: 34.9, y: 175.7,
      stay: 'D23–D25 · SLO + Monterey nights', lab: { x: 42, y: 174, a: 'start' },
      hits: [
        'PCH: Malibu → Santa Barbara → San Luis Obispo → Big Sur',
        'Bixby Bridge, McWay Falls, elephant seals at San Simeon',
        'Check Caltrans before leaving LA — winter slides close the road some weeks',
      ],
    },
    {
      id: 'sf', name: 'San Francisco', phase: 'city', x: 29.7, y: 159.9,
      stay: 'D25–D26 · 1 night', lab: { x: 36, y: 158, a: 'start' },
      hits: ['Santa Cruz boardwalk on the way up', 'Golden Gate + Mission burritos', 'Last night out, fly home from SFO'],
    },
  ],
  legs: [
    { d: 'M86.6 19.1 L99 20.5', mode: 'drive', phase: 'snow' },
    { d: 'M99 20.5 Q200 60 242.4 212.3', mode: 'fly', phase: 'neon' },
    { d: 'M242.4 212.3 L234.6 238.7 L228.3 247.6 L239.3 282.5 L220 267.8 L208.3 248.1 L185.9 248.6 L182.4 238.2 L162.3 223', mode: 'drive', phase: 'desert' },
    { d: 'M162.3 223 Q115 232 64.4 199', mode: 'fly', phase: 'city' },
    { d: 'M64.4 199 L44.3 186.1 L34.9 175.7 L29.7 159.9', mode: 'drive', phase: 'city' },
  ],
  ghosts: [
    { id: 'vegas', name: 'Las Vegas', x: 90.1, y: 176.7, lx: 96, ly: 179, anchor: 'start' },
    { id: 'phoenix', name: 'Phoenix', x: 115.6, y: 205.3, ly: 214 },
    { id: 'miami', name: 'Miami', x: 380.2, y: 286, ly: 298 },
  ],
  mapNote: null,
  caption:
    'Dashed = flights · solid = the two hire cars · grey = weighed and passed on: Vegas (over it), ' +
    'Phoenix (Decadence — see Showdown), Miami (parked — see Overview).',
  legsTable: [
    ['Perth → Calgary', 'fly · via LAX or Vancouver', '~24 h door to door'],
    ['Calgary ↔ Banff', 'with the parents’ car', '1 h 45'],
    ['Calgary → Dallas', 'fly · AA direct', '4 h'],
    ['Dallas → Austin', 'drive · I-35 south', '3 h'],
    ['Austin → San Antonio', 'drive', '1 h 30'],
    ['San Antonio → South Padre Island', 'drive · palms appear', '4 h 30'],
    ['South Padre → Terlingua (Big Bend)', 'drive · the big haul, via Laredo', '8 h 30'],
    ['Big Bend → Marfa → El Paso', 'drive', '4 h 30'],
    ['El Paso → Los Angeles', 'fly', '2 h'],
    ['LA → San Francisco', 'PCH over three days', '~10 h driving'],
    ['SFO → Perth', 'fly · via LAX', '~27 h'],
  ],
  days: [
    { d: 9, date: 'Mon 28 Dec', phase: 'neon', title: 'Snow → bass', bed: 'Dallas',
      plan: ['Morning run to YYC with the parents', 'AA direct to Dallas–Fort Worth, ~4 h', 'Deep Ellum for first-night tacos'] },
    { d: 10, date: 'Tue 29 Dec', phase: 'neon', title: 'Dallas warm-up', bed: 'Dallas',
      plan: ['Fort Worth Stockyards — actual cowboys', 'Reunion Tower or the JFK museum', 'Early night — two festival days ahead'] },
    { d: 11, date: 'Wed 30 Dec', phase: 'neon', title: 'Lights All Night · day one', bed: 'Dallas',
      plan: ['Doors late afternoon — pace it', 'Hunt the undercard finds before the headliners', 'Late-night pizza recovery'] },
    { d: 12, date: 'Thu 31 Dec', phase: 'neon', title: 'NYE at the festival', bed: 'Dallas',
      plan: ['Day two — headliners into the midnight countdown', 'Confetti, lasers, a new year', 'Stumble home smart'] },
    { d: 13, date: 'Fri 1 Jan', phase: 'desert', title: 'Recovery → Austin', bed: 'Austin',
      plan: ['Sleep in, big diner breakfast', 'Pick up car one, I-35 south (3 h)', 'Gentle first look at Rainey Street'] },
    { d: 14, date: 'Sat 2 Jan', phase: 'desert', title: 'Austin', bed: 'Austin',
      plan: ['BBQ pilgrimage — Terry Black’s or the Franklin queue', 'South Congress + Barton Springs (yes, in January)', '6th Street properly'] },
    { d: 15, date: 'Sun 3 Jan', phase: 'desert', title: 'San Antonio', bed: 'San Antonio',
      plan: ['90 minutes down to San Antonio', 'The Alamo + the River Walk', 'Tex-Mex night'] },
    { d: 16, date: 'Mon 4 Jan', phase: 'desert', title: 'The gulf run', bed: 'South Padre Island',
      plan: ['4.5 h south — watch the palms appear', 'South Padre Island: ~22 °C beach afternoon', 'Sunset on the dunes'] },
    { d: 17, date: 'Tue 5 Jan', phase: 'desert', title: 'Starbase', bed: 'South Padre Island',
      plan: ['Highway 4 drive-by — Mechazilla + stacked Starships', 'Launch watch from Isla Blanca Park IF the schedule lands', 'Beach + fish tacos either way'] },
    { d: 18, date: 'Wed 6 Jan', phase: 'desert', title: 'The big haul', bed: 'Terlingua',
      plan: ['Sunrise start — 8.5 h west via Laredo and Del Rio', 'Border river country the whole way', 'Terlingua ghost town, porch beers'] },
    { d: 19, date: 'Thu 7 Jan', phase: 'desert', title: 'Big Bend', bed: 'Terlingua',
      plan: ['Santa Elena Canyon at first light', 'Ross Maxwell scenic drive', 'Rio Grande hot springs + the darkest skies you’ve ever seen'] },
    { d: 20, date: 'Fri 8 Jan', phase: 'desert', title: 'Marfa → the coast', bed: 'Los Angeles',
      plan: ['Prada Marfa photo stop', 'Drop car one in El Paso', 'Evening hop to LA — In-N-Out on arrival'] },
    { d: 21, date: 'Sat 9 Jan', phase: 'city', title: 'Los Angeles', bed: 'Los Angeles',
      plan: ['Venice Beach + Santa Monica pier', 'Griffith Observatory at sunset', 'WeHo or DTLA after dark'] },
    { d: 22, date: 'Sun 10 Jan', phase: 'city', title: 'LA · round two', bed: 'Los Angeles',
      plan: ['Melrose thrift + record shops', 'Universal, or a Lakers/Clippers game (check the schedule)', 'Last LA night'] },
    { d: 23, date: 'Mon 11 Jan', phase: 'city', title: 'PCH · leg one', bed: 'San Luis Obispo',
      plan: ['Pick up car two', 'Malibu → Santa Barbara → San Luis Obispo', 'Pismo Beach sunset'] },
    { d: 24, date: 'Tue 12 Jan', phase: 'city', title: 'Big Sur', bed: 'Monterey',
      plan: ['Elephant seals at San Simeon', 'McWay Falls + Bixby Bridge', 'Monterey for the night'] },
    { d: 25, date: 'Wed 13 Jan', phase: 'city', title: 'San Francisco', bed: 'San Francisco',
      plan: ['Santa Cruz boardwalk on the way up', 'Golden Gate + Mission burritos', 'Last night out proper'] },
    { d: 26, date: 'Thu 14 Jan', phase: 'city', title: 'Homeward', bed: 'The plane',
      plan: ['Drop car two, SFO → home via LAX', 'Lose a day to the dateline', 'Argue about which plan was better'] },
  ],
  nyeIntro:
    'Same night, different question: which NYE festival gets us? All four are real multi-stage EDM ' +
    'events over New Year’s — scored on the calibre of lineup they pull, wallet damage, how cleanly ' +
    'they chain into Texas + California, and sheer scale. Lineups drop September–October.',
  nye: [
    {
      id: 'lan', city: 'Dallas', event: 'Lights All Night', pick: true,
      fact: 'Texas’s biggest NYE · 30–31 Dec · indoor arena-scale · Illenium / Excision / Zedd calibre',
      scores: { Lineup: 4, Damage: 3, 'Route fit': 5, Scale: 4 },
      verdict:
        'The pick for this plan. Two full nights with the countdown inside the festival, a direct ' +
        'flight from Calgary lands us there with a day to spare, and on 1 Jan the Texas road trip ' +
        'starts from the festival’s doorstep. Indoor venue, so December Dallas weather is irrelevant.',
    },
    {
      id: 'decadence', city: 'Phoenix', event: 'Decadence Arizona', pick: false,
      fact: 'The Southwest’s NYE monster · 30–31 Dec · consistently top-tier headliners',
      scores: { Lineup: 5, Damage: 3, 'Route fit': 2, Scale: 5 },
      verdict:
        'Probably the strongest lineup in the country on NYE — deadmau5 / Kaskade / Above & Beyond ' +
        'calibre, two huge nights. But Phoenix on the 31st strands the whole Texas leg: we’d land in ' +
        'the middle of the route and drive it backwards. If Texas ever drops out of Plan B, this is ' +
        'the first swap in.',
    },
    {
      id: 'countdown', city: 'SoCal', event: 'Countdown NYE', pick: false,
      fact: 'Insomniac’s NYE · San Bernardino · EDC production values on New Year’s',
      scores: { Lineup: 4, Damage: 3, 'Route fit': 2, Scale: 4 },
      verdict:
        'Insomniac production with an EDC-grade lineup an hour from LA. The problem is the order of ' +
        'operations: NYE in California flips the whole route — festival jetlagged straight off the ' +
        'ski leg, then Texas backwards. Great event, wrong end of the map for this plan.',
    },
    {
      id: 'forevermidnight', city: 'Las Vegas', event: 'Forever Midnight', pick: false,
      fact: 'LED’s two-night arena NYE · big-room headliners · it’s still Vegas',
      scores: { Lineup: 4, Damage: 2, 'Route fit': 3, Scale: 3 },
      verdict:
        'The other big NYE EDM event — two arena nights, serious names. But it’s Vegas on NYE ' +
        'pricing, and you’ve already said you’re not fussed on Vegas. Parked on principle.',
    },
  ],
  nyeHot: 'Dallas',
  nyeTable: [
    ['Dallas', 'Lights All Night', '2 nights · ~50k', 'Our pick — the festival IS the route'],
    ['Phoenix', 'Decadence Arizona', '2 nights · 60k+', 'Best lineup, strands the Texas leg'],
    ['SoCal', 'Countdown NYE', '1–2 nights · 65k+', 'EDC-grade, but flips the route backwards'],
    ['Las Vegas', 'Forever Midnight', '2 nights · arena', 'Big names, but we’re over Vegas'],
  ],
  budget: [
    { cat: 'Long-haul flights', note: 'PER → Calgary in · SFO → PER out', lean: 2500, send: 3000 },
    { cat: 'Domestic hops', note: 'YYC → DFW · ELP → LAX', lean: 450, send: 620 },
    { cat: 'Festival', note: 'Lights All Night 2-day · GA → VIP', lean: 380, send: 560 },
    { cat: 'Snow', note: '4 lift days + full gear hire', lean: 750, send: 950 },
    { cat: 'Beds', note: '19 paid nights — the lodge is free', lean: 1100, send: 1650 },
    { cat: 'Wheels', note: 'two one-way hires ÷ 2 · Texas fuel', lean: 750, send: 980 },
    { cat: 'Parks & fun', note: 'Big Bend · beaches · game tickets', lean: 200, send: 380 },
    { cat: 'Food & drink', note: '26 days · taco trucks over restaurants', lean: 1600, send: 2200 },
    { cat: 'Big nights', note: 'Austin 6th St · LA · SF', lean: 500, send: 1000 },
  ],
  budgetMax: 3000,
  heroSub: {
    lean: 'the lean version — GA wristbands, hostel bunks, taco trucks',
    send: 'the send-it version — VIP wristbands, better beds, no maths at the bar',
  },
  budgetNote:
    'Both columns assume shared rooms and shared cars. The Banff lodge stays the family’s Christmas. ' +
    'Two one-way hires (Dallas → El Paso, LA → SF) replace Plan A’s loop — the one-way fees are ' +
    'priced into Wheels. FX pinned at 0.65 USD; everything rounds up, not down.',
  checklist: [
    { id: 'esta', label: 'US ESTA — one each', when: 'now', why: 'USD 21, apply at least 72 h before flying' },
    { id: 'eta', label: 'Canada eTA — one each', when: 'now', why: 'CAD 7, usually approved in minutes' },
    { id: 'lantix', label: 'Lights All Night tickets · 30–31 Dec', when: 'presale', why: 'tiers sell up — early GA saves ~30 %; presale lands Sep–Oct' },
    { id: 'longhaul', label: 'Long-haul: PER → YYC in, SFO → PER out', when: 'by Sep', why: 'one multi-city fare beats two returns' },
    { id: 'yycdfw', label: 'YYC → DFW flight · 28 Dec', when: 'by Sep', why: 'AA direct — festival week fills fast' },
    { id: 'dallasbeds', label: 'Dallas beds · 28 Dec – 1 Jan', when: 'by Oct', why: 'stay near Deep Ellum, transit to the venue sorted' },
    { id: 'carone', label: 'Car one: Dallas → El Paso one-way · 1–8 Jan', when: 'by Oct', why: 'one-way fee is real — price it against looping back' },
    { id: 'elplax', label: 'ELP → LAX flight · 8 Jan', when: 'by Oct', why: 'evening hop, ~2 h' },
    { id: 'ski', label: 'Lift passes + gear hire · Banff', when: 'by Nov', why: 'multi-day Sunshine + Louise combo ticket' },
    { id: 'insurance', label: 'Travel insurance with snow-sports cover', when: 'by Nov', why: 'standard policies exclude the fun part' },
    { id: 'spibeds', label: 'South Padre + Terlingua beds', when: 'by Nov', why: 'Terlingua is tiny — the good spots go early' },
    { id: 'cartwo', label: 'Car two: LA → SF one-way · 11–14 Jan', when: 'by Nov', why: 'CA one-ways are common and cheap-ish' },
    { id: 'starship', label: 'Check the Starship launch schedule', when: '2 wks out', why: 'dates slip constantly — a launch is a lottery win, not a plan' },
    { id: 'esim', label: 'US + Canada eSIM', when: 'week before', why: 'one plan that covers both sides of the border' },
  ],
  smarts: [
    'Drinking age is 21 and they card hard — carry your passport on nights out (festival included).',
    'Under-25 car hire adds roughly USD 25–35/day per car — it’s in the Wheels budget, not a surprise.',
    'Texas is not a detour state: Dallas → El Paso the long way is ~1,900 km. The D18 haul is the price of Big Bend — leave at sunrise.',
    'Fuel up before Big Bend — Terlingua to the next proper servo is a real distance. And stop at a Buc-ee’s once; it’s a religion.',
    'Starship dates slip days at a time. Isla Blanca Park on South Padre is the viewing spot (8 km from the pad); the Highway 4 drive-by sees the rockets regardless.',
    'PCH closes at Big Sur some winters after slides — check Caltrans the morning we leave LA; the 101 is the fallback.',
    'Tipping is real: 18–20 % sit-down, a dollar a drink at the bar.',
    'Barton Springs is spring-fed at ~20 °C year-round — bring the swimmers to Austin, it’s a January flex.',
  ],
};

const PLANS = { a: PLAN_A, b: PLAN_B };

/* ── Small pieces ────────────────────────────────────────────────────────── */
function PhaseDot({ phase }) {
  return <i className={`amx-dot amx-dot--${phase}`} aria-hidden="true" />;
}

function DotScale({ label, score }) {
  return (
    <div className="amx-scale">
      <span className="amx-scale__label">{label}</span>
      <span className="amx-scale__dots" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((i) => (
          <i key={i} className={`amx-scale__dot${i <= score ? ' amx-scale__dot--on' : ''}`} />
        ))}
      </span>
      <span className="amx-scale__val">{score}/5</span>
    </div>
  );
}

function RuledList({ kicker, items }) {
  return (
    <div className="pt-card amx-ruled">
      <span className="syl-kicker">{kicker}</span>
      <ul className="amx-ruled__list">
        {items.map((t, i) => <li key={i}>{t}</li>)}
      </ul>
    </div>
  );
}

function MapStop({ stop, cx, cy, r, selected, dim, onSelect }) {
  const cls =
    `amx-stop amx-stop--${stop.phase}` +
    (selected ? ' amx-stop--selected' : '') +
    (dim ? ' amx-stop--dim' : '');
  const key = (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(stop.id); }
  };
  return (
    <g className={cls} role="button" tabIndex={0} aria-label={`${stop.name} — ${stop.stay}`}
       onClick={() => onSelect(stop.id)} onKeyDown={key}>
      <circle className="amx-stop__hit" cx={cx} cy={cy} r={Math.max(r + 6, 9)} />
      <circle className="amx-stop__ring" cx={cx} cy={cy} r={r + 3.2} />
      <circle className="amx-stop__core" cx={cx} cy={cy} r={r} />
    </g>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   MODULE
   ══════════════════════════════════════════════════════════════════════════ */
const loadChecks = (key) => {
  try { return JSON.parse(localStorage.getItem(key)) || {}; } catch { return {}; }
};

export default function AmericaFirstPlan() {
  const [planId, setPlanId] = useState('a');
  const [view, setView] = useState('Overview');
  const [stopId, setStopId] = useState('vegas');
  const [phaseFilter, setPhaseFilter] = useState(null);
  const [dayPhase, setDayPhase] = useState('snow');
  const [nyeId, setNyeId] = useState('vegas');
  const [mode, setMode] = useState('lean');
  const [checks, setChecks] = useState(() => ({
    a: loadChecks(PLAN_A.lsKey),
    b: loadChecks(PLAN_B.lsKey),
  }));

  useEffect(() => {
    try {
      localStorage.setItem(PLAN_A.lsKey, JSON.stringify(checks.a));
      localStorage.setItem(PLAN_B.lsKey, JSON.stringify(checks.b));
    } catch { /* private mode */ }
  }, [checks]);

  const PLAN = PLANS[planId];
  const days = [...SNOW_DAYS, ...PLAN.days];
  const stop = PLAN.stops.find((s) => s.id === stopId) || PLAN.stops.find((s) => s.id === PLAN.defaultStop);
  const nye = PLAN.nye.find((n) => n.id === nyeId) || PLAN.nye[0];
  const planChecks = checks[planId];
  const done = PLAN.checklist.filter((c) => planChecks[c.id]).length;
  const total = (k) => PLAN.budget.reduce((s, b) => s + b[k], 0);
  const dimmed = (p) => Boolean(phaseFilter && phaseFilter !== p);
  const jumpToPhase = (id) => { setDayPhase(id); setView('Day by Day'); };
  const money = (v) => `$${v.toLocaleString('en-AU')}`;

  const switchPlan = (id) => {
    if (id === planId) return;
    setPlanId(id);
    setStopId(PLANS[id].defaultStop);
    setNyeId(PLANS[id].defaultNye);
    setPhaseFilter(null);
  };

  return (
    <div className="pt-module syl amx">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="pt-card syl-head">
        <div className="syl-head__meta">
          <p className="syl-head__tag">{PROJECT.tag}</p>
          <h3 className="syl-head__title">{PROJECT.title}</h3>
          <p className="syl-head__thesis">{PLAN.thesis}</p>
          <p className="amx-src">
            Anchored to the parents’ booked window — they hold Calgary 22 Dec – 2 Jan
            (Documents/travel/parent-itinerary.md). Both plans share the lodge leg 22 – 28 Dec,
            then run their own show.
          </p>
        </div>
        <div className="syl-head__phase">
          <span className="syl-head__phase-label">Status</span>
          <span className="syl-phasechip">{PROJECT.phase}</span>
        </div>
      </header>

      {/* ── Plan switcher ───────────────────────────────────────────────── */}
      <div className="amx-plans" role="group" aria-label="Pick a plan">
        {Object.values(PLANS).map((p) => (
          <button key={p.id}
                  className={`pt-card amx-plan${planId === p.id ? ' amx-plan--on' : ''}`}
                  aria-pressed={planId === p.id} onClick={() => switchPlan(p.id)}>
            <span className="amx-plan__kicker">{p.name}</span>
            <span className="amx-plan__tagline">{p.tagline}</span>
            <span className="amx-plan__sub">{p.sub}</span>
          </button>
        ))}
      </div>

      {/* ── Tabs ────────────────────────────────────────────────────────── */}
      <div className="syl-seg" role="tablist" aria-label="First Plan sections">
        {VIEWS.map((v) => (
          <button key={v} role="tab" aria-selected={v === view}
                  className={`syl-seg__tab${v === view ? ' syl-seg__tab--active' : ''}`}
                  onClick={() => setView(v)}>
            {v}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW ────────────────────────────────────────────────────── */}
      {view === 'Overview' && (
        <div className="syl-panel" role="tabpanel">
          <div className="syl-signals">
            {PLAN.signals.map((s) => (
              <div key={s.label} className={`pt-card syl-signal${s.accent ? ' syl-signal--accent' : ''}`}>
                <span className="syl-signal__v">{s.value}</span>
                <span className="syl-signal__l">{s.label}</span>
              </div>
            ))}
          </div>

          {/* 26-day strip, one segment per chapter */}
          <div className="pt-card amx-strip">
            <div className="amx-strip__head">
              <span className="syl-kicker syl-kicker--accent">The 26 days, end to end</span>
              <span className="amx-note">Sun 20 Dec 2026 → Thu 14 Jan 2027</span>
            </div>
            <div className="amx-strip__bar" role="img"
                 aria-label={`Timeline: ${PLAN.phases.map((p) => `${p.name} ${p.days} days`).join(', ')}`}>
              {PLAN.phases.map((p) => (
                <button key={p.id} className={`amx-strip__seg amx-strip__seg--${p.id}`}
                        style={{ flexGrow: p.days }} onClick={() => jumpToPhase(p.id)}
                        title={`${p.name} — open Day by Day`}>
                  <span className="amx-strip__segdays">{p.days}d</span>
                </button>
              ))}
            </div>
            <div className="amx-strip__ticks" aria-hidden="true">
              {PLAN.ticks.map((t) => (
                <span key={t.t} style={{ left: t.left }}
                      className={t.end ? 'amx-strip__tick--end' : undefined}>
                  {t.t}
                </span>
              ))}
            </div>
          </div>

          {/* Chapter cards */}
          <div className="amx-phases">
            {PLAN.phases.map((p) => (
              <button key={p.id} className="pt-card amx-phase" onClick={() => jumpToPhase(p.id)}>
                <span className="amx-phase__kicker">
                  <PhaseDot phase={p.id} />
                  Chapter {p.n} · {p.span}
                </span>
                <span className="amx-phase__name">{p.name}</span>
                <span className="amx-phase__dates">{p.dates} · {p.meta}</span>
                <span className="amx-phase__hook">{p.hook}</span>
                <span className="amx-phase__go">Day by day <Icon name="arrowRight" size={12} /></span>
              </button>
            ))}
          </div>

          {PLAN.callout && (
            <div className="pt-card amx-verdict">
              <span className="syl-kicker syl-kicker--accent">{PLAN.callout.kicker}</span>
              <p>{PLAN.callout.body}</p>
            </div>
          )}

          <RuledList kicker="Ground rules" items={PLAN.rules} />
        </div>
      )}

      {/* ── ROUTE MAP ───────────────────────────────────────────────────── */}
      {view === 'Route Map' && (
        <div className="syl-panel" role="tabpanel">
          <div className="amx-legend" role="group" aria-label="Filter the map by chapter">
            {PLAN.phases.map((p) => (
              <button key={p.id}
                      className={`amx-legend__btn${phaseFilter === p.id ? ' amx-legend__btn--on' : ''}`}
                      aria-pressed={phaseFilter === p.id}
                      onClick={() => setPhaseFilter(phaseFilter === p.id ? null : p.id)}>
                <PhaseDot phase={p.id} />
                {p.name}
              </button>
            ))}
            <span className="amx-legend__hint">click a chapter to isolate it · click a dot for the plan</span>
          </div>

          <div className="amx-maply">
            {/* Main map */}
            <figure className="pt-card amx-mapcard">
              <svg className="amx-map" viewBox="0 0 512 312" role="group"
                   aria-label="Route map of the USA with Calgary above the border">
                <path className="amx-map__land" d={US_OUTLINE} />
                <text className="amx-map__country" x="150" y="30">CANADA</text>
                <text className="amx-map__country" x="150" y="58">USA</text>

                {PLAN.legs.map((l, i) => (
                  <path key={`${PLAN.id}-leg-${i}`}
                        className={`amx-leg amx-leg--${l.mode} amx-leg--${l.phase}${dimmed(l.phase) ? ' amx-leg--dim' : ''}`}
                        d={l.d} />
                ))}

                {PLAN.ghosts.map((g) => (
                  <g key={g.id} className="amx-ghost">
                    <circle cx={g.x} cy={g.y} r="2.6" />
                    <text x={g.lx ?? g.x} y={g.ly} textAnchor={g.anchor ?? 'middle'}>{g.name}</text>
                  </g>
                ))}

                {PLAN.stops.filter((s) => !s.loopOnly).map((s) => (
                  <MapStop key={s.id} stop={s} cx={s.x} cy={s.y} r={4.2}
                           selected={stopId === s.id} dim={dimmed(s.phase)} onSelect={setStopId} />
                ))}
                {PLAN.stops.filter((s) => !s.loopOnly).map((s) => (
                  <text key={`${s.id}-l`}
                        className={`amx-map__label${dimmed(s.phase) ? ' amx-map__label--dim' : ''}`}
                        x={s.lab.x} y={s.lab.y} textAnchor={s.lab.a}>
                    {s.name}
                  </text>
                ))}
                {PLAN.mapNote && (
                  <text className={`amx-map__label amx-map__label--loop${dimmed(PLAN.mapNote.phase) ? ' amx-map__label--dim' : ''}`}
                        x={PLAN.mapNote.x} y={PLAN.mapNote.y} textAnchor="start">
                    {PLAN.mapNote.text}
                  </text>
                )}
              </svg>
              <figcaption className="amx-note">{PLAN.caption}</figcaption>
            </figure>

            {/* Selected stop */}
            <aside className="pt-card amx-stopcard" aria-live="polite">
              <span className="amx-phase__kicker">
                <PhaseDot phase={stop.phase} />
                {PLAN.phases.find((p) => p.id === stop.phase).name}
              </span>
              <h4 className="amx-stopcard__name">{stop.name}</h4>
              <p className="amx-stopcard__stay">{stop.stay}</p>
              <ul className="amx-ruled__list">
                {stop.hits.map((h, i) => <li key={i}>{h}</li>)}
              </ul>
            </aside>
          </div>

          <div className="amx-maply amx-maply--lower">
            {planId === 'a' ? (
              /* Plan A: canyon-loop zoom inset */
              <figure className="pt-card amx-mapcard">
                <div className="amx-strip__head">
                  <span className="syl-kicker">The canyon loop, zoomed</span>
                  <span className="amx-note">2 – 8 Jan · ~1,500 km · numbered in driving order</span>
                </div>
                <svg className="amx-map amx-map--inset" viewBox="0 0 210 140" role="group"
                     aria-label="Zoomed map of the canyon loop from Las Vegas">
                  <path className={`amx-leg amx-leg--drive amx-leg--desert${dimmed('desert') ? ' amx-leg--dim' : ''}`}
                        d={LOOP_PATH_INSET} />
                  <MapStop stop={PLAN.stops.find((s) => s.id === 'vegas')} cx={55} cy={88} r={4.5}
                           selected={stopId === 'vegas'} dim={dimmed('neon')} onSelect={setStopId} />
                  <text className={`amx-map__label${dimmed('neon') ? ' amx-map__label--dim' : ''}`}
                        x="46" y="112" textAnchor="middle">Las Vegas</text>
                  {PLAN.stops.filter((s) => s.loopOnly).map((s) => (
                    <MapStop key={s.id} stop={s} cx={s.ix} cy={s.iy} r={3.6}
                             selected={stopId === s.id} dim={dimmed('desert')} onSelect={setStopId} />
                  ))}
                  {PLAN.stops.filter((s) => s.loopOnly).map((s) => (
                    <text key={`${s.id}-il`}
                          className={`amx-map__label amx-map__label--num${dimmed('desert') ? ' amx-map__label--dim' : ''}`}
                          x={s.nx} y={s.ny} textAnchor="middle">
                      {s.inum}
                    </text>
                  ))}
                </svg>
                <figcaption className="amx-note">
                  1 Valley of Fire · 2 Zion · 3 Bryce · 4 Page · 5 Grand Canyon · 6 Route 66 · 7 Hoover Dam
                </figcaption>
              </figure>
            ) : (
              /* Plan B: the Starbase bet */
              <RuledList kicker="The Starbase bet — how the launch bucket-lister works" items={[
                'Starship flies from Boca Chica every few weeks, but dates slip days at a time — so the plan never depends on one.',
                'We give it a two-night window on South Padre (D16–D17). If a launch lands in it, Isla Blanca Park is the viewing spot — 8 km across the water from the pad.',
                'No launch? The Highway 4 drive-by still passes Mechazilla, the build site and stacked Starships, and the beach day stands on its own.',
                'Check the schedule two weeks out (checklist item) — if a date is holding, shuffle the SPI nights inside the Texas leg to meet it.',
              ]} />
            )}

            {/* Legs table — the no-hover twin of the map */}
            <div className="pt-card amx-tablecard">
              <span className="syl-kicker">Getting around</span>
              <div className="amx-tablewrap">
                <table className="amx-table">
                  <thead>
                    <tr><th>Leg</th><th>How</th><th>Time</th></tr>
                  </thead>
                  <tbody>
                    {PLAN.legsTable.map((r) => (
                      <tr key={r[0]}>
                        <td>{r[0]}</td><td>{r[1]}</td><td className="amx-num">{r[2]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── DAY BY DAY ──────────────────────────────────────────────────── */}
      {view === 'Day by Day' && (
        <div className="syl-panel" role="tabpanel">
          <div className="amx-legend" role="group" aria-label="Pick a chapter">
            {PLAN.phases.map((p) => (
              <button key={p.id}
                      className={`amx-legend__btn${dayPhase === p.id ? ' amx-legend__btn--on' : ''}`}
                      aria-pressed={dayPhase === p.id}
                      onClick={() => setDayPhase(p.id)}>
                <PhaseDot phase={p.id} />
                {p.name}
                <span className="amx-legend__days">{p.dates}</span>
              </button>
            ))}
          </div>

          <div className="pt-card amx-days">
            {days.filter((d) => d.phase === dayPhase).map((d) => (
              <div key={d.d} className="amx-day">
                <div className="amx-day__when">
                  <span className="amx-day__num">D{d.d}</span>
                  <span className="amx-day__date">{d.date}</span>
                </div>
                <div className="amx-day__body">
                  <span className="amx-day__title">{d.title}</span>
                  <ul className="amx-day__plan">
                    {d.plan.map((p, i) => <li key={i}>{p}</li>)}
                  </ul>
                </div>
                <div className="amx-day__bed">
                  <span className="amx-day__bedlabel">bed</span>
                  <span className="amx-day__bedval">{d.bed}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── NYE SHOWDOWN ────────────────────────────────────────────────── */}
      {view === 'NYE Showdown' && (
        <div className="syl-panel" role="tabpanel">
          <p className="syl-intro">{PLAN.nyeIntro}</p>
          <div className="amx-nye">
            {PLAN.nye.map((n) => (
              <button key={n.id}
                      className={`pt-card amx-nye__card${nye.id === n.id ? ' amx-nye__card--on' : ''}`}
                      aria-pressed={nye.id === n.id} onClick={() => setNyeId(n.id)}>
                <span className="amx-nye__city">
                  {n.city}
                  {n.pick && <span className="amx-nye__flag">our pick</span>}
                </span>
                <span className="amx-nye__event">{n.event}</span>
                <span className="amx-nye__fact">{n.fact}</span>
                <div className="amx-nye__scales">
                  {Object.entries(n.scores).map(([k, v]) => <DotScale key={k} label={k} score={v} />)}
                </div>
              </button>
            ))}
          </div>
          <div className="pt-card amx-verdict" aria-live="polite">
            <span className="syl-kicker syl-kicker--accent">The verdict · {nye.city} — {nye.event}</span>
            <p>{nye.verdict}</p>
          </div>
          <div className="pt-card amx-tablecard">
            <span className="syl-kicker">Side by side</span>
            <div className="amx-tablewrap">
              <table className="amx-table">
                <thead>
                  <tr><th>Where</th><th>The night</th><th>Scale</th><th>Our take</th></tr>
                </thead>
                <tbody>
                  {PLAN.nyeTable.map((r) => (
                    <tr key={r[0]} className={r[0] === PLAN.nyeHot ? 'amx-table__hot' : undefined}>
                      {r.map((c, i) => <td key={i}>{c}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── BUDGET ──────────────────────────────────────────────────────── */}
      {view === 'Budget' && (
        <div className="syl-panel" role="tabpanel">
          <div className="amx-budget__top">
            <div className="pt-card amx-hero">
              <span className="syl-kicker">Per person · AUD · rough cut · {PLAN.name}</span>
              <span className="amx-hero__num">{money(total(mode))}</span>
              <span className="amx-hero__sub">{PLAN.heroSub[mode]}</span>
            </div>
            <div className="amx-mode" role="group" aria-label="Budget scenario">
              <button className={`amx-mode__btn${mode === 'lean' ? ' amx-mode__btn--on' : ''}`}
                      aria-pressed={mode === 'lean'} onClick={() => setMode('lean')}>
                Lean · {money(total('lean'))}
              </button>
              <button className={`amx-mode__btn${mode === 'send' ? ' amx-mode__btn--on' : ''}`}
                      aria-pressed={mode === 'send'} onClick={() => setMode('send')}>
                Send it · {money(total('send'))}
              </button>
            </div>
          </div>

          <div className="pt-card amx-bars">
            {PLAN.budget.map((b) => (
              <div key={b.cat} className="amx-bar">
                <span className="amx-bar__label">
                  {b.cat}
                  <span className="amx-bar__note">{b.note}</span>
                </span>
                <div className="amx-bar__track">
                  <span className="amx-bar__fill" style={{ width: `${(b[mode] / PLAN.budgetMax) * 100}%` }} />
                </div>
                <span className="amx-bar__val">{money(b[mode])}</span>
              </div>
            ))}
            <p className="amx-note">{PLAN.budgetNote}</p>
          </div>
        </div>
      )}

      {/* ── PLAYBOOK ────────────────────────────────────────────────────── */}
      {view === 'Playbook' && (
        <div className="syl-panel" role="tabpanel">
          <div className="pt-card amx-progress">
            <div className="amx-strip__head">
              <span className="syl-kicker syl-kicker--accent">Locked in · {PLAN.name}</span>
              <span className="amx-note">{done} of {PLAN.checklist.length} — ticks stick between visits, per plan</span>
            </div>
            <div className="amx-progress__track" role="img"
                 aria-label={`${done} of ${PLAN.checklist.length} bookings locked in`}>
              <span className="amx-progress__fill" style={{ width: `${(done / PLAN.checklist.length) * 100}%` }} />
            </div>
          </div>

          <div className="pt-card amx-checks">
            {PLAN.checklist.map((c) => (
              <label key={c.id} className={`amx-check${planChecks[c.id] ? ' amx-check--done' : ''}`}>
                <input type="checkbox" checked={Boolean(planChecks[c.id])}
                       onChange={() => setChecks((prev) => ({
                         ...prev,
                         [planId]: { ...prev[planId], [c.id]: !prev[planId][c.id] },
                       }))} />
                <span className="amx-check__box" aria-hidden="true"><Icon name="check" size={11} /></span>
                <span className="amx-check__label">{c.label}</span>
                <span className="amx-check__why">{c.why}</span>
                <span className="amx-check__when">{c.when}</span>
              </label>
            ))}
          </div>

          <RuledList kicker="Street smarts" items={PLAN.smarts} />
        </div>
      )}
    </div>
  );
}
