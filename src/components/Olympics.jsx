import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import './Olympics.css';

/* ── Arena colours (scoped tokens live in Olympics.css) ──────────── */
const C = {
  amber:   '#FFB02E',
  orange:  '#FF6A1F',
  teal:    '#1FE3B6',
  magenta: '#FF1F6B',
  lime:    '#C9FF49',
  purple:  '#9b87f5',
};

/* ── The arenas — one corner of the place per game ───────────────── */
const ARENAS = [
  {
    tag: 'The Depot',
    color: C.amber,
    title: 'Beer Station',
    game: 'Kitchen · self-serve refuel',
    desc: 'Cups, ice, drinks and a big jug of water living side by side. Label your cup, top up, catch your breath. No game, no points — this is where you relax between rounds.',
    meta: [['Open', 'all day'], ['Water', 'right here']],
  },
  {
    tag: 'Front Garden',
    color: C.teal,
    title: 'Stack Cup',
    star: true,
    game: 'Bounce-and-pass survival',
    desc: 'Everyone circles a table. Bounce a ball into your cup, then pass clockwise. Catch the person ahead of you and they cop a stacked cup — last stack standing has to drink it.',
    meta: [['Players', '6–14'], ['Vibe', 'chaos']],
  },
  {
    tag: 'Balcony',
    color: C.magenta,
    title: 'Flip Cup & Beer Pong',
    game: 'Two cup games, one balcony',
    desc: 'The balcony runs the cup games. Flip Cup first — a loud team relay to warm everyone up. Beer Pong later — a knockout bracket under the lights, winners stay on.',
    meta: [['Flip Cup', 'teams of 5–7'], ['Beer Pong', '2v2 bracket']],
  },
  {
    tag: 'Courtyard',
    color: C.purple,
    title: 'Cheers to the Governor',
    star: true,
    game: 'The counting circle',
    desc: 'A circle game that gets sillier every round. Count to 21, drink on the toast, then the winner invents a new rule for everyone to remember. Forget a rule — you drink.',
    how: [
      ['1', <><b>Count to 21.</b> Stand in a circle and go around one number each — 1, 2, 3…</>],
      ['2', <><b>21 = the toast.</b> Whoever says “21” calls <b>“Cheers to the Governor!”</b> and everyone drinks.</>],
      ['3', <><b>Make a rule.</b> That player invents a new rule — e.g. instead of saying “4” you clap, or swap a number for a word.</>],
      ['4', <><b>Keep up or drink.</b> Restart the count with all the rules stacked on. Fumble a number or forget a rule? Take a sip.</>],
    ],
    meta: [['Players', 'any'], ['Bring', 'a good memory']],
  },
];

/* ── The run sheet — every game has a relax & drink break after it ── */
const SCHED = [
  { hm: '14:00', name: 'Doors & Beer Station',     sub: 'Roll in, grab a drink, label a cup, ease into it.',          where: 'Beer Station', area: 'Beer Station', col: C.amber },
  { hm: '14:30', name: 'Stack Cup',                sub: 'Round one — bounce-and-pass survival to kick things off.',   where: 'Front Garden', area: 'Front Garden', col: C.teal },
  { hm: '15:15', name: 'Relax & Refuel',           sub: 'Breather between games. Top up, grab water, have a chat.',   where: 'Beer Station', area: 'Beer Station', col: C.amber, isBreak: true },
  { hm: '15:45', name: 'Flip Cup',                 sub: 'Team relay — drink and flip your cup rim-up. Loud and fast.', where: 'Balcony',      area: 'Balcony',      col: C.magenta },
  { hm: '16:30', name: 'Relax & Refuel',           sub: 'Another breather. Water, snacks, plan your comeback.',       where: 'Beer Station', area: 'Beer Station', col: C.amber, isBreak: true },
  { hm: '17:00', name: 'BBQ Fires Up',             sub: 'Burgers on. Eat, drink, reset before the back half.',        where: 'Everywhere',   area: 'Beer Station', col: C.amber, feast: true },
  { hm: '18:00', name: 'Beer Pong',                sub: 'Knockout bracket under the lights — winners stay on.',       where: 'Balcony',      area: 'Balcony',      col: C.magenta, headline: true },
  { hm: '18:45', name: 'Relax & Refuel',           sub: 'Last breather before the circle. Hydrate up.',               where: 'Beer Station', area: 'Beer Station', col: C.amber, isBreak: true },
  { hm: '19:15', name: 'Cheers to the Governor',   sub: 'Counting circle — make the rules, then break them.',         where: 'Courtyard',    area: 'Courtyard',    col: C.purple, headline: true },
  { hm: '20:15', name: 'The Toast & Golden Cup',   sub: 'Cups down, tally the board, crown the champion.',            where: 'Front Garden', area: 'Beer Station', col: C.amber, feast: true },
];

const FILTERS = ['All', 'Front Garden', 'Balcony', 'Courtyard', 'Beer Station'];

const POINTS_TABLE = [
  ['Stack Cup ★',            'Survive the round · never get stacked',            '+5 / +20'],
  ['Flip Cup',               'Winning team · fastest flipper',                   '+10 / +5'],
  ['Beer Pong',              'Match win · bracket champ · trick shot',           '+15 / +25 / +5'],
  ['Cheers to the Governor', 'Land the toast on 21 · catch a rule-breaker',      '+10 / +5'],
  ['Host’s handicap',   'It’s their party, after all',                 '+15'],
];

const HOUSE_RULES = [
  ['01', <><b>One ref per game.</b> Disputes end fast — the ref’s call is final, no replays.</>],
  ['02', <><b>Water between rounds.</b> A cup of water for every game you play, no exceptions. The jug lives at the beer station.</>],
  ['03', <><b>Points carry, people drift.</b> Arrive late or leave early — your tally stays on the board.</>],
  ['04', <><b>Plastic cups only.</b> No glass anywhere near the games.</>],
  ['05', <><b>Last orders at the toast.</b> Cups down for the toast at 8:15, then awards.</>],
];

const SAFETY = [
  <><b>Pace beats points.</b> The Golden Cup isn’t worth feeling rough — drink water, eat at 5, sit a round out whenever you want.</>,
  <><b>Plastic only in the play zones.</b> No glass near the cup games or the courtyard circle.</>,
  <><b>Mind the drivers & early leavers.</b> Sort lifts or stays before the first cup. Keep soft drinks stocked at the depot.</>,
  <><b>Look out for each other.</b> If someone’s done, they’re done — get them water, a seat, and some food. No pressure, ever.</>,
];

const SCORE_BUTTONS = [5, 10, 15, 25];

/* ── Time helpers ────────────────────────────────────────────────── */
const toMin = (hm) => { const [h, m] = hm.split(':').map(Number); return h * 60 + m; };
const fmt12 = (hm) => {
  let [h, m] = hm.split(':').map(Number);
  const ap = h >= 12 ? 'PM' : 'AM';
  let hh = h % 12; if (hh === 0) hh = 12;
  return `${hh}:${String(m).padStart(2, '0')} ${ap}`;
};

/* ── Reveal-on-scroll (mirrors the reference IntersectionObserver) ── */
function useReveal() {
  const ref = useRef(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const els = root.querySelectorAll('.oly-reveal');
    if (!('IntersectionObserver' in window)) {
      els.forEach((el) => el.classList.add('oly-in'));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) { en.target.classList.add('oly-in'); io.unobserve(en.target); }
      });
    }, { threshold: 0.12 });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return ref;
}

/* ── Live run sheet ──────────────────────────────────────────────── */
function RunSheet() {
  const [nowMin, setNowMin] = useState(() => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); });
  const [filter, setFilter] = useState('All');

  useEffect(() => {
    const tick = () => { const d = new Date(); setNowMin(d.getHours() * 60 + d.getMinutes()); };
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, []);

  return (
    <>
      <div className="oly-filters oly-reveal">
        {FILTERS.map((f) => (
          <button
            key={f}
            className="oly-chip"
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="oly-card oly-reveal">
        {SCHED.map((g, i) => {
          if (filter !== 'All' && g.area !== filter) return null;
          const start = toMin(g.hm);
          const end = i < SCHED.length - 1 ? toMin(SCHED[i + 1].hm) : start + 90;
          const live = nowMin >= start && nowMin < end;
          const done = nowMin >= end;
          const cls = ['oly-fixture'];
          if (g.isBreak) cls.push('break');
          if (g.feast) cls.push('feast');
          if (g.headline) cls.push('headline');
          if (live) cls.push('live');
          if (done) cls.push('done');
          const [t, ap] = fmt12(g.hm).split(' ');
          return (
            <div key={g.hm + g.name} className={cls.join(' ')}>
              <div className="oly-t">{t}<small>{ap}</small></div>
              <div>
                <div className="oly-name">{g.name}<span className="oly-nowtag">● LIVE</span></div>
                <div className="oly-fsub">{g.sub}</div>
              </div>
              <div className="oly-where" style={{ background: g.col }}>{g.where}</div>
            </div>
          );
        })}
      </div>
    </>
  );
}

/* ── Live clock + status in the top bar ──────────────────────────── */
function TopClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);

  const nowMin = now.getHours() * 60 + now.getMinutes();
  const first = toMin(SCHED[0].hm);
  const last = toMin(SCHED[SCHED.length - 1].hm);
  let status;
  if (nowMin < first) status = 'warming up';
  else if (nowMin >= last + 90) status = 'afterparty';
  else {
    const cur = [...SCHED].filter((g) => toMin(g.hm) <= nowMin).pop();
    status = cur ? `now: ${cur.name.toLowerCase()}` : 'live';
  }
  const clock = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  return (
    <div className="oly-clock">
      <span className="oly-livepip" />
      <span>{clock}</span> · <b>{status}</b>
    </div>
  );
}

/* ── Leaderboard ─────────────────────────────────────────────────── */
function Leaderboard() {
  const [players, setPlayers] = useState([]);
  const [name, setName] = useState('');
  const nextId = useRef(0);

  const addPlayer = useCallback(() => {
    const n = name.trim();
    if (!n) return;
    setPlayers((prev) => [...prev, { id: nextId.current++, name: n, score: 0 }]);
    setName('');
  }, [name]);

  const bump = (id, n) =>
    setPlayers((prev) => prev.map((p) => (p.id === id ? { ...p, score: Math.max(0, p.score + n) } : p)));
  const remove = (id) => setPlayers((prev) => prev.filter((p) => p.id !== id));
  const seed = () => {
    if (players.length && !window.confirm('Replace the current board with 8 empty slots?')) return;
    nextId.current = 0;
    setPlayers(Array.from({ length: 8 }, (_, i) => ({ id: nextId.current++, name: `Player ${i + 1}`, score: 0 })));
  };

  const sorted = [...players].sort((a, b) => b.score - a.score || a.id - b.id);
  const top = sorted.length ? sorted[0].score : 0;

  return (
    <div className="oly-board oly-reveal">
      <div className="oly-addrow">
        <input
          type="text"
          placeholder="Add a player…"
          maxLength={20}
          autoComplete="off"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') addPlayer(); }}
        />
        <button className="oly-btn" onClick={addPlayer}>Add player</button>
        <button className="oly-btn ghost" onClick={seed}>Quick-fill 8</button>
      </div>

      {sorted.length === 0 ? (
        <div className="oly-empty">No players yet — add the crew above.</div>
      ) : (
        sorted.map((p, i) => {
          const lead = top > 0 && p.score === top;
          return (
            <div key={p.id} className={`oly-player${lead ? ' lead' : ''}`}>
              <div className="oly-rank">{lead ? '♛' : i + 1}</div>
              <div className="oly-who"><span>{p.name}</span></div>
              <div className="oly-pscore">{p.score}</div>
              <div className="oly-ctrls">
                {SCORE_BUTTONS.map((n) => (
                  <button key={n} onClick={() => bump(p.id, n)}>+{n}</button>
                ))}
                <button className="minus" onClick={() => bump(p.id, -5)}>−5</button>
                <button className="rm" onClick={() => remove(p.id)}>remove</button>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

/* ── Page ────────────────────────────────────────────────────────── */
export default function Olympics() {
  const rootRef = useReveal();

  useEffect(() => {
    document.title = 'Beer Olympics';
    return () => { document.title = 'James Wigfield'; };
  }, []);

  return (
    <div className="oly-root" ref={rootRef}>
      {/* top bar */}
      <div className="oly-topbar">
        <div className="oly-wrap">
          <Link to="/" className="oly-brand">BEER OLYMPICS<span className="oly-dot">.</span></Link>
          <TopClock />
        </div>
      </div>

      {/* hero */}
      <header className="oly-hero">
        <div className="oly-wrap">
          <div className="oly-eyebrow oly-reveal">
            <span>Saturday</span><span>Doors 2:00 PM</span><span>4 Games</span><span>One Champion</span>
          </div>
          <div className="oly-titleblock oly-reveal">
            <div className="oly-kicker">Welcome to the</div>
            <div className="oly-megatitle">BEER<br />OLYMPICS</div>
          </div>
          <p className="oly-lede oly-reveal">
            Four games. Three arenas. <strong>Drift in, drift out</strong> — points carry all day and the
            Golden Cup goes to the leader at the toast. Plenty of time to <strong>relax and drink</strong> between
            every game. Just follow the run sheet below — whatever’s on right now glows.
          </p>

          <div className="oly-stats oly-reveal">
            <div className="oly-stat"><div className="oly-stat-n o">4</div><div className="oly-stat-l">Games</div></div>
            <div className="oly-stat"><div className="oly-stat-n t">3</div><div className="oly-stat-l">Arenas</div></div>
            <div className="oly-stat"><div className="oly-stat-n m">2:00</div><div className="oly-stat-l">Kick-off</div></div>
            <div className="oly-stat"><div className="oly-stat-n a">5:00</div><div className="oly-stat-l">BBQ lights</div></div>
          </div>
        </div>
      </header>

      {/* arenas */}
      <section className="oly-section">
        <div className="oly-wrap">
          <div className="oly-sechead oly-reveal">
            <div>
              <div className="oly-idx">01 — THE MAP</div>
              <h2>The Arenas</h2>
            </div>
            <p>Every corner has a job. Find the station, play the game, win the points, move on.</p>
          </div>
          <div className="oly-arenas">
            {ARENAS.map((a) => (
              <div className="oly-arena oly-reveal" key={a.title}>
                <div className="oly-glow" style={{ background: a.color }} />
                <span className="oly-tag" style={{ background: a.color }}>{a.tag}</span>
                <h3>{a.title}{a.star && <span className="oly-star"> ★</span>}</h3>
                <div className="oly-game">{a.game}</div>
                <p className="oly-desc">{a.desc}</p>
                {a.how && (
                  <div className="oly-how">
                    {a.how.map(([k, body]) => (
                      <div className="oly-how-step" key={k}>
                        <span className="oly-k">{k}</span><span>{body}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="oly-meta">
                  {a.meta.map(([label, val]) => (
                    <span key={label}><b>{label}</b> {val}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* run sheet */}
      <section className="oly-section">
        <div className="oly-wrap">
          <div className="oly-sechead oly-reveal">
            <div>
              <div className="oly-idx">02 — THE SCHEDULE</div>
              <h2>Run Sheet</h2>
            </div>
            <p>The plan for the day, top to bottom. Whatever’s on now glows green — and there’s a relax & drink break after every game.</p>
          </div>
          <RunSheet />
        </div>
      </section>

      {/* scoring */}
      <section className="oly-section">
        <div className="oly-wrap">
          <div className="oly-sechead oly-reveal">
            <div>
              <div className="oly-idx">03 — THE MATHS</div>
              <h2>How You Win</h2>
            </div>
            <p>Points stack across every game all day. It doesn’t matter when you arrive — it matters what you sink.</p>
          </div>

          <div className="oly-scorewrap">
            <div className="oly-panel oly-reveal">
              <h3>Points Table</h3>
              <table className="oly-pts">
                <thead><tr><th>Game</th><th>What earns it</th><th>Points</th></tr></thead>
                <tbody>
                  {POINTS_TABLE.map(([g, what, pts]) => (
                    <tr key={g}><td>{g}</td><td>{what}</td><td className="p">{pts}</td></tr>
                  ))}
                </tbody>
              </table>
              <div className="oly-crown">
                🏆 Highest total at the 8:15 toast is crowned <b>Golden Cup Champion</b>. Ties settled by sudden-death flip cup.
              </div>
            </div>

            <div className="oly-panel oly-reveal">
              <h3>House Rules</h3>
              {HOUSE_RULES.map(([k, body]) => (
                <div className="oly-rule" key={k}><span className="oly-k">{k}</span><span>{body}</span></div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* leaderboard */}
      <section className="oly-section">
        <div className="oly-wrap">
          <div className="oly-sechead oly-reveal">
            <div>
              <div className="oly-idx">04 — LIVE</div>
              <h2>The Leaderboard</h2>
            </div>
            <p>Add everyone, tap points as they’re won. Leader gets the crown. Resets on refresh — screenshot the final standings.</p>
          </div>
          <Leaderboard />
        </div>
      </section>

      {/* safety */}
      <section className="oly-section">
        <div className="oly-wrap">
          <div className="oly-safety oly-reveal">
            <h3>Keep It a Good Day</h3>
            <ul>
              {SAFETY.map((li, i) => <li key={i}>{li}</li>)}
            </ul>
          </div>
        </div>
      </section>

      {/* footer */}
      <footer className="oly-footer">
        <div className="oly-wrap oly-reveal">
          <div className="oly-toast">Cups up. Let the games begin.</div>
          <small>BEER OLYMPICS · DOORS 2:00 · BBQ 5:00 · TOAST 8:15</small>
        </div>
      </footer>
    </div>
  );
}
