import { useState, useEffect } from 'react'
import { Plus, Trash2, Pin, Flame, Crown, Diamond, Trophy, PenLine, Shuffle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { MotivationEntry, VAULT_TYPES } from '../../types'

interface Props { userId: string }

// Pre-loaded "Prove Them Wrong" starter statements
const PROOF_STARTERS = [
  "They said I couldn't. Every rep I do proves them wrong.",
  "The ones who doubted me are the ones watching now.",
  "I don't need your belief. I have my own.",
  "Underestimated. Underpaid. Underestimated. Watch.",
  "Every hour I log is a letter to everyone who wrote me off.",
  "They saw the ceiling. I saw the starting line.",
  "Quiet. Build. Let the results be loud.",
  "The best revenge is an extraordinary life.",
  "I'm not doing this to prove you wrong. I'm doing it to prove myself right.",
  "They said it was too late. I said watch me.",
]

const TYPE_ICONS: Record<MotivationEntry['type'], any> = {
  proof_them_wrong: Flame,
  identity: Crown,
  why: Diamond,
  milestone: Trophy,
  custom: PenLine,
}

const TYPE_COLORS: Record<MotivationEntry['type'], string> = {
  proof_them_wrong: '#f97316',
  identity: '#f59e0b',
  why: '#3b82f6',
  milestone: '#10b981',
  custom: '#8b5cf6',
}

const TYPE_BG: Record<MotivationEntry['type'], string> = {
  proof_them_wrong: 'from-orange-950/50 to-red-950/40 border-orange-800/30',
  identity: 'from-amber-950/50 to-yellow-950/40 border-amber-800/30',
  why: 'from-blue-950/50 to-indigo-950/40 border-blue-800/30',
  milestone: 'from-emerald-950/50 to-teal-950/40 border-emerald-800/30',
  custom: 'from-purple-950/50 to-violet-950/40 border-purple-800/30',
}

export default function MotivationVault({ userId }: Props) {
  const [entries, setEntries] = useState<MotivationEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [activeType, setActiveType] = useState<MotivationEntry['type']>('proof_them_wrong')
  const [content, setContent] = useState('')
  const [spotlightIndex, setSpotlightIndex] = useState(0)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    load()
  }, [userId])

  const load = async () => {
    const { data } = await supabase
      .from('motivation_vault')
      .select('*')
      .eq('user_id', userId)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })
    setEntries(data ?? [])
    setLoading(false)
  }

  const addEntry = async () => {
    if (!content.trim()) return
    setSaving(true)
    const { data } = await supabase.from('motivation_vault').insert({
      user_id: userId,
      type: activeType,
      content: content.trim(),
      is_pinned: false,
    }).select().single()
    if (data) {
      setEntries(prev => [data, ...prev])
      setContent('')
      setShowAdd(false)
    }
    setSaving(false)
  }

  const togglePin = async (entry: MotivationEntry) => {
    await supabase.from('motivation_vault').update({ is_pinned: !entry.is_pinned }).eq('id', entry.id)
    setEntries(prev => prev.map(e =>
      e.id === entry.id ? { ...e, is_pinned: !e.is_pinned } : e
    ).sort((a, b) => (b.is_pinned ? 1 : 0) - (a.is_pinned ? 1 : 0)))
  }

  const deleteEntry = async (id: string) => {
    await supabase.from('motivation_vault').delete().eq('id', id)
    setEntries(prev => prev.filter(e => e.id !== id))
  }

  const shuffleSpotlight = () => {
    if (entries.length > 1) setSpotlightIndex(i => (i + 1) % entries.length)
  }

  const useStarter = (text: string) => {
    setContent(text)
    setActiveType('proof_them_wrong')
    setShowAdd(true)
  }

  const pinned = entries.filter(e => e.is_pinned)
  const unpinned = entries.filter(e => !e.is_pinned)
  const spotlight = entries[spotlightIndex]

  if (loading) return (
    <div className="flex items-center justify-center h-40">
      <div className="w-5 h-5 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="space-y-5">

      {/* Spotlight card — shows a random entry in full */}
      {spotlight ? (
        <div className={`bg-gradient-to-br ${TYPE_BG[spotlight.type]} border rounded-2xl p-5 relative overflow-hidden`}>
          <div className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-10" style={{ backgroundColor: TYPE_COLORS[spotlight.type] }} />
          <div className="flex items-start justify-between gap-3 relative">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-3">
                {(() => { const Icon = TYPE_ICONS[spotlight.type]; return <Icon className="w-4 h-4" style={{ color: TYPE_COLORS[spotlight.type] }} /> })()} 
                <span className="text-xs font-medium" style={{ color: TYPE_COLORS[spotlight.type] }}>
                  {VAULT_TYPES[spotlight.type].emoji} {VAULT_TYPES[spotlight.type].label}
                </span>
              </div>
              <p className="text-white font-semibold text-lg leading-snug">"{spotlight.content}"</p>
            </div>
            <button
              onClick={shuffleSpotlight}
              className="p-2 text-gray-600 hover:text-white rounded-xl hover:bg-white/10 transition-colors flex-shrink-0"
              title="Next quote"
            >
              <Shuffle className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        // Empty state — show proof them wrong starters
        <div className="bg-gradient-to-br from-orange-950/40 to-red-950/30 border border-orange-800/30 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Flame className="w-5 h-5 text-orange-400" />
            <p className="text-white font-semibold">Prove Them Wrong</p>
          </div>
          <p className="text-gray-400 text-sm mb-4">Tap a statement to add it to your vault:</p>
          <div className="space-y-2">
            {PROOF_STARTERS.slice(0, 4).map((s, i) => (
              <button
                key={i}
                onClick={() => useStarter(s)}
                className="w-full text-left text-sm text-gray-300 hover:text-white bg-black/20 hover:bg-black/40 px-3 py-2.5 rounded-xl transition-colors border border-white/5"
              >
                "{s}"
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Type filter tabs */}
      {entries.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
          {(Object.keys(VAULT_TYPES) as MotivationEntry['type'][]).map(t => {
            const count = entries.filter(e => e.type === t).length
            if (count === 0) return null
            return (
              <button
                key={t}
                className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-xl text-xs text-gray-400 transition-colors"
              >
                <span>{VAULT_TYPES[t].emoji}</span>
                <span>{VAULT_TYPES[t].label}</span>
                <span className="bg-gray-700 text-gray-500 rounded-full w-4 h-4 flex items-center justify-center text-[10px]">{count}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* Pinned entries */}
      {pinned.length > 0 && (
        <div className="space-y-2">
          <p className="text-gray-600 text-xs uppercase tracking-wide px-1">📌 Pinned</p>
          {pinned.map(entry => <VaultCard key={entry.id} entry={entry} onPin={togglePin} onDelete={deleteEntry} />)}
        </div>
      )}

      {/* All entries */}
      {unpinned.length > 0 && (
        <div className="space-y-2">
          {pinned.length > 0 && <p className="text-gray-600 text-xs uppercase tracking-wide px-1">All entries</p>}
          {unpinned.map(entry => <VaultCard key={entry.id} entry={entry} onPin={togglePin} onDelete={deleteEntry} />)}
        </div>
      )}

      {/* Proof them wrong starters (if has entries) */}
      {entries.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
          <p className="text-gray-400 text-xs mb-3">🔥 Quick-add starters:</p>
          <div className="space-y-1.5">
            {PROOF_STARTERS.slice(0, 5).map((s, i) => (
              <button
                key={i}
                onClick={() => useStarter(s)}
                className="w-full text-left text-xs text-gray-500 hover:text-gray-300 px-2 py-1.5 rounded-lg hover:bg-gray-800 transition-colors"
              >
                + "{s.slice(0, 60)}{s.length > 60 ? '...' : ''}"
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Add entry form */}
      {showAdd ? (
        <div className="bg-gray-900 border border-indigo-800/40 rounded-2xl p-4 space-y-3">
          <p className="text-white font-medium text-sm">Add to Vault</p>
          <div className="flex gap-1.5 flex-wrap">
            {(Object.keys(VAULT_TYPES) as MotivationEntry['type'][]).map(t => (
              <button
                key={t}
                onClick={() => { setActiveType(t); setContent(VAULT_TYPES[t].placeholder) }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs transition-all ${
                  activeType === t
                    ? 'text-white ring-1'
                    : 'bg-gray-800 text-gray-500 hover:text-gray-300'
                }`}
                style={activeType === t ? { backgroundColor: TYPE_COLORS[t] + '33', ringColor: TYPE_COLORS[t], color: TYPE_COLORS[t] } : {}}
              >
                {VAULT_TYPES[t].emoji} {VAULT_TYPES[t].label}
              </button>
            ))}
          </div>
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder={VAULT_TYPES[activeType].placeholder}
            rows={3}
            className="w-full bg-gray-800 text-white text-sm px-4 py-3 rounded-xl border border-gray-700 focus:border-indigo-500 outline-none resize-none placeholder:text-gray-600"
            autoFocus
          />
          <div className="flex gap-2">
            <button
              onClick={addEntry}
              disabled={saving || !content.trim()}
              className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm rounded-xl font-medium transition-colors"
            >
              {saving ? 'Saving...' : 'Add to Vault'}
            </button>
            <button
              onClick={() => { setShowAdd(false); setContent('') }}
              className="px-4 py-2.5 text-gray-500 border border-gray-700 text-sm rounded-xl hover:border-gray-500 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowAdd(true)}
          className="w-full py-3 border border-dashed border-gray-700 hover:border-orange-500 text-gray-500 hover:text-orange-400 rounded-2xl text-sm flex items-center justify-center gap-2 transition-all"
        >
          <Plus className="w-4 h-4" /> Add to vault
        </button>
      )}
    </div>
  )
}

function VaultCard({ entry, onPin, onDelete }: {
  entry: MotivationEntry
  onPin: (e: MotivationEntry) => void
  onDelete: (id: string) => void
}) {
  const Icon = TYPE_ICONS[entry.type]
  const color = TYPE_COLORS[entry.type]
  const bg = TYPE_BG[entry.type]

  return (
    <div className={`bg-gradient-to-r ${bg} border rounded-xl p-3.5 flex items-start gap-3`}>
      <Icon className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color }} />
      <p className="flex-1 text-gray-200 text-sm leading-relaxed">{entry.content}</p>
      <div className="flex gap-1 flex-shrink-0">
        <button
          onClick={() => onPin(entry)}
          className={`p-1.5 rounded-lg transition-colors ${
            entry.is_pinned ? 'text-yellow-400 bg-yellow-900/30' : 'text-gray-600 hover:text-yellow-400 hover:bg-gray-800'
          }`}
          title={entry.is_pinned ? 'Unpin' : 'Pin to top'}
        >
          <Pin className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => onDelete(entry.id)}
          className="p-1.5 text-gray-600 hover:text-red-400 rounded-lg hover:bg-gray-800 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}
