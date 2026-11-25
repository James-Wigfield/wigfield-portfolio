/* A row's status as a small labelled dot (no pills, no badges). */

import { statusLabel } from '../copy.js';

export default function StatusDot({ status, label }) {
  return (
    <span className="dr-dot" data-status={status} data-dr="status">
      <i aria-hidden="true" />
      {label ?? statusLabel(status)}
    </span>
  );
}
