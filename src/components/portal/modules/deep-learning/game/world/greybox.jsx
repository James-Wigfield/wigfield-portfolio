/* ============================================================================
   GREY BOX — the village drawn straight from layout.js
   ----------------------------------------------------------------------------
   Stands in while the Blender GLB streams (and stands in for good if it
   ever fails to load). Every box here is the same box the colliders use, so
   what you bump into is what you see.
   ========================================================================== */
import { useMemo } from 'react';
import {
  BUST, COLONNADE, CYPRESSES, HOUSE_LIST, LAMPS, OLIVES, PLAZA, SEA, STAIR, TERRACE, houseBox, houseWalls,
} from './layout';

const WALL_COLOURS = { cream: '#e0cca8', ochre: '#cc9a5c', sandstone: '#c7ad80' };

export function GreyBoxVillage() {
  const walls = useMemo(
    () => HOUSE_LIST.flatMap((h) => houseWalls(h).map((w) => ({ ...w, colour: WALL_COLOURS[h.wall] }))),
    [],
  );
  return (
    <group>
      {/* ground */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.02, -16]} receiveShadow>
        <planeGeometry args={[160, 160]} />
        <meshStandardMaterial color="#737a4a" roughness={1} />
      </mesh>
      {/* plaza disc */}
      <mesh position={[0, PLAZA.lip / 2, 0]} receiveShadow>
        <cylinderGeometry args={[PLAZA.r, PLAZA.r, PLAZA.lip, 48]} />
        <meshStandardMaterial color="#d6cdb4" roughness={0.8} />
      </mesh>
      {/* terrace block */}
      <mesh position={[0, TERRACE.y / 2, (TERRACE.z + TERRACE.zEnd) / 2]} receiveShadow castShadow>
        <boxGeometry args={[130, TERRACE.y, TERRACE.z - TERRACE.zEnd]} />
        <meshStandardMaterial color="#9e9074" roughness={1} />
      </mesh>
      {/* stair ramp */}
      <mesh
        position={[(STAIR.x0 + STAIR.x1) / 2, TERRACE.y / 2, (STAIR.z0 + STAIR.z1) / 2]}
        rotation-x={Math.atan2(TERRACE.y, STAIR.z0 - STAIR.z1)}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[STAIR.x1 - STAIR.x0, 0.25, Math.hypot(TERRACE.y, STAIR.z0 - STAIR.z1) + 0.4]} />
        <meshStandardMaterial color="#cbbd9d" roughness={0.9} />
      </mesh>
      {/* sea */}
      <mesh rotation-x={-Math.PI / 2} position={[0, SEA.water, SEA.z + 40]}>
        <planeGeometry args={[220, 80]} />
        <meshStandardMaterial color="#2b3f66" roughness={0.25} metalness={0.2} />
      </mesh>
      <mesh position={[0, SEA.parapet / 2, SEA.z + 0.3]} castShadow>
        <boxGeometry args={[64, SEA.parapet, 0.6]} />
        <meshStandardMaterial color="#cbbd9d" roughness={0.9} />
      </mesh>

      {/* houses */}
      {walls.map((w, i) => (
        <mesh
          key={i}
          position={[(w.x0 + w.x1) / 2, (w.y0 + w.y1) / 2, (w.z0 + w.z1) / 2]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[w.x1 - w.x0, w.y1 - w.y0, w.z1 - w.z0]} />
          <meshStandardMaterial color={w.colour} roughness={0.9} />
        </mesh>
      ))}
      {HOUSE_LIST.map((h) => {
        const b = houseBox(h);
        return (
          <mesh key={h.id} position={[h.c[0], b.y1 + 0.12, h.c[1]]} castShadow receiveShadow>
            <boxGeometry args={[h.size[0], 0.24, h.size[2]]} />
            <meshStandardMaterial color="#b98a6a" roughness={0.9} />
          </mesh>
        );
      })}

      {/* colonnade */}
      {COLONNADE.xs.map((x) => (
        <mesh key={x} position={[x, TERRACE.y + COLONNADE.h / 2, COLONNADE.z]} castShadow>
          <cylinderGeometry args={[COLONNADE.r * 0.85, COLONNADE.r, COLONNADE.h, 16]} />
          <meshStandardMaterial color="#e6e2d8" roughness={0.6} />
        </mesh>
      ))}
      <mesh position={[0, TERRACE.y + COLONNADE.h + 0.3, COLONNADE.z]} castShadow>
        <boxGeometry args={[COLONNADE.xs[COLONNADE.xs.length - 1] - COLONNADE.xs[0] + 2, 0.6, 1.4]} />
        <meshStandardMaterial color="#e6e2d8" roughness={0.6} />
      </mesh>

      {/* lamps, trees, bust */}
      {LAMPS.map((l, i) => (
        <mesh key={i} position={[l.x, l.h / 2, l.z]} castShadow>
          <cylinderGeometry args={[0.07, 0.1, l.h, 8]} />
          <meshStandardMaterial color="#3b3430" />
        </mesh>
      ))}
      {CYPRESSES.map(([x, z], i) => (
        <mesh key={`c${i}`} position={[x, groundYApprox(z) + 3.2, z]} castShadow>
          <coneGeometry args={[0.9, 6.4, 8]} />
          <meshStandardMaterial color="#1a3a1c" />
        </mesh>
      ))}
      {OLIVES.map(([x, z], i) => (
        <mesh key={`o${i}`} position={[x, groundYApprox(z) + 2.6, z]} castShadow>
          <sphereGeometry args={[1.7, 10, 8]} />
          <meshStandardMaterial color="#6b7f55" />
        </mesh>
      ))}
      <mesh position={[BUST.x, BUST.h / 2, BUST.z]} castShadow>
        <boxGeometry args={[0.7, BUST.h, 0.7]} />
        <meshStandardMaterial color="#e6e2d8" />
      </mesh>
    </group>
  );
}

function groundYApprox(z) {
  return z <= TERRACE.z ? TERRACE.y : 0;
}
