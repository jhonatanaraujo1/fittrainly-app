'use client'

import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Calendar, CheckCircle2, CalendarPlus } from 'lucide-react'
import Link from 'next/link'
import { StatCard } from '@/components/ui/stat-card'
import { Skeleton } from '@/components/ui/skeleton'
import { dashboardApi } from '@/lib/api'
import { formatDate, formatTime, bookingStatusLabel, bookingStatusColor } from '@/lib/utils'
import { useAuthStore } from '@/store/auth'
import type { AlunoDashboard } from '@/types'

export default function AlunoDashboardPage() {
  const { user } = useAuthStore()
  const { data, isLoading } = useQuery<AlunoDashboard>({
    queryKey: ['aluno-dashboard'],
    queryFn: dashboardApi.aluno,
  })

  return (
    <div className="p-5 lg:p-7 space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-black text-gray-900 tracking-tight">Olá, {user?.name?.split(' ')[0]} 👋</h1>
        {data?.ptName && (
          <p className="text-sm text-gray-400 mt-0.5">O teu Personal Trainer: <span className="font-medium text-gray-600">{data.ptName}</span></p>
        )}
      </motion.div>

      {/* Next session banner */}
      {!isLoading && (
        <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.05 }}>
          {data?.nextSession ? (
            <div className="rounded-xl p-5 text-white" style={{ background: '#111111' }}>
              <p className="text-white/60 text-xs font-medium uppercase tracking-wide mb-3">Próxima Sessão</p>
              <p className="text-2xl font-bold">{formatDate(data.nextSession.startTime)}</p>
              <p className="text-white/80 mt-1">{formatTime(data.nextSession.startTime)} — {formatTime(data.nextSession.endTime)}</p>
              <div className="mt-3 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#C9A84C' }} />
                <span className="text-sm text-white/70">Confirmada com {data.ptName}</span>
              </div>
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                <CalendarPlus className="w-5 h-5 text-amber-600" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-amber-900 text-sm">Agenda a tua próxima sessão</p>
                <p className="text-xs text-amber-700 mt-0.5">Escolhe um slot disponível com o teu PT</p>
              </div>
              <Link
                href="/aluno/book"
                className="text-xs bg-amber-600 hover:bg-amber-700 text-white font-medium px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
              >
                Agendar →
              </Link>
            </div>
          )}
        </motion.div>
      )}

      {/* Stats */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-4">
          {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <StatCard title="Sessões Agendadas" value={data?.upcomingCount ?? 0} icon={Calendar} iconColor="#C9A84C" delay={0.1} />
          <StatCard title="Sessões Realizadas" value={data?.completedCount ?? 0} icon={CheckCircle2} iconColor="#C9A84C" delay={0.15} />
        </div>
      )}

      {/* Recent sessions */}
      {!isLoading && (data?.recentSessions ?? []).length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"
        >
          <h2 className="text-sm font-semibold text-gray-900 px-5 py-4 border-b border-gray-50">Últimas Sessões</h2>
          <div className="divide-y divide-gray-50">
            {data!.recentSessions.map((s, i) => (
              <div key={s.bookingId ?? i} className="flex items-center justify-between px-5 py-3.5">
                <div>
                  <p className="text-sm text-gray-900">{formatDate(s.startTime)}</p>
                  <p className="text-xs text-gray-400">{formatTime(s.startTime)} — {formatTime(s.endTime)}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${bookingStatusColor(s.status)}`}>
                  {bookingStatusLabel(s.status)}
                </span>
              </div>
            ))}
          </div>
          <div className="px-5 py-3 border-t border-gray-50">
            <Link href="/aluno/history" className="text-xs font-medium hover:underline" style={{ color: '#C9A84C' }}>Ver histórico completo →</Link>
          </div>
        </motion.div>
      )}
    </div>
  )
}
