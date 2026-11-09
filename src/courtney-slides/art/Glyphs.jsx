/* Small reusable SVG glyphs. All are drawn around (0, 0). */

const PERSON = 'M -42 -78 Q -42 -92 -28 -92 L 28 -92 Q 42 -92 42 -78 L 42 6 Q 42 14 34 14 L 26 14 L 26 96 Q 26 104 18 104 L -18 104 Q -26 104 -26 96 L -26 14 L -34 14 Q -42 14 -42 6 Z';

/** A pictogram person, 84 x 236, feet at y = 104. `fill` also draws a dashed twin used for "lost". */
export function Person({ fill = false }) {
  return (
    <g className="g-person">
      <g data-a="pfill">
        <circle cy="-126" r="28" />
        <path d={PERSON} />
      </g>
      {fill && (
        <g data-a="pline" className="g-person__line">
          <circle cy="-126" r="28" />
          <path d={PERSON} />
        </g>
      )}
    </g>
  );
}

/** A check, a half and an open ring: status marks for ruled tables. */
export function Mark({ kind }) {
  if (kind === 'yes') return <span className="dot dot--bone" />;
  if (kind === 'part') return <span className="dot dot--half" />;
  return <span className="dot dot--hollow" />;
}
