import uwaLogo from '../../../../../assets/portal/uwa-medical-physics.png';
import { ATTRIBUTION, PARTS, VERDICTS } from './meta';
import { REFS } from './refs';
import { resolveUrl, useMediaVersion } from '../engine/media';

/* ============================================================================
   SEMINAR DECKS — SLIDE CHROME (themed per deck through CSS variables)
   ----------------------------------------------------------------------------
   <Logo size="large|small" chip/>  the UWA Medical Physics Research Group logo
       (455 x 75 px, white background). Never recoloured, cropped or redrawn;
       shown at or below its native width so it never blurs; `chip` puts it on
       a white chip for dark slides.
   <Rail current/>                  the five-part progress rail; "My work" is
       labelled as the student's contribution.
   <Attribution/>                   the data line for slides that show scans
   <CiteLine keys refNum/>          footer citations, IEEE numbers per deck
   <VerdictGlyph state/>            shape for a hypothesis state (never colour alone)
   Every element carries data-req / data-role marks read by gates G4 and G7.
   ========================================================================== */

export const LOGO_W = 455;
export const LOGO_H = 75;

export function Logo({ size = 'small', chip = false, className = '' }) {
  useMediaVersion();
  const w = size === 'large' ? LOGO_W : size === 'medium' ? 300 : 210;
  return (
    <span className={`sd-logo ${chip ? 'sd-logo--chip' : ''} sd-logo--${size} ${className}`} data-req="logo">
      <img src={resolveUrl(uwaLogo)} width={w} height={Math.round((w * LOGO_H) / LOGO_W)} alt="UWA Medical Physics Research Group" draggable="false" />
    </span>
  );
}

export function Rail({ current, className = '' }) {
  return (
    <nav className={`sd-rail ${className}`} data-req="rail" aria-label="Talk outline">
      {PARTS.map((p) => (
        <span
          key={p.id}
          className={`sd-rail__part${p.id === current ? ' is-current' : ''}${p.id === 'mine' ? ' is-mine' : ''}`}
          data-role="foot"
          aria-current={p.id === current ? 'step' : undefined}
        >
          {p.label}
        </span>
      ))}
    </nav>
  );
}

export function Attribution({ className = '' }) {
  return <p className={`sd-attrib ${className}`} data-req="attribution" data-role="foot">{ATTRIBUTION}</p>;
}

export function CiteLine({ keys = [], refNum, className = '' }) {
  if (!keys.length) return null;
  return (
    <p className={`sd-cites ${className}`} data-role="foot" data-req="cites">
      {keys.map((k, i) => (
        <span key={k} className="sd-cites__item">
          {i > 0 && <span className="sd-cites__sep"> · </span>}
          <span data-tick="">[{refNum ? refNum(k) : '?'}]</span> {REFS[k]?.short ?? k}
        </span>
      ))}
    </p>
  );
}

/** In-text citation marker. */
export function Cite({ k, refNum }) {
  return <span className="sd-cite" data-cite={k} data-tick="">[{refNum ? refNum(k) : '?'}]</span>;
}

/* Shapes so a verdict never relies on colour: pending = open circle, trade =
   half-filled circle, not supported = cross, reversed = arrow turned back. */
export function VerdictGlyph({ state = 'pending', size = 40, className = '' }) {
  const s = size;
  const r = s * 0.38;
  const c = s / 2;
  const sw = Math.max(2.5, s * 0.08);
  let body;
  if (state === 'trade') {
    body = (
      <>
        <circle cx={c} cy={c} r={r} fill="none" stroke="currentColor" strokeWidth={sw} />
        <path d={`M ${c} ${c - r} A ${r} ${r} 0 0 0 ${c} ${c + r} Z`} fill="currentColor" />
      </>
    );
  } else if (state === 'not') {
    const d = r * 0.75;
    body = (
      <path d={`M ${c - d} ${c - d} L ${c + d} ${c + d} M ${c + d} ${c - d} L ${c - d} ${c + d}`} stroke="currentColor" strokeWidth={sw * 1.2} strokeLinecap="round" />
    );
  } else if (state === 'reversed') {
    body = (
      <>
        <path d={`M ${c + r} ${c - r * 0.35} H ${c - r * 0.6}`} stroke="currentColor" strokeWidth={sw} strokeLinecap="round" fill="none" />
        <path d={`M ${c - r * 0.2} ${c - r * 0.85} L ${c - r * 0.75} ${c - r * 0.35} L ${c - r * 0.2} ${c + r * 0.15}`} stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <path d={`M ${c - r} ${c + r * 0.45} H ${c + r * 0.6}`} stroke="currentColor" strokeWidth={sw} strokeLinecap="round" fill="none" opacity="0.45" />
      </>
    );
  } else {
    body = <circle cx={c} cy={c} r={r} fill="none" stroke="currentColor" strokeWidth={sw} strokeDasharray={`${sw * 1.4} ${sw * 1.2}`} />;
  }
  return (
    <svg className={`sd-verdict-glyph ${className}`} width={s} height={s} viewBox={`0 0 ${s} ${s}`} role="img" aria-label={VERDICTS[state]?.label ?? state}>
      {body}
    </svg>
  );
}
