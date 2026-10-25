import { Code } from '../../../../kit';
import DrillFrame from '../../../DrillFrame';
import { make, FIXED } from '../drill';
import './shapes.css';

/* The topic's exam drill: ../drill.js in the shared frame. A "trace"
   question shows its generated model as code. */

function renderShow(q) {
  if (q.show?.code) return <Code code={q.show.code} label="model.py · generated" />;
  return null;
}

export function ShapesDrill() {
  return <DrillFrame make={make} fixed={FIXED} renderShow={renderShow} printSet={[1, 4, 9]} />;
}
