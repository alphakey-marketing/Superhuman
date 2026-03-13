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
  | { type: 'SET_TIME_LEFT'; timeLeft: number }
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
      return { ...state, taskLabel: action.label }
    case 'SET_SESSION_ID':
      return { ...state, sessionId: action.id }
    default:
      return state
  }
}

// Beep sound on completion
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

// Web Notification -- fires even when the tab is backgrounded or phone screen is off
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
    sessionId: null,
  })

  const timerRef            = useRef<ReturnType<typeof setInterval> | null>(null)
  const stateRef            = useRef(state)
  stateRef.current          = state

  // Wall-clock timestamp (ms) at which the current run segment started.
  // KEY FIX: we compute timeLeft = duration - elapsed_wall_clock, so browser
  // throttling of setInterval does NOT affect accuracy.
  const startEpochRef       = useRef<number | null>(null)
  // Seconds already counted before the last pause (accumulated across pauses).
  const elapsedAtPauseRef   = useRef<number>(0)

  // -- Completion handler --
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
        })
        .eq('id', s.sessionId)
    }

    if (s.mode === 'focus') {
      const nextCycles = s.cycles + 1
      const nextMode: PomodoroMode = nextCycles % 4 === 0 ? 'long_break' : 'short_break'
      dispatch({ type: 'NEXT_MODE', mode: nextMode })
    } else {
      dispatch({ type: 'NEXT_MODE', mode: 'focus' })
    }
  }, [userId])

  // -- Wall-clock sync: recompute timeLeft from actual elapsed time --
  // Called every 500ms AND on visibilitychange, so returning to the tab
  // instantly snaps the display to the correct value regardless of how
  // long the browser had throttled the interval.
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

  // -- Start / stop interval --
  useEffect(() => {
    if (state.isRunning) {
      if (startEpochRef.current === null) {
        startEpochRef.current = Date.now()
      }
      timerRef.current = setInterval(computeAndSync, 500)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
      // Accumulate elapsed time so resume is accurate after a pause
      if (startEpochRef.current !== null) {
        elapsedAtPauseRef.current += Math.floor((Date.now() - startEpochRef.current) / 1000)
        startEpochRef.current = null
      }
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [state.isRunning, computeAndSync])

  // -- Visibility change: snap to correct time the moment user returns to tab --
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') computeAndSync()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [computeAndSync])

  // -- Reset elapsed tracking when mode changes --
  useEffect(() => {
    startEpochRef.current     = null
    elapsedAtPauseRef.current = 0
  }, [state.mode])

  // -- Public actions --
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
