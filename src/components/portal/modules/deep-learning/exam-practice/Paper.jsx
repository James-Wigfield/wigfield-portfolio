import { useEffect, useRef } from 'react';
import { Tex } from '../kit';
import { Rich } from './Rich';
import { Figure } from './figures';
import { Ink } from './Ink';
import { texText } from './texText';
import { pyTokens } from './pycode';
import { useXp } from './context';
import { LEC, slideRows } from './papers/lectures';
import { questionTopics, receiptOf, leafLectures } from './papers';

/* ============================================================================
   EXAM PRACTICE — THE PAPER (sheets, parts, ruled space, reveal, self-mark)
   ----------------------------------------------------------------------------
   Drawn like the sample PDF: an off-white A4-proportioned sheet, a serif
   (KaTeX_Main), the small-caps running head over a rule, "Question 1. (20
   marks)", hanging part labels, marks right-aligned, "Page N of M", and grey
   ruled lines under each part (the sample's own counts; the practice papers
   follow tools/dl-exam-practice/format-spec.md §7).
     Sheet          one page: running head, body, footer (the cover has none)
     Cover          the title page in the sample's words
     QuestionView   a question's parts grouped onto their pages
     Part           prompt → ruled space → controls; a part with subparts
                    shares one ruled space below the last subpart
   The right margin holds what a printed paper doesn't: each part's lecture
   and slides (a labelled dot, never a pill) and the marker's red ticks.
   ========================================================================== */

const marksText = (n) => `(${n} mark${n === 1 ? '' : 's'})`;
const Marks = ({ n }) => <span className="dlxp-marks">{marksText(n)}</span>;

export function Sheet({ paper, page, cover = false, className = '', children }) {
  return (
    <article lang="en" className={`dlxp-sheet${cover ? ' dlxp-sheet--cover' : ''} ${className}`} aria-label={`${paper.name}, page ${page} of ${paper.pages}`}>
      {!cover && (
        <header className="dlxp-runhead">
          <span className="dlxp-runhead__l">{paper.head}</span>
          <span>CITS5017 Deep Learning</span>
        </header>
      )}
      <div className="dlxp-sheet__body">{children}</div>
      {!cover && <footer className="dlxp-foot">Page {page} of {paper.pages}</footer>}
    </article>
  );
}

export function PaperCode({ code }) {
  const lines = code.replace(/\n$/, '').split('\n');
  return (
    <pre className="dlxp-code">
      <code>
        {lines.map((ln, i) => (
          <span key={i} className="dlxp-code__line">
            {pyTokens(ln).map((t, j) => (t.cls ? <span key={j} className={`dlxp-tk-${t.cls}`}>{t.t}</span> : t.t))}
          </span>
        ))}
      </code>
    </pre>
  );
}

// A prompt's blocks; the marks ride at the right of its last line of text.
export function Prompt({ blocks, marks }) {
  const attach = marks != null && typeof blocks[blocks.length - 1] === 'string';
  return (
    <div className="dlxp-prompt">
      {blocks.map((b, i) => {
        if (typeof b === 'string') {
          return (
            <p key={i} className="dlxp-prompt__p">
              <Rich text={b} />
              {attach && i === blocks.length - 1 && <Marks n={marks} />}
            </p>
          );
        }
        if (b.code) return <PaperCode key={i} code={b.code} />;
        if (b.eq) {
          return (
            <div key={i} className="dlxp-prompt__eq">
              <Tex src={b.eq} block />
              <span className="dlxp-texalt dlxp-texalt--block">{texText(b.eq)}</span>
            </div>
          );
        }
        if (b.fig) {
          return (
            <figure key={i} className="dlxp-prompt__fig">
              <Figure name={b.fig} />
              {b.desc && <figcaption className="dlxp-figdesc">{b.desc}</figcaption>}
            </figure>
          );
        }
        if (b.table) {
          return (
            <table key={i} className="dlxp-ptable">
              <thead>
                <tr>{b.table.head.map((c, j) => <th key={j}><Rich text={c} /></th>)}</tr>
              </thead>
              <tbody>
                {b.table.rows.map((r, j) => (
                  <tr key={j}>{r.map((c, k) => <td key={k}><Rich text={c} /></td>)}</tr>
                ))}
              </tbody>
            </table>
          );
        }
        return null;
      })}
      {marks != null && !attach && <p className="dlxp-prompt__p dlxp-prompt__p--marks"><Marks n={marks} /></p>}
    </div>
  );
}

// "● L3 · 15–16, 20–28, 31": a part's lectures, one row each, with their
// slide ranges merged, in the margin (inline when narrow)
export function MarginLabel({ leaf }) {
  const rows = slideRows(leaf.topics);
  return (
    <span className="dlxp-mlabel" aria-label={`Covers ${rows.map((r) => `${LEC[r.lec]?.label} slides ${r.text}`).join('; ')}`}>
      {rows.map((r) => (
        <span key={r.lec} className="dlxp-mlabel__t">
          <i className="dlxp-dot" style={{ '--dot': LEC[r.lec]?.dot }} aria-hidden="true" />
          {LEC[r.lec]?.label} · {r.text}
        </span>
      ))}
    </span>
  );
}

// The question's quiet topic line: one labelled dot per lecture with its
// first two topics (the full list in the tooltip and for screen readers).
export function TopicLine({ question }) {
  const byLec = new Map();
  questionTopics(question).forEach((t) => {
    if (!byLec.has(t.lec)) byLec.set(t.lec, []);
    if (!byLec.get(t.lec).includes(t.name)) byLec.get(t.lec).push(t.name);
  });
  return (
    <p className="dlxp-topics">
      <span className="dlxp-topics__k">Topics</span>
      {[...byLec].map(([lec, names]) => (
        <span key={lec} className="dlxp-topics__t" title={`${LEC[lec]?.label}: ${names.join(', ')}`}>
          <i className="dlxp-dot" style={{ '--dot': LEC[lec]?.dot }} aria-hidden="true" />
          <span>
            <span className="dlxp-topics__lec">{LEC[lec]?.label}</span> {names.slice(0, 2).join(', ')}
            {names.length > 2 && (
              <>
                <span className="dlxp-topics__more" aria-hidden="true"> …</span>
                <span className="dlxp-topics__rest">, {names.slice(2).join(', ')}</span>
              </>
            )}
          </span>
        </span>
      ))}
    </p>
  );
}

// A marker's ring: a quick red loop around the chosen numeral.
function Ring() {
  return (
    <svg className="dlxp-ring" viewBox="0 0 40 34" aria-hidden="true" focusable="false">
      <path d="M27 5.5 C 18 1.5, 4.5 5, 4 16 C 3.6 26, 17 31.5, 28 28 C 37 25, 38 12, 30 7 C 25 4, 16 3.6, 12 6.5" />
    </svg>
  );
}

function MarkRow({ leaf, value, onMark }) {
  return (
    <span className="dlxp-mark" role="group" aria-label={`Your mark for ${leaf.label}, out of ${leaf.marks}`}>
      <span className="dlxp-mark__k">Your mark</span>
      {Array.from({ length: leaf.marks + 1 }, (_, n) => (
        <button
          key={n}
          type="button"
          className={`dlxp-mark__n${value === n ? ' dlxp-mark__n--on' : ''}`}
          aria-pressed={value === n}
          aria-label={`${n} of ${leaf.marks}`}
          onClick={() => onMark(value === n ? null : n)}
        >
          {n}
          {value === n && <Ring />}
        </button>
      ))}
      <span className="dlxp-mark__of">/ {leaf.marks}</span>
    </span>
  );
}

// After a reveal or hide, the ruled space above the controls changes height
// (an answer is usually shorter than its blank lines, and its formulas settle
// a frame later), which would throw the clicked button hundreds of pixels
// away from the pointer. For a moment after the click, scroll by however far
// the row moved so it stays put, but never push the top of a newly revealed
// answer under the sticky question bar, and let go as soon as anything else
// scrolls the page (the reader, or the browser's own scroll anchoring).
function useStayPut(rowRef) {
  const stop = useRef(null);
  useEffect(() => () => stop.current?.(), []);
  return (revealing) => {
    stop.current?.();
    const row = rowRef.current;
    const ruled = row?.closest('.dlxp-part')?.querySelector('.dlxp-ruled');
    if (!ruled || typeof ResizeObserver === 'undefined') return;
    const want = row.getBoundingClientRect().top;
    let expect = window.scrollY;
    const hold = () => {
      if (Math.abs(window.scrollY - expect) > 1) {
        stop.current?.();
        return;
      }
      let by = row.getBoundingClientRect().top - want;
      if (Math.abs(by) < 1) return;
      const bar = document.querySelector('.dl.dlxp .dlxp-qbar');
      if (revealing && by > 0 && bar) {
        const room = ruled.getBoundingClientRect().top - (bar.getBoundingClientRect().bottom + 8);
        by = Math.max(0, Math.min(by, room));
      }
      if (by) window.scrollBy({ top: by, behavior: 'instant' });
      expect = window.scrollY;
    };
    const ro = new ResizeObserver(hold);
    ro.observe(ruled);
    const t = window.setTimeout(() => stop.current?.(), 900);
    stop.current = () => {
      ro.disconnect();
      window.clearTimeout(t);
      stop.current = null;
    };
  };
}

function LeafCtl({ leaf, sub }) {
  const { reveal, marks, picks, setReveal, setMark } = useXp();
  const shown = !!reveal[leaf.id];
  const rowRef = useRef(null);
  const stayPut = useStayPut(rowRef);
  const what = sub ? `${leaf.parentLabel} ${leaf.label}` : leaf.label;
  return (
    <div className="dlxp-ctl__row" ref={rowRef}>
      {sub && <span className="dlxp-ctl__k">{leaf.label}</span>}
      <button
        type="button"
        className={`dlxp-reveal${shown ? ' dlxp-reveal--on' : ''}`}
        aria-pressed={shown}
        aria-label={`${shown ? 'Hide' : 'Reveal'} the model answer to ${what}`}
        data-leaf={leaf.id}
        onClick={() => { stayPut(!shown); setReveal([leaf.id], !shown); }}
      >
        {shown ? 'Hide answer' : 'Reveal answer'}
      </button>
      {shown && <MarkRow leaf={leaf} value={marks[leaf.id]} onMark={(n) => setMark(leaf.id, n)} />}
      {picks.has(leaf.id) && <span className="dlxp-pick"><span className="dlxp-pick__in">in the </span>NotebookLM video</span>}
    </div>
  );
}

function Ruled({ lines, children }) {
  return (
    <div className="dlxp-ruled" style={{ '--lines': lines }}>
      {children}
    </div>
  );
}

export function Part({ part }) {
  const { reveal, fresh, filter } = useXp();
  const leaves = part.subs ? part.subs.map((s) => ({ ...s, parentLabel: part.label })) : [part];
  const on = (l) => filter === 'all' || leafLectures(l).includes(filter);
  const anyOn = leaves.some(on);
  return (
    <section className={`dlxp-part${anyOn ? '' : ' dlxp-part--dim'}`} id={`dlxp-${part.id}`} data-part={part.id}>
      <div className="dlxp-part__q">
        <span className="dlxp-part__l">{part.label}</span>
        <div className="dlxp-part__body">
          <Prompt blocks={part.prompt} marks={part.subs ? undefined : part.marks} />
          {part.subs && (
            <div className="dlxp-subs">
              {part.subs.map((s) => (
                <div key={s.id} className={`dlxp-sub${on(s) ? '' : ' dlxp-sub--dim'}`}>
                  <span className="dlxp-sub__l">{s.label}</span>
                  <div className="dlxp-sub__body">
                    <Prompt blocks={s.prompt} marks={s.marks} />
                    <MarginLabel leaf={s} />
                  </div>
                </div>
              ))}
            </div>
          )}
          {!part.subs && <MarginLabel leaf={part} />}
        </div>
      </div>
      <Ruled lines={part.lines}>
        {leaves.filter((l) => reveal[l.id]).map((l) => (
          <Ink key={l.id} answer={l.answer} write={fresh.has(l.id)} receipt={receiptOf(l)} label={part.subs ? l.label : null} />
        ))}
      </Ruled>
      <div className="dlxp-ctl">
        {leaves.map((l) => <LeafCtl key={l.id} leaf={l} sub={!!part.subs} />)}
      </div>
    </section>
  );
}

export function QuestionHead({ question }) {
  return (
    <>
      <h3 className="dlxp-qhead"><b>Question {question.n}.</b> (20 marks)</h3>
      <TopicLine question={question} />
    </>
  );
}

// A question's parts on their pages (the sample keeps the PDF's page breaks).
export function QuestionView({ paper, question, last }) {
  const pages = [];
  question.parts.forEach((p) => {
    const cur = pages[pages.length - 1];
    if (cur && cur.page === p.page) cur.parts.push(p);
    else pages.push({ page: p.page, parts: [p] });
  });
  return pages.map(({ page, parts }, i) => (
    <Sheet key={page} paper={paper} page={page}>
      {i === 0 && <QuestionHead question={question} />}
      {parts.map((p) => <Part key={p.id} part={p} />)}
      {last && i === pages.length - 1 && <p className="dlxp-end"><span>END OF EXAMINATION PAPER</span></p>}
    </Sheet>
  ));
}

export function Cover({ paper }) {
  const c = paper.cover;
  return (
    <Sheet paper={paper} page={1} cover>
      <div className="dlxp-cover">
        <p className="dlxp-cover__title">CITS5017 Deep Learning<br />Semester Two 2026</p>
        <p className="dlxp-cover__contains"><Rich text={c.contains} /></p>
        <hr className="dlxp-cover__rule" />
        <p>INSTRUCTIONS:</p>
        {c.instructions.map((t, i) => <p key={i}><Rich text={t} /></p>)}
        <span className="dlxp-cover__dash" aria-hidden="true" />
        <p>{c.materialsLead}</p>
        <ul className="dlxp-cover__list">
          {c.materials.map((t, i) => <li key={i}><Rich text={t} /></li>)}
        </ul>
        {c.note && <p className="dlxp-cover__note">{c.note}</p>}
      </div>
    </Sheet>
  );
}
