/* Dream Rooms · the ONE validator (decision 3). Shared by the Worker, the viewer and
   the Node scripts. Hand-written, no Ajv: Workers forbid `new Function`.

     validateSchema(schema, data)            → ['path: message', …]
     checkDream(dream, text)                 → { ok, errors, warnings, strangeness }
     checkWorld(world, { dream, text })      → { ok, errors, warnings, coverage, fit }
     checkCorridorWorld(world)               → { ok, errors, warnings }

   The schema interpreter knows exactly the keywords our two schemas use and throws
   on any other, so a schema edit can't silently stop being enforced.
   Messages never contain dream words: ids, paths and counts only (decision 14). */

import dreamSchema from './dream.schema.json' with { type: 'json' };
import worldSchema from './world.schema.json' with { type: 'json' };
import { DIMS, DOOR, STUB, atlasEstimate, glbEstimate, moduleById, wallInfo, doorwayFrame, stubFootprint } from './layout.js';

export { dreamSchema, worldSchema };

// ── the schema interpreter ──────────────────────────────────────────────────
const ANNOTATIONS = new Set(['$schema', '$id', 'title', 'description', '$comment', 'default', '$defs']);
const KNOWN = new Set([
  'type', 'const', 'enum', 'properties', 'required', 'additionalProperties', 'items', 'minItems', 'maxItems',
  'uniqueItems', 'minLength', 'maxLength', 'pattern', 'minimum', 'maximum', 'oneOf', '$ref',
]);

const typeOf = (v) => {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  if (Number.isInteger(v)) return 'integer';
  return typeof v;
};
const isType = (v, t) => (t === 'number' ? typeof v === 'number' && Number.isFinite(v) : t === 'integer' ? Number.isInteger(v) : typeOf(v) === t);
const reCache = new Map();
const re = (p) => {
  if (!reCache.has(p)) reCache.set(p, new RegExp(p));
  return reCache.get(p);
};

function resolve(root, ref) {
  if (!ref.startsWith('#/')) throw new Error(`schema: only local $ref supported (${ref})`);
  return ref.slice(2).split('/').reduce((o, k) => o?.[k], root);
}

function walk(root, schema, v, path, errs) {
  for (const k of Object.keys(schema)) if (!KNOWN.has(k) && !ANNOTATIONS.has(k)) throw new Error(`schema: unsupported keyword "${k}" at ${path}`);
  if (schema.$ref) {
    const target = resolve(root, schema.$ref);
    if (!target) throw new Error(`schema: unresolved ${schema.$ref}`);
    walk(root, target, v, path, errs);
  }
  if (schema.oneOf) {
    // discriminated by `kind` when every branch pins it; otherwise exactly one branch must pass
    const kinds = schema.oneOf.map((b) => {
      const k = b.properties?.kind;
      return k ? (k.const !== undefined ? [k.const] : k.enum || null) : null;
    });
    if (kinds.every(Boolean) && v && typeof v === 'object' && !Array.isArray(v)) {
      const i = kinds.findIndex((ks) => ks.includes(v.kind));
      if (i < 0) errs.push(`${path}.kind: must be one of ${kinds.flat().join(', ')}`);
      else walk(root, schema.oneOf[i], v, path, errs);
    } else {
      const passing = schema.oneOf.filter((b) => {
        const e = [];
        walk(root, b, v, path, e);
        return e.length === 0;
      }).length;
      if (passing !== 1) errs.push(`${path}: must match exactly one shape (${passing} matched)`);
    }
  }
  if (schema.type !== undefined) {
    const types = [].concat(schema.type);
    if (!types.some((t) => isType(v, t))) {
      errs.push(`${path}: must be ${types.join(' or ')}`);
      return;
    }
  }
  if (schema.const !== undefined && v !== schema.const) errs.push(`${path}: must be ${JSON.stringify(schema.const)}`);
  if (schema.enum && !schema.enum.includes(v)) errs.push(`${path}: must be one of ${schema.enum.join(', ')}`);
  if (typeof v === 'string') {
    if (schema.minLength !== undefined && v.length < schema.minLength) errs.push(`${path}: too short (min ${schema.minLength})`);
    if (schema.maxLength !== undefined && v.length > schema.maxLength) errs.push(`${path}: too long (max ${schema.maxLength})`);
    if (schema.pattern && !re(schema.pattern).test(v)) errs.push(`${path}: doesn't match ${schema.pattern}`);
  }
  if (typeof v === 'number') {
    if (schema.minimum !== undefined && v < schema.minimum) errs.push(`${path}: below ${schema.minimum}`);
    if (schema.maximum !== undefined && v > schema.maximum) errs.push(`${path}: above ${schema.maximum}`);
  }
  if (Array.isArray(v)) {
    if (schema.minItems !== undefined && v.length < schema.minItems) errs.push(`${path}: needs at least ${schema.minItems} items`);
    if (schema.maxItems !== undefined && v.length > schema.maxItems) errs.push(`${path}: at most ${schema.maxItems} items`);
    if (schema.uniqueItems && new Set(v.map((x) => JSON.stringify(x))).size !== v.length) errs.push(`${path}: items must be unique`);
    if (schema.items) v.forEach((x, i) => walk(root, schema.items, x, `${path}[${i}]`, errs));
  }
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    for (const r of schema.required || []) if (!(r in v)) errs.push(`${path}.${r}: required`);
    const props = schema.properties || {};
    for (const [k, x] of Object.entries(v)) {
      if (props[k]) walk(root, props[k], x, `${path}.${k}`, errs);
      else if (schema.additionalProperties === false) errs.push(`${path}.${k}: not allowed`);
      else if (schema.additionalProperties && typeof schema.additionalProperties === 'object') walk(root, schema.additionalProperties, x, `${path}.${k}`, errs);
    }
  }
}

export function validateSchema(schema, data) {
  const errs = [];
  walk(schema, schema, data, '$', errs);
  return errs;
}
export const validateDream = (d) => validateSchema(dreamSchema, d);
export const validateWorld = (w) => validateSchema(worldSchema, w);

// ── dream.json ──────────────────────────────────────────────────────────────
const LISTS = ['places', 'links', 'figures', 'objects', 'changes', 'vague', 'sound'];

/** Every entity with an id, as [id, entity, list]. */
export function entities(dream) {
  const out = [];
  if (dream?.time) out.push(['time', dream.time, 'time']);
  for (const l of LISTS) for (const e of dream?.[l] || []) out.push([e.id, e, l]);
  return out;
}

/** The ids the strangeness check needs covered (CONTRACTS.md §3). */
export function strangenessIds(dream) {
  const ids = [];
  for (const p of dream?.places || []) if ((p.is || []).length >= 2) ids.push(p.id);
  for (const l of dream?.links || []) if (l.impossible && l.impossible !== 'none') ids.push(l.id);
  for (const c of dream?.changes || []) ids.push(c.id);
  for (const v of dream?.vague || []) ids.push(v.id);
  if (dream?.time?.contradiction) ids.push('time');
  return ids;
}

/** Loose "are these his words": case and spacing ignored, end punctuation ignored. */
export function foundIn(text, phrase) {
  const norm = (s) => String(s).toLowerCase().replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim();
  const p = norm(phrase).replace(/^[\s.,;:!?…"'-]+|[\s.,;:!?…"'-]+$/g, '');
  return p.length > 0 && norm(text).includes(p);
}

export function checkDream(dream, text) {
  const errors = validateDream(dream);
  const warnings = [];
  if (errors.length) return { ok: false, errors, warnings, strangeness: [] };
  const src = String(text ?? '');
  const all = entities(dream);
  const ids = new Set();
  for (const [id] of all) {
    if (ids.has(id)) errors.push(`duplicate id ${id}`);
    ids.add(id);
  }
  const places = new Set((dream.places || []).map((p) => p.id));
  const quoted = [['mood', dream.mood], ...all.map(([id, e]) => [id, e])];
  for (const [id, e] of quoted) {
    if (!e?.quote) continue;
    e.quote.forEach((q, i) => {
      if (src.indexOf(q) < 0) errors.push(`${id}: quote ${i + 1} isn't in the text (copy it exactly)`);
      if (e.src) {
        const s = e.src[i];
        if (!s) errors.push(`${id}: src ${i + 1} missing (run quote-spans.mjs)`);
        else if (src.slice(s[0], s[1]) !== q) errors.push(`${id}: src ${i + 1} doesn't match its quote (run quote-spans.mjs)`);
      }
    });
    if (e.src && e.src.length !== e.quote.length) errors.push(`${id}: src and quote lengths differ`);
  }
  for (const l of dream.links || []) {
    if (!places.has(l.from)) errors.push(`${l.id}: from ${l.from} isn't a place`);
    if (!places.has(l.to)) errors.push(`${l.id}: to ${l.to} isn't a place`);
  }
  for (const f of dream.figures || []) if (f.at && !places.has(f.at)) errors.push(`${f.id}: at ${f.at} isn't a place`);
  for (const o of dream.objects || []) if (o.at && !places.has(o.at)) errors.push(`${o.id}: at ${o.at} isn't a place`);
  for (const c of dream.changes || []) if (!ids.has(c.target)) errors.push(`${c.id}: target ${c.target} doesn't exist`);
  (dream.fragments || []).forEach((f, i) => {
    if (f.at !== 'wake' && !places.has(f.at)) errors.push(`fragments[${i}]: at ${f.at} isn't a place`);
    if (src.indexOf(f.text) < 0) errors.push(`fragments[${i}]: text isn't in the text (copy it exactly)`);
    if (f.src && src.slice(f.src[0], f.src[1]) !== f.text) errors.push(`fragments[${i}]: src doesn't match (run quote-spans.mjs)`);
  });
  if (dream.time?.contradiction && (dream.time.said || []).length < 2) warnings.push('time: a contradiction usually keeps both things said');
  if (!(dream.places || []).length) warnings.push('no places: this dream will probably be a still');
  return { ok: errors.length === 0, errors, warnings, strangeness: strangenessIds(dream) };
}

// ── world.json ──────────────────────────────────────────────────────────────
const ALLOW_INVENTED = { module: true, doorway: true, link: true, finish: true, ceiling: true, lights: true, look: true, sound: true, wake: true };
const NEEDS_CITATION = { ceiling: ['drop-tiles'], lights: ['panels'], finish: ['wallpaper'] };
const TEXT_PROPS = new Set(['sign', 'board']);

/** Every mechanism in a world: [kind, path, object]. */
function mechanisms(world) {
  const out = [];
  if (world.look) out.push(['look', 'look', world.look]);
  if (world.sound) out.push(['sound', 'sound', world.sound]);
  for (const m of world.modules || []) {
    const p = `modules.${m.id}`;
    out.push(['module', p, m]);
    for (const [k, f] of Object.entries(m.finishes || {})) out.push(['finish', `${p}.finishes.${k}`, f]);
    if (m.ceiling) out.push(['ceiling', `${p}.ceiling`, m.ceiling]);
    if (m.lights) out.push(['lights', `${p}.lights`, m.lights]);
    if (m.doors) out.push(['doors', `${p}.doors`, m.doors]);
    for (const pr of m.props || []) out.push(['prop', `${p}.props.${pr.id}`, pr]);
  }
  for (const d of world.doorways || []) out.push(['doorway', `doorways.${d.id}`, d]);
  (world.links || []).forEach((l, i) => {
    if (l.kind !== 'enter') out.push([l.kind === 'dissolve' ? 'dissolve' : 'link', `links[${i}]`, l]);
  });
  (world.swaps || []).forEach((s, i) => out.push(['swap', `swaps[${i}]`, s]));
  (world.figures || []).forEach((f, i) => out.push(['figure', `figures[${i}]`, f]));
  (world.words || []).forEach((w, i) => out.push(['word', `words[${i}]`, w]));
  if (world.wake) out.push(['wake', 'wake', world.wake]);
  return out;
}

/** The surfaces a word or swap can name in a module. */
function surfacesOf(m) {
  const s = new Set(['floor', 'wall-n', 'wall-s', 'wall-e', 'wall-w']);
  for (const p of m.props || []) s.add(p.id);
  if (m.doors?.count) s.add('doors-sign');
  if (m.kit === 'pool' || m.finishes?.water) s.add('water');
  if (m.lights?.is === 'panels') s.add('tube');
  return s;
}

export function fitCheck(dream, world) {
  const ents = entities(dream).map(([id]) => id);
  const dropped = new Set((world.dropped || []).map((d) => d.id));
  const n = ents.length;
  const d = ents.filter((id) => dropped.has(id)).length;
  return { entities: n, dropped: d, ratio: n ? d / n : 1, still: n === 0 || d / n > 0.5 };
}

export function checkWorld(world, { dream = null, text = null } = {}) {
  const errors = validateWorld(world);
  const warnings = [];
  if (errors.length) return { ok: false, errors, warnings, coverage: {}, fit: null };
  if (world.kind === 'corridor') return checkCorridorWorld(world);
  const still = world.fallback === 'still';
  const dreamIds = new Set(dream ? entities(dream).map(([id]) => id) : []);

  // ids + references
  const modules = new Map();
  for (const m of world.modules) {
    if (modules.has(m.id)) errors.push(`modules: duplicate id ${m.id}`);
    modules.set(m.id, m);
    const propIds = new Set();
    for (const p of m.props || []) {
      if (propIds.has(p.id)) errors.push(`modules.${m.id}: duplicate prop ${p.id}`);
      propIds.add(p.id);
      if (p.wall && p.at === undefined) errors.push(`modules.${m.id}.props.${p.id}: a wall prop needs at`);
      if (!p.wall && !p.pos) errors.push(`modules.${m.id}.props.${p.id}: needs wall+at or pos`);
      if (p.wall && p.at !== undefined && p.at > wallInfo(p.wall, m.size).length) errors.push(`modules.${m.id}.props.${p.id}: at is past the wall's end`);
    }
    if (m.kit === 'dream-corridor') errors.push(`modules.${m.id}: kit dream-corridor is for the corridor world only`);
    if (m.kit === 'bespoke' && !m.bespoke) errors.push(`modules.${m.id}: kit bespoke needs bespoke: <script name>`);
    if (m.repeat && m.kit !== 'corridor') errors.push(`modules.${m.id}: only a corridor can repeat`);
    if (m.walkable === 'edge-only' && m.kit !== 'pool') warnings.push(`modules.${m.id}: edge-only is meant for pools`);
    m.size.forEach((v, i) => {
      if (v < 1.5 || v > 60) errors.push(`modules.${m.id}.size[${i}]: ${v} m is outside 1.5–60 m`);
    });
    if (m.origin[1] !== 0) warnings.push(`modules.${m.id}: origin y isn't 0`);
  }
  const mods = [...modules.values()];
  for (let i = 0; i < mods.length; i++) {
    for (let j = i + 1; j < mods.length; j++) {
      const a = mods[i].origin;
      const b = mods[j].origin;
      if (Math.hypot(a[0] - b[0], a[2] - b[2]) < DIMS.moduleSpacing - 1e-6) errors.push(`modules ${mods[i].id} and ${mods[j].id} must sit ≥ ${DIMS.moduleSpacing} m apart`);
    }
  }

  // doorways
  const doorways = new Map();
  const frames = new Map();
  for (const d of world.doorways || []) {
    if (doorways.has(d.id)) errors.push(`doorways: duplicate id ${d.id}`);
    doorways.set(d.id, d);
    const m = modules.get(d.module);
    if (!m) {
      errors.push(`doorways.${d.id}: no module ${d.module}`);
      continue;
    }
    const len = wallInfo(d.wall, m.size).length;
    if (d.at - DOOR.w / 2 < 0.3 || d.at + DOOR.w / 2 > len - 0.3) errors.push(`doorways.${d.id}: at ${d.at} puts the opening outside its wall (0.3 m from each corner, wall ${len} m)`);
    if (m.size[1] < DOOR.h + 0.3) errors.push(`doorways.${d.id}: module ${m.id} is too low for a door`);
    if (m.repeat && (d.wall === 'n' || d.wall === 's')) errors.push(`doorways.${d.id}: a repeating corridor's doorways go on e or w`);
    const f = doorwayFrame(world, d);
    frames.set(d.id, f);
    if (m.repeat) {
      const zs = stubFootprint(f).flat().map((p) => p[1] - m.origin[2]);
      if (Math.min(...zs) < -1e-6 || Math.max(...zs) > m.size[2] + 1e-6) errors.push(`doorways.${d.id}: its stub leaves the repeating segment (move at so the stub fits inside 0..${m.size[2]} m)`);
    }
  }
  // stubs on the same wall must not overlap
  const byWall = new Map();
  for (const d of doorways.values()) {
    const k = `${d.module}:${d.wall}`;
    if (!byWall.has(k)) byWall.set(k, []);
    byWall.get(k).push(d);
  }
  const gap = STUB.leg2 + STUB.width + 0.3;
  for (const list of byWall.values()) {
    list.sort((a, b) => a.at - b.at);
    for (let i = 1; i < list.length; i++) if (list[i].at - list[i - 1].at < gap) errors.push(`doorways ${list[i - 1].id} and ${list[i].id}: ${list[i].at - list[i - 1].at} m apart; their stubs need ≥ ${gap.toFixed(1)} m`);
  }

  // links
  const used = new Map();
  const edges = new Map(mods.map((m) => [m.id, new Set()]));
  const link = (a, b) => {
    edges.get(a)?.add(b);
    edges.get(b)?.add(a);
  };
  (world.links || []).forEach((l, i) => {
    if (l.kind === 'enter') {
      errors.push(`links[${i}]: enter links are for the corridor world only`);
      return;
    }
    if (l.kind === 'dissolve') {
      if (!modules.has(l.from)) errors.push(`links[${i}]: from ${l.from} isn't a module`);
      if (!modules.has(l.to)) errors.push(`links[${i}]: to ${l.to} isn't a module`);
      if (l.from === l.to) errors.push(`links[${i}]: a dissolve goes somewhere else`);
      if (l.at && modules.has(l.to)) {
        const s = modules.get(l.to).size;
        if (l.at[0] < 0 || l.at[0] > s[0] || l.at[2] < 0 || l.at[2] > s[2]) errors.push(`links[${i}]: at is outside ${l.to}`);
      }
      if (modules.has(l.from) && modules.has(l.to)) edges.get(l.from).add(`>${l.to}`);
      return;
    }
    // a doorway is the DEPARTURE end of at most one link (a, or b of a two-way link);
    // several one-way links may arrive at the same doorway
    for (const end of [l.a, l.b]) if (!doorways.has(end)) errors.push(`links[${i}]: no doorway ${end}`);
    for (const end of l.oneway ? [l.a] : [l.a, l.b]) {
      if (!doorways.has(end)) continue;
      if (used.has(end)) errors.push(`links[${i}]: doorway ${end} already leads somewhere (links[${used.get(end)}])`);
      else used.set(end, i);
    }
    if (l.oneway && doorways.has(l.b) && !used.has(l.b)) used.set(l.b, i);
    if (l.a === l.b) errors.push(`links[${i}]: a and b are the same doorway`);
    if (doorways.has(l.a) && doorways.has(l.b)) link(doorways.get(l.a).module, doorways.get(l.b).module);
  });
  for (const d of doorways.values()) if (!used.has(d.id)) warnings.push(`doorways.${d.id}: in no link (it will be a door to nowhere: a stub)`);

  // route, spawn, wake
  if (!still) {
    if (!world.route?.length) errors.push('route: required (unless fallback is still)');
    if (!world.spawn) errors.push('spawn: required (unless fallback is still)');
    if (!world.wake) errors.push('wake: required');
  }
  const directly = (a, b) => edges.get(a)?.has(b) || edges.get(a)?.has(`>${b}`);
  if (world.route?.length && !still) {
    world.route.forEach((id, i) => {
      if (!modules.has(id)) errors.push(`route[${i}]: no module ${id}`);
      if (i > 0 && modules.has(id) && !directly(world.route[i - 1], id)) errors.push(`route: no link from ${world.route[i - 1]} to ${id}`);
    });
    if (world.spawn && world.route[0] !== world.spawn.module) errors.push('route: must start in the spawn module');
    // everything reachable from spawn
    const seen = new Set([world.spawn?.module]);
    const queue = [world.spawn?.module];
    while (queue.length) {
      const cur = queue.shift();
      for (const n of edges.get(cur) || []) {
        const id = n.startsWith('>') ? n.slice(1) : n;
        if (!seen.has(id)) {
          seen.add(id);
          queue.push(id);
        }
      }
    }
    for (const m of mods) if (!seen.has(m.id)) errors.push(`modules.${m.id}: can't be reached from spawn`);
  }
  if (world.spawn) {
    const m = modules.get(world.spawn.module);
    if (!m) errors.push(`spawn: no module ${world.spawn.module}`);
    else {
      const [x, y, z] = world.spawn.at;
      if (x < 0.3 || z < 0.3 || x > m.size[0] - 0.3 || z > m.size[2] - 0.3 || y < 0 || y > 0.5) errors.push('spawn: at is outside its module (module-local metres, y = floor)');
    }
  }
  if (world.wake) {
    if (!modules.has(world.wake.after)) errors.push(`wake.after: no module ${world.wake.after}`);
    else if (world.route?.length && world.route[world.route.length - 1] !== world.wake.after) warnings.push('wake.after: usually the last module of the route');
    if (text != null && !foundIn(text, world.wake.line)) errors.push('wake.line: must be his words (not found in the text)');
  }
  for (const s of world.stills || []) if (!modules.has(s.module)) errors.push(`stills.${s.name}: no module ${s.module}`);
  if (still && !(world.stills?.length || world.modules.length)) errors.push('fallback still: needs at least one module or still');

  // swaps, figures, words
  const targetOk = (t) => {
    const [mid, surf] = t.split('/');
    const m = modules.get(mid);
    return m && surfacesOf(m).has(surf);
  };
  (world.swaps || []).forEach((s, i) => {
    if (!targetOk(s.target)) errors.push(`swaps[${i}]: target ${s.target} isn't a prop or surface of that module`);
    if (s.action === 'relabel' && typeof s.to !== 'string') errors.push(`swaps[${i}]: relabel needs to: "<text>"`);
    if (s.action === 'retint' && !/^#[0-9a-fA-F]{6}$/.test(String(s.to))) errors.push(`swaps[${i}]: retint needs to: "#rrggbb"`);
    if (s.action === 'move' && !Array.isArray(s.to)) errors.push(`swaps[${i}]: move needs to: [x, y, z]`);
    if (s.after?.startsWith('visited:') && !modules.has(s.after.slice(8))) errors.push(`swaps[${i}]: after names no module`);
  });
  (world.figures || []).forEach((f, i) => {
    if (!modules.has(f.module)) errors.push(`figures[${i}]: no module ${f.module}`);
  });
  (world.words || []).forEach((w, i) => {
    if (!targetOk(w.on)) errors.push(`words[${i}]: on ${w.on} isn't a surface of that module`);
    else {
      const [mid, surf] = w.on.split('/');
      const p = (modules.get(mid).props || []).find((x) => x.id === surf);
      if (p && !TEXT_PROPS.has(p.kit)) errors.push(`words[${i}]: prop ${surf} (${p.kit}) can't carry words`);
    }
    if (text != null && !foundIn(text, w.text)) errors.push(`words[${i}]: must be his words (not found in the text)`);
  });

  // budgets (a still-fallback world is rendered as stills, never baked to a GLB)
  for (const m of still ? [] : mods) {
    const n = atlasEstimate(m);
    if (n > DIMS.budget.atlasesPerModule) errors.push(`modules.${m.id}: needs ~${n} atlases (max ${DIMS.budget.atlasesPerModule}); make it smaller`);
  }
  const est = still ? 0 : glbEstimate(world);
  if (est > DIMS.budget.glbBytes) errors.push(`budget: estimated GLB ${(est / 1048576).toFixed(1)} MB > ${(DIMS.budget.glbBytes / 1048576).toFixed(0)} MB; fewer or smaller modules`);

  // cited or invented (decision 9 + James's answer 6)
  const coverage = {};
  for (const [kind, path, o] of mechanisms(world)) {
    const cites = o.for || [];
    for (const id of cites) {
      if (dream && !dreamIds.has(id)) errors.push(`${path}: for ${id} isn't in dream.json`);
      (coverage[id] = coverage[id] || []).push(path);
    }
    if (o.invented) {
      if (!ALLOW_INVENTED[kind]) errors.push(`${path}: a ${kind} can't be invented (only connective tissue: modules, doorways, links, floors, walls, ceilings, sourceless light)`);
      if (!o.why) errors.push(`${path}: invented needs a why ("joins p1 to p2", "floor for p3")`);
      if (kind === 'finish' && o.is !== 'plain') errors.push(`${path}: an invented finish stays plain`);
      if (kind === 'finish' && o.color) errors.push(`${path}: an invented finish has no colour (plain grey)`);
      if (kind === 'lights' && o.is !== 'glow') errors.push(`${path}: invented light must be sourceless glow`);
    } else if (!cites.length) {
      errors.push(`${path}: cite the dream (for) or mark it invented with a why`);
    }
    if (NEEDS_CITATION[kind]?.includes(o.is) && !cites.length) errors.push(`${path}: ${o.is} only when the dream calls for it (cite it)`);
  }

  // strangeness: covered or dropped with a reason
  const dropped = new Map((world.dropped || []).map((d) => [d.id, d.reason]));
  for (const id of dropped.keys()) if (dream && !dreamIds.has(id)) errors.push(`dropped: ${id} isn't in dream.json`);
  if (dream) {
    for (const id of strangenessIds(dream)) {
      if (!coverage[id] && !dropped.has(id)) errors.push(`strangeness: ${id} has no mechanism (cite it in a for) and isn't in dropped`);
    }
  }

  // scale is off somewhere (decision 8)
  const off = (s) => s !== undefined && Math.abs(s - 1) >= 0.1;
  if (!still && !mods.some((m) => off(m.scale))) warnings.push('scale: nothing is off by 10–25 % (set a module scale)');

  // fit check
  let fit = null;
  if (dream) {
    fit = fitCheck(dream, world);
    if (fit.still && !still) errors.push(`fit check: ${fit.dropped} of ${fit.entities} entities dropped; set fallback: "still"`);
    if (!fit.still && still) warnings.push(`fit check: only ${fit.dropped} of ${fit.entities} dropped, yet fallback is still`);
  }
  return { ok: errors.length === 0, errors, warnings, coverage, fit };
}

// ── the corridor world (made at runtime by corridorWorld.js) ────────────────
export function checkCorridorWorld(world) {
  const errors = validateWorld(world);
  const warnings = [];
  if (errors.length) return { ok: false, errors, warnings };
  if (world.kind !== 'corridor') errors.push('kind: must be corridor');
  const m = world.modules[0];
  if (world.modules.length !== 1 || m.kit !== 'dream-corridor') errors.push('modules: one dream-corridor module');
  const doors = world.doors || [];
  const ids = new Set();
  for (const d of doors) {
    if (ids.has(d.id)) errors.push(`doors: duplicate ${d.id}`);
    ids.add(d.id);
    const want = d.status === 'rendered' ? 'ajar' : d.status === 'failed' ? 'shut-dark' : 'shut-lit';
    if (d.dream && d.state !== want) errors.push(`doors.${d.id}: state ${d.state} doesn't match status ${d.status}`);
  }
  // deeper (more negative z) = older: (dreamt_on desc, night_order asc) along −z
  const real = doors.filter((d) => d.dream);
  for (let i = 1; i < real.length; i++) {
    const a = real[i - 1];
    const b = real[i];
    if (!(b.z < a.z)) errors.push(`doors: ${b.id} isn't deeper than ${a.id}`);
    const order = a.dreamt_on === b.dreamt_on ? a.night_order < b.night_order : a.dreamt_on > b.dreamt_on;
    if (!order) errors.push(`doors: ${a.id} → ${b.id} out of order`);
  }
  const enter = (world.links || []).filter((l) => l.kind === 'enter');
  for (const l of enter) {
    const d = doors.find((x) => x.id === l.door);
    if (!d) errors.push(`links: enter ${l.door} has no door`);
    else if (d.state !== 'ajar') errors.push(`links: only rendered doors open (${l.door})`);
  }
  if (real.length && enter.length !== real.filter((d) => d.state === 'ajar').length) errors.push('links: every ajar door needs an enter link');
  // a break exactly where the date changes (and before the first night)
  const breaks = world.breaks || [];
  let prevNight = null;
  let prevZ = Infinity;
  for (const d of real) {
    const between = breaks.filter((b) => b.z < prevZ && b.z > d.z);
    if (d.dreamt_on !== prevNight && between.length !== 1) errors.push(`breaks: expected one break before ${d.id} (new night)`);
    if (d.dreamt_on === prevNight && between.length) errors.push(`breaks: a break inside night ${d.dreamt_on}`);
    prevNight = d.dreamt_on;
    prevZ = d.z;
  }
  if (!real.length && !doors.some((d) => d.side === 'end')) errors.push('empty corridor: needs the end door');
  return { ok: errors.length === 0, errors, warnings };
}

export { DIMS, STUB, DOOR, moduleById };
