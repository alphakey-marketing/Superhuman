import { useState, useEffect } from 'react'
import { Play, Pause, RotateCcw, AlertTriangle, ChevronRight, Leaf, ChevronDown } from 'lucide-react'
import { usePomodoro } from '../../hooks/usePomodoro'
import { PomodoroMode, AttentionBudget, CATEGORY_COLORS } from '../../types'
import { supabase } from '../../lib/supabase'

interface Props {
  userId: string
  date: string
  onRunningChange?: (running: boolean) => void
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

const CATEGORY_EMOJI: Record<string, string> = {
  'Deep Work': '🧠',
  'Learning':  '📚',
  'Creative':  '🎨',
  'Admin':     '📋',
  'Exercise':  '💪',
  'Rest':      '😴',
  'Social':    '🤝',
}

export default function PomodoroTimer({ userId, date, onRunningChange }: Props) {
  const { state, start, pause, reset, abandon, addDistraction, setTask, switchMode } = usePomodoro(userId)

  // Today's planned budget rows fetched from Supabase
  const [budgets, setBudgets] = useState<AttentionBudget[]>([])
  // Which budget row the user selected
  const [selectedBudgetId, setSelectedBudgetId] = useState<string>('')
  // Optional free-text note within the category
  const [taskNote, setTaskNote] = useState('')
  // Whether the picker is locked (session is running)
  const [pickerOpen, setPickerOpen] = useState(false)

  const { mode, timeLeft, isRunning, cycles, distractions } = state

  // Load today's budgets
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('attention_budgets')
        .select('*')
        .eq('user_id', userId)
        .eq('date', date)
        .order('created_at')
      setBudgets(data ?? [])
    }
    load()
  }, [userId, date])

  // Whenever the selection changes, push it into the hook
  useEffect(() => {
    const row = budgets.find(b => b.id === selectedBudgetId) ?? null
    const label = row
      ? taskNote.trim() ? `${row.category} — ${taskNote.trim()}` : row.category
      : taskNote.trim()
    setTask(label, row?.category ?? null, row?.id ?? null)
  }, [selectedBudgetId, taskNote, budgets, setTask])

  const selectedBudget = budgets.find(b => b.id === selectedBudgetId) ?? null

  const handleStart = () => { start(); onRunningChange?.(true) }
  const handlePause = () => { pause(); onRunningChange?.(false) }
  const handleAbandon = () => { abandon(); onRunningChange?.(false) }

  const totalSeconds = DURATIONS[mode]
  const progress = timeLeft / totalSeconds
  const radius = 88
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference * (1 - progress)

  const mins = String(Math.floor(timeLeft / 60)).padStart(2, '0')
  const secs = String(timeLeft % 60).padStart(2, '0')

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
          {/* Show selected category + note inside the ring */}
          {selectedBudget && (
            <div className="flex items-center gap-1 mt-1">
              <span className="text-xs">{CATEGORY_EMOJI[selectedBudget.category] ?? '📌'}</span>
              <span className="text-xs font-medium" style={{ color: selectedBudget.color ?? CATEGORY_COLORS[selectedBudget.category] }}>
                {selectedBudget.category}
              </span>
            </div>
          )}
          {taskNote.trim() && (
            <span className="text-gray-500 text-[11px] max-w-[140px] truncate">{taskNote.trim()}</span>
          )}
        </div>
      </div>

      {/* ── Focus picker (only shown in focus mode, locked while running) ── */}
      {mode === 'focus' && (
        <div className="w-full space-y-2">

          {budgets.length > 0 ? (
            // --- Budget category picker ---
            <div>
              <p className="text-gray-500 text-xs mb-1.5 px-1">What are you working on?</p>
              <div className="grid grid-cols-2 gap-1.5">
                {/* "No category" option */}
                <button
                  disabled={isRunning}
                  onClick={() => setSelectedBudgetId('')}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                    selectedBudgetId === ''
                      ? 'bg-gray-700 border-gray-500 text-white'
                      : 'bg-gray-800 border-gray-700 text-gray-500 hover:border-gray-500 hover:text-gray-300'
                  }`}
                >
                  <span>✨</span>
                  <span className="text-xs">Unplanned</span>
                </button>

                {budgets.map(b => (
                  <button
                    key={b.id}
                    disabled={isRunning}
                    onClick={() => setSelectedBudgetId(b.id)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                      selectedBudgetId === b.id
                        ? 'border-opacity-100 text-white'
                        : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200'
                    }`}
                    style={selectedBudgetId === b.id ? {
                      backgroundColor: (b.color ?? CATEGORY_COLORS[b.category]) + '22',
                      borderColor: b.color ?? CATEGORY_COLORS[b.category],
                      color: b.color ?? CATEGORY_COLORS[b.category],
                    } : {}}
                  >
                    <span>{CATEGORY_EMOJI[b.category] ?? '📌'}</span>
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-xs font-medium leading-tight truncate">{b.category}</p>
                      <p className="text-[10px] opacity-60 leading-tight">{b.hours_used.toFixed(1)}h / {b.hours_allocated}h</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            // --- No plan yet: nudge to create one ---
            <div className="bg-amber-950/20 border border-amber-800/30 rounded-xl px-4 py-3">
              <p className="text-amber-300 text-xs leading-relaxed">
                💡 You haven't set a plan for today yet. Go to <strong>Planner</strong> to allocate your hours — then this picker will show your categories.
              </p>
            </div>
          )}

          {/* Optional specific task note */}
          <input
            type="text"
            placeholder={selectedBudget ? `Specific task within ${selectedBudget.category} (optional)` : 'Specific task (optional)'}
            value={taskNote}
            disabled={isRunning}
            onChange={e => setTaskNote(e.target.value)}
            className="w-full bg-gray-800 text-white text-sm px-4 py-3 rounded-xl border border-gray-700 focus:border-indigo-500 outline-none text-center placeholder:text-gray-600 transition-colors disabled:opacity-50"
          />
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center gap-4">
        <button
          onClick={reset}
          disabled={isRunning}
          className="p-3.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed text-gray-400 rounded-xl transition-colors"
        >
          <RotateCcw className="w-5 h-5" />
        </button>
        <button
          onClick={isRunning ? handlePause : handleStart}
          className={`px-12 py-4 rounded-xl font-semibold text-white flex items-center gap-2 text-base transition-all shadow-lg ${
            isRunning
              ? 'bg-gray-700 hover:bg-gray-600'
              : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-500/30 hover:scale-105'
          }`}
        >
          {isRunning ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 fill-white" />}
          {isRunning ? 'Pause' : 'Start'}
        </button>
        <button
          onClick={addDistraction}
          className="p-3.5 bg-gray-800 hover:bg-yellow-900/40 text-yellow-500 rounded-xl transition-colors"
          title="Log a distraction"
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
        {cycles >= 4 && <span className="text-gray-500 text-xs ml-1">×{Math.floor(cycles / 4) + 1}</span>}
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
            {distractions} distraction{distractions > 1 ? 's' : ''} logged. Each costs ~23min to regain deep focus. Try a restoration break after this session.
          </p>
        </div>
      )}

      {/* Break suggestion */}
      {!isRunning && cycles > 0 && mode !== 'focus' && (
        <div className="flex items-center gap-2 bg-emerald-900/20 border border-emerald-800/30 rounded-xl px-4 py-3 w-full">
          <Leaf className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <p className="text-emerald-300/80 text-xs">Great session! Hit the 🌿 Break button in the header for a science-backed restoration break.</p>
        </div>
      )}

      {!isRunning && cycles === 0 && (
        <div className="flex items-center gap-1.5 text-gray-500 text-xs">
          <ChevronRight className="w-3 h-3" />
          After 4 cycles: 🌿 Long Break (15min)
        </div>
      )}

      {(isRunning || state.sessionId) && (
        <button onClick={handleAbandon} className="text-gray-600 hover:text-red-400 text-xs transition-colors">
          Abandon session
        </button>
      )}
    </div>
  )
}
