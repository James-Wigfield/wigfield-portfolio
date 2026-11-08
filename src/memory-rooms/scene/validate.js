/* ============================================================================
   scene.json v1 validator: ONE implementation shared by the Worker (PATCH),
   the viewer and the Node scripts (check-scene, push). Python mirrors the same
   keyword subset in tools/memory-rooms/blender/scene_io.py.

   It is a small JSON Schema (2020-12) interpreter for exactly the keywords
   scene.schema.json uses. It never compiles code (no `new Function`), so it
   runs inside a Cloudflare Worker. Using a keyword it does not know throws, so
   the schema can't silently outgrow the validator (see SUPPORTED below).

     import { validateScene } from './validate.js';
     const { ok, errors } = validateScene(scene);   // errors: [{ path, message }]
   ========================================================================== */

import schema from './scene.schema.json' with { type: 'json' };

export const SCENE_SCHEMA = schema;
export const SCENE_VERSION = 1;
export const KITS = schema.$defs.kit.enum;
export const MATERIALS = schema.$defs.material.enum;
export const WALLS = schema.$defs.wall.enum;

// Keywords that only annotate. Everything else must be in VALIDATORS.
const ANNOTATIONS = new Set(['$schema', '$id', '$comment', '$defs', 'title', 'description', 'default', 'examples']);
export const SUPPORTED = [
  'type', 'enum', 'const', 'properties', 'required', 'additionalProperties', 'items', 'prefixItems',
  'minItems', 'maxItems', 'minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum', 'minLength',
  'maxLength', 'pattern', 'allOf', 'anyOf', 'oneOf', 'not', 'if', 'then', 'else', '$ref',
];

const typeOf = (v) => {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  if (typeof v === 'number') return Number.isInteger(v) ? 'integer' : 'number';
  return typeof v;
};
const isType = (v, t) => {
  const actual = typeOf(v);
  if (t === 'number') return actual === 'number' || actual === 'integer';
  return actual === t;
};
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const fmt = (v) => (typeof v === 'string' ? `"${v}"` : JSON.stringify(v));

function resolveRef(root, ref) {
  if (!ref.startsWith('#/')) throw new Error(`Only local $ref is supported, got ${ref}`);
  let node = root;
  for (const part of ref.slice(2).split('/')) {
    node = node?.[part.replace(/~1/g, '/').replace(/~0/g, '~')];
    if (node === undefined) throw new Error(`Unresolvable $ref ${ref}`);
  }
  return node;
}

/** Validate `value` against `node` (a schema inside `root`). Pushes { path, message } into errors. */
function check(root, node, value, path, errors) {
  if (node === true) return;
  if (node === false) {
    errors.push({ path, message: 'is not allowed here' });
    return;
  }
  for (const key of Object.keys(node)) {
    if (!ANNOTATIONS.has(key) && !SUPPORTED.includes(key)) {
      throw new Error(`scene validator: unsupported schema keyword "${key}" at ${path || '/'}`);
    }
  }

  if (node.$ref) check(root, resolveRef(root, node.$ref), value, path, errors);

  if (node.type !== undefined) {
    const types = Array.isArray(node.type) ? node.type : [node.type];
    if (!types.some((t) => isType(value, t))) {
      errors.push({ path, message: `must be ${types.join(' or ')} (got ${typeOf(value)})` });
      return; // later keywords assume the right type
    }
  }
  if (node.const !== undefined && !same(value, node.const)) {
    errors.push({ path, message: `must be ${fmt(node.const)}` });
  }
  if (node.enum && !node.enum.some((e) => same(e, value))) {
    const shown = node.enum.length > 12 ? `${node.enum.slice(0, 12).join(', ')}, …` : node.enum.join(', ');
    errors.push({ path, message: `${fmt(value)} is not one of: ${shown}` });
  }

  if (typeof value === 'number') {
    if (node.minimum !== undefined && value < node.minimum) errors.push({ path, message: `must be ≥ ${node.minimum} (got ${value})` });
    if (node.maximum !== undefined && value > node.maximum) errors.push({ path, message: `must be ≤ ${node.maximum} (got ${value})` });
    if (node.exclusiveMinimum !== undefined && value <= node.exclusiveMinimum) errors.push({ path, message: `must be > ${node.exclusiveMinimum} (got ${value})` });
    if (node.exclusiveMaximum !== undefined && value >= node.exclusiveMaximum) errors.push({ path, message: `must be < ${node.exclusiveMaximum} (got ${value})` });
    if (!Number.isFinite(value)) errors.push({ path, message: 'must be a finite number' });
  }

  if (typeof value === 'string') {
    if (node.minLength !== undefined && value.length < node.minLength) errors.push({ path, message: `must be at least ${node.minLength} characters` });
    if (node.maxLength !== undefined && value.length > node.maxLength) errors.push({ path, message: `must be at most ${node.maxLength} characters` });
    if (node.pattern !== undefined && !new RegExp(node.pattern, 'u').test(value)) errors.push({ path, message: `${fmt(value)} does not match ${node.pattern}` });
  }

  if (Array.isArray(value)) {
    if (node.minItems !== undefined && value.length < node.minItems) errors.push({ path, message: `must have at least ${node.minItems} items` });
    if (node.maxItems !== undefined && value.length > node.maxItems) errors.push({ path, message: `must have at most ${node.maxItems} items` });
    const prefix = node.prefixItems || [];
    prefix.forEach((sub, i) => {
      if (i < value.length) check(root, sub, value[i], `${path}/${i}`, errors);
    });
    if (node.items !== undefined) {
      for (let i = prefix.length; i < value.length; i++) check(root, node.items, value[i], `${path}/${i}`, errors);
    }
  }

  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const req of node.required || []) {
      if (!(req in value)) errors.push({ path, message: `is missing required "${req}"` });
    }
    const props = node.properties || {};
    for (const [k, v] of Object.entries(value)) {
      if (k in props) check(root, props[k], v, `${path}/${k}`, errors);
      else if (node.additionalProperties === false) errors.push({ path: `${path}/${k}`, message: `unknown property "${k}"` });
      else if (node.additionalProperties && typeof node.additionalProperties === 'object') {
        check(root, node.additionalProperties, v, `${path}/${k}`, errors);
      }
    }
  }

  for (const sub of node.allOf || []) check(root, sub, value, path, errors);
  if (node.anyOf && !node.anyOf.some((sub) => passes(root, sub, value))) {
    errors.push({ path, message: 'matches none of the allowed shapes (anyOf)' });
  }
  if (node.oneOf) {
    const n = node.oneOf.filter((sub) => passes(root, sub, value)).length;
    if (n !== 1) errors.push({ path, message: `must match exactly one shape (oneOf), matched ${n}` });
  }
  if (node.not && passes(root, node.not, value)) {
    const what = node.not.required ? `must not have "${node.not.required.join('", "')}"` : 'matches a forbidden shape';
    errors.push({ path, message: what });
  }
  if (node.if !== undefined) {
    if (passes(root, node.if, value)) {
      if (node.then !== undefined) check(root, node.then, value, path, errors);
    } else if (node.else !== undefined) {
      check(root, node.else, value, path, errors);
    }
  }
}

function passes(root, node, value) {
  const errs = [];
  check(root, node, value, '', errs);
  return errs.length === 0;
}

/** Generic entry point: validate any value against any schema written in the subset. */
export function validateAgainst(rootSchema, value) {
  const errors = [];
  check(rootSchema, rootSchema, value, '', errors);
  return errors;
}

/**
 * Validate a scene.json object: the schema, plus the cross-references a schema
 * can't express (unique ids, overlaps naming real objects, one camera per photo).
 * Geometry (fits, floats, interpenetration) is check-scene.mjs's job.
 */
export function validateScene(scene) {
  const errors = validateAgainst(schema, scene);
  if (errors.length || !scene || typeof scene !== 'object') return { ok: errors.length === 0, errors };

  const ids = new Map();
  (scene.objects || []).forEach((o, i) => {
    if (ids.has(o.id)) errors.push({ path: `/objects/${i}/id`, message: `duplicate id "${o.id}" (also /objects/${ids.get(o.id)})` });
    else ids.set(o.id, i);
  });
  (scene.objects || []).forEach((o, i) => {
    (o.overlaps || []).forEach((other, j) => {
      if (!ids.has(other)) errors.push({ path: `/objects/${i}/overlaps/${j}`, message: `no object with id "${other}"` });
    });
  });
  (scene.lights || []).forEach((l, i) => {
    if (l.object && !ids.has(l.object)) errors.push({ path: `/lights/${i}/object`, message: `no object with id "${l.object}"` });
  });
  const photos = new Map();
  (scene.cameras || []).forEach((c, i) => {
    if (photos.has(c.photo)) errors.push({ path: `/cameras/${i}/photo`, message: `photo ${c.photo} already has a camera (/cameras/${photos.get(c.photo)})` });
    else photos.set(c.photo, i);
  });
  return { ok: errors.length === 0, errors };
}

/** One line per error, for logs and API responses. */
export const formatErrors = (errors) => errors.map((e) => `${e.path || '/'} ${e.message}`).join('\n');
