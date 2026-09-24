import { useCallback, useEffect, useMemo, useState } from 'react';
import Icon from '../../icons';
import { listPapers, deletePaper, restorePaper } from '../../data/papersApi';
import { loadLocalProgress, newerProgress, estimateMinutes } from './settings';

/* ============================================================================
   RSVP PAPERS — the library (shelf of saved papers + the Bin)
   ----------------------------------------------------------------------------
   Ruled rows: title / authors · year, a labelled status dot (complete /
   uploading), words + minutes at the current speed, a hairline progress bar
   and a mono counter. Soft-deleted papers sit in a collapsed Bin below with
   restore / delete-forever (two-step, inline — no browser dialogs).
   ========================================================================== */

const fmt = (n) => (n ?? 0).toLocaleString();

function progressOf(p) {
  const local = loadLocalProgress(p.id);
  const best = newerProgress(p.progress, local);
  if (!best) return { pct: 0, finished: false, started: false };
  return { pct: best.finished ? 100 : Math.min(100, Math.max(0, best.pct || 0)), finished: Boolean(best.finished), started: true };
}

export default function Library({ settings, onOpen }) {
  const [papers, setPapers] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [note, setNote] = useState('');
  const [binOpen, setBinOpen] = useState(false);
  const [confirm, setConfirm] = useState(null); // { id, action: 'bin' | 'purge' }

  const load = useCallback((cancelledRef) =>
    listPapers().then(({ data, error }) => {
      if (cancelledRef?.current) return;
      if (error) { setPapers([]); setStatus('error'); setNote(error.message); }
      else { setPapers(data || []); setStatus('ready'); setNote(''); }
    }), []);

  useEffect(() => {
    const cancelledRef = { current: false };
    load(cancelledRef);
    return () => { cancelledRef.current = true; };
  }, [load]);

  const refresh = () => { setStatus('loading'); load(); };

  const act = async (id, action) => {
    if (action === 'bin') await deletePaper(id);
    else if (action === 'purge') await deletePaper(id, { permanent: true });
    else if (action === 'restore') await restorePaper(id);
    setConfirm(null);
    load();
  };

  const live = useMemo(() => (papers || []).filter((p) => !p.deletedAt), [papers]);
  const binned = useMemo(() => (papers || []).filter((p) => p.deletedAt), [papers]);
  const totals = useMemo(() => ({
    words: live.reduce((a, p) => a + (p.wordCount || 0), 0),
    complete: live.filter((p) => p.status === 'complete').length,
  }), [live]);

  return (
    <div className="pt-module rsv rsv-lib">
      <div>
        <p className="pres-kicker">Personal · RSVP Papers</p>
        <p className="pt-module__intro">
          Research papers, one word at a time. Upload a PDF to a Claude chat with the <strong>Personal Portal</strong> connector
          and ask it to save the paper here — it cleans the text, keeps the reading order, and the paper lands on this shelf
          with its own link. Speed, slowdowns and pause cards are yours to tune; progress is saved per paper.
        </p>
      </div>

      {/* ── Shelf header ─────────────────────────────────────────────── */}
      <div className="rsv-lib__bar">
        <p className="rsv-lib__stats">
          <span>{live.length} {live.length === 1 ? 'paper' : 'papers'}</span>
          <span>{fmt(totals.words)} words</span>
          <span>{totals.complete} complete</span>
          <span>{settings.wpm} wpm</span>
        </p>
        <button type="button" className="rsv-btn" onClick={refresh} disabled={status === 'loading'}>
          <Icon name="swap" size={14} />{status === 'loading' ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {status === 'error' && (
        <p className="rsv-note"><span className="rsv-dot rsv-dot--error" aria-hidden="true" />{note}</p>
      )}

      {/* ── Rows ─────────────────────────────────────────────────────── */}
      {papers && live.length === 0 && status !== 'loading' && (
        <div className="rsv-empty">
          <p className="rsv-empty__kicker"><span className="rsv-dot rsv-dot--idle" aria-hidden="true" />No papers yet</p>
          <ol className="rsv-steps">
            <li><span className="rsv-steps__n">01</span>Open a Claude chat that has the <strong>Personal Portal</strong> connector enabled.</li>
            <li><span className="rsv-steps__n">02</span>Upload the PDF and ask: “Save this paper to my RSVP reader.” Claude parses it and calls <code>save_paper</code>, then <code>append_sections</code> for the rest.</li>
            <li><span className="rsv-steps__n">03</span>Open the link it returns (or refresh this shelf) and press <kbd>space</kbd>.</li>
          </ol>
        </div>
      )}

      {live.length > 0 && (
        <ul className="rsv-rows" aria-label="Papers">
          {live.map((p) => {
            const prog = progressOf(p);
            const isConfirm = confirm?.id === p.id && confirm.action === 'bin';
            return (
              <li key={p.id} className="rsv-row">
                <button type="button" className="rsv-row__open" onClick={() => onOpen(p.id)}>
                  <span className="rsv-row__title">{p.title}</span>
                  <span className="rsv-row__meta">
                    {(p.authors || []).slice(0, 3).join(', ')}{(p.authors || []).length > 3 ? ' et al.' : ''}
                    {p.year ? ` · ${p.year}` : ''}
                  </span>
                </button>
                <span className="rsv-row__status">
                  <span className={`rsv-dot rsv-dot--${p.status === 'complete' ? 'complete' : 'uploading'}`} aria-hidden="true" />
                  {p.status === 'complete' ? 'Complete' : `Uploading · ${p.sectionCount} sec`}
                </span>
                <span className="rsv-row__num">
                  {fmt(p.wordCount)} w · ~{estimateMinutes(p.wordCount, settings.wpm)} min
                  {p.appendixWordCount > 0 && <span className="rsv-row__sub">{fmt(p.mainWordCount)} main · {fmt(p.appendixWordCount)} appx</span>}
                </span>
                <span className="rsv-row__prog" aria-label={`${prog.pct}% read`}>
                  <span className="rsv-bar"><span className="rsv-bar__fill" style={{ width: `${prog.pct}%` }} /></span>
                  <span className="rsv-row__pct">{prog.finished ? 'done' : prog.started ? `${Math.round(prog.pct)}%` : 'new'}</span>
                </span>
                <span className="rsv-row__actions">
                  {isConfirm ? (
                    <>
                      <button type="button" className="rsv-link rsv-link--warn" onClick={() => act(p.id, 'bin')}>Move to Bin</button>
                      <button type="button" className="rsv-link" onClick={() => setConfirm(null)}>Keep</button>
                    </>
                  ) : (
                    <button type="button" className="rsv-link" onClick={() => setConfirm({ id: p.id, action: 'bin' })}>Delete</button>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {/* ── Bin ──────────────────────────────────────────────────────── */}
      {binned.length > 0 && (
        <div className="rsv-bin">
          <button type="button" className="rsv-bin__head" onClick={() => setBinOpen((o) => !o)} aria-expanded={binOpen}>
            <span className={`rsv-bin__caret${binOpen ? ' rsv-bin__caret--open' : ''}`}><Icon name="chevron" size={12} /></span>
            Bin <span className="rsv-bin__count">{binned.length}</span>
          </button>
          {binOpen && (
            <ul className="rsv-rows rsv-rows--bin" aria-label="Deleted papers">
              {binned.map((p) => {
                const isConfirm = confirm?.id === p.id && confirm.action === 'purge';
                return (
                  <li key={p.id} className="rsv-row rsv-row--bin">
                    <span className="rsv-row__open rsv-row__open--static">
                      <span className="rsv-row__title">{p.title}</span>
                      <span className="rsv-row__meta">deleted {new Date(p.deletedAt).toLocaleDateString()} · {fmt(p.wordCount)} w</span>
                    </span>
                    <span className="rsv-row__actions rsv-row__actions--bin">
                      <button type="button" className="rsv-link" onClick={() => act(p.id, 'restore')}>Restore</button>
                      {isConfirm ? (
                        <>
                          <button type="button" className="rsv-link rsv-link--warn" onClick={() => act(p.id, 'purge')}>Delete forever</button>
                          <button type="button" className="rsv-link" onClick={() => setConfirm(null)}>Cancel</button>
                        </>
                      ) : (
                        <button type="button" className="rsv-link" onClick={() => setConfirm({ id: p.id, action: 'purge' })}>Delete forever…</button>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
