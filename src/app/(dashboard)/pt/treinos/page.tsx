'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Dumbbell, ChevronRight, CheckCircle2, Clock } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { workoutApi } from '@/lib/api'
import { getInitials, avatarColor } from '@/lib/utils'
import { useAuthStore } from '@/store/auth'
import { db } from '@/lib/mock-db'

interface AlunoItem {
  id: string; name: string; email: string
  personalTrainerId: string; personalTrainerName: string
  planCount: number
}

export default function PTTreinosPage() {
  const { user } = useAuthStore()
  const [alunos, setAlunos] = useState<AlunoItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const pt = db.pts.find(p => p.userId === user?.id) ?? db.pts[0]
    workoutApi.ptAlunos(pt.id).then(data => {
      setAlunos(data as AlunoItem[])
      setLoading(false)
    })
  }, [user])

  const total = alunos.length
  const comPlano = alunos.filter(a => a.planCount > 0).length

  return (
    <div className="p-5 lg:p-7 max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Treinos dos Alunos</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          Monte e gira os planos de treino dos seus alunos
        </p>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-xl border border-gray-100 px-4 py-3 text-center">
          <p className="text-2xl font-bold text-gray-900">{comPlano}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">Com plano de treino</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 px-4 py-3 text-center">
          <p className="text-2xl font-bold text-gray-900">{total - comPlano}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">Sem plano ainda</p>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      ) : (
        <div className="space-y-2">
          {alunos.map((a, i) => (
            <motion.div
              key={a.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Link
                href={`/pt/treinos/${a.id}`}
                className="flex items-center gap-4 bg-white rounded-xl border border-gray-100 px-4 py-3.5 hover:border-gray-200 hover:shadow-sm transition-all group"
              >
                {/* Avatar */}
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                  style={{ background: avatarColor(a.name) }}
                >
                  {getInitials(a.name)}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{a.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{a.email}</p>
                </div>

                {/* Status */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {a.planCount > 0 ? (
                    <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-full">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {a.planCount} {a.planCount === 1 ? 'plano' : 'planos'}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-xs font-medium text-amber-600 bg-amber-50 border border-amber-100 px-2.5 py-1 rounded-full">
                      <Clock className="w-3.5 h-3.5" />
                      Sem plano
                    </span>
                  )}
                  <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors" />
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && alunos.length === 0 && (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
          <Dumbbell className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Nenhum aluno associado</p>
        </div>
      )}
    </div>
  )
}
