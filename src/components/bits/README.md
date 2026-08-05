# bits/ — vendored React Bits components

Animated components taken from [reactbits.dev](https://reactbits.dev), always the
**JS + CSS variant** (this repo has no TypeScript and no Tailwind). One `.jsx` +
`.css` pair per component, vendored rather than installed so we control the code.

Rules that keep this maintainable:

- **Keep vendored files byte-close to upstream.** Local edits only when necessary,
  each marked with a `[local]` comment and listed in the file's header block, so a
  future refresh is a readable diff.
- **Integrate through the consumer, never by forking the component's look.**
  Palette/tint via props; scroll effects, scrims, masks and fades via CSS on a
  wrapper element in the consuming component (see `Hero.jsx`).
- **Prop stability matters.** These components typically rebuild their whole WebGL
  context / animation on ANY prop change — pass module-scope constants for arrays
  and objects, never inline literals, or a parent re-render nukes the canvas.
- Per-component dependencies (`ogl`, `gsap`, `motion`, …) are real `dependencies`
  in package.json — installed when the component lands.

| Component | Source | Dep | Used by |
|---|---|---|---|
| FaultyTerminal | reactbits.dev/backgrounds/faulty-terminal | `ogl` | `Hero.jsx` (home cover) |
