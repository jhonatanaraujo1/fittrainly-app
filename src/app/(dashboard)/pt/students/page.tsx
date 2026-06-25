'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Users, UserPlus, X } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { alunoApi } from '@/lib/api'
import { getInitials, avatarColor, formatDate, formatTime } from '@/lib/utils'
import type { Aluno } from '@/types'

function NewStudentDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({ name: '', email: '', phone: '', objetivo: '' })
  const [error, setError] = useState('')

  const create = useMutation({
    mutationFn: () => alunoApi.createByPT(form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pt-students'] })
      onClose()
    },
    onError: (e: Error) => setError(e.message),
  })

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 10 }}
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-bold text-gray-900">Novo Aluno</h2>
            <p className="text-xs text-gray-400 mt-0.5">Vai ficar associado a ti automaticamente</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Nome *</label>
            <input
              value={form.name}
              onChange={set('name')}
              placeholder="Nome completo"
              className="w-full h-11 rounded-lg border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1F3864]/20 focus:border-[#1F3864] transition-colors"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Email *</label>
            <input
              type="email"
              value={form.email}
              onChange={set('email')}
              placeholder="email@exemplo.com"
              className="w-full h-11 rounded-lg border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1F3864]/20 focus:border-[#1F3864] transition-colors"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Telefone</label>
            <input
              type="tel"
              value={form.phone}
              onChange={set('phone')}
              placeholder="+351 9XX XXX XXX"
              className="w-full h-11 rounded-lg border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1F3864]/20 focus:border-[#1F3864] transition-colors"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Objetivo</label>
            <input
              value={form.objetivo}
              onChange={set('objetivo')}
              placeholder="Ex: Perda de peso, hipertrofia…"
              className="w-full h-11 rounded-lg border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1F3864]/20 focus:border-[#1F3864] transition-colors"
            />
          </div>

          {error && <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}

          <div className="bg-[#1F3864]/5 rounded-xl p-3 text-xs text-[#1F3864]/70">
            A password inicial é <strong>aluno123</strong> — o aluno pode alterar no primeiro login.
          </div>
        </div>

        <div className="px-5 pb-5 flex gap-2">
          <button onClick={onClose} className="flex-1 h-11 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
            Cancelar
          </button>
          <button
            onClick={() => create.mutate()}
            disabled={create.isPending || !form.name.trim() || !form.email.trim()}
            className="flex-1 h-11 rounded-xl bg-[#1F3864] text-white text-sm font-semibold hover:bg-[#162c52] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {create.isPending ? (
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.37 0 0 5.37 0 12h4z" /></svg>
            ) : (
              <UserPlus className="w-4 h-4" />
            )}
            {create.isPending ? 'A criar…' : 'Criar aluno'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

export default function PTStudentsPage() {
  const [showNew, setShowNew] = useState(false)

  const { data: students = [], isLoading } = useQuery<(Aluno & { activePack?: unknown })[]>({
    queryKey: ['pt-students'],
    queryFn: alunoApi.myStudents,
  })

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">Os Meus Alunos</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {students.length} aluno{students.length !== 1 ? 's' : ''} associado{students.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#1F3864] text-white text-sm font-semibold rounded-xl hover:bg-[#162c52] transition-colors shadow-sm min-h-[44px]"
        >
          <UserPlus className="w-4 h-4" />
          Novo Aluno
        </button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-36 rounded-xl" />)}
        </div>
      ) : students.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
          <Users className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-600 font-semibold">Ainda sem alunos</p>
          <p className="text-sm text-gray-400 mb-4">Adiciona o teu primeiro aluno agora</p>
          <button
            onClick={() => setShowNew(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#1F3864] text-white text-sm font-semibold rounded-xl hover:bg-[#162c52] transition-colors min-h-[44px]"
          >
            <UserPlus className="w-4 h-4" />
            Adicionar Aluno
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {students.map((s, i) => (
            <motion.div
              key={s.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: i * 0.04 }}
              className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 flex flex-col gap-3"
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full ${avatarColor(s.name)} flex items-center justify-center text-white text-sm font-bold flex-shrink-0`}>
                  {getInitials(s.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm truncate">{s.name}</p>
                  <p className="text-xs text-gray-400 truncate">{s.email}</p>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full border flex-shrink-0 ${s.status === 'ATIVO' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-gray-100 text-gray-400 border-gray-200'}`}>
                  {s.status === 'ATIVO' ? 'Ativo' : s.status === 'INATIVO' ? 'Inativo' : 'Suspenso'}
                </span>
              </div>

              <div className="space-y-1.5 text-xs text-gray-500 border-t border-gray-50 pt-3">
                {s.nextSession ? (
                  <p>📅 <span className="text-gray-700 font-medium">Próx. sessão:</span> {formatDate(s.nextSession)} às {formatTime(s.nextSession)}</p>
                ) : (
                  <p className="text-gray-300">Sem sessão agendada</p>
                )}
                {(s.completedSessions ?? 0) > 0 && (
                  <p>✅ <span className="font-medium">{s.completedSessions}</span> sessões realizadas</p>
                )}
                {s.objetivo && (
                  <p className="text-gray-400 italic truncate">"{s.objetivo}"</p>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* New student dialog */}
      {showNew && <NewStudentDialog onClose={() => setShowNew(false)} />}
    </div>
  )
}
