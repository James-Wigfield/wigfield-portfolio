import DrillFrame from '../../../DrillFrame';
import { make, FIXED } from '../drill';

/* The topic's exam drill: ../drill.js in the shared frame. No question has a
   stimulus (`show`), so no renderShow is needed. */

export function SoftmaxDrill() {
  return <DrillFrame make={make} fixed={FIXED} printSet={[2, 5, 11]} />;
}
