import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import { Tex, Eq, Code, Note, Unfold, Fnote } from '../kit';
import { useStudy } from './context';
import { NAMED_CODE } from './slideData';
import { Diagram } from './diagrams';
import { texText } from './texText';

/* ============================================================================
   LECTURES 1–2 REFRESHER — TEXT RENDERING
   ----------------------------------------------------------------------------
     Rich            one string of inline markup → React nodes:
                       **bold**  *italic*  `code`  $tex$  [label](#id)  [^n]
                       [label](/portal/…)  a link to another portal page
                       {g|…}  green pen (notebook pages only)
                     (an earliest-match tokeniser, like ../../markdownLite.js,
                     so nothing is ever injected as HTML)
     Blocks          a section's `read` array → paragraphs, equations, code
                     (inline, or a named slide listing from slideData.js),
                     notes, slide checks, unfolds and { fig } (a line-art
                     diagram from diagrams.jsx shown in the Read beat)

   Maths prints twice over: KaTeX for the eye, and a print-only plain-text
   twin (.dl12r-texalt, from texText.js) so the PDF's text layer reads as
   words a reader — or NotebookLM — can follow.
   ========================================================================== */

const TOKEN = /(`[^`]+`)|(\$[^$]+\$)|(\*\*.+?\*\*)|(\[\^\d+\])|(\[[^\]]+\]\((?:#[a-z0-9]+|\/[^)\s]+)\))|(\*[^*\n]+?\*)/;

function SecLink({ id, children }) {
  const { jumpTo } = useStudy();
  return (
    <button type="button" className="dl12r-link" onClick={() => jumpTo(id)}>
      {children}
    </button>
  );
}

// Inline maths: KaTeX on screen, its plain-text twin in print.
function M({ src }) {
  return (
    <span className="dl12r-m">
      <Tex src={src} />
      <span className="dl12r-texalt">{texText(src)}</span>
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
      out.push(<span key={tk} className="dl12r-sh__g">{parse(rest.slice(g + GREEN.length, gEnd), tk)}</span>);
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
      const [, label, target] = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(tok);
      if (target.startsWith('/')) out.push(<Link key={tk} className="dl12r-link" to={target}>{parse(label, tk)}</Link>);
      else out.push(<SecLink key={tk} id={target.slice(1)}>{parse(label, tk)}</SecLink>);
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
    if (typeof b === 'string') return <p key={i} className="dl12r-p"><Rich text={b} /></p>;
    if (b.eq) {
      return (
        <div key={i} className="dl12r-eq">
          <Eq name={<Rich text={b.eq.name} />} src={b.eq.tex} read={b.eq.read ? <Rich text={b.eq.read} /> : undefined} />
          <p className="dl12r-texalt dl12r-texalt--block">{texText(b.eq.tex)}</p>
        </div>
      );
    }
    if (b.gist) return <p key={i} className="dl12r-gist"><Rich text={b.gist} /></p>;
    if (b.table) {
      return (
        <div key={i} className={`dl12r-tablewrap dl12r-keep${b.table.head.length > 3 ? ' dl12r-tablewrap--wide' : ''}`}>
          <table className="dl12r-table dl12r-table--read">
            <thead>
              <tr>{b.table.head.map((h, c) => <th key={c} scope="col"><Rich text={h} /></th>)}</tr>
            </thead>
            <tbody>
              {b.table.rows.map((r, j) => (
                <tr key={j}>
                  {r.map((cell, c) => (c === 0 ? <th key={c} scope="row"><Rich text={cell} /></th> : <td key={c}><Rich text={cell} /></td>))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    if (b.list) {
      return (
        <ul key={i} className="dl12r-list">
          {b.list.map((li, j) => <li key={j}><Rich text={li} /></li>)}
        </ul>
      );
    }
    if (b.code) return <Code key={i} code={NAMED_CODE[b.code.src] ?? b.code.src} label={b.code.label} meta={b.code.meta} />;
    if (b.note) return <Note key={i} label={b.label ?? 'Note'}><p><Rich text={b.note} /></p></Note>;
    if (b.slideNote) return <Note key={i} label="Slide check" tone="warn"><p><Rich text={b.slideNote} /></p></Note>;
    if (b.fig) return <figure key={i} className="dl12r-readfig"><Diagram fig={b.fig} /></figure>;
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
