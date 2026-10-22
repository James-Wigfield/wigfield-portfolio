import { Fragment } from 'react';
import { Tex, Eq, Code, Note, Unfold, Fnote } from '../kit';
import { useStudy } from './context';
import { NAMED_CODE } from './slideData';
import { Diagram } from './diagrams';
import { texText } from './texText';

/* ============================================================================
   LECTURES 6–7 STUDY — TEXT RENDERING
   ----------------------------------------------------------------------------
     Rich            one string of inline markup → React nodes:
                       **bold**  *italic*  `code`  $tex$  [label](#id)  [^n]
                       {g|…}  green pen (notebook pages only)
                     (an earliest-match tokeniser, like ../../markdownLite.js,
                     so nothing is ever injected as HTML)
     Blocks          a section's `read` array → paragraphs, equations, code
                     (inline, or a named slide listing from slideData.js),
                     notes, slide checks, unfolds and { fig } (a line-art
                     diagram from diagrams.jsx shown in the Read beat)

   Maths prints twice over: KaTeX for the eye, and a print-only plain-text
   twin (.dl67s-texalt, from texText.js) so the PDF's text layer reads as
   words a reader — or NotebookLM — can follow.
   ========================================================================== */

const TOKEN = /(`[^`]+`)|(\$[^$]+\$)|(\*\*.+?\*\*)|(\[\^\d+\])|(\[[^\]]+\]\(#[a-z0-9]+\))|(\*[^*\n]+?\*)/;

function SecLink({ id, children }) {
  const { jumpTo } = useStudy();
  return (
    <button type="button" className="dl67s-link" onClick={() => jumpTo(id)}>
      {children}
    </button>
  );
}

// Inline maths: KaTeX on screen, its plain-text twin in print.
function M({ src }) {
  return (
    <span className="dl67s-m">
      <Tex src={src} />
      <span className="dl67s-texalt">{texText(src)}</span>
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
      out.push(<span key={tk} className="dl67s-sh__g">{parse(rest.slice(g + GREEN.length, gEnd), tk)}</span>);
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
    if (typeof b === 'string') return <p key={i} className="dl67s-p"><Rich text={b} /></p>;
    // a paragraph for the screen only, or for the PDF only
    if (b.screen) return <p key={i} className="dl67s-p dl67s-screenonly"><Rich text={b.screen} /></p>;
    if (b.print) return <p key={i} className="dl67s-p dl67s-printonly"><Rich text={b.print} /></p>;
    if (b.eq) {
      return (
        <div key={i} className="dl67s-eq">
          <Eq name={b.eq.name} src={b.eq.tex} read={b.eq.read} />
          <p className="dl67s-texalt dl67s-texalt--block">{texText(b.eq.tex)}</p>
        </div>
      );
    }
    if (b.list) {
      const L = b.ordered ? 'ol' : 'ul';
      return (
        <L key={i} className={`dl67s-list${b.ordered ? ' dl67s-list--ol' : ''}`}>
          {b.list.map((li, j) => <li key={j}><Rich text={li} /></li>)}
        </L>
      );
    }
    if (b.code) return <Code key={i} code={NAMED_CODE[b.code.src] ?? b.code.src} label={b.code.label} meta={b.code.meta} />;
    if (b.note) return <Note key={i} label={b.label ?? 'Note'}><p><Rich text={b.note} /></p></Note>;
    if (b.slideNote) return <Note key={i} label="Slide check" tone="warn"><p><Rich text={b.slideNote} /></p></Note>;
    if (b.fig) return <figure key={i} className="dl67s-readfig"><Diagram fig={b.fig} /></figure>;
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
