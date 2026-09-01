/* ============================================================================
   PORTAL — MODULE REGISTRY
   ----------------------------------------------------------------------------
   The portal renders one tab per entry in MODULES. The sidebar is organised
   into the fixed life-area SECTIONS below; a module joins a section by setting
   its `group` to that section's name. Adding a NEW tool is two steps — nothing
   in the layout changes:

     1. Create a component file, e.g. ./modules/MyTool.jsx
            export default function MyTool() { return <div className="pt-module">…</div>; }
     2. Add one entry below:
            { id: 'mytool', label: 'My Tool', icon: 'business',
              group: 'Business', component: MyTool }

   Module fields:
     id        unique slug (used for the active-tab key)
     label     tab text
     icon      name of an icon in ./icons.jsx (single-colour SVG — never emoji)
     group     section heading (must match a SECTIONS name). Omit for an
               ungrouped top item (e.g. the Overview).
     system    OPTIONAL — true pins the tool to the "System" utility cluster at
               the bottom of the sidebar, outside the life-area sections.
     component the React component to render in the content area

   SECTIONS is the source of truth for sidebar order + section icons. A section
   with no modules still renders (collapsed-friendly, "no tools yet") so the
   structure is visible and future-proof.
   ========================================================================== */

import Overview from './modules/Overview';
import HonoursTracker from './modules/HonoursTracker';
import BuildFlow from './modules/BuildFlow';
import TrainingReadiness from './modules/TrainingReadiness';
import ModelTraining from './modules/ModelTraining';
import TrainingRuns from './modules/TrainingRuns';
import MetricsTotalSeg from './modules/MetricsTotalSeg';
import Run5Handoff from './modules/Run5Handoff';
import DeepLearningLecture1 from './modules/deep-learning/lecture1/Lecture1';
import DeepLearningLecture2 from './modules/deep-learning/lecture2/Lecture2';
import DeepLearningLecture3 from './modules/deep-learning/lecture3/Lecture3';
import DeepLearningCodeLab from './modules/deep-learning/codelab/CodeLab';
import MambaUpdates from './modules/MambaUpdates';
import HpcSetup from './modules/HpcSetup';
import LossCheck from './modules/LossCheck';
import SelectiveScan from './modules/SelectiveScan';
import ShapeTracer from './modules/ShapeTracer';
import CodeVisualiser from './modules/CodeVisualiser';
import Presentations from './modules/Presentations';
import Syllabite from './modules/Syllabite';
import SyllabitePhase3 from './modules/SyllabitePhase3';
import SyllabiteGTM from './modules/SyllabiteGTM';
import SyllabiteFeedback from './modules/SyllabiteFeedback';
import CodebaseTracker from './modules/CodebaseTracker';
import CodebaseWorkspace from './modules/CodebaseWorkspace';
import VisualiserMcpPlan from './modules/VisualiserMcpPlan';
import WallArt from './modules/WallArt';
import PixelGifStudio from './modules/PixelGifStudio';
import PdReader from './modules/PdReader';
import DeckStudio from './modules/DeckStudio';
import PortaraBusinessPlan from './modules/PortaraBusinessPlan';
import PortaraPricing from './modules/PortaraPricing';
import PortaraPlatform from './modules/PortaraPlatform';
import PortaraMotion from './modules/PortaraMotion';
import AmericaFirstPlan from './modules/america/AmericaFirstPlan';
import BackendSetup from './modules/BackendSetup';
import GifBackend from './modules/GifBackend';
import WorkersDeployPlaybook from './modules/WorkersDeployPlaybook';

// Ordered life-area sections — each may hold zero or more modules.
export const SECTIONS = [
  { name: 'University',  icon: 'university',  blurb: 'Degree, honours & coursework' },
  { name: 'Deep Learning', icon: 'network',   blurb: 'CITS5017 · interactive lectures' },
  { name: 'Syllabite',   icon: 'syllabite',   blurb: 'EdTech venture' },
  { name: 'Portara',     icon: 'portara',     blurb: 'Custom portals · MCP · agents' },
  { name: 'Business',    icon: 'business',    blurb: 'Ventures & R&D' },
  { name: 'Personal',    icon: 'personal',    blurb: 'Life, goals & admin' },
  { name: 'America',     icon: 'compass',     blurb: 'Dec–Jan snow & road trip' },
  { name: 'Investments', icon: 'investments', blurb: 'Portfolio & assets' },
];

export const MODULES = [
  {
    id: 'overview',
    label: 'Overview',
    icon: 'overview',
    component: Overview,
  },
  {
    id: 'honours-tracker',
    label: 'Honours Tracker',
    icon: 'honours',
    group: 'University',
    component: HonoursTracker,
  },
  {
    id: 'build-flow',
    label: 'Build Flow',
    icon: 'workspace',
    group: 'University',
    component: BuildFlow,
  },
  {
    id: 'training-readiness',
    label: 'Training Readiness',
    icon: 'flask',
    group: 'University',
    component: TrainingReadiness,
  },
  {
    id: 'model-training',
    label: 'Model & Training',
    icon: 'cube',
    group: 'University',
    component: ModelTraining,
  },
  {
    id: 'training-runs',
    label: 'Training Runs',
    icon: 'chart',
    group: 'University',
    component: TrainingRuns,
  },
  {
    id: 'metrics-totalseg',
    label: 'Metrics & TotalSeg',
    icon: 'shield',
    group: 'University',
    component: MetricsTotalSeg,
  },
  {
    id: 'run5-handoff',
    label: 'Run 5 Handoff',
    icon: 'compass',
    group: 'University',
    component: Run5Handoff,
  },
  {
    id: 'dl-lecture-1',
    label: 'Lecture 1 · Intro to ANNs',
    icon: 'network',
    group: 'Deep Learning',
    component: DeepLearningLecture1,
  },
  {
    id: 'dl-lecture-2',
    label: 'Lecture 2 · Training DNNs',
    icon: 'network',
    group: 'Deep Learning',
    component: DeepLearningLecture2,
  },
  {
    id: 'dl-lecture-3',
    label: 'Lecture 3 · CNNs',
    icon: 'network',
    group: 'Deep Learning',
    component: DeepLearningLecture3,
  },
  {
    id: 'dl-code-lab',
    label: 'Code Lab · Search',
    icon: 'codebase',
    group: 'Deep Learning',
    component: DeepLearningCodeLab,
  },
  {
    id: 'hpc-setup',
    label: 'HPC Setup',
    icon: 'compass',
    group: 'University',
    component: HpcSetup,
  },
  {
    id: 'mamba-updates',
    label: 'Mamba Updates',
    icon: 'mamba',
    group: 'University',
    component: MambaUpdates,
  },
  {
    id: 'loss-check',
    label: 'Loss Check',
    icon: 'check',
    group: 'University',
    component: LossCheck,
  },
  {
    id: 'selective-scan',
    label: 'Selective Scan',
    icon: 'flask',
    group: 'University',
    component: SelectiveScan,
  },
  {
    id: 'shape-tracer',
    label: 'Shape Tracer',
    icon: 'cube',
    group: 'University',
    component: ShapeTracer,
  },
  {
    id: 'code-visualiser',
    label: 'Code Visualiser',
    icon: 'codebase',
    group: 'University',
    component: CodeVisualiser,
  },
  {
    id: 'presentations',
    label: 'Presentations',
    icon: 'presentation',
    group: 'University',
    component: Presentations,
  },
  {
    id: 'syllabite',
    label: 'Overview',
    icon: 'syllabite',
    group: 'Syllabite',
    component: Syllabite,
  },
  {
    id: 'syllabite-phase3',
    label: 'Phase 3 · Accounts & AI',
    icon: 'flask',
    group: 'Syllabite',
    component: SyllabitePhase3,
  },
  {
    id: 'syllabite-gtm',
    label: 'Go-to-Market',
    icon: 'investments',
    group: 'Syllabite',
    component: SyllabiteGTM,
  },
  {
    id: 'syllabite-feedback',
    label: 'Feedback',
    icon: 'feedback',
    group: 'Syllabite',
    component: SyllabiteFeedback,
  },
  {
    id: 'portara-business-plan',
    label: 'Business Plan',
    icon: 'investments',
    group: 'Portara',
    component: PortaraBusinessPlan,
  },
  {
    id: 'portara-pricing',
    label: 'Pricing Strategy',
    icon: 'business',
    group: 'Portara',
    component: PortaraPricing,
  },
  {
    id: 'portara-platform',
    label: 'Platform Architecture',
    icon: 'cloud',
    group: 'Portara',
    component: PortaraPlatform,
  },
  {
    id: 'portara-motion',
    label: 'Motion Design',
    icon: 'art',
    group: 'Portara',
    component: PortaraMotion,
  },
  {
    id: 'codebase-tracker',
    label: 'Codebase Visualizer',
    icon: 'codebase',
    group: 'Business',
    component: CodebaseTracker,
  },
  {
    id: 'codebase-workspace',
    label: 'Visualizer · Live',
    icon: 'workspace',
    group: 'Business',
    component: CodebaseWorkspace,
  },
  {
    id: 'visualiser-mcp-plan',
    label: 'Visualiser · MCP Plan',
    icon: 'link',
    group: 'Business',
    component: VisualiserMcpPlan,
  },
  {
    id: 'wall-art',
    label: 'Wall Art',
    icon: 'art',
    group: 'Personal',
    component: WallArt,
  },
  {
    id: 'pixel-gif',
    label: 'Pixel-Art GIF Studio',
    icon: 'pixel',
    group: 'Personal',
    component: PixelGifStudio,
  },
  {
    id: 'pd-reader',
    label: 'PD Reader Plan',
    icon: 'eye',
    group: 'Personal',
    component: PdReader,
  },
  {
    id: 'deck-studio',
    label: 'Deck Studio',
    icon: 'deck',
    group: 'Personal',
    component: DeckStudio,
  },
  {
    id: 'america-first-plan',
    label: 'First Plan',
    icon: 'map',
    group: 'America',
    component: AmericaFirstPlan,
  },
  {
    id: 'backend-setup',
    label: 'Backend Setup',
    icon: 'backend',
    system: true,
    component: BackendSetup,
  },
  {
    id: 'gif-backend',
    label: 'GIF → Supabase & MCP',
    icon: 'link',
    system: true,
    component: GifBackend,
  },
  {
    id: 'workers-deploy-playbook',
    label: 'Workers Deploy Playbook',
    icon: 'cloud',
    system: true,
    component: WorkersDeployPlaybook,
  },
  // Drop new tools here — set `group` to a SECTIONS name (no other file changes).
];
