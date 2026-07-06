'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Calendar, CheckCircle2, Package, Loader2, X, Flame, Star, LayoutGrid, List } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import { format, addDays, startOfWeek, addWeeks } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { StatCard } from '@/components/ui/stat-card'
import { Skeleton } from '@/components/ui/skeleton'
import { CancelBookingDialog } from '@/components/cancel-booking-dialog'
import { dashboardApi, bookingApi, alunoApi, availabilityApi, ptApi } from '@/lib/api'
import { formatDate, formatTime, bookingStatusLabel, bookingStatusColor, cn, getInitials, avatarColor } from '@/lib/utils'
import { useAuthStore } from '@/store/auth'
import type { AlunoDashboard, RecentSession, Availability, Booking, Aluno, PersonalTrainer } from '@/types'

function hoursUntil(startTime: string): number {
  return (new Date(startTime).getTime() - Date.now()) / (1000 * 60 * 60)
}

const WEEKDAYS = [0, 1, 2, 3, 4, 5] // Mon–Sat

/* ── vacancy helpers — paleta unificada: verde=disponível, cinza=ocupado, azul=confirmado ── */
function vacancyDot(spots: number) {
  return spots === 0 ? 'bg-gray-300' : 'bg-emerald-500'
}
function vacancyText(spots: number) {
  if (spots === 0) return 'Lotado'
  if (spots === 1) return '1 vaga'
  return `${spots} vagas`
}
function vacancyColor(spots: number) {
  return spots === 0 ? 'text-gray-400' : 'text-emerald-700'
}

// The agenda IS the dashboard now — the student's home screen where he sees
// and creates bookings directly, no separate "Minhas Sessões" page.
function AgendaSection() {
  const qc = useQueryClient()
  const [weekOffset, setWeekOffset] = useState(0)
  const [view, setView] = useState<'agenda' | 'lista'>('agenda')
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [confirmCancel, setConfirmCancel] = useState<{ bookingId: string; availId: string; startTime: string; endTime: string } | null>(null)

  const monday = startOfWeek(addWeeks(new Date(), weekOffset), { weekStartsOn: 1 })
  const startDate = format(monday, "yyyy-MM-dd'T'00:00:00'Z'")
  const endDate = format(addDays(monday, 6), "yyyy-MM-dd'T'23:59:59'Z'")

  // Load only the aluno's own data — PT is fixed, never selectable
  const { data: me } = useQuery<Aluno>({ queryKey: ['aluno-me'], queryFn: alunoApi.me })
  const myPtId = me?.personalTrainerId

  const { data: pts = [] } = useQuery<PersonalTrainer[]>({
    queryKey: ['pts-active'],
    queryFn: ptApi.list,
    enabled: !!myPtId,
  })
  const myPt = pts.find(p => p.id === myPtId)

  const { data: slots = [], isLoading: slotsLoading } = useQuery<Availability[]>({
    queryKey: ['aluno-slots', weekOffset, myPtId],
    queryFn: () => availabilityApi.ptSlots(myPtId!, startDate, endDate),
    enabled: !!myPtId,
  })

  const { data: myBookings = [] } = useQuery<Booking[]>({
    queryKey: ['my-bookings'],
    queryFn: bookingApi.myBookings,
  })
  const bookedMap = new Map(
    myBookings.filter(b => b.status === 'CONFIRMED').map(b => [b.availabilityId, b.id])
  )

  const confirm = useMutation({
    mutationFn: bookingApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['aluno-slots'] })
      qc.invalidateQueries({ queryKey: ['my-bookings'] })
      qc.invalidateQueries({ queryKey: ['aluno-dashboard'] })
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Erro ao confirmar presença')
    },
  })

  const markAbsent = useMutation({
    mutationFn: bookingApi.cancel,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['aluno-slots'] })
      qc.invalidateQueries({ queryKey: ['my-bookings'] })
      qc.invalidateQueries({ queryKey: ['aluno-dashboard'] })
      toast.success('Falta marcada — o teu PT foi notificado')
    },
    onError: (e: Error) => toast.error(e.message || 'Cancela com pelo menos 24h de antecedência. Contacta o teu PT se precisares de ajuda.'),
  })

  async function handleConfirm(availId: string) {
    setLoadingId(availId)
    try {
      await confirm.mutateAsync(availId)
      toast.success('Presença confirmada! ✅')
    } finally {
      setLoadingId(null)
    }
  }

  async function handleMarkAbsent(bookingId: string, availId: string) {
    setCancellingId(availId)
    try {
      await markAbsent.mutateAsync(bookingId)
      setConfirmCancel(null)
    } finally { setCancellingId(null) }
  }

  const now = new Date()
  const futureSlots = slots.filter(s => new Date(s.startTime) > now)

  const grouped = futureSlots.reduce<Record<string, Availability[]>>((acc, s) => {
    const d = format(new Date(s.startTime), 'yyyy-MM-dd')
    ;(acc[d] ??= []).push(s)
    return acc
  }, {})
  const sortedDays = Object.keys(grouped).sort()

  // Grid (Agenda view) — same future slots, indexed by date+time for a
  // Mon–Sat x horário layout, mirroring the PT's own weekly calendar.
  const slotMap: Record<string, Availability> = {}
  for (const s of futureSlots) {
    const key = `${format(new Date(s.startTime), 'yyyy-MM-dd')}-${format(new Date(s.startTime), 'HH:mm')}`
    slotMap[key] = s
  }
  const allTimes = [...new Set(futureSlots.map(s => format(new Date(s.startTime), 'HH:mm')))].sort()

  const confirmedThisWeek = [...bookedMap.keys()].filter(id => slots.some(s => s.id === id)).length
  const isLoading = slotsLoading || !me

  return (
    <div className="space-y-4">
      {/* Pack banner */}
      {slots[0]?.packRemaining !== undefined && (
        <div className={`rounded-xl border px-4 py-3 text-sm flex items-center gap-2 ${
          slots[0].packRemaining > 0
            ? 'bg-emerald-50 border-emerald-100 text-emerald-800'
            : 'bg-amber-50 border-amber-100 text-amber-800'
        }`}>
          <span>{slots[0].packRemaining > 0 ? '✅' : '⚠️'}</span>
          <span>
            {slots[0].packRemaining > 0
              ? <><strong>{slots[0].packRemaining}</strong> sessões disponíveis para agendar · Duração: <strong>{slots[0].sessionDuration} min</strong></>
              : 'Sem sessões no pack — fala com o teu PT para carregar mais'
            }
          </span>
        </div>
      )}

      {/* PT info — read-only, no selector */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.12em] mb-3">O teu Personal Trainer</p>
        {!myPt ? (
          <Skeleton className="h-12 rounded-lg" />
        ) : (
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-black text-white flex-shrink-0"
              style={{ background: avatarColor(myPt.name) }}
            >
              {getInitials(myPt.name)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-900">{myPt.name}</p>
              {myPt.specialty && <p className="text-xs text-gray-400 truncate">{myPt.specialty}</p>}
            </div>
            <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full flex-shrink-0">
              Ativo
            </span>
          </div>
        )}
      </div>

      {/* Week toggle + agenda/lista toggle + confirmed badge */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex bg-gray-100 rounded-lg p-0.5 gap-0.5">
          {['Sem 1', 'Sem 2', 'Sem 3', 'Sem 4'].map((label, idx) => (
            <button
              key={label}
              onClick={() => setWeekOffset(idx)}
              className={cn(
                'px-3 py-2 text-xs font-semibold rounded-md transition-all min-h-[36px]',
                weekOffset === idx ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => setView('agenda')}
              className={cn(
                'flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors min-h-[32px]',
                view === 'agenda' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500',
              )}
            >
              <LayoutGrid className="w-3.5 h-3.5" /> Agenda
            </button>
            <button
              onClick={() => setView('lista')}
              className={cn(
                'flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors min-h-[32px]',
                view === 'lista' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500',
              )}
            >
              <List className="w-3.5 h-3.5" /> Lista
            </button>
          </div>
          {confirmedThisWeek > 0 && (
            <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
              <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
              <span><strong>{confirmedThisWeek}</strong> confirmada{confirmedThisWeek !== 1 ? 's' : ''} esta semana</span>
            </div>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      ) : sortedDays.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
          <p className="text-gray-500 text-sm font-semibold">Sem sessões disponíveis</p>
          <p className="text-gray-300 text-xs mt-1">{myPt?.name} ainda não tem horários para esta semana</p>
        </div>
      ) : view === 'agenda' ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <div className="min-w-[560px] p-3">
              {/* Day headers */}
              <div className="grid gap-1 mb-1" style={{ gridTemplateColumns: `52px repeat(6, minmax(0, 1fr))` }}>
                <div />
                {WEEKDAYS.map(d => {
                  const date = addDays(monday, d)
                  return (
                    <div key={d} className="text-center py-1">
                      <p className="text-[10px] font-bold text-gray-400 uppercase">{format(date, 'EEE', { locale: ptBR })}</p>
                      <p className="text-[10px] text-gray-300">{format(date, 'd')}</p>
                    </div>
                  )
                })}
              </div>

              {/* Time rows */}
              <div className="space-y-0.5">
                {allTimes.map(time => (
                  <div key={time} className="grid gap-1 items-center" style={{ gridTemplateColumns: `52px repeat(6, minmax(0, 1fr))` }}>
                    <span className="text-[9px] font-mono text-gray-300 text-right pr-1.5 leading-none">{time}</span>
                    {WEEKDAYS.map(d => {
                      const date = addDays(monday, d)
                      const dateStr = format(date, 'yyyy-MM-dd')
                      const slot = slotMap[`${dateStr}-${time}`]
                      if (!slot) return <div key={d} className="h-9" />

                      const confirmed = bookedMap.has(slot.id)
                      const bookingId = bookedMap.get(slot.id)
                      const spotsLeft = slot.availableSlots ?? Math.max(0, slot.maxAlunos - slot.confirmedCount)
                      const full = spotsLeft === 0 && !confirmed
                      const isLoadingThis = loadingId === slot.id || cancellingId === slot.id

                      return (
                        <button
                          key={d}
                          disabled={isLoadingThis || (full && !confirmed)}
                          onClick={() => {
                            if (confirmed) {
                              bookingId && setConfirmCancel({ bookingId, availId: slot.id, startTime: slot.startTime, endTime: slot.endTime })
                            } else if (!full) {
                              handleConfirm(slot.id)
                            }
                          }}
                          className={cn(
                            'h-9 rounded-md flex items-center justify-center px-1 transition-opacity',
                            confirmed
                              ? 'bg-blue-600 text-white hover:opacity-80 cursor-pointer'
                              : full
                                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                : 'bg-emerald-500 text-white hover:bg-emerald-600 cursor-pointer',
                            isLoadingThis && 'opacity-50',
                          )}
                        >
                          {isLoadingThis ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : confirmed ? (
                            <span className="text-[9px] font-bold leading-none">Confirmado</span>
                          ) : full ? (
                            <span className="text-[9px] opacity-80">lotado</span>
                          ) : (
                            <span className="text-[9px] font-bold leading-none">{spotsLeft} vagas</span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                ))}
              </div>

              {/* Legend — paleta unificada: verde=disponível, cinza=ocupado, azul=confirmado */}
              <div className="flex gap-4 mt-3 px-1">
                {[
                  { color: 'bg-emerald-500', label: 'Disponível' },
                  { color: 'bg-blue-600', label: 'Confirmado' },
                  { color: 'bg-gray-300', label: 'Ocupado' },
                ].map(({ color, label }) => (
                  <span key={label} className="flex items-center gap-1 text-[9px] text-gray-400">
                    <span className={cn('w-2 h-2 rounded-sm', color)} />
                    {label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {sortedDays.map((dateStr, di) => {
            const dayLabel = format(new Date(dateStr + 'T12:00:00'), "EEEE, d 'de' MMMM", { locale: ptBR })
            const daySlots = grouped[dateStr].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
            const maxBooked = Math.max(...daySlots.map(s => s.confirmedCount))

            return (
              <motion.div
                key={dateStr}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: di * 0.05 }}
                className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"
              >
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                  <p className="text-xs font-black text-gray-700 capitalize">{dayLabel}</p>
                  <span className="text-[10px] font-semibold text-gray-400">
                    {daySlots.length} horário{daySlots.length !== 1 ? 's' : ''}
                  </span>
                </div>

                <div className="divide-y divide-gray-50">
                  {daySlots.map(slot => {
                    const confirmed = bookedMap.has(slot.id)
                    const bookingId = bookedMap.get(slot.id)
                    const isLoadingThis = loadingId === slot.id || cancellingId === slot.id
                    const spotsLeft = slot.availableSlots ?? Math.max(0, slot.maxAlunos - slot.confirmedCount)
                    const full = spotsLeft === 0 && !confirmed
                    const isPopular = !confirmed && !full && slot.confirmedCount > 0 && slot.confirmedCount === maxBooked && maxBooked > 0
                    const isLastSpot = !confirmed && spotsLeft === 1

                    return (
                      <div key={slot.id} className="flex items-center px-4 py-3.5 gap-3">
                        <div className="flex-shrink-0 w-16 sm:w-20">
                          <p className="text-sm font-black text-gray-900 tabular-nums">
                            {formatTime(slot.startTime)}
                          </p>
                        </div>

                        <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
                          {confirmed ? (
                            <div className="flex items-center gap-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                              <span className="text-xs font-semibold text-blue-700">Confirmado</span>
                            </div>
                          ) : full ? (
                            <div className="flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-gray-300 flex-shrink-0" />
                              <span className="text-xs font-medium text-gray-400">Lotado</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={cn('w-2 h-2 rounded-full flex-shrink-0', vacancyDot(spotsLeft))} />
                              <span className={cn('text-xs font-semibold', vacancyColor(spotsLeft))}>
                                {vacancyText(spotsLeft)}
                              </span>
                              {isLastSpot && (
                                <span className="flex items-center gap-0.5 text-[10px] font-black text-orange-600 bg-orange-50 border border-orange-100 px-1.5 py-0.5 rounded-full">
                                  <Flame className="w-2.5 h-2.5" /> Última vaga
                                </span>
                              )}
                              {isPopular && (
                                <span className="flex items-center gap-0.5 text-[10px] font-black text-blue-600 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded-full">
                                  <Star className="w-2.5 h-2.5" /> Popular
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="flex-shrink-0">
                          <AnimatePresence mode="wait">
                            {confirmed ? (
                              <motion.button
                                key="cancel"
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => bookingId && setConfirmCancel({ bookingId, availId: slot.id, startTime: slot.startTime, endTime: slot.endTime })}
                                disabled={isLoadingThis}
                                className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-red-500 border border-gray-200 hover:border-red-200 hover:bg-red-50 rounded-lg px-3 min-h-[44px] transition-all disabled:opacity-50"
                                title="Marcar falta"
                              >
                                {isLoadingThis
                                  ? <Loader2 className="w-3 h-3 animate-spin" />
                                  : <><X className="w-3 h-3" /><span className="hidden sm:inline">Falta</span></>
                                }
                              </motion.button>
                            ) : full ? (
                              <span className="text-xs text-gray-300 font-medium px-3 py-2 min-h-[44px] flex items-center">—</span>
                            ) : (
                              <motion.button
                                key="confirm"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                onClick={() => handleConfirm(slot.id)}
                                disabled={isLoadingThis}
                                className="min-w-[110px] sm:min-w-[130px] min-h-[44px] text-xs font-black text-white rounded-lg transition-all flex items-center justify-center gap-1.5 disabled:opacity-60 active:scale-95"
                                style={{ background: '#111111' }}
                              >
                                {isLoadingThis
                                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  : <><CheckCircle2 className="w-3.5 h-3.5" /><span>Agendar</span></>
                                }
                              </motion.button>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </motion.div>
            )
          })}
        </div>
      )}

      {confirmCancel && (
        <CancelBookingDialog
          open={!!confirmCancel}
          onOpenChange={(o) => !o && setConfirmCancel(null)}
          startTime={confirmCancel.startTime}
          endTime={confirmCancel.endTime}
          ptName={myPt?.name}
          isPending={cancellingId === confirmCancel.availId}
          onConfirm={() => handleMarkAbsent(confirmCancel.bookingId, confirmCancel.availId)}
        />
      )}
    </div>
  )
}

export default function AlunoDashboardPage() {
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const [confirmCancel, setConfirmCancel] = useState<RecentSession | null>(null)

  const { data, isLoading } = useQuery<AlunoDashboard>({
    queryKey: ['aluno-dashboard'],
    queryFn: dashboardApi.aluno,
  })

  const cancelMutation = useMutation({
    mutationFn: bookingApi.cancel,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['aluno-dashboard'] })
      qc.invalidateQueries({ queryKey: ['my-bookings'] })
      qc.invalidateQueries({ queryKey: ['aluno-slots'] })
      toast.success('Sessão cancelada')
      setConfirmCancel(null)
    },
    onError: (e: Error) => toast.error(e.message || 'Não foi possível cancelar esta sessão'),
  })

  return (
    <div className="p-5 lg:p-7 space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-black text-gray-900 tracking-tight">Olá, {user?.name?.split(' ')[0]} 👋</h1>
        {data?.ptName && (
          <p className="text-sm text-gray-400 mt-0.5">O teu Personal Trainer: <span className="font-medium text-gray-600">{data.ptName}</span></p>
        )}
        {data?.ptBillingCycleDay && (
          <p className="text-xs text-gray-300 mt-1">
            Ciclo de pagamento do teu PT com o estúdio fecha todo dia <strong className="text-gray-400">{data.ptBillingCycleDay}</strong> — não afeta as tuas sessões
          </p>
        )}
      </motion.div>

      {/* Next session banner */}
      {!isLoading && data?.nextSession && (
        <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.05 }}>
          <div className="rounded-xl p-5 text-white" style={{ background: '#111111' }}>
            <p className="text-white/60 text-xs font-medium uppercase tracking-wide mb-3">Próxima Sessão</p>
            <p className="text-2xl font-bold">{formatDate(data.nextSession.startTime)}</p>
            <p className="text-white/80 mt-1">{formatTime(data.nextSession.startTime)} — {formatTime(data.nextSession.endTime)}</p>
            <div className="mt-3 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#C9A84C' }} />
              <span className="text-sm text-white/70">Confirmada com {data.ptName}</span>
            </div>
          </div>
        </motion.div>
      )}

      {/* Stats */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-4">
          {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <StatCard title="Sessões Agendadas" value={data?.upcomingCount ?? 0} icon={Calendar} iconColor="#C9A84C" delay={0.1} />
          <StatCard title="Sessões Realizadas" value={data?.completedCount ?? 0} icon={CheckCircle2} iconColor="#C9A84C" delay={0.15} />
        </div>
      )}

      {/* Pack / Contract summary */}
      {!isLoading && data?.pack && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-50 flex items-center gap-2">
              <Package className="w-4 h-4 text-gray-400" />
              <h2 className="text-sm font-semibold text-gray-900">O meu pack</h2>
            </div>
            <div className="grid grid-cols-3 divide-x divide-gray-50">
              <div className="px-4 py-4 text-center">
                <p className="text-2xl font-black text-gray-900">{data.pack.remaining}</p>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mt-0.5">Restantes</p>
                <p className="text-[10px] text-gray-300 mt-0.5">de {data.pack.total}</p>
              </div>
              <div className="px-4 py-4 text-center">
                <p className="text-2xl font-black text-gray-900">{data.pack.sessionDuration}<span className="text-sm font-medium text-gray-400">min</span></p>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mt-0.5">Por sessão</p>
              </div>
              <div className="px-4 py-4 text-center">
                {data.pack.expiresAt ? (
                  <>
                    <p className="text-sm font-black text-gray-900 leading-tight">
                      {new Date(data.pack.expiresAt).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                    </p>
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mt-0.5">Validade</p>
                  </>
                ) : (
                  <p className="text-xs text-gray-400">—</p>
                )}
              </div>
            </div>
            {/* progress bar */}
            <div className="px-5 pb-4">
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all', data.pack.remaining <= 2 ? 'bg-orange-400' : 'bg-emerald-500')}
                  style={{ width: `${Math.round((data.pack.remaining / data.pack.total) * 100)}%` }}
                />
              </div>
              {data.pack.remaining <= 3 && (
                <p className="text-[10px] text-orange-600 font-medium mt-1.5">Pack a acabar — fala com o teu PT para renovar</p>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* Agenda — the dashboard IS the booking screen now */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Agenda</h2>
        <AgendaSection />
      </motion.div>

      {/* Recent sessions */}
      {!isLoading && (data?.recentSessions ?? []).length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"
        >
          <h2 className="text-sm font-semibold text-gray-900 px-5 py-4 border-b border-gray-50">Últimas Sessões</h2>
          <div className="divide-y divide-gray-50">
            {data!.recentSessions.map((s, i) => {
              const cancellable = s.status === 'CONFIRMED' && hoursUntil(s.startTime) > 0
              return (
                <div
                  key={s.bookingId ?? i}
                  onClick={() => cancellable && setConfirmCancel(s)}
                  className={cn(
                    'flex items-center justify-between px-5 py-3.5',
                    cancellable && 'cursor-pointer hover:bg-gray-50 transition-colors'
                  )}
                >
                  <div>
                    <p className="text-sm text-gray-900">{formatDate(s.startTime)}</p>
                    <p className="text-xs text-gray-400">{formatTime(s.startTime)} — {formatTime(s.endTime)}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${bookingStatusColor(s.status)}`}>
                    {bookingStatusLabel(s.status)}
                  </span>
                </div>
              )
            })}
          </div>
          <div className="px-5 py-3 border-t border-gray-50">
            <Link href="/aluno/history" className="text-xs font-medium hover:underline" style={{ color: '#C9A84C' }}>Ver histórico completo →</Link>
          </div>
        </motion.div>
      )}

      {confirmCancel && (
        <CancelBookingDialog
          open={!!confirmCancel}
          onOpenChange={(o) => !o && setConfirmCancel(null)}
          startTime={confirmCancel.startTime}
          endTime={confirmCancel.endTime}
          ptName={confirmCancel.ptName}
          isPending={cancelMutation.isPending}
          onConfirm={() => cancelMutation.mutate(confirmCancel.bookingId)}
        />
      )}
    </div>
  )
}
