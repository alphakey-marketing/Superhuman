import { useCallback, useEffect, useReducer, useRef } from 'react'
import { PomodoroMode, POMODORO_DURATIONS } from '../types'
import { supabase } from '../lib/supabase'

interface PomodoroState {
  mode: PomodoroMode
  timeLeft: number
  isRunning: boolean
  cycles: number
  distractions: number
  taskLabel: string
  // The budget category the user is working on (e.g. "Deep Work", "Admin")
  budgetCategory: string | null
  // The Supabase row id of the matching attention_budget so we can increment hours_used
  budgetRowId: string | null
  sessionId: string | null
}

type PomodoroAction =
  | { type: 'START' }
  | { type: 'PAUSE' }
  | { type: 'RESET' }
  | { type: 'SET_TIME_LEFT'; timeLeft: number }
  | { type: 'NEXT_MODE'; mode: PomodoroMode }
  | { type: 'ADD_DISTRACTION' }
  | { type: 'SET_TASK'; label: string; budgetCategory: string | null; budgetRowId: string | null }
  | { type: 'SET_SESSION_ID'; id: string }

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
      }
    case 'SET_TIME_LEFT':
      return { ...state, timeLeft: action.timeLeft }
    case 'NEXT_MODE':
      return {
        ...state,
        mode: action.mode,
        timeLeft: POMODORO_DURATIONS[action.mode],
        isRunning: false,
        cycles: action.mode !== 'focus' ? state.cycles + 1 : state.cycles,
        sessionId: null,
      }
    case 'ADD_DISTRACTION':
      return { ...state, distractions: state.distractions + 1 }
    case 'SET_TASK':
      return {
        ...state,
        taskLabel: action.label,
        budgetCategory: action.budgetCategory,
        budgetRowId: action.budgetRowId,
      }
    case 'SET_SESSION_ID':
      return { ...state, sessionId: action.id }
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

export function usePomodoro(userId: string | undefined) {
  const [state, dispatch] = useReducer(reducer, {
    mode: 'focus',
    timeLeft: POMODORO_DURATIONS.focus,
    isRunning: false,
    cycles: 0,
    distractions: 0,
    taskLabel: '',
    budgetCategory: null,
    budgetRowId: null,
    sessionId: null,
  })

  const timerRef             = useRef<ReturnType<typeof setInterval> | null>(null)
  const stateRef             = useRef(state)
  stateRef.current           = state
  const startEpochRef        = useRef<number | null>(null)
  const elapsedAtPauseRef    = useRef<number>(0)

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

    if (s.sessionId && userId) {
      const newCycles = s.mode === 'focus' ? s.cycles + 1 : s.cycles
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
      dispatch({ type: 'NEXT_MODE', mode: nextMode })
    } else {
      dispatch({ type: 'NEXT_MODE', mode: 'focus' })
    }
  }, [userId])

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
    if (!stateRef.current.sessionId && userId) {
      const { data } = await supabase
        .from('pomodoro_sessions')
        .insert({
          user_id: userId,
          task_label: stateRef.current.taskLabel || null,
          budget_category: stateRef.current.budgetCategory || null,
        })
        .select()
        .single()
      if (data) dispatch({ type: 'SET_SESSION_ID', id: data.id })
    }
  }, [userId])

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
