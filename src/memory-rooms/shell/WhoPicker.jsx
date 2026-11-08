/* "Who's holding this phone?": once per device, changeable from the header. */

import { COPY } from '../copy.js';
import { PEOPLE } from '../lib/storage.js';

export default function WhoPicker({ current, onPick, onCancel }) {
  return (
    <main className="mr-gate">
      <div className="mr-gate-form">
        <p className="mr-label">{COPY.gate.whoLabel}</p>
        <h1 className="mr-gate-title">{COPY.gate.whoTitle}</h1>
        <div className="mr-who">
          {PEOPLE.map((p, i) => (
            <button
              key={p}
              type="button"
              className="mr-who-btn"
              aria-pressed={current === p}
              data-mr={`who-${p}`}
              onClick={() => onPick(p)}
            >
              <span className="mr-label">{String(i + 1).padStart(2, '0')}</span>
              <span className="mr-who-name">{COPY.app.people[p]}</span>
            </button>
          ))}
        </div>
        <p className="mr-gate-note">{COPY.gate.whoNote}</p>
        {onCancel && (
          <button type="button" className="mr-btn mr-btn--quiet" onClick={onCancel}>
            {COPY.gate.whoCancel}
          </button>
        )}
      </div>
    </main>
  );
}
