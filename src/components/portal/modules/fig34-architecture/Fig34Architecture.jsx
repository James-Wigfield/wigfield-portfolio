import { useState } from 'react';
import { BRIEF, OPTIONS, RECOMMENDATION, CHOSEN } from './options';
import Fig47Qualitative from './Fig47Qualitative';
import './Fig34Architecture.css';

/* ============================================================================
   FIG 3.4 · ARCHITECTURE — eight candidate designs for one print figure
   ----------------------------------------------------------------------------
   Figure 3.4 of the CITS4010 dissertation (fig:method-architecture) drawn eight
   ways in two rounds (A to E plain, F to H the "go further than D" round), so
   James can pick one. Every option is a standalone TikZ file compiled
   with pdflatex; this page shows renders of those PDFs (SVG from pdftocairo,
   greyscale PNG from pdftoppm), never a React redraw, so what is picked here
   is byte for byte what prints, in the real Latin Modern fonts.

   Views: on the page (a mock A4 sheet at true proportions with the cshonours
   text block and the caption beneath), true size (CSS mm at 1:1) and zoom
   (2x, scrollable); a greyscale toggle; and a compare view of any two.
   The figures always sit on white paper, whatever the portal theme.

   The words (concepts, critic verdicts, scorecards) live in ./options.js.
   ========================================================================== */

// A4 and the cshonours.cls text block, in mm (left = 1in + 31pt, top = 1in +
// 20pt + 12pt + 25pt, width 411.4pt, height 592pt).
const PAGE = { w: 210, h: 297, left: 36.3, top: 45.4, textW: 144.6, textH: 208.0 };
const pct = (mm, of) => `${(100 * mm) / of}%`;

const MODES = [
  { id: 'page', label: 'On the page' },
  { id: 'true', label: 'True size' },
  { id: 'zoom', label: 'Zoom 2x' },
];

function Figure({ opt, mode, grey }) {
  const src = opt.assets.svg;
  const alt = `Figure 3.4, option ${opt.id}: ${opt.name}`;
  const look = grey ? 'f34-grey' : undefined;
  if (mode === 'page') {
    return (
      <div className={`f34-sheet ${look || ''}`} role="img" aria-label={`${alt}, shown on an A4 page`}>
        <div
          className="f34-sheet__block"
          style={{ left: pct(PAGE.left, PAGE.w), top: pct(PAGE.top, PAGE.h), width: pct(PAGE.textW, PAGE.w) }}
        >
          <img src={src} alt="" className="f34-sheet__fig" />
          <p className="f34-sheet__cap">
            Figure 3.4: {BRIEF.caption}
          </p>
        </div>
        <span
          className="f34-sheet__frame"
          style={{
            left: pct(PAGE.left, PAGE.w), top: pct(PAGE.top, PAGE.h),
            width: pct(PAGE.textW, PAGE.w), height: pct(PAGE.textH, PAGE.h),
          }}
          aria-hidden="true"
        />
      </div>
    );
  }
  const width = mode === 'zoom' ? `${2 * PAGE.textW}mm` : `${PAGE.textW}mm`;
  return (
    <div className="f34-scroll">
      <div className={`f34-paper ${look || ''}`}>
        <img src={src} alt={alt} style={{ width }} className="f34-paper__fig" />
      </div>
    </div>
  );
}

function Scorecard({ opt }) {
  const s = opt.score;
  return (
    <dl className="f34-score">
      <div><dt>Must-fixes</dt><dd>{s.mustFix}</dd></div>
      <div><dt>Blind quiz</dt><dd>{s.quiz} / 9</dd></div>
      <div>
        <dt>{opt.round === 2 ? 'Design rank, round 2' : 'Design and marker rank'}</dt>
        <dd>{s.rank} of {s.rankOf || 5}</dd>
      </div>
      {s.wow && <div><dt>Examiner wow</dt><dd>{s.wow} / 10</dd></div>}
      {s.ad && <div><dt>Art director: wow, polish, clarity</dt><dd>{s.ad.join(' · ')}</dd></div>}
      <div><dt>Height</dt><dd>{s.heightMm} mm</dd></div>
      <div><dt>Smallest text</dt><dd>{s.minPt} pt</dd></div>
    </dl>
  );
}

function OptionDetail({ opt }) {
  return (
    <article className="f34-detail pt-card">
      <header className="f34-detail__head">
        <span className="f34-badge">{opt.id}</span>
        <div>
          <h3 className="f34-detail__title">
            {opt.name}
            {CHOSEN === opt.id && <span className="f34-chosen">chosen</span>}
          </h3>
          <p className="f34-detail__concept">{opt.concept}</p>
        </div>
      </header>
      <Scorecard opt={opt} />
      <p className="f34-detail__main"><span>Blind reader, ten-second main point:</span> “{opt.score.mainPoint}”</p>
      <div className="f34-detail__cols">
        <section>
          <h4>Strengths</h4>
          <ul>{opt.strengths.map((t) => <li key={t}>{t}</li>)}</ul>
        </section>
        <section>
          <h4>Weaknesses</h4>
          <ul>{opt.weaknesses.map((t) => <li key={t}>{t}</li>)}</ul>
        </section>
      </div>
      <section>
        <h4>Optional content carried</h4>
        <ul className="f34-chips">
          {opt.optional.map((o) => (
            <li key={o.label} className={o.on ? 'is-on' : 'is-off'}>
              {o.on ? '✓' : '–'} {o.label}
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h4>Critic verdicts</h4>
        <ul className="f34-verdicts">{opt.verdicts.map((v) => <li key={v.who}><b>{v.who}:</b> {v.text}</li>)}</ul>
      </section>
      <p className="f34-detail__links">
        <a href={opt.assets.pdf} target="_blank" rel="noreferrer">Open the PDF</a>
        <a href={opt.assets.grey} target="_blank" rel="noreferrer">Greyscale PNG</a>
        <span>Source: <code>{opt.source}</code></span>
      </p>
    </article>
  );
}

// Figure switcher: this page also holds Figure 4.7's options (Fig47Qualitative.jsx).
const FIGURES = [{ id: '3.3', label: 'Figure 3.3 · Architecture' }, { id: '4.7', label: 'Figure 4.7 · Qualitative examples' }];

export default function Fig34Architecture() {
  const [fig, setFig] = useState(() => (new URLSearchParams(window.location.search).get('fig') === '4.7' ? '4.7' : '3.3'));
  return (
    <>
      <div className="f47-switch">
        <span className="f47-switch__label">Figure</span>
        <div className="f34-seg" role="group" aria-label="Figure">
          {FIGURES.map((f) => (
            <button key={f.id} type="button" className={fig === f.id ? 'is-active' : ''} aria-pressed={fig === f.id}
              onClick={() => setFig(f.id)}>
              {f.label}
            </button>
          ))}
        </div>
      </div>
      {fig === '4.7' ? <Fig47Qualitative /> : <ArchitecturePage />}
    </>
  );
}

function ArchitecturePage() {
  const [sel, setSel] = useState(CHOSEN || RECOMMENDATION.id);
  const [mode, setMode] = useState('page');
  const [grey, setGrey] = useState(false);
  const [compare, setCompare] = useState(false);
  const [pair, setPair] = useState(['D', 'F']);
  const byId = Object.fromEntries(OPTIONS.map((o) => [o.id, o]));
  const opt = byId[sel];

  return (
    <div className="pt-module f34">
      <header>
        <p className="f34-kicker">CITS4010 · dissertation · Chapter 3</p>
        <h2 className="f34-title">Figure 3.4: the network architecture</h2>
        <p className="pt-module__intro">
          Eight designs of the same figure in two rounds, each a TikZ file compiled to the PDF that would print.
          A to E are the plain first round; F to H answer the brief to go further than D. Pick one; it gets
          finished and placed.
        </p>
      </header>

      <section className="f34-brief pt-card">
        <h3>The brief</h3>
        <p className="f34-brief__cap"><b>Caption (fixed):</b> {BRIEF.caption}</p>
        <ol>{BRIEF.points.map((p) => <li key={p}>{p}</li>)}</ol>
        <p className="f34-brief__rule">{BRIEF.rule}</p>
        <p className="f34-brief__rule">{BRIEF.round2}</p>
      </section>

      <div className="f34-bar" role="toolbar" aria-label="Figure options">
        <div className="f34-seg" role="group" aria-label="Option">
          {OPTIONS.map((o, i) => (
            <span key={o.id} className="f34-seg__item">
              {i > 0 && o.round !== OPTIONS[i - 1].round && <span className="f34-seg__sep" aria-hidden="true" />}
              <button
                type="button"
                className={!compare && sel === o.id ? 'is-active' : ''}
                aria-pressed={!compare && sel === o.id}
                onClick={() => { setSel(o.id); setCompare(false); }}
                title={`${o.name}${o.round === 2 ? ' (round 2)' : ''}`}
              >
                {o.id}
              </button>
            </span>
          ))}
          <button
            type="button"
            className={compare ? 'is-active' : ''}
            aria-pressed={compare}
            onClick={() => setCompare(true)}
          >
            Compare
          </button>
        </div>
        {!compare && (
          <div className="f34-seg" role="group" aria-label="View">
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                className={mode === m.id ? 'is-active' : ''}
                aria-pressed={mode === m.id}
                onClick={() => setMode(m.id)}
              >
                {m.label}
              </button>
            ))}
          </div>
        )}
        <label className="f34-toggle">
          <input type="checkbox" checked={grey} onChange={(e) => setGrey(e.target.checked)} />
          Greyscale
        </label>
      </div>

      {compare ? (
        <section className="f34-compare">
          {[0, 1].map((i) => {
            const o = byId[pair[i]];
            return (
              <div key={i} className="f34-compare__col">
                <label className="f34-compare__pick">
                  <span>Option</span>
                  <select
                    value={pair[i]}
                    onChange={(e) => setPair((p) => (i === 0 ? [e.target.value, p[1]] : [p[0], e.target.value]))}
                  >
                    {OPTIONS.map((x) => <option key={x.id} value={x.id}>{x.id} · {x.name}</option>)}
                  </select>
                </label>
                <Figure opt={o} mode="page" grey={grey} />
                <Scorecard opt={o} />
                <p className="f34-compare__concept">{o.concept}</p>
              </div>
            );
          })}
        </section>
      ) : (
        <>
          <p className="f34-caption-note">
            Option {opt.id} · {opt.name} · {MODES.find((m) => m.id === mode).label.toLowerCase()}
            {mode === 'true' && ' (144.6 mm wide, as printed; depends on your screen reporting its size correctly)'}
          </p>
          <Figure opt={opt} mode={mode} grey={grey} />
          <OptionDetail opt={opt} />
        </>
      )}

      <section className="f34-reco pt-card">
        <h3>Claude’s recommendation <span>(James decides)</span></h3>
        <p className="f34-reco__pick">Option {RECOMMENDATION.id}: {byId[RECOMMENDATION.id].name}</p>
        <ul>{RECOMMENDATION.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
        {RECOMMENDATION.note && <p className="f34-reco__note">{RECOMMENDATION.note}</p>}
      </section>
    </div>
  );
}
