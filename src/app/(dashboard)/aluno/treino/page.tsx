'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Dumbbell, Clock, RotateCcw, CheckCircle2 } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { workoutApi } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { db } from '@/lib/mock-db'
import type { WorkoutPlan } from '@/types'

const MUSCLE_COLORS: Record<string, string> = {
  'Peito': '#2563EB', 'Costas': '#7C3AED', 'Ombros': '#0891B2',
  'Bíceps': '#EA580C', 'Tríceps': '#EA580C', 'Antebraço': '#EA580C',
  'Quadríceps': '#16A34A', 'Isquiotibiais': '#16A34A', 'Glúteos': '#16A34A',
  'Panturrilha': '#16A34A', 'Core': '#DC2626', 'Abdômen': '#DC2626',
  'Oblíquos': '#DC2626', 'Full Body': '#111111', 'Mobilidade': '#475569',
  'Coluna': '#475569', 'Core/Estabilidade': '#DC2626', 'Peito/Tríceps': '#EA580C',
}

function muscleColor(group: string) {
  return MUSCLE_COLORS[group] ?? '#6B7280'
}

export default function AlunoTreinoPage() {
  const { user } = useAuthStore()
  const [plans, setPlans] = useState<WorkoutPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [activeLabel, setActiveLabel] = useState('')
  const [done, setDone] = useState<Record<string, boolean>>({})

  useEffect(() => {
    const aluno = db.alunos.find(a => a.userId === user?.id) ?? db.alunos[0]
    workoutApi.plans(aluno.id).then(data => {
      const p = data as WorkoutPlan[]
      setPlans(p)
      if (p.length > 0) setActiveLabel(p[0].label)
      setLoading(false)
    })
  }, [user])

  function toggleDone(exerciseId: string) {
    setDone(prev => ({ ...prev, [exerciseId]: !prev[exerciseId] }))
  }

  function resetAll() {
    setDone({})
  }

  const activePlan = plans.find(p => p.label === activeLabel)
  const doneCount = activePlan?.exercises.filter(e => done[e.id]).length ?? 0
  const totalCount = activePlan?.exercises.length ?? 0
  const progress = totalCount > 0 ? doneCount / totalCount : 0

  return (
    <div className="p-5 lg:p-7 max-w-xl mx-auto space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Meu Treino</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          Plano de treino definido pelo teu personal trainer
        </p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      ) : plans.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl led-gold">
          <Dumbbell className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 font-medium text-sm">O teu treino ainda não foi montado</p>
          <p className="text-gray-400 text-xs mt-1">Fala com o teu personal trainer</p>
        </div>
      ) : (
        <>
          {/* Plan tabs */}
          <div className="flex gap-2 flex-wrap">
            {plans.map(p => (
              <button
                key={p.label}
                onClick={() => { setActiveLabel(p.label); setDone({}) }}
                className="px-4 py-2 rounded-xl text-sm font-semibold transition-all border"
                style={activeLabel === p.label
                  ? { background: '#111111', color: '#fff', borderColor: '#111111' }
                  : { background: '#fff', color: '#374151', borderColor: '#e5e7eb' }
                }
              >
                {p.label}
              </button>
            ))}
          </div>

          {activePlan && (
            <div className="space-y-4">
              {/* Plan info + progress */}
              <div className="bg-white rounded-xl led-gold p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold text-gray-900">{activePlan.label}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{activePlan.focus}</p>
                  </div>
                  {doneCount > 0 && (
                    <button
                      onClick={resetAll}
                      className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Resetar
                    </button>
                  )}
                </div>

                {/* Progress bar */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">{doneCount}/{totalCount} concluídos</span>
                    {progress === 1 && (
                      <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Treino completo!
                      </span>
                    )}
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: '#111111' }}
                      animate={{ width: `${progress * 100}%` }}
                      transition={{ type: 'spring', stiffness: 200, damping: 30 }}
                    />
                  </div>
                </div>
              </div>

              {/* Exercise list */}
              <div className="space-y-2">
                <AnimatePresence>
                  {activePlan.exercises.map((ex, i) => {
                    const isDone = done[ex.id]
                    return (
                      <motion.button
                        key={ex.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.04 }}
                        onClick={() => toggleDone(ex.id)}
                        className="w-full text-left bg-white rounded-xl border transition-all"
                        style={{
                          borderColor: isDone ? '#d1fae5' : '#f3f4f6',
                          background: isDone ? '#f0fdf4' : '#fff',
                          opacity: isDone ? 0.75 : 1,
                        }}
                      >
                        <div className="flex items-start gap-3 px-4 py-3.5">
                          {/* Check circle */}
                          <div
                            className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors"
                            style={{
                              borderColor: isDone ? '#10b981' : '#d1d5db',
                              background: isDone ? '#10b981' : 'transparent',
                            }}
                          >
                            {isDone && <CheckCircle2 className="w-3 h-3 text-white" />}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-semibold transition-colors ${isDone ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                              {ex.name}
                            </p>

                            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                              {/* Muscle tag */}
                              <span
                                className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md text-white"
                                style={{ background: muscleColor(ex.muscleGroup) }}
                              >
                                {ex.muscleGroup}
                              </span>

                              {/* Sets x reps */}
                              <span className="flex items-center gap-1 text-xs font-bold text-gray-700">
                                <Dumbbell className="w-3 h-3 text-gray-400" />
                                {ex.sets} × {ex.reps}
                              </span>

                              {/* Rest */}
                              <span className="flex items-center gap-1 text-xs text-gray-400">
                                <Clock className="w-3 h-3" />
                                {ex.rest}
                              </span>
                            </div>

                            {ex.notes && (
                              <p className="text-xs text-amber-600 mt-1.5 bg-amber-50 border border-amber-100 px-2 py-1 rounded-md">
                                💡 {ex.notes}
                              </p>
                            )}
                          </div>

                          {/* Series counter */}
                          <div className="flex-shrink-0 text-center">
                            <p className="text-lg font-black text-gray-900">{ex.sets}</p>
                            <p className="text-[9px] text-gray-400 uppercase tracking-wide leading-none">séries</p>
                          </div>
                        </div>
                      </motion.button>
                    )
                  })}
                </AnimatePresence>
              </div>

              {/* Footer note */}
              <p className="text-center text-xs text-gray-300 pb-2">
                Toca num exercício para marcar como concluído
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
