import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { talkPlan } from './talk';
import { fmtTime } from '../shared/text';
import './talk.css';

/* ============================================================================
   SEMINAR DECKS — PHONE SCRIPT  (/portal/seminar-decks/<deck>/phone)
   ----------------------------------------------------------------------------
   The transcript on an iPhone while presenting, one slide per page: the slide
   number large and always visible, "slide n of N", the "ends at" target, the
   transcript in large type, and big Previous / Next buttons (or a swipe).
   After the last slide: the demo slide, then the backup index with the number
   to type on the Mac. No slide renders or images, so it loads fast.
   Kept across a reload (localStorage, guarded): the page, the theme choice
   and the elapsed timer. The screen is kept awake with the Wake Lock API
   where the browser has it. There is no sync with the Mac (that would need a
   network service); the phone is turned by hand.
   ========================================================================== */

const read = (key, fallback) => {
  try {
    const v = JSON.parse(window.localStorage.getItem(key) ?? 'null');
    return v ?? fallback;
  } catch {
    return fallback;
  }
};
const write = (key, value) => {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode or storage full: the page still works, it just forgets */
  }
};

function usePrefersDark() {
  const q = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  const [dark, setDark] = useState(() => Boolean(q?.matches));
  useEffect(() => {
    if (!q) return undefined;
    const on = () => setDark(q.matches);
    q.addEventListener('change', on);
    return () => q.removeEventListener('change', on);
  }, [q]);
  return dark;
}

export default function PhoneView({ deck }) {
  const plan = useMemo(() => talkPlan(deck), [deck]);
  const pages = useMemo(() => [
    ...plan.slides.map((s) => ({ kind: 'slide', s })),
    ...(plan.demo ? [{ kind: 'demo' }] : []),
    { kind: 'backups' },
  ], [plan]);
  const key = `seminar-decks:phone:${deck.slug}`;
  const saved = useMemo(() => read(key, {}), [key]);
  const [page, setPage] = useState(() => Math.min(pages.length - 1, Math.max(0, saved.page | 0)));
  const [theme, setTheme] = useState(() => (['light', 'dark'].includes(saved.theme) ? saved.theme : 'auto'));
  const [timer, setTimer] = useState(() => saved.timer ?? { running: false, startedAt: 0, acc: 0 });
  const [now, setNow] = useState(() => Date.now());
  const [wake, setWake] = useState('pending');
  const body = useRef(null);
  const lock = useRef(null);
  const systemDark = usePrefersDark();
  const dark = theme === 'dark' || (theme === 'auto' && systemDark);

  useEffect(() => write(key, { page, theme, timer }), [key, page, theme, timer]);

  // Full screen over the portal shell, with the iPhone's safe areas.
  useEffect(() => {
    const html = document.documentElement;
    const prevOverflow = html.style.overflow;
    html.style.overflow = 'hidden';
    const meta = document.querySelector('meta[name="viewport"]');
    const prevMeta = meta?.getAttribute('content');
    if (meta && prevMeta && !/viewport-fit/.test(prevMeta)) meta.setAttribute('content', `${prevMeta}, viewport-fit=cover`);
    return () => {
      html.style.overflow = prevOverflow;
      if (meta && prevMeta) meta.setAttribute('content', prevMeta);
    };
  }, []);

  // Keep the screen awake where the browser allows it; ask again when the page
  // comes back into view (the lock is released when it is hidden).
  const requestWake = useCallback(async () => {
    if (!('wakeLock' in navigator)) {
      setWake('unsupported');
      return;
    }
    if (lock.current && !lock.current.released) return;
    try {
      lock.current = await navigator.wakeLock.request('screen');
      setWake('on');
      lock.current.addEventListener('release', () => setWake('off'));
    } catch {
      setWake('off');
    }
  }, []);
  useEffect(() => {
    const first = window.setTimeout(requestWake, 0);
    const onVis = () => {
      if (document.visibilityState === 'visible') requestWake();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.clearTimeout(first);
      document.removeEventListener('visibilitychange', onVis);
      lock.current?.release?.().catch(() => {});
    };
  }, [requestWake]);

  useEffect(() => {
    if (!timer.running) return undefined;
    const t = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(t);
  }, [timer.running]);

  const go = useCallback((d) => {
    setPage((p) => Math.min(pages.length - 1, Math.max(0, p + d)));
    requestWake();
  }, [pages.length, requestWake]);

  useEffect(() => {
    body.current?.scrollTo?.(0, 0);
  }, [page]);

  // Arrow keys and Space (for testing on a computer).
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        go(1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        go(-1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go]);

  // A horizontal swipe on the transcript turns the page.
  const touch = useRef(null);
  const onTouchStart = (e) => {
    const t = e.touches[0];
    touch.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e) => {
    const s = touch.current;
    touch.current = null;
    if (!s) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    if (Math.abs(dx) > 60 && Math.abs(dx) > 1.5 * Math.abs(dy)) go(dx < 0 ? 1 : -1);
  };

  const elapsed = (timer.acc + (timer.running ? now - timer.startedAt : 0)) / 1000;
  const toggleTimer = () => {
    requestWake();
    setNow(Date.now());
    setTimer((t) => (t.running ? { running: false, startedAt: 0, acc: t.acc + Date.now() - t.startedAt } : { running: true, startedAt: Date.now(), acc: t.acc }));
  };
  const resetTimer = () => setTimer({ running: false, startedAt: 0, acc: 0 });
  const cycleTheme = () => setTheme((t) => (t === 'auto' ? (systemDark ? 'light' : 'dark') : t === 'dark' ? 'light' : 'dark'));

  const cur = pages[page];
  const s = cur.kind === 'slide' ? cur.s : null;
  const next = pages[page + 1];
  const big = s ? String(s.no) : cur.kind === 'demo' ? plan.demo.label : 'Q';

  return createPortal(
    <div className={`sd-phone${dark ? ' is-dark' : ''}`} data-page={page} data-kind={cur.kind} data-slide={s?.no ?? ''}>
      <header className="sd-phone__top">
        <div className="sd-phone__row">
          <p className="sd-phone__no" aria-label={s ? `Slide ${s.no} of ${plan.total}` : cur.kind === 'demo' ? 'Demo slide' : 'Questions'}>{big}</p>
          <div className="sd-phone__of">
            {s && <p>of {plan.total}</p>}
            {s && <p>ends at {fmtTime(s.endsAt)}</p>}
            {!s && <p>{cur.kind === 'demo' ? 'Demo slide' : 'Backups'}</p>}
          </div>
          <button type="button" className={`sd-phone__timer${timer.running ? ' is-on' : ''}`} onClick={toggleTimer} aria-label={timer.running ? 'Pause the timer' : 'Start the timer'}>
            {fmtTime(elapsed)}
          </button>
          <button type="button" className="sd-phone__theme" onClick={cycleTheme} aria-label={dark ? 'Use the light theme' : 'Use the dark theme'}>
            {dark ? 'Light' : 'Dark'}
          </button>
        </div>
        <p className="sd-phone__title">{s ? s.title : cur.kind === 'demo' ? plan.demo.title : 'Backup slides'}</p>
      </header>

      <main className="sd-phone__body" ref={body} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        {s && s.no > 1 && <p className="sd-phone__space">Space: slide {s.no}</p>}
        {s && s.sentences.map((t, i) => <p key={i} className="sd-phone__s">{t}</p>)}
        {cur.kind === 'demo' && (
          <>
            <p className="sd-phone__space">Space after slide {plan.total}: {plan.demo.label}</p>
            <p className="sd-phone__s">Leave up during questions. It loops on its own.</p>
            <p className="sd-phone__s sd-phone__muted">To call up a backup on the Mac, type its number, then Enter. To return here, type {plan.demo.typed}, then Enter, or use the presenter&apos;s demo button.</p>
          </>
        )}
        {cur.kind === 'backups' && (
          <ol className="sd-phone__bk">
            {plan.demo && (
              <li><b>{plan.demo.label}</b> <span className="sd-phone__type">type {plan.demo.typed}, Enter</span><span>Demo: leave up during questions</span></li>
            )}
            {plan.backups.map((b) => (
              <li key={b.id}><b>{b.label}</b> <span className="sd-phone__type">type {b.typed}, Enter</span><span>{b.q || b.title}</span></li>
            ))}
          </ol>
        )}
        {!next && <p className="sd-phone__next">End of the backup index.</p>}
        {next && (
          <p className="sd-phone__next">
            Next: {next.kind === 'slide' ? `slide ${next.s.no}, ${next.s.title}` : next.kind === 'demo' ? `${plan.demo.label}, the demo slide` : 'the backup index'}
          </p>
        )}
        <p className="sd-phone__foot">
          {timer.running || timer.acc ? <button type="button" className="sd-phone__link" onClick={resetTimer}>Reset timer</button> : 'Tap the clock to start the timer.'}
          {' '}
          {wake === 'on' ? 'Screen stays on.' : wake === 'unsupported' ? 'Keep-awake is not available here: set Auto-Lock to Never.' : wake === 'off' ? 'Tap Next to keep the screen on.' : ''}
        </p>
      </main>

      <nav className="sd-phone__nav" aria-label="Turn the page">
        <button type="button" className="sd-phone__btn" onClick={() => go(-1)} disabled={page === 0}>Previous</button>
        <button type="button" className="sd-phone__btn is-next" onClick={() => go(1)} disabled={page === pages.length - 1}>Next</button>
      </nav>
    </div>,
    document.body,
  );
}
