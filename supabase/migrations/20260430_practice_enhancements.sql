-- ============================================================
-- Practice Enhancements Migration
-- Run this in Supabase SQL Editor: Dashboard > SQL Editor > New query
-- ============================================================

-- 1. Weekly goal hours per skill (default 3h)
alter table public.practice_skills
  add column if not exists weekly_goal_hours numeric not null default 3;

-- 2. Target weakness per session (deliberate practice focus)
alter table public.practice_sessions
  add column if not exists target_weakness text;

-- 3. Next intention per session (post-session reflection)
alter table public.practice_sessions
  add column if not exists next_intention text;
