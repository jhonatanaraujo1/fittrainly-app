'use client'

import { useMemo } from 'react'
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, subWeeks, subMonths, format } from 'date-fns'
import { pt } from 'date-fns/locale'
import { db } from '@/lib/mock-db'
import { getInitials } from '@/lib/utils'
import { ReportLayout, ReportHeader, ReportSection, ReportFooter } from '@/components/ui/report-layout'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

function sessionsInRange(ptId: string, start: Date, end: Date) {
  return db.bookings.filter(b =>
    b.personalTrainerId === ptId &&
    (b.status === 'CONFIRMED' || b.status === 'COMPLETED') &&
    new Date(b.startTime) >= start && new Date(b.startTime) <= end
  ).length
}

function DeltaCell({ delta }: { delta: number }) {
  if (delta === 0) return <span className="text-[11px] text-gray-400">—</span>
  if (delta > 0) return <span className="text-[11px] font-bold text-emerald-600">↑ +{delta}h</span>
  return <span className="text-[11px] font-bold text-red-500">↓ {delta}h</span>
}

export default function RelatorioHorasPage() {
  const now = new Date()

  const weekData = useMemo(() => {
    const s = startOfWeek(now, { weekStartsOn: 1 })
    const e = endOfWeek(now, { weekStartsOn: 1 })
    const ls = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 })
    const le = endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 })
    return db.pts.filter(p => p.active).map(p => ({
      pt: p,
      thisWeek: sessionsInRange(p.id, s, e),
      lastWeek: sessionsInRange(p.id, ls, le),
    })).sort((a, b) => b.thisWeek - a.thisWeek)
  }, [])

  const monthData = useMemo(() => {
    const s = startOfMonth(now)
    const e = endOfMonth(now)
    const ls = startOfMonth(subMonths(now, 1))
    const le = endOfMonth(subMonths(now, 1))
    return db.pts.filter(p => p.active).map(p => {
      const plan = db.plans.find(pl => pl.id === p.planId)
      const thisMonth = sessionsInRange(p.id, s, e)
      const lastMonth = sessionsInRange(p.id, ls, le)
      const valor = !plan ? 0
        : plan.type === 'MONTHLY' ? (plan.priceMonthly ?? 0)
        : plan.type === 'WEEKLY' ? (plan.priceWeekly ?? 0) * 4
        : (plan.priceHourly ?? 0) * p.hoursThisMonth
      return { pt: p, plan, thisMonth, lastMonth, valor }
    }).sort((a, b) => b.thisMonth - a.thisMonth)
  }, [])

  const compWeeks = Array.from({ length: 4 }, (_, i) => {
    const ref = subWeeks(now, 3 - i)
    return {
      label: i === 3 ? 'Esta sem.' : `Sem. ${format(startOfWeek(ref, { weekStartsOn: 1 }), 'd MMM', { locale: pt })}`,
      start: startOfWeek(ref, { weekStartsOn: 1 }),
      end: endOfWeek(ref, { weekStartsOn: 1 }),
    }
  })

  const mesLabel = format(now, "MMMM 'de' yyyy", { locale: pt })
  const mesCapital = mesLabel.charAt(0).toUpperCase() + mesLabel.slice(1)

  return (
    <ReportLayout title={`Relatório de Horas — ${mesCapital}`} subtitle="Semanal + Mensal + Comparativo">
      <ReportHeader />

      <div className="mb-6">
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.12em] mb-1">Relatório de Horas por PT</p>
        <h1 className="text-2xl font-black text-gray-900 tracking-tight">{mesCapital}</h1>
        <p className="text-xs text-gray-400 mt-1">
          {db.pts.filter(p => p.active).length} PTs activos ·{' '}
          Semana de {format(startOfWeek(now, { weekStartsOn: 1 }), 'd', { locale: pt })} a{' '}
          {format(endOfWeek(now, { weekStartsOn: 1 }), 'd MMM yyyy', { locale: pt })}
        </p>
      </div>

      {/* Weekly */}
      <ReportSection title="1. Resumo Semanal">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-200" style={{ background: '#f9fafb' }}>
              {['Personal Trainer', 'Especialidade', 'Esta Semana', 'Sem. Passada', 'Variação', 'Status'].map(h => (
                <th key={h} className="text-left py-2 px-2 text-[10px] font-black text-gray-400 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weekData.map(({ pt, thisWeek, lastWeek }, i) => (
              <tr key={pt.id} className={`border-b border-gray-50 ${i % 2 === 0 ? '' : 'bg-gray-50/50'}`}>
                <td className="py-2 px-2">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-black flex-shrink-0"
                      style={{ background: '#1F3864' }}>
                      {getInitials(pt.name)}
                    </div>
                    <span className="font-semibold text-gray-900">{pt.name}</span>
                  </div>
                </td>
                <td className="py-2 px-2 text-gray-500">{pt.specialty ?? '—'}</td>
                <td className="py-2 px-2 font-black text-gray-900 text-sm">{thisWeek}h</td>
                <td className="py-2 px-2 text-gray-500">{lastWeek}h</td>
                <td className="py-2 px-2"><DeltaCell delta={thisWeek - lastWeek} /></td>
                <td className="py-2 px-2">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                    pt.active && !pt.inadimplente ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                    pt.inadimplente ? 'bg-red-50 text-red-600 border-red-200' : 'bg-gray-100 text-gray-500 border-gray-200'
                  }`}>
                    {pt.inadimplente ? 'Inadimplente' : pt.active ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-300 bg-gray-50">
              <td className="py-2 px-2 font-black text-gray-700 col-span-2" colSpan={2}>Total</td>
              <td className="py-2 px-2 font-black text-gray-900">{weekData.reduce((s, d) => s + d.thisWeek, 0)}h</td>
              <td className="py-2 px-2 font-black text-gray-500">{weekData.reduce((s, d) => s + d.lastWeek, 0)}h</td>
              <td className="py-2 px-2"><DeltaCell delta={weekData.reduce((s, d) => s + d.thisWeek - d.lastWeek, 0)} /></td>
              <td />
            </tr>
          </tfoot>
        </table>
      </ReportSection>

      {/* Monthly */}
      <ReportSection title={`2. Resumo Mensal — ${mesCapital}`}>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-200" style={{ background: '#f9fafb' }}>
              {['Personal Trainer', 'Plano', 'Este Mês', 'Mês Passado', 'Variação', 'Receita'].map(h => (
                <th key={h} className="text-left py-2 px-2 text-[10px] font-black text-gray-400 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {monthData.map(({ pt, plan, thisMonth, lastMonth, valor }, i) => (
              <tr key={pt.id} className={`border-b border-gray-50 ${i % 2 === 0 ? '' : 'bg-gray-50/50'}`}>
                <td className="py-2 px-2 font-semibold text-gray-900">{pt.name}</td>
                <td className="py-2 px-2 text-gray-500">{plan?.name ?? '—'}</td>
                <td className="py-2 px-2 font-black text-gray-900 text-sm">{thisMonth}h</td>
                <td className="py-2 px-2 text-gray-500">{lastMonth}h</td>
                <td className="py-2 px-2"><DeltaCell delta={thisMonth - lastMonth} /></td>
                <td className="py-2 px-2 font-black text-emerald-700">€{valor.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-300 bg-gray-50">
              <td className="py-2 px-2 font-black text-gray-700" colSpan={2}>Total</td>
              <td className="py-2 px-2 font-black text-gray-900">{monthData.reduce((s, d) => s + d.thisMonth, 0)}h</td>
              <td className="py-2 px-2 font-black text-gray-500">{monthData.reduce((s, d) => s + d.lastMonth, 0)}h</td>
              <td className="py-2 px-2"><DeltaCell delta={monthData.reduce((s, d) => s + d.thisMonth - d.lastMonth, 0)} /></td>
              <td className="py-2 px-2 font-black text-emerald-700">€{monthData.reduce((s, d) => s + d.valor, 0).toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
      </ReportSection>

      {/* Comparative */}
      <ReportSection title="3. Comparativo — Últimas 4 Semanas">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-200" style={{ background: '#f9fafb' }}>
              <th className="text-left py-2 px-2 text-[10px] font-black text-gray-400 uppercase">PT</th>
              {compWeeks.map(w => (
                <th key={w.label} className="text-center py-2 px-2 text-[10px] font-black text-gray-400 uppercase">{w.label}</th>
              ))}
              <th className="text-center py-2 px-2 text-[10px] font-black text-gray-400 uppercase">Variação</th>
            </tr>
          </thead>
          <tbody>
            {db.pts.filter(p => p.active).map((p, i) => {
              const weeks = compWeeks.map(w => sessionsInRange(p.id, w.start, w.end))
              const variation = weeks[3] - weeks[0]
              return (
                <tr key={p.id} className={`border-b border-gray-50 ${i % 2 === 0 ? '' : 'bg-gray-50/50'}`}>
                  <td className="py-2 px-2 font-semibold text-gray-900">{p.name}</td>
                  {weeks.map((w, wi) => (
                    <td key={wi} className={`py-2 px-2 text-center ${wi === 3 ? 'font-black text-gray-900' : 'text-gray-500'}`}>{w}h</td>
                  ))}
                  <td className="py-2 px-2 text-center"><DeltaCell delta={variation} /></td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-300 bg-gray-50">
              <td className="py-2 px-2 font-black text-gray-700">Total</td>
              {compWeeks.map((w, wi) => (
                <td key={wi} className="py-2 px-2 text-center font-black text-gray-900">
                  {db.pts.filter(p => p.active).reduce((s, p) => s + sessionsInRange(p.id, w.start, w.end), 0)}h
                </td>
              ))}
              <td className="py-2 px-2 text-center">
                <DeltaCell delta={
                  db.pts.filter(p => p.active).reduce((s, p) =>
                    s + sessionsInRange(p.id, compWeeks[3].start, compWeeks[3].end) -
                    sessionsInRange(p.id, compWeeks[0].start, compWeeks[0].end), 0)
                } />
              </td>
            </tr>
          </tfoot>
        </table>
      </ReportSection>

      <ReportFooter />
    </ReportLayout>
  )
}
