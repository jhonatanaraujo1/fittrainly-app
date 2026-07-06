'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Users, Calendar, Clock, Receipt, ArrowRight, ChevronLeft, ChevronRight, LayoutGrid, List } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { useState, useMemo } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { StatCard } from '@/components/ui/stat-card'
import { SessionDetailDialog } from '@/components/session-detail-dialog'
import { dashboardApi, availabilityApi, bookingApi } from '@/lib/api'
import { formatCurrency, getInitials, avatarColor, withIVA } from '@/lib/utils'
import { useAuthStore } from '@/store/auth'
import { format, addDays, startOfWeek, addWeeks, isToday } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import type { PTDashboard, StudioSlot } from '@/types'

function localDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const WEEKDAYS = [0, 1, 2, 3, 4, 5]

// Single agenda widget — agenda (grid) view by default, with a list view
// toggle. Both read from the same week-scoped studio-grid query, so
// "marcações" and "horários disponíveis" always show the same range —
// no more mismatched date windows between a separate list and calendar.
function WeekCalendar() {
  const qc = useQueryClient()
  const [weekOffset, setWeekOffset] = useState(0)
  const [view, setView] = useState<'agenda' | 'lista'>('agenda')
  const [selectedSlot, setSelectedSlot] = useState<StudioSlot | null>(null)
  const monday = startOfWeek(addWeeks(new Date(), weekOffset), { weekStartsOn: 1 })
  const saturday = addDays(monday, 5)

  const { data: grid = [], isLoading } = useQuery<StudioSlot[]>({
    queryKey: ['studio-grid', weekOffset],
    queryFn: () => availabilityApi.studioGrid(localDate(monday), localDate(saturday)),
    staleTime: 30_000,
  })

  // Build a quick map for slot → myBookings (who's booked with this PT)
  const slotMap = useMemo(() => {
    const m: Record<string, StudioSlot> = {}
    for (const s of grid) m[`${s.date}-${s.slotTime}`] = s
    return m
  }, [grid])

  const allTimes = useMemo(() => {
    const times = new Set(grid.map(s => s.slotTime))
    return [...times].sort()
  }, [grid])

  const releasedSlots = useMemo(
    () => grid.filter(s => s.released).sort((a, b) => (a.date + a.slotTime).localeCompare(b.date + b.slotTime)),
    [grid],
  )
  const releasedWithBookings = releasedSlots.filter(s => s.myBookings > 0)

  const slotKey = selectedSlot ? `${selectedSlot.date}-${selectedSlot.slotTime}` : null
  const { data: attendees = [] } = useQuery({
    queryKey: ['slot-attendees', slotKey],
    queryFn: () => availabilityApi.attendees(slotKey!),
    enabled: !!slotKey,
  })

  const cancelMutation = useMutation({
    mutationFn: bookingApi.cancel,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['studio-grid'] })
      qc.invalidateQueries({ queryKey: ['slot-attendees'] })
      toast.success('Sessão cancelada')
    },
    onError: (e: Error) => toast.error(e.message || 'Não foi possível cancelar'),
  })

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-gray-50 flex-wrap gap-2">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Agenda</h2>
          <p className="text-xs text-gray-400 mt-0.5">{releasedWithBookings.length} sessões com alunos</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Agenda/Lista toggle — agenda is the default view */}
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
          <div className="flex items-center gap-1">
            <button onClick={() => setWeekOffset(w => w - 1)} className="p-2 rounded-lg hover:bg-gray-100 transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center">
              <ChevronLeft className="w-4 h-4 text-gray-500" />
            </button>
            <span className="text-xs font-semibold text-gray-600 px-1 min-w-[80px] text-center">
              {weekOffset === 0 ? 'Esta semana' : weekOffset === 1 ? 'Próx. semana' : weekOffset < 0 ? `${Math.abs(weekOffset)}s atrás` : `+${weekOffset} sem.`}
            </span>
            <button onClick={() => setWeekOffset(w => w + 1)} className="p-2 rounded-lg hover:bg-gray-100 transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center">
              <ChevronRight className="w-4 h-4 text-gray-500" />
            </button>
          </div>
          <Link href="/pt/availability" className="text-xs text-[#2E75B6] flex items-center gap-1 hover:underline">
            Gerir <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {isLoading ? (
        <div className="p-4 space-y-2">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10 rounded-lg" />)}
        </div>
      ) : grid.length === 0 ? (
        <div className="p-8 text-center">
          <p className="text-sm text-gray-400">Sem slots disponíveis esta semana</p>
          <Link href="/pt/availability" className="text-xs text-[#2E75B6] hover:underline mt-1 inline-block">
            Adicionar disponibilidade →
          </Link>
        </div>
      ) : view === 'agenda' ? (
        <div className="overflow-x-auto">
          <div className="min-w-[480px] p-3">
            {/* Day headers */}
            <div className="grid gap-1 mb-1" style={{ gridTemplateColumns: `44px repeat(6, minmax(0, 1fr))` }}>
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

            {/* Time rows — only show released slots */}
            <div className="space-y-0.5">
              {allTimes.filter(t => grid.some(s => s.slotTime === t && s.released)).map(time => (
                <div key={time} className="grid gap-1 items-center" style={{ gridTemplateColumns: `44px repeat(6, minmax(0, 1fr))` }}>
                  <span className="text-[9px] font-mono text-gray-300 text-right pr-1.5 leading-none">{time}</span>
                  {WEEKDAYS.map(d => {
                    const date = addDays(monday, d)
                    const dateStr = localDate(date)
                    const slot = slotMap[`${dateStr}-${time}`]
                    if (!slot || !slot.released) return <div key={d} className="h-8" />
                    return (
                      <div
                        key={d}
                        onClick={() => slot.myBookings > 0 && setSelectedSlot(slot)}
                        className={cn(
                          'h-8 rounded-md flex items-center justify-center px-1',
                          slot.myBookings > 0
                            ? 'bg-[#1F3864] text-white cursor-pointer hover:opacity-80 transition-opacity'
                            : 'bg-emerald-100 text-emerald-700',
                        )}
                      >
                        {slot.myBookings > 0 ? (
                          <span className="text-[9px] font-bold leading-none truncate max-w-full px-0.5">
                            {slot.alunoNames?.[0]?.split(' ')[0] ?? `${slot.myBookings}✓`}
                            {(slot.alunoNames?.length ?? 0) > 1 && <span className="opacity-70"> +{(slot.alunoNames?.length ?? 1) - 1}</span>}
                          </span>
                        ) : (
                          <span className="text-[9px] opacity-50">livre</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>

            {/* Legend */}
            <div className="flex gap-4 mt-2 px-1">
              {[
                { color: 'bg-[#1F3864]', label: 'Com aluno' },
                { color: 'bg-emerald-100', label: 'Livre' },
              ].map(({ color, label }) => (
                <span key={label} className="flex items-center gap-1 text-[9px] text-gray-400">
                  <span className={cn('w-2 h-2 rounded-sm', color)} />
                  {label}
                </span>
              ))}
            </div>
          </div>
        </div>
      ) : (
        // Lista — same week, same data source as the agenda grid above.
        <div className="divide-y divide-gray-50">
          {releasedSlots.map((slot) => {
            const isToday_ = isToday(new Date(slot.startTime))
            return (
              <div
                key={`${slot.date}-${slot.slotTime}`}
                onClick={() => slot.myBookings > 0 && setSelectedSlot(slot)}
                className={cn(
                  'flex items-center justify-between px-4 sm:px-5 py-3 gap-3',
                  slot.myBookings > 0 && 'cursor-pointer hover:bg-gray-50 transition-colors',
                )}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900">
                    {format(new Date(slot.startTime), "EEE, d 'de' MMM", { locale: ptBR })}
                    {isToday_ && <span className="ml-1.5 text-[10px] font-bold text-[#2E75B6] bg-[#2E75B6]/10 px-1.5 py-0.5 rounded-full">HOJE</span>}
                    {' — '}{slot.slotTime}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    {(slot.alunoNames ?? []).length > 0 ? (
                      slot.alunoNames!.map(name => (
                        <span key={name} className={`w-6 h-6 rounded-full ${avatarColor(name)} flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0`} title={name}>
                          {getInitials(name)}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-gray-400">Livre</span>
                    )}
                  </div>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full border bg-gray-50 text-gray-500 border-gray-100 flex-shrink-0">
                  {slot.studioCount}/{slot.studioMax} estúdio
                </span>
              </div>
            )
          })}
        </div>
      )}

      {selectedSlot && (
        <SessionDetailDialog
          open={!!selectedSlot}
          onOpenChange={(o) => !o && setSelectedSlot(null)}
          startTime={selectedSlot.startTime}
          endTime={selectedSlot.endTime}
          students={attendees.map(a => ({ bookingId: a.bookingId, name: a.alunoName }))}
          onCancelBooking={(bookingId) => cancelMutation.mutate(bookingId)}
          cancellingId={cancelMutation.isPending ? cancelMutation.variables ?? null : null}
        />
      )}
    </div>
  )
}

export default function PTDashboardPage() {
  const { user } = useAuthStore()
  const { data, isLoading } = useQuery<PTDashboard>({
    queryKey: ['pt-dashboard'],
    queryFn: dashboardApi.pt,
  })

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
          Olá, {user?.name?.split(' ')[0]} 👋
        </h1>
        <p className="text-sm text-gray-400 mt-0.5">Aqui está a tua semana</p>
      </motion.div>

      {/* Stats */}
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatCard title="Meus Alunos" value={data?.stats.totalAlunos ?? 0} icon={Users} iconColor="#C9A84C" delay={0.05} />
          <StatCard title="Sessões Esta Semana" value={data?.stats.sessionsThisWeek ?? 0} icon={Calendar} iconColor="#C9A84C" delay={0.1} />
          <StatCard title="Horas Este Mês" value={`${data?.stats.hoursThisMonth ?? 0}h`} icon={Clock} iconColor="#C9A84C" delay={0.15} />
          <StatCard
            title="A Pagar"
            value={formatCurrency(data?.stats.amountDue ?? 0)}
            subtitle={`s/ IVA · c/ IVA: ${formatCurrency(withIVA(data?.stats.amountDue ?? 0).total)}`}
            icon={Receipt}
            iconColor="#C9A84C"
            delay={0.2}
          />
        </div>
      )}

      {/* Single agenda widget — marcações + horários disponíveis, agenda/lista toggle */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
        <WeekCalendar />
      </motion.div>
    </div>
  )
}
