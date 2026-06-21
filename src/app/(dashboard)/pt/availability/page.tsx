'use client'

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight, ChevronDown, Users } from 'lucide-react'
import { format, addDays, startOfWeek, addWeeks } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Skeleton } from '@/components/ui/skeleton'
import { availabilityApi } from '@/lib/api'
import { cn, formatTime } from '@/lib/utils'
import type { Availability } from '@/types'

interface Attendee { alunoId: string; alunoName: string; status: string }

const WEEKDAYS = [0, 1, 2, 3, 4, 5]

function statusBadge(status: string) {
  if (status === 'CONFIRMED') return 'bg-emerald-50 text-emerald-700 border border-emerald-100'
  if (status === 'CANCELLED') return 'bg-red-50 text-red-600 border border-red-100'
  if (status === 'COMPLETED') return 'bg-gray-50 text-gray-500 border border-gray-100'
  return 'bg-gray-50 text-gray-400'
}
function statusLabel(status: string) {
  if (status === 'CONFIRMED') return 'Confirmado'
  if (status === 'CANCELLED') return 'Vai faltar'
  if (status === 'COMPLETED') return 'Realizado'
  return status
}

function SlotCard({ slot }: { slot: Availability }) {
  const [open, setOpen] = useState(false)
  const { data: attendees = [], isLoading } = useQuery<Attendee[]>({
    queryKey: ['attendees', slot.id],
    queryFn: () => availabilityApi.attendees(slot.id),
    enabled: open,
  })

  const hasBookings = slot.confirmedCount > 0
  const barColor = slot.confirmedCount >= slot.maxAlunos
    ? 'bg-[#1F3864]'
    : slot.confirmedCount > 0
      ? 'bg-[#2E75B6]'
      : 'bg-emerald-400'

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={cn('w-2.5 h-2.5 rounded-full flex-shrink-0', barColor)} />
          <div className="text-left">
            <p className="text-sm font-semibold text-gray-900">
              {formatTime(slot.startTime)} – {formatTime(slot.endTime)}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              {slot.confirmedCount === 0
                ? 'Sem confirmações ainda'
                : `${slot.confirmedCount} de ${slot.maxAlunos} confirmados`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {slot.confirmedCount > 0 && (
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <Users className="w-3.5 h-3.5" />
              {slot.confirmedCount}
            </span>
          )}
          <ChevronDown className={cn('w-4 h-4 text-gray-300 transition-transform', open && 'rotate-180')} />
        </div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3 pt-1 border-t border-gray-50 space-y-2">
              {isLoading ? (
                <div className="space-y-1.5 py-1">
                  <Skeleton className="h-7 rounded-lg" />
                  <Skeleton className="h-7 rounded-lg" />
                </div>
              ) : attendees.length === 0 ? (
                <p className="text-xs text-gray-400 py-2 text-center">Nenhum aluno ainda neste horário</p>
              ) : (
                attendees.map(a => (
                  <div key={a.alunoId} className="flex items-center justify-between gap-3 py-1">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-[#2E75B6] flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                        {a.alunoName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <span className="text-xs font-medium text-gray-700">{a.alunoName}</span>
                    </div>
                    <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium', statusBadge(a.status))}>
                      {statusLabel(a.status)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function PTAgendaPage() {
  const [weekOffset, setWeekOffset] = useState(0)

  const monday = startOfWeek(addWeeks(new Date(), weekOffset), { weekStartsOn: 1 })
  const saturday = addDays(monday, 5)
  const startDate = format(monday, "yyyy-MM-dd'T'00:00:00'Z'")
  const endDate   = format(saturday, "yyyy-MM-dd'T'23:59:59'Z'")

  const { data: slots = [], isLoading } = useQuery<Availability[]>({
    queryKey: ['pt-slots', weekOffset],
    queryFn: () => availabilityApi.mySlots(startDate, endDate),
  })

  // Group by day
  const grouped = useMemo(() => {
    const map: Record<string, Availability[]> = {}
    for (const s of slots) {
      const d = format(new Date(s.startTime), 'yyyy-MM-dd')
      ;(map[d] ??= []).push(s)
    }
    return map
  }, [slots])

  const activeDays = WEEKDAYS
    .map(d => ({ offset: d, date: addDays(monday, d) }))
    .filter(({ date }) => grouped[format(date, 'yyyy-MM-dd')]?.length > 0)

  const totalSlots = slots.length
  const totalConfirmed = slots.reduce((s, a) => s + a.confirmedCount, 0)
  const totalAbsent = 0 // will come from attendees (not loaded yet here)

  return (
    <div className="p-5 lg:p-7 space-y-5 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Minha Agenda</h1>
          <p className="text-sm text-gray-400 mt-0.5">Horários alocados pelo estúdio</p>
        </div>
        <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg p-1">
          <button onClick={() => setWeekOffset(w => w - 1)} className="p-1.5 rounded-md hover:bg-gray-100 transition-colors">
            <ChevronLeft className="w-4 h-4 text-gray-600" />
          </button>
          <span className="text-sm font-medium text-gray-700 px-2 min-w-36 text-center">
            {weekOffset === 0 ? 'Esta semana' : weekOffset === 1 ? 'Próxima semana' : weekOffset < 0 ? `${Math.abs(weekOffset)} sem. atrás` : `+${weekOffset} sem.`}
          </span>
          <button onClick={() => setWeekOffset(w => w + 1)} className="p-1.5 rounded-md hover:bg-gray-100 transition-colors">
            <ChevronRight className="w-4 h-4 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Slots esta semana', value: totalSlots },
          { label: 'Presenças confirmadas', value: totalConfirmed },
          { label: 'Vagas em aberto', value: slots.reduce((s, a) => s + a.availableSlots, 0) },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-100 px-4 py-3 text-center">
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Info banner */}
      <div className="bg-[#1F3864]/5 border border-[#1F3864]/10 rounded-xl px-4 py-3 text-xs text-[#1F3864]/70">
        Os horários são definidos pelo estúdio. Fala com o Maicon para alterações na tua agenda.
      </div>

      {/* Day groups */}
      {isLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
      ) : slots.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
          <p className="text-gray-400 text-sm">Sem horários alocados para esta semana</p>
          <p className="text-gray-300 text-xs mt-1">O estúdio ainda não definiu a tua agenda</p>
        </div>
      ) : (
        <div className="space-y-5">
          {WEEKDAYS.map(d => {
            const date = addDays(monday, d)
            const dateStr = format(date, 'yyyy-MM-dd')
            const daySlots = (grouped[dateStr] ?? []).sort(
              (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
            )
            if (daySlots.length === 0) return null
            const dayLabel = format(date, "EEEE, d 'de' MMMM", { locale: ptBR })
            return (
              <motion.div key={d} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: d * 0.04 }}>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 capitalize">{dayLabel}</p>
                <div className="space-y-2">
                  {daySlots.map(slot => <SlotCard key={slot.id} slot={slot} />)}
                </div>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
