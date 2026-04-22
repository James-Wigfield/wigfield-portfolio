import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import arcadeOutside from '../../assets/gifs/arcade_outside.gif';
import './ImposterGame.css';

const WS_BASE = import.meta.env.VITE_IMPOSTER_WS_URL ?? 'wss://imposter-game-worker.jameswigfield1.workers.dev/ws';

const CATEGORIES = ['Animals', 'Food', 'Places', 'Movies', 'Sports', 'Objects', 'Professions', 'Sci-Fi'];

// ── Shared layout wrapper (gif banner + back button) ──────────────────────────
function PageShell({ tagline, children, onLeave }) {
  return (
    <div className="ig-wrapper">
      {/* Top banner */}
      <div className="ig-banner">
        <img src={arcadeOutside} alt="" aria-hidden="true" className="ig-banner-gif" />
        <div className="ig-banner-overlay" />
        <div className="ig-banner-scan" />
        <div className="ig-banner-content">
          <p className="ig-logo">// WORD IMPOSTER</p>
          {tagline && <p className="ig-tagline">{tagline}</p>}
        </div>
        <button className="ig-back-btn" onClick={onLeave}>← ARCADE</button>
      </div>

      <div className="ig-body">
        {children}
      </div>
    </div>
  );
}

// ── Entry screen ──────────────────────────────────────────────────────────────
function EntryScreen({ onConnect, onLeave, connError }) {
  const [name, setName]       = useState('');
  const [room, setRoom]       = useState('');
  const [error, setError]     = useState('');
  const [joining, setJoining] = useState(false);

  const connect = (code) => {
    if (!name.trim()) { setError('Enter your callsign first.'); return; }
    if (code !== null && code.length < 4) { setError('Enter a valid 4-letter room code.'); return; }
    setError('');
    onConnect(name.trim(), code);
  };

  return (
    <PageShell tagline="ONE PLAYER DOESN'T KNOW THE WORD — FIND THEM" onLeave={onLeave}>
      <div className="ig-screen">
        <div className="ig-card">
          <label className="ig-label" htmlFor="ig-name">YOUR CALLSIGN</label>
          <input
            id="ig-name"
            className="ig-input"
            type="text"
            placeholder="e.g. NightOwl"
            maxLength={24}
            autoComplete="off"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && connect(null)}
          />

          {(error || connError) && <p className="ig-error">// {error || connError}</p>}

          <button className="ig-btn ig-btn--amber" onClick={() => connect(null)}>
            CREATE ROOM
          </button>

          <div className="ig-divider">or join existing</div>

          {!joining ? (
            <button className="ig-btn ig-btn--ghost" onClick={() => setJoining(true)}>
              JOIN ROOM →
            </button>
          ) : (
            <>
              <label className="ig-label" htmlFor="ig-room">ROOM CODE</label>
              <input
                id="ig-room"
                className="ig-input ig-input--code"
                type="text"
                placeholder="ABCD"
                maxLength={4}
                autoComplete="off"
                value={room}
                onChange={e => setRoom(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
                onKeyDown={e => e.key === 'Enter' && connect(room)}
                autoFocus
              />
              <button className="ig-btn ig-btn--cyan" onClick={() => connect(room)}>
                JOIN ROOM →
              </button>
            </>
          )}
        </div>
      </div>
    </PageShell>
  );
}

// ── Lobby screen ──────────────────────────────────────────────────────────────
function LobbyScreen({ state, onStart, onConfig, onLeave }) {
  const playerCount = state.players.length;

  const imposterOptions = [
    { value: 'random', label: 'RANDOM' },
    ...Array.from({ length: playerCount }, (_, i) => ({
      value: String(i + 1),
      label: String(i + 1),
    })),
  ];

  const handleCategory = (e) => onConfig({ category: e.target.value });
  const handleImposters = (e) => onConfig({ imposters: e.target.value });

  return (
    <PageShell tagline={`ROOM: ${state.roomCode} · ROUND ${state.roundCount}`} onLeave={onLeave}>
      <div className="ig-screen">
        <div className="ig-card">
          <p className="ig-label">ROOM CODE</p>
          <p className="ig-room-code">{state.roomCode}</p>

          <p className="ig-label">PLAYERS ({playerCount})</p>
          <ul className="ig-player-list">
            {state.players.map(p => (
              <li key={p.id} className="ig-player">
                <span className="ig-player-name">{p.name}</span>
                {p.isHost && <span className="ig-badge ig-badge--host">HOST</span>}
                {p.isYou  && <span className="ig-badge ig-badge--you">YOU</span>}
              </li>
            ))}
          </ul>

          {/* Config — visible to all, editable by host only */}
          <div className="ig-config">
            <div className="ig-config-row">
              <label className="ig-label" htmlFor="ig-cat">CATEGORY</label>
              {state.isHost ? (
                <select
                  id="ig-cat"
                  className="ig-select"
                  value={state.config.category}
                  onChange={handleCategory}
                >
                  <option value="random">RANDOM</option>
                  {CATEGORIES.map(c => (
                    <option key={c} value={c}>{c.toUpperCase()}</option>
                  ))}
                </select>
              ) : (
                <p className="ig-config-val">
                  {state.config.category === 'random' ? 'RANDOM' : state.config.category.toUpperCase()}
                </p>
              )}
            </div>

            <div className="ig-config-row">
              <label className="ig-label" htmlFor="ig-imp">IMPOSTERS</label>
              {state.isHost ? (
                <select
                  id="ig-imp"
                  className="ig-select"
                  value={state.config.imposters}
                  onChange={handleImposters}
                >
                  {imposterOptions.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              ) : (
                <p className="ig-config-val">
                  {state.config.imposters === 'random' ? 'RANDOM' : state.config.imposters}
                </p>
              )}
            </div>
          </div>

          {state.isHost ? (
            <button
              className="ig-btn ig-btn--cyan"
              onClick={onStart}
              disabled={playerCount < 2}
            >
              {playerCount < 2 ? 'WAITING FOR PLAYERS…' : 'START GAME →'}
            </button>
          ) : (
            <p className="ig-hint">Waiting for the host to start the game…</p>
          )}
        </div>
      </div>
    </PageShell>
  );
}

// ── Game screen ───────────────────────────────────────────────────────────────
function GameScreen({ state, onNextRound, onBackToLobby, onLeave }) {
  const isImposter = state.role === 'imposter';
  const hasFellows = isImposter && state.fellowImposters?.length > 0;

  return (
    <PageShell tagline={`ROOM: ${state.roomCode} · ROUND ${state.roundCount}`} onLeave={onLeave}>
      <div className="ig-screen">
        {/* Role reveal card */}
        <div className={`ig-card ig-role-card ${isImposter ? 'ig-role-card--imposter' : 'ig-role-card--player'}`}>
          <span className={`ig-role-tag ${isImposter ? 'ig-role-tag--imposter' : 'ig-role-tag--player'}`}>
            {isImposter ? 'IMPOSTER' : 'CREW MEMBER'}
          </span>

          {isImposter ? (
            <>
              <p className="ig-role-title ig-role-title--imposter">You Are the Imposter</p>
              <p className="ig-role-hint">Blend in. Don't let them know you don't know the word.</p>
              {state.category && <p className="ig-role-cat">CATEGORY: {state.category}</p>}
              {hasFellows && (
                <p className="ig-role-fellows">
                  ALLIES: {state.fellowImposters.join(', ')}
                </p>
              )}
            </>
          ) : (
            <>
              <p className="ig-role-title">The secret word is</p>
              <p className="ig-role-word">{state.word}</p>
              {state.category && <p className="ig-role-cat">CATEGORY: {state.category}</p>}
              <p className="ig-role-hint">
                Discuss without saying it outright.{' '}
                {state.imposterCount > 1
                  ? `There are ${state.imposterCount} imposters.`
                  : 'Find the Imposter.'}
              </p>
            </>
          )}
        </div>

        {/* Player list + host controls */}
        <div className="ig-card" style={{ marginTop: '1rem' }}>
          <p className="ig-label">PLAYERS</p>
          <ul className="ig-player-list">
            {state.players.map(p => (
              <li key={p.id} className="ig-player">
                <span className="ig-player-name">{p.name}</span>
                {p.isHost && <span className="ig-badge ig-badge--host">HOST</span>}
                {p.isYou  && <span className="ig-badge ig-badge--you">YOU</span>}
              </li>
            ))}
          </ul>

          {state.isHost && (
            <div className="ig-host-actions">
              <button className="ig-btn ig-btn--cyan" onClick={onNextRound}
                disabled={state.players.length < 2}>
                NEXT ROUND →
              </button>
              <button className="ig-btn ig-btn--ghost" onClick={onBackToLobby}>
                ← BACK TO LOBBY
              </button>
            </div>
          )}
          {!state.isHost && (
            <p className="ig-hint" style={{ marginTop: '0.5rem' }}>
              Waiting for host to start next round…
            </p>
          )}
        </div>
      </div>
    </PageShell>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ImposterGame() {
  const navigate              = useNavigate();
  const wsRef                 = useRef(null);
  const [screen, setScreen]   = useState('entry');
  const [gameState, setGameState] = useState(null);
  const [connError, setConnError] = useState('');

  useEffect(() => {
    document.title = 'Word Imposter';
    return () => { document.title = 'Arcade Vault'; };
  }, []);

  useEffect(() => {
    return () => wsRef.current?.close();
  }, []);

  const leaveToArcade = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
    navigate('/games');
  }, [navigate]);

  const connect = useCallback((name, roomCode) => {
    setConnError('');

    const url = new URL(WS_BASE);
    url.searchParams.set('name', name);
    if (roomCode) url.searchParams.set('room', roomCode);

    const ws = new WebSocket(url.toString());
    wsRef.current = ws;

    ws.onmessage = (e) => {
      connected = true;
      let data;
      try { data = JSON.parse(e.data); } catch { return; }
      if (data.type === 'state') {
        setGameState(data);
        setScreen(data.phase === 'game' ? 'game' : 'lobby');
      }
    };

    let connected = false;

    ws.onclose = () => {
      if (wsRef.current === ws) {
        wsRef.current = null;
        setScreen('entry');
        if (connected) setConnError('Disconnected from server.');
      }
    };

    ws.onerror = () => {
      setConnError('Could not connect to the game server. Check the Worker is deployed.');
    };
  }, []);

  const sendMsg = useCallback((msg) => {
    wsRef.current?.send(JSON.stringify(msg));
  }, []);

  if (screen === 'entry') {
    return (
      <EntryScreen
        onConnect={connect}
        onLeave={leaveToArcade}
        connError={connError}
      />
    );
  }

  if (screen === 'lobby' && gameState) {
    return (
      <LobbyScreen
        state={gameState}
        onStart={() => sendMsg({ type: 'start' })}
        onConfig={(patch) => sendMsg({ type: 'config', ...patch })}
        onLeave={leaveToArcade}
      />
    );
  }

  if (screen === 'game' && gameState) {
    return (
      <GameScreen
        state={gameState}
        onNextRound={() => sendMsg({ type: 'next_round' })}
        onBackToLobby={() => sendMsg({ type: 'to_lobby' })}
        onLeave={leaveToArcade}
      />
    );
  }

  return null;
}
