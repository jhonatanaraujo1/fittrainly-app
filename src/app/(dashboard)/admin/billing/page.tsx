'use client'

import { useState } from 'react'
import { useQuery, useQueries } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Download, CheckCircle2, Printer, Layers, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { billingApi, ptPaymentApi } from '@/lib/api'
import { formatCurrency, formatDate, getInitials, avatarColor, planTypeLabel, cn, withIVA, IVA_RATE } from '@/lib/utils'
import type { BillingEntry } from '@/types'

interface WeekRow {
  weekStart: string; weekEnd: string; hoursThisWeek: number; cumulativeHours: number
  isClosingWeek: boolean; amountAdvanced: number; retroactiveAdjustment?: number; bonus?: number
}
interface TierRow { tierOrder: number; hoursFrom: number; hoursTo: number | null; pricePerHour: number; bonus: number }
interface Schedule { ptId: string; ptName: string; tiers: TierRow[]; weeks: WeekRow[]; totalHours: number }

// The tier a PT's monthly hours land in — the last tier whose floor they've
// reached. Drives the marginal rate and the "faixa atingida" label.
function tierReached(totalHours: number, tiers: TierRow[]): TierRow | undefined {
  const sorted = [...tiers].sort((a, b) => a.tierOrder - b.tierOrder)
  return [...sorted].reverse().find(t => totalHours >= t.hoursFrom) ?? sorted[0]
}
function tierRangeLabel(t: TierRow): string {
  return t.hoursTo === null ? `${t.hoursFrom}h+` : `${t.hoursFrom}–${t.hoursTo}h`
}

// Scannable per-PT monthly summary for TIERED_HOURLY plans — hours, tier
// reached, discount credited (the retroactive adjustment, negative = credit
// back to the PT) and bonus, all visible at a glance. Each row expands to
// the week-by-week breakdown. Reuses the same weekly-schedule endpoint the
// backend already serves; no per-card lazy loading, everything eager so the
// table is fully populated when it renders.
function TierMonthlySummary({ ptList, month }: { ptList: { ptId: string; ptName: string }[]; month: string }) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const results = useQueries({
    queries: ptList.map(p => ({
      queryKey: ['pt-weekly-schedule', p.ptId, month],
      queryFn: () => ptPaymentApi.weeklySchedule(p.ptId, month) as Promise<Schedule>,
    })),
  })

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[520px]">
          <thead>
            <tr className="text-xs text-gray-400 bg-gray-50">
              <th className="text-left px-5 py-3 font-medium">Personal Trainer</th>
              <th className="text-right px-4 py-3 font-medium">Horas</th>
              <th className="text-left px-4 py-3 font-medium">Faixa atingida</th>
              <th className="text-right px-4 py-3 font-medium">Desconto</th>
              <th className="text-right px-5 py-3 font-medium">Bónus</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {ptList.map((p, i) => {
              const r = results[i]
              const s = r.data
              const closing = s?.weeks.find(w => w.isClosingWeek)
              // retroactiveAdjustment negative = crédito (desconto) ao PT
              const discount = closing?.retroactiveAdjustment ?? 0
              const bonus = closing?.bonus ?? 0
              const tier = s ? tierReached(s.totalHours, s.tiers) : undefined
              const isOpen = expanded === p.ptId

              return (
                <>
                  <tr
                    key={p.ptId}
                    onClick={() => setExpanded(o => (o === p.ptId ? null : p.ptId))}
                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full ${avatarColor(p.ptName)} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                          {getInitials(p.ptName)}
                        </div>
                        <span className="font-medium text-gray-900">{p.ptName}</span>
                      </div>
                    </td>
                    {r.isLoading || !s ? (
                      <td colSpan={4} className="px-4 py-3.5"><Skeleton className="h-4 w-40 rounded" /></td>
                    ) : (
                      <>
                        <td className="px-4 py-3.5 text-right tabular-nums font-semibold text-gray-800">{s.totalHours}h</td>
                        <td className="px-4 py-3.5">
                          {tier ? (
                            <span className="text-xs text-gray-600">{tierRangeLabel(tier)} · {formatCurrency(tier.pricePerHour)}/h</span>
                          ) : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          {discount < 0 ? (
                            <span className="font-bold text-emerald-700">−{formatCurrency(Math.abs(discount))}</span>
                          ) : discount > 0 ? (
                            <span className="font-bold text-gray-700">+{formatCurrency(discount)}</span>
                          ) : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-5 py-3.5 text-right tabular-nums">
                          {bonus ? <span className="font-semibold text-violet-700">€{bonus}</span> : <span className="text-gray-300">—</span>}
                        </td>
                      </>
                    )}
                    <td className="pr-4 text-right">
                      <ChevronDown className={cn('w-4 h-4 text-gray-400 transition-transform inline', isOpen && 'rotate-180')} />
                    </td>
                  </tr>

                  {isOpen && s && (
                    <tr key={p.ptId + '-detail'}>
                      <td colSpan={6} className="bg-gray-50/60 px-5 py-4">
                        <div className="space-y-2">
                          {s.weeks.map((w, wi) => (
                            <div
                              key={wi}
                              className={cn(
                                'rounded-lg border px-3 py-2.5 text-xs',
                                w.isClosingWeek ? 'bg-violet-50 border-violet-200' : 'bg-white border-gray-100',
                              )}
                            >
                              <div className="flex items-center justify-between flex-wrap gap-1">
                                <span className="font-semibold text-gray-700">
                                  {formatDate(w.weekStart)} – {formatDate(w.weekEnd)}
                                  {w.isClosingWeek && <span className="ml-2 text-violet-600 font-bold">Semana de fecho</span>}
                                </span>
                                <span className="text-gray-500">{w.hoursThisWeek}h esta semana · {w.cumulativeHours}h no mês</span>
                              </div>
                              <div className="flex items-center justify-between mt-1.5 flex-wrap gap-1">
                                <span className="text-gray-500">
                                  Adiantado: <strong className="text-gray-800">{formatCurrency(w.amountAdvanced)}</strong>
                                  <span className="text-gray-400"> (c/ IVA: {formatCurrency(withIVA(w.amountAdvanced).total)})</span>
                                </span>
                                {w.isClosingWeek && w.retroactiveAdjustment !== undefined && (
                                  <span className={w.retroactiveAdjustment < 0 ? 'text-emerald-700 font-bold' : 'text-gray-700 font-bold'}>
                                    Acerto: {w.retroactiveAdjustment < 0 ? '−' : '+'}{formatCurrency(Math.abs(w.retroactiveAdjustment))}
                                    <span className="font-normal text-gray-400"> (c/ IVA: {formatCurrency(withIVA(Math.abs(w.retroactiveAdjustment)).total)})</span>
                                    {w.bonus ? ` · Bónus €${w.bonus}` : ''}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function exportCSV(entries: BillingEntry[], total: number, month: string) {
  const [year, m] = month.split('-')
  const monthLabel = new Date(Number(year), Number(m) - 1, 1)
    .toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })

  const rows = [
    ['Personal Trainer', 'Plano', 'Tipo', 'Sessões', 'Valor s/ IVA (€)', 'IVA 23% (€)', 'Valor c/ IVA (€)'],
    ...entries.map(e => {
      const { base, iva, total: withTax } = withIVA(e.value ?? 0)
      return [e.ptName, e.planName, planTypeLabel(e.planType), String(e.sessionsCount ?? 0), base.toFixed(2), iva.toFixed(2), withTax.toFixed(2)]
    }),
    [],
    ['', '', '', 'TOTAL', total.toFixed(2), withIVA(total).iva.toFixed(2), withIVA(total).total.toFixed(2)],
  ]

  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `faturacao_${month}.csv`
  a.click()
  URL.revokeObjectURL(url)
  toast.success(`Exportado: faturacao_${month}.csv`, { icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" /> })
}

function monthOptions() {
  const opts = []
  const now = new Date()
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })
    opts.push({ value, label: label.charAt(0).toUpperCase() + label.slice(1) })
  }
  return opts
}

export default function BillingPage() {
  const months = monthOptions()
  const [selectedMonth, setSelectedMonth] = useState(months[0].value)

  const { data, isLoading } = useQuery<{ entries: BillingEntry[]; total: number; month: string }>({
    queryKey: ['billing', selectedMonth],
    queryFn: () => billingApi.byMonth(selectedMonth),
  })

  const entries = data?.entries ?? []
  const total = data?.total ?? 0

  return (
    <div className="p-5 lg:p-7 space-y-5 max-w-4xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-black text-gray-900">Faturação</h1>
          <p className="text-sm text-gray-400 mt-0.5">Valores calculados por plano de aluguel</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedMonth} onValueChange={(v) => v && setSelectedMonth(v)}>
            <SelectTrigger className="w-44 h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {months.map(m => (
                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            className="h-9 text-sm gap-1.5"
            onClick={() => exportCSV(entries, total, selectedMonth)}
            disabled={isLoading || entries.length === 0}
          >
            <Download className="w-3.5 h-3.5" /> Exportar CSV
          </Button>
          <a
            href={`/relatorio/faturacao?month=${selectedMonth}`}
            target="_blank"
            rel="noopener"
          >
            <Button variant="outline" className="h-9 text-sm gap-1.5" disabled={isLoading || entries.length === 0}>
              <Printer className="w-3.5 h-3.5" /> Relatório PDF
            </Button>
          </a>
        </div>
      </div>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto"
      >
        {isLoading ? (
          <div className="p-5 space-y-3">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">
            Sem dados de faturação para este período
          </div>
        ) : (
          <table className="w-full text-sm min-w-[340px]">
            <thead>
              <tr className="text-xs text-gray-400 bg-gray-50">
                <th className="text-left px-5 py-3 font-medium">Personal Trainer</th>
                <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Plano</th>
                <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Sessões</th>
                <th className="text-right px-5 py-3 font-medium">Valor (s/ IVA)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {entries.map((e, i) => (
                <tr key={e.ptId ?? i} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full ${avatarColor(e.ptName)} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                        {getInitials(e.ptName)}
                      </div>
                      <span className="font-medium text-gray-900">{e.ptName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 hidden md:table-cell">
                    <span className="text-xs text-gray-500">{e.planName} — {planTypeLabel(e.planType)}</span>
                  </td>
                  <td className="px-4 py-3.5 hidden lg:table-cell">
                    <span className="text-gray-600">{e.sessionsCount ?? 0}</span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <span className={`font-bold text-sm ${e.value >= 100 ? 'text-emerald-700' : e.value >= 50 ? 'text-amber-700' : 'text-gray-700'}`}>
                      {formatCurrency(e.value ?? 0)}
                    </span>
                    <div className="text-[10px] text-gray-400 mt-0.5">
                      +IVA ({(IVA_RATE * 100).toFixed(0)}%): {formatCurrency(withIVA(e.value ?? 0).total)}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </motion.div>

      {/* Weekly cycle — TIERED_HOURLY plans only */}
      {!isLoading && entries.some(e => e.planType === 'TIERED_HOURLY') && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="space-y-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-violet-500" />
            <h2 className="text-sm font-bold text-gray-900">Desconto por PT (Planos por Faixas)</h2>
          </div>
          <p className="text-xs text-gray-400 -mt-1">
            Horas do mês, faixa atingida e o crédito retroativo de cada PT. Clica numa linha para ver o detalhe semanal.
          </p>
          <TierMonthlySummary
            ptList={entries.filter(e => e.planType === 'TIERED_HOURLY').map(e => ({ ptId: e.ptId, ptName: e.ptName }))}
            month={selectedMonth}
          />
        </motion.div>
      )}

      {/* Total */}
      {!isLoading && entries.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-[#1F3864] rounded-xl px-5 py-4 flex items-center justify-between"
        >
          <span className="text-white/70 text-sm font-medium">Total do período</span>
          <div className="text-right">
            <span className="text-white text-xl font-bold">{formatCurrency(total)}</span>
            <p className="text-white/50 text-xs mt-0.5">c/ IVA (23%): {formatCurrency(withIVA(total).total)}</p>
          </div>
        </motion.div>
      )}
    </div>
  )
}
