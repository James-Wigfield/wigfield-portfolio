import { useCallback, useEffect, useMemo, useState } from 'react';
import './AbstractOptions.css';

/* ============================================================================
   DISSERTATION · RED PEN — "Abstract options" tab
   ----------------------------------------------------------------------------
   Five candidate abstracts for the dissertation, on one scale from
   conservative to experimental, with everything the overnight agents found:
   the rendered abstract page from the real LaTeX build, both word counts
   against the 300 ceiling, a source view (each sentence's fact IDs and files),
   the accuracy verdicts, and four critics' sentence-by-sentence readings with
   their engagement and trust drawn as a small strip. James picks; notes and
   the pick stay in this browser.

   Data: dissertation-diff-data/abstract-options/abstracts.json and the page
   SVGs, written by tools/dissertation-diff/abstract_data.py from the
   dissertation repo's working folder. Gitignored and served by the dev server
   only, so no abstract text is ever bundled (the module shows its "local only"
   notice in production).

   Route: /portal/dissertation-red-pen/abstract-options[/<n>] (the parent
   DissertationDiff.jsx owns the tab bar and the switch).
   ========================================================================== */

const ROOT = '/__dissertation-diff';
const NOTES_KEY = 'portal:dissertationDiff:abstractNotes';

function loadNotes() {
  try {
    const j = JSON.parse(localStorage.getItem(NOTES_KEY)) || {};
    return { pick: j.pick || null, notes: j.notes || {} };
  } catch {
    return { pick: null, notes: {} };
  }
}

const fmtScore = (s) => (s == null ? '–' : Number.isInteger(s) ? String(s) : s.toFixed(1));
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

function copyText(text, done) {
  if (!navigator.clipboard?.writeText) return;
  navigator.clipboard.writeText(text).then(done).catch(() => { /* stays on the page */ });
}

function useCopied() {
  const [copied, setCopied] = useState('');
  const flash = useCallback((what) => { setCopied(what); setTimeout(() => setCopied(''), 1500); }, []);
  return [copied, flash];
}

/* ---------- small pieces ---------- */

function Status({ status, children }) {
  const cls = status === 'ok' ? 'abo-status--ok' : status === 'open' ? 'abo-status--open' : 'abo-status--na';
  return <span className={`abo-status ${cls}`}>{children}</span>;
}

function accuracyStatus(acc) {
  if (!acc || !acc.data) return { status: 'na', label: 'not checked' };
  const open = (acc.open || []).length;
  return open ? { status: 'open', label: `${open} open` } : { status: 'ok', label: 'clear' };
}

function Counts({ words, ceiling }) {
  const rows = [['printed', words.printed], ['texcount', words.texcount], ['of record', words.record]];
  return (
    <div className="abo-counts" aria-label="Word counts">
      {rows.map(([k, v]) => (
        <div key={k} className="abo-count">
          <span className="abo-count__label">{k}</span>
          <span className="abo-count__bar" role="img" aria-label={`${v} of ${ceiling} words`}>
            <span className={`abo-count__fill${v > ceiling ? ' is-over' : ''}`} style={{ width: `${Math.min(100, (100 * v) / ceiling)}%` }} />
          </span>
          <span className="abo-count__n">{v} / {ceiling}</span>
        </div>
      ))}
    </div>
  );
}

/* The abstract as prose. A sentence shows its facts on hover or click. */
function Prose({ o, openSent, setOpenSent, marks }) {
  const byPara = useMemo(() => {
    const out = o.paragraphs.map(() => []);
    o.sentences.forEach((s) => out[s.p].push(s));
    return out;
  }, [o]);
  return (
    <div className="abo-prose" data-option={o.id}>
      {byPara.map((sents, pi) => (
        <p key={pi}>
          {sents.map((s, k) => {
            const has = s.facts.length > 0;
            const cls = ['abo-sent', has ? '' : 'abo-sent--nofact', openSent === s.i ? 'is-open' : '',
              marks.best.has(s.i) ? 'is-best' : '', marks.weak.has(s.i) ? 'is-weak' : ''].filter(Boolean).join(' ');
            return (
              <span key={s.i}>
                <span className={cls} role={has ? 'button' : undefined} tabIndex={has ? 0 : undefined}
                  title={has ? `Sentence ${s.i}: ${s.facts.join(', ')}` : `Sentence ${s.i}: no project fact`}
                  onMouseEnter={() => setOpenSent(s.i, true)} onMouseLeave={() => setOpenSent(s.i, false)}
                  onClick={() => setOpenSent(s.i)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpenSent(s.i); } }}>
                  {s.text}
                </span>
                {k < sents.length - 1 ? ' ' : ''}
              </span>
            );
          })}
        </p>
      ))}
    </div>
  );
}

function SourceView({ o, facts, sent }) {
  const s = o.sentences.find((x) => x.i === sent);
  if (!s) return <p className="abo-src__none">Hover or click a sentence to see the facts behind it, with their source files.</p>;
  return (
    <div>
      <p className="abo-src__sent"><b>Sentence {s.i}.</b> {s.text}</p>
      {s.facts.length === 0 ? <p className="abo-src__none">No project fact: a device or a connective sentence.</p> : (
        <ul>
          {s.facts.map((fid) => {
            const f = facts[fid];
            return (
              <li key={fid}>
                <span className="abo-fid">{fid}</span>
                <span>
                  <span className="abo-src__fact">{f ? f.fact : 'not in facts.md'}</span>
                  {f && f.source && <><br /><span className="abo-src__where">{f.source}</span></>}
                  {f && f.where && <><br /><span className="abo-src__where">{f.where}</span></>}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {s.note && s.note !== s.facts.join(', ') && <p className="abo-src__where" style={{ marginTop: '0.5rem' }}>{s.note}</p>}
    </div>
  );
}

function Accuracy({ acc }) {
  if (!acc || !acc.data) return <p className="abo-src__none">No accuracy data for this option.</p>;
  const row = (label, r) => (
    <div className="abo-acc__row" key={label}>
      <dt>{label}</dt>
      <dd>
        {r ? (
          <>
            <Status status={r.open ? 'open' : 'ok'}>{r.open ? `${r.open} open` : 'clear'}</Status>
            <span className="abo-acc__counts">
              {r.mustFix ?? 0} must-fix · {r.shouldFix ?? 0} should-fix · {r.nit ?? 0} nit{r.applied != null ? ` · ${r.applied} applied` : ''}
            </span>
            {r.summary && <p style={{ margin: '0.3rem 0 0', fontSize: '0.84rem' }}>{r.summary}</p>}
          </>
        ) : <Status status="na">not run</Status>}
      </dd>
    </div>
  );
  return (
    <dl className="abo-acc">
      {row('Data agent', acc.data)}
      {row('Claims agent', acc.claims)}
      {row('Re-check', acc.recheck)}
      <div className="abo-acc__row">
        <dt>Still open</dt>
        <dd>
          {(acc.open || []).length === 0 ? <span className="abo-note-ok">Nothing open.</span> : (
            <ul>{acc.open.map((x, i) => <li key={i}>{x}</li>)}</ul>
          )}
        </dd>
      </div>
      {acc.unverified?.length > 0 && (
        <div className="abo-acc__row">
          <dt>Unverified</dt>
          <dd><ul>{acc.unverified.map((x, i) => <li key={i}>{x}</li>)}</ul></dd>
        </div>
      )}
    </dl>
  );
}

/* The reading strip: engagement and trust across the sentences, one point per sentence. */
function Strip({ log, onPick, picked }) {
  const [hover, setHover] = useState(-1);
  const n = log.length;
  if (!n) return null;
  const W = 320; const H = 84; const L = 18; const R = 30; const T = 8; const B = 16;
  const x = (i) => L + ((W - L - R) * i) / Math.max(1, n - 1);
  const y = (v) => T + ((H - T - B) * (5 - v)) / 4;
  const pts = (key) => log.map((e, i) => `${x(i).toFixed(1)},${y(e[key]).toFixed(1)}`).join(' ');
  const cur = hover >= 0 ? hover : picked >= 0 ? picked : -1;
  const e = cur >= 0 ? log[cur] : null;
  return (
    <div className="abo-strip">
      <div className="abo-strip__legend"><span className="is-eng">engagement</span><span className="is-tru">trust</span><span>1 to 5, by sentence</span></div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Engagement and trust by sentence">
        {[1, 3, 5].map((v) => <line key={v} className="grid" x1={L} x2={W - R} y1={y(v)} y2={y(v)} />)}
        {[1, 3, 5].map((v) => <text key={v} className="axis-label" x={L - 4} y={y(v) + 3} textAnchor="end">{v}</text>)}
        <polyline className="ln-eng" points={pts('engagement')} />
        <polyline className="ln-tru" points={pts('trust')} />
        {log.map((en, i) => <circle key={`e${i}`} className="pt-eng" cx={x(i)} cy={y(en.engagement)} r={4} />)}
        {log.map((en, i) => <circle key={`t${i}`} className="pt-tru" cx={x(i)} cy={y(en.trust)} r={4} />)}
        <text className="end-label" x={W - R + 6} y={y(log[n - 1].engagement) + 3}>{log[n - 1].engagement}</text>
        <text className="end-label" x={W - R + 6} y={y(log[n - 1].trust) + 3} dy={log[n - 1].trust === log[n - 1].engagement ? 10 : 0}>{log[n - 1].trust}</text>
        {cur >= 0 && <line className="cursor is-on" x1={x(cur)} x2={x(cur)} y1={T} y2={H - B} />}
        {log.map((en, i) => (
          <rect key={`h${i}`} className="hit" x={x(i) - (W - L - R) / Math.max(1, n - 1) / 2} y={0} width={(W - L - R) / Math.max(1, n - 1)} height={H}
            onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(-1)} onClick={() => onPick(en.sentence)}>
            <title>{`Sentence ${en.sentence}: engagement ${en.engagement}, trust ${en.trust}`}</title>
          </rect>
        ))}
        <text className="axis-label" x={L} y={H - 3}>1</text>
        <text className="axis-label" x={W - R} y={H - 3} textAnchor="end">{n}</text>
      </svg>
      <p className="abo-strip__tip">
        {e ? <><b>Sentence {e.sentence}</b> · engagement {e.engagement}, trust {e.trust}{e.doubt && e.doubt !== 'none' ? ` · ${e.doubt}` : ''}</> : 'Hover a point for that sentence; click to open it in the text.'}
      </p>
    </div>
  );
}

function CriticCard({ critic, r, sentences, onPick, picked }) {
  const log = r.log || [];
  // What the critic read: the sentence as it stood in the read draft (e.text), falling back to
  // the final text at the mapped position.
  const finalText = (i) => sentences.find((s) => s.i === i)?.text || '';
  const readText = (e) => e?.text || finalText(e?.final ?? e?.sentence);
  const pickFinal = (e) => { if (e && e.final != null) onPick(e.final); };
  return (
    <article className="pt-card abo-card abo-critic">
      <div className="abo-critic__head">
        <h4>{critic.name}{r.label ? <span className="abo-critic__label"> read it as {r.label}</span> : null}</h4>
        <span>
          {r.rank != null && <span className="abo-rank">rank {r.rank} of 5</span>}{' '}
          <span className="abo-score">{fmtScore(r.score)}<small>/ 10</small></span>
        </span>
      </div>
      <p className="abo-critic__who">{critic.description}{critic.model ? ` · ${critic.model}` : ''}</p>
      <Strip log={log} onPick={(i) => pickFinal(log.find((e) => e.sentence === i))} picked={picked >= 0 ? log.findIndex((e) => e.final === picked) : -1} />
      <dl>
        <div><dt>Recall, after the last sentence</dt><dd><q>{r.recall}</q></dd></div>
        {r.best && <div><dt>Best sentence ({r.best.sentence}{r.best.final != null && r.best.final !== r.best.sentence ? `, now ${r.best.final}` : r.best.final == null ? ', since reworked' : ''})</dt><dd>{readText(r.best) && <q>{readText(r.best)}</q>} {r.best.why}</dd></div>}
        {r.weakest && (
          <div><dt>Weakest sentence ({r.weakest.sentence}{r.weakest.final != null && r.weakest.final !== r.weakest.sentence ? `, now ${r.weakest.final}` : r.weakest.final == null ? ', since reworked' : ''})</dt>
            <dd>{readText(r.weakest) && <q>{readText(r.weakest)}</q>} {r.weakest.why}
              {r.weakest.rewrite && <span className="abo-rewrite">Rewrite: {r.weakest.rewrite}</span>}
            </dd>
          </div>
        )}
        {r.overclaimed_or_unclear && <div><dt>Over-claimed or unclear</dt><dd>{r.overclaimed_or_unclear}</dd></div>}
        {r.wants_to_read != null && <div><dt>Wants to read the dissertation</dt><dd>{r.wants_to_read ? 'Yes' : 'No'}{r.wants_to_read_why ? `. ${r.wants_to_read_why}` : ''}</dd></div>}
        {r.pass2 && <div><dt>{critic.pass2Label || 'Second pass'}</dt><dd>{r.pass2}</dd></div>}
        {r.terms_not_followed?.length > 0 && <div><dt>Terms not followed</dt><dd>{r.terms_not_followed.join(', ')}</dd></div>}
        {r.read_twice?.length > 0 && <div><dt>Read twice</dt><dd>sentences {r.read_twice.join(', ')}</dd></div>}
      </dl>
      {log.length > 0 && (
        <details className="abo-log">
          <summary>Show the reading ({log.length} sentences)</summary>
          <table>
            <thead><tr><th>#</th><th>Sentence</th><th>Stated so far</th><th>Set up next</th><th>Doubt</th><th>Eng.</th><th>Trust</th></tr></thead>
            <tbody>
              {log.map((e) => (
                <tr key={e.sentence}>
                  <td className="n">{e.sentence}{e.final == null ? ' ×' : e.final !== e.sentence ? ` → ${e.final}` : ''}</td>
                  <td className="sent">{readText(e)}</td>
                  <td>{e.sofar ?? e.believes}</td>
                  <td className="quiet">{e.next ?? e.expects}</td>
                  <td>{e.doubt || <span className="quiet">none</span>}</td>
                  <td className="v">{e.engagement}</td>
                  <td className="v">{e.trust}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </article>
  );
}

/* ---------- one option in full ---------- */
function OptionView({ o, data, copied, flash, picked, setPicked }) {
  const [openSent, setOpen] = useState(-1);
  const [hoverSent, setHoverSent] = useState(-1);
  const setOpenSent = useCallback((i, hover) => {
    if (hover === true) setHoverSent(i);
    else if (hover === false) setHoverSent((h) => (h === i ? -1 : h));
    else setOpen((cur) => (cur === i ? -1 : i));
  }, []);
  // (the parent keys this view by option id, so the sentence state resets on a switch)
  const shown = hoverSent >= 0 ? hoverSent : openSent;
  const marks = useMemo(() => {
    const best = new Set(); const weak = new Set();
    const at = (b) => (b && b.final != null ? b.final : null);
    Object.values(o.critics || {}).forEach((r) => { if (at(r.best) != null) best.add(at(r.best)); if (at(r.weakest) != null) weak.add(at(r.weakest)); });
    return { best, weak };
  }, [o]);
  const acc = accuracyStatus(o.accuracy);
  const plain = o.paragraphs.join('\n\n');
  const pickHere = (i) => { setOpen(i); const el = document.querySelector(`.abo-prose[data-option="${o.id}"]`); el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); };
  const scores = data.critics.map((c) => o.critics?.[c.id]?.score).filter((s) => s != null);
  return (
    <section className="abo-option" aria-label={`Option ${o.n}`}>
      <header className="abo-option__head">
        <h3><small>Option {o.n}</small>{o.name}</h3>
        <div className="abo-option__tools">
          <span className={`abo-words${o.words.record > data.ceiling ? ' is-over' : ''}`}><b>{o.words.record}</b> words of record</span>
          <Status status={o.onePage ? 'ok' : 'open'}>{o.onePage ? 'one page with keywords' : 'does not fit one page'}</Status>
          <Status status={acc.status}>accuracy {acc.label}</Status>
          {scores.length > 0 && <span className="abo-words">critics mean <b>{mean(scores).toFixed(1)}</b></span>}
          <button type="button" className="ddf-btn" style={{ margin: 0 }} onClick={() => copyText(plain, () => flash(`${o.id}:text`))}>{copied === `${o.id}:text` ? 'Copied' : 'Copy text'}</button>
          <button type="button" className="ddf-btn" style={{ margin: 0 }} onClick={() => copyText(o.latex, () => flash(`${o.id}:latex`))}>{copied === `${o.id}:latex` ? 'Copied' : 'Copy LaTeX'}</button>
          <button type="button" className="abo-pick" aria-pressed={picked === o.id} onClick={() => setPicked(picked === o.id ? null : o.id)}>{picked === o.id ? 'Picked' : 'Pick this one'}</button>
        </div>
      </header>
      <p className="pt-module__intro" style={{ margin: 0 }}>{o.move}{o.voice ? ` ${o.voice}` : ''}</p>

      <div className="abo-grid">
        <article className="pt-card abo-card">
          <h4>The abstract</h4>
          <Prose o={o} openSent={shown} setOpenSent={setOpenSent} marks={marks} />
          <p className="abo-prose__hint">
            Hover a sentence for its sources; click to keep them open. Solid underline: a critic's best sentence. Wavy: a critic's weakest.
          </p>
          <div className="abo-src"><SourceView o={o} facts={data.facts} sent={shown} /></div>
        </article>
        <div className="abo-page">
          <article className="pt-card abo-card">
            <h4>The page, as built</h4>
            <div className="abo-page__paper">
              <img src={`${ROOT}/${o.svg}`} alt={`Option ${o.n} rendered as the abstract page of the dissertation`} decoding="async" draggable="false" />
            </div>
            <p className="abo-page__cap">pdflatex, cshonours.cls, page iii. {data.keywordsNote}</p>
          </article>
          <article className="pt-card abo-card">
            <h4>Length against the ceiling</h4>
            <Counts words={o.words} ceiling={data.ceiling} />
            <p className="abo-page__cap" style={{ marginTop: '0.5rem' }}>
              printed: words of the rendered page without heading, keywords and folio · texcount: "Words in text" on the body alone, plus one per PSMASegmentator macro · of record: the higher
            </p>
          </article>
        </div>
      </div>

      <div className="abo-grid">
        <article className="pt-card abo-card">
          <h4>What this option does</h4>
          {o.does.split('\n').map((t, i) => <p key={i}>{t}</p>)}
          <h4 style={{ marginTop: '0.9rem' }}>What an examiner might not like</h4>
          {o.risk.split('\n').map((t, i) => <p key={i}>{t}</p>)}
        </article>
        <article className="pt-card abo-card">
          <h4>Accuracy</h4>
          <Accuracy acc={o.accuracy} />
        </article>
      </div>

      <h4 style={{ margin: '0.2rem 0 -0.4rem' }}>Critics, blind and shuffled: each saw the five as A to E in its own order, without names or lanes</h4>
      {o.readVersion && (
        <p className="abo-page__cap" style={{ margin: '0.1rem 0 -0.4rem' }}>
          {o.readVersion}{o.readChanged ? ' This option lost or merged a sentence after the reading, so a number followed by → is where that sentence now sits, and × marks one that is gone.' : ''}
        </p>
      )}
      <div className="abo-critics">
        {data.critics.map((c) => (o.critics?.[c.id]
          ? <CriticCard key={c.id} critic={c} r={o.critics[c.id]} sentences={o.sentences} onPick={pickHere} picked={shown} />
          : <article key={c.id} className="pt-card abo-card abo-critic"><h4>{c.name}</h4><p className="abo-src__none">No report.</p></article>))}
      </div>
    </section>
  );
}

/* ---------- comparison and recommendation ---------- */
function Comparison({ data, go, picked }) {
  const reco = data.recommendation || {};
  const byId = Object.fromEntries(data.options.map((o) => [o.id, o]));
  return (
    <section className="pt-card abo-card" aria-label="Comparison">
      <h4>The five, side by side</h4>
      <div style={{ overflowX: 'auto' }}>
        <table className="abo-table">
          <thead>
            <tr>
              <th>Option</th><th>Words</th>
              {data.critics.map((c) => <th key={c.id}>{c.short || c.name}<small>score · rank</small></th>)}
              <th>Accuracy</th><th>Main risk</th>
            </tr>
          </thead>
          <tbody>
            {data.options.map((o) => {
              const acc = accuracyStatus(o.accuracy);
              return (
                <tr key={o.id} className={picked === o.id ? 'is-pick' : ''}>
                  <td><button type="button" className="abo-idlink" onClick={() => go(o.n)}><b>{o.n}. {o.name}</b><small>{o.move}</small></button></td>
                  <td className="num">{o.words.record}{o.words.record > data.ceiling ? ' !' : ''}</td>
                  {data.critics.map((c) => {
                    const r = o.critics?.[c.id];
                    return <td key={c.id} className="num">{r ? `${fmtScore(r.score)} · ${r.rank ?? '–'}` : '–'}</td>;
                  })}
                  <td><Status status={acc.status}>{acc.label}</Status></td>
                  <td>{o.mainRisk}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {reco.text && (
        <div className="abo-reco" style={{ marginTop: '1rem' }}>
          <h4>Recommendation</h4>
          {reco.text.split('\n').map((t, i) => <p key={i}>{t}</p>)}
          <p className="abo-page__cap">
            Would submit: {byId[reco.pick] ? `option ${byId[reco.pick].n}, ${byId[reco.pick].name}` : reco.pick}
            {reco.runnerUp && ` · runner-up: ${byId[reco.runnerUp] ? `option ${byId[reco.runnerUp].n}, ${byId[reco.runnerUp].name}` : reco.runnerUp}`}. You decide.
          </p>
        </div>
      )}
    </section>
  );
}

function NotesPanel({ data, notes, setNotes, picked, setPicked, copied, flash }) {
  const copyAll = () => {
    const p = data.options.find((o) => o.id === picked);
    const lines = [`Abstract options, my notes${p ? ` (pick: option ${p.n}, ${p.name})` : ' (no pick yet)'}:`];
    data.options.forEach((o) => {
      const t = (notes[o.id] || '').trim();
      lines.push(`- Option ${o.n}, ${o.name}${picked === o.id ? ' [PICK]' : ''}: ${t || '(no note)'}`);
    });
    copyText(lines.join('\n'), () => flash('notes'));
  };
  return (
    <section aria-label="My notes">
      <div className="abo-option__head" style={{ marginBottom: '0.6rem' }}>
        <h3 style={{ margin: 0, fontSize: '1.15rem' }}>My notes</h3>
        <div className="abo-notes__tools">
          <span className="abo-words">{picked ? `pick: option ${data.options.find((o) => o.id === picked)?.n}` : 'no pick yet'} · saved in this browser</span>
          <button type="button" className="ddf-btn" style={{ margin: 0 }} onClick={copyAll}>{copied === 'notes' ? 'Copied' : 'Copy notes'}</button>
        </div>
      </div>
      <div className="abo-notes">
        {data.options.map((o) => (
          <div key={o.id} className="pt-card abo-note">
            <div className="abo-note__head">
              <b>{o.n}. {o.name}</b>
              <button type="button" className="abo-pick" aria-pressed={picked === o.id} onClick={() => setPicked(picked === o.id ? null : o.id)}>{picked === o.id ? 'Picked' : 'Pick'}</button>
            </div>
            <textarea value={notes[o.id] || ''} placeholder="What you like, what to change…" aria-label={`Notes on option ${o.n}`}
              onChange={(e) => setNotes({ ...notes, [o.id]: e.target.value })} />
          </div>
        ))}
      </div>
    </section>
  );
}

function NotBuilt({ tabs, error }) {
  return (
    <div className="pt-module ddf abo">
      {tabs}
      <section className="pt-card ddf-notice">
        <h2>Abstract options · not built yet</h2>
        <p>The data comes from the dissertation repo's working folder. From the portfolio folder run:</p>
        <pre className="ddf-cmd">python -I tools/dissertation-diff/abstract_data.py</pre>
        <p className="ddf-muted">It writes abstracts.json and the page renders to the gitignored dissertation-diff-data/abstract-options/ folder. ({error})</p>
      </section>
    </div>
  );
}

/* ---------- the tab ---------- */
export default function AbstractOptions({ tabs, selected, go }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [{ pick, notes }, setStore] = useState(loadNotes);
  const [copied, flash] = useCopied();

  useEffect(() => {
    let off = false;
    fetch(`${ROOT}/abstract-options/abstracts.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`abstracts.json: HTTP ${r.status}`))))
      .then((j) => !off && setData(j))
      .catch((e) => !off && setError(String(e.message || e)));
    return () => { off = true; };
  }, []);
  useEffect(() => {
    try { localStorage.setItem(NOTES_KEY, JSON.stringify({ pick, notes })); } catch { /* ignore */ }
  }, [pick, notes]);
  const setPicked = useCallback((id) => setStore((s) => ({ ...s, pick: id })), []);
  const setNotes = useCallback((n) => setStore((s) => ({ ...s, notes: n })), []);

  if (error) return <NotBuilt tabs={tabs} error={error} />;
  if (!data) return <div className="pt-module ddf abo">{tabs}<p className="ddf-muted">Loading the abstract options…</p></div>;

  const n = Number(selected);
  const open = data.options.find((o) => o.n === n) || null;

  return (
    <div className="pt-module ddf abo">
      {tabs}
      <header className="ddf-head abo-head">
        <div>
          <p className="ddf-kicker">CITS4010 · dissertation · abstract</p>
          <h2 className="ddf-title">Abstract options</h2>
          <p className="pt-module__intro">{data.intro}</p>
        </div>
        <dl className="ddf-stats">
          <div><dt>Options</dt><dd>{data.options.length} on one scale</dd></div>
          <div><dt>Ceiling</dt><dd>{data.ceiling} words, one page</dd></div>
          <div><dt>Critics</dt><dd>{data.critics.length}, blind and shuffled</dd></div>
          <div><dt>Built</dt><dd>{new Date(data.built).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' })}</dd></div>
        </dl>
      </header>

      <nav aria-label="The five options">
        <p className="abo-scale__axis"><span>conservative</span><span>experimental</span></p>
        <ul className="abo-scale">
          {data.options.map((o) => (
            <li key={o.id}>
              <button type="button" className="abo-chip" aria-current={open?.id === o.id ? 'true' : undefined} onClick={() => go(open?.id === o.id ? null : o.n)}>
                <span className="abo-chip__n"><span>Option {o.n}</span><span className={`abo-words${o.words.record > data.ceiling ? ' is-over' : ''}`}><b>{o.words.record}</b> w</span></span>
                <span className="abo-chip__name">{o.name}</span>
                <span className="abo-chip__move">{o.move}</span>
                {pick === o.id && <span className="abo-chip__pick abo-words">✓ my pick</span>}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {open
        ? <OptionView key={open.id} o={open} data={data} copied={copied} flash={flash} picked={pick} setPicked={setPicked} />
        : <p className="ddf-muted">Click an option to read it with its page render, sources, accuracy status and the critics' readings. The comparison and your notes are below.</p>}

      <Comparison data={data} go={go} picked={pick} />
      <NotesPanel data={data} notes={notes} setNotes={setNotes} picked={pick} setPicked={setPicked} copied={copied} flash={flash} />
    </div>
  );
}
