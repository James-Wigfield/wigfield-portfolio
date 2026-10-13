import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import SlideView, { CANVAS_H, CANVAS_W } from './SlideView';
import { buildSequence } from './sequence';
import { useDeck } from './useDeck';
import { useFit } from './hooks';
import { fmtMB, runReadyCheck, useReady } from './ready';
import { labelOf, nextPos } from './controller';
import { openAudienceWindow } from './sync';
import { Script } from '../shared/Num';
import { cutText, fill, fmtTime } from '../shared/text';
import { CRIB } from '../shared/crib';

/* ============================================================================
   SEMINAR DECKS — PRESENTER VIEW  (/portal/seminar-decks/<deck>/presenter)
   ----------------------------------------------------------------------------
   On the laptop: the current slide, the next slide, the transcript in large
   type with its build-step and clip cues, elapsed time against the cumulative
   target (ahead or behind) and the time left, and a searchable Q&A crib whose
   answers jump the audience window to a backup slide. "Open audience window"
   opens the projector window; the two stay in sync over the deck's
   BroadcastChannel, with postMessage through the window reference as backup.
   ========================================================================== */

function Mini({ deck, slide, step, label }) {
  const { ref, s, left, top } = useFit(CANVAS_W, CANVAS_H);
  return (
    <figure className="sd-pv__mini">
      <div className="sd-pv__mini-box" ref={ref}>
        {slide && (
          <div className="sd-pv__mini-canvas" style={{ width: CANVAS_W, height: CANVAS_H, transform: `translate(${left}px, ${top}px) scale(${s})` }}>
            <SlideView deck={deck} slide={slide} step={step} mode="preview" phase="current" />
          </div>
        )}
      </div>
      <figcaption>{label}</figcaption>
    </figure>
  );
}

const TALK_LIMIT = 15 * 60;

export default function PresenterView({ deck, onExit }) {
  const info = buildSequence(deck);
  const { seq, totals } = info;
  const audienceWin = useRef(null);
  const [startedAt, setStartedAt] = useState(null);
  const [now, setNow] = useState(0);
  const [query, setQuery] = useState('');
  const [audienceOpen, setAudienceOpen] = useState(false);
  const ready = useReady(deck.slug);

  const onChange = () => {
    setStartedAt((t) => t ?? Date.now());
  };

  const ctl = useDeck(seq, { slug: deck.slug, syncOn: true, onExit, onChange });
  const { pos } = ctl;
  const slide = seq[pos.index];
  const np = nextPos(seq, pos);
  const nextSlide = np.index === pos.index && np.step === pos.step ? null : seq[np.index];

  useEffect(() => {
    runReadyCheck(deck);
  }, [deck]);

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.documentElement.style.overflow = prev;
    };
  }, []);

  const openAudience = () => {
    const url = `${window.location.pathname.replace(/\/presenter\/?$/, '')}/audience`;
    const w = openAudienceWindow(url, `sd-audience-${deck.slug}`);
    if (w) {
      audienceWin.current = w;
      ctl.syncRef.current?.addPeer(w);
      setAudienceOpen(true);
    }
  };

  const elapsed = startedAt ? (now - startedAt) / 1000 : 0;
  // Target time at the END of the previous main slide = where we should be when this slide starts.
  const startTarget = slide?.kind === 'main' ? slide.cumTarget - slide.target : totals.targetSeconds;
  const drift = startedAt ? elapsed - startTarget : 0;

  const crib = useMemo(() => {
    const q = query.trim().toLowerCase();
    return CRIB.filter((c) => !q || `${fill(c.q)} ${fill(c.a)}`.toLowerCase().includes(q));
  }, [query]);

  const jumpBackup = (label) => {
    const i = seq.findIndex((s) => s.kind === 'backup' && s.backupId === label);
    if (i >= 0) ctl.go(i, 0, 'jump');
  };

  const stepsHere = Math.max(1, slide?.steps ?? 1);

  return createPortal(
    <div className={`sd-pv ${deck.className ?? ''}-pv`} data-deck={deck.slug} data-index={pos.index} data-step={pos.step} data-ready={ready.state}>
      <header className="sd-pv__bar">
        <strong>{deck.name}</strong>
        <span className="sd-pv__pos">
          Slide {labelOf(seq, pos.index)} of {totals.mainCount}
          {stepsHere > 1 && <> · build {pos.step + 1} of {stepsHere}</>}
          {pos.black && <> · <b>BLACKED OUT</b></>}
        </span>
        <span className={`sd-pv__ready is-${ready.state}`}>
          {ready.state === 'ready' ? `Ready: ${ready.done} files, ${fmtMB(ready.bytes)} in memory` : ready.state === 'running' ? `Loading ${ready.done} / ${ready.total}` : ready.state === 'failed' ? `Ready check failed (${ready.failed.length})` : 'Not checked'}
        </span>
        <button type="button" className="sd-btn" onClick={openAudience}>{audienceOpen ? 'Re-open audience window' : 'Open audience window'}</button>
        <button type="button" className="sd-btn" onClick={ctl.toggleBlack}>Blackout (B)</button>
        <button type="button" className="sd-btn sd-btn--ghost" onClick={onExit}>Exit</button>
      </header>

      <div className="sd-pv__grid">
        <section className="sd-pv__slides">
          <Mini deck={deck} slide={slide} step={pos.step} label="Now" />
          <Mini deck={deck} slide={nextSlide} step={np.index === pos.index ? np.step : 0} label={nextSlide ? (np.index === pos.index ? `Next: build ${np.step + 1}` : `Next: slide ${labelOf(seq, np.index)}`) : 'End'} />
          <div className="sd-pv__clock">
            <div><span>Elapsed</span><b>{fmtTime(elapsed)}</b></div>
            <div><span>Target here</span><b>{fmtTime(startTarget)}</b></div>
            <div className={drift > 15 ? 'is-behind' : drift < -15 ? 'is-ahead' : ''}>
              <span>{drift > 0 ? 'Behind' : 'Ahead'}</span><b>{fmtTime(Math.abs(drift))}</b>
            </div>
            <div><span>Left of 15:00</span><b>{fmtTime(TALK_LIMIT - elapsed)}</b></div>
            <button type="button" className="sd-btn sd-btn--ghost" onClick={() => setStartedAt(Date.now())}>Restart clock</button>
          </div>
          <div className="sd-pv__nav">
            <button type="button" className="sd-btn" onClick={ctl.prev}>Back</button>
            <button type="button" className="sd-btn sd-btn--solid" onClick={ctl.next}>Next</button>
          </div>
        </section>

        <section className="sd-pv__script" aria-label="Transcript">
          <p className="sd-pv__title">{slide?.title ? fill(slide.title) : slide?.label}</p>
          {slide?.kind === 'main' && (
            <p className="sd-pv__timing">
              {slide.target} s target · {fmtTime(slide.cumTarget)} cumulative · {slide.words} words
            </p>
          )}
          {slide?.cues?.length > 0 && (
            <ol className="sd-pv__cues">
              {slide.cues.map((c, i) => <li key={i} className={i === pos.step ? 'is-now' : ''}>{fill(c)}</li>)}
            </ol>
          )}
          {slide?.script && <Script text={slide.script.text} className="sd-pv__text" />}
          {slide?.script && cutText(slide.script.text) && (
            <p className="sd-pv__cutline">If behind, drop: {cutText(slide.script.text)}</p>
          )}
        </section>

        <section className="sd-pv__crib" aria-label="Q and A crib">
          <input
            className="sd-pv__search"
            type="search"
            placeholder="Search the Q&A crib"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <ol className="sd-pv__crib-list">
            {crib.map((c) => (
              <li key={c.id}>
                <p className="sd-pv__q">{fill(c.q)}</p>
                <p className="sd-pv__a">{fill(c.a)}</p>
                {c.backup && (
                  <button type="button" className="sd-btn sd-btn--small" onClick={() => jumpBackup(c.backup)}>
                    Show backup {seq.find((s) => s.backupId === c.backup) ? labelOf(seq, seq.findIndex((s) => s.backupId === c.backup)) : c.backup}
                  </button>
                )}
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>,
    document.body,
  );
}
