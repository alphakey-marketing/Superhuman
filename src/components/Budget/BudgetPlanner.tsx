import { useState, useEffect } from 'react'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import { Plus, Trash2, GripVertical, Clock, ChevronDown, ChevronUp, Info } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { AttentionBudget, CATEGORY_COLORS } from '../../types'

interface Props {
  userId: string
  date: string
}

const CATEGORY_META: Record<string, { emoji: string; what: string; examples: string }> = {
  'Deep Work': {
    emoji: '🧠',
    what: 'Tasks that demand your full, unbroken attention and push your cognitive limits.',
    examples: 'Coding, writing a report, solving complex problems, studying hard material',
  },
  'Learning': {
    emoji: '📚',
    what: 'Absorbing new knowledge or skills — reading, courses, research.',
    examples: 'Online courses, reading books/articles, watching educational content, practising a language',
  },
  'Creative': {
    emoji: '🎨',
    what: 'Open-ended thinking, building, or creating — brainstorming and flow-state work.',
    examples: 'Designing, writing creatively, side projects, music, content creation',
  },
  'Admin': {
    emoji: '📋',
    what: "Routine, low-focus tasks that keep things running but don't stretch your brain.",
    examples: 'Emails, meetings, scheduling, filing, form-filling, quick replies',
  },
  'Exercise': {
    emoji: '💪',
    what: 'Physical activity that recharges your brain and body.',
    examples: 'Gym, running, walking, cycling, sports, yoga',
  },
  'Rest': {
    emoji: '😴',
    what: 'Deliberate recovery — doing nothing productive on purpose.',
    examples: 'Napping, meditation, quiet time, nature walks with no agenda',
  },
  'Social': {
    emoji: '🤝',
    what: 'Meaningful connection with people — family, friends, networking.',
    examples: 'Dinner with family, catching up with friends, team bonding, mentoring',
  },
}

const DAY_TEMPLATES = [
  {
    id: 'office',
    label: '🏢 Office Day',
    desc: 'Balanced day at work — deep focus in AM, admin in PM',
    tip: 'Your brain is sharpest 9–12. Protect that window for Deep Work.',
    allocations: [
      { category: 'Deep Work', hours: 3 },
      { category: 'Admin',     hours: 2 },
      { category: 'Learning',  hours: 1 },
      { category: 'Exercise',  hours: 0.5 },
      { category: 'Rest',      hours: 0.5 },
    ],
  },
  {
    id: 'deep',
    label: '⚡ Deep Work Day',
    desc: 'Max output — protect your best hours ruthlessly',
    tip: 'Block your calendar, mute notifications, and go deep for 4+ hours.',
    allocations: [
      { category: 'Deep Work', hours: 4.5 },
      { category: 'Admin',     hours: 1 },
      { category: 'Exercise',  hours: 0.5 },
      { category: 'Rest',      hours: 0.5 },
    ],
  },
  {
    id: 'creative',
    label: '🎨 Creative Day',
    desc: 'Side project, design, or creative work alongside office hours',
    tip: 'Use your lunch + evening for creative flow. AM for office deep work.',
    allocations: [
      { category: 'Deep Work', hours: 2 },
      { category: 'Creative',  hours: 2.5 },
      { category: 'Admin',     hours: 1 },
      { category: 'Learning',  hours: 0.5 },
      { category: 'Exercise',  hours: 0.5 },
    ],
  },
  {
    id: 'learning',
    label: '📚 Learning Day',
    desc: 'Prioritise skill-building and knowledge absorption',
    tip: 'Use commute time for audio learning. Evening for active practice.',
    allocations: [
      { category: 'Deep Work', hours: 2 },
      { category: 'Learning',  hours: 2.5 },
      { category: 'Admin',     hours: 1 },
      { category: 'Exercise',  hours: 0.5 },
      { category: 'Rest',      hours: 0.5 },
    ],
  },
  {
    id: 'recovery',
    label: '🧘 Recovery Day',
    desc: "Low intensity — when you're tired or need to recharge",
    tip: 'Even on recovery days, 1h of real focus moves the needle.',
    allocations: [
      { category: 'Admin',     hours: 2 },
      { category: 'Deep Work', hours: 1 },
      { category: 'Exercise',  hours: 1 },
      { category: 'Rest',      hours: 2 },
      { category: 'Social',    hours: 0.5 },
    ],
  },
]

const AVAILABLE_BLOCKS = [
  { label: 'Morning focus (9–12:30)', hours: 3.5 },
  { label: 'Lunch break (12:30–2)', hours: 1.5 },
  { label: 'Afternoon (2–6)', hours: 4 },
  { label: 'Evening at home (7–10)', hours: 3 },
]
const REAL_AVAILABLE_HOURS = AVAILABLE_BLOCKS.reduce((s, b) => s + b.hours, 0)
const TOTAL_HOURS = 16
const CATEGORIES = Object.keys(CATEGORY_COLORS)

export default function BudgetPlanner({ userId, date }: Props) {
  const [budgets, setBudgets] = useState<AttentionBudget[]>([])
  const [newCategory, setNewCategory] = useState(CATEGORIES[0])
  const [newHours, setNewHours] = useState(1)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [applyingTemplate, setApplyingTemplate] = useState(false)
  const [expandedMeta, setExpandedMeta] = useState<string | null>(null)
  const [showTemplates, setShowTemplates] = useState(true)

  const totalAllocated = budgets.reduce((sum, b) => sum + b.hours_allocated, 0)
  const totalUsed = budgets.reduce((sum, b) => sum + b.hours_used, 0)
  const freeHours = Math.max(TOTAL_HOURS - totalAllocated, 0)
  const isOverBudget = totalAllocated + newHours > TOTAL_HOURS
  const isOverRealHours = totalAllocated > REAL_AVAILABLE_HOURS

  useEffect(() => {
    const fetchBudgets = async () => {
      const { data } = await supabase
        .from('attention_budgets')
        .select('*')
        .eq('user_id', userId)
        .eq('date', date)
        .order('created_at')
      setBudgets(data ?? [])
      setLoading(false)
    }
    fetchBudgets()
  }, [userId, date])

  const applyTemplate = async (templateId: string) => {
    const template = DAY_TEMPLATES.find(t => t.id === templateId)
    if (!template || applyingTemplate) return
    setApplyingTemplate(true)
    if (budgets.length > 0) {
      await supabase.from('attention_budgets').delete().eq('user_id', userId).eq('date', date)
    }
    const inserts = template.allocations.map(a => ({
      user_id: userId,
      date,
      category: a.category,
      hours_allocated: a.hours,
      hours_used: 0,
      color: CATEGORY_COLORS[a.category] ?? '#6366f1',
    }))
    const { data } = await supabase.from('attention_budgets').insert(inserts).select()
    setBudgets(data ?? [])
    setShowTemplates(false)
    setApplyingTemplate(false)
  }

  const addBudget = async () => {
    if (isOverBudget || saving) return
    setSaving(true)
    const { data } = await supabase
      .from('attention_budgets')
      .insert({ user_id: userId, date, category: newCategory, hours_allocated: newHours, hours_used: 0, color: CATEGORY_COLORS[newCategory] ?? '#6366f1' })
      .select().single()
    if (data) setBudgets(prev => [...prev, data])
    setSaving(false)
  }

  const deleteBudget = async (id: string) => {
    await supabase.from('attention_budgets').delete().eq('id', id)
    setBudgets(prev => prev.filter(b => b.id !== id))
  }

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return
    const reordered = Array.from(budgets)
    const [moved] = reordered.splice(result.source.index, 1)
    reordered.splice(result.destination.index, 0, moved)
    setBudgets(reordered)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-40">
      <div className="w-6 h-6 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="space-y-5">

      {/* Day Templates */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <button
          onClick={() => setShowTemplates(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-800/40 transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className="text-white text-sm font-semibold">Quick-start templates</span>
            {budgets.length === 0 && (
              <span className="text-xs bg-indigo-600 text-white px-2 py-0.5 rounded-full">Start here</span>
            )}
          </div>
          {showTemplates ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
        </button>
        {showTemplates && (
          <div className="px-4 pb-4 space-y-2">
            <p className="text-gray-500 text-xs mb-3">Pick a template based on how you want today to go. You can adjust after.</p>
            {DAY_TEMPLATES.map(t => (
              <button
                key={t.id}
                onClick={() => applyTemplate(t.id)}
                disabled={applyingTemplate}
                className="w-full text-left p-3.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-indigo-600/50 rounded-xl transition-all active:scale-[0.99] disabled:opacity-50"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <p className="text-white text-sm font-medium">{t.label}</p>
                    <p className="text-gray-500 text-xs mt-0.5">{t.desc}</p>
                    <div className="flex gap-1.5 mt-2 flex-wrap">
                      {t.allocations.map(a => (
                        <span key={a.category} className="text-xs px-2 py-0.5 rounded-full bg-gray-700 text-gray-400">
                          {CATEGORY_META[a.category]?.emoji} {a.category} {a.hours}h
                        </span>
                      ))}
                    </div>
                  </div>
                  <span className="text-indigo-400 text-xs font-medium whitespace-nowrap mt-0.5">Use this →</span>
                </div>
                <p className="text-gray-600 text-xs mt-2 italic">"{t.tip}"</p>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Category explainer */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <button
          onClick={() => setExpandedMeta(expandedMeta === '__all__' ? null : '__all__')}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-800/40 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-indigo-400" />
            <span className="text-gray-300 text-sm font-medium">What does each category mean?</span>
          </div>
          {expandedMeta === '__all__' ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
        </button>
        {expandedMeta === '__all__' && (
          <div className="px-4 pb-4 space-y-3">
            {Object.entries(CATEGORY_META).map(([cat, meta]) => (
              <div key={cat} className="flex gap-3 p-3 bg-gray-800 rounded-xl">
                <span className="text-2xl flex-shrink-0">{meta.emoji}</span>
                <div>
                  <p className="text-white text-sm font-semibold">{cat}</p>
                  <p className="text-gray-400 text-xs mt-0.5 leading-relaxed">{meta.what}</p>
                  <p className="text-gray-600 text-xs mt-1"><span className="text-gray-500">e.g.</span> {meta.examples}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Available hours */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
        <p className="text-gray-400 text-xs font-medium mb-2">⏰ Your real available hours today</p>
        <div className="space-y-1.5">
          {AVAILABLE_BLOCKS.map(b => (
            <div key={b.label} className="flex items-center justify-between">
              <span className="text-gray-500 text-xs">{b.label}</span>
              <span className="text-gray-400 text-xs font-medium">{b.hours}h</span>
            </div>
          ))}
          <div className="border-t border-gray-800 pt-1.5 flex items-center justify-between">
            <span className="text-gray-300 text-xs font-semibold">Total usable time</span>
            <span className="text-indigo-400 text-xs font-bold">{REAL_AVAILABLE_HOURS}h</span>
          </div>
        </div>
        {isOverRealHours && (
          <div className="mt-2 text-xs text-amber-400 bg-amber-900/20 border border-amber-800/30 rounded-lg px-3 py-2">
            ⚠️ You've allocated {totalAllocated}h but only have ~{REAL_AVAILABLE_HOURS}h realistically available. Consider reducing.
          </div>
        )}
      </div>

      {/* Allocation bar */}
      {budgets.length > 0 && (
        <div>
          <div className="flex justify-between text-xs text-gray-400 mb-2">
            <span className="flex items-center gap-1.5"><Clock className="w-3 h-3" /> {totalAllocated.toFixed(1)}h planned</span>
            <span className={totalAllocated > REAL_AVAILABLE_HOURS ? 'text-amber-400' : 'text-gray-500'}>
              {REAL_AVAILABLE_HOURS}h available
            </span>
          </div>
          <div className="h-5 bg-gray-800 rounded-full overflow-hidden flex">
            {budgets.map(b => (
              <div
                key={b.id}
                style={{ width: `${(b.hours_allocated / TOTAL_HOURS) * 100}%`, backgroundColor: b.color }}
                title={`${b.category}: ${b.hours_allocated}h`}
                className="transition-all duration-300 first:rounded-l-full"
              />
            ))}
            {freeHours > 0 && (
              <div
                style={{ width: `${(freeHours / TOTAL_HOURS) * 100}%` }}
                className="bg-gray-700/50 last:rounded-r-full"
                title={`Unallocated: ${freeHours.toFixed(1)}h`}
              />
            )}
          </div>
          <div className="flex flex-wrap gap-3 mt-2">
            {budgets.map(b => (
              <div key={b.id} className="flex items-center gap-1.5 text-xs text-gray-400">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: b.color }} />
                {CATEGORY_META[b.category]?.emoji} {b.category} ({b.hours_allocated}h)
              </div>
            ))}
            {freeHours > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <div className="w-2 h-2 rounded-full bg-gray-700" />
                Free ({freeHours.toFixed(1)}h)
              </div>
            )}
          </div>
        </div>
      )}

      {/* Draggable budget list */}
      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="budgets">
          {(provided) => (
            <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-2">
              {budgets.length === 0 && (
                <div className="text-center py-8 text-gray-600 text-sm bg-gray-900 border border-gray-800 rounded-2xl">
                  <p className="text-2xl mb-2">☝️</p>
                  <p>Pick a template above, or add categories manually below</p>
                </div>
              )}
              {budgets.map((budget, index) => {
                const meta = CATEGORY_META[budget.category]
                return (
                  <Draggable key={budget.id} draggableId={budget.id} index={index}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className={`bg-gray-800 rounded-xl border transition-all ${
                          snapshot.isDragging
                            ? 'border-indigo-500 shadow-lg shadow-indigo-500/10 scale-[1.01]'
                            : 'border-gray-700 hover:border-gray-600'
                        }`}
                      >
                        <div className="flex items-center gap-3 p-3.5">
                          <div {...provided.dragHandleProps} className="cursor-grab active:cursor-grabbing">
                            <GripVertical className="w-4 h-4 text-gray-600" />
                          </div>
                          <span className="text-lg">{meta?.emoji ?? '📌'}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-white text-sm font-medium">{budget.category}</p>
                              <button
                                onClick={() => setExpandedMeta(expandedMeta === budget.category ? null : budget.category)}
                                className="text-gray-600 hover:text-indigo-400 transition-colors"
                                title="What does this mean?"
                              >
                                <Info className="w-3 h-3" />
                              </button>
                            </div>
                            <div className="mt-1.5 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{ width: `${Math.min((budget.hours_used / budget.hours_allocated) * 100, 100)}%`, backgroundColor: budget.color }}
                              />
                            </div>
                          </div>
                          <span className="text-gray-400 text-xs whitespace-nowrap">
                            {budget.hours_used.toFixed(1)}h / {budget.hours_allocated}h
                          </span>
                          <button onClick={() => deleteBudget(budget.id)} className="text-gray-600 hover:text-red-400 transition-colors flex-shrink-0">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        {expandedMeta === budget.category && meta && (
                          <div className="px-4 pb-3 pt-0">
                            <div className="bg-gray-900 rounded-lg p-3 border border-gray-700">
                              <p className="text-gray-300 text-xs leading-relaxed">{meta.what}</p>
                              <p className="text-gray-500 text-xs mt-1"><span className="text-gray-400">Examples:</span> {meta.examples}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </Draggable>
                )
              })}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      {/* Add manually */}
      <div>
        <p className="text-gray-600 text-xs mb-2 px-1">Or add manually:</p>
        <div className="flex items-center gap-2 bg-gray-800/40 rounded-xl p-3 border border-gray-700 border-dashed">
          <select
            value={newCategory}
            onChange={e => setNewCategory(e.target.value)}
            className="flex-1 bg-gray-800 text-white text-sm px-3 py-2 rounded-lg border border-gray-700 outline-none cursor-pointer"
          >
            {CATEGORIES.map(c => (
              <option key={c} value={c}>{CATEGORY_META[c]?.emoji ?? ''} {c}</option>
            ))}
          </select>
          <div className="flex items-center gap-1">
            <input
              type="number" min={0.5} max={16} step={0.5}
              value={newHours}
              onChange={e => setNewHours(Number(e.target.value))}
              className="w-16 bg-gray-800 text-white text-sm px-2 py-2 rounded-lg border border-gray-700 outline-none text-center"
            />
            <span className="text-gray-500 text-sm">h</span>
          </div>
          <button
            onClick={addBudget}
            disabled={isOverBudget || saving}
            className="p-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex-shrink-0"
          >
            {saving
              ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
              : <Plus className="w-4 h-4" />}
          </button>
        </div>
        {isOverBudget && (
          <p className="text-xs text-red-400 text-center mt-2">Adding {newHours}h would exceed the {TOTAL_HOURS}h daily maximum</p>
        )}
      </div>

      {/* Summary cards */}
      {budgets.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Planned', value: `${totalAllocated.toFixed(1)}h`, color: 'text-indigo-400' },
            { label: 'Used Today', value: `${totalUsed.toFixed(1)}h`, color: 'text-green-400' },
            { label: 'Free', value: `${freeHours.toFixed(1)}h`, color: 'text-yellow-400' },
          ].map(stat => (
            <div key={stat.label} className="bg-gray-800 rounded-xl p-3.5 text-center">
              <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
              <p className="text-gray-500 text-xs mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
