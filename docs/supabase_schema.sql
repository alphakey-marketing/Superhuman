-- =============================================
-- AttentionOS Phase 1 - Supabase Schema
-- Run this in your Supabase SQL Editor
-- =============================================

-- Attention Budgets
CREATE TABLE IF NOT EXISTS attention_budgets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  category TEXT NOT NULL,
  hours_allocated DECIMAL(4,2) NOT NULL DEFAULT 1.0,
  hours_used DECIMAL(4,2) NOT NULL DEFAULT 0,
  color TEXT NOT NULL DEFAULT '#6366f1',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pomodoro Sessions
CREATE TABLE IF NOT EXISTS pomodoro_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  completed_cycles INTEGER NOT NULL DEFAULT 0,
  distractions_count INTEGER NOT NULL DEFAULT 0,
  task_label TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned'))
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_budgets_user_date ON attention_budgets(user_id, date);
CREATE INDEX IF NOT EXISTS idx_sessions_user_started ON pomodoro_sessions(user_id, started_at);

-- Row Level Security
ALTER TABLE attention_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE pomodoro_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own budgets"
  ON attention_budgets FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage their own sessions"
  ON pomodoro_sessions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
