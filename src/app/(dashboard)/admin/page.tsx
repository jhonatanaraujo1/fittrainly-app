'use client'

import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Users, UserCheck, Calendar, Clock, ArrowRight, TrendingUp, AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { StatCard } from '@/components/ui/stat-card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { dashboardApi } from '@/lib/api'
import { formatCurrency, getInitials, avatarColor, planTypeLabel, docStatus } from '@/lib/utils'
import { useAuthStore } from '@/store/auth'
import type { AdminDashboard } from '@/types'

function hoursLabel(h: number) {
  const rounded = Math.round(h * 10) / 10
  return `${rounded.toLocaleString('pt-PT')}h`
}

function hoursTrend(thisMonth: number, lastMonth: number) {
  if (lastMonth === 0) return undefined
  const pct = Math.round(((thisMonth - lastMonth) / lastMonth) * 100)
  return { value: pct, label: 'vs mês anterior' }
}

const DAY_LABELS: Record<string, string> = {
  MONDAY: 'Seg', TUESDAY: 'Ter', WEDNESDAY: 'Qua',
  THURSDAY: 'Qui', FRIDAY: 'Sex', SATURDAY: 'Sáb', SUNDAY: 'Dom',
}

export default function AdminDashboardPage() {
  const router = useRouter()
  const { user } = useAuthStore()
  const { data, isLoading } = useQuery<AdminDashboard>({
    queryKey: ['admin-dashboard'],
    queryFn: dashboardApi.admin,
  })

  const { data: pts, isLoading: ptsLoading } = useQuery<PersonalTrainer[]>({
    queryKey: ['admin-pts'],
    queryFn: () => import('@/lib/api').then(m => m.ptApi.list()),
  })

  const occupation = ((data?.stats?.sessionsThisWeek ?? 0) / Math.max((data?.occupationByDay?.reduce((s, d) => s + d.occupied + d.available, 0) ?? 1), 1)) * 100

  // Documentação a expirar/vencida — o admin precisa de ver isto sem ter de
  // entrar em cada PT individualmente.
  const docAlerts = (pts ?? []).flatMap(pt => {
    const alerts: { pt: PersonalTrainer; label: string; doc: NonNullable<ReturnType<typeof docStatus>> }[] = []
    const teef = docStatus(pt.teefValidUntil)
    if (teef && teef.status !== 'ok') alerts.push({ pt, label: 'TEEF', doc: teef })
    const insurance = docStatus(pt.insuranceValidUntil)
    if (insurance && insurance.status !== 'ok') alerts.push({ pt, label: 'Seguro', doc: insurance })
    return alerts
  }).sort((a, b) => a.doc.daysLeft - b.doc.daysLeft)

  const chartData = (data?.occupationByDay ?? []).map(d => ({
    name: DAY_LABELS[d.day] ?? d.day,
    Sessões: d.occupied,
    Capacidade: d.available,
  }))

  return (
    <div className="p-5 lg:p-7 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <h1 className="text-2xl font-black text-gray-900 tracking-tight">
          Bem-vindo, {user?.name?.split(' ')[0]} 👋
        </h1>
        <p className="text-sm text-gray-400 mt-0.5">
          {new Date().toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </motion.div>

      {/* Alerta de documentação — TEEF/seguro a vencer ou vencidos */}
      {docAlerts.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
          className="rounded-lg border border-amber-200 bg-amber-50 px-5 py-3.5 space-y-2"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <p className="text-sm font-semibold text-amber-800">
              {docAlerts.length} documento{docAlerts.length !== 1 ? 's' : ''} de PT a precisar de atenção
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {docAlerts.map(({ pt, label, doc }) => (
              <Link
                key={`${pt.id}-${label}`}
                href={`/admin/personal-trainers/${pt.id}`}
                className={`text-xs font-medium px-2.5 py-1 rounded-full border transition-colors min-h-[44px] flex items-center ${
                  doc.status === 'expired'
                    ? 'bg-red-100 text-red-700 border-red-200 hover:bg-red-200'
                    : 'bg-white text-amber-700 border-amber-200 hover:bg-amber-100'
                }`}
              >
                {pt.name} — {label} {doc.status === 'expired' ? `vencido há ${Math.abs(doc.daysLeft)}d` : `vence em ${doc.daysLeft}d`}
              </Link>
            ))}
          </div>
        </motion.div>
      )}

      {/* Insight banner */}
      {data && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="rounded-lg px-5 py-3.5 flex items-center gap-3"
          style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <TrendingUp className="w-4 h-4 flex-shrink-0" style={{ color: '#C9A84C' }} />
          <p className="text-sm text-white/80">
            {occupation > 70
              ? `Estúdio com alta procura esta semana — ${Math.round(occupation)}% de ocupação`
              : `${hoursLabel(data.stats.hoursThisMonth)} agendadas este mês · receita estimada ${formatCurrency(data.stats.estimatedRevenue)}`}
          </p>
        </motion.div>
      )}

      {/* Stat Cards */}
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="PTs Ativos"
            value={data?.stats.activePTs ?? 0}
            icon={Users}
            iconColor="#C9A84C"
            delay={0.05}
          />
          <StatCard
            title="Total de Alunos"
            value={data?.stats.totalAlunos ?? 0}
            icon={UserCheck}
            iconColor="#C9A84C"
            delay={0.1}
          />
          <StatCard
            title="Sessões Esta Semana"
            value={data?.stats.sessionsThisWeek ?? 0}
            icon={Calendar}
            iconColor="#C9A84C"
            delay={0.15}
          />
          <StatCard
            title="Horas Agendadas"
            value={hoursLabel(data?.stats.hoursThisMonth ?? 0)}
            subtitle="Este mês"
            icon={Clock}
            iconColor="#C9A84C"
            trend={hoursTrend(data?.stats.hoursThisMonth ?? 0, data?.stats.hoursLastMonth ?? 0)}
            delay={0.2}
          />
        </div>
      )}

      {/* Chart */}
      {!isLoading && chartData.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.25 }}
          className="bg-white rounded-xl p-5 shadow-sm border border-gray-100"
        >
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Ocupação por Dia — Esta Semana</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                labelStyle={{ fontWeight: 600, fontSize: 12 }}
                itemStyle={{ fontSize: 12 }}
              />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
              <Bar dataKey="Sessões" fill="#111111" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Capacidade" fill="#E5E7EB" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      )}

      {/* PT Table */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
        className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
          <h2 className="text-sm font-semibold text-gray-900">Personal Trainers</h2>
          <Link href="/admin/personal-trainers" className="text-xs text-[#C9A84C] flex items-center gap-1 hover:underline">
            Ver todos <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        {ptsLoading ? (
          <div className="p-5 space-y-3">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 bg-gray-50">
                  <th className="text-left px-5 py-3 font-medium">Personal Trainer</th>
                  <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Especialidade</th>
                  <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Plano</th>
                  <th className="text-left px-4 py-3 font-medium">Alunos</th>
                  <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {(pts ?? []).map((pt: PersonalTrainer) => (
                  <tr key={pt.id} className="hover:bg-gray-50 transition-colors group cursor-pointer"
                    onClick={() => router.push(`/admin/personal-trainers/${pt.id}`)}>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full ${avatarColor(pt.name)} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                          {getInitials(pt.name)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 text-sm truncate">{pt.name}</p>
                          <p className="text-xs text-gray-400 truncate">{pt.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 hidden md:table-cell">
                      <span className="text-gray-600 text-xs">{pt.specialty ?? '—'}</span>
                    </td>
                    <td className="px-4 py-3.5 hidden lg:table-cell">
                      {pt.plan ? (
                        <span className="text-xs px-2 py-0.5 rounded-full text-[#7D6229] border border-[#C9A84C]/20" style={{ background: 'rgba(201,168,76,0.1)' }}>
                          {planTypeLabel(pt.plan.type)}
                        </span>
                      ) : <span className="text-gray-300 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="text-gray-700 font-medium">{pt.alunoCount}</span>
                    </td>
                    <td className="px-4 py-3.5 hidden md:table-cell">
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${pt.active ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-gray-100 text-gray-400 border-gray-200'}`}>
                        {pt.active ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>
    </div>
  )
}

// type inside file to avoid import cycle
interface PersonalTrainer {
  id: string; userId: string; name: string; email: string
  specialty?: string; active: boolean; alunoCount: number
  plan?: { id: string; name: string; type: string }
  sessionsThisMonth?: number
  teefValidUntil?: string
  insuranceValidUntil?: string
}
