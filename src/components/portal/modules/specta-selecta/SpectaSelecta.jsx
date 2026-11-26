import { useCallback, useEffect, useRef, useState } from 'react';
import { usePortalRoute } from '../../portalRoute';
import { getStatus, getDownloadUrl, testUpdate } from '../../data/spectaApi';
import './specta-selecta.css';

/* ============================================================================
   SPECTA SELECTA  (Personal section)
   ----------------------------------------------------------------------------
   Releases page for the desktop app: the latest version, install steps for Mac
   and Windows, and the last ten releases. The builds live as GitHub Releases in
   a private repo; the Worker (workers/specta-selecta.js) lists them and hands
   out short-lived download links, so every button here goes through the API.

   Deep link: /portal/specta-selecta/<tab>   (latest · mac · windows · releases)
   ========================================================================== */

const TABS = [
  { id: 'latest', label: 'Latest' },
  { id: 'mac', label: 'Mac' },
  { id: 'windows', label: 'Windows' },
  { id: 'releases', label: 'Releases' },
];

const XATTR = 'xattr -dr com.apple.quarantine "/Applications/Specta Selecta.app"';
const EMPTY = 'No releases yet. The first one appears after the app’s first push to main.';

const fmtDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
};
const fmtSize = (b) => {
  if (!b && b !== 0) return '';
  if (b >= 1e6) return `${(b / 1e6).toFixed(1)} MB`;
  if (b >= 1e3) return `${Math.round(b / 1e3)} KB`;
  return `${b} B`;
};
const KIND_LABEL = {
  'mac-dmg': 'Mac installer',
  'mac-update': 'Mac update',
  'win-installer': 'Windows installer',
  signature: 'Signature',
  'latest-json': 'Update manifest',
  other: 'File',
};
const findKind = (release, kind) => release?.assets.find((a) => a.kind === kind) || null;

export default function SpectaSelecta() {
  const { sub, setSub } = usePortalRoute();
  const head = sub.split('/').filter(Boolean)[0];
  const tab = TABS.some((t) => t.id === head) ? head : 'latest';
  const tabsRef = useRef(null);

  const [status, setStatus] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await getStatus();
    setStatus(data);
    setLoadError(error);
    setLoading(false);
  }, []);

  useEffect(() => {
    let live = true;
    getStatus().then(({ data, error }) => {
      if (!live) return;
      setStatus(data);
      setLoadError(error);
      setLoading(false);
    });
    return () => { live = false; };
  }, []);

  const go = (id) => {
    setSub(id === 'latest' ? '' : id);
    if (tabsRef.current && tabsRef.current.getBoundingClientRect().top < 0) {
      tabsRef.current.scrollIntoView({ block: 'start' });
    }
  };
  const onKey = (ev) => {
    const i = TABS.findIndex((t) => t.id === tab);
    let next = null;
    if (ev.key === 'ArrowRight') next = TABS[(i + 1) % TABS.length];
    if (ev.key === 'ArrowLeft') next = TABS[(i - 1 + TABS.length) % TABS.length];
    if (!next) return;
    ev.preventDefault();
    go(next.id);
    requestAnimationFrame(() => document.getElementById(`sps-tab-${next.id}`)?.focus());
  };

  const releases = status?.releases || [];
  const latest = releases[0] || null;

  return (
    <div className="pt-module sps">
      <header className="sps-hero">
        <span className="sps-micro">Personal · desktop app · releases</span>
        <h1 className="sps-hero__title">Specta Selecta</h1>
        <p className="sps-hero__lede">
          {latest
            ? <>Version <strong>{latest.version}</strong>, released {fmtDate(latest.publishedAt)}. Install it once and it keeps itself up to date.</>
            : 'Download the desktop app and install it. After that it keeps itself up to date.'}
        </p>
      </header>

      <nav className="sps-tabs" ref={tabsRef} role="tablist" aria-label="Specta Selecta sections" onKeyDown={onKey}>
        {TABS.map((t, i) => (
          <button
            key={t.id}
            id={`sps-tab-${t.id}`}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            aria-controls="sps-panel"
            tabIndex={tab === t.id ? 0 : -1}
            className="sps-tabs__tab"
            onClick={() => go(t.id)}
          >
            <span className="sps-tabs__n">{String(i + 1).padStart(2, '0')}</span>
            {t.label}
          </button>
        ))}
      </nav>

      <div id="sps-panel" key={tab} role="tabpanel" aria-labelledby={`sps-tab-${tab}`} className="sps-panel">
        {loading && !status ? (
          <p className="sps-cap">Checking the releases…</p>
        ) : loadError ? (
          <div className="sps-block">
            <span className="sps-dot" data-tone="bad">Couldn’t load</span>
            <p className="sps-cap">{loadError.message}</p>
            <div><button type="button" className="sps-btn" onClick={load}>Try again</button></div>
          </div>
        ) : (
          <>
            {tab === 'latest' && <Latest status={status} latest={latest} onRefresh={load} refreshing={loading} />}
            {tab === 'mac' && <Mac latest={latest} github={status?.github} />}
            {tab === 'windows' && <Windows latest={latest} github={status?.github} />}
            {tab === 'releases' && <Releases releases={releases} github={status?.github} />}
          </>
        )}
      </div>
    </div>
  );
}

/* ── Latest ──────────────────────────────────────────────────────────────── */

function Latest({ status, latest, onRefresh, refreshing }) {
  const [test, setTest] = useState({ state: 'idle' });
  const run = async () => {
    setTest({ state: 'running' });
    const { data, error } = await testUpdate();
    if (error) return setTest({ state: 'fail', text: error.message });
    const routeOk = (data.status === 200 && data.rewrittenOk) || data.status === 204;
    const ok = routeOk && data.refusesNoKey;
    let text;
    if (data.status === 200) text = `Answered 200 · version ${data.version} · ${data.platforms.length} platforms · links ${data.rewrittenOk ? 'all point here' : 'NOT rewritten'}`;
    else if (data.status === 204) text = 'Answered 204 · no release to offer yet, which is right for now';
    else text = `Answered ${data.status}${data.error ? ` · ${data.error}` : ''}`;
    if (!data.refusesNoKey) text += ' · it did NOT refuse a request without the key';
    setTest({ state: ok ? 'pass' : 'fail', text });
  };

  const c = status?.configured || {};
  const gh = status?.github || {};
  const testTone = { idle: 'idle', running: 'wait', pass: 'ok', fail: 'bad' }[test.state];
  const testLabel = { idle: 'Update route · not tested', running: 'Update route · testing', pass: 'Update route · works', fail: 'Update route · failed' }[test.state];

  return (
    <div className="sps-tab">
      <section className="sps-block">
        <h2 className="sps-h">Latest version</h2>
        {latest ? (
          <div className="sps-latest">
            <div className="sps-latest__v">
              <span className="sps-latest__num">{latest.version}</span>
              <span className="sps-micro">{fmtDate(latest.publishedAt)} · {latest.tag}</span>
            </div>
            <Notes text={latest.notes} />
          </div>
        ) : (
          <Empty github={gh} />
        )}
      </section>

      <section className="sps-block">
        <div className="sps-bar">
          <h2 className="sps-h">Status</h2>
          <button type="button" className="sps-link" onClick={onRefresh} disabled={refreshing}>{refreshing ? 'Refreshing…' : 'Refresh'}</button>
        </div>
        <ul className="sps-status">
          <li>
            <span className="sps-dot" data-tone={c.updateKey ? 'ok' : 'bad'}>Update key</span>
            <span>{c.updateKey ? 'Set on the site' : 'Not set. Run wrangler secret put SPECTA_UPDATE_KEY.'}</span>
          </li>
          <li>
            <span className="sps-dot" data-tone={c.githubToken ? 'ok' : 'bad'}>GitHub token</span>
            <span>{c.githubToken ? 'Set on the site' : 'Not set. Run wrangler secret put SPECTA_GITHUB_TOKEN.'}</span>
          </li>
          <li>
            <span className="sps-dot" data-tone={gh.ok ? 'ok' : c.githubToken ? 'bad' : 'idle'}>GitHub</span>
            <span>{gh.ok ? 'Reachable, releases readable' : gh.error || 'Not checked'}</span>
          </li>
          <li>
            <span className="sps-dot" data-tone={testTone}>{testLabel}</span>
            <span>{test.text || 'Runs the app’s update check on the site, with the real key, and reports what the app would get.'}</span>
          </li>
        </ul>
        <div>
          <button type="button" className="sps-btn sps-btn--primary" onClick={run} disabled={test.state === 'running'}>
            {test.state === 'running' ? 'Testing…' : 'Test the update route'}
          </button>
        </div>
      </section>
    </div>
  );
}

/* ── Mac ─────────────────────────────────────────────────────────────────── */

function Mac({ latest, github }) {
  const dmg = findKind(latest, 'mac-dmg');
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(XATTR);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch { /* clipboard blocked: the command is on screen to copy by hand */ }
  };

  return (
    <div className="sps-tab">
      <section className="sps-block">
        <h2 className="sps-h">Install on your Mac</h2>
        {latest ? (
          dmg ? (
            <DownloadButton asset={dmg} primary label="Download for Mac" note={`${latest.version} · Apple Silicon · ${fmtSize(dmg.size)}`} />
          ) : (
            <p className="sps-cap">Version {latest.version} has no Mac installer.</p>
          )
        ) : (
          <Empty github={github} />
        )}
      </section>

      <ol className="sps-steps">
        <li><span className="sps-steps__n">01</span><div>Open the <code>.dmg</code> and drag Specta Selecta into Applications.</div></li>
        <li><span className="sps-steps__n">02</span><div>Open Specta Selecta.</div></li>
        <li>
          <span className="sps-steps__n">03</span>
          <div>When macOS blocks it, open <strong>System Settings › Privacy &amp; Security</strong> and click <strong>Open Anyway</strong>.</div>
        </li>
        <li>
          <span className="sps-steps__n">04</span>
          <div>
            If macOS says the app is damaged, run this in Terminal and open it again:
            <div className="sps-cmd">
              <code>{XATTR}</code>
              <button type="button" className="sps-cmd__copy" onClick={copy}>{copied ? 'Copied' : 'Copy'}</button>
            </div>
          </div>
        </li>
        <li>
          <span className="sps-steps__n">05</span>
          <div>After that it updates itself. It checks at launch and every 10 minutes, and never restarts while it’s playing.</div>
        </li>
      </ol>
    </div>
  );
}

/* ── Windows ─────────────────────────────────────────────────────────────── */

function Windows({ latest, github }) {
  const exe = findKind(latest, 'win-installer');
  return (
    <div className="sps-tab">
      <section className="sps-block">
        <h2 className="sps-h">Install on Windows</h2>
        {latest ? (
          exe ? (
            <DownloadButton asset={exe} primary label="Download for Windows" note={`${latest.version} · 64-bit · ${fmtSize(exe.size)}`} />
          ) : (
            <p className="sps-cap">Version {latest.version} has no Windows installer.</p>
          )
        ) : (
          <Empty github={github} />
        )}
      </section>
      <ol className="sps-steps">
        <li><span className="sps-steps__n">01</span><div>Run the <code>-setup.exe</code>.</div></li>
        <li>
          <span className="sps-steps__n">02</span>
          <div>Windows SmartScreen may warn you about it. Click <strong>More info</strong>, then <strong>Run anyway</strong>.</div>
        </li>
        <li><span className="sps-steps__n">03</span><div>After that it updates itself, the same as on the Mac.</div></li>
      </ol>
    </div>
  );
}

/* ── Releases ────────────────────────────────────────────────────────────── */

function Releases({ releases, github }) {
  if (!releases.length) {
    return <div className="sps-tab"><Empty github={github} /></div>;
  }
  return (
    <div className="sps-tab">
      <ol className="sps-rel">
        {releases.map((r, i) => (
          <li key={r.tag} className="sps-rel__item">
            <div className="sps-rel__head">
              <span className="sps-rel__v">{r.version}</span>
              <span className="sps-micro">{fmtDate(r.publishedAt)}{i === 0 ? ' · latest' : ''}</span>
            </div>
            <Notes text={r.notes} />
            <ul className="sps-files">
              {r.assets.filter((a) => a.kind !== 'signature').map((a) => (
                <li key={a.id}>
                  <span className="sps-files__kind">{KIND_LABEL[a.kind] || 'File'}</span>
                  <span className="sps-files__name">{a.name}</span>
                  <span className="sps-files__size">{fmtSize(a.size)}</span>
                  <DownloadButton asset={a} label="Download" compact />
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </div>
  );
}

/* ── bits ────────────────────────────────────────────────────────────────── */

function DownloadButton({ asset, label, note, primary = false, compact = false }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const click = async () => {
    setBusy(true);
    setErr(null);
    const { data, error } = await getDownloadUrl(asset.id);
    setBusy(false);
    if (error || !data?.url) return setErr(error?.message || 'No download link came back.');
    window.location.assign(data.url); // GitHub serves it as a download; the page stays put
  };
  return (
    <span className={compact ? 'sps-dl sps-dl--compact' : 'sps-dl'}>
      <button type="button" className={primary ? 'sps-btn sps-btn--primary' : 'sps-btn'} onClick={click} disabled={busy}>
        {busy ? 'Getting link…' : label}
      </button>
      {note && <span className="sps-micro">{note}</span>}
      {err && <span className="sps-dot" data-tone="bad">{err}</span>}
    </span>
  );
}

function Notes({ text }) {
  const t = (text || '').trim();
  if (!t) return <p className="sps-cap">No notes for this release.</p>;
  return <p className="sps-notes">{t}</p>;
}

function Empty({ github }) {
  if (github && !github.ok) {
    return (
      <div className="sps-empty">
        <span className="sps-dot" data-tone="idle">Can’t see the releases yet</span>
        <p className="sps-cap">{github.error}</p>
      </div>
    );
  }
  return (
    <div className="sps-empty">
      <span className="sps-dot" data-tone="idle">Nothing yet</span>
      <p className="sps-cap">{EMPTY}</p>
    </div>
  );
}
