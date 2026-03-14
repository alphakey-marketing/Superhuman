import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export interface StreakData {
  current: number
  longest: number
  lastActiveDate: string | null
}

/**
 * Calculates focus streaks from completed pomodoro sessions.
 * A streak day = at least 1 completed session that day.
 * Accepts `today` so the hook re-runs on midnight day rollover.
 */
export function useStreaks(userId: string | undefined, today: string) {
  const [streak, setStreak] = useState<StreakData>({ current: 0, longest: 0, lastActiveDate: null })

  useEffect(() => {
    if (!userId) return
    const calculate = async () => {
      const { data } = await supabase
        .from('pomodoro_sessions')
        .select('started_at')
        .eq('user_id', userId)
        .eq('status', 'completed')
        .order('started_at', { ascending: false })

      if (!data || data.length === 0) {
        setStreak({ current: 0, longest: 0, lastActiveDate: null })
        return
      }

      // Get unique active dates (desc)
      const activeDates = [...new Set(
        data.map(s => s.started_at.split('T')[0])
      )].sort((a, b) => b.localeCompare(a))

      // yesterday relative to the `today` param (not new Date() at render time)
      const yesterdayDate = new Date(today)
      yesterdayDate.setDate(yesterdayDate.getDate() - 1)
      const yesterday = yesterdayDate.toISOString().split('T')[0]

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

      // Longest streak
      for (let i = 1; i < activeDates.length; i++) {
        const prev = new Date(activeDates[i - 1])
        const curr = new Date(activeDates[i])
        const diff = (prev.getTime() - curr.getTime()) / 86400000
        if (Math.round(diff) === 1) { temp++; longest = Math.max(longest, temp) }
        else temp = 1
      }
      longest = Math.max(longest, current, 1)

      setStreak({ current, longest, lastActiveDate: activeDates[0] })
    }
    calculate()
  }, [userId, today])

  return streak
}
