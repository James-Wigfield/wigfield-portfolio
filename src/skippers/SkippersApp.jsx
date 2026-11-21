import { useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import './skippers.css';
import { LEVELS, levelBySlug, hrefFor, STUDY_LEVELS } from './content/levels';
import { useStored } from './kit/storage';
import { Icon } from './kit/kit';
import LevelPage from './pages/LevelPage';
import StartPage from './pages/StartPage';
import ExamRoom from './pages/ExamRoom';
import CramSheet from './pages/CramSheet';

/* ============================================================================
   /skippers — a public, unlisted (noindex) study site for the WA Recreational
   Skipper's Ticket. No accounts, no backend: progress lives in this browser
   (`sk:` localStorage keys). Content traces to the DoT RST Workbook, 8th ed.
   (July 2026) — every fact carries its `Workbook p.NN` receipt.
   See ./README.md for how to add questions, labs and levels.
   ========================================================================== */

function usePageSetup() {
  useEffect(() => {
    const html = document.documentElement;
    html.classList.add('sk-active');
    const prevTitle = document.title;
    document.title = 'Skipper’s Ticket WA · study in a day';
    const robots = document.createElement('meta');
    robots.name = 'robots';
    robots.content = 'noindex, nofollow';
    document.head.appendChild(robots);
    return () => {
      html.classList.remove('sk-active');
      document.title = prevTitle;
      robots.remove();
    };
  }, []);
}

const THEMES = ['auto', 'light', 'dark'];

export default function SkippersApp() {
  usePageSetup();
  const { pathname } = useLocation();
  const parts = pathname.replace(/^\/skippers\/?/, '').split('/').filter(Boolean);
  const level = levelBySlug(parts[0] ?? '') ?? LEVELS[0];
  const sub = parts[1] ?? null;
  const [theme, setTheme] = useStored('theme', 'auto');
  const [progress] = useStored('progress', {});
  const [mocks] = useStored('mocks', []);
  const tabs = useRef(null);

  // page background follows the theme (body sits outside .sk)
  useEffect(() => {
    const dark = theme === 'dark' || (theme === 'auto' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
    document.documentElement.style.setProperty('--sk-page', dark ? '#0c1621' : '#f3efe4');
    return () => document.documentElement.style.removeProperty('--sk-page');
  }, [theme]);

  // keep the active tab in view on phones; new level → top of page
  useEffect(() => {
    tabs.current?.querySelector('.sk-tab--on')?.scrollIntoView?.({ block: 'nearest', inline: 'center' });
    window.scrollTo(0, 0);
  }, [level.id]);

  const done = STUDY_LEVELS.filter((l) => (progress[l.id]?.check ?? 0) >= 4).length;
  const last3 = mocks.slice(-3);
  const ready = last3.length === 3 && last3.every((m) => m.score >= 36);
  const nextTheme = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];

  let body;
  if (level.id === 'start') body = <StartPage />;
  else if (level.id === 'exam') body = <ExamRoom sub={sub} />;
  else if (level.id === 'cram') body = <CramSheet />;
  else body = <LevelPage level={level} sub={sub} />;

  return (
    <div className="sk" data-theme={theme === 'auto' ? undefined : theme}>
      <header className="sk-top">
        <div className="sk-wrap">
          <div className="sk-top__row">
            <Link to="/skippers" className="sk-brand" aria-label="Skipper's Ticket WA — start">
              <BrandMark />
              <b>Skipper’s Ticket</b>
              <span>WA · RST</span>
            </Link>
            <div className="sk-top__right">
              <span className="sk-ready" title="Levels with a passed check-in">
                <b>{String(done).padStart(2, '0')}</b>/{String(STUDY_LEVELS.length).padStart(2, '0')} levels
                {ready && <span className="sk-dot sk-dot--ok" style={{ marginLeft: '0.6rem' }}>ready</span>}
              </span>
              <button type="button" className="sk-iconbtn" onClick={() => setTheme(nextTheme)} aria-label={`Theme: ${theme}. Switch to ${nextTheme}`} title={`Theme: ${theme}`}>
                <Icon name={theme === 'auto' ? 'auto' : theme === 'dark' ? 'moon' : 'sun'} size={15} />
              </button>
            </div>
          </div>
          <nav className="sk-tabs" ref={tabs} aria-label="Levels">
            {LEVELS.map((l) => {
              const passed = (progress[l.id]?.check ?? 0) >= 4;
              return (
                <Link key={l.id} to={hrefFor(l)} className={`sk-tab${l.id === level.id ? ' sk-tab--on' : ''}`} aria-current={l.id === level.id ? 'page' : undefined}>
                  <span className="sk-tab__n">{String(l.n).padStart(2, '0')}</span>
                  {l.short}
                  {passed && <span className="sk-tab__tick" aria-label="passed">✓</span>}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <main className="sk-main">
        <div className="sk-wrap">{body}</div>
      </main>
      <footer className="sk-wrap">
        <div className="sk-foot">
          <span>Study aid only. Every fact is checked against the WA DoT <a href="https://www.transport.wa.gov.au/getmedia/4ca427b2-485e-49be-ab4d-f33014ef8e49/MAC_P_RST_Workbook2026.pdf" target="_blank" rel="noreferrer">RST Workbook, 8th edition (July 2026)</a> — if anything here disagrees with it, the workbook wins.</span>
          <span className="sk-mono">progress is saved in this browser only</span>
        </div>
      </footer>
    </div>
  );
}

function BrandMark() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
      <circle cx="13" cy="13" r="12" fill="none" stroke="currentColor" strokeOpacity="0.35" />
      <path d="M13 13 L13 1.5 A11.5 11.5 0 0 1 23.6 17.4 Z" fill="var(--stbd)" opacity="0.85" />
      <path d="M13 13 L13 1.5 A11.5 11.5 0 0 0 2.4 17.4 Z" fill="var(--port)" opacity="0.85" />
      <circle cx="13" cy="13" r="2.4" fill="currentColor" />
    </svg>
  );
}
