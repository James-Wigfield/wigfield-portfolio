import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import './DissertationDiff.css';

/* ============================================================================
   DISSERTATION · RED PEN — the CITS4010 dissertation before and after an edit
   ----------------------------------------------------------------------------
   Left: the dissertation as committed. Right: the same text marked up into the
   edited version like a manual edit in red pen: removed text struck through in
   red (still readable), new or reworded text in red handwriting, removed
   figures and tables crossed out, redrawn figures and rebuilt tables shown old
   (crossed) above new (framed). The wording of the header comes from the
   manifest (build.py --tags), since a comparison can be applied cuts or a
   proposal not yet applied.

   Change tags: when the edited version is a proposal whose files carry
   "% REV <ID>" markers, the manifest lists where each ID landed and the tags
   are drawn in the right margin of the edited pages, coloured by tier. A
   click flags a tag (to drop or query it); flags stay in this browser and
   "Copy IDs" puts the flagged list on the clipboard.

   Both columns are page renders (SVG, pdftocairo) of real pdflatex builds, so
   the typography, numbering, equations, citations and figures are the PDF's.
   tools/dissertation-diff/build.py makes them with latexdiff plus fixes, and
   checks the result: with the handwriting dropped the marked-up file reads
   word for word as the original PDF, with the struck text dropped as the final
   one. The page shows that check's result.

   Data: wigfield-portfolio/dissertation-diff-data/ (gitignored), served ONLY by
   the dev server (vite.config.js `dissertation-diff-data`, apply: 'serve'), so
   the unsubmitted dissertation is never bundled or deployed. A production build
   shows a "local only" notice instead.

   Scrolling: each column scrolls on its own; with "Sync" on, the other column
   follows through the chapter and section starts the two builds share, with
   straight-line interpolation in between.
   ========================================================================== */

const ROOT = '/__dissertation-diff';
const PAD = 18; // px round the pages inside a column (the change bars sit in it)
const GAP = 16; // px between pages
const LINE = 0.3; // reading line, as a fraction of the column height
const ZOOMS = [1, 1.25, 1.5, 2];
const VIEWS = [
  { id: 'both', label: 'Side by side' },
  { id: 'original', label: 'Original' },
  { id: 'edited', label: 'Edited' },
];
const PREFS_KEY = 'portal:dissertationDiff';
const FLAGS_KEY = 'portal:dissertationDiff:flags';
const TAG_H = 16; // px, the height of a margin tag
// The page's wording when the manifest has none (the applied word cuts).
const DEFAULT_PAGE = {
  kicker: 'CITS4010 · dissertation · word cuts',
  title: 'The cuts, in red pen',
  intro: 'Before the word cuts on the left; the same pages marked up into the post-cut version on the right. Both are the compiled PDF.',
  original: 'before the cuts',
  edited: 'after the cuts',
};

function loadPrefs() {
  try {
    return JSON.parse(localStorage.getItem(PREFS_KEY)) || {};
  } catch {
    return {};
  }
}
function loadFlags() {
  try {
    return new Set(JSON.parse(localStorage.getItem(FLAGS_KEY)) || []);
  } catch {
    return new Set();
  }
}

const fmt = (n) => n.toLocaleString('en-AU');
const shortDate = (iso) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });

function sourceLabel(src) {
  if (src.kind === 'worktree') return `working tree, ${src.date}`;
  if (src.kind === 'overlay') return `${src.rev} + ${src.overlay.split('/').slice(-2).join('/')}`;
  return `${src.rev} · ${shortDate(src.date)}`;
}
const signed = (n) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '±0');

function tagTip(id, t, stages) {
  if (!t) return id;
  const words = t.words ? ` · ${signed(t.words)} words` : '';
  const damage = t.damage ? ` · ${t.damage} damage` : '';
  const more = t.absorbs?.length ? `\nIncludes ${t.absorbs.join(', ')}` : '';
  return `${id} · ${stages?.[t.stage] ?? t.stage}${damage}${words}\n${t.title}\n${t.section}${more}\nClick to flag`;
}

/* Page boxes of one column: every page at the same width, stacked. */
function geometry(pages, width, zoom) {
  const pw = Math.max(240, (width - 2 * PAD) * zoom);
  const hs = pages.map(([w, h]) => (pw * h) / w);
  const tops = [];
  let y = PAD;
  for (const h of hs) {
    tops.push(y);
    y += h + GAP;
  }
  return { pw, hs, tops, total: y - GAP + PAD };
}
const posOf = (g, page, frac) => g.tops[page - 1] + frac * g.hs[page - 1];
// A heading in the top 30% of its page (a chapter start, say) counts from the page's top.
const secPos = (g, a) => (a.y < 0.3 ? g.tops[a.page - 1] + 16 : posOf(g, a.page, a.y));

function interp(pts, x, from, to) {
  if (!pts.length) return x;
  let i = 0;
  while (i < pts.length - 2 && pts[i + 1][from] < x) i += 1;
  const [a, b] = [pts[i], pts[i + 1] ?? pts[i]];
  const span = b[from] - a[from];
  const t = span > 0 ? Math.min(1, Math.max(0, (x - a[from]) / span)) : 0;
  return a[to] + t * (b[to] - a[to]);
}

function useWidth(el) {
  const [w, setW] = useState(0);
  useEffect(() => {
    if (!el) return undefined;
    const ro = new ResizeObserver(() => setW(el.clientWidth)); // also fires once on observe
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return w;
}

export default function DissertationDiff() {
  if (!import.meta.env.DEV) return <LocalOnly />;
  return <DissertationDiffDev />;
}

function LocalOnly() {
  return (
    <div className="pt-module ddf">
      <section className="pt-card ddf-notice">
        <h2>Dissertation · red pen · local only</h2>
        <p>
          This page shows the unsubmitted dissertation page by page, so it is served by the development
          server only and never bundled or deployed. Run <code>npm run dev</code> on the PC that built it and
          open <code>/portal/dissertation-red-pen</code>.
        </p>
      </section>
    </div>
  );
}

function NotBuilt({ error }) {
  return (
    <div className="pt-module ddf">
      <section className="pt-card ddf-notice">
        <h2>Dissertation · red pen · not built yet</h2>
        <p>
          The page renders come from <code>tools/dissertation-diff/build.py</code>, which compiles both
          versions of the dissertation with MiKTeX, marks up the differences and checks them. From the
          portfolio folder run:
        </p>
        <pre className="ddf-cmd">python tools/dissertation-diff/build.py</pre>
        <p className="ddf-muted">It takes about two minutes and writes to the gitignored dissertation-diff-data/ folder. ({error})</p>
      </section>
    </div>
  );
}

/* One page slot: the render once it is near the viewport, a sized blank before. */
function Page({ src, n, of, top, width, height, live }) {
  return (
    <div className="ddf-page" style={{ top, width, height }}>
      {live ? <img src={src} alt={`Page ${n} of ${of}`} width={width} height={height} decoding="async" draggable="false" />
        : <span className="ddf-page__blank">{n}</span>}
      <span className="ddf-page__no" aria-hidden="true">{n} / {of}</span>
    </div>
  );
}

function Column({ side, title, meta, doc, geo, setScroller, onScroll, scroll, children, rail }) {
  const { top = 0, h = 800 } = scroll || {};
  const live = (i) => geo.tops[i] + geo.hs[i] > top - 1.5 * h && geo.tops[i] < top + 2.5 * h;
  const n = doc.pages.length;
  return (
    <section className={`ddf-col ddf-col--${side}`} aria-label={title}>
      <header className="ddf-col__head">
        <h3>{title}</h3>
        <span>{meta}</span>
      </header>
      <div className="ddf-col__body">
        <div className="ddf-scroll" ref={setScroller} onScroll={onScroll} tabIndex={0}>
          <div className="ddf-pages" style={{ height: geo.total, width: geo.pw + 2 * PAD }}>
            {doc.pages.map((_, i) => (
              <Page key={i} n={i + 1} of={n} top={geo.tops[i]} width={geo.pw} height={geo.hs[i]}
                src={`${ROOT}/${doc.dir}/page-${String(i + 1).padStart(3, '0')}.svg`} live={live(i)} />
            ))}
            {children}
          </div>
        </div>
        {rail}
      </div>
    </section>
  );
}

function Legend({ tags }) {
  return (
    <ul className="ddf-legend" aria-label="Key">
      <li><span className="ddf-key ddf-key--del">struck</span> removed</li>
      <li><span className="ddf-key ddf-key--add">handwritten</span> added or reworded</li>
      <li><span className="ddf-key ddf-key--new" aria-hidden="true" /> new figure or table</li>
      <li><span className="ddf-key ddf-key--gone" aria-hidden="true" /> removed or replaced</li>
      <li><span className="ddf-key ddf-key--bar" aria-hidden="true" /> change bar</li>
      {tags && Object.entries(tags.stages).map(([s, name]) => (
        <li key={s}><span className={`ddf-tag ddf-tag--key ddf-tag--${s}`} aria-hidden="true">{s}</span> {name}</li>
      ))}
      {tags && <li>click a margin tag to flag it</li>}
    </ul>
  );
}

function floatName(f, n = f.number) {
  return `${f.kind === 'figure' ? 'Figure' : 'Table'} ${n}`;
}
// Captions keep a little LaTeX; enough to read in a list.
function plain(s) {
  return s.replace(/\\releasedbaseline(version)?\{\}/g, (_, v) => (v ? 'PSMASegmentator v1.1.0' : 'PSMASegmentator'))
    .replace(/\$\\geq\s*/g, '≥ ').replace(/\$/g, '').replace(/~/g, ' ').replace(/\\[a-z]+\{?|\}/gi, '');
}

/* Every change ID: the flagged ones first, then all of them by tier, each a link to
   its first tag. */
function TagIndex({ tags, flags, toggle, goToTag, copy, copied }) {
  const ids = Object.entries(tags.ids);
  const placed = new Set(tags.placed.map((t) => t.id));
  const order = new Map(tags.placed.map((t, i) => [t.id, i]).reverse());
  const flagged = ids.filter(([id]) => flags.has(id)).sort(([a], [b]) => (order.get(a) ?? 1e9) - (order.get(b) ?? 1e9));
  const row = ([id, t]) => (
    <li key={id} className={flags.has(id) ? 'is-flagged' : ''}>
      <button type="button" className={`ddf-tag ddf-tag--${t.stage}${flags.has(id) ? ' is-flagged' : ''}`}
        aria-pressed={flags.has(id)} title={flags.has(id) ? 'Unflag' : 'Flag'} onClick={() => toggle(id)}>{id}</button>
      {placed.has(id)
        ? <button type="button" className="ddf-idlink" onClick={() => goToTag(id)}>{t.title}</button>
        : <span className="ddf-idtext">{t.title}</span>}
      <span className="ddf-idwords">{t.words ? signed(t.words) : ''}</span>
      {t.in && <span className="ddf-muted ddf-idnote">inside {t.in}</span>}
      {!t.in && !placed.has(id) && <span className="ddf-muted ddf-idnote">not on any page</span>}
    </li>
  );
  return (
    <article className="pt-card ddf-card ddf-card--ids">
      <h3>Change IDs</h3>
      <p>
        {placed.size} of {ids.length} changes are tagged in the margin. Click a tag, there or here, to flag it for
        dropping or a question; flags stay in this browser. A title jumps to the change.
        {tags.source && <span className="ddf-muted"> {tags.source}.</span>}
      </p>
      <h4>Flagged ({flagged.length})</h4>
      {flagged.length ? (
        <>
          <ul className="ddf-ids">{flagged.map(row)}</ul>
          <button type="button" className="ddf-btn" onClick={copy}>{copied ? 'Copied' : 'Copy flagged IDs'}</button>
        </>
      ) : <p className="ddf-muted">None yet.</p>}
      {Object.entries(tags.stages).map(([s, name]) => {
        const these = ids.filter(([, t]) => t.stage === s);
        return (
          <details key={s} className="ddf-idgroup">
            <summary>{name} <span className="ddf-muted">({these.length})</span></summary>
            <ul className="ddf-ids">{these.map(row)}</ul>
          </details>
        );
      })}
    </article>
  );
}

function Notes({ m, children }) {
  const f = m.floats;
  const chk = m.check;
  const ok = chk.original.differences.length === 0 && chk.final.differences.length === 0;
  return (
    <section className="ddf-notes">
      {children}
      <article className="pt-card ddf-card">
        <h3>Check</h3>
        <p className={ok ? 'ddf-ok' : 'ddf-warn'}>
          {ok ? 'Passed. ' : 'Differences found. '}
          The marked-up file was built twice more: with every addition left out and every removal printed
          plainly, it reads as the original PDF ({fmt(chk.original.words)} words, {chk.original.differences.length} differences);
          with every removal left out, as the final PDF ({fmt(chk.final.words)} words, {chk.final.differences.length} differences).
          So every change is marked and nothing else is.
        </p>
        {!ok && (
          <ul className="ddf-list">
            {[...chk.original.differences.map((d) => ['original', d]), ...chk.final.differences.map((d) => ['final', d])]
              .slice(0, 12).map(([k, d], i) => (
                <li key={i}>{k}: …{d.context.slice(-40)} <b>expected</b> “{d.expected}” <b>got</b> “{d.got}”</li>
              ))}
          </ul>
        )}
        <p className="ddf-muted">
          Words are the whole printed text of each PDF, front matter and appendices included, without page
          numbers. Built {new Date(m.built).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' })}.
        </p>
      </article>

      <article className="pt-card ddf-card">
        <h3>Figures and tables</h3>
        <h4>Removed ({f.removed.length})</h4>
        <ul className="ddf-list">
          {f.removed.map((r) => <li key={r.label}><b>{floatName(r)}</b> {plain(r.title)}</li>)}
        </ul>
        <h4>Added ({f.added.length})</h4>
        <ul className="ddf-list">
          {f.added.map((r) => <li key={r.label}><b>{floatName(r)}</b> {plain(r.title)}</li>)}
        </ul>
        {f.moved?.length > 0 && (
          <>
            <h4>Moved ({f.moved.length})</h4>
            <ul className="ddf-list">
              {f.moved.map((r) => <li key={r.label}><b>{floatName(r)} → {r.to}</b> {plain(r.title)}</li>)}
            </ul>
          </>
        )}
        {f.replaced?.length > 0 && (
          <>
            <h4>Rebuilt, old above new ({f.replaced.length})</h4>
            <ul className="ddf-list">
              {f.replaced.map((r) => <li key={r.label}><b>{floatName(r, r.to)}</b> {plain(r.title)}</li>)}
            </ul>
          </>
        )}
        <h4>Redrawn, same file name ({f.changed.length})</h4>
        <ul className="ddf-list">
          {f.changed.map((r) => <li key={r.label}><b>{floatName(r)}</b> {plain(r.title)}</li>)}
        </ul>
      </article>

      <article className="pt-card ddf-card">
        <h3>Reading the edited column</h3>
        <ul className="ddf-list">
          <li>Figure, table and citation numbers are the final ones. A removed figure or table keeps its old number, struck through, and takes no number of its own.</li>
          <li>Page numbers are the marked-up document’s own; the final PDF has {m.edited.final_pages} pages.</li>
          <li>The List of Figures and List of Tables are marked up too, entry by entry.</li>
          {f.replaced?.length > 0 && <li>A table whose rows or columns changed is shown whole: the old one crossed out, then the new one framed.</li>}
          {f.moved?.length > 0 && <li>A moved figure is crossed out where it was and framed as new where it now is.</li>}
          {m.tags && <li>A tag inside a table sits at the table’s top; one between paragraphs sits at the start of the next.</li>}
        </ul>
        <h4>Renumbered ({f.renumbered.length})</h4>
        <ul className="ddf-list ddf-list--tight">
          {f.renumbered.map((r) => <li key={r.label}>{floatName(r, r.from)} → {r.to}</li>)}
        </ul>
        <p className="ddf-muted">
          Built with <code>{m.command ?? 'python tools/dissertation-diff/build.py'}</code>; see its docstring for
          the other comparisons (<code>--new WORKTREE</code> for uncommitted work).
        </p>
      </article>
    </section>
  );
}

function DissertationDiffDev() {
  const [prefs] = useState(loadPrefs);
  const [m, setM] = useState(null);
  const [error, setError] = useState(null);
  const [view, setView] = useState(VIEWS.some((v) => v.id === prefs.view) ? prefs.view : 'both');
  const [zoom, setZoom] = useState(ZOOMS.includes(prefs.zoom) ? prefs.zoom : 1);
  const [sync, setSync] = useState(prefs.sync !== false);
  // The two scrollers: in state so widths re-measure when they mount, and in a ref
  // because scrolling them is a DOM write, not a state change.
  const [scO, setScOState] = useState(null);
  const [scE, setScEState] = useState(null);
  const els = useRef({ original: null, edited: null });
  const setScO = useCallback((el) => { els.current.original = el; setScOState(el); }, []);
  const setScE = useCallback((el) => { els.current.edited = el; setScEState(el); }, []);
  const [scroll, setScroll] = useState({});
  const [flash, setFlash] = useState(-1);
  const [flags, setFlags] = useState(loadFlags);
  const [copied, setCopied] = useState(false);
  const [flashTag, setFlashTag] = useState(null);
  const driver = useRef(null);
  const driverTimer = useRef(0);
  const raf = useRef(0);

  useEffect(() => {
    let off = false;
    fetch(`${ROOT}/manifest.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`manifest.json: HTTP ${r.status}`))))
      .then((j) => !off && setM(j))
      .catch((e) => !off && setError(String(e.message || e)));
    return () => { off = true; };
  }, []);

  useEffect(() => {
    try { localStorage.setItem(PREFS_KEY, JSON.stringify({ view, zoom, sync })); } catch { /* ignore */ }
  }, [view, zoom, sync]);
  useEffect(() => {
    try { localStorage.setItem(FLAGS_KEY, JSON.stringify([...flags])); } catch { /* ignore */ }
  }, [flags]);

  const toggle = useCallback((id) => setFlags((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  }), []);
  // The flagged IDs in page order, as one line to paste into a chat.
  const copy = useCallback(() => {
    if (!m?.tags) return;
    const order = new Map(m.tags.placed.map((t, i) => [t.id, i]).reverse());
    const ids = [...flags].sort((a, b) => (order.get(a) ?? 1e9) - (order.get(b) ?? 1e9));
    navigator.clipboard?.writeText(`Flagged on the red-pen page: ${ids.join(', ')}`)
      .then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); })
      .catch(() => { /* the flagged list stays on the page */ });
  }, [m, flags]);

  const wO = useWidth(scO);
  const wE = useWidth(scE);
  const geoO = useMemo(() => (m && wO ? geometry(m.original.pages, wO, zoom) : null), [m, wO, zoom]);
  const geoE = useMemo(() => (m && wE ? geometry(m.edited.pages, wE, zoom) : null), [m, wE, zoom]);

  // Sync points: (original y, edited y) for every section start the two share.
  const points = useMemo(() => {
    if (!m || !geoO || !geoE) return [];
    const pts = [[0, 0]];
    for (const s of m.sections) {
      const p = [posOf(geoO, s.original.page, s.original.y), posOf(geoE, s.edited.page, s.edited.y)];
      const last = pts[pts.length - 1];
      if (p[0] >= last[0] && p[1] >= last[1]) pts.push(p);
    }
    pts.push([geoO.total, geoE.total]);
    return pts;
  }, [m, geoO, geoE]);

  const changes = useMemo(() => {
    if (!m || !geoE) return [];
    return m.changes.map((c) => ({ ...c, at: posOf(geoE, c.page, c.y), to: posOf(geoE, c.page, c.y1) }));
  }, [m, geoE]);

  // Margin tags: just right of the text block, level with the line each ID landed on,
  // pushed down where two on one page would overlap.
  const tagBoxes = useMemo(() => {
    if (!m?.tags || !geoE) return [];
    const left = PAD + (m.tags.text ? m.tags.text[1] : 0.86) * geoE.pw + Math.max(4, 0.012 * geoE.pw);
    const out = [];
    let floor = -Infinity;
    let page = 0;
    for (const t of m.tags.placed) {
      let top = posOf(geoE, t.page, t.y) - TAG_H + 4;
      if (t.page === page && top < floor + 2) top = floor + 2;
      out.push({ ...t, top, left });
      floor = top + TAG_H;
      page = t.page;
    }
    return out;
  }, [m, geoE]);

  // Where each column is, as (page, fraction of page) at its top, so a zoom, a
  // resize or a column coming back keeps the place rather than the pixel offset.
  const geos = useRef({});
  useLayoutEffect(() => { geos.current = { original: geoO, edited: geoE }; }, [geoO, geoE]);
  const place = useRef({ original: null, edited: null });

  // While we move a column ourselves, its scroll events are not the user's.
  const quiet = useRef(null);
  const quietTimer = useRef(0);
  const hush = useCallback((why, ms = 200) => {
    quiet.current = why;
    clearTimeout(quietTimer.current);
    quietTimer.current = setTimeout(() => { quiet.current = null; }, ms);
  }, []);

  const measure = useCallback(() => {
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => {
      const next = {};
      for (const side of ['original', 'edited']) {
        const el = els.current[side];
        const g = geos.current[side];
        if (!el) continue;
        next[side] = { top: el.scrollTop, h: el.clientHeight };
        if (g && quiet.current !== 'restore') {
          let i = g.tops.findIndex((t, k) => t + g.hs[k] + GAP > el.scrollTop);
          if (i < 0) i = g.tops.length - 1;
          place.current[side] = { i, f: (el.scrollTop - g.tops[i]) / g.hs[i] };
        }
      }
      setScroll(next);
    });
  }, []);

  // Sync maps the reading line (30% down), so both columns start level at the top.
  const follow = useCallback((from) => {
    const me = els.current[from];
    const other = els.current[from === 'edited' ? 'original' : 'edited'];
    if (!me || !other || !points.length) return;
    const c = me.scrollTop + LINE * me.clientHeight;
    const t = from === 'edited' ? interp(points, c, 1, 0) : interp(points, c, 0, 1);
    other.scrollTop = t - LINE * other.clientHeight;
    other.scrollLeft = me.scrollLeft;
  }, [points]);

  const onScroll = (side) => () => {
    if (quiet.current || (driver.current && driver.current !== side)) {
      measure();
      return; // our own move, or the echo of a synced scroll
    }
    driver.current = side;
    clearTimeout(driverTimer.current);
    driverTimer.current = setTimeout(() => { driver.current = null; }, 160);
    if (sync && view === 'both') follow(side);
    measure();
  };

  // A new geometry (zoom, resize) or a column (re)mounting: go back to the same place.
  useLayoutEffect(() => {
    hush('restore');
    for (const side of ['edited', 'original']) {
      const el = els.current[side];
      const g = geos.current[side];
      const p = place.current[side];
      if (el && g && p) el.scrollTop = g.tops[p.i] + p.f * g.hs[p.i];
    }
    if (sync && view === 'both') follow(els.current.edited && place.current.edited ? 'edited' : 'original');
    measure();
  }, [geoO, geoE, scO, scE, view, sync, follow, measure, hush]);

  const line = scroll.edited ? scroll.edited.top + LINE * scroll.edited.h : 0;
  const passed = changes.filter((c) => c.at <= line + 2).length;

  // Bring the viewer up under the portal's top bar when it is still low on the screen.
  const viewer = useRef(null);
  const raise = useCallback(() => {
    const v = viewer.current;
    if (v && v.getBoundingClientRect().top > 0.4 * window.innerHeight) v.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, []);

  // Repeated Next / Prev while a smooth scroll is still running count on from the last target.
  const target = useRef({ i: -1, t: 0 });
  const goTo = useCallback((i) => {
    const e = els.current.edited;
    if (!e || !changes[i]) return;
    target.current = { i, t: Date.now() };
    e.scrollTo({ top: changes[i].at - LINE * e.clientHeight, behavior: 'smooth' });
    setFlash(i);
  }, [changes]);
  const recent = useCallback(() => Date.now() - target.current.t < 700 && target.current.i >= 0, []);
  const next = useCallback(() => {
    raise();
    const i = recent() ? target.current.i + 1 : changes.findIndex((c) => c.at > line + 4);
    if (i >= 0 && i < changes.length) goTo(i);
  }, [changes, line, goTo, raise, recent]);
  const prev = useCallback(() => {
    raise();
    let i = -1;
    if (recent()) i = target.current.i - 1;
    else changes.forEach((c, k) => { if (c.at < line - 4) i = k; });
    if (i >= 0) goTo(i);
  }, [changes, line, goTo, raise, recent]);

  useEffect(() => {
    if (flash < 0) return undefined;
    const t = setTimeout(() => setFlash(-1), 1800);
    return () => clearTimeout(t);
  }, [flash]);

  // From the ID list: the edited column to the first tag of an ID.
  const goToTag = useCallback((id) => {
    const e = els.current.edited;
    const t = tagBoxes.find((b) => b.id === id);
    if (!t) return;
    if (!e) { setView('both'); return; }
    raise();
    e.scrollTo({ top: t.top - LINE * e.clientHeight, behavior: 'smooth' });
    setFlashTag(id);
  }, [tagBoxes, raise]);
  useEffect(() => {
    if (!flashTag) return undefined;
    const t = setTimeout(() => setFlashTag(null), 1800);
    return () => clearTimeout(t);
  }, [flashTag]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest?.('input, select, textarea, [contenteditable]') || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'j' || e.key === ']') { e.preventDefault(); next(); }
      if (e.key === 'k' || e.key === '[') { e.preventDefault(); prev(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, prev]);

  // The section the edited column (or the original, if that is all that shows) is in.
  const lead = view === 'original' ? 'original' : 'edited';
  const leadGeo = lead === 'edited' ? geoE : geoO;
  const leadScroll = scroll[lead];
  const current = useMemo(() => {
    if (!m || !leadGeo || !leadScroll) return -1;
    const y = leadScroll.top + 60;
    let k = -1;
    m.sections.forEach((s, i) => { if (secPos(leadGeo, s[lead]) <= y) k = i; });
    return k;
  }, [m, leadGeo, leadScroll, lead]);

  // Both columns to a section.
  const jump = (i) => {
    const s = m.sections[i];
    raise();
    hush('jump');
    const { original: o, edited: e } = els.current;
    if (o && geoO) o.scrollTop = secPos(geoO, s.original) - 24;
    if (e && geoE) e.scrollTop = secPos(geoE, s.edited) - 24;
    measure();
  };

  if (error) return <NotBuilt error={error} />;
  if (!m) return <div className="pt-module ddf"><p className="ddf-muted">Loading the page renders…</p></div>;

  const f = m.floats;
  const P = { ...DEFAULT_PAGE, ...(m.page || {}) };
  const tagged = m.tags ? new Set(m.tags.placed.map((t) => t.id)).size : 0;
  const okCheck = m.check.original.differences.length === 0 && m.check.final.differences.length === 0;
  const showO = view !== 'edited';
  const showE = view !== 'original';

  const rail = geoE && scroll.edited && (
    <div className="ddf-rail" aria-label="Where the changes are">
      <span className="ddf-rail__view"
        style={{ top: `${(100 * scroll.edited.top) / geoE.total}%`, height: `${(100 * scroll.edited.h) / geoE.total}%` }} />
      {changes.map((c, i) => (
        <button key={i} type="button" className={`ddf-rail__tick${i === passed - 1 ? ' is-current' : ''}`}
          style={{ top: `${(100 * c.at) / geoE.total}%` }} onClick={() => goTo(i)}
          title={`Change ${i + 1} of ${changes.length}, page ${c.page}`} aria-label={`Change ${i + 1}, page ${c.page}`} />
      ))}
    </div>
  );

  // Change bars in the left gutter, like a word processor's, for the pages near the view.
  const near = (y) => !scroll.edited || (y > scroll.edited.top - 2 * scroll.edited.h && y < scroll.edited.top + 3 * scroll.edited.h);
  // A mark is the baseline of the first changed text, so a bar starts a cap height above it.
  const pt = geoE ? geoE.pw / m.edited.pages[0][0] : 1;
  const bars = geoE && changes.map((c, i) => near(c.at) && (
    <span key={i} className={`ddf-cbar${flash === i ? ' is-flash' : ''}`} aria-hidden="true"
      style={{ top: c.at - 10 * pt, height: c.to - c.at + 13 * pt, left: PAD - 10 }} />
  ));
  const chips = tagBoxes.map((t, i) => {
    const on = flags.has(t.id);
    return (
      <button key={`${t.id}-${i}`} type="button" style={{ top: t.top, left: t.left }}
        className={`ddf-tag ddf-tag--page ddf-tag--${m.tags.ids[t.id]?.stage ?? 'x'}${on ? ' is-flagged' : ''}${flashTag === t.id ? ' is-flash' : ''}`}
        title={tagTip(t.id, m.tags.ids[t.id], m.tags.stages)} aria-pressed={on} onClick={() => toggle(t.id)}>
        {t.id}
      </button>
    );
  });

  return (
    <div className="pt-module ddf">
      <header className="ddf-head">
        <div>
          <p className="ddf-kicker">{P.kicker}</p>
          <h2 className="ddf-title">{P.title}</h2>
          <p className="pt-module__intro">{P.intro}</p>
        </div>
        <dl className="ddf-stats">
          <div><dt>Original</dt><dd>{m.original.pages.length} pages</dd></div>
          <div><dt>Final</dt><dd>{m.edited.final_pages} pages</dd></div>
          <div><dt>Changes</dt><dd>{changes.length || m.changes.length}</dd></div>
          {m.tags && <div><dt>Change IDs</dt><dd>{tagged} tagged · {flags.size} flagged</dd></div>}
          <div><dt>Floats</dt><dd>
            {f.removed.length} removed · {f.added.length} added · {f.changed.length} redrawn
            {f.moved?.length > 0 && ` · ${f.moved.length} moved`}
            {f.replaced?.length > 0 && ` · ${f.replaced.length} rebuilt`}
          </dd></div>
          <div><dt>Check</dt><dd className={okCheck ? 'ddf-ok' : 'ddf-warn'}>{okCheck ? 'both readings match' : 'differences found'}</dd></div>
        </dl>
      </header>

      <div className="ddf-viewer" ref={viewer}>
        <div className="ddf-bar-wrap" role="toolbar" aria-label="Red pen view">
          <div className="ddf-seg" role="group" aria-label="Columns">
            {VIEWS.map((v) => (
              <button key={v.id} type="button" className={view === v.id ? 'is-active' : ''} aria-pressed={view === v.id}
                onClick={() => setView(v.id)}>{v.label}</button>
            ))}
          </div>
          <label className="ddf-pick">
            <span>Go to</span>
            <select value={current} onChange={(e) => jump(Number(e.target.value))}>
              {current < 0 && <option value={-1}>Front matter</option>}
              {m.sections.map((s, i) => (
                <option key={i} value={i}>
                  {{ chapter: '', section: '\u2003', subsection: '\u2003\u2003' }[s.level]}
                  {s.number ? `${s.number} ` : ''}{s.title}
                </option>
              ))}
            </select>
          </label>
          <div className="ddf-seg" role="group" aria-label="Changes">
            <button type="button" onClick={prev} disabled={!showE} title="Previous change (k)">‹ Prev</button>
            <span className="ddf-seg__count" aria-live="polite">{passed} / {changes.length}</span>
            <button type="button" onClick={next} disabled={!showE} title="Next change (j)">Next ›</button>
          </div>
          <div className="ddf-seg" role="group" aria-label="Zoom">
            {ZOOMS.map((z) => (
              <button key={z} type="button" className={zoom === z ? 'is-active' : ''} aria-pressed={zoom === z}
                onClick={() => setZoom(z)}>{z === 1 ? 'Fit' : `${Math.round(z * 100)}%`}</button>
            ))}
          </div>
          <label className="ddf-toggle">
            <input type="checkbox" checked={sync} disabled={view !== 'both'} onChange={(e) => setSync(e.target.checked)} />
            Sync scroll
          </label>
          {m.tags && (
            <div className="ddf-seg" role="group" aria-label="Flagged changes">
              <span className="ddf-seg__count ddf-seg__count--flags">{flags.size} flagged</span>
              <button type="button" onClick={copy} disabled={!flags.size} title="Copy the flagged IDs to the clipboard">
                {copied ? 'Copied' : 'Copy IDs'}
              </button>
            </div>
          )}
          <span className="ddf-pdfs">
            PDF: <a href={`${ROOT}/${m.original.pdf}`} target="_blank" rel="noreferrer">original</a>
            {' · '}<a href={`${ROOT}/${m.edited.pdf}`} target="_blank" rel="noreferrer">marked up</a>
            {' · '}<a href={`${ROOT}/${m.edited.final_pdf}`} target="_blank" rel="noreferrer">final</a>
          </span>
        </div>
        <Legend tags={m.tags} />

        <div className={`ddf-cols ddf-cols--${view}`}>
          {showO && (
            <Column side="original" title="Original" meta={`${P.original} · ${sourceLabel(m.original.source)}`}
              doc={m.original} geo={geoO || geometry(m.original.pages, 800, 1)} setScroller={setScO}
              onScroll={onScroll('original')} scroll={scroll.original} />
          )}
          {showE && (
            <Column side="edited" title="Edited, in red pen" meta={`${P.edited} · ${sourceLabel(m.edited.source)}`}
              doc={m.edited} geo={geoE || geometry(m.edited.pages, 800, 1)} setScroller={setScE}
              onScroll={onScroll('edited')} scroll={scroll.edited} rail={rail}>
              {bars}
              {chips}
            </Column>
          )}
        </div>
      </div>

      <Notes m={m}>
        {m.tags && <TagIndex tags={m.tags} flags={flags} toggle={toggle} goToTag={goToTag} copy={copy} copied={copied} />}
      </Notes>
    </div>
  );
}
