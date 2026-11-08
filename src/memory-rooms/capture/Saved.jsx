/* After Save: the capture is in the outbox. This screen is the one place its
   upload status shows (the line under the header hides while it's open). */

import { Link } from 'react-router-dom';
import { COPY } from '../copy.js';
import { paths } from '../routes.js';
import { pad2 } from '../lib/format.js';
import { retryOutbox } from '../lib/outbox.js';
import { toneOf, uploadState } from '../lib/uploadState.js';
import { useOutbox } from '../lib/useOutbox.js';
import { useHideOutboxStrip } from '../shell/outboxStrip.js';

export default function Saved({ saved, onAnother }) {
  const c = COPY.capture;
  useHideOutboxStrip();
  const box = useOutbox();
  const st = uploadState(box, saved.id);
  const entry = box.entries.find((e) => e.id === saved.id);
  const total = entry?.total || saved.files || 1;
  const done = st.key === 'done' ? total : entry?.uploaded || 0;
  const others = box.entries.filter((e) => e.id !== saved.id && e.state !== 'done').length;
  const line = st.key === 'uploading' ? c.saved.uploading(st.index, st.total) : c.saved[st.key];
  const thumbs = saved.thumbUrls || [];

  return (
    <div className="mr-capture mr-saved" data-mr="saved" data-id={saved.id} data-upload={entry?.state || 'done'} data-state={st.key}>
      <div className="mr-capture-body">
        <div className="mr-stepbody mr-saved-body">
          <p className="mr-label">{c.savedLabel}</p>
          <h2 className="mr-saved-title">{saved.title}</h2>
          {thumbs.length > 0 && (
            <ol className="mr-saved-thumbs" aria-label={c.savedPhotos(thumbs.length)}>
              {thumbs.map((url, i) => (
                <li key={url} className="mr-thumb">
                  <img src={url} alt="" />
                  <span className="mr-thumb-n">{pad2(i + 1)}</span>
                </li>
              ))}
            </ol>
          )}
          <div
            className="mr-progress"
            data-done={st.key === 'done' ? '' : undefined}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={done}
          >
            <span style={{ transform: `scaleX(${st.key === 'done' ? 1 : Math.min(1, done / total)})` }} />
          </div>
          <div className="mr-saved-status">
            <p className="mr-dot" data-tone={toneOf(st.key)} data-mr="saved-status">
              {line}
            </p>
            {(st.key === 'error' || st.key === 'waiting') && (
              <button type="button" className="mr-linkbtn" onClick={() => retryOutbox(st.key === 'error' ? saved.id : undefined)}>
                {COPY.outbox.retry}
              </button>
            )}
          </div>
          {others > 0 && <p className="mr-saved-others">{c.savedOthers(others)}</p>}
        </div>
      </div>
      <div className="mr-actionbar">
        <div className="mr-actionbar-row">
          <Link to={paths.home()} className="mr-btn mr-btn--lg" data-mr="saved-map">
            {c.seeMap}
          </Link>
          <button type="button" className="mr-btn mr-btn--primary mr-btn--lg mr-actionbar-main" onClick={onAnother} data-mr="capture-another">
            {c.captureAnother}
          </button>
        </div>
      </div>
    </div>
  );
}
