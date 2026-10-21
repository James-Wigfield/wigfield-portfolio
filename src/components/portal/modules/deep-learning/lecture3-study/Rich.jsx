import { Fragment } from 'react';
import { Tex, Eq, Code, Note, Unfold, Fnote } from '../kit';
import { useStudy } from './context';
import { SLIDE6_FILTERS, SLIDE17_CODE, FLOWERS_CODE, ARCHS } from './slideData';

/* ============================================================================
   LECTURE 3 STUDY — TEXT RENDERING
   ----------------------------------------------------------------------------
     Rich            one string of inline markup → React nodes:
                       **bold**  *italic*  `code`  $tex$  [label](#id)  [^n]
                     (an earliest-match tokeniser, like ../../markdownLite.js,
                     so nothing is ever injected as HTML)
     Blocks          a section's `read` array → paragraphs, equations, code,
                     notes, unfolds and the §12 comparison table
     FilterMatrices  the four slide-6 filters as matrices
     ArchTable       ARCHS rows (slideData.js) as a comparison table: model ·
                     year · who · key idea · result
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

const DEEP_DIVE = { s12a: '12.1', s12b: '12.2', s12c: '12.3' };

function ArchTable({ ids }) {
  const { jumpTo } = useStudy();
  const rows = ids.map((id) => ARCHS.find((a) => a.id === id)).filter(Boolean);
  return (
    <div className="dl3s-arch">
      <table className="dl3s-arch__table">
        <caption className="dl3s-arch__cap">Five classic architectures (slides 37–46)</caption>
        <thead>
          <tr>
            <th scope="col">Model</th>
            <th scope="col">Who</th>
            <th scope="col">Key idea</th>
            <th scope="col">Result</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((a) => (
            <tr key={a.id}>
              <th scope="row" className="dl3s-arch__model">
                <b>{a.name}</b>
                <span className="dl3s-arch__year">{a.year}</span>
                <button type="button" className="dl3s-link dl3s-arch__more dl3s-ddref" onClick={() => jumpTo(a.sec)} aria-label={`Open the §${DEEP_DIVE[a.sec]} deep dive on ${a.name}`}>§{DEEP_DIVE[a.sec]}</button>
              </th>
              <td data-label="Who">{a.who}</td>
              <td data-label="Key idea">{a.key}</td>
              <td data-label="Result" className="dl3s-arch__res">{a.result}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Blocks({ blocks }) {
  return blocks.map((b, i) => {
    if (typeof b === 'string') return <p key={i} className="dl3s-p"><Rich text={b} /></p>;
    if (b.screen) return <p key={i} className="dl3s-p dl3s-screenonly"><Rich text={b.screen} /></p>;
    if (b.dd) return <p key={i} className="dl3s-p dl3s-ddref"><Rich text={b.dd} /></p>;
    if (b.eq) return <Eq key={i} name={b.eq.name} src={b.eq.tex} read={b.eq.read} />;
    if (b.list) {
      const list = (
        <ul key={i} className="dl3s-list">
          {b.list.map((li, j) => <li key={j}><Rich text={li} /></li>)}
        </ul>
      );
      if (!b.lead) return list;
      return (
        <div key={i} className="dl3s-leadlist">
          <p className="dl3s-leadlist__lead">{b.lead}</p>
          {list}
        </div>
      );
    }
    if (b.archTable) return <ArchTable key={i} ids={b.archTable} />;
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
