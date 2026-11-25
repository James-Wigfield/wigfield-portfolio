/* /dreams/new: capture, phone first, 6 am, half awake (build-prompt "Capture flow", decision 13,
   framework Change B).

   One screen: a big, dark, already-focused textarea (iOS keyboard dictation works in it with no
   code; no Web Speech API). Every input autosaves to IndexedDB (the dot). ONE big Save at the
   thumb stamps the night (the before-2-pm rule unless the night chip was changed) and moves the
   draft to the outbox, which uploads when there's signal. Then: "Another dream from the same
   night", the same date and the next night_order (the server renumbers collisions anyway).

   "Add to Home Screen" from here opens /dreams/new (the manifest + Apple tags below). */

import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { COPY } from '../copy.js';
import { dreamtOnFor, isoDate, nightLabel } from '../contracts/rows.js';
import { api } from '../lib/api.js';
import { useHeadTags, useOutbox, useVisualViewport } from '../lib/hooks.js';
import { del, get, getAll, isVolatile, put } from '../lib/idb.js';
import { addDream, nextNightOrder, rememberList, retryOutbox } from '../lib/outbox.js';
import { uuid } from '../lib/uuid.js';
import { MANIFEST_URL, TOUCH_ICON_URL, corridorUrl, listUrl } from '../routes.js';

const STALE_EMPTY_DRAFT_MS = 12 * 3600 * 1000; // an untouched "another dream" draft from a past night starts fresh
const MAX_TEXT = 20000;

const freshDraft = (dreamtOn = null) => ({ id: uuid(), text: '', dreamt_on: dreamtOn, chosen: Boolean(dreamtOn) });

const HEAD = [
  { tag: 'link', rel: 'manifest', href: MANIFEST_URL },
  { tag: 'meta', name: 'apple-mobile-web-app-capable', content: 'yes' },
  { tag: 'meta', name: 'mobile-web-app-capable', content: 'yes' },
  { tag: 'meta', name: 'apple-mobile-web-app-status-bar-style', content: 'black' },
  { tag: 'meta', name: 'apple-mobile-web-app-title', content: 'Dreams' },
  { tag: 'link', rel: 'apple-touch-icon', href: TOUCH_ICON_URL },
];

/** The clock, refreshed each minute and when the tab comes back (the night rule depends on it). */
function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const tick = () => setNow(new Date());
    const id = setInterval(tick, 60_000);
    const onVis = () => document.visibilityState === 'visible' && tick();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);
  return now;
}

export default function CapturePage() {
  useHeadTags(HEAD);
  const now = useNow();
  const outbox = useOutbox();
  const vv = useVisualViewport();
  const textRef = useRef(null);
  const chain = useRef(Promise.resolve());
  const seq = useRef(0);

  const [draft, setDraft] = useState(null); // { id, text, dreamt_on, chosen } once loaded
  const [phase, setPhase] = useState('writing'); // writing | saved
  const [saved, setSaved] = useState(null); // { id, dreamt_on, night_order }
  const [autosave, setAutosave] = useState('idle'); // idle | saving | saved | volatile
  const [volatile, setVolatile] = useState(false);
  const [order, setOrder] = useState(1);
  const [listTick, setListTick] = useState(0);
  const [busy, setBusy] = useState(false);

  // Restore the draft (it survives the tab being killed). One already in the outbox, or already
  // uploaded, was saved: start fresh.
  useEffect(() => {
    let alive = true;
    Promise.all([get('draft', 'current'), getAll('outbox'), getAll('known'), isVolatile()]).then(
      ([d, out, known, vol]) => {
        if (!alive) return;
        setVolatile(vol);
        const done = d && (out.some((e) => e.id === d.id) || known.some((k) => k.id === d.id));
        const staleEmpty = d && !d.text && Date.now() - (d.at || 0) > STALE_EMPTY_DRAFT_MS;
        if (d && !done && !staleEmpty) {
          setDraft({ id: d.id, text: d.text || '', dreamt_on: d.dreamt_on || null, chosen: Boolean(d.chosen && d.dreamt_on) });
          if (d.text) setAutosave(vol ? 'volatile' : 'saved');
        } else {
          if (d) del('draft', 'current').catch(() => {});
          setDraft(freshDraft());
        }
      },
      () => alive && setDraft(freshDraft()),
    );
    return () => {
      alive = false;
    };
  }, []);

  // What the server holds, so the first dream of a night is numbered after the ones already up.
  useEffect(() => {
    if (navigator.onLine === false) return undefined;
    const ctrl = new AbortController();
    api
      .list({ signal: ctrl.signal })
      .then(rememberList)
      .then(() => setListTick((t) => t + 1))
      .catch(() => {}); // no signal, or the gate's business (the shell pings on its own)
    return () => ctrl.abort();
  }, []);

  const date = draft?.chosen && draft.dreamt_on ? draft.dreamt_on : dreamtOnFor(now);
  const sentCount = outbox.sent.length;
  const outboxCount = outbox.entries.length;

  useEffect(() => {
    let alive = true;
    nextNightOrder(date).then(
      (n) => alive && setOrder(n),
      () => {},
    );
    return () => {
      alive = false;
    };
  }, [date, outboxCount, sentCount, listTick]);

  // Focus the textarea whenever it appears, caret at the end.
  const ready = Boolean(draft);
  useEffect(() => {
    if (phase !== 'writing' || !ready) return;
    const el = textRef.current;
    if (!el) return;
    el.focus({ preventScroll: true });
    const end = el.value.length;
    try {
      el.setSelectionRange(end, end);
    } catch {
      /* not a text field yet */
    }
  }, [phase, ready]);

  /** Writes the draft to IndexedDB, one write after another. */
  function writeDraft(d) {
    chain.current = chain.current
      .catch(() => {})
      .then(() => put('draft', { key: 'current', id: d.id, text: d.text, dreamt_on: d.dreamt_on, chosen: d.chosen, at: Date.now() }));
    return chain.current;
  }

  /** Every change is kept, shown by the dot. */
  function persist(d) {
    const mine = ++seq.current;
    setAutosave('saving');
    writeDraft(d).then(
      () => mine === seq.current && setAutosave(volatile ? 'volatile' : 'saved'),
      () => mine === seq.current && setAutosave('volatile'),
    );
  }

  function onText(e) {
    const next = { ...draft, text: e.target.value };
    setDraft(next);
    persist(next);
  }

  function onNight(e) {
    const value = e.target.value;
    const next = value ? { ...draft, dreamt_on: value, chosen: true } : { ...draft, dreamt_on: null, chosen: false };
    setDraft(next);
    persist(next);
  }

  async function save() {
    const text = (draft?.text || '').trim();
    if (!text || busy) return;
    setBusy(true);
    try {
      await chain.current.catch(() => {}); // a draft write still in flight must not bring the draft back
      const night_order = await nextNightOrder(date);
      const row = { id: draft.id, dreamt_on: date, night_order, raw_text: text, created_at: new Date().toISOString() };
      await addDream(row);
      seq.current += 1;
      setSaved({ id: row.id, dreamt_on: row.dreamt_on, night_order });
      setDraft(null);
      setAutosave('idle');
      setPhase('saved');
    } catch (err) {
      // IndexedDB refused: the words are still in the textarea; say so quietly.
      console.error('[dream-rooms] save', err?.name || 'error');
      setAutosave('volatile');
    } finally {
      setBusy(false);
    }
  }

  function another() {
    const next = freshDraft(saved.dreamt_on);
    setDraft(next);
    writeDraft(next).catch(() => {}); // the night survives a killed tab; the dot waits for words
    setAutosave('idle');
    setPhase('writing');
  }

  // The saved dream's upload, from the outbox.
  let upload = 'waiting';
  if (saved) {
    const entry = outbox.entries.find((e) => e.id === saved.id);
    if (outbox.sent.includes(saved.id) || !entry) upload = 'uploaded';
    else if (entry.state === 'error') upload = 'error';
    else if (outbox.blocked) upload = 'blocked';
    else if (outbox.current === saved.id) upload = 'uploading';
  }
  const others = outbox.entries.filter((e) => e.id !== saved?.id && e.id !== draft?.id).length;

  const style = vv ? { '--dr-vvh': `${vv.height}px`, '--dr-vvt': `${vv.top}px` } : undefined;
  const chipDate = phase === 'saved' && saved ? saved.dreamt_on : date;
  const chipOrder = phase === 'saved' && saved ? saved.night_order : order;

  return (
    <main className="dr-capture" data-dr="capture" data-phase={phase} style={style}>
      <header className="dr-capture-bar">
        <label className="dr-chip" data-dr="night-chip" data-date={chipDate} data-order={chipOrder}>
          <span className="dr-label dr-chip-text">{COPY.night.of(nightLabel(chipDate, now))}</span>
          {(chipOrder > 1 || phase === 'saved') && <span className="dr-label dr-chip-n">{COPY.night.dream(chipOrder)}</span>}
          {phase === 'writing' && (
            <input
              type="date"
              className="dr-chip-input"
              value={date}
              max={isoDate(now)}
              aria-label={COPY.capture.changeNight}
              onChange={onNight}
              onClick={(e) => {
                try {
                  e.currentTarget.showPicker?.();
                } catch {
                  /* the picker opens on its own where showPicker is missing */
                }
              }}
              data-dr="night-input"
            />
          )}
        </label>
        {phase === 'writing' && (
          <span className="dr-dot dr-autosave" data-state={autosave} data-dr="autosave">
            <i aria-hidden="true" />
            {COPY.capture.autosave[autosave]}
          </span>
        )}
      </header>

      {phase === 'writing' ? (
        <>
          <textarea
            ref={textRef}
            className="dr-capture-text"
            value={draft?.text || ''}
            onChange={onText}
            placeholder={COPY.capture.hint}
            aria-label={COPY.capture.textLabel}
            maxLength={MAX_TEXT}
            autoFocus
            autoCapitalize="sentences"
            spellCheck
            disabled={!draft}
            data-dr="capture-text"
          />
          <footer className="dr-capture-foot">
            {others > 0 && (
              <p className="dr-dot" data-status="captured" data-dr="capture-others">
                <i aria-hidden="true" />
                {COPY.capture.others(others)}
              </p>
            )}
            <button type="button" className="dr-btn dr-btn--big" onClick={save} disabled={busy || !draft?.text?.trim()} data-dr="save">
              {busy ? COPY.capture.saving : COPY.capture.save}
            </button>
          </footer>
        </>
      ) : (
        <section className="dr-saved" data-dr="saved" data-id={saved?.id} data-upload={upload}>
          <p className="dr-saved-title">{COPY.capture.saved.title}</p>
          <p className="dr-dot dr-upload" data-state={upload} data-dr="upload">
            <i aria-hidden="true" />
            {COPY.capture.upload[upload]}
            {upload === 'error' && (
              <button type="button" className="dr-link" onClick={() => retryOutbox()}>
                {COPY.capture.upload.retry}
              </button>
            )}
          </p>
          {others > 0 && (
            <p className="dr-dot" data-status="captured">
              <i aria-hidden="true" />
              {COPY.capture.others(others)}
            </p>
          )}
          <div className="dr-saved-foot">
            <button type="button" className="dr-btn dr-btn--big" onClick={another} data-dr="another">
              {COPY.capture.saved.another}
            </button>
            <nav className="dr-saved-links">
              <Link className="dr-link" to={corridorUrl()}>
                {COPY.capture.saved.corridor}
              </Link>
              <Link className="dr-link" to={listUrl()}>
                {COPY.capture.saved.list}
              </Link>
            </nav>
          </div>
        </section>
      )}
    </main>
  );
}
