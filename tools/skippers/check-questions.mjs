// Validates the RST question bank in src/skippers/content/questions/.
// Usage: node tools/skippers/check-questions.mjs   (exits non-zero on any failure)

import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const indexPath = path.resolve(here, '../../src/skippers/content/questions/index.js')
const { QUESTIONS, TOPICS } = await import(pathToFileURL(indexPath).href)

const COVERAGE = [
  'ticket-who', 'ticket-age', 'ticket-dinghy', 'ticket-assessment',
  'rego-which', 'rego-label', 'speed-8kn', 'pwc', 'diving', 'skiing', 'jetty-right-of-way',
  'alcohol', 'incidents', 'pollution',
  'collision-crossing', 'collision-headon', 'collision-overtaking', 'collision-sail', 'collision-lookout',
  'sound-signals',
  'lights-arcs', 'lights-types', 'lights-aspect', 'lights-night-vision',
  'buoy-lateral', 'buoy-cardinal', 'buoy-other', 'light-characters', 'leads-sectors',
  'maintenance-engine', 'maintenance-fuel', 'battery', 'maintenance-schedule',
  'protected-waters', 'pfd-levels', 'pfd-wearing', 'epirb', 'flares', 'radio', 'mayday-panpan', 'logon',
  'extinguishers', 'anchoring',
  'trip-planning', 'stability', 'flotation', 'weather', 'tides-datum',
  'emergencies-capsize', 'emergencies-fire', 'emergencies-other',
]
const MIN_TOTAL = 210
const MIN_PER_KEY = 2
const RADIO_PAGES = [60, 63] // ch.7 radio / log-on content may be cited from any topic
const PAGE_SLACK = 2

const NIGHT_VESSELS = ['power-lt12', 'power-masthead', 'power-lt7', 'sail', 'sail-tricolour', 'anchor', 'anchor-50', 'diver']
const ASPECTS = ['ahead', 'port', 'starboard', 'astern']
const MARKS = ['port', 'starboard', 'north', 'south', 'east', 'west', 'isolated', 'safe', 'special']
const FIGURE_KEYS = {
  night: ['kind', 'vessel', 'aspect'],
  mark: ['kind', 'mark', 'topmark', 'light'],
  rhythm: ['kind', 'mark'],
  encounter: ['kind', 'boats'],
  flag: ['kind', 'flag'],
  horn: ['kind', 'blasts'],
}

const errors = []
const warnings = []
const fail = (id, msg) => errors.push(`${id}: ${msg}`)

const topicById = new Map(TOPICS.map((t) => [t.id, t]))
const isNum = (v) => typeof v === 'number' && Number.isFinite(v)

// ── TOPICS sanity ─────────────────────────────────────────────────────
const weightSum = TOPICS.reduce((s, t) => s + t.examWeight, 0)
if (weightSum !== 40) errors.push(`TOPICS: examWeight sums to ${weightSum}, expected 40`)
for (const t of TOPICS) {
  if (!t.id || !t.label || !isNum(t.chapter) || !Array.isArray(t.pages) || t.pages.length !== 2) {
    errors.push(`TOPICS: malformed entry ${JSON.stringify(t)}`)
  }
}

// ── Figures ───────────────────────────────────────────────────────────
function checkFigure(id, f) {
  if (!f || typeof f !== 'object') return fail(id, 'figure is not an object')
  const allowed = FIGURE_KEYS[f.kind]
  if (!allowed) return fail(id, `unknown figure kind "${f.kind}"`)
  for (const k of Object.keys(f)) if (!allowed.includes(k)) fail(id, `figure.${k} not allowed for kind "${f.kind}"`)
  switch (f.kind) {
    case 'night':
      if (!NIGHT_VESSELS.includes(f.vessel)) fail(id, `night.vessel "${f.vessel}" invalid`)
      if (!ASPECTS.includes(f.aspect)) fail(id, `night.aspect "${f.aspect}" invalid`)
      break
    case 'mark':
      if (!MARKS.includes(f.mark)) fail(id, `mark.mark "${f.mark}" invalid`)
      if ('topmark' in f && typeof f.topmark !== 'boolean') fail(id, 'mark.topmark must be boolean')
      if ('light' in f && typeof f.light !== 'boolean') fail(id, 'mark.light must be boolean')
      break
    case 'rhythm':
      if (!MARKS.includes(f.mark)) fail(id, `rhythm.mark "${f.mark}" invalid`)
      break
    case 'encounter': {
      if (!Array.isArray(f.boats) || f.boats.length !== 2) { fail(id, 'encounter needs exactly 2 boats'); break }
      const ids = f.boats.map((b) => b.id).sort().join('')
      if (ids !== 'AB') fail(id, `encounter boat ids must be A and B (got ${ids})`)
      for (const b of f.boats) {
        for (const k of Object.keys(b)) if (!['id', 'type', 'x', 'y', 'heading'].includes(k)) fail(id, `boat.${k} not allowed`)
        if (!['power', 'sail'].includes(b.type)) fail(id, `boat ${b.id} type "${b.type}" invalid`)
        for (const k of ['x', 'y']) if (!isNum(b[k]) || b[k] < 0 || b[k] > 100) fail(id, `boat ${b.id}.${k} must be 0–100`)
        if (!isNum(b.heading) || b.heading < 0 || b.heading >= 360) fail(id, `boat ${b.id}.heading must be 0–359`)
      }
      break
    }
    case 'flag':
      if (f.flag !== 'alpha') fail(id, `flag "${f.flag}" invalid`)
      break
    case 'horn':
      if (typeof f.blasts !== 'string' || !/^[sl]+$/.test(f.blasts)) fail(id, `horn.blasts "${f.blasts}" invalid`)
      break
  }
}

// Relative bearing (deg, 0 = dead ahead, clockwise) of `other` as seen from `from`.
function relBearing(from, other) {
  const dx = other.x - from.x
  const dy = other.y - from.y
  const abs = (Math.atan2(dx, -dy) * 180) / Math.PI
  return (((abs - from.heading) % 360) + 360) % 360
}
const sector = (b) => (b <= 112.5 ? 'starboard' : b >= 247.5 ? 'port' : 'stern')

// ── Per-question checks ───────────────────────────────────────────────
const seen = new Set()
const coverCount = Object.fromEntries(COVERAGE.map((k) => [k, 0]))
const perTopic = Object.fromEntries(TOPICS.map((t) => [t.id, 0]))
const answerDist = [0, 0, 0, 0]
const figureKinds = {}
let allAbove = 0
const geometry = []

for (const q of QUESTIONS) {
  const id = q?.id ?? '(no id)'
  if (typeof q.id !== 'string' || !/^[a-z]+-\d{3}$/.test(q.id)) fail(id, 'id must look like "topic-001"')
  if (seen.has(q.id)) fail(id, 'duplicate id')
  seen.add(q.id)

  const topic = topicById.get(q.topic)
  if (!topic) fail(id, `topic "${q.topic}" not in TOPICS`)
  else {
    perTopic[q.topic]++
    if (!q.id.startsWith(`${q.topic}-`)) fail(id, `id prefix does not match topic "${q.topic}"`)
  }

  const pages = Array.isArray(q.page) ? q.page : [q.page]
  if (!pages.length || !pages.every(isNum)) fail(id, 'page must be a number or array of numbers')
  else if (topic) {
    const [lo, hi] = topic.pages
    for (const p of pages) {
      const inRange = p >= lo - PAGE_SLACK && p <= hi + PAGE_SLACK
      const radio = p >= RADIO_PAGES[0] && p <= RADIO_PAGES[1]
      if (!inRange && !radio) fail(id, `page ${p} outside ${q.topic} range ${lo}–${hi} (±${PAGE_SLACK})`)
    }
  }

  if (typeof q.q !== 'string' || !q.q.trim()) fail(id, 'empty stem')
  if (!Array.isArray(q.options) || q.options.length !== 4) fail(id, 'needs exactly 4 options')
  else {
    if (q.options.some((o) => typeof o !== 'string' || !o.trim())) fail(id, 'empty option')
    const norm = q.options.map((o) => String(o).trim().toLowerCase())
    if (new Set(norm).size !== 4) fail(id, 'options are not distinct')
    if (norm.some((o) => /^(all|none) of the above/.test(o))) allAbove++
  }
  if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer > 3) fail(id, 'answer must be an integer 0–3')
  else answerDist[q.answer]++
  if (typeof q.why !== 'string' || !q.why.trim()) fail(id, 'empty why')

  if (!Array.isArray(q.cover) || !q.cover.length) fail(id, 'cover must be a non-empty array')
  else for (const k of q.cover) {
    if (!(k in coverCount)) fail(id, `unknown cover key "${k}"`)
    else coverCount[k]++
  }

  if (q.figure !== undefined) {
    checkFigure(id, q.figure)
    figureKinds[q.figure.kind] = (figureKinds[q.figure.kind] || 0) + 1
    if (q.figure.kind === 'encounter' && Array.isArray(q.figure.boats) && q.figure.boats.length === 2) {
      const A = q.figure.boats.find((b) => b.id === 'A')
      const B = q.figure.boats.find((b) => b.id === 'B')
      if (A && B) {
        const bFromA = relBearing(A, B)
        const aFromB = relBearing(B, A)
        geometry.push(`  ${id}: B is ${bFromA.toFixed(0)}° (${sector(bFromA)}) from A · A is ${aFromB.toFixed(0)}° (${sector(aFromB)}) from B`)
      }
    }
  }

  const extra = Object.keys(q).filter((k) => !['id', 'topic', 'page', 'q', 'options', 'answer', 'why', 'cover', 'figure'].includes(k))
  if (extra.length) fail(id, `unexpected fields: ${extra.join(', ')}`)
}

// ── Near-duplicate stems ──────────────────────────────────────────────
const words = (s) => new Set(s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter((w) => w.length > 2))
const stems = QUESTIONS.map((q) => ({ id: q.id, w: words(q.q), fig: JSON.stringify(q.figure ?? null), ans: q.options?.[q.answer] }))
for (let i = 0; i < stems.length; i++) {
  for (let j = i + 1; j < stems.length; j++) {
    const a = stems[i]
    const b = stems[j]
    const inter = [...a.w].filter((w) => b.w.has(w)).length
    const jac = inter / (a.w.size + b.w.size - inter || 1)
    if (jac >= 0.85 && a.fig === b.fig && a.ans === b.ans) errors.push(`${a.id} / ${b.id}: near-duplicate (stem overlap ${jac.toFixed(2)})`)
    else if (jac >= 0.7 && a.fig === b.fig) warnings.push(`${a.id} / ${b.id}: similar stems (${jac.toFixed(2)})`)
  }
}

// ── Totals ────────────────────────────────────────────────────────────
if (QUESTIONS.length < MIN_TOTAL) errors.push(`total ${QUESTIONS.length} < ${MIN_TOTAL}`)
for (const [k, n] of Object.entries(coverCount)) if (n < MIN_PER_KEY) errors.push(`coverage "${k}" has ${n} question(s), needs ${MIN_PER_KEY}`)
for (const t of TOPICS) {
  const need = t.examWeight * 3
  if (perTopic[t.id] < need) errors.push(`topic "${t.id}" has ${perTopic[t.id]}, needs ≥ ${need} (examWeight × 3)`)
}
const maxShare = Math.max(...answerDist) / QUESTIONS.length
if (maxShare > 0.32) errors.push(`answer distribution too skewed: ${answerDist.join('/')}`)
if (allAbove > 10) errors.push(`${allAbove} "all/none of the above" options (max 10)`)

// ── Report ────────────────────────────────────────────────────────────
const figTotal = Object.values(figureKinds).reduce((s, n) => s + n, 0)
console.log(`RST question bank: ${QUESTIONS.length} questions`)
console.log('Per topic:', TOPICS.map((t) => `${t.id} ${perTopic[t.id]} (≥${t.examWeight * 3})`).join(' · '))
console.log(`Figures: ${figTotal} —`, Object.entries(figureKinds).map(([k, n]) => `${k} ${n}`).join(', '))
console.log(`Answer distribution A/B/C/D: ${answerDist.join(' / ')}`)
console.log(`"All/None of the above" options: ${allAbove}`)
const thin = Object.entries(coverCount).sort((a, b) => a[1] - b[1]).slice(0, 6)
console.log(`Coverage: ${COVERAGE.length} keys, thinnest:`, thin.map(([k, n]) => `${k} ${n}`).join(', '))
if (geometry.length) console.log('Encounter geometry:\n' + geometry.join('\n'))
for (const w of warnings) console.log(`warn  ${w}`)
if (errors.length) {
  for (const e of errors) console.error(`FAIL  ${e}`)
  console.error(`\n${errors.length} problem(s).`)
  process.exit(1)
}
console.log('\nAll checks passed.')
