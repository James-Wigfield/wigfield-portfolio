/* The Play beat's labs, by the keys sections.js lists in `play`. */
import { RoadmapLab, OutcomesLab } from './labsIntro';
import { TimelineLab, RlLoopLab } from './labsStory';
import { VacuumLab, GeneticLab } from './labsPolicySearch';
import { CartPoleLab } from './labsCartPole';
import { BasicPolicyLab } from './labsBasic';
import { PolicyNetLab } from './labsPolicyNet';
import { ReturnsLab, AdvantageLab } from './labsReturns';
import { ReinforceLab } from './labsReinforce';
import { YTargetLab, TrainPgLab } from './labsPg';
import { MarkovLab } from './labsMarkov';
import { ValueIterLab } from './labsValueIter';
import { QTableLab } from './labsQValue';
import { TdLab } from './labsTd';
import { QLearningLab, EpsilonLab } from './labsQLearning';
import { ApproxLab } from './labsApprox';
import { ReplayLab, TrainStepLab, EpsScheduleLab } from './labsDqn';
import { DqnCurveLab } from './labsDqnResults';

export const LABS = {
  roadmap: RoadmapLab, // §0
  timeline: TimelineLab, // §1
  rlLoop: RlLoopLab, // §2
  vacuum: VacuumLab, // §3
  genetic: GeneticLab,
  cartpole: CartPoleLab, // §4
  basicPolicy: BasicPolicyLab, // §5
  policyNet: PolicyNetLab, // §6
  returns: ReturnsLab, // §7
  advantage: AdvantageLab,
  reinforce: ReinforceLab, // §8
  yTarget: YTargetLab, // §9
  trainPG: TrainPgLab,
  markov: MarkovLab, // §10
  valueIter: ValueIterLab, // §11
  qTable: QTableLab, // §12
  td: TdLab, // §13
  qLearning: QLearningLab, // §14
  epsilon: EpsilonLab,
  approx: ApproxLab, // §15
  replay: ReplayLab, // §16
  trainStep: TrainStepLab,
  epsSchedule: EpsScheduleLab,
  dqnCurve: DqnCurveLab, // §17
  outcomes: OutcomesLab, // §18
};
