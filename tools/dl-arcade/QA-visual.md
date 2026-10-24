# Gradient Arcade: visual QA (2026-10-23)

Source: 54 screenshots in `scratchpad/check-rest/` (hub + 8 games × jade / coral / arcade × 1440 / 390; each game shot is item 1 of a level-1 round). Paths below are relative to `src/components/portal/modules/deep-learning/arcade/`.

**Capture note:** wherever the portal's sticky "SESSION ACTIVE · Gradient Arcade" header covers content (the hub hero at 1440, the middle of the Descent cabinet on the hub at 390, the game top bar in all chain-reaction shots, bottleneck-1440, and kernel-rush/latent-surfer-390), that comes from the full-page and element screenshots, not from the build. It does hide the hub hero, though, so the hero's 1440 look was not judged. The real-use version of it is issue K9.

## Issue key

| id | what is wrong | sev | fix (file) |
|---|---|---|---|
| H1 | Cold hub load: "show concepts" and "reset progress" are unstyled browser buttons. They are black and nearly invisible on the arcade theme, and on jade/coral they show as bare black text with no affordance. Cause: `.dla-btn*` is in `kit/kit.css`, and only `kit/RoundShell.jsx` imports that file, inside the lazy game chunks. | high | `import '../kit/kit.css'` in `hub/Hub.jsx`, or move `.dla-btn*` into `arcade.css`. |
| H2 | The marquee subtitle "CITS5017 · EXAM DRILLS · 8 GAMES · 253 CONCEPTS" is dark on the dark marquee in jade and coral, so it is almost unreadable. | high | `hub/hub.css` `.dla-marquee__sub`: drop `opacity: .75` and use a light token with ≥ 4.5:1 contrast on `--ink`. |
| H3 | White text on the cabinet bands fails contrast on light hues: Latent Surfer amber (~2:1) and Long Short-Term Line pink (~2.7:1) in every theme, plus Bottleneck lilac and Chain Reaction salmon on arcade (~3:1). | med | `hub/hub.css` `.dla-cab__marquee`: per-cabinet `--cab-ink` (ink on light hues), or base both gradient stops on `color-mix(in srgb, var(--cab) 72%, #000)`. |
| H4 | Eight saturated filled bands make the hub a rainbow. It is loud on coral and not the editorial dot-on-rule language. Descent's pure green and Kernel Rush's teal-green are almost the same hue. | med | `hub/hub.css`: an ink title on `--surface` with a 3–4 px top rule in `--cab`, keeping the glyph and due-dot in `--cab`. Or retune the `game.color` values in `games/*/index.js` so neighbouring hues differ. |
| H5 | At 1440, "The Long Short-Term Line" wraps to two lines and pushes "11 DUE" onto two lines as well. | low | `.dla-cab__due { white-space: nowrap; flex: none }` |
| H6 | At 390 the hub is ~3,200 px tall: 8 full-width cards of about 150 px plus 7 rings stacked two to a row. That breaks the owner's no-long-scroll rule. | med | `hub/hub.css` `@container arcade (max-width: 520px)`: 2-column compact cabinets (glyph, title, due; blurb hidden) and mini rings 4 to a row. Or put mastery behind a toggle. |
| H7 | Small tap targets at 390: the daily-mix ▶ is ~36 px, the quiet buttons are ~20 px tall, and the lecture tags and pips are 7–10 px. | low | `min-height/min-width: 44px` on `.dla-bigcab__go` and `.dla-btn--quiet` |
| K1 | The 390 round bar wraps differently depending on title length. On Descent the score "0" is clipped at the right edge and "sound" sits alone on row 2. On Bottleneck "60s" is clipped and "0 sound" drops to row 2. | med | `kit/kit.css`: at `@container (max-width: 520px)`, make `.dla-round__bar` a grid with row 1 = exit, title, level, mute and row 2 = the timer spanning the full width plus the score. |
| K2 | The "sound" mute button sits flush against, or is clipped by, the module's right edge in every game at 1440. | low | `kit/kit.css`: `padding-inline-end` on `.dla-round__bar` |
| K3 | "L1" beside the game title means level 1, but the hub uses L1–L8 for lectures, so The Exchange (L8 on the hub) shows "L1" in game. | med | `kit/RoundShell.jsx`: label it "level 1" / "Lv 1" |
| K5 | Two keypad layouts. Kernel Rush has `C 0 ←` and then `next × / Enter`. Chain Reaction has `± 0 .` and then `← / Enter`, with no clear key. Backspace moves between them. | med | `kit/Keypad.jsx`: one fixed grid with optional `±` / `.`, and backspace and clear always in the same slots |
| K6 | At 390 the primary control is below the fold: Kernel Rush Enter at ~1,000 px, Latent Surfer Lock in at ~1,000 px, Chain Reaction Enter at ~845 px. | high | `kit/kit.css`: at narrow widths, order the round as prompt, stage, controls, then "Show the maths" last; or use a sticky bottom control dock (`position: sticky; bottom: 0`) |
| K7 | SVG stages scale down through their viewBox, so labels drop to 5–7 px at 390 (Exchange tokens; Long Line `x(t)` / `ŷ(t)` / Time; Chain Reaction w / b / v). | med | Per game: a narrow viewBox or layout driven by container width (stack, larger font in user units) instead of a uniform scale |
| K8 | Disabled primaries (Swing, Drop, Enter) are a pale accent with white text (~1.8:1) and look like a washed-out live button. | low | `kit/kit.css` `.dla-btn--primary:disabled`: surface background, `--ink-3` text, dashed line |
| K9 | The round bar (timer, score) is not sticky, so on tall stages it scrolls away under the portal's sticky header. | low | `kit/kit.css`: `.dla-round__bar { position: sticky; top: var(--portal-header-h) }` |
| K10 | Provenance and footnote mono text is ~9 px ("this page's own run", the t-SNE caption, the PAR note). | low | Bump the shared mono caption to ≥ 0.72rem |

## Per-screenshot rows

| file | what is wrong | sev | fix |
|---|---|---|---|
| hub-jade-1440 | H3 (Latent Surfer and LSTL bands), H4, H5 | med | H3, H4, H5 |
| hub-jade-390 | H2: subtitle invisible. Also H6, H7 | high | H2, H6 |
| hub-coral-1440 | H4 is at its worst here (8 saturated bands on pink ground), plus H3 and H5 | med | H4 |
| hub-coral-390 | H2, H6, H7 | high | H2, H6 |
| hub-arcade-1440 | H1: "show concepts" and "reset progress" almost invisible. H3: Bottleneck, Chain Reaction, LSTL and Latent Surfer bands | high | H1, H3 |
| hub-arcade-390 | H1, with "show concepts" also crowding the right edge. H6, H7 | high | H1, H6 |
| param-sniper-jade-1440 | The stage is one code card on an ~80% empty dotted field, with no picture of the layer, so "picture first" is not met and only the firing line is labelled. K2 | med | `ParamSniper.jsx`: draw the layer as in→out node columns plus a weight block sized by fan-in × units, labelled "incoming layer" |
| param-sniper-coral-1440 | Same as jade-1440 | med | same |
| param-sniper-arcade-1440 | Same as jade-1440 | med | same |
| param-sniper-jade-390 | The red firing line runs through its own label ("FIRING L / INE"), plus the empty stage | med | `param-sniper.css`: anchor the label left of the line (`right: calc(100% + 4px)`) or above it |
| param-sniper-coral-390 | Same as jade-390 | med | same |
| param-sniper-arcade-390 | Same as jade-390 | med | same |
| the-exchange-jade-1440 | The level-1 item is a 4-option text MCQ under a static seq2seq picture, with no switchboard (the hub's hook). "⟨SOS⟩" touches its box border | low | `TheExchange.jsx`: answer by lighting edges in the picture; `the-exchange.css`: token padding |
| the-exchange-coral-1440 | Same as jade-1440 | low | same |
| the-exchange-arcade-1440 | Same as jade-1440; the dashed "el" / "fútbol" text is dim | low | same, plus raise ghost-token text to `--ink-2` |
| the-exchange-jade-390 | The diagram is scaled to ~30%: token text ~5 px, "ENCODER", "DECODER" and "final state" unreadable, "fútbol" clipped at the stage edge, "⟨SOS⟩" overflows its box | high | `TheExchange.jsx` / `the-exchange.css`: at narrow widths, stack the encoder row above the decoder row with its own viewBox (K7) |
| the-exchange-coral-390 | Same as jade-390 | high | same |
| the-exchange-arcade-390 | Same as jade-390 | high | same |
| descent-jade-1440 | ~50 px dead gap between the subtitle and the stage. The gauge at top-right is unlabelled. Contours stop short of the stage's right edge | low | `descent.css`: trim the stage top margin; caption the gauge; extend the contour viewBox |
| descent-coral-1440 | Same as jade-1440, plus K8 (pale Swing) | low | same |
| descent-arcade-1440 | Same as jade-1440, plus K8 | low | same |
| descent-jade-390 | K1: score "0" clipped at the right edge and "sound" orphaned on row 2. The PAR caption leaves "CUP" alone on a line. Dead gap above the stage. The ball is ~8 px | med | K1; `descent.css`: ball radius ≥ 6 user units at narrow widths |
| descent-coral-390 | Same as jade-390 | med | same |
| descent-arcade-390 | Same as jade-390 | med | same |
| kernel-rush-jade-1440 | A ~10 px unlabelled orange cube at the stage's top-left reads as a stray artefact. "W 64" touches the legend. The right half of the stage is empty. The controls are 4 slots + 12 keys + a cryptic "next ×" | med | `Stage.jsx`: draw the kernel at readable scale on the input face with a "kernel 5×5×1" label; `KernelRush.jsx`: rename "next ×" to "next slot →" |
| kernel-rush-coral-1440 | Same as jade-1440 | med | same |
| kernel-rush-arcade-1440 | Same as jade-1440; disabled Enter is nearly invisible (K8) | med | same |
| kernel-rush-jade-390 | K6: the stage stacks input over output (~400 px, mostly empty), and the keypad starts at ~675 px with Enter at ~1,000 px. "Show the maths" sits above the keypad | high | `kernel-rush.css`: keep the blocks side by side (scaled) at 390 and move the maths drawer below the keypad |
| kernel-rush-coral-390 | Same as jade-390 | high | same |
| kernel-rush-arcade-390 | Same as jade-390 | high | same |
| latent-surfer-jade-1440 | Too much at once: 3 images, 2 meters, a 2-line explainer and "this page's own run" repeated 4 times. The second meter ("𝓛 of your μ with the target's γ") is cryptic and numeric at level 1. Slider tracks are near-black with an orange fill, which is off-palette. "Your decode" is larger than the target | med | `LatentSurfer.jsx`: keep decode vs target plus the MSE meter, and move the latent-loss meter, explainer and provenance into "Show the maths" with one provenance line. `latent-surfer.css`: style `::-webkit-slider-runnable-track` / `::-moz-range-track` with `--line-2` and give both images the same size |
| latent-surfer-coral-1440 | Same as jade-1440 | med | same |
| latent-surfer-arcade-1440 | Same as jade-1440, except the slider track turns white, so it inverts by theme | med | same |
| latent-surfer-jade-390 | "Your decode" sits ~600 px above the μ sliders, so you can't see the result while steering. Lock in is at ~1,000 px. The readouts "0.55" / "0.7" are clipped at the right edge | high | `latent-surfer.css`: at narrow widths, order decode + target, then sliders, then grid and meters; slider row `grid-template-columns: auto minmax(0,1fr) 3.2em` |
| latent-surfer-coral-390 | Same as jade-390 | high | same |
| latent-surfer-arcade-390 | Same as jade-390 | high | same |
| long-line-jade-1440 | The recurrence loop is an open arc with a loose end and no arrowhead, and it crosses the ŷ stem, so it looks unfinished. There is no train or cargo picture at level 1 (the hub's promise) | med | `scene.jsx`: a closed loop leaving the neuron's right side and re-entering its left, with an arrow marker, kept clear of ŷ |
| long-line-coral-1440 | Same as jade-1440 | med | same |
| long-line-arcade-1440 | Same as jade-1440 | med | same |
| long-line-jade-390 | Labels drop to ~6 px (`x(0)`…, `ŷ(0)`…, "Time") (K7), plus the loop issue | med | `scene.jsx`: stack left and right vertically at narrow widths |
| long-line-coral-390 | Same as jade-390 | med | same |
| long-line-arcade-390 | Same as jade-390 | med | same |
| bottleneck-jade-1440 | The X_valid[5] item is a dark, theme-tinted blob with seam lines from non-integer pixelated scaling, so it is hard to recognise. The t-SNE shows 10 classes in only 4 hues, so the five blue garment clusters run together and the tap targets have no visible edges. Labels sit on dots without a halo. The round opens on "STAGE 4" for a level-1 round | med | `bottleneck.css`: integer scale (28 × 4 = 112 px), `image-rendering: pixelated`, neutral ink-on-surface in every theme. `MapStage.jsx`: 10-hue categorical (or highlight the hit-region on hover/tap), and labels with `paint-order: stroke` and a 3 px `--surface` stroke |
| bottleneck-coral-1440 | Same as jade-1440, with the item tinted maroon | med | same |
| bottleneck-arcade-1440 | Same as jade-1440, with the item inverted to white, so it looks different in each theme | med | same |
| bottleneck-jade-390 | The item thumbnail is cut off on its left side. K1: "60s" clipped and the score "0" on its own row | med | `bottleneck.css`: `object-fit: contain`, fixed square box; K1 |
| bottleneck-coral-390 | Same as jade-390 | med | same |
| bottleneck-arcade-390 | Same as jade-390 | med | same |
| chain-reaction-jade-1440 | Weight labels collide with edges: "w₂,₁ 2" sits on the highlighted edge and "w₁,₂ 0.5" on the crossing edge. "z₁ ?" and "b₁ −0.5" crowd each other above neuron 1. Subscripts render as spaced "W₁ , ₁". No fuse is visible (the hub's promise). There is a ~200 px empty block under "Show the maths" | med | `layout.js` / `Scenes.jsx`: offset labels perpendicular to each edge's midpoint and add a stroke halo; put b₁ below the neuron as b₂ is; tighten the subscript glyphs |
| chain-reaction-coral-1440 | Same as jade-1440 | med | same |
| chain-reaction-arcade-1440 | Same as jade-1440 | med | same |
| chain-reaction-jade-390 | Graph labels ~6 px (K7). Enter at ~845 px (K6). Same label collisions as at 1440 | med | narrow layout with a larger font in user units; K6 |
| chain-reaction-coral-390 | Same as jade-390 | med | same |
| chain-reaction-arcade-390 | Same as jade-390 | med | same |

Rows by severity: **13 high, 35 med, 6 low** (every screenshot has at least one problem).
Distinct issues: **6 high** (H1, H2, K6, Exchange-390 diagram, Kernel Rush-390 layout, Latent Surfer-390 layout), **17 med**, **16 low**.

## Cross-cutting

1. **Narrow layouts are the systemic gap.** SVG stages scale uniformly (K7), controls fall below the fold (K6), the round bar wraps chaotically (K1) and readouts clip at the right edge. Fix this once in `kit/kit.css` with a container query and a shared "narrow" layout order, not game by game.
2. **The hub's styles depend on the lazy game chunk** (H1). Load `kit.css` from the hub entry.
3. **The hub's cabinet bands are a different visual language** (H3, H4) from the calm, ruled game stages. The game colour also never carries into the game itself: no rule, dot or glyph tint inside the round.
4. **Colour roles are not shared.** "Input" is teal in Kernel Rush and green in Chain Reaction. "Active / highlight" is blue (Chain Reaction), teal (Kernel Rush ring) or orange (Latent Surfer). Exchange and Param Sniper use no `--dl8s-*` role tokens; Bottleneck and Chain Reaction use the raw `--dlv-*` palette. Map input, weight, output, target and highlight to the L8 role tokens in `arcade.css` and use them everywhere.
5. **Level-1 items often drop the hub's hook.** The Exchange has no switchboard, Long Line no train, Chain Reaction no fuse, and Param Sniper shows no picture. First impressions are MCQs on static diagrams.
6. **Disabled primaries, ghost tokens and mono captions sit at low contrast** (K8, K10). Arcade dark mostly holds up in game; it fails only in the hub's unstyled buttons and the pale band hues.
7. **Keypads differ between games** (K5), and the "L1" level badge reads as a lecture (K3).

## Verdict

At the shell level it reads as one system. Every round shares the same bar, the dotted-grid stage card, the mono uppercase kicker, numbered keycap choices, the theme-accent primary button and the "Show the maths" drawer at the foot. All three themes keep that frame intact, and the dark arcade theme looks right inside the games. The stage contents are where it splits. Each game brings its own colour roles and label scale, some stages are mostly empty and others are crowded, and the hub's bright cabinet bands look like a different product from the editorial stages they open. With the narrow-layout pass (K1, K6, K7), the two hub load and contrast bugs (H1, H2), and shared role tokens, it would read as one arcade. At 390 px today it reads as eight separately built modules.
