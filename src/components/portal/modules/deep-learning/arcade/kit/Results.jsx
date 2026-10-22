import { WhyCard } from './WhyCard';
import { CONCEPTS } from '../core/concepts';

/* ============================================================================
   GRADIENT ARCADE — RESULTS SCREEN
   ----------------------------------------------------------------------------
   Score · personal best · XP · streak · which concepts moved box, then a
   "why" card for every mistake. `summary` is what the host returned from
   onRoundEnd (core/progress.js recordRound). Styles: kit.css (.dla-res*).
   ========================================================================== */
export function Results({ round, game, summary, onReplay, onExit, exitLabel = 'Back to the arcade', replayLabel = 'Play again' }) {
  const pct = round.maxScore ? Math.round((100 * round.score) / round.maxScore) : 0;
  const right = round.outcomes.filter((o) => o.correct).length;
  const title = pct >= 90 ? 'Sharp.' : pct >= 70 ? 'Solid.' : pct >= 40 ? 'Getting there.' : 'Rough round.';
  const names = (ids) => ids.map((id) => CONCEPTS[id]?.title ?? id);
  return (
    <section className="dla-res" aria-label="Round results">
      <header className="dla-res__head">
        <p className="dla-res__kicker">{game.title} · level {round.level}{round.mode !== 'free' ? ` · ${round.mode === 'mix' ? 'daily mix' : 'exam'}` : ''}</p>
        <h3 className="dla-res__title">{title}</h3>
      </header>
      <div className="dla-res__score">
        <span className="dla-res__big">{round.score.toLocaleString('en-AU')}</span>
        <span className="dla-res__of">/ {round.maxScore.toLocaleString('en-AU')}</span>
        <span className="dla-res__pct">{pct}%</span>
        {summary?.isBest && <span className="dla-res__best"><span className="dla-res__dot" aria-hidden="true" />personal best</span>}
      </div>
      <dl className="dla-res__stats">
        <div><dt>right</dt><dd>{right} / {round.outcomes.length}</dd></div>
        <div><dt>best combo</dt><dd>×{round.bestCombo}</dd></div>
        {summary && <div><dt>xp</dt><dd>+{summary.xpGained}{summary.level > summary.levelBefore ? ` · level ${summary.level}` : ''}</dd></div>}
        {summary && <div><dt>streak</dt><dd>{summary.streak.count} day{summary.streak.count === 1 ? '' : 's'}</dd></div>}
        {summary && summary.unlocked > summary.unlockedBefore && <div><dt>unlocked</dt><dd>level {summary.unlocked}</dd></div>}
      </dl>
      {summary && (summary.boxesUp.length > 0 || summary.boxesDown.length > 0) && (
        <p className="dla-res__boxes">
          {summary.boxesUp.length > 0 && <span className="dla-res__up">▲ {names(summary.boxesUp).join(', ')}</span>}
          {summary.boxesDown.length > 0 && <span className="dla-res__down">▼ {names(summary.boxesDown).join(', ')}</span>}
        </p>
      )}
      {round.mistakes.length > 0 ? (
        <div className="dla-res__why">
          <p className="dla-res__whyk"><span className="dla-res__dot dla-res__dot--why" aria-hidden="true" />Why · {round.mistakes.length} to fix</p>
          {round.mistakes.map((m, i) => <WhyCard key={`${m.item.id}-${i}`} item={m.item} given={m.given} n={i + 1} />)}
        </div>
      ) : (
        round.outcomes.length > 0 && <p className="dla-res__clean">No mistakes. Nothing to explain.</p>
      )}
      <div className="dla-res__actions">
        {onReplay && <button type="button" className="dla-btn dla-btn--primary" onClick={onReplay}>{replayLabel}</button>}
        <button type="button" className="dla-btn" onClick={onExit}>{exitLabel}</button>
      </div>
    </section>
  );
}
