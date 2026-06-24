/* ============================================================================
   PORTAL — DATA ACCESS LAYER (mock, Supabase-ready)
   ----------------------------------------------------------------------------
   This module is the ONLY place the UI talks to "the database". Today it is
   backed by an in-memory clone of ./mockData.js; tomorrow each function body is
   replaced by the equivalent Supabase call shown in the `// SUPABASE:` comment.
   Because every function already returns Supabase's `{ data, error }` shape and
   resolves asynchronously, the components above this layer need ZERO changes
   when the real backend lands.

   Migration sketch:
     import { createClient } from '@supabase/supabase-js';
     const supabase = createClient(import.meta.env.VITE_SUPABASE_URL,
                                   import.meta.env.VITE_SUPABASE_ANON_KEY);
   ========================================================================== */

import {
  projects as seedProjects,
  milestones as seedMilestones,
  tasks as seedTasks,
  DEFAULT_PROJECT_ID,
} from './mockData';

export { DEFAULT_PROJECT_ID };

// ── In-memory store (structuredClone so edits don't mutate the seed module) ──
const db = {
  projects: structuredClone(seedProjects),
  milestones: structuredClone(seedMilestones),
  tasks: structuredClone(seedTasks),
};

// ── Helpers that simulate network latency + an id generator ──────────────────
const LATENCY_MS = 260;
const wait = (ms = LATENCY_MS) => new Promise((r) => setTimeout(r, ms));

let _seq = 0;
// Deterministic-ish id (no Math.random dependency); fine for a mock.
const newId = (prefix) => `${prefix}_${Date.now().toString(36)}${(_seq++).toString(36)}`;
const nowIso = () => new Date().toISOString();

// Mimics PostgREST: resolves with { data, error }, never rejects.
const ok = (data) => ({ data, error: null });
const fail = (message) => ({ data: null, error: { message } });

// ── Projects ─────────────────────────────────────────────────────────────────
export async function getProject(projectId = DEFAULT_PROJECT_ID) {
  await wait();
  // SUPABASE: return supabase.from('projects').select('*').eq('id', projectId).single();
  const project = db.projects.find((p) => p.id === projectId);
  return project ? ok(project) : fail(`project ${projectId} not found`);
}

// ── Milestones ───────────────────────────────────────────────────────────────
export async function listMilestones(projectId = DEFAULT_PROJECT_ID) {
  await wait();
  // SUPABASE: return supabase.from('milestones').select('*')
  //   .eq('project_id', projectId).order('order_index', { ascending: true });
  const data = db.milestones
    .filter((m) => m.project_id === projectId)
    .sort((a, b) => a.order_index - b.order_index);
  return ok(structuredClone(data));
}

export async function updateMilestone(id, patch) {
  await wait();
  // SUPABASE: return supabase.from('milestones').update({ ...patch, updated_at: nowIso() })
  //   .eq('id', id).select().single();
  const row = db.milestones.find((m) => m.id === id);
  if (!row) return fail(`milestone ${id} not found`);
  Object.assign(row, patch, { updated_at: nowIso() });
  return ok(structuredClone(row));
}

// ── Tasks ─────────────────────────────────────────────────────────────────────
export async function listTasks(projectId = DEFAULT_PROJECT_ID) {
  await wait();
  // SUPABASE (join via FK): return supabase.from('tasks')
  //   .select('*, milestones!inner(project_id)')
  //   .eq('milestones.project_id', projectId);
  const milestoneIds = new Set(
    db.milestones.filter((m) => m.project_id === projectId).map((m) => m.id)
  );
  const data = db.tasks.filter((t) => milestoneIds.has(t.milestone_id));
  return ok(structuredClone(data));
}

export async function insertTask({ milestone_id, title, priority = 'medium', due_date = null }) {
  await wait();
  if (!title?.trim()) return fail('title is required');
  if (!db.milestones.some((m) => m.id === milestone_id)) {
    return fail(`milestone ${milestone_id} not found`);
  }
  const row = {
    id: newId('task'),
    milestone_id,
    title: title.trim(),
    status: 'todo',
    priority,
    due_date,
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  // SUPABASE: return supabase.from('tasks').insert(row).select().single();
  db.tasks.push(row);
  return ok(structuredClone(row));
}

export async function updateTask(id, patch) {
  await wait();
  // SUPABASE: return supabase.from('tasks').update({ ...patch, updated_at: nowIso() })
  //   .eq('id', id).select().single();
  const row = db.tasks.find((t) => t.id === id);
  if (!row) return fail(`task ${id} not found`);
  Object.assign(row, patch, { updated_at: nowIso() });
  return ok(structuredClone(row));
}

export async function deleteTask(id) {
  await wait();
  // SUPABASE: return supabase.from('tasks').delete().eq('id', id);
  const idx = db.tasks.findIndex((t) => t.id === id);
  if (idx === -1) return fail(`task ${id} not found`);
  const [removed] = db.tasks.splice(idx, 1);
  return ok(structuredClone(removed));
}
