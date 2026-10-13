import { Fragment } from 'react';
import { fact } from './facts';
import { parseScript, TOKEN } from './text';

/* ============================================================================
   SEMINAR DECKS — <Num>, <T>, <Script>
   ----------------------------------------------------------------------------
   <Num k="r5.f1"/>             a manifest number, tagged data-k for gate G1
   <T>{'... {{key}} ...'}</T>   a string with {{key}} placeholders as <Num>s
   <Script text={...}/>         a transcript for reading aloud: cues as chips,
                                the cut sentence marked, numbers bound
   ========================================================================== */

export function Num({ k, className = '', children, svg = false }) {
  if (svg) {
    return <tspan className={`sd-num ${className}`} data-k={k}>{children ?? fact(k)}</tspan>;
  }
  return (
    <span className={`sd-num ${className}`} data-k={k}>
      {children ?? fact(k)}
    </span>
  );
}

export function T({ children }) {
  const str = String(children ?? '');
  const out = [];
  let last = 0;
  const re = new RegExp(TOKEN.source, 'g');
  let m;
  while ((m = re.exec(str))) {
    if (m.index > last) out.push(<Fragment key={`t${last}`}>{str.slice(last, m.index)}</Fragment>);
    out.push(<Num key={`n${m.index}`} k={m[1]} />);
    last = m.index + m[0].length;
  }
  if (last < str.length) out.push(<Fragment key={`t${last}`}>{str.slice(last)}</Fragment>);
  return <>{out}</>;
}

export function Script({ text, className = '' }) {
  const parts = parseScript(text);
  return (
    <div className={`sd-script-text ${className}`}>
      {parts.map((p, i) => {
        if (p.kind === 'cue') {
          return <span key={i} className="sd-cue" data-cue=""><T>{p.text}</T></span>;
        }
        if (p.kind === 'cut') {
          return (
            <span key={i} className="sd-cut">
              <T>{p.text}</T>
              <span className="sd-cut__tag">(cut if behind)</span>
            </span>
          );
        }
        return <T key={i}>{p.text}</T>;
      })}
    </div>
  );
}
