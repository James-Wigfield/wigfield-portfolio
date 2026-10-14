import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Thumb from './Thumb';
import { buildSequence, deckMedia } from './sequence';
import { labelOf } from './controller';
import { fmtMB, runReadyCheck, useReady } from './ready';
import { loadDeck, useDeckModule } from './decks';
import PalmCards from './PalmCards';
import { hasSaid } from './talk';
import RemoteBoundary from './RemoteBoundary';
import RemotePanel from './RemotePanel';
import { Script, T } from '../shared/Num';
import { fill, fmtTime } from '../shared/text';
import { TALK } from '../shared/meta';

/* ============================================================================
   SEMINAR DECKS — DECK PAGE: slide sorter, script view, Ready check, downloads
   ----------------------------------------------------------------------------
   Script view prints cleanly (Cmd+P / Ctrl+P): while it is open, a print-only
   copy is drawn into document.body and body gets .sd-printing, so the print
   stylesheet hides the portal shell and prints only the script.
   ========================================================================== */

const TAB_LABELS = { slides: 'Slides', script: 'Script', ready: 'Ready check', downloads: 'Downloads' };

function Sorter({ deck, go }) {
  const { seq } = buildSequence(deck);
  const main = seq.filter((s) => s.kind === 'main');
  const backups = seq.filter((s) => s.kind === 'backup');
  // Second options: a deck may name a derived deck (deck.altSlug) that swaps some
  // slides for a second option (slide.second, slide.secondNote). Each main slide
  // and the demo slide then shows its second option under the tile, or says it has none.
  const alt = useDeckModule(deck.altSlug ?? null);
  const altSeq = alt && !(alt instanceof Error) ? buildSequence(alt).seq : null;
  const second = (s) => {
    if (!deck.altSlug || !(s.kind === 'main' || s.backupId === deck.demoId)) return null;
    const a = altSeq?.find((x) => x.id === s.id);
    if (!a?.second) return <p className="sd-sorter__alt-none">No second option</p>;
    const at = labelOf(altSeq, altSeq.indexOf(a)).toLowerCase();
    return (
      <div className="sd-sorter__alt">
        <button type="button" onClick={() => go(`${deck.altSlug}/${at}`)} aria-label={`Play the second option of slide ${labelOf(seq, seq.indexOf(s))}`}>
          <Thumb deck={alt} slide={a} width={220} />
        </button>
        <p className="sd-sorter__alt-note"><b>Second option.</b> {a.secondNote}</p>
        <button type="button" className="sd-btn sd-btn--small" onClick={() => go(`${deck.altSlug}/${at}`)}>Play the second option</button>
      </div>
    );
  };
  const tile = (s) => {
    const label = labelOf(seq, seq.indexOf(s));
    return (
      <li key={s.id} className="sd-sorter__tile">
        <button type="button" onClick={() => go(`${deck.slug}/${label.toLowerCase()}`)} aria-label={`Present from slide ${label}`}>
          <Thumb deck={deck} slide={s} width={300} />
        </button>
        <p><span className="sd-sorter__no">{label}</span> {fill(s.title ?? s.label ?? '')}</p>
        {second(s)}
      </li>
    );
  };
  return (
    <>
      <h3 className="sd-sec">Main slides</h3>
      <ol className="sd-sorter">{main.map(tile)}</ol>
      <h3 className="sd-sec">Backup slides (for questions)</h3>
      <ol className="sd-sorter">{backups.map(tile)}</ol>
    </>
  );
}

function ScriptRows({ deck, thumbs = true }) {
  const { seq, totals } = buildSequence(deck);
  return (
    <div className="sd-script">
      <header className="sd-script__head">
        <h2>{deck.name}: script</h2>
        <p>{TALK.title}</p>
        <p>
          {totals.mainCount} main slides · {totals.words} words · {fmtTime(totals.spokenSeconds)} spoken at 135 words a minute
          {' '}(including {Math.round(totals.silentSeconds)} s of clips without narration) · target {fmtTime(totals.targetSeconds)}
        </p>
      </header>
      {seq.map((s, i) => (
        <article key={s.id} className={`sd-script__row is-${s.kind}`}>
          {thumbs && <Thumb deck={deck} slide={s} width={360} className="sd-script__thumb" />}
          <div className="sd-script__body">
            <p className="sd-script__meta">
              <b>{s.kind === 'backup' ? `Backup ${labelOf(seq, i)}` : `Slide ${labelOf(seq, i)}`}</b>
              {s.kind === 'main' && <> · {s.target} s · ends at {fmtTime(s.cumTarget)} · {s.words} words</>}
              {s.kind === 'backup' && <> · {s.words} words</>}
            </p>
            <h4 className="sd-script__title">{fill(s.title ?? s.label ?? '')}</h4>
            {s.cues?.length > 0 && (
              <ol className="sd-script__cues">{s.cues.map((c, j) => <li key={j}>{fill(c)}</li>)}</ol>
            )}
            {s.script ? <Script text={s.script.text} /> : <p className="sd-script__none">No transcript.</p>}
            {s.said && (
              <div className="sd-script__said">
                <p className="sd-script__said-label">
                  Transcript to read{s.saidSecs ? ` · timed at ${s.saidSecs} s (target ${s.target} s)` : ''}
                </p>
                <p className="sd-script__said-text">“<T>{s.said}</T>”</p>
              </div>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}

function ScriptView({ deck, go }) {
  const [cards, setCards] = useState(false);
  useEffect(() => {
    document.body.classList.add('sd-printing');
    return () => document.body.classList.remove('sd-printing');
  }, []);
  // Palm cards: lay them out, then print them alone (the script's own print
  // class is swapped out while the dialog is open, and back afterwards).
  const printCards = useCallback(() => {
    const body = document.body;
    const done = () => {
      window.removeEventListener('afterprint', done);
      body.classList.remove('sd-printing-cards');
      body.classList.add('sd-printing');
      setCards(false);
    };
    body.classList.remove('sd-printing');
    body.classList.add('sd-printing-cards');
    window.addEventListener('afterprint', done);
    window.setTimeout(() => window.print(), 50);
  }, []);
  return (
    <>
      <p className="sd-note">Print this page (Ctrl+P or Cmd+P) for a clean PDF of the script with a thumbnail per slide.</p>
      {hasSaid(deck) && (
        <div className="sd-script__tools">
          <button type="button" className="sd-btn sd-btn--solid" onClick={() => setCards(true)} disabled={cards}>Export PDF</button>
          <span className="sd-note">palm cards: A6, four to an A4 sheet; print at 100% scale, single-sided</span>
          <button type="button" className="sd-btn" onClick={() => go(`${deck.slug}/phone`)}>Phone script</button>
          <span className="sd-note">the transcript on a phone, one slide a page</span>
        </div>
      )}
      {cards && createPortal(<PalmCards deck={deck} onReady={printCards} />, document.body)}
      <ScriptRows deck={deck} />
      {createPortal(<div className="sd-print-root"><ScriptRows deck={deck} /></div>, document.body)}
    </>
  );
}

function ReadyPanel({ deck }) {
  const r = useReady(deck.slug);
  const files = deckMedia(deck).length;
  return (
    <section className="sd-ready">
      <p>
        Fetches every clip, hold frame, figure, data file and font this deck uses ({files} files plus the clips' hold
        frames and the logo) into memory, loads the fonts and the presenter code, then serves everything from memory.
        After a tick, the talk runs to the end with the network off. Run it in each window you present from
        (the audience window runs its own when it opens).
      </p>
      <button type="button" className="sd-btn sd-btn--solid" onClick={() => runReadyCheck(deck, { loadDeck: () => loadDeck(deck.slug) })} disabled={r.state === 'running'}>
        {r.state === 'ready' ? 'Run again' : 'Run the Ready check'}
      </button>
      <div className={`sd-ready__status is-${r.state}`} role="status">
        {r.state === 'idle' && 'Not run in this window yet.'}
        {r.state === 'running' && `Loading ${r.done} of ${r.total} (${fmtMB(r.bytes)})`}
        {r.state === 'ready' && (
          <>
            <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true"><path d="M5 14.5 11 20.5 23 7.5" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            {` Ready: ${r.done} files, ${fmtMB(r.bytes)} in memory, ${r.fonts} font faces loaded.`}
          </>
        )}
        {r.state === 'failed' && `Failed: ${r.failed.join('; ')}`}
      </div>
    </section>
  );
}

function Downloads({ deck }) {
  return (
    <section className="sd-downloads">
      <p>Save both to the Mac before the talk: they are the fallback if the network or the browser fails.</p>
      <ul>
        <li><a className="sd-btn" href={`/seminar-decks/pdf/${deck.slug}-slides.pdf`} download>Slides PDF</a> one page per slide (clip slides show their hold frame)</li>
        <li><a className="sd-btn" href={`/seminar-decks/pdf/${deck.slug}-script.pdf`} download>Script PDF</a> every slide with its transcript and timing</li>
      </ul>
    </section>
  );
}

export default function DeckPage({ deck, tab, go }) {
  const { totals } = buildSequence(deck);
  return (
    <div className={`pt-module sd-deckpage sd-deckpage--${tab}`}>
      <header className="sd-deckpage__head">
        <button type="button" className="sd-btn sd-btn--ghost" onClick={() => go('')}>All three decks</button>
        <div>
          <h2>{deck.name}</h2>
          <p>{deck.concept}</p>
          <p className="sd-deckpage__stats">
            {totals.mainCount} main + {totals.backupCount} backup slides · {fmtTime(totals.spokenSeconds)} spoken
          </p>
        </div>
        <div className="sd-deckpage__go">
          <button type="button" className="sd-btn sd-btn--solid" onClick={() => go(`${deck.slug}/present`)}>Present</button>
          <button type="button" className="sd-btn" onClick={() => go(`${deck.slug}/presenter`)}>Presenter view</button>
          {hasSaid(deck) && <button type="button" className="sd-btn" onClick={() => go(`${deck.slug}/ready`)}>Phone remote</button>}
        </div>
      </header>
      <nav className="sd-tabs" aria-label="Deck views">
        {Object.entries(TAB_LABELS).map(([id, label]) => (
          <button key={id} type="button" className={`sd-tab${tab === id ? ' is-active' : ''}`} onClick={() => go(id === 'slides' ? deck.slug : `${deck.slug}/${id}`)}>
            {label}
          </button>
        ))}
      </nav>
      {tab === 'slides' && <Sorter deck={deck} go={go} />}
      {tab === 'script' && <ScriptView deck={deck} go={go} />}
      {tab === 'ready' && hasSaid(deck) && <RemoteBoundary><RemotePanel deck={deck} /></RemoteBoundary>}
      {tab === 'ready' && <ReadyPanel deck={deck} />}
      {tab === 'downloads' && <Downloads deck={deck} />}
    </div>
  );
}

export { ScriptRows };
