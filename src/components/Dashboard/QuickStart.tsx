import { Target, Timer, Dumbbell, ChevronRight, Flame } from 'lucide-react'

interface Props {
  onNavigate: (tab: string) => void
  hasBudget: boolean
  hasSessions: boolean
  hasSkills: boolean
}

export default function QuickStart({ onNavigate, hasBudget, hasSessions, hasSkills }: Props) {
  const steps = [
    {
      icon: Target,
      color: '#10b981',
      bg: 'from-emerald-950/50 to-teal-950/40 border-emerald-800/30',
      tab: 'budget',
      title: 'Plan your day',
      desc: 'Allocate your focus hours across categories',
      done: hasBudget,
      doneText: 'Day planned ✓',
    },
    {
      icon: Timer,
      color: '#6366f1',
      bg: 'from-indigo-950/50 to-purple-950/40 border-indigo-800/30',
      tab: 'pomodoro',
      title: 'Start a focus session',
      desc: '25-min Pomodoro — track every distraction',
      done: hasSessions,
      doneText: 'Session logged ✓',
    },
    {
      icon: Dumbbell,
      color: '#ec4899',
      bg: 'from-pink-950/50 to-rose-950/40 border-pink-800/30',
      tab: 'practice',
      title: 'Log a practice rep',
      desc: 'Track deliberate practice on your skills',
      done: hasSkills,
      doneText: 'Practice logged ✓',
    },
  ]

  const allDone = steps.every(s => s.done)

  if (allDone) {
    return (
      <div className="bg-gradient-to-br from-orange-950/40 to-red-950/30 border border-orange-800/30 rounded-2xl p-4 flex items-center gap-3">
        <Flame className="w-6 h-6 text-orange-400 flex-shrink-0" />
        <div>
          <p className="text-white font-semibold text-sm">Daily game plan complete 🔥</p>
          <p className="text-gray-400 text-xs mt-0.5">You planned, focused, and practiced. The people who want you to fail had a bad day.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
      <p className="text-white font-semibold text-sm mb-1">Today's game plan</p>
      <p className="text-gray-500 text-xs mb-3">3 things to do every day to make progress:</p>
      <div className="space-y-2">
        {steps.map((step) => {
          const Icon = step.icon
          return (
            <button
              key={step.tab}
              onClick={() => !step.done && onNavigate(step.tab)}
              disabled={step.done}
              className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left ${
                step.done
                  ? 'bg-gray-800/40 opacity-60 cursor-default'
                  : `bg-gradient-to-r ${step.bg} border hover:opacity-90 active:scale-[0.98]`
              }`}
            >
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: step.done ? '#374151' : step.color + '22' }}
              >
                <Icon className="w-4 h-4" style={{ color: step.done ? '#6b7280' : step.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${ step.done ? 'text-gray-500 line-through' : 'text-white' }`}>
                  {step.done ? step.doneText : step.title}
                </p>
                {!step.done && <p className="text-xs text-gray-500 mt-0.5 truncate">{step.desc}</p>}
              </div>
              {!step.done && <ChevronRight className="w-4 h-4 text-gray-600 flex-shrink-0" />}
            </button>
          )
        })}
      </div>
    </div>
  )
}
