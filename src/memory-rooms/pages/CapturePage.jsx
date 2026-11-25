/* /memories/new: phone-first capture, one screen per step.
   01 Place (kind + name) → 02 Photos (shot guide) → 03 Memory → 04 Location → Saved.
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
import { MIN_PHOTOS, useDraft } from '../capture/useDraft.js';
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
  const queue = usePhotoQueue({ count: draft.photos.length, addPhoto: d.addPhoto });
  const [saved, setSaved] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const thumbUrls = useRef([]); // object URLs for the Saved screen's thumbnails
  const { collections, status: collectionsStatus } = useCollections();

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

  const step = draft.step;
  const go = (n) => {
    setSaveError(null); // a save message belongs to the step it was shown on
    d.set({ step: n });
  };
  const valid = [
    Boolean(draft.kind && draft.kind !== 'place' && draft.title.trim()),
    draft.photos.length >= MIN_PHOTOS && !queue.busy,
    Boolean(draft.note.trim()),
    !saving,
  ];
  const back = () => (step === 0 ? navigate(paths.home()) : go(step - 1));

  const save = async () => {
    // A draft restored after a reload can come back without its photos (if the
    // phone couldn't store them): never save a spot with fewer than the minimum.
    if (draft.photos.length < MIN_PHOTOS) {
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
      : step < 3
      ? { label: c.next, mr: 'next', disabled: !valid[step], onClick: () => valid[step] && go(step + 1) }
      : { label: saving ? c.saving : c.save, mr: 'save', disabled: saving, onClick: save, arrow: false };

  // Offer a clean slate when an old draft came back, or once there's real work to throw away.
  const dirty = Boolean(draft.restored || draft.photos.length);

  return (
    <CaptureFrame step={step} onBack={back} primary={primary} note={saveError}>
      {step === 0 && (
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
      {step === 1 && <StepPhotos kind={draft.kind} photos={draft.photos} queue={queue} onRemove={d.removePhoto} />}
      {step === 2 && (
        <StepMemory
          note={draft.note}
          scaleHint={draft.scaleHint}
          scalePreset={draft.scalePreset}
          scan={draft.scan}
          onNote={(note) => d.set({ note })}
          onScale={(patch) => d.set(patch)}
          onScan={d.setScan}
          onRemoveScan={d.removeScan}
        />
      )}
      {step === 3 && <StepLocation loc={draft.loc} update={d.update} />}
    </CaptureFrame>
  );
}
