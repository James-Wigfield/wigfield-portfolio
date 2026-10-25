import { useFigs } from './context';

/* ============================================================================
   TRICKY TOPICS — A LINE-ART FIGURE BY KEY
   ----------------------------------------------------------------------------
   <Diagram fig="key" sheet hl={['part']} /> draws the current topic's figure
   `key` (topics/<id>/figs.jsx, provided by the shell through FigsCtx):
   monochrome line art in currentColor, so it can be copied onto paper in a
   minute. `sheet` = on a notebook page (black pen; `hl` parts in green).
   A figure component receives { sheet, hl } and wraps highlightable parts
   in <g data-part="…" className={hl.includes('…') ? 'dltt-fig__hl' : ''}>.
   ========================================================================== */

const NO_HL = [];

export function Diagram({ fig, sheet = false, hl = NO_HL }) {
  const figs = useFigs();
  const F = figs[fig];
  if (!F) return null;
  return (
    <span className={`dltt-figwrap${sheet ? ' dltt-figwrap--sheet' : ''}`}>
      <F sheet={sheet} hl={hl ?? NO_HL} />
    </span>
  );
}
