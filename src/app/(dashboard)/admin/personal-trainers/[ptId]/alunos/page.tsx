'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { ArrowLeft, Users, Mail } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { adminApi, ptApi } from '@/lib/api'
import { getInitials, avatarColor } from '@/lib/utils'

type Aluno = { id: string; name: string; email: string }
type PtLite = { id: string; name: string; specialty?: string }

export default function AdminPTAlunosPage({ params }: { params: Promise<{ ptId: string }> }) {
  const { ptId } = use(params)
  const router = useRouter()

  const [ptName, setPtName] = useState('Personal Trainer')
  const [ptSpecialty, setPtSpecialty] = useState('')
  const [alunos, setAlunos] = useState<Aluno[]>([])
  const [loading, setLoading] = useState(true)

  // 100% backend real: alunos do PT + nome/especialidade do PT (via lista de
  // PTs). Sem qualquer leitura de mock.
  useEffect(() => {
    Promise.all([
      adminApi.alunosByPt(ptId),
      ptApi.list().catch(() => [] as PtLite[]),
    ]).then(([data, pts]) => {
      setAlunos(data as Aluno[])
      const pt = (pts as PtLite[]).find(p => p.id === ptId)
      if (pt) { setPtName(pt.name); setPtSpecialty(pt.specialty ?? '') }
      setLoading(false)
    }).catch(() => setLoading(false))
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
          <h1 className="text-xl font-bold text-gray-900">Alunos de {ptName}</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {loading ? '—' : alunos.length} aluno{alunos.length !== 1 ? 's' : ''} associado{alunos.length !== 1 ? 's' : ''}
            {ptSpecialty ? ` · ${ptSpecialty}` : ''}
          </p>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      ) : alunos.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl led-gold">
          <Users className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 font-medium text-sm">Nenhum aluno associado a este PT</p>
        </div>
      ) : (
        <div className="space-y-2">
          {alunos.map((aluno, i) => (
            <motion.div
              key={aluno.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-white rounded-xl led-gold px-4 py-4 flex items-center gap-4"
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
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
