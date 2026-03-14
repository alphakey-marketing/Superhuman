import { Flame, Trophy, Calendar } from 'lucide-react'
import { useStreaks } from '../../hooks/useStreaks'

interface Props {
  userId: string
  today: string
}

export default function StreakWidget({ userId, today }: Props) {
  const { current, longest, lastActiveDate } = useStreaks(userId, today)

  const getFlameColor = () => {
    if (current >= 7) return 'text-orange-400'
    if (current >= 3) return 'text-yellow-400'
    if (current >= 1) return 'text-amber-500'
    return 'text-gray-600'
  }

  const getStreakMessage = () => {
    if (current === 0) return 'Start today to build your streak!'
    if (current === 1) return 'Day 1 — keep it going tomorrow!'
    if (current < 3) return `${current} days — building momentum!`
    if (current < 7) return `${current} days — great consistency!`
    if (current < 14) return `${current} days — you're on fire! 🔥`
    return `${current} days — legendary focus! 🏆`
  }

  return (
    <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800">
      <div className="flex items-center gap-2 mb-4">
        <Flame className="w-4 h-4 text-orange-400" />
        <h4 className="text-gray-300 text-sm font-medium">Focus Streak</h4>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-gray-800 rounded-xl p-3.5 text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Flame className={`w-5 h-5 ${getFlameColor()}`} />
          </div>
          <p className={`text-3xl font-bold tabular-nums ${getFlameColor()}`}>{current}</p>
          <p className="text-gray-500 text-xs mt-0.5">day streak</p>
        </div>

        <div className="bg-gray-800 rounded-xl p-3.5 text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Trophy className="w-5 h-5 text-yellow-400" />
          </div>
          <p className="text-3xl font-bold text-yellow-400 tabular-nums">{longest}</p>
          <p className="text-gray-500 text-xs mt-0.5">best streak</p>
        </div>
      </div>

      <p className="text-gray-400 text-xs text-center">{getStreakMessage()}</p>

      {lastActiveDate && (
        <div className="flex items-center justify-center gap-1.5 mt-2">
          <Calendar className="w-3 h-3 text-gray-600" />
          <p className="text-gray-600 text-xs">
            Last active: {new Date(lastActiveDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </p>
        </div>
      )}
    </div>
  )
}
