'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, Loader2, X, Flame, Star } from 'lucide-react'
import { toast } from 'sonner'
import { format, addDays, startOfWeek, addWeeks } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Skeleton } from '@/components/ui/skeleton'
import { CancelBookingDialog } from '@/components/cancel-booking-dialog'
import { alunoApi, availabilityApi, bookingApi, ptApi } from '@/lib/api'
import { formatTime, cn, getInitials, avatarColor } from '@/lib/utils'
import type { Availability, Booking, Aluno, PersonalTrainer } from '@/types'

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

export default function MinhasSessionsPage() {
  const qc = useQueryClient()
  const [weekOffset, setWeekOffset] = useState(0)
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
  const grouped = slots.reduce<Record<string, Availability[]>>((acc, s) => {
    if (new Date(s.startTime) <= now) return acc
    const d = format(new Date(s.startTime), 'yyyy-MM-dd')
    ;(acc[d] ??= []).push(s)
    return acc
  }, {})
  const sortedDays = Object.keys(grouped).sort()

  const confirmedThisWeek = [...bookedMap.keys()].filter(id => slots.some(s => s.id === id)).length
  const isLoading = slotsLoading || !me

  return (
    <div className="p-4 lg:p-7 space-y-5 max-w-2xl mx-auto">

      {/* Header */}
      <div>
        <h1 className="text-xl font-black text-gray-900 tracking-tight">Agendar Sessão</h1>
        <p className="text-sm text-gray-400 mt-0.5">Confirma a tua presença nos horários do teu PT</p>
      </div>

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

      {/* Week toggle + confirmed badge */}
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
        {confirmedThisWeek > 0 && (
          <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
            <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
            <span><strong>{confirmedThisWeek}</strong> confirmada{confirmedThisWeek !== 1 ? 's' : ''} esta semana</span>
          </div>
        )}
      </div>

      {/* Session list */}
      {isLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      ) : sortedDays.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
          <p className="text-gray-500 text-sm font-semibold">Sem sessões disponíveis</p>
          <p className="text-gray-300 text-xs mt-1">{myPt?.name} ainda não tem horários para esta semana</p>
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
