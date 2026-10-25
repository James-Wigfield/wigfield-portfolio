import DrillFrame from '../../../DrillFrame';
import { make, FIXED } from '../drill';

/* REPLACE ME — the topic's drill: its generator (../drill.js) in the shared
   frame. renderShow(q) draws a question's stimulus (code, a diagram, a
   table) when the question has a `show`. */

export function Drill() {
  return <DrillFrame make={make} fixed={FIXED} printSet={[1, 2]} />;
}
