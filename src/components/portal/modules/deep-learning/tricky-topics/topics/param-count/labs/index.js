/* Topic 1's labs by key (topic.js names them in hero, steps' play, drill). */
import { ParamHero } from './ParamHero';
import { LoomLab } from './LoomLab';
import { StackLab } from './StackLab';
import { DiagramLab } from './DiagramLab';
import { WideDeepLab } from './WideDeepLab';
import { NormLab } from './NormLab';
import { BrickLab } from './BrickLab';
import { CnnLab } from './CnnLab';
import { UnrollLab } from './UnrollLab';
import { GatesLab } from './GatesLab';
import { TiedLab } from './TiedLab';
import { FreezeLab } from './FreezeLab';
import { DisguiseLab } from './DisguiseLab';
import { ParamDrill } from './ParamDrill';

export const LABS = {
  hero: ParamHero,
  loom: LoomLab, // 1
  stack: StackLab, // 2
  diagram: DiagramLab, // 3
  widedeep: WideDeepLab, // 4
  norm: NormLab, // 5
  brick: BrickLab, // 6
  cnn: CnnLab, // 7
  unroll: UnrollLab, // 8
  gates: GatesLab, // 9
  tied: TiedLab, // 10
  freeze: FreezeLab, // 11
  disguise: DisguiseLab, // 12
  drill: ParamDrill,
};
