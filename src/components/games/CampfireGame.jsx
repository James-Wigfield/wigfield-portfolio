import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import smokingCity from '../../assets/gifs/smoking_city.gif';
import './CampfireGame.css';

const SETTINGS = [
  'A fog-covered lake at midnight',
  'An abandoned ranger station in the pines',
  'Deep in a forest with no cell signal',
  'A crumbling old bridge over a dry gorge',
  'The mouth of an old mine shaft',
  'A ghost town with one lit window',
  'A lighthouse on a stormy coast',
  'A mountain trail that keeps getting narrower',
  'A deserted campsite left in a hurry',
  'An underground cave with strange carvings',
  'A carnival that only appears after dark',
  'A house at the dead end of an unmarked road',
  'A cemetery with fresh flowers on old graves',
  'A frozen lake with something moving below',
  'A field where compasses spin in circles',
];

const CHARACTERS = [
  'A park ranger who never speaks above a whisper',
  'A child playing alone at the edge of the trees',
  'An old woman who already knew your name',
  'A figure standing just beyond the firelight',
  'Someone who looks exactly like you',
  'A hitchhiker with no shadow',
  'A photographer whose camera shows tomorrow',
  'A friendly dog that died three years ago',
  'A hunter who won\'t say what he\'s tracking',
  'A creature that only appears in reflections',
  'Twin strangers who finish each other\'s sentences',
  'A voice that comes from underground',
  'A fisherman with too many fingers',
  'A traveller who arrived before you did',
  'A local who insists this place doesn\'t exist',
  'A milf with big tits and small feet',
];

const OBJECTS = [
  'A compass that always points toward you',
  'A music box playing a song no one ever wrote',
  'A photograph with one extra person in it',
  'A diary with tomorrow\'s date',
  'A locked door with no hinges',
  'A mirror showing a different room',
  'A small box with a midget inside',
  'A phone that keeps receiving calls from unknown',
  'A map with your name marked as X',
  'A fire that can\'t be put out',
  'A bell that rings with no wind',
  'A 13 inch rainbow dragon dildo',
  'A child\'s shoe found filled with sand',
  'A watch ticking backward',
  'A lantern that lights the path behind you',
  'A folded note that reads "Don\'t look up"',
  'A ring pulled from the bottom of the lake',
];

const TWISTS = [
  'The protagonist was the monster all along',
  'It had already happened before — to someone else — exactly the same way',
  'The scariest part was what nobody said',
  'They made it out, but left something behind',
  'It was real, and it followed them home',
  'The whole thing was meant as a warning',
  'Someone in the group had been there before',
  'It ends exactly where it began',
  'There was never any danger — until they believed there was',
  'The thing they were running from was trying to help',
];

const VOTE_CATS = [
  { key: 'embers', label: 'EMBERS', desc: 'Scary & atmospheric',    icon: '🔥', color: 'rose'   },
  { key: 'spark',  label: 'SPARK',  desc: 'Creative & original',    icon: '✨', color: 'violet' },
  { key: 'flame',  label: 'FLAME',  desc: 'Performance & delivery', icon: '🎭', color: 'amber'  },
];

const DEFAULT_VOTE = Object.fromEntries(VOTE_CATS.map(c => [c.key, 0]));

const STORY_SECONDS = 2.5 * 60; // 2.5 minutes

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickPrompt() {
  return {
    setting:   pick(SETTINGS),
    character: pick(CHARACTERS),
    object:    pick(OBJECTS),
    twist:     pick(TWISTS),
  };
}

function Shell({ onLeave, children }) {
  return (
    <div className="game-wrapper">
      <div className="game-banner">
        <img src={smokingCity} alt="" aria-hidden="true" className="game-banner-gif cf-banner-gif" />
        <div className="game-banner-overlay" />
        <div className="game-banner-scan" />
        <div className="game-banner-content">
          <p className="cf-logo">// CAMPFIRE LEGENDS</p>
          <p className="cf-tagline">A STORYTELLING GAME FOR THE DARK</p>
        </div>
        <button className="game-back-btn" onClick={onLeave}>← ARCADE</button>
      </div>
      <div className="game-body">{children}</div>
    </div>
  );
}

function PromptCards({ prompt, compact = false }) {
  const items = [
    { cls: 'setting',   icon: '📍', label: 'SETTING',   text: prompt.setting   },
    { cls: 'character', icon: '👤', label: 'CHARACTER', text: prompt.character },
    { cls: 'object',    icon: '🔮', label: 'OBJECT',    text: prompt.object    },
    { cls: 'twist',     icon: '⚡', label: 'TWIST',     text: prompt.twist     },
  ];
  return (
    <div className={`cf-prompt-grid${compact ? ' cf-prompt-grid--compact' : ''}`}>
      {items.map(({ cls, icon, label, text }) => (
        <div key={cls} className={`cf-prompt-item cf-prompt-item--${cls}`}>
          <span className="cf-prompt-tag">{icon} {label}</span>
          <p className={`cf-prompt-text${compact ? ' cf-prompt-text--sm' : ''}`}>{text}</p>
        </div>
      ))}
    </div>
  );
}

function SetupScreen({ onStart, onLeave }) {
  const [players, setPlayers] = useState(['', '']);
  const [error, setError]     = useState('');

  const addPlayer = () => {
    if (players.length < 8) setPlayers(p => [...p, '']);
  };

  const removePlayer = (i) => {
    if (players.length <= 2) return;
    setPlayers(p => p.filter((_, idx) => idx !== i));
  };

  const updatePlayer = (i, val) => {
    setPlayers(p => { const n = [...p]; n[i] = val; return n; });
    setError('');
  };

  const handleStart = () => {
    const names = players.map(p => p.trim()).filter(Boolean);
    if (names.length < 2) { setError('You need at least 2 players.'); return; }
    if (new Set(names.map(n => n.toLowerCase())).size < names.length) {
      setError('Each player needs a unique name.');
      return;
    }
    onStart(names);
  };

  return (
    <Shell onLeave={onLeave}>
      <div className="game-screen">
        <div className="game-card">
          <p className="cf-section-title">GATHER ROUND THE FIRE</p>
          <p className="cf-section-sub">Enter the names of everyone sitting with you — 2 to 8 players.</p>

          <div className="cf-player-inputs">
            {players.map((p, i) => (
              <div key={i} className="cf-player-row">
                <span className="cf-player-num">{i + 1}</span>
                <input
                  className="cf-input"
                  type="text"
                  placeholder={`Player ${i + 1}`}
                  maxLength={20}
                  value={p}
                  autoComplete="off"
                  onChange={e => updatePlayer(i, e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && i === players.length - 1 && players.length < 8) addPlayer();
                  }}
                />
                {players.length > 2 && (
                  <button className="cf-remove-btn" onClick={() => removePlayer(i)} aria-label="Remove player">×</button>
                )}
              </div>
            ))}
          </div>

          {players.length < 8 && (
            <button className="game-btn game-btn--ghost" onClick={addPlayer}>
              + ADD PLAYER
            </button>
          )}

          {error && <p className="cf-error">// {error}</p>}

          <button className="game-btn game-btn--amber" style={{ marginTop: '1rem' }} onClick={handleStart}>
            LIGHT THE FIRE →
          </button>
        </div>

        <div className="cf-how-to">
          <p className="cf-how-title">HOW TO PLAY</p>
          <ol className="cf-how-list">
            <li>Each player takes a turn as the <span className="cf-hi">Storyteller</span></li>
            <li>Get 3 story elements + a <span className="cf-hi">mandatory twist</span> to weave in</li>
            <li>Tell your campfire legend — you have <span className="cf-hi">90 seconds</span></li>
            <li>Everyone else votes: <span className="cf-hi--rose">Embers</span> · <span className="cf-hi--violet">Spark</span> · <span className="cf-hi">Flame</span></li>
            <li>Most points after all rounds wins the night</li>
          </ol>
        </div>
      </div>
    </Shell>
  );
}

function PromptScreen({ storyteller, prompt, roundNum, totalRounds, onReady, onLeave }) {
  const [revealed, setRevealed] = useState(false);

  return (
    <Shell onLeave={onLeave}>
      <div className="game-screen">
        {!revealed ? (
          <div className="game-card cf-card--night">
            <p className="cf-round-badge">ROUND {roundNum} / {totalRounds}</p>
            <div className="cf-moon-icon" aria-hidden="true">🌑</div>
            <p className="cf-section-title">EYES CLOSED</p>
            <p className="cf-section-sub">
              Everyone except <span className="cf-hi">{storyteller}</span> — look away from the screen.
            </p>
            <p className="cf-hint" style={{ margin: '1rem 0' }}>
              When ready, {storyteller}, tap below to see your prompt.
            </p>
            <button className="game-btn game-btn--amber" onClick={() => setRevealed(true)}>
              REVEAL MY PROMPT →
            </button>
          </div>
        ) : (
          <div className="game-card">
            <p className="cf-round-badge">ROUND {roundNum} / {totalRounds}</p>
            <p className="cf-section-title">{storyteller.toUpperCase()}'S LEGEND</p>
            <p className="cf-hint" style={{ marginBottom: '1.25rem' }}>
              Weave all four elements into your story. The twist is mandatory — the group will know if you skipped it.
            </p>
            <PromptCards prompt={prompt} />
            <button className="game-btn game-btn--rose" style={{ marginTop: '1.5rem' }} onClick={onReady}>
              START TIMER — BEGIN STORY →
            </button>
          </div>
        )}
      </div>
    </Shell>
  );
}

function TimerScreen({ storyteller, prompt, onDone, onLeave }) {
  const [timeLeft, setTimeLeft] = useState(STORY_SECONDS);
  const [expired, setExpired]   = useState(false);

  useEffect(() => {
    const id = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(id); setExpired(true); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const urgent = timeLeft <= 15;
  const pct    = (timeLeft / STORY_SECONDS) * 100;
  const mm     = String(Math.floor(timeLeft / 60)).padStart(2, '0');
  const ss     = String(timeLeft % 60).padStart(2, '0');

  return (
    <Shell onLeave={onLeave}>
      <div className="game-screen">
        <div className={`game-card cf-card--timer${urgent ? ' cf-card--urgent' : ''}`}>
          <p className="cf-label">{storyteller.toUpperCase()} IS SPEAKING</p>
          <p className={`cf-timer-big${urgent ? ' cf-timer-big--urgent' : ''}`}>{mm}:{ss}</p>
          <div className="cf-timer-bar-wrap">
            <div
              className="cf-timer-bar"
              style={{ width: `${pct}%`, background: urgent ? 'var(--rose)' : 'var(--amber)' }}
            />
          </div>
          {urgent && <p className="cf-urgent-text">{expired ? 'TIME\'S UP — WRAP IT UP!' : 'RUNNING OUT OF TIME...'}</p>}
        </div>

        <div className="game-card" style={{ marginTop: '1rem' }}>
          <p className="cf-label">STORY ELEMENTS — visible to all</p>
          <PromptCards prompt={prompt} compact />
          <button className="game-btn game-btn--amber" style={{ marginTop: '1.25rem' }} onClick={onDone}>
            STORY COMPLETE — START VOTING →
          </button>
        </div>
      </div>
    </Shell>
  );
}

function VotingScreen({ storyteller, voters, onVotesCollected, onLeave }) {
  const [voterIdx,    setVoterIdx]    = useState(0);
  const [votes,       setVotes]       = useState({});
  const [currentVote, setCurrentVote] = useState(DEFAULT_VOTE);
  const [submitted,   setSubmitted]   = useState(false);

  const currentVoter = voters[voterIdx];
  const isLast       = voterIdx + 1 >= voters.length;

  const setScore = (key, val) => {
    setCurrentVote(v => ({ ...v, [key]: val === v[key] ? 0 : val }));
  };

  const submitVote = () => {
    if (Object.values(currentVote).some(v => v === 0)) return;
    setVotes(prev => ({ ...prev, [currentVoter]: { ...currentVote } }));
    setSubmitted(true);
  };

  const goNext = () => {
    if (isLast) {
      // votes state may not yet include the last voter (async), so merge explicitly
      const allVotes = { ...votes, [currentVoter]: { ...currentVote } };
      const totals = Object.values(allVotes).reduce(
        (acc, v) => ({ embers: acc.embers + v.embers, spark: acc.spark + v.spark, flame: acc.flame + v.flame }),
        { ...DEFAULT_VOTE },
      );
      onVotesCollected({ ...totals, total: totals.embers + totals.spark + totals.flame });
    } else {
      setCurrentVote(DEFAULT_VOTE);
      setSubmitted(false);
      setVoterIdx(i => i + 1);
    }
  };

  const roundTotal = currentVote.embers + currentVote.spark + currentVote.flame;
  const allRated   = Object.values(currentVote).every(v => v > 0);

  return (
    <Shell onLeave={onLeave}>
      <div className="game-screen">
        <div className="game-card cf-card--night">
          <p className="cf-voter-badge">VOTER {voterIdx + 1} OF {voters.length}</p>
          <p className="cf-section-title">Pass the phone to</p>
          <p className="cf-big-name">{currentVoter}</p>

          {!submitted ? (
            <>
              <p className="cf-hint" style={{ marginBottom: '1.5rem' }}>
                Rate <span className="cf-hi">{storyteller}</span>'s story honestly — the fire doesn't lie.
              </p>

              {VOTE_CATS.map(cat => (
                <div key={cat.key} className="cf-vote-row">
                  <div className="cf-vote-meta">
                    <span className="cf-vote-icon">{cat.icon}</span>
                    <div>
                      <p className="cf-vote-label">{cat.label}</p>
                      <p className="cf-vote-desc">{cat.desc}</p>
                    </div>
                  </div>
                  <div className="cf-vote-pips">
                    {[1, 2, 3].map(n => (
                      <button
                        key={n}
                        className={`cf-pip cf-pip--${cat.color}${currentVote[cat.key] >= n ? ' cf-pip--on' : ''}`}
                        onClick={() => setScore(cat.key, n)}
                        aria-label={`${n} out of 3`}
                      />
                    ))}
                  </div>
                </div>
              ))}

              <button
                className="game-btn game-btn--amber"
                style={{ marginTop: '1.5rem' }}
                onClick={submitVote}
                disabled={!allRated}
              >
                LOCK IN MY VOTE →
              </button>
            </>
          ) : (
            <div className="cf-vote-confirm">
              <p className="cf-big-score">
                {roundTotal}
                <span className="cf-score-denom">/ 9</span>
              </p>
              <div className="cf-vote-summary">
                {VOTE_CATS.map(cat => (
                  <span key={cat.key} className="cf-vote-chip">
                    {cat.icon} {currentVote[cat.key]}
                  </span>
                ))}
              </div>
              <p className="cf-hint" style={{ margin: '1rem 0' }}>Votes locked. Pass the phone on.</p>
              <button className="game-btn game-btn--cyan" onClick={goNext}>
                {isLast ? 'SEE RESULTS →' : 'NEXT VOTER →'}
              </button>
            </div>
          )}
        </div>
      </div>
    </Shell>
  );
}

function ResultsScreen({ storyteller, roundScores, scores, isLast, onNext, onLeave }) {
  const ranked = Object.entries(scores).sort(([, a], [, b]) => b - a);

  return (
    <Shell onLeave={onLeave}>
      <div className="game-screen">
        <div className="game-card cf-card--results">
          <p className="cf-label">ROUND COMPLETE</p>
          <p className="cf-big-name">{storyteller}</p>
          <p className="cf-results-earned">earned this round</p>
          <p className="cf-big-score">
            +{roundScores.total}
            <span className="cf-score-denom">pts</span>
          </p>
          <div className="cf-score-breakdown">
            {VOTE_CATS.map(cat => (
              <div key={cat.key} className="cf-score-row">
                <span className="cf-score-label-left">{cat.icon} {cat.label}</span>
                <span className="cf-score-val">{roundScores[cat.key]}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="game-card" style={{ marginTop: '1rem' }}>
          <p className="cf-label">FIRESIDE STANDINGS</p>
          <ul className="cf-standings">
            {ranked.map(([name, score], i) => (
              <li key={name} className={`cf-standing-row${name === storyteller ? ' cf-standing-row--active' : ''}`}>
                <span className="cf-standing-rank">{i + 1}</span>
                <span className="cf-standing-name">{name}</span>
                <span className="cf-standing-score">{score}</span>
              </li>
            ))}
          </ul>
          <button className="game-btn game-btn--amber" style={{ marginTop: '1.25rem' }} onClick={onNext}>
            {isLast ? 'SEE FINAL RANKINGS →' : 'NEXT STORYTELLER →'}
          </button>
        </div>
      </div>
    </Shell>
  );
}

function FinalScreen({ scores, onPlayAgain, onLeave }) {
  const ranked = Object.entries(scores).sort(([, a], [, b]) => b - a);
  const [winnerName, winnerScore] = ranked[0];
  const medals = ['🥇', '🥈', '🥉'];

  return (
    <Shell onLeave={onLeave}>
      <div className="game-screen">
        <div className="game-card cf-card--final">
          <p className="cf-label">LEGEND OF THE NIGHT</p>
          <div className="cf-crown" aria-hidden="true">👑</div>
          <p className="cf-winner-name">{winnerName}</p>
          <p className="cf-winner-score">{winnerScore} pts</p>
          <p className="cf-winner-sub">Their stories will be told for ages.</p>
        </div>

        <div className="game-card" style={{ marginTop: '1rem' }}>
          <p className="cf-label">FINAL STANDINGS</p>
          <ul className="cf-standings">
            {ranked.map(([name, score], i) => (
              <li key={name} className={`cf-standing-row${i === 0 ? ' cf-standing-row--winner' : ''}`}>
                <span className="cf-standing-rank">{medals[i] ?? i + 1}</span>
                <span className="cf-standing-name">{name}</span>
                <span className="cf-standing-score">{score}</span>
              </li>
            ))}
          </ul>
          <button className="game-btn game-btn--amber" style={{ marginTop: '1.25rem' }} onClick={onPlayAgain}>
            PLAY AGAIN →
          </button>
        </div>
      </div>
    </Shell>
  );
}

export default function CampfireGame() {
  const navigate = useNavigate();

  const [phase,           setPhase]           = useState('setup');
  const [players,         setPlayers]         = useState([]);
  const [scores,          setScores]          = useState({});
  const [currentRound,    setCurrentRound]    = useState(0);
  const [currentPrompt,   setCurrentPrompt]   = useState(null);
  const [lastRoundScores, setLastRoundScores] = useState(null);

  useEffect(() => {
    document.title = 'Campfire Legends';
    return () => { document.title = 'Arcade Vault'; };
  }, []);

  const leaveToArcade = () => navigate('/games');

  const startGame = (names) => {
    setPlayers(names);
    setScores(Object.fromEntries(names.map(n => [n, 0])));
    setCurrentRound(0);
    setCurrentPrompt(pickPrompt());
    setPhase('prompt');
  };

  const handleVotesCollected = (roundScores) => {
    const storyteller = players[currentRound];
    setScores(prev => ({ ...prev, [storyteller]: prev[storyteller] + roundScores.total }));
    setLastRoundScores(roundScores);
    setPhase('results');
  };

  const handleNextRound = () => {
    const next = currentRound + 1;
    if (next >= players.length) {
      setPhase('final');
    } else {
      setCurrentRound(next);
      setCurrentPrompt(pickPrompt());
      setPhase('prompt');
    }
  };

  const handlePlayAgain = () => {
    setPhase('setup');
    setPlayers([]);
    setScores({});
    setCurrentRound(0);
    setCurrentPrompt(null);
    setLastRoundScores(null);
  };

  const storyteller = players[currentRound];
  const voters      = players.filter((_, i) => i !== currentRound);
  const isLast      = currentRound + 1 >= players.length;

  if (phase === 'setup') {
    return <SetupScreen onStart={startGame} onLeave={leaveToArcade} />;
  }
  if (phase === 'prompt') {
    return (
      <PromptScreen
        storyteller={storyteller}
        prompt={currentPrompt}
        roundNum={currentRound + 1}
        totalRounds={players.length}
        onReady={() => setPhase('tell')}
        onLeave={leaveToArcade}
      />
    );
  }
  if (phase === 'tell') {
    return (
      <TimerScreen
        storyteller={storyteller}
        prompt={currentPrompt}
        onDone={() => setPhase('vote')}
        onLeave={leaveToArcade}
      />
    );
  }
  if (phase === 'vote') {
    return (
      <VotingScreen
        storyteller={storyteller}
        voters={voters}
        onVotesCollected={handleVotesCollected}
        onLeave={leaveToArcade}
      />
    );
  }
  if (phase === 'results') {
    return (
      <ResultsScreen
        storyteller={storyteller}
        roundScores={lastRoundScores}
        scores={scores}
        isLast={isLast}
        onNext={handleNextRound}
        onLeave={leaveToArcade}
      />
    );
  }
  if (phase === 'final') {
    return <FinalScreen scores={scores} onPlayAgain={handlePlayAgain} onLeave={leaveToArcade} />;
  }

  return null;
}
