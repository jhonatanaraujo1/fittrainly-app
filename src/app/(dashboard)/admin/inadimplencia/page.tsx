'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  ChevronLeft, ChevronRight, AlertTriangle, CheckCircle2, Clock,
  Euro, Loader2, X, Wallet,
} from 'lucide-react'
import { toast } from 'sonner'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ptPaymentApi, type PtWeeklyCharge } from '@/lib/api'
import { formatCurrency, getInitials, avatarColor } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'

function localWeekMondayISO(offsetWeeks: number): string {
  const d = new Date()
  const day = (d.getDay() + 6) % 7 // 0 = segunda
  d.setDate(d.getDate() - day + offsetWeeks * 7)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const STATUS_META: Record<PtWeeklyCharge['status'], { label: string; cls: string }> = {
  PAGO:      { label: 'Pago',      cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  PARCIAL:   { label: 'Parcial',   cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  EM_ABERTO: { label: 'Em aberto', cls: 'bg-gray-100 text-gray-500 border-gray-200' },
  VENCIDO:   { label: 'Vencido',   cls: 'bg-red-50 text-red-600 border-red-200' },
}

function fmtDay(iso: string) {
  try { return format(parseISO(iso), "d MMM", { locale: ptBR }) } catch { return iso }
}

export default function InadimplenciaPage() {
  const qc = useQueryClient()
  const [weekOffset, setWeekOffset] = useState(0)
  const weekDate = localWeekMondayISO(weekOffset)

  const { data: delinquency, isLoading: loadingDelinq } = useQuery({
    queryKey: ['pt-delinquency'],
    queryFn: () => ptPaymentApi.delinquency(),
  })

  const { data: week, isLoading: loadingWeek } = useQuery({
    queryKey: ['pt-week', weekDate],
    queryFn: () => ptPaymentApi.week(weekDate),
    staleTime: 20_000,
  })

  // Registar recebimento (total ou parcial).
  const [payFor, setPayFor] = useState<PtWeeklyCharge | null>(null)
  const [payAmount, setPayAmount] = useState('')
  const [payNotes, setPayNotes] = useState('')

  const record = useMutation({
    mutationFn: () => ptPaymentApi.record({
      ptId: payFor!.ptId,
      periodStart: payFor!.periodStart,
      amount: parseFloat(payAmount.replace(',', '.')),
      notes: payNotes || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pt-week'] })
      qc.invalidateQueries({ queryKey: ['pt-delinquency'] })
      qc.invalidateQueries({ queryKey: ['admin-pts'] })
      toast.success('Recebimento registado ✓')
      setPayFor(null); setPayAmount(''); setPayNotes('')
    },
    onError: (e: Error) => toast.error(e.message || 'Erro ao registar'),
  })

  function openPay(entry: PtWeeklyCharge) {
    setPayFor(entry)
    // Pré-preenche com o saldo em falta — o caso mais comum é pagar tudo.
    setPayAmount(entry.balance > 0 ? String(entry.balance.toFixed(2)) : '')
    setPayNotes('')
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">Inadimplência</h1>
        <p className="text-sm text-gray-400 mt-0.5">Controlo semanal da renda dos personal trainers</p>
      </div>

      {/* ── Em atraso (a informação que dói) ─────────────────────────────── */}
      {loadingDelinq ? (
        <Skeleton className="h-32 rounded-xl" />
      ) : (delinquency && delinquency.trainers.length > 0) ? (
        <div className="bg-white rounded-xl border border-red-100 overflow-hidden">
          <div className="px-4 py-3 bg-red-50 border-b border-red-100 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600" />
            <h2 className="text-sm font-bold text-red-800">Em atraso</h2>
            <span className="ml-auto text-sm font-black text-red-700">{formatCurrency(delinquency.totalOwed)} em dívida</span>
          </div>
          <ul className="divide-y divide-gray-50">
            {delinquency.trainers.map(t => (
              <li key={t.ptId} className="flex items-center gap-3 px-4 py-3">
                <span className={`w-9 h-9 rounded-full ${avatarColor(t.ptName)} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                  {getInitials(t.ptName)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900 truncate">{t.ptName}</p>
                  <p className="text-[11px] text-red-600 font-medium flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {t.weeksOverdue} semana{t.weeksOverdue > 1 ? 's' : ''} · {t.daysLate}d de atraso
                  </p>
                </div>
                <span className="text-sm font-black text-red-700">{formatCurrency(t.totalOwed)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="bg-emerald-50/60 border border-emerald-100 rounded-xl px-4 py-3 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span className="text-sm text-emerald-800 font-medium">Ninguém em atraso. Tudo em dia.</span>
        </div>
      )}

      {/* ── Cobrança da semana ───────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-gray-900">Cobrança da semana</h2>
          <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl p-1 shadow-sm">
            <button onClick={() => setWeekOffset(w => w - 1)} className="p-2 rounded-lg hover:bg-gray-100 min-h-[44px] min-w-[44px] flex items-center justify-center">
              <ChevronLeft className="w-4 h-4 text-gray-600" />
            </button>
            <span className="text-xs sm:text-sm font-semibold text-gray-700 px-2 min-w-[150px] text-center">
              {week ? `${fmtDay(week.periodStart)} – ${fmtDay(week.periodEnd)}` : (weekOffset === 0 ? 'Esta semana' : '…')}
            </span>
            <button onClick={() => setWeekOffset(w => w + 1)} className="p-2 rounded-lg hover:bg-gray-100 min-h-[44px] min-w-[44px] flex items-center justify-center">
              <ChevronRight className="w-4 h-4 text-gray-600" />
            </button>
          </div>
        </div>

        {week && (
          <p className="text-[11px] text-gray-400">
            Vence a <strong className="text-gray-600">{fmtDay(week.dueDate)}</strong> · Total: {formatCurrency(week.totalDue)}
            {week.totalBalance > 0 && <span className="text-red-600"> · Em falta: {formatCurrency(week.totalBalance)}</span>}
          </p>
        )}

        {loadingWeek ? (
          <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
        ) : !week || week.entries.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-100 text-sm text-gray-400">
            Ainda não há personal trainers ativos.
          </div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <ul className="divide-y divide-gray-50">
              {week.entries.map(e => {
                const s = STATUS_META[e.status]
                const semPlano = !e.planName
                return (
                  <li key={e.ptId} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3">
                    <span className={`w-9 h-9 rounded-full ${avatarColor(e.ptName)} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                      {getInitials(e.ptName)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-900 truncate">{e.ptName}</p>
                      {semPlano ? (
                        <p className="text-[11px] text-amber-600 font-medium">Sem plano atribuído — não gera renda</p>
                      ) : (
                        <p className="text-[11px] text-gray-400">
                          {e.planName}{e.hours > 0 && <> · {e.hours.toFixed(1)}h</>} · devido {formatCurrency(e.amountDue)}
                          {e.amountPaid > 0 && <> · pago {formatCurrency(e.amountPaid)}</>}
                        </p>
                      )}
                      {/* Início no estúdio + vencimento desta semana — o contexto
                          que faltava para o admin decidir a cobrança. */}
                      <p className="text-[11px] text-gray-400 flex items-center gap-1.5 flex-wrap mt-0.5">
                        <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" />desde {fmtDay(e.startDate)}</span>
                        {!semPlano && (
                          <span className="inline-flex items-center gap-1 text-gray-500">· vence {fmtDay(e.dueDate)}</span>
                        )}
                      </p>
                    </div>
                    {semPlano ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full border font-medium bg-amber-50 text-amber-700 border-amber-200 flex-shrink-0">Sem plano</span>
                    ) : (
                      <>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${s.cls} flex-shrink-0`}>{s.label}</span>
                        {e.balance > 0 ? (
                          <span className="text-sm font-bold text-gray-900 w-20 text-right tabular-nums">{formatCurrency(e.balance)}</span>
                        ) : (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        )}
                        <button
                          type="button"
                          onClick={() => openPay(e)}
                          className="inline-flex items-center gap-1 h-9 px-3 rounded-lg text-white text-xs font-semibold min-h-[44px] hover:opacity-90 transition-opacity flex-shrink-0"
                          style={{ background: '#111111' }}
                        >
                          <Wallet className="w-3.5 h-3.5" /> Receber
                        </button>
                      </>
                    )}
                  </li>
                )
              })}
            </ul>
          </motion.div>
        )}
      </div>

      {/* ── Modal: registar recebimento ──────────────────────────────────── */}
      {payFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setPayFor(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-900">Registar recebimento</h3>
              <button onClick={() => setPayFor(null)} className="p-2 rounded-lg hover:bg-gray-100 min-h-[44px] min-w-[44px] flex items-center justify-center">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="text-sm text-gray-600">
                <strong className="text-gray-900">{payFor.ptName}</strong> · semana {fmtDay(payFor.periodStart)}–{fmtDay(payFor.periodEnd)}
                <div className="text-[11px] text-gray-400 mt-0.5">
                  Devido {formatCurrency(payFor.amountDue)} · já pago {formatCurrency(payFor.amountPaid)} · em falta {formatCurrency(payFor.balance)}
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Valor recebido (€)</label>
                <div className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 min-h-[44px] focus-within:ring-2 focus-within:ring-gray-300">
                  <Euro className="w-4 h-4 text-gray-400" />
                  <input
                    type="text" inputMode="decimal" value={payAmount} autoFocus
                    onChange={e => setPayAmount(e.target.value)}
                    placeholder="0,00"
                    className="flex-1 text-base bg-transparent outline-none tabular-nums"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Nota (opcional)</label>
                <input
                  type="text" value={payNotes} onChange={e => setPayNotes(e.target.value)}
                  placeholder="Ex: MBWay, transferência…"
                  className="w-full min-h-[44px] px-3 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-gray-300"
                />
              </div>
              <button
                type="button"
                disabled={record.isPending || !(parseFloat(payAmount.replace(',', '.')) > 0)}
                onClick={() => record.mutate()}
                className="w-full h-11 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                style={{ background: '#111111' }}
              >
                {record.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Registar recebimento</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
