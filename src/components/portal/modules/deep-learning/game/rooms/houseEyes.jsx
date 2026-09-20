/* ============================================================================
   HOUSE II — THE HOUSE OF MANY EYES  (slides 12–15)
   ----------------------------------------------------------------------------
   Figure 14-6 at walking scale. On the ground three translucent planes are
   the red, green and blue channels of one 6×6 picture. A filter is a solid
   3×3 box that spans all three planes at once; push it (E) and the tile it
   covers is written to a sheet overhead — one sheet per filter, one feature
   map each. Read the second scroll and a second filter and sheet appear:
   count the sheets and you have counted the output channels.

   The stair on the east wall climbs to a grille deck at sheet height: the
   sheets you just made are now the INPUT, and a layer-2 filter box reaches
   through all of them to write a 2×2 map high overhead.

   The convolution equation from slide 15 is engraved on the north wall.
   Standing by a channel plane lights x_c, by a filter lights f_{c,k}, on the
   deck by a sheet lights z_k, at the bias plinth lights b_k.

   Exit test (slide 18): Conv2D(filters=32) on a 3-channel image — how many
   channels leave the layer?
   ========================================================================== */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { useGame } from '../world/world';
import { HOUSES, houseInterior, ROOMS } from '../world/layout';
import { audio } from '../world/audio';
import { useInteractable } from '../world/useInteractable';
import { Tex } from '../../kit';
import { ExitDoor, Label, Lectern, ScrollPickup, Tiles } from './kit';
import { useDynamicColliders, useGroundOverride, useRoomText, useVerdict } from './roomHooks';
import { CHANNELS, FILTERS, K, M, M2, N, conv3, featureMap, layer2, shade } from './eyesData';
import { EXIT_TESTS } from '../content/scrolls';

const H = HOUSES.eyes;
const R = ROOMS.eyes;
const I = houseInterior(H);
const [OX, OZ] = R.origin; // input grid origin (min x, min z)
const DECK = { x0: -3.5, x1: 3.9, z0: -23.5, z1: -16.5, y: R.deckY };
const LANDING = { x0: 3.9, x1: I.x1, z0: I.z0, z1: -20.3, y: R.deckY };
const STAIR = { x0: 3.9, x1: 5.7, zStart: -14.3, zEnd: -20.3 }; // y = 0 at zStart → deck at zEnd
const PICKUPS = {
  'eyes-channels': [0, 0.85, -15.4],
  'eyes-many': [-4.6, 0.85, -24.6],
  'eyes-equation': [5.1, R.deckY + 0.85, -25.0],
};
const BIAS_PLINTH = [-5.2, 0, -17.2];
const SHEET_TILE = 0.92;

const cellCentre = (gx, gz) => [OX + gx + 1.5, OZ + gz + 1.5]; // centre of a 3×3 window at (gx, gz)
const sheetCentre = (i, j) => [OX + 1 + i + 0.5, OZ + 1 + j + 0.5]; // output tile (i, j) sits over its window's centre

export function HouseEyes() {
  const { progress, hud, world } = useGame();
  const has = (id) => progress.found.includes(id);
  const hasChannels = has('eyes-channels');
  const hasMany = has('eyes-many');
  const hasEq = has('eyes-equation');
  const solved = progress.solved.includes('eyes');
  const filtersK = hasEq ? 3 : hasMany ? 2 : hasChannels ? 1 : 0;

  /* filter boxes: window index per filter, visited cells per filter */
  const [boxes, setBoxes] = useState([[0, 0], [3, 0], [0, 3]]);
  const [visited, setVisited] = useState(() => FILTERS.map(() => new Set()));
  const [bias, setBias] = useState(0);
  const [box2, setBox2] = useState([0, 0]);
  const [visited2, setVisited2] = useState(() => new Set());

  const sheets = useMemo(() => FILTERS.map((f) => featureMap(f, bias)), [bias]);
  const active = FILTERS.slice(0, filtersK);

  /* the first time a filter appears, it writes its starting tile */
  useEffect(() => {
    if (!filtersK) return;
    setVisited((v) => {
      const next = v.map((s) => new Set(s));
      let changed = false;
      for (let k = 0; k < filtersK; k++) {
        const key = `${boxes[k][0]},${boxes[k][1]}`;
        if (!next[k].has(key)) {
          next[k].add(key);
          changed = true;
        }
      }
      return changed ? next : v;
    });
  }, [filtersK, boxes]);
  useEffect(() => {
    if (!filtersK) return;
    setVisited2((v) => {
      const key = `${box2[0]},${box2[1]}`;
      if (v.has(key)) return v;
      const n = new Set(v);
      n.add(key);
      return n;
    });
  }, [filtersK, box2]);

  /* ── ground: stair, landing, deck (only if already up) ───────────────── */
  const ground = useCallback(
    (x, z) => {
      if (x >= STAIR.x0 && x <= STAIR.x1 && z <= STAIR.zStart && z >= STAIR.zEnd) {
        return DECK.y * ((STAIR.zStart - z) / (STAIR.zStart - STAIR.zEnd));
      }
      if (x >= LANDING.x0 && x <= LANDING.x1 && z >= LANDING.z0 && z <= LANDING.z1) return DECK.y;
      if (x >= DECK.x0 && x <= DECK.x1 && z >= DECK.z0 && z <= DECK.z1 && world.player.pos.y > DECK.y - 1.4) return DECK.y;
      return null;
    },
    [world],
  );
  useGroundOverride('eyes', ground);

  /* ── colliders: filter boxes, deck railings, stair balustrade ────────── */
  const colliders = useMemo(() => {
    const c = [];
    for (let k = 0; k < filtersK; k++) {
      const [cx, cz] = cellCentre(...boxes[k]);
      c.push({ x0: cx - 1.42, x1: cx + 1.42, z0: cz - 1.42, z1: cz + 1.42, y0: 0, y1: 1.0 });
    }
    if (filtersK) {
      const [cx, cz] = cellCentre(...box2);
      c.push({ x0: cx - 1.42, x1: cx + 1.42, z0: cz - 1.42, z1: cz + 1.42, y0: DECK.y, y1: DECK.y + 1.0 });
    }
    const rail = { y0: DECK.y - 0.2, y1: DECK.y + 1.3 };
    c.push({ x0: DECK.x0 - 0.2, x1: DECK.x0, z0: DECK.z0, z1: DECK.z1, ...rail });
    c.push({ x0: DECK.x0, x1: DECK.x1, z0: DECK.z0 - 0.2, z1: DECK.z0, ...rail });
    c.push({ x0: DECK.x0, x1: DECK.x1, z0: DECK.z1, z1: DECK.z1 + 0.2, ...rail });
    // landing edges towards the open floor
    c.push({ x0: LANDING.x0 - 0.2, x1: LANDING.x0, z0: LANDING.z0, z1: DECK.z0, ...rail });
    c.push({ x0: LANDING.x0 - 0.2, x1: LANDING.x0, z0: DECK.z1, z1: LANDING.z1, ...rail });
    c.push({ x0: LANDING.x0, x1: LANDING.x1, z0: LANDING.z1, z1: LANDING.z1 + 0.2, ...rail });
    // stair balustrade (low: also there at ground level, like a real one)
    c.push({ x0: STAIR.x0 - 0.15, x1: STAIR.x0, z0: STAIR.zEnd, z1: STAIR.zStart, y0: 0, y1: DECK.y + 1.2 });
    return c;
  }, [filtersK, boxes, box2]);
  useDynamicColliders('eyes', colliders);

  /* ── pushing (E): the box moves one cell away from where you stand ───── */
  const push = useCallback(
    (k) => {
      const p = world.player.pos;
      const isL2 = k === 'l2';
      const cur = isL2 ? box2 : boxes[k];
      const [cx, cz] = cellCentre(...cur);
      const dx = cx - p.x;
      const dz = cz - p.z;
      const step = Math.abs(dx) > Math.abs(dz) ? [Math.sign(dx), 0] : [0, Math.sign(dz)];
      const lim = isL2 ? M2 - 1 : M - 1;
      const nx = Math.min(lim, Math.max(0, cur[0] + step[0]));
      const nz = Math.min(lim, Math.max(0, cur[1] + step[1]));
      if (nx === cur[0] && nz === cur[1]) {
        audio.thud();
        return;
      }
      if (isL2) {
        setBox2([nx, nz]);
        setVisited2((v) => new Set(v).add(`${nx},${nz}`));
      } else {
        setBoxes((b) => b.map((bb, i) => (i === k ? [nx, nz] : bb)));
        setVisited((v) => v.map((s, i) => (i === k ? new Set(s).add(`${nx},${nz}`) : s)));
      }
      audio.tick(isL2 ? 640 : 480 + k * 80);
    },
    [world, boxes, box2],
  );

  /* ── which equation term is lit ──────────────────────────────────────── */
  const [term, setTerm] = useState(null);
  const lastTerm = useRef(null);
  useFrame(() => {
    const p = world.player;
    let t = null;
    if (p.house === 'eyes' && hasEq) {
      const up = p.pos.y > DECK.y - 1;
      const bx = p.pos.x - BIAS_PLINTH[0];
      const bz = p.pos.z - BIAS_PLINTH[2];
      if (!up && bx * bx + bz * bz < 4) t = 'b';
      else if (up && p.pos.x > DECK.x0 && p.pos.x < DECK.x1 && p.pos.z > DECK.z0 && p.pos.z < DECK.z1) t = 'z';
      else if (!up) {
        for (let k = 0; k < filtersK; k++) {
          const [cx, cz] = cellCentre(...boxes[k]);
          if (Math.abs(p.pos.x - cx) < 2.3 && Math.abs(p.pos.z - cz) < 2.3) t = 'f';
        }
        if (!t && p.pos.x > OX && p.pos.x < OX + N && p.pos.z > OZ && p.pos.z < OZ + N) t = 'x';
      }
    }
    if (t !== lastTerm.current) {
      lastTerm.current = t;
      setTerm(t);
    }
  });

  /* ── geometry ────────────────────────────────────────────────────────── */
  const planes = useMemo(() => {
    const cells = [];
    CHANNELS.forEach((ch, c) => {
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        cells.push({ pos: [OX + i + 0.5, R.channelY[c], OZ + j + 0.5], color: shade(ch.v[j][i], ch.hue), scale: [0.94, 0.06, 0.94] });
      }
    });
    return cells;
  }, []);

  const sheetCells = useMemo(() => {
    const cells = [];
    for (let k = 0; k < filtersK; k++) {
      const f = FILTERS[k];
      const sh = sheets[k];
      for (let j = 0; j < M; j++) for (let i = 0; i < M; i++) {
        const seen = visited[k].has(`${i},${j}`);
        const [x, z] = sheetCentre(i, j);
        const current = boxes[k][0] === i && boxes[k][1] === j;
        cells.push({
          pos: [x, R.sheetY + k * R.sheetGap, z],
          color: current ? '#ffffff' : seen ? shade(sh.map[j][i] / sh.max, f.hue) : '#14171f',
          scale: [SHEET_TILE, 0.05, SHEET_TILE],
        });
      }
    }
    return cells;
  }, [filtersK, sheets, visited, boxes]);

  const topCells = useMemo(() => {
    if (!filtersK) return [];
    const cells = [];
    const act = sheets.slice(0, filtersK);
    for (let j = 0; j < M2; j++) for (let i = 0; i < M2; i++) {
      const seen = visited2.has(`${i},${j}`);
      const v = layer2(act, i, j);
      const [x, z] = [OX + 2 + i + 0.5, OZ + 2 + j + 0.5];
      cells.push({ pos: [x, R.topY, z], color: seen ? shade(v, '#1baf7a') : '#14171f', scale: [SHEET_TILE, 0.06, SHEET_TILE] });
    }
    return cells;
  }, [filtersK, sheets, visited2]);

  /* ── room text ───────────────────────────────────────────────────────── */
  const filled = active.map((f, k) => visited[k].size);
  const room = useMemo(
    () => ({
      title: 'House of Many Eyes',
      lectureTab: 'stack',
      lines: [
        `Three channel planes on the floor (red, green, blue), 6×6 each. ${filtersK ? `${filtersK} filter${filtersK > 1 ? 's' : ''} in the room, each 3×3×3, so ${filtersK} sheet${filtersK > 1 ? 's' : ''} overhead: ${filtersK} output channel${filtersK > 1 ? 's' : ''}.` : 'Read the first scroll to place a filter.'}`,
        filtersK ? `Sheets filled: ${filled.map((n, k) => `filter ${k + 1} ${n}/16`).join(', ')}. Bias b = ${bias}. Layer 2 on the deck: ${visited2.size}/4 tiles.` : 'Stairs on the east wall lead to the deck.',
        solved ? 'West door open.' : 'West door: how many channels leave a layer of 32 filters?',
      ],
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filtersK, filled.join(','), bias, visited2.size, solved],
  );
  useRoomText('eyes', room);

  /* ── exit test ───────────────────────────────────────────────────────── */
  const verdict = useVerdict('eyes');
  const ask = useCallback(() => {
    const test = EXIT_TESTS.eyes;
    hud.set({
      choice: {
        who: 'The west door',
        title: `Slide 18: Conv2D(filters=32, kernel_size=7) on a 70×120×3 image. How many channels leave the layer? (${test.prompt})`,
        options: [
          { label: '3 · one per input channel', value: 3 },
          { label: '32 · one per filter', value: 32 },
          { label: '96 · three per filter', value: 96 },
          { label: '35 · filters plus channels', value: 35 },
        ],
        note: `In this room ${filtersK} filter${filtersK === 1 ? '' : 's'} made ${filtersK} sheet${filtersK === 1 ? '' : 's'}. The rule does not change with the number.`,
        onPick: (o) => verdict(o.value === 32, 'One filter, one feature map, one output channel. The filter count is the channel count — the input channels are consumed inside each filter (slides 13, 15, 18).'),
      },
    });
  }, [hud, filtersK, verdict]);

  return (
    <group>
      {/* light */}
      <pointLight position={[0, 6, -20]} intensity={55} distance={22} decay={2} color="#ffe0c0" />
      <pointLight position={[0, 2.2, -16]} intensity={12} distance={10} decay={2} color="#ffd8b0" />
      <pointLight position={[0, R.topY + 1.2, -20]} intensity={18} distance={12} decay={2} color="#c8ffe6" />

      {/* channel planes */}
      <Tiles cells={planes} emissive={0.05} roughness={0.5} />
      {CHANNELS.map((ch, c) => (
        <Label key={ch.id} position={[OX - 0.6, R.channelY[c] + 0.05, OZ + N + 0.4]} className="dlg-label--title" distanceFactor={6}>
          <span style={{ color: ch.hue }}>x{c} · {ch.id}</span>
        </Label>
      ))}

      {/* layer-1 filter boxes */}
      {active.map((f, k) => {
        const [cx, cz] = cellCentre(...boxes[k]);
        const v = conv3(f, boxes[k][0], boxes[k][1], bias);
        return (
          <FilterBox key={f.id} id={`eyes:f${k}`} x={cx} z={cz} y0={0} h={1.0} hue={f.hue} label={`Push ${f.name.toLowerCase()}`} onUse={() => push(k)} value={v} name={`f${k + 1} · 3×3×3`} />
        );
      })}

      {/* sheets */}
      <Tiles cells={sheetCells} emissive={0.15} roughness={0.4} limit={FILTERS.length * M * M} />
      {active.map((f, k) => (
        <Label key={f.id} position={[OX + 1 - 0.7, R.sheetY + k * R.sheetGap + 0.02, OZ + N - 0.7 + k * 0.3]} className="dlg-label--title" distanceFactor={6}>
          <span style={{ color: f.hue }}>z{k + 1} · sheet {k + 1}</span>
        </Label>
      ))}

      {/* deck + landing + stair */}
      <mesh position={[(DECK.x0 + DECK.x1) / 2, DECK.y - 0.03, (DECK.z0 + DECK.z1) / 2]}>
        <boxGeometry args={[DECK.x1 - DECK.x0, 0.06, DECK.z1 - DECK.z0]} />
        <meshStandardMaterial color="#d9cdb4" transparent opacity={0.28} roughness={0.4} depthWrite={false} />
      </mesh>
      <Grille x0={DECK.x0} x1={DECK.x1} z0={DECK.z0} z1={DECK.z1} y={DECK.y} />
      <mesh position={[(LANDING.x0 + LANDING.x1) / 2, DECK.y - 0.06, (LANDING.z0 + LANDING.z1) / 2]} receiveShadow>
        <boxGeometry args={[LANDING.x1 - LANDING.x0, 0.12, LANDING.z1 - LANDING.z0]} />
        <meshStandardMaterial color="#c7ad80" roughness={0.85} />
      </mesh>
      <Stair />
      {/* railings */}
      {[
        [DECK.x0, DECK.z0, DECK.x0, DECK.z1],
        [DECK.x0, DECK.z0, DECK.x1, DECK.z0],
        [DECK.x0, DECK.z1, DECK.x1, DECK.z1],
        [LANDING.x0, LANDING.z0, LANDING.x0, DECK.z0],
        [LANDING.x0, DECK.z1, LANDING.x0, LANDING.z1],
        [LANDING.x0, LANDING.z1, LANDING.x1, LANDING.z1],
      ].map(([x0, z0, x1, z1], i) => (
        <mesh key={i} position={[(x0 + x1) / 2, DECK.y + 0.5, (z0 + z1) / 2]}>
          <boxGeometry args={[Math.max(0.06, x1 - x0), 0.04, Math.max(0.06, z1 - z0)]} />
          <meshStandardMaterial color="#6b5a45" roughness={0.8} />
        </mesh>
      ))}

      {/* layer-2 filter box + top map */}
      {filtersK > 0 && (
        <>
          <FilterBox
            id="eyes:l2"
            x={cellCentre(...box2)[0]}
            z={cellCentre(...box2)[1]}
            y0={DECK.y}
            h={1.0}
            hue="#1baf7a"
            label="Push the layer-2 filter"
            onUse={() => push('l2')}
            value={layer2(sheets.slice(0, filtersK), box2[0], box2[1])}
            name={`layer 2 · 3×3×${filtersK}`}
          />
          <Tiles cells={topCells} emissive={0.25} roughness={0.4} limit={M2 * M2} />
          <Label position={[OX + 2 - 0.6, R.topY + 0.05, OZ + 2 + M2 + 0.3]} className="dlg-label--title" distanceFactor={7}>
            <span style={{ color: '#1baf7a' }}>layer 2 output · 2×2</span>
          </Label>
        </>
      )}

      {/* bias plinth */}
      <Lectern id="eyes:bias" position={BIAS_PLINTH} enabled={filtersK > 0} label={`Bias b_k: ${bias} → ${bias ? 0 : 0.5}`} onUse={() => { setBias((b) => (b ? 0 : 0.5)); audio.tick(300); }} tone="#b9a58a">
        <Label position={[0, 1.35, 0]} className="dlg-label--title" distanceFactor={6}>
          bias · b = {bias}
        </Label>
      </Lectern>

      {/* the equation on the north wall */}
      <Html transform position={[0, 4.9, R.eqWallZ + 0.08]} rotation={[0, 0, 0]} distanceFactor={2.8} zIndexRange={[2, 1]} style={{ pointerEvents: 'none' }}>
        <div className={`dlg-eq${hasEq ? ' dlg-eq--lit' : ''}`} data-term={term ?? ''}>
          <span className="dlg-eq__t" data-t="z"><Tex src="z_k" /></span>
          <span className="dlg-eq__t"><Tex src="=" /></span>
          <span className="dlg-eq__t" data-t="b"><Tex src="b_k" /></span>
          <span className="dlg-eq__t"><Tex src="+" /></span>
          <span className="dlg-eq__t" data-t="x"><Tex src="\sum_{c=0}^{N_{\mathrm{ch}}-1} x_c" /></span>
          <span className="dlg-eq__t" data-t="f"><Tex src="\ast f_{c,k}" /></span>
          <p className="dlg-eq__read">
            {hasEq ? termRead(term) : 'read the third scroll to wake the wall · slide 15'}
          </p>
        </div>
      </Html>

      {/* scrolls */}
      <ScrollPickup id="eyes-channels" position={PICKUPS['eyes-channels']} />
      <ScrollPickup id="eyes-many" position={PICKUPS['eyes-many']} />
      <ScrollPickup id="eyes-equation" position={PICKUPS['eyes-equation']} />

      {/* exit */}
      <ExitDoor houseId="eyes" ask={ask}>
        <Label position={[0, 3.4, 1.6]} className="dlg-label--title" distanceFactor={6}>
          how many channels leave?
        </Label>
      </ExitDoor>
    </group>
  );
}

function termRead(t) {
  switch (t) {
    case 'x': return 'x_c · channel c of the input — one plane under your feet';
    case 'f': return 'f_{c,k} · channel c of filter k — the box reaches through every plane';
    case 'z': return 'z_k · output channel k — the sheet you are standing over';
    case 'b': return 'b_k · one bias per filter';
    default: return 'each filter writes one output channel · slide 15';
  }
}

/* A filter: a solid translucent box with an edge frame in its hue. */
function FilterBox({ id, x, z, y0, h, hue, label, onUse, value, name }) {
  useInteractable(id, { pos: [x, y0, z], radius: 2.4, label, onUse }, [x, z, label, onUse]);
  const g = useRef();
  const target = useRef([x, z]);
  useEffect(() => {
    target.current = [x, z];
  }, [x, z]);
  useFrame((_, dt) => {
    if (!g.current) return;
    const k = 1 - Math.pow(0.001, dt);
    g.current.position.x += (target.current[0] - g.current.position.x) * k;
    g.current.position.z += (target.current[1] - g.current.position.z) * k;
  });
  return (
    <group ref={g} position={[x, y0, z]}>
      <mesh position={[0, h / 2, 0]} castShadow>
        <boxGeometry args={[2.9, h, 2.9]} />
        <meshStandardMaterial color={hue} transparent opacity={0.3} roughness={0.3} depthWrite={false} />
      </mesh>
      {[[0, -1.45], [0, 1.45]].map(([ox, oz], i) => (
        <mesh key={`a${i}`} position={[ox, h, oz]}>
          <boxGeometry args={[2.94, 0.06, 0.06]} />
          <meshStandardMaterial color={hue} emissive={hue} emissiveIntensity={0.9} />
        </mesh>
      ))}
      {[[-1.45, 0], [1.45, 0]].map(([ox, oz], i) => (
        <mesh key={`b${i}`} position={[ox, h, oz]}>
          <boxGeometry args={[0.06, 0.06, 2.94]} />
          <meshStandardMaterial color={hue} emissive={hue} emissiveIntensity={0.9} />
        </mesh>
      ))}
      {[[-1.45, -1.45], [1.45, -1.45], [-1.45, 1.45], [1.45, 1.45]].map(([ox, oz], i) => (
        <mesh key={`c${i}`} position={[ox, h / 2, oz]}>
          <boxGeometry args={[0.06, h, 0.06]} />
          <meshStandardMaterial color={hue} emissive={hue} emissiveIntensity={0.6} />
        </mesh>
      ))}
      <Label position={[0, h + 0.45, 0]} className="dlg-label--sum" distanceFactor={6}>
        <span style={{ color: hue }}>{name}</span> · z = {value.toFixed(2)}
      </Label>
    </group>
  );
}

function Grille({ x0, x1, z0, z1, y }) {
  const bars = [];
  for (let x = Math.ceil(x0); x <= Math.floor(x1); x++) bars.push(['x', x]);
  for (let z = Math.ceil(z0); z <= Math.floor(z1); z++) bars.push(['z', z]);
  return (
    <group>
      {bars.map(([axis, v], i) =>
        axis === 'x' ? (
          <mesh key={i} position={[v, y, (z0 + z1) / 2]}>
            <boxGeometry args={[0.05, 0.04, z1 - z0]} />
            <meshStandardMaterial color="#6b5a45" roughness={0.8} />
          </mesh>
        ) : (
          <mesh key={i} position={[(x0 + x1) / 2, y, v]}>
            <boxGeometry args={[x1 - x0, 0.04, 0.05]} />
            <meshStandardMaterial color="#6b5a45" roughness={0.8} />
          </mesh>
        ),
      )}
    </group>
  );
}

function Stair() {
  const steps = 12;
  const run = (STAIR.zStart - STAIR.zEnd) / steps;
  const rise = DECK.y / steps;
  return (
    <group>
      {Array.from({ length: steps }, (_, i) => {
        const zHi = STAIR.zStart - i * run;
        const y1 = rise * (i + 1);
        return (
          <mesh key={i} position={[(STAIR.x0 + STAIR.x1) / 2, y1 / 2, zHi - run / 2]} castShadow receiveShadow>
            <boxGeometry args={[STAIR.x1 - STAIR.x0, y1, run]} />
            <meshStandardMaterial color="#c7ad80" roughness={0.85} />
          </mesh>
        );
      })}
      <mesh position={[STAIR.x0 - 0.06, DECK.y / 2 + 0.5, (STAIR.zStart + STAIR.zEnd) / 2]} rotation={[Math.atan2(DECK.y, STAIR.zStart - STAIR.zEnd), 0, 0]}>
        <boxGeometry args={[0.05, 0.04, Math.hypot(DECK.y, STAIR.zStart - STAIR.zEnd)]} />
        <meshStandardMaterial color="#6b5a45" roughness={0.8} />
      </mesh>
    </group>
  );
}
