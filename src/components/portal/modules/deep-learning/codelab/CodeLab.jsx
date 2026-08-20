import { useEffect, useMemo, useRef, useState } from 'react';
import { Code } from '../kit';
import { ENTRIES, LECTURES } from './entries';
import '../common.css';
import './codelab.css';

/* ============================================================================
   CITS5017 · CODE LAB — every code example from the decks, searchable
   ----------------------------------------------------------------------------
   Built for TEST SPEED: one page, no tabs, no clicks required —

     · the search bar is sticky, autofocused, and "/" refocuses it from
       anywhere on the page (Esc clears);
     · every keystroke re-ranks instantly (title > keywords/topic > note >
       code body — every term must match somewhere);
     · quick-chips fire the highest-value exam searches in one click;
     · every card = topic tag + slide receipt + the one-line exam answer +
       the VERBATIM slide code in the kit's editor block + a copy button.

   All entries live in ./entries.js (adding one = one object). Blocks are
   verbatim from Documents/cits5017/markdown-lecs/; the two restated-from-
   slide-text entries wear a "from slide text" badge.
   ========================================================================== */

const QUICK = ['he_normal', 'leaky relu', 'batch norm', 'clipnorm', 'transfer learning', 'adam', 'momentum', 'scheduling', 'dropout', 'l2', 'perceptron', 'conv shapes'];

const norm = (s) => s.toLowerCase();
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Every term must hit somewhere; the strongest field it hits sets its score.
function scoreEntry(entry, terms) {
  let score = 0;
  for (const t of terms) {
    let s = 0;
    if (norm(entry.title).includes(t)) s = 4;
    else if (entry.keywords.some((k) => norm(k).includes(t)) || norm(entry.topic).includes(t)) s = 3;
    else if (norm(entry.note).includes(t)) s = 2;
    else if (norm(entry.code).includes(t) || norm(entry.label).includes(t)) s = 1;
    if (s === 0) return 0;
    score += s;
  }
  return score;
}

function Hi({ text, terms }) {
  if (!terms.length) return text;
  const re = new RegExp(`(${terms.map(escapeRe).join('|')})`, 'gi');
  const parts = String(text).split(re);
  return parts.map((p, i) => (i % 2 === 1 ? <mark key={i} className="dlc-hi">{p}</mark> : p));
}

function EntryCard({ entry, terms }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = () => {
    navigator.clipboard?.writeText(entry.code).then(() => {
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1400);
    });
  };

  return (
    <article className="dlc-card" id={`dlc-${entry.id}`}>
      <header className="dlc-card__head">
        <span className="dlc-card__topic">{entry.topic}</span>
        <h4 className="dlc-card__title"><Hi text={entry.title} terms={terms} /></h4>
        {entry.derived && <span className="dlc-card__derived" title="Restated from the slide's text — the slide had no code block">from slide text</span>}
        <span className="dlc-card__where">L{entry.lecture} · {entry.slide}</span>
        <button type="button" className={`dl-btn dlc-copy${copied ? ' dlc-copy--done' : ''}`} onClick={copy}>
          {copied ? '✓ copied' : 'copy'}
        </button>
      </header>
      <p className="dlc-card__note"><Hi text={entry.note} terms={terms} /></p>
      <Code code={entry.code} label={entry.label} meta={`${LECTURES[entry.lecture]} · ${entry.slide}`} />
    </article>
  );
}

export default function CodeLab() {
  const [query, setQuery] = useState('');
  const [lecture, setLecture] = useState(0); // 0 = all
  const inputRef = useRef(null);

  // "/" refocuses the search from anywhere on the page; Esc clears it.
  useEffect(() => {
    const onKey = (e) => {
      const inField = /^(INPUT|TEXTAREA)$/.test(document.activeElement?.tagName ?? '');
      if (e.key === '/' && !inField) {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
      if (e.key === 'Escape' && document.activeElement === inputRef.current) {
        setQuery('');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const terms = useMemo(() => norm(query).split(/\s+/).filter(Boolean), [query]);

  const results = useMemo(() => {
    const pool = lecture === 0 ? ENTRIES : ENTRIES.filter((en) => en.lecture === lecture);
    if (!terms.length) return pool.map((en) => ({ entry: en, score: 0 }));
    return pool
      .map((en) => ({ entry: en, score: scoreEntry(en, terms) }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score);
  }, [terms, lecture]);

  const searching = terms.length > 0;

  return (
    <div className="pt-module dl dlc">
      <div className="pt-card dlc-hero">
        <div>
          <p className="dl-hero__kicker">CITS5017 · every code block from the Topic 1–3 decks</p>
          <h3 className="dlc-hero__title">Code Lab</h3>
          <p className="dlc-hero__lead">
            Type what the question is about — <em>batch norm</em>, <em>clipnorm</em>,{' '}
            <em>freeze</em> — and the slide's exact code is on screen. Press{' '}
            <kbd className="dlc-kbd">/</kbd> to search from anywhere, <kbd className="dlc-kbd">Esc</kbd> to clear.
          </p>
        </div>
        <div className="dlc-hero__stats">
          <span><b>{ENTRIES.length}</b> code blocks</span>
          <span><b>3</b> lectures</span>
          <span><b>1</b> search away</span>
        </div>
      </div>

      {/* ── Sticky search ─────────────────────────────────────────────── */}
      <div className="dlc-search">
        <div className="dlc-search__row">
          <svg viewBox="0 0 20 20" className="dlc-search__icon" aria-hidden="true">
            <circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" strokeWidth="2" />
            <line x1="12.8" y1="12.8" x2="17.5" y2="17.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <input
            ref={inputRef}
            type="search"
            className="dlc-search__input"
            placeholder="Search the lecture code — try “batch norm”, “freeze”, “kernel_initializer”…"
            value={query}
            autoFocus
            spellCheck={false}
            aria-label="Search code examples"
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button type="button" className="dlc-search__clear" onClick={() => { setQuery(''); inputRef.current?.focus(); }} aria-label="Clear search">
              ×
            </button>
          )}
          <span className="dlc-search__count">
            {results.length}/{lecture === 0 ? ENTRIES.length : ENTRIES.filter((en) => en.lecture === lecture).length}
          </span>
        </div>
        <div className="dlc-search__filters">
          <div className="dl-chips">
            {[0, 1, 2, 3].map((l) => (
              <button
                key={l}
                type="button"
                className={`dl-chip${lecture === l ? ' dl-chip--on' : ''}`}
                onClick={() => setLecture(l)}
                aria-pressed={lecture === l}
              >
                {l === 0 ? 'All lectures' : LECTURES[l]}
              </button>
            ))}
          </div>
          <div className="dl-chips dlc-quick">
            {QUICK.map((q) => (
              <button
                key={q}
                type="button"
                className={`dl-chip dl-chip--ghost${norm(query) === norm(q) ? ' dl-chip--on' : ''}`}
                onClick={() => { setQuery(query === q ? '' : q); inputRef.current?.focus(); }}
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Results ───────────────────────────────────────────────────── */}
      {results.length === 0 ? (
        <div className="pt-card dlc-empty">
          <p className="dlc-empty__big">No code block matches “{query}”.</p>
          <p className="dl-body">
            The decks only contain so much code — try a broader term ({QUICK.slice(0, 4).join(' · ')}),
            or clear a lecture filter. Concept questions without code live in the lecture tabs.
          </p>
        </div>
      ) : searching ? (
        <div className="dlc-list">
          {results.map(({ entry }) => (
            <EntryCard key={entry.id} entry={entry} terms={terms} />
          ))}
        </div>
      ) : (
        [1, 2, 3]
          .filter((l) => lecture === 0 || lecture === l)
          .map((l) => (
            <section key={l} className="dlc-group">
              <header className="dlc-group__head">
                <span className="dlc-group__no">{String(l).padStart(2, '0')}</span>
                <h4 className="dlc-group__title">{LECTURES[l]}</h4>
                <span className="dlc-group__count">
                  {ENTRIES.filter((en) => en.lecture === l).length} blocks
                </span>
              </header>
              <div className="dlc-list">
                {results
                  .filter(({ entry }) => entry.lecture === l)
                  .map(({ entry }) => (
                    <EntryCard key={entry.id} entry={entry} terms={terms} />
                  ))}
              </div>
            </section>
          ))
      )}
    </div>
  );
}
