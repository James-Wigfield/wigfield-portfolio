import { useEffect, useRef } from 'react';
import { createStage } from './stage.js';
import './stage.css';

/* Dream Rooms · the viewer (CONTRACTS.md §8). A thin React wrapper round plain
   three.js (stage.js): it owns the host element and hands the stage its props.

     <DreamStage
       mode="corridor" | "dream"
       rows={rows}              corridor: the lean list (§2)
       at={id | null}           corridor: start standing at this door, facing it
       dream={{ id, world, model_url, stills, mood? }}      dream mode
       loadDream={async (id) => ({ world, model_url, stills, mood? })}   corridor
       enter={id | null}        corridor: on load, drift to this door and through it
       autopilot={bool}         ?autopilot=1
       still={bool}             ?still=1: stills + words + sound, then the wake
       mood={{ intensity }}     optional: drift speed (0.9–1.3 m/s); dream.mood wins
       kitUrl={url | null}      corridor kit GLB (default /dreams/corridor-kit.glb; null = grey box)
       onWake={(id) => {}}      dream mode: the page navigates to /dreams?at=<id>
       onAt={(id) => {}}        corridor: called after a wake leaves him at a door
       onState={(state) => {}}
       className
     />

   The stage is made once per mount (one WebGL context for its life); `mode`,
   `dream` and `rows` swap what it shows. Callbacks are read fresh each time. */

export default function DreamStage(props) {
  const { mode = 'dream', dream = null, rows = null, className = '' } = props;
  const hostRef = useRef(null);
  const stageRef = useRef(null);
  const propsRef = useRef(props);

  useEffect(() => {
    propsRef.current = props;
  });

  useEffect(() => {
    const stage = createStage(hostRef.current, () => propsRef.current);
    stageRef.current = stage;
    return () => {
      stage.dispose();
      stageRef.current = null;
    };
  }, []);

  useEffect(() => {
    stageRef.current?.setContent({ mode, dream, rows });
  }, [mode, dream, rows]);

  return <div ref={hostRef} className={`dr-stage ${className}`.trim()} data-mode={mode} />;
}
