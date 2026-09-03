// Confidence: how sure an agent is that it did its job properly.
//
// After every run an agent grades itself (prompt.ts's finish_run tool), and
// that score is folded into a rolling average on the worker. These components
// render both halves - one run's grade, and the trend across runs - because
// the trend is the actually useful signal: a single 60% is a bad afternoon, a
// slide from 95 to 60 over ten runs means the brief no longer matches reality
// and a human should step in.

import { FiAlertTriangle, FiMinus, FiTrendingDown, FiTrendingUp } from "react-icons/fi";

import {
  CONFIDENCE_ATTENTION_BELOW,
  confidenceBand,
  needsAttention,
  VERDICT_META,
  type AgentRunVerdict,
} from "../lib/agent/types";

/* ── Ring ────────────────────────────────────────────────────────────────── */

/**
 * The score as a ring. An SVG arc rather than a bar because a ring reads as
 * "out of 100" without needing an axis, and stays legible at 40px next to a
 * worker's name.
 */
export function ConfidenceRing({
  score,
  size = 64,
  runs = 0,
  showLabel = true,
}: {
  score: number | null | undefined;
  size?: number;
  runs?: number;
  showLabel?: boolean;
}) {
  const band = confidenceBand(score);
  const stroke = Math.max(3, Math.round(size * 0.09));
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct = score === null || score === undefined ? 0 : Math.max(0, Math.min(100, score));
  const dash = (pct / 100) * circ;

  return (
    <div className="px-conf" style={{ width: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={
          score === null || score === undefined
            ? "Not rated yet"
            : `Confidence ${Math.round(pct)} out of 100, ${band.label}`
        }
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--c-hair)"
          strokeWidth={stroke}
        />
        {pct > 0 && (
          <circle
            className="px-conf__arc"
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={band.color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circ}`}
            // Start at 12 o'clock and fill clockwise.
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        )}
        <text
          x="50%"
          y="50%"
          textAnchor="middle"
          dominantBaseline="central"
          className="px-conf__num"
          style={{ fontSize: Math.round(size * 0.3) }}
          fill="var(--c-heading)"
        >
          {score === null || score === undefined ? "–" : Math.round(pct)}
        </text>
      </svg>
      {showLabel && (
        <p className="px-conf__band" style={{ color: band.color }}>
          {band.label}
        </p>
      )}
      {showLabel && runs > 0 && (
        <p className="px-conf__runs">
          {runs} run{runs === 1 ? "" : "s"}
        </p>
      )}
    </div>
  );
}

/* ── Inline pill ─────────────────────────────────────────────────────────── */

/** Compact score for table rows and lists. */
export function ConfidencePill({
  score,
  verdict,
}: {
  score: number | null | undefined;
  verdict?: AgentRunVerdict | null;
}) {
  if (score === null || score === undefined) {
    return <span className="px-row__meta">Not rated</span>;
  }
  const band = confidenceBand(score);
  return (
    <span className="px-confpill" title={verdict ? VERDICT_META[verdict].label : band.label}>
      <span className="px-confpill__dot" style={{ background: band.color }} />
      <span className="px-confpill__num">{Math.round(score)}</span>
    </span>
  );
}

/* ── Trend ───────────────────────────────────────────────────────────────── */

/**
 * Recent scores as a sparkline, newest last. Deliberately shows the *runs*,
 * not the smoothed rolling number, so a step change is visible rather than
 * averaged away - and the delta between first and last is what the caption
 * reports.
 */
export function ConfidenceTrend({
  scores,
  height = 34,
}: {
  /** Oldest → newest. Runs with no grade are skipped by the caller. */
  scores: number[];
  height?: number;
}) {
  if (scores.length < 2) {
    return (
      <p className="px-hint">
        Two graded runs are needed before a trend means anything.
      </p>
    );
  }

  const w = 100;
  const pad = 3;
  const usable = height - pad * 2;
  const points = scores.map((s, i) => {
    const x = (i / (scores.length - 1)) * w;
    const y = pad + (1 - Math.max(0, Math.min(100, s)) / 100) * usable;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });

  const first = scores[0];
  const last = scores[scores.length - 1];
  const delta = Math.round(last - first);
  const band = confidenceBand(last);
  const Icon = delta > 4 ? FiTrendingUp : delta < -4 ? FiTrendingDown : FiMinus;
  const direction =
    delta > 4 ? "climbing" : delta < -4 ? "falling" : "holding steady";

  return (
    <div className="px-trend">
      <svg
        className="px-trend__chart"
        viewBox={`0 0 ${w} ${height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`Confidence over the last ${scores.length} graded runs: ${direction}, now ${Math.round(last)}`}
      >
        {/* The attention threshold, so a dip below it is visible at a glance. */}
        <line
          x1="0"
          x2={w}
          y1={pad + (1 - CONFIDENCE_ATTENTION_BELOW / 100) * usable}
          y2={pad + (1 - CONFIDENCE_ATTENTION_BELOW / 100) * usable}
          stroke="var(--c-hair)"
          strokeWidth="1"
          strokeDasharray="3 3"
          vectorEffect="non-scaling-stroke"
        />
        <polyline
          points={points.join(" ")}
          fill="none"
          stroke={band.color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        <circle
          cx={w}
          cy={pad + (1 - Math.max(0, Math.min(100, last)) / 100) * usable}
          r="2.5"
          fill={band.color}
        />
      </svg>
      <p className="px-trend__caption">
        <Icon className="size-3.5" aria-hidden="true" />
        <span>
          {direction === "holding steady"
            ? "Holding steady"
            : `${direction === "climbing" ? "Up" : "Down"} ${Math.abs(delta)} points`}{" "}
          over the last {scores.length} graded runs
        </span>
      </p>
    </div>
  );
}

/* ── Attention banner ────────────────────────────────────────────────────── */

/**
 * The whole point of tracking confidence: telling someone when to intervene.
 * Shown on the worker's Profile and Live Feed when the rolling score has
 * settled below the threshold, with the concrete next actions rather than a
 * vague warning.
 */
export function ConfidenceAlert({
  name,
  score,
  runs,
}: {
  name: string;
  score: number | null | undefined;
  runs: number;
}) {
  if (!needsAttention(score, runs)) return null;
  const band = confidenceBand(score);
  return (
    <div className="wm-call wm-call--danger">
      <FiAlertTriangle className="size-4 shrink-0" aria-hidden="true" />
      <div>
        <p className="font-semibold">
          {name} isn't confident in its own work ({Math.round(score!)}/100)
        </p>
        <p className="mt-0.5">
          {band.blurb} Look at the last few runs in History and see what it kept
          getting stuck on - usually it needs a clearer brief, a task split into
          smaller pieces, or a tool it hasn't been given.
        </p>
      </div>
    </div>
  );
}
