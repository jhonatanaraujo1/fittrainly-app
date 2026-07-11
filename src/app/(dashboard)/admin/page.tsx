'use client'

import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Users, UserCheck, Calendar, Clock, ArrowRight, TrendingUp, AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
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
    <div className="p-5 lg:p-7 space-y-5 max-w-7xl mx-auto">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <h1 className="text-xl font-black text-gray-900 tracking-tight">
          Bem-vindo, <span style={{ color: '#C9A84C' }}>{user?.name?.split(' ')[0]}</span>
        </h1>
        <p className="text-xs text-gray-400 mt-0.5 capitalize">
          {new Date().toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </motion.div>

      {/* Alerta de documentação — TEEF/seguro a vencer ou vencidos */}
      {docAlerts.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.05 }}
          className="rounded-xl px-4 py-3 space-y-2 bg-amber-50 border border-amber-200"
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
                className={`text-xs font-medium px-2.5 py-1 rounded-full border transition-colors min-h-[36px] flex items-center ${
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

      {/* Insight banner — destaque com borda LED que respira */}
      {data && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3, delay: 0.1 }}
          className="led-gold-pulse rounded-xl px-4 py-3 flex items-center gap-3 bg-white"
        >
          <TrendingUp className="w-4 h-4 flex-shrink-0" style={{ color: '#C9A84C' }} />
          <p className="text-sm text-gray-700">
            {occupation > 70
              ? `Estúdio com alta procura esta semana — ${Math.round(occupation)}% de ocupação`
              : `${hoursLabel(data.stats.hoursThisMonth)} agendadas este mês · receita estimada ${formatCurrency(data.stats.estimatedRevenue)}`}
          </p>
        </motion.div>
      )}

      {/* Stat Cards — borda LED dourada (tema via .dark override) */}
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <div key={i} className="h-28 rounded-xl bg-gray-100 animate-pulse" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { title: 'PTs Ativos', value: data?.stats.activePTs ?? 0, icon: Users },
            { title: 'Total de Alunos', value: data?.stats.totalAlunos ?? 0, icon: UserCheck },
            { title: 'Sessões Esta Semana', value: data?.stats.sessionsThisWeek ?? 0, icon: Calendar },
            { title: 'Horas Agendadas', value: hoursLabel(data?.stats.hoursThisMonth ?? 0), sub: 'Este mês', icon: Clock,
              trend: hoursTrend(data?.stats.hoursThisMonth ?? 0, data?.stats.hoursLastMonth ?? 0) },
          ].map((s, i) => {
            const Icon = s.icon
            return (
              <motion.div
                key={s.title}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.05 * i }}
                className="led-gold rounded-xl bg-white p-4"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] uppercase tracking-[0.08em] text-gray-400 font-medium">{s.title}</span>
                  <Icon className="w-4 h-4 flex-shrink-0" style={{ color: '#C9A84C' }} />
                </div>
                <p className="text-2xl font-black text-gray-900 tabular-nums leading-none">{s.value}</p>
                {s.sub && <p className="text-[10px] text-gray-300 mt-1.5">{s.sub}</p>}
                {s.trend && (
                  <p className={`text-[11px] mt-1.5 font-medium ${s.trend.value >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {s.trend.value >= 0 ? '↑' : '↓'} {Math.abs(s.trend.value)}% <span className="text-gray-400 font-normal">{s.trend.label}</span>
                  </p>
                )}
              </motion.div>
            )
          })}
        </div>
      )}

      {/* Chart — barras douradas, cores neutras que funcionam claro/escuro */}
      {!isLoading && chartData.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.25 }}
          className="led-gold rounded-xl p-5 bg-white"
        >
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Ocupação por Dia — Esta Semana</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.15)" />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
              <Tooltip
                cursor={{ fill: 'rgba(128,128,128,0.08)' }}
                contentStyle={{ borderRadius: 8, border: '1px solid rgba(201,168,76,0.35)', background: '#1a1a1a', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}
                labelStyle={{ fontWeight: 600, fontSize: 12, color: '#fff' }}
                itemStyle={{ fontSize: 12, color: 'rgba(255,255,255,0.85)' }}
              />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8, color: '#9CA3AF' }} />
              <Bar dataKey="Sessões" fill="#C9A84C" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Capacidade" fill="#9CA3AF" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      )}

      {/* PT Table */}
      <motion.div
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.3 }}
        className="led-gold rounded-xl bg-white overflow-hidden"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Personal Trainers</h2>
          <Link href="/admin/personal-trainers" className="text-xs flex items-center gap-1 hover:underline" style={{ color: '#C9A84C' }}>
            Ver todos <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        {ptsLoading ? (
          <div className="p-5 space-y-3">
            {[...Array(3)].map((_, i) => <div key={i} className="h-12 rounded-lg bg-gray-100 animate-pulse" />)}
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
                  <tr key={pt.id} className="hover:bg-gray-50 transition-colors cursor-pointer"
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
                        <span className="text-xs px-2 py-0.5 rounded-full border" style={{ color: '#C9A84C', background: 'rgba(201,168,76,0.1)', borderColor: 'rgba(201,168,76,0.25)' }}>
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
