'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight, Loader2, Settings2, Plus, X, Search } from 'lucide-react'
import { toast } from 'sonner'
import { format, addDays, startOfWeek, addWeeks } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Skeleton } from '@/components/ui/skeleton'
import { CustomSelect } from '@/components/ui/custom-select'
import { adminScheduleApi, ptApi } from '@/lib/api'
import { cn, getInitials } from '@/lib/utils'
import type { Availability, PersonalTrainer } from '@/types'

const WEEKDAYS = [0, 1, 2, 3, 4, 5]
const STUDIO_CAPACITY = 4

const DURATION_OPTIONS = [30, 40, 45, 50, 60, 75, 90]
const START_HOURS = Array.from({ length: 13 }, (_, i) => i + 5)
const END_HOURS   = Array.from({ length: 13 }, (_, i) => i + 10)

interface Settings { startHour: number; endHour: number; durationMinutes: number }
interface PopoverCell { d: number; hour: number; minute: number }

function loadSettings(): Settings {
  try { const r = localStorage.getItem('fittrainly-schedule-settings'); if (r) return JSON.parse(r) } catch {}
  return { startHour: 7, endHour: 20, durationMinutes: 60 }
}

function pad(n: number) { return String(n).padStart(2, '0') }
function addMins(h: number, m: number, mins: number) {
  const t = h * 60 + m + mins
  return { hour: Math.floor(t / 60), minute: t % 60 }
}

const PT_COLORS = ['bg-blue-500', 'bg-emerald-500', 'bg-purple-500', 'bg-orange-500', 'bg-rose-500', 'bg-teal-500']
const PT_COLORS_HEX = ['#3b82f6', '#10b981', '#a855f7', '#f97316', '#f43f5e', '#14b8a6']

export default function AdminSchedulePage() {
  const qc = useQueryClient()
  const [weekOffset, setWeekOffset] = useState(0)
  const [loadingCell, setLoadingCell] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [settings, setSettings] = useState<Settings>(loadSettings)
  const [popover, setPopover] = useState<PopoverCell | null>(null)
  const [ptSearch, setPtSearch] = useState('')
  const popoverRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setPopover(null)
        setPtSearch('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    localStorage.setItem('fittrainly-schedule-settings', JSON.stringify(settings))
  }, [settings])

  const monday = startOfWeek(addWeeks(new Date(), weekOffset), { weekStartsOn: 1 })
  const saturday = addDays(monday, 5)
  const startDate = format(monday, "yyyy-MM-dd'T'00:00:00'Z'")
  const endDate   = format(saturday, "yyyy-MM-dd'T'23:59:59'Z'")

  const timeSlots = useMemo(() => {
    const result: { hour: number; minute: number }[] = []
    let total = settings.startHour * 60
    const end = settings.endHour * 60
    while (total + settings.durationMinutes <= end) {
      result.push({ hour: Math.floor(total / 60), minute: total % 60 })
      total += settings.durationMinutes
    }
    return result
  }, [settings])

  const { data: pts = [] } = useQuery<PersonalTrainer[]>({
    queryKey: ['admin-pts'],
    queryFn: ptApi.list,
  })
  const activePts = pts.filter(p => p.active)

  const { data: slots = [], isLoading } = useQuery<Availability[]>({
    queryKey: ['admin-schedule', weekOffset],
    queryFn: () => adminScheduleApi.list(startDate, endDate),
  })

  const create = useMutation({
    mutationFn: adminScheduleApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-schedule', weekOffset] }),
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Erro ao criar slot')
    },
  })

  const remove = useMutation({
    mutationFn: adminScheduleApi.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-schedule', weekOffset] }),
    onError: () => toast.error('Slot com presenças confirmadas — não pode ser removido'),
  })

  function getSlot(ptId: string, dayOffset: number, hour: number, minute: number): Availability | undefined {
    const dayStr = format(addDays(monday, dayOffset), 'yyyy-MM-dd')
    return slots.find(s =>
      s.personalTrainerId === ptId &&
      format(new Date(s.startTime), 'yyyy-MM-dd') === dayStr &&
      new Date(s.startTime).getUTCHours() === hour &&
      new Date(s.startTime).getUTCMinutes() === minute
    )
  }

  function getCellSlots(dayOffset: number, hour: number, minute: number): Availability[] {
    const dayStr = format(addDays(monday, dayOffset), 'yyyy-MM-dd')
    return slots.filter(s =>
      format(new Date(s.startTime), 'yyyy-MM-dd') === dayStr &&
      new Date(s.startTime).getUTCHours() === hour &&
      new Date(s.startTime).getUTCMinutes() === minute
    )
  }

  async function addPtToSlot(ptId: string, d: number, hour: number, minute: number) {
    const key = `${d}-${hour}-${minute}`
    setLoadingCell(key)
    setPopover(null)
    setPtSearch('')
    try {
      const dateStr = format(addDays(monday, d), 'yyyy-MM-dd')
      const end = addMins(hour, minute, settings.durationMinutes)
      await create.mutateAsync({
        ptId,
        startTime: `${dateStr}T${pad(hour)}:${pad(minute)}:00Z`,
        endTime:   `${dateStr}T${pad(end.hour)}:${pad(end.minute)}:00Z`,
        maxAlunos: 1,
      })
      const pt = activePts.find(p => p.id === ptId)
      toast.success(`${pt?.name ?? 'PT'} alocado ✓`)
    } finally {
      setLoadingCell(null)
    }
  }

  async function removeSlot(slot: Availability) {
    if (slot.confirmedCount > 0) {
      toast.info(`Slot com presença confirmada — não pode ser removido`)
      return
    }
    try {
      await remove.mutateAsync(slot.id)
      toast.success('Slot removido')
    } catch {}
  }

  function ptColor(ptId: string): string {
    const idx = activePts.findIndex(p => p.id === ptId)
    return PT_COLORS[idx % PT_COLORS.length]
  }
  function ptColorHex(ptId: string): string {
    const idx = activePts.findIndex(p => p.id === ptId)
    return PT_COLORS_HEX[idx % PT_COLORS_HEX.length]
  }

  const isPopoverOpen = (d: number, hour: number, minute: number) =>
    popover?.d === d && popover?.hour === hour && popover?.minute === minute

  return (
    <div className="p-5 lg:p-7 space-y-4 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Agenda do Estúdio</h1>
          <p className="text-sm text-gray-400 mt-0.5">Clica em <strong className="text-gray-500">+</strong> numa célula para alocar um Personal Trainer</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSettings(v => !v)}
            className={cn(
              'flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border transition-colors',
              showSettings ? 'text-white border-transparent' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
            )}
            style={showSettings ? { background: '#111111' } : undefined}
          >
            <Settings2 className="w-3.5 h-3.5" /> Configurar
          </button>
          <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg p-1">
            <button onClick={() => setWeekOffset(w => w - 1)} className="p-1.5 rounded-md hover:bg-gray-100 transition-colors">
              <ChevronLeft className="w-4 h-4 text-gray-600" />
            </button>
            <span className="text-sm font-medium text-gray-700 px-2 min-w-36 text-center">
              {weekOffset === 0 ? 'Esta semana' : weekOffset === 1 ? 'Próxima semana' : weekOffset < 0 ? `${Math.abs(weekOffset)} sem. atrás` : `+${weekOffset} semanas`}
            </span>
            <button onClick={() => setWeekOffset(w => w + 1)} className="p-1.5 rounded-md hover:bg-gray-100 transition-colors">
              <ChevronRight className="w-4 h-4 text-gray-600" />
            </button>
          </div>
        </div>
      </div>

      {/* Settings */}
      {showSettings && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-5 items-end">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-500">Início do dia</label>
            <CustomSelect<number>
              value={settings.startHour}
              onChange={v => setSettings(s => ({ ...s, startHour: v }))}
              options={START_HOURS.filter(h => h < settings.endHour).map(h => ({ value: h, label: `${pad(h)}:00` }))}
              className="w-28"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-500">Fim do dia</label>
            <CustomSelect<number>
              value={settings.endHour}
              onChange={v => setSettings(s => ({ ...s, endHour: v }))}
              options={END_HOURS.filter(h => h > settings.startHour).map(h => ({ value: h, label: `${pad(h)}:00` }))}
              className="w-28"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-500">Duração da aula</label>
            <CustomSelect<number>
              value={settings.durationMinutes}
              onChange={v => setSettings(s => ({ ...s, durationMinutes: v }))}
              options={DURATION_OPTIONS.map(d => ({ value: d, label: `${d} minutos` }))}
              className="w-36"
            />
          </div>
          <p className="text-xs text-gray-400 self-center">{timeSlots.length} slots/dia · {settings.durationMinutes} min</p>
        </motion.div>
      )}

      {/* PT legend */}
      {activePts.length > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs text-gray-400">PTs:</span>
          {activePts.map(pt => (
            <span key={pt.id} className="flex items-center gap-1.5 text-xs font-medium text-white px-2.5 py-1 rounded-full"
              style={{ background: ptColorHex(pt.id) }}>
              {getInitials(pt.name)} {pt.name.split(' ')[0]}
            </span>
          ))}
        </div>
      )}

      {/* Grid */}
      {isLoading ? (
        <Skeleton className="h-96 rounded-xl" />
      ) : timeSlots.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border text-gray-400 text-sm">Ajusta as configurações para ver os slots disponíveis.</div>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
          <table className="min-w-[640px] w-full text-xs border-collapse">
            <thead>
              <tr>
                <th className="text-left px-3 py-2.5 text-gray-400 font-medium w-16 border-b border-r border-gray-100">Hora</th>
                {WEEKDAYS.map(d => {
                  const day = addDays(monday, d)
                  return (
                    <th key={d} className="px-2 py-2.5 text-center font-medium border-b border-gray-100 min-w-[90px]">
                      <div className="text-gray-500">{format(day, 'EEE', { locale: ptBR })}</div>
                      <div className="text-gray-300 font-normal">{format(day, 'd/M')}</div>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {timeSlots.map(({ hour, minute }) => (
                <tr key={`${hour}-${minute}`}>
                  <td className="px-3 py-1 text-gray-400 border-r border-gray-50 font-medium text-[11px] whitespace-nowrap">
                    {`${pad(hour)}:${pad(minute)}`}
                  </td>
                  {WEEKDAYS.map(d => {
                    const cellKey = `${d}-${hour}-${minute}`
                    const isCellLoading = loadingCell === cellKey
                    const cellSlots = getCellSlots(d, hour, minute)
                    const full = cellSlots.length >= STUDIO_CAPACITY
                    const ptsInCell = cellSlots.map(s => s.personalTrainerId)
                    const availablePts = activePts.filter(p => !ptsInCell.includes(p.id))
                    const popoverOpen = isPopoverOpen(d, hour, minute)

                    return (
                      <td key={d} className="p-0.5">
                        <div className="relative">
                          <div className={cn(
                            'w-full min-h-[52px] rounded-md border transition-all flex flex-col p-1 gap-0.5',
                            full ? 'bg-gray-50 border-gray-200' : 'bg-gray-50 border-gray-100'
                          )}>
                            {/* PT chips */}
                            {cellSlots.map(slot => (
                              <div key={slot.id}
                                className={cn('flex items-center justify-between rounded px-1.5 py-0.5 text-white text-[9px] font-semibold group', ptColor(slot.personalTrainerId))}>
                                <span>{slot.personalTrainerName.split(' ')[0]}</span>
                                {slot.confirmedCount === 0 ? (
                                  <button
                                    onClick={() => removeSlot(slot)}
                                    className="opacity-0 group-hover:opacity-100 transition-opacity ml-1 hover:bg-white/20 rounded p-0.5"
                                    title="Remover slot"
                                  >
                                    <X className="w-2.5 h-2.5" />
                                  </button>
                                ) : (
                                  <span className="ml-1 opacity-70">✓</span>
                                )}
                              </div>
                            ))}

                            {/* Add button */}
                            {!full && (
                              <button
                                onClick={() => {
                                  if (isCellLoading) return
                                  if (popoverOpen) { setPopover(null); setPtSearch('') }
                                  else { setPopover({ d, hour, minute }); setPtSearch('') }
                                }}
                                disabled={isCellLoading}
                                className={cn(
                                  'flex items-center justify-center gap-1 rounded border border-dashed text-[10px] font-medium transition-all mt-auto',
                                  cellSlots.length === 0 ? 'min-h-[36px]' : 'py-0.5',
                                  popoverOpen
                                    ? 'border-blue-400 bg-blue-50 text-blue-500'
                                    : 'border-gray-300 text-gray-300 hover:border-gray-400 hover:text-gray-500 hover:bg-white'
                                )}
                              >
                                {isCellLoading
                                  ? <Loader2 className="w-3 h-3 animate-spin text-gray-400" />
                                  : <><Plus className="w-2.5 h-2.5" /><span>PT</span></>
                                }
                              </button>
                            )}

                            {/* Occupancy badge */}
                            {cellSlots.length > 0 && (
                              <span className={cn(
                                'text-[9px] font-bold text-center leading-none mt-0.5',
                                full ? 'text-red-400' : 'text-gray-400'
                              )}>
                                {cellSlots.length}/{STUDIO_CAPACITY}
                              </span>
                            )}
                          </div>

                          {/* PT picker popover */}
                          <AnimatePresence>
                            {popoverOpen && (
                              <motion.div
                                ref={popoverRef}
                                initial={{ opacity: 0, y: -4, scale: 0.97 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: -4, scale: 0.97 }}
                                transition={{ duration: 0.12 }}
                                className="absolute z-50 top-full mt-1 left-0 min-w-[180px] bg-white rounded-xl border border-gray-200 shadow-xl overflow-hidden"
                                style={{ minWidth: 180 }}
                              >
                                {/* Search */}
                                {activePts.length > 3 && (
                                  <div className="flex items-center gap-1.5 px-2.5 py-2 border-b border-gray-100">
                                    <Search className="w-3 h-3 text-gray-400 flex-shrink-0" />
                                    <input
                                      autoFocus
                                      type="text"
                                      placeholder="Pesquisar..."
                                      value={ptSearch}
                                      onChange={e => setPtSearch(e.target.value)}
                                      className="flex-1 text-xs text-gray-900 placeholder-gray-400 bg-transparent outline-none"
                                    />
                                  </div>
                                )}

                                <div className="py-1 max-h-48 overflow-y-auto">
                                  {availablePts
                                    .filter(pt => pt.name.toLowerCase().includes(ptSearch.toLowerCase()))
                                    .map(pt => (
                                      <button
                                        key={pt.id}
                                        onClick={() => addPtToSlot(pt.id, d, hour, minute)}
                                        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 transition-colors text-left"
                                      >
                                        <span className={cn('w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0', ptColor(pt.id))}>
                                          {getInitials(pt.name)}
                                        </span>
                                        <div className="flex-1 min-w-0">
                                          <p className="text-xs font-semibold text-gray-900 truncate">{pt.name}</p>
                                          {pt.specialty && <p className="text-[10px] text-gray-400 truncate">{pt.specialty.split(' ')[0]}</p>}
                                        </div>
                                      </button>
                                    ))}

                                  {availablePts.filter(pt => pt.name.toLowerCase().includes(ptSearch.toLowerCase())).length === 0 && (
                                    <p className="text-xs text-gray-400 px-3 py-3 text-center">
                                      {availablePts.length === 0 ? 'Todos os PTs já alocados' : 'Nenhum PT encontrado'}
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
        </motion.div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs text-gray-400">
        <span>+ PT → adicionar personal trainer ao slot</span>
        <span>· hover no chip → ✕ para remover (sem presenças)</span>
        <span>· <strong>X/{STUDIO_CAPACITY}</strong> = ocupação do estúdio</span>
      </div>
    </div>
  )
}
