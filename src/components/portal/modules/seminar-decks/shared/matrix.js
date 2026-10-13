/* ============================================================================
   SEMINAR DECKS — COMPARISON MATRIX AND RECOMMENDATION (landing page)
   From the critics' reports in the working folder (dissertation repo,
   documents/presentation/seminar-decks/): critic-examiner.md (marks against
   the seminar marking sheet) and critic-design.md (design and projector
   legibility). The marks were given to the first complete versions (13 Oct,
   before the revision round that applied the critics' fixes).
   ========================================================================== */

export const MATRIX = {
  note: 'Marks from the examiner critic (marking sheet) and the design critic, given to the first complete versions before the revision round that applied their fixes.',
  rows: [
    {
      criterion: 'Oral and visual (/10)',
      scores: { 'one-scan': 7, verdict: 6, context: 8 },
      notes: {
        'one-scan': 'Strongest hook; slides 7 and 12 hard to read.',
        verdict: 'Text-heavy; small figure and clip.',
        context: 'Most legible; countdown hook.',
      },
    },
    {
      criterion: 'Structure and content (/10)',
      scores: { 'one-scan': 7, verdict: 8, context: 6 },
      notes: {
        'one-scan': 'Clear story; overloaded ending.',
        verdict: 'Clearest map: question, predictions, verdicts.',
        context: 'Overview late; result shown in Problem.',
      },
    },
    {
      criterion: 'Technical content and questions (/20)',
      scores: { 'one-scan': 14, verdict: 16, context: 15 },
      notes: {
        'one-scan': 'Clear methods; no contribution statement.',
        verdict: 'Research question to verdicts; honest caveats.',
        context: 'Best motivation of H4; narrow conclusion.',
      },
    },
    { criterion: 'Total (/40)', scores: { 'one-scan': 28, verdict: 30, context: 29 }, total: true },
    {
      criterion: 'Design (/10), design critic',
      scores: { 'one-scan': 8, verdict: 7, context: 7 },
      notes: {
        'one-scan': 'Clips and deck read as one film.',
        verdict: 'Most "human"; table and chart issues.',
        context: 'Clean suite; overview cards looked templated.',
      },
    },
    {
      criterion: 'Projector legibility (/10), design critic',
      scores: { 'one-scan': 8, verdict: 6, context: 7 },
    },
  ],
};

export const RECOMMENDATION = 'Present "Does Mamba Earn Its Place?" (verdict). It follows the marking sheet most closely: the research question, four written-down predictions, a verdict for each, the limitations, a direct answer, the contribution and one next step, and its last frame keeps all of that on screen for questions. It is also the most defensible under questioning. Its weak spots were text density and multimedia; the revision round thinned the text, enlarged the architecture figure and the case A exhibit, and fixed the two design must-fixes. Take one-scan if you want the strongest story with the clips, or context if you value legibility and the countdown hook over structure.';
