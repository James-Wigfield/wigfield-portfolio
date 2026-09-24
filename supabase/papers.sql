-- ============================================================================
-- RSVP PAPERS — Supabase tables for the speed-reader (Personal → RSVP Papers)
-- ----------------------------------------------------------------------------
-- A paper is one `papers` row plus one `paper_sections` row per section, kept
-- in reading order by `position`. Sections are rows (not one jsonb array) so
-- that a long paper can be uploaded in several MCP calls: every append is a
-- single bulk INSERT (all-or-nothing) and can never interleave with, or
-- overwrite, what is already there. `unique (paper_id, position)` turns any
-- ordering mistake into a loud error instead of a silent reorder.
--
-- The reader loads a whole paper at once (metadata + ordered sections); the
-- library lists `papers` alone, so `section_count` / `word_count` are cached
-- on the paper and refreshed from the real rows after every append.
--
-- Reading progress is written by the portal into `papers.progress` (jsonb):
--   { "index": 12438, "total": 31020, "pct": 40.1, "wpm": 320,
--     "heading": "3.3.1 Motivation of Prior Models", "updatedAt": "…" }
--
-- `deleted_at` is a SOFT delete. The MCP's delete_paper only ever sets it (the
-- MCP endpoint is authless, so a hard delete there would be an unrecoverable
-- write from the open internet); the portal's Bin can restore or purge.
--
-- ACCESS MODEL (mirrors presentations / syllabite_feedback):
--   • RLS is ON with NO policies → the browser's anon key can touch NOTHING.
--   • All access goes through code holding the SECRET key (bypasses RLS):
--       - the portfolio Worker's /api/papers routes (portal-password gated)
--       - the portal MCP server (save / append / list / get / soft-delete)
--
-- Run this once in the Supabase SQL editor (project: trcnbmxtudhbuswqmqxy).
-- Safe to re-run: every statement is idempotent.
-- ============================================================================

create table if not exists public.papers (
  id                  uuid primary key default gen_random_uuid(),
  title               text not null,
  authors             jsonb not null default '[]'::jsonb,   -- ["A. Author", …]
  year                integer,
  source              text,                                  -- DOI or URL
  status              text not null default 'uploading'
                        check (status in ('uploading', 'complete')),
  section_count       integer not null default 0,            -- cached from paper_sections
  word_count          integer not null default 0,            -- cached, all parts
  main_word_count     integer not null default 0,            -- cached, part = 'main'
  appendix_word_count integer not null default 0,            -- cached, part = 'appendix'
  progress            jsonb,                                 -- reader progress (see header)
  created_by          text default 'claude',                 -- 'claude' (MCP)
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz                            -- soft delete; null = live
);

create table if not exists public.paper_sections (
  id          bigint generated always as identity primary key,
  paper_id    uuid not null references public.papers (id) on delete cascade,
  position    integer not null,                              -- 0-based reading order
  heading     text not null default '',
  level       smallint not null default 1 check (level between 1 and 3),
  part        text not null default 'main' check (part in ('main', 'appendix')),
  blocks      jsonb not null default '[]'::jsonb,            -- the block list (see MCP schema)
  word_count  integer not null default 0,
  created_at  timestamptz not null default now(),
  unique (paper_id, position)
);

-- The two common queries: library listing (live, newest first) and loading a
-- paper's sections in order.
create index if not exists papers_updated_at_idx
  on public.papers (updated_at desc)
  where deleted_at is null;

create index if not exists paper_sections_paper_position_idx
  on public.paper_sections (paper_id, position);

-- Keep updated_at fresh on every write (appends, progress, restore).
create or replace function public.papers_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists papers_touch on public.papers;
create trigger papers_touch
  before update on public.papers
  for each row execute function public.papers_touch_updated_at();

-- Lock both tables down: RLS on, no policies → only the secret key gets in.
alter table public.papers          enable row level security;
alter table public.paper_sections  enable row level security;
