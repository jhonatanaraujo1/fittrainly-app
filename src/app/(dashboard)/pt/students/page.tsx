'use client'

import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Users } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { alunoApi } from '@/lib/api'
import { getInitials, avatarColor, formatDate, formatTime } from '@/lib/utils'
import type { Aluno } from '@/types'

export default function PTStudentsPage() {
  const { data: students = [], isLoading } = useQuery<Aluno[]>({
    queryKey: ['pt-students'],
    queryFn: alunoApi.myStudents,
  })

  return (
    <div className="p-5 lg:p-7 space-y-5 max-w-5xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Os Meus Alunos</h1>
        <p className="text-sm text-gray-400 mt-0.5">{students.length} aluno{students.length !== 1 ? 's' : ''} activo{students.length !== 1 ? 's' : ''}</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-36 rounded-xl" />)}
        </div>
      ) : students.length === 0 ? (
        <div className="text-center py-16">
          <Users className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Ainda sem alunos</p>
          <p className="text-sm text-gray-400">O admin pode adicionar alunos associados a ti</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {students.map((s, i) => (
            <motion.div
              key={s.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
              className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 flex flex-col gap-3"
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full ${avatarColor(s.name)} flex items-center justify-center text-white text-sm font-bold flex-shrink-0`}>
                  {getInitials(s.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm">{s.name}</p>
                  <p className="text-xs text-gray-400 truncate">{s.email}</p>
                </div>
              </div>

              <div className="space-y-1.5 text-xs text-gray-500 border-t border-gray-50 pt-3">
                {s.nextSession ? (
                  <p>📅 <span className="text-gray-700">Próx. sessão:</span> {formatDate(s.nextSession)} às {formatTime(s.nextSession)}</p>
                ) : (
                  <p className="text-gray-300">Sem sessão agendada</p>
                )}
                {(s.completedSessions ?? 0) > 0 && (
                  <p>✅ {s.completedSessions} sessõe{s.completedSessions !== 1 ? 's' : 'e'} realizada{s.completedSessions !== 1 ? 's' : ''}</p>
                )}
              </div>

              <div className="flex justify-end">
                <span className={`text-[11px] px-2 py-0.5 rounded-full border ${s.nextSession ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-gray-100 text-gray-400 border-gray-200'}`}>
                  {s.nextSession ? 'Ativo esta semana' : 'Sem agendamento'}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
