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
  sessionId: string | null
}

type PomodoroAction =
  | { type: 'START' }
  | { type: 'PAUSE' }
  | { type: 'RESET' }
  | { type: 'TICK' }
  | { type: 'NEXT_MODE'; mode: PomodoroMode }
  | { type: 'ADD_DISTRACTION' }
  | { type: 'SET_TASK'; label: string }
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
    case 'TICK':
      return { ...state, timeLeft: state.timeLeft - 1 }
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
      return { ...state, taskLabel: action.label }
    case 'SET_SESSION_ID':
      return { ...state, sessionId: action.id }
    default:
      return state
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
    sessionId: null,
  })

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // keep latest state accessible inside the interval without re-creating it
  const stateRef = useRef(state)
  stateRef.current = state

  const handleComplete = useCallback(async () => {
    const s = stateRef.current
    dispatch({ type: 'PAUSE' })

    // Beep notification
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

    // Save to Supabase
    if (s.sessionId && userId) {
      const newCycles = s.mode === 'focus' ? s.cycles + 1 : s.cycles
      await supabase
        .from('pomodoro_sessions')
        .update({
          ended_at: new Date().toISOString(),
          completed_cycles: newCycles,
          distractions_count: s.distractions,
          status: 'completed',
        })
        .eq('id', s.sessionId)
    }

    // Advance mode
    if (s.mode === 'focus') {
      const nextCycles = s.cycles + 1
      const nextMode: PomodoroMode = nextCycles % 4 === 0 ? 'long_break' : 'short_break'
      dispatch({ type: 'NEXT_MODE', mode: nextMode })
    } else {
      dispatch({ type: 'NEXT_MODE', mode: 'focus' })
    }
  }, [userId])

  useEffect(() => {
    if (state.isRunning) {
      timerRef.current = setInterval(() => {
        if (stateRef.current.timeLeft <= 1) {
          clearInterval(timerRef.current!)
          handleComplete()
        } else {
          dispatch({ type: 'TICK' })
        }
      }, 1000)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [state.isRunning, handleComplete])

  const start = useCallback(async () => {
    dispatch({ type: 'START' })
    if (!stateRef.current.sessionId && userId) {
      const { data } = await supabase
        .from('pomodoro_sessions')
        .insert({
          user_id: userId,
          task_label: stateRef.current.taskLabel || null,
        })
        .select()
        .single()
      if (data) dispatch({ type: 'SET_SESSION_ID', id: data.id })
    }
  }, [userId])

  const abandon = useCallback(async () => {
    dispatch({ type: 'PAUSE' })
    if (stateRef.current.sessionId) {
      await supabase
        .from('pomodoro_sessions')
        .update({ ended_at: new Date().toISOString(), status: 'abandoned' })
        .eq('id', stateRef.current.sessionId)
    }
    dispatch({ type: 'RESET' })
  }, [])

  return {
    state,
    start,
    pause: () => dispatch({ type: 'PAUSE' }),
    reset: () => dispatch({ type: 'RESET' }),
    abandon,
    addDistraction: () => dispatch({ type: 'ADD_DISTRACTION' }),
    setTask: (label: string) => dispatch({ type: 'SET_TASK', label }),
    switchMode: (mode: PomodoroMode) => dispatch({ type: 'NEXT_MODE', mode }),
  }
}
