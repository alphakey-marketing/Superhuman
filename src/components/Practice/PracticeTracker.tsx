import { useState, useEffect } from 'react'
import { Plus, Trash2, ChevronDown, ChevronUp, Zap, Star, AlertCircle, BookOpen } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { PracticeSkill, PracticeSubSkill, PracticeSession, SKILL_COLORS } from '../../types'

interface Props { userId: string }

const SKILL_CATEGORIES = ['Coding', 'Writing', 'Music', 'Sport', 'Language', 'Business', 'Art', 'Other']
const MILESTONES = [10, 25, 50, 100, 200, 500, 1000]

// Template skills with their default sub-skills
const TEMPLATE_SKILLS: { name: string; category: string; color: string; target_hours: number; subSkills: string[] }[] = [
  {
    name: 'Japanese', category: 'Language', color: '#ef4444', target_hours: 1000,
    subSkills: ['Hiragana & Katakana', 'Kanji', 'Grammar', 'Listening', 'Speaking', 'Reading'],
  },
  {
    name: 'Badminton', category: 'Sport', color: '#10b981', target_hours: 200,
    subSkills: ['Footwork', 'Serve', 'Smash', 'Drop Shot', 'Net Play', 'Fitness'],
  },
  {
    name: 'Singing', category: 'Music', color: '#f59e0b', target_hours: 500,
    subSkills: ['Breathing', 'Pitch & Tone', 'Vocal Warm-ups', 'Repertoire', 'Performance', 'Ear Training'],
  },
]

function getMilestone(hours: number) {
  const reached = MILESTONES.filter(m => hours >= m)
  const next = MILESTONES.find(m => hours < m) ?? null
  return { reached: reached[reached.length - 1] ?? 0, next }
}

function DifficultyStars({ value, onChange }: { value: number; onChange?: (v: number) => void }) {
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(i => (
        <button key={i} type="button" onClick={() => onChange?.(i)}
          className={`transition-colors ${i <= value ? 'text-yellow-400' : 'text-gray-600'} ${onChange ? 'hover:text-yellow-300 cursor-pointer' : 'cursor-default'}`}
        >
          <Star className="w-4 h-4 fill-current" />
        </button>
      ))}
    </div>
  )
}

export default function PracticeTracker({ userId }: Props) {
  const [skills, setSkills] = useState<PracticeSkill[]>([])
  const [subSkills, setSubSkills] = useState<PracticeSubSkill[]>([])
  const [sessions, setSessions] = useState<PracticeSession[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedSkill, setExpandedSkill] = useState<string | null>(null)
  const [showAddSkill, setShowAddSkill] = useState(false)
  const [showLogSession, setShowLogSession] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Add skill form
  const [newSkillName, setNewSkillName] = useState('')
  const [newSkillCategory, setNewSkillCategory] = useState('Coding')
  const [newSkillTarget, setNewSkillTarget] = useState(100)
  const [newSkillColor, setNewSkillColor] = useState(SKILL_COLORS[0])

  // Sub-skill management
  const [addingSubSkillFor, setAddingSubSkillFor] = useState<string | null>(null)
  const [newSubSkillName, setNewSubSkillName] = useState('')

  // Log session form
  const [sessionMins, setSessionMins] = useState(30)
  const [sessionDifficulty, setSessionDifficulty] = useState(3)
  const [sessionQuality, setSessionQuality] = useState(3)
  const [sessionNotes, setSessionNotes] = useState('')

  useEffect(() => { loadData() }, [userId])

  const loadData = async () => {
    const [{ data: sk, error: skErr }, { data: sub, error: subErr }, { data: se, error: seErr }] = await Promise.all([
      supabase.from('practice_skills').select('*').eq('user_id', userId).order('created_at'),
      supabase.from('practice_sub_skills').select('*').eq('user_id', userId).order('created_at'),
      supabase.from('practice_sessions').select('*').eq('user_id', userId).order('date', { ascending: false }),
    ])
    if (skErr)  { setError(`Failed to load skills: ${skErr.message}`);   setLoading(false); return }
    if (subErr) { setError(`Failed to load sub-skills: ${subErr.message}`); setLoading(false); return }
    if (seErr)  { setError(`Failed to load sessions: ${seErr.message}`);  setLoading(false); return }

    const loadedSkills = sk ?? []
    setSubSkills(sub ?? [])
    setSessions(se ?? [])

    if (loadedSkills.length === 0) {
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
    // Seed sub-skills for each template
    if (seededSkills && seededSkills.length > 0) {
      const subRows: { user_id: string; skill_id: string; name: string }[] = []
      for (const seededSkill of seededSkills) {
        const template = TEMPLATE_SKILLS.find(t => t.name === seededSkill.name)
        if (template) {
          template.subSkills.forEach(s => subRows.push({ user_id: userId, skill_id: seededSkill.id, name: s }))
        }
      }
      const { data: seededSubs, error: subSeedErr } = await supabase
        .from('practice_sub_skills').insert(subRows).select()
      if (subSeedErr) {
        setError(`Skills created but sub-skills failed: ${subSeedErr.message}`)
      } else {
        setSubSkills(seededSubs ?? [])
      }
    }
    return seededSkills ?? []
  }

  const addSkill = async () => {
    if (!newSkillName.trim()) return
    setError(null)
    const { data, error: insertErr } = await supabase.from('practice_skills').insert({
      user_id: userId, name: newSkillName.trim(), category: newSkillCategory,
      color: newSkillColor, target_hours: newSkillTarget, total_hours: 0,
    }).select().single()
    if (insertErr) { setError(`Could not add skill: ${insertErr.message} (code: ${insertErr.code})`); return }
    if (!data)     { setError('Could not add skill: insert returned no data. Check RLS policies for practice_skills.'); return }
    setSkills(prev => [...prev, data])
    setNewSkillName('')
    setShowAddSkill(false)
  }

  const deleteSkill = async (id: string) => {
    const { error: delErr } = await supabase.from('practice_skills').delete().eq('id', id)
    if (delErr) { setError(`Could not delete skill: ${delErr.message}`); return }
    setSkills(prev => prev.filter(s => s.id !== id))
    setSubSkills(prev => prev.filter(s => s.skill_id !== id))
    setSessions(prev => prev.filter(s => s.skill_id !== id))
  }

  const addSubSkill = async (skillId: string) => {
    if (!newSubSkillName.trim()) return
    setError(null)
    const { data, error: insertErr } = await supabase.from('practice_sub_skills').insert({
      user_id: userId, skill_id: skillId, name: newSubSkillName.trim(),
    }).select().single()
    if (insertErr) { setError(`Could not add sub-skill: ${insertErr.message} (code: ${insertErr.code})`); return }
    if (!data)     { setError('Could not add sub-skill: insert returned no data. Check RLS policies for practice_sub_skills.'); return }
    setSubSkills(prev => [...prev, data])
    setNewSubSkillName('')
    setAddingSubSkillFor(null)
  }

  const deleteSubSkill = async (id: string) => {
    const { error: delErr } = await supabase.from('practice_sub_skills').delete().eq('id', id)
    if (delErr) { setError(`Could not delete sub-skill: ${delErr.message}`); return }
    setSubSkills(prev => prev.filter(s => s.id !== id))
  }

  const logSession = async (skillId: string) => {
    setError(null)
    const { data: sessionData, error: sessionErr } = await supabase.from('practice_sessions').insert({
      user_id: userId, skill_id: skillId,
      date: new Date().toISOString().split('T')[0],
      duration_minutes: sessionMins, difficulty: sessionDifficulty,
      quality: sessionQuality, notes: sessionNotes.trim() || null,
    }).select().single()
    if (sessionErr) { setError(`Could not log session: ${sessionErr.message} (code: ${sessionErr.code})`); return }
    if (!sessionData) { setError('Could not log session: insert returned no data. Check RLS policies for practice_sessions.'); return }
    setSessions(prev => [sessionData, ...prev])

    const { data: sk } = await supabase.from('practice_skills').select('*').eq('id', skillId).single()
    if (sk) {
      const allSessions = [sessionData, ...sessions.filter(s => s.skill_id === skillId)]
      const clientTotal = allSessions.reduce((sum, s) => sum + s.duration_minutes, 0) / 60
      const dbTotal = Number(sk.total_hours)
      const prevTotal = Number(skills.find(s => s.id === skillId)?.total_hours ?? 0)
      setSkills(prev => prev.map(s => s.id === skillId ? { ...sk, total_hours: dbTotal > prevTotal ? dbTotal : clientTotal } : s))
    } else {
      const allSessions = [sessionData, ...sessions.filter(s => s.skill_id === skillId)]
      const clientTotal = allSessions.reduce((sum, s) => sum + s.duration_minutes, 0) / 60
      setSkills(prev => prev.map(s => s.id === skillId ? { ...s, total_hours: clientTotal } : s))
    }
    setShowLogSession(null)
    setSessionNotes('')
    setSessionMins(30)
    setSessionDifficulty(3)
    setSessionQuality(3)
  }

  const totalHoursAllSkills = skills.reduce((sum, s) => sum + Number(s.total_hours), 0)
  const todayStr = new Date().toISOString().split('T')[0]
  const todayMins = sessions.filter(s => s.date === todayStr).reduce((sum, s) => sum + s.duration_minutes, 0)

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

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-3.5 text-center">
          <p className="text-2xl font-bold text-indigo-400">{skills.length}</p>
          <p className="text-gray-500 text-xs mt-0.5">Skills</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-3.5 text-center">
          <p className="text-2xl font-bold text-yellow-400">{totalHoursAllSkills.toFixed(0)}h</p>
          <p className="text-gray-500 text-xs mt-0.5">Total logged</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-3.5 text-center">
          <p className="text-2xl font-bold text-green-400">{todayMins}m</p>
          <p className="text-gray-500 text-xs mt-0.5">Today</p>
        </div>
      </div>

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
          const pct = Math.min((hours / skill.target_hours) * 100, 100)
          const { reached, next } = getMilestone(hours)
          const skillSessions = sessions.filter(s => s.skill_id === skill.id)
          const skillSubSkills = subSkills.filter(s => s.skill_id === skill.id)
          const isExpanded = expandedSkill === skill.id
          const isLogging = showLogSession === skill.id
          const isAddingSub = addingSubSkillFor === skill.id

          return (
            <div key={skill.id} className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
              {/* Skill header */}
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
                        <button onClick={() => setShowLogSession(isLogging ? null : skill.id)}
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

                    {/* Sub-skill chips */}
                    {skillSubSkills.length > 0 && (
                      <div className="flex gap-1.5 mt-3 flex-wrap">
                        {skillSubSkills.map(sub => (
                          <span key={sub.id}
                            className="group relative inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-gray-800 text-gray-300 border border-gray-700">
                            <BookOpen className="w-3 h-3 text-gray-500" />
                            {sub.name}
                            <button
                              onClick={() => deleteSubSkill(sub.id)}
                              className="ml-0.5 text-gray-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                              title="Remove sub-skill"
                            >
                              ✕
                            </button>
                          </span>
                        ))}
                        <button
                          onClick={() => { setAddingSubSkillFor(isAddingSub ? null : skill.id); setNewSubSkillName('') }}
                          className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border border-dashed border-gray-700 text-gray-600 hover:border-indigo-500 hover:text-indigo-400 transition-colors">
                          <Plus className="w-3 h-3" /> Add
                        </button>
                      </div>
                    )}

                    {/* Add sub-skill inline input */}
                    {isAddingSub && (
                      <div className="flex gap-2 mt-2">
                        <input
                          autoFocus
                          type="text"
                          placeholder="Sub-skill name…"
                          value={newSubSkillName}
                          onChange={e => setNewSubSkillName(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') addSubSkill(skill.id); if (e.key === 'Escape') { setAddingSubSkillFor(null); setNewSubSkillName('') } }}
                          className="flex-1 bg-gray-800 text-white text-xs px-3 py-1.5 rounded-lg border border-gray-700 focus:border-indigo-500 outline-none placeholder:text-gray-600"
                        />
                        <button onClick={() => addSubSkill(skill.id)}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs rounded-lg transition-colors">Save</button>
                        <button onClick={() => { setAddingSubSkillFor(null); setNewSubSkillName('') }}
                          className="px-2 py-1.5 text-gray-500 border border-gray-700 text-xs rounded-lg hover:border-gray-500 transition-colors">✕</button>
                      </div>
                    )}

                    {/* Show "+ Add sub-skill" if none yet */}
                    {skillSubSkills.length === 0 && !isAddingSub && (
                      <button
                        onClick={() => { setAddingSubSkillFor(skill.id); setNewSubSkillName('') }}
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

              {/* Log session form */}
              {isLogging && (
                <div className="border-t border-gray-800 p-4 bg-gray-900/50 space-y-3">
                  <p className="text-gray-300 text-sm font-medium">Log a practice session</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-gray-500 text-xs mb-1 block">Duration (mins)</label>
                      <input type="number" min={1} max={480} value={sessionMins}
                        onChange={e => setSessionMins(Number(e.target.value))}
                        className="w-full bg-gray-800 text-white text-sm px-3 py-2 rounded-xl border border-gray-700 focus:border-indigo-500 outline-none" />
                    </div>
                    <div>
                      <label className="text-gray-500 text-xs mb-1 block">Difficulty</label>
                      <DifficultyStars value={sessionDifficulty} onChange={setSessionDifficulty} />
                    </div>
                  </div>
                  <div>
                    <label className="text-gray-500 text-xs mb-1 block">Quality (how well did it go?)</label>
                    <DifficultyStars value={sessionQuality} onChange={setSessionQuality} />
                  </div>
                  <textarea
                    placeholder="Notes: what did you work on? What clicked? (optional)"
                    value={sessionNotes} onChange={e => setSessionNotes(e.target.value)} rows={2}
                    className="w-full bg-gray-800 text-white text-sm px-3 py-2 rounded-xl border border-gray-700 focus:border-indigo-500 outline-none resize-none placeholder:text-gray-600" />
                  <div className="flex gap-2">
                    <button onClick={() => logSession(skill.id)}
                      className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded-xl font-medium transition-colors">Save Session</button>
                    <button onClick={() => setShowLogSession(null)}
                      className="px-4 py-2.5 text-gray-500 border border-gray-700 text-sm rounded-xl hover:border-gray-500 transition-colors">Cancel</button>
                  </div>
                </div>
              )}

              {/* Session history */}
              {isExpanded && (
                <div className="border-t border-gray-800">
                  {skillSessions.length === 0 ? (
                    <p className="text-gray-600 text-sm text-center py-4">No sessions logged yet</p>
                  ) : (
                    <div className="divide-y divide-gray-800">
                      {skillSessions.slice(0, 10).map(session => (
                        <div key={session.id} className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-white text-sm font-medium">{session.duration_minutes}m</span>
                            <span className="text-gray-600 text-xs">{session.date}</span>
                          </div>
                          <div className="flex items-center gap-3 mt-1">
                            <div className="flex items-center gap-1">
                              <Zap className="w-3 h-3 text-yellow-500" />
                              <DifficultyStars value={session.difficulty} />
                            </div>
                            <div className="flex items-center gap-1">
                              <Star className="w-3 h-3 text-green-500" />
                              <DifficultyStars value={session.quality} />
                            </div>
                          </div>
                          {session.notes && <p className="text-gray-500 text-xs mt-1 italic">"{session.notes}"</p>}
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="px-4 pb-3 flex justify-end">
                    <button onClick={() => deleteSkill(skill.id)}
                      className="flex items-center gap-1.5 text-red-500/60 hover:text-red-400 text-xs transition-colors">
                      <Trash2 className="w-3.5 h-3.5" /> Delete skill
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Add skill form */}
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
