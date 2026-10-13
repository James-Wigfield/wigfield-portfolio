/* ============================================================================
   SEMINAR DECKS — useDeck: the talk's position, keys and window sync
   ----------------------------------------------------------------------------
   One hook holds { index, step, black, ver, dir } for a deck sequence.
   Keys (when `keys` is on, one window listener only, ignored while typing):
     Right, Space, PageDown   next build step or slide (clickers send PageDown)
     Left, PageUp             back
     Home, End                first / last slide
     digits then Enter        jump to that slide (past the main slides: backups)
     B or .                   blackout
     F                        full screen (handled by the caller via onFullscreen)
     Esc                      leave (onExit)
   `dir` says how the current step was entered (forward, backward, jump) so a
   clip plays when entered forward and shows its hold when entered backward.
   ========================================================================== */

import { useCallback, useEffect, useRef, useState } from 'react';
import { clampPos, indexFromLabel, nextPos, prevPos } from './controller';
import { createSync } from './sync';

const isTyping = (t) => {
  if (!t) return false;
  const tag = t.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable;
};

export function useDeck(seq, {
  slug,
  initialIndex = 0,
  initialStep = 0,
  keys = true,
  syncOn = false,
  onExit,
  onFullscreen,
  onChange,
} = {}) {
  const [pos, setPos] = useState(() => ({
    ...clampPos(seq, initialIndex, initialStep), black: false, ver: 0, dir: 'jump',
  }));
  const [typed, setTyped] = useState('');
  const posRef = useRef(pos);
  const syncRef = useRef(null);
  const typedRef = useRef('');
  const cbRef = useRef({ onExit, onFullscreen, onChange });

  useEffect(() => {
    posRef.current = pos;
  }, [pos]);
  useEffect(() => {
    cbRef.current = { onExit, onFullscreen, onChange };
  }, [onExit, onFullscreen, onChange]);

  const commit = useCallback((next, { broadcast = true } = {}) => {
    const cur = posRef.current;
    const ver = Math.max(cur.ver + 1, Date.now());
    const n = { ...cur, ...next, ver };
    posRef.current = n;
    setPos(n);
    if (broadcast) syncRef.current?.send({ type: 'state', state: n });
    cbRef.current.onChange?.(n);
  }, []);

  const next = useCallback(() => {
    const cur = posRef.current;
    if (cur.black) return commit({ black: false });
    const p = nextPos(seq, cur);
    if (p.index === cur.index && p.step === cur.step) return undefined;
    return commit({ ...p, dir: 'forward' });
  }, [seq, commit]);

  const prev = useCallback(() => {
    const cur = posRef.current;
    if (cur.black) return commit({ black: false });
    const p = prevPos(seq, cur);
    if (p.index === cur.index && p.step === cur.step) return undefined;
    return commit({ ...p, dir: 'backward' });
  }, [seq, commit]);

  const go = useCallback((index, step = 0, dir = 'jump') => {
    commit({ ...clampPos(seq, index, step), dir, black: false });
  }, [seq, commit]);

  const toggleBlack = useCallback(() => commit({ black: !posRef.current.black }), [commit]);

  // Window sync: adopt any newer state; answer a newcomer's hello with ours.
  useEffect(() => {
    if (!syncOn || !slug) return undefined;
    const s = createSync(slug, (msg) => {
      if (msg.type === 'state' && msg.state && msg.state.ver > posRef.current.ver) {
        const n = { ...msg.state, ...clampPos(seq, msg.state.index, msg.state.step) };
        posRef.current = n;
        setPos(n);
        cbRef.current.onChange?.(n);
      } else if (msg.type === 'hello') {
        s.send({ type: 'state', state: posRef.current });
      }
    });
    syncRef.current = s;
    s.send({ type: 'hello' });
    return () => {
      s.close();
      if (syncRef.current === s) syncRef.current = null;
    };
  }, [syncOn, slug, seq]);

  // Keys: one listener on the window for this controller.
  useEffect(() => {
    if (!keys) return undefined;
    const onKey = (e) => {
      if (isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key;
      if (/^[0-9]$/.test(k)) {
        typedRef.current = (typedRef.current + k).slice(-3);
        setTyped(typedRef.current);
        e.preventDefault();
        return;
      }
      if (k === 'Enter' && typedRef.current) {
        const i = indexFromLabel(seq, typedRef.current);
        typedRef.current = '';
        setTyped('');
        if (i >= 0) go(i, 0, 'jump');
        e.preventDefault();
        return;
      }
      if (typedRef.current && k !== 'Shift') {
        typedRef.current = '';
        setTyped('');
      }
      switch (k) {
        case 'ArrowRight':
        case 'PageDown':
        case ' ':
        case 'Spacebar':
          e.preventDefault();
          next();
          break;
        case 'ArrowLeft':
        case 'PageUp':
          e.preventDefault();
          prev();
          break;
        case 'Home':
          e.preventDefault();
          go(0, 0, 'jump');
          break;
        case 'End':
          e.preventDefault();
          go(seq.findLastIndex((s) => s.kind !== 'backup'), 0, 'jump');
          break;
        case 'b':
        case 'B':
        case '.':
          e.preventDefault();
          toggleBlack();
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          cbRef.current.onFullscreen?.();
          break;
        case 'Escape':
          if (!document.fullscreenElement) cbRef.current.onExit?.();
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [keys, seq, next, prev, go, toggleBlack]);

  return { pos, typed, next, prev, go, toggleBlack, send: (m) => syncRef.current?.send(m), syncRef };
}
