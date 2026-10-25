import { Code } from '../../../../kit';
import DrillFrame from '../../../DrillFrame';
import FormView from '../FormView';
import { make, FIXED, MODES } from '../drill';
import './param.css';

/* The topic's exam drill: ../drill.js in the shared frame. A question's
   stimulus is the model in its form (FormView) — or, for questions from the
   unit, the slide's own code. */

function renderShow(q) {
  const s = q.show;
  if (!s) return null;
  if (s.listing) return <Code code={s.listing.code} label={s.listing.label} />;
  return <div className="dltt-drill__show"><FormView model={s.model} form={s.form} blanks={s.blanks} compact /></div>;
}

export function ParamDrill() {
  return <DrillFrame make={make} fixed={FIXED} modes={MODES} renderShow={renderShow} printSet={[3, 8, 21]} />;
}
