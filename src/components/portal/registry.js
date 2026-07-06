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
import MambaUpdates from './modules/MambaUpdates';
import Syllabite from './modules/Syllabite';
import SyllabiteGTM from './modules/SyllabiteGTM';
import SyllabiteFeedback from './modules/SyllabiteFeedback';
import CodebaseTracker from './modules/CodebaseTracker';
import CodebaseWorkspace from './modules/CodebaseWorkspace';
import WallArt from './modules/WallArt';
import PixelGifStudio from './modules/PixelGifStudio';
import PortaraBusinessPlan from './modules/PortaraBusinessPlan';
import BackendSetup from './modules/BackendSetup';
import GifBackend from './modules/GifBackend';
import WorkersDeployPlaybook from './modules/WorkersDeployPlaybook';

// Ordered life-area sections — each may hold zero or more modules.
export const SECTIONS = [
  { name: 'University',  icon: 'university',  blurb: 'Degree, honours & coursework' },
  { name: 'Syllabite',   icon: 'syllabite',   blurb: 'EdTech venture' },
  { name: 'Portara',     icon: 'portara',     blurb: 'Custom portals · MCP · agents' },
  { name: 'Business',    icon: 'business',    blurb: 'Ventures & R&D' },
  { name: 'Personal',    icon: 'personal',    blurb: 'Life, goals & admin' },
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
    id: 'mamba-updates',
    label: 'Mamba Updates',
    icon: 'mamba',
    group: 'University',
    component: MambaUpdates,
  },
  {
    id: 'syllabite',
    label: 'Overview',
    icon: 'syllabite',
    group: 'Syllabite',
    component: Syllabite,
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
