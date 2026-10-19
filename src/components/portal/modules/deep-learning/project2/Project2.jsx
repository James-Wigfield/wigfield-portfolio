import { lazy, Suspense } from 'react';

/* ============================================================================
   CITS5017 · PROJECT 2 — EXPLAINED NOTEBOOK  (portal · Deep Learning)
   ----------------------------------------------------------------------------
   The registry's entry point. The page itself — the generated notebook data,
   the figures and every explainer scene — sits behind this lazy boundary so
   none of it lands in the portal's main bundle (the dl-game precedent).

   Regenerate after the notebook changes:
     node tools/dl-project2/extract.mjs
   ========================================================================== */

const NotebookView = lazy(() => import('./NotebookView'));

function Loading() {
  return (
    <div className="dlp2-loading" role="status">
      <span className="dlp2-loading__dot" aria-hidden="true" />
      Opening the notebook…
    </div>
  );
}

export default function Project2() {
  return (
    <div className="pt-module dlp2-module">
      <Suspense fallback={<Loading />}>
        <NotebookView />
      </Suspense>
    </div>
  );
}
