import { useSyncExternalStore } from 'react';

/* ============================================================================
   SEMINAR DECKS — DECK REGISTRY (lazy: each deck is its own chunk)
   ========================================================================== */

export const DECK_LIST = [
  { slug: 'plain', load: () => import('../decks/plain/index.jsx') },
  { slug: 'one-scan', load: () => import('../decks/one-scan/index.jsx') },
  { slug: 'verdict', load: () => import('../decks/verdict/index.jsx') },
  { slug: 'context', load: () => import('../decks/context/index.jsx') },
];

const loaded = new Map(); // slug -> deck | Error
const pending = new Map();
const listeners = new Set();
let ver = 0;

export function loadDeck(slug) {
  if (loaded.has(slug)) return Promise.resolve(loaded.get(slug));
  if (pending.has(slug)) return pending.get(slug);
  const entry = DECK_LIST.find((d) => d.slug === slug);
  if (!entry) return Promise.resolve(null);
  const p = entry.load().then((m) => {
    loaded.set(slug, m.default);
    pending.delete(slug);
    ver += 1;
    listeners.forEach((l) => l());
    return m.default;
  }, (e) => {
    pending.delete(slug);
    loaded.set(slug, e instanceof Error ? e : new Error(String(e)));
    ver += 1;
    listeners.forEach((l) => l());
    return null;
  });
  pending.set(slug, p);
  return p;
}

function subscribe(l) {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** The deck module for a slug (null while loading; an Error if it failed). */
export function useDeckModule(slug) {
  useSyncExternalStore(subscribe, () => ver, () => ver);
  if (slug && !loaded.has(slug) && !pending.has(slug)) loadDeck(slug);
  return slug ? loaded.get(slug) ?? null : null;
}

export function useAllDecks() {
  useSyncExternalStore(subscribe, () => ver, () => ver);
  DECK_LIST.forEach((d) => {
    if (!loaded.has(d.slug) && !pending.has(d.slug)) loadDeck(d.slug);
  });
  return DECK_LIST.map((d) => loaded.get(d.slug) ?? null);
}
