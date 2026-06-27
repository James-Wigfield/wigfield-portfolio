/* ============================================================================
   PORTAL — ICON SYSTEM
   ----------------------------------------------------------------------------
   A tiny set of stylish, minimalist, SINGLE-COLOUR line icons. No emoji, no
   font glyphs — every symbol on the portal is one of these SVGs so the whole
   workspace stays visually consistent and on-brand with the Reading Room theme.

   Usage:
     import Icon from '../icons';            // (or './icons' from the shell)
     <Icon name="university" />              // 18px, inherits currentColor
     <Icon name="chevron" size={14} />      // sized for inline use

   Drawing rules (keep new icons consistent):
     • 24×24 viewBox, no fill, stroke = currentColor, 1.6 stroke width.
     • Round caps + joins, geometry that reads at 14–20px.
   Add a new icon by dropping a path fragment into PATHS below, then reference
   it by key from the registry (icon: 'myicon') or anywhere via <Icon name=… />.
   ========================================================================== */

const PATHS = {
  /* ── Nav / page symbols ─────────────────────────────────────────────── */
  // Overview — a 2×2 dashboard grid
  overview: (
    <>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.6" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.6" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.6" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.6" />
    </>
  ),
  // University — a mortarboard / graduation cap
  university: (
    <>
      <path d="M12 4 22 8.5 12 13 2 8.5 12 4Z" />
      <path d="M6 10.4V15c0 1.3 2.7 2.6 6 2.6s6-1.3 6-2.6v-4.6" />
      <path d="M22 8.5v4.4" />
    </>
  ),
  // Syllabite — an open book (study / syllabus)
  syllabite: (
    <>
      <path d="M12 6.6C10.4 5.4 8.1 4.9 5.4 4.9c-.8 0-1.4.6-1.4 1.4v10.8c0 .8.6 1.3 1.4 1.3 2.7 0 5 .5 6.6 1.7" />
      <path d="M12 6.6c1.6-1.2 3.9-1.7 6.6-1.7.8 0 1.4.6 1.4 1.4v10.8c0 .8-.6 1.3-1.4 1.3-2.7 0-5 .5-6.6 1.7" />
      <path d="M12 6.6v13.5" />
    </>
  ),
  // Business — a briefcase
  business: (
    <>
      <rect x="3" y="7.5" width="18" height="12.5" rx="2.2" />
      <path d="M8.5 7.5V6a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v1.5" />
      <path d="M3 13h18" />
    </>
  ),
  // Personal — a single user
  personal: (
    <>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M5 20c0-3.6 3.1-6.2 7-6.2s7 2.6 7 6.2" />
    </>
  ),
  // Investments — a rising trend line with arrowhead
  investments: (
    <>
      <path d="M3 16.8 9.5 10.2l3.8 3.8L21 6.4" />
      <path d="M15.4 6.4H21V12" />
    </>
  ),

  /* ── Module symbols ─────────────────────────────────────────────────── */
  // Honours — a scan / activity waveform (medical imaging)
  honours: <path d="M3 12h3.5l2.2 6.5 4.4-13L15.5 12H21" />,
  // Codebase — a connected node graph
  codebase: (
    <>
      <circle cx="6" cy="12" r="2.4" />
      <circle cx="18" cy="6" r="2.4" />
      <circle cx="18" cy="18" r="2.4" />
      <path d="M8.1 10.9 15.9 7.1" />
      <path d="M8.1 13.1 15.9 16.9" />
    </>
  ),
  // Backend — a database / stack
  backend: (
    <>
      <ellipse cx="12" cy="6" rx="7" ry="3" />
      <path d="M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6" />
      <path d="M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3" />
    </>
  ),

  /* ── Utility glyphs (replace inline text symbols) ───────────────────── */
  chevron: <path d="M9 6 15 12 9 18" />,                 // collapsible caret (right; rotate to open)
  check: <path d="M5 12.5 10 17.5 19 7" />,
  arrowRight: (
    <>
      <path d="M4 12h15" />
      <path d="M13 6l6 6-6 6" />
    </>
  ),
  arrowDown: (
    <>
      <path d="M12 4v15" />
      <path d="M6 13l6 6 6-6" />
    </>
  ),
  arrowLeft: (
    <>
      <path d="M20 12H5" />
      <path d="M11 6l-6 6 6 6" />
    </>
  ),
  swap: (
    <>
      <path d="M6 8.5h13" />
      <path d="M15.5 5l3.5 3.5-3.5 3.5" />
      <path d="M18 15.5H5" />
      <path d="M8.5 12 5 15.5 8.5 19" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3 20 6v6c0 4.6-3.3 7.7-8 9-4.7-1.3-8-4.4-8-9V6l8-3Z" />
      <path d="M8.8 12.2 11 14.4l4.2-4.4" />
    </>
  ),
  edit: (
    <>
      <path d="M4 20h4L19 9l-4-4L4 16v4Z" />
      <path d="M13.5 6.5 17.5 10.5" />
    </>
  ),
  cloud: <path d="M7.5 18.5h9.5a4.2 4.2 0 0 0 .4-8.4 6.2 6.2 0 0 0-12-1.1A4.6 4.6 0 0 0 7.5 18.5Z" />,
};

export default function Icon({ name, size = 18, strokeWidth = 1.6, className, ...rest }) {
  const path = PATHS[name];
  if (!path) return null;
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {path}
    </svg>
  );
}
