'use client'

import { useEffect, useState } from 'react'
import { db } from '@/lib/mock-db'
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns'
import { pt } from 'date-fns/locale'
import { ReportLayout, ReportHeader, ReportSection, ReportFooter } from '@/components/ui/report-layout'
import type { MockPT, MockPlan } from '@/lib/mock-db'

interface BillingEntry {
  pt: MockPT
  plan?: MockPlan
  sessionsCount: number
  valorCalculado: number
}

function calcValor(plan: MockPlan | undefined, sessionsCount: number): number {
  if (!plan) return 0
  if (plan.type === 'MONTHLY') return plan.priceMonthly ?? 0
  if (plan.type === 'WEEKLY') return (plan.priceWeekly ?? 0) * 4
  if (plan.type === 'HOURLY') return (plan.priceHourly ?? 0) * sessionsCount
  return 0
}

export default function RelatorioFaturacaoPage() {
  const [data, setData] = useState<BillingEntry[] | null>(null)
  const [month] = useState(() => {
    if (typeof window !== 'undefined') {
      const m = new URLSearchParams(window.location.search).get('month')
      if (m) return new Date(m + '-01')
    }
    return new Date()
  })

  useEffect(() => {
    const monthStart = startOfMonth(month)
    const monthEnd = endOfMonth(month)

    const entries: BillingEntry[] = db.pts
      .filter(pt => pt.active)
      .map(pt => {
        const plan = db.plans.find(p => p.id === pt.planId)
        const sessionsCount = db.bookings.filter(b => {
          const d = parseISO(b.startTime)
          return b.personalTrainerId === pt.id &&
            (b.status === 'CONFIRMED' || b.status === 'COMPLETED') &&
            d >= monthStart && d <= monthEnd
        }).length
        return { pt, plan, sessionsCount, valorCalculado: calcValor(plan, sessionsCount) }
      })
      .sort((a, b) => b.valorCalculado - a.valorCalculado)

    setData(entries)
  }, [month])

  if (!data) return <div className="flex items-center justify-center h-screen text-gray-400 text-sm">A carregar...</div>

  const total = data.reduce((sum, e) => sum + e.valorCalculado, 0)
  const mesLabel = format(month, "MMMM 'de' yyyy", { locale: pt })
  const mesCapital = mesLabel.charAt(0).toUpperCase() + mesLabel.slice(1)

  return (
    <ReportLayout title={`Faturação — ${mesCapital}`} subtitle="Relatório de cobranças mensais — Personal Trainers">
      <ReportHeader />

      <div className="mb-6">
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.12em] mb-1">Faturação Mensal</p>
        <h1 className="text-2xl font-black text-gray-900 tracking-tight">{mesCapital}</h1>
        <p className="text-xs text-gray-400 mt-1">MG Estúdio Boutique · {data.length} Personal Trainer{data.length !== 1 ? 's' : ''} activo{data.length !== 1 ? 's' : ''}</p>
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
            {data.map((entry, i) => (
              <tr key={entry.pt.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                <td className="py-3 px-3">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black flex-shrink-0"
                      style={{ background: '#1F3864', color: '#C9A84C' }}
                    >
                      {entry.pt.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{entry.pt.name}</p>
                      <p className="text-[10px] text-gray-400">{entry.pt.email}</p>
                    </div>
                  </div>
                </td>
                <td className="py-3 px-3 text-gray-500">{entry.pt.specialty ?? '—'}</td>
                <td className="py-3 px-3">
                  {entry.plan ? (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      entry.plan.type === 'MONTHLY' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                      entry.plan.type === 'HOURLY' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                      'bg-amber-50 text-amber-700 border-amber-200'
                    }`}>
                      {entry.plan.name}
                    </span>
                  ) : (
                    <span className="text-gray-400 text-[11px]">Sem plano</span>
                  )}
                </td>
                <td className="py-3 px-3 text-center">
                  <span className="font-bold text-gray-900">{entry.sessionsCount}</span>
                  <span className="text-gray-400"> sessões</span>
                </td>
                <td className="py-3 px-3">
                  <span className={`text-sm font-black ${
                    entry.valorCalculado >= 150 ? 'text-emerald-700' :
                    entry.valorCalculado >= 80 ? 'text-amber-700' :
                    'text-gray-700'
                  }`}>
                    €{entry.valorCalculado.toFixed(2)}
                  </span>
                  {entry.pt.inadimplente && (
                    <span className="ml-2 text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-50 text-red-600 border border-red-200">PENDENTE</span>
                  )}
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
          <p className="text-3xl font-black text-gray-900 tracking-tight">€{total.toFixed(2)}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-400">{data.length} PTs · {data.reduce((s, e) => s + e.sessionsCount, 0)} sessões</p>
          <p className="text-xs text-gray-400 mt-1">Gerado automaticamente pelo Fit Studio Now</p>
        </div>
      </div>

      {/* Summary by plan type */}
      <div className="mt-5 grid grid-cols-3 gap-3">
        {(['MONTHLY', 'WEEKLY', 'HOURLY'] as const).map(type => {
          const subset = data.filter(e => e.plan?.type === type)
          if (!subset.length) return null
          const subtotal = subset.reduce((s, e) => s + e.valorCalculado, 0)
          const labels = { MONTHLY: 'Plano Mensal', WEEKLY: 'Plano Semanal', HOURLY: 'Plano Por Hora' }
          return (
            <div key={type} className="bg-white rounded-lg border border-gray-100 p-3 text-center">
              <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">{labels[type]}</p>
              <p className="text-lg font-black text-gray-900">€{subtotal.toFixed(2)}</p>
              <p className="text-[10px] text-gray-400">{subset.length} PT{subset.length !== 1 ? 's' : ''}</p>
            </div>
          )
        })}
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
