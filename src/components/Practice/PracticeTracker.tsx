import { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, ChevronDown, ChevronUp, Zap, AlertCircle, BookOpen, Target, Calendar } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { PracticeSkill, PracticeSubSkill, PracticeSession, SKILL_COLORS } from '../../types'
import { toLocalDateStr } from '../../lib/date'

interface Props { userId: string }

const SKILL_CATEGORIES = ['Coding', 'Writing', 'Music', 'Sport', 'Language', 'Business', 'Art', 'Other']
const MILESTONES = [10, 25, 50, 100, 200, 500, 1000]

const TEMPLATE_SKILLS: { name: string; category: string; color: string; target_hours: number; subSkills: string[] }[] = [
  { name: 'Japanese',  category: 'Language', color: '#ef4444', target_hours: 1000,
    subSkills: ['Hiragana & Katakana', 'Kanji', 'Grammar', 'Listening', 'Speaking', 'Reading'] },
  { name: 'Badminton', category: 'Sport',    color: '#10b981', target_hours: 200,
    subSkills: ['Footwork', 'Serve', 'Smash', 'Drop Shot', 'Net Play', 'Fitness'] },
  { name: 'Singing',   category: 'Music',    color: '#f59e0b', target_hours: 500,
    subSkills: ['Breathing', 'Pitch & Tone', 'Vocal Warm-ups', 'Repertoire', 'Performance', 'Ear Training'] },
]

function getMilestone(hours: number) {
  const reached = MILESTONES.filter(m => hours >= m)
  const next = MILESTONES.find(m => hours < m) ?? null
  return { reached: reached[reached.length - 1] ?? 0, next }
}

/** Returns the ISO week Monday date (YYYY-MM-DD) for a given date string */
function getWeekStart(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const day = d.getDay() // 0=Sun
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return toLocalDateStr(d)
}

function getWeekEnd(weekStart: string): string {
  const d = new Date(weekStart + 'T00:00:00')
  d.setDate(d.getDate() + 6)
  return toLocalDateStr(d)
}

/** 30-day heatmap — dots per day, colored by session minutes for the skill */
function ActivityHeatmap({ sessions, color }: { sessions: PracticeSession[]; color: string }) {
  const days: { date: string; minutes: number }[] = []
  for (let i = 29; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const dateStr = toLocalDateStr(d)
    const minutes = sessions.filter(s => s.date === dateStr).reduce((sum, s) => sum + s.duration_minutes, 0)
    days.push({ date: dateStr, minutes })
  }

  return (
    <div>
      <p className="text-gray-600 text-[10px] mb-1.5 px-0.5">Last 30 days</p>
      <div className="flex gap-1 flex-wrap">
        {days.map(({ date, minutes }) => {
          let opacity = 0
          if (minutes > 0 && minutes < 15) opacity = 0.3
          else if (minutes >= 15 && minutes < 45) opacity = 0.6
          else if (minutes >= 45) opacity = 1.0
          return (
            <div
              key={date}
              title={`${date}: ${minutes > 0 ? minutes + ' min' : 'no session'}`}
              className="w-3.5 h-3.5 rounded-sm transition-colors"
              style={{
                backgroundColor: minutes > 0
                  ? color + Math.round(opacity * 255).toString(16).padStart(2, '0')
                  : 'rgb(31,41,55)',
              }}
            />
          )
        })}
      </div>
    </div>
  )
}

/** Weekly sprint mini-card per skill */
function WeeklySprintCard({ skill, sessions }: { skill: PracticeSkill; sessions: PracticeSession[] }) {
  const today = toLocalDateStr()
  const weekStart = getWeekStart(today)
  const weekEnd = getWeekEnd(weekStart)

  const weekMins = sessions
    .filter(s => s.skill_id === skill.id && s.date >= weekStart && s.date <= weekEnd)
    .reduce((sum, s) => sum + s.duration_minutes, 0)
  const weekHours = weekMins / 60
  const weekGoal = skill.weekly_goal_hours ?? 3

  // 7-dot streak: last 7 days (today is day 0)
  const last7: boolean[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const dateStr = toLocalDateStr(d)
    last7.push(sessions.some(s => s.skill_id === skill.id && s.date === dateStr))
  }

  const pct = Math.min((weekHours / weekGoal) * 100, 100)

  return (
    <div className="mt-3 bg-gray-800/50 rounded-xl px-3 py-2.5 border border-gray-700/50">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-gray-300 text-xs font-medium">Weekly Sprint</span>
        <span className="text-gray-500 text-[10px]">
          {weekHours.toFixed(1)}h / {weekGoal}h goal
        </span>
      </div>
      {/* Progress bar */}
      <div className="h-1.5 bg-gray-700 rounded-full mb-2 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, backgroundColor: skill.color }}
        />
      </div>
      {/* 7-dot streak */}
      <div className="flex items-center gap-1">
        {last7.map((active, i) => (
          <div
            key={i}
            className="w-2.5 h-2.5 rounded-full transition-colors"
            style={{ backgroundColor: active ? skill.color : '#374151' }}
          />
        ))}
        <span className="text-gray-600 text-[10px] ml-1">7d</span>
      </div>
    </div>
  )
}

/** Today's Queue — shows the sub-skill with the oldest last_practiced_at per skill */
function TodayQueue({
  skills, subSkills, sessions, onQuickLog
}: {
  skills: PracticeSkill[]
  subSkills: PracticeSubSkill[]
  sessions: PracticeSession[]
  onQuickLog: (skillId: string, subSkillId: string | null, mins: number) => void
}) {
  const today = toLocalDateStr()
  const now = Date.now()

  // For each skill, find the sub-skill with the oldest last practice date
  const queue: { skill: PracticeSkill; subSkill: PracticeSubSkill | null; daysSince: number; lastDate: string | null }[] = []

  for (const skill of skills) {
    const skillSubs = subSkills.filter(s => s.skill_id === skill.id)
    if (skillSubs.length === 0) continue

    let oldestSubSkill: PracticeSubSkill | null = null
    let oldestDate: string | null = null
    let oldestMs = Infinity

    for (const sub of skillSubs) {
      const lastSession = sessions
        .filter(s => s.skill_id === skill.id && s.sub_skill_id === sub.id)
        .sort((a, b) => b.date.localeCompare(a.date))[0]
      const lastMs = lastSession ? new Date(lastSession.date + 'T00:00:00').getTime() : 0
      if (lastMs < oldestMs) {
        oldestMs = lastMs
        oldestSubSkill = sub
        oldestDate = lastSession?.date ?? null
      }
    }

    if (oldestSubSkill) {
      const daysSince = oldestDate
        ? Math.floor((now - new Date(oldestDate + 'T00:00:00').getTime()) / (1000 * 60 * 60 * 24))
        : Infinity
      // Only show if not practiced today
      const confirmedSubSkill = oldestSubSkill // const lets TS narrow safely inside closure
      const practicedToday = sessions.some(
        s => s.skill_id === skill.id && s.sub_skill_id === confirmedSubSkill.id && s.date === today
      )
      if (!practicedToday) {
        queue.push({ skill, subSkill: oldestSubSkill, daysSince, lastDate: oldestDate })
      }
    }
  }

  // Check if all sub-skills across all skills were practiced today
  const allSubSkills = subSkills.filter(s => skills.some(sk => sk.id === s.skill_id))
  const allCaughtUp = allSubSkills.length > 0 && allSubSkills.every(sub =>
    sessions.some(s => s.sub_skill_id === sub.id && s.date === today)
  )

  if (allSubSkills.length === 0) return null

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-800 flex items-center gap-2">
        <Target className="w-4 h-4 text-indigo-400 flex-shrink-0" />
        <p className="text-white text-sm font-semibold">Today's Queue</p>
      </div>

      {allCaughtUp ? (
        <div className="px-4 py-4 flex items-center gap-2">
          <span className="text-xl">✅</span>
          <p className="text-green-300 text-sm font-medium">All caught up today!</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-800">
          {queue.slice(0, 5).map(({ skill, subSkill, daysSince }) => (
            <div key={`${skill.id}-${subSkill?.id}`} className="px-4 py-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: skill.color }} />
                    <span className="text-gray-400 text-[11px]">{skill.name}</span>
                  </div>
                  <p className="text-white text-sm font-medium truncate">{subSkill?.name}</p>
                  <p className="text-gray-500 text-xs mt-0.5">
                    {daysSince === Infinity
                      ? 'Never practiced'
                      : daysSince === 0
                        ? 'Last practiced earlier today'
                        : `Last practiced ${daysSince} day${daysSince !== 1 ? 's' : ''} ago`}
                  </p>
                </div>
                <div className="flex gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => onQuickLog(skill.id, subSkill?.id ?? null, 15)}
                    className="text-xs px-2.5 py-1.5 bg-indigo-900/50 hover:bg-indigo-800/60 border border-indigo-700/50 text-indigo-300 rounded-lg transition-colors"
                  >15 min</button>
                  <button
                    onClick={() => onQuickLog(skill.id, subSkill?.id ?? null, 30)}
                    className="text-xs px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors"
                  >30 min</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function PracticeTracker({ userId }: Props) {
  const [skills,    setSkills]    = useState<PracticeSkill[]>([])
  const [subSkills, setSubSkills] = useState<PracticeSubSkill[]>([])
  const [sessions,  setSessions]  = useState<PracticeSession[]>([])
  const [loading,   setLoading]   = useState(true)
  const [expandedSkill,  setExpandedSkill]  = useState<string | null>(null)
  const [showAddSkill,   setShowAddSkill]   = useState(false)
  const [showLogSession, setShowLogSession] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showAllSessionsFor, setShowAllSessionsFor] = useState<string | null>(null)
  const [confirmDeleteSkill, setConfirmDeleteSkill] = useState<string | null>(null)

  // Add skill form
  const [newSkillName,       setNewSkillName]       = useState('')
  const [newSkillCategory,   setNewSkillCategory]   = useState('Coding')
  const [newSkillTarget,     setNewSkillTarget]     = useState(100)
  const [newSkillWeeklyGoal, setNewSkillWeeklyGoal] = useState(3)
  const [newSkillColor,      setNewSkillColor]      = useState(SKILL_COLORS[0])

  // Sub-skill management
  const [addingSubSkillFor, setAddingSubSkillFor] = useState<string | null>(null)
  const [newSubSkillName,   setNewSubSkillName]   = useState('')

  // Log session form
  const [sessionMins,         setSessionMins]         = useState(30)
  const [sessionTargetWeakness, setSessionTargetWeakness] = useState('')
  const [sessionNextIntention, setSessionNextIntention] = useState('')
  const [sessionNotes,        setSessionNotes]        = useState('')
  const [sessionSubSkillId,   setSessionSubSkillId]   = useState<string | null>(null)
  // Last next_intention reminder per sub-skill (fetched when sub-skill selected)
  const [lastNextIntention,   setLastNextIntention]   = useState<string | null>(null)

  useEffect(() => { loadData() }, [userId])

  const loadData = async () => {
    const [{ data: sk, error: skErr }, { data: sub, error: subErr }, { data: se, error: seErr }] = await Promise.all([
      supabase.from('practice_skills').select('*').eq('user_id', userId).order('created_at'),
      supabase.from('practice_sub_skills').select('*').eq('user_id', userId).order('created_at'),
      supabase.from('practice_sessions').select('*').eq('user_id', userId).order('date', { ascending: false }),
    ])
    if (skErr)  { setError(`Failed to load skills: ${skErr.message}`);    setLoading(false); return }
    if (subErr) { setError(`Failed to load sub-skills: ${subErr.message}`); setLoading(false); return }
    if (seErr)  { setError(`Failed to load sessions: ${seErr.message}`);   setLoading(false); return }

    const loadedSkills = sk ?? []
    setSubSkills(sub ?? [])
    setSessions(se ?? [])

    if (loadedSkills.length === 0 && (sub ?? []).length === 0) {
      const seeded = await seedTemplateSkills()
      setSkills(seeded)
    } else {
      setSkills(loadedSkills)
    }
    setLoading(false)
  }

  const seedTemplateSkills = async (): Promise<PracticeSkill[]> => {
    const rows = TEMPLATE_SKILLS.map(t => ({
      user_id: userId, name: t.name, category: t.category,
      color: t.color, target_hours: t.target_hours, total_hours: 0,
    }))
    const { data: seededSkills, error: seedErr } = await supabase
      .from('practice_skills').insert(rows).select()
    if (seedErr) {
      setError(`Could not seed template skills: ${seedErr.message} (code: ${seedErr.code})`)
      return []
    }
    if (seededSkills && seededSkills.length > 0) {
      const subRows: { user_id: string; skill_id: string; name: string }[] = []
      for (const s of seededSkills) {
        const tmpl = TEMPLATE_SKILLS.find(t => t.name === s.name)
        if (tmpl) tmpl.subSkills.forEach(n => subRows.push({ user_id: userId, skill_id: s.id, name: n }))
      }
      const { data: seededSubs, error: subSeedErr } = await supabase
        .from('practice_sub_skills').insert(subRows).select()
      if (subSeedErr) setError(`Skills created but sub-skills failed: ${subSeedErr.message}`)
      else setSubSkills(seededSubs ?? [])
    }
    return seededSkills ?? []
  }

  const addSkill = async () => {
    if (!newSkillName.trim()) return
    setError(null)
    const { data, error: err } = await supabase.from('practice_skills').insert({
      user_id: userId, name: newSkillName.trim(), category: newSkillCategory,
      color: newSkillColor, target_hours: newSkillTarget, total_hours: 0,
      weekly_goal_hours: newSkillWeeklyGoal,
    }).select().single()
    if (err)   { setError(`Could not add skill: ${err.message} (code: ${err.code})`); return }
    if (!data) { setError('Could not add skill: insert returned no data. Check RLS for practice_skills.'); return }
    setSkills(prev => [...prev, data])
    setNewSkillName('')
    setShowAddSkill(false)
  }

  const deleteSkill = async (id: string) => {
    if (confirmDeleteSkill !== id) {
      setConfirmDeleteSkill(id)
      return
    }
    setConfirmDeleteSkill(null)
    const { error: err } = await supabase.from('practice_skills').delete().eq('id', id)
    if (err) { setError(`Could not delete skill: ${err.message}`); return }
    setSkills(prev    => prev.filter(s => s.id !== id))
    setSubSkills(prev => prev.filter(s => s.skill_id !== id))
    setSessions(prev  => prev.filter(s => s.skill_id !== id))
  }

  const addSubSkill = async (skillId: string) => {
    if (!newSubSkillName.trim()) return
    setError(null)
    const { data, error: err } = await supabase.from('practice_sub_skills').insert({
      user_id: userId, skill_id: skillId, name: newSubSkillName.trim(),
    }).select().single()
    if (err)   { setError(`Could not add sub-skill: ${err.message} (code: ${err.code})`); return }
    if (!data) { setError('Could not add sub-skill: insert returned no data. Check RLS for practice_sub_skills.'); return }
    setSubSkills(prev => [...prev, data])
    setNewSubSkillName('')
    setAddingSubSkillFor(null)
  }

  const deleteSubSkill = async (id: string) => {
    const { error: err } = await supabase.from('practice_sub_skills').delete().eq('id', id)
    if (err) { setError(`Could not delete sub-skill: ${err.message}`); return }
    setSubSkills(prev => prev.filter(s => s.id !== id))
  }

  const resetLogForm = () => {
    setSessionSubSkillId(null)
    setSessionNotes('')
    setSessionMins(30)
    setSessionTargetWeakness('')
    setSessionNextIntention('')
    setLastNextIntention(null)
  }

  const openLogSession = (skillId: string, isLogging: boolean) => {
    setShowLogSession(isLogging ? null : skillId)
    resetLogForm()
  }

  // Fetch the most recent next_intention for a sub-skill when selected
  const handleSubSkillSelect = useCallback(async (subSkillId: string | null, skillId: string) => {
    setSessionSubSkillId(subSkillId)
    setLastNextIntention(null)
    if (!subSkillId) return
    const { data } = await supabase
      .from('practice_sessions')
      .select('next_intention')
      .eq('user_id', userId)
      .eq('skill_id', skillId)
      .eq('sub_skill_id', subSkillId)
      .not('next_intention', 'is', null)
      .order('date', { ascending: false })
      .limit(1)
      .single()
    if (data?.next_intention) setLastNextIntention(data.next_intention)
  }, [userId])

  const logSession = async (skillId: string, overrideMins?: number, overrideSubSkillId?: string | null) => {
    setError(null)
    const mins = overrideMins ?? sessionMins
    const subId = overrideSubSkillId !== undefined ? overrideSubSkillId : sessionSubSkillId
    const { data: sessionData, error: err } = await supabase.from('practice_sessions').insert({
      user_id: userId, skill_id: skillId,
      sub_skill_id: subId,
      date: toLocalDateStr(),
      duration_minutes: mins,
      difficulty: 3,
      quality: 3,
      notes: sessionNotes.trim() || null,
      target_weakness: sessionTargetWeakness.trim() || null,
      next_intention: sessionNextIntention.trim() || null,
    }).select().single()
    if (err)          { setError(`Could not log session: ${err.message} (code: ${err.code})`); return }
    if (!sessionData) { setError('Could not log session: insert returned no data. Check RLS for practice_sessions.'); return }
    setSessions(prev => [sessionData, ...prev])

    // Trust client-side calculation — no DB refetch needed, avoids trigger race conditions
    const allSessions = [sessionData, ...sessions.filter(s => s.skill_id === skillId)]
    const clientTotal = allSessions.reduce((sum, s) => sum + s.duration_minutes, 0) / 60
    setSkills(prev => prev.map(s => s.id === skillId ? { ...s, total_hours: clientTotal } : s))
    setShowLogSession(null)
    resetLogForm()
  }

  if (loading) return (
    <div className="flex items-center justify-center h-40">
      <div className="w-5 h-5 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="space-y-5">

      {error && (
        <div className="flex items-start gap-2.5 bg-red-950/60 border border-red-800/60 rounded-xl px-4 py-3">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-red-300 text-sm">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-300 text-xs">✕</button>
        </div>
      )}

      {/* Today's Queue */}
      {skills.length > 0 && (
        <TodayQueue
          skills={skills}
          subSkills={subSkills}
          sessions={sessions}
          onQuickLog={(skillId, subSkillId, mins) => logSession(skillId, mins, subSkillId)}
        />
      )}

      <div className="space-y-3">
        {skills.length === 0 && !showAddSkill && (
          <div className="text-center py-10 bg-gray-900 border border-gray-800 rounded-2xl">
            <p className="text-4xl mb-3">🎯</p>
            <p className="text-white font-medium">No skills yet</p>
            <p className="text-gray-500 text-sm mt-1 mb-4">Add your first skill to start tracking mastery</p>
            <button onClick={() => setShowAddSkill(true)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded-xl transition-colors">
              Add first skill
            </button>
          </div>
        )}

        {skills.map(skill => {
          const hours = Number(skill.total_hours)
          const pct   = Math.min((hours / skill.target_hours) * 100, 100)
          const { reached, next } = getMilestone(hours)
          const skillSessions  = sessions.filter(s => s.skill_id === skill.id)
          const skillSubSkills = subSkills.filter(s => s.skill_id === skill.id)
          const isExpanded  = expandedSkill  === skill.id
          const isLogging   = showLogSession === skill.id
          const isAddingSub = addingSubSkillFor === skill.id

          return (
            <div key={skill.id} className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">

              {/* ── Skill header ── */}
              <div className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-3 h-3 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: skill.color }} />
                  <div className="flex-1 min-w-0">

                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-white font-semibold">{skill.name}</p>
                        <p className="text-gray-500 text-xs">{skill.category}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400 text-sm font-mono">{hours.toFixed(1)}h</span>
                        <button onClick={() => openLogSession(skill.id, isLogging)}
                          className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs rounded-lg transition-colors flex items-center gap-1">
                          <Plus className="w-3 h-3" /> Log
                        </button>
                        <button onClick={() => setExpandedSkill(isExpanded ? null : skill.id)}
                          className="p-1.5 text-gray-600 hover:text-gray-400 rounded-lg hover:bg-gray-800 transition-colors">
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
                        <span>{pct.toFixed(0)}% to {skill.target_hours}h goal</span>
                        {next ? <span>Next milestone: {next}h</span> : <span className="text-yellow-400">🏆 Goal reached!</span>}
                      </div>
                      <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${pct}%`, backgroundColor: skill.color }} />
                      </div>
                    </div>

                    {/* Weekly sprint card */}
                    <WeeklySprintCard skill={skill} sessions={sessions} />

                    {/* Sub-skill chips */}
                    {skillSubSkills.length > 0 && (
                      <div className="flex gap-1.5 mt-3 flex-wrap">
                        {skillSubSkills.map(sub => (
                          <span key={sub.id}
                            className="group inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-gray-800 text-gray-300 border border-gray-700">
                            <BookOpen className="w-3 h-3 text-gray-500" />
                            {sub.name}
                            <button onClick={() => deleteSubSkill(sub.id)}
                              className="ml-0.5 text-gray-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                              title="Remove sub-skill">✕</button>
                          </span>
                        ))}
                        <button
                          onClick={() => { setAddingSubSkillFor(isAddingSub ? null : skill.id); setNewSubSkillName('') }}
                          className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border border-dashed border-gray-700 text-gray-600 hover:border-indigo-500 hover:text-indigo-400 transition-colors">
                          <Plus className="w-3 h-3" /> Add
                        </button>
                      </div>
                    )}

                    {/* Add sub-skill input */}
                    {isAddingSub && (
                      <div className="flex gap-2 mt-2">
                        <input autoFocus type="text" placeholder="Sub-skill name…"
                          value={newSubSkillName} onChange={e => setNewSubSkillName(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') addSubSkill(skill.id); if (e.key === 'Escape') { setAddingSubSkillFor(null); setNewSubSkillName('') } }}
                          className="flex-1 bg-gray-800 text-white text-xs px-3 py-1.5 rounded-lg border border-gray-700 focus:border-indigo-500 outline-none placeholder:text-gray-600" />
                        <button onClick={() => addSubSkill(skill.id)}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs rounded-lg transition-colors">Save</button>
                        <button onClick={() => { setAddingSubSkillFor(null); setNewSubSkillName('') }}
                          className="px-2 py-1.5 text-gray-500 border border-gray-700 text-xs rounded-lg hover:border-gray-500 transition-colors">✕</button>
                      </div>
                    )}

                    {skillSubSkills.length === 0 && !isAddingSub && (
                      <button onClick={() => { setAddingSubSkillFor(skill.id); setNewSubSkillName('') }}
                        className="mt-2 inline-flex items-center gap-1 text-xs text-gray-600 hover:text-indigo-400 transition-colors">
                        <Plus className="w-3 h-3" /> Add sub-skill
                      </button>
                    )}

                    {/* Milestone badges */}
                    {reached > 0 && (
                      <div className="flex gap-1.5 mt-2 flex-wrap">
                        {MILESTONES.filter(m => hours >= m).map(m => (
                          <span key={m} className="text-xs px-2 py-0.5 rounded-full bg-yellow-900/30 text-yellow-400 border border-yellow-800/40">
                            🏅 {m}h
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* ── Log session form ── */}
              {isLogging && (
                <div className="border-t border-gray-800 p-4 bg-gray-900/50 space-y-3">
                  <p className="text-gray-300 text-sm font-medium">Log a practice session</p>

                  {/* Sub-skill selector — only shown when sub-skills exist */}
                  {skillSubSkills.length > 0 && (
                    <div>
                      <label className="text-gray-500 text-xs mb-2 block">Focus area <span className="text-gray-600">(optional)</span></label>
                      <div className="flex gap-1.5 flex-wrap">
                        <button
                          onClick={() => handleSubSkillSelect(null, skill.id)}
                          className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                            sessionSubSkillId === null
                              ? 'bg-indigo-600 border-indigo-500 text-white'
                              : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500'
                          }`}>
                          General
                        </button>
                        {skillSubSkills.map(sub => (
                          <button
                            key={sub.id}
                            onClick={() => handleSubSkillSelect(
                              sub.id === sessionSubSkillId ? null : sub.id,
                              skill.id
                            )}
                            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                              sessionSubSkillId === sub.id
                                ? 'border-indigo-500 text-indigo-300 bg-indigo-900/40'
                                : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-300'
                            }`}>
                            {sub.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Last next_intention reminder banner */}
                  {lastNextIntention && (
                    <div className="flex items-start gap-2 bg-indigo-950/40 border border-indigo-800/40 rounded-xl px-3 py-2.5">
                      <Calendar className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0 mt-0.5" />
                      <p className="text-indigo-300 text-xs leading-relaxed">
                        Last time you said: <em>"{lastNextIntention}"</em>
                      </p>
                    </div>
                  )}

                  {/* Target weakness (deliberate practice focus — required) */}
                  <div>
                    <label className="text-indigo-300 text-xs mb-1 block font-medium">
                      🎯 What specific weakness are you targeting? <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. elbow position on smash, intonation on high notes…"
                      value={sessionTargetWeakness}
                      onChange={e => setSessionTargetWeakness(e.target.value)}
                      required
                      className="w-full bg-gray-800 text-white text-sm px-3 py-2 rounded-xl border border-indigo-800/50 focus:border-indigo-500 outline-none placeholder:text-gray-600"
                    />
                  </div>

                  {/* Duration */}
                  <div>
                    <label className="text-gray-500 text-xs mb-1 block">Duration (mins)</label>
                    <input type="number" min={1} max={480} value={sessionMins}
                      onChange={e => setSessionMins(Number(e.target.value))}
                      className="w-full bg-gray-800 text-white text-sm px-3 py-2 rounded-xl border border-gray-700 focus:border-indigo-500 outline-none" />
                  </div>

                  {/* Notes (optional) */}
                  <textarea placeholder="Notes: what did you work on? What clicked? (optional)"
                    value={sessionNotes} onChange={e => setSessionNotes(e.target.value)} rows={2}
                    className="w-full bg-gray-800 text-white text-sm px-3 py-2 rounded-xl border border-gray-700 focus:border-indigo-500 outline-none resize-none placeholder:text-gray-600" />

                  {/* Next intention */}
                  <div>
                    <label className="text-gray-400 text-xs mb-1 block">
                      <Zap className="w-3 h-3 inline mr-1 text-yellow-400" />
                      One thing to do differently next time?
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. focus on elbow position on smash, breathe deeper…"
                      value={sessionNextIntention}
                      onChange={e => setSessionNextIntention(e.target.value)}
                      className="w-full bg-gray-800 text-white text-sm px-3 py-2 rounded-xl border border-gray-700 focus:border-indigo-500 outline-none placeholder:text-gray-600"
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => logSession(skill.id)}
                      disabled={!sessionTargetWeakness.trim()}
                      className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm rounded-xl font-medium transition-colors"
                    >Save Session</button>
                    <button onClick={() => setShowLogSession(null)}
                      className="px-4 py-2.5 text-gray-500 border border-gray-700 text-sm rounded-xl hover:border-gray-500 transition-colors">Cancel</button>
                  </div>
                </div>
              )}

              {/* ── Session history ── */}
              {isExpanded && (
                <div className="border-t border-gray-800">
                  {/* 30-day heatmap */}
                  <div className="px-4 pt-3 pb-2">
                    <ActivityHeatmap sessions={skillSessions} color={skill.color} />
                  </div>
                  {skillSessions.length === 0 ? (
                    <p className="text-gray-600 text-sm text-center py-4">No sessions logged yet</p>
                  ) : (
                    <div className="divide-y divide-gray-800">
                      {(showAllSessionsFor === skill.id ? skillSessions : skillSessions.slice(0, 10)).map(session => {
                        const sessionSubSkill = session.sub_skill_id
                          ? subSkills.find(s => s.id === session.sub_skill_id)
                          : null
                        return (
                          <div key={session.id} className="px-4 py-3">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-white text-sm font-medium">{session.duration_minutes}m</span>
                              <span className="text-gray-600 text-xs">{session.date}</span>
                              {sessionSubSkill && (
                                <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-indigo-900/40 text-indigo-300 border border-indigo-800/50">
                                  <BookOpen className="w-3 h-3" />{sessionSubSkill.name}
                                </span>
                              )}
                            </div>
                            {session.target_weakness && (
                              <p className="text-indigo-300/80 text-xs mt-1">🎯 {session.target_weakness}</p>
                            )}
                            {session.notes && <p className="text-gray-500 text-xs mt-1 italic">"{session.notes}"</p>}
                            {session.next_intention && (
                              <p className="text-yellow-400/70 text-xs mt-1">→ Next: {session.next_intention}</p>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                  {skillSessions.length > 10 && (
                    <div className="px-4 pb-1 pt-2">
                      <button
                        onClick={() => setShowAllSessionsFor(showAllSessionsFor === skill.id ? null : skill.id)}
                        className="w-full text-xs text-gray-500 hover:text-indigo-400 transition-colors py-1.5 flex items-center justify-center gap-1"
                      >
                        {showAllSessionsFor === skill.id ? (
                          <><ChevronUp className="w-3.5 h-3.5" /> Show less</>
                        ) : (
                          <><ChevronDown className="w-3.5 h-3.5" /> Show {skillSessions.length - 10} more sessions ({skillSessions.length} total)</>
                        )}
                      </button>
                    </div>
                  )}
                  <div className="px-4 pb-3 flex justify-end">
                    {confirmDeleteSkill === skill.id ? (
                      <div className="flex items-center gap-2">
                        <span className="text-red-400 text-xs">Delete all data for this skill?</span>
                        <button
                          onClick={() => deleteSkill(skill.id)}
                          className="text-red-400 hover:text-red-300 text-xs font-semibold transition-colors"
                        >
                          Yes, delete
                        </button>
                        <button
                          onClick={() => setConfirmDeleteSkill(null)}
                          className="text-gray-500 hover:text-gray-300 text-xs transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => deleteSkill(skill.id)}
                        className="flex items-center gap-1.5 text-red-500/60 hover:text-red-400 text-xs transition-colors">
                        <Trash2 className="w-3.5 h-3.5" /> Delete skill
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ── Add skill form ── */}
      {showAddSkill ? (
        <div className="bg-gray-900 border border-indigo-800/40 rounded-2xl p-4 space-y-3">
          <p className="text-white font-medium text-sm">New Skill</p>
          <input type="text" placeholder="Skill name (e.g. React, Piano, Spanish)"
            value={newSkillName} onChange={e => setNewSkillName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addSkill()}
            className="w-full bg-gray-800 text-white text-sm px-4 py-3 rounded-xl border border-gray-700 focus:border-indigo-500 outline-none placeholder:text-gray-600"
            autoFocus />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-gray-500 text-xs mb-1 block">Category</label>
              <select value={newSkillCategory} onChange={e => setNewSkillCategory(e.target.value)}
                className="w-full bg-gray-800 text-white text-sm px-3 py-2 rounded-xl border border-gray-700 focus:border-indigo-500 outline-none">
                {SKILL_CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-gray-500 text-xs mb-1 block">Target hours</label>
              <input type="number" min={1} value={newSkillTarget}
                onChange={e => setNewSkillTarget(Number(e.target.value))}
                className="w-full bg-gray-800 text-white text-sm px-3 py-2 rounded-xl border border-gray-700 focus:border-indigo-500 outline-none" />
            </div>
          </div>
          <div>
            <label className="text-gray-500 text-xs mb-1 block">Weekly goal (hours)</label>
            <input type="number" min={0.5} max={40} step={0.5} value={newSkillWeeklyGoal}
              onChange={e => setNewSkillWeeklyGoal(Number(e.target.value))}
              className="w-full bg-gray-800 text-white text-sm px-3 py-2 rounded-xl border border-gray-700 focus:border-indigo-500 outline-none" />
          </div>
          <div>
            <label className="text-gray-500 text-xs mb-2 block">Color</label>
            <div className="flex gap-2 flex-wrap">
              {SKILL_COLORS.map(c => (
                <button key={c} onClick={() => setNewSkillColor(c)}
                  className={`w-6 h-6 rounded-full transition-all ${newSkillColor === c ? 'ring-2 ring-white ring-offset-2 ring-offset-gray-900 scale-110' : ''}`}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={addSkill}
              className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded-xl font-medium transition-colors">Add Skill</button>
            <button onClick={() => { setShowAddSkill(false); setNewSkillName('') }}
              className="px-4 py-2.5 text-gray-500 border border-gray-700 text-sm rounded-xl hover:border-gray-500 transition-colors">Cancel</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setShowAddSkill(true)}
          className="w-full py-3 border border-dashed border-gray-700 hover:border-indigo-500 text-gray-500 hover:text-indigo-400 rounded-2xl text-sm flex items-center justify-center gap-2 transition-all">
          <Plus className="w-4 h-4" /> Add skill
        </button>
      )}
    </div>
  )
}
