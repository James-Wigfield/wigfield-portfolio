/* /memories/new: phone-first capture, one screen per step.
   01 Place (kind + name) → 02 Photos (shot guide) → 03 Memory → 04 Location → Saved.
   Old photos ("I can't retake them", CONTRACTS.md 8): 01 Place → 02 Photos (any order, up to 40, captions) →
   03 Layout (optional: skip, or sketch the room and place the photos) → 04 Memory (+ when) → 05 Location.
   The draft lives in IndexedDB the whole way (capture/useDraft.js); Save moves it
   to the outbox (lib/outbox.js), which uploads it whenever there's signal. */

import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { COPY } from '../copy.js';
import { paths } from '../routes.js';
import CaptureFrame from '../capture/CaptureFrame.jsx';
import Saved from '../capture/Saved.jsx';
import StepKind from '../capture/StepKind.jsx';
import StepLocation from '../capture/StepLocation.jsx';
import StepMemory from '../capture/StepMemory.jsx';
import StepPhotos from '../capture/StepPhotos.jsx';
import { photoLimits, useDraft } from '../capture/useDraft.js';
import StepLayout from '../capture/StepLayout.jsx';
import StepPhotosFreeform from '../capture/StepPhotosFreeform.jsx';
import { rectOutline } from '../capture/layout/geometry.js';
import { getPlaceLocal } from '../lib/places.js';
import { api } from '../lib/api.js';
import CollectionPicker from '../capture/CollectionPicker.jsx';
import { createCollectionQueued, useCollections } from '../lib/collections.js';
import { usePhotoQueue } from '../capture/usePhotoQueue.js';
import { useShell } from '../shell/ShellContext.js';

export default function CapturePage() {
  const c = COPY.capture;
  const { who } = useShell();
  const navigate = useNavigate();
  const d = useDraft();
  const { draft } = d;
  const limits = photoLimits(draft);
  const freeform = draft.mode === 'freeform';
  const queue = usePhotoQueue({ count: draft.photos.length, addPhoto: d.addPhoto, max: limits.max });
  const [saved, setSaved] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const thumbUrls = useRef([]); // object URLs for the Saved screen's thumbnails
  const { collections, status: collectionsStatus } = useCollections();
  // a room of a whole place, old photos: its rectangle on the place's sketch is the offered starting outline
  const [roomRect, setRoomRect] = useState(null);
  useEffect(() => {
    if (!draft.loaded || !freeform || !draft.buildingId || !draft.roomId) return undefined;
    let alive = true;
    (async () => {
      const local = await getPlaceLocal(draft.buildingId).catch(() => null);
      const sketch = local?.sketch || (await api.getBuilding(draft.buildingId).catch(() => null))?.sketch;
      const rect = sketch?.rooms?.find((r) => r.id === draft.roomId)?.rect;
      if (alive && rect) setRoomRect(rectOutline(rect[2], rect[3]));
    })();
    return () => {
      alive = false;
    };
  }, [draft.loaded, freeform, draft.buildingId, draft.roomId]);

  // the collection used last may have been deleted since: once the list is known, fall back to none
  useEffect(() => {
    if (!draft.loaded || !draft.collectionId || collectionsStatus !== 'ok') return;
    if (!collections.some((x) => x.id === draft.collectionId)) d.set({ collectionId: null });
  }, [draft.loaded, draft.collectionId, collections, collectionsStatus, d]);

  // A room of a whole place (?building=&room=&name=&of=): the place's checklist sends the room in.
  // It fills a fresh draft only, so a draft in progress is never overwritten.
  // Once per visit: after this room is saved the URL still names it, and "Capture another" must
  // open a plain capture, not the same room again.
  const [params] = useSearchParams();
  const forBuilding = params.get('building');
  const prefilled = useRef(null);
  useEffect(() => {
    if (!draft.loaded || !forBuilding) return;
    const key = `${forBuilding}|${params.get('room')}`;
    if (prefilled.current === key) return;
    prefilled.current = key;
    if (draft.buildingId === forBuilding && draft.roomId === params.get('room')) return;
    if (draft.kind || draft.title || draft.photos.length) return;
    d.set({ kind: 'interior', title: params.get('name') || '', buildingId: forBuilding, roomId: params.get('room'), roomOf: params.get('of') || null, roomName: params.get('name') || null });
  }, [draft.loaded, forBuilding, params, draft.buildingId, draft.roomId, draft.kind, draft.title, draft.photos.length, d]);

  const releaseThumbs = () => {
    thumbUrls.current.forEach((u) => URL.revokeObjectURL(u));
    thumbUrls.current = [];
  };
  useEffect(() => () => thumbUrls.current.forEach((u) => URL.revokeObjectURL(u)), []);

  if (saved)
    return (
      <Saved
        saved={saved}
        onAnother={() => {
          releaseThumbs();
          setSaved(null);
        }}
      />
    );
  if (!draft.loaded)
    return (
      <div className="mr-capture">
        <p className="mr-state-body mr-capture-loading">{c.loading}</p>
      </div>
    );

  const names = freeform ? ['kind', 'photos', 'layout', 'memory', 'location'] : ['kind', 'photos', 'memory', 'location'];
  const step = Math.min(draft.step, names.length - 1);
  const at = names[step];
  const last = names.length - 1;
  const go = (n) => {
    setSaveError(null); // a save message belongs to the step it was shown on
    d.set({ step: n });
  };
  const validOf = {
    kind: Boolean(draft.kind && draft.kind !== 'place' && draft.title.trim()),
    photos: draft.photos.length >= limits.min && !queue.busy,
    layout: true,
    memory: Boolean(draft.note.trim()),
    location: !saving,
  };
  const valid = names.map((n) => validOf[n]);
  const back = () => (step === 0 ? navigate(paths.home()) : go(step - 1));

  const save = async () => {
    // A draft restored after a reload can come back without its photos (if the
    // phone couldn't store them): never save a spot with fewer than the minimum.
    if (draft.photos.length < limits.min) {
      go(1);
      setSaveError(c.photosMissing);
      return;
    }
    setSaving(true);
    setSaveError(null);
    // Saving is local (IndexedDB) and normally takes well under a second; never spin silently.
    const slow = setTimeout(() => setSaveError(c.saveSlow), 12000);
    try {
      const result = await d.save(who || 'james');
      releaseThumbs();
      thumbUrls.current = (result.thumbs || []).map((b) => URL.createObjectURL(b));
      setSaveError(null);
      setSaved({ ...result, thumbUrls: thumbUrls.current });
    } catch (err) {
      console.error('[memory-rooms] save', err);
      setSaveError(c.saveFailed);
    } finally {
      clearTimeout(slow);
      setSaving(false);
    }
  };

  // "A whole place" has its own capture (name, location, floor plan, outside, then its rooms)
  // (the draft goes back to empty: "A whole place" is never left behind as a draft kind, which would
  // stop a room of that place from prefilling later)
  const toPlace = () => {
    const title = draft.title;
    d.reset();
    navigate(paths.capturePlace(), { state: { title } });
  };
  const primary =
    step === 0 && draft.kind === 'place'
      ? { label: c.next, mr: 'next', disabled: false, onClick: toPlace }
      : step < last
      ? { label: c.next, mr: 'next', disabled: !valid[step], onClick: () => valid[step] && go(step + 1) }
      : { label: saving ? c.saving : c.save, mr: 'save', disabled: saving, onClick: save, arrow: false };

  // Offer a clean slate when an old draft came back, or once there's real work to throw away.
  const dirty = Boolean(draft.restored || draft.photos.length);

  return (
    <CaptureFrame step={step} onBack={back} primary={primary} note={saveError} steps={freeform ? COPY.freeform.steps : c.steps}>
      {at === 'kind' && (
        <>
          {draft.restored && <p className="mr-restored">{c.restored}</p>}
          {draft.buildingId && <p className="mr-restored" data-mr="room-of">{c.roomOf(draft.roomOf, draft.roomName || draft.title)}</p>}
          <StepKind
            kind={draft.kind}
            title={draft.title}
            places={!draft.buildingId}
            onKind={(kind) => d.set({ kind })}
            onTitle={(title) => d.set({ title })}
            onSubmit={() => (draft.kind === 'place' ? toPlace() : valid[0] && go(1))}
            mode={draft.mode}
            onMode={(mode) => d.set({ mode })}
          />
          {!draft.buildingId && draft.kind !== 'place' && (
            <CollectionPicker
              value={draft.collectionId}
              collections={collections}
              onChange={(collectionId) => d.set({ collectionId })}
              onCreate={createCollectionQueued}
              hint={c.collectionHint}
            />
          )}
          {dirty && (
            <div className="mr-startover">
              <button
                type="button"
                className="mr-linkbtn"
                data-mr="start-over"
                onClick={() => {
                  if (!confirmReset) return setConfirmReset(true);
                  setConfirmReset(false);
                  d.reset();
                }}
              >
                {confirmReset ? c.startOverConfirm : c.startOver}
              </button>
            </div>
          )}
        </>
      )}
      {at === 'photos' && !freeform && <StepPhotos kind={draft.kind} photos={draft.photos} queue={queue} onRemove={d.removePhoto} />}
      {at === 'photos' && freeform && (
        <StepPhotosFreeform
          photos={draft.photos}
          queue={queue}
          captions={draft.captions || {}}
          onCaption={(id, text) => d.update((s) => ({ captions: { ...(s.captions || {}), [id]: text } }))}
          onRemove={d.removePhoto}
        />
      )}
      {at === 'layout' && (
        <StepLayout
          choice={draft.layoutChoice}
          value={{ layout: draft.layout, views: (draft.views || []).map(({ photoId, ...v }) => ({ ...v, photo: draft.photos.findIndex((p) => p.id === photoId) + 1 })).filter((v) => v.photo > 0) }}
          photos={draft.photos.map((p, i) => ({ n: i + 1, url: p.url, width: p.width, height: p.height, exif: p.exif, caption: draft.captions?.[p.id] || '' }))}
          start={roomRect}
          onChoice={(layoutChoice) => d.set({ layoutChoice })}
          onChange={(next) =>
            d.set({
              layout: next.layout,
              views: next.views.map(({ photo, ...v }) => ({ ...v, photoId: draft.photos[photo - 1]?.id })).filter((v) => v.photoId),
            })
          }
        />
      )}
      {at === 'memory' && (
        <StepMemory
          note={draft.note}
          scaleHint={draft.scaleHint}
          scalePreset={draft.scalePreset}
          scan={draft.scan}
          onNote={(note) => d.set({ note })}
          onScale={(patch) => d.set(patch)}
          onScan={d.setScan}
          onRemoveScan={d.removeScan}
          era={draft.era}
          onEra={freeform ? (era) => d.set({ era }) : null}
        />
      )}
      {at === 'location' && <StepLocation loc={draft.loc} update={d.update} />}
    </CaptureFrame>
  );
}
