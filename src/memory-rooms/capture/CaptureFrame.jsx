/* Capture layout: mono step counters on top, the step in the middle (it
   scrolls on its own if it must), Back + the main action pinned at the bottom
   within thumb reach. */

import { COPY } from '../copy.js';
import { pad2 } from '../lib/format.js';

export const Arrow = ({ back = false }) => (
  <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
    <path d={back ? 'M13 8H3M7 4L3 8l4 4' : 'M3 8h10M9 4l4 4-4 4'} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default function CaptureFrame({ step, onBack, primary, note, children }) {
  const steps = COPY.capture.steps;
  return (
    <div className="mr-capture">
      <ol className="mr-steps" aria-label={COPY.capture.step(step + 1, steps.length)}>
        {steps.map((name, i) => (
          <li key={name} className="mr-step" data-state={i < step ? 'done' : i === step ? 'current' : 'todo'} aria-current={i === step ? 'step' : undefined}>
            <span className="mr-step-n">{pad2(i + 1)}</span>
            <span className="mr-step-name">{name}</span>
          </li>
        ))}
      </ol>

      <div className="mr-capture-body" key={step}>
        {children}
      </div>

      <div className="mr-actionbar">
        {note && <p className="mr-actionbar-note">{note}</p>}
        <div className="mr-actionbar-row">
          <button type="button" className="mr-btn mr-btn--lg" onClick={onBack} data-mr="back">
            <Arrow back />
            {COPY.capture.back}
          </button>
          <button
            type="button"
            className="mr-btn mr-btn--primary mr-btn--lg mr-actionbar-main"
            onClick={primary.onClick}
            disabled={primary.disabled}
            data-mr={primary.mr}
          >
            {primary.label}
            {primary.arrow !== false && <Arrow />}
          </button>
        </div>
      </div>
    </div>
  );
}
