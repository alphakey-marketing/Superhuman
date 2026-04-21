import { useState, useEffect, useCallback, useRef } from 'react'
import { Brain, LayoutDashboard, Target, Timer, LogOut, Menu, X, BarChart2, Dumbbell, Flame } from 'lucide-react'
import { useAuth } from './hooks/useAuth'
import { useDistraction } from './hooks/useDistraction'
import { supabase } from './lib/supabase'
import LoginForm from './components/Auth/LoginForm'
import BudgetPlanner from './components/Budget/BudgetPlanner'
import PomodoroTimer from './components/Pomodoro/PomodoroTimer'
import Dashboard from './components/Dashboard/Dashboard'
import DistractionTracker from './components/Analytics/DistractionTracker'
import StreakWidget from './components/Analytics/StreakWidget'
import RestorationBreak from './components/Breaks/RestorationBreak'
import PracticeTracker from './components/Practice/PracticeTracker'
import MotivationVault from './components/Practice/MotivationVault'
import QuickStart from './components/Dashboard/QuickStart'
import WelcomeModal from './components/Onboarding/WelcomeModal'
import UATBanner from './components/UATBanner'

type Tab = 'dashboard' | 'budget' | 'pomodoro' | 'analytics' | 'practice' | 'vault'

const MS_24H = 24 * 60 * 60 * 1000

// Stamped once when the JS bundle first loads — survives re-renders but not a
// hard reload (which is exactly what we want to detect).
const APP_BOOT_TIME = Date.now()

const tabs = [
  { id: 'dashboard' as Tab, label: 'Home',      shortLabel: 'Home',  icon: LayoutDashboard },
  { id: 'budget'    as Tab, label: 'Planner',   shortLabel: 'Plan',  icon: Target },
  { id: 'pomodoro'  as Tab, label: 'Timer',     shortLabel: 'Timer', icon: Timer },
  { id: 'analytics' as Tab, label: 'Analytics', shortLabel: 'Stats', icon: BarChart2 },
  { id: 'practice'  as Tab, label: 'Practice',  shortLabel: 'Train', icon: Dumbbell },
  { id: 'vault'     as Tab, label: 'Fuel',      shortLabel: 'Fuel',  icon: Flame },
]

function getTodayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getTodayLabel() {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
}

export default function App() {
  const { user, loading, signOut } = useAuth()
  const [activeTab, setActiveTab] = useState<Tab>('dashboard')
  const [menuOpen, setMenuOpen] = useState(false)
  const [showBreak, setShowBreak] = useState(false)
  const [pomodoroRunning, setPomodoroRunning] = useState(false)
  const [pomodoroTimeLeft, setPomodoroTimeLeft] = useState<number | null>(null)
  const [showOnboarding, setShowOnboarding] = useState(false)

  const [hasBudget, setHasBudget] = useState(false)
  const [hasSessions, setHasSessions] = useState(false)
  const [hasSkills, setHasSkills] = useState(false)

  // ── Single source of truth for "today" ────────────────────────────────────
  const [today, setToday]           = useState(getTodayStr)
  const [todayLabel, setTodayLabel] = useState(getTodayLabel)

  const syncDate = useCallback(() => {
    const real = getTodayStr()
    setToday(prev => {
      if (prev !== real) {
        setTodayLabel(getTodayLabel())
        return real
      }
      return prev
    })
  }, [])

  // ── Midnight setTimeout (works when screen stays on) ──────────────────────
  useEffect(() => {
    const scheduleRefresh = () => {
      const now  = new Date()
      const next = new Date(now)
      next.setDate(next.getDate() + 1)
      next.setHours(0, 0, 0, 0)
      const msUntilMidnight = next.getTime() - now.getTime()
      const timeout = setTimeout(() => {
        syncDate()
        scheduleRefresh()
      }, msUntilMidnight)
      return timeout
    }
    const timeout = scheduleRefresh()
    return () => clearTimeout(timeout)
  }, [syncDate])

  // ── visibilitychange guard (covers lid-open, phone-unlock, tab-return) ────
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') syncDate()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [syncDate])

  // ── Hard-reload fallback (last-resort safety net) ──────────────────────
  // If the app has been open for >24 h AND no Pomodoro is running, reload the
  // page the next time the user returns to the tab. This guarantees a completely
  // fresh state even if any React date logic silently failed.
  // pomodoroRunningRef lets the closure read the live value without re-registering
  // the event listener on every render.
  const pomodoroRunningRef = useRef(pomodoroRunning)
  useEffect(() => { pomodoroRunningRef.current = pomodoroRunning }, [pomodoroRunning])

  useEffect(() => {
    const onVisible = () => {
      if (
        document.visibilityState === 'visible' &&
        !pomodoroRunningRef.current &&
        Date.now() - APP_BOOT_TIME > MS_24H
      ) {
        window.location.reload()
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  useDistraction(user?.id, pomodoroRunning)

  useEffect(() => {
    if (user && !user.user_metadata?.attentionos_onboarded) {
      setShowOnboarding(true)
    }
  }, [user])

  // ── QuickStart badge check ──────────────────────────────────────────────
  const checkBadges = useCallback(async (uid: string, date: string) => {
    const [{ data: b }, { data: s }, { data: sk }] = await Promise.all([
      supabase.from('attention_budgets').select('id').eq('user_id', uid).eq('date', date).limit(1),
      supabase.from('pomodoro_sessions').select('id').eq('user_id', uid).gte('started_at', date).limit(1),
      supabase.from('practice_skills').select('id').eq('user_id', uid).limit(1),
    ])
    setHasBudget((b?.length ?? 0) > 0)
    setHasSessions((s?.length ?? 0) > 0)
    setHasSkills((sk?.length ?? 0) > 0)
  }, [])

  useEffect(() => {
    if (!user) return
    checkBadges(user.id, today)
  }, [user, today, checkBadges])

  // Re-check badges on visibility restore (covers overnight open case)
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && user) {
        checkBadges(user.id, getTodayStr())
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [user, checkBadges])

  const handleOnboardingDone = async () => {
    try {
      await supabase.auth.updateUser({ data: { attentionos_onboarded: true } })
    } catch (err) {
      console.warn('[App] Could not store onboarding flag in user metadata, falling back to localStorage:', err)
      localStorage.setItem('attentionos_onboarded_v1', '1')
    }
    setShowOnboarding(false)
  }

  const formatTime = (secs: number) => {
    const m = String(Math.floor(secs / 60)).padStart(2, '0')
    const s = String(secs % 60).padStart(2, '0')
    return `${m}:${s}`
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
          <p className="text-gray-500 text-sm">Loading AttentionOS...</p>
        </div>
      </div>
    )
  }

  if (!user) return <LoginForm />

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      <UATBanner />

      {showOnboarding && <WelcomeModal onDone={handleOnboardingDone} />}

      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-950/95 backdrop-blur sticky top-0 z-50">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-indigo-600 rounded-xl shadow-sm shadow-indigo-500/30">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="font-bold text-white text-sm">AttentionOS</span>
              <span className="text-gray-500 text-xs ml-2 hidden sm:inline">{todayLabel}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {pomodoroRunning && pomodoroTimeLeft !== null && activeTab !== 'pomodoro' && (
              <button
                onClick={() => setActiveTab('pomodoro')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-900/50 hover:bg-indigo-900/70 border border-indigo-700/50 text-indigo-300 text-xs rounded-lg transition-colors font-mono"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                {formatTime(pomodoroTimeLeft)}
              </button>
            )}
            <button
              onClick={() => signOut()}
              className="hidden sm:flex items-center gap-1.5 text-gray-500 hover:text-gray-300 text-xs transition-colors px-2 py-1 rounded-lg hover:bg-gray-800"
            >
              <LogOut className="w-3.5 h-3.5" /> Sign Out
            </button>
            <button onClick={() => setMenuOpen(!menuOpen)} className="sm:hidden p-1.5 text-gray-500 hover:text-gray-300">
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
        {menuOpen && (
          <div className="sm:hidden border-t border-gray-800 bg-gray-900 px-4 py-3 space-y-2">
            <button onClick={() => { signOut(); setMenuOpen(false) }} className="flex items-center gap-2 text-gray-400 text-sm">
              <LogOut className="w-4 h-4" /> Sign Out
            </button>
          </div>
        )}
      </header>

      {/* Tab bar */}
      <nav className="border-b border-gray-800 bg-gray-950 sticky top-[57px] z-40 overflow-x-auto scrollbar-hide">
        <div className="max-w-2xl mx-auto px-2 flex">
          {tabs.map(tab => {
            const Icon = tab.icon
            const isTimer = tab.id === 'pomodoro'
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex flex-col items-center gap-0.5 px-1 py-2.5 border-b-2 transition-all font-medium relative ${
                  activeTab === tab.id ? 'border-indigo-500 text-white' : 'border-transparent text-gray-500 hover:text-gray-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="text-[10px] leading-none">{tab.shortLabel}</span>
                {isTimer && pomodoroRunning && activeTab !== 'pomodoro' && (
                  <span className="absolute top-1.5 right-2 w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                )}
              </button>
            )
          })}
        </div>
      </nav>

      {/* Main content */}
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6 pb-12">

        {activeTab === 'dashboard' && (
          <>
            <div className="mb-5">
              <h2 className="text-xl font-bold text-white">Good day 👋</h2>
              <p className="text-gray-500 text-sm mt-0.5">{todayLabel}</p>
            </div>
            <div className="space-y-4">
              <QuickStart
                onNavigate={(tab) => setActiveTab(tab as Tab)}
                hasBudget={hasBudget}
                hasSessions={hasSessions}
                hasSkills={hasSkills}
              />
              <Dashboard userId={user.id} today={today} onNavigate={(tab) => setActiveTab(tab as Tab)} />
              {/* Quick-add fuel shortcut */}
              <button
                onClick={() => setActiveTab('vault')}
                className="w-full flex items-center gap-3 bg-gradient-to-r from-orange-950/30 to-red-950/20 border border-orange-800/30 hover:border-orange-700/50 rounded-2xl px-4 py-3 transition-colors text-left"
              >
                <Flame className="w-4 h-4 text-orange-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-orange-300 text-sm font-medium">Add fuel to your vault</p>
                  <p className="text-gray-500 text-xs mt-0.5">Store your motivation — it shows up before every session.</p>
                </div>
                <span className="text-orange-500 text-xs">→</span>
              </button>
            </div>
          </>
        )}

        {activeTab === 'budget' && (
          <>
            <div className="mb-3">
              <h2 className="text-xl font-bold text-white">Attention Planner</h2>
              <p className="text-gray-500 text-sm mt-0.5">{todayLabel}</p>
            </div>
            <div className="bg-indigo-950/30 border border-indigo-900/40 rounded-xl px-4 py-3 mb-4">
              <p className="text-indigo-300 text-xs leading-relaxed">
                💡 <strong>How this works:</strong> Decide upfront how many hours to give each area of your life today. When you have a plan, you’re 2× more likely to stick to it.
              </p>
            </div>
            <BudgetPlanner userId={user.id} date={today} />
          </>
        )}

        {activeTab === 'analytics' && (
          <>
            <div className="mb-3">
              <h2 className="text-xl font-bold text-white">Analytics</h2>
              <p className="text-gray-500 text-sm mt-0.5">Your focus stats and distraction patterns</p>
            </div>
            <div className="bg-indigo-950/30 border border-indigo-900/40 rounded-xl px-4 py-3 mb-4">
              <p className="text-indigo-300 text-xs leading-relaxed">
                💡 <strong>How this works:</strong> Every time you switch tabs during a Pomodoro, it’s auto-logged. Review your patterns here to find your biggest distraction triggers.
              </p>
            </div>
            <div className="space-y-4">
              <StreakWidget userId={user.id} today={today} />
              <DistractionTracker userId={user.id} today={today} />
            </div>
          </>
        )}

        {activeTab === 'practice' && (
          <>
            <div className="mb-3">
              <h2 className="text-xl font-bold text-white">Deliberate Practice</h2>
              <p className="text-gray-500 text-sm mt-0.5">Track mastery. Every hour compounds.</p>
            </div>
            <div className="bg-indigo-950/30 border border-indigo-900/40 rounded-xl px-4 py-3 mb-4">
              <p className="text-indigo-300 text-xs leading-relaxed">
                💡 <strong>How this works:</strong> Add a skill you’re building. After every practice session, log the time, difficulty, and quality. Milestones unlock at 10h → 25h → 50h → 100h. The 10,000-hour rule starts with rep one.
              </p>
            </div>
            <PracticeTracker userId={user.id} />
          </>
        )}

        {activeTab === 'vault' && (
          <>
            <div className="mb-3">
              <h2 className="text-xl font-bold text-white">Fuel</h2>
              <p className="text-gray-500 text-sm mt-0.5">Your fuel. Your proof. Your fire.</p>
            </div>
            <div className="bg-orange-950/30 border border-orange-900/40 rounded-xl px-4 py-3 mb-4">
              <p className="text-orange-300 text-xs leading-relaxed">
                💡 <strong>How this works:</strong> Store statements that fire you up. Open this tab before a hard session. Pin your best ones to the top. The Spotlight card shows one at random — shuffle it until one hits.
              </p>
            </div>
            <MotivationVault userId={user.id} />
          </>
        )}

        <div className={activeTab === 'pomodoro' ? 'block' : 'hidden'}>
          <div className="mb-3 text-center">
            <h2 className="text-xl font-bold text-white">Focus Timer</h2>
            <p className="text-gray-500 text-sm mt-0.5">25 min focus · 5 min break · repeat</p>
          </div>
          <div className="bg-indigo-950/30 border border-indigo-900/40 rounded-xl px-4 py-3 mb-4">
            <p className="text-indigo-300 text-xs leading-relaxed">
              💡 <strong>How this works:</strong> Work in 25-min blocks. No phone, no tabs. If you get distracted, tap ⚠️ to log it — awareness is how you improve. Take a 🌿 break after each cycle.
            </p>
          </div>
          <PomodoroTimer
            userId={user.id}
            date={today}
            onRunningChange={setPomodoroRunning}
            onTimeLeftChange={setPomodoroTimeLeft}
            onBreakRequest={() => setShowBreak(true)}
            onNavigate={(tab) => setActiveTab(tab as Tab)}
          />
        </div>

      </main>

      {showBreak && user && (
        <RestorationBreak userId={user.id} onClose={() => setShowBreak(false)} />
      )}
    </div>
  )
}
