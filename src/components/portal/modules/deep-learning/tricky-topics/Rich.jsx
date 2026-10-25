import { Fragment, useState } from 'react';
import { Link } from 'react-router-dom';
import { Tex, Eq, Code, Note, Unfold } from '../kit';
import { useStudy } from './context';
import { Diagram } from './Diagram';
import Prov from './Provenance';
import { texText } from './texText';
import { TOKEN, firstSentence, provOf } from './richToken';

/* ============================================================================
   TRICKY TOPICS — TEXT RENDERING
   ----------------------------------------------------------------------------
     Rich            one string of inline markup → React nodes:
                       ***bold italic***  **bold**  *italic*  `code`  $tex$
                       {s|L3 · slide 22}  {own}  {beyond}   provenance labels
                       [label](#stepId)            a step of this topic
                       [label](@topicId)           another topic's tab
                       [label](@topicId#stepId)    a step of another topic
                       [label](/portal/…)          another portal page
                       {g|…}  green pen (notebook pages only)
                     (an earliest-match tokeniser, so nothing is ever
                     injected as HTML)
     Blocks          a step's `read` array → paragraphs, lists, one ruled
                     table, equations, code, notes, slide checks (folded to
                     their first sentence on screen, open in print), unfolds
                     and { fig } (the topic's line art, Diagram.jsx)

   Maths prints twice over: KaTeX for the eye, and a print-only plain-text
   twin (.dltt-texalt, from texText.js) so the PDF's text layer reads as
   words a reader — or NotebookLM — can follow.
   ========================================================================== */

function StepLink({ to, children }) {
  const { jumpTo, goTopic } = useStudy();
  const onClick = () => {
    if (to.startsWith('#')) jumpTo(to.slice(1));
    else {
      const [topic, step] = to.slice(1).split('#');
      goTopic(topic, step);
    }
  };
  return (
    <button type="button" className="dltt-link" onClick={onClick}>
      {children}
    </button>
  );
}

// Inline maths: KaTeX on screen, its plain-text twin in print.
function M({ src }) {
  return (
    <span className="dltt-m">
      <Tex src={src} />
      <span className="dltt-texalt">{texText(src)}</span>
    </span>
  );
}

// {g|…} — the notebook page's green highlight. Its body may hold TeX braces,
// so the closing brace is found by counting, not by the regex.
const GREEN = '{g|';
function closeBrace(text, from) {
  let depth = 0;
  for (let i = from; i < text.length; i++) {
    if (text[i] === '{') depth += 1;
    else if (text[i] === '}' && --depth === 0) return i;
  }
  return -1;
}

function parse(text, key = 'r') {
  const out = [];
  let rest = text;
  let k = 0;
  while (rest) {
    const m = TOKEN.exec(rest);
    const g = rest.indexOf(GREEN);
    const gEnd = g === -1 || (m && m.index < g) ? -1 : closeBrace(rest, g);
    if (gEnd !== -1) {
      if (g > 0) out.push(rest.slice(0, g));
      const tk = `${key}.${k++}`;
      out.push(<span key={tk} className="dltt-sh__g">{parse(rest.slice(g + GREEN.length, gEnd), tk)}</span>);
      rest = rest.slice(gEnd + 1);
      continue;
    }
    if (!m) {
      out.push(rest);
      break;
    }
    if (m.index > 0) out.push(rest.slice(0, m.index));
    const tk = `${key}.${k++}`;
    const tok = m[0];
    if (m[1]) out.push(<code key={tk}>{tok.slice(1, -1)}</code>);
    else if (m[2]) out.push(<M key={tk} src={tok.slice(1, -1)} />);
    else if (m[3]) out.push(<b key={tk}><em>{parse(tok.slice(3, -3), tk)}</em></b>);
    else if (m[4]) out.push(<b key={tk}>{parse(tok.slice(2, -2), tk)}</b>);
    else if (m[5]) {
      const p = provOf(tok);
      out.push(<Prov key={tk} kind={p.kind} text={p.text} />);
    } else if (m[6]) {
      const [, label, target] = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(tok);
      if (target.startsWith('/')) out.push(<Link key={tk} className="dltt-link" to={target}>{parse(label, tk)}</Link>);
      else out.push(<StepLink key={tk} to={target}>{parse(label, tk)}</StepLink>);
    } else out.push(<em key={tk}>{parse(tok.slice(1, -1), tk)}</em>);
    rest = rest.slice(m.index + tok.length);
  }
  return out;
}

export function Rich({ text }) {
  return <>{parse(String(text ?? ''))}</>;
}

// A Slide check: its first sentence, then "more" for the rest (print: all)
function SlideCheck({ text }) {
  const { printing } = useStudy();
  const [open, setOpen] = useState(false);
  const head = firstSentence(text);
  const folds = head !== text;
  const shown = !folds || open || printing ? text : head;
  return (
    <Note label="Slide check" tone="warn">
      <p>
        <Rich text={shown} />
        {folds && !printing && (
          <>
            {' '}
            <button type="button" className="dltt-more" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
              {open ? 'less' : 'more'}
            </button>
          </>
        )}
      </p>
    </Note>
  );
}

// One ruled table (a step's Read holds at most one table or one formula).
// Under 560 px each row becomes a small stacked card (stage.css).
function Table({ t }) {
  return (
    <div className="dltt-tblwrap">
    <div className="dltt-tbl" role="table" aria-label={t.label ?? t.head.join(', ')}>
      <div className="dltt-tbl__row dltt-tbl__row--head" role="row" style={{ '--cols': t.cols ?? `repeat(${t.head.length}, minmax(0, auto))` }}>
        {t.head.map((h, c) => <span key={c} role="columnheader" className="dltt-tbl__th"><Rich text={h} /></span>)}
      </div>
      {t.rows.map((r, i) => (
        <div key={i} className="dltt-tbl__row" role="row" style={{ '--cols': t.cols ?? `repeat(${t.head.length}, minmax(0, auto))` }}>
          {r.map((cell, c) => (
            <span key={c} role="cell" className="dltt-tbl__td" data-k={t.head[c]?.replace(/[$*`{}|\\]/g, '') || undefined}>
              <Rich text={cell} />
            </span>
          ))}
        </div>
      ))}
    </div>
    </div>
  );
}

export function Blocks({ blocks }) {
  return blocks.map((b, i) => {
    if (typeof b === 'string') return <p key={i} className="dltt-p"><Rich text={b} /></p>;
    if (b.eq) {
      return (
        <div key={i} className="dltt-eq">
          <Eq name={b.eq.name} src={b.eq.tex} read={b.eq.read} />
          <p className="dltt-texalt dltt-texalt--block">{texText(b.eq.tex)}</p>
          {b.eq.prov && <p className="dltt-eq__prov"><Rich text={b.eq.prov} /></p>}
        </div>
      );
    }
    if (b.list) {
      return (
        <ul key={i} className="dltt-list">
          {b.list.map((li, j) => <li key={j}><Rich text={li} /></li>)}
        </ul>
      );
    }
    if (b.table) return <Table key={i} t={b.table} />;
    if (b.code) return <Code key={i} code={b.code.src} label={b.code.label} meta={b.code.meta} />;
    if (b.note) return <Note key={i} label={b.label ?? 'Note'}><p><Rich text={b.note} /></p></Note>;
    if (b.slideNote) return <SlideCheck key={i} text={b.slideNote} />;
    if (b.fig) return <figure key={i} className="dltt-readfig"><Diagram fig={b.fig} /></figure>;
    if (b.unfold) {
      return (
        <Unfold key={i} label={b.unfold.label}>
          <Blocks blocks={b.unfold.blocks} />
        </Unfold>
      );
    }
    return <Fragment key={i} />;
  });
}
