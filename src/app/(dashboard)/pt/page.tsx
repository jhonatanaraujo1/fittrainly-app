'use client'

import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Users, Calendar, Clock, Receipt } from 'lucide-react'
import { StatCard } from '@/components/ui/stat-card'
import { Skeleton } from '@/components/ui/skeleton'
import { PTAgendaViewer } from '@/components/pt-agenda-viewer'
import { dashboardApi } from '@/lib/api'
import { formatCurrency, withIVA } from '@/lib/utils'
import { useAuthStore } from '@/store/auth'
import type { PTDashboard } from '@/types'

export default function PTDashboardPage() {
  const { user } = useAuthStore()
  const { data, isLoading } = useQuery<PTDashboard>({
    queryKey: ['pt-dashboard'],
    queryFn: dashboardApi.pt,
  })

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
          Olá, {user?.name?.split(' ')[0]} 👋
        </h1>
        <p className="text-sm text-gray-400 mt-0.5">Aqui está a tua semana</p>
      </motion.div>

      {/* Stats */}
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatCard title="Meus Alunos" value={data?.stats.totalAlunos ?? 0} icon={Users} iconColor="#C9A84C" delay={0.05} />
          <StatCard title="Sessões Esta Semana" value={data?.stats.sessionsThisWeek ?? 0} icon={Calendar} iconColor="#C9A84C" delay={0.1} />
          <StatCard title="Horas Este Mês" value={`${data?.stats.hoursThisMonth ?? 0}h`} icon={Clock} iconColor="#C9A84C" delay={0.15} />
          <StatCard
            title="A Pagar"
            value={formatCurrency(data?.stats.amountDue ?? 0)}
            subtitle={`s/ IVA · c/ IVA: ${formatCurrency(withIVA(data?.stats.amountDue ?? 0).total)}`}
            icon={Receipt}
            iconColor="#C9A84C"
            delay={0.2}
          />
        </div>
      )}

      {/* Same agenda widget as "Minha Agenda" — marcações + horários disponíveis */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
        <PTAgendaViewer />
      </motion.div>
    </div>
  )
}
