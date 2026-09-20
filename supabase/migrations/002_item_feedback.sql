create table if not exists public.item_feedback (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  reaction text not null,
  comment text not null default '',
  created_at timestamptz not null default now()
);

alter table public.item_feedback enable row level security;

create policy "item feedback is readable"
  on public.item_feedback for select using (true);
create policy "item feedback is insertable"
  on public.item_feedback for insert with check (true);

do $$
begin
  alter publication supabase_realtime add table public.item_feedback;
exception when duplicate_object then null;
end $$;
