import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import redRainCity from '../../assets/gifs/red_rain_city.gif';
import {
  CLASSIC_CATEGORIES,
  CLASSIC_CATEGORY_NAMES,
  SIMILAR_PAIRS,
  SIMILAR_CATEGORY_NAMES,
  QUESTION_PAIRS,
  CHAMELEON_GRIDS,
  WILDCARD_TOPICS,
  WILDCARD_MISSIONS,
  WILDCARD_ADULT_MISSIONS,
  WILDCARD_CATEGORY_NAMES,
  pickRandom,
  pickFresh,
} from './partyImposterData';

const ADULT_CATEGORY = 'Adults';
// Adult content is segregated under the "Adults" category across every data shape.
// When ADULTS MODE is off in setup we filter it out of dropdowns AND out of the
// `random` pool, so family games never accidentally surface spicy content.
const isAdultCategory = (c) => c === ADULT_CATEGORY;
import './PartyImposter.css';

// ── Mode + option metadata ────────────────────────────────────────────────────
const MODES = [
  {
    id: 'classic',
    label: 'CLASSIC',
    tagline: 'Word vs Nothing',
    desc: 'Crew sees the secret word. Imposter sees nothing. Talk around the word — find who has no clue.',
    color: 'rose',
  },
  {
    id: 'mirror',
    label: 'MIRROR',
    tagline: 'Similar Words',
    desc: 'Crew sees one word. Imposter sees a similar one. Whoever drifts off-script is the rat.',
    color: 'amber',
  },
  {
    id: 'inquiry',
    label: 'INQUIRY',
    tagline: 'Different Questions',
    desc: 'Everyone answers a question. The imposter\'s question is slightly different. Listen for answers that don\'t quite fit.',
    color: 'cyan',
  },
  {
    id: 'chameleon',
    label: 'CHAMELEON',
    tagline: 'The Word Grid',
    desc: 'A grid of 16 words appears. Crew knows the target. Imposter sees the grid — but nothing else.',
    color: 'violet',
  },
  {
    id: 'wildcard',
    label: 'WILDCARD',
    tagline: 'Secret Mission',
    desc: 'Everyone discusses the same topic. The imposter has a secret mission to slip in. Catch what doesn\'t belong.',
    color: 'emerald',
  },
];

const IMPOSTER_OPTIONS = [
  { value: '1',      label: '1' },
  { value: '2',      label: '2' },
  { value: '3',      label: '3' },
  { value: 'random', label: 'RANDOM' },
];

const DISCUSSION_OPTIONS = [
  { value: '0',   label: 'NONE'    },
  { value: '60',  label: '1 MIN'   },
  { value: '120', label: '2 MIN'   },
  { value: '180', label: '3 MIN'   },
  { value: '300', label: '5 MIN'   },
];

const MAX_RECENT = 25;

// ── Shell ────────────────────────────────────────────────────────────────────
function Shell({ onLeave, children }) {
  return (
    <div className="game-wrapper">
      <div className="game-banner">
        <img src={redRainCity} alt="" aria-hidden="true" className="game-banner-gif pi-banner-gif" />
        <div className="game-banner-overlay" />
        <div className="game-banner-scan" />
        <div className="game-banner-content">
          <p className="pi-logo">// PARTY IMPOSTER</p>
          <p className="pi-tagline">PASS · PLAY · DECEIVE</p>
        </div>
        <button className="game-back-btn" onClick={onLeave}>← ARCADE</button>
      </div>
      <div className="game-body">{children}</div>
    </div>
  );
}

// ── Round generation ─────────────────────────────────────────────────────────
function autoImposterCount(playerCount) {
  if (playerCount <= 4) return 1;
  if (playerCount <= 6) return Math.random() < 0.5 ? 1 : 2;
  if (playerCount <= 8) return Math.random() < 0.4 ? 2 : 3;
  return 3;
}

function resolveImposterCount(setting, playerCount) {
  if (setting === 'random') return autoImposterCount(playerCount);
  const n = parseInt(setting, 10);
  // Keep imposters strictly less than half the players so crew has a fighting chance.
  return Math.min(n, Math.max(1, Math.floor((playerCount - 1) / 2)));
}

function pickImposters(playerCount, count) {
  const indices = Array.from({ length: playerCount }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices.slice(0, count).sort((a, b) => a - b);
}

function generateRound({ mode, categorySetting, imposterSetting, blind, adults, players, recent }) {
  const imposterCount = resolveImposterCount(imposterSetting, players.length);
  const imposterIndices = new Set(pickImposters(players.length, imposterCount));

  let roundData = { mode, blind, imposterIndices, imposterCount };

  if (mode === 'classic') {
    let cat;
    if (categorySetting === 'random') {
      const pool = adults
        ? CLASSIC_CATEGORY_NAMES
        : CLASSIC_CATEGORY_NAMES.filter(c => !isAdultCategory(c));
      cat = pickRandom(pool);
    } else {
      cat = categorySetting;
    }
    const word = pickFresh(CLASSIC_CATEGORIES[cat], recent);
    roundData = { ...roundData, category: cat, crewWord: word, imposterWord: null, recentKey: `c:${cat}:${word}` };
  }

  else if (mode === 'mirror') {
    let cat;
    if (categorySetting === 'random') {
      const pool = adults
        ? SIMILAR_CATEGORY_NAMES
        : SIMILAR_CATEGORY_NAMES.filter(c => !isAdultCategory(c));
      cat = pickRandom(pool);
    } else {
      cat = categorySetting;
    }
    const pair = pickFresh(SIMILAR_PAIRS[cat], recent, (p) => `m:${cat}:${p[0]}|${p[1]}`);
    // Randomize which word is the "crew" word vs "imposter" word so a category
    // playing twice doesn't lock in the same pair direction.
    const [a, b] = pair;
    const swap = Math.random() < 0.5;
    const crewWord     = swap ? b : a;
    const imposterWord = swap ? a : b;
    roundData = { ...roundData, category: cat, crewWord, imposterWord, recentKey: `m:${cat}:${a}|${b}` };
  }

  else if (mode === 'inquiry') {
    let pool = adults ? QUESTION_PAIRS : QUESTION_PAIRS.filter(q => !isAdultCategory(q.category));
    if (categorySetting !== 'random') {
      const filtered = pool.filter(q => q.category === categorySetting);
      if (filtered.length > 0) pool = filtered;
    }
    const q = pickFresh(pool, recent, (x) => `q:${x.crew}`);
    roundData = {
      ...roundData,
      category: q.category,
      crewQuestion: q.crew,
      imposterQuestion: q.imposter,
      recentKey: `q:${q.crew}`,
    };
  }

  else if (mode === 'chameleon') {
    let pool = adults ? CHAMELEON_GRIDS : CHAMELEON_GRIDS.filter(g => !isAdultCategory(g.category));
    if (categorySetting !== 'random') {
      const filtered = pool.filter(g => g.category === categorySetting);
      if (filtered.length > 0) pool = filtered;
    }
    // The same category name can appear on multiple grids (e.g., two 'Adults'
    // grids), so the recent key must include the grid's identity, not just its
    // category. Use the first word as a cheap stable identifier.
    const grid = pickFresh(pool, recent, (g) => `g:${g.category}:${g.words[0]}`);
    const targetIdx = Math.floor(Math.random() * grid.words.length);
    roundData = {
      ...roundData,
      category: grid.category,
      grid: grid.words,
      targetIdx,
      crewWord: grid.words[targetIdx],
      recentKey: `g:${grid.category}:${grid.words[0]}:${targetIdx}`,
    };
  }

  else if (mode === 'wildcard') {
    let pool = adults ? WILDCARD_TOPICS : WILDCARD_TOPICS.filter(t => !isAdultCategory(t.category));
    if (categorySetting !== 'random') {
      const filtered = pool.filter(t => t.category === categorySetting);
      if (filtered.length > 0) pool = filtered;
    }
    const topicEntry = pickFresh(pool, recent, (t) => `w:${t.topic}`);
    // Missions: vanilla pool always, plus adult missions only when ADULTS MODE is on.
    const missionPool = adults ? [...WILDCARD_MISSIONS, ...WILDCARD_ADULT_MISSIONS] : WILDCARD_MISSIONS;
    const mission     = pickFresh(missionPool, recent, (m) => `wm:${m}`);
    roundData = {
      ...roundData,
      category: topicEntry.category,
      topic: topicEntry.topic,
      mission,
      // Combined key so neither topic nor mission repeats too quickly.
      recentKey: `w:${topicEntry.topic}|${mission}`,
    };
  }

  return roundData;
}

// ── SETUP screen ─────────────────────────────────────────────────────────────
function SetupScreen({ onStart, onLeave, lastConfig }) {
  const [mode,           setMode]           = useState(lastConfig?.mode ?? 'classic');
  const [category,       setCategory]       = useState(lastConfig?.category ?? 'random');
  const [imposters,      setImposters]      = useState(lastConfig?.imposters ?? '1');
  const [blind,          setBlind]          = useState(lastConfig?.blind ?? false);
  const [voting,         setVoting]         = useState(lastConfig?.voting ?? true);
  const [adults,         setAdults]         = useState(lastConfig?.adults ?? false);
  const [discussionSecs, setDiscussionSecs] = useState(lastConfig?.discussionSecs ?? '120');
  const [players,        setPlayers]        = useState(lastConfig?.players ?? ['', '', '']);
  const [error,          setError]          = useState('');

  // Categories depend on mode. Adult categories are filtered out unless
  // ADULTS MODE is on, so family games can't surface spicy content.
  const categoryOptions = useMemo(() => {
    let opts;
    if      (mode === 'classic')   opts = CLASSIC_CATEGORY_NAMES;
    else if (mode === 'mirror')    opts = SIMILAR_CATEGORY_NAMES;
    else if (mode === 'inquiry')   opts = [...new Set(QUESTION_PAIRS.map(q => q.category))];
    else if (mode === 'chameleon') opts = [...new Set(CHAMELEON_GRIDS.map(g => g.category))];
    else if (mode === 'wildcard')  opts = WILDCARD_CATEGORY_NAMES;
    else                           opts = [];
    return adults ? opts : opts.filter(c => !isAdultCategory(c));
  }, [mode, adults]);

  // Blind requires that all players see *something* that could plausibly be a
  // crew or imposter view. Classic and Wildcard give the imposter unique info
  // (nothing / a secret mission), so blind would either expose them or be moot.
  const blindAllowed = mode !== 'classic' && mode !== 'wildcard';

  // Derived effective values, so a stale category/blind from a previous mode
  // can't leak into the round generator.
  const effectiveCategory = categoryOptions.includes(category) ? category : 'random';
  const effectiveBlind    = blindAllowed && blind;

  const handleModeChange = (nextMode) => {
    setMode(nextMode);
    // When switching modes, reset category to RANDOM since the previous one
    // may not exist in the new mode's list. Also clear blind if not allowed.
    setCategory('random');
    if (nextMode === 'classic' || nextMode === 'wildcard') setBlind(false);
  };

  const addPlayer    = () => players.length < 12 && setPlayers(p => [...p, '']);
  const removePlayer = (i) => players.length > 3 && setPlayers(p => p.filter((_, idx) => idx !== i));
  const updatePlayer = (i, v) => {
    setPlayers(p => { const n = [...p]; n[i] = v; return n; });
    setError('');
  };

  const handleStart = () => {
    const names = players.map(p => p.trim()).filter(Boolean);
    if (names.length < 3) { setError('You need at least 3 players for imposter games.'); return; }
    if (new Set(names.map(n => n.toLowerCase())).size < names.length) {
      setError('Player names must be unique.');
      return;
    }
    onStart({
      mode,
      category: effectiveCategory,
      imposters,
      blind: effectiveBlind,
      voting,
      adults,
      discussionSecs,
      players,
      names,
    });
  };

  const activeMode = MODES.find(m => m.id === mode);

  return (
    <Shell onLeave={onLeave}>
      <div className="game-screen pi-screen-wide">
        {/* Mode picker */}
        <div className="game-card">
          <p className="pi-section-title">SELECT GAME MODE</p>
          <div className="pi-mode-grid">
            {MODES.map(m => (
              <button
                key={m.id}
                className={`pi-mode-card pi-mode-card--${m.color}${mode === m.id ? ' pi-mode-card--active' : ''}`}
                onClick={() => handleModeChange(m.id)}
                type="button"
              >
                <span className="pi-mode-label">{m.label}</span>
                <span className="pi-mode-tagline">{m.tagline}</span>
                <span className="pi-mode-desc">{m.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Settings */}
        <div className="game-card pi-card-gap">
          <p className="pi-section-title">SETTINGS</p>

          <div className="pi-setting-row">
            <label className="pi-label" htmlFor="pi-cat">CATEGORY</label>
            <select
              id="pi-cat"
              className="pi-select"
              value={effectiveCategory}
              onChange={e => setCategory(e.target.value)}
            >
              <option value="random">RANDOM</option>
              {categoryOptions.map(c => (
                <option key={c} value={c}>{c.toUpperCase()}</option>
              ))}
            </select>
          </div>

          <div className="pi-setting-row">
            <label className="pi-label" htmlFor="pi-imp">IMPOSTERS</label>
            <select
              id="pi-imp"
              className="pi-select"
              value={imposters}
              onChange={e => setImposters(e.target.value)}
            >
              {IMPOSTER_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div className="pi-setting-row">
            <label className="pi-label" htmlFor="pi-disc">DISCUSSION TIMER</label>
            <select
              id="pi-disc"
              className="pi-select"
              value={discussionSecs}
              onChange={e => setDiscussionSecs(e.target.value)}
            >
              {DISCUSSION_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div className="pi-toggle-row">
            <div>
              <p className="pi-toggle-label">
                ADULTS MODE <span className="pi-toggle-badge">18+</span>
              </p>
              <p className="pi-toggle-desc">
                {adults
                  ? 'NSFW content unlocked — adult words, kinks, hookup questions, and spicier wildcard missions can appear.'
                  : 'Keep it clean. Adult categories and spicier missions are hidden from dropdowns and random picks.'}
              </p>
            </div>
            <button
              type="button"
              className={`pi-toggle${adults ? ' pi-toggle--on' : ''}`}
              onClick={() => setAdults(a => !a)}
              aria-pressed={adults}
            >
              <span className="pi-toggle-thumb" />
            </button>
          </div>

          <div className="pi-toggle-row">
            <div>
              <p className="pi-toggle-label">IN-APP VOTING</p>
              <p className="pi-toggle-desc">
                {voting
                  ? 'Each player taps their accusation in turn. Tally and verdict shown at the end.'
                  : 'Skip the voting screens — call the verdict out loud in real life, then mark who won.'}
              </p>
            </div>
            <button
              type="button"
              className={`pi-toggle${voting ? ' pi-toggle--on' : ''}`}
              onClick={() => setVoting(v => !v)}
              aria-pressed={voting}
            >
              <span className="pi-toggle-thumb" />
            </button>
          </div>

          <div className="pi-toggle-row">
            <div>
              <p className="pi-toggle-label">BLIND MODE</p>
              <p className="pi-toggle-desc">
                {blindAllowed
                  ? 'No one is told their role — not even the imposter. Vote on suspicion alone.'
                  : mode === 'wildcard'
                    ? 'Not available in Wildcard — the imposter needs to see their secret mission.'
                    : 'Not available in Classic — the imposter would see nothing and know instantly.'}
              </p>
            </div>
            <button
              type="button"
              className={`pi-toggle${effectiveBlind ? ' pi-toggle--on' : ''}${!blindAllowed ? ' pi-toggle--disabled' : ''}`}
              onClick={() => blindAllowed && setBlind(b => !b)}
              aria-pressed={effectiveBlind}
              disabled={!blindAllowed}
            >
              <span className="pi-toggle-thumb" />
            </button>
          </div>
        </div>

        {/* Players */}
        <div className="game-card pi-card-gap">
          <p className="pi-section-title">PLAYERS</p>
          <p className="pi-section-sub">3 to 12 players. Hand the phone around as the game directs.</p>

          <div className="pi-player-inputs">
            {players.map((p, i) => (
              <div key={i} className="pi-player-row">
                <span className="pi-player-num">{i + 1}</span>
                <input
                  className="pi-input"
                  type="text"
                  placeholder={`Player ${i + 1}`}
                  maxLength={20}
                  value={p}
                  autoComplete="off"
                  onChange={e => updatePlayer(i, e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && i === players.length - 1 && players.length < 12) addPlayer();
                  }}
                />
                {players.length > 3 && (
                  <button className="pi-remove-btn" onClick={() => removePlayer(i)} aria-label="Remove player">×</button>
                )}
              </div>
            ))}
          </div>

          {players.length < 12 && (
            <button className="game-btn game-btn--ghost" onClick={addPlayer} type="button">
              + ADD PLAYER
            </button>
          )}

          {error && <p className="pi-error">// {error}</p>}

          <button
            className={`game-btn game-btn--${activeMode.color}`}
            style={{ marginTop: '1rem' }}
            onClick={handleStart}
            type="button"
          >
            LAUNCH ROUND →
          </button>
        </div>
      </div>
    </Shell>
  );
}

// ── PASS instruction (between players) ────────────────────────────────────────
function PassPrompt({ name, badge, hint, onAdvance }) {
  return (
    <div className="game-card pi-card-night">
      {badge && <p className="pi-round-badge">{badge}</p>}
      <p className="pi-pass-title">PASS THE PHONE TO</p>
      <p className="pi-big-name">{name}</p>
      {hint && <p className="pi-hint" style={{ margin: '1rem 0 1.5rem' }}>{hint}</p>}
      <button className="game-btn game-btn--amber" onClick={onAdvance} type="button">
        I&apos;M {name.toUpperCase()} — REVEAL →
      </button>
    </div>
  );
}

// ── Role card content (varies by mode) ────────────────────────────────────────
function RoleCard({ round, isImposter, blind, fellowImposterNames }) {
  // Blind mode: never tell the player their role. They see a card neutrally.
  if (blind) {
    return <BlindReveal round={round} isImposter={isImposter} />;
  }

  // Classic
  if (round.mode === 'classic') {
    if (isImposter) {
      return (
        <div className="pi-role pi-role--imposter">
          <span className="pi-role-tag pi-role-tag--imposter">IMPOSTER</span>
          <p className="pi-role-title pi-role-title--imposter">You Are the Imposter</p>
          <p className="pi-role-cat">CATEGORY · {round.category.toUpperCase()}</p>
          <p className="pi-role-hint">
            You don&apos;t know the word. Bluff. Listen. Steal hints. Don&apos;t get voted out.
          </p>
          {fellowImposterNames.length > 0 && (
            <p className="pi-role-fellows">ALLIES · {fellowImposterNames.join(' · ')}</p>
          )}
        </div>
      );
    }
    return (
      <div className="pi-role pi-role--crew">
        <span className="pi-role-tag pi-role-tag--crew">CREW</span>
        <p className="pi-role-title">The secret word is</p>
        <p className="pi-role-word">{round.crewWord}</p>
        <p className="pi-role-cat">CATEGORY · {round.category.toUpperCase()}</p>
        <p className="pi-role-hint">
          Describe it. Hint at it. Don&apos;t say it outright.
          {round.imposterCount > 1 ? ` There are ${round.imposterCount} imposters.` : ''}
        </p>
      </div>
    );
  }

  // Mirror
  if (round.mode === 'mirror') {
    const word = isImposter ? round.imposterWord : round.crewWord;
    return (
      <div className={`pi-role ${isImposter ? 'pi-role--imposter' : 'pi-role--crew'}`}>
        <span className={`pi-role-tag ${isImposter ? 'pi-role-tag--imposter' : 'pi-role-tag--crew'}`}>
          {isImposter ? 'IMPOSTER' : 'CREW'}
        </span>
        <p className="pi-role-title">Your word is</p>
        <p className={`pi-role-word${isImposter ? ' pi-role-word--imposter' : ''}`}>{word}</p>
        <p className="pi-role-cat">CATEGORY · {round.category.toUpperCase()}</p>
        <p className="pi-role-hint">
          {isImposter
            ? 'Your word is different. Stay vague enough that no one notices.'
            : 'Everyone (except the imposter) has the same word. Describe it carefully.'}
        </p>
        {isImposter && fellowImposterNames.length > 0 && (
          <p className="pi-role-fellows">ALLIES · {fellowImposterNames.join(' · ')}</p>
        )}
      </div>
    );
  }

  // Inquiry
  if (round.mode === 'inquiry') {
    const question = isImposter ? round.imposterQuestion : round.crewQuestion;
    return (
      <div className={`pi-role ${isImposter ? 'pi-role--imposter' : 'pi-role--crew'}`}>
        <span className={`pi-role-tag ${isImposter ? 'pi-role-tag--imposter' : 'pi-role-tag--crew'}`}>
          {isImposter ? 'IMPOSTER' : 'CREW'}
        </span>
        <p className="pi-role-title">Answer this question</p>
        <p className="pi-role-question">&ldquo;{question}&rdquo;</p>
        <p className="pi-role-cat">THEME · {round.category.toUpperCase()}</p>
        <p className="pi-role-hint">
          {isImposter
            ? "Your question is slightly different. Answer in a way that could fit either."
            : 'Everyone gets a question. The imposter has a different one. Listen for answers that don\'t fit yours.'}
        </p>
        {isImposter && fellowImposterNames.length > 0 && (
          <p className="pi-role-fellows">ALLIES · {fellowImposterNames.join(' · ')}</p>
        )}
      </div>
    );
  }

  // Chameleon
  if (round.mode === 'chameleon') {
    return (
      <div className={`pi-role ${isImposter ? 'pi-role--imposter' : 'pi-role--crew'}`}>
        <span className={`pi-role-tag ${isImposter ? 'pi-role-tag--imposter' : 'pi-role-tag--crew'}`}>
          {isImposter ? 'IMPOSTER' : 'CREW'}
        </span>
        <p className="pi-role-title">
          {isImposter ? 'No target — you\'re the chameleon' : 'The target word is'}
        </p>
        {!isImposter && <p className="pi-role-word">{round.crewWord}</p>}
        <p className="pi-role-cat">CATEGORY · {round.category.toUpperCase()}</p>
        <div className="pi-grid">
          {round.grid.map((w, i) => (
            <span
              key={i}
              className={`pi-grid-cell${!isImposter && i === round.targetIdx ? ' pi-grid-cell--target' : ''}`}
            >
              {w}
            </span>
          ))}
        </div>
        <p className="pi-role-hint">
          {isImposter
            ? 'You don\'t know the target. Give a clue vague enough to fit any word on the grid.'
            : 'Give a single-word clue tied to the target. Don\'t make it too obvious.'}
        </p>
        {isImposter && fellowImposterNames.length > 0 && (
          <p className="pi-role-fellows">ALLIES · {fellowImposterNames.join(' · ')}</p>
        )}
      </div>
    );
  }

  // Wildcard
  if (round.mode === 'wildcard') {
    if (isImposter) {
      return (
        <div className="pi-role pi-role--imposter">
          <span className="pi-role-tag pi-role-tag--imposter">IMPOSTER · WILDCARD</span>
          <p className="pi-role-title">Discussion topic</p>
          <p className="pi-role-question">&ldquo;{round.topic}&rdquo;</p>
          <p className="pi-role-cat">THEME · {round.category.toUpperCase()}</p>
          <div className="pi-mission-box">
            <p className="pi-label">YOUR SECRET MISSION</p>
            <p className="pi-mission-text">{round.mission}</p>
          </div>
          <p className="pi-role-hint">
            Discuss the topic. Pull off the mission. Don&apos;t get caught.
          </p>
          {fellowImposterNames.length > 0 && (
            <p className="pi-role-fellows">ALLIES · {fellowImposterNames.join(' · ')}</p>
          )}
        </div>
      );
    }
    return (
      <div className="pi-role pi-role--crew">
        <span className="pi-role-tag pi-role-tag--crew">CREW</span>
        <p className="pi-role-title">Discussion topic</p>
        <p className="pi-role-question">&ldquo;{round.topic}&rdquo;</p>
        <p className="pi-role-cat">THEME · {round.category.toUpperCase()}</p>
        <p className="pi-role-hint">
          Answer the topic honestly. One of you has a secret mission they&apos;re trying to sneak in — watch for the answer that doesn&apos;t quite fit.
          {round.imposterCount > 1 ? ` There are ${round.imposterCount} imposters.` : ''}
        </p>
      </div>
    );
  }

  return null;
}

// ── Blind reveal (no role tag, no hint about being imposter) ─────────────────
function BlindReveal({ round, isImposter }) {
  if (round.mode === 'mirror') {
    const word = isImposter ? round.imposterWord : round.crewWord;
    return (
      <div className="pi-role pi-role--blind">
        <span className="pi-role-tag pi-role-tag--blind">UNKNOWN ROLE</span>
        <p className="pi-role-title">Your word is</p>
        <p className="pi-role-word">{word}</p>
        <p className="pi-role-cat">CATEGORY · {round.category.toUpperCase()}</p>
        <p className="pi-role-hint">
          You don&apos;t know if you&apos;re crew or imposter. Most players share a word — one (or more) sees something different. Discuss and find the odd one out. It might be you.
        </p>
      </div>
    );
  }

  if (round.mode === 'inquiry') {
    const question = isImposter ? round.imposterQuestion : round.crewQuestion;
    return (
      <div className="pi-role pi-role--blind">
        <span className="pi-role-tag pi-role-tag--blind">UNKNOWN ROLE</span>
        <p className="pi-role-title">Answer this question</p>
        <p className="pi-role-question">&ldquo;{question}&rdquo;</p>
        <p className="pi-role-cat">THEME · {round.category.toUpperCase()}</p>
        <p className="pi-role-hint">
          You don&apos;t know if your question matches the others. One player has a different question. Listen for answers that don&apos;t fit yours — it could mean theirs is the odd one, or yours is.
        </p>
      </div>
    );
  }

  if (round.mode === 'chameleon') {
    return (
      <div className="pi-role pi-role--blind">
        <span className="pi-role-tag pi-role-tag--blind">UNKNOWN ROLE</span>
        <p className="pi-role-title">The target may be</p>
        {!isImposter ? (
          <p className="pi-role-word">{round.crewWord}</p>
        ) : (
          <p className="pi-role-word pi-role-word--blank">??????</p>
        )}
        <p className="pi-role-cat">CATEGORY · {round.category.toUpperCase()}</p>
        <div className="pi-grid">
          {round.grid.map((w, i) => (
            <span
              key={i}
              className={`pi-grid-cell${!isImposter && i === round.targetIdx ? ' pi-grid-cell--target' : ''}`}
            >
              {w}
            </span>
          ))}
        </div>
        <p className="pi-role-hint">
          You may or may not see a target. Give a clue. Decide who&apos;s bluffing.
        </p>
      </div>
    );
  }

  return null;
}

// ── REVEAL phase ─────────────────────────────────────────────────────────────
function RevealScreen({ round, names, onLeave, onComplete }) {
  const [idx,        setIdx]        = useState(0);
  const [revealed,   setRevealed]   = useState(false);

  const currentName = names[idx];
  const isImposter  = round.imposterIndices.has(idx);
  const isLast      = idx + 1 >= names.length;

  const fellowImposterNames = isImposter
    ? Array.from(round.imposterIndices)
        .filter(i => i !== idx)
        .map(i => names[i])
    : [];

  const handleNext = () => {
    if (isLast) {
      onComplete();
    } else {
      setIdx(i => i + 1);
      setRevealed(false);
    }
  };

  return (
    <Shell onLeave={onLeave}>
      <div className="game-screen">
        {!revealed ? (
          <PassPrompt
            name={currentName}
            badge={`PLAYER ${idx + 1} / ${names.length}`}
            hint="Everyone else — eyes off the screen."
            onAdvance={() => setRevealed(true)}
          />
        ) : (
          <>
            <RoleCard
              round={round}
              isImposter={isImposter}
              blind={round.blind}
              fellowImposterNames={fellowImposterNames}
            />
            <button
              className="game-btn game-btn--cyan"
              style={{ marginTop: '1rem' }}
              onClick={handleNext}
              type="button"
            >
              {isLast ? 'BEGIN DISCUSSION →' : 'I\'VE SEEN IT — NEXT PLAYER →'}
            </button>
            {isLast && (
              <p className="pi-hint" style={{ marginTop: '0.85rem' }}>
                You&apos;re the last to look. This just kicks off the discussion — it
                does NOT reveal the imposter. You&apos;ll unmask them with a separate
                button once everyone&apos;s had their say.
              </p>
            )}
          </>
        )}
      </div>
    </Shell>
  );
}

// ── DISCUSSION phase ─────────────────────────────────────────────────────────
function DiscussionScreen({ round, names, secondsTotal, votingEnabled, onLeave, onDone }) {
  const [secondsLeft, setSecondsLeft] = useState(secondsTotal);

  useEffect(() => {
    if (secondsTotal <= 0) return;
    const id = setInterval(() => {
      setSecondsLeft(t => (t <= 1 ? 0 : t - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [secondsTotal]);

  const showTimer = secondsTotal > 0;
  const expired   = showTimer && secondsLeft === 0;
  const urgent    = showTimer && secondsLeft <= 10 && secondsLeft > 0;
  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const ss = String(secondsLeft % 60).padStart(2, '0');
  const pct = showTimer ? (secondsLeft / secondsTotal) * 100 : 0;

  return (
    <Shell onLeave={onLeave}>
      <div className="game-screen">
        <div className={`game-card pi-card-discuss${urgent ? ' pi-card-urgent' : ''}`}>
          <p className="pi-label">DISCUSSION</p>
          {showTimer ? (
            <>
              <p className={`pi-timer${urgent ? ' pi-timer--urgent' : ''}`}>{mm}:{ss}</p>
              <div className="pi-timer-bar-wrap">
                <div
                  className="pi-timer-bar"
                  style={{ width: `${pct}%`, background: urgent ? 'var(--rose)' : 'var(--amber)' }}
                />
              </div>
              {expired && <p className="pi-urgent">TIME&apos;S UP — VOTE NOW</p>}
            </>
          ) : (
            <p className="pi-section-title" style={{ marginTop: '1rem' }}>TALK IT OUT</p>
          )}

          <p className="pi-hint" style={{ marginTop: '1rem' }}>
            {round.mode === 'classic'   && 'Crew: describe without saying. Imposter: bluff.'}
            {round.mode === 'mirror'    && 'Take turns describing your word in one sentence.'}
            {round.mode === 'inquiry'   && 'Take turns answering your question out loud.'}
            {round.mode === 'chameleon' && 'Each player gives ONE word as a clue tied to the target.'}
            {round.mode === 'wildcard'  && 'Take turns answering the topic. Listen for the answer that\'s smuggling something in.'}
          </p>

          <p className="pi-hint" style={{ marginTop: '0.75rem' }}>
            ROOM · {names.length} PLAYERS · {round.imposterCount} IMPOSTER{round.imposterCount > 1 ? 'S' : ''}
            {round.blind && ' · BLIND'}
          </p>
        </div>

        <div className="game-card pi-card-gap">
          <p className="pi-label">SPEAKING ORDER</p>
          <ul className="pi-speaking-list">
            {names.map((n, i) => (
              <li key={i} className="pi-speaking-row">
                <span className="pi-speaking-num">{i + 1}</span>
                <span className="pi-speaking-name">{n}</span>
              </li>
            ))}
          </ul>
          <p className="pi-hint" style={{ marginTop: '1.25rem' }}>
            {votingEnabled
              ? 'The imposter is still secret — everyone casts a vote first, then it\'s revealed.'
              : 'The imposter is still secret — you\'ll reveal it with a button on the next screen.'}
          </p>
          <button
            className="game-btn game-btn--rose"
            style={{ marginTop: '1rem' }}
            onClick={onDone}
            type="button"
          >
            {votingEnabled ? 'ACCUSATIONS — START VOTE →' : 'DONE DISCUSSING →'}
          </button>
        </div>
      </div>
    </Shell>
  );
}

// ── VOTING phase ─────────────────────────────────────────────────────────────
function VotingScreen({ names, onLeave, onComplete }) {
  const [idx,         setIdx]         = useState(0);
  const [phase,       setPhase]       = useState('pass'); // 'pass' | 'voting' | 'locked'
  const [selection,   setSelection]   = useState(null);
  const [votes,       setVotes]       = useState({});

  const currentName = names[idx];
  const isLast      = idx + 1 >= names.length;
  const choices     = names.filter(n => n !== currentName);

  const lockVote = () => {
    if (!selection) return;
    setVotes(v => ({ ...v, [currentName]: selection }));
    setPhase('locked');
  };

  const advance = () => {
    if (isLast) {
      onComplete({ ...votes, [currentName]: selection });
    } else {
      setIdx(i => i + 1);
      setSelection(null);
      setPhase('pass');
    }
  };

  return (
    <Shell onLeave={onLeave}>
      <div className="game-screen">
        {phase === 'pass' && (
          <PassPrompt
            name={currentName}
            badge={`VOTER ${idx + 1} / ${names.length}`}
            hint="Pick who you think is the imposter. No peeking when others vote."
            onAdvance={() => setPhase('voting')}
          />
        )}

        {phase === 'voting' && (
          <div className="game-card pi-card-night">
            <p className="pi-voter-badge">VOTER {idx + 1} / {names.length}</p>
            <p className="pi-section-title">{currentName}&apos;s vote</p>
            <p className="pi-hint" style={{ marginBottom: '1rem' }}>Who&apos;s the imposter?</p>
            <div className="pi-vote-list">
              {choices.map(name => (
                <button
                  key={name}
                  type="button"
                  className={`pi-vote-option${selection === name ? ' pi-vote-option--selected' : ''}`}
                  onClick={() => setSelection(name)}
                >
                  {name}
                </button>
              ))}
            </div>
            <button
              className="game-btn game-btn--rose"
              style={{ marginTop: '1.25rem' }}
              onClick={lockVote}
              disabled={!selection}
              type="button"
            >
              LOCK IN VOTE →
            </button>
          </div>
        )}

        {phase === 'locked' && (
          <div className="game-card pi-card-night">
            <p className="pi-voter-badge">VOTE LOCKED</p>
            <p className="pi-section-title">{currentName} accuses</p>
            <p className="pi-big-name">{selection}</p>
            <p className="pi-hint" style={{ margin: '1rem 0 1.5rem' }}>
              Vote sealed. {isLast ? 'See the verdict.' : 'Pass the phone on.'}
            </p>
            <button
              className="game-btn game-btn--amber"
              onClick={advance}
              type="button"
            >
              {isLast ? 'REVEAL VERDICT →' : 'NEXT VOTER →'}
            </button>
          </div>
        )}
      </div>
    </Shell>
  );
}

// ── RESULT phase ─────────────────────────────────────────────────────────────
function tallyVotes(votes, names) {
  const counts = Object.fromEntries(names.map(n => [n, 0]));
  for (const accused of Object.values(votes)) {
    if (accused in counts) counts[accused]++;
  }
  let topCount = 0;
  let topNames = [];
  for (const [name, c] of Object.entries(counts)) {
    if (c > topCount) { topCount = c; topNames = [name]; }
    else if (c === topCount && c > 0) topNames.push(name);
  }
  return { counts, topNames, topCount };
}

function ResultScreen({ round, names, votes, scores, roundNum, manualVerdict, onManualVerdict, onNextRound, onEndGame, onLeave }) {
  // Manual-verdict rounds keep the imposter hidden behind an explicit reveal tap, so
  // ending the discussion never accidentally unmasks anyone. Voting rounds have
  // already passed through the vote, so they show the result straight away.
  const [revealed, setRevealed] = useState(!manualVerdict);
  const imposterNames = Array.from(round.imposterIndices).map(i => names[i]);
  const { counts, topNames, topCount } = tallyVotes(votes, names);

  // Crew wins if every top-voted player is an imposter AND at least one imposter
  // is in the top-voted set. With multiple imposters and a single eject, we use
  // a simple rule: any top vote == an imposter counts as a crew win.
  const crewWins = topCount > 0 && topNames.some(n => imposterNames.includes(n));

  return (
    <Shell onLeave={onLeave}>
      <div className="game-screen">
        {!revealed ? (
          <div className="game-card pi-card-night">
            <p className="pi-round-badge">ROUND {roundNum} · DISCUSSION OVER</p>
            <p className="pi-section-title">Ready to unmask the imposter?</p>
            <p className="pi-hint" style={{ margin: '0.85rem 0 1.5rem' }}>
              The imposter is still secret. Make your accusations out loud first —
              tapping the button below is the only thing that reveals who it was.
            </p>
            <button
              className="game-btn game-btn--rose"
              onClick={() => setRevealed(true)}
              type="button"
            >
              REVEAL THE IMPOSTER →
            </button>
          </div>
        ) : (
          <>
        <div className={`game-card pi-card-result ${manualVerdict ? '' : (crewWins ? 'pi-card-result--crew' : 'pi-card-result--imposter')}`}>
          <p className="pi-round-badge">ROUND {roundNum} · {manualVerdict ? 'REVEAL' : 'VERDICT'}</p>
          {!manualVerdict && (
            <p className={`pi-result-banner ${crewWins ? 'pi-result-banner--crew' : 'pi-result-banner--imposter'}`}>
              {crewWins ? 'CREW WINS' : 'IMPOSTER WINS'}
            </p>
          )}

          <div className="pi-result-info">
            <p className="pi-label">THE IMPOSTER{imposterNames.length > 1 ? 'S' : ''}</p>
            <p className="pi-imposter-name">{imposterNames.join(' · ')}</p>
          </div>

          {round.mode === 'classic' && (
            <div className="pi-result-info">
              <p className="pi-label">SECRET WORD</p>
              <p className="pi-result-word">{round.crewWord}</p>
            </div>
          )}

          {round.mode === 'mirror' && (
            <>
              <div className="pi-result-info">
                <p className="pi-label">CREW WORD</p>
                <p className="pi-result-word">{round.crewWord}</p>
              </div>
              <div className="pi-result-info">
                <p className="pi-label">IMPOSTER WORD</p>
                <p className="pi-result-word pi-result-word--imposter">{round.imposterWord}</p>
              </div>
            </>
          )}

          {round.mode === 'inquiry' && (
            <>
              <div className="pi-result-info">
                <p className="pi-label">CREW QUESTION</p>
                <p className="pi-result-question">&ldquo;{round.crewQuestion}&rdquo;</p>
              </div>
              <div className="pi-result-info">
                <p className="pi-label">IMPOSTER QUESTION</p>
                <p className="pi-result-question pi-result-question--imposter">&ldquo;{round.imposterQuestion}&rdquo;</p>
              </div>
            </>
          )}

          {round.mode === 'chameleon' && (
            <div className="pi-result-info">
              <p className="pi-label">TARGET WORD</p>
              <p className="pi-result-word">{round.crewWord}</p>
            </div>
          )}

          {round.mode === 'wildcard' && (
            <>
              <div className="pi-result-info">
                <p className="pi-label">TOPIC</p>
                <p className="pi-result-question">&ldquo;{round.topic}&rdquo;</p>
              </div>
              <div className="pi-result-info">
                <p className="pi-label">SECRET MISSION</p>
                <p className="pi-result-question pi-result-question--imposter">{round.mission}</p>
              </div>
            </>
          )}
        </div>

        {manualVerdict ? (
          <div className="game-card pi-card-gap">
            <p className="pi-label">CALL IT</p>
            <p className="pi-section-title" style={{ marginBottom: '0.25rem' }}>Who took the round?</p>
            <p className="pi-hint" style={{ marginBottom: '1rem' }}>
              You called the vote in person — tap the winner so scores update.
            </p>
            <div className="pi-verdict-row">
              <button
                type="button"
                className="game-btn game-btn--emerald"
                onClick={() => onManualVerdict(true)}
              >
                CREW WON
              </button>
              <button
                type="button"
                className="game-btn game-btn--rose"
                onClick={() => onManualVerdict(false)}
              >
                IMPOSTER WON
              </button>
            </div>

            <p className="pi-label" style={{ marginTop: '1.25rem' }}>RUNNING SCORES</p>
            <ul className="pi-tally-list">
              {names
                .slice()
                .sort((a, b) => (scores[b] ?? 0) - (scores[a] ?? 0))
                .map(name => (
                  <li key={name} className="pi-tally-row">
                    <span className="pi-tally-name">{name}</span>
                    <span className="pi-tally-count">{scores[name] ?? 0}</span>
                  </li>
                ))}
            </ul>

            <button
              className="game-btn game-btn--ghost"
              style={{ marginTop: '1rem' }}
              onClick={onEndGame}
              type="button"
            >
              END GAME · NEW SETUP
            </button>
          </div>
        ) : (
          <div className="game-card pi-card-gap">
            <p className="pi-label">VOTE TALLY</p>
          <ul className="pi-tally-list">
            {names
              .slice()
              .sort((a, b) => counts[b] - counts[a])
              .map(name => {
                const isImp     = imposterNames.includes(name);
                const isTop     = topNames.includes(name) && topCount > 0;
                return (
                  <li key={name} className={`pi-tally-row${isTop ? ' pi-tally-row--top' : ''}`}>
                    <span className="pi-tally-name">
                      {name}
                      {isImp && <span className="pi-tally-mark"> · imposter</span>}
                    </span>
                    <span className="pi-tally-count">{counts[name]}</span>
                  </li>
                );
              })}
          </ul>

          <p className="pi-label" style={{ marginTop: '1.25rem' }}>RUNNING SCORES</p>
          <ul className="pi-tally-list">
            {names
              .slice()
              .sort((a, b) => (scores[b] ?? 0) - (scores[a] ?? 0))
              .map(name => (
                <li key={name} className="pi-tally-row">
                  <span className="pi-tally-name">{name}</span>
                  <span className="pi-tally-count">{scores[name] ?? 0}</span>
                </li>
              ))}
          </ul>

          <div className="pi-result-actions">
            <button className="game-btn game-btn--cyan" onClick={onNextRound} type="button">
              NEXT ROUND →
            </button>
            <button className="game-btn game-btn--ghost" onClick={onEndGame} type="button">
              END GAME · NEW SETUP
            </button>
          </div>
          </div>
        )}
          </>
        )}
      </div>
    </Shell>
  );
}

// ── Main component ───────────────────────────────────────────────────────────
export default function PartyImposter() {
  const navigate = useNavigate();

  const [phase,      setPhase]      = useState('setup');
  const [config,     setConfig]     = useState(null);   // last setup snapshot for re-runs
  const [names,      setNames]      = useState([]);
  const [round,      setRound]      = useState(null);
  const [roundNum,   setRoundNum]   = useState(0);
  const [votes,      setVotes]      = useState({});
  const [scores,     setScores]     = useState({});
  const recentRef                   = useRef(new Set());

  useEffect(() => {
    document.title = 'Party Imposter';
    return () => { document.title = 'Arcade Vault'; };
  }, []);

  const pushRecent = (key) => {
    if (!key) return;
    const set = recentRef.current;
    set.add(key);
    if (set.size > MAX_RECENT) {
      const first = set.values().next().value;
      set.delete(first);
    }
  };

  const leaveToArcade = () => navigate('/games');

  const handleStart = (cfg) => {
    setConfig(cfg);
    setNames(cfg.names);
    setScores(Object.fromEntries(cfg.names.map(n => [n, 0])));
    setRoundNum(1);
    const r = generateRound({
      mode:             cfg.mode,
      categorySetting:  cfg.category,
      imposterSetting:  cfg.imposters,
      blind:            cfg.blind,
      adults:           cfg.adults,
      players:          cfg.names,
      recent:           recentRef.current,
    });
    pushRecent(r.recentKey);
    setRound(r);
    setVotes({});
    setPhase('reveal');
  };

  const handleRevealComplete = () => {
    // Always pass through the discussion screen so "BEGIN DISCUSSION" never jumps
    // straight to unmasking the imposter. The discussion screen handles the
    // no-timer case ("TALK IT OUT") and routes on to voting or the gated reveal.
    setPhase('discuss');
  };

  const handleDiscussionDone = () => {
    setPhase(config.voting ? 'vote' : 'result');
  };

  const handleManualVerdict = (crewWon) => {
    const imposterIdxSet = round.imposterIndices;
    setScores(prev => {
      const next = { ...prev };
      names.forEach((n, i) => {
        const isImp = imposterIdxSet.has(i);
        if (crewWon && !isImp)      next[n] = (next[n] ?? 0) + 1;
        else if (!crewWon && isImp) next[n] = (next[n] ?? 0) + 1;
      });
      return next;
    });
    handleNextRound();
  };

  const handleVoteComplete = (finalVotes) => {
    setVotes(finalVotes);
    const imposterNames = Array.from(round.imposterIndices).map(i => names[i]);
    const { topNames, topCount } = tallyVotes(finalVotes, names);
    const crewWins = topCount > 0 && topNames.some(n => imposterNames.includes(n));

    // Score: every player on the winning team gets +1
    setScores(prev => {
      const next = { ...prev };
      names.forEach((n, i) => {
        const isImp = round.imposterIndices.has(i);
        if (crewWins && !isImp)      next[n] = (next[n] ?? 0) + 1;
        else if (!crewWins && isImp) next[n] = (next[n] ?? 0) + 1;
      });
      return next;
    });

    setPhase('result');
  };

  const handleNextRound = () => {
    const r = generateRound({
      mode:             config.mode,
      categorySetting:  config.category,
      imposterSetting:  config.imposters,
      blind:            config.blind,
      adults:           config.adults,
      players:          names,
      recent:           recentRef.current,
    });
    pushRecent(r.recentKey);
    setRound(r);
    setRoundNum(n => n + 1);
    setVotes({});
    setPhase('reveal');
  };

  const handleEndGame = () => {
    setRound(null);
    setVotes({});
    setRoundNum(0);
    setPhase('setup');
  };

  if (phase === 'setup') {
    return <SetupScreen onStart={handleStart} onLeave={leaveToArcade} lastConfig={config} />;
  }
  if (phase === 'reveal' && round) {
    return (
      <RevealScreen
        round={round}
        names={names}
        onLeave={leaveToArcade}
        onComplete={handleRevealComplete}
      />
    );
  }
  if (phase === 'discuss' && round) {
    return (
      <DiscussionScreen
        round={round}
        names={names}
        secondsTotal={parseInt(config.discussionSecs, 10)}
        votingEnabled={config.voting}
        onLeave={leaveToArcade}
        onDone={handleDiscussionDone}
      />
    );
  }
  if (phase === 'vote') {
    return (
      <VotingScreen
        names={names}
        onLeave={leaveToArcade}
        onComplete={handleVoteComplete}
      />
    );
  }
  if (phase === 'result' && round) {
    return (
      <ResultScreen
        round={round}
        names={names}
        votes={votes}
        scores={scores}
        roundNum={roundNum}
        manualVerdict={!config.voting}
        onManualVerdict={handleManualVerdict}
        onNextRound={handleNextRound}
        onEndGame={handleEndGame}
        onLeave={leaveToArcade}
      />
    );
  }
  return null;
}
