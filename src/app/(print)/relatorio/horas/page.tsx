'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { pt } from 'date-fns/locale'
import { billingApi, ptApi } from '@/lib/api'
import { getInitials, formatCurrency, planTypeLabel, withIVA } from '@/lib/utils'
import { ReportLayout, ReportHeader, ReportSection, ReportFooter } from '@/components/ui/report-layout'
import type { BillingEntry } from '@/types'

// Relatório de impressão 100% backend real. O backend agrega apenas o mês
// corrente (billing por PT + lista de PTs); não há série histórica semanal,
// por isso as secções semanal/comparativo do mock (dados fabricados) foram
// removidas. Volta quando o backend expuser histórico de sessões.

type PtLite = { id: string; name: string; specialty?: string; active?: boolean }

const currentMonth = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function RelatorioHorasPage() {
  const now = new Date()
  const month = currentMonth()

  const billingQ = useQuery<{ entries: BillingEntry[]; total: number; month: string }>({
    queryKey: ['billing', month],
    queryFn: () => billingApi.byMonth(month),
  })
  const ptsQ = useQuery<PtLite[]>({
    queryKey: ['pts'],
    queryFn: () => ptApi.list() as unknown as Promise<PtLite[]>,
  })

  const entries = billingQ.data?.entries ?? []
  const totalRevenue = billingQ.data?.total ?? 0
  const pts = ptsQ.data ?? []

  const rows = useMemo(() => {
    const ptById = new Map(pts.map(p => [p.id, p]))
    return entries
      .map(e => ({
        ...e,
        specialty: ptById.get(e.ptId)?.specialty ?? '—',
        active: ptById.get(e.ptId)?.active ?? true,
      }))
      .sort((a, b) => (b.sessionsCount ?? 0) - (a.sessionsCount ?? 0))
  }, [entries, pts])

  const totalSessions = rows.reduce((s, r) => s + (r.sessionsCount ?? 0), 0)
  const activePTs = pts.filter(p => p.active !== false).length

  const mesLabel = format(now, "MMMM 'de' yyyy", { locale: pt })
  const mesCapital = mesLabel.charAt(0).toUpperCase() + mesLabel.slice(1)

  return (
    <ReportLayout title={`Relatório de Horas — ${mesCapital}`} subtitle="Sessões e receita por Personal Trainer">
      <ReportHeader />

      <div className="mb-6">
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.12em] mb-1">Relatório de Horas por PT</p>
        <h1 className="text-2xl font-black text-gray-900 tracking-tight">{mesCapital}</h1>
        <p className="text-xs text-gray-400 mt-1">
          {activePTs} PTs activos · {totalSessions} sessões no mês · {formatCurrency(totalRevenue)} de receita
        </p>
      </div>

      <ReportSection title={`Resumo Mensal — ${mesCapital}`}>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-200" style={{ background: '#f9fafb' }}>
              {['Personal Trainer', 'Especialidade', 'Plano', 'Sessões', 'Receita', 'Status'].map(h => (
                <th key={h} className="text-left py-2 px-2 text-[10px] font-black text-gray-400 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.ptId ?? i} className={`border-b border-gray-50 ${i % 2 === 0 ? '' : 'bg-gray-50/50'}`}>
                <td className="py-2 px-2">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-black flex-shrink-0"
                      style={{ background: '#111111' }}>
                      {getInitials(r.ptName)}
                    </div>
                    <span className="font-semibold text-gray-900">{r.ptName}</span>
                  </div>
                </td>
                <td className="py-2 px-2 text-gray-500">{r.specialty}</td>
                <td className="py-2 px-2 text-gray-500">{r.planName} · {planTypeLabel(r.planType)}</td>
                <td className="py-2 px-2 font-black text-gray-900 text-sm">{r.sessionsCount ?? 0}</td>
                <td className="py-2 px-2 font-black text-emerald-700">{formatCurrency(r.value ?? 0)}</td>
                <td className="py-2 px-2">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                    r.active ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-100 text-gray-500 border-gray-200'
                  }`}>
                    {r.active ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-300 bg-gray-50">
              <td className="py-2 px-2 font-black text-gray-700" colSpan={3}>Total</td>
              <td className="py-2 px-2 font-black text-gray-900">{totalSessions}</td>
              <td className="py-2 px-2 font-black text-emerald-700">{formatCurrency(totalRevenue)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
        <p className="text-[10px] text-gray-400 mt-2">
          Receita total c/ IVA (23%): {formatCurrency(withIVA(totalRevenue).total)}
        </p>
      </ReportSection>

      <ReportFooter />
    </ReportLayout>
  )
}
