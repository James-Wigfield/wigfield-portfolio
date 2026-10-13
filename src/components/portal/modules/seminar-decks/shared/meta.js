/* ============================================================================
   SEMINAR DECKS — TALK METADATA (shared by all three decks)
   The title is the published seminar abstract's, word for word
   (documents/presentation/abstract/23334375-abstract-and-title.txt; its LaTeX
   en dash is written as a hyphen on screen).
   ========================================================================== */

export const TALK = {
  title: 'Segmenting Metastatic Prostate Cancer in Whole-Body PET Scans with a Hybrid CNN-Mamba Network',
  presenter: 'James Wigfield',
  supervisors: ['Dr Jake Kendrick', 'Dr Mubashar Hassan'],
  supervisorsLine: 'Supervised by Dr Jake Kendrick and Dr Mubashar Hassan',
  unit: 'CITS4010 Honours seminar',
  degree: 'Bachelor of Advanced Computer Science (Honours)',
  group: 'UWA Medical Physics Research Group',
  university: 'The University of Western Australia',
};

// The progress rail: the talk's five parts. 'mine' is the student's contribution.
export const PARTS = [
  { id: 'problem', label: 'Problem' },
  { id: 'previous', label: 'Previous work' },
  { id: 'mine', label: 'My work' },
  { id: 'results', label: 'Results' },
  { id: 'meaning', label: 'What it means' },
];

// The data attribution required on every slide that shows scans (licences checked
// 2026-10-09: jeblick2026 "Data availability" p. 9, CC BY 4.0; jackson2025 p. 7, CC BY).
export const ATTRIBUTION = 'Data: autoPET-III PSMA (Jeblick et al., Sci Data 2026, CC BY 4.0); DEEP-PSMA challenge (CC BY)';

// Verdict states for H1 to H4 (tab:disc-hypotheses). Decks pick their own colours,
// but every state also has a label and a glyph, so colour never carries it alone.
export const VERDICTS = {
  pending: { label: 'pending', glyph: 'pending' },
  trade: { label: 'supported, as a trade', glyph: 'trade' },
  not: { label: 'not supported', glyph: 'not' },
  reversed: { label: 'reversed on the primary set', short: 'reversed', glyph: 'reversed' },
};

// Plain one-line forms of chapters/01-introduction.tex:101-143; verdicts from
// chapters/05-discussion.tex tab:disc-hypotheses. Digits only through {{keys}}.
export const HYPOTHESES = [
  { id: 'H1', name: 'Detection', line: 'The hybrid beats PSMASegmentator in pooled F1 on {{fair.n}} scans neither model trained on.', verdict: 'trade' },
  { id: 'H2', name: 'Loss', line: 'A loss weighted against misses lifts sensitivity and keeps precision high.', verdict: 'not' },
  { id: 'H3', name: 'Efficiency', line: 'At equal network passes, the hybrid is faster and uses less memory.', verdict: 'not' },
  { id: 'H4', name: 'Context', line: 'A bigger training window helps the hybrid more than its CNN-only twin.', verdict: 'reversed' },
];
