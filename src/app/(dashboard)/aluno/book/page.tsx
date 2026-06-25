'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, Loader2, X, ChevronDown, User, Flame, Star } from 'lucide-react'
import { toast } from 'sonner'
import { format, addDays, startOfWeek, addWeeks } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Skeleton } from '@/components/ui/skeleton'
import { alunoApi, availabilityApi, bookingApi, ptApi } from '@/lib/api'
import { formatTime, cn, getInitials, avatarColor } from '@/lib/utils'
import type { Availability, Booking, Aluno, PersonalTrainer } from '@/types'

/* ── vacancy helpers ──────────────────────────────────────────────── */
function vacancyDot(spots: number) {
  if (spots === 0) return 'bg-gray-300'
  if (spots === 1) return 'bg-orange-400'
  if (spots === 2) return 'bg-amber-400'
  return 'bg-emerald-500'
}
function vacancyText(spots: number, max: number) {
  if (spots === 0) return 'Lotado'
  if (spots === 1) return '1 vaga'
  return `${spots} vagas`
}
function vacancyColor(spots: number) {
  if (spots === 0) return 'text-gray-400'
  if (spots === 1) return 'text-orange-600'
  if (spots === 2) return 'text-amber-600'
  return 'text-emerald-700'
}

export default function MinhasSessionsPage() {
  const qc = useQueryClient()
  const [weekOffset, setWeekOffset] = useState(0)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [selectedPtId, setSelectedPtId] = useState<string | null>(null)
  const [ptDropdownOpen, setPtDropdownOpen] = useState(false)

  const monday = startOfWeek(addWeeks(new Date(), weekOffset), { weekStartsOn: 1 })
  const startDate = format(monday, "yyyy-MM-dd'T'00:00:00'Z'")
  const endDate = format(addDays(monday, 6), "yyyy-MM-dd'T'23:59:59'Z'")

  const { data: me } = useQuery<Aluno>({ queryKey: ['aluno-me'], queryFn: alunoApi.me })
  const { data: pts = [], isLoading: ptsLoading } = useQuery<PersonalTrainer[]>({ queryKey: ['pts-active'], queryFn: ptApi.list })
  const activePts = pts.filter(p => p.active)

  useEffect(() => {
    if (selectedPtId) return
    const defaultId = me?.personalTrainerId ?? activePts[0]?.id
    if (defaultId) setSelectedPtId(defaultId)
  }, [me, activePts, selectedPtId])

  const selectedPt = activePts.find(p => p.id === selectedPtId)

  const { data: slots = [], isLoading: slotsLoading } = useQuery<Availability[]>({
    queryKey: ['aluno-slots', weekOffset, selectedPtId],
    queryFn: () => availabilityApi.ptSlots(selectedPtId!, startDate, endDate),
    enabled: !!selectedPtId,
  })

  const { data: myBookings = [] } = useQuery<Booking[]>({ queryKey: ['my-bookings'], queryFn: bookingApi.myBookings })
  const bookedMap = new Map(myBookings.filter(b => b.status === 'CONFIRMED').map(b => [b.availabilityId, b.id]))

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
    onError: (e: Error) => toast.error(e.message || 'Cancela com pelo menos 24h de antecedência'),
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
    try { await markAbsent.mutateAsync(bookingId) } finally { setCancellingId(null) }
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
  const isLoading = ptsLoading || slotsLoading || !me

  return (
    <div className="p-4 lg:p-7 space-y-5 max-w-2xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-xl font-black text-gray-900 tracking-tight">Agendar Sessão</h1>
        <p className="text-sm text-gray-400 mt-0.5">Confirma a tua presença nos horários disponíveis do teu PT</p>
      </div>
      {/* Pack info banner */}
      {slots[0]?.packRemaining !== undefined && (
        <div className={`rounded-xl border px-4 py-3 text-sm flex items-center gap-2 ${slots[0].packRemaining > 0 ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-amber-50 border-amber-100 text-amber-800'}`}>
          <span>{slots[0].packRemaining > 0 ? '✅' : '⚠️'}</span>
          <span>
            {slots[0].packRemaining > 0
              ? <><strong>{slots[0].packRemaining}</strong> sessões disponíveis no teu pack · Duração: <strong>{slots[0].sessionDuration} min</strong></>
              : 'Sem sessões no pack — fala com o teu PT para carregar mais'
            }
          </span>
        </div>
      )}

      {/* PT Selector */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-2 shadow-sm">
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.12em]">Personal Trainer</p>
        {ptsLoading ? <Skeleton className="h-12 rounded-lg" /> : (
          <div className="relative">
            <button
              onClick={() => setPtDropdownOpen(o => !o)}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 transition-colors text-left min-h-[52px]"
            >
              {selectedPt ? (
                <>
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-black text-white flex-shrink-0"
                    style={{ background: avatarColor(selectedPt.name) }}>
                    {getInitials(selectedPt.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900">{selectedPt.name}</p>
                    {selectedPt.specialty && <p className="text-xs text-gray-400 truncate">{selectedPt.specialty}</p>}
                  </div>
                  {me?.personalTrainerId === selectedPt.id && (
                    <span className="text-[10px] font-black text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full flex-shrink-0">
                      O meu PT
                    </span>
                  )}
                </>
              ) : (
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <User className="w-4 h-4" /><span>Selecionar Personal Trainer</span>
                </div>
              )}
              <ChevronDown className={cn('w-4 h-4 text-gray-400 flex-shrink-0 transition-transform', ptDropdownOpen && 'rotate-180')} />
            </button>

            <AnimatePresence>
              {ptDropdownOpen && (
                <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                  className="absolute z-20 top-full mt-1 left-0 right-0 bg-white rounded-xl border border-gray-200 shadow-xl overflow-hidden">
                  {activePts.map(pt => (
                    <button key={pt.id}
                      onClick={() => { setSelectedPtId(pt.id); setPtDropdownOpen(false); setWeekOffset(0) }}
                      className={cn('w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left border-b border-gray-50 last:border-0',
                        selectedPtId === pt.id && 'bg-blue-50')}>
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black text-white flex-shrink-0"
                        style={{ background: avatarColor(pt.name) }}>
                        {getInitials(pt.name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900">{pt.name}</p>
                        {pt.specialty && <p className="text-xs text-gray-400 truncate">{pt.specialty}</p>}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {me?.personalTrainerId === pt.id && (
                          <span className="text-[10px] font-black text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full">O meu PT</span>
                        )}
                        {selectedPtId === pt.id && <CheckCircle2 className="w-4 h-4 text-blue-500" />}
                      </div>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Week toggle + confirmed badge */}
      {selectedPtId && (
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex bg-gray-100 rounded-lg p-0.5 gap-0.5">
            {['Esta semana', 'Próxima semana'].map((label, idx) => (
              <button key={label} onClick={() => setWeekOffset(idx)}
                className={cn('px-4 py-2 text-xs font-semibold rounded-md transition-all min-h-[36px]',
                  weekOffset === idx ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
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
      )}

      {/* Session list */}
      {isLoading ? (
        <div className="space-y-4">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
      ) : !selectedPtId ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
          <User className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 text-sm font-medium">Seleciona um personal trainer</p>
        </div>
      ) : sortedDays.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
          <p className="text-gray-500 text-sm font-semibold">Sem sessões disponíveis</p>
          <p className="text-gray-300 text-xs mt-1">{selectedPt?.name} ainda não tem horários para esta semana</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sortedDays.map((dateStr, di) => {
            const dayLabel = format(new Date(dateStr + 'T12:00:00'), "EEEE, d 'de' MMMM", { locale: ptBR })
            const daySlots = grouped[dateStr].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())

            // find the "popular" slot (most confirmed bookings, at least 1)
            const maxBooked = Math.max(...daySlots.map(s => s.confirmedCount))

            return (
              <motion.div key={dateStr} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: di * 0.05 }}
                className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">

                {/* Day header */}
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                  <p className="text-xs font-black text-gray-700 capitalize">{dayLabel}</p>
                  <span className="text-[10px] font-semibold text-gray-400">{daySlots.length} horário{daySlots.length !== 1 ? 's' : ''}</span>
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
                        {/* Time */}
                        <div className="flex-shrink-0 w-24 sm:w-28">
                          <p className="text-sm font-black text-gray-900 tabular-nums">
                            {formatTime(slot.startTime)}
                            <span className="text-gray-300 font-normal mx-0.5">–</span>
                            {formatTime(slot.endTime)}
                          </p>
                        </div>

                        {/* Vacancy indicator */}
                        <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
                          {confirmed ? (
                            <div className="flex items-center gap-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                              <span className="text-xs font-semibold text-emerald-700">Confirmado</span>
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
                                {vacancyText(spotsLeft, slot.maxAlunos)}
                              </span>
                              {isLastSpot && (
                                <span className="flex items-center gap-0.5 text-[10px] font-black text-orange-600 bg-orange-50 border border-orange-100 px-1.5 py-0.5 rounded-full">
                                  <Flame className="w-2.5 h-2.5" />Última vaga
                                </span>
                              )}
                              {isPopular && (
                                <span className="flex items-center gap-0.5 text-[10px] font-black text-blue-600 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded-full">
                                  <Star className="w-2.5 h-2.5" />Popular
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Action button */}
                        <div className="flex-shrink-0">
                          <AnimatePresence mode="wait">
                            {confirmed ? (
                              <motion.button key="cancel" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                                onClick={() => bookingId && handleMarkAbsent(bookingId, slot.id)}
                                disabled={isLoadingThis}
                                className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-red-500 border border-gray-200 hover:border-red-200 hover:bg-red-50 rounded-lg px-3 min-h-[44px] transition-all disabled:opacity-50"
                                title="Marcar falta">
                                {isLoadingThis ? <Loader2 className="w-3 h-3 animate-spin" /> : <><X className="w-3 h-3" /><span className="hidden sm:inline">Falta</span></>}
                              </motion.button>
                            ) : full ? (
                              <span className="text-xs text-gray-300 font-medium px-3 py-2 min-h-[44px] flex items-center">—</span>
                            ) : (
                              <motion.button key="confirm" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                onClick={() => handleConfirm(slot.id)}
                                disabled={isLoadingThis}
                                className="min-w-[110px] sm:min-w-[130px] min-h-[44px] text-xs font-black text-white rounded-lg transition-all flex items-center justify-center gap-1.5 disabled:opacity-60 active:scale-95"
                                style={{ background: '#111111' }}>
                                {isLoadingThis
                                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  : <><CheckCircle2 className="w-3.5 h-3.5" /><span>Confirmar</span></>
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
    </div>
  )
}
