/**
 * The films registry. Nothing is listed by hand: a film is any folder
 * `src/films/<slug>/` that has a `meta.ts` (eager: small, no three.js) and a
 * `FilmRoute.tsx` (lazy: its own chunk, which carries three.js). Stills are the
 * JPEGs in `<slug>/stills/`, captured by the seth skill's `film-check.mjs stills`.
 *
 * Adding a film therefore touches no shared file: not this one, not App.jsx.
 * See src/films/README.md.
 */

import { lazy } from 'react';

const metas = import.meta.glob('./*/meta.ts', { eager: true, import: 'META' });
const routes = import.meta.glob('./*/FilmRoute.tsx');
const stillFiles = import.meta.glob('./*/stills/*.jpg', { eager: true, query: '?url', import: 'default' });

const slugOf = (path) => path.split('/')[1];

function stillsFor(slug, meta) {
  return meta.stills
    .map((t, i) => {
      const src = stillFiles[`./${slug}/stills/${i}.jpg`];
      if (!src) return null;
      const chapter = meta.chapters.find((c) => t < c.end) ?? meta.chapters[meta.chapters.length - 1];
      return { src, t, chapter: chapter?.name ?? '' };
    })
    .filter(Boolean);
}

/** Every film with both a meta and a route, oldest first, numbered from 1. */
const ordered = Object.entries(metas)
  .map(([path, meta]) => ({ ...meta, slug: slugOf(path) }))
  .filter((meta) => routes[`./${meta.slug}/FilmRoute.tsx`])
  .sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title))
  .map((meta, i) => ({ ...meta, number: i + 1, stills: stillsFor(meta.slug, meta) }));

/** Newest first, for the index. */
export const FILMS = [...ordered].reverse();

/** slug → lazy component. Built once, here, so React keeps the same component per film. */
export const FILM_COMPONENTS = Object.fromEntries(
  Object.entries(routes).map(([path, load]) => [slugOf(path), lazy(load)]),
);
