'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { X, Loader2, Mail, Phone, UserPlus, ChevronRight } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { getInitials, avatarColor, formatTime } from '@/lib/utils'
import { CustomSelect } from '@/components/ui/custom-select'

export interface SessionDetailStudent {
  bookingId?: string
  studentId?: string
  name: string
  email?: string
  phone?: string
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  startTime: string
  endTime: string
  ptName?: string
  students: SessionDetailStudent[]
  onCancelBooking?: (bookingId: string) => void
  cancellingId?: string | null
  // #2 — admin marca um aluno do PT neste horário (desconta do pack + fatura).
  bookableStudents?: { id: string; name: string }[]
  onBookStudent?: (studentId: string) => void
  booking?: boolean
}

export function SessionDetailDialog({
  open, onOpenChange, startTime, endTime, ptName, students, onCancelBooking, cancellingId,
  bookableStudents, onBookStudent, booking,
}: Props) {
  const [pick, setPick] = useState('')
  const router = useRouter()
  // Abre a ficha do aluno; fecha o modal antes de navegar para não ficar preso
  // por cima da página nova.
  const openProfile = (studentId: string) => { onOpenChange(false); router.push(`/admin/alunos/${studentId}`) }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{formatTime(startTime)} – {formatTime(endTime)}</DialogTitle>
          <DialogDescription>
            {ptName ? `com ${ptName} · ` : ''}{students.length} aluno{students.length !== 1 ? 's' : ''} confirmado{students.length !== 1 ? 's' : ''}
          </DialogDescription>
        </DialogHeader>

        {students.length === 0 ? (
          <p className="text-sm text-gray-400 py-2">Sem alunos confirmados neste horário.</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {students.map((s, i) => (
              <div key={s.bookingId ?? i} className="flex items-center justify-between py-2.5 gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className={`w-8 h-8 rounded-full ${avatarColor(s.name)} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                    {getInitials(s.name)}
                  </span>
                  <div className="min-w-0">
                    {s.studentId ? (
                      <button
                        type="button"
                        onClick={() => openProfile(s.studentId!)}
                        className="group/name flex items-center gap-1 text-sm font-medium text-gray-900 hover:text-gray-600 transition-colors text-left max-w-full"
                        title="Ver ficha do aluno"
                      >
                        <span className="truncate">{s.name}</span>
                        <ChevronRight className="w-3.5 h-3.5 text-gray-300 group-hover/name:text-gray-500 flex-shrink-0" />
                      </button>
                    ) : (
                      <p className="text-sm font-medium text-gray-900 truncate">{s.name}</p>
                    )}
                    {(s.email || s.phone) && (
                      <div className="flex flex-col gap-0.5 mt-0.5">
                        {s.email && (
                          <a href={`mailto:${s.email}`} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 truncate">
                            <Mail className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate">{s.email}</span>
                          </a>
                        )}
                        {s.phone && (
                          <a href={`tel:${s.phone}`} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600">
                            <Phone className="w-3 h-3 flex-shrink-0" />
                            {s.phone}
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                {onCancelBooking && s.bookingId && (
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={cancellingId === s.bookingId}
                    onClick={() => onCancelBooking(s.bookingId!)}
                    className="flex-shrink-0"
                  >
                    {cancellingId === s.bookingId
                      ? <Loader2 className="w-3 h-3 animate-spin" />
                      : <><X className="w-3 h-3" /> Cancelar</>
                    }
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* #2 — marcar aluno neste horário (admin) */}
        {onBookStudent && (
          <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
            <p className="text-xs font-semibold text-gray-600 flex items-center gap-1.5">
              <UserPlus className="w-3.5 h-3.5" /> Marcar aluno neste horário
            </p>
            {/* A lista só traz os alunos DESTE PT — cada aluno pertence a um PT
                e só treina com esse (regra também imposta no backend). Sem
                alunos vinculados não há o que marcar: dizer isso é melhor do
                que oferecer um select vazio. */}
            {(bookableStudents ?? []).length === 0 ? (
              <p className="text-xs text-gray-500 rounded-xl bg-gray-50 border border-gray-100 px-3 py-2.5">
                {ptName ? `${ptName.split(' ')[0]} ainda não tem alunos vinculados.` : 'Este PT ainda não tem alunos vinculados.'}
                {' '}Vincula um aluno a este PT antes de marcar a sessão.
              </p>
            ) : (
              <>
                <div className="flex gap-2">
                  <CustomSelect
                    size="lg"
                    className="flex-1"
                    value={pick}
                    onChange={setPick}
                    placeholder="Escolher aluno…"
                    options={(bookableStudents ?? []).map(s => ({ value: s.id, label: s.name }))}
                  />
                  <Button
                    disabled={!pick || booking}
                    onClick={() => { if (pick) { onBookStudent(pick); setPick('') } }}
                    className="flex-shrink-0"
                  >
                    {booking ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Marcar'}
                  </Button>
                </div>
                <p className="text-[11px] text-gray-400">Só alunos de {ptName?.split(' ')[0] ?? 'este PT'}. Desconta do pack do aluno e entra na faturação.</p>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
