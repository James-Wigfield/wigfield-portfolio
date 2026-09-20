/* ============================================================================
   HUD — the DOM overlay on the stage
   ----------------------------------------------------------------------------
   Progress and buttons along the top, the bust's voice under them, the
   parchment line and the action prompt at the foot, a control card on
   first load (H toggles), a choice panel when a door asks a question, and a
   visually hidden live region describing the room for anyone who cannot
   parse the 3D. Reads the hud store; never touches the frame loop.
   ========================================================================== */
import { useEffect } from 'react';
import Icon from '../../../icons';
import { HOUSES, LECTURE } from './content/scrolls';
import { useStore } from './world/store';
import { useGame } from './world/world';

export function Hud({ muted, onToggleMute }) {
  const { hud, sum, openLecture } = useGame();
  const s = useStore(hud);

  // the parchment line fades on its own
  useEffect(() => {
    if (!s.line) return undefined;
    const t = setTimeout(() => hud.set({ line: null }), 8500);
    return () => clearTimeout(t);
  }, [s.line, hud]);
  useEffect(() => {
    if (!s.speech) return undefined;
    const t = setTimeout(() => hud.set({ speech: null }), 7000);
    return () => clearTimeout(t);
  }, [s.speech, hud]);

  return (
    <div className="dlg-hud" data-hud>
      {/* ── top: progress · buttons ─────────────────────────────────────── */}
      <div className="dlg-hud__top">
        <div className="dlg-hud__title">
          <span className="dlg-hud__eyebrow">{LECTURE.code} · Scrolls of the Philosopher</span>
          <span className="dlg-hud__progress">
            <span className="dlg-hud__lamps" aria-label={`${sum.found} of ${sum.total} scrolls found`}>
              {Array.from({ length: sum.total }, (_, i) => (
                <i key={i} className={i < sum.found ? 'dlg-lamp dlg-lamp--lit' : 'dlg-lamp'} />
              ))}
            </span>
            <span className="dlg-hud__houses">
              {HOUSES.map((h) => {
                const ph = sum.perHouse[h.id];
                return (
                  <span
                    key={h.id}
                    className={`dlg-hud__house${ph.solved ? ' dlg-hud__house--solved' : ph.complete ? ' dlg-hud__house--lit' : ''}`}
                    title={`${h.name}: ${ph.found}/${ph.total} scrolls${ph.solved ? ', door opened' : ''}`}
                  >
                    {h.numeral}
                  </span>
                );
              })}
            </span>
          </span>
        </div>
        <div className="dlg-hud__btns">
          <button type="button" className="dlg-hud__btn" onClick={onToggleMute} aria-pressed={!muted} title={muted ? 'Sound off (M)' : 'Sound on (M)'}>
            <span className={`dlg-hud__snd${muted ? ' dlg-hud__snd--off' : ''}`} aria-hidden="true"><i /><i /><i /></span>
            {muted ? 'Muted' : 'Sound'}
          </button>
          <button type="button" className="dlg-hud__btn" onClick={() => openLecture(s.lectureTab || undefined)} title="Open the 2D lecture">
            <Icon name="network" size={13} /> Lecture 3
          </button>
        </div>
      </div>

      {/* ── the bust speaks ─────────────────────────────────────────────── */}
      {s.speech && (
        <div className="dlg-hud__speech" role="status">
          <span className="dlg-hud__who">
            <span className="dlg-hud__dot" aria-hidden="true" />
            {s.speech.who}
          </span>
          <p>{s.speech.text}</p>
        </div>
      )}

      {/* ── room state (accessible) ─────────────────────────────────────── */}
      {s.room && (
        <div className="dlg-hud__room">
          <span className="dlg-hud__who">
            <span className="dlg-hud__dot dlg-hud__dot--room" aria-hidden="true" />
            {s.room.title}
          </span>
          {s.room.lines?.map((l, i) => (
            <p key={i}>{l}</p>
          ))}
        </div>
      )}
      <div className="dlg-sr" aria-live="polite">
        {s.room ? `${s.room.title}. ${s.room.lines?.join(' ')}` : ''}
        {s.line ? ` Scroll found: ${s.line.text}` : ''}
        {s.speech ? ` ${s.speech.who} says: ${s.speech.text}` : ''}
      </div>

      {/* ── choice panel ────────────────────────────────────────────────── */}
      {s.choice && (
        <div className="dlg-hud__choice" role="dialog" aria-label={s.choice.title}>
          <span className="dlg-hud__who">
            <span className="dlg-hud__dot dlg-hud__dot--door" aria-hidden="true" />
            {s.choice.who || 'The door'}
          </span>
          <p className="dlg-hud__q">{s.choice.title}</p>
          {s.choice.figure}
          <ol className="dlg-hud__opts">
            {s.choice.options.map((o, i) => (
              <li key={i}>
                <button type="button" className="dlg-hud__opt" onClick={() => s.choice.onPick(o, i)}>
                  <kbd>{i + 1}</kbd>
                  <span>{o.label}</span>
                </button>
              </li>
            ))}
          </ol>
          {s.choice.note && <p className="dlg-hud__note">{s.choice.note}</p>}
          {s.choice.dismissable !== false && <p className="dlg-hud__esc">E · step back</p>}
        </div>
      )}

      {/* ── foot: parchment line · prompt · controls ────────────────────── */}
      <div className="dlg-hud__foot">
        {s.line && (
          <div className="dlg-hud__scroll" role="status">
            <span className="dlg-hud__scroll-meta">
              {s.line.concept} · slides {s.line.slides}
            </span>
            <p className="dlg-hud__scroll-text">{s.line.text}</p>
            <button type="button" className="dlg-link" onClick={() => openLecture(s.line.lectureTab)}>
              Read it on the lecture tab →
            </button>
          </div>
        )}
        {s.prompt && !s.choice && (
          <div className="dlg-hud__prompt">
            <kbd>{s.prompt.key}</kbd>
            <span>{s.prompt.text}</span>
          </div>
        )}
      </div>

      {s.hint && (
        <div className="dlg-hud__hint">
          <span className="dlg-hud__who">
            <span className="dlg-hud__dot" aria-hidden="true" />
            Controls · H hides
          </span>
          <dl>
            <dt><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></dt><dd>walk · <kbd>Shift</kbd> hurry</dd>
            <dt><kbd>←</kbd><kbd>→</kbd></dt><dd>turn the camera · or drag</dd>
            <dt><kbd>E</kbd></dt><dd>pick up · push · knock</dd>
            <dt><kbd>1</kbd>–<kbd>4</kbd></dt><dd>answer a door</dd>
            <dt><kbd>M</kbd></dt><dd>sound</dd>
          </dl>
        </div>
      )}
    </div>
  );
}
