import { useState, useEffect } from 'react'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid,
} from 'recharts'
import { TrendingUp, Target, Zap, Download } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { AttentionBudget, PomodoroSession, CATEGORY_COLORS } from '../../types'

interface Props {
  userId: string
}

const TOOLTIP_STYLE = {
  backgroundColor: '#1f2937',
  border: '1px solid #374151',
  borderRadius: '12px',
  color: '#f9fafb',
  fontSize: '12px',
}

export default function Dashboard({ userId }: Props) {
  const [budgets, setBudgets] = useState<AttentionBudget[]>([])
  const [sessions, setSessions] = useState<PomodoroSession[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      const today = new Date().toISOString().split('T')[0]
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString()

      const [{ data: b }, { data: s }] = await Promise.all([
        supabase.from('attention_budgets').select('*').eq('user_id', userId).eq('date', today),
        supabase
          .from('pomodoro_sessions')
          .select('*')
          .eq('user_id', userId)
          .gte('started_at', weekAgo)
          .in('status', ['completed', 'active']),
      ])
      setBudgets(b ?? [])
      setSessions(s ?? [])
      setLoading(false)
    }
    fetchData()
  }, [userId])

  // Pie
  const pieData = budgets.map(b => ({ name: b.category, value: b.hours_allocated, color: b.color }))

  // Weekly line chart
  const weeklyData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.now() - (6 - i) * 86400000)
    const dateStr = d.toISOString().split('T')[0]
    const daySessions = sessions.filter(
      s => s.started_at.startsWith(dateStr) && s.status === 'completed'
    )
    return {
      day: d.toLocaleDateString('en-US', { weekday: 'short' }),
      focusHours: parseFloat((daySessions.reduce((sum, s) => sum + s.completed_cycles * 25, 0) / 60).toFixed(1)),
      distractions: daySessions.reduce((sum, s) => sum + s.distractions_count, 0),
    }
  })

  // Today's stats
  const today = new Date().toISOString().split('T')[0]
  const todaySessions = sessions.filter(
    s => s.started_at.startsWith(today) && s.status === 'completed'
  )
  const focusMinutes = todaySessions.reduce((sum, s) => sum + s.completed_cycles * 25, 0)
  const totalDistractions = todaySessions.reduce((sum, s) => sum + s.distractions_count, 0)
  const completedCycles = todaySessions.reduce((sum, s) => sum + s.completed_cycles, 0)

  // Focus score: penalise by distractions
  const focusScore = focusMinutes > 0
    ? Math.max(0, Math.round(100 - (totalDistractions / Math.max(completedCycles, 1)) * 20))
    : 0
  const scoreColor = focusScore >= 80 ? 'text-green-400' : focusScore >= 50 ? 'text-yellow-400' : 'text-red-400'

  const exportCSV = () => {
    const rows = [
      ['Date', 'Category', 'Hours Allocated', 'Hours Used'],
      ...budgets.map(b => [b.date, b.category, b.hours_allocated, b.hours_used]),
    ]
    const csv = rows.map(r => r.join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `attention-budget-${today}.csv`
    a.click()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-60">
        <div className="w-6 h-6 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Focus Score Hero */}
      <div className="bg-gradient-to-br from-indigo-950/60 to-purple-950/60 rounded-2xl p-5 border border-indigo-900/40">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-gray-400 text-sm">Today's Focus Score</p>
            <div className="flex items-end gap-2 mt-1">
              <span className={`text-6xl font-bold tabular-nums ${scoreColor}`}>{focusScore}</span>
              <span className="text-gray-500 text-2xl mb-2">/100</span>
            </div>
            <div className="flex gap-4 mt-3">
              {[
                { icon: Target, label: `${completedCycles} cycles`, color: 'text-indigo-400' },
                { icon: Zap, label: `${focusMinutes}m focused`, color: 'text-green-400' },
                { icon: TrendingUp, label: `${totalDistractions} distractions`, color: 'text-yellow-400' },
              ].map(({ icon: Icon, label, color }) => (
                <div key={label} className={`flex items-center gap-1.5 text-xs ${color}`}>
                  <Icon className="w-3 h-3" />
                  {label}
                </div>
              ))}
            </div>
          </div>
          <button
            onClick={exportCSV}
            className="flex items-center gap-1.5 text-gray-500 hover:text-gray-300 text-xs transition-colors bg-gray-800/50 px-3 py-2 rounded-lg"
          >
            <Download className="w-3.5 h-3.5" /> Export
          </button>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Budget Pie */}
        <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800">
          <h4 className="text-gray-300 text-sm font-medium mb-1">Today's Allocation</h4>
          {pieData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%" cy="50%"
                    innerRadius={52} outerRadius={76}
                    dataKey="value"
                    paddingAngle={3}
                  >
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v: number) => [`${v}h`, '']}
                    contentStyle={TOOLTIP_STYLE}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-x-3 gap-y-1 justify-center">
                {pieData.map(d => (
                  <div key={d.name} className="flex items-center gap-1 text-xs text-gray-400">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                    {d.name}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-44 flex items-center justify-center text-gray-600 text-sm">
              Plan your budget in the Planner tab
            </div>
          )}
        </div>

        {/* Weekly line */}
        <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800">
          <h4 className="text-gray-300 text-sm font-medium mb-3">Weekly Focus Hours</h4>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={weeklyData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="day" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Line
                type="monotone" dataKey="focusHours"
                stroke="#6366f1" strokeWidth={2.5}
                dot={{ fill: '#6366f1', r: 4 }}
                activeDot={{ r: 6 }}
                name="Focus hrs"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Streak / tips */}
      {focusScore === 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 text-center">
          <p className="text-gray-400 text-sm">Start a Pomodoro session to see your daily focus score here 🎯</p>
        </div>
      )}
    </div>
  )
}
