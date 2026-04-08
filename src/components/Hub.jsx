import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

// ── GIF imports ──────────────────────────────────────────────────
import cyberStation from '../assets/gifs/cyber_station.gif';
import computerShop from '../assets/gifs/smoking_computer_shop.gif';
import cyberBar from '../assets/gifs/cyber_bar.gif';
import redRainCity from '../assets/gifs/red_rain_city.gif';
import soundWaves from '../assets/gifs/sound_waves.gif';
import rooftopCar from '../assets/gifs/rooftop_flying_car.gif';

// ── Change PIN here ───────────────────────────────────────────────
const HUB_PIN = '6969';

// ── Module registry — add entries here to expand the hub ─────────
const MODULES = [
  {
    id: 'cits5508',
    code: 'CITS5508',
    title: 'Machine Learning',
    description: 'Neural architectures · supervised & unsupervised learning · feature engineering · model evaluation & deployment.',
    gif: computerShop,
    color: 'cyan',
    tag: 'ACTIVE',
  },
  {
    id: 'cits4012',
    code: 'CITS4012',
    title: 'AI & Adaptive Systems',
    description: 'Intelligent agents · NLP · adaptive algorithms · evolutionary computation · reinforcement learning.',
    gif: cyberBar,
    color: 'violet',
    tag: 'ACTIVE',
  },
];

// ── PIN Gate ─────────────────────────────────────────────────────
function PinGate({ onUnlock }) {
  const [digits, setDigits] = useState(['', '', '', '']);
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);
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
      if (pin === HUB_PIN) {
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
    <div className="hub-gate">
      <div className="hub-gate__bg">
        <img src={redRainCity} alt="" aria-hidden="true" className="hub-gate__gif" />
        <div className="hub-gate__overlay" />
      </div>

      <div className={`hub-gate__box${shake ? ' hub-gate__box--shake' : ''}`}>
        <div className="hub-gate__logo">
          <span className="text-cyan">[</span>
          &nbsp;LEARNING HUB&nbsp;
          <span className="text-cyan">]</span>
        </div>
        <p className="hub-gate__label">ENTER ACCESS CODE</p>
        <div className="hub-gate__inputs">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={el => (inputs.current[i] = el)}
              className={`hub-gate__digit${error ? ' hub-gate__digit--error' : ''}`}
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
        {error && <p className="hub-gate__error">// ACCESS DENIED</p>}
      </div>
    </div>
  );
}

// ── Module Card ───────────────────────────────────────────────────
function ModuleCard({ module }) {
  const navigate = useNavigate();
  const colorVars = {
    cyan: { border: 'var(--cyan)', glow: 'var(--glow-cyan)', dim: 'var(--cyan-dim)', text: 'var(--cyan)' },
    violet: { border: 'var(--violet)', glow: 'var(--glow-violet)', dim: 'var(--violet-dim)', text: 'var(--violet)' },
    emerald: { border: 'var(--emerald)', glow: 'var(--glow-emerald)', dim: 'var(--emerald-dim)', text: 'var(--emerald)' },
    rose: { border: 'var(--rose)', glow: 'var(--glow-rose)', dim: 'var(--rose-dim)', text: 'var(--rose)' },
    amber: { border: 'var(--amber)', glow: 'var(--glow-amber)', dim: 'var(--amber-dim)', text: 'var(--amber)' },
  };
  const c = colorVars[module.color] ?? colorVars.cyan;

  return (
    <div
      className="hub-card"
      style={{ '--card-border': c.border, '--card-glow': c.glow, '--card-dim': c.dim, '--card-text': c.text }}
      onClick={() => navigate(`/hub/${module.id}`)}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && navigate(`/hub/${module.id}`)}
    >
      <div className="hub-card__gif-wrap">
        <img src={module.gif} alt="" aria-hidden="true" className="hub-card__gif" />
        <div className="hub-card__gif-overlay" />
        <span className="hub-card__tag">{module.tag}</span>
      </div>
      <div className="hub-card__body">
        <p className="hub-card__code">{module.code}</p>
        <h3 className="hub-card__title">{module.title}</h3>
        <p className="hub-card__desc">{module.description}</p>
        <span className="hub-card__enter">ENTER MODULE &rarr;</span>
      </div>
    </div>
  );
}

// ── Hub Dashboard ─────────────────────────────────────────────────
export default function Hub() {
  const [authed, setAuthed] = useState(
    () => sessionStorage.getItem('hub_auth') === '1'
  );

  useEffect(() => {
    document.title = 'Learning Hub';
    return () => { document.title = 'James Wigfield'; };
  }, []);

  if (!authed) return <PinGate onUnlock={() => setAuthed(true)} />;

  return (
    <div className="hub">
      {/* Ambient strip gifs */}
      <div className="hub__ambient">
        <img src={cyberStation} alt="" aria-hidden="true" className="hub__ambient-gif hub__ambient-gif--left" />
        <img src={rooftopCar} alt="" aria-hidden="true" className="hub__ambient-gif hub__ambient-gif--right" />
      </div>

      <div className="hub__inner">
        {/* Header */}
        <header className="hub__header">
          <div className="hub__header-eye">
            <img src={soundWaves} alt="" aria-hidden="true" className="hub__eye-gif" />
          </div>
          <div className="hub__header-text">
            <p className="hub__sys-label">// SYSTEM: LEARNING HUB v1.0</p>
            <h1 className="hub__title">
              <span className="text-cyan">&lt;</span>
              Knowledge Base
              <span className="text-cyan">&nbsp;/&gt;</span>
            </h1>
            <p className="hub__subtitle">
              Interactive university modules · Select a unit to begin
            </p>
          </div>
        </header>

        {/* Stats bar */}
        <div className="hub__stats">
          <span className="hub__stat"><span className="hub__stat-val text-cyan">{MODULES.length}</span> MODULES LOADED</span>
          <span className="hub__stat-divider">·</span>
          <span className="hub__stat"><span className="hub__stat-val text-emerald">ONLINE</span> STATUS</span>
          <span className="hub__stat-divider">·</span>
          <span className="hub__stat">UWA <span className="hub__stat-val text-violet">2025</span></span>
        </div>

        {/* Module grid */}
        <div className="hub__grid">
          {MODULES.map(m => <ModuleCard key={m.id} module={m} />)}
        </div>

        <footer className="hub__footer">
          <p>// END OF DIRECTORY — {MODULES.length} unit(s) indexed</p>
        </footer>
      </div>
    </div>
  );
}
