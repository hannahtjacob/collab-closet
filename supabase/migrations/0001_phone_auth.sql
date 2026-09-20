-- Phone-number sign-in support.
--
-- Rooms/members are still reachable by anonymous guests (the demo depends on
-- joining with just a room code), so this migration only adds the pieces that
-- signed-in users need: a stable owner on rooms and a name on memberships so
-- the "Your boards" list can be rendered.

alter table public.rooms
  add column if not exists created_by text;

alter table public.room_members
  add column if not exists user_name text;

-- Fast lookup for "every room this phone account belongs to".
create index if not exists room_members_user_id_idx
  on public.room_members (user_id);
