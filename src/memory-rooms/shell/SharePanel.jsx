/* "Share privately" (place + spot pages, behind the password): make a link that opens this ONE place or room
   for anyone, with no password and no way to the rest (/memories/s/:token), copy it, switch it off.
   One link per person is the idea: switching one off leaves the others working. */

import { useEffect, useState } from 'react';
import { COPY } from '../copy.js';
import { api } from '../lib/api.js';
import { handleAuthError } from '../lib/auth.js';
import { formatDate } from '../lib/format.js';
import { paths } from '../routes.js';

const linkOf = (token) => `${window.location.origin}${paths.shared(token)}`;

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // no clipboard permission (http, an old browser): select a hidden field and copy that
    const el = document.createElement('textarea');
    el.value = text;
    el.setAttribute('readonly', '');
    el.style.position = 'fixed';
    el.style.opacity = '0';
    document.body.appendChild(el);
    el.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    el.remove();
    return ok;
  }
}

export default function SharePanel({ kind, id }) {
  const c = COPY.share;
  const [shares, setShares] = useState(null);
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(null);
  const [arming, setArming] = useState(null); // the link whose "Switch off" asks once more

  useEffect(() => {
    let alive = true;
    api.listShares({ kind, id }).then(
      (rows) => alive && setShares(rows || []),
      (err) => {
        if (!alive || handleAuthError(err)) return;
        setShares([]);
        setError(c.error);
      },
    );
    return () => {
      alive = false;
    };
  }, [kind, id, c.error]);

  const make = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const share = await api.createShare(kind, id, label.trim());
      setShares((s) => [share, ...(s || [])]);
      setLabel('');
      if (await copyText(linkOf(share.token))) setCopied(share.token);
    } catch (err) {
      if (!handleAuthError(err)) setError(c.error);
    }
    setBusy(false);
  };

  const copy = async (token) => {
    if (await copyText(linkOf(token))) setCopied(token);
  };

  const off = async (token) => {
    if (arming !== token) {
      setArming(token);
      return;
    }
    setArming(null);
    setError(null);
    try {
      await api.deleteShare(token);
      setShares((s) => (s || []).filter((x) => x.token !== token));
    } catch (err) {
      if (!handleAuthError(err)) setError(c.error);
    }
  };

  return (
    <section className="mr-share" data-mr="share-panel">
      <h2 className="mr-label">{c.title}</h2>
      <p className="mr-share__intro">{c.intro(c.what[kind])}</p>
      <form className="mr-share__make" onSubmit={make}>
        <label className="mr-field">
          <span className="mr-label">{c.labelLabel}</span>
          <span className="mr-place__addrow">
            <input className="mr-input" value={label} maxLength={60} placeholder={c.labelPlaceholder} onChange={(e) => setLabel(e.target.value)} data-mr="share-label" />
            <button type="submit" className="mr-btn" disabled={busy} data-mr="share-make">
              {busy ? c.making : c.make}
            </button>
          </span>
        </label>
      </form>
      {error && (
        <p className="mr-msg" data-tone="danger" role="alert">
          {error}
        </p>
      )}
      {shares && shares.length > 0 && (
        <ul className="mr-share__list">
          {shares.map((s) => (
            <li key={s.token} className="mr-share__row" data-mr="share-row" data-token={s.token}>
              <span className="mr-dot" data-status="rendered">
                <span className="mr-share__name">{s.label || c.noLabel}</span>
              </span>
              <input className="mr-input mr-share__url" readOnly value={linkOf(s.token)} onFocus={(e) => e.target.select()} aria-label={s.label || c.noLabel} data-mr="share-url" />
              <span className="mr-label mr-share__date">{c.made(formatDate(s.createdAt))}</span>
              <span className="mr-share__actions">
                <button type="button" className="mr-linkbtn" onClick={() => copy(s.token)} data-mr="share-copy">
                  {copied === s.token ? c.copied : c.copy}
                </button>
                <button type="button" className="mr-linkbtn" data-tone={arming === s.token ? 'danger' : undefined} onClick={() => off(s.token)} onBlur={() => arming === s.token && setArming(null)} data-mr="share-off">
                  {arming === s.token ? c.confirmOff : c.off}
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
      {shares && shares.length === 0 && !error && <p className="mr-share__none mr-label">{c.none}</p>}
    </section>
  );
}
