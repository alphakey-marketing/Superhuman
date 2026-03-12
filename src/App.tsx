import { useState } from 'react'
import { Brain, LayoutDashboard, Target, Timer, LogOut, Menu, X, BarChart2, Leaf } from 'lucide-react'
import { useAuth } from './hooks/useAuth'
import { useDistraction } from './hooks/useDistraction'
import LoginForm from './components/Auth/LoginForm'
import BudgetPlanner from './components/Budget/BudgetPlanner'
import PomodoroTimer from './components/Pomodoro/PomodoroTimer'
import Dashboard from './components/Dashboard/Dashboard'
import DistractionTracker from './components/Analytics/DistractionTracker'
import StreakWidget from './components/Analytics/StreakWidget'
import RestorationBreak from './components/Breaks/RestorationBreak'
import UATBanner from './components/UATBanner'

type Tab = 'dashboard' | 'budget' | 'pomodoro' | 'analytics'

const tabs = [
  { id: 'dashboard'  as Tab, label: 'Dashboard', icon: LayoutDashboard },
  { id: 'budget'     as Tab, label: 'Planner',   icon: Target },
  { id: 'pomodoro'   as Tab, label: 'Timer',     icon: Timer },
  { id: 'analytics'  as Tab, label: 'Analytics', icon: BarChart2 },
]

export default function App() {
  const { user, loading, signOut } = useAuth()
  const [activeTab, setActiveTab] = useState<Tab>('dashboard')
  const [menuOpen, setMenuOpen] = useState(false)
  const [showBreak, setShowBreak] = useState(false)
  const [pomodoroRunning, setPomodoroRunning] = useState(false)

  const today      = new Date().toISOString().split('T')[0]
  const todayLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'short', day: 'numeric',
  })

  // Auto-track tab switches as distractions during focus sessions
  useDistraction(user?.id, pomodoroRunning)

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
            {/* Restoration break button — always accessible */}
            <button
              onClick={() => setShowBreak(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-900/30 hover:bg-emerald-900/50 border border-emerald-800/40 text-emerald-400 text-xs rounded-lg transition-colors"
            >
              <Leaf className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Break</span>
            </button>

            <button
              onClick={() => signOut()}
              className="hidden sm:flex items-center gap-1.5 text-gray-500 hover:text-gray-300 text-xs transition-colors px-2 py-1 rounded-lg hover:bg-gray-800"
            >
              <LogOut className="w-3.5 h-3.5" /> Sign Out
            </button>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="sm:hidden p-1.5 text-gray-500 hover:text-gray-300"
            >
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="sm:hidden border-t border-gray-800 bg-gray-900 px-4 py-3 space-y-2">
            <button
              onClick={() => { setShowBreak(true); setMenuOpen(false) }}
              className="flex items-center gap-2 text-emerald-400 text-sm"
            >
              <Leaf className="w-4 h-4" /> Take a Break
            </button>
            <button
              onClick={() => { signOut(); setMenuOpen(false) }}
              className="flex items-center gap-2 text-gray-400 text-sm"
            >
              <LogOut className="w-4 h-4" /> Sign Out
            </button>
          </div>
        )}
      </header>

      {/* Tab bar */}
      <nav className="border-b border-gray-800 bg-gray-950 sticky top-[57px] z-40">
        <div className="max-w-2xl mx-auto px-4 flex gap-1">
          {tabs.map(tab => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3 py-3 text-sm border-b-2 transition-all font-medium ${
                  activeTab === tab.id
                    ? 'border-indigo-500 text-white'
                    : 'border-transparent text-gray-500 hover:text-gray-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{tab.label}</span>
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
              <h2 className="text-xl font-bold text-white">Dashboard</h2>
              <p className="text-gray-500 text-sm mt-0.5">Your attention overview for today</p>
            </div>
            <StreakWidget userId={user.id} />
            <div className="mt-4">
              <Dashboard userId={user.id} />
            </div>
          </>
        )}
        {activeTab === 'budget' && (
          <>
            <div className="mb-5">
              <h2 className="text-xl font-bold text-white">Attention Planner</h2>
              <p className="text-gray-500 text-sm mt-0.5">{todayLabel} — Allocate your focus hours</p>
            </div>
            <BudgetPlanner userId={user.id} date={today} />
          </>
        )}
        {activeTab === 'pomodoro' && (
          <>
            <div className="mb-5 text-center">
              <h2 className="text-xl font-bold text-white">Focus Timer</h2>
              <p className="text-gray-500 text-sm mt-0.5">25-5 Pomodoro with distraction logging</p>
            </div>
            <PomodoroTimer
              userId={user.id}
              onRunningChange={setPomodoroRunning}
            />
          </>
        )}
        {activeTab === 'analytics' && (
          <>
            <div className="mb-5">
              <h2 className="text-xl font-bold text-white">Analytics</h2>
              <p className="text-gray-500 text-sm mt-0.5">Distraction patterns this week</p>
            </div>
            <DistractionTracker userId={user.id} />
          </>
        )}
      </main>

      {/* Restoration break modal */}
      {showBreak && user && (
        <RestorationBreak
          userId={user.id}
          onClose={() => setShowBreak(false)}
        />
      )}
    </div>
  )
}
