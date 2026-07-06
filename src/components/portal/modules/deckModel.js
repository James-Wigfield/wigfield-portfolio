/* ============================================================================
   DECK STUDIO — the shared deck model (the JSON contract)
   ----------------------------------------------------------------------------
   One presentation ("deck") is a plain-JSON object. The SAME shape is produced
   by the portal MCP server, stored in Supabase (`presentations.deck`), rendered
   by DeckCanvas, and (later) edited in-portal. This file is the browser-side
   source of truth for that shape + a couple of tiny helpers.

     Deck = {
       version: 1,
       title:      string,
       dateLabel:  string,               // the tab label
       canvas:     { w, h },             // fixed logical space (1280×720)
       slides: [ Slide ]
     }
     Slide = {
       id:         string,
       background: { type: 'color'|'none', color? },
       elements: [ Element ]             // rendered in ascending z order
     }
     Element (text) = {
       id, type: 'text',
       x, y, w, h,                       // in canvas units (top-left origin)
       z,                                // stacking order
       rotation?: deg,
       markdown:   string,               // rendered by markdownLite → React
       style?: { fontSize?, align?: 'left'|'center'|'right', color?, bg?, weight? }
     }
     Element (image) = {                 // Phase 4
       id, type: 'image', x, y, w, h, z, rotation?, src, fit?: 'contain'|'cover', alt?
     }

   Colours may be a literal (`#0d7267`, `rgb(...)`) OR a theme token string
   `token:<name>` (e.g. `token:accent`) → resolved to `var(--<name>)` so decks
   re-skin with the active portal theme. See resolveColor().
   ========================================================================== */

// The fixed logical canvas. Everything positions inside this; the stage scales
// the whole canvas to fit (in-page and in full screen). 16:9.
export const CANVAS = { w: 1280, h: 720 };

// Resolve a colour value: `token:accent` → `var(--accent)`, literals pass through.
export function resolveColor(value) {
  if (typeof value !== 'string' || value === '') return undefined;
  return value.startsWith('token:') ? `var(--${value.slice(6)})` : value;
}

/* ── A hand-seeded sample deck ───────────────────────────────────────────────
   Shown when the backend has no decks yet (or isn't wired up). Positioned to
   match what the MCP layout engine produces, so a generated deck looks the same. */
export const SAMPLE_DECK = {
  version: 1,
  id: 'sample',
  title: 'Welcome to Deck Studio',
  dateLabel: 'Sample',
  isSample: true,
  canvas: { ...CANVAS },
  slides: [
    {
      id: 's1',
      background: { type: 'color', color: 'token:surface' },
      elements: [
        { id: 'e1', type: 'text', x: 80, y: 196, w: 1120, h: 50, z: 1,
          markdown: 'DECK STUDIO',
          style: { fontSize: 26, align: 'center', color: 'token:accent-ink' } },
        { id: 'e2', type: 'text', x: 120, y: 252, w: 1040, h: 200, z: 2,
          markdown: 'AI-built, drag-to-edit slide decks',
          style: { fontSize: 66, align: 'center', color: 'token:ink' } },
        { id: 'e3', type: 'text', x: 160, y: 468, w: 960, h: 90, z: 3,
          markdown: 'Ask Claude to build a deck — it appears right here.',
          style: { fontSize: 30, align: 'center', color: 'token:ink-2' } },
      ],
    },
    {
      id: 's2',
      background: { type: 'color', color: 'token:surface' },
      elements: [
        { id: 'e1', type: 'text', x: 80, y: 70, w: 1120, h: 110, z: 1,
          markdown: 'How it works',
          style: { fontSize: 48, align: 'left', color: 'token:ink' } },
        { id: 'e2', type: 'text', x: 80, y: 208, w: 1120, h: 432, z: 2,
          markdown:
            '- Claude builds a deck through the portal **MCP server**\n' +
            "- It's saved to Supabase as JSON\n" +
            '- It shows up as a tab on this page\n' +
            '- Every element is a *movable layer* you can edit',
          style: { fontSize: 32, align: 'left', color: 'token:ink-2' } },
      ],
    },
    {
      id: 's3',
      background: { type: 'color', color: 'token:surface' },
      elements: [
        { id: 'e1', type: 'text', x: 80, y: 70, w: 1120, h: 110, z: 1,
          markdown: 'Text boxes are markdown',
          style: { fontSize: 48, align: 'left', color: 'token:ink' } },
        { id: 'e2', type: 'text', x: 80, y: 208, w: 520, h: 432, z: 2,
          markdown:
            '**Bold**, *italic*, and `code`.\n\n' +
            '- Bullet lists\n- [Links](https://example.com)\n\n' +
            '> And blockquotes.',
          style: { fontSize: 28, align: 'left', color: 'token:ink-2' } },
        { id: 'e3', type: 'text', x: 640, y: 208, w: 560, h: 432, z: 3,
          markdown:
            '### Fixed boxes\n\n' +
            'Boxes keep their size — text clips if it overflows.\n\n' +
            'Drag to move and resize with handles *(editor coming soon)*.',
          style: { fontSize: 28, align: 'left', color: 'token:ink-2' } },
      ],
    },
    {
      id: 's4',
      background: { type: 'color', color: 'token:surface' },
      elements: [
        { id: 'e1', type: 'text', x: 140, y: 300, w: 1000, h: 140, z: 1,
          markdown: 'Ready when you are.',
          style: { fontSize: 60, align: 'center', color: 'token:accent' } },
      ],
    },
  ],
};
