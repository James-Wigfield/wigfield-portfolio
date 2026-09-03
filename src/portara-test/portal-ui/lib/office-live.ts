// The office floor's live layer: ONE EventSource against /agent/office-feed
// (apps/*/app/lib/agent/endpoint.server.ts) feeding the whole floor, so nobody
// ever refreshes a page to see an agent start working.
//
// Two kinds of event come down the wire, and they are handled differently on
// purpose:
//
//   snapshots (runs / approvals / workers) - the server resends the FULL set
//   whenever it changes. Applying one is idempotent, so a dropped frame can
//   never wedge the floor's picture: the next snapshot repaints it whole.
//
//   moments (trigger / email) - append-only rows streamed once each, cursored
//   by created_at. These become the transient pops over an agent's head;
//   missing one loses a pop, never state.
//
// The hook merges the live picture OVER the loader's snapshot rather than
// replacing it: the loader stays the source of names, sprites and placement,
// and the stream only ever overrides the live facts (status, task, waiting,
// last run). Until the first snapshot arrives the loader's values pass through
// untouched, so the floor never flashes empty while connecting.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { WorkerStatus } from "./workers";

/** One run as the office feed reports it - open, or finished seconds ago. */
export type OfficeLiveRun = {
  id: string;
  worker_id: string;
  task: string | null;
  status: string;
  started_at: string | null;
  finished_at: string | null;
};

type LiveApproval = {
  worker_id: string;
  label: string;
  risk: "write" | "sensitive";
};

/** A transient callout over one agent's head. */
export type OfficePop = {
  /** Derived from the event's own id, so a resent event never pops twice. */
  id: string;
  workerId: string;
  kind: "started" | "done" | "failed" | "trigger" | "email";
  text: string;
};

/** The little of a worker the merge needs - both floors' loader shapes
    satisfy this (HQ's carries no lastRunAt, which is why it is optional). */
type LiveWorker = {
  id: string;
  status: WorkerStatus;
  task?: string | null;
  lastRunAt?: string | null;
  waiting?: { label: string; risk: "write" | "sensitive" } | null;
};

/** How long a pop stays over the head. portal.css's fade-out keyframe is
    timed to finish just before this removal, so the element never blinks out
    of the DOM mid-paint. */
const POP_MS = 6000;
const RETRY_MS = 3000;

/** ISO comparison through Date.parse, never lexicographic: the browser writes
    cursors as "...Z" while PostgREST returns "...+00:00", and comparing those
    as strings sorts them by punctuation. */
const laterIso = (a: string, b: string) => Date.parse(a) > Date.parse(b);

/**
 * Tail the whole floor over SSE and merge what arrives over the loader's
 * workers. `version` bumps on every change the stream reports - it exists so a
 * host with a snapshot-based side panel (the stage console) can refetch that
 * panel when the world moves under it.
 */
export function useOfficeLive<W extends LiveWorker>(
  workers: W[],
): { workers: W[]; pops: OfficePop[]; live: boolean; version: number } {
  const [runs, setRuns] = useState<OfficeLiveRun[] | null>(null);
  const [approvals, setApprovals] = useState<LiveApproval[] | null>(null);
  const [flags, setFlags] = useState<Record<string, string> | null>(null);
  const [pops, setPops] = useState<OfficePop[]>([]);
  const [live, setLive] = useState(false);
  const [version, setVersion] = useState(0);

  // The previous runs snapshot, so a new frame can be read as TRANSITIONS
  // (started / finished) rather than just a new state.
  const prevRuns = useRef<Map<string, OfficeLiveRun> | null>(null);
  // Newest started_at seen per worker. Runs leave the snapshot shortly after
  // they finish, and "last ran" must not fall back to the loader's stale
  // value when they do.
  const lastStarted = useRef(new Map<string, string>());
  // Live pop timers, and every event id already popped: a reconnect replays
  // the cursor window, and a replayed moment must not pop twice. Unbounded on
  // purpose - a day on the floor is a few thousand short strings.
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const popped = useRef(new Set<string>());
  // Where the moment cursor is up to, handed back on every reconnect.
  const cursor = useRef<string | null>(null);

  const pushPop = useCallback((pop: OfficePop) => {
    if (popped.current.has(pop.id)) return;
    popped.current.add(pop.id);
    // One pop per agent: the newest replaces whatever was still fading.
    setPops((prev) => [...prev.filter((p) => p.workerId !== pop.workerId), pop]);
    const t = setTimeout(() => {
      timers.current.delete(t);
      setPops((prev) => prev.filter((p) => p.id !== pop.id));
    }, POP_MS);
    timers.current.add(t);
  }, []);

  useEffect(() => {
    let source: EventSource | null = null;
    let stopped = false;
    let retry: ReturnType<typeof setTimeout> | null = null;

    const advance = (iso: string) => {
      if (!cursor.current || laterIso(iso, cursor.current)) cursor.current = iso;
    };

    const connect = () => {
      if (stopped) return;
      const qs = cursor.current
        ? `?since=${encodeURIComponent(cursor.current)}`
        : "";
      source = new EventSource(`/agent/office-feed${qs}`);

      source.addEventListener("runs", (e) => {
        try {
          const rows = JSON.parse((e as MessageEvent).data) as OfficeLiveRun[];
          const prev = prevRuns.current;
          for (const r of rows) {
            if (r.started_at) {
              const seen = lastStarted.current.get(r.worker_id);
              if (!seen || laterIso(r.started_at, seen)) {
                lastStarted.current.set(r.worker_id, r.started_at);
              }
            }
            // Pops only against a PREVIOUS frame: the first snapshot is the
            // state of the world at connect, not news.
            if (!prev) continue;
            const before = prev.get(r.id);
            const terminal =
              r.status === "succeeded" ||
              r.status === "failed" ||
              r.status === "cancelled";
            if (!before && (r.status === "running" || r.status === "queued")) {
              pushPop({
                id: `run-${r.id}`,
                workerId: r.worker_id,
                kind: "started",
                text: r.task ?? "Started a run",
              });
            } else if (terminal && (!before || before.status !== r.status)) {
              pushPop({
                id: `run-${r.id}-${r.status}`,
                workerId: r.worker_id,
                kind: r.status === "succeeded" ? "done" : "failed",
                text:
                  r.status === "succeeded"
                    ? "Finished"
                    : r.status === "cancelled"
                      ? "Stopped"
                      : "Run failed",
              });
            }
          }
          prevRuns.current = new Map(rows.map((r) => [r.id, r]));
          setRuns(rows);
          setVersion((v) => v + 1);
        } catch {
          /* a malformed frame is not worth killing the feed over */
        }
      });

      source.addEventListener("approvals", (e) => {
        try {
          setApprovals(JSON.parse((e as MessageEvent).data) as LiveApproval[]);
          setVersion((v) => v + 1);
        } catch {
          /* ignore */
        }
      });

      source.addEventListener("workers", (e) => {
        try {
          const rows = JSON.parse((e as MessageEvent).data) as {
            id: string;
            status: string;
          }[];
          setFlags(Object.fromEntries(rows.map((r) => [r.id, r.status])));
          setVersion((v) => v + 1);
        } catch {
          /* ignore */
        }
      });

      source.addEventListener("trigger", (e) => {
        try {
          const t = JSON.parse((e as MessageEvent).data) as {
            id: string;
            worker_id: string;
            summary: string | null;
            created_at: string;
          };
          advance(t.created_at);
          pushPop({
            id: `trig-${t.id}`,
            workerId: t.worker_id,
            kind: "trigger",
            text: t.summary || "Trigger fired",
          });
          setVersion((v) => v + 1);
        } catch {
          /* ignore */
        }
      });

      source.addEventListener("email", (e) => {
        try {
          const m = JSON.parse((e as MessageEvent).data) as {
            id: string;
            worker_id: string;
            subject: string | null;
            from_address: string;
            created_at: string;
          };
          advance(m.created_at);
          pushPop({
            id: `mail-${m.id}`,
            workerId: m.worker_id,
            kind: "email",
            text: m.subject || `Mail from ${m.from_address}`,
          });
          setVersion((v) => v + 1);
        } catch {
          /* ignore */
        }
      });

      // The endpoint caps a connection at five minutes; this is how it tells
      // us to come back for more, with the cursor to resume from.
      source.addEventListener("reconnect", (e) => {
        try {
          const { since } = JSON.parse((e as MessageEvent).data) as {
            since?: string;
          };
          if (since) advance(since);
        } catch {
          /* ignore */
        }
        source?.close();
        if (!stopped) connect();
      });

      source.onopen = () => setLive(true);

      source.onerror = () => {
        source?.close();
        setLive(false);
        if (stopped) return;
        // Browsers reconnect EventSource automatically, but we've closed it
        // to control the cursor - so back off and reconnect ourselves.
        retry = setTimeout(connect, RETRY_MS);
      };
    };

    connect();

    return () => {
      stopped = true;
      if (retry) clearTimeout(retry);
      source?.close();
      setLive(false);
      for (const t of timers.current) clearTimeout(t);
      timers.current.clear();
    };
  }, [pushPop]);

  // The merge. Each live dimension only overrides once its first snapshot has
  // landed (`runs`/`approvals`/`flags` start null), so the loader's values
  // hold the floor until the stream is actually talking.
  const merged = useMemo(() => {
    if (runs === null && approvals === null && flags === null) return workers;
    return workers.map((w) => {
      const halted = flags ? flags[w.id] === "halted" : w.status === "halted";
      const runningRun = runs
        ? (runs.find((r) => r.worker_id === w.id && r.status === "running") ??
          null)
        : null;
      const running = runs ? runningRun !== null : w.status === "working";
      // Placement isn't streamed - the builder edits it locally - so a worker
      // the loader called not_onboarded stays that way until it revalidates.
      const status: WorkerStatus =
        w.status === "not_onboarded"
          ? w.status
          : halted
            ? "halted"
            : running
              ? "working"
              : "idle";
      const ask = approvals
        ? (approvals.find((a) => a.worker_id === w.id) ?? null)
        : null;
      const waiting = approvals
        ? ask && { label: ask.label, risk: ask.risk }
        : (w.waiting ?? null);
      const liveLast = lastStarted.current.get(w.id) ?? null;
      const lastRunAt =
        liveLast && (!w.lastRunAt || laterIso(liveLast, w.lastRunAt))
          ? liveLast
          : (w.lastRunAt ?? null);
      return {
        ...w,
        status,
        task: runs ? (runningRun?.task ?? null) : (w.task ?? null),
        waiting,
        lastRunAt,
      } as W;
    });
    // `version` stands in for lastStarted (a ref) - it bumps with every frame.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workers, runs, approvals, flags, version]);

  return { workers: merged, pops, live, version };
}
