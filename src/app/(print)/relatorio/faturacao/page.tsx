'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { pt } from 'date-fns/locale'
import { billingApi, ptApi } from '@/lib/api'
import { formatCurrency, planTypeLabel, withIVA } from '@/lib/utils'
import { ReportLayout, ReportHeader, ReportSection, ReportFooter } from '@/components/ui/report-layout'
import type { BillingEntry } from '@/types'

// 100% backend real: billingApi.byMonth(month) devolve as entries já
// calculadas por plano (inclui TIERED_HOURLY). Especialidade/email vêm da
// lista de PTs, juntos por ptId. Sem qualquer leitura de mock.

type PtLite = { id: string; name: string; email?: string; specialty?: string }

const monthParam = () => {
  if (typeof window !== 'undefined') {
    const m = new URLSearchParams(window.location.search).get('month')
    if (m) return m
  }
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function RelatorioFaturacaoPage() {
  const [month] = useState(monthParam)

  const billingQ = useQuery<{ entries: BillingEntry[]; total: number; month: string }>({
    queryKey: ['billing', month],
    queryFn: () => billingApi.byMonth(month),
  })
  const ptsQ = useQuery<PtLite[]>({
    queryKey: ['pts'],
    queryFn: () => ptApi.list() as unknown as Promise<PtLite[]>,
  })

  const entries = billingQ.data?.entries ?? []
  const total = billingQ.data?.total ?? 0
  const pts = ptsQ.data ?? []

  const rows = useMemo(() => {
    const ptById = new Map(pts.map(p => [p.id, p]))
    return entries
      .map(e => ({
        ...e,
        specialty: ptById.get(e.ptId)?.specialty ?? '—',
        email: ptById.get(e.ptId)?.email ?? '',
      }))
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
  }, [entries, pts])

  if (billingQ.isLoading) {
    return <div className="flex items-center justify-center h-screen text-gray-400 text-sm">A carregar...</div>
  }

  const [y, m] = month.split('-').map(Number)
  const mesLabel = format(new Date(y, m - 1, 1), "MMMM 'de' yyyy", { locale: pt })
  const mesCapital = mesLabel.charAt(0).toUpperCase() + mesLabel.slice(1)
  const totalSessions = rows.reduce((s, e) => s + (e.sessionsCount ?? 0), 0)

  return (
    <ReportLayout title={`Faturação — ${mesCapital}`} subtitle="Relatório de cobranças mensais — Personal Trainers">
      <ReportHeader />

      <div className="mb-6">
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.12em] mb-1">Faturação Mensal</p>
        <h1 className="text-2xl font-black text-gray-900 tracking-tight">{mesCapital}</h1>
        <p className="text-xs text-gray-400 mt-1">MG Estúdio Boutique · {rows.length} Personal Trainer{rows.length !== 1 ? 's' : ''} com faturação</p>
      </div>

      <ReportSection title="Detalhe por Personal Trainer">
        <table className="w-full text-xs">
          <thead>
            <tr style={{ background: '#f9fafb' }}>
              {['Personal Trainer', 'Especialidade', 'Plano', 'Sessões no Mês', 'Valor a Pagar'].map(h => (
                <th key={h} className="text-left py-2.5 px-3 text-[10px] font-black text-gray-500 uppercase tracking-wide border-b border-gray-200">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((entry, i) => (
              <tr key={entry.ptId ?? i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                <td className="py-3 px-3">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black flex-shrink-0"
                      style={{ background: '#111111', color: '#C9A84C' }}
                    >
                      {entry.ptName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{entry.ptName}</p>
                      {entry.email && <p className="text-[10px] text-gray-400">{entry.email}</p>}
                    </div>
                  </div>
                </td>
                <td className="py-3 px-3 text-gray-500">{entry.specialty}</td>
                <td className="py-3 px-3">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-gray-50 text-gray-700 border-gray-200">
                    {entry.planName} · {planTypeLabel(entry.planType)}
                  </span>
                </td>
                <td className="py-3 px-3 text-center">
                  <span className="font-bold text-gray-900">{entry.sessionsCount ?? 0}</span>
                  <span className="text-gray-400"> sessões</span>
                </td>
                <td className="py-3 px-3">
                  <span className={`text-sm font-black ${
                    entry.value >= 150 ? 'text-emerald-700' :
                    entry.value >= 80 ? 'text-amber-700' :
                    'text-gray-700'
                  }`}>
                    {formatCurrency(entry.value ?? 0)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ReportSection>

      {/* Total */}
      <div className="flex items-center justify-between p-5 rounded-xl border-2 border-gray-900 bg-gray-50 mt-2">
        <div>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.1em] mb-0.5">Total a Faturar — {mesCapital}</p>
          <p className="text-3xl font-black text-gray-900 tracking-tight">{formatCurrency(total)}</p>
          <p className="text-[11px] text-gray-400 mt-1">c/ IVA (23%): {formatCurrency(withIVA(total).total)}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-400">{rows.length} PTs · {totalSessions} sessões</p>
          <p className="text-xs text-gray-400 mt-1">Gerado automaticamente pelo Fit Studio Now</p>
        </div>
      </div>

      {/* Approval block */}
      <div className="mt-8 pt-4 border-t border-gray-200 grid grid-cols-2 gap-16">
        <div>
          <p className="text-[10px] text-gray-400 mb-8">Aprovado por (Admin)</p>
          <div className="border-b border-gray-400 mb-1" />
          <p className="text-[10px] text-gray-500">Maicon Godoi — MG Estúdio Boutique</p>
        </div>
        <div>
          <p className="text-[10px] text-gray-400 mb-8">Data de Aprovação</p>
          <div className="border-b border-gray-400 mb-1" />
          <p className="text-[10px] text-gray-500">{format(new Date(), "d 'de' MMMM 'de' yyyy", { locale: pt })}</p>
        </div>
      </div>

      <ReportFooter />
    </ReportLayout>
  )
}
