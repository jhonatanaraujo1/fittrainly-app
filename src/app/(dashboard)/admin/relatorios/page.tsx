'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { Printer, Clock, Users, Calendar, Euro } from 'lucide-react'
import { billingApi, ptApi } from '@/lib/api'
import { formatCurrency, getInitials, avatarColor, planTypeLabel, withIVA } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import type { BillingEntry } from '@/types'

// Relatório 100% backend real. O mês corrente é a única janela que o backend
// serve de forma agregada (billing por PT + lista de PTs). Não há endpoint de
// histórico semanal / comparativo de 4 semanas — esses gráficos existiam só no
// mock com dados fabricados e foram removidos por serem falsos em produção.
// Quando o backend expuser série histórica de sessões, isto volta como tab.

type PtLite = { id: string; name: string; specialty?: string; active?: boolean }

const currentMonth = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function RelatoriosPage() {
  const month = currentMonth()

  const billingQ = useQuery<{ entries: BillingEntry[]; total: number; month: string }>({
    queryKey: ['billing', month],
    queryFn: () => billingApi.byMonth(month),
  })
  const ptsQ = useQuery<PtLite[]>({
    queryKey: ['pts'],
    queryFn: () => ptApi.list() as unknown as Promise<PtLite[]>,
  })

  const loading = billingQ.isLoading || ptsQ.isLoading
  const entries = billingQ.data?.entries ?? []
  const totalRevenue = billingQ.data?.total ?? 0
  const pts = ptsQ.data ?? []

  // Junta receita/sessões (billing) com especialidade/status (lista de PTs).
  const rows = useMemo(() => {
    const ptById = new Map(pts.map(p => [p.id, p]))
    return entries
      .map(e => ({
        ...e,
        specialty: ptById.get(e.ptId)?.specialty ?? 'Personal Trainer',
        active: ptById.get(e.ptId)?.active ?? true,
      }))
      .sort((a, b) => (b.sessionsCount ?? 0) - (a.sessionsCount ?? 0))
  }, [entries, pts])

  const totalSessions = rows.reduce((s, r) => s + (r.sessionsCount ?? 0), 0)
  const activePTs = pts.filter(p => p.active !== false).length
  const topPT = rows[0]

  const monthLabel = (() => {
    const [y, m] = month.split('-').map(Number)
    const label = new Date(y, m - 1, 1).toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })
    return label.charAt(0).toUpperCase() + label.slice(1)
  })()

  const KPIS = [
    { label: 'Sessões este mês', value: totalSessions, sub: monthLabel, icon: Calendar },
    { label: 'Receita este mês', value: formatCurrency(totalRevenue), sub: `c/ IVA: ${formatCurrency(withIVA(totalRevenue).total)}`, icon: Euro },
    { label: 'PTs activos', value: activePTs, sub: `${rows.length} com faturação`, icon: Users },
    { label: 'PT mais activo', value: topPT?.ptName.split(' ')[0] ?? '—', sub: `${topPT?.sessionsCount ?? 0} sessões`, icon: Clock },
  ]

  return (
    <div className="p-5 lg:p-7 space-y-5 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-black text-gray-900 tracking-tight">Relatórios</h1>
          <p className="text-sm text-gray-400 mt-0.5">Desempenho dos Personal Trainers — {monthLabel}</p>
        </div>
        <a
          href="/relatorio/horas"
          target="_blank"
          rel="noopener"
          className="flex items-center gap-1.5 h-9 px-4 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <Printer className="w-3.5 h-3.5" /> Exportar PDF
        </a>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {KPIS.map(({ label, value, sub, icon: Icon }) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-xl led-gold p-4"
          >
            <div className="flex items-start justify-between mb-2">
              <p className="text-xs text-gray-400 font-medium">{label}</p>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: '#111111' }}>
                <Icon className="w-3.5 h-3.5 text-white" />
              </div>
            </div>
            {loading ? (
              <Skeleton className="h-8 w-20 rounded" />
            ) : (
              <p className="text-2xl font-black text-gray-900 tracking-tight truncate">{value}</p>
            )}
            <p className="text-[11px] mt-1 font-medium text-gray-400 truncate">{sub}</p>
          </motion.div>
        ))}
      </div>

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl led-gold">
          <Calendar className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 font-medium text-sm">Sem dados de faturação para {monthLabel}</p>
          <p className="text-gray-400 text-xs mt-1">Os relatórios aparecem assim que houver sessões registadas no mês.</p>
        </div>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          {/* Chart — sessões por PT no mês */}
          <div className="bg-white rounded-xl led-gold p-5">
            <p className="text-sm font-bold text-gray-900 mb-4">Sessões por Personal Trainer — {monthLabel}</p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={rows.map(r => ({ name: r.ptName.split(' ')[0], Sessões: r.sessionsCount ?? 0 }))}
                barGap={4}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                  formatter={(v) => [`${v} sessões`, '']}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Sessões" fill="#111111" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Table — detalhe por PT */}
          <div className="bg-white rounded-xl led-gold overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="border-b border-gray-100" style={{ background: '#f9fafb' }}>
                  {['Personal Trainer', 'Sessões', 'Receita Gerada', 'Plano', 'Status'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-[11px] font-black text-gray-400 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.ptId ?? i} className={`border-b border-gray-50 last:border-0 ${i % 2 === 0 ? '' : 'bg-gray-50/30'}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-full ${avatarColor(r.ptName)} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                          {getInitials(r.ptName)}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{r.ptName}</p>
                          <p className="text-[11px] text-gray-400">{r.specialty}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-lg font-black text-gray-900">{r.sessionsCount ?? 0}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`font-black text-sm ${r.value >= 150 ? 'text-emerald-700' : r.value >= 80 ? 'text-amber-600' : 'text-gray-700'}`}>
                        {formatCurrency(r.value ?? 0)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[11px] font-medium text-gray-500">{r.planName} · {planTypeLabel(r.planType)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                        r.active ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-100 text-gray-500 border-gray-200'
                      }`}>
                        {r.active ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between flex-wrap gap-2">
              <p className="text-xs text-gray-400 font-medium">Total de {monthLabel}</p>
              <span className="text-sm font-black text-gray-900">
                {totalSessions} sessões · {formatCurrency(totalRevenue)}
              </span>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  )
}
