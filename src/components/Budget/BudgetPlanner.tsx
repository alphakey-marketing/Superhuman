import { useState, useEffect } from 'react'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import { Plus, Trash2, GripVertical, Clock } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { AttentionBudget, CATEGORY_COLORS } from '../../types'

interface Props {
  userId: string
  date: string
}

const CATEGORIES = Object.keys(CATEGORY_COLORS)
const TOTAL_HOURS = 16

export default function BudgetPlanner({ userId, date }: Props) {
  const [budgets, setBudgets] = useState<AttentionBudget[]>([])
  const [newCategory, setNewCategory] = useState(CATEGORIES[0])
  const [newHours, setNewHours] = useState(1)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const totalAllocated = budgets.reduce((sum, b) => sum + b.hours_allocated, 0)
  const totalUsed = budgets.reduce((sum, b) => sum + b.hours_used, 0)
  const freeHours = Math.max(TOTAL_HOURS - totalAllocated, 0)
  const isOverBudget = totalAllocated + newHours > TOTAL_HOURS

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

  const addBudget = async () => {
    if (isOverBudget || saving) return
    setSaving(true)
    const { data } = await supabase
      .from('attention_budgets')
      .insert({
        user_id: userId,
        date,
        category: newCategory,
        hours_allocated: newHours,
        hours_used: 0,
        color: CATEGORY_COLORS[newCategory] ?? '#6366f1',
      })
      .select()
      .single()
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="w-6 h-6 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Allocation bar */}
      <div>
        <div className="flex justify-between text-xs text-gray-400 mb-2">
          <span className="flex items-center gap-1.5"><Clock className="w-3 h-3" /> {TOTAL_HOURS}h daily budget</span>
          <span className={totalAllocated > TOTAL_HOURS ? 'text-red-400' : 'text-gray-400'}>
            {totalAllocated.toFixed(1)}h allocated
          </span>
        </div>
        <div className="h-5 bg-gray-800 rounded-full overflow-hidden flex">
          {budgets.map(b => (
            <div
              key={b.id}
              style={{
                width: `${(b.hours_allocated / TOTAL_HOURS) * 100}%`,
                backgroundColor: b.color,
              }}
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
        {/* Legend */}
        <div className="flex flex-wrap gap-3 mt-2">
          {budgets.map(b => (
            <div key={b.id} className="flex items-center gap-1.5 text-xs text-gray-400">
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: b.color }} />
              {b.category} ({b.hours_allocated}h)
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

      {/* Draggable list */}
      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="budgets">
          {(provided) => (
            <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-2">
              {budgets.length === 0 && (
                <div className="text-center py-10 text-gray-600 text-sm">
                  No budgets yet — add your first below
                </div>
              )}
              {budgets.map((budget, index) => (
                <Draggable key={budget.id} draggableId={budget.id} index={index}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      className={`flex items-center gap-3 bg-gray-800 rounded-xl p-3.5 border transition-all ${
                        snapshot.isDragging
                          ? 'border-indigo-500 shadow-lg shadow-indigo-500/10 scale-[1.01]'
                          : 'border-gray-700 hover:border-gray-600'
                      }`}
                    >
                      <div {...provided.dragHandleProps} className="cursor-grab active:cursor-grabbing">
                        <GripVertical className="w-4 h-4 text-gray-600" />
                      </div>

                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: budget.color }}
                      />

                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium">{budget.category}</p>
                        <div className="mt-1.5 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${Math.min((budget.hours_used / budget.hours_allocated) * 100, 100)}%`,
                              backgroundColor: budget.color,
                            }}
                          />
                        </div>
                      </div>

                      <span className="text-gray-400 text-xs whitespace-nowrap">
                        {budget.hours_used.toFixed(1)}h / {budget.hours_allocated}h
                      </span>

                      <button
                        onClick={() => deleteBudget(budget.id)}
                        className="text-gray-600 hover:text-red-400 transition-colors flex-shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      {/* Add new budget */}
      <div className="flex items-center gap-2 bg-gray-800/40 rounded-xl p-3 border border-gray-700 border-dashed">
        <select
          value={newCategory}
          onChange={e => setNewCategory(e.target.value)}
          className="flex-1 bg-gray-800 text-white text-sm px-3 py-2 rounded-lg border border-gray-700 outline-none cursor-pointer"
        >
          {CATEGORIES.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        <div className="flex items-center gap-1">
          <input
            type="number"
            min={0.5}
            max={16}
            step={0.5}
            value={newHours}
            onChange={e => setNewHours(Number(e.target.value))}
            className="w-16 bg-gray-800 text-white text-sm px-2 py-2 rounded-lg border border-gray-700 outline-none text-center"
          />
          <span className="text-gray-500 text-sm">h</span>
        </div>

        <button
          onClick={addBudget}
          disabled={isOverBudget || saving}
          title={isOverBudget ? 'Budget exceeded (max 16h)' : 'Add budget'}
          className="p-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex-shrink-0"
        >
          {saving
            ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
            : <Plus className="w-4 h-4" />}
        </button>
      </div>

      {isOverBudget && (
        <p className="text-xs text-red-400 text-center">
          Adding {newHours}h would exceed your {TOTAL_HOURS}h daily budget
        </p>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Allocated', value: `${totalAllocated.toFixed(1)}h`, color: 'text-indigo-400' },
          { label: 'Used Today', value: `${totalUsed.toFixed(1)}h`, color: 'text-green-400' },
          { label: 'Free', value: `${freeHours.toFixed(1)}h`, color: 'text-yellow-400' },
        ].map(stat => (
          <div key={stat.label} className="bg-gray-800 rounded-xl p-3.5 text-center">
            <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
            <p className="text-gray-500 text-xs mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
