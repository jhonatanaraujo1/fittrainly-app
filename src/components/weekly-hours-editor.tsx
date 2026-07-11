'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { studioScheduleApi } from '@/lib/api'

interface DayHours { dayOfWeek: number; openTime: string | null; closeTime: string | null }

// Segunda primeiro, Domingo por último (convenção PT).
const DAYS: { dow: number; label: string }[] = [
  { dow: 1, label: 'Segunda' }, { dow: 2, label: 'Terça' }, { dow: 3, label: 'Quarta' },
  { dow: 4, label: 'Quinta' }, { dow: 5, label: 'Sexta' }, { dow: 6, label: 'Sábado' }, { dow: 0, label: 'Domingo' },
]

// Backend serializa LocalTime como "HH:mm:ss"; o input type=time quer "HH:mm".
const hm = (t: string | null | undefined) => (t ? t.slice(0, 5) : '')
const DEFAULT_OPEN = '09:00'
const DEFAULT_CLOSE = '18:00'

type LocalDay = { open: string; close: string }

// Editor do horário de funcionamento do estúdio, por dia da semana. Aberto =
// tem horas; fechado = openTime/closeTime null. Guarda por dia ao sair do
// campo (blur) ou ao alternar aberto/fechado.
export function WeeklyHoursEditor() {
  const qc = useQueryClient()
  const { data = [], isLoading } = useQuery<DayHours[]>({ queryKey: ['weekly-hours'], queryFn: studioScheduleApi.getWeeklyHours })

  const [local, setLocal] = useState<Record<number, LocalDay>>({})
  useEffect(() => {
    if (data.length) {
      const next: Record<number, LocalDay> = {}
      for (const d of data) next[d.dayOfWeek] = { open: hm(d.openTime), close: hm(d.closeTime) }
      setLocal(next)
    }
  }, [data])

  const save = useMutation({
    mutationFn: ({ dow, open, close }: { dow: number; open: string | null; close: string | null }) =>
      studioScheduleApi.updateWeeklyHours(dow, open, close),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['weekly-hours'] }); qc.invalidateQueries({ queryKey: ['admin-schedule'] }); toast.success('Horário guardado') },
    onError: (e: Error) => toast.error(e.message || 'Não foi possível guardar'),
  })

  function commit(dow: number, open: string, close: string) {
    if (!open || !close) return
    if (open >= close) { toast.error('A abertura tem de ser antes do fecho'); return }
    save.mutate({ dow, open, close })
  }

  function toggleOpen(dow: number, isOpen: boolean) {
    if (isOpen) {
      const l = local[dow] ?? { open: DEFAULT_OPEN, close: DEFAULT_CLOSE }
      const open = l.open || DEFAULT_OPEN, close = l.close || DEFAULT_CLOSE
      setLocal(p => ({ ...p, [dow]: { open, close } }))
      save.mutate({ dow, open, close })
    } else {
      setLocal(p => ({ ...p, [dow]: { open: '', close: '' } }))
      save.mutate({ dow, open: null, close: null })
    }
  }

  if (isLoading) return <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-9 rounded-lg" />)}</div>

  const inp = 'h-8 w-[92px] rounded-md border border-gray-200 bg-white px-2 text-[13px] text-gray-800 tabular-nums outline-none focus:border-gray-400'

  return (
    <div className="divide-y divide-gray-50">
      {DAYS.map(({ dow, label }) => {
        const l = local[dow] ?? { open: '', close: '' }
        const isOpen = !!l.open && !!l.close
        return (
          <div key={dow} className="flex items-center gap-3 py-2.5">
            <span className="w-20 text-[13px] font-medium text-gray-700 flex-shrink-0">{label}</span>
            <Switch checked={isOpen} onCheckedChange={(v) => toggleOpen(dow, v)} aria-label={`${label} aberto`} />
            {isOpen ? (
              <div className="flex items-center gap-1.5 ml-auto">
                <input
                  type="time" value={l.open}
                  onChange={e => setLocal(p => ({ ...p, [dow]: { ...l, open: e.target.value } }))}
                  onBlur={e => commit(dow, e.target.value, l.close)}
                  className={inp}
                />
                <span className="text-xs text-gray-400">às</span>
                <input
                  type="time" value={l.close}
                  onChange={e => setLocal(p => ({ ...p, [dow]: { ...l, close: e.target.value } }))}
                  onBlur={e => commit(dow, l.open, e.target.value)}
                  className={inp}
                />
              </div>
            ) : (
              <span className="ml-auto text-[13px] text-gray-300">Fechado</span>
            )}
          </div>
        )
      })}
    </div>
  )
}
