/* ============================================================================
   HOUSE I — THE HOUSE OF THE WINDOW  (slides 6–11)
   ----------------------------------------------------------------------------
   The floor is an 8×8 greyscale image, one tile a pixel. Once the first
   scroll is read the philosopher carries a 3×3 kernel frame: wherever he
   stands the nine tiles under it light, each shows its weight, and the frame
   shows their weighted sum — which is one tile of the feature map building
   on the far wall (6×6, valid convolution). The two filter scrolls are the
   slide-10 line filters at kernel scale; swapping them changes the wall,
   which is figure 14-5 at walking scale. The spatial sibling of
   ConvolutionLab and FeatureMapLab on the 2D tab — not a copy.

   Exit test: a plaque by the north door shows one feature map; name the
   filter that made it.
   ========================================================================== */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGame } from '../world/world';
import { HOUSES, houseInterior, ROOMS } from '../world/layout';
import { audio } from '../world/audio';
import { ExitDoor, Label, Lectern, ScrollPickup, Tiles } from './kit';
import { useRoomText, useVerdict } from './roomHooks';
import { FILTERS, IMAGE, MAPS } from './windowData';
import { EXIT_TESTS } from '../content/scrolls';

const H = HOUSES.window;
const R = ROOMS.window;
const N = R.n; // 8
const M = N - R.k + 1; // 6

const grey = (v) => {
  const g = Math.round(28 + v * 200);
  return `rgb(${g},${g - 2},${g - 6})`;
};

const PICKUPS = {
  'window-kernel': [H.c[0] + 3.6, 0.85, H.c[1] + 3.4],
  'window-vertical': [H.c[0] - 4.4, 0.85, H.c[1] + 4.5],
  'window-horizontal': [H.c[0] + 4.4, 0.85, H.c[1] - 4.5],
};
const LECTERN = [H.c[0] - 4.5, 0, H.c[1]];

export function HouseWindow() {
  const { progress, hud, world } = useGame();
  const has = (id) => progress.found.includes(id);
  const hasKernel = has('window-kernel');
  const hasV = has('window-vertical');
  const hasH = has('window-horizontal');
  const solved = progress.solved.includes('window');

  /* which filter is in hand */
  const [filterId, setFilterId] = useState('mean');
  useEffect(() => {
    if (hasH && !hasV && filterId !== 'horizontal') setFilterId('horizontal');
  }, [hasH, hasV, filterId]);
  const available = ['mean', hasV && 'vertical', hasH && 'horizontal'].filter(Boolean);
  const filter = FILTERS[filterId];
  const map = MAPS[filterId];

  /* where the frame is: kernel centre tile (cx, cz) in 1..6, or null */
  const [cell, setCell] = useState(null);
  const [visited, setVisited] = useState(() => ({ mean: new Set(), vertical: new Set(), horizontal: new Set() }));
  const lastCell = useRef(null);
  const interior = useMemo(() => houseInterior(H), []);

  useFrame(() => {
    const p = world.player;
    if (!hasKernel || p.house !== 'window') {
      if (lastCell.current !== null) {
        lastCell.current = null;
        setCell(null);
      }
      return;
    }
    let ix = Math.floor(p.pos.x - R.origin[0]);
    let iz = Math.floor(p.pos.z - R.origin[1]);
    ix = Math.min(N - 2, Math.max(1, ix));
    iz = Math.min(N - 2, Math.max(1, iz));
    const key = ix * 16 + iz;
    if (key !== lastCell.current) {
      lastCell.current = key;
      setCell([ix, iz]);
      setVisited((v) => {
        const next = new Set(v[filterId]);
        next.add(`${ix - 1},${iz - 1}`);
        return { ...v, [filterId]: next };
      });
      audio.tick(420 + map[iz - 1][ix - 1] * 60);
    }
  });

  /* visiting a cell the first time with a new filter also fills it */
  useEffect(() => {
    if (!cell) return;
    setVisited((v) => {
      const k = `${cell[0] - 1},${cell[1] - 1}`;
      if (v[filterId].has(k)) return v;
      const next = new Set(v[filterId]);
      next.add(k);
      return { ...v, [filterId]: next };
    });
  }, [filterId, cell]);

  /* ── floor tiles ─────────────────────────────────────────────────────── */
  const floor = useMemo(() => {
    const cells = [];
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const under = cell && i >= cell[0] - 1 && i <= cell[0] + 1 && j >= cell[1] - 1 && j <= cell[1] + 1;
        const v = IMAGE[j][i];
        const base = 0.12 + v * 0.62;
        const color = under
          ? `rgb(${Math.round(70 + v * 110)},${Math.round(120 + v * 100)},${Math.round(200 + v * 50)})`
          : grey(base);
        cells.push({ pos: [R.origin[0] + i + 0.5, 0.04, R.origin[1] + j + 0.5], color });
      }
    }
    return cells;
  }, [cell]);

  /* ── the wall: 6×6 feature map on the west wall ──────────────────────── */
  const wall = useMemo(() => {
    const cells = [];
    const vis = visited[filterId];
    for (let j = 0; j < M; j++) {
      for (let i = 0; i < M; i++) {
        const seen = vis.has(`${i},${j}`);
        const v = seen ? map[j][i] / filter.max : 0;
        const current = cell && cell[0] - 1 === i && cell[1] - 1 === j;
        cells.push({
          pos: [R.wallX + 0.04, R.wallY0 + (M - 1 - i) * R.wallTile + R.wallTile / 2, H.c[1] + (j - (M - 1) / 2) * R.wallTile],
          color: current ? '#7fb2ff' : seen ? grey(0.1 + v * 0.85) : '#1a1e2b',
          scale: [0.08, R.wallTile - 0.05, R.wallTile - 0.05],
        });
      }
    }
    return cells;
  }, [visited, filterId, map, filter.max, cell]);

  const sum = cell ? map[cell[1] - 1][cell[0] - 1] : null;
  const filled = visited[filterId].size;

  /* ── room description (accessible) ──────────────────────────────────── */
  const room = useMemo(
    () => ({
      title: 'House of the Window',
      lectureTab: 'conv',
      lines: [
        hasKernel
          ? `Carrying the ${filter.name.toLowerCase()} (slide ${filter.slide}).${cell ? ` Kernel centred on column ${cell[0]}, row ${cell[1]} of the 8×8 image; weighted sum ${fmt(sum)}.` : ''}`
          : 'The floor is an 8×8 image. Read the first scroll to raise the kernel frame.',
        hasKernel ? `Feature map on the west wall: ${filled} of ${M * M} tiles. Walk the image to fill it.` : `Scrolls here: ${['window-kernel', 'window-vertical', 'window-horizontal'].filter(has).length} of 3.`,
        solved ? 'North door open.' : 'North door: name the filter that made the map on its plaque.',
      ],
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hasKernel, filter, cell, sum, filled, solved, progress.found.length],
  );
  useRoomText('window', room);

  /* ── exit test ───────────────────────────────────────────────────────── */
  const answer = world.seed < 0.5 ? 'vertical' : 'horizontal';
  const verdict = useVerdict('window');
  const ask = useCallback(() => {
    const test = EXIT_TESTS.window;
    hud.set({
      choice: {
        who: 'The north door',
        title: `${test.prompt} (slides ${test.slides})`,
        options: [
          { label: 'Vertical-line filter', value: 'vertical' },
          { label: 'Horizontal-line filter', value: 'horizontal' },
          { label: 'Averaging filter', value: 'mean' },
        ],
        note: `The plaque beside the door shows the map. You are carrying the ${filter.name.toLowerCase()}.`,
        onPick: (o) => verdict(o.value === answer, `Not that one. ${answer === 'vertical' ? 'The bright tiles run in standing columns — only the column of ones answers to them.' : 'The bright tiles run in flat rows — only the row of ones answers to them.'} (slides 10–11)`),
      },
    });
  }, [hud, filter.name, answer, verdict]);

  const plaque = useMemo(() => {
    const cells = [];
    const m = MAPS[answer];
    const f = FILTERS[answer];
    const s = 0.16;
    for (let j = 0; j < M; j++) {
      for (let i = 0; i < M; i++) {
        cells.push({
          pos: [(j - (M - 1) / 2) * s, 1.75 + (M - 1 - i) * s, 0.02],
          color: grey(0.1 + (m[j][i] / f.max) * 0.85),
          scale: [s - 0.02, s - 0.02, 0.04],
        });
      }
    }
    return cells;
  }, [answer]);

  const swap = useCallback(() => {
    const i = available.indexOf(filterId);
    setFilterId(available[(i + 1) % available.length]);
    audio.tick(700);
  }, [available, filterId]);

  const frameY = 0.1;
  return (
    <group>
      {/* interior light */}
      <pointLight position={[H.c[0], 3.6, H.c[1]]} intensity={40} distance={16} decay={2} color="#ffd8b0" />
      <pointLight position={[R.wallX + 1.2, 3.2, H.c[1]]} intensity={14} distance={9} decay={2} color="#cfe0ff" />

      <Tiles cells={floor} />
      <Tiles cells={wall} emissive={0.04} roughness={0.6} />

      {/* wall frame */}
      <mesh position={[R.wallX + 0.02, R.wallY0 + (M * R.wallTile) / 2, H.c[1]]}>
        <boxGeometry args={[0.04, M * R.wallTile + 0.2, M * R.wallTile + 0.2]} />
        <meshStandardMaterial color="#3b3a44" roughness={0.9} />
      </mesh>
      <Label position={[R.wallX + 0.3, R.wallY0 + M * R.wallTile + 0.45, H.c[1]]} className="dlg-label--title">
        feature map · {filter.name.toLowerCase()}
      </Label>

      {/* the kernel frame */}
      {hasKernel && cell && (
        <group position={[R.origin[0] + cell[0] + 0.5, frameY, R.origin[1] + cell[1] + 0.5]}>
          {[[0, -1.5], [0, 1.5]].map(([x, z], i) => (
            <mesh key={`h${i}`} position={[x, 0, z]}>
              <boxGeometry args={[3.04, 0.06, 0.06]} />
              <meshStandardMaterial color="#2a78d6" emissive="#2a78d6" emissiveIntensity={0.8} />
            </mesh>
          ))}
          {[[-1.5, 0], [1.5, 0]].map(([x, z], i) => (
            <mesh key={`v${i}`} position={[x, 0, z]}>
              <boxGeometry args={[0.06, 0.06, 3.04]} />
              <meshStandardMaterial color="#2a78d6" emissive="#2a78d6" emissiveIntensity={0.8} />
            </mesh>
          ))}
          {filter.w.map((row, b) =>
            row.map((wv, a) =>
              wv === 0 && filterId !== 'mean' ? null : (
                <Label key={`${a}${b}`} position={[a - 1, 0.02, b - 1]} className="dlg-label--w" distanceFactor={5}>
                  {filter.show ?? wv}
                </Label>
              ),
            ),
          )}
          <Label position={[-1.75, 0.45, 0]} className="dlg-label--sum" tone="blue" distanceFactor={5}>
            Σ = {fmt(sum)}
          </Label>
        </group>
      )}

      {/* scrolls */}
      <ScrollPickup id="window-kernel" position={PICKUPS['window-kernel']} />
      <ScrollPickup id="window-vertical" position={PICKUPS['window-vertical']} onFound={() => setFilterId('vertical')} />
      <ScrollPickup id="window-horizontal" position={PICKUPS['window-horizontal']} onFound={() => setFilterId('horizontal')} />

      {/* the lectern: swap filters */}
      <Lectern
        id="window:lectern"
        position={LECTERN}
        enabled={available.length > 1}
        label={`Swap filter · next: ${FILTERS[available[(available.indexOf(filterId) + 1) % available.length]]?.name.toLowerCase()}`}
        onUse={swap}
      >
        <Label position={[0, 1.35, 0]} className="dlg-label--title">
          {available.length > 1 ? 'filters' : 'one filter'}
        </Label>
      </Lectern>

      {/* the exit door + plaque */}
      <ExitDoor houseId="window" ask={ask}>
        <group position={[1.9, 0, 0]}>
          <mesh position={[0, 1.75 + ((M - 1) * 0.16) / 2, 0]}>
            <boxGeometry args={[M * 0.16 + 0.16, M * 0.16 + 0.16, 0.03]} />
            <meshStandardMaterial color="#3b3a44" roughness={0.9} />
          </mesh>
          <Tiles cells={plaque} emissive={0.12} roughness={0.5} size={[0.14, 0.14, 0.04]} />
          <Label position={[0, 1.55, 0.1]} className="dlg-label--title" distanceFactor={5}>
            which filter?
          </Label>
        </group>
      </ExitDoor>

      {/* interior guide line on the floor edge */}
      <mesh position={[H.c[0], 0.005, H.c[1]]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[0, 0.01, 4]} />
        <meshBasicMaterial color="#000" transparent opacity={0} />
      </mesh>
      {interior && null}
    </group>
  );
}

const fmt = (v) => (v === null || v === undefined ? '—' : Number.isInteger(v) ? String(v) : v.toFixed(2));
