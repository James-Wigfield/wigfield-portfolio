/* /dreams/:id: one dream, in every status.
     captured           his text, editable (PATCH raw_text with ifUpdatedAt; 409 → reload)
     reading / building his text, "being read" / "being built"
     failed             his text and the reason
     rendered           the still and an Enter tap → the walk (DreamStage), whose wake lands on
                        /dreams?at=<id>
   After the read, raw_text is frozen and "Remembered more" appends to extra_text.

   Flags: ?autopilot=1 no Enter tap (audio is still unlocked) · ?draft=1 the draft build
   (files.draft) · ?still=1, or world.fallback === 'still' → StillView. */

import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { COPY } from '../copy.js';
import Boundary from '../components/Boundary.jsx';
import StatusDot from '../components/StatusDot.jsx';
import { nightLabel, ownSlice } from '../contracts/rows.js';
import { api, fetchJson } from '../lib/api.js';
import { confirmAuth } from '../lib/auth.js';
import { corridorUrl, dreamUrl, listUrl, readFlags } from '../routes.js';
import { unlockAudio } from '../viewer/audio.js';
import StillView from './StillView.jsx';

const DreamStage = lazy(() => import('../viewer/DreamStage.jsx'));

/** A newer copy of the row merged in (a PATCH answer has no `files`; keep the signed ones). */
const mergeRow = (prev, next) => (next?.id ? { ...prev, ...next, files: next.files || prev?.files } : prev);
const NONE = [];

export default function DreamPage() {
  const { id } = useParams();
  const [attempt, setAttempt] = useState(0);
  const [res, setRes] = useState({ key: null });
  const key = `${id}#${attempt}`;

  useEffect(() => {
    const ctrl = new AbortController();
    api.get(id, { signal: ctrl.signal }).then(
      (row) => setRes({ key, kind: 'ok', row }),
      async (error) => {
        if (error?.name === 'AbortError') return;
        if (await confirmAuth(error)) return;
        setRes({ key, kind: error?.status === 404 || error?.status === 400 ? 'missing' : 'error' });
      },
    );
    return () => ctrl.abort();
  }, [id, key]);

  const current = res.key === key ? res : null;
  const retry = () => setAttempt((a) => a + 1);
  const updateRow = (next) => setRes((r) => (r.kind === 'ok' ? { ...r, row: mergeRow(r.row, next) } : r));

  if (!current || current.kind !== 'ok') {
    return (
      <main className="dr-page dr-dream" data-dr="dream" data-state={current?.kind || 'loading'}>
        <DreamBar id={id} />
        {!current && <p className="dr-line dr-faint">{COPY.dream.loading}</p>}
        {current?.kind === 'missing' && <p className="dr-line">{COPY.dream.missing}</p>}
        {current?.kind === 'error' && (
          <p className="dr-dot" data-status="failed">
            <i aria-hidden="true" />
            {COPY.dream.error}
            <button type="button" className="dr-link" onClick={retry}>
              {COPY.dream.retry}
            </button>
          </p>
        )}
      </main>
    );
  }
  return <DreamView key={current.row.id} row={current.row} onRow={updateRow} />;
}

function DreamBar({ id }) {
  return (
    <nav className="dr-bar" data-dr="dream-bar">
      <Link className="dr-link" to={corridorUrl({ at: id })} data-dr="to-corridor">
        {COPY.dream.corridor}
      </Link>
      <Link className="dr-link" to={listUrl()} data-dr="to-list">
        {COPY.dream.list}
      </Link>
    </nav>
  );
}

function DreamView({ row, onRow }) {
  const [params] = useSearchParams();
  const flags = readFlags(params);
  const [notice, setNotice] = useState(null);
  const status = row.status;
  const splitLocked = Array.isArray(row.own) || (row.split_into || []).length > 0;

  return (
    <main className="dr-page dr-dream" data-dr="dream" data-status={status} data-id={row.id}>
      <DreamBar id={row.id} />
      <header className="dr-dream-head">
        <p className="dr-label">
          {COPY.night.of(nightLabel(row.dreamt_on))} · {COPY.night.dream(row.night_order)}
        </p>
        {row.title && <h1 className="dr-dream-title">{row.title}</h1>}
        <StatusDot status={status} />
      </header>

      {/* ?draft=1 walks the draft build at any status: build.mjs reviews a dream that is still `building` */}
      {(status === 'rendered' || (flags.draft && row.files?.draft)) && <Rendered row={row} flags={flags} />}

      {status === 'failed' && (
        <p className="dr-reason" data-dr="fail-reason">
          <span className="dr-label">{COPY.dream.reason}</span>
          <span>{row.fail_reason || COPY.status.failed}</span>
        </p>
      )}

      {notice && (
        <p className="dr-dot" data-status="captured" role="status">
          <i aria-hidden="true" />
          {notice}
        </p>
      )}

      {status === 'captured' && !splitLocked ? (
        <EditText row={row} onRow={onRow} onFrozen={() => setNotice(COPY.dream.editFrozen)} />
      ) : (
        <Words row={row} />
      )}

      <SplitNotes row={row} />

      {status !== 'captured' && <RememberMore row={row} onRow={onRow} />}
    </main>
  );
}

/** His words, read-only: this row's own slice of raw_text, then anything remembered later. */
function Words({ row }) {
  const text = ownSlice(row);
  const extra = (row.extra_text || '').trim();
  return (
    <section className="dr-words" data-dr="words">
      <h2 className="dr-label">{COPY.dream.yourWords}</h2>
      <p className="dr-text" data-dr="raw-text">
        {text}
      </p>
      {extra && (
        <>
          <h2 className="dr-label">{COPY.dream.rememberedLater}</h2>
          <p className="dr-text" data-dr="extra-text">
            {extra}
          </p>
        </>
      )}
    </section>
  );
}

function SplitNotes({ row }) {
  const kids = row.split_into || [];
  if (!kids.length && !row.split_from) return null;
  return (
    <p className="dr-line dr-faint dr-split" data-dr="split">
      {kids.length > 0 && (
        <>
          {COPY.dream.splitNote}
          {kids.map((k) => (
            <Link key={k} className="dr-link" to={dreamUrl(k)}>
              {COPY.dream.splitOpen}
            </Link>
          ))}
        </>
      )}
      {row.split_from && (
        <>
          {COPY.dream.splitFrom}
          <Link className="dr-link" to={dreamUrl(row.split_from)}>
            {COPY.dream.splitOpen}
          </Link>
        </>
      )}
    </p>
  );
}

/** captured: his text stays editable until it's read. */
function EditText({ row, onRow, onFrozen }) {
  const [text, setText] = useState(row.raw_text || '');
  const [state, setState] = useState('idle'); // idle | saving | saved | conflict | error
  const dirty = text !== (row.raw_text || '');

  async function save() {
    if (!dirty || state === 'saving') return;
    setState('saving');
    try {
      onRow(await api.patch(row.id, { raw_text: text, ifUpdatedAt: row.updated_at }));
      setState('saved');
    } catch (err) {
      if (await confirmAuth(err)) return;
      if (err?.status === 409) {
        const fresh = await api.get(row.id).catch(() => null);
        if (fresh) onRow(fresh);
        if (fresh && fresh.status !== 'captured') onFrozen();
        setState('conflict');
      } else {
        setState('error');
      }
    }
  }

  const line = { saved: COPY.dream.editSaved, conflict: COPY.dream.editConflict, error: COPY.dream.editError }[state];
  return (
    <section className="dr-words" data-dr="edit">
      <label className="dr-label" htmlFor="dr-edit-text">
        {COPY.dream.yourWords}
      </label>
      <textarea
        id="dr-edit-text"
        className="dr-edit"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          if (state !== 'saving') setState('idle');
        }}
        maxLength={20000}
        rows={Math.min(24, Math.max(6, Math.ceil(text.length / 60) + 2))}
        data-dr="edit-text"
      />
      <div className="dr-actions">
        <button type="button" className="dr-btn" onClick={save} disabled={!dirty || state === 'saving'} data-dr="edit-save">
          {state === 'saving' ? COPY.dream.savingEdit : COPY.dream.saveEdit}
        </button>
        {line && (
          <span className="dr-dot" data-status={state === 'saved' ? 'rendered' : 'failed'} data-dr="edit-state" data-state={state}>
            <i aria-hidden="true" />
            {line}
          </span>
        )}
      </div>
    </section>
  );
}

/** After the read: raw_text is frozen; "Remembered more" appends to extra_text (the next read takes it in). */
function RememberMore({ row, onRow }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [state, setState] = useState('idle'); // idle | saving | saved | conflict | error

  async function add() {
    const more = text.trim();
    if (!more || state === 'saving') return;
    const before = (row.extra_text || '').trim();
    setState('saving');
    try {
      onRow(await api.patch(row.id, { extra_text: before ? `${before}\n\n${more}` : more, ifUpdatedAt: row.updated_at }));
      setText('');
      setState('saved');
    } catch (err) {
      if (await confirmAuth(err)) return;
      if (err?.status === 409) {
        const fresh = await api.get(row.id).catch(() => null);
        if (fresh) onRow(fresh);
        setState('conflict');
      } else {
        setState('error');
      }
    }
  }

  if (!open) {
    return (
      <section className="dr-more" data-dr="remember">
        <button type="button" className="dr-link dr-more-open" onClick={() => setOpen(true)} data-dr="remember-open">
          {COPY.dream.rememberMore}
        </button>
      </section>
    );
  }
  const line = { saved: COPY.dream.rememberSaved, conflict: COPY.dream.editConflict, error: COPY.dream.editError }[state];
  return (
    <section className="dr-more" data-dr="remember" data-open="1">
      <label className="dr-label" htmlFor="dr-more-text">
        {COPY.dream.rememberMore}
      </label>
      <textarea
        id="dr-more-text"
        className="dr-edit"
        value={text}
        placeholder={COPY.dream.rememberHint}
        onChange={(e) => {
          setText(e.target.value);
          if (state !== 'saving') setState('idle');
        }}
        maxLength={20000}
        rows={5}
        autoFocus
        data-dr="remember-text"
      />
      <div className="dr-actions">
        <button type="button" className="dr-btn" onClick={add} disabled={!text.trim() || state === 'saving'} data-dr="remember-save">
          {state === 'saving' ? COPY.dream.rememberSaving : COPY.dream.rememberSave}
        </button>
        {line && (
          <span className="dr-dot" data-status={state === 'saved' ? 'rendered' : 'failed'} data-dr="remember-state">
            <i aria-hidden="true" />
            {line}
          </span>
        )}
      </div>
    </section>
  );
}

/** Keeps the page under a full-screen stage from scrolling. */
function useScrollLock(on) {
  useEffect(() => {
    if (!on) return undefined;
    const html = document.documentElement;
    html.classList.add('dr-locked');
    return () => html.classList.remove('dr-locked');
  }, [on]);
}

/** The draft build's world (?draft=1): fetched from its signed URL. */
function useDraftWorld(row, on) {
  const draft = row.files?.draft || null;
  const url = on ? draft?.world_url || null : null;
  const [res, setRes] = useState({ url: null });
  useEffect(() => {
    if (!url) return undefined;
    const ctrl = new AbortController();
    fetchJson(url, { signal: ctrl.signal }).then(
      (world) => setRes({ url, world }),
      (error) => error?.name !== 'AbortError' && setRes({ url, error }),
    );
    return () => ctrl.abort();
  }, [url]);
  if (!on) return { world: null };
  if (!url) return { missing: true };
  if (res.url !== url) return { loading: true };
  return res.error ? { missing: true } : { world: res.world, model_url: draft.model_url || null, stills: draft.stills?.length ? draft.stills : null };
}

/** rendered: the still and an Enter tap, then the walk (or the stills, for a fallback dream). */
function Rendered({ row, flags }) {
  const navigate = useNavigate();
  const draft = useDraftWorld(row, flags.draft);
  const world = flags.draft ? draft.world : row.world;
  const model_url = flags.draft ? draft.model_url : row.files?.model_url || null;
  const stills = (flags.draft && draft.stills) || row.files?.stills || NONE;
  const stillOnly = flags.still || world?.fallback === 'still';
  const [entered, setEntered] = useState(flags.autopilot);
  const [stageState, setStageState] = useState(null);
  const mood = row.dream?.mood || null;
  const dream = useMemo(() => ({ id: row.id, world, model_url, stills, mood }), [row.id, world, model_url, stills, mood]);
  const open = entered && Boolean(world);
  useScrollLock(open || flags.still);

  // ?autopilot=1 skips the tap; audio is still unlocked (a browser may keep it muted without a gesture).
  useEffect(() => {
    if (flags.autopilot) unlockAudio();
  }, [flags.autopilot]);

  // Esc leaves the walk (there's no HUD to leave by).
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && setEntered(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const wake = (id) => navigate(corridorUrl({ at: id || row.id }));

  function enter() {
    unlockAudio(); // synchronously, inside the tap: iOS only unlocks audio inside a gesture
    setEntered(true);
  }

  const stillUrl = row.files?.still_url || stills[0]?.url || null;

  if (flags.still || (open && stillOnly)) {
    return (
      <div className="dr-overlay" data-dr="stage" data-kind="still">
        <StillView id={row.id} world={world || row.world} stills={stills} autopilot={flags.autopilot} soundOn={entered} onWake={wake} />
      </div>
    );
  }

  return (
    <>
      <figure className="dr-hero" data-dr="hero">
        {stillUrl ? <img className="dr-hero-img" src={stillUrl} alt="" data-dr="still" /> : <div className="dr-hero-img dr-hero-blank" />}
        {world ? (
          <button type="button" className="dr-enter" onClick={enter} data-dr="enter">
            {COPY.dream.enter}
          </button>
        ) : (
          <figcaption className="dr-line dr-faint dr-hero-note">
            {flags.draft && draft.loading ? COPY.dream.loading : flags.draft && draft.missing ? COPY.dream.noDraft : COPY.dream.nothingToWalk}
          </figcaption>
        )}
        {world && (
          <figcaption className="dr-label dr-hero-cap">
            {flags.draft ? `${COPY.dream.draftLabel} · ` : ''}
            {COPY.dream.enterHint}
          </figcaption>
        )}
      </figure>
      {open && (
        <div className="dr-overlay" data-dr="stage" data-kind="walk" data-state={stageState || 'loading'}>
          <Boundary
            fallback={
              <p className="dr-corridor-msg dr-dot" data-status="failed">
                <i aria-hidden="true" />
                {COPY.dream.stageError}
              </p>
            }
          >
            <Suspense fallback={null}>
              <DreamStage mode="dream" dream={dream} autopilot={flags.autopilot} onWake={wake} onState={setStageState} />
            </Suspense>
          </Boundary>
        </div>
      )}
    </>
  );
}
