import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import type * as THREE from "three";
import {
  FiColumns,
  FiCrosshair,
  FiDroplet,
  FiEdit2,
  FiGrid,
  FiHelpCircle,
  FiLogIn,
  FiLogOut,
  FiMaximize2,
  FiMinimize2,
  FiMinusSquare,
  FiPlus,
  FiPlusSquare,
  FiRotateCcw,
  FiRotateCw,
  FiSliders,
  FiTrash2,
  FiUsers,
  FiX,
  FiZoomIn,
  FiZoomOut,
} from "react-icons/fi";

import {
  addLegendEntry,
  addWall,
  canErase,
  canPaint,
  canPlaceItem,
  canPlaceWall,
  centroid,
  eraseTile,
  findWall,
  hasTile,
  inPaintBounds,
  keyOf,
  LEGEND_NAME_MAX,
  MAX_ITEMS,
  MAX_LEGEND,
  nearestEdge,
  normalizeZones,
  paintBounds,
  paintTile,
  removeLegendEntry,
  removeWall,
  tintTile,
  toggleDoor,
  untintTile,
  updateLegendEntry,
  wallKey,
  type FurnitureType,
  type Item,
  type OfficeLayout,
  type PaintBounds,
  type Rot,
  type Tile,
  type Wall,
  type WallOrientation,
} from "../../lib/office-layout";
import type { Autonomy } from "../../lib/agent/models";
import type { OfficePop } from "../../lib/office-live";
import { WORKER_STATUSES, type WorkerStatus } from "../../lib/workers";
import { AgentModel, STAGE } from "./agent";
import { buildIntroPlan, stampIntro, type IntroPlan } from "./intro";
import { FurnitureModel, ItemWrap, WallModel } from "./models";
import {
  BARRIER_TOTAL,
  BoundsBarrier,
  CameraRig,
  SkyBackdrop,
  EdgeHighlight,
  Floor,
  GroundShadow,
  Lights,
  PaintGhost,
  SelectRing,
  StageBurst,
  StageDressing,
  TileCursor,
  WallFade,
  ZoneOverlay,
  type CameraControl,
  type FloorFlash,
} from "./scene";
import { UI3D } from "./palette";
import { PixelArtRenderer } from "./pixel-art";
import { ToolPreviewBaker } from "./tool-previews";
import { PortletPortrait } from "../portlet-portrait";

export type OfficeWorker = {
  id: string;
  name: string;
  /** Job title, under the name on the hover card. Nullable in the DB - an
      agent that hasn't been given one simply doesn't show a line. */
  title?: string | null;
  status: WorkerStatus;
  sprite: string;
  /** The task of the worker's currently-running execution, if any. Shown in
      the hover card above their head. */
  task?: string | null;
  /* The rest of the hover card: the three things you'd otherwise have to open
     the console to learn. All optional so a caller with no run log (the
     landing-page showcase) simply renders a smaller card. */
  /** How much a run may change: 'suggest' is read-only, 'act' is not. */
  autonomy?: Autonomy;
  /** Rolling self-assessment, 0-100. Null until the first graded run - and
      `confidenceRuns` matters as much as the number, since a score off one
      run is not a track record. */
  confidence?: number | null;
  confidenceRuns?: number;
  /** ISO timestamp of the most recent run of any status, or null. */
  lastRunAt?: string | null;
  /** Set when this agent has parked mid-run and is waiting on a person to
      approve or refuse one change (migration 0051). */
  waiting?: { label: string; risk: "write" | "sensitive" } | null;
};

type Mode =
  | { kind: "idle" }
  | { kind: "paint" }
  | { kind: "erase" }
  | { kind: "wall" }
  | { kind: "door" }
  | { kind: "tint"; legendId: string }
  | { kind: "place-item"; type: FurnitureType }
  | { kind: "place-agent"; workerId: string }
  | { kind: "move-item"; id: string; drag: boolean };

type Selection =
  | { kind: "item"; id: string }
  | { kind: "agent"; workerId: string }
  | null;

type EdgeHover = { x: number; z: number; o: WallOrientation } | null;

/** The dock's flyout panels. One open at a time, or none. */
type DockPanel = "team" | "build" | "legend";
const DOCK_PANELS: readonly DockPanel[] = ["team", "build", "legend"];
const HUD_PANELS_KEY = "px-office-hud";

const now = () => performance.now() / 1000;
const newId = () =>
  (globalThis.crypto?.randomUUID?.() ?? `i${Math.random().toString(36).slice(2, 12)}`)
    .replace(/[^\w-]/g, "")
    .slice(0, 64);

/** How close (world units) the pointer must be to an edge to erase a wall. */
const ERASE_EDGE_REACH = 0.3;

/** Pixels the showcase keeps clear above the floor for the status cards that
    hang over the agents' heads. One card is ~120px; this buys most of that
    without shrinking the diorama to a stamp, and the cards clamp themselves
    to the canvas (see office3d/agent.tsx) if a lap ever needs more. */
const SHOWCASE_HEADROOM = 84;

/** The placeable furniture, in toolbar order. */
const FURNITURE_TOOLS: { type: FurnitureType; label: string }[] = [
  { type: "plant", label: "Plant" },
  { type: "beanbag", label: "Beanbag" },
  { type: "bookshelf", label: "Shelf" },
  { type: "coffee", label: "Coffee" },
  { type: "lamp", label: "Lamp" },
  { type: "whiteboard", label: "Board" },
  { type: "server", label: "Server" },
];

/** Suggested colours the legend's picker cycles through for new entries. */
const LEGEND_PRESETS = [
  "#f97316",
  "#38bdf8",
  "#a78bfa",
  "#34d399",
  "#facc15",
  "#fb7185",
  "#f472b6",
  "#94a3b8",
];

/** World yaw for a rot (quarter turns clockwise from +Z). */
const yawOf = (rot: Rot) => -rot * (Math.PI / 2);
/** Where the chair sits inside a desk tile, for a given rot. */
function chairOffset(rot: Rot): [number, number] {
  const yaw = yawOf(rot);
  return [0.18 * Math.sin(yaw), 0.18 * Math.cos(yaw)];
}
/** Facing of a seated agent: the chair is at the tile's front, the monitor at
    its back, so sitting means looking back toward the desk - yaw + π. */
const seatYaw = (rot: Rot) => yawOf(rot) + Math.PI;

/** World position + yaw of a wall edge. */
function edgeTransform(x: number, z: number, o: WallOrientation) {
  return o === "h"
    ? { pos: [x, 0, z - 0.5] as [number, number, number], yaw: 0 }
    : { pos: [x - 0.5, 0, z] as [number, number, number], yaw: Math.PI / 2 };
}

const sameEdge = (a: EdgeHover, b: { x: number; z: number; o: WallOrientation }) =>
  !!a && a.x === b.x && a.z === b.z && a.o === b.o;

/** How long an object stays hovered after the pointer leaves it. See the
    hover latch in OfficeBuilder for why there is a delay at all. */
const HOVER_RELEASE_MS = 140;

/** Stamps the arrival show's start on the first rendered frame and reports
    it up, so the builder can time the agents' pop-ins and the teardown off
    the moment the scene actually drew (mount can sit a shader-compile
    earlier). Mounted only while the intro is live. */
function IntroClock({
  plan,
  onStart,
}: {
  plan: IntroPlan;
  onStart: (start: number) => void;
}) {
  const fired = useRef(false);
  useFrame(() => {
    const start = stampIntro(plan);
    if (!fired.current) {
      fired.current = true;
      onStart(start);
    }
  });
  return null;
}

/** Damped position wrapper so a dragged ghost glides tile-to-tile instead of
    teleporting - it still lands exactly on the snapped tile, just smoothly. */
function SmoothSnap({
  x,
  z,
  children,
}: {
  x: number;
  z: number;
  children: React.ReactNode;
}) {
  const ref = useRef<THREE.Group>(null!);
  const first = useRef(true);
  useFrame((_, dt) => {
    const p = ref.current.position;
    if (first.current) {
      // Appear at the cursor, don't glide in from the world origin.
      p.set(x, 0, z);
      first.current = false;
      return;
    }
    const k = Math.min(1, dt * 10);
    p.x += (x - p.x) * k;
    p.z += (z - p.z) * k;
  });
  return <group ref={ref}>{children}</group>;
}

/** Damped rotation wrapper so rotating furniture swings, not snaps. */
function SmoothYaw({ yaw, children }: { yaw: number; children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null!);
  const first = useRef(true);
  useFrame((_, dt) => {
    if (first.current) {
      ref.current.rotation.y = yaw;
      first.current = false;
      return;
    }
    let d = yaw - ref.current.rotation.y;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    ref.current.rotation.y += d * Math.min(1, dt * 10);
  });
  return <group ref={ref}>{children}</group>;
}

export default function OfficeBuilder({
  initialLayout,
  workers,
  pops,
  onSave,
  saveState,
  readOnly = false,
  showcase = false,
  onStage,
  stagePanel,
}: {
  initialLayout: OfficeLayout;
  workers: OfficeWorker[];
  /** Live "something just happened" callouts from useOfficeLive - already
      expired by the hook, so this only ever holds what should be showing. */
  pops?: OfficePop[];
  onSave: (layout: OfficeLayout) => void;
  saveState: "idle" | "saving" | "saved";
  /** Viewers without the office.floor.write scope: watch, never edit. */
  readOnly?: boolean;
  /** Public landing-page demo: read-only AND dragging orbits the camera
   *  instead of panning. Implies readOnly. */
  showcase?: boolean;
  /** Called the moment an agent is sent to (or recalled from) the stage, so
      the host can start loading their console while the flight plays. */
  onStage?: (workerId: string | null) => void;
  /** The console itself, rendered once the staged agent has landed. The
      builder owns the timing and hands back the way to dismiss it; the host
      owns what is inside. Given nothing, the console chip doesn't appear. */
  stagePanel?: (close: () => void) => React.ReactNode;
}) {
  readOnly = readOnly || showcase;
  const [layout, setLayout] = useState<OfficeLayout>(initialLayout);
  const [mode, setMode] = useState<Mode>({ kind: "idle" });
  const [selected, setSelected] = useState<Selection>(null);
  const [hover, setHover] = useState<{ x: number; z: number } | null>(null);
  const [hoverEdge, setHoverEdge] = useState<EdgeHover>(null);
  const [hoverObj, setHoverObj] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);

  /* ── The dock ───────────────────────────────────────────────────────────
     ONE vertical rail on the left holds the entire HUD: three flyout tabs
     at the top (Team, Build for editors, Legend), then the camera actions
     (turn, zoom, fit, fullscreen, help) as plain always-there buttons, and
     a save dot at the foot. The tabs open ONE panel at a time in the slot
     beside the dock - two panels over the floor was two too many on a
     phone and one too many on a desktop. Which panel is open persists in
     localStorage; a phone always wakes up with none. */
  const [narrow, setNarrow] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 760px)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 760px)");
    const sync = () => setNarrow(mq.matches);
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  const narrowRef = useRef(narrow);
  narrowRef.current = narrow;

  const [openPanel, setOpenPanel] = useState<DockPanel | null>(() => {
    if (typeof window === "undefined") return "team";
    if (window.matchMedia("(max-width: 760px)").matches) return null;
    try {
      const v = localStorage.getItem(HUD_PANELS_KEY);
      if (v === "none") return null;
      if ((DOCK_PANELS as readonly string[]).includes(v ?? "")) {
        return v as DockPanel;
      }
    } catch {
      // A mangled value just means the default.
    }
    return "team";
  });
  useEffect(() => {
    try {
      localStorage.setItem(HUD_PANELS_KEY, openPanel ?? "none");
    } catch {
      // Private mode etc - the session still works, it just forgets.
    }
  }, [openPanel]);
  // A viewer can carry a saved "build" from an editing seat elsewhere.
  useEffect(() => {
    if (readOnly) setOpenPanel((p) => (p === "build" ? "team" : p));
  }, [readOnly]);

  const togglePanel = useCallback((k: DockPanel) => {
    setOpenPanel((p) => (p === k ? null : k));
  }, []);
  const closePanel = useCallback((k: DockPanel) => {
    setOpenPanel((p) => (p === k ? null : p));
  }, []);
  const [fullscreen, setFullscreen] = useState(false);
  // One agent at a time can be pulled off the floor and presented at the front
  // of the shot with their console open above them. `at` is the performance
  // clock second the flight started; `out` is the return trip; `open` gates the
  // DOM panel, which appears once the agent is most of the way there.
  const [stage, setStage] = useState<{
    workerId: string;
    at: number;
    out: boolean;
    open: boolean;
  } | null>(null);
  // ── The arrival ── on first load the whole office falls out of the sky:
  // floor wave, then walls, then furniture, then the agents pop in at their
  // desks (office3d/intro.ts). Skipped for the landing-page showcase (it
  // fades in mid-lap, there is no "first load" moment) and for anyone who
  // asked their OS for reduced motion. Cleared once the show is over, so a
  // settled office carries none of its per-frame work.
  const [intro, setIntro] = useState<IntroPlan | null>(() => {
    if (showcase) return null;
    if (
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ) {
      return null;
    }
    return buildIntroPlan(initialLayout);
  });
  const [introStart, setIntroStart] = useState(0);
  useEffect(() => {
    if (!intro || !introStart) return;
    const remaining = introStart + intro.total - performance.now() / 1000;
    const t = setTimeout(
      () => setIntro(null),
      Math.max(0, remaining * 1000) + 400,
    );
    return () => clearTimeout(t);
  }, [intro, introStart]);

  // Baked once on mount (editors only), then the baker unmounts.
  const [previews, setPreviews] = useState<Partial<
    Record<FurnitureType, string>
  > | null>(null);
  const [legendName, setLegendName] = useState("");
  const [legendColor, setLegendColor] = useState(
    () => LEGEND_PRESETS[initialLayout.legend.length % LEGEND_PRESETS.length],
  );

  // Facing of the placement ghost - right-click turns it a quarter step.
  // It persists across a run of placements (rows of desks share a facing)
  // and resets whenever a placement tool is (re)picked.
  const [placeRot, setPlaceRot] = useState<Rot>(0);
  const placeKey = mode.kind === "place-item" ? mode.type : null;
  useEffect(() => {
    if (placeKey) setPlaceRot(0);
  }, [placeKey]);

  const hoverRef = useRef(hover);
  hoverRef.current = hover;
  const placeRotRef = useRef(placeRot);
  placeRotRef.current = placeRot;
  const hoverEdgeRef = useRef(hoverEdge);
  hoverEdgeRef.current = hoverEdge;
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const readOnlyRef = useRef(readOnly);
  readOnlyRef.current = readOnly;
  const layoutRef = useRef(layout);
  layoutRef.current = layout;

  /* ── Hover latch ────────────────────────────────────────────────────────
     Object hover (an agent, a piece of furniture) is RELEASED on a short
     delay. Raycast hover is knife-edge: a pointer grazing the silhouette, a
     limb swinging out from under a still cursor, or anything drawn over the
     canvas passing beneath it fires out/over pairs milliseconds apart. Since
     hovering an agent stops them and turns them to face you, that strobe read
     as a spasm. With the latch an agent is either attending to you or living
     their life, never flickering between the two.
     Re-entering the same object inside the window costs nothing: the timer is
     cancelled and the state never changed, so React doesn't even re-render. */
  const hoverOffTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearHoverTimer = () => {
    if (hoverOffTimer.current) {
      clearTimeout(hoverOffTimer.current);
      hoverOffTimer.current = null;
    }
  };
  const hoverOn = useCallback((id: string) => {
    clearHoverTimer();
    setHoverObj((cur) => (cur === id ? cur : id));
  }, []);
  const hoverOff = useCallback((id: string) => {
    clearHoverTimer();
    hoverOffTimer.current = setTimeout(() => {
      hoverOffTimer.current = null;
      // Only drop it if nothing else has claimed the hover meanwhile.
      setHoverObj((cur) => (cur === id ? null : cur));
    }, HOVER_RELEASE_MS);
  }, []);
  useEffect(() => clearHoverTimer, []);

  const selectedAt = useRef(0);
  const bornTimes = useRef(new Map<string, number>());
  const interactionLock = useRef(false);
  // A press on an object arms a drag rather than starting one. If the pointer
  // travels past a few pixels it becomes a real move; a release before then is
  // a plain click, which just selects the object (and shows its action chips).
  const pendingDrag = useRef<{
    sel: NonNullable<Selection>;
    x: number;
    y: number;
  } | null>(null);
  const cameraControl = useRef<CameraControl | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const workerById = useMemo(
    () => new Map(workers.map((w) => [w.id, w])),
    [workers],
  );
  // Newest pop per agent (the array arrives oldest-first, so later entries
  // win the map slot).
  const popByWorker = useMemo(() => {
    const m = new Map<string, OfficePop>();
    for (const p of pops ?? []) m.set(p.workerId, p);
    return m;
  }, [pops]);
  const itemById = useMemo(
    () => new Map(layout.items.map((i) => [i.id, i])),
    [layout.items],
  );
  // Agents whose worker or desk no longer exists are dropped from view.
  const agents = useMemo(
    () =>
      layout.agents.filter(
        (a) => workerById.has(a.workerId) && itemById.has(a.deskId),
      ),
    [layout.agents, workerById, itemById],
  );
  const offFloor = useMemo(
    () => workers.filter((w) => !layout.agents.some((a) => a.workerId === w.id)),
    [workers, layout.agents],
  );
  // The other half of the Team rail: everyone stationed at a desk, in
  // placement order.
  const onFloor = useMemo(
    () =>
      layout.agents
        .map((a) => workerById.get(a.workerId))
        .filter((w): w is OfficeWorker => !!w),
    [layout.agents, workerById],
  );
  const tileCells = useMemo(
    () => new Set(layout.tiles.map(([x, z]) => keyOf(x, z))),
    [layout.tiles],
  );
  // Showcase framing: the floor's extents, so the whole office stays in
  // shot while the camera laps it (there are no zoom controls there).
  const floorSpan = useMemo<[number, number] | undefined>(() => {
    if (!showcase || layout.tiles.length === 0) return undefined;
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const [x, z] of layout.tiles) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (z < minZ) minZ = z;
      if (z > maxZ) maxZ = z;
    }
    return [maxX - minX + 1, maxZ - minZ + 1];
  }, [showcase, layout.tiles]);
  const legendById = useMemo(
    () => new Map(layout.legend.map((e) => [e.id, e])),
    [layout.legend],
  );
  // Tile key → hex colour, resolved through the legend, for the floor mesh.
  const tintColors = useMemo(() => {
    const m = new Map<string, string>();
    for (const [k, id] of Object.entries(layout.tints)) {
      const e = legendById.get(id);
      if (e) m.set(k, e.color);
    }
    return m;
  }, [layout.tints, legendById]);

  /* ── Auto-save (debounced) ── */
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const t = setTimeout(() => onSave(layoutRef.current), 800);
    return () => clearTimeout(t);
  }, [layout, onSave]);

  /* ── Fullscreen ── */
  useEffect(() => {
    const onChange = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void rootRef.current?.requestFullscreen();
    }
  }, []);

  /* ── Derived: what would happen at the hovered tile/edge? ── */
  const ghost = useMemo(() => {
    const m = mode;
    if (m.kind === "wall") {
      if (!hoverEdge) return null;
      // An occupied edge gets no ghost - strokes simply skip over it.
      if (findWall(layout, hoverEdge.x, hoverEdge.z, hoverEdge.o)) return null;
      return {
        kind: "wall" as const,
        edge: hoverEdge,
        valid: canPlaceWall(layout, hoverEdge.x, hoverEdge.z, hoverEdge.o),
      };
    }
    if (m.kind === "door") {
      if (!hoverEdge) return null;
      const wall = findWall(layout, hoverEdge.x, hoverEdge.z, hoverEdge.o);
      if (!wall) return null;
      return { kind: "door" as const, edge: hoverEdge, wall };
    }
    if (m.kind === "erase" && hoverEdge) {
      const wall = findWall(layout, hoverEdge.x, hoverEdge.z, hoverEdge.o);
      if (wall) return { kind: "wall-erase" as const, edge: hoverEdge, wall };
    }
    if (!hover) return null;
    if (m.kind === "paint") {
      return { kind: "tile" as const, valid: canPaint(layout, hover.x, hover.z) };
    }
    if (m.kind === "erase") {
      return { kind: "tile" as const, valid: canErase(layout, hover.x, hover.z) };
    }
    if (m.kind === "tint") {
      const entry = legendById.get(m.legendId);
      if (!entry) return null;
      const erase = layout.tints[keyOf(hover.x, hover.z)] === m.legendId;
      return {
        kind: "tint" as const,
        erase,
        color: entry.color,
        valid: hasTile(layout, hover.x, hover.z),
      };
    }
    if (m.kind === "place-item") {
      return {
        kind: "item" as const,
        type: m.type,
        rot: placeRot,
        valid: canPlaceItem(layout, hover.x, hover.z),
      };
    }
    if (m.kind === "move-item") {
      const it = itemById.get(m.id);
      if (!it) return null;
      // A desk carries its agent - preview them riding along to the new tile.
      const seat = layout.agents.find((a) => a.deskId === m.id);
      return {
        kind: "item" as const,
        type: it.type,
        rot: it.rot,
        valid: canPlaceItem(layout, hover.x, hover.z, m.id),
        seatWorkerId: seat?.workerId,
      };
    }
    if (m.kind === "place-agent") {
      // Agents arrive with their own desk, dropped on any empty tile.
      return {
        kind: "agent" as const,
        workerId: m.workerId,
        deskRot: placeRot,
        valid:
          canPlaceItem(layout, hover.x, hover.z) &&
          layout.items.length < MAX_ITEMS,
      };
    }
    return null;
  }, [hover, hoverEdge, mode, layout, itemById, legendById, placeRot]);

  /* ── Mutations ── */
  const stamp = (id: string) => bornTimes.current.set(id, now());

  const commitPlaceItem = useCallback(
    (type: FurnitureType, x: number, z: number, rot: Rot = 0) => {
      setLayout((l) => {
        if (l.items.length >= MAX_ITEMS || !canPlaceItem(l, x, z)) return l;
        const item: Item = { id: newId(), type, x, z, rot };
        stamp(item.id);
        // Zones lose any tile the new furniture landed on.
        return normalizeZones({ ...l, items: [...l.items, item] });
      });
    },
    [],
  );

  const commitMoveItem = useCallback((id: string, x: number, z: number) => {
    setLayout((l) => {
      if (!canPlaceItem(l, x, z, id)) return l;
      stamp(id);
      const items = l.items.map((i) => (i.id === id ? { ...i, x, z } : i));
      // A moved desk takes its agent along; their zone re-roots at the new tile.
      const agents = l.agents.map((a) =>
        a.deskId === id ? { ...a, zone: [[x, z]] as Tile[] } : a,
      );
      return normalizeZones({ ...l, items, agents });
    });
  }, []);

  /** Drop a fresh desk on (x,z) and station the agent at it - the two are a
      unit now, so an agent always arrives with (and leaves with) their desk. */
  const commitPlaceAgentDesk = useCallback(
    (workerId: string, x: number, z: number, rot: Rot = 0) => {
      setLayout((l) => {
        if (l.items.length >= MAX_ITEMS || !canPlaceItem(l, x, z)) return l;
        const desk: Item = { id: newId(), type: "desk", x, z, rot };
        stamp(desk.id);
        stamp(`agent-${workerId}`);
        // Re-placing someone already on the floor: retire their old desk first.
        const prev = l.agents.find((a) => a.workerId === workerId);
        const items = [...l.items.filter((i) => i.id !== prev?.deskId), desk];
        const agents = [
          ...l.agents.filter((a) => a.workerId !== workerId),
          { workerId, deskId: desk.id, zone: [[x, z]] as Tile[] },
        ];
        return normalizeZones({ ...l, items, agents });
      });
    },
    [],
  );

  const rotateItem = useCallback((id: string) => {
    setLayout((l) => ({
      ...l,
      items: l.items.map((i) =>
        i.id === id ? { ...i, rot: (((i.rot + 1) % 4) as Rot) } : i,
      ),
    }));
  }, []);

  const removeItem = useCallback((id: string) => {
    setLayout((l) => ({
      ...l,
      items: l.items.filter((i) => i.id !== id),
      // An agent can't exist without their desk - they leave the floor.
      agents: l.agents.filter((a) => a.deskId !== id),
    }));
    setSelected(null);
  }, []);

  const removeAgent = useCallback((workerId: string) => {
    setLayout((l) => {
      // Desk and agent are a unit - removing the agent takes their desk too.
      const agent = l.agents.find((a) => a.workerId === workerId);
      return {
        ...l,
        items: agent ? l.items.filter((i) => i.id !== agent.deskId) : l.items,
        agents: l.agents.filter((a) => a.workerId !== workerId),
      };
    });
    setSelected(null);
  }, []);

  const addLegend = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const name = legendName.trim();
      if (!name) return;
      const id = newId();
      setLayout((l) => addLegendEntry(l, { id, name, color: legendColor }));
      setLegendName("");
      setLegendColor(
        LEGEND_PRESETS[(layoutRef.current.legend.length + 1) % LEGEND_PRESETS.length],
      );
      // Straight into painting the new colour.
      setMode({ kind: "tint", legendId: id });
    },
    [legendName, legendColor],
  );

  const removeLegend = useCallback((id: string) => {
    setLayout((l) => removeLegendEntry(l, id));
    setMode((m) => (m.kind === "tint" && m.legendId === id ? { kind: "idle" } : m));
  }, []);

  /* ── Department highlight ─────────────────────────────────────────────
     Clicking a legend chip lights up every room painted with it: a ripple
     sweeps out from the patch's centre while the rest of the floor dims
     (Floor's `flash` prop). One show at a time; a chip with nothing painted
     yet shakes instead, because a highlight of nothing looks like a bug. */
  const [flash, setFlash] = useState<FloorFlash & { legendId: string } | null>(null);
  const [emptyChip, setEmptyChip] = useState<string | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const emptyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (flashTimer.current) clearTimeout(flashTimer.current);
      if (emptyTimer.current) clearTimeout(emptyTimer.current);
    },
    [],
  );

  const flashLegend = useCallback((legendId: string) => {
    const l = layoutRef.current;
    const keys = new Set<string>();
    let sx = 0;
    let sz = 0;
    for (const [k, v] of Object.entries(l.tints)) {
      if (v !== legendId) continue;
      keys.add(k);
      const [x, z] = k.split(",").map(Number);
      sx += x;
      sz += z;
    }
    if (keys.size === 0) {
      // Nothing painted with this colour: a short apologetic shake on the
      // chip says "there is nothing to show" without a modal in the way.
      setEmptyChip(legendId);
      if (emptyTimer.current) clearTimeout(emptyTimer.current);
      emptyTimer.current = setTimeout(() => setEmptyChip(null), 500);
      return;
    }
    const cx = sx / keys.size;
    const cz = sz / keys.size;
    // The show is over once the ripple has reached the farthest tile and
    // that tile's own pulse has finished.
    let maxD = 0;
    for (const k of keys) {
      const [x, z] = k.split(",").map(Number);
      const d = Math.hypot(x - cx, z - cz);
      if (d > maxD) maxD = d;
    }
    const duration = maxD * 0.055 + 0.8 + 0.25;
    setFlash({
      legendId,
      keys,
      cx,
      cz,
      start: performance.now() / 1000,
      duration,
    });
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(
      () => setFlash(null),
      duration * 1000 + 150,
    );
  }, []);

  /* ── Rename / recolour a department ── */
  const [renaming, setRenaming] = useState<{ id: string; draft: string } | null>(
    null,
  );
  const commitRename = useCallback(() => {
    setRenaming((r) => {
      if (r && r.draft.trim()) {
        setLayout((l) => updateLegendEntry(l, r.id, { name: r.draft }));
      }
      return null;
    });
  }, []);
  const recolorLegend = useCallback((id: string, color: string) => {
    setLayout((l) => updateLegendEntry(l, id, { color }));
  }, []);

  /* ── The edge of the world ── a paint stroke that hits the office's span
     limit lights up the barrier: a glowing field around everywhere a tile
     may still go, erupting from the exact spot that was refused. One show
     at a time; every further blocked attempt while it is up extends the
     hold instead of restarting the sweep (a drag along the edge would
     strobe otherwise). */
  const [barrier, setBarrier] = useState<{
    rect: PaintBounds;
    spawn: [number, number];
    at: number;
    poke: number;
  } | null>(null);
  const pokeBarrier = useCallback((x: number, z: number) => {
    const t = now();
    setBarrier((b) =>
      b && t - b.poke < BARRIER_TOTAL
        ? { ...b, poke: t }
        : { rect: paintBounds(layoutRef.current), spawn: [x, z], at: t, poke: t },
    );
  }, []);
  useEffect(() => {
    if (!barrier) return;
    const t = setTimeout(
      () => setBarrier(null),
      (barrier.poke - now() + BARRIER_TOTAL) * 1000 + 100,
    );
    return () => clearTimeout(t);
  }, [barrier]);

  /* ── Brushes: click or drag paints tiles/walls/tints, erases both ── */
  const painting = useRef(false);
  /** Whether the current tint stroke clears colour (started on own colour). */
  const tintErasing = useRef(false);

  const applyBrush = useCallback((wx: number, wz: number) => {
    const m = modeRef.current;
    if (m.kind === "paint") {
      const x = Math.round(wx);
      const z = Math.round(wz);
      // Refused because the office is at full span here? Show the edge.
      if (!inPaintBounds(paintBounds(layoutRef.current), x, z)) {
        pokeBarrier(x, z);
        return;
      }
      setLayout((l) => paintTile(l, x, z));
    } else if (m.kind === "wall") {
      const e = nearestEdge(wx, wz);
      if (canPlaceWall(layoutRef.current, e.x, e.z, e.o)) {
        stamp(`wall-${wallKey(e.x, e.z, e.o)}`);
      }
      setLayout((l) => addWall(l, e.x, e.z, e.o));
    } else if (m.kind === "erase") {
      const e = nearestEdge(wx, wz);
      if (e.dist < ERASE_EDGE_REACH && findWall(layoutRef.current, e.x, e.z, e.o)) {
        setLayout((l) => removeWall(l, e.x, e.z, e.o));
      } else {
        setLayout((l) => eraseTile(l, Math.round(wx), Math.round(wz)));
      }
    } else if (m.kind === "tint") {
      const x = Math.round(wx);
      const z = Math.round(wz);
      if (tintErasing.current) {
        // An erase stroke only lifts this colour - other sections keep theirs.
        setLayout((l) =>
          l.tints[keyOf(x, z)] === m.legendId ? untintTile(l, x, z) : l,
        );
      } else {
        setLayout((l) => tintTile(l, x, z, m.legendId));
      }
    }
  }, [pokeBarrier]);

  /* ── Pointer plumbing ── */
  const startObjectDrag = useCallback((sel: NonNullable<Selection>) => {
    if (readOnlyRef.current) return;
    // Dragging an agent drags their desk - the workstation moves as one piece.
    const deskId =
      sel.kind === "item"
        ? sel.id
        : layoutRef.current.agents.find((a) => a.workerId === sel.workerId)
            ?.deskId;
    if (!deskId) return;
    interactionLock.current = true;
    setMode({ kind: "move-item", id: deskId, drag: true });
  }, []);

  const cancel = useCallback(() => {
    setMode({ kind: "idle" });
    setHoverEdge(null);
    interactionLock.current = false;
  }, []);

  // Drop handler for drags, and end of brush strokes (mouse released anywhere).
  useEffect(() => {
    const up = () => {
      // Released without ever crossing the drag threshold: it was a click, not
      // a drag. The object is already selected - disarm and let its chips show
      // (mode never left "idle", so `placing` stayed false).
      if (pendingDrag.current) {
        pendingDrag.current = null;
        interactionLock.current = false;
        return;
      }
      const m = modeRef.current;
      const h = hoverRef.current;
      if (m.kind === "move-item" && m.drag) {
        if (h) commitMoveItem(m.id, h.x, h.z);
        cancel();
      } else if (painting.current) {
        // Stroke over: unlock the camera but stay in the current tool.
        painting.current = false;
        interactionLock.current = false;
      }
    };
    // Chorded rotate: while an item is drag-held (left button down), pressing
    // the right button does NOT fire pointerdown - the browser reports extra
    // buttons on an already-down pointer as a pointermove with `button` set.
    const chord = (e: PointerEvent) => {
      if (e.button !== 2 || (e.buttons & 2) === 0) return; // right PRESS only
      const m = modeRef.current;
      if (m.kind === "move-item" && m.drag) rotateItem(m.id);
    };
    // Releasing that right button mid-drag would otherwise pop the browser
    // context menu (possibly outside the canvas, which has its own guard).
    const ctx = (e: Event) => {
      const m = modeRef.current;
      if (m.kind === "move-item" && m.drag) {
        e.preventDefault();
      }
    };
    // An armed press upgrades to a real drag only once the pointer travels far
    // enough - the same 6px margin the ground plane uses to tell a click from a
    // camera pan. Below it, the press stays a click.
    const promote = (e: PointerEvent) => {
      const pd = pendingDrag.current;
      if (!pd) return;
      if (Math.hypot(e.clientX - pd.x, e.clientY - pd.y) <= 6) return;
      pendingDrag.current = null;
      startObjectDrag(pd.sel);
    };
    window.addEventListener("pointerup", up);
    window.addEventListener("pointermove", chord);
    window.addEventListener("pointermove", promote);
    window.addEventListener("contextmenu", ctx);
    return () => {
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointermove", chord);
      window.removeEventListener("pointermove", promote);
      window.removeEventListener("contextmenu", ctx);
    };
  }, [commitMoveItem, cancel, rotateItem, startObjectDrag]);

  /* ── The stage ────────────────────────────────────────────────────────
     Sending an agent to the front of the shot is two moves that have to stay
     in step: the 3D flight (AgentModel reads `stage`) and the DOM console
     (`stagePanel`). Both hang off one timestamp, so the panel can land a beat
     after the agent does and leave the instant they turn for home. */
  const onStageRef = useRef(onStage);
  onStageRef.current = onStage;

  const openStage = useCallback((workerId: string) => {
    onStageRef.current?.(workerId);
    setStage({ workerId, at: now(), out: false, open: false });
  }, []);

  // `open` stays true through the return trip: the panel shrinks back into the
  // card as the agent flies home, and unmounting it early would cut that off.
  const closeStage = useCallback(() => {
    setStage((s) => (s && !s.out ? { ...s, at: now(), out: true } : s));
  }, []);

  // Leg one: the panel zooms in from above the agent's head, just before they
  // settle, so the two movements read as one.
  useEffect(() => {
    if (!stage || stage.out || stage.open) return;
    const t = setTimeout(
      () => setStage((s) => (s && !s.out ? { ...s, open: true } : s)),
      STAGE.flight * 1000 * 0.62,
    );
    return () => clearTimeout(t);
  }, [stage]);
  // Leg two: once they're home, the stage is over.
  useEffect(() => {
    if (!stage?.out) return;
    const t = setTimeout(() => {
      setStage(null);
      onStageRef.current?.(null);
    }, STAGE.flight * 1000);
    return () => clearTimeout(t);
  }, [stage]);
  // Whoever is on stage has to still be on the floor - the console can delete
  // them, and a panel about nobody would just sit there.
  useEffect(() => {
    if (!stage || agents.some((a) => a.workerId === stage.workerId)) return;
    setStage(null);
    onStageRef.current?.(null);
  }, [agents, stage]);

  // Keyboard shortcuts. While an agent is on stage the console owns the
  // keyboard - Escape sends them home and nothing else reaches the floor
  // (Delete especially: the selected agent is the one being inspected).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (stage) {
        // Escape works from inside the console's own fields too.
        if (e.key === "Escape" && !stage.out) closeStage();
        return;
      }
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === "Escape") {
        cancel();
        setSelected(null);
        setHelpOpen(false);
      }
      if ((e.key === "r" || e.key === "R") && selected?.kind === "item") {
        rotateItem(selected.id);
      }
      if ((e.key === "Delete" || e.key === "Backspace") && selected) {
        if (selected.kind === "item") removeItem(selected.id);
        else removeAgent(selected.workerId);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, cancel, rotateItem, removeItem, removeAgent, stage, closeStage]);

  const groundMove = useCallback(
    (x: number, z: number) => {
      const rx = Math.round(x);
      const rz = Math.round(z);
      const m = modeRef.current;

      const h = hoverRef.current;
      const cellChanged = !h || h.x !== rx || h.z !== rz;
      if (cellChanged) setHover({ x: rx, z: rz });

      // Which edge does the pointer mean, for the wall tools?
      let edge: EdgeHover = null;
      if (m.kind === "wall") {
        const e = nearestEdge(x, z);
        edge = { x: e.x, z: e.z, o: e.o };
      } else if (m.kind === "door") {
        const e = nearestEdge(x, z);
        if (findWall(layoutRef.current, e.x, e.z, e.o)) {
          edge = { x: e.x, z: e.z, o: e.o };
        }
      } else if (m.kind === "erase") {
        const e = nearestEdge(x, z);
        if (
          e.dist < ERASE_EDGE_REACH &&
          findWall(layoutRef.current, e.x, e.z, e.o)
        ) {
          edge = { x: e.x, z: e.z, o: e.o };
        }
      }
      const pe = hoverEdgeRef.current;
      const edgeChanged = edge
        ? !sameEdge(pe, edge)
        : pe !== null;
      if (edgeChanged) setHoverEdge(edge);

      // Mid-stroke: brush every new cell or edge the pointer crosses.
      if (painting.current && (cellChanged || edgeChanged)) applyBrush(x, z);
    },
    [applyBrush],
  );

  const groundDown = useCallback(
    (x: number, z: number) => {
      const m = modeRef.current;
      if (
        m.kind !== "paint" &&
        m.kind !== "erase" &&
        m.kind !== "wall" &&
        m.kind !== "tint"
      ) {
        return;
      }
      if (m.kind === "tint") {
        // Same idea: starting on a tile already in this colour erases it.
        tintErasing.current =
          layoutRef.current.tints[keyOf(Math.round(x), Math.round(z))] ===
          m.legendId;
      }
      painting.current = true;
      interactionLock.current = true; // a stroke must not pan the camera
      applyBrush(x, z);
    },
    [applyBrush],
  );

  const groundClick = useCallback(
    (x: number, z: number, delta: number) => {
      if (delta > 6) return; // it was a camera pan, not a click
      const rx = Math.round(x);
      const rz = Math.round(z);
      const m = modeRef.current;
      if (
        m.kind === "paint" ||
        m.kind === "erase" ||
        m.kind === "wall" ||
        m.kind === "tint"
      ) {
        return; // already handled on pointerdown/stroke
      }
      if (m.kind === "door") {
        const e = nearestEdge(x, z);
        setLayout((l) => toggleDoor(l, e.x, e.z, e.o));
        return;
      }
      if (m.kind === "place-item") {
        commitPlaceItem(m.type, rx, rz, placeRotRef.current);
        // stay in placement mode: laying several desks in a row feels great
      } else if (m.kind === "place-agent") {
        if (
          canPlaceItem(layoutRef.current, rx, rz) &&
          layoutRef.current.items.length < MAX_ITEMS
        ) {
          commitPlaceAgentDesk(m.workerId, rx, rz, placeRotRef.current);
          // Desk + agent placed. Their roam area is the room they landed
          // in (derived, not painted) - select them so it lights up.
          setMode({ kind: "idle" });
          selectedAt.current = now();
          setSelected({ kind: "agent", workerId: m.workerId });
        }
      } else if (m.kind === "move-item" && !m.drag) {
        commitMoveItem(m.id, rx, rz);
        setMode({ kind: "idle" });
      } else {
        setSelected(null);
      }
    },
    [commitPlaceItem, commitPlaceAgentDesk, commitMoveItem],
  );

  /** Right-click while placing/moving furniture turns the piece a quarter step. */
  const rotateGhost = useCallback(() => {
    const m = modeRef.current;
    if (m.kind === "place-item" || m.kind === "place-agent") {
      setPlaceRot((r) => ((r + 1) % 4) as Rot);
    } else if (m.kind === "move-item") {
      rotateItem(m.id);
    }
  }, [rotateItem]);

  /** While a place/move tool is live, the right button is the rotate button -
      it must not start a camera pan. */
  const panBlocked = useCallback((e: PointerEvent) => {
    const k = modeRef.current.kind;
    return (
      e.button === 2 &&
      (k === "place-item" || k === "move-item" || k === "place-agent")
    );
  }, []);

  const selectObject = useCallback((sel: NonNullable<Selection>) => {
    if (readOnlyRef.current) return;
    selectedAt.current = now();
    setSelected(sel);
  }, []);

  /* A Team-rail row for someone ON the floor: glide the camera to their
     desk, then open their console if this surface has one (or just select
     them for editing). On a phone the rail steps aside so the show it just
     started is actually visible. */
  const stagePanelRef = useRef(stagePanel);
  stagePanelRef.current = stagePanel;
  const focusWorker = useCallback(
    (workerId: string) => {
      const l = layoutRef.current;
      const a = l.agents.find((x) => x.workerId === workerId);
      const desk = a ? l.items.find((i) => i.id === a.deskId) : null;
      if (desk) cameraControl.current?.focusOn(desk.x, desk.z);
      if (stagePanelRef.current) openStage(workerId);
      else selectObject({ kind: "agent", workerId });
      if (narrowRef.current) closePanel("team");
    },
    [openStage, selectObject, closePanel],
  );

  /* ── Render helpers ── */
  const beingMoved = (id: string) =>
    mode.kind === "move-item" && mode.id === id;

  const [cx, cz] = useMemo(() => centroid(layout), [layout.tiles]);
  const placing = mode.kind !== "idle";

  const selectedItem =
    selected?.kind === "item" ? itemById.get(selected.id) : undefined;
  const selectedAgent =
    selected?.kind === "agent"
      ? agents.find((a) => a.workerId === selected.workerId)
      : undefined;
  const selectedAgentDesk = selectedAgent
    ? itemById.get(selectedAgent.deskId)
    : undefined;
  /** The desk the staged agent lifted off from - where the burst plays. */
  const stageDesk = stage
    ? itemById.get(
        agents.find((a) => a.workerId === stage.workerId)?.deskId ?? "",
      )
    : undefined;

  const cursorStyle =
    mode.kind === "move-item"
      ? "grabbing"
      : mode.kind === "paint" ||
          mode.kind === "erase" ||
          mode.kind === "wall" ||
          mode.kind === "tint"
        ? "crosshair"
        : mode.kind === "door"
          ? "pointer"
          : placing
            ? "copy"
            : "default";

  const toggleTool = (m: Mode) =>
    setMode(mode.kind === m.kind ? { kind: "idle" } : m);

  const modeWorkerName =
    mode.kind === "place-agent"
      ? (workerById.get(mode.workerId)?.name ?? "the agent")
      : "";

  return (
    <div
      className={"px-office" + (stage && !stage.out ? " is-staged" : "")}
      style={{ cursor: cursorStyle }}
      ref={rootRef}
    >
      <Canvas
        orthographic
        // Hard-edged shadow maps: soft penumbras read as blur once the frame
        // is quantised into art pixels, hard edges read as drawn shading.
        shadows="basic"
        // One art pixel spans multiple canvas pixels (zoom-adaptive - see
        // pixel-art.tsx), so extra DPR and MSAA would only be thrown away
        // by the downsampled pixel pass. `alpha` keeps the drawing buffer
        // transparent where no sky is mounted (the landing-page showcase).
        dpr={1}
        // high-performance asks a switchable-graphics laptop for the discrete
        // GPU: a furnished office is hundreds of draw calls a frame, and the
        // integrated chip both crawls and risks a context loss under it.
        gl={{
          antialias: false,
          alpha: true,
          powerPreference: "high-performance",
        }}
        camera={{ zoom: 60, position: [20, 20, 20], near: -100, far: 400 }}
        style={{ touchAction: "none" }}
      >
        {/* The showcase keeps the canvas transparent - the landing page's own
            background shows through, so it blends in exactly. */}
        {!showcase && <SkyBackdrop />}
        <PixelArtRenderer />
        <CameraRig
          focus={[cx, cz]}
          control={cameraControl}
          interactionLock={interactionLock}
          panBlocked={panBlocked}
          spin={showcase}
          fitSpan={floorSpan}
          // The showcase pins every status card open, so the floor is not the
          // top of the picture - the cards above the agents' heads are. Frame
          // for them, or the back row's cards ride the top edge all lap.
          headroom={showcase ? SHOWCASE_HEADROOM : 0}
        />
        <Lights />
        {intro && <IntroClock plan={intro} onStart={setIntroStart} />}
        <Floor tiles={layout.tiles} tints={tintColors} intro={intro} flash={flash} />

        {/* Showcase only: catch the diorama's shadow on the (transparent)
            page background, so the office sits on the page instead of
            floating in front of it. */}
        {showcase && <GroundShadow center={[cx, cz]} />}

        {/* Ground plane: hover + click + brush target. `visible={false}`
            (rather than opacity 0) so the pixel pass's normal/depth override
            render skips it too - it sits exactly at tile-top height and would
            otherwise z-fight edge noise onto every floor tile. Raycasting
            ignores visibility, so pointer events still land. */}
        <mesh
          visible={false}
          position={[cx, 0, cz]}
          rotation={[-Math.PI / 2, 0, 0]}
          onPointerDown={(e) => {
            if (e.button === 2) {
              rotateGhost();
              return;
            }
            groundDown(e.point.x, e.point.z);
          }}
          onPointerMove={(e) => groundMove(e.point.x, e.point.z)}
          onPointerOut={() => {
            setHover(null);
            setHoverEdge(null);
          }}
          onClick={(e) => groundClick(e.point.x, e.point.z, e.delta)}
        >
          <planeGeometry args={[120, 120]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>

        {/* The selected agent's room, as a faint tint - where they roam. */}
        {selectedAgent && (
          <ZoneOverlay tiles={selectedAgent.zone} editing={false} />
        )}

        {/* Tile cursor + ghosts while painting/placing/moving */}
        {ghost && (
          <>
            {ghost.kind === "tile" && hover && (
              mode.kind === "paint" ? (
                <PaintGhost x={hover.x} z={hover.z} valid={ghost.valid} />
              ) : (
                <TileCursor x={hover.x} z={hover.z} valid={ghost.valid} />
              )
            )}
            {ghost.kind === "tint" && hover && (
              <TileCursor
                x={hover.x}
                z={hover.z}
                valid={ghost.valid}
                color={ghost.erase ? UI3D.ember : ghost.color}
              />
            )}
            {ghost.kind === "wall" && (() => {
              const t = edgeTransform(ghost.edge.x, ghost.edge.z, ghost.edge.o);
              return (
                <group position={t.pos} rotation={[0, t.yaw, 0]}>
                  <WallModel ghost={ghost.valid ? UI3D.valid : UI3D.invalid} />
                </group>
              );
            })()}
            {(ghost.kind === "door" || ghost.kind === "wall-erase") && (() => {
              const t = edgeTransform(ghost.edge.x, ghost.edge.z, ghost.edge.o);
              return (
                <group position={t.pos} rotation={[0, t.yaw, 0]}>
                  <EdgeHighlight
                    color={ghost.kind === "door" ? UI3D.accent : UI3D.invalid}
                  />
                </group>
              );
            })()}
            {ghost.kind === "item" && hover && (
              <SmoothSnap x={hover.x} z={hover.z}>
                <SmoothYaw yaw={yawOf(ghost.rot)}>
                  <FurnitureModel
                    type={ghost.type}
                    ghost={ghost.valid ? UI3D.valid : UI3D.invalid}
                  />
                </SmoothYaw>
                {/* A desk's agent moves with it - ride along on the ghost.
                    Drawn solid (not as a ghost): the furniture ghost already
                    shows placement validity, and transparent-on-transparent
                    sorting would drop the body and look like it vanished. */}
                {ghost.type === "desk" &&
                  ghost.seatWorkerId &&
                  (() => {
                    const off = chairOffset(ghost.rot);
                    return (
                      <group position={[off[0], 0, off[1]]}>
                        <AgentModel
                          sprite={
                            workerById.get(ghost.seatWorkerId)?.sprite ?? "pip"
                          }
                          workerId={ghost.seatWorkerId}
                          status="idle"
                          pose="sit"
                          yaw={seatYaw(ghost.rot)}
                        />
                      </group>
                    );
                  })()}
              </SmoothSnap>
            )}
            {ghost.kind === "agent" && hover && (
              <SmoothSnap x={hover.x} z={hover.z}>
                <SmoothYaw yaw={yawOf(ghost.deskRot)}>
                  <FurnitureModel
                    type="desk"
                    ghost={ghost.valid ? UI3D.valid : UI3D.invalid}
                  />
                </SmoothYaw>
                <group
                  position={[
                    chairOffset(ghost.deskRot)[0],
                    0,
                    chairOffset(ghost.deskRot)[1],
                  ]}
                >
                  <AgentModel
                    sprite={workerById.get(ghost.workerId)?.sprite ?? "pip"}
                    workerId={ghost.workerId}
                    status="idle"
                    pose="sit"
                    yaw={seatYaw(ghost.deskRot)}
                    ghost={ghost.valid ? UI3D.valid : UI3D.invalid}
                  />
                </group>
              </SmoothSnap>
            )}
          </>
        )}

        {/* The span limit, drawn: a force field around everywhere a tile may
            still go, erupting from the refused spot (see pokeBarrier). */}
        {barrier && (
          <BoundsBarrier
            rect={barrier.rect}
            spawn={barrier.spawn}
            at={barrier.at}
            poke={barrier.poke}
          />
        )}

        {/* Selection ring */}
        {selectedItem && <SelectRing x={selectedItem.x} z={selectedItem.z} />}
        {selectedAgentDesk && (
          <SelectRing x={selectedAgentDesk.x} z={selectedAgentDesk.z} />
        )}

        {/* Walls - with direct handlers so the door/erase tools hit the
            segment the pointer is actually on (an iso raycast through a
            tall wall lands on the floor a tile behind it otherwise), and
            a fade wrapper so no wall ever hides what's behind it. */}
        {layout.walls.map((w: Wall) => {
          const t = edgeTransform(w.x, w.z, w.o);
          const key = wallKey(w.x, w.z, w.o);
          const edge = { x: w.x, z: w.z, o: w.o };
          return (
            <ItemWrap
              key={key}
              position={t.pos}
              rotation={[0, t.yaw, 0]}
              bornAt={bornTimes.current.get(`wall-${key}`) ?? 0}
              // Walls barely tilt on the way down - a big wobble cracks a
              // run open mid-air, and they read as one wall.
              drop={
                intro
                  ? { plan: intro, delay: intro.walls.get(key) ?? 0, wobble: 0.09 }
                  : null
              }
            >
              <group
                onPointerDown={(e) => {
                  if (modeRef.current.kind !== "erase") return;
                  e.stopPropagation();
                  interactionLock.current = true;
                  painting.current = true;
                  setLayout((l) => removeWall(l, w.x, w.z, w.o));
                }}
                onPointerMove={(e) => {
                  const m = modeRef.current;
                  if (m.kind !== "door" && m.kind !== "erase") return;
                  e.stopPropagation();
                  if (!sameEdge(hoverEdgeRef.current, edge)) setHoverEdge(edge);
                }}
                onPointerOut={() => {
                  if (sameEdge(hoverEdgeRef.current, edge)) setHoverEdge(null);
                }}
                onClick={(e) => {
                  const m = modeRef.current;
                  if (m.kind === "door") {
                    e.stopPropagation();
                    setLayout((l) => toggleDoor(l, w.x, w.z, w.o));
                  } else if (m.kind === "erase") {
                    e.stopPropagation();
                  }
                }}
              >
                <WallFade wall={w} tiles={tileCells}>
                  <WallModel door={w.door} />
                </WallFade>
              </group>
            </ItemWrap>
          );
        })}

        {/* Furniture */}
        {layout.items.map((item) => {
          if (beingMoved(item.id)) return null;
          const seated = agents.find((a) => a.deskId === item.id);
          const w = seated ? workerById.get(seated.workerId) : undefined;
          return (
            <ItemWrap
              key={item.id}
              position={[item.x, 0, item.z]}
              bornAt={bornTimes.current.get(item.id) ?? 0}
              hovered={hoverObj === item.id && !placing}
              drop={
                intro
                  ? { plan: intro, delay: intro.items.get(item.id) ?? 0, wobble: 0.3 }
                  : null
              }
            >
              <SmoothYaw yaw={yawOf(item.rot)}>
                <group
                  onPointerDown={(e) => {
                    if (placing || e.button !== 0 || readOnly) return;
                    e.stopPropagation();
                    // Select on press so a plain click shows the chips; hold the
                    // camera still and arm a drag that only starts if we move.
                    selectObject({ kind: "item", id: item.id });
                    interactionLock.current = true;
                    pendingDrag.current = {
                      sel: { kind: "item", id: item.id },
                      x: e.clientX,
                      y: e.clientY,
                    };
                  }}
                  onClick={(e) => {
                    // While placing, let the click fall through to the ground so
                    // it lands on a tile; otherwise it's just a selection.
                    if (!placing) e.stopPropagation();
                  }}
                  onPointerOver={(e) => {
                    e.stopPropagation();
                    hoverOn(item.id);
                  }}
                  onPointerOut={() => hoverOff(item.id)}
                >
                  <FurnitureModel
                    type={item.type}
                    occupied={!!seated}
                    screenOn={w?.status === "working"}
                    ghost={null}
                  />
                </group>
              </SmoothYaw>
            </ItemWrap>
          );
        })}

        {/* Agents - stationed at their desk, roaming the room it sits in */}
        {agents.map((a) => {
          // Their desk carries them: hide the seated agent while it's dragging
          // (the move ghost shows them riding along).
          if (beingMoved(a.deskId)) return null;
          const w = workerById.get(a.workerId)!;
          const desk = itemById.get(a.deskId)!;
          const seat = chairOffset(desk.rot);
          const isSel = selected?.kind === "agent" && selected.workerId === a.workerId;
          const hovered = hoverObj === `agent-${a.workerId}` && !placing;
          const onStageNow = stage?.workerId === a.workerId;
          // The landing-page showcase pins every status card open (there's no
          // pointer to hover with - the canvas ignores it entirely). A staged
          // agent keeps their card only until the console takes over from it -
          // the card is what the panel grows out of.
          const showLabel = onStageNow
            ? !stage!.open
            : showcase || isSel || hovered;
          // The zone is derived by normalizeZones: the room the desk sits in.
          const zone = a.zone;
          return (
            <group key={a.workerId} position={[desk.x, 0, desk.z]}>
              <AgentModel
                sprite={w.sprite}
                workerId={w.id}
                status={w.status}
                pose="sit"
                yaw={seatYaw(desk.rot)}
                roam={{
                  home: [desk.x, desk.z],
                  chair: seat,
                  zone,
                  walls: layout.walls,
                }}
                stage={
                  onStageNow ? { at: stage!.at, out: stage!.out } : null
                }
                selected={isSel}
                selectedAt={selectedAt.current}
                // During the arrival the agent appears (existing pop-in) a
                // beat after their desk lands. Infinity = show not started
                // yet, which keeps them hidden until the clock reports in.
                bornAt={
                  intro
                    ? introStart
                      ? introStart + (intro.agents.get(a.workerId) ?? 0)
                      : Infinity
                    : bornTimes.current.get(`agent-${a.workerId}`) ?? 0
                }
                label={w.name}
                jobTitle={w.title}
                task={w.task}
                autonomy={w.autonomy}
                confidence={w.confidence}
                confidenceRuns={w.confidenceRuns}
                lastRunAt={w.lastRunAt}
                waiting={w.waiting ?? null}
                pop={popByWorker.get(a.workerId) ?? null}
                showLabel={showLabel}
                // Focus (stop + face the camera) only ever follows a real
                // hover/selection - in the showcase the labels are pinned open
                // and everyone keeps living their life.
                focused={isSel || hovered}
                // A single hitbox on the model (not this group) is the pointer
                // target, so hover never flickers between moving body parts.
                // The showcase mounts no hitbox at all: pointer-events are off
                // in CSS anyway, and this keeps the raycaster silent too.
                interaction={showcase ? undefined : {
                  onPointerDown: (e) => {
                    if (placing || e.button !== 0 || readOnly) return;
                    e.stopPropagation();
                    // Select on press so a plain click shows the chips; hold the
                    // camera still and arm a drag that only starts if we move.
                    selectObject({ kind: "agent", workerId: a.workerId });
                    interactionLock.current = true;
                    pendingDrag.current = {
                      sel: { kind: "agent", workerId: a.workerId },
                      x: e.clientX,
                      y: e.clientY,
                    };
                  },
                  onClick: (e) => {
                    if (!placing) e.stopPropagation();
                    // A waiting agent's click IS the answer path: no chips,
                    // no second click - straight onto the stage, where the
                    // panel is the question (the host's stagePanel decides
                    // that from the pending approval). Everyone else keeps
                    // the select-then-chips flow.
                    if (
                      !placing &&
                      w.waiting &&
                      stagePanel &&
                      !stage &&
                      e.delta <= 6
                    ) {
                      openStage(a.workerId);
                    }
                  },
                  onPointerOver: (e) => {
                    e.stopPropagation();
                    hoverOn(`agent-${a.workerId}`);
                  },
                  onPointerOut: () => hoverOff(`agent-${a.workerId}`),
                }}
                chips={
                  isSel && !readOnly && !placing && !stage ? (
                    <div className="px-office__chips">
                      {stagePanel && (
                        <button
                          type="button"
                          title={`Open ${w.name}'s console`}
                          onClick={() => openStage(a.workerId)}
                        >
                          <FiSliders />
                        </button>
                      )}
                      {/* Deliberately NOT a bin and NOT red: this only sends
                          them off the floor - they stay hired, back in the
                          Team list. A bin read as "delete the agent". */}
                      <button
                        type="button"
                        title="Take off the floor - they stay in your Team"
                        onClick={() => removeAgent(a.workerId)}
                      >
                        <FiLogOut />
                      </button>
                    </div>
                  ) : undefined
                }
              />
            </group>
          );
        })}

        {/* Selection action chips for furniture. Agent chips live on the
            AgentModel itself (above), so they follow the agent as it roams
            rather than staying pinned to the empty desk. */}
        {!readOnly && !placing && selectedItem && (
          <Html
            position={[selectedItem.x, 1.15, selectedItem.z]}
            zIndexRange={[20, 0]}
          >
            <div className="px-office__hud">
            <div className="px-office__chips">
              <button
                type="button"
                title="Rotate (R)"
                onClick={() => rotateItem(selectedItem.id)}
              >
                <FiRotateCw />
              </button>
              <button
                type="button"
                title="Remove"
                className="is-danger"
                onClick={() => removeItem(selectedItem.id)}
              >
                <FiTrash2 />
              </button>
            </div>
            </div>
          </Html>
        )}

        {/* An agent on stage: the office dims behind them, a warm key light
            picks them out, and the desk they left keeps a ring for a moment. */}
        {stage && (
          <>
            <StageDressing at={stage.at} out={stage.out} />
            {stageDesk && !stage.out && (
              <StageBurst x={stageDesk.x} z={stageDesk.z} at={stage.at} />
            )}
          </>
        )}
      </Canvas>

      {/* The console. Mounted only once the agent has all but landed, so it
          zooms out of the card above their head rather than over the office. */}
      {stage?.open && stagePanel && (
        <div className={"px-stage" + (stage.out ? " is-out" : "")}>
          <button
            type="button"
            className="px-stage__catch"
            aria-label="Send the agent back to their desk"
            onClick={closeStage}
          />
          {stagePanel(closeStage)}
        </div>
      )}

      {/* ── DOM overlay ── */}
      {placing && (
        <div className="px-office__hint">
          {mode.kind === "paint" && `Click or drag to paint floor tiles · Esc to finish`}
          {mode.kind === "erase" &&
            `Click or drag to remove floor tiles and walls · Esc to finish`}
          {mode.kind === "wall" &&
            `Click or drag along tile edges to build walls · Esc to finish`}
          {mode.kind === "door" && `Click a wall to add or remove a door · Esc to finish`}
          {mode.kind === "tint" &&
            `Paint the floor "${legendById.get(mode.legendId)?.name ?? ""}" · start a stroke on that colour to erase it · Esc to finish`}
          {mode.kind === "place-item" &&
            `Click a tile to place · right-click to rotate · Esc to finish`}
          {mode.kind === "place-agent" &&
            `Click a tile to drop ${modeWorkerName} and their desk · right-click to rotate · Esc to cancel`}
          {mode.kind === "move-item" &&
            (mode.drag
              ? `Drop on a highlighted tile`
              : `Click a tile to move here · Esc to cancel`)}
        </div>
      )}

      {/* Bake the item thumbnails once, then this unmounts for good. */}
      {!readOnly && !previews && (
        <ToolPreviewBaker
          types={FURNITURE_TOOLS.map((t) => t.type)}
          onBaked={setPreviews}
        />
      )}

      {/* ── The dock: just the three panel tabs, centred on the left edge ── */}
      {!showcase && (
      <div className="px-office__dock">
        <button
          type="button"
          className={
            "px-office__dock-tab" + (openPanel === "team" ? " is-active" : "")
          }
          title="Team"
          aria-label="Team"
          onClick={() => togglePanel("team")}
        >
          <FiUsers />
          {!readOnly && offFloor.length > 0 && (
            <span
              className="px-office__dock-count"
              title={`${offFloor.length} waiting to be placed`}
            >
              {offFloor.length}
            </span>
          )}
        </button>
        {!readOnly && (
          <button
            type="button"
            className={
              "px-office__dock-tab" + (openPanel === "build" ? " is-active" : "")
            }
            title="Build"
            aria-label="Build"
            onClick={() => togglePanel("build")}
          >
            <FiGrid />
          </button>
        )}
        <button
          type="button"
          className={
            "px-office__dock-tab" + (openPanel === "legend" ? " is-active" : "")
          }
          title="Legend"
          aria-label="Legend"
          onClick={() => togglePanel("legend")}
        >
          <FiDroplet />
        </button>

      </div>
      )}

      {/* ── View controls: turn, zoom, full screen, help - the map-app corner.
          They act on the viewport, not the office, so they live with it
          (bottom right) instead of crowding the panel dock. ── */}
      {!showcase && (
      <div className="px-office__cam">
        <button type="button" title="Turn left (Q)" onClick={() => cameraControl.current?.rotate(1)}>
          <FiRotateCcw />
        </button>
        <button type="button" title="Turn right (E)" onClick={() => cameraControl.current?.rotate(-1)}>
          <FiRotateCw />
        </button>
        <div className="px-office__cam-sep" />
        <button type="button" title="Zoom out" onClick={() => cameraControl.current?.zoomBy(1 / 1.3)}>
          <FiZoomOut />
        </button>
        <button type="button" title="Zoom in" onClick={() => cameraControl.current?.zoomBy(1.3)}>
          <FiZoomIn />
        </button>
        <button type="button" title="Zoom to fit" onClick={() => cameraControl.current?.reset()}>
          <FiCrosshair />
        </button>
        <div className="px-office__cam-sep" />
        <button
          type="button"
          title={fullscreen ? "Exit full screen" : "Full screen"}
          onClick={toggleFullscreen}
        >
          {fullscreen ? <FiMinimize2 /> : <FiMaximize2 />}
        </button>
        <button
          type="button"
          title="Help"
          className={helpOpen ? "is-active" : ""}
          onClick={() => setHelpOpen((o) => !o)}
        >
          <FiHelpCircle />
        </button>
        {!readOnly && (
          <>
            <div className="px-office__cam-sep" />
            {/* The save signal, always in the same corner: amber while a save
                is in flight, green the moment it lands. */}
            <span
              className={
                "px-office__dock-save" +
                (saveState === "saving"
                  ? " is-saving"
                  : saveState === "saved"
                    ? " is-saved"
                    : "")
              }
              title={
                saveState === "saving"
                  ? "Saving…"
                  : saveState === "saved"
                    ? "Saved"
                    : "Changes save automatically"
              }
              aria-hidden="true"
            />
          </>
        )}
      </div>
      )}

      {/* ── Build panel - tools and furniture, editors only ── */}
      {!readOnly && (
      <div
        className={
          "px-office__panel px-office__toolbar" +
          (openPanel === "build" ? " is-open" : "")
        }
      >
        <div className="px-office__panel-head">
          <span className="px-office__tb-head">Build</span>
          <button
            type="button"
            title="Close"
            aria-label="Close the build tools"
            onClick={() => closePanel("build")}
          >
            <FiX />
          </button>
        </div>
        <div className="px-office__tools">
          <button
            type="button"
            className={mode.kind === "paint" ? "is-active" : ""}
            onClick={() => toggleTool({ kind: "paint" })}
          >
            <FiPlusSquare /> Floor
          </button>
          <button
            type="button"
            className={mode.kind === "wall" ? "is-active" : ""}
            onClick={() => toggleTool({ kind: "wall" })}
          >
            <FiColumns /> Wall
          </button>
          <button
            type="button"
            className={mode.kind === "door" ? "is-active" : ""}
            onClick={() => toggleTool({ kind: "door" })}
          >
            <FiLogIn /> Door
          </button>
          <button
            type="button"
            className={mode.kind === "erase" ? "is-active" : ""}
            onClick={() => toggleTool({ kind: "erase" })}
          >
            <FiMinusSquare /> Erase
          </button>
        </div>

        <span className="px-office__tb-sub">Items</span>
        <div className="px-office__items">
          {FURNITURE_TOOLS.map(({ type, label }) => (
            <button
              key={type}
              type="button"
              title={`Place a ${label.toLowerCase()}`}
              className={
                mode.kind === "place-item" && mode.type === type
                  ? "is-active"
                  : ""
              }
              onClick={() => {
                setMode(
                  mode.kind === "place-item" && mode.type === type
                    ? { kind: "idle" }
                    : { kind: "place-item", type },
                );
                // A phone drawer covers the floor it is about to place onto.
                if (narrow) closePanel("build");
              }}
            >
              <span className="px-office__item-thumb">
                {previews?.[type] ? (
                  <img src={previews[type]} alt="" draggable={false} />
                ) : (
                  <FiPlus aria-hidden="true" />
                )}
              </span>
              <span className="px-office__item-label">{label}</span>
            </button>
          ))}
        </div>
      </div>
      )}

      {/* ── Team panel - the whole roster, on the floor and off ── */}
      {!showcase && (
      <div
        className={
          "px-office__panel px-office__team-rail" +
          (openPanel === "team" ? " is-open" : "")
        }
      >
        <div className="px-office__panel-head">
          <span className="px-office__tb-head">Team</span>
          <button
            type="button"
            title="Close"
            aria-label="Close the team"
            onClick={() => closePanel("team")}
          >
            <FiX />
          </button>
        </div>

        {workers.length === 0 ? (
          <p className="px-office__tb-empty">
            No agents yet - <a href="/office/workers">hire your first worker</a>{" "}
            and they'll appear here.
          </p>
        ) : (
          <>
            <span className="px-office__tb-sub">
              On the floor<b>{onFloor.length}</b>
            </span>
            {onFloor.length === 0 ? (
              <p className="px-office__tb-empty">
                {readOnly
                  ? "Nobody has been placed yet."
                  : "Nobody yet - click a name below to give them a desk."}
              </p>
            ) : (
              <div className="px-office__team">
                {onFloor.map((w) => (
                  <button
                    key={w.id}
                    type="button"
                    title={
                      stagePanel
                        ? `Open ${w.name}'s console`
                        : `Find ${w.name} on the floor`
                    }
                    onClick={() => focusWorker(w.id)}
                  >
                    <PortletPortrait
                      sprite={w.sprite}
                      workerId={w.id}
                      className="px-office__face"
                    />
                    <span className="px-office__team-name">{w.name}</span>
                    <span
                      className={`px-office__dot px-office__dot--${WORKER_STATUSES[w.status].tone}`}
                      title={WORKER_STATUSES[w.status].label}
                      aria-label={WORKER_STATUSES[w.status].label}
                    />
                  </button>
                ))}
              </div>
            )}

            <span className="px-office__tb-sub">
              Not onboarded<b>{offFloor.length}</b>
            </span>
            {offFloor.length === 0 ? (
              <p className="px-office__tb-empty">
                Everyone's on the floor.{" "}
                <a href="/office/workers">Hire another worker</a> to grow the
                team.
              </p>
            ) : readOnly ? (
              <>
                <div className="px-office__team">
                  {offFloor.map((w) => (
                    <div key={w.id} className="px-office__team-row">
                      <PortletPortrait
                        sprite={w.sprite}
                        workerId={w.id}
                        className="px-office__face"
                      />
                      <span className="px-office__team-name">{w.name}</span>
                    </div>
                  ))}
                </div>
                <p className="px-office__tb-empty">
                  Whoever manages the office can seat them.
                </p>
              </>
            ) : (
              <div className="px-office__team">
                {offFloor.map((w) => {
                  const active =
                    mode.kind === "place-agent" && mode.workerId === w.id;
                  return (
                    <button
                      key={w.id}
                      type="button"
                      className={active ? "is-active" : ""}
                      title={`Place ${w.name} on the floor`}
                      onClick={() => {
                        setMode(
                          active
                            ? { kind: "idle" }
                            : { kind: "place-agent", workerId: w.id },
                        );
                        if (narrow) closePanel("team");
                      }}
                    >
                      <PortletPortrait
                        sprite={w.sprite}
                        workerId={w.id}
                        className="px-office__face"
                      />
                      <span className="px-office__team-name">{w.name}</span>
                      <FiPlus
                        className="px-office__team-add"
                        aria-hidden="true"
                      />
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
      )}

      {/* ── Legend panel: named colours, painted onto the floor ── */}
      {!showcase && (
      <div
        className={
          "px-office__panel px-office__legend" +
          (openPanel === "legend" ? " is-open" : "")
        }
      >
        <div className="px-office__panel-head">
          <span className="px-office__tb-head">Legend</span>
          <button
            type="button"
            title="Close"
            aria-label="Close the legend"
            onClick={() => closePanel("legend")}
          >
            <FiX />
          </button>
        </div>
        {layout.legend.map((e) => {
          const active = mode.kind === "tint" && mode.legendId === e.id;
          const isRenaming = renaming?.id === e.id;
          return (
            <div
              key={e.id}
              className={
                "px-office__legend-chip" +
                (active ? " is-active" : "") +
                (flash?.legendId === e.id ? " is-flashing" : "") +
                (emptyChip === e.id ? " is-empty" : "")
              }
              style={{ "--chip": e.color } as React.CSSProperties}
            >
              {/* The swatch IS the colour control when editing: pick a new
                  colour and every room of the department repaints live. */}
              {!readOnly && (
                <input
                  type="color"
                  className="px-office__legend-recolor"
                  value={e.color}
                  title={`Recolour "${e.name}" - every room repaints with it`}
                  aria-label={`Colour of ${e.name}`}
                  onChange={(ev) => recolorLegend(e.id, ev.target.value)}
                />
              )}
              {isRenaming ? (
                <input
                  type="text"
                  className="px-office__legend-rename"
                  value={renaming.draft}
                  maxLength={LEGEND_NAME_MAX}
                  autoFocus
                  aria-label={`Rename ${e.name}`}
                  onChange={(ev) =>
                    setRenaming({ id: e.id, draft: ev.target.value })
                  }
                  onBlur={commitRename}
                  onKeyDown={(ev) => {
                    if (ev.key === "Enter") commitRename();
                    if (ev.key === "Escape") setRenaming(null);
                  }}
                />
              ) : (
                <button
                  type="button"
                  className="px-office__legend-pick"
                  title={
                    readOnly
                      ? `Show where ${e.name} is`
                      : active
                        ? "Stop painting"
                        : `Light up ${e.name}'s rooms, and paint more of them`
                  }
                  onClick={() => {
                    // Everyone gets the show; editors also pick up the brush.
                    flashLegend(e.id);
                    if (!readOnly) {
                      setMode(
                        active
                          ? { kind: "idle" }
                          : { kind: "tint", legendId: e.id },
                      );
                    }
                  }}
                >
                  {readOnly && (
                    <span
                      className="px-office__legend-swatch"
                      style={{ background: e.color }}
                      aria-hidden="true"
                    />
                  )}
                  <span className="px-office__legend-name">{e.name}</span>
                </button>
              )}
              {!readOnly && !isRenaming && (
                <>
                  <button
                    type="button"
                    className="px-office__legend-edit"
                    title={`Rename "${e.name}"`}
                    onClick={() => setRenaming({ id: e.id, draft: e.name })}
                  >
                    <FiEdit2 />
                  </button>
                  <button
                    type="button"
                    className="px-office__legend-del"
                    title={`Remove "${e.name}" (unpaints its tiles)`}
                    onClick={() => removeLegend(e.id)}
                  >
                    <FiX />
                  </button>
                </>
              )}
            </div>
          );
        })}
        {!readOnly && layout.legend.length < MAX_LEGEND && (
          <form className="px-office__legend-add" onSubmit={addLegend}>
            <input
              type="color"
              value={legendColor}
              onChange={(e) => setLegendColor(e.target.value)}
              title="Pick a colour"
              aria-label="New legend colour"
            />
            <input
              type="text"
              value={legendName}
              onChange={(e) => setLegendName(e.target.value)}
              placeholder="e.g. Marketing"
              maxLength={LEGEND_NAME_MAX}
              aria-label="New legend name"
            />
            <button type="submit" disabled={!legendName.trim()} title="Add to legend">
              <FiPlus />
            </button>
          </form>
        )}
      </div>
      )}


      {helpOpen && readOnly && !showcase && (
        <div className="px-office__help">
          <p><strong>Your office</strong></p>
          <ul>
            <li>Drag anywhere to pan · scroll or pinch to zoom · Q/E turns a quarter (always a corner view)</li>
            <li>Tabs on the left open Team and the legend; turn, zoom and full screen sit bottom right</li>
            <li>Team: everyone hired - click someone on the floor to visit them</li>
            <li>Agents wander the room their desk is in while idle and type when working</li>
          </ul>
        </div>
      )}

      {helpOpen && !readOnly && (
        <div className="px-office__help">
          <p><strong>Build your office</strong></p>
          <ul>
            <li>Drag anywhere to pan · scroll or pinch to zoom · Q/E turns a quarter (always a corner view)</li>
            <li>Tabs on the left open Team, Build and the legend - one panel at a time; turn, zoom and full screen sit bottom right</li>
            <li>Floor / Erase: paint tiles on and off to shape the office</li>
            <li>Wall: draw dividers along tile edges · Door: click a wall</li>
            <li>Team: click someone off the floor to drop them in with their own desk - remove either and both go</li>
            <li>Agents roam the room their desk is in - walls and doorways set the edges, automatically</li>
            {stagePanel && (
              <li>
                Select an agent and open their console to brief them, watch a
                run, or set what starts one
              </li>
            )}
            <li>Legend: name a colour, then paint floor sections with it. Click an entry to light up its rooms; the swatch recolours it, the pencil renames it</li>
            <li>Click something to select it - R rotates, Delete removes</li>
            <li>While placing furniture, right-click turns it a quarter step</li>
            <li>Changes save automatically</li>
          </ul>
        </div>
      )}

      {!readOnly && layout.items.length === 0 && agents.length === 0 && mode.kind === "idle" && (
        <div className="px-office__welcome">
          Your office is ready to furnish - <strong>add an agent</strong> from
          the Team tab in the dock, or place items from the Build tab.
        </div>
      )}
    </div>
  );
}
