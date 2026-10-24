/* The Play beat's labs, by the keys sections.js lists in `play`. */
import { PerceptronLab, XorLab } from './labsPerceptron';
import { BackpropLab, ActivationsLab } from './labsMlp';
import { HeadsLab, LrSweepLab } from './labsHeads';
import { SeqModelLab, ApisLab } from './labsKeras';
import { ShootoutLab, BatchNormLab, ClipLab, SchedulesLab, PenaltiesLab, DropoutLab } from './labsL2b';

export const LABS = {
  perceptron: PerceptronLab, // §1.2
  xor: XorLab,
  backprop: BackpropLab, // §1.3
  activations: ActivationsLab,
  heads: HeadsLab, // §1.4
  seqModel: SeqModelLab, // §1.5
  apis: ApisLab, // §1.6
  lrSweep: LrSweepLab, // §1.8
  shootout: ShootoutLab, // §2.2
  batchNorm: BatchNormLab, // §2.3
  clip: ClipLab, // §2.4
  schedules: SchedulesLab, // §2.7
  penalties: PenaltiesLab, // §2.8
  dropout: DropoutLab,
};
