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
  // Portara — a nested gateway / archway (a "portal")
  portara: (
    <>
      <path d="M5 20v-9a7 7 0 0 1 14 0v9" />
      <path d="M8.5 20v-8a3.5 3.5 0 0 1 7 0v8" />
      <path d="M3.5 20h17" />
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
  // Workspace — an app window with a side rail (the live visualizer tool)
  workspace: (
    <>
      <rect x="3" y="4.5" width="18" height="15" rx="2" />
      <path d="M9 4.5v15" />
      <path d="M12 9h6" />
      <path d="M12 13h6" />
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
  // Wall Art — a framed landscape (a picture on the wall)
  art: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="1.8" />
      <circle cx="8.8" cy="9" r="1.5" />
      <path d="M4.7 16.6 9 12l2.7 2.7L15 11l4.3 4.3" />
    </>
  ),
  // Pixel — a sprite canvas (3×3 grid) with one lit pixel
  pixel: (
    <>
      <rect x="4.5" y="4.5" width="15" height="15" rx="1.4" />
      <path d="M9.5 4.5v15M14.5 4.5v15M4.5 9.5h15M4.5 14.5h15" />
      <rect x="9.5" y="9.5" width="5" height="5" rx="0.4" fill="currentColor" stroke="none" />
    </>
  ),
  // Link — two chain links (wiring tools together: studio ↔ Supabase ↔ MCP)
  link: (
    <>
      <path d="M10 13.5a3.2 3.2 0 0 0 4.6.3l2.6-2.6a3.2 3.2 0 1 0-4.5-4.5l-1.3 1.3" />
      <path d="M14 10.5a3.2 3.2 0 0 0-4.6-.3l-2.6 2.6a3.2 3.2 0 1 0 4.5 4.5l1.3-1.3" />
    </>
  ),
  // Feedback — a speech bubble with message lines (user submissions)
  feedback: (
    <>
      <path d="M20 4.5H4A1.5 1.5 0 0 0 2.5 6v9A1.5 1.5 0 0 0 4 16.5h3v3.4l4.2-3.4H20A1.5 1.5 0 0 0 21.5 15V6A1.5 1.5 0 0 0 20 4.5Z" />
      <path d="M6.5 9.5h11M6.5 12.5h7" />
    </>
  ),
  // Eye — an almond eye with an iris (PD Reader: reads pupil centres from a scan)
  eye: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3.1" />
    </>
  ),
  // Mamba Updates — a document (a written page) with a scan waveform, tying the
  // honours-project explainer feed to the tracker's imaging motif.
  mamba: (
    <>
      <path d="M6 3.5h8L18.5 8v11a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 19V5A1.5 1.5 0 0 1 6 3.5Z" />
      <path d="M14 3.5V8h4.5" />
      <path d="M7.5 14h1.7l1 2.6 1.5-4.2 1 1.6h3.3" />
    </>
  ),
  // Presentations — a projector screen on a stand with a rising line inside
  presentation: (
    <>
      <rect x="3" y="4" width="18" height="12" rx="1.8" />
      <path d="M12 16v4" />
      <path d="M9 20.5h6" />
      <path d="M7.5 12l3-3.2 2 2L16.5 7" />
    </>
  ),
  // Deck Studio — a stack of slides (a front card + one peeking behind it)
  deck: (
    <>
      <rect x="3.5" y="7" width="13" height="10.5" rx="1.6" />
      <path d="M7 7V6a1.5 1.5 0 0 1 1.5-1.5H19A1.5 1.5 0 0 1 20.5 6v9.5A1.5 1.5 0 0 1 19 17h-2.5" />
    </>
  ),
  // Flask — an Erlenmeyer flask (an interactive "lab" / playground explainer)
  flask: (
    <>
      <path d="M9.2 3.5h5.6" />
      <path d="M10 3.5v5.6L5.1 17.9A1.7 1.7 0 0 0 6.6 20.5h10.8a1.7 1.7 0 0 0 1.5-2.6L14 9.1V3.5" />
      <path d="M7.6 14.5h8.8" />
    </>
  ),
  // Cube — an isometric box (a 3-D tensor / volume; the shape-tracer tab)
  cube: (
    <>
      <path d="M12 3 20.5 8v8L12 21 3.5 16V8L12 3Z" />
      <path d="M3.5 8 12 13l8.5-5" />
      <path d="M12 13v8" />
    </>
  ),

  /* ── Utility glyphs (replace inline text symbols) ───────────────────── */
  chevron: <path d="M9 6 15 12 9 18" />,                 // collapsible caret (right; rotate to open)
  check: <path d="M5 12.5 10 17.5 19 7" />,
  // Enter full-screen — four corner brackets pointing outward
  expand: (
    <>
      <path d="M8 3H3v5" />
      <path d="M16 3h5v5" />
      <path d="M3 16v5h5" />
      <path d="M21 16v5h-5" />
    </>
  ),
  // Exit full-screen — four corner brackets pointing inward
  compress: (
    <>
      <path d="M3 8h5V3" />
      <path d="M21 8h-5V3" />
      <path d="M3 16h5v5" />
      <path d="M21 16h-5v5" />
    </>
  ),
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
  download: (
    <>
      <path d="M12 3.5v11" />
      <path d="M7.5 10 12 14.5 16.5 10" />
      <path d="M5 19.5h14" />
    </>
  ),
  printer: (
    <>
      <path d="M7 8.5V4h10v4.5" />
      <rect x="4.5" y="8.5" width="15" height="7.5" rx="1.6" />
      <rect x="7.5" y="13.5" width="9" height="5.8" rx="1" />
      <circle cx="16.3" cy="11.4" r="0.7" />
    </>
  ),
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
