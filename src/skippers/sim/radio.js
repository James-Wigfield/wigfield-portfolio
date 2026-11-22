/* Log on (Task 5, p.97–98) and log off (Task 11, p.112) — fields, validators
   and a pure checker. No React; runs in Node.

   Workbook rules this encodes:
   - Times: "as a time, in hours and minutes for example, 0715 or 7.15 am"
     (p.97) and "1430 or 02:30 pm" (p.98). So BOTH 24-hour and 12-hour-with-
     am/pm pass. "departing in 15 minutes", "shortly", "returning in a couple of
     hours" fail (p.97–98).
     Game decisions: a bare H:MM / HH:MM / HHMM is read as 24-hour; a 12-hour
     time needs am/pm; "8 am" (no minutes) passes; three digits ("815") fails;
     "noon"/"midday" fail (say 1200). If both times parse, the ETA must be
     after departure — so "2:30" meant as 2.30 pm gets caught (it reads 0230).
   - Fuel: "in reasonably accurate terms using litres"; "plenty" / "enough"
     fail (p.98). Game: a number + litres/L; other units fail; if the game
     knows the fuel on board (ctx.fuelLitres, seen at T4.3) the figure must be
     within TH.fuelTolerance of it.
   - People: total, or adults + children (p.98) — the numbers are summed.
   - Vessel: name, rego or call sign; may be invented (p.97).
   - Assessed on the information, not the radio procedure (p.98).
   Station name "Marine Rescue" as in the workbook's example (p.98, p.112). */

import { TH } from './thresholds.js';

export const STATION = 'Marine Rescue';

export const LOGON_FIELDS = [
  { key: 'vessel', id: 'T5.1', label: 'Vessel name, rego or call sign', page: 97, placeholder: 'e.g. XY456', kind: 'vessel' },
  { key: 'departTime', id: 'T5.2', label: 'Departure time', page: 97, placeholder: 'e.g. 0815 or 8.15 am', kind: 'time' },
  { key: 'departFrom', id: 'T5.3', label: 'Departure location', page: 97, placeholder: 'e.g. Palm Beach boat ramp, Rockingham', kind: 'place' },
  { key: 'destination', id: 'T5.4', label: 'Destination', page: 97, placeholder: 'e.g. Mangles Bay', kind: 'place' },
  { key: 'intentions', id: 'T5.5', label: 'Trip intentions', page: 98, placeholder: 'e.g. RST practical, then cruising', kind: 'activity' },
  { key: 'pob', id: 'T5.6', label: 'Number of people on board', page: 98, placeholder: 'e.g. 3', kind: 'count' },
  { key: 'fuel', id: 'T5.7', label: 'Fuel carried, in litres', page: 98, placeholder: 'e.g. 60 litres', kind: 'litres' },
  { key: 'eta', id: 'T5.8', label: 'Estimated time of return', page: 98, placeholder: 'e.g. 1030 or 10.30 am', kind: 'time' },
];

export const LOGOFF_FIELDS = [
  { key: 'vessel', id: 'T11.1', label: 'Vessel name, rego or call sign', page: 112, placeholder: 'same as your log-on', kind: 'vessel' },
  { key: 'status', id: 'T11.2', label: 'Safe return', page: 112, placeholder: 'e.g. returned safely, logging off', kind: 'status' },
];

/* Words/phrases that make a field fail. Workbook examples: "in 15 minutes",
   "shortly" (p.97), "plenty", "enough" (p.98), "in a couple of hours" (p.98).
   The rest are the game's extensions of the same idea. */
export const VAGUE = [
  'soon', 'shortly', 'later', 'in a bit', 'a bit', 'a while', 'awhile', 'whenever', 'asap', 'now', 'right now', 'today',
  'this morning', 'this arvo', 'this afternoon', 'tonight', 'lunchtime', 'lunch', 'midday', 'noon', 'sunset', 'dark',
  'a couple of hours', 'couple of hours', 'couple hours', 'few hours', 'an hour', 'in an hour', 'back soon', 'not long',
  'plenty', 'enough', 'heaps', 'lots', 'loads', 'full tank', 'full', 'half a tank', 'half tank', 'some', 'a few', 'a couple',
  'not sure', 'dunno', 'unsure', 'tbc', 'tba', 'around', 'somewhere', 'wherever', 'about', 'stuff', 'things', 'here',
];
const RELATIVE = /\b(in|for|after)\s+(\d+|a|an|one|two|three|few|couple)\b.*\b(min|mins|minutes?|hrs?|hours?)\b/i;

const norm = (s) => String(s ?? '').toLowerCase().replace(/[’']/g, '').replace(/\s+/g, ' ').trim();
const hasPhrase = (text, p) => new RegExp(`(^|[^a-z])${p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z]|$)`).test(text);
export const vagueIn = (s) => VAGUE.filter((p) => hasPhrase(norm(s), p));

/* ── parsers ───────────────────────────────────────────────────────────── */

/** "0815", "08:15", "14.30", "8:15", "7.15 am", "8:15am", "2:30 p.m.", "8 am" → minutes after midnight, else null. */
export function parseTime(raw) {
  const s = norm(raw).replace(/\s*hrs?$|\s*hours$/, '').replace(/a\.m\.?/, 'am').replace(/p\.m\.?/, 'pm');
  let m = s.match(/^(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)$/);
  if (m) {
    const h = +m[1]; const min = m[2] ? +m[2] : 0;
    if (h < 1 || h > 12 || min > 59) return null;
    return ((h % 12) + (m[3] === 'pm' ? 12 : 0)) * 60 + min;
  }
  m = s.match(/^(\d{4})$/) || s.match(/^(\d{1,2})[:.](\d{2})$/);
  if (!m) return null;
  const [h, min] = m.length === 2 ? [+m[1].slice(0, 2), +m[1].slice(2)] : [+m[1], +m[2]];
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}
export const fmtHHMM = (mins) => `${String(Math.floor(mins / 60)).padStart(2, '0')}${String(mins % 60).padStart(2, '0')}`;

const WORDS = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90, hundred: 100 };

/** "3", "three", "2 adults and 1 child", "two adults, a child" → 3; else null. */
export function parseCount(raw) {
  const s = norm(raw);
  if (!s || vagueIn(s).length) return null;
  const nums = [...s.matchAll(/\b(\d+|a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b/g)]
    .filter((m) => !/^(a|an)$/.test(m[1]) || /^\s*(adult|child|kid|person|passenger|crew|skipper)/.test(s.slice(m.index + m[1].length)));
  if (!nums.length) return null;
  const n = nums.reduce((t, m) => t + (/^\d+$/.test(m[1]) ? +m[1] : WORDS[m[1]]), 0);
  return n >= 1 && n <= 30 ? n : null;
}

/** "60 litres", "60L", "60 ltr", "sixty litres", "120 l" → litres; null if no litres figure. */
export function parseLitres(raw) {
  const s = norm(raw);
  const m = s.match(/(\d+(?:\.\d+)?)\s*(l|lt|ltr|ltrs|litres?|liters?)\b/);
  if (m) return +m[1];
  const w = s.match(/\b((?:twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|one hundred|a hundred|hundred)(?:[ -](?:and )?(?:one|two|three|four|five|six|seven|eight|nine|twenty|thirty|forty|fifty))?)\s*(litres?|liters?)\b/);
  if (!w) return null;
  return w[1].split(/[ -]/).filter((x) => x !== 'and').reduce((t, x) => (x === 'hundred' ? (t || 1) * 100 : t + (WORDS[x] ?? 0)), 0) || null;
}

const GENERIC_PLACE = new Set(['the', 'a', 'boat', 'ramp', 'boat ramp', 'jetty', 'marina', 'harbour', 'launch', 'from', 'at', 'to', 'out', 'in', 'on', 'my', 'our', 'water', 'sea', 'ocean', 'bay', 'beach', 'here', 'there', 'local', 'nearby', 'spot', 'usual', 'place', 'of', 'and', 'off']);
const placeWords = (s) => norm(s).split(/[^a-z0-9]+/).filter((w) => w && !GENERIC_PLACE.has(w) && !VAGUE.includes(w));
const BAD_VESSEL = /^(the |my |our )?(boat|vessel|us|me|we|this one|tinny|dinghy)$/;
const ACTIVITY = /\b(fish|fishing|div(e|ing)|snorkel(l?ing)?|cruis(e|ing)|crab(bing)?|squid(ding)?|ski(ing)?|wakeboard(ing)?|sightseeing|swim(ming)?|sail(ing)?|train(ing)?|practi(c|s)e|practical|assessment|test|rst|exercise|picnic|tour|crayfish(ing)?|cray(ing)?|joy ?ride)\b/;
const RETURNED = /\b(return(ed|ing)?|back|arrived|ashore|home|safe(ly)?|alongside|tied up|on the trailer|retrieved)\b/;
const NOT_BACK = /\b(not (yet )?(back|returned)|overdue|delayed|still out|running late|extend(ing)?)\b/;

/* ── checker ───────────────────────────────────────────────────────────── */

const ok = () => ({ ok: true, why: '' });
const bad = (why) => ({ ok: false, why });

function checkTime(v, what, page) {
  if (!norm(v)) return bad(`No ${what} given.`);
  if (RELATIVE.test(v)) return bad(`“${v}” is relative — give a clock time like 0815 or 8.15 am (p.${page}).`);
  const t = parseTime(v);
  if (t != null) return ok();
  const vg = vagueIn(v);
  if (vg.length) return bad(`“${vg[0]}” isn’t a time — give hours and minutes, e.g. 0815 or 8.15 am (p.${page}).`);
  if (/^\d{3}$/.test(norm(v))) return bad(`Say it as four digits (e.g. 0${norm(v)}) or add am/pm.`);
  return bad(`“${v}” isn’t a clock time — use 24-hour (1430) or 12-hour with am/pm (2.30 pm) (p.${page}).`);
}

function checkPlace(v, what) {
  if (!norm(v)) return bad(`No ${what} given.`);
  if (!placeWords(v).length) return bad(`“${v}” isn’t a recognisable place — name it (e.g. Palm Beach boat ramp, Rockingham).`);
  return ok();
}

/**
 * @param {'logon'|'logoff'} kind
 * @param {object} a   answers keyed by field key (LOGON_FIELDS / LOGOFF_FIELDS)
 * @param {object} ctx optional game facts: { pob, fuelLitres, logonVessel }
 * @returns {{[criterionId: string]: {ok: boolean, why: string}}}
 */
export function checkRadio(kind, a = {}, ctx = {}) {
  const r = {};
  const vessel = () => {
    const v = norm(a.vessel);
    if (!v || v.length < 2 || BAD_VESSEL.test(v)) return bad('Give the boat’s name, rego or call sign (you can make one up, p.97).');
    if (ctx.logonVessel && v.replace(/[^a-z0-9]/g, '') !== norm(ctx.logonVessel).replace(/[^a-z0-9]/g, '')) return bad(`Use the same name/rego you logged on with (${ctx.logonVessel}).`);
    return ok();
  };

  if (kind === 'logoff') {
    r['T11.1'] = vessel();
    const s = norm(a.status);
    r['T11.2'] = !s ? bad('Tell them you’ve returned safely (p.112).')
      : NOT_BACK.test(s) ? bad('That doesn’t say you’re back safely.')
        : RETURNED.test(s) ? ok() : bad('Say you’ve returned safely, e.g. “returned safely, logging off” (p.112).');
    return r;
  }

  r['T5.1'] = vessel();
  r['T5.2'] = checkTime(a.departTime, 'departure time', 97);
  r['T5.3'] = checkPlace(a.departFrom, 'departure location');
  r['T5.4'] = checkPlace(a.destination, 'destination');

  const it = norm(a.intentions);
  r['T5.5'] = !it ? bad('Say what you’ll be doing — fishing, diving, cruising… (p.98).')
    : ACTIVITY.test(it) || (it.length >= 4 && !vagueIn(it).length) ? ok() : bad(`“${a.intentions}” doesn’t say what you’ll be doing (p.98).`);

  const n = parseCount(a.pob);
  r['T5.6'] = n == null ? bad('Give the number of people as a number, e.g. 3 (p.98).')
    : ctx.pob != null && n !== ctx.pob ? bad(`You said ${n}, but there are ${ctx.pob} on board.`) : ok();

  const L = parseLitres(a.fuel);
  const fv = vagueIn(a.fuel);
  r['T5.7'] = L == null ? bad(fv.length ? `“${fv[0]}” won’t help a search — give the fuel in litres, e.g. 60 litres (p.98).` : 'Give the fuel in litres, e.g. 60 litres (p.98).')
    : !(L > 0 && L <= 2000) ? bad('That fuel figure isn’t believable.')
      : ctx.fuelLitres != null && Math.abs(L - ctx.fuelLitres) > TH.fuelTolerance.value * ctx.fuelLitres
        ? bad(`The tank showed about ${Math.round(ctx.fuelLitres)} L — report it reasonably accurately (p.98).`) : ok();

  r['T5.8'] = checkTime(a.eta, 'return time', 98);
  if (r['T5.2'].ok && r['T5.8'].ok && parseTime(a.eta) <= parseTime(a.departTime)) {
    r['T5.8'] = bad(`Return ${fmtHHMM(parseTime(a.eta))} is before departure ${fmtHHMM(parseTime(a.departTime))} — 24-hour (1430) or add pm.`);
  }
  return r;
}

/* The call as it would be spoken — same style as the Practical.jsx scripts. */
export function buildCall(kind, a = {}) {
  const id = a.vessel || '[vessel]';
  const head = `You: “${STATION}, ${STATION}, ${STATION} — this is ${id}, ${id}, ${id}. Over.”`;
  const ack = `Them: “${id}, this is ${STATION}. Go ahead. Over.”`;
  if (kind === 'logoff') {
    return [head, ack, `You: “${STATION}, ${id} — ${a.status || '[status]'}. Over.”`, `Them: “${id}, logged off. Thanks. Over.”`, `You: “Thank you ${STATION}, ${id}. Out.”`];
  }
  const body = `You: “${STATION}, ${id} logging on. Departing ${a.departFrom || '[place]'} at ${a.departTime || '[time]'}, heading to ${a.destination || '[destination]'} for ${a.intentions || '[intentions]'}. ${a.pob || '[number]'} people on board, ${a.fuel || '[fuel]'} of fuel, estimated time of return ${a.eta || '[time]'}. Over.”`;
  return [head, ack, body, `Them: “${id}, logged on. Over.”`, `You: “Thank you ${STATION}, ${id}. Out.”`];
}
