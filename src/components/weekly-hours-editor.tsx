'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { studioScheduleApi } from '@/lib/api'

interface DayHours { dayOfWeek: number; openTime: string | null; closeTime: string | null; lunchStart?: string | null; lunchEnd?: string | null }

// Segunda primeiro, Domingo por último (convenção PT).
const DAYS: { dow: number; label: string }[] = [
  { dow: 1, label: 'Segunda' }, { dow: 2, label: 'Terça' }, { dow: 3, label: 'Quarta' },
  { dow: 4, label: 'Quinta' }, { dow: 5, label: 'Sexta' }, { dow: 6, label: 'Sábado' }, { dow: 0, label: 'Domingo' },
]

// Backend serializa LocalTime como "HH:mm:ss"; o input type=time quer "HH:mm".
const hm = (t: string | null | undefined) => (t ? t.slice(0, 5) : '')
const DEFAULT_OPEN = '09:00'
const DEFAULT_CLOSE = '18:00'

type LocalDay = { open: string; close: string; lunchStart: string; lunchEnd: string }

// Editor do horário de funcionamento do estúdio, por dia da semana:
// abertura/fecho + pausa de almoço opcional. Aberto = tem horas; fechado =
// tudo null. Guarda por dia ao sair do campo (blur) ou alternar aberto/fechado.
export function WeeklyHoursEditor() {
  const qc = useQueryClient()
  const { data = [], isLoading } = useQuery<DayHours[]>({ queryKey: ['weekly-hours'], queryFn: studioScheduleApi.getWeeklyHours })

  const [local, setLocal] = useState<Record<number, LocalDay>>({})
  useEffect(() => {
    if (data.length) {
      const next: Record<number, LocalDay> = {}
      for (const d of data) next[d.dayOfWeek] = { open: hm(d.openTime), close: hm(d.closeTime), lunchStart: hm(d.lunchStart), lunchEnd: hm(d.lunchEnd) }
      setLocal(next)
    }
  }, [data])

  const save = useMutation({
    mutationFn: (l: { dow: number } & LocalDay) =>
      studioScheduleApi.updateWeeklyHours(l.dow, l.open || null, l.close || null, l.lunchStart || null, l.lunchEnd || null),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['weekly-hours'] }); qc.invalidateQueries({ queryKey: ['admin-schedule'] }); toast.success('Horário guardado') },
    onError: (e: Error) => toast.error(e.message || 'Não foi possível guardar'),
  })

  function commit(dow: number, next: LocalDay) {
    if (!next.open || !next.close) return
    if (next.open >= next.close) { toast.error('A abertura tem de ser antes do fecho'); return }
    // Pausa: ou os dois preenchidos, ou nenhum.
    if ((!!next.lunchStart) !== (!!next.lunchEnd)) return // aguarda o par completar
    if (next.lunchStart && next.lunchEnd) {
      if (next.lunchStart >= next.lunchEnd) { toast.error('O início do almoço deve ser antes do fim'); return }
      if (next.lunchStart < next.open || next.lunchEnd > next.close) { toast.error('O almoço tem de estar dentro do horário'); return }
    }
    setLocal(p => ({ ...p, [dow]: next }))
    save.mutate({ dow, ...next })
  }

  function toggleOpen(dow: number, isOpen: boolean) {
    if (isOpen) {
      const l = local[dow]
      const next: LocalDay = { open: l?.open || DEFAULT_OPEN, close: l?.close || DEFAULT_CLOSE, lunchStart: '', lunchEnd: '' }
      setLocal(p => ({ ...p, [dow]: next }))
      save.mutate({ dow, ...next })
    } else {
      const next: LocalDay = { open: '', close: '', lunchStart: '', lunchEnd: '' }
      setLocal(p => ({ ...p, [dow]: next }))
      save.mutate({ dow, ...next })
    }
  }

  if (isLoading) return <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-9 rounded-lg" />)}</div>

  const inp = 'h-8 w-[88px] rounded-md border border-gray-200 bg-white px-2 text-[13px] text-gray-800 tabular-nums outline-none focus:border-gray-400'
  const inpSm = 'h-7 w-[88px] rounded-md border border-gray-200 bg-white px-2 text-[12px] text-gray-700 tabular-nums outline-none focus:border-gray-400'

  return (
    <div className="divide-y divide-gray-50">
      {DAYS.map(({ dow, label }) => {
        const l = local[dow] ?? { open: '', close: '', lunchStart: '', lunchEnd: '' }
        const isOpen = !!l.open && !!l.close
        return (
          <div key={dow} className="py-2.5">
            <div className="flex items-center gap-3">
              <span className="w-20 text-[13px] font-medium text-gray-700 flex-shrink-0">{label}</span>
              <Switch checked={isOpen} onCheckedChange={(v) => toggleOpen(dow, v)} aria-label={`${label} aberto`} />
              {isOpen ? (
                <div className="flex items-center gap-1.5 ml-auto">
                  <input type="time" value={l.open}
                    onChange={e => setLocal(p => ({ ...p, [dow]: { ...l, open: e.target.value } }))}
                    onBlur={e => commit(dow, { ...l, open: e.target.value })} className={inp} />
                  <span className="text-xs text-gray-400">às</span>
                  <input type="time" value={l.close}
                    onChange={e => setLocal(p => ({ ...p, [dow]: { ...l, close: e.target.value } }))}
                    onBlur={e => commit(dow, { ...l, close: e.target.value })} className={inp} />
                </div>
              ) : (
                <span className="ml-auto text-[13px] text-gray-300">Fechado</span>
              )}
            </div>
            {isOpen && (
              <div className="flex items-center gap-1.5 mt-1.5 pl-[92px]">
                <span className="text-[11px] text-gray-400 w-24 flex-shrink-0">Pausa almoço</span>
                <input type="time" value={l.lunchStart}
                  onChange={e => setLocal(p => ({ ...p, [dow]: { ...l, lunchStart: e.target.value } }))}
                  onBlur={e => commit(dow, { ...l, lunchStart: e.target.value })} className={inpSm} placeholder="--:--" />
                <span className="text-[11px] text-gray-400">às</span>
                <input type="time" value={l.lunchEnd}
                  onChange={e => setLocal(p => ({ ...p, [dow]: { ...l, lunchEnd: e.target.value } }))}
                  onBlur={e => commit(dow, { ...l, lunchEnd: e.target.value })} className={inpSm} placeholder="--:--" />
                {(l.lunchStart || l.lunchEnd) && (
                  <button type="button" onClick={() => commit(dow, { ...l, lunchStart: '', lunchEnd: '' })}
                    className="text-[11px] text-gray-400 hover:text-gray-700 ml-1">limpar</button>
                )}
                <span className="text-[11px] text-gray-300 ml-auto">opcional</span>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
