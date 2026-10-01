import { Fragment } from 'react';
import { Tex, Eq, Code, Note, Unfold, Fnote } from '../kit';
import { useStudy } from './context';
import { SLIDE6_FILTERS, SLIDE17_CODE, FLOWERS_CODE } from './slideData';

/* ============================================================================
   LECTURE 3 STUDY — TEXT RENDERING
   ----------------------------------------------------------------------------
     Rich            one string of inline markup → React nodes:
                       **bold**  *italic*  `code`  $tex$  [label](#id)  [^n]
                     (an earliest-match tokeniser, like ../../markdownLite.js,
                     so nothing is ever injected as HTML)
     Blocks          a section's `read` array → paragraphs, equations, code,
                     notes and unfolds
     FilterMatrices  the four slide-6 filters as matrices
   ========================================================================== */

const TOKEN = /(`[^`]+`)|(\$[^$]+\$)|(\*\*.+?\*\*)|(\[\^\d+\])|(\[[^\]]+\]\(#[a-z0-9]+\))|(\*[^*\n]+?\*)/;

function SecLink({ id, children }) {
  const { jumpTo } = useStudy();
  return (
    <button type="button" className="dl3s-link" onClick={() => jumpTo(id)}>
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

const NAMED_CODE = { slide17: SLIDE17_CODE, flowers: FLOWERS_CODE };

export function FilterMatrices({ compact = false }) {
  const mat = (m) => `\\begin{bmatrix} ${m.map((r) => r.join(' & ')).join(' \\\\ ')} \\end{bmatrix}`;
  return (
    <div className={`dl3s-filters${compact ? ' dl3s-filters--compact' : ''}`}>
      {SLIDE6_FILTERS.map((f) => (
        <figure key={f.id} className="dl3s-filters__item">
          <Tex src={f.div === 9 ? `\\tfrac{1}{9}${mat(f.m)}` : mat(f.m)} />
          <figcaption>
            <b>{f.name}</b>
            <span>{f.role}</span>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

export function Blocks({ blocks }) {
  return blocks.map((b, i) => {
    if (typeof b === 'string') return <p key={i} className="dl3s-p"><Rich text={b} /></p>;
    if (b.eq) return <Eq key={i} name={b.eq.name} src={b.eq.tex} read={b.eq.read} />;
    if (b.list) {
      return (
        <ul key={i} className="dl3s-list">
          {b.list.map((li, j) => <li key={j}><Rich text={li} /></li>)}
        </ul>
      );
    }
    if (b.code) return <Code key={i} code={NAMED_CODE[b.code.src] ?? b.code.src} label={b.code.label} meta={b.code.meta} />;
    if (b.matrices) return <FilterMatrices key={i} />;
    if (b.note) return <Note key={i} label="Note"><p><Rich text={b.note} /></p></Note>;
    if (b.slideNote) return <Note key={i} label="Slide check" tone="warn"><p><Rich text={b.slideNote} /></p></Note>;
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
