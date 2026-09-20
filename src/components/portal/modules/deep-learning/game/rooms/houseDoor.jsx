/* ============================================================================
   HOUSE III — THE HOUSE OF THE NARROW DOOR  (slides 20–31)
   ----------------------------------------------------------------------------
   A corridor of doorways. The first room's floor is a 6×6 image. The first
   gate is a convolutional layer: its opening is exactly as wide as the
   layer's output, so stride and padding are things you squeeze through.
   Same padding draws a ring of zero tiles round the image and the next room
   keeps its size; valid shrinks it; stride 2 halves it. The second gate is
   a 2×2 pooling layer: the room beyond is a quarter of the area, and a
   lever chooses whether the brightest tile survives (max) or they blend
   (average). Kerbs along each room make the narrowing something you walk.

   Exit test: the far door names an input, kernel, stride and padding. Say
   how wide the next room is before you step through; get it wrong and the
   door shows the arithmetic.
   ========================================================================== */
import { useCallback, useMemo, useState } from 'react';
import { useGame } from '../world/world';
import { HOUSES, houseInterior, ROOMS } from '../world/layout';
import { audio } from '../world/audio';
import { ExitDoor, Label, Lectern, ScrollPickup, Tiles } from './kit';
import { useDynamicColliders, useRoomText, useVerdict } from './roomHooks';
import { IMAGE, KERNEL, N1, QUESTIONS, answer, convolve, grey, pool, working } from './doorData';
import { EXIT_TESTS } from '../content/scrolls';

const H = HOUSES.door;
const R = ROOMS.door;
const I = houseInterior(H);
const T = R.tile; // 0.8 m per tile
const ZC = R.r1.zc;
const WALL_H = H.size[1];
const GATE_H = 3.2;
const PICKUPS = {
  'door-padding': [12.4, 0.85, 0.3],
  'door-stride': [15.2, 0.85, -6.2],
  'door-pooling': [21.2, 0.85, 0.3],
};
const LEVERS = {
  padding: [11.2, 0, -6.2],
  stride: [15.6, 0, 0.3],
  pooling: [22.4, 0, -6.2],
};

/* grid of tiles centred on the corridor at x0, n wide */
function gridCells(map, x0, n, y = 0.04, scale = [T - 0.05, 0.08, T - 0.05], colour = grey) {
  const cells = [];
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    cells.push({ pos: [x0 + (i + 0.5) * T, y, ZC + (j - (n - 1) / 2) * T], color: colour(map[j][i], i, j), scale });
  }
  return cells;
}

export function HouseDoor() {
  const { progress, hud, world } = useGame();
  const has = (id) => progress.found.includes(id);
  const hasPad = has('door-padding');
  const hasStride = has('door-stride');
  const hasPool = has('door-pooling');
  const solved = progress.solved.includes('door');

  const [padding, setPadding] = useState('valid');
  const [stride, setStride] = useState(1);
  const [poolMode, setPoolMode] = useState('max');

  const conv = useMemo(() => convolve(IMAGE, KERNEL, stride, padding), [stride, padding]);
  const n2 = conv.out.length;
  const pooled = useMemo(() => pool(conv.out, poolMode), [conv, poolMode]);
  const n3 = pooled.length;

  /* ── geometry: floors ─────────────────────────────────────────────────── */
  const floor1 = useMemo(() => {
    const cells = gridCells(IMAGE, R.r1.x0, N1);
    if (padding === 'same' && conv.padTop > 0) {
      // the ring of nothing: dim outlined tiles round the picture
      const np = N1 + 2 * conv.padTop;
      for (let j = 0; j < np; j++) for (let i = 0; i < np; i++) {
        const inside = i >= conv.padTop && i < conv.padTop + N1 && j >= conv.padTop && j < conv.padTop + N1;
        if (inside) continue;
        cells.push({
          pos: [R.r1.x0 + (i - conv.padTop + 0.5) * T, 0.02, ZC + (j - (np - 1) / 2) * T],
          color: '#2a3140',
          scale: [T - 0.12, 0.03, T - 0.12],
        });
      }
    }
    return cells;
  }, [padding, conv.padTop]);
  const floor2 = useMemo(() => gridCells(conv.out, R.r2.x0, n2), [conv, n2]);
  const floor3 = useMemo(() => gridCells(pooled, R.r3.x0, n3, 0.04, [T - 0.05, 0.08, T - 0.05], (v) => grey(v)), [pooled, n3]);

  /* ── gates and kerbs → colliders ──────────────────────────────────────── */
  const gates = useMemo(() => {
    const mk = (x, openW) => {
      const half = openW / 2;
      return [
        { x0: x - 0.15, x1: x + 0.15, z0: I.z0, z1: ZC - half, y0: 0, y1: WALL_H },
        { x0: x - 0.15, x1: x + 0.15, z0: ZC + half, z1: I.z1, y0: 0, y1: WALL_H },
        { x0: x - 0.15, x1: x + 0.15, z0: ZC - half, z1: ZC + half, y0: GATE_H, y1: WALL_H, lintel: true },
      ];
    };
    return { g1: mk(R.gate1X, n2 * T), g2: mk(R.gate2X, Math.max(n3, 1) * T) };
  }, [n2, n3]);

  const kerbs = useMemo(() => {
    const mk = (x0, x1, n) => {
      const half = (n * T) / 2 + 0.08;
      return [
        { x0, x1, z0: ZC - half - 0.12, z1: ZC - half, y0: 0, y1: 0.45 },
        { x0, x1, z0: ZC + half, z1: ZC + half + 0.12, y0: 0, y1: 0.45 },
      ];
    };
    return [
      ...mk(R.r1.x0 - 0.3, R.gate1X - 0.15, padding === 'same' ? N1 + 2 * conv.padTop : N1),
      ...mk(R.gate1X + 0.15, R.gate2X - 0.15, n2),
      ...mk(R.gate2X + 0.15, R.exitX - 0.6, Math.max(n3, 1)),
    ];
  }, [padding, conv.padTop, n2, n3]);

  const colliders = useMemo(
    () => [...gates.g1, ...gates.g2, ...kerbs].filter((c) => !c.lintel),
    [gates, kerbs],
  );
  useDynamicColliders('door', colliders);

  /* ── room text ───────────────────────────────────────────────────────── */
  const room = useMemo(
    () => ({
      title: 'House of the Narrow Door',
      lectureTab: 'layers',
      lines: [
        `Room 1: a 6×6 image. Gate 1 is a 3×3 convolution, stride ${stride}, padding ${padding}: it opens ${n2} tiles wide, so room 2 is ${n2}×${n2}.`,
        `Gate 2 is 2×2 ${poolMode} pooling, stride 2: it opens ${n3} tile${n3 === 1 ? '' : 's'} wide, so room 3 is ${n3}×${n3}.`,
        `Levers: padding ${hasPad ? 'ready' : 'needs its scroll'}, stride ${hasStride ? 'ready' : 'needs its scroll'}, pooling ${hasPool ? 'ready' : 'needs its scroll'}. ${solved ? 'East door open.' : 'East door: predict the size before you step through.'}`,
      ],
    }),
    [stride, padding, n2, poolMode, n3, hasPad, hasStride, hasPool, solved],
  );
  useRoomText('door', room);

  /* ── exit test ───────────────────────────────────────────────────────── */
  const q = QUESTIONS[Math.floor(world.seed * QUESTIONS.length) % QUESTIONS.length];
  const verdict = useVerdict('door');
  const ask = useCallback(() => {
    const test = EXIT_TESTS.door;
    const right = answer(q);
    const pool = [2, 3, 4, 6, 8, 1].filter((v) => v !== right);
    const opts = [right, pool[(Math.floor(world.seed * 97) + 0) % pool.length], pool[(Math.floor(world.seed * 97) + 2) % pool.length], pool[(Math.floor(world.seed * 97) + 4) % pool.length]];
    const uniq = [...new Set(opts)].slice(0, 4);
    while (uniq.length < 4) uniq.push(pool.find((v) => !uniq.includes(v)));
    const shuffled = uniq
      .map((v, i) => [v, (world.seed * 1000 + i * 37) % 1])
      .sort((a, b) => a[1] - b[1])
      .map(([v]) => v);
    hud.set({
      choice: {
        who: 'The east door',
        title: `A ${q.n}×${q.n} input meets a ${q.k}×${q.k} kernel, stride ${q.s}, padding ${q.padding}${q.pool ? ', then a 2×2 max pool with stride 2' : ''}. How wide is the next room? (${test.slides})`,
        options: shuffled.map((v) => ({ label: `${v} × ${v}`, value: v })),
        note: test.prompt,
        onPick: (o) => verdict(o.value === right, `Not yet. ${working(q)}. Walk the corridor again with those settings and count the tiles.`),
      },
    });
  }, [hud, q, verdict, world.seed]);

  const lever = (id, label, enabled, onUse, position) => (
    <Lectern id={`door:${id}`} position={position} enabled={enabled} label={label} onUse={onUse} tone={enabled ? '#d9cdb4' : '#8a8073'}>
      <Label position={[0, 1.35, 0]} className="dlg-label--title" distanceFactor={6}>
        {id}
      </Label>
    </Lectern>
  );

  return (
    <group>
      <pointLight position={[13, 4.2, ZC]} intensity={30} distance={12} decay={2} color="#ffd8b0" />
      <pointLight position={[20, 4.2, ZC]} intensity={30} distance={12} decay={2} color="#ffd8b0" />
      <pointLight position={[26.5, 4.2, ZC]} intensity={26} distance={11} decay={2} color="#ffd8b0" />

      {/* floors */}
      <Tiles cells={floor1} limit={64 + 36} />
      <Tiles cells={floor2} limit={N1 * N1} />
      <Tiles cells={floor3} limit={9} emissive={0.08} />
      <Label position={[R.r1.x0 + (N1 * T) / 2, 0.3, ZC + (N1 * T) / 2 + 0.7]} className="dlg-label--title">
        input · {N1}×{N1}{padding === 'same' ? ` · padded to ${N1 + 2 * conv.padTop}×${N1 + 2 * conv.padTop}` : ''}
      </Label>
      <Label position={[R.r2.x0 + (n2 * T) / 2, 0.3, ZC + (N1 * T) / 2 + 0.7]} className="dlg-label--title">
        conv output · {n2}×{n2}
      </Label>
      <Label position={[R.r3.x0 + (Math.max(n3, 1) * T) / 2, 0.3, ZC + (N1 * T) / 2 + 0.7]} className="dlg-label--title">
        pooled · {n3}×{n3}
      </Label>

      {/* gates */}
      <Gate boxes={gates.g1} colour="#b9a58a" />
      <Gate boxes={gates.g2} colour="#b9a58a" />
      <Label position={[R.gate1X, GATE_H + 0.5, ZC]} className="dlg-label--sum" tone="blue" distanceFactor={6}>
        conv 3×3 · stride {stride} · {padding} → {n2} wide
      </Label>
      <Label position={[R.gate2X, GATE_H + 0.5, ZC]} className="dlg-label--sum" tone="orange" distanceFactor={6}>
        {poolMode} pool 2×2 · stride 2 → {n3} wide
      </Label>

      {/* kerbs */}
      {kerbs.map((k, i) => (
        <mesh key={i} position={[(k.x0 + k.x1) / 2, 0.22, (k.z0 + k.z1) / 2]} castShadow>
          <boxGeometry args={[k.x1 - k.x0, 0.44, k.z1 - k.z0]} />
          <meshStandardMaterial color="#c7ad80" roughness={0.9} />
        </mesh>
      ))}

      {/* levers */}
      {lever('padding', `Padding: ${padding} → ${padding === 'valid' ? 'same' : 'valid'}`, hasPad, () => { setPadding((p) => (p === 'valid' ? 'same' : 'valid')); audio.tick(500); }, LEVERS.padding)}
      {lever('stride', `Stride: ${stride} → ${stride === 1 ? 2 : 1}`, hasStride, () => { setStride((s) => (s === 1 ? 2 : 1)); audio.tick(560); }, LEVERS.stride)}
      {lever('pooling', `Pooling: ${poolMode} → ${poolMode === 'max' ? 'average' : 'max'}`, hasPool, () => { setPoolMode((m) => (m === 'max' ? 'avg' : 'max')); audio.tick(620); }, LEVERS.pooling)}

      {/* scrolls */}
      <ScrollPickup id="door-padding" position={PICKUPS['door-padding']} />
      <ScrollPickup id="door-stride" position={PICKUPS['door-stride']} />
      <ScrollPickup id="door-pooling" position={PICKUPS['door-pooling']} />

      <ExitDoor houseId="door" ask={ask}>
        <Label position={[0, 3.1, 1.7]} className="dlg-label--title" distanceFactor={6}>
          how wide is the next room?
        </Label>
      </ExitDoor>
    </group>
  );
}

function Gate({ boxes, colour }) {
  return (
    <group>
      {boxes.map((b, i) => (
        <mesh key={i} position={[(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, (b.z0 + b.z1) / 2]} castShadow receiveShadow>
          <boxGeometry args={[b.x1 - b.x0, b.y1 - b.y0, b.z1 - b.z0]} />
          <meshStandardMaterial color={colour} roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

