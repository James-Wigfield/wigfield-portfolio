/* /dreams?list=1: the plain list (framework Change C). Fast, for weak devices, reduced motion,
   and the jobs a corridor is bad at: seeing status, reordering within a night, and opening a
   dream to edit its text before it's read.

   Grouped by night, newest night first; within a night in night_order. Up/down PATCH
   night_order (the server renumbers each night 1..n; the view moves at once and then
   reloads the server's answer). "walk" on rendered rows → the corridor at that door and
   through it. */

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { COPY } from '../copy.js';
import StatusDot from '../components/StatusDot.jsx';
import { nightLabel } from '../contracts/rows.js';
import { api } from '../lib/api.js';
import { confirmAuth } from '../lib/auth.js';
import { useDreamList, useOutbox } from '../lib/hooks.js';
import { BASE, NEW_PATH, corridorUrl, dreamUrl, walkUrl } from '../routes.js';

const byOrder = (a, b) => (a.night_order || 0) - (b.night_order || 0);

/** [{ night, rows }] newest night first, each night's rows in night_order. */
function groupNights(rows) {
  const nights = new Map();
  for (const r of rows || []) {
    if (!r?.dreamt_on) continue;
    if (!nights.has(r.dreamt_on)) nights.set(r.dreamt_on, []);
    nights.get(r.dreamt_on).push(r);
  }
  return [...nights.keys()]
    .sort()
    .reverse()
    .map((night) => ({ night, rows: nights.get(night).sort(byOrder) }));
}

/** The same rows with one moved to position `to` in its night, the night renumbered 1..n. */
function applyMove(rows, moved, to) {
  const night = rows.filter((r) => r.dreamt_on === moved.dreamt_on).sort(byOrder);
  const from = night.findIndex((r) => r.id === moved.id);
  if (from < 0) return rows;
  const [row] = night.splice(from, 1);
  night.splice(Math.max(0, Math.min(night.length, to - 1)), 0, row);
  const order = new Map(night.map((r, i) => [r.id, i + 1]));
  return rows.map((r) => (order.has(r.id) ? { ...r, night_order: order.get(r.id) } : r));
}

export default function ListPage({ reason = null }) {
  const { rows, error, loading, reload, setRows } = useDreamList();
  const outbox = useOutbox();
  const [moving, setMoving] = useState(null);
  const [moveError, setMoveError] = useState(false);
  const nights = useMemo(() => groupNights(rows), [rows]);

  async function move(row, to) {
    if (moving) return;
    setMoving(row.id);
    setMoveError(false);
    setRows((prev) => applyMove(prev || [], row, to));
    try {
      await api.patch(row.id, { night_order: to });
    } catch (err) {
      if (!(await confirmAuth(err))) setMoveError(true);
    } finally {
      setMoving(null);
      reload();
    }
  }

  const waiting = outbox.entries.length;

  return (
    <main className="dr-page dr-list" data-dr="list" data-reason={reason || undefined}>
      <header className="dr-bar">
        <span className="dr-label dr-bar-title">{COPY.list.title}</span>
        <nav className="dr-bar-links">
          {reason === 'motion' ? (
            <Link className="dr-link" to={corridorUrl({ walk: true })} data-dr="walk-anyway">
              {COPY.list.walkAnyway}
            </Link>
          ) : reason ? null : (
            <Link className="dr-link" to={BASE} data-dr="to-corridor">
              {COPY.list.corridor}
            </Link>
          )}
          <Link className="dr-link" to={NEW_PATH} data-dr="to-new">
            {COPY.list.newDream}
          </Link>
        </nav>
      </header>

      {reason && (
        <p className="dr-line dr-faint dr-list-reason" data-dr="list-reason">
          {reason === 'motion' ? COPY.list.reducedMotion : COPY.list.noWebgl}
        </p>
      )}

      {waiting > 0 && (
        <p className="dr-dot dr-list-waiting" data-status="captured" data-dr="list-waiting">
          <i aria-hidden="true" />
          {COPY.list.waiting(waiting)}
        </p>
      )}

      {moveError && (
        <p className="dr-dot" data-status="failed" role="status">
          <i aria-hidden="true" />
          {COPY.list.moveError}
        </p>
      )}

      {loading && <p className="dr-line dr-faint">{COPY.list.loading}</p>}

      {error && !rows && (
        <p className="dr-dot" data-status="failed" data-dr="list-error">
          <i aria-hidden="true" />
          {COPY.list.error}
          <button type="button" className="dr-link" onClick={reload}>
            {COPY.list.retry}
          </button>
        </p>
      )}

      {rows && !nights.length && (
        <p className="dr-empty" data-dr="list-empty">
          {COPY.list.empty}
          <Link className="dr-link" to={NEW_PATH}>
            {COPY.list.newDream}
          </Link>
        </p>
      )}

      {nights.map(({ night, rows: list }) => (
        <section className="dr-night" key={night} data-dr="night" data-night={night}>
          <h2 className="dr-night-head">
            <span className="dr-label">{COPY.night.of(nightLabel(night))}</span>
            <span className="dr-label dr-faint">{COPY.night.count(list.length)}</span>
          </h2>
          <ol className="dr-rows">
            {list.map((row, i) => (
              <li className="dr-row" key={row.id} data-dr="row" data-id={row.id} data-status={row.status} data-order={row.night_order}>
                <span className="dr-row-n" aria-hidden="true">
                  {row.night_order}
                </span>
                <Link className="dr-row-title" to={dreamUrl(row.id)} data-dr="row-open">
                  {row.title || row.first_words || COPY.list.untitled}
                </Link>
                <span className="dr-row-status">
                  <StatusDot status={row.status} />
                </span>
                <span className="dr-row-move">
                  <button
                    type="button"
                    className="dr-step"
                    onClick={() => move(row, i)}
                    disabled={i === 0 || Boolean(moving)}
                    aria-label={COPY.list.up}
                    title={COPY.list.up}
                    data-dr="up"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="dr-step"
                    onClick={() => move(row, i + 2)}
                    disabled={i === list.length - 1 || Boolean(moving)}
                    aria-label={COPY.list.down}
                    title={COPY.list.down}
                    data-dr="down"
                  >
                    ↓
                  </button>
                </span>
                <span className="dr-row-walk">
                  {row.status === 'rendered' && reason !== 'webgl' && (
                    <Link className="dr-link" to={walkUrl(row.id)} data-dr="walk">
                      {COPY.list.walk}
                    </Link>
                  )}
                </span>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </main>
  );
}
