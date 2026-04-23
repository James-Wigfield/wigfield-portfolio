import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

// ── GIF imports ──────────────────────────────────────────────────
import arcadeGif    from '../assets/gifs/arcade.gif';
import arcade2Gif   from '../assets/gifs/arcade_2.gif';
import cyberKiller  from '../assets/gifs/cyber_killer.gif';
import smokingCity  from '../assets/gifs/smoking_city.gif';
import girRoom      from '../assets/gifs/gir_room.gif';
import cyberBand    from '../assets/gifs/cyber_band.gif';

// ── PIN (same as Hub) ─────────────────────────────────────────────
const GAMES_PIN = '6969';

// ── Game registry — add entries here to expand the arcade ─────────
const GAMES = [
  {
    id: 'imposter',
    title: 'Word Imposter',
    description: 'Real-time multiplayer. One player doesn\'t know the secret word — discuss, deduce, and expose them.',
    gif: arcadeGif,
    color: 'rose',
    tag: 'MULTIPLAYER',
    comingSoon: false,
  },
  {
    id: 'campfire',
    title: 'Campfire Legends',
    description: 'Pass-and-play storytelling. Draw a prompt, spin a spooky legend in 90 seconds, and earn embers from your crew.',
    gif: smokingCity,
    color: 'amber',
    tag: 'PASS & PLAY',
    comingSoon: false,
  },
  {
    id: 'snake',
    title: 'Snake',
    description: 'Classic arcade snake. Navigate the grid, collect pixels, grow longer, avoid the walls.',
    gif: girRoom,
    color: 'emerald',
    tag: 'COMING SOON',
    comingSoon: true,
  },
  {
    id: 'breakout',
    title: 'Breakout',
    description: 'Retro brick-breaker. Keep the ball in play, clear the field, survive the escalating speed.',
    gif: cyberBand,
    color: 'amber',
    tag: 'COMING SOON',
    comingSoon: true,
  },
];

// ── PIN Gate ─────────────────────────────────────────────────────
function PinGate({ onUnlock }) {
  const [digits, setDigits] = useState(['', '', '', '']);
  const [error, setError]   = useState(false);
  const [shake, setShake]   = useState(false);
  const inputs = useRef([]);

  const handleChange = (i, val) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...digits];
    next[i] = val;
    setDigits(next);
    setError(false);
    if (val && i < 3) inputs.current[i + 1]?.focus();
    if (next.every(d => d !== '')) {
      const pin = next.join('');
      if (pin === GAMES_PIN) {
        sessionStorage.setItem('hub_auth', '1');
        onUnlock();
      } else {
        setShake(true);
        setTimeout(() => {
          setShake(false);
          setDigits(['', '', '', '']);
          inputs.current[0]?.focus();
        }, 600);
        setError(true);
      }
    }
  };

  const handleKeyDown = (i, e) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      inputs.current[i - 1]?.focus();
    }
  };

  return (
    <div className="games-gate">
      <div className="games-gate__bg">
        <img src={arcade2Gif} alt="" aria-hidden="true" className="games-gate__gif" />
        <div className="games-gate__overlay" />
        <div className="games-gate__scan" />
      </div>

      <div className={`games-gate__box${shake ? ' games-gate__box--shake' : ''}`}>
        <div className="games-gate__logo">
          <span className="text-amber">[</span>
          &nbsp;ARCADE VAULT&nbsp;
          <span className="text-amber">]</span>
        </div>
        <p className="games-gate__label">INSERT COIN · ENTER CODE</p>
        <div className="games-gate__inputs">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={el => (inputs.current[i] = el)}
              className={`games-gate__digit${error ? ' games-gate__digit--error' : ''}`}
              type="password"
              inputMode="numeric"
              maxLength={1}
              value={d}
              autoFocus={i === 0}
              onChange={e => handleChange(i, e.target.value)}
              onKeyDown={e => handleKeyDown(i, e)}
            />
          ))}
        </div>
        {error && <p className="games-gate__error">// ACCESS DENIED</p>}
      </div>
    </div>
  );
}

// ── Game Card ─────────────────────────────────────────────────────
function GameCard({ game }) {
  const navigate = useNavigate();
  const colorVars = {
    cyan:    { border: 'var(--cyan)',    glow: 'var(--glow-cyan)',    dim: 'var(--cyan-dim)',    text: 'var(--cyan)'    },
    violet:  { border: 'var(--violet)',  glow: 'var(--glow-violet)',  dim: 'var(--violet-dim)',  text: 'var(--violet)'  },
    emerald: { border: 'var(--emerald)', glow: 'var(--glow-emerald)', dim: 'var(--emerald-dim)', text: 'var(--emerald)' },
    rose:    { border: 'var(--rose)',    glow: 'var(--glow-rose)',    dim: 'var(--rose-dim)',    text: 'var(--rose)'    },
    amber:   { border: 'var(--amber)',   glow: 'var(--glow-amber)',   dim: 'var(--amber-dim)',   text: 'var(--amber)'   },
  };
  const c = colorVars[game.color] ?? colorVars.amber;

  const handleActivate = () => {
    if (!game.comingSoon) navigate(`/games/${game.id}`);
  };

  return (
    <div
      className={`game-card${game.comingSoon ? ' game-card--soon' : ''}`}
      style={{ '--card-border': c.border, '--card-glow': c.glow, '--card-dim': c.dim, '--card-text': c.text }}
      onClick={handleActivate}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && handleActivate()}
    >
      <div className="game-card__gif-wrap">
        <img src={game.gif} alt="" aria-hidden="true" className="game-card__gif" />
        <div className="game-card__gif-overlay" />
        <div className="game-card__scan" />
        <span className="game-card__tag">{game.tag}</span>
      </div>
      <div className="game-card__body">
        <h3 className="game-card__title">{game.title}</h3>
        <p className="game-card__desc">{game.description}</p>
        <span className="game-card__enter">
          {game.comingSoon ? 'COMING SOON ···' : 'PLAY NOW →'}
        </span>
      </div>
    </div>
  );
}

// ── Games Dashboard ───────────────────────────────────────────────
export default function Games() {
  const [authed, setAuthed] = useState(
    () => sessionStorage.getItem('hub_auth') === '1'
  );

  useEffect(() => {
    document.title = 'Arcade Vault';
    return () => { document.title = 'James Wigfield'; };
  }, []);

  if (!authed) return <PinGate onUnlock={() => setAuthed(true)} />;

  return (
    <div className="games">
      {/* Ambient side gifs */}
      <div className="games__ambient">
        <img src={cyberKiller} alt="" aria-hidden="true" className="games__ambient-gif games__ambient-gif--left" />
        <img src={smokingCity} alt="" aria-hidden="true" className="games__ambient-gif games__ambient-gif--right" />
      </div>

      <div className="games__inner">
        {/* Banner */}
        <div className="games__banner">
          <img src={arcadeGif} alt="" aria-hidden="true" className="games__banner-gif" />
          <div className="games__banner-overlay" />
          <div className="games__banner-scan" />
          <div className="games__banner-content">
            <p className="games__banner-sys">// SYSTEM: ARCADE VAULT v1.0</p>
            <h1 className="games__banner-title">
              <span className="text-amber">&lt;</span>
              Game Vault
              <span className="text-amber">&nbsp;/&gt;</span>
            </h1>
            <p className="games__banner-sub">Browser-native games · Select a title to play</p>
          </div>
        </div>

        {/* Stats bar */}
        <div className="games__stats">
          <span className="games__stat">
            <span className="games__stat-val text-amber">{GAMES.length}</span> TITLES LOADED
          </span>
          <span className="games__stat-divider">·</span>
          <span className="games__stat">
            <span className="games__stat-val text-emerald">ONLINE</span> STATUS
          </span>
          <span className="games__stat-divider">·</span>
          <span className="games__stat">
            CREDITS <span className="games__stat-val text-rose">∞</span>
          </span>
        </div>

        {/* Game grid */}
        <div className="games__grid">
          {GAMES.map(g => <GameCard key={g.id} game={g} />)}
        </div>

        <footer className="games__footer">
          <p>// END OF DIRECTORY — {GAMES.length} title(s) indexed</p>
        </footer>
      </div>
    </div>
  );
}
