'use client'

import { useState, useMemo, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight, Sunrise, Sunset, Trash2, Users, CheckCircle2, Lock } from 'lucide-react'
import { toast } from 'sonner'
import { format, addDays, startOfWeek, addWeeks } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { availabilityApi, alunoApi, bookingApi } from '@/lib/api'
import { cn, formatTime } from '@/lib/utils'
import type { StudioSlot } from '@/types'

type MyStudent = { id: string; name: string; email?: string }

const WEEKDAYS = [0, 1, 2, 3, 4, 5] // Mon–Sat

function localDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
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

  // #10 — estúdio fechado pelo admin (feriado/fecho). Preto sólido, não
  // clicável, mostra o motivo. Não dá para libertar nem marcar aqui.
  if (slot.blocked) {
    return (
      <div
        title={slot.blockReason ? `Estúdio fechado: ${slot.blockReason}` : 'Estúdio fechado'}
        className="relative w-full min-h-[56px] sm:min-h-[64px] rounded-lg border border-black bg-black text-gray-500 px-2 py-1.5 flex flex-col justify-between cursor-not-allowed select-none"
      >
        <span className="text-[10px] sm:text-xs font-bold leading-none">{slot.slotTime}</span>
        <span className="flex items-center gap-1 mt-0.5">
          <Lock className="w-3 h-3 shrink-0" />
          <span className="text-[9px] sm:text-[10px] font-semibold leading-tight truncate">Fechado</span>
        </span>
        {slot.blockReason && (
          <span className="text-[8px] sm:text-[9px] leading-none opacity-70 truncate">{slot.blockReason}</span>
        )}
      </div>
    )
  }

  if (slot.released) {
    if (hasMyBookings) {
      bg = 'bg-blue-600 border-blue-700 text-white cursor-not-allowed opacity-90'
      dot = 'bg-blue-300'
      label = `${slot.myBookings} aluno${slot.myBookings > 1 ? 's' : ''}`
      sublabel = `${slot.studioCount}/${slot.studioMax} estúdio`
    } else if (studioFull) {
      // Estúdio cheio (4/4 no estúdio): cinza, "Cheio" + a ocupação.
      bg = 'bg-gray-900 border-black text-white/80 cursor-pointer'
      dot = 'bg-gray-500'
      label = `${slot.studioCount}/${slot.studioMax} · Cheio`
      sublabel = 'estúdio lotado'
    } else {
      // Livre: mostra SEMPRE a ocupação do estúdio (ex.: 0/4, 2/4) — 4 vagas
      // partilhadas entre os PTs. Verde enquanto houver vaga.
      bg = 'bg-emerald-500 border-emerald-600 text-white cursor-pointer hover:bg-emerald-600'
      dot = 'bg-emerald-200'
      label = `${slot.studioCount}/${slot.studioMax}`
      sublabel = slot.studioCount > 0 ? `${slot.studioMax - slot.studioCount} livre${slot.studioMax - slot.studioCount > 1 ? 's' : ''}` : 'livre'
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
  const [studentToBook, setStudentToBook] = useState('')
  const qc = useQueryClient()

  // #15 — o PT marca um dos seus alunos num slot (os mais velhos pedem para o
  // PT marcar por eles). Lista dos alunos do próprio PT.
  const { data: myStudents = [] } = useQuery<MyStudent[]>({
    queryKey: ['pt-students'],
    queryFn: () => alunoApi.myStudents() as Promise<MyStudent[]>,
  })

  const bookForStudent = useMutation({
    mutationFn: ({ availabilityId, studentId }: { availabilityId: string; studentId: string }) =>
      bookingApi.createForStudent(availabilityId, studentId),
    onSuccess: () => {
      toast.success('Aluno marcado ✓ — desconta do pack dele e entra na faturação')
      setConfirmSlot(null); setStudentToBook('')
      qc.invalidateQueries({ queryKey: ['studio-grid'] })
    },
    // O backend dá o motivo exato (sem pack ativo, duração não bate, lotado…).
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Erro ao marcar o aluno'),
  })

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

  // Um único request para o lote inteiro. Antes era um POST por slot em série:
  // "Semana toda" = ~150 round-trips (dezenas de segundos com UM utilizador) e
  // o primeiro slot inválido matava o resto — foi por isso que "Semana toda" a
  // meio da semana dava "Erro ao ativar horários" e criava zero, com segunda e
  // terça já no passado.
  const bulkCreate = useMutation({
    mutationFn: (slots: StudioSlot[]) =>
      availabilityApi.createBatch(
        slots.filter(s => !s.released && !s.blocked).map(s => ({ date: s.date, slotTime: s.slotTime })),
      ),
    onSuccess: ({ created, skipped, results }) => {
      if (created === 0 && skipped === 0) return toast.info('Nada para ativar — já estava tudo ativo')
      if (created === 0) {
        // Nada entrou: o motivo concreto vale mais que "erro".
        const why = [...new Set(results.map(r => r.reason).filter(Boolean))].join(', ')
        return toast.warning(`Nenhum horário ativado — ${why || 'todos foram ignorados'}`)
      }
      toast.success(
        `${created} horário${created !== 1 ? 's' : ''} ativado${created !== 1 ? 's' : ''} ✓` +
        (skipped > 0 ? ` · ${skipped} ignorado${skipped !== 1 ? 's' : ''} (${[...new Set(results.filter(r => !r.created).map(r => r.reason).filter(Boolean))].join(', ')})` : '')
      )
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Erro ao ativar horários'),
    onSettled: invalidate,
  })

  const bulkDelete = useMutation({
    // Sem endpoint de batch para DELETE, mas em paralelo em vez de em série, e
    // com allSettled — um slot que já não pode ser removido não impede os
    // outros nem esconde quantos saíram de facto.
    mutationFn: async (slots: StudioSlot[]) => {
      const ids = slots.filter(s => s.released && !s.myBookings && s.releaseId).map(s => s.releaseId!)
      const outcomes = await Promise.allSettled(ids.map(id => availabilityApi.delete(id)))
      return { removed: outcomes.filter(o => o.status === 'fulfilled').length, failed: outcomes.filter(o => o.status === 'rejected').length }
    },
    onSuccess: ({ removed, failed }) => {
      if (removed === 0 && failed === 0) return toast.info('Nada para remover')
      if (removed > 0) toast.success(`${removed} horário${removed !== 1 ? 's' : ''} removido${removed !== 1 ? 's' : ''}`)
      if (failed > 0) toast.warning(`${failed} não puderam ser removidos (têm alunos confirmados)`)
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Erro ao limpar semana'),
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
  // #11 — disponibilizar em bloco (semana inteira), além de slot-a-slot. Só
  // ativa os que ainda não estão liberados; reusa o mesmo bulkCreate seguro.
  const handleBulkAllWeek = () => bulkCreate.mutate(grid.filter(s => !s.released))
  const handleClearWeek = () => setConfirmClearWeek(true)
  const confirmHandleClearWeek = () => {
    const clearable = grid.filter(s => s.released && s.myBookings === 0)
    bulkDelete.mutate(clearable)
    setConfirmClearWeek(false)
  }

  const busy = toggle.isPending || bulkCreate.isPending || bulkDelete.isPending

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5 max-w-5xl mx-auto">
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
          <div key={label} className="bg-white rounded-xl led-gold px-3 py-3 text-center">
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
          onClick={handleBulkAllWeek}
          disabled={busy || grid.filter(s => !s.released).length === 0}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-white border border-gray-200 rounded-lg hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700 transition-colors min-h-[44px] disabled:opacity-50"
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          Semana toda
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
          { color: 'bg-gray-900', label: 'Estúdio lotado' },
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
        <div className="text-center py-16 bg-white rounded-xl led-gold">
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
      <div className="bg-[#C9A84C]/10 border border-[#C9A84C]/30 rounded-xl px-4 py-3 text-xs text-[#7D6229] leading-relaxed">
        Slots com 🔒 têm alunos confirmados — cancela as reservas antes de remover. O estúdio tem <strong>4 vagas simultâneas</strong> partilhadas entre todos os PTs.
      </div>

      {/* Slot liberado → marcar aluno OU remover. Slot fechado → ativar. */}
      <Dialog open={!!confirmSlot} onOpenChange={(o) => { if (!o) { setConfirmSlot(null); setStudentToBook('') } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmSlot?.released ? 'Horário liberado' : 'Ativar este horário?'}
            </DialogTitle>
            <DialogDescription>
              {confirmSlot && (
                <>
                  {format(new Date(confirmSlot.startTime), "EEEE, d 'de' MMMM", { locale: ptBR })} às {confirmSlot.slotTime}.
                  {confirmSlot.released
                    ? ' Marca um aluno aqui (desconta do pack dele) ou remove o horário.'
                    : ' Os teus alunos vão poder agendar aqui.'}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {/* Marcar aluno — só quando liberado e com vaga no estúdio */}
          {confirmSlot?.released && (
            <div className="space-y-2 py-1">
              <label className="text-xs font-semibold text-gray-600">Marcar aluno neste horário</label>
              <select
                value={studentToBook}
                onChange={e => setStudentToBook(e.target.value)}
                className="w-full min-h-[44px] px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
              >
                <option value="">Escolher aluno…</option>
                {myStudents.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <Button
                className="w-full"
                disabled={!studentToBook || bookForStudent.isPending || (confirmSlot.studioCount >= confirmSlot.studioMax)}
                onClick={() => {
                  if (confirmSlot?.releaseId && studentToBook) {
                    bookForStudent.mutate({ availabilityId: confirmSlot.releaseId, studentId: studentToBook })
                  }
                }}
              >
                {bookForStudent.isPending ? 'A marcar…' : confirmSlot.studioCount >= confirmSlot.studioMax ? 'Estúdio lotado' : 'Marcar aluno'}
              </Button>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => { setConfirmSlot(null); setStudentToBook('') }} disabled={toggle.isPending || bookForStudent.isPending}>
              Voltar
            </Button>
            {confirmSlot?.released ? (
              confirmSlot.myBookings === 0 && (
                <Button
                  variant="destructive"
                  disabled={toggle.isPending}
                  onClick={() => { if (confirmSlot) toggle.mutate(confirmSlot); setConfirmSlot(null) }}
                >
                  Remover horário
                </Button>
              )
            ) : (
              <Button
                disabled={toggle.isPending}
                onClick={() => { if (confirmSlot) toggle.mutate(confirmSlot); setConfirmSlot(null) }}
              >
                Sim, ativar
              </Button>
            )}
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
