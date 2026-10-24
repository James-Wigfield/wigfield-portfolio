import { createContext, useContext } from 'react';

/* ============================================================================
   EXAM PRACTICE — SHARED STATE FOR THE PAPER
   ----------------------------------------------------------------------------
   ExamPractice.jsx provides one value:
     reveal    { [leafId]: true }      answers written onto the paper
     fresh     Set<leafId>             revealed this visit (plays the ink-in)
     marks     { [leafId]: number }    self-marks
     filter    'all' | lecture code     parts off the filter are dimmed
     picks     Set<leafId>             parts the NotebookLM video works through
     printing  boolean                  the Export PDF layout is up
     setReveal(ids, on) · setMark(id, n | null)
   ========================================================================== */

export const XpCtx = createContext(null);
export const useXp = () => useContext(XpCtx);
