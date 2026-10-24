import { LECTURES } from '../core/concepts';
import { useSprite } from '../core/art';

/* ============================================================================
   GRADIENT ARCADE — A CABINET (one game on the hub)
   ----------------------------------------------------------------------------
   Marquee (title on the game's colour) · screen (blurb + the game's glyph)
   · foot (lectures · best · level pips · mastery ring). The whole cabinet is
   one button. Styles: hub.css (.dla-cab*).
   ========================================================================== */

export function Ring({ t = 0, size = 34, stroke = 4, label }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg className="dla-ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label ?? `${Math.round(t * 100)} % mastery`}>
      <circle className="dla-ring__track" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} />
      <circle className="dla-ring__fill" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} strokeDasharray={`${c * Math.max(0, Math.min(1, t))} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
    </svg>
  );
}

const lecShort = (n) => LECTURES.find((l) => l.n === n)?.short ?? `L${n}`;

export function Cabinet({ game, best, unlocked, mastery, due, onOpen, i = 0 }) {
  const Glyph = game.glyph ?? null;
  const sprite = useSprite(game.art);
  const pct = best ? Math.round((100 * best.score) / best.maxScore) : null;
  return (
    <button type="button" className="dla-cab" style={{ '--cab': `var(${game.color ?? '--dlv-blue'})`, '--i': i }} onClick={() => onOpen(game.id)} aria-label={`${game.title}: ${game.blurb}`}>
      <span className="dla-cab__marquee">
        <span className="dla-cab__title">{game.title}</span>
        {due > 0 && <span className="dla-cab__due" title={`${due} concepts due`}><span className="dla-cab__duedot" aria-hidden="true" />{due} due</span>}
      </span>
      <span className="dla-cab__screen">
        <span className="dla-cab__glyph" aria-hidden="true">{sprite ? <img className="dla-sprite dla-cab__sprite" src={sprite} alt="" width={48} height={48} /> : Glyph ? <Glyph /> : <DefaultGlyph />}</span>
        <span className="dla-cab__blurb">{game.blurb}</span>
      </span>
      <span className="dla-cab__foot">
        <span className="dla-cab__lecs">{game.lectures.map((n) => <span key={n} className="dla-cab__lec">{lecShort(n)}</span>)}</span>
        <span className="dla-cab__pips" aria-label={`level ${unlocked} of ${game.levels ?? 3} unlocked`}>
          {Array.from({ length: game.levels ?? 3 }, (_, k) => <span key={k} className={`dla-cab__pip${k < unlocked ? ' dla-cab__pip--on' : ''}`} />)}
        </span>
        <span className="dla-cab__best">{pct === null ? 'new' : `best ${pct}%`}</span>
        <Ring t={mastery} size={30} stroke={3.5} label={`${Math.round(mastery * 100)} % mastery across this game's concepts`} />
      </span>
    </button>
  );
}

function DefaultGlyph() {
  return (
    <svg viewBox="0 0 64 40" width="64" height="40">
      <circle cx="12" cy="20" r="5" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="32" cy="10" r="5" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="32" cy="30" r="5" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="52" cy="20" r="5" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M17 20 27 12M17 20 27 28M37 12 47 19M37 28 47 21" stroke="currentColor" strokeWidth="2" fill="none" />
    </svg>
  );
}
