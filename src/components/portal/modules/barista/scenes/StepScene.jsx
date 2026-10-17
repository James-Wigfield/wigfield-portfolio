import SceneSetup from './SceneSetup';
import SceneWand from './SceneWand';
import SceneScreen from './SceneScreen';
import SceneGrinder from './SceneGrinder';
import SceneBasketSoak from './SceneBasketSoak';
import SceneDescale from './SceneDescale';
import SceneFilter from './SceneFilter';
import SceneCleanCycle from './SceneCleanCycle';
import SceneFinish from './SceneFinish';

/* ============================================================================
   BARISTA · STEP SCENE — which scene (and which part of it) each step shows
   ========================================================================== */

export default function StepScene({ scene, live, vars, complete }) {
  switch (scene) {
    case 'setup':
      return <SceneSetup />;
    case 'wand-wrap':
      return <SceneWand part="wrap" live={live} />;
    case 'tip-off':
      return <SceneWand part="off" />;
    case 'tip-on':
      return <SceneWand part="on" />;
    case 'screen':
      return <SceneScreen />;
    case 'grinder':
      return <SceneGrinder part="grinder" />;
    case 'tamp':
      return <SceneGrinder part="tamp" />;
    case 'soak-start':
      return <SceneBasketSoak part="start" live={live} />;
    case 'soak-finish':
      return <SceneBasketSoak part="finish" />;
    case 'descale-setup':
      return <SceneDescale part="setup" />;
    case 'descale-rounds':
      return <SceneDescale part="rounds" live={live} />;
    case 'descale-rinse':
      return <SceneDescale part="rinse" live={live} />;
    case 'filter':
      return <SceneFilter month={vars?.MONTH} live={live} />;
    case 'cycle':
      return <SceneCleanCycle part="cycle" live={live} />;
    case 'cycle-rinse':
      return <SceneCleanCycle part="rinse" />;
    case 'finish':
      return <SceneFinish complete={complete} />;
    default:
      return null;
  }
}
