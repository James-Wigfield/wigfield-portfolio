import { useEffect, useState } from 'react';
import { usePortalRoute } from '../../portalRoute';
import Icon from '../../icons';
import { VERSIONS, DEFAULT_VERSION } from './content';
import './resume.css';

/* ============================================================================
   RESUME  (Personal section)
   ----------------------------------------------------------------------------
   James's CV as an A4 document with an Export PDF button. Two versions:
     v2 - current, written for the Portara insurance application (default)
     v1 - the Google Doc resume as it stood on 27 Jan 2026, reproduced as is

   Map:  content.js (every word, both versions) · resume.css (screen + print)
   Deep link: /portal/resume/v1 · /portal/resume/v2

   Export PDF is window.print() and the browser's "Save as PDF". The print
   rules live in resume.css and only bite while this module is mounted
   (`.hp.portal:has(.rsm)`), so Ctrl+P works too. The @page box (A4, margins,
   page numbers) cannot be scoped by a selector, so it is a <style> this
   module adds on mount and removes on unmount: it sits after portal.css, so
   it beats the full-bleed @page that Wall Art installs portal-wide.

   The paper copies the original Google Doc resume (Lexend Deca, light 10pt
   body, 13pt section heads over a grey rule, 10mm margins), on white paper
   whatever the portal theme. No footer and no page numbers, like the doc.
   No em-dashes anywhere in this module.
   ========================================================================== */

const FONT_HREF = 'https://fonts.googleapis.com/css2?family=Lexend+Deca:wght@300;400;500&display=swap';

const PAGE_CSS = `
@media print {
  @page { size: A4 portrait; margin: 28.3pt; }
}`;

// "{{confirm: what}}" inside any string marks a fact James still has to
// confirm. It renders as a highlighted placeholder, on screen and in print,
// so an unconfirmed line can never go out looking final.
// "**label**" renders bold, like the labels in the Google Doc's bullets.
function Text({ children }) {
  if (typeof children !== 'string') return children ?? null;
  const parts = children.split(/(\{\{confirm:[^}]*\}\}|\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => {
    const m = p.match(/^\{\{confirm:\s*([^}]*)\}\}$/);
    if (m) {
      return (
        <mark key={i} className="rsm-tbc" title="To confirm before sending">
          {m[1]}
        </mark>
      );
    }
    const b = p.match(/^\*\*([^*]+)\*\*$/);
    return b ? <b key={i}>{b[1]}</b> : p;
  });
}

function countConfirms(v) {
  return (JSON.stringify(v).match(/\{\{confirm:/g) || []).length;
}

function Entry({ e }) {
  return (
    <div className="rsm-entry">
      <div className="rsm-entry__head">
        <h3>
          <Text>{e.org}</Text>
        </h3>
        {e.when ? (
          <span className="rsm-when">
            <Text>{e.when}</Text>
          </span>
        ) : null}
      </div>
      {e.role ? (
        <p className="rsm-role">
          <Text>{e.role}</Text>
        </p>
      ) : null}
      {(e.lines || []).map((l, i) => (
        <p className="rsm-line" key={i}>
          <Text>{l}</Text>
        </p>
      ))}
      {e.bullets?.length ? (
        <ul>
          {e.bullets.map((b, i) => (
            <li key={i}>
              <Text>{b}</Text>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function Section({ s }) {
  const labelled = [...(s.facts || []), ...(s.list || [])];
  return (
    <section className={`rsm-sec${s.keep ? ' rsm-sec--keep' : ''}`}>
      <h2>{s.title}</h2>
      {s.lede ? (
        <p className="rsm-para">
          <Text>{s.lede}</Text>
        </p>
      ) : null}
      {(s.entries || []).map((e, i) => (
        <Entry e={e} key={i} />
      ))}
      {labelled.length ? (
        <ul className="rsm-list">
          {labelled.map((l, i) => (
            <li key={i}>
              {l.k ? <b>{l.k}</b> : null}
              {l.k ? ': ' : null}
              <Text>{l.v}</Text>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function Document({ v }) {
  return (
    <article className="rsm-doc" aria-label={`${v.person.name} resume, ${v.tab}`}>
      <header>
        <h1 className="rsm-name">{v.person.name}</h1>
        <p className="rsm-contact">
          {v.person.contact.map((c, i) => (
            <span key={i}>
              {i ? ' | ' : null}
              <Text>{c}</Text>
            </span>
          ))}
        </p>
      </header>

      {v.summary ? (
        <section className="rsm-sec">
          <h2>{v.summaryTitle || 'Summary'}</h2>
          <p className="rsm-para">
            <Text>{v.summary}</Text>
          </p>
        </section>
      ) : null}
      {v.sections.map((s) => (
        <Section s={s} key={s.title} />
      ))}
    </article>
  );
}

export default function Resume() {
  const { sub, setSub } = usePortalRoute();
  const head = sub.split('/').filter(Boolean)[0];
  const v = VERSIONS.find((x) => x.id === head) || VERSIONS.find((x) => x.id === DEFAULT_VERSION);
  const [busy, setBusy] = useState(false);
  const tbc = countConfirms(v);

  // The paper's font (Lexend Deca, as in the Google Doc)
  // and the @page box, for as long as the resume is on screen.
  useEffect(() => {
    let link = document.getElementById('rsm-fonts');
    if (!link) {
      link = document.createElement('link');
      link.id = 'rsm-fonts';
      link.rel = 'stylesheet';
      link.href = FONT_HREF;
      document.head.appendChild(link);
    }
    const page = document.createElement('style');
    page.id = 'rsm-page';
    page.textContent = PAGE_CSS;
    document.head.appendChild(page);
    return () => page.remove();
  }, []);

  const exportPdf = () => {
    if (busy) return;
    setBusy(true);
    const before = document.title;
    // Chrome names the saved PDF after the document title.
    document.title = v.pdfName;
    const done = () => {
      document.title = before;
      setBusy(false);
      window.removeEventListener('afterprint', done);
    };
    window.addEventListener('afterprint', done);
    // Wait for the faces so the PDF never snapshots a fallback font.
    document.fonts.ready.then(() => window.print());
  };

  return (
    <div className="pt-module rsm">
      <header className="rsm-top">
        <div className="rsm-top__text">
          <span className="rsm-micro">Personal · resume · A4</span>
          <h1 className="rsm-top__title">Resume</h1>
          <p className="rsm-top__lede">{v.about}</p>
        </div>

        <div className="rsm-bar">
          <div className="rsm-switch" role="tablist" aria-label="Resume version">
            {VERSIONS.map((x) => (
              <button
                key={x.id}
                type="button"
                role="tab"
                aria-selected={x.id === v.id}
                className={`rsm-switch__btn${x.id === v.id ? ' is-on' : ''}`}
                onClick={() => setSub(x.id === DEFAULT_VERSION ? '' : x.id)}
              >
                <b>{x.tab}</b>
                <span>{x.short}</span>
              </button>
            ))}
          </div>
          <div className="rsm-bar__meta">
            <span>
              {v.label} · last updated {v.updatedText}
            </span>
            {tbc ? (
              <span className="rsm-bar__tbc">
                <mark className="rsm-tbc">{tbc}</mark> {tbc === 1 ? 'line' : 'lines'} to confirm before sending
              </span>
            ) : null}
          </div>
          <button type="button" className="rsm-export" onClick={exportPdf} disabled={busy}>
            <Icon name="printer" size={16} />
            Export PDF
          </button>
        </div>
        <p className="rsm-hint">
          In the print dialog choose &ldquo;Save as PDF&rdquo;, paper A4, margins Default, and untick Headers and
          footers.
        </p>
      </header>

      <div className="rsm-stage">
        <Document v={v} />
      </div>

      {v.notes?.length ? (
        <section className="rsm-notes" aria-label="Notes on this version">
          <h2 className="rsm-notes__title">Notes on {v.tab.toLowerCase()} (not printed)</h2>
          <ul>
            {v.notes.map((n, i) => (
              <li key={i}>
                <Text>{n}</Text>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
