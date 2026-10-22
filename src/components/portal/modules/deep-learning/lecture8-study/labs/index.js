/* The Play beat's labs, by the keys sections.js lists in `play`. */
import { RoadmapLab, OutcomesLab } from './labsIntro';
import { LongPathLab, RightWordLab } from './labsNmt';
import { BiReadersLab } from './labsBiRnn';
import { HorizonLab, StagesLab, EdForecastLab } from './labsBusRail';
import { BeamsLab } from './labsBahdanau';
import { LuongLab } from './labsLuong';
import { SoftLookupLab } from './labsKeras';
import { TransformerMapLab, CodeMapLab, ToyTransformerLab } from './labsTransformer';
import { WaveOrganLab } from './labsPosEnc';
import { FourMovesLab, SaturateLab } from './labsScaled';
import { MultiHeadLab } from './labsMultiHead';
import { MaskLab, SelfCrossLab } from './labsMasking';
import { PatchChopperLab, VisualAttentionLab } from './labsVision';
import { TimelineLab } from './labsBeyond';

export const LABS = {
  roadmap: RoadmapLab, // §0
  longPath: LongPathLab, // §1
  rightWord: RightWordLab,
  biReaders: BiReadersLab, // §2
  horizon: HorizonLab, // §3
  stages: StagesLab, // §4
  edForecast: EdForecastLab, // §5
  beams: BeamsLab, // §6
  luong: LuongLab, // §7
  softLookup: SoftLookupLab, // §8
  transformerMap: TransformerMapLab, // §9
  waveOrgan: WaveOrganLab, // §10
  fourMoves: FourMovesLab, // §11
  saturate: SaturateLab,
  multiHead: MultiHeadLab, // §12
  selfCross: SelfCrossLab, // §13
  mask: MaskLab,
  codeMap: CodeMapLab, // §14
  toyTransformer: ToyTransformerLab,
  patchChopper: PatchChopperLab, // §15
  visualAttention: VisualAttentionLab,
  timeline: TimelineLab, // §16
  outcomes: OutcomesLab, // §17
};
