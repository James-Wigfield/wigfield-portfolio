import { useMemo, useState } from 'react';
import Icon from '../../../icons';
import { useStudy } from './context';
import { Rich } from './Rich';
import { Switch } from './stage';
import { topicStore } from './storage';
import { checkField } from './drillCheck';

/* ============================================================================
   TRICKY TOPICS — THE EXAM DRILL FRAME (shared by every topic)
   ----------------------------------------------------------------------------
   A topic's drill is its generator (topics/<id>/drill.js: make(seed, mode) →
   a question) plus how to draw a question's stimulus (renderShow). This frame
   does the rest, the same way in every topic:

     source    "New question" (seeded random, endless) or "From the unit"
               (the topic's fixed questions, in order)
     mode      optional (e.g. count ↔ reverse)
     answer    one input per field (numbers, shapes, choices); Enter checks
     feedback  right / wrong per field, then the working — the rule and the
               numbers — so a wrong answer teaches (renderWorking(q) may add
               a picture under it)
     score     dltt:<topic>:drill { tried, right }
     print     a short worked set (printSet seeds + the fixed questions),
               answers and working written out

   A question: { id, title?, prov?, prompt, show?, fields: [{ key, label,
   answer, type: 'number' | 'text' | 'choice', options?, accept? }],
   working: [lines] } — all text in Rich markup.
   ========================================================================== */

function Field({ f, value, onChange, onEnter, state, idPrefix }) {
  const cls = `dltt-drill__in${state === true ? ' dltt-drill__in--ok' : state === false ? ' dltt-drill__in--no' : ''}`;
  const id = `${idPrefix}-${f.key}`;
  if (f.type === 'choice') {
    return (
      <select id={id} className={cls} value={value ?? ''} onChange={(e) => onChange(e.target.value)} aria-label={f.aria ?? f.key}>
        <option value="">choose…</option>
        {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    );
  }
  return (
    <input
      id={id}
      className={cls}
      type="text"
      inputMode={f.type === 'number' ? 'numeric' : 'text'}
      autoComplete="off"
      spellCheck={false}
      value={value ?? ''}
      placeholder={f.placeholder ?? (f.type === 'number' ? 'count' : '')}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onEnter(); } }}
      aria-label={f.aria ?? f.key}
      style={f.width ? { width: f.width } : undefined}
    />
  );
}

function shown(f) {
  if (f.type === 'choice') return f.options.find((o) => o.value === f.answer)?.label ?? f.answer;
  return f.type === 'number' ? Number(f.answer).toLocaleString('en-US') : f.answer;
}

function Question({ q, renderShow, renderWorking, live, idPrefix, onScore, after = null }) {
  const [vals, setVals] = useState({});
  const [checked, setChecked] = useState(false);
  const [showWork, setShowWork] = useState(false);
  const marks = useMemo(() => (checked ? Object.fromEntries(q.fields.map((f) => [f.key, checkField(f, vals[f.key])])) : {}), [checked, q, vals]);
  const allRight = checked && q.fields.every((f) => marks[f.key]);
  const check = () => {
    if (!live) return;
    if (!checked) onScore(q.fields.every((f) => checkField(f, vals[f.key])));
    setChecked(true);
  };
  return (
    <div className="dltt-drill__q">
      {q.title && <p className="dltt-drill__k">{q.title}{q.prov && <> · <Rich text={q.prov} /></>}</p>}
      <p className="dltt-drill__prompt"><Rich text={q.prompt} /></p>
      {q.show !== undefined && renderShow ? renderShow(q) : null}
      <table className="dltt-drill__table">
        <thead>
          <tr><th>{q.fieldHead ?? 'Asked'}</th><th>{live ? 'Your answer' : 'Answer'}</th>{live && <th aria-label="mark" />}</tr>
        </thead>
        <tbody>
          {q.fields.map((f) => (
            <tr key={f.key}>
              <td><label htmlFor={`${idPrefix}-${f.key}`}><Rich text={f.label} /></label></td>
              <td>
                {live ? (
                  <Field f={f} idPrefix={idPrefix} value={vals[f.key]} onChange={(v) => { setVals((p) => ({ ...p, [f.key]: v })); setChecked(false); }} onEnter={check} state={checked ? marks[f.key] : undefined} />
                ) : (
                  <b className="dltt-mono">{shown(f)}</b>
                )}
              </td>
              {live && (
                <td>
                  {checked && (
                    <span className={`dltt-mark ${marks[f.key] ? 'dltt-mark--ok' : 'dltt-mark--no'}`}>
                      {marks[f.key] ? 'right' : `no: ${shown(f)}`}
                    </span>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {live && (
        <div className="dltt-drill__btns">
          <button type="button" className="dltt-btn dltt-btn--primary" onClick={check}>Check</button>
          <button type="button" className="dltt-btn" aria-expanded={showWork || checked} onClick={() => setShowWork((s) => !s)}>{showWork || checked ? 'Working shown' : 'Show the working'}</button>
          {allRight && <span className="dltt-mark dltt-mark--ok">all right</span>}
          {after}
        </div>
      )}
      {(!live || checked || showWork) && (
        <div className="dltt-working">
          {q.working.map((w, i) => <p key={i} className="dltt-working__line"><Rich text={w} /></p>)}
          {renderWorking ? renderWorking(q) : null}
        </div>
      )}
    </div>
  );
}

export default function DrillFrame({ make, fixed = [], modes, renderShow, renderWorking, printSet = [1, 2, 3], intro }) {
  const { topicId, printing } = useStudy();
  const store = useMemo(() => topicStore(topicId), [topicId]);
  const [source, setSource] = useState('random');
  const [mode, setMode] = useState(modes?.[0]?.value);
  const [seed, setSeed] = useState(1);
  const [unitIdx, setUnitIdx] = useState(0);
  const [score, setScore] = useState(() => {
    const s = store.load('drill', null);
    return s && Number.isFinite(s.tried) && Number.isFinite(s.right) ? s : { tried: 0, right: 0 };
  });
  const q = source === 'unit' && fixed.length ? fixed[unitIdx % fixed.length] : make(seed, mode);
  const onScore = (right) => {
    setScore((prev) => {
      const next = { tried: prev.tried + 1, right: prev.right + (right ? 1 : 0) };
      store.save('drill', next);
      return next;
    });
  };
  const next = () => {
    if (source === 'unit') setUnitIdx((i) => (i + 1) % Math.max(1, fixed.length));
    else setSeed(1 + Math.floor(Math.random() * 99999));
  };
  const printQs = [...printSet.map((s) => make(s, modes?.[0]?.value)), ...fixed.slice(0, 2)];

  return (
    <div className="dltt-drill">
      <div className="dltt-drill__live">
        <div className="dltt-drill__bar">
          <Switch
            label="Question source"
            value={fixed.length ? source : 'random'}
            onChange={setSource}
            options={[{ value: 'random', label: 'Random' }, ...(fixed.length ? [{ value: 'unit', label: `From the unit (${fixed.length})` }] : [])]}
          />
          {modes && source === 'random' && <Switch label="Drill mode" value={mode} onChange={setMode} options={modes} />}
          <span className="dltt-drill__score" aria-live="polite"><b>{score.right}</b>/{score.tried} right{source === 'random' ? ` · question #${seed}` : ` · ${unitIdx % Math.max(1, fixed.length) + 1} of ${fixed.length}`}</span>
        </div>
        {intro && <p className="dltt-sec__lead"><Rich text={intro} /></p>}
        <Question
          key={`${source}-${mode}-${seed}-${unitIdx}`}
          q={q}
          renderShow={renderShow}
          renderWorking={renderWorking}
          live
          idPrefix={`dltt-${topicId}-dq`}
          onScore={onScore}
          after={(
            <button type="button" className="dltt-btn dltt-drill__next" onClick={next}>
              {source === 'unit' ? 'Next unit question' : 'New question'} <Icon name="arrowRight" size={14} />
            </button>
          )}
        />
      </div>
      {printing && (
        <div className="dltt-drill__print">
          <p className="dltt-drill__k">A worked set: generated questions (this page’s own) and questions from the unit, with answers and working.</p>
          {printQs.map((pq, i) => <Question key={`${pq.id}-${i}`} q={pq} renderShow={renderShow} renderWorking={renderWorking} live={false} idPrefix={`dltt-${topicId}-pq${i}`} onScore={() => {}} />)}
        </div>
      )}
    </div>
  );
}
