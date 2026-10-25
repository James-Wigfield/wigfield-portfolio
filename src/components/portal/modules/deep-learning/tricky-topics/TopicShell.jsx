import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../../../icons';
import { StudyCtx, FigsCtx } from './context';
import { topicStore, cleanTicks, cleanIds } from './storage';
import { Blocks, Rich } from './Rich';
import SheetPage from './SheetPage';
import { sheetKeys } from './sheetKeys';
import { prefersReducedMotion } from './hooks';
import { printCss, preparePrint } from './print';
import ExportPdf from './ExportPdf';
import CodeCard from './CodeCard';
import Prov from './Provenance';
import { LECTURES, EXAM_PRACTICE, parseReceipt } from './lectures';

/* ============================================================================
   TRICKY TOPICS — THE TOPIC SHELL (one per tab)
   ----------------------------------------------------------------------------
   A copy of the Lecture 9 study shell, run per topic. It draws whatever the
   topic's folder hands it (topics/<id>/index.js):

     { topic, labs, sheets, figs, prompts }
       topic    topic.js — the opener, the steps (Read as data, labs by
                key, optional code cards), the drill, the print lead
       labs     { key: Component } — every lab, the opener's `hero` and
                the `drill`
       sheets   [{ page: { id, title, at }, sheet }] — the Write pages
       figs     { key: Component } — line art for the notebook pages
       prompts  { single, parts? } — the NotebookLM prompts

   Layout: a sticky header (topic · current step · progress · index · focus)
   under the topic tabs; the step index (rail when wide, dropdown when
   narrow); then the flow:
     opener   what it is in one sentence · the hero animation (replays on
              click) · Export PDF + the NotebookLM prompt · "Where it shows
              up" (receipts + links to each lecture's module) · "What the
              exam asks" (stimulus types → Exam Practice parts)
     steps    Step n: Read (a bold gist + ≤ 120 words, at most one table or
              formula) → Play (one lab, maybe a code card) → "got it"
     drill    the exam drill, the last Play block
     write    the notebook page(s), each measured by a hidden 760 px copy
              ("fits one page · n of 30 rules")

   Persistence (./storage.js, dltt:<topicId>:…): notebook ticks, steps marked
   "got it", the last step read ("Resume at step N"), the rail. The tab bar's
   progress mark reads the summary this shell writes.
   ========================================================================== */

const RULE_BUDGET = 30;
const NONE = [];

function Beat({ n, icon, label, children }) {
  return (
    <div className={`dltt-beat dltt-beat--${label.toLowerCase()}`}>
      <p className="dltt-beat__label">
        {n != null && <span className="dltt-beat__n">{n}</span>}
        <Icon name={icon} size={14} />
        {label}
      </p>
      {children}
    </div>
  );
}

// The hero animation's frame: replays on click / Enter.
function HeroFrame({ Hero, caption }) {
  const [run, setRun] = useState(0);
  if (!Hero) return null;
  return (
    <figure className="dltt-hero-anim">
      <div className="dltt-hero-anim__floor">
        <Hero run={run} />
        <button type="button" className="dltt-replay" onClick={() => setRun((r) => r + 1)}>
          <Icon name="play" size={12} /> replay
        </button>
      </div>
      {caption && <figcaption className="dltt-hero-anim__cap"><Rich text={caption} /></figcaption>}
    </figure>
  );
}

const FOLD = 5;

function Opener({ topic, labs, domId, actions, printing }) {
  const Hero = labs[topic.hero?.lab];
  const [allShows, setAllShows] = useState(false);
  const shows = allShows || printing ? topic.showsUp : topic.showsUp.slice(0, FOLD);
  return (
    <section className="dltt-sec dltt-opener" id={domId('open')} aria-labelledby={`${domId('open')}-h`}>
      <p className="dltt-opener__kicker">
        Tricky topic · draws on {topic.lectures.join(' ')}
      </p>
      <h2 className="dltt-opener__title" id={`${domId('open')}-h`} tabIndex={-1}>{topic.title}</h2>
      <p className="dltt-opener__one"><Rich text={topic.oneLine} /></p>
      <p className="dltt-opener__printlead"><Rich text={topic.printLead} /></p>
      <HeroFrame Hero={Hero} caption={topic.hero?.caption} />
      <div className="dltt-opener__actions">{actions}</div>

      <div className="dltt-strips">
        <section className="dltt-strip" aria-label="Where it shows up">
          <h3 className="dltt-strip__k">Where it shows up</h3>
          <ol className="dltt-strip__list">
            {shows.map((row) => {
              const r = parseReceipt(row.at);
              const L = r ? LECTURES[r.lec] : null;
              return (
                <li key={row.at + row.what} className="dltt-strip__row">
                  <span className="dltt-strip__at"><Prov kind="slide" text={row.at} /></span>
                  <span className="dltt-strip__what"><Rich text={row.what} /></span>
                  {L && (
                    <Link className="dltt-strip__go" to={L.route} title={`Open the ${L.module}`}>
                      {L.module} <span aria-hidden="true">→</span>
                    </Link>
                  )}
                </li>
              );
            })}
          </ol>
          {topic.showsUp.length > FOLD && !printing && (
            <button type="button" className="dltt-strip__more" aria-expanded={allShows} onClick={() => setAllShows((v) => !v)}>
              {allShows ? 'show fewer' : `show all ${topic.showsUp.length}`}
            </button>
          )}
        </section>
        <section className="dltt-strip" aria-label="What the exam asks">
          <h3 className="dltt-strip__k">What the exam asks</h3>
          <ol className="dltt-strip__list">
            {topic.examAsks.map((row) => (
              <li key={row.form + row.part} className="dltt-strip__row dltt-strip__row--exam">
                <span className="dltt-strip__form">{row.form}</span>
                <span className="dltt-strip__what"><Rich text={row.what} /></span>
                <Link className="dltt-strip__go" to={EXAM_PRACTICE} title="Open Exam Practice and find this part">
                  {row.part} <span aria-hidden="true">→</span>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </section>
  );
}

const StepSection = memo(function StepSection({ step, n, labs, domId, done, onDone }) {
  return (
    <section className="dltt-sec" id={domId(step.id)} aria-labelledby={`${domId(step.id)}-h`}>
      <header className="dltt-sec__head">
        <span className="dltt-sec__no">Step {n}</span>
        <h2 className="dltt-sec__title" id={`${domId(step.id)}-h`} tabIndex={-1}>{step.title}</h2>
        {step.prov && <span className="dltt-receipt"><Rich text={step.prov} /></span>}
      </header>
      <Beat n={1} icon="eye" label="Read">
        <div className="dltt-read">
          <p className="dltt-gist"><Rich text={step.gist} /></p>
          <Blocks blocks={step.read} />
        </div>
      </Beat>
      {(step.play?.length > 0 || step.cards?.length > 0) && (
        <Beat n={2} icon="flask" label="Play">
          {(step.play ?? []).map((key) => {
            const L = labs[key];
            return L ? <L key={key} /> : null;
          })}
          {step.cards?.length > 0 && (
            <div className="dltt-cards">
              {step.cards.map((c) => <CodeCard key={c.id} card={c} />)}
            </div>
          )}
        </Beat>
      )}
      <button type="button" className={`dltt-done${done ? ' dltt-done--on' : ''}`} aria-pressed={done} onClick={() => onDone(step.id)}>
        <span className="dltt-done__box" aria-hidden="true">{done && <Icon name="check" size={12} strokeWidth={2.6} />}</span>
        {done ? 'Got it: step marked done' : 'I’ve got this step'}
      </button>
    </section>
  );
});

// One notebook page with its hidden 760 px measuring copy.
const NotebookPage = memo(function NotebookPage({ topicId, p, sheet, ticked, onToggle, onSetAll }) {
  const [rules, setRules] = useState(null);
  const fits = rules !== null && rules <= RULE_BUDGET;
  return (
    <div className="dltt-nb">
      <p className="dltt-nb__lead">
        <span className="dltt-nb__k">Page {p.no}</span>
        <span className={`dltt-fit${fits ? ' dltt-fit--ok' : rules !== null ? ' dltt-fit--over' : ''}`} data-rules={rules ?? ''} data-page={p.id}>
          {rules === null ? 'measuring…' : fits ? `fits one page · ${rules} of ${RULE_BUDGET} rules` : `${rules} rules: over one page (${RULE_BUDGET})`}
        </span>
      </p>
      <SheetPage topicId={topicId} page={p} sheet={sheet} ticked={ticked} onToggle={(key) => onToggle(p.id, key)} onSetAll={(keys, on) => onSetAll(p.id, keys, on)} />
      <div className="dltt-measure" aria-hidden="true" inert>
        <div className="dltt-measure__box">
          <SheetPage topicId={topicId} page={p} sheet={sheet} ticked={NONE} measure onRules={setRules} />
        </div>
      </div>
    </div>
  );
});

function StepIndex({ items, current, stats, onJump, variant, onClose }) {
  const listRef = useRef(null);
  useEffect(() => {
    const list = listRef.current;
    const box = list?.closest('.dltt-rail, .dltt-drop');
    const item = list?.querySelector('[aria-current="location"]');
    if (!box || !item) return;
    const top = item.offsetTop;
    const pad = 48;
    if (top < box.scrollTop + pad) box.scrollTop = Math.max(0, top - pad);
    else if (top + item.offsetHeight > box.scrollTop + box.clientHeight - pad) box.scrollTop = top + item.offsetHeight - box.clientHeight + pad;
  }, [current]);
  return (
    <nav className={`dltt-index dltt-index--${variant}`} aria-label="Steps of this topic">
      <div className="dltt-index__head">
        <span className="dltt-index__title">Steps</span>
        <span className="dltt-index__count">{stats.done}/{stats.steps} got it</span>
        {onClose && (
          <button type="button" className="dltt-index__close" onClick={onClose} aria-label="Hide the step index">
            <Icon name="chevron" size={14} className="dltt-rot180" />
          </button>
        )}
      </div>
      <ol className="dltt-index__list" ref={listRef}>
        {items.map((it, i) => {
          const state = it.kind === 'step'
            ? (stats.doneSet.has(it.id) ? 'done' : '')
            : it.kind === 'page' ? (stats.pagesDone.has(it.id) ? 'done' : '') : '';
          return (
            <li key={it.id}>
              <button
                type="button"
                className={`dltt-index__item dltt-index__item--${it.kind}${i === current ? ' dltt-index__item--on' : ''}${state ? ' dltt-index__item--done' : ''}`}
                aria-current={i === current ? 'location' : undefined}
                onClick={() => onJump(it.id)}
              >
                <span className="dltt-index__no">{it.no}</span>
                <span className="dltt-index__name">{it.short}</span>
                <span className="dltt-index__state" aria-label={state ? 'done' : undefined}>
                  {state ? <Icon name="check" size={13} strokeWidth={2.2} /> : ''}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export default function TopicShell({ meta, mod, page, initialStep, onSummary, goTopic }) {
  const { topic, labs, sheets = [], figs = {}, prompts } = mod;
  const topicId = meta.id;
  const store = useMemo(() => topicStore(topicId), [topicId]);
  const domId = useCallback((id) => `dltt-${topicId}-${id}`, [topicId]);

  const steps = topic.steps;
  const pages = useMemo(() => sheets.map((s, i) => ({ ...s.page, no: i + 1 })), [sheets]);
  const sheetById = useMemo(() => Object.fromEntries(sheets.map((s) => [s.page.id, s.sheet])), [sheets]);
  const pageKeys = useMemo(() => Object.fromEntries(sheets.map((s) => [s.page.id, sheetKeys(s.sheet)])), [sheets]);
  const items = useMemo(() => [
    { id: 'open', no: '·', short: 'Start here', kind: 'open' },
    ...steps.map((s, i) => ({ id: s.id, no: String(i + 1), short: s.short, kind: 'step' })),
    { id: 'drill', no: 'D', short: topic.drill?.short ?? 'Exam drill', kind: 'drill' },
    ...pages.map((p) => ({ id: p.id, no: `p${p.no}`, short: p.short ?? `Notebook page ${p.no}`, kind: 'page' })),
  ], [steps, pages, topic.drill]);
  // where each rail item scrolls to (a notebook page jumps to the page itself)
  const target = useCallback((id) => (pageKeys[id] ? `${domId(id)}-nb` : domId(id)), [pageKeys, domId]);

  const barRef = useRef(null);
  const dropRef = useRef(null);
  const [sheetTicks, setSheetTicks] = useState(() => cleanTicks(store.load('sheetTicks', {})));
  const [done, setDone] = useState(() => cleanIds(store.load('done', [])));
  const [railOpen, setRailOpen] = useState(() => store.load('rail', true) !== false);
  const [dropOpen, setDropOpen] = useState(false);
  const [current, setCurrent] = useState(0);
  const [resumeIdx] = useState(() => {
    const i = items.findIndex((it) => it.id === store.load('last', null));
    return i > 0 ? i : -1;
  });
  const [resumeOpen, setResumeOpen] = useState(resumeIdx > 0 && !initialStep);
  const [printing, setPrinting] = useState(false);
  const live = useRef({});
  useEffect(() => { live.current = { current, resumeIdx }; });
  const userScrolled = useRef(false);
  const holdItem = useRef(null);

  // ── persistence ──────────────────────────────────────────────────────────
  useEffect(() => { store.save('sheetTicks', sheetTicks); }, [store, sheetTicks]);
  useEffect(() => { store.save('done', done); }, [store, done]);
  useEffect(() => { store.save('rail', railOpen); }, [store, railOpen]);
  useEffect(() => {
    if (userScrolled.current) store.save('last', items[current].id);
  }, [store, items, current]);

  const toggleTick = useCallback((pid, key) => {
    setSheetTicks((prev) => {
      const list = prev[pid] || [];
      return { ...prev, [pid]: list.includes(key) ? list.filter((k) => k !== key) : [...list, key] };
    });
  }, []);
  const setAllTicks = useCallback((pid, keys, on) => {
    setSheetTicks((prev) => ({ ...prev, [pid]: on ? [...keys] : [] }));
  }, []);
  const toggleDone = useCallback((id) => {
    setDone((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  const stats = useMemo(() => {
    const doneSet = new Set(done.filter((id) => steps.some((s) => s.id === id)));
    const pagesDone = new Set();
    let lines = 0;
    let total = 0;
    pages.forEach((p) => {
      const keys = pageKeys[p.id];
      const have = new Set(sheetTicks[p.id] || []);
      const n = keys.filter((k) => have.has(k)).length;
      lines += n;
      total += keys.length;
      if (keys.length && n === keys.length) pagesDone.add(p.id);
    });
    return { doneSet, done: doneSet.size, steps: steps.length, pagesDone, copied: pagesDone.size, pages: pages.length, lines, total };
  }, [done, steps, pages, pageKeys, sheetTicks]);

  // the tab bar's progress mark
  useEffect(() => {
    const s = { steps: stats.steps, done: stats.done, pages: stats.pages, copied: stats.copied };
    store.save('summary', s);
    onSummary(topicId, s);
  }, [store, stats, topicId, onSummary]);

  // ── scrolling ────────────────────────────────────────────────────────────
  const scroller = useCallback(() => (page.focusRef.current ? page.root() : null), [page]);
  const barBottom = useCallback(() => {
    const bar = barRef.current;
    if (!bar) return 0;
    return (parseFloat(getComputedStyle(bar).top) || 0) + bar.offsetHeight;
  }, []);

  const jumpTo = useCallback((id, { smooth = true } = {}) => {
    const el = document.getElementById(target(id)) ?? document.getElementById(domId(id));
    if (!el) return;
    const gap = barBottom() + 14;
    const box = scroller();
    const view = box ? box.clientHeight : window.innerHeight;
    const dist = Math.abs(el.getBoundingClientRect().top - (box ? box.getBoundingClientRect().top : 0) - gap);
    // 'instant', not 'auto': the site sets scroll-behavior: smooth on <html>.
    const behavior = smooth && !prefersReducedMotion() && dist < view * 2.5 ? 'smooth' : 'instant';
    if (box) {
      const top = el.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop - gap;
      box.scrollTo({ top, behavior });
    } else {
      window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - gap, behavior });
    }
    const heading = el.querySelector('.dltt-sh__title, .dltt-sec__title, .dltt-opener__title');
    heading?.focus?.({ preventScroll: true });
    setDropOpen(false);
  }, [target, domId, barBottom, scroller]);

  useEffect(() => {
    let raf = 0;
    const compute = () => {
      raf = 0;
      const box = scroller();
      const top = barBottom();
      const vh = box ? box.clientHeight : window.innerHeight;
      const line = top + (vh - top) * 0.28;
      let idx = 0;
      for (let i = 0; i < items.length; i++) {
        const el = document.getElementById(target(items[i].id));
        if (el && el.getBoundingClientRect().top <= line) idx = i;
      }
      const sc = box ?? document.scrollingElement;
      if (sc && sc.scrollTop > 0 && sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 4) idx = items.length - 1;
      setCurrent(idx);
      const r = live.current.resumeIdx;
      if (r > 0 && idx >= r) setResumeOpen(false);
    };
    const onScroll = () => {
      userScrolled.current = true;
      if (!raf) raf = requestAnimationFrame(compute);
    };
    const root = page.root();
    window.addEventListener('scroll', onScroll, { passive: true });
    root?.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      root?.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [items, target, barBottom, scroller, page]);

  // Focus mode swaps the scroll container (window ↔ the page root): land back
  // on the item you were reading. The page calls this with 'capture' just
  // before it toggles, then with no argument once the swap has happened.
  const { registerRestore } = page;
  useEffect(() => {
    registerRestore((phase) => {
      if (phase === 'capture') {
        holdItem.current = live.current.current;
        return;
      }
      if (holdItem.current === null) holdItem.current = live.current.current;
      let tries = 0;
      const attempt = () => {
        const i = holdItem.current ?? 0;
        jumpTo(items[i].id, { smooth: false });
        const el = document.getElementById(target(items[i].id));
        const want = barBottom() + 14;
        const got = el ? el.getBoundingClientRect().top : want;
        if (Math.abs(got - want) > 24 && tries < 10) {
          tries += 1;
          requestAnimationFrame(attempt);
        } else {
          holdItem.current = null;
        }
      };
      requestAnimationFrame(() => requestAnimationFrame(attempt));
    });
    return () => registerRestore(null);
  }, [registerRestore, items, jumpTo, target, barBottom]);

  // A deep link to a step (/portal/dl-tricky-topics/<topic>/<step>) lands on it.
  useEffect(() => {
    if (!initialStep || !items.some((it) => it.id === initialStep)) return undefined;
    const t = setTimeout(() => jumpTo(initialStep, { smooth: false }), 120);
    return () => clearTimeout(t);
  }, [initialStep, items, jumpTo]);

  // ── Export PDF: this topic only ──────────────────────────────────────────
  const exportPdf = useCallback(async () => {
    const restoreFocus = await page.leaveFocus();
    const prevTitle = document.title;
    document.documentElement.classList.add('dltt-printing');
    setPrinting(true);
    await preparePrint();
    document.title = `CITS5017 Tricky Topics — ${topic.title} — Read + Play`;
    const after = () => {
      window.removeEventListener('afterprint', after);
      document.title = prevTitle;
      document.documentElement.classList.remove('dltt-printing');
      setPrinting(false);
      restoreFocus();
    };
    window.addEventListener('afterprint', after);
    window.print();
  }, [page, topic.title]);

  // Esc / click outside closes the dropdown.
  useEffect(() => {
    if (!dropOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setDropOpen(false); };
    const onDown = (e) => { if (dropRef.current && !dropRef.current.contains(e.target)) setDropOpen(false); };
    window.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [dropOpen]);

  const ctx = useMemo(() => ({ topicId, jumpTo, goTopic, printing }), [topicId, jumpTo, goTopic, printing]);
  const cur = items[current];
  const wide = page.wide;
  const showRail = wide && railOpen;
  const Drill = labs[topic.drill?.lab];
  const curLabel = cur.kind === 'step' ? `Step ${cur.no}` : cur.kind === 'page' ? `Page ${cur.no.slice(1)}` : cur.kind === 'drill' ? 'Drill' : 'Start';

  const actions = (
    <>
      <button type="button" className="dltt-btn dltt-btn--primary dltt-btn--big" onClick={page.toggleFocus} aria-pressed={page.focus}>
        <Icon name={page.focus ? 'compress' : 'expand'} size={17} /> {page.focus ? 'Exit focus mode' : 'Enter focus mode'}
      </button>
      <ExportPdf onExport={exportPdf} prompts={prompts} topicTitle={topic.title} />
      {resumeOpen && resumeIdx > 0 && (
        <span className="dltt-resume">
          <button type="button" className="dltt-btn dltt-btn--big" onClick={() => { setResumeOpen(false); jumpTo(items[resumeIdx].id); }}>
            <Icon name="arrowDown" size={16} /> Resume at {items[resumeIdx].kind === 'step' ? `step ${items[resumeIdx].no}` : items[resumeIdx].short} · {items[resumeIdx].short}
          </button>
          <button type="button" className="dltt-resume__x" onClick={() => setResumeOpen(false)} aria-label="Dismiss the resume suggestion">
            dismiss
          </button>
        </span>
      )}
    </>
  );

  return (
    <StudyCtx.Provider value={ctx}>
      <FigsCtx.Provider value={figs}>
        <style>{printCss(topic.title)}</style>
        <div className="dltt-topic" data-topic={topicId}>
          <header ref={barRef} className="dltt-bar">
            <div className="dltt-bar__title">
              <span className="dltt-bar__kicker">Tricky topic</span>
              <span className="dltt-bar__name">{topic.title}</span>
            </div>
            <div className="dltt-bar__now" aria-live="polite">
              <span className="dltt-bar__nowno">{curLabel}</span>
              <span className="dltt-bar__nowname">{cur.kind === 'step' ? steps[current - 1]?.title : cur.short}</span>
            </div>
            <div className="dltt-bar__prog" title={`${stats.done} of ${stats.steps} steps marked "got it"; ${stats.copied} of ${stats.pages} notebook pages copied`}>
              <span className="dltt-bar__progtext">
                <b>{stats.done}</b>/{stats.steps} steps · <b>{stats.copied}</b>/{stats.pages} pages
              </span>
              <span className="dltt-bar__track" aria-hidden="true"><span style={{ width: `${stats.steps ? Math.round((stats.done / stats.steps) * 100) : 0}%` }} /></span>
            </div>
            <div className="dltt-bar__actions" ref={dropRef}>
              {wide ? (
                !railOpen && (
                  <button type="button" className="dltt-btn" onClick={() => setRailOpen(true)} aria-label="Show the step index">
                    <Icon name="list" size={15} /> <span className="dltt-btn__txt">Index</span>
                  </button>
                )
              ) : (
                <button type="button" className="dltt-btn" aria-expanded={dropOpen} onClick={() => setDropOpen((o) => !o)}>
                  <Icon name="list" size={15} /> <span className="dltt-btn__txt">Steps</span>
                </button>
              )}
              <button type="button" className="dltt-btn dltt-btn--primary" onClick={page.toggleFocus} aria-pressed={page.focus}>
                <Icon name={page.focus ? 'compress' : 'expand'} size={15} />
                <span className="dltt-btn__txt">{page.focus ? 'Exit focus mode' : 'Enter focus mode'}</span>
              </button>
              {!wide && dropOpen && (
                <div className="dltt-drop">
                  <StepIndex items={items} current={current} stats={stats} onJump={(id) => jumpTo(id)} variant="drop" />
                </div>
              )}
            </div>
          </header>

          <div className={`dltt-layout${showRail ? ' dltt-layout--rail' : ''}`}>
            {showRail && (
              <aside className="dltt-rail">
                <StepIndex items={items} current={current} stats={stats} onJump={(id) => jumpTo(id)} variant="rail" onClose={() => setRailOpen(false)} />
              </aside>
            )}

            <main className="dltt-flow">
              <Opener topic={topic} labs={labs} domId={domId} actions={actions} printing={printing} />

              {steps.map((s, i) => (
                <StepSection key={s.id} step={s} n={i + 1} labs={labs} domId={domId} done={stats.doneSet.has(s.id)} onDone={toggleDone} />
              ))}

              <section className="dltt-sec dltt-sec--drill" id={domId('drill')} aria-labelledby={`${domId('drill')}-h`}>
                <header className="dltt-sec__head">
                  <span className="dltt-sec__no">Drill</span>
                  <h2 className="dltt-sec__title" id={`${domId('drill')}-h`} tabIndex={-1}>{topic.drill?.title ?? 'Exam drill'}</h2>
                  {topic.drill?.prov && <span className="dltt-receipt"><Rich text={topic.drill.prov} /></span>}
                </header>
                {topic.drill?.blurb && <p className="dltt-sec__lead"><Rich text={topic.drill.blurb} /></p>}
                <Beat icon="flask" label="Play">
                  {Drill ? <Drill /> : null}
                </Beat>
              </section>

              {pages.length > 0 && (
                <section className="dltt-sec dltt-sec--write" id={domId('write')} aria-labelledby={`${domId('write')}-h`}>
                  <header className="dltt-sec__head">
                    <span className="dltt-sec__no">Write</span>
                    <h2 className="dltt-sec__title" id={`${domId('write')}-h`} tabIndex={-1}>Notebook {pages.length > 1 ? 'pages' : 'page'}</h2>
                  </header>
                  <p className="dltt-sec__lead">
                    Copy {pages.length > 1 ? 'each page' : 'the page'} onto one real notebook page and tick each line as it goes in. Blue for headings and receipts, black for the body, red for markers, green sparingly.
                  </p>
                  {pages.map((p) => (
                    <NotebookPage key={p.id} topicId={topicId} p={p} sheet={sheetById[p.id]} ticked={sheetTicks[p.id] || NONE} onToggle={toggleTick} onSetAll={setAllTicks} />
                  ))}
                </section>
              )}

              <footer className="dltt-end">
                <p><Rich text={topic.endNote ?? 'Sources: the CITS5017 lecture decks (A/Prof Du Huynh, UWA, Semester 2 2026). Numbers marked “this page’s own” were computed here and checked in TensorFlow; anything marked “beyond the slides” is support, not syllabus.'} /></p>
              </footer>
            </main>
          </div>
        </div>
      </FigsCtx.Provider>
    </StudyCtx.Provider>
  );
}
