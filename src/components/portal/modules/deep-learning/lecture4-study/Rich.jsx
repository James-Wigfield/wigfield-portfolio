import { Fragment } from 'react';
import { Tex, Eq, Code, Note, Unfold, Fnote } from '../kit';
import { useStudy } from './context';
import { NAMED_CODE } from './slideData';
import { Diagram } from './diagrams';

/* ============================================================================
   LECTURE 4 STUDY — TEXT RENDERING
   ----------------------------------------------------------------------------
     Rich            one string of inline markup → React nodes:
                       **bold**  *italic*  `code`  $tex$  [label](#id)  [^n]
                     (an earliest-match tokeniser, like ../../markdownLite.js,
                     so nothing is ever injected as HTML)
     Blocks          a section's `read` array → paragraphs, equations, code
                     (inline, or a named slide listing from slideData.js),
                     notes, slide checks, unfolds and { fig } (a line-art
                     diagram from diagrams.jsx shown in the Read beat)
   ========================================================================== */

const TOKEN = /(`[^`]+`)|(\$[^$]+\$)|(\*\*.+?\*\*)|(\[\^\d+\])|(\[[^\]]+\]\(#[a-z0-9]+\))|(\*[^*\n]+?\*)/;

function SecLink({ id, children }) {
  const { jumpTo } = useStudy();
  return (
    <button type="button" className="dl4s-link" onClick={() => jumpTo(id)}>
      {children}
    </button>
  );
}

function parse(text, key = 'r') {
  const out = [];
  let rest = text;
  let k = 0;
  while (rest) {
    const m = TOKEN.exec(rest);
    if (!m) {
      out.push(rest);
      break;
    }
    if (m.index > 0) out.push(rest.slice(0, m.index));
    const tk = `${key}.${k++}`;
    const tok = m[0];
    if (m[1]) out.push(<code key={tk}>{tok.slice(1, -1)}</code>);
    else if (m[2]) out.push(<Tex key={tk} src={tok.slice(1, -1)} />);
    else if (m[3]) out.push(<b key={tk}>{parse(tok.slice(2, -2), tk)}</b>);
    else if (m[4]) out.push(<Fnote key={tk} n={Number(tok.slice(2, -1))} />);
    else if (m[5]) {
      const [, label, id] = /^\[([^\]]+)\]\(#([a-z0-9]+)\)$/.exec(tok);
      out.push(<SecLink key={tk} id={id}>{parse(label, tk)}</SecLink>);
    } else out.push(<em key={tk}>{parse(tok.slice(1, -1), tk)}</em>);
    rest = rest.slice(m.index + tok.length);
  }
  return out;
}

export function Rich({ text }) {
  return <>{parse(String(text ?? ''))}</>;
}

export function Blocks({ blocks }) {
  return blocks.map((b, i) => {
    if (typeof b === 'string') return <p key={i} className="dl4s-p"><Rich text={b} /></p>;
    if (b.eq) return <Eq key={i} name={b.eq.name} src={b.eq.tex} read={b.eq.read} />;
    if (b.list) {
      return (
        <ul key={i} className="dl4s-list">
          {b.list.map((li, j) => <li key={j}><Rich text={li} /></li>)}
        </ul>
      );
    }
    if (b.code) return <Code key={i} code={NAMED_CODE[b.code.src] ?? b.code.src} label={b.code.label} meta={b.code.meta} />;
    if (b.note) return <Note key={i} label="Note"><p><Rich text={b.note} /></p></Note>;
    if (b.slideNote) return <Note key={i} label="Slide check" tone="warn"><p><Rich text={b.slideNote} /></p></Note>;
    if (b.fig) return <figure key={i} className="dl4s-readfig"><Diagram fig={b.fig} /></figure>;
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
