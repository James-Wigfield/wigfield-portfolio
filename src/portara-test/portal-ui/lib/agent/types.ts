// Shapes shared by the runtime, the loaders and the browser. Client-safe.

import type { Autonomy, RunCaps } from "./models";

/** One step of a run's trace - a row of public.worker_run_steps.
    This is the unit the Live Feed streams and the History tab replays: both
    read the same table, so a finished run shows exactly what was watched
    live, with nothing summarised away. */
export type RunStepKind =
  | "started"
  | "thinking"
  | "message"
  | "tool_call"
  | "tool_result"
  | "assessment"
  // The two halves of a pause (migration 0051). Ordinary trace rows on purpose:
  // a run that stops for an hour and then carries on has to be legible as one
  // transcript, not two mysterious fragments.
  | "approval_request"
  | "approval_decision"
  // The email pause (migration 0054): the run went to sleep waiting for a
  // reply, and the reply that woke it. Same one-transcript rule.
  | "reply_wait"
  | "reply_received"
  | "error"
  | "finished";

export type RunStep = {
  id: string;
  execution_id: string;
  seq: number;
  kind: RunStepKind;
  title: string;
  body: string | null;
  tool_name: string | null;
  tool_input: Record<string, unknown> | null;
  tool_output: Record<string, unknown> | null;
  is_error: boolean;
  duration_ms: number | null;
  tokens: number | null;
  created_at: string;
};

/** A run, as the History tab lists it. Extends the original 6-column
    worker_executions row with everything migration 0019 added. */
export type AgentRunStatus =
  | "queued"
  | "running"
  /** Parked mid-run, waiting for a person to approve or refuse one tool call
      (migration 0051). An OPEN state: nothing is finished and the worker's run
      slot is still taken. */
  | "awaiting_approval"
  /** Parked mid-run, waiting for somebody to answer an email it sent
      (migration 0054). Open, but does NOT hold the worker's run slot - a
      reply can take days, and the worker keeps working in the meantime. */
  | "awaiting_reply"
  | "succeeded"
  | "failed"
  | "cancelled";

export type AgentRunVerdict = "perfect" | "good" | "partial" | "failed";

export type AgentRun = {
  id: string;
  worker_id: string;
  task_id: string | null;
  trigger_event_id: string | null;
  /**
   * On a run the viewer covers, what the run was FOR: the brief if one was
   * given, otherwise the task's name. On a restricted run, always the task's
   * NAME - the masked view refuses to hand over a brief, because a brief is
   * the content of the work (migration 0064).
   */
  task: string;
  /**
   * True when the viewer's own MCP grants do not cover the task this run
   * belongs to. Its prose is withheld - `outcome`, `error` and
   * `confidence_note` are null whatever the run actually recorded - and its
   * transcript, approvals and mail are not readable at all: RLS drops those
   * rows rather than masking them, because a tool_output IS the record it
   * fetched and there is no half of it worth showing.
   *
   * The numbers stay: status, timings, tokens, cost and the confidence score
   * are facts about the run rather than of it, and masking them would make
   * every usage total depend on who was looking.
   *
   * Optional because the trigger-event feed and other narrow reads build an
   * AgentRun-shaped object without going through the view.
   */
  restricted?: boolean;
  status: AgentRunStatus;
  source: "manual" | "webhook" | "email" | "cron" | "gmail" | "microsoft";
  outcome: string | null;
  error: string | null;
  model: string | null;
  effort: string | null;
  autonomy: string | null;
  turns: number;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  confidence: number | null;
  confidence_verdict: AgentRunVerdict | null;
  confidence_note: string | null;
  started_at: string;
  finished_at: string | null;
};

/** Everything the runtime is handed by agent_run_claim. The Worker asks the
    database once and then never needs another lookup - which is also why a
    stolen token yields nothing useful without the matching business. */
export type RunBrief = {
  executionId: string;
  expiresAt: string;
  autonomy: Autonomy;
  /** Effective grant strings after task ∩ member ∩ autonomy. Used to decide
      which tools to advertise; the database enforces it regardless. */
  tools: string[];
  /** How far this run may go: the task's own caps, resolved and recorded when
      the run was minted (migration 0046). The loop reads THESE, never a
      constant - so a cap a member set is the cap that run is held to, and
      editing the task mid-run cannot move the goalposts. */
  caps: RunCaps;
  businessName: string;
  source: string;
  brief: string;
  worker: {
    id: string;
    name: string;
    title: string | null;
    objective: string;
    instructions: string | null;
    personality: string | null;
    tone: string | null;
    skills: string | null;
    model: string;
    effort: string;
    confidence: number | null;
    confidence_runs: number;
  };
  task: { id: string; name: string; details: string | null; tools: string[] } | null;
  trigger: {
    kind: string;
    summary: string;
    payload: Record<string, unknown>;
  } | null;
  /** Set only when this run was PARKED for approval and is being picked up
      again (migration 0051). Null for a fresh run, which is every run of a
      suggest or act agent. */
  resume: RunResume | null;
};

/**
 * Everything a parked run needs to carry on as though it had never stopped.
 *
 * The counters travel with it deliberately: a resumed run keeps spending the
 * SAME budget the caps gave it (0046), because an agent that could reset its
 * own ceiling by asking permission would have found a way around them.
 */
export type RunResume = {
  /** The conversation, exactly as the loop held it when it parked. */
  messages: unknown[];
  /** The half-finished turn: results already collected, calls still queued. */
  pending: {
    results?: unknown[];
    queue?: { id: string; name: string; input: Record<string, unknown> }[];
  };
  turns: number;
  toolCalls: number;
  elapsedMs: number;
  /** What woke a run that was parked waiting for an email reply (migration
      0054). Null for approval parks; exactly one of wake/approval is set on a
      well-formed resume. */
  wake: {
    kind: "email_reply";
    email: {
      id: string;
      threadId: string;
      from: string;
      subject: string | null;
      body: string;
      receivedAt: string;
      /** A bounce, vacation responder or list blast woke the run. The reply
          text says so, so the agent treats it as a signal, not an answer. */
      isAuto: boolean;
    };
  } | null;
  /** The decision, if a person made one. Null means the run was picked up with
      nothing answered, which should not happen and is treated as a failure. */
  approval: {
    id: string;
    state: "approved" | "denied";
    note: string | null;
    decidedBy: string | null;
    toolName: string;
    toolInput: Record<string, unknown>;
    toolUseId: string | null;
    /** A single-purpose token carrying ONLY the grants that one approved call
        needs, minted at claim time and good for two minutes. Null on a denial,
        and null if the task's toolbelt no longer covers the call. */
    token: string | null;
  } | null;
};

/** One mutating call an approve-autonomy agent is waiting on a person for -
    a row of public.agent_approvals, as every surface reads it. */
export type AgentApprovalState =
  | "pending"
  | "approved"
  | "denied"
  | "expired"
  | "cancelled";

export type AgentApproval = {
  id: string;
  execution_id: string;
  worker_id: string;
  created_at: string;
  tool_name: string;
  tool_label: string | null;
  tool_input: Record<string, unknown>;
  summary: string | null;
  risk: "write" | "sensitive";
  state: AgentApprovalState;
  decided_label: string | null;
  decided_at: string | null;
  note: string | null;
};

/* ── Undo (migration 0052) ──────────────────────────────────────────────── */

/**
 * One change a run made, and what undoing it would mean.
 *
 * Computed from the audit trail (PT-1014) AND the current state of whatever it
 * touched, which is why a plan is only true at the moment it was read: a record
 * somebody edits while the preview is on screen moves from `ready` to `changed`.
 * The button re-computes rather than acting on the plan it was shown.
 */
export type UndoStep = {
  audit_id: number;
  at: string;
  op: string;
  entity_type: string | null;
  entity_id: string | null;
  /** Plain words: "Edited a jobs record". */
  label: string;
  /** What undoing it does, in plain words. Null when it cannot be undone. */
  detail: string | null;
  reversible: boolean;
  /** Somebody has edited that record since the run touched it. */
  conflict: boolean;
  /** Why it cannot be undone, when it cannot. */
  reason: string | null;
  /** Preflight: ready | changed | blocked. Afterwards: undone | skipped. */
  state: "ready" | "changed" | "blocked" | "undone" | "skipped";
};

export type UndoPlan = {
  execution_id: string;
  /** False for the preview, true for the record of what was done. */
  applied: boolean;
  steps: UndoStep[];
  total: number;
  reversed: number;
  skipped: number;
  /** How many were left alone because a person has edited them since. */
  changed_since: number;
};

/** What the agent reported about itself. */
export type SelfAssessment = {
  outcome: string;
  confidence: number;
  verdict: AgentRunVerdict;
  reasoning: string;
};

/* ── Confidence presentation ────────────────────────────────────────────── */
// Shared by the ring, the run rows and the worker list so a score is never
// described two different ways.

export type ConfidenceBand = {
  id: "strong" | "steady" | "shaky" | "poor" | "none";
  label: string;
  /** CSS colour token for the ring and dot. */
  color: string;
  blurb: string;
};

export function confidenceBand(score: number | null | undefined): ConfidenceBand {
  if (score === null || score === undefined) {
    return {
      id: "none",
      label: "Not rated",
      color: "var(--c-muted)",
      blurb: "This agent hasn't finished a run yet.",
    };
  }
  if (score >= 90) {
    return {
      id: "strong",
      label: "Strong",
      color: "var(--success, #2f9e6f)",
      blurb: "Consistently finishing its work cleanly.",
    };
  }
  if (score >= 75) {
    return {
      id: "steady",
      label: "Steady",
      color: "#4f9dff",
      blurb: "Getting the job done, with the odd reservation.",
    };
  }
  if (score >= 55) {
    return {
      id: "shaky",
      label: "Shaky",
      color: "#f4b400",
      blurb: "Often unsure it got things right. Worth reviewing its brief.",
    };
  }
  return {
    id: "poor",
    label: "Needs attention",
    color: "#e0455a",
    blurb:
      "Regularly reporting it couldn't finish properly. Re-prompt it, or give it the tools it's missing.",
  };
}

/** The threshold at which the UI actively flags a worker for a human. Set at
    the top of "shaky" so a slide is caught while it is still a trend rather
    than after a failure. */
export const CONFIDENCE_ATTENTION_BELOW = 75;

export function needsAttention(
  score: number | null | undefined,
  runs: number,
): boolean {
  // One bad run isn't a trend - wait for a couple before nagging.
  return score !== null && score !== undefined && runs >= 2 && score < CONFIDENCE_ATTENTION_BELOW;
}

export const VERDICT_META: Record<
  AgentRunVerdict,
  { label: string; badge: string }
> = {
  perfect: { label: "Perfect", badge: "px-badge--emerald" },
  good: { label: "Good", badge: "px-badge--sky" },
  partial: { label: "Partial", badge: "px-badge--amber" },
  failed: { label: "Failed", badge: "px-badge--rose" },
};

export const RUN_STATUS_META: Record<
  AgentRunStatus,
  { label: string; badge: string; dot: string }
> = {
  queued: { label: "Queued", badge: "px-badge--slate", dot: "bg-slate-400" },
  running: { label: "Running", badge: "px-badge--sky", dot: "bg-emerald-500" },
  awaiting_approval: {
    label: "Needs you",
    badge: "px-badge--amber",
    dot: "bg-amber-500",
  },
  awaiting_reply: {
    label: "Waiting on a reply",
    badge: "px-badge--violet",
    dot: "bg-violet-400",
  },
  succeeded: { label: "Finished", badge: "px-badge--emerald", dot: "bg-emerald-500" },
  failed: { label: "Failed", badge: "px-badge--rose", dot: "bg-rose-500" },
  cancelled: { label: "Stopped", badge: "px-badge--slate", dot: "bg-slate-400" },
};

/**
 * A tool output the DATABASE refused to keep, because it did not fit.
 *
 * public.agent_run_step drops a tool_output over 32KB and stores a marker in its
 * place, so the row still records that the call happened. The marker is NOT a
 * payload and must never be offered as one.
 *
 * HISTORY, because the shape of this matters: until migration 0025 the same
 * marker was also written when there was NO output at all, which is the usual
 * case (the runtime only sends a tool_output for started / assessment /
 * finished steps). So every tool call in the table claimed its result had been
 * dropped for size while the result sat in `body` beside it. 0025 makes an
 * absent output NULL and reworded the marker; this check accepts both spellings
 * because a database restored from an older backup would still carry the first.
 */
export function isDroppedOutput(
  output: Record<string, unknown> | null | undefined,
): boolean {
  if (!output) return false;
  const keys = Object.keys(output);
  if (keys.length !== 1) return false;
  return (
    output.dropped === "over 32KB, not stored" ||
    output.note === "output too large to store"
  );
}

/** "1m 24s" / "820ms" / "2h 5m" - for run durations and tool timings. */
export function formatDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || ms < 0) return "";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(s < 10 ? 1 : 0)}s`;
  const m = Math.floor(s / 60);
  const rem = Math.round(s % 60);
  if (m < 60) return rem ? `${m}m ${rem}s` : `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

export function runDurationMs(run: {
  started_at: string;
  finished_at: string | null;
}): number | null {
  const start = Date.parse(run.started_at);
  if (Number.isNaN(start)) return null;
  const end = run.finished_at ? Date.parse(run.finished_at) : Date.now();
  if (Number.isNaN(end)) return null;
  return Math.max(0, end - start);
}
