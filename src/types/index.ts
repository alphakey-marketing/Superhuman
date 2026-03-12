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

export interface RestSession {
  id: string
  user_id: string
  type: 'nature' | 'breathing' | 'binaural'
  duration_seconds: number
  mood_before: number | null
  mood_after: number | null
  completed: boolean
  started_at: string
}

export interface DistractionEvent {
  id: string
  user_id: string
  occurred_at: string
  source: 'tab_switch' | 'manual'
}

export type PomodoroMode = 'focus' | 'short_break' | 'long_break'

// UAT / Production toggle
const IS_UAT = import.meta.env.VITE_UAT_MODE === 'true'

export const POMODORO_DURATIONS: Record<PomodoroMode, number> = {
  focus:       IS_UAT ? 10 : 25 * 60,
  short_break: IS_UAT ? 5  : 5 * 60,
  long_break:  IS_UAT ? 8  : 15 * 60,
}

// Break durations (UAT = shorter)
export const BREAK_DURATIONS = {
  nature:    IS_UAT ? 8  : 5 * 60,   // 5 min
  breathing: IS_UAT ? 8  : 4 * 60,   // 4 min
  binaural:  IS_UAT ? 10 : 10 * 60,  // 10 min
}

export const CATEGORY_COLORS: Record<string, string> = {
  'Deep Work': '#6366f1',
  'Learning':  '#f59e0b',
  'Creative':  '#ec4899',
  'Admin':     '#10b981',
  'Exercise':  '#3b82f6',
  'Rest':      '#8b5cf6',
  'Social':    '#f97316',
}

export { IS_UAT }
