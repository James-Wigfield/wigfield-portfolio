import { Component, lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Icon from '../../../icons';
import { HOUSES, LECTURE, SCROLLS } from './content/scrolls';
import { summarise, useProgress } from './world/progress';
import '../common.css';
import './game.css';

/* ============================================================================
   SCROLLS OF THE PHILOSOPHER — module entry
   ----------------------------------------------------------------------------
   A thin shell. It owns three things and nothing else:

     1. the lazy boundary — three.js, R3F and drei only download once the
        player presses Begin (Scene.jsx is the chunk), so every other portal
        tab pays nothing for the 3D;
     2. fullscreen — the browser Fullscreen API on the stage wrapper, a corner
        button, Escape leaves it natively, `fullscreenchange` keeps the state
        honest (the R3F canvas resizes itself);
     3. progress — the persisted scroll/door record, handed down to the scene
        and reflected in the editorial strip under the stage.

   All classes `dlg-*`. The page framework (`.dl`) comes from common.css so the
   game agrees with the 2D lectures about tokens and palette.
   ========================================================================== */

const Scene = lazy(() => import('./Scene'));

export default function DeepLearningGame({ onNavigate }) {
  const stageRef = useRef(null);
  const [entered, setEntered] = useState(false);
  const [fs, setFs] = useState(false);
  const [progress, actions] = useProgress();
  const sum = summarise(progress);

  useEffect(() => {
    const onChange = () => setFs(document.fullscreenElement === stageRef.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    const el = stageRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen?.();
    else el.requestFullscreen?.().catch(() => {});
  }, []);

  const openLecture = useCallback(
    (tab) => {
      try {
        if (tab) window.sessionStorage.setItem(`${LECTURE.moduleId}:open`, tab);
      } catch {
        /* optional nicety */
      }
      onNavigate?.(LECTURE.moduleId);
    },
    [onNavigate],
  );

  return (
    <div className="pt-module dl dlg">
      <div ref={stageRef} className={`dlg-stage${fs ? ' dlg-stage--fs' : ''}`}>
        {entered ? (
          <SceneBoundary onLeave={() => setEntered(false)}>
            <Suspense fallback={<Loading />}>
              <Scene
                progress={progress}
                actions={actions}
                openLecture={openLecture}
                fullscreen={fs}
                onToggleFullscreen={toggleFullscreen}
              />
            </Suspense>
          </SceneBoundary>
        ) : (
          <Cover sum={sum} onEnter={() => setEntered(true)} onReset={actions.reset} />
        )}
        <button
          type="button"
          className="dlg-fsbtn"
          onClick={toggleFullscreen}
          aria-label={fs ? 'Leave fullscreen' : 'Enter fullscreen'}
          title={fs ? 'Leave fullscreen (Esc)' : 'Fullscreen'}
        >
          <Icon name={fs ? 'compress' : 'expand'} size={16} />
        </button>
      </div>

      {/* ── Editorial strip: the three houses, their slides, their progress ── */}
      <section className="pt-card dlg-strip" aria-label="Houses and progress">
        <header className="dlg-strip__head">
          <span className="dlg-strip__label">
            <span className="dlg-strip__dot" aria-hidden="true" />
            {LECTURE.title}
          </span>
          <span className="dlg-strip__count">
            {sum.found}/{sum.total} scrolls · {sum.housesSolved}/{HOUSES.length} doors
          </span>
        </header>
        <ol className="dlg-strip__houses">
          {HOUSES.map((h) => {
            const ph = sum.perHouse[h.id];
            return (
              <li key={h.id} className={`dlg-house${ph.solved ? ' dlg-house--solved' : ''}`}>
                <span className="dlg-house__numeral">{h.numeral}</span>
                <div className="dlg-house__body">
                  <p className="dlg-house__name">{h.name}</p>
                  <p className="dlg-house__teaches">{h.teaches}</p>
                  <p className="dlg-house__meta">
                    <span>Slides {h.slides}</span>
                    <span className="dlg-house__pips" aria-label={`${ph.found} of ${ph.total} scrolls found`}>
                      {Array.from({ length: ph.total }, (_, i) => (
                        <i key={i} className={i < ph.found ? 'dlg-pip dlg-pip--on' : 'dlg-pip'} />
                      ))}
                    </span>
                    <button type="button" className="dlg-link" onClick={() => openLecture(h.lectureTab)}>
                      Lecture tab →
                    </button>
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
        <p className="dlg-strip__foot">
          If it can be understood sitting still it lives on the lecture tab. The houses hold only what needs space or time:
          a kernel you walk, channels you climb, doorways that narrow.
        </p>
      </section>
    </div>
  );
}

/* ── Painted cover: the only thing on screen before three.js is fetched ──── */
function Cover({ sum, onEnter, onReset }) {
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="dlg-cover">
      <div className="dlg-cover__sky" aria-hidden="true" />
      <div className="dlg-cover__sea" aria-hidden="true" />
      <div className="dlg-cover__village" aria-hidden="true">
        <i style={{ left: '14%', height: '26%', width: '17%' }} />
        <i style={{ left: '40%', height: '44%', width: '20%' }} />
        <i style={{ left: '68%', height: '20%', width: '24%' }} />
        <b style={{ left: '8%' }} />
        <b style={{ left: '34%' }} />
        <b style={{ left: '63%' }} />
        <b style={{ left: '94%' }} />
      </div>
      <div className="dlg-cover__text">
        <p className="dlg-cover__eyebrow">{LECTURE.code} · a 3D lecture</p>
        <h3 className="dlg-cover__title">Scrolls of the Philosopher</h3>
        <p className="dlg-cover__sub">
          A dusk village of three houses. Each scroll you find lights a lamp and wakes a room that is the diagram
          from the slides, built at walking scale.
        </p>
        <div className="dlg-cover__row">
          <button type="button" className="dlg-btn dlg-btn--primary" onClick={onEnter}>
            {sum.found > 0 ? 'Continue' : 'Begin'}
          </button>
          <span className="dlg-cover__progress">
            {sum.found}/{SCROLLS.length} scrolls · {sum.housesSolved}/{HOUSES.length} doors
          </span>
          {sum.found > 0 && !confirm && (
            <button type="button" className="dlg-link" onClick={() => setConfirm(true)}>
              Reset progress
            </button>
          )}
          {confirm && (
            <span className="dlg-cover__confirm">
              Forget every scroll?
              <button type="button" className="dlg-link dlg-link--warn" onClick={() => { onReset(); setConfirm(false); }}>
                Yes, reset
              </button>
              <button type="button" className="dlg-link" onClick={() => setConfirm(false)}>
                Keep
              </button>
            </span>
          )}
        </div>
        <p className="dlg-cover__hint">WASD or arrows to walk · drag to look · E to act · Esc leaves fullscreen</p>
      </div>
    </div>
  );
}

function Loading() {
  return (
    <div className="dlg-cover dlg-cover--loading" role="status" aria-live="polite">
      <div className="dlg-cover__sky" aria-hidden="true" />
      <div className="dlg-cover__sea" aria-hidden="true" />
      <p className="dlg-cover__loading">Raising the village…</p>
    </div>
  );
}

/* A room bug must never blank the portal: catch it on the stage, say so, and
   offer the cover again. */
class SceneBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error) {
    console.error('[dl-game] scene crashed:', error);
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="dlg-cover dlg-cover--loading" role="alert">
        <div className="dlg-cover__sky" aria-hidden="true" />
        <div className="dlg-cover__sea" aria-hidden="true" />
        <div className="dlg-cover__text">
          <p className="dlg-cover__eyebrow">The village stumbled</p>
          <h3 className="dlg-cover__title">Something in the scene threw</h3>
          <p className="dlg-cover__sub">
            <code>{String(this.state.error?.message || this.state.error)}</code>
          </p>
          <div className="dlg-cover__row">
            <button type="button" className="dlg-btn dlg-btn--primary" onClick={() => { this.setState({ error: null }); this.props.onLeave(); }}>
              Back to the cover
            </button>
          </div>
        </div>
      </div>
    );
  }
}
