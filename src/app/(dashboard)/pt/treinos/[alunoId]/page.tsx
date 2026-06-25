'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Plus, Trash2, Dumbbell, Save, X, Calendar, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { Skeleton } from '@/components/ui/skeleton'
import { DatePicker } from '@/components/ui/date-picker'
import { workoutApi } from '@/lib/api'
import { getInitials, avatarColor } from '@/lib/utils'
import { db, uid } from '@/lib/mock-db'
import type { WorkoutPlan, Exercise } from '@/types'

const MUSCLE_GROUPS = [
  'Peito', 'Costas', 'Ombros', 'Bíceps', 'Tríceps', 'Antebraço',
  'Quadríceps', 'Isquiotibiais', 'Glúteos', 'Panturrilha',
  'Core', 'Abdômen', 'Oblíquos', 'Full Body', 'Mobilidade',
]

const PLAN_LABELS = ['Treino A', 'Treino B', 'Treino C', 'Treino D']

function ExerciseForm({ onSave, onCancel }: {
  onSave: (e: Omit<Exercise, 'id'>) => void
  onCancel: () => void
}) {
  const [form, setForm] = useState({ name: '', muscleGroup: 'Peito', sets: 3, reps: '12', rest: '60s', notes: '' })

  function field(k: keyof typeof form, v: string | number) {
    setForm(f => ({ ...f, [k]: v }))
  }

  function handleSave() {
    if (!form.name.trim()) { toast.error('Nome do exercício é obrigatório'); return }
    onSave({ name: form.name.trim(), muscleGroup: form.muscleGroup, sets: Number(form.sets), reps: form.reps, rest: form.rest, notes: form.notes || undefined })
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="bg-gray-50 rounded-xl border border-gray-200 p-4 space-y-3"
    >
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Novo exercício</p>
      <div className="grid grid-cols-1 gap-2.5">
        <input
          type="text"
          placeholder="Nome do exercício (ex: Supino Reto com Barra)"
          value={form.name}
          onChange={e => field('name', e.target.value)}
          className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-gray-300"
        />
        <div className="flex flex-col gap-2.5">
          <select
            value={form.muscleGroup}
            onChange={e => field('muscleGroup', e.target.value)}
            className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-gray-300 min-h-[44px]"
          >
            {MUSCLE_GROUPS.map(g => <option key={g}>{g}</option>)}
          </select>
          <div className="grid grid-cols-3 gap-2">
            <input
              type="number" min={1} max={10} value={form.sets}
              onChange={e => field('sets', e.target.value)}
              className="text-sm px-2 py-2 rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-gray-300 text-center min-h-[44px]"
              placeholder="Séries"
            />
            <input
              type="text" value={form.reps} placeholder="Reps"
              onChange={e => field('reps', e.target.value)}
              className="text-sm px-2 py-2 rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-gray-300 min-h-[44px]"
            />
            <input
              type="text" value={form.rest} placeholder="Descanso"
              onChange={e => field('rest', e.target.value)}
              className="text-sm px-2 py-2 rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-gray-300 min-h-[44px]"
            />
          </div>
        </div>
        <input
          type="text"
          placeholder="Observação (opcional)"
          value={form.notes}
          onChange={e => field('notes', e.target.value)}
          className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-gray-300"
        />
      </div>
      <div className="flex gap-2 pt-1">
        <button
          onClick={handleSave}
          className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-lg text-white transition-colors"
          style={{ background: '#111111' }}
        >
          <Save className="w-3.5 h-3.5" /> Guardar
        </button>
        <button
          onClick={onCancel}
          className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg text-gray-500 bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
        >
          <X className="w-3.5 h-3.5" /> Cancelar
        </button>
      </div>
    </motion.div>
  )
}

export default function TreinoBuilderPage({ params }: { params: Promise<{ alunoId: string }> }) {
  const { alunoId } = use(params)
  const router = useRouter()

  const aluno = db.alunos.find(a => a.id === alunoId) ?? db.alunos[0]

  const [plans, setPlans] = useState<WorkoutPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [activeLabel, setActiveLabel] = useState('Treino A')
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [newFocus, setNewFocus] = useState('')
  const [editingValidity, setEditingValidity] = useState(false)
  const [validityDate, setValidityDate] = useState('')

  useEffect(() => {
    workoutApi.plans(alunoId).then(data => {
      setPlans(data as WorkoutPlan[])
      if (data.length > 0) setActiveLabel(data[0].label)
      setLoading(false)
    })
  }, [alunoId])

  const activePlan = plans.find(p => p.label === activeLabel)
  const existingLabels = plans.map(p => p.label)
  const availableLabels = PLAN_LABELS.filter(l => !existingLabels.includes(l))

  async function handleAddExercise(exercise: Omit<Exercise, 'id'>) {
    if (!activePlan) {
      // Criar plano novo primeiro
      setSaving(true)
      try {
        const novo = await workoutApi.savePlan({
          alunoId, alunoName: aluno.name,
          ptId: db.pts.find(p => p.id === aluno.personalTrainerId)?.id ?? '',
          label: activeLabel, focus: newFocus || activeLabel,
          exercises: [{ ...exercise, id: 'ex-' + uid() }],
        }) as WorkoutPlan
        setPlans(prev => [...prev, novo])
        toast.success('Plano criado!')
      } catch { toast.error('Erro ao criar plano') }
      setSaving(false)
    } else {
      try {
        const novo = await workoutApi.addExercise(activePlan.id, exercise) as Exercise
        setPlans(prev => prev.map(p => p.id === activePlan.id
          ? { ...p, exercises: [...p.exercises, novo] }
          : p
        ))
        toast.success('Exercício adicionado!')
      } catch { toast.error('Erro ao adicionar exercício') }
    }
    setShowForm(false)
  }

  async function handleRemoveExercise(exerciseId: string) {
    if (!activePlan) return
    try {
      await workoutApi.removeExercise(activePlan.id, exerciseId)
      setPlans(prev => prev.map(p => p.id === activePlan.id
        ? { ...p, exercises: p.exercises.filter(e => e.id !== exerciseId) }
        : p
      ))
      toast.success('Exercício removido')
    } catch { toast.error('Erro ao remover exercício') }
  }

  async function handleAddPlan(label: string) {
    setActiveLabel(label)
    setNewFocus('')
    setShowForm(false)
  }

  async function handleSaveValidity() {
    if (!activePlan || !validityDate) return
    try {
      const updated = await workoutApi.updateValidity(activePlan.id, validityDate)
      setPlans(prev => prev.map(p => p.id === activePlan.id ? { ...p, ...updated } as WorkoutPlan : p))
      toast.success('Validade actualizada!')
      setEditingValidity(false)
    } catch { toast.error('Erro ao actualizar validade') }
  }

  function getPlanValidityStatus(validUntil?: string): { label: string; color: string; icon: 'ok' | 'warn' | 'expired' } | null {
    if (!validUntil) return null
    const days = Math.ceil((new Date(validUntil).getTime() - Date.now()) / 86400000)
    if (days < 0) return { label: 'Expirado', color: 'text-red-600 bg-red-50 border-red-200', icon: 'expired' }
    if (days <= 5) return { label: `Expira em ${days}d`, color: 'text-amber-600 bg-amber-50 border-amber-200', icon: 'warn' }
    return { label: `Válido até ${new Date(validUntil).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' })}`, color: 'text-green-600 bg-green-50 border-green-200', icon: 'ok' }
  }

  async function handleDeletePlan() {
    if (!activePlan) return
    if (!confirm(`Apagar "${activePlan.label}" de ${aluno.name}?`)) return
    try {
      await workoutApi.deletePlan(activePlan.id)
      const remaining = plans.filter(p => p.id !== activePlan.id)
      setPlans(remaining)
      setActiveLabel(remaining[0]?.label ?? 'Treino A')
      toast.success('Plano apagado')
    } catch { toast.error('Erro ao apagar plano') }
  }

  return (
    <div className="p-5 lg:p-7 max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-500"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
          style={{ background: avatarColor(aluno.name) }}
        >
          {getInitials(aluno.name)}
        </div>
        <div>
          <h1 className="text-lg font-bold text-gray-900">Treino de {aluno.name}</h1>
          <p className="text-xs text-gray-400">{aluno.personalTrainerName}</p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      ) : (
        <>
          {/* Plan tabs */}
          <div className="flex gap-2 flex-wrap">
            {plans.map(p => (
              <button
                key={p.label}
                onClick={() => { setActiveLabel(p.label); setShowForm(false) }}
                className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all border"
                style={activeLabel === p.label
                  ? { background: '#111111', color: '#fff', borderColor: '#111111' }
                  : { background: '#fff', color: '#374151', borderColor: '#e5e7eb' }
                }
              >
                {p.label}
              </button>
            ))}
            {availableLabels.length > 0 && (
              <button
                onClick={() => { handleAddPlan(availableLabels[0]); }}
                className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all border border-dashed flex items-center gap-1.5 text-gray-400 hover:text-gray-700 hover:border-gray-400"
              >
                <Plus className="w-3.5 h-3.5" />
                {availableLabels[0]}
              </button>
            )}
          </div>

          {/* Active plan */}
          {activePlan ? (
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{activePlan.label}</p>
                  <p className="text-xs text-gray-400">{activePlan.focus}</p>
                  {/* Validity badge */}
                  {(() => {
                    const vs = getPlanValidityStatus(activePlan.validUntil)
                    if (!vs) return (
                      <button
                        onClick={() => { setEditingValidity(true); setValidityDate('') }}
                        className="mt-1.5 flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        <Calendar className="w-3 h-3" /> Definir validade
                      </button>
                    )
                    return (
                      <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${vs.color}`}>
                          {vs.icon === 'ok' && <CheckCircle2 className="w-3 h-3" />}
                          {vs.icon === 'warn' && <AlertTriangle className="w-3 h-3" />}
                          {vs.icon === 'expired' && <AlertTriangle className="w-3 h-3" />}
                          {vs.label}
                        </span>
                        <button
                          onClick={() => { setEditingValidity(true); setValidityDate(activePlan.validUntil ?? '') }}
                          className="text-xs text-gray-400 hover:text-gray-600 transition-colors underline"
                        >
                          alterar
                        </button>
                      </div>
                    )
                  })()}
                  {/* Validity editor */}
                  {editingValidity && (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <DatePicker
                        value={validityDate}
                        onChange={v => setValidityDate(v)}
                        placeholder="Selecionar validade"
                        minDate={new Date().toISOString().slice(0, 10)}
                        className="w-52"
                      />
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleSaveValidity}
                          className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white transition-colors min-h-[36px]"
                          style={{ background: '#111111' }}
                        >
                          Guardar
                        </button>
                        <button
                          onClick={() => setEditingValidity(false)}
                          className="text-xs text-gray-400 hover:text-gray-600 min-h-[36px] px-1"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs text-gray-400">{activePlan.exercises.length} exercícios</span>
                  <button
                    onClick={handleDeletePlan}
                    className="p-1.5 rounded-md text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                    title="Apagar plano"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Exercise list */}
              <div className="space-y-2">
                <AnimatePresence mode="popLayout">
                  {activePlan.exercises.map((ex, i) => (
                    <motion.div
                      key={ex.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 8 }}
                      transition={{ delay: i * 0.03 }}
                      className="bg-white rounded-xl border border-gray-100 px-4 py-3 flex items-start gap-3 group"
                    >
                      <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 text-xs font-bold text-gray-400 bg-gray-50 border border-gray-100">
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900">{ex.name}</p>
                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{ex.muscleGroup}</span>
                          <span className="text-xs text-gray-600 font-medium">{ex.sets}x{ex.reps}</span>
                          <span className="text-xs text-gray-400">descanso: {ex.rest}</span>
                        </div>
                        {ex.notes && (
                          <p className="text-xs text-amber-600 mt-1 bg-amber-50 px-2 py-0.5 rounded-md inline-block">{ex.notes}</p>
                        )}
                      </div>
                      <button
                        onClick={() => handleRemoveExercise(ex.id)}
                        className="p-1.5 rounded-md text-gray-200 hover:text-red-400 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>

                {/* Add exercise form */}
                <AnimatePresence>
                  {showForm && (
                    <ExerciseForm
                      onSave={handleAddExercise}
                      onCancel={() => setShowForm(false)}
                    />
                  )}
                </AnimatePresence>

                {!showForm && (
                  <button
                    onClick={() => setShowForm(true)}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-gray-200 text-sm text-gray-400 hover:text-gray-700 hover:border-gray-400 hover:bg-gray-50 transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    Adicionar exercício
                  </button>
                )}
              </div>
            </div>
          ) : (
            // Novo plano sem exercícios ainda
            <div className="space-y-3">
              <div className="bg-white rounded-xl border border-gray-100 p-5 text-center">
                <Dumbbell className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                <p className="text-sm font-medium text-gray-700">{activeLabel} ainda não tem exercícios</p>
                <p className="text-xs text-gray-400 mt-1">Adiciona o primeiro exercício abaixo</p>
              </div>

              <div className="space-y-2">
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Foco deste treino</label>
                  <input
                    type="text"
                    placeholder="Ex: Superior — Peito e Ombros"
                    value={newFocus}
                    onChange={e => setNewFocus(e.target.value)}
                    className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-gray-300"
                  />
                </div>
                <AnimatePresence>
                  {showForm && (
                    <ExerciseForm
                      onSave={handleAddExercise}
                      onCancel={() => setShowForm(false)}
                    />
                  )}
                </AnimatePresence>
                {!showForm && (
                  <button
                    onClick={() => setShowForm(true)}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-gray-200 text-sm text-gray-400 hover:text-gray-700 hover:border-gray-400 hover:bg-gray-50 transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    Adicionar primeiro exercício
                  </button>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
