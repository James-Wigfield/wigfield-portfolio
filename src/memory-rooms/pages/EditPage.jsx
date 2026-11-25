/* /memories/:spotId/edit: fix a spot's details after capture. Above all its place (the
   pin, GPS, a typed place, coordinates, and the place name), plus its name, note, the day
   it was captured, who saved it, and its kind + size while no 3D room exists yet.

   One PATCH with only what changed, carrying `ifUpdatedAt` (the spot's updatedAt when the
   form opened): if someone saved since, the Worker answers 409 and the page offers to
   reload their changes under yours. Edits need signal (they never go through the outbox);
   offline, Save is disabled and what's typed waits in sessionStorage (edit/draft.js).
   The place's map mounts only when "Change location" is tapped (edit/EditPlace.jsx). */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { COPY } from '../copy.js';
import { Arrow } from '../capture/CaptureFrame.jsx';
import { api } from '../lib/api.js';
import { setFlash } from '../lib/flash.js';
import { readWho } from '../lib/storage.js';
import { useOnline } from '../lib/useOnline.js';
import { paths } from '../routes.js';
import EditPlace from './edit/EditPlace.jsx';
import CollectionPicker from '../capture/CollectionPicker.jsx';
import { createCollectionNow, useCollections } from '../lib/collections.js';
import { clearDraft, readDraft, writeDraft } from './edit/draft.js';
import { baseOf, fieldErrors, formOf, patchOf, presetOf, rebase, sameDetails, withDay } from './edit/form.js';
import PageMessage from './spot/PageMessage.jsx';

export default function EditPage() {
  const { spotId } = useParams();
  const [attempt, setAttempt] = useState(0);
  const [res, setRes] = useState(null);
  const key = `${spotId}#${attempt}`;

  useEffect(() => {
    let alive = true;
    api.getSpot(spotId).then(
      (spot) => alive && setRes({ key, kind: spot && !spot.deletedAt ? 'ok' : 'missing', spot }),
      (error) => alive && setRes({ key, kind: error?.status === 404 || error?.status === 400 ? 'missing' : 'error', error }),
    );
    return () => {
      alive = false;
    };
  }, [spotId, key]);

  const current = res?.key === key ? res : null;
  const copy = COPY.spot;
  if (!current) {
    return (
      <div className="mr-edit">
        <p className="mr-state-body mr-edit-loading">{COPY.edit.loading}</p>
      </div>
    );
  }
  if (current.kind === 'missing') {
    return <PageMessage dataState="missing" label={copy.missingLabel} title={copy.missingTitle} body={copy.missingBody} />;
  }
  if (current.kind === 'error') {
    // No signal: what was typed here before still opens (the draft holds the spot as the form opened).
    if (readDraft(spotId)) return <EditForm key={key} spotId={spotId} spot={null} />;
    return (
      <PageMessage
        dataState="error"
        label={copy.errorLabel}
        title={copy.errorTitle}
        body={current.error?.message === 'offline' ? copy.errorOffline : null}
        retryLabel={copy.retry}
        onRetry={() => setAttempt((a) => a + 1)}
      />
    );
  }
  return <EditForm key={key} spotId={spotId} spot={current.spot} />;
}

/** The form's first state: a draft typed earlier on this phone wins over the spot as loaded. */
function opening(spotId, spot) {
  const draft = readDraft(spotId);
  const fresh = spot ? baseOf(spot) : null;
  if (!draft) return { base: fresh, form: formOf(fresh), restored: false, conflict: null };
  if (!fresh || fresh.updatedAt === draft.base.updatedAt) return { base: draft.base, form: draft.form, restored: true, conflict: null };
  // The spot moved on since the draft was typed. Only the render side (status, scene): carry on from the new one.
  if (sameDetails(draft.base, fresh)) return { base: fresh, form: rebase(draft.base, fresh, draft.form), restored: true, conflict: null };
  return { base: draft.base, form: draft.form, restored: true, conflict: fresh };
}

function otherPerson() {
  const me = readWho();
  const other = me === 'james' ? 'justin' : me === 'justin' ? 'james' : null;
  return other ? COPY.app.people[other] : null;
}

const FieldError = ({ name, text }) =>
  text ? (
    <p className="mr-msg" data-tone="danger" data-mr={`edit-error-${name}`}>
      {text}
    </p>
  ) : null;

function EditForm({ spotId, spot }) {
  const c = COPY.edit;
  const navigate = useNavigate();
  const location = useLocation();
  const online = useOnline();
  const [start] = useState(() => opening(spotId, spot));
  const [other] = useState(otherPerson);
  const [base, setBase] = useState(start.base);
  const [form, setForm] = useState(start.form);
  const [restored, setRestored] = useState(start.restored);
  const [conflict, setConflict] = useState(start.conflict); // the newer spot someone else saved
  const [errors, setErrors] = useState({});
  const [notice, setNotice] = useState(null); // { text, tone }
  const [saving, setSaving] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [placeOpen, setPlaceOpen] = useState(false);
  const [done, setDone] = useState(false); // saved or discarded: stop keeping a draft
  const { collections } = useCollections();

  const patch = useMemo(() => patchOf(base, form), [base, form]);
  const dirty = Object.keys(patch).length > 0;

  // Keep what's typed (per spot) until it's saved or discarded.
  useEffect(() => {
    if (done) return;
    if (dirty) writeDraft(spotId, base, form);
    else clearDraft(spotId);
  }, [spotId, base, form, dirty, done]);

  // Closing the tab or reloading with unsaved changes asks first.
  useEffect(() => {
    if (!dirty || done) return undefined;
    const warn = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, done]);

  useEffect(() => {
    document.title = `${c.pageTitle(base.title)} · ${COPY.app.name}`;
  }, [c, base.title]);

  // A refused save scrolls its first problem into view (Save sits at the bottom, the name at the top).
  useEffect(() => {
    if (!Object.keys(errors).length) return;
    document.querySelector('.mr-edit [data-mr^="edit-error-"]')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [errors]);

  const set = (field, value, errorKey = field) => {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => (e[errorKey] ? { ...e, [errorKey]: null } : e));
    setLeaving(false);
  };
  const onLoc = useCallback((fn) => {
    setForm((f) => ({ ...f, loc: fn(f.loc) }));
    setErrors((e) => (e.place ? { ...e, place: null } : e));
    setLeaving(false);
  }, []);

  // Back to the spot page: the history entry it came from when there is one (the phone's back works the same).
  const cameFromSpot = location.state?.from === 'spot';
  const goBack = () => (cameFromSpot ? navigate(-1) : navigate(paths.spot(spotId), { replace: true }));

  const finish = () => {
    setDone(true);
    clearDraft(spotId);
    setFlash(`saved:${spotId}`);
    goBack();
  };

  const save = async () => {
    if (saving || !dirty || !online || conflict) return;
    const problems = {};
    if (!form.title.trim()) problems.title = c.required.title;
    if (!form.note.trim()) problems.note = c.required.note;
    if (form.day !== base.day && !withDay(base.capturedAt, form.day)) problems.day = c.required.day;
    if (Object.keys(problems).length) {
      setErrors(problems);
      return;
    }
    setSaving(true);
    setErrors({});
    setNotice(null);
    let b = base;
    let f = form;
    try {
      for (let round = 0; ; round++) {
        const body = patchOf(b, f);
        if (!Object.keys(body).length) break; // after a reload theirs matched mine: nothing left to send
        try {
          await api.patchSpot(spotId, { ...body, ifUpdatedAt: b.updatedAt });
          break;
        } catch (err) {
          if (err?.status !== 409 || round > 0) throw err;
          const fresh = baseOf(await api.getSpot(spotId));
          const merged = rebase(b, fresh, f);
          // Someone changed the details: say so and let them reload. Only the render side moved
          // (status, scene, photos), with nothing of theirs to lose: save on top of it, once.
          if (!sameDetails(b, fresh) || merged.kind !== f.kind || merged.scaleHint !== f.scaleHint) {
            setConflict(fresh);
            setSaving(false);
            return;
          }
          b = fresh;
          f = merged;
        }
      }
      finish();
    } catch (err) {
      setSaving(false);
      if (b !== base) {
        setBase(b);
        setForm(f);
      }
      if (err?.status === 400) {
        const byField = fieldErrors(err.details);
        setErrors(byField);
        if (byField.form || !err.details?.length) setNotice({ text: byField.form || err.message, tone: 'danger' });
      } else {
        setNotice({ text: err?.status === 0 ? c.offline : c.failed, tone: 'danger' });
      }
    }
  };

  const reload = () => {
    setForm(rebase(base, conflict, form));
    setBase(conflict);
    setConflict(null);
    setRestored(false);
    setNotice({ text: c.reloaded, tone: null });
  };

  const discard = () => {
    setForm(formOf(base));
    setErrors({});
    setNotice(null);
    setRestored(false);
  };

  const back = () => {
    if (!dirty) {
      setDone(true);
      goBack();
    } else setLeaving(true);
  };
  const discardAndLeave = () => {
    setDone(true);
    clearDraft(spotId);
    goBack();
  };

  const locked = base.hasScene;
  const preset = presetOf(form.scaleHint);
  const scaleText = COPY.capture.scalePresets.find((p) => p.value === form.scaleHint)?.label || form.scaleHint || '–';

  return (
    <div className="mr-edit" data-mr="edit" data-dirty={dirty ? '' : undefined} data-online={online ? '' : undefined}>
      <div className="mr-edit-body">
        <div className="mr-edit-form">
          <header className="mr-edit-head">
            <span className="mr-label">{c.eyebrow}</span>
            <h1 className="mr-edit-title">{base.title}</h1>
            {restored && dirty && (
              <p className="mr-msg" data-mr="edit-restored">
                {c.restored}
              </p>
            )}
          </header>

          <section className="mr-edit-sec">
            <label className="mr-field">
              <span className="mr-label">{c.titleLabel}</span>
              <input
                className="mr-input mr-input--lg"
                type="text"
                value={form.title}
                maxLength={120}
                autoComplete="off"
                enterKeyHint="done"
                aria-invalid={errors.title ? 'true' : undefined}
                onChange={(e) => set('title', e.target.value)}
                data-mr="edit-title"
              />
            </label>
            <FieldError name="title" text={errors.title} />
          </section>

          <section className="mr-edit-sec">
            <label className="mr-field">
              <span className="mr-label">{c.noteLabel}</span>
              <textarea
                className="mr-input mr-textarea"
                rows={3}
                maxLength={600}
                value={form.note}
                enterKeyHint="done"
                aria-invalid={errors.note ? 'true' : undefined}
                onChange={(e) => set('note', e.target.value.replace(/\s*\n+\s*/g, ' '))}
                data-mr="edit-note"
              />
            </label>
            <FieldError name="note" text={errors.note} />
          </section>

          <EditPlace
            base={base}
            loc={form.loc}
            open={placeOpen}
            onOpen={() => setPlaceOpen(true)}
            onChange={onLoc}
            onReset={() => set('loc', base.loc, 'place')}
            error={errors.place}
          />

          <section className="mr-edit-sec">
            <label className="mr-field">
              <span className="mr-label">{c.dateLabel}</span>
              <input
                className="mr-input mr-edit-date"
                type="date"
                value={form.day}
                aria-invalid={errors.day ? 'true' : undefined}
                onChange={(e) => set('day', e.target.value)}
                data-mr="edit-day"
              />
              <span className="mr-field-hint">{c.dateHint}</span>
            </label>
            <FieldError name="day" text={errors.day} />
          </section>

          <section className="mr-edit-sec">
            <fieldset className="mr-field">
              <legend className="mr-label">{c.byLabel}</legend>
              <div className="mr-edit-choice">
                {['james', 'justin'].map((p) => (
                  <button key={p} type="button" className="mr-preset" aria-pressed={form.createdBy === p} onClick={() => set('createdBy', p, 'by')} data-mr={`edit-by-${p}`}>
                    {COPY.app.people[p]}
                  </button>
                ))}
              </div>
            </fieldset>
            <FieldError name="by" text={errors.by} />
          </section>

          <section className="mr-edit-sec" data-mr="edit-collection">
            <CollectionPicker
              value={form.collectionId}
              collections={collections}
              onChange={(id) => set('collectionId', id, 'collection')}
              onCreate={createCollectionNow}
              noneLabel={base.buildingId ? COPY.collections.withPlace : COPY.collections.none}
              hint={base.buildingId ? COPY.collections.roomHint : null}
            />
            <FieldError name="collection" text={errors.collection} />
          </section>

          <section className="mr-edit-sec" data-mr="edit-kind" data-locked={locked ? '' : undefined}>
            {locked ? (
              <>
                <dl className="mr-edit-fixed">
                  <div>
                    <dt className="mr-label">{c.kindLabel}</dt>
                    <dd>{COPY.app.kinds[form.kind] || form.kind}</dd>
                  </div>
                  <div>
                    <dt className="mr-label">{c.scaleLabel}</dt>
                    <dd>{scaleText}</dd>
                  </div>
                </dl>
                <p className="mr-field-hint" data-mr="edit-locked">
                  {c.locked}
                </p>
              </>
            ) : (
              <>
                <fieldset className="mr-field">
                  <legend className="mr-label">{c.kindLabel}</legend>
                  <div className="mr-edit-choice">
                    {['interior', 'exterior'].map((k) => (
                      <button key={k} type="button" className="mr-preset" aria-pressed={form.kind === k} onClick={() => set('kind', k)} data-mr={`edit-kind-${k}`}>
                        {COPY.app.kinds[k]}
                      </button>
                    ))}
                  </div>
                </fieldset>
                <FieldError name="kind" text={errors.kind} />
                <fieldset className="mr-field">
                  <legend className="mr-label">{c.scaleLabel}</legend>
                  <div className="mr-presets">
                    {COPY.capture.scalePresets.map((p) => (
                      <button
                        key={p.value}
                        type="button"
                        className="mr-preset"
                        aria-pressed={preset === p.value}
                        onClick={() => set('scaleHint', preset === p.value ? '' : p.value, 'scale')}
                        data-mr="edit-scale-preset"
                        data-value={p.value}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                  <label className="mr-subfield">
                    <span className="mr-sublabel">{COPY.capture.scaleOther}</span>
                    <input
                      className="mr-input"
                      type="text"
                      maxLength={80}
                      value={preset ? '' : form.scaleHint}
                      placeholder={COPY.capture.scalePlaceholder}
                      onChange={(e) => set('scaleHint', e.target.value, 'scale')}
                      data-mr="edit-scale-input"
                    />
                  </label>
                </fieldset>
                <FieldError name="scale" text={errors.scale} />
              </>
            )}
          </section>

          {dirty && (
            <div className="mr-edit-discard">
              <button type="button" className="mr-linkbtn" onClick={discard} data-mr="edit-discard">
                {c.discard}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="mr-actionbar mr-edit-bar">
        <div className="mr-edit-lines" aria-live="polite">
          {conflict && (
            <div className="mr-edit-line" data-mr="edit-conflict">
              <p className="mr-msg" data-tone="danger">
                {c.conflict(other)}
              </p>
              <button type="button" className="mr-linkbtn" onClick={reload} data-mr="edit-reload">
                {c.reload}
              </button>
            </div>
          )}
          {!online && (
            <p className="mr-msg" data-mr="edit-offline">
              {c.offline}
            </p>
          )}
          {notice && (
            <p className="mr-msg" data-tone={notice.tone || undefined} data-mr="edit-notice">
              {notice.text}
            </p>
          )}
          {leaving && <p className="mr-edit-leave">{c.leaveTitle}</p>}
        </div>
        <div className="mr-actionbar-row">
          {leaving ? (
            <>
              <button type="button" className="mr-btn mr-btn--lg mr-actionbar-main" onClick={() => setLeaving(false)} data-mr="edit-leave-stay">
                {c.leaveStay}
              </button>
              <button type="button" className="mr-btn mr-btn--primary mr-btn--lg mr-actionbar-main" onClick={discardAndLeave} data-mr="edit-leave-discard">
                {c.leaveDiscard}
              </button>
            </>
          ) : (
            <>
              <button type="button" className="mr-btn mr-btn--lg" onClick={back} data-mr="edit-back">
                <Arrow back />
                {c.back}
              </button>
              <button
                type="button"
                className="mr-btn mr-btn--primary mr-btn--lg mr-actionbar-main"
                onClick={save}
                disabled={!dirty || !online || saving || Boolean(conflict)}
                data-mr="edit-save"
              >
                {saving ? c.saving : c.save}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
