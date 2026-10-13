import { useEffect, useState } from 'react';
import { BRIEF, CAPTIONS, OPTIONS, RECOMMENDATION, CHOSEN } from './qualitative-options';
import './Fig47Qualitative.css';

/* ============================================================================
   FIG 4.7 · QUALITATIVE EXAMPLES — three options for one print figure
   ----------------------------------------------------------------------------
   Figure 4.7 of the CITS4010 dissertation (fig:results-qualitative-examples),
   built three ways from captures of the real Mamba PSMA app. Shown on the same
   page as Figure 3.3 (Fig34Architecture.jsx switches between the two).

   The renders show patient scans, so nothing scan-derived is imported: the
   PNGs and data.json load from the dev server's local-only route
   (/__psma-motion-data/qualitative-figure/, vite.config.js localData), and a
   production build shows the "local only" notice instead.

   Views: on the page (a mock A4 sheet with the cshonours text block and the
   draft caption beneath), the dissertation page (a scratch build of the real
   dissertation with the option in place, 110 dpi), true size and zoom 2x; a
   greyscale toggle (pdftoppm -gray renders, not a CSS filter); a compare view.
   Words, critic verdicts and scores live in ./qualitative-options.js.
   ========================================================================== */

const DATA = '/__psma-motion-data/qualitative-figure/';
// A4 and the cshonours.cls text block, in mm (as Fig34Architecture.jsx).
const PAGE = { w: 210, h: 297, left: 36.3, top: 45.4, textW: 144.6, textH: 208.0 };
const pct = (mm, of) => `${(100 * mm) / of}%`;
const MODES = [
  { id: 'page', label: 'On the page' },
  { id: 'diss', label: 'Dissertation page' },
  { id: 'true', label: 'True size' },
  { id: 'zoom', label: 'Zoom 2x' },
];
const pctNum = (x) => (x == null ? '–' : `${(100 * x).toFixed(1)}%`);
const short = (h) => (h ? `${h.slice(0, 12)}…` : '–');

export default function Fig47Qualitative() {
  if (!import.meta.env.DEV) return <LocalOnly />;
  return <Fig47Dev />;
}

function LocalOnly() {
  return (
    <div className="pt-module f34 f47">
      <section className="pt-card f47-notice">
        <h2>Figure 4.7 · local only</h2>
        <p>
          These figure options show patient PET/CT scans from the autoPET-III and DEEP-PSMA datasets. The scan
          data stays on the PC that built them: it is served by the development server only and is never bundled
          or deployed. Run <code>npm run dev</code> on that PC and open <code>/portal/fig34-architecture</code>,
          then pick Figure 4.7.
        </p>
      </section>
    </div>
  );
}

function useData() {
  const [state, setState] = useState({ data: null, error: null });
  useEffect(() => {
    let live = true;
    fetch(`${DATA}data.json`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data) => live && setState({ data, error: null }))
      .catch((error) => live && setState({ data: null, error }));
    return () => { live = false; };
  }, []);
  return state;
}

function Figure({ opt, files, mode, grey }) {
  const src = DATA + (grey ? files.grey : files.figure);
  const alt = `Figure 4.7, option ${opt.id}: ${opt.name}`;
  if (mode === 'page') {
    return (
      <div className="f34-sheet" role="img" aria-label={`${alt}, shown on an A4 page`}>
        <div
          className="f34-sheet__block"
          style={{ left: pct(PAGE.left, PAGE.w), top: pct(PAGE.top, PAGE.h), width: pct(PAGE.textW, PAGE.w) }}
        >
          <img src={src} alt="" className="f34-sheet__fig" />
          <p className="f34-sheet__cap">Figure 4.7: {CAPTIONS[opt.id].text}</p>
        </div>
        <span
          className="f34-sheet__frame"
          style={{
            left: pct(PAGE.left, PAGE.w), top: pct(PAGE.top, PAGE.h),
            width: pct(PAGE.textW, PAGE.w), height: pct(PAGE.textH, PAGE.h),
          }}
          aria-hidden="true"
        />
      </div>
    );
  }
  if (mode === 'diss') {
    return (
      <div className={`f47-diss ${grey ? 'f47-grey' : ''}`}>
        <img src={DATA + files.page} alt={`${alt}, on page 48 of a scratch build of the dissertation`} />
      </div>
    );
  }
  const width = mode === 'zoom' ? `${2 * PAGE.textW}mm` : `${PAGE.textW}mm`;
  return (
    <div className="f34-scroll">
      <div className="f34-paper">
        <img src={src} alt={alt} style={{ width }} className="f34-paper__fig" />
      </div>
    </div>
  );
}

function Scorecard({ opt, info }) {
  const s = opt.score;
  return (
    <dl className="f34-score">
      <div><dt>Must-fixes</dt><dd>{s.mustFix}</dd></div>
      <div><dt>Blind quiz</dt><dd>{s.quiz}</dd></div>
      <div><dt>Design rank</dt><dd>{s.rank} of 3</dd></div>
      {s.design && <div><dt>Clarity · polish · examiner stop</dt><dd>{s.design.join(' · ')}</dd></div>}
      <div><dt>Height</dt><dd>{info ? `${info.heightMm.toFixed(1)} mm` : '–'}</dd></div>
      <div><dt>Caption</dt><dd>{CAPTIONS[opt.id].words} words</dd></div>
      <div><dt>Smallest text</dt><dd>{s.minPt} pt</dd></div>
      <div><dt>MIP pixels print at</dt><dd>{info ? `${info.mipDpi} dpi` : '–'}</dd></div>
    </dl>
  );
}

function OptionDetail({ opt, info }) {
  return (
    <article className="f34-detail pt-card">
      <header className="f34-detail__head">
        <span className="f34-badge">{opt.id}</span>
        <div>
          <h3 className="f34-detail__title">
            {opt.name}
            {CHOSEN === opt.id && <span className="f34-chosen">chosen</span>}
          </h3>
          <p className="f34-detail__concept">{opt.concept}</p>
          <p className="f47-view"><span>App view:</span> {opt.view}</p>
        </div>
      </header>
      <Scorecard opt={opt} info={info} />
      {opt.score.mainPoint && (
        <p className="f34-detail__main"><span>Blind reader, ten-second main point:</span> “{opt.score.mainPoint}”</p>
      )}
      <div className="f34-detail__cols">
        <section>
          <h4>Strengths</h4>
          <ul>{opt.strengths.map((t) => <li key={t}>{t}</li>)}</ul>
        </section>
        <section>
          <h4>Weaknesses</h4>
          <ul>{opt.weaknesses.map((t) => <li key={t}>{t}</li>)}</ul>
        </section>
      </div>
      <section>
        <h4>Greyscale and colour-blind check</h4>
        <p className="f47-para">{opt.greyscale}</p>
      </section>
      <section>
        <h4>Critic verdicts</h4>
        <ul className="f34-verdicts">{opt.verdicts.map((v) => <li key={v.who}><b>{v.who}:</b> {v.text}</li>)}</ul>
      </section>
      <section>
        <h4>Draft caption ({CAPTIONS[opt.id].words} words)</h4>
        <p className="f47-para f47-caption">{CAPTIONS[opt.id].text}</p>
      </section>
      {info && (
        <p className="f34-detail__links">
          <a href={DATA + info.files.figure} target="_blank" rel="noreferrer">Figure PNG (200 dpi)</a>
          <a href={DATA + info.files.grey} target="_blank" rel="noreferrer">Greyscale PNG</a>
          <a href={DATA + info.files.page} target="_blank" rel="noreferrer">Dissertation page</a>
          <span>PDF (not served): <code>{info.pdf}</code></span>
          <span>Layout: <code>{opt.source}</code></span>
        </p>
      )}
    </article>
  );
}

function Cases({ data }) {
  const e = data.panelE;
  return (
    <section className="pt-card f47-card">
      <h3>Cases</h3>
      <p className="f47-para">
        Picked by <code>select_cases.py</code> from the run of record,{' '}
        <code>run5-test/ensemble/ensemble5_test_threshold_sweep_per_case.csv</code> (threshold 0.5, 10-voxel
        filter, no expansion, no splitting), before any image was viewed; every pick asserted to be in{' '}
        <code>splits/test.json</code>. (a), (b) and (d) reproduce the 6 October plan; (c) became the best case
        on 13 October at James’s request (it was the lowest F1, which Options B and C still show). Titles quote the
        CSV (2 mm working grid); the app scores each scan on its own PET grid, so its overlay can differ (marked ≠).
      </p>
      <div className="f47-tablewrap">
        <table className="f47-table">
          <thead>
            <tr>
              <th>Panel</th><th>Case</th><th>Rule</th><th>CSV: F1 · found · false alarms</th>
              <th>App: F1 · found · false alarms</th><th>Ties and defaults</th>
            </tr>
          </thead>
          <tbody>
            {data.cases.map((c) => {
              const diff = c.csv.tp !== c.app.tp || c.csv.fp !== c.app.fp || c.csv.fn !== c.app.fn;
              return (
                <tr key={c.panel}>
                  <td>({c.panel})</td>
                  <td><b>{c.shortId}</b><br /><code>{c.caseId}</code><br />{c.cohort}</td>
                  <td>{c.rule}</td>
                  <td>{pctNum(c.csv.f1)} · {c.csv.tp} of {c.csv.nGt} · {c.csv.fp}</td>
                  <td>{pctNum(c.app.f1)} · {c.app.tp} of {c.app.nGt} · {c.app.fp}{diff && <span className="f47-ne"> ≠</span>}</td>
                  <td>{TIES[c.panel]}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <h4>Panel (e): not built</h4>
      <p className="f47-para">
        Rule: the DEEP-PSMA test case with the largest per-case F1 fall from run 4 to the large-patch hybrid.
        Pick: <code>{e.caseId}</code>, run 4 {pctNum(e.run4F1)} to {pctNum(e.run6F1)} (a fall of{' '}
        {(100 * e.fall).toFixed(1)} points; next {e.next.map((n) => `${n.case_id} ${(100 * n.fall).toFixed(1)}`).join(', ')}).
        Run 6’s weights and predictions exist only on DEMETER, so the app cannot draw it here. Every option is laid
        out to take a fifth column; the handover lists the files to copy, or the edits to drop (e).
      </p>
    </section>
  );
}

const TIES = {
  a: 'None at the median (0.833 over 93 with a defined F1); 9 lesion-positive autoPET-III scans with no lesion found are excluded.',
  b: 'The 20-case median falls between deeppsma_0004 (0.8596) and deeppsma_0018 (0.8611); lower median taken.',
  c: 'Ten test scans score F1 100%; the one with the most lesions (9; next psma_9baf4ca6321e66ad_2016-12-16 with 7). Until 13 October (c) was the lowest F1, psma_37328a98c70706f3_2020-11-06.',
  d: 'No tie (next: 4 components).',
};

function Provenance({ data }) {
  return (
    <section className="pt-card f47-card">
      <h3>Provenance</h3>
      <div className="f34-detail__cols">
        <section>
          <h4>Real (the app’s pixels)</h4>
          <ul>
            <li>Viewer images pulled byte for byte from the viewer’s <code>&lt;img&gt;</code> (<code>#mp_spin</code>, <code>#mp_frame</code>): the PNG the app encoded.</li>
            <li>Option C (a): a screenshot of the running app at device scale 2.</li>
            <li>All {data.captures.filter((c) => c.identical != null).length} viewer captures re-rendered with <code>gui/viz.py</code>: {data.captures.every((c) => c.identical !== false) ? 'identical, pixel for pixel' : 'NOT all identical'}.</li>
            <li>Cropping and ×8 nearest-neighbour upscaling only.</li>
          </ul>
        </section>
        <section>
          <h4>Drawn (LaTeX, around the captures)</h4>
          <ul>
            <li>Panel titles (CSV numbers), short ids, R/L markers, grey frames.</li>
            <li>Legend in the app’s exact RGB (<code>OVERLAY_PALETTES</code>), scale bars (the app’s MIP is 4 mm per pixel).</li>
            <li>R/L checked from organ maps: liver at {data.orientation.map((o) => o.liverSide.toFixed(2)).join(', ')} of the body span (viewer’s left), spleen opposite.</li>
          </ul>
        </section>
      </div>
      <p className="f47-para">
        App commit <code>{data.appCommit.slice(0, 7)}</code>
        {data.appCodeDiffers.length
          ? <> (untracked beside it: <code>{data.appCodeDiffers.map((s) => s.replace(/^\?\?\s*/, '')).join(', ')}</code>, not code)</>
          : ' (clean)'}.
        Runs made for the figure through the app’s Run model at the protocol settings: {data.cases.filter((c) => c.run && !c.run.existing).map((c) => `(${c.panel}) ${c.run.status ? c.run.status.replace(/\s+/g, ' ').replace('check ', '') : ''}`).join(', ')}; (a) and (c) reused saved protocol runs. Built {data.generated}.
      </p>
      <details className="f47-details">
        <summary>Capture hashes ({data.captures.length})</summary>
        <div className="f47-tablewrap">
          <table className="f47-table f47-table--small">
            <thead><tr><th>Capture</th><th>Case</th><th>Size</th><th>View</th><th>SHA-256</th></tr></thead>
            <tbody>
              {data.captures.map((c) => (
                <tr key={c.id}>
                  <td><code>{c.id}</code></td>
                  <td>{c.case.slice(0, 13)}</td>
                  <td>{c.px.join(' × ')}</td>
                  <td>{[c.view.display, c.view.image, c.view.pet_cmap, c.view.suv_range && `SUV ${c.view.suv_range.join('–')}`, c.view.slice_label].filter(Boolean).join(' · ')}</td>
                  <td title={c.sha256}><code>{short(c.sha256)}</code></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}

function Fig47Dev() {
  const { data, error } = useData();
  const [sel, setSel] = useState(CHOSEN || RECOMMENDATION.id);
  const [mode, setMode] = useState('page');
  const [grey, setGrey] = useState(false);
  const [compare, setCompare] = useState(false);
  const [pair, setPair] = useState(['A', 'B']);
  const byId = Object.fromEntries(OPTIONS.map((o) => [o.id, o]));
  const opt = byId[sel];

  return (
    <div className="pt-module f34 f47">
      <header>
        <p className="f34-kicker">CITS4010 · dissertation · Chapter 4</p>
        <h2 className="f34-title">Figure 4.7: qualitative examples from the test set</h2>
        <p className="pt-module__intro">
          Three designs of the same figure, each built from the real Mamba PSMA app and compiled to the PDF that
          would print. Pick one; the handover says how to place it.
        </p>
      </header>

      <section className="f34-brief pt-card">
        <h3>The brief</h3>
        <ol>{BRIEF.points.map((p) => <li key={p}>{p}</li>)}</ol>
        <p className="f34-brief__rule">{BRIEF.rule}</p>
      </section>

      {error && (
        <section className="pt-card f47-notice">
          <h3>No figure data</h3>
          <p>
            <code>motion-data/qualitative-figure/data.json</code> did not load ({String(error.message || error)}).
            Run <code>Mamba_PSMA/scripts/thesis_figures/qualitative_examples/export_portal.py</code>.
          </p>
        </section>
      )}

      <div className="f34-bar" role="toolbar" aria-label="Figure options">
        <div className="f34-seg" role="group" aria-label="Option">
          {OPTIONS.map((o) => (
            <button
              key={o.id}
              type="button"
              className={!compare && sel === o.id ? 'is-active' : ''}
              aria-pressed={!compare && sel === o.id}
              onClick={() => { setSel(o.id); setCompare(false); }}
              title={o.name}
            >
              {o.id}
            </button>
          ))}
          <button type="button" className={compare ? 'is-active' : ''} aria-pressed={compare} onClick={() => setCompare(true)}>
            Compare
          </button>
        </div>
        {!compare && (
          <div className="f34-seg" role="group" aria-label="View">
            {MODES.map((m) => (
              <button key={m.id} type="button" className={mode === m.id ? 'is-active' : ''} aria-pressed={mode === m.id}
                onClick={() => setMode(m.id)}>
                {m.label}
              </button>
            ))}
          </div>
        )}
        <label className="f34-toggle">
          <input type="checkbox" checked={grey} onChange={(e) => setGrey(e.target.checked)} />
          Greyscale
        </label>
      </div>

      {data && (compare ? (
        <section className="f34-compare">
          {[0, 1].map((i) => {
            const o = byId[pair[i]];
            return (
              <div key={i} className="f34-compare__col">
                <label className="f34-compare__pick">
                  <span>Option</span>
                  <select
                    value={pair[i]}
                    onChange={(e) => setPair((p) => (i === 0 ? [e.target.value, p[1]] : [p[0], e.target.value]))}
                  >
                    {OPTIONS.map((x) => <option key={x.id} value={x.id}>{x.id} · {x.name}</option>)}
                  </select>
                </label>
                <Figure opt={o} files={data.options[o.id].files} mode="page" grey={grey} />
                <Scorecard opt={o} info={data.options[o.id]} />
                <p className="f34-compare__concept">{o.concept}</p>
              </div>
            );
          })}
        </section>
      ) : (
        <>
          <p className="f34-caption-note">
            Option {opt.id} · {opt.name} · {MODES.find((m) => m.id === mode).label.toLowerCase()}
            {mode === 'true' && ' (144.6 mm wide, as printed; depends on your screen reporting its size correctly)'}
            {mode === 'diss' && ' (page 48 of a scratch build with this option in place, 110 dpi)'}
          </p>
          <Figure opt={opt} files={data.options[opt.id].files} mode={mode} grey={grey} />
          <OptionDetail opt={opt} info={data.options[opt.id]} />
        </>
      ))}

      {data && <Cases data={data} />}
      {data && <Provenance data={data} />}

      <section className="f34-reco pt-card">
        <h3>Claude’s recommendation <span>(James decides)</span></h3>
        <p className="f34-reco__pick">Option {RECOMMENDATION.id}: {byId[RECOMMENDATION.id].name}</p>
        <ul>{RECOMMENDATION.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
        {RECOMMENDATION.note && <p className="f34-reco__note">{RECOMMENDATION.note}</p>}
      </section>
    </div>
  );
}
