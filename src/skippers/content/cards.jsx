import { Mark, FlagA, TopBoat, NightView } from '../art/parts';

/* Rule cards per level: a small picture, the rule in one or two short
   sentences, a workbook page, and an optional "more" unfold. Pictures are
   drawn in a 64 × 64 box. */

const box = (children, vb = '0 0 64 64') => <svg viewBox={vb} width="64" height="64">{children}</svg>;
const big = (txt, col = 'var(--ink)') => box(<text x="32" y="40" textAnchor="middle" style={{ fontFamily: 'var(--f-mono)', fontSize: txt.length > 3 ? 15 : 22, fill: col, fontWeight: 600 }}>{txt}</text>);
const night = (vessel, theta) => box(<><rect width="64" height="64" rx="8" fill="#08131e" /><NightView vessel={vessel} theta={theta} w={64} h={64} hull={false} scale={0.55} /></>);

export const CARDS = {
  rules: [
    { title: 'Registration', text: 'Anything that is or can be motor-powered (even electric, even a yacht with an outboard) is registered. Label on the **port side** next to the number.', page: 16, art: big('AB1'), more: ['Motor boat numbers: midships both sides, **150 mm high**, not under the bow flare', 'PWC: **100 mm** high, both sides', 'Yacht / tender: **50 mm**, near the transom', 'Exempt: yachts, canoes, surf skis without motors, and tenders (≤ 3.1 m, ≤ 5 hp, used only from the parent boat)', 'Interstate boats: 3 months’ grace (NT: 30 days)'] },
    { title: 'Diver below: Flag A', text: 'White and blue swallow-tail = divers down. Keep **50 m clear**, or crawl past at a safe speed with a lookout.', page: 17, art: box(<FlagA x={8} y={6} scale={0.65} />), more: ['Flag at least **750 × 600 mm** on a boat; **300 × 200 mm** on a buoy', 'At night: **red-white-red** all-round lights in a vertical line', 'Diver with no boat at night: a yellow or orange flashing light visible **200 m**'] },
    { title: 'Water skiing', text: 'Driver **17+**, observer **14+**, so at least three people. Gazetted ski areas only, in the signed direction and times.', page: 20, art: big('17'), more: ['No closer than **50 m** behind a skier or any vessel', 'Stay **50 m** from shore except in take-off / landing areas', 'Not within **30 m** of shore or a landing area while towing (except landing/taking off)', 'Boat taking off a skier gives way to one coming in to land', 'Drop a skier, then go on at least **60 m** before stopping to pull the rope in', 'Trick skiing: not within **100 m** of a landing or take-off area', 'Ski boats have **no priority** over other traffic', 'Observer’s skier-down signal: one arm straight up. Skier OK: both arms up'] },
    { title: 'PWCs (jet skis)', text: 'A PWC is a motor boat: RST, rego, safety gear. Lifejacket (Level 50S+) **worn**. No freestyling near others.', page: 23, art: big('50S'), more: ['Freestyle / wake jumping banned: in speed-restricted areas, within **30 m** of another PWC, within **50 m** of another vessel or a person', 'Beyond 400 m: GPS EPIRB/PLB and flares/EVDS too', 'Banned on the Swan above Windan Bridge, the Canning above Salter Point and in Swan River marine parks'] },
    { title: 'Right of way at jetties', text: 'Coming from opposite directions: the boat heading **downriver gives way** to the one heading upriver. Same direction: the **outer** boat gives way to the inner.', page: 13, art: big('↑↓'), more: ['Leaving together: the first boat under way goes first; others wait until it’s well clear'] },
    { title: 'Accidents and helping', text: 'Report serious injury, death or an unseaworthy boat to DoT within **72 h**. You must help people in distress unless it’s too dangerous, too far, or rescue has it.', page: 12, art: big('72h'), more: ['Marine oil spill? Report it: **(08) 9480 9924**, 24 hours', 'Mandatory alcohol and drug testing after serious incidents (p.13)'] },
    { title: 'Pollution', text: 'Never dump oil, noxious stuff or plastic (incl. fishing line). Floating rubbish: not within **25 NM**. Other garbage: not within **12 NM** (3 NM if ground).', page: 15, art: big('25'), more: ['Fines up to $200,000 for individuals', 'Refuelling is when most spills happen: don’t overfill, stay with the nozzle'] },
    { title: 'Keep it in the hull', text: 'Once underway, everyone keeps **all body parts inside the hull**. Don’t tie up to a beacon or navigation mark.', page: [12, 13], art: box(<TopBoat x={32} y={32} scale={0.6} />) },
  ],
  collision: [
    { title: 'Lookout', text: 'The most important rule: look out with eyes, ears and **all available means** (radar, sounder, plotter), all the time.', page: 27, art: big('👁', 'var(--ink)') },
    { title: 'Safe speed', text: 'A speed that leaves time to manoeuvre. Think visibility, traffic, background lights and depth.', page: 27, art: big('kn') },
    { title: 'Steady bearing = danger', text: 'If the other boat’s bearing doesn’t move ahead or drop back, you’re on (or nearly on) a **collision course**. Act early and obviously.', page: 27, art: box(<><line x1="10" y1="54" x2="54" y2="10" stroke="var(--warn)" strokeDasharray="4 3" strokeWidth="2" /><TopBoat x={12} y={50} scale={0.3} /><TopBoat x={52} y={14} heading={270} scale={0.3} /></>) },
    { title: 'Restricted visibility', text: 'Fog or heavy rain: lookout, **navigation lights on**, safe speed, ready to stop.', page: 27, art: big('fog') },
    { title: 'Power gives way to sail', text: 'Motor boats keep clear of sailing boats and of vessels hampered by work like dredging or cable laying.', page: 29, art: box(<TopBoat x={32} y={34} type="sail" scale={0.7} />) },
    { title: 'Narrow channels', text: 'Keep to the **starboard** side as far as you can; pass oncoming boats **port to port**.', page: [41, 92], art: big('→|') },
  ],
  lights: [
    { title: 'Power, under 12 m', text: 'Red and green sidelights + an **all-round white** (or masthead + stern light). White at least 1 m above the sidelights.', page: 32, art: night('power-lt12', 0) },
    { title: 'Power, 12–20 m', text: 'Masthead light, sidelights (separate or combined) and a stern light.', page: 33, art: night('power-masthead', 0) },
    { title: 'Small and slow', text: 'Power under 7 m and 7 knots: an **all-round white**, plus sidelights if possible.', page: 32, art: night('power-lt7', 0) },
    { title: 'Under sail', text: 'Sidelights and a stern light — **no masthead light**. Motoring with the sails up? Show power-boat lights.', page: 33, art: night('sail', 0), more: ['Under 7 m or rowing: at least a **torch** shown in time to prevent a collision', '7–20 m: a masthead tricolour lantern, or separate sidelights + stern light', 'Optional: **red over green** all-round at the masthead (not with a tricolour)'] },
    { title: 'At anchor', text: 'Under 50 m: one **all-round white** where it’s best seen, sunset to sunrise. 50 m+: two whites, forward one higher.', page: 34, art: night('anchor', 0) },
    { title: 'Deck lights off underway', text: 'Bright white light bleaches your night vision: **30–45 min** to get 80 % back. Use red light inside; keep cabin and deck lights from dazzling.', page: 31, art: big('red', 'var(--port)') },
  ],
  care: [
    { title: 'Batteries', text: 'A flat battery is one of the commonest rescue calls. Marine battery, **secured, in a ventilated container**, clean greased terminals.', page: 43, art: big('+ −'), more: ['Turn the charger **off before** disconnecting its leads — it can prevent an explosion', 'Top up cells with distilled water (serviceable batteries)'] },
    { title: 'Fuel', text: 'Do the **sniff test** every time you board. Keep tanks topped up (less condensation). Old fuel collects water.', page: 44, art: big('⛽'), more: ['Premix older than **3 months**: don’t use it', 'Clean portable tanks at least **yearly**', 'Carry spare filters'] },
    { title: 'Gearbox and propeller', text: 'Milky oil or water from the gear case drain = **service centre**. Fishing line round the prop shaft wrecks the seals — check for it.', page: 44, art: big('⚙') },
    { title: 'Fire extinguishers', text: 'Recommended, especially with an inboard or flame appliances. **Dry powder** is the all-rounder. Aim at the **base**, sweep side to side.', page: 65, art: big('ABE'), more: ['Inspect every **6 months**: gauge in the green, seal intact', 'Shake dry powder now and then so it doesn’t compact', 'Water: never on electrical or cooking-oil fires', 'Colour band on the red body: **white = dry powder**, **black = CO₂** (not for outdoor fires), **blue = foam**, **yellow = vaporising liquid**', 'Keep it where you can grab it when a fire starts — accessible, not buried next to the engine (p.50, 86)'] },
    { title: 'Fuel vapour sinks', text: 'Petrol and LPG vapour is **heavier than air** and won’t leave a compartment by itself. LPG cylinders go above deck.', page: [86, 87], art: big('↓') },
    { title: 'Refuelling', text: 'Everything off, passengers ashore, portable tanks out, extinguisher handy, don’t overfill — and **no start until the fuel smell is gone**.', page: 87, art: big('0 °C') },
  ],
  gear: [
    { title: 'Lifejacket levels', text: '**100, 150, 275**: head support, face-up, bright — for registrable boats. **50 / 50S**: less buoyancy, for PWCs, dinghies, skiers.', page: 51, art: big('100') },
    { title: 'Protected waters', text: 'Rivers, lakes, estuaries, harbours, and within **400 m of shore** — but **not Lake Argyle or Cambridge Gulf**.', page: 49, art: big('400') },
    { title: 'EPIRB vs PLB', text: 'EPIRB: floats upright, works **48 h**, register it with AMSA. PLB: **24 h**, hold the aerial clear of the water, must be **worn** beyond 400 m.', page: 57, art: big('406'), more: ['Use only when life is in grave and imminent danger', 'Test it before you go (test switch)', 'Accidental activation: switch off, call AMSA **1800 641 792**', 'Never put an old beacon in general rubbish'] },
    { title: 'Radio channels', text: 'VHF **16** (backup 67), 27 MHz **88** (backup 86), HF 4125. Call there, then switch to a working channel; go back to 16 afterwards.', page: [60, 62], art: big('16') },
    { title: 'Radio licences', text: '27 MHz: none. **VHF and HF need an operator’s certificate** (short- or long-range).', page: 62, art: big('SROCP') },
    { title: 'Phones aren’t radios', text: 'Other boats can’t hear a phone call, phones are hard to locate, and coverage has holes. Good as a backup.', page: 62, art: big('📵') },
  ],
  ops: [
    { title: 'Know the warnings', text: '**Strong wind** over 25 up to 33 kn · **Gale** 34–47 kn · **Storm** 48 kn+. Bureau of Meteorology is the freshest forecast.', page: [77, 78], art: big('25') },
    { title: 'Pressure systems', text: 'Southern hemisphere: wind goes **clockwise round lows**, anticlockwise round highs. Close isobars = strong wind.', page: 78, art: box(<><circle cx="32" cy="32" r="22" fill="none" stroke="var(--ink-3)" /><circle cx="32" cy="32" r="12" fill="none" stroke="var(--ink-3)" /><text x="32" y="37" textAnchor="middle" style={{ fontFamily: 'var(--f-mono)', fontSize: 14, fill: 'var(--ink)' }}>L</text><path d="M54 32 l-4 -5 m4 5 l4 -5" stroke="var(--ink)" fill="none" /></>) },
    { title: 'Bad weather coming', text: 'Temperature drop, **rising swell**, solid cloud, falling barometer, **wind shift** — almost any change.', page: 79, art: big('↘'), more: ['**Cold front**: squalls and rain as it passes, showers behind, wind changes direction (p.79)', 'Wave height = **wind speed × how long it blows × fetch** (how far over open water) (p.78)'] },
    { title: 'Chart datum', text: 'Charted depths are measured from the **lowest predictable tide**. Real depth = **charted depth + tide height**.', page: 80, art: box(<><path d="M4 22 H60" stroke="var(--chart)" /><path d="M4 40 H60" stroke="var(--ink-3)" strokeDasharray="3 3" /><path d="M4 56 H60" stroke="var(--ink)" strokeWidth="2" /><text x="6" y="36" style={{ fontSize: 8, fontFamily: 'var(--f-mono)', fill: 'var(--ink-3)' }}>datum</text></>), more: ['Low pressure raises the sea level; high pressure lowers it', 'Tidal streams can run 10 knots in the Kimberley'] },
    { title: 'Loading', text: 'Within the **builder’s plate** (ABP: max engine, people, load, buoyancy). Heavy things low and spread; lash anything that can shift. Water sloshing about = **free surface effect**.', page: [74, 75], art: big('ABP') },
    { title: 'Trim for the sea', text: 'Planing boat: trim the **bow down into a head sea**, **up in a following sea** (helps stop broaching).', page: [79, 84], art: big('⟋') },
    { title: 'Anchoring don’ts', text: 'Not in channels, fairways or leads (unless in distress), not near submarine cables, not in mooring areas; avoid reef and seagrass.', page: [14, 69], art: big('⚓'), more: ['No **crab nets, cray pots or floats** in a channel, fairway or passage without DTMI permission (p.12)', 'Never tie up to a beacon or navigation aid (p.12)'] },
  ],
  sos: [
    { title: 'Capsized: stay with it', text: 'Count heads; everyone **stays with the boat** and climbs onto the hull. Don’t swim for shore unless it’s very close.', page: 84, art: big('↺') },
    { title: 'Abandoning', text: 'First a **Mayday** and the **EPIRB**. Keep clothes on — add more if there’s time. Lifejackets stay on.', page: 85, art: big('SOS') },
    { title: 'Fire', text: 'People first: alarm, head count, call for help, move them away. Close openings, **shut fuel and gas off**, then fight it. Watch it — fires restart.', page: 87, art: big('🔥') },
    { title: 'Hypothermia', text: 'Cold, drowsy, slurred, slow pulse. Out of the wind, wet clothes off, warm the **head, neck, armpits, groin**. No rubbing limbs, no alcohol, no walking about.', page: 88, art: big('HELP'), more: ['In the water: **HELP** position alone (knees up, arms tight), **Huddle** in a group'] },
    { title: 'Grounding', text: 'Look after people first (sudden stop), check for leaks and prop damage. Prevent it: plan on a chart; **slow down when unsure**.', page: 85, art: big('▁▂') },
    { title: 'Breakdown', text: 'Not a Mayday by itself. **Anchor** to hold position, bow into the sea, then call marine rescue.', page: 85, art: big('⚓') },
    { title: 'Distress signals', text: 'Mayday, flares, EPIRB, **slowly raising and lowering outstretched arms**, continuous fog horn, flags **N over C**, smoke or flames on a vessel.', page: 84, art: box(<Mark type="safe" x={32} y={60} scale={0.45} />) },
  ],
};
