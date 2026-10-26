import { PAPERS, paperLeaves, leafLabel, receiptOf, paperMarks } from './papers';
import { Cover, Prompt, TopicLine } from './Paper';
import { Ink } from './Ink';

/* ============================================================================
   EXAM PRACTICE — THE PDF (mounted only while Export PDF prints)
   ----------------------------------------------------------------------------
   Paper by paper (the sample, then A, then B):
     1. the cover, then every question in exam layout: part labels, prompts,
        figures, code, marks and each part's lectures and slides; no ruled
        answer space, so a printout still works as a mock exam;
     2. then "Model answers" for that paper, each under its full label, e.g.
        "Practice Paper A · Question 3 (c)", the label the NotebookLM prompt
        names.
   Left out: tabs, stepper, reveal buttons, self-marks, the filter, the
   export UI and the portal (print.js hides them; this tree has none).
   ========================================================================== */

function PrintPart({ part }) {
  return (
    <div className="dlxp-book__part">
      <div className="dlxp-part__q">
        <span className="dlxp-part__l">{part.label}</span>
        <div className="dlxp-part__body">
          <Prompt blocks={part.prompt} marks={part.subs ? undefined : part.marks} />
          {part.subs ? (
            <div className="dlxp-subs">
              {part.subs.map((s) => (
                <div key={s.id} className="dlxp-sub">
                  <span className="dlxp-sub__l">{s.label}</span>
                  <div className="dlxp-sub__body">
                    <Prompt blocks={s.prompt} marks={s.marks} />
                    <p className="dlxp-book__covers">Lecture slides: {receiptOf(s)}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="dlxp-book__covers">Lecture slides: {receiptOf(part)}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function PrintPaper({ paper }) {
  const leaves = paperLeaves(paper);
  return (
    <section className="dlxp-book__paper">
      <div className="dlxp-book__cover">
        <p className="dlxp-book__papername">{paper.name}</p>
        <Cover paper={paper} />
      </div>
      {paper.questions.map((q) => (
        <section key={q.id} className="dlxp-book__q">
          <h3 className="dlxp-qhead"><b>{paper.name} · Question {q.n}.</b> (20 marks)</h3>
          <TopicLine question={q} />
          {q.parts.map((p) => <PrintPart key={p.id} part={p} />)}
        </section>
      ))}
      <section className="dlxp-book__answers">
        <h3 className="dlxp-book__ah">Model answers · {paper.name}</h3>
        <p className="dlxp-book__alead">
          Full-mark answers, sized to the marks. A tick (✓1) marks each point a marker would reward; the grey line under each answer gives its lecture slides.
        </p>
        {leaves.map((l) => (
          <article key={l.id} className="dlxp-book__ans">
            <h4 className="dlxp-book__al">
              {leafLabel(paper, l.question, l)} <span className="dlxp-book__am">({l.marks} mark{l.marks === 1 ? '' : 's'})</span>
            </h4>
            <Ink answer={l.answer} receipt={receiptOf(l)} />
          </article>
        ))}
      </section>
    </section>
  );
}

export default function PrintBook() {
  return (
    <div className="dlxp-book">
      <section className="dlxp-book__title">
        <p className="dlxp-book__kicker">CITS5017 Deep Learning · Semester Two 2026</p>
        <h2 className="dlxp-book__h">Exam Practice</h2>
        <p className="dlxp-book__lead">
          This PDF holds four papers in the final exam&rsquo;s format, each followed by its model answers:
        </p>
        <ul className="dlxp-book__toc">
          {PAPERS.map((p) => (
            <li key={p.id}>
              <b>{p.name}</b>: {p.questions.length} questions, {paperMarks(p)} marks{p.id === 'sample' ? ' (the official sample paper, reproduced verbatim)' : ' (written from the lecture slides)'}.
            </li>
          ))}
        </ul>
        <p className="dlxp-book__lead">
          The real exam: 4 questions × 20 marks = 80 marks, 2 hours, closed book, so about 1.5 minutes per mark. Every model answer is built from the CITS5017 lecture slides, in their notation, and cites its slides.
        </p>
      </section>
      {PAPERS.map((p) => <PrintPaper key={p.id} paper={p} />)}
    </div>
  );
}
