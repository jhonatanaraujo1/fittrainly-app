'use client'

import { X, Loader2, Mail, Phone } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { getInitials, avatarColor, formatTime } from '@/lib/utils'

export interface SessionDetailStudent {
  bookingId?: string
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
}

export function SessionDetailDialog({
  open, onOpenChange, startTime, endTime, ptName, students, onCancelBooking, cancellingId,
}: Props) {
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
                    <p className="text-sm font-medium text-gray-900 truncate">{s.name}</p>
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
      </DialogContent>
    </Dialog>
  )
}
