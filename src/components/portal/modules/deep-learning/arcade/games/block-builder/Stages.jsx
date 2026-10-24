import { useEffect, useState } from 'react';
import { Prompt, Feedback } from '../../kit/RoundShell';
import { Choice } from '../../kit/Choice';
import { Keypad } from '../../kit/Keypad';
import { Maths, MLine } from '../../kit/Maths';
import { fmtAnswer } from '../../kit/why';
import { UI, VGG, LENET5, ALEXNET } from '../../content/block-builder';
import { fill, fragmentBlocks } from '../../maths/blockBuilder';
import { Tower, SlideTable, InceptionFigure, ResidualFigure, DepthBar } from './Figures';

/* ============================================================================
   BLOCK BUILDER — THE STAGES (one per item view)
   ----------------------------------------------------------------------------
   ChoiceStage   claim / exhibit / rows / figure / quick / text  (kit Choice)
   OrderStage    order (a tower, bottom → top) and steps (slide 51, top →
                 bottom): tap cards into the lowest / next empty slot
   BranchStage   pick Figure 14-14's four branches; they fill the columns
   WireStage     tap where the skip connection leaves, then where it joins
   NumberStage   cell (a blank table cell) and sum (a depth concat): keypad
   ========================================================================== */

const TABLES = { lenet5: LENET5, alexnet: ALEXNET };
const fmtFeedback = (a, it) => fmtAnswer(it, a);
const isLive = (round) => round.state === 'play' && !round.feedback;
const fbClass = (round) => (round.feedback ? (round.feedback.correct ? ' dla-bk-floor--right' : ' dla-bk-floor--wrong') : '');

function Frame({ item, round, picture, input = null, solo = false }) {
  return (
    <div className={solo ? 'dla-bk__solo' : 'dla-stagegrid dla-bk__grid'}>
      <div className="dla-bk__left">
        <div className={`dla-floor dla-bk__floor${fbClass(round)}`}>{picture}</div>
        <Prompt k={`${round.index + 1} / ${round.total}`} sub={item.subNow ?? item.sub}>{item.prompt}</Prompt>
        <Feedback feedback={round.feedback} format={fmtFeedback} />
        {item.maths?.length > 0 && (
          <Maths>
            {item.maths.map((m, i) => <MLine key={i} text={m} />)}
          </Maths>
        )}
      </div>
      {input}
    </div>
  );
}

/* the pictures behind the choice items */
function Plaque({ k, children, big = false }) {
  return (
    <figure className={`dla-bk-plaque${big ? ' dla-bk-plaque--big' : ''}`}>
      <span className="dla-k"><span className="dla-dot" aria-hidden="true" />{k}</span>
      <blockquote className="dla-bk-plaque__q">{children}</blockquote>
    </figure>
  );
}
function towerFor(key) {
  if (key === 'vgg') return VGG.tower.map((b, i) => ({ key: `v${i}`, label: b.label, sub: b.sub ?? '', tone: b.tone, state: b.tone === 'more' ? 'more' : 'fixed' }));
  return fragmentBlocks(key).map((b) => ({ key: b.id, label: b.label, sub: b.sub ?? '', tone: b.tone, state: 'fixed' }));
}
function ChoicePicture({ item }) {
  switch (item.view) {
    case 'claim': return <Plaque k={UI.claimK}>{item.claim}</Plaque>;
    case 'exhibit': return <Plaque k={UI.exhibitK} big>{item.exhibit}</Plaque>;
    case 'text': return <Plaque k={item.topic}>{item.prompt}</Plaque>;
    case 'rows': return <SlideTable tableKey={item.table} rows={item.rows} />;
    case 'figure':
    case 'quick': {
      const cap = item.view === 'quick';
      if (item.figure === 'inception') return <InceptionFigure label={UI.incAria} caption={cap ? UI.figInception : null} />;
      if (item.figure === 'residual') return <ResidualFigure label={UI.resAria} hide={item.hide} caption={cap ? UI.figResidual : null} />;
      return <Tower blocks={towerFor(item.figure)} label={UI.towerAria} compact={item.figure === 'vgg'} />;
    }
    default: return null;
  }
}
export function ChoiceStage({ item, round }) {
  const live = isLive(round);
  const long = item.view === 'text' || item.view === 'quick' || (item.view === 'exhibit' && item.choices.some((c) => c.label.length > 14));
  return (
    <Frame
      item={item.view === 'text' ? { ...item, prompt: UI.textPrompt } : item}
      round={round}
      picture={<ChoicePicture item={item} />}
      input={(
        <div className="dla-bk__input">
          <Choice
            choices={item.choices}
            onPick={(v) => live && round.submit(v)}
            picked={round.feedback ? round.feedback.given : null}
            answer={round.feedback ? item.answer : null}
            disabled={!live && !round.feedback}
            active={live}
            columns={long ? 1 : 2}
            label={item.prompt}
          />
        </div>
      )}
    />
  );
}

/* shared tap-to-place logic: seq of card ids, keys 1–n toggle, Backspace pops, Enter locks */
function useSeq(item, round, need) {
  const [seq, setSeq] = useState([]);
  const live = isLive(round);
  const toggle = (id) => {
    if (!live) return;
    setSeq((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length < need ? [...s, id] : s));
  };
  const pop = () => live && setSeq((s) => s.slice(0, -1));
  const lock = () => { if (live && seq.length === need) round.submit(seq); };
  useEffect(() => {
    if (!live) return undefined;
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = e.target?.tagName ?? '';
      if (/^(input|textarea|select)$/i.test(tag)) return;
      const n = Number(e.key);
      if (n >= 1 && n <= item.cards.length) { e.preventDefault(); toggle(item.cards[n - 1].id); }
      else if (e.key === 'Backspace') { e.preventDefault(); pop(); }
      else if (e.key === 'Enter') { if (tag === 'BUTTON' && !e.target.dataset?.enter) return; e.preventDefault(); lock(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  return { seq, toggle, pop, lock, live };
}
function SeqBar({ n, need, template, onUndo, onLock, live }) {
  return (
    <div className="dla-bk__bar">
      <span className="dla-k">{fill(template, { n, m: need })}</span>
      <button type="button" className="dla-btn dla-btn--quiet" onClick={onUndo} disabled={!live || !n}>
        {UI.undo} <span className="dla-btn__key">⌫</span>
      </button>
      <button type="button" className="dla-btn dla-btn--primary" data-enter="lock" onClick={onLock} disabled={!live || n !== need}>
        {UI.lock} <span className="dla-btn__key">Enter</span>
      </button>
    </div>
  );
}

export function OrderStage({ item, round }) {
  const need = item.answer.length;
  const { seq, toggle, pop, lock, live } = useSeq(item, round, need);
  const fb = round.feedback;
  const steps = item.view === 'steps';
  const byId = Object.fromEntries(item.cards.map((c) => [c.id, c]));
  const slotIdx = item.slots.map((s, i) => (s.slot ? i : -1)).filter((i) => i >= 0);
  const blocks = item.slots.map((s, i) => {
    if (!s.slot) return { key: s.id, name: s.name, label: s.label, sub: s.sub, tone: s.tone, state: 'fixed', code: steps };
    const j = slotIdx.indexOf(i);
    const cid = seq[j];
    if (!cid) return { key: s.id, state: 'slot', n: j + 1, next: live && j === seq.length, aria: fill(UI.slot, { n: j + 1 }) };
    const c = byId[cid];
    const mark = fb ? (cid === item.answer[j] ? 'ok' : 'bad') : null;
    return { key: s.id, name: mark === 'ok' ? s.name : '', label: c.label, sub: c.sub, tone: c.tone, state: 'filled', mark, code: steps };
  });
  const many = blocks.length > 8;
  return (
    <Frame
      item={item}
      round={round}
      picture={<Tower blocks={blocks} label={steps ? UI.stepsAria : UI.towerAria} down={steps} compact={many} />}
      input={(
        <div className="dla-bk__input">
          <ol className="dla-bk-cards" aria-label={item.prompt}>
            {item.cards.map((c, i) => {
              const pos = seq.indexOf(c.id);
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    data-enter="lock"
                    className={`dla-bk-card${pos >= 0 ? ' dla-bk-card--on' : ''}${steps ? ' dla-bk-card--code' : ''}`}
                    data-tone={c.tone}
                    onClick={() => toggle(c.id)}
                    disabled={!live}
                    aria-pressed={pos >= 0}
                    aria-label={`${i + 1}: ${c.label}${c.sub ? `, ${c.sub}` : ''}${pos >= 0 ? `, placed ${pos + 1}` : ''}`}
                  >
                    <span className="dla-bk-card__n" aria-hidden="true">{pos >= 0 ? pos + 1 : ''}</span>
                    <span className="dla-bk-card__body">
                      <span className="dla-bk-card__label">{c.label}</span>
                      {c.sub && <span className="dla-bk-card__sub">{c.sub}</span>}
                    </span>
                    <span className="dla-bk-card__key" aria-hidden="true">{i + 1}</span>
                  </button>
                </li>
              );
            })}
          </ol>
          <SeqBar n={seq.length} need={need} template={UI.placed} onUndo={pop} onLock={lock} live={live} />
        </div>
      )}
    />
  );
}

export function BranchStage({ item, round }) {
  const need = item.answer.length;
  const { seq, toggle, pop, lock, live } = useSeq(item, round, need);
  const fb = round.feedback;
  const byId = Object.fromEntries(item.cards.map((c) => [c.id, c]));
  const columns = Array.from({ length: need }, (_, j) => {
    const cid = seq[j];
    if (!cid) return null;
    return { parts: byId[cid].parts, mark: fb ? (item.answer.includes(cid) ? 'ok' : 'bad') : null };
  });
  return (
    <Frame
      item={item}
      round={round}
      picture={<InceptionFigure columns={columns} next={live ? seq.length : -1} label={UI.incSlotsAria} caption={UI.figInception} />}
      input={(
        <div className="dla-bk__input">
          <ol className="dla-bk-cards dla-bk-cards--two" aria-label={item.prompt}>
            {item.cards.map((c, i) => {
              const pos = seq.indexOf(c.id);
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    data-enter="lock"
                    className={`dla-bk-card dla-bk-card--branch${pos >= 0 ? ' dla-bk-card--on' : ''}`}
                    onClick={() => toggle(c.id)}
                    disabled={!live}
                    aria-pressed={pos >= 0}
                    aria-label={`${i + 1}: ${c.short}${pos >= 0 ? `, column ${pos + 1}` : ''}`}
                  >
                    <span className="dla-bk-card__n" aria-hidden="true">{pos >= 0 ? pos + 1 : ''}</span>
                    <span className="dla-bk-chips" aria-hidden="true">
                      {c.parts.map((p, k) => (
                        <span key={k} className="dla-bk-chip" data-tone={p.tone}>
                          <b>{p.type}</b> {p.spec}
                        </span>
                      ))}
                    </span>
                    <span className="dla-bk-card__key" aria-hidden="true">{i + 1}</span>
                  </button>
                </li>
              );
            })}
          </ol>
          <SeqBar n={seq.length} need={need} template={UI.picked} onUndo={pop} onLock={lock} live={live} />
        </div>
      )}
    />
  );
}

export function WireStage({ item, round }) {
  const [from, setFrom] = useState(null);
  const [to, setTo] = useState(null);
  const live = isLive(round);
  const fb = round.feedback;
  const onPick = (id) => {
    if (!live) return;
    if (!from) { setFrom(id); return; }
    if (id === from) { setFrom(null); return; }
    setTo(id);
    round.submit([from, id]);
  };
  useEffect(() => {
    if (!live) return undefined;
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.target && /^(input|textarea|select)$/i.test(e.target.tagName)) return;
      const n = Number(e.key);
      const keys = ['in', 'l1', 'l2', 'add'];
      if (n >= 1 && n <= keys.length) { e.preventDefault(); onPick(keys[n - 1]); }
      else if (e.key === 'Backspace' || e.key === 'Escape') { e.preventDefault(); setFrom(null); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  const skip = from && to ? [from, to] : null;
  const mark = fb ? (fb.correct ? 'ok' : 'bad') : null;
  return (
    <Frame
      item={{ ...item, subNow: from ? UI.wireTo : UI.wireFrom }}
      round={round}
      solo
      picture={<ResidualFigure skip={skip} hide={null} pick={{ onPick, from, live, mark }} label={UI.wireAria} caption={UI.figResidual} />}
    />
  );
}

export function NumberStage({ item, round }) {
  const [value, setValue] = useState('');
  const live = isLive(round);
  const fb = round.feedback;
  const mark = fb ? (fb.correct ? 'ok' : 'bad') : null;
  const submit = () => { if (live && value !== '') round.submit(Number(value)); };
  let picture = null;
  if (item.view === 'cell') {
    const table = TABLES[item.table];
    const rows = item.showAll ? table.rows.map((_, i) => i) : table.rows.slice(0, item.row + 1).map((_, i) => i);
    const square = item.col === 'size' && Array.isArray(table.rows[item.row].size);
    picture = (
      <SlideTable
        tableKey={item.table}
        rows={rows}
        hiddenAbove={!item.showAll && item.row < table.rows.length - 1}
        columns={table.columns.filter((c) => c !== 'act')}
        blank={{ row: item.row, col: item.col, value, mark, square }}
        caption={item.table === 'lenet5' ? UI.tableLenet : UI.tableAlexnet}
      />
    );
  } else {
    const s = item.sum;
    const blocks = [
      { key: 'module', name: UI.moduleTag, label: item.module.top.join(' '), sub: item.module.bottom.join(' '), tone: 'inc', state: 'fixed' },
      { key: 'into', label: s.label, sub: s.sub.replace('?', value === '' ? '?' : value), tone: s.tone, state: 'fixed', mark },
    ];
    picture = (
      <div className="dla-bk-sum">
        <Tower blocks={blocks} label={UI.figGoogLeNet} caption={UI.figGoogLeNet} />
        <DepthBar parts={item.module.top} total={item.answer} reveal={!!fb} label={UI.barAria} />
      </div>
    );
  }
  return (
    <Frame
      item={item}
      round={round}
      picture={picture}
      input={<Keypad key={item.id} value={value} onChange={setValue} onSubmit={submit} disabled={!live} active={live} label={item.padLabel} />}
    />
  );
}

export function Stage({ item, round }) {
  switch (item.view) {
    case 'order':
    case 'steps': return <OrderStage item={item} round={round} />;
    case 'branches': return <BranchStage item={item} round={round} />;
    case 'wire': return <WireStage item={item} round={round} />;
    case 'cell':
    case 'sum': return <NumberStage item={item} round={round} />;
    default: return <ChoiceStage item={item} round={round} />;
  }
}

