// Workers are the AI agents a business hires into its Office.

import type { TriggerConfig, TriggerKind } from "@portara/tenant-config/triggers";

import type { Autonomy } from "./agent/models";

/**
 * What a worker IS right now. Never a field somebody types in - every one of
 * these four is read off the world (see `deriveWorkerStatus`):
 *
 *   not_onboarded - nobody has stationed them at a desk on the office floor,
 *                   so they aren't part of the team yet.
 *   halted        - stationed, but a human has deliberately stopped them:
 *                   they CANNOT execute their tasks (the database refuses the
 *                   run, migration 0019 agent_run_begin).
 *   working       - a run of theirs is open right now.
 *   idle          - stationed and free, just not doing anything this second.
 *
 * The stored `workers.status` column is therefore only ever the HALT FLAG -
 * 'halted', or 'idle' meaning "not halted". (Older rows may still read
 * 'not_onboarded' or 'working'; both derive from placement and live runs
 * instead, so they need no migration.) That matches the one status rule the
 * database has always had - a halted worker gets no runs - and the MCP
 * set_agent_status tool, which has only ever offered halted/idle.
 */
export const WORKER_STATUSES = {
  not_onboarded: {
    label: "Not onboarded",
    // One tone name per status, resolved by the UI into whichever class set it
    // needs (`px-badge--slate`, `wm-dot--slate`, ...) - so a status colour is
    // decided once, here, and never spelled out as utility classes again.
    tone: "slate",
    blurb: "Nobody has placed them in the office yet.",
  },
  idle: {
    label: "Idle",
    tone: "amber",
    blurb: "At their desk and ready - not running a task right now.",
  },
  working: {
    label: "Working",
    tone: "emerald",
    blurb: "Running one of their tasks right now.",
  },
  halted: {
    label: "Halted",
    tone: "rose",
    blurb: "Stopped by a human: at their desk, but no task will run.",
  },
} as const;

export type WorkerStatus = keyof typeof WORKER_STATUSES;

/** The two values the stored column carries now: the halt flag, on and off. */
export const HALTED_STATUS = "halted";
export const UNHALTED_STATUS = "idle";

/** Is a human holding this worker back? The stored column IS that flag. */
export function isHalted(worker: Pick<Worker, "status">): boolean {
  return worker.status === HALTED_STATUS;
}

/**
 * The worker's real status, from the three things that decide it:
 * `placed` (stationed at a desk in office_layouts.agents), `halted` (the
 * stored flag) and `running` (an open run in worker_executions).
 *
 * Placement comes first: a worker nobody has put in the office reads as Not
 * onboarded even if the halt flag is set on them - the flag comes back into
 * effect the moment they take a desk.
 */
export function deriveWorkerStatus(input: {
  placed: boolean;
  halted: boolean;
  running: boolean;
}): WorkerStatus {
  if (!input.placed) return "not_onboarded";
  if (input.halted) return "halted";
  return input.running ? "working" : "idle";
}

// Worker personas pick the portlet robot's silhouette (see
// components/office3d/palette.ts ARCHETYPES); the worker id then picks the
// exact accent shade and trims.
export const PERSONAS = [
  { id: "pip", label: "Pip", desc: "Short and round" },
  { id: "otto", label: "Otto", desc: "Tall and boxy" },
] as const;

export function isValidPersona(id: string): boolean {
  return PERSONAS.some((p) => p.id === id);
}

/** Personas aren't a user setting - every worker is dealt one at random, so
    the office floor stays visually varied without another decision to make.
    Shared by the hire form (routes/office.workers.tsx). */
export function randomPersona(): string {
  return PERSONAS[Math.floor(Math.random() * PERSONAS.length)].id;
}

// Where each worker stands on the office floor, as percentages of the scene.
// A worker's desk_slot indexes into this list; the office is "full" when
// every spot is taken.
// Spots follow the v2 floor: desks ring the walls, the center stays open.
export const DESK_SPOTS = [
  { left: 37, top: 30 },
  { left: 56, top: 26 },
  { left: 70, top: 34 },
  { left: 84, top: 46 },
  { left: 78, top: 70 },
  { left: 63, top: 84 },
  { left: 40, top: 86 },
  { left: 26, top: 74 },
  { left: 14, top: 55 },
  { left: 32, top: 52 },
  { left: 52, top: 56 },
  { left: 66, top: 62 },
] as const;

// The open stretch of floor sprites wander around, in % of the scene.
export const FLOOR_BOUNDS = { minX: 24, maxX: 76, minY: 40, maxY: 80 } as const;

export type Worker = {
  id: string;
  name: string;
  title: string | null;
  objective: string;
  instructions: string | null;
  personality: string | null;
  tone: string | null;
  skills: string | null;
  status: WorkerStatus;
  desk_slot: number;
  sprite: string;
  email_slug: string | null;
  /** The seat that hears about this agent (migration 0023). Null is a
      default, not a gap - see resolveWorkerContact. */
  contact_member_id: string | null;
  /** How much a run is allowed to change (migration 0019). 'suggest' is
      read-only and is the default for a newly hired worker - it cannot touch
      business data until someone promotes it. Enforced in the database
      (internal.agent_grant_limit), not just here. */
  autonomy: Autonomy;
  /** Which model its runs use, and how hard it thinks. */
  model: string;
  effort: string;
  /** Rolling self-assessment score (0-100, EWMA) and how many graded runs it
      is built from. Null until the first graded run. */
  confidence: number | null;
  confidence_runs: number;
  confidence_updated_at: string | null;
  created_at: string;
  updated_at: string;
};

// Agent email: <email_slug>.<tenant-slug>@inbox.portara.com.au, routed by
// the portara-email worker (apps/email-ingest). The address is pure data -
// setting email_slug IS creating the mailbox. Slugs are dot-free (the last
// dot in the local part splits worker from tenant).
export const EMAIL_DOMAIN = "inbox.portara.com.au";
export const EMAIL_SLUG_RE = /^[a-z0-9][a-z0-9-]{0,31}$/;

/** The tenant part HQ's own workers use, since HQ has no tenant slug of its
    own. Reserved: a client tenant may not be provisioned as "hq", or its
    agents' mailboxes would collide with the agency's. */
export const HQ_EMAIL_TENANT = "hq";

export function workerEmailAddress(
  emailSlug: string,
  tenantPart: string,
): string {
  return `${emailSlug}.${tenantPart}@${EMAIL_DOMAIN}`;
}

/* ── Point of contact ─────────────────────────────────────────────────────
   Who a human hears from when an agent needs one. A SEAT, not an address:
   where the mail lands is the contact's own business_members.notify_*
   preferences (migration 0022), so someone who moves their alerts to an ops
   inbox moves them once instead of on every agent they look after. */

/** The little of a member this needs. Deliberately no email: the routing
    screens are gated on office.workers.read, and teammates' addresses belong
    behind org.users.read - a name is all that has to be shown. The avatar is
    portal chrome (it renders beside the member everywhere already), so the
    contact picker may show a face without crossing that line. */
export type AgentContact = {
  id: string;
  display_name: string | null;
  role: string;
  avatar: string | null;
};

/** What a business with no dial saved yet is held to. Matches the column
    default in migration 0056 and the old hardcoded UI threshold. */
export const DEFAULT_CONFIDENCE_FLOOR = 75;

/**
 * Who an agent falls back to when nobody has chosen.
 *
 * There is ALWAYS a contact - an agent whose escalation path is "nobody" is
 * the exact failure this feature exists to prevent - so an unset
 * contact_member_id resolves here: the oldest owner, then the oldest admin,
 * then simply the oldest seat. (Oldest-seat-wins is the same tie-break the
 * universal home login uses.) Members must arrive ordered by created_at.
 */
export function defaultContact(members: AgentContact[]): AgentContact | null {
  return (
    members.find((m) => m.role === "owner") ??
    members.find((m) => m.role === "admin") ??
    members[0] ??
    null
  );
}

/**
 * The contact for one worker, and whether a human actually picked them.
 * `explicit: false` is worth showing differently in the UI - it means the
 * agent is on the owner's plate because nobody has said otherwise, not
 * because anyone decided that.
 */
export function resolveWorkerContact(
  worker: Pick<Worker, "contact_member_id">,
  members: AgentContact[],
): { contact: AgentContact | null; explicit: boolean } {
  const chosen = worker.contact_member_id
    ? (members.find((m) => m.id === worker.contact_member_id) ?? null)
    : null;
  return chosen
    ? { contact: chosen, explicit: true }
    : { contact: defaultContact(members), explicit: false };
}

/** A contact's name, never blank. display_name is required at signup, so this
    only fires for seats created by hand. */
export function contactName(contact: AgentContact | null): string {
  return contact?.display_name?.trim() || "Unnamed member";
}

/** Where an outbound message has got to. Inbound mail is always 'received':
    it is here, there is nothing to wait for. Outbound walks queued -> sending
    -> sent | failed, driven by portara-email's cron (migration 0050). */
export type WorkerEmailStatus =
  | "received"
  | "queued"
  | "sending"
  | "sent"
  | "failed"
  | "cancelled";

// One message in an agent's mailbox, in either direction.
export type WorkerEmail = {
  id: string;
  worker_id: string;
  /** The conversation this belongs to. Decided in the database, by reply
      token then header chain then subject - see migration 0050. */
  thread_id: string;
  direction: "inbound" | "outbound";
  status: WorkerEmailStatus;
  /** The run this message belongs to (migration 0050/0054): outbound is
      stamped by the sending run, inbound by the run it resumed. Null for mail
      that never touched a run - a person writing in cold, or a reply that
      arrived after its run finished. */
  execution_id: string | null;
  from_address: string;
  to_address: string;
  cc: string[];
  subject: string | null;
  body_text: string | null;
  message_id: string | null;
  /** Why a send failed, in words a member can act on. Null unless failed. */
  error: string | null;
  sent_at: string | null;
  /** A vacation responder, bounce notice or list blast. Stored, never replied
      to: an agent answering one of these is half of an infinite loop. */
  is_auto: boolean;
  attachments: { name: string; type: string; size: number }[];
  created_at: string;
};

/** One conversation: this agent and one other address. Threads are what the
    Inbox tab lists, because "who am I talking to" is the question a mailbox
    answers - a flat pile of messages is not a mailbox. */
export type WorkerEmailThread = {
  id: string;
  worker_id: string;
  party_address: string;
  subject: string | null;
  message_count: number;
  last_message_at: string;
  last_direction: "inbound" | "outbound" | null;
};

/** How an outbound message's state reads on screen. 'received' and 'sent' get
    no chip: a message that simply arrived or simply went is the normal case,
    and labelling it adds noise to every row. */
export const MAIL_STATUS_META: Record<
  WorkerEmailStatus,
  { label: string; tone: "quiet" | "warn" | "bad" } | null
> = {
  received: null,
  sent: null,
  queued: { label: "Queued", tone: "quiet" },
  sending: { label: "Sending", tone: "quiet" },
  failed: { label: "Not sent", tone: "bad" },
  cancelled: { label: "Cancelled", tone: "warn" },
};

/** The address a reply to a thread goes to, for the composer's own summary. */
export function threadParty(thread: WorkerEmailThread): string {
  return thread.party_address || "an unknown address";
}

/* ── Who an agent may talk to ─────────────────────────────────────────────
   public.business_email_settings (migration 0050; inbound gate added by
   0057). The approved domains and addresses are ONE list doing two jobs:

   INBOUND (0057, every mode): an agent's mailbox only accepts mail from this
   business's own members or the approved list. Everything else bounces at
   SMTP time - unstored, unread, no trigger fired, no parked run woken - so
   an instruction hidden in a stranger's email can never reach a model's
   context. There is deliberately no "open" for receiving.

   OUTBOUND (0050): the mode below governs STARTING a conversation. Replying
   inside a thread is always allowed - since 0057 the other party had to be
   an approved sender to be in the thread at all. */

export type EmailSendMode = "reply_only" | "allowlist" | "open";

export type BusinessEmailSettings = {
  mode: EmailSendMode;
  /** Bare domains, no @ and no wildcards: "acme.com.au" covers every address
      at it. */
  allowed_domains: string[];
  allowed_addresses: string[];
  /** Outbound messages per day for the whole business, agents and humans. */
  daily_cap: number;
};

/** What a business with no row saved yet is held to. Matches the column
    defaults in migration 0050, which is the ceiling either way. */
export const DEFAULT_EMAIL_SETTINGS: BusinessEmailSettings = {
  mode: "allowlist",
  allowed_domains: [],
  allowed_addresses: [],
  daily_cap: 50,
};

export const EMAIL_SEND_MODES: {
  id: EmailSendMode;
  label: string;
  blurb: string;
}[] = [
  {
    id: "reply_only",
    label: "Replies only",
    blurb:
      "Agents never write first. They answer your team and approved senders who write to them.",
  },
  {
    id: "allowlist",
    label: "Replies, plus the approved list",
    blurb:
      "Agents answer your team and approved senders, and may write first to anyone on the approved list.",
  },
  {
    id: "open",
    label: "Anyone",
    blurb:
      "Agents may write first to any address. Incoming mail is still only accepted from your team and the approved list, so an unapproved address's reply will bounce - keep the list ahead of who agents talk to.",
  },
];

/** Textarea in, array out: one entry per line, blanks and duplicates gone. */
export function parseEmailList(raw: string): string[] {
  const seen = new Set<string>();
  for (const line of raw.split(/[\n,]/)) {
    const one = line.trim().toLowerCase();
    if (one) seen.add(one);
  }
  return [...seen];
}

// A standing task the worker is allowed to run. The worker's profile
// (objective/instructions/personality) is the overarching brief; tasks are
// the named jobs it may pick up ("Generate leads", "Follow up with a lead").
// One worker holds one or many tasks; executions are the run log.
export type WorkerTask = {
  id: string;
  worker_id: string;
  name: string;
  /**
   * True when the viewer's own MCP grants do not cover this task's toolbelt
   * (migration 0063). A restricted task arrives as its NAME and nothing else:
   * `details` is null, `tools` is empty and every cap is null, withheld by
   * worker_tasks_visible() rather than by the caller remembering to hide
   * them. The viewer cannot open, edit, delete, run or schedule it either -
   * that is enforced in RLS and in agent_run_begin, not here.
   *
   * The name survives on purpose. A task that vanished would read as a broken
   * portal, and would hide the fact that an agent in this office does
   * something the viewer is not cleared for - which is the one thing they
   * should be able to see and ask about.
   */
  restricted: boolean;
  /** When restricted, the grants the viewer is missing, so the UI can print
      "Required scope:" and they know what to ask for. Empty otherwise. */
  missing_grants: string[];
  details: string | null;
  /** The task's toolbelt: MCP tool names it may use (migration 0018). Empty
      means the task can plan and write, but touch nothing - OR that it is
      restricted and the belt was withheld. Who may put a tool here is decided
      by the author's own MCP grants - see lib/mcp/task-tools.ts. */
  tools: string[];
  /** How far one run of this task may go (migration 0046). The columns are
      NOT NULL and bounded, so a task always HAS a worst case somebody wrote
      down - null here means restricted, not unbounded. Nullable so the
      compiler asks about the difference at every render site. */
  max_turns: number | null;
  max_seconds: number | null;
  max_tool_calls: number | null;
  created_at: string;
  updated_at: string;
};

// How a worker's task gets started automatically (migration 0016). One
// worker holds many triggers; each points at one of the worker's tasks (or
// null = the worker decides). Firing appends a WorkerTriggerEvent - the
// queue/audit trail - never code execution by itself.
export type WorkerTrigger = {
  id: string;
  worker_id: string;
  task_id: string | null;
  kind: TriggerKind;
  label: string;
  enabled: boolean;
  config: TriggerConfig;
  next_run_at: string | null;
  last_fired_at: string | null;
  created_at: string;
  updated_at: string;
};

export type WorkerTriggerEvent = {
  id: string;
  trigger_id: string | null;
  worker_id: string;
  kind: string;
  status: "pending" | "picked_up" | "done" | "dismissed";
  summary: string;
  created_at: string;
};

// A run of one of the worker's tasks. Migration 0019 turned this from a
// three-column log into the full record of an agent run - what started it,
// what it cost, and how the agent graded its own work - so the shape lives
// with the rest of the agent runtime and is re-exported here for the routes
// that have always imported it from this file.
export type { AgentRun as WorkerExecution } from "./agent/types";
