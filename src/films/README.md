# Films (`/films`)

Short real-time three.js films made from conversation transcripts by the `/seth`
skill (`~/.claude/skills/seth`). Public. `/films` is the index, and each film
plays at `/films/<slug>`.

```
src/films/
  registry.js        finds films by folder (import.meta.glob): no list to edit
  FilmsIndex.jsx     /films, the index (styles: films.css, all under .fx)
  FilmPlayer.jsx     /films/:slug, lazy-mounts <slug>/FilmRoute.tsx, unknown slug → /films
  types.ts           FilmMeta, the shape every meta.ts exports
  <slug>/
    meta.ts          title, logline, source, date, runtime, kick, accent, chapters, stills
    FilmRoute.tsx    the film's own full-screen route (its own chunk, carries three.js)
    timeline.ts      every beat; derives title/runtime/kick/chapters from meta.ts
    engine.ts core.ts post.ts audio.ts math.ts textures.ts   the engine
    layers/          one module per chapter
    film.css         every class under fm-<slug> (layer-by-layer keeps its original lbl)
    stills/0.jpg …   one frame per meta.stills entry, 640 px wide, for the index
```

## Adding a film

Run `/seth <transcript>`. By hand it is:

1. `node ~/.claude/skills/seth/scripts/new-film.mjs <slug> "<Title>"`, which copies
   the engine templates here and renames the CSS prefix.
2. Write `meta.ts`, `timeline.ts` and `layers/`.
3. Capture the stills with `film-check.mjs stills` against the dev server.

No shared file changes: not `App.jsx`, not the registry.

## Rules

- **Isolation.** A film's CSS stays in the document after you leave it, so every
  film uses its own prefix. Never share class names between films, and never
  use the site's `--font-*` tokens (the home page sets `--font-display` to a serif).
- **meta.ts stays light.** The index imports every meta eagerly, so meta.ts must
  never import three.js or anything else from the film's folder.
- **The dev hook.** In dev each film sets `window.__film`, and the skill's
  `film-check.mjs` drives it (`shots`, `stills`, `memory`, `interact`, `index`).
- **Fonts.** Anton and Space Mono, via `@fontsource`, load only in the film and
  index chunks.

## Checks

```bash
npx -y -p typescript@5.6.3 tsc -p tsconfig.films-check.json   # strict TS over src/films
npx eslint src/films src/App.jsx --max-warnings 0
node ~/.claude/skills/seth/scripts/film-check.mjs index http://localhost:5173/films --out <scratch>
```
