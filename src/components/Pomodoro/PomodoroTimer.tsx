import { useState } from 'react'
import { Play, Pause, RotateCcw, AlertTriangle, ChevronRight } from 'lucide-react'
import { usePomodoro } from '../../hooks/usePomodoro'
import { PomodoroMode } from '../../types'

interface Props {
  userId: string
}

const MODE_LABELS: Record<PomodoroMode, string> = {
  focus: '🎯 Focus',
  short_break: '☕ Short Break',
  long_break: '🌿 Long Break',
}

const MODE_COLORS: Record<PomodoroMode, string> = {
  focus: 'text-indigo-400',
  short_break: 'text-green-400',
  long_break: 'text-purple-400',
}

const RING_COLORS: Record<PomodoroMode, string> = {
  focus: '#6366f1',
  short_break: '#10b981',
  long_break: '#8b5cf6',
}

const RING_BG: Record<PomodoroMode, string> = {
  focus: '#1e1b4b',
  short_break: '#022c22',
  long_break: '#2e1065',
}

const DURATIONS: Record<PomodoroMode, number> = {
  focus: 25 * 60,
  short_break: 5 * 60,
  long_break: 15 * 60,
}

export default function PomodoroTimer({ userId }: Props) {
  const { state, start, pause, reset, abandon, addDistraction, setTask, switchMode } = usePomodoro(userId)
  const [taskInput, setTaskInput] = useState('')

  const { mode, timeLeft, isRunning, cycles, distractions } = state

  const totalSeconds = DURATIONS[mode]
  const progress = timeLeft / totalSeconds
  const radius = 88
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference * (1 - progress)

  const mins = String(Math.floor(timeLeft / 60)).padStart(2, '0')
  const secs = String(timeLeft % 60).padStart(2, '0')

  const handleTaskKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      setTask(taskInput)
      ;(e.target as HTMLInputElement).blur()
    }
  }

  return (
    <div className="flex flex-col items-center gap-6 pb-4">
      {/* Mode selector */}
      <div className="flex bg-gray-800/80 rounded-2xl p-1 gap-1">
        {(Object.keys(MODE_LABELS) as PomodoroMode[]).map(m => (
          <button
            key={m}
            onClick={() => { if (!isRunning) switchMode(m) }}
            disabled={isRunning}
            className={`text-xs px-3 py-2 rounded-xl transition-all font-medium ${
              mode === m
                ? 'bg-gray-700 text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-300 disabled:cursor-not-allowed'
            }`}
          >
            {MODE_LABELS[m]}
          </button>
        ))}
      </div>

      {/* Circular timer */}
      <div className="relative flex items-center justify-center">
        <svg width="240" height="240" className="-rotate-90" style={{ filter: 'drop-shadow(0 0 20px ' + RING_COLORS[mode] + '33)' }}>
          <circle cx="120" cy="120" r={radius} fill="none" stroke={RING_BG[mode]} strokeWidth="12" />
          <circle
            cx="120" cy="120" r={radius} fill="none"
            stroke={RING_COLORS[mode]}
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-1000 ease-linear"
          />
        </svg>

        <div className="absolute flex flex-col items-center gap-1">
          <span className={`text-6xl font-mono font-bold tabular-nums tracking-tight ${MODE_COLORS[mode]}`}>
            {mins}:{secs}
          </span>
          <span className="text-gray-500 text-sm">{MODE_LABELS[mode]}</span>
          {state.taskLabel && (
            <span className="text-gray-400 text-xs mt-1 max-w-[150px] truncate">{state.taskLabel}</span>
          )}
        </div>
      </div>

      {/* Task input */}
      <input
        type="text"
        placeholder="What are you focusing on? Press Enter to set"
        value={taskInput}
        onChange={e => setTaskInput(e.target.value)}
        onKeyDown={handleTaskKey}
        className="w-full bg-gray-800 text-white text-sm px-4 py-3 rounded-xl border border-gray-700 focus:border-indigo-500 outline-none text-center placeholder:text-gray-600 transition-colors"
      />

      {/* Main controls */}
      <div className="flex items-center gap-4">
        <button
          onClick={reset}
          disabled={isRunning}
          className="p-3.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed text-gray-400 rounded-xl transition-colors"
          title="Reset"
        >
          <RotateCcw className="w-5 h-5" />
        </button>

        <button
          onClick={isRunning ? pause : start}
          className={`px-12 py-4 rounded-xl font-semibold text-white flex items-center gap-2 text-base transition-all shadow-lg ${
            isRunning
              ? 'bg-gray-700 hover:bg-gray-600 shadow-gray-900'
              : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-500/30 hover:scale-105'
          }`}
        >
          {isRunning ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 fill-white" />}
          {isRunning ? 'Pause' : 'Start'}
        </button>

        <button
          onClick={addDistraction}
          className="p-3.5 bg-gray-800 hover:bg-yellow-900/40 text-yellow-500 rounded-xl transition-colors"
          title="Log a distraction (e.g. checked phone)"
        >
          <AlertTriangle className="w-5 h-5" />
        </button>
      </div>

      {/* Cycle dots */}
      <div className="flex items-center gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className={`w-2.5 h-2.5 rounded-full transition-colors ${
              i < (cycles % 4) ? 'bg-indigo-500' : 'bg-gray-700'
            }`}
          />
        ))}
        {cycles >= 4 && (
          <span className="text-gray-500 text-xs ml-1">×{Math.floor(cycles / 4) + 1}</span>
        )}
      </div>

      {/* Stats */}
      <div className="w-full grid grid-cols-3 gap-3">
        {[
          { label: 'Cycles', value: cycles, color: 'text-indigo-400' },
          { label: 'Distractions', value: distractions, color: distractions > 3 ? 'text-red-400' : 'text-yellow-400' },
          { label: 'Focus Time', value: `${cycles * 25}m`, color: 'text-green-400' },
        ].map(stat => (
          <div key={stat.label} className="bg-gray-800 rounded-xl p-3 text-center">
            <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
            <p className="text-gray-500 text-xs mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Distraction tip */}
      {distractions > 0 && mode === 'focus' && (
        <div className="flex items-start gap-2 bg-yellow-900/20 border border-yellow-800/40 rounded-xl px-4 py-3 w-full">
          <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
          <p className="text-yellow-300/80 text-xs">
            {distractions} distraction{distractions > 1 ? 's' : ''} logged. Each break in focus costs ~23 min to regain deep work. Keep going!
          </p>
        </div>
      )}

      {/* Next mode hint */}
      {!isRunning && cycles > 0 && (
        <div className="flex items-center gap-2 text-gray-500 text-xs">
          <ChevronRight className="w-3 h-3" />
          Next: {cycles % 4 === 0 ? '🌿 Long Break (15min)' : '☕ Short Break (5min)'} after this focus session
        </div>
      )}

      {/* Abandon */}
      {(isRunning || state.sessionId) && (
        <button
          onClick={abandon}
          className="text-gray-600 hover:text-red-400 text-xs transition-colors mt-1"
        >
          Abandon session
        </button>
      )}
    </div>
  )
}
