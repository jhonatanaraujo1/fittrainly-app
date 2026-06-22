'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, Loader2, X, AlertCircle, ChevronDown, User } from 'lucide-react'
import { toast } from 'sonner'
import { format, addDays, startOfWeek, addWeeks } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Skeleton } from '@/components/ui/skeleton'
import { alunoApi, availabilityApi, bookingApi, ptApi } from '@/lib/api'
import { formatTime, cn, getInitials, avatarColor } from '@/lib/utils'
import type { Availability, Booking, Aluno, PersonalTrainer } from '@/types'

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

  const { data: me } = useQuery<Aluno>({
    queryKey: ['aluno-me'],
    queryFn: alunoApi.me,
  })

  const { data: pts = [], isLoading: ptsLoading } = useQuery<PersonalTrainer[]>({
    queryKey: ['pts-active'],
    queryFn: ptApi.list,
  })

  const activePts = pts.filter(p => p.active)

  // Inicializa com o PT do aluno, ou o primeiro da lista
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
    onError: () => toast.error('Cancela com pelo menos 2h de antecedência'),
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
    } finally {
      setCancellingId(null)
    }
  }

  const now = new Date()
  const grouped = slots.reduce<Record<string, Availability[]>>((acc, s) => {
    if (new Date(s.startTime) <= now) return acc
    const d = format(new Date(s.startTime), 'yyyy-MM-dd')
    ;(acc[d] ??= []).push(s)
    return acc
  }, {})
  const sortedDays = Object.keys(grouped).sort()

  const confirmedThisWeek = [...bookedMap.keys()].filter(id =>
    slots.some(s => s.id === id)
  ).length

  const isLoading = ptsLoading || slotsLoading || !me

  return (
    <div className="p-5 lg:p-7 space-y-5 max-w-2xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Minhas Sessões</h1>
        <p className="text-sm text-gray-400 mt-0.5">Escolhe um personal trainer e confirma a tua presença</p>
      </div>

      {/* PT Selector */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-2">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Personal Trainer</p>
        {ptsLoading ? (
          <Skeleton className="h-12 rounded-lg" />
        ) : (
          <div className="relative">
            <button
              onClick={() => setPtDropdownOpen(o => !o)}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
            >
              {selectedPt ? (
                <>
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                    style={{ background: avatarColor(selectedPt.name) }}
                  >
                    {getInitials(selectedPt.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{selectedPt.name}</p>
                    {selectedPt.specialty && (
                      <p className="text-xs text-gray-400 truncate">{selectedPt.specialty}</p>
                    )}
                  </div>
                  {me?.personalTrainerId === selectedPt.id && (
                    <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full flex-shrink-0">
                      O meu PT
                    </span>
                  )}
                </>
              ) : (
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <User className="w-4 h-4" />
                  Selecionar Personal Trainer
                </div>
              )}
              <ChevronDown className={cn('w-4 h-4 text-gray-400 flex-shrink-0 transition-transform', ptDropdownOpen && 'rotate-180')} />
            </button>

            <AnimatePresence>
              {ptDropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="absolute z-20 top-full mt-1 left-0 right-0 bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden"
                >
                  {activePts.map(pt => (
                    <button
                      key={pt.id}
                      onClick={() => { setSelectedPtId(pt.id); setPtDropdownOpen(false); setWeekOffset(0) }}
                      className={cn(
                        'w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left border-b border-gray-50 last:border-0',
                        selectedPtId === pt.id && 'bg-blue-50'
                      )}
                    >
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                        style={{ background: avatarColor(pt.name) }}
                      >
                        {getInitials(pt.name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900">{pt.name}</p>
                        {pt.specialty && <p className="text-xs text-gray-400 truncate">{pt.specialty}</p>}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {me?.personalTrainerId === pt.id && (
                          <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full">
                            O meu PT
                          </span>
                        )}
                        {selectedPtId === pt.id && (
                          <CheckCircle2 className="w-4 h-4 text-blue-500" />
                        )}
                      </div>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Week selector */}
      {selectedPtId && (
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex bg-gray-100 rounded-lg p-0.5 gap-0.5">
            {['Esta semana', 'Próxima semana'].map((label, idx) => (
              <button key={label} onClick={() => setWeekOffset(idx)}
                className={cn('px-3 py-1.5 text-xs font-medium rounded-md transition-all',
                  weekOffset === idx ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
                {label}
              </button>
            ))}
          </div>

          {confirmedThisWeek > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
              <span><strong>{confirmedThisWeek}</strong> confirmada{confirmedThisWeek !== 1 ? 's' : ''} esta semana</span>
            </div>
          )}
        </div>
      )}

      {/* Info */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 flex items-start gap-2">
        <AlertCircle className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-blue-700">
          Confirma a tua presença para cada sessão ou marca falta com antecedência. O teu PT fica a saber.
        </p>
      </div>

      {/* Session list */}
      {isLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      ) : !selectedPtId ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
          <User className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Seleciona um personal trainer para ver os horários</p>
        </div>
      ) : sortedDays.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
          <p className="text-gray-400 text-sm">Sem sessões disponíveis nesta semana</p>
          <p className="text-gray-300 text-xs mt-1">
            {selectedPt?.name} ainda não definiu o horário
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {sortedDays.map((dateStr, di) => {
            const dayLabel = format(new Date(dateStr + 'T12:00:00'), "EEEE, d 'de' MMMM", { locale: ptBR })
            const daySlots = grouped[dateStr].sort((a, b) =>
              new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
            )
            return (
              <motion.div key={dateStr} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: di * 0.05 }}
                className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
                  <p className="text-xs font-semibold text-gray-600 capitalize">{dayLabel}</p>
                </div>
                <div className="divide-y divide-gray-50">
                  {daySlots.map(slot => {
                    const confirmed = bookedMap.has(slot.id)
                    const bookingId = bookedMap.get(slot.id)
                    const isLoadingThis = loadingId === slot.id || cancellingId === slot.id
                    const spotsLeft = slot.availableSlots
                    const full = spotsLeft === 0 && !confirmed

                    return (
                      <div key={slot.id} className="flex items-center justify-between px-4 py-3.5 gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900">
                            {formatTime(slot.startTime)}
                            <span className="text-gray-300 font-normal"> – </span>
                            {formatTime(slot.endTime)}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {full ? 'Turma cheia'
                              : spotsLeft === 1 ? '⚡ Última vaga!'
                              : `${slot.maxAlunos - spotsLeft} de ${slot.maxAlunos} alunos confirmados`}
                          </p>
                        </div>

                        <AnimatePresence mode="wait">
                          {confirmed ? (
                            <motion.div key="confirmed" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                              className="flex items-center gap-2 flex-shrink-0">
                              <div className="flex items-center gap-1.5 text-emerald-600 text-xs font-medium">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Confirmado
                              </div>
                              <button onClick={() => bookingId && handleMarkAbsent(bookingId, slot.id)} disabled={isLoadingThis}
                                className="text-xs text-gray-300 hover:text-red-400 transition-colors flex items-center gap-1 border border-gray-200 hover:border-red-200 rounded-md px-2.5 min-h-[44px]"
                                title="Marcar falta">
                                {isLoadingThis ? <Loader2 className="w-3 h-3 animate-spin" /> : <><X className="w-3 h-3" /> Falta</>}
                              </button>
                            </motion.div>
                          ) : full ? (
                            <span className="text-xs text-gray-300 font-medium px-3 py-1.5 flex-shrink-0">Turma cheia</span>
                          ) : (
                            <motion.button key="confirm" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                              onClick={() => handleConfirm(slot.id)} disabled={isLoadingThis}
                              className="min-w-[120px] min-h-[44px] text-xs font-semibold text-white rounded-md transition-colors flex items-center justify-center disabled:opacity-60 flex-shrink-0" style={{ background: '#111111' }}>
                              {isLoadingThis ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Confirmar presença'}
                            </motion.button>
                          )}
                        </AnimatePresence>
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
