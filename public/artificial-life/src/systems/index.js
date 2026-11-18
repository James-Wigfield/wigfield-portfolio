// Specimen registry. Another system is added by writing one module that
// exports `meta` and `create()`, then adding two lines here.
import * as lenia from './lenia.js';
import * as grayScott from './gray-scott.js';
import * as physarum from './physarum.js';
import * as particleLife from './particle-life.js';
import * as pps from './pps.js';
import * as ecology from './ecology.js';

export const registry = [lenia, grayScott, physarum, particleLife, pps, ecology];

// Catalogue entries for the index, available without instantiating anything.
export const catalogue = registry.map((m, i) => ({ ...m.meta, index: i }));

export function instantiate(index) {
  const mod = registry[index];
  if (!mod) throw new Error('no specimen at index ' + index);
  return mod.create();
}
