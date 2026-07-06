'use client'

import { useState, useMemo, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight, Sunrise, Sunset, Trash2, Users, CheckCircle2, Lock, LayoutGrid, List } from 'lucide-react'
import { toast } from 'sonner'
import { format, addDays, startOfWeek, addWeeks, isToday } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { SessionDetailDialog } from '@/components/session-detail-dialog'
import { availabilityApi, bookingApi } from '@/lib/api'
import { cn, formatTime, getInitials, avatarColor } from '@/lib/utils'
import type { StudioSlot } from '@/types'

const WEEKDAYS = [0, 1, 2, 3, 4, 5] // Mon–Sat

function localDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Read-only agenda viewer — marcações + horários disponíveis, agenda/lista
// toggle. Moved here from the PT dashboard per client feedback: this page
// ("Minha Agenda") is where the PT's whole schedule lives, dashboard stays
// just stats.
function AgendaViewer() {
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
        </div>
      </div>

      {isLoading ? (
        <div className="p-4 space-y-2">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10 rounded-lg" />)}
        </div>
      ) : grid.length === 0 ? (
        <div className="p-8 text-center">
          <p className="text-sm text-gray-400">Sem slots disponíveis esta semana</p>
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

function SlotCell({
  slot,
  toggling,
  onToggle,
}: {
  slot: StudioSlot
  toggling: boolean
  onToggle: (slot: StudioSlot) => void
}) {
  const studioFull = slot.studioCount >= slot.studioMax
  const hasMyBookings = slot.myBookings > 0

  // Slots the PT hasn't released — shown in black, distinct from studio
  // colors (green=available, blue=confirmed) confirmed with the client.
  let bg = 'bg-gray-900 border-gray-800 text-gray-500 hover:bg-gray-800 hover:border-gray-700 cursor-pointer'
  let dot = 'bg-gray-600'
  let label = ''
  let sublabel = ''

  if (slot.released) {
    if (hasMyBookings) {
      bg = 'bg-blue-600 border-blue-700 text-white cursor-not-allowed opacity-90'
      dot = 'bg-blue-300'
      label = `${slot.myBookings} aluno${slot.myBookings > 1 ? 's' : ''}`
      sublabel = `${slot.studioCount}/${slot.studioMax} estúdio`
    } else if (studioFull) {
      bg = 'bg-[#1F3864] border-[#162c52] text-white/80 cursor-pointer'
      dot = 'bg-blue-300'
      label = 'Lotado'
      sublabel = `${slot.studioCount}/${slot.studioMax}`
    } else {
      bg = 'bg-emerald-500 border-emerald-600 text-white cursor-pointer hover:bg-emerald-600'
      dot = 'bg-emerald-200'
      label = slot.studioCount > 0 ? `${slot.studioCount}/${slot.studioMax}` : 'Livre'
      sublabel = slot.studioCount > 0 ? 'no estúdio' : ''
    }
  }

  const handleClick = () => {
    if (hasMyBookings || toggling) return
    onToggle(slot)
  }

  return (
    <button
      onClick={handleClick}
      disabled={toggling}
      title={hasMyBookings ? 'Tens alunos confirmados — cancela as reservas primeiro' : slot.released ? 'Clica para remover' : 'Clica para ativar'}
      className={cn(
        'relative w-full min-h-[56px] sm:min-h-[64px] rounded-lg border text-left px-2 py-1.5 transition-all duration-150 select-none flex flex-col justify-between',
        bg,
        toggling && 'opacity-50',
      )}
    >
      <span className="text-[10px] sm:text-xs font-bold leading-none">{slot.slotTime}</span>
      {slot.released && (
        <span className="flex items-center gap-1 mt-0.5">
          {hasMyBookings ? (
            <Lock className="w-3 h-3 shrink-0" />
          ) : (
            <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', dot)} />
          )}
          <span className="text-[9px] sm:text-[10px] font-semibold leading-tight truncate">{label}</span>
        </span>
      )}
      {sublabel && (
        <span className="text-[8px] sm:text-[9px] leading-none opacity-70 truncate">{sublabel}</span>
      )}
    </button>
  )
}

export default function PTAvailabilityPage() {
  const [weekOffset, setWeekOffset] = useState(0)
  const [pendingKeys, setPendingKeys] = useState<Set<string>>(new Set())
  const [confirmSlot, setConfirmSlot] = useState<StudioSlot | null>(null)
  const [confirmClearWeek, setConfirmClearWeek] = useState(false)
  const qc = useQueryClient()

  const monday = startOfWeek(addWeeks(new Date(), weekOffset), { weekStartsOn: 1 })
  const saturday = addDays(monday, 5)
  const startDate = localDate(monday)
  const endDate = localDate(saturday)

  const { data: grid = [], isLoading } = useQuery<StudioSlot[]>({
    queryKey: ['studio-grid', weekOffset],
    queryFn: () => availabilityApi.studioGrid(startDate, endDate),
    staleTime: 30_000,
  })

  const invalidate = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['studio-grid', weekOffset] })
  }, [qc, weekOffset])

  const toggle = useMutation({
    mutationFn: async (slot: StudioSlot) => {
      if (slot.released && slot.releaseId) {
        await availabilityApi.delete(slot.releaseId)
        return { action: 'removed' as const, slot }
      } else {
        await availabilityApi.create({ date: slot.date, slotTime: slot.slotTime })
        return { action: 'created' as const, slot }
      }
    },
    onMutate: (slot) => {
      setPendingKeys(p => new Set([...p, `${slot.date}-${slot.slotTime}`]))
    },
    onSuccess: ({ action, slot }) => {
      toast.success(
        action === 'created'
          ? `Horário das ${formatTime(slot.startTime)} ativado ✓`
          : `Horário das ${formatTime(slot.startTime)} removido`
      )
    },
    onError: (e: Error) => toast.error(e.message || 'Erro ao atualizar disponibilidade'),
    onSettled: (_d, _e, slot) => {
      setPendingKeys(p => { const n = new Set(p); n.delete(`${slot.date}-${slot.slotTime}`); return n })
      invalidate()
    },
  })

  const bulkCreate = useMutation({
    mutationFn: async (slots: StudioSlot[]) => {
      let count = 0
      for (const s of slots) {
        if (!s.released) { await availabilityApi.create({ date: s.date, slotTime: s.slotTime }); count++ }
      }
      return count
    },
    onSuccess: (count) => toast.success(count > 0 ? `${count} horário${count !== 1 ? 's' : ''} ativado${count !== 1 ? 's' : ''} ✓` : 'Nada para ativar — já estava tudo ativo'),
    onError: () => toast.error('Erro ao ativar horários'),
    onSettled: invalidate,
  })

  const bulkDelete = useMutation({
    mutationFn: async (slots: StudioSlot[]) => {
      let count = 0
      for (const s of slots) {
        if (s.released && !s.myBookings && s.releaseId) { await availabilityApi.delete(s.releaseId); count++ }
      }
      return count
    },
    onSuccess: (count) => toast.success(count > 0 ? `${count} horário${count !== 1 ? 's' : ''} removido${count !== 1 ? 's' : ''}` : 'Nada para remover'),
    onError: () => toast.error('Erro ao limpar semana'),
    onSettled: invalidate,
  })

  // Group by [date, time] for easy lookup
  const slotMap = useMemo(() => {
    const m: Record<string, StudioSlot> = {}
    for (const s of grid) m[`${s.date}-${s.slotTime}`] = s
    return m
  }, [grid])

  // Group by date for the column layout
  const byDate = useMemo(() => {
    const m: Record<string, StudioSlot[]> = {}
    for (const s of grid) (m[s.date] ??= []).push(s)
    return m
  }, [grid])

  // Unique sorted times for row headers
  const allTimes = useMemo(() => {
    const times = new Set(grid.map(s => s.slotTime))
    return [...times].sort()
  }, [grid])

  const releasedCount = grid.filter(s => s.released).length
  const confirmedCount = grid.reduce((acc, s) => acc + s.myBookings, 0)

  const handleBulkMorning = () => {
    const morning = grid.filter(s => s.slotTime >= '07:00' && s.slotTime <= '11:40')
    bulkCreate.mutate(morning)
  }
  const handleBulkAfternoon = () => {
    const afternoon = grid.filter(s => s.slotTime >= '15:00')
    bulkCreate.mutate(afternoon)
  }
  const handleClearWeek = () => setConfirmClearWeek(true)
  const confirmHandleClearWeek = () => {
    const clearable = grid.filter(s => s.released && s.myBookings === 0)
    bulkDelete.mutate(clearable)
    setConfirmClearWeek(false)
  }

  const busy = toggle.isPending || bulkCreate.isPending || bulkDelete.isPending

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5 max-w-5xl mx-auto">
      {/* Agenda — marcações + horários disponíveis, agenda/lista toggle */}
      <AgendaViewer />

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">Disponibilidade</h1>
          <p className="text-sm text-gray-400 mt-0.5">Ativa os slots do estúdio que queres oferecer aos teus alunos</p>
        </div>
        {/* Week nav */}
        <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl p-1 shadow-sm flex-shrink-0">
          <button onClick={() => setWeekOffset(w => w - 1)} className="p-2 rounded-lg hover:bg-gray-100 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center">
            <ChevronLeft className="w-4 h-4 text-gray-600" />
          </button>
          <span className="text-xs sm:text-sm font-semibold text-gray-700 px-2 min-w-[110px] sm:min-w-[130px] text-center">
            {weekOffset === 0 ? 'Esta semana' : weekOffset === 1 ? 'Próx. semana' : weekOffset < 0 ? `${Math.abs(weekOffset)} sem. atrás` : `+${weekOffset} sem.`}
          </span>
          <button onClick={() => setWeekOffset(w => w + 1)} className="p-2 rounded-lg hover:bg-gray-100 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center">
            <ChevronRight className="w-4 h-4 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {[
          { label: 'Slots ativos', value: releasedCount, icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> },
          { label: 'Confirmações', value: confirmedCount, icon: <Users className="w-3.5 h-3.5 text-blue-500" /> },
          { label: 'Vagas por slot', value: '4', icon: <Users className="w-3.5 h-3.5 text-gray-400" /> },
        ].map(({ label, value, icon }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-100 shadow-sm px-3 py-3 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">{icon}</div>
            <p className="text-xl sm:text-2xl font-black text-gray-900">{value}</p>
            <p className="text-[10px] sm:text-[11px] text-gray-400 mt-0.5 leading-tight">{label}</p>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={handleBulkMorning}
          disabled={busy}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-white border border-gray-200 rounded-lg hover:bg-amber-50 hover:border-amber-200 hover:text-amber-700 transition-colors min-h-[44px] disabled:opacity-50"
        >
          <Sunrise className="w-3.5 h-3.5" />
          Manhãs (7h–11h)
        </button>
        <button
          onClick={handleBulkAfternoon}
          disabled={busy}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-white border border-gray-200 rounded-lg hover:bg-orange-50 hover:border-orange-200 hover:text-orange-700 transition-colors min-h-[44px] disabled:opacity-50"
        >
          <Sunset className="w-3.5 h-3.5" />
          Tardes (15h–20h)
        </button>
        <button
          onClick={handleClearWeek}
          disabled={busy || grid.filter(s => s.released && s.myBookings === 0).length === 0}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-white border border-gray-200 rounded-lg hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition-colors min-h-[44px] disabled:opacity-50"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Limpar semana
        </button>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 sm:gap-4 text-[10px] sm:text-xs text-gray-400">
        {[
          { color: 'bg-gray-900', label: 'Bloqueado / não liberado' },
          { color: 'bg-emerald-500', label: 'Ativo · sem reservas' },
          { color: 'bg-blue-600', label: 'Com os meus alunos' },
          { color: 'bg-[#1F3864]', label: 'Estúdio lotado' },
        ].map(({ color, label }) => (
          <span key={label} className="flex items-center gap-1.5">
            <span className={cn('w-2.5 h-2.5 rounded-sm inline-block flex-shrink-0', color)} />
            {label}
          </span>
        ))}
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      ) : grid.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
          <p className="text-gray-400 text-sm">Sem slots disponíveis para esta semana</p>
          <p className="text-gray-300 text-xs mt-1">Sábado e domingo podem não ter horários definidos</p>
        </div>
      ) : (
        <div className="overflow-x-auto -mx-4 sm:-mx-6 lg:mx-0 rounded-none sm:rounded-xl">
          <div className="min-w-[480px] px-4 sm:px-6 lg:px-0">
            {/* Column headers (days) */}
            <div
              className="grid gap-1 mb-1"
              style={{ gridTemplateColumns: `52px repeat(${WEEKDAYS.length}, minmax(0, 1fr))` }}
            >
              <div />
              {WEEKDAYS.map(d => {
                const date = addDays(monday, d)
                const dateStr = localDate(date)
                const count = (byDate[dateStr] ?? []).filter(s => s.released).length
                return (
                  <div key={d} className="text-center">
                    <p className="text-[10px] sm:text-xs font-bold text-gray-500 uppercase tracking-wide">
                      {format(date, 'EEE', { locale: ptBR })}
                    </p>
                    <p className="text-[10px] text-gray-400">{format(date, 'd/MM')}</p>
                    {count > 0 && (
                      <p className="text-[9px] text-emerald-600 font-semibold">{count} ativos</p>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Rows (times) */}
            <div className="space-y-0.5">
              {allTimes.map(time => (
                <div
                  key={time}
                  className="grid gap-1 items-center"
                  style={{ gridTemplateColumns: `52px repeat(${WEEKDAYS.length}, minmax(0, 1fr))` }}
                >
                  {/* Time label */}
                  <span className="text-[9px] sm:text-[10px] font-mono text-gray-400 text-right pr-2 leading-none self-center">
                    {time}
                  </span>
                  {WEEKDAYS.map(d => {
                    const date = addDays(monday, d)
                    const dateStr = localDate(date)
                    const key = `${dateStr}-${time}`
                    const slot = slotMap[key]
                    if (!slot) {
                      // Sunday or slot not defined for this day
                      return <div key={d} className="min-h-[56px] sm:min-h-[64px]" />
                    }
                    return (
                      <SlotCell
                        key={d}
                        slot={slot}
                        toggling={pendingKeys.has(key) || busy}
                        onToggle={() => setConfirmSlot(slot)}
                      />
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Info */}
      <div className="bg-[#1F3864]/5 border border-[#1F3864]/10 rounded-xl px-4 py-3 text-xs text-[#1F3864]/70 leading-relaxed">
        Slots com 🔒 têm alunos confirmados — cancela as reservas antes de remover. O estúdio tem <strong>4 vagas simultâneas</strong> partilhadas entre todos os PTs.
      </div>

      {/* Confirm single-slot toggle */}
      <Dialog open={!!confirmSlot} onOpenChange={(o) => !o && setConfirmSlot(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmSlot?.released ? 'Remover este horário?' : 'Ativar este horário?'}
            </DialogTitle>
            <DialogDescription>
              {confirmSlot && (
                <>
                  {format(new Date(confirmSlot.startTime), "EEEE, d 'de' MMMM", { locale: ptBR })} às {confirmSlot.slotTime}.
                  {confirmSlot.released
                    ? ' Os teus alunos deixam de conseguir agendar aqui.'
                    : ' Os teus alunos vão poder agendar aqui.'}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmSlot(null)} disabled={toggle.isPending}>
              Voltar
            </Button>
            <Button
              variant={confirmSlot?.released ? 'destructive' : 'default'}
              disabled={toggle.isPending}
              onClick={() => {
                if (confirmSlot) toggle.mutate(confirmSlot)
                setConfirmSlot(null)
              }}
            >
              {confirmSlot?.released ? 'Sim, remover' : 'Sim, ativar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm clear week */}
      <Dialog open={confirmClearWeek} onOpenChange={setConfirmClearWeek}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Limpar a semana?</DialogTitle>
            <DialogDescription>
              Remove todos os horários ativos sem reservas nesta semana. Horários com alunos confirmados não são afetados.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmClearWeek(false)} disabled={bulkDelete.isPending}>
              Voltar
            </Button>
            <Button variant="destructive" disabled={bulkDelete.isPending} onClick={confirmHandleClearWeek}>
              Sim, limpar semana
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
