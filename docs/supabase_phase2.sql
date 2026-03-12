-- =============================================
-- AttentionOS Phase 2 - Additional Tables
-- Run this in your Supabase SQL Editor
-- =============================================

-- Restoration / Break Sessions
CREATE TABLE IF NOT EXISTS rest_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('nature', 'breathing', 'binaural')),
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  mood_before INTEGER CHECK (mood_before BETWEEN 1 AND 5),
  mood_after INTEGER CHECK (mood_after BETWEEN 1 AND 5),
  completed BOOLEAN NOT NULL DEFAULT false,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Distraction Events (auto-logged tab switches)
CREATE TABLE IF NOT EXISTS distraction_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source TEXT NOT NULL DEFAULT 'tab_switch' -- 'tab_switch' | 'manual'
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_rest_user ON rest_sessions(user_id, started_at);
CREATE INDEX IF NOT EXISTS idx_distraction_user ON distraction_events(user_id, occurred_at);

-- RLS
ALTER TABLE rest_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE distraction_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage rest sessions"
  ON rest_sessions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage distractions"
  ON distraction_events FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
