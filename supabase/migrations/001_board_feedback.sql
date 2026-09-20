create table if not exists public.room_product_notes (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  user_id text not null,
  user_name text not null,
  body text not null check (char_length(body) between 1 and 280),
  created_at timestamptz not null default now()
);

create table if not exists public.room_product_reactions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  user_id text not null,
  user_name text not null,
  emoji text not null check (emoji in ('❤️', '🔥', '👏', '👎', '✨')),
  created_at timestamptz not null default now(),
  unique (room_id, product_id, user_id, emoji)
);

alter table public.room_product_notes enable row level security;
alter table public.room_product_reactions enable row level security;

create policy "room product notes are readable"
  on public.room_product_notes for select using (true);
create policy "room product notes are insertable"
  on public.room_product_notes for insert with check (true);
create policy "authors can delete their notes"
  on public.room_product_notes for delete using (true);

create policy "room product reactions are readable"
  on public.room_product_reactions for select using (true);
create policy "room product reactions are insertable"
  on public.room_product_reactions for insert with check (true);
create policy "users can delete their reactions"
  on public.room_product_reactions for delete using (true);

do $$
begin
  alter publication supabase_realtime add table public.room_product_notes;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.room_product_reactions;
exception when duplicate_object then null;
end $$;
