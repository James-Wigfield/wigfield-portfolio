import { useCallback, useEffect, useRef, useState } from 'react';

/* ============================================================================
   Deck position: { i: slide index, b: beat }. Kept in the URL hash (#7 or
   #7.2, both 1-based) and mirrored to any other window of the deck (the
   presenter view) over a BroadcastChannel. Remote moves are applied without
   being echoed back.
   ========================================================================== */

const CHANNEL = 'courtney-slides';
// One id per window (module scope, so render stays pure).
const ME = Math.random().toString(36).slice(2);

function readHash(slides) {
  const m = /^#(\d+)(?:\.(\d+))?$/.exec(window.location.hash || '');
  if (!m) return { i: 0, b: 0 };
  const i = Math.min(slides.length - 1, Math.max(0, Number(m[1]) - 1));
  const b = Math.min(slides[i].beats - 1, Math.max(0, Number(m[2] || 1) - 1));
  return { i, b };
}

export function useDeck(slides, { writeHash = true } = {}) {
  const [pos, setPos] = useState(() => ({ ...readHash(slides), src: 'init' }));
  const chan = useRef(null);

  const go = useCallback((i, b = 0) => {
    const ii = Math.min(slides.length - 1, Math.max(0, i));
    const bb = Math.min(slides[ii].beats - 1, Math.max(0, b));
    setPos({ i: ii, b: bb, src: 'local' });
  }, [slides]);

  const next = useCallback(() => {
    setPos((p) => {
      if (p.b < slides[p.i].beats - 1) return { i: p.i, b: p.b + 1, src: 'local' };
      if (p.i < slides.length - 1) return { i: p.i + 1, b: 0, src: 'local' };
      return p;
    });
  }, [slides]);

  const prev = useCallback(() => {
    setPos((p) => {
      if (p.b > 0) return { i: p.i, b: p.b - 1, src: 'local' };
      if (p.i > 0) return { i: p.i - 1, b: slides[p.i - 1].beats - 1, src: 'local' };
      return p;
    });
  }, [slides]);

  // someone edits the hash by hand (our own writes use replaceState, which doesn't fire this)
  useEffect(() => {
    const onHash = () => setPos({ ...readHash(slides), src: 'local' });
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [slides]);

  // channel
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return undefined;
    const c = new BroadcastChannel(CHANNEL);
    chan.current = c;
    c.onmessage = (ev) => {
      const d = ev.data || {};
      if (d.from === ME) return;
      if (d.type === 'pos') setPos({ i: d.i, b: d.b, src: 'remote' });
      if (d.type === 'hello') setPos((p) => ({ ...p, src: 'announce' }));
    };
    c.postMessage({ type: 'hello', from: ME });
    return () => {
      c.close();
      chan.current = null;
    };
  }, []);

  useEffect(() => {
    if (pos.src === 'remote' || pos.src === 'init') return;
    chan.current?.postMessage({ type: 'pos', i: pos.i, b: pos.b, from: ME });
  }, [pos]);

  useEffect(() => {
    if (!writeHash) return;
    const h = `#${pos.i + 1}${pos.b > 0 ? `.${pos.b + 1}` : ''}`;
    if (window.location.hash !== h) window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${h}`);
  }, [pos, writeHash]);

  return { pos, go, next, prev };
}

/** True after `ms` without pointer movement (hides the controls while presenting). */
export function useIdle(ms = 2600) {
  const [idle, setIdle] = useState(false);
  useEffect(() => {
    let t = 0;
    const wake = () => {
      setIdle(false);
      window.clearTimeout(t);
      t = window.setTimeout(() => setIdle(true), ms);
    };
    wake();
    window.addEventListener('pointermove', wake);
    window.addEventListener('pointerdown', wake);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('pointermove', wake);
      window.removeEventListener('pointerdown', wake);
    };
  }, [ms]);
  return idle;
}

/** Page takeover: title, robots noindex, dark browser chrome, no site scrollbar. */
export function usePage(title) {
  useEffect(() => {
    const html = document.documentElement;
    html.classList.add('cs-active');
    const prevTitle = document.title;
    document.title = title;
    const robots = document.createElement('meta');
    robots.name = 'robots';
    robots.content = 'noindex, nofollow';
    document.head.appendChild(robots);
    return () => {
      html.classList.remove('cs-active');
      document.title = prevTitle;
      robots.remove();
    };
  }, [title]);
}
