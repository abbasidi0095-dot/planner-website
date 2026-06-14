-- AURA Planner Supabase Schema
-- Run this SQL in your Supabase project's SQL Editor.
-- It creates the tables, RLS policies, and triggers needed for the planner.

-- Tasks ----------------------------------------------------------------------
create table if not exists public.tasks (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  text text not null,
  tag text default 'Personal' check (tag in ('Work', 'Personal', 'Health', 'Urgent')),
  completed boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.tasks enable row level security;

create policy "Users can only access their own tasks"
  on public.tasks
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Events ---------------------------------------------------------------------
create table if not exists public.events (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  day text,
  time text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.events enable row level security;

create policy "Users can only access their own events"
  on public.events
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Preferences ----------------------------------------------------------------
create table if not exists public.preferences (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null unique,
  main_focus text default '',
  theme text default 'dark',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.preferences enable row level security;

create policy "Users can only access their own preferences"
  on public.preferences
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Updated-at helper ----------------------------------------------------------
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql security definer;

create trigger tasks_updated_at
  before update on public.tasks
  for each row execute function public.handle_updated_at();

create trigger events_updated_at
  before update on public.events
  for each row execute function public.handle_updated_at();

create trigger preferences_updated_at
  before update on public.preferences
  for each row execute function public.handle_updated_at();
