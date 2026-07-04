'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Calendar, CheckCircle2, CalendarPlus, Package, CreditCard } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import { StatCard } from '@/components/ui/stat-card'
import { Skeleton } from '@/components/ui/skeleton'
import { CancelBookingDialog } from '@/components/cancel-booking-dialog'
import { dashboardApi, bookingApi } from '@/lib/api'
import { formatDate, formatTime, bookingStatusLabel, bookingStatusColor, cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth'
import type { AlunoDashboard, RecentSession } from '@/types'

function hoursUntil(startTime: string): number {
  return (new Date(startTime).getTime() - Date.now()) / (1000 * 60 * 60)
}

export default function AlunoDashboardPage() {
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const [confirmCancel, setConfirmCancel] = useState<RecentSession | null>(null)

  const { data, isLoading } = useQuery<AlunoDashboard>({
    queryKey: ['aluno-dashboard'],
    queryFn: dashboardApi.aluno,
  })

  const cancelMutation = useMutation({
    mutationFn: bookingApi.cancel,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['aluno-dashboard'] })
      qc.invalidateQueries({ queryKey: ['my-bookings'] })
      qc.invalidateQueries({ queryKey: ['aluno-slots'] })
      toast.success('Sessão cancelada')
      setConfirmCancel(null)
    },
    onError: (e: Error) => toast.error(e.message || 'Não foi possível cancelar esta sessão'),
  })

  return (
    <div className="p-5 lg:p-7 space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-black text-gray-900 tracking-tight">Olá, {user?.name?.split(' ')[0]} 👋</h1>
        {data?.ptName && (
          <p className="text-sm text-gray-400 mt-0.5">O teu Personal Trainer: <span className="font-medium text-gray-600">{data.ptName}</span></p>
        )}
        {data?.ptBillingCycleDay && (
          <p className="text-xs text-gray-300 mt-1">
            Ciclo de pagamento do teu PT com o estúdio fecha todo dia <strong className="text-gray-400">{data.ptBillingCycleDay}</strong> — não afeta as tuas sessões
          </p>
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

      {/* Pack / Contract summary */}
      {!isLoading && data?.pack && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-50 flex items-center gap-2">
              <Package className="w-4 h-4 text-gray-400" />
              <h2 className="text-sm font-semibold text-gray-900">O meu pack</h2>
            </div>
            <div className="grid grid-cols-3 divide-x divide-gray-50">
              <div className="px-4 py-4 text-center">
                <p className="text-2xl font-black text-gray-900">{data.pack.remaining}</p>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mt-0.5">Restantes</p>
                <p className="text-[10px] text-gray-300 mt-0.5">de {data.pack.total}</p>
              </div>
              <div className="px-4 py-4 text-center">
                <p className="text-2xl font-black text-gray-900">{data.pack.sessionDuration}<span className="text-sm font-medium text-gray-400">min</span></p>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mt-0.5">Por sessão</p>
              </div>
              <div className="px-4 py-4 text-center">
                {data.pack.expiresAt ? (
                  <>
                    <p className="text-sm font-black text-gray-900 leading-tight">
                      {new Date(data.pack.expiresAt).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                    </p>
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mt-0.5">Validade</p>
                  </>
                ) : (
                  <p className="text-xs text-gray-400">—</p>
                )}
              </div>
            </div>
            {/* progress bar */}
            <div className="px-5 pb-4">
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all', data.pack.remaining <= 2 ? 'bg-orange-400' : 'bg-emerald-500')}
                  style={{ width: `${Math.round((data.pack.remaining / data.pack.total) * 100)}%` }}
                />
              </div>
              {data.pack.remaining <= 3 && (
                <p className="text-[10px] text-orange-600 font-medium mt-1.5">Pack a acabar — fala com o teu PT para renovar</p>
              )}
            </div>
          </div>
        </motion.div>
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
            {data!.recentSessions.map((s, i) => {
              const cancellable = s.status === 'CONFIRMED' && hoursUntil(s.startTime) > 0
              return (
                <div
                  key={s.bookingId ?? i}
                  onClick={() => cancellable && setConfirmCancel(s)}
                  className={cn(
                    'flex items-center justify-between px-5 py-3.5',
                    cancellable && 'cursor-pointer hover:bg-gray-50 transition-colors'
                  )}
                >
                  <div>
                    <p className="text-sm text-gray-900">{formatDate(s.startTime)}</p>
                    <p className="text-xs text-gray-400">{formatTime(s.startTime)} — {formatTime(s.endTime)}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${bookingStatusColor(s.status)}`}>
                    {bookingStatusLabel(s.status)}
                  </span>
                </div>
              )
            })}
          </div>
          <div className="px-5 py-3 border-t border-gray-50">
            <Link href="/aluno/history" className="text-xs font-medium hover:underline" style={{ color: '#C9A84C' }}>Ver histórico completo →</Link>
          </div>
        </motion.div>
      )}

      {confirmCancel && (
        <CancelBookingDialog
          open={!!confirmCancel}
          onOpenChange={(o) => !o && setConfirmCancel(null)}
          startTime={confirmCancel.startTime}
          endTime={confirmCancel.endTime}
          ptName={confirmCancel.ptName}
          isPending={cancelMutation.isPending}
          onConfirm={() => cancelMutation.mutate(confirmCancel.bookingId)}
        />
      )}
    </div>
  )
}
