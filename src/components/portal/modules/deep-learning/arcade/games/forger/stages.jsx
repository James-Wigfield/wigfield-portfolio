import { useEffect, useMemo, useState } from 'react';
import { Prompt, Feedback } from '../../kit/RoundShell';
import { Keypad, ShapePad } from '../../kit/Keypad';
import { Choice } from '../../kit/Choice';
import { Maths, MLine } from '../../kit/Maths';
import { fill, fmt, fmtChange, ROW_KEYS, loopLines, dcganNet } from '../../maths/forger';
import { demo, frameAt, coverHistory } from '../../maths/forgerStudio';
import { UI, LOOP, GUIDELINES, STUDIO } from '../../content/forger';
import { Studio, Legend, CoverStrip, Tray, NetDiagram, CodeView, CodeText } from './parts.jsx';

/* ============================================================================
   FORGER — THE STATIONS (one per item type; each is keyed by the item id,
   so its local state resets per item). Words: content/forger.js; numbers
   and runs: maths/forger.js and maths/forgerStudio.js.
   ========================================================================== */

const fmtAns = (a, it) => (typeof it?.format === 'function' ? it.format(a) : String(a));
const isLive = (round) => !round.feedback && round.state === 'play';
const count = (round) => `${round.index + 1} / ${round.total}`;
const isCode = (s) => typeof s === 'string' && s.startsWith('`');

function Pick({ item, round, columns = 1 }) {
  const live = isLive(round);
  const reveal = !!round.feedback;
  const choices = item.choices.map((c) => ({
    value: c.value,
    label: isCode(c.label) ? <code className="dla-fg__ccode"><CodeText code={c.label.replace(/`/g, '')} /></code> : c.label,
    aria: c.label.replace(/`/g, ''),
  }));
  return <Choice choices={choices} onPick={(v) => live && round.submit(v)} picked={reveal ? round.feedback.given : null} answer={reveal ? item.answer : null} active={live} columns={columns} label={UI.pick} />;
}

function Own({ t, extra = null }) {
  return (
    <p className="dla-fg__cap">
      <span className="dla-own">{UI.own}</span>
      <span className="dla-fg__lab">{fill(UI.iteration, { t })}</span>
      {extra}
    </p>
  );
}

function ChangeLines({ dm }) {
  return (
    <>
      <MLine text={fill(UI.dMax, { d: dm.dMax === 0 ? `\\text{${UI.exactly0}}` : fmtChange(dm.dMax) })} />
      <MLine text={fill(UI.gMax, { g: dm.gMax === 0 ? `\\text{${UI.exactly0}}` : fmtChange(dm.gMax) })} />
    </>
  );
}

const useEnter = (live, fn) => {
  useEffect(() => {
    if (!live) return undefined;
    const onKey = (e) => {
      if (e.key !== 'Enter' || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.target && /^(button|input|textarea|select)$/i.test(e.target.tagName)) return;
      e.preventDefault();
      fn();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
};

/* ── which phase ran ───────────────────────────────────────────────────── */
export function WhichStage({ item, round }) {
  const reveal = !!round.feedback;
  const { key, t, demo: phase } = item.studio;
  const dm = useMemo(() => demo(key, t, phase), [key, t, phase]);
  const [replay, setReplay] = useState(0);
  const sub = reveal
    ? fill(UI.demo, { phase: UI.phaseName[phase === 1 ? 'p1' : 'p2'], k: STUDIO.k, t })
    : fill(UI.demoHidden, { k: STUDIO.k, t });
  return (
    <>
      <Prompt k={count(round)} sub={sub}>{item.prompt}</Prompt>
      <div className="dla-fg__split">
        <div className="dla-floor dla-fg__floor">
          <Studio key={replay} frame={dm.after} ghost={dm.before} animate="slow" />
          <div className="dla-fg__under">
            <Legend ghost />
            <button type="button" className="dla-btn dla-btn--quiet dla-fg__replay" onClick={() => setReplay((r) => r + 1)} aria-label={UI.replayAria}>{UI.replay}</button>
          </div>
          <Own t={t} />
        </div>
        <div className="dla-fg__col">
          <Pick item={item} round={round} />
          <Feedback feedback={round.feedback} format={fmtAns} />
        </div>
      </div>
      <Maths>
        <ChangeLines dm={dm} />
      </Maths>
    </>
  );
}

/* ── recipe (build a phase's batch) ────────────────────────────────────── */
export function RecipeStage({ item, round }) {
  const [pick, setPick] = useState({ batch: null, labels: null, learns: null });
  const live = isLive(round);
  const right = !!round.feedback?.correct;
  const { key, t, demo: phase } = item.studio;
  const dm = useMemo(() => demo(key, t, phase), [key, t, phase]);
  const complete = ROW_KEYS.every((r) => pick[r]);
  const run = () => { if (live && complete) round.submit({ ...pick }); };
  useEnter(live, run);
  return (
    <>
      <Prompt k={count(round)}>{item.prompt}</Prompt>
      <div className="dla-fg__split">
        <div className="dla-floor dla-fg__floor">
          <Studio frame={right ? dm.after : dm.before} ghost={right ? dm.before : null} animate={right ? 'quick' : ''} />
          <Legend ghost={right} />
          <Own t={t} extra={right ? <span className="dla-fg__lab">{fill(UI.demo, { phase: UI.phaseName[phase === 1 ? 'p1' : 'p2'], k: STUDIO.k, t })}</span> : null} />
          <Tray pick={pick} revealOn={right} />
        </div>
        <div className="dla-fg__card" role="group" aria-label={item.title}>
          {item.rows.map((row) => (
            <div key={row.key} className="dla-fg__row" role="radiogroup" aria-label={UI.rows[row.key]}>
              <span className="dla-k dla-fg__rowk">{UI.rows[row.key]}</span>
              {row.options.map((o) => (
                <button
                  key={o.key}
                  type="button"
                  role="radio"
                  aria-checked={pick[row.key] === o.key}
                  className="dla-fg__chip"
                  onClick={() => live && setPick((p) => ({ ...p, [row.key]: o.key }))}
                  disabled={!live}
                >
                  {o.text}
                </button>
              ))}
            </div>
          ))}
          <button type="button" className="dla-btn dla-btn--primary dla-fg__go" onClick={run} disabled={!live || !complete}>
            {UI.run} <span className="dla-btn__key">{UI.runKey}</span>
          </button>
        </div>
      </div>
      <Feedback feedback={round.feedback} format={fmtAns} />
      <Maths>
        {item.code.map((c, i) => <MLine key={i}><code className="dla-code">{c}</code></MLine>)}
        {right && <ChangeLines dm={dm} />}
      </Maths>
    </>
  );
}

/* ── order (tap the cards in sequence) ─────────────────────────────────── */
export function OrderStage({ item, round }) {
  const [seq, setSeq] = useState([]);
  const live = isLive(round);
  const reveal = !!round.feedback;
  const complete = seq.length === item.cards.length;
  const place = (id) => { if (live) setSeq((s) => (s.includes(id) || s.length >= item.cards.length ? s : [...s, id])); };
  const undo = () => { if (live) setSeq((s) => s.slice(0, -1)); };
  const submit = () => { if (live && complete) round.submit(seq.slice()); };
  useEffect(() => {
    if (!live) return undefined;
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.target && /^(input|textarea|select)$/i.test(e.target.tagName)) return;
      const n = Number(e.key);
      if (n >= 1 && n <= item.cards.length) { e.preventDefault(); place(item.cards[n - 1].id); }
      else if (e.key === 'Backspace') { e.preventDefault(); undo(); }
      else if (e.key === 'Enter' && !(e.target && /^button$/i.test(e.target.tagName))) { e.preventDefault(); submit(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  const byId = Object.fromEntries(item.cards.map((c) => [c.id, c]));
  const shown = reveal && !round.feedback.correct ? item.answer : seq;
  const codeSet = item.cards.every((c) => c.code);
  return (
    <>
      <Prompt k={count(round)} sub={UI.orderHint}>{item.prompt}</Prompt>
      <div className="dla-fg__split">
        {codeSet ? (
          <CodeView
            file={fill(UI.codeFile, { s: 25 })}
            meta={reveal && !round.feedback.correct ? UI.answerMeta : null}
            label={UI.orderAria}
            lines={item.cards.map((_, i) => (shown[i]
              ? { id: `s${i}`, code: byId[shown[i]].code, state: reveal ? (round.feedback.correct ? 'right' : 'lit') : undefined }
              : { id: `s${i}`, code: UI.gapMark, state: 'gap' }))}
          />
        ) : (
          <ol className="dla-fg__steps" aria-label={UI.orderAria}>
            {item.cards.map((_, i) => (
              <li key={i} className={`dla-fg__stepslot${shown[i] ? ' dla-fg__stepslot--on' : ''}`}>
                <span className="dla-fg__stepn" aria-hidden="true">{i + 1}</span>
                <span>{shown[i] ? byId[shown[i]].text : UI.gapMark}</span>
              </li>
            ))}
          </ol>
        )}
        <div className="dla-fg__cards" role="group" aria-label={UI.orderAria}>
          {item.cards.map((c, i) => {
            const at = seq.indexOf(c.id);
            const last = at >= 0 && at === seq.length - 1;
            return (
              <button
                key={c.id}
                type="button"
                className={`dla-fg__cardbtn${at >= 0 ? ' dla-fg__cardbtn--on' : ''}`}
                onClick={() => (at < 0 ? place(c.id) : last ? undo() : null)}
                disabled={!live}
                aria-pressed={at >= 0}
                aria-label={`${i + 1}: ${c.code ?? c.text}${at >= 0 ? `, placed ${at + 1}` : ''}`}
              >
                <span className="dla-fg__cardn" aria-hidden="true">{at >= 0 ? at + 1 : ''}</span>
                {c.code ? <code className="dla-fg__ccode"><CodeText code={c.code} /></code> : <span className="dla-fg__cardt">{c.text}</span>}
                <span className="dla-fg__cardkey" aria-hidden="true">{i + 1}</span>
              </button>
            );
          })}
          <div className="dla-fg__btns">
            <button type="button" className="dla-btn dla-btn--quiet" onClick={undo} disabled={!live || !seq.length}>{UI.undo}</button>
            <button type="button" className="dla-btn dla-btn--primary" onClick={submit} disabled={!live || !complete}>
              {UI.submitOrder} <span className="dla-btn__key">{UI.runKey}</span>
            </button>
          </div>
        </div>
      </div>
      <Feedback feedback={round.feedback} format={fmtAns} />
    </>
  );
}

/* ── facts in the slides' words ────────────────────────────────────────── */
export function FactStage({ item, round }) {
  return (
    <>
      <Prompt k={count(round)}>{item.prompt}</Prompt>
      <Feedback feedback={round.feedback} format={fmtAns} />
      <Pick item={item} round={round} />
    </>
  );
}

/* ── diagnose a live run ───────────────────────────────────────────────── */
export function DiagnoseStage({ item, round }) {
  const reveal = !!round.feedback;
  const { key, t } = item.studio;
  const fr = useMemo(() => frameAt(key, t), [key, t]);
  const hist = useMemo(() => coverHistory(key, t), [key, t]);
  return (
    <>
      <Prompt k={count(round)}>{item.prompt}</Prompt>
      <div className="dla-fg__split">
        <div className="dla-floor dla-fg__floor">
          <Studio frame={fr} showD={false} />
          <Legend showD={false} />
          <CoverStrip history={hist} t={t} />
          <Own t={t} extra={reveal ? <span className="dla-fg__lab">{fill(UI.preset, { p: key })}</span> : null} />
        </div>
        <div className="dla-fg__col">
          <Pick item={item} round={round} />
          <Feedback feedback={round.feedback} format={fmtAns} />
        </div>
      </div>
      <Maths>
        <MLine text={fill(UI.coverLine, { a: fmt(fr.cover[0], 2), b: fmt(fr.cover[1], 2) })} />
        <MLine text={fill(UI.meanLine, { m: fmt(fr.mean, 2), s: fmt(fr.sd, 2) })} />
      </Maths>
    </>
  );
}

export function PairStage({ item, round }) {
  const reveal = !!round.feedback;
  const frames = useMemo(() => item.pair.map((p) => frameAt(p.key, p.t)), [item]);
  return (
    <>
      <Prompt k={count(round)}>{item.prompt}</Prompt>
      <div className="dla-floor dla-fg__floor">
        <div className="dla-fg__pair">
          {item.pair.map((p, i) => (
            <figure key={p.label} className="dla-fg__pairfig">
              <figcaption className="dla-fg__pairk">{p.label === 'A' ? UI.runA : UI.runB}{reveal ? ` · ${fill(UI.preset, { p: p.key })}` : ''}</figcaption>
              <Studio frame={frames[i]} showD={false} compact label={`${p.label === 'A' ? UI.runA : UI.runB}: ${UI.studioAria}`} />
            </figure>
          ))}
        </div>
        <Legend showD={false} />
        <Own t={item.pair[0].t} />
      </div>
      <Feedback feedback={round.feedback} format={fmtAns} />
      <Pick item={item} round={round} columns={3} />
      <Maths>
        {frames.map((fr, i) => (
          <MLine key={i} text={`${item.pair[i].label === 'A' ? UI.runA : UI.runB}: ${fill(UI.coverLine, { a: fmt(fr.cover[0], 2), b: fmt(fr.cover[1], 2) })}`} />
        ))}
      </Maths>
    </>
  );
}

/* ── fill the gap in slide 25's loop ───────────────────────────────────── */
export function GapStage({ item, round }) {
  const reveal = !!round.feedback;
  const picked = reveal ? item.choices.find((c) => c.value === round.feedback.given) : null;
  const lines = loopLines().map((l) => {
    if (l.id !== item.line) return { id: l.id, code: l.code };
    if (!reveal) return { id: l.id, code: `    ${UI.gapMark}`, state: 'gap' };
    const right = item.choices.find((c) => c.value === item.answer);
    return { id: l.id, code: `    ${(round.feedback.correct ? right : picked ?? right).label.replace(/`/g, '')}`, state: round.feedback.correct ? 'right' : 'wrong' };
  });
  return (
    <>
      <Prompt k={count(round)}>{item.prompt}</Prompt>
      <CodeView file={fill(UI.codeFile, { s: 25 })} meta={LOOP.note} lines={lines} label={UI.loopAria} />
      <Feedback feedback={round.feedback} format={fmtAns} />
      <Pick item={item} round={round} />
    </>
  );
}

/* ── build by the slide-28 guidelines ──────────────────────────────────── */
export function BuildStage({ item, round }) {
  const [pick, setPick] = useState({});
  const live = isLive(round);
  const complete = item.slots.every((s) => pick[s.id]);
  const go = () => { if (live && complete) round.submit({ ...pick }); };
  useEnter(live, go);
  return (
    <>
      <Prompt k={count(round)}>{item.prompt}</Prompt>
      <div className="dla-floor dla-fg__floor">
        <NetDiagram item={item} pick={pick} />
      </div>
      <div className="dla-fg__card" role="group" aria-label={UI.buildAria}>
        {item.slots.map((s, si) => (
          <div key={s.id} className="dla-fg__row" role="radiogroup" aria-label={s.label}>
            <span className={`dla-k dla-fg__rowk dla-fg__rowk--${['q', 'k', 'pos'][si]}`}>{s.label}</span>
            {s.options.map((o) => (
              <button
                key={o.key}
                type="button"
                role="radio"
                aria-checked={pick[s.id] === o.key}
                className="dla-fg__chip"
                onClick={() => live && setPick((p) => ({ ...p, [s.id]: o.key }))}
                disabled={!live}
              >
                {o.text}
              </button>
            ))}
          </div>
        ))}
        <button type="button" className="dla-btn dla-btn--primary dla-fg__go" onClick={go} disabled={!live || !complete}>
          {UI.build} <span className="dla-btn__key">{UI.runKey}</span>
        </button>
      </div>
      <Feedback feedback={round.feedback} format={fmtAns} />
      <Maths>
        {GUIDELINES.map((g) => <MLine key={g.n} text={`${g.n}. ${g.text}`} />)}
      </Maths>
    </>
  );
}

/* ── spot the line (slide 29) ──────────────────────────────────────────── */
export function SpotStage({ item, round }) {
  const live = isLive(round);
  const reveal = !!round.feedback;
  const net = dcganNet(item.net);
  useEffect(() => {
    if (!live) return undefined;
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.target && /^(input|textarea|select)$/i.test(e.target.tagName)) return;
      const n = Number(e.key);
      if (n >= 1 && n <= item.candidates.length) { e.preventDefault(); round.submit(item.candidates[n - 1]); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  const lines = [
    { id: 'head', code: net.head },
    ...net.lines.map((l) => {
      const k = item.candidates.indexOf(l.id);
      const code = l.code.split('\n').map((p, j) => (j ? p.trim() : `    ${p}`)).join('\n');
      if (k < 0) return { id: l.id, code, state: 'dim' };
      let state = 'lit';
      if (reveal && l.id === item.answer) state = 'right';
      else if (reveal && l.id === round.feedback.given) state = 'wrong';
      return {
        id: l.id, code, state, n: k + 1,
        onPick: () => live && round.submit(l.id),
        disabled: !live,
        aria: `${k + 1}: ${l.code.replace(/\s+/g, ' ')}`,
      };
    }),
    { id: 'tail', code: '])' },
  ];
  return (
    <>
      <Prompt k={count(round)} sub={UI.tapLine}>{item.prompt}</Prompt>
      <CodeView file={fill(UI.codeFile, { s: 29 })} lines={lines} label={UI.spotAria} />
      <Feedback feedback={round.feedback} format={fmtAns} />
    </>
  );
}

/* ── numbers and the noise shape ───────────────────────────────────────── */
function BatchBar({ item, reveal }) {
  const b = item.batch;
  const segs = item.numberKind === 'y2' ? [{ k: 'fake', n: b, lab: 1 }] : [{ k: 'fake', n: b, lab: 0 }, { k: 'real', n: b, lab: 1 }];
  const total = segs.reduce((a, s) => a + s.n, 0);
  let x = 10;
  return (
    <svg className="dla-svg dla-fg__bbar" viewBox="0 0 420 64" role="img" aria-label={UI.bbarAria}>
      {segs.map((s, i) => {
        const w = (s.n / (2 * b)) * 370;
        const g = (
          <g key={i} className={`dla-fg__seg dla-fg__seg--${s.k}`}>
            <rect x={x} y="6" width={w - 4} height="30" rx="5" />
            <text x={x + (w - 4) / 2} y="26" textAnchor="middle" className="dla-t dla-t--b">{reveal ? fill(UI.segText, { n: s.n, lab: s.lab }) : fill(UI.segHidden, { lab: s.lab })}</text>
            <text x={x + (w - 4) / 2} y="54" textAnchor="middle" className="dla-t dla-t--xs">{s.k === 'fake' ? UI.fake : UI.real}</text>
          </g>
        );
        x += w;
        return g;
      })}
      {reveal && <text x="414" y="26" textAnchor="end" className="dla-t dla-t--b">{total}</text>}
    </svg>
  );
}

export function NumberStage({ item, round }) {
  const [value, setValue] = useState('');
  const live = isLive(round);
  const reveal = !!round.feedback;
  return (
    <>
      <Prompt k={count(round)}>{item.prompt}</Prompt>
      <div className="dla-stagegrid">
        <div className="dla-fg__col">
          <CodeView file={fill(UI.codeFile, { s: item.src.slides[item.src.slides.length - 1] })} lines={item.code.map((c, i) => ({ id: `c${i}`, code: c }))} label={UI.codeAria} />
          {item.numberKind !== 'dense' && (
            <div className="dla-floor dla-floor--tight">
              <BatchBar item={item} reveal={reveal} />
            </div>
          )}
          <Feedback feedback={round.feedback} format={fmtAns} />
        </div>
        <Keypad value={value} onChange={setValue} onSubmit={() => value !== '' && round.submit(Number(value))} disabled={!live} active={live} label={UI.numberLabel} />
      </div>
    </>
  );
}

export function ShapeStage({ item, round }) {
  const [vals, setVals] = useState(['', '']);
  const live = isLive(round);
  const submit = () => { if (live && vals.every((v) => v !== '')) round.submit(vals.map(Number)); };
  return (
    <>
      <Prompt k={count(round)}>{item.prompt}</Prompt>
      <div className="dla-stagegrid">
        <div className="dla-fg__col">
          <CodeView file={fill(UI.codeFile, { s: item.src.slides[item.src.slides.length - 1] })} lines={item.code.map((c, i) => ({ id: `c${i}`, code: c }))} label={UI.codeAria} />
          <Feedback feedback={round.feedback} format={fmtAns} />
        </div>
        <ShapePad value={vals} onChange={setVals} onSubmit={submit} labels={UI.shapeLabels} sep="," disabled={!live} active={live} ariaLabel={UI.shapeAria} />
      </div>
    </>
  );
}
