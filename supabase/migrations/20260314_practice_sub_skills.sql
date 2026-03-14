-- ============================================================
-- Sub-Skills Migration
-- Run in Supabase SQL Editor after 20260314_practice_tables.sql
-- ============================================================

create table if not exists public.practice_sub_skills (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  skill_id   uuid not null references public.practice_skills(id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now()
);

alter table public.practice_sub_skills enable row level security;

create policy "Users can select own sub_skills"
  on public.practice_sub_skills for select
  using (auth.uid() = user_id);

create policy "Users can insert own sub_skills"
  on public.practice_sub_skills for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own sub_skills"
  on public.practice_sub_skills for delete
  using (auth.uid() = user_id);

-- Pre-seed sub-skills for template skills owned by any user
-- (These will be inserted by the app on first load, not here)
