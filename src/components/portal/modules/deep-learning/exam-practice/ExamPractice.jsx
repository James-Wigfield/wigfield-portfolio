import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PAPERS, PAPER, leavesOf, paperLeaves, paperMarks, leafLectures } from './papers';
import { LECTURES } from './papers/lectures';
import { load, save, loadMap } from './storage';
import { XpCtx } from './context';
import { Cover, QuestionView } from './Paper';
import PrintBook from './PrintBook';
import ExportPdf from './ExportPdf';
import { PRINT_CSS, preparePrint } from './print';
import { NLM_PICKS } from './exportPrompt';
import '../common.css';
import './exam-practice.css';

/* ============================================================================
   CITS5017 · EXAM PRACTICE — the sample paper + two practice papers
   ----------------------------------------------------------------------------
   Built for one loop: read a part → write your answer in your own notebook →
   reveal the tutor's answer, written onto the paper in that part's ruled
   space → compare → mark yourself.

     tabs         Sample paper · Practice paper A · Practice paper B
     stepper      Cover, Q1 … Q4, one at a time, each with its status
                  (not started / revealed / marked); previous / next turn the
                  page; ← → move along the stepper
     paper        ./Paper.jsx (sheets, parts, ruled space, reveal, self-mark)
                  · the handwriting ./Ink.jsx · figures ./figures.jsx
     filter       a lecture filter dims every part off that lecture, with a
                  count per lecture for the open paper
     marks        totals per question (/20) and per paper (/40, /80)
     timed        "Sit it timed": a quiet 2-hour countdown for a practice paper
     export       Export PDF (./print.js, ./PrintBook.jsx) + the NotebookLM
                  video prompt under it (./ExportPdf.jsx, ./exportPrompt.js)
     persistence  ./storage.js (dlxp:*) — reveals, marks, tab, page, filter,
                  timer; Reset clears one paper's reveals and marks
     content      ./papers/*.js — data, not JSX
   ========================================================================== */

const LEC_CODES = LECTURES.map((l) => l.code);
const TWO_HOURS = 2 * 60 * 60 * 1000;
const okPaper = (id) => (PAPER[id] ? id : 'sample');
const reduced = () => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

function clock(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}:${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

// not started / revealed / marked, for one question
function statusOf(question, reveal, marks) {
  const leaves = leavesOf(question);
  if (leaves.length && leaves.every((l) => Number.isInteger(marks[l.id]))) return 'marked';
  if (leaves.some((l) => reveal[l.id] || Number.isInteger(marks[l.id]))) return 'revealed';
  return 'none';
}
const STATUS_TEXT = { none: 'not started', revealed: 'revealed', marked: 'marked' };

export default function ExamPractice() {
  const [paperId, setPaperId] = useState(() => okPaper(load('paper', 'sample')));
  const [at, setAt] = useState(() => loadMap('at', (n) => Number.isInteger(n) && n >= 0 && n <= 6));
  const [reveal, setRevealMap] = useState(() => loadMap('reveal', (v) => v === true));
  const [marks, setMarks] = useState(() => loadMap('marks', (v) => Number.isInteger(v) && v >= 0 && v <= 20));
  const [filter, setFilterRaw] = useState(() => {
    const f = load('filter', 'all');
    return f === 'all' || LEC_CODES.includes(f) ? f : 'all';
  });
  const [timer, setTimer] = useState(() => loadMap('timer', (v) => typeof v === 'number' && v > 0));
  const [fresh, setFresh] = useState(() => new Set());
  const [printing, setPrinting] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [stick, setStick] = useState(0);
  const deskRef = useRef(null);

  // The portal's topbar is sticky: the question bar sticks just under it,
  // and page turns scroll the stepper clear of it.
  useEffect(() => {
    const bar = document.querySelector('.portal__topbar');
    if (!bar || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => {
      const fixed = getComputedStyle(bar).position === 'sticky';
      setStick(fixed ? Math.round(bar.getBoundingClientRect().height) : 0);
    });
    ro.observe(bar);
    return () => ro.disconnect();
  }, []);

  const paper = PAPER[paperId];
  const page = Math.min(at[paperId] ?? 0, paper.questions.length);
  const question = page > 0 ? paper.questions[page - 1] : null;

  // ── state changes (each one saved) ───────────────────────────────────────
  const setReveal = useCallback((ids, on) => {
    setRevealMap((prev) => {
      const next = { ...prev };
      ids.forEach((id) => {
        if (on) next[id] = true;
        else delete next[id];
      });
      save('reveal', next);
      return next;
    });
    setFresh((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => (on ? next.add(id) : next.delete(id)));
      return next;
    });
  }, []);

  const setMark = useCallback((id, n) => {
    setMarks((prev) => {
      const next = { ...prev };
      if (n === null) delete next[id];
      else next[id] = n;
      save('marks', next);
      return next;
    });
  }, []);

  const setFilter = (f) => {
    setFilterRaw(f);
    save('filter', f);
  };

  const openPaper = (id) => {
    setPaperId(id);
    save('paper', id);
    setConfirmReset(false);
  };

  const goTo = useCallback((n) => {
    setAt((prev) => {
      const next = { ...prev, [paperId]: n };
      save('at', next);
      return next;
    });
    setConfirmReset(false);
    const el = deskRef.current;
    if (el && el.getBoundingClientRect().top < 0) el.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
  }, [paperId]);

  const resetPaper = () => {
    const ids = paperLeaves(paper).map((l) => l.id);
    setRevealMap((prev) => {
      const next = { ...prev };
      ids.forEach((id) => delete next[id]);
      save('reveal', next);
      return next;
    });
    setMarks((prev) => {
      const next = { ...prev };
      ids.forEach((id) => delete next[id]);
      save('marks', next);
      return next;
    });
    setFresh(new Set());
    setConfirmReset(false);
  };

  // ── timed sitting (practice papers) ──────────────────────────────────────
  const started = timer[paperId];
  const startTimer = () => {
    const next = { ...timer, [paperId]: Date.now() };
    setTimer(next);
    setNow(Date.now());
    save('timer', next);
  };
  const stopTimer = () => {
    const next = { ...timer };
    delete next[paperId];
    setTimer(next);
    save('timer', next);
  };
  useEffect(() => {
    if (!started) return undefined;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [started]);
  const left = started ? TWO_HOURS - (now - started) : 0;

  // ── Export PDF ───────────────────────────────────────────────────────────
  // html.dlxp-printing scopes every print rule (./print.js) to this module;
  // PrintBook mounts while printing (every paper, then its model answers);
  // afterprint takes it down again.
  useEffect(() => () => document.documentElement.classList.remove('dlxp-printing'), []);
  const exportPdf = useCallback(async () => {
    const prevTitle = document.title;
    document.documentElement.classList.add('dlxp-printing');
    setPrinting(true);
    await preparePrint();
    document.title = 'CITS5017 Exam Practice — sample paper, practice papers A and B, model answers';
    const after = () => {
      window.removeEventListener('afterprint', after);
      document.title = prevTitle;
      document.documentElement.classList.remove('dlxp-printing');
      setPrinting(false);
    };
    window.addEventListener('afterprint', after);
    window.print();
  }, []);

  // ── derived ──────────────────────────────────────────────────────────────
  const picks = useMemo(() => new Set(NLM_PICKS.map((p) => p.id)), []);
  const scoreOf = (leaves) => leaves.reduce((a, l) => a + (Number.isInteger(marks[l.id]) ? marks[l.id] : 0), 0);
  const allLeaves = paperLeaves(paper);
  const paperScore = scoreOf(allLeaves);
  const markedCount = allLeaves.filter((l) => Number.isInteger(marks[l.id])).length;
  const lecCount = Object.fromEntries(LEC_CODES.map((c) => [c, allLeaves.filter((l) => leafLectures(l).includes(c)).length]));
  const qMatch = (q) => (filter === 'all' ? null : leavesOf(q).filter((l) => leafLectures(l).includes(filter)).length);

  const ctx = useMemo(
    () => ({ reveal, fresh, marks, filter, picks, printing, setReveal, setMark }),
    [reveal, fresh, marks, filter, picks, printing, setReveal, setMark],
  );

  const steps = [{ n: 0, label: 'Cover' }, ...paper.questions.map((q) => ({ n: q.n, label: `Q${q.n}`, q }))];
  const onStepKey = (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const n = Math.max(0, Math.min(paper.questions.length, page + (e.key === 'ArrowRight' ? 1 : -1)));
    goTo(n);
    window.requestAnimationFrame(() => document.getElementById(`dlxp-step-${n}`)?.focus());
  };

  return (
    <XpCtx.Provider value={ctx}>
      <style>{PRINT_CSS}</style>
      <div className="dl dlxp" style={{ '--dlxp-stick': `${stick}px` }}>
        {printing && <PrintBook />}

        <header className="dlxp-hero">
          <p className="dlxp-hero__kicker">CITS5017 · Deep Learning · final exam</p>
          <h2 className="dlxp-hero__title">The sample paper, and two more like it</h2>
          <p className="dlxp-hero__lead">
            The official sample paper and two full practice papers. Work each part in your notebook, reveal the tutor&rsquo;s answer on the paper, then mark yourself.
          </p>
          <ExportPdf onExport={exportPdf} />
        </header>

        <div className="dlxp-tabs" role="tablist" aria-label="Papers">
          {PAPERS.map((p) => {
            const ls = paperLeaves(p);
            const sel = p.id === paperId;
            return (
              <button
                key={p.id}
                type="button"
                role="tab"
                id={`dlxp-tab-${p.id}`}
                aria-selected={sel}
                aria-controls="dlxp-desk"
                className={`dlxp-tab${sel ? ' dlxp-tab--on' : ''}`}
                onClick={() => openPaper(p.id)}
              >
                <span className="dlxp-tab__name">{p.tab}</span>
                <span className="dlxp-tab__short" aria-hidden="true">{p.id === 'sample' ? 'Sample' : `Paper ${p.id}`}</span>
                <span className="dlxp-tab__score">{scoreOf(ls)} / {paperMarks(p)}</span>
              </button>
            );
          })}
        </div>

        <div className="dlxp-filter" role="group" aria-label="Show parts on one lecture">
          <span className="dlxp-filter__k">Lecture</span>
          <button type="button" className={`dlxp-chip${filter === 'all' ? ' dlxp-chip--on' : ''}`} aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>
            All <span className="dlxp-chip__n">{allLeaves.length}</span>
          </button>
          {LECTURES.map((l) => (
            <button
              key={l.code}
              type="button"
              className={`dlxp-chip${filter === l.code ? ' dlxp-chip--on' : ''}`}
              aria-pressed={filter === l.code}
              disabled={lecCount[l.code] === 0 && filter !== l.code}
              title={l.name}
              onClick={() => setFilter(filter === l.code ? 'all' : l.code)}
            >
              <i className="dlxp-dot" style={{ '--dot': l.dot }} aria-hidden="true" />
              {l.label} <span className="dlxp-chip__n">{lecCount[l.code]}</span>
            </button>
          ))}
        </div>

        <div className="dlxp-bar" ref={deskRef}>
          <nav className="dlxp-steps" aria-label={`${paper.name}: pages`} onKeyDown={onStepKey}>
            {steps.map((s) => {
              const st = s.q ? statusOf(s.q, reveal, marks) : null;
              const match = s.q ? qMatch(s.q) : null;
              return (
                <button
                  key={s.n}
                  id={`dlxp-step-${s.n}`}
                  type="button"
                  className={`dlxp-step${page === s.n ? ' dlxp-step--on' : ''}${st ? ` dlxp-step--${st}` : ''}${match === 0 ? ' dlxp-step--off' : ''}`}
                  aria-current={page === s.n ? 'page' : undefined}
                  onClick={() => goTo(s.n)}
                >
                  <span className="dlxp-step__label">{s.label}</span>
                  {st && (
                    <span className="dlxp-step__st">
                      <i className={`dlxp-st dlxp-st--${st}`} aria-hidden="true" />
                      {STATUS_TEXT[st]}
                      {st === 'marked' && ` ${scoreOf(leavesOf(s.q))}/20`}
                      {match !== null && <span className="dlxp-step__match"> · {match} on {filter.replace('L67', 'L6–7')}</span>}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
          <div className="dlxp-bar__right">
            {started && (
              <span className={`dlxp-timer${left <= 0 ? ' dlxp-timer--up' : ''}`} role="timer" aria-live="off">
                {left > 0 ? `${clock(left)} left` : 'Time is up'}
                <button type="button" className="dlxp-textbtn" onClick={stopTimer}>Stop</button>
              </span>
            )}
            <span className="dlxp-bar__score">{paper.name}: <b>{paperScore} / {paperMarks(paper)}</b> <span className="dlxp-bar__of">({markedCount} of {allLeaves.length} parts marked)</span></span>
            {confirmReset ? (
              <span className="dlxp-reset">
                Hide every answer and clear every mark on this paper?
                <button type="button" className="dlxp-textbtn dlxp-textbtn--warn" onClick={resetPaper}>Reset</button>
                <button type="button" className="dlxp-textbtn" onClick={() => setConfirmReset(false)}>Cancel</button>
              </span>
            ) : (
              <button type="button" className="dlxp-textbtn" onClick={() => setConfirmReset(true)}>Reset (hide answers, clear marks)</button>
            )}
          </div>
        </div>

        <div className="dlxp-desk" id="dlxp-desk" role="tabpanel" aria-labelledby={`dlxp-tab-${paperId}`}>
          <div className="dlxp-turn" key={`${paperId}-${page}`}>
            {page === 0 ? (
              <>
                <Cover paper={paper} />
                <div className="dlxp-coverctl">
                  {paper.questions.length > 0 ? (
                    <button type="button" className="dlxp-btn dlxp-btn--primary" onClick={() => goTo(1)}>Start at Question 1 →</button>
                  ) : (
                    <p className="dlxp-coverctl__note">This paper&rsquo;s questions are being written.</p>
                  )}
                  {paper.id !== 'sample' && paper.questions.length > 0 && !started && (
                    <button type="button" className="dlxp-btn" onClick={() => { startTimer(); goTo(1); }}>Sit it timed (2 hours)</button>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="dlxp-qbar">
                  <span className="dlxp-qbar__t">Question {question.n} <span className="dlxp-qbar__of">· your mark {scoreOf(leavesOf(question))} / 20</span></span>
                  {started && <span className={`dlxp-timer${left <= 0 ? ' dlxp-timer--up' : ''}`} aria-hidden="true">{left > 0 ? `${clock(left)} left` : 'Time is up'}</span>}
                  <button type="button" className="dlxp-textbtn" onClick={() => setReveal(leavesOf(question).map((l) => l.id), true)}>Reveal all parts</button>
                  {leavesOf(question).some((l) => reveal[l.id]) && (
                    <button type="button" className="dlxp-textbtn" onClick={() => setReveal(leavesOf(question).map((l) => l.id), false)}>Hide answers</button>
                  )}
                  <span className="dlxp-qbar__turn">
                    <button type="button" className="dlxp-textbtn" aria-label={page <= 1 ? 'Back to the cover' : `Back to question ${page - 1}`} onClick={() => goTo(page - 1)}>←</button>
                    <button type="button" className="dlxp-textbtn" disabled={page >= paper.questions.length} aria-label={`On to question ${page + 1}`} onClick={() => goTo(page + 1)}>→</button>
                  </span>
                </div>
                <QuestionView paper={paper} question={question} last={page === paper.questions.length} />
              </>
            )}
          </div>
          <div className="dlxp-pager">
            <button type="button" className="dlxp-btn" disabled={page === 0} onClick={() => goTo(page - 1)}>← {page <= 1 ? 'Cover' : `Question ${page - 1}`}</button>
            <span className="dlxp-pager__at">{page === 0 ? 'Cover' : `Question ${page} of ${paper.questions.length}`}</span>
            <button type="button" className="dlxp-btn" disabled={page >= paper.questions.length} onClick={() => goTo(page + 1)}>{page >= paper.questions.length ? 'End of paper' : `Question ${page + 1} →`}</button>
          </div>
        </div>
      </div>
    </XpCtx.Provider>
  );
}
