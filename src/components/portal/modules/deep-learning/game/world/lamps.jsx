/* ============================================================================
   LAMPS, WINDOWS, LANTERNS — progress you can see from the plaza
   ----------------------------------------------------------------------------
   The village starts at dusk, unlit. Scroll k lights plaza lamp k; a house's
   windows come on in step with its scrolls; when every scroll in a house is
   found its roof lantern lights, and when its door has opened the lantern
   burns white. All emissive + a few point lights, no shadow casting.
   ========================================================================== */
import { useGame } from './world';
import { HOUSE_LIST, houseBox, houseWindows, LAMPS } from './layout';
import { scrollsForHouse } from '../content/scrolls';

const WARM = '#ffb060';

export function Lamps() {
  const { sum } = useGame();
  return (
    <group>
      {LAMPS.map((l, i) => {
        const on = i < sum.found;
        return (
          <group key={i} position={[l.x, l.h + 0.5, l.z]}>
            <mesh>
              <sphereGeometry args={[0.13, 12, 10]} />
              <meshStandardMaterial
                color={on ? '#ffe2b8' : '#3a3632'}
                emissive={on ? '#ffb347' : '#000000'}
                emissiveIntensity={on ? 2.4 : 0}
                roughness={0.6}
              />
            </mesh>
            {on && <pointLight color={WARM} intensity={16} distance={12} decay={2} />}
          </group>
        );
      })}
    </group>
  );
}

export function Windows() {
  const { sum } = useGame();
  return (
    <group>
      {HOUSE_LIST.map((h) => {
        const wins = houseWindows(h);
        const ph = sum.perHouse[h.id];
        const lit = ph ? Math.round((ph.found / Math.max(1, ph.total)) * wins.length) : 0;
        return wins.map((w, i) => {
          const on = i < lit;
          return (
            <mesh
              key={`${h.id}${i}`}
              position={[w.x + w.nx * 0.075, w.y, w.z + w.nz * 0.075]}
              rotation={[0, Math.atan2(w.nx, w.nz), 0]}
            >
              <planeGeometry args={[0.6, 0.8]} />
              <meshStandardMaterial
                color={on ? '#ffd9a6' : '#141824'}
                emissive={on ? '#ffbe6a' : '#000000'}
                emissiveIntensity={on ? 1.6 : 0}
                roughness={0.3}
                metalness={0.1}
              />
            </mesh>
          );
        });
      })}
    </group>
  );
}

export function Lanterns() {
  const { sum } = useGame();
  return (
    <group>
      {HOUSE_LIST.map((h) => {
        const ph = sum.perHouse[h.id];
        const total = scrollsForHouse(h.id).length;
        const complete = ph ? ph.found === total : false;
        const solved = ph?.solved;
        if (!complete) return null;
        const b = houseBox(h);
        const y = b.y1 + 0.25 + 0.5;
        return (
          <group key={h.id} position={[h.c[0], y, h.c[1]]}>
            <mesh>
              <boxGeometry args={[0.7, 0.6, 0.7]} />
              <meshStandardMaterial
                color={solved ? '#fff6e6' : '#ffd9a6'}
                emissive={solved ? '#fff1d6' : '#ffb347'}
                emissiveIntensity={solved ? 3 : 2.2}
              />
            </mesh>
            <pointLight color={solved ? '#fff0d8' : WARM} intensity={solved ? 60 : 36} distance={30} decay={2} />
          </group>
        );
      })}
    </group>
  );
}
