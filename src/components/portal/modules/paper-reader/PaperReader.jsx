import { useCallback, useEffect, useState } from 'react';
import './paper-reader.css';
import Icon from '../../icons';
import { usePortalRoute } from '../../portalRoute';
import { getPaper } from '../../data/papersApi';
import Library from './Library';
import Reader from './Reader';
import { loadSettings, saveSettings } from './settings';

/* ============================================================================
   RSVP PAPERS — research-paper speed-reader  (Personal)
   ----------------------------------------------------------------------------
   Words flash one at a time at a fixed point, at an adjustable speed, with the
   focal letter marked. Papers arrive through the portal MCP server: the chat
   Claude parses a PDF into clean, ordered sections and calls save_paper /
   append_sections; the result is a deep link straight to the reader:

       /portal/paper-rsvp/<paperId>

   This root switches on that sub-route (see portalRoute.js): no id → the
   library; an id → load the paper and mount the Reader. Settings (wpm,
   slowdowns, …) are per browser; progress is per paper (server + local).

   Files: timeline.js (pure engine: sections → items, ORP, timing), usePlayer.js
   (the clock), Reader.jsx (stage, transport, cards, contents, context),
   PauseCard.jsx (figure / table / equation / algorithm), Library.jsx (shelf +
   Bin), settings.js (persistence), mdTable.js (markdown table → rows).
   ========================================================================== */
export default function PaperReader() {
  const { sub, setSub } = usePortalRoute();
  const paperId = sub ? sub.split('/')[0] : '';

  const [settings, setSettings] = useState(loadSettings);
  useEffect(() => { saveSettings(settings); }, [settings]);
  const updateSettings = useCallback(
    (patch) => setSettings((s) => ({ ...s, ...(typeof patch === 'function' ? patch(s) : patch) })),
    [],
  );

  const openPaper = useCallback((id) => setSub(id), [setSub]);
  const backToLibrary = useCallback(() => setSub(''), [setSub]);

  if (paperId) {
    return (
      <ReaderLoader
        key={paperId}
        id={paperId}
        settings={settings}
        onSettings={updateSettings}
        onBack={backToLibrary}
      />
    );
  }
  return <Library settings={settings} onOpen={openPaper} />;
}

// Load one paper (with its sections) then mount the Reader. setState only ever
// runs in the async continuation, satisfying react-hooks/set-state-in-effect.
function ReaderLoader({ id, settings, onSettings, onBack }) {
  const [paper, setPaper] = useState(null);
  const [error, setError] = useState(null);
  const [tick, setTick] = useState(0); // bump to reload (an upload still in progress)

  useEffect(() => {
    let cancelled = false;
    getPaper(id).then(({ data, error: err }) => {
      if (cancelled) return;
      if (err) setError(err);
      else { setError(null); setPaper(data); }
    });
    return () => { cancelled = true; };
  }, [id, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);

  if (error) {
    return (
      <div className="pt-module rsv">
        <button type="button" className="rsv-btn" onClick={onBack}><Icon name="arrowLeft" size={14} /> Library</button>
        <div className="rsv-empty">
          <p className="rsv-empty__kicker"><span className="rsv-dot rsv-dot--error" aria-hidden="true" />Couldn’t open this paper</p>
          <p className="rsv-empty__body">{error.status === 404 ? 'No paper has that id — it may have been permanently deleted.' : error.message}</p>
        </div>
      </div>
    );
  }
  if (!paper) {
    return (
      <div className="pt-module rsv">
        <p className="pt-loading">Loading paper…</p>
      </div>
    );
  }
  return <Reader paper={paper} settings={settings} onSettings={onSettings} onBack={onBack} onReload={reload} />;
}
