/* The header's theme switch (Memory Rooms pages only): Auto → Light → Dark → Auto.
   A labelled dot in the status-glyph language: half = auto (follows this device), ring = light, filled = dark.
   Phones show the dot alone (48 px target); the label is there for screen readers either way. */

import { COPY } from '../copy.js';
import { THEME_PREFS, setThemePref } from '../lib/theme.js';
import { useTheme } from '../lib/useTheme.js';

export default function ThemeToggle() {
  const { pref, theme } = useTheme();
  const copy = COPY.app.theme;
  const next = THEME_PREFS[(THEME_PREFS.indexOf(pref) + 1) % THEME_PREFS.length];
  return (
    <button
      type="button"
      className="mr-theme"
      data-mr="theme-toggle"
      data-pref={pref}
      data-theme-now={theme}
      onClick={() => setThemePref(next)}
      aria-label={copy.label(copy.names[pref], copy.names[next])}
      title={copy.label(copy.names[pref], copy.names[next])}
    >
      <span className="mr-theme__dot" aria-hidden="true" />
      <span className="mr-label mr-theme__name" aria-hidden="true">
        {copy.names[pref]}
      </span>
    </button>
  );
}
