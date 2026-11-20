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

   The look follows the Portara HQ print documents: white paper whatever the
   portal theme, Jost name, Inter body, IBM Plex Mono labels, one accent rule
   under the header and above the footer, structure from rules and space.
   No em-dashes anywhere in this module.
   ========================================================================== */

const FONT_HREF =
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Jost:wght@400;500;600&display=swap';

const PAGE_CSS = `
@media print {
  @page {
    size: A4 portrait; margin: 13mm 0 14mm;
    @bottom-center { content: "Page " counter(page) " of " counter(pages);
                     font-family: "IBM Plex Mono", ui-monospace, monospace;
                     font-size: 7pt; letter-spacing: .08em; color: #9b9a97; }
  }
}`;

// "{{confirm: what}}" inside any string marks a fact James still has to
// confirm. It renders as a highlighted placeholder, on screen and in print,
// so an unconfirmed line can never go out looking final.
function Text({ children }) {
  if (typeof children !== 'string') return children ?? null;
  const parts = children.split(/(\{\{confirm:[^}]*\}\})/g);
  return parts.map((p, i) => {
    const m = p.match(/^\{\{confirm:\s*([^}]*)\}\}$/);
    if (!m) return p;
    return (
      <mark key={i} className="rsm-tbc" title="To confirm before sending">
        {m[1]}
      </mark>
    );
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
  return (
    <section className={`rsm-sec${s.keep ? ' rsm-sec--keep' : ''}`}>
      <h2>{s.title}</h2>
      {s.lede ? (
        <p className="rsm-sec__lede">
          <Text>{s.lede}</Text>
        </p>
      ) : null}
      {(s.entries || []).map((e, i) => (
        <Entry e={e} key={i} />
      ))}
      {s.facts ? (
        <dl className="rsm-facts">
          {s.facts.map((f) => (
            <div key={f.k}>
              <dt>{f.k}</dt>
              <dd>
                <Text>{f.v}</Text>
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
      {s.list ? (
        <ul className="rsm-list">
          {s.list.map((l, i) => (
            <li key={i}>
              {l.k ? <b>{l.k}: </b> : null}
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
      <header className="rsm-band">
        <div>
          <h1>{v.person.name}</h1>
          {v.person.headline ? (
            <p className="rsm-headline">
              <Text>{v.person.headline}</Text>
            </p>
          ) : null}
        </div>
        <div className="rsm-band__right">
          <p className="rsm-eyebrow">Curriculum vitae</p>
          <p className="rsm-contact">
            {v.person.contact.map((c, i) => (
              <span key={i}>
                <Text>{c}</Text>
              </span>
            ))}
          </p>
        </div>
      </header>

      <div className="rsm-sheet">
        {v.summary ? (
          <p className="rsm-lede">
            <Text>{v.summary}</Text>
          </p>
        ) : null}
        {v.sections.map((s) => (
          <Section s={s} key={s.title} />
        ))}
      </div>

      <footer className="rsm-foot">
        <span>
          {v.person.name} · curriculum vitae
        </span>
        <span>
          {v.tab} · updated {v.updatedText}
        </span>
      </footer>
    </article>
  );
}

export default function Resume() {
  const { sub, setSub } = usePortalRoute();
  const head = sub.split('/').filter(Boolean)[0];
  const v = VERSIONS.find((x) => x.id === head) || VERSIONS.find((x) => x.id === DEFAULT_VERSION);
  const [busy, setBusy] = useState(false);
  const tbc = countConfirms(v);

  // Fonts for the paper (Inter + Jost; IBM Plex Mono is already loaded site-wide)
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
