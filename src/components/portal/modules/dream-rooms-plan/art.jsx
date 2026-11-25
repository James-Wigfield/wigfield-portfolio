/* SVG pictures for the Dream Rooms plan page. Colours come from .drp tokens
   (dream-rooms-plan.css), so every picture reads in jade, coral and arcade. */

/* ── 02 · capture phone screens (dark on purpose) ──────────────────────────── */
export function PhoneScreen({ kind }) {
  return (
    <svg viewBox="0 0 64 112" className="drp-phone" aria-hidden="true">
      <rect x="1" y="1" width="62" height="110" rx="9" className="drp-phone__body" />
      <rect x="25" y="5" width="14" height="3" rx="1.5" className="drp-phone__notch" />
      {kind === 'open' && (
        <g>
          <rect x="7" y="14" width="50" height="52" rx="2" className="drp-phone__field" />
          <rect x="11" y="20" width="2" height="7" className="drp-phone__caret" />
          <rect x="11" y="32" width="30" height="2" rx="1" className="drp-phone__hint" />
          <rect x="11" y="37" width="22" height="2" rx="1" className="drp-phone__hint" />
          <rect x="7" y="92" width="50" height="12" rx="3" className="drp-phone__btn drp-phone__btn--off" />
        </g>
      )}
      {kind === 'talk' && (
        <g>
          <rect x="7" y="14" width="50" height="40" rx="2" className="drp-phone__field" />
          {[20, 25, 30, 35, 40].map((y, i) => <rect key={y} x="11" y={y} width={[40, 34, 38, 26, 14][i]} height="2.2" rx="1" className="drp-phone__words" />)}
          <rect x="4" y="60" width="56" height="34" rx="2" className="drp-phone__kbd" />
          {[0, 1, 2].map((r) => [0, 1, 2, 3, 4, 5].map((c) => <rect key={`${r}${c}`} x={7 + c * 8.6} y={63 + r * 8} width="7" height="6" rx="1" className="drp-phone__key" />))}
          <circle cx="50" cy="100" r="5" className="drp-phone__mic" />
          <path d="M50 97.5 v4 M48.3 100.4 a1.7 1.7 0 0 0 3.4 0" className="drp-phone__micglyph" />
        </g>
      )}
      {kind === 'save' && (
        <g>
          <rect x="7" y="14" width="50" height="52" rx="2" className="drp-phone__field" />
          {[20, 25, 30, 35, 40, 45, 50].map((y, i) => <rect key={y} x="11" y={y} width={[40, 34, 38, 26, 40, 30, 18][i]} height="2.2" rx="1" className="drp-phone__words" />)}
          <circle cx="12" cy="74" r="2" className="drp-phone__saved" />
          <rect x="17" y="73" width="22" height="2" rx="1" className="drp-phone__hint" />
          <rect x="7" y="88" width="50" height="16" rx="3" className="drp-phone__btn" />
        </g>
      )}
      {kind === 'feel' && (
        <g>
          <rect x="9" y="16" width="30" height="3" rx="1.5" className="drp-phone__hint" />
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <rect key={i} x={8 + (i % 3) * 16.5} y={26 + Math.floor(i / 3) * 11} width="14.5" height="8" rx="1.5" className={i === 1 || i === 3 ? 'drp-phone__chip drp-phone__chip--on' : 'drp-phone__chip'} />
          ))}
          <rect x="7" y="54" width="50" height="22" rx="2" className="drp-phone__field" />
          <rect x="7" y="92" width="23" height="12" rx="3" className="drp-phone__btn drp-phone__btn--off" />
          <rect x="34" y="92" width="23" height="12" rx="3" className="drp-phone__btn" />
        </g>
      )}
    </svg>
  );
}

export function Outbox() {
  return (
    <svg viewBox="0 0 400 100" className="drp-outbox" role="img" aria-label="The phone saves to an outbox, which uploads when there's signal">
      <line x1="56" y1="44" x2="344" y2="44" className="drp-outbox__rail" />
      <path d="M170 44 q10 -16 20 0 t20 0 t20 0" className="drp-outbox__nosig" />
      {[
        { x: 56, label: 'Textarea', sub: 'every word' },
        { x: 152, label: 'Outbox', sub: 'on the phone' },
        { x: 248, label: 'Upload', sub: 'retries' },
        { x: 344, label: 'Stored', sub: 'private' },
      ].map((n) => (
        <g key={n.label}>
          <circle cx={n.x} cy="44" r="8" className="drp-outbox__node" />
          <text x={n.x} y="74" className="drp-outbox__label">{n.label}</text>
          <text x={n.x} y="88" className="drp-outbox__sub">{n.sub}</text>
        </g>
      ))}
      <text x="200" y="22" className="drp-outbox__sub">no signal</text>
      <circle r="5" className="drp-outbox__pulse" cx="56" cy="44" />
    </svg>
  );
}

/* ── 05 · the viewer, as a phone ───────────────────────────────────────────── */
export function ViewerWire() {
  return (
    <svg viewBox="0 0 200 360" className="drp-wire" role="img" aria-label="Viewer wireframe on a phone: nothing on screen but the corridor, one line of your words, and invisible touch zones">
      <rect x="4" y="4" width="192" height="352" rx="20" className="drp-wire__body" />
      <rect x="14" y="16" width="172" height="328" rx="10" className="drp-wire__screen" />
      {/* one-point corridor */}
      <path d="M14 16 L82 140 M186 16 L118 140 M14 344 L82 214 M186 344 L118 214" className="drp-wire__persp" />
      <rect x="82" y="140" width="36" height="74" className="drp-wire__end" />
      <path d="M40 66 v80 M48 82 v62" className="drp-wire__door" />
      <path d="M160 66 v80 M152 82 v62" className="drp-wire__door" />
      <circle cx="100" cy="182" r="3.2" className="drp-wire__figure" />
      <path d="M97 186 h6 l1 14 h-8 Z" className="drp-wire__figure" />
      {/* touch zones (invisible in the real thing) */}
      <rect x="18" y="20" width="164" height="150" rx="6" className="drp-wire__zone" />
      <text x="100" y="40" className="drp-wire__zt">drag to look</text>
      <rect x="18" y="226" width="164" height="114" rx="6" className="drp-wire__zone" />
      <text x="100" y="330" className="drp-wire__zt">hold to walk</text>
      <text x="100" y="300" className="drp-wire__frag">every door had the same number, 14</text>
    </svg>
  );
}

/* ── 06 · the archive: dreams linked by what comes back ────────────────────── */
export function ArchiveArt({ dreams, motifs }) {
  const byId = Object.fromEntries(dreams.map((d) => [d.id, d]));
  return (
    <svg viewBox="0 0 500 270" className="drp-arch" role="img" aria-label="Archive sketch: five dreams linked through recurring motifs such as school, mum, pool and corridor">
      {motifs.map((m) => m.links.map((id) => (
        <line key={`${m.id}-${id}`} x1={m.x} y1={m.y} x2={byId[id].x} y2={byId[id].y} className="drp-arch__edge" />
      )))}
      {dreams.map((d) => (
        <g key={d.id} className="drp-arch__dream" transform={`translate(${d.x} ${d.y})`}>
          <circle r="7" />
          <text y="-13" className="drp-arch__date">{d.label}</text>
          <text y="24" className="drp-arch__title">{d.title}</text>
        </g>
      ))}
      {motifs.map((m) => (
        <g key={m.id} className="drp-arch__motif" transform={`translate(${m.x} ${m.y})`}>
          <rect x="-4" y="-4" width="8" height="8" transform="rotate(45)" />
          <text x="9" y="4">{m.id}</text>
        </g>
      ))}
    </svg>
  );
}

