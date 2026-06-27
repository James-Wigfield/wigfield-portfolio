/* ============================================================================
   PORTAL — THEMES
   ----------------------------------------------------------------------------
   The portal's visual themes. Each theme = a banner gif + a palette. The
   palette itself lives in portal.css (a token block keyed by `data-portal-theme`
   = the theme `id`); this file is the JS side: the gif, the picker label, and
   the swatch colours shown in the banner theme selector.

   ADD A THEME (the whole job):
     1. Drop the gif in src/assets/gifs/ and import it below.
     2. Add an entry here: { id, label, gif, swatch: { bg, accent } }.
     3. Add a matching palette block in portal.css:
          .hp.portal[data-portal-theme="<id>"],
          .hp.portal-gate[data-portal-theme="<id>"] { --ground: …; --accent: …; }
   The first entry is the default. Nothing else needs to change.
   ========================================================================== */

import computerGif from '../../assets/gifs/computer.gif';
import fishtankGif from '../../assets/gifs/fishtank_resturant.gif';

export const THEMES = [
  { id: 'jade',  label: 'Jade',  gif: computerGif, swatch: { bg: '#bbd2d8', accent: '#15a292' } },
  { id: 'coral', label: 'Coral', gif: fishtankGif, swatch: { bg: '#ef8268', accent: '#0fa78f' } },
];

export const DEFAULT_THEME = THEMES[0].id;

export const THEME_KEY = 'portal:theme';

// Validate a stored/incoming id against the known themes; fall back to default.
export function resolveTheme(id) {
  return THEMES.some((t) => t.id === id) ? id : DEFAULT_THEME;
}
