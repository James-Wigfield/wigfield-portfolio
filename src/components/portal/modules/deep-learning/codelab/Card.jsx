import { useEffect, useRef, useState } from 'react';
import { Tex } from '../kit';
import CodePanel from './CodePanel';
import { Diagram } from './diagrams';
import { SPECS } from './specs';
import { flow, shapeStr, fmt } from './counts';
import { markQuote, markWhere, codeLines } from './panelModel';
import { CIRCLED } from './tokens';
import { CARD_BY_ID, fullLabel, sourceText, provenanceText } from './cards';
import { texText } from './texText';

/* ============================================================================
   CODE LAB — ONE CARD
   ----------------------------------------------------------------------------
   Code → understanding, in this order: the header (printed label and title,
   the rating as a labelled dot, outlined source labels), why it's here, the
   code panel with its marks, the marks legend (each entry quotes the marked
   code), then the exam moves: Draw it (diagram from the spec), Count it (the
   table counts.js computes), Shapes, Equation ↔ code, What's it for. A Slide
   check and a cross-link close it when it has them.
   ========================================================================== */

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Search highlights on a plain string.
export function Hi({ text, terms }) {
  if (!terms?.length) return text;
  const re = new RegExp(`(${terms.map(escapeRe).join('|')})`, 'gi');
  return String(text).split(re).map((p, i) => (i % 2 === 1 ? <mark key={i} className="dlc-hi">{p}</mark> : p));
}

// Inline prose: `code` spans, with search highlights.
export function Inline({ text, terms }) {
  if (!text) return null;
  return String(text).split(/(`[^`]+`)/g).map((part, i) => (
    part.startsWith('`') && part.endsWith('`') && part.length > 1
      ? <code key={i}><Hi text={part.slice(1, -1)} terms={terms} /></code>
      : <Hi key={i} text={part} terms={terms} />
  ));
}

function CopyButton({ code }) {
  const [state, setState] = useState('');
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const copy = async () => {
    let ok = false;
    try {
      await navigator.clipboard.writeText(code);
      ok = true;
    } catch {
      /* clipboard blocked: say so */
    }
    setState(ok ? 'copied' : 'blocked');
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setState(''), 1400);
  };
  return (
    <button type="button" className={`dlc-copy${state === 'copied' ? ' dlc-copy--done' : ''}`} onClick={copy} aria-label="Copy the code">
      {state === 'copied' ? '✓ copied' : state === 'blocked' ? 'copy blocked' : 'copy'}
    </button>
  );
}

function CountTable({ spec }) {
  const f = flow(spec);
  const hasNt = f.nt > 0;
  return (
    <table className="dlc-count" data-spec={spec.id}>
      <thead>
        <tr><th>Layer</th><th>Output shape</th><th className="dlc-num">Trainable</th>{hasNt && <th className="dlc-num">Non-train.</th>}<th>Rule</th></tr>
      </thead>
      <tbody>
        {f.rows.map((r) => (
          <tr key={r.id}>
            <td>{r.name}</td>
            <td className="dlc-mono">{shapeStr(r.out)}</td>
            <td className="dlc-num">{fmt(r.tr)}</td>
            {hasNt && <td className="dlc-num">{r.nt ? fmt(r.nt) : '0'}</td>}
            <td className="dlc-count__rule">{r.rule}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr>
          <td colSpan={2}>Total</td>
          <td className="dlc-num">{fmt(f.tr)}</td>
          {hasNt && <td className="dlc-num">{fmt(f.nt)}</td>}
          <td className="dlc-count__rule">{hasNt ? `${fmt(f.tr + f.nt)} parameters in all` : 'all trainable'}</td>
        </tr>
      </tfoot>
    </table>
  );
}

function Shapes({ shapes, terms }) {
  return (
    <table className="dlc-shapes">
      <tbody>
        {shapes.map((s) => (
          <tr key={s.name}>
            <th className="dlc-mono">{s.name}</th>
            <td className="dlc-mono dlc-shapes__sh">{s.shape}</td>
            <td><Inline text={s.means} terms={terms} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function EqCode({ eq, code }) {
  const lines = codeLines(code);
  return (
    <div className="dlc-eqs">
      {eq.map((e, i) => (
        <div className="dlc-eq" key={i}>
          {e.name && <span className="dlc-eq__name">{e.name}</span>}
          <Tex src={e.tex} block />
          <p className="dlc-eq__plain"><span className="dlc-eq__k">As text:</span> {e.plain || texText(e.tex)}</p>
          {e.line && (
            <p className="dlc-eq__code">
              <span className="dlc-eq__k">↔ line {e.line}</span> <code>{lines[e.line - 1].trim()}</code>
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

function Move({ k, kind, children }) {
  return (
    <div className={`dlc-move${kind ? ` dlc-move--${kind}` : ''}`}>
      <h4 className="dlc-move__k">{k}</h4>
      {children}
    </div>
  );
}

export function Card({ card, terms, image, onJump, tabName }) {
  const m = card.moves || {};
  const drawSpec = m.draw ? SPECS[m.draw] : null;
  const countSpec = m.count ? SPECS[m.count] : null;
  return (
    <article className={`dlc-card dlc-card--${card.rating}`} id={`dlc-${card.id}`} data-card={card.id}>
      <header className="dlc-card__head">
        <h3 className="dlc-card__title">
          <span className="dlc-card__label">{card.label}</span> · <Hi text={card.title} terms={terms} />
        </h3>
        <span className="dlc-rate" data-rate={card.rating}><i aria-hidden="true" />{card.rating}</span>
        {tabName && <span className="dlc-card__tab">in {tabName}</span>}
        <span className="dlc-card__tools"><CopyButton code={card.code} /></span>
      </header>
      <p className="dlc-card__src">
        {card.sources.map((s) => <span className="dlc-src" key={sourceText(s)}>{sourceText(s)}</span>)}
        <span className="dlc-prov">{provenanceText(card)}</span>
      </p>
      <p className="dlc-card__why"><Inline text={card.why} terms={terms} /></p>
      <div className={`dlc-card__body${drawSpec ? ' dlc-card__body--draw' : ''}`}>
        <div className="dlc-card__main">
          <CodePanel code={card.code} marks={card.marks} file={card.file} meta={fullLabel(card)} image={image} />
        </div>
        <div className="dlc-card__side">
          <ol className="dlc-legend">
            {card.marks.map((mk) => (
              <li key={mk.n} data-mark={mk.n}>
                <span className="dlc-legend__n">{CIRCLED[mk.n]}</span>
                <span className="dlc-legend__where">{markWhere(mk)}</span>{' '}
                <code className="dlc-legend__q"><Hi text={markQuote(card.code, mk)} terms={terms} /></code>
                <span className="dlc-legend__say">: <Inline text={mk.say} terms={terms} /></span>
              </li>
            ))}
          </ol>
          {m.eq && <Move k="Equation ↔ code"><EqCode eq={m.eq} code={card.code} /></Move>}
          {m.shapes && <Move k="Shapes"><Shapes shapes={m.shapes} terms={terms} /></Move>}
          {m.say && <p className="dlc-card__move"><Inline text={m.say} terms={terms} /></p>}
          {m.forWhat && <p className="dlc-card__for"><span className="dlc-eq__k">What’s it for:</span> <Inline text={m.forWhat} terms={terms} /></p>}
        </div>
        {drawSpec && <Move k="Draw it" kind="draw"><Diagram spec={drawSpec} /></Move>}
      </div>
      {countSpec && <Move k="Count it" kind="count"><CountTable spec={countSpec} /></Move>}
      {(card.slideCheck || card.xref?.length) && (
        <footer className="dlc-card__foot">
          {card.slideCheck && <p className="dlc-check"><span className="dlc-eq__k">Slide check:</span> <Inline text={card.slideCheck} terms={terms} /></p>}
          {card.xref?.map((x) => {
            const to = CARD_BY_ID[x.to];
            return to ? (
              <p className="dlc-xref" key={x.to}>
                {x.text} →{' '}
                <button type="button" className="dlc-link" onClick={() => onJump?.(to.id)}>{fullLabel(to)}</button>
              </p>
            ) : null;
          })}
        </footer>
      )}
    </article>
  );
}

// One Labs & Projects panel: goal, data, models, result, then its cards.
export function LabPanel({ lp, cards, terms, images, onJump }) {
  return (
    <section className="dlc-lp" id={`dlc-${lp.id}`} data-lp={lp.id}>
      <header className="dlc-lp__head">
        <h3 className="dlc-lp__title">{lp.title}</h3>
        <span className="dlc-card__src">{lp.sources.map((s) => <span className="dlc-src" key={s}>{s}</span>)}</span>
      </header>
      <dl className="dlc-lp__facts">
        <dt>Goal</dt><dd><Inline text={lp.goal} terms={terms} /></dd>
        <dt>Data</dt><dd>{lp.data.map((d, i) => <span key={i} className="dlc-lp__line"><Inline text={d} terms={terms} /></span>)}</dd>
        <dt>{lp.models.length > 1 ? 'Models' : 'Model'}</dt><dd>{lp.models.map((d, i) => <span key={i} className="dlc-lp__line"><Inline text={d} terms={terms} /></span>)}</dd>
        <dt>{lp.resultKind === 'target' ? 'Target' : 'Result'}</dt><dd>{lp.result.map((d, i) => <span key={i} className="dlc-lp__line"><Inline text={d} terms={terms} /></span>)}</dd>
      </dl>
      <div className="dlc-list">
        {cards.map((c) => <Card key={c.id} card={c} terms={terms} image={images?.[c.id]} onJump={onJump} />)}
      </div>
    </section>
  );
}

