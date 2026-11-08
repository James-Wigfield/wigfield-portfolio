/* One quiet ruled line under the header whenever the outbox holds anything:
   "2 to upload · uploading 3 of 14", "… · waiting for signal", or per-entry
   problems. Screens that show the status themselves (Saved) hide it. */

import { COPY } from '../copy.js';
import { retryOutbox } from '../lib/outbox.js';
import { toneOf, uploadState } from '../lib/uploadState.js';
import { useOutbox } from '../lib/useOutbox.js';
import { useOutboxStripHidden } from './outboxStrip.js';

export default function OutboxStatus() {
  const box = useOutbox();
  const hiddenHere = useOutboxStripHidden();
  const { entries, pending, volatile } = box;
  const attention = entries.filter((e) => e.state === 'error');
  const st = uploadState(box);
  const S = COPY.outbox.state;

  const parts = [COPY.outbox.toUpload(pending)];
  if (pending > attention.length) parts.push(st.key === 'uploading' ? S.uploading(st.index, st.total) : S[st.key] || '');
  if (attention.length) parts.push(COPY.outbox.attention(attention.length));
  const tone = attention.length && !box.current ? 'danger' : toneOf(st.key);

  return (
    <div
      className="mr-outbox"
      data-mr="outbox"
      data-pending={pending}
      data-state={st.key}
      data-tone={tone}
      hidden={pending === 0 || hiddenHere}
      role="status"
      aria-live="polite"
    >
      <div className="mr-outbox-line">
        <span className="mr-label mr-outbox-label">{COPY.outbox.label}</span>
        <span className="mr-outbox-text">
          <span className="mr-outbox-dot" aria-hidden="true" />
          {parts.filter(Boolean).join(' · ')}
        </span>
        {st.key === 'waiting' && (
          <button type="button" className="mr-linkbtn" onClick={() => retryOutbox()} data-mr="outbox-retry">
            {COPY.outbox.retry}
          </button>
        )}
      </div>
      {attention.map((e) => (
        <div className="mr-outbox-line mr-outbox-entry" key={e.id}>
          <span className="mr-outbox-text">
            <strong>{e.title}</strong> · {e.error?.message || ''} · {COPY.outbox.files(e.uploaded, e.total)}
          </span>
          <button type="button" className="mr-linkbtn" onClick={() => retryOutbox(e.id)}>
            {COPY.outbox.retry}
          </button>
        </div>
      ))}
      {volatile && pending > 0 && <p className="mr-outbox-line mr-outbox-text">{COPY.outbox.volatile}</p>}
    </div>
  );
}
