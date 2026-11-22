/* What the (nameless) assessor says, phase by phase, in a realistic order:
   T2 lines → T3 briefing → T4 pre-start → T5 log on → T6 depart → T8 transit
   → T9 controlled stop → T7 man overboard (sprung at a random moment once
   underway) → T10 return and dock → T11 log off.
   Workbook p.91: the assessor can repeat an instruction but can't tell you how
   to skipper — so the captions say WHAT to do, never HOW. Task 1 has no
   caption: it's assessed throughout (p.92). Pure data, runs in Node. */

export const ORDER = ['t2', 't3', 't4', 't5', 't6', 't8', 't9', 't7', 't10', 't11'];

export const INTRO = [
  'G’day. I’ll give you instructions as we go — if anything’s unclear, just ask and I’ll say it again.',
  'You’re the skipper today. If I ask for something you reckon isn’t safe, tell me and don’t do it.',
  'I’ll be jotting notes the whole time. Don’t read anything into that.',
];

export const CAPTIONS = {
  t2: [
    'Righto — before we go anywhere, check the mooring lines and the fittings you’ll be using.',
    'Show me what you’re checking. Then untie her and secure the boat again yourself.',
  ],
  t3: [
    'Now give everyone on board a safety briefing for where we’re heading today.',
    'Show us the gear, where it lives, and what we need to wear.',
  ],
  t4: [
    'Do your pre-start checks, then start the motor when you’re ready.',
  ],
  t5: [
    'Before we head off, log on with Marine Rescue for the trip.',
    'Radio call, written down, whatever you like — I just need the details.',
  ],
  t6: [
    'Okay skipper, take us off the berth whenever you’re ready.',
  ],
  t8: [
    'Find yourself a transit — two things that line up.',
    'Tell me what they are, then steer along it for me.',
  ],
  t9: [
    'Bring her up to about five knots and hold a straight line.',
    'In a moment I’ll ask you to stop. … Stop the boat.',
  ],
  t7: [
    'MAN OVERBOARD!',
  ],
  t10: [
    'Good. Take us back in and put her alongside the berth.',
    'Secure the boat once you’re there.',
  ],
  t11: [
    'Last thing — log off with Marine Rescue.',
  ],
};

/* Short acknowledgements once a task's last action is done. Neutral on
   purpose: a real assessor doesn't say how you went until the end (p.91). */
export const ACKS = {
  t2: 'Thanks. That’ll hold her.',
  t3: 'Thanks skipper.',
  t4: 'Righto, motor’s running.',
  t5: 'Got that, thanks.',
  t6: 'Okay.',
  t8: 'That’ll do, thanks.',
  t9: 'Righto.',
  t7: 'Good — he’s back aboard.',
  t10: 'Thanks. Engine off when you’re ready.',
  t11: 'That’s the lot. Let’s have a chat about how you went.',
};

/* Cautions the assessor may say during the run (Task 1 first strike, etc.). */
export const CAUTIONS = {
  speed: 'Keep an eye on your speed through here.',
  wash: 'Watch your wash near those boats.',
  starboard: 'Which side of the channel should we be on?',
  seated: 'Everyone sitting down?',
  depth: 'Watch your depth.',
  repeat: 'No worries, I’ll say that again.',
};

export const END = {
  pass: 'Well done — that’s a pass. Here’s where you dropped marks and what to work on.',
  fail: 'That’s not a pass today, sorry. Here’s what happened — book in for another day and you’ll be right.',
  unsafe: 'I’m going to stop the assessment there — that wasn’t safe.',
  stopped: 'More than six missed, so we’ll stop it there. Book in for another day.',
};

/* Task 3 safety briefing — the game's answer key.
   Area: the practical runs from the Rockingham foreshore ramps in Mangles Bay
   (Cockburn Sound) and stays close in — within 400 m of the shore, which the
   workbook defines as PROTECTED WATERS (p.49 definitions: "waters within 400
   metres of the shore in unprotected waters"). For a registrable vessel in
   protected waters the 2026 table (p.49) REQUIRES only lifejackets carried
   (minimum Level 100, one per person) — for boats under 4.8 m, 4.8 m and
   larger, and children 1–12 alike. Distress beacon, flares/EVDS, marine
   radio and the additional gear (anchor + line, fire extinguisher, means of
   removing water) are all RECOMMENDED there, not required. Beacon + flares
   become required beyond 400 m; VHF/HF radio beyond 4 NM (p.49). */
export const BRIEFING = {
  area: 'Mangles Bay off the Rockingham foreshore, staying within 400 m of the shore (protected waters)',
  areaPage: 49,
  required: [
    { hs: 'hs_lifejackets', name: 'Lifejackets — minimum Level 100, one for each person on board', page: 49 },
  ],
  optional: [
    { hs: 'hs_epirb', name: 'GPS EPIRB / PLB (recommended here; required beyond 400 m)', page: 49 },
    { hs: 'hs_flares', name: 'Flares — 2 red + 2 orange, or an EVDS (recommended here; required beyond 400 m)', page: 49 },
    { hs: 'hs_radio', name: 'Marine radio (recommended; VHF/HF required beyond 4 NM)', page: 49 },
    { hs: 'hs_anchor', name: 'Anchor and line (recommended)', page: 49 },
    { hs: 'hs_extinguisher', name: 'Fire extinguisher (recommended)', page: 49 },
    { hs: 'hs_bilge', name: 'Bilge pump — a means of removing water (recommended)', page: 49 },
    { hs: 'hs_bucket', name: 'Bucket / bailer — a means of removing water (recommended)', page: 49 },
  ],
  wearing: {
    options: [
      { id: 'carry', text: 'Carried, ready to grab: a Level 100 lifejacket for everyone. Put it on if I say so.' },
      { id: 'wear_u12', text: 'Kids aged 1 to 12 must wear theirs; adults just carry one.' },
      { id: 'wear', text: 'Everyone must wear a lifejacket the whole time we’re out.' },
    ],
    correct: 'carry',
    page: 49,
    why: 'Within 400 m of shore (protected waters) the table only requires lifejackets to be CARRIED, for every boat size and for children 1–12 (p.49). Wearing kicks in beyond 400 m: everyone on boats under 4.8 m, and children 1–12 on any boat.',
  },
  check: { text: 'Does everyone understand? Any questions?', page: 94 },
};
