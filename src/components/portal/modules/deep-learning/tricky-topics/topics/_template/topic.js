/* ============================================================================
   TOPIC · __TOPIC_TITLE__  (topics/__TOPIC_ID__/topic.js)
   ----------------------------------------------------------------------------
   REPLACE ME — this file is the scaffold's copy of topics/_template. Every
   string marked "REPLACE ME" is placeholder text. The schema, budgets and
   provenance rules are in ../../ADDING-A-TOPIC.md; the checks enforce them.

     id, title      must match this topic's line in ../index.js
     lectures       the decks it draws on, as the tabs show them: 'L1' … 'L9'
                    ('L6–7' with an en dash)
     oneLine        what it is, in one plain sentence
     printLead      the PDF's opening paragraph (2–3 sentences)
     hero           { lab: key in labs/index.js, caption }
     showsUp        [{ at: 'L3 · slide 22', what }] — a real slide each
     examAsks       [{ form, what, part }] — part = an Exam Practice part
     steps          [{ id, title, short, prov, gist, read, play, cards? }]
                    gist = one bold sentence; read ≤ 120 words of strings /
                    { list } with at most ONE { table } or { eq }; play = lab
                    keys (one lab per step); prov = Rich provenance labels
     drill          { lab: 'drill', title, blurb, prov }
   Provenance in any text: {s|L3 · slide 22}  {own}  {beyond}
   ========================================================================== */

export default {
  id: '__TOPIC_ID__',
  title: '__TOPIC_TITLE__',
  lectures: ['L1'],
  oneLine: 'REPLACE ME: what __TOPIC_TITLE__ is, in one plain sentence.',
  printLead: 'REPLACE ME: the PDF’s opening paragraph. Say what the topic is, which lectures it draws on, and how to read the provenance labels.',
  hero: { lab: 'hero', caption: 'REPLACE ME: one sentence saying what the hero animation shows. Click to replay.' },
  showsUp: [
    { at: 'L1 · slide 36', what: 'REPLACE ME: where the unit uses it, and what that slide shows.' },
  ],
  examAsks: [
    { form: 'Code', what: 'REPLACE ME: the stimulus type and what is asked.', part: 'Sample Q1(c)' },
  ],
  steps: [
    {
      id: 'idea',
      title: 'REPLACE ME: the first idea',
      short: 'The first idea',
      prov: '{s|L1 · slide 36}',
      gist: 'REPLACE ME: one bold gist sentence.',
      read: [
        { list: [
          'REPLACE ME: a short bullet {s|L1 · slide 36}.',
          'REPLACE ME: something true but not in the lecture notes {beyond}.',
        ] },
        { eq: { name: 'REPLACE ME: the key formula', tex: 'y = (n_{\\text{in}} + 1) \\times n', read: 'REPLACE ME: the formula in words' } },
      ],
      play: ['idea'],
    },
  ],
  drill: { lab: 'drill', title: 'Exam drill', blurb: 'REPLACE ME: one line on what the drill asks.', prov: '{own}' },
};
