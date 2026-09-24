/* ============================================================================
   RSVP PAPERS — reader settings + progress mirror (localStorage)
   ----------------------------------------------------------------------------
   Settings are per browser (not per paper). Progress is saved per paper on the
   server (papers.progress via the Worker) AND mirrored here so a resume is
   instant and survives a Worker-less `vite` dev session.
   ========================================================================== */

export const SETTINGS_KEY = 'rsvp:settings';
export const PROGRESS_KEY = (id) => `rsvp:progress:${id}`;

export const DEFAULT_SETTINGS = {
  wpm: 320,
  intensity: 1,          // 0 flat · 0.5 light · 1 normal · 1.5 strong
  cardSeconds: 0,        // 0 = pause cards stop; n = auto-continue after n s
  headingMode: 'auto',   // 'auto' | 'stop'
  autoAppendix: false,   // continue into the appendix without stopping
  fontScale: 1,          // 0.85 | 1 | 1.2
  showContext: 'paused', // 'paused' (only while paused) | 'always' (read along) | 'off'
};

export const WPM_MIN = 150;
export const WPM_MAX = 1200;
export const WPM_STEP = 25;

export const INTENSITY_OPTIONS = [
  { value: 0, label: 'Off' },
  { value: 0.5, label: 'Light' },
  { value: 1, label: 'Normal' },
  { value: 1.5, label: 'Strong' },
];
export const CARD_OPTIONS = [
  { value: 0, label: 'Pause' },
  { value: 3, label: '3 s' },
  { value: 6, label: '6 s' },
  { value: 10, label: '10 s' },
];
export const FONT_OPTIONS = [
  { value: 0.85, label: 'S' },
  { value: 1, label: 'M' },
  { value: 1.2, label: 'L' },
];
export const CONTEXT_OPTIONS = [
  { value: 'paused', label: 'Paused' },
  { value: 'always', label: 'Always' },
  { value: 'off', label: 'Off' },
];

export function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    const saved = raw ? JSON.parse(raw) : {};
    const s = { ...DEFAULT_SETTINGS, ...saved };
    s.wpm = clampWpm(s.wpm);
    // showContext used to be a boolean (true = while paused).
    if (s.showContext === true) s.showContext = 'paused';
    else if (s.showContext === false) s.showContext = 'off';
    else if (!CONTEXT_OPTIONS.some((o) => o.value === s.showContext)) s.showContext = DEFAULT_SETTINGS.showContext;
    return s;
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

// Minutes at the chosen speed, allowing ~25% for the automatic slowdowns.
export const estimateMinutes = (words, wpm) => Math.max(1, Math.round((words / Math.max(100, wpm || 300)) * 1.25));

export function clampWpm(v) {
  const n = Math.round(Number(v) || DEFAULT_SETTINGS.wpm);
  return Math.min(WPM_MAX, Math.max(WPM_MIN, n));
}

export function loadLocalProgress(id) {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY(id));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveLocalProgress(id, progress) {
  try { localStorage.setItem(PROGRESS_KEY(id), JSON.stringify(progress)); } catch { /* ignore */ }
}

/** Pick the fresher of the server and local copies. */
export function newerProgress(a, b) {
  if (!a) return b || null;
  if (!b) return a;
  return new Date(b.updatedAt || 0) > new Date(a.updatedAt || 0) ? b : a;
}
