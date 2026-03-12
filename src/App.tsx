import { useState, useEffect } from 'react'
import { Brain, LayoutDashboard, Target, Timer, LogOut, Menu, X, BarChart2, Leaf, Dumbbell, Flame } from 'lucide-react'
import { useAuth } from './hooks/useAuth'
import { useDistraction } from './hooks/useDistraction'
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

const ONBOARDING_KEY = 'attentionos_onboarded_v1'

const tabs = [
  { id: 'dashboard' as Tab, label: 'Home',     shortLabel: 'Home',     icon: LayoutDashboard },
  { id: 'budget'    as Tab, label: 'Planner',  shortLabel: 'Plan',     icon: Target },
  { id: 'pomodoro'  as Tab, label: 'Timer',    shortLabel: 'Timer',    icon: Timer },
  { id: 'analytics' as Tab, label: 'Analytics',shortLabel: 'Stats',    icon: BarChart2 },
  { id: 'practice'  as Tab, label: 'Practice', shortLabel: 'Train',    icon: Dumbbell },
  { id: 'vault'     as Tab, label: 'Vault',    shortLabel: 'Vault',    icon: Flame },
]

export default function App() {
  const { user, loading, signOut } = useAuth()
  const [activeTab, setActiveTab] = useState<Tab>('dashboard')
  const [menuOpen, setMenuOpen] = useState(false)
  const [showBreak, setShowBreak] = useState(false)
  const [pomodoroRunning, setPomodoroRunning] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)

  // Practice / session quick-start status (lifted from children via local check)
  const [hasBudget, setHasBudget] = useState(false)
  const [hasSessions, setHasSessions] = useState(false)
  const [hasSkills, setHasSkills] = useState(false)

  const today = new Date().toISOString().split('T')[0]
  const todayLabel = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })

  useDistraction(user?.id, pomodoroRunning)

  // Show onboarding modal on first ever login
  useEffect(() => {
    if (user && !localStorage.getItem(ONBOARDING_KEY)) {
      setShowOnboarding(true)
    }
  }, [user])

  // Check quick-start status
  useEffect(() => {
    if (!user) return
    const check = async () => {
      const { supabase } = await import('./lib/supabase')
      const [{ data: b }, { data: s }, { data: sk }] = await Promise.all([
        supabase.from('attention_budgets').select('id').eq('user_id', user.id).eq('date', today).limit(1),
        supabase.from('pomodoro_sessions').select('id').eq('user_id', user.id).gte('started_at', today).limit(1),
        supabase.from('practice_skills').select('id').eq('user_id', user.id).limit(1),
      ])
      setHasBudget((b?.length ?? 0) > 0)
      setHasSessions((s?.length ?? 0) > 0)
      setHasSkills((sk?.length ?? 0) > 0)
    }
    check()
  }, [user, today, activeTab])

  const handleOnboardingDone = () => {
    localStorage.setItem(ONBOARDING_KEY, '1')
    setShowOnboarding(false)
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

      {/* Welcome onboarding modal — shows once */}
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
            <button
              onClick={() => setShowBreak(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-900/30 hover:bg-emerald-900/50 border border-emerald-800/40 text-emerald-400 text-xs rounded-lg transition-colors"
            >
              <Leaf className="w-3.5 h-3.5" />
              <span>Break</span>
            </button>
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
            <button onClick={() => { setShowBreak(true); setMenuOpen(false) }} className="flex items-center gap-2 text-emerald-400 text-sm">
              <Leaf className="w-4 h-4" /> Take a Break
            </button>
            <button onClick={() => { signOut(); setMenuOpen(false) }} className="flex items-center gap-2 text-gray-400 text-sm">
              <LogOut className="w-4 h-4" /> Sign Out
            </button>
          </div>
        )}
      </header>

      {/* Tab bar — labels always visible, scrollable */}
      <nav className="border-b border-gray-800 bg-gray-950 sticky top-[57px] z-40 overflow-x-auto scrollbar-hide">
        <div className="max-w-2xl mx-auto px-2 flex">
          {tabs.map(tab => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex flex-col items-center gap-0.5 px-1 py-2.5 border-b-2 transition-all font-medium ${
                  activeTab === tab.id ? 'border-indigo-500 text-white' : 'border-transparent text-gray-500 hover:text-gray-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="text-[10px] leading-none">{tab.shortLabel}</span>
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
              <StreakWidget userId={user.id} />
              <Dashboard userId={user.id} onNavigate={(tab) => setActiveTab(tab as Tab)} />
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
                💡 <strong>How this works:</strong> Decide upfront how many hours to give each area of your life today. When you have a plan, you're 2× more likely to stick to it.
              </p>
            </div>
            <BudgetPlanner userId={user.id} date={today} />
          </>
        )}
        {activeTab === 'pomodoro' && (
          <>
            <div className="mb-3 text-center">
              <h2 className="text-xl font-bold text-white">Focus Timer</h2>
              <p className="text-gray-500 text-sm mt-0.5">25 min focus · 5 min break · repeat</p>
            </div>
            <div className="bg-indigo-950/30 border border-indigo-900/40 rounded-xl px-4 py-3 mb-4">
              <p className="text-indigo-300 text-xs leading-relaxed">
                💡 <strong>How this works:</strong> Work in 25-min blocks. No phone, no tabs. If you get distracted, tap ⚠️ to log it — awareness is how you improve. Take a 🌿 break after each cycle.
              </p>
            </div>
            <PomodoroTimer userId={user.id} onRunningChange={setPomodoroRunning} />
          </>
        )}
        {activeTab === 'analytics' && (
          <>
            <div className="mb-3">
              <h2 className="text-xl font-bold text-white">Analytics</h2>
              <p className="text-gray-500 text-sm mt-0.5">Your distraction patterns this week</p>
            </div>
            <div className="bg-indigo-950/30 border border-indigo-900/40 rounded-xl px-4 py-3 mb-4">
              <p className="text-indigo-300 text-xs leading-relaxed">
                💡 <strong>How this works:</strong> Every time you switch tabs during a Pomodoro, it's auto-logged. Review your patterns here to find your biggest distraction triggers.
              </p>
            </div>
            <DistractionTracker userId={user.id} />
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
                💡 <strong>How this works:</strong> Add a skill you're building. After every practice session, log the time, difficulty, and quality. Milestones unlock at 10h → 25h → 50h → 100h. The 10,000-hour rule starts with rep one.
              </p>
            </div>
            <PracticeTracker userId={user.id} />
          </>
        )}
        {activeTab === 'vault' && (
          <>
            <div className="mb-3">
              <h2 className="text-xl font-bold text-white">Motivation Vault</h2>
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
      </main>

      {showBreak && user && (
        <RestorationBreak userId={user.id} onClose={() => setShowBreak(false)} />
      )}
    </div>
  )
}
