/**
 * TEMPORARY - the layout tool for the 3D hero.
 *
 * Click the wordmark or the gate and move, turn or scale them in place with
 * three.js's transform handles (arrows for moving, rings for
 * turning, boxes for scaling; red X is left/right, green Y is up/down, blue Z
 * is nearer/farther), or type the numbers into the panel, or nudge with the
 * keyboard. The wordmark also has a CURVE: the angle its letters bend
 * through, positive wrapping away from the reader (around whatever stands
 * behind the word), zero straight. The layout is kept in localStorage so a
 * reload keeps it, and "Copy values" puts a ready-to-paste block on the
 * clipboard.
 *
 * Once a layout is locked in: paste those values over LAYOUT in hero-3d.tsx,
 * then delete this file, layout-tool.css, and the lines in hero-3d.tsx marked
 * LAYOUT TOOL.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import type { ThreeEvent } from "@react-three/fiber";
import { TransformControls } from "@react-three/drei";
import "./layout-tool.css";

export type Vec3 = [number, number, number];
/** Rotation in DEGREES, so the numbers read the way a person would say them.
    `curve` (degrees of arc, wordmark only) bends the letters round a circle. */
export type Xform = { position: Vec3; rotation: Vec3; scale: number; curve?: number };
export type LayoutId = "word" | "gate";
export type Layout = Record<LayoutId, Xform>;
export type Mode = "translate" | "rotate" | "scale";
type Controls = React.ComponentRef<typeof TransformControls>;
type Refs = Record<LayoutId, React.RefObject<THREE.Object3D | null>>;

/** An object that can be clicked, and whether it is the selection. */
export type Pick = { selected: boolean; onSelect: () => void };

/** The pointer handlers for a selectable group (none when the tool is off). */
export function pickHandlers(pick?: Pick) {
  if (!pick) return {};
  return {
    onClick: (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      pick.onSelect();
    },
    onPointerOver: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      document.body.style.cursor = "pointer";
    },
    onPointerOut: () => {
      document.body.style.cursor = "";
    },
  };
}

const LAYOUT_KEY = "portara-test:layout";
const TOOL_KEY = "portara-test:layout-tool";
const VIEW_KEY = "portara-test:layout-view";

/** What to show while judging the layout: the portlets, the ground grid. */
type View = { portlets: boolean; grid: boolean };
const VIEW_DEFAULT: View = { portlets: true, grid: true };

function readView(): View {
  try {
    const raw = localStorage.getItem(VIEW_KEY);
    return raw ? { ...VIEW_DEFAULT, ...(JSON.parse(raw) as Partial<View>) } : VIEW_DEFAULT;
  } catch {
    return VIEW_DEFAULT;
  }
}
const IDS: LayoutId[] = ["word", "gate"];
const NAMES: Record<LayoutId, string> = { word: "Wordmark", gate: "Gate + rings" };
const MODES: { id: Mode; label: string; key: string }[] = [
  { id: "translate", label: "Move", key: "W" },
  { id: "rotate", label: "Turn", key: "E" },
  { id: "scale", label: "Size", key: "R" },
];
const NUDGE = 0.05;
const TURN = 5;
const GROW = 0.05;
const BEND = 5;

export function readXform(o: THREE.Object3D): Omit<Xform, "curve"> {
  return {
    position: [o.position.x, o.position.y, o.position.z],
    rotation: [o.rotation.x, o.rotation.y, o.rotation.z].map(THREE.MathUtils.radToDeg) as Vec3,
    scale: o.scale.x,
  };
}

export function applyXform(o: THREE.Object3D, x: Xform) {
  o.position.set(x.position[0], x.position[1], x.position[2]);
  const [rx, ry, rz] = x.rotation.map(THREE.MathUtils.degToRad);
  o.rotation.set(rx, ry, rz);
  o.scale.setScalar(x.scale);
}

/* A stored layout is only kept while the defaults it was edited from are
   still the defaults: change LAYOUT in the code and every browser starts
   from the new one instead of an old experiment. */
let baseSig = "";

export function readLayout(defaults: Layout): Layout {
  baseSig = JSON.stringify(defaults);
  try {
    const raw = localStorage.getItem(LAYOUT_KEY);
    if (!raw) return defaults;
    const saved = JSON.parse(raw) as Partial<Layout> & { base?: string };
    if (saved.base !== baseSig) return defaults;
    return {
      word: { ...defaults.word, ...saved.word },
      gate: { ...defaults.gate, ...saved.gate },
    };
  } catch {
    return defaults;
  }
}

function saveLayout(l: Layout) {
  try {
    localStorage.setItem(LAYOUT_KEY, JSON.stringify({ ...l, base: baseSig }));
  } catch {
    /* private mode: the layout just does not survive a reload */
  }
}

/** The block to paste over LAYOUT in hero-3d.tsx. */
export function snippet(l: Layout) {
  const v = (n: number, d: number) => {
    const s = Number(n.toFixed(d));
    return Object.is(s, -0) ? "0" : String(s);
  };
  const line = (id: LayoutId) => {
    const x = l[id];
    const curve = x.curve !== undefined ? `, curve: ${v(x.curve, 1)}` : "";
    return `  ${id}: { position: [${x.position.map((n) => v(n, 3)).join(", ")}], rotation: [${x.rotation
      .map((n) => v(n, 1))
      .join(", ")}], scale: ${v(x.scale, 3)}${curve} },`;
  };
  return `const LAYOUT: Layout = {\n${IDS.map(line).join("\n")}\n};`;
}

export type LayoutTool = ReturnType<typeof useLayoutTool>;

export function useLayoutTool(defaults: Layout, refs: Refs) {
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(TOOL_KEY) !== "off";
    } catch {
      return true;
    }
  });
  const [selected, setSelected] = useState<LayoutId | null>(null);
  const [mode, setMode] = useState<Mode>("translate");
  const [snap, setSnap] = useState(false);
  const [layout, setLayout] = useState<Layout>(() => readLayout(defaults));
  const [view, setViewState] = useState<View>(readView);
  const layoutRef = useRef(layout);
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const controls = useRef<Controls>(null);

  const toggleOpen = useCallback(() => {
    setOpen((o) => {
      try {
        localStorage.setItem(TOOL_KEY, o ? "off" : "on");
      } catch {
        /* ignore */
      }
      return !o;
    });
    setSelected(null);
  }, []);

  const set = useCallback((next: Layout) => {
    layoutRef.current = next;
    setLayout(next);
    saveLayout(next);
  }, []);

  /** Show or hide the portlets or the grid. */
  const setView = useCallback((patch: Partial<View>) => {
    setViewState((v) => {
      const next = { ...v, ...patch };
      try {
        localStorage.setItem(VIEW_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  /** The panel or the keyboard changed a value: push it onto the object. */
  const update = useCallback(
    (id: LayoutId, patch: Partial<Xform>) => {
      const next = { ...layoutRef.current, [id]: { ...layoutRef.current[id], ...patch } };
      const o = refs[id].current;
      if (o) applyXform(o, next[id]);
      set(next);
    },
    [refs, set],
  );

  /** The handles moved the object: mirror it into the panel. */
  const fromObject = useCallback(
    (id: LayoutId) => {
      const o = refs[id].current;
      if (!o) return;
      // Scale stays uniform: whichever axis the handle changed wins.
      const s = o.scale;
      if (s.x !== s.y || s.y !== s.z) {
        const prev = layoutRef.current[id].scale;
        const pick = [s.x, s.y, s.z].reduce((a, b) => (Math.abs(b - prev) > Math.abs(a - prev) ? b : a));
        s.setScalar(pick);
      }
      set({ ...layoutRef.current, [id]: { ...readXform(o), curve: layoutRef.current[id].curve } });
    },
    [refs, set],
  );

  const reset = useCallback((id: LayoutId) => update(id, defaults[id]), [update, defaults]);

  /** A click that hit nothing deselects, unless it landed on a handle. */
  const missed = useCallback(() => {
    // `axis` is the handle under the pointer (typed private, set all the same).
    if ((controls.current as unknown as { axis?: string | null } | null)?.axis) return;
    setSelected(null);
  }, []);

  // Keyboard: W E R pick the handles, arrows nudge, [ ] turn, - = size,
  // , . curve, Esc deselects.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      if (e.ctrlKey || e.metaKey) return;
      if (e.key === "Escape") {
        setSelected(null);
        return;
      }
      const k = e.key.toLowerCase();
      if (k === "w") setMode("translate");
      else if (k === "e") setMode("rotate");
      else if (k === "r") setMode("scale");
      const id = selectedRef.current;
      if (!id) return;
      const x = layoutRef.current[id];
      const step = e.altKey ? NUDGE / 5 : NUDGE;
      const [px, py, pz] = x.position;
      let patch: Partial<Xform> | null = null;
      switch (e.key) {
        case "ArrowLeft":
          patch = { position: [px - step, py, pz] };
          break;
        case "ArrowRight":
          patch = { position: [px + step, py, pz] };
          break;
        case "ArrowUp":
          patch = { position: e.shiftKey ? [px, py + step, pz] : [px, py, pz - step] };
          break;
        case "ArrowDown":
          patch = { position: e.shiftKey ? [px, py - step, pz] : [px, py, pz + step] };
          break;
        case "[":
          patch = { rotation: [x.rotation[0], x.rotation[1] - TURN, x.rotation[2]] };
          break;
        case "]":
          patch = { rotation: [x.rotation[0], x.rotation[1] + TURN, x.rotation[2]] };
          break;
        case "-":
        case "_":
          patch = { scale: Math.max(0.1, x.scale - GROW) };
          break;
        case "=":
        case "+":
          patch = { scale: x.scale + GROW };
          break;
        case ",":
        case "<":
          if (id === "word") patch = { curve: (x.curve ?? 0) - BEND };
          break;
        case ".":
        case ">":
          if (id === "word") patch = { curve: (x.curve ?? 0) + BEND };
          break;
      }
      if (patch) {
        e.preventDefault();
        update(id, patch);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, update]);

  return {
    open,
    toggleOpen,
    selected,
    select: setSelected,
    missed,
    mode,
    setMode,
    snap,
    setSnap,
    layout,
    update,
    reset,
    fromObject,
    controls,
    refs,
    view,
    setView,
  };
}

/** Inside the Canvas: the ground grid and the handles on the selected object. */
export function LayoutGizmo({ tool }: { tool: LayoutTool }) {
  const { selected, mode, snap, controls, fromObject, refs, view } = tool;
  const target = selected ? refs[selected].current : null;
  return (
    <>
      {view.grid && (
        <gridHelper args={[30, 60, "#aab4be", "#d5dce2"]} position-y={0.002} material-transparent material-opacity={0.55} />
      )}
      {selected && target && (
        <TransformControls
          key={selected}
          ref={controls}
          object={target}
          mode={mode}
          space={mode === "rotate" ? "local" : "world"}
          translationSnap={snap ? 0.1 : null}
          rotationSnap={snap ? THREE.MathUtils.degToRad(5) : null}
          scaleSnap={snap ? 0.1 : null}
          size={0.9}
          onObjectChange={() => fromObject(selected)}
        />
      )}
    </>
  );
}

/** Outside the Canvas: the on/off switch and the panel. */
export function LayoutPanel({ tool }: { tool: LayoutTool }) {
  const { open, toggleOpen, selected, select, mode, setMode, snap, setSnap, layout, update, reset, view, setView } = tool;
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(snippet(layout));
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      window.prompt("Copy these values:", snippet(layout));
    }
  };
  const x = selected ? layout[selected] : null;

  return (
    <>
      <button type="button" className={"lt-switch" + (open ? " is-on" : "")} onClick={toggleOpen} aria-pressed={open}>
        <span className="lt-switch__dot" aria-hidden="true" />
        Layout tool {open ? "on" : "off"}
      </button>
      {open && (
        <div className="lt" role="group" aria-label="Layout tool">
          <div className="lt__head">
            <span className="lt__title">Layout</span>
            <div className="lt__objs">
              {IDS.map((id) => (
                <button
                  key={id}
                  type="button"
                  className={"lt__obj" + (selected === id ? " is-on" : "")}
                  onClick={() => select(selected === id ? null : id)}
                >
                  {NAMES[id]}
                </button>
              ))}
            </div>
          </div>

          <div className="lt__view">
            <span className="lt__label">Show</span>
            <label className="lt__check">
              <input type="checkbox" checked={view.portlets} onChange={(e) => setView({ portlets: e.target.checked })} />
              Portlets
            </label>
            <label className="lt__check">
              <input type="checkbox" checked={view.grid} onChange={(e) => setView({ grid: e.target.checked })} />
              Grid
            </label>
          </div>

          {!selected || !x ? (
            <p className="lt__hint">Click the wordmark or the gate in the scene, or pick one above. Then drag the coloured handles.</p>
          ) : (
            <>
              <div className="lt__modes" role="radiogroup" aria-label="Handles">
                {MODES.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    role="radio"
                    aria-checked={mode === m.id}
                    className={"lt__mode" + (mode === m.id ? " is-on" : "")}
                    onClick={() => setMode(m.id)}
                  >
                    {m.label}
                    <kbd>{m.key}</kbd>
                  </button>
                ))}
              </div>

              <Row label="Position" values={x.position} step={0.05} digits={2} onChange={(v) => update(selected, { position: v })} />
              <Row label="Rotation" values={x.rotation} step={1} digits={1} onChange={(v) => update(selected, { rotation: v })} />
              <div className="lt__row lt__row--scale">
                <span className="lt__label">Scale</span>
                <input
                  type="range"
                  min={0.25}
                  max={3}
                  step={0.01}
                  value={x.scale}
                  aria-label="Scale"
                  onChange={(e) => update(selected, { scale: Number(e.target.value) })}
                />
                <Num value={x.scale} step={0.05} digits={2} onChange={(v) => update(selected, { scale: Math.max(0.05, v) })} />
              </div>
              {selected === "word" && (
                <div className="lt__row lt__row--scale">
                  <span className="lt__label">Curve</span>
                  <input
                    type="range"
                    min={-180}
                    max={180}
                    step={1}
                    value={x.curve ?? 0}
                    aria-label="Curve, degrees of arc"
                    onChange={(e) => update(selected, { curve: Number(e.target.value) })}
                  />
                  <Num value={x.curve ?? 0} step={5} digits={0} onChange={(v) => update(selected, { curve: THREE.MathUtils.clamp(v, -300, 300) })} />
                </div>
              )}

              <div className="lt__foot">
                <label className="lt__snap">
                  <input type="checkbox" checked={snap} onChange={(e) => setSnap(e.target.checked)} />
                  Snap
                </label>
                <button type="button" className="lt__btn" onClick={() => reset(selected)}>
                  Reset
                </button>
                <button type="button" className="lt__btn lt__btn--go" onClick={copy}>
                  {copied ? "Copied" : "Copy values"}
                </button>
              </div>
              <p className="lt__hint">
                Arrows nudge (Shift: up and down, Alt: fine). [ ] turn. - = size. , . curve. Red X, green Y, blue Z. Esc deselects.
              </p>
            </>
          )}
        </div>
      )}
    </>
  );
}

const AXES = ["x", "y", "z"] as const;

function Row({
  label,
  values,
  step,
  digits,
  onChange,
}: {
  label: string;
  values: Vec3;
  step: number;
  digits: number;
  onChange: (v: Vec3) => void;
}) {
  return (
    <div className="lt__row">
      <span className="lt__label">{label}</span>
      {AXES.map((axis, i) => (
        <Num
          key={axis}
          axis={axis}
          value={values[i]}
          step={step}
          digits={digits}
          onChange={(n) => {
            const next = [...values] as Vec3;
            next[i] = n;
            onChange(next);
          }}
        />
      ))}
    </div>
  );
}

/** A number field that follows the object while you are not typing in it. */
function Num({
  value,
  step,
  digits,
  onChange,
  axis,
}: {
  value: number;
  step: number;
  digits: number;
  onChange: (n: number) => void;
  axis?: "x" | "y" | "z";
}) {
  const fmt = (v: number) => (Math.abs(v) < 0.5 * Math.pow(10, -digits) ? 0 : v).toFixed(digits);
  const [text, setText] = useState(() => fmt(value));
  const [focus, setFocus] = useState(false);
  useEffect(() => {
    if (!focus) setText(fmt(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, focus, digits]);
  return (
    <input
      className={"lt__num" + (axis ? ` lt__num--${axis}` : "")}
      type="number"
      step={step}
      value={text}
      aria-label={axis ? axis.toUpperCase() : undefined}
      onFocus={() => setFocus(true)}
      onBlur={() => {
        setFocus(false);
        setText(fmt(value));
      }}
      onChange={(e) => {
        setText(e.target.value);
        const n = parseFloat(e.target.value);
        if (Number.isFinite(n)) onChange(n);
      }}
    />
  );
}
