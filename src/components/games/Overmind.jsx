import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import fishtank from '../../assets/gifs/fishtank_resturant.gif';
import './Overmind.css';

// ── Realms (each question belongs to one; drives the orb's colour) ─
const REALMS = {
  perception:    { hue: 285, label: 'PERCEPTION'    },
  time:          { hue: 190, label: 'TIME'          },
  identity:      { hue: 325, label: 'IDENTITY'      },
  infinity:      { hue: 255, label: 'INFINITY'      },
  consciousness: { hue: 155, label: 'CONSCIOUSNESS' },
  reality:       { hue: 35,  label: 'REALITY'       },
  dream:         { hue: 300, label: 'DREAM'         },
  morality:      { hue: 350, label: 'MORALITY'      },
};

// ── The questions. Every YES/NO carves a different law into your shared universe ─
const QUESTIONS = [
  { realm: 'perception',    q: 'Does a colour still exist when every eye is closed?',
    lawYes: 'Colour waits in the dark, faithful and unseen.',
    lawNo:  'Colour is a story light tells the eye — no eye, no story.' },
  { realm: 'time',          q: 'If every clock vanished, would time keep moving?',
    lawYes: 'Time flows on, with or without anyone to count it.',
    lawNo:  'Time is only the ticking we all agreed to hear.' },
  { realm: 'identity',      q: 'Are you the same person who woke up this morning?',
    lawYes: 'A single self threads every waking, unbroken.',
    lawNo:  'Each dawn births a stranger wearing your name.' },
  { realm: 'infinity',      q: 'Could you ever count all the way to the final number?',
    lawYes: 'Somewhere the numbers end, and a great silence begins.',
    lawNo:  'The numbers run forever; to count is a kind of falling.' },
  { realm: 'consciousness', q: 'Does your reflection experience anything, looking back?',
    lawYes: 'Behind the glass, a quiet witness watches too.',
    lawNo:  'The mirror only holds light — never a mind.' },
  { realm: 'reality',       q: 'Is this present moment the only one that truly exists?',
    lawYes: 'Only now is real; past and future are rumours.',
    lawNo:  'Every moment exists at once; we merely visit one at a time.' },
  { realm: 'dream',         q: "When you dream a stranger's face, have you met them before?",
    lawYes: 'Every dreamed face is borrowed from a life you brushed past.',
    lawNo:  'The mind forges faces from nothing, like sparks from flint.' },
  { realm: 'perception',    q: 'Do any two people ever see the exact same shade of blue?',
    lawYes: 'Blue is simply blue, shared across every seeing eye.',
    lawNo:  'Each skull holds its own private blue, untranslatable.' },
  { realm: 'consciousness', q: 'Could a perfect, atom-for-atom copy of you be you?',
    lawYes: 'If every atom matches, the copy is no copy at all.',
    lawNo:  'A twin of atoms is still a separate, lonely soul.' },
  { realm: 'time',          q: 'Does the past still exist somewhere, out of reach?',
    lawYes: 'Every yesterday endures, just beyond the reach of hands.',
    lawNo:  'The past is ash; only its rumour remains.' },
  { realm: 'infinity',      q: 'Is there an idea too vast for any mind to hold?',
    lawYes: 'Some thoughts are oceans no skull can ever drink.',
    lawNo:  'No idea is too large; minds stretch to meet them.' },
  { realm: 'morality',      q: 'Is a kindness still kind if no one ever learns of it?',
    lawYes: 'Goodness needs no witness in order to be good.',
    lawNo:  'A kindness unseen is a tree falling unheard.' },
  { realm: 'reality',       q: 'If the universe is a dream, must something be dreaming it?',
    lawYes: 'Every dream needs a dreamer — even this one.',
    lawNo:  'A dream can dream itself, with no one at the helm.' },
  { realm: 'identity',      q: "Would you still be you with someone else's memories?",
    lawYes: 'You run deeper than the memories you happen to carry.',
    lawNo:  'Strip the memories away and the self goes with them.' },
  { realm: 'perception',    q: 'Is silence a sound that you can actually hear?',
    lawYes: 'Silence has a voice, for those who learn to listen.',
    lawNo:  'Silence is only the hollow where a sound should be.' },
  { realm: 'consciousness', q: "Does a sleeping mind that isn't dreaming still exist?",
    lawYes: 'The self persists in the dark, waiting to surface.',
    lawNo:  'Between dreams, the self briefly ceases to be.' },
  { realm: 'time',          q: 'Could this exact moment have already happened before?',
    lawYes: 'The wheel turns; every now is secretly a return.',
    lawNo:  'Each instant is minted once and then never again.' },
  { realm: 'infinity',      q: 'If space never ends, does another you exist out there?',
    lawYes: 'In endless space every face repeats — including yours.',
    lawNo:  'You are singular; infinity makes no such promises.' },
  { realm: 'dream',         q: "Are the people in your dreams aware that they're dreamed?",
    lawYes: 'Dreamed minds may quietly wonder at their dreamer too.',
    lawNo:  'Dream-folk are scenery, hollow behind the eyes.' },
  { realm: 'reality',       q: 'Does a question have an answer before anyone asks it?',
    lawYes: 'The answer waits, complete, before the question forms.',
    lawNo:  'Answers are born only in the moment of asking.' },
  { realm: 'morality',      q: 'Can you be guilty of a crime you only imagined committing?',
    lawYes: 'The mind that rehearses the act is already stained by it.',
    lawNo:  'A deed left undone leaves the hands entirely clean.' },
  { realm: 'perception',    q: 'Is the world still there behind you when you turn away?',
    lawYes: 'The world holds its shape, watched or not.',
    lawNo:  'Behind your back, the world dissolves into maybe.' },
  { realm: 'consciousness', q: 'Could a machine that says it feels actually feel?',
    lawYes: 'If it aches and truly means it, the ache is real.',
    lawNo:  'A machine performs its feeling; it never arrives.' },
  { realm: 'identity',      q: "If you forgot every wrong you've ever done, are you innocent?",
    lawYes: 'Forgetting washes the slate back to white.',
    lawNo:  'The deeds remain, whether the doer recalls them or not.' },
  { realm: 'time',          q: 'Is the future already written, waiting for us to arrive?',
    lawYes: 'Tomorrow is carved already; we merely walk toward it.',
    lawNo:  'The future stays unwritten until we breathe it into being.' },
  { realm: 'infinity',      q: 'Can something ever come from absolutely nothing?',
    lawYes: 'From the void, somethings bloom entirely unbidden.',
    lawNo:  'Nothing yields nothing; there was always something.' },
  { realm: 'dream',         q: 'If you die inside a dream, does some part of you remember?',
    lawYes: 'Some dream-deaths leave a faint bruise on the waking mind.',
    lawNo:  'The dream dissolves and nothing crosses back.' },
  { realm: 'reality',       q: 'Do numbers truly exist, or did we invent them?',
    lawYes: 'Numbers were always there, patiently waiting to be found.',
    lawNo:  'Numbers are a language we carved into the silence.' },
  { realm: 'perception',    q: 'Is a rainbow a thing in the sky, or only in your eye?',
    lawYes: 'The rainbow hangs in the sky, as real as the rain.',
    lawNo:  'A rainbow lives in the eye alone; step toward it and it flees.' },
  { realm: 'consciousness', q: 'Does an ant know, in some small way, that it exists?',
    lawYes: 'Even the ant carries a faint flicker of I-am.',
    lawNo:  'The ant runs its tiny program, with no self inside.' },
  { realm: 'identity',      q: 'Are you the voice in your head, more than the body it rides in?',
    lawYes: 'You are the narrator, not the flesh it speaks through.',
    lawNo:  'You are the body; the voice is merely its weather.' },
  { realm: 'time',          q: 'If you relived your life identically, would it still feel new?',
    lawYes: 'A repeated life still dawns fresh with every round.',
    lawNo:  'A life relived to the letter would feel like nothing at all.' },
  { realm: 'morality',      q: 'Is it wrong to wake someone from a beautiful dream?',
    lawYes: 'To end a sweetness early is a small, real cruelty.',
    lawNo:  'Waking is a gift, even from the loveliest lie.' },
  { realm: 'infinity',      q: 'Does the universe know, in any sense, that you are in it?',
    lawYes: 'You are the universe finally noticing itself.',
    lawNo:  'The cosmos turns blind; it never learns your name.' },
  { realm: 'dream',         q: 'Is déjà vu the memory of a dream you have forgotten?',
    lawYes: 'Déjà vu is a dream surfacing slightly out of order.',
    lawNo:  'Déjà vu is just the mind misfiling the present.' },
  { realm: 'reality',       q: 'If a story is told well enough, can it become real?',
    lawYes: 'A story believed hard enough slowly grows bones.',
    lawNo:  'A tale stays a tale, however bright the telling.' },
];

// ── Glitch laws, written when the vote splits perfectly even ──────
const GLITCH_LAWS = [
  'Reality could not decide, and so it quietly forked.',
  'The vote split the world into two halves that disagree.',
  'A paradox took root in the place where consensus failed.',
  'Here the overmind stuttered — both answers are true, and neither.',
  'The veil tore straight down the middle and never fully closed.',
];

// ── Round modes ──────────────────────────────────────────────────
//  sync     → think like the others. The majority shares the dream.
//  fracture → one brave dissenter (and ONLY one) breaks free and is rewarded.
//  echo     → the minority were the awake ones all along.
const MODES = {
  sync: {
    key: 'sync', label: 'SYNC', color: 'cyan', icon: '◉',
    tagline: 'THINK LIKE THE OTHERS',
    desc: 'Side with the crowd. Everyone in the majority dreams as one — and scores.',
  },
  fracture: {
    key: 'fracture', label: 'FRACTURE', color: 'rose', icon: '⟡',
    tagline: 'DARE TO STAND ALONE',
    desc: 'The lone dissenter — and only a lone one — wakes from the dream. They take +3.',
  },
  echo: {
    key: 'echo', label: 'ECHO', color: 'violet', icon: '✶',
    tagline: 'THE FEW WERE RIGHT',
    desc: 'Tonight the minority were the awake ones. Every dissenter scores +2.',
  },
};

const ROUND_OPTIONS = [5, 7, 10, 13];

// ── Winner titles, by sync-rate ──────────────────────────────────
const TITLES = [
  { min: 0.85, title: 'THE HIVE INCARNATE',     sub: 'You barely had a self left to call your own.' },
  { min: 0.6,  title: 'IN TUNE WITH THE OVERMIND', sub: 'You felt the room before it spoke.' },
  { min: 0.4,  title: 'A LUCID DREAMER',        sub: 'Half in the dream, half awake and watching.' },
  { min: 0.2,  title: 'THE WANDERING MIND',     sub: 'You drifted your own strange orbit.' },
  { min: 0,    title: 'THE WAKING HERETIC',     sub: 'You refused the shared dream to the very end.' },
];

// ── Murmurs (poetic flavour on the reveal) ───────────────────────
const MURMURS = {
  sync: [
    'The room exhaled the same breath.',
    'A single thought wore many faces.',
    'The dream held its shape.',
  ],
  syncSplit: [
    'Two minds pulled the dream in two directions.',
    'Consensus frayed at the edges.',
  ],
  fracture: [
    'One of you woke up, and the dream noticed.',
    'A crack of light under the door.',
  ],
  fractureFail: [
    'No one dared step out of the circle.',
    'The pack closed ranks. The door stayed shut.',
  ],
  echo: [
    'The quiet few were right all along.',
    'An echo answered from the far side of the room.',
  ],
  tie: [
    'The veil trembled and could not decide.',
    'Reality stuttered, caught between two truths.',
  ],
  unanimous: [
    'Every voice, one voice. The overmind smiled.',
    'Not a single mind strayed.',
  ],
};

// ── Helpers ──────────────────────────────────────────────────────
function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffled(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickMode(roundIdx) {
  // Round 1 is always a gentle SYNC so everyone learns the loop instantly.
  if (roundIdx === 0) return 'sync';
  const r = Math.random();
  if (r < 0.62) return 'sync';
  if (r < 0.81) return 'fracture';
  return 'echo';
}

// ── The morphing Overmind orb — the psychedelic centrepiece ──────
function Orb({ laws, hue, pulse }) {
  const ringCount = Math.min(laws.length, 8);
  const lastGlitch = laws.length > 0 && laws[laws.length - 1].glitch;
  return (
    <div
      className={`ov-orb${pulse ? ' ov-orb--pulse' : ''}${lastGlitch ? ' ov-orb--glitch' : ''}`}
      style={{ '--ov-hue': hue, '--ov-laws': laws.length }}
      aria-hidden="true"
    >
      <div className="ov-orb__core" />
      <div className="ov-orb__shroud" />
      {Array.from({ length: ringCount }).map((_, i) => (
        <div
          key={i}
          className="ov-orb__ring"
          style={{ '--i': i, '--ring-hue': hue + i * 24 }}
        />
      ))}
      {Array.from({ length: 6 }).map((_, i) => (
        <span key={`p${i}`} className="ov-orb__mote" style={{ '--i': i }} />
      ))}
    </div>
  );
}

// ── Shell wrapper (matches the house arcade structure) ───────────
function Shell({ onLeave, children }) {
  return (
    <div className="game-wrapper ov-wrapper">
      <div className="ov-aurora" aria-hidden="true" />
      <div className="game-banner">
        <img src={fishtank} alt="" aria-hidden="true" className="game-banner-gif ov-banner-gif" />
        <div className="game-banner-overlay ov-banner-overlay" />
        <div className="game-banner-scan" />
        <div className="game-banner-content">
          <p className="ov-logo">// OVERMIND</p>
          <p className="ov-tagline">A SHARED DREAM FOR 2–6 MINDS</p>
        </div>
        <button className="game-back-btn" onClick={onLeave}>← ARCADE</button>
      </div>
      <div className="game-body ov-body">{children}</div>
    </div>
  );
}

// ── Setup ────────────────────────────────────────────────────────
function SetupScreen({ onStart, onLeave, lastConfig }) {
  const [names, setNames] = useState(
    lastConfig?.names
      ? [...lastConfig.names, '', '', ''].slice(0, Math.max(3, lastConfig.names.length))
      : ['', '', '']
  );
  const [rounds, setRounds] = useState(lastConfig?.rounds ?? 7);
  const [error, setError] = useState('');

  const setName = (i, v) => {
    setNames(n => n.map((x, idx) => (idx === i ? v : x)));
    setError('');
  };
  const addPlayer = () => { if (names.length < 6) setNames(n => [...n, '']); };
  const removePlayer = (i) => { if (names.length > 2) setNames(n => n.filter((_, idx) => idx !== i)); };

  const handleStart = () => {
    const clean = names.map(n => n.trim()).filter(Boolean);
    if (clean.length < 2) { setError('At least two minds are needed to dream.'); return; }
    const lower = clean.map(n => n.toLowerCase());
    if (new Set(lower).size !== lower.length) { setError('Each mind needs a distinct name.'); return; }
    onStart({ names: clean, rounds });
  };

  return (
    <Shell onLeave={onLeave}>
      <div className="game-screen ov-screen-wide">
        <div className="game-card ov-card">
          <p className="ov-section-title">ENTER THE DREAM</p>
          <p className="ov-section-sub">
            Pass one phone around the circle. Each round, a question with no true answer —
            only the one your group dreams together.
          </p>

          <p className="ov-label" style={{ marginTop: '1.3rem' }}>THE DREAMERS</p>
          <div className="ov-names">
            {names.map((n, i) => (
              <div className="ov-name-row" key={i}>
                <span className="ov-name-idx">{String(i + 1).padStart(2, '0')}</span>
                <input
                  className="ov-input"
                  type="text"
                  placeholder={`Dreamer ${i + 1}`}
                  maxLength={16}
                  autoComplete="off"
                  value={n}
                  onChange={e => setName(i, e.target.value)}
                />
                {names.length > 2 && (
                  <button className="ov-name-x" onClick={() => removePlayer(i)} type="button" aria-label="remove">×</button>
                )}
              </div>
            ))}
          </div>
          {names.length < 6 && (
            <button className="ov-add" onClick={addPlayer} type="button">+ ADD A MIND</button>
          )}

          <p className="ov-label" style={{ marginTop: '1.4rem' }}>QUESTIONS</p>
          <div className="ov-rounds-row">
            {ROUND_OPTIONS.map(r => (
              <button
                key={r}
                className={`ov-round-pip${rounds === r ? ' ov-round-pip--on' : ''}`}
                onClick={() => setRounds(r)}
                type="button"
              >
                {r}
              </button>
            ))}
          </div>

          {error && <p className="ov-error">// {error}</p>}

          <button className="game-btn game-btn--violet" style={{ marginTop: '1.5rem' }} onClick={handleStart}>
            DESCEND INTO THE DREAM →
          </button>
        </div>

        <div className="ov-how-to">
          <p className="ov-how-title">HOW THE DREAM WORKS</p>
          <ol className="ov-how-list">
            <li>A strange <span className="ov-hi">yes-or-no question</span> appears. There's no right answer.</li>
            <li>Pass the phone. Each mind <span className="ov-hi">secretly votes</span> YES or NO.</li>
            <li>Most rounds are <span className="ov-hi--cyan">SYNC</span> — side with the crowd to score.</li>
            <li>But watch for <span className="ov-hi--rose">FRACTURE</span> and <span className="ov-hi--violet">ECHO</span> rounds, where breaking away pays.</li>
            <li>The winning answer becomes a <span className="ov-hi">law of your universe</span>, feeding the Overmind.</li>
            <li>By the end you'll have dreamed an entire <span className="ov-hi">cosmology</span> into being — and crowned one mind.</li>
          </ol>
        </div>
      </div>
    </Shell>
  );
}

// ── Round intro: mode + question reveal, shown to the whole table ─
function RoundIntroScreen({ roundNum, total, mode, question, laws, hue, onReady, onLeave }) {
  const m = MODES[mode];
  return (
    <Shell onLeave={onLeave}>
      <div className="game-screen ov-screen-wide">
        <div className="game-card ov-card ov-fade-in">
          <div className="ov-round-bar">
            <span className="ov-round-badge">QUESTION {roundNum} / {total}</span>
            <span className={`ov-mode-pill ov-mode-pill--${m.color}`}>{m.icon} {m.label}</span>
          </div>

          <Orb laws={laws} hue={hue} pulse />

          <div className={`ov-mode-banner ov-mode-banner--${m.color}`}>
            <p className="ov-mode-tagline">{m.icon} {m.label} ROUND — {m.tagline}</p>
            <p className="ov-mode-desc">{m.desc}</p>
          </div>

          <p className="ov-realm-tag" style={{ '--ov-hue': hue }}>
            {REALMS[question.realm].label}
          </p>
          <p className="ov-question ov-question--big">{question.q}</p>

          <button className="game-btn game-btn--violet" style={{ marginTop: '1.25rem' }} onClick={onReady}>
            BEGIN — PASS TO THE FIRST DREAMER →
          </button>
        </div>
      </div>
    </Shell>
  );
}

// ── Handoff between voters ───────────────────────────────────────
function HandoffScreen({ name, votedCount, total, onReady, onLeave }) {
  return (
    <Shell onLeave={onLeave}>
      <div className="game-screen ov-screen-wide">
        <div className="game-card ov-card ov-card--centered ov-fade-in">
          <div className="ov-pass-icon" aria-hidden="true">🜂</div>
          <p className="ov-label">PASS THE PHONE TO</p>
          <p className="ov-big-name">{name}</p>
          <p className="ov-hint" style={{ margin: '0.9rem 0 1.2rem' }}>
            {votedCount} of {total} have already voted. Keep your answer secret.
          </p>
          <button className="game-btn game-btn--cyan" onClick={onReady}>
            I'M {name.toUpperCase()} — SHOW ME →
          </button>
        </div>
      </div>
    </Shell>
  );
}

// ── A single mind's secret vote ──────────────────────────────────
function VoteScreen({ name, mode, question, hue, onVote, onLeave }) {
  const m = MODES[mode];
  return (
    <Shell onLeave={onLeave}>
      <div className="game-screen ov-screen-wide">
        <div className="game-card ov-card ov-fade-in">
          <div className="ov-round-bar">
            <span className="ov-current">{name.toUpperCase()}'S VOTE</span>
            <span className={`ov-mode-pill ov-mode-pill--${m.color}`}>{m.icon} {m.label}</span>
          </div>

          <p className="ov-realm-tag" style={{ '--ov-hue': hue }}>{REALMS[question.realm].label}</p>
          <p className="ov-question">{question.q}</p>

          <p className="ov-hint ov-hint--mode">{m.icon} {m.tagline}</p>

          <div className="ov-vote-row">
            <button className="ov-vote-btn ov-vote-btn--yes" onClick={() => onVote('yes')} type="button">
              <span className="ov-vote-glyph">◯</span>
              YES
            </button>
            <button className="ov-vote-btn ov-vote-btn--no" onClick={() => onVote('no')} type="button">
              <span className="ov-vote-glyph">✕</span>
              NO
            </button>
          </div>

          <p className="ov-hint" style={{ marginTop: '1rem', opacity: 0.55 }}>
            Tap once, then pass the phone on. No take-backs.
          </p>
        </div>
      </div>
    </Shell>
  );
}

// ── Reveal: the tally, who scored, and the new law ───────────────
function RevealScreen({
  players, votes, result, mode, question, laws, hue,
  roundNum, total, onContinue, isLast, onLeave,
}) {
  const m = MODES[mode];
  const yesCount = votes.filter(v => v === 'yes').length;
  const noCount = votes.filter(v => v === 'no').length;
  const totalVotes = votes.length;

  return (
    <Shell onLeave={onLeave}>
      <div className="game-screen ov-screen-wide">
        <div className={`game-card ov-card ov-card--reveal ov-card--${m.color}`}>
          <div className="ov-round-bar">
            <span className="ov-round-badge">QUESTION {roundNum} / {total}</span>
            <span className={`ov-mode-pill ov-mode-pill--${m.color}`}>{m.icon} {m.label}</span>
          </div>

          <p className="ov-realm-tag" style={{ '--ov-hue': hue }}>{REALMS[question.realm].label}</p>
          <p className="ov-question ov-question--reveal">{question.q}</p>

          {/* Tally bar */}
          <div className="ov-tally">
            <div className="ov-tally-bar">
              <div className="ov-tally-fill ov-tally-fill--yes" style={{ flex: yesCount || 0.0001 }}>
                {yesCount > 0 && <span>YES · {yesCount}</span>}
              </div>
              <div className="ov-tally-fill ov-tally-fill--no" style={{ flex: noCount || 0.0001 }}>
                {noCount > 0 && <span>NO · {noCount}</span>}
              </div>
            </div>
          </div>

          {/* Per-player chips */}
          <div className="ov-chips">
            {players.map((p, i) => {
              const scored = result.scoredIdxs.includes(i);
              const pts = result.points[i] || 0;
              return (
                <span
                  key={i}
                  className={`ov-chip ov-chip--${votes[i]}${scored ? ' ov-chip--scored' : ''}`}
                >
                  <span className="ov-chip-name">{p.name}</span>
                  <span className="ov-chip-vote">{votes[i] === 'yes' ? 'YES' : 'NO'}</span>
                  {scored && <span className="ov-chip-pts">+{pts}</span>}
                </span>
              );
            })}
          </div>

          <div className="ov-verdict">
            <p className={`ov-verdict-big ov-verdict-big--${m.color}`}>{result.headline}</p>
            <p className="ov-verdict-sub">{result.sub}</p>
          </div>

          {/* The law written into the universe */}
          <div className={`ov-axiom${result.law.glitch ? ' ov-axiom--glitch' : ''}`} style={{ '--ov-hue': hue }}>
            <p className="ov-axiom-label">
              {result.law.glitch ? '⌁ PARADOX INSCRIBED' : `AXIOM ${roman(laws.length)} INSCRIBED`}
            </p>
            <p className="ov-axiom-text">"{result.law.text}"</p>
          </div>

          <p className="ov-murmur">// the overmind murmurs: {result.murmur}</p>

          <button className="game-btn game-btn--violet" style={{ marginTop: '1.1rem' }} onClick={onContinue}>
            {isLast ? 'WITNESS THE COSMOLOGY →' : 'NEXT QUESTION →'}
          </button>
        </div>
      </div>
    </Shell>
  );
}

// ── Final: scoreboard + the full generated cosmology ─────────────
function FinalScreen({ players, laws, rounds, syncRate, onPlayAgain, onLeave }) {
  const ranked = [...players].sort((a, b) => b.score - a.score);
  const top = ranked[0]?.score ?? 0;
  const winners = ranked.filter(p => p.score === top && top > 0);
  const title = TITLES.find(t => syncRate >= t.min) ?? TITLES[TITLES.length - 1];
  const hue = laws.length ? REALMS[laws[laws.length - 1].realm]?.hue ?? 270 : 270;

  return (
    <Shell onLeave={onLeave}>
      <div className="game-screen ov-screen-wide">
        <div className="game-card ov-card ov-card--final">
          <p className="ov-label">THE DREAM ENDS</p>
          <Orb laws={laws} hue={hue} pulse />
          <p className="ov-final-title">{title.title}</p>
          <p className="ov-final-names">
            {winners.length === 0
              ? 'No one woke ahead'
              : winners.map(w => w.name).join(' & ')}
          </p>
          <p className="ov-final-sub">{title.sub}</p>

          <div className="ov-board">
            {ranked.map((p, i) => (
              <div key={i} className={`ov-board-row${winners.includes(p) ? ' ov-board-row--win' : ''}`}>
                <span className="ov-board-rank">{i + 1}</span>
                <span className="ov-board-name">{p.name}</span>
                <span className="ov-board-score">{p.score}</span>
              </div>
            ))}
          </div>
        </div>

        {/* The cosmology your group dreamed into being */}
        <div className="game-card ov-card ov-cosmology">
          <p className="ov-label">// THE COSMOLOGY YOU DREAMED</p>
          <p className="ov-cosmology-sub">
            {rounds} questions. {laws.length} laws. One universe that only your circle believes in.
          </p>
          <ol className="ov-laws-list">
            {laws.map((l, i) => (
              <li key={i} className={`ov-law${l.glitch ? ' ov-law--glitch' : ''}`} style={{ '--ov-hue': REALMS[l.realm]?.hue ?? 270 }}>
                <span className="ov-law-num">{l.glitch ? '⌁' : roman(i + 1)}</span>
                <span className="ov-law-text">{l.text}</span>
              </li>
            ))}
          </ol>
        </div>

        <button className="game-btn game-btn--violet" style={{ marginTop: '1rem' }} onClick={onPlayAgain}>
          DREAM AGAIN →
        </button>
      </div>
    </Shell>
  );
}

// ── Roman numerals (for axiom numbering) ─────────────────────────
function roman(n) {
  if (n <= 0) return '0';
  const map = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let out = '';
  for (const [v, s] of map) {
    while (n >= v) { out += s; n -= v; }
  }
  return out;
}

// ── Result computation — the heart of the scoring ────────────────
function computeResult(votes, mode, question) {
  const yesIdx = votes.map((v, i) => (v === 'yes' ? i : -1)).filter(i => i >= 0);
  const noIdx = votes.map((v, i) => (v === 'no' ? i : -1)).filter(i => i >= 0);
  const yes = yesIdx.length;
  const no = noIdx.length;
  const points = {};
  let scoredIdxs = [];
  let headline, sub, murmurPool, lawText, glitch = false;

  const addPts = (idxs, n) => idxs.forEach(i => { points[i] = (points[i] || 0) + n; });

  if (yes === no) {
    // Perfect split — reality cannot decide.
    headline = 'THE VEIL TREMBLES';
    sub = 'A perfect split. Reality forks; no one scores.';
    murmurPool = MURMURS.tie;
    lawText = pick(GLITCH_LAWS);
    glitch = true;
  } else {
    const majoritySide = yes > no ? 'yes' : 'no';
    const majorityIdx = majoritySide === 'yes' ? yesIdx : noIdx;
    const minorityIdx = majoritySide === 'yes' ? noIdx : yesIdx;
    const unanimous = minorityIdx.length === 0;
    lawText = majoritySide === 'yes' ? question.lawYes : question.lawNo;

    if (mode === 'sync') {
      scoredIdxs = majorityIdx;
      addPts(majorityIdx, 1);
      if (unanimous) {
        headline = 'ONE MIND';
        sub = 'Every voice as one. +1 to all.';
        murmurPool = MURMURS.unanimous;
      } else {
        headline = 'SYNCED';
        sub = `The ${majoritySide.toUpperCase()} majority shares the dream. +1 each.`;
        murmurPool = MURMURS.syncSplit;
      }
    } else if (mode === 'fracture') {
      if (minorityIdx.length === 1) {
        scoredIdxs = minorityIdx;
        addPts(minorityIdx, 3);
        headline = 'FRACTURE';
        sub = 'A lone mind broke from the dream. +3, and well earned.';
        murmurPool = MURMURS.fracture;
      } else {
        headline = unanimous ? 'NO ONE STRAYED' : 'THE PACK HELD';
        sub = 'No single dissenter. The fracture closes; no one scores.';
        murmurPool = MURMURS.fractureFail;
      }
    } else { // echo
      if (unanimous) {
        scoredIdxs = majorityIdx;
        addPts(majorityIdx, 1);
        headline = 'THE CHOIR';
        sub = 'No one to echo — so every voice scores. +1 each.';
        murmurPool = MURMURS.unanimous;
      } else {
        scoredIdxs = minorityIdx;
        addPts(minorityIdx, 2);
        headline = 'ECHO';
        sub = `The ${majoritySide === 'yes' ? 'NO' : 'YES'} minority were awake. +2 each.`;
        murmurPool = MURMURS.echo;
      }
    }
  }

  return {
    points,
    scoredIdxs,
    headline,
    sub,
    murmur: pick(murmurPool),
    law: { text: lawText, glitch, realm: question.realm },
  };
}

// ── Main controller ──────────────────────────────────────────────
export default function Overmind() {
  const navigate = useNavigate();

  const [phase, setPhase] = useState('setup');
  const [config, setConfig] = useState(null);
  const [lastConfig, setLastConfig] = useState(null);
  const [players, setPlayers] = useState([]);     // [{ name, score }]
  const [deck, setDeck] = useState([]);           // shuffled question indices
  const [roundIdx, setRoundIdx] = useState(0);
  const [question, setQuestion] = useState(null);
  const [mode, setMode] = useState('sync');
  const [votes, setVotes] = useState([]);         // 'yes' | 'no' | null
  const [voterIdx, setVoterIdx] = useState(0);
  const [laws, setLaws] = useState([]);
  const [result, setResult] = useState(null);
  const [syncHits, setSyncHits] = useState(0);    // rounds where the table mostly agreed

  useEffect(() => {
    document.title = 'Overmind';
    return () => { document.title = 'Arcade Vault'; };
  }, []);

  const leaveToArcade = () => navigate('/games');

  const hueFor = (q) => (q ? REALMS[q.realm].hue : 270);

  const startGame = (cfg) => {
    const fresh = shuffled(QUESTIONS.map((_, i) => i));
    const firstQ = QUESTIONS[fresh[0]];
    setConfig(cfg);
    setLastConfig(cfg);
    setPlayers(cfg.names.map(name => ({ name, score: 0 })));
    setDeck(fresh);
    setRoundIdx(0);
    setQuestion(firstQ);
    setMode(pickMode(0));
    setVotes(cfg.names.map(() => null));
    setVoterIdx(0);
    setLaws([]);
    setResult(null);
    setSyncHits(0);
    setPhase('round-intro');
  };

  const castVote = (choice) => {
    const next = [...votes];
    next[voterIdx] = choice;
    setVotes(next);
    if (voterIdx < players.length - 1) {
      setVoterIdx(voterIdx + 1);
      setPhase('handoff');
    } else {
      finishRound(next);
    }
  };

  const finishRound = (finalVotes) => {
    const res = computeResult(finalVotes, mode, question);
    setResult(res);
    setPlayers(prev => prev.map((p, i) => ({ ...p, score: p.score + (res.points[i] || 0) })));
    setLaws(prev => [...prev, res.law]);

    // Track "sync" for the final title: did the majority outnumber the minority clearly?
    const yes = finalVotes.filter(v => v === 'yes').length;
    const no = finalVotes.filter(v => v === 'no').length;
    if (yes !== no) setSyncHits(h => h + 1);

    setPhase('reveal');
  };

  const continueFromReveal = () => {
    const nextIdx = roundIdx + 1;
    if (nextIdx >= config.rounds) {
      setPhase('final');
      return;
    }
    // Draw the next question, reshuffling if we somehow exhaust the deck.
    let nextDeck = deck;
    if (nextIdx >= deck.length) {
      nextDeck = shuffled(QUESTIONS.map((_, i) => i));
      setDeck(nextDeck);
    }
    const q = QUESTIONS[nextDeck[nextIdx % nextDeck.length]];
    setRoundIdx(nextIdx);
    setQuestion(q);
    setMode(pickMode(nextIdx));
    setVotes(players.map(() => null));
    setVoterIdx(0);
    setResult(null);
    setPhase('round-intro');
  };

  const playAgain = () => setPhase('setup');

  // ── Render by phase ────────────────────────────────────────────
  if (phase === 'setup') {
    return <SetupScreen onStart={startGame} onLeave={leaveToArcade} lastConfig={lastConfig} />;
  }

  if (phase === 'round-intro') {
    return (
      <RoundIntroScreen
        roundNum={roundIdx + 1}
        total={config.rounds}
        mode={mode}
        question={question}
        laws={laws}
        hue={hueFor(question)}
        onReady={() => { setVoterIdx(0); setPhase('handoff'); }}
        onLeave={leaveToArcade}
      />
    );
  }

  if (phase === 'handoff') {
    return (
      <HandoffScreen
        name={players[voterIdx].name}
        votedCount={voterIdx}
        total={players.length}
        onReady={() => setPhase('vote')}
        onLeave={leaveToArcade}
      />
    );
  }

  if (phase === 'vote') {
    return (
      <VoteScreen
        name={players[voterIdx].name}
        mode={mode}
        question={question}
        hue={hueFor(question)}
        onVote={castVote}
        onLeave={leaveToArcade}
      />
    );
  }

  if (phase === 'reveal') {
    return (
      <RevealScreen
        players={players}
        votes={votes}
        result={result}
        mode={mode}
        question={question}
        laws={laws}
        hue={hueFor(question)}
        roundNum={roundIdx + 1}
        total={config.rounds}
        onContinue={continueFromReveal}
        isLast={roundIdx + 1 >= config.rounds}
        onLeave={leaveToArcade}
      />
    );
  }

  if (phase === 'final') {
    const syncRate = config.rounds > 0 ? syncHits / config.rounds : 0;
    return (
      <FinalScreen
        players={players}
        laws={laws}
        rounds={config.rounds}
        syncRate={syncRate}
        onPlayAgain={playAgain}
        onLeave={leaveToArcade}
      />
    );
  }

  return null;
}
