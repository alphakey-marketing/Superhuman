-- Add optional sub_skill_id to practice_sessions
-- Run in Supabase SQL Editor

alter table public.practice_sessions
  add column if not exists sub_skill_id uuid
    references public.practice_sub_skills(id)
    on delete set null;
