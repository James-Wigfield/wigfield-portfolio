-- ============================================================================
-- MEMORY ROOMS: whole places (buildings) for /memories
-- ----------------------------------------------------------------------------
-- A building is one `memory_buildings` row: what the phone captured for a whole
-- place (title, location, the room checklist / sketch plan) plus, later, the
-- building.json the render side traces (`plan`). Its files (floor-plan photos,
-- outside shots, level GLBs, exterior.glb, renders) live in the R2 bucket
-- `memory-rooms` under buildings/<id>/…; `memory_building_media` holds one row
-- per file. Each room of it is an ordinary spot with building_id + room_id.
-- Contract: src/memory-rooms/CONTRACTS.md section 6.4.
--
-- Run ONCE in the Supabase SQL editor (project trcnbmxtudhbuswqmqxy), AFTER
-- supabase/memory_rooms.sql and BEFORE capturing a whole place against the live
-- site. Safe to re-run: idempotent. Until it runs, the Worker still saves spots
-- (it only sends building_id / room_id once a spot has them), but the
-- /api/memories/buildings routes answer 500.
--
-- Ids: memory_buildings.id is generated ON THE PHONE (like a spot's), so an
-- offline capture can be retried without a duplicate. memory_building_media.id
-- is derived from (building, type, name), so a re-upload overwrites its row.
--
-- No foreign key from memory_spots.building_id: a room's spot must never fail
-- to save because its building's row hasn't arrived yet (DECISIONS 108).
--
-- ACCESS MODEL (same as memory_spots): RLS on with NO policies; only the
-- Worker's /api/memories routes read and write, with the secret key.
-- ============================================================================

create table if not exists public.memory_buildings (
  id              uuid primary key,                       -- client-generated
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      text not null check (created_by in ('james', 'justin')),
  title           text not null,
  note            text,                                   -- optional for a place (each room has its own)
  lat             double precision,
  lng             double precision,
  loc_accuracy_m  double precision,
  loc_source      text check (loc_source in ('gps', 'pin', 'typed')),
  place_label     text,
  captured_at     timestamptz not null default now(),
  status          text not null default 'captured'
                    check (status in ('captured', 'modelling', 'rendered')),
  sketch          jsonb,                                  -- the room checklist / sketch plan (sketch.schema.json)
  plan            jsonb,                                  -- building.json v1 (validated by the Worker)
  plan_version    integer not null default 0,
  trip_stop_id    text,
  deleted_at      timestamptz,
  check ((lat is null) = (lng is null))
);

create table if not exists public.memory_building_media (
  id            uuid primary key,                         -- derived from (building, type, name)
  building_id   uuid not null references public.memory_buildings (id) on delete cascade,
  type          text not null check (type in ('plan', 'photo', 'thumb', 'model', 'render', 'compare')),
  name          text not null,                            -- '1'…'12', 'exterior', 'level-ground', 'map', 'hero'…
  r2_key        text not null unique,                     -- buildings/<id>/plan/1.jpg …
  width         integer,
  height        integer,
  bytes         bigint,
  sort          integer not null default 0,
  content_type  text,
  created_at    timestamptz not null default now(),
  unique (building_id, type, name)
);

-- A spot can be a room of a building.
alter table public.memory_spots add column if not exists building_id uuid;
alter table public.memory_spots add column if not exists room_id text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'memory_spots_room_needs_building') then
    alter table public.memory_spots
      add constraint memory_spots_room_needs_building check (room_id is null or building_id is not null);
  end if;
end;
$$;

create index if not exists memory_buildings_captured_idx
  on public.memory_buildings (captured_at desc)
  where deleted_at is null;

create index if not exists memory_building_media_building_idx
  on public.memory_building_media (building_id, type, sort);

create index if not exists memory_spots_building_idx
  on public.memory_spots (building_id, room_id)
  where building_id is not null;

-- Keep updated_at fresh on every write.
create or replace function public.memory_buildings_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists memory_buildings_touch on public.memory_buildings;
create trigger memory_buildings_touch
  before update on public.memory_buildings
  for each row execute function public.memory_buildings_touch_updated_at();

-- Lock both new tables down: RLS on, no policies -> only the secret key gets in.
alter table public.memory_buildings enable row level security;
alter table public.memory_building_media enable row level security;
