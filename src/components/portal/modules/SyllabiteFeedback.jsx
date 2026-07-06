import { useState, useCallback, useEffect } from 'react';
import Icon from '../icons';
import { listSyllabiteFeedback } from '../data/feedbackApi';

/* ============================================================================
   SYLLABITE FEEDBACK — live submissions  (Syllabite section)
   ----------------------------------------------------------------------------
   Reads the `syllabite_feedback` table straight from Supabase, server-side,
   through the portal Worker (GET /api/syllabite-feedback via data/feedbackApi.js).
   The table has RLS ON with NO policies, so the browser's anon key can't read it
   — the Worker reads with the secret key and the endpoint is password-gated.

   NB: the /api layer only exists under the Worker — locally that's
   `npm run cf:dev` (wrangler), or the deployed site. Plain `npm run dev` (vite)
   has no Worker, so the fetch 404s there.

   Styled with the shared .syl-fb-* classes in portal.css (portal tokens → themes
   for free).
   ========================================================================== */

// Filter chips.
const FEEDBACK_TYPES = [
  { id: 'all',     label: 'All' },
  { id: 'report',  label: 'Reports' },
  { id: 'request', label: 'Requests' },
  { id: 'other',   label: 'Other' },
];

// Format an ISO timestamp for display (browser runtime — Date is fine here).
function formatFeedbackDate(iso) {
  try {
    return new Date(iso).toLocaleString('en-AU', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso ?? '';
  }
}

// One feedback submission.
function FeedbackCard({ row }) {
  return (
    <article className={`pt-card syl-fb${row.resolved ? ' syl-fb--resolved' : ''}`}>
      <header className="syl-fb__head">
        <span className={`syl-fb__type syl-fb__type--${row.type}`}>{row.type}</span>
        {row.resolved && <span className="syl-fb__resolved"><Icon name="check" size={11} /> resolved</span>}
        <time className="syl-fb__date">{formatFeedbackDate(row.created_at)}</time>
      </header>
      <p className="syl-fb__msg">{row.message}</p>
      {(row.page_path || row.contact || row.user_agent) && (
        <footer className="syl-fb__meta">
          {row.page_path && <span className="syl-fb__meta-item">{row.page_path}</span>}
          {row.contact && <span className="syl-fb__meta-item syl-fb__meta-item--contact">{row.contact}</span>}
          {row.user_agent && (
            <span className="syl-fb__meta-item syl-fb__ua" title={row.user_agent}>{row.user_agent}</span>
          )}
        </footer>
      )}
    </article>
  );
}

export default function SyllabiteFeedback() {
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'error'
  const [rows, setRows] = useState([]);
  const [error, setError] = useState(null);
  const [typeFilter, setTypeFilter] = useState('all');

  // Fold a { data, error } result into the view state.
  const applyResult = useCallback(({ data, error: err }) => {
    if (err) {
      setError(err.message);
      setStatus('error');
      setRows([]);
    } else {
      setRows(data ?? []);
      setError(null);
      setStatus('ready');
    }
  }, []);

  // Refresh button — an event handler, so setting "loading" up front is fine.
  const refresh = useCallback(async () => {
    setStatus('loading');
    setError(null);
    applyResult(await listSyllabiteFeedback());
  }, [applyResult]);

  // Initial load: setState runs in the promise callback (after await), not
  // synchronously in the effect body. `cancelled` guards against unmount.
  useEffect(() => {
    let cancelled = false;
    listSyllabiteFeedback().then((res) => {
      if (!cancelled) applyResult(res);
    });
    return () => {
      cancelled = true;
    };
  }, [applyResult]);

  const visible = typeFilter === 'all' ? rows : rows.filter((r) => r.type === typeFilter);

  return (
    <div className="pt-module syl">
      <p className="pt-module__intro">
        Live submissions from the Syllabite site — read straight from Supabase, server-side, through the
        portal Worker.
      </p>

      <div className="syl-fb-toolbar">
        <div className="syl-fb-filters" role="group" aria-label="Filter feedback by type">
          {FEEDBACK_TYPES.map((t) => {
            const count = t.id === 'all' ? rows.length : rows.filter((r) => r.type === t.id).length;
            return (
              <button
                key={t.id}
                className={`syl-fb-filter${typeFilter === t.id ? ' syl-fb-filter--active' : ''}`}
                aria-pressed={typeFilter === t.id}
                onClick={() => setTypeFilter(t.id)}
              >
                {t.label}<span className="syl-fb-filter__n">{count}</span>
              </button>
            );
          })}
        </div>
        <button className="syl-fb-refresh" onClick={refresh} disabled={status === 'loading'}>
          <Icon name="swap" size={14} /> {status === 'loading' ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {status === 'loading' && <p className="pt-loading">Loading feedback…</p>}

      {status === 'error' && (
        <div className="pt-card syl-fb-error">
          <p>Couldn’t load feedback.</p>
          <p className="syl-fb-error__msg">{error}</p>
        </div>
      )}

      {status === 'ready' && visible.length === 0 && (
        <div className="pt-card syl-fb-empty">
          No {typeFilter === 'all' ? '' : `${typeFilter} `}feedback yet.
        </div>
      )}

      {status === 'ready' && visible.length > 0 && (
        <div className="syl-fb-list">
          {visible.map((r) => <FeedbackCard key={r.id} row={r} />)}
        </div>
      )}
    </div>
  );
}
