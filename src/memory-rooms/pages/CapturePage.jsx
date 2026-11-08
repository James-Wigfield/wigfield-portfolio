/* /memories/new: phone-first capture, one screen per step.
   01 Place (kind + name) → 02 Photos (shot guide) → 03 Memory → 04 Location → Saved.
   The draft lives in IndexedDB the whole way (capture/useDraft.js); Save moves it
   to the outbox (lib/outbox.js), which uploads it whenever there's signal. */

import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { COPY } from '../copy.js';
import { paths } from '../routes.js';
import CaptureFrame from '../capture/CaptureFrame.jsx';
import Saved from '../capture/Saved.jsx';
import StepKind from '../capture/StepKind.jsx';
import StepLocation from '../capture/StepLocation.jsx';
import StepMemory from '../capture/StepMemory.jsx';
import StepPhotos from '../capture/StepPhotos.jsx';
import { MIN_PHOTOS, useDraft } from '../capture/useDraft.js';
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
  const go = (n) => d.set({ step: n });
  const valid = [
    Boolean(draft.kind && draft.title.trim()),
    draft.photos.length >= MIN_PHOTOS && !queue.busy,
    Boolean(draft.note.trim()),
    !saving,
  ];
  const back = () => (step === 0 ? navigate(paths.home()) : go(step - 1));

  const save = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const result = await d.save(who || 'james');
      releaseThumbs();
      thumbUrls.current = (result.thumbs || []).map((b) => URL.createObjectURL(b));
      setSaved({ ...result, thumbUrls: thumbUrls.current });
    } catch (err) {
      console.error('[memory-rooms] save', err);
      setSaveError(c.saveFailed);
    } finally {
      setSaving(false);
    }
  };

  const primary =
    step < 3
      ? { label: c.next, mr: 'next', disabled: !valid[step], onClick: () => valid[step] && go(step + 1) }
      : { label: saving ? c.saving : c.save, mr: 'save', disabled: saving, onClick: save, arrow: false };

  // Offer a clean slate when an old draft came back, or once there's real work to throw away.
  const dirty = Boolean(draft.restored || draft.photos.length);

  return (
    <CaptureFrame step={step} onBack={back} primary={primary} note={saveError}>
      {step === 0 && (
        <>
          {draft.restored && <p className="mr-restored">{c.restored}</p>}
          <StepKind
            kind={draft.kind}
            title={draft.title}
            onKind={(kind) => d.set({ kind })}
            onTitle={(title) => d.set({ title })}
            onSubmit={() => valid[0] && go(1)}
          />
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
