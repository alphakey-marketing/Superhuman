import { useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Auto-logs a distraction event when the user switches away from the tab.
 * Only tracks when isTracking = true (i.e. a Pomodoro focus session is active).
 */
export function useDistraction(userId: string | undefined, isTracking: boolean) {
  const lastHidden = useRef<number | null>(null)

  const logDistraction = useCallback(async (source: 'tab_switch' | 'manual') => {
    if (!userId) return
    await supabase.from('distraction_events').insert({
      user_id: userId,
      source,
      occurred_at: new Date().toISOString(),
    })
  }, [userId])

  useEffect(() => {
    if (!isTracking) return

    const handleVisibility = () => {
      if (document.hidden) {
        lastHidden.current = Date.now()
      } else {
        // Only log if away for more than 3 seconds (avoids accidental flicks)
        if (lastHidden.current && Date.now() - lastHidden.current > 3000) {
          logDistraction('tab_switch')
        }
        lastHidden.current = null
      }
    }

    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [isTracking, logDistraction])

  return { logDistraction }
}
