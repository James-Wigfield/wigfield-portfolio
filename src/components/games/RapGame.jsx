import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import cyberBand from '../../assets/gifs/cyber_band.gif';
import './RapGame.css';

// ── Rhyme dictionary ─────────────────────────────────────────────────────────
// Each family groups words sharing an end-sound. The first word in the array
// tends to be the "anchor" — but any can serve as a rhyme target.
const RHYME_FAMILIES = [
  { name: 'IGHT',  words: ['light','night','sight','fight','right','bright','flight','tight','might','plight','bite','kite','unite','ignite','spite','invite'] },
  { name: 'AY',    words: ['day','way','say','play','stay','gray','pay','bay','ray','away','today','replay','delay','decay','betray','okay','survey','display','holiday','runway'] },
  { name: 'EAT',   words: ['beat','heat','street','sweet','neat','defeat','repeat','complete','elite','retreat','treat','meet','seat','feet','concrete','discreet','compete'] },
  { name: 'OW',    words: ['low','flow','slow','glow','snow','blow','grow','show','throw','know','pro','go','shadow','window','solo','below','tomorrow','rainbow'] },
  { name: 'AME',   words: ['game','name','fame','flame','blame','frame','same','shame','lame','aim','tame','claim','acclaim','rename'] },
  { name: 'ACK',   words: ['back','track','attack','snack','crack','smack','pack','stack','lack','rack','jack','slack','black','hack','sack','knack','flashback'] },
  { name: 'IRE',   words: ['fire','wire','hire','desire','attire','retire','higher','liar','flyer','inspire','choir','tire','satire','umpire','sapphire'] },
  { name: 'IND',   words: ['mind','find','blind','kind','grind','signed','designed','defined','refined','aligned','rewind','behind','remind','combined','unwind'] },
  { name: 'OUND',  words: ['ground','sound','found','around','profound','astound','bound','hound','pound','round','surround','rebound','underground','newfound'] },
  { name: 'ING',   words: ['ring','sing','bring','king','swing','thing','sting','wing','spring','fling','cling','string','bling','everything','offering'] },
  { name: 'OLD',   words: ['old','gold','cold','bold','told','hold','sold','fold','mold','scold','controlled','behold','unfold','retold','stronghold'] },
  { name: 'ART',   words: ['heart','start','art','smart','part','chart','depart','restart','apart','dart','cart','kart','impart','sweetheart'] },
  { name: 'IME',   words: ['time','rhyme','climb','prime','crime','dime','lime','mime','slime','sublime','lifetime','downtime','overtime','pantomime'] },
  { name: 'AKE',   words: ['take','make','fake','lake','snake','break','awake','mistake','wake','shake','stake','cake','bake','quake','undertake','remake'] },
  { name: 'IST',   words: ['list','fist','twist','mist','exist','resist','persist','insist','dismissed','wrist','kissed','enlist','assist'] },
  { name: 'UCK',   words: ['luck','struck','truck','stuck','duck','buck','pluck','shuck','muck','puck','potluck','amok'] },
  { name: 'EAL',   words: ['real','deal','feel','heal','peel','steal','wheel','kneel','conceal','reveal','ideal','meal','seal','appeal','surreal','ordeal'] },
  { name: 'IP',    words: ['flip','grip','slip','trip','drip','ship','dip','hip','lip','rip','sip','whip','chip','equip','tip','spaceship','friendship'] },
  { name: 'ED',    words: ['head','bread','said','red','led','dead','shed','spread','thread','instead','ahead','fed','misled','widespread'] },
  { name: 'OST',   words: ['most','coast','host','ghost','roast','toast','post','boast','almost','signpost','outpost'] },
  { name: 'OWN',   words: ['down','town','crown','frown','brown','gown','clown','drown','renown','breakdown','countdown','showdown','rundown'] },
  { name: 'OON',   words: ['moon','soon','noon','spoon','cartoon','balloon','lagoon','platoon','monsoon','tycoon','typhoon','afternoon'] },
  { name: 'EAR',   words: ['fear','near','clear','year','hear','tear','gear','appear','severe','sincere','cheer','steer','engineer','chandelier'] },
  { name: 'OW2',   words: ['now','how','wow','bow','plow','allow','somehow','endow','disavow','anyhow'] },
  { name: 'OOM',   words: ['boom','room','doom','zoom','gloom','bloom','tomb','plume','consume','assume','costume','perfume','heirloom','classroom'] },
  { name: 'OWER',  words: ['power','tower','flower','hour','sour','shower','devour','superpower','willpower','overpower'] },
  { name: 'AIN',   words: ['rain','brain','chain','pain','train','stain','main','plane','insane','remain','complain','explain','champagne','hurricane','membrane'] },
  { name: 'OPE',   words: ['hope','rope','cope','scope','dope','slope','envelope','horoscope','telescope','microscope','antelope'] },
];

const TEMPOS = [
  { label: 'CHILL · 75 BPM',   bpm: 75  },
  { label: 'STANDARD · 88 BPM', bpm: 88  },
  { label: 'HYPE · 100 BPM',    bpm: 100 },
];

const BARS_PER_FAMILY = 4;   // stay in same rhyme family this many bars
const BEATS_PER_BAR   = 4;
const BLOCKS_PER_BAR  = 4;   // 3 hidden + 1 rhyme target

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Pick a random item from `arr` that is not in `recent`. If everything is
// recent (small pools, long history), fall back to anything except the
// most-recent entry so we never repeat back-to-back.
const pickFresh = (arr, recent) => {
  const recentSet = new Set(recent);
  const fresh = arr.filter(x => !recentSet.has(x));
  if (fresh.length > 0) return pick(fresh);
  const last = recent[recent.length - 1];
  const fallback = arr.filter(x => x !== last);
  return fallback.length > 0 ? pick(fallback) : pick(arr);
};

// Roll a new family index, avoiding any in the `recent` list.
const pickFreshFamilyIdx = (recent) => {
  const all = RHYME_FAMILIES.map((_, i) => i);
  const recentSet = new Set(recent);
  const fresh = all.filter(i => !recentSet.has(i));
  if (fresh.length > 0) return pick(fresh);
  const last = recent[recent.length - 1];
  const fallback = all.filter(i => i !== last);
  return fallback.length > 0 ? pick(fallback) : pick(all);
};

// ── Web Audio drum kit ───────────────────────────────────────────────────────
function playKick(ctx, time, dest) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.frequency.setValueAtTime(140, time);
  osc.frequency.exponentialRampToValueAtTime(40, time + 0.22);
  gain.gain.setValueAtTime(0.95, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.32);
  osc.connect(gain).connect(dest);
  osc.start(time);
  osc.stop(time + 0.34);
}

function playSnare(ctx, time, dest) {
  const len = Math.floor(ctx.sampleRate * 0.2);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const noise = ctx.createBufferSource();
  noise.buffer = buf;
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 1500;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.55, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.18);

  // Add a tonal body to the snare
  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.value = 220;
  const oscGain = ctx.createGain();
  oscGain.gain.setValueAtTime(0.25, time);
  oscGain.gain.exponentialRampToValueAtTime(0.001, time + 0.12);

  noise.connect(hp).connect(gain).connect(dest);
  osc.connect(oscGain).connect(dest);
  noise.start(time); noise.stop(time + 0.2);
  osc.start(time);   osc.stop(time + 0.13);
}

function playHat(ctx, time, dest, vol = 0.18) {
  const len = Math.floor(ctx.sampleRate * 0.05);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const noise = ctx.createBufferSource();
  noise.buffer = buf;
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 7500;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(vol, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
  noise.connect(hp).connect(gain).connect(dest);
  noise.start(time);
  noise.stop(time + 0.05);
}

function playBass(ctx, time, dest, freq = 65) {
  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(freq, time);
  osc.frequency.exponentialRampToValueAtTime(freq * 0.9, time + 0.4);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(0.45, time + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.45);
  osc.connect(gain).connect(dest);
  osc.start(time);
  osc.stop(time + 0.5);
}

// ── Game shell ───────────────────────────────────────────────────────────────
function Shell({ onLeave, children }) {
  return (
    <div className="game-wrapper">
      <div className="game-banner">
        <img src={cyberBand} alt="" aria-hidden="true" className="game-banner-gif rg-banner-gif" />
        <div className="game-banner-overlay" />
        <div className="game-banner-scan" />
        <div className="game-banner-content">
          <p className="rg-logo">// FREESTYLE LAB</p>
          <p className="rg-tagline">DROP THE BEAT · CATCH THE RHYME · OWN THE MIC</p>
        </div>
        <button className="game-back-btn" onClick={onLeave}>← ARCADE</button>
      </div>
      <div className="game-body">{children}</div>
    </div>
  );
}

// ── Entry / setup screen ─────────────────────────────────────────────────────
function SetupScreen({ onStart, onLeave }) {
  const [bpm, setBpm] = useState(88);
  return (
    <Shell onLeave={onLeave}>
      <div className="game-screen rg-setup">
        <div className="game-card">
          <p className="rg-section-title">PICK YOUR TEMPO</p>
          <p className="rg-section-sub">
            The ball bounces over your bars. Fill the empty blocks with your own words —
            land the rhyme on the highlighted target. No lyrics provided. Just flow.
          </p>

          <div className="rg-tempo-grid">
            {TEMPOS.map(t => (
              <button
                key={t.bpm}
                className={`rg-tempo-btn${bpm === t.bpm ? ' rg-tempo-btn--on' : ''}`}
                onClick={() => setBpm(t.bpm)}
              >
                {t.label}
              </button>
            ))}
          </div>

          <button className="game-btn game-btn--amber" onClick={() => onStart(bpm)}>
            DROP THE BEAT →
          </button>
        </div>

        <div className="rg-how-to">
          <p className="rg-how-title">HOW TO FREESTYLE</p>
          <ol className="rg-how-list">
            <li>Watch the <span className="rg-hi">bouncing ball</span> over the four blocks of each bar</li>
            <li>The first three blocks are <span className="rg-hi--violet">your bars</span> — improvise any words that fit the rhythm</li>
            <li>The last block is the <span className="rg-hi">rhyme target</span> — land your line on a word that rhymes with it</li>
            <li>The rhyme bank below shows fallback words from the same family</li>
            <li>Two bars per target, four bars per family — couplets to verses, you set the story</li>
          </ol>
        </div>
      </div>
    </Shell>
  );
}

const BPM_MIN = 50;
const BPM_MAX = 160;

// ── In-game screen ───────────────────────────────────────────────────────────
function PlayScreen({ bpm: initialBpm, onStop, onLeave }) {
  // Refs that live across frames without forcing re-renders.
  const audioCtxRef    = useRef(null);
  const masterGainRef  = useRef(null);
  const startTimeRef   = useRef(0);
  const schedulerIdRef = useRef(null);
  const nextStepRef    = useRef(0);          // 16th-note step counter
  const nextNoteAtRef  = useRef(0);          // audio context time of next 16th
  const rafRef         = useRef(null);
  const ballRef        = useRef(null);
  const trackRef       = useRef(null);
  const lastBarRef     = useRef(-1);
  const bpmRef         = useRef(initialBpm); // live tempo, read every tick

  // Recent-history queues to avoid repeats. Sized so the player has to
  // cycle through a lot of distinct content before ever seeing a repeat.
  const recentTargetsRef  = useRef([]); // last N rhyme target words
  const recentFamiliesRef = useRef([]); // last M rhyme family indices
  const TARGET_HISTORY  = 24;
  const FAMILY_HISTORY  = 6;

  // The visible bar info — only updated when bar boundary crosses, not per frame.
  const [barIndex,  setBarIndex]  = useState(0);
  const [familyIdx, setFamilyIdx] = useState(() => Math.floor(Math.random() * RHYME_FAMILIES.length));
  const [target,    setTarget]    = useState(() => pick(RHYME_FAMILIES[0].words));
  const [muted,     setMuted]     = useState(false);
  const [paused,    setPaused]    = useState(false);
  const [liveBpm,   setLiveBpm]   = useState(initialBpm);

  // Initialize audio + scheduler + animation loop on mount
  useEffect(() => {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    const master = ctx.createGain();
    master.gain.value = 0.7;
    master.connect(ctx.destination);
    audioCtxRef.current   = ctx;
    masterGainRef.current = master;

    if (ctx.state === 'suspended') ctx.resume();

    startTimeRef.current  = ctx.currentTime + 0.15;
    nextNoteAtRef.current = startTimeRef.current;
    nextStepRef.current   = 0;

    // Pick an initial family + target. Seed the history queues so the first
    // rotation also avoids the starting choice.
    const initialFamily = Math.floor(Math.random() * RHYME_FAMILIES.length);
    const initialTarget = pick(RHYME_FAMILIES[initialFamily].words);
    setFamilyIdx(initialFamily);
    setTarget(initialTarget);
    recentFamiliesRef.current = [initialFamily];
    recentTargetsRef.current  = [initialTarget];

    // ── Scheduler — schedules ahead of audio playhead in small windows ─────
    const scheduler = () => {
      if (ctx.state !== 'running') return;
      const lookahead = ctx.currentTime + 0.12;
      while (nextNoteAtRef.current < lookahead) {
        const step = nextStepRef.current;
        const time = nextNoteAtRef.current;
        const dest = masterGainRef.current;

        // 16-step boom-bap pattern: kick on 1 & 3, snare on 2 & 4, hat on every 8th.
        if (step === 0 || step === 8)         playKick(ctx, time, dest);
        if (step === 4 || step === 12)        playSnare(ctx, time, dest);
        if (step % 2 === 0)                   playHat(ctx, time, dest, step % 4 === 0 ? 0.22 : 0.13);
        if (step === 0)                       playBass(ctx, time, dest, 55);
        if (step === 6)                       playBass(ctx, time, dest, 73);
        if (step === 10)                      playBass(ctx, time, dest, 49);

        // Read live tempo each step so slider drags retune the gap mid-bar.
        const sixteenthDur = (60 / bpmRef.current) / 4;
        nextNoteAtRef.current += sixteenthDur;
        nextStepRef.current = (nextStepRef.current + 1) % 16;
      }
    };
    schedulerIdRef.current = setInterval(scheduler, 25);

    // ── rAF animation loop — moves ball, detects bar boundaries ─────────────
    const tick = () => {
      const now = ctx.currentTime;
      // While paused, freeze the ball — startTimeRef gets advanced on resume
      // so the bar position picks up from where it stopped.
      if (ctx.state !== 'running') {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      const elapsed = Math.max(0, now - startTimeRef.current);
      const liveBeatDur = 60 / bpmRef.current;
      const beatPos    = elapsed / liveBeatDur;             // monotonic in beats
      const beatInBar  = beatPos % BEATS_PER_BAR;            // 0..4
      const segIndex   = Math.floor(beatInBar);              // 0..3
      const t          = beatInBar - segIndex;               // 0..1 within segment
      const progress   = beatInBar / BEATS_PER_BAR;          // 0..1 across the bar

      // Ball horizontal position: blocks centred at 12.5%, 37.5%, 62.5%, 87.5%
      const xPct = 12.5 + progress * 75;
      // Ball vertical arc per segment — taller when we change segments
      const arc  = Math.sin(t * Math.PI);

      if (ballRef.current) {
        ballRef.current.style.left = `${xPct}%`;
        ballRef.current.style.transform = `translate(-50%, ${-arc * 70}px) scale(${1 - arc * 0.12})`;
      }
      if (trackRef.current) {
        trackRef.current.dataset.active = String(segIndex);
      }

      const currentBar = Math.floor(beatPos / BEATS_PER_BAR);
      if (currentBar !== lastBarRef.current) {
        lastBarRef.current = currentBar;
        setBarIndex(currentBar);
      }

      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      clearInterval(schedulerIdRef.current);
      cancelAnimationFrame(rafRef.current);
      try { ctx.close(); } catch (_) { /* ignore */ }
    };
    // Audio + loops are mounted once. Tempo changes are handled live via
    // bpmRef + setTempo() and never tear this down.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When a new bar starts, possibly rotate target / family. Both rolls draw
  // from the recent-history queues so we don't repeat words back-to-back.
  useEffect(() => {
    // Skip the very first bar (bar 0) — keep initial target.
    if (barIndex === 0) return;
    setFamilyIdx(prevFamily => {
      const isFamilyChange = barIndex % BARS_PER_FAMILY === 0;
      const nextFamily = isFamilyChange
        ? pickFreshFamilyIdx(recentFamiliesRef.current)
        : prevFamily;

      if (isFamilyChange) {
        const fq = [...recentFamiliesRef.current, nextFamily];
        recentFamiliesRef.current = fq.slice(-FAMILY_HISTORY);
      }

      setTarget(() => {
        const nextTarget = pickFresh(
          RHYME_FAMILIES[nextFamily].words,
          recentTargetsRef.current,
        );
        const tq = [...recentTargetsRef.current, nextTarget];
        recentTargetsRef.current = tq.slice(-TARGET_HISTORY);
        return nextTarget;
      });
      return nextFamily;
    });
  }, [barIndex]);

  // Mute toggle
  const toggleMute = useCallback(() => {
    const m = masterGainRef.current;
    if (!m) return;
    setMuted(prev => {
      m.gain.value = prev ? 0.7 : 0;
      return !prev;
    });
  }, []);

  // Live tempo change — rebase startTime so the current bar position is
  // preserved under the new BPM, then re-align the scheduler's next 16th-note
  // boundary so kick/snare placement stays in phase.
  const setTempo = useCallback((newBpm) => {
    const clamped = Math.max(BPM_MIN, Math.min(BPM_MAX, Math.round(newBpm)));
    const ctx = audioCtxRef.current;
    if (!ctx) {
      bpmRef.current = clamped;
      setLiveBpm(clamped);
      return;
    }
    const oldBeatDur = 60 / bpmRef.current;
    const newBeatDur = 60 / clamped;
    const now = ctx.currentTime;
    const elapsed = Math.max(0, now - startTimeRef.current);
    const beatPos = elapsed / oldBeatDur;

    // Preserve beat phase: pick a startTime that gives the same beatPos under
    // the new beat duration.
    startTimeRef.current = now - beatPos * newBeatDur;

    // Realign scheduler to the next 16th-note boundary under the new tempo.
    const newSixteenthDur = newBeatDur / 4;
    let stepIdx = Math.ceil(beatPos * 4);
    let nextNoteAt = startTimeRef.current + stepIdx * newSixteenthDur;
    while (nextNoteAt < now + 0.02) {
      stepIdx += 1;
      nextNoteAt += newSixteenthDur;
    }
    nextNoteAtRef.current = nextNoteAt;
    nextStepRef.current = ((stepIdx % 16) + 16) % 16;

    bpmRef.current = clamped;
    setLiveBpm(clamped);
  }, []);

  // Pause / resume — suspending the AudioContext freezes ctx.currentTime,
  // which freezes the ball animation and the note scheduler in lockstep.
  // No bookkeeping required: when we resume, currentTime continues from where
  // it left off so the bar position is preserved.
  const togglePause = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    setPaused(prev => {
      if (prev) ctx.resume();
      else      ctx.suspend();
      return !prev;
    });
  }, []);

  const family = RHYME_FAMILIES[familyIdx];
  const rhymeBank = family.words.filter(w => w !== target).slice(0, 8);

  return (
    <Shell onLeave={onLeave}>
      <div className="game-screen rg-play">
        {/* Bar status header */}
        <div className="rg-status">
          <span className="rg-status-pill">BAR {barIndex + 1}</span>
          <span className="rg-status-pill rg-status-pill--violet">FAMILY · {family.name}</span>
          <span className="rg-status-pill rg-status-pill--rose">{liveBpm} BPM</span>
        </div>

        {/* Track: bouncing ball + 4 blocks */}
        <div className="rg-stage">
          <div className="rg-track" ref={trackRef} data-active="0">
            <div className="rg-ball" ref={ballRef} />
            {[0, 1, 2].map(i => (
              <div key={i} className="rg-block rg-block--hidden" data-idx={i}>
                <span className="rg-block-glyph">▓▓▓</span>
              </div>
            ))}
            <div className="rg-block rg-block--target" data-idx={3}>
              <span className="rg-block-label">RHYME ON</span>
              <span className="rg-block-word">{target}</span>
            </div>
          </div>
        </div>

        {/* Rhyme bank inspiration */}
        <div className="game-card rg-bank">
          <div className="rg-bank-header">
            <p className="rg-label">RHYME BANK · {family.name}</p>
            <p className="rg-bank-hint">land your line on any of these</p>
          </div>
          <div className="rg-bank-grid">
            {rhymeBank.map(w => (
              <span key={w} className="rg-bank-chip">{w}</span>
            ))}
          </div>
        </div>

        {/* Tempo slider — match an external beat by ear */}
        <div className="game-card rg-tempo-card">
          <div className="rg-tempo-card-head">
            <span className="rg-label">TEMPO</span>
            <span className="rg-tempo-readout">{liveBpm} <span className="rg-tempo-unit">BPM</span></span>
          </div>
          <input
            type="range"
            className="rg-tempo-slider"
            min={BPM_MIN}
            max={BPM_MAX}
            step={1}
            value={liveBpm}
            onChange={(e) => setTempo(Number(e.target.value))}
            aria-label="Tempo in beats per minute"
          />
          <div className="rg-tempo-scale">
            <span>{BPM_MIN}</span>
            <span className="rg-tempo-scale-mid">drag to match your beat</span>
            <span>{BPM_MAX}</span>
          </div>
          <div className="rg-tempo-nudge">
            <button className="rg-nudge-btn" onClick={() => setTempo(liveBpm - 5)}>−5</button>
            <button className="rg-nudge-btn" onClick={() => setTempo(liveBpm - 1)}>−1</button>
            <button className="rg-nudge-btn" onClick={() => setTempo(liveBpm + 1)}>+1</button>
            <button className="rg-nudge-btn" onClick={() => setTempo(liveBpm + 5)}>+5</button>
          </div>
        </div>

        {/* Controls */}
        <div className="rg-controls rg-controls--three">
          <button className="game-btn game-btn--cyan" onClick={togglePause}>
            {paused ? '▶ RESUME' : '❚❚ PAUSE'}
          </button>
          <button className="game-btn game-btn--ghost" onClick={toggleMute}>
            {muted ? '♪ UNMUTE' : '× MUTE'}
          </button>
          <button className="game-btn game-btn--rose" onClick={onStop}>
            STOP
          </button>
        </div>

        {paused && (
          <p className="rg-paused-banner">// PAUSED — beat held, ball frozen</p>
        )}

        <p className="rg-foot-hint">
          // tip: the first three blocks are yours — say anything that fits the rhythm,
          land your last word on the rhyme target.
        </p>
      </div>
    </Shell>
  );
}

// ── Main component ───────────────────────────────────────────────────────────
export default function RapGame() {
  const navigate = useNavigate();
  const [bpm, setBpm] = useState(null); // null = on setup screen

  useEffect(() => {
    document.title = 'Freestyle Lab';
    return () => { document.title = 'Arcade Vault'; };
  }, []);

  const leave = useCallback(() => navigate('/games'), [navigate]);

  if (bpm == null) return <SetupScreen onStart={setBpm} onLeave={leave} />;
  return <PlayScreen bpm={bpm} onStop={() => setBpm(null)} onLeave={leave} />;
}
