/* ============================================================================
   DEV SETUP — every word and number on the page.
   Facts were read off the PC on 2026-11-10 (read-only): display modes via
   EnumDisplaySettings, window rects via EnumWindows, Logi Options+ settings.db,
   PowerToys + Windows Terminal JSON, ~/.claude/projects transcripts (30 days).
   Cols × rows are computed from Cascadia Mono metrics (cell 9×19 px at 12 pt,
   8×17 px at 10.5 pt) — treat them as ±1.
   ========================================================================== */

export const TABS = [
  { id: 'now', label: 'What I found' },
  { id: 'layout', label: 'Screen layout' },
  { id: 'launch', label: 'Start dev' },
  { id: 'mouse', label: 'Mouse' },
  { id: 'terminal', label: 'Terminal look' },
  { id: 'order', label: 'Setup order' },
];

/* ── 01 findings ─────────────────────────────────────────────────────────── */
export const FACTS = [
  {
    k: 'Monitors',
    v: '2 × Gigabyte GS32QCA · 2560×1440 · 100 % scaling · 180 Hz',
    note: 'Taskbar on both, so each has a 2560×1392 work area. ~93 PPI.',
  },
  {
    k: 'Primary',
    v: 'The terminal monitor (DISPLAY1), which Windows places on the right',
    note: 'You described the terminals as being on the left. Check Settings › Display › Identify. Every plan below follows the Windows arrangement.',
    tone: 'maybe',
  },
  {
    k: 'Mouse',
    v: 'MX Master 4 (Bolt + Bluetooth), Logi Options+ 2.9',
    note: 'One global profile, no per-app profiles, everything at default.',
  },
  {
    k: 'PowerToys',
    v: '0.102.3 Preview installed, but not running',
    note: '“Run at startup” is off, so FancyZones is enabled but asleep. Workspaces is turned off.',
    tone: 'maybe',
  },
  {
    k: 'Terminal',
    v: 'Windows Terminal 1.24, settings.json never edited',
    note: 'Cascadia Mono 12 pt, Campbell, 8 px padding, Windows PowerShell 5.1. The conda hook in profile.ps1 adds the (base) prompt.',
  },
  {
    k: 'Shell start',
    v: '1.49 s with the conda hook, 0.14 s without',
    note: 'Measured. Every new pane pays this once.',
  },
  {
    k: 'Claude Code',
    v: '5 sessions open now, all claude --dangerously-skip-permissions',
    note: '119 sessions in 30 days. Peak 5 at once, typical daily peak 3.',
  },
  {
    k: 'VS Code',
    v: '1.145 · 3 windows (portara-repo, usa-trip, wigfield-portfolio)',
    note: 'Each 1934 px wide, which is 76 % of a monitor, used for browsing folders.',
  },
  {
    k: 'Chrome',
    v: '157 · 7 profiles, last used “Profile 3” (James)',
    note: 'Starts in the background at login. Maximised underneath VS Code.',
  },
];

// sessions per project, last 30 days (from ~/.claude/projects)
export const PROJECTS = [
  { name: 'wigfield-portfolio', n: 42 },
  { name: 'honours-dissertation', n: 34 },
  { name: 'portara-repo', n: 20 },
  { name: 'cits5017-project-two', n: 8 },
  { name: 'usa-trip', n: 7 },
  { name: 'Mamba_PSMA', n: 6 },
];

/* ── 02 layouts (monitor-local px; work area 2560×1392, taskbar below) ───── */
// role: claude | code | web | under (window hidden behind another)
const grid = (cols, rows, w0 = 0, wTotal = 2560, sub = '') => {
  const out = [];
  const w = wTotal / cols;
  const h = 1392 / rows;
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      out.push({ x: w0 + c * w, y: r * h, w, h, role: 'claude', label: `${r * cols + c + 1}`, sub });
    }
  }
  return out;
};

export const LAYOUTS = {
  today: {
    name: 'Today',
    left: [
      { x: 0, y: 0, w: 2560, h: 1392, role: 'under', label: 'Chrome (maximised underneath)', sub: '' },
      { x: 0, y: 0, w: 1934, h: 1392, role: 'code', label: 'VS Code ×3', sub: 'stacked · 1934 px each' },
      { x: 1913, y: 0, w: 647, h: 1392, role: 'claude', label: '5', sub: '68×70' },
    ],
    right: [
      { x: 0, y: 0, w: 640, h: 1392, role: 'claude', label: '1', sub: '68×70' },
      { x: 640, y: 0, w: 640, h: 1392, role: 'claude', label: '2', sub: '68×70' },
      { x: 1280, y: 0, w: 640, h: 1392, role: 'claude', label: '3', sub: '68×70' },
      { x: 1920, y: 0, w: 640, h: 1392, role: 'claude', label: '4', sub: '68×70' },
    ],
    stats: [
      ['Claude sessions', '5'],
      ['Each session', '≈ 68 × 70 at 12 pt'],
      ['Chrome', 'no home, stacked'],
      ['VS Code', '1934 px × 3'],
    ],
  },
  a: {
    name: 'A · Terminal wall',
    left: [
      { x: 0, y: 0, w: 560, h: 1392, role: 'code', label: 'VS Code', sub: '560 px' },
      { x: 560, y: 0, w: 2000, h: 1392, role: 'web', label: 'Chrome', sub: '2000 px · DevTools fit docked' },
    ],
    right: grid(3, 2, 0, 2560, '≈105×39'),
    stats: [
      ['Claude sessions', '6'],
      ['Each session', '≈ 105 × 39 at 10.5 pt'],
      ['Chrome', '2000 px, always visible'],
      ['VS Code', '560 px, one window'],
    ],
  },
  b: {
    name: 'B · Max sessions',
    left: [
      { x: 0, y: 0, w: 480, h: 1392, role: 'code', label: 'VS Code', sub: '480 px' },
      { x: 480, y: 0, w: 1440, h: 1392, role: 'web', label: 'Chrome', sub: '1440 px' },
      { x: 1920, y: 0, w: 640, h: 1392, role: 'claude', label: '9', sub: '≈79×79 tall' },
    ],
    right: grid(4, 2, 0, 2560, '≈79×39'),
    stats: [
      ['Claude sessions', '9'],
      ['Each session', '≈ 79 × 39 at 10.5 pt'],
      ['Chrome', '1440 px'],
      ['VS Code', '480 px'],
    ],
  },
};

export const LAYOUT_WHY = [
  ['One terminal window, panes inside it', 'The grid is one Windows Terminal window with 6 panes, so it has one tab row instead of six and one window to place. Alt + arrows moves between sessions, and zoom (Ctrl + Shift + Z) fills the monitor with one pane until you press it again.'],
  ['Chrome against the seam', 'The browser you look at most sits closest to the terminals. VS Code, which you only glance at, goes on the outer curved edge.'],
  ['One VS Code window', 'A multi-root workspace holds portara-repo, wigfield-portfolio and honours-dissertation in one explorer. That replaces three 1934 px windows.'],
  ['10.5 pt instead of 12 pt', 'Today each session has about 68 columns. In the A grid at 10.5 pt each pane has about 105. Turn the thumb wheel to zoom one pane when you need bigger text.'],
];

export const ZONE_STEPS = [
  ['PowerToys › General', 'Turn on Run at startup, then launch PowerToys.'],
  ['FancyZones › settings', 'Turn on Override Windows Snap and Move windows between zones across all monitors. Turn on Move newly created windows to their last known zone.'],
  ['FancyZones › Layout editor (Win + Shift + `)', 'On the side monitor, create a Custom › Canvas layout called “Studio”: 560 | 2000, with spacing 0. Create a second one called “Studio + 1”: 480 | 1440 | 640. Give them quick keys 1 and 2.'],
  ['Terminal monitor', 'Set its layout to No layout. The maximised Terminal window holds the grid.'],
  ['Switch', 'Win + Ctrl + Alt + 1 or 2 swaps the side monitor between A and B.'],
];

export const WORKSPACE_FILE = `{
  "folders": [
    { "path": "business/portara-repo" },
    { "path": "personal-projects/wigfield-portfolio" },
    { "path": "university/cits4010/honours-dissertation" }
  ],
  "settings": {
    "workbench.activityBar.location": "top",
    "workbench.startupEditor": "none",
    "breadcrumbs.enabled": false,
    "editor.minimap.enabled": false
  }
}
`;

/* ── 03 launch ───────────────────────────────────────────────────────────── */
export const LAUNCH_OPTIONS = [
  {
    id: 'script',
    name: 'PowerShell script',
    pick: 'go',
    verdict: 'Recommended',
    good: 'Exact pixels. Builds the pane grid in one wt command, opens each pane in its project folder with claude running, then places VS Code and Chrome. Plain text you can version.',
    bad: 'About 140 lines to look after. Finds the new VS Code and Chrome windows by watching for them to appear.',
  },
  {
    id: 'workspaces',
    name: 'PowerToys Workspaces',
    pick: 'maybe',
    verdict: 'Good for non-dev sets',
    good: 'No code. Snapshot your open windows, then get a desktop shortcut and a hotkey (Win + Ctrl + `, already set).',
    bad: 'It reopens apps. It doesn’t build panes or run claude in each folder, so every terminal needs hand-typed arguments. Terminal runs all its windows in one process, which makes per-window placement less dependable.',
  },
  {
    id: 'startup',
    name: 'Terminal startupActions',
    pick: 'later',
    verdict: 'Terminals only',
    good: 'One line in settings.json makes every new Terminal window open the grid.',
    bad: 'It doesn’t handle VS Code or Chrome, and it fires on every Terminal launch, including one-off shells.',
  },
];

export const TRIGGER_STEPS = [
  ['Save', 'Save the script to Documents\\dev-tools\\start-dev.ps1, and the workspace file to Documents\\dev.code-workspace.'],
  ['Test', 'From any shell, run powershell -ExecutionPolicy Bypass -File start-dev.ps1 and check where each window lands.'],
  ['Shortcut', 'Start menu › Programs › New shortcut, named “Start Dev”. Target: powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "C:\\Users\\james\\Documents\\dev-tools\\start-dev.ps1"'],
  ['Hotkey', 'In the shortcut’s Properties › Shortcut key, set Ctrl + Alt + D. Make a second shortcut ending in -Max with Ctrl + Alt + Shift + D.'],
  ['Mouse', 'In Logi Options+, set a Keyboard shortcut action to Ctrl + Alt + D (see the Mouse tab).'],
];

/* ── 04 mouse ────────────────────────────────────────────────────────────── */
// Controls in the order they appear on the drawing.
export const CONTROLS = [
  { id: 'gesture', name: 'Gesture button', where: 'the small button above the thumb panel', now: 'Task View · hold + ← / → switch desktop · ↑ Start · ↓ desktop' },
  { id: 'panel', name: 'Haptic Sense Panel', where: 'thumb rest', now: 'Actions Ring: cut, copy, paste, back, forward, undo, redo, folder' },
  { id: 'thumbwheel', name: 'Thumb wheel', where: '', now: 'Horizontal scroll' },
  { id: 'backfwd', name: 'Back / Forward', where: '', now: 'Back / Forward' },
  { id: 'top', name: 'Top button', where: 'behind the scroll wheel', now: 'SmartShift (ratchet ↔ free spin)' },
];

// columns: Everywhere · Terminal · Chrome · VS Code. `same` = inherits Everywhere.
export const MAPPINGS = [
  {
    control: 'Gesture · click',
    all: 'Switch apps (Alt + Tab)',
    term: 'Zoom pane (Ctrl + Shift + Z)',
    chrome: 'same',
    code: 'same',
  },
  {
    control: 'Gesture · hold ← / →',
    all: 'Move window one zone (Win + ← / →)',
    term: 'Previous / next pane (Alt + ← / →)',
    chrome: 'Previous / next tab (Ctrl + Shift + Tab / Ctrl + Tab)',
    code: 'Previous / next editor (Ctrl + PgUp / PgDn)',
  },
  {
    control: 'Gesture · hold ↑ / ↓',
    all: 'Next window in zone (Win + PgDn) / Desktop (Win + D)',
    term: 'Pane above / below (Alt + ↑ / ↓)',
    chrome: 'Reopen tab (Ctrl + Shift + T) / Close tab (Ctrl + W)',
    code: 'same',
  },
  {
    control: 'Haptic panel · ring',
    all: 'Start dev (Ctrl + Alt + D) · Start dev max (Ctrl + Alt + Shift + D) · Snip (Win + Shift + S) · Copy · Paste · Undo',
    term: 'adds Interrupt (Esc) · Plan mode (Shift + Tab) · Paste image (Alt + V)',
    chrome: 'adds DevTools (F12) · Hard reload (Ctrl + Shift + R)',
    code: 'adds Reveal in File Explorer (Shift + Alt + R)',
  },
  {
    control: 'Thumb wheel',
    all: 'Horizontal scroll (keep)',
    term: 'Zoom (font size of the focused pane)',
    chrome: 'Tab navigation',
    code: 'same',
  },
  {
    control: 'Back / Forward',
    all: 'Back / Forward (keep)',
    term: 'Esc (stop Claude) / Shift + Tab (cycle mode)',
    chrome: 'same',
    code: 'same',
  },
  {
    control: 'Top button',
    all: 'SmartShift (keep, free spin helps in long transcripts)',
    term: 'same',
    chrome: 'same',
    code: 'same',
  },
];

export const LOGI_STEPS = [
  ['Open', 'Open Logi Options+ › MX Master 4. Leave All applications selected.'],
  ['Gesture button', 'Click it › Gestures › Custom. Set Click to Switch applications. For Left, Right, Up and Down, use Keyboard shortcut and press Win + ←, Win + →, Win + PgDn and Win + D.'],
  ['Actions Ring', 'Click the thumb panel › Actions Ring › Edit. Replace Cut, Back, Forward and Redo with Keyboard shortcut actions named Start dev, Start dev max and Snip.'],
  ['Per-app profiles', 'Click All applications at the top › + Add application. Add Terminal (WindowsTerminal.exe), Google Chrome and Visual Studio Code. Now each control has a separate tab for each app.'],
  ['Fill the columns', 'Pick an app, click a control, and set the actions in that app’s column of the table above. Anything you don’t change stays as it is under All applications.'],
  ['Feel', 'Keep gesture haptics on (60 % now). A tick confirms each swipe, so you can move between panes without looking.'],
];

/* ── 05 terminal looks ───────────────────────────────────────────────────── */
export const LOOKS = [
  {
    id: 'mocha',
    name: 'Mocha',
    pick: 'go',
    blurb: 'Catppuccin Mocha. Soft, high contrast, easy on the eyes for long sessions. Needs a custom scheme block.',
    bg: '#1e1e2e', fg: '#cdd6f4', dim: '#6c7086', accent: '#cba6f7', ok: '#a6e3a1', warn: '#f9e2af', err: '#f38ba8', link: '#89b4fa', glass: false,
    scheme: `{
  "name": "Catppuccin Mocha",
  "background": "#1E1E2E", "foreground": "#CDD6F4",
  "cursorColor": "#F5E0DC", "selectionBackground": "#585B70",
  "black": "#45475A", "red": "#F38BA8", "green": "#A6E3A1", "yellow": "#F9E2AF",
  "blue": "#89B4FA", "purple": "#F5C2E7", "cyan": "#94E2D5", "white": "#BAC2DE",
  "brightBlack": "#585B70", "brightRed": "#F38BA8", "brightGreen": "#A6E3A1", "brightYellow": "#F9E2AF",
  "brightBlue": "#89B4FA", "brightPurple": "#F5C2E7", "brightCyan": "#94E2D5", "brightWhite": "#A6ADC8"
}`,
    unfocused: '#181825',
  },
  {
    id: 'onehalf',
    name: 'One Half Dark',
    pick: 'maybe',
    blurb: 'Built into Terminal, so there’s nothing to paste except the scheme name. Neutral grey.',
    bg: '#282c34', fg: '#dcdfe4', dim: '#5a6374', accent: '#c678dd', ok: '#98c379', warn: '#e5c07b', err: '#e06c75', link: '#61afef', glass: false,
    scheme: null,
    unfocused: '#21252b',
  },
  {
    id: 'glass',
    name: 'Glass',
    pick: 'later',
    blurb: 'Built-in Dark+ with acrylic at 85 % so your wallpaper shows through. Looks great, but it’s harder to read with 6 panes. Best kept for the single tall pane.',
    bg: '#1e1e1e', fg: '#cccccc', dim: '#6a6a6a', accent: '#c586c0', ok: '#6a9955', warn: '#dcdcaa', err: '#f44747', link: '#569cd6', glass: true,
    scheme: null,
    unfocused: null,
  },
];

export const TWEAKS = [
  { what: 'Font size 12 → 10.5 pt', why: 'A pane in the A grid goes from about 91 to about 105 columns and from 34 to 39 rows.', saves: true },
  { what: 'Padding 8 → 4 px', why: 'Adds about one column and one row per pane, with no loss in readability.', saves: true },
  { what: 'Hide the scrollbar', why: 'Adds 2 columns per pane. The mouse wheel still scrolls the transcript.', saves: true },
  { what: 'One window, compact tabs', why: 'The grid shares one tab row. tabWidthMode compact keeps it short.', saves: true },
  { what: 'Focus mode (optional)', why: 'Running wt --focus hides the tab row as well, which adds about 2 rows per pane row. You lose the drag handle, but the script places the window.', saves: true },
  { what: 'Dim inactive panes', why: 'unfocusedAppearance gives the other 5 panes a slightly darker background, so you can see which session has the keyboard.', saves: false },
  { what: 'Cascadia Mono, not a Nerd Font', why: 'Claude Code needs no icon glyphs. Get a Nerd Font (CaskaydiaCove NF) only if you also install a prompt theme.', saves: false },
  { what: 'Prompt theme: skip for now', why: 'Each pane starts claude straight away, so the (base) PS prompt is barely visible. Oh My Posh would cost startup time for little visible change.', saves: false },
  { what: 'Faster panes (optional)', why: 'The conda hook adds about 1.35 s per shell. portara-repo is Node-only, so its panes could use powershell -NoProfile.', saves: false },
];

export const settingsSnippet = (look) => {
  const scheme = look.id === 'mocha' ? 'Catppuccin Mocha' : look.id === 'onehalf' ? 'One Half Dark' : 'Dark+';
  const glass = look.glass ? `,\n      "opacity": 85,\n      "useAcrylic": true` : '';
  const unf = look.unfocused ? `,\n      "unfocusedAppearance": { "background": "${look.unfocused}" }` : '';
  const schemes = look.scheme
    ? `  "schemes": [\n${look.scheme.split('\n').map((l) => `    ${l}`).join('\n')}\n  ],\n`
    : '';
  return `// merge into %LOCALAPPDATA%\\Packages\\Microsoft.WindowsTerminal_8wekyb3d8bbwe\\LocalState\\settings.json
{
  "tabWidthMode": "compact",
  "actions": [
    { "command": "togglePaneZoom", "id": "User.togglePaneZoom" }
  ],
  "keybindings": [
    // keep your four existing entries, then add:
    { "id": "User.togglePaneZoom", "keys": "ctrl+shift+z" }
  ],
  "profiles": {
    "defaults": {
      "font": { "face": "Cascadia Mono", "size": 10.5 },
      "colorScheme": "${scheme}",
      "padding": "4",
      "scrollbarState": "hidden",
      "cursorShape": "bar"${glass}${unf}
    }
  },
${schemes}}
`;
};

/* ── 06 order ────────────────────────────────────────────────────────────── */
export const ORDER = [
  { t: 'Confirm which monitor is primary', d: 'Settings › Display › Identify. The terminal monitor should be primary.', min: 2 },
  { t: 'Back up settings.json', d: 'Copy the Windows Terminal settings.json before editing it.', min: 1 },
  { t: 'Start PowerToys at login', d: 'Then set up FancyZones (Screen layout tab).', min: 10 },
  { t: 'Terminal look + pane zoom key', d: 'Paste the snippet from the Terminal look tab.', min: 5 },
  { t: 'Create dev.code-workspace', d: 'One VS Code window for three repos.', min: 2 },
  { t: 'Save and test start-dev.ps1', d: 'Run it by hand once. Adjust the $Panes folders.', min: 10 },
  { t: 'Start Dev shortcut + Ctrl + Alt + D', d: 'Plus the -Max variant on Ctrl + Alt + Shift + D.', min: 3 },
  { t: 'Logi: global gesture + Actions Ring', d: 'Everywhere column of the Mouse tab.', min: 10 },
  { t: 'Logi: Terminal, Chrome, VS Code profiles', d: 'The other three columns.', min: 15 },
  { t: 'Live with it for a week', d: 'Then decide on A or B and on focus mode.', min: 0 },
];
