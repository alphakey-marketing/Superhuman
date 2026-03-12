import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { AlertTriangle, TrendingDown, Eye } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { DistractionEvent } from '../../types'

interface Props {
  userId: string
}

const TOOLTIP_STYLE = {
  backgroundColor: '#0f172a',
  border: '1px solid #6366f1',
  borderRadius: '10px',
  color: '#f1f5f9',
  fontSize: '12px',
  fontWeight: '600',
}

export default function DistractionTracker({ userId }: Props) {
  const [events, setEvents] = useState<DistractionEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetch = async () => {
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString()
      const { data } = await supabase
        .from('distraction_events')
        .select('*')
        .eq('user_id', userId)
        .gte('occurred_at', weekAgo)
        .order('occurred_at', { ascending: false })
      setEvents(data ?? [])
      setLoading(false)
    }
    fetch()

    // Realtime subscription for live updates
    const sub = supabase
      .channel('distraction_events')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'distraction_events',
        filter: `user_id=eq.${userId}`,
      }, payload => {
        setEvents(prev => [payload.new as DistractionEvent, ...prev])
      })
      .subscribe()

    return () => { supabase.removeChannel(sub) }
  }, [userId])

  // Weekly bar chart data
  const weeklyData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.now() - (6 - i) * 86400000)
    const dateStr = d.toISOString().split('T')[0]
    return {
      day: d.toLocaleDateString('en-US', { weekday: 'short' }),
      count: events.filter(e => e.occurred_at.startsWith(dateStr)).length,
    }
  })

  const today = new Date().toISOString().split('T')[0]
  const todayCount = events.filter(e => e.occurred_at.startsWith(today)).length
  const weekTotal = events.length
  const avgPerDay = weekTotal > 0 ? (weekTotal / 7).toFixed(1) : '0'
  const worstDay = weeklyData.reduce((max, d) => d.count > max.count ? d : max, { day: '-', count: 0 })

  const getRiskLevel = (count: number) => {
    if (count === 0) return { label: 'Clean', color: 'text-green-400', bg: 'bg-green-900/20 border-green-800/40' }
    if (count <= 3) return { label: 'Low', color: 'text-yellow-400', bg: 'bg-yellow-900/20 border-yellow-800/40' }
    if (count <= 7) return { label: 'Medium', color: 'text-orange-400', bg: 'bg-orange-900/20 border-orange-800/40' }
    return { label: 'High', color: 'text-red-400', bg: 'bg-red-900/20 border-red-800/40' }
  }

  const risk = getRiskLevel(todayCount)

  if (loading) return (
    <div className="flex items-center justify-center h-40">
      <div className="w-5 h-5 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="space-y-4">
      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <div className={`rounded-xl p-3.5 text-center border ${risk.bg}`}>
          <p className={`text-2xl font-bold ${risk.color}`}>{todayCount}</p>
          <p className="text-gray-500 text-xs mt-0.5">Today</p>
          <p className={`text-xs font-medium mt-1 ${risk.color}`}>{risk.label} risk</p>
        </div>
        <div className="bg-gray-800 rounded-xl p-3.5 text-center">
          <p className="text-2xl font-bold text-orange-400">{avgPerDay}</p>
          <p className="text-gray-500 text-xs mt-0.5">Avg/day</p>
        </div>
        <div className="bg-gray-800 rounded-xl p-3.5 text-center">
          <p className="text-2xl font-bold text-red-400">{worstDay.day}</p>
          <p className="text-gray-500 text-xs mt-0.5">Worst day</p>
          <p className="text-gray-600 text-xs">{worstDay.count} events</p>
        </div>
      </div>

      {/* Bar chart */}
      <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="w-4 h-4 text-yellow-400" />
          <h4 className="text-gray-300 text-sm font-medium">Weekly Distraction Events</h4>
        </div>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={weeklyData} margin={{ top: 0, right: 5, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
            <XAxis dataKey="day" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              formatter={(v: number) => [v, 'Distractions']}
              cursor={{ fill: '#ffffff08' }}
            />
            <Bar dataKey="count" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Distractions" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Tips */}
      <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800 space-y-3">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-indigo-400" />
          <h4 className="text-gray-300 text-sm font-medium">Awareness Insights</h4>
        </div>
        <div className="space-y-2">
          {todayCount === 0 && (
            <p className="text-green-400 text-sm">🏆 Zero distractions today — exceptional focus!</p>
          )}
          {todayCount > 0 && todayCount <= 3 && (
            <p className="text-yellow-300/80 text-sm">⚡ {todayCount} distraction{todayCount > 1 ? 's' : ''} today. Each costs ~23min to regain deep focus. Keep going!</p>
          )}
          {todayCount > 3 && (
            <p className="text-orange-300/80 text-sm">🔥 {todayCount} distractions today. Consider a restoration break to reset your attention.</p>
          )}
          {weekTotal > 10 && (
            <div className="flex items-start gap-2 bg-blue-900/20 border border-blue-800/30 rounded-xl p-3">
              <TrendingDown className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
              <p className="text-blue-300/80 text-xs">
                {weekTotal} tab switches this week. Short-form scrolling trains your brain to expect novelty every few seconds. A daily digital detox break can reverse this.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
