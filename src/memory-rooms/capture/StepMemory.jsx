import { useState } from 'react';
import { COPY } from '../copy.js';
import { formatBytes } from '../lib/format.js';
import { MAX_SCAN_BYTES } from './useDraft.js';

const Plus = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
    <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

export default function StepMemory({ note, scaleHint, scalePreset, scan, onNote, onScale, onScan, onRemoveScan }) {
  const c = COPY.capture;
  const [scanError, setScanError] = useState(null);
  const [scanOpen, setScanOpen] = useState(false);
  const showScan = scanOpen || Boolean(scan) || Boolean(scanError);

  const pickScan = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!/\.spz$/i.test(file.name)) return setScanError(c.scanWrongType);
    if (file.size > MAX_SCAN_BYTES) return setScanError(c.scanTooBig);
    setScanError(null);
    onScan(file);
  };

  return (
    <div className="mr-stepbody">
      <h2 className="mr-step-title">{c.memoryTitle}</h2>

      <label className="mr-field">
        <span className="mr-label">{c.noteLabel}</span>
        <textarea
          className="mr-input mr-textarea"
          rows={3}
          maxLength={600}
          value={note}
          placeholder={c.notePlaceholder}
          enterKeyHint="done"
          onChange={(e) => onNote(e.target.value.replace(/\s*\n+\s*/g, ' '))}
          data-mr="note-input"
        />
        <span className="mr-field-hint">{c.noteHint}</span>
      </label>

      <fieldset className="mr-field">
        <legend className="mr-label">{c.scaleLabel}</legend>
        <div className="mr-presets">
          {c.scalePresets.map((p) => (
            <button
              key={p.value}
              type="button"
              className="mr-preset"
              aria-pressed={scalePreset === p.value}
              data-mr="scale-preset"
              data-value={p.value}
              onClick={() => onScale(scalePreset === p.value ? { scaleHint: '', scalePreset: null } : { scaleHint: p.value, scalePreset: p.value })}
            >
              {p.label}
            </button>
          ))}
        </div>
        <label className="mr-subfield">
          <span className="mr-sublabel">{c.scaleOther}</span>
          <input
            className="mr-input"
            type="text"
            maxLength={80}
            value={scalePreset ? '' : scaleHint}
            placeholder={c.scalePlaceholder}
            onChange={(e) => onScale({ scaleHint: e.target.value, scalePreset: null })}
            data-mr="scale-input"
          />
        </label>
      </fieldset>

      <div className="mr-scan" data-open={showScan ? '' : undefined}>
        {/* The input is always in the page (visually hidden) so a file can arrive while collapsed. */}
        <input type="file" accept=".spz" id="mr-scan-input" className="mr-visually-hidden" onChange={pickScan} data-mr="scan-input" />
        {!showScan ? (
          <button type="button" className="mr-disclosure" onClick={() => setScanOpen(true)} aria-expanded="false" data-mr="scan-toggle">
            <Plus />
            {c.scanToggle}
          </button>
        ) : (
          <div className="mr-field">
            <span className="mr-label">
              {c.scanLabel} · {c.scanOptional}
            </span>
            {scan ? (
              <p className="mr-scan-file" data-mr="scan-file">
                <span className="mr-scan-name">{scan.name}</span>
                <span className="mr-label">{formatBytes(scan.size)}</span>
              </p>
            ) : (
              <p className="mr-field-hint">{c.scanHint}</p>
            )}
            <div className="mr-scan-actions">
              <label className="mr-btn" htmlFor="mr-scan-input">
                {scan ? c.scanReplace : c.scanAttach}
              </label>
              {scan && (
                <button type="button" className="mr-btn mr-btn--quiet" onClick={onRemoveScan}>
                  {c.scanRemove}
                </button>
              )}
            </div>
            {scanError && (
              <p className="mr-msg" data-tone="danger">
                {scanError}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
