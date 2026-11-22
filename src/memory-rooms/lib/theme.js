/* Light / dark for the Memory Rooms pages only (DECISIONS 192).

   The person's pick ('system' | 'light' | 'dark') is remembered on this device (localStorage `mr:theme`, unset =
   system). The RESOLVED theme is always written to <html data-mr-theme="light|dark">, and memory-rooms.css keys
   its one dark token block on that attribute (no prefers-color-scheme media block any more), so there is one
   source of truth and no duplicated colour values. While the pick is 'system' the attribute follows the OS live.

   Anything that paints from the tokens outside CSS (the three.js viewer, the walk, the Mapbox map and its 3D
   models) listens with onThemeChange(fn): it fires on every change of the resolved theme, whatever caused it,
   AFTER the attribute has changed, so getComputedStyle already reads the new tokens.

   initTheme() runs when the Memory Rooms chunk is evaluated (MemoryRoomsApp.jsx imports this module), before
   React renders anything, so the first paint is already the right theme. */

import { readLocal, writeLocal } from './storage.js';

const KEY = 'mr:theme';
export const THEME_PREFS = ['system', 'light', 'dark'];
export const THEME_EVENT = 'mr-theme';

let mq = null;
let started = false;

function systemDark() {
  return Boolean(mq?.matches);
}

export function readThemePref() {
  const v = readLocal(KEY);
  return v === 'light' || v === 'dark' ? v : 'system';
}

export function resolveTheme(pref = readThemePref()) {
  if (pref === 'light' || pref === 'dark') return pref;
  return systemDark() ? 'dark' : 'light';
}

/** The theme on screen now ('light' | 'dark'). */
export function currentTheme() {
  const v = typeof document !== 'undefined' ? document.documentElement.dataset.mrTheme : null;
  return v === 'dark' || v === 'light' ? v : resolveTheme();
}

export const isDarkTheme = () => currentTheme() === 'dark';

function apply() {
  const html = document.documentElement;
  const next = resolveTheme();
  if (html.dataset.mrTheme === next) return;
  html.dataset.mrTheme = next;
  window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: { theme: next, pref: readThemePref() } }));
}

export function setThemePref(pref) {
  writeLocal(KEY, pref === 'light' || pref === 'dark' ? pref : null);
  apply();
  // the pick changed even when the resolved theme didn't (system → its own colour): tell the toggle
  window.dispatchEvent(new CustomEvent(`${THEME_EVENT}-pref`, { detail: { pref: readThemePref() } }));
}

/** Calls fn({ theme }) whenever the resolved theme changes. Returns the unsubscribe. */
export function onThemeChange(fn) {
  if (typeof window === 'undefined') return () => {};
  const h = (e) => fn(e.detail || { theme: currentTheme() });
  window.addEventListener(THEME_EVENT, h);
  return () => window.removeEventListener(THEME_EVENT, h);
}

export function onThemePrefChange(fn) {
  if (typeof window === 'undefined') return () => {};
  const h = () => fn(readThemePref());
  window.addEventListener(`${THEME_EVENT}-pref`, h);
  window.addEventListener('storage', h); // another tab picked
  return () => {
    window.removeEventListener(`${THEME_EVENT}-pref`, h);
    window.removeEventListener('storage', h);
  };
}

export function initTheme() {
  if (started || typeof window === 'undefined') return;
  started = true;
  try {
    mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', () => {
      if (readThemePref() === 'system') apply();
    });
  } catch {
    mq = null;
  }
  window.addEventListener('storage', (e) => {
    if (e.key === KEY || e.key === null) apply();
  });
  apply();
}
