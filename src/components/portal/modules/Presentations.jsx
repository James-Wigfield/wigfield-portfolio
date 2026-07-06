import { useCallback, useEffect, useRef, useState } from 'react';
import Icon from '../icons';
import uwaLogo from '../../../assets/portal/uwa-medical-physics.png';
import psma3d from '../../../assets/portal/psma-3d.gif';
import mambaOutput from '../../../assets/portal/mamba_block_3d-output.png';

/* ============================================================================
   PRESENTATIONS — tabulated slide decks  (University)
   ----------------------------------------------------------------------------
   A tabbed presentation page. Each tab is a dated deck; the deck is a slide-based
   presentation with a UWA Medical Physics banner on every slide and a full-screen
   presentation mode (Fullscreen API on the .pres-stage element). Navigation is
   next/prev buttons, dot jumps, and keyboard arrows (the stage is focusable, and
   it is auto-focused on entering full screen so arrows work there too).

   Adding another deck later is one more entry in DECKS below (a title, a date
   label, and a `slides` array of { kicker, title, body }). The shell — tabs,
   stage, banner, controls, full-screen — never changes.

   Styled with the .pres-* block in portal.css; every colour is a portal theme
   token, so the deck re-skins with the active theme (jade / coral / arcade).
   ========================================================================== */

// Project facts pulled from Documents/honours-project/research_proposal.tex
const PROJECT = {
  title: 'Optimising PSMA PET Segmentation using the Mamba Architecture',
  author: 'James Wigfield (23334375)',
  supervisor: 'Dr. Jake Kendrick',
  cosupervisor: 'Dr. Mubashar Hassan',
  degree: 'Bachelor of Advanced Computer Science (Honours)',
};

// The 08/07/2026 deck — a brief, non-technical progress update.
const HONOURS_UPDATE_SLIDES = [
  /* 1 · COVER */
  {
    kicker: 'Honours progress update',
    title: 'Cover',
    body: (
      <div className="pres-cover">
        <div className="pres-cover__text">
          <p className="pres-cover__eyebrow">Bachelor of Advanced Computer Science (Honours)</p>
          <h2 className="pres-cover__title">{PROJECT.title}</h2>
          <dl className="pres-cover__facts">
            <div><dt>Author</dt><dd>{PROJECT.author}</dd></div>
            <div><dt>Supervisor</dt><dd>{PROJECT.supervisor}</dd></div>
            <div><dt>Co-supervisor</dt><dd>{PROJECT.cosupervisor}</dd></div>
          </dl>
          <p className="pres-cover__date">Progress update · 08 / 07 / 2026</p>
        </div>
        <figure className="pres-cover__figure">
          <img src={psma3d} alt="Rotating whole-body PSMA PET scan" />
          <figcaption>Whole-body PSMA PET — the scans this project segments</figcaption>
        </figure>
      </div>
    ),
  },

  /* 2 · WHY IT MATTERS */
  {
    kicker: 'The problem',
    title: 'Why this matters',
    body: (
      <>
        <p className="pres-lead">
          Prostate cancer can spread through the body. A special scan — a <strong>PSMA PET</strong> scan —
          makes those cancer spots light up, so doctors can find them.
        </p>
        <div className="pres-cards">
          <div className="pres-card">
            <span className="pres-card__k">Today</span>
            <p>Finding and outlining every tumour on a whole-body scan is done largely by hand — slow, and
              different experts draw them differently.</p>
          </div>
          <div className="pres-card">
            <span className="pres-card__k">The goal</span>
            <p>A tool that outlines the tumours <strong>automatically</strong> — faster, and consistent every
              time.</p>
          </div>
          <div className="pres-card pres-card--accent">
            <span className="pres-card__k">The catch</span>
            <p>Tumours can be tiny specks inside a huge scan. The tool has to catch the specks without raising
              lots of false alarms.</p>
          </div>
        </div>
      </>
    ),
  },

  /* 3 · PROJECT AIMS */
  {
    kicker: 'What we set out to do',
    title: 'Project aims',
    body: (
      <>
        <p className="pres-lead">Three aims, in plain terms:</p>
        <ol className="pres-aims">
          <li>
            <span className="pres-aims__n">1</span>
            <div>
              <b>Build a smarter model.</b> Design a new type of AI model (called <em>Mamba</em>) that is well
              suited to spotting tiny tumours inside very large whole-body scans.
            </div>
          </li>
          <li>
            <span className="pres-aims__n">2</span>
            <div>
              <b>Compare it fairly.</b> Test it head-to-head against the current best model (nnU-Net) on the
              same data, so the comparison is honest.
            </div>
          </li>
          <li>
            <span className="pres-aims__n">3</span>
            <div>
              <b>Measure what counts.</b> Judge success by how well it detects real lesions — balancing
              <em> catching every tumour</em> against <em>not crying wolf</em>.
            </div>
          </li>
        </ol>
      </>
    ),
  },

  /* 4 · PREPROCESSING (light skim) */
  {
    kicker: 'Getting the data ready',
    title: 'Preprocessing — done',
    body: (
      <>
        <p className="pres-lead">
          Before a model can learn, every scan is cleaned up and put into the same shape. This whole pipeline
          is <strong>built and tested</strong>.
        </p>
        <div className="pres-flow" aria-label="Preprocessing pipeline">
          {['Load scans', 'Line up CT + PET', 'Resample', 'Normalise', 'Cut into patches', 'Batch'].map((step, i, arr) => (
            <span key={step} className="pres-flow__item">
              <span className="pres-flow__node">{step}</span>
              {i < arr.length - 1 && <span className="pres-flow__arrow" aria-hidden="true">→</span>}
            </span>
          ))}
        </div>
        <p className="pres-note">
          The recipe is copied exactly from the existing nnU-Net baseline, so later comparisons stay fair.
          That's the light part — the two big hurdles came next.
        </p>
      </>
    ),
  },

  /* 5 · ENVIRONMENT SETUP CHALLENGES (main focus) */
  {
    kicker: 'Main focus · the first big hurdle',
    title: 'Getting it to run at all',
    body: (
      <>
        <p className="pres-lead">
          The graphics card (GPU) that runs the model is <strong>brand new</strong>. So new that most of the
          software didn't know how to talk to it yet — getting the environment working was a real fight.
        </p>
        <div className="pres-cards pres-cards--tight">
          <div className="pres-card">
            <span className="pres-card__k">Too new</span>
            <p>The card needed the very latest version of the GPU software; older, standard versions built fine
              but simply refused to run on it.</p>
          </div>
          <div className="pres-card">
            <span className="pres-card__k">Silent sabotage</span>
            <p>Installing one library kept quietly swapping out another one it depended on — breaking the setup
              without any obvious error.</p>
          </div>
          <div className="pres-card">
            <span className="pres-card__k">Build from scratch</span>
            <p>The core libraries had to be re-compiled from source, aimed precisely at this exact card, rather
              than downloaded ready-made.</p>
          </div>
          <div className="pres-card">
            <span className="pres-card__k">Version clashes</span>
            <p>Even the compiler was too new and had to be pinned to an older version before anything would
              build.</p>
          </div>
        </div>
        <p className="pres-outcome">
          <span className="pres-outcome__tag">Outcome</span>
          After working through about five distinct failures, the whole thing is now captured as one tested,
          repeatable recipe — so it never has to be fought again, and it transfers to the hospital's computers.
        </p>
      </>
    ),
  },

  /* 6 · SUCCESSFUL IMPLEMENTATION (main focus) */
  {
    kicker: 'Main focus · the first big win',
    title: 'The core building block works',
    body: (
      <div className="pres-impl">
        <div className="pres-impl__text">
          <p className="pres-lead">
            The first real piece of the model — its core building block — is <strong>built and proven on the
            GPU</strong>. It takes a 3D chunk of a scan, studies it from several directions to gather context,
            and hands it back enhanced.
          </p>
          <div className="pres-metrics">
            <div className="pres-metric"><b>6 / 6</b><span>scan directions verified</span></div>
            <div className="pres-metric"><b>= input</b><span>shape kept, both variants</span></div>
            <div className="pres-metric"><b>~13 ms</b><span>full 6-way pass</span></div>
            <div className="pres-metric pres-metric--accent"><b>~368 MB</b><span>peak memory · 16 GB card</span></div>
          </div>
          <p className="pres-note">
            Every automated check passed. (One variant shows a long first run — that's a one-time compile step,
            not the real speed; warmed up, it's milliseconds.)
          </p>
        </div>
        <figure className="pres-impl__figure">
          <img src={mambaOutput} alt="Terminal output: all checks passed for the 3D Mamba block on the GPU" />
          <figcaption>Actual test output — “ALL CHECKS PASSED” on the RTX 5070 Ti</figcaption>
        </figure>
      </div>
    ),
  },

  /* 7 · WRAP-UP */
  {
    kicker: 'Where things stand',
    title: 'Current state & next steps',
    body: (
      <>
        <div className="pres-status">
          <div className="pres-status__col">
            <span className="pres-status__head pres-status__head--done">Done</span>
            <ul>
              <li>Data preprocessing pipeline — built &amp; tested</li>
              <li>Environment — solved &amp; documented as a recipe</li>
              <li>Core model block — built &amp; GPU-verified</li>
            </ul>
          </div>
          <div className="pres-status__col">
            <span className="pres-status__head pres-status__head--next">Next</span>
            <ul>
              <li>Assemble the full network (encoder → decoder)</li>
              <li>Train on labelled scans</li>
              <li>Benchmark against the nnU-Net baseline</li>
            </ul>
          </div>
        </div>
        <p className="pres-outcome">
          <span className="pres-outcome__tag">In short</span>
          The groundwork is done and the hardest setup problems are behind us — the project is ready to move on
          to building and training the full model.
        </p>
      </>
    ),
  },
];

// The registry of decks (newest first). Each becomes a tab.
const DECKS = [
  {
    id: 'honours-2026-07-08',
    dateLabel: '08/07/2026',
    bannerTitle: 'Honours Project · Mamba PSMA',
    slides: HONOURS_UPDATE_SLIDES,
  },
];

export default function Presentations() {
  const [deckId, setDeckId] = useState(DECKS[0].id);
  const [idx, setIdx] = useState(0);
  const [isFs, setIsFs] = useState(false);
  const stageRef = useRef(null);

  const deck = DECKS.find((d) => d.id === deckId) ?? DECKS[0];
  const slides = deck.slides;
  const count = slides.length;

  const goto = useCallback((i) => setIdx((prev) => {
    const next = Math.min(count - 1, Math.max(0, i));
    return next === prev ? prev : next;
  }), [count]);
  const go = useCallback((n) => setIdx((prev) => Math.min(count - 1, Math.max(0, prev + n))), [count]);

  // Switching tabs resets to the first slide.
  const pickDeck = (id) => { setDeckId(id); setIdx(0); };

  // Track full-screen state for the toggle icon + label.
  useEffect(() => {
    const onChange = () => setIsFs(document.fullscreenElement === stageRef.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggleFs = useCallback(() => {
    const el = stageRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen?.();
    } else {
      const req = el.requestFullscreen?.();
      // Focus the stage so keyboard arrows drive the deck in full screen.
      if (req?.then) req.then(() => el.focus?.()).catch(() => {});
      else el.focus?.();
    }
  }, []);

  // Keyboard: the stage is focusable, so arrows only act when it's focused
  // (or when it's the full-screen element) — never hijacks page scrolling.
  const onKeyDown = useCallback((e) => {
    switch (e.key) {
      case 'ArrowRight':
      case 'PageDown':
      case ' ': e.preventDefault(); go(1); break;
      case 'ArrowLeft':
      case 'PageUp': e.preventDefault(); go(-1); break;
      case 'Home': e.preventDefault(); goto(0); break;
      case 'End': e.preventDefault(); goto(count - 1); break;
      case 'f':
      case 'F': e.preventDefault(); toggleFs(); break;
      default: break;
    }
  }, [go, goto, count, toggleFs]);

  return (
    <div className="pt-module pres">
      <div>
        <p className="pres-kicker">University · Presentations</p>
        <p className="pt-module__intro">
          Slide decks for the honours project. Each tab is a dated presentation; open one, step through it with
          the arrows or the on-screen controls, and hit full screen to present it. Press <kbd>F</kbd> to toggle
          full screen and <kbd>←</kbd>/<kbd>→</kbd> to move between slides.
        </p>
      </div>

      {/* ── Tabs (one per dated deck) ─────────────────────────────────── */}
      <div className="pres-tabs" role="tablist" aria-label="Presentation dates">
        {DECKS.map((d) => (
          <button
            key={d.id}
            role="tab"
            aria-selected={d.id === deckId}
            className={`pres-tab${d.id === deckId ? ' pres-tab--active' : ''}`}
            onClick={() => pickDeck(d.id)}
          >
            <span className="pres-tab__dot" aria-hidden="true" />
            {d.dateLabel}
          </button>
        ))}
      </div>

      {/* ── Stage (the full-screen target) ────────────────────────────── */}
      <div
        className={`pres-stage${isFs ? ' pres-stage--fs' : ''}`}
        ref={stageRef}
        tabIndex={0}
        onKeyDown={onKeyDown}
        role="group"
        aria-roledescription="slide presentation"
        aria-label={`${deck.bannerTitle} — slide ${idx + 1} of ${count}`}
      >
        <div className="pres-screen">
          {slides.map((s, i) => (
            <section
              key={i}
              className={`pres-slide${i === idx ? ' pres-slide--active' : ''}`}
              aria-hidden={i !== idx}
            >
              {/* Banner — on every slide, carrying the UWA Medical Physics logo */}
              <header className="pres-banner">
                <div className="pres-banner__meta">
                  <span className="pres-banner__kicker">{s.kicker}</span>
                  <span className="pres-banner__title">{deck.bannerTitle}</span>
                </div>
                <img className="pres-banner__logo" src={uwaLogo} alt="UWA Medical Physics Research Group" />
              </header>

              <div className="pres-body">
                {s.title && s.title !== 'Cover' && <h2 className="pres-slide__h">{s.title}</h2>}
                {s.body}
              </div>
            </section>
          ))}
        </div>

        {/* Controls — available in-page and in full screen */}
        <div className="pres-controls">
          <button
            className="pres-btn"
            onClick={() => go(-1)}
            disabled={idx === 0}
            aria-label="Previous slide"
          >
            <Icon name="arrowLeft" size={16} />
          </button>

          <div className="pres-dots" role="tablist" aria-label="Slides">
            {slides.map((s, i) => (
              <button
                key={i}
                className={`pres-dot${i === idx ? ' pres-dot--active' : ''}`}
                onClick={() => goto(i)}
                aria-label={`Go to slide ${i + 1}: ${s.title}`}
                aria-current={i === idx ? 'true' : undefined}
              />
            ))}
          </div>

          <span className="pres-counter">{idx + 1} / {count}</span>

          <button
            className="pres-btn"
            onClick={() => go(1)}
            disabled={idx === count - 1}
            aria-label="Next slide"
          >
            <Icon name="arrowRight" size={16} />
          </button>

          <button
            className="pres-btn pres-btn--fs"
            onClick={toggleFs}
            aria-label={isFs ? 'Exit full screen' : 'Enter full screen'}
          >
            <Icon name={isFs ? 'compress' : 'expand'} size={16} />
            <span className="pres-btn__label">{isFs ? 'Exit' : 'Full screen'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
