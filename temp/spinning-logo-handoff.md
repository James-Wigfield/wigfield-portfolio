# Portara hero - handoff for Claude Code

## Files to download
1. `portara-hero.glb` - open `Portara Hero.html?export` and click GLB. One file, four named nodes:
   - `gate` (lintel, post-left, post-right, plinth, ground)
   - `ring-portals`, `ring-mcp`, `ring-agents` (extruded letters, one mesh per glyph)
   Material `portara-black` (#0c131b, roughness .55). Units: metres, y-up, base at y=0, gate centred on x/z.
2. `Portara Hero.html` - reference for camera, ring radii/heights/speeds and the scroll-boost logic (bottom module script).
3. `wordmark-glyphs.json` - optional. Traced outlines of the wordmark and tagline (px, 2048 wide) if letters should be rebuilt procedurally instead of loaded from the GLB.

## Scene values
- Ring portals: r 1.35, y 1.62, speed +0.22 rad/s
- Ring mcp: r 1.65, y 1.06, speed -0.17 rad/s
- Ring agents: r 1.95, y 0.50, speed +0.13 rad/s
- Camera: target (-1.2, 1.0, 0), direction (0.55, 0.28, 1), distance 6.2. Under 1100px wide: target (-2.5, 1.3, 0), distance 7.2.
- Scroll: boost += |dy|/dt * 2.2 (px/ms), capped at 10; decays boost *= 0.15^dt; rotation += speed * (1 + boost) * dt.
- Background #e8edf0, zoom and pan off, drag orbit on.

## React (react-three-fiber + drei)
```jsx
const { scene } = useGLTF('/portara-hero.glb');
const rings = ['ring-portals', 'ring-mcp', 'ring-agents'].map(n => scene.getObjectByName(n));
const speeds = [0.22, -0.17, 0.13];
useFrame((_, dt) => rings.forEach((r, i) => { r.rotation.y += speeds[i] * (1 + boost.current) * dt; }));
```
