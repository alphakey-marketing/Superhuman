import { useState, useEffect, useRef } from 'react'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import { Plus, Trash2, GripVertical, Clock, ChevronDown, ChevronUp, Info, Zap } from 'lucide-react'
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
  'Entertainment': {
    emoji: '🎮',
    what: 'Leisure and enjoyment — guilt-free time to do what you love.',
    examples: 'Movies, games, YouTube, music, reading for fun, hobbies',
  },
  'Meals': {
    emoji: '🍽️',
    what: 'Time set aside for eating — breakfast, lunch, dinner, and any snacks.',
    examples: 'Cooking, sitting down for meals, meal prep, grabbing food out',
  },
}

const FRAGMENT_SLOTS = [
  {
    id: 'commute-to',
    label: 'Morning commute',
    duration: '30–60 min',
    emoji: '🚇',
    color: '#6366f1',
    context: 'You\'re in transit — hands and eyes are occupied. Your brain is fresh but can\'t read or type.',
    best: 'Audio Learning',
    bestEmoji: '📚',
    why: 'This is the single best slot for podcasts, audiobooks, and language apps. Your mind is alert and distraction-free. 5 commute-days/week = 4+ hours of learning that cost you nothing.',
    tactics: [
      'Pick ONE podcast or audiobook and stick to it for a week (no switching)',
      'Use Audible, Spotify, or Anki audio cards for language learning',
      'If walking: listen at 1.5x speed to cover more ground',
      'If driving: keep it audio-only, no visual content',
    ],
    avoid: 'Social media scrolling — it spikes cortisol before your most important work block.',
  },
  {
    id: 'commute-back',
    label: 'Evening commute',
    duration: '30–60 min',
    emoji: '🌆',
    color: '#f59e0b',
    context: 'Your brain is fatigued after a full day. Cognitive capacity is low. You\'re transitioning from work to home.',
    best: 'Rest or Light Audio',
    bestEmoji: '😴',
    why: 'The evening commute is a natural decompression window. Using it to mentally "switch off" means you arrive home present — not still at the office in your head. This directly improves sleep quality.',
    tactics: [
      'Music, ambient sounds, or a light entertainment podcast',
      'Avoid checking work emails — this extends your workday mentally',
      'If walking: no headphones occasionally — let your mind wander (diffuse thinking helps creativity)',
      'Use this window to decide ONE thing you want to do when you get home',
    ],
    avoid: 'Heavy learning or work content — your cognitive tank is empty and retention drops to near zero.',
  },
  {
    id: 'lunch',
    label: 'Lunch break',
    duration: '60–90 min',
    emoji: '🍱',
    color: '#10b981',
    context: 'Mid-day break. You have some mental energy left but are past your morning peak. Body needs food and movement.',
    best: 'Walk + Admin or Social',
    bestEmoji: '🚶',
    why: 'A 20-min walk after eating improves afternoon focus by ~20% (research-backed). The remaining time is perfect for inbox zero, quick admin tasks, or social connection — low-cognitive work that still moves the needle.',
    tactics: [
      '20-min walk first — even around the block. Non-negotiable.',
      'Batch all your email replies into this window (inbox zero method)',
      'Eat lunch with a colleague once a week — social capital compounds',
      'If you have a side project: 30 min of creative work here adds up to 2.5h/week',
    ],
    avoid: 'Eating at your desk while working — you skip the recovery and return to the PM block already depleted.',
  },
  {
    id: 'micro-5',
    label: '5-min gaps (between meetings)',
    duration: '5–10 min',
    emoji: '⚡',
    color: '#ec4899',
    context: 'Tiny windows between calls, meetings, or tasks. Too short to start deep work. Easy to waste on reflexive phone-checking.',
    best: 'Capture + Reset',
    bestEmoji: '✍️',
    why: 'Five minutes isn\'t enough to do deep work, but it\'s perfect for capturing thoughts, clearing your head, and setting up the next task. Top performers use these gaps intentionally — everyone else loses them to the feed.',
    tactics: [
      'Write down one thought, idea, or task that\'s in your head (brain dump)',
      'Stand up, stretch, look out a window for 60 seconds — resets focus',
      'Review your task list and pick the single next action',
      'Take 5 slow breaths — lowers cortisol and primes for the next block',
    ],
    avoid: 'Opening Instagram, TikTok, or news — you\'ll get pulled in and your "5 minutes" becomes 25.',
  },
  {
    id: 'micro-waiting',
    label: 'Waiting time (queues, lifts, lobbies)',
    duration: '2–10 min',
    emoji: '⏳',
    color: '#8b5cf6',
    context: 'Unpredictable micro-moments scattered through the day — waiting for coffee, lifts, colleagues. Traditionally 100% dead time.',
    best: 'Flashcards or Reflection',
    bestEmoji: '🃏',
    why: 'Spaced repetition flashcard apps (like Anki) are designed exactly for these 2-minute windows. Consistent daily review — even 10 cards — builds vocabulary, concepts, or facts faster than any study session.',
    tactics: [
      'Keep Anki or a flashcard app as your default "waiting" app (replace social media)',
      'Review your top Motivation Vault entry — takes 30 seconds, high ROI',
      'Use voice memos to capture ideas while walking between places',
      'One positive observation about your surroundings — trains present-moment awareness',
    ],
    avoid: 'Nothing — literally any intentional use of this time beats the default (mindless scrolling).',
  },
  {
    id: 'post-lunch-dip',
    label: 'Post-lunch dip (2–3 PM)',
    duration: '30–60 min',
    emoji: '😪',
    color: '#f97316',
    context: 'The post-lunch energy crash is biological — your body diverts blood to digestion. Cognitive performance dips for most people between 1:30–3 PM.',
    best: 'Admin, Meetings, or a Nap',
    bestEmoji: '📋',
    why: 'Fighting the dip with deep work is the wrong move — you produce lower quality output and it frustrates you. Instead, schedule your lowest-cognitive tasks here and save the afternoon for a second deep work block at 4–6 PM.',
    tactics: [
      'Block your calendar 1:30–3 PM for admin/meetings — don\'t fight the biology',
      'If you can: a 20-min nap (set alarm) gives you 3+ hours of extra alertness',
      'Walk again if you didn\'t at lunch — even 10 min helps',
      'Drink water — dehydration amplifies the dip',
    ],
    avoid: 'Starting your most important deep work task during the dip — you\'ll struggle and produce worse work.',
  },
]

const DAY_TEMPLATES = [
  {
    id: 'office',
    label: '🏢 Office Day',
    desc: 'Balanced day at work — deep focus in AM, admin in PM',
    tip: 'Your brain is sharpest 9–12. Protect that window for Deep Work.',
    allocations: [
      { category: 'Deep Work',    hours: 3 },
      { category: 'Admin',        hours: 2 },
      { category: 'Learning',     hours: 1 },
      { category: 'Meals',        hours: 1.5 },
      { category: 'Exercise',     hours: 0.5 },
      { category: 'Rest',         hours: 0.5 },
    ],
  },
  {
    id: 'deep',
    label: '⚡ Deep Work Day',
    desc: 'Max output — protect your best hours ruthlessly',
    tip: 'Block your calendar, mute notifications, and go deep for 4+ hours.',
    allocations: [
      { category: 'Deep Work',    hours: 4.5 },
      { category: 'Admin',        hours: 1 },
      { category: 'Meals',        hours: 1.5 },
      { category: 'Exercise',     hours: 0.5 },
      { category: 'Rest',         hours: 0.5 },
    ],
  },
  {
    id: 'home',
    label: '🏠 Home Day',
    desc: 'Off day — rest, fun, family, movement. Zero work guilt.',
    tip: 'You recharge best when you fully disconnect. One day off makes the next five days better.',
    allocations: [
      { category: 'Entertainment', hours: 3 },
      { category: 'Rest',          hours: 2 },
      { category: 'Exercise',      hours: 1 },
      { category: 'Social',        hours: 2 },
      { category: 'Meals',         hours: 1.5 },
    ],
  },
  {
    id: 'learning',
    label: '📚 Learning Day',
    desc: 'Prioritise skill-building and knowledge absorption',
    tip: 'Use commute time for audio learning. Evening for active practice.',
    allocations: [
      { category: 'Deep Work',    hours: 2 },
      { category: 'Learning',     hours: 2.5 },
      { category: 'Admin',        hours: 1 },
      { category: 'Meals',        hours: 1.5 },
      { category: 'Exercise',     hours: 0.5 },
      { category: 'Rest',         hours: 0.5 },
    ],
  },
  {
    id: 'recovery',
    label: '🧘 Recovery Day',
    desc: "Low intensity — when you're tired or need to recharge",
    tip: 'Even on recovery days, 1h of real focus moves the needle.',
    allocations: [
      { category: 'Admin',        hours: 2 },
      { category: 'Deep Work',    hours: 1 },
      { category: 'Exercise',     hours: 1 },
      { category: 'Rest',         hours: 2 },
      { category: 'Meals',        hours: 1.5 },
      { category: 'Social',       hours: 0.5 },
    ],
  },
]

const AVAILABLE_BLOCKS = [
  { label: 'Morning focus (9–12:30)', hours: 3.5 },
  { label: 'Lunch break (12:30–2)',   hours: 1.5 },
  { label: 'Afternoon (2–6)',         hours: 4 },
  { label: 'Evening at home (7–10)',  hours: 3 },
]
const REAL_AVAILABLE_HOURS = AVAILABLE_BLOCKS.reduce((s, b) => s + b.hours, 0)
const TOTAL_HOURS = 16
const CATEGORIES = Object.keys(CATEGORY_COLORS)

export default function BudgetPlanner({ userId, date }: Props) {
  const [budgets, setBudgets]             = useState<AttentionBudget[]>([])
  const [newCategory, setNewCategory]     = useState(CATEGORIES[0])
  const [newHours, setNewHours]           = useState(1)
  const [loading, setLoading]             = useState(true)
  const [saving, setSaving]               = useState(false)
  const [applyingTemplate, setApplyingTemplate] = useState(false)
  const [expandedMeta, setExpandedMeta]   = useState<string | null>(null)
  const [showTemplates, setShowTemplates] = useState(true)
  const [showFragments, setShowFragments] = useState(false)
  const [expandedFragment, setExpandedFragment] = useState<string | null>(null)

  // Track previous date so we can detect a day rollover
  const prevDateRef = useRef(date)

  const totalAllocated  = budgets.reduce((sum, b) => sum + b.hours_allocated, 0)
  const totalUsed       = budgets.reduce((sum, b) => sum + b.hours_used, 0)
  const freeHours       = Math.max(TOTAL_HOURS - totalAllocated, 0)
  const isOverBudget    = totalAllocated + newHours > TOTAL_HOURS
  const isOverRealHours = totalAllocated > REAL_AVAILABLE_HOURS

  useEffect(() => {
    // When the date changes (midnight rollover), wipe stale UI state immediately
    if (prevDateRef.current !== date) {
      prevDateRef.current = date
      setBudgets([])
      setShowTemplates(true)   // re-open template picker for the new day
      setExpandedMeta(null)
    }

    setLoading(true)
    const fetchBudgets = async () => {
      const { data } = await supabase
        .from('attention_budgets')
        .select('*')
        .eq('user_id', userId)
        .eq('date', date)
        .order('created_at')
      setBudgets(data ?? [])
      // If there are already budgets for today, keep templates collapsed
      if ((data ?? []).length > 0) setShowTemplates(false)
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

      {/* Fragment Time Playbook */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <button
          onClick={() => setShowFragments(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-800/40 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-yellow-400" />
            <span className="text-white text-sm font-semibold">Fragment time playbook</span>
            <span className="text-xs bg-yellow-600/20 text-yellow-400 border border-yellow-600/30 px-2 py-0.5 rounded-full">+2–3h/day hidden</span>
          </div>
          {showFragments ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
        </button>
        {showFragments && (
          <div className="px-4 pb-4">
            <p className="text-gray-500 text-xs mb-4 leading-relaxed">
              Fragment time = the gaps between your main blocks (commute, lunch, waiting, the post-lunch dip). Most people lose 2–3 hours a day here. Tap each window to see exactly what to do with it.
            </p>
            <div className="space-y-2">
              {FRAGMENT_SLOTS.map(slot => (
                <div key={slot.id} className="rounded-xl border border-gray-700 overflow-hidden">
                  <button
                    onClick={() => setExpandedFragment(expandedFragment === slot.id ? null : slot.id)}
                    className="w-full flex items-center gap-3 px-3.5 py-3 hover:bg-gray-800/60 transition-colors text-left"
                  >
                    <span className="text-xl flex-shrink-0">{slot.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-white text-sm font-medium">{slot.label}</p>
                        <span className="text-gray-600 text-xs">{slot.duration}</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-xs">{slot.bestEmoji}</span>
                        <span className="text-xs font-medium" style={{ color: slot.color }}>Best use: {slot.best}</span>
                      </div>
                    </div>
                    {expandedFragment === slot.id
                      ? <ChevronUp className="w-4 h-4 text-gray-500 flex-shrink-0" />
                      : <ChevronDown className="w-4 h-4 text-gray-500 flex-shrink-0" />}
                  </button>
                  {expandedFragment === slot.id && (
                    <div className="px-4 pb-4 pt-1 bg-gray-800/30 border-t border-gray-700/50 space-y-3">
                      <div className="text-gray-500 text-xs leading-relaxed italic">{slot.context}</div>
                      <div className="bg-gray-900 rounded-xl p-3 border border-gray-700">
                        <p className="text-xs font-semibold mb-1" style={{ color: slot.color }}>💡 Why this works</p>
                        <p className="text-gray-300 text-xs leading-relaxed">{slot.why}</p>
                      </div>
                      <div>
                        <p className="text-gray-400 text-xs font-semibold mb-2">✅ Tactics</p>
                        <div className="space-y-1.5">
                          {slot.tactics.map((t, i) => (
                            <div key={i} className="flex items-start gap-2">
                              <span className="text-gray-600 text-xs mt-0.5 flex-shrink-0">{i + 1}.</span>
                              <p className="text-gray-300 text-xs leading-relaxed">{t}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="bg-red-950/20 border border-red-900/30 rounded-xl p-3">
                        <p className="text-red-400 text-xs font-semibold mb-1">🚫 Avoid</p>
                        <p className="text-gray-400 text-xs leading-relaxed">{slot.avoid}</p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
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
              <div key={b.id}
                style={{ width: `${(b.hours_allocated / TOTAL_HOURS) * 100}%`, backgroundColor: b.color }}
                title={`${b.category}: ${b.hours_allocated}h`}
                className="transition-all duration-300 first:rounded-l-full" />
            ))}
            {freeHours > 0 && (
              <div style={{ width: `${(freeHours / TOTAL_HOURS) * 100}%` }}
                className="bg-gray-700/50 last:rounded-r-full"
                title={`Unallocated: ${freeHours.toFixed(1)}h`} />
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
                      <div ref={provided.innerRef} {...provided.draggableProps}
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
                                title="What does this mean?">
                                <Info className="w-3 h-3" />
                              </button>
                            </div>
                            <div className="mt-1.5 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                              <div className="h-full rounded-full transition-all duration-500"
                                style={{ width: `${Math.min((budget.hours_used / budget.hours_allocated) * 100, 100)}%`, backgroundColor: budget.color }} />
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
          <select value={newCategory} onChange={e => setNewCategory(e.target.value)}
            className="flex-1 bg-gray-800 text-white text-sm px-3 py-2 rounded-lg border border-gray-700 outline-none cursor-pointer">
            {CATEGORIES.map(c => (
              <option key={c} value={c}>{CATEGORY_META[c]?.emoji ?? ''} {c}</option>
            ))}
          </select>
          <div className="flex items-center gap-1">
            <input type="number" min={0.5} max={16} step={0.5} value={newHours}
              onChange={e => setNewHours(Number(e.target.value))}
              className="w-16 bg-gray-800 text-white text-sm px-2 py-2 rounded-lg border border-gray-700 outline-none text-center" />
            <span className="text-gray-500 text-sm">h</span>
          </div>
          <button onClick={addBudget} disabled={isOverBudget || saving}
            className="p-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex-shrink-0">
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
            { label: 'Planned',    value: `${totalAllocated.toFixed(1)}h`, color: 'text-indigo-400' },
            { label: 'Used Today', value: `${totalUsed.toFixed(1)}h`,      color: 'text-green-400' },
            { label: 'Free',       value: `${freeHours.toFixed(1)}h`,      color: 'text-yellow-400' },
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
