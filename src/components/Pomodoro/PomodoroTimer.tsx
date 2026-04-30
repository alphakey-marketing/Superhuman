import { useState, useEffect, useCallback, useRef } from 'react'
import { Play, Pause, RotateCcw, AlertTriangle, ChevronRight, Leaf, Flame, Dumbbell } from 'lucide-react'
import { usePomodoro } from '../../hooks/usePomodoro'
import { PomodoroMode, AttentionBudget, CATEGORY_COLORS, MotivationEntry, VAULT_TYPES, PracticeSkill, PracticeSubSkill } from '../../types'
import { supabase } from '../../lib/supabase'
import { toLocalDateStr } from '../../lib/date'

interface Props {
  userId: string
  date: string
  onRunningChange?: (running: boolean) => void
  onTimeLeftChange?: (timeLeft: number | null) => void
  onBreakRequest?: () => void
  onNavigate?: (tab: string) => void
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

// Kept in sync with CATEGORY_COLORS in types/index.ts
const CATEGORY_EMOJI: Record<string, string> = {
  'Deep Work':     '🧠',
  'Learning':      '📚',
  'Creative':      '🎨',
  'Admin':         '📋',
  'Exercise':      '💪',
  'Rest':          '😴',
  'Social':        '🤝',
  'Entertainment': '🎮',
  'Meals':         '🍽️',
}

export default function PomodoroTimer({ userId, date, onRunningChange, onTimeLeftChange, onBreakRequest, onNavigate }: Props) {
  // Pass date into the hook so hydration re-runs on midnight rollover
  const { state, start, pause, reset, abandon, addDistraction, setTask, switchMode } = usePomodoro(userId, date)

  const [budgets, setBudgets]             = useState<AttentionBudget[]>([])
  const [budgetsLoaded, setBudgetsLoaded] = useState(false)
  const [selectedBudgetId, setSelectedBudgetId] = useState<string>('')
  const [taskNote, setTaskNote]           = useState('')
  const [vaultEntry, setVaultEntry]       = useState<MotivationEntry | null>(null)

  // Practice Mode state
  const [practiceMode, setPracticeMode]               = useState(false)
  const [practiceSkills, setPracticeSkills]           = useState<PracticeSkill[]>([])
  const [practiceSubSkills, setPracticeSubSkills]     = useState<PracticeSubSkill[]>([])
  const [practiceSkillsLoaded, setPracticeSkillsLoaded] = useState(false)
  const [selectedPracticeSkillId, setSelectedPracticeSkillId]     = useState<string | null>(null)
  const [selectedPracticeSubSkillId, setSelectedPracticeSubSkillId] = useState<string | null>(null)
  const prevCyclesRef = useRef(0)

  const { mode, timeLeft, isRunning, cycles, distractions, sessionDistractions } = state

  // Bubble timeLeft up so the header mini-pill is always live
  useEffect(() => {
    onTimeLeftChange?.(isRunning ? timeLeft : null)
  }, [timeLeft, isRunning, onTimeLeftChange])

  // Budget fetch
  const loadBudgets = useCallback(async () => {
    const { data } = await supabase
      .from('attention_budgets')
      .select('*')
      .eq('user_id', userId)
      .eq('date', date)
      .order('created_at')
    setBudgets(data ?? [])
    setBudgetsLoaded(true)
  }, [userId, date])

  // Initial load + reset on date change
  useEffect(() => {
    setBudgetsLoaded(false)
    setBudgets([])
    loadBudgets()
  }, [loadBudgets])

  // Re-fetch after each completed cycle to keep hours_used accurate
  useEffect(() => { if (cycles > 0) loadBudgets() }, [cycles, loadBudgets])

  // Re-fetch when user returns to this tab from Planner (template applied)
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && !isRunning) loadBudgets()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [loadBudgets, isRunning])

  // Fetch a random vault entry for the pre-start motivational pull-quote
  const loadVaultEntry = useCallback(async () => {
    const { data } = await supabase
      .from('motivation_vault')
      .select('*')
      .eq('user_id', userId)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(20)
    if (data && data.length > 0) {
      setVaultEntry(data[Math.floor(Math.random() * data.length)])
    }
  }, [userId])

  // Initial vault load on mount / userId change
  useEffect(() => {
    loadVaultEntry()
  }, [loadVaultEntry])

  // Re-fetch vault when user returns to this tab (picks up entries added in Vault tab)
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && !isRunning) loadVaultEntry()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [loadVaultEntry, isRunning])

  // Fetch practice skills/sub-skills when practice mode is toggled on
  useEffect(() => {
    if (!practiceMode) return
    const load = async () => {
      setPracticeSkillsLoaded(false)
      const [{ data: sk }, { data: sub }] = await Promise.all([
        supabase.from('practice_skills').select('*').eq('user_id', userId).order('created_at'),
        supabase.from('practice_sub_skills').select('*').eq('user_id', userId).order('created_at'),
      ])
      setPracticeSkills(sk ?? [])
      setPracticeSubSkills(sub ?? [])
      setPracticeSkillsLoaded(true)
    }
    load()
  }, [practiceMode, userId])

  // Auto-log a practice session when a cycle completes in practice mode
  // Initialize ref to current cycles to avoid triggering on first hydration
  useEffect(() => {
    prevCyclesRef.current = cycles
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (cycles > prevCyclesRef.current && practiceMode && selectedPracticeSkillId) {
      const autoLog = async () => {
        const today = toLocalDateStr()
        const { data: sessionData } = await supabase.from('practice_sessions').insert({
          user_id: userId,
          skill_id: selectedPracticeSkillId,
          sub_skill_id: selectedPracticeSubSkillId ?? null,
          date: today,
          duration_minutes: 25,
          difficulty: 3,
          quality: 3,
          target_weakness: taskNote.trim() || null,
          notes: taskNote.trim() ? `[Pomodoro] ${taskNote.trim()}` : '[Pomodoro auto-logged]',
        }).select().single()
        if (sessionData) {
          // Update skill total_hours client-side
          setPracticeSkills(prev => prev.map(s => s.id === selectedPracticeSkillId
            ? { ...s, total_hours: s.total_hours + 25 / 60 }
            : s
          ))
        }
      }
      autoLog()
    }
    prevCyclesRef.current = cycles
  }, [cycles])

  // Push selection into hook
  useEffect(() => {
    const row = budgets.find(b => b.id === selectedBudgetId) ?? null
    const label = row
      ? taskNote.trim() ? `${row.category} — ${taskNote.trim()}` : row.category
      : taskNote.trim()
    setTask(label, row?.category ?? null, row?.id ?? null)
  }, [selectedBudgetId, taskNote, budgets])

  const selectedBudget = budgets.find(b => b.id === selectedBudgetId) ?? null

  const handleStart   = () => { start();   onRunningChange?.(true)  }
  const handlePause   = () => { pause();   onRunningChange?.(false) }
  const handleAbandon = () => { abandon(); onRunningChange?.(false) }

  const totalSeconds     = DURATIONS[mode]
  const progress         = timeLeft / totalSeconds
  const radius           = 88
  const circumference    = 2 * Math.PI * radius
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

      {/* Focus picker — only in focus mode */}
      {mode === 'focus' && (
        <div className="w-full space-y-2">

          {/* Practice Mode toggle */}
          <div className="flex items-center justify-between px-1 mb-1">
            <span className="text-gray-500 text-xs">What are you working on?</span>
            <button
              disabled={isRunning}
              onClick={() => {
                setPracticeMode(p => !p)
                setSelectedPracticeSkillId(null)
                setSelectedPracticeSubSkillId(null)
                setSelectedBudgetId('')
              }}
              className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                practiceMode
                  ? 'bg-emerald-900/40 border-emerald-700/60 text-emerald-300'
                  : 'bg-gray-800 border-gray-700 text-gray-500 hover:border-gray-600 hover:text-gray-400'
              }`}
            >
              <Dumbbell className="w-3 h-3" />
              Practice Mode
            </button>
          </div>

          {practiceMode ? (
            /* ── Practice skill picker ── */
            !practiceSkillsLoaded ? (
              <div className="h-10 rounded-xl bg-gray-800 animate-pulse" />
            ) : practiceSkills.length === 0 ? (
              <div className="bg-emerald-950/20 border border-emerald-800/30 rounded-xl px-4 py-3">
                <p className="text-emerald-300 text-xs leading-relaxed">
                  💡 No skills found. Go to the <strong>Practice</strong> tab to add your first skill.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {/* Step 1: pick skill */}
                <div className="grid grid-cols-2 gap-1.5">
                  {practiceSkills.map(sk => (
                    <button
                      key={sk.id}
                      disabled={isRunning}
                      onClick={() => {
                        setSelectedPracticeSkillId(sk.id === selectedPracticeSkillId ? null : sk.id)
                        setSelectedPracticeSubSkillId(null)
                      }}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                        selectedPracticeSkillId === sk.id
                          ? 'border-opacity-100 text-white'
                          : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200'
                      }`}
                      style={selectedPracticeSkillId === sk.id ? {
                        backgroundColor: sk.color + '22',
                        borderColor: sk.color,
                        color: sk.color,
                      } : {}}
                    >
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: sk.color }} />
                      <span className="text-xs font-medium truncate">{sk.name}</span>
                    </button>
                  ))}
                </div>

                {/* Step 2: pick sub-skill (only when a skill is selected) */}
                {selectedPracticeSkillId && (() => {
                  const subs = practiceSubSkills.filter(s => s.skill_id === selectedPracticeSkillId)
                  if (subs.length === 0) return null
                  return (
                    <div>
                      <p className="text-gray-600 text-[10px] px-1 mb-1">Focus area (optional)</p>
                      <div className="flex gap-1.5 flex-wrap">
                        <button
                          disabled={isRunning}
                          onClick={() => setSelectedPracticeSubSkillId(null)}
                          className={`text-xs px-3 py-1.5 rounded-full border transition-colors disabled:opacity-50 ${
                            selectedPracticeSubSkillId === null
                              ? 'bg-emerald-700/40 border-emerald-600/60 text-emerald-200'
                              : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'
                          }`}
                        >General</button>
                        {subs.map(sub => (
                          <button
                            key={sub.id}
                            disabled={isRunning}
                            onClick={() => setSelectedPracticeSubSkillId(sub.id === selectedPracticeSubSkillId ? null : sub.id)}
                            className={`text-xs px-3 py-1.5 rounded-full border transition-colors disabled:opacity-50 ${
                              selectedPracticeSubSkillId === sub.id
                                ? 'bg-emerald-700/40 border-emerald-600/60 text-emerald-200'
                                : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'
                            }`}
                          >{sub.name}</button>
                        ))}
                      </div>
                    </div>
                  )
                })()}
              </div>
            )
          ) : (
            /* ── Budget picker ── */
            !budgetsLoaded ? (
              <div className="h-10 rounded-xl bg-gray-800 animate-pulse" />
            ) : budgets.length > 0 ? (
              <div className="grid grid-cols-2 gap-1.5">
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
            ) : (
              <div className="bg-amber-950/20 border border-amber-800/30 rounded-xl px-4 py-3">
                <p className="text-amber-300 text-xs leading-relaxed">
                  💡 You haven't set a plan for today yet. Go to <strong>Planner</strong> to allocate your hours — then this picker will show your categories.
                </p>
              </div>
            )
          )}

          <input
            type="text"
            placeholder={practiceMode && selectedPracticeSkillId
              ? 'Weakness to target this session (optional)'
              : selectedBudget
                ? `Specific task within ${selectedBudget.category} (optional)`
                : 'Specific task (optional)'}
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

      {/* Cycle dots — reflect total cycles today */}
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

      {/* Stats — cycles + total distractions today + focus time */}
      <div className="w-full grid grid-cols-3 gap-3">
        {[
          { label: 'Cycles Today',  value: cycles,            color: 'text-indigo-400' },
          { label: 'Distractions',  value: distractions,      color: distractions > 3 ? 'text-red-400' : 'text-yellow-400' },
          { label: 'Focus Time',    value: `${cycles * 25}m`, color: 'text-green-400' },
        ].map(stat => (
          <div key={stat.label} className="bg-gray-800 rounded-xl p-3 text-center">
            <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
            <p className="text-gray-500 text-xs mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Distraction tip — uses sessionDistractions so it only shows for the current session */}
      {sessionDistractions > 0 && mode === 'focus' && (
        <div className="flex items-start gap-2 bg-yellow-900/20 border border-yellow-800/40 rounded-xl px-4 py-3 w-full">
          <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
          <p className="text-yellow-300/80 text-xs">
            {sessionDistractions} distraction{sessionDistractions > 1 ? 's' : ''} this session. Each costs ~23min to regain deep focus. Try a restoration break after this session.
          </p>
        </div>
      )}

      {/* Motivational pull-quote — shown before every focus session start */}
      {mode === 'focus' && !isRunning && vaultEntry && (
        <div className="w-full bg-gradient-to-r from-orange-950/40 to-red-950/30 border border-orange-800/30 rounded-xl px-4 py-3">
          <div className="flex items-center gap-2 mb-1.5">
            <Flame className="w-3.5 h-3.5 text-orange-400 flex-shrink-0" />
            <span className="text-orange-400 text-xs font-medium">
              {VAULT_TYPES[vaultEntry.type].emoji} {VAULT_TYPES[vaultEntry.type].label}
            </span>
          </div>
          <p className="text-gray-200 text-xs leading-relaxed italic">"{vaultEntry.content}"</p>
        </div>
      )}

      {/* Empty vault nudge — shown when no vault entries exist yet */}
      {mode === 'focus' && !isRunning && !vaultEntry && (
        <button
          onClick={() => onNavigate?.('vault')}
          className="w-full flex items-center gap-3 bg-orange-950/20 border border-orange-800/20 hover:border-orange-700/40 rounded-xl px-4 py-3 transition-colors text-left"
        >
          <Flame className="w-4 h-4 text-orange-500/60 flex-shrink-0" />
          <p className="text-gray-500 text-xs leading-relaxed">
            Add fuel to your vault → it'll show here before every session.
          </p>
        </button>
      )}

      {/* Break suggestion */}
      {!isRunning && cycles > 0 && mode !== 'focus' && (
        <button
          onClick={onBreakRequest}
          className="flex items-center gap-2 bg-emerald-900/20 hover:bg-emerald-900/30 border border-emerald-800/30 rounded-xl px-4 py-3 w-full text-left transition-colors"
        >
          <Leaf className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <p className="text-emerald-300/80 text-xs flex-1">Great session! Tap here for a science-backed restoration break.</p>
          <ChevronRight className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
        </button>
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
