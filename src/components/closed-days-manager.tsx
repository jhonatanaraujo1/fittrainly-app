'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { CalendarOff, Plus, X } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { studioScheduleApi } from '@/lib/api'

interface Block { id: string; date: string; startTime: string; endTime: string; reason: string }

// Um feriado / dia fechado = um bloqueio que cobre o dia inteiro.
const FULL_DAY_START = '00:00'
const FULL_DAY_END = '23:59'
const isFullDay = (b: Block) => b.startTime.slice(0, 5) <= '00:00' && b.endTime.slice(0, 5) >= '23:59'

// Horizonte: hoje até ~4 meses à frente (feriados costumam ser planeados assim).
function today(): string { return format(new Date(), 'yyyy-MM-dd') }
function horizonEnd(): string {
  const d = new Date(); d.setMonth(d.getMonth() + 4)
  return format(d, 'yyyy-MM-dd')
}

// Gere os dias em que o estúdio está fechado o dia inteiro (feriados, férias,
// fechos) — separado dos bloqueios pontuais de horário. Reaproveita o
// StudioBlock: fechar um dia cria um bloqueio 00:00–23:59.
export function ClosedDaysManager() {
  const qc = useQueryClient()
  const start = today()
  const { data = [], isLoading } = useQuery<Block[]>({
    queryKey: ['studio-blocks', start],
    queryFn: () => studioScheduleApi.listBlocks(start, horizonEnd()),
  })

  const [date, setDate] = useState('')
  const [reason, setReason] = useState('')

  const closedDays = data.filter(isFullDay)

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['studio-blocks'] })
    qc.invalidateQueries({ queryKey: ['admin-schedule'] })
  }

  const create = useMutation({
    mutationFn: (v: { date: string; reason: string }) =>
      studioScheduleApi.createBlock({ date: v.date, startTime: FULL_DAY_START, endTime: FULL_DAY_END, reason: v.reason }),
    onSuccess: () => { invalidate(); setDate(''); setReason(''); toast.success('Dia fechado') },
    onError: (e: Error) => toast.error(e.message || 'Não foi possível fechar o dia'),
  })

  const remove = useMutation({
    mutationFn: (id: string) => studioScheduleApi.deleteBlock(id),
    onSuccess: () => { invalidate(); toast.success('Dia reaberto') },
    onError: () => toast.error('Não foi possível reabrir o dia'),
  })

  function submit() {
    if (!date) { toast.error('Escolhe a data'); return }
    if (date < today()) { toast.error('Escolhe uma data futura'); return }
    if (closedDays.some(d => d.date === date)) { toast.error('Esse dia já está fechado'); return }
    create.mutate({ date, reason: reason.trim() || 'Feriado' })
  }

  const inp = 'h-9 rounded-lg border border-gray-200 bg-white px-3 text-[13px] text-gray-800 outline-none focus:border-gray-400'

  return (
    <div className="space-y-3">
      {/* Adicionar */}
      <div className="flex flex-wrap items-center gap-2">
        <input type="date" value={date} min={today()} onChange={e => setDate(e.target.value)} className={`${inp} tabular-nums`} />
        <input type="text" value={reason} onChange={e => setReason(e.target.value)} maxLength={80}
          placeholder="Motivo (ex: Feriado, Férias)" className={`${inp} flex-1 min-w-[160px]`} />
        <button type="button" onClick={submit} disabled={create.isPending}
          className="h-9 inline-flex items-center gap-1.5 rounded-lg bg-[#C9A84C] px-3.5 text-[13px] font-semibold text-black hover:brightness-95 disabled:opacity-50 transition">
          <Plus className="w-4 h-4" /> Fechar dia
        </button>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="space-y-2">{[...Array(2)].map((_, i) => <Skeleton key={i} className="h-11 rounded-lg" />)}</div>
      ) : closedDays.length === 0 ? (
        <div className="flex items-center gap-2 rounded-lg border border-dashed border-gray-200 px-3 py-4 text-[13px] text-gray-400">
          <CalendarOff className="w-4 h-4" /> Nenhum dia fechado nos próximos meses.
        </div>
      ) : (
        <ul className="divide-y divide-gray-50 rounded-lg border border-gray-100">
          {closedDays.map(d => (
            <li key={d.id} className="flex items-center gap-3 px-3 py-2.5">
              <CalendarOff className="w-4 h-4 text-[#C9A84C] flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-gray-800 capitalize">{format(parseISO(d.date), "EEEE, d 'de' MMMM", { locale: ptBR })}</p>
                <p className="text-[11px] text-gray-400 truncate">{d.reason}</p>
              </div>
              <button type="button" onClick={() => remove.mutate(d.id)} aria-label="Reabrir dia"
                className="p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 transition">
                <X className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
