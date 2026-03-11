export interface AttentionBudget {
  id: string
  user_id: string
  date: string
  category: string
  hours_allocated: number
  hours_used: number
  color: string
  created_at: string
}

export interface PomodoroSession {
  id: string
  user_id: string
  started_at: string
  ended_at: string | null
  completed_cycles: number
  distractions_count: number
  task_label: string | null
  status: 'active' | 'completed' | 'abandoned'
}

export type PomodoroMode = 'focus' | 'short_break' | 'long_break'

export const POMODORO_DURATIONS: Record<PomodoroMode, number> = {
  focus: 25 * 60,
  short_break: 5 * 60,
  long_break: 15 * 60,
}

export const CATEGORY_COLORS: Record<string, string> = {
  'Deep Work': '#6366f1',
  'Learning': '#f59e0b',
  'Creative': '#ec4899',
  'Admin': '#10b981',
  'Exercise': '#3b82f6',
  'Rest': '#8b5cf6',
  'Social': '#f97316',
}
