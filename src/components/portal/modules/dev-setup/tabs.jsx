import { useEffect, useMemo, useState } from 'react';
import {
  FACTS, PROJECTS, LAYOUTS, LAYOUT_WHY, ZONE_STEPS, WORKSPACE_FILE, LAUNCH_OPTIONS, TRIGGER_STEPS,
  CONTROLS, MAPPINGS, LOGI_STEPS, LOOKS, TWEAKS, settingsSnippet, ORDER,
} from './content';
import { MonitorPair, MouseArt, TermPreview } from './diagrams';
import START_DEV_RAW from './start-dev.ps1?raw';

const START_DEV = START_DEV_RAW.replace(/\r\n/g, '\n');

/* ── shared bits ─────────────────────────────────────────────────────────── */
function Head({ n, hook, sub }) {
  return (
    <header className="dws-head">
      <span className="dws-head__n">{n}</span>
      <h2 className="dws-head__hook">{hook}</h2>
      {sub && <p className="dws-head__sub">{sub}</p>}
    </header>
  );
}

function Dot({ tone, children }) {
  return (
    <span className="dws-dot" data-tone={tone}>
      {children}
    </span>
  );
}

function Steps({ items }) {
  return (
    <ol className="dws-steps">
      {items.map(([k, v], i) => (
        <li key={k}>
          <span className="dws-steps__n">{String(i + 1).padStart(2, '0')}</span>
          <span>
            <strong>{k}</strong> {v}
          </span>
        </li>
      ))}
    </ol>
  );
}

/* VS Code-look block with light highlighting for ps1 / json / jsonc. */
function tokenLine(line, lang, inHere) {
  if (lang === 'ps1' && inHere) return [[line, 'here']];
  const out = [];
  const re =
    lang === 'ps1'
      ? /(#.*$)|("(?:[^"`]|`.)*"|'[^']*')|(\$[A-Za-z_][\w:]*)|\b(param|function|if|else|for|foreach|while|return|throw)\b|(-[A-Z][A-Za-z]+)/g
      : /(\/\/.*$)|("(?:[^"\\]|\\.)*")(\s*:)?|\b(true|false|null)\b|(-?\d+(?:\.\d+)?)/g;
  let last = 0;
  let m;
  while ((m = re.exec(line))) {
    if (m.index > last) out.push([line.slice(last, m.index)]);
    if (lang === 'ps1') {
      if (m[1]) out.push([m[1], 'com']);
      else if (m[2]) out.push([m[2], 'str']);
      else if (m[3]) out.push([m[3], 'var']);
      else if (m[4]) out.push([m[4], 'kw']);
      else out.push([m[5], 'flag']);
    } else if (m[1]) out.push([m[1], 'com']);
    else if (m[2]) {
      out.push([m[2], m[3] ? 'key' : 'str']);
      if (m[3]) out.push([m[3]]);
    } else if (m[4]) out.push([m[4], 'kw']);
    else out.push([m[5], 'num']);
    last = re.lastIndex;
  }
  if (last < line.length) out.push([line.slice(last)]);
  return out;
}

// Token lists per line; tracks PowerShell here-strings (@' … '@) across lines.
function tokenize(code, lang) {
  let inHere = false;
  let inBlock = false;
  return code.replace(/\n$/, '').split('\n').map((line) => {
    if (lang === 'ps1' && (inBlock || /^\s*<#/.test(line))) {
      inBlock = !/#>\s*$/.test(line);
      return { line, toks: [[line, 'com']] };
    }
    const startsHere = lang === 'ps1' && /@'\s*$/.test(line);
    const endsHere = lang === 'ps1' && /^'@/.test(line);
    if (endsHere) inHere = false;
    const toks = tokenLine(line, lang, inHere);
    if (startsHere) inHere = true;
    return { line, toks };
  });
}

export function CodeBlock({ file, lang, code, tall = false }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };
  const lines = useMemo(() => tokenize(code, lang), [code, lang]);
  return (
    <figure className="dws-ed">
      <div className="dws-ed__chrome">
        <span className="dws-ed__dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span className="dws-ed__tab">{file}</span>
        <button type="button" className="dws-ed__copy" onClick={copy}>
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="dws-ed__body" data-tall={tall} tabIndex={0}>
        {lines.map(({ line, toks }, i) => {
          return (
            <div className="dws-ed__line" key={i}>
              <span className="dws-ed__ln">{i + 1}</span>
              <span className="dws-ed__txt">
                {toks.map(([t, c], j) => (
                  <span key={j} className={c ? `dws-tk-${c}` : undefined}>
                    {t}
                  </span>
                ))}
                {line === '' && ' '}
              </span>
            </div>
          );
        })}
      </pre>
    </figure>
  );
}

/* ── 01 what I found ─────────────────────────────────────────────────────── */
export function Found() {
  const max = PROJECTS[0].n;
  return (
    <section className="dws-tab">
      <Head
        n="01"
        hook="Five Claude sessions share a screen with three VS Code windows that are mostly empty."
        sub="Everything here was read from the PC without changing it. The layout below is where your windows actually were when I checked."
      />
      <div className="dws-block">
        <MonitorPair layout={LAYOUTS.today} />
        <p className="dws-cap">
          Measured window positions. Each terminal is about 640 px wide, so a session at 12 pt has about 68 columns.
          VS Code takes 1934 px three times over, and Chrome sits maximised underneath it.
        </p>
      </div>
      <div className="dws-split">
        <ul className="dws-facts">
          {FACTS.map((f) => (
            <li key={f.k}>
              <span className="dws-facts__k">{f.tone ? <Dot tone={f.tone}>{f.k}</Dot> : f.k}</span>
              <span>
                <strong>{f.v}</strong>
                <span className="dws-facts__note">{f.note}</span>
              </span>
            </li>
          ))}
        </ul>
        <div className="dws-block">
          <span className="dws-micro">Claude Code sessions per project · last 30 days</span>
          <ul className="dws-bars">
            {PROJECTS.map((p) => (
              <li key={p.name}>
                <span className="dws-bars__name">{p.name}</span>
                <span className="dws-bars__track">
                  <span className="dws-bars__fill" style={{ width: `${(p.n / max) * 100}%` }} />
                </span>
                <span className="dws-bars__n">{p.n}</span>
              </li>
            ))}
          </ul>
          <p className="dws-cap">
            At most 3 different projects in one day. So six panes covers a heavy day with room for two sessions on
            one repo.
          </p>
        </div>
      </div>
    </section>
  );
}

/* ── 02 layout ───────────────────────────────────────────────────────────── */
export function Layout() {
  const [pick, setPick] = useState('a');
  const lay = LAYOUTS[pick];
  return (
    <section className="dws-tab">
      <Head
        n="02"
        hook="A grid of six Claude panes on one monitor, with Chrome and a thin VS Code on the other."
        sub="Option A is recommended. Option B is for days with lots of sessions running at once."
      />
      <div className="dws-block">
        <div className="dws-block__bar">
          <div className="dws-seg" role="group" aria-label="Layout">
            {['today', 'a', 'b'].map((id) => (
              <button key={id} type="button" aria-pressed={pick === id} onClick={() => setPick(id)}>
                {LAYOUTS[id].name}
                {id === 'a' ? ' ★' : ''}
              </button>
            ))}
          </div>
          <span className="dws-legend">
            <Dot tone="claude">Claude Code</Dot>
            <Dot tone="web">Chrome</Dot>
            <Dot tone="code">VS Code</Dot>
          </span>
        </div>
        <MonitorPair layout={lay} />
        <dl className="dws-stats">
          {lay.stats.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      </div>
      <ul className="dws-why">
        {LAYOUT_WHY.map(([k, v]) => (
          <li key={k}>
            <strong>{k}</strong>
            <span>{v}</span>
          </li>
        ))}
      </ul>
      <div className="dws-split">
        <div className="dws-block">
          <span className="dws-micro">Set up the zones · PowerToys FancyZones</span>
          <Steps items={ZONE_STEPS} />
        </div>
        <div className="dws-block">
          <span className="dws-micro">One VS Code window · Documents\dev.code-workspace</span>
          <CodeBlock file="dev.code-workspace" lang="json" code={WORKSPACE_FILE} />
          <p className="dws-cap">The script in the next tab opens this file, so all three repos share one narrow explorer.</p>
        </div>
      </div>
    </section>
  );
}

/* ── 03 launch ───────────────────────────────────────────────────────────── */
export function Launch() {
  return (
    <section className="dws-tab">
      <Head
        n="03"
        hook="One keypress, one script: the Claude grid, VS Code and Chrome, each in its place."
        sub="Ctrl + Alt + D runs start-dev.ps1 from a Start-menu shortcut. The mouse sends the same keys."
      />
      <div className="dws-lanes">
        {LAUNCH_OPTIONS.map((o) => (
          <article key={o.id} className="dws-lane" data-pick={o.pick}>
            <div className="dws-lane__top">
              <h3>{o.name}</h3>
              <Dot tone={o.pick}>{o.verdict}</Dot>
            </div>
            <dl className="dws-lane__rows">
              <div>
                <dt>Good</dt>
                <dd>{o.good}</dd>
              </div>
              <div>
                <dt>Catch</dt>
                <dd>{o.bad}</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
      <div className="dws-flow" aria-label="What happens when you press Ctrl + Alt + D">
        {['Mouse button or Ctrl + Alt + D', 'Start Dev.lnk', 'start-dev.ps1', 'wt grid → maximise', 'VS Code → 560 px', 'Chrome → 2000 px'].map(
          (s, i) => (
            <span key={s} className="dws-flow__step">
              <span className="dws-flow__n">{i + 1}</span>
              {s}
            </span>
          ),
        )}
      </div>
      <div className="dws-split dws-split--code">
        <div className="dws-block">
          <span className="dws-micro">Wire it up</span>
          <Steps items={TRIGGER_STEPS} />
          <p className="dws-cap">
            Checked on this PC: the script parses, the window helper compiles, and the generated wt command builds the
            grid in the right order. Nothing was launched.
          </p>
        </div>
        <CodeBlock file="start-dev.ps1" lang="ps1" code={START_DEV} tall />
      </div>
    </section>
  );
}

/* ── 04 mouse ────────────────────────────────────────────────────────────── */
const COLS = [
  ['all', 'Everywhere'],
  ['term', 'Terminal'],
  ['chrome', 'Chrome'],
  ['code', 'VS Code'],
];
const ROW_CONTROL = ['gesture', 'gesture', 'gesture', 'panel', 'thumbwheel', 'backfwd', 'top'];

export function Mouse() {
  const [active, setActive] = useState('gesture');
  const ctl = CONTROLS.find((c) => c.id === active);
  return (
    <section className="dws-tab">
      <Head
        n="04"
        hook="The small button stops opening Task View and starts moving between windows, panes and tabs."
        sub="MX Master 4, confirmed from Logi Options+. The same gesture does the matching thing in each app: hold and swipe moves to the next window, pane, tab or editor."
      />
      <div className="dws-split dws-split--mouse">
        <div className="dws-block">
          <MouseArt active={active} onPick={setActive} />
          <div className="dws-detail">
            <span className="dws-detail__n">{CONTROLS.findIndex((c) => c.id === active) + 1}</span>
            <p>
              <strong>{ctl.name}</strong>
              {ctl.where && <span className="dws-detail__where"> · {ctl.where}</span>}
            </p>
            <code>now: {ctl.now}</code>
          </div>
        </div>
        <div className="dws-block">
          <span className="dws-micro">Pick a control on the mouse, or a row</span>
          <div className="dws-map-wrap">
            <table className="dws-map">
              <thead>
                <tr>
                  <th scope="col">Control</th>
                  {COLS.map(([k, label]) => (
                    <th scope="col" key={k}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MAPPINGS.map((m, i) => (
                  <tr key={m.control} data-on={ROW_CONTROL[i] === active} onClick={() => setActive(ROW_CONTROL[i])}>
                    <th scope="row">{m.control}</th>
                    {COLS.map(([k]) => (
                      <td key={k} data-same={m[k] === 'same'}>
                        {m[k] === 'same' ? '—' : m[k]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="dws-cap">— means the app uses the Everywhere action.</p>
        </div>
      </div>
      <div className="dws-block">
        <span className="dws-micro">Set it up in Logi Options+</span>
        <Steps items={LOGI_STEPS} />
        <p className="dws-cap">
          Win + ← / → moves windows between zones only once FancyZones is running with Override Windows Snap on.
          Without it, those keys do the normal Windows snap.
        </p>
      </div>
    </section>
  );
}

/* ── 05 terminal ─────────────────────────────────────────────────────────── */
export function Terminal() {
  const [pick, setPick] = useState('mocha');
  const look = LOOKS.find((l) => l.id === pick);
  return (
    <section className="dws-tab">
      <Head
        n="05"
        hook="Smaller text, less padding and dimmed inactive panes: you get more on screen and still see which pane is active."
        sub="Your settings.json has never been edited, so these are all first changes. Pick a look. The settings below are the same whichever you choose."
      />
      <div className="dws-split dws-split--term">
        <div className="dws-block">
          <div className="dws-seg" role="group" aria-label="Terminal look">
            {LOOKS.map((l) => (
              <button key={l.id} type="button" aria-pressed={pick === l.id} onClick={() => setPick(l.id)}>
                {l.name}
                {l.pick === 'go' ? ' ★' : ''}
              </button>
            ))}
          </div>
          <TermPreview look={look} />
          <p className="dws-cap">{look.blurb}</p>
        </div>
        <CodeBlock file="settings.json (merge)" lang="jsonc" code={settingsSnippet(look)} />
      </div>
      <ul className="dws-tweaks">
        {TWEAKS.map((t) => (
          <li key={t.what}>
            <span className="dws-tweaks__k">
              {t.saves ? <Dot tone="go">saves space</Dot> : <Dot tone="later">looks / speed</Dot>}
            </span>
            <span>
              <strong>{t.what}</strong> {t.why}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ── 06 order ────────────────────────────────────────────────────────────── */
const KEY = 'dws:done';
function loadDone() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
}

export function Order() {
  const [done, setDone] = useState(loadDone);
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(done));
    } catch {
      /* private mode: ticks just don't persist */
    }
  }, [done]);
  const toggle = (i) => setDone((d) => (d.includes(i) ? d.filter((x) => x !== i) : [...d, i]));
  const left = ORDER.reduce((s, o, i) => s + (done.includes(i) ? 0 : o.min), 0);
  return (
    <section className="dws-tab">
      <Head
        n="06"
        hook="About an hour in total, starting with whatever the later steps depend on."
        sub="The ticks are saved in this browser. Hand any step to Claude later and it can follow the same tab."
      />
      <div className="dws-block__bar">
        <span className="dws-micro">
          {done.length}/{ORDER.length} done · ≈ {left} min left
        </span>
        {done.length > 0 && (
          <button type="button" className="dws-reset" onClick={() => setDone([])}>
            Reset
          </button>
        )}
      </div>
      <ol className="dws-order">
        {ORDER.map((o, i) => (
          <li key={o.t} data-done={done.includes(i)}>
            <label>
              <input type="checkbox" checked={done.includes(i)} onChange={() => toggle(i)} />
              <span className="dws-order__n">{String(i + 1).padStart(2, '0')}</span>
              <span className="dws-order__t">
                <strong>{o.t}</strong>
                <span>{o.d}</span>
              </span>
              <span className="dws-order__min">{o.min ? `${o.min} min` : '1 week'}</span>
            </label>
          </li>
        ))}
      </ol>
    </section>
  );
}
