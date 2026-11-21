import { useState } from 'react';
import { Rich, Icon } from '../kit/kit';
import { pg } from '../kit/pg';
import { useStored } from '../kit/storage';

/* LEVEL 09 — the practical. Task names follow ABC's list of 11 on-water
   tasks; the steps are the DoT criteria (Workbook ch.10, p.91–112) in our
   own words. Tick steps off as you rehearse them (saved in this browser). */

const VIDEOS = 'https://abcboating.com/other-courses/how-to-train-videos/';

const TASKS = [
  {
    t: 'Situational awareness and general seamanship', p: 92,
    look: 'Assessed the whole time. Unsafe skippering at any point is an instant fail.',
    steps: ['Keep a lookout and apply the collision rules', 'Keep to the starboard side of channels; pass oncoming boats port to port', 'Stay inside speed limits — 8 knots within 50 m of the MOB float too', 'Watch depth, sea state, your wash and wildlife', 'Seat passengers for safety and trim; hands off the gunwale when berthing', 'Check the boat is registered with a current sticker'],
  },
  {
    t: 'Securing the boat to a pontoon', p: 93,
    look: 'Point at what you check, out loud. A single bow line can be enough.',
    steps: ['Check the mooring lines for wear and damage', 'Check the cleats / bollards / rails you’ll use are sound', 'Secure the boat with the lines and cleats'],
  },
  {
    t: 'Safety briefing to your passengers', p: 94,
    look: 'Show every required item for the area, say where it is and who wears what — then check they understood.',
    steps: ['Name each piece of required safety gear', 'Show where it is stowed, and the wearing rules for this area', 'Ask: “Does everyone understand? Any questions?”'],
  },
  {
    t: 'Pre-start checks and starting the motor', p: 95,
    look: 'Steps 1–8 before you turn the key. Only do the ones that apply to the boat.',
    steps: ['Sniff for fuel fumes (inboards)', 'Fuel line connected, fuel cock open', 'Enough fuel in the tank', 'Coolant level (if fitted)', 'Cooling-water intakes clear (look at the leg)', 'Kill-switch lanyard fitted', 'Gear lever in neutral', 'Look around — nobody near the propeller', 'Start the motor (and check the telltale)'],
  },
  {
    t: 'Logging on', p: 97,
    look: 'All eight items, with real times (“0815”, not “soon”) and fuel in litres (“120 L”, not “plenty”).',
    steps: ['Vessel name, rego or call sign', 'Departure time', 'Departure place', 'Destination', 'What you’re doing (fishing, cruising…)', 'Number of people on board', 'Fuel on board, in litres', 'Estimated time of return'],
  },
  {
    t: 'Departing the berth', p: 99, video: 'Docking in wind',
    look: 'Low revs, smooth gear changes, little or no contact with the berth.',
    steps: ['Look all round — safe to go?', 'Allow for wind and current', 'Leave with little or no impact', 'Don’t get in other boats’ way', 'Use low, steady revs', 'Smooth, timely gear changes', 'Lines stowed so they can’t foul the propeller'],
  },
  {
    t: 'Person overboard', p: 103, video: 'Man overboard',
    look: 'Treat the float as a real person. No engine within one boat length of it.',
    steps: ['Turn hard towards the side they fell from', 'Throw (simulate) a flotation aid', 'Someone keeps watching and pointing', 'Turn well clear, come back from downwind / up-current', 'Slow to the minimum that still steers', 'Stop downwind of them, drifting up', 'Engine OFF before the pick-up', 'Get them aboard'],
  },
  {
    t: 'Steering a transit', p: 105,
    look: 'Name your two objects, then hold the line for 30 seconds.',
    steps: ['Tell the assessor the two objects that line up', 'Steer along the transit for 30 seconds', 'Drifting off? Steer towards the lower (front) mark until they line up again'],
  },
  {
    t: 'Controlled stop', p: 106,
    look: 'From about 5 knots, stopped within two boat lengths.',
    steps: ['Look behind — safe to stop?', 'Shout a warning: “Hold on — stopping!”', 'Revs down', 'Neutral (pause)', 'Reverse — a firm, positive shift', 'Controlled revs astern (too many and the prop just churns)', 'Stopped within two boat lengths'],
  },
  {
    t: 'Docking the boat', p: 107, video: 'Docking in wind',
    look: 'Slowest speed that still steers; about 30–45° to the berth; swing two to three lengths out.',
    steps: ['Look all round — safe?', 'Don’t impede other boats', 'Pick your side from the wind and current (moored boats point into it)', 'Slow approach, still steering', 'Approach angle about 30–45°', 'Smooth, timely gear changes', 'Low revs', 'Arrive with little or no impact', 'Secure the boat with a line'],
  },
  {
    t: 'Logging off', p: 112,
    look: 'Two things: who you are, and that you’re back safe.',
    steps: ['Vessel name, rego or call sign', 'Tell them you’ve returned safely'],
  },
];

export function Tasks() {
  const [ticks, setTicks] = useStored('practical', {});
  const total = TASKS.reduce((s, t) => s + t.steps.length, 0);
  const n = Object.values(ticks).filter(Boolean).length;
  const toggle = (k) => setTicks({ ...ticks, [k]: !ticks[k] });
  return (
    <section>
      <div className="sk-figs" style={{ marginTop: 0 }}>
        <div className="sk-fig"><div className="sk-fig__big">62</div><p className="sk-fig__t">criteria watched by the assessor ({pg(91)})</p></div>
        <div className="sk-fig"><div className="sk-fig__big">56</div><p className="sk-fig__t">needed to pass — six wrong or less</p></div>
        <div className="sk-fig"><div className="sk-fig__big">1</div><p className="sk-fig__t">practical attempt per day; any unsafe moment ends it</p></div>
        <div className="sk-fig"><div className="sk-fig__big">{n}<small style={{ fontSize: '0.5em', color: 'var(--ink-3)' }}>/{total}</small></div><p className="sk-fig__t">steps you’ve rehearsed (tick them)</p></div>
      </div>
      <p className="sk-stage__cap" style={{ margin: '0.8rem 0 0.4rem' }}>
        The workbook says the assessment takes about 30 minutes; ABC runs training on the boat first, then a formal assessment of about 10–15 minutes. Ask the assessor to repeat any instruction you’re unsure of.
      </p>
      <div>
        {TASKS.map((t, i) => (
          <article key={t.t} className="sk-task">
            <span className="sk-task__n">{String(i + 1).padStart(2, '0')}</span>
            <div>
              <h3 className="sk-task__t">{t.t}</h3>
              <p style={{ fontSize: '0.88rem', color: 'var(--ink-2)', marginTop: '0.2rem' }}>{t.look}</p>
              <ul className="sk-checks">
                {t.steps.map((s, j) => {
                  const k = `${i}.${j}`;
                  return (
                    <li key={k}>
                      <button type="button" aria-pressed={!!ticks[k]} aria-label={`Rehearsed: ${s}`} onClick={() => toggle(k)}>{ticks[k] && <Icon name="check" size={10} stroke={3} />}</button>
                      <span>{s}</span>
                    </li>
                  );
                })}
              </ul>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '0.4rem' }}>
                <span className="sk-receipt">{pg(t.p)}</span>
                {t.video && <a href={VIDEOS} target="_blank" rel="noreferrer" className="sk-mono" style={{ fontSize: '0.7rem', display: 'inline-flex', gap: '0.3rem', alignItems: 'center' }}><Icon name="video" size={13} /> ABC video: {t.video}</a>}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

const BRIEFING = [
  'Welcome aboard. I’m the skipper, so if anything happens, listen to me.',
  'Lifejackets: there’s one for each of you, here under this seat. Today we’re in sheltered water, so they’re carried — but if I say put them on, put them on. Here’s how it clips up.',
  'If we head out past 400 metres from shore: the EPIRB is here by the helm, and the flares are in this orange waterproof tub. Red for night, orange smoke for day.',
  'The radio is here. Channel 16 for emergencies. If I can’t, press this, say “Mayday” three times, our rego, where we are, what’s wrong and how many on board.',
  'Recommended extras: the fire extinguisher is here, the bucket and bilge pump here, the anchor up front.',
  'Keep hands and feet inside the boat, stay seated while we’re moving, and keep hands off the side when we come alongside.',
  'Does everyone understand? Any questions?',
];

export function Scripts() {
  const [which, setWhich] = useState('brief');
  const blocks = {
    brief: { t: 'Safety briefing', p: 94, lines: BRIEFING, note: 'Point at each item as you say it. Adjust to the boat and the area — show only what this boat carries, and say the wearing rule for where you’re going.' },
    logon: {
      t: 'Logging on (radio)', p: [63, 98],
      lines: ['You: “Marine Rescue, Marine Rescue, Marine Rescue — this is XY456, XY456, XY456. Over.”', 'Them: “XY456, this is Marine Rescue. Go ahead. Over.”', 'You: “Marine Rescue, XY456 logging on. Departing [ramp] at 0815, heading to [destination] to go fishing. Three people on board, 80 litres of fuel, estimated return 1230. Over.”', 'Them: “Logged on. Over.”', 'You: “Thank you Marine Rescue, XY456. Out.”'],
      note: 'All eight: name/rego · departure time · place · destination · intentions · people · fuel in litres · return time. You can invent a rego for the test (p.97).',
    },
    logoff: {
      t: 'Logging off (radio)', p: [63, 112],
      lines: ['You: “Marine Rescue, Marine Rescue, Marine Rescue — this is XY456 ×3. Over.”', 'Them: “XY456, go ahead. Over.”', 'You: “XY456 has returned safely and is logging off. Over.”', 'Them: “Thanks for logging off. Over.”', 'You: “XY456, thanks. Out.”'],
      note: 'Always log off with the same station — otherwise they may start a search.',
    },
    shouts: {
      t: 'Things to say out loud', p: [103, 106],
      lines: ['Person overboard: “MAN OVERBOARD, PORT SIDE! Keep pointing at them!” (turn hard to that side)', 'Throwing an aid: “Throwing a lifejacket now.”', 'Before the pick-up: “Engine off.”', 'Controlled stop: look behind, then “HOLD ON — STOPPING!”', 'Pre-start: “In neutral, prop area clear — starting.”', 'Transit: “I’m lining up that beacon with the tall pine behind it.”'],
      note: 'Saying the check out loud lets the assessor tick it.',
    },
  };
  const b = blocks[which];
  return (
    <section style={{ maxWidth: 760 }}>
      <div className="sk-seg" role="group" aria-label="Script" style={{ marginBottom: '1rem' }}>
        {Object.entries(blocks).map(([k, v]) => (
          <button key={k} type="button" aria-pressed={which === k} onClick={() => setWhich(k)}>{v.t}</button>
        ))}
      </div>
      <div className="sk-facts__head"><h3>{b.t}</h3><span className="sk-receipt">{pg(b.p)}</span></div>
      <div className="sk-script" style={{ borderTop: '2px solid var(--rule-strong)', paddingTop: '1rem' }}>
        {b.lines.map((l) => <p key={l}><Rich text={l} /></p>)}
      </div>
      <p className="sk-stage__cap" style={{ marginTop: '0.8rem' }}>{b.note}</p>
    </section>
  );
}
