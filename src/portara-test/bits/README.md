# bits/ - vendored React Bits components (portara-test)

Animated components taken from [reactbits.dev](https://reactbits.dev), the
**TypeScript + plain CSS variant** (`src/ts-default/` in the upstream repo), to
match this folder: TSX, no Tailwind. Same rules as the portfolio's own
`src/components/bits/README.md`:

- Keep vendored files byte-close to upstream. Local edits are marked `[local]`
  in a comment and listed in the file's header block.
- Their default stylesheets are NOT imported by the components here (`[local]`).
  Everything this route injects into `<head>` has to leave with it, so the few
  rules each needs live in `portal-ui/styles/home-v2.css` under a
  "React Bits" heading, restyled to the brand there.
- Integrate through the consumer, never by forking the component's look.

| Component     | Upstream                                              | Dep  | Used by                              |
| ------------- | ----------------------------------------------------- | ---- | ------------------------------------ |
| DotGrid       | reactbits.dev/backgrounds/dot-grid                    | gsap (InertiaPlugin) | the hero backdrop; `[local]` pauses its draw loop off screen |
| Magnet        | reactbits.dev/animations/magnet                       | none | hero and request CTAs                |
| ScrollReveal  | reactbits.dev/text-animations/scroll-reveal           | gsap | unused since the statement under the tour became the toolbox builder; kept for the design pass |
| SpotlightCard | reactbits.dev/components/spotlight-card               | none | unused since the team redesign; kept for the design pass |

Fetched 2026-09-03 from `DavidHDev/react-bits` `main`.
