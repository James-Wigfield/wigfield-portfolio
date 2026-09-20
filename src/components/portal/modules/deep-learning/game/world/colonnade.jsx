/* ============================================================================
   THE COLONNADE OF ARCHITECTURES  (slides 37–47)
   ----------------------------------------------------------------------------
   Eight columns on the terrace, one per network the deck names, in order of
   year. Each carries a plaque (E reads it aloud through the bust's voice)
   and, where the slides give a layer count, a depth bar beside it — so the
   colonnade grows deeper from LeNet-5 to ResNet as you walk it. Read
   columns keep a lit capital. Pure spectacle, every line from the slides.
   ========================================================================== */
import { useState } from 'react';
import { useGame } from './world';
import { useInteractable } from './useInteractable';
import { COLONNADE, TERRACE } from './layout';
import { Label } from '../rooms/kit';
import { say } from '../rooms/roomHooks';
import { audio } from './audio';
import { ARCHITECTURES } from '../content/architectures';


const MAX_DEPTH = 152;

export function Colonnade() {
  const [read, setRead] = useState(() => new Set());
  return (
    <group>
      {ARCHITECTURES.map((a, i) => (
        <Column key={a.name} arch={a} x={COLONNADE.xs[i]} read={read.has(a.name)} onRead={() => setRead((s) => new Set(s).add(a.name))} />
      ))}
      <Label position={[0, TERRACE.y + COLONNADE.h + 1.4, COLONNADE.z]} className="dlg-label--title" distanceFactor={12}>
        the colonnade of architectures · slides 37–47 · top-5 error fell from over 26% to under 3% in six years (slide 36)
      </Label>
    </group>
  );
}

function Column({ arch, x, read, onRead }) {
  const { hud } = useGame();
  const z = COLONNADE.z;
  useInteractable(`col:${arch.name}`, {
    pos: [x, TERRACE.y, z + 1.4],
    radius: 2.0,
    label: `Read the plaque · ${arch.name} (${arch.year})`,
    onUse: () => {
      say(hud, `${arch.name}, ${arch.year} · slide ${arch.slide}. ${arch.fact}`, 'The colonnade');
      audio.tick(760);
      onRead();
    },
  });
  const barH = arch.depth ? 0.25 + (arch.depth / MAX_DEPTH) * 4.6 : 0;
  return (
    <group position={[x, TERRACE.y, z]}>
      {/* plaque on the stylobate, facing the village */}
      <mesh position={[0, 0.75, 1.55]} rotation={[-0.25, 0, 0]} castShadow>
        <boxGeometry args={[1.1, 0.5, 0.06]} />
        <meshStandardMaterial color="#e6e2d8" roughness={0.5} />
      </mesh>
      <Label position={[0, 1.05, 1.62]} className="dlg-label--title" distanceFactor={5}>
        {arch.name} · {arch.year}
      </Label>
      {/* the lit capital once read */}
      <mesh position={[0, COLONNADE.h - 0.15, 0]}>
        <boxGeometry args={[1.3, 0.08, 1.3]} />
        <meshStandardMaterial color={read ? '#ffe2b8' : '#d9d3c8'} emissive={read ? '#ffb347' : '#000000'} emissiveIntensity={read ? 1.6 : 0} />
      </mesh>
      {read && <pointLight position={[0, COLONNADE.h + 0.4, 0]} color="#ffb060" intensity={10} distance={9} decay={2} />}
      {/* depth bar, where the slides give a layer count */}
      {arch.depth && (
        <group position={[1.15, 0, -0.9]}>
          <mesh position={[0, barH / 2, 0]} castShadow>
            <boxGeometry args={[0.22, barH, 0.22]} />
            <meshStandardMaterial color="#1baf7a" emissive="#1baf7a" emissiveIntensity={0.35} roughness={0.5} />
          </mesh>
          <Label position={[0, barH + 0.35, 0]} className="dlg-label--title" tone="green" distanceFactor={6}>
            {arch.depth} layers
          </Label>
        </group>
      )}
    </group>
  );
}
