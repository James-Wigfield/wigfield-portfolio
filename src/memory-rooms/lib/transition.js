/* Page changes as View Transitions (map -> spot: the card's cut-out grows into
   the stage; spot -> walk: a crossfade after the camera dives in). The app's
   router is a plain <BrowserRouter>, which ignores React Router's
   `viewTransition` option (it needs a data router), so the transition is started
   here around a synchronous navigation. Browsers without the API, and an
   unfocused or hidden tab, just navigate. Reduced motion keeps only the
   crossfade (viewer.css turns the named morph off). */

import { flushSync } from 'react-dom';

export function goWithTransition(navigate, to, opts) {
  if (typeof document === 'undefined' || typeof document.startViewTransition !== 'function' || document.visibilityState !== 'visible') {
    navigate(to, opts);
    return;
  }
  try {
    document.startViewTransition(() => {
      flushSync(() => navigate(to, opts));
    });
  } catch {
    navigate(to, opts);
  }
}

/** A link's click: a plain left click goes through the transition; anything else stays a normal link. */
export function transitionClick(navigate, to) {
  return (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    goWithTransition(navigate, to);
  };
}
