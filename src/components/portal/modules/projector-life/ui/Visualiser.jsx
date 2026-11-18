import { useCallback, useEffect, useRef, useState } from 'react';
import { coerce, defaults } from '../params.js';
import { DEFAULT_PRESET, PRESET_BY_ID } from '../presets.js';
import Panel from './Panel';
import StageOverlay from './StageOverlay';
import McpPreview from './McpPreview';
import Honesty from './Honesty';
import { loadPref, savePref, useWidth } from './store';

/* ============================================================================
   PROJECTOR LIFE — the Visualiser tab
   ----------------------------------------------------------------------------
   Owns the Stage's life: a dynamic import of engine/Stage.js (three.js only
   downloads with this tab), createStage on mount, dispose on unmount, and
   window.__pjlStage for the QA hooks. The scene (values, view, preset) lives
   in the shell, so leaving for the Plan tab and coming back rebuilds the same
   scene. Value changes are mirrored into React state at once (controls stay
   snappy) and flushed to the Stage once per animation frame (an apex drag
   rebuilds patches at most once a frame).
   ========================================================================== */

export default function Visualiser({ scene, setScene }) {
  const rootRef = useRef(null);
  const fsRef = useRef(null);
  const frameRef = useRef(null);
  const hostRef = useRef(null);
  const stageRef = useRef(null);
  const valuesRef = useRef(scene.values);
  const viewRef = useRef(scene.view);
  const pending = useRef({});
  const raf = useRef(0);

  const [stage, setStage] = useState(null);
  const [err, setErr] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const [patches, setPatches] = useState([]);
  const [fs, setFs] = useState(false);
  const [open, setOpen] = useState(() => ({ scenes: true, room: typeof window === 'undefined' || window.innerWidth >= 860, ...loadPref('open', {}) }));
  const [folded, setFolded] = useState(() => !!loadPref('folded', false));
  const [drawerShut, setDrawerShut] = useState(() => !!loadPref('drawerShut', false));

  const width = useWidth(rootRef);
  const stageWidth = useWidth(frameRef);
  const narrow = (width || (typeof window !== 'undefined' ? window.innerWidth : 1200)) < 860;

  useEffect(() => {
    valuesRef.current = scene.values;
  }, [scene.values]);
  useEffect(() => {
    viewRef.current = scene.view;
  }, [scene.view]);

  // ── stage lifecycle ───────────────────────────────────────────────────────
  useEffect(() => {
    let dead = false;
    let st = null;
    const host = hostRef.current;
    host?.replaceChildren(); // a failed earlier attempt may have left a canvas
    import('../engine/Stage.js')
      .then(({ createStage }) => createStage(host, { values: valuesRef.current, view: viewRef.current }))
      .then((s) => {
        if (dead) {
          s.dispose();
          return;
        }
        st = s;
        stageRef.current = s;
        window.__pjlStage = s;
        // Catch up on anything picked while it loaded (a preset's values,
        // its region resets AND its camera), not just the edited keys.
        s.replace(valuesRef.current, { reseed: false });
        if (viewRef.current && viewRef.current !== s.view) s.setView(viewRef.current, { instant: true });
        // Changes made on the Stage directly (QA hooks, the console) reach the
        // panel too; echoes of the panel's own writes are equal and no-ops.
        s.onValues((diff) => {
          setScene((sc) => {
            let same = true;
            for (const k in diff) if (sc.values[k] !== diff[k]) same = false;
            return same ? sc : { ...sc, values: { ...sc.values, ...diff } };
          });
          if (Object.keys(diff).some((k) => k.startsWith('room.'))) setPatches(s.getPatches());
        });
        setPatches(s.getPatches());
        setStage(s);
      })
      .catch((e) => {
        if (!dead) setErr(String(e?.message || e));
      });
    return () => {
      dead = true;
      cancelAnimationFrame(raf.current);
      raf.current = 0;
      pending.current = {};
      if (st) {
        const lastView = st.view;
        st.dispose();
        if (window.__pjlStage === st) delete window.__pjlStage;
        if (stageRef.current === st) stageRef.current = null;
        if (lastView) setScene((sc) => (sc.view === lastView ? sc : { ...sc, view: lastView }));
      }
    };
  }, [attempt, setScene]);

  const retry = useCallback(() => {
    setErr(null);
    setAttempt((a) => a + 1);
  }, []);

  // ── fullscreen (the stage + panel wrapper) ────────────────────────────────
  useEffect(() => {
    const on = () => setFs(document.fullscreenElement === fsRef.current);
    document.addEventListener('fullscreenchange', on);
    return () => document.removeEventListener('fullscreenchange', on);
  }, []);
  const toggleFs = useCallback(() => {
    const el = fsRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen?.();
    else el.requestFullscreen?.().catch(() => {});
  }, []);

  // ── values: mirror now, flush to the Stage once per frame ─────────────────
  const flush = useCallback(() => {
    raf.current = 0;
    const p = pending.current;
    pending.current = {};
    const st = stageRef.current;
    if (!st || !Object.keys(p).length) return;
    st.set(p);
    if (Object.keys(p).some((k) => k.startsWith('room.'))) setPatches(st.getPatches());
  }, []);

  const write = useCallback(
    (partial, edited) => {
      setScene((sc) => {
        const values = { ...sc.values };
        for (const [k, v] of Object.entries(partial)) values[k] = coerce(k, v);
        return { ...sc, values, edited: edited ? true : sc.edited };
      });
      Object.assign(pending.current, partial);
      if (!raf.current) raf.current = requestAnimationFrame(flush);
    },
    [setScene, flush],
  );
  const apply = useCallback((partial) => write(partial, true), [write]);
  const applyQuiet = useCallback((partial) => write(partial, false), [write]);
  const onChange = useCallback((key, value) => write({ [key]: value }, true), [write]);

  const onPreset = useCallback(
    (p) => {
      setScene((sc) => ({ ...sc, values: { ...defaults(), ...p.values }, presetId: p.id, edited: false, view: p.camera || 'cutaway' }));
      if (p.open?.length) {
        setOpen((o) => {
          const n = { ...o };
          for (const g of p.open) n[g] = true;
          // not persisted: a preset opening a group is for this visit only
          // (persisting it left every group open on phones — visual critic)
          return n;
        });
        // Bring the first opened group into view inside the side panel (the
        // panel scrolls on its own; on phones the page is left alone).
        if (!narrow) {
          requestAnimationFrame(() =>
            requestAnimationFrame(() => {
              const root = rootRef.current;
              const sc = root?.querySelector('.pjl-panel__scroll');
              const el = root?.querySelector(`#pjl-g-${p.open[0]}`);
              if (!sc || !el) return;
              const top = sc.scrollTop + el.getBoundingClientRect().top - sc.getBoundingClientRect().top;
              sc.scrollTo({ top, behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
            }),
          );
        }
      }
      cancelAnimationFrame(raf.current);
      raf.current = 0;
      pending.current = {};
      const st = stageRef.current;
      if (st) {
        st.replace(p.values);
        st.setView(p.camera || 'cutaway');
        setPatches(st.getPatches());
      }
    },
    [setScene, narrow],
  );
  const onReset = useCallback(() => onPreset(DEFAULT_PRESET), [onPreset]);

  const onView = useCallback(
    (v) => {
      stageRef.current?.setView(v);
      setScene((sc) => ({ ...sc, view: v }));
    },
    [setScene],
  );

  const onToggle = useCallback((id) => {
    setOpen((o) => {
      const cur = id === 'scenes' ? o.scenes !== false : !!o[id];
      const n = { ...o, [id]: !cur };
      savePref('open', n);
      return n;
    });
  }, []);

  const onCollapse = useCallback(
    (v) => {
      if (narrow) {
        setDrawerShut(v);
        savePref('drawerShut', v);
      } else {
        setFolded(v);
        savePref('folded', v);
      }
    },
    [narrow],
  );

  const collapsed = narrow ? drawerShut : folded;
  const preset = PRESET_BY_ID[scene.presetId] || null;

  return (
    <div ref={rootRef} className="pjl-visroot">
      <div ref={fsRef} className={`pjl-vis${narrow ? ' is-narrow' : ''}${collapsed ? ' is-folded' : ''}${fs ? ' is-fs' : ''}`}>
        <div ref={frameRef} className="pjl-frame">
          <div ref={hostRef} className="pjl-stage" />
          <StageOverlay
            stage={stage}
            values={scene.values}
            scene={scene}
            preset={preset}
            onPreset={onPreset}
            onQuiet={applyQuiet}
            onReset={onReset}
            onView={onView}
            fs={fs}
            onFullscreen={toggleFs}
            stageWidth={stageWidth}
            loading={!stage}
            err={err}
            onRetry={retry}
          />
        </div>
        <Panel
          values={scene.values}
          onChange={onChange}
          apply={apply}
          stage={stage}
          patches={patches}
          scene={scene}
          onPreset={onPreset}
          open={open}
          onToggle={onToggle}
          collapsed={collapsed}
          onCollapse={onCollapse}
          narrow={narrow}
        />
      </div>
      <div className="pjl-below">
        <Honesty />
        <McpPreview stage={stage} values={scene.values} patches={patches} />
      </div>
    </div>
  );
}
