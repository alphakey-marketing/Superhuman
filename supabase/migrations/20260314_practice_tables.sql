-- ============================================================
-- Practice Tables Migration
-- Run this in Supabase SQL Editor: Dashboard > SQL Editor > New query
-- ============================================================

-- 1. practice_skills
create table if not exists public.practice_skills (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  name          text not null,
  category      text not null default 'Other',
  color         text not null default '#6366f1',
  target_hours  numeric not null default 100,
  total_hours   numeric not null default 0,
  created_at    timestamptz not null default now()
);

alter table public.practice_skills enable row level security;

create policy "Users can select own skills"
  on public.practice_skills for select
  using (auth.uid() = user_id);

create policy "Users can insert own skills"
  on public.practice_skills for insert
  with check (auth.uid() = user_id);

create policy "Users can update own skills"
  on public.practice_skills for update
  using (auth.uid() = user_id);

create policy "Users can delete own skills"
  on public.practice_skills for delete
  using (auth.uid() = user_id);

-- 2. practice_sessions
create table if not exists public.practice_sessions (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  skill_id          uuid not null references public.practice_skills(id) on delete cascade,
  date              date not null default current_date,
  duration_minutes  integer not null check (duration_minutes > 0),
  difficulty        integer not null default 3 check (difficulty between 1 and 5),
  quality           integer not null default 3 check (quality between 1 and 5),
  notes             text,
  created_at        timestamptz not null default now()
);

alter table public.practice_sessions enable row level security;

create policy "Users can select own sessions"
  on public.practice_sessions for select
  using (auth.uid() = user_id);

create policy "Users can insert own sessions"
  on public.practice_sessions for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own sessions"
  on public.practice_sessions for delete
  using (auth.uid() = user_id);

-- 3. Trigger to auto-update total_hours on practice_skills
create or replace function public.update_skill_total_hours()
returns trigger language plpgsql security definer as $$
begin
  update public.practice_skills
  set total_hours = (
    select coalesce(sum(duration_minutes), 0)::numeric / 60
    from public.practice_sessions
    where skill_id = coalesce(new.skill_id, old.skill_id)
  )
  where id = coalesce(new.skill_id, old.skill_id);
  return null;
end;
$$;

drop trigger if exists trg_update_skill_total_hours on public.practice_sessions;

create trigger trg_update_skill_total_hours
  after insert or update or delete on public.practice_sessions
  for each row execute function public.update_skill_total_hours();
