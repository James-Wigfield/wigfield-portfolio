/**
 * /films — the programme. Every film made by the seth skill, newest first.
 *
 * Each row is one link. Its poster cuts hard between the film's stills (one per
 * chapter) like a trailer, with the matching chapter lit in the list beside it.
 * Styles are scoped under `.fx` (films.css); the site's themes are untouched.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import '@fontsource/anton/400.css';
import '@fontsource/space-mono/400.css';
import '@fontsource/space-mono/700.css';
import './films.css';
import { FILMS } from './registry';

const CUT_MS = 1700;
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

const pad = (n) => String(n).padStart(2, '0');
const timecode = (s) => `${pad(Math.floor(s / 60))}:${pad(Math.floor(s % 60))}`;
function day(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS[m - 1] ?? ''} ${y}`;
}

const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** One shared clock for every poster, so the page cuts on a single beat. */
function useCut() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (reducedMotion()) return undefined;
    const id = window.setInterval(() => {
      if (!document.hidden) setTick((t) => t + 1);
    }, CUT_MS);
    return () => window.clearInterval(id);
  }, []);
  return tick;
}

/** Black browser chrome, the page title, and no cyberpunk scrollbar while mounted. */
function usePageTakeover() {
  useEffect(() => {
    const html = document.documentElement;
    html.classList.add('fx-active');
    const prevTitle = document.title;
    document.title = 'Films · James Wigfield';
    const metas = Array.from(document.querySelectorAll('meta[name="theme-color"]'));
    const prev = metas.map((m) => m.content);
    metas.forEach((m) => (m.content = '#050505'));
    return () => {
      html.classList.remove('fx-active');
      document.title = prevTitle;
      metas.forEach((m, i) => (m.content = prev[i] ?? m.content));
    };
  }, []);
}

function FilmRow({ film, tick, offset }) {
  const [held, setHeld] = useState(null);
  const { stills } = film;
  const active = stills.length ? (held ?? (tick + offset) % stills.length) : -1;
  const lit = active >= 0 ? stills[active].chapter : null;

  const holdChapter = (name) => {
    const i = stills.findIndex((s) => s.chapter === name);
    if (i >= 0) setHeld(i);
  };

  return (
    <li className="fx-film" style={{ '--fx-accent': film.accent }}>
      <Link
        to={`/films/${film.slug}`}
        className="fx-film__link"
        data-films="row"
        data-slug={film.slug}
        aria-label={`${film.title}. ${film.logline} Runs ${timecode(film.runtime)}. Play the film.`}
        onMouseLeave={() => setHeld(null)}
      >
        <div className="fx-film__poster" aria-hidden="true">
          {stills.length ? (
            stills.map((s, i) => (
              <img
                key={s.src}
                src={s.src}
                alt=""
                data-on={i === active}
                loading={i === 0 ? 'eager' : 'lazy'}
                decoding="async"
              />
            ))
          ) : (
            <span className="fx-film__nostills">No stills captured yet</span>
          )}
          {active >= 0 && (
            <span className="fx-film__tc">
              {timecode(stills[active].t)}
              <span>{stills[active].chapter}</span>
            </span>
          )}
        </div>

        <div className="fx-film__text">
          <p className="fx-film__meta">
            <span className="fx-dot" />
            <span>№ {pad(film.number)}</span>
            <span>{day(film.date)}</span>
            <span>{timecode(film.runtime)}</span>
          </p>
          <h2 className="fx-film__title">{film.title}</h2>
          <p className="fx-film__logline">{film.logline}</p>
          <p className="fx-film__source">From {film.source}.</p>

          <ol className="fx-film__chapters" aria-hidden="true">
            {film.chapters.map((c, i) => (
              <li key={c.name} data-on={c.name === lit} onMouseEnter={() => holdChapter(c.name)}>
                <span className="fx-film__chapter-index">{pad(i)}</span>
                <span className="fx-film__chapter-name">{c.name}</span>
                <span className="fx-film__chapter-tc">{timecode(c.start)}</span>
              </li>
            ))}
          </ol>

          <span className="fx-film__cta">
            Play film <span aria-hidden="true">→</span>
          </span>
        </div>
      </Link>
    </li>
  );
}

export default function FilmsIndex() {
  usePageTakeover();
  const tick = useCut();

  return (
    <div className="fx">
      <header className="fx-top">
        <Link to="/" className="fx-top__home">
          <span aria-hidden="true">←</span> James Wigfield
        </Link>
        <span className="fx-top__count">
          {pad(FILMS.length)} {FILMS.length === 1 ? 'film' : 'films'}
        </span>
      </header>

      <section className="fx-head">
        <h1 className="fx-head__title">Films</h1>
        <p className="fx-head__line">
          Conversations, cut into short films. Every frame and every sound is made in code and
          rendered live in your browser. Sound on, lights off.
        </p>
      </section>

      {FILMS.length ? (
        <ol className="fx-list">
          {FILMS.map((film, i) => (
            <FilmRow key={film.slug} film={film} tick={tick} offset={i} />
          ))}
        </ol>
      ) : (
        <p className="fx-empty">Nothing showing yet.</p>
      )}

      <footer className="fx-foot">
        <span>Real-time three.js · no video files</span>
        <Link to="/">jameswigfield.com</Link>
      </footer>
    </div>
  );
}
