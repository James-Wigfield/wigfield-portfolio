import { useEffect, useRef, useState } from 'react';
import './projector-life.css';

/* PROJECTOR LIFE — shell. STUB by the lead (stage mounts, nothing else); the
   UI agent replaces this file with the tabs, controls, presets and plan.
   The engine is a dynamic import so three.js only loads with this tab. */
export default function ProjectorLife() {
  const hostRef = useRef(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    let stage = null;
    let dead = false;
    import('./engine/Stage.js')
      .then(({ createStage }) => createStage(hostRef.current))
      .then((s) => {
        if (dead) s.dispose();
        else {
          stage = s;
          window.__pjlStage = s;
        }
      })
      .catch((e) => !dead && setErr(String(e?.message || e)));
    return () => {
      dead = true;
      stage?.dispose();
      if (window.__pjlStage === stage) delete window.__pjlStage;
    };
  }, []);

  return (
    <div className="pt-module pjl">
      <div ref={hostRef} className="pjl-stage" />
      {err && <p className="pjl-err">{err}</p>}
    </div>
  );
}
