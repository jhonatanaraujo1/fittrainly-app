'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight, Plus, X, Search, Lock, Unlock, Clock } from 'lucide-react'
import { toast } from 'sonner'
import { format, addDays, startOfWeek, addWeeks } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { SessionDetailDialog } from '@/components/session-detail-dialog'
import { adminScheduleApi, adminApi, ptApi, bookingApi, studioScheduleApi, studioConfigApi } from '@/lib/api'
import { cn, getInitials } from '@/lib/utils'
import type { AdminScheduleSlot, PersonalTrainer } from '@/types'

const WEEKDAYS = [0, 1, 2, 3, 4, 5]
const PT_COLORS_HEX = ['#3b82f6', '#10b981', '#a855f7', '#f97316', '#f43f5e', '#14b8a6']
const PT_COLORS_BG = ['bg-blue-500', 'bg-emerald-500', 'bg-purple-500', 'bg-orange-500', 'bg-rose-500', 'bg-teal-500']

function localDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

interface PopoverPos { date: string; slotTime: string }

export default function AdminSchedulePage() {
  const qc = useQueryClient()
  const [weekOffset, setWeekOffset] = useState(0)
  const [popover, setPopover] = useState<PopoverPos | null>(null)
  const [ptSearch, setPtSearch] = useState('')
  const [selectedSession, setSelectedSession] = useState<{ ptId: string; ptName: string; slotKey: string; startTime: string; endTime: string; availabilityId: string } | null>(null)
  const [blockMode, setBlockMode] = useState(false)
  const [configOpen, setConfigOpen] = useState(false)
  const [durationInput, setDurationInput] = useState('')
  const [pendingAllocation, setPendingAllocation] = useState<{ ptId: string; ptName: string; date: string; slotTime: string } | null>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleOut(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setPopover(null); setPtSearch('')
      }
    }
    document.addEventListener('mousedown', handleOut)
    return () => document.removeEventListener('mousedown', handleOut)
  }, [])

  const monday = startOfWeek(addWeeks(new Date(), weekOffset), { weekStartsOn: 1 })
  const saturday = addDays(monday, 5)
  const startDate = localDate(monday)
  const endDate = localDate(saturday)

  const { data: pts = [] } = useQuery<PersonalTrainer[]>({ queryKey: ['admin-pts'], queryFn: ptApi.list })
  const activePts = pts.filter(p => p.active)

  const { data: schedule = [], isLoading } = useQuery<AdminScheduleSlot[]>({
    queryKey: ['admin-schedule', weekOffset],
    queryFn: () => adminScheduleApi.list(startDate, endDate),
    staleTime: 20_000,
  })

  // V14: duração da aula configurável (cadência travada em 1h no backend).
  const { data: studioConfig } = useQuery({
    queryKey: ['studio-config'],
    queryFn: studioConfigApi.get,
    staleTime: 60_000,
  })
  const slotDuration = studioConfig?.slotDurationMinutes ?? 30
  const classDuration = studioConfig?.classDurationMinutes ?? 30
  const studioCapacity = (studioConfig as { studioCapacity?: number } | undefined)?.studioCapacity ?? 4
  const maxPorPt = (studioConfig as { maxStudentsPerTrainer?: number } | undefined)?.maxStudentsPerTrainer ?? 1

  // Campos da lotação.
  const [capacityInput, setCapacityInput] = useState('')
  const [perPtInput, setPerPtInput] = useState('')

  // Repõe os valores atuais sempre que o dialog abre. Ligado ao ESTADO e não
  // ao onOpenChange do Dialog: o dialog é aberto por setConfigOpen(true) a
  // partir do botão da toolbar, e nesse caminho o onOpenChange nunca dispara —
  // os campos abriam vazios.
  useEffect(() => {
    if (configOpen) {
      setCapacityInput(String(studioCapacity))
      setPerPtInput(String(maxPorPt))
    }
  }, [configOpen, studioCapacity, maxPorPt])

  // Guarda os dois juntos: a regra que os liga é cruzada (um PT não pode
  // atender mais alunos do que a sala comporta), e o backend valida o par.
  const updateCapacity = useMutation({
    mutationFn: ({ capacidade, porPt }: { capacidade: number; porPt: number }) =>
      studioConfigApi.updateSettings({ studioCapacity: capacidade, maxStudentsPerTrainer: porPt }),
    onSuccess: () => {
      toast.success('Lotação da agenda atualizada')
      qc.invalidateQueries({ queryKey: ['studio-config'] })
      qc.invalidateQueries({ queryKey: ['admin-schedule'] })
      setConfigOpen(false)
    },
    onError: (e: Error) => toast.error(e.message || 'Erro ao atualizar a lotação'),
  })

  // #4/#7 — configura a CADÊNCIA do slot (30/40/45/60). A aula acompanha a
  // cadência (sem folga) — resolve "os slots são de 40, não 30".
  const updateSlotCadence = useMutation({
    mutationFn: (minutes: number) => studioConfigApi.updateSettings({ slotDurationMinutes: minutes, classDurationMinutes: minutes }),
    onSuccess: () => {
      toast.success('Cadência do slot atualizada')
      qc.invalidateQueries({ queryKey: ['studio-config'] })
      qc.invalidateQueries({ queryKey: ['admin-schedule'] })
      setConfigOpen(false)
    },
    onError: (e: Error) => toast.error(e.message || 'Erro ao atualizar a cadência'),
  })

  const addRelease = useMutation({
    mutationFn: adminScheduleApi.addRelease,
    onSuccess: (_, vars) => {
      const pt = activePts.find(p => p.id === vars.ptId)
      toast.success(`${pt?.name ?? 'PT'} alocado ✓`)
      qc.invalidateQueries({ queryKey: ['admin-schedule', weekOffset] })
    },
    onError: (e: Error) => toast.error(e.message || 'Erro ao adicionar'),
  })

  const removeRelease = useMutation({
    mutationFn: adminScheduleApi.removeRelease,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-schedule', weekOffset] }),
    onError: () => toast.error('Erro ao remover'),
  })

  const { data: sessionAttendees = [] } = useQuery({
    // BUG PROD (500): o backend espera o UUID da availability, não o slotKey
    // "data-hora". Passar slotKey fazia o parse de UUID falhar → 500 ao clicar
    // no chip do PT para ver o aluno. availabilityId = rel.releaseId (o UUID).
    queryKey: ['session-attendees', selectedSession?.ptId, selectedSession?.availabilityId],
    queryFn: () => adminScheduleApi.attendees(selectedSession!.ptId, selectedSession!.availabilityId),
    enabled: !!selectedSession,
  })

  const cancelBooking = useMutation({
    mutationFn: bookingApi.cancel,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-schedule'] })
      qc.invalidateQueries({ queryKey: ['session-attendees'] })
      toast.success('Sessão cancelada')
    },
    onError: (e: Error) => toast.error(e.message || 'Erro ao cancelar sessão'),
  })

  // #2 — alunos do PT do slot selecionado (para o admin marcar por eles).
  const { data: ptStudents = [] } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ['pt-students-admin', selectedSession?.ptId],
    queryFn: () => adminApi.alunosByPt(selectedSession!.ptId) as Promise<Array<{ id: string; name: string }>>,
    enabled: !!selectedSession,
  })

  const bookForStudent = useMutation({
    mutationFn: ({ availabilityId, studentId }: { availabilityId: string; studentId: string }) =>
      bookingApi.createForStudent(availabilityId, studentId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-schedule'] })
      qc.invalidateQueries({ queryKey: ['session-attendees'] })
      toast.success('Aluno marcado ✓ — desconta do pack e entra na faturação')
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Erro ao marcar o aluno'),
  })

  const createBlock = useMutation({
    mutationFn: studioScheduleApi.createBlock,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-schedule', weekOffset] })
      toast.success('Horário bloqueado')
    },
    onError: (e: Error) => toast.error(e.message || 'Erro ao bloquear horário'),
  })

  const deleteBlock = useMutation({
    mutationFn: (block: { blockId: string }) => studioScheduleApi.deleteBlock(block.blockId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-schedule', weekOffset] })
      toast.success('Bloqueio removido')
    },
    onError: () => toast.error('Erro ao remover bloqueio'),
  })

  // Map for O(1) lookup: "YYYY-MM-DD-HH:MM" → AdminScheduleSlot
  const slotMap = useMemo(() => {
    const m: Record<string, AdminScheduleSlot> = {}
    for (const s of schedule) m[`${s.date}-${s.slotTime}`] = s
    return m
  }, [schedule])

  // All unique time slots in order
  const allTimes = useMemo(() => {
    const times = new Set(schedule.map(s => s.slotTime))
    return [...times].sort()
  }, [schedule])

  function ptColor(ptId: string) {
    const idx = activePts.findIndex(p => p.id === ptId)
    return PT_COLORS_BG[idx % PT_COLORS_BG.length]
  }
  function ptColorHex(ptId: string) {
    const idx = activePts.findIndex(p => p.id === ptId)
    return PT_COLORS_HEX[idx % PT_COLORS_HEX.length]
  }

  const totalReleases = schedule.reduce((s, sl) => s + sl.releases.length, 0)
  const totalConfirmed = schedule.reduce((s, sl) => s + sl.studioCount, 0)

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">Agenda do Estúdio</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Slots de <strong>{slotDuration} min</strong>{classDuration < slotDuration ? <> · aula de <strong>{classDuration} min</strong></> : null} · capacidade máx. <strong>4</strong> em simultâneo
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            onClick={() => { setDurationInput(String(slotDuration)); setConfigOpen(true) }}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border text-xs sm:text-sm font-semibold transition-colors min-h-[44px] bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
          >
            <Clock className="w-4 h-4" />
            Slot: {slotDuration}min
          </button>
          <button
            onClick={() => setBlockMode(b => !b)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2.5 rounded-xl border text-xs sm:text-sm font-semibold transition-colors min-h-[44px]',
              blockMode ? 'bg-red-50 border-red-200 text-red-600' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50',
            )}
          >
            {blockMode ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
            {blockMode ? 'A bloquear horários' : 'Bloquear horários'}
          </button>
          <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl p-1 shadow-sm">
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
      </div>

      {blockMode && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5 text-xs text-red-700">
          <Lock className="w-3.5 h-3.5 flex-shrink-0" />
          Clica num horário vazio para bloqueá-lo (feriado, estúdio fechado). Clica num horário já bloqueado para desbloquear.
        </div>
      )}

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {[
          { label: 'Releases esta semana', value: totalReleases },
          { label: 'Confirmações', value: totalConfirmed },
          { label: 'PTs ativos', value: activePts.length },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white rounded-xl led-gold px-3 py-3 text-center">
            <p className="text-xl sm:text-2xl font-black text-gray-900">{value}</p>
            <p className="text-[10px] sm:text-[11px] text-gray-400 mt-0.5 leading-tight">{label}</p>
          </div>
        ))}
      </div>

      {/* PT legend */}
      {activePts.length > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-[11px] text-gray-400 font-semibold uppercase tracking-wide mr-1">PTs:</span>
          {activePts.map(pt => (
            <span key={pt.id} className="flex items-center gap-1.5 text-xs font-semibold text-white px-2.5 py-1 rounded-full"
              style={{ background: ptColorHex(pt.id) }}>
              {getInitials(pt.name)} {pt.name.split(' ')[0]}
            </span>
          ))}
        </div>
      )}

      {/* Grid */}
      {isLoading ? (
        <Skeleton className="h-96 rounded-xl" />
      ) : schedule.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl led-gold text-gray-400 text-sm">
          Sem slots definidos para esta semana
        </div>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="bg-white rounded-xl led-gold overflow-x-auto">
          <div className="min-w-[560px]">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr>
                  <th className="text-left px-3 py-2.5 text-gray-400 font-medium w-16 border-b border-r border-gray-100 bg-gray-50/50">
                    Hora
                  </th>
                  {WEEKDAYS.map(d => {
                    const day = addDays(monday, d)
                    const dateStr = localDate(day)
                    const daySlots = schedule.filter(s => s.date === dateStr)
                    const dayReleases = daySlots.reduce((acc, s) => acc + s.releases.length, 0)
                    const dayClosed = daySlots.length > 0 && daySlots.every(s => s.blocked)
                    const closedReason = dayClosed ? daySlots.find(s => s.blocked)?.blockReason : undefined
                    return (
                      <th key={d} className={cn('px-2 py-2.5 text-center font-medium border-b border-gray-100 min-w-[90px]', dayClosed ? 'bg-red-50/60' : 'bg-gray-50/50')}>
                        <div className={cn('font-semibold capitalize', dayClosed ? 'text-red-400' : 'text-gray-600')}>{format(day, 'EEE', { locale: ptBR })}</div>
                        <div className="text-gray-400 font-normal text-[10px]">{format(day, 'd/MM')}</div>
                        {dayClosed ? (
                          <div title={closedReason} className="text-[9px] text-red-500 font-semibold">Fechado</div>
                        ) : dayReleases > 0 ? (
                          <div className="text-[9px] text-emerald-600 font-semibold">{dayReleases} slots</div>
                        ) : null}
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {allTimes.map(time => (
                  <tr key={time} className="border-b border-gray-50 last:border-0">
                    <td className="px-3 py-1 text-gray-400 border-r border-gray-50 font-mono text-[11px] whitespace-nowrap bg-gray-50/30">
                      {time}
                    </td>
                    {WEEKDAYS.map(d => {
                      const day = addDays(monday, d)
                      const dateStr = localDate(day)
                      const slot = slotMap[`${dateStr}-${time}`]
                      const isOpen = popover?.date === dateStr && popover?.slotTime === time

                      if (!slot) {
                        return <td key={d} className="p-0.5"><div className="min-h-[48px]" /></td>
                      }

                      const ptIdsInSlot = slot.releases.map(r => r.ptId)
                      const availablePts = activePts.filter(p => !ptIdsInSlot.includes(p.id))
                      const studioFull = slot.studioCount >= slot.studioMax
                      const releaseFull = slot.releases.length >= slot.studioMax

                      const handleCellClick = () => {
                        if (!blockMode) return
                        if (slot.blocked && slot.blockId) {
                          deleteBlock.mutate({ blockId: slot.blockId })
                        } else if (!slot.blocked && slot.releases.length === 0) {
                          createBlock.mutate({
                            date: dateStr, startTime: time, endTime: slot.endTime.slice(11, 16), reason: 'Bloqueado pelo estúdio',
                          })
                        } else if (slot.releases.length > 0) {
                          toast.error('Remove os PTs alocados neste horário antes de bloquear')
                        }
                      }

                      if (slot.blocked) {
                        return (
                          <td key={d} className="p-0.5">
                            <div
                              onClick={handleCellClick}
                              title={slot.blockReason}
                              className={cn(
                                'min-h-[48px] rounded-md border p-1.5 flex flex-col items-center justify-center gap-0.5 bg-red-50 border-red-200',
                                blockMode && 'cursor-pointer hover:bg-red-100 transition-colors',
                              )}
                            >
                              <Lock className="w-3 h-3 text-red-400" />
                              <span className="text-[8px] font-semibold text-red-500 text-center leading-none">Bloqueado</span>
                            </div>
                          </td>
                        )
                      }

                      return (
                        <td key={d} className="p-0.5">
                          <div className="relative">
                            <div
                              onClick={blockMode ? handleCellClick : undefined}
                              className={cn(
                                'min-h-[48px] rounded-md border p-1 flex flex-col gap-1 transition-colors',
                                slot.releases.length === 0 ? 'bg-gray-50 border-gray-100' : 'bg-white border-gray-200',
                                studioFull && 'bg-gray-900/5 border-gray-900/20',
                                blockMode && 'cursor-pointer hover:bg-red-50 hover:border-red-200',
                              )}>
                              {/* PT release chips */}
                              {slot.releases.map(rel => {
                                const ptName = activePts.find(p => p.id === rel.ptId)?.name ?? 'PT'
                                return (
                                  <div key={rel.releaseId}
                                    onClick={() => setSelectedSession({
                                      ptId: rel.ptId, ptName, slotKey: `${dateStr}-${time}`,
                                      startTime: slot.startTime, endTime: slot.endTime,
                                      availabilityId: rel.releaseId,
                                    })}
                                    className={cn(
                                      'flex items-center justify-between rounded px-1.5 py-1 min-h-[20px] text-white text-[9px] font-semibold group cursor-pointer hover:opacity-80 transition-opacity',
                                      ptColor(rel.ptId),
                                    )}>
                                    {/* PT · aluno. Sem o nome do aluno o admin
                                        via só "1✓" e tinha de abrir o chip
                                        para saber quem estava no horário. */}
                                    <span className="truncate">
                                      {ptName.split(' ')[0]}
                                      {rel.studentNames.length > 0 && (
                                        <span className="font-normal opacity-90">
                                          {' · '}
                                          {rel.studentNames.map(n => n.split(' ')[0]).join(', ')}
                                        </span>
                                      )}
                                    </span>
                                    {rel.confirmedCount === 0 ? (
                                      <button
                                        onClick={(e) => { e.stopPropagation(); removeRelease.mutate(rel.releaseId) }}
                                        disabled={removeRelease.isPending}
                                        className="opacity-0 group-hover:opacity-100 transition-opacity ml-1 hover:bg-white/20 rounded p-0.5 flex-shrink-0"
                                      >
                                        <X className="w-2.5 h-2.5" />
                                      </button>
                                    ) : (
                                      <span className="ml-1 opacity-70 flex-shrink-0">{rel.confirmedCount}✓</span>
                                    )}
                                  </div>
                                )
                              })}

                              {/* Add button */}
                              {!releaseFull && !blockMode && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    if (isOpen) { setPopover(null); setPtSearch('') }
                                    else { setPopover({ date: dateStr, slotTime: time }); setPtSearch('') }
                                  }}
                                  className={cn(
                                    'flex items-center justify-center gap-0.5 rounded border border-dashed text-[10px] font-medium transition-all mt-auto py-0.5',
                                    slot.releases.length === 0 ? 'min-h-[32px]' : '',
                                    isOpen
                                      ? 'border-blue-400 bg-blue-50 text-blue-500'
                                      : 'border-gray-300 text-gray-300 hover:border-gray-400 hover:text-gray-500 hover:bg-white',
                                  )}
                                >
                                  <Plus className="w-2.5 h-2.5" /><span>PT</span>
                                </button>
                              )}

                              {/* Studio occupancy */}
                              {slot.studioCount > 0 && (
                                <span className={cn('text-[8px] font-bold text-center leading-none', studioFull ? 'text-red-400' : 'text-gray-400')}>
                                  {slot.studioCount}/{slot.studioMax}
                                </span>
                              )}
                            </div>

                            {/* PT picker popover */}
                            <AnimatePresence>
                              {isOpen && (
                                <motion.div
                                  ref={popoverRef}
                                  initial={{ opacity: 0, y: -4, scale: 0.97 }}
                                  animate={{ opacity: 1, y: 0, scale: 1 }}
                                  exit={{ opacity: 0, y: -4, scale: 0.97 }}
                                  transition={{ duration: 0.12 }}
                                  className="absolute z-50 top-full mt-1 left-0 min-w-[180px] bg-white rounded-xl border border-gray-200 shadow-xl overflow-hidden"
                                >
                                  {activePts.length > 3 && (
                                    <div className="flex items-center gap-1.5 px-2.5 py-2 border-b border-gray-100">
                                      <Search className="w-3 h-3 text-gray-400 flex-shrink-0" />
                                      <input autoFocus type="text" placeholder="Pesquisar..." value={ptSearch}
                                        onChange={e => setPtSearch(e.target.value)}
                                        className="flex-1 text-xs text-gray-900 placeholder-gray-400 bg-transparent outline-none" />
                                    </div>
                                  )}
                                  <div className="py-1 max-h-48 overflow-y-auto">
                                    {availablePts
                                      .filter(p => p.name.toLowerCase().includes(ptSearch.toLowerCase()))
                                      .map(pt => (
                                        <button key={pt.id}
                                          onClick={() => {
                                            setPopover(null); setPtSearch('')
                                            setPendingAllocation({ ptId: pt.id, ptName: pt.name, date: dateStr, slotTime: time })
                                          }}
                                          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 transition-colors text-left min-h-[44px]"
                                        >
                                          <span className={cn('w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0', ptColor(pt.id))}>
                                            {getInitials(pt.name)}
                                          </span>
                                          <div className="flex-1 min-w-0">
                                            <p className="text-xs font-semibold text-gray-900 truncate">{pt.name}</p>
                                            {pt.specialty && <p className="text-[10px] text-gray-400 truncate">{pt.specialty.split(' ')[0]}</p>}
                                          </div>
                                        </button>
                                      ))}
                                    {availablePts.filter(p => p.name.toLowerCase().includes(ptSearch.toLowerCase())).length === 0 && (
                                      <p className="text-xs text-gray-400 px-3 py-3 text-center">
                                        {activePts.length === 0
                                          ? 'Sem PTs ativos. Adiciona ou ativa um PT em Personal Trainers.'
                                          : availablePts.length === 0
                                          ? 'Todos os PTs já alocados neste horário'
                                          : 'Nenhum PT encontrado'}
                                      </p>
                                    )}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      <div className="flex flex-wrap gap-3 text-[11px] text-gray-400">
        <span>• Clica em <strong>+ PT</strong> para alocar um PT ao slot</span>
        <span>• Clica num chip com alunos confirmados para ver detalhes</span>
        <span>• Hover no chip → ✕ remove (sem reservas)</span>
        <span>• <strong>X/4</strong> = alunos confirmados no estúdio</span>
        <span>• Slots de <strong>{slotDuration} minutos</strong>{classDuration < slotDuration ? <> · aula de {classDuration}min</> : null}</span>
      </div>

      {selectedSession && (
        <SessionDetailDialog
          open={!!selectedSession}
          onOpenChange={(o) => !o && setSelectedSession(null)}
          startTime={selectedSession.startTime}
          endTime={selectedSession.endTime}
          ptName={selectedSession.ptName}
          students={sessionAttendees.map(a => ({ bookingId: a.bookingId, name: a.alunoName, email: a.email, phone: a.phone }))}
          onCancelBooking={(bookingId) => cancelBooking.mutate(bookingId)}
          cancellingId={cancelBooking.isPending ? cancelBooking.variables ?? null : null}
          bookableStudents={ptStudents}
          onBookStudent={(studentId) => bookForStudent.mutate({ availabilityId: selectedSession.availabilityId, studentId })}
          booking={bookForStudent.isPending}
        />
      )}

      {/* Confirm PT allocation — não deve alocar direto no clique */}
      <Dialog open={!!pendingAllocation} onOpenChange={(o) => !o && setPendingAllocation(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alocar {pendingAllocation?.ptName}?</DialogTitle>
            <DialogDescription>
              {pendingAllocation && (
                <>
                  {format(new Date(pendingAllocation.date + 'T12:00:00'), "EEEE, d 'de' MMMM", { locale: ptBR })} às {pendingAllocation.slotTime}.
                  {' '}{pendingAllocation.ptName} passa a ter este horário liberado no estúdio.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" className="min-h-[44px]" onClick={() => setPendingAllocation(null)} disabled={addRelease.isPending}>
              Voltar
            </Button>
            <Button
              className="min-h-[44px]"
              disabled={addRelease.isPending}
              onClick={() => {
                if (pendingAllocation) {
                  addRelease.mutate({ ptId: pendingAllocation.ptId, date: pendingAllocation.date, slotTime: pendingAllocation.slotTime })
                }
                setPendingAllocation(null)
              }}
            >
              Sim, alocar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Duração da aula (V14) — cadência fica travada em 1h no backend */}
      <Dialog open={configOpen} onOpenChange={setConfigOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configurações da agenda</DialogTitle>
            <DialogDescription>
              Duração dos blocos e lotação — quantas pessoas cabem na sala e quantos alunos cada PT atende ao mesmo tempo.
            </DialogDescription>
          </DialogHeader>
          <div className="py-1 space-y-3">
            <div className="flex flex-wrap gap-2">
              {[30, 40, 45, 60].map(preset => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setDurationInput(String(preset))}
                  className={cn(
                    'px-3 py-2 rounded-lg border text-sm font-semibold transition-colors min-h-[44px]',
                    durationInput === String(preset) ? 'bg-gray-900 text-white border-gray-900' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50',
                  )}
                >
                  {preset} min
                </button>
              ))}
            </div>
            <div>
              <label htmlFor="slot-duration" className="text-sm font-semibold text-gray-700">Ou outro valor (min)</label>
              <input
                id="slot-duration"
                type="number"
                min={15}
                max={180}
                value={durationInput}
                onChange={(e) => setDurationInput(e.target.value)}
                className="mt-1.5 w-full h-11 rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-gray-900"
              />
              <p className="text-xs text-gray-400 mt-1.5">Entre 15 e 180 minutos.</p>
            </div>

            <div className="h-px bg-gray-100" />

            {/* Lotação — as duas dimensões que o estúdio precisa de controlar. */}
            <div className="space-y-3">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Lotação</p>

              <div>
                <label htmlFor="cap-estudio" className="text-sm font-semibold text-gray-700">
                  Pessoas na sala ao mesmo tempo
                </label>
                <input
                  id="cap-estudio"
                  type="number" min={1} max={100} inputMode="numeric"
                  value={capacityInput}
                  onChange={(e) => setCapacityInput(e.target.value)}
                  className="mt-1.5 w-full h-11 rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-gray-900"
                />
                <p className="text-xs text-gray-400 mt-1.5">
                  Vagas físicas do estúdio, somando todos os PTs. Ninguém consegue marcar acima disto.
                </p>
              </div>

              <div>
                <label htmlFor="cap-pt" className="text-sm font-semibold text-gray-700">
                  Alunos por PT no mesmo horário
                </label>
                <input
                  id="cap-pt"
                  type="number" min={1} max={20} inputMode="numeric"
                  value={perPtInput}
                  onChange={(e) => setPerPtInput(e.target.value)}
                  className="mt-1.5 w-full h-11 rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-gray-900"
                />
                <p className="text-xs text-gray-400 mt-1.5">
                  1 = atendimento individual. Acima disso, o PT atende em dupla ou pequeno grupo.
                </p>
              </div>

              {/* A regra cruzada, dita antes de o admin tentar e levar erro. */}
              {Number(perPtInput) > Number(capacityInput) && capacityInput !== '' && perPtInput !== '' && (
                <p className="text-xs text-amber-600 font-medium">
                  Um PT não pode atender mais alunos ({perPtInput}) do que a sala comporta ({capacityInput}).
                </p>
              )}

              <Button
                variant="outline"
                className="w-full min-h-[44px]"
                disabled={updateCapacity.isPending}
                onClick={() => {
                  const cap = parseInt(capacityInput, 10)
                  const pp = parseInt(perPtInput, 10)
                  if (!Number.isFinite(cap) || cap < 1 || cap > 100) {
                    toast.error('A lotação do estúdio deve estar entre 1 e 100 pessoas'); return
                  }
                  if (!Number.isFinite(pp) || pp < 1 || pp > 20) {
                    toast.error('Cada PT deve atender entre 1 e 20 alunos por horário'); return
                  }
                  if (pp > cap) {
                    toast.error(`Cada PT atenderia ${pp} alunos, mas a sala só comporta ${cap} ao todo.`); return
                  }
                  updateCapacity.mutate({ capacidade: cap, porPt: pp })
                }}
              >
                {updateCapacity.isPending ? 'A guardar…' : 'Guardar lotação'}
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="min-h-[44px]" onClick={() => setConfigOpen(false)} disabled={updateSlotCadence.isPending}>
              Cancelar
            </Button>
            <Button
              className="min-h-[44px]"
              disabled={updateSlotCadence.isPending}
              onClick={() => {
                const n = parseInt(durationInput, 10)
                if (!Number.isFinite(n) || n < 15 || n > 180) {
                  toast.error('A cadência tem de estar entre 15 e 180 minutos')
                  return
                }
                updateSlotCadence.mutate(n)
              }}
            >
              Guardar duração
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
