import { useState } from 'react';
import Clip from '../engine/Clip';
import { useJson } from '../engine/hooks';
import { Num } from './Num';

/* ============================================================================
   SEMINAR DECKS — D1, THE RECORDED DEMO (a real run in the Mamba PSMA app)
   ----------------------------------------------------------------------------
   The clip (clips/d1-model-run.mp4, tools/seminar-decks/make_d1.py) holds only
   the app's own image area. This component draws the rest in the deck's own
   type, synced to the playhead from data/d1-cues.json:
     - the honest speed label ("Real run in my app, sped up 6x") during the
       run; the 3D-view turn that follows is labelled as the app's view only
       (its playback speed is not the run's), no seconds anywhere
     - the app's status line at each stage of the run, and a progress bar
     - a one-line legend in the app's own colours (they differ from the
       motion clips' palette, so they are named on screen)
   No case id and no score appear. Style it with the deck's CSS through the
   classes sd-demo__*; variables --sd-ink, --sd-muted, --sd-font-*.
   Props: state (from ctx.clip(i)), mode, reduced, className, layout:
   'overlay' (default) fills its container, which should be the whole canvas,
   with the text on the video's left black margin; 'row' is a text column
   beside a video box and fits any container (the backup slide uses it).
   ========================================================================== */

function stageAt(cues, t) {
  if (!cues) return null;
  let cur = cues.stages[0];
  cues.stages.forEach((s) => {
    if (t + 1e-6 >= s.t) cur = s;
  });
  return cur;
}

export default function DemoClip({ state, mode, reduced, className = '', layout = 'overlay' }) {
  const cues = useJson('data/d1-cues.json');
  const [t, setT] = useState(0);
  const still = mode !== 'present' || reduced || state === 'hold';
  const time = still ? (cues?.duration ?? 99) : state === 'play' ? t : 0;
  const stage = stageAt(cues, time);
  const phase = stage?.phase ?? 'scan';
  const runFrac = cues ? Math.max(0, Math.min(1, (time - cues.run.start) / (cues.run.end - cues.run.start))) : 0;
  const legend = cues ? (phase === 'scan' || phase === 'run' ? cues.legend.scan : cues.legend.result) : [];

  return (
    <div className={`sd-demo sd-demo--${layout} ${className}`} data-scans="1">
      <div className="sd-demo__video">
        <Clip src="d1-model-run" state={state} mode={mode} reduced={reduced} onTime={(x) => setT(x)} label="A real run of the five-model ensemble in the app, on a held-out test scan, sped up" />
      </div>
      <div className="sd-demo__text">
        {phase === 'mip'
          ? <p className="sd-demo__speed" data-role="body">The same run, turned in 3D</p>
          : <p className="sd-demo__speed" data-role="body">Real run in my app, sped up <Num k="d1.speed" /></p>}
        <p className="sd-demo__status" data-role="body">{phase === 'mip' ? '' : stage?.text ?? ''}</p>
        <div className="sd-demo__bar" aria-hidden="true"><span style={{ transform: `scaleX(${runFrac})` }} /></div>
        <ul className="sd-demo__legend">
          {legend.map((l) => (
            <li key={l.key} data-role="body">
              <span className="sd-demo__swatch" style={{ background: cues.colours[l.key] }} />
              {l.label}
            </li>
          ))}
        </ul>
        <p className="sd-demo__note" data-role="foot">The app's own colours. Five-model ensemble, held-out test scan.</p>
      </div>
    </div>
  );
}
