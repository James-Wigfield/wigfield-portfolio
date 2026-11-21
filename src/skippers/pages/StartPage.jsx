import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../kit/kit';
import { pg } from '../kit/pg';
import { useStored } from '../kit/storage';
import { useClock } from '../kit/hooks';
import { isOn } from '../art/geometry';
import { abcCourse, levelById, hrefFor, STUDY_LEVELS } from '../content/levels';

/* /skippers — start here: the hero, how the test works, the one-day plan
   (a ruled timeline with ticks, saved as sk:plan) and what to bring. */

const PLAN = [
  { at: '09:00', min: 10, lv: 'start', t: 'How the test works', s: 'Read this page. Two minutes.' },
  { at: '09:10', min: 45, lv: 'lights', t: 'Lights at night', s: 'Arcs → “what is it?” challenge → check-in. Lots of easy marks here.' },
  { at: '09:55', min: 35, lv: 'giveway', t: 'Who gives way + horn signals', s: 'Four encounters, the 1-2-3-5 blasts, check-in.' },
  { at: '10:30', min: 15, brk: true, t: 'Break — water, stretch' },
  { at: '10:45', min: 45, lv: 'marks', t: 'Reading the marks', s: 'Red left going in; cardinals by the clock.' },
  { at: '11:30', min: 40, lv: 'gear', t: 'Safety gear by distance', s: '400 m and 4 NM. Lifejacket levels, flares, EPIRB, radio.' },
  { at: '12:10', min: 45, brk: true, t: 'Lunch' },
  { at: '12:55', min: 45, lv: 'rules', t: 'The ticket and the rules', s: 'Ages, the 8-knot map, skiing, diving, PWC numbers.' },
  { at: '13:40', min: 35, lv: 'ops', t: 'Safe operations', s: 'Flotation, anchoring scope, stability, weather, chart datum.' },
  { at: '14:15', min: 25, lv: 'sos', t: 'Emergencies', s: 'Mayday / Pan Pan / Sécurité, capsize, fire, cold.' },
  { at: '14:40', min: 15, brk: true, t: 'Break' },
  { at: '14:55', min: 20, lv: 'care', t: 'Boat care, fuel and fire', s: 'When each job happens. Quick one.' },
  { at: '15:15', min: 30, lv: 'practical', t: 'The practical: say it out loud', s: 'Rehearse the briefing, log-on and the 11 tasks.' },
  { at: '15:45', min: 30, exam: 'mock', t: 'Mock exam #1 (40 questions)', s: 'No feedback until the end. Then read every miss.' },
  { at: '16:15', min: 20, exam: 'deck', t: 'Weak-spots deck', s: 'Your misses come back until they stick.' },
  { at: '16:35', min: 60, exam: 'mock', t: 'Mocks until 3 in a row are 36 / 40 or better', s: 'ABC: if you can do the last quiz repeatedly at 90 %+, you should pass.' },
  { at: 'Night', min: 20, cram: true, t: 'Night-before sheet', s: 'Print it or read it once in bed. Then sleep.' },
];

function Hero() {
  const t = useClock(true, 1200);
  const lamp = isOn('Q(6)+LFl 15s', t);
  const lamp2 = isOn('Fl G 4s', t + 900);
  const lamp3 = isOn('Fl R 4s', t + 2300);
  return (
    <section className="sk-hero">
      <div className="sk-hero__art" aria-hidden="true">
        <svg viewBox="0 0 1200 520" preserveAspectRatio="xMidYMid slice">
          <defs>
            <radialGradient id="skh-glow" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#fff6d6" stopOpacity="0.9" /><stop offset="100%" stopColor="#fff6d6" stopOpacity="0" /></radialGradient>
          </defs>
          {Array.from({ length: 11 }, (_, i) => (
            <path key={i} d={`M-50 ${190 + i * 34} C 250 ${150 + i * 36}, 520 ${250 + i * 30}, 800 ${200 + i * 33} S 1150 ${170 + i * 35}, 1260 ${210 + i * 32}`} fill="none" stroke="#7fb2ee" strokeOpacity={0.05 + i * 0.012} />
          ))}
          {/* a lighthouse sector on the far point */}
          <path d="M1130 160 L780 90 L790 230 Z" fill="url(#skh-glow)" opacity="0.07" />
          <circle cx="1130" cy="160" r="3" fill="#fff6d6" />
          {/* channel marks blinking */}
          <g style={{ color: '#ff4b4b' }}><circle cx="860" cy="300" r={lamp3 ? 9 : 3} fill="#ff4b4b" opacity={lamp3 ? 0.95 : 0.25} className={lamp3 ? 'sk-glow' : ''} /></g>
          <g style={{ color: '#33e08a' }}><circle cx="980" cy="270" r={lamp2 ? 9 : 3} fill="#33e08a" opacity={lamp2 ? 0.95 : 0.25} className={lamp2 ? 'sk-glow' : ''} /></g>
          <g style={{ color: '#fff6d6' }}><circle cx="700" cy="230" r={lamp ? 7 : 2.5} fill="#fff6d6" opacity={lamp ? 1 : 0.25} className={lamp ? 'sk-glow' : ''} /></g>
          {/* a boat crossing: red, green and white = coming right at you */}
          <g className="sk-hero__boat">
            <g style={{ color: '#fff6d6' }}><circle cx="0" cy="-26" r="4.5" fill="#fff6d6" className="sk-glow" /></g>
            <g style={{ color: '#ff4b4b' }}><circle cx="-11" cy="-6" r="4" fill="#ff4b4b" className="sk-glow" /></g>
            <path d="M-30 4 H30 L24 12 H-24 Z" fill="#0f2235" />
          </g>
        </svg>
      </div>
      <div className="sk-hero__body">
        <span className="sk-hero__kicker">WA Recreational Skipper’s Ticket · theory + practical</span>
        <h1>Pass your skipper’s ticket in <em>one day</em>.</h1>
        <p className="sk-hero__sub">40 questions, 34 to pass. Learn each rule as a picture, check yourself after every level, then drill mock exams until you score 36 or better three times running.</p>
        <div className="sk-hero__cta">
          <Link className="sk-btn sk-btn--primary" to={hrefFor(levelById('lights'))}>Start the plan <Icon name="arrow" size={15} /></Link>
          <Link className="sk-btn" to="/skippers/exam/mock">Try a mock exam</Link>
        </div>
      </div>
    </section>
  );
}

export default function StartPage() {
  const [ticks, setTicks] = useStored('plan', {});
  const [progress] = useStored('progress', {});
  const toggle = (k) => setTicks({ ...ticks, [k]: !ticks[k] });
  const done = PLAN.filter((p, i) => ticks[i]).length;
  const [view, setView] = useState('plan');
  const VIEWS = [['plan', 'The one-day plan'], ['test', 'How the test works'], ['progress', 'Your levels']];
  return (
    <div>
      <Hero />
      <nav className="sk-steps" aria-label="Start here">
        {VIEWS.map(([k, label], i) => (
          <button key={k} type="button" className={`sk-step${view === k ? ' sk-step--on' : ''}`} onClick={() => setView(k)} aria-current={view === k ? 'step' : undefined}>
            <span className="sk-step__n">{String(i + 1).padStart(2, '0')}</span>{label}
          </button>
        ))}
      </nav>
      {view === 'test' && (<>

      <div className="sk-figs" style={{ marginTop: 0 }}>
        <div className="sk-fig"><div className="sk-fig__big">40</div><p className="sk-fig__t">multiple-choice questions, closed book ({pg(6)})</p></div>
        <div className="sk-fig"><div className="sk-fig__big">34</div><p className="sk-fig__t">correct to pass and go on to the practical</p></div>
        <div className="sk-fig"><div className="sk-fig__big">30–33</div><p className="sk-fig__t">one more go the same day, on a different set of questions</p></div>
        <div className="sk-fig"><div className="sk-fig__big">&lt; 30</div><p className="sk-fig__t">come back another day (max two attempts a day)</p></div>
        <div className="sk-fig"><div className="sk-fig__big">11</div><p className="sk-fig__t">on-water tasks; 56 of 62 criteria to pass ({pg(91)})</p></div>
      </div>
      </>)}

      {view === 'plan' && (
      <section>
        <div className="sk-sec__head">
          <h2>The one-day plan</h2>
          <span className="sk-micro">{String(done).padStart(2, '0')} / {String(PLAN.length).padStart(2, '0')} done · about 7 h with breaks</span>
        </div>
        <div className="sk-plan">
          {PLAN.map((p, i) => {
            const lv = p.lv ? levelById(p.lv) : null;
            const passed = lv && (progress[lv.id]?.check ?? 0) >= 4;
            let href = null;
            if (lv && lv.id !== 'start') href = hrefFor(lv);
            if (p.exam) href = `/skippers/exam/${p.exam}`;
            if (p.cram) href = '/skippers/night-before';
            return (
              <div key={p.t} className={`sk-plan__row${p.brk ? ' sk-plan__row--break' : ''}${ticks[i] ? ' sk-plan__row--done' : ''}`}>
                <span className="sk-plan__time">{p.at}<small>{p.min} min</small></span>
                <button type="button" className="sk-plan__tick" aria-pressed={!!ticks[i]} aria-label={`Done: ${p.t}`} onClick={() => toggle(i)}>
                  {ticks[i] && <Icon name="check" size={11} stroke={3} />}
                </button>
                <span className="sk-plan__what">
                  <b>{p.t}</b>
                  {p.s && <span>{p.s}</span>}
                </span>
                {href ? (
                  <Link className="sk-plan__go" to={href}>{passed ? <span className="sk-dot sk-dot--ok">passed</span> : 'go →'}</Link>
                ) : <span />}
              </div>
            );
          })}
        </div>
      </section>
      )}

      {view === 'test' && (
      <section className="sk-sec">
        <div>
          <div className="sk-sec__head"><h2>On the day</h2></div>
          <div className="sk-list">
            <div className="sk-list__row"><span className="sk-list__n">01</span><span><b>Photo ID:</b> an Australian driver’s licence or learner’s permit. It also counts as your eyesight proof.<small>No licence? Passport or other ID ({pg(8)}) <b>and</b> an eyesight declaration done by an optometrist, doctor or nurse before the day.</small></span></div>
            <div className="sk-list__row"><span className="sk-list__n">02</span><span><b>Under 18:</b> a letter of consent signed by a parent or guardian (by hand — no digital signature).</span></div>
            <div className="sk-list__row"><span className="sk-list__n">03</span><span><b>Water bottle, hat, closed shoes.</b> Sunscreen and a spray jacket are smart too.</span></div>
            <div className="sk-list__row"><span className="sk-list__n">04</span><span><b>The DoT recording fee</b> — about $37 (DoT lists $34.15–$36.90), paid at the end once you pass. Check the amount on the day.</span></div>
            <div className="sk-list__row"><span className="sk-list__n">05</span><span><b>You leave with an interim certificate</b> and can skipper straight away; the card comes by post.</span></div>
          </div>
        </div>
      </section>
      )}

      {view === 'progress' && (
      <section>
        <div>
          <div className="sk-sec__head"><h2>Levels</h2><span className="sk-micro">pass a check-in (4 / 5) to tick one</span></div>
          <div className="sk-list">
            {STUDY_LEVELS.map((l) => {
              const best = progress[l.id]?.check;
              return (
                <div key={l.id} className="sk-list__row" style={{ gridTemplateColumns: '1.8rem 1fr auto' }}>
                  <span className="sk-list__n">{String(l.n).padStart(2, '0')}</span>
                  <Link to={hrefFor(l)} style={{ color: 'var(--ink)', textDecoration: 'none' }}>{l.title}</Link>
                  {best >= 4 ? <span className="sk-dot sk-dot--ok">{best}/5</span> : best !== undefined ? <span className="sk-dot sk-dot--warn">{best}/5</span> : <span className="sk-dot">not yet</span>}
                </div>
              );
            })}
          </div>
          <p className="sk-stage__cap" style={{ marginTop: '0.9rem' }}>
            More practice: ABC’s <a href="https://boatquiz.abcboating.com/wa-quiz-1" target="_blank" rel="noreferrer">public practice quiz</a> and <a href="https://abcboating.com/other-courses/how-to-train-videos/" target="_blank" rel="noreferrer">training videos</a>; DoT’s <a href="https://www.transport.wa.gov.au/imarine/rst-practice-quizzes.asp" target="_blank" rel="noreferrer">practice quizzes</a>. Older quizzes may use pre-2026 safety-gear distances — the 2026 workbook wins.
          </p>
          {abcCourse.length > 0 && (
            <div className="sk-list" style={{ marginTop: '0.8rem' }}>
              {abcCourse.map((m) => <div key={m.title} className="sk-list__row"><span className="sk-list__n">ABC</span><span>{m.title}</span></div>)}
            </div>
          )}
        </div>
      </section>
      )}
    </div>
  );
}
