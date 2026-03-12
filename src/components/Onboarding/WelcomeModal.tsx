import { useState } from 'react'
import { Brain, Target, Timer, Dumbbell, Flame, ArrowRight, X, CheckCircle } from 'lucide-react'

interface Props {
  onDone: () => void
}

const STEPS = [
  {
    icon: Brain,
    color: '#6366f1',
    title: 'Welcome to AttentionOS',
    subtitle: 'Your personal operating system for focus, mastery, and relentless self-improvement.',
    body: 'Most people lose 3-4 hours a day to distraction without realising it. AttentionOS helps you take that time back — and invest it into becoming someone your haters will lose sleep over.',
    cta: 'Show me how',
  },
  {
    icon: Target,
    color: '#10b981',
    title: 'Step 1 — Plan your day',
    subtitle: 'Start every morning in the Planner tab.',
    body: 'Decide in advance how many hours you want to spend on Deep Work, Learning, Exercise, and so on. This is your "attention budget" — like a financial budget, but for your time and focus. Takes 2 minutes.',
    cta: 'Got it',
  },
  {
    icon: Timer,
    color: '#f59e0b',
    title: 'Step 2 — Work in focused blocks',
    subtitle: 'Use the Timer tab when it\'s time to work.',
    body: 'The Pomodoro method: 25 minutes of deep focus, then a 5-minute break. Every time you get distracted — phone, tab switch, anything — tap the ⚠️ button. Awareness is the first step to fixing it. Hit the 🌿 Break button for a science-backed rest.',
    cta: 'Understood',
  },
  {
    icon: Dumbbell,
    color: '#ec4899',
    title: 'Step 3 — Track your mastery',
    subtitle: 'Log every practice session in the Practice tab.',
    body: 'Add the skills you\'re building — coding, writing, a language, anything. Log each session with duration, difficulty, and quality. Watch the hours compound. Milestones unlock at 10h, 25h, 50h, 100h and beyond. The people who want you to fail are watching.',
    cta: 'Let\'s go',
  },
]

export default function WelcomeModal({ onDone }: Props) {
  const [step, setStep] = useState(0)
  const current = STEPS[step]
  const Icon = current.icon
  const isLast = step === STEPS.length - 1

  const advance = () => {
    if (isLast) { onDone() } else { setStep(s => s + 1) }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm px-4 pb-6 sm:pb-0">
      <div className="w-full max-w-sm bg-gray-900 border border-gray-800 rounded-3xl overflow-hidden shadow-2xl">

        {/* Progress dots */}
        <div className="flex justify-between items-center px-5 pt-5">
          <div className="flex gap-1.5">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className="h-1.5 rounded-full transition-all duration-300"
                style={{
                  width: i === step ? '20px' : '6px',
                  backgroundColor: i <= step ? current.color : '#374151',
                }}
              />
            ))}
          </div>
          <button
            onClick={onDone}
            className="p-1.5 text-gray-600 hover:text-gray-400 rounded-lg hover:bg-gray-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Icon */}
        <div className="px-6 pt-6 pb-2 flex justify-center">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg"
            style={{ backgroundColor: current.color + '22', border: `1.5px solid ${current.color}44` }}
          >
            <Icon className="w-8 h-8" style={{ color: current.color }} />
          </div>
        </div>

        {/* Text */}
        <div className="px-6 pt-4 pb-6 text-center space-y-2">
          <h2 className="text-white font-bold text-xl leading-tight">{current.title}</h2>
          <p className="text-sm font-medium" style={{ color: current.color }}>{current.subtitle}</p>
          <p className="text-gray-400 text-sm leading-relaxed pt-1">{current.body}</p>
        </div>

        {/* CTA */}
        <div className="px-6 pb-6">
          <button
            onClick={advance}
            className="w-full py-3.5 rounded-2xl font-semibold text-white flex items-center justify-center gap-2 transition-all active:scale-95"
            style={{ backgroundColor: current.color }}
          >
            {isLast ? <><CheckCircle className="w-4 h-4" /> Start using AttentionOS</> : <>{current.cta} <ArrowRight className="w-4 h-4" /></>}
          </button>
        </div>
      </div>
    </div>
  )
}
