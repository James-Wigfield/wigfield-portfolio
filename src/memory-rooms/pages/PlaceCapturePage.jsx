/* /memories/new/place — capturing a whole place, on the phone.
   01 Name → 02 Location → 03 Floor plan (optional photos of it) → 04 Outside
   (optional: four corners and the street) → saved to the outbox → its room
   checklist (/memories/b/:id), where each room is captured with the normal shot
   guide. The draft lives in IndexedDB the whole way (store `places`: one row for
   its fields, one row per photo, so every Blob is a top-level field: iOS Safari
   refuses Blobs nested deeper), so a reload or a dropped tab loses nothing;
   photos are made small on the phone (2048 px + 480 px thumbs) as they're added. */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { COPY } from '../copy.js';
import { paths } from '../routes.js';
import { pad2 } from '../lib/format.js';
import { processPhoto } from '../lib/images.js';
import { get, getByPrefix, put, write } from '../lib/idb.js';
import { addBuilding } from '../lib/outbox.js';
import { NONE, createCollectionQueued, lastCollection, rememberCollection, useCollections } from '../lib/collections.js';
import CollectionPicker from '../capture/CollectionPicker.jsx';
import { emptySketch, savePlaceLocal } from '../lib/places.js';
import { writeLastLoc } from '../lib/storage.js';
import { newId } from '../lib/uuid.js';
import { useShell } from '../shell/ShellContext.js';
import LocationPicker from '../capture/LocationPicker.jsx';
import { Arrow } from '../capture/CaptureFrame.jsx';

const DRAFT_KEY = 'place-draft';
const PHOTO_KEY = 'place-draft-photo:';
const MAX_PLAN = 4;
const MAX_OUTSIDE = 12;
// a photo in the draft row is only its numbers; its blobs are in their own row (PHOTO_KEY + id)
const meta = ({ id, width, height, thumbWidth, thumbHeight }) => ({ id, width, height, thumbWidth, thumbHeight });

const startCollection = () => {
  const last = lastCollection();
  return last && last !== NONE ? last : null;
};
const fresh = (title = '') => ({ id: newId(), step: 0, title, note: '', loc: null, plan: [], outside: [], collectionId: startCollection() });

export default function PlaceCapturePage() {
  const c = COPY.placeCapture;
  const { who } = useShell();
  const navigate = useNavigate();
  const nav = useLocation();
  const [d, setD] = useState(null);
  const [busy, setBusy] = useState(null); // { i, n } while photos are prepared
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const { collections, status: collectionsStatus } = useCollections();
  const urls = useRef(new Map()); // photo id -> object URL of its thumb
  const blobs = useRef(new Map()); // photo id -> { photo, thumb }

  // restore the draft and its photos (or start one with the name typed on the capture page)
  useEffect(() => {
    let alive = true;
    Promise.all([get('places', DRAFT_KEY), getByPrefix('places', PHOTO_KEY)]).then(
      ([row, photos]) => {
        if (!alive) return;
        for (const p of photos) blobs.current.set(p.id.slice(PHOTO_KEY.length), { photo: p.photo, thumb: p.thumb });
        const draft = row?.draft;
        const incoming = nav.state?.title || '';
        // drop a photo whose blobs didn't survive (the phone couldn't keep them)
        const keep = (list) => (list || []).filter((p) => blobs.current.has(p.id));
        // a new place named on the capture page replaces an old draft nothing was done in yet;
        // a draft with something in it is picked up (and says so, with Start over)
        const untouched = draft && draft.step === 0 && !draft.loc && !(draft.plan || []).length && !(draft.outside || []).length;
        if (!draft || (incoming && incoming !== draft.title && untouched)) setD(fresh(incoming));
        else setD({ ...draft, plan: keep(draft.plan), outside: keep(draft.outside), restored: Boolean(incoming && incoming !== draft.title) || draft.step > 0 });
      },
      () => alive && setD(fresh(nav.state?.title || '')),
    );
    return () => {
      alive = false;
    };
  }, [nav.state]);
  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);

  const update = useCallback((fn) => {
    setD((prev) => {
      const next = typeof fn === 'function' ? { ...prev, ...fn(prev) } : { ...prev, ...fn };
      // photos keep their blobs in the draft row; one row, rewritten on each change
      put('places', { id: DRAFT_KEY, draft: next }).catch(() => {});
      return next;
    });
  }, []);

  if (!d) return <div className="mr-capture"><p className="mr-state-body mr-capture-loading">{COPY.capture.loading}</p></div>;

  const thumbUrl = (p) => {
    const b = blobs.current.get(p.id);
    if (!urls.current.has(p.id) && b?.thumb) urls.current.set(p.id, URL.createObjectURL(b.thumb));
    return urls.current.get(p.id) || '';
  };
  const addPhotos = async (which, files) => {
    const max = which === 'plan' ? MAX_PLAN : MAX_OUTSIDE;
    const take = Array.from(files || []).slice(0, Math.max(0, max - d[which].length));
    const made = [];
    for (let i = 0; i < take.length; i++) {
      setBusy({ i: i + 1, n: take.length });
      try {
        const out = await processPhoto(take[i]);
        const id = newId();
        blobs.current.set(id, { photo: out.photo, thumb: out.thumb });
        await put('places', { id: PHOTO_KEY + id, photo: out.photo, thumb: out.thumb }).catch(() => {});
        made.push(meta({ id, ...out }));
      } catch {
        setError(c.photoError(take[i].name));
      }
    }
    setBusy(null);
    if (made.length) update((prev) => ({ [which]: [...prev[which], ...made] }));
  };
  const removePhoto = (which, id) => {
    const u = urls.current.get(id);
    if (u) URL.revokeObjectURL(u);
    urls.current.delete(id);
    blobs.current.delete(id);
    write('places', (w) => w.del('places', PHOTO_KEY + id)).catch(() => {});
    update((prev) => ({ [which]: prev[which].filter((p) => p.id !== id) }));
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const loc = d.loc || {};
      const hasXY = Number.isFinite(loc.lat) && Number.isFinite(loc.lng);
      const sketch = emptySketch();
      const building = {
        id: d.id,
        createdBy: who || 'james',
        title: d.title.trim(),
        note: d.note.trim() || null,
        lat: hasXY ? loc.lat : null,
        lng: hasXY ? loc.lng : null,
        locAccuracyM: hasXY && Number.isFinite(loc.accuracy) ? Math.round(loc.accuracy) : null,
        placeLabel: loc.label?.trim() || null,
        locSource: hasXY || loc.label ? loc.source || 'typed' : null,
        capturedAt: new Date().toISOString(),
        sketch,
        collectionId: d.collectionId || null,
      };
      const b = (p) => blobs.current.get(p.id) || {};
      const files = [
        ...d.plan.map((p, i) => ({ type: 'plan', n: i + 1, blob: b(p).photo, width: p.width, height: p.height, contentType: 'image/jpeg' })),
        ...d.outside.map((p, i) => ({ type: 'thumb', n: i + 1, blob: b(p).thumb, width: p.thumbWidth, height: p.thumbHeight, contentType: 'image/jpeg' })),
        ...d.outside.map((p, i) => ({ type: 'photo', n: i + 1, blob: b(p).photo, width: p.width, height: p.height, contentType: 'image/jpeg' })),
      ].filter((f) => f.blob);
      await addBuilding(building, files);
      rememberCollection(building.collectionId);
      await savePlaceLocal({ id: d.id, building, sketch, files: files.map((f) => ({ type: f.type, n: f.n })) });
      writeLastLoc(building.lat, building.lng);
      // the draft and its photo rows go (the outbox holds the files now)
      await write('places', (w) => {
        w.del('places', DRAFT_KEY);
        w.delPrefix('places', PHOTO_KEY);
      });
      navigate(paths.place(d.id), { replace: true, state: { justSaved: true } });
    } catch (err) {
      console.error('[memory-rooms] place save', err);
      setError(c.saveFailed);
      setSaving(false);
    }
  };

  const steps = c.steps;
  const step = d.step;
  const valid = [Boolean(d.title.trim()), true, !busy, !busy && !saving];
  const go = (n) => {
    setError(null);
    update({ step: n });
  };
  const back = () => (step === 0 ? navigate(paths.capture()) : go(step - 1));
  const startOver = async () => {
    await write('places', (w) => {
      w.del('places', DRAFT_KEY);
      w.delPrefix('places', PHOTO_KEY);
    }).catch(() => {});
    urls.current.forEach((u) => URL.revokeObjectURL(u));
    urls.current.clear();
    blobs.current.clear();
    setD(fresh(nav.state?.title || ''));
  };
  const primary = step < 3 ? { label: COPY.capture.next, mr: 'next', onClick: () => valid[step] && go(step + 1), disabled: !valid[step] } : { label: saving ? COPY.capture.saving : c.save, mr: 'save', onClick: save, disabled: !valid[3] };

  return (
    <div className="mr-capture" data-mr="place-capture">
      <ol className="mr-steps" aria-label={COPY.capture.step(step + 1, steps.length)}>
        {steps.map((name, i) => (
          <li key={name} className="mr-step" data-state={i < step ? 'done' : i === step ? 'current' : 'todo'} aria-current={i === step ? 'step' : undefined}>
            <span className="mr-step-n">{pad2(i + 1)}</span>
            <span className="mr-step-name">{name}</span>
          </li>
        ))}
      </ol>
      <div className="mr-capture-body" key={step}>
        {d.restored && (
          <p className="mr-restored" data-mr="place-restored">
            {c.restored(d.title)}{' '}
            <button type="button" className="mr-linkbtn" onClick={startOver} data-mr="place-start-over">
              {c.startOver}
            </button>
          </p>
        )}
        {step === 0 && (
          <div className="mr-stepbody">
            <h2 className="mr-step-title">{c.nameTitle}</h2>
            <p className="mr-place-capture__lede">{c.lede}</p>
            <label className="mr-field">
              <span className="mr-label">{c.nameLabel}</span>
              <input className="mr-input mr-input--lg" value={d.title} maxLength={120} placeholder={c.namePlaceholder} onChange={(e) => update({ title: e.target.value })} data-mr="place-title" />
            </label>
            <label className="mr-field">
              <span className="mr-label">{c.noteLabel}</span>
              <input className="mr-input" value={d.note} maxLength={600} placeholder={c.notePlaceholder} onChange={(e) => update({ note: e.target.value })} data-mr="place-note" />
            </label>
            <CollectionPicker
              value={d.collectionId && (collectionsStatus !== 'ok' || collections.some((x) => x.id === d.collectionId)) ? d.collectionId : null}
              collections={collections}
              onChange={(collectionId) => update({ collectionId })}
              onCreate={createCollectionQueued}
              hint={COPY.capture.collectionHint}
            />
          </div>
        )}
        {step === 1 && (
          <div className="mr-stepbody mr-location">
            <h2 className="mr-step-title">{c.whereTitle}</h2>
            <LocationPicker loc={d.loc} onChange={(fn) => update((prev) => ({ loc: fn(prev.loc) }))} />
          </div>
        )}
        {(step === 2 || step === 3) && (
          <PhotoStep
            which={step === 2 ? 'plan' : 'outside'}
            photos={d[step === 2 ? 'plan' : 'outside']}
            max={step === 2 ? MAX_PLAN : MAX_OUTSIDE}
            busy={busy}
            thumbUrl={thumbUrl}
            onAdd={(files) => addPhotos(step === 2 ? 'plan' : 'outside', files)}
            onRemove={(id) => removePhoto(step === 2 ? 'plan' : 'outside', id)}
          />
        )}
      </div>
      <div className="mr-actionbar">
        {error && <p className="mr-actionbar-note">{error}</p>}
        <div className="mr-actionbar-row">
          <button type="button" className="mr-btn mr-btn--lg" onClick={back} data-mr="back">
            <Arrow back />
            {COPY.capture.back}
          </button>
          <button type="button" className="mr-btn mr-btn--primary mr-btn--lg mr-actionbar-main" onClick={primary.onClick} disabled={primary.disabled} data-mr={primary.mr}>
            {primary.label}
            {step < 3 && <Arrow />}
          </button>
        </div>
      </div>
    </div>
  );
}

function PhotoStep({ which, photos, max, busy, thumbUrl, onAdd, onRemove }) {
  const c = COPY.placeCapture;
  const cameraRef = useRef(null);
  const libraryRef = useRef(null);
  const guide = which === 'plan' ? null : c.outsideShots;
  return (
    <div className="mr-stepbody">
      <h2 className="mr-step-title">{which === 'plan' ? c.planTitle : c.outsideTitle}</h2>
      <p className="mr-place-capture__lede">{which === 'plan' ? c.planLede : c.outsideLede}</p>
      {guide && (
        <ol className="mr-place-capture__guide">
          {guide.map((g, i) => (
            <li key={g} data-done={i < photos.length ? '' : undefined}>
              <span className="mr-label">{pad2(i + 1)}</span> {g}
            </li>
          ))}
        </ol>
      )}
      <div className="mr-place-capture__buttons">
        <button type="button" className="mr-btn mr-btn--lg" onClick={() => cameraRef.current?.click()} disabled={photos.length >= max || Boolean(busy)} data-mr={`${which}-camera`}>
          {COPY.capture.takePhoto}
        </button>
        <button type="button" className="mr-btn mr-btn--lg" onClick={() => libraryRef.current?.click()} disabled={photos.length >= max || Boolean(busy)} data-mr={`${which}-library`}>
          {COPY.capture.fromLibrary}
        </button>
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => (onAdd(e.target.files), (e.target.value = ''))} />
        <input ref={libraryRef} type="file" accept="image/*" multiple hidden onChange={(e) => (onAdd(e.target.files), (e.target.value = ''))} data-mr={`${which}-input`} />
      </div>
      <p className="mr-label mr-place-capture__count" aria-live="polite">
        {busy ? COPY.capture.processing(busy.i, busy.n) : c.count(photos.length, max, which)}
      </p>
      {photos.length > 0 && (
        <ul className="mr-place-capture__thumbs">
          {photos.map((p, i) => (
            <li key={p.id}>
              <img src={thumbUrl(p)} alt={c.photoAlt(which, i + 1)} />
              <button type="button" className="mr-linkbtn" onClick={() => onRemove(p.id)} aria-label={COPY.capture.removePhoto(i + 1)}>
                {c.remove}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
