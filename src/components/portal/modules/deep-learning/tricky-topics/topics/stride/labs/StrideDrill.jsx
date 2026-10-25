import { Code } from '../../../../kit';
import DrillFrame from '../../../DrillFrame';
import StripView from './StripView';
import { stripHeight } from '../strip.js';
import { make, FIXED } from '../drill';
import './stride.css';

/* The topic's exam drill: ../drill.js in the shared frame. "cnn" questions
   show their generated code; size questions draw the window strip with the
   working, so the answer can be checked against the picture. */

function renderShow(q) {
  if (q.show?.code) return <Code code={q.show.code} label="model.py · generated" />;
  return null;
}

function Strip({ n, k, s, pad }) {
  const W = 360;
  const h = stripHeight(n, k, s, pad, W - 20);
  return (
    <svg className="dltt-svg dltt-drill__strip" viewBox={`0 0 ${W} ${h + 22}`} role="img" aria-label={`${n} inputs, kernel ${k}, stride ${s}, ${pad}`}>
      <StripView x={10} y={6} n={n} k={k} s={s} pad={pad} width={W - 20} idPrefix={`dq-${pad}`} />
      <text x={W / 2} y={h + 18} textAnchor="middle" className="dltt-t dltt-t--xs dltt-t--m">padding="{pad}"</text>
    </svg>
  );
}

function renderWorking(q) {
  const st = q.strip;
  if (!st) return null;
  return (
    <div className="dltt-drill__strips">
      {st.pad === 'both' ? (
        <>
          <Strip n={st.n} k={st.k} s={st.s} pad="valid" />
          <Strip n={st.n} k={st.k} s={st.s} pad="same" />
        </>
      ) : (
        <Strip n={st.n} k={st.k} s={st.s} pad={st.pad} />
      )}
      {!st.full && <p className="dltt-mnote">Drawn for the first 20 inputs only; the rule is the same.</p>}
    </div>
  );
}

export function StrideDrill() {
  return <DrillFrame make={make} fixed={FIXED} renderShow={renderShow} renderWorking={renderWorking} printSet={[1, 3, 6]} />;
}
