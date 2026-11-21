import { useEffect, useRef, useState } from 'react';
import { Stage, Seg, Icon } from '../kit/kit';
import { Horn } from '../art/parts';
import { shuffle } from '../content/bank';

/* LAB — horn signals (Workbook p.27). Tap a signal to hear and see it; in
   "Name it" mode a random signal plays and you name it. */

const SIGNALS = [
  { blasts: 's', say: 'I am altering course to **starboard**' },
  { blasts: 'ss', say: 'I am altering course to **port**' },
  { blasts: 'sss', say: 'My engines are going **astern**' },
  { blasts: 'sssss', say: 'I’m **unsure of your intentions** (in practice: you’re not following the rules — get out of the way)' },
];
const plain = (t) => t.replace(/\*\*/g, '');
const SHORT = 0.8; // seconds of tone per short blast
const GAP = 0.45;

function useHorn() {
  const ctx = useRef(null);
  const [active, setActive] = useState(-1);
  const timers = useRef([]);
  useEffect(() => () => timers.current.forEach((t) => clearTimeout(t)), []);
  const play = (blasts) => {
    timers.current.forEach((t) => clearTimeout(t));
    timers.current = [];
    try {
      ctx.current = ctx.current ?? new (window.AudioContext || window.webkitAudioContext)();
    } catch {
      ctx.current = null;
    }
    const ac = ctx.current;
    let t = 0;
    blasts.split('').forEach((b, i) => {
      const len = b === 'l' ? SHORT * 5 : SHORT;
      timers.current.push(setTimeout(() => setActive(i), t * 1000));
      if (ac) {
        const o = ac.createOscillator();
        const g = ac.createGain();
        o.type = 'sawtooth';
        o.frequency.value = 196;
        const start = ac.currentTime + t;
        g.gain.setValueAtTime(0, start);
        g.gain.linearRampToValueAtTime(0.12, start + 0.03);
        g.gain.setValueAtTime(0.12, start + len - 0.05);
        g.gain.linearRampToValueAtTime(0, start + len);
        o.connect(g).connect(ac.destination);
        o.start(start);
        o.stop(start + len + 0.02);
      }
      t += len + GAP;
    });
    timers.current.push(setTimeout(() => setActive(-1), t * 1000));
  };
  return { play, active };
}

export default function SoundLab() {
  const [mode, setMode] = useState('learn');
  const [cur, setCur] = useState(2);
  const horn = useHorn();
  const [quiz, setQuiz] = useState(null); // { target, opts, pick }
  const [score, setScore] = useState({ right: 0, total: 0 });

  const newQ = () => {
    const target = Math.floor(Math.random() * SIGNALS.length);
    setQuiz({ target, opts: shuffle(SIGNALS.map((_, i) => i)), pick: null });
    horn.play(SIGNALS[target].blasts);
  };
  const shown = mode === 'learn' ? cur : quiz?.target ?? 0;

  return (
    <Stage
      title="Horn signals"
      receipt="Workbook p.27"
      tryThis={mode === 'learn' ? 'Tap a signal to hear it. Count the blasts: **1 right, 2 left, 3 going backwards, 5 = “what are you doing?”**' : 'Press play, count the blasts, name the signal.'}
      challenge={{ text: `Name 5 signals in “Name it” mode (${score.right}/5).`, done: score.right >= 5 }}
      foot={<span className="sk-dot sk-dot--chart">sound on · short blast ≈ 1 s</span>}
    >
      <div className="sk-ctrls" style={{ marginBottom: '0.8rem' }}>
        <Seg value={mode} onChange={(m) => { setMode(m); setQuiz(null); }} options={[{ value: 'learn', label: 'Learn' }, { value: 'quiz', label: 'Name it' }]} label="Mode" />
      </div>
      {mode === 'learn' ? (
        <div className="sk-list">
          {SIGNALS.map((s, i) => (
            <button key={s.blasts} type="button" onClick={() => { setCur(i); horn.play(s.blasts); }}
              className="sk-list__row" style={{ width: '100%', background: i === cur ? 'color-mix(in srgb, var(--chart) 7%, transparent)' : 'none', border: 0, borderBottom: '1px solid var(--rule)', cursor: 'pointer', textAlign: 'left', gridTemplateColumns: 'minmax(120px, 200px) 1fr', alignItems: 'center', color: 'var(--ink)' }}>
              <Horn blasts={s.blasts} w={150} active={i === shown ? horn.active : -1} />
              <span><b>{s.blasts.length} short</b> — {plain(s.say)}</span>
            </button>
          ))}
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '0.8rem', maxWidth: 620 }}>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <button type="button" className="sk-btn sk-btn--primary" onClick={() => (quiz && quiz.pick === null ? horn.play(SIGNALS[quiz.target].blasts) : newQ())}>
              <Icon name="sound" size={15} /> {quiz && quiz.pick === null ? 'Play again' : 'Play a signal'}
            </button>
            <div style={{ flex: 1, maxWidth: 220, opacity: quiz?.pick !== null && quiz ? 1 : 0.25 }}>
              {quiz && <Horn blasts={quiz.pick !== null ? SIGNALS[quiz.target].blasts : 's'.repeat(SIGNALS[quiz.target].blasts.length)} active={horn.active} w={150} />}
            </div>
          </div>
          {quiz && (
            <div className="sk-opts">
              {quiz.opts.map((i, k) => {
                const right = quiz.pick !== null && i === quiz.target;
                const wrong = quiz.pick === i && i !== quiz.target;
                return (
                  <button key={i} type="button" disabled={quiz.pick !== null} className={`sk-opt${right ? ' sk-opt--right' : ''}${wrong ? ' sk-opt--wrong' : ''}`}
                    onClick={() => { setQuiz({ ...quiz, pick: i }); setScore((sc) => ({ right: sc.right + (i === quiz.target ? 1 : 0), total: sc.total + 1 })); }}>
                    <span className="sk-opt__k">{'ABCD'[k]}</span><span>{plain(SIGNALS[i].say)}</span><span />
                  </button>
                );
              })}
            </div>
          )}
          {quiz?.pick !== null && quiz && (
            <span className={`sk-dot ${quiz.pick === quiz.target ? 'sk-dot--ok' : 'sk-dot--bad'}`}>{SIGNALS[quiz.target].blasts.length} short blasts = {plain(SIGNALS[quiz.target].say)}. Press play for the next one.</span>
          )}
        </div>
      )}
    </Stage>
  );
}
