import { prod } from '../../maths/shapeRules.js';

/* ============================================================================
   TOPIC 2 · A LAYER'S SHAPE RULE, IN WORDS (the tracer and the drill)
   ----------------------------------------------------------------------------
   shapeRule(L, ins, out) → one sentence saying how this layer turned its
   input shape into its output shape, with the numbers. Plain JS so the
   drill (and node checks) can use it.
   ========================================================================== */

const kOf = (k) => (Array.isArray(k) ? k : [k, k]);

export function shapeRule(L, ins, out) {
  const x = ins[0];
  switch (L.t) {
    case 'conv2d': {
      const [kh] = kOf(L.k);
      return `Kernel ${kh} × ${kh}, stride ${L.s ?? 1}, padding "${L.pad ?? 'valid'}": ${x[0]} × ${x[1]} → ${out[0]} × ${out[1]}; the channels become the ${L.filters} filters.`;
    }
    case 'conv1d':
      return `Kernel ${L.k}, stride ${L.s ?? 1}, padding "${L.pad ?? 'valid'}": ${x[0]} → ${out[0]} time steps; the last axis becomes the ${L.filters} filters.`;
    case 'conv2dT':
      return `Transposed, stride ${L.s ?? 1}, padding "${L.pad ?? 'valid'}": ${x[0]} × ${x[1]} → ${out[0]} × ${out[1]}; channels → ${L.filters}.`;
    case 'maxpool2d':
    case 'avgpool2d':
      return `Pool ${L.p ?? 2} × ${L.p ?? 2}, stride = pool size: ${x[0]} × ${x[1]} → ${out[0]} × ${out[1]} (halved, rounded down); channels kept.`;
    case 'maxpool1d':
      return `Pool ${L.p ?? 2}: ${x[0]} → ${out[0]} steps; features kept.`;
    case 'gap2d':
    case 'gap1d':
      return `Average each feature map down to one number: ${x.length === 3 ? `(${x.join(', ')})` : `(${x.join(', ')})`} → (${out[0]},).`;
    case 'flatten':
      return `Multiply everything out: ${x.join(' × ')} = ${prod(x).toLocaleString('en-US')}.`;
    case 'reshape':
      return `Rearrange the same ${prod(x).toLocaleString('en-US')} numbers as (${out.join(', ')}).`;
    case 'dense':
    case 'denseT':
      return `Only the last axis changes: ${x[x.length - 1]} → ${L.units}.`;
    case 'simplernn':
    case 'lstm':
    case 'gru':
      return L.seq
        ? `return_sequences=True: one output per time step, (${x[0]}, ${x[1]}) → (${out[0]}, ${out[1]}).`
        : `Only the last time step's output: (${x[0]}, ${x[1]}) → (${out[0]},).`;
    case 'bidir':
      return `Two directions, outputs side by side: ${out[out.length - 1] / 2} + ${out[out.length - 1] / 2} = ${out[out.length - 1]}.`;
    case 'concat':
      return `Glue along the last axis: ${ins.map((s) => s[s.length - 1]).join(' + ')} = ${out[out.length - 1]}.`;
    default:
      return 'The shape is unchanged.';
  }
}
