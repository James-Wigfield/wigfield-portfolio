/* ============================================================================
   PORTAL — MODULE REGISTRY
   ----------------------------------------------------------------------------
   The portal renders one tab per entry in this array. To add a NEW tool to the
   portal you do exactly two things — nothing in the layout changes:

     1. Create a component file, e.g. ./modules/MyTool.jsx
            export default function MyTool() { return <div className="pt-module">…</div>; }
     2. Add one entry below:
            { id: 'mytool', label: 'My Tool', icon: '✦', accent: 'amber', component: MyTool }

   Fields:
     id        unique slug (used for the active-tab key)
     label     tab text
     icon      emoji / glyph shown in the tab
     accent    theme colour token: cyan | violet | emerald | rose | amber
     component the React component to render in the content area
   ========================================================================== */

import Overview from './modules/Overview';
import HonoursTracker from './modules/HonoursTracker';

export const MODULES = [
  {
    id: 'overview',
    label: 'Overview',
    icon: '◎',
    accent: 'cyan',
    component: Overview,
  },
  {
    id: 'honours-tracker',
    label: 'Honours Tracker',
    icon: '⬡',
    accent: 'rose',
    component: HonoursTracker,
  },
  // ⬇ drop new tools here — no other file needs to change.
];
