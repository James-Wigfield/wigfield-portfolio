-- ============================================================================
-- MEMORY ROOMS: Supabase tables for /memories (trip spots → Blender rooms)
-- ----------------------------------------------------------------------------
-- A spot is one `memory_spots` row (what was captured on the phone, plus the
-- scene.json Claude writes later). Its files (photos, thumbnails, the optional
-- Scaniverse .spz, the baked room.glb, Cycles renders, compare sheets) live in
-- the Cloudflare R2 bucket `memory-rooms`; `memory_media` holds one row per
-- file with its R2 key. Contract: src/memory-rooms/CONTRACTS.md.
--
-- Ids:
--   • memory_spots.id is generated ON THE PHONE (crypto uuid) so an offline
--     capture can be retried any number of times without making a duplicate.
--   • memory_media.id is derived from (spot, type, name), so re-uploading a
--     photo or a new render overwrites the same row.
--
-- `deleted_at` is a SOFT delete (null = live). `scene_version` goes up by one on
-- every scene write; `scene` is validated by the Worker against
-- src/memory-rooms/scene/scene.schema.json before it gets here.
--
-- ACCESS MODEL (same as papers / presentations):
--   • RLS is ON with NO policies → the browser's anon key can touch nothing.
--   • Only the portfolio Worker's /api/memories routes read and write, with the
--     SECRET key (bypasses RLS), behind MEMORIES_PASSWORD or PORTAL_PASSWORD.
--
-- Run once in the Supabase SQL editor (project trcnbmxtudhbuswqmqxy) before
-- deploying with MEMORIES_ROW_STORE=supabase. Safe to re-run: idempotent.
-- ============================================================================

create table if not exists public.memory_spots (
  id              uuid primary key,                       -- client-generated
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      text not null check (created_by in ('james', 'justin')),
  title           text not null,
  note            text not null,                          -- the one line: why it matters
  kind            text not null check (kind in ('interior', 'exterior')),
  lat             double precision,
  lng             double precision,
  loc_accuracy_m  double precision,
  loc_source      text check (loc_source in ('gps', 'pin', 'typed')),
  place_label     text,
  scale_hint      text,
  captured_at     timestamptz not null default now(),    -- the phone's clock at save
  status          text not null default 'captured'
                    check (status in ('captured', 'modelling', 'rendered')),
  frame_group     text,                                   -- e.g. 'home': rooms of one building
  scene           jsonb,                                  -- scene.json v1
  scene_version   integer not null default 0,
  trip_stop_id    text,                                   -- link to a usa-trip stop, later
  deleted_at      timestamptz,
  check ((lat is null) = (lng is null))
);

create table if not exists public.memory_media (
  id            uuid primary key,                         -- derived from (spot, type, name)
  spot_id       uuid not null references public.memory_spots (id) on delete cascade,
  type          text not null check (type in ('photo', 'thumb', 'scan', 'model', 'render', 'compare')),
  name          text not null,                            -- '1'…'12', 'scan', 'room', 'hero', 'cam1'…
  r2_key        text not null unique,                     -- spots/<id>/photos/1.jpg …
  width         integer,
  height        integer,
  bytes         bigint,
  sort          integer not null default 0,
  content_type  text,
  created_at    timestamptz not null default now(),
  unique (spot_id, type, name)
);

create index if not exists memory_spots_captured_idx
  on public.memory_spots (captured_at desc)
  where deleted_at is null;

create index if not exists memory_spots_group_idx
  on public.memory_spots (frame_group)
  where frame_group is not null;

create index if not exists memory_media_spot_idx
  on public.memory_media (spot_id, type, sort);

-- Keep updated_at fresh on every write.
create or replace function public.memory_spots_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists memory_spots_touch on public.memory_spots;
create trigger memory_spots_touch
  before update on public.memory_spots
  for each row execute function public.memory_spots_touch_updated_at();

-- Lock both tables down: RLS on, no policies → only the secret key gets in.
alter table public.memory_spots enable row level security;
alter table public.memory_media enable row level security;
