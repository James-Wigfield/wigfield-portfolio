/* The theme as React state: { pref: 'system' | 'light' | 'dark', theme: 'light' | 'dark', setPref }. lib/theme.js. */

import { useEffect, useState } from 'react';
import { currentTheme, onThemeChange, onThemePrefChange, readThemePref, setThemePref } from './theme.js';

export function useTheme() {
  const [pref, setPref] = useState(readThemePref);
  const [theme, setTheme] = useState(currentTheme);
  useEffect(() => {
    const offT = onThemeChange(() => setTheme(currentTheme()));
    const offP = onThemePrefChange((p) => setPref(p));
    return () => {
      offT();
      offP();
    };
  }, []);
  return { pref, theme, setPref: setThemePref };
}
