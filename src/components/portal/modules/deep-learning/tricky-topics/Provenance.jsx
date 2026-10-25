import { PROV_TEXT } from './richToken';

/* ============================================================================
   TRICKY TOPICS — PROVENANCE LABELS
   ----------------------------------------------------------------------------
   Every number and claim on the page says where it comes from, with one of
   three quiet outlined labels (never filled, never a pill), used the same
   way in Read, Play, drills, notebook pages and the PDF:

     slide    "L3 · slide 22"                      a slide states or prints it
     own      "this page's own · checked in TF"    computed by this page and
                                                   verified by verify_counts.py
     beyond   "beyond the slides"                  true and useful, but not in
                                                   the lecture notes (the exam
                                                   note: not examined)

   They differ by more than colour: a slide receipt is a solid hairline box,
   "own" carries a small dot, "beyond" a dashed box. In Rich markup they are
   {s|L3 · slide 22}, {own} and {beyond}.
   ========================================================================== */

export default function Prov({ kind = 'slide', text }) {
  const label = text ?? PROV_TEXT[kind] ?? '';
  return (
    <span className={`dltt-prov dltt-prov--${kind}`} title={kind === 'beyond' ? 'Not in the lecture notes: support, not syllabus' : kind === 'own' ? 'Computed by this page and checked in TensorFlow' : 'Where the slides state it'}>
      {label}
    </span>
  );
}
