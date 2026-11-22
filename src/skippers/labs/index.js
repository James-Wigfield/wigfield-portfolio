/* Lab + custom-view registry: content/levels.js names a lab by key. */
import LightsLab from './LightsLab';
import LightsChallenge from './LightsChallenge';
import GiveWayLab from './GiveWayLab';
import SoundLab from './SoundLab';
import ScheduleLab from './CareLab';
import { AgeLab, SpeedLab } from './RulesLabs';
import { LateralLab, CardinalLab, OtherMarksLab } from './MarksLabs';
import { GearLab, FlareLab } from './GearLabs';
import { FlotationLab, ScopeLab, StabilityLab, CallsLab } from './OpsLabs';
import { Tasks, Scripts } from './Practical';
import Drive from './Drive';

export const LABS = {
  LightsLab, LightsChallenge, GiveWayLab, SoundLab, ScheduleLab, AgeLab, SpeedLab,
  LateralLab, CardinalLab, OtherMarksLab, GearLab, FlareLab, FlotationLab, ScopeLab, StabilityLab, CallsLab,
};

export const VIEWS = { Tasks, Scripts, Drive };
