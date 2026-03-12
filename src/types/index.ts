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

// ------------------------------------
// UAT / Production toggle
// Set VITE_UAT_MODE=true in .env.local to use short durations for testing
// Set VITE_UAT_MODE=false (or omit) for real production timings
// ------------------------------------
const IS_UAT = import.meta.env.VITE_UAT_MODE === 'true'

export const POMODORO_DURATIONS: Record<PomodoroMode, number> = {
  focus:       IS_UAT ? 10 : 25 * 60,   // UAT: 10s  | Prod: 25min
  short_break: IS_UAT ? 5  : 5 * 60,    // UAT: 5s   | Prod: 5min
  long_break:  IS_UAT ? 8  : 15 * 60,   // UAT: 8s   | Prod: 15min
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

// Expose for UI banner
export { IS_UAT }
