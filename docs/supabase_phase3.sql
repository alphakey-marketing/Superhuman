-- =============================================
-- AttentionOS Phase 3 - Deliberate Practice + Motivation Vault
-- Run this in your Supabase SQL Editor
-- =============================================

-- Skills registry
CREATE TABLE IF NOT EXISTS practice_skills (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'General',
  color TEXT NOT NULL DEFAULT '#6366f1',
  target_hours INTEGER NOT NULL DEFAULT 100,
  total_hours NUMERIC(6,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Individual practice sessions
CREATE TABLE IF NOT EXISTS practice_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  skill_id UUID REFERENCES practice_skills(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  duration_minutes INTEGER NOT NULL,
  difficulty INTEGER NOT NULL CHECK (difficulty BETWEEN 1 AND 5),
  quality INTEGER NOT NULL CHECK (quality BETWEEN 1 AND 5),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Motivation Vault entries
CREATE TABLE IF NOT EXISTS motivation_vault (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('proof_them_wrong', 'identity', 'why', 'milestone', 'custom')),
  content TEXT NOT NULL,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_practice_sessions_skill ON practice_sessions(skill_id, date);
CREATE INDEX IF NOT EXISTS idx_practice_sessions_user ON practice_sessions(user_id, date);
CREATE INDEX IF NOT EXISTS idx_motivation_user ON motivation_vault(user_id, created_at);

-- RLS
ALTER TABLE practice_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE practice_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE motivation_vault ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage skills" ON practice_skills
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage sessions" ON practice_sessions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage vault" ON motivation_vault
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Trigger: auto-update total_hours on practice_skills when a session is added/deleted
CREATE OR REPLACE FUNCTION update_skill_total_hours()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE practice_skills
  SET total_hours = (
    SELECT COALESCE(SUM(duration_minutes), 0) / 60.0
    FROM practice_sessions
    WHERE skill_id = COALESCE(NEW.skill_id, OLD.skill_id)
  )
  WHERE id = COALESCE(NEW.skill_id, OLD.skill_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_skill_hours ON practice_sessions;
CREATE TRIGGER trigger_update_skill_hours
AFTER INSERT OR UPDATE OR DELETE ON practice_sessions
FOR EACH ROW EXECUTE FUNCTION update_skill_total_hours();
