'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { ArrowLeft, Users, Mail, Dumbbell, CalendarCheck } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { adminApi } from '@/lib/api'
import { db } from '@/lib/mock-db'
import { getInitials, avatarColor } from '@/lib/utils'

export default function AdminPTAlunosPage({ params }: { params: Promise<{ ptId: string }> }) {
  const { ptId } = use(params)
  const router = useRouter()

  const pt = db.pts.find(p => p.id === ptId)
  const [alunos, setAlunos] = useState<typeof db.alunos>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    adminApi.alunosByPt(ptId).then(data => {
      setAlunos(data)
      setLoading(false)
    })
  }, [ptId])

  return (
    <div className="p-5 lg:p-7 max-w-3xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-500"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            Alunos de {pt?.name ?? 'Personal Trainer'}
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {loading ? '—' : alunos.length} aluno{alunos.length !== 1 ? 's' : ''} associado{alunos.length !== 1 ? 's' : ''}
            {pt?.specialty ? ` · ${pt.specialty}` : ''}
          </p>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      ) : alunos.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-gray-100">
          <Users className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 font-medium text-sm">Nenhum aluno associado a este PT</p>
        </div>
      ) : (
        <div className="space-y-2">
          {alunos.map((aluno, i) => {
            const planCount = db.workoutPlans.filter(p => p.alunoId === aluno.id).length
            const sessionCount = db.bookings.filter(
              b => b.alunoId === aluno.id && b.status === 'COMPLETED'
            ).length

            return (
              <motion.div
                key={aluno.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-white rounded-xl border border-gray-100 px-4 py-4 flex items-center gap-4"
              >
                {/* Avatar */}
                <div
                  className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                  style={{ background: avatarColor(aluno.name) }}
                >
                  {getInitials(aluno.name)}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{aluno.name}</p>
                  <div className="flex items-center gap-1 mt-0.5 text-xs text-gray-400">
                    <Mail className="w-3 h-3" />
                    <span className="truncate">{aluno.email}</span>
                  </div>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-4 flex-shrink-0">
                  <div className="text-center">
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <Dumbbell className="w-3.5 h-3.5 text-gray-400" />
                      <span className="font-semibold text-gray-900">{planCount}</span>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      {planCount === 1 ? 'plano' : 'planos'}
                    </p>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <CalendarCheck className="w-3.5 h-3.5 text-gray-400" />
                      <span className="font-semibold text-gray-900">{sessionCount}</span>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-0.5">sessões</p>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
