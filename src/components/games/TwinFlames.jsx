import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import palmsRain from '../../assets/gifs/palms_rain.gif';
import './TwinFlames.css';

// ── Seed word pools ──────────────────────────────────────────────
const SEEDS = {
  classic: [
    'Moon', 'Fire', 'River', 'Tree', 'Star', 'Salt', 'Wolf', 'Glass',
    'Crow', 'Iron', 'Honey', 'Storm', 'Wing', 'Shadow', 'Lantern',
    'Bridge', 'Crown', 'Mirror', 'Garden', 'Compass', 'Anchor', 'Petal',
    'Knife', 'Bone', 'Smoke', 'Velvet', 'Thunder', 'Cradle', 'Pulse',
    'Comet', 'Tide', 'Saint', 'Throne', 'Vault', 'Pearl', 'Drift',
    'Spire', 'Whale', 'Cathedral', 'Ribbon', 'Marrow', 'Cavern',
    'Lighthouse', 'Frost', 'Halo', 'Mask', 'Echo', 'Ember', 'Hollow',
    'Witch', 'Saint', 'Maze', 'Tongue', 'Veil', 'Coil', 'Husk',
  ],
  primal: [
    'Blood', 'Bone', 'Ash', 'Salt', 'Smoke', 'Skin', 'Lung', 'Marrow',
    'Tooth', 'Claw', 'Hunger', 'Wound', 'Howl', 'Pyre', 'Tomb',
    'Ruin', 'Tar', 'Soot', 'Husk', 'Pelt', 'Sinew', 'Gristle',
    'Mud', 'Reek', 'Cinder', 'Ichor', 'Spit', 'Marrow', 'Gut',
    'Char', 'Sap', 'Rust', 'Mold', 'Stink', 'Spine', 'Wax', 'Pitch',
  ],
  cosmic: [
    'Vortex', 'Cathedral', 'Threshold', 'Lacuna', 'Reverie', 'Cipher',
    'Liminal', 'Vessel', 'Mantra', 'Oracle', 'Harbinger', 'Augur',
    'Reliquary', 'Apocrypha', 'Sepulchre', 'Talisman', 'Conduit',
    'Effigy', 'Mausoleum', 'Sanctum', 'Reverie', 'Susurrus', 'Penumbra',
    'Quietus', 'Asunder', 'Threshold', 'Hex', 'Geist', 'Aurora',
    'Halcyon', 'Aether', 'Eidolon', 'Phantom', 'Wraith', 'Cassiopeia',
    'Nebula', 'Singularity', 'Tessellate', 'Schism',
  ],
};

// ── Twist cards (rare, chaotic round modifiers) ──────────────────
const TWISTS = [
  {
    id: 'inverse',
    icon: '🌀',
    label: 'INVERSE',
    tagline: 'TRY NOT TO MATCH',
    desc: 'The fire turns against you. You score this round only if your words DIFFER.',
    color: 'rose',
  },
  {
    id: 'lightning',
    icon: '⚡',
    label: 'LIGHTNING',
    tagline: '15 SECONDS EACH',
    desc: 'No time to overthink. Each player has 15 seconds. Type fast or forfeit.',
    color: 'amber',
  },
  {
    id: 'rhyme',
    icon: '🎵',
    label: 'RHYME',
    tagline: 'YOUR WORD MUST RHYME',
    desc: 'Both words must rhyme with the first seed. Still trying to match each other.',
    color: 'cyan',
  },
  {
    id: 'longburn',
    icon: '🔥',
    label: 'LONG BURN',
    tagline: 'SIX LETTERS OR MORE',
    desc: 'Short words are forbidden. Reach deeper.',
    color: 'amber',
  },
  {
    id: 'shortfuse',
    icon: '◯',
    label: 'SHORT FUSE',
    tagline: 'FOUR LETTERS OR LESS',
    desc: 'Compress your mind. Four letters maximum.',
    color: 'cyan',
  },
  {
    id: 'firstletter',
    icon: '🌙',
    label: 'BOUND',
    tagline: 'A SHARED LETTER',
    desc: 'Both words must start with the same letter as the second seed.',
    color: 'violet',
  },
];

// ── Vision lines (poetic flavor on each match) ───────────────────
const VISIONS = [
  'Two minds met at {WORD}. The fire saw it first.',
  'In the smoke between {SEED1} and {SEED2}, they found {WORD}.',
  '{WORD} — spoken twice, by two voices, in the same breath.',
  'The veil thinned. {WORD} crossed through.',
  'No one will believe this happened. Both of them said {WORD}.',
  'Where {SEED1} ends and {SEED2} begins, there is only {WORD}.',
  'They were not strangers. {WORD} proved it.',
  'The fire bent toward them when they said {WORD}.',
  'Twin tongues. One word. {WORD}.',
  'Even the night went still at {WORD}.',
  'Somewhere, an old soul nodded. {WORD}.',
  'The campfire crackled an answer: {WORD}.',
];

const INVERSE_VISIONS = [
  'Two minds split clean. {WORD1} pulled north, {WORD2} pulled south. The fire was pleased.',
  'They were never the same, and tonight the fire knew it: {WORD1} and {WORD2}.',
  '{WORD1}. {WORD2}. Two paths, never crossing.',
  'The fire feeds on difference. It feasted tonight on {WORD1} and {WORD2}.',
];

// ── Ratings ─────────────────────────────────────────────────────
const RATINGS = [
  { min: 0, title: 'STRANGERS BY THE FIRE',  sub: 'Your minds passed each other in the dark.' },
  { min: 1, title: 'ONE LONELY SPARK',       sub: 'A single glimmer. Maybe the kindling is still wet.' },
  { min: 2, title: 'DISTANT FLAMES',         sub: 'Two fires on opposite shores, signalling.' },
  { min: 3, title: 'KINDRED FLAMES',         sub: 'You are not strangers anymore.' },
  { min: 4, title: 'SWORN SOULS',            sub: 'Whatever you two are doing — keep doing it.' },
  { min: 5, title: 'TWIN SOULS',             sub: 'There is no \'you\' and \'me\'. There is only the fire.' },
  { min: 6, title: 'WOVEN INTO ONE',         sub: 'Reality bends around you. Tread carefully.' },
];

// ── Difficulty config ─────────────────────────────────────────────
const DIFFICULTIES = [
  {
    id: 'classic',
    label: 'CLASSIC',
    desc: 'Common words. Higher chance of convergence. Few twists.',
    pool: ['classic'],
    twistChance: 0.15,
    color: 'cyan',
  },
  {
    id: 'primal',
    label: 'PRIMAL',
    desc: 'Raw, elemental, dark. The campfire’s native tongue.',
    pool: ['classic', 'primal'],
    twistChance: 0.30,
    color: 'amber',
  },
  {
    id: 'cosmic',
    label: 'COSMIC',
    desc: 'Mystic and abstract. Brains must reach further.',
    pool: ['cosmic', 'classic'],
    twistChance: 0.30,
    color: 'violet',
  },
  {
    id: 'wildfire',
    label: 'WILDFIRE',
    desc: 'All pools. Twists in nearly every round. Chaos.',
    pool: ['classic', 'primal', 'cosmic'],
    twistChance: 0.70,
    color: 'rose',
  },
];

// ── Round count options ───────────────────────────────────────────
const ROUND_OPTIONS = [3, 5, 7, 10];

// ── Helpers ──────────────────────────────────────────────────────
function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickSeedPair(difficulty, exclude = []) {
  const allWords = difficulty.pool.flatMap(p => SEEDS[p]);
  const blocked = new Set(exclude.map(w => normalize(w)));
  const available = allWords.filter(w => !blocked.has(normalize(w)));
  const pool = available.length >= 2 ? available : allWords;

  let a = pick(pool);
  let b = pick(pool);
  let guard = 0;
  while (normalize(a) === normalize(b) && guard++ < 20) {
    b = pick(pool);
  }
  return [a, b];
}

function normalize(w) {
  if (!w) return '';
  return String(w).toLowerCase().trim().replace(/[^a-z]/g, '');
}

function wordsMatch(a, b) {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  // simple plural tolerance: cat / cats
  if (na + 's' === nb || nb + 's' === na) return true;
  // simple -ing tolerance: run / running (drop -ing)
  if (na + 'ing' === nb || nb + 'ing' === na) return true;
  // simple -ed tolerance: burn / burned
  if (na + 'ed' === nb || nb + 'ed' === na) return true;
  return false;
}

function rhymes(a, seed) {
  const na = normalize(a);
  const ns = normalize(seed);
  if (na.length < 2 || ns.length < 2) return false;
  // last 2 chars match — loose but works for party play
  return na.slice(-2) === ns.slice(-2);
}

function pickVision(template, word, seed1, seed2) {
  return template
    .replace('{WORD}', word.toUpperCase())
    .replace('{WORD1}', word.toUpperCase())
    .replace('{WORD2}', '')
    .replace('{SEED1}', seed1.toUpperCase())
    .replace('{SEED2}', seed2.toUpperCase());
}

function pickInverseVision(w1, w2) {
  return pick(INVERSE_VISIONS)
    .replace('{WORD1}', w1.toUpperCase())
    .replace('{WORD2}', w2.toUpperCase());
}

function ratingFor(matches) {
  let r = RATINGS[0];
  for (const cand of RATINGS) {
    if (matches >= cand.min) r = cand;
  }
  return r;
}

// ── Shell wrapper ────────────────────────────────────────────────
function Shell({ onLeave, children }) {
  return (
    <div className="game-wrapper tf-wrapper">
      <div className="game-banner">
        <img src={palmsRain} alt="" aria-hidden="true" className="game-banner-gif tf-banner-gif" />
        <div className="game-banner-overlay" />
        <div className="game-banner-scan" />
        <div className="game-banner-content">
          <p className="tf-logo">// TWIN FLAMES</p>
          <p className="tf-tagline">A PSYCHIC MIND-MELD AROUND THE FIRE</p>
        </div>
        <button className="game-back-btn" onClick={onLeave}>← ARCADE</button>
      </div>
      <div className="game-body">{children}</div>
    </div>
  );
}

// ── Setup ───────────────────────────────────────────────────────
function SetupScreen({ onStart, onLeave, lastConfig }) {
  const [p1, setP1] = useState(lastConfig?.names?.[0] ?? '');
  const [p2, setP2] = useState(lastConfig?.names?.[1] ?? '');
  const [difficultyId, setDifficultyId] = useState(lastConfig?.difficultyId ?? 'primal');
  const [rounds, setRounds] = useState(lastConfig?.rounds ?? 5);
  const [error, setError] = useState('');

  const handleStart = () => {
    const a = p1.trim();
    const b = p2.trim();
    if (!a || !b) { setError('Both flames need a name.'); return; }
    if (a.toLowerCase() === b.toLowerCase()) { setError('Two distinct souls, please.'); return; }
    onStart({ names: [a, b], difficultyId, rounds });
  };

  return (
    <Shell onLeave={onLeave}>
      <div className="game-screen tf-screen-wide">
        <div className="game-card tf-card--night">
          <p className="tf-section-title">SIT BY THE FIRE</p>
          <p className="tf-section-sub">
            Two minds. One phone. Pass it back and forth.
            <br/>The fire will know if you're truly connected.
          </p>

          <div className="tf-name-grid">
            <div className="tf-name-cell tf-name-cell--violet">
              <span className="tf-name-tag">🔮 FLAME ONE</span>
              <input
                className="tf-input"
                type="text"
                placeholder="Their name"
                maxLength={18}
                autoComplete="off"
                value={p1}
                onChange={e => { setP1(e.target.value); setError(''); }}
              />
            </div>
            <div className="tf-name-cell tf-name-cell--cyan">
              <span className="tf-name-tag">✨ FLAME TWO</span>
              <input
                className="tf-input"
                type="text"
                placeholder="Their name"
                maxLength={18}
                autoComplete="off"
                value={p2}
                onChange={e => { setP2(e.target.value); setError(''); }}
              />
            </div>
          </div>

          <p className="tf-label" style={{ marginTop: '1.4rem' }}>SEED POOL</p>
          <div className="tf-difficulty-grid">
            {DIFFICULTIES.map(d => (
              <button
                key={d.id}
                className={`tf-diff-card tf-diff-card--${d.color}${difficultyId === d.id ? ' tf-diff-card--on' : ''}`}
                onClick={() => setDifficultyId(d.id)}
                type="button"
              >
                <span className="tf-diff-label">{d.label}</span>
                <span className="tf-diff-desc">{d.desc}</span>
              </button>
            ))}
          </div>

          <p className="tf-label" style={{ marginTop: '1.4rem' }}>ROUNDS</p>
          <div className="tf-rounds-row">
            {ROUND_OPTIONS.map(n => (
              <button
                key={n}
                className={`tf-round-pip${rounds === n ? ' tf-round-pip--on' : ''}`}
                onClick={() => setRounds(n)}
                type="button"
              >
                {n}
              </button>
            ))}
          </div>

          {error && <p className="tf-error">// {error}</p>}

          <button className="game-btn game-btn--violet" style={{ marginTop: '1.5rem' }} onClick={handleStart}>
            LIGHT THE FLAMES →
          </button>
        </div>

        <div className="tf-how-to">
          <p className="tf-how-title">THE RITUAL</p>
          <ol className="tf-how-list">
            <li>The fire reveals <span className="tf-hi">two seed words</span> to both of you.</li>
            <li>Pass the phone. Each player <span className="tf-hi">secretly types one word</span> that bridges the seeds.</li>
            <li>On the count of three, both words are revealed at once.</li>
            <li><span className="tf-hi--violet">MATCH</span> = your minds converged. An ember is earned. A vision is given.</li>
            <li><span className="tf-hi--rose">MISS</span> = your two words become the next round's seeds. The chain continues.</li>
            <li>Watch for <span className="tf-hi">Echoes from the Fire</span> — twist cards that warp the rules.</li>
            <li>Most embers at the end claims the title of <span className="tf-hi">Twin Souls</span>.</li>
          </ol>
        </div>
      </div>
    </Shell>
  );
}

// ── Round intro / seed reveal ───────────────────────────────────
function RoundIntroScreen({ roundNum, totalRounds, seeds, twist, onReady, onLeave, embers, chain }) {
  return (
    <Shell onLeave={onLeave}>
      <div className="game-screen tf-screen-wide">
        <div className="game-card tf-card--night tf-fade-in">
          <div className="tf-round-bar">
            <span className="tf-round-badge">ROUND {roundNum} / {totalRounds}</span>
            <span className="tf-ember-tally">🔥 {embers} embers</span>
          </div>

          <p className="tf-section-title">THE FIRE WHISPERS</p>
          <p className="tf-section-sub">Two seeds. Bridge them with a single word.</p>

          <div className="tf-seed-row">
            <div className="tf-seed tf-seed--left">
              <span className="tf-seed-tag">SEED I</span>
              <p className="tf-seed-word">{seeds[0]}</p>
            </div>
            <div className="tf-seed-amp" aria-hidden="true">+</div>
            <div className="tf-seed tf-seed--right">
              <span className="tf-seed-tag">SEED II</span>
              <p className="tf-seed-word">{seeds[1]}</p>
            </div>
          </div>

          {twist && (
            <div className={`tf-twist-card tf-twist-card--${twist.color}`}>
              <div className="tf-twist-header">
                <span className="tf-twist-icon">{twist.icon}</span>
                <div>
                  <p className="tf-twist-label">ECHO FROM THE FIRE — {twist.label}</p>
                  <p className="tf-twist-tagline">{twist.tagline}</p>
                </div>
              </div>
              <p className="tf-twist-desc">{twist.desc}</p>
            </div>
          )}

          {chain && chain.length > 0 && (
            <div className="tf-chain">
              <p className="tf-chain-label">// CHAIN OF DRIFT</p>
              <p className="tf-chain-words">
                {chain.map((w, i) => (
                  <span key={i}>
                    <span className="tf-chain-word">{w}</span>
                    {i < chain.length - 1 && <span className="tf-chain-arrow"> → </span>}
                  </span>
                ))}
              </p>
            </div>
          )}

          <button className="game-btn game-btn--violet" style={{ marginTop: '1.25rem' }} onClick={onReady}>
            BEGIN — PASS PHONE TO FIRST FLAME →
          </button>
        </div>
      </div>
    </Shell>
  );
}

// ── Handoff between players ─────────────────────────────────────
function HandoffScreen({ playerName, label, hint, onReady, onLeave }) {
  return (
    <Shell onLeave={onLeave}>
      <div className="game-screen tf-screen-wide">
        <div className="game-card tf-card--night tf-card--centered tf-fade-in">
          <div className="tf-pass-icon" aria-hidden="true">🤲</div>
          <p className="tf-label">{label}</p>
          <p className="tf-big-name">{playerName}</p>
          <p className="tf-hint" style={{ margin: '1rem 0 1.25rem' }}>{hint}</p>
          <button className="game-btn game-btn--cyan" onClick={onReady}>
            I'M READY → SHOW ME
          </button>
        </div>
      </div>
    </Shell>
  );
}

// ── Input screen for current player ─────────────────────────────
function InputScreen({ playerName, seeds, twist, timeLimit, onSubmit, onLeave, opponentSubmitted }) {
  const [word, setWord] = useState('');
  const [error, setError] = useState('');
  const [timeLeft, setTimeLeft] = useState(timeLimit ?? null);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (timeLimit == null) return;
    const id = setInterval(() => {
      setTimeLeft(t => {
        if (t == null) return t;
        if (t <= 1) {
          clearInterval(id);
          // auto-forfeit
          onSubmit('', { forfeit: true });
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const validate = (raw) => {
    const w = raw.trim();
    if (!w) return 'Speak a word into the fire.';
    if (w.split(/\s+/).length > 1) return 'One word only.';
    const n = normalize(w);
    if (n.length < 2) return 'At least two letters.';
    if (normalize(seeds[0]) === n || normalize(seeds[1]) === n) return 'Cannot be a seed word.';
    if (twist?.id === 'longburn' && n.length < 6) return 'LONG BURN — six letters or more.';
    if (twist?.id === 'shortfuse' && n.length > 4) return 'SHORT FUSE — four letters or less.';
    if (twist?.id === 'rhyme' && !rhymes(w, seeds[0])) return `RHYME — must rhyme with ${seeds[0].toUpperCase()}.`;
    if (twist?.id === 'firstletter') {
      const target = normalize(seeds[1])[0];
      if (n[0] !== target) return `BOUND — must start with ${target.toUpperCase()}.`;
    }
    return '';
  };

  const handleSubmit = (e) => {
    e?.preventDefault?.();
    const err = validate(word);
    if (err) { setError(err); return; }
    onSubmit(word.trim());
  };

  const urgent = timeLeft != null && timeLeft <= 5;

  return (
    <Shell onLeave={onLeave}>
      <div className="game-screen tf-screen-wide">
        <div className="game-card tf-card--night tf-fade-in">
          <div className="tf-round-bar">
            <span className="tf-current-player">{playerName.toUpperCase()}'S TURN</span>
            {timeLeft != null && (
              <span className={`tf-clock${urgent ? ' tf-clock--urgent' : ''}`}>
                ⚡ {String(timeLeft).padStart(2, '0')}s
              </span>
            )}
          </div>

          <div className="tf-seed-row tf-seed-row--compact">
            <div className="tf-seed tf-seed--left">
              <span className="tf-seed-tag">SEED I</span>
              <p className="tf-seed-word tf-seed-word--sm">{seeds[0]}</p>
            </div>
            <div className="tf-seed-amp tf-seed-amp--sm" aria-hidden="true">+</div>
            <div className="tf-seed tf-seed--right">
              <span className="tf-seed-tag">SEED II</span>
              <p className="tf-seed-word tf-seed-word--sm">{seeds[1]}</p>
            </div>
          </div>

          {twist && (
            <div className={`tf-twist-pill tf-twist-pill--${twist.color}`}>
              {twist.icon} {twist.label} — {twist.tagline}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <p className="tf-hint" style={{ margin: '1rem 0 0.6rem' }}>
              {twist?.id === 'inverse'
                ? 'Type a word your partner WON\'T guess.'
                : 'Type the word that links these two. Trust your gut.'}
            </p>
            <input
              ref={inputRef}
              className="tf-input tf-input--big"
              type="text"
              placeholder="ONE WORD"
              maxLength={25}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              value={word}
              onChange={e => { setWord(e.target.value); setError(''); }}
            />
            {error && <p className="tf-error">// {error}</p>}
            <button
              className="game-btn game-btn--violet"
              style={{ marginTop: '1rem' }}
              type="submit"
              disabled={!word.trim()}
            >
              LOCK IT IN — PASS PHONE →
            </button>
          </form>

          {opponentSubmitted && (
            <p className="tf-hint" style={{ marginTop: '0.75rem', opacity: 0.6 }}>
              Your partner has already locked their word.
            </p>
          )}
        </div>
      </div>
    </Shell>
  );
}

// ── Countdown 3-2-1 ─────────────────────────────────────────────
function CountdownScreen({ onDone, onLeave }) {
  const [n, setN] = useState(3);

  useEffect(() => {
    if (n <= 0) {
      const id = setTimeout(onDone, 650);
      return () => clearTimeout(id);
    }
    const id = setTimeout(() => setN(v => v - 1), 850);
    return () => clearTimeout(id);
  }, [n, onDone]);

  return (
    <Shell onLeave={onLeave}>
      <div className="game-screen tf-screen-wide">
        <div className="game-card tf-card--night tf-card--centered">
          <p className="tf-label">THE FIRE IS WATCHING</p>
          <p className="tf-countdown" key={n}>
            {n > 0 ? n : '✦'}
          </p>
          <p className="tf-hint">
            {n > 0 ? 'Both eyes on the screen.' : 'REVEAL...'}
          </p>
        </div>
      </div>
    </Shell>
  );
}

// ── Reveal: show both words ─────────────────────────────────────
function RevealScreen({
  names, words, twist, matched, embers, totalRounds, roundNum,
  visionText, onContinue, isLast, onLeave,
}) {
  const inverseGoal = twist?.id === 'inverse';
  const roundWon = inverseGoal ? !matched : matched;
  const bothPresent = !words[0]?.forfeit && !words[1]?.forfeit && words[0] && words[1];

  let headline, sub;
  if (matched && roundWon) {
    headline = '✦ CONVERGENCE ✦';
    sub = '+1 EMBER';
  } else if (matched && !roundWon) {
    headline = '✦ MIRRORED ✦';
    sub = 'you weren\'t supposed to match — no ember';
  } else if (!matched && roundWon) {
    headline = '✦ DIVERGENCE ✦';
    sub = '+1 EMBER';
  } else if (bothPresent) {
    headline = '... DRIFT ...';
    sub = 'no convergence — your words become the next seeds';
  } else {
    headline = '... LOST IN THE FIRE ...';
    sub = 'forfeit — no ember';
  }

  return (
    <Shell onLeave={onLeave}>
      <div className="game-screen tf-screen-wide">
        <div className={`game-card tf-card--reveal${roundWon ? ' tf-card--match' : ' tf-card--miss'}`}>
          <div className="tf-round-bar">
            <span className="tf-round-badge">ROUND {roundNum} / {totalRounds}</span>
            <span className="tf-ember-tally">🔥 {embers} embers</span>
          </div>

          <div className="tf-reveal-row">
            <div className="tf-reveal-cell tf-reveal-cell--violet">
              <p className="tf-reveal-name">{names[0]}</p>
              <p className="tf-reveal-word">
                {words[0]?.forfeit ? '— FORFEIT —' : (words[0] || '—')}
              </p>
            </div>
            <div className="tf-reveal-divider" aria-hidden="true">
              {matched ? '◇' : '×'}
            </div>
            <div className="tf-reveal-cell tf-reveal-cell--cyan">
              <p className="tf-reveal-name">{names[1]}</p>
              <p className="tf-reveal-word">
                {words[1]?.forfeit ? '— FORFEIT —' : (words[1] || '—')}
              </p>
            </div>
          </div>

          <div className="tf-verdict">
            <p className={`tf-verdict-big ${roundWon ? 'tf-verdict-big--match' : 'tf-verdict-big--miss'}`}>
              {headline}
            </p>
            <p className="tf-verdict-sub">{sub}</p>
          </div>

          {visionText && (
            <div className="tf-vision">
              <p className="tf-vision-label">// THE FIRE SPEAKS</p>
              <p className="tf-vision-text">"{visionText}"</p>
            </div>
          )}

          <button className="game-btn game-btn--violet" style={{ marginTop: '1.25rem' }} onClick={onContinue}>
            {isLast ? 'SEE FINAL VERDICT →' : 'NEXT ROUND →'}
          </button>
        </div>
      </div>
    </Shell>
  );
}

// ── Final screen ────────────────────────────────────────────────
function FinalScreen({ names, embers, totalRounds, history, onPlayAgain, onLeave }) {
  const rating = ratingFor(embers);
  const pct = totalRounds > 0 ? Math.round((embers / totalRounds) * 100) : 0;

  return (
    <Shell onLeave={onLeave}>
      <div className="game-screen tf-screen-wide">
        <div className="game-card tf-card--final">
          <p className="tf-label">THE FIRE HAS SPOKEN</p>
          <div className="tf-final-icon" aria-hidden="true">
            {embers >= 5 ? '🔥' : embers >= 3 ? '✨' : embers >= 1 ? '🕯️' : '🌑'}
          </div>
          <p className="tf-final-title">{rating.title}</p>
          <p className="tf-final-names">{names[0]} & {names[1]}</p>
          <p className="tf-final-sub">{rating.sub}</p>

          <div className="tf-final-stats">
            <div className="tf-final-stat">
              <span className="tf-final-stat-val">{embers}</span>
              <span className="tf-final-stat-lbl">EMBERS</span>
            </div>
            <div className="tf-final-stat-divider" />
            <div className="tf-final-stat">
              <span className="tf-final-stat-val">{totalRounds}</span>
              <span className="tf-final-stat-lbl">ROUNDS</span>
            </div>
            <div className="tf-final-stat-divider" />
            <div className="tf-final-stat">
              <span className="tf-final-stat-val">{pct}%</span>
              <span className="tf-final-stat-lbl">SYNC</span>
            </div>
          </div>
        </div>

        {history.length > 0 && (
          <div className="game-card" style={{ marginTop: '1rem' }}>
            <p className="tf-label">// THE CHRONICLE</p>
            <ul className="tf-history">
              {history.map((h, i) => (
                <li key={i} className={`tf-history-row${h.matched ? ' tf-history-row--match' : ''}`}>
                  <span className="tf-history-num">{String(i + 1).padStart(2, '0')}</span>
                  <span className="tf-history-seeds">
                    {h.seeds[0]} <span className="tf-history-plus">+</span> {h.seeds[1]}
                  </span>
                  <span className="tf-history-arrow">→</span>
                  <span className="tf-history-words">
                    <span className="tf-history-word">{h.words[0]?.forfeit ? '⊘' : (h.words[0] || '—')}</span>
                    <span className="tf-history-vs">·</span>
                    <span className="tf-history-word">{h.words[1]?.forfeit ? '⊘' : (h.words[1] || '—')}</span>
                  </span>
                  <span className={`tf-history-result${h.matched ? ' tf-history-result--match' : ''}`}>
                    {h.matched ? '✦' : '×'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <button className="game-btn game-btn--violet" style={{ marginTop: '1rem' }} onClick={onPlayAgain}>
          RE-LIGHT THE FIRE →
        </button>
      </div>
    </Shell>
  );
}

// ── Main controller ─────────────────────────────────────────────
export default function TwinFlames() {
  const navigate = useNavigate();

  const [phase, setPhase] = useState('setup');
  const [config, setConfig] = useState(null);
  const [lastConfig, setLastConfig] = useState(null);
  const [roundIdx, setRoundIdx] = useState(0);
  const [seeds, setSeeds] = useState(['', '']);
  const [twist, setTwist] = useState(null);
  const [wordP1, setWordP1] = useState(null);
  const [wordP2, setWordP2] = useState(null);
  const [matched, setMatched] = useState(false);
  const [visionText, setVisionText] = useState('');
  const [embers, setEmbers] = useState(0);
  const [history, setHistory] = useState([]);
  const [usedWords, setUsedWords] = useState(new Set());
  const [chain, setChain] = useState([]);

  useEffect(() => {
    document.title = 'Twin Flames';
    return () => { document.title = 'Arcade Vault'; };
  }, []);

  const leaveToArcade = () => navigate('/games');

  const startGame = (cfg) => {
    const difficulty = DIFFICULTIES.find(d => d.id === cfg.difficultyId);
    const [s1, s2] = pickSeedPair(difficulty, []);
    const twistRoll = Math.random() < difficulty.twistChance ? pick(TWISTS) : null;

    setConfig(cfg);
    setLastConfig(cfg);
    setRoundIdx(0);
    setSeeds([s1, s2]);
    setTwist(twistRoll);
    setWordP1(null);
    setWordP2(null);
    setMatched(false);
    setVisionText('');
    setEmbers(0);
    setHistory([]);
    setUsedWords(new Set([normalize(s1), normalize(s2)]));
    setChain([s1, s2]);
    setPhase('round-intro');
  };

  const startRoundOf = (nextRoundIdx, prevState) => {
    // prevState may be { matched: bool, miss1, miss2 } from the round that just ended.
    const difficulty = DIFFICULTIES.find(d => d.id === config.difficultyId);
    let s1, s2;
    let chainNext;

    const lastResultMatched = prevState?.matched ?? false;
    const inverseWasActive  = prevState?.twist?.id === 'inverse';
    const treatAsConvergence = lastResultMatched || (inverseWasActive && !lastResultMatched);

    if (!treatAsConvergence && prevState?.miss1 && prevState?.miss2) {
      // miss → previous words become next seeds (chain continues)
      s1 = prevState.miss1;
      s2 = prevState.miss2;
      chainNext = [...(prevState.chainBefore || []), s1, s2];
    } else {
      // match → fresh seeds, fresh chain
      [s1, s2] = pickSeedPair(difficulty, [...usedWords].slice(-20));
      chainNext = [s1, s2];
    }

    const twistRoll = Math.random() < difficulty.twistChance ? pick(TWISTS) : null;

    setRoundIdx(nextRoundIdx);
    setSeeds([s1, s2]);
    setTwist(twistRoll);
    setWordP1(null);
    setWordP2(null);
    setMatched(false);
    setVisionText('');
    setChain(chainNext);
    setUsedWords(prev => new Set([...prev, normalize(s1), normalize(s2)]));
    setPhase('round-intro');
  };

  const onP1Submit = (raw, meta) => {
    setWordP1({ value: raw, forfeit: !!meta?.forfeit });
    setPhase('handoff-p2');
  };

  const onP2Submit = (raw, meta) => {
    const w1 = wordP1;
    const w2 = { value: raw, forfeit: !!meta?.forfeit };
    setWordP2(w2);

    const inverseActive = twist?.id === 'inverse';
    const bothPresent = !w1.forfeit && !w2.forfeit;
    const wordsAreMatch = bothPresent && wordsMatch(w1.value, w2.value);
    const roundWon = inverseActive ? (bothPresent && !wordsAreMatch) : wordsAreMatch;

    setMatched(wordsAreMatch);

    let vision = '';
    if (roundWon) {
      if (inverseActive) {
        vision = pickInverseVision(w1.value, w2.value);
      } else {
        vision = pickVision(pick(VISIONS), w1.value, seeds[0], seeds[1]);
      }
    }
    setVisionText(vision);

    if (roundWon) setEmbers(e => e + 1);

    setHistory(h => [
      ...h,
      {
        seeds: [...seeds],
        words: [w1, w2],
        matched: wordsAreMatch,
        twist,
        roundWon,
      },
    ]);

    if (bothPresent) {
      setUsedWords(prev => new Set([...prev, normalize(w1.value), normalize(w2.value)]));
    }

    setPhase('countdown');
  };

  const handleRevealContinue = () => {
    const isLast = roundIdx + 1 >= config.rounds;
    if (isLast) {
      setPhase('final');
      return;
    }

    // The previous round's actual word-match outcome decides whether the chain
    // carries over. INVERSE flips the "score", but the chain rule still follows
    // the literal word match: if minds drifted apart, drift continues.
    const miss = !matched && wordP1 && wordP2 && !wordP1.forfeit && !wordP2.forfeit;

    startRoundOf(roundIdx + 1, {
      matched,
      twist,
      miss1: miss ? wordP1.value : null,
      miss2: miss ? wordP2.value : null,
      chainBefore: chain,
    });
  };

  const playAgain = () => {
    setPhase('setup');
  };

  // ── Render based on phase ──────────────────────────────────────
  if (phase === 'setup') {
    return <SetupScreen onStart={startGame} onLeave={leaveToArcade} lastConfig={lastConfig} />;
  }

  if (phase === 'round-intro') {
    return (
      <RoundIntroScreen
        roundNum={roundIdx + 1}
        totalRounds={config.rounds}
        seeds={seeds}
        twist={twist}
        embers={embers}
        chain={chain.length > 2 ? chain.slice(-10, -2) : []}
        onReady={() => setPhase('handoff-p1')}
        onLeave={leaveToArcade}
      />
    );
  }

  if (phase === 'handoff-p1') {
    return (
      <HandoffScreen
        playerName={config.names[0]}
        label="PASS THE PHONE TO"
        hint="Look at the seeds. Type the word that bridges them. Keep your screen tilted away from your partner."
        onReady={() => setPhase('input-p1')}
        onLeave={leaveToArcade}
      />
    );
  }

  if (phase === 'input-p1') {
    return (
      <InputScreen
        playerName={config.names[0]}
        seeds={seeds}
        twist={twist}
        timeLimit={twist?.id === 'lightning' ? 15 : null}
        onSubmit={onP1Submit}
        onLeave={leaveToArcade}
      />
    );
  }

  if (phase === 'handoff-p2') {
    return (
      <HandoffScreen
        playerName={config.names[1]}
        label="PASS THE PHONE TO"
        hint={`${config.names[0]} has locked their word. Now you. No peeking, no whispering.`}
        onReady={() => setPhase('input-p2')}
        onLeave={leaveToArcade}
      />
    );
  }

  if (phase === 'input-p2') {
    return (
      <InputScreen
        playerName={config.names[1]}
        seeds={seeds}
        twist={twist}
        timeLimit={twist?.id === 'lightning' ? 15 : null}
        onSubmit={onP2Submit}
        opponentSubmitted
        onLeave={leaveToArcade}
      />
    );
  }

  if (phase === 'countdown') {
    return <CountdownScreen onDone={() => setPhase('reveal')} onLeave={leaveToArcade} />;
  }

  if (phase === 'reveal') {
    return (
      <RevealScreen
        names={config.names}
        words={[wordP1?.forfeit ? { forfeit: true } : wordP1?.value, wordP2?.forfeit ? { forfeit: true } : wordP2?.value]}
        seeds={seeds}
        twist={twist}
        matched={matched}
        embers={embers}
        totalRounds={config.rounds}
        roundNum={roundIdx + 1}
        visionText={visionText}
        onContinue={handleRevealContinue}
        isLast={roundIdx + 1 >= config.rounds}
        onLeave={leaveToArcade}
      />
    );
  }

  if (phase === 'final') {
    return (
      <FinalScreen
        names={config.names}
        embers={embers}
        totalRounds={config.rounds}
        history={history}
        onPlayAgain={playAgain}
        onLeave={leaveToArcade}
      />
    );
  }

  return null;
}
