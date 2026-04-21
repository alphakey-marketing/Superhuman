import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { toLocalDateStr } from '../lib/date'

export interface StreakData {
  current: number
  longest: number
  lastActiveDate: string | null
  loading: boolean
}

/**
 * Calculates focus streaks from completed pomodoro sessions.
 * A streak day = at least 1 completed session that day.
 * Accepts `today` so the hook re-runs on midnight day rollover.
 */
export function useStreaks(userId: string | undefined, today: string) {
  const [streak, setStreak] = useState<StreakData>({ current: 0, longest: 0, lastActiveDate: null, loading: true })

  useEffect(() => {
    if (!userId) return
    setStreak(prev => ({ ...prev, loading: true }))
    const calculate = async () => {
      const { data } = await supabase
        .from('pomodoro_sessions')
        .select('started_at')
        .eq('user_id', userId)
        .eq('status', 'completed')
        .order('started_at', { ascending: false })

      if (!data || data.length === 0) {
        setStreak({ current: 0, longest: 0, lastActiveDate: null, loading: false })
        return
      }

      // Get unique active dates in local timezone (desc)
      // started_at is stored as UTC; convert to local date string to avoid off-by-one errors
      const activeDates = [...new Set(
        data.map(s => toLocalDateStr(new Date(s.started_at)))
      )].sort((a, b) => b.localeCompare(a))

      // yesterday relative to the `today` param, computed in local timezone
      const [ty, tm, td] = today.split('-').map(Number)
      const yesterday = toLocalDateStr(new Date(ty, tm - 1, td - 1))

      let current = 0
      let longest = 0
      let temp = 1

      // Current streak: count consecutive days back from today or yesterday
      if (activeDates[0] === today || activeDates[0] === yesterday) {
        current = 1
        for (let i = 1; i < activeDates.length; i++) {
          const prev = new Date(activeDates[i - 1])
          const curr = new Date(activeDates[i])
          const diff = (prev.getTime() - curr.getTime()) / 86400000
          if (Math.round(diff) === 1) current++
          else break
        }
      }

      // Longest streak — temp tracks the current run length, longest captures the best
      for (let i = 1; i < activeDates.length; i++) {
        const prev = new Date(activeDates[i - 1])
        const curr = new Date(activeDates[i])
        const diff = (prev.getTime() - curr.getTime()) / 86400000
        if (Math.round(diff) === 1) {
          temp++
          longest = Math.max(longest, temp)
        } else {
          // End of a consecutive run — capture temp before resetting
          longest = Math.max(longest, temp)
          temp = 1
        }
      }
      // Use temp (last/only run), current active streak, but not a hardcoded 1
      longest = Math.max(longest, current, temp)

      setStreak({ current, longest, lastActiveDate: activeDates[0], loading: false })
    }
    calculate()
  }, [userId, today])

  return streak
}
