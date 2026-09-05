# /portara-test - Portara landing page sandbox

A working copy of the live Portara home page (portara.com.au), running at
`/portara-test` in this portfolio so new home-page ideas can be tried without
touching the production repo. Everything for it lives in this folder plus
`public/portara-test/` (images) and one lazy route in `src/App.jsx`.

Run: `npm run dev` then open http://localhost:5173/portara-test

## Where each file came from (portara-repo)

| Here                                   | There                                                       |
| -------------------------------------- | ----------------------------------------------------------- |
| `home.tsx`                             | `apps/control-plane/app/routes/home.tsx`                    |
| `components/*.tsx`                     | `apps/control-plane/app/components/` (same names)           |
| `lib/plans.ts`, `lib/demo-office.ts`   | `apps/control-plane/app/lib/` (same names)                  |
| `portal-ui/components/office3d/*`      | `packages/portal-ui/src/components/office3d/`               |
| `portal-ui/components/*.tsx`           | `packages/portal-ui/src/components/` (confidence, portrait) |
| `portal-ui/lib/**`                     | `packages/portal-ui/src/lib/` (same paths)                  |
| `portal-ui/styles/*.css`               | `packages/portal-ui/src/styles/` (home, portal, tokens, loading) |
| `public/portara-test/{brand,integrations,office,team}` | `apps/control-plane/public/` (same names)   |

The `portal-ui/` tree keeps the package's own folder layout, so every relative
import inside it is untouched.

## What was changed in the copies

All edits are mechanical and marked `PORTARA-TEST` where they sit in code.

1. **Package specifiers.** `@portara/portal-ui/...` became a relative path into
   `./portal-ui/` (home.tsx, components/workspace-tour.tsx, lib/demo-office.ts).
   `portal-ui/lib/workers.ts` still has a type-only import from
   `@portara/tenant-config/triggers`. esbuild erases it at build time, so it is
   left verbatim.
2. **Asset paths.** `/brand/`, `/integrations/`, `/team/` and
   `/office/website_banner.png` are prefixed with `/portara-test`. Reverse that
   when porting back.
3. **home.tsx only.**
   - `loader` and `action` (Turnstile, Supabase `lead_submit`) are removed; the
     form is driven by `shim/server.ts`, which validates the same way and then
     pretends to send. Nothing leaves the browser.
   - `<Form>` from react-router is a plain `<form onSubmit>`; `useNavigation` and
     `actionData` are two `useState`s.
   - `Link` comes from `shim/router.tsx`: same markup, but an absolute href to
     portara.com.au, because /login, /signup, /privacy and /terms do not exist
     here.
   - `links()` and `meta()` lost their framework type annotations and are
     applied to `<head>` by `index.tsx` instead of by React Router.
4. **Not copied.** Tailwind. The real app's `app.css` gives the page Tailwind's
   preflight reset and a handful of utilities; `shim/preflight.css` carries the
   token layer plus just that slice.

## Files that are NOT mirrors (sandbox plumbing)

- `index.tsx` - route entry. Injects fonts, preflight, home.css, portal.css and
  the meta tags on mount, removes them on unmount, stamps `data-theme="light"`
  and a `portara-test` class on `<html>`.
- `shim/router.tsx`, `shim/server.ts`, `shim/preflight.css` - see above.
- `scope-portfolio-css.mjs` - a PostCSS plugin wired into `vite.config.js`. The
  portfolio and the landing page both use `.hero`, `.container`, `.section`,
  `.btn`, `.lead` and so on, and the portfolio's CSS is one global bundle, so
  it was restyling this page (the hero text vanished). The plugin prefixes
  every portfolio selector with `:where(html:not(.portara-test))`, a
  zero-specificity guard, so the portfolio's CSS is inert on this route and
  unchanged everywhere else. Files under this folder and node_modules are left
  alone.

Outside this folder the change is: one lazy route in `src/App.jsx`, the
`css.postcss` block in `vite.config.js`, `public/portara-test/`, and four
dependencies in `package.json`.

## The redesign (2026-09-03, second pass)

The route no longer mirrors the live page: it is the proposed new one. The
mirror files are untouched (`home.css`, `portal.css`, the tour, the 3D stack);
everything the redesign adds sits beside them:

| File                                   | What it is                                                              |
| -------------------------------------- | ----------------------------------------------------------------------- |
| `home.tsx`                             | Restructured page. Header no longer goes transparent (no dark cover).   |
| `portal-ui/styles/home-v2.css`         | ALL new and changed styling, loaded after `home.css` and `portal.css`.  |
| `components/brand-sting.tsx`           | The Motion 01 logo sting from HQ's Marketing > Motion Graphics, ported. |
| `components/hero-scene.tsx`            | Two-column hero on a React Bits DotGrid: headline left, the brand mark right (freestanding, no panel or label), nothing empty on first paint thanks to the mark's blueprint outline. After the sting lands, an accent segment keeps orbiting each contour and speeds up with scroll (brand-sting.tsx). On scroll: THROUGH THE GATE, at once. The scene pins for one viewport; nothing is scrubbed. Crossing a 5% scroll threshold plays the gate as a fixed 0.75s rush (the gate is gone in 0.4s on a cubic ease-in; the portal snaps to size behind it on an exponential ease-out) and drives the page to the end of the pin over the same span, with wheel, touch and key input held until it lands (scrolling back up past 12% does the reverse). Every tween in the rush states both ends explicitly so it plays identically in reverse. The one mark grows towards the viewer with its opening centred on the viewport; the demo portal is in place underneath and is only seen through that opening (its clip-path is recomputed from the mark's live transform each frame) until the pillars have slid off both edges. The tour mounts half-way so it starts on its dashboard; a favicon of the mark fades into the browser chrome as the last beat. The tour's caption and margin notes are hidden in favour of one line under the frame. |
| `components/hero-3d.tsx`               | The "3D" hero (toggle under the header, choice kept in localStorage): the mark is the whole hero. The gate as a solid object from `public/portara-test/portara-hero.glb` (Claude Design export, see `temp/spinning-logo-handoff.md`) with the wordmark's three words as rings of letters orbiting at the handoff's radii and speeds, and PORTARA itself standing on the floor in front in 3D Jost type (0.55 cap height, 0.18 deep, 0.15em tracking, scaled 1.17), straight and turned to the camera's own heading so its baseline runs level across the screen (a Curve control in the tool can bend it round the gate instead), dropping in letter by letter after the gate rises. The rings are built from the font too, not the GLB: one radius (1.7) for all three, each word three times round its circumference, stacked by height (PORTALS 1.75, MCP 1.25, AGENTS 0.75). The composition (`LAYOUT` in the file): gate on the page's centre line turned 8 degrees to the camera, the word centred on the same line in front of it, the conga line's loop about 8.5 units out along the camera's line of sight and turned to lie across it, so the line walks across the top of the scene in the distance and passes behind the gate in the middle. Under 861px `LAYOUT_NARROW` is the same seen from further back with the loop drawn in. The copy is reduced to one h1 line ("Portara / Custom staff portals · Perth") and the meeting button along the foot of the scene; the pitch lives in the section below. Scrolling spins the rings up (boost decays over a few frames); letters take the accent as they cross the front; the camera stands a little above and drifts with the pointer; the gate rises and the rings spin in on load. Real cast shadows from the gate and every letter fall on the page's ground (shadow-only floor plane), the gate has a slight sheen and every hard edge drawn one step lighter so its corners read. No pinned jump in this version: the page scrolls straight on to the portal, which is in place below. The ring letters are rebuilt from the Jost SemiBold font at load (the GLB's traced outlines were faceted): `tools/subset-jost.mjs` turns `tools/jost-600-lab.ttf` (the Logo Lab's embedded subset, SIL OFL) into `public/portara-test/fonts/jost-600.typeface.json`, and each traced glyph is replaced in place with the same cap height, depth and baseline. The converter also removes overlapping contours (Jost draws P, R, A and E as stems and bowls laid over each other, which extruded put seams across the letter faces): those glyphs are unioned with polygon-clipping and emitted as fine polylines, the rest keep their curves. The wordmark's drawn lines are its face outlines only. react-three-fiber + drei, lazy-loaded. |
| `components/portlets.tsx`              | Five portlets (`public/portara-test/portlet.glb`, the jointed robot from Claude Design) in a conga line far behind the gate, round a wide loop in the distance. No baked animation: the conga is procedural (step, step, step, kick, alternating sides each bar, hands on the shoulders ahead, each dancer a fraction of a beat behind the one in front so the kick runs down the line; the leader's arms are in the air). Arc-length spacing on the loop so nobody bunches on the bends. Scrolling turns the tempo up. Eyes blink. The tool's "Portlets" position is the loop's centre and its scale the loop's size. |
| `components/layout-tool.tsx` + `.css` | TEMPORARY. Click the wordmark, the gate (with its rings) or the portlets in the 3D hero and move, turn or scale them with three.js transform handles, typed numbers or the keyboard; the wordmark also has a Curve control (degrees of arc, `,` and `.` keys). The layout is kept in localStorage (dropped when the code defaults change) and "Copy values" gives the block to paste over `LAYOUT` in hero-3d.tsx. Switch under the hero toggle. Once the layout is locked in: paste, then delete these two files and the lines marked LAYOUT TOOL in hero-3d.tsx and portlets.tsx. |
| `components/nav-reveal.ts`             | The header is not there at the top of the page (desktop): the hero has the whole viewport. The glass bar is pinned at the top but drawn only below the PORTARA letters' bottom edge (which the 3D hero publishes every frame), so nothing shows until the word scrolls up into the header's band; then the bar is uncovered beneath the letters as they lift away, its contents rising into place, and once the word has gone it is whole and stays for the rest of the scroll, with an accent hairline drawing across and fading, a shadow bloom and the logo, links and button settling in sequence. Scrolling back up covers it again. With no source (the 2D hero, loading) it slides down from above once the page has scrolled half a screen. Phones keep the header always. |
| `components/section-rule.tsx`          | The section boundary: a viewport-wide hairline that draws in on scroll with the title under it. Sections alternate page / surface backgrounds (`.section--surface`). |
| `components/toolbox-builder.tsx`       | Custom Portal: a mini portal whose toolbox rebuilds itself per industry (gsap Flip moves the tools between shelf and rail, KPIs count to new values), auto-cycles until touched, every tool tappable. Replaced the text statement. |
| `components/how-it-works.tsx`          | Four steps (Portlets added) on a flow line: one accent curve threads through the numerals and draws itself with scroll; numerals ink up and cards rise, all scrubbed to scroll position (no thresholds, no sticky, no filters). |
| `components/logo-marquee.tsx`          | Two counter-drifting rows of the 13 integration logos, speed reacts to scroll velocity. |
| `components/reveal.tsx`                | `RevealText` (line-mask heading reveal, gsap SplitText) and `Reveal` (staggered children). |
| `bits/`                                | Vendored React Bits: Magnet, ScrollReveal, SpotlightCard. See its README. |

Section order is now: scene (sting + tour), Custom Portal toolbox builder,
Portlets, Integrations (with marquee), Security, How it works, Team (two
editorial portraits with three "does" lines each), Request. Section numbers
are gone; the rule keeps just its title.

Width: `home-v2.css` sets `--container: min(1560px, 90vw)` (home.css has a
fixed 1200px), so the page fills a wide monitor and still keeps its padding on
a phone.

Motion respects `prefers-reduced-motion` everywhere, and the pinned hand-off
only runs at 861px and up (both ends read the same media query, in
`hero-scene.tsx` and `home-v2.css`).

## Porting a refined design back

The files to diff are `home.tsx` and `portal-ui/styles/home.css` (and anything
you add beside them). `git diff --no-index` each against its origin in the table
above; the only pre-existing differences are the ones listed in "What was
changed". Any new section, component or stylesheet you create here should go in
this folder so the diff stays the whole story.

Dependencies this route added to the portfolio: `three`, `@react-three/fiber`,
`@react-three/drei`, `react-icons` (pinned to the versions portara-repo uses),
and two dev dependencies for the font converter: `opentype.js` and
`polygon-clipping`.
