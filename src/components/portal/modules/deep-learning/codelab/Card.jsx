import { Fragment, useEffect, useRef, useState } from 'react';
import { Tex } from '../kit';
import CodePanel from './CodePanel';
import { Diagram, DiagramAcross } from './diagrams';
import { layoutDiagram, SCREEN } from './diagramLayout';
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
   table counts.js computes, folded under its total on screen), Shapes,
   Equation ↔ code, What's it for. A Slide check and a cross-link close it
   when it has them.
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
          <td className="dlc-count__rule">{hasNt ? `${fmt(f.tr + f.nt)} in all` : 'all trainable'}</td>
        </tr>
      </tfoot>
    </table>
  );
}

// On screen the table folds under its total (the working is a click away);
// on paper it is always open.
function CountFold({ spec, named, printing }) {
  const f = flow(spec);
  return (
    <details className="dlc-fold" open={printing || undefined}>
      <summary>
        {named && spec.name && <span className="dlc-fold__name">{spec.name}</span>}
        <span className="dlc-fold__total">{fmt(f.tr)} trainable{f.nt ? ` · ${fmt(f.nt)} non-trainable` : ''}</span>
        <span className="dlc-fold__hint">layer by layer</span>
      </summary>
      <CountTable spec={spec} />
    </details>
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

// the check's label follows where the code came from
const CHECK = { verbatim: 'Slide check', trimmed: 'Slide check', notebook: 'Notebook check', geron: 'Notebook check', reconstructed: 'Sheet check' };
// a screen diagram wider than this (px) goes under the code, not beside it
const WIDE_SCREEN = 300;

// Rough heights of the two stacks, in text lines, to put the Shapes table
// under the shorter one (the code column is wider, so it rarely is).
function stackEstimate(card, countSpecs) {
  const m = card.moves || {};
  const lines = codeLines(card.code);
  const a = lines.length + lines.filter((l) => l.length > 68).length + 2
    + (m.eq ? m.eq.length * 4 : 0) + countSpecs.reduce((s, sp) => s + sp.layers.length + (sp.inputs || []).length + 3, 0);
  const prose = (t) => Math.ceil((t || '').length / 52);
  const b = card.marks.reduce((s, mk) => s + prose(`${markQuote(card.code, mk)} ${mk.say}`) + 0.4, 0) + prose(m.say) + prose(m.forWhat) + 1;
  const shapes = m.shapes ? m.shapes.reduce((s, x) => s + 1 + Math.ceil(`${x.name} ${x.shape} ${x.means}`.length / 60), 1) : 0;
  return { a, b, shapes };
}

export function Card({ card, terms, image, onJump, tabName, printing = false }) {
  const m = card.moves || {};
  const drawSpec = m.draw ? SPECS[m.draw] : null;
  const countSpecs = (Array.isArray(m.count) ? m.count : m.count ? [m.count] : []).map((id) => SPECS[id]);
  const wide = drawSpec && layoutDiagram(drawSpec, SCREEN).width > WIDE_SCREEN;
  const draw = drawSpec && <Move k="Draw it" kind="draw"><Diagram spec={drawSpec} /></Move>;
  const est = stackEstimate(card, countSpecs);
  const shapesInB = est.a > est.b + est.shapes / 2;
  // on paper the check goes under the legend when that column has room
  const checkLines = Math.ceil((card.slideCheck || '').length / 52) + 1;
  const checkInB = !!card.slideCheck && est.a >= est.b + (shapesInB ? est.shapes : 0) + checkLines - 1;
  const check = card.slideCheck && <p className="dlc-check"><span className="dlc-eq__k">{CHECK[card.provenance] || 'Slide check'}:</span> <Inline text={card.slideCheck} terms={terms} /></p>;
  const shapes = m.shapes && <Move k="Shapes" kind="shapes"><Shapes shapes={m.shapes} terms={terms} /></Move>;
  return (
    <article className={`dlc-card dlc-card--${card.rating}`} id={`dlc-${card.id}`} data-card={card.id}>
      <header className="dlc-card__head">
        <h3 className="dlc-card__title">
          <span className="dlc-card__label">{card.label}</span> · <Hi text={card.title} terms={terms} />
        </h3>
        <span className="dlc-rate" data-rate={card.rating}><i aria-hidden="true" />{card.rating}</span>
        {tabName && <span className="dlc-card__tab">in {tabName}</span>}
        <span className="dlc-card__src">
          {card.sources.map((s) => <span className="dlc-src" key={sourceText(s)}>{sourceText(s)}</span>)}
          <span className="dlc-prov">{provenanceText(card)}</span>
        </span>
        <span className="dlc-card__tools"><CopyButton code={card.code} /></span>
      </header>
      <p className="dlc-card__why"><Inline text={card.why} terms={terms} /></p>
      {/* two stacks, so the long column of one doesn't stretch the other:
          A = code, shapes, equations, count (and a wide diagram);
          B = the marks legend, the exam move, the diagram */}
      <div className="dlc-card__body">
        <div className="dlc-card__colA">
          <div className="dlc-card__main">
            <CodePanel code={card.code} marks={card.marks} file={card.file} meta={fullLabel(card)} image={image} />
          </div>
          {!shapesInB && shapes}
          {m.eq && <Move k="Equation ↔ code" kind="eq"><EqCode eq={m.eq} code={card.code} /></Move>}
          {countSpecs.length > 0 && (
            <Move k="Count it" kind="count">
              {countSpecs.map((sp) => <CountFold key={sp.id} spec={sp} named={countSpecs.length > 1} printing={printing} />)}
            </Move>
          )}
          {wide && draw}
        </div>
        <div className="dlc-card__colB">
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
            {m.say && <p className="dlc-card__move"><Inline text={m.say} terms={terms} /></p>}
            {m.forWhat && <p className="dlc-card__for"><span className="dlc-eq__k">What’s it for:</span> <Inline text={m.forWhat} terms={terms} /></p>}
          </div>
          {shapesInB && shapes}
          {checkInB && <div className="dlc-card__pcheck">{check}</div>}
          {!wide && draw}
        </div>
        {drawSpec && <Move k="Draw it" kind="pdraw"><DiagramAcross spec={drawSpec} /></Move>}
      </div>
      {(card.slideCheck || card.xref?.length) && (
        <footer className={`dlc-card__foot${checkInB && !card.xref?.length ? ' dlc-card__foot--pempty' : ''}`}>
          {card.slideCheck && <div className={checkInB ? 'dlc-card__scheck' : undefined}>{check}</div>}
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

// a panel line: prose, or { q } = an output line quoted from my notebook
function Fact({ d, terms }) {
  return (
    <span className="dlc-lp__line">
      {typeof d === 'string' ? <Inline text={d} terms={terms} /> : <code className="dlc-lp__q">{d.q}</code>}
    </span>
  );
}

// On paper the facts are hanging-label paragraphs ("DATA  train X…"), so a
// PDF's text reads each label with its own text, in order.
function PrintFacts({ lp, terms }) {
  const rows = [
    ['Goal', [lp.goal]],
    lp.spec && ['Spec', [lp.spec]],
    ['Data', lp.data],
    [lp.models.length > 1 ? 'Models' : 'Model', lp.models],
    [lp.resultKind === 'target' ? 'Target' : 'Result', lp.result],
    lp.note && ['Note', [lp.note]],
    ...(lp.see || []).filter((x) => CARD_BY_ID[x.to]).map((x) => ['Code', [`${x.text} → ${fullLabel(CARD_BY_ID[x.to])}`]]),
  ].filter(Boolean);
  return (
    <div className="dlc-lp__pfacts">
      {rows.map(([k, items], r) => (
        <p className="dlc-lp__pf" key={r}>
          <span className="dlc-lp__pk">{k}</span>
          {items.map((d, i) => <Fragment key={i}>{i > 0 && <br />}<Fact d={d} terms={terms} /></Fragment>)}
        </p>
      ))}
    </div>
  );
}

// One Labs & Projects panel: goal, data, models, result, then its cards.
export function LabPanel({ lp, cards, terms, images, onJump, printing = false }) {
  return (
    <section className="dlc-lp" id={`dlc-${lp.id}`} data-lp={lp.id}>
      <header className="dlc-lp__head">
        <h3 className="dlc-lp__title">{lp.title}</h3>
        <span className="dlc-card__src">{lp.sources.map((s) => <span className="dlc-src" key={s}>{s}</span>)}</span>
      </header>
      {printing ? <PrintFacts lp={lp} terms={terms} /> : (
      <dl className="dlc-lp__facts">
        <dt>Goal</dt><dd><Inline text={lp.goal} terms={terms} /></dd>
        {lp.spec && <><dt>Spec</dt><dd><Inline text={lp.spec} terms={terms} /></dd></>}
        <dt>Data</dt><dd>{lp.data.map((d, i) => <Fact key={i} d={d} terms={terms} />)}</dd>
        <dt>{lp.models.length > 1 ? 'Models' : 'Model'}</dt><dd>{lp.models.map((d, i) => <Fact key={i} d={d} terms={terms} />)}</dd>
        <dt>{lp.resultKind === 'target' ? 'Target' : 'Result'}</dt><dd>{lp.result.map((d, i) => <Fact key={i} d={d} terms={terms} />)}</dd>
        {lp.note && <><dt>Note</dt><dd><Inline text={lp.note} terms={terms} /></dd></>}
        {lp.see?.map((x) => {
          const to = CARD_BY_ID[x.to];
          return to ? (
            <Fragment key={x.to}><dt>Code</dt><dd>{x.text} → <button type="button" className="dlc-link" onClick={() => onJump?.(to.id)}>{fullLabel(to)}</button></dd></Fragment>
          ) : null;
        })}
      </dl>
      )}
      <div className="dlc-list">
        {cards.map((c) => <Card key={c.id} card={c} terms={terms} image={images?.[c.id]} onJump={onJump} printing={printing} />)}
      </div>
    </section>
  );
}

