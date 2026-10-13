import { lazy, Suspense } from 'react';

/* ============================================================================
   SEMINAR · THREE DECKS  (University)            /portal/seminar-decks
   ----------------------------------------------------------------------------
   Three complete presentations of the CITS4010 honours seminar, built to be
   compared: "One Scan, Start to Finish", "Does Mamba Earn Its Place?" and "How
   Much of the Body Does a Model Need to See?". Each has a slide sorter, a
   script view with a transcript for every slide, present mode, a two-window
   presenter view, a Ready check that makes the talk run offline, and PDFs.

   The registry imports this file eagerly, so it stays tiny: everything else
   (the engine, the decks, their motion graphics) is lazy-loaded below and lands
   in its own chunks. Media is served from public/seminar-decks/. No local-only
   gate: the page is meant to run on the live site.
   Engine notes: seminar-decks/engine/*.js; facts: shared/facts.js;
   working folder: dissertation repo documents/presentation/seminar-decks/.
   ========================================================================== */

const DeckApp = lazy(() => import('./DeckApp.jsx'));

export default function SeminarDecks() {
  return (
    <Suspense fallback={<div className="pt-module"><p className="pt-module__intro">Loading the seminar decks...</p></div>}>
      <DeckApp />
    </Suspense>
  );
}
