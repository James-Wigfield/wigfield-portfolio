/* The lecture marker: an outlined "L1" / "L2" label in the lecture's own
   colour (--dl12r-l1 / --dl12r-l2, tuned per theme in
   lectures1-2-refresher.css). Never filled. Screen readers hear
   "Lecture 1"; print shows only the mark. */
export default function LecMark({ lec, className = '' }) {
  return (
    <span className={`dl12r-lec dl12r-lec--${lec} ${className}`}>
      <span className="dl12r-sr">Lecture {lec}</span>
      <span aria-hidden="true">L{lec}</span>
    </span>
  );
}
