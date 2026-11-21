import { Icon } from '../kit/kit';

/* NIGHT-BEFORE SHEET — every number, light and mark on one A4 page.
   Print → A4 portrait, three columns (see @media print in skippers.css).
   Each row ends in its workbook page. */

const BLOCKS = [
  { h: 'The test', rows: [['40 / 34', 'questions / correct to pass (p.6)'], ['30–33', 'second go same day, new questions'], ['< 30', 'another day · max 2 attempts/day'], ['56 / 62', 'practical criteria to pass (p.91)'], ['6/12', 'eyesight, at least one eye (p.7)']] },
  { h: 'Who & ages (p.5, 20)', rows: [['> 6 hp', 'needs an RST (4.5 kW)'], ['10+', '≤ 6 hp boat; or drive > 6 hp supervised'], ['14+', 'hold an RST; ski observer'], ['< 16', 'daylight only, ≤ 8 kn'], ['17+', 'tow a skier; towing operations'], ['18+', 'supervise a non-RST driver']] },
  { h: '8 knots max (p.12)', rows: [['15 m', 'of a vessel underway'], ['50 m', 'moored boat · person in water · jetty · bank'], ['< 3 m', 'deep water; mooring areas; bridge arches'], ['50 m', 'clear of a dive flag (p.17)'], ['30 / 50 m', 'PWC freestyle: PWC / vessel or person (p.24)']] },
  { h: 'Skiing (p.20–21)', rows: [['3 people', 'driver 17+, observer 14+, skier'], ['50 m', 'behind a skier; from shore'], ['30 m', 'shore / landing areas while towing'], ['60 m', 'past drop-off before pulling rope in'], ['100 m', 'trick skiing from landing areas']] },
  { h: 'Admin (p.11–16)', rows: [['72 h', 'report serious incident'], ['21 days', 'RST name/address change'], ['7 / 15 d', 'seller / buyer notify'], ['0.05', 'BAC limit'], ['Port side', 'rego label, beside number'], ['150 mm', 'motor boat numbers (PWC 100)']] },
  { h: 'Give way (p.27–29)', rows: [['Right', 'boat on your starboard has right of way'], ['Head-on', 'both turn starboard'], ['Overtaking', 'overtaker keeps clear — beats all'], ['Sail', 'power gives way to sail'], ['Steady', 'bearing not changing = collision risk']] },
  { h: 'Horn (p.27)', rows: [['1 short', 'altering to starboard'], ['2 short', 'altering to port'], ['3 short', 'engines astern'], ['5 short', 'unsure of your intentions']] },
  { h: 'Lights (p.31–34)', rows: [['225°', 'masthead, white'], ['112.5°', 'each sidelight: red port, green stbd'], ['135°', 'stern, white'], ['< 12 m', 'sidelights + all-round white'], ['< 7 m & 7 kn', 'all-round white'], ['Sail', 'sidelights + stern, no masthead'], ['Anchor', 'one all-round white (< 50 m)'], ['Divers', 'red-white-red all-round (p.17)']] },
  { h: 'Marks (p.37–39)', rows: [['Going in', 'red (port) marks on your port'], ['Going out', 'red marks on your starboard'], ['N', 'cones up · Q / VQ continuous'], ['E', 'cones apart · 3 flashes'], ['S', 'cones down · 6 + long flash'], ['W', 'cones point in · 9 flashes'], ['Isolated', 'black/red, 2 balls, Fl(2)'], ['Safe water', 'red/white, red ball, Iso/Oc/LFl'], ['Special', 'yellow ✕, yellow light']] },
  { h: 'Gear (p.49–60)', rows: [['400 m', 'beyond = unprotected: EPIRB/PLB + flares'], ['< 4.8 m', 'lifejackets worn beyond 400 m'], ['1–12 yrs', 'kids wear beyond 400 m'], ['4 NM', 'VHF/HF radio required'], ['2 + 2', 'red + orange flares, or EVDS + GPS beacon'], ['L100+', 'registrable boats · 50S PWC (worn)'], ['Argyle', 'Lake Argyle & Cambridge Gulf = unprotected']] },
  { h: 'Radio (p.60–63)', rows: [['VHF 16', 'distress & calling (67 backup)'], ['27 MHz 88', 'distress & calling (86 backup)'], ['HF 4125', 'distress'], ['Mayday', 'grave & imminent danger'], ['Pan Pan', 'urgent: MOB, medical, breakdown'], ['Sécurité', 'navigation / weather warning'], ['3 Ps', 'position · problem · people']] },
  { h: 'Flares & beacons (p.54–58)', rows: [['Orange', 'day only, 60 s, aircraft'], ['Red', 'day & night, 45 s, 10–12 km night'], ['EPIRB', '406 MHz GPS, 48 h, floats, AMSA'], ['PLB', '24 h, worn'], ['Oops', 'off + AMSA 1800 641 792']] },
  { h: 'Ops & weather (p.68–80)', rows: [['+50 %', 'fuel: ¼ out ¼ back ½ reserve'], ['5:1', 'min scope · 7 fair · 9 moderate'], ['3 m', 'min chain · Danforth for sand'], ['> 25 kn', 'strong wind (to 33) · gale 34 · storm 48'], ['Low', 'clockwise (southern hemisphere)'], ['Datum', 'depth = chart + tide height'], ['High G', 'tender (slow roll) · low G stiff']] },
  { h: 'Care & fire (p.43–46, 65–66, 86–87)', rows: [['1 yr', 'motor service, impeller, LP gas'], ['3 mo', 'gearbox oil if worked hard; old premix'], ['6 mo', 'check extinguishers'], ['Vapour', 'heavier than air — sniff low'], ['Powder', 'dry powder all-rounder, aim at base'], ['Battery', 'ventilated box; charger off first']] },
  { h: 'Emergencies (p.84–88)', rows: [['Capsize', 'stay with the boat'], ['Breakdown', 'anchor, bow to sea, call rescue'], ['Cold', 'HELP / huddle · warm the core'], ['Arms', 'raise & lower slowly = distress'], ['N over C', 'flags = distress']] },
];

export default function CramSheet() {
  return (
    <article>
      <header className="sk-lhead">
        <span className="sk-lhead__n">11</span>
        <h1 className="sk-lhead__title">Night-before sheet</h1>
        <div className="sk-lhead__meta">
          <span className="sk-receipt">every number on one A4 · DoT RST Workbook, 8th ed. (July 2026)</span>
          <button type="button" className="sk-btn sk-btn--small sk-noprint" onClick={() => window.print()}><Icon name="print" size={13} /> Print / save as PDF</button>
        </div>
      </header>
      <p className="sk-hook">Read it once, sleep, and trust the pictures.</p>
      <div className="sk-cram" style={{ marginTop: '1.2rem' }}>
        {BLOCKS.map((b) => (
          <section key={b.h} className="sk-cram__blk">
            <h3>{b.h}</h3>
            {b.rows.map(([k, v]) => (
              <div key={k + v} className="sk-cram__row"><b>{k}</b><span>{v}</span></div>
            ))}
          </section>
        ))}
      </div>
    </article>
  );
}
