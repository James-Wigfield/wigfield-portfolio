-- ============================================================================
-- MEMORY ROOMS: freeform "old photos" spots (+ each photo's EXIF) for /memories
-- ----------------------------------------------------------------------------
-- A spot's `capture` says how its photos were taken: the shot guide's corner
-- shots (guided, the default: a spot without it is guided) or FREEFORM old
-- photos in any order, up to 40, with James's optional hints for placing them:
-- the era ("lived here 2019–2021"), a rough outline of the room, viewpoints
-- (where he stood and which way he faced) and a caption per photo. A photo's
-- media row keeps the EXIF the phone read before it resized the photo (focal
-- length, 35 mm-equivalent focal length, make, model, when it was taken, its
-- original size). Contract: src/memory-rooms/CONTRACTS.md section 8;
-- capture.schema.json + capture/freeform.js validate `capture` (the Worker
-- checks it before it gets here).
--
-- Run ONCE in the Supabase SQL editor (project trcnbmxtudhbuswqmqxy), AFTER
-- supabase/memory_rooms.sql, memory_buildings.sql and memory_collections.sql,
-- and BEFORE deploying a Worker + app that capture freeform spots. Additive and
-- idempotent: two nullable columns, nothing existing changes.
--
-- Before it has run: guided spots save exactly as ever (the Worker only sends
-- `capture` for a spot that has one); a freeform spot answers 503 needs-sql
-- and waits on the phone (the outbox retries); a photo's EXIF is simply left
-- off its media row (the photo itself always uploads).
-- ============================================================================

alter table public.memory_spots add column if not exists capture jsonb;
alter table public.memory_media add column if not exists exif jsonb;

-- (No index: capture is read with its spot, never searched.)
