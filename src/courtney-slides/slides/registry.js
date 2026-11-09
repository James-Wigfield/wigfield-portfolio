import { TitleSlide, TodaySlide, WhySlide } from './intro';
import { ClinicalSlide, RemodelSlide, SpectrumSlide, SystemsSlide } from './ageing';
import './slides.css';
import './ageing.css';
import { Guide65Slide, OsteoSlide } from './guidelines';
import './guidelines.css';
import { BalanceSlide, ClassSlide, CompareSlide, ProgressSlide, TargetsSlide } from './ger360';
import './ger360.css';
import { AdditionsSlide, EvidenceSlide, LeversSlide, MechanismSlide } from './evidence';
import { ConclusionSlide, RefsSlide } from './close';
import './evidence.css';

/* ============================================================================
   The deck, in order. `beats` comes from each slide's own timeline config
   (one beat = one click). `chapter` indexes CHAPTERS for the frame kicker.
   ========================================================================== */

export const TITLE = 'Building Stronger Bones · GER360';

export const CHAPTERS = ['Introduction', 'Ageing & bone', 'Guidelines', 'GER360', 'Evidence & ideas', 'Close'];

const S = (id, chapter, Comp, title) => ({ id, chapter, Comp, title, beats: Comp.beats });

export const SLIDES = [
  S('title', 0, TitleSlide, 'Building Stronger Bones'),
  S('why', 0, WhySlide, 'Why does this matter?'),
  S('today', 0, TodaySlide, 'Today'),
  S('systems', 1, SystemsSlide, 'What happens as we age'),
  S('remodel', 1, RemodelSlide, 'Bone is living tissue'),
  S('spectrum', 1, SpectrumSlide, 'When loss outpaces formation'),
  S('clinical', 1, ClinicalSlide, 'Why this matters clinically'),
  S('guide65', 2, Guide65Slide, 'Guidelines: adults 65+'),
  S('osteo', 2, OsteoSlide, 'Guidelines: low bone density'),
  S('targets', 3, TargetsSlide, 'An effective class targets function'),
  S('balance', 3, BalanceSlide, 'Balance work has to challenge balance'),
  S('progress', 3, ProgressSlide, 'Progress it, individually'),
  S('class', 3, ClassSlide, 'GER360 today'),
  S('compare', 3, CompareSlide, 'How does GER360 compare?'),
  S('mechanism', 4, MechanismSlide, 'Bone responds to load'),
  S('evidence', 4, EvidenceSlide, 'What the evidence says'),
  S('levers', 4, LeversSlide, 'Two ways to prevent a fragility fracture'),
  S('additions', 4, AdditionsSlide, 'Small additions, not a redesign'),
  S('conclusion', 5, ConclusionSlide, 'Building on a strong foundation'),
  S('refs', 5, RefsSlide, 'References'),
];
