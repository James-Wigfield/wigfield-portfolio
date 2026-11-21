import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePortalRoute } from '../../portalRoute';
import Icon from '../../icons';
import { FORMS, DEFAULT_FORM, PAGE_PT, JAMES, STATUS } from './fields';
import './skippers.css';

/* ============================================================================
   SKIPPERS · FORMS  (Personal section)
   ----------------------------------------------------------------------------
   The two WA Department of Transport forms a Recreational Skipper's Ticket
   applicant may need, shown exactly as printed (page renders from
   tools/skippers/render-forms.mjs) with the filled values laid over them at
   the forms' own field positions (fields.js), plus a plain-English note per
   section. James needs neither form; both are filled as a worked example.

   Map:  fields.js (boxes, values, notes) · skippers.css (screen + print)
   Deep links: /portal/skippers/eyesight (default) · /portal/skippers/consent

   Ink: blue = James's details · red = example only (someone else fills it).
   PRIVACY: date of birth and street address are never in source. They are
   typed into "My details" and kept in this browser only (localStorage
   `skf:applicant`); until then the form shows faint placeholders.

   Export PDF = window.print() of the open form's pages, one A4 sheet per
   form page, no notes / counters / tags. Red example values are left OFF
   the PDF unless "Print examples" is ticked, so a printout can go straight to
   the real optometrist, doctor or parent to finish. The @page box is a
   <style> added on mount (same trick as the Resume tab).
   ========================================================================== */

const STORE_KEY = 'skf:applicant';
const PAGE_CSS = `
@media print {
  @page { size: A4 portrait; margin: 0; }
}`;

function readDevice() {
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw);
    return v && typeof v === 'object' ? v : null;
  } catch {
    return null;
  }
}

function writeDevice(v) {
  try {
    if (v) window.localStorage.setItem(STORE_KEY, JSON.stringify(v));
    else window.localStorage.removeItem(STORE_KEY);
    return true;
  } catch {
    return false;
  }
}

const DOB_RE = /^(\d{2})\/(\d{2})\/(\d{4})$/;
function validDob(s) {
  const m = DOB_RE.exec(s);
  if (!m) return false;
  const d = Number(m[1]);
  const mo = Number(m[2]);
  const y = Number(m[3]);
  return d >= 1 && d <= 31 && mo >= 1 && mo <= 12 && y >= 1900 && y <= 2100;
}

// ── geometry: PDF points -> % of the page ───────────────────────────────────
const px = (v) => `${(v / PAGE_PT.w) * 100}%`;
const py = (v) => `${(v / PAGE_PT.h) * 100}%`;
const boxStyle = (b) => ({ left: px(b[0]), top: py(b[1]), width: px(b[2]), height: py(b[3]) });

function Tick() {
  // A hand-drawn tick that stays inside its box.
  return (
    <svg className="skf-val skf-tick" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="M3.2 10.6c1.9 1.5 3.4 3.2 4.7 5.6C10.4 10.8 13.4 6.5 17.2 3.2" />
    </svg>
  );
}

function Field({ f, ctx }) {
  const ink = `skf-ink--${f.ink}${f.ink === 'red' ? ' skf-ex' : ''}`;
  if (f.kind === 'tick') {
    return f.on ? (
      <div className={`skf-f skf-f--tick ${ink}`} style={boxStyle(f.box)} data-field={f.id}>
        <Tick />
      </div>
    ) : null;
  }
  const value = f.get(ctx) || '';
  if (f.kind === 'cells') {
    const chars = value ? value.split('') : (f.placeholder || '').split('');
    return f.cells.map((c, i) => (
      <div key={i} className={`skf-f skf-f--cell ${ink}`} style={boxStyle(c)} data-field={`${f.id}-${i}`}>
        <span className={`skf-val${value ? '' : ' skf-ph'}`}>{chars[i] || ''}</span>
      </div>
    ));
  }
  if (!value && !f.placeholder) return null;
  return (
    <div
      className={`skf-f skf-f--text ${ink}${f.align === 'center' ? ' skf-f--center' : ''}`}
      style={boxStyle(f.box)}
      data-field={f.id}
    >
      <span className={`skf-val${value ? '' : ' skf-ph'}`}>{value || f.placeholder}</span>
    </div>
  );
}

function Dot({ status }) {
  const s = STATUS[status];
  return <span className={`skf-dot skf-dot--${s.tone}`}>{s.label}</span>;
}

/* Desktop: each note sits level with its section on the page, pushed down
   just enough never to overlap the note above. Phones: plain list under the
   page (CSS turns the absolute positions off; we clear them here too). */
function useNoteLayout(sheetRef, deps) {
  useLayoutEffect(() => {
    const sheet = sheetRef.current;
    if (!sheet) return undefined;
    const paper = sheet.querySelector('.skf-paper');
    const list = sheet.querySelector('.skf-notes');
    const run = () => {
      const notes = [...list.querySelectorAll('.skf-note')];
      const wide = window.matchMedia('(min-width: 701px)').matches;
      if (!wide) {
        notes.forEach((n) => { n.style.top = ''; });
        list.style.height = '';
        return;
      }
      const h = paper.getBoundingClientRect().height;
      let floor = 0;
      notes.forEach((n) => {
        const want = (Number(n.dataset.top) / PAGE_PT.h) * h;
        const top = Math.max(want, floor);
        n.style.top = `${top}px`;
        floor = top + n.offsetHeight + 14;
      });
      list.style.height = `${Math.max(h, floor)}px`;
    };
    run();
    // the sheet for width changes, each note for late font swaps
    const ro = new ResizeObserver(run);
    ro.observe(sheet);
    list.querySelectorAll('.skf-note').forEach((n) => ro.observe(n));
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

function Sheet({ page, ctx, formId }) {
  const ref = useRef(null);
  useNoteLayout(ref, [page, formId]);
  return (
    <section className="skf-sheet" ref={ref} aria-label={page.caption}>
      <div className="skf-sheet__page">
        <p className="skf-caption">{page.caption}</p>
        <div className="skf-frame">
          <div className="skf-paper">
            <img src={page.img} alt={`${page.caption}, blank Department of Transport form`} draggable="false" />
            <div className="skf-layer">
              {page.sections.map((s) => (
                <span key={s.n} className="skf-pin" style={{ top: py(s.top) }} aria-hidden="true">
                  {s.n}
                </span>
              ))}
              {(page.tags || []).map((t) => (
                <span key={t.text} className="skf-tag skf-ex" style={{ left: px(t.at[0]), top: py(t.at[1]) }}>
                  {t.text}
                </span>
              ))}
              {(page.annotations || []).map((t) => (
                <span key={t.text} className="skf-anno" style={{ left: px(t.at[0]), top: py(t.at[1]) }}>
                  {t.text}
                </span>
              ))}
              {page.fields.map((f) => (
                <Field key={f.id} f={f} ctx={ctx} />
              ))}
            </div>
          </div>
        </div>
      </div>
      <ol className="skf-notes" aria-label={`Notes on ${page.caption}`}>
        {page.sections.map((s) => (
          <li key={s.n} className="skf-note" data-top={s.top}>
            <div className="skf-note__head">
              <span className="skf-count">{s.n}</span>
              <span className="skf-note__title">{s.title}</span>
            </div>
            <p className="skf-note__text">{s.text}</p>
            <Dot status={s.status} />
          </li>
        ))}
      </ol>
    </section>
  );
}

function MyDetails({ device, onSave }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => ({ dob: '', unit: '', number: '', street: '', ...(device || {}) }));
  const [msg, setMsg] = useState('');
  const set = (k) => (e) => setDraft((d) => ({ ...d, [k]: e.target.value }));
  const filled = Boolean(device?.dob && device?.number && device?.street);

  const save = (e) => {
    e.preventDefault();
    const next = {
      dob: draft.dob.trim(),
      unit: draft.unit.trim(),
      number: draft.number.trim(),
      street: draft.street.trim(),
    };
    if (next.dob && !validDob(next.dob)) {
      setMsg('Date of birth needs the form DD/MM/YYYY.');
      return;
    }
    const stored = writeDevice(next);
    onSave(next);
    setMsg(stored ? 'Saved in this browser only.' : 'Shown on the forms, but this browser would not store it.');
  };
  const clear = () => {
    writeDevice(null);
    onSave(null);
    setDraft({ dob: '', unit: '', number: '', street: '' });
    setMsg('Cleared from this browser.');
  };

  return (
    <section className="skf-me" aria-label="My details, this device only">
      <div className="skf-me__line">
        <span className="skf-micro">My details · this device only</span>
        <span className={`skf-dot ${filled ? 'skf-dot--blue' : 'skf-dot--open'}`}>
          {filled ? 'Date of birth and address set' : 'Date of birth and address not set'}
        </span>
        <button type="button" className="skf-link" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          {open ? 'Close' : 'Edit'}
        </button>
      </div>
      {open ? (
        <form className="skf-me__form" onSubmit={save}>
          <p className="skf-me__why">
            Kept in this browser only (never in the site code, never sent anywhere), so the forms can show them.
          </p>
          <label>
            <span>Date of birth</span>
            <input value={draft.dob} onChange={set('dob')} placeholder="DD/MM/YYYY" inputMode="numeric" autoComplete="off" />
          </label>
          <label className="skf-me__short">
            <span>Unit (optional)</span>
            <input value={draft.unit} onChange={set('unit')} autoComplete="off" />
          </label>
          <label className="skf-me__short">
            <span>Street no.</span>
            <input value={draft.number} onChange={set('number')} autoComplete="off" />
          </label>
          <label>
            <span>Street name</span>
            <input value={draft.street} onChange={set('street')} placeholder="e.g. Example Street" autoComplete="off" />
          </label>
          <div className="skf-me__actions">
            <button type="submit" className="skf-btn">Save</button>
            <button type="button" className="skf-link" onClick={clear}>Clear</button>
            {msg ? <span className="skf-me__msg" role="status">{msg}</span> : null}
          </div>
        </form>
      ) : null}
    </section>
  );
}

export default function SkippersForms() {
  const { sub, setSub } = usePortalRoute();
  const head = sub.split('/').filter(Boolean)[0];
  const form = FORMS.find((x) => x.id === head) || FORMS.find((x) => x.id === DEFAULT_FORM);
  const [device, setDevice] = useState(readDevice);
  const [printEx, setPrintEx] = useState(false);
  const [zoom, setZoom] = useState(false);
  const [busy, setBusy] = useState(false);
  const ctx = { me: JAMES, device };

  useEffect(() => {
    const style = document.createElement('style');
    style.id = 'skf-page';
    style.textContent = PAGE_CSS;
    document.head.appendChild(style);
    return () => style.remove();
  }, []);

  // Another tab saving details shows up here too.
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === STORE_KEY) setDevice(readDevice());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const exportPdf = useCallback(() => {
    if (busy) return;
    setBusy(true);
    const before = document.title;
    document.title = form.pdfName;
    const done = () => {
      document.title = before;
      setBusy(false);
      window.removeEventListener('afterprint', done);
    };
    window.addEventListener('afterprint', done);
    const imgs = [...document.querySelectorAll('.skf-paper img')];
    Promise.all([document.fonts.ready, ...imgs.map((i) => (i.decode ? i.decode().catch(() => {}) : null))]).then(() =>
      window.print(),
    );
  }, [busy, form.pdfName]);

  return (
    <div className={`pt-module skf${printEx ? ' skf--print-ex' : ''}${zoom ? ' skf--zoom' : ''}`}>
      <header className="skf-top">
        <div className="skf-top__row">
          <span className="skf-micro">Personal · Recreational Skipper&rsquo;s Ticket · WA DoT forms</span>
          <Link className="skf-link skf-study" to="/skippers">
            Study site &rarr;
          </Link>
        </div>
        <h1 className="skf-top__title">Skippers · Forms</h1>
        <p className="skf-top__lede">
          The two forms some skipper&rsquo;s ticket applicants hand in, shown exactly as the Department prints them, with
          a plain-English note on every section.
        </p>

        <div className="skf-bar">
          <div className="skf-switch" role="tablist" aria-label="Form">
            {FORMS.map((x) => (
              <button
                key={x.id}
                type="button"
                role="tab"
                aria-selected={x.id === form.id}
                className={`skf-switch__btn${x.id === form.id ? ' is-on' : ''}`}
                onClick={() => setSub(x.id)}
              >
                <b>{x.tab}</b>
                <span>
                  {x.pages.length} {x.pages.length === 1 ? 'page' : 'pages'} · {x.id === 'consent' ? 'under 18s' : 'no licence'}
                </span>
              </button>
            ))}
          </div>
          <div className="skf-bar__tools">
            <label className="skf-check">
              <input type="checkbox" checked={printEx} onChange={(e) => setPrintEx(e.target.checked)} />
              Print examples
            </label>
            <button type="button" className="skf-btn" onClick={exportPdf} disabled={busy}>
              <Icon name="printer" size={16} />
              Export PDF
            </button>
          </div>
        </div>

        <dl className="skf-facts">
          <div>
            <dt>Status</dt>
            <dd>{form.status}</dd>
          </div>
          <div>
            <dt>Who needs it</dt>
            <dd>{form.who}</dd>
          </div>
          <div>
            <dt>Ink</dt>
            <dd className="skf-legend">
              <span className="skf-dot skf-dot--blue">Blue = James&rsquo;s details</span>
              <span className="skf-dot skf-dot--red">Red = example only</span>
            </dd>
          </div>
          <div>
            <dt>Form</dt>
            <dd>
              {form.title} · DoT ref <span className="skf-mono">{form.ref}</span>
            </dd>
          </div>
        </dl>

        <MyDetails device={device} onSave={setDevice} />

        <div className="skf-phonebar">
          <button type="button" className="skf-link" aria-pressed={zoom} onClick={() => setZoom((z) => !z)}>
            {zoom ? 'Fit page to screen' : 'Zoom page 2×'}
          </button>
          <span className="skf-hint">Print: Save as PDF, paper A4, margins None, no headers and footers.</span>
        </div>
      </header>

      <div className="skf-pages">
        {form.pages.map((p) => (
          <Sheet key={`${form.id}-${p.n}`} page={p} ctx={ctx} formId={form.id} />
        ))}
      </div>
    </div>
  );
}
