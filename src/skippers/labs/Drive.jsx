import { lazy, Suspense } from 'react';

/* LEVEL 09 → "Drive it": the practical-assessment simulator. The whole sim
   (three.js, physics, criteria engine) is its own lazy chunk so the rest of
   /skippers doesn't grow. Code: src/skippers/sim/. */
const SimApp = lazy(() => import('../sim/SimApp'));

export default function Drive() {
  return (
    <Suspense fallback={<p className="sk-stage__cap">Loading the boat…</p>}>
      <SimApp />
    </Suspense>
  );
}
