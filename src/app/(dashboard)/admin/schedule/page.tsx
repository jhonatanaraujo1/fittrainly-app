'use client'

import { useState, useMemo, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, Loader2, Settings2, Users } from 'lucide-react'
import { toast } from 'sonner'
import { format, addDays, startOfWeek, addWeeks } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Skeleton } from '@/components/ui/skeleton'
import { adminScheduleApi, ptApi } from '@/lib/api'
import { cn, getInitials, avatarColor } from '@/lib/utils'
import type { Availability, PersonalTrainer } from '@/types'

const WEEKDAYS = [0, 1, 2, 3, 4, 5]

const DURATION_OPTIONS = [30, 40, 45, 50, 60, 75, 90]
const START_HOURS = Array.from({ length: 13 }, (_, i) => i + 5)
const END_HOURS   = Array.from({ length: 13 }, (_, i) => i + 10)

interface Settings { startHour: number; endHour: number; durationMinutes: number }

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

export default function AdminSchedulePage() {
  const qc = useQueryClient()
  const [weekOffset, setWeekOffset] = useState(0)
  const [selectedPtId, setSelectedPtId] = useState<string | null>(null)
  const [loadingCell, setLoadingCell] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [settings, setSettings] = useState<Settings>(loadSettings)

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

  // Auto-select first PT
  useEffect(() => {
    if (activePts.length > 0 && !selectedPtId) setSelectedPtId(activePts[0].id)
  }, [activePts, selectedPtId])

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

  async function toggleCell(dayOffset: number, hour: number, minute: number) {
    if (!selectedPtId) return
    const key = `${dayOffset}-${hour}-${minute}`
    const existing = getSlot(selectedPtId, dayOffset, hour, minute)
    setLoadingCell(key)
    try {
      if (existing) {
        if (existing.confirmedCount > 0) {
          toast.info(`Slot com ${existing.confirmedCount} presença(s) confirmada(s) — não pode ser removido`)
          return
        }
        await remove.mutateAsync(existing.id)
        toast.success('Slot removido')
      } else {
        const dateStr = format(addDays(monday, dayOffset), 'yyyy-MM-dd')
        const end = addMins(hour, minute, settings.durationMinutes)
        await create.mutateAsync({
          ptId: selectedPtId,
          startTime: `${dateStr}T${pad(hour)}:${pad(minute)}:00Z`,
          endTime:   `${dateStr}T${pad(end.hour)}:${pad(end.minute)}:00Z`,
          maxAlunos: 4,
        })
        toast.success('Slot alocado ✓')
      }
    } finally {
      setLoadingCell(null)
    }
  }

  function ptColor(ptId: string): string {
    const idx = activePts.findIndex(p => p.id === ptId)
    return PT_COLORS[idx % PT_COLORS.length]
  }

  // All slots grouped by cell for overview
  function getCellSlots(dayOffset: number, hour: number, minute: number): Availability[] {
    const dayStr = format(addDays(monday, dayOffset), 'yyyy-MM-dd')
    return slots.filter(s =>
      format(new Date(s.startTime), 'yyyy-MM-dd') === dayStr &&
      new Date(s.startTime).getUTCHours() === hour &&
      new Date(s.startTime).getUTCMinutes() === minute
    )
  }

  const selectedPt = activePts.find(p => p.id === selectedPtId)

  return (
    <div className="p-5 lg:p-7 space-y-4 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Agenda do Estúdio</h1>
          <p className="text-sm text-gray-400 mt-0.5">Aloca horários para cada Personal Trainer</p>
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
            <select value={settings.startHour} onChange={e => setSettings(s => ({ ...s, startHour: Number(e.target.value) }))}
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-[#C9A84C]">
              {START_HOURS.filter(h => h < settings.endHour).map(h => <option key={h} value={h}>{pad(h)}:00</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-500">Fim do dia</label>
            <select value={settings.endHour} onChange={e => setSettings(s => ({ ...s, endHour: Number(e.target.value) }))}
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-[#C9A84C]">
              {END_HOURS.filter(h => h > settings.startHour).map(h => <option key={h} value={h}>{pad(h)}:00</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-500">Duração da aula</label>
            <select value={settings.durationMinutes} onChange={e => setSettings(s => ({ ...s, durationMinutes: Number(e.target.value) }))}
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-[#C9A84C]">
              {DURATION_OPTIONS.map(d => <option key={d} value={d}>{d} minutos</option>)}
            </select>
          </div>
          <p className="text-xs text-gray-400 self-center">{timeSlots.length} slots/dia · {settings.durationMinutes} min</p>
        </motion.div>
      )}

      {/* PT selector */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-gray-400 font-medium flex items-center gap-1"><Users className="w-3.5 h-3.5" /> Alocar para:</span>
        {activePts.map((pt, i) => (
          <button
            key={pt.id}
            onClick={() => setSelectedPtId(pt.id)}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
              selectedPtId === pt.id
                ? `${PT_COLORS[i % PT_COLORS.length]} border-transparent text-white shadow-sm`
                : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
            )}
          >
            <span className={cn('w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0',
              selectedPtId === pt.id ? 'bg-white/20' : PT_COLORS[i % PT_COLORS.length])}>
              {getInitials(pt.name)}
            </span>
            {pt.name.split(' ')[0]}
          </button>
        ))}
      </div>

      {selectedPt && (
        <p className="text-xs text-gray-400">
          A clicar nas células vai alocar/remover slots para <strong className="text-gray-600">{selectedPt.name}</strong>
        </p>
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
                    const key = `${d}-${hour}-${minute}`
                    const isLoading = loadingCell === key
                    const cellSlots = getCellSlots(d, hour, minute)
                    const selectedSlot = selectedPtId ? getSlot(selectedPtId, d, hour, minute) : undefined
                    const otherSlots = cellSlots.filter(s => s.personalTrainerId !== selectedPtId)

                    return (
                      <td key={d} className="p-0.5">
                        <button
                          onClick={() => toggleCell(d, hour, minute)}
                          disabled={isLoading || !selectedPtId}
                          className={cn(
                            'w-full min-h-[44px] rounded-md border text-[10px] font-medium transition-all flex flex-col items-center justify-center gap-0.5 p-1',
                            selectedSlot
                              ? selectedSlot.confirmedCount > 0
                                ? 'bg-[#2E75B6] border-[#2E75B6] text-white'
                                : `${ptColor(selectedPtId!)} border-transparent text-white opacity-90 hover:opacity-100`
                              : otherSlots.length > 0
                                ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
                                : 'bg-gray-50 hover:bg-gray-100 border-gray-200 text-gray-300 cursor-pointer'
                          )}
                          title={selectedSlot ? `${selectedSlot.confirmedCount} confirmados` : undefined}
                        >
                          {isLoading ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : selectedSlot ? (
                            <>
                              <span className="text-[10px] font-bold">✓</span>
                              {selectedSlot.confirmedCount > 0 && (
                                <span className="text-[9px] opacity-80">{selectedSlot.confirmedCount} conf.</span>
                              )}
                            </>
                          ) : otherSlots.length > 0 ? (
                            <div className="flex flex-col gap-0.5 w-full px-0.5">
                              {otherSlots.slice(0, 2).map(s => (
                                <div key={s.id} className={cn('rounded text-[9px] px-1 py-0.5 text-white font-medium', ptColor(s.personalTrainerId))}>
                                  {s.personalTrainerName.split(' ')[0]}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-gray-300">+</span>
                          )}
                        </button>
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
        <span>✓ Slot alocado para o PT selecionado</span>
        <span>· Slot de outro PT (read-only)</span>
        <span>Azul = tem presenças confirmadas</span>
      </div>
    </div>
  )
}
