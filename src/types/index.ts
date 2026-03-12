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

export interface PracticeSkill {
  id: string
  user_id: string
  name: string
  category: string
  color: string
  target_hours: number
  total_hours: number
  created_at: string
}

export interface PracticeSession {
  id: string
  user_id: string
  skill_id: string
  date: string
  duration_minutes: number
  difficulty: number
  quality: number
  notes: string | null
  created_at: string
}

export interface MotivationEntry {
  id: string
  user_id: string
  type: 'proof_them_wrong' | 'identity' | 'why' | 'milestone' | 'custom'
  content: string
  is_pinned: boolean
  created_at: string
}

export type PomodoroMode = 'focus' | 'short_break' | 'long_break'

const IS_UAT = import.meta.env.VITE_UAT_MODE === 'true'

export const POMODORO_DURATIONS: Record<PomodoroMode, number> = {
  focus:       IS_UAT ? 10 : 25 * 60,
  short_break: IS_UAT ? 5  : 5 * 60,
  long_break:  IS_UAT ? 8  : 15 * 60,
}

export const BREAK_DURATIONS = {
  nature:    IS_UAT ? 8  : 5 * 60,
  breathing: IS_UAT ? 8  : 4 * 60,
  binaural:  IS_UAT ? 10 : 10 * 60,
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

export const SKILL_COLORS = [
  '#6366f1', '#f59e0b', '#ec4899', '#10b981',
  '#3b82f6', '#8b5cf6', '#f97316', '#14b8a6',
  '#ef4444', '#84cc16',
]

export const VAULT_TYPES: Record<MotivationEntry['type'], { label: string; emoji: string; placeholder: string }> = {
  proof_them_wrong: {
    label: 'Prove Them Wrong',
    emoji: '🔥',
    placeholder: 'They said I couldn\'t. Every rep I do proves them wrong.',
  },
  identity: {
    label: 'Identity Statement',
    emoji: '👑',
    placeholder: 'I am the kind of person who shows up every single day, no matter what.',
  },
  why: {
    label: 'My Why',
    emoji: '💎',
    placeholder: 'I do this for my family. To give them the life they deserve.',
  },
  milestone: {
    label: 'Milestone Unlocked',
    emoji: '🏆',
    placeholder: '100 hours of deep work logged. The compound interest is real.',
  },
  custom: {
    label: 'Custom Note',
    emoji: '✍️',
    placeholder: 'Write anything that fires you up...',
  },
}

export { IS_UAT }
