-- ============================================================================
-- MEMORY ROOMS: collections (groups of spots and whole places) for /memories
-- ----------------------------------------------------------------------------
-- A collection is one `memory_collections` row: a name ("Joe's House", "USA
-- 2026"), an optional sort order and an optional map frame. A spot or a whole
-- place belongs to at most one, through its `collection_id`. A room of a place
-- shows under the place's collection unless the room's spot sets its own.
-- Contract: src/memory-rooms/CONTRACTS.md section 7.
--
-- Run ONCE in the Supabase SQL editor (project trcnbmxtudhbuswqmqxy), AFTER
-- supabase/memory_rooms.sql and supabase/memory_buildings.sql, and BEFORE
-- deploying a Worker that sends collections (a spot saved with a collection
-- before this has run is held on the phone with "needs-sql" until it has).
-- Additive and idempotent: safe to re-run; nothing existing changes. Spots and
-- places without a collection save exactly as before, with or without it.
--
-- Ids: memory_collections.id is generated ON THE PHONE (like a spot's), so a
-- collection made offline during a capture can be retried without a duplicate.
--
-- No foreign keys to memory_collections: a spot must never fail to save
-- because its collection's row hasn't arrived yet (the outbox sends the
-- collection first, but a retry order isn't a guarantee). Deleting a
-- collection is the Worker's job: it sets collection_id = null on every spot
-- and place that had it, then deletes the row (DELETE /collections/:id).
--
-- ACCESS MODEL (same as memory_spots): RLS on with NO policies; only the
-- Worker's /api/memories routes read and write, with the secret key.
-- ============================================================================

create table if not exists public.memory_collections (
  id          uuid primary key,                       -- client-generated
  name        text not null check (char_length(btrim(name)) between 1 and 60),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  sort        integer,                                -- optional order in the list (nulls last, then oldest first)
  bounds      jsonb                                   -- optional map frame [[west, south], [east, north]] (degrees)
);

alter table public.memory_spots add column if not exists collection_id uuid;
alter table public.memory_buildings add column if not exists collection_id uuid;

create index if not exists memory_spots_collection_idx
  on public.memory_spots (collection_id)
  where collection_id is not null;

create index if not exists memory_buildings_collection_idx
  on public.memory_buildings (collection_id)
  where collection_id is not null;

-- Keep updated_at fresh on every write.
create or replace function public.memory_collections_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists memory_collections_touch on public.memory_collections;
create trigger memory_collections_touch
  before update on public.memory_collections
  for each row execute function public.memory_collections_touch_updated_at();

-- Lock the new table down: RLS on, no policies -> only the secret key gets in.
alter table public.memory_collections enable row level security;
