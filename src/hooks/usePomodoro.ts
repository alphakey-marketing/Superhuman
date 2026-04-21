import { useCallback, useEffect, useReducer, useRef } from 'react'
import { PomodoroMode, POMODORO_DURATIONS } from '../types'
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '../lib/supabase'

interface PomodoroState {
  mode: PomodoroMode
  timeLeft: number
  isRunning: boolean
  cycles: number              // total completed cycles today (hydrated from DB on mount)
  distractions: number        // total distractions today
  sessionDistractions: number // distractions in the CURRENT session only (for the tip banner)
  taskLabel: string
  budgetCategory: string | null
  budgetRowId: string | null
  sessionId: string | null
  hydrated: boolean           // true once the DB seed has resolved
}

type PomodoroAction =
  | { type: 'START' }
  | { type: 'PAUSE' }
  | { type: 'RESET' }
  | { type: 'SET_TIME_LEFT'; timeLeft: number }
  | { type: 'NEXT_MODE'; mode: PomodoroMode; incrementCycles?: boolean }
  | { type: 'ADD_DISTRACTION' }
  | { type: 'SET_TASK'; label: string; budgetCategory: string | null; budgetRowId: string | null }
  | { type: 'SET_SESSION_ID'; id: string }
  | { type: 'HYDRATE'; cycles: number; distractions: number }

function reducer(state: PomodoroState, action: PomodoroAction): PomodoroState {
  switch (action.type) {
    case 'START':
      return { ...state, isRunning: true }
    case 'PAUSE':
      return { ...state, isRunning: false }
    case 'RESET':
      return {
        ...state,
        isRunning: false,
        timeLeft: POMODORO_DURATIONS[state.mode],
        sessionId: null,
        sessionDistractions: 0,
      }
    case 'SET_TIME_LEFT':
      return { ...state, timeLeft: action.timeLeft }
    case 'NEXT_MODE':
      return {
        ...state,
        mode: action.mode,
        timeLeft: POMODORO_DURATIONS[action.mode],
        isRunning: false,
        cycles: action.incrementCycles ? state.cycles + 1 : state.cycles,
        sessionId: null,
        sessionDistractions: 0,
      }
    case 'ADD_DISTRACTION':
      return {
        ...state,
        distractions: state.distractions + 1,
        sessionDistractions: state.sessionDistractions + 1,
      }
    case 'SET_TASK':
      return {
        ...state,
        taskLabel: action.label,
        budgetCategory: action.budgetCategory,
        budgetRowId: action.budgetRowId,
      }
    case 'SET_SESSION_ID':
      return { ...state, sessionId: action.id }
    case 'HYDRATE':
      // Only seed if no session is running and we haven't already hydrated
      if (state.isRunning || state.hydrated) return state
      return {
        ...state,
        cycles: action.cycles,
        distractions: action.distractions,
        hydrated: true,
      }
    default:
      return state
  }
}

function beep() {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.setValueAtTime(880, ctx.currentTime)
    gain.gain.setValueAtTime(0.3, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5)
    osc.start()
    osc.stop(ctx.currentTime + 0.5)
  } catch (_) {}
}

function notify(title: string, body: string) {
  if (!('Notification' in window)) return
  const fire = () => new Notification(title, { body, icon: '/favicon.ico', tag: 'pomodoro' })
  if (Notification.permission === 'granted') {
    fire()
  } else if (Notification.permission !== 'denied') {
    Notification.requestPermission().then(p => { if (p === 'granted') fire() })
  }
}

export function usePomodoro(userId: string | undefined, date: string) {
  const [state, dispatch] = useReducer(reducer, {
    mode: 'focus',
    timeLeft: POMODORO_DURATIONS.focus,
    isRunning: false,
    cycles: 0,
    distractions: 0,
    sessionDistractions: 0,
    taskLabel: '',
    budgetCategory: null,
    budgetRowId: null,
    sessionId: null,
    hydrated: false,
  })

  const timerRef             = useRef<ReturnType<typeof setInterval> | null>(null)
  const stateRef             = useRef(state)
  stateRef.current           = state
  const startEpochRef        = useRef<number | null>(null)
  const elapsedAtPauseRef    = useRef<number>(0)
  // Keep userId always fresh — avoids stale closure after token refresh
  const userIdRef            = useRef(userId)
  useEffect(() => { userIdRef.current = userId }, [userId])
  // Keep current access token fresh for the beforeunload handler
  const accessTokenRef       = useRef<string | null>(null)
  useEffect(() => {
    // Seed immediately from current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      accessTokenRef.current = session?.access_token ?? null
    })
    // Keep up-to-date on token refresh / sign-in / sign-out
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      accessTokenRef.current = session?.access_token ?? null
    })
    return () => subscription.unsubscribe()
  }, [])

  // ── Hydrate cycles + distractions from DB on mount / date change ────────────
  useEffect(() => {
    if (!userId) return
    const hydrate = async () => {
      const { data } = await supabase
        .from('pomodoro_sessions')
        .select('completed_cycles, distractions_count')
        .eq('user_id', userId)
        .eq('status', 'completed')
        .gte('started_at', date + 'T00:00:00')
      const cycles      = data?.reduce((s, r) => s + (r.completed_cycles ?? 0), 0) ?? 0
      const distractions = data?.reduce((s, r) => s + (r.distractions_count ?? 0), 0) ?? 0
      dispatch({ type: 'HYDRATE', cycles, distractions })
    }
    hydrate()
  }, [userId, date])

  const handleComplete = useCallback(async () => {
    const s = stateRef.current
    dispatch({ type: 'PAUSE' })
    startEpochRef.current     = null
    elapsedAtPauseRef.current = 0

    beep()
    const modeLabel = s.mode === 'focus' ? 'Focus session' : 'Break'
    notify(
      `${modeLabel} complete!`,
      s.mode === 'focus'
        ? 'Great work. Time for a break.'
        : 'Break over - ready for the next focus block?'
    )

    if (s.sessionId && userIdRef.current) {
      // completed_cycles is per-session: 1 for a focus block completion, 0 for a break.
      // The hydration query sums these to get the total cycles today.
      // NOTE: sessions created before this fix may have stored a cumulative running total
      // in this field; those rows will inflate the hydrated count on reload for existing
      // users, but new sessions from this point forward are stored correctly.
      const newCycles = s.mode === 'focus' ? 1 : 0
      await supabase
        .from('pomodoro_sessions')
        .update({
          ended_at: new Date().toISOString(),
          completed_cycles: newCycles,
          distractions_count: s.distractions,
          status: 'completed',
          budget_category: s.budgetCategory,
        })
        .eq('id', s.sessionId)
    }

    // Auto-increment hours_used on the linked budget row (25 min = 25/60 h)
    if (s.mode === 'focus' && s.budgetRowId) {
      const { data: row } = await supabase
        .from('attention_budgets')
        .select('hours_used')
        .eq('id', s.budgetRowId)
        .single()
      if (row) {
        await supabase
          .from('attention_budgets')
          .update({ hours_used: Math.round((row.hours_used + 25 / 60) * 100) / 100 })
          .eq('id', s.budgetRowId)
      }
    }

    if (s.mode === 'focus') {
      const nextCycles = s.cycles + 1
      const nextMode: PomodoroMode = nextCycles % 4 === 0 ? 'long_break' : 'short_break'
      dispatch({ type: 'NEXT_MODE', mode: nextMode, incrementCycles: true })
    } else {
      dispatch({ type: 'NEXT_MODE', mode: 'focus' })
    }
  }, [])

  const computeAndSync = useCallback(() => {
    if (!stateRef.current.isRunning || startEpochRef.current === null) return
    const totalDuration = POMODORO_DURATIONS[stateRef.current.mode]
    const elapsed = Math.floor((Date.now() - startEpochRef.current) / 1000) + elapsedAtPauseRef.current
    const remaining = totalDuration - elapsed
    if (remaining <= 0) {
      if (timerRef.current) clearInterval(timerRef.current)
      handleComplete()
    } else {
      dispatch({ type: 'SET_TIME_LEFT', timeLeft: remaining })
    }
  }, [handleComplete])

  useEffect(() => {
    if (state.isRunning) {
      if (startEpochRef.current === null) startEpochRef.current = Date.now()
      timerRef.current = setInterval(computeAndSync, 500)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
      if (startEpochRef.current !== null) {
        elapsedAtPauseRef.current += Math.floor((Date.now() - startEpochRef.current) / 1000)
        startEpochRef.current = null
      }
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [state.isRunning, computeAndSync])

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') computeAndSync()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [computeAndSync])

  useEffect(() => {
    startEpochRef.current     = null
    elapsedAtPauseRef.current = 0
  }, [state.mode])

  const start = useCallback(async () => {
    dispatch({ type: 'START' })
    if (!stateRef.current.sessionId && userIdRef.current) {
      const { data } = await supabase
        .from('pomodoro_sessions')
        .insert({
          user_id: userIdRef.current,
          task_label: stateRef.current.taskLabel || null,
          budget_category: stateRef.current.budgetCategory || null,
        })
        .select()
        .single()
      if (data) dispatch({ type: 'SET_SESSION_ID', id: data.id })
    }
  }, [])

  const abandon = useCallback(async () => {
    dispatch({ type: 'PAUSE' })
    startEpochRef.current     = null
    elapsedAtPauseRef.current = 0
    if (stateRef.current.sessionId) {
      await supabase
        .from('pomodoro_sessions')
        .update({ ended_at: new Date().toISOString(), status: 'abandoned' })
        .eq('id', stateRef.current.sessionId)
    }
    dispatch({ type: 'RESET' })
  }, [])

  // Mark the active session as abandoned when the user closes/reloads the tab
  useEffect(() => {
    const onBeforeUnload = () => {
      const s = stateRef.current
      if (!s.sessionId || !s.isRunning) return

      // Use the token maintained via onAuthStateChange — avoids dependence on
      // undocumented Supabase localStorage key formats that may change across
      // SDK version upgrades.
      const accessToken = accessTokenRef.current
      if (!accessToken) return

      const url = `${SUPABASE_URL}/rest/v1/pomodoro_sessions?id=eq.${s.sessionId}`
      const body = JSON.stringify({ ended_at: new Date().toISOString(), status: 'abandoned' })
      // Use fetch with keepalive so the browser sends the request even as the page unloads
      try {
        fetch(url, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${accessToken}`,
            Prefer: 'return=minimal',
          },
          body,
          keepalive: true,
        })
      } catch (err) {
        console.warn('[usePomodoro] beforeunload: failed to mark session abandoned:', err)
      }
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [])

  const setTask = useCallback((
    label: string,
    budgetCategory: string | null = null,
    budgetRowId: string | null = null
  ) => {
    dispatch({ type: 'SET_TASK', label, budgetCategory, budgetRowId })
  }, [])

  return {
    state,
    start,
    pause: () => dispatch({ type: 'PAUSE' }),
    reset: () => dispatch({ type: 'RESET' }),
    abandon,
    addDistraction: () => dispatch({ type: 'ADD_DISTRACTION' }),
    setTask,
    switchMode: (mode: PomodoroMode) => dispatch({ type: 'NEXT_MODE', mode }),
  }
}
