/**
 * The one shape every film's `meta.ts` exports as `META`.
 *
 * `meta.ts` is the film's source of truth for everything the /films index shows,
 * and the film's own `timeline.ts` derives FILM, DURATION, KICK and LAYERS from
 * it, so the index and the film can never disagree. It must not import three.js
 * or anything heavy: the index loads every film's meta eagerly.
 */

export interface FilmChapter {
  /** Shown in the HUD counter and on the index ("The Repo"). */
  name: string
  /** Seconds from ENTER. */
  start: number
  end: number
  /** One sentence for the no-WebGL fallback screen. */
  summary: string
}

export interface FilmMeta {
  /** Kebab-case, equal to the folder name; the film plays at /films/<slug>. */
  slug: string
  title: string
  /** One line: the index, the fallback screen and the region's aria-label. */
  logline: string
  /** Where the words came from, said safely ("a late call between two founders"). */
  source: string
  /** YYYY-MM-DD, the day it was made. The index sorts newest first by this. */
  date: string
  /** Total length in seconds, kick included. */
  runtime: number
  /** The hard cut to black, in seconds. */
  kick: number
  /** The film's signature colour, as hex. The index uses it for the film's dot. */
  accent: string
  chapters: readonly FilmChapter[]
  /**
   * Seconds to capture for the index, one per chapter is the norm. Captured by
   * `film-check.mjs stills` into `./stills/0.jpg`, `1.jpg`, ... in this order.
   */
  stills: readonly number[]
}
