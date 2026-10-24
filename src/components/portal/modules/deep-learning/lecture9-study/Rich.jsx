import { Fragment, useState } from 'react';
import { Link } from 'react-router-dom';
import { Tex, Eq, Code, Note, Unfold, Fnote } from '../kit';
import { useStudy } from './context';
import { NAMED_CODE } from './slideData';
import { Diagram } from './diagrams';
import { texText } from './texText';
import { TOKEN, firstSentence } from './richToken';

/* ============================================================================
   LECTURE 9 STUDY — TEXT RENDERING
   ----------------------------------------------------------------------------
     Rich            one string of inline markup → React nodes:
                       ***bold italic***  **bold**  *italic*  `code`  $tex$
                       [label](#id)  [^n]
                       [label](/portal/…)  a link to another portal page
                       {g|…}  green pen (notebook pages only)
                     (an earliest-match tokeniser, like ../../markdownLite.js,
                     so nothing is ever injected as HTML)
     Blocks          a section's `read` array → paragraphs, equations, code
                     (inline, or a named slide listing from slideData.js),
                     notes, slide checks (folded to their first sentence
                     on screen, open in print), unfolds and { fig } (a
                     line-art diagram from diagrams.jsx shown in the Read
                     beat)

   Maths prints twice over: KaTeX for the eye, and a print-only plain-text
   twin (.dl9s-texalt, from texText.js) so the PDF's text layer reads as
   words a reader — or NotebookLM — can follow.
   ========================================================================== */

// the tokeniser lives in ./richToken.js (TOKEN)

function SecLink({ id, children }) {
  const { jumpTo } = useStudy();
  return (
    <button type="button" className="dl9s-link" onClick={() => jumpTo(id)}>
      {children}
    </button>
  );
}

// Inline maths: KaTeX on screen, its plain-text twin in print.
function M({ src }) {
  return (
    <span className="dl9s-m">
      <Tex src={src} />
      <span className="dl9s-texalt">{texText(src)}</span>
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
      out.push(<span key={tk} className="dl9s-sh__g">{parse(rest.slice(g + GREEN.length, gEnd), tk)}</span>);
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
    else if (m[5]) out.push(<Fnote key={tk} n={Number(tok.slice(2, -1))} />);
    else if (m[6]) {
      const [, label, target] = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(tok);
      if (target.startsWith('/')) out.push(<Link key={tk} className="dl9s-link" to={target}>{parse(label, tk)}</Link>);
      else out.push(<SecLink key={tk} id={target.slice(1)}>{parse(label, tk)}</SecLink>);
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
            <button type="button" className="dl9s-more" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
              {open ? 'less' : 'more'}
            </button>
          </>
        )}
      </p>
    </Note>
  );
}

export function Blocks({ blocks }) {
  return blocks.map((b, i) => {
    if (typeof b === 'string') return <p key={i} className="dl9s-p"><Rich text={b} /></p>;
    if (b.eq) {
      return (
        <div key={i} className="dl9s-eq">
          <Eq name={b.eq.name} src={b.eq.tex} read={b.eq.read} />
          <p className="dl9s-texalt dl9s-texalt--block">{texText(b.eq.tex)}</p>
        </div>
      );
    }
    if (b.list) {
      return (
        <ul key={i} className="dl9s-list">
          {b.list.map((li, j) => <li key={j}><Rich text={li} /></li>)}
        </ul>
      );
    }
    if (b.code) return <Code key={i} code={NAMED_CODE[b.code.src] ?? b.code.src} label={b.code.label} meta={b.code.meta} />;
    if (b.note) return <Note key={i} label={b.label ?? 'Note'}><p><Rich text={b.note} /></p></Note>;
    if (b.slideNote) return <SlideCheck key={i} text={b.slideNote} />;
    if (b.fig) return <figure key={i} className="dl9s-readfig"><Diagram fig={b.fig} /></figure>;
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
