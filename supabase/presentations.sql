-- ============================================================================
-- DECK STUDIO — Supabase table for generated presentations
-- ----------------------------------------------------------------------------
-- One row per presentation ("deck"). The whole slide/element model is stored as
-- a single JSONB blob (`deck`) — the UI loads a whole deck at once and the MCP
-- server writes a whole deck at once, so a normalised slides/elements schema
-- would add complexity for no benefit at this scale.
--
-- ACCESS MODEL (mirrors syllabite_feedback, NOT sprites):
--   • RLS is ON with NO policies, so the browser's anon key can touch NOTHING.
--   • All access goes through code that holds the SECRET key (which bypasses RLS):
--       - the portfolio Worker's /api/presentations routes (password-gated), and
--       - the portal MCP server (create/list/get/delete).
--   This keeps a single, consistent auth story and no anon policies to manage.
--
-- Run this once in the Supabase SQL editor (project: trcnbmxtudhbuswqmqxy).
-- ============================================================================

create table if not exists public.presentations (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  date_label  text,                        -- the tab label, e.g. "08/07/2026"
  deck        jsonb not null,              -- the full { version, canvas, slides[] } model
  created_by  text default 'claude',       -- 'claude' (MCP) | 'editor' (in-portal)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Newest-first listing is the common query.
create index if not exists presentations_updated_at_idx
  on public.presentations (updated_at desc);

-- Keep updated_at fresh on every write.
create or replace function public.presentations_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists presentations_touch on public.presentations;
create trigger presentations_touch
  before update on public.presentations
  for each row execute function public.presentations_touch_updated_at();

-- Lock it down: RLS on, no policies → only the service/secret key gets in.
alter table public.presentations enable row level security;
