import { useState } from 'react';
import Thumb from './Thumb';
import { useAllDecks, DECK_LIST } from './decks';
import { buildSequence } from './sequence';
import { fmtTime } from '../shared/text';
import { MATRIX, RECOMMENDATION } from '../shared/matrix';

/* ============================================================================
   SEMINAR DECKS — LANDING: the three decks side by side
   ========================================================================== */

const CHECKLIST = [
  'Use Chrome, not Safari.',
  'System Settings > Displays: extend, not mirror.',
  'Open the presenter view on the laptop, click "Open audience window", drag that window to the projector, click it, press F.',
  'Turn on Do Not Disturb (sleep and notifications off). Charger in. USB-C to HDMI adapter in the bag.',
  'Run the Ready check on the deck you will present (the audience window runs its own when it opens).',
  'Test the clicker: it should send PageDown and PageUp.',
  'Ask for the lights over the screen to be off; check the case A ground-truth hold on the projector.',
  'Save the slides PDF and the script PDF to the Mac as the no-network fallback.',
];

function loadChecks() {
  try {
    return JSON.parse(window.localStorage.getItem('seminar-decks:checklist') ?? '[]');
  } catch {
    return [];
  }
}

export default function Landing({ go }) {
  const decks = useAllDecks();
  const [checked, setChecked] = useState(loadChecks);

  const toggle = (i) => {
    setChecked((c) => {
      const n = c.includes(i) ? c.filter((x) => x !== i) : [...c, i];
      try {
        window.localStorage.setItem('seminar-decks:checklist', JSON.stringify(n));
      } catch {
        /* per-viewer convenience only */
      }
      return n;
    });
  };

  return (
    <div className="pt-module sd-landing">
      <header className="sd-landing__head">
        <p className="sd-kicker">CITS4010 honours seminar · 15 minutes + 5 of questions</p>
        <h2 className="sd-landing__title">Three ways to give the same talk</h2>
        <p className="sd-landing__lede">
          Each deck covers the same evidence and the whole marking sheet, with a transcript for every slide,
          a presenter view, backup slides for questions and a Ready check that lets it run offline.
          They differ in the story they tell and how they look.
        </p>
      </header>

      {RECOMMENDATION && (
        <section className="sd-reco" aria-label="Recommendation">
          <h3>Recommendation</h3>
          <p>{RECOMMENDATION}</p>
        </section>
      )}

      <section className="sd-cards">
        {DECK_LIST.map((d, i) => {
          if (d.hidden) return null;
          const deck = decks[i];
          if (!deck || deck instanceof Error) {
            return <article key={d.slug} className="sd-card"><p>Loading {d.slug}...</p></article>;
          }
          const { seq, totals } = buildSequence(deck);
          return (
            <article key={d.slug} className="sd-card">
              <button type="button" className="sd-card__thumb" onClick={() => go(deck.slug)} aria-label={`Open ${deck.name}`}>
                <Thumb deck={deck} slide={seq[0]} width={420} />
              </button>
              <h3 className="sd-card__name">{deck.name}</h3>
              <p className="sd-card__concept">{deck.concept}</p>
              <dl className="sd-card__facts">
                <div><dt>Slides</dt><dd>{totals.mainCount} main + {totals.backupCount} backup</dd></div>
                <div><dt>Transcript</dt><dd>{fmtTime(totals.spokenSeconds)} spoken ({totals.words} words at 135 a minute, {Math.round(totals.silentSeconds)} s of clips without narration)</dd></div>
                <div><dt>Target</dt><dd>{fmtTime(totals.targetSeconds)}</dd></div>
              </dl>
              <p className="sd-card__label">Wow</p>
              <ul className="sd-card__list">{(deck.wow ?? []).map((w) => <li key={w}>{w}</li>)}</ul>
              <p className="sd-card__label">Build risk</p>
              <p className="sd-card__risk">{deck.risk}</p>
              <div className="sd-card__actions">
                <button type="button" className="sd-btn sd-btn--solid" onClick={() => go(deck.slug)}>Open</button>
                <button type="button" className="sd-btn" onClick={() => go(`${deck.slug}/present`)}>Present</button>
                <button type="button" className="sd-btn" onClick={() => go(`${deck.slug}/presenter`)}>Presenter view</button>
                <button type="button" className="sd-btn" onClick={() => go(`${deck.slug}/script`)}>Script</button>
              </div>
            </article>
          );
        })}
      </section>

      <section className="sd-matrix" aria-label="Comparison against the marking sheet">
        <h3>Against the marking sheet</h3>
        <p className="sd-matrix__note">{MATRIX.note}</p>
        <table>
          <thead>
            <tr>
              <th>Criterion</th>
              {DECK_LIST.map((d, i) => d.hidden ? null : <th key={d.slug}>{decks[i] && !(decks[i] instanceof Error) ? decks[i].name : d.slug}</th>)}
            </tr>
          </thead>
          <tbody>
            {MATRIX.rows.map((r) => (
              <tr key={r.criterion} className={r.total ? 'is-total' : ''}>
                <th scope="row">{r.criterion}</th>
                {DECK_LIST.filter((d) => !d.hidden).map((d) => (
                  <td key={d.slug}>
                    <b>{r.scores?.[d.slug] ?? '-'}</b>
                    {r.notes?.[d.slug] && <span>{r.notes[d.slug]}</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="sd-check" aria-label="Before the talk">
        <h3>Before the talk (on the Mac)</h3>
        <ul>
          {CHECKLIST.map((c, i) => (
            <li key={c}>
              <label>
                <input type="checkbox" checked={checked.includes(i)} onChange={() => toggle(i)} />
                <span>{c}</span>
              </label>
            </li>
          ))}
        </ul>
        <p className="sd-check__note">
          Safari: untested. Expect differences in full screen (Safari prefixes and limits the Fullscreen API),
          in BroadcastChannel between windows (supported since Safari 15.4), in video autoplay and in font
          rendering. Present from Chrome.
        </p>
      </section>
    </div>
  );
}
