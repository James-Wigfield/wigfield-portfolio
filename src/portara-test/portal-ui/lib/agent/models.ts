// The agent runtime's public vocabulary: which models a worker may run on,
// how hard it thinks, how much it is allowed to change, and what a run costs.
//
// Client-safe on purpose (no server imports) - the worker Profile tab renders
// these lists, the loader validates a submission against the same constants,
// and the runtime prices a finished run with the same table. One source of
// truth for all three.

import { CORE_READ_ONLY_TOOLS } from "../mcp/catalog";

/* ── Models ──────────────────────────────────────────────────────────────── */

export type AgentModelId =
  | "claude-opus-5"
  | "claude-sonnet-5"
  | "claude-haiku-4-5";

/**
 * How a model wants to be asked to think. These are NOT cosmetic - sending the
 * wrong one is a hard 400, which cost a live run to learn:
 *
 *   "adaptive"  4.6-generation and later. `thinking: {type:"adaptive"}`, and
 *               `output_config.effort` controls depth.
 *   "budget"    pre-4.6 (Haiku 4.5). Adaptive thinking is REJECTED; extended
 *               thinking is `{type:"enabled", budget_tokens:N}` with N below
 *               max_tokens. `effort` is rejected too.
 *   "none"      don't ask for thinking at all.
 */
export type ThinkingMode = "adaptive" | "budget" | "none";

export type AgentModel = {
  id: AgentModelId;
  label: string;
  blurb: string;
  /** USD per million tokens, for the per-run cost estimate. */
  inputPerMTok: number;
  outputPerMTok: number;
  /** Cheap shorthand for the picker. */
  priceHint: string;
  thinkingMode: ThinkingMode;
  /** Tokens of reasoning to ask for when thinkingMode is "budget". */
  thinkingBudget?: number;
  /** Whether output_config.effort is accepted. False = omit it entirely. */
  supportsEffort: boolean;
  /** Hard ceiling on output tokens for this model. */
  maxOutput: number;
};

export const AGENT_MODELS: AgentModel[] = [
  {
    id: "claude-haiku-4-5",
    label: "Haiku 4.5",
    blurb:
      "Fastest and cheapest by a wide margin. Great for narrow, well-specified jobs like triage, tidying and drafting. It still shows its reasoning, but it doesn't take a thinking-effort setting.",
    inputPerMTok: 1,
    outputPerMTok: 5,
    priceHint: "Cheapest",
    // Pre-4.6: adaptive thinking and effort are both 400s here.
    thinkingMode: "budget",
    thinkingBudget: 2048,
    supportsEffort: false,
    maxOutput: 64000,
  },
  {
    id: "claude-sonnet-5",
    label: "Sonnet 5",
    blurb:
      "Close to Opus on tool work for a fraction of the cost. A good middle ground for agents that run often but still have to judge things.",
    inputPerMTok: 3,
    outputPerMTok: 15,
    priceHint: "Balanced",
    thinkingMode: "adaptive",
    supportsEffort: true,
    maxOutput: 128000,
  },
  {
    id: "claude-opus-5",
    label: "Opus 5",
    blurb:
      "Best judgment on tangled, multi-step work. The most expensive by some way, so keep it for agents whose decisions actually matter.",
    inputPerMTok: 5,
    outputPerMTok: 25,
    priceHint: "Highest quality",
    thinkingMode: "adaptive",
    supportsEffort: true,
    maxOutput: 128000,
  },
];

/** Cheapest by default: an agent that runs on a schedule can burn real money,
    and most standing tasks are narrow enough for Haiku. Promote individual
    workers to Sonnet or Opus on their Profile tab where the judgment is worth
    paying for. */
export const DEFAULT_MODEL: AgentModelId = "claude-haiku-4-5";

export function isValidModel(id: string): id is AgentModelId {
  return AGENT_MODELS.some((m) => m.id === id);
}

export function modelMeta(id: string): AgentModel {
  return AGENT_MODELS.find((m) => m.id === id) ?? AGENT_MODELS[0];
}

/* ── Effort ──────────────────────────────────────────────────────────────── */
// output_config.effort. Controls how much the agent thinks AND how much it
// does per turn - on Opus 5 the low end is unusually strong, so the ladder is
// a genuine cost lever rather than a quality cliff.

export const AGENT_EFFORTS = [
  { id: "low", label: "Low", blurb: "Quick and literal. Short, scoped jobs." },
  { id: "medium", label: "Medium", blurb: "Cost-conscious. Good for frequent runs." },
  { id: "high", label: "High", blurb: "The default. Thinks before acting." },
  { id: "xhigh", label: "Very high", blurb: "For tangled, multi-step work." },
  { id: "max", label: "Max", blurb: "Correctness over cost. Slow and expensive." },
] as const;

export type AgentEffort = (typeof AGENT_EFFORTS)[number]["id"];

export const DEFAULT_EFFORT: AgentEffort = "high";

export function isValidEffort(id: string): id is AgentEffort {
  return AGENT_EFFORTS.some((e) => e.id === id);
}

export function effortMeta(id: string) {
  return AGENT_EFFORTS.find((e) => e.id === id) ?? AGENT_EFFORTS[2];
}

/* ── Autonomy ────────────────────────────────────────────────────────────── */
// How much a run is allowed to have changed when it finishes. This is the
// safety switch: a new worker starts on "suggest" and cannot touch business
// data until someone promotes it deliberately.
//
// The gate is NOT here - it is internal.agent_grant_limit in migration 0019,
// which strips every mutating grant from a 'suggest' run before the token is
// minted. This constant only describes it.

export const AUTONOMY_LEVELS = [
  {
    id: "suggest",
    label: "Suggest only",
    short: "Suggests",
    blurb:
      "Reads data and reports what it would do. It cannot create, edit or delete anything, whatever its tasks allow.",
    badge: "px-badge--slate",
  },
  {
    id: "approve",
    label: "Ask before it changes anything",
    short: "Asks first",
    blurb:
      "Reads freely, but stops and waits for one of you before every change. The run pauses where it is and picks up exactly there once you answer.",
    badge: "px-badge--sky",
  },
  {
    id: "act",
    label: "Act on its own",
    short: "Acts",
    blurb:
      "Uses the full toolbelt on each task, including tools that change records. Only its tasks limit it.",
    badge: "px-badge--amber",
  },
] as const;

export type Autonomy = (typeof AUTONOMY_LEVELS)[number]["id"];

export const DEFAULT_AUTONOMY: Autonomy = "suggest";

export function isValidAutonomy(id: string): id is Autonomy {
  return AUTONOMY_LEVELS.some((a) => a.id === id);
}

export function autonomyMeta(id: string) {
  return AUTONOMY_LEVELS.find((a) => a.id === id) ?? AUTONOMY_LEVELS[0];
}

/* ── The read-only allowlist, kept honest ───────────────────────────────── */
// internal.agent_read_only_grants() (migration 0019, extended by 0034)
// hard-codes the tools a 'suggest' run keeps. The database is the ceiling, but
// if the two lists ever disagree the UI would promise a tool the run cannot use
// (or, worse, imply a write tool is safe). Assert at module load - the same
// technique lib/extension.ts uses for tool ids and MCP names.
//
// The allowlist covers MORE than the shared catalog, because an app may
// register MCP servers of its own that tenant portals do not serve (HQ's
// ticketing, migration 0034). This package must not know those tools exist, so
// the assertion here is a SUBSET check on the shared half, and the app that
// owns the extras asserts them against DB_READ_ONLY_EXTRAS - see
// apps/control-plane/app/lib/mcp/tickets-catalog.ts. Between the two, every
// name on the database's list is accounted for by exactly one owner.

/** Mirror of internal.agent_read_only_grants(), as bare tool names. */
export const DB_READ_ONLY_TOOLS = [
  "describe_office",
  "list_worker_executions",
  "get_company_details",
  "list_users",
  "list_roles",
  // The agent's own mailbox (0050). A suggest-autonomy agent should be able to
  // read its mail and say what it would reply; sending is a write.
  "list_emails",
  "read_email_thread",
  // HQ's ticketing server (0034) - not in the shared catalog, see above.
  "list_tickets",
  "get_ticket",
  "ticket_stats",
] as const;

/** The allowlist entries that belong to an app-registered server rather than
    to the shared catalog. That app asserts these against its own tools. */
export const DB_READ_ONLY_EXTRAS: string[] = DB_READ_ONLY_TOOLS.filter(
  (t) => !CORE_READ_ONLY_TOOLS.includes(t),
);

{
  const dbSet = new Set<string>(DB_READ_ONLY_TOOLS);
  const missing = [...CORE_READ_ONLY_TOOLS].sort().filter((t) => !dbSet.has(t));
  if (missing.length > 0) {
    throw new Error(
      "agent/models.ts: the read-only tool allowlist has drifted from the " +
        "database. Update internal.agent_read_only_grants() (migration 0019) " +
        "and DB_READ_ONLY_TOOLS together.\n" +
        `  catalog risk:"read" missing from the database -> ${missing.join(", ")}`,
    );
  }
}

/* ── Cost ────────────────────────────────────────────────────────────────── */

/* Prompt caching is priced as a MULTIPLE of a model's base input rate rather
   than as its own per-model number, which is why these are ratios and not two
   more columns on AgentModel: Anthropic publishes them that way, they are the
   same across the family, and a fourth column is a fourth thing to keep in
   step with a price list. */

/** Writing a prefix into the cache costs 1.25x input. Paid once per run (and
    again if the five-minute window lapses mid-run). */
export const CACHE_WRITE_MULTIPLIER = 1.25;
/** Reading it back costs 0.1x input. This is the whole point. */
export const CACHE_READ_MULTIPLIER = 0.1;

/** What one turn's prompt actually consisted of. The three input figures are
    priced differently, so a run that lumped them together would misreport its
    own cost - see the note in gateway.server.ts's message_start handler. */
export type RunUsage = {
  /** Uncached prompt tokens, at the full input rate. */
  input: number;
  cacheWrite: number;
  cacheRead: number;
  output: number;
};

/** Every prompt token a run consumed, however it was billed. This is "input
    tokens" in the sense a person means it, and what the usage pages total. */
export function promptTokens(usage: RunUsage): number {
  return usage.input + usage.cacheWrite + usage.cacheRead;
}

/** USD for one run. Billing of record is Cloudflare AI Gateway's own
    accounting; this is the figure we show next to a run so a member can see
    what their agents cost without leaving the portal. */
export function runCost(model: string, usage: RunUsage): number {
  const m = modelMeta(model);
  const inputTokens =
    usage.input +
    usage.cacheWrite * CACHE_WRITE_MULTIPLIER +
    usage.cacheRead * CACHE_READ_MULTIPLIER;
  const outputTokens = usage.output;
  const cost =
    (inputTokens / 1_000_000) * m.inputPerMTok +
    (outputTokens / 1_000_000) * m.outputPerMTok;
  // Six decimals matches worker_executions.cost_usd numeric(12,6).
  return Math.round(cost * 1_000_000) / 1_000_000;
}

/** "$0.0041" / "<$0.0001" / "$1.24" - short enough for a table cell. */
export function formatCost(usd: number): string {
  if (!usd) return "$0";
  if (usd < 0.0001) return "<$0.0001";
  if (usd < 1) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(2)}`;
}

export function formatTokens(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}k`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}

/* ── Run token audience ──────────────────────────────────────────────────── */

/**
 * Audience stamped on every agent run token.
 *
 * Run tokens live in the same mcp_access_tokens table as human OAuth tokens
 * (so they flow through the same validated dispatcher - see migration 0019),
 * and this is what keeps the two apart: /mcp checks the audience against its
 * resource URL, so a run token presented there fails the audience test and is
 * rejected. A leaked run token cannot be used to open an MCP session.
 *
 * Lives here rather than in runtime.server.ts because the route action needs it
 * when minting, and shouldn't have to import the server-only runtime for a
 * string.
 */
export const AGENT_TOKEN_AUDIENCE = "agent-run";

/* ── Run limits ──────────────────────────────────────────────────────────── */

export const RUN_LIMITS = {
  /** max_tokens per model turn. Streaming, so a generous ceiling is safe.
      Not a per-task cap: it bounds one reply, not one run, and no member has
      a reason to tune it. The three that ARE per-task are below. */
  maxTokensPerTurn: 8000,
} as const;

/* ── Run caps ────────────────────────────────────────────────────────────── */
// How far ONE run of ONE task may go before the loop stops it. Set per task
// (worker_tasks.max_turns / max_seconds / max_tool_calls, migration 0046),
// resolved when the run is minted, and recorded on agent_runs so what a run
// was held to is evidence rather than whatever the code happened to say that
// week.
//
// THE THREE ARE NOT INTERCHANGEABLE, which is why there are three:
//   steps   bound how much THINKING a run may do. A confused agent burns
//           these without touching anything.
//   time    bounds how long anything is in flight. This is the one that
//           matters when nobody is watching.
//   actions bound the BLAST RADIUS - each one is a real tool call against
//           real records, so this is the cap that decides how much a bad run
//           can change before it runs out of rope.
//
// Every task must carry all three. There is no "unlimited": an agent with no
// ceiling is one whose worst case nobody has ever had to write down.

export type RunCaps = {
  maxTurns: number;
  maxSeconds: number;
  maxToolCalls: number;
};

/** The column a cap lives in. Same names in worker_tasks and agent_runs. */
export type RunCapColumn = "max_turns" | "max_seconds" | "max_tool_calls";

export type RunCapDef = {
  id: keyof RunCaps;
  column: RunCapColumn;
  /** What the control is called. Plain words - "Steps", not "maxTurns". */
  label: string;
  /** Stored unit divided by this = the unit a person edits in. Seconds are
      stored (the runtime wants ms) but nobody sets a cap in seconds. */
  scale: number;
  /** Unit suffix in the person's units, singular. */
  unit: string;
  /** All in STORED units. */
  min: number;
  max: number;
  step: number;
  fallback: number;
  /** Above this the UI says so. Not a block - a sentence. */
  risky: number;
  help: string;
  /** What specifically gets worse as this one climbs. Shown in the warning,
      so it has to say something the number alone doesn't. */
  risk: string;
};

/**
 * The ceilings, and where they come from.
 *
 * `max` is not a taste judgment - each one is the point where something else
 * in the platform breaks first:
 *   steps + actions  the database refuses a 401st trace step (agent_run_step),
 *                    and a run writes roughly 2 steps per tool call plus one
 *                    or two per turn. 60 + 120 lands near 360, with room.
 *   time             the trigger runner drains a queue inside one 900s cron
 *                    invocation (see audit/SCALE-REPORT.md 3.3), so a long
 *                    scheduled run eats the window other agents queue in.
 */
export const RUN_CAP_DEFS: RunCapDef[] = [
  {
    id: "maxTurns",
    column: "max_turns",
    label: "Steps",
    scale: 1,
    unit: "step",
    min: 1,
    max: 60,
    step: 1,
    fallback: 24,
    risky: 40,
    help: "How many times it can think and act before it has to stop and report.",
    risk: "a long run costs more and takes longer to notice",
  },
  {
    id: "maxSeconds",
    column: "max_seconds",
    label: "Time",
    scale: 60,
    unit: "min",
    min: 60,
    max: 900,
    step: 60,
    fallback: 600,
    risky: 720,
    help: "Wall clock for the whole run, however far it got.",
    risk:
      "scheduled runs share one 15-minute window, so a long one holds up other agents' queues",
  },
  {
    id: "maxToolCalls",
    column: "max_tool_calls",
    label: "Actions",
    scale: 1,
    unit: "action",
    min: 1,
    max: 120,
    // 1, not a coarser stride. A number input's valid values are min + n*step,
    // so a stride of 5 from a min of 1 would make 1, 6, 11 ... 56, 61 the only
    // acceptable numbers - and the default of 60 would not be one of them. The
    // range slider inherits the same ladder, so it could not land on 60 or 120
    // either. Every cap's ladder has to contain its own default and presets.
    step: 1,
    fallback: 60,
    risky: 90,
    help: "Tool calls in total. Every one of these touches something real.",
    risk: "this is the blast radius - it is how much a run that goes wrong can change",
  },
];

export function runCapDef(id: keyof RunCaps): RunCapDef {
  return RUN_CAP_DEFS.find((d) => d.id === id)!;
}

/** Must match the column defaults in migration 0046. Both exist because a run
    minted by the database (a trigger, an ad-hoc run with no task) needs an
    answer without asking the app, and the app needs one to pre-fill a form. */
export const DEFAULT_RUN_CAPS: RunCaps = {
  maxTurns: 24,
  maxSeconds: 600,
  maxToolCalls: 60,
};

/** Ready-made sets, because most people want a shape rather than three
    numbers. Custom is still the norm - these are a starting point. */
export const RUN_CAP_PRESETS: { id: string; label: string; blurb: string; caps: RunCaps }[] = [
  {
    id: "tight",
    label: "Tight",
    blurb: "One narrow job: a triage pass, a tidy-up, a single email.",
    caps: { maxTurns: 8, maxSeconds: 180, maxToolCalls: 15 },
  },
  {
    id: "standard",
    label: "Standard",
    blurb: "The default. Enough rope for most standing tasks.",
    caps: DEFAULT_RUN_CAPS,
  },
  {
    id: "long",
    label: "Long job",
    blurb: "Multi-step work with a lot of looking things up.",
    caps: { maxTurns: 45, maxSeconds: 780, maxToolCalls: 100 },
  },
];

/* A number input accepts only min + n*step, and its range slider walks the
   same ladder. A default or preset sitting off that ladder is not a cosmetic
   problem: the browser refuses the form with "please enter a valid value" and
   names the two nearest legal numbers, which is how a stride of 5 from a min
   of 1 shipped a toolbelt cap that could not be saved at its own default.
   Assert at module load, the same technique the read-only tool list uses. */
{
  const onLadder = (def: RunCapDef, v: number) =>
    v >= def.min && v <= def.max && (v - def.min) % def.step === 0;
  const bad: string[] = [];
  for (const def of RUN_CAP_DEFS) {
    if (!onLadder(def, def.fallback)) {
      bad.push(`${def.column} default ${def.fallback}`);
    }
    for (const p of RUN_CAP_PRESETS) {
      if (!onLadder(def, p.caps[def.id])) {
        bad.push(`${def.column} preset "${p.id}" ${p.caps[def.id]}`);
      }
    }
  }
  if (bad.length > 0) {
    throw new Error(
      "agent/models.ts: a run cap is off its own min/step ladder, so the " +
        "browser will refuse to submit the task form.\n  " +
        bad.join("\n  "),
    );
  }
}

/** Which preset a set of caps IS, if any. */
export function matchRunCapPreset(caps: RunCaps): string | null {
  const hit = RUN_CAP_PRESETS.find(
    (p) =>
      p.caps.maxTurns === caps.maxTurns &&
      p.caps.maxSeconds === caps.maxSeconds &&
      p.caps.maxToolCalls === caps.maxToolCalls,
  );
  return hit?.id ?? null;
}

export function clampRunCap(def: RunCapDef, value: number): number {
  if (!Number.isFinite(value)) return def.fallback;
  return Math.min(def.max, Math.max(def.min, Math.round(value)));
}

/**
 * Read a submitted set of caps.
 *
 * Deliberately strict where autonomy is deliberately lenient: a form that
 * forgets `autonomy` falls back to the SAFE value, but a form that forgets a
 * cap has no safe value to fall back to - the whole point is that somebody
 * decided. So a missing or unreadable cap is an error the member sees, not a
 * default they never chose.
 *
 * Returns the caps, or a sentence to show them.
 */
export function readRunCaps(
  get: (column: RunCapColumn) => string | null | undefined,
): RunCaps | { error: string } {
  const out = {} as RunCaps;
  for (const def of RUN_CAP_DEFS) {
    const raw = (get(def.column) ?? "").toString().trim();
    if (!raw) {
      return { error: `Set a ${def.label.toLowerCase()} limit for this task.` };
    }
    const n = Number(raw);
    if (!Number.isFinite(n)) {
      return { error: `${def.label} has to be a number.` };
    }
    const rounded = Math.round(n);
    if (rounded < def.min || rounded > def.max) {
      return {
        error: `${def.label} has to be between ${formatRunCap(def, def.min)} and ${formatRunCap(def, def.max)}.`,
      };
    }
    out[def.id] = rounded;
  }
  return out;
}

/** The caps above their comfortable mark. Empty is the normal answer. */
export function riskyRunCaps(caps: RunCaps): RunCapDef[] {
  return RUN_CAP_DEFS.filter((d) => caps[d.id] > d.risky);
}

/** "24 steps" / "10 min" / "60 actions", in the person's units. */
export function formatRunCap(def: RunCapDef, stored: number): string {
  const shown = stored / def.scale;
  const n = Number.isInteger(shown) ? String(shown) : shown.toFixed(1);
  if (def.unit === "min") return `${n} min`;
  return `${n} ${def.unit}${shown === 1 ? "" : "s"}`;
}

/** The whole set as one line: "24 steps · 10 min · 60 actions". */
export function summariseRunCaps(caps: RunCaps): string {
  return RUN_CAP_DEFS.map((d) => formatRunCap(d, caps[d.id])).join(" · ");
}
