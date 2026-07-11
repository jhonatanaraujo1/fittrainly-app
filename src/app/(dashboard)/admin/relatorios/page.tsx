'use client'

import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  subWeeks, subMonths, parseISO, format, differenceInCalendarWeeks,
  eachWeekOfInterval, addDays,
} from 'date-fns'
import { pt } from 'date-fns/locale'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, Cell,
} from 'recharts'
import { Printer, TrendingUp, TrendingDown, Minus, Clock, Users, Calendar } from 'lucide-react'
import { db } from '@/lib/mock-db'
import { getInitials, avatarColor } from '@/lib/utils'

// ── helpers ────────────────────────────────────────────────────────────────────

function sessionsInRange(ptId: string, start: Date, end: Date) {
  return db.bookings.filter(b =>
    b.personalTrainerId === ptId &&
    (b.status === 'CONFIRMED' || b.status === 'COMPLETED') &&
    new Date(b.startTime) >= start && new Date(b.startTime) <= end
  ).length
}

function weekLabel(date: Date) {
  return format(startOfWeek(date, { weekStartsOn: 1 }), 'd MMM', { locale: pt })
}

const PT_COLORS = ['#111111', '#2E75B6', '#C9A84C', '#375623', '#e11d48']

type Tab = 'semana' | 'mes' | 'comparativo'

// ── component ──────────────────────────────────────────────────────────────────

export default function RelatoriosPage() {
  const [tab, setTab] = useState<Tab>('semana')
  const now = new Date()

  // ── weekly data ──
  const weekData = useMemo(() => {
    const thisWeekStart = startOfWeek(now, { weekStartsOn: 1 })
    const thisWeekEnd = endOfWeek(now, { weekStartsOn: 1 })
    const lastWeekStart = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 })
    const lastWeekEnd = endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 })

    return db.pts.filter(p => p.active).map(p => {
      const thisWeek = sessionsInRange(p.id, thisWeekStart, thisWeekEnd)
      const lastWeek = sessionsInRange(p.id, lastWeekStart, lastWeekEnd)
      const delta = thisWeek - lastWeek
      return { pt: p, thisWeek, lastWeek, delta }
    }).sort((a, b) => b.thisWeek - a.thisWeek)
  }, [])

  // ── monthly data ──
  const monthData = useMemo(() => {
    const thisMonthStart = startOfMonth(now)
    const thisMonthEnd = endOfMonth(now)
    const lastMonthStart = startOfMonth(subMonths(now, 1))
    const lastMonthEnd = endOfMonth(subMonths(now, 1))

    return db.pts.filter(p => p.active).map(p => {
      const plan = db.plans.find(pl => pl.id === p.planId)
      const thisMonth = sessionsInRange(p.id, thisMonthStart, thisMonthEnd)
      const lastMonth = sessionsInRange(p.id, lastMonthStart, lastMonthEnd)
      const delta = thisMonth - lastMonth
      const valor = !plan ? 0
        : plan.type === 'MONTHLY' ? (plan.priceMonthly ?? 0)
        : plan.type === 'WEEKLY' ? (plan.priceWeekly ?? 0) * 4
        : (plan.priceHourly ?? 0) * p.hoursThisMonth
      return { pt: p, thisMonth, lastMonth, delta, valor }
    }).sort((a, b) => b.thisMonth - a.thisMonth)
  }, [])

  // ── comparative: last 4 weeks per PT ──
  const compData = useMemo(() => {
    const weeks = Array.from({ length: 4 }, (_, i) => {
      const ref = subWeeks(now, 3 - i)
      return {
        label: i === 3 ? 'Esta sem.' : `Sem. ${weekLabel(ref)}`,
        start: startOfWeek(ref, { weekStartsOn: 1 }),
        end: endOfWeek(ref, { weekStartsOn: 1 }),
      }
    })

    const pts = db.pts.filter(p => p.active)
    const chartRows = weeks.map(w => {
      const row: Record<string, string | number> = { label: w.label }
      pts.forEach(p => {
        row[p.name.split(' ')[0]] = sessionsInRange(p.id, w.start, w.end)
      })
      return row
    })

    const ptLines = pts.map((p, i) => ({
      key: p.name.split(' ')[0],
      color: PT_COLORS[i % PT_COLORS.length],
    }))

    // per PT: last 4 weeks total
    const ptSummary = pts.map(p => ({
      pt: p,
      weeks: weeks.map(w => sessionsInRange(p.id, w.start, w.end)),
    }))

    return { chartRows, ptLines, ptSummary, weekLabels: weeks.map(w => w.label) }
  }, [])

  // ── totals ──
  const totalThisWeek = weekData.reduce((s, d) => s + d.thisWeek, 0)
  const totalLastWeek = weekData.reduce((s, d) => s + d.lastWeek, 0)
  const totalThisMonth = monthData.reduce((s, d) => s + d.thisMonth, 0)
  const totalLastMonth = monthData.reduce((s, d) => s + d.lastMonth, 0)

  const TABS: { key: Tab; label: string }[] = [
    { key: 'semana', label: 'Esta Semana' },
    { key: 'mes', label: 'Este Mês' },
    { key: 'comparativo', label: 'Comparativo 4 Semanas' },
  ]

  function DeltaBadge({ delta }: { delta: number }) {
    if (delta === 0) return <span className="text-xs text-gray-400 flex items-center gap-1"><Minus className="w-3 h-3" />igual</span>
    if (delta > 0) return <span className="text-xs text-emerald-600 font-bold flex items-center gap-1"><TrendingUp className="w-3 h-3" />+{delta}h</span>
    return <span className="text-xs text-red-500 font-bold flex items-center gap-1"><TrendingDown className="w-3 h-3" />{delta}h</span>
  }

  return (
    <div className="p-5 lg:p-7 space-y-5 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-black text-gray-900 tracking-tight">Relatórios de Horas</h1>
          <p className="text-sm text-gray-400 mt-0.5">Desempenho dos Personal Trainers por período</p>
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
        {[
          {
            label: 'Horas esta semana',
            value: totalThisWeek,
            sub: `${totalThisWeek > totalLastWeek ? '+' : ''}${totalThisWeek - totalLastWeek}h vs sem. passada`,
            icon: Clock,
            positive: totalThisWeek >= totalLastWeek,
          },
          {
            label: 'Horas este mês',
            value: totalThisMonth,
            sub: `${totalThisMonth > totalLastMonth ? '+' : ''}${totalThisMonth - totalLastMonth}h vs mês passado`,
            icon: Calendar,
            positive: totalThisMonth >= totalLastMonth,
          },
          {
            label: 'PTs activos',
            value: db.pts.filter(p => p.active).length,
            sub: `${db.pts.filter(p => !p.active).length} inactivos`,
            icon: Users,
            positive: true,
          },
          {
            label: 'PT mais activo',
            value: weekData[0]?.pt.name.split(' ')[0] ?? '—',
            sub: `${weekData[0]?.thisWeek ?? 0}h esta semana`,
            icon: TrendingUp,
            positive: true,
          },
        ].map(({ label, value, sub, icon: Icon, positive }) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-xl border border-gray-100 shadow-sm p-4"
          >
            <div className="flex items-start justify-between mb-2">
              <p className="text-xs text-gray-400 font-medium">{label}</p>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: '#111111' }}>
                <Icon className="w-3.5 h-3.5 text-white" />
              </div>
            </div>
            <p className="text-2xl font-black text-gray-900 tracking-tight">{value}</p>
            <p className={`text-[11px] mt-1 font-medium ${positive ? 'text-emerald-600' : 'text-red-500'}`}>{sub}</p>
          </motion.div>
        ))}
      </div>

      {/* Tab bar */}
      <div className="flex bg-gray-100 rounded-lg p-0.5 gap-0.5 overflow-x-auto max-w-full">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all ${
              tab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB: Esta Semana ── */}
      {tab === 'semana' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          {/* Chart */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <p className="text-sm font-bold text-gray-900 mb-4">Sessões Esta Semana vs Semana Passada</p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={weekData.map(d => ({
                  name: d.pt.name.split(' ')[0],
                  'Esta semana': d.thisWeek,
                  'Sem. passada': d.lastWeek,
                }))}
                barGap={4}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                  formatter={(v) => [`${v}h`, '']}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Esta semana" fill="#111111" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Sem. passada" fill="#e5e7eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
            <table className="w-full text-sm min-w-[520px]">
              <thead>
                <tr className="border-b border-gray-100" style={{ background: '#f9fafb' }}>
                  {['Personal Trainer', 'Esta Semana', 'Semana Passada', 'Variação', 'Status'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-[11px] font-black text-gray-400 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {weekData.map(({ pt, thisWeek, lastWeek, delta }, i) => (
                  <tr key={pt.id} className={`border-b border-gray-50 last:border-0 ${i % 2 === 0 ? '' : 'bg-gray-50/30'}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-full ${avatarColor(pt.name)} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                          {getInitials(pt.name)}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900 text-sm">{pt.name}</p>
                          <p className="text-[11px] text-gray-400">{pt.specialty ?? 'Personal Trainer'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-lg font-black text-gray-900">{thisWeek}</span>
                      <span className="text-xs text-gray-400 ml-1">h</span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{lastWeek}h</td>
                    <td className="px-4 py-3"><DeltaBadge delta={delta} /></td>
                    <td className="px-4 py-3">
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                        pt.active && !pt.inadimplente ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                        pt.inadimplente ? 'bg-red-50 text-red-600 border-red-200' :
                        'bg-gray-100 text-gray-500 border-gray-200'
                      }`}>
                        {pt.inadimplente ? 'Inadimplente' : pt.active ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
              <p className="text-xs text-gray-400 font-medium">Total</p>
              <div className="flex items-center gap-6">
                <span className="text-sm font-black text-gray-900">{totalThisWeek}h esta semana</span>
                <span className="text-xs text-gray-400">{totalLastWeek}h semana passada</span>
                <DeltaBadge delta={totalThisWeek - totalLastWeek} />
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* ── TAB: Este Mês ── */}
      {tab === 'mes' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          {/* Chart */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <p className="text-sm font-bold text-gray-900 mb-4">Sessões Este Mês vs Mês Passado</p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={monthData.map(d => ({
                  name: d.pt.name.split(' ')[0],
                  'Este mês': d.thisMonth,
                  'Mês passado': d.lastMonth,
                }))}
                barGap={4}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                  formatter={(v) => [`${v}h`, '']}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Este mês" fill="#111111" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Mês passado" fill="#e5e7eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="border-b border-gray-100" style={{ background: '#f9fafb' }}>
                  {['Personal Trainer', 'Este Mês', 'Mês Passado', 'Variação', 'Receita Gerada', 'Plano'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-[11px] font-black text-gray-400 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {monthData.map(({ pt, thisMonth, lastMonth, delta, valor }, i) => {
                  const plan = db.plans.find(p => p.id === pt.planId)
                  return (
                    <tr key={pt.id} className={`border-b border-gray-50 last:border-0 ${i % 2 === 0 ? '' : 'bg-gray-50/30'}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-full ${avatarColor(pt.name)} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                            {getInitials(pt.name)}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">{pt.name}</p>
                            <p className="text-[11px] text-gray-400">{pt.specialty ?? 'PT'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-lg font-black text-gray-900">{thisMonth}</span>
                        <span className="text-xs text-gray-400 ml-1">h</span>
                      </td>
                      <td className="px-4 py-3 text-gray-500">{lastMonth}h</td>
                      <td className="px-4 py-3"><DeltaBadge delta={delta} /></td>
                      <td className="px-4 py-3">
                        <span className={`font-black text-sm ${valor >= 150 ? 'text-emerald-700' : valor >= 80 ? 'text-amber-600' : 'text-gray-700'}`}>
                          €{valor.toFixed(2)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[11px] font-medium text-gray-500">{plan?.name ?? '—'}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between flex-wrap gap-2">
              <p className="text-xs text-gray-400 font-medium">Total do Mês</p>
              <div className="flex items-center gap-6">
                <span className="text-sm font-black text-gray-900">{totalThisMonth}h · €{monthData.reduce((s, d) => s + d.valor, 0).toFixed(2)}</span>
                <DeltaBadge delta={totalThisMonth - totalLastMonth} />
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* ── TAB: Comparativo 4 Semanas ── */}
      {tab === 'comparativo' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          {/* Line chart */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <p className="text-sm font-bold text-gray-900 mb-1">Evolução de Sessões — Últimas 4 Semanas</p>
            <p className="text-xs text-gray-400 mb-4">Cada linha representa um Personal Trainer</p>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={compData.chartRows}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                  formatter={(v, name) => [`${v}h`, name]}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {compData.ptLines.map(({ key, color }) => (
                  <Line
                    key={key}
                    type="monotone"
                    dataKey={key}
                    stroke={color}
                    strokeWidth={2}
                    dot={{ fill: color, r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Comparative table */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="border-b border-gray-100" style={{ background: '#f9fafb' }}>
                  <th className="text-left px-4 py-3 text-[11px] font-black text-gray-400 uppercase tracking-wide">PT</th>
                  {compData.weekLabels.map(l => (
                    <th key={l} className="text-center px-4 py-3 text-[11px] font-black text-gray-400 uppercase tracking-wide">{l}</th>
                  ))}
                  <th className="text-center px-4 py-3 text-[11px] font-black text-gray-400 uppercase tracking-wide">Variação</th>
                </tr>
              </thead>
              <tbody>
                {compData.ptSummary.map(({ pt, weeks }, i) => {
                  const variation = weeks[3] - weeks[0]
                  return (
                    <tr key={pt.id} className={`border-b border-gray-50 last:border-0 ${i % 2 === 0 ? '' : 'bg-gray-50/30'}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ background: PT_COLORS[i % PT_COLORS.length] }}
                          />
                          <div>
                            <p className="font-semibold text-gray-900">{pt.name}</p>
                            <p className="text-[11px] text-gray-400">{pt.specialty ?? 'PT'}</p>
                          </div>
                        </div>
                      </td>
                      {weeks.map((w, wi) => (
                        <td key={wi} className="px-4 py-3 text-center">
                          <span className={`font-bold ${wi === 3 ? 'text-gray-900 text-base' : 'text-gray-500'}`}>{w}h</span>
                        </td>
                      ))}
                      <td className="px-4 py-3 text-center">
                        <DeltaBadge delta={variation} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-gray-200 bg-gray-50">
                  <td className="px-4 py-3 text-xs font-black text-gray-500 uppercase">Total</td>
                  {compData.weekLabels.map((_, wi) => (
                    <td key={wi} className="px-4 py-3 text-center text-sm font-black text-gray-900">
                      {compData.ptSummary.reduce((s, d) => s + d.weeks[wi], 0)}h
                    </td>
                  ))}
                  <td className="px-4 py-3 text-center">
                    <DeltaBadge delta={
                      compData.ptSummary.reduce((s, d) => s + d.weeks[3], 0) -
                      compData.ptSummary.reduce((s, d) => s + d.weeks[0], 0)
                    } />
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </motion.div>
      )}
    </div>
  )
}
