'use client'

import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Users, Calendar, Clock, Receipt, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { StatCard } from '@/components/ui/stat-card'
import { dashboardApi } from '@/lib/api'
import { formatCurrency, formatTime, formatDate } from '@/lib/utils'
import { useAuthStore } from '@/store/auth'
import type { PTDashboard } from '@/types'

export default function PTDashboardPage() {
  const { user } = useAuthStore()
  const { data, isLoading } = useQuery<PTDashboard>({
    queryKey: ['pt-dashboard'],
    queryFn: dashboardApi.pt,
  })

  const occupancy = (s: { confirmedAlunos: number; maxAlunos: number }) => {
    const pct = (s.confirmedAlunos / s.maxAlunos) * 100
    if (pct >= 100) return 'bg-red-100 text-red-700 border-red-200'
    if (pct >= 75) return 'bg-amber-100 text-amber-700 border-amber-200'
    return 'bg-emerald-100 text-emerald-700 border-emerald-200'
  }

  return (
    <div className="p-5 lg:p-7 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-black text-gray-900 tracking-tight">Olá, {user?.name?.split(' ')[0]} 👋</h1>
        <p className="text-sm text-gray-400 mt-0.5">Aqui está a tua semana</p>
      </motion.div>

      {/* Stats */}
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Meus Alunos" value={data?.stats.totalAlunos ?? 0} icon={Users} iconColor="#C9A84C" delay={0.05} />
          <StatCard title="Sessões Esta Semana" value={data?.stats.sessionsThisWeek ?? 0} icon={Calendar} iconColor="#C9A84C" delay={0.1} />
          <StatCard title="Horas Este Mês" value={`${data?.stats.hoursThisMonth ?? 0}h`} icon={Clock} iconColor="#C9A84C" delay={0.15} />
          <StatCard title="A Pagar" value={formatCurrency(data?.stats.amountDue ?? 0)} subtitle="Este mês" icon={Receipt} iconColor="#C9A84C" delay={0.2} />
        </div>
      )}

      {/* Next sessions */}
      {!isLoading && (data?.nextSessions ?? []).length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
            <h2 className="text-sm font-semibold text-gray-900">Próximas Sessões</h2>
            <Link href="/pt/availability" className="text-xs text-[#2E75B6] flex items-center gap-1 hover:underline">
              Gerir horários <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {data!.nextSessions.map((s, i) => {
              const full = s.confirmedAlunos >= s.maxAlunos
              return (
                <div key={s.availabilityId ?? i} className="flex items-center justify-between px-5 py-3.5">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {formatDate(s.startTime)} — {formatTime(s.startTime)}–{formatTime(s.endTime)}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {s.confirmedAlunos > 0 ? 'Aluno confirmado' : 'Sem confirmação ainda'}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${occupancy(s)}`}>
                    {full ? 'Ocupado' : 'Livre'}
                  </span>
                </div>
              )
            })}
          </div>
        </motion.div>
      )}

      {/* No sessions empty state */}
      {!isLoading && (data?.nextSessions ?? []).length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-amber-50 border border-amber-100 rounded-xl p-5 flex items-start gap-3"
        >
          <span className="text-xl">💡</span>
          <div>
            <p className="text-sm font-medium text-amber-900">Sem sessões agendadas</p>
            <p className="text-xs text-amber-700 mt-0.5">Adiciona disponibilidade para que os teus alunos possam agendar sessões.</p>
            <Link href="/pt/availability" className="text-xs text-amber-800 font-medium underline mt-2 inline-block">
              Gerir disponibilidade →
            </Link>
          </div>
        </motion.div>
      )}
    </div>
  )
}
