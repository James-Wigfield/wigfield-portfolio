/* Placeholder scene — replaced by the real <Canvas> in the next build step. */
export default function Scene({ progress }) {
  return (
    <div className="dlg-cover dlg-cover--loading" role="status">
      <div className="dlg-cover__sky" aria-hidden="true" />
      <div className="dlg-cover__sea" aria-hidden="true" />
      <p className="dlg-cover__loading">Scene shell · {progress.found.length} scrolls found</p>
    </div>
  );
}
